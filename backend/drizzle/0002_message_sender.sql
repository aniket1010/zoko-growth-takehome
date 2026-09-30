ALTER TABLE "messages" ADD COLUMN "sender_type" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "agent_email" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "template_name" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "reply_to_template" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "postback" text;