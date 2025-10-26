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
import { cn } from "@/lib/utils";

interface DealsViewProps {
  onSelectDeal?: (dealId: string) => void;
}

export function DealsView({ onSelectDeal }: DealsViewProps) {
  const [status, setStatus] = React.useState("active");
  const { activeDeals, closedDeals, isLoading: dealsLoading } = useCurrentUserDeals();
  const {
    makerOffers,
    isMakerLoading,
    makerProfile,
    makerProfileLoading,
    makerProfileUpdating,
    setMakerOnline
  } = useOffers();
  const { setHash } = useHashLocation("offers");
  const { address } = useUser();
  const { openConnectModal } = useConnectModal();
  const [availabilityError, setAvailabilityError] = React.useState<string | null>(null);

  const onlineStatus = makerProfile?.online ?? false;
  const toggleDisabled = makerProfileLoading || makerProfileUpdating;

  const handleAvailabilityChange = React.useCallback(
    async (next: boolean) => {
      if (toggleDisabled) return;
      if (onlineStatus === next) return;
      setAvailabilityError(null);
      try {
        await setMakerOnline(next);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update availability.";
        setAvailabilityError(message);
      }
    },
    [onlineStatus, setMakerOnline, toggleDisabled]
  );

  React.useEffect(() => {
    setAvailabilityError(null);
  }, [onlineStatus]);

  const normalizedAddress = React.useMemo(() => address.trim().toLowerCase(), [address]);

  const filteredDeals = React.useMemo(
    () => (status === "closed" ? closedDeals : activeDeals),
    [status, activeDeals, closedDeals]
  );

  const myOffers = React.useMemo(() => makerOffers, [makerOffers]);

  const availabilityMessage = makerProfileLoading
    ? "Checking availability…"
    : onlineStatus
      ? "Your offers are visible to clients. Switch to Offline when you are done."
      : "Your offers are hidden. Switch to Online to start trading.";

  const availabilityClass = makerProfileLoading
    ? "text-muted-foreground"
    : onlineStatus
      ? "text-emerald-500"
      : "text-red-500";

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
              const id = (deal as { id: string }).id;
              onSelectDeal?.(id);
            }}
          />
        </CardContent>
      </Card>

      <Card className="rounded-3xl bg-gradient-to-br from-background/70 to-background/30 shadow-none">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <CardTitle className="text-xl">My Offers</CardTitle>
            <p className={cn("text-sm", makerProfileLoading ? "animate-pulse text-muted-foreground" : availabilityClass)}>
              {availabilityMessage}
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-4">
            <SegmentedControl
              value={onlineStatus ? "online" : "offline"}
              onChange={value => handleAvailabilityChange(value === "online")}
              disabled={toggleDisabled}
              options={[
                {
                  label: "Offline",
                  value: "offline",
                  activeClassName: "bg-red-500 text-white shadow-[0_8px_20px_-12px_rgba(220,38,38,0.65)]",
                  inactiveClassName: "text-red-500 hover:bg-red-500/10"
                },
                {
                  label: "Online",
                  value: "online",
                  activeClassName: "bg-emerald-500 text-white shadow-[0_8px_20px_-12px_rgba(16,185,129,0.65)]",
                  inactiveClassName: "text-emerald-500 hover:bg-emerald-500/10"
                }
              ]}
            />
            <Button
              type="button"
              size="sm"
              className="rounded-full px-5 py-2 text-sm font-semibold"
              onClick={() => setHash("offer")}
            >
              Create Offer
            </Button>
            {availabilityError ? (
              <p className="text-xs text-red-500 sm:ml-auto sm:basis-full sm:text-right">{availabilityError}</p>
            ) : null}
          </div>
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
