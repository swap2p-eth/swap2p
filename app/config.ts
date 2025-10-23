import hardhatDeployment from "@/networks/hardhat.json";
import { hardhatChain } from "@/lib/chains";

export type NetworkKey = "hardhat" | "ethereum" | "optimism";

export interface TokenConfig {
  symbol: string;
  address: `0x${string}`;
  decimals: number;
}

export interface FiatConfig {
  code: string;
  name: string;
  country: string;
}

export interface NetworkConfig {
  chainId: number;
  name: string;
  swap2pAddress: `0x${string}`;
  tokens: TokenConfig[];
  fiats: FiatConfig[];
  paymentMethods: Record<string, string[]>;
}

export interface AppConfigShape {
  defaultNetwork: NetworkKey;
  networks: Record<NetworkKey, NetworkConfig>;
}

const HARDHAT_TOKEN_DECIMALS: Record<string, number> = {
  WBTC: 8,
  USDT: 6,
  DAI: 18,
  WETH: 18
};

export const APP_CONFIG: AppConfigShape = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: hardhatChain.id,
      name: "Hardhat (local)",
      swap2pAddress:
        typeof hardhatDeployment.swap2p === "string"
          ? (hardhatDeployment.swap2p as `0x${string}`)
          : "0x0000000000000000000000000000000000000000",
      tokens: Object.entries(hardhatDeployment.tokens ?? {}).map(([symbol, address]) => ({
        symbol,
        address,
        decimals: HARDHAT_TOKEN_DECIMALS[symbol] ?? 18
      })),
      fiats: [
        { code: "USD", name: "US Dollar", country: "United States" },
        { code: "EUR", name: "Euro", country: "European Union" },
        { code: "BRL", name: "Brazilian Real", country: "Brazil" },
        { code: "GBP", name: "British Pound", country: "United Kingdom" }
      ],
      paymentMethods: {
        USD: ["Wire (Fedwire)", "ACH", "Zelle"],
        EUR: ["SEPA", "SEPA Instant", "Revolut Business"],
        BRL: ["PIX", "TED", "Itau Transfer"],
        GBP: ["Faster Payments", "SWIFT GBP", "Revolut"]
      }
    },
    ethereum: {
      chainId: 1,
      name: "Ethereum Mainnet",
      swap2pAddress: "0x111111111111111111111111111111111111aAaA",
      tokens: [
        {
          symbol: "USDC",
          address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
          decimals: 6
        },
        {
          symbol: "USDT",
          address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
          decimals: 6
        },
        {
          symbol: "DAI",
          address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
          decimals: 18
        },
        {
          symbol: "WETH",
          address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
          decimals: 18
        }
      ],
      fiats: [
        { code: "USD", name: "US Dollar", country: "United States" },
        { code: "EUR", name: "Euro", country: "European Union" },
        { code: "GBP", name: "British Pound", country: "United Kingdom" },
        { code: "JPY", name: "Japanese Yen", country: "Japan" }
      ],
      paymentMethods: {
        USD: ["Wire", "Silvergate SEN", "Signet"],
        EUR: ["SEPA", "SEPA Instant", "SWIFT EUR"],
        GBP: ["Faster Payments", "SWIFT GBP"],
        JPY: ["Domestic Transfer", "SWIFT JPY"]
      }
    },
    optimism: {
      chainId: 10,
      name: "Optimism",
      swap2pAddress: "0x222222222222222222222222222222222222aAaA",
      tokens: [
        {
          symbol: "USDC.e",
          address: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607",
          decimals: 6
        },
        {
          symbol: "USDT",
          address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
          decimals: 6
        },
        {
          symbol: "DAI",
          address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
          decimals: 18
        },
        {
          symbol: "OP",
          address: "0x4200000000000000000000000000000000000042",
          decimals: 18
        }
      ],
      fiats: [
        { code: "USD", name: "US Dollar", country: "United States" },
        { code: "MXN", name: "Mexican Peso", country: "Mexico" },
        { code: "CLP", name: "Chilean Peso", country: "Chile" }
      ],
      paymentMethods: {
        USD: ["ACH", "Wire", "Zelle"],
        MXN: ["SPEI", "Banorte Transfer"],
        CLP: ["WebPay", "BancoEstado"]
      }
    }
  }
};

export function getNetworkConfig(key?: NetworkKey): NetworkConfig {
  const target = key ?? APP_CONFIG.defaultNetwork;
  return APP_CONFIG.networks[target];
}

export function getNetworkConfigForChain(chainId?: number): NetworkConfig {
  if (typeof chainId === "number") {
    const match = Object.values(APP_CONFIG.networks).find(cfg => cfg.chainId === chainId);
    if (match) return match;
  }
  return getNetworkConfig(APP_CONFIG.defaultNetwork);
}
