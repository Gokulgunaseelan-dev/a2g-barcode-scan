import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_products",
  title: "List products",
  description:
    "List the signed-in shop's products with barcode, price, GST rate and current stock. Optionally filter by name/barcode text or category.",
  inputSchema: {
    search: z.string().optional().describe("Text to match against product name or barcode."),
    category: z.string().optional().describe("Exact category to filter by, e.g. Grocery."),
    limit: z.number().int().optional().describe("Maximum rows to return (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, category, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("products")
      .select("id, barcode, name, category, price, mrp, cost, stock, unit, tax, low_stock_at")
      .order("name")
      .limit(Math.min(Math.max(limit ?? 50, 1), 200));
    if (category) query = query.eq("category", category);
    if (search) query = query.or(`name.ilike.%${search}%,barcode.ilike.%${search}%`);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { products: data ?? [], count: data?.length ?? 0 },
    };
  },
});
