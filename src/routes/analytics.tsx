import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { computeQueue } from "@/lib/queue";
import { billingStats, useMoney, useSales, useSettings } from "@/lib/store";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Sales, GST & Counter Utilization | SmartCart" },
      {
        name: "description",
        content: "Today's sales, bill count, average bill value, GST collected, peak traffic hour and counter utilization in one dashboard.",
      },
      { property: "og:title", content: "Analytics — SmartCart" },
      {
        property: "og:description",
        content: "Sales, traffic and queue analytics with a GST summary for your supermarket.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Analytics,
});

function Analytics() {
  const sales = useSales();
  const settings = useSettings();
  const fmt = useMoney();
  const stats = useMemo(() => billingStats(sales), [sales]);

  const today = new Date().toDateString();
  const todays = sales.filter((s) => new Date(s.createdAt).toDateString() === today);
  const revenue = todays.reduce((s, x) => s + x.total, 0);
  const gst = todays.reduce((s, x) => s + x.tax, 0);
  const items = todays.reduce((s, x) => s + x.items.reduce((a, i) => a + i.qty, 0), 0);
  const avgBill = todays.length ? revenue / todays.length : 0;
  const perMin = stats.avgBillingSec > 0 ? 60 / stats.avgBillingSec : 0;
  const q = computeQueue(settings.queue.lambda, settings.queue.mu, settings.queue.counters);

  const hours = [...Array(24).keys()];
  const maxHour = Math.max(1, ...hours.map((h) => stats.byHour.get(h) ?? 0));
  const last7 = [...Array(7).keys()].map((i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toDateString();
    return {
      label: d.toLocaleDateString("en-IN", { weekday: "short" }),
      total: sales.filter((s) => new Date(s.createdAt).toDateString() === key).reduce((s, x) => s + x.total, 0),
    };
  });
  const maxDay = Math.max(1, ...last7.map((d) => d.total));

  return (
    <AppShell title="Analytics">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Kpi label="Sales today" value={fmt(revenue)} />
          <Kpi label="Bills today" value={String(todays.length)} />
          <Kpi label="Items sold" value={String(items)} />
          <Kpi label="Avg bill value" value={fmt(avgBill)} />
          <Kpi label="Avg billing time" value={stats.avgBillingSec ? `${stats.avgBillingSec}s` : "Not available"} />
          <Kpi label="Customers / min" value={perMin ? perMin.toFixed(2) : "Not available"} />
          <Kpi
            label="Peak traffic hour"
            value={stats.peakHour === null ? "Not available" : `${String(stats.peakHour).padStart(2, "0")}:00`}
          />
          <Kpi label="GST collected today" value={fmt(gst)} />
        </div>

        <Card className="space-y-2 p-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Counter utilization
            </h2>
            {!stats.hasEnoughData && <Badge variant="secondary">Demo Data</Badge>}
          </div>
          <p className="text-2xl font-bold">
            {isFinite(q.utilization) ? `${Math.round(q.utilization * 100)}%` : "∞"}
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full ${q.status === "OVERLOADED" ? "bg-destructive" : q.status === "HIGH LOAD" ? "bg-amber-500" : "bg-primary"}`}
              style={{ width: `${Math.min(100, (isFinite(q.utilization) ? q.utilization : 1) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            ρ = λ / (c × μ) = {q.lambda} / ({q.counters} × {q.mu}) · status {q.status}
          </p>
        </Card>

        <Card className="space-y-2 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Sales — last 7 days
          </h2>
          <div className="flex h-32 items-end gap-2">
            {last7.map((d) => (
              <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-primary/80"
                  style={{ height: `${(d.total / maxDay) * 100}%`, minHeight: d.total ? 4 : 1 }}
                />
                <span className="text-[10px] text-muted-foreground">{d.label}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-2 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Customer traffic by hour (bills)
          </h2>
          <div className="flex h-24 items-end gap-[2px]">
            {hours.map((h) => (
              <div
                key={h}
                title={`${h}:00 — ${stats.byHour.get(h) ?? 0} bills`}
                className="flex-1 rounded-t bg-secondary"
                style={{ height: `${((stats.byHour.get(h) ?? 0) / maxHour) * 100}%`, minHeight: 2 }}
              />
            ))}
          </div>
        </Card>

        <Card className="space-y-2 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            GST summary (all bills)
          </h2>
          <dl className="space-y-1 text-sm">
            <Row label="Taxable value" value={fmt(sales.reduce((s, x) => s + (x.taxable ?? 0), 0))} />
            <Row label="CGST" value={fmt(sales.reduce((s, x) => s + (x.cgst ?? 0), 0))} />
            <Row label="SGST" value={fmt(sales.reduce((s, x) => s + (x.sgst ?? 0), 0))} />
            <Row label="IGST" value={fmt(sales.reduce((s, x) => s + (x.igst ?? 0), 0))} />
            <Row label="Total GST" value={fmt(sales.reduce((s, x) => s + x.tax, 0))} />
            <Row label="Customer savings" value={fmt(sales.reduce((s, x) => s + (x.savings ?? 0), 0))} />
          </dl>
        </Card>
      </div>
    </AppShell>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <dt>{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}
