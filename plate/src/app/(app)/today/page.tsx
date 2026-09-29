"use client";

import { DayView } from "@/components/day-view";
import { useProfile } from "@/components/profile-context";
import { useLocalToday } from "@/hooks/use-local-today";

export default function TodayPage() {
  const { profile } = useProfile();
  const today = useLocalToday();

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-4">
      <header>
        <p className="text-sm text-muted-foreground" suppressHydrationWarning>
          {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight" suppressHydrationWarning>
          {greeting}
          {profile.display_name ? `, ${profile.display_name}` : ""}
        </h1>
      </header>
      {today && <DayView key={today} date={today} showCoach />}
    </div>
  );
}
