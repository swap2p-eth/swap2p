"use client";

import * as React from "react";
import { useChainId, usePublicClient } from "wagmi";
import { getAddress, parseUnits, type Hash } from "viem";

import { useUser } from "@/context/user-context";
import { FIAT_INFOS, type FiatInfo, type TokenConfig } from "@/config";
import { useSwap2pAdapter } from "@/hooks/use-swap2p-adapter";
import { useNetworkConfig } from "@/hooks/use-network-config";
import { encodeCountryCode } from "@/lib/fiat";
import type { OfferRow } from "@/lib/types/market";
import { SwapSide, type OfferWithKey, type MakerProfile, type Offer } from "@/lib/swap2p/types";
import { ANY_FILTER_OPTION, readStoredFilters } from "@/components/offers/filter-storage";
import { debug, error as logError, info as logInfo, warn as logWarn } from "@/lib/logger";
import { resolvePartnerAddress } from "@/lib/partner";
import {
  OfferFormSchema,
  OfferUpdateSchema,
  sanitizeCountryCode,
  sanitizePaymentMethods,
  sanitizeRequirements,
  sanitizeTokenSymbol,
} from "@/lib/validation";
import {
  deriveFiatMetadataFromCountry,
  deriveFiatMetadataFromEncoded,
  mergeOfferWithOnchain,
  resolveTokenMetadata
} from "@/lib/offers/normalize";
import { scalePrice } from "@/lib/pricing";

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
  refreshOffer: (offer: OfferRow) => Promise<OfferRow | null>;
  createOffer: (input: CreateOfferInput) => Promise<OfferRow>;
  updateOffer: (offer: OfferRow, updates: OfferUpdateInput) => Promise<OfferRow>;
  removeOffer: (offer: OfferRow) => Promise<void>;
  makerProfile: MakerProfile | null;
  makerProfileLoading: boolean;
  makerProfileUpdating: boolean;
  setMakerOnline: (online: boolean) => Promise<void>;
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
  requirements?: string;
}

const OffersContext = React.createContext<OffersContextValue | null>(null);

const OFFER_FETCH_LIMIT = 100;
const OFFER_CACHE_TTL_MS = 60_000;
const toSideLabel = (side: SwapSide): OfferRow["side"] =>
  side === SwapSide.SELL ? "SELL" : "BUY";

const EMPTY_PROFILE: MakerProfile = {
  online: false,
  nickname: "",
  dealsCancelled: 0,
  dealsCompleted: 0,
  chatPublicKey: "",
};

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
  const fiatMeta = deriveFiatMetadataFromEncoded(offer.fiat);

  const baseRow: OfferRow = {
    id: entry.id,
    side: toSideLabel(offer.side),
    maker: key.maker,
    token: options.tokenSymbol,
    tokenDecimals: options.tokenDecimals,
    fiat: fiatMeta.fiatLabel,
    countryCode: fiatMeta.countryCode,
    currencyCode: fiatMeta.currencyCode,
    price: 0,
    minAmount: 0,
    maxAmount: 0,
    paymentMethods: "",
    requirements: "",
    updatedAt: new Date(timestampMs || Date.now()).toISOString(),
    contractKey: entry.key,
    contract: offer,
    contractFiatCode: offer.fiat,
    contractId: entry.id,
    online: entry.online,
  };

  return mergeOfferWithOnchain(baseRow, offer, options.tokenDecimals);
};

const makeCacheKey = (tokenAddress: string, side: SwapSide, fiat: number) =>
  `${tokenAddress.toLowerCase()}|${side}|${fiat}`;

const METHODS_SEPARATOR = ", ";

const parseMethodList = (raw?: string): string[] =>
  raw
    ? raw
        .split(",")
        .map(method => method.trim())
        .filter(Boolean)
    : [];

const formatMethodList = (methods: string[]): string => {
  const unique = Array.from(
    new Set(methods.map(method => method.trim()).filter(Boolean))
  );
  return unique.join(METHODS_SEPARATOR);
};

const sanitizeMethods = sanitizePaymentMethods;

export function OffersProvider({ children }: { children: React.ReactNode }) {
  const { address } = useUser();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId });
  const { adapter } = useSwap2pAdapter();
  const { network: currentNetwork, isSupported } = useNetworkConfig(chainId);

  const tokenConfigs = React.useMemo(
    () =>
      currentNetwork.tokens.map(token => ({
        ...token,
        address: getAddress(token.address),
      })),
    [currentNetwork.tokens],
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
  const [makerProfile, setMakerProfile] = React.useState<MakerProfile | null>(null);
  const [makerProfileLoading, setMakerProfileLoading] = React.useState(false);
  const [makerProfileUpdating, setMakerProfileUpdating] = React.useState(false);

  React.useEffect(() => {
    cacheRef.current.clear();
    setCacheVersion(version => version + 1);
  }, [adapter, isSupported, tokenConfigs]);

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

  React.useEffect(() => {
    if (!adapter || !address || !isSupported) {
      setMakerProfile(null);
      setMakerProfileLoading(false);
      return;
    }
    let cancelled = false;
    setMakerProfileLoading(true);
    (async () => {
      try {
        const profile = await adapter.getMakerProfile(getAddress(address));
        if (!cancelled) {
          setMakerProfile(profile ?? EMPTY_PROFILE);
        }
      } catch (error) {
        logError("offers-provider", "failed to load maker profile", error);
        if (!cancelled) {
          setMakerProfile(EMPTY_PROFILE);
        }
      } finally {
        if (!cancelled) {
          setMakerProfileLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adapter, address, isSupported]);

  const setMakerOnline = React.useCallback(
    async (online: boolean) => {
      if (!adapter) {
        throw new Error("Swap2p contract unavailable. Connect a wallet and try again.");
      }
      if (!isSupported) {
        throw new Error("Swap2p is not available on this network.");
      }
      if (!address) {
        throw new Error("Connect your wallet to change availability.");
      }
      if (!publicClient) {
        throw new Error("Public client unavailable for the current network.");
      }

      setMakerProfileUpdating(true);
      try {
        const account = getAddress(address);
        const txHash: Hash = await adapter.setOnline({
          account,
          online,
        });
        await publicClient.waitForTransactionReceipt({ hash: txHash });
        setMakerProfile(prev => {
          const base = prev ?? EMPTY_PROFILE;
          return { ...base, online };
        });
      } catch (error) {
        logError("offers-provider", "failed to set maker availability", error);
        const message = error instanceof Error ? error.message : "Failed to update availability.";
        throw new Error(message);
      } finally {
        setMakerProfileUpdating(false);
      }
    },
    [adapter, address, isSupported, publicClient],
  );

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
      if (!adapter || !isSupported || !tokenConfigs.length) return;
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
            debug("offers:loadOffersFor", {
              token: token.symbol,
              side: toSideLabel(makerSide),
              fiat: fiat.info.shortLabel,
              count: mapped.length,
            });
          } catch (error) {
            logError(
              "offers-provider",
              "failed to fetch offers",
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
    [adapter, isSupported, tokenConfigs],
  );

  const loadMakerOffers = React.useCallback(
    async (force = false): Promise<OfferRow[]> => {
      if (!adapter || !address || !isSupported || !tokenConfigs.length) {
        makerCacheRef.current = null;
        setMakerChainOffers([]);
        return [];
      }
      const cached = makerCacheRef.current;
      if (!force && cached && Date.now() - cached.fetchedAt <= OFFER_CACHE_TTL_MS) {
        setMakerChainOffers(cached.items);
        return cached.items;
      }
      setIsMakerLoading(true);
      try {
        const entries = await adapter.getMakerOffers({
          maker: getAddress(address),
          offset: 0,
          limit: OFFER_FETCH_LIMIT,
        });
        const mapped = entries
          .map(entry => {
            const tokenInfo = tokenConfigs.find(
              token => token.address.toLowerCase() === entry.key.token.toLowerCase(),
            );
            const tokenSymbol = tokenInfo?.symbol ?? entry.offer.token;
            const tokenDecimals = tokenInfo?.decimals ?? 18;
            return mapOffer(entry, {
              tokenSymbol,
              tokenDecimals,
            });
          })
          .filter((item): item is OfferRow => Boolean(item));
        makerCacheRef.current = { items: mapped, fetchedAt: Date.now() };
        setMakerChainOffers(mapped);
        return mapped;
      } catch (error) {
        logError("offers-provider", "failed to fetch maker offers", { maker: address }, error);
        makerCacheRef.current = { items: [], fetchedAt: Date.now() };
        setMakerChainOffers([]);
        return [];
      } finally {
        setIsMakerLoading(false);
      }
    },
    [adapter, address, isSupported, tokenConfigs],
  );

  React.useEffect(() => {
    makerCacheRef.current = null;
    setMakerChainOffers([]);
    if (!adapter || !address || !isSupported) {
      setIsMakerLoading(false);
      return;
    }
    void loadMakerOffers(true);
  }, [adapter, address, isSupported, loadMakerOffers]);

  const updateOfferInCaches = React.useCallback((updated: OfferRow) => {
    let mutated = false;

    cacheRef.current.forEach((bucket, key) => {
      const index = bucket.items.findIndex(item => item.id === updated.id);
      if (index !== -1) {
        const items = [...bucket.items];
        items[index] = updated;
        cacheRef.current.set(key, { items, fetchedAt: bucket.fetchedAt });
        mutated = true;
      }
    });

    if (makerCacheRef.current) {
      const index = makerCacheRef.current.items.findIndex(item => item.id === updated.id);
      if (index !== -1) {
        const items = [...makerCacheRef.current.items];
        items[index] = updated;
        makerCacheRef.current = { items, fetchedAt: makerCacheRef.current.fetchedAt };
        mutated = true;
      }
    }

    setMakerChainOffers(prev => {
      const index = prev.findIndex(item => item.id === updated.id);
      if (index === -1) return prev;
      mutated = true;
      const next = [...prev];
      next[index] = updated;
      return next;
    });

    setDraftOffers(prev => {
      const index = prev.findIndex(item => item.id === updated.id);
      if (index === -1) return prev;
      mutated = true;
      const next = [...prev];
      next[index] = updated;
      return next;
    });

    if (mutated) {
      setCacheVersion(version => version + 1);
    }
  }, []);

  const removeOfferFromCaches = React.useCallback((id: string) => {
    let mutated = false;

    cacheRef.current.forEach((bucket, key) => {
      const filtered = bucket.items.filter(item => item.id !== id);
      if (filtered.length !== bucket.items.length) {
        cacheRef.current.set(key, { items: filtered, fetchedAt: bucket.fetchedAt });
        mutated = true;
      }
    });

    if (makerCacheRef.current) {
      const filtered = makerCacheRef.current.items.filter(item => item.id !== id);
      if (filtered.length !== makerCacheRef.current.items.length) {
        makerCacheRef.current = { items: filtered, fetchedAt: makerCacheRef.current.fetchedAt };
        mutated = true;
      }
    }

    setMakerChainOffers(prev => {
      const filtered = prev.filter(item => item.id !== id);
      if (filtered.length === prev.length) return prev;
      mutated = true;
      return filtered;
    });

    setDraftOffers(prev => {
      const filtered = prev.filter(item => item.id !== id);
      if (filtered.length === prev.length) return prev;
      mutated = true;
      return filtered;
    });

    if (mutated) {
      setCacheVersion(version => version + 1);
    }
  }, []);

  const refreshOffer = React.useCallback(
    async (target: OfferRow) => {
      if (!adapter || !target.contractKey) {
        return null;
      }

      try {
        const onchain = await adapter.getOffer(target.contractKey);
        if (!onchain) {
          removeOfferFromCaches(target.id);
          return null;
        }

        const tokenMeta = resolveTokenMetadata(tokenConfigs, {
          address: target.contractKey.token,
          symbol: target.token
        });

        const baseRow: OfferRow = {
          ...target,
          token: tokenMeta.symbol || target.token,
          tokenDecimals: tokenMeta.decimals
        };

        const updated = mergeOfferWithOnchain(baseRow, onchain, tokenMeta.decimals);
        updateOfferInCaches(updated);
        return updated;
      } catch (error) {
        logError("offers-provider", "failed to refresh offer", { id: target.id }, error);
        return null;
      }
    },
    [adapter, removeOfferFromCaches, tokenConfigs, updateOfferInCaches]
  );

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
      if (!isSupported) {
        debug("offers:ensureMarket:skip", { reason: "unsupported-network", side, fiat });
        setIsLoading(false);
        return;
      }
      debug("offers:ensureMarket:request", { side, fiat, force });
      const normalizedFiat = fiat.toUpperCase();
      const fallback = fiatLookup.get(defaultFiat.toUpperCase());
      const fiatEntry = fiatLookup.get(normalizedFiat) ?? fallback;
      if (!fiatEntry) return;
      setActiveMarket(prev => {
        if (prev.side === side && prev.fiat === fiatEntry.info.countryCode) {
          debug("offers:ensureMarket:unchanged", prev);
          return prev;
        }
        debug("offers:ensureMarket:update", { side, fiat: fiatEntry.info.countryCode });
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
        debug("offers:ensureMarket:cache-hit", {
          makerSide: toSideLabel(makerSide),
          fiat: fiatEntry.info.shortLabel,
        });
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
    [adapter, defaultFiat, fiatLookup, isSupported, loadOffersFor, tokenConfigs],
  );

  const refresh = React.useCallback(async () => {
    await ensureMarket({
      side: activeMarket.side,
      fiat: activeMarket.fiat,
      force: true,
    });
  }, [activeMarket.side, activeMarket.fiat, ensureMarket]);

  const refreshMakerOffers = React.useCallback(async () => {
    await loadMakerOffers(true);
  }, [loadMakerOffers]);

  const ensureMarketOnBoot = React.useCallback(() => {
    if (!adapter || !isSupported) {
      setIsLoading(false);
      return;
    }
    const stored = readStoredFilters();
    const storedSide =
      stored?.side === "BUY" || stored?.side === "SELL" ? stored.side : activeMarket.side;
    const rawFiat = typeof stored?.fiat === "string" ? stored.fiat : activeMarket.fiat;
    const normalizedFiat =
      rawFiat === ANY_FILTER_OPTION ? defaultFiat : rawFiat.toUpperCase();
    void ensureMarket({ side: storedSide, fiat: normalizedFiat });
  }, [adapter, isSupported, ensureMarket, activeMarket.side, activeMarket.fiat, defaultFiat]);

  React.useEffect(() => {
    ensureMarketOnBoot();
  }, [ensureMarketOnBoot]);

  React.useEffect(() => {
    setDraftOffers([]);
  }, [address, isSupported]);

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
      const supportsOnlineFlag = bucket.items.some(item => item.online !== undefined);
      for (const offer of bucket.items) {
        if (supportsOnlineFlag && offer.online === false) {
          continue;
        }
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
    debug("offers:compute", {
      market: {
        side: activeMarket.side,
        countryCode: activeMarket.fiat,
        label: fiatEntry.info.shortLabel,
      },
      makerSide: expectedSideLabel,
      count: result.length,
      cacheVersion,
    });
    return result;
  }, [activeMarket, cacheVersion, draftOffers, tokenConfigs, fiatLookup, defaultFiat]);

  const createOffer = React.useCallback(
    async ({
      side,
      token,
      countryCode,
      price,
      minAmount,
      maxAmount,
      paymentMethods,
      requirements,
    }: CreateOfferInput) => {
      if (!adapter) {
        throw new Error("Swap2p contract unavailable. Connect a wallet and try again.");
      }
      if (!isSupported) {
        throw new Error("Swap2p is not available on this network.");
      }
      if (!address) {
        throw new Error("Connect your wallet to publish an offer.");
      }
      if (!publicClient) {
        throw new Error("Public client unavailable for the current network.");
      }

      const normalizedToken = sanitizeTokenSymbol(token);
      const normalizedCountryInput = sanitizeCountryCode(countryCode);
      const sanitizedMethods = sanitizeMethods(paymentMethods);
      const sanitizedRequirements = sanitizeRequirements(requirements ?? "");
      const formValidation = OfferFormSchema.safeParse({
        side,
        token: normalizedToken || token,
        countryCode: normalizedCountryInput || countryCode.toUpperCase(),
        price,
        minAmount,
        maxAmount,
        paymentMethods: sanitizedMethods,
        requirements: sanitizedRequirements,
      });
      if (!formValidation.success) {
        const issue = formValidation.error.issues[0];
        throw new Error(issue?.message ?? "Offer parameters are invalid.");
      }
      const validated = formValidation.data;

      const tokenMeta = resolveTokenMetadata(tokenConfigs, { symbol: validated.token });
      if (!tokenMeta.address) {
        throw new Error(`Unsupported token ${validated.token}.`);
      }
      const decimals = tokenMeta.decimals;

      let fiatMeta;
      try {
        fiatMeta = deriveFiatMetadataFromCountry(validated.countryCode);
      } catch (error) {
        throw new Error(`Unsupported fiat currency ${validated.countryCode.toUpperCase()}.`);
      }

      const fiatLabel = fiatMeta.fiatLabel;
      const currencyCode = fiatMeta.currencyCode;
      const paymentMethodsValue = formatMethodList(validated.paymentMethods);
      const fallbackEntry: OfferRow = {
        id: generateOfferId(),
        side: validated.side,
        maker: address,
        token: tokenMeta.symbol || validated.token,
        tokenDecimals: decimals,
        fiat: fiatLabel,
        countryCode: fiatMeta.countryCode,
        currencyCode,
        price: validated.price,
        minAmount: validated.minAmount,
        maxAmount: validated.maxAmount,
        paymentMethods: paymentMethodsValue,
        requirements: validated.requirements,
        updatedAt: new Date().toISOString(),
        contractFiatCode: fiatMeta.encodedFiat,
        online: makerProfile?.online,
      };

      const makerAccount = getAddress(address);
      const sideValue = validated.side === "SELL" ? SwapSide.SELL : SwapSide.BUY;
      const priceScaled = scalePrice(validated.price);
      const minAmountScaled = parseUnits(String(validated.minAmount), decimals);
      const maxAmountScaled = parseUnits(String(validated.maxAmount), decimals);
      const requirementsValue = validated.requirements;

      const partnerAddress = resolvePartnerAddress();

      const txHash: Hash = await adapter.makerMakeOffer({
        account: makerAccount,
        token: tokenMeta.address,
        side: sideValue,
        fiat: fiatMeta.encodedFiat,
        price: priceScaled,
        minAmount: minAmountScaled,
        maxAmount: maxAmountScaled,
        paymentMethods: paymentMethodsValue,
        requirements: requirementsValue,
        partner: partnerAddress,
      });

      await publicClient.waitForTransactionReceipt({ hash: txHash });

      cacheRef.current.clear();
      setCacheVersion(version => version + 1);
      makerCacheRef.current = null;

      const refreshed = await refreshOffer(fallbackEntry);
      return refreshed ?? fallbackEntry;
    },
    [adapter, address, isSupported, loadMakerOffers, publicClient, refresh, tokenConfigs, makerProfile],
  );

  const updateOffer = React.useCallback(
    async (offer: OfferRow, updates: OfferUpdateInput) => {
      if (!adapter) {
        throw new Error("Swap2p contract unavailable. Connect a wallet and try again.");
      }
      if (!isSupported) {
        throw new Error("Swap2p is not available on this network.");
      }
      if (!address) {
        throw new Error("Connect your wallet to update an offer.");
      }
      if (!publicClient) {
        throw new Error("Public client unavailable for the current network.");
      }
      const key = offer.contractKey;
      if (!key) {
        throw new Error("Offer is not published on-chain yet.");
      }

      const sanitizedUpdates: OfferUpdateInput = {};
      if (updates.price !== undefined) sanitizedUpdates.price = updates.price;
      if (updates.minAmount !== undefined) sanitizedUpdates.minAmount = updates.minAmount;
      if (updates.maxAmount !== undefined) sanitizedUpdates.maxAmount = updates.maxAmount;
      if (updates.paymentMethods !== undefined) sanitizedUpdates.paymentMethods = sanitizeMethods(updates.paymentMethods);
      if (updates.requirements !== undefined) sanitizedUpdates.requirements = sanitizeRequirements(updates.requirements);

      const updateValidation = OfferUpdateSchema.safeParse(sanitizedUpdates);
      if (!updateValidation.success) {
        const issue = updateValidation.error.issues[0];
        throw new Error(issue?.message ?? "Offer update is invalid.");
      }
      const validatedUpdates = updateValidation.data;

      const makerAccount = getAddress(address);
      const tokenAddress = key.token;
      const normalizedToken = tokenAddress.toLowerCase();
      const tokenInfo = tokenConfigs.find(item => item.address.toLowerCase() === normalizedToken);
      const decimals = offer.tokenDecimals ?? tokenInfo?.decimals ?? 18;

      let onchainOffer: Offer | null = null;
      try {
        onchainOffer = await adapter.getOffer(key);
      } catch (error) {
        logWarn("offers-provider", "failed to fetch on-chain offer before update", error);
      }

      const priceToScaled = (value: number) => scalePrice(value);
      const existingPriceScaled = onchainOffer
        ? BigInt(onchainOffer.priceFiatPerToken)
        : priceToScaled(offer.price);
      const desiredPriceScaled =
        validatedUpdates.price !== undefined ? priceToScaled(validatedUpdates.price) : existingPriceScaled;
      const priceArg = desiredPriceScaled === existingPriceScaled ? 0n : desiredPriceScaled;

      const existingMinAmount = onchainOffer
        ? onchainOffer.minAmount
        : parseUnits(String(offer.minAmount), decimals);
      const desiredMinAmount =
        validatedUpdates.minAmount !== undefined
          ? parseUnits(String(validatedUpdates.minAmount), decimals)
          : existingMinAmount;
      const minArg = desiredMinAmount === existingMinAmount ? 0n : desiredMinAmount;

      const existingMaxAmount = onchainOffer
        ? onchainOffer.maxAmount
        : parseUnits(String(offer.maxAmount), decimals);
      const desiredMaxAmount =
        validatedUpdates.maxAmount !== undefined
          ? parseUnits(String(validatedUpdates.maxAmount), decimals)
          : existingMaxAmount;
      const maxArg = desiredMaxAmount === existingMaxAmount ? 0n : desiredMaxAmount;

      const currentMethodsList = sanitizeMethods(
        onchainOffer ? parseMethodList(onchainOffer.paymentMethods) : parseMethodList(offer.paymentMethods),
      );
      const nextMethodsList = sanitizeMethods(
        validatedUpdates.paymentMethods !== undefined ? validatedUpdates.paymentMethods : currentMethodsList,
      );
      const paymentMethodsValue = formatMethodList(nextMethodsList);
      const existingMethodsValue = formatMethodList(currentMethodsList);
      const paymentMethodsArg = paymentMethodsValue === existingMethodsValue ? "" : paymentMethodsValue;

      const existingRequirementsValue = sanitizeRequirements(
        onchainOffer?.requirements ?? offer.requirements ?? "",
      );
      const desiredRequirementsValue =
        validatedUpdates.requirements !== undefined
          ? sanitizeRequirements(validatedUpdates.requirements)
          : existingRequirementsValue;
      const requirementsArg =
        desiredRequirementsValue === existingRequirementsValue ? "" : desiredRequirementsValue;

      const partnerAddress = resolvePartnerAddress();

      const txPayload = {
        account: makerAccount,
        token: tokenAddress,
        side: key.side,
        fiat: key.fiat,
        price: priceArg,
        minAmount: minArg,
        maxAmount: maxArg,
        paymentMethods: paymentMethodsArg,
        requirements: requirementsArg,
        partner: partnerAddress,
      };

      logInfo("offers-provider", "update payload", {
        offerId: offer.id,
        payload: {
          price: txPayload.price,
          minAmount: txPayload.minAmount,
          maxAmount: txPayload.maxAmount,
          paymentMethods: txPayload.paymentMethods,
          requirements: txPayload.requirements,
        },
      });

      const txHash: Hash = await adapter.makerMakeOffer(txPayload);

      await publicClient.waitForTransactionReceipt({ hash: txHash });

      cacheRef.current.clear();
      setCacheVersion(version => version + 1);
      makerCacheRef.current = null;

      const refreshed = await refreshOffer(offer);
      if (refreshed) {
        return refreshed;
      }

      const fallbackUpdated: OfferRow = {
        ...offer,
        price: validatedUpdates.price ?? offer.price,
        minAmount: validatedUpdates.minAmount ?? offer.minAmount,
        maxAmount: validatedUpdates.maxAmount ?? offer.maxAmount,
        paymentMethods: paymentMethodsValue,
        requirements: desiredRequirementsValue,
        updatedAt: new Date().toISOString(),
      };
      updateOfferInCaches(fallbackUpdated);
      return fallbackUpdated;
    },
    [adapter, address, isSupported, loadMakerOffers, publicClient, refresh, tokenConfigs],
  );

  const removeOffer = React.useCallback(
    async (offer: OfferRow) => {
      if (!adapter) {
        throw new Error("Swap2p contract unavailable. Connect a wallet and try again.");
      }
      if (!isSupported) {
        throw new Error("Swap2p is not available on this network.");
      }
      if (!address) {
        throw new Error("Connect your wallet to delete an offer.");
      }
      if (!publicClient) {
        throw new Error("Public client unavailable for the current network.");
      }
      const key = offer.contractKey;
      if (!key) {
        // Fallback: remove locally if not on-chain yet
        setDraftOffers(current => current.filter(entry => entry.id !== offer.id));
        return;
      }

      const txHash: Hash = await adapter.makerDeleteOffer({
        account: getAddress(address),
        maker: getAddress(address),
        token: key.token,
        side: key.side,
        fiat: key.fiat,
      });

      await publicClient.waitForTransactionReceipt({ hash: txHash });

      cacheRef.current.clear();
      setCacheVersion(version => version + 1);
      makerCacheRef.current = null;
      setDraftOffers(current => current.filter(entry => entry.id !== offer.id));

      await loadMakerOffers(true);
      await refresh();
    },
    [adapter, address, isSupported, loadMakerOffers, publicClient, refresh],
  );

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
      refreshOffer,
      createOffer,
      updateOffer,
      removeOffer,
      makerProfile,
      makerProfileLoading,
      makerProfileUpdating,
      setMakerOnline,
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
      refreshOffer,
      createOffer,
      updateOffer,
      removeOffer,
      makerProfile,
      makerProfileLoading,
      makerProfileUpdating,
      setMakerOnline,
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
