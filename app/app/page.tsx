"use client";

import * as React from "react";

import { DealDetailView } from "@/components/deals/deal-detail-view";
import { DealsView } from "@/components/deals/deals-view";
import { DealsProvider } from "@/components/deals/deals-provider";
import { NewDealView } from "@/components/deals/new-deal-view";
import { OffersView } from "@/components/offers/offers-view";
import { useHashLocation } from "@/hooks/use-hash-location";
import { OffersProvider } from "@/components/offers/offers-provider";
import { OfferView } from "@/components/offers/offer-view";

type ViewState =
  | { type: "offers" }
  | { type: "dashboard" }
  | { type: "new-deal"; offerId: number }
  | { type: "deal-detail"; dealId: number }
  | { type: "offer"; offerId?: number };

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
  if (normalized === "offer") {
    return { type: "offer" };
  }
  if (normalized.startsWith("offer/")) {
    const [, idPart] = normalized.split("/");
    const offerId = Number.parseInt(idPart ?? "", 10);
    if (Number.isFinite(offerId)) {
      return { type: "offer", offerId };
    }
    return { type: "offers" };
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
  const lastStableHash = React.useRef<"offers" | "dashboard">("offers");

  React.useEffect(() => {
    switch (view.type) {
      case "new-deal":
      case "offer":
        return;
      case "deal-detail":
        lastStableHash.current = "dashboard";
        return;
      case "dashboard":
        lastStableHash.current = "dashboard";
        return;
      case "offers":
      default:
        lastStableHash.current = "offers";
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
      const backTarget = lastStableHash.current;
      return (
        <NewDealView
          offerId={view.offerId}
          returnHash={backTarget}
          onCancel={() => setHash(backTarget)}
          onCreated={dealId => setHash(`deal/${dealId}`)}
        />
      );
    }
    case "offer": {
      const backTarget = lastStableHash.current;
      if (typeof view.offerId === "number") {
        return (
          <OfferView
            mode="edit"
            offerId={view.offerId}
            returnHash={backTarget}
            onCancel={() => setHash(backTarget)}
            onCreated={() => setHash(backTarget)}
            onDelete={() => setHash(backTarget)}
          />
        );
      }
      return (
        <OfferView
          mode="create"
          returnHash={backTarget}
          onCancel={() => setHash(backTarget)}
          onCreated={() => setHash("offers")}
        />
      );
    }
    case "offers":
    default:
      return (
        <OffersView
          onStartDeal={offer => setHash(`new-deal/${offer.id}`)}
          onCreateOffer={() => setHash("offer")}
        />
      );
  }
}
