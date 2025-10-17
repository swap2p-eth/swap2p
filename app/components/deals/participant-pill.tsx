"use client";

import Jazzicon from "react-jazzicon";
import { cn } from "@/lib/utils";
import { formatAddressShort, seedFromAddress } from "@/lib/utils";

interface ParticipantPillProps {
  label: string;
  address: string;
  className?: string;
}

export function ParticipantPill({ label, address, className }: ParticipantPillProps) {
  const seed = seedFromAddress(address);
  return (
    <>
      <span
        className={cn(
          "text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground/70",
          className
        )}
      >
        {label}
      </span>
      <span className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Jazzicon diameter={20} seed={seed} />
        {formatAddressShort(address)}
      </span>
    </>
  );
}
