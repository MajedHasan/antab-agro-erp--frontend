"use client";

import * as React from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ArrowUpDown } from "lucide-react";

export interface Column<T> {
  key: string;
  title: string;
  render: (row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string | number;
  align?: "left" | "center" | "right";
}

export interface SmartTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  total?: number;
  page?: number;
  limit?: number;
  onPageChange?: (page: number) => void;
  onSortChange?: (key: string, direction: "asc" | "desc") => void;
  sortKey?: string;
  sortDirection?: "asc" | "desc";
  className?: string;
  stickyHeader?: boolean;
  emptyText?: string;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onSelectAll?: (checked: boolean) => void;
}

export function SmartTable<T>({
  columns,
  data,
  loading,
  total,
  page = 1,
  limit = 10,
  onPageChange,
  onSortChange,
  sortKey,
  sortDirection,
  className,
  stickyHeader,
  emptyText = "No records found",
  selectable = false,
  selectedIds,
  onToggleSelect,
  onSelectAll,
}: SmartTableProps<T>) {
  const totalPages = total ? Math.max(1, Math.ceil(total / limit)) : 1;

  const handleSort = (key: string) => {
    if (!onSortChange) return;
    const nextDirection =
      sortKey === key && sortDirection === "asc" ? "desc" : "asc";
    onSortChange(key, nextDirection);
  };

  const allSelected =
    selectable &&
    selectedIds &&
    data.length > 0 &&
    data.every((r: any) => selectedIds.has(r._id));

  return (
    <div className="w-full space-y-4">
      <div
        className={cn(
          "relative w-full overflow-x-auto border rounded-md",
          className
        )}
      >
        <Table>
          <TableHeader
            className={cn(stickyHeader && "sticky top-0 bg-background z-10")}
          >
            <TableRow>
              {selectable && (
                <TableHead>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => onSelectAll?.(e.target.checked)}
                  />
                </TableHead>
              )}
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn(
                    col.align === "center"
                      ? "text-center"
                      : col.align === "right"
                      ? "text-right"
                      : "text-left",
                    col.width ? `w-[${col.width}]` : ""
                  )}
                >
                  {col.sortable && onSortChange ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort(col.key)}
                      className="flex items-center gap-1"
                    >
                      {col.title}
                      <ArrowUpDown
                        className={cn(
                          "w-4 h-4 transition-transform",
                          sortKey === col.key
                            ? sortDirection === "asc"
                              ? "rotate-180 text-primary"
                              : "text-primary"
                            : "text-muted-foreground"
                        )}
                      />
                    </Button>
                  ) : (
                    col.title
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={(selectable ? 1 : 0) + columns.length}
                  className="text-center"
                >
                  Loading...
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={(selectable ? 1 : 0) + columns.length}
                  className="text-center"
                >
                  {emptyText}
                </TableCell>
              </TableRow>
            ) : (
              data.map((row: any, i: number) => (
                <TableRow key={row._id ?? i}>
                  {selectable && (
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedIds?.has(row._id)}
                        onChange={() => onToggleSelect?.(row._id)}
                      />
                    </TableCell>
                  )}
                  {columns.map((col) => (
                    <TableCell
                      key={col.key}
                      className={cn(
                        col.align === "center"
                          ? "text-center"
                          : col.align === "right"
                          ? "text-right"
                          : "text-left"
                      )}
                    >
                      {col.render(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {onPageChange && total && total > limit && (
        <div className="flex items-center justify-between text-sm">
          <div className="text-muted-foreground">
            Showing {(page - 1) * limit + 1} – {Math.min(page * limit, total)}{" "}
            of {total}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Prev
            </Button>
            <span>
              Page {page} / {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
