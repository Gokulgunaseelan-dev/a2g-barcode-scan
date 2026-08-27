import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useProducts, useSales } from "@/lib/store";
import { pullProducts, pushToCloud } from "@/lib/cloud-sync";
import { toast } from "sonner";
import { CloudUpload, CloudDownload, Plug, LogOut } from "lucide-react";

export const Route = createFileRoute("/cloud")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Cloud sync & AI access — A2G Barcode Scan" },
      {
        name: "description",
        content:
          "Sync your A2G Barcode Scan catalogue and sales to the cloud and let AI assistants read them securely over MCP.",
      },
      { property: "og:title", content: "Cloud sync & AI access — A2G Barcode Scan" },
      {
        property: "og:description",
        content:
          "Sync your A2G Barcode Scan catalogue and sales to the cloud and let AI assistants read them securely over MCP.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CloudPage,
});

function CloudPage() {
  const products = useProducts();
  const sales = useSales();
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mcpUrl = typeof window !== "undefined" ? `${window.location.origin}/mcp` : "/mcp";

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setEmail(session?.user?.email ?? null),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  async function run(fn: () => Promise<string>) {
    setBusy(true);
    try {
      toast.success(await fn());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Cloud & AI access">
      <div className="space-y-4">
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">Account</h2>
          {email ? (
            <>
              <p className="mt-1 text-sm text-muted-foreground">Signed in as {email}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={async () => {
                  await supabase.auth.signOut();
                  toast.success("Signed out");
                }}
              >
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </Button>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                Sign in to back up your shop data and to let AI assistants connect.
              </p>
              <Button size="sm" className="mt-3" onClick={() => (window.location.href = "/auth?next=/cloud")}>
                Sign in
              </Button>
            </>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">Sync</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {products.length} products and {sales.length} bills on this device.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={busy || !email}
              onClick={() =>
                run(async () => {
                  const r = await pushToCloud(products, sales);
                  return `Uploaded ${r.products} products and ${r.sales} new bills.`;
                })
              }
            >
              <CloudUpload className="mr-2 h-4 w-4" /> Upload to cloud
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy || !email}
              onClick={() =>
                run(async () => `Pulled ${await pullProducts(products)} products from the cloud.`)
              }
            >
              <CloudDownload className="mr-2 h-4 w-4" /> Pull from cloud
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Plug className="h-4 w-4" /> AI assistant access (MCP)
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add this server URL in ChatGPT, Claude, Cursor or Lovable. Assistants sign in as you and can only
            see your shop's data.
          </p>
          <code className="mt-3 block break-all rounded-md bg-muted px-3 py-2 text-xs text-foreground">
            {mcpUrl}
          </code>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            <li>list_products, find_product_by_barcode — read the catalogue</li>
            <li>upsert_product, adjust_stock — maintain products and stock</li>
            <li>low_stock_report — see what to reorder</li>
            <li>list_sales, sales_summary — billing history and totals</li>
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
