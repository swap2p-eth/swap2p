"use client";

import "flag-icons/css/flag-icons.min.css";
import countries from "flag-icons/country.json";

import { cn } from "@/lib/utils";

type FlagCountry = { code: string };

const FLAG_ICON_CODES = new Set<string>(
  (countries as FlagCountry[]).map(country => country.code.toLowerCase())
);

const CURRENCY_FLAG_OVERRIDES: Record<string, string> = {
  ANG: "cw",
  EUR: "eu",
  XAF: "cm",
  XCD: "ag",
  XCG: "sx",
  XDR: "un",
  XOF: "sn",
  XPF: "pf",
  XSU: "ve"
};

["eu", "un", "xx"].forEach(code => FLAG_ICON_CODES.add(code));

function toFlagIconCode(input?: string): string | undefined {
  const normalized = input?.trim().toUpperCase();
  if (!normalized) {
    return undefined;
  }

  if (normalized.length === 2) {
    const candidate = normalized.toLowerCase();
    return FLAG_ICON_CODES.has(candidate) ? candidate : undefined;
  }

  if (normalized.length === 3) {
    const override = CURRENCY_FLAG_OVERRIDES[normalized];
    if (override) {
      return override;
    }

    const guess = normalized.slice(0, 2).toLowerCase();
    if (FLAG_ICON_CODES.has(guess)) {
      return guess;
    }
  }

  return undefined;
}

interface FiatFlagProps {
  fiat: string;
  size?: number;
  className?: string;
}

export function FiatFlag({ fiat, size = 20, className }: FiatFlagProps) {
  const flagCode = toFlagIconCode(fiat);

  const style = { width: size, height: size };

  if (!flagCode) {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-muted text-[0.65rem] uppercase text-muted-foreground",
          className
        )}
        style={style}
      >
        {fiat?.slice(0, 1) ?? "?"}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/50",
        className
      )}
      style={style}
    >
      <span
        className={cn("fi fis h-full w-full", `fi-${flagCode}`)}
        role="img"
        aria-label={`${fiat} flag`}
        style={{ width: "100%", height: "100%", backgroundSize: "cover", backgroundPosition: "center" }}
      />
    </span>
  );
}
