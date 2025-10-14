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
}

const now = new Date();

export const mockDeals: DealRow[] = Array.from({ length: 24 }).map((_, index) => {
  const side: DealSide = index % 2 === 0 ? "SELL" : "BUY";
  const stateCycle: DealState[] = ["REQUESTED", "ACCEPTED", "PAID"];
  return {
    id: index + 1,
    side,
    amount: Number((100 + index * 7.5).toFixed(2)),
    fiatCode: side === "SELL" ? "USD" : "EUR",
    partner: index % 3 === 0 ? "0xPartner" : null,
    state: stateCycle[index % stateCycle.length],
    updatedAt: addMinutes(subHours(now, index), index * 3)
  };
});
