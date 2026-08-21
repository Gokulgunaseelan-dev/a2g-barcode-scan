/**
 * Cloud datastore (backend database, per-user with row level security).
 *
 * Tables: products, sales, sale_items. Reads are cached in memory so the
 * billing screen can look up barcodes instantly; writes go straight to the
 * backend and refresh the cache.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Product = {
  id: string;
  barcode: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  unit: string;
  tax: number; // GST %
  lowStockAt: number;
};

export type CartItem = {
  productId: string;
  barcode: string;
  name: string;
  price: number;
  tax: number;
  qty: number;
};

export type Sale = {
  id: string;
  invoiceNo: string;
  createdAt: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMode: "Cash" | "Card" | "UPI";
  customer?: string;
};

export const uid = () => Math.random().toString(36).slice(2, 10);

const isUuid = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

/* ------------------------------------------------------------------ cache */

type Cache = { products: Product[]; sales: Sale[]; loaded: boolean };

const cache: Cache = { products: [], sales: [], loaded: false };
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

type ProductRow = {
  id: string;
  barcode: string | null;
  name: string;
  category: string | null;
  price: number | string;
  cost: number | string;
  stock: number | string;
  unit: string | null;
  tax: number | string;
  low_stock_at: number | string;
};

const num = (v: number | string | null | undefined) => Number(v ?? 0);

const toProduct = (r: ProductRow): Product => ({
  id: r.id,
  barcode: r.barcode ?? "",
  name: r.name,
  category: r.category ?? "Uncategorised",
  price: num(r.price),
  cost: num(r.cost),
  stock: num(r.stock),
  unit: r.unit ?? "pcs",
  tax: num(r.tax),
  lowStockAt: num(r.low_stock_at),
});

export async function loadProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("id, barcode, name, category, price, cost, stock, unit, tax, low_stock_at")
    .order("name");
  if (error) return;
  cache.products = (data as ProductRow[]).map(toProduct);
  notify();
}

export async function loadSales() {
  const { data, error } = await supabase
    .from("sales")
    .select(
      "id, invoice_no, created_at, subtotal, discount, tax, total, payment_mode, customer, sale_items(product_id, barcode, name, price, tax, qty)",
    )
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) return;
  cache.sales = (data ?? []).map((s: Record<string, unknown>) => ({
    id: s['id'] as string,
    invoiceNo: (s['invoice_no'] as string) ?? "INV",
    createdAt: s['created_at'] as string,
    subtotal: num(s['subtotal'] as number),
    discount: num(s['discount'] as number),
    tax: num(s['tax'] as number),
    total: num(s['total'] as number),
    paymentMode: ((s['payment_mode'] as string) ?? "Cash") as Sale["paymentMode"],
    customer: (s['customer'] as string) ?? undefined,
    items: ((s['sale_items'] as Record<string, unknown>[]) ?? []).map((i) => ({
      productId: (i['product_id'] as string) ?? "",
      barcode: (i['barcode'] as string) ?? "",
      name: i['name'] as string,
      price: num(i['price'] as number),
      tax: num(i['tax'] as number),
      qty: num(i['qty'] as number),
    })),
  }));
  notify();
}

export async function loadAll() {
  await Promise.all([loadProducts(), loadSales()]);
  cache.loaded = true;
  notify();
}

function useCache<T>(pick: (c: Cache) => T): T {
  const [value, setValue] = useState<T>(() => pick(cache));

  useEffect(() => {
    const update = () => setValue(pick(cache));
    listeners.add(update);
    update();
    if (!cache.loaded) void loadAll();
    return () => {
      listeners.delete(update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return value;
}

export function useProducts() {
  return useCache((c) => c.products);
}

export function useSales() {
  return useCache((c) => c.sales);
}

/* ------------------------------------------------------------------ writes */

export async function saveProduct(product: Product) {
  const row = {
    barcode: product.barcode,
    name: product.name,
    category: product.category,
    price: product.price,
    cost: product.cost,
    stock: product.stock,
    unit: product.unit,
    tax: product.tax,
    low_stock_at: product.lowStockAt,
  };

  if (isUuid(product.id)) {
    await supabase.from("products").update(row).eq("id", product.id);
  } else {
    const { data } = await supabase.from("products").insert(row).select("id").single();
    if (data?.id) product.id = data.id;
  }
  await loadProducts();
  return product;
}

export async function deleteProduct(id: string) {
  await supabase.from("products").delete().eq("id", id);
  await loadProducts();
}

/** Sync barcode lookup against the cached catalogue. */
export function findByBarcode(barcode: string) {
  return cache.products.find((p) => p.barcode === barcode) ?? null;
}

/* -------------------------------------------------------------- billing math */

export function computeTotals(items: CartItem[], discountPercent: number) {
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const discount = (subtotal * discountPercent) / 100;
  const taxable = subtotal - discount;
  const tax = items.reduce((s, i) => {
    const share = subtotal > 0 ? (i.price * i.qty) / subtotal : 0;
    return s + (taxable * share * i.tax) / 100;
  }, 0);
  const total = taxable + tax;
  return {
    subtotal: round(subtotal),
    discount: round(discount),
    tax: round(tax),
    total: round(total),
  };
}

export const round = (n: number) => Math.round(n * 100) / 100;

export const money = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);

/** Commits a sale in the backend (also decrements stock and logs movements). */
export async function checkout(
  items: CartItem[],
  discountPercent: number,
  paymentMode: Sale["paymentMode"],
  customer?: string,
): Promise<Sale> {
  const totals = computeTotals(items, discountPercent);
  const invoiceNo = `INV-${String(cache.sales.length + 1).padStart(5, "0")}`;
  const now = new Date().toISOString();

  const { data, error } = await supabase.rpc("checkout_sale", {
    p_sale: {
      invoice_no: invoiceNo,
      subtotal: totals.subtotal,
      discount: totals.discount,
      taxable: round(totals.subtotal - totals.discount),
      tax: totals.tax,
      total: totals.total,
      payment_mode: paymentMode,
      customer: customer ?? "",
      started_at: now,
      completed_at: now,
    },
    p_items: items.map((i) => ({
      product_id: isUuid(i.productId) ? i.productId : "",
      barcode: i.barcode,
      name: i.name,
      price: i.price,
      tax: i.tax,
      qty: i.qty,
    })),
  });
  if (error) throw error;

  const row = data as { id?: string; invoice_no?: string; created_at?: string } | null;
  const sale: Sale = {
    id: row?.id ?? uid(),
    invoiceNo: row?.invoice_no ?? invoiceNo,
    createdAt: row?.created_at ?? now,
    items,
    ...totals,
    paymentMode,
    customer,
  };

  await loadAll();
  return sale;
}
