import { cn } from "@/lib/utils";

/**
 * Two small, dependency-free charts rendered on the server as plain HTML.
 * Every value is also printed next to its mark, so the hover tip only repeats it.
 */

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 rounded-md bg-foreground px-2 py-1 text-[11px] whitespace-nowrap text-background shadow-sm group-hover/mark:block group-focus-visible/mark:block"
    >
      {children}
    </span>
  );
}

/** `of` names the stage when the next step is a share of it: "67% of surveys sent". */
export type FunnelStage = { label: string; value: number; note?: string; of?: string };

/** Horizontal funnel: one hue, bars share one baseline, value at the bar tip, step conversion under it. */
export function Funnel({ stages }: { stages: FunnelStage[] }) {
  const max = Math.max(1, ...stages.map((s) => s.value));
  return (
    <ol className="space-y-2.5">
      {stages.map((s, i) => {
        const prev = i > 0 ? stages[i - 1] : null;
        const step = prev && prev.value ? Math.round((s.value / prev.value) * 100) : null;
        const width = s.value ? Math.max(2, (s.value / max) * 100) : 0;
        return (
          <li key={s.label} className="grid grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-x-3 gap-y-0.5 sm:grid-cols-[8.5rem_minmax(0,1fr)_2.5rem]">
            <span className="col-span-2 col-start-1 row-start-1 text-[13px] sm:col-span-1">{s.label}</span>
            <span
              tabIndex={0}
              className="group/mark relative col-start-1 row-start-2 flex h-5 items-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:col-start-2 sm:row-start-1"
              aria-label={`${s.label}: ${s.value}`}
            >
              <span className="absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 rounded-r-[4px] bg-muted" aria-hidden />
              <span
                className="relative h-2.5 rounded-r-[4px] bg-brand transition-opacity group-hover/mark:opacity-85"
                style={{ width: `${width}%` }}
                aria-hidden
              />
              <Tip>
                <strong className="font-semibold">{s.value}</strong> {s.label.toLowerCase()}
                {step != null ? ` · ${step}% of previous step` : ""}
              </Tip>
            </span>
            <span className="col-start-2 row-start-2 text-right text-[13px] font-semibold tabular-nums sm:col-start-3 sm:row-start-1">{s.value}</span>
            {step != null || s.note ? (
              <span className="col-span-2 col-start-1 row-start-3 text-xs text-muted-foreground sm:col-start-2 sm:col-end-4 sm:row-start-2">
                {step != null ? `${step}% of ${prev!.of ?? prev!.label.toLowerCase()}` : null}
                {step != null && s.note ? " · " : null}
                {s.note}
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export type MixPart = { key: string; label: string; value: number; swatch: string };

/** One stacked bar for a part-to-whole split, 2px surface gaps between segments, legend with counts below. */
export function MixBar({ parts, total }: { parts: MixPart[]; total: number }) {
  const shown = parts.filter((p) => p.value > 0);
  return (
    <div className="space-y-3">
      {total ? (
        <div className="flex h-3 gap-0.5" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(", ")}>
          {shown.map((p, i) => (
            <span
              key={p.key}
              tabIndex={0}
              className={cn(
                "group/mark relative h-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                i === 0 && "rounded-l-[4px]",
                i === shown.length - 1 && "rounded-r-[4px]",
                p.swatch,
              )}
              style={{ width: `${(p.value / total) * 100}%` }}
            >
              <Tip>
                <strong className="font-semibold">{p.value}</strong> {p.label.toLowerCase()} ({Math.round((p.value / total) * 100)}%)
              </Tip>
            </span>
          ))}
        </div>
      ) : (
        <div className="h-3 rounded-[4px] bg-muted" aria-hidden />
      )}
      <ul className="grid grid-cols-3 gap-2">
        {parts.map((p) => (
          <li key={p.key} className="min-w-0">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn("size-2 shrink-0 rounded-[2px]", p.swatch)} aria-hidden />
              <span className="truncate">{p.label}</span>
            </span>
            <span className="text-[13px] font-semibold tabular-nums">
              {p.value}
              <span className="ml-1 font-normal text-muted-foreground">{total ? `${Math.round((p.value / total) * 100)}%` : ""}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A thin single-hue bar for inline use in table rows. */
export function InlineBar({ value, max, className }: { value: number; max: number; className?: string }) {
  return (
    <span className="relative block h-1.5 w-full rounded-r-[3px] bg-muted" aria-hidden>
      <span className={cn("absolute inset-y-0 left-0 rounded-r-[3px] bg-brand", className)} style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
    </span>
  );
}
