import type { Swap2pAdapter } from "./types";
import { resolveSwap2pAddress, resolveSwap2pChainId } from "./config";
import {
  type Swap2pViemAdapterConfig,
  createSwap2pViemAdapter,
} from "./viem-adapter";

export { resolveSwap2pAddress, resolveSwap2pChainId };
export type { Swap2pViemAdapterConfig } from "./viem-adapter";
export { createSwap2pViemAdapter };

interface CreateSwap2pAdapterOptions {
  chainId?: number;
  viem: Swap2pViemAdapterConfig;
}

export const createSwap2pAdapter = (
  options: CreateSwap2pAdapterOptions,
): Swap2pAdapter => {
  const { chainId, viem } = options;
  const address = viem.address ?? resolveSwap2pAddress(chainId);

  if (!address) {
    throw new Error("createSwap2pAdapter: missing contract address");
  }

  return createSwap2pViemAdapter({ ...viem, address });
};
