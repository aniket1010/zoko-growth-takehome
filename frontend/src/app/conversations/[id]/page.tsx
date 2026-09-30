import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bot, Check, CheckCheck, CircleAlert, Clock, FileText, Star } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Page, Panel } from "@/components/panel";
import { RefreshButton } from "@/components/refresh-button";
import { SendBox } from "@/components/send-box";
import { api, type MessageRow } from "@/lib/api";
import { clock, day, parseTs, phone, time } from "@/lib/format";
import { parseTemplate } from "@/lib/support";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ConversationPage({ params }: PageProps<"/conversations/[id]">) {
  const { id } = await params;
  const [customerResult, messageResult, agentResult] = await Promise.allSettled([api.customer(id), api.messages(id), api.agents()]);
  if (customerResult.status === "rejected" || messageResult.status === "rejected") notFound();
  const customer = customerResult.value;
  const messages = [...messageResult.value].sort((a, b) => parseTs(a.sentAt).getTime() - parseTs(b.sentAt).getTime());
  const agents = agentResult.status === "fulfilled" ? agentResult.value : [];
  const byEmail = new Map(agents.filter((a) => a.email).map((a) => [a.email!.toLowerCase(), a.name]));
  const byId = new Map(agents.map((a) => [a.id, a.name]));
  const sender = (m: MessageRow) => m.direction === "FROM_CUSTOMER" ? customer.name || "Customer" : m.senderType === "bot" ? "AI assistant" : (m.agentId ? byId.get(m.agentId) : undefined) || (m.agentEmail ? byEmail.get(m.agentEmail.toLowerCase()) || m.agentEmail : "Agent");
  const assigned = byEmail.get(customer.assignee_name?.toLowerCase() ?? "") || customer.assignee_name || "nobody";
  return <Page className="max-w-5xl">
    <div className="flex flex-wrap items-center justify-between gap-3"><Link href="/conversations" className="inline-flex min-h-10 items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" aria-hidden />All conversations</Link><RefreshButton /></div>
    <Panel className="flex flex-col overflow-hidden">
      <header className="flex items-center gap-3 border-b p-5 sm:p-6">
        <Avatar name={customer.name} className="size-10" />
        <div className="min-w-0"><h1 className="truncate text-lg font-semibold tracking-tight">{customer.name || "Unknown customer"}</h1><p className="mt-1 text-xs leading-relaxed text-muted-foreground"><span className="font-mono">{phone(customer.phone)}</span> · Assigned to <span className="[overflow-wrap:anywhere]">{assigned}</span></p></div>
      </header>
      <div className="min-h-80 space-y-4 bg-background/60 px-4 py-6 sm:px-6" aria-label="Messages">
        {!messages.length ? <p className="py-10 text-center text-sm text-muted-foreground">No messages since collection began.</p> : messages.map((m, index) => <div key={m.id}>
          {index === 0 || day(messages[index - 1].sentAt) !== day(m.sentAt) ? <div className="my-6 flex items-center gap-4"><span className="h-px flex-1 bg-border" /><span className="text-[11px] font-medium text-muted-foreground">{day(m.sentAt)}</span><span className="h-px flex-1 bg-border" /></div> : null}
          <Bubble m={m} sender={sender(m)} />
        </div>)}
      </div>
      <div className="border-t bg-card p-5 sm:p-6"><SendBox customerId={customer.id} /></div>
    </Panel>
    <p className="text-center text-xs text-muted-foreground">{messages.length} messages · Times in IST</p>
  </Page>;
}

function Delivery({ status }: { status: string | null }) {
  if (!status) return null;
  const normalized = status.toLowerCase();
  const failed = ["failed", "undelivered", "error"].includes(normalized);
  const read = ["read", "seen"].includes(normalized);
  const Icon = failed ? CircleAlert : read || normalized === "delivered" ? CheckCheck : normalized === "sent" ? Check : Clock;
  return <span className={cn("inline-flex items-center gap-1", failed && "text-bad", read && "text-tick-seen")} title={`Delivery: ${status}`}>
    <Icon className="size-3.5" aria-hidden /><span className={failed ? "" : "sr-only"}>Delivery: {status}</span>
  </span>;
}

function Bubble({ m, sender }: { m: MessageRow; sender: string }) {
  const fromStore = m.direction === "FROM_STORE";
  const bot = fromStore && m.senderType === "bot";
  const template = fromStore ? parseTemplate(m.text) : null;
  const rating = m.replyToTemplate && /^[1-5]$/.test(m.postback ?? m.text ?? "") ? Number(m.postback ?? m.text) : null;
  return <div id={`message-${parseTs(m.sentAt).getTime()}`} className={cn("flex scroll-mt-40 rounded-lg target:outline-2 target:outline-offset-4 target:outline-ring", fromStore ? "justify-end" : "justify-start")}>
    <div className={cn("min-w-0 max-w-[90%] rounded-xl border px-4 py-3 text-sm leading-relaxed sm:max-w-[75%]", fromStore ? "rounded-tr-sm border-brand-line bg-bubble-agent" : "rounded-tl-sm bg-bubble-customer", bot && "border-border bg-bubble-bot")}>
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground [overflow-wrap:anywhere]">{bot ? <Bot className="size-3.5 shrink-0" aria-hidden /> : null}{sender}{template ? <FileText className="size-3 shrink-0" aria-label="Template message" role="img" /> : null}</p>
      {template ? <div className="space-y-2 [overflow-wrap:anywhere]">
        {template.header ? <p className="font-semibold whitespace-pre-wrap">{template.header}</p> : null}
        {template.body ? <p className="whitespace-pre-wrap">{template.body}</p> : null}
        {template.footer ? <p className="text-xs whitespace-pre-wrap text-muted-foreground">{template.footer}</p> : null}
        {template.buttons.length ? <div className="flex flex-wrap gap-1.5 border-t border-brand-line pt-3" aria-label="Template reply options">{template.buttons.map((button, index) => <span key={index} className="rounded-md border border-brand-line bg-card px-3 py-1 text-xs font-medium text-brand-ink">{button}</span>)}</div> : null}
      </div> : rating != null ? <p className="flex items-center gap-2"><Star className="size-4 fill-warning text-warning" aria-hidden /><span className="font-medium">{rating} / 5</span><span className="text-xs text-muted-foreground">Customer rating</span></p> : <p className="[overflow-wrap:anywhere] whitespace-pre-wrap">{m.text || <em className="text-muted-foreground">[{m.type ?? "message"}]</em>}</p>}
      <div className="mt-2 flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground"><time dateTime={parseTs(m.sentAt).toISOString()} title={`${time(m.sentAt)} IST`}>{clock(m.sentAt)}</time>{fromStore ? <Delivery status={m.deliveryStatus} /> : null}</div>
    </div>
  </div>;
}
