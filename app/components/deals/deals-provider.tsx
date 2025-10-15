"use client";

import * as React from "react";

import type { DealRow } from "@/lib/mock-data";
import { mockDeals } from "@/lib/mock-data";
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
  createDeal: (input: CreateDealInput) => DealRow;
}

const DealsContext = React.createContext<DealsContextValue | null>(null);

const defaultTakerAddress = "0xYou000000000000000000000000000000000000";

export function DealsProvider({ children }: { children: React.ReactNode }) {
  const [deals, setDeals] = React.useState<DealRow[]>(() => [...mockDeals]);

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
    () => ({ deals, createDeal }),
    [deals, createDeal]
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
