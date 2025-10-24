"use client";

import * as React from "react";
import { useChainId } from "wagmi";
import { formatUnits, getAddress } from "viem";

import { useUser } from "@/context/user-context";
import { getNetworkConfigForChain, FIAT_INFOS, type FiatInfo, type TokenConfig } from "@/config";
import { useSwap2pAdapter } from "@/hooks/use-swap2p-adapter";
import { decodeCountryCode, encodeCountryCode, getFiatInfoByCountry } from "@/lib/fiat";
import type { OfferRow } from "@/lib/types/market";
import { SwapSide, type OfferWithKey } from "@/lib/swap2p/types";
import { ANY_FILTER_OPTION, readStoredFilters } from "@/components/offers/filter-storage";

interface OffersContextValue {
  offers: OfferRow[];
  makerOffers: OfferRow[];
  isLoading: boolean;
  isMakerLoading: boolean;
  activeMarket: {
    side: "BUY" | "SELL";
    fiat: string;
  };
  ensureMarket: (params: { side: "BUY" | "SELL"; fiat: string; force?: boolean }) => Promise<void>;
  tokens: TokenConfig[];
  fiats: FiatInfo[];
  refresh: () => Promise<void>;
  refreshMakerOffers: () => Promise<void>;
  createOffer: (input: CreateOfferInput) => OfferRow;
  updateOffer: (id: string, updates: OfferUpdateInput) => OfferRow | null;
  removeOffer: (id: string) => void;
}

interface CreateOfferInput {
  side: OfferRow["side"];
  token: string;
  countryCode: string;
  price: number;
  minAmount: number;
  maxAmount: number;
  paymentMethods: string[];
  requirements?: string;
}

interface OfferUpdateInput {
  price?: number;
  minAmount?: number;
  maxAmount?: number;
  paymentMethods?: string[];
}

const OffersContext = React.createContext<OffersContextValue | null>(null);

const PRICE_SCALE = 1_000;
const OFFER_FETCH_LIMIT = 50;
const OFFER_CACHE_TTL_MS = 60_000;
const toSideLabel = (side: SwapSide): OfferRow["side"] =>
  side === SwapSide.SELL ? "SELL" : "BUY";

const generateOfferId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
    return `0x${hex}`;
  }
  const fallback = Date.now().toString(16).padStart(16, "0");
  return `0x${fallback.padEnd(64, "0").slice(0, 64)}`;
};

const mapOffer = (
  entry: OfferWithKey,
  options: {
    tokenSymbol: string;
    tokenDecimals: number;
  }
): OfferRow => {
  const { offer, key } = entry;
  const timestampMs = (offer.updatedAt ?? 0) * 1000;
  const encoded = typeof offer.fiat === "number" ? offer.fiat : 0;
  const decoded = decodeCountryCode(encoded);
  const countryCode = decoded ? decoded.toUpperCase() : "";
  const fiatInfo = getFiatInfoByCountry(countryCode);
  const fiatLabel = fiatInfo?.shortLabel ?? (countryCode || "??");
  const currencyCode = fiatInfo?.currencyCode ?? (countryCode || "");
  return {
    id: entry.id,
    side: toSideLabel(offer.side),
    maker: key.maker,
    token: options.tokenSymbol,
    tokenDecimals: options.tokenDecimals,
    fiat: fiatLabel,
    countryCode,
    currencyCode,
    price: Number(offer.priceFiatPerToken) / PRICE_SCALE,
    minAmount: Number(formatUnits(offer.minAmount, options.tokenDecimals)),
    maxAmount: Number(formatUnits(offer.maxAmount, options.tokenDecimals)),
    paymentMethods: offer.paymentMethods ?? "",
    requirements: offer.requirements ?? "",
    updatedAt: new Date(timestampMs || Date.now()).toISOString(),
    contractKey: entry.key,
    contract: offer,
    contractFiatCode: offer.fiat,
    contractId: entry.id,
  };
};

const makeCacheKey = (tokenAddress: string, side: SwapSide, fiat: number) =>
  `${tokenAddress.toLowerCase()}|${side}|${fiat}`;

export function OffersProvider({ children }: { children: React.ReactNode }) {
  const { address } = useUser();
  const chainId = useChainId();
  const { adapter } = useSwap2pAdapter();
  const network = React.useMemo(() => getNetworkConfigForChain(chainId), [chainId]);

  const tokenConfigs = React.useMemo(
    () =>
      network.tokens.map(token => ({
        ...token,
        address: getAddress(token.address),
      })),
    [network.tokens],
  );

  // NOTE: fiat values hold ISO country codes; display labels come from FIAT_INFOS
  const fiatEntries = React.useMemo(() =>
    FIAT_INFOS.map(info => ({
      info,
      value: encodeCountryCode(info.countryCode),
    }))
  , []);

  const fiatLookup = React.useMemo(() => {
    const map = new Map<string, { info: FiatInfo; value: number }>();
    for (const entry of fiatEntries) {
      map.set(entry.info.countryCode.toUpperCase(), entry);
    }
    return map;
  }, [fiatEntries]);

  const fiatCodes = React.useMemo(
    () => fiatEntries.map(entry => entry.info.countryCode.toUpperCase()),
    [fiatEntries],
  );

  const fiatInfos = React.useMemo(() => fiatEntries.map(entry => entry.info), [fiatEntries]);

  const defaultFiat = React.useMemo(
    () => (fiatCodes[0] ?? "US").toUpperCase(),
    [fiatCodes],
  );

  const [activeMarket, setActiveMarket] = React.useState<{
    side: "BUY" | "SELL";
    fiat: string;
  }>({
    side: "SELL",
    fiat: defaultFiat,
  });
  const [isLoading, setIsLoading] = React.useState(false);
  const [draftOffers, setDraftOffers] = React.useState<OfferRow[]>([]);
  const cacheRef = React.useRef(new Map<string, { items: OfferRow[]; fetchedAt: number }>());
  const [cacheVersion, setCacheVersion] = React.useState(0);
  const [makerChainOffers, setMakerChainOffers] = React.useState<OfferRow[]>([]);
  const [isMakerLoading, setIsMakerLoading] = React.useState(false);
  const makerCacheRef = React.useRef<{ items: OfferRow[]; fetchedAt: number } | null>(null);

  React.useEffect(() => {
    cacheRef.current.clear();
    setCacheVersion(version => version + 1);
  }, [adapter, tokenConfigs]);

  React.useEffect(() => {
    setActiveMarket(prev => {
      const normalized = prev.fiat.toUpperCase();
      const nextFiat = fiatCodes.includes(normalized) ? normalized : defaultFiat;
      if (prev.side === prev.side && prev.fiat === nextFiat) {
        return prev;
      }
      return { side: prev.side, fiat: nextFiat };
    });
  }, [defaultFiat, fiatCodes]);

  const loadOffersFor = React.useCallback(
    async ({
      makerSide,
      fiat,
      force = false,
    }: {
      makerSide: SwapSide;
      fiat: { info: FiatInfo; value: number };
      force?: boolean;
    }) => {
      if (!adapter) return;
      let fetchedAny = false;
      await Promise.all(
        tokenConfigs.map(async token => {
          const key = makeCacheKey(token.address, makerSide, fiat.value);
          const cached = cacheRef.current.get(key);
          const isFresh = cached && Date.now() - cached.fetchedAt <= OFFER_CACHE_TTL_MS;
          if (!force && isFresh) {
            return;
          }
          fetchedAny = true;
          try {
            const offers = await adapter.getOffers({
              token: token.address,
              side: makerSide,
              fiat: fiat.value,
              limit: OFFER_FETCH_LIMIT,
              offset: 0,
            });
            const mapped = offers.map(entry =>
              mapOffer(entry, {
                tokenSymbol: token.symbol,
                tokenDecimals: token.decimals,
              }),
            );
            cacheRef.current.set(key, { items: mapped, fetchedAt: Date.now() });
            console.debug("[OffersProvider] loadOffersFor", JSON.stringify({
              token: token.symbol,
              side: toSideLabel(makerSide),
              fiat: fiat.info.shortLabel,
              count: mapped.length,
            }));
          } catch (error) {
            console.error(
              "[swap2p] failed to fetch offers",
              {
                token: token.address,
                fiat: fiat.info.shortLabel,
                side: toSideLabel(makerSide),
              },
              error,
            );
            cacheRef.current.set(key, { items: [], fetchedAt: Date.now() });
          }
        }),
      );
      if (fetchedAny) {
        setCacheVersion(version => version + 1);
      }
    },
    [adapter, tokenConfigs],
  );

  const loadMakerOffers = React.useCallback(
    async (force = false) => {
      if (!adapter || !address) {
        makerCacheRef.current = null;
        setMakerChainOffers([]);
        return;
      }
      const cached = makerCacheRef.current;
      if (!force && cached && Date.now() - cached.fetchedAt <= OFFER_CACHE_TTL_MS) {
        setMakerChainOffers(cached.items);
        return;
      }
      setIsMakerLoading(true);
      try {
        const entries = await adapter.getMakerOffers({
          maker: getAddress(address),
          offset: 0,
          limit: OFFER_FETCH_LIMIT,
        });
        const mapped = entries.map(entry => {
          const tokenInfo = tokenConfigs.find(token => token.address.toLowerCase() === entry.key.token.toLowerCase());
          const tokenSymbol = tokenInfo?.symbol ?? entry.offer.token;
          const tokenDecimals = tokenInfo?.decimals ?? 18;
                    return mapOffer(entry, {
            tokenSymbol,
            tokenDecimals,
          });
        });
        makerCacheRef.current = { items: mapped, fetchedAt: Date.now() };
        setMakerChainOffers(mapped);
      } catch (error) {
        console.error("[swap2p] failed to fetch maker offers", { maker: address }, error);
        makerCacheRef.current = { items: [], fetchedAt: Date.now() };
        setMakerChainOffers([]);
      } finally {
        setIsMakerLoading(false);
      }
    },
    [adapter, address, tokenConfigs],
  );

  React.useEffect(() => {
    makerCacheRef.current = null;
    setMakerChainOffers([]);
    if (!adapter || !address) {
      setIsMakerLoading(false);
      return;
    }
    void loadMakerOffers(true);
  }, [adapter, address, loadMakerOffers]);

  const ensureMarket = React.useCallback(
    async ({
      side,
      fiat,
      force = false,
    }: {
      side: "BUY" | "SELL";
      fiat: string;
      force?: boolean;
    }) => {
      console.debug("[OffersProvider] ensureMarket request", JSON.stringify({ side, fiat, force }));
      const normalizedFiat = fiat.toUpperCase();
      const fallback = fiatLookup.get(defaultFiat.toUpperCase());
      const fiatEntry = fiatLookup.get(normalizedFiat) ?? fallback;
      if (!fiatEntry) return;
      setActiveMarket(prev => {
        if (prev.side === side && prev.fiat === fiatEntry.info.countryCode) {
          console.debug("[OffersProvider] activeMarket unchanged", JSON.stringify(prev));
          return prev;
        }
        console.debug("[OffersProvider] activeMarket update", JSON.stringify({ side, fiat: fiatEntry.info.countryCode }));
        return { side, fiat: fiatEntry.info.countryCode };
      });
      if (!adapter) {
        setIsLoading(false);
        return;
      }
      const makerSide = side === "BUY" ? SwapSide.SELL : SwapSide.BUY;
      const needsFetch =
        force ||
        tokenConfigs.some(token => {
          const key = makeCacheKey(token.address, makerSide, fiatEntry.value);
          const cached = cacheRef.current.get(key);
          return !cached || Date.now() - cached.fetchedAt > OFFER_CACHE_TTL_MS;
        });
      if (!needsFetch) {
        console.debug(
          "[OffersProvider] cache hit",
          JSON.stringify({ makerSide: toSideLabel(makerSide), fiat: fiatEntry.info.shortLabel }),
        );
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        await loadOffersFor({ makerSide, fiat: fiatEntry, force });
      } finally {
        setIsLoading(false);
      }
    },
    [adapter, defaultFiat, fiatLookup, loadOffersFor, tokenConfigs],
  );

  const refresh = React.useCallback(async () => {
    await ensureMarket({
      side: activeMarket.side,
      fiat: activeMarket.fiat,
      force: true,
    });
  }, [activeMarket, ensureMarket]);

  const refreshMakerOffers = React.useCallback(async () => {
    await loadMakerOffers(true);
  }, [loadMakerOffers]);

  const bootstrappedRef = React.useRef(false);

  React.useEffect(() => {
    if (!adapter) {
      bootstrappedRef.current = false;
      setIsLoading(false);
      return;
    }
    if (bootstrappedRef.current) {
      return;
    }
    // Kick off the first fetch with persisted filters so OffersView lands on the expected market.
    bootstrappedRef.current = true;
    const stored = readStoredFilters();
    const storedSide = stored?.side === "BUY" || stored?.side === "SELL" ? stored.side : activeMarket.side;
    const rawFiat = typeof stored?.fiat === "string" ? stored.fiat : activeMarket.fiat;
    const normalizedFiat =
      rawFiat === ANY_FILTER_OPTION ? defaultFiat : rawFiat.toUpperCase();
    void ensureMarket({ side: storedSide, fiat: normalizedFiat });
  }, [adapter, ensureMarket, activeMarket.side, activeMarket.fiat, defaultFiat]);

  React.useEffect(() => {
    bootstrappedRef.current = false;
  }, [adapter]);

  React.useEffect(() => {
    setDraftOffers([]);
  }, [address]);

  const makerOffers = React.useMemo(() => {
    const merged = new Map<string, OfferRow>();
    for (const offer of makerChainOffers) {
      merged.set(offer.id, offer);
    }
    const normalizedAddress = address?.toLowerCase();
    for (const offer of draftOffers) {
      if (normalizedAddress && offer.maker?.toLowerCase() !== normalizedAddress) continue;
      merged.set(offer.id, offer);
    }
    return Array.from(merged.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [makerChainOffers, draftOffers, address]);

  const offers = React.useMemo(() => {
    const fallback = fiatLookup.get(defaultFiat.toUpperCase());
    const fiatEntry =
      fiatLookup.get(activeMarket.fiat.toUpperCase()) ?? fallback;
    if (!fiatEntry) return draftOffers.slice();
    const makerSide = activeMarket.side === "BUY" ? SwapSide.SELL : SwapSide.BUY;
    const expectedSideLabel = toSideLabel(makerSide);
    const merged = new Map<string, OfferRow>();
    for (const token of tokenConfigs) {
      const key = makeCacheKey(token.address, makerSide, fiatEntry.value);
      const bucket = cacheRef.current.get(key);
      if (!bucket) continue;
      for (const offer of bucket.items) {
        merged.set(offer.id, offer);
      }
    }
    for (const offer of draftOffers) {
      if (offer.countryCode.toUpperCase() !== fiatEntry.info.countryCode.toUpperCase()) continue;
      if (offer.side !== expectedSideLabel) continue;
      merged.set(offer.id, offer);
    }
    const result = Array.from(merged.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    console.debug("[OffersProvider] offers computed", JSON.stringify({
      market: {
        side: activeMarket.side,
        countryCode: activeMarket.fiat,
        label: fiatEntry.info.shortLabel,
      },
      makerSide: expectedSideLabel,
      count: result.length,
      cacheVersion,
    }));
    return result;
  }, [activeMarket, cacheVersion, draftOffers, tokenConfigs, fiatLookup, defaultFiat]);

  const createOffer = React.useCallback(
    ({
      side,
      token,
      countryCode,
      price,
      minAmount,
      maxAmount,
      paymentMethods,
      requirements,
    }: CreateOfferInput) => {
      const tokenInfo = tokenConfigs.find(item => item.symbol === token);
      const decimals = tokenInfo?.decimals ?? 18;
      const normalizedCountry = countryCode.toUpperCase();
      const fiatInfo = getFiatInfoByCountry(normalizedCountry);
      let contractFiatCode: number | undefined;
      try {
        contractFiatCode = encodeCountryCode(normalizedCountry);
      } catch {
        contractFiatCode = undefined;
      }

      const fiatLabel = fiatInfo?.shortLabel ?? normalizedCountry;
      const currencyCode = fiatInfo?.currencyCode ?? normalizedCountry;

      const id = generateOfferId();
      const entry: OfferRow = {
        id,
        side,
        maker: address,
        token,
        tokenDecimals: decimals,
        fiat: fiatLabel,
        countryCode: normalizedCountry,
        currencyCode,
        price,
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
    [address, tokenConfigs],
  );

  const updateOffer = React.useCallback(
    (id: string, updates: OfferUpdateInput) => {
      let updated: OfferRow | null = null;
      setDraftOffers(current =>
        current.map(offer => {
          if (offer.id !== id) return offer;
          const next: OfferRow = {
            ...offer,
            price: updates.price ?? offer.price,
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

  const removeOffer = React.useCallback((id: string) => {
    setDraftOffers(current => current.filter(offer => offer.id !== id));
  }, []);

  const contextValue = React.useMemo<OffersContextValue>(
    () => ({
      offers,
      makerOffers,
      isLoading,
      isMakerLoading,
      activeMarket,
      ensureMarket,
      tokens: tokenConfigs,
      fiats: fiatInfos,
      refresh,
      refreshMakerOffers,
      createOffer,
      updateOffer,
      removeOffer,
    }),
    [
      offers,
      makerOffers,
      isLoading,
      isMakerLoading,
      activeMarket,
      ensureMarket,
      tokenConfigs,
      fiatInfos,
      refresh,
      refreshMakerOffers,
      createOffer,
      updateOffer,
      removeOffer,
    ],
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
