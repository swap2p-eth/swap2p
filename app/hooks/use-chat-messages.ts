import * as React from "react";

import {
  MAX_MESSAGE_LENGTH,
  type ChatbotMessage
} from "@/components/chat/chat-utils";
import type { DealState } from "@/lib/types/market";
import { SwapDealState, type DealChatMessage } from "@/lib/swap2p/types";
import { hexToString } from "viem";

interface UseChatMessagesOptions {
  chat?: DealChatMessage[];
  currentAccount?: string;
  maker?: string;
  taker?: string;
  containerRef?: React.RefObject<HTMLDivElement>;
  maxLength?: number;
  onSend?: (message: string) => Promise<void>;
}

const formatTimestamp = (value: number) => {
  const date = value > 0 ? new Date(value * 1000) : new Date();
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
};

const safeDecode = (payload: string): string => {
  try {
    return hexToString(payload).trim();
  } catch {
    return payload;
  }
};

const messageStateLabels: Partial<Record<SwapDealState, DealState>> = {
  [SwapDealState.REQUESTED]: "REQUESTED",
  [SwapDealState.ACCEPTED]: "ACCEPTED",
  [SwapDealState.PAID]: "PAID",
  [SwapDealState.RELEASED]: "RELEASED",
  [SwapDealState.CANCELED]: "CANCELED"
};

export function useChatMessages({
  chat = [],
  currentAccount,
  maker,
  taker,
  containerRef,
  maxLength = MAX_MESSAGE_LENGTH,
  onSend
}: UseChatMessagesOptions = {}) {
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const normalizedCurrent = currentAccount?.toLowerCase();
  const normalizedMaker = maker?.toLowerCase();
  const normalizedTaker = taker?.toLowerCase();

  const messages = React.useMemo<ChatbotMessage[]>(() => {
    return chat.map((entry, index) => {
      const sender = entry.toMaker ? normalizedTaker : normalizedMaker;
      const role = sender && sender === normalizedCurrent ? "user" : "assistant";
      const content = safeDecode(entry.payload);
      const state = messageStateLabels[entry.state];
      return {
        id: `${entry.timestamp}-${index}`,
        role,
        content,
        timestamp: formatTimestamp(entry.timestamp),
        state
      };
    });
  }, [chat, normalizedCurrent, normalizedMaker, normalizedTaker]);

  const isTooLong = draft.length > maxLength;

  const submitMessage = React.useCallback(async () => {
    if (!onSend) return;
    const text = draft.trim();
    if (!text || draft.length > maxLength) return;
    setSending(true);
    setError(null);
    try {
      await onSend(text);
      setDraft("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send message.";
      setError(message);
    } finally {
      setSending(false);
    }
  }, [draft, maxLength, onSend]);

  React.useEffect(() => {
    if (!containerRef?.current) return;
    const element = containerRef.current;
    element.scrollTop = element.scrollHeight;
  }, [messages, containerRef]);

  const clearError = React.useCallback(() => setError(null), []);

  return {
    messages,
    draft,
    setDraft,
    isTooLong,
    submitMessage,
    maxLength,
    sending,
    error,
    clearError
  };
}
