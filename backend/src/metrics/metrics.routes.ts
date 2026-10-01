import { Router } from "express";
import { sql } from "../db/client.js";

export const metricsRouter = Router();

/**
 * Conversation model (see docs/decisions.md, 007):
 *
 * - A customer's timeline is cut by zoko:chat:closed events. Everything between two
 *   closes belongs to one conversation. `gen` = number of closes before a message, so
 *   messages with the same (customer_id, gen) are one conversation, and the close with
 *   index `gen` ends it.
 * - A conversation only counts if it contains a customer message (customer-initiated).
 *   A CSAT answer does not count: it belongs to the conversation that was rated.
 * - started_at    = first customer message in the conversation
 * - first_reply   = first HUMAN agent message after started_at. Bot replies and the
 *                   CSAT survey template do not count as a response.
 * - closed_at     = the chat:closed event that ends it (null = still open)
 * - FRT           = first_reply - started_at, credited to the agent who replied
 * - Resolution    = closed_at - started_at, credited to the agent who owned it at close.
 *                   Only for conversations a human replied to; closing without any
 *                   human reply is counted separately as closed_without_reply.
 * - Reassigned    = the assignee changed from one agent to a different one during the
 *                   conversation (webhook event or poll); credited to the agent it was
 *                   taken from
 */
export const conversations = () => sql`
  with closes as (
    select customer_id, event_at, agent_id,
           (row_number() over (partition by customer_id order by event_at) - 1)::int as gen
    from chat_events where kind = 'closed'
  ),
  msgs as (
    select m.*,
           (select count(*) from chat_events ce
             where ce.kind = 'closed' and ce.customer_id = m.customer_id and ce.event_at < m.sent_at)::int as gen
    from messages m
  ),
  base as (
    select customer_id, gen,
           -- A CSAT rating is an answer to the survey, not a new request, so it never
           -- starts a conversation (the survey is usually sent after the close).
           min(sent_at) filter (where direction = 'FROM_CUSTOMER' and reply_to_template is null) as started_at,
           count(*)::int as message_count
    from msgs group by customer_id, gen
  ),
  conv as (
    select b.customer_id, b.gen, b.started_at, b.message_count,
           fr.sent_at as first_reply_at, fr.agent_id as first_reply_agent,
           cl.event_at as closed_at, cl.agent_id as closed_by_agent
    from base b
    left join lateral (
      select sent_at, agent_id from msgs x
      where x.customer_id = b.customer_id and x.gen = b.gen
        and x.sender_type = 'agent' and x.sent_at >= b.started_at
        and x.template_name is distinct from 'zoko_csat_test_v0'
      order by sent_at limit 1
    ) fr on true
    left join closes cl on cl.customer_id = b.customer_id and cl.gen = b.gen
    where b.started_at is not null
  ),
  handoffs as (
    -- Assignment history = zoko:chat:assigned events plus the 5-minute customer-list
    -- poll (both are written to assignment_snapshots). The poll is needed because some
    -- assignment changes never produce a webhook event (seen 30 Sep 2026).
    select c.customer_id, c.gen, s.assignee_id as to_agent,
           (select p.assignee_id from assignment_snapshots p
             where p.customer_id = s.customer_id and p.observed_at < s.observed_at
             order by p.observed_at desc limit 1) as from_agent
    from conv c
    join assignment_snapshots s on s.customer_id = c.customer_id
      and s.observed_at >= c.started_at and s.observed_at <= coalesce(c.closed_at, now())
  )
  select c.*,
         extract(epoch from (c.first_reply_at - c.started_at))::float as frt_seconds,
         case when c.first_reply_at is not null
              then extract(epoch from (c.closed_at - c.started_at))::float end as resolution_seconds,
         (c.closed_at is not null and c.first_reply_at is null) as closed_without_reply,
         exists (select 1 from handoffs h where h.customer_id = c.customer_id and h.gen = c.gen
                   and h.from_agent is not null and h.from_agent is distinct from h.to_agent) as reassigned,
         (select array_agg(distinct h.from_agent) from handoffs h
           where h.customer_id = c.customer_id and h.gen = c.gen
             and h.from_agent is not null and h.from_agent is distinct from h.to_agent) as reassigned_from
  from conv c
`;

const stats = (col: string) => sql`
  avg(${sql(col)})::float as ${sql("avg_" + col)},
  percentile_cont(0.5) within group (order by ${sql(col)})::float as ${sql("median_" + col)}
`;

metricsRouter.get("/overview", async (_req, res) => {
  const [totals] = await sql`
    select count(*)::int as total_messages,
           count(*) filter (where direction = 'FROM_CUSTOMER')::int as customer_messages,
           count(*) filter (where sender_type = 'agent')::int as agent_messages,
           count(*) filter (where sender_type = 'bot')::int as bot_messages,
           count(distinct customer_id)::int as customers_with_messages
    from messages`;

  const [conv] = await sql`
    with c as (${conversations()})
    select count(*)::int as conversations,
           count(*) filter (where closed_at is not null)::int as closed,
           count(*) filter (where first_reply_at is null and closed_at is null)::int as awaiting_first_reply,
           count(*) filter (where closed_without_reply)::int as closed_without_reply,
           count(*) filter (where reassigned)::int as reassigned,
           ${stats("frt_seconds")}, ${stats("resolution_seconds")}
    from c`;

  const [csat] = await sql`
    select count(*) filter (where template_name = 'zoko_csat_test_v0')::int as csat_asked,
           count(*) filter (where reply_to_template = 'zoko_csat_test_v0')::int as csat_received,
           avg(postback::numeric) filter (where reply_to_template = 'zoko_csat_test_v0' and postback ~ '^[1-5]$')::float as csat_avg
    from messages`;

  const perCustomer = await sql`
    select c.id, c.name, c.phone, count(m.id)::int as messages,
           count(m.id) filter (where m.direction = 'FROM_CUSTOMER')::int as from_customer
    from customers c join messages m on m.customer_id = c.id
    group by c.id order by messages desc`;

  res.json({ ...totals, ...conv, ...csat, messages_per_customer: perCustomer });
});

metricsRouter.get("/agents", async (_req, res) => {
  const rows = await sql`
    with c as (${conversations()}),
    frt as (
      select first_reply_agent as agent_id, count(*)::int as replied_conversations, ${stats("frt_seconds")}
      from c where first_reply_agent is not null group by 1
    ),
    res as (
      select closed_by_agent as agent_id, count(*)::int as closed_conversations, ${stats("resolution_seconds")}
      from c where closed_by_agent is not null and resolution_seconds is not null group by 1
    ),
    re as (
      select unnest(reassigned_from) as agent_id, count(*)::int as reassigned_chats
      from c where reassigned group by 1
    ),
    csat as (
      select q.agent_id, count(r.id)::int as csat_received, avg(r.postback::numeric)::float as csat_avg
      from messages q
      join lateral (
        select id, postback from messages r
        where r.customer_id = q.customer_id and r.reply_to_template = 'zoko_csat_test_v0'
          and r.sent_at > q.sent_at and r.postback ~ '^[1-5]$'
        order by r.sent_at limit 1
      ) r on true
      where q.template_name = 'zoko_csat_test_v0' and q.agent_id is not null
      group by 1
    ),
    sent as (
      select agent_id, count(*)::int as messages_sent from messages where sender_type = 'agent' and agent_id is not null group by 1
    )
    select a.id, trim(coalesce(nullif(trim(coalesce(a.first_name,'') || ' ' || coalesce(a.last_name,'')), ''), a.email)) as name, a.email,
           coalesce(sent.messages_sent, 0) as messages_sent,
           coalesce(frt.replied_conversations, 0) as replied_conversations,
           frt.avg_frt_seconds, frt.median_frt_seconds,
           coalesce(res.closed_conversations, 0) as closed_conversations,
           res.avg_resolution_seconds, res.median_resolution_seconds,
           coalesce(re.reassigned_chats, 0) as reassigned_chats,
           coalesce(csat.csat_received, 0) as csat_received, csat.csat_avg
    from agents a
    left join csat on csat.agent_id = a.id
    left join frt on frt.agent_id = a.id
    left join res on res.agent_id = a.id
    left join re on re.agent_id = a.id
    left join sent on sent.agent_id = a.id
    where frt.agent_id is not null or res.agent_id is not null or re.agent_id is not null or sent.agent_id is not null
    order by messages_sent desc, name`;
  res.json(rows);
});

/** One row per conversation, for drill-down and debugging the definitions. */
metricsRouter.get("/conversations", async (_req, res) => {
  const rows = await sql`
    with c as (${conversations()})
    select c.*, cu.name as customer_name
    from c join customers cu on cu.id = c.customer_id
    order by c.started_at desc`;
  res.json(rows);
});

/**
 * Own feature: the queue a support lead should look at right now. Open conversations
 * with no human reply yet, longest wait first.
 */
metricsRouter.get("/attention", async (_req, res) => {
  const rows = await sql`
    with c as (${conversations()})
    select c.customer_id, cu.name as customer_name, cu.phone, c.started_at,
           extract(epoch from (now() - c.started_at))::float as waiting_seconds,
           c.message_count,
           (select trim(coalesce(nullif(trim(coalesce(a.first_name,'') || ' ' || coalesce(a.last_name,'')), ''), a.email))
              from assignment_snapshots s join agents a on a.id = s.assignee_id
             where s.customer_id = c.customer_id order by s.observed_at desc limit 1) as assignee_name
    from c join customers cu on cu.id = c.customer_id
    where c.closed_at is null and c.first_reply_at is null
    order by c.started_at asc`;
  res.json(rows);
});
