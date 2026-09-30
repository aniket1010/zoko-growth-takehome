import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Initials in a soft circle, as in Zoko's chat list. */
export function Avatar({ name, className }: { name: string | null | undefined; className?: string }) {
  return (
    <span
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand-ink ring-1 ring-brand-line",
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
