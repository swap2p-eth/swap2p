import * as React from "react";

import { CURRENT_USER_ADDRESS } from "@/lib/mock-user";
import type { DealRow } from "@/lib/mock-data";
import { getDealPerspective } from "@/lib/deal-utils";

export function useDealPerspective(deal: DealRow | null | undefined, currentUser: string = CURRENT_USER_ADDRESS) {
  return React.useMemo(() => {
    if (!deal) {
      return { role: null, userSide: null, isMaker: false };
    }
    return getDealPerspective(deal, currentUser);
  }, [deal, currentUser]);
}
