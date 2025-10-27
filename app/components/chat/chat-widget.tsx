"use client";

import * as React from "react";
import { ChatContainer, ChatList, ChatMessage, ChatInput } from "@/components/ui/chat";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DealState } from "@/lib/types/market";
import type { DealChatMessage } from "@/lib/swap2p/types";
import { useChatMessages } from "@/hooks/use-chat-messages";
import { RelativeTime } from "@/components/relative-time";
import { DealStatusBadge } from "@/components/deals/deal-status-badge";

interface ChatWidgetProps {
  className?: string;
  dealState?: DealState;
  chat?: DealChatMessage[];
  currentAccount?: string;
  maker?: string;
  taker?: string;
  onSendMessage?: (message: string) => Promise<void> | void;
}

const chatEnabledStates: DealState[] = ["ACCEPTED", "PAID"];

export function ChatWidget({
  className,
  dealState,
  chat,
  currentAccount,
  maker,
  taker,
  onSendMessage
}: ChatWidgetProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const {
    messages,
    draft,
    setDraft,
    isTooLong,
    submitMessage,
    maxLength,
    sending,
    error,
    clearError
  } = useChatMessages({
    chat,
    currentAccount,
    maker,
    taker,
    containerRef,
    onSend: onSendMessage
  });
  const isChatEnabled = chatEnabledStates.includes(dealState ?? "REQUESTED");

  const scrollToBottom = React.useCallback(() => {
    const element = containerRef.current;
    if (!element) return;
    requestAnimationFrame(() => {
      element.scrollTop = element.scrollHeight;
    });
  }, []);

  const onSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void (async () => {
        await submitMessage();
        scrollToBottom();
        requestAnimationFrame(() => {
          inputRef.current?.focus();
        });
      })();
    },
    [submitMessage, scrollToBottom]
  );

  const handleInputChange = (value: string) => {
    if (error) {
      clearError();
    }
    setDraft(value);
  };

  return (
    <ChatContainer
      className={cn(
        "rounded-3xl bg-card/60 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.65)] backdrop-blur min-h-0",
        className
      )}
    >
{/*      <ChatHeader
        title="Swap2p Chat"
        description="Encrypted P2P coordination"
        className="border-0 px-6 py-5 text-sm font-medium text-muted-foreground/80"
      />*/}
      <div ref={containerRef} className="flex-1 overflow-y-auto px-0 pr-2 pb-2">
        <ChatList className="space-y-1 py-4 px-0">
          {messages.map(message => {
            return (
              <ChatMessage
                key={message.id}
                role={message.role}
                className={message.role === "assistant" ? "text-muted-foreground" : "text-foreground"}
              >
                <div className="flex flex-col gap-0 rounded-3xl bg-background/70 px-3 py-3 ">
                  {message.content ? (
                    <p className="text-sm leading-relaxed">{message.content}</p>
                  ) : null}
                  <div className="mt-1 flex items-center gap-2 text-[0.65rem] text-muted-foreground/70">
                    {message.state ? <DealStatusBadge status={message.state} size="sm" /> : null}
                    <RelativeTime
                      value={message.timestamp}
                      className="ml-auto text-[0.65rem] text-muted-foreground/70"
                    />
                  </div>
                </div>
              </ChatMessage>
            );
          })}
        </ChatList>
      </div>
      {isChatEnabled ? (
        <ChatInput
          onSubmit={onSubmit}
          className="border-0 px-0 pb-0 pt-2"
        >
          <div className="flex w-full items-center gap-3 rounded-2xl bg-background/70 px-3 py-2 shadow-[0_12px_30px_-28px_rgba(15,23,42,0.6)]">
            <input
              ref={inputRef}
              type="text"
              name="message"
              placeholder="Enter your message here…"
              value={draft}
              onChange={event => handleInputChange(event.target.value)}
              maxLength={maxLength}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
            <Button
              type="submit"
              size="sm"
              variant="ghost"
              className="rounded-full px-3"
              disabled={!draft.trim().length || isTooLong || sending}
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Send</span>
            </Button>
          </div>
          {error ? (
            <p className="mt-2 text-xs text-red-500">{error}</p>
          ) : null}
          {isTooLong ? (
            <p className="mt-2 text-xs text-orange-500">
              Message is limited to {maxLength} characters.
            </p>
          ) : null}
        </ChatInput>
      ) : (
        <div className="flex items-center justify-center px-4 py-3 text-center text-sm text-muted">
          Sending messages is only available when the deal is Accepted or Paid.
        </div>
      )}
    </ChatContainer>
  );
}
