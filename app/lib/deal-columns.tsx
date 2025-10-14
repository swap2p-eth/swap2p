import { ArrowUpDown, MessageCircle } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DealRow } from "@/lib/mock-data";

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
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="px-0 text-muted-foreground"
      >
        Amount
        <ArrowUpDown className="ml-1 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="font-medium">
        {Number(row.getValue("amount")).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })}{" "}
        {(row.original as DealRow).token}
      </span>
    )
  },
  {
    accessorKey: "fiatCode",
    header: "Fiat",
    cell: ({ row }) => <span className="text-sm">{row.getValue("fiatCode")}</span>
  },
  {
    accessorKey: "state",
    header: "State",
    cell: ({ row }) => {
      const state = row.getValue<string>("state");
      const variants: Record<string, "default" | "secondary" | "outline"> = {
        REQUESTED: "outline",
        ACCEPTED: "secondary",
        PAID: "default"
      };
      return <Badge variant={variants[state] ?? "outline"}>{state}</Badge>;
    }
  },
  {
    accessorKey: "partner",
    header: "Affiliate",
    cell: ({ row }) => {
      const partner = row.getValue<string | null>("partner");
      if (!partner) return <span className="text-muted-foreground">—</span>;
      return <span className="font-mono text-xs">{partner}</span>;
    }
  },
  {
    accessorKey: "updatedLabel",
    header: "Updated",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">{row.getValue("updatedLabel")}</span>
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
