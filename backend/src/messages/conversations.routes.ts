import { Router } from "express";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, sql } from "../db/client.js";
import { customers, messages } from "../db/schema.js";
import { zokoApi } from "../zoko/client.js";
import { assertRecipientAllowed, RecipientNotAllowedError } from "./guardrail.js";

export const conversationsRouter = Router();

/**
 * One row per customer who has messaged since the webhook went live, with the
 * current assignee, whether the latest chat is open, and the last message.
 */
conversationsRouter.get("/", async (_req, res) => {
  const rows = await sql`
    select c.id, c.name, c.phone,
           a.assignee_id,
           trim(coalesce(nullif(trim(coalesce(ag.first_name,'') || ' ' || coalesce(ag.last_name,'')), ''), ag.email)) as assignee_name,
           count(m.id)::int as message_count,
           count(m.id) filter (where m.direction = 'FROM_CUSTOMER')::int as inbound_count,
           max(m.sent_at) as last_message_at,
           (select left(text, 80) from messages x where x.customer_id = c.id order by sent_at desc limit 1) as last_message,
           -- Closed if there is a close event and the customer has not written since.
           -- (Agents sending after a close, or a CSAT rating, does not reopen the chat.)
           coalesce(
             (select max(event_at) from chat_events e where e.customer_id = c.id and e.kind = 'closed')
               >= coalesce(max(m.sent_at) filter (where m.direction = 'FROM_CUSTOMER' and m.reply_to_template is null), '-infinity'),
             false) as is_closed
    from customers c
    join messages m on m.customer_id = c.id
    left join lateral (
      select assignee_id from assignment_snapshots s
      where s.customer_id = c.id order by observed_at desc limit 1
    ) a on true
    left join agents ag on ag.id = a.assignee_id
    group by c.id, a.assignee_id, ag.first_name, ag.last_name, ag.email
    order by last_message_at desc`;
  res.json(rows);
});

conversationsRouter.get("/:customerId", async (req, res) => {
  const [row] = await sql`
    select c.id, c.name, c.phone,
           trim(coalesce(nullif(trim(coalesce(ag.first_name,'') || ' ' || coalesce(ag.last_name,'')), ''), ag.email)) as assignee_name
    from customers c
    left join lateral (select assignee_id from assignment_snapshots s where s.customer_id = c.id order by observed_at desc limit 1) a on true
    left join agents ag on ag.id = a.assignee_id
    where c.id = ${req.params.customerId}`;
  if (!row) {
    res.status(404).json({ error: "customer not found" });
    return;
  }
  res.json(row);
});

conversationsRouter.get("/:customerId/messages", async (req, res) => {
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.customerId, req.params.customerId))
    .orderBy(asc(messages.sentAt));
  res.json(rows);
});

/** Assignment and close events, so the thread can show "assigned to X" / "closed by X". */
conversationsRouter.get("/:customerId/events", async (req, res) => {
  const rows = await sql`
    select e.kind, e.event_at, e.closed_by_type,
           trim(coalesce(nullif(trim(coalesce(a.first_name,'') || ' ' || coalesce(a.last_name,'')), ''), a.email)) as agent_name
    from chat_events e left join agents a on a.id = e.agent_id
    where e.customer_id = ${req.params.customerId}
    order by e.event_at`;
  res.json(rows);
});

const SendBody = z.object({ text: z.string().min(1).max(4096) });

conversationsRouter.post("/:customerId/messages", async (req, res) => {
  const { text } = SendBody.parse(req.body);
  const [customer] = await db.select().from(customers).where(eq(customers.id, req.params.customerId));
  if (!customer) {
    res.status(404).json({ error: "customer not found" });
    return;
  }
  try {
    const recipient = assertRecipientAllowed(customer.phone);
    const result = await zokoApi.sendText(recipient, text);
    // The message row itself arrives via the message:store:out webhook.
    res.status(202).json(result);
  } catch (err) {
    if (err instanceof RecipientNotAllowedError) {
      res.status(403).json({ error: err.message });
      return;
    }
    throw err;
  }
});
