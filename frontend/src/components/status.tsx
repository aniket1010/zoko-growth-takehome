import { CircleAlert, CircleCheck, CircleDashed, TriangleAlert } from "lucide-react";
import type { Status } from "@/lib/targets";
import { cn } from "@/lib/utils";

export const statusText: Record<Status, string> = {
  good: "text-good",
  warning: "text-warning",
  bad: "text-bad",
  none: "text-muted-foreground",
};

export const statusSoft: Record<Status, string> = {
  good: "bg-good-soft text-good",
  warning: "bg-warning-soft text-warning",
  bad: "bg-bad-soft text-bad",
  none: "bg-muted text-muted-foreground",
};

export const statusDot: Record<Status, string> = {
  good: "bg-good",
  warning: "bg-warning",
  bad: "bg-bad",
  none: "bg-muted-foreground/40",
};

const icons: Record<Status, typeof CircleCheck> = {
  good: CircleCheck,
  warning: TriangleAlert,
  bad: CircleAlert,
  none: CircleDashed,
};

/** A verdict chip: icon + words, so the state never relies on colour alone. */
export function StatusPill({ status, children, className }: { status: Status; children: React.ReactNode; className?: string }) {
  const Icon = icons[status];
  return (
    <span className={cn("inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-medium whitespace-nowrap", statusSoft[status], className)}>
      <Icon className="size-3" aria-hidden />
      {children}
    </span>
  );
}

/** A small coloured dot with an accessible label, for dense table cells. */
export function StatusDot({ status, label }: { status: Status; label: string }) {
  return <span className={cn("inline-block size-1.5 shrink-0 rounded-full", statusDot[status])} role="img" aria-label={label} title={label} />;
}
