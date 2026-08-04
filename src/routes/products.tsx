import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  deleteProduct,
  discountPercentOf,
  saveProduct,
  stockStatus,
  uid,
  useMoney,
  useProducts,
  useSettings,
  validateProduct,
  type Product,
} from "@/lib/store";

export const Route = createFileRoute("/products")({
  head: () => ({
    meta: [
      { title: "Product Admin — SmartCart Catalogue & Pricing" },
      {
        name: "description",
        content: "Admin-only catalogue: add or edit products, MRP, selling price, GST rate, HSN, barcode and stock.",
      },
      { property: "og:title", content: "Product Admin — SmartCart" },
      {
        property: "og:description",
        content: "Manage barcodes, MRP vs selling price, configurable GST rates and stock levels.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Products,
});

const NA = "Not available";

const empty = (): Product => ({
  id: uid(),
  barcode: "",
  name: "",
  brand: NA,
  category: "Grocery",
  subcategory: NA,
  mrp: 0,
  price: 0,
  cost: 0,
  stock: 0,
  unit: "pcs",
  tax: 5,
  hsn: NA,
  lowStockAt: 5,
});

function Products() {
  const products = useProducts();
  const settings = useSettings();
  const fmt = useMoney();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);

  if (settings.role !== "admin") {
    return (
      <AppShell title="Product admin">
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <Lock className="h-8 w-8 text-muted-foreground" />
          <p className="font-medium">Admin access required</p>
          <p className="text-sm text-muted-foreground">
            Cashiers can scan and bill. Switch to the Admin role in Settings to manage products,
            pricing, GST and stock.
          </p>
        </Card>
      </AppShell>
    );
  }

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode.includes(search) ||
      p.category.toLowerCase().includes(search.toLowerCase()),
  );

  const save = (product: Product) => {
    let error = validateProduct(product);
    if (error === "Selling price cannot exceed MRP.") {
      if (!window.confirm("Selling price is above MRP. Confirm this is intentional?")) return;
      error = validateProduct(product, true);
    }
    if (error) {
      toast.error(error);
      return;
    }
    saveProduct(product);
    setEditing(null);
    toast.success("Product saved");
  };

  return (
    <AppShell title="Product admin">
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
                <p className="truncate text-xs text-muted-foreground">
                  {p.brand} · {p.barcode || "no barcode"} · {p.category} · GST {p.tax}% · HSN {p.hsn}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground line-through">{fmt(p.mrp)}</span>
                  <span className="text-sm font-semibold">{fmt(p.price)}</span>
                  {p.mrp > p.price && (
                    <Badge variant="secondary">{discountPercentOf(p.mrp, p.price)}% off</Badge>
                  )}
                  <Badge variant={stockStatus(p) === "IN STOCK" ? "secondary" : "destructive"}>
                    {p.stock} {p.unit}
                  </Badge>
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setEditing(p)} aria-label="Edit">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Delete"
                onClick={() => {
                  if (window.confirm(`Delete ${p.name}?`)) deleteProduct(p.id);
                }}
              >
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
            <DialogTitle>
              {editing && products.some((p) => p.id === editing.id) ? "Edit product" : "Add product"}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <Field label="Name" value={editing.name} onChange={(v) => setEditing({ ...editing, name: v })} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Brand" value={editing.brand} onChange={(v) => setEditing({ ...editing, brand: v })} />
                <Field label="Barcode" value={editing.barcode} onChange={(v) => setEditing({ ...editing, barcode: v })} />
                <Field label="Category" value={editing.category} onChange={(v) => setEditing({ ...editing, category: v })} />
                <Field label="Subcategory" value={editing.subcategory} onChange={(v) => setEditing({ ...editing, subcategory: v })} />
                <Field label="MRP" type="number" value={String(editing.mrp)} onChange={(v) => setEditing({ ...editing, mrp: Number(v) })} />
                <Field label="Selling price" type="number" value={String(editing.price)} onChange={(v) => setEditing({ ...editing, price: Number(v) })} />
                <Field label="Cost price" type="number" value={String(editing.cost)} onChange={(v) => setEditing({ ...editing, cost: Number(v) })} />
                <Field label="HSN code" value={editing.hsn} onChange={(v) => setEditing({ ...editing, hsn: v })} />
                <Field label="Stock" type="number" value={String(editing.stock)} onChange={(v) => setEditing({ ...editing, stock: Number(v) })} />
                <Field label="Unit" value={editing.unit} onChange={(v) => setEditing({ ...editing, unit: v })} />
                <div className="space-y-1">
                  <Label>GST rate</Label>
                  <Select
                    value={String(editing.tax)}
                    onValueChange={(v) => setEditing({ ...editing, tax: Number(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[...new Set([...settings.gstSlabs, editing.tax])]
                        .sort((a, b) => a - b)
                        .map((r) => (
                          <SelectItem key={r} value={String(r)}>
                            {r}%
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <Field label="Low stock at" type="number" value={String(editing.lowStockAt)} onChange={(v) => setEditing({ ...editing, lowStockAt: Number(v) })} />
              </div>
              <Field label="Image URL (optional)" value={editing.image ?? ""} onChange={(v) => setEditing({ ...editing, image: v || undefined })} />
              <p className="text-xs text-muted-foreground">
                Savings preview: {fmt(Math.max(0, editing.mrp - editing.price))} (
                {discountPercentOf(editing.mrp, editing.price)}%)
              </p>
              <Button className="w-full" disabled={!editing.name} onClick={() => save(editing)}>
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
