import * as React from "react";

import {
  MAX_MESSAGE_LENGTH,
  type ChatbotMessage
} from "@/components/chat/chat-utils";
import { CHAT_MESSAGE_STATE_LABELS } from "@/lib/chat/chat-state";
import type { DealChatMessage } from "@/lib/swap2p/types";
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

const safeDecode = (payload: string): string => {
  try {
    return hexToString(payload).trim();
  } catch {
    return payload;
  }
};

const toTimestampDate = (value: number): Date => {
  if (typeof value !== "number") {
    return new Date();
  }
  const ms = value < 1_000_000_000_000 ? value * 1_000 : value;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) {
    return new Date();
  }
  return date;
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
      const state = CHAT_MESSAGE_STATE_LABELS[entry.state];
      return {
        id: `${entry.timestamp}-${index}`,
        role,
        content,
        timestamp: toTimestampDate(entry.timestamp),
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
