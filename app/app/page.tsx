"use client";

import * as React from "react";

import { DealDetailView } from "@/components/deals/deal-detail-view";
import { DealsView } from "@/components/deals/deals-view";
import { NewDealView } from "@/components/deals/new-deal-view";
import { OfferView } from "@/components/offers/offer-view";
import { OffersProvider } from "@/components/offers/offers-provider";
import { OffersView } from "@/components/offers/offers-view";
import { ProfileView } from "@/components/profile/profile-view";
import { MarkdownContent } from "@/components/markdown-content";
import { Card, CardContent } from "@/components/ui/card";
import { useHashLocation } from "@/hooks/use-hash-location";
import { usePartnerReferralCapture } from "@/hooks/use-partner-referral";
import { normalizeEvmAddress } from "@/lib/utils";

type LegalPage = "terms" | "policy";

type ViewState =
  | { type: "offers" }
  | { type: "dashboard" }
  | { type: "new-deal"; offerId: string }
  | { type: "deal-detail"; dealId: string }
  | { type: "offer"; offerId?: string }
  | { type: "profile"; address?: string }
  | { type: "legal"; page: LegalPage };

const LEGAL_PAGES: ReadonlySet<LegalPage> = new Set(["terms", "policy"]);

type RouteMatcher = (hash: string) => ViewState | null;

const ROUTE_MATCHERS: RouteMatcher[] = [
  hash => {
    if (hash === "profile") {
      return { type: "profile" };
    }
    const match = hash.match(/^profile\/(.+)$/);
    if (!match) return null;
    const address = normalizeEvmAddress(decodeURIComponent(match[1] ?? ""));
    return { type: "profile", address: address ?? undefined };
  },
  hash => (hash === "deals" || hash === "dashboard" ? { type: "dashboard" } : null),
  hash => {
    const match = hash.match(/^new-deal\/(.+)$/);
    if (!match) return null;
    const offerId = decodeURIComponent(match[1] ?? "").trim();
    return offerId.length > 0 ? { type: "new-deal", offerId } : null;
  },
  hash => {
    const match = hash.match(/^deal\/(.+)$/);
    if (!match) return null;
    const dealId = decodeURIComponent(match[1] ?? "").trim();
    return dealId.length > 0 ? { type: "deal-detail", dealId } : { type: "dashboard" };
  },
  hash => (hash === "offer" ? { type: "offer" } : null),
  hash => {
    const match = hash.match(/^offer\/(.+)$/);
    if (!match) return null;
    const offerId = decodeURIComponent(match[1] ?? "").trim();
    return offerId.length > 0 ? { type: "offer", offerId } : null;
  },
  hash => (LEGAL_PAGES.has(hash as LegalPage) ? { type: "legal", page: hash as LegalPage } : null)
];

function parseHash(hash: string): ViewState {
  const normalized = hash || "offers";
  for (const matcher of ROUTE_MATCHERS) {
    const result = matcher(normalized);
    if (result) {
      return result;
    }
  }
  return { type: "offers" };
}

export default function HomePage() {
  return (
    <OffersProvider>
      <HomePageRouter />
    </OffersProvider>
  );
}

function HomePageRouter() {
  usePartnerReferralCapture();
  const { hash, setHash } = useHashLocation("offers");
  const view = React.useMemo(() => parseHash(hash), [hash]);
  const lastStableHash = React.useRef<"offers" | "dashboard">("offers");

  React.useEffect(() => {
    switch (view.type) {
      case "new-deal":
      case "offer":
        return;
      case "profile":
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
      if (typeof view.offerId === "string") {
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
    case "legal":
      return <LegalDocumentView page={view.page} />;
    case "profile":
      return <ProfileView address={view.address} />;
    case "offers":
    default:
      return (
        <OffersView
          onStartDeal={offer => setHash(`new-deal/${offer.id}`)}
          onCreateOffer={() => setHash("offer")}
          onEditOffer={offer => setHash(`offer/${offer.id}`)}
        />
      );
  }
}

interface LegalDocumentViewProps {
  page: LegalPage;
}

type LegalDocumentState =
  | { status: "loading" }
  | { status: "ready"; content: string }
  | { status: "error" };

function LegalDocumentView({ page }: LegalDocumentViewProps) {
  const [state, setState] = React.useState<LegalDocumentState>({ status: "loading" });

  React.useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    fetch(`/api/legal/${page}`)
      .then(response => {
        if (!response.ok) throw new Error("Failed to load document");
        return response.text();
      })
      .then(text => {
        if (!cancelled) {
          setState({ status: "ready", content: text });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ status: "error" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [page]);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-8 sm:py-16">
      <Card className="card-surface-soft">
        <CardContent className="space-y-6 pt-6 sm:space-y-8 sm:pt-8">
          {state.status === "loading" ? (
            <div className="space-y-4">
              <div className="h-6 w-2/3 animate-pulse rounded bg-muted/60" />
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-4 w-full animate-pulse rounded bg-muted/50" />
                ))}
              </div>
            </div>
          ) : null}
          {state.status === "error" ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              Could not load the document. Please try again later.
            </div>
          ) : null}
          {state.status === "ready" ? <MarkdownContent source={state.content} /> : null}
        </CardContent>
      </Card>
    </div>
  );
}
