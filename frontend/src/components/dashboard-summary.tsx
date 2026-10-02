import Link from "next/link";
import { ArrowUpRight, CircleCheck, Clock, MessageSquare, Timer } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Panel, PanelBody, PanelHeader } from "@/components/panel";
import type { AttentionRow, ConversationMetric, Overview } from "@/lib/api";
import { duration, parseTs, phone, time } from "@/lib/format";
import { responseObservations } from "@/lib/support";

export function MetricSummary({ overview: o }: { overview: Overview; metrics?: ConversationMetric[] | null }) {
  const parts = [
    { label: "Customer", value: o.customer_messages, color: "bg-series-customer" },
    { label: "Agent", value: o.agent_messages, color: "bg-series-agent" },
    { label: "AI", value: o.bot_messages, color: "bg-series-bot" },
  ];
  return <section aria-label="Support metrics" className="grid gap-5 xl:grid-cols-3">
    <Panel className="flex flex-col p-5 sm:p-6">
      <h2 className="flex items-center justify-between text-sm font-medium">Message volume<MessageSquare className="size-4 text-muted-foreground" aria-hidden /></h2>
      <p className="mt-5 text-[32px] leading-tight font-semibold tracking-tight tabular-nums">{o.total_messages}<span className="ml-2 text-xs font-normal tracking-normal text-muted-foreground">total messages</span></p>
      <p className="mt-2 text-xs text-muted-foreground">{o.customers_with_messages} customers · {o.conversations} conversations</p>
      <div className="mt-auto pt-6">
        <div className="flex h-2 gap-0.5 overflow-hidden rounded-sm bg-muted" role="img" aria-label={parts.map((p) => `${p.label}: ${p.value}`).join(", ")}>
          {parts.filter((p) => p.value > 0).map((p) => <span key={p.label} className={p.color} style={{ flex: p.value }} />)}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">{parts.map((p) => <span key={p.label} className="inline-flex items-center gap-1.5"><span className={`size-1.5 rounded-full ${p.color}`} aria-hidden />{p.label} <span className="font-medium text-foreground tabular-nums">{p.value}</span></span>)}</div>
      </div>
    </Panel>
    {[
      { title: "First response", median: o.median_frt_seconds, average: o.avg_frt_seconds, Icon: Timer, note: "Human replies only; AI and surveys excluded." },
      { title: "Resolution", median: o.median_resolution_seconds, average: o.avg_resolution_seconds, Icon: CircleCheck, note: "Closed conversations with a human reply." },
    ].map(({ title, median, average, Icon, note }) => <Panel key={title} className="flex flex-col p-5 sm:p-6">
      <h2 className="flex items-center justify-between text-sm font-medium">{title}<Icon className="size-4 text-muted-foreground" aria-hidden /></h2>
      <dl className="mt-5 grid grid-cols-2 gap-4">
        <div><dt className="text-xs text-muted-foreground">Median</dt><dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{duration(median)}</dd></div>
        <div className="border-l pl-4"><dt className="text-xs text-muted-foreground">Average</dt><dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{duration(average)}</dd></div>
      </dl>
      <p className="mt-auto border-t pt-3 text-xs leading-relaxed text-muted-foreground"><span className="block pt-2">{note}</span></p>
    </Panel>)}
  </section>;
}

export function AttentionQueue({ rows }: { rows: AttentionRow[] | null }) {
  if (!rows) return <Panel className="p-5 text-sm text-muted-foreground" role="status">The attention queue is temporarily unavailable. Refresh to try again.</Panel>;
  if (!rows.length) return <Panel className="flex items-center gap-3 px-5 py-4"><CircleCheck className="size-4 shrink-0 text-good" aria-hidden /><p className="text-[13px]"><span className="font-medium">No first replies pending.</span> <span className="text-muted-foreground">No open conversations are awaiting their first human reply.</span></p></Panel>;
  const shown = [...rows].sort((a, b) => b.waiting_seconds - a.waiting_seconds).slice(0, 3);
  return <Panel className="overflow-hidden">
    <PanelHeader title={<><span className="size-2 rounded-full bg-warning" aria-hidden />Needs attention<span className="rounded-md bg-warning-soft px-2 py-0.5 text-xs text-warning">{rows.length}</span></>} description="Awaiting a first human reply, longest wait first. AI replies do not clear this queue." action={<Link href="/conversations?status=waiting" className="inline-flex min-h-9 items-center gap-1 text-xs font-medium text-brand-ink">View waiting<ArrowUpRight className="size-3.5" aria-hidden /></Link>} />
    <ul className="divide-y border-t">{shown.map((row) => <li key={row.customer_id}><Link href={`/conversations/${row.customer_id}`} className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4 transition-colors hover:bg-muted/40 sm:px-6">
      <span className="flex min-w-0 flex-1 basis-48 items-center gap-3"><Avatar name={row.customer_name} /><span className="min-w-0"><span className="block truncate text-sm font-medium">{row.customer_name || "Unknown customer"}</span><span className="block font-mono text-xs text-muted-foreground">{phone(row.phone)}</span></span></span>
      <span className="min-w-0 flex-1 basis-40 text-xs text-muted-foreground">Assigned to <span className="font-medium text-foreground [overflow-wrap:anywhere]">{row.assignee_name || "nobody"}</span></span>
      <span className="ml-auto flex items-center gap-2 text-sm font-medium text-warning"><Clock className="size-3.5" aria-hidden />{duration(row.waiting_seconds)}<ArrowUpRight className="ml-2 size-4 text-muted-foreground" aria-hidden /></span>
    </Link></li>)}</ul>
  </Panel>;
}

export function Observations({ metrics }: { metrics: ConversationMetric[] | null }) {
  if (!metrics) return <Panel><PanelHeader title="Observations" description="Conversation details are temporarily unavailable. Refresh to check for response delays and missed replies." /></Panel>;
  const { slow, missed, replied, closed, threshold } = responseObservations(metrics);
  const observations = [
    ...(slow.length ? [{ title: `${slow.length === 1 ? "A conversation took" : `${slow.length} conversations took`} longer to answer`, text: `${slow.length} of ${replied.length} replied conversations exceeded ${duration(threshold)}. Longest first response: ${duration(slow[0].frt_seconds)}.`, rule: "Review rule: more than 3× the median, with a 15-minute minimum. This is not an SLA.", rows: slow, kind: "slow" }] : []),
    ...(missed.length ? [{ title: `${missed.length} ${missed.length === 1 ? "conversation closed" : "conversations closed"} without a human reply`, text: `${missed.length} of ${closed} closed conversations had no human reply. These are excluded from resolution-time calculations.`, rule: "Review the thread to understand the closure before drawing conclusions.", rows: missed, kind: "missed" }] : []),
  ];
  if (!observations.length) return <p className="text-xs text-muted-foreground">{metrics.length ? "No unusually slow first replies or closures without a human reply found in this sample." : "Observations will appear as conversations arrive."}</p>;
  return <section aria-label="Support observations" className="grid gap-5 xl:grid-cols-2">{observations.map((observation) => <Panel key={observation.kind}>
    <PanelHeader title={observation.title} description={observation.text} />
    <PanelBody>
      <details className="group">
        <summary className="w-fit cursor-pointer text-[13px] font-medium text-brand-ink">Review {observation.rows.length === 1 ? "conversation" : `${observation.rows.length} conversations`}</summary>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{observation.rule}</p>
        <ul className="mt-3 max-h-56 divide-y overflow-y-auto">{observation.rows.map((row) => <li key={`${row.customer_id}-${row.gen}`}><Link href={`/conversations/${row.customer_id}#message-${parseTs(row.started_at).getTime()}`} className="flex items-center justify-between gap-3 rounded-md py-3 text-[13px] hover:text-brand-ink">
          <span className="min-w-0"><span className="block truncate font-medium">{row.customer_name || "Unknown customer"}</span><span className="text-xs text-muted-foreground">Started {time(row.started_at)} IST</span></span>
          <span className="flex shrink-0 items-center gap-2 text-xs">{observation.kind === "slow" ? duration(row.frt_seconds) : "Review closure"}<ArrowUpRight className="size-3.5" aria-hidden /></span>
        </Link></li>)}</ul>
      </details>
    </PanelBody>
  </Panel>)}</section>;
}
