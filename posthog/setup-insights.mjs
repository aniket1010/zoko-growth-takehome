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

const LAST_30_DAYS = { date_from: "-30d" };

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
        dateRange: LAST_30_DAYS,
        filterTestAccounts: false,
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
          "  AND timestamp >= now() - INTERVAL 30 DAY",
          "GROUP BY `Day`",
          "ORDER BY `Day`",
        ].join("\n"),
      },
      display: "ActionsLineGraph",
      chartSettings: {
        xAxis: { column: "Day" },
        yAxis: [{ column: "Total" }, { column: "Customers" }, { column: "Store" }],
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
        dateRange: LAST_30_DAYS,
        trendsFilter: { display: "ActionsBar" },
        filterTestAccounts: false,
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
const dashBody = JSON.stringify({ name: DASHBOARD.name, description: DASHBOARD.description });
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
console.log(`dashboard: ${HOST}/project/${PROJECT}/dashboard/${dash.id}`);
