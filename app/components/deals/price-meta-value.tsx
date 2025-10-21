"use client";

import { cn } from "@/lib/utils";

interface PriceMetaValueProps {
  priceLabel: string;
  tokenSymbol: string;
  fiatSymbol: string;
  className?: string;
}

export function PriceMetaValue({ priceLabel, tokenSymbol, fiatSymbol, className }: PriceMetaValueProps) {
  return (
    <span className={cn("flex items-center gap-2 text-sm font-medium text-foreground", className)}>
      <span>{priceLabel}</span>
      <span className="text-xs uppercase text-muted-foreground/80">{fiatSymbol}</span>
      <span className="text-xs uppercase text-muted-foreground/80">/ {tokenSymbol}</span>
    </span>
  );
}
