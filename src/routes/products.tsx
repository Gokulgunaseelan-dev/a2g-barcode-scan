import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteProduct, money, saveProduct, uid, useProducts, type Product } from "@/lib/store";

export const Route = createFileRoute("/products")({
  head: () => ({
    meta: [
      { title: "Product Catalogue & Stock — FreshMart POS" },
      {
        name: "description",
        content: "Add, edit and track supermarket products, barcodes, GST rates and stock levels.",
      },
      { property: "og:title", content: "Product Catalogue & Stock — FreshMart POS" },
      {
        property: "og:description",
        content: "Manage barcodes, pricing, GST and low-stock alerts for your supermarket.",
      },
    ],
  }),
  component: Products,
});

const empty = (): Product => ({
  id: uid(),
  barcode: "",
  name: "",
  category: "Grocery",
  price: 0,
  cost: 0,
  stock: 0,
  unit: "pcs",
  tax: 5,
  lowStockAt: 5,
});

function Products() {
  const products = useProducts();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode.includes(search) ||
      p.category.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AppShell title="Products">
      <div className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search catalogue"
            className="h-11"
          />
          <Button className="h-11 gap-2" onClick={() => setEditing(empty())}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>

        <div className="space-y-2">
          {filtered.map((p) => (
            <Card key={p.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.barcode || "no barcode"} · {p.category} · GST {p.tax}%
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-sm font-semibold">{money(p.price)}</span>
                  <Badge variant={p.stock <= p.lowStockAt ? "destructive" : "secondary"}>
                    {p.stock} {p.unit} in stock
                  </Badge>
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setEditing(p)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => deleteProduct(p.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </Card>
          ))}
          {filtered.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">No products found.</p>
          )}
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing && products.some((p) => p.id === editing.id) ? "Edit product" : "Add product"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <Field label="Name" value={editing.name} onChange={(v) => setEditing({ ...editing, name: v })} />
              <Field label="Barcode" value={editing.barcode} onChange={(v) => setEditing({ ...editing, barcode: v })} />
              <Field label="Category" value={editing.category} onChange={(v) => setEditing({ ...editing, category: v })} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Selling price" type="number" value={String(editing.price)} onChange={(v) => setEditing({ ...editing, price: Number(v) })} />
                <Field label="Cost price" type="number" value={String(editing.cost)} onChange={(v) => setEditing({ ...editing, cost: Number(v) })} />
                <Field label="Stock" type="number" value={String(editing.stock)} onChange={(v) => setEditing({ ...editing, stock: Number(v) })} />
                <Field label="Unit" value={editing.unit} onChange={(v) => setEditing({ ...editing, unit: v })} />
                <Field label="GST %" type="number" value={String(editing.tax)} onChange={(v) => setEditing({ ...editing, tax: Number(v) })} />
                <Field label="Low stock at" type="number" value={String(editing.lowStockAt)} onChange={(v) => setEditing({ ...editing, lowStockAt: Number(v) })} />
              </div>
              <Button
                className="w-full"
                disabled={!editing.name}
                onClick={() => {
                  saveProduct(editing);
                  setEditing(null);
                }}
              >
                Save product
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}