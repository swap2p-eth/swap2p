"use client";

import * as React from "react";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { DealState } from "@/lib/types/market";
import { cn } from "@/lib/utils";

type DealStatusBadgeSize = "lg" | "sm";

const STATUS_VARIANTS: Record<string, BadgeProps["variant"]> = {
  requested: "warning",
  accepted: "info",
  paid: "purple",
  released: "success",
  canceled: "muted"
};

const SIZE_CLASSES: Record<DealStatusBadgeSize, string> = {
  lg: "px-4 py-1.5 text-sm",
  sm: "px-2.5 py-1 text-[0.65rem]"
};

interface DealStatusBadgeProps
  extends Omit<React.ComponentProps<typeof Badge>, "variant" | "children"> {
  status?: DealState | string | null;
  size?: DealStatusBadgeSize;
}

export function DealStatusBadge({
  status,
  size = "lg",
  className,
  ...props
}: DealStatusBadgeProps) {
  if (!status) return null;

  const stringStatus = status.toString();
  const normalized = stringStatus.toLowerCase();
  const variant = STATUS_VARIANTS[normalized] ?? "outline";
  const label = stringStatus.toUpperCase();

  return (
    <Badge
      variant={variant}
      className={cn(
        "rounded-full font-semibold uppercase tracking-[0.2em]",
        SIZE_CLASSES[size],
        className
      )}
      {...props}
    >
      {label}
    </Badge>
  );
}
