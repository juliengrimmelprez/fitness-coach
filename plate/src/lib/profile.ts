import "server-only";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/** Signed-in user + profile for server components. Redirects to /auth when signed out. */
export async function getUserAndProfile() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  // The DB trigger normally creates the row at sign-up; fall back to an empty profile just in case.
  const profile: Profile = (data as Profile | null) ?? {
    id: user.id,
    display_name: user.email?.split("@")[0] ?? null,
    sex: null,
    age: null,
    height_cm: null,
    weight_kg: null,
    activity_level: null,
    goal: null,
    calorie_goal: null,
    protein_goal: null,
    carbs_goal: null,
    fat_goal: null,
    onboarded_at: null,
  };
  return { user, profile };
}
