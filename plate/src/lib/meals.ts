"use client";

import { sumNutrients, totalGrams } from "./nutrition";
import { supabaseBrowser } from "./supabase/client";
import type { Ingredient, Meal, MealAnalysis, MealSlot } from "./types";

const BUCKET = "meal-photos";

const toNumbers = (m: Meal): Meal => ({
  ...m,
  // Postgres numeric columns arrive as strings in some drivers; normalize.
  calories: Number(m.calories),
  protein_g: Number(m.protein_g),
  carbs_g: Number(m.carbs_g),
  fat_g: Number(m.fat_g),
  fiber_g: Number(m.fiber_g),
  sugar_g: Number(m.sugar_g),
  sodium_mg: Number(m.sodium_mg),
  ingredients: m.ingredients ?? [],
  micros: m.micros ?? [],
});

export async function fetchMeals(date: string): Promise<Meal[]> {
  const { data, error } = await supabaseBrowser()
    .from("meals")
    .select("*")
    .eq("eaten_on", date)
    .order("eaten_at", { ascending: true });
  if (error) throw error;
  return (data as Meal[]).map(toNumbers);
}

/** Calories per day for the calendar, [start, end] inclusive. */
export async function fetchDailyCalories(start: string, end: string): Promise<Record<string, number>> {
  const { data, error } = await supabaseBrowser()
    .from("meals")
    .select("eaten_on, calories")
    .gte("eaten_on", start)
    .lte("eaten_on", end);
  if (error) throw error;
  const byDay: Record<string, number> = {};
  for (const row of data as { eaten_on: string; calories: number }[]) {
    byDay[row.eaten_on] = (byDay[row.eaten_on] ?? 0) + Number(row.calories);
  }
  return byDay;
}

export async function uploadPhoto(userId: string, blob: Blob): Promise<string> {
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabaseBrowser().storage.from(BUCKET).upload(path, blob, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function signedPhotoUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await supabaseBrowser().storage.from(BUCKET).createSignedUrls(paths, 60 * 60);
  if (error) return {};
  const urls: Record<string, string> = {};
  for (const item of data) if (item.path && item.signedUrl) urls[item.path] = item.signedUrl;
  return urls;
}

/** Totals and portion are always derived from the ingredient list. */
export function withDerivedTotals<T extends { ingredients: Ingredient[] }>(meal: T) {
  return { ...meal, ...sumNutrients(meal.ingredients), portion: `approx. ${totalGrams(meal.ingredients)} g` };
}

export async function insertMeal(input: {
  userId: string;
  date: string;
  slot: MealSlot;
  imagePath: string | null;
  analysis: MealAnalysis;
}): Promise<Meal> {
  const { analysis: a } = input;
  const row = withDerivedTotals({
    user_id: input.userId,
    name: a.name,
    description: a.description,
    image_path: input.imagePath,
    meal_slot: input.slot,
    eaten_on: input.date,
    eaten_at: new Date().toISOString(),
    ingredients: a.ingredients,
    micros: a.micros,
    confidence: a.confidence,
  });
  const { data, error } = await supabaseBrowser().from("meals").insert(row).select().single();
  if (error) throw error;
  return toNumbers(data as Meal);
}

export async function saveMeal(meal: Meal): Promise<void> {
  const derived = withDerivedTotals(meal);
  const { error } = await supabaseBrowser()
    .from("meals")
    .update({
      name: derived.name,
      meal_slot: derived.meal_slot,
      ingredients: derived.ingredients,
      portion: derived.portion,
      calories: derived.calories,
      protein_g: derived.protein_g,
      carbs_g: derived.carbs_g,
      fat_g: derived.fat_g,
      fiber_g: derived.fiber_g,
      sugar_g: derived.sugar_g,
      sodium_mg: derived.sodium_mg,
    })
    .eq("id", meal.id);
  if (error) throw error;
}

export async function deleteMeal(meal: Meal): Promise<void> {
  const supabase = supabaseBrowser();
  const { error } = await supabase.from("meals").delete().eq("id", meal.id);
  if (error) throw error;
  if (meal.image_path) await supabase.storage.from(BUCKET).remove([meal.image_path]);
}
