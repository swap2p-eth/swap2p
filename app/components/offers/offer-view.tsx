"use client";

import * as React from "react";
import { Loader2, Trash2, Trophy, X } from "lucide-react";
import { useChainId } from "wagmi";
import { formatUnits, isHex, parseUnits } from "viem";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { FIAT_BY_COUNTRY, FIAT_INFOS, getNetworkConfigForChain } from "@/config";
import { useOffers } from "./offers-provider";
import { DealHeader } from "@/components/deals/deal-header";
import { TokenIcon } from "@/components/token-icon";
import { FiatFlag } from "@/components/fiat-flag";
import type { OfferRow } from "@/lib/types/market";
import { SideToggle } from "@/components/deals/side-toggle";
import { useSwap2pAdapter } from "@/hooks/use-swap2p-adapter";

const TOKEN_STORAGE_KEY = "swap2p:offer:last-token";
const FIAT_STORAGE_KEY = "swap2p:offer:last-fiat";
const DEFAULT_TOKEN_SYMBOL = "USDT";
const DEFAULT_FIAT_CODE = "US";
const PRICE_SCALE = 1_000;
const PRICE_SCALE_BI = BigInt(PRICE_SCALE);

type BaselineValues = {
  priceScaled: bigint;
  priceDisplay: string;
  minAmountScaled: bigint;
  minDisplay: string;
  maxAmountScaled: bigint;
  maxDisplay: string;
  paymentMethods: string[];
  requirements: string;
};

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

const formatPriceFromScaled = (value: bigint): string => {
  const integer = value / PRICE_SCALE_BI;
  const fraction = value % PRICE_SCALE_BI;
  if (fraction === 0n) {
    return integer.toString();
  }
  let fractionStr = fraction.toString().padStart(3, "0");
  while (fractionStr.endsWith("0")) {
    fractionStr = fractionStr.slice(0, -1);
  }
  return `${integer.toString()}.${fractionStr}`;
};

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
  const defaultFiat = FIAT_INFOS[0]?.countryCode ?? "";
  const { offers, makerOffers, createOffer, updateOffer, removeOffer } = useOffers();
  const { adapter } = useSwap2pAdapter();

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

  const sortedTokens = React.useMemo(
    () => [...network.tokens].sort((a, b) => a.symbol.localeCompare(b.symbol)),
    [network.tokens],
  );

  const preferredTokenSymbol = React.useMemo(() => {
    const fallback = sortedTokens.find(item => item.symbol === DEFAULT_TOKEN_SYMBOL)?.symbol ?? sortedTokens[0]?.symbol ?? "";
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY);
      if (stored && sortedTokens.some(item => item.symbol === stored)) {
        return stored;
      }
    }
    return fallback;
  }, [sortedTokens]);

  const preferredFiatCode = React.useMemo(() => {
    const fallback = FIAT_INFOS.find(info => info.countryCode.toUpperCase() === DEFAULT_FIAT_CODE)?.countryCode ?? defaultFiat;
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(FIAT_STORAGE_KEY);
      if (stored) {
        const normalized = stored.toUpperCase();
        if (FIAT_INFOS.some(info => info.countryCode.toUpperCase() === normalized)) {
          return normalized;
        }
      }
    }
    return fallback;
  }, [defaultFiat]);

  const [side, setSide] = React.useState<DealSide>(existingOffer?.side ?? "SELL");
  const [tokenSymbol, setTokenSymbol] = React.useState<string>(existingOffer?.token ?? preferredTokenSymbol);
  const [fiat, setFiat] = React.useState<string>(existingOffer?.countryCode ?? preferredFiatCode);
  const selectedFiatInfo = React.useMemo(() => FIAT_BY_COUNTRY.get(fiat.toUpperCase()), [fiat]);
  const [price, setPrice] = React.useState(existingOffer ? String(existingOffer.price) : "");
  const [minAmount, setMinAmount] = React.useState(existingOffer ? String(existingOffer.minAmount) : "");
  const [maxAmount, setMaxAmount] = React.useState(existingOffer ? String(existingOffer.maxAmount) : "");
  const [requirements, setRequirements] = React.useState(existingOffer?.requirements ?? "");
  const [selectedMethods, setSelectedMethods] = React.useState<string[]>(parseMethods(existingOffer?.paymentMethods));
  const [customMethodInput, setCustomMethodInput] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successState, setSuccessState] = React.useState<null | { message: string; summary: string }>(null);
  const fieldTouchedRef = React.useRef({
    price: false,
    minAmount: false,
    maxAmount: false,
    paymentMethods: false,
    requirements: false,
  });
  const [baseline, setBaseline] = React.useState<BaselineValues | null>(null);
  const [baselineLoaded, setBaselineLoaded] = React.useState(false);

  const backLabel = "Back";
  const fallbackHash = returnHash ?? "offers";

  React.useEffect(() => {
    if (!fiat && preferredFiatCode) {
      setFiat(preferredFiatCode);
    }
  }, [fiat, preferredFiatCode]);

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
      setFiat(existingOffer.countryCode);
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
    fieldTouchedRef.current = {
      price: false,
      minAmount: false,
      maxAmount: false,
      paymentMethods: false,
      requirements: false,
    };
  }, [isEdit, existingOffer?.id]);

  React.useEffect(() => {
    if (!isEdit) {
      setTokenSymbol(preferredTokenSymbol);
      setFiat(preferredFiatCode);
      setPrice("");
      setMinAmount("");
      setMaxAmount("");
      setRequirements("");
      setSelectedMethods([]);
      setCustomMethodInput("");
      setError(null);
      setSuccessState(null);
    }
  }, [network, isEdit, preferredFiatCode, preferredTokenSymbol]);

  React.useEffect(() => {
    if (!isEdit) {
      setSelectedMethods([]);
      setCustomMethodInput("");
    }
  }, [fiat, isEdit]);

  React.useEffect(() => {
    if (!(isEdit && existingOffer)) {
      setBaseline(null);
      setBaselineLoaded(false);
      return;
    }

    const decimalsValue =
      existingOffer.tokenDecimals ??
      (sortedTokens.find(item => item.symbol === existingOffer.token)?.decimals ?? 18);

    const applyBaseline = (
      priceScaled: bigint,
      minScaled: bigint,
      maxScaled: bigint,
      methods: string[],
      requirementsValue: string,
    ) => {
      setBaseline({
        priceScaled,
        priceDisplay: formatPriceFromScaled(priceScaled),
        minAmountScaled: minScaled,
        minDisplay: formatUnits(minScaled, decimalsValue),
        maxAmountScaled: maxScaled,
        maxDisplay: formatUnits(maxScaled, decimalsValue),
        paymentMethods: methods,
        requirements: requirementsValue,
      });
    };

    const fallbackBaseline = () => {
      try {
        const priceScaled = BigInt(Math.round(existingOffer.price * PRICE_SCALE));
        const minScaled = parseUnits(String(existingOffer.minAmount), decimalsValue);
        const maxScaled = parseUnits(String(existingOffer.maxAmount), decimalsValue);
        const methods = parseMethods(existingOffer.paymentMethods);
        const requirementsValue = existingOffer.requirements ?? "";
        applyBaseline(priceScaled, minScaled, maxScaled, methods, requirementsValue);
      } catch (error) {
        console.error("[offer] failed to derive fallback baseline", error);
        setBaseline(null);
      } finally {
        setBaselineLoaded(true);
      }
    };

    const contractKey = existingOffer.contractKey;

    if (!adapter || !contractKey) {
      fallbackBaseline();
      return;
    }

    let cancelled = false;
    setBaselineLoaded(false);

    (async () => {
      try {
        const onchain = await adapter.getOffer(contractKey);
        if (cancelled) return;
        if (!onchain) {
          fallbackBaseline();
          return;
        }
        const priceScaled = BigInt(onchain.priceFiatPerToken);
        const minScaled = onchain.minAmount;
        const maxScaled = onchain.maxAmount;
        const methods = parseMethods(onchain.paymentMethods);
        const requirementsValue = onchain.requirements ?? "";
        applyBaseline(priceScaled, minScaled, maxScaled, methods, requirementsValue);
        setBaselineLoaded(true);
      } catch (error) {
        if (!cancelled) {
          console.error("[offer] failed to fetch on-chain baseline", error);
          fallbackBaseline();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [adapter, existingOffer, isEdit, sortedTokens]);

  React.useEffect(() => {
    if (!isEdit || !baseline) return;
    const touched = fieldTouchedRef.current;
    if (!touched.price) setPrice(baseline.priceDisplay);
    if (!touched.minAmount) setMinAmount(baseline.minDisplay);
    if (!touched.maxAmount) setMaxAmount(baseline.maxDisplay);
    if (!touched.paymentMethods) setSelectedMethods(baseline.paymentMethods);
    if (!touched.requirements) setRequirements(baseline.requirements);
  }, [baseline, isEdit]);

  const paymentMethodOptions = React.useMemo<PaymentMethodOption[]>(() => {
    const currencyKey = selectedFiatInfo?.currencyCode ?? "";
    const base = network.paymentMethods[currencyKey] ?? [];
    const extra = selectedMethods.filter(method => !base.includes(method));
    return [...base, ...extra].map(method => ({ id: method, label: method }));
  }, [network, selectedFiatInfo, selectedMethods]);

  const tokenConfig = React.useMemo(
    () => sortedTokens.find(item => item.symbol === tokenSymbol),
    [sortedTokens, tokenSymbol],
  );
  const tokenDecimals = React.useMemo(
    () => existingOffer?.tokenDecimals ?? tokenConfig?.decimals ?? 18,
    [existingOffer?.tokenDecimals, tokenConfig],
  );

  const getPriceScaled = React.useCallback((value: string): bigint | null => {
    if (!value || !value.trim()) return null;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    return BigInt(Math.round(numeric * PRICE_SCALE));
  }, []);

  const getAmountScaled = React.useCallback(
    (value: string): bigint | null => {
      if (!value || !value.trim()) return null;
      try {
        return parseUnits(value, tokenDecimals);
      } catch {
        return null;
      }
    },
    [tokenDecimals],
  );

  const priceChanged = React.useMemo(() => {
    if (!isEdit || !baselineLoaded || !baseline) return false;
    const scaled = getPriceScaled(price);
    if (scaled === null) return true;
    return scaled !== baseline.priceScaled;
  }, [baseline, baselineLoaded, getPriceScaled, isEdit, price]);

  const minChanged = React.useMemo(() => {
    if (!isEdit || !baselineLoaded || !baseline) return false;
    const scaled = getAmountScaled(minAmount);
    if (scaled === null) return true;
    return scaled !== baseline.minAmountScaled;
  }, [baseline, baselineLoaded, getAmountScaled, isEdit, minAmount]);

  const maxChanged = React.useMemo(() => {
    if (!isEdit || !baselineLoaded || !baseline) return false;
    const scaled = getAmountScaled(maxAmount);
    if (scaled === null) return true;
    return scaled !== baseline.maxAmountScaled;
  }, [baseline, baselineLoaded, getAmountScaled, isEdit, maxAmount]);

  const paymentMethodsChanged = React.useMemo(() => {
    if (!isEdit || !baselineLoaded || !baseline) return false;
    const normalize = (list: string[]) =>
      Array.from(new Set(list.map(item => item.trim().toLowerCase()).filter(Boolean))).sort();
    const current = normalize(selectedMethods);
    const baselineNormalized = normalize(baseline.paymentMethods);
    if (current.length !== baselineNormalized.length) return true;
    return current.some((entry, index) => entry !== baselineNormalized[index]);
  }, [baseline, baselineLoaded, isEdit, selectedMethods]);

  const requirementsChanged = React.useMemo(() => {
    if (!isEdit || !baselineLoaded || !baseline) return false;
    return requirements.trim() !== baseline.requirements.trim();
  }, [baseline, baselineLoaded, isEdit, requirements]);

  const tokenLabel = (tokenSymbol || "token").toUpperCase();

  const addCustomMethod = React.useCallback(() => {
    const trimmed = customMethodInput.trim();
    if (!trimmed) return;
    fieldTouchedRef.current.paymentMethods = true;
    setSelectedMethods(prev => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    setCustomMethodInput("");
  }, [customMethodInput]);

  const handleToggleMethod = (method: string) => {
    fieldTouchedRef.current.paymentMethods = true;
    setSelectedMethods(prev => (prev.includes(method) ? prev.filter(item => item !== method) : [...prev, method]));
  };

  const handleRemoveMethod = (method: string) => {
    fieldTouchedRef.current.paymentMethods = true;
    setSelectedMethods(prev => prev.filter(item => item !== method));
  };

  const handleTokenChange = React.useCallback((symbol: string) => {
    setTokenSymbol(symbol);
    if (!isEdit && typeof window !== "undefined") {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, symbol);
    }
  }, [isEdit]);

  const handleFiatChange = React.useCallback((code: string) => {
    setFiat(code);
    if (!isEdit && typeof window !== "undefined") {
      window.localStorage.setItem(FIAT_STORAGE_KEY, code.toUpperCase());
    }
  }, [isEdit]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
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

    if (!selectedFiatInfo) {
      setError("Select a fiat currency to continue.");
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

    try {
      if (isEdit && existingOffer) {
        const updated = await updateOffer(existingOffer, {
          price: parsedPrice,
          minAmount: parsedMin,
          maxAmount: parsedMax,
          paymentMethods: selectedMethods,
          requirements: requirements.trim()
        });

        setSuccessState({
          message: "Offer updated",
          summary: `${updated.side} ${updated.token} for ${updated.fiat} · ${summarizeMethods(parseMethods(updated.paymentMethods))}`
        });
        onCreated?.();
        return;
      }

      const created = await createOffer({
        side,
        token: tokenSymbol,
        countryCode: fiat,
        price: parsedPrice,
        minAmount: parsedMin,
        maxAmount: parsedMax,
        paymentMethods: selectedMethods,
        requirements: requirements.trim()
      });

      setSuccessState({
        message: "Offer published",
        summary: `${created.side} ${created.token} for ${created.fiat} · ${summarizeMethods(parseMethods(created.paymentMethods))}`
      });
      onCreated?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to publish offer.";
      console.error("[offer] submit failed", err);
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!isEdit || !existingOffer) return;
    setError(null);
    setSuccessState(null);
    setIsDeleting(true);
    try {
      await removeOffer(existingOffer);
      onDelete?.();
      navigateBack();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete offer.";
      console.error("[offer] delete failed", err);
      setError(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const tokenOptions = React.useMemo(() => {
    const symbols = sortedTokens.map(item => item.symbol);
    if (isEdit && existingOffer && !symbols.includes(existingOffer.token)) {
      return [existingOffer.token, ...symbols];
    }
    return symbols;
  }, [sortedTokens, isEdit, existingOffer]);

  const fiatOptions = React.useMemo(() => FIAT_INFOS, []);

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
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-8" onSubmit={handleSubmit}>
            <section className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">Token</span>
                <Select
                  disabled={disableImmutable}
                  value={tokenSymbol}
                  onValueChange={handleTokenChange}
                >
                  <SelectTrigger className="rounded-full">
                    <SelectValue placeholder="Select token" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64 overflow-y-auto">
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
              <div className="space-y-3">
                <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">Fiat currency</span>
                <Select
                  disabled={disableImmutable}
                  value={fiat}
                  onValueChange={handleFiatChange}
                >
                  <SelectTrigger className="rounded-full">
                    <SelectValue placeholder="Select fiat" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64 overflow-y-auto">
                    {fiatOptions.map(option => (
                      <SelectItem key={option.countryCode} value={option.countryCode}>
                        <span className="flex items-center gap-2">
                          <FiatFlag fiat={option.countryCode} size={18} />
                          {option.currencyCode} - {option.countryName}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </section>

            <section className="space-y-3">
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">
                Quoted price ({selectedFiatInfo?.currencyCode ?? (fiat || "—")})
              </label>
              <NumericInput
                value={price}
                onChange={event => {
                  fieldTouchedRef.current.price = true;
                  setPrice(event.target.value);
                }}
                placeholder="e.g. 1.01"
                className={cn("rounded-full", priceChanged && "border-blue-500 focus-visible:ring-blue-500")}
              />
              <p className="text-xs text-muted-foreground">
                Price per token unit in {selectedFiatInfo?.currencyCode ?? (fiat || "selected currency")}.
              </p>
            </section>

            <section className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">
                  Minimum amount ({tokenLabel})
                </label>
                <NumericInput
                  value={minAmount}
                  onChange={event => {
                    fieldTouchedRef.current.minAmount = true;
                    setMinAmount(event.target.value);
                  }}
                  placeholder="e.g. 200"
                  className={cn("rounded-full", minChanged && "border-blue-500 focus-visible:ring-blue-500")}
                />
              </div>
              <div className="space-y-3">
                <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">
                  Maximum amount ({tokenLabel})
                </label>
                <NumericInput
                  value={maxAmount}
                  onChange={event => {
                    fieldTouchedRef.current.maxAmount = true;
                    setMaxAmount(event.target.value);
                  }}
                  placeholder="e.g. 2500"
                  className={cn("rounded-full", maxChanged && "border-blue-500 focus-visible:ring-blue-500")}
                />
              </div>
            </section>

            <section className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">
                  Payment methods ({selectedFiatInfo?.currencyCode ?? "select fiat"})
                </label>
                <div
                  className={cn(
                    "grid gap-2 rounded-3xl border border-border/60 bg-background/60 p-4",
                    paymentMethodsChanged && "border-blue-500"
                  )}
                >
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
                      maxLength={32}
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
                  Choose the rails you can settle against. Activate defaults or add own labels.
                </p>
              </div>

              <div className="space-y-3">
                <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">
                  Requirements
                </label>
                <TextArea
                  value={requirements}
                  onChange={event => {
                    fieldTouchedRef.current.requirements = true;
                    setRequirements(event.target.value);
                  }}
                  placeholder="Write requirements and, if you sell crypto, include payment details for each rail."
                  maxLength={256}
                  className={cn("min-h-[200px]", requirementsChanged && "border-blue-500 focus-visible:ring-blue-500")}
                />
                <p className="text-xs text-muted-foreground">
                  Write requirements and, if you sell, include payment details for each rail.
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

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
                <Button type="submit" className="rounded-full px-6" disabled={isSubmitting || isDeleting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {submitLabel}
                </Button>
                <Button type="button" variant="outline" onClick={navigateBack} className="rounded-full px-6" disabled={isSubmitting || isDeleting}>
                  Cancel
                </Button>
              </div>
              {isEdit ? (
                <Button
                  type="button"
                  variant="destructive"
                  className="rounded-full px-6"
                  onClick={handleDelete}
                  disabled={isDeleting || isSubmitting}
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting…
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete offer
                    </>
                  )}
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
