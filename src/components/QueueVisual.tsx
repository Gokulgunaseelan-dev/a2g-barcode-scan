/** Simple animated flow of customers moving toward the active counters. */
export function QueueVisual({
  lambda,
  counters,
  overloaded,
}: {
  lambda: number;
  counters: number;
  overloaded: boolean;
}) {
  const dots = Math.max(1, Math.min(14, Math.round(lambda)));
  return (
    <div className="space-y-3">
      <div className="relative h-10 overflow-hidden rounded-lg bg-muted/60">
        {Array.from({ length: dots }).map((_, i) => (
          <span
            key={i}
            className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full ${
              overloaded ? "bg-destructive" : "bg-primary"
            }`}
            style={{
              animation: `smartqueue-flow ${Math.max(1.2, 6 / Math.max(1, lambda / 4))}s linear ${
                (i * 0.35).toFixed(2)
              }s infinite`,
            }}
          />
        ))}
        <span className="absolute inset-y-0 right-0 w-1 bg-border" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: Math.max(1, Math.min(8, counters)) }).map((_, i) => (
          <div
            key={i}
            className="flex-1 rounded-md border border-primary/40 bg-primary/10 py-2 text-center text-[11px] font-medium text-primary"
          >
            Counter {i + 1}
          </div>
        ))}
      </div>
      <style>{`@keyframes smartqueue-flow{0%{left:-6%;opacity:0}10%{opacity:1}90%{opacity:1}100%{left:100%;opacity:0}}`}</style>
    </div>
  );
}
