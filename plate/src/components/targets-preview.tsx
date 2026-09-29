import { Card, CardContent } from "@/components/ui/card";

export function TargetsPreview({
  maintenance,
  calories,
  protein_g,
  carbs_g,
  fat_g,
}: {
  maintenance?: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}) {
  return (
    <Card size="sm" className="bg-secondary/50">
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Daily target</p>
            <p className="text-2xl font-semibold tabular-nums">
              {calories.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">kcal</span>
            </p>
          </div>
          {maintenance !== undefined && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Maintenance</p>
              <p className="text-sm tabular-nums">{maintenance.toLocaleString()} kcal</p>
            </div>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Macro label="Protein" grams={protein_g} className="text-protein" />
          <Macro label="Carbs" grams={carbs_g} className="text-carbs" />
          <Macro label="Fat" grams={fat_g} className="text-fat" />
        </div>
      </CardContent>
    </Card>
  );
}

function Macro({ label, grams, className }: { label: string; grams: number; className: string }) {
  return (
    <div className="rounded-lg bg-background px-2 py-1.5">
      <p className={`text-lg font-semibold tabular-nums ${className}`}>{grams} g</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
