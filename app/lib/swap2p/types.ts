import type {
  Address,
  Hash,
} from "viem";

export type FiatCode = number;

export enum SwapSide {
  BUY = 0,
  SELL = 1,
}

export enum SwapDealState {
  NONE = 0,
  REQUESTED = 1,
  ACCEPTED = 2,
  PAID = 3,
  RELEASED = 4,
  CANCELED = 5,
}

export type OfferFilter = {
  token: Address;
  side: SwapSide;
  fiat: FiatCode;
};

export type OfferKey = OfferFilter & {
  maker: Address;
};

export type Offer = {
  minAmount: bigint;
  maxAmount: bigint;
  reserve: bigint;
  priceFiatPerToken: bigint;
  fiat: FiatCode;
  side: SwapSide;
  token: Address;
  paymentMethods: string;
  requirements: string;
  updatedAt: number;
  maker: Address;
};

export type OfferWithKey = {
  key: OfferKey;
  offer: Offer;
};

export type Deal = {
  id: bigint;
  amount: bigint;
  price: bigint;
  state: SwapDealState;
  side: SwapSide;
  maker: Address;
  taker: Address;
  fiat: FiatCode;
  requestedAt: number;
  updatedAt: number;
  token: Address;
};

export type MakerProfile = {
  online: boolean;
  lastActivity: number;
  nickname: string;
  dealsCancelled: number;
  dealsCompleted: number;
};

export type PaginationArgs = {
  offset?: number;
  limit?: number;
};

export type DealsQuery = PaginationArgs & {
  user: Address;
};

export type SetOnlineArgs = {
  account: Address;
  online: boolean;
};

export type MakerMakeOfferArgs = OfferFilter & {
  account: Address;
  price: bigint;
  reserve: bigint;
  minAmount: bigint;
  maxAmount: bigint;
  paymentMethods: string;
  requirements?: string;
  comment?: string;
};

export type MakerDeleteOfferArgs = OfferKey & {
  account: Address;
};

export type TakerRequestOfferArgs = OfferFilter & {
  account: Address;
  maker: Address;
  amount: bigint;
  expectedPrice: bigint;
  details?: string;
  partner?: Address | null;
};

export type MakerAcceptRequestArgs = {
  account: Address;
  id: bigint;
  message?: string;
};

export type CancelRequestArgs = {
  account: Address;
  id: bigint;
  reason?: string;
};

export type CancelDealArgs = {
  account: Address;
  id: bigint;
  reason?: string;
};

export type SetNicknameArgs = {
  account: Address;
  nickname: string;
};

export type MarkFiatPaidArgs = {
  account: Address;
  id: bigint;
  message?: string;
};

export type ReleaseDealArgs = {
  account: Address;
  id: bigint;
  message?: string;
};

export type SendMessageArgs = {
  account: Address;
  id: bigint;
  message: string;
};

export type CleanupDealsArgs = {
  account: Address;
  ids: bigint[];
  minAgeHours: number;
};

export type Swap2pWriteResult = Hash;

export type Swap2pAdapterMode = "viem" | "mock";

export interface Swap2pAdapter {
  readonly mode: Swap2pAdapterMode;
  readonly address: Address | null;
  getOfferCount(filter: OfferFilter): Promise<number>;
  getOfferKeys(filter: OfferFilter & PaginationArgs): Promise<OfferKey[]>;
  getOffer(key: OfferKey): Promise<Offer | null>;
  getOffers(filter: OfferFilter & PaginationArgs): Promise<OfferWithKey[]>;
  getDeal(id: bigint): Promise<Deal | null>;
  getOpenDeals(query: DealsQuery): Promise<Deal[]>;
  getRecentDeals(query: DealsQuery): Promise<Deal[]>;
  getMakerProfile(address: Address): Promise<MakerProfile | null>;
  getMakerProfiles(addresses: Address[]): Promise<MakerProfile[]>;
  setOnline(args: SetOnlineArgs): Promise<Swap2pWriteResult>;
  setNickname(args: SetNicknameArgs): Promise<Swap2pWriteResult>;
  makerMakeOffer(args: MakerMakeOfferArgs): Promise<Swap2pWriteResult>;
  makerDeleteOffer(args: MakerDeleteOfferArgs): Promise<Swap2pWriteResult>;
  takerRequestOffer(args: TakerRequestOfferArgs): Promise<Swap2pWriteResult>;
  makerAcceptRequest(args: MakerAcceptRequestArgs): Promise<Swap2pWriteResult>;
  cancelRequest(args: CancelRequestArgs): Promise<Swap2pWriteResult>;
  cancelDeal(args: CancelDealArgs): Promise<Swap2pWriteResult>;
  markFiatPaid(args: MarkFiatPaidArgs): Promise<Swap2pWriteResult>;
  release(args: ReleaseDealArgs): Promise<Swap2pWriteResult>;
  sendMessage(args: SendMessageArgs): Promise<Swap2pWriteResult>;
  cleanupDeals(args: CleanupDealsArgs): Promise<Swap2pWriteResult>;
}
