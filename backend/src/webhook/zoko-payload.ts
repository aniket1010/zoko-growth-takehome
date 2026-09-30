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

export const ZokoEvent = z.discriminatedUnion("event", [MessageEvent, DeliveryEvent]);
export type ZokoEvent = z.infer<typeof ZokoEvent>;

/** Same message can produce several delivery updates, so status is part of the key. */
export const dedupeKeyFor = (body: { event?: unknown; id?: unknown; deliveryStatus?: unknown }) =>
  `${String(body.event)}:${String(body.id)}:${String(body.deliveryStatus ?? "")}`;
