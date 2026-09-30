import {
  pgTable, pgEnum, text, timestamp, jsonb, uuid, bigserial, index, uniqueIndex,
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
    // The outgoing webhook payload has no agent field. We attribute a store
    // message to whoever was assigned at the time (see assignment_snapshots).
    agentId: text("agent_id"),
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
