# Zoko integration: what we use and why

Source of truth: the OpenAPI schema behind https://docs.zoko.io/api-reference (read 30 Sep 2026).
Base URL `https://chat.zoko.io/v2`. Every call sends the header `apikey: <key>`.

## Webhook

Zoko supports exactly three webhook events. The `events` enum on `POST /webhook` allows nothing else.

| Event | Fires when | Key fields | We use it for |
|---|---|---|---|
| `message:user:in` | Customer sends a message | `id`, `customer.id`, `customer.name`, `platformSenderId` (phone), `platformTimestamp`, `direction=FROM_CUSTOMER`, `type`, `text` | Inbound side of every metric |
| `message:store:out` | Store sends a message (agent, bot or API) | Same shape, `direction=FROM_STORE` | Responses, FRT, agent activity |
| `message:delivery:update` | Status of an outgoing message changes | `id` (the message), `deliveryStatus`, `platformTimestamp` | Delivered/read status |

Delivery rules (https://docs.zoko.io/webhooks/key-considerations):
- Must answer HTTP 200 within 5 seconds, or it counts as a failure.
- Retries up to 5 times with exponential backoff, so duplicates are normal.
- Disabled after 6 consecutive failures, with an email to the account.

Registration: `POST /webhook` with `{ url, events, challengeToken }`, or in the Zoko web app.
We register `https://<render-host>/webhooks/zoko?token=<ZOKO_WEBHOOK_TOKEN>` for all three events.

## REST endpoints we call

| Endpoint | Why |
|---|---|
| `GET /agent/agents` | Agent names and ids for the per-agent view |
| `GET /customer?channel=whatsapp&page&pageSize&includeAssign=true` | Customer list with current assignee. Polled to detect reassignments. `channel` is required. **Rate limit: 1 request per 300 seconds**, and a rejected request still counts. |
| `GET /customer/{id}` | Customer detail for the conversation view |
| `POST /message` | Send a message. Text only inside the 24h WhatsApp window, template outside it |
| `GET /account/templates` | Find an approved template for sends outside the 24h window |
| `GET /message/{id}` | Fetch one message, useful to debug a webhook we did not get |
| `GET /message/{id}/history` | Delivery history of one sent message |
| `POST /webhook`, `GET /webhook` | Register and verify our webhook |
| `POST /customer/{id}/assign` | Only to generate test reassignments in the test store |

## Gaps that shape the design

1. **No backfill.** There is no endpoint that lists a customer's messages. Metrics start when the webhook goes live. The raw event log is our only history, so it is append-only and replayable.
2. **No agent on messages.** `message:store:out` does not say which agent sent it. We attribute a store message to the customer's assignee at that moment.
3. **No assignment events.** Reassignments are inferred by polling `GET /customer?includeAssign=true` and diffing. The endpoint allows one request per 5 minutes, so each poll fetches the whole store in one page (`pageSize=5000`). A change that happens and reverts within 5 minutes is invisible.
4. **No close or CSAT events.** "Closed" and "CSAT asked/received" must be inferred or come from Zoko. Open question for the Zoko team.
5. **No signature on webhooks.** Not documented, so we protect the endpoint with a secret token in the URL.

## Observed in the test store (30 Sep 2026)

- `GET /agent/agents` returns a plain array of 33 agents, no paging. `lastName` can be `null` or empty, and some `firstName` values are blank or an email address.
- `GET /customer` with `pageSize=2000` returned all 1,343 customers in one response. 12 are assigned, none to a team. Assignment shape is `{ id, name, team, email? }`. 1,247 customers have never sent a message; 85 messaged in 2026.
- Sorting by `lastIncomingMessageAt desc` puts customers with no messages first, so it is not useful for polling.
- The store is shared with Zoko staff and other candidates, so the webhook will carry their activity too.
