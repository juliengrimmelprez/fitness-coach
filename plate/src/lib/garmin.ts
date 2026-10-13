"use client";

import { supabaseBrowser } from "./supabase/client";
import type { GarminActivity, GarminDay } from "./types";

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/** Garmin wellness for a date (sleep is filed under the morning you woke up) plus that day's activities. */
export async function fetchGarminForDate(date: string): Promise<{ day: GarminDay | null; activities: GarminActivity[] }> {
  const supabase = supabaseBrowser();
  const [dayRes, actRes] = await Promise.all([
    supabase.from("garmin_daily").select("*").eq("date", date).maybeSingle(),
    supabase.from("garmin_activities").select("*").eq("local_date", date).order("start_local"),
  ]);
  // Tables missing (migration not run yet) or no access: just show no Garmin data.
  const day = dayRes.error || !dayRes.data ? null : (dayRes.data as GarminDay);
  const activities = actRes.error
    ? []
    : (actRes.data as GarminActivity[]).map((a) => ({
        ...a,
        duration_min: num(a.duration_min),
        distance_km: num(a.distance_km),
        calories: num(a.calories),
      }));
  return { day: day && { ...day, hrv_last_night_ms: num(day.hrv_last_night_ms), active_kcal: num(day.active_kcal) }, activities };
}

/** All Garmin days and activities in [start, end] (YYYY-MM-DD, inclusive), oldest first. */
export async function fetchGarminRange(start: string, end: string): Promise<{ days: GarminDay[]; activities: GarminActivity[] }> {
  const supabase = supabaseBrowser();
  const [dayRes, actRes] = await Promise.all([
    supabase.from("garmin_daily").select("*").gte("date", start).lte("date", end).order("date"),
    supabase.from("garmin_activities").select("*").gte("local_date", start).lte("local_date", end).order("start_local"),
  ]);
  const days = dayRes.error
    ? []
    : (dayRes.data as GarminDay[]).map((d) => ({ ...d, hrv_last_night_ms: num(d.hrv_last_night_ms), active_kcal: num(d.active_kcal) }));
  const activities = actRes.error
    ? []
    : (actRes.data as GarminActivity[]).map((a) => ({
        ...a,
        duration_min: num(a.duration_min),
        distance_km: num(a.distance_km),
        calories: num(a.calories),
      }));
  return { days, activities };
}

/** YYYY-MM-DD for `n` days before the given date. */
export function daysBefore(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d - n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/** Every date from start to end inclusive. */
export function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end; d = daysBefore(d, -1)) out.push(d);
  return out;
}

/** Garmin's own estimate of calories burned (resting + active); falls back to resting estimate + active. */
export function dailyBurn(day: GarminDay & { total_kcal?: number | null }): number | null {
  if (day.total_kcal) return Math.round(Number(day.total_kcal));
  return null;
}

/** Past Garmin strength sessions (auto-detected sets), newest first. */
export async function fetchGarminStrengthSessions(limit = 30): Promise<GarminActivity[]> {
  const { data, error } = await supabaseBrowser()
    .from("garmin_activities")
    .select("*")
    .eq("type", "strength_training")
    .order("start_local", { ascending: false })
    .limit(limit);
  return error ? [] : (data as GarminActivity[]);
}

const TYPE_LABELS: Record<string, string> = {
  running: "Run",
  treadmill_running: "Treadmill run",
  trail_running: "Trail run",
  strength_training: "Gym",
  soccer: "Soccer",
  cycling: "Ride",
  walking: "Walk",
  hiit: "HIIT",
};

export function activityLabel(a: GarminActivity) {
  return (a.type && TYPE_LABELS[a.type]) ?? a.name ?? "Activity";
}

export function formatPace(sPerKm: number | null) {
  if (!sPerKm) return null;
  return `${Math.floor(sPerKm / 60)}:${String(Math.round(sPerKm % 60)).padStart(2, "0")}/km`;
}

export function formatSleep(min: number | null) {
  if (!min) return null;
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
}
