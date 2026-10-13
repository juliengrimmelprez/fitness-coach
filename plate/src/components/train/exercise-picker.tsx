"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Plus, Search } from "lucide-react";
import { ExerciseAnimation } from "@/components/train/exercise-animation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MUSCLE_GROUPS, loadExercises, searchExercises, titleCase, type Exercise } from "@/lib/exercises";
import { cn } from "@/lib/utils";

/** Browse/search the library. With `onAdd`, each exercise can be added to the current workout. */
export function ExercisePicker({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd?: (exercise: Exercise) => void;
}) {
  const [all, setAll] = useState<Exercise[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string | null>(null);
  const [detail, setDetail] = useState<Exercise | null>(null);

  useEffect(() => {
    if (!open || all) return;
    let cancelled = false;
    loadExercises()
      .then((data) => !cancelled && setAll(data))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [open, all]);

  const results = useMemo(() => (all ? searchExercises(all, query, group) : []), [all, query, group]);

  function add(e: Exercise) {
    onAdd?.(e);
    setDetail(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-3 sm:max-w-md">
        {detail ? (
          <ExerciseDetail exercise={detail} onBack={() => setDetail(null)} onAdd={onAdd ? () => add(detail) : undefined} />
        ) : (
          <>
            <DialogTitle>{onAdd ? "Add exercise" : "Exercise library"}</DialogTitle>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search 870+ exercises…" className="pl-8" />
            </div>
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
              <Chip active={group === null} onClick={() => setGroup(null)}>
                All
              </Chip>
              {MUSCLE_GROUPS.map((g) => (
                <Chip key={g.value} active={group === g.value} onClick={() => setGroup(group === g.value ? null : g.value)}>
                  {g.label}
                </Chip>
              ))}
            </div>

            <div className="-mx-4 min-h-0 flex-1 overflow-y-auto px-4">
              {error ? (
                <p className="py-6 text-center text-sm text-destructive">{error}</p>
              ) : !all ? (
                <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Loading library…
                </p>
              ) : results.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No exercises match.</p>
              ) : (
                <ul className="divide-y">
                  {results.map((e) => (
                    <li key={e.id} className="flex items-center gap-3 py-2">
                      <button type="button" onClick={() => setDetail(e)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                        <ExerciseAnimation exercise={e} animate={false} className="size-12 shrink-0 rounded-lg border" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{e.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {titleCase(e.primaryMuscles.join(", "))}
                            {e.equipment ? ` · ${e.equipment}` : ""}
                          </span>
                        </span>
                      </button>
                      {onAdd && (
                        <Button size="icon-sm" variant="outline" onClick={() => add(e)} aria-label={`Add ${e.name}`}>
                          <Plus />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1 text-xs transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-secondary",
      )}
    >
      {children}
    </button>
  );
}

export function ExerciseDetail({ exercise: e, onBack, onAdd }: { exercise: Exercise; onBack?: () => void; onAdd?: () => void }) {
  return (
    <div className="-mx-4 min-h-0 flex-1 space-y-4 overflow-y-auto px-4">
      <div className="flex items-center gap-2">
        {onBack && (
          <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label="Back to list">
            <ArrowLeft />
          </Button>
        )}
        <DialogTitle className="leading-tight">{e.name}</DialogTitle>
      </div>
      <ExerciseAnimation exercise={e} className="aspect-[4/3] w-full rounded-xl border" />
      <div className="flex flex-wrap gap-1.5">
        {e.primaryMuscles.map((m) => (
          <Badge key={m}>{titleCase(m)}</Badge>
        ))}
        {e.secondaryMuscles.map((m) => (
          <Badge key={m} variant="secondary">
            {titleCase(m)}
          </Badge>
        ))}
        {e.equipment && <Badge variant="outline">{titleCase(e.equipment)}</Badge>}
        <Badge variant="outline">{titleCase(e.level)}</Badge>
      </div>
      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
        {e.instructions.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
      {onAdd && (
        <Button size="lg" className="sticky bottom-0 w-full" onClick={onAdd}>
          <Plus /> Add to workout
        </Button>
      )}
    </div>
  );
}
