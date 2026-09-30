import { cn } from "@/lib/utils";

export function ConversationStatus({ closed, waiting = false }: { closed: boolean; waiting?: boolean }) {
  return <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium", waiting ? "bg-warning-soft text-warning" : closed ? "bg-muted text-muted-foreground" : "bg-brand-soft text-brand-ink")}>
    <span className="size-1.5 rounded-full bg-current" aria-hidden />
    {waiting ? "Waiting" : closed ? "Closed" : "Open"}
  </span>;
}
