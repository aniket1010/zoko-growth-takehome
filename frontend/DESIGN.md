# Design notes

The dashboard should look like a screen inside Zoko's own web app, and a support lead should get the state of the team in about five seconds without scrolling.

## Where the tokens came from

Three sources, checked against each other:

1. **Zoko web app screenshot** (Settings > Webhooks & API). I sampled pixels for the canvas grey, the input and panel whites, the border grey, and the orange on the "Add event" icon and the active page button.
2. **zoko.io stylesheet** (`zoko-staging.shared.*.min.css`): the CSS variables `--gray-1`, `--gray-2`, `--accent`, `--secondary`, `--success`, `--warning`, `--error`; the font-family counts; the border-radius counts.
3. **The take-home brief PDF**: its only accent fill is `#ff6937`.

All tokens live in `src/app/globals.css` as CSS variables. Components use them by role (`bg-card`, `text-good`, `bg-brand-soft`) and never use raw hex.

### Light mode

| Token | Value | Source / reason |
| --- | --- | --- |
| `--background` (canvas) | `#f5f5f5` | Sampled from the Zoko app background |
| `--card` (panel) | `#ffffff` | Zoko panels and inputs |
| `--sidebar` | `#ededed` | One step darker than the canvas, like Zoko's nav column |
| `--sidebar-accent` (active nav row) | `#e0e0e0` | Zoko's selected "Webhooks" row is a grey pill, not an orange one |
| `--border` | `#e6e6e6` | Sampled panel divider `#e8e8e8`; zoko.io `--gray-3` is `#ecebea` |
| `--foreground` | `#222525` | zoko.io `--gray-1` |
| `--muted-foreground` | `#62636b` | zoko.io `--gray-2` (6.0:1 on white) |
| `--brand` / `--primary` | `#ff6937` | Zoko orange. Exact match in the app screenshot ("Add event"), the brief PDF, and 43 uses on zoko.io |
| `--brand-ink` | `#bf441c` | zoko.io `--accent` `#cc4a1f`, one step darker so orange **text** passes 4.5:1 on white and on the orange tint |
| `--brand-line` | `#f7dfd7` | zoko.io `--secondary`; also the colour of Zoko's disabled "Create" button |
| `--brand-soft` | `#fff1eb` | Orange tint for store bubbles, avatars and the open-state chip |
| `--good` / `--good-soft` | `#1a7547` / `#e7f5ed` | Zoko `--success` `#57a773`, darkened to pass AA as text |
| `--warning` / `--warning-soft` | `#a35f00` / `#fff4d6` | Amber, from zoko.io `#f5b400`. Zoko's own `--warning` `#f19953` is too close to the brand orange to mean anything |
| `--bad` / `--bad-soft` | `#c42b2b` / `#fdeceb` | A clear red. Zoko's `--error` `#ed6a5e` sits too close to the brand orange |
| `--bubble-bot` / `--bot-ink` | `#f1eefc` / `#5a45b8` | Violet, so AI assistant replies never look like a human agent's |
| `--tick-seen` | `#2f80ed` | Blue "seen" double tick, as in WhatsApp |
| `--radius` | `0.375rem` (6px) | zoko.io's most common radii are 5px and 6px; panels use `radius-xl` (about 8px) |
| Font | Inter | The most used family on zoko.io (62 rules), and what the app renders in. Geist Mono is used only for phone numbers |

### Dark mode

Dark mode uses its own steps, not an automatic flip. The canvas is `#121214`, panels are `#1b1b1e` and borders are `#2a2a2f`. The brand stays `#ff6937` and `--brand-ink` lightens to `#ff8a60`. Status colours lighten (`#4cc38a`, `#f5b400`, `#f07373`) on dark tints. Every text/background pair is at least 5.6:1. `next-themes` follows the OS setting by default, and the toggle at the bottom of the sidebar overrides it.

### Chart series

Only two charts use categorical colour, the "Who is talking" bar and the message counts on the conversation page. Their three series are **customer `#068466`** (zoko.io `--primary-1` green), **AI assistant `#6e56cf`** and **agent `#ff6937`**, stacked in that order. In dark mode they are `#1a9c7c`, `#8471e0` and `#ec5f2e`. Both sets passed the dataviz palette validator: lightness band, chroma floor, adjacent CVD ΔE ≥ 15 and normal-vision ΔE ≥ 23. The one warning is that `#ff6937` is 2.87:1 against white. That is allowed only when every segment is also labelled, and each one has a legend entry with its count and percentage.

The funnel and the inline bars have a single series, so they use only the brand orange.

## Targets (assumptions)

The brief does not define targets, so I picked these. They all live in `src/lib/targets.ts`; change a number there and every tile, row and badge follows.

| Metric | Good | Warning | Bad | Why |
| --- | --- | --- | --- | --- |
| First response time (median, humans only) | ≤ 5 min | ≤ 15 min | > 15 min | WhatsApp shoppers expect chat speed |
| Resolution time (median) | ≤ 1 h | ≤ 4 h | > 4 h | Bad means more than half a working day |
| CSAT (1–5) | ≥ 4.0 | ≥ 3.0 | < 3.0 | Usual 80% satisfaction bar |
| Closed without a human reply | 0 | ≤ 10% of closed | > 10% | Every closed chat should have had an answer |
| Reassigned conversations | ≤ 10% | ≤ 25% | > 25% | Handoffs slow customers down |
| Waiting customer (attention queue) | ≤ 5 min | ≤ 15 min | > 15 min | Same bar as FRT |
| Small sample | n < 5 | | | Shown as "small sample" or with a dotted count |

## Layout rules

- **App shell.** On desktop there is a 224px left sidebar with an uppercase section label and icon + label rows; the active row gets a grey pill and an orange icon. On phones it becomes a sticky top bar with the same two destinations as tabs.
- **Canvas and panels.** Content sits on the grey canvas in white panels with a 1px border and 8px corners. There are no drop shadows except on the selected filter tab.
- **Type.** Body text is 13px and headings 14px. Page titles are 18px, and the only large figures are the KPI values at 24px. Section labels and table headers are 11px uppercase with 0.04em tracking (the `label-caps` utility), like Zoko's "WEBHOOKS & API".
- **Reading order on the dashboard:**
  1. The page header gives one overall verdict pill ("Needs attention", "Worth a look" or "On track"), "N of 5 checks on target", and a red count of waiting customers.
  2. **Needs attention now** comes next, with a red border, a tinted header and a pulsing dot. Each row shows the wait time in large type and how far past target it is. When nobody is waiting, it shrinks to a one-line green strip.
  3. Four KPI tiles: FRT, resolution, CSAT, and closed without a reply. Each has a coloured top edge, a verdict pill (icon + words, never colour alone), the target, the average and the sample size.
  4. The conversation funnel (conversations → closed → CSAT asked → CSAT received, with the step conversion rates), next to the "Who is talking" split between customer, AI and agent messages.
  5. The agents table. Every median shows its sample count, and counts under 5 are dotted. Best and Worst tags appear only when two or more agents have data that differs.
  6. Messages per customer, with inline bars.
- **Conversation view.** This follows Zoko's chat screen. Customer bubbles are white on the left and store bubbles are orange-tinted on the right. AI assistant replies are violet with a dashed border and a bot icon. Assigned/closed events are centred pills, and there is a date separator for each IST day. Templates render as a card with the body, footer and reply buttons. CSAT answers show as stars. Delivery status shows as ticks. A side panel holds the status, the message split and the CSAT answers, and on phones it moves below the chat.
- **States.** A red alert explains that the backend may be waking up (Render free tier). Empty panels show a dashed box with one sentence saying what will fill them. There is a skeleton `loading.tsx` and a styled `not-found.tsx`.
- **Responsive.** There is no horizontal page scroll down to 375px. Only the agents table scrolls, inside its own panel. The conversation list is a grid that collapses to a two-line card on phones.
