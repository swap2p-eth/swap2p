"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Wallet, ShieldCheck, Sparkles } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { DateRangePicker, type DateRange } from "@/components/date-range-picker";
import { ChatWidget } from "@/components/chat/chat-widget";
import { dealColumns } from "@/lib/deal-columns";
import type { DealRow } from "@/lib/mock-data";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";

function fetchDeals(initial: DealRow[]): Promise<DealRow[]> {
  return new Promise(resolve => {
    setTimeout(() => resolve(initial), 200);
  });
}

function StatCard({
  title,
  value,
  icon: Icon,
  hint
}: {
  title: string;
  value: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  hint: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

export function Dashboard({ deals }: { deals: DealRow[] }) {
  const initialRange: DateRange = React.useMemo(
    () => ({
      from: deals[deals.length - 1]?.updatedAt ?? new Date(),
      to: deals[0]?.updatedAt ?? new Date()
    }),
    [deals]
  );
  const [dateRange, setDateRange] = React.useState<DateRange>(initialRange);
  const [search, setSearch] = React.useState("");

  const { data: latestDeals = [], isFetching } = useQuery({
    queryKey: ["deals"],
    queryFn: () => fetchDeals(deals),
    initialData: deals,
    staleTime: 1000 * 60
  });

  const filteredDeals = React.useMemo(() => {
    return latestDeals.filter(deal => {
      const matchesSearch =
        search.length === 0 ||
        deal.id.toString().includes(search) ||
        deal.partner?.toLowerCase().includes(search.toLowerCase()) ||
        deal.side.toLowerCase().includes(search.toLowerCase());

      const withinRange =
        (!dateRange.from || deal.updatedAt >= dateRange.from) &&
        (!dateRange.to || deal.updatedAt <= dateRange.to);

      return matchesSearch && withinRange;
    });
  }, [latestDeals, search, dateRange]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 pb-16">
      <section className="flex flex-col gap-6 rounded-3xl bg-gradient-to-br from-background/60 via-background/40 to-background/10 px-4 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2">
            <Badge variant="outline" className="w-fit rounded-full px-3 py-1 text-[0.65rem] uppercase tracking-[0.2em]">
              swap2p console
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Manage P2P trades without distractions
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              A minimal surface for offers, chat, and analytics. All incentives live in the smart contracts — the UI simply gives them shape.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
            <ThemeToggle />
            <Button variant="ghost" className="rounded-full px-4">
              Sync contracts
            </Button>
            <Button className="rounded-full px-5">New offer</Button>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            title="TVL in escrow"
            value="184,320 TOKEN"
            hint="Updated less than a minute ago"
            icon={ShieldCheck}
          />
          <StatCard
            title="Active deals"
            value={String(latestDeals.length)}
            hint={isFetching ? "Syncing…" : "All deals are up to date"}
            icon={Wallet}
          />
          <StatCard
            title="Chat threads"
            value="12"
            hint="Last reply · 3 min ago"
            icon={Sparkles}
          />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <Card className="order-1 xl:order-none">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="text-xl">Deals</CardTitle>
              <CardDescription>
                Streaming Swap2p events and filtering them directly in the client.
              </CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <Input
                  placeholder="Search by id, partner or side…"
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  className="rounded-full bg-background/70 sm:w-60"
                />
              <Badge variant="outline" className="justify-center rounded-full px-3 py-1 text-xs">
                {filteredDeals.length} / {latestDeals.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <DataTable columns={dealColumns} data={filteredDeals} />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <ChatWidget className="min-h-[420px]" />
        </div>
      </section>
    </div>
  );
}
