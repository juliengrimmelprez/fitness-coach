/**
 * Double progression: once every set hits the target reps at a weight, go up next time;
 * otherwise repeat the weight and chase the missing reps.
 */
import type { WorkoutSet } from "./types";

export interface Suggestion {
  kind: "increase" | "repeat" | "more-reps";
  weight_kg: number | null;
  reps: number;
  text: string;
}

const mode = (xs: number[]) => {
  const counts = new Map<number, number>();
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? 0;
};

/** `equipment` from the exercise library, e.g. "barbell", "dumbbell", "cable", "body only". */
export function suggestNext(lastSets: WorkoutSet[], equipment: string | null): Suggestion | null {
  const done = lastSets.filter((s) => s.done && s.reps);
  if (!done.length) return null;
  const target = mode(done.map((s) => s.reps!));
  const top = Math.max(...done.map((s) => s.weight_kg ?? 0));
  const allHit = done.every((s) => (s.reps ?? 0) >= target);

  if (!top) {
    // Bodyweight: add reps instead of weight.
    return allHit
      ? { kind: "more-reps", weight_kg: null, reps: target + 2, text: `All sets hit ${target} reps. Aim for ${target + 2}.` }
      : { kind: "repeat", weight_kg: null, reps: target, text: `Repeat and aim for ${target} reps on every set.` };
  }

  const atTop = done.filter((s) => s.weight_kg === top);
  if (allHit && atTop.length === done.length) {
    const step = equipment === "dumbbell" || equipment === "kettlebells" ? 1 : 2.5;
    const next = Math.round((top + step) * 2) / 2;
    return { kind: "increase", weight_kg: next, reps: target, text: `All ${done.length} sets at ${top} kg × ${target} last time. Try ${next} kg.` };
  }
  return { kind: "repeat", weight_kg: top, reps: target, text: `Stay at ${top} kg and get ${target} reps on every set before going up.` };
}
