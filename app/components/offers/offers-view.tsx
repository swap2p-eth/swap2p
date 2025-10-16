"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { createOfferColumns } from "@/lib/offer-columns";
import { useOffers } from "@/components/offers/offers-provider";
import type { OfferRow } from "@/lib/mock-offers";
import { TokenIcon } from "@/components/token-icon";
import { FiatFlag } from "@/components/fiat-flag";

const FILTER_STORAGE_KEY = "swap2p:offers-filters";
const ANY_OPTION = "any";

type StoredFilters = {
  side?: "BUY" | "SELL";
  token?: string;
  fiat?: string;
  paymentMethod?: string;
};

interface OffersViewProps {
  onStartDeal?: (offer: OfferRow) => void;
  onCreateOffer?: () => void;
}

export function OffersView({ onStartDeal, onCreateOffer }: OffersViewProps) {
  const { offers, isLoading } = useOffers();
  const [side, setSide] = React.useState("SELL");
  const [token, setToken] = React.useState(ANY_OPTION);
  const [fiat, setFiat] = React.useState(ANY_OPTION);
  const [paymentMethod, setPaymentMethod] = React.useState(ANY_OPTION);
  const [amount, setAmount] = React.useState("");

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const raw = window.localStorage.getItem(FILTER_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredFilters;
      if (parsed.side === "BUY" || parsed.side === "SELL") {
        setSide(parsed.side);
      }
      if (typeof parsed.token === "string") {
        setToken(parsed.token);
      }
      if (typeof parsed.fiat === "string") {
        setFiat(parsed.fiat);
      }
      if (typeof parsed.paymentMethod === "string") {
        setPaymentMethod(parsed.paymentMethod);
      }
    } catch (error) {
      console.warn("Failed to read offer filters from storage", error);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const payload = JSON.stringify({
      side,
      token,
      fiat,
      paymentMethod
    });
    window.localStorage.setItem(FILTER_STORAGE_KEY, payload);
  }, [side, token, fiat, paymentMethod]);

  const tokenOptions = React.useMemo(() => {
    const options = new Set<string>();
    for (const offer of offers) {
      options.add(offer.token);
    }
    return [ANY_OPTION, ...Array.from(options).sort((a, b) => a.localeCompare(b))];
  }, [offers]);

  const fiatOptions = React.useMemo(() => {
    const options = new Set<string>();
    for (const offer of offers) {
      options.add(offer.fiat);
    }
    return [ANY_OPTION, ...Array.from(options).sort((a, b) => a.localeCompare(b))];
  }, [offers]);

  const columns = React.useMemo(() => createOfferColumns(onStartDeal), [onStartDeal]);
  const paymentMethodOptions = React.useMemo(() => {
    const options = new Set<string>();
    for (const offer of offers) {
      offer.paymentMethods
        .split(",")
        .map(method => method.trim())
        .filter(Boolean)
        .forEach(method => options.add(method));
    }
    return [ANY_OPTION, ...Array.from(options).sort((a, b) => a.localeCompare(b))];
  }, [offers]);

  React.useEffect(() => {
    if (!tokenOptions.includes(token)) {
      setToken(ANY_OPTION);
    }
  }, [tokenOptions, token]);

  React.useEffect(() => {
    if (!fiatOptions.includes(fiat)) {
      setFiat(ANY_OPTION);
    }
  }, [fiatOptions, fiat]);

  React.useEffect(() => {
    if (!paymentMethodOptions.includes(paymentMethod)) {
      setPaymentMethod(ANY_OPTION);
    }
  }, [paymentMethodOptions, paymentMethod]);

  const filteredOffers = React.useMemo(() => {
    const trimmedAmount = amount.trim();
    const amountValue = trimmedAmount === "" ? null : Number(trimmedAmount);
    const hasAmountFilter = amountValue !== null && !Number.isNaN(amountValue);

    return offers.filter(offer => {
      if (offer.side !== side) return false;
      if (token !== ANY_OPTION && offer.token !== token) return false;
      if (fiat !== ANY_OPTION && offer.fiat !== fiat) return false;
      if (paymentMethod !== ANY_OPTION) {
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
  }, [offers, side, token, fiat, paymentMethod, amount]);

  const handleCreateOffer = React.useCallback(() => {
    if (onCreateOffer) {
      onCreateOffer();
    } else if (typeof window !== "undefined") {
      window.location.hash = "new-offer";
    }
  }, [onCreateOffer]);

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

      <Card className="rounded-3xl bg-gradient-to-br from-background/70 to-background/30">
        <CardHeader className="space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl">Filters</CardTitle>
              <CardDescription>
                Do you want to buy or sell crypto?
              </CardDescription>
            </div>
            {/*<span className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">Do you want to buy or sell crypto?</span>*/}
            <SegmentedControl
              value={side}
              onChange={setSide}
              options={[
                { label: "BUY", value: "BUY" },
                { label: "SELL", value: "SELL" }
              ]}
            />
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
                      {option === ANY_OPTION ? (
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
              <Select value={fiat} onValueChange={setFiat}>
                <SelectTrigger>
                  <SelectValue placeholder="Any fiat" />
                </SelectTrigger>
                <SelectContent>
                  {fiatOptions.map(option => (
                    <SelectItem key={option} value={option}>
                      {option === ANY_OPTION ? (
                        "Any fiat"
                      ) : (
                        <span className="flex items-center gap-2">
                          <FiatFlag fiat={option} size={20} />
                          {option}
                        </span>
                      )}
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
                      {option === ANY_OPTION ? "Any payment method" : option}
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
{/*            <div>
              <h2 className="text-lg font-semibold">Maker offers</h2>
              <p className="text-sm text-muted-foreground">
                Filter results update as soon as we plug real data.
              </p>
            </div>*/}
            <DataTable
              columns={columns}
              data={filteredOffers}
              title="Offers"
              emptyMessage="No offers match the current filters."
              isLoading={isLoading}
              onRowClick={offer => {
                onStartDeal?.(offer as OfferRow);
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
