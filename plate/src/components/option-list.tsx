"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Large tappable choices (radio-style) for onboarding and settings. */
export function OptionList<T extends string>({
  value,
  onChange,
  options,
  compact = false,
}: {
  value: T | null;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string; hint?: string }[];
  compact?: boolean;
}) {
  return (
    <div role="radiogroup" className={cn("grid gap-2", compact && "grid-cols-2")}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex items-center justify-between gap-3 rounded-xl border px-4 text-left transition-colors",
              compact ? "py-2.5" : "py-3.5",
              selected ? "border-primary bg-primary/10" : "hover:bg-secondary",
            )}
          >
            <span>
              <span className="block font-medium">{o.label}</span>
              {o.hint && <span className="block text-sm text-muted-foreground">{o.hint}</span>}
            </span>
            {selected && <Check className="size-4 shrink-0 text-primary" />}
          </button>
        );
      })}
    </div>
  );
}
