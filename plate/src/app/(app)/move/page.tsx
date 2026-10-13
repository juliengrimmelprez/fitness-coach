"use client";

import { useEffect, useState } from "react";
import { Activity, Flame, Footprints, Timer } from "lucide-react";
import { BarChart, dayLetter, fullDate } from "@/components/charts";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocalToday } from "@/hooks/use-local-today";
import { activityLabel, dateRange, daysBefore, fetchGarminRange, formatPace } from "@/lib/garmin";
import type { GarminActivity, GarminDay } from "@/lib/types";

const DAYS = 14;

export default function MovePage() {
  const today = useLocalToday();
  return today ? <Move today={today} /> : null;
}

function Move({ today }: { today: string }) {
  const [data, setData] = useState<{ days: GarminDay[]; activities: GarminActivity[] } | null>(null);
  const start = daysBefore(today, DAYS - 1);

  useEffect(() => {
    let cancelled = false;
    fetchGarminRange(start, today).then((r) => !cancelled && setData(r));
    return () => {
      cancelled = true;
    };
  }, [start, today]);

  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  const byDate = new Map(data.days.map((d) => [d.date, d]));
  const dates = dateRange(start, today);
  const todayDay = byDate.get(today);
  const weekStart = daysBefore(today, 6);
  const week = data.activities.filter((a) => a.local_date >= weekStart);
  const weekRunKm = week.filter((a) => a.type?.includes("running")).reduce((s, a) => s + (a.distance_km ?? 0), 0);
  const weekGym = week.filter((a) => a.type === "strength_training").length;
  const weekIntensity = data.days
    .filter((d) => d.date >= weekStart)
    .reduce((s, d) => s + (d.intensity_min_moderate ?? 0) + 2 * (d.intensity_min_vigorous ?? 0), 0);

  const fullDays = data.days.filter((d) => d.date < today && d.total_kcal);
  const avgBurn = fullDays.length ? Math.round(fullDays.reduce((s, d) => s + Number(d.total_kcal), 0) / fullDays.length) : null;

  const series = (pick: (d: GarminDay) => number | null | undefined, fmt: (v: number) => string) =>
    dates.map((date) => {
      const d = byDate.get(date);
      const v = d ? (pick(d) == null ? null : Number(pick(d))) : null;
      return { key: date, label: dayLetter(date), value: v, display: v == null ? "" : fmt(v) };
    });

  return (
    <div className="space-y-4">
      <PageHeader title="Move" subtitle="Steps, workouts and calories burned" />

      <Card>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Today so far</p>
          <div className="grid grid-cols-3 gap-2">
            <Big icon={Flame} value={todayDay?.total_kcal ? Math.round(Number(todayDay.total_kcal)).toLocaleString() : "–"} label="kcal burned" />
            <Big icon={Footprints} value={todayDay?.steps ? todayDay.steps.toLocaleString() : "–"} label="steps" />
            <Big icon={Activity} value={todayDay?.active_kcal ? Math.round(todayDay.active_kcal).toLocaleString() : "–"} label="active kcal" />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-2">
        <WeekTile value={`${weekRunKm.toFixed(1)} km`} label="run this week" />
        <WeekTile value={String(weekGym)} label={weekGym === 1 ? "gym session" : "gym sessions"} />
        <WeekTile value={`${weekIntensity}`} label="intensity min (goal 150)" />
      </div>

      <Card>
        <CardContent>
          <BarChart
            title="Calories burned"
            data={series((d) => d.total_kcal, (v) => `${Math.round(v).toLocaleString()} kcal`)}
            reference={avgBurn ? { value: avgBurn, label: `avg ${avgBurn.toLocaleString()}` } : undefined}
            fullLabel={(p) => fullDate(p.key) + (p.key === today ? " (so far)" : "")}
          />
          <p className="mt-2 text-xs text-muted-foreground">Garmin&apos;s estimate: resting metabolism plus everything you moved.</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <BarChart
            title="Steps"
            data={series((d) => d.steps, (v) => v.toLocaleString())}
            reference={{ value: 10000, label: "10k" }}
            fullLabel={(p) => fullDate(p.key)}
          />
        </CardContent>
      </Card>

      <section className="space-y-2">
        <h2 className="px-1 text-sm font-semibold">Activities · last {DAYS} days</h2>
        {data.activities.length === 0 ? (
          <p className="px-1 text-sm text-muted-foreground">No workouts recorded on your watch yet.</p>
        ) : (
          <Card size="sm" className="py-0">
            <CardContent className="divide-y px-0">
              {[...data.activities].reverse().map((a) => (
                <div key={a.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
                    {a.type === "strength_training" ? <Timer className="size-4" /> : <Activity className="size-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{activityLabel(a)}</p>
                    <p className="truncate text-xs text-muted-foreground tabular-nums">
                      {[
                        fullDate(a.local_date),
                        a.distance_km ? `${a.distance_km.toFixed(1)} km` : null,
                        a.duration_min ? `${Math.round(a.duration_min)} min` : null,
                        formatPace(a.pace_s_per_km),
                        a.avg_hr ? `${Math.round(a.avg_hr)} bpm` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {a.calories ? <span className="shrink-0 text-sm tabular-nums">{Math.round(a.calories)} kcal</span> : null}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}

function Big({ icon: Icon, value, label }: { icon: React.ComponentType<{ className?: string }>; value: string; label: string }) {
  return (
    <div>
      <Icon className="size-4 text-muted-foreground" />
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function WeekTile({ value, label }: { value: string; label: string }) {
  return (
    <Card size="sm">
      <CardContent>
        <p className="text-lg font-semibold tabular-nums">{value}</p>
        <p className="text-[11px] leading-tight text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
