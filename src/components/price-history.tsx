import { fmtDate, fmtPrice } from "@/lib/format";

type Point = { inputPricePer1M: number | null; outputPricePer1M: number | null; capturedAt: Date };

/** Tiny SVG sparkline of input price over time. Snapshots are only written on change. */
export function PriceHistory({ points }: { points: Point[] }) {
  const pts = points.filter((p) => p.inputPricePer1M !== null);
  if (pts.length < 2) {
    return <span className="text-xs text-zinc-600">{pts.length ? `tracked since ${fmtDate(pts[0].capturedAt)}` : "—"}</span>;
  }
  const values = pts.map((p) => p.inputPricePer1M!);
  const min = Math.min(...values), max = Math.max(...values);
  const w = 90, h = 24;
  const d = values
    .map((v, i) => `${i ? "L" : "M"}${(i / (values.length - 1)) * w},${max === min ? h / 2 : h - ((v - min) / (max - min)) * h}`)
    .join(" ");
  const first = values[0], last = values[values.length - 1];
  const change = first ? Math.round(((last - first) / first) * 100) : 0;
  return (
    <span className="inline-flex items-center gap-2" title={`${fmtPrice(first)} → ${fmtPrice(last)}`}>
      <svg width={w} height={h} className="overflow-visible">
        <path d={d} fill="none" stroke={change <= 0 ? "#c6f432" : "#f87171"} strokeWidth={1.5} />
      </svg>
      <span className={`font-mono text-xs ${change <= 0 ? "text-accent" : "text-red-400"}`}>{change > 0 ? "+" : ""}{change}%</span>
    </span>
  );
}
