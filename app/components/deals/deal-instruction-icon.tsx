"use client";

import { TriangleAlert, Hourglass, BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DealProgressState } from "@/lib/deal-scenarios";

interface DealInstructionIconProps {
  highlight?: boolean;
  className?: string;
  size?: "sm" | "lg";
  state?: DealProgressState;
}

const sizeClasses: Record<string, string> = {
  sm: "h-4 w-4",
  lg: "h-10 w-10"
};

export function DealInstructionIcon({
  highlight = false,
  className,
  size = "sm",
  state
}: DealInstructionIconProps) {
  const isReleased = state === "RELEASED";
  const Icon = isReleased ? BadgeCheck : highlight ? TriangleAlert : Hourglass;
  const colorClass = isReleased
    ? "text-emerald-500"
    : highlight
      ? "text-orange-500"
      : "text-muted-foreground/60";
  return <Icon className={cn(sizeClasses[size], colorClass, className)} aria-hidden="true" />;
}
