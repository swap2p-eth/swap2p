import type { Swap2pAdapter } from "./types";
import { isMockMode, swap2pAddress, swap2pMode } from "./config";
import { createSwap2pMockAdapter } from "./mock-adapter";
import {
  type Swap2pViemAdapterConfig,
  createSwap2pViemAdapter,
} from "./viem-adapter";

export { swap2pMode, swap2pAddress, isMockMode };
export type { Swap2pViemAdapterConfig } from "./viem-adapter";
export { createSwap2pMockAdapter, createSwap2pViemAdapter };

export const createSwap2pAdapter = (
  config?: Swap2pViemAdapterConfig,
): Swap2pAdapter => {
  if (swap2pMode === "mock") {
    return createSwap2pMockAdapter();
  }
  if (!config) {
    throw new Error(
      "createSwap2pAdapter: viem mode requires a Swap2pViemAdapterConfig",
    );
  }
  const address = config.address ?? swap2pAddress;
  if (!address) {
    throw new Error("createSwap2pAdapter: missing contract address");
  }
  return createSwap2pViemAdapter({ ...config, address });
};
