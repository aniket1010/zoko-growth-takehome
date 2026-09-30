import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import { ZodError } from "zod";
import { env } from "./config/env.js";
import { webhookRouter } from "./webhook/webhook.routes.js";
import { conversationsRouter } from "./messages/conversations.routes.js";
import { metricsRouter } from "./metrics/metrics.routes.js";
import { syncAgents, syncAssignments } from "./zoko/sync.js";

export function createApp() {
  const app = express();

  // Keep the exact bytes in case Zoko ever signs payloads and we need to verify them.
  app.use(express.json({ limit: "1mb", verify: (req, _res, buf) => ((req as { rawBody?: Buffer }).rawBody = buf) }));

  // Zoko calls the webhook server-to-server, so CORS only matters for the dashboard.
  app.use("/webhooks", webhookRouter);
  app.use("/api", cors({ origin: env.CORS_ORIGINS }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/conversations", conversationsRouter);
  app.use("/api/metrics", metricsRouter);
  app.post("/api/sync", async (_req, res) => {
    const [agentCount, assignments] = await Promise.all([syncAgents(), syncAssignments()]);
    res.json({ agents: agentCount, ...assignments });
  });

  // Express 5 forwards rejected promises from async handlers to here.
  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof ZodError) {
      res.status(400).json({ error: "invalid request", issues: err.issues });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "internal error" });
  };
  app.use(onError);

  return app;
}
