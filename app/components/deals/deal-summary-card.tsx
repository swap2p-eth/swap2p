"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Pill {
  id: string;
  content: React.ReactNode;
  className?: string;
}

interface MetaItem {
  id: string;
  label: string;
  value: React.ReactNode;
}

interface DealSummaryCardProps {
  title: string;
  description?: string;
  pills?: Pill[];
  metaItems: MetaItem[];
}

export function DealSummaryCard({ title, description, pills = [], metaItems }: DealSummaryCardProps) {
  return (
    <Card className="rounded-3xl bg-gradient-to-br from-background/70 to-background/20">
      <CardHeader className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <CardTitle className="text-xl">{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {pills.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {pills.map(pill => (
              <span
                key={pill.id}
                className={cn(
                  "flex items-center gap-2 rounded-full px-3 py-1",
                  "bg-muted/70 text-muted-foreground",
                  pill.className
                )}
              >
                {pill.content}
              </span>
            ))}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metaItems.map(item => (
          <div
            key={item.id}
            className="rounded-2xl bg-card/60 p-4 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.6)]"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">{item.label}</p>
            <div className="mt-2 text-sm font-medium">{item.value}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
