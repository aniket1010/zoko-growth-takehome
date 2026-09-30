import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { startAssignmentPoller, syncAgents } from "./zoko/sync.js";

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`backend listening on :${env.PORT}`);
  if (env.ZOKO_API_KEY) {
    syncAgents()
      .then((n) => console.log(`synced ${n} agents`))
      .catch((err) => console.error("agent sync failed", err));
    if (env.POLL_ZOKO) startAssignmentPoller();
    else console.log("POLL_ZOKO=false: assignment poller disabled on this instance");
  }
  else console.warn("ZOKO_API_KEY not set: assignment poller disabled");
});
