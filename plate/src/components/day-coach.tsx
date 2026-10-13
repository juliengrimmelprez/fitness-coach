"use client";

import { useState } from "react";
import { ChevronDown, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { coachRemainingDay } from "@/app/actions/ai";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CoachAdvice } from "@/lib/ai/schemas";
import { SLOTS, slotForTime, slotLabel } from "@/lib/slots";
import type { Goal, Meal, Nutrients, Targets } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DayCoach({
  targets,
  totals,
  meals,
  goal,
  training,
}: {
  targets: Targets;
  totals: Nutrients;
  meals: Meal[];
  goal: Goal | null;
  training?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [advice, setAdvice] = useState<CoachAdvice | null>(null);

  async function ask() {
    setOpen(true);
    setLoading(true);
    const loggedSlots = [...new Set(meals.map((m) => m.meal_slot))];
    // Open slots = not logged yet and not already in the past.
    const nowIndex = SLOTS.findIndex((s) => s.value === slotForTime());
    const remainingSlots = SLOTS.filter((s, i) => i >= nowIndex && !loggedSlots.includes(s.value)).map((s) => s.value);
    const result = await coachRemainingDay({
      targets,
      eaten: totals,
      loggedSlots,
      remainingSlots,
      goal,
      training,
      localTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
    setLoading(false);
    if (result.ok) setAdvice(result.data);
    else toast.error(result.error);
  }

  return (
    <Card size="sm">
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <button type="button" className="flex flex-1 items-center gap-1 text-left font-medium" onClick={() => setOpen(!open)} disabled={!advice}>
            Day coach
            {advice && <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />}
          </button>
          <Button size="sm" variant={advice ? "ghost" : "default"} onClick={ask} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : advice ? <RefreshCw /> : null}
            {advice ? "Refresh" : "How do I close the gap?"}
          </Button>
        </div>

        {open && loading && !advice && <p className="text-sm text-muted-foreground">Looking at your day…</p>}

        {open && advice && (
          <div className={cn("space-y-3 text-sm", loading && "opacity-50")}>
            <p className="font-medium">{advice.headline}</p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {advice.tips.map((tip, i) => (
                <li key={i}>{tip}</li>
              ))}
            </ul>
            {advice.meal_ideas.length > 0 && (
              <div className="space-y-2">
                {advice.meal_ideas.map((idea, i) => (
                  <div key={i} className="rounded-lg bg-secondary/60 p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-medium">{idea.name}</p>
                      <span className="shrink-0 text-xs text-muted-foreground">{slotLabel(idea.slot)}</span>
                    </div>
                    <p className="text-muted-foreground">{idea.description}</p>
                    <p className="mt-1 text-xs tabular-nums">
                      {Math.round(idea.calories)} kcal · <span className="text-protein">P {Math.round(idea.protein_g)}</span> ·{" "}
                      <span className="text-carbs">C {Math.round(idea.carbs_g)}</span> · <span className="text-fat">F {Math.round(idea.fat_g)}</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
