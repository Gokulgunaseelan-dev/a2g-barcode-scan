import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "find_product_by_barcode",
  title: "Find product by barcode",
  description: "Look up one product in the signed-in shop's catalogue by its exact barcode.",
  inputSchema: { barcode: z.string().describe("The product barcode, e.g. 8901030865278.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ barcode }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("products")
      .select("id, barcode, name, brand, category, price, mrp, cost, stock, unit, tax, low_stock_at")
      .eq("barcode", barcode.trim())
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data)
      return {
        content: [{ type: "text", text: `No product found for barcode ${barcode}.` }],
        structuredContent: { product: null },
      };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { product: data },
    };
  },
});
