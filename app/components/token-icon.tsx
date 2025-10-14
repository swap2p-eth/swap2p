"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

const TOKEN_ICON_SRC: Record<string, string> = {
  BTC: "/icons/tokens/btc.svg",
  ETH: "/icons/tokens/eth.svg",
  USDC: "/icons/tokens/usdc.svg",
  USDT: "/icons/tokens/usdt.svg",
  DAI: "/icons/tokens/dai.svg"
};

interface TokenIconProps {
  symbol: string;
  size?: number;
  className?: string;
}

export function TokenIcon({ symbol, size = 20, className }: TokenIconProps) {
  const key = symbol?.toUpperCase();
  const src = key ? TOKEN_ICON_SRC[key] : undefined;

  const style = { width: size, height: size };

  if (!src) {
    return (
      <span
        className={cn(
          "flex items-center justify-center rounded-full bg-muted text-[0.65rem] uppercase text-muted-foreground",
          className
        )}
        style={style}
      >
        {symbol?.slice(0, 1) ?? "?"}
      </span>
    );
  }

  return (
    <span className={cn("relative flex items-center justify-center", className)} style={style}>
      <Image src={src} alt={`${symbol} icon`} width={size} height={size} className="h-full w-full" />
    </span>
  );
}
