"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type SegmentedOption = {
  label: React.ReactNode;
  value: string;
  activeClassName?: string;
  inactiveClassName?: string;
};

export interface SegmentedControlProps {
  value: string;
  onChange: (value: string) => void;
  options: SegmentedOption[];
  className?: string;
  emphasis?: "default" | "ghost";
}

export function SegmentedControl({
  value,
  onChange,
  options,
  className,
  emphasis = "default"
}: SegmentedControlProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full p-1 shadow-[0_8px_30px_-20px_rgba(15,23,42,0.45)] backdrop-blur transition",
        emphasis === "ghost" ? "bg-background/70" : "bg-card/80",
        className
      )}
    >
      {options.map(option => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "px-4 py-1.5 text-sm font-medium rounded-full transition-colors",
              active
                ? option.activeClassName ?? "bg-primary text-primary-foreground shadow-[0_8px_20px_-12px_rgba(37,99,235,0.8)]"
                : option.inactiveClassName ?? "text-muted-foreground hover:bg-muted/50"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
