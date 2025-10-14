import type { ColumnDef } from "@tanstack/react-table";
import type { OfferRow } from "@/lib/mock-offers";
import { Badge } from "@/components/ui/badge";

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
    cell: ({ row }) => <span className="text-sm font-medium">{row.getValue("token")}</span>,
    size: 80
  },
  {
    accessorKey: "fiat",
    header: "Fiat",
    cell: ({ row }) => <span className="text-sm">{row.getValue("fiat")}</span>,
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
