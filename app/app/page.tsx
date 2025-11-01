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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useHashLocation } from "@/hooks/use-hash-location";
import { usePartnerReferralCapture } from "@/hooks/use-partner-referral";
import { normalizeEvmAddress } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  AlertOctagon,
  Banknote,
  CheckCircle2,
  HandCoins,
  Lock,
  ShieldCheck,
  TimerOff,
  Users,
} from "lucide-react";

type LegalPage = "terms" | "policy";

type ViewState =
  | { type: "home" }
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
  hash => (hash === "home" ? { type: "home" } : null),
  hash => (hash === "offers" ? { type: "offers" } : null),
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
  const normalized = hash || "home";
  for (const matcher of ROUTE_MATCHERS) {
    const result = matcher(normalized);
    if (result) {
      return result;
    }
  }
  return { type: "home" };
}

interface HomeHighlight {
  icon: LucideIcon;
  title: string;
  description: string;
}

const HOME_PROBLEMS: ReadonlyArray<HomeHighlight> = [
  {
    icon: AlertOctagon,
    title: "No More Scams",
    description:
      "Every trade is backed by a smart contract. Cheating equals losing your collateral. No second chances.",
  },
  {
    icon: TimerOff,
    title: "Zero Delays",
    description:
      "Instant crypto release once both sides confirm payment. No support tickets. No waiting games.",
  },
  {
    icon: Banknote,
    title: "Low Fees",
    description: "Only 0.5% fee per trade. No hidden costs, no platform bloat. You keep what's yours.",
  },
];

const HOME_STEPS: ReadonlyArray<HomeHighlight> = [
  {
    icon: Lock,
    title: "1. Both Lock Deposits",
    description: "Seller locks 2x the trade amount. Buyer locks 1x. All via smart contract.",
  },
  {
    icon: CheckCircle2,
    title: "2. Payment & Release",
    description:
      "Buyer pays off-chain. Once confirmed, smart contract releases crypto and refunds deposits.",
  },
  {
    icon: ShieldCheck,
    title: "3. Protected by Design",
    description: "Misbehave and lose your deposit. Fair trades only - or nobody wins.",
  },
];

const HOME_AFFILIATE: ReadonlyArray<HomeHighlight> = [
  {
    icon: Users,
    title: "0.15% from Maker",
    description: "You earn from every merchant you invite - forever.",
  },
  {
    icon: HandCoins,
    title: "0.1% from Taker",
    description: "You also earn from client side. Yes, both sides pay you.",
  },
];

interface HomeLandingProps {
  onBrowseOffers: () => void;
  onShowProfile: () => void;
  onShowTerms: () => void;
}

function HomeLanding({ onBrowseOffers, onShowProfile, onShowTerms }: HomeLandingProps) {
  return (
    <main className="relative isolate flex flex-1 flex-col overflow-hidden bg-gradient-to-b from-background via-background to-background">
      <div className="pointer-events-none absolute inset-x-0 top-[-20%] z-0 h-[480px] bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_65%)]" />
      <section className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center gap-8 px-4 py-20 text-center sm:px-8 sm:py-28">
        <span className="rounded-full border border-emerald-400/50 bg-emerald-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200">
          Decentralized Escrow Exchange
        </span>
        <h1 className="text-4xl font-extrabold tracking-tight text-emerald-300 sm:text-5xl">Swap2p</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Trustless. Secure. Peer-to-peer crypto-to-fiat swaps, powered by dual-deposit smart contracts.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Button size="lg" onClick={onBrowseOffers} className="px-8 py-5 text-base">
            Start a Deal
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={onShowProfile}
            className="border-emerald-500/50 px-8 py-5 text-base text-emerald-300 hover:bg-emerald-500/10"
          >
            Become a Partner
          </Button>
        </div>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-12 sm:px-8 sm:pb-16">
        <SectionHeading
          title="Problems We're Solving"
          description="Swap2p removes the single points of failure that plague traditional OTC desks and chat-based escrow."
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {HOME_PROBLEMS.map(problem => (
            <HighlightCard key={problem.title} highlight={problem} />
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-12 sm:px-8 sm:pb-16">
        <SectionHeading
          title="How It Works"
          description="Escrow logic enforces fair trades without intermediaries. Each step protects both parties from fraud or delays."
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {HOME_STEPS.map((step, index) => (
            <HighlightCard key={step.title} highlight={step} badgeLabel={`0${index + 1}`} />
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-12 sm:px-8 sm:pb-16">
        <SectionHeading
          title="Earn Forever. Our Affiliate Program"
          description="Invite traders and earn up to 0.25% on every future deal. One-time referral = lifetime payouts."
        />
        <div className="grid gap-6 sm:grid-cols-2">
          {HOME_AFFILIATE.map(item => (
            <HighlightCard key={item.title} highlight={item} />
          ))}
        </div>
        <div className="mt-8 flex justify-center">
          <Button size="lg" onClick={onShowProfile} className="px-8 py-5 text-base">
            Get My Partner Link
          </Button>
        </div>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-5xl px-4 pb-12 sm:px-8 sm:pb-16">
        <SectionHeading
          title="Terms & Protocol Info"
          description="All trades are executed by smart contracts on EVM networks. We never custody your funds."
        />
        <Card className="border-border/60 bg-card/80 backdrop-blur">
          <CardContent className="space-y-6 p-6 sm:p-10">
            <p className="text-base text-muted-foreground">
              For details on supported chains, audit reports, and dispute logic —{" "}
              <button
                type="button"
                onClick={onShowTerms}
                className="font-semibold text-emerald-300 underline decoration-emerald-400/60 underline-offset-4 transition hover:text-emerald-200"
              >
                read the docs
              </button>
              .
            </p>
          </CardContent>
        </Card>
      </section>

      <footer className="relative z-10 border-t border-border/60 bg-background/80">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-10 text-center text-xs text-muted-foreground sm:text-sm">
          <span>Copyright 2025 Swap2p. Built for trustless, global commerce.</span>
        </div>
      </footer>
    </main>
  );
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-8 flex flex-col gap-3 text-center sm:mb-12">
      <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">{title}</h2>
      <p className="mx-auto max-w-2xl text-sm text-muted-foreground sm:text-base">{description}</p>
    </div>
  );
}

function HighlightCard({
  highlight,
  badgeLabel,
}: {
  highlight: HomeHighlight;
  badgeLabel?: string;
}) {
  const Icon = highlight.icon;
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/70 p-6 shadow-[0_22px_50px_-40px_rgba(15,23,42,0.8)] transition hover:-translate-y-1 hover:border-emerald-400/60 hover:shadow-[0_28px_60px_-38px_rgba(16,185,129,0.55)]">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-300">
          <Icon className="h-6 w-6" />
        </span>
        {badgeLabel ? (
          <span className="absolute right-4 top-4 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
            {badgeLabel}
          </span>
        ) : null}
      </div>
      <div className="mt-6 space-y-3">
        <h3 className="text-lg font-semibold text-foreground">{highlight.title}</h3>
        <p className="text-sm text-muted-foreground">{highlight.description}</p>
      </div>
    </div>
  );
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
  const { hash, setHash } = useHashLocation("home");
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

  switch (view.type) {
    case "home":
      return (
        <HomeLanding
          onBrowseOffers={() => setHash("offers")}
          onShowProfile={() => setHash("profile")}
          onShowTerms={() => setHash("terms")}
        />
      );
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
