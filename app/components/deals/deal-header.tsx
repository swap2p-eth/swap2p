"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface DealHeaderProps {
  backLabel?: string;
  onBack?: () => void;
  title: string;
  subtitle?: string;
  badge?: string;
}

export function DealHeader({
  backLabel = "Back",
  onBack,
  title,
  subtitle,
  badge
}: DealHeaderProps) {
  const normalizedBadge = badge?.toLowerCase() ?? "";
  const badgeVariant =
    normalizedBadge === "requested"
      ? "warning"
      : normalizedBadge === "accepted"
        ? "info"
        : normalizedBadge === "paid"
          ? "purple"
          : normalizedBadge === "released"
            ? "success"
            : normalizedBadge === "canceled"
              ? "muted"
              : "outline";
  const badgeLabel = badge?.toUpperCase();
  return (
    <div className="flex flex-col gap-3">
      <Link
        href="#back"
        onClick={event => {
          event.preventDefault();
          onBack?.();
        }}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </Link>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {badge ? (
          <Badge
            variant={badgeVariant as any}
            className="rounded-full px-4 py-1.5 text-sm font-semibold uppercase tracking-[0.2em]"
          >
            {badgeLabel}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}
