"use client";

import * as React from "react";
import { X } from "lucide-react";

import { RelativeTime } from "@/components/relative-time";
import { CHAT_MESSAGE_STATE_CLASSES } from "@/lib/chat/chat-state";
import type { DealState } from "@/lib/types/market";
import { cn } from "@/lib/utils";

const STATUS_BACKGROUNDS: Record<DealState, string> = {
  REQUESTED: "bg-orange-500/10",
  ACCEPTED: "bg-sky-500/10",
  PAID: "bg-purple-500/10",
  RELEASED: "bg-emerald-500/10",
  CANCELED: "bg-red-500/10"
};

const DEFAULT_BACKGROUND = "bg-muted/60";

interface ChatToastProps {
  message: string;
  status?: DealState;
  timestamp: number | string | Date;
  onOpen?: () => void;
  onClose?: () => void;
}

export function ChatToast({ message, status, timestamp, onOpen, onClose }: ChatToastProps) {
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
  const statusClass = status ? CHAT_MESSAGE_STATE_CLASSES[status] : undefined;

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
        <span className="text-sm leading-relaxed text-foreground">{message || ""}</span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {status && statusClass ? (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-1 font-semibold uppercase tracking-[0.2em]",
                statusClass
              )}
            >
              {status}
            </span>
          ) : null}
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
