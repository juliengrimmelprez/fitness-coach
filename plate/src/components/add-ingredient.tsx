"use client";

import { useState } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { lookupIngredient } from "@/app/actions/ai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchFoods, type Food } from "@/lib/foods";
import { ingredientFromPer100g } from "@/lib/nutrition";
import type { Ingredient } from "@/lib/types";

export function AddIngredient({ onAdd }: { onAdd: (ing: Ingredient) => void }) {
  const [query, setQuery] = useState("");
  const [grams, setGrams] = useState("100");
  const [focused, setFocused] = useState(false);
  const [looking, setLooking] = useState(false);

  const matches = searchFoods(query);
  const g = Math.max(1, Number(grams) || 100);

  function add(food: Food) {
    onAdd(ingredientFromPer100g(food.name, g, food));
    setQuery("");
  }

  async function findNutrition() {
    setLooking(true);
    const result = await lookupIngredient({ name: query });
    setLooking(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const { name, ...per100g } = result.data;
    onAdd(ingredientFromPer100g(name, g, per100g));
    setQuery("");
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder="Add ingredient…"
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            inputMode="numeric"
            value={grams}
            onChange={(e) => setGrams(e.target.value)}
            className="w-16 text-right tabular-nums"
            aria-label="Grams"
          />
          <span className="text-xs text-muted-foreground">g</span>
        </div>
      </div>

      {focused && query.trim() && (
        <div className="overflow-hidden rounded-lg border bg-popover shadow-sm">
          {matches.map((food) => (
            <button
              key={food.name}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(food)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-secondary"
            >
              <span className="truncate">{food.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {Math.round((food.calories * g) / 100)} kcal / {g} g
              </span>
            </button>
          ))}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={findNutrition}
            disabled={looking}
            className="flex w-full items-center gap-2 border-t px-3 py-2 text-left text-sm text-primary hover:bg-secondary"
          >
            {looking ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Find nutrition for &ldquo;{query.trim()}&rdquo;
          </button>
        </div>
      )}
      {!focused && query.trim() && (
        <Button variant="outline" size="sm" onClick={findNutrition} disabled={looking} className="w-full">
          {looking ? <Loader2 className="animate-spin" /> : <Plus />}
          Find nutrition for &ldquo;{query.trim()}&rdquo;
        </Button>
      )}
    </div>
  );
}
