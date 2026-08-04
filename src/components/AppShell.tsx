import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  Boxes,
  LayoutDashboard,
  Menu,
  Package,
  Presentation,
  ReceiptText,
  ScanBarcode,
  Settings as SettingsIcon,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useSettings } from "@/lib/store";

const allNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/", label: "Scan & Bill", icon: ScanBarcode },
  { to: "/products", label: "Products", icon: Package, admin: true },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { to: "/smartqueue", label: "SmartQueue", icon: Users },
  { to: "/demo", label: "Math Shark Tank Demo", icon: Presentation },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/sales", label: "Receipts", icon: ReceiptText },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

const primary = ["/", "/smartqueue", "/demo", "/analytics"] as const;

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const settings = useSettings();
  const [open, setOpen] = useState(false);
  const nav = allNav.filter((n) => !("admin" in n && n.admin) || settings.role === "admin");
  const bottom = nav.filter((n) => (primary as readonly string[]).includes(n.to));

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ScanBarcode className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              SmartCart
            </p>
            <h1 className="truncate text-lg font-semibold leading-tight text-foreground">{title}</h1>
          </div>
          <Badge variant={settings.role === "admin" ? "default" : "secondary"} className="gap-1">
            <ShieldCheck className="h-3 w-3" />
            {settings.role === "admin" ? "Admin" : "Cashier"}
          </Badge>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger className="rounded-md p-2 hover:bg-accent" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>SmartCart</SheetTitle>
              </SheetHeader>
              <nav className="mt-4 space-y-1">
                {nav.map(({ to, label, icon: Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    activeOptions={{ exact: to === "/" }}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent [&.active]:bg-primary/10 [&.active]:font-medium [&.active]:text-primary"
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                ))}
              </nav>
              <p className="mt-6 px-3 text-xs text-muted-foreground">
                Mathematics-powered smart billing &amp; queue optimization.
              </p>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl">
          {bottom.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex flex-1 flex-col items-center gap-1 py-3 text-[11px] text-muted-foreground transition-colors [&.active]:text-primary"
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
          <button
            onClick={() => setOpen(true)}
            className="flex flex-1 flex-col items-center gap-1 py-3 text-[11px] text-muted-foreground"
          >
            <Menu className="h-5 w-5" />
            More
          </button>
        </div>
      </nav>
    </div>
  );
}
