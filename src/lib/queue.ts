/**
 * SMARTQUEUE — queueing-theory math for counter planning.
 * λ (lambda) = arrival rate (customers/min)
 * μ (mu)     = service rate per counter (customers/min)
 * c          = active counters
 */
export type QueueStatus = "STABLE" | "HIGH LOAD" | "OVERLOADED";

export type QueueResult = {
  lambda: number;
  mu: number;
  counters: number;
  capacity: number; // c × μ
  required: number; // ceil(λ / μ)
  additional: number; // required - c (never negative)
  utilization: number; // ρ = λ / (c × μ)
  status: QueueStatus;
  /** Expected wait in queue (minutes), Erlang-C / M/M/c. Infinite when ρ ≥ 1. */
  avgWaitMin: number | null;
  avgQueueLength: number | null;
  recommendation: string;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Erlang C probability that an arriving customer must wait. */
function erlangC(lambda: number, mu: number, c: number) {
  const a = lambda / mu; // offered load in erlangs
  if (c <= 0 || a <= 0) return 1;
  const rho = a / c;
  if (rho >= 1) return 1;
  let sum = 0;
  let term = 1; // a^0 / 0!
  for (let k = 0; k < c; k++) {
    if (k > 0) term = (term * a) / k;
    sum += term;
  }
  const last = (term * a) / c; // a^c / c!
  const top = last / (1 - rho);
  return top / (sum + top);
}

export function computeQueue(lambda: number, mu: number, counters: number): QueueResult {
  const l = Math.max(0, lambda);
  const m = Math.max(0.0001, mu);
  const c = Math.max(0, Math.floor(counters));
  const capacity = round2(c * m);
  const required = Math.max(1, Math.ceil(l / m));
  const additional = Math.max(0, required - c);
  const utilization = capacity > 0 ? round2(l / capacity) : Infinity;

  let status: QueueStatus;
  if (!isFinite(utilization) || utilization >= 1) status = "OVERLOADED";
  else if (utilization >= 0.85) status = "HIGH LOAD";
  else status = "STABLE";

  let avgWaitMin: number | null = null;
  let avgQueueLength: number | null = null;
  if (isFinite(utilization) && utilization < 1 && c > 0) {
    const pw = erlangC(l, m, c);
    avgWaitMin = round2(pw / (c * m - l));
    avgQueueLength = round2(avgWaitMin * l);
  }

  const recommendation =
    additional > 0
      ? `Open ${additional} additional counter${additional > 1 ? "s" : ""}`
      : "Current counter capacity is sufficient";

  return {
    lambda: round2(l),
    mu: round2(m),
    counters: c,
    capacity,
    required,
    additional,
    utilization,
    status,
    avgWaitMin,
    avgQueueLength,
    recommendation,
  };
}

export const QUEUE_PRESETS = [
  { name: "Low traffic", lambda: 5, mu: 5, counters: 1 },
  { name: "Normal traffic", lambda: 12, mu: 5, counters: 2 },
  { name: "High traffic", lambda: 20, mu: 5, counters: 3 },
] as const;

export const statusTone = (s: QueueStatus) =>
  s === "STABLE"
    ? { text: "text-primary", bg: "bg-primary/10", dot: "bg-primary" }
    : s === "HIGH LOAD"
      ? { text: "text-amber-600", bg: "bg-amber-500/10", dot: "bg-amber-500" }
      : { text: "text-destructive", bg: "bg-destructive/10", dot: "bg-destructive" };
