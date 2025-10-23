import { getAddress, type Address } from "viem";

import { getNetworkConfigForChain } from "@/config";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export const resolveSwap2pAddress = (chainId?: number): Address | null => {
  const network = getNetworkConfigForChain(chainId);
  const candidate = network.swap2pAddress;
  if (!candidate || candidate === ZERO_ADDRESS) {
    return null;
  }

  try {
    return getAddress(candidate);
  } catch {
    console.warn(
      "[swap2p] network swap2pAddress is not a valid address, falling back to null"
    );
    return null;
  }
};

export const resolveSwap2pChainId = (chainId?: number): number | null =>
  typeof chainId === "number" ? chainId : null;
