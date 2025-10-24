"use client";

import { cn } from "@/lib/utils";
import { FiatFlag } from "@/components/fiat-flag";
import { getFiatInfoByCountry } from "@/lib/fiat";

interface FiatSymbolProps {
  countryCode: string;
  label?: string;
  className?: string;
}

export function FiatSymbol({ countryCode, label, className }: FiatSymbolProps) {
  const info = getFiatInfoByCountry(countryCode);
  const display = label ?? info?.shortLabel ?? countryCode;
  return (
    <span className={cn("flex items-center gap-2 text-sm font-medium text-foreground", className)}>
      <FiatFlag fiat={countryCode} size={18} />
      <span className="text-sm font-medium text-foreground">{display}</span>
    </span>
  );
}
