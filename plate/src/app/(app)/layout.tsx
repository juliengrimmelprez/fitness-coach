import { redirect } from "next/navigation";
import { AccountSync } from "@/components/account-sync";
import { BottomNav } from "@/components/bottom-nav";
import { ProfileProvider } from "@/components/profile-context";
import { getUserAndProfile } from "@/lib/profile";

// Photo analysis with Claude can take 20–40 s; give server actions on these pages room.
export const maxDuration = 60;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getUserAndProfile();
  if (!profile.onboarded_at) redirect("/onboarding");

  return (
    <ProfileProvider initial={profile} email={user.email ?? ""}>
      <AccountSync />
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-24">{children}</main>
      <BottomNav />
    </ProfileProvider>
  );
}
