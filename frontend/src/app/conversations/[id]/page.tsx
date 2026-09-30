import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bot, Check, CheckCheck, CircleAlert, CircleCheck, Clock, FileText, Star, UserPlus } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Panel } from "@/components/panel";
import { SendBox } from "@/components/send-box";
import { StatusPill } from "@/components/status";
import { api, type AgentRow, type AttentionRow, type ChatEventRow, type ConversationRow, type CustomerDetail, type MessageRow } from "@/lib/api";
import { clock, day, duration, EMPTY, parseTs, phone, time } from "@/lib/format";
import { waitStatus } from "@/lib/targets";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Item = { at: Date; message?: MessageRow; event?: ChatEventRow };

export default async function ConversationPage({ params }: PageProps<"/conversations/[id]">) {
  const { id } = await params;
  let customer: CustomerDetail, messages: MessageRow[], events: ChatEventRow[];
  try {
    [customer, messages, events] = await Promise.all([api.customer(id), api.messages(id), api.events(id)]);
  } catch {
    notFound();
  }

  // Nice-to-have context. The page still renders if any of these fail.
  const [convRes, attRes, agentRes] = await Promise.allSettled([api.conversations(), api.attention(), api.agents()]);
  const row: ConversationRow | undefined = convRes.status === "fulfilled" ? convRes.value.find((c) => c.id === id) : undefined;
  const waiting: AttentionRow | undefined = attRes.status === "fulfilled" ? attRes.value.find((a) => a.customer_id === id) : undefined;
  const agentByEmail = new Map<string, AgentRow>(
    agentRes.status === "fulfilled" ? agentRes.value.filter((a) => a.email).map((a) => [a.email!.toLowerCase(), a]) : [],
  );
  const agentName = (m: MessageRow) => (m.agentEmail ? (agentByEmail.get(m.agentEmail.toLowerCase())?.name ?? m.agentEmail) : "Agent");

  // One timeline: messages plus "assigned to" / "closed by" markers.
  const items: Item[] = [
    ...messages.map((m) => ({ at: parseTs(m.sentAt), message: m })),
    ...events.map((e) => ({ at: parseTs(e.event_at), event: e })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  const fromCustomer = messages.filter((m) => m.direction === "FROM_CUSTOMER").length;
  const fromBot = messages.filter((m) => m.direction === "FROM_STORE" && m.senderType === "bot").length;
  const fromAgents = messages.length - fromCustomer - fromBot;
  const csatAnswers = messages.filter((m) => m.direction === "FROM_CUSTOMER" && m.replyToTemplate);
  const closes = events.filter((e) => e.kind === "closed").length;

  // Flatten into one keyed list with a day separator whenever the IST date changes.
  const timeline: React.ReactNode[] = [];
  let lastDay = "";
  items.forEach((it, i) => {
    const d = day(it.at.toISOString());
    if (d !== lastDay) {
      timeline.push(
        <div key={`d${i}`} className="flex justify-center py-1">
          <span className="rounded-full border bg-card px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">{d}</span>
        </div>,
      );
      lastDay = d;
    }
    if (it.event) timeline.push(<EventMarker key={`e${i}`} event={it.event} />);
    else if (it.message) timeline.push(<Bubble key={it.message.id} m={it.message} agentName={agentName(it.message)} />);
  });

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-5 md:px-6 md:py-6">
      <Link href="/conversations" className="mb-3 inline-flex items-center gap-1 text-[13px] text-brand-ink hover:underline">
        <ArrowLeft className="size-3.5" aria-hidden />
        All conversations
      </Link>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Panel className="flex flex-col overflow-hidden">
          <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar name={customer.name} className="size-9" />
              <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold">{customer.name ?? "Unknown customer"}</h1>
                <p className="text-xs text-muted-foreground">
                  <span className="font-mono whitespace-nowrap">{phone(customer.phone)}</span> {"·"}{" "}
                  <span className="whitespace-nowrap">Assigned to {customer.assignee_name || "nobody"}</span>
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {waiting ? (
                <StatusPill status={waitStatus(waiting.waiting_seconds)}>Waiting {duration(waiting.waiting_seconds)}</StatusPill>
              ) : null}
              {row ? (
                row.is_closed ? (
                  <span className="inline-flex h-5 items-center rounded-full bg-muted px-2 text-[11px] font-medium text-muted-foreground">Closed</span>
                ) : (
                  <span className="inline-flex h-5 items-center gap-1 rounded-full bg-brand-soft px-2 text-[11px] font-medium text-brand-ink">
                    <span className="size-1.5 rounded-full bg-brand" aria-hidden />
                    Open
                  </span>
                )
              ) : null}
            </div>
          </header>

          {waiting ? (
            <div className="flex items-center gap-2 border-b border-bad/20 bg-bad-soft px-4 py-2 text-[13px]">
              <Clock className="size-3.5 shrink-0 text-bad" aria-hidden />
              <span>
                <span className="font-medium text-bad">No human reply yet.</span>{" "}
                <span className="text-muted-foreground">
                  The customer has waited {duration(waiting.waiting_seconds)} since {time(waiting.started_at)}.
                </span>
              </span>
            </div>
          ) : null}

          <div className="space-y-2.5 bg-background/60 px-3 py-4 sm:px-5" aria-label="Messages">
            {items.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-muted-foreground">No messages since the webhook went live.</p>
            ) : null}
            {timeline}
          </div>

          <div className="border-t bg-card px-4 py-3">
            <SendBox customerId={customer.id} />
          </div>
        </Panel>

        <aside className="space-y-4">
          <Panel>
            <div className="border-b px-4 py-2.5 label-caps">Conversation</div>
            <dl className="divide-y text-[13px]">
              <Row label="Status" value={row ? (row.is_closed ? "Closed" : "Open") : EMPTY} />
              <Row label="Assigned to" value={customer.assignee_name || "Nobody"} />
              <Row label="Phone" value={<span className="font-mono text-xs">{phone(customer.phone)}</span>} />
              <Row label="First message" value={messages.length ? time(messages[0].sentAt) : EMPTY} />
              <Row label="Last message" value={messages.length ? time(messages[messages.length - 1].sentAt) : EMPTY} />
              <Row label="Times closed" value={closes} />
            </dl>
          </Panel>
          <Panel>
            <div className="border-b px-4 py-2.5 label-caps">Messages</div>
            <dl className="divide-y text-[13px]">
              <Row label="Customer" value={fromCustomer} swatch="bg-series-customer" />
              <Row label="AI assistant" value={fromBot} swatch="bg-series-bot" />
              <Row label="Agents" value={fromAgents} swatch="bg-series-agent" />
              <Row label="Total" value={<span className="font-semibold">{messages.length}</span>} />
            </dl>
          </Panel>
          <Panel>
            <div className="border-b px-4 py-2.5 label-caps">CSAT answers</div>
            {csatAnswers.length ? (
              <ul className="divide-y text-[13px]">
                {csatAnswers.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-2">
                    <Stars value={Number(m.postback ?? m.text)} />
                    <span className="text-xs text-muted-foreground">{time(m.sentAt)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-3 text-[13px] text-muted-foreground">No rating from this customer yet.</p>
            )}
          </Panel>
        </aside>
      </div>
    </main>
  );
}

function Row({ label, value, swatch }: { label: string; value: React.ReactNode; swatch?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2">
      <dt className="flex items-center gap-2 text-muted-foreground">
        {swatch ? <span className={cn("size-2 rounded-[2px]", swatch)} aria-hidden /> : null}
        {label}
      </dt>
      <dd className="min-w-0 truncate text-right tabular-nums">{value}</dd>
    </div>
  );
}

function Stars({ value }: { value: number }) {
  const v = Number.isFinite(value) ? Math.max(0, Math.min(5, Math.round(value))) : 0;
  return (
    <span className="inline-flex items-center gap-1.5" aria-label={`${v} out of 5`}>
      <span className="inline-flex" aria-hidden>
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} className={cn("size-3.5", n <= v ? "fill-warning text-warning" : "text-muted-foreground/40")} />
        ))}
      </span>
      <span className="font-medium tabular-nums">{v} / 5</span>
    </span>
  );
}

function EventMarker({ event }: { event: ChatEventRow }) {
  const closed = event.kind === "closed";
  const Icon = closed ? CircleCheck : UserPlus;
  return (
    <div className="flex justify-center">
      <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-[11px] text-muted-foreground">
        <Icon className="size-3 shrink-0" aria-hidden />
        <span className="truncate">
          {closed ? (
            <>
              Closed by <span className="font-medium text-foreground">{event.agent_name ?? event.closed_by_type ?? "system"}</span>
            </>
          ) : (
            <>
              Assigned to <span className="font-medium text-foreground">{event.agent_name ?? "nobody"}</span>
            </>
          )}
        </span>
        <span aria-hidden>{"·"}</span>
        <span className="shrink-0">{clock(event.event_at)}</span>
      </span>
    </div>
  );
}

type Template = { header?: string; body?: string; footer?: string; buttons: string[] };

/** Template messages arrive flattened as "Body: ...\nFooter: ...\nButtons: [1] 1, [2] 2". */
function parseTemplate(text: string | null): Template | null {
  if (!text || !/^(Header|Body):/m.test(text)) return null;
  const t: Template = { buttons: [] };
  for (const line of text.split("\n")) {
    const m = line.match(/^(Header|Body|Footer|Buttons):\s*(.*)$/);
    if (!m) {
      if (t.body != null && line.trim()) t.body += `\n${line}`;
      continue;
    }
    const [, key, val] = m;
    if (key === "Buttons") t.buttons = val.split(/,\s*(?=\[)/).map((b) => b.replace(/^\[[^\]]*\]\s*/, "").trim()).filter(Boolean);
    else if (key === "Header") t.header = val;
    else if (key === "Body") t.body = val;
    else t.footer = val;
  }
  return t;
}

function Ticks({ status }: { status: string | null }) {
  if (!status) return null;
  const s = status.toLowerCase();
  const label = `Delivery: ${status}`;
  if (s === "read" || s === "seen") return <CheckCheck className="size-3.5 text-tick-seen" aria-label={label} role="img" />;
  if (s === "delivered") return <CheckCheck className="size-3.5" aria-label={label} role="img" />;
  if (s === "sent") return <Check className="size-3.5" aria-label={label} role="img" />;
  if (s === "failed" || s === "undelivered" || s === "error")
    return (
      <span className="inline-flex items-center gap-0.5 text-bad">
        <CircleAlert className="size-3.5" aria-hidden />
        {status}
      </span>
    );
  return <span>{status}</span>;
}

function Bubble({ m, agentName }: { m: MessageRow; agentName: string }) {
  const fromStore = m.direction === "FROM_STORE";
  const bot = fromStore && m.senderType === "bot";
  const csat = !fromStore && m.replyToTemplate;
  const tpl = fromStore ? parseTemplate(m.text) : null;

  return (
    <div className={cn("flex", fromStore ? "justify-end" : "justify-start")}>
      <div className={cn("flex max-w-[85%] flex-col gap-1 sm:max-w-[70%]", fromStore ? "items-end" : "items-start")}>
        {fromStore ? (
          <span className={cn("flex items-center gap-1 px-1 text-[11px] font-medium", bot ? "text-bot-ink" : "text-muted-foreground")}>
            {bot ? <Bot className="size-3.5" aria-hidden /> : null}
            {bot ? "AI assistant" : agentName}
            {m.templateName ? (
              <span className="inline-flex items-center gap-0.5 font-normal text-muted-foreground">
                {"·"} <FileText className="size-3" aria-hidden /> {m.templateName}
              </span>
            ) : null}
          </span>
        ) : null}

        <div
          className={cn(
            "rounded-xl border px-3 py-2 text-[13px] leading-relaxed",
            fromStore ? "rounded-tr-sm" : "rounded-tl-sm",
            !fromStore && "border-border bg-bubble-customer",
            fromStore && !bot && "border-brand-line bg-bubble-agent",
            bot && "border-dashed border-bot-ink/30 bg-bubble-bot",
            csat && "border-warning/40",
          )}
        >
          {csat ? (
            <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-warning">
              <Star className="size-3 fill-current" aria-hidden />
              CSAT answer
            </p>
          ) : null}

          {tpl ? (
            <div className="space-y-1.5">
              {tpl.header ? <p className="font-semibold">{tpl.header}</p> : null}
              {tpl.body ? <p className="break-words whitespace-pre-wrap">{tpl.body}</p> : null}
              {tpl.footer ? <p className="text-xs text-muted-foreground">{tpl.footer}</p> : null}
              {tpl.buttons.length ? (
                <div className="flex flex-wrap gap-1 pt-1">
                  {tpl.buttons.map((b, i) => (
                    <span key={i} className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-brand-line bg-card px-2 text-xs font-medium text-brand-ink">
                      {b}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : csat ? (
            <Stars value={Number(m.postback ?? m.text)} />
          ) : (
            <p className="break-words whitespace-pre-wrap">{m.text || <em className="text-muted-foreground">[{m.type ?? "message"}]</em>}</p>
          )}

          <div className="mt-1 flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
            <time dateTime={m.sentAt} title={time(m.sentAt)}>
              {clock(m.sentAt)}
            </time>
            {fromStore ? <Ticks status={m.deliveryStatus} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
