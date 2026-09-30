# Task 2: PostHog

Plan, filled in as we build.

- **Events** captured server-side from the webhook processor: `conversation_started`, `conversation_closed`, `csat_asked`, `csat_received`, `message_sent`.
- **Groups**: group type `agent`, key = Zoko agent id. Properties `messages_sent` and `conversations_handled` set with `groupIdentify`.
- **Funnel**: conversation_started, conversation_closed, csat_asked, csat_received.
- **Day-wise messages**: SQL insight in PostHog.
- **Agents with more than 10 messages sent**: trends insight on groups, no SQL.

Open question: group analytics is a paid add-on. Approval requested from Zoko before enabling billing.
