#!/usr/bin/env node
/**
 * Creates (or updates, matched by name) the Task 2 insights and a dashboard in PostHog.
 *
 *   POSTHOG_PERSONAL_API_KEY=phx_...  # PostHog > Settings > Personal API keys (scopes: insight:write, dashboard:write, project:read, group:read)
 *   POSTHOG_PROJECT_ID=12345          # PostHog > Settings > Project > Project ID
 *   POSTHOG_APP_HOST=https://us.posthog.com   # or https://eu.posthog.com
 *   node posthog/setup-insights.mjs
 *
 * Re-running is safe: insights with the same name are updated, not duplicated.
 */

const KEY = process.env.POSTHOG_PERSONAL_API_KEY;
const PROJECT = process.env.POSTHOG_PROJECT_ID;
const HOST = (process.env.POSTHOG_APP_HOST ?? "https://us.posthog.com").replace(/\/+$/, "");
if (!KEY || !PROJECT) {
  console.error("Set POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID (and POSTHOG_APP_HOST for EU).");
  process.exit(1);
}

async function api(path, init = {}) {
  const res = await fetch(`${HOST}/api/projects/${PROJECT}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${KEY}`, "content-type": "application/json", ...init.headers },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status}: ${body}`);
  return body ? JSON.parse(body) : {};
}

// The "agent" group type gets its index when the first agent group arrives from the backend.
const groupTypes = await api("/groups_types/");
const agentType = (Array.isArray(groupTypes) ? groupTypes : groupTypes.results ?? []).find((g) => g.group_type === "agent");
if (!agentType) {
  console.error('No "agent" group type yet. Make sure the backend has POSTHOG_API_KEY set and has synced at least once.');
  process.exit(1);
}
const AGENT = agentType.group_type_index;

const LAST_7_DAYS = { date_from: "-7d" };

// Zoko palette for funnels and trends (PostHog colours those from a theme, not hex codes).
const ZOKO_COLORS = ["#ff6937", "#35416b", "#8a8f98", "#068466", "#6e56cf", "#b64b02", "#0476fb", "#e4a604", "#ce0e74", "#41cbc4"];
const themes = await fetch(`${HOST}/api/environments/${PROJECT}/data_color_themes/`, { headers: { authorization: `Bearer ${KEY}` } }).then((r) => r.json());
let theme = (Array.isArray(themes) ? themes : themes.results ?? []).find((t) => t.name === "Zoko");
if (!theme) {
  theme = await fetch(`${HOST}/api/environments/${PROJECT}/data_color_themes/`, {
    method: "POST",
    headers: { authorization: `Bearer ${KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ name: "Zoko", colors: ZOKO_COLORS }),
  }).then((r) => r.json());
}
const THEME = theme.id;

const insights = [
  {
    name: "Support funnel",
    legacyNames: ["Support funnel: conversation → closed → CSAT asked → CSAT received", "Support funnel: conversations → closed → CSAT asked → CSAT received"],
    description: "",

    query: {
      kind: "InsightVizNode",
      source: {
        kind: "FunnelsQuery",
        series: [
          { kind: "EventsNode", event: "conversation_started", name: "conversation_started", custom_name: "Conversations" },
          { kind: "EventsNode", event: "conversation_closed", name: "conversation_closed", custom_name: "Closed" },
          { kind: "EventsNode", event: "conversation_surveyed", name: "conversation_surveyed", custom_name: "CSAT sent" },
          { kind: "EventsNode", event: "conversation_rated", name: "conversation_rated", custom_name: "CSAT received" },
        ],
        funnelsFilter: { funnelVizType: "steps", funnelOrderType: "ordered", funnelWindowInterval: 14, funnelWindowIntervalUnit: "day" },
        dateRange: LAST_7_DAYS,
        filterTestAccounts: false,
        dataColorTheme: THEME,
      },
    },
  },
  {
    name: "Messages per day",
    legacyNames: ["Messages per day (SQL)"],
    description: "",
    query: {
      kind: "DataVisualizationNode",
      source: {
        kind: "HogQLQuery",
        query: [
          "SELECT toDate(toTimeZone(timestamp, 'Asia/Kolkata')) AS `Day`,",
          "       count() AS `Total`,",
          "       countIf(event = 'message_received') AS `Customers`,",
          "       countIf(event = 'message_sent') AS `Store`",
          "FROM events",
          "WHERE event IN ('message_received', 'message_sent')",
          "  AND timestamp >= now() - INTERVAL 7 DAY",
          "GROUP BY `Day`",
          "ORDER BY `Day`",
        ].join("\n"),
      },
      // Stacked bars: each day's bar height is the total, split into customer and store messages.
      display: "ActionsStackedBar",
      chartSettings: {
        xAxis: { column: "Day" },
        yAxis: [
          { column: "Customers", settings: { display: { color: "#ff6937", label: "Customers", displayType: "bar" } } },
          { column: "Store", settings: { display: { color: "#35416b", label: "Store", displayType: "bar" } } },
        ],
        showLegend: true,
        legendPosition: "bottom",
        leftYAxisSettings: { startAtZero: true },
      },
    },
  },
  {
    name: "Agents with >10 messages",
    legacyNames: ["Agents with 10+ messages sent", "Agents with more than 10 messages sent"],
    description: "",
    query: {
      kind: "InsightVizNode",
      source: {
        kind: "TrendsQuery",
        series: [
          {
            kind: "EventsNode",
            event: "message_sent",
            name: "message_sent",
            custom_name: "Agents",
            math: "unique_group",
            math_group_type_index: AGENT,
            properties: [{ key: "messages_sent", value: 10, operator: "gt", type: "group", group_type_index: AGENT }],
          },
        ],
        interval: "day",
        dateRange: LAST_7_DAYS,
        trendsFilter: { display: "ActionsBar", showLegend: false, showValuesOnSeries: true },
        filterTestAccounts: false,
        dataColorTheme: THEME,
      },
    },
  },
];

// One dashboard holding all of them. Matched by current or earlier name, so renames update in place.
const DASHBOARD = {
  name: "Support analytics",
  legacyNames: ["Task 2: Zoko support analytics", "Zoko support intelligence (Task 2)"],
  description: "",
};
const dashboards = await api(`/dashboards/?limit=200`);
const dashNames = [DASHBOARD.name, ...DASHBOARD.legacyNames];
let dash = (dashboards.results ?? []).find((d) => dashNames.includes(d.name) && !d.deleted);
const dashBody = JSON.stringify({ name: DASHBOARD.name, description: DASHBOARD.description, filters: { date_from: "-7d" } });
dash = dash ? await api(`/dashboards/${dash.id}/`, { method: "PATCH", body: dashBody }) : await api("/dashboards/", { method: "POST", body: dashBody });

const existing = await api(`/insights/?limit=200&saved=true`);
for (const { legacyNames, ...ins } of insights) {
  const names = [ins.name, ...legacyNames];
  const found = (existing.results ?? []).find((i) => names.includes(i.name) && !i.deleted);
  const body = JSON.stringify({ ...ins, saved: true, dashboards: [dash.id] });
  const saved = found
    ? await api(`/insights/${found.id}/`, { method: "PATCH", body })
    : await api("/insights/", { method: "POST", body });
  console.log(`${found ? "updated" : "created"}: ${ins.name}\n  ${HOST}/project/${PROJECT}/insights/${saved.short_id}`);
}
// Layout (12-column grid): funnel full width on top, the other two side by side below.
const LAYOUT = {
  "Support funnel": { x: 0, y: 0, w: 12, h: 6 },
  "Messages per day": { x: 0, y: 6, w: 6, h: 6 },
  "Agents with >10 messages": { x: 6, y: 6, w: 6, h: 6 },
};
const full = await api(`/dashboards/${dash.id}/`);
const tiles = (full.tiles ?? [])
  .filter((t) => t.insight && LAYOUT[t.insight.name])
  .map((t) => {
    const sm = LAYOUT[t.insight.name];
    return { id: t.id, layouts: { sm: { ...sm, minW: 3, minH: 4 }, xs: { x: 0, y: sm.y, w: 1, h: sm.h, minW: 1, minH: 4 } } };
  });
await api(`/dashboards/${dash.id}/`, { method: "PATCH", body: JSON.stringify({ tiles }) });

console.log(`dashboard: ${HOST}/project/${PROJECT}/dashboard/${dash.id}`);
