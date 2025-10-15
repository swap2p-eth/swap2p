import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { mainnet } from "viem/chains";
import { mezoMainnet, mezoTestnet } from "@mezo-org/passport/dist/src/constants";

export const rainbowConfig = getDefaultConfig({
  appName: "Swap2p Console",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "51e609ac221c8fb9cbee39d15fb1458f",
  chains: [mainnet, mezoMainnet, mezoTestnet]
});
