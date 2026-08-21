import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { downloadReceipt } from "@/lib/receipt";
import { money, useSales } from "@/lib/store";

export const Route = createFileRoute("/sales")({
  head: () => ({
    meta: [
      { title: "Sales History & Invoices — A2G Barcode Scan" },
      {
        name: "description",
        content: "Browse past supermarket bills, payment modes and re-download PDF invoices.",
      },
      { property: "og:title", content: "Sales History & Invoices — A2G Barcode Scan" },
      {
        property: "og:description",
        content: "Every bill stored on-device with one-tap PDF receipt re-download.",
      },
    ],
  }),
  component: Sales,
});

function Sales() {
  const sales = useSales();

  return (
    <AppShell title="Sales history">
      <div className="space-y-2">
        {sales.map((sale) => (
          <Card key={sale.id} className="flex items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{sale.invoiceNo}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(sale.createdAt).toLocaleString("en-IN")} · {sale.items.length} items ·{" "}
                {sale.paymentMode}
              </p>
            </div>
            <span className="font-semibold">{money(sale.total)}</span>
            <Button size="icon" variant="ghost" onClick={() => downloadReceipt(sale)}>
              <Download className="h-4 w-4" />
            </Button>
          </Card>
        ))}
        {sales.length === 0 && (
          <p className="py-16 text-center text-sm text-muted-foreground">
            No bills yet. Complete a sale to see it here.
          </p>
        )}
      </div>
    </AppShell>
  );
}