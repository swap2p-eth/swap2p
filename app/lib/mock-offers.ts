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
const updatedAgoMinutes = [3, 9, 22, 35, 61, 140, 280];
const now = Date.now();

export const mockOffers: OfferRow[] = Array.from({ length: 18 }).map((_, index) => {
  const side: DealSide = index % 2 === 0 ? "SELL" : "BUY";
  const min = 500 + index * 60;
  const max = min + 2200;
  const offsetMinutes = updatedAgoMinutes[index % updatedAgoMinutes.length];
  const timestamp = new Date(now - offsetMinutes * 60_000).toISOString();

  return {
    id: index + 1,
    side,
    maker: `0xMaker${(index + 10).toString(16).padStart(2, "0")}`,
    token: tokenList[index % tokenList.length],
    fiat: fiatList[index % fiatList.length],
    price: Number((1.01 + index * 0.002).toFixed(3)),
    minAmount: min,
    maxAmount: max,
    paymentMethods: paymentMethods[index % paymentMethods.length],
    updatedAt: timestamp
  };
});
