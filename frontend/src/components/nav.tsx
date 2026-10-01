"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ArrowUpRight, ChartNoAxesCombined, MessagesSquare } from "lucide-react";
import { ThemeToggle } from "@/components/theme";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Overview", icon: ChartNoAxesCombined },
  { href: "/conversations", label: "Conversations", icon: MessagesSquare },
] as const;

function Brand() {
  return (
    <Link href="/" aria-label="Zoko support overview" className="flex w-fit items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
      <Image src="/assets/zoko-logo.svg" alt="Zoko" width={112} height={34} priority className="h-auto w-28 dark:invert" />
    </Link>
  );
}

export function Nav() {
  const path = usePathname();
  const active = (href: string) => href === "/" ? path === "/" : path.startsWith(href);
  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex xl:w-[248px]">
        <div className="px-7 pt-9 pb-10"><Brand /></div>
        <div className="mx-5 mb-9 flex items-center gap-3 rounded-lg border bg-card px-3 py-3 shadow-panel">
          <span className="grid size-9 shrink-0 place-items-center rounded-md border bg-background text-xs font-semibold">SI</span>
          <div className="min-w-0">
            <p className="text-[13px] font-medium">Support intelligence</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Your support workspace</p>
          </div>
        </div>
        <p className="mb-3 px-7 text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">Workspace</p>
        <nav className="space-y-1 px-4" aria-label="Main">
          {links.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-current={active(href) ? "page" : undefined}
              className={cn("flex h-11 items-center gap-3 rounded-lg px-3 text-[13px] transition-colors hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-ring", active(href) ? "bg-sidebar-accent font-semibold text-foreground" : "text-muted-foreground")}>
              <Icon className={cn("size-[18px]", active(href) && "text-brand-ink")} strokeWidth={1.7} aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto p-5">
          <div className="space-y-2 border-t pt-4">
            <a href="https://www.zoko.io/" target="_blank" rel="noopener noreferrer" className="flex min-h-10 items-center justify-between rounded-md px-2 text-[13px] text-muted-foreground hover:bg-sidebar-accent hover:text-foreground">
              Open Zoko <ArrowUpRight className="size-4" aria-hidden />
            </a>
            <ThemeToggle withLabel className="h-10 w-full justify-start" />
          </div>
        </div>
      </aside>
      <header className="sticky top-0 z-20 border-b bg-card md:hidden">
        <div className="flex items-center justify-between px-5 py-4"><Brand /><ThemeToggle className="size-11 justify-center" /></div>
        <nav className="flex gap-6 px-5" aria-label="Main">
          {links.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-current={active(href) ? "page" : undefined}
              className={cn("-mb-px flex min-h-11 items-center gap-2 border-b-2 border-transparent text-[13px] text-muted-foreground", active(href) && "border-brand font-medium text-foreground")}>
              <Icon className="size-4" aria-hidden />{label}
            </Link>
          ))}
        </nav>
      </header>
    </>
  );
}
