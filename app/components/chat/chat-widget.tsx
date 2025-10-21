"use client";

import * as React from "react";
import { ChatContainer, ChatHeader, ChatList, ChatMessage, ChatInput } from "@/components/ui/chat";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DealState } from "@/lib/mock-data";

type ChatbotRole = "user" | "assistant" | "system";

interface ChatbotMessage {
  id: string;
  role: ChatbotRole;
  content: string;
  timestamp: string;
}

const seedMessages: ChatbotMessage[] = [
  {
    id: "seed-1",
    role: "assistant",
    content:
      "Parties only see each other after a deal is created. Messages will live on-chain as encrypted bytes.",
    timestamp: "10:00"
  },
  {
    id: "seed-2",
    role: "user",
    content: "Great, surface the fresh deals and hook them into chat.",
    timestamp: "10:02"
  },
  {
    id: "seed-3",
    role: "assistant",
    content: "Wiring the contract API — messages are already stored as bytes.",
    timestamp: "10:03"
  }
];

function createMessage(
  content: string,
  role: ChatbotMessage["role"] = "user",
  timestamp?: string
): ChatbotMessage {
  const label =
    timestamp ??
    new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date());
  return {
    id: `${role}-${Date.now()}`,
    role,
    content,
    timestamp: label
  };
}

interface ChatWidgetProps {
  className?: string;
  dealState?: DealState;
}

const chatEnabledStates: DealState[] = ["ACCEPTED", "PAID"];
const MAX_MESSAGE_LENGTH = 128;

export function ChatWidget({ className, dealState }: ChatWidgetProps) {
  const [messages, setMessages] = React.useState<ChatbotMessage[]>(seedMessages);
  const [draft, setDraft] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const isChatEnabled = chatEnabledStates.includes(dealState ?? "REQUESTED");
  const isTooLong = draft.length > MAX_MESSAGE_LENGTH;

  const onSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const text = draft.trim();
      if (!text || draft.length > MAX_MESSAGE_LENGTH) return;

      const userMessage = createMessage(text);
      const nextMessages = [...messages, userMessage];
      setMessages(nextMessages);
      setDraft("");
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });

      // Placeholder assistant reply. Replace with real chatbot-kit integration.
      setTimeout(() => {
        setMessages(prev => [
          ...prev,
          createMessage("Encrypting and relaying to Swap2p — the bot integration is ready to grow.", "assistant")
        ]);
      }, 450);
    },
    [draft, messages]
  );

  React.useEffect(() => {
    const scrollElement = containerRef.current;
    if (!scrollElement) return;
    scrollElement.scrollTop = scrollElement.scrollHeight;
  }, [messages]);

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
      <div ref={containerRef} className="flex-1 overflow-y-auto px-6 pb-6">
        <ChatList className="space-y-4 py-4">
          {messages.map(message => (
            <ChatMessage
              key={message.id}
              role={message.role}
              className={message.role === "assistant" ? "text-muted-foreground" : "text-foreground"}
            >
              <div className="rounded-2xl bg-background/70 px-4 py-3 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.5)]">
                <p className="text-sm leading-relaxed">{message.content}</p>
                <p className="mt-1 text-xs text-muted-foreground">{message.timestamp}</p>
              </div>
            </ChatMessage>
          ))}
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
              onChange={event => setDraft(event.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
            <Button
              type="submit"
              size="sm"
              variant="ghost"
              className="rounded-full px-3"
              disabled={!draft.trim().length || isTooLong}
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Send</span>
            </Button>
          </div>
          {isTooLong ? (
            <p className="mt-2 text-xs text-orange-500">
              Message is limited to 128 characters.
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
