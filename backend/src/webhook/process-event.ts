import { and, desc, eq, lte, sql as dsql } from "drizzle-orm";
import { db } from "../db/client.js";
import { assignmentSnapshots, customers, messages, rawEvents } from "../db/schema.js";
import { ZokoEvent } from "./zoko-payload.js";

/** Parse one stored raw event into the domain tables. Safe to run twice. */
export async function processRawEvent(rawId: number): Promise<void> {
  const [row] = await db.select().from(rawEvents).where(eq(rawEvents.id, rawId));
  if (!row || row.processedAt) return;

  try {
    const evt = ZokoEvent.parse(row.payload);

    if (evt.event === "message:delivery:update") {
      await db.update(messages).set({ deliveryStatus: evt.deliveryStatus }).where(eq(messages.id, evt.id));
    } else {
      const sentAt = new Date(evt.platformTimestamp);
      await db
        .insert(customers)
        .values({
          id: evt.customer.id,
          name: evt.customer.name ?? evt.customerName ?? null,
          phone: evt.platformSenderId,
          firstSeenAt: sentAt,
          lastSeenAt: sentAt,
        })
        .onConflictDoUpdate({
          target: customers.id,
          set: {
            name: dsql`coalesce(excluded.name, ${customers.name})`,
            lastSeenAt: dsql`greatest(${customers.lastSeenAt}, excluded.last_seen_at)`,
          },
        });

      // Attribute store messages to whoever was assigned when it was sent.
      let agentId: string | null = null;
      if (evt.direction === "FROM_STORE") {
        const [snap] = await db
          .select({ assigneeId: assignmentSnapshots.assigneeId })
          .from(assignmentSnapshots)
          .where(and(eq(assignmentSnapshots.customerId, evt.customer.id), lte(assignmentSnapshots.observedAt, sentAt)))
          .orderBy(desc(assignmentSnapshots.observedAt))
          .limit(1);
        agentId = snap?.assigneeId ?? null;
      }

      await db
        .insert(messages)
        .values({
          id: evt.id,
          customerId: evt.customer.id,
          direction: evt.direction,
          type: evt.type ?? null,
          text: evt.text ?? null,
          sentAt,
          deliveryStatus: evt.deliveryStatus ?? null,
          agentId,
        })
        .onConflictDoNothing();
    }

    await db.update(rawEvents).set({ processedAt: new Date(), error: null }).where(eq(rawEvents.id, rawId));
  } catch (err) {
    // Keep the raw row, record why it failed, and move on. Replay later.
    await db.update(rawEvents).set({ error: String(err) }).where(eq(rawEvents.id, rawId));
    console.error(`raw_event ${rawId} failed`, err);
  }
}
