"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type ApprovalMode = "amount" | "max";

interface TokenApprovalButtonProps {
  className?: string;
  disabled?: boolean;
  busy?: boolean;
  approvalModeStorageKey?: string;
  onApprove?: (mode: ApprovalMode) => void;
}

const DEFAULT_STORAGE_KEY = "swap2p:approval-mode";

export function TokenApprovalButton({
  className,
  disabled,
  busy,
  approvalModeStorageKey = DEFAULT_STORAGE_KEY,
  onApprove
}: TokenApprovalButtonProps) {
  const [mode, setMode] = React.useState<ApprovalMode>(() => {
    if (typeof window === "undefined") {
      return "max";
    }
    const stored = window.localStorage.getItem(approvalModeStorageKey);
    return stored === "amount" || stored === "max" ? stored : "max";
  });

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(approvalModeStorageKey);
    if (stored === "amount" || stored === "max") {
      setMode(stored);
    }
  }, [approvalModeStorageKey]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(approvalModeStorageKey, mode);
  }, [mode, approvalModeStorageKey]);

  const handleApproveClick = () => {
    onApprove?.(mode);
  };

  const handleModeChange = (value: string) => {
    if (value === "amount" || value === "max") {
      setMode(value);
    }
  };

  const label = mode === "max" ? "Approve MAX" : "Approve amount";
  const isDisabled = disabled || busy;

  return (
    <div
      className={cn(
        "relative inline-flex h-10 items-center overflow-hidden rounded-full bg-muted/20 text-sm shadow-sm",
        className
      )}
    >
      <Button
        type="button"
        onClick={handleApproveClick}
        disabled={isDisabled}
        className={cn(
          "h-full rounded-none rounded-l-full bg-primary px-4 text-xs font-semibold uppercase tracking-[0.2em] text-primary-foreground transition-colors",
          "hover:bg-primary/90 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:opacity-60"
        )}
      >
        {label}
      </Button>
      <Select value={mode} onValueChange={handleModeChange} disabled={isDisabled}>
        <SelectTrigger
          className={cn(
            "relative h-full justify-center rounded-none rounded-r-full border-0 bg-primary px-3 text-primary-foreground transition-colors",
            "after:absolute after:inset-y-2 after:-left-px after:w-px after:rounded-full after:bg-white/50 after:content-[''] after:dark:bg-muted-foreground/50",
            "hover:bg-primary/90 focus:outline-none focus:ring-0 focus:ring-offset-0 disabled:opacity-60"
          )}
          aria-label="Select approval amount"
        >
        </SelectTrigger>
        <SelectContent align="end" className="min-w-[12rem]">
          <SelectItem value="max">Approve MAX</SelectItem>
          <SelectItem value="amount">Approve amount</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
