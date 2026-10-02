# Zoko Growth Engineer take-home

- **Live app:** https://zoko-growth-takehome.vercel.app
- **PostHog dashboard:** https://us.posthog.com/shared/s7ZnW1XWyOoCpwv1D3OeOBhrmRqMAg

Stack: Next.js and shadcn/ui on Vercel, Express and TypeScript on Render, Postgres on Neon.

## Task 1: Support Intelligence Tool

| The brief asks for | Where |
|---|---|
| Total messages | Dashboard |
| Messages per customer | Dashboard |
| Average and median first response time | Dashboard |
| Average and median resolution time | Dashboard |
| Per agent: FRT, resolution time, reassigned chats | Dashboard, agent table |
| Conversation view: name, phone, agent, messages, send | Conversations |
| Guardrail: only send to a test number | Backend allowlist, checked before every send |

Added on top: a list of customers waiting for a human reply, and two observations (slow replies, chats closed without a reply).

## Task 2: PostHog analytics

| The brief asks for | Where |
|---|---|
| PostHog tracking | Backend sends support events; frontend records page views |
| Funnel: conversations, closed, CSAT asked, CSAT received | Support funnel |
| Day-wise messages, using SQL | Messages per day |
| Each agent as a group, with messages sent and conversations handled | Group type `agent` |
| Agents with high message volume, without SQL | Agents with ≥5 messages a day |

## Task 3: Product improvements

**1. Send CSAT as soon as a chat closes**
- **What:** send the rating survey automatically when a chat is closed.
- **Why:** today agents send it by hand, so it gets forgotten or sent at the wrong time.
- **Impact:** every closed chat gets rated, giving a reliable CSAT score per agent.

**2. AI-powered insights and actions in Analytics**
- **What:** suggest the next action alongside the numbers. For example, abandoned checkout recovery already works, so offer a second follow-up to customers who didn't buy after the first.
- **Why:** brands see numbers, but not what to do next.
- **Impact:** more recovered sales for very little effort.

**3. Results for each ZOKO flows**
- **What:** show each flow as a funnel. For example: 1,000 entered, 80 engaged, 10 purchased, 1% conversion.
- **Why:** brands can't tell which flows actually make money.
- **Impact:** brands improve or turn off weak flows, and see Zoko's return clearly.

**4. Fix gaps in the API documentation**
- **What:** complete the unfinished API overview pages and fix the main code sample.
- **Why:**
  - The [Agent API](https://docs.zoko.io/messaging-api/agent-api) and [Customer API](https://docs.zoko.io/messaging-api/customer-api) pages say "Using Agent API you can" and "Using Customer API you can", then list nothing. Their text is copied from the Message API page, and they don't link to their endpoints.
  - The first ["Send a message"](https://docs.zoko.io/messaging-api/sending-a-message) example has invalid JSON and no API key, so copying it fails.
- **Impact:** faster integrations and fewer support questions.

## Run locally

Needs Node 22+ and a Postgres database.

```bash
# backend
cd backend
cp .env.example .env    # set DATABASE_URL, ZOKO_API_KEY and SEND_ALLOWLIST (your test number)
npm install
npm run db:migrate
npm run dev             # http://localhost:4000

# frontend, in a second terminal
cd frontend
cp .env.example .env.local
npm install
npm run dev             # http://localhost:3000
```

Zoko can't reach localhost, so webhooks go to the deployed backend. To see live data locally, point your backend at the same database.
