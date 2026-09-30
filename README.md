# Zoko Growth Engineer take-home

One monorepo for all three tasks.

- **Live dashboard:** https://zoko-growth-takehome.vercel.app
- **Backend API:** https://zoko-support-backend.onrender.com (health check at `/health`)

| Folder | What |
|---|---|
| `backend/` | Express 5 + TypeScript + Drizzle on Postgres. Webhook ingestion, metrics API, guarded send. Deploys to Render. |
| `frontend/` | Next.js + shadcn/ui dashboard. Deploys to Vercel. |
| `docs/` | Zoko integration notes and the decision log. |
| `posthog/` | Task 2 analytics. |
| `teardown/` | Task 3 product teardown. |

## Task 1: Support Intelligence Tool

The question it answers: *what is happening with my support team, and how do I improve it?*

### What it shows

| Brief asks for | Where |
|---|---|
| Total messages | Dashboard |
| Messages per customer | Dashboard table |
| Average and median first response time | Dashboard |
| Average and median resolution time | Dashboard |
| Per agent: FRT, resolution time, reassigned chats | Dashboard agent table |
| Conversation view: name, phone, assigned agent, messages, send | Conversations, then View messages |

The dashboard shows only what the brief asks for. Two rules apply behind the numbers:

- **The store's AI assistant is excluded** from response times, since it replies within seconds. Its messages still count in total messages and are labelled in the thread.
- **Conversations closed with no human reply** have no resolution time, so they do not distort it.

### How the metrics are defined

- **Conversation:** everything between two chat-closed events for a customer, if the customer wrote in it. A customer message after a close starts a new conversation.
- **First response time:** first customer message to the first human agent reply. Bot replies and the CSAT survey do not count.
- **Resolution time:** first customer message to the close, for conversations a human replied to.
- **Per agent:** FRT goes to the agent who replied first, resolution to the agent who owned the chat at close, and a reassignment to the agent the chat was taken from.
- **CSAT:** asked when the `zoko_csat_test_v0` template is sent. Received when the customer taps a rating button on it.

The full reasoning, and what each choice gives up, is in [docs/decisions.md](docs/decisions.md).

### Where the data comes from

| Data | Source |
|---|---|
| Messages, with time, direction and sending agent | Webhook: `message:user:in`, `message:store:out` |
| Delivery status | Webhook: `message:delivery:update` |
| Chat closed | Webhook: `zoko:chat:closed` |
| Chat assigned | Webhook: `zoko:chat:assigned`, plus a 5-minute poll as backup |
| Agents | API: `GET /agent/agents` |
| Customers, phones, current assignee | API: `GET /customer?includeAssign=true`, polled every ~5 minutes |
| Sending a message | API: `POST /message` |

**Data starts when the webhook went live.** Zoko's API has no endpoint for past messages, so earlier history cannot be loaded. The test conversations were created by messaging the store, replying as agents, reassigning and closing chats, and sending the CSAT template from the Zoko app.

Things found by testing against the real store, not in Zoko's docs:

- **Chat events exist.** `zoko:chat:closed` and `zoko:chat:assigned` are undocumented. They were found on webhooks already registered in the test store.
- **Replies name their agent.** Human replies carry `agentEmail`; the AI assistant's do not. That is how replies are credited and bots excluded.
- **Some reassignments send no event,** so the customer-list poll stays as a backup.
- **The customer list is rate-limited** to one request per 5 minutes, with at most 2,000 customers per page.
- **Query-string tokens get lost.** Zoko's webhook client drops them, so the webhook URL carries a secret path key instead.

### Guardrail

The backend refuses to send to any number not in `SEND_ALLOWLIST`, and an empty list sends nothing. The check sits directly before the Zoko API call in [backend/src/messages/guardrail.ts](backend/src/messages/guardrail.ts), so no UI bug or hand-made request can bypass it.

### Known limits

- **Shared store.** Other candidates use the same test store, so their chats appear too.
- **Conversations that began before the webhook went live** start at the first message received, so their times are understated.
- **A reassignment that happens and reverts within 5 minutes** without a webhook event is not seen.
- **The API has no authentication.** Fine for a test store, but a real deployment would put the dashboard behind a login.

## How data flows

```
WhatsApp customer ─▶ Zoko ─▶ POST /webhooks/zoko/<key> ─▶ raw_events (append-only)
                                                        └▶ customers, messages, chat_events
Zoko REST (poll)  ─▶ /customer?includeAssign=true ─▶ assignment_snapshots
Dashboard (Vercel) ─▶ /api/* (Render) ─▶ Postgres (Neon)
Send message ─▶ allowlist check ─▶ POST https://chat.zoko.io/v2/message
```

Every webhook call is stored raw before parsing, and answered with 200 straight away. Zoko retries up to five times, so duplicates are dropped by a unique key. A parsing bug can be fixed and replayed from the raw log, which matters because Zoko cannot resend history.

## Run locally

Needs Node 22+ and a Postgres URL (a free Neon database works).

```bash
# backend
cd backend
cp .env.example .env        # fill DATABASE_URL, ZOKO_API_KEY, SEND_ALLOWLIST; set POLL_ZOKO=false if Render is also running
npm install
npm run db:migrate
npm run dev                 # http://localhost:4000/health

# frontend, in a second terminal
cd frontend
cp .env.example .env.local
npm install
npm run dev                 # http://localhost:3000
```

Zoko cannot reach localhost, so webhooks go to the deployed backend. Point your local backend at the same database to see the data.

## Deploy

- **Backend:** Render, New Blueprint, pick this repo. `render.yaml` sets the root to `backend/`. Fill the secret env vars.
- **Frontend:** Vercel, import the repo, set the root directory to `frontend/`, and set `NEXT_PUBLIC_API_URL` to the Render URL. Add the Vercel URL to `CORS_ORIGINS` on Render.
- **Webhook:** register `https://<render-host>/webhooks/zoko/<key>` in Zoko, where `<key>` is the first 32 hex characters of sha256(`ZOKO_WEBHOOK_TOKEN`). `npm run webhook:key` in `backend/` prints it. Subscribe to `message:user:in`, `message:store:out`, `message:delivery:update`, `zoko:chat:assigned` and `zoko:chat:closed`.

## Key decisions

See [docs/decisions.md](docs/decisions.md). The Zoko API constraints that shaped them are in [docs/zoko-integration.md](docs/zoko-integration.md).
