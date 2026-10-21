"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface Point {
  key: string; // date
  label: string; // short x label, e.g. "M"
  value: number | null;
  display: string; // formatted value for the readout
}

const W = 320;
const PAD_X = 4;

function Readout({ point, title, fullLabel }: { point: Point | undefined; title: string; fullLabel?: (p: Point) => string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground tabular-nums">
        {point ? (
          <>
            {fullLabel ? fullLabel(point) : point.label} · <span className="font-semibold text-foreground">{point.value == null ? "no data" : point.display}</span>
          </>
        ) : (
          "–"
        )}
      </p>
    </div>
  );
}

function lastWithValue(data: Point[]) {
  for (let i = data.length - 1; i >= 0; i--) if (data[i].value != null) return i;
  return data.length - 1;
}

/** Single-series column chart with an optional dashed reference line (goal or average). */
export function BarChart({
  title,
  data,
  height = 120,
  reference,
  fullLabel,
}: {
  title: string;
  data: Point[];
  height?: number;
  reference?: { value: number; label: string };
  fullLabel?: (p: Point) => string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const shown = active ?? lastWithValue(data);
  const max = Math.max(1, reference?.value ?? 0, ...data.map((d) => d.value ?? 0)) * 1.1;
  const slot = (W - PAD_X * 2) / data.length;
  const barW = Math.max(4, Math.min(22, slot - 2)); // ≥2px gap between bars
  const y = (v: number) => height - (v / max) * height;

  return (
    <div className="space-y-2">
      <Readout point={data[shown]} title={title} fullLabel={fullLabel} />
      <svg viewBox={`0 0 ${W} ${height + 16}`} className="w-full overflow-visible" role="img" aria-label={title} onMouseLeave={() => setActive(null)}>
        <line x1={0} x2={W} y1={height} y2={height} className="stroke-border" strokeWidth={1} />
        {reference && (
          <g>
            <line x1={0} x2={W} y1={y(reference.value)} y2={y(reference.value)} className="stroke-muted-foreground/60" strokeDasharray="3 3" strokeWidth={1} />
            <text x={W} y={y(reference.value) - 3} textAnchor="end" className="fill-muted-foreground text-[9px]">
              {reference.label}
            </text>
          </g>
        )}
        {data.map((d, i) => {
          const cx = PAD_X + slot * i + slot / 2;
          const h = d.value ? Math.max(2, height - y(d.value)) : 0;
          return (
            <g key={d.key} onMouseEnter={() => setActive(i)} onClick={() => setActive(i)} className="cursor-pointer">
              <rect x={cx - slot / 2} y={0} width={slot} height={height + 16} fill="transparent" />
              {h > 0 && (
                <path
                  d={roundedTopBar(cx - barW / 2, height - h, barW, h, Math.min(4, barW / 2))}
                  className={cn("fill-series transition-opacity", i === shown ? "opacity-100" : "opacity-60")}
                />
              )}
              <text x={cx} y={height + 12} textAnchor="middle" className={cn("text-[9px]", i === shown ? "fill-foreground" : "fill-muted-foreground")}>
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function roundedTopBar(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

/** Single-series line with dots; tap a point to read it. Gaps where data is missing. */
export function LineChart({
  title,
  data,
  height = 100,
  fullLabel,
  domainPad = 0.15,
}: {
  title: string;
  data: Point[];
  height?: number;
  fullLabel?: (p: Point) => string;
  domainPad?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const shown = active ?? lastWithValue(data);
  const values = data.map((d) => d.value).filter((v): v is number => v != null);
  const lo = values.length ? Math.min(...values) : 0;
  const hi = values.length ? Math.max(...values) : 1;
  const pad = Math.max(1, (hi - lo) * domainPad);
  const min = lo - pad;
  const max = hi + pad;
  const slot = (W - PAD_X * 2) / data.length;
  const x = (i: number) => PAD_X + slot * i + slot / 2;
  const y = (v: number) => height - ((v - min) / (max - min)) * height;

  // Break the line where values are missing.
  const segments: string[] = [];
  let current = "";
  data.forEach((d, i) => {
    if (d.value == null) {
      if (current) segments.push(current);
      current = "";
    } else current += `${current ? "L" : "M"}${x(i)},${y(d.value)} `;
  });
  if (current) segments.push(current);

  return (
    <div className="space-y-2">
      <Readout point={data[shown]} title={title} fullLabel={fullLabel} />
      <svg viewBox={`0 0 ${W} ${height + 16}`} className="w-full overflow-visible" role="img" aria-label={title} onMouseLeave={() => setActive(null)}>
        <line x1={0} x2={W} y1={height} y2={height} className="stroke-border" strokeWidth={1} />
        {data[shown]?.value != null && (
          <line x1={x(shown)} x2={x(shown)} y1={0} y2={height} className="stroke-muted-foreground/40" strokeWidth={1} />
        )}
        {segments.map((d, i) => (
          <path key={i} d={d} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className="stroke-series" />
        ))}
        {data.map((d, i) => (
          <g key={d.key} onMouseEnter={() => setActive(i)} onClick={() => setActive(i)} className="cursor-pointer">
            <rect x={x(i) - slot / 2} y={0} width={slot} height={height + 16} fill="transparent" />
            {d.value != null && (
              <circle
                cx={x(i)}
                cy={y(d.value)}
                r={i === shown ? 4.5 : 3}
                strokeWidth={2}
                className={cn("fill-series stroke-card")}
              />
            )}
            <text x={x(i)} y={height + 12} textAnchor="middle" className={cn("text-[9px]", i === shown ? "fill-foreground" : "fill-muted-foreground")}>
              {d.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/** Horizontal stacked bar of sleep stages, ordered light → deep, each labeled (never color alone). */
export function SleepStages({ deep, rem, light, awake }: { deep: number; rem: number; light: number; awake: number }) {
  const stages = [
    { name: "Deep", min: deep, className: "bg-stage-deep" },
    { name: "REM", min: rem, className: "bg-stage-rem" },
    { name: "Light", min: light, className: "bg-stage-light" },
    { name: "Awake", min: awake, className: "bg-stage-awake" },
  ].filter((s) => s.min > 0);
  const total = stages.reduce((s, x) => s + x.min, 0) || 1;
  return (
    <div className="space-y-2">
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
        {stages.map((s) => (
          <div key={s.name} className={cn("h-full first:rounded-l-full last:rounded-r-full", s.className)} style={{ width: `${(s.min / total) * 100}%` }} />
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2 text-xs">
        {stages.map((s) => (
          <div key={s.name} className="flex items-center gap-1.5">
            <span className={cn("size-2.5 shrink-0 rounded-sm", s.className)} />
            <span className="text-muted-foreground">{s.name}</span>
            <span className="ml-auto tabular-nums">{Math.floor(s.min / 60) ? `${Math.floor(s.min / 60)}h` : ""}{String(s.min % 60).padStart(Math.floor(s.min / 60) ? 2 : 1, "0")}{Math.floor(s.min / 60) ? "" : "m"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Small weekday label for a YYYY-MM-DD date. */
export function dayLetter(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "narrow" });
}

export function fullDate(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export interface WeightChartPoint {
  date: string;
  actual: number | null;
  trend: number | null;
  predicted: number | null;
}

/**
 * Two series on one kg axis: smoothed scale weight (trend) and the energy-balance prediction,
 * plus weigh-in dots. Legend + end-of-line labels so identity never relies on color alone.
 */
export function WeightChart({ points, height = 150 }: { points: WeightChartPoint[]; height?: number }) {
  const [active, setActive] = useState<number | null>(null);
  const values = points.flatMap((p) => [p.actual, p.trend, p.predicted]).filter((v): v is number => v != null);
  if (values.length < 2) return null;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max(0.3, (hi - lo) * 0.15);
  const min = lo - pad;
  const max = hi + pad;
  const RIGHT = 40; // room for end labels
  const slot = (W - PAD_X - RIGHT) / Math.max(1, points.length - 1);
  const x = (i: number) => PAD_X + slot * i;
  const y = (v: number) => height - ((v - min) / (max - min)) * height;
  const line = (key: "trend" | "predicted") => {
    let d = "";
    points.forEach((p, i) => {
      const val = p[key];
      if (val == null) return;
      d += `${d ? "L" : "M"}${x(i)},${y(val)} `;
    });
    return d;
  };
  const lastIdx = (key: "trend" | "predicted") => {
    for (let i = points.length - 1; i >= 0; i--) if (points[i][key] != null) return i;
    return -1;
  };
  const shown = active ?? points.length - 1;
  const p = points[shown];
  const t = lastIdx("trend");
  const pr = lastIdx("predicted");
  const ticks = [min + pad, (min + max) / 2, max - pad];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-series" /> Scale trend
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded border-t-2 border-dashed border-series-2" /> Predicted from calories
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full border-2 border-series" /> Weigh-in
        </span>
      </div>
      <p className="text-xs text-muted-foreground tabular-nums">
        {fullDate(p.date)} ·{" "}
        <span className="text-foreground">
          {p.actual != null ? `weighed ${p.actual.toFixed(1)} kg · ` : ""}
          {p.trend != null ? `trend ${p.trend.toFixed(1)}` : "no trend yet"}
          {p.predicted != null ? ` · predicted ${p.predicted.toFixed(1)}` : ""}
        </span>
      </p>
      <svg viewBox={`0 0 ${W} ${height + 16}`} className="w-full overflow-visible" role="img" aria-label="Weight trend vs prediction" onMouseLeave={() => setActive(null)}>
        {ticks.map((tv) => (
          <g key={tv}>
            <line x1={0} x2={W - RIGHT} y1={y(tv)} y2={y(tv)} className="stroke-grid" strokeWidth={1} />
            <text x={0} y={y(tv) - 2} className="fill-muted-foreground text-[9px]">
              {tv.toFixed(1)}
            </text>
          </g>
        ))}
        {active != null && <line x1={x(shown)} x2={x(shown)} y1={0} y2={height} className="stroke-muted-foreground/40" strokeWidth={1} />}
        <path d={line("predicted")} fill="none" strokeWidth={2} strokeDasharray="5 4" strokeLinecap="round" className="stroke-series-2" />
        <path d={line("trend")} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className="stroke-series" />
        {points.map((pt, i) =>
          pt.actual != null ? <circle key={pt.date} cx={x(i)} cy={y(pt.actual)} r={3.5} strokeWidth={2} className="fill-card stroke-series" /> : null,
        )}
        {t >= 0 && (
          <text x={x(t) + 4} y={y(points[t].trend!) + 3} className="fill-foreground text-[9px] font-medium">
            {points[t].trend!.toFixed(1)}
          </text>
        )}
        {pr >= 0 && (
          <text x={x(pr) + 4} y={y(points[pr].predicted!) + (pr === t && Math.abs(y(points[pr].predicted!) - y(points[t].trend!)) < 10 ? 13 : 3)} className="fill-muted-foreground text-[9px]">
            {points[pr].predicted!.toFixed(1)}
          </text>
        )}
        {points.map((pt, i) => (
          <rect key={`hit-${pt.date}`} x={x(i) - slot / 2} y={0} width={Math.max(slot, 6)} height={height + 16} fill="transparent" onMouseEnter={() => setActive(i)} onClick={() => setActive(i)} />
        ))}
        {[0, Math.floor(points.length / 2), points.length - 1].map((i) => (
          <text key={`x-${i}`} x={x(i)} y={height + 12} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"} className="fill-muted-foreground text-[9px]">
            {fullDate(points[i].date)}
          </text>
        ))}
      </svg>
    </div>
  );
}
