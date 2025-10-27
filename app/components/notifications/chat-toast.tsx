"use client";

import * as React from "react";
import { X } from "lucide-react";

import { RelativeTime } from "@/components/relative-time";
import type { DealState } from "@/lib/types/market";
import { cn } from "@/lib/utils";
import { DealStatusBadge } from "@/components/deals/deal-status-badge";

const STATUS_BACKGROUNDS: Record<DealState, string> = {
  REQUESTED: "bg-orange-500/10",
  ACCEPTED: "bg-sky-500/10",
  PAID: "bg-purple-500/10",
  RELEASED: "bg-emerald-500/10",
  CANCELED: "bg-red-500/10"
};

const DEFAULT_BACKGROUND = "bg-muted/60";

interface ChatToastProps {
  title?: React.ReactNode;
  message: string;
  status?: DealState;
  timestamp: number | string | Date;
  onOpen?: () => void;
  onClose?: () => void;
}

export function ChatToast({ title, message, status, timestamp, onOpen, onClose }: ChatToastProps) {
  const handleOpen = React.useCallback(() => {
    onOpen?.();
  }, [onOpen]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onOpen?.();
      }
    },
    [onOpen]
  );

  const background = status ? STATUS_BACKGROUNDS[status] ?? DEFAULT_BACKGROUND : DEFAULT_BACKGROUND;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
      className={cn(
        "group relative flex w-full items-start gap-3 rounded-2xl px-4 py-3 text-left shadow-2xl backdrop-blur-md transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "bg-background/95 text-foreground",
        background,
        "cursor-pointer"
      )}
    >
      <div className="flex w-full flex-col gap-2 pr-8">
        {title ? <span className="text-base text-foreground">{title}</span> : null}
        {message ? (
          <span className="text-sm text-foreground/90">{message}</span>
        ) : null}
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {status ? <DealStatusBadge status={status} size="sm" /> : null}
          <RelativeTime value={timestamp} className="ml-auto text-xs text-muted-foreground/70" />
        </span>
      </div>
      <button
        type="button"
        className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition hover:bg-black/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
        onClick={event => {
          event.stopPropagation();
          onClose?.();
        }}
        aria-label="Close notification"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
