# Task 2: PostHog analytics

## What is tracked

The backend derives events from the database and sends them to PostHog. It only sends events PostHog has not received, so a sync can run any number of times. The code is in `backend/src/posthog/sync.ts`.

| Event | When | Notes |
|---|---|---|
| `conversation_started` | First customer message of a conversation | A CSAT rating never starts a conversation |
| `conversation_closed` | Zoko's `zoko:chat:closed` event | Carries `resolution_seconds`, `frt_seconds`, `closed_without_reply`, `reassigned` |
| `csat_asked` | The `zoko_csat_test_v0` template is sent | Grouped to the sending agent |
| `csat_received` | The customer taps a rating on that template | Carries `rating` (1–5) |
| `conversation_surveyed` | Funnel stage: the conversation is closed and a survey was sent | One per conversation, at the later of the close and the survey |
| `conversation_rated` | Funnel stage: the surveyed conversation got a rating | One per conversation, after the surveyed stage; carries `rating` |
| `message_received` | Every customer message | |
| `message_sent` | Every store message | `sender_type` is `agent` or `bot`; human replies are grouped to their agent |

- **Persons are conversations.** `distinct_id` is `<customer id>:<conversation start time>`, so funnels count conversations, as the brief asks.
- **Agents are groups.** Group type `agent`, keyed by Zoko agent id. Each group has `name`, `email`, `messages_sent` and `conversations_handled`, recomputed from the database on every sync.
- **History is backfilled.** Events keep their original timestamps, so data collected before PostHog was connected is included.
- **When it syncs:** a few seconds after each burst of webhook events, at server start, and on demand via `POST /webhooks/zoko/posthog-sync?token=<ZOKO_WEBHOOK_TOKEN>`.
- **Frontend:** `posthog-js` records pageviews, plus `dashboard_reply_sent` and `dashboard_reply_blocked` from the send box. No message text is sent.

## The insights

Live in PostHog (project 637550, US cloud):

- Dashboard: https://us.posthog.com/project/637550/dashboard/2157097
- Funnel: https://us.posthog.com/project/637550/insights/BSeJQ14G
- Messages per day: https://us.posthog.com/project/637550/insights/fQt94e4w
- Agents with >10 messages: https://us.posthog.com/project/637550/insights/VdGOEZF5


Created by `node posthog/setup-insights.mjs` (see the top of the file for the environment variables). It builds the "Support analytics" dashboard with three insights: **Support funnel** (steps Conversations, Closed, CSAT sent, CSAT received), **Messages per day** and **Agents with >10 messages**. Labels are kept short; the definitions live here.

1. **Funnel:** conversation started, then chat closed, then CSAT survey sent, then CSAT rating received. It counts how far each conversation got. Agents often send the survey just before closing, so steps 3 and 4 use the per-conversation stage events above rather than the raw survey and rating events. A strict funnel on the raw events dropped those conversations; an any-order funnel counted an open chat as "closed".
2. **Messages per day, using SQL (HogQL),** by day in IST:
   ```sql
   SELECT toDate(toTimeZone(timestamp, 'Asia/Kolkata')) AS `Day`,
          count() AS `Total`,
          countIf(event = 'message_received') AS `Customers`,
          countIf(event = 'message_sent') AS `Store`
   FROM events
   WHERE event IN ('message_received', 'message_sent')
     AND timestamp >= now() - INTERVAL 30 DAY
   GROUP BY `Day`
   ORDER BY `Day`
   ```
3. **Agents with more than 10 messages sent, without SQL:** a trends insight on `message_sent`, counting unique `agent` groups per day, filtered to groups whose `messages_sent` property is greater than 10.

## Definitions used

- **Messages sent (agent):** store messages sent by a human agent, from Zoko's app or through the API. The AI assistant's messages are not counted.
- **Conversations handled (agent):** conversations the agent replied to first, or closed after a human reply.

## Cost

Everything fits in PostHog's free tier of 1M events a month. Group analytics is sold as a paid add-on, but the agent group, its properties and the group insight all work in this project without enabling it, so nothing is billed.
