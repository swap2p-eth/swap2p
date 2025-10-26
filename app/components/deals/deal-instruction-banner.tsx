"use client";

import { cn } from "@/lib/utils";
import type { DealProgressState } from "@/lib/deal-scenarios";
import { DealInstructionIcon } from "@/components/deals/deal-instruction-icon";

interface DealInstructionBannerProps {
  instructions: string;
  highlight?: boolean;
  className?: string;
  state?: DealProgressState;
}

export function DealInstructionBanner({
  instructions,
  highlight = false,
  className,
  state
}: DealInstructionBannerProps) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-xl items-center gap-4 rounded-2xl p-4 text-sm",
        highlight ? "bg-orange-400/10 text-orange-600" : "bg-muted/40 text-muted-foreground",
        className
      )}
    >
      <div className="flex h-12 w-12 flex-none items-center justify-center">
        <DealInstructionIcon highlight={highlight} size="lg" state={state} />
      </div>
      <p className="font-medium leading-relaxed">{instructions}</p>
    </div>
  );
}
