import {
  pgTable, pgEnum, text, timestamp, jsonb, uuid, bigserial, bigint, index, uniqueIndex,
} from "drizzle-orm/pg-core";

// Zoko documents exactly three webhook events. See docs/zoko-integration.md.
export const zokoEvent = pgEnum("zoko_event", [
  "message:user:in",
  "message:store:out",
  "message:delivery:update",
]);
export const direction = pgEnum("direction", ["FROM_CUSTOMER", "FROM_STORE"]);

/**
 * Append-only log of every webhook delivery, stored before any parsing.
 * If parsing has a bug we can fix it and replay from here, because Zoko
 * cannot re-send history (there is no list-messages endpoint).
 */
export const rawEvents = pgTable(
  "raw_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    // Zoko retries up to 5 times, so the same event can arrive more than once.
    dedupeKey: text("dedupe_key").notNull(),
    event: text("event").notNull(),
    payload: jsonb("payload").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    error: text("error"),
  },
  (t) => [uniqueIndex("raw_events_dedupe_key_uq").on(t.dedupeKey)],
);

export const customers = pgTable("customers", {
  id: uuid("id").primaryKey(), // Zoko customer id
  name: text("name"),
  phone: text("phone"), // platformSenderId, E.164
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agents = pgTable("agents", {
  id: text("id").primaryKey(), // Zoko agent id from GET /agent/agents
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email"),
  role: text("role"),
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey(), // Zoko message id
    customerId: uuid("customer_id").notNull().references(() => customers.id),
    direction: direction("direction").notNull(),
    type: text("type"),
    text: text("text"),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull(), // platformTimestamp
    deliveryStatus: text("delivery_status"),
    // Who sent a store message. Human replies from Zoko's web app carry agentEmail;
    // the store's AI assistant and automations do not.
    agentId: text("agent_id"),
    senderType: text("sender_type"), // customer | agent | bot
    agentEmail: text("agent_email"),
    templateName: text("template_name"), // outgoing template, e.g. zoko_csat_test_v0
    replyToTemplate: text("reply_to_template"), // incoming button reply: which template it answers
    postback: text("postback"), // incoming button reply value, e.g. the CSAT rating
  },
  (t) => [index("messages_customer_sent_idx").on(t.customerId, t.sentAt)],
);

/**
 * Zoko has no assignment webhook. We poll GET /customer?includeAssign=true and
 * record a row only when a customer's assignee changes. Reassignment counts
 * are derived from consecutive rows per customer.
 */
export const assignmentSnapshots = pgTable(
  "assignment_snapshots",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    customerId: uuid("customer_id").notNull().references(() => customers.id),
    assigneeId: text("assignee_id"), // agent or team id, null = unassigned
    assigneeType: text("assignee_type"),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("assign_customer_observed_idx").on(t.customerId, t.observedAt)],
);

/**
 * Chat lifecycle from the undocumented webhook events.
 * zoko:chat:assigned -> kind "assigned", agent = new owner.
 * zoko:chat:closed   -> kind "closed", agent = owner at close, closedByType = agent | system | ...
 */
export const chatEvents = pgTable(
  "chat_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    rawEventId: bigint("raw_event_id", { mode: "number" }).notNull(),
    customerId: uuid("customer_id").notNull().references(() => customers.id),
    kind: text("kind").notNull(),
    agentId: text("agent_id"),
    closedByType: text("closed_by_type"),
    eventAt: timestamp("event_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex("chat_events_raw_event_uq").on(t.rawEventId),
    index("chat_events_customer_at_idx").on(t.customerId, t.eventAt),
  ],
);
