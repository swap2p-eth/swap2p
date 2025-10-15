"use client";

import * as React from "react";
import { ArrowRight, Coins } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { FiatFlag } from "@/components/fiat-flag";
import { TokenIcon } from "@/components/token-icon";
import type { OfferRow } from "@/lib/mock-offers";
import { mockOffers } from "@/lib/mock-offers";
import { cn } from "@/lib/utils";
import { DealHeader } from "./deal-header";
import { DealSummaryCard } from "./deal-summary-card";
import { useDeals } from "./deals-provider";

type AmountKind = "crypto" | "fiat";

interface NewDealViewProps {
  offerId: number;
  onCancel?: () => void;
  onCreated?: (dealId: number) => void;
}

const MERCHANT_REQUIREMENTS =
  "Merchant requirements will be published here. Expect KYB steps, settlement SLA, and compliance notes.";

const parsePaymentMethods = (raw: string): string[] => {
  if (!raw) return [];
  return raw.split(",").map(method => method.trim()).filter(Boolean);
};

const formatOfferSubtitle = (offer: OfferRow) =>
  offer.side === "BUY"
    ? "Maker escrows collateral and waits for your tokens."
    : "Maker escrows tokens and waits for your fiat rails.";

export function NewDealView({ offerId, onCancel, onCreated }: NewDealViewProps) {
  const offer = mockOffers.find(item => item.id === offerId);
  const { createDeal } = useDeals();

  const [amountKind, setAmountKind] = React.useState<AmountKind>("crypto");
  const [amount, setAmount] = React.useState(() => (offer ? offer.minAmount.toString() : ""));
  const [paymentMethod, setPaymentMethod] = React.useState<string>(() => {
    const options = offer ? parsePaymentMethods(offer.paymentMethods) : [];
    return options[0] ?? "";
  });
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!offer) return;
    setAmount(offer.minAmount.toString());
    const options = parsePaymentMethods(offer.paymentMethods);
    setPaymentMethod(options[0] ?? "");
  }, [offerId, offer]);

  if (!offer) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-12 text-center sm:px-8">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Offer not found</h1>
        <p className="text-sm text-muted-foreground">
          This offer is no longer available in the mock dataset. Return to the offers list to pick another one.
        </p>
        <Button
          type="button"
          variant="default"
          onClick={() => onCancel?.()}
          className="mx-auto rounded-full px-6"
        >
          Back to offers
        </Button>
      </div>
    );
  }

  const paymentOptions = parsePaymentMethods(offer.paymentMethods);
  const hasPaymentOptions = paymentOptions.length > 0;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Enter a positive amount.");
      return;
    }

    if (hasPaymentOptions && !paymentMethod) {
      setError("Select a payment method.");
      return;
    }

    const tokenAmount =
      amountKind === "crypto" ? numericAmount : numericAmount / offer.price;

    if (!Number.isFinite(tokenAmount) || tokenAmount <= 0) {
      setError("Enter a valid amount.");
      return;
    }

    if (tokenAmount < offer.minAmount) {
      setError(
        `Amount must be at least ${offer.minAmount.toLocaleString("en-US")} ${offer.token}.`
      );
      return;
    }

    if (tokenAmount > offer.maxAmount) {
      setError(
        `Amount must not exceed ${offer.maxAmount.toLocaleString("en-US")} ${offer.token}.`
      );
      return;
    }

    setError(null);

    const deal = createDeal({
      offer,
      amount: tokenAmount,
      amountKind,
      paymentMethod
    });

    onCreated?.(deal.id);
  };

  const amountLabel =
    amountKind === "crypto" ? (
      <>
        <TokenIcon symbol={offer.token} size={18} className="rounded-full bg-white" />
        <span className="text-xs uppercase">{offer.token}</span>
      </>
    ) : (
      <>
        <FiatFlag fiat={offer.fiat} size={18} />
        <span className="text-xs uppercase">{offer.fiat}</span>
      </>
    );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-8">
      <DealHeader
        title="New deal"
        subtitle={`Create a taker request for maker ${offer.maker.slice(0, 6)}…`}
        backLabel="Back to offers"
        onBack={() => onCancel?.()}
      />

      <DealSummaryCard
        title="Offer overview"
        description={formatOfferSubtitle(offer)}
        pills={[
          {
            id: "token",
            className: "bg-primary/10 text-primary",
            content: (
              <>
                <Coins className="h-4 w-4" />
                {offer.token}
              </>
            )
          },
          {
            id: "maker",
            className: "bg-secondary text-secondary-foreground",
            content: `Maker: ${offer.maker.slice(0, 6)}…`
          }
        ]}
        metaItems={[
          { id: "side", label: "Side", value: offer.side },
          {
            id: "amounts",
            label: "Limits",
            value: `${offer.minAmount.toLocaleString("en-US")} – ${offer.maxAmount.toLocaleString("en-US")}`
          },
          {
            id: "fiat",
            label: "Fiat",
            value: (
              <span className="flex items-center gap-2">
                <FiatFlag fiat={offer.fiat} size={18} />
                {offer.fiat}
              </span>
            )
          },
          {
            id: "price",
            label: "Price",
            value: `${offer.price.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 4
            })} ${offer.fiat}`
          }
        ]}
      />

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-3xl bg-card/60 p-6 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.45)] backdrop-blur"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">Amount</span>
            <SegmentedControl
              value={amountKind}
              onChange={value => setAmountKind(value as AmountKind)}
              options={[
                {
                  label: (
                    <span className="flex items-center gap-2">
                      <TokenIcon symbol={offer.token} size={16} className="rounded-full bg-white" />
                      {offer.token}
                    </span>
                  ),
                  value: "crypto"
                },
                {
                  label: (
                    <span className="flex items-center gap-2">
                      <FiatFlag fiat={offer.fiat} size={16} />
                      {offer.fiat}
                    </span>
                  ),
                  value: "fiat"
                }
              ]}
              className="w-fit"
            />
            <div className="relative mt-2">
              <Input
                type="number"
                step="any"
                min={0}
                required
                value={amount}
                onChange={event => setAmount(event.target.value)}
                className="h-14 rounded-2xl bg-background/70 pl-4 pr-32 text-lg font-semibold"
                placeholder="Enter amount"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs font-medium uppercase text-muted-foreground">
                {amountLabel}
              </span>
            </div>
            {amount && Number(amount) > 0 ? (
              <p className="text-xs text-muted-foreground">
                ≈{" "}
                {amountKind === "crypto"
                  ? (Number(amount) * offer.price).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })
                  : (Number(amount) / offer.price).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}{" "}
                {amountKind === "crypto" ? offer.fiat : offer.token}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">
              Payment method
            </span>
            <Select
              value={paymentMethod}
              onValueChange={setPaymentMethod}
              disabled={!hasPaymentOptions}
            >
              <SelectTrigger className="h-14 rounded-2xl bg-background/70 text-left font-medium">
                <SelectValue placeholder="Select payment rail" />
              </SelectTrigger>
              <SelectContent>
                {paymentOptions.map(method => (
                  <SelectItem key={method} value={method}>
                    {method}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!hasPaymentOptions ? (
              <p className="text-xs text-muted-foreground">
                Maker has not published payment methods for this mock offer yet.
              </p>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl bg-muted/40 px-5 py-4 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Merchant requirements.</span>{" "}
          <span>{MERCHANT_REQUIREMENTS}</span>
        </div>

        {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

        <Button
          type="submit"
          size="lg"
          className={cn(
            "w-full rounded-full py-6 text-base font-semibold shadow-[0_24px_60px_-32px_rgba(37,99,235,0.65)]"
          )}
        >
          Create deal
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
