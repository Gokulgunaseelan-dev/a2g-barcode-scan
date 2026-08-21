import { Link } from "@tanstack/react-router";
import { ScanBarcode, Package, ReceiptText, LayoutDashboard } from "lucide-react";
import type { ReactNode } from "react";

const nav = [
  { to: "/", label: "Billing", icon: ScanBarcode },
  { to: "/products", label: "Products", icon: Package },
  { to: "/sales", label: "Sales", icon: ReceiptText },
  { to: "/dashboard", label: "Reports", icon: LayoutDashboard },
] as const;

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ScanBarcode className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">A2G Barcode Scan</p>
            <h1 className="text-lg font-semibold leading-tight text-foreground">{title}</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl">
          {nav.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex flex-1 flex-col items-center gap-1 py-3 text-xs text-muted-foreground transition-colors [&.active]:text-primary"
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}