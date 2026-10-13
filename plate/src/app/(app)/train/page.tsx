"use client";

import { useEffect, useState } from "react";
import { BookOpen, ChevronDown, Dumbbell, Loader2, Play, Watch } from "lucide-react";
import { toast } from "sonner";
import { fullDate } from "@/components/charts";
import { PageHeader } from "@/components/page-header";
import { useProfile } from "@/components/profile-context";
import { ActiveWorkout } from "@/components/train/active-workout";
import { ExercisePicker } from "@/components/train/exercise-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocalToday } from "@/hooks/use-local-today";
import { titleCase } from "@/lib/exercises";
import { fetchGarminStrengthSessions } from "@/lib/garmin";
import type { GarminActivity, Workout } from "@/lib/types";
import { cn } from "@/lib/utils";
import { fetchActiveWorkout, fetchRecentWorkouts, formatSet, startWorkout, workoutVolume } from "@/lib/workouts";

type HistoryItem = { kind: "manual"; date: string; workout: Workout } | { kind: "garmin"; date: string; activity: GarminActivity };

export default function TrainPage() {
  const today = useLocalToday();
  return today ? <Train today={today} /> : null;
}

function Train({ today }: { today: string }) {
  const { profile } = useProfile();
  const [active, setActive] = useState<Workout | null | undefined>(undefined);
  const [history, setHistory] = useState<Workout[]>([]);
  const [garmin, setGarmin] = useState<GarminActivity[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchActiveWorkout(), fetchRecentWorkouts(), fetchGarminStrengthSessions()])
      .then(([a, h, g]) => {
        if (cancelled) return;
        setActive(a);
        setHistory(h);
        setGarmin(g);
      })
      .catch(() => {
        if (cancelled) return;
        toast.error("Couldn't load workouts. Has the database update (002) been run?");
        setActive(null);
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  async function start() {
    setStarting(true);
    try {
      setActive(await startWorkout(profile.id, today));
    } catch {
      toast.error("Couldn't start a workout.");
    }
    setStarting(false);
  }

  if (active === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  if (active) {
    return (
      <div className="space-y-4">
        <PageHeader title="Workout in progress" subtitle="Train" />
        <ActiveWorkout
          initial={active}
          history={history}
          onFinished={() => {
            setActive(null);
            setVersion((v) => v + 1);
          }}
        />
      </div>
    );
  }

  // Past Garmin sessions stay as recorded; skip days that also have a manually logged workout.
  const manualDates = new Set(history.map((w) => w.date));
  const items: HistoryItem[] = [
    ...history.map((w) => ({ kind: "manual" as const, date: w.date, workout: w })),
    ...garmin.filter((a) => !manualDates.has(a.local_date)).map((a) => ({ kind: "garmin" as const, date: a.local_date, activity: a })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div className="space-y-4">
      <PageHeader title="Train" subtitle="Log your gym sessions" />

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Button size="lg" className="h-12" onClick={start} disabled={starting}>
          {starting ? <Loader2 className="animate-spin" /> : <Play />}
          Start workout
        </Button>
        <Button size="lg" variant="outline" className="h-12" onClick={() => setLibraryOpen(true)}>
          <BookOpen /> Library
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Tip: also start &ldquo;Strength&rdquo; on your watch. Garmin still measures heart rate and calories, which feed your food targets.
      </p>

      <section className="space-y-2">
        <h2 className="px-1 text-sm font-semibold">History</h2>
        {items.length === 0 ? (
          <p className="px-1 text-sm text-muted-foreground">No workouts yet.</p>
        ) : (
          items.map((item) =>
            item.kind === "manual" ? (
              <ManualCard key={item.workout.id} workout={item.workout} />
            ) : (
              <GarminCard key={item.activity.id} activity={item.activity} />
            ),
          )
        )}
      </section>

      <ExercisePicker open={libraryOpen} onOpenChange={setLibraryOpen} />
    </div>
  );
}

function ManualCard({ workout: w }: { workout: Workout }) {
  const [open, setOpen] = useState(false);
  const sets = w.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
  const minutes = w.ended_at ? Math.round((new Date(w.ended_at).getTime() - new Date(w.started_at).getTime()) / 60000) : null;
  return (
    <Card size="sm" className="py-0">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 p-3 text-left">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Dumbbell className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{w.name}</p>
          <p className="truncate text-xs text-muted-foreground tabular-nums">
            {fullDate(w.date)} · {w.exercises.length} exercises · {sets} sets{minutes ? ` · ${minutes} min` : ""}
          </p>
        </div>
        <span className="shrink-0 text-xs tabular-nums">{workoutVolume(w).toLocaleString()} kg</span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <CardContent className="space-y-1.5 border-t px-3 py-3 text-sm">
          {w.exercises.map((e, i) => (
            <div key={i} className="flex justify-between gap-3">
              <span className="truncate">{e.name}</span>
              <span className="shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                {e.sets.filter((s) => s.done).map(formatSet).join(", ") || "no sets done"}
              </span>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

function GarminCard({ activity: a }: { activity: GarminActivity }) {
  const [open, setOpen] = useState(false);
  // Group Garmin's auto-detected sets by exercise, e.g. "Pull Up: 19, 17".
  const grouped = new Map<string, number[]>();
  for (const s of a.strength_sets ?? []) {
    const name = titleCase((s.exercise ?? "Unknown").toLowerCase().replace(/_/g, " "));
    grouped.set(name, [...(grouped.get(name) ?? []), s.reps ?? 0]);
  }
  return (
    <Card size="sm" className="py-0">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 p-3 text-left">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
          <Watch className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium">
            Gym session <Badge variant="secondary">Garmin</Badge>
          </p>
          <p className="truncate text-xs text-muted-foreground tabular-nums">
            {fullDate(a.local_date)}
            {a.duration_min ? ` · ${Math.round(a.duration_min)} min` : ""}
            {a.avg_hr ? ` · ${Math.round(a.avg_hr)} bpm` : ""}
          </p>
        </div>
        {a.calories ? <span className="shrink-0 text-xs tabular-nums">{Math.round(a.calories)} kcal</span> : null}
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <CardContent className="space-y-1.5 border-t px-3 py-3 text-sm">
          <p className="text-xs text-muted-foreground">Auto-detected by your watch; exercise names may be off.</p>
          {[...grouped].map(([name, reps]) => (
            <div key={name} className="flex justify-between gap-3">
              <span className="truncate">{name}</span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{reps.join(", ")} reps</span>
            </div>
          ))}
          {grouped.size === 0 && <p className="text-xs text-muted-foreground">No sets recorded.</p>}
        </CardContent>
      )}
    </Card>
  );
}
