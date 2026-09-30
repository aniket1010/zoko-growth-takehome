import { Router, type RequestHandler } from "express";
import { asc, isNull } from "drizzle-orm";
import { db } from "../db/client.js";
import { rawEvents } from "../db/schema.js";
import { env } from "../config/env.js";
import { dedupeKeyFor } from "./zoko-payload.js";
import { processRawEvent } from "./process-event.js";

export const webhookRouter = Router();

// Zoko does not document request signing, so we put a secret in the URL we register.
// Rejected requests are recorded (without secrets) so delivery problems can be debugged
// from the database instead of the hosting logs.
const requireToken: RequestHandler = async (req, res, next) => {
  if (env.ZOKO_WEBHOOK_TOKEN && req.query.token !== env.ZOKO_WEBHOOK_TOKEN) {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    const headers = Object.fromEntries(
      Object.entries(req.headers).filter(([k]) => !["authorization", "cookie"].includes(k)),
    );
    await db
      .insert(rawEvents)
      .values({
        dedupeKey: `rejected:${Date.now()}:${Math.random()}`,
        event: "debug:rejected",
        payload: {
          reason: token ? "token mismatch" : "token missing",
          tokenLength: token.length,
          expectedLength: env.ZOKO_WEBHOOK_TOKEN.length,
          path: req.path,
          queryKeys: Object.keys(req.query),
          headers,
          body: req.body ?? null,
        },
        processedAt: new Date(),
      })
      .catch(() => undefined);
    res.sendStatus(401);
    return;
  }
  next();
};

/**
 * Register this URL with Zoko as  https://<host>/webhooks/zoko?token=<ZOKO_WEBHOOK_TOKEN>
 * Zoko needs a 200 within 5 seconds or it retries (up to 5x), and disables the
 * webhook after 6 consecutive failures. So: store, acknowledge, then process.
 */
webhookRouter.post("/zoko", requireToken, async (req, res) => {
  const body = req.body ?? {};
  const [inserted] = await db
    .insert(rawEvents)
    .values({ dedupeKey: dedupeKeyFor(body, (req as { rawBody?: Buffer }).rawBody), event: String(body.event ?? "unknown"), payload: body })
    .onConflictDoNothing({ target: rawEvents.dedupeKey })
    .returning({ id: rawEvents.id });

  res.sendStatus(200); // acknowledge first; a duplicate is still a 200

  if (inserted) {
    processRawEvent(inserted.id).catch((err) => console.error("process failed", err));
  }
});

/** Re-run parsing for anything that failed or was never processed. */
webhookRouter.post("/zoko/replay", requireToken, async (_req, res) => {
  const pending = await db
    .select({ id: rawEvents.id })
    .from(rawEvents)
    .where(isNull(rawEvents.processedAt))
    .orderBy(asc(rawEvents.id));
  for (const { id } of pending) await processRawEvent(id);
  res.json({ replayed: pending.length });
});
