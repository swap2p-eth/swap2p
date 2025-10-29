import { formatUnits } from "viem";

import type { Offer } from "@/lib/swap2p/types";
import type { OfferRow } from "@/lib/types/market";

const PRICE_SCALE = 1_000_000;

export function mergeOfferWithOnchain(
  base: OfferRow,
  onchain: Offer,
  tokenDecimals: number
): OfferRow {
  const updatedAt =
    onchain.updatedAt && onchain.updatedAt > 0
      ? new Date(onchain.updatedAt * 1000).toISOString()
      : base.updatedAt;

  return {
    ...base,
    price: Number(onchain.priceFiatPerToken) / PRICE_SCALE,
    minAmount: Number(formatUnits(onchain.minAmount, tokenDecimals)),
    maxAmount: Number(formatUnits(onchain.maxAmount, tokenDecimals)),
    paymentMethods: onchain.paymentMethods ?? "",
    requirements: onchain.requirements ?? "",
    updatedAt,
    contract: onchain
  };
}
