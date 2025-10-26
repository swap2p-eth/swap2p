import * as React from "react";

import { getNetworkConfigForChain } from "@/config";

export function useNetworkConfig(chainId?: number) {
  return React.useMemo(() => getNetworkConfigForChain(chainId), [chainId]);
}
