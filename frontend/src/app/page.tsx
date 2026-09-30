import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getConversations, type ConversationRow } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function Home() {
  let rows: ConversationRow[] = [];
  let error: string | null = null;
  try {
    rows = await getConversations();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <header>
        <h1 className="text-2xl font-semibold">Support Intelligence</h1>
        <p className="text-muted-foreground">What is happening with the support team, and how to improve it.</p>
      </header>

      {/* Metric cards land here on Day 1 once /api/metrics is implemented. */}

      <Card>
        <CardHeader>
          <CardTitle>Conversations</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-sm text-destructive">Backend not reachable: {error}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No conversations yet. Register the webhook and send a test message.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Assigned agent</TableHead>
                  <TableHead className="text-right">Messages</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.name ?? "Unknown"}</TableCell>
                    <TableCell className="font-mono text-xs">{r.phone}</TableCell>
                    <TableCell>{r.assignee_name || <Badge variant="outline">Unassigned</Badge>}</TableCell>
                    <TableCell className="text-right">{r.message_count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
