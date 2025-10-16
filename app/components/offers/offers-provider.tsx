"use client";

import * as React from "react";

import { generateMockOffers, type OfferRow } from "@/lib/mock-offers";

interface OffersContextValue {
  offers: OfferRow[];
  isLoading: boolean;
  refresh: () => void;
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

  const value = React.useMemo<OffersContextValue>(
    () => ({ offers, isLoading, refresh }),
    [offers, isLoading, refresh]
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
