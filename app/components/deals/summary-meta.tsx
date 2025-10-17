import type { ReactNode } from "react";
import { TokenIcon } from "@/components/token-icon";
import { FiatFlag } from "@/components/fiat-flag";
import { SideSummaryRow } from "@/components/deals/side-summary-row";

export type SummaryMetaItem = {
  id: string;
  label: string;
  value: ReactNode;
};

export function createSideMetaItem({
  id = "side",
  label,
  side,
  description
}: {
  id?: string;
  label: string;
  side: string;
  description: string;
}): SummaryMetaItem {
  return {
    id,
    label,
    value: <SideSummaryRow side={side} description={description} />
  };
}

export function createTokenMetaItem({
  id = "token",
  token,
  amountLabel
}: {
  id?: string;
  token: string;
  amountLabel: string;
}): SummaryMetaItem {
  return {
    id,
    label: "Token",
    value: (
      <span className="flex items-center gap-3 text-sm text-foreground">
        <TokenIcon symbol={token} size={18} />
        <span className="font-medium">{amountLabel}</span>
      </span>
    )
  };
}

export function createFiatMetaItem({
  id = "fiat",
  fiat,
  amountLabel
}: {
  id?: string;
  fiat: string;
  amountLabel: string;
}): SummaryMetaItem {
  return {
    id,
    label: "Fiat",
    value: (
      <span className="flex items-center gap-3 text-sm text-foreground">
        <FiatFlag fiat={fiat} size={18} />
        <span className="font-medium">{amountLabel}</span>
      </span>
    )
  };
}
