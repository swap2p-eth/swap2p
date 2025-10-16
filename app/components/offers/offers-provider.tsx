"use client";

import * as React from "react";

import { generateMockOffers, type OfferRow } from "@/lib/mock-offers";
import { CURRENT_USER_ADDRESS } from "@/lib/mock-user";

interface OffersContextValue {
  offers: OfferRow[];
  isLoading: boolean;
  refresh: () => void;
  createOffer: (input: CreateOfferInput) => OfferRow;
  updateOffer: (id: number, updates: OfferUpdateInput) => OfferRow | null;
  removeOffer: (id: number) => void;
}

interface CreateOfferInput {
  side: OfferRow["side"];
  token: string;
  fiat: string;
  price: number;
  reserve: number;
  minAmount: number;
  maxAmount: number;
  paymentMethods: string[];
  requirements?: string;
}

interface OfferUpdateInput {
  price?: number;
  reserve?: number;
  minAmount?: number;
  maxAmount?: number;
  paymentMethods?: string[];
}

const OffersContext = React.createContext<OffersContextValue | null>(null);

export function OffersProvider({ children }: { children: React.ReactNode }) {
  const [offers, setOffers] = React.useState<OfferRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const refresh = React.useCallback(() => {
    setIsLoading(true);
    const next = generateMockOffers();
    setOffers(next);
    setIsLoading(false);
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const createOffer = React.useCallback(
    ({
      side,
      token,
      fiat,
      price,
      reserve,
      minAmount,
      maxAmount,
      paymentMethods,
      requirements
    }: CreateOfferInput) => {
      let created: OfferRow | null = null;
      setOffers(current => {
        const nextId = current.reduce((max, offer) => Math.max(max, offer.id), 0) + 1;
        created = {
          id: nextId,
          side,
          maker: CURRENT_USER_ADDRESS,
          token,
          fiat,
          price,
          reserve,
          minAmount,
          maxAmount,
          paymentMethods: paymentMethods.join(", "),
          requirements: requirements ?? "",
          updatedAt: new Date().toISOString()
        };
        return [created, ...current];
      });
      if (!created) throw new Error("Failed to create offer");
      return created;
    },
    []
  );

  const updateOffer = React.useCallback(
    (id: number, updates: OfferUpdateInput) => {
      let updated: OfferRow | null = null;
      setOffers(current =>
        current.map(offer => {
          if (offer.id !== id) return offer;
          updated = {
            ...offer,
            price: updates.price ?? offer.price,
            reserve: updates.reserve ?? offer.reserve,
            minAmount: updates.minAmount ?? offer.minAmount,
            maxAmount: updates.maxAmount ?? offer.maxAmount,
            paymentMethods:
              updates.paymentMethods !== undefined
                ? updates.paymentMethods.join(", ")
                : offer.paymentMethods,
            updatedAt: new Date().toISOString()
          };
          return updated;
        })
      );
      return updated;
    },
    []
  );

  const removeOffer = React.useCallback((id: number) => {
    setOffers(current => current.filter(offer => offer.id !== id));
  }, []);

  const value = React.useMemo<OffersContextValue>(
    () => ({ offers, isLoading, refresh, createOffer, updateOffer, removeOffer }),
    [offers, isLoading, refresh, createOffer, updateOffer, removeOffer]
  );

  return <OffersContext.Provider value={value}>{children}</OffersContext.Provider>;
}

export function useOffers() {
  const ctx = React.useContext(OffersContext);
  if (!ctx) {
    throw new Error("useOffers must be used within OffersProvider");
  }
  return ctx;
}
