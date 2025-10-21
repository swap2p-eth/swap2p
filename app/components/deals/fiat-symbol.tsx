"use client";

import { cn } from "@/lib/utils";
import { FiatFlag } from "@/components/fiat-flag";

interface FiatSymbolProps {
  code: string;
  className?: string;
}

export function FiatSymbol({ code, className }: FiatSymbolProps) {
  return (
    <span className={cn("flex items-center gap-2 text-sm font-medium text-foreground", className)}>
      <FiatFlag fiat={code} size={18} />
      <span className="text-sm font-medium text-foreground">{code}</span>
    </span>
  );
}
