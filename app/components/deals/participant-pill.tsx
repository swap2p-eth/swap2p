"use client";

import * as React from "react";
import Jazzicon from "react-jazzicon";
import {Copy} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatAddressShort, seedFromAddress } from "@/lib/utils";

interface ParticipantPillProps {
  label: string;
  address: string;
  className?: string;
}

async function copyAddress(value: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // ignore and fallback below
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand("copy");
    document.body.removeChild(textarea);
    return success;
  } catch {
    return false;
  }
}

export function ParticipantPill({ label, address, className }: ParticipantPillProps) {
  const seed = seedFromAddress(address);

  const handleCopy = React.useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      if (!address) return;
      await copyAddress(address);
    },
    [address]
  );

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
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="group inline-flex items-center gap-2 text-sm font-medium text-foreground transition hover:border-border/60 hover:bg-muted/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
          title="Copy address"
        >
          <Jazzicon diameter={20} seed={seed} />
          <span className="font-normal tracking-tight">{formatAddressShort(address)}</span>
          <Copy className="h-3.5 w-3.5 text-muted-foreground/70 transition group-hover:text-foreground" />
        </button>
      </div>
    </>
  );
}
