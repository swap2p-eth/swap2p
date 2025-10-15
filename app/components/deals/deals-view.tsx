"use client";

import * as React from "react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { dealColumns } from "@/lib/deal-columns";
import { useDeals } from "./deals-provider";

interface DealsViewProps {
  onSelectDeal?: (dealId: number) => void;
}

export function DealsView({ onSelectDeal }: DealsViewProps) {
  const [status, setStatus] = React.useState("active");
  const { deals } = useDeals();

  const filteredDeals = React.useMemo(() => {
    if (status === "closed") {
      return deals.filter(deal => deal.state !== "REQUESTED");
    }
    return deals;
  }, [deals, status]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-8">
      <section className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Deals</h1>
        <p className="text-sm text-muted-foreground">
          Monitor the lifecycle of executions between makers and takers. Review collateral, fees, and chat in one place.
        </p>
      </section>

      <Card className="rounded-3xl bg-gradient-to-br from-background/70 to-background/30">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl">Overview</CardTitle>
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
            onRowClick={deal => {
              const id = (deal as { id: number }).id;
              onSelectDeal?.(id);
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
