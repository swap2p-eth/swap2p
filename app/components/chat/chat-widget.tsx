"use client";

import * as React from "react";
import { ChatContainer, ChatList, ChatMessage, ChatInput } from "@/components/ui/chat";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DealState } from "@/lib/types/market";
import type { DealChatMessage } from "@/lib/swap2p/types";
import { useChatMessages } from "@/hooks/use-chat-messages";

interface ChatWidgetProps {
  className?: string;
  dealState?: DealState;
  chat?: DealChatMessage[];
  currentAccount?: string;
  maker?: string;
  taker?: string;
  onSendMessage?: (message: string) => Promise<void>;
}

const chatEnabledStates: DealState[] = ["ACCEPTED", "PAID"];
const chatMessageStateClasses: Record<DealState, string> = {
  REQUESTED: "bg-orange-500/10 text-orange-500",
  ACCEPTED: "bg-sky-500/10 text-sky-500",
  PAID: "bg-purple-500/10 text-purple-500",
  RELEASED: "bg-emerald-500/10 text-emerald-500",
  CANCELED: "bg-red-500/10 text-red-500"
};

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

  const onSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void (async () => {
        await submitMessage();
        requestAnimationFrame(() => {
          inputRef.current?.focus();
        });
      })();
    },
    [submitMessage]
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
        "flex h-full flex-col rounded-3xl bg-card/60 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.65)] backdrop-blur",
        className
      )}
    >
{/*      <ChatHeader
        title="Swap2p Chat"
        description="Encrypted P2P coordination"
        className="border-0 px-6 py-5 text-sm font-medium text-muted-foreground/80"
      />*/}
      <div ref={containerRef} className="flex-1 overflow-y-auto px-2 pb-2">
        <ChatList className="space-y-4 py-4">
          {messages.map(message => {
            const stateClass = message.state ? chatMessageStateClasses[message.state] : undefined;
            return (
              <ChatMessage
                key={message.id}
                role={message.role}
                className={message.role === "assistant" ? "text-muted-foreground" : "text-foreground"}
              >
                <div className="flex flex-col gap-2 rounded-2xl bg-background/70 px-4 py-3 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.5)]">
                  {message.state ? (
                    <span
                      className={cn(
                        "inline-flex items-center self-start rounded-full px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em]",
                        stateClass
                      )}
                    >
                      {message.state}
                    </span>
                  ) : null}
                  <p className="text-sm leading-relaxed">{message.content}</p>
                  <p className="text-[0.65rem] text-muted-foreground/70">{message.timestamp}</p>
                </div>
              </ChatMessage>
            );
          })}
        </ChatList>
      </div>
      {isChatEnabled ? (
        <ChatInput
          onSubmit={onSubmit}
          className="border-0 px-6 pb-6 pt-2"
        >
          <div className="flex w-full items-center gap-3 rounded-2xl bg-background/70 px-3 py-2 shadow-[0_12px_30px_-28px_rgba(15,23,42,0.6)]">
            <input
              ref={inputRef}
              type="text"
              name="message"
              placeholder="Enter your message here…"
              value={draft}
              onChange={event => handleInputChange(event.target.value)}
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
        <div className="px-6 pb-6 pt-2">
          <div className="flex min-h-[68px] items-center justify-center rounded-2xl bg-background/50 px-4 py-3 text-center text-sm text-muted-foreground">
            Sending messages is only available when the deal is Accepted or Paid.
          </div>
        </div>
      )}
    </ChatContainer>
  );
}
