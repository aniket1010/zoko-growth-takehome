CREATE TYPE "public"."direction" AS ENUM('FROM_CUSTOMER', 'FROM_STORE');--> statement-breakpoint
CREATE TYPE "public"."zoko_event" AS ENUM('message:user:in', 'message:store:out', 'message:delivery:update');--> statement-breakpoint
CREATE TABLE "agents" (
	"id" text PRIMARY KEY NOT NULL,
	"first_name" text,
	"last_name" text,
	"email" text,
	"role" text,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignment_snapshots" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"customer_id" uuid NOT NULL,
	"assignee_id" text,
	"assignee_type" text,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text,
	"phone" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"customer_id" uuid NOT NULL,
	"direction" "direction" NOT NULL,
	"type" text,
	"text" text,
	"sent_at" timestamp with time zone NOT NULL,
	"delivery_status" text,
	"agent_id" text
);
--> statement-breakpoint
CREATE TABLE "raw_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"dedupe_key" text NOT NULL,
	"event" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "assignment_snapshots" ADD CONSTRAINT "assignment_snapshots_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assign_customer_observed_idx" ON "assignment_snapshots" USING btree ("customer_id","observed_at");--> statement-breakpoint
CREATE INDEX "messages_customer_sent_idx" ON "messages" USING btree ("customer_id","sent_at");--> statement-breakpoint
CREATE UNIQUE INDEX "raw_events_dedupe_key_uq" ON "raw_events" USING btree ("dedupe_key");