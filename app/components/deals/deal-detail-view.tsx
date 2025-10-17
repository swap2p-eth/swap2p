"use client";

import Jazzicon from "react-jazzicon";

import { ChatWidget } from "@/components/chat/chat-widget";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FiatFlag } from "@/components/fiat-flag";
import { TokenIcon } from "@/components/token-icon";
import { cn, formatAddressShort, seedFromAddress } from "@/lib/utils";
import { DealHeader } from "./deal-header";
import { DealSummaryCard } from "./deal-summary-card";
import { useDeals } from "./deals-provider";
import { RelativeTime } from "@/components/relative-time";
import { mockTokenConfigs, mockFiatCurrencies, computeTokenPriceInFiat } from "@/lib/mock-market";
import { createMockRng } from "@/lib/mock-clock";
import { CURRENT_USER_ADDRESS } from "@/lib/mock-user";

const sideCopy = {
  BUY: {
    headline: "Maker is buying tokens",
    tone: "Counterparty wires fiat after escrow."
  },
  SELL: {
    headline: "Maker is selling tokens",
    tone: "Taker wires fiat after seeing escrowed funds."
  }
} as const;

export interface DealDetailViewProps {
  dealId: number;
  onBack?: () => void;
}

export function DealDetailView({ dealId, onBack }: DealDetailViewProps) {
  const { deals, isLoading } = useDeals();
  const deal = deals.find(item => item.id === dealId);

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-8">
        <Skeleton className="h-10 w-40 rounded-full" />
        <div className="space-y-6">
          <Skeleton className="h-12 w-2/3 rounded-full" />
          <Skeleton className="h-40 w-full rounded-3xl" />
        </div>
        <Skeleton className="h-[360px] w-full rounded-3xl" />
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-12 text-center sm:px-8">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Deal not found</h1>
        <p className="text-sm text-muted-foreground">
          The requested deal is not part of the dataset yet. Try returning to the deals overview.
        </p>
        <Button type="button" className="mx-auto rounded-full px-6" onClick={onBack}>
          Back to deals
        </Button>
      </div>
    );
  }

  const summary = sideCopy[deal.side];
  const counterpartyValue = formatAddressShort(deal.taker);
  const counterpartySeed = seedFromAddress(deal.taker);
  const isMaker = deal.maker.toLowerCase() === CURRENT_USER_ADDRESS.toLowerCase();
  const userSide = isMaker ? deal.side : deal.side === "SELL" ? "BUY" : "SELL";
  const yourSideLabel = userSide === "SELL" ? "You SELL crypto" : "You BUY crypto";
  const tokenConfig = mockTokenConfigs.find(config => config.symbol === deal.token);
  const fiatConfig = mockFiatCurrencies.find(config => config.code === deal.fiatCode);
  const varianceSample = createMockRng(`deal-overview:${deal.id}`)();
  const pricePerToken = tokenConfig && fiatConfig ? computeTokenPriceInFiat(tokenConfig, fiatConfig, varianceSample) : null;
  const fiatAmount = pricePerToken ? deal.amount * pricePerToken : null;
  const fiatAmountLabel = fiatAmount
    ? `${fiatAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${deal.fiatCode}`
    : `— ${deal.fiatCode}`;
  const priceLabel = pricePerToken
    ? `${pricePerToken.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${deal.fiatCode} / ${deal.token}`
    : "—";

  const tokenDecimals = tokenConfig?.decimals ?? 4;
  const tokenAmountLabel = `${deal.amount.toLocaleString("en-US", {
    minimumFractionDigits: Math.min(2, tokenDecimals),
    maximumFractionDigits: tokenDecimals
  })} ${deal.token}`;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-8">
      <DealHeader
        title={`Deal #${deal.id}`}
        subtitle={summary.headline}
        badge={deal.state}
        backLabel="Back to deals"
        onBack={onBack}
      />

      <DealSummaryCard
        title="Deal overview"
        description={<p className="text-sm text-muted-foreground">{summary.tone}</p>}
        pills={[
          {
            id: "counterparty",
            className:
              "bg-transparent px-0 py-0 shadow-none text-secondary-foreground flex flex-col items-end gap-1 text-right",
            content: (
              <>
                <span className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground/70">
                  Counterparty
                </span>
                <span className="flex items-center justify-end gap-2 text-sm font-medium text-foreground">
                  <Jazzicon diameter={20} seed={counterpartySeed} />
                  {counterpartyValue}
                </span>
              </>
            )
          }
        ]}
        metaItems={[
          { id: "side", label: "Your Side", value: yourSideLabel },
          {
            id: "token",
            label: "Token",
            value: (
              <span className="flex items-center gap-3">
                <TokenIcon symbol={deal.token} size={18} />
                <span className="text-sm font-medium text-foreground">{tokenAmountLabel}</span>
              </span>
            )
          },
          {
            id: "fiat",
            label: "Fiat",
            value: (
              <span className="flex items-center gap-3">
                <FiatFlag fiat={deal.fiatCode} size={18} />
                <span className="text-sm font-medium text-foreground">≈ {fiatAmountLabel}</span>
              </span>
            )
          },
          {
            id: "price",
            label: "Price",
            value: priceLabel
          }
        ]}
        extraContent={
          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">Deal context</span>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span>
                Last update: <RelativeTime value={deal.updatedAt} className="text-sm text-muted-foreground" />
              </span>
              <span>Counterparty: {formatAddressShort(deal.taker)}</span>
            </div>
          </div>
        }
      />

      <div className="rounded-3xl bg-card/60 p-6 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.45)] backdrop-blur">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Chat</h2>
          <p className="text-sm text-muted-foreground">
            Secure coordination channel. Messages will be encrypted and stored as bytes on-chain.
          </p>
        </div>
        <ChatWidget className={cn("min-h-[360px]", "bg-transparent shadow-none")} />
      </div>
    </div>
  );
}
