import { Page } from "@/components/panel";
import { Skeleton } from "@/components/ui/skeleton";

/** Shown while the server fetches. The backend can take a while to wake up on Render's free tier. */
export default function Loading() {
  return (
    <Page aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="h-16 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-4 min-[540px]:grid-cols-2 min-[1400px]:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-52 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <Skeleton className="h-56 rounded-xl lg:col-span-3" />
        <Skeleton className="h-56 rounded-xl lg:col-span-2" />
      </div>
      <p className="text-center text-xs text-muted-foreground">Fetching the latest numbers. The first load after a quiet spell can take up to a minute.</p>
    </Page>
  );
}
