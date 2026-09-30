import { Router } from "express";

export const metricsRouter = Router();

/**
 * Day 1 build, done together as a lesson. Definitions to settle first
 * (see docs/decisions.md): conversation boundary, what counts as a first
 * response, what counts as resolved, and what counts as a reassignment.
 *
 * Planned endpoints:
 *   GET /api/metrics/overview   total messages, messages per customer, FRT and resolution avg + median
 *   GET /api/metrics/agents     per agent FRT, resolution, reassigned chats
 */
metricsRouter.get("/overview", (_req, res) => {
  res.status(501).json({ error: "not implemented yet" });
});
metricsRouter.get("/agents", (_req, res) => {
  res.status(501).json({ error: "not implemented yet" });
});
