"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface RelativeTimeProps {
  value: string | number | Date;
  className?: string;
}

function toDate(value: RelativeTimeProps["value"]): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    const ms = value < 1_000_000_000_000 ? value * 1_000 : value;
    const date = new Date(ms);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return date;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function formatRelative(source: Date, now: Date): string {
  const diffMs = now.getTime() - source.getTime();
  const future = diffMs < 0;
  const absMs = Math.abs(diffMs);

  if (absMs < 30_000) {
    return "now";
  }

  const segments: string[] = [];
  const seconds = Math.floor(absMs / 1_000);
  const minutes = Math.floor(absMs / 60_000);
  const hours = Math.floor(absMs / 3_600_000);
  const days = Math.floor(absMs / 86_400_000);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  const push = (value: number, suffix: string) => {
    if (value > 0) {
      segments.push(`${value}${suffix}`);
    }
  };

  if (minutes < 1) {
    return `${future ? "in " : ""}${seconds}s`;
  }

  if (minutes < 60) {
    return `${future ? "in " : ""}${minutes}m`;
  }

  if (hours < 24) {
    push(hours, "h");
    const remMinutes = minutes % 60;
    push(remMinutes, "m");
    const body = segments.join(" ");
    return future ? `in ${body}` : body;
  }

  if (days < 7) {
    push(days, "d");
    const remHours = hours % 24;
    push(remHours, "h");
    const body = segments.join(" ");
    return future ? `in ${body}` : body;
  }

  if (weeks < 5) {
    push(weeks, "w");
    const remDays = days % 7;
    push(remDays, "d");
    const body = segments.join(" ");
    return future ? `in ${body}` : body;
  }

  if (months < 12) {
    push(months, "mo");
    const remDays = days % 30;
    push(remDays, "d");
    const body = segments.join(" ");
    return future ? `in ${body}` : body;
  }

  push(years, "y");
  const remMonths = months % 12;
  push(remMonths, "mo");
  const body = segments.join(" ");
  return future ? `in ${body}` : body;
}

export function RelativeTime({ value, className }: RelativeTimeProps) {
  const date = React.useMemo(() => toDate(value), [value]);
  const [, setTick] = React.useState(0);
  const [tooltip, setTooltip] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const id = window.setInterval(() => {
      setTick(prev => prev + 1);
    }, 30_000);
    return () => {
      window.clearInterval(id);
    };
  }, []);

  React.useEffect(() => {
    if (!date) {
      setTooltip(undefined);
      return;
    }
    const formatter = new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "medium"
    });
    setTooltip(formatter.format(date));
  }, [date]);

  if (!date) {
    return <span className={cn("text-muted-foreground", className)}>—</span>;
  }

  const now = new Date();
  const label = formatRelative(date, now);
  const iso = date.toISOString();

  return (
    <span className={className} title={tooltip ?? iso}>
      {label}
    </span>
  );
}
