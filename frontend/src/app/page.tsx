import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Stat } from "@/components/stat";
import { api, type AgentRow, type AttentionRow, type Overview } from "@/lib/api";
import { duration, percent, phone, time } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  let data: [Overview, AgentRow[], AttentionRow[]];
  try {
    data = await Promise.all([api.overview(), api.agents(), api.attention()]);
  } catch (e) {
    return (
      <main className="mx-auto w-full max-w-6xl p-4 md:p-8">
        <p className="text-sm text-destructive">Backend not reachable: {e instanceof Error ? e.message : String(e)}</p>
      </main>
    );
  }
  const [o, agents, attention] = data;

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 p-4 md:p-8">
      <header>
        <h1 className="text-2xl font-semibold">How is the support team doing?</h1>
        <p className="text-sm text-muted-foreground">
          All store activity since the webhook went live. Response times count human agents only; the AI assistant is excluded.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total messages" value={o.total_messages} sub={`${o.customer_messages} customer · ${o.agent_messages} agent · ${o.bot_messages} bot`} />
        <Stat label="Conversations" value={o.conversations} sub={`${o.closed} closed · ${o.customers_with_messages} customers`} />
        <Stat label="First response time" value={duration(o.median_frt_seconds)} sub={`median · average ${duration(o.avg_frt_seconds)}`} />
        <Stat label="Resolution time" value={duration(o.median_resolution_seconds)} sub={`median · average ${duration(o.avg_resolution_seconds)}`} />
        <Stat label="Waiting for a first reply" value={o.awaiting_first_reply} sub="open, no human reply yet" />
        <Stat label="Closed without a reply" value={o.closed_without_reply} sub="closed before any human answered" />
        <Stat label="Reassigned conversations" value={o.reassigned} sub={percent(o.reassigned, o.conversations) + " of conversations"} />
        <Stat
          label="CSAT"
          value={o.csat_avg != null ? `${o.csat_avg.toFixed(1)} / 5` : "–"}
          sub={`${o.csat_received} of ${o.csat_asked} surveys answered`}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Needs attention now</CardTitle>
          <CardDescription>Open conversations with no human reply yet, longest wait first.</CardDescription>
        </CardHeader>
        <CardContent>
          {attention.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nobody is waiting. Every open conversation has a human reply.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Assigned to</TableHead>
                  <TableHead>Waiting since</TableHead>
                  <TableHead className="text-right">Waiting</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attention.map((a) => (
                  <TableRow key={a.customer_id}>
                    <TableCell>
                      <Link className="hover:underline" href={`/conversations/${a.customer_id}`}>
                        {a.customer_name ?? phone(a.phone)}
                      </Link>
                    </TableCell>
                    <TableCell>{a.assignee_name || <Badge variant="outline">Unassigned</Badge>}</TableCell>
                    <TableCell>{time(a.started_at)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{duration(a.waiting_seconds)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agents</CardTitle>
          <CardDescription>
            FRT is credited to the agent who replied first, resolution to the agent who owned the chat at close, and a reassignment to the
            agent the chat was taken from.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {agents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No agent activity yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead className="text-right">Messages</TableHead>
                  <TableHead className="text-right">FRT median</TableHead>
                  <TableHead className="text-right">FRT avg</TableHead>
                  <TableHead className="text-right">Resolution median</TableHead>
                  <TableHead className="text-right">Resolution avg</TableHead>
                  <TableHead className="text-right">Closed</TableHead>
                  <TableHead className="text-right">Reassigned away</TableHead>
                  <TableHead className="text-right">CSAT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.messages_sent}</TableCell>
                    <TableCell className="text-right tabular-nums">{duration(a.median_frt_seconds)}</TableCell>
                    <TableCell className="text-right tabular-nums">{duration(a.avg_frt_seconds)}</TableCell>
                    <TableCell className="text-right tabular-nums">{duration(a.median_resolution_seconds)}</TableCell>
                    <TableCell className="text-right tabular-nums">{duration(a.avg_resolution_seconds)}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.closed_conversations}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.reassigned_chats}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {a.csat_avg != null ? `${a.csat_avg.toFixed(1)} (${a.csat_received})` : "–"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Messages per customer</CardTitle>
          <CardDescription>Customers with long threads often had a problem that took too long to solve.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">From customer</TableHead>
                <TableHead className="text-right">Total messages</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {o.messages_per_customer.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link className="hover:underline" href={`/conversations/${c.id}`}>
                      {c.name ?? "Unknown"}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{phone(c.phone)}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.from_customer}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.messages}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}
