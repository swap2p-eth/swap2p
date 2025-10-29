import * as React from "react";

import type { OfferRow } from "@/lib/types/market";
import { useOffers } from "@/components/offers/offers-provider";

export function useOffer(offerId?: string | null) {
  const {
    offers,
    makerOffers,
    isLoading,
    refreshOffer
  } = useOffers();

  const baseOffer = React.useMemo<OfferRow | undefined>(() => {
    if (!offerId) return undefined;
    const lower = offerId.toLowerCase();
    return (
      offers.find(item => item.id.toLowerCase() === lower) ??
      makerOffers.find(item => item.id.toLowerCase() === lower)
    );
  }, [offerId, offers, makerOffers]);

  const [offer, setOffer] = React.useState<OfferRow | null>(baseOffer ?? null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [notFound, setNotFound] = React.useState(false);
  const refreshMarkerRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    setOffer(baseOffer ?? null);
    setNotFound(false);
    refreshMarkerRef.current = null;
  }, [baseOffer?.id]);

  React.useEffect(() => {
    if (!baseOffer || !offerId) return;
    if (refreshMarkerRef.current === baseOffer.id) return;

    let cancelled = false;
    refreshMarkerRef.current = baseOffer.id;
    setIsRefreshing(true);

    refreshOffer(baseOffer)
      .then(updated => {
        if (cancelled) return;
        if (updated) {
          setOffer(updated);
          setNotFound(false);
        } else {
          setOffer(null);
          setNotFound(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOffer(baseOffer);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsRefreshing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [baseOffer, offerId, refreshOffer]);

  const refresh = React.useCallback(async () => {
    if (!baseOffer) {
      setOffer(null);
      setNotFound(true);
      return null;
    }
    setIsRefreshing(true);
    try {
      const updated = await refreshOffer(baseOffer);
      if (updated) {
        setOffer(updated);
        setNotFound(false);
      } else {
        setOffer(null);
        setNotFound(true);
      }
      return updated;
    } finally {
      setIsRefreshing(false);
    }
  }, [baseOffer, refreshOffer]);

  return {
    offer,
    baseOffer,
    isLoading: isLoading || isRefreshing,
    isRefreshing,
    notFound,
    refresh
  };
}
