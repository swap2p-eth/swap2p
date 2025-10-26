"use client";

import * as React from "react";
import { useChainId, usePublicClient } from "wagmi";
import { formatUnits, getAddress, parseUnits, type Hash } from "viem";

import { useUser } from "@/context/user-context";
import { getNetworkConfigForChain } from "@/config";
import { useSwap2pAdapter } from "@/hooks/use-swap2p-adapter";
import { decodeCountryCode, getFiatInfoByCountry } from "@/lib/fiat";
import { normalizeAddress } from "@/lib/deal-utils";
import type { DealRow, DealState } from "@/lib/types/market";
import type { OfferRow } from "@/lib/types/market";
import { SwapDealState, SwapSide, type Deal as ContractDeal } from "@/lib/swap2p/types";
import { swap2pAbi } from "@/lib/swap2p/generated";

type AmountKind = "crypto" | "fiat";
export type DealParticipant = "MAKER" | "TAKER";

interface CreateDealInput {
  offer: OfferRow;
  amount: number;
  amountKind: AmountKind;
  paymentMethod: string;
  paymentDetails: string;
}

interface DealsContextValue {
  deals: DealRow[];
  isLoading: boolean;
  createDeal: (input: CreateDealInput) => Promise<DealRow>;
  acceptDeal: (dealId: string, comment?: string) => Promise<void>;
  cancelDeal: (dealId: string, actor: DealParticipant, comment?: string) => Promise<void>;
  markDealPaid: (dealId: string, actor: DealParticipant, comment?: string) => Promise<void>;
  releaseDeal: (dealId: string, actor: DealParticipant, comment?: string) => Promise<void>;
  sendMessage: (dealId: string, message: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const DealsContext = React.createContext<DealsContextValue | null>(null);

const PRICE_SCALE = 1_000;
const DEAL_FETCH_LIMIT = 100;

const stateMap: Record<SwapDealState, DealState> = {
  [SwapDealState.NONE]: "REQUESTED",
  [SwapDealState.REQUESTED]: "REQUESTED",
  [SwapDealState.ACCEPTED]: "ACCEPTED",
  [SwapDealState.PAID]: "PAID",
  [SwapDealState.RELEASED]: "RELEASED",
  [SwapDealState.CANCELED]: "CANCELED",
};

const toSideLabel = (side: SwapSide): DealRow["side"] =>
  side === SwapSide.SELL ? "SELL" : "BUY";

const toHexId = (value: bigint): string => {
  const hex = value.toString(16).padStart(64, "0");
  return `0x${hex}`;
};

const generateDraftId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
    return `0x${hex}`;
  }
  const fallback = Date.now().toString(16).padStart(16, "0");
  return `0x${fallback.padEnd(64, "0").slice(0, 64)}`;
};

const toDealRow = (
  deal: ContractDeal,
  options: {
    tokenSymbol: string;
    tokenDecimals: number;
    userAddress: string;
  },
): DealRow => {
  const amount = Number(formatUnits(deal.amount, options.tokenDecimals));
  const price = Number(deal.price) / PRICE_SCALE;
  // Fiat values arriving from the contract are ISO country codes (uint16)
  const encoded = typeof deal.fiat === "number" ? deal.fiat : 0;
  const decoded = decodeCountryCode(encoded);
  const countryCode = decoded ? decoded.toUpperCase() : "";
  const fiatInfo = getFiatInfoByCountry(countryCode);
  const fiatLabel = fiatInfo?.shortLabel ?? (countryCode || "??");
  const currencyCode = fiatInfo?.currencyCode ?? (countryCode || "");
  const fiatAmount = Number.isFinite(price) ? price * amount : undefined;
  const updatedAtIso = new Date((deal.updatedAt ?? 0) * 1000 || Date.now()).toISOString();
  const normalizedUser = normalizeAddress(options.userAddress);
  const makerAddress = deal.maker;
  const takerAddress = deal.taker;
  const normalizedMaker = normalizeAddress(makerAddress);
  const normalizedTaker = normalizeAddress(takerAddress);
  const partner = normalizedUser === normalizedMaker
    ? takerAddress
    : normalizedUser === normalizedTaker
      ? makerAddress
      : null;

  return {
    id: toHexId(deal.id),
    contractId: deal.id,
    contract: deal,
    side: toSideLabel(deal.side),
    amount,
    fiat: fiatLabel,
    countryCode,
    currencyCode,
    partner,
    state: stateMap[deal.state] ?? "REQUESTED",
    updatedAt: updatedAtIso,
    maker: makerAddress,
    taker: takerAddress,
    token: options.tokenSymbol,
    tokenDecimals: options.tokenDecimals,
    price,
    fiatAmount,
    paymentMethod: deal.paymentMethod,
  };
};

async function fetchChainDeals(
  adapter: ReturnType<typeof useSwap2pAdapter>["adapter"],
  network: ReturnType<typeof getNetworkConfigForChain>,
  userAddress: string,
): Promise<DealRow[]> {
  if (!adapter || !userAddress) return [];

  console.debug("[mydeals] fetchChainDeals:start", {
    user: userAddress,
    network: network.name,
  });

  const tokenMap = new Map<string, { symbol: string; decimals: number }>();
  for (const token of network.tokens) {
    tokenMap.set(getAddress(token.address).toLowerCase(), {
      symbol: token.symbol,
      decimals: token.decimals,
    });
  }

  const user = getAddress(userAddress);

  const [open, recent] = await Promise.all([
    adapter.getOpenDeals({ user, limit: DEAL_FETCH_LIMIT, offset: 0 }),
    adapter.getRecentDeals({ user, limit: DEAL_FETCH_LIMIT, offset: 0 }),
  ]);

  console.debug("[mydeals] fetchChainDeals:reads", {
    openCount: open.length,
    recentCount: recent.length,
  });

  const byId = new Map<string, ContractDeal>();
  for (const deal of [...open, ...recent]) {
    byId.set(deal.id.toString(), deal);
  }

  const mapped = Array.from(byId.values())
    .map(deal => {
      const tokenKey = deal.token.toLowerCase();
      const tokenInfo = tokenMap.get(tokenKey) ?? {
        symbol: deal.token,
        decimals: 18,
      };
      return toDealRow(deal, {
        tokenSymbol: tokenInfo.symbol,
        tokenDecimals: tokenInfo.decimals,
        userAddress,
      });
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  console.debug("[mydeals] fetchChainDeals:completed", {
    total: mapped.length,
  });

  return mapped;
}

export function DealsProvider({ children }: { children: React.ReactNode }) {
  const { address: currentUserAddress } = useUser();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId });
  const { adapter } = useSwap2pAdapter();
  const network = React.useMemo(() => getNetworkConfigForChain(chainId), [chainId]);

  const [chainDeals, setChainDeals] = React.useState<DealRow[]>([]);
  const [draftDeals, setDraftDeals] = React.useState<DealRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  const fetchAndSetDeals = React.useCallback(async () => {
    if (!adapter || !currentUserAddress) {
      setChainDeals([]);
      return [] as DealRow[];
    }
    const next = await fetchChainDeals(adapter, network, currentUserAddress);
    setChainDeals(next);
    return next;
  }, [adapter, currentUserAddress, network]);

  const refresh = React.useCallback(async () => {
    if (!adapter || !currentUserAddress) {
      setChainDeals([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      await fetchAndSetDeals();
    } finally {
      setIsLoading(false);
    }
  }, [adapter, currentUserAddress, fetchAndSetDeals]);

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
    setDraftDeals([]);
  }, [currentUserAddress]);

  const deals = React.useMemo(
    () => [...chainDeals, ...draftDeals],
    [chainDeals, draftDeals],
  );

  const createDeal = React.useCallback(
    async ({ offer, amount, amountKind, paymentMethod, paymentDetails }: CreateDealInput) => {
      void amountKind;
      if (!adapter) {
        throw new Error("Swap2p contract unavailable. Connect a wallet and try again.");
      }
      if (!currentUserAddress) {
        throw new Error("Connect your wallet to request a deal.");
      }
      if (!publicClient) {
        throw new Error("Public client unavailable for the current network.");
      }
      const key = offer.contractKey;
      const fiatCode = key?.fiat ?? offer.contractFiatCode;
      if (!key || fiatCode === undefined) {
        throw new Error("Offer is not available on-chain or fiat code missing.");
      }

      const decimals = offer.tokenDecimals ?? 18;
      const takerAccount = getAddress(currentUserAddress);
      const amountScaled = parseUnits(String(amount), decimals);
      const expectedPrice = BigInt(Math.round(offer.price * PRICE_SCALE));
      const previousIds = new Set(chainDeals.map(deal => deal.id.toLowerCase()));

      let expectedDealId: string | null = null;
      try {
        const result = (await publicClient.readContract({
          address: network.swap2pAddress,
          abi: swap2pAbi,
          functionName: "previewNextDealId",
          args: [takerAccount],
        })) as readonly [string, bigint];
        const [previewId] = result;
        if (typeof previewId === "string") {
          expectedDealId = previewId;
        }
      } catch (error) {
        console.debug("[swap2p] previewNextDealId failed", error);
      }

      const txHash: Hash = await adapter.takerRequestOffer({
        account: takerAccount,
        token: key.token,
        side: key.side,
        maker: key.maker,
        amount: amountScaled,
        fiat: fiatCode,
        expectedPrice,
        paymentMethod,
        details: paymentDetails,
        partner: null,
      });

      await publicClient.waitForTransactionReceipt({ hash: txHash });

      const nextDeals = await fetchAndSetDeals();
      setDraftDeals([]);

      const expectedIdLower = expectedDealId ? expectedDealId.toLowerCase() : null;
      const created =
        (expectedIdLower
          ? nextDeals.find(deal => deal.id.toLowerCase() === expectedIdLower)
          : undefined) ??
        nextDeals.find(deal => !previousIds.has(deal.id.toLowerCase()));

      if (created) {
        return created;
      }

      const fallbackId = expectedDealId ?? generateDraftId();
      return {
        id: fallbackId,
        contractId: expectedDealId ? BigInt(expectedDealId) : undefined,
        side: offer.side,
        amount,
        fiat: offer.fiat,
        countryCode: offer.countryCode,
        currencyCode: offer.currencyCode,
        partner: offer.maker,
        state: "REQUESTED",
        updatedAt: new Date().toISOString(),
        maker: offer.maker,
        taker: currentUserAddress ?? "",
        token: offer.token,
        tokenDecimals: offer.tokenDecimals,
        price: offer.price,
        fiatAmount: offer.price * amount,
        paymentMethod,
      };
    },
    [adapter, chainDeals, currentUserAddress, fetchAndSetDeals, network.swap2pAddress, publicClient],
  );

  const findDeal = React.useCallback(
    (dealId: string): DealRow | null =>
      chainDeals.find(deal => deal.id === dealId) ??
      draftDeals.find(deal => deal.id === dealId) ??
      null,
    [chainDeals, draftDeals],
  );

  const requireContractDeal = React.useCallback(
    (dealId: string) => {
      const deal = findDeal(dealId);
      if (!deal || deal.contractId === undefined) {
        throw new Error("Deal is not synced on-chain yet. Refresh and try again.");
      }
      return deal;
    },
    [findDeal],
  );

  const acceptDeal = React.useCallback(
    async (dealId: string, comment?: string) => {
      if (!adapter) {
        throw new Error("Swap2p contract unavailable. Connect a wallet and try again.");
      }
      if (!currentUserAddress) {
        throw new Error("Connect your wallet to accept the deal.");
      }
      if (!publicClient) {
        throw new Error("Public client unavailable for the current network.");
      }
      const deal = requireContractDeal(dealId);
      const txHash: Hash = await adapter.makerAcceptRequest({
        account: getAddress(currentUserAddress),
        id: deal.contractId,
        message: comment,
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      await fetchAndSetDeals();
    },
    [adapter, currentUserAddress, fetchAndSetDeals, publicClient, requireContractDeal],
  );

  const cancelDeal = React.useCallback(
    async (dealId: string, actor: DealParticipant, comment?: string) => {
      void actor;
      if (!adapter) {
        throw new Error("Swap2p contract unavailable. Connect a wallet and try again.");
      }
      if (!currentUserAddress) {
        throw new Error("Connect your wallet to cancel the deal.");
      }
      if (!publicClient) {
        throw new Error("Public client unavailable for the current network.");
      }
      const deal = requireContractDeal(dealId);
      let txHash: Hash;
      if (deal.state === "REQUESTED") {
        txHash = await adapter.cancelRequest({
          account: getAddress(currentUserAddress),
          id: deal.contractId,
          reason: comment,
        });
      } else if (deal.state === "ACCEPTED") {
        txHash = await adapter.cancelDeal({
          account: getAddress(currentUserAddress),
          id: deal.contractId,
          reason: comment,
        });
      } else {
        throw new Error("Deal cannot be canceled in its current state.");
      }
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      await fetchAndSetDeals();
    },
    [adapter, currentUserAddress, fetchAndSetDeals, publicClient, requireContractDeal],
  );

  const markDealPaid = React.useCallback(
    async (dealId: string, actor: DealParticipant, comment?: string) => {
      void actor;
      if (!adapter) {
        throw new Error("Swap2p contract unavailable. Connect a wallet and try again.");
      }
      if (!currentUserAddress) {
        throw new Error("Connect your wallet to mark the deal as paid.");
      }
      if (!publicClient) {
        throw new Error("Public client unavailable for the current network.");
      }
      const deal = requireContractDeal(dealId);
      if (deal.state !== "ACCEPTED") {
        throw new Error("Deal must be accepted before marking as paid.");
      }
      const txHash: Hash = await adapter.markFiatPaid({
        account: getAddress(currentUserAddress),
        id: deal.contractId,
        message: comment,
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      await fetchAndSetDeals();
    },
    [adapter, currentUserAddress, fetchAndSetDeals, publicClient, requireContractDeal],
  );

  const releaseDeal = React.useCallback(
    async (dealId: string, actor: DealParticipant, comment?: string) => {
      void actor;
      if (!adapter) {
        throw new Error("Swap2p contract unavailable. Connect a wallet and try again.");
      }
      if (!currentUserAddress) {
        throw new Error("Connect your wallet to release the deal.");
      }
      if (!publicClient) {
        throw new Error("Public client unavailable for the current network.");
      }
      const deal = requireContractDeal(dealId);
      if (deal.state !== "PAID") {
        throw new Error("Deal must be marked as paid before releasing.");
      }
      const txHash: Hash = await adapter.release({
        account: getAddress(currentUserAddress),
        id: deal.contractId,
        message: comment,
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      await fetchAndSetDeals();
    },
    [adapter, currentUserAddress, fetchAndSetDeals, publicClient, requireContractDeal],
  );

  const sendMessage = React.useCallback(
    async (dealId: string, message: string) => {
      if (!adapter) {
        throw new Error("Swap2p contract unavailable. Connect a wallet and try again.");
      }
      if (!currentUserAddress) {
        throw new Error("Connect your wallet to send messages.");
      }
      if (!publicClient) {
        throw new Error("Public client unavailable for the current network.");
      }
      const trimmed = message.trim();
      if (!trimmed) return;
      const deal = requireContractDeal(dealId);
      const txHash: Hash = await adapter.sendMessage({
        account: getAddress(currentUserAddress),
        id: deal.contractId,
        message: trimmed,
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      await fetchAndSetDeals();
    },
    [adapter, currentUserAddress, fetchAndSetDeals, publicClient, requireContractDeal],
  );

  const value = React.useMemo<DealsContextValue>(
    () => ({
      deals,
      createDeal,
      acceptDeal,
      cancelDeal,
      markDealPaid,
      releaseDeal,
      sendMessage,
      isLoading,
      refresh,
    }),
    [deals, createDeal, acceptDeal, cancelDeal, markDealPaid, releaseDeal, sendMessage, isLoading, refresh],
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
