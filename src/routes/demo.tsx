import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AppShell } from "@/components/AppShell";
import { QueueVisual } from "@/components/QueueVisual";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { computeQueue, statusTone } from "@/lib/queue";
import { saveSettings, useSettings } from "@/lib/store";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Math Shark Tank Demo — SmartCart Queue Optimization" },
      {
        name: "description",
        content: "A two-minute, presentation-ready demonstration of counter optimization: ceiling(λ/μ) turns an overloaded checkout into a stable one.",
      },
      { property: "og:title", content: "Math Shark Tank Demo — SmartCart" },
      {
        property: "og:description",
        content: "Judges see arrivals, service rate, capacity and the recommended counters in one screen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Demo,
});

function Demo() {
  const settings = useSettings();
  const [counters, setCounters] = useState(settings.queue.counters);
  const lambda = settings.queue.lambda;
  const mu = settings.queue.mu;
  const q = computeQueue(lambda, mu, counters);
  const tone = statusTone(q.status);

  return (
    <AppShell title="Math Shark Tank Demo">
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Big label="Customers arriving" value={`${lambda}`} unit="/ min" />
          <Big label="Service rate" value={`${mu}`} unit="/ min / counter" />
          <Big label="Current counters" value={`${counters}`} unit="active" />
        </div>

        <Card className="space-y-2 p-5 font-mono text-sm">
          <p className="font-sans text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Mathematical calculation
          </p>
          <p>Required counters = ceiling(λ / μ)</p>
          <p>
            = ceiling({lambda} / {mu}) = ceiling({(lambda / mu).toFixed(2)})
          </p>
          <p className="text-2xl font-bold text-primary">= {q.required}</p>
          <p className="pt-2">
            Current capacity = c × μ = {counters} × {mu} = {q.capacity} / min
          </p>
          <p>Arrival = {lambda} / min</p>
        </Card>

        <QueueVisual lambda={lambda} counters={counters} overloaded={q.status === "OVERLOADED"} />

        <Card className={`space-y-2 p-5 text-center ${tone.bg}`}>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Result</p>
          <p className={`text-3xl font-extrabold ${tone.text}`}>{q.status}</p>
          <p className="text-sm font-medium">{q.recommendation.toUpperCase()}</p>
        </Card>

        {q.additional > 0 ? (
          <Button
            className="h-14 w-full text-base font-semibold"
            onClick={() => {
              setCounters(q.required);
              saveSettings({ queue: { lambda, mu, counters: q.required } });
            }}
          >
            Activate recommended counter{q.additional > 1 ? "s" : ""}
          </Button>
        ) : (
          <Button
            variant="outline"
            className="h-12 w-full"
            onClick={() => {
              setCounters(Math.max(1, q.required - 1));
              saveSettings({ queue: { lambda, mu, counters: Math.max(1, q.required - 1) } });
            }}
          >
            Reset demo (remove one counter)
          </Button>
        )}
        <p className="text-center text-xs text-muted-foreground">
          Demo Data — λ and μ are set by you in SmartQueue or Settings.
        </p>
      </div>
    </AppShell>
  );
}

function Big({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <Card className="p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-3xl font-extrabold text-primary">{value}</p>
      <p className="text-[11px] text-muted-foreground">{unit}</p>
    </Card>
  );
}
