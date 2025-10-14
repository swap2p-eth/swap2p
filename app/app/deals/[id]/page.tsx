import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Coins, Wallet } from "lucide-react";
import { mockDeals } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChatWidget } from "@/components/chat/chat-widget";
import { cn } from "@/lib/utils";
import { TokenIcon } from "@/components/token-icon";
import { FiatFlag } from "@/components/fiat-flag";

interface DealPageProps {
  params: {
    id: string;
  };
}

const sideCopy = {
  BUY: {
    headline: "Maker is buying tokens",
    tone: "Counterparty wires fiat after escrow."
  },
  SELL: {
    headline: "Maker is selling tokens",
    tone: "Taker wires fiat after seeing escrowed funds."
  }
};

export default function DealDetailPage({ params }: DealPageProps) {
  const dealId = Number(params.id);
  const deal = mockDeals.find(item => item.id === dealId);

  if (!deal) {
    notFound();
  }

  const side = deal.side;
  const summary = sideCopy[side];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-3">
        <Link
          href="/deals"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to deals
        </Link>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Deal #{deal.id}</h1>
            <p className="text-sm text-muted-foreground">{summary.headline}</p>
          </div>
          <Badge variant="outline" className="rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em]">
            {deal.state}
          </Badge>
        </div>
      </div>

      <Card className="rounded-3xl bg-gradient-to-br from-background/70 to-background/20">
        <CardHeader className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2">
            <CardTitle className="text-xl">Settlement overview</CardTitle>
            <CardDescription>{summary.tone}</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-primary">
              <Coins className="h-4 w-4" />
              {deal.amount.toLocaleString("en-US")}
              <TokenIcon symbol={deal.token} size={18} className="rounded-full bg-white" />
              <span className="text-xs uppercase">{deal.token}</span>
            </span>
            <span className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-secondary-foreground">
              <Wallet className="h-4 w-4" /> Maker: {deal.maker.slice(0, 6)}…
            </span>
            <span className="flex items-center gap-2 rounded-full bg-muted/70 px-3 py-1">
              <ArrowUpRight className="h-4 w-4" /> Taker: {deal.taker.slice(0, 6)}…
            </span>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-card/60 p-4 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.6)]">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">Side</p>
            <p className="mt-2 text-sm font-medium">{deal.side}</p>
          </div>
          <div className="rounded-2xl bg-card/60 p-4 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.6)]">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">Token</p>
            <p className="mt-2 text-sm font-medium">{deal.token}</p>
          </div>
          <div className="rounded-2xl bg-card/60 p-4 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.6)]">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">Fiat</p>
            <p className="mt-2 flex items-center gap-2 text-sm font-medium">
              <FiatFlag fiat={deal.fiatCode} size={18} />
              {deal.fiatCode}
            </p>
          </div>
          <div className="rounded-2xl bg-card/60 p-4 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.6)]">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">Last update</p>
            <p className="mt-2 text-sm font-medium">{deal.updatedLabel}</p>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-3xl bg-card/60 p-6 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.45)] backdrop-blur">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Chat</h2>
          <p className="text-sm text-muted-foreground">
            Secure coordination channel. Messages will be encrypted and stored as bytes on-chain.
          </p>
        </div>
            <ChatWidget className={cn("min-h-[360px]", "bg-transparent shadow-none")} />
      </div>
    </div>
  );
}
