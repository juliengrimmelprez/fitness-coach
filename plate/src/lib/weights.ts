"use client";

import { supabaseBrowser } from "./supabase/client";

export interface WeightLog {
  date: string;
  weight_kg: number;
}

export async function fetchWeights(start: string, end: string): Promise<WeightLog[]> {
  const { data, error } = await supabaseBrowser()
    .from("weight_logs")
    .select("date, weight_kg")
    .gte("date", start)
    .lte("date", end)
    .order("date");
  if (error) return []; // table missing before migration 003: just no weigh-ins
  return (data as WeightLog[]).map((w) => ({ date: w.date, weight_kg: Number(w.weight_kg) }));
}

export async function saveWeight(userId: string, date: string, weight_kg: number): Promise<void> {
  const { error } = await supabaseBrowser()
    .from("weight_logs")
    .upsert({ user_id: userId, date, weight_kg, note: null }, { onConflict: "user_id,date" });
  if (error) throw error;
}

export async function deleteWeight(date: string): Promise<void> {
  const { error } = await supabaseBrowser().from("weight_logs").delete().eq("date", date);
  if (error) throw error;
}
