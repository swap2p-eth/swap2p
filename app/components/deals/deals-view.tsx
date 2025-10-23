"use client";

import * as React from "react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { createOfferColumns } from "@/lib/offer-columns";
import { createDealColumns } from "@/lib/deal-columns";
import { useCurrentUserDeals } from "@/hooks/use-current-user-deals";
import { useOffers } from "@/components/offers/offers-provider";
import { useHashLocation } from "@/hooks/use-hash-location";
import type { OfferRow } from "@/lib/types/market";
import { useUser } from "@/context/user-context";
import { useConnectModal } from "@rainbow-me/rainbowkit";

interface DealsViewProps {
  onSelectDeal?: (dealId: number) => void;
}

export function DealsView({ onSelectDeal }: DealsViewProps) {
  const [status, setStatus] = React.useState("active");
  const { activeDeals, closedDeals, isLoading: dealsLoading } = useCurrentUserDeals();
  const { makerOffers, isMakerLoading } = useOffers();
  const { setHash } = useHashLocation("offers");
  const { address } = useUser();
  const { openConnectModal } = useConnectModal();

  const normalizedAddress = React.useMemo(() => address.trim().toLowerCase(), [address]);

  const filteredDeals = React.useMemo(
    () => (status === "closed" ? closedDeals : activeDeals),
    [status, activeDeals, closedDeals]
  );

  const myOffers = React.useMemo(() => makerOffers, [makerOffers]);

  if (!normalizedAddress) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-4xl flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Please connect your wallet to use Dashboard.
          </p>
        </div>
        <Button
          type="button"
          size="lg"
          className="rounded-full px-8 py-3 text-base font-semibold"
          onClick={() => openConnectModal?.()}
        >
          Connect Wallet
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-8">
      <section className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Manage your deals and offers from a single workspace.</p>
      </section>

      <Card className="rounded-3xl bg-gradient-to-br from-background/70 to-background/30 shadow-none">
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
            columns={createDealColumns(address, { includeAction: status === "active" })}
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

      <Card className="rounded-3xl bg-gradient-to-br from-background/70 to-background/30 shadow-none">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl">My Offers</CardTitle>
            <CardDescription>Review every offer you currently publish to takers.</CardDescription>
          </div>
          <Button type="button" className="rounded-full px-6" onClick={() => setHash("offer")}>
            Create Offer
          </Button>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={createOfferColumns()}
            data={myOffers}
            title="Published offers"
            emptyMessage="You have not published any offers yet."
            isLoading={isMakerLoading}
            onRowClick={offer => setHash(`offer/${(offer as OfferRow).id}`)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
