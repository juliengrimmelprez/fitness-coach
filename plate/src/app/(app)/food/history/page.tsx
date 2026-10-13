"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayView } from "@/components/day-view";
import { useProfile } from "@/components/profile-context";
import { Button } from "@/components/ui/button";
import { useLocalToday } from "@/hooks/use-local-today";
import { fetchDailyCalories } from "@/lib/meals";
import { localDateString } from "@/lib/slots";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** How close a day's calories were to the goal, for the calendar colours. */
function adherenceClass(calories: number | undefined, goal: number) {
  if (!calories) return "";
  const r = calories / goal;
  if (r < 0.6) return "bg-carbs/20";
  if (r < 0.85) return "bg-carbs/45";
  if (r <= 1.1) return "bg-primary/55 text-primary-foreground font-semibold";
  if (r <= 1.25) return "bg-destructive/35";
  return "bg-destructive/60 text-white";
}

export default function HistoryPage() {
  const today = useLocalToday();
  return today ? <History today={today} /> : null;
}

function History({ today }: { today: string }) {
  const { profile } = useProfile();
  const goal = profile.calorie_goal ?? 2000;
  const [monthOffset, setMonthOffset] = useState(0);
  const [selected, setSelected] = useState(today);
  const [byDay, setByDay] = useState<Record<string, number>>({});
  const [version, setVersion] = useState(0);

  const [year, monthIndex] = today.split("-").map(Number);
  const month = new Date(year, monthIndex - 1 + monthOffset, 1);
  const start = localDateString(month);
  const end = localDateString(new Date(month.getFullYear(), month.getMonth() + 1, 0));

  useEffect(() => {
    let cancelled = false;
    fetchDailyCalories(start, end)
      .then((data) => !cancelled && setByDay(data))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [start, end, version]);

  // Meal edits fire on every keystroke/step; refresh the calendar colours once things settle.
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => setVersion((v) => v + 1), 1500);
  }, []);

  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const leadingBlanks = (month.getDay() + 6) % 7; // Monday-first grid
  const shift = (delta: number) => setMonthOffset(monthOffset + delta);

  return (
    <div className="space-y-4">
      <Link href="/food" className="-mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Food
      </Link>
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </h1>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => shift(-1)} aria-label="Previous month">
            <ChevronLeft />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => shift(1)} aria-label="Next month">
            <ChevronRight />
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="pb-1 text-xs text-muted-foreground">
            {d}
          </span>
        ))}
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const date = localDateString(new Date(month.getFullYear(), month.getMonth(), i + 1));
          const future = date > today;
          return (
            <button
              key={date}
              type="button"
              disabled={future}
              onClick={() => setSelected(date)}
              className={cn(
                "aspect-square rounded-lg text-sm tabular-nums transition-colors disabled:opacity-30",
                adherenceClass(byDay[date], goal),
                date === selected && "ring-2 ring-foreground",
                date === today && "underline underline-offset-4",
              )}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <Legend className="bg-carbs/45" label="Under" />
        <Legend className="bg-primary/55" label="On target (±10%)" />
        <Legend className="bg-destructive/35" label="Over" />
      </div>

      <h2 className="pt-2 text-lg font-semibold">
        {new Date(`${selected}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
      </h2>
      <DayView key={selected} date={selected} showCoach={false} onMealsChanged={scheduleRefresh} />
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-3 rounded", className)} />
      {label}
    </span>
  );
}
