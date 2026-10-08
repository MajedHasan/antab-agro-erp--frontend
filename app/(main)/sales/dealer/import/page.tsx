"use client";

import { useMemo, useRef, useState } from "react";

/* =========================================================
   TYPES
========================================================= */

type ReferenceValue = {
  id: string;
  name: string;
};

type ImportRowData = {
  rowNumber?: number;

  name?: string;
  proprietor?: string;

  zone?: ReferenceValue;
  region?: ReferenceValue;
  area?: ReferenceValue;
  territory?: ReferenceValue;

  type?: string;

  phoneNumber?: string;

  warehouse?: ReferenceValue;

  assignedSalesManager?: ReferenceValue;

  creditLimit?: number;
  openingBalance?: number;

  email?: string;
  address?: string;

  opDate?: string;
  opMonth?: string;

  lastPurchaseDate?: string;

  status?: string;
  notes?: string;
};

type ImportRow = {
  rowNumber: number;
  name: string;
  phoneNumber: string;
  valid: boolean;
  errors: string[];
  data?: ImportRowData;
};

type PreviewResponse = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: ImportRow[];
  resolvedRows: Record<string, unknown>[];
};

type ConfirmResponse = {
  totalRows: number;
  createdCount: number;
  failedCount: number;

  created: Array<{
    rowNumber: number;
    id: string;
    code?: string;
    name: string;
  }>;

  failed: Array<{
    rowNumber: number;
    name: string;
    errors: string[];
  }>;
};

/* =========================================================
   API
========================================================= */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5001/api";

const DEALER_IMPORT_BASE =
  `${API_BASE_URL}/dealers/import`;

/* =========================================================
   TABLE COLUMNS
========================================================= */

const columns: Array<{
  key: keyof ImportRowData;
  label: string;
}> = [
  {
    key: "name",
    label: "Dealer Name",
  },
  {
    key: "proprietor",
    label: "Proprietor",
  },
  {
    key: "zone",
    label: "Zone",
  },
  {
    key: "region",
    label: "Region",
  },
  {
    key: "area",
    label: "Area",
  },
  {
    key: "territory",
    label: "Territory",
  },
  {
    key: "type",
    label: "Type",
  },
  {
    key: "phoneNumber",
    label: "Phone Number",
  },
  {
    key: "warehouse",
    label: "Warehouse",
  },
  {
    key: "assignedSalesManager",
    label: "Assigned Sales Manager",
  },
  {
    key: "creditLimit",
    label: "Credit Limit",
  },
  {
    key: "openingBalance",
    label: "Opening Balance",
  },
  {
    key: "email",
    label: "Email",
  },
  {
    key: "address",
    label: "Address",
  },
  {
    key: "opDate",
    label: "Op. Date",
  },
  {
    key: "opMonth",
    label: "Op. Month",
  },
  {
    key: "lastPurchaseDate",
    label: "Last Purchase Date",
  },
  {
    key: "status",
    label: "Status",
  },
  {
    key: "notes",
    label: "Notes",
  },
];

/* =========================================================
   PAGE
========================================================= */

export default function DealerBulkImportPage() {
  const fileInputRef =
    useRef<HTMLInputElement | null>(null);

  const [file, setFile] =
    useState<File | null>(null);

  const [preview, setPreview] =
    useState<PreviewResponse | null>(null);

  const [confirmResult, setConfirmResult] =
    useState<ConfirmResponse | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [confirming, setConfirming] =
    useState(false);

  const [downloading, setDownloading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [filter, setFilter] =
    useState<"all" | "valid" | "invalid">(
      "all",
    );

  /* =======================================================
     FILTERED ROWS
  ======================================================= */

  const filteredRows = useMemo(() => {
    if (!preview) {
      return [];
    }

    if (filter === "valid") {
      return preview.rows.filter(
        (row) => row.valid,
      );
    }

    if (filter === "invalid") {
      return preview.rows.filter(
        (row) => !row.valid,
      );
    }

    return preview.rows;
  }, [preview, filter]);

  /* =======================================================
     CONFIRM STATE
  ======================================================= */

  const canConfirm =
    !!preview &&
    preview.validRows > 0 &&
    !loading &&
    !confirming;

  /* =======================================================
     HELPERS
  ======================================================= */

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  function resetImport() {
    setFile(null);
    setPreview(null);
    setConfirmResult(null);

    setError("");
    setSuccess("");

    setFilter("all");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function getCellValue(
    row: ImportRow,
    key: keyof ImportRowData,
  ): string {
    const value = row.data?.[key];

    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "—";
    }

    /*
     * Relationship fields now return:
     *
     * {
     *   id: "...",
     *   name: "..."
     * }
     *
     * Display the human-readable name.
     */
    if (
      typeof value === "object" &&
      "name" in value
    ) {
      return value.name || "—";
    }

    if (
      key === "creditLimit" ||
      key === "openingBalance"
    ) {
      return Number(value).toLocaleString();
    }

    return String(value);
  }

  function getDisplayValue(
    row: ImportRow,
    key: keyof ImportRowData,
  ): string {
    return getCellValue(row, key);
  }

  function getCellClass(
    key: keyof ImportRowData,
  ) {
    if (
      key === "name"
    ) {
      return "font-medium text-slate-900 dark:text-white";
    }

    if (
      key === "type"
    ) {
      return "font-semibold";
    }

    if (
      key === "creditLimit" ||
      key === "openingBalance"
    ) {
      return "text-right tabular-nums";
    }

    return "";
  }

  /* =======================================================
     FILE
  ======================================================= */

  function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    clearMessages();

    setPreview(null);
    setConfirmResult(null);

    const selectedFile =
      event.target.files?.[0];

    if (!selectedFile) {
      setFile(null);
      return;
    }

    const extension =
      selectedFile.name
        .split(".")
        .pop()
        ?.toLowerCase();

    if (
      extension !== "xlsx" &&
      extension !== "xls"
    ) {
      setFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setError(
        "Please select a valid Excel file (.xlsx or .xls).",
      );

      return;
    }

    if (
      selectedFile.size >
      10 * 1024 * 1024
    ) {
      setFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setError(
        "File size cannot exceed 10 MB.",
      );

      return;
    }

    setFile(selectedFile);
  }

  /* =======================================================
     DOWNLOAD TEMPLATE
  ======================================================= */

  async function downloadTemplate() {
    try {
      clearMessages();

      setDownloading(true);

      const response =
        await fetch(
          `${DEALER_IMPORT_BASE}/template`,
          {
            method: "GET",
            credentials: "include",
          },
        );

      if (!response.ok) {
        throw new Error(
          "Failed to download dealer import template.",
        );
      }

      const blob =
        await response.blob();

      const url =
        window.URL.createObjectURL(
          blob,
        );

      const anchor =
        document.createElement("a");

      anchor.href = url;

      anchor.download =
        "dealer-import-template.xlsx";

      document.body.appendChild(
        anchor,
      );

      anchor.click();

      anchor.remove();

      window.URL.revokeObjectURL(
        url,
      );
    } catch (err: any) {
      setError(
        err?.message ||
          "Failed to download the Excel template.",
      );
    } finally {
      setDownloading(false);
    }
  }

  /* =======================================================
     PREVIEW
  ======================================================= */

  async function previewImport() {
    if (!file) {
      setError(
        "Please select an Excel file first.",
      );

      return;
    }

    try {
      clearMessages();

      setPreview(null);
      setConfirmResult(null);

      setLoading(true);

      const formData =
        new FormData();

      formData.append(
        "file",
        file,
      );

      const response =
        await fetch(
          `${DEALER_IMPORT_BASE}/preview`,
          {
            method: "POST",
            body: formData,
            credentials: "include",
          },
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result?.message ||
            "Failed to preview dealer import.",
        );
      }

      const data =
        result?.data as PreviewResponse;

      if (!data) {
        throw new Error(
          "The server returned an empty preview response.",
        );
      }

      setPreview(data);

      if (data.invalidRows > 0) {
        setError(
          `${data.invalidRows} row${
            data.invalidRows === 1
              ? ""
              : "s"
          } need attention before import.`,
        );
      } else {
        setSuccess(
          `All ${data.validRows} dealer row${
            data.validRows === 1
              ? ""
              : "s"
          } are valid.`,
        );
      }
    } catch (err: any) {
      setError(
        err?.message ||
          "Something went wrong while previewing the file.",
      );
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     CONFIRM IMPORT
  ======================================================= */

  async function confirmImport() {
    if (
      !preview ||
      preview.validRows === 0
    ) {
      setError(
        "There are no valid rows to import.",
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Are you sure you want to import ${preview.validRows} valid dealer${
          preview.validRows === 1
            ? ""
            : "s"
        }?\n\nInvalid rows will not be imported.`,
      );

    if (!confirmed) {
      return;
    }

    try {
      clearMessages();

      setConfirmResult(null);

      setConfirming(true);

      /*
       * IMPORTANT:
       *
       * preview.rows[].data is now for display
       * and contains { id, name } objects.
       *
       * Do NOT send preview.rows[].data.
       *
       * resolvedRows still contains the ObjectId
       * strings required by the confirm API.
       */
      const response =
        await fetch(
          `${DEALER_IMPORT_BASE}/confirm`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              rows:
                preview.resolvedRows,
            }),

            credentials: "include",
          },
        );

      const result =
        await response.json();

      /*
       * 207 is a partial-success response
       * and should not be treated as a
       * complete request failure.
       */
      if (
        !response.ok &&
        response.status !== 207
      ) {
        throw new Error(
          result?.message ||
            "Failed to confirm dealer import.",
        );
      }

      const data =
        result?.data as ConfirmResponse;

      if (!data) {
        throw new Error(
          "The server returned an empty import result.",
        );
      }

      setConfirmResult(data);

      if (
        data.createdCount > 0 &&
        data.failedCount === 0
      ) {
        setSuccess(
          `${data.createdCount} dealer${
            data.createdCount === 1
              ? ""
              : "s"
          } imported successfully.`,
        );
      } else if (
        data.createdCount > 0 &&
        data.failedCount > 0
      ) {
        setError(
          `${data.createdCount} dealer${
            data.createdCount === 1
              ? ""
              : "s"
          } imported successfully, but ${
            data.failedCount
          } failed.`,
        );
      } else {
        setError(
          "No dealers were imported. Please check the errors below.",
        );
      }
    } catch (err: any) {
      setError(
        err?.message ||
          "Something went wrong while confirming the import.",
      );
    } finally {
      setConfirming(false);
    }
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 dark:bg-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1800px]">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Bulk Dealer Import
            </h1>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Upload an Excel file, review every row,
              fix validation issues, and import valid dealers.
            </p>
          </div>

          <button
            type="button"
            onClick={downloadTemplate}
            disabled={downloading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {downloading ? (
              <>
                <Spinner />
                Downloading...
              </>
            ) : (
              <>
                <DownloadIcon />
                Download Template
              </>
            )}
          </button>
        </div>

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            <AlertIcon />

            <div className="flex-1">
              <p className="leading-5">
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setError("")
              }
              className="text-lg leading-none text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        )}

        {/* =================================================
            SUCCESS
        ================================================= */}

        {success && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
            <CheckCircleIcon />

            <div className="flex-1">
              <p className="leading-5">
                {success}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setSuccess("")
              }
              className="text-lg leading-none text-emerald-500 hover:text-emerald-700"
            >
              ×
            </button>
          </div>
        )}

        {/* =================================================
            UPLOAD CARD
        ================================================= */}

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <h2 className="font-semibold text-slate-900 dark:text-white">
              Upload Excel File
            </h2>

            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Maximum file size: 10 MB. Supported formats:
              XLSX and XLS.
            </p>
          </div>

          <div className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end">

              <div className="flex-1">
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Dealer Excel File
                </label>

                <div className="flex min-h-[46px] items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-950">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    onChange={
                      handleFileChange
                    }
                    className="block w-full cursor-pointer text-sm text-slate-600 file:mr-4 file:cursor-pointer file:rounded-md file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800 dark:text-slate-400"
                  />
                </div>

                {file && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <FileIcon />

                    <span className="truncate">
                      {file.name}
                    </span>

                    <span className="shrink-0">
                      ({formatFileSize(
                        file.size,
                      )})
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={previewImport}
                  disabled={
                    !file ||
                    loading
                  }
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                >
                  {loading ? (
                    <>
                      <Spinner />
                      Validating...
                    </>
                  ) : (
                    <>
                      <EyeIcon />
                      Preview
                    </>
                  )}
                </button>

                {(file ||
                  preview) && (
                  <button
                    type="button"
                    onClick={
                      resetImport
                    }
                    disabled={
                      loading ||
                      confirming
                    }
                    className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Rules */}
            <div className="mt-5 rounded-xl bg-slate-50 p-4 dark:bg-slate-950">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Import Rules
              </p>

              <div className="grid gap-2 text-xs text-slate-600 dark:text-slate-400 sm:grid-cols-2 lg:grid-cols-3">
                <Rule text="Dealer Code is generated automatically" />
                <Rule text="Phone Number must be unique" />
                <Rule text="CREDIT requires Credit Limit > 0" />
                <Rule text="Region must belong to Zone" />
                <Rule text="Area must belong to Region" />
                <Rule text="Territory must belong to Area" />
                <Rule text="Warehouse must already exist" />
                <Rule text="Sales Manager must already exist" />
                <Rule text="Required demo attachments are generated automatically" />
              </div>
            </div>
          </div>
        </div>

        {/* =================================================
            PREVIEW
        ================================================= */}

        {preview && (
          <div className="mt-6">

            {/* Stats */}
            <div className="mb-5 grid gap-4 sm:grid-cols-3">
              <StatCard
                label="Total Rows"
                value={
                  preview.totalRows
                }
                icon={
                  <RowsIcon />
                }
              />

              <StatCard
                label="Valid Rows"
                value={
                  preview.validRows
                }
                icon={
                  <CheckCircleIcon />
                }
                valueClassName="text-emerald-600 dark:text-emerald-400"
              />

              <StatCard
                label="Invalid Rows"
                value={
                  preview.invalidRows
                }
                icon={
                  <AlertIcon />
                }
                valueClassName={
                  preview.invalidRows >
                  0
                    ? "text-red-600 dark:text-red-400"
                    : "text-slate-900 dark:text-white"
                }
              />
            </div>

            {/* Preview container */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">

              {/* Header */}
              <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between dark:border-slate-800">
                <div>
                  <h2 className="font-semibold text-slate-900 dark:text-white">
                    Import Preview
                  </h2>

                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Review all rows and validation errors before importing.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">

                  <FilterButton
                    active={
                      filter ===
                      "all"
                    }
                    onClick={() =>
                      setFilter(
                        "all",
                      )
                    }
                  >
                    All (
                    {
                      preview.totalRows
                    }
                    )
                  </FilterButton>

                  <FilterButton
                    active={
                      filter ===
                      "valid"
                    }
                    onClick={() =>
                      setFilter(
                        "valid",
                      )
                    }
                  >
                    Valid (
                    {
                      preview.validRows
                    }
                    )
                  </FilterButton>

                  <FilterButton
                    active={
                      filter ===
                      "invalid"
                    }
                    onClick={() =>
                      setFilter(
                        "invalid",
                      )
                    }
                  >
                    Invalid (
                    {
                      preview.invalidRows
                    }
                    )
                  </FilterButton>

                  <button
                    type="button"
                    onClick={
                      confirmImport
                    }
                    disabled={
                      !canConfirm
                    }
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {confirming ? (
                      <>
                        <Spinner />
                        Importing...
                      </>
                    ) : (
                      <>
                        <UploadIcon />
                        Import{" "}
                        {
                          preview.validRows
                        }{" "}
                        Valid Rows
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="min-w-[2400px] w-full text-left text-xs">

                  <thead className="bg-slate-50 dark:bg-slate-950">
                    <tr>

                      <th className="sticky left-0 z-20 whitespace-nowrap border-r border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                        Row
                      </th>

                      <th className="sticky left-[58px] z-20 whitespace-nowrap border-r border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                        Status
                      </th>

                      {columns.map(
                        (column) => (
                          <th
                            key={
                              String(
                                column.key,
                              )
                            }
                            className="whitespace-nowrap px-4 py-3 font-semibold text-slate-600 dark:text-slate-300"
                          >
                            {
                              column.label
                            }
                          </th>
                        ),
                      )}

                      <th className="min-w-[380px] whitespace-nowrap px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">
                        Validation Errors
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">

                    {filteredRows.map(
                      (row) => (
                        <tr
                          key={
                            row.rowNumber
                          }
                          className={
                            row.valid
                              ? "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                              : "bg-red-50/60 hover:bg-red-50 dark:bg-red-950/10 dark:hover:bg-red-950/20"
                          }
                        >

                          {/* Row */}
                          <td className="sticky left-0 z-10 whitespace-nowrap border-r border-slate-100 bg-inherit px-4 py-3 font-semibold text-slate-700 dark:border-slate-800 dark:text-slate-300">
                            {
                              row.rowNumber
                            }
                          </td>

                          {/* Status */}
                          <td className="sticky left-[58px] z-10 whitespace-nowrap border-r border-slate-100 bg-inherit px-4 py-3 dark:border-slate-800">

                            {row.valid ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                                <CheckCircleIcon />
                                Valid
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 font-medium text-red-700 dark:bg-red-950/40 dark:text-red-400">
                                <AlertIcon />
                                Invalid
                              </span>
                            )}

                          </td>

                          {/* Data */}
                          {columns.map(
                            (
                              column,
                            ) => {
                              const value =
                                getDisplayValue(
                                  row,
                                  column.key,
                                );

                              return (
                                <td
                                  key={`${row.rowNumber}-${String(
                                    column.key,
                                  )}`}
                                  className={`max-w-[260px] whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-400 ${getCellClass(
                                    column.key,
                                  )}`}
                                  title={
                                    value
                                  }
                                >
                                  {value}
                                </td>
                              );
                            },
                          )}

                          {/* Errors */}
                          <td className="min-w-[380px] px-4 py-3">

                            {row.errors &&
                            row.errors.length >
                              0 ? (
                              <div className="space-y-2">
                                {row.errors.map(
                                  (
                                    rowError,
                                    index,
                                  ) => (
                                    <div
                                      key={`${row.rowNumber}-error-${index}`}
                                      className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300"
                                    >
                                      <AlertIcon />

                                      <span className="leading-5">
                                        {
                                          rowError
                                        }
                                      </span>
                                    </div>
                                  ),
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400">
                                —
                              </span>
                            )}

                          </td>
                        </tr>
                      ),
                    )}

                    {!filteredRows.length && (
                      <tr>
                        <td
                          colSpan={
                            columns.length +
                            3
                          }
                          className="px-6 py-14 text-center text-sm text-slate-500 dark:text-slate-400"
                        >
                          No rows match this filter.
                        </td>
                      </tr>
                    )}

                  </tbody>
                </table>
              </div>

              {/* Bottom */}
              <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">

                <div>
                  {preview.invalidRows >
                  0 ? (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      {
                        preview.invalidRows
                      }{" "}
                      invalid row
                      {
                        preview.invalidRows ===
                        1
                          ? ""
                          : "s"
                      }{" "}
                      will be skipped.
                    </p>
                  ) : (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      All rows are ready to import.
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={
                    confirmImport
                  }
                  disabled={
                    !canConfirm
                  }
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {confirming ? (
                    <>
                      <Spinner />
                      Importing...
                    </>
                  ) : (
                    <>
                      <UploadIcon />
                      Confirm Import
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =================================================
            CONFIRM RESULT
        ================================================= */}

        {confirmResult && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">

            <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <h2 className="font-semibold text-slate-900 dark:text-white">
                Import Result
              </h2>

              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Results from the dealer creation process.
              </p>
            </div>

            {/* Result stats */}
            <div className="grid gap-4 p-5 sm:grid-cols-3">

              <StatCard
                label="Processed"
                value={
                  confirmResult.totalRows
                }
                icon={
                  <RowsIcon />
                }
              />

              <StatCard
                label="Created"
                value={
                  confirmResult.createdCount
                }
                icon={
                  <CheckCircleIcon />
                }
                valueClassName="text-emerald-600 dark:text-emerald-400"
              />

              <StatCard
                label="Failed"
                value={
                  confirmResult.failedCount
                }
                icon={
                  <AlertIcon />
                }
                valueClassName={
                  confirmResult.failedCount >
                  0
                    ? "text-red-600 dark:text-red-400"
                    : "text-slate-900 dark:text-white"
                }
              />
            </div>

            {/* Created */}
            {confirmResult.created.length >
              0 && (
              <div className="border-t border-slate-200 dark:border-slate-800">

                <div className="px-5 py-4">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Successfully Created
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-left text-sm">

                    <thead className="bg-slate-50 text-xs dark:bg-slate-950">
                      <tr>
                        <th className="px-5 py-3 font-semibold text-slate-500">
                          Excel Row
                        </th>

                        <th className="px-5 py-3 font-semibold text-slate-500">
                          Dealer
                        </th>

                        <th className="px-5 py-3 font-semibold text-slate-500">
                          Dealer Code
                        </th>

                        <th className="px-5 py-3 font-semibold text-slate-500">
                          ID
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">

                      {confirmResult.created.map(
                        (dealer) => (
                          <tr
                            key={
                              dealer.id
                            }
                          >
                            <td className="px-5 py-3 text-slate-600 dark:text-slate-400">
                              {
                                dealer.rowNumber
                              }
                            </td>

                            <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">
                              {
                                dealer.name
                              }
                            </td>

                            <td className="px-5 py-3 font-semibold text-emerald-600 dark:text-emerald-400">
                              {dealer.code ||
                                "—"}
                            </td>

                            <td className="px-5 py-3 font-mono text-xs text-slate-500">
                              {
                                dealer.id
                              }
                            </td>
                          </tr>
                        ),
                      )}

                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Failed */}
            {confirmResult.failed.length >
              0 && (
              <div className="border-t border-slate-200 dark:border-slate-800">

                <div className="px-5 py-4">
                  <h3 className="text-sm font-semibold text-red-600 dark:text-red-400">
                    Failed Rows
                  </h3>
                </div>

                <div className="space-y-3 px-5 pb-5">

                  {confirmResult.failed.map(
                    (failedRow) => (
                      <div
                        key={`${failedRow.rowNumber}-${failedRow.name}`}
                        className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-950/20"
                      >

                        <div className="flex flex-wrap items-center gap-2">

                          <span className="rounded-md bg-red-100 px-2 py-1 text-xs font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-400">
                            Row{" "}
                            {
                              failedRow.rowNumber
                            }
                          </span>

                          <span className="text-sm font-medium text-slate-900 dark:text-white">
                            {
                              failedRow.name
                            }
                          </span>
                        </div>

                        <div className="mt-3 space-y-2">

                          {failedRow.errors.map(
                            (
                              rowError,
                              index,
                            ) => (
                              <div
                                key={
                                  index
                                }
                                className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400"
                              >
                                <AlertIcon />

                                <span className="leading-5">
                                  {
                                    rowError
                                  }
                                </span>
                              </div>
                            ),
                          )}

                        </div>
                      </div>
                    ),
                  )}

                </div>
              </div>
            )}

            {/* Reset */}
            <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">
              <button
                type="button"
                onClick={
                  resetImport
                }
                className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Start New Import
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

/* =========================================================
   COMPONENTS
========================================================= */

function StatCard({
  label,
  value,
  icon,
  valueClassName =
    "text-slate-900 dark:text-white",
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">

        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {label}
          </p>

          <p
            className={`mt-2 text-2xl font-semibold ${valueClassName}`}
          >
            {value.toLocaleString()}
          </p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {icon}
        </div>

      </div>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 items-center justify-center rounded-lg px-3 text-xs font-medium transition ${
        active
          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

function Rule({
  text,
}: {
  text: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <CheckIcon />
      <span>{text}</span>
    </div>
  );
}

/* =========================================================
   ICONS
========================================================= */

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        className="stroke-current opacity-25"
        strokeWidth="3"
      />

      <path
        d="M21 12a9 9 0 0 1-9-9"
        className="stroke-current"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16"
      />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 16V4m0 0 4 4m-4-4L8 8M4 16.5V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.5"
      />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
      />

      <circle
        cx="12"
        cy="12"
        r="2.5"
      />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z"
      />

      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14 3v6h6"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m5 12 4 4L19 6"
      />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
      />

      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m8.5 12 2.3 2.3 4.7-5"
      />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3 2.8 19a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L12 3Z"
      />

      <path
        strokeLinecap="round"
        d="M12 9v4"
      />

      <circle
        cx="12"
        cy="17"
        r=".7"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

function RowsIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 5h16M4 12h16M4 19h16"
      />
    </svg>
  );
}

/* =========================================================
   FILE SIZE
========================================================= */

function formatFileSize(
  bytes: number,
) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}