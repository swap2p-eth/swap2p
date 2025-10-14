import { addMinutes, subMinutes } from "date-fns";
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
  updatedAt: Date;
}

const now = new Date();

export const mockOffers: OfferRow[] = Array.from({ length: 18 }).map((_, index) => {
  const side: DealSide = index % 2 === 0 ? "SELL" : "BUY";
  const tokenList = ["USDT", "ETH", "BTC", "DAI", "USDC"];
  const fiatList = ["USD", "EUR", "CNY", "GBP", "BRL"];
  const paymentMethods = [
    "SEPA, Revolut",
    "Swift wire",
    "Pix",
    "Faster Payments",
    "Wise",
    "UPI",
    "AliPay"
  ];

  const min = 500 + index * 50;
  const max = min + 2500;

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
    updatedAt: addMinutes(subMinutes(now, index * 11), index * 2)
  };
});
