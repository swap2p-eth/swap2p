"use client";

import * as React from "react";
import { useChainId, usePublicClient, useWalletClient } from "wagmi";
import { erc20Abi, getAddress, maxUint256, parseUnits, type Address } from "viem";

import { Button } from "@/components/ui/button";
import { NumericInput } from "@/components/ui/numeric-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { FiatFlag } from "@/components/fiat-flag";
import { TokenIcon } from "@/components/token-icon";
import type { OfferRow } from "@/lib/types/market";
import { cn, formatAddressShort } from "@/lib/utils";
import { DealHeader } from "./deal-header";
import { DealSummaryCard } from "./deal-summary-card";
import { DealStatusPanel } from "./deal-status-panel";
import { useDeals } from "./deals-provider";
import { useOffers } from "@/components/offers/offers-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { ParticipantPill } from "@/components/deals/participant-pill";
import { buildDealMetaItems } from "@/hooks/use-deal-meta";
import { formatFiatAmount, formatPrice, formatTokenAmount } from "@/lib/number-format";
import { PriceMetaValue } from "@/components/deals/price-meta-value";
import type { ApprovalMode } from "./token-approval-button";
import { BANK_TRANSFER_LABEL, getNetworkConfigForChain } from "@/config";
import { isUserRejectedError } from "@/lib/errors";
import { error as logError, warn as logWarn } from "@/lib/logger";
import { DealRequestSchema, sanitizeDealNote, sanitizePaymentMethod } from "@/lib/validation";

type AmountKind = "crypto" | "fiat";
type ValidationField = "amount" | "paymentMethod" | "paymentDetails";

interface NewDealViewProps {
  offerId: string;
  onCancel?: () => void;
  onCreated?: (dealId: string) => void;
  returnHash?: string;
}

const MERCHANT_REQUIREMENTS =
  "Merchant requirements will be published here. Expect KYB steps, settlement SLA, and compliance notes.";

const parsePaymentMethods = (raw: string): string[] => {
  if (!raw) return [];
  return raw
    .split(",")
    .map(method => sanitizePaymentMethod(method))
    .filter(Boolean);
};

const withBankTransferFirst = (methods: string[]): string[] => {
  const trimmed = methods.map(method => method.trim()).filter(Boolean);
  const unique = Array.from(new Set(trimmed));
  const withoutBank = unique.filter(method => method !== BANK_TRANSFER_LABEL);
  return [BANK_TRANSFER_LABEL, ...withoutBank];
};

const formatOfferSubtitle = (offer: OfferRow) =>
  offer.side === "BUY"
    ? "Maker escrows collateral and waits for your tokens."
    : "Review offer details and provide amount.";

export function NewDealView({ offerId, onCancel, onCreated, returnHash = "offers" }: NewDealViewProps) {
  const { offers, isLoading: offersLoading } = useOffers();
  const offer = React.useMemo(() => offers.find(item => item.id === offerId), [offers, offerId]);
  const { createDeal } = useDeals();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId });
  const { data: walletClient } = useWalletClient({ chainId });
  const network = React.useMemo(() => getNetworkConfigForChain(chainId), [chainId]);
  const ownerAddress = React.useMemo(() => {
    const account = walletClient?.account;
    if (!account) return null;
    if (typeof account === "string") {
      try {
        return getAddress(account);
      } catch {
        return null;
      }
    }
    if (typeof account === "object" && "address" in account && account.address) {
      try {
        return getAddress(account.address as string);
      } catch {
        return null;
      }
    }
    return null;
  }, [walletClient]);

  const [amountKind, setAmountKind] = React.useState<AmountKind>("crypto");
  const [amount, setAmount] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState<string>("");
  const [paymentDetails, setPaymentDetails] = React.useState("");
  const amountInputRef = React.useRef<HTMLInputElement>(null);
  const paymentMethodTriggerRef = React.useRef<HTMLButtonElement>(null);
  const [actionBusy, setActionBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [approvalBusy, setApprovalBusy] = React.useState(false);
  const [allowanceLoading, setAllowanceLoading] = React.useState(false);
  const [allowanceNonce, setAllowanceNonce] = React.useState(0);
  const [tokenAllowance, setTokenAllowance] = React.useState<bigint | null>(null);
  const [termsAccepted, setTermsAccepted] = React.useState(false);

  const handlePaymentDetailsChange = React.useCallback((value: string) => {
    setPaymentDetails(sanitizeDealNote(value));
  }, []);

  React.useEffect(() => {
    if (!offer) return;
    setAmountKind("crypto");
    setAmount(offer.minAmount.toString());
    const options = withBankTransferFirst(parsePaymentMethods(offer.paymentMethods));
    setPaymentMethod(options.length === 1 ? sanitizePaymentMethod(options[0]) : "");
    setPaymentDetails("");
    setActionError(null);
    setTermsAccepted(false);
  }, [offerId, offer]);

  React.useEffect(() => {
    setActionError(null);
  }, [amount, paymentMethod, paymentDetails, termsAccepted]);

  React.useEffect(() => {
    if (!offer?.contractKey?.token || !ownerAddress || !publicClient) {
      setTokenAllowance(null);
      setAllowanceLoading(false);
      return;
    }
    let cancelled = false;
    const loadAllowance = async () => {
      setAllowanceLoading(true);
      try {
        const value = await publicClient.readContract({
          abi: erc20Abi,
          address: offer.contractKey?.token as Address,
          functionName: "allowance",
          args: [ownerAddress, network.swap2pAddress as Address]
        });
        if (!cancelled) {
          setTokenAllowance(value as bigint);
        }
      } catch (error) {
        logError("new-deal", "allowance read failed", error);
        if (!cancelled) {
          setTokenAllowance(null);
        }
      } finally {
        if (!cancelled) {
          setAllowanceLoading(false);
        }
      }
    };
    void loadAllowance();
    return () => {
      cancelled = true;
    };
  }, [offer?.contractKey?.token, ownerAddress, publicClient, network.swap2pAddress, allowanceNonce]);

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
          This offer is no longer available. Return to the previous section to pick another one.
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

  const tokenDecimals = offer.tokenDecimals ?? 18;
  const displayTokenDecimals = Math.min(tokenDecimals, 8);

  const paymentOptions = withBankTransferFirst(parsePaymentMethods(offer.paymentMethods));
  const hasPaymentOptions = paymentOptions.length > 0;
  const limitsRange = `${formatTokenAmount(offer.minAmount, displayTokenDecimals)} – ${formatTokenAmount(offer.maxAmount, displayTokenDecimals)} ${offer.token}`;
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
  const tokenAmountString = (() => {
    if (tokenAmount === null) return null;
    if (amountKind === "crypto") {
      const trimmed = amount.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    return tokenAmount.toLocaleString("en-US", {
      useGrouping: false,
      maximumFractionDigits: Math.min(tokenDecimals, 18)
    });
  })();
  const baseTokenUnits = (() => {
    if (!tokenAmountString) return null;
    try {
      return parseUnits(tokenAmountString, tokenDecimals);
    } catch {
      return null;
    }
  })();
  const depositMultiplier = offer.side === "BUY" ? 2n : 1n;
  const requiredAllowance = baseTokenUnits !== null ? baseTokenUnits * depositMultiplier : null;
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
  const minLabel = `${formatTokenAmount(offer.minAmount, displayTokenDecimals)} ${offer.token}`;
  const maxLabel = `${formatTokenAmount(offer.maxAmount, displayTokenDecimals)} ${offer.token}`;
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
  const hasSufficientAllowance =
    requiredAllowance !== null && tokenAllowance !== null && tokenAllowance >= requiredAllowance;
  const approvalRequested = Boolean(requiredAllowance !== null && offer.contractKey?.token && ownerAddress);
  const approvalButtonVisible = Boolean(offer.contractKey?.token && ownerAddress);
  const approvalApproved = approvalButtonVisible && hasSufficientAllowance;
  const primaryDisabled = Boolean(
    !ownerAddress ||
    (approvalRequested && !hasSufficientAllowance) ||
      allowanceLoading ||
      approvalBusy ||
      !termsAccepted,
  );
  const primaryDisabledHint = (() => {
    if (!ownerAddress) {
      return "Connect your wallet to continue.";
    }
    if (allowanceLoading) {
      return "Checking allowance…";
    }
    if (approvalRequested && !hasSufficientAllowance) {
      return "Approve the token allowance before continuing.";
    }
    return undefined;
  })();
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

  const handleCreateDeal = async (note?: string) => {
    if (!isFormValid || tokenAmount === null) {
      if (validationIssues.length > 0) {
        focusField(validationIssues[0].field);
      }
      return;
    }
    const effectiveDetails = typeof note === "string" && note.trim().length > 0 ? note : paymentDetails;
    const sanitizedDetails = sanitizeDealNote(effectiveDetails);
    const sanitizedMethod = sanitizePaymentMethod(paymentMethod);
    const validation = DealRequestSchema.safeParse({
      amount: tokenAmount,
      paymentMethod: sanitizedMethod,
      paymentDetails: sanitizedDetails,
    });
    if (!validation.success) {
      const issue = validation.error.issues[0];
      setActionError(issue?.message ?? "Invalid deal request.");
      return;
    }
    const validated = validation.data;
    setPaymentMethod(validated.paymentMethod);
    setPaymentDetails(validated.paymentDetails);
    setActionBusy(true);
    setActionError(null);
    try {
      const dealRow = await createDeal({
        offer,
        amount: validated.amount,
        amountKind,
        paymentMethod: validated.paymentMethod,
        paymentDetails: validated.paymentDetails
      });
      onCreated?.(dealRow.id);
    } catch (error) {
      const log = isUserRejectedError(error) ? logWarn : logError;
      log("new-deal", "request failed", error);
      const fullMessage =
        error instanceof Error ? error.message : typeof error === "string" ? error : "Failed to create deal.";
      const shortMessage = fullMessage.split(".")[0] ?? "Failed to create deal";
      setActionError(shortMessage.trim());
    } finally {
      setActionBusy(false);
    }
  };

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleCreateDeal(paymentDetails);
  };

  const handleRequest = (note: string) => {
    void handleCreateDeal(note);
  };

  const handleCancel = (note: string) => {
    void note;
    setTermsAccepted(false);
    onCancel?.();
  };

  const handleApproveTokens = async (mode: ApprovalMode) => {
    if (!offer?.contractKey) {
      setActionError("Offer data unavailable for approval.");
      return;
    }
    if (!publicClient || !walletClient || !ownerAddress) {
      setActionError("Connect your wallet to approve tokens.");
      return;
    }
    const tokenAddress = offer.contractKey.token as Address;
    const spender = network.swap2pAddress as Address;
    let allowanceTarget: bigint;
    if (mode === "max") {
      allowanceTarget = maxUint256;
    } else {
      if (!requiredAllowance) {
        setActionError("Enter a valid amount before approving tokens.");
        focusField("amount");
        return;
      }
      allowanceTarget = requiredAllowance;
    }

    setApprovalBusy(true);
    setActionError(null);
    try {
      const { request } = await publicClient.simulateContract({
        abi: erc20Abi,
        address: tokenAddress,
        functionName: "approve",
        args: [spender, allowanceTarget],
        account: ownerAddress
      });
      const txHash = await walletClient.writeContract(request);
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      setAllowanceNonce(value => value + 1);
    } catch (error) {
      const log = isUserRejectedError(error) ? logWarn : logError;
      log("new-deal", "approval failed", error);
      const fullMessage =
        error instanceof Error ? error.message : typeof error === "string" ? error : "Token approval failed.";
      const shortMessage = fullMessage.split(".")[0] ?? "Token approval failed";
      setActionError(shortMessage.trim());
    } finally {
      setApprovalBusy(false);
    }
  };

  const amountLabel =
    amountKind === "crypto" ? (
      <>
        <TokenIcon symbol={offer.token} size={18} className="rounded-full bg-white" />
        <span className="text-xs uppercase">{offer.token}</span>
      </>
    ) : (
      <>
        <FiatFlag fiat={offer.countryCode} size={18} />
        <span className="text-xs uppercase">{offer.fiat}</span>
      </>
    );
  const conversionDisplay = (() => {
    if (!tokenAmount || tokenAmount <= 0) {
      return amountKind === "crypto" ? `≈ 0 ${offer.currencyCode}` : `≈ 0 ${offer.token}`;
    }
    if (amountKind === "crypto") {
      return `≈ ${formatFiatAmount(tokenAmount * offer.price)} ${offer.currencyCode}`;
    }
    return `≈ ${formatTokenAmount(tokenAmount, displayTokenDecimals)} ${offer.token}`;
  })();

  const summaryTokenAmount = tokenAmount ?? offer.minAmount;
  const summaryTokenLabel = formatTokenAmount(summaryTokenAmount, displayTokenDecimals);
  const summaryFiatAmount = summaryTokenAmount * offer.price;
  const summaryFiatLabel = `≈ ${formatFiatAmount(summaryFiatAmount)}`;

  const metaItems = buildDealMetaItems({
    userSide,
    userActionDescription: `You ${userAction} crypto`,
    tokenSymbol: offer.token,
    tokenAmountLabel: summaryTokenLabel,
    countryCode: offer.countryCode,
    fiatLabel: offer.fiat,
    fiatSymbol: offer.currencyCode,
    fiatAmountLabel: summaryFiatLabel,
    priceValue: (
      <PriceMetaValue
        priceLabel={formatPrice(offer.price)}
        fiatSymbol={offer.currencyCode}
        tokenSymbol={offer.token}
      />
    )
  });

  const backLabel = returnHash === "dashboard" ? "Back to dashboard" : "Back to offers";

  const requestDetails = (
    <form
      onSubmit={handleFormSubmit}
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
                      <FiatFlag fiat={offer.countryCode} size={16} />
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
            <NumericInput
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
            onValueChange={value => setPaymentMethod(sanitizePaymentMethod(value))}
            disabled={!hasPaymentOptions}
          >
            <SelectTrigger
              ref={paymentMethodTriggerRef}
              className="h-14 rounded-2xl bg-background/70 text-left font-medium"
              aria-invalid={!paymentMethodValid && hasPaymentOptions}
            >
              <SelectValue placeholder="Select payment method" />
            </SelectTrigger>
            <SelectContent className="max-h-64 overflow-y-auto">
              {paymentOptions.map(method => (
                <SelectItem key={method} value={method}>
                  {method}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!hasPaymentOptions ? (
            <p className="text-xs text-muted-foreground">
              Maker has not published payment methods for this offer yet.
            </p>
          ) : null}
          {paymentMethodError ? <p className="text-xs text-orange-500">{paymentMethodError}</p> : null}
        </div>
      </div>
    </form>
  );

  const termsConsent = (
    <label className="flex items-start gap-3 text-sm text-muted-foreground">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 accent-primary"
        checked={termsAccepted}
        onChange={event => setTermsAccepted(event.target.checked)}
      />
      <span>
        By requesting this deal, I agree to the{" "}
        <a
          href="/#terms"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline-offset-4 transition hover:underline"
        >
          Swap2p Terms of Use
        </a>
        .
      </span>
    </label>
  );

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
        metaItems={metaItems}
      />

      <DealStatusPanel
        state="NEW"
        side={offer.side}
        role="TAKER"
        detailsContent={requestDetails}
        beforeActions={termsConsent}
        comment={paymentDetails}
        commentName="new-deal-comment"
        commentError={paymentDetailsValid ? undefined : paymentDetailsError ?? "Payment details must be at least 5 characters."}
        commentErrorTone={paymentDetailsValid ? undefined : "warning"}
        onCommentChange={handlePaymentDetailsChange}
        onRequest={handleRequest}
        onCancel={handleCancel}
        onApproveTokens={handleApproveTokens}
        busy={actionBusy}
        approvalBusy={approvalBusy || allowanceLoading}
        approvalModeStorageKey={`swap2p:approval:new-deal:${offer.id}`}
        approvalVisible={approvalButtonVisible}
        primaryDisabled={primaryDisabled}
        primaryDisabledHint={primaryDisabledHint}
        approvalApproved={approvalApproved}
        approvalApprovedLabel="Approved"
      />

      {actionError ? (
        <div className="rounded-2xl bg-red-500/10 p-4 text-sm text-red-600">
          {actionError}
        </div>
      ) : null}
    </div>
  );
}
