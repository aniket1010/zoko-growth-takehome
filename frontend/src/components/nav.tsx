"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Headset, LayoutDashboard, MessagesSquare } from "lucide-react";
import { ThemeToggle } from "@/components/theme";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/conversations", label: "Conversations", icon: MessagesSquare },
] as const;

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path.startsWith(href);
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-md focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none">
      <span className="grid size-7 place-items-center rounded-md bg-brand text-white">
        <Headset className="size-4" aria-hidden />
      </span>
      <span className="leading-tight">
        <span className="block text-[13px] font-semibold">Support Intelligence</span>
        <span className="block text-[11px] text-muted-foreground">Zoko inbox analytics</span>
      </span>
    </Link>
  );
}

/**
 * App shell navigation. Desktop: a Zoko-style left sidebar with icon + label rows.
 * Phone: a compact top bar with the same two destinations as tabs.
 */
export function Nav() {
  const path = usePathname();
  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="px-4 pt-4 pb-5">
          <Brand />
        </div>
        <div className="px-4 pb-1.5 label-caps">Support</div>
        <nav className="flex flex-col gap-0.5 px-2" aria-label="Main">
          {links.map(({ href, label, icon: Icon }) => {
            const active = isActive(path, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                  active && "bg-sidebar-accent font-medium text-sidebar-foreground",
                )}
              >
                <Icon className={cn("size-4 shrink-0", active ? "text-brand" : "text-muted-foreground")} aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-1 border-t border-sidebar-border p-2">
          <p className="flex items-center gap-2 px-2 py-1 text-[11px] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-good" aria-hidden />
            Live from Zoko webhooks
          </p>
          <ThemeToggle withLabel className="w-full justify-start" />
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur md:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <Brand />
          <ThemeToggle />
        </div>
        <nav className="flex gap-1 px-2" aria-label="Main">
          {links.map(({ href, label, icon: Icon }) => {
            const active = isActive(path, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px flex items-center gap-1.5 border-b-2 border-transparent px-2.5 pb-2 text-[13px] text-muted-foreground",
                  active && "border-brand font-medium text-foreground",
                )}
              >
                <Icon className={cn("size-4", active && "text-brand")} aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
      </header>
    </>
  );
}
