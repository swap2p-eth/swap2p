"use client";

import * as React from "react";
import { useChainId, usePublicClient, useWalletClient } from "wagmi";

import { createSwap2pAdapter, resolveSwap2pAddress } from "@/lib/swap2p";
import { error as logError } from "@/lib/logger";

export function useSwap2pAdapter() {
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId });
  const { data: walletClient } = useWalletClient({ chainId });

  return React.useMemo(() => {
    const address = resolveSwap2pAddress(chainId);
    if (!publicClient || !address) {
      return { adapter: null, chainId };
    }
    try {
      const adapter = createSwap2pAdapter({
        chainId,
        viem: {
          address,
          publicClient,
          walletClient: walletClient ?? undefined,
        },
      });
      return { adapter, chainId };
    } catch (error) {
      logError("swap2p-adapter", "failed to create adapter", error);
      return { adapter: null, chainId };
    }
  }, [chainId, publicClient, walletClient]);
}
