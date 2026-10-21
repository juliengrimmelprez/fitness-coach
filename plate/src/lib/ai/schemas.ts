import { z } from "zod";

const nutrientFields = {
  calories: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
  fiber_g: z.number(),
  sugar_g: z.number(),
  sodium_mg: z.number(),
};

export const IngredientSchema = z.object({
  name: z.string(),
  grams: z.number(),
  ...nutrientFields,
});

export const MealAnalysisSchema = z.object({
  name: z.string().describe("Short dish name, e.g. 'Grilled chicken salad'"),
  description: z.string().describe("One sentence describing the meal"),
  portion: z.string().describe("Total portion, e.g. 'approx. 450 g'"),
  ingredients: z.array(IngredientSchema),
  ...nutrientFields,
  micros: z.array(
    z.object({
      name: z.string(),
      amount: z.string().describe("Amount with unit, e.g. '45 mg'"),
      percent_dv: z.number().describe("Percent of adult daily value"),
    }),
  ),
  confidence: z.enum(["low", "medium", "high"]),
});

export const Per100gSchema = z.object({
  name: z.string().describe("Clean, specific food name"),
  ...nutrientFields,
});

export const CoachSchema = z.object({
  headline: z.string().describe("One short status line about the day so far"),
  tips: z.array(z.string()).describe("2-4 short, actionable tips"),
  meal_ideas: z
    .array(
      z.object({
        slot: z.enum(["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner"]),
        name: z.string(),
        description: z.string().describe("What's in it, with rough gram amounts"),
        calories: z.number(),
        protein_g: z.number(),
        carbs_g: z.number(),
        fat_g: z.number(),
      }),
    )
    .describe("1-3 meal ideas sized to close the remaining gap"),
});

export type CoachAdvice = z.infer<typeof CoachSchema>;

export const BriefSchema = z.object({
  headline: z.string().describe("One upbeat, specific line summarizing today, max ~12 words"),
  readiness_note: z.string().describe("1-2 sentences interpreting recovery (sleep, HRV, resting HR) for today"),
  insights: z
    .array(
      z.object({
        area: z.enum(["sleep", "move", "food", "train"]),
        text: z.string().describe("One concrete observation tied to the numbers, max ~25 words"),
      }),
    )
    .describe("3-4 insights across different areas, most important first"),
  plan: z.object({
    training: z.string().describe("Today's training recommendation: what, how hard, roughly how long"),
    nutrition: z.string().describe("Today's food focus with rough numbers (kcal, protein)"),
  }),
});

export type Brief = z.infer<typeof BriefSchema>;

export const ReviewSchema = z.object({
  headline: z.string().describe("One line verdict on the week, max ~12 words"),
  summary: z.string().describe("2-3 sentences: how this week compared to last, citing numbers"),
  wins: z.array(z.string()).describe("1-3 things that went well, each tied to a number"),
  keep: z.string().describe("The one habit to keep doing, with why"),
  change: z.string().describe("The one thing to change next week, concrete and measurable"),
});
export type Review = z.infer<typeof ReviewSchema>;

export const PlanSchema = z.object({
  summary: z.string().describe("1-2 sentences on the week's focus and how it balances gym, running and soccer"),
  days: z.array(
    z.object({
      date: z.string().describe("YYYY-MM-DD"),
      type: z.enum(["gym", "run", "soccer", "rest", "mobility"]),
      title: z.string().describe("Short, e.g. 'Gym A: Push' or 'Easy run 6 km'"),
      details: z.string().describe("What exactly: key lifts/targets, distance/pace, or recovery activity"),
      intensity: z.enum(["easy", "moderate", "hard"]),
    }),
  ),
});
export type Plan = z.infer<typeof PlanSchema>;
