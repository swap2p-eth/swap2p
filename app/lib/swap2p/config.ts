import { getAddress, type Address } from "viem";

import { getNetworkConfigForChain } from "@/config";
import { warn as logWarn } from "@/lib/logger";

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
    logWarn(
      "swap2p:config",
      "network swap2pAddress is not a valid address, falling back to null"
    );
    return null;
  }
};

export const resolveSwap2pChainId = (chainId?: number): number | null =>
  typeof chainId === "number" ? chainId : null;
