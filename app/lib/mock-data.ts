import { createMockRng, MOCK_NOW_MS } from "@/lib/mock-clock";

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
const MIN_OFFSET_SECONDS = 5;
const MAX_OFFSET_SECONDS = 2 * 24 * 60 * 60;

const amountBase = 100;
const amountStep = 7.5;

export function generateMockDeals(count = 24): DealRow[] {
  const now = MOCK_NOW_MS;
  const random = createMockRng(`mock-deals:${count}`);

  const randomOffsetSeconds = () => {
    const span = MAX_OFFSET_SECONDS - MIN_OFFSET_SECONDS;
    const sample = random();
    return MIN_OFFSET_SECONDS + Math.floor(sample * span);
  };

  return Array.from({ length: count }).map((_, index) => {
    const side: DealSide = index % 2 === 0 ? "SELL" : "BUY";
    const offsetSeconds = randomOffsetSeconds();
    const timestamp = new Date(now - offsetSeconds * 1_000).toISOString();
    return {
      id: index + 1,
      side,
      amount: Number((amountBase + index * amountStep).toFixed(2)),
      fiatCode: fiatCycle[index % fiatCycle.length],
      partner: index % 3 === 0 ? "0xPartner" : null,
      state: stateCycle[index % stateCycle.length],
      updatedAt: timestamp,
      maker: `0xMaker${(index + 16).toString(16).padStart(2, "0")}`,
      taker: `0xTaker${(index + 42).toString(16).padStart(2, "0")}`,
      token: tokenCycle[index % tokenCycle.length]
    };
  });
}
