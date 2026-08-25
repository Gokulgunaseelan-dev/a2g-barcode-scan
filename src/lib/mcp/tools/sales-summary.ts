import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "sales_summary",
  title: "Sales summary",
  description:
    "Summarise the signed-in shop's sales over the last N days: bill count, revenue, GST collected, discounts and average bill value (rupees).",
  inputSchema: {
    days: z.number().int().optional().describe("Look-back window in days (default 7)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ days }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const window = Math.min(Math.max(days ?? 7, 1), 365);
    const since = new Date(Date.now() - window * 86400000).toISOString();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("sales")
      .select("total, tax, discount, payment_mode")
      .gte("created_at", since);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const rows = data ?? [];
    const sum = (pick: (r: (typeof rows)[number]) => number) =>
      Math.round(rows.reduce((s, r) => s + pick(r), 0) * 100) / 100;
    const revenue = sum((r) => Number(r.total));
    const byMode: Record<string, number> = {};
    for (const r of rows) byMode[r.payment_mode] = Math.round(((byMode[r.payment_mode] ?? 0) + Number(r.total)) * 100) / 100;

    const summary = {
      window_days: window,
      bills: rows.length,
      revenue,
      gst_collected: sum((r) => Number(r.tax)),
      discounts: sum((r) => Number(r.discount)),
      average_bill: rows.length ? Math.round((revenue / rows.length) * 100) / 100 : 0,
      revenue_by_payment_mode: byMode,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(summary) }],
      structuredContent: summary,
    };
  },
});
