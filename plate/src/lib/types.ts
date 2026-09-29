export type Sex = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "athlete";
export type Goal = "lose_fat" | "get_lean" | "maintain" | "build_muscle";
export type MealSlot = "breakfast" | "morning_snack" | "lunch" | "afternoon_snack" | "dinner";
export type Confidence = "low" | "medium" | "high";

export interface Nutrients {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
}

export interface Ingredient extends Nutrients {
  name: string;
  grams: number;
}

export interface Micro {
  name: string;
  amount: string;
  percent_dv: number;
}

export interface Profile {
  id: string;
  display_name: string | null;
  sex: Sex | null;
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  activity_level: ActivityLevel | null;
  goal: Goal | null;
  calorie_goal: number | null;
  protein_goal: number | null;
  carbs_goal: number | null;
  fat_goal: number | null;
  onboarded_at: string | null;
}

export interface Meal extends Nutrients {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  portion: string | null;
  image_path: string | null;
  meal_slot: MealSlot;
  eaten_on: string;
  eaten_at: string;
  ingredients: Ingredient[];
  micros: Micro[];
  confidence: Confidence | null;
}

/** What the AI returns for a photo, before it's saved as a Meal. */
export interface MealAnalysis extends Nutrients {
  name: string;
  description: string;
  portion: string;
  ingredients: Ingredient[];
  micros: Micro[];
  confidence: Confidence;
}

export interface Targets {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}
