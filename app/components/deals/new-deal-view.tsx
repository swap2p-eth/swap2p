"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { FiatFlag } from "@/components/fiat-flag";
import { TokenIcon } from "@/components/token-icon";
import type { OfferRow } from "@/lib/mock-offers";
import { cn, formatAddressShort } from "@/lib/utils";
import { DealHeader } from "./deal-header";
import { DealSummaryCard } from "./deal-summary-card";
import { DealStatusPanel } from "./deal-status-panel";
import { useDeals } from "./deals-provider";
import { useOffers } from "@/components/offers/offers-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { ParticipantPill } from "@/components/deals/participant-pill";
import { createSideMetaItem } from "@/components/deals/summary-meta";
import { mockTokenConfigs } from "@/lib/mock-market";
import { formatFiatAmount, formatPrice, formatTokenAmount } from "@/lib/number-format";
import type { ApprovalMode } from "./token-approval-button";

type AmountKind = "crypto" | "fiat";
type ValidationField = "amount" | "paymentMethod" | "paymentDetails";

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
    : "Review offer details and provide amount.";

export function NewDealView({ offerId, onCancel, onCreated, returnHash = "offers" }: NewDealViewProps) {
  const { offers, isLoading: offersLoading } = useOffers();
  const offer = React.useMemo(() => offers.find(item => item.id === offerId), [offers, offerId]);
  const { createDeal } = useDeals();

  const [amountKind, setAmountKind] = React.useState<AmountKind>("crypto");
  const [amount, setAmount] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState<string>("");
  const [paymentDetails, setPaymentDetails] = React.useState("");
  const amountInputRef = React.useRef<HTMLInputElement>(null);
  const paymentMethodTriggerRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!offer) return;
    setAmountKind("crypto");
    setAmount(offer.minAmount.toString());
    const options = parsePaymentMethods(offer.paymentMethods);
    setPaymentMethod(options.length === 1 ? options[0] : "");
    setPaymentDetails("");
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

  const tokenConfig = mockTokenConfigs.find(config => config.symbol === offer.token);
  const tokenDecimals = tokenConfig?.decimals ?? 2;

  const paymentOptions = parsePaymentMethods(offer.paymentMethods);
  const hasPaymentOptions = paymentOptions.length > 0;
  const limitsRange = `${formatTokenAmount(offer.minAmount, tokenDecimals)} – ${formatTokenAmount(offer.maxAmount, tokenDecimals)} ${offer.token}`;
  const amountNumber = Number(amount);
  const amountEntered = amount.trim().length > 0 && Number.isFinite(amountNumber) && amountNumber > 0;
  const rawTokenAmount =
    amountEntered && offer.price > 0
      ? amountKind === "crypto"
        ? amountNumber
        : amountNumber / offer.price
      : null;
  const tokenAmount =
    rawTokenAmount !== null && Number.isFinite(rawTokenAmount) && rawTokenAmount > 0 ? rawTokenAmount : null;
  const amountValid =
    tokenAmount !== null && tokenAmount >= offer.minAmount && tokenAmount <= offer.maxAmount;
  const paymentMethodValid = !hasPaymentOptions || paymentMethod.trim().length > 0;
  const paymentDetailsValid = paymentDetails.trim().length >= 5;
  const isFormValid = amountValid && paymentMethodValid && paymentDetailsValid;
  const amountHeadingClass = cn(
    "text-xs uppercase tracking-[0.2em] text-muted-foreground/70",
    amountValid ? "text-emerald-500" : undefined
  );
  const paymentMethodHeadingClass = cn(
    "text-xs uppercase tracking-[0.2em] text-muted-foreground/70",
    paymentMethodValid && hasPaymentOptions ? "text-emerald-500" : undefined
  );
  const merchantSide = offer.side.toUpperCase();
  const userSide = merchantSide === "SELL" ? "BUY" : "SELL";
  const userAction = userSide === "SELL" ? "sell" : "buy";
  const minLabel = `${formatTokenAmount(offer.minAmount, tokenDecimals)} ${offer.token}`;
  const maxLabel = `${formatTokenAmount(offer.maxAmount, tokenDecimals)} ${offer.token}`;
  let amountError: string | null = null;
  if (!amountValid) {
    if (!amountEntered) {
      amountError = `Enter an amount between ${minLabel} and ${maxLabel}.`;
    } else if (tokenAmount === null) {
      amountError = "Enter a valid amount.";
    } else if (tokenAmount < offer.minAmount) {
      amountError = `Minimum amount is ${minLabel}.`;
    } else if (tokenAmount > offer.maxAmount) {
      amountError = `Maximum amount is ${maxLabel}.`;
    } else {
      amountError = `Enter an amount between ${minLabel} and ${maxLabel}.`;
    }
  }
  const paymentMethodError =
    hasPaymentOptions && !paymentMethod ? "Choose a payment method." : null;
  const paymentDetailsError = paymentDetailsValid ? null : "Payment details must be at least 5 characters.";
  const validationIssues: Array<{ field: ValidationField; message: string }> = [];
  if (amountError) {
    validationIssues.push({ field: "amount", message: amountError });
  }
  if (paymentMethodError) {
    validationIssues.push({ field: "paymentMethod", message: paymentMethodError });
  }
  if (paymentDetailsError) {
    validationIssues.push({ field: "paymentDetails", message: paymentDetailsError });
  }
  const focusField = (field: ValidationField) => {
    const options: Record<ValidationField, (() => void) | undefined> = {
      amount: () => {
        if (amountInputRef.current) {
          amountInputRef.current.focus();
          amountInputRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      },
      paymentMethod: () => {
        if (paymentMethodTriggerRef.current) {
          paymentMethodTriggerRef.current.focus();
          paymentMethodTriggerRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      },
      paymentDetails: () => {
        const commentField = document.querySelector<HTMLTextAreaElement>("textarea[name='new-deal-comment']");
        if (commentField) {
          commentField.focus();
          commentField.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    };
    options[field]?.();
  };

  const handleCreateDeal = () => {
    if (!isFormValid || tokenAmount === null) {
      if (validationIssues.length > 0) {
        focusField(validationIssues[0].field);
      }
      return;
    }
    const deal = createDeal({
      offer,
      amount: tokenAmount,
      amountKind,
      paymentMethod
    });

    onCreated?.(deal.id);
  };

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleCreateDeal();
  };

  const handleRequest = (note: string) => {
    void note;
    handleCreateDeal();
  };

  const handleCancel = (note: string) => {
    void note;
    onCancel?.();
  };

  const handleApproveTokens = (mode: ApprovalMode) => {
    void mode;
    // Token allowance integration can be added here.
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
  const conversionDisplay = (() => {
    if (!tokenAmount || tokenAmount <= 0) {
      return amountKind === "crypto" ? `≈ 0 ${offer.fiat}` : `≈ 0 ${offer.token}`;
    }
    if (amountKind === "crypto") {
      return `≈ ${formatFiatAmount(tokenAmount * offer.price)} ${offer.fiat}`;
    }
    return `≈ ${formatTokenAmount(tokenAmount, tokenDecimals)} ${offer.token}`;
  })();

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
            content: <ParticipantPill label="Merchant" address={offer.maker} />
          }
        ]}
        extraContent={
          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">Merchant requirements</span>
            <span className="text-sm text-muted-foreground">{MERCHANT_REQUIREMENTS}</span>
          </div>
        }
        metaItems={[
          createSideMetaItem({
            id: "your-side",
            label: "Your Side",
            side: userSide,
            description: `You ${userAction} crypto`
          }),
          {
            id: "token",
            label: "Token",
            value: (
              <span className="flex items-center gap-2">
                <TokenIcon symbol={offer.token} size={18} />
                <span className="text-sm font-medium text-foreground">{offer.token}</span>
              </span>
            )
          },
          {
            id: "fiat",
            label: "Fiat",
            value: (
              <span className="flex items-center gap-2">
                <FiatFlag fiat={offer.fiat} size={18} />
                <span className="text-sm font-medium text-foreground">{offer.fiat}</span>
              </span>
            )
          },
          {
            id: "price",
            label: "Price",
            value: `${formatPrice(offer.price)} ${offer.fiat}`
          }
        ]}
      />

      <DealStatusPanel
        state="NEW"
        side={offer.side}
        role="TAKER"
        comment={paymentDetails}
        commentName="new-deal-comment"
        commentError={paymentDetailsValid ? undefined : paymentDetailsError ?? "Payment details must be at least 5 characters."}
        onCommentChange={setPaymentDetails}
        onRequest={handleRequest}
        onCancel={handleCancel}
        onApproveTokens={handleApproveTokens}
      />

      <form
        onSubmit={handleFormSubmit}
        className="space-y-6 rounded-3xl bg-card/60 p-6 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.45)] backdrop-blur"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className={amountHeadingClass}>Amount</span>
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
                aria-invalid={!amountValid}
                value={amount}
                onChange={event => setAmount(event.target.value)}
                ref={amountInputRef}
                className="h-14 rounded-2xl bg-background/70 pl-4 pr-32 text-lg font-semibold"
                placeholder="Enter amount"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs font-medium uppercase text-muted-foreground">
                {amountLabel}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{conversionDisplay}</p>
            {amountError ? <p className="text-xs text-orange-500">{amountError}</p> : null}
          </div>

          <div className="flex flex-col gap-2">
            <span className={paymentMethodHeadingClass}>Payment method</span>
            <Select
              value={paymentMethod}
              onValueChange={setPaymentMethod}
              disabled={!hasPaymentOptions}
            >
              <SelectTrigger
                ref={paymentMethodTriggerRef}
                className="h-14 rounded-2xl bg-background/70 text-left font-medium"
                aria-invalid={!paymentMethodValid && hasPaymentOptions}
              >
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
            {paymentMethodError ? <p className="text-xs text-orange-500">{paymentMethodError}</p> : null}
          </div>
        </div>
        {!isFormValid ? (
          <div className="rounded-2xl bg-orange-400/10 p-4 text-sm text-orange-600">
            <p className="font-medium">Finish the following before requesting a deal:</p>
            <ol className="mt-2 space-y-1 list-decimal pl-4">
              {validationIssues.map(issue => (
                <li key={issue.field} onClick={() => focusField(issue.field)} className="cursor-pointer">
                  {issue.message}
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </form>
    </div>
  );
}
