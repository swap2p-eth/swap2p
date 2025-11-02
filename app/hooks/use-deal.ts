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

  const baseMarker = React.useMemo(() => {
    if (!baseDeal) return null;
    const updatedAt = baseDeal.updatedAt ?? "";
    const chat = baseDeal.contract?.chat ?? [];
    const chatLength = chat.length;
    const lastChat = chatLength > 0 ? chat[chatLength - 1] : null;
    const lastTimestamp = lastChat?.timestamp ?? "";
    const lastPayload = lastChat?.payload ?? "";
    return `${baseDeal.id}:${updatedAt}:${chatLength}:${lastTimestamp}:${lastPayload}`;
  }, [baseDeal]);

  React.useEffect(() => {
    if (!baseDeal) {
      setDeal(null);
      setNotFound(false);
      refreshMarkerRef.current = null;
      return;
    }
    setDeal(baseDeal);
    setNotFound(false);
  }, [baseDeal]);

  React.useEffect(() => {
    if (!baseDeal || !dealId) return;
    const marker = baseMarker ?? baseDeal.id;
    if (refreshMarkerRef.current === marker) return;

    let cancelled = false;
    refreshMarkerRef.current = marker;
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
  }, [baseDeal, dealId, refreshDeal, baseMarker]);

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
