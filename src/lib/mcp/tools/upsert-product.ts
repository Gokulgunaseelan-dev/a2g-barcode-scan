import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "upsert_product",
  title: "Add or update a product",
  description:
    "Create a product in the signed-in shop's catalogue, or update it when the barcode already exists. Prices are in Indian rupees and tax is the GST percentage.",
  inputSchema: {
    barcode: z.string().describe("Barcode used as the unique key for this shop."),
    name: z.string().describe("Product name shown on the bill."),
    price: z.number().describe("Selling price in rupees."),
    category: z.string().optional().describe("Category, e.g. Grocery, Snacks, Dairy."),
    mrp: z.number().optional().describe("Printed MRP in rupees."),
    cost: z.number().optional().describe("Purchase cost in rupees."),
    stock: z.number().optional().describe("Stock on hand."),
    unit: z.string().optional().describe("Unit label, e.g. pkt, pcs, btl."),
    tax: z.number().optional().describe("GST percentage, e.g. 0, 5, 12, 18, 28."),
    low_stock_at: z.number().optional().describe("Stock level that counts as low."),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    const row = {
      user_id: ctx.getUserId(),
      barcode: input.barcode.trim(),
      name: input.name.trim(),
      price: input.price,
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.mrp !== undefined ? { mrp: input.mrp } : {}),
      ...(input.cost !== undefined ? { cost: input.cost } : {}),
      ...(input.stock !== undefined ? { stock: input.stock } : {}),
      ...(input.unit !== undefined ? { unit: input.unit } : {}),
      ...(input.tax !== undefined ? { tax: input.tax } : {}),
      ...(input.low_stock_at !== undefined ? { low_stock_at: input.low_stock_at } : {}),
    };
    const { data, error } = await supabase
      .from("products")
      .upsert(row, { onConflict: "user_id,barcode" })
      .select("id, barcode, name, category, price, mrp, stock, unit, tax, low_stock_at");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data?.[0] ?? null) }],
      structuredContent: { product: data?.[0] ?? null },
    };
  },
});
