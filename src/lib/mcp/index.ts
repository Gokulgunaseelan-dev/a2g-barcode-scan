import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listProducts from "./tools/list-products";
import findProduct from "./tools/find-product";
import upsertProduct from "./tools/upsert-product";
import adjustStock from "./tools/adjust-stock";
import listSales from "./tools/list-sales";
import salesSummary from "./tools/sales-summary";
import lowStock from "./tools/low-stock";

// The OAuth issuer must be the direct Supabase host; the project ref is the only
// value that survives publish unchanged.
const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "a2g-barcode-scan",
  title: "A2G Barcode Scan",
  version: "0.1.0",
  instructions:
    "Tools for the A2G Barcode Scan supermarket billing app (Indian rupees, GST). Use `list_products` and `find_product_by_barcode` to read the catalogue, `upsert_product` and `adjust_stock` to maintain it, `low_stock_report` for reordering, and `list_sales` / `sales_summary` for billing history. All data belongs to the signed-in shop owner.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listProducts, findProduct, upsertProduct, adjustStock, lowStock, listSales, salesSummary],
});
