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

## Open, to settle before building metrics
- Conversation boundary: Zoko close event if one exists, otherwise an inactivity gap.
- First response: does a bot or template reply count?
- Resolution: what ends a conversation, and does a reopen start a new one?
- Reassignment: does unassigned to agent count?
