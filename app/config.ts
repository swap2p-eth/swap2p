import hardhatDeployment from "@/networks/hardhat.json";
import { hardhatChain } from "@/lib/chains";
import { getFiatData } from "@/lib/fiat-data";
import { BANK_TRANSFER_LABEL, PAYMENT_METHODS, getPaymentMethodsForCountry } from "@/payment-methods";
export { PAYMENT_METHODS, BANK_TRANSFER_LABEL, getPaymentMethodsForCountry };
import type { FiatInfo } from "@/lib/fiat-data";
export type NetworkKey = "hardhat" | "mezo";

export interface TokenConfig {
  symbol: string;
  address: `0x${string}`;
  decimals: number;
}

export type { FiatInfo } from "@/lib/fiat-data";

export interface NetworkConfig {
  chainId: number;
  name: string;
  swap2pAddress: `0x${string}`;
  tokens: TokenConfig[];
}

export interface AppConfigShape {
  defaultNetwork: NetworkKey;
  networks: Record<NetworkKey, NetworkConfig>;
  paymentMethods: Record<string, readonly string[]>;
}

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
export const DEFAULT_PARTNER_ADDRESS = ZERO_ADDRESS;

const asAddress = (value?: string): `0x${string}` => {
  if (typeof value === "string" && value.startsWith("0x")) {
    return value as `0x${string}`;
  }
  return ZERO_ADDRESS;
};

const fiatData = getFiatData();
export const FIAT_INFOS: FiatInfo[] = fiatData.infos;
export const FIAT_BY_COUNTRY = fiatData.byCountry;

const HARDHAT_TOKEN_DECIMALS: Record<string, number> = {
  WBTC: 8,
  USDT: 6,
  DAI: 18,
  WETH: 18,
};

export const APP_CONFIG: AppConfigShape = {
  defaultNetwork: "mezo",
  networks: {
    hardhat: {
      chainId: hardhatChain.id,
      name: "Hardhat (local)",
      swap2pAddress:
        typeof hardhatDeployment.swap2p === "string"
          ? asAddress(hardhatDeployment.swap2p)
          : ZERO_ADDRESS,
      tokens: Object.entries(hardhatDeployment.tokens ?? {}).map(
        ([symbol, address]) =>
          ({
            symbol,
            address: asAddress(address),
            decimals: HARDHAT_TOKEN_DECIMALS[symbol] ?? 18,
          }) satisfies TokenConfig,
      ),
    },
    mezo: {
      chainId: 31612,
      name: "Mezo",
      swap2pAddress: "0xb79277c27461ad9cfFdf98D43bbCE904fb678097" as `0x${string}`,
      tokens: [
        {
          symbol: "BTC",
          address: "0x7b7C000000000000000000000000000000000000" as `0x${string}`,
          decimals: 18,
        },
        {
          symbol: "MUSD",
          address: "0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186" as `0x${string}`,
          decimals: 18,
        },
        {
          symbol: "USDC",
          address: "0x04671C72Aab5AC02A03c1098314b1BB6B560c197" as `0x${string}`,
          decimals: 6,
        },
        {
          symbol: "USDT",
          address: "0xeB5a5d39dE4Ea42C2Aa6A57EcA2894376683bB8E" as `0x${string}`,
          decimals: 6,
        },
      ] satisfies TokenConfig[],
    },
  },
  paymentMethods: PAYMENT_METHODS,
};

export function getNetworkConfig(key?: NetworkKey): NetworkConfig {
  const target = key ?? APP_CONFIG.defaultNetwork;
  return APP_CONFIG.networks[target];
}

export function getNetworkConfigForChain(chainId?: number): NetworkConfig {
  if (typeof chainId === "number") {
    const match = Object.values(APP_CONFIG.networks).find(cfg => cfg.chainId === chainId);
    if (match) return match;

    const fallback = getNetworkConfig(APP_CONFIG.defaultNetwork);
    return {
      ...fallback,
      chainId,
      swap2pAddress: ZERO_ADDRESS,
      tokens: [],
    };
  }
  return getNetworkConfig(APP_CONFIG.defaultNetwork);
}
