import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { Page, PageHeader, Panel, PanelBody } from "@/components/panel";
import { ErrorState } from "@/components/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, type ConversationRow } from "@/lib/api";
import { phone } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Conversations() {
  let rows: ConversationRow[];
  try {
    rows = await api.conversations();
  } catch (e) {
    return (
      <Page>
        <ErrorState error={e instanceof Error ? e.message : String(e)} />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader title="Conversations" description="Open a conversation to view its messages and send a message." />
      <Panel>
        <PanelBody className="overflow-x-auto pt-5 sm:pt-6">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No messages yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Assigned agent</TableHead>
                  <TableHead className="text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar name={r.name} className="size-8" />
                        <span className="font-medium">{r.name ?? "Unknown"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{phone(r.phone)}</TableCell>
                    <TableCell>{r.assignee_name || <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                    <TableCell className="text-right">
                      <Link className="text-[13px] font-medium text-brand-ink hover:underline" href={`/conversations/${r.id}`}>
                        View messages
                      </Link>
                    </TableCell>
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
