import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, PackageX, Boxes } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { saveProduct, stockStatus, useMoney, useProducts, useSettings } from "@/lib/store";

export const Route = createFileRoute("/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory & Low-Stock Alerts — SmartCart" },
      {
        name: "description",
        content: "Live stock status for every product with low-stock and out-of-stock alerts, updated automatically after each bill.",
      },
      { property: "og:title", content: "Inventory & Low-Stock Alerts — SmartCart" },
      {
        property: "og:description",
        content: "Track IN STOCK, LOW STOCK and OUT OF STOCK items and restock in one tap.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Inventory,
});

function Inventory() {
  const products = useProducts();
  const settings = useSettings();
  const fmt = useMoney();
  const [restock, setRestock] = useState<Record<string, string>>({});

  const low = products.filter((p) => stockStatus(p) === "LOW STOCK");
  const out = products.filter((p) => stockStatus(p) === "OUT OF STOCK");
  const value = products.reduce((s, p) => s + p.price * p.stock, 0);

  return (
    <AppShell title="Inventory">
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <Kpi icon={Boxes} label="Products" value={String(products.length)} />
          <Kpi icon={AlertTriangle} label="Low stock" value={String(low.length)} />
          <Kpi icon={PackageX} label="Out of stock" value={String(out.length)} />
        </div>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Stock value at selling price</p>
          <p className="text-2xl font-bold">{fmt(value)}</p>
        </Card>

        {(low.length > 0 || out.length > 0) && (
          <Card className="border-destructive/40 bg-destructive/5 p-4">
            <p className="text-sm font-semibold text-destructive">
              {low.length + out.length} item(s) need restocking
            </p>
          </Card>
        )}

        <div className="space-y-2">
          {[...out, ...low, ...products.filter((p) => stockStatus(p) === "IN STOCK")].map((p) => {
            const status = stockStatus(p);
            return (
              <Card key={p.id} className="space-y-2 p-3">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.barcode || "no barcode"} · reorder at {p.lowStockAt} {p.unit}
                    </p>
                  </div>
                  <Badge
                    variant={
                      status === "IN STOCK" ? "secondary" : status === "LOW STOCK" ? "default" : "destructive"
                    }
                  >
                    {status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">
                    {p.stock} {p.unit}
                  </span>
                  {settings.role === "admin" && (
                    <>
                      <Input
                        type="number"
                        min={1}
                        placeholder="Add qty"
                        value={restock[p.id] ?? ""}
                        onChange={(e) => setRestock((r) => ({ ...r, [p.id]: e.target.value }))}
                        className="ml-auto h-9 w-24"
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          const add = Math.floor(Number(restock[p.id]));
                          if (!add || add <= 0) {
                            toast.error("Enter a positive quantity.");
                            return;
                          }
                          saveProduct({ ...p, stock: p.stock + add });
                          setRestock((r) => ({ ...r, [p.id]: "" }));
                          toast.success(`${p.name} restocked`);
                        }}
                      >
                        Restock
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card className="p-3">
      <Icon className="mb-1 h-4 w-4 text-primary" />
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </Card>
  );
}
