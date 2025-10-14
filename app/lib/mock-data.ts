export type DealSide = "BUY" | "SELL";
export type DealState = "REQUESTED" | "ACCEPTED" | "PAID";

export interface DealRow {
  id: number;
  side: DealSide;
  amount: number;
  fiatCode: string;
  partner: string | null;
  state: DealState;
  updatedLabel: string;
  maker: string;
  taker: string;
  token: string;
}

const stateCycle: DealState[] = ["REQUESTED", "ACCEPTED", "PAID"];
const fiatCycle = ["USD", "EUR", "GBP", "BRL"];
const tokenCycle = ["USDT", "ETH", "BTC", "USDC"];
const updatedLabels = [
  "Apr 08 • 10:12",
  "Apr 08 • 10:57",
  "Apr 08 • 11:33",
  "Apr 08 • 12:08",
  "Apr 08 • 13:42",
  "Apr 08 • 14:19",
  "Apr 08 • 15:26",
  "Apr 08 • 16:04"
];

export const mockDeals: DealRow[] = Array.from({ length: 24 }).map((_, index) => {
  const side: DealSide = index % 2 === 0 ? "SELL" : "BUY";
  return {
    id: index + 1,
    side,
    amount: Number((100 + index * 7.5).toFixed(2)),
    fiatCode: fiatCycle[index % fiatCycle.length],
    partner: index % 3 === 0 ? "0xPartner" : null,
    state: stateCycle[index % stateCycle.length],
    updatedLabel: updatedLabels[index % updatedLabels.length],
    maker: `0xMaker${(index + 16).toString(16).padStart(2, "0")}`,
    taker: `0xTaker${(index + 42).toString(16).padStart(2, "0")}`,
    token: tokenCycle[index % tokenCycle.length]
  };
});
