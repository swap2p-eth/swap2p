import { CURRENT_USER_ADDRESS } from "@/lib/mock-user";
import { createMockRng, MOCK_NOW_MS } from "@/lib/mock-clock";
import { mockFiatCurrencies, mockTokenConfigs, sampleAmountInRange } from "@/lib/mock-market";

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
const fiatCycle = mockFiatCurrencies.map((fiat) => fiat.code);
const tokenCycle = mockTokenConfigs.map((token) => token.symbol);
const MIN_OFFSET_SECONDS = 5;
const MAX_OFFSET_SECONDS = 2 * 24 * 60 * 60;

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
    const tokenConfig = mockTokenConfigs[index % mockTokenConfigs.length];
    const amount = sampleAmountInRange(
      random(),
      [tokenConfig.minAmountRange[0], tokenConfig.maxAmountRange[1]],
      tokenConfig.decimals,
      tokenConfig.maxStep ?? tokenConfig.minStep
    );

    const isUserDeal = index < 5;
    const makerAddress = isUserDeal ? CURRENT_USER_ADDRESS : `0xMaker${(index + 16).toString(16).padStart(2, "0")}`;
    const takerAddress = isUserDeal ? `0xCounterparty${(index + 21).toString(16).padStart(2, "0")}` : `0xTaker${(index + 42).toString(16).padStart(2, "0")}`;

    return {
      id: index + 1,
      side,
      amount,
      fiatCode: fiatCycle[index % fiatCycle.length],
      partner: index % 3 === 0 ? "0xPartner" : null,
      state: stateCycle[index % stateCycle.length],
      updatedAt: timestamp,
      maker: makerAddress,
      taker: takerAddress,
      token: tokenCycle[index % tokenCycle.length]
    };
  });
}
