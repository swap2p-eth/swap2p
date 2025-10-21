import { ArrowUpDown, Hourglass, TriangleAlert } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import type { DealRow, DealSide } from "@/lib/mock-data";
import { RelativeTime } from "@/components/relative-time";
import { mockTokenConfigs, mockFiatCurrencies, computeTokenPriceInFiat } from "@/lib/mock-market";
import { createMockRng } from "@/lib/mock-clock";
import { DealSideBadge } from "@/components/deals/deal-side-badge";
import { Badge } from "@/components/ui/badge";
import { TokenAmountCell } from "@/components/deals/token-amount-cell";
import { FiatAmountCell } from "@/components/deals/fiat-amount-cell";
import { getScenarioConfig, type DealProgressState } from "@/lib/deal-scenarios";
import { getDealPerspective, isActiveDealState } from "@/lib/deal-utils";
import { cn } from "@/lib/utils";

function getFiatAmount(deal: DealRow): number | null {
  const tokenConfig = mockTokenConfigs.find(config => config.symbol === deal.token);
  const fiatConfig = mockFiatCurrencies.find(config => config.code === deal.fiatCode);
  if (!tokenConfig || !fiatConfig) return null;
  const rng = createMockRng(`deal-table:${deal.id}`);
  const price = computeTokenPriceInFiat(tokenConfig, fiatConfig, rng());
  return price * deal.amount;
}

const getUserRole = (deal: DealRow, currentUser: string): "MAKER" | "TAKER" | null =>
  getDealPerspective(deal, currentUser).role;

const getUserSide = (deal: DealRow, currentUser: string): DealSide | null =>
  getDealPerspective(deal, currentUser).userSide;

const getScenarioForDeal = (deal: DealRow, currentUser: string) => {
  const perspective = getDealPerspective(deal, currentUser);
  if (!perspective.role) return null;
  return getScenarioConfig(perspective.role, deal.side, deal.state as DealProgressState);
};

interface DealColumnOptions {
  includeAction?: boolean;
}

export function createDealColumns(currentUser: string, options: DealColumnOptions = {}): ColumnDef<DealRow>[] {
  const { includeAction = false } = options;

  const columns: ColumnDef<DealRow>[] = [
    {
      accessorKey: "id",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="px-0 text-muted-foreground"
        >
          ID
          <ArrowUpDown className="ml-1 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">#{row.getValue("id")}</span>,
      size: 72
    },
    {
      id: "userRole",
      header: "You",
      cell: ({ row }) => {
        const role = getUserRole(row.original as DealRow, currentUser);
        if (role === "MAKER") return <span className="text-sm font-medium text-muted-foreground">Merchant</span>;
        if (role === "TAKER") return <span className="text-sm font-medium text-muted-foreground">Client</span>;
        return <span className="text-sm text-muted-foreground">—</span>;
      },
      size: 100
    },
    {
      accessorKey: "side",
      header: "Side",
      cell: ({ row }) => {
        const deal = row.original as DealRow;
        const userSide = getUserSide(deal, currentUser);
        if (!userSide) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        return <DealSideBadge side={userSide} />;
      },
      size: 80
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => (
        <TokenAmountCell
          token={(row.original as DealRow).token}
          amountLabel={Number(row.getValue("amount")).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}
          mutedToken
        />
      )
    },
    {
      accessorKey: "fiatCode",
      header: "Fiat",
      cell: ({ row }) => {
        const fiat = row.getValue<string>("fiatCode");
        const deal = row.original as DealRow;
        const fiatAmount = getFiatAmount(deal);
        if (fiatAmount) {
          return (
            <FiatAmountCell
              fiat={fiat}
              amountLabel={fiatAmount.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            />
          );
        }
        return <FiatAmountCell fiat={fiat} amountLabel="—" />;
      }
    },
    {
      accessorKey: "state",
      header: "State",
      cell: ({ row }) => {
        const state = row.getValue<string>("state");
        const variants: Record<string, "warning" | "info" | "purple" | "success" | "muted" | "outline"> = {
          REQUESTED: "warning",
          ACCEPTED: "info",
          PAID: "purple",
          RELEASED: "success",
          CANCELED: "muted"
        };
        return <Badge variant={variants[state] ?? "outline"}>{state}</Badge>;
      }
    },
    {
      accessorKey: "updatedAt",
      header: "Updated",
      cell: ({ row }) => (
        <RelativeTime value={row.getValue("updatedAt") as string | number} className="text-sm text-muted-foreground" />
      )
    }
  ];

  if (includeAction) {
    columns.push({
      id: "action",
      header: "Action",
      cell: ({ row }) => {
        const deal = row.original as DealRow;
        if (!isActiveDealState(deal.state)) {
          return <span className="text-sm text-muted-foreground">—</span>;
        }
        const scenario = getScenarioForDeal(deal, currentUser);
        if (!scenario) {
          return <span className="text-sm text-muted-foreground">—</span>;
        }
        const instructions = scenario.instructions;
        const tooltip = instructions.replace(/\. /g, ".\n");
        const hasPrimaryAction = Boolean(scenario.primaryAction);
        const Icon = hasPrimaryAction ? TriangleAlert : Hourglass;
        const colorClass = hasPrimaryAction ? "text-orange-500" : "text-muted-foreground/60";
        return (
          <span className="flex justify-center" title={tooltip} aria-label={instructions}>
            <Icon className={cn("h-4 w-4", colorClass)} aria-hidden="true" />
          </span>
        );
      },
      size: 80,
      meta: {
        align: "center",
        headerClassName: "text-center",
        cellClassName: "text-center"
      }
    });
  }

  return columns;
}
