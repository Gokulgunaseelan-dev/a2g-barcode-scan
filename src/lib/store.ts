/**
 * SMARTCART local offline datastore (browser localStorage).
 * Mirrors the SQLite schema of a native POS app:
 *   products(id, barcode, name, brand, category, subcategory, mrp, price, cost,
 *            stock, unit, tax, hsn, image, lowStockAt)
 *   sales(id, invoiceNo, createdAt, items[], subtotal, discount, tax, total, ...)
 *   settings(store info, currency, GST slabs, tax mode, role, queue defaults)
 *
 * All currency math is done in integer paise (decimal-safe), then converted back.
 */
import { useCallback, useEffect, useState } from "react";

export type Product = {
  id: string;
  barcode: string;
  name: string;
  brand: string;
  category: string;
  subcategory: string;
  mrp: number;
  price: number; // selling price (GST exclusive)
  cost: number;
  stock: number;
  unit: string;
  tax: number; // GST %
  hsn: string;
  image?: string;
  lowStockAt: number;
};

export type CartItem = {
  productId: string;
  barcode: string;
  name: string;
  brand?: string;
  mrp: number;
  price: number;
  tax: number;
  unit?: string;
  qty: number;
};

export type TaxMode = "intra" | "inter";

export type Sale = {
  id: string;
  invoiceNo: string;
  createdAt: string;
  items: CartItem[];
  mrpTotal: number;
  subtotal: number;
  discount: number; // bill-level discount amount
  savings: number; // MRP savings + bill discount
  taxable: number;
  tax: number;
  cgst: number;
  sgst: number;
  igst: number;
  taxMode: TaxMode;
  total: number;
  paymentMode: "Cash" | "Card" | "UPI";
  customer?: string;
  /** Billing session telemetry (feeds SmartQueue service-rate math). */
  sessionId?: string;
  startedAt?: string;
  completedAt?: string;
  durationSec?: number;
  demo?: boolean;
};

export type Role = "admin" | "cashier";

export type CurrencyCode = "INR" | "USD" | "EUR" | "GBP" | "AED" | "SGD" | "JPY";

export type Settings = {
  storeName: string;
  address: string;
  gstin: string;
  currency: CurrencyCode;
  /** Units of the selected currency per 1 INR (manual rate, 1 for INR). */
  rate: number;
  rateSource: string;
  taxMode: TaxMode;
  gstSlabs: number[];
  role: Role;
  adminPinHash: string;
  queue: { lambda: number; mu: number; counters: number };
};

const PRODUCTS_KEY = "mart.products";
const SALES_KEY = "mart.sales";
const SETTINGS_KEY = "mart.settings";

/** SHA-256 of "1234" — the default admin PIN, changeable in Settings. */
const DEFAULT_PIN_HASH = "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4";

export const DEFAULT_SETTINGS: Settings = {
  storeName: "SmartCart Supermarket",
  address: "Not available",
  gstin: "Not available",
  currency: "INR",
  rate: 1,
  rateSource: "Manual entry",
  taxMode: "intra",
  gstSlabs: [0, 5, 12, 18, 28],
  role: "cashier",
  adminPinHash: DEFAULT_PIN_HASH,
  queue: { lambda: 12, mu: 5, counters: 2 },
};

const NA = "Not available";

const SEED: Product[] = [
  { id: "p1", barcode: "8901030865278", name: "Toor Dal 1kg", brand: NA, category: "Grocery", subcategory: "Pulses", mrp: 160, price: 145, cost: 120, stock: 42, unit: "pkt", tax: 5, hsn: NA, lowStockAt: 10 },
  { id: "p2", barcode: "8901058000108", name: "Instant Noodles 70g", brand: NA, category: "Snacks", subcategory: "Instant food", mrp: 15, price: 14, cost: 11, stock: 8, unit: "pkt", tax: 12, hsn: NA, lowStockAt: 20 },
  { id: "p3", barcode: "8901725100018", name: "Toned Milk 500ml", brand: NA, category: "Dairy", subcategory: "Milk", mrp: 28, price: 27, cost: 24, stock: 60, unit: "pouch", tax: 0, hsn: NA, lowStockAt: 15 },
  { id: "p4", barcode: "8904004400021", name: "Sunflower Oil 1L", brand: NA, category: "Grocery", subcategory: "Edible oil", mrp: 145, price: 132, cost: 118, stock: 25, unit: "btl", tax: 5, hsn: NA, lowStockAt: 8 },
  { id: "p5", barcode: "8901063014008", name: "Butter Biscuits 200g", brand: NA, category: "Snacks", subcategory: "Biscuits", mrp: 35, price: 30, cost: 24, stock: 4, unit: "pkt", tax: 18, hsn: NA, lowStockAt: 12 },
  { id: "p6", barcode: "8901396212003", name: "Toothpaste 100g", brand: NA, category: "Personal Care", subcategory: "Oral care", mrp: 60, price: 55, cost: 45, stock: 30, unit: "pcs", tax: 18, hsn: NA, lowStockAt: 10 },
];

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("mart:store", { detail: key }));
}

export const uid = () => Math.random().toString(36).slice(2, 10);

/** Backfills fields added after the first release so old data keeps working. */
function migrateProduct(p: Partial<Product> & { id: string }): Product {
  return {
    id: p.id,
    barcode: p.barcode ?? "",
    name: p.name ?? "",
    brand: p.brand ?? NA,
    category: p.category ?? "Uncategorised",
    subcategory: p.subcategory ?? NA,
    mrp: p.mrp ?? p.price ?? 0,
    price: p.price ?? 0,
    cost: p.cost ?? 0,
    stock: p.stock ?? 0,
    unit: p.unit ?? "pcs",
    tax: p.tax ?? 0,
    hsn: p.hsn ?? NA,
    image: p.image,
    lowStockAt: p.lowStockAt ?? 5,
  };
}

function readProducts(): Product[] {
  return read<Product[]>(PRODUCTS_KEY, []).map(migrateProduct);
}

/** Reactive read of a store key; hydration-safe (loads in useEffect). */
function useStore<T>(key: string, fallback: T, seed?: T, map?: (v: T) => T) {
  const [value, setValue] = useState<T>(fallback);

  const load = useCallback(() => {
    const raw = read<T>(key, fallback);
    setValue(map ? map(raw) : raw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const refresh = useCallback(() => {
    if (seed !== undefined && window.localStorage.getItem(key) === null) {
      window.localStorage.setItem(key, JSON.stringify(seed));
    }
    load();
  }, [key, load]);

  useEffect(() => {
    refresh();
    window.addEventListener("mart:store", load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener("mart:store", load);
      window.removeEventListener("storage", load);
    };
  }, [key, refresh, load]);

  return value;
}

export function useProducts() {
  return useStore<Product[]>(PRODUCTS_KEY, [], SEED, (list) => list.map(migrateProduct));
}

export function useSales() {
  return useStore<Sale[]>(SALES_KEY, [], []);
}

export function useSettings(): Settings {
  return useStore<Settings>(SETTINGS_KEY, DEFAULT_SETTINGS, DEFAULT_SETTINGS, (s) => ({
    ...DEFAULT_SETTINGS,
    ...s,
    queue: { ...DEFAULT_SETTINGS.queue, ...(s?.queue ?? {}) },
    gstSlabs: s?.gstSlabs?.length ? s.gstSlabs : DEFAULT_SETTINGS.gstSlabs,
  }));
}

export function readSettings(): Settings {
  const s = read<Partial<Settings>>(SETTINGS_KEY, {});
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    queue: { ...DEFAULT_SETTINGS.queue, ...(s.queue ?? {}) },
    gstSlabs: s.gstSlabs?.length ? s.gstSlabs : DEFAULT_SETTINGS.gstSlabs,
  };
}

export function saveSettings(patch: Partial<Settings>) {
  write(SETTINGS_KEY, { ...readSettings(), ...patch });
}

export async function hashPin(pin: string) {
  const data = new TextEncoder().encode(pin);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function saveProduct(product: Product) {
  const all = readProducts();
  const idx = all.findIndex((p) => p.id === product.id);
  if (idx >= 0) all[idx] = product;
  else all.unshift(product);
  write(PRODUCTS_KEY, all);
}

export function deleteProduct(id: string) {
  write(PRODUCTS_KEY, readProducts().filter((p) => p.id !== id));
}

export function findByBarcode(barcode: string) {
  return readProducts().find((p) => p.barcode === barcode) ?? null;
}

/** IN STOCK / LOW STOCK / OUT OF STOCK */
export function stockStatus(p: Product) {
  if (p.stock <= 0) return "OUT OF STOCK" as const;
  if (p.stock <= p.lowStockAt) return "LOW STOCK" as const;
  return "IN STOCK" as const;
}

/* ------------------------------- validation ------------------------------- */

export function validateProduct(p: Product, allowAboveMrp = false): string | null {
  if (!p.name.trim()) return "Product name is required.";
  if (p.barcode && !/^[0-9A-Za-z-]{4,20}$/.test(p.barcode)) return "Barcode must be 4-20 letters/digits.";
  if (p.mrp < 0 || p.price < 0 || p.cost < 0) return "Prices cannot be negative.";
  if (p.stock < 0) return "Stock cannot be negative.";
  if (p.tax < 0 || p.tax > 100) return "GST % must be between 0 and 100.";
  if (p.lowStockAt < 0) return "Low-stock threshold cannot be negative.";
  if (!allowAboveMrp && p.mrp > 0 && p.price > p.mrp) return "Selling price cannot exceed MRP.";
  return null;
}

/* --------------------------------- money --------------------------------- */

const paise = (n: number) => Math.round(n * 100);
const rupees = (p: number) => p / 100;
export const round = (n: number) => Math.round(n * 100) / 100;

const LOCALES: Record<CurrencyCode, string> = {
  INR: "en-IN",
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
  AED: "ar-AE",
  SGD: "en-SG",
  JPY: "ja-JP",
};

export function formatMoney(amountInInr: number, settings: Settings = DEFAULT_SETTINGS) {
  const rate = settings.rate > 0 ? settings.rate : 1;
  return new Intl.NumberFormat(LOCALES[settings.currency] ?? "en-IN", {
    style: "currency",
    currency: settings.currency,
  }).format(amountInInr * rate);
}

/** Default INR formatter (used where settings are not in scope). */
export const money = (n: number) => formatMoney(n, DEFAULT_SETTINGS);

/** Reactive formatter honouring the selected display currency. */
export function useMoney() {
  const settings = useSettings();
  return useCallback((n: number) => formatMoney(n, settings), [settings]);
}

/* -------------------------------- billing -------------------------------- */

export type Totals = {
  items: number;
  qty: number;
  mrpTotal: number;
  subtotal: number;
  mrpSavings: number;
  discount: number;
  savings: number;
  taxable: number;
  tax: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  avgPerItem: number;
  byRate: { rate: number; taxable: number; tax: number }[];
};

/**
 * Billing math (decimal-safe, integer paise):
 *   Subtotal      = Σ selling price × qty
 *   MRP savings   = Σ (MRP - selling price) × qty
 *   Discount      = Subtotal × discount% / 100
 *   Taxable value = Subtotal - Discount
 *   GST           = Σ (line taxable × GST rate / 100)
 *   Final amount  = Taxable value + GST
 */
export function computeTotals(
  items: CartItem[],
  discountPercent: number,
  taxMode: TaxMode = "intra",
): Totals {
  const subtotalP = items.reduce((s, i) => s + paise(i.price) * i.qty, 0);
  const mrpTotalP = items.reduce((s, i) => s + paise(i.mrp || i.price) * i.qty, 0);
  const pct = Math.min(100, Math.max(0, discountPercent || 0));
  const discountP = Math.round((subtotalP * pct) / 100);
  const taxableP = subtotalP - discountP;

  const rates = new Map<number, { taxable: number; tax: number }>();
  let taxP = 0;
  for (const i of items) {
    const lineP = paise(i.price) * i.qty;
    const lineTaxableP = subtotalP > 0 ? Math.round((lineP * taxableP) / subtotalP) : 0;
    const lineTaxP = Math.round((lineTaxableP * i.tax) / 100);
    taxP += lineTaxP;
    const acc = rates.get(i.tax) ?? { taxable: 0, tax: 0 };
    rates.set(i.tax, { taxable: acc.taxable + lineTaxableP, tax: acc.tax + lineTaxP });
  }

  const totalP = taxableP + taxP;
  const qty = items.reduce((s, i) => s + i.qty, 0);
  const halfP = Math.round(taxP / 2);

  return {
    items: items.length,
    qty,
    mrpTotal: rupees(mrpTotalP),
    subtotal: rupees(subtotalP),
    mrpSavings: rupees(mrpTotalP - subtotalP),
    discount: rupees(discountP),
    savings: rupees(mrpTotalP - subtotalP + discountP),
    taxable: rupees(taxableP),
    tax: rupees(taxP),
    cgst: taxMode === "intra" ? rupees(halfP) : 0,
    sgst: taxMode === "intra" ? rupees(taxP - halfP) : 0,
    igst: taxMode === "inter" ? rupees(taxP) : 0,
    total: rupees(totalP),
    avgPerItem: qty > 0 ? rupees(Math.round(totalP / qty)) : 0,
    byRate: [...rates.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([rate, v]) => ({ rate, taxable: rupees(v.taxable), tax: rupees(v.tax) })),
  };
}

export const discountPercentOf = (mrp: number, price: number) =>
  mrp > 0 ? round(((mrp - price) / mrp) * 100) : 0;

export function cartItemOf(p: Product, qty = 1): CartItem {
  return {
    productId: p.id,
    barcode: p.barcode,
    name: p.name,
    brand: p.brand,
    mrp: p.mrp || p.price,
    price: p.price,
    tax: p.tax,
    unit: p.unit,
    qty,
  };
}

/** Commits a sale, records billing duration and decrements stock. */
export function checkout(
  items: CartItem[],
  discountPercent: number,
  paymentMode: Sale["paymentMode"],
  opts: { customer?: string; startedAt?: string; sessionId?: string; demo?: boolean } = {},
): Sale {
  const settings = readSettings();
  const totals = computeTotals(items, discountPercent, settings.taxMode);
  const sales = read<Sale[]>(SALES_KEY, []);
  const completedAt = new Date().toISOString();
  const startedAt = opts.startedAt ?? completedAt;
  const sale: Sale = {
    id: uid(),
    invoiceNo: `INV-${String(sales.length + 1).padStart(5, "0")}`,
    createdAt: completedAt,
    items,
    mrpTotal: totals.mrpTotal,
    subtotal: totals.subtotal,
    discount: totals.discount,
    savings: totals.savings,
    taxable: totals.taxable,
    tax: totals.tax,
    cgst: totals.cgst,
    sgst: totals.sgst,
    igst: totals.igst,
    taxMode: settings.taxMode,
    total: totals.total,
    paymentMode,
    customer: opts.customer,
    sessionId: opts.sessionId ?? uid(),
    startedAt,
    completedAt,
    durationSec: Math.max(1, Math.round((Date.parse(completedAt) - Date.parse(startedAt)) / 1000)),
    demo: opts.demo,
  };
  write(SALES_KEY, [sale, ...sales]);

  const products = readProducts();
  for (const item of items) {
    const p = products.find((x) => x.id === item.productId);
    if (p) p.stock = Math.max(0, p.stock - item.qty);
  }
  write(PRODUCTS_KEY, products);
  return sale;
}

/** Aggregates real bill telemetry for SmartQueue / analytics. */
export function billingStats(sales: Sale[]) {
  const timed = sales.filter((s) => (s.durationSec ?? 0) > 0);
  const avgSec = timed.length
    ? timed.reduce((s, x) => s + (x.durationSec ?? 0), 0) / timed.length
    : 0;
  const byHour = new Map<number, number>();
  for (const s of sales) {
    const h = new Date(s.createdAt).getHours();
    byHour.set(h, (byHour.get(h) ?? 0) + 1);
  }
  const peak = [...byHour.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    samples: timed.length,
    avgBillingSec: Math.round(avgSec),
    /** customers served per minute per counter */
    serviceRate: avgSec > 0 ? round(60 / avgSec) : 0,
    peakHour: peak ? peak[0] : null,
    peakBills: peak ? peak[1] : 0,
    byHour,
    hasEnoughData: timed.length >= 5,
  };
}
