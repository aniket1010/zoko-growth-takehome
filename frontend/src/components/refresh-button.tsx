"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return <Button variant="outline" className="h-10 gap-2 bg-card px-4 shadow-control" disabled={pending} onClick={() => start(() => router.refresh())} aria-label="Refresh data">
    <RefreshCw className={pending ? "animate-spin motion-reduce:animate-none" : ""} aria-hidden />
    {pending ? "Refreshing…" : "Refresh data"}
  </Button>;
}
