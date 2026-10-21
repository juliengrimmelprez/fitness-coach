"use client";

import { useCallback, useEffect, useState } from "react";
import { BedDouble, CalendarRange, Dumbbell, Footprints, Loader2, RefreshCw, Sparkles, StretchHorizontal, Trophy } from "lucide-react";
import { toast } from "sonner";
import { weeklyPlan } from "@/app/actions/ai";
import { fullDate } from "@/components/charts";
import type { CoachData } from "@/components/coach/use-coach-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { readCache, writeCache } from "@/lib/ai-cache";
import type { Plan } from "@/lib/ai/schemas";
import { addDays } from "@/lib/insights";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

const TYPE = {
  gym: { icon: Dumbbell, label: "Gym" },
  run: { icon: Footprints, label: "Run" },
  soccer: { icon: Trophy, label: "Soccer" },
  rest: { icon: BedDouble, label: "Rest" },
  mobility: { icon: StretchHorizontal, label: "Mobility" },
} as const;

/** Monday–Sunday of the week containing `today`. */
function weekOf(today: string): string[] {
  const [y, m, d] = today.split("-").map(Number);
  const dow = (new Date(y, m - 1, d).getDay() + 6) % 7; // Monday = 0
  const monday = addDays(today, -dow);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function PlanView({ today, data, profile }: { today: string; data: CoachData; profile: Profile }) {
  const week = weekOf(today);
  const [plan, setPlan] = useState<Plan | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");

  const generate = useCallback(async () => {
    setLoading(true);
    const result = await weeklyPlan({ context: data.context, goal: profile.goal, weekDates: week, note });
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      setPlan((p) => p ?? null);
      return;
    }
    setPlan(result.data);
    await writeCache(profile.id, "training_plan", week[0], result.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.context, profile.goal, profile.id, note, week[0]]);

  useEffect(() => {
    let cancelled = false;
    readCache<Plan>("training_plan", week[0]).then((cached) => !cancelled && setPlan(cached ?? null));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week[0]]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <CalendarRange className="size-4 text-primary" /> This week&apos;s plan
          </p>
          <p className="text-xs text-muted-foreground">
            Balances your A/B/C gym split, runs and soccer around your recovery. Add anything fixed this week (e.g. &ldquo;soccer match Thursday 8 pm&rdquo;).
          </p>
          <div className="flex gap-2">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Soccer Thursday, travelling Sunday…" aria-label="Notes for the plan" />
            <Button onClick={generate} disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : plan ? <RefreshCw /> : <Sparkles />}
              {plan ? "Re-plan" : "Plan"}
            </Button>
          </div>
          {plan && <p className={cn("text-sm", loading && "opacity-50")}>{plan.summary}</p>}
        </CardContent>
      </Card>

      {plan === undefined || (loading && !plan) ? (
        <div className="space-y-2">
          {loading && (
            <p className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Planning around your recovery and last sessions…
            </p>
          )}
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : plan ? (
        <div className={cn("space-y-2", loading && "opacity-50")}>
          {plan.days.map((d) => {
            const t = TYPE[d.type];
            const past = d.date < today;
            const isToday = d.date === today;
            return (
              <Card key={d.date} size="sm" className={cn(isToday && "ring-2 ring-primary", past && "opacity-60")}>
                <CardContent className="flex gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
                    <t.icon className="size-4" aria-label={t.label} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        {isToday ? "Today" : fullDate(d.date)}
                        {past ? " · done" : ""}
                      </p>
                      <Badge variant={d.intensity === "hard" ? "default" : "secondary"} className="capitalize">
                        {d.intensity}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium">{d.title}</p>
                    <p className="text-xs text-muted-foreground">{d.details}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <p className="px-1 text-sm text-muted-foreground">No plan yet for this week. Add any fixed events above and tap Plan.</p>
      )}
    </div>
  );
}
