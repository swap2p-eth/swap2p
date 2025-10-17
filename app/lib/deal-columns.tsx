import { ArrowUpDown, MessageCircle } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DealRow } from "@/lib/mock-data";
import { TokenIcon } from "@/components/token-icon";
import { FiatFlag } from "@/components/fiat-flag";
import { RelativeTime } from "@/components/relative-time";
import { mockTokenConfigs, mockFiatCurrencies, computeTokenPriceInFiat } from "@/lib/mock-market";
import { createMockRng } from "@/lib/mock-clock";

function getFiatAmount(deal: DealRow): number | null {
  const tokenConfig = mockTokenConfigs.find(config => config.symbol === deal.token);
  const fiatConfig = mockFiatCurrencies.find(config => config.code === deal.fiatCode);
  if (!tokenConfig || !fiatConfig) return null;
  const rng = createMockRng(`deal-table:${deal.id}`);
  const price = computeTokenPriceInFiat(tokenConfig, fiatConfig, rng());
  return price * deal.amount;
}

export const dealColumns: ColumnDef<DealRow>[] = [
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
    cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">#{row.getValue("id")}</span>
  },
  {
    accessorKey: "side",
    header: "Side",
    cell: ({ row }) => {
      const side = row.getValue<string>("side");
      const variant = side === "BUY" ? "default" : "secondary";
      return <Badge variant={variant}>{side}</Badge>;
    }
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => (
      <span className="flex items-center gap-2 font-medium">
        <TokenIcon symbol={(row.original as DealRow).token} size={18} />
        {Number(row.getValue("amount")).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })}
        <span className="text-xs uppercase text-muted-foreground/80">
          {(row.original as DealRow).token}
        </span>
      </span>
    )
  },
  {
    accessorKey: "fiatCode",
    header: "Fiat",
    cell: ({ row }) => {
      const fiat = row.getValue<string>("fiatCode");
      const deal = row.original as DealRow;
      const fiatAmount = getFiatAmount(deal);
      return (
        <span className="flex items-center gap-2 text-sm font-medium">
          <FiatFlag fiat={fiat} size={18} />
          {fiatAmount ? (
            <span className="flex items-center gap-2">
              {fiatAmount.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
              <span className="text-xs uppercase text-muted-foreground/80">{fiat}</span>
            </span>
          ) : (
            fiat
          )}
        </span>
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
    }
  },
  {
    accessorKey: "updatedAt",
    header: "Updated",
    cell: ({ row }) => (
      <RelativeTime value={row.getValue("updatedAt") as string | number} className="text-sm text-muted-foreground" />
    )
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label="Open chat">
        <MessageCircle className="h-4 w-4" />
      </Button>
    )
  }
];
