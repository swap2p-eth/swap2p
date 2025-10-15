import { getAddress, type Address } from "viem";
import type { Swap2pAdapterMode } from "./types";

const rawMode = (process.env.NEXT_PUBLIC_SWAP2P_MODE ?? "viem").toLowerCase();

export const swap2pMode: Swap2pAdapterMode =
  rawMode === "mock" ? "mock" : "viem";

export const isMockMode = swap2pMode === "mock";

export const swap2pAddress: Address | null = (() => {
  if (isMockMode) return null;
  const value = process.env.NEXT_PUBLIC_SWAP2P_ADDRESS;
  if (!value) return null;
  try {
    return getAddress(value);
  } catch {
    console.warn(
      "[swap2p] NEXT_PUBLIC_SWAP2P_ADDRESS is not a valid address, falling back to null",
    );
    return null;
  }
})();

export const swap2pChainId: number | null = (() => {
  const raw = process.env.NEXT_PUBLIC_SWAP2P_CHAIN_ID;
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
})();
