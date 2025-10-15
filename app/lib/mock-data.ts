export type DealSide = "BUY" | "SELL";
export type DealState = "REQUESTED" | "ACCEPTED" | "PAID";

export interface DealRow {
  id: number;
  side: DealSide;
  amount: number;
  fiatCode: string;
  partner: string | null;
  state: DealState;
  updatedAt: string;
  maker: string;
  taker: string;
  token: string;
}

const stateCycle: DealState[] = ["REQUESTED", "ACCEPTED", "PAID"];
const fiatCycle = ["USD", "EUR", "GBP", "BRL"];
const tokenCycle = ["USDT", "ETH", "BTC", "USDC"];

const updatedAgoMinutes = [5, 12, 25, 48, 95, 180, 240, 360];
const now = Date.now();

export const mockDeals: DealRow[] = Array.from({ length: 24 }).map((_, index) => {
  const side: DealSide = index % 2 === 0 ? "SELL" : "BUY";
  const offsetMinutes = updatedAgoMinutes[index % updatedAgoMinutes.length];
  const timestamp = new Date(now - offsetMinutes * 60_000).toISOString();
  return {
    id: index + 1,
    side,
    amount: Number((100 + index * 7.5).toFixed(2)),
    fiatCode: fiatCycle[index % fiatCycle.length],
    partner: index % 3 === 0 ? "0xPartner" : null,
    state: stateCycle[index % stateCycle.length],
    updatedAt: timestamp,
    maker: `0xMaker${(index + 16).toString(16).padStart(2, "0")}`,
    taker: `0xTaker${(index + 42).toString(16).padStart(2, "0")}`,
    token: tokenCycle[index % tokenCycle.length]
  };
});
