"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { createOfferColumns } from "@/lib/offer-columns";
import { useOffers } from "@/components/offers/offers-provider";
import type { OfferRow } from "@/lib/types/market";
import { TokenIcon } from "@/components/token-icon";
import { FiatFlag } from "@/components/fiat-flag";
import { SideToggle } from "@/components/deals/side-toggle";
import { cn } from "@/lib/utils";
import {
  ANY_FILTER_OPTION,
  OFFERS_FILTER_STORAGE_KEY,
  readStoredFilters
} from "@/components/offers/filter-storage";
import { RefreshCw } from "lucide-react";
import { useUser } from "@/context/user-context";
import { useConnectModal } from "@rainbow-me/rainbowkit";
const DEFAULT_FIAT = "USD";

interface OffersViewProps {
  onStartDeal?: (offer: OfferRow) => void;
  onCreateOffer?: () => void;
  onEditOffer?: (offer: OfferRow) => void;
}

export function OffersView({ onStartDeal, onCreateOffer, onEditOffer }: OffersViewProps) {
  const { offers, isLoading, ensureMarket, tokens, fiats, activeMarket, refresh } = useOffers();
  const { address } = useUser();
  const { openConnectModal } = useConnectModal();
  const [side, setSide] = React.useState<"BUY" | "SELL">(activeMarket.side);
  const [token, setToken] = React.useState(ANY_FILTER_OPTION);
  const [fiat, setFiat] = React.useState(activeMarket.fiat.toUpperCase());
  const [paymentMethod, setPaymentMethod] = React.useState(ANY_FILTER_OPTION);
  const [amount, setAmount] = React.useState("");
  const [filtersReady, setFiltersReady] = React.useState(false);

  const normalizedAddress = React.useMemo(() => address.trim().toLowerCase(), [address]);
  const [createRequested, setCreateRequested] = React.useState(false);

  React.useEffect(() => {
    if (filtersReady) {
      return;
    }
    // Hydrate filters once from localStorage so we call ensureMarket with the user's last choice.
    let nextSide: "BUY" | "SELL" = activeMarket.side;
    let nextToken = ANY_FILTER_OPTION;
    let nextFiat = activeMarket.fiat.toUpperCase();
    let nextPaymentMethod = ANY_FILTER_OPTION;

    const stored = readStoredFilters();
    if (stored) {
      if (stored.side === "BUY" || stored.side === "SELL") {
        nextSide = stored.side;
      }
      if (typeof stored.token === "string") {
        nextToken = stored.token;
      }
      if (typeof stored.fiat === "string") {
        nextFiat =
          stored.fiat === ANY_FILTER_OPTION ? activeMarket.fiat.toUpperCase() : stored.fiat.toUpperCase();
      }
      if (typeof stored.paymentMethod === "string") {
        nextPaymentMethod = stored.paymentMethod;
      }
    }

    setSide(nextSide);
    setToken(nextToken);
    setFiat(nextFiat);
    setPaymentMethod(nextPaymentMethod);
    console.debug("[OffersView] filters hydrated", JSON.stringify({
      side: nextSide,
      token: nextToken,
      fiat: nextFiat,
      paymentMethod: nextPaymentMethod,
    }));
    setFiltersReady(true);
  }, [filtersReady, activeMarket.side, activeMarket.fiat]);

  React.useEffect(() => {
    if (!filtersReady) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }
    const payload = JSON.stringify({
      side,
      token,
      fiat: fiat.toUpperCase(),
      paymentMethod
    });
    window.localStorage.setItem(OFFERS_FILTER_STORAGE_KEY, payload);
  }, [filtersReady, side, token, fiat, paymentMethod]);

  const defaultFiat = React.useMemo(
    () => (fiats[0] ?? DEFAULT_FIAT).toUpperCase(),
    [fiats],
  );

  const normalizedFiat = fiat.toUpperCase();

  React.useEffect(() => {
    if (!fiats.includes(normalizedFiat)) {
      setFiat(defaultFiat);
    }
  }, [fiats, normalizedFiat, defaultFiat]);

  React.useEffect(() => {
    if (!filtersReady) {
      return;
    }
    console.debug("[OffersView] ensureMarket", JSON.stringify({ side, fiat: normalizedFiat }));
    void ensureMarket({ side, fiat: normalizedFiat });
  }, [filtersReady, side, normalizedFiat, ensureMarket]);

  const tokenOptions = React.useMemo(() => {
    const symbols = tokens.map(item => item.symbol);
    return [ANY_FILTER_OPTION, ...symbols.sort((a, b) => a.localeCompare(b))];
  }, [tokens]);

  const fiatOptions = React.useMemo(() => {
    const unique = new Set(fiats.map(code => code.toUpperCase()));
    const preferred = defaultFiat;
    const sorted = Array.from(unique).sort((a, b) => a.localeCompare(b));
    return [preferred, ...sorted.filter(option => option !== preferred)];
  }, [fiats, defaultFiat]);

  const columns = React.useMemo(() => {
    const hiddenAccessorKeys = new Set(["side", "fiat"]);
    return createOfferColumns(onStartDeal, { showMerchant: true }).filter(column => {
      const accessorKey = (column as { accessorKey?: string }).accessorKey;
      return !accessorKey || !hiddenAccessorKeys.has(accessorKey);
    });
  }, [onStartDeal]);
  const paymentMethodOptions = React.useMemo(() => {
    const options = new Set<string>();
    for (const offer of offers) {
      offer.paymentMethods
        .split(",")
        .map(method => method.trim())
        .filter(Boolean)
        .forEach(method => options.add(method));
    }
    return [ANY_FILTER_OPTION, ...Array.from(options).sort((a, b) => a.localeCompare(b))];
  }, [offers]);

  React.useEffect(() => {
    if (!filtersReady) {
      return;
    }
    if (!tokenOptions.includes(token)) {
      setToken(ANY_FILTER_OPTION);
    }
  }, [filtersReady, tokenOptions, token]);

  React.useEffect(() => {
    if (!filtersReady) {
      return;
    }
    if (!fiatOptions.includes(normalizedFiat)) {
      setFiat(defaultFiat);
    }
  }, [filtersReady, fiatOptions, normalizedFiat, defaultFiat]);

  React.useEffect(() => {
    if (!filtersReady) {
      return;
    }
    // Only fall back to ANY once we have real methods from the fetched offers.
    const hasConcreteOptions = paymentMethodOptions.some(option => option !== ANY_FILTER_OPTION);
    if (hasConcreteOptions && !paymentMethodOptions.includes(paymentMethod)) {
      setPaymentMethod(ANY_FILTER_OPTION);
    }
  }, [filtersReady, paymentMethodOptions, paymentMethod]);

  const filteredOffers = React.useMemo(() => {
    const trimmedAmount = amount.trim();
    const amountValue = trimmedAmount === "" ? null : Number(trimmedAmount);
    const hasAmountFilter = amountValue !== null && !Number.isNaN(amountValue);
    const merchantSide = side === "BUY" ? "SELL" : "BUY";

    return offers.filter(offer => {
      if (offer.side !== merchantSide) return false;
      if (token !== ANY_FILTER_OPTION && offer.token !== token) return false;
      if (offer.fiat.toUpperCase() !== normalizedFiat) return false;
      if (paymentMethod !== ANY_FILTER_OPTION) {
        const methods = offer.paymentMethods
          .split(",")
          .map(method => method.trim())
          .filter(Boolean);
        if (!methods.includes(paymentMethod)) {
          return false;
        }
      }
      if (hasAmountFilter) {
        if (amountValue === null) {
          return false;
        }
        if (amountValue < offer.minAmount || amountValue > offer.maxAmount) {
          return false;
        }
      }
      return true;
    });
  }, [offers, side, token, normalizedFiat, paymentMethod, amount]);

  const handleRefresh = React.useCallback(() => {
    void refresh();
  }, [refresh]);

  const triggerCreateOffer = React.useCallback(() => {
    if (onCreateOffer) {
      onCreateOffer();
    } else if (typeof window !== "undefined") {
      window.location.hash = "offer";
    }
  }, [onCreateOffer]);

  const handleCreateOffer = React.useCallback(() => {
    if (!normalizedAddress) {
      setCreateRequested(true);
      openConnectModal?.();
      return;
    }
    triggerCreateOffer();
  }, [normalizedAddress, openConnectModal, triggerCreateOffer]);

  React.useEffect(() => {
    if (createRequested && normalizedAddress) {
      triggerCreateOffer();
      setCreateRequested(false);
    }
  }, [createRequested, normalizedAddress, triggerCreateOffer]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Offers</h1>
          <p className="text-sm text-muted-foreground">
            Explore maker inventory across markets. Choose the side, token, and fiat rails to narrow the list.
          </p>
        </div>
        <Button
          type="button"
          size="lg"
          className="rounded-full px-6 text-sm font-medium shadow-lg shadow-primary/20"
          onClick={handleCreateOffer}
        >
          Create Offer
        </Button>
      </section>

      <Card className="rounded-3xl bg-gradient-to-br from-background/70 to-background/30 shadow-none">
        <CardHeader className="space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl">Filters</CardTitle>
              <CardDescription>
                Do you want to buy or sell crypto?
              </CardDescription>
            </div>
            {/*<span className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">Do you want to buy or sell crypto?</span>*/}
            <SideToggle value={side as "BUY" | "SELL"} onChange={setSide} />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">Token</span>
              <Select value={token} onValueChange={setToken}>
                <SelectTrigger>
                  <SelectValue placeholder="Any token" />
                </SelectTrigger>
                <SelectContent>
                  {tokenOptions.map(option => (
                    <SelectItem key={option} value={option}>
                      {option === ANY_FILTER_OPTION ? (
                        "Any token"
                      ) : (
                        <span className="flex items-center gap-2">
                          <TokenIcon symbol={option} size={20} />
                          {option}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">Fiat</span>
              <Select value={fiat} onValueChange={value => setFiat(value.toUpperCase())}>
                <SelectTrigger>
                  <SelectValue placeholder="Select fiat" />
                </SelectTrigger>
                <SelectContent>
                  {fiatOptions.map(option => (
                    <SelectItem key={option} value={option}>
                      <span className="flex items-center gap-2">
                        <FiatFlag fiat={option} size={20} />
                        {option}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">
                Payment method
              </span>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="rounded-full bg-background/70 text-left">
                  <SelectValue placeholder="Any payment method" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethodOptions.map(option => (
                    <SelectItem key={option} value={option}>
                      {option === ANY_FILTER_OPTION ? "Any payment method" : option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">Amount</span>
              <Input
                type="number"
                min={0}
                placeholder=""
                value={amount}
                onChange={event => setAmount(event.target.value)}
                className="rounded-full bg-background/70"
              />
            </div>
          </div>

          <div className="space-y-3">
            <DataTable
              className="[&_td]:py-5"
              columns={columns}
              data={filteredOffers}
              title="Offers"
              headerActions={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
                  onClick={handleRefresh}
                  disabled={isLoading}
                  aria-label="Refresh offers"
                >
                  <RefreshCw className={cn("h-4 w-4", isLoading ? "animate-spin" : "")} />
                </Button>
              }
              emptyMessage="No offers match the current filters."
              isLoading={isLoading}
              onRowClick={offer => {
                const selected = offer as OfferRow;
                if (normalizedAddress && selected.maker?.toLowerCase() === normalizedAddress) {
                  if (onEditOffer) {
                    onEditOffer(selected);
                  } else if (typeof window !== "undefined") {
                    window.location.hash = `offer/${selected.id}`;
                  }
                  return;
                }
                onStartDeal?.(selected);
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
