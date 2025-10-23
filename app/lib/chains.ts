import { defineChain, http } from "viem";

import hardhatNetwork from "@/networks/hardhat.json";

const hardhatRpcUrl = hardhatNetwork.rpcUrl ?? "http://127.0.0.1:8545";

export const hardhatChain = defineChain({
  id: 31337,
  name: "Hardhat (local)",
  network: "hardhat",
  nativeCurrency: {
    name: "Test Ether",
    symbol: "ETH",
    decimals: 18
  },
  rpcUrls: {
    default: {
      http: [hardhatRpcUrl]
    },
    public: {
      http: [hardhatRpcUrl]
    }
  },
  blockExplorers: {
    default: {
      name: "Hardhat RPC",
      url: hardhatRpcUrl
    }
  },
  testnet: true
});

export const hardhatTransport = http(hardhatRpcUrl);
