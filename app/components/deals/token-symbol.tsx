"use client";

import { cn } from "@/lib/utils";
import { TokenIcon } from "@/components/token-icon";

interface TokenSymbolProps {
  symbol: string;
  className?: string;
}

export function TokenSymbol({ symbol, className }: TokenSymbolProps) {
  return (
    <span className={cn("flex items-center gap-2 text-sm font-medium text-foreground", className)}>
      <TokenIcon symbol={symbol} size={18} />
      <span className="text-sm font-medium text-foreground">{symbol}</span>
    </span>
  );
}
