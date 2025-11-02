"use client";

import * as React from "react";
import Image from "next/image";

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
  BadgeCheck,
  BellRing,
  Briefcase,
  CalendarCheck2,
  ClipboardCheck,
  CreditCard,
  HandCoins,
  Package,
  ScrollText,
  Send,
  Share2,
  Shield,
  Sparkles,
  Vault,
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
  hash => (LEGAL_PAGES.has(hash as LegalPage) ? { type: "legal", page: hash as LegalPage } : null),
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

const HOME_HIGHLIGHTS: ReadonlyArray<HomeHighlight> = [
  {
    icon: BadgeCheck,
    title: "Escrow that enforces honesty",
    description: "Smart contracts hold both sides accountable. Your funds never touch a custodial wallet.",
  },
  {
    icon: CreditCard,
    title: "Choose your ideal payment rail",
    description: "Bank transfer, fintech, or cash-in-hand—filter and match with the rail that suits you.",
  },
  {
    icon: CalendarCheck2,
    title: "Stay organized as volume grows",
    description: "Track deals, automate windows, and keep repeat trades flowing without spreadsheets.",
  },
];

const HOME_STEPS: ReadonlyArray<HomeHighlight> = [
  {
    icon: Vault,
    title: "1. Both lock escrow deposits",
    description: "Seller stakes 2x, buyer stakes 1x of the trade. The contract guards the deal from kickoff.",
  },
  {
    icon: Send,
    title: "2. Fiat moves off-chain",
    description: "The payer sends fiat via the agreed rail. Seller confirms once funds are visible.",
  },
  {
    icon: Sparkles,
    title: "3. Crypto settles instantly",
    description: "Confirmation triggers on-chain release and both deposits return to their owners immediately after.",
  },
];

const HOME_USER_FEATURES: ReadonlyArray<HomeHighlight> = [
  {
    icon: ClipboardCheck,
    title: "Guided checklists stay ahead",
    description: "Spell out exactly what to submit and when so every swap stays on track.",
  },
  {
    icon: Shield,
    title: "Dual escrow enforces settlement",
    description: "Locks both deposits and only releases once confirmations match the agreed milestones.",
  },
  {
    icon: BellRing,
    title: "Realtime updates keep you in control",
    description: "Status alerts and evidence uploads keep you in the loop without juggling chats or spreadsheets.",
  },
];

const HOME_AFFILIATE: ReadonlyArray<HomeHighlight> = [
  {
    icon: HandCoins,
    title: "Earn on both sides",
    description: "0.25% revenue share on every trade: 0.10% from taker volume and 0.15% from maker fills—for example, earn $25 on a $10k swap.",
  },
  {
    icon: Share2,
    title: "Scale with warm introductions",
    description: "Send clients, influencers, or OTC desks. The contract tracks your referrals automatically.",
  },
];

const HOME_USE_CASES: ReadonlyArray<HomeHighlight> = [
  {
    icon: Briefcase,
    title: "Service retainers stay accountable",
    description: "Lock the quoted amount while milestones deliver; both sides release once deliverables are approved.",
  },
  {
    icon: Package,
    title: "Goods ship with escrow assurance",
    description: "Escrow backs in-person or courier deliveries so payment clears only when the buyer confirms receipt.",
  },
  {
    icon: ScrollText,
    title: "Custom agreements, same safety",
    description: "Run OTC financing, revenue shares, or any bilateral contract where funds move after documented proof.",
  },
];

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
          onCreateOffer={() => setHash("offer")}
          onShowDashboard={() => setHash("dashboard")}
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

interface HomeLandingProps {
  onBrowseOffers: () => void;
  onShowProfile: () => void;
  onShowTerms: () => void;
  onCreateOffer: () => void;
  onShowDashboard: () => void;
}

function HomeLanding({
  onBrowseOffers,
  onShowProfile,
  onShowTerms,
  onCreateOffer,
  onShowDashboard,
}: HomeLandingProps) {
  return (
    <main className="relative isolate flex flex-1 flex-col overflow-hidden bg-gradient-to-b from-background via-background to-background">
      <Hero onBrowseOffers={onBrowseOffers} onCreateOffer={onCreateOffer} />

      <SectionShell>
        <IntroSection onShowTerms={onShowTerms} />
      </SectionShell>
      <SectionShell>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="flex h-full pt-6 flex-col rounded-3xl bg-gradient-to-br from-primary/10 via-card to-background shadow-[0_28px_60px_-40px_rgba(14,116,144,0.45)]">
            <CardContent className="flex h-full flex-col gap-6 px-8 pt-8">
              <h3 className="text-2xl font-semibold text-foreground">Why users choose Swap2p</h3>
              <dl className="space-y-5 text-sm text-muted-foreground">
                <div className="space-y-1">
                  <dt className="font-medium text-foreground">Stay in control</dt>
                  <dd>Funds remain in your wallet until the contract locks both deposits and verifies settlement steps.</dd>
                </div>
                <div className="space-y-1">
                  <dt className="font-medium text-foreground">Know the next step</dt>
                  <dd>Milestones, reminders, and evidence uploads live in one view so nothing slips.</dd>
                </div>
                <div className="space-y-1">
                  <dt className="font-medium text-foreground">Trust what you can verify</dt>
                  <dd>Open-source contracts, and transparent dispute flows you can review anytime.</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
          <Card className="flex h-full pt-6 flex-col rounded-3xl bg-gradient-to-br from-primary/10 via-card to-background shadow-[0_28px_60px_-40px_rgba(14,116,144,0.45)]">
            <CardContent className="flex h-full flex-col gap-6 px-8 pt-8">
              <h3 className="text-2xl font-semibold text-foreground">What you control</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-primary/70" />
                  Custom spreads, inventory caps, and automated availability windows.
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-primary/70" />
                  Shared access without sharing keys, perfect for agents or co-pilots.
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-primary/70" />
                  Fiat acceptance rails with localized instructions per market.
                </li>
              </ul>
              <Button size="lg"
                      className="mt-auto rounded-full bg-card/80 px-10 py-5 text-base text-primary shadow-[0_16px_40px_-28px_rgba(59,130,246,0.55)] transition hover:bg-primary/10"
                      onClick={onShowDashboard}>
                List my inventory
              </Button>
            </CardContent>
          </Card>
        </div>
      </SectionShell>
      <SectionShell>
        <div className="space-y-6">
          <SectionHeading
            eyebrow="How escrow settles every deal"
            title="Three enforced checkpoints, zero support bottlenecks"
            description="Each step in the swap is guarded by the contract so neither party can skip ahead or stall the payout."
          />
          <div className="grid gap-4 md:grid-cols-3">
            {HOME_STEPS.map(step => (
              <StepCard key={step.title} step={step} />
            ))}
          </div>
        </div>
      </SectionShell>
      <SectionShell>
        <SectionHeading
          eyebrow="Partner program"
          title="Turn warm intros into lifetime revenue"
          description="Every referral is tracked on-chain. No spreadsheets, no renegotiation when volumes grow."
        />
        <div className="grid gap-6 sm:grid-cols-2">
          {HOME_AFFILIATE.map(item => (
            <HighlightCard key={item.title} highlight={item} />
          ))}
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Button
            size="lg"
            onClick={onShowProfile}
            className="rounded-full bg-sky-500 px-8 py-5 text-base text-white shadow-[0_16px_38px_-28px_rgba(14,165,233,0.45)] transition hover:bg-sky-500/90"
          >
            Get my partner link
          </Button>
          <Button
            size="lg"
            onClick={onBrowseOffers}
            className="rounded-full bg-orange-500 px-8 py-5 text-base text-white shadow-[0_16px_38px_-28px_rgba(249,115,22,0.45)] transition hover:bg-orange-500/90"
          >
            See live inventory
          </Button>
        </div>
      </SectionShell>
      <SectionShell>
        <SectionHeading
          eyebrow="Flexible escrow"
          title="Beyond fiat swaps, cover any off-chain promise"
          description="Swap2p’s double-collateral flow secures physical goods, service milestones, and bespoke agreements—set deposits once and let the contract enforce every checkpoint."
        />
        <div className="grid gap-6 md:grid-cols-3">
          {HOME_USE_CASES.map(item => (
            <HighlightCard key={item.title} highlight={item} />
          ))}
        </div>
      </SectionShell>
      <SectionShell>
        <Card className="mt-0 rounded-3xl pt-8 bg-gradient-to-br from-primary/15 via-card to-background shadow-[0_32px_64px_-40px_rgba(37,99,235,0.4)]">
          <CardContent className="flex flex-col items-center gap-6 px-6 py-14 text-center sm:px-12">
            <SectionHeading
              eyebrow="Ready when you are"
              title="Launch your first collateral-backed deal in minutes"
              description="Connect a wallet, pick your rail, and let escrow enforce the handshake your revenue depends on."
            />
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Button
                size="lg"
                onClick={onBrowseOffers}
                className="rounded-full bg-sky-500 px-10 py-5 text-base text-white shadow-[0_16px_40px_-28px_rgba(14,165,233,0.55)] transition hover:bg-sky-500/90"
              >
                Browse offers
              </Button>
              <Button
                size="lg"
                onClick={onCreateOffer}
                className="rounded-full bg-orange-500 px-10 py-5 text-base text-white shadow-[0_16px_40px_-28px_rgba(249,115,22,0.55)] transition hover:bg-orange-500/90"
              >
                Create offer
              </Button>
            </div>
          </CardContent>
        </Card>
      </SectionShell>
    </main>
  );
}

function Hero({
  onBrowseOffers,
  onCreateOffer,
}: {
  onBrowseOffers: () => void;
  onCreateOffer: () => void;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-b from-accent via-background/40 to-background">
      <div className="absolute inset-0 -z-10 opacity-80" aria-hidden="true">
        <div className="absolute inset-x-0 top-[-20%] h-[520px] bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.28),_transparent_65%)]" />
        <div className="absolute left-1/2 top-20 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-slate-400/20 blur-[160px]" />
      </div>
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-10 px-4 pb-24 pt-24 text-center sm:px-8 sm:pb-32 sm:pt-28">
        <div className="flex flex-col items-center gap-4">
          <Image
            src="/swap2p-icon.svg"
            alt="Swap2p logo"
            width={180}
            height={180}
            priority
            className="drop-shadow-[0_18px_32px_rgba(28,100,242,0.35)]"
          />
          <h1 className="text-3xl pt-0 pb-6 font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            SWAP2P
          </h1>

          <span className="inline-flex items-center gap-5 rounded-full bg-primary/10 px-5 py-1.5 text-xs font-semibold uppercase tracking-[0.3em] text-primary/90">
            Decentralized Escrow Exchange
          </span>
        </div>
        <p className="max-w-4xl text-4xl font-extralight tracking-wide text-foreground sm:text-6xl">
          Trade crypto &#8596; fiat with dual-deposit safety
        </p>
        <p className="max-w-3xl text-lg text-muted-foreground sm:text-xl">
          Both sides lock funds, guided milestones keep the deal moving, and escrow only releases when confirmations match.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Button
            size="lg"
            onClick={onBrowseOffers}
            className="rounded-full bg-sky-500 px-10 py-5 text-base text-white shadow-[0_16px_40px_-28px_rgba(14,165,233,0.55)] transition hover:bg-sky-500/90"
          >
            Browse offers
          </Button>
          <Button
            size="lg"
            onClick={onCreateOffer}
            className="rounded-full bg-orange-500 px-10 py-5 text-base text-white shadow-[0_16px_40px_-28px_rgba(249,115,22,0.55)] transition hover:bg-orange-500/90"
          >
            Create offer
          </Button>
        </div>

        <div className="grid w-full max-w-4xl gap-4 rounded-3xl bg-card/70 p-6 text-left shadow-[0_24px_58px_-36px_rgba(28,100,242,0.35)] sm:grid-cols-3">
          {HOME_HIGHLIGHTS.map(item => (
            <HeroHighlight key={item.title} highlight={item} />
          ))}
        </div>
      </div>
    </section>
  );
}

function IntroSection({ onShowTerms: _onShowTerms }: { onShowTerms: () => void }) {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <SectionHeading
        eyebrow="Built for users"
        title="Peer-to-peer escrow made intuitive"
        description="Swap2p walks both sides through every deposit, confirmation, and release so trades close without second-guessing."
      />
      <div className="grid gap-4 md:grid-cols-3">
        {HOME_USER_FEATURES.map(feature => (
          <StepCard key={feature.title} step={feature} />
        ))}
      </div>
    </div>
  );
}


function SectionShell({
  children,
  tone = "dark",
}: {
  children: React.ReactNode;
  tone?: "dark" | "light";
}) {
  const base = "relative z-10 mx-auto w-full max-w-6xl px-4 py-16 sm:px-8 sm:py-20";
  const toneClass =
    tone === "light" ? "bg-gradient-to-br from-card/40 via-background to-background/80" : "";
  return <section className={`${base} ${toneClass}`}>{children}</section>;
}

function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
}: {
  eyebrow?: string;
  title: string;
  description: string;
  align?: "center" | "left";
}) {
  const alignment = align === "center" ? "text-center items-center" : "text-left items-start";
  return (
    <div className={`mb-10 flex flex-col gap-3 ${alignment}`}>
      {eyebrow ? (
        <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-0.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
          {eyebrow}
        </span>
      ) : null}
      <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">{title}</h2>
      <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">{description}</p>
    </div>
  );
}

function HeroHighlight({ highlight }: { highlight: HomeHighlight }) {
  const Icon = highlight.icon;
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl bg-background/80 p-6 text-center shadow-[0_18px_42px_-30px_rgba(59,130,246,0.35)]">
      <Icon className="h-10 w-10 text-primary" />
      <h3 className="text-base font-semibold text-foreground">{highlight.title}</h3>
      <p className="text-sm text-muted-foreground">{highlight.description}</p>
    </div>
  );
}

function HighlightCard({ highlight }: { highlight: HomeHighlight }) {
  const Icon = highlight.icon;
  return (
    <div className="group relative flex flex-col items-center gap-6 overflow-hidden rounded-3xl bg-card/70 p-6 text-center shadow-[0_22px_50px_-40px_rgba(15,23,42,0.8)] transition hover:-translate-y-1 hover:shadow-[0_28px_60px_-38px_rgba(59,130,246,0.45)]">
      <Icon className="h-12 w-12 text-primary" />
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-foreground">{highlight.title}</h3>
        <p className="text-sm text-muted-foreground">{highlight.description}</p>
      </div>
    </div>
  );
}

function StepCard({ step }: { step: HomeHighlight }) {
  const Icon = step.icon;
  return (
    <div className="flex h-full flex-col rounded-3xl bg-background/60 p-5 shadow-[0_22px_46px_-38px_rgba(59,130,246,0.35)]">
      <div className="flex items-start gap-4">
        <Icon className="h-10 w-10 shrink-0 text-primary" />
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-foreground">{step.title}</h3>
          <p className="text-sm text-muted-foreground">{step.description}</p>
        </div>
      </div>
    </div>
  );
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
            <div className="rounded-lg bg-destructive/20 p-4 text-sm text-destructive">
              Could not load the document. Please try again later.
            </div>
          ) : null}
          {state.status === "ready" ? <MarkdownContent source={state.content} /> : null}
        </CardContent>
      </Card>
    </div>
  );
}
