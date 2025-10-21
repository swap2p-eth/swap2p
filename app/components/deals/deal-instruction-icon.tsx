"use client";

import { TriangleAlert, Hourglass } from "lucide-react";
import { cn } from "@/lib/utils";

interface DealInstructionIconProps {
  highlight?: boolean;
  className?: string;
  size?: "sm" | "lg";
}

const sizeClasses: Record<string, string> = {
  sm: "h-4 w-4",
  lg: "h-10 w-10"
};

export function DealInstructionIcon({ highlight = false, className, size = "sm" }: DealInstructionIconProps) {
  const Icon = highlight ? TriangleAlert : Hourglass;
  const colorClass = highlight ? "text-orange-500" : "text-muted-foreground/60";
  return <Icon className={cn(sizeClasses[size], colorClass, className)} aria-hidden="true" />;
}
