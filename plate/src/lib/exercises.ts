"use client";

/**
 * Exercise library from free-exercise-db (public domain, 876 exercises):
 * https://github.com/yuhonas/free-exercise-db. The JSON ships in /public; the
 * start/end photos load from jsDelivr's CDN of that repository.
 */
export interface Exercise {
  id: string;
  name: string;
  force: string | null;
  level: string;
  mechanic: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
  images: string[];
}

const IMAGE_BASE = "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/";
export const exerciseImage = (path: string) => IMAGE_BASE + path;

export const MUSCLE_GROUPS: { value: string; label: string; muscles: string[] }[] = [
  { value: "chest", label: "Chest", muscles: ["chest"] },
  { value: "back", label: "Back", muscles: ["lats", "middle back", "lower back", "traps"] },
  { value: "shoulders", label: "Shoulders", muscles: ["shoulders", "neck"] },
  { value: "arms", label: "Arms", muscles: ["biceps", "triceps", "forearms"] },
  { value: "legs", label: "Legs", muscles: ["quadriceps", "hamstrings", "glutes", "calves", "adductors", "abductors"] },
  { value: "core", label: "Core", muscles: ["abdominals"] },
];

const TRAINING_CATEGORIES = new Set(["strength", "powerlifting", "olympic weightlifting", "strongman", "plyometrics"]);

let cache: Promise<Exercise[]> | null = null;

export function loadExercises(): Promise<Exercise[]> {
  cache ??= fetch("/exercises.json")
    .then((r) => {
      if (!r.ok) throw new Error("Couldn't load the exercise library.");
      return r.json() as Promise<Exercise[]>;
    })
    .catch((e) => {
      cache = null; // allow a retry
      throw e;
    });
  return cache;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ");

/** Search by name words; filter by muscle group; stretching/cardio only when explicitly searched. */
export function searchExercises(all: Exercise[], query: string, group: string | null, limit = 60): Exercise[] {
  const words = norm(query).split(/\s+/).filter(Boolean);
  const muscles = group ? MUSCLE_GROUPS.find((g) => g.value === group)?.muscles ?? [] : [];
  const scored: { e: Exercise; score: number }[] = [];
  for (const e of all) {
    if (!words.length && !TRAINING_CATEGORIES.has(e.category)) continue;
    if (muscles.length && !e.primaryMuscles.some((m) => muscles.includes(m))) continue;
    const name = norm(e.name);
    if (!words.every((w) => name.includes(w))) continue;
    // Prefer names that start with the query, then shorter (more "canonical") names.
    const score = (words.length && name.startsWith(words[0]) ? 0 : 1) * 1000 + name.length + (e.level === "beginner" ? 0 : 5);
    scored.push({ e, score });
  }
  return scored.sort((a, b) => a.score - b.score).slice(0, limit).map((s) => s.e);
}

export const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
