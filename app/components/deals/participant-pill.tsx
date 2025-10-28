"use client";

import * as React from "react";
import Jazzicon from "react-jazzicon";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { copyToClipboard, formatAddressShort, seedFromAddress } from "@/lib/utils";

interface ParticipantPillProps {
  label: string;
  address: string;
  className?: string;
}

export function ParticipantPill({ label, address, className }: ParticipantPillProps) {
  const seed = seedFromAddress(address);
  const [copied, setCopied] = React.useState(false);

  const handleCopy = React.useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      if (!address) return;
      const success = await copyToClipboard(address);
      if (success) {
        setCopied(true);
      }
    },
    [address]
  );

  React.useEffect(() => {
    if (!copied) return;
    if (typeof window === "undefined") return;
    const timeout = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timeout);
  }, [copied]);

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
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-500 transition group-hover:text-emerald-500" />
          ) : (
            <Copy className="h-3.5 w-3.5 text-muted-foreground/70 transition group-hover:text-foreground" />
          )}
        </button>
      </div>
    </>
  );
}
