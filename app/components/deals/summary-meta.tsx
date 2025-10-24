import type { ReactNode } from "react";
import { TokenAmountCell } from "@/components/deals/token-amount-cell";
import { FiatAmountCell } from "@/components/deals/fiat-amount-cell";
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
    value: <TokenAmountCell token={token} amountLabel={amountLabel} mutedToken />
  };
}

export function createFiatMetaItem({
  id = "fiat",
  countryCode,
  label,
  amountLabel
}: {
  id?: string;
  countryCode: string;
  label: string;
  amountLabel: string;
}): SummaryMetaItem {
  return {
    id,
    label: "Fiat",
    value: <FiatAmountCell countryCode={countryCode} label={label} amountLabel={amountLabel} />
  };
}
