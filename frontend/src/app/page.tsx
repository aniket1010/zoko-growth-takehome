import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { Page, PageHeader, Panel, PanelBody, PanelHeader } from "@/components/panel";
import { ErrorState } from "@/components/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, type AgentRow, type Overview } from "@/lib/api";
import { duration, phone } from "@/lib/format";

export const dynamic = "force-dynamic";

/** One number with a label. Kept deliberately plain: exactly what the brief asks for. */
function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <Panel className="p-5 sm:p-6">
      <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-3 text-[32px] leading-tight font-semibold tracking-tight tabular-nums">{value}</p>
    </Panel>
  );
}

export default async function Dashboard() {
  let o: Overview, agents: AgentRow[];
  try {
    [o, agents] = await Promise.all([api.overview(), api.agents()]);
  } catch (e) {
    return (
      <Page>
        <ErrorState error={e instanceof Error ? e.message : String(e)} />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader title="Dashboard" description="All store messages since the webhook went live. Response times count human agents only." />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="Total messages" value={o.total_messages} />
        <Metric label="Avg first response time" value={duration(o.avg_frt_seconds)} />
        <Metric label="Median first response time" value={duration(o.median_frt_seconds)} />
        <Metric label="Avg resolution time" value={duration(o.avg_resolution_seconds)} />
        <Metric label="Median resolution time" value={duration(o.median_resolution_seconds)} />
      </section>

      <Panel>
        <PanelHeader
          title="Per agent"
          description="FRT goes to the agent who replied first, resolution to the agent who owned the chat when it closed, and a reassignment to the agent the chat was taken from."
        />
        <PanelBody className="overflow-x-auto">
          {agents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No agent activity yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead className="text-right">Avg FRT</TableHead>
                  <TableHead className="text-right">Median FRT</TableHead>
                  <TableHead className="text-right">Avg resolution</TableHead>
                  <TableHead className="text-right">Median resolution</TableHead>
                  <TableHead className="text-right">Reassigned chats</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar name={a.name} className="size-8" />
                        <span className="font-medium">{a.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{duration(a.avg_frt_seconds)}</TableCell>
                    <TableCell className="text-right tabular-nums">{duration(a.median_frt_seconds)}</TableCell>
                    <TableCell className="text-right tabular-nums">{duration(a.avg_resolution_seconds)}</TableCell>
                    <TableCell className="text-right tabular-nums">{duration(a.median_resolution_seconds)}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.reassigned_chats}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader title="Messages per customer" />
        <PanelBody className="overflow-x-auto">
          {o.messages_per_customer.length === 0 ? (
            <p className="text-sm text-muted-foreground">No messages yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Messages</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {o.messages_per_customer.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link className="font-medium hover:underline" href={`/conversations/${c.id}`}>
                        {c.name ?? "Unknown"}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{phone(c.phone)}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.messages}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </PanelBody>
      </Panel>
    </Page>
  );
}
