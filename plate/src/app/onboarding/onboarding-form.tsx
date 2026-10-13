"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { OptionList } from "@/components/option-list";
import { TargetsPreview } from "@/components/targets-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ACTIVITY_LEVELS, GOALS, computeTargets, type BodyStats } from "@/lib/nutrition";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { ActivityLevel, Goal, Profile, Sex } from "@/lib/types";

type Draft = {
  sex: Sex | null;
  age: string;
  height_cm: string;
  weight_kg: string;
  activity_level: ActivityLevel | null;
  goal: Goal | null;
};

const STEPS = ["sex", "age", "height", "weight", "activity", "goal"] as const;

function toStats(d: Draft): BodyStats | null {
  const age = Number(d.age), height_cm = Number(d.height_cm), weight_kg = Number(d.weight_kg);
  if (!d.sex || !d.activity_level || !d.goal) return null;
  if (!(age >= 13 && age <= 100 && height_cm >= 120 && height_cm <= 230 && weight_kg >= 30 && weight_kg <= 300)) return null;
  return { sex: d.sex, age, height_cm, weight_kg, activity_level: d.activity_level, goal: d.goal };
}

export function OnboardingForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [d, setD] = useState<Draft>({
    sex: profile.sex,
    age: profile.age?.toString() ?? "",
    height_cm: profile.height_cm?.toString() ?? "",
    weight_kg: profile.weight_kg?.toString() ?? "",
    activity_level: profile.activity_level,
    goal: profile.goal,
  });

  const update = (patch: Partial<Draft>) => setD((prev) => ({ ...prev, ...patch }));
  const stats = toStats(d);
  // Preview as soon as the body stats are in, using sensible defaults for the steps not done yet.
  const previewStats = toStats({ ...d, activity_level: d.activity_level ?? "moderate", goal: d.goal ?? "maintain" });
  const preview = previewStats ? computeTargets(previewStats) : null;

  const current = STEPS[step];
  const valid = {
    sex: !!d.sex,
    age: Number(d.age) >= 13 && Number(d.age) <= 100,
    height: Number(d.height_cm) >= 120 && Number(d.height_cm) <= 230,
    weight: Number(d.weight_kg) >= 30 && Number(d.weight_kg) <= 300,
    activity: !!d.activity_level,
    goal: !!d.goal,
  }[current];

  async function finish() {
    if (!stats) return;
    setSaving(true);
    const t = computeTargets(stats);
    const { error } = await supabaseBrowser()
      .from("profiles")
      .upsert({
        id: profile.id,
        ...stats,
        calorie_goal: t.calories,
        protein_goal: t.protein_g,
        carbs_goal: t.carbs_g,
        fat_goal: t.fat_g,
        onboarded_at: new Date().toISOString(),
      });
    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }
    router.replace("/coach");
    router.refresh();
  }

  const next = () => (step < STEPS.length - 1 ? setStep(step + 1) : finish());

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setStep(step - 1)} disabled={step === 0} aria-label="Back">
          <ArrowLeft />
        </Button>
        <Progress value={((step + 1) / STEPS.length) * 100} className="flex-1" />
        <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">
          {step + 1}/{STEPS.length}
        </span>
      </div>

      <form
        className="flex flex-1 flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) next();
        }}
      >
        {current === "sex" && (
          <Step title="What's your sex?" hint="Used for the metabolic rate formula.">
            <OptionList
              value={d.sex}
              onChange={(sex) => {
                update({ sex });
                setStep(1);
              }}
              options={[
                { value: "male", label: "Male" },
                { value: "female", label: "Female" },
              ]}
            />
          </Step>
        )}
        {current === "age" && (
          <Step title="How old are you?">
            <NumberField value={d.age} onChange={(age) => update({ age })} unit="years" min={13} max={100} />
          </Step>
        )}
        {current === "height" && (
          <Step title="How tall are you?">
            <NumberField value={d.height_cm} onChange={(height_cm) => update({ height_cm })} unit="cm" min={120} max={230} />
          </Step>
        )}
        {current === "weight" && (
          <Step title="What do you weigh?">
            <NumberField value={d.weight_kg} onChange={(weight_kg) => update({ weight_kg })} unit="kg" min={30} max={300} step="0.1" />
          </Step>
        )}
        {current === "activity" && (
          <Step title="How active are you?">
            <OptionList
              value={d.activity_level}
              onChange={(activity_level) => {
                update({ activity_level });
                setStep(5);
              }}
              options={ACTIVITY_LEVELS}
            />
          </Step>
        )}
        {current === "goal" && (
          <Step title="What's your goal?">
            <OptionList value={d.goal} onChange={(goal) => update({ goal })} options={GOALS} />
          </Step>
        )}

        {preview && step >= 3 && <TargetsPreview {...preview} />}

        <Button type="submit" size="lg" className="mt-auto w-full" disabled={!valid || saving}>
          {saving && <Loader2 className="animate-spin" />}
          {step === STEPS.length - 1 ? "Start tracking" : "Continue"}
        </Button>
      </form>
    </main>
  );
}

function Step({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function NumberField(props: { value: string; onChange: (v: string) => void; unit: string; min: number; max: number; step?: string }) {
  return (
    <div className="flex items-center gap-3">
      <Input
        autoFocus
        type="number"
        inputMode="decimal"
        min={props.min}
        max={props.max}
        step={props.step ?? "1"}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="h-14 text-2xl tabular-nums"
      />
      <span className="text-muted-foreground">{props.unit}</span>
    </div>
  );
}
