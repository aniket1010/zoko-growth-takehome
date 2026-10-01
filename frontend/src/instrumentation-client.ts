import posthog from "posthog-js";

// Next.js runs this file once in the browser before the app starts.
// Frontend tracking for Task 2: pageviews on every client-side route change.
// The support events (conversations, messages, CSAT, agent groups) are sent by the
// backend, because only the backend sees Zoko's webhook data.
const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
if (key) {
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    capture_pageview: "history_change",
    // Dashboard viewers are anonymous; no person profiles needed for them.
    person_profiles: "identified_only",
  });
}
