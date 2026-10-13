"use client";

import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { fullDate } from "@/components/charts";
import { DayView } from "@/components/day-view";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { useLocalToday } from "@/hooks/use-local-today";

export default function FoodPage() {
  const today = useLocalToday();
  return (
    <div className="space-y-4">
      <PageHeader
        title="Food"
        subtitle={today ? fullDate(today) : undefined}
        action={
          <Link href="/food/history" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <CalendarDays /> History
          </Link>
        }
      />
      {today && <DayView key={today} date={today} showCoach />}
    </div>
  );
}
