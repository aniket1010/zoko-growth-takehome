import { cn } from "@/lib/utils";

/** A white panel on the grey canvas: thin border, soft corners, like Zoko's content cards. */
export function Panel({ className, ...props }: React.ComponentProps<"section">) {
  return <section className={cn("min-w-0 rounded-xl border bg-card text-card-foreground", className)} {...props} />;
}

export function PanelHeader({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 pt-3.5 pb-3", className)}>
      <div className="min-w-0 space-y-0.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          {icon}
          {title}
        </h2>
        {description ? <p className="text-[13px] text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function PanelBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-4 pb-4", className)} {...props} />;
}

/** Page title block: small caps eyebrow, title, one-line description, optional right-side actions. */
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  children,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 space-y-0.5">
          {eyebrow ? <p className="label-caps">{eyebrow}</p> : null}
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
          {description ? <p className="text-[13px] text-muted-foreground">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </header>
  );
}

/** The page body wrapper: grey canvas, consistent gutters, capped width. */
export function Page({ className, ...props }: React.ComponentProps<"main">) {
  return <main className={cn("mx-auto w-full max-w-7xl space-y-4 px-4 py-5 md:px-6 md:py-6", className)} {...props} />;
}
