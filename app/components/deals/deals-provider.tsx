"use client";

import * as React from "react";
import { useChainId } from "wagmi";
import { formatUnits, getAddress } from "viem";

import { useUser } from "@/context/user-context";
import { getNetworkConfigForChain } from "@/config";
import { useSwap2pAdapter } from "@/hooks/use-swap2p-adapter";
import { safeFiatCodeToString } from "@/lib/fiat";
import { normalizeAddress } from "@/lib/deal-utils";
import type { DealRow, DealState } from "@/lib/types/market";
import type { OfferRow } from "@/lib/types/market";
import { SwapDealState, SwapSide, type Deal as ContractDeal } from "@/lib/swap2p/types";

type AmountKind = "crypto" | "fiat";
export type DealParticipant = "MAKER" | "TAKER";

interface CreateDealInput {
  offer: OfferRow;
  amount: number;
  amountKind: AmountKind;
  paymentMethod: string;
}

interface DealsContextValue {
  deals: DealRow[];
  isLoading: boolean;
  createDeal: (input: CreateDealInput) => DealRow;
  acceptDeal: (dealId: string, comment?: string) => void;
  cancelDeal: (dealId: string, actor: DealParticipant, comment?: string) => void;
  markDealPaid: (dealId: string, actor: DealParticipant, comment?: string) => void;
  releaseDeal: (dealId: string, actor: DealParticipant, comment?: string) => void;
  refresh: () => Promise<void>;
}

const DealsContext = React.createContext<DealsContextValue | null>(null);

const PRICE_SCALE = 1_000;
const DEAL_FETCH_LIMIT = 50;

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
  const fiatAmount = Number.isFinite(price) ? price * amount : undefined;
  const fiatCode = safeFiatCodeToString(deal.fiat);
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
    id: deal.id.toString(),
    contractId: deal.id,
    contract: deal,
    side: toSideLabel(deal.side),
    amount,
    fiatCode,
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
  const { adapter } = useSwap2pAdapter();
  const network = React.useMemo(() => getNetworkConfigForChain(chainId), [chainId]);

  const [chainDeals, setChainDeals] = React.useState<DealRow[]>([]);
  const [draftDeals, setDraftDeals] = React.useState<DealRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  const refresh = React.useCallback(async () => {
    if (!adapter || !currentUserAddress) {
      setChainDeals([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const next = await fetchChainDeals(adapter, network, currentUserAddress);
      setChainDeals(next);
    } finally {
      setIsLoading(false);
    }
  }, [adapter, network, currentUserAddress]);

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
    ({ offer, amount, amountKind, paymentMethod }: CreateDealInput) => {
      void amountKind;
      const now = new Date().toISOString();
      const id = `${Date.now()}`;
      const entry: DealRow = {
        id,
        side: offer.side,
        amount,
        fiatCode: offer.fiat,
        partner: null,
        state: "REQUESTED",
        updatedAt: now,
        maker: offer.maker,
        taker: currentUserAddress,
        token: offer.token,
        tokenDecimals: offer.tokenDecimals,
        price: offer.price,
        fiatAmount: offer.price * amount,
      paymentMethod,
    };
      setDraftDeals(current => [entry, ...current]);
      return entry;
    },
    [currentUserAddress],
  );

  const updateDeal = React.useCallback((dealId: string, updater: (deal: DealRow) => DealRow | null) => {
    let modified = false;
    setDraftDeals(current =>
      current.map(deal => {
        if (deal.id !== dealId) return deal;
        const next = updater(deal);
        if (next) {
          modified = true;
        }
        return next ?? deal;
      }),
    );
    if (modified) return;
    setChainDeals(current =>
      current.map(deal => {
        if (deal.id !== dealId) return deal;
        const next = updater(deal);
        return next ?? deal;
      }),
    );
  }, []);

  const acceptDeal = React.useCallback(
    (dealId: string) => {
      updateDeal(dealId, deal => {
        if (deal.state !== "REQUESTED") return null;
        return { ...deal, state: "ACCEPTED", updatedAt: new Date().toISOString() };
      });
    },
    [updateDeal],
  );

  const cancelDeal = React.useCallback(
    (dealId: string, actor: DealParticipant) => {
      updateDeal(dealId, deal => {
        if (deal.state === "REQUESTED") {
          return { ...deal, state: "CANCELED", updatedAt: new Date().toISOString() };
        }
        if (deal.state === "ACCEPTED") {
          const makerCanCancel = deal.side === "BUY" && actor === "MAKER";
          const takerCanCancel = deal.side === "SELL" && actor === "TAKER";
          if (makerCanCancel || takerCanCancel) {
            return { ...deal, state: "CANCELED", updatedAt: new Date().toISOString() };
          }
        }
        return null;
      });
    },
    [updateDeal],
  );

  const markDealPaid = React.useCallback(
    (dealId: string, actor: DealParticipant) => {
      updateDeal(dealId, deal => {
        if (deal.state !== "ACCEPTED") return null;
        const makerPays = deal.side === "BUY" && actor === "MAKER";
        const takerPays = deal.side === "SELL" && actor === "TAKER";
        if (!makerPays && !takerPays) return null;
        return { ...deal, state: "PAID", updatedAt: new Date().toISOString() };
      });
    },
    [updateDeal],
  );

  const releaseDeal = React.useCallback(
    (dealId: string, actor: DealParticipant) => {
      updateDeal(dealId, deal => {
        if (deal.state !== "PAID") return null;
        const takerReleases = deal.side === "BUY" && actor === "TAKER";
        const makerReleases = deal.side === "SELL" && actor === "MAKER";
        if (!takerReleases && !makerReleases) return null;
        return { ...deal, state: "RELEASED", updatedAt: new Date().toISOString() };
      });
    },
    [updateDeal],
  );

  const value = React.useMemo<DealsContextValue>(
    () => ({ deals, createDeal, acceptDeal, cancelDeal, markDealPaid, releaseDeal, isLoading, refresh }),
    [deals, createDeal, acceptDeal, cancelDeal, markDealPaid, releaseDeal, isLoading, refresh],
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
