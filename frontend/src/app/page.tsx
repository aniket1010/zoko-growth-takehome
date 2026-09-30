import Link from "next/link";
import { AttentionQueue, MetricSummary, Observations } from "@/components/dashboard-summary";
import { RefreshButton } from "@/components/refresh-button";
import { Avatar } from "@/components/avatar";
import { Page, PageHeader, Panel, PanelBody, PanelHeader } from "@/components/panel";
import { ErrorState } from "@/components/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, type AgentRow, type Overview, type AttentionRow, type ConversationMetric } from "@/lib/api";
import { duration, phone } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  let o: Overview, agents: AgentRow[];
  let attention: AttentionRow[] | null = null;
  let metrics: ConversationMetric[] | null = null;
  try {
    const [overviewResult, agentResult, attentionResult, metricResult] = await Promise.allSettled([api.overview(), api.agents(), api.attention(), api.conversationMetrics()]);
    if (overviewResult.status === "rejected") throw overviewResult.reason;
    if (agentResult.status === "rejected") throw agentResult.reason;
    o = overviewResult.value;
    agents = agentResult.value;
    if (attentionResult.status === "fulfilled") attention = attentionResult.value;
    if (metricResult.status === "fulfilled") metrics = metricResult.value;
  } catch (e) {
    return (
      <Page>
        <PageHeader title="Support overview" action={<RefreshButton />} />
        <ErrorState error={e instanceof Error ? e.message : String(e)} />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader title="Support overview" description="All store activity since collection began. A closer look at your team's response and resolution." action={<RefreshButton />} />
      <MetricSummary overview={o} metrics={metrics} />
      <AttentionQueue rows={attention} />
      <Observations metrics={metrics} />

      <Panel>
        <PanelHeader
          title="Team performance"
          description="Average and median times by agent, with reassigned conversations."
        />
        <PanelBody className="overflow-x-auto" role="region" aria-label="Scrollable table" tabIndex={0}>
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
        <PanelBody className="overflow-x-auto" role="region" aria-label="Scrollable table" tabIndex={0}>
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
