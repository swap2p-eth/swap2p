import * as React from "react";

import type { DealRow } from "@/lib/types/market";
import { getDealPerspective } from "@/lib/deal-utils";

export function useDealPerspective(deal: DealRow | null | undefined, currentUser: string) {
  return React.useMemo(() => {
    if (!deal) {
      return { role: null, userSide: null, isMaker: false };
    }
    return getDealPerspective(deal, currentUser);
  }, [deal, currentUser]);
}
