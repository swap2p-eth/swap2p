export type DealSide = "BUY" | "SELL";

export type DealState = "REQUESTED" | "ACCEPTED" | "PAID" | "RELEASED" | "CANCELED";

export interface OfferRow {
  id: string;
  side: DealSide;
  maker: string;
  token: string;
  tokenDecimals: number;
  fiat: string;
  price: number;
  minAmount: number;
  maxAmount: number;
  paymentMethods: string;
  requirements?: string;
  updatedAt: string;
  contractKey?: import("@/lib/swap2p/types").OfferKey;
  contract?: import("@/lib/swap2p/types").Offer;
  contractFiatCode?: number;
  contractId?: string;
}

export interface DealRow {
  id: string;
  side: DealSide;
  amount: number;
  fiatCode: string;
  partner: string | null;
  state: DealState;
  updatedAt: string;
  maker: string;
  taker: string;
  token: string;
  tokenDecimals: number;
  price?: number;
  fiatAmount?: number;
  paymentMethod?: string;
  contractId?: bigint;
  contract?: import("@/lib/swap2p/types").Deal;
}
