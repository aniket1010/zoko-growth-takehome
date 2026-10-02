# Task 3: Zoko product teardown

Five improvements I'd make. They come from building Tasks 1 and 2 against the Zoko test store as an integrator: reading the API docs, registering webhooks, and watching real payloads. They run from a two-minute copy fix to a net-new feature. Impact estimates are expectations, not measured numbers. Each one says how I'd measure it.

| # | Improvement | Size | Who it helps |
|---|---|---|---|
| 1 | Fix the placeholder copy in the Add webhook form | Tiny | Anyone setting up a webhook |
| 2 | Document every webhook event and payload field | Small | Developers and partners |
| 3 | Sign webhook deliveries | Medium | Every integration, and Zoko's security posture |
| 4 | Add a message history API and incremental sync | Medium | Analytics, CRM and migration use cases |
| 5 | Built-in CSAT on close, plus support analytics that exclude the AI assistant | Large, net-new | Support leads at every brand on Zoko |

---

## 1. Fix the placeholder copy in the Add webhook form

**What.** In Settings, Webhooks & API, then Add webhook, the helper text is left over from other screens:

- **Details** says "Name your quick reply and select keywords and availability." That's quick-reply copy, not webhook copy.
- **Events** says "This is a simple paragraph to explain this section."

Replace them with webhook-specific guidance. For example: "Give this webhook a name you'll recognise. We'll send a POST request to this URL." For events: "Choose which events to send. Your endpoint must reply with HTTP 200 within 5 seconds."

**Why.** This screen is where a developer forms their first impression of Zoko's platform. Placeholder text makes the API feel unfinished, and it hides the two rules that matter most: the 5-second reply window, and the endpoint being disabled after 6 failures. I only learned those from the docs.

**Impact.** A small but immediate gain in trust from developers and agencies setting up integrations. Fewer misconfigured endpoints that silently get disabled. Measure it through support tickets tagged "webhook not receiving", and the share of webhooks disabled within 7 days of creation.

## 2. Document every webhook event and payload field

**What.** The public docs, and the `events` enum on `POST /webhook`, list only three events: message in, message out and delivery update. The test store's webhooks already use about twenty more, including:

- `zoko:chat:assigned`
- `zoko:chat:closed`
- `customer:tag:added`
- `customer:optout:clicked`
- `call:*`
- `message:template:*`

Payloads also carry undocumented fields that integrators need:

- `agentEmail` and `appType`, which separate a human agent from the AI assistant and from API sends
- `context.template_id` and `context.postback` on button replies, such as the CSAT rating
- `closedBy.type` on close events

Publish the full event list, with an example payload and field reference for each. Add them to the API's `events` enum, and put a changelog entry on the docs site.

**Why.** I found the close and assignment events only by listing other people's webhooks in the shared store. Without them, resolution time and reassignment counts, two core support metrics, look impossible to build. I nearly built them on 5-minute polling. The `appType` and `agentEmail` fields are the only way to keep AI replies out of response times, and nothing documents them.

**Impact.** Integrations built in hours instead of days, with more accurate metrics. Fewer "how do I know when a chat is closed" questions to support and solutions engineers. This makes Zoko easier to build on, which matters for partners and agencies. Measure it through docs page views for the new events, the number of webhooks subscribing to chat events, and API support tickets.

## 3. Sign webhook deliveries

**What.** Sign every webhook delivery with an HMAC of the raw body, using a per-webhook secret, for example in an `X-Zoko-Signature` header with a timestamp. Document a five-line verification snippet. Also fix the delivery client so query strings in the registered URL arrive intact.

**Why.** Today a webhook endpoint can't verify that a request really came from Zoko. Anyone who learns the URL can post fake messages into a brand's systems. The usual workaround is a secret in the query string, and that broke too. Zoko's delivery client (`unirest-java`) dropped our base64 token value, so every delivery got a 401 until I moved the secret into the URL path. The `challengeToken` field exists, but nothing explains what it's for or how it's checked. Stripe, Shopify and Meta all sign webhooks, so integrators expect it.

**Impact.**
- **Security:** brands handling orders and payment links over WhatsApp can trust incoming events.
- **Selling:** it removes a common objection in security reviews for larger D2C customers.
- **Reliability:** fixing the query string removes a confusing failure that disables webhooks after 6 attempts.

Measure it through the share of deliveries to endpoints that verify signatures, and fewer auto-disabled webhooks.

## 4. Add a message history API and incremental sync

**What.**
- Add `GET /customer/{id}/messages`, paginated with a cursor, plus a bulk export for a date range.
- Add `updated_since` to `GET /customer`, so integrations can fetch only what changed.

**Why.** The API can send, fetch one message by id, and delete all of a customer's messages, but it can't list them. So any analytics or CRM sync only sees data from the moment its webhook goes live, and a missed webhook means data lost for good. Customer sync is also expensive:
- `GET /customer` allows 1 request per 300 seconds, with at most 2,000 customers per page.
- A store with 50,000 customers needs 25 pages, so one full refresh takes about 2 hours.
- Integrations end up polling the whole list just to detect assignment changes.

**Impact.**
- **Partners:** BI tools, helpdesks and data warehouses can backfill, and recover from outages without losing data.
- **Zoko's servers:** less load, since incremental sync replaces full-list polling.
- **Sales:** an easier answer to "can we take our data with us", which comes up in larger deals.

Measure it through API adoption, the volume of full-list `GET /customer` calls, and integration churn.

## 5. Built-in CSAT on close, plus support analytics that exclude the AI assistant

**What.** Two connected features in the inbox:

1. **Automatic CSAT.** A setting sends the brand's chosen CSAT template when an agent closes a chat, or when auto-close runs. A rating posts a `csat:received` event and stores the score on the conversation.
2. **A support analytics view** for leads. It shows first response time and resolution time, average and median, overall and per agent, for human agents only. It also has:
   - a "waiting for a first human reply" queue
   - closed-without-reply and reassignment counts
   - CSAT by agent

**Why.**
- **CSAT is manual today.** In the test store, agents send a template named "zoko_csat_test_v0" by hand. They usually send it before closing, although the text says "your conversation has been closed".
- **The AI assistant distorts response times.** Each new chat gets an assistant reply within about 8 seconds. Counted naively, response times look excellent while the customer still waits hours for a person. In my test data, the median human first response was a few minutes, but one customer waited 3 hours 48 minutes.
- **Support leads get no direct answer.** "Who is waiting right now?" and "which agent needs help?" can't be answered without exporting data. Building this on the API took webhooks, polling and custom rules. Most Zoko customers won't do that.

**Impact.**
- **Faster replies:** a visible waiting queue and per-agent times give leads a reason and a way to act.
- **More CSAT data:** automatic surveys mean every closed chat gets one, not just the ones an agent remembers.
- **More ROI evidence:** better support metrics feed the "1K% Return" story Zoko already shows in its Analytics menu.
- **Retention and upsell:** it's a reason for brands to stay with Zoko as their support tool.

Measure it through the share of closed chats with a CSAT rating, the human first response time trend for stores that enable it, and adoption of the analytics page.
