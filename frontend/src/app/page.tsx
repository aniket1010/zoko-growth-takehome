import Link from "next/link";
import { ArrowRight, CircleCheck, Clock, MessageCircle, Star, Timer, Users } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Funnel, InlineBar, MixBar } from "@/components/charts";
import { Page, PageHeader, Panel, PanelBody, PanelHeader } from "@/components/panel";
import { RefreshButton } from "@/components/refresh-button";
import { EmptyState, ErrorState } from "@/components/states";
import { Stat } from "@/components/stat";
import { StatusDot, StatusPill, statusText } from "@/components/status";
import { api, type AgentRow, type AttentionRow, type Overview } from "@/lib/api";
import { duration, EMPTY, percent, phone, time } from "@/lib/format";
import { csatStatus, frtStatus, ratioStatus, resolutionStatus, TARGETS, waitStatus, type Status } from "@/lib/targets";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const verdictWord: Record<Status, string> = { good: "On target", warning: "Slipping", bad: "Off target", none: "No data yet" };

export default async function Dashboard() {
  let data: [Overview, AgentRow[], AttentionRow[]];
  try {
    data = await Promise.all([api.overview(), api.agents(), api.attention()]);
  } catch (e) {
    return (
      <Page>
        <PageHeader eyebrow="Support intelligence" title="Dashboard" action={<RefreshButton />} />
        <ErrorState error={e instanceof Error ? e.message : String(e)} />
      </Page>
    );
  }
  const [o, agents, attention] = data;

  // Sample sizes behind the medians, so a "good" number from two chats reads as the small sample it is.
  const frtSample = agents.reduce((n, a) => n + a.replied_conversations, 0);
  const resolutionSample = agents.reduce((n, a) => n + a.closed_conversations, 0);

  const longestWait = attention.reduce((m, a) => Math.max(m, a.waiting_seconds), 0);
  const checks: { label: string; status: Status }[] = [
    { label: "Waiting customers", status: attention.length ? waitStatus(longestWait) : "good" },
    { label: "First response", status: frtStatus(o.median_frt_seconds) },
    { label: "Resolution", status: resolutionStatus(o.median_resolution_seconds) },
    { label: "CSAT", status: csatStatus(o.csat_avg) },
    { label: "Closed without reply", status: ratioStatus(o.closed_without_reply, o.closed, TARGETS.closedWithoutReply) },
  ];
  const judged = checks.filter((c) => c.status !== "none");
  const met = judged.filter((c) => c.status === "good").length;
  const overall: Status = judged.some((c) => c.status === "bad") ? "bad" : judged.some((c) => c.status === "warning") ? "warning" : judged.length ? "good" : "none";
  const overallWord = { good: "On track", warning: "Worth a look", bad: "Needs attention", none: "Waiting for data" }[overall];

  const frt = frtStatus(o.median_frt_seconds);
  const res = resolutionStatus(o.median_resolution_seconds);
  const csat = csatStatus(o.csat_avg);
  const cwr = ratioStatus(o.closed_without_reply, o.closed, TARGETS.closedWithoutReply);
  const open = o.conversations - o.closed;

  return (
    <Page>
      <PageHeader
        eyebrow="Support intelligence"
        title="Dashboard"
        description={`All store conversations since the webhook went live. Updated ${time(new Date().toISOString())} IST.`}
        action={<RefreshButton />}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <StatusPill status={overall} className="h-6 px-2.5 text-xs">
            {overallWord}
          </StatusPill>
          <p className="text-[13px] text-muted-foreground">
            {judged.length ? `${met} of ${judged.length} checks on target` : "No checks yet"}
            {attention.length ? (
              <>
                {" · "}
                <span className="font-medium text-bad">
                  {attention.length} {attention.length === 1 ? "customer is" : "customers are"} waiting for a human reply
                </span>
              </>
            ) : (
              " · nobody is waiting"
            )}
          </p>
        </div>
      </PageHeader>

      <AttentionPanel rows={attention} />

      <section aria-label="Key numbers" className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
        <Stat
          icon={<Timer className="size-3.5" aria-hidden />}
          label="First response time"
          value={duration(o.median_frt_seconds)}
          unit="median"
          status={frt}
          verdict={verdictWord[frt]}
          target={`Target ≤ ${duration(TARGETS.frt.good)} · average ${duration(o.avg_frt_seconds)}`}
          sub={sampleLine(frtSample, "replied chat")}
        />
        <Stat
          icon={<CircleCheck className="size-3.5" aria-hidden />}
          label="Resolution time"
          value={duration(o.median_resolution_seconds)}
          unit="median"
          status={res}
          verdict={verdictWord[res]}
          target={`Target ≤ ${duration(TARGETS.resolution.good)} · average ${duration(o.avg_resolution_seconds)}`}
          sub={sampleLine(resolutionSample, "resolved chat")}
        />
        <Stat
          icon={<Star className="size-3.5" aria-hidden />}
          label="Customer satisfaction"
          value={o.csat_avg != null ? o.csat_avg.toFixed(1) : EMPTY}
          unit="/ 5"
          status={csat}
          verdict={csat === "none" ? "No answers yet" : csat === "good" ? "On target" : "Below target"}
          target={`Target ≥ ${TARGETS.csat.good.toFixed(1)}`}
          sub={sampleLine(o.csat_received, "survey answer")}
        />
        <Stat
          icon={<MessageCircle className="size-3.5" aria-hidden />}
          label="Closed without a reply"
          value={o.closed_without_reply}
          unit={o.closed ? `of ${o.closed} closed` : undefined}
          status={cwr}
          verdict={cwr === "none" ? "Nothing closed yet" : cwr === "good" ? "None missed" : `${percent(o.closed_without_reply, o.closed)} missed`}
          target="Target: every closed chat got a human reply"
          sub="Closed before any agent answered"
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel className="lg:col-span-3">
          <PanelHeader
            title="Conversation funnel"
            description="How far conversations get, from first message to a rating."
          />
          <PanelBody>
            {o.conversations ? (
              <Funnel
                stages={[
                  { label: "Conversations", value: o.conversations, of: "conversations", note: `${o.customers_with_messages} ${o.customers_with_messages === 1 ? "customer" : "customers"}` },
                  {
                    label: "Closed",
                    of: "closed chats",
                    value: o.closed,
                    note: o.closed_without_reply ? `${o.closed_without_reply} closed with no human reply` : undefined,
                  },
                  { label: "CSAT asked", value: o.csat_asked, of: "surveys sent" },
                  {
                    label: "CSAT received",
                    value: o.csat_received,
                    note: o.csat_avg != null ? `average ${o.csat_avg.toFixed(1)} / 5` : undefined,
                  },
                ]}
              />
            ) : (
              <EmptyState title="No conversations yet">The funnel fills in as soon as Zoko sends the first message to the webhook.</EmptyState>
            )}
          </PanelBody>
        </Panel>

        <Panel className="lg:col-span-2">
          <PanelHeader title="Who is talking" description={`${o.total_messages} messages across ${o.customers_with_messages} ${o.customers_with_messages === 1 ? "customer" : "customers"}.`} />
          <PanelBody className="space-y-4">
            <MixBar
              total={o.total_messages}
              parts={[
                { key: "customer", label: "Customers", value: o.customer_messages, swatch: "bg-series-customer" },
                { key: "bot", label: "AI assistant", value: o.bot_messages, swatch: "bg-series-bot" },
                { key: "agent", label: "Agents", value: o.agent_messages, swatch: "bg-series-agent" },
              ]}
            />
            <dl className="grid grid-cols-3 gap-2 border-t pt-3">
              <MiniStat label="Open now" value={open} />
              <MiniStat
                label="Reassigned"
                value={o.reassigned}
                sub={percent(o.reassigned, o.conversations)}
                status={ratioStatus(o.reassigned, o.conversations, TARGETS.reassigned)}
              />
              <MiniStat label="AI share of replies" value={percent(o.bot_messages, o.bot_messages + o.agent_messages)} />
            </dl>
            <p className="text-xs text-muted-foreground">Response and resolution times count human agents only; AI assistant replies are excluded.</p>
          </PanelBody>
        </Panel>
      </div>

      <AgentsPanel agents={agents} />

      <CustomersPanel rows={o.messages_per_customer} />
    </Page>
  );
}

function MiniStat({ label, value, sub, status }: { label: string; value: React.ReactNode; sub?: string; status?: Status }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-xs text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-1.5 text-[13px] font-semibold tabular-nums">
        {status && status !== "none" ? <StatusDot status={status} label={verdictWord[status]} /> : null}
        {value}
        {sub ? <span className="font-normal text-muted-foreground">{sub}</span> : null}
      </dd>
    </div>
  );
}

function sampleLine(n: number, noun: string) {
  const text = `Based on ${n} ${noun}${n === 1 ? "" : "s"}`;
  return n > 0 && n < TARGETS.smallSample ? `${text} · small sample` : text;
}

function AttentionPanel({ rows }: { rows: AttentionRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-good/25 bg-good-soft px-4 py-3">
        <CircleCheck className="size-4 shrink-0 text-good" aria-hidden />
        <p className="text-[13px]">
          <span className="font-medium text-good">Nobody is waiting.</span>{" "}
          <span className="text-muted-foreground">Every open conversation has a human reply.</span>
        </p>
      </div>
    );
  }
  const shown = rows.slice(0, 6);
  return (
    <Panel className="overflow-hidden border-bad/35" aria-labelledby="attention-title">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-bad/20 bg-bad-soft px-4 py-2.5">
        <h2 id="attention-title" className="flex items-center gap-2 text-sm font-semibold">
          <span className="relative flex size-2" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-bad opacity-60 motion-reduce:hidden" />
            <span className="relative inline-flex size-2 rounded-full bg-bad" />
          </span>
          Needs attention now
          <span className="rounded-full bg-bad px-1.5 text-[11px] leading-5 font-semibold text-white tabular-nums">{rows.length}</span>
        </h2>
        <p className="text-xs text-muted-foreground">Open chats with no human reply, longest wait first. Target first reply {"≤"} {duration(TARGETS.frt.good)}.</p>
      </header>
      <ul className="divide-y">
        {shown.map((a) => {
          const s = waitStatus(a.waiting_seconds);
          const over = a.waiting_seconds - TARGETS.frt.good;
          return (
            <li key={a.customer_id}>
              <Link
                href={`/conversations/${a.customer_id}`}
                className="group flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
              >
                <div className="flex min-w-0 flex-1 basis-56 items-center gap-3">
                  <Avatar name={a.customer_name} />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium">{a.customer_name ?? "Unknown customer"}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">{phone(a.phone)}</p>
                  </div>
                </div>
                <div className="min-w-0 basis-32 text-xs">
                  <p className="text-muted-foreground">Assigned to</p>
                  {a.assignee_name ? (
                    <p className="truncate text-[13px]">{a.assignee_name}</p>
                  ) : (
                    <p className="text-[13px] font-medium text-warning">Unassigned</p>
                  )}
                </div>
                <div className="min-w-0 basis-60 text-xs">
                  <p className="text-muted-foreground">Waiting since {time(a.started_at)}</p>
                  <p className="text-[13px] text-muted-foreground">{a.message_count} {a.message_count === 1 ? "message" : "messages"} unanswered</p>
                </div>
                <div className="ml-auto flex items-center gap-3">
                  <div className="text-right">
                    <p className={cn("text-lg leading-tight font-semibold", statusText[s])}>
                      <Clock className="mr-1 inline size-4 align-[-2px]" aria-hidden />
                      {duration(a.waiting_seconds)}
                    </p>
                    <p className="text-xs text-muted-foreground">{over > 0 ? `${duration(over)} over target` : "within target"}</p>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      {rows.length > shown.length ? (
        <div className="border-t px-4 py-2 text-xs text-muted-foreground">
          And {rows.length - shown.length} more.{" "}
          <Link href="/conversations?status=waiting" className="font-medium text-brand-ink hover:underline">
            See all waiting
          </Link>
        </div>
      ) : null}
    </Panel>
  );
}

type Metric = "median_frt_seconds" | "median_resolution_seconds" | "csat_avg";

/** Best and worst agent per metric, only when at least two agents have a value and they differ. */
function extremes(agents: AgentRow[], key: Metric, higherBetter: boolean) {
  const vals = agents.filter((a) => a[key] != null).map((a) => ({ id: a.id, v: a[key] as number }));
  if (vals.length < 2) return { best: null, worst: null };
  const sorted = [...vals].sort((x, y) => (higherBetter ? y.v - x.v : x.v - y.v));
  if (sorted[0].v === sorted[sorted.length - 1].v) return { best: null, worst: null };
  return { best: sorted[0].id, worst: sorted[sorted.length - 1].id };
}

function Rank({ kind }: { kind: "best" | "worst" | null }) {
  if (!kind) return null;
  return (
    <span className={cn("ml-1.5 rounded px-1 text-[10px] font-semibold uppercase", kind === "best" ? "bg-good-soft text-good" : "bg-bad-soft text-bad")}>
      {kind === "best" ? "Best" : "Worst"}
    </span>
  );
}

function MetricCell({
  value,
  n,
  status,
  rank,
  className,
}: {
  value: string;
  n?: number;
  status: Status;
  rank: "best" | "worst" | null;
  className?: string;
}) {
  const small = n != null && n > 0 && n < TARGETS.smallSample;
  return (
    <td className={cn("px-3 py-2.5 text-right whitespace-nowrap", className)}>
      <span className="inline-flex items-center justify-end gap-1.5">
        {status !== "none" ? <StatusDot status={status} label={verdictWord[status]} /> : null}
        <span className={cn("font-medium tabular-nums", status === "none" && "text-muted-foreground")}>{value}</span>
        {n != null ? (
          <span className={cn("text-xs text-muted-foreground tabular-nums", small && "underline decoration-dotted underline-offset-2")} title={small ? "Small sample" : undefined}>
            ({n})
          </span>
        ) : null}
        <Rank kind={rank} />
      </span>
    </td>
  );
}

function AgentsPanel({ agents }: { agents: AgentRow[] }) {
  const frtX = extremes(agents, "median_frt_seconds", false);
  const resX = extremes(agents, "median_resolution_seconds", false);
  const csatX = extremes(agents, "csat_avg", true);
  const rank = (x: { best: string | null; worst: string | null }, id: string) => (x.best === id ? "best" : x.worst === id ? "worst" : null);
  const sorted = [...agents].sort((a, b) => b.messages_sent - a.messages_sent);

  return (
    <Panel>
      <PanelHeader
        icon={<Users className="size-4 text-muted-foreground" aria-hidden />}
        title="Agents"
        description="FRT goes to the agent who replied first, resolution to the owner at close, a reassignment to the agent it was taken from."
      />
      {agents.length === 0 ? (
        <PanelBody>
          <EmptyState title="No agent activity yet">Agents appear here after their first reply in Zoko.</EmptyState>
        </PanelBody>
      ) : (
        <>
          <div className="overflow-x-auto border-t">
            <table className="w-full min-w-[760px] text-[13px]">
              <thead className="bg-muted/50">
                <tr className="border-b text-left">
                  <th className="px-4 py-2 label-caps">Agent</th>
                  <th className="px-3 py-2 text-right label-caps">Messages</th>
                  <th className="px-3 py-2 text-right label-caps">FRT median (chats)</th>
                  <th className="px-3 py-2 text-right label-caps">Resolution median (chats)</th>
                  <th className="px-3 py-2 text-right label-caps">CSAT (answers)</th>
                  <th className="px-3 py-2 text-right label-caps">Reassigned away</th>
                  <th className="px-4 py-2 text-right label-caps">Averages FRT / res.</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sorted.map((a) => (
                  <tr key={a.id} className="hover:bg-muted/40">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={a.name} className="size-7 text-[10px]" />
                        <div className="min-w-0">
                          <p className="font-medium">{a.name}</p>
                          {a.email ? <p className="max-w-56 truncate text-xs text-muted-foreground">{a.email}</p> : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{a.messages_sent}</td>
                    <MetricCell value={duration(a.median_frt_seconds)} n={a.replied_conversations} status={frtStatus(a.median_frt_seconds)} rank={rank(frtX, a.id)} />
                    <MetricCell
                      value={duration(a.median_resolution_seconds)}
                      n={a.closed_conversations}
                      status={resolutionStatus(a.median_resolution_seconds)}
                      rank={rank(resX, a.id)}
                    />
                    <MetricCell value={a.csat_avg != null ? `${a.csat_avg.toFixed(1)} / 5` : EMPTY} n={a.csat_received} status={csatStatus(a.csat_avg)} rank={rank(csatX, a.id)} />
                    <td className={cn("px-3 py-2.5 text-right tabular-nums", a.reassigned_chats > 0 && "font-medium text-warning")}>{a.reassigned_chats}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                      {duration(a.avg_frt_seconds)} / {duration(a.avg_resolution_seconds)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">
            Numbers in brackets are how many chats or answers each median is based on; dotted ones are under {TARGETS.smallSample}, too few to compare.
            {agents.length < 2 ? " Best and worst tags appear once two or more agents have data." : ""}
          </p>
        </>
      )}
    </Panel>
  );
}

function CustomersPanel({ rows }: { rows: Overview["messages_per_customer"] }) {
  const max = Math.max(0, ...rows.map((r) => r.messages));
  return (
    <Panel>
      <PanelHeader title="Messages per customer" description="Long threads often mean a problem that took too long to solve." />
      {rows.length === 0 ? (
        <PanelBody>
          <EmptyState title="No customers yet">Customers appear here after their first message.</EmptyState>
        </PanelBody>
      ) : (
        <ul className="divide-y border-t">
          {rows.map((c) => (
            <li key={c.id}>
              <Link
                href={`/conversations/${c.id}`}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-4 py-2.5 transition-colors hover:bg-muted/40 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_7rem]"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <Avatar name={c.name} className="size-7 text-[10px]" />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium">{c.name ?? "Unknown"}</span>
                    <span className="block truncate font-mono text-xs text-muted-foreground">{phone(c.phone)}</span>
                  </span>
                </span>
                <span className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto">
                  <InlineBar value={c.messages} max={max} />
                </span>
                <span className="text-right text-xs text-muted-foreground">
                  <span className="text-[13px] font-semibold text-foreground tabular-nums">{c.messages}</span> msgs
                  <span className="block">{c.from_customer} from customer</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
