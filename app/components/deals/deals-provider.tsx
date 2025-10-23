"use client";

import * as React from "react";

import type { DealRow } from "@/lib/types/market";
import type { OfferRow } from "@/lib/types/market";
import { useUser } from "@/context/user-context";

type AmountKind = "crypto" | "fiat";
export type DealParticipant = "MAKER" | "TAKER";

interface CreateDealInput {
  offer: OfferRow;
  amount: number;
  amountKind: AmountKind;
  paymentMethod: string;
}

interface DealsContextValue {
  deals: DealRow[];
  isLoading: boolean;
  createDeal: (input: CreateDealInput) => DealRow;
  acceptDeal: (dealId: number, comment?: string) => void;
  cancelDeal: (dealId: number, actor: DealParticipant, comment?: string) => void;
  markDealPaid: (dealId: number, actor: DealParticipant, comment?: string) => void;
  releaseDeal: (dealId: number, actor: DealParticipant, comment?: string) => void;
  refresh: () => void;
}

const DealsContext = React.createContext<DealsContextValue | null>(null);

export function DealsProvider({ children }: { children: React.ReactNode }) {
  const { address: currentUserAddress } = useUser();
  const [deals, setDeals] = React.useState<DealRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  const refresh = React.useCallback(() => {
    setDeals([]);
    setIsLoading(false);
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const createDeal = React.useCallback(
    ({ offer, amount, amountKind, paymentMethod }: CreateDealInput) => {
      void amountKind;
      let created: DealRow | null = null;
      setDeals(current => {
        const nextId = current.reduce((max, deal) => Math.max(max, deal.id), 0) + 1;
        const now = new Date().toISOString();
        const entry: DealRow = {
          id: nextId,
          side: offer.side,
          amount,
          fiatCode: offer.fiat,
          partner: null,
          state: "REQUESTED",
          updatedAt: now,
          maker: offer.maker,
          taker: currentUserAddress,
          token: offer.token,
          tokenDecimals: offer.tokenDecimals,
          price: offer.price,
          fiatAmount: offer.price * amount,
          paymentMethod
        };
        created = entry;
        return [...current, entry];
      });

      if (!created) {
        throw new Error("Failed to create deal");
      }

      return created;
    },
    [currentUserAddress]
  );

  const updateDeal = React.useCallback((dealId: number, updater: (deal: DealRow) => DealRow | null) => {
    setDeals(current =>
      current.map(deal => {
        if (deal.id !== dealId) return deal;
        const next = updater(deal);
        return next ?? deal;
      })
    );
  }, []);

  const acceptDeal = React.useCallback(
    (dealId: number) => {
      updateDeal(dealId, deal => {
        if (deal.state !== "REQUESTED") return null;
        return { ...deal, state: "ACCEPTED", updatedAt: new Date().toISOString() };
      });
    },
    [updateDeal]
  );

  const cancelDeal = React.useCallback(
    (dealId: number, actor: DealParticipant) => {
      updateDeal(dealId, deal => {
        if (deal.state === "REQUESTED") {
          return { ...deal, state: "CANCELED", updatedAt: new Date().toISOString() };
        }
        if (deal.state === "ACCEPTED") {
          const makerCanCancel = deal.side === "BUY" && actor === "MAKER";
          const takerCanCancel = deal.side === "SELL" && actor === "TAKER";
          if (makerCanCancel || takerCanCancel) {
            return { ...deal, state: "CANCELED", updatedAt: new Date().toISOString() };
          }
        }
        return null;
      });
    },
    [updateDeal]
  );

  const markDealPaid = React.useCallback(
    (dealId: number, actor: DealParticipant) => {
      updateDeal(dealId, deal => {
        if (deal.state !== "ACCEPTED") return null;
        const makerPays = deal.side === "BUY" && actor === "MAKER";
        const takerPays = deal.side === "SELL" && actor === "TAKER";
        if (!makerPays && !takerPays) return null;
        return { ...deal, state: "PAID", updatedAt: new Date().toISOString() };
      });
    },
    [updateDeal]
  );

  const releaseDeal = React.useCallback(
    (dealId: number, actor: DealParticipant) => {
      updateDeal(dealId, deal => {
        if (deal.state !== "PAID") return null;
        const takerReleases = deal.side === "BUY" && actor === "TAKER";
        const makerReleases = deal.side === "SELL" && actor === "MAKER";
        if (!takerReleases && !makerReleases) return null;
        return { ...deal, state: "RELEASED", updatedAt: new Date().toISOString() };
      });
    },
    [updateDeal]
  );

  const value = React.useMemo<DealsContextValue>(
    () => ({
      deals,
      createDeal,
      acceptDeal,
      cancelDeal,
      markDealPaid,
      releaseDeal,
      isLoading,
      refresh
    }),
    [deals, createDeal, acceptDeal, cancelDeal, markDealPaid, releaseDeal, isLoading, refresh]
  );

  return <DealsContext.Provider value={value}>{children}</DealsContext.Provider>;
}

export function useDeals() {
  const ctx = React.useContext(DealsContext);
  if (!ctx) {
    throw new Error("useDeals must be used within DealsProvider");
  }
  return ctx;
}
