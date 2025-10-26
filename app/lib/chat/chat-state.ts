import type { DealState } from "@/lib/types/market";
import { SwapDealState } from "@/lib/swap2p/types";

export const CHAT_MESSAGE_STATE_LABELS: Partial<Record<SwapDealState, DealState>> = {
  [SwapDealState.REQUESTED]: "REQUESTED",
  [SwapDealState.ACCEPTED]: "ACCEPTED",
  [SwapDealState.PAID]: "PAID",
  [SwapDealState.RELEASED]: "RELEASED",
  [SwapDealState.CANCELED]: "CANCELED"
};

export const CHAT_MESSAGE_STATE_CLASSES: Record<DealState, string> = {
  REQUESTED: "bg-orange-500/10 text-orange-500",
  ACCEPTED: "bg-sky-500/10 text-sky-500",
  PAID: "bg-purple-500/10 text-purple-500",
  RELEASED: "bg-emerald-500/10 text-emerald-500",
  CANCELED: "bg-red-500/10 text-red-500"
};
