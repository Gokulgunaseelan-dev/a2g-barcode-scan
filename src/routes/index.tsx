import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { Camera, Minus, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { BarcodeScanner } from "@/components/BarcodeScanner";
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
import { downloadReceipt } from "@/lib/receipt";
import {
  computeTotals,
  checkout,
  findByBarcode,
  money,
  saveProduct,
  uid,
  useProducts,
  type CartItem,
  type Product,
  type Sale,
} from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FreshMart POS — Supermarket Barcode Billing" },
      {
        name: "description",
        content:
          "Scan barcodes with your phone camera, build a cart, apply GST and discounts, and print PDF receipts — all offline.",
      },
      { property: "og:title", content: "FreshMart POS — Supermarket Barcode Billing" },
      {
        property: "og:description",
        content: "Fast supermarket checkout: camera barcode scanning, GST billing and PDF receipts.",
      },
    ],
  }),
  component: Billing,
});

function Billing() {
  const products = useProducts();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [query, setQuery] = useState("");
  const [discount, setDiscount] = useState(0);
  const [payment, setPayment] = useState<Sale["paymentMode"]>("Cash");
  const [scanning, setScanning] = useState(false);
  const [newBarcode, setNewBarcode] = useState<string | null>(null);
  const [lastSale, setLastSale] = useState<Sale | null>(null);

  const totals = useMemo(() => computeTotals(cart, discount), [cart, discount]);

  const addProduct = useCallback((product: Product) => {
    setCart((prev) => {
      const found = prev.find((i) => i.productId === product.id);
      if (found)
        return prev.map((i) => (i.productId === product.id ? { ...i, qty: i.qty + 1 } : i));
      return [
        ...prev,
        {
          productId: product.id,
          barcode: product.barcode,
          name: product.name,
          price: product.price,
          tax: product.tax,
          qty: 1,
        },
      ];
    });
    toast.success(`${product.name} added`);
  }, []);

  const handleCode = useCallback(
    (code: string) => {
      setScanning(false);
      const product = findByBarcode(code.trim());
      if (product) addProduct(product);
      else setNewBarcode(code.trim());
    },
    [addProduct],
  );

  const setQty = (id: string, delta: number) =>
    setCart((prev) =>
      prev
        .map((i) => (i.productId === id ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0),
    );

  const results = query
    ? products
        .filter(
          (p) =>
            p.name.toLowerCase().includes(query.toLowerCase()) || p.barcode.includes(query),
        )
        .slice(0, 6)
    : [];

  const completeSale = () => {
    if (!cart.length) return;
    const sale = checkout(cart, discount, payment);
    setLastSale(sale);
    setCart([]);
    setDiscount(0);
  };

  return (
    <AppShell title="New Bill">
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button className="h-12 flex-1 gap-2 text-base" onClick={() => setScanning(true)}>
            <Camera className="h-5 w-5" /> Scan barcode
          </Button>
        </div>

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
                  addProduct(p);
                  setQuery("");
                }}
              >
                <span>
                  <span className="block text-sm font-medium">{p.name}</span>
                  <span className="block text-xs text-muted-foreground">{p.barcode}</span>
                </span>
                <span className="text-sm font-semibold">{money(p.price)}</span>
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
                <li key={item.productId} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {money(item.price)} · GST {item.tax}%
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setQty(item.productId, -1)}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-7 text-center text-sm font-semibold">{item.qty}</span>
                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setQty(item.productId, 1)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <span className="w-20 text-right text-sm font-semibold">
                    {money(item.price * item.qty)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="discount">Discount %</Label>
              <Input
                id="discount"
                type="number"
                min={0}
                max={100}
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value) || 0)}
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

          <dl className="space-y-1 text-sm">
            <Row label="Subtotal" value={money(totals.subtotal)} />
            <Row label="Discount" value={`- ${money(totals.discount)}`} />
            <Row label="GST" value={money(totals.tax)} />
            <div className="flex justify-between border-t border-border pt-2 text-lg font-bold">
              <dt>Total</dt>
              <dd>{money(totals.total)}</dd>
            </div>
          </dl>

          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setCart([])} disabled={!cart.length}>
              <Trash2 className="h-4 w-4" /> Clear
            </Button>
            <Button className="h-11 flex-1 text-base" onClick={completeSale} disabled={!cart.length}>
              Charge {money(totals.total)}
            </Button>
          </div>
        </Card>
      </div>

      <Dialog open={scanning} onOpenChange={setScanning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scan barcode</DialogTitle>
          </DialogHeader>
          {scanning && <BarcodeScanner onDetected={handleCode} onClose={() => setScanning(false)} />}
        </DialogContent>
      </Dialog>

      <QuickAddDialog
        barcode={newBarcode}
        onClose={() => setNewBarcode(null)}
        onCreated={(p) => {
          setNewBarcode(null);
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
                {lastSale.invoiceNo} · {lastSale.items.length} items · {lastSale.paymentMode}
              </p>
              <p className="text-3xl font-bold">{money(lastSale.total)}</p>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => downloadReceipt(lastSale)}>
                  Download receipt
                </Button>
                <Button variant="outline" onClick={() => setLastSale(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
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
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");

  return (
    <Dialog open={!!barcode} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New product</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Barcode <span className="font-mono text-foreground">{barcode}</span> isn't in your
          catalogue.
        </p>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="qa-name">Product name</Label>
            <Input id="qa-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="qa-price">Price</Label>
              <Input id="qa-price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="qa-stock">Stock</Label>
              <Input id="qa-stock" type="number" value={stock} onChange={(e) => setStock(e.target.value)} />
            </div>
          </div>
          <Button
            className="w-full"
            disabled={!name || !price}
            onClick={() => {
              const product: Product = {
                id: uid(),
                barcode: barcode!,
                name,
                category: "Uncategorised",
                price: Number(price),
                cost: Number(price) * 0.8,
                stock: Number(stock) || 0,
                unit: "pcs",
                tax: 5,
                lowStockAt: 5,
              };
              saveProduct(product);
              setName("");
              setPrice("");
              setStock("");
              onCreated(product);
            }}
          >
            Save & add to bill
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
