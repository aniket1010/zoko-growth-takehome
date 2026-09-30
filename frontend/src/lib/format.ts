/** 45 -> "45s", 207 -> "3m 27s", 5400 -> "1h 30m", 200000 -> "2d 7h". */
export function duration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return "â€“";
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

const IST = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** Postgres returns "2026-09-30 14:13:43+00"; normalise so every browser parses it. */
export function time(ts: string | null | undefined): string {
  if (!ts) return "â€“";
  return IST.format(new Date(ts.replace(" ", "T").replace(/\+00$/, "Z")));
}

export function percent(part: number, whole: number): string {
  return whole ? `${Math.round((part / whole) * 100)}%` : "â€“";
}

/** "919876543210" -> "+91 98765 43210". The brief asks for the phone to be shown. */
export function phone(p: string | null | undefined): string {
  if (!p) return "–";
  const d = p.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) return `+91 ${d.slice(2, 7)} ${d.slice(7)}`;
  return `+${d}`;
}
