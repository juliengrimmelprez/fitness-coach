import { Activity, BatteryMedium, Footprints, HeartPulse, Moon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { activityLabel, formatPace, formatSleep } from "@/lib/garmin";
import type { GarminActivity, GarminDay } from "@/lib/types";
import { cn } from "@/lib/utils";

const HRV_STATUS: Record<string, { label: string; className: string }> = {
  BALANCED: { label: "Balanced", className: "text-primary" },
  UNBALANCED: { label: "Unbalanced", className: "text-carbs" },
  LOW: { label: "Low", className: "text-destructive" },
  POOR: { label: "Poor", className: "text-destructive" },
};

/** Garmin recovery (last night) + the day's workouts. */
export function TrainingCard({ day, activities, isToday }: { day: GarminDay | null; activities: GarminActivity[]; isToday: boolean }) {
  if (!day && activities.length === 0) {
    return (
      <Card size="sm">
        <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
          <Activity className="size-4 shrink-0" />
          {isToday
            ? "No Garmin data yet today. Open Garmin Connect on your phone to sync your watch."
            : "No Garmin data for this day."}
        </CardContent>
      </Card>
    );
  }

  const hrv = day?.hrv_status ? HRV_STATUS[day.hrv_status] : undefined;
  return (
    <Card size="sm">
      <CardContent className="space-y-3">
        {day && (
          <div className="grid grid-cols-4 gap-2 text-center">
            <Stat icon={Moon} label="Sleep" value={formatSleep(day.sleep_min)} sub={day.sleep_score ? `score ${day.sleep_score}` : undefined} />
            <Stat
              icon={HeartPulse}
              label="HRV"
              value={day.hrv_last_night_ms ? `${Math.round(day.hrv_last_night_ms)} ms` : null}
              sub={hrv?.label}
              subClassName={hrv?.className}
            />
            <Stat icon={HeartPulse} label="Resting HR" value={day.resting_hr ? `${day.resting_hr}` : null} sub="bpm" />
            <Stat icon={BatteryMedium} label="Body Battery" value={day.body_battery_high ? `${day.body_battery_high}` : null} sub="peak" />
          </div>
        )}

        {activities.length > 0 && (
          <ul className="space-y-1.5 border-t pt-2.5">
            {activities.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <Activity className="size-4 shrink-0 text-primary" />
                  <span className="truncate font-medium">{activityLabel(a)}</span>
                  <span className="truncate text-xs text-muted-foreground tabular-nums">
                    {[
                      a.distance_km ? `${a.distance_km.toFixed(1)} km` : null,
                      a.duration_min ? `${Math.round(a.duration_min)} min` : null,
                      formatPace(a.pace_s_per_km),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                {a.calories ? <span className="shrink-0 text-xs tabular-nums">{Math.round(a.calories)} kcal</span> : null}
              </li>
            ))}
          </ul>
        )}

        {day?.steps ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
            <Footprints className="size-3.5" />
            {day.steps.toLocaleString()} steps
            {day.active_kcal ? ` · ${Math.round(day.active_kcal)} active kcal` : ""}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  subClassName,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null;
  sub?: string;
  subClassName?: string;
}) {
  return (
    <div className="min-w-0">
      <Icon className="mx-auto size-4 text-muted-foreground" />
      <p className="mt-1 text-sm font-semibold tabular-nums">{value ?? "–"}</p>
      <p className={cn("truncate text-[11px] text-muted-foreground", subClassName)}>{value ? sub : label}</p>
    </div>
  );
}
