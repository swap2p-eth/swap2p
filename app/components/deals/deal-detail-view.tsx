"use client";

import { ChatWidget } from "@/components/chat/chat-widget";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { DealHeader } from "./deal-header";
import { DealSummaryCard } from "./deal-summary-card";
import { DealStatusPanel } from "./deal-status-panel";
import { useDeals } from "./deals-provider";
import { RelativeTime } from "@/components/relative-time";
import { ParticipantPill } from "@/components/deals/participant-pill";
import { buildDealMetaItems } from "@/hooks/use-deal-meta";
import { PriceMetaValue } from "@/components/deals/price-meta-value";
import { useDealPerspective } from "@/hooks/use-deal-perspective";
import { useUser } from "@/context/user-context";
import { formatFiatAmount, formatPrice, formatTokenAmount } from "@/lib/number-format";
import { getDealSideCopy } from "@/lib/deal-copy";
import type { ApprovalMode } from "./token-approval-button";

export interface DealDetailViewProps {
  dealId: string;
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
  const { address } = useUser();
  const perspective = useDealPerspective(deal ?? null, address);

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

  const summary = getDealSideCopy(deal.side);
  const role = perspective.role ?? "MAKER";
  const isMaker = perspective.isMaker;
  const userSide = (perspective.userSide ?? deal.side).toUpperCase();
  const userAction = userSide === "SELL" ? "sell" : "buy";
  const pricePerToken = typeof deal.price === "number" ? deal.price : null;
  const fiatAmount =
    typeof deal.fiatAmount === "number"
      ? deal.fiatAmount
      : pricePerToken !== null
        ? pricePerToken * deal.amount
        : null;
  const priceValue = pricePerToken !== null ? formatPrice(pricePerToken) : null;

  const tokenDecimals = deal.tokenDecimals ?? 4;
  const tokenAmountValue = formatTokenAmount(deal.amount, tokenDecimals);
  const fiatAmountFormatted = fiatAmount ? formatFiatAmount(fiatAmount) : null;
  const metaFiatLabel = fiatAmountFormatted ? `≈ ${fiatAmountFormatted} ${deal.currencyCode}` : "—";

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

  const metaItems = buildDealMetaItems({
    userSide,
    userActionDescription: `You ${userAction} crypto`,
    tokenSymbol: deal.token,
    tokenAmountLabel: tokenAmountValue,
    countryCode: deal.countryCode,
    fiatLabel: deal.fiat,
    fiatSymbol: deal.currencyCode,
    fiatAmountLabel: metaFiatLabel,
    priceValue: priceValue ? (
      <PriceMetaValue priceLabel={priceValue} fiatSymbol={deal.currencyCode} tokenSymbol={deal.token} />
    ) : undefined
  });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-8">
      <DealHeader
        title="Deal"
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
{/*          <p className="text-sm text-muted-foreground">
            Secure coordination channel. Messages will be encrypted and stored as bytes on-chain.
          </p>*/}
        </div>
        <ChatWidget
          className={cn("min-h-[360px]", "bg-transparent shadow-none")}
          dealState={deal.state}
        />
      </div>
    </div>
  );
}
