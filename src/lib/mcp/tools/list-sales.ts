import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_sales",
  title: "List recent sales",
  description:
    "List the signed-in shop's recent bills with invoice number, totals in rupees, payment mode and the items sold.",
  inputSchema: {
    limit: z.number().int().optional().describe("Maximum bills to return (default 20)."),
    since: z.string().optional().describe("ISO date/time; only bills created at or after this moment."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, since }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("sales")
      .select(
        "id, invoice_no, created_at, subtotal, discount, tax, total, payment_mode, customer, sale_items(barcode, name, price, qty, tax)",
      )
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit ?? 20, 1), 100));
    if (since) query = query.gte("created_at", since);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { sales: data ?? [], count: data?.length ?? 0 },
    };
  },
});
