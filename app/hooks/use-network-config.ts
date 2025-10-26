import * as React from "react";

import { ZERO_ADDRESS, getNetworkConfigForChain } from "@/config";
import { warn } from "@/lib/logger";

export function useNetworkConfig(chainId?: number) {
  return React.useMemo(() => {
    const network = getNetworkConfigForChain(chainId);
    const isSupported = network.swap2pAddress !== ZERO_ADDRESS && network.tokens.length > 0;
    if (!isSupported && typeof chainId === "number") {
      warn("network", { chainId, message: "Unsupported network configuration detected." });
    }
    return { network, isSupported };
  }, [chainId]);
}
