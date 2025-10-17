"use client";

interface PriceCellProps {
  price: number;
  fiat: string;
  fractionDigits?: { min?: number; max?: number };
}

export function PriceCell({ price, fiat, fractionDigits }: PriceCellProps) {
  const min = fractionDigits?.min ?? 2;
  const max = fractionDigits?.max ?? 3;
  return (
    <span className="flex items-center justify-end gap-2 text-sm font-medium text-foreground tabular-nums">
      {price.toLocaleString("en-US", {
        minimumFractionDigits: min,
        maximumFractionDigits: max
      })}
      <span className="text-xs uppercase text-muted-foreground/80">{fiat}</span>
    </span>
  );
}
