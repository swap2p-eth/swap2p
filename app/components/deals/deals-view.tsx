"use client";

import * as React from "react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { createOfferColumns } from "@/lib/offer-columns";
import { dealColumns } from "@/lib/deal-columns";
import { CURRENT_USER_ADDRESS } from "@/lib/mock-user";
import { useDeals } from "./deals-provider";
import { useOffers } from "@/components/offers/offers-provider";
import { useHashLocation } from "@/hooks/use-hash-location";

interface DealsViewProps {
  onSelectDeal?: (dealId: number) => void;
}

export function DealsView({ onSelectDeal }: DealsViewProps) {
  const [status, setStatus] = React.useState("active");
  const { deals, isLoading: dealsLoading } = useDeals();
  const { offers, isLoading: offersLoading } = useOffers();
  const { setHash } = useHashLocation("offers");

  const userDeals = React.useMemo(
    () => deals.filter(deal => deal.maker === CURRENT_USER_ADDRESS || deal.taker === CURRENT_USER_ADDRESS),
    [deals]
  );

  const filteredDeals = React.useMemo(() => {
    const base = status === "closed"
      ? userDeals.filter(deal => deal.state !== "REQUESTED")
      : userDeals.filter(deal => deal.state === "REQUESTED");
    return base.slice(0, 5);
  }, [userDeals, status]);

  const myOffers = React.useMemo(
    () => offers.filter(offer => offer.maker === CURRENT_USER_ADDRESS).slice(0, 6),
    [offers]
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-8">
      <section className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Manage your deals and offers from a single workspace.</p>
      </section>

      <Card className="rounded-3xl bg-gradient-to-br from-background/70 to-background/30">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl">My Deals</CardTitle>
            <CardDescription>
              Switch between open deals and recently closed ones. Selecting a row reveals full context.
            </CardDescription>
          </div>
          <SegmentedControl
            value={status}
            onChange={setStatus}
            options={[
              { label: "Active", value: "active" },
              { label: "Closed", value: "closed" }
            ]}
          />
        </CardHeader>
        <CardContent className="space-y-6">
          <DataTable
            columns={dealColumns}
            data={filteredDeals}
            title={status === "active" ? "Active deals" : "Closed deals"}
            emptyMessage="There are no deals in this view yet."
            isLoading={dealsLoading}
            onRowClick={deal => {
              const id = (deal as { id: number }).id;
              onSelectDeal?.(id);
            }}
          />
        </CardContent>
      </Card>

      <Card className="rounded-3xl bg-gradient-to-br from-background/70 to-background/30">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl">My Offers</CardTitle>
            <CardDescription>Review every offer you currently publish to takers.</CardDescription>
          </div>
          <Button type="button" className="rounded-full px-6" onClick={() => setHash("new-offer")}>
            Create Offer
          </Button>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={createOfferColumns()}
            data={myOffers}
            title="Published offers"
            emptyMessage="You have not published any offers yet."
            isLoading={offersLoading}
          />
        </CardContent>
      </Card>
    </div>
  );
}
