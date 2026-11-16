"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import api from "@/lib/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Plus,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Play,
  CheckCircle,
  Eye,
  LineChart,
  Factory as FactoryIcon,
  Filter as FilterIcon,
  CalendarRange,
  X,
  ChevronDown,
  ChevronUp,
  Clock,
  XCircle,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";

import Protected from "@/components/auth/Protected";
import usePermissionCheck from "@/hooks/usePermissionCheck";

/* =========================== Types =========================== */
type RawMaterial = { _id: string; name: string; sku?: string; unit: string };
type Factory = { _id: string; name: string; code?: string };
type MaterialWIP = {
  _id: string;
  factoryId: string | Factory;
  rawMaterialId: string | RawMaterial;
  date?: string;
  initialQuantity: number;
  remainingQuantity: number;
  unit: string;
  unitCost?: number;
  startCost?: number;
  issuedQuantity: number;
  returnedQuantity: number;
  consumedQuantity: number;
  expectedRawUsed: number;
  allowedWastageRawUsed: number;
  actualRawUsed: number;
  gainQuantity: number;
  normalWastageQuantity: number;
  productionLossQuantity: number;
  rawMaterialCost: number;
  packagingMaterialCost: number;
  otherMaterialCost: number;
  totalInputCost: number;
  totalFinishedGoodsCost: number;
  status: "ACTIVE" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
  conversions?: any[];
  pendingConversion?: any;
  createdBy?: { name: string };
  approvedBy?: { name: string };
  approvedAt?: string;
  createdAt?: string;
};

type DatePreset =
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_3_months"
  | "this_year"
  | "";

type SummaryData = {
  activeCount?: number;
  pendingCount?: number;
  approvedCount?: number;
  totalIssuedQuantity?: number;
};

/* =========================== Helpers =========================== */
const nameOf = (maybe: any) => {
  if (!maybe) return "-";
  if (typeof maybe === "string") return maybe;
  return maybe.name || maybe._id || "-";
};

const fmtDate = (v?: string) => {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "-" : format(d, "dd MMM yy");
};

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

function statusBadge(status: MaterialWIP["status"]) {
  const map: Record<string, string> = {
    ACTIVE:
      "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    PENDING_APPROVAL:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60",
    APPROVED:
      "bg-[#3aa838]/10 text-[#2f8a2f] border-[#3aa838]/30 dark:bg-[#3aa838]/15 dark:text-[#9bdd91] dark:border-[#3aa838]/40",
    REJECTED:
      "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60",
  };
  const Icon = {
    ACTIVE: Play,
    PENDING_APPROVAL: Clock,
    APPROVED: CheckCircle,
    REJECTED: XCircle,
  }[status];
  return (
    <Badge
      className={cn(
        "inline-flex items-center gap-1 border text-[10px] font-semibold",
        map[status],
      )}
    >
      <Icon className="h-2.5 w-2.5" />
      {status === "PENDING_APPROVAL" ? "PENDING" : status}
    </Badge>
  );
}

/* =========================== Page (Protected) =========================== */
export default function MaterialWipListPage() {
  return (
    <Protected
      permissions={[
        "materialwip.view",
        "materialwip.create",
        "materialwip.edit",
        "materialwip.delete",
      ]}
    >
      <MaterialWipListPageInner />
    </Protected>
  );
}

/* =========================== Inner =========================== */
function MaterialWipListPageInner() {
  const router = useRouter();
  const hasAccess = usePermissionCheck();
  const canCreate = hasAccess({ permissions: "materialwip.create" });
  const canEdit = hasAccess({ permissions: "materialwip.edit" });

  const [wips, setWips] = useState<MaterialWIP[]>([]);
  const [loading, setLoading] = useState(false);
  const [factories, setFactories] = useState<Factory[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);

  /* filters */
  const [search, setSearch] = useState("");
  const [factoryFilter, setFactoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  /* pagination */
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [total, setTotal] = useState(0);

  /* Load factories */
  useEffect(() => {
    api
      .get("/warehouses", { params: { type: "Factory", limit: 1000 } })
      .then((res) => setFactories(res.data?.data || []))
      .catch(() => {});
  }, []);

  const fetchWips = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {
        page,
        limit,
        factoryId: factoryFilter !== "all" ? factoryFilter : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        q: search.trim() || undefined,
      };
      const res = await api.get("/material-wip", { params });
      setWips(res.data?.data || []);
      setTotal(res.data?.total || 0);
      setSummary(res.data?.summary || null);
    } catch {
      toast.error("Failed to load WIP records");
    } finally {
      setLoading(false);
    }
  }, [page, limit, factoryFilter, statusFilter, fromDate, toDate, search]);

  useEffect(() => {
    fetchWips();
  }, [fetchWips]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const activeFilterCount =
    (factoryFilter !== "all" ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (fromDate || toDate ? 1 : 0);

  const hasAnyFilter = activeFilterCount > 0 || Boolean(search);

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

  const clearAll = () => {
    setSearch("");
    setFactoryFilter("all");
    setStatusFilter("all");
    setFromDate("");
    setToDate("");
    setDatePreset("");
    setPage(1);
  };

  /* =========================== Render =========================== */
  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950">
      <div className="mx-auto w-full max-w-[1600px] p-3 md:p-6">
        {/* ============ COMPACT HERO ============ */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#3aa838]/10 text-[#3aa838]">
              <FactoryIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-bold leading-tight tracking-tight text-slate-900 dark:text-white">
                Material WIP
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
                <div className="flex items-center gap-1">
                  <span className="text-slate-500 dark:text-slate-400">
                    Visible
                  </span>
                  <b className="tabular-nums text-slate-900 dark:text-white">
                    {wips.length}
                  </b>
                </div>
                {summary && (
                  <>
                    <span className="text-slate-300 dark:text-slate-600">
                      ·
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-500 dark:text-slate-400">
                        Active
                      </span>
                      <b className="tabular-nums text-slate-900 dark:text-white">
                        {summary.activeCount || 0}
                      </b>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-500 dark:text-slate-400">
                        Pending
                      </span>
                      <b className="tabular-nums text-amber-600 dark:text-amber-400">
                        {summary.pendingCount || 0}
                      </b>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-500 dark:text-slate-400">
                        Approved
                      </span>
                      <b className="tabular-nums text-[#2f8a2f] dark:text-[#9bdd91]">
                        {summary.approvedCount || 0}
                      </b>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-500 dark:text-slate-400">
                        Issued
                      </span>
                      <b className="tabular-nums text-slate-900 dark:text-white">
                        {Number(summary.totalIssuedQuantity || 0).toLocaleString()}
                      </b>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/inventory/material-wip/report")}
              className="h-9 gap-1.5"
            >
              <LineChart className="h-3.5 w-3.5" />
              Report
            </Button>
            {canCreate && (
              <Button
                size="sm"
                onClick={() => router.push("/inventory/material-wip/create")}
                className="h-9 gap-1.5 bg-[#3aa838] text-white shadow-sm shadow-[#3aa838]/20 hover:bg-[#2f8a2f]"
              >
                <Plus className="h-3.5 w-3.5" />
                New WIP
              </Button>
            )}
          </div>
        </div>

        {/* ============ FILTER BAR ============ */}
        <div className="mb-3 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-2 px-3 py-2">
            <div className="relative w-full max-w-[240px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search material / ID…"
                className="h-9 pl-8 text-sm"
              />
            </div>

            <select
              value={factoryFilter}
              onChange={(e) => {
                setFactoryFilter(e.target.value);
                setPage(1);
              }}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-[#3aa838]/40 focus:ring-2 focus:ring-[#3aa838]/10 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            >
              <option value="all">All factories</option>
              {factories.map((f) => (
                <option key={f._id} value={f._id}>
                  {f.name}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-[#3aa838]/40 focus:ring-2 focus:ring-[#3aa838]/10 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            >
              <option value="all">All status</option>
              <option value="ACTIVE">Active</option>
              <option value="PENDING_APPROVAL">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>

            <select
              value={datePreset}
              onChange={(e) => applyPreset(e.target.value as DatePreset)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-[#3aa838]/40 focus:ring-2 focus:ring-[#3aa838]/10 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
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
              variant="outline"
              size="sm"
              onClick={() => setFiltersOpen((v) => !v)}
              className={cn(
                "h-9 gap-1.5",
                activeFilterCount > 0 &&
                  "border-[#3aa838]/40 bg-[#3aa838]/5 text-[#2f8a2f] dark:border-[#3aa838]/40 dark:bg-[#3aa838]/10 dark:text-[#9bdd91]",
              )}
            >
              <FilterIcon className="h-3.5 w-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-0.5 rounded-full bg-[#3aa838] px-1.5 py-0 text-[10px] font-bold text-white tabular-nums">
                  {activeFilterCount}
                </span>
              )}
              {filtersOpen ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </Button>

            {hasAnyFilter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="h-9 gap-1 text-slate-500"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            )}

            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {total} records
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchWips()}
                disabled={loading}
                className="h-9 w-9 p-0"
                title="Refresh"
              >
                <RefreshCw
                  className={cn("h-3.5 w-3.5", loading && "animate-spin")}
                />
              </Button>
            </div>
          </div>

          {filtersOpen && (
            <div className="grid gap-3 border-t border-slate-200 bg-slate-50/60 px-3 py-3 dark:border-slate-800 dark:bg-slate-950/40 md:grid-cols-3">
              <div className="space-y-1">
                <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  <CalendarRange className="h-3 w-3 text-[#3aa838]" />
                  From date
                </label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => onDateChange("from", e.target.value)}
                  className="h-9 text-xs focus-visible:ring-[#3aa838]/30"
                />
              </div>
              <div className="space-y-1">
                <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  <CalendarRange className="h-3 w-3 text-[#3aa838]" />
                  To date
                </label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => onDateChange("to", e.target.value)}
                  className="h-9 text-xs focus-visible:ring-[#3aa838]/30"
                />
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFromDate("");
                    setToDate("");
                    setDatePreset("");
                    setPage(1);
                  }}
                  className="h-9 w-full gap-1 text-xs"
                >
                  <X className="h-3 w-3" />
                  Clear dates
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ============ TABLE ============ */}
        <Card className="overflow-hidden border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-slate-200 bg-slate-50/80 hover:bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/50">
                    {[
                      "Date",
                      "Raw Material",
                      "Factory",
                      "Issued",
                      "Consumed",
                      "Remaining",
                      "Unit",
                      "Gain/Loss",
                      "Status",
                    ].map((h) => (
                      <TableHead
                        key={h}
                        className={cn(
                          "px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400",
                          ["Issued", "Consumed", "Remaining", "Gain/Loss"].includes(
                            h,
                          ) && "text-right",
                        )}
                      >
                        {h}
                      </TableHead>
                    ))}
                    <TableHead className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="py-12 text-center">
                        <div className="flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Loading WIP records…
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : wips.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="py-16 text-center">
                        <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                          <div className="rounded-2xl bg-slate-100 p-3 dark:bg-slate-800">
                            <Inbox className="h-6 w-6 text-slate-400" />
                          </div>
                          <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            No WIP records found
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {hasAnyFilter
                              ? "Try widening the filters or date range."
                              : "Start a new WIP to get going."}
                          </div>
                          {hasAnyFilter ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={clearAll}
                              className="h-8 gap-1.5 text-xs"
                            >
                              <X className="h-3 w-3" />
                              Clear filters
                            </Button>
                          ) : canCreate ? (
                            <Button
                              size="sm"
                              onClick={() =>
                                router.push("/inventory/material-wip/create")
                              }
                              className="h-8 gap-1.5 bg-[#3aa838] text-xs text-white hover:bg-[#2f8a2f]"
                            >
                              <Plus className="h-3 w-3" />
                              Start New WIP
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    wips.map((wip) => {
                      const netGainLoss =
                        (wip.gainQuantity || 0) -
                        (wip.productionLossQuantity || 0);
                      return (
                        <TableRow
                          key={wip._id}
                          className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/70 dark:border-slate-800 dark:hover:bg-slate-800/30"
                        >
                          <TableCell className="whitespace-nowrap px-3 py-2 text-xs text-slate-600 tabular-nums dark:text-slate-400">
                            {fmtDate(wip.date || wip.createdAt)}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white">
                            {nameOf(wip.rawMaterialId)}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400">
                            {nameOf(wip.factoryId)}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-right text-xs tabular-nums text-slate-700 dark:text-slate-300">
                            {Number(wip.issuedQuantity || 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-right text-xs tabular-nums text-slate-700 dark:text-slate-300">
                            {Number(wip.consumedQuantity || 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-right text-xs tabular-nums text-slate-700 dark:text-slate-300">
                            {Number(wip.remainingQuantity || 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400">
                            {wip.unit}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-right text-xs tabular-nums">
                            <span
                              className={cn(
                                "font-semibold",
                                netGainLoss > 0
                                  ? "text-[#2f8a2f] dark:text-[#9bdd91]"
                                  : netGainLoss < 0
                                    ? "text-rose-600 dark:text-rose-400"
                                    : "text-slate-500 dark:text-slate-400",
                              )}
                            >
                              {netGainLoss > 0 ? "+" : ""}
                              {netGainLoss.toFixed(2)} {wip.unit}
                            </span>
                          </TableCell>
                          <TableCell className="px-3 py-2">
                            {statusBadge(wip.status)}
                          </TableCell>
                          <TableCell className="px-3 py-2">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  router.push(
                                    `/inventory/material-wip/${wip._id}`,
                                  )
                                }
                                title="View"
                                className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                              {canEdit && wip.status === "ACTIVE" && (
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    router.push(
                                      `/inventory/material-wip/${wip._id}/produce`,
                                    )
                                  }
                                  className="h-7 gap-1 bg-[#3aa838] px-2 text-[11px] text-white hover:bg-[#2f8a2f]"
                                >
                                  <Play className="h-3 w-3" />
                                  Produce
                                </Button>
                              )}
                              {canEdit && wip.status === "PENDING_APPROVAL" && (
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    router.push(
                                      `/inventory/material-wip/${wip._id}/produce`,
                                    )
                                  }
                                  className="h-7 gap-1 bg-amber-600 px-2 text-[11px] text-white hover:bg-amber-700"
                                >
                                  <CheckCircle className="h-3 w-3" />
                                  Approve
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {total > 0 && (
              <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50/60 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/40 md:flex-row md:items-center md:justify-between">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Showing{" "}
                  <strong className="text-slate-900 tabular-nums dark:text-white">
                    {(page - 1) * limit + 1}
                  </strong>
                  –
                  <strong className="text-slate-900 tabular-nums dark:text-white">
                    {Math.min(page * limit, total)}
                  </strong>{" "}
                  of{" "}
                  <strong className="text-slate-900 dark:text-white">
                    {total}
                  </strong>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={String(limit)}
                    onChange={(e) => {
                      setLimit(Number(e.target.value));
                      setPage(1);
                    }}
                    className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-[#3aa838]/40 focus:ring-2 focus:ring-[#3aa838]/10 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                  >
                    {[10, 15, 25, 50].map((n) => (
                      <option key={n} value={n}>
                        {n}/page
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="min-w-16 text-center text-xs text-slate-500 dark:text-slate-400">
                    Page{" "}
                    <strong className="text-slate-900 dark:text-white">
                      {page}
                    </strong>{" "}
                    / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}