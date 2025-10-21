"use client";

import * as React from "react";

import { generateMockDeals, type DealRow } from "@/lib/mock-data";
import type { OfferRow } from "@/lib/mock-offers";
import { CURRENT_USER_ADDRESS } from "@/lib/mock-user";

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

const defaultTakerAddress = CURRENT_USER_ADDRESS;

export function DealsProvider({ children }: { children: React.ReactNode }) {
  const [deals, setDeals] = React.useState<DealRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const loadDeals = React.useCallback(() => {
    setIsLoading(true);
    const next = generateMockDeals();
    setDeals(next);
    setIsLoading(false);
  }, []);

  React.useEffect(() => {
    loadDeals();
  }, [loadDeals]);

  const createDeal = React.useCallback(
    ({ offer, amount, amountKind, paymentMethod }: CreateDealInput) => {
      let created: DealRow | null = null;
      setDeals(current => {
        const nextId = current.reduce((max, deal) => Math.max(max, deal.id), 0) + 1;
        const timestamp = new Date();

        created = {
          id: nextId,
          side: offer.side,
          amount,
          fiatCode: offer.fiat,
          partner: null,
          state: "REQUESTED",
          updatedAt: timestamp.toISOString(),
          maker: offer.maker,
          taker: defaultTakerAddress,
          token: offer.token
        };

        return [...current, created];
      });

      void paymentMethod;
      void amountKind;

      if (!created) {
        throw new Error("Failed to create deal");
      }

      return created;
    },
    []
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

  const acceptDeal = React.useCallback((dealId: number) => {
    const timestamp = new Date().toISOString();
    updateDeal(dealId, deal => {
      if (deal.state !== "REQUESTED") return null;
      return { ...deal, state: "ACCEPTED", updatedAt: timestamp };
    });
  }, [updateDeal]);

  const cancelDeal = React.useCallback(
    (dealId: number, actor: DealParticipant) => {
      const timestamp = new Date().toISOString();
      updateDeal(dealId, deal => {
        if (deal.state === "REQUESTED") {
          return { ...deal, state: "CANCELED", updatedAt: timestamp };
        }
        if (deal.state === "ACCEPTED") {
          const makerCanCancel = deal.side === "BUY" && actor === "MAKER";
          const takerCanCancel = deal.side === "SELL" && actor === "TAKER";
          if (makerCanCancel || takerCanCancel) {
            return { ...deal, state: "CANCELED", updatedAt: timestamp };
          }
        }
        return null;
      });
    },
    [updateDeal]
  );

  const markDealPaid = React.useCallback(
    (dealId: number, actor: DealParticipant) => {
      const timestamp = new Date().toISOString();
      updateDeal(dealId, deal => {
        if (deal.state !== "ACCEPTED") return null;
        const makerPays = deal.side === "BUY" && actor === "MAKER";
        const takerPays = deal.side === "SELL" && actor === "TAKER";
        if (!makerPays && !takerPays) return null;
        return { ...deal, state: "PAID", updatedAt: timestamp };
      });
    },
    [updateDeal]
  );

  const releaseDeal = React.useCallback(
    (dealId: number, actor: DealParticipant) => {
      const timestamp = new Date().toISOString();
      updateDeal(dealId, deal => {
        if (deal.state !== "PAID") return null;
        const takerReleases = deal.side === "BUY" && actor === "TAKER";
        const makerReleases = deal.side === "SELL" && actor === "MAKER";
        if (!takerReleases && !makerReleases) return null;
        return { ...deal, state: "RELEASED", updatedAt: timestamp };
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
      refresh: loadDeals
    }),
    [deals, createDeal, acceptDeal, cancelDeal, markDealPaid, releaseDeal, isLoading, loadDeals]
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
