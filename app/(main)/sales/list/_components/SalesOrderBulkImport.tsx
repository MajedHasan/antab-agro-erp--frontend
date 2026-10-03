"use client";

import React, { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import {
  confirmSalesOrderImport,
  downloadSalesOrderImportTemplate,
  getSalesOrderImportError,
  previewSalesOrderImport,
  type ResolvedSalesOrderImportRow,
  type SalesOrderImportGroup,
  type SalesOrderImportPreview,
} from "@/lib/sales-order-import";

/* =====================================================
   HELPERS
===================================================== */

const ACCEPTED_EXTENSIONS = [".xlsx", ".xls"];

function formatMoney(value: number | undefined | null) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatNumber(value: number | undefined | null) {
  return Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

function getFileExtension(fileName: string) {
  const index = fileName.lastIndexOf(".");

  if (index === -1) return "";

  return fileName.slice(index).toLowerCase();
}

function isExcelFile(file: File) {
  return ACCEPTED_EXTENSIONS.includes(getFileExtension(file.name));
}

/* =====================================================
   PREVIEW RESPONSE NORMALIZATION
===================================================== */

/**
 * The backend preview response should contain:
 *
 * {
 *   totalRows,
 *   validRows,
 *   invalidRows,
 *   totalOrders,
 *   validOrders,
 *   invalidOrders,
 *   totalQty,
 *   totalBonusQty,
 *   subtotal,
 *   discountAmount,
 *   taxableAmount,
 *   taxAmount,
 *   grandTotal,
 *   rows,
 *   groups,
 *   errors
 * }
 *
 * Normalize the response here so the UI never crashes if
 * an optional/missing array is returned by the backend.
 */
function normalizePreview(
  result: Partial<SalesOrderImportPreview> | null | undefined,
): SalesOrderImportPreview {
  const rows = Array.isArray(result?.rows) ? result.rows : [];

  const groups = Array.isArray(result?.groups)
    ? result.groups.map((group) => ({
        ...group,
        items: Array.isArray(group.items) ? group.items : [],
        errors: Array.isArray(group.errors) ? group.errors : [],
      }))
    : [];

  const errors = Array.isArray(result?.errors)
    ? result.errors
    : [];

  return {
    totalRows: Number(result?.totalRows || 0),
    validRows: Number(result?.validRows || 0),
    invalidRows: Number(result?.invalidRows || 0),
    totalOrders: Number(result?.totalOrders || groups.length),
    validOrders: Number(result?.validOrders || 0),
    invalidOrders: Number(result?.invalidOrders || 0),
    totalQty: Number(result?.totalQty || 0),
    totalBonusQty: Number(result?.totalBonusQty || 0),
    subtotal: Number(result?.subtotal || 0),
    discountAmount: Number(result?.discountAmount || 0),
    taxableAmount: Number(result?.taxableAmount || 0),
    taxAmount: Number(result?.taxAmount || 0),
    grandTotal: Number(result?.grandTotal || 0),
    rows: rows.map((row) => ({
      ...row,
      errors: Array.isArray(row.errors) ? row.errors : [],
    })),
    groups: groups as SalesOrderImportGroup[],
    errors,
  };
}

/* =====================================================
   SUMMARY CARD
===================================================== */

function SummaryCard({
  label,
  value,
  danger,
}: {
  label: string;
  value: string | number;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        danger
          ? "border-red-200 bg-red-50"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>

      <div
        className={`mt-1 text-2xl font-semibold ${
          danger ? "text-red-600" : "text-slate-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

/* =====================================================
   ROW STATUS
===================================================== */

function RowStatus({
  row,
}: {
  row: ResolvedSalesOrderImportRow;
}) {
  if (row.errors.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
        <Check className="h-3.5 w-3.5" />
        Valid
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
      <AlertCircle className="h-3.5 w-3.5" />
      Invalid
    </span>
  );
}

/* =====================================================
   GROUP CARD
===================================================== */

function ImportOrderCard({
  group,
}: {
  group: SalesOrderImportGroup;
}) {
  const items = Array.isArray(group.items)
    ? group.items
    : [];

  const errors = Array.isArray(group.errors)
    ? group.errors
    : [];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b bg-slate-50 px-4 py-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-semibold text-slate-900">
              {group.importReference}
            </div>

            <div className="mt-1 text-xs text-muted-foreground">
              Dealer: {group.dealerCode}
              {group.dealerName ? ` · ${group.dealerName}` : ""}
              {" · "}
              Warehouse: {group.warehouseCode}
              {group.warehouseName
                ? ` · ${group.warehouseName}`
                : ""}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border bg-white px-2.5 py-1">
              {group.paymentMethod}
            </span>

            <span className="rounded-full border bg-white px-2.5 py-1">
              {items.length} item
              {items.length !== 1 ? "s" : ""}
            </span>

            <span className="rounded-full border bg-white px-2.5 py-1 font-medium">
              {formatMoney(group.grandTotal)} BDT
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-white text-left">
            <tr>
              <th className="border-b px-4 py-3">SKU</th>
              <th className="border-b px-4 py-3">Product</th>
              <th className="border-b px-4 py-3 text-right">
                Qty
              </th>
              <th className="border-b px-4 py-3 text-right">
                Bonus
              </th>
              <th className="border-b px-4 py-3 text-right">
                Price
              </th>
              <th className="border-b px-4 py-3 text-right">
                Discount
              </th>
              <th className="border-b px-4 py-3 text-right">
                Tax
              </th>
              <th className="border-b px-4 py-3 text-right">
                Total
              </th>
            </tr>
          </thead>

          <tbody>
            {items.map((item, index) => (
              <tr
                key={`${item.productId}-${index}`}
                className="border-b last:border-0"
              >
                <td className="px-4 py-3 font-medium">
                  {item.productSku}
                </td>

                <td className="px-4 py-3">
                  {item.productName}
                </td>

                <td className="px-4 py-3 text-right">
                  {formatNumber(item.qty)}
                </td>

                <td className="px-4 py-3 text-right">
                  {formatNumber(item.bonusQty)}
                </td>

                <td className="px-4 py-3 text-right">
                  {formatMoney(item.unitPrice)}
                </td>

                <td className="px-4 py-3 text-right">
                  {formatMoney(item.discountAmount)}
                  <div className="text-xs text-muted-foreground">
                    {formatNumber(item.discountPercent)}%
                  </div>
                </td>

                <td className="px-4 py-3 text-right">
                  {formatMoney(item.taxAmount)}
                  <div className="text-xs text-muted-foreground">
                    {formatNumber(item.taxPercent)}%
                  </div>
                </td>

                <td className="px-4 py-3 text-right font-medium">
                  {formatMoney(item.total)} BDT
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {errors.length > 0 ? (
        <div className="border-t border-red-200 bg-red-50 px-4 py-3">
          <div className="mb-1 text-sm font-semibold text-red-800">
            Order errors
          </div>

          <ul className="space-y-1 text-xs text-red-700">
            {errors.map((error, index) => (
              <li key={`${error}-${index}`}>• {error}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/* =====================================================
   COMPONENT
===================================================== */

export default function SalesOrderBulkImport() {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [file, setFile] = useState<File | null>(null);

  const [preview, setPreview] =
    useState<SalesOrderImportPreview | null>(null);

  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);

  const [showRows, setShowRows] = useState(false);
  const [showOrders, setShowOrders] = useState(true);

  const [importFinished, setImportFinished] = useState(false);

  const [confirmResult, setConfirmResult] = useState<{
    total: number;
    successful: number;
    failed: number;
    results: Array<{
      importReference: string;
      success: boolean;
      orderId?: string;
      orderNo?: string;
      error?: string;
    }>;
  } | null>(null);

  /* ===================================================
     DERIVED STATE
  =================================================== */

  const canImport = useMemo(() => {
    if (!preview) return false;

    return (
      Array.isArray(preview.groups) &&
      preview.groups.length > 0 &&
      Array.isArray(preview.errors) &&
      preview.errors.length === 0 &&
      preview.invalidRows === 0 &&
      preview.invalidOrders === 0
    );
  }, [preview]);

  const invalidRows = useMemo(() => {
    if (!preview || !Array.isArray(preview.rows)) {
      return [];
    }

    return preview.rows.filter(
      (row) =>
        Array.isArray(row.errors) && row.errors.length > 0,
    );
  }, [preview]);

  /* ===================================================
     FILE HANDLING
  =================================================== */

  const resetImport = () => {
    setFile(null);
    setPreview(null);
    setConfirmResult(null);
    setImportFinished(false);
    setShowRows(false);
    setShowOrders(true);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const selectFile = (selectedFile: File | null) => {
    if (!selectedFile) return;

    if (!isExcelFile(selectedFile)) {
      toast.error("Please select an Excel file (.xlsx or .xls).");
      return;
    }

    setFile(selectedFile);
    setPreview(null);
    setConfirmResult(null);
    setImportFinished(false);
  };

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFile =
      event.target.files?.[0] || null;

    selectFile(selectedFile);
  };

  const handleDrop = (
    event: React.DragEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();

    const droppedFile =
      event.dataTransfer.files?.[0] || null;

    selectFile(droppedFile);
  };

  /* ===================================================
     TEMPLATE
  =================================================== */

  const handleDownloadTemplate = async () => {
    setTemplateLoading(true);

    try {
      const blob =
        await downloadSalesOrderImportTemplate();

      const url =
        window.URL.createObjectURL(blob);

      const anchor =
        document.createElement("a");

      anchor.href = url;
      anchor.download =
        "sales-order-import-template.xlsx";

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      window.URL.revokeObjectURL(url);

      toast.success("Excel template downloaded.");
    } catch (error) {
      console.error(error);

      toast.error(getSalesOrderImportError(error));
    } finally {
      setTemplateLoading(false);
    }
  };

  /* ===================================================
     PREVIEW
  =================================================== */

  const handlePreview = async () => {
    if (!file) {
      toast.error("Please select an Excel file first.");
      return;
    }

    setPreviewLoading(true);
    setPreview(null);
    setConfirmResult(null);
    setImportFinished(false);

    try {
      const rawResult =
        await previewSalesOrderImport(file);

      /*
       * Normalize the backend response BEFORE storing it.
       * This prevents errors such as:
       *
       * result.errors.length
       * preview.groups.length
       *
       * when those fields are missing from the response.
       */
      const result = normalizePreview(rawResult);

      console.log(
        "Sales order import preview response:",
        rawResult,
      );

      console.log(
        "Sales order import normalized preview:",
        result,
      );

      setPreview(result);

      if (
        result.errors.length > 0 ||
        result.invalidRows > 0
      ) {
        toast.error(
          `Import preview found ${
            result.errors.length
          } error${
            result.errors.length === 1 ? "" : "s"
          }.`,
        );
      } else {
        toast.success(
          `Preview ready: ${
            result.totalOrders
          } sales order${
            result.totalOrders === 1 ? "" : "s"
          }.`,
        );
      }
    } catch (error) {
      console.error(error);

      toast.error(getSalesOrderImportError(error));
    } finally {
      setPreviewLoading(false);
    }
  };

  /* ===================================================
     CONFIRM
  =================================================== */

  const handleConfirm = async () => {
    if (!file) {
      toast.error("Please select an Excel file first.");
      return;
    }

    if (!preview) {
      toast.error(
        "Please preview the Excel file before importing.",
      );
      return;
    }

    if (!canImport) {
      toast.error(
        "The file contains validation errors. Fix them before importing.",
      );
      return;
    }

    const confirmed = window.confirm(
      `Create ${
        preview.totalOrders
      } sales order${
        preview.totalOrders === 1 ? "" : "s"
      } from this Excel file?\n\n` +
        "The system will revalidate the file before creating the orders.",
    );

    if (!confirmed) return;

    setConfirmLoading(true);
    setConfirmResult(null);
    setImportFinished(false);

    try {
      const result =
        await confirmSalesOrderImport(file);

      setConfirmResult({
        total: Number(result?.total || 0),
        successful: Number(
          result?.successful || 0,
        ),
        failed: Number(result?.failed || 0),
        results: Array.isArray(result?.results)
          ? result.results
          : [],
      });

      setImportFinished(true);

      const failed = Number(result?.failed || 0);
      const successful = Number(
        result?.successful || 0,
      );

      if (failed === 0) {
        toast.success(
          `${successful} sales order${
            successful === 1 ? "" : "s"
          } imported successfully.`,
        );
      } else if (successful > 0) {
        toast.warning(
          `${successful} imported successfully and ${failed} failed.`,
        );
      } else {
        toast.error(
          "No sales orders were imported.",
        );
      }
    } catch (error) {
      console.error(error);

      /*
       * The backend can return HTTP 207 for partial
       * success. Axios normally treats 207 as a
       * successful response, so this catch is primarily
       * for complete request failures.
       */

      toast.error(
        getSalesOrderImportError(error),
      );
    } finally {
      setConfirmLoading(false);
    }
  };

  /* ===================================================
     RENDER
  =================================================== */

  return (
    <div className="space-y-6">
      {/* =================================================
          HEADER
      ================================================= */}

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Bulk Sales Order Import
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Upload an Excel file, validate every row,
            review the generated orders, then import them.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() =>
            void handleDownloadTemplate()
          }
          disabled={templateLoading}
        >
          {templateLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}

          Excel template
        </Button>
      </div>

      {/* =================================================
          UPLOAD
      ================================================= */}

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">
            1. Upload Excel file
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div
            onDragOver={(event) =>
              event.preventDefault()
            }
            onDrop={handleDrop}
            className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center transition hover:border-slate-400 hover:bg-slate-100"
          >
            <div className="mx-auto flex max-w-xl flex-col items-center">
              <div className="mb-4 rounded-full bg-white p-4 shadow-sm">
                <FileSpreadsheet className="h-8 w-8 text-slate-600" />
              </div>

              <div className="text-base font-medium text-slate-900">
                Drop your Excel file here
              </div>

              <div className="mt-1 text-sm text-muted-foreground">
                or choose a file from your computer
              </div>

              <Input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={handleFileChange}
                className="mt-5 h-auto max-w-md cursor-pointer bg-white"
              />

              <div className="mt-3 text-xs text-muted-foreground">
                Accepted: .xlsx and .xls · Maximum file
                size: 10 MB
              </div>
            </div>
          </div>

          {file ? (
            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="rounded-lg bg-slate-100 p-2">
                  <FileSpreadsheet className="h-5 w-5 text-slate-600" />
                </div>

                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-900">
                    {file.name}
                  </div>

                  <div className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(
                      2,
                    )}{" "}
                    MB
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetImport}
                  disabled={
                    previewLoading ||
                    confirmLoading
                  }
                >
                  <X className="mr-2 h-4 w-4" />
                  Remove
                </Button>

                <Button
                  type="button"
                  onClick={() =>
                    void handlePreview()
                  }
                  disabled={
                    previewLoading ||
                    confirmLoading
                  }
                >
                  {previewLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}

                  {previewLoading
                    ? "Validating..."
                    : "Preview"}
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* =================================================
          PREVIEW SUMMARY
      ================================================= */}

      {preview ? (
        <>
          <div>
            <div className="mb-3">
              <h3 className="text-base font-semibold text-slate-900">
                2. Preview
              </h3>

              <p className="text-sm text-muted-foreground">
                Nothing has been created yet. Review the
                validation result before confirming the
                import.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
              <SummaryCard
                label="Excel Rows"
                value={preview.totalRows}
              />

              <SummaryCard
                label="Valid Rows"
                value={preview.validRows}
              />

              <SummaryCard
                label="Invalid Rows"
                value={preview.invalidRows}
                danger={preview.invalidRows > 0}
              />

              <SummaryCard
                label="Orders"
                value={preview.totalOrders}
              />

              <SummaryCard
                label="Valid Orders"
                value={preview.validOrders}
              />

              <SummaryCard
                label="Invalid Orders"
                value={preview.invalidOrders}
                danger={
                  preview.invalidOrders > 0
                }
              />

              <SummaryCard
                label="Qty"
                value={formatNumber(
                  preview.totalQty,
                )}
              />

              <SummaryCard
                label="Grand Total"
                value={`${formatMoney(
                  preview.grandTotal,
                )} BDT`}
              />
            </div>
          </div>

          {/* =============================================
              GLOBAL ERRORS
          ============================================= */}

          {preview.errors.length > 0 ? (
            <Card className="border-red-200 bg-red-50 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-red-800">
                  <AlertCircle className="h-5 w-5" />
                  Import validation errors
                </CardTitle>
              </CardHeader>

              <CardContent>
                <ul className="space-y-2 text-sm text-red-700">
                  {preview.errors.map(
                    (error, index) => (
                      <li
                        key={`${error}-${index}`}
                        className="rounded-lg border border-red-200 bg-white/70 px-3 py-2"
                      >
                        {error}
                      </li>
                    ),
                  )}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {/* =============================================
              INVALID ROWS
          ============================================= */}

          {invalidRows.length > 0 ? (
            <Card className="border-red-200 shadow-sm">
              <CardHeader>
                <button
                  type="button"
                  className="flex w-full items-center justify-between text-left"
                  onClick={() =>
                    setShowRows(
                      (value) => !value,
                    )
                  }
                >
                  <div>
                    <CardTitle className="text-base text-red-700">
                      Invalid rows (
                      {invalidRows.length})
                    </CardTitle>

                    <p className="mt-1 text-sm text-muted-foreground">
                      These rows must be corrected
                      in the Excel file before
                      importing.
                    </p>
                  </div>

                  <span className="text-sm font-medium text-slate-600">
                    {showRows ? "Hide" : "Show"}
                  </span>
                </button>
              </CardHeader>

              {showRows ? (
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead className="bg-red-50 text-left">
                        <tr>
                          <th className="border-b px-4 py-3">
                            Row
                          </th>
                          <th className="border-b px-4 py-3">
                            Import Ref
                          </th>
                          <th className="border-b px-4 py-3">
                            Dealer
                          </th>
                          <th className="border-b px-4 py-3">
                            Warehouse
                          </th>
                          <th className="border-b px-4 py-3">
                            SKU
                          </th>
                          <th className="border-b px-4 py-3">
                            Status
                          </th>
                          <th className="border-b px-4 py-3">
                            Errors
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {invalidRows.map((row) => (
                          <tr
                            key={row.rowNumber}
                            className="border-b last:border-0"
                          >
                            <td className="px-4 py-3 font-medium">
                              {row.rowNumber}
                            </td>

                            <td className="px-4 py-3">
                              {row.importReference ||
                                "-"}
                            </td>

                            <td className="px-4 py-3">
                              {row.dealerCode || "-"}
                            </td>

                            <td className="px-4 py-3">
                              {row.warehouseCode ||
                                "-"}
                            </td>

                            <td className="px-4 py-3">
                              {row.productSku || "-"}
                            </td>

                            <td className="px-4 py-3">
                              <RowStatus row={row} />
                            </td>

                            <td className="px-4 py-3">
                              <ul className="space-y-1 text-xs text-red-700">
                                {row.errors.map(
                                  (
                                    error,
                                    index,
                                  ) => (
                                    <li
                                      key={`${error}-${index}`}
                                    >
                                      • {error}
                                    </li>
                                  ),
                                )}
                              </ul>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              ) : null}
            </Card>
          ) : null}

          {/* =============================================
              GENERATED ORDERS
          ============================================= */}

          {preview.groups.length > 0 ? (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <button
                  type="button"
                  className="flex w-full items-center justify-between text-left"
                  onClick={() =>
                    setShowOrders(
                      (value) => !value,
                    )
                  }
                >
                  <div>
                    <CardTitle className="text-base">
                      Generated sales orders (
                      {preview.groups.length})
                    </CardTitle>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Rows sharing the same Import
                      Reference are grouped into
                      one sales order.
                    </p>
                  </div>

                  <span className="text-sm font-medium text-slate-600">
                    {showOrders ? "Hide" : "Show"}
                  </span>
                </button>
              </CardHeader>

              {showOrders ? (
                <CardContent className="space-y-4">
                  {preview.groups.map(
                    (group) => (
                      <ImportOrderCard
                        key={
                          group.importReference
                        }
                        group={group}
                      />
                    ),
                  )}
                </CardContent>
              ) : null}
            </Card>
          ) : null}

          {/* =============================================
              TOTALS
          ============================================= */}

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">
                Import totals
              </CardTitle>
            </CardHeader>

            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div>
                  <div className="text-xs text-muted-foreground">
                    Subtotal
                  </div>

                  <div className="mt-1 font-semibold">
                    {formatMoney(
                      preview.subtotal,
                    )}{" "}
                    BDT
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">
                    Discount
                  </div>

                  <div className="mt-1 font-semibold">
                    {formatMoney(
                      preview.discountAmount,
                    )}{" "}
                    BDT
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">
                    Taxable
                  </div>

                  <div className="mt-1 font-semibold">
                    {formatMoney(
                      preview.taxableAmount,
                    )}{" "}
                    BDT
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">
                    Tax
                  </div>

                  <div className="mt-1 font-semibold">
                    {formatMoney(
                      preview.taxAmount,
                    )}{" "}
                    BDT
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">
                    Grand Total
                  </div>

                  <div className="mt-1 text-lg font-bold">
                    {formatMoney(
                      preview.grandTotal,
                    )}{" "}
                    BDT
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* =============================================
              CONFIRM
          ============================================= */}

          <Card
            className={
              canImport
                ? "border-emerald-200 bg-emerald-50 shadow-sm"
                : "border-amber-200 bg-amber-50 shadow-sm"
            }
          >
            <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                {canImport ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                )}

                <div>
                  <div
                    className={`font-semibold ${
                      canImport
                        ? "text-emerald-800"
                        : "text-amber-800"
                    }`}
                  >
                    {canImport
                      ? "Ready to import"
                      : "Import blocked"}
                  </div>

                  <div className="mt-1 text-sm text-muted-foreground">
                    {canImport
                      ? `This will create ${
                          preview.totalOrders
                        } sales order${
                          preview.totalOrders ===
                          1
                            ? ""
                            : "s"
                        }.`
                      : "Fix the validation errors in the Excel file and preview it again."}
                  </div>
                </div>
              </div>

              <Button
                type="button"
                onClick={() =>
                  void handleConfirm()
                }
                disabled={
                  !canImport ||
                  confirmLoading ||
                  previewLoading ||
                  importFinished
                }
                className="shrink-0"
              >
                {confirmLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}

                {confirmLoading
                  ? "Importing..."
                  : importFinished
                    ? "Import completed"
                    : "Confirm import"}
              </Button>
            </CardContent>
          </Card>
        </>
      ) : null}

      {/* =================================================
          IMPORT RESULT
      ================================================= */}

      {confirmResult ? (
        <Card
          className={
            confirmResult.failed === 0
              ? "border-emerald-200 shadow-sm"
              : "border-amber-200 shadow-sm"
          }
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {confirmResult.failed === 0 ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-600" />
              )}

              Import result
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryCard
                label="Total"
                value={confirmResult.total}
              />

              <SummaryCard
                label="Successful"
                value={
                  confirmResult.successful
                }
              />

              <SummaryCard
                label="Failed"
                value={confirmResult.failed}
                danger={
                  confirmResult.failed > 0
                }
              />
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="border-b px-4 py-3">
                      Import Reference
                    </th>
                    <th className="border-b px-4 py-3">
                      Status
                    </th>
                    <th className="border-b px-4 py-3">
                      Sales Order
                    </th>
                    <th className="border-b px-4 py-3">
                      Error
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {confirmResult.results.map(
                    (result, index) => (
                      <tr
                        key={`${result.importReference}-${index}`}
                        className="border-b last:border-0"
                      >
                        <td className="px-4 py-3 font-medium">
                          {
                            result.importReference
                          }
                        </td>

                        <td className="px-4 py-3">
                          {result.success ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                              <Check className="h-3.5 w-3.5" />
                              Created
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                              <X className="h-3.5 w-3.5" />
                              Failed
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          {result.orderNo ||
                            "-"}
                        </td>

                        <td className="px-4 py-3 text-red-600">
                          {result.error || "-"}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={resetImport}
              >
                Import another Excel file
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}