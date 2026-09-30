import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Initials in a soft circle, as in Zoko's chat list. */
export function Avatar({ name, className }: { name: string | null | undefined; className?: string }) {
  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium text-muted-foreground ring-1 ring-border",
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
