/**
 * Local offline datastore (browser localStorage).
 * Mirrors the SQLite schema of a native POS app:
 *   products(id, barcode, name, category, price, cost, stock, unit, tax, lowStockAt)
 *   sales(id, createdAt, items[], subtotal, discount, tax, total, paymentMode, customer)
 */
import { useCallback, useEffect, useState } from "react";

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

const PRODUCTS_KEY = "mart.products";
const SALES_KEY = "mart.sales";

const SEED: Product[] = [
  { id: "p1", barcode: "8901030865278", name: "Toor Dal 1kg", category: "Grocery", price: 145, cost: 120, stock: 42, unit: "pkt", tax: 5, lowStockAt: 10 },
  { id: "p2", barcode: "8901058000108", name: "Maggi Noodles 70g", category: "Snacks", price: 14, cost: 11, stock: 8, unit: "pkt", tax: 12, lowStockAt: 20 },
  { id: "p3", barcode: "8901725100018", name: "Amul Milk 500ml", category: "Dairy", price: 27, cost: 24, stock: 60, unit: "pouch", tax: 0, lowStockAt: 15 },
  { id: "p4", barcode: "8904004400021", name: "Sunflower Oil 1L", category: "Grocery", price: 132, cost: 118, stock: 25, unit: "btl", tax: 5, lowStockAt: 8 },
  { id: "p5", barcode: "8901063014008", name: "Britannia Good Day", category: "Snacks", price: 30, cost: 24, stock: 4, unit: "pkt", tax: 18, lowStockAt: 12 },
  { id: "p6", barcode: "8901396212003", name: "Colgate Paste 100g", category: "Personal Care", price: 55, cost: 45, stock: 30, unit: "pcs", tax: 18, lowStockAt: 10 },
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

/** Reactive read of a store key; hydration-safe (loads in useEffect). */
function useStore<T>(key: string, fallback: T, seed?: T) {
  const [value, setValue] = useState<T>(fallback);

  const refresh = useCallback(() => {
    if (seed !== undefined && window.localStorage.getItem(key) === null) {
      window.localStorage.setItem(key, JSON.stringify(seed));
    }
    setValue(read<T>(key, fallback));
  }, [key]);

  useEffect(() => {
    refresh();
    const onChange = () => setValue(read<T>(key, fallback));
    window.addEventListener("mart:store", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("mart:store", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [key, refresh]);

  return value;
}

export function useProducts() {
  return useStore<Product[]>(PRODUCTS_KEY, [], SEED);
}

export function useSales() {
  return useStore<Sale[]>(SALES_KEY, [], []);
}

export function saveProduct(product: Product) {
  const all = read<Product[]>(PRODUCTS_KEY, []);
  const idx = all.findIndex((p) => p.id === product.id);
  if (idx >= 0) all[idx] = product;
  else all.unshift(product);
  write(PRODUCTS_KEY, all);
}

export function deleteProduct(id: string) {
  write(
    PRODUCTS_KEY,
    read<Product[]>(PRODUCTS_KEY, []).filter((p) => p.id !== id),
  );
}

export function findByBarcode(barcode: string) {
  return read<Product[]>(PRODUCTS_KEY, []).find((p) => p.barcode === barcode) ?? null;
}

/** Billing math: line totals, GST per item, discount applied on subtotal. */
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

/** Commits a sale and decrements stock atomically. */
export function checkout(
  items: CartItem[],
  discountPercent: number,
  paymentMode: Sale["paymentMode"],
  customer?: string,
): Sale {
  const totals = computeTotals(items, discountPercent);
  const sales = read<Sale[]>(SALES_KEY, []);
  const sale: Sale = {
    id: uid(),
    invoiceNo: `INV-${String(sales.length + 1).padStart(5, "0")}`,
    createdAt: new Date().toISOString(),
    items,
    ...totals,
    paymentMode,
    customer,
  };
  write(SALES_KEY, [sale, ...sales]);

  const products = read<Product[]>(PRODUCTS_KEY, []);
  for (const item of items) {
    const p = products.find((x) => x.id === item.productId);
    if (p) p.stock = Math.max(0, p.stock - item.qty);
  }
  write(PRODUCTS_KEY, products);
  return sale;
}