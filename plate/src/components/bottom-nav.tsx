"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell, Footprints, Moon, Sparkles, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/coach", label: "Coach", icon: Sparkles },
  { href: "/food", label: "Food", icon: UtensilsCrossed },
  { href: "/train", label: "Train", icon: Dumbbell },
  { href: "/move", label: "Move", icon: Footprints },
  { href: "/sleep", label: "Sleep", icon: Moon },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-md">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2.5 text-[11px] transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("size-5", active && "stroke-[2.25]")} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
