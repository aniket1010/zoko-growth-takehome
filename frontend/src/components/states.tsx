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
    <div className={cn("flex flex-col items-center gap-1.5 rounded-lg border border-dashed px-4 py-8 text-center", className)}>
      {icon ? <div className="text-muted-foreground">{icon}</div> : null}
      <p className="text-[13px] font-medium">{title}</p>
      {children ? <p className="max-w-sm text-[13px] text-muted-foreground">{children}</p> : null}
    </div>
  );
}

/** The backend could not be reached. Render wakes up slowly on the free tier, so say so. */
export function ErrorState({ error, className }: { error: string; className?: string }) {
  return (
    <div className={cn("flex items-start gap-3 rounded-xl border border-bad/30 bg-bad-soft px-4 py-3.5", className)} role="alert">
      <ServerCrash className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />
      <div className="min-w-0 space-y-0.5">
        <p className="text-[13px] font-medium text-bad">The support backend is not responding</p>
        <p className="text-[13px] text-muted-foreground">
          It may be waking up after a quiet spell. Refresh in half a minute. If it keeps failing, the error was:
        </p>
        <p className="font-mono text-xs break-all text-muted-foreground">{error}</p>
      </div>
    </div>
  );
}
