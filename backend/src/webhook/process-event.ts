import { and, desc, eq, isNull, lte, sql as dsql } from "drizzle-orm";
import { db } from "../db/client.js";
import { agents, assignmentSnapshots, chatEvents, customers, messages, rawEvents } from "../db/schema.js";
import { PARSED_EVENTS, ZokoEvent } from "./zoko-payload.js";

/** Parse one stored raw event into the domain tables. Safe to run twice. */
export async function processRawEvent(rawId: number): Promise<void> {
  const [row] = await db.select().from(rawEvents).where(eq(rawEvents.id, rawId));
  if (!row || row.processedAt) return;

  // Events we do not parse yet (e.g. zoko:chat:closed, zoko:chat:assigned) stay in
  // raw_events untouched, ready to be parsed once we have seen their real shape.
  const eventName = (row.payload as { event?: string })?.event ?? "";
  if (!(PARSED_EVENTS as readonly string[]).includes(eventName)) return;

  try {
    const evt = ZokoEvent.parse(row.payload);

    if (evt.event === "zoko:chat:assigned" || evt.event === "zoko:chat:closed") {
      const at = new Date(evt.eventAt);
      const agentId = evt.agent?.id ?? null;
      // The customer may be new to us (e.g. created since the last poll).
      await db.insert(customers).values({ id: evt.customerId, firstSeenAt: at, lastSeenAt: at }).onConflictDoNothing();
      await db
        .insert(chatEvents)
        .values({
          rawEventId: rawId,
          customerId: evt.customerId,
          kind: evt.event === "zoko:chat:assigned" ? "assigned" : "closed",
          agentId,
          closedByType: evt.event === "zoko:chat:closed" ? (evt.closedBy?.type ?? null) : null,
          eventAt: at,
        })
        .onConflictDoNothing();
      // An assignment event is exact, so it also becomes an assignment snapshot
      // (more precise than the 5-minute poll).
      if (evt.event === "zoko:chat:assigned") {
        await db.insert(assignmentSnapshots).values({ customerId: evt.customerId, assigneeId: agentId, assigneeType: agentId ? "agent" : null, observedAt: at });
      }
    } else if (evt.event === "message:delivery:update") {
      const updated = await applyDeliveryStatus(evt.id, evt.deliveryStatus);
      if (!updated) {
        // The message itself has not been stored yet (events can arrive or finish
        // processing out of order). Leave this unprocessed; it is applied as soon
        // as the message row is inserted.
        await db.update(rawEvents).set({ error: "waiting for message row" }).where(eq(rawEvents.id, rawId));
        return;
      }
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

      // Store messages: a human reply carries agentEmail, so credit that agent.
      // Anything else (AI assistant, automations) is a bot. As a fallback for
      // agent replies we cannot match by email, use the assignee at send time.
      let agentId: string | null = null;
      const agentEmail = evt.agentEmail ?? null;
      // appType seen on store messages: "webapp" (agent in Zoko's app, has agentEmail),
      // "direct_api" (sent through the API, e.g. from this dashboard's send box: a human,
      // credited to the chat's assignee) and "enigma"/none (the store's AI assistant).
      const sentViaApi = evt.appType === "direct_api";
      const senderType =
        evt.direction === "FROM_CUSTOMER" ? "customer" : agentEmail || sentViaApi ? "agent" : "bot";
      if (agentEmail) {
        const [a] = await db.select({ id: agents.id }).from(agents).where(dsql`lower(${agents.email}) = lower(${agentEmail})`);
        agentId = a?.id ?? null;
      }
      if (senderType === "agent" && !agentId) {
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
          senderType,
          agentEmail,
          templateName: evt.templateName ?? null,
          replyToTemplate: evt.context?.template_id ?? null,
          postback: evt.context?.postback ?? null,
        })
        // Re-processing (replay) refreshes the derived fields but keeps delivery status.
        .onConflictDoUpdate({
          target: messages.id,
          set: {
            agentId: dsql`excluded.agent_id`,
            senderType: dsql`excluded.sender_type`,
            agentEmail: dsql`excluded.agent_email`,
            templateName: dsql`excluded.template_name`,
            replyToTemplate: dsql`excluded.reply_to_template`,
            postback: dsql`excluded.postback`,
          },
        });

      // Apply any delivery updates that arrived before this message was stored.
      const early = await db
        .select({ id: rawEvents.id })
        .from(rawEvents)
        .where(and(eq(rawEvents.event, "message:delivery:update"), isNull(rawEvents.processedAt), dsql`${rawEvents.payload}->>'id' = ${evt.id}`));
      await db.update(rawEvents).set({ processedAt: new Date(), error: null }).where(eq(rawEvents.id, rawId));
      for (const e of early) await processRawEvent(e.id);
      return;
    }

    await db.update(rawEvents).set({ processedAt: new Date(), error: null }).where(eq(rawEvents.id, rawId));
  } catch (err) {
    // Keep the raw row, record why it failed, and move on. Replay later.
    await db.update(rawEvents).set({ error: String(err) }).where(eq(rawEvents.id, rawId));
    console.error(`raw_event ${rawId} failed`, err);
  }
}

/**
 * Status only moves forward: a late "delivered" must not overwrite "seen" (Zoko's word for read).
 * "failed" always wins. Returns false if the message row does not exist yet.
 */
const STATUS_RANK = dsql`case lower(coalesce(${messages.deliveryStatus}, ''))
  when 'failed' then 99 when 'read' then 4 when 'seen' then 4 when 'delivered' then 3
  when 'sent' then 2 when 'accepted' then 1 else 0 end`;

async function applyDeliveryStatus(messageId: string, status: string): Promise<boolean> {
  const rank: Record<string, number> = { failed: 99, read: 4, seen: 4, delivered: 3, sent: 2, accepted: 1 };
  const newRank = rank[status.toLowerCase()] ?? 0;
  const exists = await db.select({ id: messages.id }).from(messages).where(eq(messages.id, messageId));
  if (exists.length === 0) return false;
  await db
    .update(messages)
    .set({ deliveryStatus: status })
    .where(and(eq(messages.id, messageId), dsql`${STATUS_RANK} <= ${newRank}`));
  return true;
}
