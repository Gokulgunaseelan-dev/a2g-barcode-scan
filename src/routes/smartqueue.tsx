import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Sigma, Users } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { QueueVisual } from "@/components/QueueVisual";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QUEUE_PRESETS, computeQueue, statusTone } from "@/lib/queue";
import { billingStats, saveSettings, useSales, useSettings } from "@/lib/store";

export const Route = createFileRoute("/smartqueue")({
  head: () => ({
    meta: [
      { title: "SmartQueue — Mathematical Counter Optimization" },
      {
        name: "description",
        content: "Queueing theory for supermarkets: required counters = ceiling(arrival rate / service rate), with live load status and wait-time estimates.",
      },
      { property: "og:title", content: "SmartQueue — Mathematical Counter Optimization" },
      {
        property: "og:description",
        content: "Compute required billing counters from arrival and service rates, with M/M/c wait-time estimates.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SmartQueue,
});

function SmartQueue() {
  const settings = useSettings();
  const sales = useSales();
  const stats = useMemo(() => billingStats(sales), [sales]);
  const [lambda, setLambda] = useState(settings.queue.lambda);
  const [mu, setMu] = useState(settings.queue.mu);
  const [counters, setCounters] = useState(settings.queue.counters);

  const q = computeQueue(lambda, mu, counters);
  const tone = statusTone(q.status);

  const apply = (l: number, m: number, c: number) => {
    setLambda(l);
    setMu(m);
    setCounters(c);
    saveSettings({ queue: { lambda: l, mu: m, counters: c } });
  };

  return (
    <AppShell title="SmartQueue">
      <div className="space-y-4">
        <Card className={`space-y-2 p-4 ${tone.bg}`}>
          <div className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-full ${tone.dot}`} />
            <p className={`text-lg font-bold ${tone.text}`}>{q.status}</p>
            <Badge variant="secondary" className="ml-auto">
              ρ = {isFinite(q.utilization) ? q.utilization : "∞"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{q.recommendation}</p>
        </Card>

        <QueueVisual lambda={lambda} counters={counters} overloaded={q.status === "OVERLOADED"} />

        <div className="grid grid-cols-2 gap-2">
          <Kpi label="Arrivals λ" value={`${q.lambda}/min`} />
          <Kpi label="Service μ per counter" value={`${q.mu}/min`} />
          <Kpi label="Active counters c" value={String(q.counters)} />
          <Kpi label="Capacity c × μ" value={`${q.capacity}/min`} />
          <Kpi label="Required counters" value={String(q.required)} tone />
          <Kpi label="Additional needed" value={String(q.additional)} tone={q.additional > 0} />
          <Kpi
            label="Est. customers waiting (Lq)"
            value={q.avgQueueLength === null ? "Growing ∞" : String(q.avgQueueLength)}
          />
          <Kpi
            label="Est. wait (Wq)"
            value={q.avgWaitMin === null ? "Growing ∞" : `${q.avgWaitMin} min`}
          />
        </div>

        <Card className="space-y-3 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Sigma className="h-4 w-4" /> The mathematics
          </h2>
          <ul className="space-y-2 font-mono text-xs leading-relaxed">
            <li>
              Required counters = ceiling(λ / μ) = ceiling({q.lambda} / {q.mu}) = ceiling(
              {(q.lambda / q.mu).toFixed(2)}) = <b>{q.required}</b>
            </li>
            <li>
              Capacity = c × μ = {q.counters} × {q.mu} = <b>{q.capacity}/min</b>
            </li>
            <li>
              Utilization ρ = λ / (c × μ) = {q.lambda} / {q.capacity} ={" "}
              <b>{isFinite(q.utilization) ? q.utilization : "∞"}</b>
            </li>
            <li>
              {q.lambda} {q.lambda > q.capacity ? ">" : "<"} {q.capacity} → <b>{q.status}</b>
            </li>
            <li>Wq from Erlang-C (M/M/c): Wq = C(c, λ/μ) / (cμ − λ)</li>
          </ul>
        </Card>

        <Card className="space-y-3 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Users className="h-4 w-4" /> Simulation
          </h2>
          <div className="grid grid-cols-3 gap-2">
            <NumField label="λ arrivals/min" value={lambda} onChange={(v) => apply(v, mu, counters)} />
            <NumField label="μ served/min" value={mu} onChange={(v) => apply(lambda, v, counters)} min={0.1} step={0.1} />
            <NumField label="Counters" value={counters} onChange={(v) => apply(lambda, mu, v)} />
          </div>
          <div className="flex flex-wrap gap-2">
            {QUEUE_PRESETS.map((p) => (
              <Button
                key={p.name}
                size="sm"
                variant="outline"
                onClick={() => apply(p.lambda, p.mu, p.counters)}
              >
                {p.name}
              </Button>
            ))}
            {q.additional > 0 && (
              <Button size="sm" onClick={() => apply(lambda, mu, q.required)}>
                Activate {q.additional} more counter{q.additional > 1 ? "s" : ""}
              </Button>
            )}
          </div>
        </Card>

        <Card className="space-y-1 p-4 text-sm">
          <div className="flex items-center gap-2">
            <p className="font-semibold">Measured billing performance</p>
            {!stats.hasEnoughData && <Badge variant="secondary">Demo Data</Badge>}
          </div>
          {stats.samples > 0 ? (
            <p className="text-muted-foreground">
              {stats.samples} timed bill(s) · average {stats.avgBillingSec}s per bill ·{" "}
              {stats.serviceRate} customers/min per counter
              {!stats.hasEnoughData && " — too few samples to be reliable yet."}
            </p>
          ) : (
            <p className="text-muted-foreground">
              No real bills timed yet, so λ and μ above are your own inputs (demo values), not
              measurements.
            </p>
          )}
          {stats.serviceRate > 0 && (
            <Button size="sm" variant="outline" onClick={() => apply(lambda, stats.serviceRate, counters)}>
              Use measured μ = {stats.serviceRate}/min
            </Button>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: boolean }) {
  return (
    <Card className={`p-3 ${tone ? "border-primary/40 bg-primary/5" : ""}`}>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${tone ? "text-primary" : ""}`}>{value}</p>
    </Card>
  );
}

function NumField({
  label,
  value,
  onChange,
  min = 0,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
      />
    </div>
  );
}
