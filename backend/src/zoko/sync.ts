import { desc, sql as dsql } from "drizzle-orm";
import { db } from "../db/client.js";
import { agents, assignmentSnapshots, customers } from "../db/schema.js";
import { zokoApi, type ZokoAgent } from "./client.js";

export async function syncAgents(): Promise<number> {
  const res = await zokoApi.listAgents();
  const list: ZokoAgent[] = Array.isArray(res) ? res : res.agents ?? [];
  for (const a of list) {
    await db
      .insert(agents)
      .values({ id: a.id, firstName: a.firstName, lastName: a.lastName, email: a.email, role: a.role })
      .onConflictDoUpdate({
        target: agents.id,
        set: { firstName: a.firstName, lastName: a.lastName, email: a.email, role: a.role, syncedAt: new Date() },
      });
  }
  return list.length;
}

/**
 * Zoko has no assignment webhook, so we poll customers with their current
 * assignee and write a snapshot row only when it changed since the last poll.
 *
 * GET /customer is rate-limited to 1 request per 300 seconds, so each poll
 * reads the whole store in one large page. Limitation for the README: a
 * reassignment that happens and reverts within one 5-minute poll is invisible.
 */
export async function syncAssignments(): Promise<{ customers: number; changes: number }> {
  const res = await zokoApi.listAllCustomers();
  const list = res.customers ?? [];

  // 1. Upsert all customers in a few bulk statements, not one query per row.
  for (let i = 0; i < list.length; i += 500) {
    await db
      .insert(customers)
      .values(list.slice(i, i + 500).map((c) => ({ id: c.id, name: c.name ?? null, phone: c.channelId ?? null })))
      .onConflictDoUpdate({
        target: customers.id,
        set: { name: dsql`coalesce(excluded.name, ${customers.name})`, phone: dsql`coalesce(${customers.phone}, excluded.phone)` },
      });
  }

  // 2. Latest known assignee per customer, in one query.
  const latest = await db
    .selectDistinctOn([assignmentSnapshots.customerId], {
      customerId: assignmentSnapshots.customerId,
      assigneeId: assignmentSnapshots.assigneeId,
    })
    .from(assignmentSnapshots)
    .orderBy(assignmentSnapshots.customerId, desc(assignmentSnapshots.observedAt));
  const last = new Map(latest.map((r) => [r.customerId, r.assigneeId]));

  // 3. Insert a snapshot only where the assignee changed (or we have never seen the customer).
  const changed = list
    .map((c) => ({ c, assigneeId: c.assignment?.id ?? null }))
    .filter(({ c, assigneeId }) => !last.has(c.id) || last.get(c.id) !== assigneeId)
    .map(({ c, assigneeId }) => ({
      customerId: c.id,
      assigneeId,
      assigneeType: assigneeId ? (c.assignment?.team ? "team" : "agent") : null,
    }));
  for (let i = 0; i < changed.length; i += 500) {
    await db.insert(assignmentSnapshots).values(changed.slice(i, i + 500));
  }
  return { customers: list.length, changes: changed.length };
}

/**
 * In-process poller. Zoko allows one customer-list request per 300 s per API key.
 * The first poll waits a full interval: on every deploy Render briefly runs the old and
 * new instance side by side, and polling at boot would collide with the old one's poll.
 * A 429 is expected occasionally (deploy overlap, a manual call) and just waits for the next tick.
 */
export function startAssignmentPoller(intervalMs = 310_000) {
  let running = false; // never let a slow poll overlap the next one
  const tick = () => {
    if (running) return;
    running = true;
    syncAssignments()
      .then((r) => console.log(`assignment poll: ${r.customers} customers, ${r.changes} changes`))
      .catch((err) => {
        if (String(err).includes("-> 429")) console.warn(`assignment poll rate-limited by Zoko, retrying in ${intervalMs / 1000}s`);
        else console.error("assignment sync failed", err);
      })
      .finally(() => (running = false));
  };
  console.log(`assignment poller: first poll in ${intervalMs / 1000}s`);
  return setInterval(tick, intervalMs);
}
