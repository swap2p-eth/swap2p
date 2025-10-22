import type { Address } from "viem";
import { SwapDealState, SwapSide, type FiatCode } from "./types";

export type MockOfferSeed = {
  token: Address;
  maker: Address;
  side: SwapSide;
  fiat: FiatCode;
  minAmount: bigint;
  maxAmount: bigint;
  reserve: bigint;
  priceFiatPerToken: bigint;
  paymentMethods: string;
  requirements?: string;
  updatedHoursAgo: number;
};

export type MockDealSeed = {
  id: bigint;
  amount: bigint;
  price: bigint;
  state: SwapDealState;
  side: SwapSide;
  maker: Address;
  taker: Address;
  fiat: FiatCode;
  token: Address;
  requestedHoursAgo: number;
  updatedHoursAgo: number;
  paymentMethod: string;
  chat?: MockDealChatSeed[];
};

export type MockDealChatSeed = {
  toMaker: boolean;
  state: SwapDealState;
  payload: string;
  hoursAgo: number;
};

export type MockMakerSeed = {
  address: Address;
  online: boolean;
  lastActiveHoursAgo: number;
  requirements?: string;
  nickname?: string;
  dealsCancelled?: number;
  dealsCompleted?: number;
  chatPublicKey?: string;
};

export type MockAffiliateSeed = {
  taker: Address;
  partner: Address;
};

export const mockTokens = {
  usdt: "0x0000000000000000000000000000000000001000" as Address,
  usdc: "0x0000000000000000000000000000000000002000" as Address,
  dai: "0x0000000000000000000000000000000000003000" as Address,
};

export const mockMakers: MockMakerSeed[] = [
  {
    address: "0x00000000000000000000000000000000000000a1",
    online: true,
    lastActiveHoursAgo: 1,
    requirements: "ID + selfie",
    nickname: "p2p-alpha",
    dealsCompleted: 12,
  },
  {
    address: "0x00000000000000000000000000000000000000a2",
    online: true,
    lastActiveHoursAgo: 4,
    requirements: "Video call",
    nickname: "fx-pro",
    dealsCancelled: 2,
    dealsCompleted: 7,
  },
  {
    address: "0x00000000000000000000000000000000000000a3",
    online: false,
    lastActiveHoursAgo: 12,
    requirements: "",
    nickname: "",
  },
];

export const mockAffiliates: MockAffiliateSeed[] = [
  {
    taker: "0x00000000000000000000000000000000000000f1",
    partner: "0x0000000000000000000000000000000000000fab",
  },
];

const usd: FiatCode = 840;
const eur: FiatCode = 978;
const brl: FiatCode = 986;

export const mockOffers: MockOfferSeed[] = [
  {
    maker: mockMakers[0].address,
    token: mockTokens.usdt,
    side: SwapSide.SELL,
    fiat: usd,
    minAmount: 200n * 10n ** 6n,
    maxAmount: 5_000n * 10n ** 6n,
    reserve: 8_000n * 10n ** 6n,
    priceFiatPerToken: 100_500n,
    paymentMethods: "Wise, Revolut",
    requirements: "ID + selfie",
    updatedHoursAgo: 2,
  },
  {
    maker: mockMakers[0].address,
    token: mockTokens.usdc,
    side: SwapSide.BUY,
    fiat: eur,
    minAmount: 100n * 10n ** 6n,
    maxAmount: 2_500n * 10n ** 6n,
    reserve: 3_200n * 10n ** 6n,
    priceFiatPerToken: 99_800n,
    paymentMethods: "SEPA Instant, Revolut Business",
    requirements: "ID + selfie",
    updatedHoursAgo: 5,
  },
  {
    maker: mockMakers[1].address,
    token: mockTokens.usdt,
    side: SwapSide.SELL,
    fiat: brl,
    minAmount: 500n * 10n ** 6n,
    maxAmount: 6_000n * 10n ** 6n,
    reserve: 10_000n * 10n ** 6n,
    priceFiatPerToken: 502_000n,
    paymentMethods: "PIX, TED",
    requirements: "Video call",
    updatedHoursAgo: 8,
  },
  {
    maker: mockMakers[2].address,
    token: mockTokens.dai,
    side: SwapSide.SELL,
    fiat: usd,
    minAmount: 150n * 10n ** 18n,
    maxAmount: 4_000n * 10n ** 18n,
    reserve: 6_500n * 10n ** 18n,
    priceFiatPerToken: 100_000n,
    paymentMethods: "ACH, Zelle",
    requirements: "",
    updatedHoursAgo: 26,
  },
];

export const mockDeals: MockDealSeed[] = [
  {
    id: 1n,
    maker: mockMakers[0].address,
    taker: "0x00000000000000000000000000000000000000f1",
    token: mockTokens.usdt,
    side: SwapSide.SELL,
    fiat: usd,
    amount: 800n * 10n ** 6n,
    price: 100_800n,
    state: SwapDealState.REQUESTED,
    requestedHoursAgo: 6,
    updatedHoursAgo: 6,
    paymentMethod: "Wise",
  },
  {
    id: 2n,
    maker: mockMakers[1].address,
    taker: "0x00000000000000000000000000000000000000f2",
    token: mockTokens.usdt,
    side: SwapSide.BUY,
    fiat: brl,
    amount: 1_000n * 10n ** 6n,
    price: 505_000n,
    state: SwapDealState.ACCEPTED,
    requestedHoursAgo: 24,
    updatedHoursAgo: 10,
    paymentMethod: "PIX",
    chat: [
      {
        toMaker: false,
        state: SwapDealState.NONE,
        payload: "Client ready",
        hoursAgo: 12,
      },
    ],
  },
  {
    id: 3n,
    maker: mockMakers[0].address,
    taker: "0x00000000000000000000000000000000000000f3",
    token: mockTokens.usdc,
    side: SwapSide.BUY,
    fiat: eur,
    amount: 600n * 10n ** 6n,
    price: 99_900n,
    state: SwapDealState.PAID,
    requestedHoursAgo: 40,
    updatedHoursAgo: 3,
    paymentMethod: "SEPA",
  },
  {
    id: 4n,
    maker: mockMakers[2].address,
    taker: "0x00000000000000000000000000000000000000f4",
    token: mockTokens.dai,
    side: SwapSide.SELL,
    fiat: usd,
    amount: 300n * 10n ** 18n,
    price: 101_200n,
    state: SwapDealState.RELEASED,
    requestedHoursAgo: 120,
    updatedHoursAgo: 72,
    paymentMethod: "ACH",
    chat: [
      {
        toMaker: true,
        state: SwapDealState.NONE,
        payload: "Sent receipt",
        hoursAgo: 80,
      },
      {
        toMaker: false,
        state: SwapDealState.RELEASED,
        payload: "Funds confirmed",
        hoursAgo: 72,
      },
    ],
  },
  {
    id: 5n,
    maker: mockMakers[0].address,
    taker: "0x00000000000000000000000000000000000000f5",
    token: mockTokens.usdt,
    side: SwapSide.SELL,
    fiat: usd,
    amount: 500n * 10n ** 6n,
    price: 100_400n,
    state: SwapDealState.CANCELED,
    requestedHoursAgo: 96,
    updatedHoursAgo: 80,
    paymentMethod: "Revolut",
  },
];
