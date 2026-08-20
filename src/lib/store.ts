/**
 * SMARTCART datastore — cloud persistence (Lovable Cloud / Postgres) with a
 * synchronous in-memory mirror so the existing UI keeps its simple API.
 *
 * Tables:
 *   products(id, user_id, barcode, name, brand, category, subcategory, mrp,
 *            price, cost, stock, unit, tax, hsn, image, low_stock_at)
 *   sales(id, user_id, invoice_no, totals, gst split, payment, session timing)
 *   sale_items(sale_id, product_id, barcode, name, mrp, price, tax, qty)
 *   stock_movements(product_id, delta, reason, sale_id)  -- audit trail
 *   store_settings(user_id, store info, currency, GST slabs, role, queue)
 *
 * Writes go through the database (stock changes via the secure
 * `checkout_sale` / `adjust_stock` RPCs) and are mirrored optimistically into
 * the local cache, which every hook below reads from.
 *
 * All currency math is done in integer paise (decimal-safe), then converted back.
 */
import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

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
const num = (v: unknown, fallback = 0) => (v === null || v === undefined ? fallback : Number(v));

/* ------------------------------ local mirror ------------------------------ */

type Cache = { products: Product[]; sales: Sale[]; settings: Settings; loaded: boolean };

const cache: Cache = { products: [], sales: [], settings: DEFAULT_SETTINGS, loaded: false };

const CHANGE_EVENT = "mart:store";

function emit() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10);

/* -------------------------------- mapping -------------------------------- */

type Row = Record<string, unknown>;

function toProduct(r: Row): Product {
  return {
    id: String(r["id"]),
    barcode: (r["barcode"] as string) ?? "",
    name: (r["name"] as string) ?? "",
    brand: (r["brand"] as string) ?? NA,
    category: (r["category"] as string) ?? "Uncategorised",
    subcategory: (r["subcategory"] as string) ?? NA,
    mrp: num(r["mrp"]),
    price: num(r["price"]),
    cost: num(r["cost"]),
    stock: num(r["stock"]),
    unit: (r["unit"] as string) ?? "pcs",
    tax: num(r["tax"]),
    hsn: (r["hsn"] as string) ?? NA,
    image: (r["image"] as string) ?? undefined,
    lowStockAt: num(r["low_stock_at"], 5),
  };
}

function productRow(p: Product, userId: string): Row {
  return {
    id: p.id,
    user_id: userId,
    barcode: p.barcode,
    name: p.name,
    brand: p.brand || NA,
    category: p.category || "Uncategorised",
    subcategory: p.subcategory || NA,
    mrp: p.mrp,
    price: p.price,
    cost: p.cost,
    stock: p.stock,
    unit: p.unit || "pcs",
    tax: p.tax,
    hsn: p.hsn || NA,
    image: p.image ?? null,
    low_stock_at: p.lowStockAt,
  };
}

function toCartItem(r: Row): CartItem {
  return {
    productId: (r["product_id"] as string) ?? "",
    barcode: (r["barcode"] as string) ?? "",
    name: (r["name"] as string) ?? "",
    brand: (r["brand"] as string) ?? undefined,
    mrp: num(r["mrp"]),
    price: num(r["price"]),
    tax: num(r["tax"]),
    unit: (r["unit"] as string) ?? undefined,
    qty: num(r["qty"], 1),
  };
}

function toSale(r: Row): Sale {
  const items = Array.isArray(r["sale_items"]) ? (r["sale_items"] as Row[]).map(toCartItem) : [];
  return {
    id: String(r["id"]),
    invoiceNo: (r["invoice_no"] as string) ?? "",
    createdAt: (r["created_at"] as string) ?? new Date().toISOString(),
    items,
    mrpTotal: num(r["mrp_total"]),
    subtotal: num(r["subtotal"]),
    discount: num(r["discount"]),
    savings: num(r["savings"]),
    taxable: num(r["taxable"]),
    tax: num(r["tax"]),
    cgst: num(r["cgst"]),
    sgst: num(r["sgst"]),
    igst: num(r["igst"]),
    taxMode: (r["tax_mode"] as TaxMode) ?? "intra",
    total: num(r["total"]),
    paymentMode: (r["payment_mode"] as Sale["paymentMode"]) ?? "Cash",
    customer: (r["customer"] as string) ?? undefined,
    sessionId: (r["session_id"] as string) ?? undefined,
    startedAt: (r["started_at"] as string) ?? undefined,
    completedAt: (r["completed_at"] as string) ?? undefined,
    durationSec: num(r["duration_sec"]),
    demo: Boolean(r["demo"]),
  };
}

function toSettings(r: Row | null): Settings {
  if (!r) return DEFAULT_SETTINGS;
  const queue = (r["queue"] as Settings["queue"]) ?? DEFAULT_SETTINGS.queue;
  const slabs = (r["gst_slabs"] as unknown[] | null)?.map((s) => num(s)) ?? [];
  return {
    storeName: (r["store_name"] as string) ?? DEFAULT_SETTINGS.storeName,
    address: (r["address"] as string) ?? DEFAULT_SETTINGS.address,
    gstin: (r["gstin"] as string) ?? DEFAULT_SETTINGS.gstin,
    currency: (r["currency"] as CurrencyCode) ?? "INR",
    rate: num(r["rate"], 1),
    rateSource: (r["rate_source"] as string) ?? DEFAULT_SETTINGS.rateSource,
    taxMode: (r["tax_mode"] as TaxMode) ?? "intra",
    gstSlabs: slabs.length ? slabs : DEFAULT_SETTINGS.gstSlabs,
    role: (r["role"] as Role) ?? "cashier",
    adminPinHash: (r["admin_pin_hash"] as string) ?? DEFAULT_PIN_HASH,
    queue: { ...DEFAULT_SETTINGS.queue, ...queue },
  };
}

function settingsRow(s: Settings, userId: string): Row {
  return {
    user_id: userId,
    store_name: s.storeName,
    address: s.address,
    gstin: s.gstin,
    currency: s.currency,
    rate: s.rate,
    rate_source: s.rateSource,
    tax_mode: s.taxMode,
    gst_slabs: s.gstSlabs,
    role: s.role,
    admin_pin_hash: s.adminPinHash,
    queue: s.queue,
  };
}

/* ------------------------------ sync with DB ------------------------------ */

let currentUserId: string | null = null;
let loading: Promise<void> | null = null;

async function userId(): Promise<string | null> {
  if (currentUserId) return currentUserId;
  const { data } = await supabase.auth.getSession();
  currentUserId = data.session?.user.id ?? null;
  return currentUserId;
}

/** Loads the signed-in store's data into the local mirror. */
export async function loadStore(force = false): Promise<void> {
  if (loading && !force) return loading;
  loading = (async () => {
    const id = await userId();
    if (!id) {
      cache.products = [];
      cache.sales = [];
      cache.settings = DEFAULT_SETTINGS;
      cache.loaded = false;
      emit();
      return;
    }
    const [products, sales, settings] = await Promise.all([
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase
        .from("sales")
        .select("*, sale_items(*)")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("store_settings").select("*").maybeSingle(),
    ]);
    cache.products = (products.data ?? []).map((r) => toProduct(r as Row));
    cache.sales = (sales.data ?? []).map((r) => toSale(r as Row));
    cache.settings = toSettings((settings.data as Row | null) ?? null);
    cache.loaded = true;
    emit();
  })();
  try {
    await loading;
  } finally {
    loading = null;
  }
}

/** Called by the auth listener when the session changes. */
export function resetStore(newUserId: string | null) {
  currentUserId = newUserId;
  cache.products = [];
  cache.sales = [];
  cache.settings = DEFAULT_SETTINGS;
  cache.loaded = false;
  emit();
  if (newUserId) void loadStore(true);
}

/* --------------------------------- hooks --------------------------------- */

function useCache<T>(select: (c: Cache) => T): T {
  const [value, setValue] = useState<T>(() => select(cache));
  const sync = useCallback(() => setValue(select(cache)), [select]);

  useEffect(() => {
    sync();
    if (!cache.loaded) void loadStore();
    window.addEventListener(CHANGE_EVENT, sync);
    return () => window.removeEventListener(CHANGE_EVENT, sync);
  }, [sync]);

  return value;
}

const selectProducts = (c: Cache) => c.products;
const selectSales = (c: Cache) => c.sales;
const selectSettings = (c: Cache) => c.settings;
const selectLoaded = (c: Cache) => c.loaded;

export function useProducts() {
  return useCache(selectProducts);
}

export function useSales() {
  return useCache(selectSales);
}

export function useSettings(): Settings {
  return useCache(selectSettings);
}

export function useStoreLoaded() {
  return useCache(selectLoaded);
}

export function readSettings(): Settings {
  return cache.settings;
}

export function saveSettings(patch: Partial<Settings>) {
  const next = { ...cache.settings, ...patch };
  cache.settings = next;
  emit();
  void (async () => {
    const id = await userId();
    if (!id) return;
    const { error } = await supabase
      .from("store_settings")
      .upsert(settingsRow(next, id) as never, { onConflict: "user_id" });
    if (error) console.error("saveSettings", error);
  })();
}

export async function hashPin(pin: string) {
  const data = new TextEncoder().encode(pin);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function saveProduct(product: Product) {
  const all = [...cache.products];
  const idx = all.findIndex((p) => p.id === product.id);
  const previousStock = idx >= 0 ? all[idx]!.stock : 0;
  if (idx >= 0) all[idx] = product;
  else all.unshift(product);
  cache.products = all;
  emit();

  void (async () => {
    const id = await userId();
    if (!id) return;
    const { error } = await supabase
      .from("products")
      .upsert(productRow(product, id) as never, { onConflict: "id" });
    if (error) {
      console.error("saveProduct", error);
      return;
    }
    const delta = product.stock - previousStock;
    if (delta !== 0) {
      await supabase.from("stock_movements").insert({
        user_id: id,
        product_id: product.id,
        delta,
        reason: idx >= 0 ? "adjustment" : "opening",
      } as never);
    }
  })();
}

export function deleteProduct(id: string) {
  cache.products = cache.products.filter((p) => p.id !== id);
  emit();
  void (async () => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) console.error("deleteProduct", error);
  })();
}

/** Secure stock change with audit trail (uses the adjust_stock RPC). */
export async function adjustStock(productId: string, delta: number, reason = "adjustment") {
  const { data, error } = await supabase.rpc("adjust_stock", {
    p_product_id: productId,
    p_delta: delta,
    p_reason: reason,
  } as never);
  if (error) {
    console.error("adjustStock", error);
    throw error;
  }
  const stock = num(data);
  cache.products = cache.products.map((p) => (p.id === productId ? { ...p, stock } : p));
  emit();
  return stock;
}

export function findByBarcode(barcode: string) {
  return cache.products.find((p) => p.barcode === barcode) ?? null;
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
 *   GST           = Σ (line taxable × GST rate / 100)   ← GST after discount
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

/**
 * Commits a sale: records billing duration, persists the bill through the
 * atomic `checkout_sale` database function (bill + lines + stock decrement +
 * stock audit trail) and mirrors the result locally for the receipt.
 */
export function checkout(
  items: CartItem[],
  discountPercent: number,
  paymentMode: Sale["paymentMode"],
  opts: { customer?: string; startedAt?: string; sessionId?: string; demo?: boolean } = {},
): Sale {
  const settings = cache.settings;
  const totals = computeTotals(items, discountPercent, settings.taxMode);
  const completedAt = new Date().toISOString();
  const startedAt = opts.startedAt ?? completedAt;
  const sale: Sale = {
    id: uid(),
    invoiceNo: `INV-${String(cache.sales.length + 1).padStart(5, "0")}`,
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

  // Optimistic local mirror so the receipt and dashboards update instantly.
  cache.sales = [sale, ...cache.sales];
  cache.products = cache.products.map((p) => {
    const line = items.find((i) => i.productId === p.id);
    return line ? { ...p, stock: Math.max(0, p.stock - line.qty) } : p;
  });
  emit();

  void (async () => {
    const id = await userId();
    if (!id) return;
    const { error } = await supabase.rpc("checkout_sale", {
      p_sale: {
        invoice_no: sale.invoiceNo,
        mrp_total: sale.mrpTotal,
        subtotal: sale.subtotal,
        discount: sale.discount,
        savings: sale.savings,
        taxable: sale.taxable,
        tax: sale.tax,
        cgst: sale.cgst,
        sgst: sale.sgst,
        igst: sale.igst,
        tax_mode: sale.taxMode,
        total: sale.total,
        payment_mode: sale.paymentMode,
        customer: sale.customer ?? "",
        session_id: sale.sessionId ?? "",
        started_at: sale.startedAt,
        completed_at: sale.completedAt,
        duration_sec: sale.durationSec,
        demo: sale.demo ?? false,
      },
      p_items: items.map((i) => ({
        product_id: i.productId,
        barcode: i.barcode,
        name: i.name,
        brand: i.brand ?? null,
        mrp: i.mrp,
        price: i.price,
        tax: i.tax,
        unit: i.unit ?? null,
        qty: i.qty,
      })),
    } as never);
    if (error) {
      console.error("checkout", error);
      return;
    }
    await loadStore(true);
  })();

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
