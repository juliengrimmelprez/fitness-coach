"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Minus, Plus, Trash2, UtensilsCrossed, X } from "lucide-react";
import { toast } from "sonner";
import { AddIngredient } from "@/components/add-ingredient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { saveMeal, withDerivedTotals } from "@/lib/meals";
import { scaleAll, scaleIngredient, totalGrams } from "@/lib/nutrition";
import { SLOTS } from "@/lib/slots";
import type { Ingredient, Meal, MealSlot } from "@/lib/types";
import { cn } from "@/lib/utils";

const MULTIPLIERS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const STEP_G = 25;

export function MealCard({
  meal,
  imageUrl,
  defaultOpen = false,
  onChange,
  onDelete,
}: {
  meal: Meal;
  imageUrl?: string;
  defaultOpen?: boolean;
  onChange: (meal: Meal) => void;
  onDelete: (meal: Meal) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Multipliers scale from the portion as it was when the editor was opened (or last hand-edited).
  const [baseline, setBaseline] = useState<Ingredient[]>(meal.ingredients);
  const [multiplier, setMultiplier] = useState(1);
  const [gramsDraft, setGramsDraft] = useState<string | null>(null);

  // Debounced save: the UI updates instantly, the database a moment after the last change.
  const pending = useRef<Meal | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const m = pending.current;
    pending.current = null;
    if (m) saveMeal(m).catch(() => toast.error("Couldn't save your change. Check your connection."));
  };
  useEffect(() => flush, []);

  function commit(next: Meal) {
    const derived = { ...meal, ...withDerivedTotals(next) } as Meal;
    onChange(derived);
    pending.current = derived;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 600);
  }

  function setIngredients(ingredients: Ingredient[], resetBaseline = true) {
    if (resetBaseline) {
      setBaseline(ingredients);
      setMultiplier(1);
    }
    commit({ ...meal, ingredients });
  }

  const grams = totalGrams(meal.ingredients);

  function applyTotalGrams(value: string) {
    setGramsDraft(null);
    const target = Number(value);
    if (!(target > 0) || grams === 0 || target === grams) return;
    setIngredients(scaleAll(meal.ingredients, target / grams));
  }

  return (
    <Card size="sm" className="gap-0 py-0">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 p-3 text-left">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="size-14 shrink-0 rounded-lg object-cover" />
        ) : (
          <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-secondary">
            <UtensilsCrossed className="size-5 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{meal.name}</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {grams} g · <span className="text-protein">P {Math.round(meal.protein_g)}</span> ·{" "}
            <span className="text-carbs">C {Math.round(meal.carbs_g)}</span> · <span className="text-fat">F {Math.round(meal.fat_g)}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold tabular-nums">{Math.round(meal.calories)}</p>
          <p className="text-[11px] text-muted-foreground">kcal</p>
        </div>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <CardContent className="space-y-4 border-t px-3 pt-3 pb-3">
          <div className="flex gap-2">
            <Input value={meal.name} onChange={(e) => commit({ ...meal, name: e.target.value })} aria-label="Meal name" className="flex-1" />
            <select
              value={meal.meal_slot}
              onChange={(e) => commit({ ...meal, meal_slot: e.target.value as MealSlot })}
              className="h-8 rounded-lg border bg-transparent px-2 text-sm"
              aria-label="Meal slot"
            >
              {SLOTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {meal.confidence === "low" && (
            <p className="rounded-lg bg-carbs/15 px-3 py-2 text-xs">Low-confidence estimate: check the weights below.</p>
          )}

          {meal.ingredients.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Portion</span>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={gramsDraft ?? String(grams)}
                    onChange={(e) => setGramsDraft(e.target.value)}
                    onBlur={(e) => applyTotalGrams(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                    className="h-7 w-20 text-right tabular-nums"
                    aria-label="Total grams"
                  />
                  <span className="text-xs text-muted-foreground">g total</span>
                </div>
              </div>
              <div className="grid grid-cols-6 gap-1">
                {MULTIPLIERS.map((m) => (
                  <Button
                    key={m}
                    size="xs"
                    variant={m === multiplier ? "default" : "outline"}
                    onClick={() => {
                      setMultiplier(m);
                      setIngredients(scaleAll(baseline, m), false);
                    }}
                  >
                    {m}×
                  </Button>
                ))}
              </div>
            </div>
          )}

          <ul className="divide-y rounded-lg border">
            {meal.ingredients.map((ing, i) => (
              <IngredientRow
                key={`${ing.name}-${i}`}
                ingredient={ing}
                onGrams={(g) => setIngredients(meal.ingredients.map((x, j) => (j === i ? scaleIngredient(x, g) : x)))}
                onRemove={() => setIngredients(meal.ingredients.filter((_, j) => j !== i))}
              />
            ))}
            {meal.ingredients.length === 0 && <li className="px-3 py-3 text-sm text-muted-foreground">No ingredients yet.</li>}
          </ul>

          <AddIngredient onAdd={(ing) => setIngredients([...meal.ingredients, ing])} />

          {meal.micros.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {meal.micros.map((m) => (
                <Badge key={m.name} variant="secondary" className="font-normal">
                  {m.name} {m.amount}
                  <span className="text-muted-foreground">· {Math.round(m.percent_dv)}%</span>
                </Badge>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground tabular-nums">
            Fiber {Math.round(meal.fiber_g)} g · Sugar {Math.round(meal.sugar_g)} g · Sodium {Math.round(meal.sodium_mg)} mg
          </p>

          <Button
            variant={confirmDelete ? "destructive" : "ghost"}
            size="sm"
            className="w-full"
            onClick={() => {
              if (!confirmDelete) {
                setConfirmDelete(true);
                setTimeout(() => setConfirmDelete(false), 3000);
                return;
              }
              if (timer.current) clearTimeout(timer.current);
              pending.current = null;
              onDelete(meal);
            }}
          >
            <Trash2 />
            {confirmDelete ? "Tap again to delete" : "Delete meal"}
          </Button>
        </CardContent>
      )}
    </Card>
  );
}

function IngredientRow({ ingredient: ing, onGrams, onRemove }: { ingredient: Ingredient; onGrams: (g: number) => void; onRemove: () => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <li className="space-y-1.5 px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm leading-tight">{ing.name}</p>
        <button type="button" onClick={onRemove} className="text-muted-foreground hover:text-destructive" aria-label={`Remove ${ing.name}`}>
          <X className="size-4" />
        </button>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-xs" onClick={() => onGrams(Math.max(1, ing.grams - STEP_G))} aria-label="25 grams less">
            <Minus />
          </Button>
          <Input
            type="number"
            inputMode="numeric"
            value={draft ?? String(ing.grams)}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={(e) => {
              setDraft(null);
              const g = Number(e.target.value);
              // Nutrients scale by ratio, so 0 g would erase them; remove the ingredient instead.
              if (g >= 1 && g !== ing.grams) onGrams(g);
            }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className="h-6 w-14 px-1 text-center text-xs tabular-nums"
            aria-label={`${ing.name} grams`}
          />
          <Button variant="outline" size="icon-xs" onClick={() => onGrams(ing.grams + STEP_G)} aria-label="25 grams more">
            <Plus />
          </Button>
          <span className="text-xs text-muted-foreground">g</span>
        </div>
        <p className="text-xs tabular-nums">
          <span className="font-medium">{Math.round(ing.calories)} kcal</span>{" "}
          <span className="text-protein">{Math.round(ing.protein_g)}</span>/<span className="text-carbs">{Math.round(ing.carbs_g)}</span>/
          <span className="text-fat">{Math.round(ing.fat_g)}</span>
        </p>
      </div>
    </li>
  );
}
