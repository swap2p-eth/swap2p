import { addMinutes, subHours } from "date-fns";

export type DealSide = "BUY" | "SELL";
export type DealState = "REQUESTED" | "ACCEPTED" | "PAID";

export interface DealRow {
  id: number;
  side: DealSide;
  amount: number;
  fiatCode: string;
  partner: string | null;
  state: DealState;
  updatedAt: Date;
  maker: string;
  taker: string;
  token: string;
}

const now = new Date();

export const mockDeals: DealRow[] = Array.from({ length: 24 }).map((_, index) => {
  const side: DealSide = index % 2 === 0 ? "SELL" : "BUY";
  const stateCycle: DealState[] = ["REQUESTED", "ACCEPTED", "PAID"];
  const tokens = ["USDT", "ETH", "BTC", "USDC"];
  return {
    id: index + 1,
    side,
    amount: Number((100 + index * 7.5).toFixed(2)),
    fiatCode: side === "SELL" ? "USD" : "EUR",
    partner: index % 3 === 0 ? "0xPartner" : null,
    state: stateCycle[index % stateCycle.length],
    updatedAt: addMinutes(subHours(now, index), index * 3),
    maker: `0xMaker${(index + 16).toString(16).padStart(2, "0")}`,
    taker: `0xTaker${(index + 42).toString(16).padStart(2, "0")}`,
    token: tokens[index % tokens.length]
  };
});
