import type { ConversationMetric, ConversationRow } from "./api";

export const CONVERSATION_FILTERS = ["all", "waiting", "open", "closed"] as const;
export type ConversationFilter = (typeof CONVERSATION_FILTERS)[number];

export function searchConversations(rows: ConversationRow[], query: string) {
  const text = query.trim().toLowerCase();
  if (!text) return rows;
  const digits = text.replace(/\D/g, "");
  const isPhone = /^[+\d\s().-]+$/.test(text) && digits.length > 0;
  return rows.filter((row) =>
    [row.name, row.phone, row.assignee_name, row.last_message].some((value) => value?.toLowerCase().includes(text)) ||
    (isPhone && row.phone?.replace(/\D/g, "").includes(digits)),
  );
}

export function filterConversations(rows: ConversationRow[], filter: ConversationFilter, waiting: Set<string>) {
  return rows.filter((row) => filter === "all" || (filter === "waiting" ? waiting.has(row.id) : filter === "closed" ? row.is_closed : !row.is_closed));
}

/** A review heuristic, not an SLA: over 3x the median, with a 15-minute floor. */
export function responseObservations(rows: ConversationMetric[]) {
  const replied = rows.filter((row) => row.frt_seconds != null && Number.isFinite(row.frt_seconds));
  const values = replied.map((row) => row.frt_seconds!).sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  const median = values.length ? (values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2) : null;
  const threshold = Math.max(900, (median ?? 0) * 3);
  const slow = replied.length < 2 ? [] : replied.filter((row) => row.frt_seconds! > threshold).sort((a, b) => b.frt_seconds! - a.frt_seconds!);
  const missed = rows.filter((row) => row.closed_without_reply).sort((a, b) => b.closed_at!.localeCompare(a.closed_at!));
  return { replied, resolved: rows.filter((row) => row.resolution_seconds != null), slow, missed, threshold, closed: rows.filter((row) => row.closed_at != null).length };
}

export function parseTemplate(text: string | null) {
  if (!text || !/^(Header|Body):/m.test(text)) return null;
  const result: { header?: string; body?: string; footer?: string; buttons: string[] } = { buttons: [] };
  let current: "header" | "body" | "footer" | undefined;
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^(Header|Body|Footer|Buttons):\s*(.*)$/);
    if (!match) {
      if (current) result[current] = `${result[current]}\n${line}`;
      continue;
    }
    const [, key, value] = match;
    if (key === "Buttons") {
      result.buttons = value.split(/,\s*(?=\[)/).map((button) => button.replace(/^\[[^\]]*\]\s*/, "").trim()).filter(Boolean);
      current = undefined;
    } else {
      current = key.toLowerCase() as "header" | "body" | "footer";
      result[current] = value;
    }
  }
  return result;
}
