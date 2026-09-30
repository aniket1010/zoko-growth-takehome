CREATE TABLE "chat_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"raw_event_id" bigint NOT NULL,
	"customer_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"agent_id" text,
	"closed_by_type" text,
	"event_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_events" ADD CONSTRAINT "chat_events_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_events_raw_event_uq" ON "chat_events" USING btree ("raw_event_id");--> statement-breakpoint
CREATE INDEX "chat_events_customer_at_idx" ON "chat_events" USING btree ("customer_id","event_at");