const DASH = "–";

/** 45 -> "45s", 207 -> "3m 27s", 300 -> "5m", 5400 -> "1h 30m", 3600 -> "1h", 200000 -> "2d 7h". */
export function duration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return DASH;
  const s = Math.round(seconds);
  const pair = (big: number, bu: string, small: number, su: string) => (small ? `${big}${bu} ${small}${su}` : `${big}${bu}`);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return pair(m, "m", s % 60, "s");
  const h = Math.floor(m / 60);
  if (h < 24) return pair(h, "h", m % 60, "m");
  return pair(Math.floor(h / 24), "d", h % 24, "h");
}

/** Postgres returns "2026-09-30 14:13:43+00"; normalise so every browser parses it. */
export function parseTs(ts: string): Date {
  return new Date(ts.replace(" ", "T").replace(/\+00$/, "Z"));
}

const IST = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const IST_CLOCK = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  hour: "numeric",
  minute: "2-digit",
});

const IST_DAY = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "30 Sept, 07:43 pm" in IST. */
export function time(ts: string | null | undefined): string {
  if (!ts) return DASH;
  return IST.format(parseTs(ts));
}

/** "7:43 pm" in IST, for chat bubbles. */
export function clock(ts: string | null | undefined): string {
  if (!ts) return DASH;
  return IST_CLOCK.format(parseTs(ts));
}

/** "Wed, 30 Sept 2026" in IST, for day separators. Also a stable key for grouping by day. */
export function day(ts: string | null | undefined): string {
  if (!ts) return DASH;
  return IST_DAY.format(parseTs(ts));
}

export function percent(part: number, whole: number): string {
  return whole ? `${Math.round((part / whole) * 100)}%` : DASH;
}

/** "919876543210" -> "+91 98765 43210". The brief asks for the phone to be shown. */
export function phone(p: string | null | undefined): string {
  if (!p) return DASH;
  const d = p.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) return `+91 ${d.slice(2, 7)} ${d.slice(7)}`;
  return `+${d}`;
}

/** "Laxmi Bhusal" -> "LB", "om dubey" -> "OD", null -> "?". */
export function initials(name: string | null | undefined): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")).toUpperCase();
}

export const EMPTY = DASH;
