"use client";

import { ChatWidget } from "@/components/chat/chat-widget";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatAddressShort } from "@/lib/utils";
import { DealHeader } from "./deal-header";
import { DealSummaryCard } from "./deal-summary-card";
import { DealStatusPanel } from "./deal-status-panel";
import { useDeals } from "./deals-provider";
import { RelativeTime } from "@/components/relative-time";
import { mockTokenConfigs, mockFiatCurrencies, computeTokenPriceInFiat } from "@/lib/mock-market";
import { createMockRng } from "@/lib/mock-clock";
import { ParticipantPill } from "@/components/deals/participant-pill";
import { createFiatMetaItem, createSideMetaItem, createTokenMetaItem } from "@/components/deals/summary-meta";
import { CURRENT_USER_ADDRESS } from "@/lib/mock-user";
import type { ApprovalMode } from "./token-approval-button";

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
  const {
    deals,
    isLoading,
    acceptDeal,
    cancelDeal,
    markDealPaid,
    releaseDeal
  } = useDeals();
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
  const isMaker = deal.maker.toLowerCase() === CURRENT_USER_ADDRESS.toLowerCase();
  const role = isMaker ? "MAKER" : "TAKER";
  const userSide = (isMaker ? deal.side : deal.side === "SELL" ? "BUY" : "SELL").toUpperCase();
  const userAction = userSide === "SELL" ? "sell" : "buy";
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

  const fiatAmountDisplay = fiatAmount ? `≈ ${fiatAmountLabel}` : fiatAmountLabel;

  const counterpartyLabel = isMaker ? "Client" : "Merchant";
  const counterpartyAddress = isMaker ? deal.taker : deal.maker;

  const handleApproveTokens = (mode: ApprovalMode) => {
    void mode;
    // Token allowance integration can be added here.
  };

  const handleAccept = (message: string) => {
    void message;
    acceptDeal(deal.id);
  };

  const handleCancel = (message: string) => {
    void message;
    cancelDeal(deal.id, role);
  };

  const handleMarkPaid = (message: string) => {
    void message;
    markDealPaid(deal.id, role);
  };

  const handleRelease = (message: string) => {
    void message;
    releaseDeal(deal.id, role);
  };

  const metaItems = [
    createSideMetaItem({
      id: "your-side",
      label: "Your Side",
      side: userSide,
      description: `You ${userAction} crypto`
    }),
    createTokenMetaItem({ token: deal.token, amountLabel: tokenAmountLabel }),
    createFiatMetaItem({ fiat: deal.fiatCode, amountLabel: fiatAmountDisplay }),
    { id: "price", label: "Price", value: priceLabel }
  ];

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
        description={<span className="text-sm text-muted-foreground">{summary.tone}</span>}
        pills={[
          {
            id: "counterparty",
            className:
              "bg-transparent px-0 py-0 shadow-none text-secondary-foreground flex flex-col items-end gap-1 text-right",
            content: <ParticipantPill label={counterpartyLabel} address={counterpartyAddress} />
          }
        ]}
        metaItems={metaItems}
        extraContent={
          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">Deal context</span>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span>
                Last update: <RelativeTime value={deal.updatedAt} className="text-sm text-muted-foreground" />
              </span>
              <span>
                {counterpartyLabel}: {formatAddressShort(counterpartyAddress)}
              </span>
            </div>
          </div>
        }
      />

      <DealStatusPanel
        state={deal.state}
        side={deal.side}
        role={role}
        onAccept={isMaker ? handleAccept : undefined}
        onCancel={handleCancel}
        onMarkPaid={handleMarkPaid}
        onRelease={handleRelease}
        onApproveTokens={handleApproveTokens}
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
