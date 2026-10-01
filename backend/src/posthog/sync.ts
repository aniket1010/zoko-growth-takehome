import { createHash } from "node:crypto";
import { inArray } from "drizzle-orm";
import { db, sql } from "../db/client.js";
import { posthogSent } from "../db/schema.js";
import { conversations } from "../metrics/metrics.routes.js";
import { posthog } from "./client.js";

/**
 * Derives PostHog events from our database and sends the ones not sent yet.
 *
 * Why derive instead of capturing inside the webhook handler: a conversation only
 * "starts" or "closes" in our model (docs/decisions.md 007), not in Zoko's raw events.
 * Deriving also backfills everything collected before PostHog was connected, with the
 * original timestamps.
 *
 * Model:
 * - distinct_id = conversation id "<customer_id>:<started_at epoch ms>", so PostHog
 *   "persons" are conversations and the funnel counts conversations, as the brief asks.
 * - Events: conversation_started, conversation_closed, csat_asked, csat_received,
 *   message_received (customer) and message_sent (store; sender_type agent or bot).
 * - Group type "agent", key = Zoko agent id. Human agent messages carry groups.agent,
 *   and each group holds messages_sent and conversations_handled.
 */

type Outgoing = {
  key: string;
  event: string;
  distinctId: string;
  timestamp: Date;
  properties: Record<string, unknown>;
  groups?: Record<string, string>;
};

const CSAT_TEMPLATE = "zoko_csat_test_v0";

/** postgres.js returns timestamptz as Date for table columns and as text in some expressions. */
const ts = (v: string | Date) => (v instanceof Date ? v : new Date(v.replace(" ", "T").replace(/\+00$/, "Z")));
const convId = (customerId: string, startedAt: string | Date) => `${customerId}:${ts(startedAt).getTime()}`;

/** Deterministic UUID (v5 layout) from our key, so PostHog can also de-duplicate a retried send. */
function uuidFor(key: string): string {
  const h = createHash("sha1").update(key).digest("hex");
  const variant = ((parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export async function buildEvents(): Promise<Outgoing[]> {
  const out: Outgoing[] = [];

  const convs = await sql`with c as (${conversations()}) select * from c`;
  for (const c of convs) {
    const id = convId(c.customer_id, c.started_at);
    const base = { conversation_id: id, customer_id: c.customer_id };
    out.push({ key: `conv_start:${id}`, event: "conversation_started", distinctId: id, timestamp: ts(c.started_at), properties: base });
    if (c.closed_at) {
      out.push({
        key: `conv_close:${id}`,
        event: "conversation_closed",
        distinctId: id,
        timestamp: ts(c.closed_at),
        properties: {
          ...base,
          closed_without_reply: c.closed_without_reply,
          resolution_seconds: c.resolution_seconds,
          frt_seconds: c.frt_seconds,
          reassigned: c.reassigned,
        },
        groups: c.closed_by_agent ? { agent: c.closed_by_agent } : undefined,
      });
    }
  }

  // Every message, attached to the latest conversation that started at or before it.
  // Store messages after a close (e.g. the CSAT survey) therefore belong to the
  // conversation that was just closed. Messages before any conversation fall back
  // to a per-customer id.
  const msgs = await sql`
    with c as (${conversations()})
    select m.id, m.customer_id, m.direction, m.sender_type, m.agent_id, m.sent_at, m.type,
           m.template_name, m.reply_to_template, m.postback,
           (select cc.started_at from c cc where cc.customer_id = m.customer_id and cc.started_at <= m.sent_at
             order by cc.started_at desc limit 1) as conv_started_at
    from messages m order by m.sent_at`;
  for (const m of msgs) {
    const id = m.conv_started_at ? convId(m.customer_id, m.conv_started_at) : `customer:${m.customer_id}`;
    const groups = m.sender_type === "agent" && m.agent_id ? { agent: m.agent_id as string } : undefined;
    const props = { conversation_id: id, customer_id: m.customer_id, sender_type: m.sender_type, message_type: m.type };
    out.push({
      key: `msg:${m.id}`,
      event: m.direction === "FROM_CUSTOMER" ? "message_received" : "message_sent",
      distinctId: id,
      timestamp: ts(m.sent_at),
      properties: props,
      groups,
    });
    if (m.template_name === CSAT_TEMPLATE) {
      out.push({ key: `csat_asked:${m.id}`, event: "csat_asked", distinctId: id, timestamp: ts(m.sent_at), properties: props, groups });
    }
    if (m.reply_to_template === CSAT_TEMPLATE) {
      const rating = /^[1-5]$/.test(m.postback ?? "") ? Number(m.postback) : null;
      out.push({ key: `csat_received:${m.id}`, event: "csat_received", distinctId: id, timestamp: ts(m.sent_at), properties: { ...props, rating } });
    }
  }
  return out;
}

/**
 * Group properties per agent, recomputed from the database on every sync.
 * conversations_handled = conversations the agent first replied to or closed after a human reply.
 */
export async function agentGroups() {
  return sql`
    with c as (${conversations()}),
    handled as (
      select first_reply_agent as agent_id, customer_id, gen from c where first_reply_agent is not null
      union
      select closed_by_agent, customer_id, gen from c where closed_by_agent is not null and first_reply_at is not null
    )
    select a.id,
           trim(coalesce(nullif(trim(coalesce(a.first_name,'') || ' ' || coalesce(a.last_name,'')), ''), a.email)) as name,
           a.email,
           (select count(*) from messages m where m.agent_id = a.id and m.sender_type = 'agent')::int as messages_sent,
           (select count(*) from handled h where h.agent_id = a.id)::int as conversations_handled
    from agents a
    where exists (select 1 from messages m where m.agent_id = a.id and m.sender_type = 'agent')
       or exists (select 1 from handled h where h.agent_id = a.id)`;
}

async function alreadySent(keys: string[]): Promise<Set<string>> {
  const seen = new Set<string>();
  for (let i = 0; i < keys.length; i += 1000) {
    const rows = await db.select({ key: posthogSent.key }).from(posthogSent).where(inArray(posthogSent.key, keys.slice(i, i + 1000)));
    for (const r of rows) seen.add(r.key);
  }
  return seen;
}

let running = false;

export async function syncPosthog(): Promise<{ sent: number; groups: number } | { skipped: string }> {
  if (!posthog) return { skipped: "POSTHOG_API_KEY not set" };
  if (running) return { skipped: "sync already running" };
  running = true;
  try {
    const events = await buildEvents();

    // A group is re-sent only when its numbers or name changed.
    const groups = (await agentGroups()).map((g) => ({ g, key: `group:${g.id}:${g.messages_sent}:${g.conversations_handled}:${g.name}` }));

    const seen = await alreadySent([...events.map((e) => e.key), ...groups.map((x) => x.key)]);
    const freshEvents = events.filter((e) => !seen.has(e.key));
    const freshGroups = groups.filter((x) => !seen.has(x.key));

    // Group properties first, so grouped events land on a described group.
    for (const { g } of freshGroups) {
      posthog.groupIdentify({
        groupType: "agent",
        groupKey: g.id,
        properties: { name: g.name, email: g.email, messages_sent: g.messages_sent, conversations_handled: g.conversations_handled },
      });
    }
    for (const e of freshEvents) {
      posthog.capture({
        distinctId: e.distinctId,
        event: e.event,
        properties: e.properties,
        groups: e.groups,
        timestamp: e.timestamp,
        uuid: uuidFor(e.key),
      });
    }
    await posthog.flush();

    // Record only after a successful flush, so a failed send is retried next time.
    const keys = [...freshEvents.map((e) => e.key), ...freshGroups.map((x) => x.key)];
    for (let i = 0; i < keys.length; i += 500) {
      await db.insert(posthogSent).values(keys.slice(i, i + 500).map((key) => ({ key }))).onConflictDoNothing();
    }
    return { sent: freshEvents.length, groups: freshGroups.length };
  } finally {
    running = false;
  }
}

/** Debounced trigger: webhook events arrive in bursts, so sync once after they settle. */
let timer: NodeJS.Timeout | undefined;
export function scheduleSyncPosthog(delayMs = 5_000) {
  if (!posthog) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    syncPosthog()
      .then((r) => {
        if ("sent" in r && (r.sent || r.groups)) console.log(`posthog sync: ${r.sent} events, ${r.groups} groups`);
      })
      .catch((err) => console.error("posthog sync failed", err));
  }, delayMs);
}
