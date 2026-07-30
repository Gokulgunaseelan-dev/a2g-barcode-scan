import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, IndianRupee, Receipt, TrendingUp } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { money, useProducts, useSales } from "@/lib/store";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Sales Reports & Stock Alerts — FreshMart POS" },
      {
        name: "description",
        content: "Daily revenue, bill count, best sellers and low-stock alerts for your supermarket.",
      },
      { property: "og:title", content: "Sales Reports & Stock Alerts — FreshMart POS" },
      {
        property: "og:description",
        content: "Track today's revenue, top selling items and items running low on stock.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const sales = useSales();
  const products = useProducts();

  const today = new Date().toDateString();
  const todays = sales.filter((s) => new Date(s.createdAt).toDateString() === today);
  const revenueToday = todays.reduce((s, x) => s + x.total, 0);
  const revenueAll = sales.reduce((s, x) => s + x.total, 0);

  const counts = new Map<string, number>();
  for (const sale of sales)
    for (const item of sale.items) counts.set(item.name, (counts.get(item.name) ?? 0) + item.qty);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const low = products.filter((p) => p.stock <= p.lowStockAt);

  return (
    <AppShell title="Reports">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Stat icon={IndianRupee} label="Revenue today" value={money(revenueToday)} />
          <Stat icon={Receipt} label="Bills today" value={String(todays.length)} />
          <Stat icon={TrendingUp} label="Total revenue" value={money(revenueAll)} />
          <Stat icon={AlertTriangle} label="Low stock items" value={String(low.length)} />
        </div>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Best sellers
          </h2>
          {top.length ? (
            <ul className="space-y-2">
              {top.map(([name, qty]) => (
                <li key={name} className="flex justify-between text-sm">
                  <span>{name}</span>
                  <span className="font-semibold">{qty} sold</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No sales recorded yet.</p>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Stock alerts
          </h2>
          {low.length ? (
            <ul className="space-y-2">
              {low.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <span>{p.name}</span>
                  <Badge variant="destructive">
                    {p.stock} {p.unit} left
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">All products are well stocked.</p>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card className="p-4">
      <Icon className="mb-2 h-5 w-5 text-primary" />
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </Card>
  );
}