import type { GarminDay } from "./types";

export interface Readiness {
  score: number;
  level: "high" | "moderate" | "low";
  label: string;
  parts: { name: string; score: number; detail: string }[];
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const avg = (xs: (number | null | undefined)[]) => {
  const v = xs.filter((x): x is number => typeof x === "number");
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

/**
 * Plate's own readiness estimate (the Forerunner 165 has no Garmin Training Readiness):
 * sleep score, last night's HRV and resting HR vs. your 7-day baseline, and Body Battery.
 * Missing inputs are left out and the remaining weights rescaled.
 */
export function computeReadiness(today: GarminDay | null, history: GarminDay[]): Readiness | null {
  if (!today) return null;
  const baseHrv = avg(history.map((d) => d.hrv_last_night_ms));
  const baseRhr = avg(history.map((d) => d.resting_hr));
  const parts: (Readiness["parts"][number] & { weight: number })[] = [];

  if (today.sleep_score != null)
    parts.push({ name: "Sleep", weight: 0.35, score: clamp(today.sleep_score), detail: `score ${today.sleep_score}` });
  if (today.hrv_last_night_ms != null && baseHrv) {
    const ratio = today.hrv_last_night_ms / baseHrv;
    const pct = Math.round((ratio - 1) * 100);
    parts.push({ name: "HRV", weight: 0.3, score: clamp(70 + (ratio - 1) * 300), detail: `${pct >= 0 ? "+" : ""}${pct}% vs 7-day avg` });
  }
  if (today.resting_hr != null && baseRhr) {
    const diff = today.resting_hr - baseRhr;
    parts.push({
      name: "Resting HR",
      weight: 0.2,
      score: clamp(70 - diff * 8),
      detail: `${diff >= 0 ? "+" : ""}${diff.toFixed(0)} bpm vs 7-day avg`,
    });
  }
  if (today.body_battery_high != null)
    parts.push({ name: "Body Battery", weight: 0.15, score: clamp(today.body_battery_high), detail: `peak ${today.body_battery_high}` });

  if (parts.length === 0) return null;
  const total = parts.reduce((s, p) => s + p.weight, 0);
  const score = clamp(parts.reduce((s, p) => s + p.score * p.weight, 0) / total);
  const level = score >= 70 ? "high" : score >= 50 ? "moderate" : "low";
  const label = { high: "Ready to train hard", moderate: "Train, but keep it moderate", low: "Prioritize recovery" }[level];
  return { score, level, label, parts: parts.map((p) => ({ name: p.name, score: p.score, detail: p.detail })) };
}
