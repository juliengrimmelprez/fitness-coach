import type {
  ActivityLevel,
  Goal,
  Ingredient,
  Nutrients,
  Profile,
  Sex,
  Targets,
} from "./types";

export const ACTIVITY_LEVELS: { value: ActivityLevel; label: string; hint: string; factor: number }[] = [
  { value: "sedentary", label: "Sedentary", hint: "Little or no exercise", factor: 1.2 },
  { value: "light", label: "Light", hint: "1–2 workouts / week", factor: 1.375 },
  { value: "moderate", label: "Moderate", hint: "3–4 workouts / week", factor: 1.55 },
  { value: "active", label: "Active", hint: "5–6 workouts / week", factor: 1.725 },
  { value: "athlete", label: "Athlete", hint: "Daily intense training", factor: 1.9 },
];

export const GOALS: { value: Goal; label: string; hint: string; calorieFactor: number; proteinPerKg: number; fatPerKg: number }[] = [
  { value: "lose_fat", label: "Lose fat", hint: "20% deficit", calorieFactor: 0.8, proteinPerKg: 2.0, fatPerKg: 0.8 },
  { value: "get_lean", label: "Get lean", hint: "10% deficit, high protein", calorieFactor: 0.9, proteinPerKg: 2.1, fatPerKg: 0.85 },
  { value: "maintain", label: "Maintain", hint: "Eat at maintenance", calorieFactor: 1.0, proteinPerKg: 1.8, fatPerKg: 0.9 },
  { value: "build_muscle", label: "Build muscle", hint: "12% surplus", calorieFactor: 1.12, proteinPerKg: 2.0, fatPerKg: 0.9 },
];

export interface BodyStats {
  sex: Sex;
  age: number;
  height_cm: number;
  weight_kg: number;
  activity_level: ActivityLevel;
  goal: Goal;
}

/** Mifflin-St Jeor basal metabolic rate (kcal/day). */
export function bmr({ sex, age, height_cm, weight_kg }: BodyStats): number {
  return 10 * weight_kg + 6.25 * height_cm - 5 * age + (sex === "male" ? 5 : -161);
}

export function maintenanceCalories(stats: BodyStats): number {
  const factor = ACTIVITY_LEVELS.find((a) => a.value === stats.activity_level)!.factor;
  return Math.max(1200, bmr(stats) * factor);
}

export function computeTargets(stats: BodyStats): Targets & { maintenance: number } {
  const goal = GOALS.find((g) => g.value === stats.goal)!;
  const maintenance = maintenanceCalories(stats);
  const calories = Math.max(1200, maintenance * goal.calorieFactor);
  const protein_g = goal.proteinPerKg * stats.weight_kg;
  const fat_g = goal.fatPerKg * stats.weight_kg;
  const carbs_g = Math.max(50, (calories - protein_g * 4 - fat_g * 9) / 4);
  return {
    maintenance: Math.round(maintenance),
    calories: Math.round(calories),
    protein_g: Math.round(protein_g),
    carbs_g: Math.round(carbs_g),
    fat_g: Math.round(fat_g),
  };
}

export function profileTargets(p: Profile): Targets {
  return {
    calories: p.calorie_goal ?? 2000,
    protein_g: p.protein_goal ?? 150,
    carbs_g: p.carbs_goal ?? 200,
    fat_g: p.fat_goal ?? 65,
  };
}

export const NUTRIENT_KEYS = [
  "calories",
  "protein_g",
  "carbs_g",
  "fat_g",
  "fiber_g",
  "sugar_g",
  "sodium_mg",
] as const satisfies readonly (keyof Nutrients)[];

export const ZERO: Nutrients = {
  calories: 0,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0,
  fiber_g: 0,
  sugar_g: 0,
  sodium_mg: 0,
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Sum nutrients across ingredients (or meals). Meal totals are always derived this way. */
export function sumNutrients(items: Nutrients[]): Nutrients {
  const total = { ...ZERO };
  for (const item of items) {
    for (const k of NUTRIENT_KEYS) total[k] += Number(item[k]) || 0;
  }
  for (const k of NUTRIENT_KEYS) total[k] = round1(total[k]);
  return total;
}

/** Re-scale one ingredient to a new weight: every nutrient moves by the same ratio. */
export function scaleIngredient(ing: Ingredient, newGrams: number): Ingredient {
  const grams = Math.max(0, Math.round(newGrams));
  if (ing.grams <= 0) return { ...ing, grams };
  const ratio = grams / ing.grams;
  const scaled = { ...ing, grams };
  for (const k of NUTRIENT_KEYS) scaled[k] = round1(ing[k] * ratio);
  return scaled;
}

/** Scale every ingredient by the same factor (portion multiplier or new total weight). */
export function scaleAll(ingredients: Ingredient[], factor: number): Ingredient[] {
  return ingredients.map((i) => scaleIngredient(i, i.grams * factor));
}

export function totalGrams(ingredients: Ingredient[]): number {
  return Math.round(ingredients.reduce((s, i) => s + (Number(i.grams) || 0), 0));
}

/** Build an ingredient from a per-100g nutrition profile. */
export function ingredientFromPer100g(name: string, grams: number, per100g: Nutrients): Ingredient {
  const ratio = grams / 100;
  const ing: Ingredient = { name, grams: Math.round(grams), ...ZERO };
  for (const k of NUTRIENT_KEYS) ing[k] = round1(per100g[k] * ratio);
  return ing;
}
