"use client";

import { FiatFlag } from "@/components/fiat-flag";

interface FiatAmountCellProps {
  countryCode: string;
  label: string;
  amountLabel: string;
}

export function FiatAmountCell({ countryCode, label, amountLabel }: FiatAmountCellProps) {
  return (
    <span className="flex items-center gap-2 text-sm font-medium text-foreground">
      <FiatFlag fiat={countryCode} size={18} />
      <span className="flex items-center gap-2">
        {amountLabel}
        <span className="text-xs uppercase text-muted-foreground/80">{label}</span>
      </span>
    </span>
  );
}
