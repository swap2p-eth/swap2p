export type ChatbotRole = "user" | "assistant" | "system";

export interface ChatbotMessage {
  id: string;
  role: ChatbotRole;
  content: string;
  timestamp: string;
}

export const MAX_MESSAGE_LENGTH = 128;

export const seedMessages: ChatbotMessage[] = [
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

export function createChatMessage(
  content: string,
  role: ChatbotRole = "user",
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
