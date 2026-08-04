import { createFileRoute } from "@tanstack/react-router";
import { Download, Printer, Share2 } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { downloadReceipt, printReceipt, shareReceipt } from "@/lib/receipt";
import { useMoney, useSales } from "@/lib/store";

export const Route = createFileRoute("/sales")({
  head: () => ({
    meta: [
      { title: "Sales History & Invoices — SmartCart" },
      {
        name: "description",
        content: "Browse past supermarket bills, payment modes and re-download PDF invoices.",
      },
      { property: "og:title", content: "Sales History & Invoices — SmartCart" },
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
  const fmt = useMoney();

  return (
    <AppShell title="Receipts">
      <div className="space-y-2">
        {sales.map((sale) => (
          <Card key={sale.id} className="flex items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{sale.invoiceNo}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(sale.createdAt).toLocaleString("en-IN")} · {sale.items.length} items · {sale.paymentMode}
              </p>
            </div>
            <span className="font-semibold">{fmt(sale.total)}</span>
            <Button size="icon" variant="ghost" aria-label="Print" onClick={() => printReceipt(sale)}>
              <Printer className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" aria-label="Share" onClick={() => shareReceipt(sale)}>
              <Share2 className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" aria-label="Download PDF" onClick={() => downloadReceipt(sale)}>
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