"use client";

import { formatPrice } from "@/lib/number-format";

interface PriceCellProps {
  price: number;
  fiat: string;
  fractionDigits?: { min?: number; max?: number };
}

export function PriceCell({ price, fiat, fractionDigits }: PriceCellProps) {
  const min = fractionDigits?.min;
  const max = fractionDigits?.max;
  const formatOptions: Intl.NumberFormatOptions = {
    ...(min !== undefined ? { minimumFractionDigits: min } : {}),
    ...(max !== undefined ? { maximumFractionDigits: max } : {})
  };
  return (
    <span className="flex items-center justify-end gap-2 text-sm font-medium text-foreground tabular-nums">
      {formatPrice(price, formatOptions)}
      <span className="text-xs uppercase text-muted-foreground/80">{fiat}</span>
    </span>
  );
}
