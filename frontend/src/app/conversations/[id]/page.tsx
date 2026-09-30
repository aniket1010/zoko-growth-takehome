import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Page, Panel } from "@/components/panel";
import { SendBox } from "@/components/send-box";
import { api, type CustomerDetail, type MessageRow } from "@/lib/api";
import { phone, time } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ConversationPage({ params }: PageProps<"/conversations/[id]">) {
  const { id } = await params;
  let customer: CustomerDetail, messages: MessageRow[];
  try {
    [customer, messages] = await Promise.all([api.customer(id), api.messages(id)]);
  } catch {
    notFound();
  }

  return (
    <Page className="max-w-4xl">
      <Link href="/conversations" className="inline-flex min-h-10 items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" aria-hidden />
        All conversations
      </Link>

      <Panel className="flex flex-col overflow-hidden">
        <header className="flex items-center gap-3 border-b p-5 sm:p-6">
          <Avatar name={customer.name} className="size-9" />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight">{customer.name ?? "Unknown customer"}</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="font-mono">{phone(customer.phone)}</span> {"·"} Assigned to {customer.assignee_name || "nobody"}
            </p>
          </div>
        </header>

        <div className="min-h-80 space-y-4 bg-background/60 px-4 py-6 sm:px-6" aria-label="Messages">
          {messages.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-muted-foreground">No messages since the webhook went live.</p>
          ) : (
            messages.map((m) => <Bubble key={m.id} m={m} />)
          )}
        </div>

        <div className="border-t bg-card p-5 sm:p-6">
          <SendBox customerId={customer.id} />
        </div>
      </Panel>
    </Page>
  );
}

function sender(m: MessageRow): string {
  if (m.direction === "FROM_CUSTOMER") return "Customer";
  if (m.senderType === "bot") return "AI assistant";
  return m.agentEmail ?? "Agent";
}

function Bubble({ m }: { m: MessageRow }) {
  const fromStore = m.direction === "FROM_STORE";
  return (
    <div className={cn("flex", fromStore ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-xl border px-4 py-3 text-sm leading-relaxed sm:max-w-[70%]",
          fromStore ? "rounded-tr-sm border-brand-line bg-bubble-agent" : "rounded-tl-sm bg-bubble-customer",
          fromStore && m.senderType === "bot" && "border-border bg-bubble-bot",
        )}
      >
        <p className="mb-1 text-[11px] font-medium text-muted-foreground">{sender(m)}</p>
        <p className="[overflow-wrap:anywhere] whitespace-pre-wrap">{m.text || <em className="text-muted-foreground">[{m.type ?? "message"}]</em>}</p>
        <p className="mt-1 text-right text-[11px] text-muted-foreground">{time(m.sentAt)}</p>
      </div>
    </div>
  );
}
