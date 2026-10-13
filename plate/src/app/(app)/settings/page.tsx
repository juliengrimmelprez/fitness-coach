"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, Users } from "lucide-react";
import { toast } from "sonner";
import { OptionList } from "@/components/option-list";
import { useProfile } from "@/components/profile-context";
import { TargetsPreview } from "@/components/targets-preview";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clearTokens } from "@/lib/accounts";
import { ACTIVITY_LEVELS, GOALS, computeTargets, type BodyStats } from "@/lib/nutrition";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Profile, Sex } from "@/lib/types";

export default function SettingsPage() {
  const { profile, setProfile, email } = useProfile();
  const router = useRouter();
  const [saving, setSaving] = useState<string | null>(null);

  const [name, setName] = useState(profile.display_name ?? "");
  const [stats, setStats] = useState<BodyStats>({
    sex: profile.sex ?? "male",
    age: profile.age ?? 30,
    height_cm: Number(profile.height_cm ?? 175),
    weight_kg: Number(profile.weight_kg ?? 75),
    activity_level: profile.activity_level ?? "moderate",
    goal: profile.goal ?? "maintain",
  });
  const [goals, setGoals] = useState({
    calorie_goal: String(profile.calorie_goal ?? ""),
    protein_goal: String(profile.protein_goal ?? ""),
    carbs_goal: String(profile.carbs_goal ?? ""),
    fat_goal: String(profile.fat_goal ?? ""),
  });

  const statsValid =
    stats.age >= 13 && stats.age <= 100 && stats.height_cm >= 120 && stats.height_cm <= 230 && stats.weight_kg >= 30 && stats.weight_kg <= 300;
  const preview = statsValid ? computeTargets(stats) : null;

  async function save(section: string, patch: Partial<Profile>) {
    setSaving(section);
    const { data, error } = await supabaseBrowser().from("profiles").update(patch).eq("id", profile.id).select().single();
    setSaving(null);
    if (error) {
      toast.error(error.message);
      return false;
    }
    setProfile(data as Profile);
    toast.success("Saved");
    return true;
  }

  async function saveStats() {
    if (!preview) return;
    const ok = await save("stats", {
      ...stats,
      calorie_goal: preview.calories,
      protein_goal: preview.protein_g,
      carbs_goal: preview.carbs_g,
      fat_goal: preview.fat_g,
    });
    if (ok)
      setGoals({
        calorie_goal: String(preview.calories),
        protein_goal: String(preview.protein_g),
        carbs_goal: String(preview.carbs_g),
        fat_goal: String(preview.fat_g),
      });
  }

  async function saveGoals() {
    const calorie_goal = Math.round(Number(goals.calorie_goal));
    if (!(calorie_goal >= 1200)) {
      toast.error("Calorie goal must be at least 1,200 kcal.");
      return;
    }
    await save("goals", {
      calorie_goal,
      protein_goal: Math.round(Number(goals.protein_goal)) || 0,
      carbs_goal: Math.round(Number(goals.carbs_goal)) || 0,
      fat_goal: Math.round(Number(goals.fat_goal)) || 0,
    });
  }

  async function signOut() {
    setSaving("signout");
    // "local" scope ends only this device's session, so other remembered accounts stay usable.
    await supabaseBrowser().auth.signOut({ scope: "local" });
    clearTokens(profile.id);
    router.replace("/auth");
    router.refresh();
  }

  const num = (v: string) => Number(v) || 0;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>{email}</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Display name" aria-label="Display name" />
          <Button variant="outline" onClick={() => save("name", { display_name: name.trim() || null })} disabled={saving !== null}>
            {saving === "name" && <Loader2 className="animate-spin" />}
            Save
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Body stats</CardTitle>
          <CardDescription>Saving recalculates your targets (Mifflin-St Jeor).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <OptionList<Sex>
            compact
            value={stats.sex}
            onChange={(sex) => setStats({ ...stats, sex })}
            options={[
              { value: "male", label: "Male" },
              { value: "female", label: "Female" },
            ]}
          />
          <div className="grid grid-cols-3 gap-2">
            <NumberInput label="Age" unit="yr" value={stats.age} onChange={(age) => setStats({ ...stats, age })} />
            <NumberInput label="Height" unit="cm" value={stats.height_cm} onChange={(height_cm) => setStats({ ...stats, height_cm })} />
            <NumberInput label="Weight" unit="kg" step="0.1" value={stats.weight_kg} onChange={(weight_kg) => setStats({ ...stats, weight_kg })} />
          </div>
          <div className="space-y-1.5">
            <Label>Activity</Label>
            <OptionList compact value={stats.activity_level} onChange={(activity_level) => setStats({ ...stats, activity_level })} options={ACTIVITY_LEVELS} />
          </div>
          <div className="space-y-1.5">
            <Label>Goal</Label>
            <OptionList compact value={stats.goal} onChange={(goal) => setStats({ ...stats, goal })} options={GOALS} />
          </div>
          {preview && <TargetsPreview {...preview} />}
          <Button className="w-full" onClick={saveStats} disabled={!preview || saving !== null}>
            {saving === "stats" && <Loader2 className="animate-spin" />}
            Save & recalculate targets
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Garmin training</CardTitle>
          <CardDescription>
            When on, each day&apos;s target is a base day plus the workout calories Garmin recorded, so harder days get more food.
            Your activity level and the numbers below are then only used on days without Garmin data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex items-center justify-between gap-3 text-sm">
            Adjust targets to my training
            <input
              type="checkbox"
              className="size-5 accent-[var(--primary)]"
              checked={profile.training_adjusted !== false}
              disabled={saving !== null}
              onChange={(e) => save("training", { training_adjusted: e.target.checked })}
            />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daily targets</CardTitle>
          <CardDescription>Override the calculated numbers if you follow your own plan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <NumberInput label="Calories" unit="kcal" value={num(goals.calorie_goal)} onChange={(v) => setGoals({ ...goals, calorie_goal: String(v) })} />
            <NumberInput label="Protein" unit="g" value={num(goals.protein_goal)} onChange={(v) => setGoals({ ...goals, protein_goal: String(v) })} />
            <NumberInput label="Carbs" unit="g" value={num(goals.carbs_goal)} onChange={(v) => setGoals({ ...goals, carbs_goal: String(v) })} />
            <NumberInput label="Fat" unit="g" value={num(goals.fat_goal)} onChange={(v) => setGoals({ ...goals, fat_goal: String(v) })} />
          </div>
          <p className="text-xs text-muted-foreground tabular-nums">
            Macros add up to {Math.round(num(goals.protein_goal) * 4 + num(goals.carbs_goal) * 4 + num(goals.fat_goal) * 9).toLocaleString()} kcal
          </p>
          <Button variant="outline" className="w-full" onClick={saveGoals} disabled={saving !== null}>
            {saving === "goals" && <Loader2 className="animate-spin" />}
            Save targets
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          <Link href="/auth" className={buttonVariants({ variant: "outline" })}>
            <Users />
            Switch account
          </Link>
          <Button variant="ghost" onClick={signOut} disabled={saving !== null}>
            {saving === "signout" ? <Loader2 className="animate-spin" /> : <LogOut />}
            Sign out on this device
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function NumberInput({ label, unit, value, onChange, step }: { label: string; unit: string; value: number; onChange: (v: number) => void; step?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          inputMode="decimal"
          step={step ?? "1"}
          value={value || ""}
          onChange={(e) => onChange(Number(e.target.value))}
          className="pr-10 tabular-nums"
        />
        <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}
