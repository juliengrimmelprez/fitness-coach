import { Card, CardContent } from "@/components/ui/card";
import type { Nutrients, Targets } from "@/lib/types";
import { cn } from "@/lib/utils";

export function MacroHeader({ targets, totals }: { targets: Targets; totals: Nutrients }) {
  const remaining = Math.round(targets.calories - totals.calories);
  return (
    <Card>
      <CardContent className="flex items-center gap-5">
        <CalorieRing value={totals.calories} target={targets.calories} />
        <div className="flex-1 space-y-2.5">
          <p className="text-sm">
            {remaining >= 0 ? (
              <>
                <span className="font-semibold tabular-nums">{remaining.toLocaleString()}</span>{" "}
                <span className="text-muted-foreground">kcal left</span>
              </>
            ) : (
              <>
                <span className="font-semibold text-destructive tabular-nums">{Math.abs(remaining).toLocaleString()}</span>{" "}
                <span className="text-muted-foreground">kcal over</span>
              </>
            )}
          </p>
          <MacroBar label="Protein" value={totals.protein_g} target={targets.protein_g} color="bg-protein" />
          <MacroBar label="Carbs" value={totals.carbs_g} target={targets.carbs_g} color="bg-carbs" />
          <MacroBar label="Fat" value={totals.fat_g} target={targets.fat_g} color="bg-fat" />
        </div>
      </CardContent>
    </Card>
  );
}

function CalorieRing({ value, target }: { value: number; target: number }) {
  const r = 42;
  const circumference = 2 * Math.PI * r;
  const pct = target > 0 ? Math.min(value / target, 1) : 0;
  const over = value > target;
  return (
    <div className="relative size-28 shrink-0">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="9" className="stroke-secondary" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          className={cn("transition-[stroke-dashoffset] duration-500", over ? "stroke-destructive" : "stroke-primary")}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-semibold tabular-nums">{Math.round(value).toLocaleString()}</span>
        <span className="text-[11px] text-muted-foreground tabular-nums">/ {target.toLocaleString()} kcal</span>
      </div>
    </div>
  );
}

function MacroBar({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">
          {Math.round(value)} <span className="text-muted-foreground">/ {target} g</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className={cn("h-full rounded-full transition-[width] duration-500", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
