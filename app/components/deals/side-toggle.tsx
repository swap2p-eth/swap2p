"use client";

import { cn } from "@/lib/utils";
import { SegmentedControl } from "@/components/ui/segmented-control";

type DealSide = "BUY" | "SELL";

interface SideToggleProps {
  value: DealSide;
  onChange: (side: DealSide) => void;
  disabled?: boolean;
  className?: string;
}

const SIDE_OPTIONS = [
  {
    label: "BUY",
    value: "BUY",
    activeClassName: "bg-sky-500 text-white shadow-[0_8px_20px_-12px_rgba(14,165,233,0.8)]",
    inactiveClassName: "text-sky-600 hover:bg-sky-500/10"
  },
  {
    label: "SELL",
    value: "SELL",
    activeClassName: "bg-orange-500 text-white shadow-[0_8px_20px_-12px_rgba(249,115,22,0.8)]",
    inactiveClassName: "text-orange-600 hover:bg-orange-500/10"
  }
];

export function SideToggle({ value, onChange, disabled = false, className }: SideToggleProps) {
  return (
    <SegmentedControl
      value={value}
      onChange={next => {
        if (!disabled) {
          onChange(next as DealSide);
        }
      }}
      options={SIDE_OPTIONS}
      className={cn(className, disabled ? "pointer-events-none opacity-60" : "")}
    />
  );
}
