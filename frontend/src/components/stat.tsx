import { StatusPill, statusDot } from "@/components/status";
import type { Status } from "@/lib/targets";
import { cn } from "@/lib/utils";

/**
 * A KPI tile: label, one number, a verdict against its target, and the
 * supporting context (target, average, sample size) in muted text.
 */
export function Stat({
  label,
  value,
  unit,
  status = "none",
  verdict,
  target,
  sub,
  icon,
}: {
  label: string;
  value: string | number;
  unit?: string;
  status?: Status;
  verdict?: string;
  target?: string;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="relative flex min-w-0 flex-col gap-2 overflow-hidden rounded-xl border bg-card px-4 pt-3.5 pb-3">
      <span className={cn("absolute inset-x-0 top-0 h-0.5", status === "none" ? "bg-transparent" : statusDot[status])} aria-hidden />
      <p className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </p>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1.5">
        <p className="text-2xl leading-none font-semibold tracking-tight">
          {value}
          {unit ? <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span> : null}
        </p>
        {verdict ? <StatusPill status={status} className="self-center">{verdict}</StatusPill> : null}
      </div>
      <div className="space-y-0.5 text-xs text-muted-foreground">
        {target ? <p>{target}</p> : null}
        {sub ? <p>{sub}</p> : null}
      </div>
    </div>
  );
}
