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
