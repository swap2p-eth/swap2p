import type { DealRow, DealSide, DealState } from "@/lib/mock-data";

export type DealUserRole = "MAKER" | "TAKER";

export interface DealPerspective {
  role: DealUserRole | null;
  userSide: DealSide | null;
  isMaker: boolean;
}

export const normalizeAddress = (value: string | null | undefined) => value?.toLowerCase() ?? "";

export const invertSide = (side: DealSide): DealSide => (side === "BUY" ? "SELL" : "BUY");

export const toUserSide = (side: DealSide, role: DealUserRole): DealSide =>
  role === "MAKER" ? side : invertSide(side);

export function getDealPerspective(deal: DealRow, currentUser: string): DealPerspective {
  const normalizedUser = normalizeAddress(currentUser);
  const makerMatch = normalizeAddress(deal.maker) === normalizedUser;
  if (makerMatch) {
    return { role: "MAKER", userSide: deal.side, isMaker: true };
  }

  const takerMatch = normalizeAddress(deal.taker) === normalizedUser;
  if (takerMatch) {
    return { role: "TAKER", userSide: toUserSide(deal.side, "TAKER"), isMaker: false };
  }

  return { role: null, userSide: null, isMaker: false };
}

export const isActiveDealState = (state: DealState) => state === "REQUESTED" || state === "ACCEPTED" || state === "PAID";

export const isClosedDealState = (state: DealState) => state === "RELEASED" || state === "CANCELED";
