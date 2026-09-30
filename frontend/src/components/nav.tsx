"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/conversations", label: "Conversations" },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 md:px-8">
        <Link href="/" className="font-semibold">
          Support Intelligence
        </Link>
        <nav className="flex gap-4 text-sm">
          {links.map((l) => {
            const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href} className={cn("text-muted-foreground hover:text-foreground", active && "text-foreground font-medium")}>
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
