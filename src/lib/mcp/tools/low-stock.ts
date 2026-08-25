import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "low_stock_report",
  title: "Low stock report",
  description:
    "List products of the signed-in shop whose stock has fallen to or below their low-stock level, so they can be reordered.",
  inputSchema: {
    limit: z.number().int().optional().describe("Maximum rows to return (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("products")
      .select("barcode, name, category, stock, low_stock_at, unit, price")
      .order("stock")
      .limit(500);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const low = (data ?? [])
      .filter((p) => Number(p.stock) <= Number(p.low_stock_at))
      .slice(0, Math.min(Math.max(limit ?? 50, 1), 200));
    return {
      content: [{ type: "text", text: JSON.stringify(low) }],
      structuredContent: { low_stock: low, count: low.length },
    };
  },
});
