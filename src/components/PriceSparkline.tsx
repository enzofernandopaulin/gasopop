import { formatPrice } from "@/lib/fuel";

type Point = { price: number; reported_at: string };

/** Tiny glanceable price history chart (no library, pure SVG). */
export function PriceSparkline({ points, label }: { points: Point[]; label: string }) {
  const ordered = [...points].sort(
    (a, b) => new Date(a.reported_at).getTime() - new Date(b.reported_at).getTime(),
  );
  if (ordered.length < 2) return null;

  const prices = ordered.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 0.1;
  const w = 260;
  const h = 64;

  const coords = ordered.map((p, i) => {
    const x = (i / (ordered.length - 1)) * w;
    const y = h - ((p.price - min) / span) * (h - 12) - 6;
    return [x, y] as const;
  });
  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w} ${h} L0 ${h} Z`;
  const first = prices[0]!;
  const last = prices[prices.length - 1]!;
  const down = last < first;

  return (
    <div className="pop-card p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p
          className={`text-xs font-extrabold ${down ? "text-primary" : "text-muted-foreground"}`}
        >
          {down ? "▼" : "▲"} R$ {formatPrice(Math.abs(last - first))}
        </p>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-16 w-full" preserveAspectRatio="none">
        <path d={area} fill="currentColor" className="text-primary/15" />
        <path
          d={line}
          fill="none"
          stroke="currentColor"
          className="text-primary"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="flex justify-between text-[11px] font-semibold text-muted-foreground">
        <span>R$ {formatPrice(first)}</span>
        <span>R$ {formatPrice(last)}</span>
      </div>
    </div>
  );
}
