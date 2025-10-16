export interface MockTokenConfig {
  symbol: string;
  priceUsd: number;
  minAmountRange: [number, number];
  maxAmountRange: [number, number];
  decimals: number;
  minMaxMultiplier?: number;
}

export interface MockFiatConfig {
  code: string;
  usdPerUnit: number;
}

export const mockTokenConfigs: MockTokenConfig[] = [
  {
    symbol: "USDT",
    priceUsd: 1,
    minAmountRange: [50, 300],
    maxAmountRange: [750, 4500],
    decimals: 2,
    minMaxMultiplier: 3
  },
  {
    symbol: "USDC",
    priceUsd: 1,
    minAmountRange: [50, 250],
    maxAmountRange: [600, 4000],
    decimals: 2,
    minMaxMultiplier: 3
  },
  {
    symbol: "DAI",
    priceUsd: 1,
    minAmountRange: [25, 200],
    maxAmountRange: [400, 3200],
    decimals: 2,
    minMaxMultiplier: 3
  },
  {
    symbol: "ETH",
    priceUsd: 3500,
    minAmountRange: [0.01, 0.4],
    maxAmountRange: [0.75, 4],
    decimals: 4,
    minMaxMultiplier: 2.5
  },
  {
    symbol: "BTC",
    priceUsd: 65000,
    minAmountRange: [0.003, 0.08],
    maxAmountRange: [0.2, 1.2],
    decimals: 5,
    minMaxMultiplier: 2.5
  }
];

export const mockFiatCurrencies: MockFiatConfig[] = [
  { code: "USD", usdPerUnit: 1 },
  { code: "EUR", usdPerUnit: 1.08 },
  { code: "GBP", usdPerUnit: 1.27 },
  { code: "BRL", usdPerUnit: 0.2 },
  { code: "CNY", usdPerUnit: 0.14 },
  { code: "THB", usdPerUnit: 0.027 },
  { code: "RUB", usdPerUnit: 0.011 }
];

export function computeTokenPriceInFiat(
  token: MockTokenConfig,
  fiat: MockFiatConfig,
  varianceSample: number
): number {
  const basePrice = token.priceUsd / fiat.usdPerUnit;
  const variance = 1 + (varianceSample - 0.5) * 0.04; // +/- 2%
  const decimals = basePrice < 2 ? 4 : 2;
  return Number((basePrice * variance).toFixed(decimals));
}

export function sampleAmountInRange(
  randomSample: number,
  range: [number, number],
  decimals: number
): number {
  const [min, max] = range;
  const value = min + randomSample * (max - min);
  return Number(value.toFixed(decimals));
}

export function ensureMaxAmount(
  candidate: number,
  minAmount: number,
  multiplier = 2
): number {
  return Math.max(candidate, minAmount * multiplier);
}
