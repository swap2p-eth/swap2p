"use client";

import * as React from "react";
import { ArrowRight } from "lucide-react";
import Jazzicon from "react-jazzicon";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { FiatFlag } from "@/components/fiat-flag";
import { TokenIcon } from "@/components/token-icon";
import type { OfferRow } from "@/lib/mock-offers";
import { cn, formatAddressShort, seedFromAddress } from "@/lib/utils";
import { DealHeader } from "./deal-header";
import { DealSummaryCard } from "./deal-summary-card";
import { useDeals } from "./deals-provider";
import { useOffers } from "@/components/offers/offers-provider";
import { Skeleton } from "@/components/ui/skeleton";

type AmountKind = "crypto" | "fiat";

interface NewDealViewProps {
  offerId: number;
  onCancel?: () => void;
  onCreated?: (dealId: number) => void;
  returnHash?: string;
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

export function NewDealView({ offerId, onCancel, onCreated, returnHash = "offers" }: NewDealViewProps) {
  const { offers, isLoading: offersLoading } = useOffers();
  const offer = React.useMemo(() => offers.find(item => item.id === offerId), [offers, offerId]);
  const { createDeal } = useDeals();

  const [amountKind, setAmountKind] = React.useState<AmountKind>("crypto");
  const [amount, setAmount] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState<string>("");
  const [paymentDetails, setPaymentDetails] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!offer) return;
    setAmount(offer.minAmount.toString());
    const options = parsePaymentMethods(offer.paymentMethods);
    setPaymentMethod(options[0] ?? "");
    setError(null);
  }, [offerId, offer]);

  if (offersLoading) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-8">
        <Skeleton className="h-10 w-48 rounded-full" />
        <Skeleton className="h-40 w-full rounded-3xl" />
        <Skeleton className="h-72 w-full rounded-3xl" />
      </div>
    );
  }

  if (!offer) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-12 text-center sm:px-8">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Offer not found</h1>
        <p className="text-sm text-muted-foreground">
          This offer is no longer available in the mock dataset. Return to the previous section to pick another one.
        </p>
        <Button
          type="button"
          variant="default"
          onClick={() => onCancel?.()}
          className="mx-auto rounded-full px-6"
        >
          {returnHash === "dashboard" ? "Back to dashboard" : "Back to offers"}
        </Button>
      </div>
    );
  }

  const paymentOptions = parsePaymentMethods(offer.paymentMethods);
  const hasPaymentOptions = paymentOptions.length > 0;
  const limitsRange = `${offer.minAmount.toLocaleString("en-US")} – ${offer.maxAmount.toLocaleString(
    "en-US"
  )} ${offer.token}`;

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

  const backLabel = returnHash === "dashboard" ? "Back to dashboard" : "Back to offers";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-8">
      <DealHeader
        title="New deal"
        subtitle={`Create a taker request for maker ${formatAddressShort(offer.maker)}`}
        backLabel={backLabel}
        onBack={() => onCancel?.()}
      />

      <DealSummaryCard
        title="Offer overview"
        description={formatOfferSubtitle(offer)}
        pills={[
          {
            id: "merchant",
            className:
              "bg-transparent px-0 py-0 shadow-none text-secondary-foreground flex flex-col items-end gap-1 text-right",
            content: (
              <>
                <span className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground/70">
                  Merchant
                </span>
                <span className="flex items-center justify-end gap-2 text-sm font-medium text-foreground">
                  <Jazzicon diameter={20} seed={seedFromAddress(offer.maker)} />
                  {formatAddressShort(offer.maker)}
                </span>
              </>
            )
          }
        ]}
        extraContent={
          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">Merchant requirements</span>
            <span className="text-sm text-muted-foreground">{MERCHANT_REQUIREMENTS}</span>
          </div>
        }
        metaItems={[
          { id: "side", label: "Side", value: offer.side },
          {
            id: "token",
            label: "Token",
            value: (
              <span className="flex items-center gap-2">
                <TokenIcon symbol={offer.token} size={18} />
                {offer.token}
              </span>
            )
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
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
              <div className="flex flex-col items-end gap-1 text-right">
                <span className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground/70">Limits</span>
                <span className="text-sm font-medium text-foreground">{limitsRange}</span>
              </div>
            </div>
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
                <SelectValue placeholder="Select payment method" />
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

          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">Payment details</span>
            <Input
              type="text"
              value={paymentDetails}
              onChange={event => setPaymentDetails(event.target.value)}
              placeholder="Add settlement instructions or reference"
              className="h-14 rounded-2xl bg-background/70"
            />
          </div>
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
