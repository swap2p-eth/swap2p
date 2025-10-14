"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { addDays } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

export function DateRangePicker({
  value,
  onChange
}: {
  value: DateRange;
  onChange: (value: DateRange) => void;
}) {
  const selected = value;

  const handleSelect = (range: DateRange | undefined) => {
    if (!range) return;
    onChange(range);
  };

  const reset = () => {
    onChange({
      from: addDays(new Date(), -14),
      to: new Date()
    });
  };

  return (
    <div className="flex w-full flex-col gap-4 rounded-3xl bg-card/60 p-5 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.6)] backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">Filter by date</h3>
          <p className="text-xs text-muted-foreground">Restrict deals pulled from Swap2p indexers.</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={reset}
          className="flex items-center gap-2 rounded-full px-3"
        >
          <CalendarIcon className="h-4 w-4" />
          Reset
        </Button>
      </div>
      <DayPicker
        mode="range"
        numberOfMonths={2}
        selected={selected}
        onSelect={handleSelect}
        captionLayout="dropdown-buttons"
        className={cn(
          "flex flex-col gap-4 rounded-2xl bg-background/60 p-4 text-sm shadow-[0_20px_45px_-36px_rgba(15,23,42,0.55)]",
          "[&_.rdp-months]:flex [&_.rdp-months]:flex-col md:[&_.rdp-months]:flex-row"
        )}
        classNames={{
          day: "h-9 w-9 rounded-full border-0 text-sm transition-colors hover:bg-primary/10 focus:outline-none",
          day_selected:
            "h-9 w-9 rounded-full border-0 bg-primary text-primary-foreground hover:bg-primary focus:bg-primary",
          day_today: "rounded-full border border-primary/40",
          caption: "mb-2 text-sm font-medium text-muted-foreground/80",
          nav_button: "h-8 w-8 rounded-full hover:bg-muted/40",
          months: "gap-4",
          table: "w-full border-collapse",
          head_cell: "text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground/60"
        }}
      />
    </div>
  );
}
