// src/components/common/data-table.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getRowModel,
  getExpandedRowModel,
  useReactTable,
  RowSelectionState,
  ColumnOrderState,
} from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Download, MoreHorizontal } from "lucide-react";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";

type Action = {
  label: string;
  icon?: React.ReactNode;
  onClick: (rows: any[]) => void;
};

export type DataTableProps<TData> = {
  columns: ColumnDef<TData, any>[];
  data: TData[];
  total?: number; // for server-side total rows
  page?: number;
  setPage?: (p: number) => void;
  pageSize?: number;
  setPageSize?: (n: number) => void;
  loading?: boolean;
  serverSide?: boolean; // if true, table will not manage paging locally
  rowActions?: (row: TData) => React.ReactNode;
  bulkActions?: Action[];
  dense?: boolean;
  initialColumnOrder?: string[];
};

function exportCSV(rows: any[], filename = "export.csv") {
  if (!rows || rows.length === 0) {
    const blob = new Blob([""], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, filename);
    return;
  }
  const keys = Object.keys(rows[0]);
  const csv = [
    keys.join(","),
    ...rows.map((r) =>
      keys
        .map((k) => {
          const v = r[k] ?? "";
          // escape quotes
          return `"${String(v).replace(/"/g, '""')}"`;
        })
        .join(",")
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  saveAs(blob, filename);
}

async function exportXLSX(rows: any[], filename = "export.xlsx") {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/octet-stream" });
  saveAs(blob, filename);
}

export function DataTable<TData>({
  columns,
  data,
  total,
  page = 1,
  setPage,
  pageSize = 20,
  setPageSize,
  loading = false,
  serverSide = false,
  rowActions,
  bulkActions = [],
  dense = true,
  initialColumnOrder,
}: DataTableProps<TData>) {
  // state: selection, column order, column visibility
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(
    (initialColumnOrder as string[]) || []
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      rowSelection,
      columnOrder,
    },
    onRowSelectionChange: setRowSelection,
    onColumnOrderChange: setColumnOrder,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    manualPagination: !!serverSide,
    pageCount: serverSide && total ? Math.ceil(total / pageSize) : undefined,
    autoResetPageIndex: false,
  });

  // derive selected rows
  const selectedRows = useMemo(() => {
    const sel = Object.keys(rowSelection)
      .filter((k) => rowSelection[k])
      .map((id) => table.getRow(id).original);
    return sel;
  }, [rowSelection, table]);

  const allColumns = table.getAllLeafColumns();

  // Top toolbar actions
  const handleExportCSV = () => {
    const rows = table.getRowModel().rows.map((r) => r.original);
    exportCSV(rows, `export-${Date.now()}.csv`);
  };
  const handleExportXlsx = () => {
    const rows = table.getRowModel().rows.map((r) => r.original);
    exportXLSX(rows as any, `export-${Date.now()}.xlsx`);
  };

  // Bulk actions runner
  const runBulk = async (action: Action) => {
    action.onClick(selectedRows);
    setRowSelection({});
  };

  // UI density classes
  const rowPadding = dense ? "py-2 px-3 text-sm" : "py-3 px-4";

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={table.getIsAllPageRowsSelected()}
              onCheckedChange={(v) => {
                table.toggleAllPageRowsSelected(!!v);
              }}
            />
            <div className="text-sm">
              {Object.keys(rowSelection).length} selected
            </div>

            {bulkActions.length > 0 && (
              <div className="flex gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      Bulk actions
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {bulkActions.map((a) => (
                      <DropdownMenuItem
                        key={String(a.label)}
                        onSelect={() => runBulk(a)}
                      >
                        {a.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Input
            placeholder="Global search"
            className="w-56"
            onChange={(e) => {
              table.setGlobalFilter(e.target.value);
            }}
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={handleExportCSV}>
                Export CSV
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleExportXlsx}>
                Export Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* column visibility */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {allColumns.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={col.getIsVisible()}
                  onCheckedChange={(v) => col.toggleVisibility(!!v)}
                >
                  {col.id}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Table */}
      <div className="rounded border dark:border-gray-700 overflow-auto">
        <table className="w-full table-fixed border-collapse">
          <thead className="bg-gray-100 dark:bg-gray-800">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className={`text-left ${rowPadding} font-medium text-xs text-gray-600 dark:text-gray-300`}
                  >
                    {h.isPlaceholder ? null : (
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          {flexRender(
                            h.column.columnDef.header,
                            h.getContext()
                          )}
                        </div>
                        {/* quick sort indicator */}
                        <div className="flex items-center gap-1">
                          {h.column.getCanSort() ? (
                            <button
                              onClick={() =>
                                h.column.toggleSorting(
                                  h.column.getIsSorted() === "asc"
                                )
                              }
                              className="text-gray-400 hover:text-gray-600"
                              aria-label="Sort"
                            >
                              {h.column.getIsSorted()
                                ? h.column.getIsSorted() === "asc"
                                  ? "▲"
                                  : "▼"
                                : "↕"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  className={`${rowPadding} text-center text-sm text-gray-500`}
                  colSpan={columns.length + 1}
                >
                  No records
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className={`${rowPadding} align-top`}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer / Pagination */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          {serverSide
            ? `Page ${page} of ${total ? Math.ceil(total / pageSize) : "?"}`
            : `Rows ${
                table.getState().pagination.pageIndex * pageSize + 1
              } - ${Math.min(
                data.length,
                (table.getState().pagination.pageIndex + 1) * pageSize
              )}`}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (serverSide && setPage) setPage(Math.max(1, page - 1));
              else table.previousPage();
            }}
            disabled={serverSide ? page <= 1 : !table.getCanPreviousPage()}
          >
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (serverSide && setPage) setPage(page + 1);
              else table.nextPage();
            }}
            disabled={
              serverSide
                ? total
                  ? page * pageSize >= total
                  : false
                : !table.getCanNextPage()
            }
          >
            Next
          </Button>

          <select
            className="border rounded px-2 py-1 text-sm"
            value={pageSize}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (setPageSize) setPageSize(n);
            }}
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}/page
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
