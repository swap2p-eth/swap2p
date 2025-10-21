import Jazzicon from "react-jazzicon";
import type { ColumnDef } from "@tanstack/react-table";
import type { OfferRow } from "@/lib/mock-offers";
import { RelativeTime } from "@/components/relative-time";
import { formatAddressShort, seedFromAddress } from "@/lib/utils";
import { DealSideBadge } from "@/components/deals/deal-side-badge";
import { PriceCell } from "@/components/deals/price-cell";
import { TokenSymbol } from "@/components/deals/token-symbol";
import { FiatSymbol } from "@/components/deals/fiat-symbol";

interface OfferColumnOptions {
  showMerchant?: boolean;
}

export function createOfferColumns(
  onStartDeal?: (offer: OfferRow) => void,
  options: OfferColumnOptions = {}
): ColumnDef<OfferRow>[] {
  const { showMerchant = false } = options;

  const columns: ColumnDef<OfferRow>[] = [
    {
      accessorKey: "id",
      header: "ID",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">#{row.getValue("id")}</span>
      ),
      size: 60
    },
    ...(showMerchant
      ? ([
          {
            accessorKey: "maker",
            header: "Merchant",
            cell: ({ row }) => {
              const maker = row.getValue<string>("maker");
              return (
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Jazzicon diameter={20} seed={seedFromAddress(maker)} />
                  {formatAddressShort(maker)}
                </span>
              );
            },
            size: 160
          }
        ] as ColumnDef<OfferRow>[]) : []),
    {
      accessorKey: "side",
      header: "Side",
      cell: ({ row }) => {
        const side = row.getValue<string>("side");
        return <DealSideBadge side={side} />;
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
        return <TokenSymbol symbol={token} />;
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
        return <FiatSymbol code={fiat} />;
      },
      size: 80,
      meta: {
        headerClassName: "text-center"
      }
    },
    {
      accessorKey: "price",
      header: "Price",
      cell: ({ row }) => {
        const fiat = (row.original as OfferRow).fiat;
        const price = Number(row.getValue("price"));
        return <PriceCell price={price} fiat={fiat} fractionDigits={{ min: 2, max: 3 }} />;
      },
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

  return columns;
}
