import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SendBox } from "@/components/send-box";
import { api, type ChatEventRow, type MessageRow } from "@/lib/api";
import { phone, time } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Item = { at: string; message?: MessageRow; event?: ChatEventRow };

function label(m: MessageRow): string {
  if (m.direction === "FROM_CUSTOMER") return m.replyToTemplate ? "Customer · CSAT answer" : "Customer";
  if (m.senderType === "bot") return "AI assistant";
  return m.templateName ? `${m.agentEmail ?? "Agent"} · template ${m.templateName}` : (m.agentEmail ?? "Agent");
}

export default async function ConversationPage({ params }: PageProps<"/conversations/[id]">) {
  const { id } = await params;
  let customer, messages: MessageRow[], events: ChatEventRow[];
  try {
    [customer, messages, events] = await Promise.all([api.customer(id), api.messages(id), api.events(id)]);
  } catch {
    notFound();
  }

  // One timeline: messages plus "assigned to" / "closed by" markers.
  const items: Item[] = [
    ...messages.map((m) => ({ at: m.sentAt, message: m })),
    ...events.map((e) => ({ at: e.event_at.replace(" ", "T").replace(/\+00$/, "Z"), event: e })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-8">
      <Link href="/conversations" className="text-sm text-muted-foreground hover:text-foreground">
        ← All conversations
      </Link>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{customer.name ?? "Unknown customer"}</h1>
        <p className="text-sm text-muted-foreground">
          <span className="font-mono">{phone(customer.phone)}</span> · Assigned to {customer.assignee_name || "nobody"}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Messages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length === 0 ? <p className="text-sm text-muted-foreground">No messages since the webhook went live.</p> : null}
          {items.map((it, i) =>
            it.event ? (
              <div key={`e${i}`} className="text-center text-xs text-muted-foreground">
                {it.event.kind === "closed"
                  ? `Closed by ${it.event.agent_name ?? it.event.closed_by_type ?? "system"}`
                  : `Assigned to ${it.event.agent_name ?? "nobody"}`}{" "}
                · {time(it.event.event_at)}
              </div>
            ) : it.message ? (
              <div key={it.message.id} className={cn("flex", it.message.direction === "FROM_STORE" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                    it.message.direction === "FROM_STORE"
                      ? it.message.senderType === "bot"
                        ? "bg-muted"
                        : "bg-primary text-primary-foreground"
                      : "border bg-background",
                  )}
                >
                  <div className="mb-1 text-[11px] opacity-70">{label(it.message)}</div>
                  <div className="whitespace-pre-wrap break-words">{it.message.text || <em>[{it.message.type}]</em>}</div>
                  <div className="mt-1 flex items-center justify-end gap-2 text-[11px] opacity-70">
                    {time(it.message.sentAt)}
                    {it.message.direction === "FROM_STORE" && it.message.deliveryStatus ? (
                      <Badge variant="outline" className="h-4 px-1 text-[10px]">
                        {it.message.deliveryStatus}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null,
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Send a message</CardTitle>
        </CardHeader>
        <CardContent>
          <SendBox customerId={customer.id} />
        </CardContent>
      </Card>
    </main>
  );
}
