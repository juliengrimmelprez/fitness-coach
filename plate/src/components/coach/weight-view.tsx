"use client";

import { useState } from "react";
import { Loader2, Scale } from "lucide-react";
import { toast } from "sonner";
import { WeightChart } from "@/components/charts";
import type { CoachData } from "@/components/coach/use-coach-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { KCAL_PER_KG } from "@/lib/insights";
import type { Profile } from "@/lib/types";
import { saveWeight } from "@/lib/weights";

/** What a healthy rate looks like for each goal, in kg per week (negative = losing). */
const GOAL_RANGE: Record<NonNullable<Profile["goal"]>, [number, number, string]> = {
  lose_fat: [-0.8, -0.4, "lose ~0.4–0.8 kg/week"],
  get_lean: [-0.5, -0.2, "lose ~0.2–0.5 kg/week"],
  maintain: [-0.15, 0.15, "stay within ±0.15 kg/week"],
  build_muscle: [0.1, 0.3, "gain ~0.1–0.3 kg/week"],
};

const fmtRate = (r: number | null) => (r == null ? "–" : `${r > 0 ? "+" : ""}${r.toFixed(2)} kg/wk`);

export function WeightView({ today, data, profile, onSaved }: { today: string; data: CoachData; profile: Profile; onSaved: () => void }) {
  const { weight, latestWeight } = data;
  const [value, setValue] = useState(latestWeight ? String(latestWeight.weight_kg) : profile.weight_kg ? String(profile.weight_kg) : "");
  const [saving, setSaving] = useState(false);
  const loggedToday = latestWeight?.date === today;

  async function save() {
    const kg = Number(value.replace(",", "."));
    if (!(kg >= 30 && kg <= 300)) {
      toast.error("Enter your weight in kg.");
      return;
    }
    setSaving(true);
    try {
      await saveWeight(profile.id, today, Math.round(kg * 10) / 10);
      toast.success("Weigh-in saved");
      onSaved();
    } catch {
      toast.error("Couldn't save. Has the database update (003) been run?");
    }
    setSaving(false);
  }

  const range = profile.goal ? GOAL_RANGE[profile.goal] : null;
  const rate = weight.trendRatePerWeek;
  const verdict =
    rate == null || !range
      ? null
      : rate < range[0]
        ? { tone: "warn", text: `Faster than your goal (${range[2]}). Eat a bit more to protect muscle and training.` }
        : rate > range[1]
          ? { tone: "warn", text: `Slower than your goal (${range[2]}).` }
          : { tone: "good", text: `On track for your goal (${range[2]}).` };

  // How far apart the scale and the calorie math are; a persistent gap usually means unlogged food.
  const gapKcal =
    weight.trendRatePerWeek != null && weight.predictedRatePerWeek != null
      ? Math.round(((weight.trendRatePerWeek - weight.predictedRatePerWeek) * KCAL_PER_KG) / 7)
      : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Scale className="size-4 text-primary" /> {loggedToday ? "Today's weigh-in (update)" : "Log today's weight"}
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input type="number" inputMode="decimal" step="0.1" value={value} onChange={(e) => setValue(e.target.value)} className="pr-9 tabular-nums" aria-label="Weight in kg" />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">kg</span>
            </div>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />} Save
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Weigh in the morning, after the bathroom, before eating. 3–4 times a week is plenty.</p>
        </CardContent>
      </Card>

      {weight.points.some((p) => p.trend != null) ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Scale trend" value={fmtRate(weight.trendRatePerWeek)} sub={latestWeight ? `latest ${latestWeight.weight_kg} kg` : ""} />
            <Stat
              label="Predicted from calories"
              value={fmtRate(weight.predictedRatePerWeek)}
              sub={weight.avgBalance != null ? `${weight.avgBalance > 0 ? "+" : ""}${weight.avgBalance} kcal/day` : "log full days of food"}
            />
          </div>

          {verdict && (
            <Card size="sm">
              <CardContent className="text-sm">
                <span className={verdict.tone === "good" ? "font-medium text-[var(--status-good)]" : "font-medium text-[var(--status-warning)]"}>
                  {verdict.tone === "good" ? "✓ " : "! "}
                </span>
                {verdict.text}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent>
              <WeightChart points={weight.points} />
            </CardContent>
          </Card>

          <Card size="sm">
            <CardContent className="space-y-1.5 text-xs text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">How this works:</span> the prediction adds up (calories eaten − calories Garmin says you burned) on fully logged days and divides by
                ~7,700 kcal per kg. The scale trend smooths out daily water swings.
              </p>
              <p>
                Food was fully logged on {weight.balanceDays} of the last {weight.totalDays} days. Days without full logs don&apos;t move the prediction.
              </p>
              {gapKcal != null && Math.abs(gapKcal) >= 150 && (
                <p>
                  The scale and the calorie math differ by about {Math.abs(gapKcal)} kcal/day.{" "}
                  {gapKcal > 0 ? "That usually means some food isn't being logged, or portions are underestimated." : "Garmin may be underestimating your burn, or some logged portions are too large."}
                </p>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <p className="px-1 text-sm text-muted-foreground">Log a few weigh-ins and full days of food to see your trend and prediction.</p>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card size="sm">
      <CardContent>
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold tabular-nums">{value}</p>
        <p className="truncate text-[11px] text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}
