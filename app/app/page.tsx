"use client";

import * as React from "react";

import { DealDetailView } from "@/components/deals/deal-detail-view";
import { DealsView } from "@/components/deals/deals-view";
import { DealsProvider } from "@/components/deals/deals-provider";
import { NewDealView } from "@/components/deals/new-deal-view";
import { OffersView } from "@/components/offers/offers-view";
import { useHashLocation } from "@/hooks/use-hash-location";
import { OffersProvider } from "@/components/offers/offers-provider";
import { NewOfferView } from "@/components/offers/new-offer-view";

type ViewState =
  | { type: "offers" }
  | { type: "dashboard" }
  | { type: "new-deal"; offerId: number }
  | { type: "deal-detail"; dealId: number }
  | { type: "new-offer" };

function parseHash(hash: string): ViewState {
  const normalized = hash || "offers";
  if (normalized === "deals" || normalized === "dashboard") {
    return { type: "dashboard" };
  }
  if (normalized.startsWith("new-deal/")) {
    const [, idPart] = normalized.split("/");
    const offerId = Number.parseInt(idPart ?? "", 10);
    if (Number.isFinite(offerId)) {
      return { type: "new-deal", offerId };
    }
    return { type: "offers" };
  }
  if (normalized.startsWith("deal/")) {
    const [, idPart] = normalized.split("/");
    const dealId = Number.parseInt(idPart ?? "", 10);
    if (Number.isFinite(dealId)) {
      return { type: "deal-detail", dealId };
    }
    return { type: "dashboard" };
  }
  if (normalized === "new-offer") {
    return { type: "new-offer" };
  }
  return { type: "offers" };
}

export default function HomePage() {
  return (
    <OffersProvider>
      <DealsProvider>
        <HomePageRouter />
      </DealsProvider>
    </OffersProvider>
  );
}

function HomePageRouter() {
  const { hash, setHash } = useHashLocation("offers");
  const view = React.useMemo(() => parseHash(hash), [hash]);
  const lastStableView = React.useRef<ViewState["type"]>("offers");

  React.useEffect(() => {
    if (view.type !== "new-deal") {
      lastStableView.current = view.type === "deal-detail" ? "dashboard" : view.type;
    }
  }, [view]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.location.hash) {
      setHash("offers");
    }
  }, [setHash]);

  switch (view.type) {
    case "dashboard":
      return <DealsView onSelectDeal={dealId => setHash(`deal/${dealId}`)} />;
    case "deal-detail":
      return <DealDetailView dealId={view.dealId} onBack={() => setHash("dashboard")} />;
    case "new-deal": {
      const backTarget = lastStableView.current === "dashboard" ? "dashboard" : "offers";
      return (
        <NewDealView
          offerId={view.offerId}
          returnHash={backTarget}
          onCancel={() => setHash(backTarget)}
          onCreated={dealId => setHash(`deal/${dealId}`)}
        />
      );
    }
    case "new-offer":
      return <NewOfferView onCancel={() => setHash("offers")} onCreated={() => setHash("offers")} />;
    case "offers":
    default:
      return (
        <OffersView
          onStartDeal={offer => setHash(`new-deal/${offer.id}`)}
          onCreateOffer={() => setHash("new-offer")}
        />
      );
  }
}
