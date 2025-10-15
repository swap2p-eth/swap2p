"use client";

import * as React from "react";

import { DealDetailView } from "@/components/deals/deal-detail-view";
import { DealsView } from "@/components/deals/deals-view";
import { OffersView } from "@/components/offers/offers-view";
import { useHashLocation } from "@/hooks/use-hash-location";

type ViewState =
  | { type: "offers" }
  | { type: "deals" }
  | { type: "deal-detail"; dealId: number };

function parseHash(hash: string): ViewState {
  const normalized = hash || "offers";
  if (normalized === "deals") {
    return { type: "deals" };
  }
  if (normalized.startsWith("deal/")) {
    const [, idPart] = normalized.split("/");
    const dealId = Number.parseInt(idPart ?? "", 10);
    if (Number.isFinite(dealId)) {
      return { type: "deal-detail", dealId };
    }
    return { type: "deals" };
  }
  return { type: "offers" };
}

export default function HomePage() {
  const { hash, setHash } = useHashLocation("offers");
  const view = React.useMemo(() => parseHash(hash), [hash]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.location.hash) {
      setHash("offers");
    }
  }, [setHash]);

  switch (view.type) {
    case "deals":
      return <DealsView onSelectDeal={dealId => setHash(`deal/${dealId}`)} />;
    case "deal-detail":
      return <DealDetailView dealId={view.dealId} onBack={() => setHash("deals")} />;
    case "offers":
    default:
      return <OffersView />;
  }
}
