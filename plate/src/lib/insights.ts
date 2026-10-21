/**
 * Pure analytics over the user's combined data (no network, no AI): one record per day,
 * week-over-week stats, personal patterns, and the energy-balance weight model.
 * The AI features receive these computed numbers instead of raw data, so they explain
 * real patterns rather than guessing at them.
 */
import type { GarminActivity, GarminDay, Workout } from "./types";

export interface DayFoodTotals {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  meals: number;
}

export interface DayRecord {
  date: string;
  sleepMin: number | null;
  sleepScore: number | null;
  hrv: number | null;
  rhr: number | null;
  bodyBattery: number | null;
  steps: number | null;
  burn: number | null; // Garmin total kcal (resting + active)
  eaten: number | null; // null when nothing was logged
  protein: number | null;
  meals: number;
  activityMin: number;
  activityKcal: number;
  lateWorkout: boolean; // any activity starting at or after 19:00
  gym: boolean;
  runKm: number;
}

const DAY_MS = 86_400_000;
export const addDays = (date: string, n: number) => {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};
export const daysBetween = (a: string, b: string) =>
  Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / DAY_MS);

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export function buildDays(
  start: string,
  end: string,
  garminDays: GarminDay[],
  activities: GarminActivity[],
  food: Record<string, DayFoodTotals>,
  workouts: Workout[],
): DayRecord[] {
  const g = new Map(garminDays.map((d) => [d.date, d]));
  const out: DayRecord[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) {
    const d = g.get(date);
    const acts = activities.filter((a) => a.local_date === date);
    const f = food[date];
    out.push({
      date,
      sleepMin: num(d?.sleep_min),
      sleepScore: num(d?.sleep_score),
      hrv: num(d?.hrv_last_night_ms),
      rhr: num(d?.resting_hr),
      bodyBattery: num(d?.body_battery_high),
      steps: num(d?.steps),
      burn: num(d?.total_kcal),
      eaten: f ? Math.round(f.calories) : null,
      protein: f ? Math.round(f.protein_g) : null,
      meals: f?.meals ?? 0,
      activityMin: Math.round(acts.reduce((s, a) => s + (Number(a.duration_min) || 0), 0)),
      activityKcal: Math.round(acts.reduce((s, a) => s + (Number(a.calories) || 0), 0)),
      lateWorkout: acts.some((a) => (a.start_local ? Number(a.start_local.slice(11, 13)) >= 19 : false)),
      gym: acts.some((a) => a.type === "strength_training") || workouts.some((w) => w.date === date && w.ended_at),
      runKm: acts.filter((a) => a.type?.includes("running")).reduce((s, a) => s + (Number(a.distance_km) || 0), 0),
    });
  }
  return out;
}

export const mean = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null && !Number.isNaN(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

/** A food day counts as "complete" when breakfast, lunch and dinner-sized logging happened (≥3 entries). */
export const completeFoodDay = (d: DayRecord) => d.eaten != null && d.meals >= 3;

export interface WeekStats {
  start: string;
  end: string;
  sleepAvgMin: number | null;
  sleepScoreAvg: number | null;
  hrvAvg: number | null;
  rhrAvg: number | null;
  stepsAvg: number | null;
  burnAvg: number | null;
  gymSessions: number;
  runKm: number;
  activeMin: number;
  foodDays: number;
  eatenAvg: number | null;
  proteinAvg: number | null;
  proteinHitDays: number;
  balanceAvg: number | null; // eaten - burned on complete food days
}

export function weekStats(days: DayRecord[], proteinTarget: number): WeekStats {
  const food = days.filter(completeFoodDay);
  const balance = food.filter((d) => d.burn != null).map((d) => d.eaten! - d.burn!);
  const r = (v: number | null) => (v == null ? null : Math.round(v));
  return {
    start: days[0]?.date ?? "",
    end: days.at(-1)?.date ?? "",
    sleepAvgMin: r(mean(days.map((d) => d.sleepMin))),
    sleepScoreAvg: r(mean(days.map((d) => d.sleepScore))),
    hrvAvg: r(mean(days.map((d) => d.hrv))),
    rhrAvg: r(mean(days.map((d) => d.rhr))),
    stepsAvg: r(mean(days.map((d) => d.steps))),
    burnAvg: r(mean(days.map((d) => d.burn))),
    gymSessions: days.filter((d) => d.gym).length,
    runKm: Math.round(days.reduce((s, d) => s + d.runKm, 0) * 10) / 10,
    activeMin: days.reduce((s, d) => s + d.activityMin, 0),
    foodDays: food.length,
    eatenAvg: r(mean(food.map((d) => d.eaten))),
    proteinAvg: r(mean(food.map((d) => d.protein))),
    proteinHitDays: food.filter((d) => (d.protein ?? 0) >= proteinTarget * 0.9).length,
    balanceAvg: r(mean(balance)),
  };
}

export interface Pattern {
  id: string;
  title: string;
  insight: string;
  groupA: { label: string; value: number; n: number };
  groupB: { label: string; value: number; n: number };
  unit: string;
  higherIsBetter: boolean;
  /** Relative difference A vs B (e.g. 0.12 = A is 12% higher). */
  diff: number;
}

const MIN_N = 3;

function compare(
  id: string,
  title: string,
  unit: string,
  higherIsBetter: boolean,
  a: { label: string; values: (number | null)[] },
  b: { label: string; values: (number | null)[] },
  describe: (va: number, vb: number) => string,
): Pattern | null {
  const va = a.values.filter((x): x is number => x != null);
  const vb = b.values.filter((x): x is number => x != null);
  if (va.length < MIN_N || vb.length < MIN_N) return null;
  const ma = mean(va)!;
  const mb = mean(vb)!;
  if (mb === 0) return null;
  const diff = (ma - mb) / Math.abs(mb);
  if (Math.abs(diff) < 0.04) return null; // too small to mention
  return {
    id,
    title,
    insight: describe(ma, mb),
    groupA: { label: a.label, value: Math.round(ma), n: va.length },
    groupB: { label: b.label, value: Math.round(mb), n: vb.length },
    unit,
    higherIsBetter,
    diff,
  };
}

/** Personal patterns from the last few weeks. Each needs ≥3 days per group; small samples are labeled. */
export function findPatterns(days: DayRecord[], proteinTarget: number): Pattern[] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const next = (d: DayRecord) => byDate.get(addDays(d.date, 1));
  const pct = (x: number) => `${Math.abs(Math.round(x * 100))}%`;
  const out: (Pattern | null)[] = [];

  // 1. Sleep length -> HRV the same night (Garmin files both under the wake-up date).
  const slept = days.filter((d) => d.sleepMin != null && d.hrv != null);
  out.push(
    compare(
      "sleep-hrv", "Sleep length and HRV", "ms", true,
      { label: "7h+ nights", values: slept.filter((d) => d.sleepMin! >= 420).map((d) => d.hrv) },
      { label: "shorter nights", values: slept.filter((d) => d.sleepMin! < 420).map((d) => d.hrv) },
      (a, b) => `Your HRV is ${pct((a - b) / b)} ${a > b ? "higher" : "lower"} after nights of 7h+ sleep.`,
    ),
  );

  // 2. Hard training day -> next morning's HRV.
  const hard = days.filter((d) => d.activityKcal >= 300 && next(d));
  const rest = days.filter((d) => d.activityKcal === 0 && next(d));
  out.push(
    compare(
      "training-hrv", "Hard sessions and next-day recovery", "ms", true,
      { label: "after hard days", values: hard.map((d) => next(d)!.hrv) },
      { label: "after rest days", values: rest.map((d) => next(d)!.hrv) },
      (a, b) => `The morning after a hard session your HRV is ${pct((a - b) / b)} ${a > b ? "higher" : "lower"} than after rest days.`,
    ),
  );

  // 3. Late workouts -> that night's sleep score.
  const late = days.filter((d) => d.lateWorkout && next(d));
  const notLate = days.filter((d) => !d.lateWorkout && next(d));
  out.push(
    compare(
      "late-sleep", "Late workouts and sleep", "pts", true,
      { label: "after workouts past 7 pm", values: late.map((d) => next(d)!.sleepScore) },
      { label: "other nights", values: notLate.map((d) => next(d)!.sleepScore) },
      (a, b) => `Your sleep score averages ${Math.round(a)} after workouts past 7 pm vs ${Math.round(b)} on other nights.`,
    ),
  );

  // 4. Active days -> sleep score that night.
  const active = days.filter((d) => (d.steps ?? 0) >= 10000 && next(d));
  const quiet = days.filter((d) => d.steps != null && d.steps < 10000 && next(d));
  out.push(
    compare(
      "steps-sleep", "Daily movement and sleep", "pts", true,
      { label: "after 10k+ step days", values: active.map((d) => next(d)!.sleepScore) },
      { label: "after quieter days", values: quiet.map((d) => next(d)!.sleepScore) },
      (a, b) => `You sleep ${a > b ? "better" : "worse"} after 10k+ step days (score ${Math.round(a)} vs ${Math.round(b)}).`,
    ),
  );

  // 5. Protein -> next-day HRV (only once enough food is logged).
  const fed = days.filter((d) => completeFoodDay(d) && next(d));
  out.push(
    compare(
      "protein-hrv", "Protein and recovery", "ms", true,
      { label: "after high-protein days", values: fed.filter((d) => (d.protein ?? 0) >= proteinTarget * 0.9).map((d) => next(d)!.hrv) },
      { label: "after lower-protein days", values: fed.filter((d) => (d.protein ?? 0) < proteinTarget * 0.9).map((d) => next(d)!.hrv) },
      (a, b) => `Next-morning HRV is ${pct((a - b) / b)} ${a > b ? "higher" : "lower"} after days you hit your protein target.`,
    ),
  );

  // 6. Big surplus days -> next-morning resting HR.
  const surplus = days.filter((d) => completeFoodDay(d) && d.burn != null && d.eaten! - d.burn > 500 && next(d));
  const normal = days.filter((d) => completeFoodDay(d) && d.burn != null && d.eaten! - d.burn <= 500 && next(d));
  out.push(
    compare(
      "surplus-rhr", "Big meals and resting heart rate", "bpm", false,
      { label: "after 500+ kcal surplus days", values: surplus.map((d) => next(d)!.rhr) },
      { label: "after other days", values: normal.map((d) => next(d)!.rhr) },
      (a, b) => `Your resting HR is ${Math.abs(Math.round(a - b))} bpm ${a > b ? "higher" : "lower"} the morning after a 500+ kcal surplus.`,
    ),
  );

  return out.filter((p): p is Pattern => p !== null).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
}

// ---------------------------------------------------------------------------
// Weight model
// ---------------------------------------------------------------------------

export const KCAL_PER_KG = 7700;

export interface WeightPoint {
  date: string;
  actual: number | null; // weigh-in that day
  trend: number | null; // smoothed scale weight
  predicted: number | null; // start weight + cumulative energy balance / 7700
}

export interface WeightModel {
  points: WeightPoint[];
  trendRatePerWeek: number | null; // kg/week from the smoothed scale weight
  predictedRatePerWeek: number | null; // kg/week from logged energy balance
  avgBalance: number | null; // kcal/day on complete food days
  balanceDays: number;
  totalDays: number;
}

/**
 * Compare what the scale says (smoothed) with what logged calories in vs. Garmin calories
 * out predict. Days without complete food logs add nothing to the prediction, and are counted
 * so the UI can say how much of the window is covered.
 */
export function weightModel(days: DayRecord[], weighIns: { date: string; weight_kg: number }[]): WeightModel {
  const byDate = new Map(weighIns.map((w) => [w.date, w.weight_kg]));
  const points: WeightPoint[] = [];
  let trend: number | null = null;
  let predicted: number | null = null;
  const balances: number[] = [];
  const ALPHA = 0.3;

  for (const d of days) {
    const actual = byDate.get(d.date) ?? null;
    if (actual != null) trend = trend == null ? actual : trend + ALPHA * (actual - trend);
    if (predicted == null && trend != null) predicted = trend;
    else if (predicted != null && completeFoodDay(d) && d.burn != null) {
      const bal = d.eaten! - d.burn;
      balances.push(bal);
      predicted += bal / KCAL_PER_KG;
    }
    points.push({ date: d.date, actual, trend: trend == null ? null : round2(trend), predicted: predicted == null ? null : round2(predicted) });
  }

  // Slopes over the window where each series exists.
  const slope = (key: "trend" | "predicted") => {
    const pts = points.filter((p) => p[key] != null);
    if (pts.length < 2) return null;
    const first = pts[0];
    const last = pts.at(-1)!;
    const span = daysBetween(first.date, last.date);
    if (span < 5) return null;
    return round2(((last[key]! - first[key]!) / span) * 7);
  };

  return {
    points,
    trendRatePerWeek: slope("trend"),
    predictedRatePerWeek: slope("predicted"),
    avgBalance: balances.length ? Math.round(mean(balances)!) : null,
    balanceDays: balances.length,
    totalDays: days.length,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
