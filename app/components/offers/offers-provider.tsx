"use client";

import * as React from "react";
import { useChainId } from "wagmi";

import { useUser } from "@/context/user-context";
import { getNetworkConfigForChain } from "@/config";
import type { OfferRow } from "@/lib/types/market";

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
  const { address } = useUser();
  const chainId = useChainId();
  const network = React.useMemo(() => getNetworkConfigForChain(chainId), [chainId]);

  const [offers, setOffers] = React.useState<OfferRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  const refresh = React.useCallback(() => {
    setOffers([]);
    setIsLoading(false);
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh, network]);

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
      const tokenDecimals =
        network.tokens.find(item => item.symbol === token)?.decimals ?? 18;

      setOffers(current => {
        const nextId = current.reduce((max, offer) => Math.max(max, offer.id), 0) + 1;
        const entry: OfferRow = {
          id: nextId,
          side,
          maker: address,
          token,
          tokenDecimals,
          fiat,
          price,
          reserve,
          minAmount,
          maxAmount,
          paymentMethods: paymentMethods.join(", "),
          requirements: requirements ?? "",
          updatedAt: new Date().toISOString()
        };
        created = entry;
        return [entry, ...current];
      });

      if (!created) {
        throw new Error("Failed to create offer");
      }

      return created;
    },
    [address, network.tokens]
  );

  const updateOffer = React.useCallback(
    (id: number, updates: OfferUpdateInput) => {
      let updated: OfferRow | null = null;
      setOffers(current =>
        current.map(offer => {
          if (offer.id !== id) return offer;
          const next: OfferRow = {
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
          updated = next;
          return next;
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
