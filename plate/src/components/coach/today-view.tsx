"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BatteryLow,
  CheckCircle2,
  ChevronRight,
  Dumbbell,
  Footprints,
  Loader2,
  Moon,
  RefreshCw,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import { dailyBrief } from "@/app/actions/ai";
import type { CoachData } from "@/components/coach/use-coach-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Brief } from "@/lib/ai/schemas";
import { activityLabel, formatSleep } from "@/lib/garmin";
import { computeReadiness, type Readiness } from "@/lib/readiness";
import { sumNutrients } from "@/lib/nutrition";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TodayView({ today, data, profile }: { today: string; data: CoachData; profile: Profile }) {
  const { raw, targetsToday } = data;
  const todayDay = raw.garminDays.find((d) => d.date === today) ?? null;
  const readiness = computeReadiness(
    todayDay,
    raw.garminDays.filter((d) => d.date < today).slice(-7),
  );
  const eatenToday = sumNutrients(raw.mealsToday);
  const activitiesToday = raw.activities.filter((a) => a.local_date === today);
  const lastWorkout = raw.workouts[0];
  const lastNight = todayDay?.sleep_min ? todayDay : null;

  const briefContext = [
    readiness
      ? `TODAY'S READINESS (Plate estimate): ${readiness.score}/100, ${readiness.label}. ${readiness.parts.map((p) => `${p.name} ${p.detail}`).join("; ")}`
      : "TODAY'S READINESS: not available (last night not synced yet)",
    `FOOD TODAY SO FAR: ${raw.mealsToday.length} entries, ${Math.round(eatenToday.calories)}/${targetsToday.calories} kcal, protein ${Math.round(eatenToday.protein_g)}/${targetsToday.protein_g} g`,
    `TRAINING TODAY SO FAR: ${activitiesToday.map(activityLabel).join(", ") || "none yet"}`,
    "",
    data.context,
  ].join("\n");

  return (
    <div className="space-y-4">
      <ReadinessCard readiness={readiness} hasData={!!todayDay} />
      <BriefCard today={today} userId={profile.id} context={briefContext} goal={profile.goal} />
      <div className="grid grid-cols-2 gap-2">
        <Tile href="/sleep" icon={Moon} title="Sleep" value={lastNight ? (formatSleep(lastNight.sleep_min) ?? "–") : "–"} sub={lastNight?.sleep_score ? `score ${lastNight.sleep_score}` : "not synced yet"} />
        <Tile
          href="/move"
          icon={Footprints}
          title="Move"
          value={todayDay?.total_kcal ? `${Math.round(Number(todayDay.total_kcal)).toLocaleString()} kcal` : "–"}
          sub={todayDay?.steps ? `${todayDay.steps.toLocaleString()} steps so far` : "burned today"}
        />
        <Tile
          href="/food"
          icon={UtensilsCrossed}
          title="Food"
          value={`${Math.round(eatenToday.calories).toLocaleString()} / ${targetsToday.calories.toLocaleString()}`}
          sub={`kcal · protein ${Math.round(eatenToday.protein_g)}/${targetsToday.protein_g} g`}
        />
        <Tile
          href="/train"
          icon={Dumbbell}
          title="Train"
          value={lastWorkout ? daysAgo(lastWorkout.date, today) : activitiesToday.length ? activityLabel(activitiesToday[0]) : "–"}
          sub={lastWorkout ? `last gym: ${lastWorkout.name}` : "no logged workouts yet"}
        />
      </div>
    </div>
  );
}

const LEVEL = {
  high: { icon: CheckCircle2, ring: "stroke-[var(--status-good)]", iconClass: "text-[var(--status-good)]" },
  moderate: { icon: AlertTriangle, ring: "stroke-[var(--status-warning)]", iconClass: "text-[var(--status-warning)]" },
  low: { icon: BatteryLow, ring: "stroke-[var(--status-critical)]", iconClass: "text-[var(--status-critical)]" },
} as const;

function ReadinessCard({ readiness, hasData }: { readiness: Readiness | null; hasData: boolean }) {
  if (!readiness) {
    return (
      <Card>
        <CardContent className="text-sm text-muted-foreground">
          {hasData
            ? "Not enough recovery data yet today to score readiness."
            : "Last night hasn't synced yet. Open Garmin Connect on your phone; Plate picks it up on its next sync."}
        </CardContent>
      </Card>
    );
  }
  const style = LEVEL[readiness.level];
  const Icon = style.icon;
  const r = 40;
  const c = 2 * Math.PI * r;
  return (
    <Card>
      <CardContent className="flex items-center gap-5">
        <div className="relative size-28 shrink-0">
          <svg viewBox="0 0 100 100" className="size-full -rotate-90">
            <circle cx="50" cy="50" r={r} fill="none" strokeWidth="8" className="stroke-secondary" />
            <circle
              cx="50"
              cy="50"
              r={r}
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - readiness.score / 100)}
              className={cn("transition-[stroke-dashoffset] duration-700", style.ring)}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-semibold tabular-nums">{readiness.score}</span>
            <span className="text-[11px] text-muted-foreground">readiness</span>
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="flex items-center gap-1.5 font-semibold">
            <Icon className={cn("size-4 shrink-0", style.iconClass)} />
            {readiness.label}
          </p>
          <ul className="space-y-1 text-xs">
            {readiness.parts.map((p) => (
              <li key={p.name} className="flex justify-between gap-2">
                <span className="text-muted-foreground">{p.name}</span>
                <span className="truncate tabular-nums">{p.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

const AREA = {
  sleep: { icon: Moon, label: "Sleep" },
  move: { icon: Footprints, label: "Move" },
  food: { icon: UtensilsCrossed, label: "Food" },
  train: { icon: Dumbbell, label: "Train" },
} as const;

function BriefCard({ today, userId, context, goal }: { today: string; userId: string; context: string; goal: Profile["goal"] }) {
  const [brief, setBrief] = useState<Brief | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const generate = useCallback(async () => {
    setLoading(true);
    const result = await dailyBrief({ context, goal, localTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) });
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      setBrief((b) => b ?? null);
      return;
    }
    setBrief(result.data);
    await supabaseBrowser().from("coach_briefs").upsert({ user_id: userId, date: today, brief: result.data, created_at: new Date().toISOString() });
  }, [context, goal, today, userId]);

  // Use today's cached brief if there is one; otherwise write it once.
  useEffect(() => {
    let cancelled = false;
    supabaseBrowser()
      .from("coach_briefs")
      .select("brief")
      .eq("date", today)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.brief) setBrief(data.brief as Brief);
        else {
          setBrief(null);
          generate();
        }
      });
    return () => {
      cancelled = true;
    };
    // Only on first load for the day; "Refresh" regenerates explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" /> Today&apos;s brief
          </p>
          {brief && (
            <Button size="xs" variant="ghost" onClick={generate} disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />} Refresh
            </Button>
          )}
        </div>

        {!brief ? (
          loading || brief === undefined ? (
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Reading your sleep, training and food…
              </p>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          ) : (
            <Button onClick={generate} className="w-full">
              <Sparkles /> Generate today&apos;s brief
            </Button>
          )
        ) : (
          <div className={cn("space-y-3", loading && "opacity-50")}>
            <div>
              <p className="text-lg leading-snug font-semibold">{brief.headline}</p>
              <p className="mt-1 text-sm text-muted-foreground">{brief.readiness_note}</p>
            </div>
            <div className="grid gap-2">
              <PlanRow icon={Dumbbell} label="Training" text={brief.plan.training} />
              <PlanRow icon={UtensilsCrossed} label="Nutrition" text={brief.plan.nutrition} />
            </div>
            <ul className="space-y-2 border-t pt-3">
              {brief.insights.map((ins, i) => {
                const area = AREA[ins.area];
                return (
                  <li key={i} className="flex gap-2.5 text-sm">
                    <area.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label={area.label} />
                    <span>{ins.text}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PlanRow({ icon: Icon, label, text }: { icon: React.ComponentType<{ className?: string }>; label: string; text: string }) {
  return (
    <div className="rounded-lg bg-secondary/60 p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </p>
      <p className="mt-1 text-sm">{text}</p>
    </div>
  );
}

function Tile({ href, icon: Icon, title, value, sub }: { href: string; icon: React.ComponentType<{ className?: string }>; title: string; value: string; sub: string }) {
  return (
    <Link href={href} className="group">
      <Card size="sm" className="h-full transition-colors group-hover:bg-secondary/40">
        <CardContent className="space-y-1">
          <p className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Icon className="size-3.5" /> {title}
            </span>
            <ChevronRight className="size-3.5" />
          </p>
          <p className="truncate text-lg font-semibold tabular-nums">{value}</p>
          <p className="truncate text-[11px] text-muted-foreground">{sub}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

function daysAgo(date: string, today: string) {
  const ms = new Date(`${today}T12:00:00`).getTime() - new Date(`${date}T12:00:00`).getTime();
  const n = Math.round(ms / 86_400_000);
  return n === 0 ? "Today" : n === 1 ? "Yesterday" : `${n} days ago`;
}
