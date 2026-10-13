"use client";

import { supabaseBrowser } from "./supabase/client";
import type { Workout, WorkoutSet } from "./types";

export async function fetchActiveWorkout(): Promise<Workout | null> {
  const { data, error } = await supabaseBrowser()
    .from("workouts")
    .select("*")
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as Workout | null) ?? null;
}

export async function fetchRecentWorkouts(limit = 30): Promise<Workout[]> {
  const { data, error } = await supabaseBrowser()
    .from("workouts")
    .select("*")
    .not("ended_at", "is", null)
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as Workout[];
}

export async function startWorkout(userId: string, date: string): Promise<Workout> {
  const hour = new Date().getHours();
  const name = hour < 12 ? "Morning workout" : hour < 17 ? "Afternoon workout" : "Evening workout";
  const { data, error } = await supabaseBrowser()
    .from("workouts")
    .insert({ user_id: userId, date, name, exercises: [] })
    .select()
    .single();
  if (error) throw error;
  return data as Workout;
}

export async function saveWorkout(w: Workout): Promise<void> {
  const { error } = await supabaseBrowser()
    .from("workouts")
    .update({ name: w.name, notes: w.notes, exercises: w.exercises, ended_at: w.ended_at })
    .eq("id", w.id);
  if (error) throw error;
}

export async function deleteWorkout(id: string): Promise<void> {
  const { error } = await supabaseBrowser().from("workouts").delete().eq("id", id);
  if (error) throw error;
}

/** The sets from the most recent finished workout that included this exercise. */
export function lastPerformance(history: Workout[], exerciseId: string): { date: string; sets: WorkoutSet[] } | null {
  for (const w of history) {
    const ex = w.exercises.find((e) => e.id === exerciseId);
    const done = ex?.sets.filter((s) => s.done && (s.reps || s.weight_kg));
    if (done?.length) return { date: w.date, sets: done };
  }
  return null;
}

export function workoutVolume(w: Workout): number {
  return Math.round(
    w.exercises.reduce((sum, e) => sum + e.sets.reduce((s, set) => s + (set.done ? (set.weight_kg ?? 0) * (set.reps ?? 0) : 0), 0), 0),
  );
}

export const formatSet = (s: WorkoutSet) =>
  s.weight_kg ? `${s.weight_kg} kg × ${s.reps ?? "?"}` : `${s.reps ?? "?"} reps`;
