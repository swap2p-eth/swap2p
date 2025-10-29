import type { HardhatUserConfig } from "hardhat/config";
import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import HardhatContractSizer from '@solidstate/hardhat-contract-sizer';
import "@nomicfoundation/hardhat-verify";
import "dotenv/config";

const hasUserPrivateKey = Boolean(process.env.PRIVATE_KEY);

if (!hasUserPrivateKey) {
  console.warn(
    "PRIVATE_KEY env variable not set. Deployments to real networks require PRIVATE_KEY.",
  );
}

const config: HardhatUserConfig = {
  plugins: [hardhatToolboxViemPlugin, HardhatContractSizer],
  contractSizer: {
    runOnCompile: true,
    only: [/Swap2p\.sol/],
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
            runs: 100000,
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
      loggingEnabled: true
    },
    mezo: {
      type: "http",
      chainType: "l1",
      chainId: 31612,
      url: process.env.MEZO_RPC_URL ?? "https://mainnet.mezo.public.validationcloud.io",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
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
  chainDescriptors: {
    31612: {
      name: "mezo",
      blockExplorers: {
        blockscout: {
          name: "Mezo Explorer",
          url: "https://explorer.mezo.org/",
          apiUrl: "https://api.explorer.mezo.org/api"
        }
      }
    },
  },
};

export default config;
