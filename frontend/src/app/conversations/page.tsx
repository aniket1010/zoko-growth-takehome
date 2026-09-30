import Link from "next/link";
import { Clock, Inbox } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Page, PageHeader, Panel } from "@/components/panel";
import { RefreshButton } from "@/components/refresh-button";
import { EmptyState, ErrorState } from "@/components/states";
import { statusText } from "@/components/status";
import { api, type AttentionRow, type ConversationRow } from "@/lib/api";
import { duration, EMPTY, parseTs, phone, time } from "@/lib/format";
import { waitStatus } from "@/lib/targets";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "waiting", label: "Waiting" },
  { key: "open", label: "Open" },
  { key: "closed", label: "Closed" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

export default async function Conversations({ searchParams }: PageProps<"/conversations">) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.status) ? sp.status[0] : sp.status;
  const filter: FilterKey = FILTERS.some((f) => f.key === raw) ? (raw as FilterKey) : "all";

  const [convRes, attRes] = await Promise.allSettled([api.conversations(), api.attention()]);
  if (convRes.status === "rejected") {
    return (
      <Page>
        <PageHeader eyebrow="Support intelligence" title="Conversations" action={<RefreshButton />} />
        <ErrorState error={convRes.reason instanceof Error ? convRes.reason.message : String(convRes.reason)} />
      </Page>
    );
  }
  const rows: ConversationRow[] = [...convRes.value].sort((a, b) => parseTs(b.last_message_at).getTime() - parseTs(a.last_message_at).getTime());
  const waiting = new Map<string, AttentionRow>(attRes.status === "fulfilled" ? attRes.value.map((a) => [a.customer_id, a]) : []);

  const counts: Record<FilterKey, number> = {
    all: rows.length,
    waiting: rows.filter((r) => waiting.has(r.id)).length,
    open: rows.filter((r) => !r.is_closed).length,
    closed: rows.filter((r) => r.is_closed).length,
  };
  const visible = rows.filter((r) =>
    filter === "all" ? true : filter === "waiting" ? waiting.has(r.id) : filter === "open" ? !r.is_closed : r.is_closed,
  );

  return (
    <Page>
      <PageHeader
        eyebrow="Support intelligence"
        title="Conversations"
        description={`${rows.length} ${rows.length === 1 ? "customer" : "customers"} with messages, most recent first. Times in IST.`}
        action={<RefreshButton />}
      />

      <nav className="flex gap-1 overflow-x-auto" aria-label="Filter conversations">
        {FILTERS.map((f) => {
          const active = f.key === filter;
          return (
            <Link
              key={f.key}
              href={f.key === "all" ? "/conversations" : `/conversations?status=${f.key}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground",
                active ? "border-border bg-card font-medium text-foreground shadow-xs" : "border-transparent hover:bg-card/60",
              )}
            >
              {f.label}
              <span
                className={cn(
                  "rounded px-1 text-[11px] tabular-nums",
                  f.key === "waiting" && counts.waiting ? "bg-bad text-white" : "bg-muted text-muted-foreground",
                )}
              >
                {counts[f.key]}
              </span>
            </Link>
          );
        })}
      </nav>

      <Panel className="overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-4">
            <EmptyState icon={<Inbox className="size-5" />} title="No messages yet">
              Conversations appear here as soon as Zoko sends them to the webhook.
            </EmptyState>
          </div>
        ) : visible.length === 0 ? (
          <div className="p-4">
            <EmptyState icon={<Inbox className="size-5" />} title={`No ${FILTERS.find((f) => f.key === filter)!.label.toLowerCase()} conversations`}>
              {filter === "waiting" ? "Every open conversation has a human reply." : "Try another filter."}
            </EmptyState>
          </div>
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)_6rem_minmax(0,2fr)_4.5rem] gap-4 border-b bg-muted/50 px-4 py-2 md:grid">
              <span className="label-caps">Customer</span>
              <span className="label-caps">Assigned agent</span>
              <span className="label-caps">Status</span>
              <span className="label-caps">Last message</span>
              <span className="text-right label-caps">Messages</span>
            </div>
            <ul className="divide-y">
              {visible.map((r) => {
                const w = waiting.get(r.id);
                return (
                  <li key={r.id}>
                    <Link
                      href={`/conversations/${r.id}`}
                      className={cn(
                        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none md:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)_6rem_minmax(0,2fr)_4.5rem]",
                        w && "shadow-[inset_2px_0_0_var(--bad)]",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <Avatar name={r.name} />
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium">{r.name ?? "Unknown"}</span>
                          <span className="block truncate font-mono text-xs text-muted-foreground">{phone(r.phone)}</span>
                        </span>
                      </span>

                      <span className="hidden min-w-0 truncate text-[13px] md:block">
                        {r.assignee_name || <span className="font-medium text-warning">Unassigned</span>}
                      </span>

                      <span className="flex flex-col items-end gap-1 md:items-start">
                        <StateChip closed={r.is_closed} />
                        {w ? (
                          <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium whitespace-nowrap", statusText[waitStatus(w.waiting_seconds)])}>
                            <Clock className="size-3" aria-hidden />
                            {duration(w.waiting_seconds)}
                          </span>
                        ) : null}
                      </span>

                      <span className="col-span-2 min-w-0 md:col-span-1">
                        <span className="block truncate text-[13px]">{r.last_message?.replace(/^Body:\s*/, "") || EMPTY}</span>
                        <span className="block text-xs text-muted-foreground">
                          {time(r.last_message_at)}
                          <span className="md:hidden">
                            {" · "}
                            {r.assignee_name || "Unassigned"}
                            {" · "}
                            {r.message_count} msgs
                          </span>
                        </span>
                      </span>

                      <span className="hidden text-right md:block">
                        <span className="block text-[13px] font-semibold tabular-nums">{r.message_count}</span>
                        <span className="block text-xs text-muted-foreground tabular-nums">{r.inbound_count} in</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Panel>
    </Page>
  );
}

function StateChip({ closed }: { closed: boolean }) {
  return closed ? (
    <span className="inline-flex h-5 items-center rounded-full bg-muted px-2 text-[11px] font-medium text-muted-foreground">Closed</span>
  ) : (
    <span className="inline-flex h-5 items-center gap-1 rounded-full bg-brand-soft px-2 text-[11px] font-medium text-brand-ink">
      <span className="size-1.5 rounded-full bg-brand" aria-hidden />
      Open
    </span>
  );
}
