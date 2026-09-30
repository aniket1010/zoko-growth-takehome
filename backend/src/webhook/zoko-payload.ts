import { createHash } from "node:crypto";
import { z } from "zod";

// Shapes from https://docs.zoko.io/webhooks/webhook-payload
// .passthrough() keeps unknown fields, because real payloads may carry more
// than the docs show. The raw JSON is stored regardless.
const MessageEvent = z
  .object({
    event: z.enum(["message:user:in", "message:store:out"]),
    id: z.string().uuid(),
    customer: z.object({ id: z.string().uuid(), name: z.string().optional() }).passthrough(),
    customerName: z.string().optional(),
    direction: z.enum(["FROM_CUSTOMER", "FROM_STORE"]),
    platform: z.string(),
    platformSenderId: z.string(),
    platformTimestamp: z.string(),
    deliveryStatus: z.string().optional(),
    type: z.string().optional(),
    text: z.string().optional(),
  })
  .passthrough();

const DeliveryEvent = z
  .object({
    event: z.literal("message:delivery:update"),
    id: z.string().uuid(), // id of the message whose status changed
    deliveryStatus: z.string(),
    platformTimestamp: z.string(),
  })
  .passthrough();

// Undocumented chat events. Shapes observed on 30 Sep 2026.
const Agent = z.object({ id: z.string(), name: z.string().nullish(), email: z.string().nullish() }).passthrough();
const ChatAssignedEvent = z
  .object({ event: z.literal("zoko:chat:assigned"), customerId: z.string().uuid(), eventAt: z.string(), agent: Agent.nullish() })
  .passthrough();
const ChatClosedEvent = z
  .object({
    event: z.literal("zoko:chat:closed"),
    customerId: z.string().uuid(),
    eventAt: z.string(),
    agent: Agent.nullish(),
    closedBy: z.object({ type: z.string(), agent: Agent.nullish() }).passthrough().nullish(),
  })
  .passthrough();

export const PARSED_EVENTS = [
  "message:user:in",
  "message:store:out",
  "message:delivery:update",
  "zoko:chat:assigned",
  "zoko:chat:closed",
] as const;

export const ZokoEvent = z.discriminatedUnion("event", [MessageEvent, DeliveryEvent, ChatAssignedEvent, ChatClosedEvent]);
export type ZokoEvent = z.infer<typeof ZokoEvent>;

/**
 * Message events: event + message id + status (one message gets several delivery updates).
 * Anything else (chat closed, chat assigned, undocumented events): we do not know yet
 * whether they carry a unique id, so we key on a hash of the exact body. A Zoko retry
 * sends identical bytes, so it is still deduplicated; two different closes are not.
 */
export const dedupeKeyFor = (
  body: { event?: unknown; id?: unknown; deliveryStatus?: unknown },
  rawBody?: Buffer,
) => {
  const event = String(body.event ?? "unknown");
  if (event.startsWith("message:") && typeof body.id === "string") {
    return `${event}:${body.id}:${String(body.deliveryStatus ?? "")}`;
  }
  const bytes = rawBody ?? Buffer.from(JSON.stringify(body));
  return `${event}:sha256:${createHash("sha256").update(bytes).digest("hex")}`;
};
