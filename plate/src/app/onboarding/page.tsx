import { redirect } from "next/navigation";
import { getUserAndProfile } from "@/lib/profile";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const { profile } = await getUserAndProfile();
  if (profile.onboarded_at) redirect("/today");
  return <OnboardingForm profile={profile} />;
}
