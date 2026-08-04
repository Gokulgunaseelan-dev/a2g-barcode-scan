import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { Camera, Minus, Plus, Search, Sigma, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { downloadReceipt, printReceipt, shareReceipt } from "@/lib/receipt";
import {
  cartItemOf,
  checkout,
  computeTotals,
  discountPercentOf,
  findByBarcode,
  saveProduct,
  saveSettings,
  uid,
  useMoney,
  useProducts,
  useSettings,
  validateProduct,
  type CartItem,
  type Product,
  type Sale,
} from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Scan & Bill — SmartCart Smart Supermarket Billing" },
      {
        name: "description",
        content:
          "Scan a barcode, see MRP, selling price, savings and GST breakdown, then bill with a live mathematical audit trail — fully offline.",
      },
      { property: "og:title", content: "Scan & Bill — SmartCart" },
      {
        property: "og:description",
        content: "Mathematics-powered supermarket billing: MRP, discount, GST, CGST/SGST and final amount, shown step by step.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Billing,
});

function Billing() {
  const products = useProducts();
  const settings = useSettings();
  const fmt = useMoney();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [query, setQuery] = useState("");
  const [discount, setDiscount] = useState(0);
  const [payment, setPayment] = useState<Sale["paymentMode"]>("Cash");
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState<Product | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const startedAt = useRef<string>(new Date().toISOString());

  const totals = useMemo(
    () => computeTotals(cart, discount, settings.taxMode),
    [cart, discount, settings.taxMode],
  );

  const addProduct = useCallback((product: Product, qty = 1) => {
    setCart((prev) => {
      const found = prev.find((i) => i.productId === product.id);
      if (found)
        return prev.map((i) => (i.productId === product.id ? { ...i, qty: i.qty + qty } : i));
      return [...prev, cartItemOf(product, qty)];
    });
    toast.success(`${product.name} added to cart`);
  }, []);

  const handleCode = useCallback((code: string) => {
    setScanning(false);
    const product = findByBarcode(code.trim());
    if (product) setScanned(product);
    else setNotFound(code.trim());
  }, []);

  const setQty = (id: string, delta: number) =>
    setCart((prev) =>
      prev
        .map((i) => (i.productId === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i))
        .filter((i) => i.qty > 0),
    );

  const editQty = (id: string, qty: number) =>
    setCart((prev) =>
      prev.map((i) => (i.productId === id ? { ...i, qty: Math.max(1, Math.floor(qty) || 1) } : i)),
    );

  const results = query
    ? products
        .filter(
          (p) => p.name.toLowerCase().includes(query.toLowerCase()) || p.barcode.includes(query),
        )
        .slice(0, 6)
    : [];

  const completeSale = () => {
    if (!cart.length) return;
    const sale = checkout(cart, discount, payment, { startedAt: startedAt.current });
    setLastSale(sale);
    setCart([]);
    setDiscount(0);
    startedAt.current = new Date().toISOString();
  };

  return (
    <AppShell title="Scan & Bill">
      <div className="space-y-4">
        <Button className="h-14 w-full gap-2 text-base font-semibold" onClick={() => setScanning(true)}>
          <Camera className="h-6 w-6" /> Scan barcode
        </Button>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && query.trim()) {
                handleCode(query.trim());
                setQuery("");
              }
            }}
            placeholder="Search product or type barcode"
            className="h-11 pl-9"
          />
        </div>

        {results.length > 0 && (
          <Card className="divide-y divide-border p-0">
            {results.map((p) => (
              <button
                key={p.id}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-accent"
                onClick={() => {
                  setScanned(p);
                  setQuery("");
                }}
              >
                <span>
                  <span className="block text-sm font-medium">{p.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {p.barcode} · {p.category}
                  </span>
                </span>
                <span className="text-sm font-semibold">{fmt(p.price)}</span>
              </button>
            ))}
          </Card>
        )}

        <Card className="p-0">
          {cart.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              Cart is empty. Scan an item to start billing.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {cart.map((item) => (
                <li key={item.productId} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        MRP <span className="line-through">{fmt(item.mrp)}</span> · {fmt(item.price)} ·
                        GST {item.tax}%
                      </p>
                    </div>
                    <span className="w-20 text-right text-sm font-semibold">
                      {fmt(item.price * item.qty)}
                    </span>
                    <button
                      onClick={() => setCart((c) => c.filter((i) => i.productId !== item.productId))}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${item.name}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setQty(item.productId, -1)}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      type="number"
                      min={1}
                      value={item.qty}
                      onChange={(e) => editQty(item.productId, Number(e.target.value))}
                      className="h-8 w-16 text-center"
                    />
                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setQty(item.productId, 1)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                    {item.mrp > item.price && (
                      <Badge variant="secondary" className="ml-auto">
                        Save {fmt((item.mrp - item.price) * item.qty)}
                      </Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <MiniCard label="MRP total" value={fmt(totals.mrpTotal)} />
          <MiniCard label="Total savings" value={fmt(totals.savings)} tone="primary" />
          <MiniCard label="Total GST" value={fmt(totals.tax)} />
          <MiniCard label="Final amount" value={fmt(totals.total)} tone="primary" />
        </div>

        <Card className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="discount">Bill discount %</Label>
              <Input
                id="discount"
                type="number"
                min={0}
                max={100}
                value={discount}
                onChange={(e) =>
                  setDiscount(Math.min(100, Math.max(0, Number(e.target.value) || 0)))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Payment</Label>
              <Select value={payment} onValueChange={(v) => setPayment(v as Sale["paymentMode"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Card">Card</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Transaction type</Label>
            <Tabs
              value={settings.taxMode}
              onValueChange={(v) => saveSettings({ taxMode: v as "intra" | "inter" })}
            >
              <TabsList className="w-full">
                <TabsTrigger value="intra" className="flex-1">
                  Intra-state (CGST+SGST)
                </TabsTrigger>
                <TabsTrigger value="inter" className="flex-1">
                  Inter-state (IGST)
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <dl className="space-y-1 text-sm">
            <Row label="Subtotal (selling price)" value={fmt(totals.subtotal)} />
            <Row label="MRP savings" value={`- ${fmt(totals.mrpSavings)}`} />
            <Row label="Bill discount" value={`- ${fmt(totals.discount)}`} />
            <Row label="Taxable value" value={fmt(totals.taxable)} />
            {settings.taxMode === "intra" ? (
              <>
                <Row label="CGST" value={fmt(totals.cgst)} />
                <Row label="SGST" value={fmt(totals.sgst)} />
              </>
            ) : (
              <Row label="IGST" value={fmt(totals.igst)} />
            )}
            <Row label="Total GST" value={fmt(totals.tax)} />
            <div className="flex justify-between border-t border-border pt-2 text-lg font-bold">
              <dt>Final amount</dt>
              <dd>{fmt(totals.total)}</dd>
            </div>
          </dl>

          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setCart([])} disabled={!cart.length}>
              <Trash2 className="h-4 w-4" /> Clear
            </Button>
            <Button className="h-12 flex-1 text-base font-semibold" onClick={completeSale} disabled={!cart.length}>
              Charge {fmt(totals.total)}
            </Button>
          </div>
        </Card>

        <MathBreakdown totals={totals} fmt={fmt} taxMode={settings.taxMode} discount={discount} />
      </div>

      <Dialog open={scanning} onOpenChange={setScanning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scan barcode</DialogTitle>
          </DialogHeader>
          {scanning && <BarcodeScanner onDetected={handleCode} onClose={() => setScanning(false)} />}
        </DialogContent>
      </Dialog>

      <ScannedProductDialog
        product={scanned}
        onClose={() => setScanned(null)}
        onAdd={(p, qty) => {
          setScanned(null);
          addProduct(p, qty);
        }}
      />

      <QuickAddDialog
        barcode={notFound}
        onClose={() => setNotFound(null)}
        onCreated={(p) => {
          setNotFound(null);
          addProduct(p);
        }}
      />

      <Dialog open={!!lastSale} onOpenChange={() => setLastSale(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payment received</DialogTitle>
          </DialogHeader>
          {lastSale && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {lastSale.invoiceNo} · {lastSale.items.length} items · {lastSale.paymentMode} ·
                billed in {lastSale.durationSec}s
              </p>
              <p className="text-3xl font-bold">{fmt(lastSale.total)}</p>
              <p className="text-sm text-primary">You saved {fmt(lastSale.savings)}</p>
              <div className="grid grid-cols-3 gap-2">
                <Button onClick={() => downloadReceipt(lastSale)}>PDF</Button>
                <Button variant="outline" onClick={() => printReceipt(lastSale)}>
                  Print
                </Button>
                <Button variant="outline" onClick={() => shareReceipt(lastSale)}>
                  Share
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function MiniCard({ label, value, tone }: { label: string; value: string; tone?: "primary" }) {
  return (
    <Card className={`p-3 ${tone === "primary" ? "border-primary/40 bg-primary/5" : ""}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${tone === "primary" ? "text-primary" : ""}`}>{value}</p>
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

/** Visible formulas — the core of the Math Shark Tank story. */
function MathBreakdown({
  totals,
  fmt,
  taxMode,
  discount,
}: {
  totals: ReturnType<typeof computeTotals>;
  fmt: (n: number) => string;
  taxMode: "intra" | "inter";
  discount: number;
}) {
  return (
    <Card className="space-y-3 p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <Sigma className="h-4 w-4" /> Math breakdown
      </h2>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Items" value={String(totals.items)} />
        <Stat label="Quantity" value={String(totals.qty)} />
        <Stat label="Avg / unit" value={fmt(totals.avgPerItem)} />
      </div>
      <ul className="space-y-2 font-mono text-xs leading-relaxed">
        <li>
          Subtotal = Σ (selling price × qty) = <b>{fmt(totals.subtotal)}</b>
        </li>
        <li>
          Discount = Subtotal × {discount}% / 100 = <b>{fmt(totals.discount)}</b>
        </li>
        <li>
          Taxable value = Subtotal − Discount = {fmt(totals.subtotal)} − {fmt(totals.discount)} ={" "}
          <b>{fmt(totals.taxable)}</b>
        </li>
        {totals.byRate.map((r) => (
          <li key={r.rate}>
            GST@{r.rate}% = {fmt(r.taxable)} × {r.rate} / 100 = <b>{fmt(r.tax)}</b>
          </li>
        ))}
        <li>
          Total GST = <b>{fmt(totals.tax)}</b>{" "}
          {taxMode === "intra"
            ? `→ CGST ${fmt(totals.cgst)} + SGST ${fmt(totals.sgst)} (GST / 2 each)`
            : `→ IGST ${fmt(totals.igst)}`}
        </li>
        <li>
          Final amount = Taxable value + GST = {fmt(totals.taxable)} + {fmt(totals.tax)} ={" "}
          <b>{fmt(totals.total)}</b>
        </li>
        <li>
          Savings = (MRP total − Subtotal) + Discount = <b>{fmt(totals.savings)}</b>
        </li>
      </ul>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-base font-semibold">{value}</p>
    </div>
  );
}

/** Full product detail sheet shown right after a successful scan. */
function ScannedProductDialog({
  product,
  onClose,
  onAdd,
}: {
  product: Product | null;
  onClose: () => void;
  onAdd: (p: Product, qty: number) => void;
}) {
  const [qty, setQty] = useState(1);
  const fmt = useMoney();
  const settings = useSettings();
  if (!product) return null;

  const mrp = product.mrp || product.price;
  const savings = (mrp - product.price) * qty;
  const line = computeTotals([{ ...cartItemOf(product, qty) }], 0, settings.taxMode);

  return (
    <Dialog open onOpenChange={(o) => !o && (onClose(), setQty(1))}>
      <DialogContent className="max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
        </DialogHeader>
        {product.image && (
          <img src={product.image} alt={product.name} className="h-32 w-full rounded-lg object-contain" />
        )}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Detail label="Brand" value={product.brand} />
          <Detail label="Category" value={`${product.category} / ${product.subcategory}`} />
          <Detail label="Barcode" value={product.barcode || "Not available"} />
          <Detail label="HSN" value={product.hsn} />
          <Detail label="Unit" value={product.unit} />
          <Detail label="Stock" value={`${product.stock} ${product.unit}`} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MiniCard label="MRP" value={fmt(mrp)} />
          <MiniCard label="Selling price" value={fmt(product.price)} tone="primary" />
          <MiniCard
            label="Discount"
            value={`${fmt(mrp - product.price)} (${discountPercentOf(mrp, product.price)}%)`}
          />
          <MiniCard label={`GST ${product.tax}%`} value={fmt(line.tax)} />
        </div>
        <div className="flex items-center gap-2">
          <Label className="flex-1">Quantity</Label>
          <Button size="icon" variant="outline" onClick={() => setQty((q) => Math.max(1, q - 1))}>
            <Minus className="h-4 w-4" />
          </Button>
          <Input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Math.max(1, Math.floor(Number(e.target.value)) || 1))}
            className="w-20 text-center"
          />
          <Button size="icon" variant="outline" onClick={() => setQty((q) => q + 1)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="rounded-lg bg-primary/5 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Final price ({qty} ×)</span>
            <span className="font-bold">{fmt(line.total)}</span>
          </div>
          {savings > 0 && (
            <p className="mt-1 text-xs text-primary">You save {fmt(savings)} against MRP</p>
          )}
        </div>
        <Button
          className="h-12 w-full text-base font-semibold"
          onClick={() => {
            onAdd(product, qty);
            setQty(1);
          }}
        >
          Add to cart
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="truncate font-medium">{value || "Not available"}</p>
    </div>
  );
}

/** Shown when a scanned barcode isn't in the catalogue yet. */
function QuickAddDialog({
  barcode,
  onClose,
  onCreated,
}: {
  barcode: string | null;
  onClose: () => void;
  onCreated: (p: Product) => void;
}) {
  const settings = useSettings();
  const [form, setForm] = useState({ name: "", brand: "", mrp: "", price: "", stock: "", tax: "5", unit: "pcs" });
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={!!barcode} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Product not found</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Barcode <span className="font-mono text-foreground">{barcode}</span> isn't in your
          catalogue. Enter the details printed on the pack — nothing is auto-generated.
        </p>
        <div className="space-y-3">
          <TextField label="Product name" value={form.name} onChange={set("name")} />
          <TextField label="Brand" value={form.brand} onChange={set("brand")} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="MRP" type="number" value={form.mrp} onChange={set("mrp")} />
            <TextField label="Selling price" type="number" value={form.price} onChange={set("price")} />
            <TextField label="Stock" type="number" value={form.stock} onChange={set("stock")} />
            <TextField label="Unit" value={form.unit} onChange={set("unit")} />
          </div>
          <div className="space-y-1">
            <Label>GST rate</Label>
            <Select value={form.tax} onValueChange={set("tax")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {settings.gstSlabs.map((r) => (
                  <SelectItem key={r} value={String(r)}>
                    {r}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-full"
            disabled={!form.name || !form.price}
            onClick={() => {
              const mrp = Number(form.mrp) || Number(form.price);
              const product: Product = {
                id: uid(),
                barcode: barcode!,
                name: form.name.trim(),
                brand: form.brand.trim() || "Not available",
                category: "Uncategorised",
                subcategory: "Not available",
                mrp,
                price: Number(form.price),
                cost: 0,
                stock: Number(form.stock) || 0,
                unit: form.unit || "pcs",
                tax: Number(form.tax),
                hsn: "Not available",
                lowStockAt: 5,
              };
              const error = validateProduct(product);
              if (error) {
                toast.error(error);
                return;
              }
              saveProduct(product);
              setForm({ name: "", brand: "", mrp: "", price: "", stock: "", tax: "5", unit: "pcs" });
              onCreated(product);
            }}
          >
            Add product &amp; add to bill
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TextField({
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
