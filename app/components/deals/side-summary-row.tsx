"use client";

import { DealSideBadge } from "@/components/deals/deal-side-badge";

interface SideSummaryRowProps {
  side: string;
  description: string;
}

export function SideSummaryRow({ side, description }: SideSummaryRowProps) {
  return (
    <span className="flex items-center gap-2 text-sm text-foreground">
      <DealSideBadge side={side} />
      <span className="text-muted-foreground/80">{description}</span>
    </span>
  );
}
