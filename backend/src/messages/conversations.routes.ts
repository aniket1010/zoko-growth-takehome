import { Router } from "express";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, sql } from "../db/client.js";
import { customers, messages } from "../db/schema.js";
import { zokoApi } from "../zoko/client.js";
import { assertRecipientAllowed, RecipientNotAllowedError } from "./guardrail.js";

export const conversationsRouter = Router();

/** One row per customer with current assignee and message counts. */
conversationsRouter.get("/", async (_req, res) => {
  const rows = await sql`
    select c.id, c.name, c.phone, c.last_seen_at,
           a.assignee_id,
           trim(coalesce(ag.first_name,'') || ' ' || coalesce(ag.last_name,'')) as assignee_name,
           count(m.id)::int as message_count,
           count(m.id) filter (where m.direction = 'FROM_CUSTOMER')::int as inbound_count
    from customers c
    left join lateral (
      select assignee_id from assignment_snapshots s
      where s.customer_id = c.id order by observed_at desc limit 1
    ) a on true
    left join agents ag on ag.id = a.assignee_id
    left join messages m on m.customer_id = c.id
    group by c.id, a.assignee_id, ag.first_name, ag.last_name
    order by c.last_seen_at desc`;
  res.json(rows);
});

conversationsRouter.get("/:customerId/messages", async (req, res) => {
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.customerId, req.params.customerId))
    .orderBy(asc(messages.sentAt));
  res.json(rows);
});

const SendBody = z.object({ text: z.string().min(1).max(4096) });

conversationsRouter.post("/:customerId/messages", async (req, res) => {
  const { text } = SendBody.parse(req.body);
  const [customer] = await db.select().from(customers).where(eq(customers.id, req.params.customerId));
  if (!customer) {
    res.status(404).json({ error: "customer not found" });
    return;
  }
  try {
    const recipient = assertRecipientAllowed(customer.phone);
    const result = await zokoApi.sendText(recipient, text);
    // The message row itself arrives via the message:store:out webhook.
    res.status(202).json(result);
  } catch (err) {
    if (err instanceof RecipientNotAllowedError) {
      res.status(403).json({ error: err.message });
      return;
    }
    throw err;
  }
});
