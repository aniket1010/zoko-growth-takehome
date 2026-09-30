"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Re-runs the server components on this page without a full reload. */
export function RefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant="outline" size="sm" onClick={() => start(() => router.refresh())} disabled={pending} aria-label="Refresh data">
      <RefreshCw className={cn(pending && "animate-spin")} aria-hidden />
      Refresh
    </Button>
  );
}
