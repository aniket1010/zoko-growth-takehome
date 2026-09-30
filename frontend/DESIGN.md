# Frontend design

The interface is a quiet support workspace: generous spacing, a clear type hierarchy, neutral surfaces, and orange used sparingly for the Zoko brand and meaningful actions. Use the existing Base UI / shadcn primitives and Lucide icons.

## Visual system

- The supplied `public/assets/zoko-logo.svg` is used in both the desktop sidebar and mobile header. Its original proportions are preserved; dark mode inverts the monochrome artwork.
- Inter is the interface font. Page titles are 28-32px, section headings 15px, body text 13-14px, and secondary metadata 12px. KPI values are 32px with tabular numerals.
- The light canvas is off-white (`#fafaf9`), with white navigation and panels, subtle borders, and 11px panel corners. Dark mode uses separately defined surface and text tokens.
- Zoko orange (`#ff6937`) is reserved for accents and chart marks. Primary button fills use the darker brand ink (`#bf441c`) for readable white labels. Status colors always accompany text or an icon.
- Customer, assistant, and agent message series use green, slate, and orange, with explicit labels and counts. Chat bubbles use white, slate, and warm orange tints.
- All colors are defined by role in `src/app/globals.css`; avoid adding raw colors inside components.

## Layout and interaction

- Desktop navigation is 232-248px wide. Mobile uses a compact logo header and two navigation tabs. Both identify the current route.
- Pages have 20-48px gutters and 28-32px between sections. Panels use 20-24px padding. Avoid decorative gradients, colored KPI borders, flashing status indicators, and unnecessary nested cards.
- The dashboard shows only what the brief asks for: total messages, average and median first response and resolution time, a per-agent table (the same four times plus reassigned chats), and messages per customer.
- Conversation threads have generous space between messages, clear author labels, and a separate reply composer. The composer preserves a draft after errors, prevents duplicate submissions, and supports Ctrl/Cmd+Enter.
- Keep customer messages and template content readable with long-word wrapping.
- Keyboard focus is visible, a skip link leads to the main content, inputs have labels, and reduced-motion preferences disable animation. Theme switching retains the user's preference.
- Empty, loading, unavailable, and not-found states follow the same spacing and typography. Error details are expandable instead of dominating the page.

