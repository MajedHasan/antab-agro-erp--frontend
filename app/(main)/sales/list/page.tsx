"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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

import {
  ArrowLeft,
  Check,
  ChevronsUpDown,
  Eye,
  Loader2,
  Pencil,
  Printer,
  ReceiptText,
  RefreshCw,
  Truck,
  Ban,
  Upload,
  ShoppingCart,
  X,
  Plus,
  Filter as FilterIcon,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import SalesOrderBulkImport from "./_components/SalesOrderBulkImport";

/* =====================================================
   TYPES
===================================================== */

type LookupOption = {
  value: string;
  label: string;
  description?: string;
};

type OrderStatus =
  | "PENDING_AM"
  | "PENDING_RM"
  | "PENDING_NSM"
  | "PENDING_FULFILLMENT"
  | "IN_SHIPPING"
  | "DELIVERED"
  | "REJECTED"
  | "CANCELLED";

type PaymentMethod = "CASH" | "CREDIT";

type DatePreset =
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_3_months"
  | "this_year"
  | "";

type SalesOrderRecord = {
  _id: string;
  orderNo: string;
  customerId?: any;
  warehouseId?: any;
  invoiceId?: any;
  orderDate?: string;
  subTotal?: number;
  totalDiscount?: number;
  totalTax?: number;
  grandTotal?: number;
  totalBonusQty?: number;
  paymentMethod?: PaymentMethod;
  status: OrderStatus;
  isInvoiced?: boolean;
  approvalLogs?: Array<{
    role?: string;
    status?: string;
    actionDate?: string;
    remarks?: string;
    userId?: any;
  }>;
  createdAt?: string;
  updatedAt?: string;
};

type ListResponse = {
  data: SalesOrderRecord[];
  total: number;
  page: number;
  limit: number;
};

/* =====================================================
   HELPERS
===================================================== */

function money(n: number | undefined) {
  return Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(value?: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function useDebouncedValue<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
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

/* =====================================================
   BADGES
===================================================== */

function StatusBadge({ status }: { status: OrderStatus }) {
  const styles: Record<OrderStatus, string> = {
    PENDING_AM: "bg-slate-100 text-slate-700 border-slate-200",
    PENDING_RM: "bg-slate-100 text-slate-700 border-slate-200",
    PENDING_NSM: "bg-slate-100 text-slate-700 border-slate-200",
    PENDING_FULFILLMENT: "bg-amber-50 text-amber-700 border-amber-200",
    IN_SHIPPING: "bg-amber-50 text-amber-700 border-amber-200",
    DELIVERED: "bg-[#3aa838]/10 text-[#2f8a2f] border-[#3aa838]/30",
    REJECTED: "bg-rose-50 text-rose-700 border-rose-200",
    CANCELLED: "bg-rose-50 text-rose-700 border-rose-200",
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${styles[status]}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

function PaymentBadge({ method }: { method?: PaymentMethod }) {
  if (!method) return <span className="text-xs text-muted-foreground">-</span>;
  const styles =
    method === "CREDIT"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-[#3aa838]/10 text-[#2f8a2f] border-[#3aa838]/30";
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${styles}`}
    >
      {method}
    </span>
  );
}

/* =====================================================
   LOOKUP SELECT (used inside expanded filter panel)
===================================================== */

function LookupSelect({
  value,
  selectedLabel,
  onPick,
  fetchOptions,
  placeholder,
  searchPlaceholder,
  disabled,
}: {
  value?: string;
  selectedLabel?: string;
  onPick: (option: LookupOption) => void;
  fetchOptions: (query: string) => Promise<LookupOption[]>;
  placeholder: string;
  searchPlaceholder: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<LookupOption[]>([]);
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef<Record<string, LookupOption[]>>({});

  useEffect(() => {
    if (!open) return;
    const key = query.trim().toLowerCase();
    const timer = setTimeout(async () => {
      if (cacheRef.current[key]) {
        setOptions(cacheRef.current[key]);
        return;
      }
      setLoading(true);
      try {
        const list = await fetchOptions(query);
        cacheRef.current[key] = list;
        setOptions(list);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [open, query, fetchOptions]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="h-9 w-full justify-between overflow-hidden bg-white text-xs"
        >
          <span className="truncate">{selectedLabel || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? "Loading..." : "No result found."}
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
                      opt.value === value ? "opacity-100" : "opacity-0"
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

/* =====================================================
   MAIN LIST PAGE
===================================================== */

export default function SalesOrderListPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [refreshingAction, setRefreshingAction] = useState<string | null>(null);

  const [orders, setOrders] = useState<SalesOrderRecord[]>([]);
  const [total, setTotal] = useState(0);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);

  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [dealerFilter, setDealerFilter] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");

  // Date range
  const [datePreset, setDatePreset] = useState<DatePreset>("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Collapsible secondary filters
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [dealerMeta, setDealerMeta] = useState<LookupOption | null>(null);
  const [warehouseMeta, setWarehouseMeta] = useState<LookupOption | null>(null);

  const [showBulkImport, setShowBulkImport] = useState(false);

  /* ===================================================
     LOOKUPS
  =================================================== */

  const fetchDealers = useCallback(async (query: string) => {
    const res = await api.get("/dealers", {
      params: { q: query || undefined, page: 1, limit: 20 },
    });
    return (res.data?.data || []).map((d: any) => ({
      value: String(d._id || d.id),
      label: d.name || d.proprietor || String(d._id || d.id),
      description: `${d.phoneNumber || d.phone || ""}${
        d.status ? ` · ${d.status}` : ""
      }`,
    })) as LookupOption[];
  }, []);

  const fetchWarehouses = useCallback(async (query: string) => {
    const res = await api.get("/warehouses", {
      params: { q: query || undefined, page: 1, limit: 20 },
    });
    return (res.data?.data || []).map((w: any) => ({
      value: String(w._id || w.id),
      label: w.name || String(w._id || w.id),
      description: w.code || w.type || "",
    })) as LookupOption[];
  }, []);

  /* ===================================================
     LOAD ORDERS
  =================================================== */

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, limit };
      if (debouncedSearch.trim()) params.q = debouncedSearch.trim();
      if (statusFilter) params.status = statusFilter;
      if (paymentFilter) params.paymentMethod = paymentFilter;
      if (dealerFilter) params.customerId = dealerFilter;
      if (warehouseFilter) params.warehouseId = warehouseFilter;
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;

      const res = await api.get("/sales-orders", { params });
      const payload = res.data as ListResponse | any;

      setOrders(payload?.data || []);
      setTotal(Number(payload?.total || 0));
    } catch (err: any) {
      console.error(err);
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load sales orders.",
      );
    } finally {
      setLoading(false);
    }
  }, [
    page,
    limit,
    debouncedSearch,
    statusFilter,
    paymentFilter,
    dealerFilter,
    warehouseFilter,
    fromDate,
    toDate,
  ]);

  useEffect(() => {
    if (!showBulkImport) void loadOrders();
  }, [loadOrders, showBulkImport]);

  /* ===================================================
     SUMMARY + FILTER COUNT
  =================================================== */

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const summary = useMemo(() => {
    const delivered = orders.filter((o) => o.status === "DELIVERED").length;
    const pending = orders.filter((o) =>
      [
        "PENDING_AM",
        "PENDING_RM",
        "PENDING_NSM",
        "PENDING_FULFILLMENT",
      ].includes(o.status),
    ).length;
    const invoiced = orders.filter((o) => o.isInvoiced).length;
    const grand = orders.reduce((s, o) => s + Number(o.grandTotal || 0), 0);
    return { delivered, pending, invoiced, grand };
  }, [orders]);

  const activeFilterCount =
    (statusFilter ? 1 : 0) +
    (paymentFilter ? 1 : 0) +
    (dealerFilter ? 1 : 0) +
    (warehouseFilter ? 1 : 0) +
    (fromDate || toDate ? 1 : 0);

  const hasAnyFilter = activeFilterCount > 0 || Boolean(search);

  /* ===================================================
     DATE ACTIONS
  =================================================== */

  const applyPreset = (preset: DatePreset) => {
    if (!preset) {
      clearDates();
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

  /* ===================================================
     FILTER ACTIONS
  =================================================== */

  const setDealer = async (opt: LookupOption) => {
    setDealerFilter(opt.value);
    setDealerMeta(opt);
    setPage(1);
  };

  const setWarehouse = async (opt: LookupOption) => {
    setWarehouseFilter(opt.value);
    setWarehouseMeta(opt);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setPaymentFilter("");
    setDealerFilter("");
    setWarehouseFilter("");
    setFromDate("");
    setToDate("");
    setDatePreset("");
    setDealerMeta(null);
    setWarehouseMeta(null);
    setPage(1);
  };

  /* ===================================================
     NAVIGATION
  =================================================== */

  const openView = (id: string) => router.push(`/sales/list/${id}`);
  const openEdit = (id: string) => router.push(`/sales/list/${id}/edit`);
  const openInvoice = (orderId: string) => router.push(`/sales/list/${orderId}`);
  const handleDeliver = (orderId: string) => router.push(`/sales-orders/${orderId}`);

  /* ===================================================
     ORDER ACTIONS
  =================================================== */

  const handleCancel = async (orderId: string) => {
    if (!confirm("Cancel this sales order?")) return;
    setRefreshingAction(orderId);
    try {
      await api.post(`/sales-orders/${orderId}/cancel`);
      toast.success("Order cancelled.");
      await loadOrders();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || err?.message || "Failed to cancel order.",
      );
    } finally {
      setRefreshingAction(null);
    }
  };

  const handleShip = async (orderId: string) => {
    if (!confirm("Create invoice and move this order to fulfillment?")) return;
    setRefreshingAction(orderId);
    try {
      await api.post(`/sales-orders/${orderId}/ship`);
      toast.success("Invoice created and order moved to shipping.");
      await loadOrders();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || err?.message || "Failed to ship order.",
      );
    } finally {
      setRefreshingAction(null);
    }
  };

  /* ===================================================
     BULK IMPORT VIEW
  =================================================== */

  if (showBulkImport) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto w-full max-w-7xl p-4 md:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  setShowBulkImport(false);
                  setPage(1);
                  void loadOrders();
                }}
                className="h-8 w-8"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-base font-semibold">Bulk Sales Order Import</h1>
                <p className="text-xs text-muted-foreground">
                  Upload and validate multiple sales orders from an Excel file.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowBulkImport(false);
                setPage(1);
                void loadOrders();
              }}
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Back
            </Button>
          </div>
          <SalesOrderBulkImport />
        </div>
      </div>
    );
  }

  /* ===================================================
     NORMAL LIST
  =================================================== */

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl p-3 md:p-4">
        {/* =============================================
            COMPACT HERO — title + inline stats + actions
        ============================================= */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#3aa838]/10">
              <ShoppingCart className="h-4 w-4 text-[#3aa838]" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-semibold leading-tight">Sales Orders</h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                <span>
                  <b className="text-slate-900 tabular-nums">{orders.length}</b> visible
                </span>
                <span className="text-[#3aa838]">
                  <b className="tabular-nums">{summary.delivered}</b> delivered
                </span>
                <span className="text-amber-600">
                  <b className="tabular-nums">{summary.pending}</b> pending
                </span>
                <span className="text-[#3aa838]">
                  <b className="tabular-nums">{summary.invoiced}</b> invoiced
                </span>
                <span className="text-slate-300">·</span>
                <span>
                  <b className="text-slate-900 tabular-nums">
                    ৳ {money(summary.grand)}
                  </b>{" "}
                  page total
                </span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadOrders()}
              title="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowBulkImport(true)}
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Bulk
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => router.push("/sales/create")}
              className="bg-[#3aa838] text-white hover:bg-[#2f8a2f]"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New
            </Button>
          </div>
        </div>

        {/* =============================================
            COMPACT FILTER BAR (collapsible)
        ============================================= */}
        <div className="mb-3 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-2 px-3 py-2">
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search order no..."
              className="h-9 w-full max-w-[240px] text-sm"
            />

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="h-9 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-[#3aa838]"
            >
              <option value="">All statuses</option>
              <option value="PENDING_AM">Pending AM</option>
              <option value="PENDING_RM">Pending RM</option>
              <option value="PENDING_NSM">Pending NSM</option>
              <option value="PENDING_FULFILLMENT">Pending Fulfillment</option>
              <option value="IN_SHIPPING">In Shipping</option>
              <option value="DELIVERED">Delivered</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            <select
              value={paymentFilter}
              onChange={(e) => {
                setPaymentFilter(e.target.value);
                setPage(1);
              }}
              className="h-9 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-[#3aa838]"
            >
              <option value="">All payments</option>
              <option value="CASH">Cash</option>
              <option value="CREDIT">Credit</option>
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
                onClick={clearFilters}
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

          {/* Expanded filters */}
          {filtersOpen && (
            <div className="grid gap-3 border-t border-slate-200 bg-slate-50/60 px-3 py-3 md:grid-cols-4">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-600">
                  From date
                </label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => onDateChange("from", e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-600">
                  To date
                </label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => onDateChange("to", e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-600">
                  Dealer
                </label>
                <LookupSelect
                  value={dealerFilter}
                  selectedLabel={dealerMeta?.label}
                  onPick={setDealer}
                  fetchOptions={fetchDealers}
                  placeholder="Search dealer"
                  searchPlaceholder="Type dealer name or phone..."
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-600">
                  Warehouse
                </label>
                <LookupSelect
                  value={warehouseFilter}
                  selectedLabel={warehouseMeta?.label}
                  onPick={setWarehouse}
                  fetchOptions={fetchWarehouses}
                  placeholder="Search warehouse"
                  searchPlaceholder="Type warehouse name..."
                />
              </div>
            </div>
          )}
        </div>

        {/* =============================================
            TABLE
        ============================================= */}
        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 text-left">
                  <tr>
                    {[
                      "Order No",
                      "Dealer",
                      "Warehouse",
                      "Date",
                      "Payment",
                      "Status",
                    ].map((h) => (
                      <th
                        key={h}
                        className="border-b border-slate-200 px-3 py-2.5 text-[11px] font-medium uppercase tracking-wide text-slate-600"
                      >
                        {h}
                      </th>
                    ))}
                    <th className="border-b border-slate-200 px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wide text-slate-600">
                      Total
                    </th>
                    <th className="border-b border-slate-200 px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wide text-slate-600">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-16 text-center">
                        <div className="flex items-center justify-center gap-2 text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading sales orders...
                        </div>
                      </td>
                    </tr>
                  ) : orders.length ? (
                    orders.map((order) => {
                      const dealerName =
                        order.customerId?.name ||
                        order.customerId?.proprietor ||
                        order.customerId?.phoneNumber ||
                        order.customerId?._id ||
                        "-";
                      const warehouseName =
                        order.warehouseId?.name || order.warehouseId?._id || "-";
                      const invoiceExists =
                        typeof order.invoiceId === "object"
                          ? !!order.invoiceId?._id || !!order.invoiceId?.id
                          : !!order.invoiceId;

                      const editableStatuses: OrderStatus[] = [
                        "PENDING_AM",
                        "PENDING_RM",
                        "PENDING_NSM",
                        "PENDING_FULFILLMENT",
                      ];
                      const canEdit = editableStatuses.includes(order.status);
                      const canShip = order.status === "PENDING_FULFILLMENT";
                      const canDeliver = order.status === "IN_SHIPPING";
                      const canCancel = !["DELIVERED", "CANCELLED"].includes(
                        order.status,
                      );
                      const isBusy = refreshingAction === order._id;

                      return (
                        <tr
                          key={order._id}
                          className="border-b border-slate-100 last:border-0 transition-colors hover:bg-slate-50/70"
                        >
                          <td className="px-3 py-2 font-mono text-xs font-semibold text-slate-900">
                            {order.orderNo}
                          </td>

                          <td className="px-3 py-2">
                            <div className="text-sm font-medium text-slate-900">
                              {dealerName}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {order.customerId?.phoneNumber || ""}
                            </div>
                          </td>

                          <td className="px-3 py-2 text-xs text-slate-700">
                            {warehouseName}
                          </td>

                          <td className="px-3 py-2 text-xs text-slate-600 tabular-nums">
                            {fmtDate(order.orderDate || order.createdAt)}
                          </td>

                          <td className="px-3 py-2">
                            <PaymentBadge method={order.paymentMethod} />
                          </td>

                          <td className="px-3 py-2">
                            <StatusBadge status={order.status} />
                            <div className="mt-0.5 text-[10px] text-muted-foreground">
                              {order.isInvoiced ? "Invoiced" : "Not invoiced"}
                            </div>
                          </td>

                          <td className="px-3 py-2 text-right">
                            <div className="text-sm font-semibold tabular-nums text-slate-900">
                              ৳ {money(order.grandTotal)}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              Bonus: {Number(order.totalBonusQty || 0)}
                            </div>
                          </td>

                          <td className="px-3 py-2">
                            <div className="flex items-center justify-end gap-0.5">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => openView(order._id)}
                                title="View"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>

                              {canEdit && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => openEdit(order._id)}
                                  title="Edit"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              )}

                              {invoiceExists && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => openInvoice(order._id)}
                                  title="Print invoice"
                                >
                                  <Printer className="h-3.5 w-3.5" />
                                </Button>
                              )}

                              {canShip && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => void handleShip(order._id)}
                                  disabled={isBusy}
                                  className="h-7 border-[#3aa838]/40 px-2 text-[11px] text-[#2f8a2f] hover:bg-[#3aa838]/5 hover:text-[#2f8a2f]"
                                >
                                  {isBusy ? (
                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                  ) : (
                                    <ReceiptText className="mr-1 h-3 w-3" />
                                  )}
                                  Ship
                                </Button>
                              )}

                              {canDeliver && (
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => handleDeliver(order._id)}
                                  className="h-7 bg-[#3aa838] px-2 text-[11px] text-white hover:bg-[#2f8a2f]"
                                >
                                  <Truck className="mr-1 h-3 w-3" />
                                  Deliver
                                </Button>
                              )}

                              {canCancel && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                  onClick={() => void handleCancel(order._id)}
                                  disabled={isBusy}
                                  title="Cancel"
                                >
                                  {isBusy ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Ban className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-4 py-16 text-center">
                        <div className="mx-auto flex max-w-sm flex-col items-center gap-3 text-muted-foreground">
                          <div className="rounded-full bg-slate-100 p-3">
                            <ShoppingCart className="h-6 w-6" />
                          </div>
                          <div className="text-sm font-medium text-slate-700">
                            No sales orders found
                          </div>
                          <div className="text-xs">
                            {hasAnyFilter
                              ? "Try widening the filters or date range."
                              : "Create your first order to get started."}
                          </div>
                          {hasAnyFilter ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={clearFilters}
                            >
                              <X className="mr-1.5 h-3.5 w-3.5" />
                              Clear filters
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => router.push("/sales/create")}
                              className="bg-[#3aa838] text-white hover:bg-[#2f8a2f]"
                            >
                              <Plus className="mr-1.5 h-3.5 w-3.5" />
                              New Order
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* =============================================
            PAGINATION
        ============================================= */}
        <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="text-xs text-muted-foreground">
            {total > 0 ? (
              <>
                Showing{" "}
                <strong className="text-slate-900">
                  {(page - 1) * limit + 1}
                </strong>
                –
                <strong className="text-slate-900">
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
              value={String(limit)}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-[#3aa838]"
            >
              <option value="10">10 / page</option>
              <option value="15">15 / page</option>
              <option value="25">25 / page</option>
              <option value="50">50 / page</option>
            </select>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Prev
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
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}