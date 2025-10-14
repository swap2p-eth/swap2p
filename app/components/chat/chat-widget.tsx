"use client";

import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChatContainer, ChatHeader, ChatList, ChatMessage, ChatInput } from "@/components/ui/chat";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ChatbotRole = "user" | "assistant" | "system";

interface ChatbotMessage {
  id: string;
  role: ChatbotRole;
  content: string;
  createdAt?: Date;
}

const seedMessages: ChatbotMessage[] = [
  {
    id: "seed-1",
    role: "assistant",
    content:
      "Parties only see each other after a deal is created. Messages will live on-chain as encrypted bytes.",
    createdAt: new Date()
  },
  {
    id: "seed-2",
    role: "user",
    content: "Great, surface the fresh deals and hook them into chat.",
    createdAt: new Date()
  },
  {
    id: "seed-3",
    role: "assistant",
    content: "Wiring the contract API — messages are already stored as bytes.",
    createdAt: new Date()
  }
];

function createMessage(content: string, role: ChatbotMessage["role"] = "user"): ChatbotMessage {
  return {
    id: `${role}-${Date.now()}`,
    role,
    content,
    createdAt: new Date()
  };
}

export function ChatWidget({ className }: { className?: string }) {
  const [messages, setMessages] = React.useState<ChatbotMessage[]>(seedMessages);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 80,
    overscan: 6
  });

  const onSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const text = String(formData.get("message") ?? "").trim();
      if (!text) return;

      const nextMessages = [...messages, createMessage(text)];
      setMessages(nextMessages);
      event.currentTarget.reset();
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
    [messages]
  );

  React.useEffect(() => {
    const scrollElement = containerRef.current;
    if (!scrollElement) return;
    const virtualItems = rowVirtualizer.getVirtualItems();
    const last = virtualItems[virtualItems.length - 1];
    if (last) {
      scrollElement.scrollTo({ top: last.end, behavior: "smooth" });
    }
  }, [messages, rowVirtualizer]);

  return (
    <ChatContainer
      className={cn(
        "flex h-full flex-col rounded-3xl bg-card/60 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.65)] backdrop-blur",
        className
      )}
    >
      <ChatHeader
        title="Swap2p Chat"
        description="Encrypted P2P coordination"
        className="border-0 px-6 py-5 text-sm font-medium text-muted-foreground/80"
      />
      <div ref={containerRef} className="flex-1 overflow-y-auto px-6 pb-6">
        <ChatList className="relative space-y-4 py-4">
          <div
            className="relative"
            style={{
              height: rowVirtualizer.getTotalSize()
            }}
          >
            {rowVirtualizer.getVirtualItems().map(virtualRow => {
              const message = messages[virtualRow.index];
              return (
                <div
                  key={message.id}
                  className={cn(
                    "absolute left-0 right-0 transition-all",
                    message.role === "assistant" ? "text-muted-foreground" : "text-foreground"
                  )}
                  style={{
                    transform: `translateY(${virtualRow.start}px)`
                  }}
                >
                  <ChatMessage role={message.role}>
                    <div className="rounded-2xl bg-background/70 px-4 py-3 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.5)]">
                      <p className="text-sm leading-relaxed">{message.content}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {message.createdAt?.toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </p>
                    </div>
                  </ChatMessage>
                </div>
              );
            })}
          </div>
        </ChatList>
      </div>
      <ChatInput
        onSubmit={onSubmit}
        className="border-0 px-6 pb-6 pt-2"
      >
        <div className="flex w-full items-center gap-3 rounded-2xl bg-background/70 px-3 py-2 shadow-[0_12px_30px_-28px_rgba(15,23,42,0.6)]">
          <input
            ref={inputRef}
            type="text"
            name="message"
            placeholder="Message will be encoded to bytes…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          />
          <Button type="submit" size="sm" variant="ghost" className="rounded-full px-4">
            Send
          </Button>
        </div>
      </ChatInput>
    </ChatContainer>
  );
}
