"use client";

import * as React from "react";
import { Loader2, Trash2, Trophy, X } from "lucide-react";
import { useChainId } from "wagmi";
import { isHex } from "viem";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getNetworkConfigForChain } from "@/config";
import { useOffers } from "./offers-provider";
import { DealHeader } from "@/components/deals/deal-header";
import { TokenIcon } from "@/components/token-icon";
import { FiatFlag } from "@/components/fiat-flag";
import type { OfferRow } from "@/lib/types/market";
import { SideToggle } from "@/components/deals/side-toggle";

type DealSide = "BUY" | "SELL";
type OfferEditorMode = "create" | "edit";

interface OfferViewProps {
  mode?: OfferEditorMode;
  offerId?: string;
  onCancel?: () => void;
  onCreated?: () => void;
  onDelete?: () => void;
  returnHash?: string;
}

interface PaymentMethodOption {
  id: string;
  label: string;
}

const textareaBase =
  "min-h-[120px] w-full rounded-3xl border border-border bg-background/70 px-4 py-3 text-sm shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(textareaBase, props.className)} />;
}

const parseMethods = (raw?: string) =>
  raw
    ? raw
        .split(",")
        .map(value => value.trim())
        .filter(Boolean)
    : [];

const summarizeMethods = (methods: string[]) => (methods.length ? methods.join(", ") : "no payment methods");

export function OfferView({
  mode = "create",
  offerId,
  onCancel,
  onCreated,
  onDelete,
  returnHash
}: OfferViewProps) {
  const chainId = useChainId();
  const network = React.useMemo(() => getNetworkConfigForChain(chainId), [chainId]);
  const { offers, makerOffers, createOffer, updateOffer, removeOffer } = useOffers();

  const rawOfferId = React.useMemo(() => (typeof offerId === "string" ? offerId.trim() : ""), [offerId]);
  const normalizedOfferId = React.useMemo(() => {
    if (!rawOfferId) return null;
    const prefixed = rawOfferId.startsWith("0x") ? rawOfferId : `0x${rawOfferId}`;
    const normalized = prefixed.toLowerCase();
    if (!isHex(normalized, { strict: false })) return null;
    if (normalized.length !== 66) return null;
    return normalized;
  }, [rawOfferId]);
  const wantsEdit = mode === "edit";
  const hasInvalidOfferId = wantsEdit && rawOfferId.length > 0 && !normalizedOfferId;
  const isEdit = wantsEdit && Boolean(normalizedOfferId);

  const existingOffer = React.useMemo<OfferRow | undefined>(
    () =>
      isEdit && normalizedOfferId
        ? [...makerOffers, ...offers].find(entry => entry.id.toLowerCase() === normalizedOfferId)
        : undefined,
    [isEdit, normalizedOfferId, makerOffers, offers]
  );

  const [side, setSide] = React.useState<DealSide>(existingOffer?.side ?? "SELL");
  const [tokenSymbol, setTokenSymbol] = React.useState<string>(existingOffer?.token ?? network.tokens[0]?.symbol ?? "");
  const [fiat, setFiat] = React.useState<string>(existingOffer?.fiat ?? network.fiats[0]?.code ?? "");
  const [price, setPrice] = React.useState(existingOffer ? String(existingOffer.price) : "");
  const [minAmount, setMinAmount] = React.useState(existingOffer ? String(existingOffer.minAmount) : "");
  const [maxAmount, setMaxAmount] = React.useState(existingOffer ? String(existingOffer.maxAmount) : "");
  const [requirements, setRequirements] = React.useState(existingOffer?.requirements ?? "");
  const [selectedMethods, setSelectedMethods] = React.useState<string[]>(parseMethods(existingOffer?.paymentMethods));
  const [customMethodInput, setCustomMethodInput] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successState, setSuccessState] = React.useState<null | { message: string; summary: string }>(null);

  const backLabel = "Back";
  const fallbackHash = returnHash ?? "offers";

  const navigateBack = React.useCallback(() => {
    if (onCancel) {
      onCancel();
    } else if (typeof window !== "undefined") {
      window.location.hash = fallbackHash;
    }
  }, [onCancel, fallbackHash]);

  React.useEffect(() => {
    if (isEdit && existingOffer) {
      setSide(existingOffer.side);
      setTokenSymbol(existingOffer.token);
      setFiat(existingOffer.fiat);
      setPrice(String(existingOffer.price));
      setMinAmount(String(existingOffer.minAmount));
      setMaxAmount(String(existingOffer.maxAmount));
      setRequirements(existingOffer.requirements ?? "");
      setSelectedMethods(parseMethods(existingOffer.paymentMethods));
      setCustomMethodInput("");
      setError(null);
      setSuccessState(null);
    }
  }, [isEdit, existingOffer]);

  React.useEffect(() => {
    if (!isEdit) {
      setTokenSymbol(network.tokens[0]?.symbol ?? "");
      setFiat(network.fiats[0]?.code ?? "");
      setPrice("");
      setMinAmount("");
      setMaxAmount("");
      setRequirements("");
      setSelectedMethods([]);
      setCustomMethodInput("");
      setError(null);
      setSuccessState(null);
    }
  }, [network, isEdit]);

  React.useEffect(() => {
    if (!isEdit) {
      setSelectedMethods([]);
      setCustomMethodInput("");
    }
  }, [fiat, isEdit]);

  const paymentMethodOptions = React.useMemo<PaymentMethodOption[]>(() => {
    const base = network.paymentMethods[fiat] ?? [];
    const extra = selectedMethods.filter(method => !base.includes(method));
    return [...base, ...extra].map(method => ({ id: method, label: method }));
  }, [network, fiat, selectedMethods]);

  const tokenLabel = (tokenSymbol || "token").toUpperCase();

  const addCustomMethod = React.useCallback(() => {
    const trimmed = customMethodInput.trim();
    if (!trimmed) return;
    setSelectedMethods(prev => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    setCustomMethodInput("");
  }, [customMethodInput]);

  const handleToggleMethod = (method: string) => {
    setSelectedMethods(prev => (prev.includes(method) ? prev.filter(item => item !== method) : [...prev, method]));
  };

  const handleRemoveMethod = (method: string) => {
    setSelectedMethods(prev => prev.filter(item => item !== method));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessState(null);

    if (isEdit && !existingOffer) {
      setError("Offer not found.");
      return;
    }

    if (!tokenSymbol) {
      setError("Select a token to continue.");
      return;
    }

    const parsedPrice = Number(price);
    const parsedMin = Number(minAmount);
    const parsedMax = Number(maxAmount);

    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setError("Enter a positive price.");
      return;
    }
    if (!Number.isFinite(parsedMin) || parsedMin <= 0) {
      setError("Minimum amount must be greater than zero.");
      return;
    }
    if (!Number.isFinite(parsedMax) || parsedMax <= 0) {
      setError("Maximum amount must be greater than zero.");
      return;
    }
    if (parsedMax < parsedMin) {
      setError("Maximum amount must be greater than or equal to the minimum amount.");
      return;
    }

    setIsSubmitting(true);

    if (isEdit && existingOffer) {
      const updated = updateOffer(existingOffer.id, {
        price: parsedPrice,
        minAmount: parsedMin,
        maxAmount: parsedMax,
        paymentMethods: selectedMethods
      });

      setIsSubmitting(false);

      if (!updated) {
        setError("Failed to update offer.");
        return;
      }

      setSuccessState({
        message: "Offer updated",
        summary: `${updated.side} ${updated.token} for ${updated.fiat} · ${summarizeMethods(selectedMethods)}`
      });
      onCreated?.();
      return;
    }

    const created = createOffer({
      side,
      token: tokenSymbol,
      fiat,
      price: parsedPrice,
      minAmount: parsedMin,
      maxAmount: parsedMax,
      paymentMethods: selectedMethods,
      requirements: requirements.trim()
    });

    setIsSubmitting(false);
    setSuccessState({
      message: "Offer draft prepared",
      summary: `${created.side} ${created.token} for ${created.fiat} · ${summarizeMethods(selectedMethods)}`
    });
    onCreated?.();
  };

  const handleDelete = () => {
    if (!isEdit || !existingOffer) return;
    removeOffer(existingOffer.id);
    onDelete?.();
    navigateBack();
  };

  const tokenOptions = React.useMemo(() => {
    const symbols = network.tokens.map(item => item.symbol);
    if (isEdit && existingOffer && !symbols.includes(existingOffer.token)) {
      return [existingOffer.token, ...symbols];
    }
    return symbols;
  }, [network, isEdit, existingOffer]);

  const fiatOptions = React.useMemo(() => {
    const codes = network.fiats.map(item => item.code);
    if (isEdit && existingOffer && !codes.includes(existingOffer.fiat)) {
      return [existingOffer.fiat, ...codes];
    }
    return codes;
  }, [network, isEdit, existingOffer]);

  if (hasInvalidOfferId) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-12 text-center sm:px-8">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Invalid offer identifier</h1>
        <p className="text-sm text-muted-foreground">
          The requested offer id must be a 32-byte hex string. Return to the dashboard and choose another offer.
        </p>
        <Button type="button" onClick={navigateBack} className="mx-auto rounded-full px-6">
          {backLabel}
        </Button>
      </div>
    );
  }

  if (isEdit && !existingOffer) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-12 text-center sm:px-8">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Offer not found</h1>
        <p className="text-sm text-muted-foreground">
          This offer is no longer available. Return to the previous section to pick another one.
        </p>
        <Button type="button" onClick={navigateBack} className="mx-auto rounded-full px-6">
          {backLabel}
        </Button>
      </div>
    );
  }

  const submitLabel = isEdit ? (isSubmitting ? "Saving…" : "Save changes") : isSubmitting ? "Publishing…" : "Publish offer";
  const disableImmutable = isEdit;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-8">
      <DealHeader
        title={isEdit ? "Edit offer" : "Create offer"}
        subtitle={isEdit ? "Adjust price, limits, and rails for this offer." : "Publish maker liquidity parameters and invite takers to lock deals with you."}
        backLabel={backLabel}
        onBack={navigateBack}
      />

      <Card className="rounded-3xl border bg-gradient-to-br from-background/70 to-background/30 shadow-lg shadow-primary/5">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <CardTitle className="text-xl">Offer parameters</CardTitle>
            <p className="text-sm text-muted-foreground">
              Configure price, limits, rails, and taker requirements for this offer.
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <SideToggle value={side} onChange={value => !disableImmutable && setSide(value)} disabled={disableImmutable} />
            {isEdit ? (
              <Button type="button" variant="destructive" className="rounded-full px-6" onClick={handleDelete}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete offer
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-8" onSubmit={handleSubmit}>
            <section className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3 rounded-3xl border border-border/60 bg-background/60 p-6">
                <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">Token</span>
                <Select
                  disabled={disableImmutable}
                  value={tokenSymbol}
                  onValueChange={symbol => setTokenSymbol(symbol)}
                >
                  <SelectTrigger className="rounded-full">
                    <SelectValue placeholder="Select token" />
                  </SelectTrigger>
                  <SelectContent>
                    {tokenOptions.map(symbol => (
                      <SelectItem key={symbol} value={symbol}>
                        <span className="flex items-center gap-2">
                          <TokenIcon symbol={symbol} size={20} />
                          {symbol}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3 rounded-3xl border border-border/60 bg-background/60 p-6">
                <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">Fiat currency</span>
                <Select disabled={disableImmutable} value={fiat} onValueChange={code => setFiat(code)}>
                  <SelectTrigger className="rounded-full">
                    <SelectValue placeholder="Select fiat" />
                  </SelectTrigger>
                  <SelectContent>
                    {fiatOptions.map(code => (
                      <SelectItem key={code} value={code}>
                        <span className="flex items-center gap-2">
                          <FiatFlag fiat={code} size={18} />
                          {code}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </section>

            <section className="space-y-3">
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">
                Quoted price ({fiat})
              </label>
              <Input
                value={price}
                onChange={event => setPrice(event.target.value)}
                inputMode="decimal"
                placeholder="e.g. 1.01"
                className="rounded-full"
              />
              <p className="text-xs text-muted-foreground">Price per token unit in {fiat}.</p>
            </section>

            <section className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">
                  Minimum amount ({tokenLabel})
                </label>
                <Input
                  value={minAmount}
                  onChange={event => setMinAmount(event.target.value)}
                  inputMode="decimal"
                  placeholder="e.g. 200"
                  className="rounded-full"
                />
              </div>
              <div className="space-y-3">
                <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">
                  Maximum amount ({tokenLabel})
                </label>
                <Input
                  value={maxAmount}
                  onChange={event => setMaxAmount(event.target.value)}
                  inputMode="decimal"
                  placeholder="e.g. 2500"
                  className="rounded-full"
                />
              </div>
            </section>

            <section className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">
                  Payment methods ({fiat || "select fiat"})
                </label>
                <div className="grid gap-2 rounded-3xl border border-border/60 bg-background/60 p-4">
                  {paymentMethodOptions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No payment methods configured for {fiat || "this fiat"}.
                    </p>
                  ) : (
                    paymentMethodOptions.map(option => (
                      <label
                        key={option.id}
                        className={cn(
                          "flex cursor-pointer items-center justify-between rounded-2xl border border-border/40 bg-background/70 px-4 py-2 text-sm transition hover:border-primary/40 hover:bg-primary/5",
                          selectedMethods.includes(option.label) ? "border-primary/50" : undefined
                        )}
                      >
                        <span>{option.label}</span>
                        <input
                          type="checkbox"
                          checked={selectedMethods.includes(option.label)}
                          onChange={() => handleToggleMethod(option.label)}
                          className="h-4 w-4 accent-primary"
                        />
                      </label>
                    ))
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <Input
                      value={customMethodInput}
                      onChange={event => setCustomMethodInput(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addCustomMethod();
                        }
                      }}
                      placeholder="Add custom method"
                      className="rounded-full"
                    />
                    <Button type="button" variant="outline" className="rounded-full" onClick={addCustomMethod}>
                      Add
                    </Button>
                  </div>
                  {selectedMethods.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedMethods.map(method => (
                        <span
                          key={method}
                          className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary"
                        >
                          {method}
                          <button
                            type="button"
                            onClick={() => handleRemoveMethod(method)}
                            className="rounded-full bg-primary/20 p-0.5 text-primary transition hover:bg-primary/30"
                            aria-label={`Remove ${method}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  Choose the rails you can settle against. Activate defaults or add your own labels.
                </p>
              </div>

              <div className="space-y-3">
                <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">
                  Maker requirements
                </label>
                <TextArea
                  value={requirements}
                  onChange={event => setRequirements(event.target.value)}
                  placeholder="Write taker requirements and, if you sell crypto, include payment details for each rail."
                  className="min-h-[200px]"
                  readOnly={isEdit}
                />
                <p className="text-xs text-muted-foreground">
                  Write taker requirements and, if you sell crypto, include payment details for each rail.
                </p>
              </div>
            </section>

            {error && (
              <div className="rounded-3xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {successState && (
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-700">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4" />
                  {successState.message}
                </div>
                <p className="mt-2 text-xs text-emerald-800/80">{successState.summary}</p>
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={navigateBack} className="rounded-full px-6" disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" className="rounded-full px-6" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {submitLabel}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
