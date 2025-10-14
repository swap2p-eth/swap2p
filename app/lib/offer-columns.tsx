import type { ColumnDef } from "@tanstack/react-table";
import type { OfferRow } from "@/lib/mock-offers";
import { Badge } from "@/components/ui/badge";
import { TokenIcon } from "@/components/token-icon";
import { FiatFlag } from "@/components/fiat-flag";

export const offerColumns: ColumnDef<OfferRow>[] = [
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">#{row.getValue("id")}</span>
    ),
    size: 60
  },
  {
    accessorKey: "side",
    header: "Side",
    cell: ({ row }) => {
      const side = row.getValue<string>("side");
      return <Badge variant={side === "BUY" ? "secondary" : "default"}>{side}</Badge>;
    },
    size: 80
  },
  {
    accessorKey: "token",
    header: "Token",
    cell: ({ row }) => {
      const token = row.getValue<string>("token");
      return (
        <span className="flex items-center gap-2 text-sm font-medium">
          <TokenIcon symbol={token} size={20} />
          {token}
        </span>
      );
    },
    size: 80
  },
  {
    accessorKey: "fiat",
    header: "Fiat",
    cell: ({ row }) => {
      const fiat = row.getValue<string>("fiat");
      return (
        <span className="flex items-center gap-2 text-sm">
          <FiatFlag fiat={fiat} size={20} />
          {fiat}
        </span>
      );
    },
    size: 80
  },
  {
    accessorKey: "price",
    header: "Price",
    cell: ({ row }) => (
      <span className="text-sm font-medium text-foreground">
        {Number(row.getValue("price")).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 3
        })}
      </span>
    )
  },
  {
    accessorKey: "minAmount",
    header: "Min",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {Number(row.getValue("minAmount")).toLocaleString("en-US")}
      </span>
    )
  },
  {
    accessorKey: "maxAmount",
    header: "Max",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {Number(row.getValue("maxAmount")).toLocaleString("en-US")}
      </span>
    )
  },
  {
    accessorKey: "paymentMethods",
    header: "Payment methods",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground/80">{row.getValue("paymentMethods")}</span>
    )
  },
  {
    accessorKey: "updatedLabel",
    header: "Updated",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">{row.getValue("updatedLabel")}</span>
    )
  }
];
