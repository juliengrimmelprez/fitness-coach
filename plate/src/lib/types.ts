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
  /** Adjust daily calories to Garmin-recorded training (base day + workouts). */
  training_adjusted?: boolean;
}

export interface GarminDay {
  date: string;
  sleep_min: number | null;
  deep_sleep_min: number | null;
  rem_sleep_min: number | null;
  sleep_score: number | null;
  hrv_last_night_ms: number | null;
  hrv_weekly_avg_ms: number | null;
  hrv_status: string | null;
  resting_hr: number | null;
  avg_stress: number | null;
  body_battery_high: number | null;
  body_battery_low: number | null;
  steps: number | null;
  active_kcal: number | null;
  total_kcal?: number | null;
  light_sleep_min?: number | null;
  awake_min?: number | null;
  intensity_min_moderate?: number | null;
  intensity_min_vigorous?: number | null;
  vo2max?: number | null;
}

export interface GarminActivity {
  id: number;
  name: string | null;
  type: string | null;
  start_local: string | null;
  local_date: string;
  duration_min: number | null;
  distance_km: number | null;
  pace_s_per_km: number | null;
  avg_hr: number | null;
  calories: number | null;
  strength_sets: { exercise: string | null; reps: number | null; weight_kg: number | null }[] | null;
}

export interface WorkoutSet {
  weight_kg: number | null;
  reps: number | null;
  done: boolean;
}

export interface WorkoutExercise {
  id: string; // free-exercise-db id, e.g. "Barbell_Squat"
  name: string;
  sets: WorkoutSet[];
}

export interface Workout {
  id: string;
  user_id: string;
  date: string;
  name: string;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
  exercises: WorkoutExercise[];
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
