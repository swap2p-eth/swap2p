"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  useReactTable
} from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const ROW_HEIGHT_BASE_PX = 56;
const ROW_HEIGHT_EXTRA_PX = 8; // for skeleton
const ROW_HEIGHT_WITH_CONTENT_PX = ROW_HEIGHT_BASE_PX + ROW_HEIGHT_EXTRA_PX;

type ColumnMeta = {
  align?: "left" | "center" | "right";
  headerClassName?: string;
  cellClassName?: string;
};

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  className?: string;
  title?: string;
  emptyMessage?: string;
  onRowClick?: (row: TData) => void;
  pageSize?: number;
  isLoading?: boolean;
  skeletonRowCount?: number;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  className,
  title = "Items",
  emptyMessage = "No data available.",
  onRowClick,
  pageSize = 10,
  isLoading = false,
  skeletonRowCount
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [page, setPage] = React.useState(1);

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));

  React.useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const paginatedData = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, page, pageSize]);

  const table = useReactTable({
    data: paginatedData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  const showingFrom = data.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, data.length);

  const pageButtons = React.useMemo(() => {
    const maxButtons = 5;
    if (totalPages <= maxButtons) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }
    const start = Math.max(1, Math.min(page - 2, totalPages - (maxButtons - 1)));
    return Array.from({ length: maxButtons }, (_, index) => start + index);
  }, [page, totalPages]);

  const renderSkeletonRows = () => {
    const rows = skeletonRowCount ?? pageSize;
    const columnCount = columns.length || 1;
    return Array.from({ length: rows }).map((_, rowIndex) => (
      <TableRow
        key={`skeleton-${rowIndex}`}
        style={{ height: ROW_HEIGHT_WITH_CONTENT_PX }}
        className="align-middle hover:bg-transparent"
      >
        {Array.from({ length: columnCount }).map((__, cellIndex) => (
          <TableCell key={cellIndex} className="py-3 align-middle">
            <Skeleton className="h-5 w-full rounded-full" />
          </TableCell>
        ))}
      </TableRow>
    ));
  };

  return (
    <div
      className={cn(
        "w-full rounded-3xl bg-card/60 shadow-none shadow-[inset_0_0_2px_rgba(15,23,42,0.12)] backdrop-blur",
        className
      )}
    >
      <div className="px-4 py-3 text-[0.7rem] font-medium uppercase tracking-[0.2em] text-muted-foreground/70">
        {title}
      </div>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map(headerGroup => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map(header => {
                const meta = header.column.columnDef.meta as ColumnMeta | undefined;
                const headerAlignClass =
                  meta?.headerClassName ??
                  (meta?.align === "right"
                    ? "text-right"
                    : meta?.align === "center"
                      ? "text-center"
                      : undefined);

                return (
                  <TableHead
                    key={header.id}
                    colSpan={header.colSpan}
                    className={cn(
                      header.column.getCanSort() ? "cursor-pointer select-none" : "",
                      "whitespace-nowrap",
                      headerAlignClass
                    )}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                    {{
                      asc: " ▲",
                      desc: " ▼"
                    }[header.column.getIsSorted() as string] ?? null}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading ? (
            renderSkeletonRows()
          ) : table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map(row => {
              const handleClick = () => {
                if (onRowClick) {
                  onRowClick(row.original);
                }
              };
              return (
                <TableRow
                  key={row.id}
                  style={{ minHeight: ROW_HEIGHT_BASE_PX }}
                  className={cn(
                    "border-transparent align-middle transition hover:bg-muted/20",
                    onRowClick ? "cursor-pointer" : ""
                  )}
                  onClick={handleClick}
                >
                  {row.getVisibleCells().map(cell => {
                    const meta = cell.column.columnDef.meta as ColumnMeta | undefined;
                    const alignClass =
                      meta?.align === "right"
                        ? "text-right"
                        : meta?.align === "center"
                          ? "text-center"
                          : undefined;

                    return (
                      <TableCell key={cell.id} className={cn("py-3 align-middle", alignClass, meta?.cellClassName)}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
      <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs text-muted-foreground">
          {isLoading ? "Loading…" : `Showing ${showingFrom}-${showingTo} of ${data.length}`}
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setPage(page - 1)}
            disabled={page === 1 || isLoading}
          >
            ←
          </Button>
          {pageButtons.map(pageNumber => (
            <Button
              key={pageNumber}
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "h-8 w-8 rounded-full text-xs hover:bg-muted/60 hover:text-foreground",
                pageNumber === page
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground font-normal"
              )}
              onClick={() => setPage(pageNumber)}
              disabled={isLoading}
            >
              {pageNumber}
            </Button>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages || isLoading}
          >
            →
          </Button>
        </div>
      </div>
    </div>
  );
}
