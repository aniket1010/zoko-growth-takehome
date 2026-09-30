/**
 * Targets behind every good / warning / bad verdict on the dashboard.
 * These are assumptions (see DESIGN.md), not numbers the brief or Zoko gave us.
 * Change them here and every tile, row and badge follows.
 */

export type Status = "good" | "warning" | "bad" | "none";

const MIN = 60;

export const TARGETS = {
  /** First human reply. WhatsApp shoppers expect chat speed: 5 min is good, past 15 min is bad. */
  frt: { good: 5 * MIN, warning: 15 * MIN },
  /** First customer message to close. Good within an hour, bad past half a working day. */
  resolution: { good: 60 * MIN, warning: 4 * 60 * MIN },
  /** CSAT on a 1-5 scale. 4.0 and up is good, below 3.0 is bad. */
  csat: { good: 4, warning: 3 },
  /** Share of closed chats that never got a human reply. Any is a warning, over 10% is bad. */
  closedWithoutReply: { good: 0, warning: 0.1 },
  /** Share of conversations handed from one agent to another. */
  reassigned: { good: 0.1, warning: 0.25 },
  /** Fewer data points than this and a median is flagged as a small sample. */
  smallSample: 5,
} as const;

/** Lower is better: at or under `good` is good, at or under `warning` is a warning, above is bad. */
export function lowerIsBetter(value: number | null | undefined, t: { good: number; warning: number }): Status {
  if (value == null || Number.isNaN(value)) return "none";
  if (value <= t.good) return "good";
  if (value <= t.warning) return "warning";
  return "bad";
}

/** Higher is better: at or over `good` is good, at or over `warning` is a warning, below is bad. */
export function higherIsBetter(value: number | null | undefined, t: { good: number; warning: number }): Status {
  if (value == null || Number.isNaN(value)) return "none";
  if (value >= t.good) return "good";
  if (value >= t.warning) return "warning";
  return "bad";
}

export const frtStatus = (s: number | null | undefined) => lowerIsBetter(s, TARGETS.frt);
export const resolutionStatus = (s: number | null | undefined) => lowerIsBetter(s, TARGETS.resolution);
export const csatStatus = (v: number | null | undefined) => higherIsBetter(v, TARGETS.csat);

/** How long a customer has waited with no human reply, judged against the FRT target. */
export const waitStatus = (s: number) => lowerIsBetter(s, TARGETS.frt);

export function ratioStatus(part: number, whole: number, t: { good: number; warning: number }): Status {
  return whole ? lowerIsBetter(part / whole, t) : "none";
}
