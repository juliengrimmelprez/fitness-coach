import type { MealSlot } from "./types";

export const SLOTS: { value: MealSlot; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "morning_snack", label: "Morning snack" },
  { value: "lunch", label: "Lunch" },
  { value: "afternoon_snack", label: "Afternoon snack" },
  { value: "dinner", label: "Dinner" },
];

export const slotLabel = (slot: MealSlot) => SLOTS.find((s) => s.value === slot)?.label ?? slot;

/** Pick a default slot from the time of day. */
export function slotForTime(d: Date = new Date()): MealSlot {
  const minutes = d.getHours() * 60 + d.getMinutes();
  if (minutes < 10 * 60 + 30) return "breakfast";
  if (minutes < 12 * 60) return "morning_snack";
  if (minutes < 15 * 60) return "lunch";
  if (minutes < 18 * 60 + 30) return "afternoon_snack";
  return "dinner";
}

/** YYYY-MM-DD in the browser's local timezone (not UTC). */
export function localDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
