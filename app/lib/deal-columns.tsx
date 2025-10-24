import type { ColumnDef } from "@tanstack/react-table";
import type { DealRow, DealSide } from "@/lib/types/market";
import { RelativeTime } from "@/components/relative-time";
import { DealSideBadge } from "@/components/deals/deal-side-badge";
import { Badge } from "@/components/ui/badge";
import { TokenAmountCell } from "@/components/deals/token-amount-cell";
import { FiatAmountCell } from "@/components/deals/fiat-amount-cell";
import { getScenarioConfig, type DealProgressState } from "@/lib/deal-scenarios";
import { getDealPerspective, isActiveDealState } from "@/lib/deal-utils";
import { formatFiatAmount, formatTokenAmount } from "@/lib/number-format";
import { DealInstructionIcon } from "@/components/deals/deal-instruction-icon";

const getUserRole = (deal: DealRow, currentUser: string): "MAKER" | "TAKER" | null =>
  getDealPerspective(deal, currentUser).role;

const getUserSide = (deal: DealRow, currentUser: string): DealSide | null =>
  getDealPerspective(deal, currentUser).userSide;

const getScenarioForDeal = (deal: DealRow, currentUser: string) => {
  const perspective = getDealPerspective(deal, currentUser);
  if (!perspective.role) return null;
  return getScenarioConfig(perspective.role, deal.side, deal.state as DealProgressState);
};

const resolveFiatAmount = (deal: DealRow): number | null => {
  if (typeof deal.fiatAmount === "number" && Number.isFinite(deal.fiatAmount)) {
    return deal.fiatAmount;
  }
  if (typeof deal.price === "number" && Number.isFinite(deal.price)) {
    return deal.price * deal.amount;
  }
  return null;
};

interface DealColumnOptions {
  includeAction?: boolean;
}

export function createDealColumns(currentUser: string, options: DealColumnOptions = {}): ColumnDef<DealRow>[] {
  const { includeAction = false } = options;

  const columns: ColumnDef<DealRow>[] = [
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
      cell: ({ row }) => {
        const deal = row.original as DealRow;
        const decimals = deal.tokenDecimals;
        const amountValue = Number(row.getValue("amount"));
        return (
          <TokenAmountCell
            token={deal.token}
            amountLabel={formatTokenAmount(amountValue, decimals)}
            mutedToken
          />
        );
      }
    },
    {
      accessorKey: "fiat",
      header: "Fiat",
      cell: ({ row }) => {
        const deal = row.original as DealRow;
        const fiatAmount = resolveFiatAmount(deal);
        const amountLabel = fiatAmount !== null ? formatFiatAmount(fiatAmount) : "—";
        return (
          <FiatAmountCell
            countryCode={deal.countryCode}
            label={deal.fiat}
            amountLabel={amountLabel}
          />
        );
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
      },
      meta: {
        align: "center"
      }
    },
    {
      accessorKey: "updatedAt",
      header: "Updated",
      cell: ({ row }) => (
        <RelativeTime
          value={row.getValue("updatedAt") as string | number}
          className="text-sm text-muted-foreground"
        />
      ),
      meta: {
        align: "right"
      }
    }
  ];

  if (includeAction) {
    columns.push({
      id: "action",
      header: "Action",
      cell: ({ row }) => {
        const deal = row.original as DealRow;
        if (!isActiveDealState(deal.state)) {
          return <span className="flex justify-center text-muted-foreground">—</span>;
        }
        const scenario = getScenarioForDeal(deal, currentUser);
        if (!scenario) {
          return <span className="flex justify-center text-muted-foreground">—</span>;
        }
        return (
          <span className="flex justify-center" title={scenario.instructions.replace(/\. /g, ".\n")} aria-label={scenario.instructions}>
            <DealInstructionIcon highlight={Boolean(scenario.primaryAction)} size="sm" />
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
