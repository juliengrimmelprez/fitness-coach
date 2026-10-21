"use client";

import { useState } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";
import { fullDate } from "@/components/charts";
import { AskView } from "@/components/coach/ask-view";
import { PlanView } from "@/components/coach/plan-view";
import { TodayView } from "@/components/coach/today-view";
import { useCoachData, type CoachData } from "@/components/coach/use-coach-data";
import { WeekView } from "@/components/coach/week-view";
import { WeightView } from "@/components/coach/weight-view";
import { PageHeader } from "@/components/page-header";
import { useProfile } from "@/components/profile-context";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocalToday } from "@/hooks/use-local-today";
import { cn } from "@/lib/utils";

const TABS = [
  { value: "today", label: "Today" },
  { value: "week", label: "Week" },
  { value: "plan", label: "Plan" },
  { value: "weight", label: "Weight" },
  { value: "ask", label: "Ask" },
] as const;
type Tab = (typeof TABS)[number]["value"];

export default function CoachPage() {
  const today = useLocalToday();
  return today ? <Coach today={today} /> : null;
}

function Coach({ today }: { today: string }) {
  const { profile } = useProfile();
  const [tab, setTab] = useState<Tab>("today");
  const { raw, derived, reload, yesterday } = useCoachData(today, profile);
  const data: CoachData | null = raw && derived ? { ...derived, raw } : null;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${greeting}${profile.display_name ? `, ${profile.display_name}` : ""}`}
        subtitle={fullDate(today)}
        action={
          <Link href="/settings" className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="Settings">
            <Settings />
          </Link>
        }
      />

      <div role="tablist" aria-label="Coach sections" className="grid grid-cols-5 gap-1 rounded-xl bg-secondary p-1">
        {TABS.map((t) => (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={tab === t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              "rounded-lg py-1.5 text-xs font-medium transition-colors",
              tab === t.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!data ? (
        <div className="space-y-4">
          <Skeleton className="h-36 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      ) : tab === "today" ? (
        <TodayView today={today} data={data} profile={profile} />
      ) : tab === "week" ? (
        <WeekView data={data} profile={profile} yesterday={yesterday} />
      ) : tab === "plan" ? (
        <PlanView today={today} data={data} profile={profile} />
      ) : tab === "weight" ? (
        <WeightView today={today} data={data} profile={profile} onSaved={reload} />
      ) : (
        <AskView data={data} profile={profile} />
      )}
    </div>
  );
}
