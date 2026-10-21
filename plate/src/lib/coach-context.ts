import type { DayRecord, Pattern, WeekStats, WeightModel } from "./insights";
import type { GarminActivity, Targets, Workout } from "./types";

const fmtSleep = (m: number | null) => (m == null ? "-" : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`);
const v = (x: number | null | undefined) => (x == null ? "-" : String(x));

function week(label: string, w: WeekStats) {
  return `${label} (${w.start} to ${w.end}): sleep ${fmtSleep(w.sleepAvgMin)} avg (score ${v(w.sleepScoreAvg)}), HRV ${v(w.hrvAvg)} ms, resting HR ${v(w.rhrAvg)}, steps ${v(w.stepsAvg)}/day, burned ${v(w.burnAvg)} kcal/day, gym sessions ${w.gymSessions}, running ${w.runKm} km, active ${w.activeMin} min; food logged on ${w.foodDays} complete days: ${v(w.eatenAvg)} kcal/day, protein ${v(w.proteinAvg)} g/day (target hit ${w.proteinHitDays}/${w.foodDays}), energy balance ${v(w.balanceAvg)} kcal/day`;
}

/** Text summary shared by the weekly review, plan and chat. Computed numbers only, no PII. */
export function buildCoachContext(x: {
  today: string;
  targets: Targets;
  days: DayRecord[]; // oldest first, up to today
  thisWeek: WeekStats;
  lastWeek: WeekStats;
  patterns: Pattern[];
  weight: WeightModel;
  latestWeight: { date: string; weight_kg: number } | null;
  workouts: Workout[]; // newest first
  activities: GarminActivity[];
}): string {
  const L: string[] = [];
  L.push(`Today: ${x.today}. Daily targets: ${x.targets.calories} kcal, protein ${x.targets.protein_g} g, carbs ${x.targets.carbs_g} g, fat ${x.targets.fat_g} g.`);
  L.push("", "WEEKS", week("Last 7 days", x.thisWeek), week("Previous 7 days", x.lastWeek));

  L.push("", "DAILY (date: sleep, sleep score, HRV, resting HR, Body Battery, steps, kcal burned, kcal eaten [meals logged], protein g, training min)");
  for (const d of x.days.slice(-14)) {
    L.push(
      `${d.date}${d.date === x.today ? " (today, partial)" : ""}: ${fmtSleep(d.sleepMin)}, ${v(d.sleepScore)}, ${v(d.hrv)}, ${v(d.rhr)}, ${v(d.bodyBattery)}, ${v(d.steps)}, ${v(d.burn)}, ${d.eaten == null ? "not logged" : `${d.eaten} [${d.meals}]`}, ${v(d.protein)}, ${d.activityMin}${d.lateWorkout ? " (late workout)" : ""}`,
    );
  }

  L.push("", "WATCH ACTIVITIES (last 14 days)");
  const since = x.days.at(-14)?.date ?? x.today;
  const acts = x.activities.filter((a) => a.local_date >= since);
  if (!acts.length) L.push("none");
  for (const a of acts) {
    L.push(
      `${a.local_date} ${a.start_local?.slice(11, 16) ?? ""} ${a.type ?? "activity"}${a.distance_km ? ` ${Number(a.distance_km).toFixed(1)} km` : ""}${a.duration_min ? ` ${Math.round(Number(a.duration_min))} min` : ""}${a.avg_hr ? ` HR ${Math.round(a.avg_hr)}` : ""}${a.calories ? ` ${Math.round(Number(a.calories))} kcal` : ""}`,
    );
  }

  L.push("", "GYM WORKOUTS LOGGED (newest first; sets as kg x reps, dumbbells per hand)");
  if (!x.workouts.length) L.push("none");
  for (const w of x.workouts.slice(0, 8)) {
    const ex = w.exercises
      .map((e) => {
        const done = e.sets.filter((s) => s.done);
        if (!done.length) return null;
        const s = done[0];
        return `${e.name} ${done.length}x${s.reps ?? "?"}${s.weight_kg ? ` @${s.weight_kg}` : ""}`;
      })
      .filter(Boolean)
      .join("; ");
    L.push(`${w.date} ${w.name}: ${ex}`);
  }

  L.push("", "PERSONAL PATTERNS (from the last ~5 weeks; n = days per group)");
  if (!x.patterns.length) L.push("none with enough data yet");
  for (const p of x.patterns) L.push(`- ${p.insight} (${p.groupA.label} n=${p.groupA.n}, ${p.groupB.label} n=${p.groupB.n})`);

  L.push("", "WEIGHT");
  if (!x.latestWeight) L.push("no weigh-ins logged");
  else {
    L.push(
      `Latest weigh-in ${x.latestWeight.weight_kg} kg on ${x.latestWeight.date}. Scale trend ${v(x.weight.trendRatePerWeek)} kg/week; energy-balance prediction ${v(x.weight.predictedRatePerWeek)} kg/week (avg balance ${v(x.weight.avgBalance)} kcal/day over ${x.weight.balanceDays} fully-logged days out of ${x.weight.totalDays}).`,
    );
  }
  return L.join("\n");
}
