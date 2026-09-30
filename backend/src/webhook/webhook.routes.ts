import { createHash } from "node:crypto";
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
//
// Zoko's HTTP client did not pass our base64 token through the query string intact
// (it arrived empty, 30 Sep 2026). So the registered URL carries a path key instead:
// the first 32 hex chars of sha256(ZOKO_WEBHOOK_TOKEN). Hex survives any URL handling.
export const webhookPathKey = env.ZOKO_WEBHOOK_TOKEN
  ? createHash("sha256").update(env.ZOKO_WEBHOOK_TOKEN).digest("hex").slice(0, 32)
  : "";

const requireToken: RequestHandler = async (req, res, next) => {
  const queryToken = typeof req.query.token === "string" ? req.query.token : "";
  const pathKey = typeof req.params.key === "string" ? req.params.key : "";
  const authorised = !env.ZOKO_WEBHOOK_TOKEN || queryToken === env.ZOKO_WEBHOOK_TOKEN || pathKey === webhookPathKey;
  if (!authorised) {
    const token = queryToken;
    const headers = Object.fromEntries(
      Object.entries(req.headers).filter(([k]) => !["authorization", "cookie"].includes(k)),
    );
    await db
      .insert(rawEvents)
      .values({
        dedupeKey: `rejected:${Date.now()}:${Math.random()}`,
        event: "debug:rejected",
        payload: {
          reason: pathKey ? "path key mismatch" : token ? "token mismatch" : "token missing",
          // Shape of the raw URL with letters and digits masked, to see how it was mangled.
          urlShape: req.originalUrl.replace(/[A-Za-z0-9]/g, "x").slice(0, 200),
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

// Must be registered before "/zoko/:key", or "replay" is treated as a path key.
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

/**
 * Register this URL with Zoko as  https://<host>/webhooks/zoko?token=<ZOKO_WEBHOOK_TOKEN>
 * Zoko needs a 200 within 5 seconds or it retries (up to 5x), and disables the
 * webhook after 6 consecutive failures. So: store, acknowledge, then process.
 */
webhookRouter.post(["/zoko", "/zoko/:key"], requireToken, async (req, res) => {
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
