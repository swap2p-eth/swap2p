"use client";

import * as React from "react";

import { generateMockDeals, type DealRow } from "@/lib/mock-data";
import type { OfferRow } from "@/lib/mock-offers";

type AmountKind = "crypto" | "fiat";

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
  refresh: () => void;
}

const DealsContext = React.createContext<DealsContextValue | null>(null);

const defaultTakerAddress = "0xYou000000000000000000000000000000000000";

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

  const value = React.useMemo<DealsContextValue>(
    () => ({ deals, createDeal, isLoading, refresh: loadDeals }),
    [deals, createDeal, isLoading, loadDeals]
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
