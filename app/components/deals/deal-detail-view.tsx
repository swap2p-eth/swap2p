"use client";

import { ArrowUpRight, Coins, Wallet } from "lucide-react";

import { ChatWidget } from "@/components/chat/chat-widget";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FiatFlag } from "@/components/fiat-flag";
import { TokenIcon } from "@/components/token-icon";
import { cn } from "@/lib/utils";
import { DealHeader } from "./deal-header";
import { DealSummaryCard } from "./deal-summary-card";
import { useDeals } from "./deals-provider";
import { RelativeTime } from "@/components/relative-time";

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
        title="Settlement overview"
        description={summary.tone}
        pills={[
          {
            id: "amount",
            className: "bg-primary/10 text-primary",
            content: (
              <>
                <Coins className="h-4 w-4" />
                {deal.amount.toLocaleString("en-US")}
                <TokenIcon symbol={deal.token} size={18} className="rounded-full bg-white" />
                <span className="text-xs uppercase">{deal.token}</span>
              </>
            )
          },
          {
            id: "maker",
            className: "bg-secondary text-secondary-foreground",
            content: (
              <>
                <Wallet className="h-4 w-4" /> Maker: {deal.maker.slice(0, 6)}…
              </>
            )
          },
          {
            id: "taker",
            className: "bg-muted/70",
            content: (
              <>
                <ArrowUpRight className="h-4 w-4" /> Taker: {deal.taker.slice(0, 6)}…
              </>
            )
          }
        ]}
        metaItems={[
          { id: "side", label: "Side", value: deal.side },
          { id: "token", label: "Token", value: deal.token },
          {
            id: "fiat",
            label: "Fiat",
            value: (
              <span className="flex items-center gap-2">
                <FiatFlag fiat={deal.fiatCode} size={18} />
                {deal.fiatCode}
              </span>
            )
          },
          {
            id: "updated",
            label: "Last update",
            value: <RelativeTime value={deal.updatedAt} className="text-sm text-muted-foreground" />
          }
        ]}
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
