import * as React from "react";

import {
  MAX_MESSAGE_LENGTH,
  createChatMessage,
  seedMessages,
  type ChatbotMessage
} from "@/components/chat/chat-utils";

interface UseChatMessagesOptions {
  initialMessages?: ChatbotMessage[];
  containerRef?: React.RefObject<HTMLDivElement>;
  maxLength?: number;
}

export function useChatMessages({
  initialMessages = seedMessages,
  containerRef,
  maxLength = MAX_MESSAGE_LENGTH
}: UseChatMessagesOptions = {}) {
  const [messages, setMessages] = React.useState<ChatbotMessage[]>(initialMessages);
  const [draft, setDraft] = React.useState("");
  const isTooLong = draft.length > maxLength;

  const appendAssistantReply = React.useCallback(() => {
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        createChatMessage(
          "Encrypting and relaying to Swap2p — the bot integration is ready to grow.",
          "assistant"
        )
      ]);
    }, 450);
  }, []);

  const submitMessage = React.useCallback(() => {
    const text = draft.trim();
    if (!text || draft.length > maxLength) return;

    const userMessage = createChatMessage(text);
    setMessages(prev => [...prev, userMessage]);
    setDraft("");
    appendAssistantReply();
  }, [draft, maxLength, appendAssistantReply]);

  React.useEffect(() => {
    if (!containerRef?.current) return;
    const element = containerRef.current;
    element.scrollTop = element.scrollHeight;
  }, [messages, containerRef]);

  return {
    messages,
    draft,
    setDraft,
    isTooLong,
    submitMessage,
    maxLength
  };
}
