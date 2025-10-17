"use client";

import { Badge } from "@/components/ui/badge";

interface DealSideBadgeProps {
  side: string;
}

export function DealSideBadge({ side }: DealSideBadgeProps) {
  const normalized = side.toUpperCase();
  const variant = normalized === "BUY" ? "info" : normalized === "SELL" ? "warning" : "outline";
  return <Badge variant={variant}>{normalized}</Badge>;
}
