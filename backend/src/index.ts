import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { startAssignmentPoller, syncAgents } from "./zoko/sync.js";
import { scheduleSyncPosthog } from "./posthog/sync.js";
import { shutdownPosthog } from "./posthog/client.js";

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`backend listening on :${env.PORT}`);
  scheduleSyncPosthog(10_000); // backfill anything not yet in PostHog
  if (env.ZOKO_API_KEY) {
    syncAgents()
      .then((n) => console.log(`synced ${n} agents`))
      .catch((err) => console.error("agent sync failed", err));
    if (env.POLL_ZOKO) startAssignmentPoller();
    else console.log("POLL_ZOKO=false: assignment poller disabled on this instance");
  }
  else console.warn("ZOKO_API_KEY not set: assignment poller disabled");
});

// Render sends SIGTERM on every deploy: flush queued PostHog events before exiting.
process.on("SIGTERM", () => {
  server.close();
  shutdownPosthog().finally(() => process.exit(0));
});
