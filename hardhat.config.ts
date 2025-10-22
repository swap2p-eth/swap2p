import type { HardhatUserConfig } from "hardhat/config";
import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import HardhatContractSizer from '@solidstate/hardhat-contract-sizer';
import "@nomicfoundation/hardhat-verify";
import "dotenv/config";

const DEFAULT_LOCAL_PRIVATE_KEY = "0x59c6995e998f97a5a004497e5dce3c08ad94b5c2378de0b5b743cba3cbb58533";
const hasUserPrivateKey = Boolean(process.env.PRIVATE_KEY);
const resolvedPrivateKey = hasUserPrivateKey ? process.env.PRIVATE_KEY! : DEFAULT_LOCAL_PRIVATE_KEY;

if (!hasUserPrivateKey) {
  console.warn(
    "PRIVATE_KEY env variable not set. Using a default local key for tooling. Set PRIVATE_KEY before deploying to real networks.",
  );
}

const config: HardhatUserConfig = {
  plugins: [hardhatToolboxViemPlugin, HardhatContractSizer],
  contractSizer: {
    runOnCompile: true,
    only: ['Swap2p.sol']
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
      allowUnlimitedContractSize: true,
      nodeConfiguration: {
        allowUnlimitedContractSize: true,
      },
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: 'https://0xrpc.io/sep',
      accounts: hasUserPrivateKey ? [resolvedPrivateKey] : [],
    },
  },
/*  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_API_KEY,
    },
  },*/
  verify: {
    etherscan: {
      apiKey: process.env.ETHERSCAN_API_KEY,
    },
  },
};

export default config;
