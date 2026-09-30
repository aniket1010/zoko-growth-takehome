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
 * Limitation to state in the README: two reassignments between polls look like one.
 */
export async function syncAssignments(): Promise<{ customers: number; changes: number }> {
  let page = 1;
  let seen = 0;
  let changes = 0;
  for (;;) {
    const res = await zokoApi.listCustomers(page);
    for (const c of res.customers ?? []) {
      seen++;
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
        await db.insert(assignmentSnapshots).values({ customerId: c.id, assigneeId, assigneeType: c.assignment?.type ?? null });
        changes++;
      }
    }
    if (page >= (res.totalPages ?? 1)) break;
    page++;
  }
  return { customers: seen, changes };
}

/** In-process poller. On Render free tier this only runs while the service is awake. */
export function startAssignmentPoller(intervalMs = 60_000) {
  const tick = () =>
    syncAssignments().catch((err) => console.error("assignment sync failed", err));
  void tick();
  return setInterval(tick, intervalMs);
}
