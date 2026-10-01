import { ServerCrash } from "lucide-react";
import { cn } from "@/lib/utils";

/** Quiet empty state: an icon, one sentence of what is missing, one of what will fill it. */
export function EmptyState({
  icon,
  title,
  children,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 rounded-lg px-6 py-16 text-center", className)}>
      {icon ? <div className="mb-2 grid size-12 place-items-center rounded-xl border bg-muted/50 text-muted-foreground">{icon}</div> : null}
      <p className="text-sm font-medium">{title}</p>
      {children ? <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{children}</p> : null}
    </div>
  );
}

/** The backend could not be reached. Render wakes up slowly on the free tier, so say so. */
export function ErrorState({ error, className }: { error: string; className?: string }) {
  return (
    <div className={cn("flex items-start gap-3 rounded-xl border bg-card p-6 shadow-panel", className)} role="alert">
      <ServerCrash className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />
      <div className="min-w-0 space-y-2">
        <p className="text-sm font-medium text-bad">The support backend is not responding</p>
        <p className="text-[13px] text-muted-foreground">
          It may be waking up after a quiet spell. Refresh in half a minute. If it keeps failing, the error was:
        </p>
        <details className="text-xs text-muted-foreground"><summary className="w-fit cursor-pointer py-1">Technical details</summary><p className="mt-2 font-mono break-all">{error}</p></details>
      </div>
    </div>
  );
}
