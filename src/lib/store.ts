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
  { id: "p7", barcode: "8901491101813", name: "Lays Classic 52g", category: "Snacks", price: 20, cost: 15, stock: 48, unit: "pkt", tax: 12, lowStockAt: 15 },
  { id: "p8", barcode: "8901719110017", name: "Tata Salt 1kg", category: "Grocery", price: 28, cost: 23, stock: 55, unit: "pkt", tax: 5, lowStockAt: 12 },
  { id: "p9", barcode: "8901030574030", name: "Surf Excel 1kg", category: "Household", price: 130, cost: 112, stock: 18, unit: "pkt", tax: 18, lowStockAt: 6 },
  { id: "p10", barcode: "8901030618253", name: "Lifebuoy Soap 125g", category: "Personal Care", price: 38, cost: 30, stock: 40, unit: "pcs", tax: 18, lowStockAt: 10 },
  { id: "p11", barcode: "8901764054235", name: "Sunfeast Dark Fantasy", category: "Snacks", price: 45, cost: 36, stock: 22, unit: "pkt", tax: 18, lowStockAt: 8 },
  { id: "p12", barcode: "8901262010658", name: "Aashirvaad Atta 5kg", category: "Grocery", price: 285, cost: 255, stock: 16, unit: "pkt", tax: 5, lowStockAt: 5 },
  { id: "p13", barcode: "8901725110017", name: "Amul Butter 100g", category: "Dairy", price: 62, cost: 55, stock: 26, unit: "pkt", tax: 12, lowStockAt: 8 },
  { id: "p14", barcode: "8901058851298", name: "Nescafe Classic 50g", category: "Beverages", price: 175, cost: 155, stock: 14, unit: "jar", tax: 18, lowStockAt: 5 },
  { id: "p15", barcode: "8901030724152", name: "Red Label Tea 500g", category: "Beverages", price: 265, cost: 235, stock: 12, unit: "pkt", tax: 5, lowStockAt: 4 },
  { id: "p16", barcode: "8901764020025", name: "Bingo Mad Angles 66g", category: "Snacks", price: 20, cost: 15, stock: 36, unit: "pkt", tax: 12, lowStockAt: 12 },
  { id: "p17", barcode: "8901072000123", name: "Parle-G 250g", category: "Snacks", price: 25, cost: 20, stock: 50, unit: "pkt", tax: 18, lowStockAt: 15 },
  { id: "p18", barcode: "8904063200019", name: "Fortune Basmati Rice 1kg", category: "Grocery", price: 118, cost: 100, stock: 20, unit: "pkt", tax: 5, lowStockAt: 6 },
  { id: "p19", barcode: "8901396366447", name: "Dettol Handwash 200ml", category: "Personal Care", price: 99, cost: 82, stock: 24, unit: "btl", tax: 18, lowStockAt: 8 },
  { id: "p20", barcode: "8901030940101", name: "Vim Dishwash Bar 300g", category: "Household", price: 30, cost: 24, stock: 44, unit: "pcs", tax: 18, lowStockAt: 12 },
  { id: "p21", barcode: "8901052002215", name: "Coca-Cola 750ml", category: "Beverages", price: 45, cost: 37, stock: 30, unit: "btl", tax: 28, lowStockAt: 10 },
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