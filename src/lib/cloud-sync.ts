/**
 * Bridges the offline localStorage store with the cloud database so
 * OAuth-connected AI assistants (MCP) see the same catalogue and sales.
 */
import { supabase } from "@/integrations/supabase/client";
import { saveProduct, type Product, type Sale, uid } from "./store";

export type SyncResult = { products: number; sales: number };

export async function pushToCloud(products: Product[], sales: Sale[]): Promise<SyncResult> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Sign in first.");

  const rows = products
    .filter((p) => p.barcode.trim().length > 0)
    .map((p) => ({
      user_id: userId,
      barcode: p.barcode.trim(),
      name: p.name,
      category: p.category,
      price: p.price,
      cost: p.cost,
      stock: p.stock,
      unit: p.unit,
      tax: p.tax,
      low_stock_at: p.lowStockAt,
    }));

  if (rows.length) {
    const { error } = await supabase.from("products").upsert(rows, { onConflict: "user_id,barcode" });
    if (error) throw error;
  }

  const { data: existing, error: existingError } = await supabase
    .from("sales")
    .select("invoice_no");
  if (existingError) throw existingError;
  const known = new Set((existing ?? []).map((s) => s.invoice_no));

  const { data: cloudProducts } = await supabase.from("products").select("id, barcode");
  const idByBarcode = new Map((cloudProducts ?? []).map((p) => [p.barcode, p.id]));

  let salesPushed = 0;
  for (const sale of sales) {
    if (known.has(sale.invoiceNo)) continue;
    const { data: inserted, error } = await supabase
      .from("sales")
      .insert({
        user_id: userId,
        invoice_no: sale.invoiceNo,
        subtotal: sale.subtotal,
        discount: sale.discount,
        taxable: sale.subtotal - sale.discount,
        tax: sale.tax,
        total: sale.total,
        payment_mode: sale.paymentMode,
        customer: sale.customer ?? null,
        created_at: sale.createdAt,
      })
      .select("id")
      .single();
    if (error) throw error;

    const items = sale.items.map((i) => ({
      sale_id: inserted.id,
      user_id: userId,
      product_id: idByBarcode.get(i.barcode) ?? null,
      barcode: i.barcode,
      name: i.name,
      price: i.price,
      tax: i.tax,
      qty: i.qty,
    }));
    if (items.length) {
      const { error: itemError } = await supabase.from("sale_items").insert(items);
      if (itemError) throw itemError;
    }
    salesPushed += 1;
  }

  return { products: rows.length, sales: salesPushed };
}

/** Pulls the cloud catalogue back into the offline store (cloud wins). */
export async function pullProducts(local: Product[]): Promise<number> {
  const { data, error } = await supabase
    .from("products")
    .select("barcode, name, category, price, cost, stock, unit, tax, low_stock_at");
  if (error) throw error;

  for (const row of data ?? []) {
    const match = local.find((p) => p.barcode === row.barcode);
    saveProduct({
      id: match?.id ?? uid(),
      barcode: row.barcode,
      name: row.name,
      category: row.category,
      price: Number(row.price),
      cost: Number(row.cost),
      stock: Number(row.stock),
      unit: row.unit,
      tax: Number(row.tax),
      lowStockAt: Number(row.low_stock_at),
    });
  }
  return (data ?? []).length;
}
