import { CURRENT_USER_ADDRESS } from "@/lib/mock-user";
import { createMockRng, MOCK_NOW_MS } from "@/lib/mock-clock";
import { mockFiatCurrencies, mockTokenConfigs, sampleAmountInRange } from "@/lib/mock-market";

export type DealSide = "BUY" | "SELL";
export type DealState = "REQUESTED" | "ACCEPTED" | "PAID" | "RELEASED" | "CANCELED";

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

const stateCycle: DealState[] = ["REQUESTED", "ACCEPTED", "PAID", "RELEASED", "CANCELED"];
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

  const deals: DealRow[] = [];

  const addressFor = (label: string, value: number) => `0x${label}${value.toString(16).padStart(2, "0")}`;

  const createAmount = (tokenConfigIndex: number) => {
    const tokenConfig = mockTokenConfigs[tokenConfigIndex % mockTokenConfigs.length];
    return sampleAmountInRange(
      random(),
      [tokenConfig.minAmountRange[0], tokenConfig.maxAmountRange[1]],
      tokenConfig.decimals,
      tokenConfig.maxStep ?? tokenConfig.minStep
    );
  };

  const invertSide = (side: DealSide): DealSide => (side === "BUY" ? "SELL" : "BUY");

  const ACTIVE_STATES: DealState[] = ["REQUESTED", "ACCEPTED", "PAID"];
  const CLOSED_STATES: DealState[] = ["RELEASED", "CANCELED"];
  const USER_ROLES: Array<"MAKER" | "TAKER"> = ["MAKER", "TAKER"];
  const USER_SIDES: DealSide[] = ["SELL", "BUY"];

  const userCombos: Array<{ role: "MAKER" | "TAKER"; userSide: DealSide; state: DealState }> = [];

  for (const role of USER_ROLES) {
    for (const userSide of USER_SIDES) {
      for (const state of ACTIVE_STATES) {
        userCombos.push({ state, role, userSide });
      }
    }
  }

  for (const state of CLOSED_STATES) {
    for (const role of USER_ROLES) {
      for (const userSide of USER_SIDES) {
        userCombos.push({ state, role, userSide });
      }
    }
  }

  const ensuredCount = Math.max(count, userCombos.length);

  for (const combo of userCombos) {
    const index = deals.length;
    const makerSide = combo.role === "MAKER" ? combo.userSide : invertSide(combo.userSide);
    const offsetSeconds = randomOffsetSeconds();
    const timestamp = new Date(now - offsetSeconds * 1_000).toISOString();
    const tokenIndex = index % mockTokenConfigs.length;
    const tokenConfig = mockTokenConfigs[tokenIndex];
    const amount = createAmount(tokenIndex);
    const maker =
      combo.role === "MAKER" ? CURRENT_USER_ADDRESS : addressFor("Merchant", index + 64);
    const taker =
      combo.role === "MAKER" ? addressFor("Client", index + 21) : CURRENT_USER_ADDRESS;
    const partnerAddress = combo.role === "MAKER" ? taker : maker;

    deals.push({
      id: index + 1,
      side: makerSide,
      amount,
      fiatCode: fiatCycle[index % fiatCycle.length],
      partner: partnerAddress,
      state: combo.state,
      updatedAt: timestamp,
      maker,
      taker,
      token: tokenConfig.symbol
    });
  }

  while (deals.length < ensuredCount) {
    const index = deals.length;
    const side: DealSide = index % 2 === 0 ? "SELL" : "BUY";
    const offsetSeconds = randomOffsetSeconds();
    const timestamp = new Date(now - offsetSeconds * 1_000).toISOString();
    const tokenIndex = index % mockTokenConfigs.length;
    const amount = createAmount(tokenIndex);

    deals.push({
      id: index + 1,
      side,
      amount,
      fiatCode: fiatCycle[index % fiatCycle.length],
      partner: index % 3 === 0 ? "0xPartner" : null,
      state: stateCycle[index % stateCycle.length],
      updatedAt: timestamp,
      maker: addressFor("Maker", index + 16),
      taker: addressFor("Taker", index + 42),
      token: tokenCycle[index % tokenCycle.length]
    });
  }

  return deals;
}
