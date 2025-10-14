"use client";

import * as React from "react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { offerColumns } from "@/lib/offer-columns";
import { mockOffers } from "@/lib/mock-offers";
import { TokenIcon } from "@/components/token-icon";

const tokenOptions = ["USDT", "ETH", "BTC", "USDC", "DAI"];
const fiatOptions = ["USD", "EUR", "CNY", "GBP", "BRL", "TRY", "AED", "INR"];

export function OffersView() {
  const [side, setSide] = React.useState("SELL");
  const [token, setToken] = React.useState("USDT");
  const [fiat, setFiat] = React.useState("USD");
  const [paymentMethod, setPaymentMethod] = React.useState("");
  const [amount, setAmount] = React.useState("");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-8">
      <section className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Offers</h1>
        <p className="text-sm text-muted-foreground">
          Explore maker inventory across markets. Choose the side, token, and fiat rails to narrow the list.
        </p>
      </section>

      <Card className="rounded-3xl bg-gradient-to-br from-background/70 to-background/30">
        <CardHeader className="space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl">Filters</CardTitle>
              <CardDescription>
                Configure the parameters to match buyers and sellers you want to surface.
              </CardDescription>
            </div>
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
                  <SelectValue placeholder="Select token" />
                </SelectTrigger>
                <SelectContent>
                  {tokenOptions.map(option => (
                    <SelectItem key={option} value={option}>
                      <span className="flex items-center gap-2">
                        <TokenIcon symbol={option} size={20} />
                        {option}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">Fiat</span>
              <Select value={fiat} onValueChange={setFiat}>
                <SelectTrigger>
                  <SelectValue placeholder="Select fiat" />
                </SelectTrigger>
                <SelectContent>
                  {fiatOptions.map(option => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">
                Payment method
              </span>
              <Input
                placeholder="Revolut, SEPA, Pix…"
                value={paymentMethod}
                onChange={event => setPaymentMethod(event.target.value)}
                className="rounded-full bg-background/70"
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">Amount</span>
              <Input
                type="number"
                min={0}
                placeholder="Min/Max"
                value={amount}
                onChange={event => setAmount(event.target.value)}
                className="rounded-full bg-background/70"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold">Maker offers</h2>
              <p className="text-sm text-muted-foreground">
                Filter results update as soon as we plug real data.
              </p>
            </div>
            <DataTable
              columns={offerColumns}
              data={mockOffers}
              title="Offers"
              emptyMessage="No offers match the current filters."
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
