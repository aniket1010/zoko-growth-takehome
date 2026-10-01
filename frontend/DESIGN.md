# Frontend design

The interface is a quiet support workspace: generous spacing, a clear type hierarchy, neutral surfaces, and orange used sparingly for the Zoko brand and meaningful actions. Use the existing Base UI / shadcn primitives and Lucide icons.

## Visual system

- The supplied `public/assets/zoko-logo.svg` is used in both the desktop sidebar and mobile header. Its original proportions are preserved; dark mode inverts the monochrome artwork.
- Inter is the interface font. Page titles are 28-32px, section headings 15px, body text 13-14px, and secondary metadata 12px. KPI values are 32px with tabular numerals.
- The browser tab icon is the Zoko chat-bubble mark (cropped from the same logo) on a Zoko-orange rounded square: `src/app/icon.svg`, a 32px `icon.png` fallback and a 180px `apple-icon.png`. There is no `favicon.ico`.
- Light mode uses three surface steps so boxes never blur together: a warm grey canvas (`--background #ecebe7`), a lighter sidebar (`--sidebar #f5f4f1`) and off-white panels (`--card #fafaf8`). Pure white is not used for surfaces; only the customer chat bubble (`#fdfdfc`) comes close. Panels have 11px corners. Dark mode uses separately defined surface and text tokens, with panels (`#1d1d21`) one step above the canvas (`#121214`).
- Text: `--foreground #1f2222`; `--muted-foreground #575960` keeps at least 5.5:1 on every light surface it sits on (canvas, panel, sidebar, active nav row, muted chips, row hover, all three chat bubbles). Status and brand text (`--good #17683f`, `--warning #8a5100`, `--bad #b42525`, `--brand-ink #b03e18`) pass AA 4.5:1 on both the panel and their own soft tint.
- Lines: `--border #d9d7d0` is for decorative panel edges and dividers (the shadow carries the separation). Form fields use `--input #8a8881`, which is at least 3:1 against the panel, so the search box and reply box outlines read as controls.
- Light chat bubbles: customer `#fdfdfc` with the default border, agent `--bubble-agent #fce8de` with `--brand-line #f0cbbb`, AI assistant `--bubble-bot #e6eaef` with `--bot-ink #475a70`. The thread sits on a recessed canvas (`bg-background/60` inside the panel).
- Zoko orange (`#ff6937`) is reserved for accents and chart marks. Primary button fills use the darker brand ink (`#b03e18` light, `#bf441c` dark) for readable white labels (5.9:1 and 5.2:1). Status colors always accompany text or an icon.
- Customer, assistant, and agent message series use green, slate, and orange, with explicit labels and counts. Chat bubbles use near-white, slate, and warm orange tints.
- All colors are defined by role in `src/app/globals.css`; avoid adding raw colors inside components.

## Elevation

- Every box that sits on the page canvas (panels, KPI tiles, the attention strip, error and not-found boxes, the sidebar workspace card) uses `shadow-panel` together with its thin `border`. Buttons and fields placed directly on the canvas (Refresh data, conversation search) use the lighter `shadow-control`. Nothing else gets a shadow; do not add ad-hoc `shadow-*` values, heavy drop shadows, gradients or coloured borders.
- The values live in `globals.css` as `--elevation-panel` / `--elevation-control` per theme and are exposed to Tailwind as `--shadow-panel` / `--shadow-control`:
  - Light panel: `0 1px 2px 0 rgb(41 37 32 / 0.06), 0 3px 8px -2px rgb(41 37 32 / 0.08)`; control: `0 1px 2px 0 rgb(41 37 32 / 0.07)` (a warm near-black, so the shadow matches the canvas instead of looking blue-grey).
  - Dark panel: `0 1px 2px 0 rgb(0 0 0 / 0.45), 0 3px 10px -2px rgb(0 0 0 / 0.4), inset 0 1px 0 0 rgb(255 255 255 / 0.035)`; control: `0 1px 2px 0 rgb(0 0 0 / 0.4)`. Shadows barely show on near-black, so the lifted panel colour and a faint top highlight do most of the work.

## Layout and interaction

- Desktop navigation is 232-248px wide. Mobile uses a compact logo header and two navigation tabs. Both identify the current route.
- Pages have 20-48px gutters and 28-32px between sections. Panels use 20-24px padding. Avoid decorative gradients, colored KPI borders, flashing status indicators, and unnecessary nested cards.
- The dashboard shows only what the brief asks for: total messages, average and median first response and resolution time, a per-agent table (the same four times plus reassigned chats), and messages per customer.
- Conversation threads have generous space between messages, clear author labels, and a separate reply composer. The composer preserves a draft after errors, prevents duplicate submissions, and supports Ctrl/Cmd+Enter.
- Keep customer messages and template content readable with long-word wrapping.
- Keyboard focus is visible, a skip link leads to the main content, inputs have labels, and reduced-motion preferences disable animation. Theme switching retains the user's preference.
- Empty, loading, unavailable, and not-found states follow the same spacing and typography. Error details are expandable instead of dominating the page.

