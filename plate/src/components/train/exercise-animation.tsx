"use client";

import { useEffect, useState } from "react";
import { Dumbbell } from "lucide-react";
import { exerciseImage, type Exercise } from "@/lib/exercises";
import { cn } from "@/lib/utils";

/** Flips between the start and end photos to show the movement. Static when `animate` is false. */
export function ExerciseAnimation({ exercise, animate = true, className }: { exercise: Exercise; animate?: boolean; className?: string }) {
  const [frame, setFrame] = useState(0);
  const [failed, setFailed] = useState(false);
  const frames = exercise.images;

  useEffect(() => {
    if (!animate || frames.length < 2) return;
    const t = setInterval(() => setFrame((f) => (f + 1) % frames.length), 900);
    return () => clearInterval(t);
  }, [animate, frames.length]);

  if (!frames.length || failed) {
    return (
      <div className={cn("flex items-center justify-center bg-secondary", className)}>
        <Dumbbell className="size-5 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden bg-white", className)}>
      {frames.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={exerciseImage(src)}
          alt={i === 0 ? `${exercise.name}, start position` : `${exercise.name}, end position`}
          loading="lazy"
          onError={() => setFailed(true)}
          className={cn("absolute inset-0 size-full object-contain transition-opacity duration-300", (animate ? frame : 0) === i ? "opacity-100" : "opacity-0")}
        />
      ))}
    </div>
  );
}
