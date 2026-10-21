"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildCoachContext } from "@/lib/coach-context";
import { fetchGarminRange } from "@/lib/garmin";
import { addDays, buildDays, findPatterns, weekStats, weightModel } from "@/lib/insights";
import { fetchFoodByDay, fetchMeals } from "@/lib/meals";
import { profileTargets, trainingTargets } from "@/lib/nutrition";
import type { GarminActivity, GarminDay, Meal, Profile, Workout } from "@/lib/types";
import { fetchWeights, type WeightLog } from "@/lib/weights";
import { fetchRecentWorkouts } from "@/lib/workouts";

const HISTORY_DAYS = 35;

export interface CoachRaw {
  garminDays: GarminDay[];
  activities: GarminActivity[];
  food: Awaited<ReturnType<typeof fetchFoodByDay>>;
  mealsToday: Meal[];
  mealsYesterday: Meal[];
  workouts: Workout[];
  weights: WeightLog[];
}

/** Loads ~5 weeks of everything once, then derives stats, patterns, the weight model and the AI context. */
export function useCoachData(today: string, profile: Profile) {
  const [raw, setRaw] = useState<CoachRaw | null>(null);
  const [version, setVersion] = useState(0);
  const start = addDays(today, -(HISTORY_DAYS - 1));
  const yesterday = addDays(today, -1);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchGarminRange(start, today),
      fetchFoodByDay(start, today).catch(() => ({})),
      fetchMeals(today).catch(() => []),
      fetchMeals(yesterday).catch(() => []),
      fetchRecentWorkouts(40).catch(() => []),
      fetchWeights(addDays(today, -90), today),
    ]).then(([g, food, mealsToday, mealsYesterday, workouts, weights]) => {
      if (!cancelled) setRaw({ garminDays: g.days, activities: g.activities, food, mealsToday, mealsYesterday, workouts, weights });
    });
    return () => {
      cancelled = true;
    };
  }, [start, today, yesterday, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  const derived = useMemo(() => {
    if (!raw) return null;
    const days = buildDays(start, today, raw.garminDays, raw.activities, raw.food, raw.workouts);
    const complete = days.filter((d) => d.date < today); // today is still in progress
    const targetsFor = (date: string) =>
      (profile.training_adjusted !== false && trainingTargets(profile, raw.activities.filter((a) => a.local_date === date))) || profileTargets(profile);
    const targetsToday = targetsFor(today);
    const thisWeek = weekStats(complete.slice(-7), targetsToday.protein_g);
    const lastWeek = weekStats(complete.slice(-14, -7), targetsToday.protein_g);
    const patterns = findPatterns(complete, targetsToday.protein_g);
    // Include today's weigh-in on the chart, but not today's half-finished food in the prediction.
    const weight = weightModel(
      days.map((d) => (d.date === today ? { ...d, eaten: null, meals: 0 } : d)),
      raw.weights,
    );
    const latestWeight = raw.weights.at(-1) ?? null;
    const context = buildCoachContext({
      today,
      targets: targetsToday,
      days,
      thisWeek,
      lastWeek,
      patterns,
      weight,
      latestWeight,
      workouts: raw.workouts,
      activities: raw.activities,
    });
    return { days, complete, targetsFor, targetsToday, thisWeek, lastWeek, patterns, weight, latestWeight, context };
  }, [raw, start, today, profile]);

  return { raw, derived, reload, yesterday };
}

export type CoachData = NonNullable<ReturnType<typeof useCoachData>["derived"]> & { raw: CoachRaw };
