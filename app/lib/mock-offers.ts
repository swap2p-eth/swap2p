import { createMockRng, MOCK_NOW_MS } from "@/lib/mock-clock";
import type { DealSide } from "@/lib/mock-data";
import {
  computeTokenPriceInFiat,
  ensureMaxAmount,
  mockFiatCurrencies,
  mockTokenConfigs,
  sampleAmountInRange
} from "@/lib/mock-market";

export interface OfferRow {
  id: number;
  side: DealSide;
  maker: string;
  token: string;
  fiat: string;
  price: number;
  minAmount: number;
  maxAmount: number;
  paymentMethods: string;
  updatedAt: string;
}

const paymentMethods = [
  "SEPA,Revolut",
  "Swift,Wire",
  "Pix,Itau",
  "FasterPayments,Starling",
  "Wise,Business",
  "UPI,IMPS",
  "AliPay,UnionPay"
];
const MIN_OFFSET_SECONDS = 5;
const MAX_OFFSET_SECONDS = 2 * 24 * 60 * 60;

export function generateMockOffers(count = 18): OfferRow[] {
  const now = MOCK_NOW_MS;
  const random = createMockRng(`mock-offers:${count}`);

  const randomOffsetSeconds = () => {
    const span = MAX_OFFSET_SECONDS - MIN_OFFSET_SECONDS;
    const sample = random();
    return MIN_OFFSET_SECONDS + Math.floor(sample * span);
  };

  return Array.from({ length: count }).map((_, index) => {
    const side: DealSide = index % 2 === 0 ? "SELL" : "BUY";
    const tokenConfig = mockTokenConfigs[index % mockTokenConfigs.length];
    const fiatConfig = mockFiatCurrencies[index % mockFiatCurrencies.length];
    const minAmount = sampleAmountInRange(random(), tokenConfig.minAmountRange, tokenConfig.decimals);
    const rawMaxAmount = sampleAmountInRange(random(), tokenConfig.maxAmountRange, tokenConfig.decimals);
    const maxAmount = Number(
      ensureMaxAmount(rawMaxAmount, minAmount, tokenConfig.minMaxMultiplier).toFixed(tokenConfig.decimals)
    );
    const offsetSeconds = randomOffsetSeconds();
    const timestamp = new Date(now - offsetSeconds * 1_000).toISOString();

    return {
      id: index + 1,
      side,
      maker: `0xMaker${(index + 10).toString(16).padStart(2, "0")}`,
      token: tokenConfig.symbol,
      fiat: fiatConfig.code,
      price: computeTokenPriceInFiat(tokenConfig, fiatConfig, random()),
      minAmount,
      maxAmount,
      paymentMethods: paymentMethods[index % paymentMethods.length],
      updatedAt: timestamp
    };
  });
}
