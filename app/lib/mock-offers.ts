import { createMockRng, MOCK_NOW_MS } from "@/lib/mock-clock";
import { CURRENT_USER_ADDRESS } from "@/lib/mock-user";
import type { DealSide } from "@/lib/mock-data";
import {
  computeTokenPriceInFiat,
  ensureMaxAmount,
  mockFiatCurrencies,
  mockTokenConfigs,
  quantizeAmount,
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

export function generateMockOffers(count = 32): OfferRow[] {
  const now = MOCK_NOW_MS;
  const minimumCount = 32;
  const totalCount = Math.max(count, minimumCount);
  const evenCount = totalCount % 2 === 0 ? totalCount : totalCount + 1;
  const random = createMockRng(`mock-offers:${evenCount}`);

  const randomOffsetSeconds = () => {
    const span = MAX_OFFSET_SECONDS - MIN_OFFSET_SECONDS;
    const sample = random();
    return MIN_OFFSET_SECONDS + Math.floor(sample * span);
  };

  return Array.from({ length: evenCount }).map((_, index) => {
    const side: DealSide = index % 2 === 0 ? "SELL" : "BUY";
    const tokenConfig = mockTokenConfigs[index % mockTokenConfigs.length];
    const fiatConfig = mockFiatCurrencies[index % mockFiatCurrencies.length];
    const minAmount = sampleAmountInRange(
      random(),
      tokenConfig.minAmountRange,
      tokenConfig.decimals,
      tokenConfig.minStep
    );
    const rawMaxAmount = sampleAmountInRange(
      random(),
      tokenConfig.maxAmountRange,
      tokenConfig.decimals,
      tokenConfig.maxStep ?? tokenConfig.minStep
    );
    const ensuredMax = ensureMaxAmount(rawMaxAmount, minAmount, tokenConfig.minMaxMultiplier);
    const maxAmount = quantizeAmount(
      ensuredMax,
      tokenConfig.maxStep ?? tokenConfig.minStep,
      tokenConfig.decimals,
      { mode: "ceil", min: minAmount, max: tokenConfig.maxAmountRange[1] }
    );
    const offsetSeconds = randomOffsetSeconds();
    const timestamp = new Date(now - offsetSeconds * 1_000).toISOString();

    const makerAddress = index < 6 ? CURRENT_USER_ADDRESS : `0xMaker${(index + 10).toString(16).padStart(2, "0")}`;
    return {
      id: index + 1,
      side,
      maker: makerAddress,
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
