import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  hashPin,
  saveSettings,
  useSettings,
  type CurrencyCode,
} from "@/lib/store";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Store, GST Slabs, Currency & Roles | SmartCart" },
      {
        name: "description",
        content: "Configure store details, GST slabs, intra/inter-state tax mode, display currency with manual exchange rate, and admin/cashier roles.",
      },
      { property: "og:title", content: "Settings — SmartCart" },
      {
        property: "og:description",
        content: "GST rates are configurable, never hardcoded — update them whenever tax rules change.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

const CURRENCIES: CurrencyCode[] = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "JPY"];

function SettingsPage() {
  const settings = useSettings();
  const [pin, setPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [slabs, setSlabs] = useState(settings.gstSlabs.join(", "));

  const becomeAdmin = async () => {
    if ((await hashPin(pin)) === settings.adminPinHash) {
      saveSettings({ role: "admin" });
      setPin("");
      toast.success("Admin unlocked");
    } else toast.error("Incorrect PIN");
  };

  return (
    <AppShell title="Settings">
      <div className="space-y-4">
        <Card className="space-y-3 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Role</h2>
          {settings.role === "admin" ? (
            <>
              <p className="text-sm">Signed in as <b>Admin</b>.</p>
              <Button variant="outline" onClick={() => saveSettings({ role: "cashier" })}>
                Switch to Cashier
              </Button>
              <div className="space-y-1">
                <Label>Change admin PIN</Label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    inputMode="numeric"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    placeholder="New PIN"
                  />
                  <Button
                    onClick={async () => {
                      if (newPin.length < 4) return toast.error("PIN must be at least 4 digits.");
                      saveSettings({ adminPinHash: await hashPin(newPin) });
                      setNewPin("");
                      toast.success("PIN updated");
                    }}
                  >
                    Save
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  PINs are stored only as a SHA-256 hash on this device — never in plain text.
                </p>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Cashier mode: scan, bill and view allowed screens. Enter the admin PIN (default 1234)
                to manage products, GST and stock.
              </p>
              <div className="flex gap-2">
                <Input
                  type="password"
                  inputMode="numeric"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  placeholder="Admin PIN"
                />
                <Button onClick={becomeAdmin}>Unlock</Button>
              </div>
            </>
          )}
        </Card>

        <Card className="space-y-3 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Store</h2>
          <Field label="Store name" value={settings.storeName} onChange={(v) => saveSettings({ storeName: v })} />
          <Field label="Address" value={settings.address} onChange={(v) => saveSettings({ address: v })} />
          <Field label="GSTIN" value={settings.gstin} onChange={(v) => saveSettings({ gstin: v })} />
        </Card>

        <Card className="space-y-3 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">GST</h2>
          <Tabs value={settings.taxMode} onValueChange={(v) => saveSettings({ taxMode: v as "intra" | "inter" })}>
            <TabsList className="w-full">
              <TabsTrigger value="intra" className="flex-1">Intra-state</TabsTrigger>
              <TabsTrigger value="inter" className="flex-1">Inter-state</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="space-y-1">
            <Label>Configurable GST slabs (%)</Label>
            <div className="flex gap-2">
              <Input value={slabs} onChange={(e) => setSlabs(e.target.value)} disabled={settings.role !== "admin"} />
              <Button
                disabled={settings.role !== "admin"}
                onClick={() => {
                  const parsed = slabs
                    .split(",")
                    .map((s) => Number(s.trim()))
                    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 100);
                  if (!parsed.length) return toast.error("Enter valid GST rates between 0 and 100.");
                  saveSettings({ gstSlabs: [...new Set(parsed)].sort((a, b) => a - b) });
                  toast.success("GST slabs updated");
                }}
              >
                Save
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Rates are stored in settings, not hardcoded — update them if tax rules change.
            </p>
          </div>
        </Card>

        <Card className="space-y-3 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Currency</h2>
          <div className="space-y-1">
            <Label>Display currency</Label>
            <Select
              value={settings.currency}
              onValueChange={(v) =>
                saveSettings({ currency: v as CurrencyCode, rate: v === "INR" ? 1 : settings.rate })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Field
            label={`Manual exchange rate (1 INR = ? ${settings.currency})`}
            type="number"
            value={String(settings.rate)}
            onChange={(v) => saveSettings({ rate: Math.max(0.000001, Number(v) || 1) })}
          />
          <Field label="Exchange-rate source" value={settings.rateSource} onChange={(v) => saveSettings({ rateSource: v })} />
          <p className="text-xs text-muted-foreground">
            Prices are stored in INR; a single currency is used per bill. No live rates are fetched —
            the rate above is manual and its source is shown on request.
          </p>
        </Card>

        <Card className="space-y-3 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            SmartQueue defaults
          </h2>
          <div className="grid grid-cols-3 gap-2">
            <Field label="λ / min" type="number" value={String(settings.queue.lambda)} onChange={(v) => saveSettings({ queue: { ...settings.queue, lambda: Math.max(0, Number(v) || 0) } })} />
            <Field label="μ / min" type="number" value={String(settings.queue.mu)} onChange={(v) => saveSettings({ queue: { ...settings.queue, mu: Math.max(0.1, Number(v) || 1) } })} />
            <Field label="Counters" type="number" value={String(settings.queue.counters)} onChange={(v) => saveSettings({ queue: { ...settings.queue, counters: Math.max(1, Math.floor(Number(v)) || 1) } })} />
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
