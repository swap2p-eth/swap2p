import { createMockRng, MOCK_NOW_MS } from "@/lib/mock-clock";
import type { DealSide } from "@/lib/mock-data";

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

const tokenList = ["USDT", "ETH", "BTC", "DAI", "USDC"];
const fiatList = ["USD", "EUR", "CNY", "GBP", "BRL"];
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

const priceBase = 1.01;
const priceStep = 0.002;
const minBase = 500;
const minStep = 60;
const rangeWidth = 2200;

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
    const min = minBase + index * minStep;
    const max = min + rangeWidth;
    const offsetSeconds = randomOffsetSeconds();
    const timestamp = new Date(now - offsetSeconds * 1_000).toISOString();

    return {
      id: index + 1,
      side,
      maker: `0xMaker${(index + 10).toString(16).padStart(2, "0")}`,
      token: tokenList[index % tokenList.length],
      fiat: fiatList[index % fiatList.length],
      price: Number((priceBase + index * priceStep).toFixed(3)),
      minAmount: min,
      maxAmount: max,
      paymentMethods: paymentMethods[index % paymentMethods.length],
      updatedAt: timestamp
    };
  });
}
