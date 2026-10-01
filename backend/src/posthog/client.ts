import { PostHog } from "posthog-node";
import { env } from "../config/env.js";

/** Null when POSTHOG_API_KEY is not set, so the app runs fine without analytics. */
export const posthog = env.POSTHOG_API_KEY
  ? new PostHog(env.POSTHOG_API_KEY, { host: env.POSTHOG_HOST, flushAt: 50, flushInterval: 5_000 })
  : null;

/** Flush queued events before the process exits (Render sends SIGTERM on deploys). */
export async function shutdownPosthog() {
  await posthog?.shutdown();
}
