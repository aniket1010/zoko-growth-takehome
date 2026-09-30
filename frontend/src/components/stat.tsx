import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** A KPI tile: one number, a label, and an optional supporting line. */
export function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-normal text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
      </CardContent>
    </Card>
  );
}
