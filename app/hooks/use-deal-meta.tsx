import type { ReactNode } from "react";

import { createFiatMetaItem, createSideMetaItem, createTokenMetaItem } from "@/components/deals/summary-meta";

export interface DealMetaConfig {
  userSide: string;
  userActionDescription: string;
  tokenSymbol: string;
  tokenAmountLabel: string;
  countryCode: string;
  fiatLabel: string;
  fiatSymbol: string;
  fiatAmountLabel: string;
  priceValue?: ReactNode;
}

export function buildDealMetaItems({
  userSide,
  userActionDescription,
  tokenSymbol,
  tokenAmountLabel,
  countryCode,
  fiatLabel,
  fiatSymbol,
  fiatAmountLabel,
  priceValue
}: DealMetaConfig) {
  const items = [
    createSideMetaItem({
      id: "your-side",
      label: "Your Side",
      side: userSide,
      description: userActionDescription
    }),
    createTokenMetaItem({ token: tokenSymbol, amountLabel: tokenAmountLabel }),
    createFiatMetaItem({ countryCode, label: fiatLabel, amountLabel: fiatAmountLabel })
  ];

  if (priceValue) {
    items.push({ id: "price", label: "Price", value: priceValue });
  }

  return items;
}
