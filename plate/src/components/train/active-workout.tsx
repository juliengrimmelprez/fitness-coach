"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Info, Plus, Timer, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { ExerciseAnimation } from "@/components/train/exercise-animation";
import { ExerciseDetail, ExercisePicker } from "@/components/train/exercise-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { loadExercises, type Exercise } from "@/lib/exercises";
import type { Workout, WorkoutExercise, WorkoutSet } from "@/lib/types";
import { cn } from "@/lib/utils";
import { deleteWorkout, formatSet, lastPerformance, saveWorkout, workoutVolume } from "@/lib/workouts";

const REST_S = 90;

export function ActiveWorkout({
  initial,
  history,
  onFinished,
}: {
  initial: Workout;
  history: Workout[];
  onFinished: (w: Workout | null) => void;
}) {
  const [w, setW] = useState(initial);
  const [library, setLibrary] = useState<Map<string, Exercise>>(new Map());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [info, setInfo] = useState<Exercise | null>(null);
  const [restUntil, setRestUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => {
    loadExercises()
      .then((all) => setLibrary(new Map(all.map((e) => [e.id, e]))))
      .catch(() => {});
  }, []);

  // One clock for the elapsed time and the rest countdown.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Debounced autosave so nothing is lost if the phone locks mid-workout.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Workout | null>(null);
  const flush = async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const next = pending.current;
    pending.current = null;
    if (next) await saveWorkout(next).catch(() => toast.error("Couldn't save. Check your connection."));
  };
  useEffect(() => () => void flush(), []);

  function update(next: Workout) {
    setW(next);
    pending.current = next;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 800);
  }

  const setExercises = (exercises: WorkoutExercise[]) => update({ ...w, exercises });
  const patchExercise = (i: number, ex: WorkoutExercise) => setExercises(w.exercises.map((e, j) => (j === i ? ex : e)));

  function addExercise(e: Exercise) {
    const last = lastPerformance(history, e.id);
    const sets: WorkoutSet[] = last
      ? last.sets.map((s) => ({ weight_kg: s.weight_kg, reps: s.reps, done: false }))
      : [0, 1, 2].map(() => ({ weight_kg: null, reps: null, done: false }));
    setExercises([...w.exercises, { id: e.id, name: e.name, sets }]);
  }

  function toggleDone(i: number, j: number) {
    const ex = w.exercises[i];
    const done = !ex.sets[j].done;
    patchExercise(i, { ...ex, sets: ex.sets.map((s, k) => (k === j ? { ...s, done } : s)) });
    if (done) setRestUntil(now + REST_S * 1000);
  }

  async function finish() {
    const doneSets = w.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
    if (doneSets === 0) {
      toast.error("Tick at least one set before finishing, or discard the workout.");
      return;
    }
    const finished = { ...w, ended_at: new Date().toISOString() };
    pending.current = finished;
    await flush();
    toast.success(`Workout saved: ${doneSets} sets, ${workoutVolume(finished).toLocaleString()} kg volume`);
    onFinished(finished);
  }

  async function discard() {
    if (!confirmDiscard) {
      setConfirmDiscard(true);
      setTimeout(() => setConfirmDiscard(false), 3000);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    pending.current = null;
    await deleteWorkout(w.id).catch(() => {});
    onFinished(null);
  }

  const elapsed = Math.max(0, Math.floor((now - new Date(w.started_at).getTime()) / 1000));
  const rest = restUntil ? Math.ceil((restUntil - now) / 1000) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input value={w.name} onChange={(e) => update({ ...w, name: e.target.value })} className="h-9 flex-1 text-base font-semibold" aria-label="Workout name" />
        <span className="flex items-center gap-1 text-sm text-muted-foreground tabular-nums">
          <Timer className="size-4" />
          {clock(elapsed)}
        </span>
      </div>

      {w.exercises.length === 0 && (
        <div className="rounded-xl border border-dashed px-6 py-8 text-center">
          <p className="font-medium">Add your first exercise</p>
          <p className="text-sm text-muted-foreground">Last session&apos;s weights fill in automatically.</p>
        </div>
      )}

      {w.exercises.map((ex, i) => {
        const meta = library.get(ex.id);
        const last = lastPerformance(history, ex.id);
        return (
          <Card key={`${ex.id}-${i}`} size="sm">
            <CardContent className="space-y-2">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => meta && setInfo(meta)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  {meta ? (
                    <ExerciseAnimation exercise={meta} animate={false} className="size-11 shrink-0 rounded-lg border" />
                  ) : (
                    <div className="size-11 shrink-0 rounded-lg bg-secondary" />
                  )}
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 text-sm font-medium">
                      <span className="truncate">{ex.name}</span>
                      <Info className="size-3.5 shrink-0 text-muted-foreground" />
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {last ? `Last time: ${last.sets.map(formatSet).join(", ")}` : "First time logging this"}
                    </span>
                  </span>
                </button>
                <Button variant="ghost" size="icon-sm" onClick={() => setExercises(w.exercises.filter((_, j) => j !== i))} aria-label={`Remove ${ex.name}`}>
                  <Trash2 />
                </Button>
              </div>

              <div className="grid grid-cols-[1.5rem_1fr_1fr_2rem_1.5rem] items-center gap-1.5 text-xs">
                <span className="text-center text-muted-foreground">Set</span>
                <span className="text-center text-muted-foreground">kg</span>
                <span className="text-center text-muted-foreground">Reps</span>
                <span />
                <span />
                {ex.sets.map((s, j) => (
                  <SetRow
                    key={j}
                    index={j}
                    set={s}
                    onChange={(next) => patchExercise(i, { ...ex, sets: ex.sets.map((x, k) => (k === j ? next : x)) })}
                    onToggle={() => toggleDone(i, j)}
                    onRemove={() => patchExercise(i, { ...ex, sets: ex.sets.filter((_, k) => k !== j) })}
                  />
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => {
                  const prev = ex.sets.at(-1);
                  patchExercise(i, { ...ex, sets: [...ex.sets, { weight_kg: prev?.weight_kg ?? null, reps: prev?.reps ?? null, done: false }] });
                }}
              >
                <Plus /> Add set
              </Button>
            </CardContent>
          </Card>
        );
      })}

      <Button variant="outline" size="lg" className="w-full" onClick={() => setPickerOpen(true)}>
        <Plus /> Add exercise
      </Button>

      <div className="grid grid-cols-2 gap-2 pt-2">
        <Button variant={confirmDiscard ? "destructive" : "ghost"} onClick={discard}>
          {confirmDiscard ? "Tap again to discard" : "Discard"}
        </Button>
        <Button onClick={finish}>
          <Check /> Finish workout
        </Button>
      </div>

      {rest > 0 && (
        <div className="fixed inset-x-0 bottom-20 z-30 mx-auto max-w-md px-4 pb-[env(safe-area-inset-bottom)]">
          <div className="flex items-center justify-between rounded-full bg-foreground px-4 py-2.5 text-background shadow-lg">
            <span className="text-sm">
              Rest <span className="font-semibold tabular-nums">{clock(rest)}</span>
            </span>
            <div className="flex gap-1">
              <button type="button" className="rounded-full px-2 text-sm" onClick={() => setRestUntil((r) => (r ?? now) + 30_000)}>
                +30s
              </button>
              <button type="button" className="rounded-full px-2" onClick={() => setRestUntil(null)} aria-label="Skip rest">
                <X className="size-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <ExercisePicker open={pickerOpen} onOpenChange={setPickerOpen} onAdd={addExercise} />
      <Dialog open={info !== null} onOpenChange={(o) => !o && setInfo(null)}>
        <DialogContent className="flex max-h-[88vh] flex-col sm:max-w-md">{info && <ExerciseDetail exercise={info} />}</DialogContent>
      </Dialog>
    </div>
  );
}

function SetRow({ index, set, onChange, onToggle, onRemove }: { index: number; set: WorkoutSet; onChange: (s: WorkoutSet) => void; onToggle: () => void; onRemove: () => void }) {
  const num = (v: string) => (v === "" ? null : Number(v));
  return (
    <>
      <span className="text-center font-medium tabular-nums">{index + 1}</span>
      <Input
        type="number"
        inputMode="decimal"
        step="0.5"
        value={set.weight_kg ?? ""}
        onChange={(e) => onChange({ ...set, weight_kg: num(e.target.value) })}
        className={cn("h-8 text-center tabular-nums", set.done && "bg-primary/10")}
        aria-label={`Set ${index + 1} kg`}
      />
      <Input
        type="number"
        inputMode="numeric"
        value={set.reps ?? ""}
        onChange={(e) => onChange({ ...set, reps: num(e.target.value) })}
        className={cn("h-8 text-center tabular-nums", set.done && "bg-primary/10")}
        aria-label={`Set ${index + 1} reps`}
      />
      <Button size="icon-sm" variant={set.done ? "default" : "outline"} onClick={onToggle} aria-label={set.done ? "Mark set not done" : "Mark set done"}>
        <Check />
      </Button>
      <button type="button" onClick={onRemove} className="text-muted-foreground hover:text-destructive" aria-label={`Remove set ${index + 1}`}>
        <X className="mx-auto size-3.5" />
      </button>
    </>
  );
}

function clock(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}
