"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn, copyToClipboard } from "@/lib/utils";

interface ProfileCopyFieldProps {
  label: string;
  value: string;
  align?: "center" | "start";
  className?: string;
  pillClassName?: string;
  valueClassName?: string;
}

export function ProfileCopyField({
  label,
  value,
  align = "center",
  className,
  pillClassName,
  valueClassName
}: ProfileCopyFieldProps) {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    if (typeof window === "undefined") return;
    const timeout = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const handleCopy = React.useCallback(async () => {
    if (!value) return;
    const success = await copyToClipboard(value);
    if (success) {
      setCopied(true);
    }
  }, [value]);

  const alignmentClass =
    align === "start"
      ? "items-start text-left"
      : "items-center text-center";

  return (
    <div className={cn("flex flex-col gap-2", alignmentClass, className)}>
      <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground/80">{label}</span>
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/50 px-4 py-2",
          pillClassName
        )}
      >
        <span className={cn("font-mono text-sm leading-tight sm:text-base break-all", valueClassName)}>
          {value}
        </span>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={handleCopy}
          className="ml-auto h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
          aria-label={`Copy ${label.toLowerCase()}`}
          disabled={!value}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
