import * as React from "react";

import {
  MAX_MESSAGE_LENGTH,
  type ChatbotMessage
} from "@/components/chat/chat-utils";
import { CHAT_MESSAGE_STATE_LABELS } from "@/lib/chat/chat-state";
import type { DealChatMessage } from "@/lib/swap2p/types";
import { hexToString, type Hex } from "viem";
import { isUserRejectedError } from "@/lib/errors";
import { error as logError, warn as logWarn } from "@/lib/logger";
import { sanitizeDisplayText, sanitizeUserText } from "@/lib/utils";

interface UseChatMessagesOptions {
  chat?: DealChatMessage[];
  currentAccount?: string;
  maker?: string;
  taker?: string;
  containerRef?: React.RefObject<HTMLDivElement>;
  maxLength?: number;
  onSend?: (message: string) => Promise<void> | void;
}

const safeDecode = (payload: string): string => {
  try {
    if (typeof payload !== "string" || !payload.startsWith("0x")) {
      return payload;
    }
    return hexToString(payload as Hex).trim();
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
  const [draftState, setDraftState] = React.useState("");
  const setDraft = React.useCallback(
    (value: string) => {
      setDraftState(
        sanitizeUserText(value, {
          maxLength,
          allowLineBreaks: false,
        }),
      );
    },
    [maxLength],
  );
  const draft = draftState;
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const normalizedCurrent = currentAccount?.toLowerCase();
  const normalizedMaker = maker?.toLowerCase();
  const normalizedTaker = taker?.toLowerCase();

  const messages = React.useMemo<ChatbotMessage[]>(() => {
    return chat.map((entry, index) => {
      const sender = entry.toMaker ? normalizedTaker : normalizedMaker;
      const role = sender && sender === normalizedCurrent ? "user" : "assistant";
      const decoded = safeDecode(entry.payload);
      const content = sanitizeDisplayText(decoded, {
        maxLength,
        allowLineBreaks: false,
      });
      const state = CHAT_MESSAGE_STATE_LABELS[entry.state];
      return {
        id: `${entry.timestamp}-${index}`,
        role,
        content,
        timestamp: toTimestampDate(entry.timestamp),
        state
      };
    });
  }, [chat, normalizedCurrent, normalizedMaker, normalizedTaker, maxLength]);

  const isTooLong = draft.length > maxLength;

  const submitMessage = React.useCallback(async () => {
    if (!onSend) return;
    const text = draft.trim();
    if (!text || draft.length > maxLength) return;
    setSending(true);
    setError(null);
    try {
      const sanitizedText = sanitizeUserText(text, {
        maxLength,
        allowLineBreaks: false,
      });
      if (!sanitizedText) {
        setSending(false);
        return;
      }
      await onSend(sanitizedText);
      setDraftState("");
    } catch (err) {
      const log = isUserRejectedError(err) ? logWarn : logError;
      log("chat", "send failed", err);
      const fullMessage =
        err instanceof Error ? err.message : typeof err === "string" ? err : "Failed to send message.";
      const shortMessage = fullMessage.split(".")[0] ?? "Failed to send message";
      setError(shortMessage.trim());
    } finally {
      setSending(false);
    }
  }, [draft, maxLength, onSend]);

  React.useEffect(() => {
    if (!containerRef?.current) return;
    const element = containerRef.current;
    const raf = requestAnimationFrame(() => {
      element.scrollTop = element.scrollHeight;
    });
    return () => cancelAnimationFrame(raf);
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
