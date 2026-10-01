"use client";

import { useEffect, useState } from "react";

/**
 * A plain "Loading…" that only explains the delay if loading is actually slow.
 * The backend can take up to a minute to wake on Render's free plan; most loads
 * finish in about a second, so most visitors never see the longer note.
 */
export function SlowLoadHint({ afterMs = 4000 }: { afterMs?: number }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), afterMs);
    return () => clearTimeout(t);
  }, [afterMs]);
  return (
    <p className="text-center text-xs text-muted-foreground" aria-live="polite">
      {slow ? "Waking up the server. This can take up to a minute after a quiet period." : "Loading…"}
    </p>
  );
}
