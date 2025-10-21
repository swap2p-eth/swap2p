"use client";

import { cn } from "@/lib/utils";
import { Hourglass, TriangleAlert } from "lucide-react";

interface DealInstructionBannerProps {
  instructions: string;
  highlight?: boolean;
  className?: string;
}

export function DealInstructionBanner({
  instructions,
  highlight = false,
  className
}: DealInstructionBannerProps) {
  const Icon = highlight ? TriangleAlert : Hourglass;
  const iconClass = highlight ? "text-orange-500" : "text-muted-foreground/70";

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-xl items-center gap-3 rounded-2xl p-4 text-sm",
        highlight ? "bg-orange-400/10 text-orange-600" : "bg-muted/40 text-muted-foreground",
        className
      )}
    >
      <Icon className={cn("h-16 w-16", iconClass)} aria-hidden="true" />
      <p className="font-medium">{instructions}</p>
    </div>
  );
}
