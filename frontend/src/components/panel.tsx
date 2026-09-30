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
    <header className={cn("flex flex-wrap items-start justify-between gap-x-6 gap-y-3 p-5 sm:p-6", className)}>
      <div className="min-w-0 space-y-1.5">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          {icon}
          {title}
        </h2>
        {description ? <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function PanelBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-5 pb-5 sm:px-6 sm:pb-6", className)} {...props} />;
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
    <header className="space-y-5 pb-1">
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div className="min-w-0">
          {eyebrow ? <p className="mb-3 text-xs font-medium text-muted-foreground">{eyebrow}</p> : null}
          <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.035em] sm:text-[32px]">{title}</h1>
          {description ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </header>
  );
}

/** The page body wrapper: grey canvas, consistent gutters, capped width. */
export function Page({ className, ...props }: React.ComponentProps<"main">) {
  return <main id="main-content" className={cn("mx-auto w-full max-w-[1440px] space-y-7 px-5 py-8 sm:px-8 md:py-10 xl:space-y-8 xl:px-12", className)} {...props} />;
}
