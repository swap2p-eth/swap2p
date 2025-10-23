import * as React from "react";

import { useDeals } from "@/components/deals/deals-provider";
import { useUser } from "@/context/user-context";
import { isActiveDealState, isClosedDealState, normalizeAddress } from "@/lib/deal-utils";
import type { DealRow } from "@/lib/types/market";

export interface CurrentUserDeals {
  activeDeals: DealRow[];
  closedDeals: DealRow[];
  isLoading: boolean;
}

export function useCurrentUserDeals(): CurrentUserDeals {
  const { deals, isLoading } = useDeals();
  const { address } = useUser();
  const normalizedUser = normalizeAddress(address);

  const { activeDeals, closedDeals } = React.useMemo(() => {
    const ownedDeals = deals.filter(deal => {
      const makerMatches = normalizeAddress(deal.maker) === normalizedUser;
      const takerMatches = normalizeAddress(deal.taker) === normalizedUser;
      return makerMatches || takerMatches;
    });

    const active = ownedDeals.filter(deal => isActiveDealState(deal.state));
    const closed = ownedDeals.filter(deal => isClosedDealState(deal.state));

    return { activeDeals: active, closedDeals: closed };
  }, [deals, normalizedUser]);

  return { activeDeals, closedDeals, isLoading };
}
