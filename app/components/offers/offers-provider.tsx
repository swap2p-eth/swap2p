"use client";

import * as React from "react";
import { useChainId } from "wagmi";
import { formatUnits, getAddress } from "viem";

import { useUser } from "@/context/user-context";
import { getNetworkConfigForChain } from "@/config";
import { useSwap2pAdapter } from "@/hooks/use-swap2p-adapter";
import { safeFiatCodeToString, toFiatCode } from "@/lib/fiat";
import type { OfferRow } from "@/lib/types/market";
import { SwapSide, type OfferKey, type OfferWithKey } from "@/lib/swap2p/types";

interface OffersContextValue {
  offers: OfferRow[];
  isLoading: boolean;
  refresh: () => Promise<void>;
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

const PRICE_SCALE = 1_000;
const OFFER_FETCH_LIMIT = 50;
const SIDES: SwapSide[] = [SwapSide.SELL, SwapSide.BUY];

const toSideLabel = (side: SwapSide): OfferRow["side"] =>
  side === SwapSide.SELL ? "SELL" : "BUY";

const hashOfferKey = (key: OfferKey): number => {
  const input = `${key.token.toLowerCase()}|${key.maker.toLowerCase()}|${key.side}|${key.fiat}`;
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    const char = input.charCodeAt(index);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
};

const mapOffer = (
  entry: OfferWithKey,
  options: {
    tokenSymbol: string;
    tokenDecimals: number;
    fiatCode: string;
    fiatId: number;
  }
): OfferRow => {
  const { offer, key } = entry;
  const timestampMs = (offer.updatedAt ?? 0) * 1000;
  const fiatLabel = safeFiatCodeToString(options.fiatId) || options.fiatCode;
  return {
    id: hashOfferKey(key),
    side: toSideLabel(offer.side),
    maker: key.maker,
    token: options.tokenSymbol,
    tokenDecimals: options.tokenDecimals,
    fiat: fiatLabel,
    price: Number(offer.priceFiatPerToken) / PRICE_SCALE,
    reserve: Number(formatUnits(offer.reserve, options.tokenDecimals)),
    minAmount: Number(formatUnits(offer.minAmount, options.tokenDecimals)),
    maxAmount: Number(formatUnits(offer.maxAmount, options.tokenDecimals)),
    paymentMethods: offer.paymentMethods ?? "",
    requirements: offer.requirements ?? "",
    updatedAt: new Date(timestampMs || Date.now()).toISOString(),
    contractKey: entry.key,
    contract: offer,
    contractFiatCode: offer.fiat,
  };
};

async function fetchChainOffers(
  adapter: ReturnType<typeof useSwap2pAdapter>["adapter"],
  network: ReturnType<typeof getNetworkConfigForChain>,
): Promise<OfferRow[]> {
  if (!adapter) return [];

  const tokenConfigs = network.tokens.map(token => ({
    ...token,
    address: getAddress(token.address),
  }));

  const fiatCodes = network.fiats.flatMap(fiat => {
    try {
      return [{ code: fiat.code, value: toFiatCode(fiat.code) }];
    } catch (error) {
      console.warn("[swap2p] skipped fiat code", fiat.code, error);
      return [];
    }
  });

  const combinations = tokenConfigs.flatMap(token =>
    fiatCodes.flatMap(fiat =>
      SIDES.map(side => ({ token, fiat, side })),
    ),
  );

  const results = await Promise.all(
    combinations.map(async ({ token, fiat, side }) => {
      try {
        const offers = await adapter.getOffers({
          token: token.address,
          side,
          fiat: fiat.value,
          limit: OFFER_FETCH_LIMIT,
          offset: 0,
        });
        return offers.map(entry =>
          mapOffer(entry, {
            tokenSymbol: token.symbol,
            tokenDecimals: token.decimals,
            fiatCode: fiat.code,
            fiatId: entry.offer.fiat,
          }),
        );
      } catch (error) {
        console.error(
          "[swap2p] failed to fetch offers",
          {
            token: token.address,
            fiat: fiat.code,
            side: toSideLabel(side),
          },
          error,
        );
        return [];
      }
    }),
  );

  const merged = new Map<number, OfferRow>();
  for (const bucket of results) {
    for (const offer of bucket) {
      merged.set(offer.id, offer);
    }
  }

  return Array.from(merged.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function OffersProvider({ children }: { children: React.ReactNode }) {
  const { address } = useUser();
  const chainId = useChainId();
  const { adapter } = useSwap2pAdapter();
  const network = React.useMemo(() => getNetworkConfigForChain(chainId), [chainId]);

  const [chainOffers, setChainOffers] = React.useState<OfferRow[]>([]);
  const [draftOffers, setDraftOffers] = React.useState<OfferRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  const refresh = React.useCallback(async () => {
    if (!adapter) {
      setChainOffers([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const next = await fetchChainOffers(adapter, network);
      setChainOffers(next);
    } finally {
      setIsLoading(false);
    }
  }, [adapter, network]);

  React.useEffect(() => {
    let isMounted = true;
    (async () => {
      if (!isMounted) return;
      await refresh();
    })();
    return () => {
      isMounted = false;
    };
  }, [refresh]);

  React.useEffect(() => {
    setDraftOffers([]);
  }, [address]);

  const offers = React.useMemo(
    () => [...chainOffers, ...draftOffers],
    [chainOffers, draftOffers],
  );

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
      requirements,
    }: CreateOfferInput) => {
      const tokenInfo = network.tokens.find(item => item.symbol === token);
      const decimals = tokenInfo?.decimals ?? 18;
      let contractFiatCode: number | undefined;
      try {
        contractFiatCode = toFiatCode(fiat);
      } catch {
        contractFiatCode = undefined;
      }

      const entry: OfferRow = {
        id: Date.now(),
        side,
        maker: address,
        token,
        tokenDecimals: decimals,
        fiat,
        price,
        reserve,
        minAmount,
        maxAmount,
        paymentMethods: paymentMethods.join(", "),
        requirements: requirements ?? "",
        updatedAt: new Date().toISOString(),
        contractFiatCode,
      };
      setDraftOffers(current => [entry, ...current]);
      return entry;
    },
    [address, network.tokens],
  );

  const updateOffer = React.useCallback(
    (id: number, updates: OfferUpdateInput) => {
      let updated: OfferRow | null = null;
      setDraftOffers(current =>
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
            updatedAt: new Date().toISOString(),
          };
          updated = next;
          return next;
        }),
      );
      return updated;
    },
    [],
  );

  const removeOffer = React.useCallback((id: number) => {
    setDraftOffers(current => current.filter(offer => offer.id !== id));
  }, []);

  const contextValue = React.useMemo<OffersContextValue>(
    () => ({ offers, isLoading, refresh, createOffer, updateOffer, removeOffer }),
    [offers, isLoading, refresh, createOffer, updateOffer, removeOffer],
  );

  return <OffersContext.Provider value={contextValue}>{children}</OffersContext.Provider>;
}

export function useOffers() {
  const ctx = React.useContext(OffersContext);
  if (!ctx) {
    throw new Error("useOffers must be used within OffersProvider");
  }
  return ctx;
}
