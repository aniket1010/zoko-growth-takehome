import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, type ConversationRow } from "@/lib/api";
import { phone, time } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Conversations() {
  let rows: ConversationRow[] = [];
  let error: string | null = null;
  try {
    rows = await api.conversations();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
      <h1 className="text-2xl font-semibold">Conversations</h1>
      <Card>
        <CardHeader>
          <CardTitle>{rows.length} customers with messages</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {error ? (
            <p className="text-sm text-destructive">Backend not reachable: {error}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No messages yet. They appear here as soon as Zoko sends them to the webhook.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Assigned agent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last message</TableHead>
                  <TableHead className="text-right">Messages</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      <Link className="hover:underline" href={`/conversations/${r.id}`}>
                        {r.name ?? "Unknown"}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{phone(r.phone)}</TableCell>
                    <TableCell>{r.assignee_name || <Badge variant="outline">Unassigned</Badge>}</TableCell>
                    <TableCell>{r.is_closed ? <Badge variant="secondary">Closed</Badge> : <Badge>Open</Badge>}</TableCell>
                    <TableCell className="max-w-72">
                      <div className="truncate text-sm">{r.last_message ?? "–"}</div>
                      <div className="text-xs text-muted-foreground">{time(r.last_message_at)}</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.message_count}</TableCell>
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
