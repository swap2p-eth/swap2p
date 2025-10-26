import * as React from "react";

import { ChatWidget } from "@/components/chat/chat-widget";
import { cn } from "@/lib/utils";
import type { DealState } from "@/lib/types/market";
import type { DealChatMessage } from "@/lib/swap2p/types";

interface DealChatCardProps {
  className?: string;
  dealState: DealState;
  chat?: DealChatMessage[];
  currentAccount?: string;
  maker: string;
  taker: string;
  onSendMessage: (message: string) => Promise<void> | void;
}

export function DealChatCard({
  className,
  dealState,
  chat,
  currentAccount,
  maker,
  taker,
  onSendMessage
}: DealChatCardProps) {
  return (
    <section
      className={cn(
        "rounded-3xl bg-card/60 p-6 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.45)] backdrop-blur",
        className
      )}
    >
      <header className="mb-4">
        <h2 className="text-lg font-semibold">Chat</h2>
      </header>
      <ChatWidget
        className="min-h-[360px] bg-transparent shadow-none"
        dealState={dealState}
        chat={chat}
        currentAccount={currentAccount}
        maker={maker}
        taker={taker}
        onSendMessage={onSendMessage}
      />
    </section>
  );
}
