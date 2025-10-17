import Jazzicon from "react-jazzicon";
import { ShoppingBasket } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { OfferRow } from "@/lib/mock-offers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TokenIcon } from "@/components/token-icon";
import { FiatFlag } from "@/components/fiat-flag";
import { RelativeTime } from "@/components/relative-time";

function formatMakerAddress(address?: string) {
  if (!address) {
    return "????..????";
  }
  const normalized = address.replace(/^0x/i, "");
  if (normalized.length <= 8) {
    return normalized.toUpperCase();
  }
  const start = normalized.slice(0, 4).toUpperCase();
  const end = normalized.slice(-4).toUpperCase();
  return `${start}..${end}`;
}

function createSeedFromAddress(address?: string) {
  // Jazzicon expects a numeric seed; mock addresses can include non-hex characters.
  if (!address) return 0;
  let hash = 0;
  for (let index = 0; index < address.length; index += 1) {
    hash = (hash << 5) - hash + address.charCodeAt(index);
    hash |= 0;
  }
  return hash >>> 0;
}

export function createOfferColumns(onStartDeal?: (offer: OfferRow) => void): ColumnDef<OfferRow>[] {
  const columns: ColumnDef<OfferRow>[] = [
    {
      accessorKey: "id",
      header: "ID",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">#{row.getValue("id")}</span>
      ),
      size: 60
    },
    {
      accessorKey: "maker",
      header: "Maker",
      cell: ({ row }) => {
        const maker = row.getValue<string>("maker");
        return (
          <span className="flex items-center gap-2 text-sm font-medium">
            <Jazzicon diameter={20} seed={createSeedFromAddress(maker)} />
            {formatMakerAddress(maker)}
          </span>
        );
      },
      size: 140
    },
    {
      accessorKey: "side",
      header: "Side",
      cell: ({ row }) => {
        const side = row.getValue<string>("side");
        return <Badge variant={side === "BUY" ? "secondary" : "default"}>{side}</Badge>;
      },
      size: 80,
      meta: {
        align: "center",
        headerClassName: "text-center",
        cellClassName: "text-center"
      }
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
      size: 80,
      meta: {
        headerClassName: "text-center"
      }
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
      size: 80,
      meta: {
        headerClassName: "text-center"
      }
    },
    {
      accessorKey: "price",
      header: "Price",
      cell: ({ row }) => (
        <span className="block text-right text-sm font-medium text-foreground tabular-nums">
          {Number(row.getValue("price")).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 3
          })}
        </span>
      ),
      meta: {
        align: "right",
        headerClassName: "text-center",
        cellClassName: "text-right"
      }
    },
    {
      accessorKey: "minAmount",
      header: "Min",
      cell: ({ row }) => (
        <span className="block text-right text-sm text-muted-foreground tabular-nums">
          {Number(row.getValue("minAmount")).toLocaleString("en-US")}
        </span>
      ),
      meta: {
        align: "right",
        headerClassName: "text-center",
        cellClassName: "text-right"
      }
    },
    {
      accessorKey: "maxAmount",
      header: "Max",
      cell: ({ row }) => (
        <span className="block text-right text-sm text-muted-foreground tabular-nums">
          {Number(row.getValue("maxAmount")).toLocaleString("en-US")}
        </span>
      ),
      meta: {
        align: "right",
        headerClassName: "text-center",
        cellClassName: "text-right"
      }
    },
    {
      accessorKey: "paymentMethods",
      header: "Payment methods",
      cell: ({ row }) => (
        <span className="block text-center text-sm text-muted-foreground/80">
          {String(row.getValue("paymentMethods") ?? "")
            .split(",")
            .filter(Boolean)
            .join(" · ")}
        </span>
      ),
      meta: {
        align: "center",
        headerClassName: "text-center",
        cellClassName: "text-center"
      }
    },
    {
      accessorKey: "updatedAt",
      header: "Updated",
      cell: ({ row }) => (
        <RelativeTime
          value={row.getValue("updatedAt") as string | number}
          className="block text-right text-sm text-muted-foreground"
        />
      ),
      meta: {
        align: "right",
        headerClassName: "text-right",
        cellClassName: "text-right"
      }
    }
  ];

  if (onStartDeal) {
    columns.push({
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground"
          aria-label="Create deal"
          onClick={event => {
            event.stopPropagation();
            onStartDeal(row.original);
          }}
        >
          <ShoppingBasket className="h-4 w-4" />
        </Button>
      ),
      meta: {
        headerClassName: "text-center"
      }
    });
  }

  return columns;
}
