# Decision log

One entry per non-obvious decision. This becomes the "key decisions" section of the README.
Format: what we decided, why, and what we gave up.

## 001 Store raw webhook payloads before parsing
Zoko cannot replay history, so a parsing bug would lose data forever. We insert the raw JSON, answer 200, then parse. Gave up: a little storage and one extra write per event.

## 002 Deduplicate on event + id + deliveryStatus
Zoko retries up to five times. A unique index on that key makes retries harmless. Delivery status is in the key because one message produces several delivery updates.

## 003 Guardrail in the backend send path
The allowlist check runs immediately before the Zoko API call and returns 403 otherwise. An empty allowlist sends nothing. The UI cannot bypass it.

## 004 Infer assignment history by polling, within the rate limit
No assignment webhook exists. We poll the customer list and store a row only on change. Zoko allows one customer-list request per 300 seconds, so the poller fetches every customer in a single large page every 310 seconds. Gave up: a reassignment that happens and reverts within 5 minutes is invisible, and reassignment timestamps are only accurate to about 5 minutes.

## 005 Delivery updates can arrive before their message
Each event is parsed after its 200 is sent, so a status update can be processed before its message row exists. Found in a local test on 30 Sep 2026. An early update now stays unprocessed and is applied the moment its message is stored. Status only moves forward (accepted, sent, delivered, read), with failed overriding, so a late "delivered" cannot overwrite "read".

## 006 Neon for Postgres
Free, persistent, serverless Postgres on a personal account. The app uses the pooled connection string; migrations use the direct one. The Neon project also has Neon Auth enabled, which this app does not use.

## 007 Metric definitions
- **Conversation:** everything between two `zoko:chat:closed` events for a customer, counted only if the customer sent a message in it. A message after a close starts a new conversation.
- **First response time:** first customer message to the first human agent reply. A store message is human if it carries `agentEmail` (sent from Zoko's app) or `appType: direct_api` (sent through the API, including this dashboard, credited to the chat's assignee). Everything else is the store's AI assistant and is excluded. The CSAT survey is not a response.
- **Resolution time:** first customer message to the close event.
- **Per agent:** FRT is credited to the agent who replied, resolution to the agent who owned the chat at close, and a reassignment to the agent the chat was taken from.
- **Reassignment history** combines `zoko:chat:assigned` events with the 5-minute customer-list poll. On 30 Sep 2026 the poll caught a reassignment that produced no webhook event, so the poll stays as a backup.
- **Closed without reply:** a conversation closed with no human reply has no resolution time and is counted separately.
- **CSAT:** asked = the `zoko_csat_test_v0` template was sent; received = a button reply whose `context.template_id` is that template; the rating is `context.postback`.
- **Scope:** all store activity since the webhook went live, including other candidates' test chats.
Gave up: conversations that began before the webhook went live start at the first message we saw, so their times are understated.
