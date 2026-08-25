import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "adjust_stock",
  title: "Adjust stock",
  description:
    "Change the stock on hand for one product of the signed-in shop by a delta (positive for goods received, negative for damage or manual correction). Records the movement.",
  inputSchema: {
    barcode: z.string().describe("Barcode of the product to adjust."),
    delta: z.number().describe("Change in units; negative reduces stock."),
    reason: z.string().optional().describe("Short reason, e.g. purchase, damage, correction."),
    note: z.string().optional().describe("Optional free-text note."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async ({ barcode, delta, reason, note }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    const { data: product, error: findError } = await supabase
      .from("products")
      .select("id, name, stock")
      .eq("barcode", barcode.trim())
      .maybeSingle();
    if (findError) return { content: [{ type: "text", text: findError.message }], isError: true };
    if (!product)
      return { content: [{ type: "text", text: `No product found for barcode ${barcode}.` }], isError: true };

    const next = Math.max(0, Number(product.stock) + delta);
    const { error: updateError } = await supabase
      .from("products")
      .update({ stock: next })
      .eq("id", product.id);
    if (updateError) return { content: [{ type: "text", text: updateError.message }], isError: true };

    await supabase.from("stock_movements").insert({
      user_id: ctx.getUserId(),
      product_id: product.id,
      delta,
      reason: reason ?? "manual",
      note: note ?? null,
    });

    return {
      content: [
        { type: "text", text: `${product.name}: stock ${product.stock} → ${next}` },
      ],
      structuredContent: { name: product.name, previous_stock: Number(product.stock), stock: next },
    };
  },
});
