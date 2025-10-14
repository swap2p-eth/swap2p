import type { HardhatUserConfig } from "hardhat/config";
import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import HardhatContractSizer from '@solidstate/hardhat-contract-sizer';
import "@nomicfoundation/hardhat-verify";
import "dotenv/config";

if (!process.env.PRIVATE_KEY) {
  throw new Error("PRIVATE_KEY environment variable not set");
}
const PRIVATE_KEY = process.env.PRIVATE_KEY;

const config: HardhatUserConfig = {
  plugins: [hardhatToolboxViemPlugin, HardhatContractSizer],
  contractSizer: {
    runOnCompile: false,
  },
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
        settings: {
          evmVersion: "london",
          viaIR: false,
          optimizer: {
            enabled: true,
            runs: 1,
          },
        },
      },
    },
  },
  networks: {
    hardhat: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: 'https://0xrpc.io/sep',
      accounts: [PRIVATE_KEY],
    },
  },
  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_API_KEY,
    },
  },
};

export default config;
