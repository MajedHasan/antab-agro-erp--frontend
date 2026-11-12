// src/app/sales/return/page.tsx
"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";
import {
  CalendarRange,
  ChevronDown,
  ChevronUp,
  Eye,
  Filter as FilterIcon,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Undo2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";

import {
  formatDate,
  getInvoiceCount,
  getProductCount,
  getReturnQty,
  getStatusLabel,
  money,
  type SalesReturnStatus,
} from "./utils/salesReturn.helpers";

/* --------------------------- Types --------------------------- */
type DealerOption = {
  value: string;
  label: string;
  description?: string;
};

type SalesReturnListItem = {
  _id: string;
  returnNo: string;
  customerId?: {
    _id?: string;
    name?: string;
    phoneNumber?: string;
  } | null;
  status: SalesReturnStatus;
  invoiceReturns?: any[];
  totalRequestedAmount?: number;
  totalApprovedAmount?: number;
  totalReceivedAmount?: number;
  createdAt?: string;
  updatedAt?: string;
  notes?: string;
  printCount?: number;
  warehouseReceived?: boolean;
  approvalLogs?: any[];
};

type DatePreset =
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_3_months"
  | "this_year"
  | "";

/* --------------------------- Helpers --------------------------- */
const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "PENDING_AM", label: "Pending AM" },
  { value: "PENDING_RM", label: "Pending RM" },
  { value: "PENDING_NSM", label: "Pending NSM" },
  { value: "READY_FOR_PRINT", label: "Ready for Print" },
  { value: "PRINTED", label: "Printed" },
  { value: "SENT_TO_WAREHOUSE", label: "Sent to Warehouse" },
  { value: "WAREHOUSE_RECEIVED", label: "Warehouse Received" },
  { value: "HOLD", label: "Hold" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "COMPLETED", label: "Completed" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CANCELLED", label: "Cancelled" },
];

function useDebouncedValue<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function getPresetRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  switch (preset) {
    case "this_week": {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - diff);
      return { from: fmt(monday), to: fmt(now) };
    }
    case "last_week": {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1;
      const lastMonday = new Date(now);
      lastMonday.setDate(now.getDate() - diff - 7);
      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastMonday.getDate() + 6);
      return { from: fmt(lastMonday), to: fmt(lastSunday) };
    }
    case "this_month": {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: fmt(first), to: fmt(now) };
    }
    case "last_3_months": {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 3);
      return { from: fmt(d), to: fmt(now) };
    }
    case "this_year": {
      const first = new Date(now.getFullYear(), 0, 1);
      return { from: fmt(first), to: fmt(now) };
    }
    default:
      return { from: "", to: "" };
  }
}

/* 🎨 palette-locked badge colors */
function badgeClass(status: SalesReturnStatus) {
  switch (status) {
    case "COMPLETED":
    case "RESOLVED":
    case "WAREHOUSE_RECEIVED":
      return "bg-[#3aa838]/10 text-[#2f8a2f] border-[#3aa838]/30";
    case "READY_FOR_PRINT":
    case "PRINTED":
    case "SENT_TO_WAREHOUSE":
      return "bg-[#3aa838]/5 text-[#2f8a2f] border-[#3aa838]/20";
    case "PENDING_AM":
    case "PENDING_RM":
    case "PENDING_NSM":
    case "HOLD":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "REJECTED":
    case "CANCELLED":
      return "bg-rose-50 text-rose-700 border-rose-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

/* --------------------------- DealerSelect --------------------------- */
function DealerSelect({
  value,
  selectedLabel,
  onPick,
}: {
  value?: string;
  selectedLabel?: string;
  onPick: (dealer: DealerOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<DealerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const cacheRef = React.useRef<Record<string, DealerOption[]>>({});

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(async () => {
      const key = query.trim().toLowerCase();
      if (cacheRef.current[key]) {
        setOptions(cacheRef.current[key]);
        return;
      }
      setLoading(true);
      try {
        const res = await api.get("/dealers", {
          params: { q: query || undefined, page: 1, limit: 20 },
        });
        const list = (res.data?.data || []).map((d: any) => ({
          value: String(d._id || d.id),
          label: d.name || d.proprietor || String(d._id || d.id),
          description: [
            d.phoneNumber || d.phone || "",
            d.status ? String(d.status) : "",
          ]
            .filter(Boolean)
            .join(" · "),
        })) as DealerOption[];
        cacheRef.current[key] = list;
        setOptions(list);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [open, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-10 w-full justify-between bg-white"
        >
          <span className="truncate">{selectedLabel || "All dealers"}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search dealer..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? "Loading..." : "No dealer found."}
            </CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={`${opt.label} ${opt.description || ""}`}
                  onSelect={() => {
                    onPick(opt);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <Check
                    className={`mr-2 h-4 w-4 ${
                      opt.value === value ? "opacity-100 text-[#3aa838]" : "opacity-0"
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{opt.label}</div>
                    {opt.description ? (
                      <div className="truncate text-xs text-muted-foreground">
                        {opt.description}
                      </div>
                    ) : null}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* --------------------------- Row details (expand) --------------------------- */
function ReturnRowDetails({ doc }: { doc: SalesReturnListItem }) {
  const recentLog = (doc.approvalLogs || []).slice(-1)[0];
  const firstBlock = (doc.invoiceReturns || [])[0];
  const firstItems = firstBlock?.items || [];
  const firstItemsText = firstItems
    .slice(0, 3)
    .map(
      (i: any) =>
        i.productId?.name || i.productName || String(i.productId || "Item"),
    )
    .join(", ");

  return (
    <div className="grid gap-4 border-t border-slate-200 bg-slate-50/70 p-4 md:grid-cols-4">
      <div>
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Workflow
        </div>
        <div className="mt-1 font-medium text-slate-900">
          {getStatusLabel(doc.status)}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          Print count: {doc.printCount || 0}
        </div>
      </div>

      <div>
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Quantity
        </div>
        <div className="mt-1 font-medium text-slate-900">{getReturnQty(doc)}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Products: {getProductCount(doc)} · Invoices: {getInvoiceCount(doc)}
        </div>
      </div>

      <div>
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Financials
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          Requested:{" "}
          <span className="font-medium text-slate-900 tabular-nums">
            ৳ {money(Number(doc.totalRequestedAmount || 0))}
          </span>
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          Approved:{" "}
          <span className="font-medium text-[#2f8a2f] tabular-nums">
            ৳ {money(Number(doc.totalApprovedAmount || 0))}
          </span>
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          Received:{" "}
          <span className="font-medium text-[#2f8a2f] tabular-nums">
            ৳ {money(Number(doc.totalReceivedAmount || 0))}
          </span>
        </div>
      </div>

      <div>
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Recent activity
        </div>
        <div className="mt-1 font-medium text-slate-900">
          {recentLog?.role || "-"} ·{" "}
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
              recentLog?.status === "APPROVED"
                ? "bg-[#3aa838]/10 text-[#2f8a2f]"
                : recentLog?.status === "REJECTED"
                  ? "bg-rose-50 text-rose-700"
                  : "bg-amber-50 text-amber-700"
            }`}
          >
            {recentLog?.status || "-"}
          </span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {recentLog?.remarks || doc.notes || "No notes"}
        </div>
      </div>

      {firstItemsText ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-muted-foreground md:col-span-4">
          Sample items:{" "}
          <span className="font-medium text-slate-900">{firstItemsText}</span>
        </div>
      ) : null}
    </div>
  );
}

/* ===================== Main Page ===================== */
export default function SalesReturnListPage() {
  const router = useRouter();

  const [items, setItems] = useState<SalesReturnListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [status, setStatus] = useState("");
  const [dealer, setDealer] = useState<DealerOption | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 🆕 date range
  const [datePreset, setDatePreset] = useState<DatePreset>("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, limit };
      if (debouncedSearch.trim()) params.q = debouncedSearch.trim();
      if (status) params.status = status;
      if (dealer?.value) params.customerId = dealer.value;
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;

      const res = await api.get("/sales-returns", { params });
      setItems((res.data?.data || []) as SalesReturnListItem[]);
      setTotal(Number(res.data?.total || 0));
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to load sales returns.";
      toast.error(msg);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, status, dealer?.value, fromDate, toDate]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const requested = items.reduce(
      (sum, d) => sum + Number(d.totalRequestedAmount || 0),
      0,
    );
    const approved = items.reduce(
      (sum, d) => sum + Number(d.totalApprovedAmount || 0),
      0,
    );
    const received = items.reduce(
      (sum, d) => sum + Number(d.totalReceivedAmount || 0),
      0,
    );
    const qty = items.reduce((sum, d) => sum + getReturnQty(d), 0);
    return { requested, approved, received, qty };
  }, [items]);

  const activeFilterCount =
    (status ? 1 : 0) +
    (dealer?.value ? 1 : 0) +
    (fromDate || toDate ? 1 : 0);

  const hasAnyFilter = activeFilterCount > 0 || Boolean(search);

  /* ------------------- Date actions ------------------- */
  const applyPreset = (preset: DatePreset) => {
    if (!preset) {
      setFromDate("");
      setToDate("");
      setDatePreset("");
      setPage(1);
      return;
    }
    const { from, to } = getPresetRange(preset);
    setFromDate(from);
    setToDate(to);
    setDatePreset(preset);
    setPage(1);
  };

  const onDateChange = (which: "from" | "to", value: string) => {
    if (which === "from") setFromDate(value);
    else setToDate(value);
    setDatePreset("");
    setPage(1);
  };

  const clearDates = () => {
    setFromDate("");
    setToDate("");
    setDatePreset("");
    setPage(1);
  };

  const resetFilters = () => {
    setSearch("");
    setStatus("");
    setDealer(null);
    setFromDate("");
    setToDate("");
    setDatePreset("");
    setPage(1);
  };

  /* ------------------- Render ------------------- */
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl p-3 md:p-4">
        {/* ============ HERO ============ */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#3aa838]/10">
              <Undo2 className="h-4 w-4 text-[#3aa838]" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-semibold leading-tight">
                Sales Returns
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Visible</span>
                  <b className="tabular-nums text-slate-900">
                    {items.length}
                  </b>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Qty</span>
                  <b className="tabular-nums text-slate-900">{stats.qty}</b>
                </div>
                <span className="text-slate-300">·</span>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Requested</span>
                  <b className="tabular-nums text-slate-900">
                    ৳ {money(stats.requested)}
                  </b>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Approved</span>
                  <b className="tabular-nums text-[#2f8a2f]">
                    ৳ {money(stats.approved)}
                  </b>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Received</span>
                  <b className="tabular-nums text-[#2f8a2f]">
                    ৳ {money(stats.received)}
                  </b>
                </div>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => load()}
              disabled={loading}
              title="Refresh"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => router.push("/sales/return/create")}
              className="bg-[#3aa838] text-white hover:bg-[#2f8a2f]"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New return
            </Button>
          </div>
        </div>

        {/* ============ FILTER BAR ============ */}
        <div className="mb-3 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-2 px-3 py-2">
            <div className="relative w-full max-w-[260px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 pl-8 text-sm"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search return no..."
              />
            </div>

            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="h-9 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-[#3aa838]"
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s.value || "all"} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>

            <select
              value={datePreset}
              onChange={(e) => applyPreset(e.target.value as DatePreset)}
              className="h-9 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-[#3aa838]"
            >
              <option value="">
                {fromDate || toDate ? "Custom range" : "All dates"}
              </option>
              <option value="this_week">This Week</option>
              <option value="last_week">Last Week</option>
              <option value="this_month">This Month</option>
              <option value="last_3_months">Last 3 Months</option>
              <option value="this_year">This Year</option>
            </select>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFiltersOpen((v) => !v)}
              className={`h-9 ${
                activeFilterCount > 0
                  ? "border-[#3aa838]/40 bg-[#3aa838]/5 text-[#2f8a2f]"
                  : ""
              }`}
            >
              <FilterIcon className="mr-1.5 h-3.5 w-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-1.5 rounded-full bg-[#3aa838] px-1.5 py-0 text-[10px] font-bold text-white tabular-nums">
                  {activeFilterCount}
                </span>
              )}
              {filtersOpen ? (
                <ChevronUp className="ml-1.5 h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
              )}
            </Button>

            {hasAnyFilter && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="h-9 text-slate-500"
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Clear
              </Button>
            )}

            <div className="ml-auto text-xs text-muted-foreground tabular-nums">
              {total} records
            </div>
          </div>

          {filtersOpen && (
            <div className="grid gap-3 border-t border-slate-200 bg-slate-50/60 px-3 py-3 md:grid-cols-3">
              <div className="space-y-1">
                <label className="flex items-center gap-1 text-[11px] font-medium text-slate-600">
                  <CalendarRange className="h-3 w-3" /> From date
                </label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => onDateChange("from", e.target.value)}
                  className="h-9 text-xs focus-visible:ring-[#3aa838]"
                />
              </div>
              <div className="space-y-1">
                <label className="flex items-center gap-1 text-[11px] font-medium text-slate-600">
                  <CalendarRange className="h-3 w-3" /> To date
                </label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => onDateChange("to", e.target.value)}
                  className="h-9 text-xs focus-visible:ring-[#3aa838]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-600">
                  Dealer
                </label>
                <DealerSelect
                  value={dealer?.value}
                  selectedLabel={dealer?.label}
                  onPick={(d) => {
                    setDealer(d);
                    setPage(1);
                  }}
                />
              </div>
              <div className="md:col-span-3 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearDates}
                  className="h-9 text-xs"
                >
                  <X className="mr-1 h-3 w-3" />
                  Clear dates
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ============ TABLE ============ */}
        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-slate-200 px-4 py-2.5">
            <CardTitle className="text-sm">Returns</CardTitle>
            <div className="text-xs text-muted-foreground tabular-nums">
              Page {page} of {totalPages}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="bg-white">
              {/* Desktop header */}
              <div className="hidden grid-cols-12 gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-slate-600 md:grid">
                <div className="col-span-2">Return No</div>
                <div className="col-span-3">Dealer</div>
                <div className="col-span-2">Qty / Invoices</div>
                <div className="col-span-2">Amounts</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-1 text-right">Action</div>
              </div>

              <div className="divide-y divide-slate-100">
                {loading ? (
                  <div className="px-4 py-12 text-center text-muted-foreground">
                    <div className="inline-flex items-center gap-2 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading sales returns...
                    </div>
                  </div>
                ) : items.length === 0 ? (
                  <div className="px-4 py-16 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-3 text-muted-foreground">
                      <div className="rounded-full bg-slate-100 p-3">
                        <Undo2 className="h-6 w-6" />
                      </div>
                      <div className="text-sm font-medium text-slate-700">
                        No returns found
                      </div>
                      <div className="text-xs">
                        {hasAnyFilter
                          ? "Try widening the filters or date range."
                          : "Create your first sales return to get started."}
                      </div>
                      {hasAnyFilter ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={resetFilters}
                        >
                          <X className="mr-1.5 h-3.5 w-3.5" />
                          Clear filters
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() =>
                            router.push("/sales/return/create")
                          }
                          className="bg-[#3aa838] text-white hover:bg-[#2f8a2f]"
                        >
                          <Plus className="mr-1.5 h-3.5 w-3.5" />
                          New return
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  items.map((doc) => {
                    const expanded = expandedId === doc._id;
                    return (
                      <div
                        key={doc._id}
                        className="transition-colors hover:bg-slate-50/70"
                      >
                        <div className="grid grid-cols-1 gap-3 px-3 py-2.5 md:grid-cols-12 md:items-center">
                          <div className="md:col-span-2">
                            <button
                              type="button"
                              className="text-left"
                              onClick={() =>
                                setExpandedId(expanded ? null : doc._id)
                              }
                            >
                              <div className="font-mono text-xs font-semibold text-slate-900">
                                {doc.returnNo}
                              </div>
                              <div className="mt-0.5 text-[10px] text-muted-foreground tabular-nums">
                                {formatDate(doc.createdAt)}
                              </div>
                            </button>
                          </div>

                          <div className="md:col-span-3">
                            <div className="text-sm font-medium text-slate-900">
                              {doc.customerId?.name || "-"}
                            </div>
                            {doc.customerId?.phoneNumber ? (
                              <div className="text-[11px] text-muted-foreground">
                                {doc.customerId.phoneNumber}
                              </div>
                            ) : null}
                          </div>

                          <div className="md:col-span-2">
                            <div className="text-xs font-semibold tabular-nums text-slate-900">
                              Qty: {getReturnQty(doc)}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              Invoices: {getInvoiceCount(doc)} · Products:{" "}
                              {getProductCount(doc)}
                            </div>
                          </div>

                          <div className="md:col-span-2">
                            <div className="text-xs font-semibold tabular-nums text-slate-900">
                              ৳ {money(Number(doc.totalRequestedAmount || 0))}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              Approved:{" "}
                              <span className="font-medium text-[#2f8a2f]">
                                ৳{" "}
                                {money(Number(doc.totalApprovedAmount || 0))}
                              </span>
                            </div>
                          </div>

                          <div className="md:col-span-2">
                            <Badge
                              variant="secondary"
                              className={`${badgeClass(doc.status)} border text-[10px] font-semibold`}
                            >
                              {getStatusLabel(doc.status)}
                            </Badge>
                            <div className="mt-1 text-[10px] text-muted-foreground">
                              Received:{" "}
                              <span className="font-medium text-[#2f8a2f]">
                                ৳{" "}
                                {money(Number(doc.totalReceivedAmount || 0))}
                              </span>
                            </div>
                          </div>

                          <div className="md:col-span-1 md:text-right">
                            <Button
                              asChild
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-[11px]"
                            >
                              <Link href={`/sales/return/${doc._id}`}>
                                <Eye className="mr-1 h-3 w-3" />
                                Open
                              </Link>
                            </Button>
                          </div>
                        </div>

                        <div className="border-t border-slate-100 px-3 py-1">
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-7 px-2 text-[11px] text-muted-foreground"
                            onClick={() =>
                              setExpandedId(expanded ? null : doc._id)
                            }
                          >
                            {expanded ? (
                              <>
                                <ChevronUp className="mr-1 h-3 w-3" />
                                Hide details
                              </>
                            ) : (
                              <>
                                <ChevronDown className="mr-1 h-3 w-3" />
                                Show details
                              </>
                            )}
                          </Button>
                        </div>

                        {expanded ? <ReturnRowDetails doc={doc} /> : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Pagination */}
            <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50/60 px-3 py-2 md:flex-row md:items-center md:justify-between">
              <div className="text-xs text-muted-foreground">
                {total > 0 ? (
                  <>
                    Showing{" "}
                    <strong className="text-slate-900 tabular-nums">
                      {(page - 1) * limit + 1}
                    </strong>
                    –
                    <strong className="text-slate-900 tabular-nums">
                      {Math.min(page * limit, total)}
                    </strong>{" "}
                    of <strong className="text-slate-900">{total}</strong>
                  </>
                ) : (
                  <>No records</>
                )}
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-[#3aa838]"
                >
                  {[10, 15, 25, 50].map((n) => (
                    <option key={n} value={n}>
                      {n}/page
                    </option>
                  ))}
                </select>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>

                <div className="min-w-20 text-center text-xs text-muted-foreground">
                  Page <strong className="text-slate-900">{page}</strong> /{" "}
                  {totalPages}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={page >= totalPages || loading}
                  onClick={() =>
                    setPage((p) => Math.min(totalPages, p + 1))
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}