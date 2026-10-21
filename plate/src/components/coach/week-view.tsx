"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Lightbulb, Loader2, Minus, RefreshCw, Sparkles, ThumbsUp, Wrench } from "lucide-react";
import { toast } from "sonner";
import { weeklyReview } from "@/app/actions/ai";
import type { CoachData } from "@/components/coach/use-coach-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { readCache, writeCache } from "@/lib/ai-cache";
import type { Review } from "@/lib/ai/schemas";
import type { Pattern, WeekStats } from "@/lib/insights";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

export function WeekView({ data, profile, yesterday }: { data: CoachData; profile: Profile; yesterday: string }) {
  return (
    <div className="space-y-4">
      <ReviewCard data={data} profile={profile} cacheKey={yesterday} />
      <CompareCard thisWeek={data.thisWeek} lastWeek={data.lastWeek} />
      <PatternsCard patterns={data.patterns} />
    </div>
  );
}

function ReviewCard({ data, profile, cacheKey }: { data: CoachData; profile: Profile; cacheKey: string }) {
  const [review, setReview] = useState<Review | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const generate = useCallback(async () => {
    setLoading(true);
    const result = await weeklyReview({ context: data.context, goal: profile.goal });
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      setReview((r) => r ?? null);
      return;
    }
    setReview(result.data);
    await writeCache(profile.id, "weekly_review", cacheKey, result.data);
  }, [data.context, profile.goal, profile.id, cacheKey]);

  useEffect(() => {
    let cancelled = false;
    readCache<Review>("weekly_review", cacheKey).then((cached) => {
      if (cancelled) return;
      if (cached) setReview(cached);
      else {
        setReview(null);
        generate();
      }
    });
    return () => {
      cancelled = true;
    };
    // Once per day; "Refresh" regenerates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" /> Weekly review
          </p>
          {review && (
            <Button size="xs" variant="ghost" onClick={generate} disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />} Refresh
            </Button>
          )}
        </div>
        {!review ? (
          loading || review === undefined ? (
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Comparing this week with last week…
              </p>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : (
            <Button className="w-full" onClick={generate}>
              <Sparkles /> Write my weekly review
            </Button>
          )
        ) : (
          <div className={cn("space-y-3", loading && "opacity-50")}>
            <div>
              <p className="text-lg leading-snug font-semibold">{review.headline}</p>
              <p className="mt-1 text-sm text-muted-foreground">{review.summary}</p>
            </div>
            {review.wins.length > 0 && (
              <ul className="space-y-1.5 text-sm">
                {review.wins.map((w, i) => (
                  <li key={i} className="flex gap-2">
                    <ThumbsUp className="mt-0.5 size-4 shrink-0 text-primary" />
                    {w}
                  </li>
                ))}
              </ul>
            )}
            <div className="grid gap-2">
              <Box icon={ThumbsUp} label="Keep" text={review.keep} />
              <Box icon={Wrench} label="Change next week" text={review.change} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Box({ icon: Icon, label, text }: { icon: React.ComponentType<{ className?: string }>; label: string; text: string }) {
  return (
    <div className="rounded-lg bg-secondary/60 p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </p>
      <p className="mt-1 text-sm">{text}</p>
    </div>
  );
}

const fmtSleep = (m: number | null) => (m == null ? "–" : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`);

function CompareCard({ thisWeek: a, lastWeek: b }: { thisWeek: WeekStats; lastWeek: WeekStats }) {
  const rows: { label: string; a: number | null; b: number | null; fmt: (v: number) => string; good: "up" | "down" | null }[] = [
    { label: "Sleep / night", a: a.sleepAvgMin, b: b.sleepAvgMin, fmt: fmtSleep, good: "up" },
    { label: "Sleep score", a: a.sleepScoreAvg, b: b.sleepScoreAvg, fmt: String, good: "up" },
    { label: "HRV", a: a.hrvAvg, b: b.hrvAvg, fmt: (v) => `${v} ms`, good: "up" },
    { label: "Resting HR", a: a.rhrAvg, b: b.rhrAvg, fmt: (v) => `${v} bpm`, good: "down" },
    { label: "Steps / day", a: a.stepsAvg, b: b.stepsAvg, fmt: (v) => v.toLocaleString(), good: "up" },
    { label: "Gym sessions", a: a.gymSessions, b: b.gymSessions, fmt: String, good: null },
    { label: "Running", a: a.runKm, b: b.runKm, fmt: (v) => `${v} km`, good: null },
    { label: "Eaten / day", a: a.eatenAvg, b: b.eatenAvg, fmt: (v) => `${v.toLocaleString()} kcal`, good: null },
    { label: "Protein / day", a: a.proteinAvg, b: b.proteinAvg, fmt: (v) => `${v} g`, good: "up" },
    { label: "Energy balance", a: a.balanceAvg, b: b.balanceAvg, fmt: (v) => `${v > 0 ? "+" : ""}${v.toLocaleString()} kcal`, good: null },
  ];
  return (
    <Card size="sm">
      <CardContent className="space-y-2">
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 text-xs text-muted-foreground">
          <span>Last 7 days vs the 7 before</span>
          <span className="w-20 text-right">This week</span>
          <span className="w-16 text-right">Before</span>
        </div>
        <div className="divide-y">
          {rows.map((r) => {
            const delta = r.a != null && r.b != null ? r.a - r.b : null;
            const better = delta == null || delta === 0 || r.good == null ? null : (delta > 0) === (r.good === "up");
            const Icon = delta == null || delta === 0 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
            return (
              <div key={r.label} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 py-1.5 text-sm">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="flex w-20 items-center justify-end gap-1 font-medium tabular-nums">
                  {r.a == null ? "–" : r.fmt(r.a)}
                  <Icon
                    className={cn("size-3.5", better === true && "text-[var(--status-good)]", better === false && "text-[var(--status-critical)]", better === null && "text-muted-foreground")}
                    aria-label={better === true ? "better" : better === false ? "worse" : "changed"}
                  />
                </span>
                <span className="w-16 text-right text-muted-foreground tabular-nums">{r.b == null ? "–" : r.fmt(r.b)}</span>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Food averages use fully logged days only ({a.foodDays} this week, {b.foodDays} the week before).
        </p>
      </CardContent>
    </Card>
  );
}

function PatternsCard({ patterns }: { patterns: Pattern[] }) {
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-1.5 px-1 text-sm font-semibold">
        <Lightbulb className="size-4 text-primary" /> Your patterns
      </h2>
      {patterns.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">
          Not enough data for patterns yet. They appear once there are at least 3 days on each side of a comparison.
        </p>
      ) : (
        patterns.map((p) => {
          const max = Math.max(p.groupA.value, p.groupB.value) || 1;
          return (
            <Card key={p.id} size="sm">
              <CardContent className="space-y-2.5">
                <div>
                  <p className="text-xs text-muted-foreground">{p.title}</p>
                  <p className="text-sm font-medium">{p.insight}</p>
                </div>
                {[p.groupA, p.groupB].map((g, i) => (
                  <div key={g.label} className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-2 text-xs">
                    <span className="truncate text-muted-foreground">{g.label}</span>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary">
                      <div className={cn("h-full rounded-full", i === 0 ? "bg-series" : "bg-muted-foreground/40")} style={{ width: `${(g.value / max) * 100}%` }} />
                    </div>
                    <span className="tabular-nums">
                      {g.value} {p.unit} <span className="text-muted-foreground">· {g.n}d</span>
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })
      )}
      <p className="px-1 text-[11px] text-muted-foreground">Based on your last 5 weeks. Small samples (a few days) are hints, not proof.</p>
    </section>
  );
}
