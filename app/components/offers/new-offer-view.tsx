"use client";

import * as React from "react";
import { ClipboardCopy, Loader2, MapPin, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn } from "@/lib/utils";
import { APP_CONFIG, getNetworkConfig, type NetworkKey, type TokenConfig } from "@/config";
import { useOffers } from "./offers-provider";

type DealSide = "BUY" | "SELL";

interface NewOfferViewProps {
  onCancel?: () => void;
  onCreated?: () => void;
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

export function NewOfferView({ onCancel, onCreated }: NewOfferViewProps) {
  const [networkKey, setNetworkKey] = React.useState<NetworkKey>(APP_CONFIG.defaultNetwork);
  const network = React.useMemo(() => getNetworkConfig(networkKey), [networkKey]);

  const { refresh } = useOffers();

  const [side, setSide] = React.useState<DealSide>("SELL");
  const [token, setToken] = React.useState<TokenConfig | null>(network.tokens[0] ?? null);
  const [fiat, setFiat] = React.useState(network.fiats[0]?.code ?? "");
  const [price, setPrice] = React.useState("");
  const [reserve, setReserve] = React.useState("");
  const [minAmount, setMinAmount] = React.useState("");
  const [maxAmount, setMaxAmount] = React.useState("");
  const [requirements, setRequirements] = React.useState("");
  const [comment, setComment] = React.useState("");
  const [selectedMethods, setSelectedMethods] = React.useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successState, setSuccessState] = React.useState<null | {
    reference: string;
    summary: string;
  }>(null);

  React.useEffect(() => {
    setToken(network.tokens[0] ?? null);
    setFiat(network.fiats[0]?.code ?? "");
    setSelectedMethods([]);
  }, [network]);

  const paymentMethodOptions = React.useMemo<PaymentMethodOption[]>(() => {
    const methods = network.paymentMethods[fiat] ?? [];
    return methods.map(method => ({ id: method, label: method }));
  }, [network.paymentMethods, fiat]);

  React.useEffect(() => {
    setSelectedMethods(prev => {
      if (prev.length === 0) return prev;
      const set = new Set(paymentMethodOptions.map(item => item.label));
      return prev.filter(item => set.has(item));
    });
  }, [paymentMethodOptions]);

  const handleToggleMethod = (method: string) => {
    setSelectedMethods(prev => {
      if (prev.includes(method)) {
        return prev.filter(value => value !== method);
      }
      return [...prev, method];
    });
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessState(null);

    if (!token) {
      setError("Select a token to continue.");
      return;
    }

    const parsedPrice = Number(price);
    const parsedReserve = Number(reserve);
    const parsedMin = Number(minAmount);
    const parsedMax = Number(maxAmount);

    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setError("Enter a positive price.");
      return;
    }
    if (!Number.isFinite(parsedReserve) || parsedReserve <= 0) {
      setError("Enter the amount of tokens you plan to reserve.");
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
    const payload = {
      chainId: network.chainId,
      side,
      token: {
        symbol: token.symbol,
        address: token.address,
        decimals: token.decimals
      },
      fiat,
      price: parsedPrice,
      reserve: parsedReserve,
      minAmount: parsedMin,
      maxAmount: parsedMax,
      requirements: requirements.trim(),
      paymentMethods: selectedMethods,
      comment: comment.trim()
    };

    // In a real app this is where we would call the contract or backend.
    // For now, simulate the action and refresh the mock offers list.
    window.console.info("[swap2p] create offer payload", payload);

    setTimeout(() => {
      setIsSubmitting(false);
      setSuccessState({
        reference: `${Math.random().toString(16).slice(2, 8)}-${Date.now().toString().slice(-4)}`,
        summary: `${side} ${token.symbol} for ${fiat} with ${selectedMethods.length || "no"} payment methods`
      });
      refresh();
      onCreated?.();
    }, 600);
  };

  const handleCopyAddress = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(network.swap2pAddress).catch(() => {
        setError("Unable to copy address. Copy it manually from the card below.");
      });
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Create offer</h1>
          <p className="text-sm text-muted-foreground">
            Publish maker liquidity parameters and invite takers to lock deals with you.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={networkKey} onValueChange={value => setNetworkKey(value as NetworkKey)}>
            <SelectTrigger className="w-48 rounded-full">
              <SelectValue placeholder="Select network" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(APP_CONFIG.networks).map(([key, cfg]) => (
                <SelectItem key={key} value={key}>
                  {cfg.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="secondary" className="rounded-full" onClick={() => onCancel?.()}>
            Back to offers
          </Button>
        </div>
      </div>

      <Card className="rounded-3xl border bg-gradient-to-br from-background/70 to-background/30 shadow-lg shadow-primary/5">
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle className="text-xl">Network details</CardTitle>
              <CardDescription className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {network.name} · Chain ID {network.chainId}
              </CardDescription>
            </div>
            <Button type="button" variant="outline" className="rounded-full" onClick={handleCopyAddress}>
              <ClipboardCopy className="mr-2 h-4 w-4" />
              Copy contract
            </Button>
          </div>
          <div className="rounded-2xl border border-dashed border-border/60 bg-background/80 px-4 py-3 text-xs text-muted-foreground sm:text-sm">
            Swap2p contract: <span className="font-mono text-foreground">{network.swap2pAddress}</span>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-8" onSubmit={handleSubmit}>
            <section className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3 rounded-3xl border border-border/60 bg-background/60 p-6">
                <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">Side</span>
                <SegmentedControl
                  value={side}
                  onChange={value => setSide(value as DealSide)}
                  options={[
                    { label: "SELL", value: "SELL" },
                    { label: "BUY", value: "BUY" }
                  ]}
                />
                <p className="text-xs text-muted-foreground">
                  SELL — you deposit tokens and wait for fiat. BUY — you deposit fiat collateral and wait for tokens.
                </p>
              </div>

              <div className="space-y-3 rounded-3xl border border-border/60 bg-background/60 p-6">
                <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">Token</span>
                <Select
                  value={token?.symbol ?? ""}
                  onValueChange={symbol => {
                    const next = network.tokens.find(item => item.symbol === symbol) ?? null;
                    setToken(next);
                  }}
                >
                  <SelectTrigger className="rounded-full">
                    <SelectValue placeholder="Select token" />
                  </SelectTrigger>
                  <SelectContent>
                    {network.tokens.map(item => (
                      <SelectItem key={item.symbol} value={item.symbol}>
                        {item.symbol} · {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {token && (
                  <p className="text-xs text-muted-foreground">
                    Address: <span className="font-mono text-[11px]">{token.address}</span>
                  </p>
                )}
              </div>
            </section>

            <section className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">Fiat currency</label>
                <Select value={fiat} onValueChange={code => setFiat(code)}>
                  <SelectTrigger className="rounded-full">
                    <SelectValue placeholder="Select fiat" />
                  </SelectTrigger>
                  <SelectContent>
                    {network.fiats.map(item => (
                      <SelectItem key={item.code} value={item.code}>
                        {item.code} · {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {network.fiats.find(item => item.code === fiat)?.country ?? "Select a fiat currency."}
                </p>
              </div>

              <div className="space-y-3">
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
              </div>
            </section>

            <section className="grid gap-6 md:grid-cols-3">
              <div className="space-y-3">
                <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">
                  Reserve (token units)
                </label>
                <Input
                  value={reserve}
                  onChange={event => setReserve(event.target.value)}
                  inputMode="decimal"
                  placeholder="e.g. 2500"
                  className="rounded-full"
                />
              </div>
              <div className="space-y-3">
                <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">Minimum amount</label>
                <Input
                  value={minAmount}
                  onChange={event => setMinAmount(event.target.value)}
                  inputMode="decimal"
                  placeholder="e.g. 200"
                  className="rounded-full"
                />
              </div>
              <div className="space-y-3">
                <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">Maximum amount</label>
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
                          "flex cursor-pointer items-center justify-between rounded-2xl border border-border/40 bg-background/70 px-4 py-2 text-sm transition hover:border-primary/40 hover:bg-primary/5"
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
                <p className="text-xs text-muted-foreground">
                  Choose the rails you can settle against. At least one method is recommended.
                </p>
              </div>

              <div className="space-y-3">
                <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">
                  Maker requirements
                </label>
                <TextArea
                  value={requirements}
                  onChange={event => setRequirements(event.target.value)}
                  placeholder="Describe verification, documents, or timing expectations for takers."
                />
              </div>
            </section>

            <section className="space-y-3">
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">Comment</label>
              <TextArea
                value={comment}
                onChange={event => setComment(event.target.value)}
                placeholder="Optional note visible in the offer card."
                className="min-h-[80px]"
              />
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
                  Offer draft prepared · ref {successState.reference}
                </div>
                <p className="mt-2 text-xs text-emerald-800/80">{successState.summary}</p>
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => onCancel?.()}
                className="rounded-full px-6"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" className="rounded-full px-6" disabled={isSubmitting || !token}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? "Publishing…" : "Publish offer"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
