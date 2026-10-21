"use server";

import { AIError, chatCall, structuredCall } from "@/lib/ai/claude";
import { BriefSchema, CoachSchema, MealAnalysisSchema, Per100gSchema, PlanSchema, ReviewSchema, type Brief, type CoachAdvice, type Plan, type Review } from "@/lib/ai/schemas";
import { sumNutrients } from "@/lib/nutrition";
import { slotLabel } from "@/lib/slots";
import { supabaseServer } from "@/lib/supabase/server";
import type { Goal, MealAnalysis, MealSlot, Nutrients, Targets } from "@/lib/types";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function requireUser() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new AIError("You're signed out. Sign in again.");
  return { supabase, user };
}

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof AIError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}

// ---------------------------------------------------------------------------
// analyzeMealPhoto
// ---------------------------------------------------------------------------

const ANALYZE_SYSTEM = `You are a precise nutrition analyst. You are given a photo of a meal (and sometimes a user note).
Work ingredient by ingredient:
1. Identify every distinct food component visible (e.g. "grilled chicken breast", "white rice", "olive oil", "broccoli"). Include cooking fats, dressings and sauces you can see or that the dish clearly requires.
2. For EACH component, estimate its cooked weight in grams using visual cues (a standard dinner plate is ~26 cm across; also use cutlery, glass size and food thickness) and give its nutrition for THAT weight.
3. The meal totals MUST be the sum of the ingredients.
If the user note contradicts the photo (e.g. "ate half the rice", "dressing on the side"), follow the note.
List the 4-8 most significant micronutrients for the whole meal.
Set confidence to "low" when portions or ingredients are hard to see, "high" only when they are clear.
If the photo contains no food, return an empty ingredients list with name "No food detected" and confidence "low".`;

/** The photo is uploaded to Supabase Storage by the browser first; we pass its path to stay under request size limits. */
export async function analyzeMealPhoto(input: { imagePath: string; note?: string }): Promise<ActionResult<MealAnalysis>> {
  return run(async () => {
    const { supabase, user } = await requireUser();
    if (typeof input.imagePath !== "string" || !input.imagePath.startsWith(`${user.id}/`) || input.imagePath.includes(".."))
      throw new AIError("That photo doesn't belong to you.");

    const { data: blob, error } = await supabase.storage.from("meal-photos").download(input.imagePath);
    if (error || !blob) throw new AIError("Couldn't read the uploaded photo. Try again.");

    const mediaType = (["image/jpeg", "image/png", "image/webp", "image/gif"] as const).find((t) => t === blob.type) ?? "image/jpeg";
    const data = Buffer.from(await blob.arrayBuffer()).toString("base64");
    // Cap free text sent to the paid API (server actions can be called with any payload).
    const note = typeof input.note === "string" ? input.note.trim().slice(0, 500) : undefined;

    const result = await structuredCall({
      schema: MealAnalysisSchema,
      system: ANALYZE_SYSTEM,
      effort: "medium",
      content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data } },
        { type: "text", text: note ? `User note: ${note}` : "Analyze this meal." },
      ],
    });

    // Enforce the core rule: meal totals are exactly the sum of the ingredients.
    const ingredients = result.ingredients.map((i) => ({ ...i, grams: Math.round(i.grams) }));
    return { ...result, ingredients, ...sumNutrients(ingredients) };
  });
}

// ---------------------------------------------------------------------------
// lookupIngredient
// ---------------------------------------------------------------------------

export async function lookupIngredient(input: { name: string }): Promise<ActionResult<Nutrients & { name: string }>> {
  return run(async () => {
    await requireUser();
    const name = input.name.trim().slice(0, 120);
    if (!name) throw new AIError("Type a food name first.");
    return structuredCall({
      schema: Per100gSchema,
      system:
        "You are a nutrition database. Return standard nutrition values PER 100 g of the given food as it is typically eaten (cooked if it is usually cooked). Use USDA-style reference values.",
      effort: "low",
      content: [{ type: "text", text: `Food: ${name}` }],
    });
  });
}

// ---------------------------------------------------------------------------
// coachRemainingDay
// ---------------------------------------------------------------------------

const GOAL_TEXT: Record<Goal, string> = {
  lose_fat: "lose fat (20% calorie deficit)",
  get_lean: "get lean (10% deficit, high protein)",
  maintain: "maintain weight",
  build_muscle: "build muscle (12% surplus)",
};

export async function coachRemainingDay(input: {
  targets: Targets;
  eaten: Nutrients;
  loggedSlots: MealSlot[];
  remainingSlots: MealSlot[];
  goal: Goal | null;
  /** Garmin recap: sleep, HRV, today's workouts. */
  training?: string;
  localTime: string;
}): Promise<ActionResult<CoachAdvice>> {
  return run(async () => {
    await requireUser();
    const { targets: t, eaten: e } = input;
    const gap = {
      calories: Math.round(t.calories - e.calories),
      protein_g: Math.round(t.protein_g - e.protein_g),
      carbs_g: Math.round(t.carbs_g - e.carbs_g),
      fat_g: Math.round(t.fat_g - e.fat_g),
    };

    const brief = [
      `Local time: ${input.localTime}`,
      `Goal: ${input.goal ? GOAL_TEXT[input.goal] : "not set"}`,
      `Daily targets: ${t.calories} kcal, ${t.protein_g} g protein, ${t.carbs_g} g carbs, ${t.fat_g} g fat`,
      `Eaten so far: ${Math.round(e.calories)} kcal, ${Math.round(e.protein_g)} g protein, ${Math.round(e.carbs_g)} g carbs, ${Math.round(e.fat_g)} g fat, ${Math.round(e.fiber_g)} g fiber`,
      `Remaining (negative = over target): ${gap.calories} kcal, ${gap.protein_g} g protein, ${gap.carbs_g} g carbs, ${gap.fat_g} g fat`,
      `Meals logged: ${input.loggedSlots.map(slotLabel).join(", ") || "none"}`,
      `Meal slots still open: ${input.remainingSlots.map(slotLabel).join(", ") || "none"}`,
      ...(input.training ? [`Garmin today: ${input.training.slice(0, 600)}`] : []),
    ].join("\n");

    return structuredCall({
      schema: CoachSchema,
      system: `You are a friendly, practical nutrition coach. Given the user's targets and what they've eaten today, tell them how to close the remaining gap.
- The headline is one short line on where the day stands.
- Tips are concrete and specific to the numbers (e.g. "You still need ~60 g protein, so make dinner protein-heavy").
- Meal ideas must use only the open meal slots, be realistic everyday foods, and together roughly match the remaining macros. If there are no open slots or the user is already over target, give 0-1 light ideas and say so in the tips.
- If Garmin data is given, connect advice to it: refuel carbs and protein after hard sessions, and prefer lighter, easy-to-digest food after poor sleep. Targets already include the day's recorded training calories.
- Keep everything short enough to read on a phone.`,
      effort: "low",
      content: [{ type: "text", text: brief }],
    });
  });
}

// ---------------------------------------------------------------------------
// dailyBrief: the Coach tab's "today" summary across sleep, movement, food and training
// ---------------------------------------------------------------------------

export async function dailyBrief(input: { context: string; goal: Goal | null; localTime: string }): Promise<ActionResult<Brief>> {
  return run(async () => {
    await requireUser();
    return structuredCall({
      schema: BriefSchema,
      system: `You are a personal coach for someone who does gym, running and soccer and wants to get lean while performing well.
You get a data summary: Garmin sleep/HRV/resting HR/Body Battery, steps and workouts for the last week, manually logged gym sessions, and food logged vs. targets.
Write today's brief:
- Be specific and tie every point to the numbers given; never invent data. If something is missing (e.g. no sleep synced yet), say so briefly.
- Training plan: balance gym, running and soccer across the week (avoid heavy legs right before or after a hard run or match; follow hard days with easier ones). Scale intensity to recovery.
- Nutrition: they want to get lean, so keep a modest deficit but fuel hard training days; keep protein high.
- Friendly, direct, short enough to read on a phone. No medical claims.`,
      effort: "low",
      content: [
        {
          type: "text",
          text: `Local time: ${input.localTime}\nGoal: ${input.goal ? GOAL_TEXT[input.goal] : "not set"}\n\n${input.context.slice(0, 6000)}`,
        },
      ],
    });
  });
}

// ---------------------------------------------------------------------------
// Coach: weekly review, weekly training plan, and "Ask the Coach" chat.
// The client sends a computed data summary (stats, patterns, weight model), not raw tables.
// ---------------------------------------------------------------------------

const COACH_PERSONA = `You are a personal coach for someone who does gym (an A/B/C split: Push, Pull, Legs+Shoulders), running and soccer, and wants to get lean while performing well.
You receive a data summary computed by the app: daily Garmin recovery (sleep, HRV, resting HR, Body Battery), steps and calories burned, workouts, food logged vs targets, personal patterns found in their history (with sample sizes), and a weight model comparing energy balance with weigh-ins.
Rules: tie every claim to the numbers given and never invent data; mention when a pattern rests on few days; be direct, friendly and concise; no medical claims.`;

export async function weeklyReview(input: { context: string; goal: Goal | null }): Promise<ActionResult<Review>> {
  return run(async () => {
    await requireUser();
    return structuredCall({
      schema: ReviewSchema,
      system: `${COACH_PERSONA}\nWrite a weekly review comparing the last 7 days with the 7 before. Prioritize what matters most for their goal. "keep" and "change" must be specific and measurable.`,
      effort: "medium",
      content: [{ type: "text", text: `Goal: ${input.goal ? GOAL_TEXT[input.goal] : "not set"}\n\n${input.context.slice(0, 12000)}` }],
    });
  });
}

export async function weeklyPlan(input: { context: string; goal: Goal | null; weekDates: string[]; note?: string }): Promise<ActionResult<Plan>> {
  return run(async () => {
    await requireUser();
    return structuredCall({
      schema: PlanSchema,
      system: `${COACH_PERSONA}
Plan the training week. Return exactly one entry per date given, in order.
- Days already in the past: describe what was actually done (from the data) and keep it.
- Gym: rotate their A (Push), B (Pull), C (Legs + Shoulders) split, roughly 3-4 sessions a week, continuing from their most recent session; mention 1-2 key lifts with target weights from recent sessions.
- Running: 1-3 runs (one easy, optionally one longer or tempo) unless recovery is poor.
- Soccer: place matches/games the user mentions; keep the day before easy and avoid heavy legs (C) the day before or after.
- Never schedule two hard days in a row; lower intensity when readiness/HRV is trending down. Include at least one rest or mobility day.`,
      effort: "medium",
      content: [
        {
          type: "text",
          text: `Goal: ${input.goal ? GOAL_TEXT[input.goal] : "not set"}\nWeek dates: ${input.weekDates.join(", ")}\nUser note: ${input.note?.trim().slice(0, 300) || "none"}\n\n${input.context.slice(0, 12000)}`,
        },
      ],
    });
  });
}

export async function askCoach(input: {
  context: string;
  goal: Goal | null;
  messages: { role: "user" | "assistant"; content: string }[];
}): Promise<ActionResult<string>> {
  return run(async () => {
    await requireUser();
    const messages = input.messages.slice(-12).map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
    if (!messages.length || messages[0].role !== "user") throw new AIError("Ask a question first.");
    return chatCall({
      system: `${COACH_PERSONA}
Answer the user's questions about their training, recovery, food and weight using the data summary below. Keep answers short for a phone (usually 2-5 sentences or a few bullets). Use plain text; simple "- " bullets are fine, no headings or tables.

Goal: ${input.goal ? GOAL_TEXT[input.goal] : "not set"}

DATA SUMMARY
${input.context.slice(0, 14000)}`,
      messages,
      effort: "low",
    });
  });
}