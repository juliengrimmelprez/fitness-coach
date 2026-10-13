"use client";

import { useEffect, useState } from "react";
import { BatteryMedium, HeartPulse, Moon } from "lucide-react";
import { BarChart, LineChart, SleepStages, dayLetter, fullDate } from "@/components/charts";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocalToday } from "@/hooks/use-local-today";
import { dateRange, daysBefore, fetchGarminRange, formatSleep } from "@/lib/garmin";
import type { GarminDay } from "@/lib/types";

const DAYS = 14;

export default function SleepPage() {
  const today = useLocalToday();
  return today ? <Sleep today={today} /> : null;
}

function Sleep({ today }: { today: string }) {
  const [days, setDays] = useState<GarminDay[] | null>(null);
  const start = daysBefore(today, DAYS - 1);

  useEffect(() => {
    let cancelled = false;
    fetchGarminRange(start, today).then((r) => !cancelled && setDays(r.days));
    return () => {
      cancelled = true;
    };
  }, [start, today]);

  if (!days) return <Loading />;

  const byDate = new Map(days.map((d) => [d.date, d]));
  const dates = dateRange(start, today);
  const latest = [...days].reverse().find((d) => d.sleep_min);
  const withSleep = days.filter((d) => d.sleep_min);
  const avgSleep = withSleep.length ? Math.round(withSleep.reduce((s, d) => s + (d.sleep_min ?? 0), 0) / withSleep.length) : null;

  const series = (pick: (d: GarminDay) => number | null | undefined, fmt: (v: number) => string) =>
    dates.map((date) => {
      const d = byDate.get(date);
      const v = d ? pick(d) ?? null : null;
      return { key: date, label: dayLetter(date), value: v, display: v == null ? "" : fmt(v) };
    });

  return (
    <div className="space-y-4">
      <PageHeader title="Sleep" subtitle={latest ? `Last night · ${fullDate(latest.date)}` : "From your Garmin watch"} />

      {!latest ? (
        <Card size="sm">
          <CardContent className="text-sm text-muted-foreground">
            No sleep data yet. Wear your watch overnight and open Garmin Connect in the morning to sync.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Slept</p>
                <p className="text-3xl font-semibold tabular-nums">{formatSleep(latest.sleep_min)}</p>
              </div>
              {latest.sleep_score != null && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Sleep score</p>
                  <p className="text-3xl font-semibold tabular-nums">{latest.sleep_score}</p>
                </div>
              )}
            </div>
            <SleepStages
              deep={latest.deep_sleep_min ?? 0}
              rem={latest.rem_sleep_min ?? 0}
              light={latest.light_sleep_min ?? 0}
              awake={latest.awake_min ?? 0}
            />
            <div className="grid grid-cols-3 gap-2 border-t pt-3 text-center">
              <Mini icon={HeartPulse} label="HRV" value={latest.hrv_last_night_ms ? `${Math.round(latest.hrv_last_night_ms)} ms` : "–"} sub={statusLabel(latest.hrv_status)} />
              <Mini icon={HeartPulse} label="Resting HR" value={latest.resting_hr ? `${latest.resting_hr} bpm` : "–"} />
              <Mini icon={BatteryMedium} label="Body Battery" value={latest.body_battery_high ? `${latest.body_battery_high}` : "–"} sub="peak" />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <BarChart
            title="Sleep duration"
            data={series((d) => d.sleep_min, (v) => formatSleep(v) ?? "")}
            reference={{ value: 480, label: "8h" }}
            fullLabel={(p) => fullDate(p.key)}
          />
          {avgSleep && (
            <p className="mt-2 text-xs text-muted-foreground">
              <Moon className="mr-1 inline size-3.5" />
              {DAYS}-day average {formatSleep(avgSleep)} across {withSleep.length} tracked nights
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <LineChart title="Overnight HRV" data={series((d) => d.hrv_last_night_ms, (v) => `${Math.round(v)} ms`)} fullLabel={(p) => fullDate(p.key)} />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <LineChart title="Resting heart rate" data={series((d) => d.resting_hr, (v) => `${v} bpm`)} fullLabel={(p) => fullDate(p.key)} />
          <p className="mt-2 text-xs text-muted-foreground">Lower than usual generally means better recovery; a rise of 5+ bpm can signal fatigue or illness.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function statusLabel(s: string | null) {
  if (!s) return undefined;
  return s.charAt(0) + s.slice(1).toLowerCase();
}

function Mini({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub?: string }) {
  return (
    <div>
      <Icon className="mx-auto size-4 text-muted-foreground" />
      <p className="mt-1 text-sm font-semibold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{sub ?? label}</p>
    </div>
  );
}

function Loading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}
