"use client";

import { useEffect, useMemo, useState } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { DayCoach } from "@/components/day-coach";
import { LogMealDialog } from "@/components/log-meal-dialog";
import { MacroHeader } from "@/components/macro-header";
import { MealCard } from "@/components/meal-card";
import { useProfile } from "@/components/profile-context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TrainingCard } from "@/components/training-card";
import { activityLabel, fetchGarminForDate, formatSleep } from "@/lib/garmin";
import { deleteMeal, fetchMeals, signedPhotoUrls } from "@/lib/meals";
import { profileTargets, sumNutrients, trainingTargets } from "@/lib/nutrition";
import { SLOTS } from "@/lib/slots";
import type { GarminActivity, GarminDay, Meal } from "@/lib/types";

/** Plain-text recap of Garmin data for the AI coach. */
function trainingSummary({ day, activities }: { day: GarminDay | null; activities: GarminActivity[] }): string {
  const parts: string[] = [];
  if (day?.sleep_min) parts.push(`Slept ${formatSleep(day.sleep_min)}${day.sleep_score ? ` (score ${day.sleep_score})` : ""}`);
  if (day?.hrv_status) parts.push(`HRV ${day.hrv_status.toLowerCase()}`);
  if (day?.body_battery_high) parts.push(`Body Battery peak ${day.body_battery_high}`);
  for (const a of activities) {
    parts.push(
      `${activityLabel(a)}${a.distance_km ? ` ${a.distance_km.toFixed(1)} km` : ""}${a.duration_min ? ` ${Math.round(a.duration_min)} min` : ""}${a.calories ? `, ${Math.round(a.calories)} kcal` : ""}`,
    );
  }
  if (activities.length === 0) parts.push("No workout recorded yet today");
  return parts.join("; ");
}

/** Everything for one day: macro header, optional coach, meals grouped by slot, and logging. */
export function DayView({ date, showCoach, onMealsChanged }: { date: string; showCoach: boolean; onMealsChanged?: () => void }) {
  const { profile } = useProfile();
  const [garmin, setGarmin] = useState<{ day: GarminDay | null; activities: GarminActivity[] } | null>(null);
  const dynamic = profile.training_adjusted !== false && garmin ? trainingTargets(profile, garmin.activities) : null;
  const targets = dynamic ?? profileTargets(profile);
  const [meals, setMeals] = useState<Meal[] | null>(null);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [logOpen, setLogOpen] = useState(false);
  // Bumped on every open so the dialog remounts with fresh fields and a time-based default slot.
  const [logKey, setLogKey] = useState(0);
  const [justLogged, setJustLogged] = useState<string | null>(null);

  // Callers key this component by date, so it loads once per day shown.
  useEffect(() => {
    let cancelled = false;
    fetchMeals(date)
      .then(async (data) => {
        if (cancelled) return;
        setMeals(data);
        const urls = await signedPhotoUrls(data.flatMap((m) => (m.image_path ? [m.image_path] : [])));
        if (!cancelled) setPhotos(urls);
      })
      .catch(() => {
        if (cancelled) return;
        toast.error("Couldn't load meals.");
        setMeals([]);
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  useEffect(() => {
    let cancelled = false;
    fetchGarminForDate(date)
      .then((g) => !cancelled && setGarmin(g))
      .catch(() => !cancelled && setGarmin({ day: null, activities: [] }));
    return () => {
      cancelled = true;
    };
  }, [date]);

  const totals = useMemo(() => sumNutrients(meals ?? []), [meals]);

  async function onLogged(meal: Meal) {
    setMeals((prev) => [...(prev ?? []), meal]);
    setJustLogged(meal.id);
    if (meal.image_path) {
      const urls = await signedPhotoUrls([meal.image_path]);
      setPhotos((prev) => ({ ...prev, ...urls }));
    }
    onMealsChanged?.();
  }

  function onChange(meal: Meal) {
    setMeals((prev) => prev?.map((m) => (m.id === meal.id ? meal : m)) ?? null);
    onMealsChanged?.();
  }

  async function onDelete(meal: Meal) {
    const before = meals;
    setMeals((prev) => prev?.filter((m) => m.id !== meal.id) ?? null);
    try {
      await deleteMeal(meal);
      toast.success(`Deleted ${meal.name}`);
      onMealsChanged?.();
    } catch {
      setMeals(before);
      toast.error("Couldn't delete this meal.");
    }
  }

  return (
    <div className="space-y-4">
      <MacroHeader
        targets={targets}
        totals={totals}
        note={dynamic && dynamic.trainingKcal > 0 ? `Includes +${dynamic.trainingKcal} kcal for today's training` : undefined}
      />
      {garmin && <TrainingCard day={garmin.day} activities={garmin.activities} isToday={showCoach} />}
      {showCoach && meals && garmin && (
        <DayCoach targets={targets} totals={totals} meals={meals} goal={profile.goal} training={trainingSummary(garmin)} />
      )}

      {meals === null ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      ) : meals.length === 0 ? (
        <div className="rounded-xl border border-dashed px-6 py-10 text-center">
          <p className="font-medium">No meals logged</p>
          <p className="text-sm text-muted-foreground">Snap a photo of your food to get started.</p>
        </div>
      ) : (
        SLOTS.map(({ value, label }) => {
          const slotMeals = meals.filter((m) => m.meal_slot === value);
          if (slotMeals.length === 0) return null;
          const sub = sumNutrients(slotMeals);
          return (
            <section key={value} className="space-y-2">
              <div className="flex items-baseline justify-between px-1">
                <h2 className="text-sm font-semibold">{label}</h2>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {Math.round(sub.calories)} kcal · P {Math.round(sub.protein_g)} · C {Math.round(sub.carbs_g)} · F {Math.round(sub.fat_g)}
                </span>
              </div>
              {slotMeals.map((meal) => (
                <MealCard
                  key={meal.id}
                  meal={meal}
                  imageUrl={meal.image_path ? photos[meal.image_path] : undefined}
                  defaultOpen={meal.id === justLogged}
                  onChange={onChange}
                  onDelete={onDelete}
                />
              ))}
            </section>
          );
        })
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-30 mx-auto flex max-w-md justify-end px-4 pb-[env(safe-area-inset-bottom)]">
        <Button size="lg" className="pointer-events-auto h-12 rounded-full px-5 shadow-lg" onClick={() => {
            setLogKey((k) => k + 1);
            setLogOpen(true);
          }}
        >
          <Camera />
          Log meal
        </Button>
      </div>

      <LogMealDialog key={logKey} open={logOpen} onOpenChange={setLogOpen} userId={profile.id} date={date} onLogged={onLogged} />
    </div>
  );
}
