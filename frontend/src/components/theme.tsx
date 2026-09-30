"use client";

import { ThemeProvider as NextThemes, useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemes>
  );
}

/** Flips between light and dark. Icons swap with CSS so the server render never mismatches. */
export function ThemeToggle({ className, withLabel = false }: { className?: string; withLabel?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-md px-2 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
        className,
      )}
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
    >
      <Moon className="size-4 dark:hidden" aria-hidden />
      <Sun className="hidden size-4 dark:block" aria-hidden />
      {withLabel ? (
        <span className="text-[13px]">
          <span className="dark:hidden">Dark mode</span>
          <span className="hidden dark:inline">Light mode</span>
        </span>
      ) : null}
    </button>
  );
}
