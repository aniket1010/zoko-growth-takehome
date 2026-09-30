import { desc, eq, sql as dsql } from "drizzle-orm";
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
  let changes = 0;
  for (const c of res.customers ?? []) {
    await db
      .insert(customers)
      .values({ id: c.id, name: c.name ?? null, phone: c.channelId ?? null })
      .onConflictDoUpdate({
        target: customers.id,
        set: { name: dsql`coalesce(excluded.name, ${customers.name})`, phone: dsql`coalesce(${customers.phone}, excluded.phone)` },
      });

    const assigneeId = c.assignment?.id ?? null;
    const [last] = await db
      .select({ assigneeId: assignmentSnapshots.assigneeId })
      .from(assignmentSnapshots)
      .where(eq(assignmentSnapshots.customerId, c.id))
      .orderBy(desc(assignmentSnapshots.observedAt))
      .limit(1);
    if (!last || last.assigneeId !== assigneeId) {
      await db.insert(assignmentSnapshots).values({ customerId: c.id, assigneeId, assigneeType: assigneeId ? (c.assignment?.team ? "team" : "agent") : null });
      changes++;
    }
  }
  return { customers: res.customers?.length ?? 0, changes };
}

/** In-process poller. Stays just above Zoko's 300 s limit. Only runs while the service is awake. */
export function startAssignmentPoller(intervalMs = 310_000) {
  const tick = () =>
    syncAssignments()
      .then((r) => console.log(`assignment poll: ${r.customers} customers, ${r.changes} changes`))
      .catch((err) => console.error("assignment sync failed", err));
  void tick();
  return setInterval(tick, intervalMs);
}
