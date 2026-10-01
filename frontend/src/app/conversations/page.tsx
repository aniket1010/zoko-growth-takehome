import Link from "next/link";
import { ArrowUpRight, Clock, Inbox, Search } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { ConversationStatus } from "@/components/conversation-status";
import { Page, PageHeader, Panel } from "@/components/panel";
import { RefreshButton } from "@/components/refresh-button";
import { EmptyState, ErrorState } from "@/components/states";
import { api } from "@/lib/api";
import { duration, parseTs, phone, time } from "@/lib/format";
import { CONVERSATION_FILTERS, filterConversations, searchConversations, type ConversationFilter } from "@/lib/support";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function Conversations({ searchParams }: PageProps<"/conversations">) {
  const params = await searchParams;
  const raw = Array.isArray(params.status) ? params.status[0] : params.status;
  const filter: ConversationFilter = CONVERSATION_FILTERS.includes(raw as ConversationFilter) ? raw as ConversationFilter : "all";
  const query = (Array.isArray(params.q) ? params.q[0] : params.q ?? "").trim();
  const [result, attention] = await Promise.allSettled([api.conversations(), api.attention()]);
  if (result.status === "rejected") return <Page><PageHeader title="Conversations" action={<RefreshButton />} /><ErrorState error={String(result.reason)} /></Page>;
  const rows = [...result.value].sort((a, b) => parseTs(b.last_message_at).getTime() - parseTs(a.last_message_at).getTime());
  const waiting = new Map(attention.status === "fulfilled" ? attention.value.map((row) => [row.customer_id, row]) : []);
  const waitingIds = new Set(waiting.keys());
  const matches = searchConversations(rows, query);
  const visible = filterConversations(matches, filter, waitingIds);
  function href(status: ConversationFilter, search = query) {
    const sp = new URLSearchParams();
    if (status !== "all") sp.set("status", status);
    if (search) sp.set("q", search);
    return `/conversations${sp.size ? `?${sp}` : ""}`;
  }
  return <Page>
    <PageHeader title="Conversations" description="Find a customer, review their latest message, and follow up." action={<RefreshButton />} />
    <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
      <nav className="flex gap-4 overflow-x-auto border-b sm:gap-6" aria-label="Filter conversations">
        {CONVERSATION_FILTERS.map((key) => <Link key={key} href={href(key)} aria-current={filter === key ? "page" : undefined}
          className={cn("inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 py-3 text-[13px] transition-colors hover:text-foreground", filter === key ? "border-foreground font-medium" : "border-transparent text-muted-foreground")}>
          <span className="capitalize">{key}</span>
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground tabular-nums">{key === "waiting" && attention.status === "rejected" ? "—" : filterConversations(matches, key, waitingIds).length}</span>
        </Link>)}
      </nav>
      <form action="/conversations" role="search" className="flex min-w-0 items-center gap-2 rounded-lg border border-input bg-card px-3 shadow-control focus-within:ring-2 focus-within:ring-ring/40 xl:w-80">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        {filter !== "all" ? <input type="hidden" name="status" value={filter} /> : null}
        <label className="sr-only" htmlFor="conversation-search">Search conversations</label>
        <input key={query} id="conversation-search" name="q" type="search" defaultValue={query} placeholder="Search customer or phone" className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none" />
        <button type="submit" className="min-h-11 text-xs font-medium text-muted-foreground hover:text-foreground">Search</button>
      </form>
    </div>
    {attention.status === "rejected" ? <p role="status" className="text-sm text-warning">Waiting status is unavailable. Refresh to try again.</p> : null}
    {filter === "waiting" ? <p className="text-xs text-muted-foreground">Open conversations awaiting their first human reply. AI replies do not clear this queue.</p> : null}
    <Panel className="overflow-hidden">
      {!visible.length ? <EmptyState icon={<Inbox className="size-5" aria-hidden />} title={query ? "No matching conversations" : filter === "waiting" && attention.status === "rejected" ? "Waiting status unavailable" : `No ${filter === "all" ? "" : `${filter} `}conversations`}>
        {query ? <>Try another search or <Link className="text-brand-ink underline underline-offset-4" href={href(filter, "")}>clear search</Link>.</> : filter === "waiting" && attention.status === "fulfilled" ? "No open conversations are awaiting their first human reply." : "Try another filter or refresh for the latest messages."}
      </EmptyState> : <>
        <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_minmax(0,1fr)_6rem_1rem] gap-5 border-b bg-muted/30 px-6 py-4 text-xs text-muted-foreground xl:grid">
          <span>Customer</span><span>Latest message</span><span>Assigned agent</span><span>Status</span><span />
        </div>
        <ul className="divide-y">
          {visible.map((row) => <li key={row.id}>
            <Link href={`/conversations/${row.id}`} className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 gap-y-3 px-5 py-5 transition-colors hover:bg-muted/40 sm:px-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_minmax(0,1fr)_6rem_1rem]">
              <span className="flex min-w-0 items-center gap-3"><Avatar name={row.name} /><span className="min-w-0"><span className="block truncate text-sm font-medium">{row.name || "Unknown customer"}</span><span className="mt-1 block truncate font-mono text-xs text-muted-foreground">{phone(row.phone)}</span></span></span>
              <span className="col-span-2 row-start-2 min-w-0 xl:col-span-1 xl:row-start-auto"><span className="block truncate text-[13px]">{row.last_message?.replace(/^Body:\s*/, "") || "No text preview"}</span><span className="mt-1 block text-xs text-muted-foreground">{time(row.last_message_at)} · {row.message_count} messages<span className="xl:hidden"> · {row.assignee_name || "Unassigned"}</span></span></span>
              <span className="hidden truncate text-[13px] xl:block">{row.assignee_name || <span className="text-muted-foreground">Unassigned</span>}</span>
              <span className="col-start-2 row-start-1 flex flex-col items-end gap-1.5 xl:col-start-auto xl:row-start-auto xl:items-start"><ConversationStatus closed={row.is_closed} waiting={waiting.has(row.id)} />{waiting.has(row.id) ? <span className="flex items-center gap-1 text-xs text-warning"><Clock className="size-3" aria-hidden />{duration(waiting.get(row.id)!.waiting_seconds)}</span> : null}</span>
              <ArrowUpRight className="hidden size-4 text-muted-foreground group-hover:text-brand-ink xl:block" aria-hidden />
            </Link>
          </li>)}
        </ul>
      </>}
    </Panel>
    <p className="text-xs text-muted-foreground">{visible.length} of {rows.length} customers · Most recent first · Times in IST</p>
  </Page>;
}
