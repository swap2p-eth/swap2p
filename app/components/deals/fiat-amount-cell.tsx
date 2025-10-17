"use client";

import { FiatFlag } from "@/components/fiat-flag";

interface FiatAmountCellProps {
  fiat: string;
  amountLabel: string;
}

export function FiatAmountCell({ fiat, amountLabel }: FiatAmountCellProps) {
  return (
    <span className="flex items-center gap-2 text-sm font-medium text-foreground">
      <FiatFlag fiat={fiat} size={18} />
      <span className="flex items-center gap-2">
        {amountLabel}
        <span className="text-xs uppercase text-muted-foreground/80">{fiat}</span>
      </span>
    </span>
  );
}
