import type { DealState } from "@/lib/types/market";

export type ChatbotRole = "user" | "assistant" | "system";

export interface ChatbotMessage {
  id: string;
  role: ChatbotRole;
  content: string;
  timestamp: Date;
  state?: DealState;
}

export const MAX_MESSAGE_LENGTH = 128;

const now = Date.now();

export const seedMessages: ChatbotMessage[] = [
  {
    id: "seed-1",
    role: "assistant",
    content:
      "Parties only see each other after a deal is created. Messages will live on-chain as encrypted bytes.",
    timestamp: new Date(now - 15 * 60_000)
  },
  {
    id: "seed-2",
    role: "user",
    content: "Great, surface the fresh deals and hook them into chat.",
    timestamp: new Date(now - 14 * 60_000)
  },
  {
    id: "seed-3",
    role: "assistant",
    content: "Wiring the contract API — messages are already stored as bytes.",
    timestamp: new Date(now - 13 * 60_000)
  }
];

export function createChatMessage(
  content: string,
  role: ChatbotRole = "user",
  timestamp?: Date | number | string
): ChatbotMessage {
  let value: Date;
  if (timestamp instanceof Date) {
    value = timestamp;
  } else if (typeof timestamp === "number") {
    const ms = timestamp < 1_000_000_000_000 ? timestamp * 1_000 : timestamp;
    value = new Date(ms);
  } else if (typeof timestamp === "string") {
    const parsed = new Date(timestamp);
    value = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  } else {
    value = new Date();
  }

  return {
    id: `${role}-${Date.now()}`,
    role,
    content,
    timestamp: value
  };
}
