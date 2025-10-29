'use client';

import * as React from "react";

import type { DealRow } from "@/lib/types/market";
import { useDeals } from "@/components/deals/deals-provider";

export function useDeal(dealId?: string | null) {
  const { deals, isLoading, refreshDeal } = useDeals();

  const baseDeal = React.useMemo<DealRow | undefined>(() => {
    if (!dealId) return undefined;
    const normalized = dealId.toLowerCase();
    return deals.find(item => item.id.toLowerCase() === normalized);
  }, [dealId, deals]);

  const [deal, setDeal] = React.useState<DealRow | null>(baseDeal ?? null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [notFound, setNotFound] = React.useState(false);
  const refreshMarkerRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    setDeal(baseDeal ?? null);
    setNotFound(false);
    refreshMarkerRef.current = null;
  }, [baseDeal?.id]);

  React.useEffect(() => {
    if (!baseDeal || !dealId) return;
    if (refreshMarkerRef.current === baseDeal.id) return;

    let cancelled = false;
    refreshMarkerRef.current = baseDeal.id;
    setIsRefreshing(true);

    refreshDeal(baseDeal)
      .then(updated => {
        if (cancelled) return;
        if (updated) {
          setDeal(updated);
          setNotFound(false);
        } else {
          setDeal(null);
          setNotFound(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDeal(baseDeal);
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
  }, [baseDeal, dealId, refreshDeal]);

  const refresh = React.useCallback(async () => {
    if (!baseDeal) {
      setDeal(null);
      setNotFound(true);
      return null;
    }
    setIsRefreshing(true);
    try {
      const updated = await refreshDeal(baseDeal);
      if (updated) {
        setDeal(updated);
        setNotFound(false);
      } else {
        setDeal(null);
        setNotFound(true);
      }
      return updated;
    } finally {
      setIsRefreshing(false);
    }
  }, [baseDeal, refreshDeal]);

  return {
    deal,
    baseDeal,
    isLoading: isLoading || isRefreshing,
    isRefreshing,
    notFound,
    refresh
  };
}
