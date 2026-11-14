"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Plus,
  Search,
  Banknote,
  Wallet,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Eye,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  HelpCircle,
  Receipt,
  RefreshCw,
  Filter as FilterIcon,
  ChevronDown,
  ChevronUp,
  X,
  Check,
  ChevronsUpDown,
} from "lucide-react";

/* ---------- Types ---------- */
type CollectionItem = {
  _id: string;
  voucherNo: string;
  date: string;
  dealers: { dealerName: string }[];
  onlineCopy: {
    onlineCopyNo: string;
    onlineCopyTaka: number;
    bankDepositCharge: number;
  };
  status: string;
  summary: {
    totalDealers: number;
    totalInvoices: number;
    totalMoneyReceipts: number;
    totalMRAmount: number;
    totalCommission: number;
    bankDepositCharge: number;
    totalNetDeposited?: number;
  };
  createdAt: string;
};

type SearchOption = {
  value: string;
  label: string;
  description?: string;
};

/* ---------- Helpers ---------- */
const moneyFmt = (v: any) =>
  Number.isFinite(Number(v ?? 0))
    ? Number(v ?? 0).toLocaleString("en-BD", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "0.00";

const formatDate = (dateStr: string) =>
  dateStr
    ? new Date(dateStr).toLocaleDateString("en-BD", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "-";

const statusConfig: Record<
  string,
  { label: string; cls: string; icon: any }
> = {
  SUBMITTED: {
    label: "Submitted",
    cls: "bg-slate-100 text-slate-700 border-slate-200",
    icon: Clock,
  },
  UNDER_REVIEW: {
    label: "Review",
    cls: "bg-amber-50 text-amber-700 border-amber-200",
    icon: HelpCircle,
  },
  APPROVED: {
    label: "Approved",
    cls: "bg-[#3aa838]/10 text-[#2f8a2f] border-[#3aa838]/30",
    icon: CheckCircle2,
  },
  HOLD: {
    label: "Hold",
    cls: "bg-rose-50 text-rose-700 border-rose-200",
    icon: AlertCircle,
  },
  DISPUTED: {
    label: "Disputed",
    cls: "bg-rose-50 text-rose-700 border-rose-200",
    icon: XCircle,
  },
  CANCELLED: {
    label: "Cancelled",
    cls: "bg-rose-50 text-rose-700 border-rose-200",
    icon: XCircle,
  },
};

const statusEndpoint: Record<string, string> = {
  SUBMITTED: "submit",
  UNDER_REVIEW: "review",
  APPROVED: "approve",
  HOLD: "hold",
  DISPUTED: "dispute",
  CANCELLED: "cancel",
};

const allowedTransitions: Record<string, string[]> = {
  SUBMITTED: ["UNDER_REVIEW", "APPROVED", "HOLD", "DISPUTED", "CANCELLED"],
  UNDER_REVIEW: ["APPROVED", "HOLD", "DISPUTED", "CANCELLED", "SUBMITTED"],
  HOLD: ["SUBMITTED", "UNDER_REVIEW", "DISPUTED", "CANCELLED", "APPROVED"],
  DISPUTED: ["SUBMITTED", "UNDER_REVIEW", "HOLD", "CANCELLED", "APPROVED"],
  APPROVED: [],
  CANCELLED: [],
};

/* ---------- Dealer searchable combobox ---------- */
function DealerFilterSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<SearchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const cache = useRef<Record<string, SearchOption[]>>({});
  const [selected, setSelected] = useState<SearchOption | null>(null);

  useEffect(() => {
    if (!open) return;
    const key = query.trim().toLowerCase();
    const t = setTimeout(async () => {
      if (cache.current[key]) {
        setOptions(cache.current[key]);
        return;
      }
      setLoading(true);
      try {
        const res = await api.get("/dealers", {
          params: { q: query || undefined, page: 1, limit: 30 },
        });
        const list = ((res.data?.data || []) as any[]).map<SearchOption>(
          (d) => ({
            value: String(d._id || d.id),
            label: d.name || d.proprietor || String(d._id || d.id),
            description: [d.phoneNumber || d.phone, d.code, d.status]
              .filter(Boolean)
              .join(" · "),
          }),
        );
        cache.current[key] = list;
        setOptions(list);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [open, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-9 w-full justify-between bg-white text-xs"
        >
          <span className="truncate">
            {selected?.label || (value ? value : "All dealers")}
          </span>
          <ChevronsUpDown className="ml-1.5 h-3.5 w-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0" align="start">
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
              <CommandItem
                value="__all__"
                onSelect={() => {
                  setSelected(null);
                  onChange("");
                  setOpen(false);
                }}
              >
                <Check
                  className={`mr-2 h-3.5 w-3.5 ${
                    !value ? "opacity-100 text-[#3aa838]" : "opacity-0"
                  }`}
                />
                <span className="text-xs font-medium">All dealers</span>
              </CommandItem>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={`${opt.label} ${opt.description || ""}`}
                  onSelect={() => {
                    setSelected(opt);
                    onChange(opt.value);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <Check
                    className={`mr-2 h-3.5 w-3.5 ${
                      opt.value === value
                        ? "opacity-100 text-[#3aa838]"
                        : "opacity-0"
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium">
                      {opt.label}
                    </div>
                    {opt.description && (
                      <div className="truncate text-[10px] text-muted-foreground">
                        {opt.description}
                      </div>
                    )}
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

/* ---------- Invoice searchable combobox ---------- */
function InvoiceFilterSelect({
  dealerId,
  value,
  onChange,
}: {
  dealerId?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<SearchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const cache = useRef<Record<string, SearchOption[]>>({});
  const [selected, setSelected] = useState<SearchOption | null>(null);

  useEffect(() => {
    if (!open) return;
    const key = `${dealerId || ""}|${query.trim().toLowerCase()}`;
    const t = setTimeout(async () => {
      if (cache.current[key]) {
        setOptions(cache.current[key]);
        return;
      }
      setLoading(true);
      try {
        const res = await api.get("/sales-invoices", {
          params: {
            q: query || undefined,
            customerId: dealerId || undefined,
            page: 1,
            limit: 30,
          },
        });
        const list = ((res.data?.data || []) as any[]).map<SearchOption>(
          (inv) => ({
            value: String(inv._id || inv.id),
            label: inv.invoiceNo || String(inv._id || inv.id),
            description: [
              inv.orderId?.orderNo ? `Order ${inv.orderId.orderNo}` : "",
              inv.paymentStatus,
              inv.balanceAmount != null
                ? `Due ৳${Number(inv.balanceAmount || 0).toFixed(2)}`
                : "",
            ]
              .filter(Boolean)
              .join(" · "),
          }),
        );
        cache.current[key] = list;
        setOptions(list);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [open, query, dealerId]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-9 w-full justify-between bg-white text-xs"
        >
          <span className="truncate">
            {selected?.label || (value ? value : "All invoices")}
          </span>
          <ChevronsUpDown className="ml-1.5 h-3.5 w-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search invoice..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? "Loading..." : "No invoice found."}
            </CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__all__"
                onSelect={() => {
                  setSelected(null);
                  onChange("");
                  setOpen(false);
                }}
              >
                <Check
                  className={`mr-2 h-3.5 w-3.5 ${
                    !value ? "opacity-100 text-[#3aa838]" : "opacity-0"
                  }`}
                />
                <span className="text-xs font-medium">All invoices</span>
              </CommandItem>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={`${opt.label} ${opt.description || ""}`}
                  onSelect={() => {
                    setSelected(opt);
                    onChange(opt.value);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <Check
                    className={`mr-2 h-3.5 w-3.5 ${
                      opt.value === value
                        ? "opacity-100 text-[#3aa838]"
                        : "opacity-0"
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="truncate font-mono text-xs font-medium">
                      {opt.label}
                    </div>
                    {opt.description && (
                      <div className="truncate text-[10px] text-muted-foreground">
                        {opt.description}
                      </div>
                    )}
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

/* ---------- Main ---------- */
export default function CollectionsListPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [filters, setFilters] = useState({
    q: "",
    status: "",
    dealerId: "",
    invoiceId: "",
    mrNo: "",
    onlineCopyNo: "",
    date: "",
  });

  const fetchCollections = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit, sort: "-createdAt" };
      if (filters.q) params.q = filters.q;
      if (filters.status && filters.status !== "all")
        params.status = filters.status;
      if (filters.dealerId) params.dealerId = filters.dealerId;
      if (filters.invoiceId) params.invoiceId = filters.invoiceId;
      if (filters.mrNo) params.mrNo = filters.mrNo;
      if (filters.onlineCopyNo) params.onlineCopyNo = filters.onlineCopyNo;
      if (filters.date) params.date = filters.date;

      const res = await api.get("/collection", { params });
      const data = res?.data?.data ?? [];
      setCollections(data);
      setTotal(res?.data?.total ?? 0);
      setTotalPages(res?.data?.totalPages ?? 0);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load collections");
    } finally {
      setLoading(false);
    }
  }, [page, limit, filters]);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  const summaryStats = useMemo(() => {
    const stats = {
      totalCash: 0,
      totalCommission: 0,
      totalBankCharge: 0,
      totalNetDeposit: 0,
    };
    collections.forEach((c) => {
      if (c.summary) {
        stats.totalCash += c.summary.totalMRAmount || 0;
        stats.totalCommission += c.summary.totalCommission || 0;
        stats.totalBankCharge += c.summary.bankDepositCharge || 0;
        const net =
          c.summary.totalNetDeposited ??
          c.summary.totalMRAmount -
            c.summary.totalCommission -
            c.summary.bankDepositCharge;
        stats.totalNetDeposit += net;
      }
    });
    return stats;
  }, [collections]);

  const activeFilterCount =
    (filters.status ? 1 : 0) +
    (filters.date ? 1 : 0) +
    (filters.dealerId ? 1 : 0) +
    (filters.invoiceId ? 1 : 0) +
    (filters.mrNo ? 1 : 0) +
    (filters.onlineCopyNo ? 1 : 0);

  const hasAnyFilter = activeFilterCount > 0 || Boolean(filters.q);

  const clearFilters = () => {
    setFilters({
      q: "",
      status: "",
      dealerId: "",
      invoiceId: "",
      mrNo: "",
      onlineCopyNo: "",
      date: "",
    });
    setPage(1);
  };

  const goToPage = (p: number) => {
    if (p >= 1 && p <= totalPages) setPage(p);
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    const endpoint = statusEndpoint[newStatus];
    if (!endpoint) return;
    try {
      await api.post(`/collection/${id}/status/${endpoint}`);
      toast.success(
        `Status changed to ${statusConfig[newStatus]?.label || newStatus}`,
      );
      fetchCollections();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Status change failed");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl p-3 md:p-4">
        {/* ============ HERO ============ */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#3aa838]/10">
              <Banknote className="h-4 w-4 text-[#3aa838]" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-semibold leading-tight">
                Collections
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Visible</span>
                  <b className="tabular-nums text-slate-900">
                    {collections.length}
                  </b>
                </div>
                <span className="text-slate-300">·</span>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Cash</span>
                  <b className="tabular-nums text-slate-900">
                    ৳ {moneyFmt(summaryStats.totalCash)}
                  </b>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Commission</span>
                  <b className="tabular-nums text-amber-700">
                    ৳ {moneyFmt(summaryStats.totalCommission)}
                  </b>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Bank</span>
                  <b className="tabular-nums text-slate-700">
                    ৳ {moneyFmt(summaryStats.totalBankCharge)}
                  </b>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Net</span>
                  <b className="tabular-nums text-[#2f8a2f]">
                    ৳ {moneyFmt(summaryStats.totalNetDeposit)}
                  </b>
                </div>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchCollections()}
              disabled={loading}
              className="h-8"
              title="Refresh"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
            </Button>
            <Button
              onClick={() => router.push("/accounts/collections/new")}
              size="sm"
              className="h-8 bg-[#3aa838] text-white hover:bg-[#2f8a2f]"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New collection
            </Button>
          </div>
        </div>

        {/* ============ 4 SUMMARY CARDS (Restored Bank Charges) ============ */}
        <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          {[
            {
              label: "Cash collected",
              value: moneyFmt(summaryStats.totalCash),
              icon: Wallet,
              tone: "green" as const,
            },
            {
              label: "Commission",
              value: moneyFmt(summaryStats.totalCommission),
              icon: TrendingUp,
              tone: "amber" as const,
            },
            {
              label: "Bank charges",
              value: moneyFmt(summaryStats.totalBankCharge),
              icon: Receipt,
              tone: "slate" as const,
            },
            {
              label: "Net deposits",
              value: moneyFmt(summaryStats.totalNetDeposit),
              icon: Banknote,
              tone: "green" as const,
            },
          ].map((s) => {
            const toneMap = {
              green: {
                chip: "bg-[#3aa838]/10 text-[#3aa838]",
                num: "text-[#2f8a2f]",
              },
              amber: {
                chip: "bg-amber-50 text-amber-600",
                num: "text-amber-700",
              },
              slate: {
                chip: "bg-slate-100 text-slate-600",
                num: "text-slate-900",
              },
            } as const;
            const t = toneMap[s.tone];
            const Icon = s.icon;
            return (
              <Card
                key={s.label}
                className="overflow-hidden border-slate-200 shadow-sm"
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {s.label}
                      </div>
                      <div
                        className={`mt-1 truncate text-lg font-bold tabular-nums ${t.num}`}
                      >
                        ৳ {s.value}
                      </div>
                    </div>
                    <div className={`shrink-0 rounded-lg p-1.5 ${t.chip}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* ============ FILTER BAR ============ */}
        <div className="mb-3 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-2 px-3 py-2">
            <div className="relative w-full max-w-[240px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Voucher, MR, dealer..."
                value={filters.q}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, q: e.target.value }))
                }
                className="h-9 pl-8 text-sm focus-visible:ring-[#3aa838]"
              />
            </div>

            <Select
              value={filters.status || "all"}
              onValueChange={(val) =>
                setFilters((f) => ({
                  ...f,
                  status: val === "all" ? "" : val,
                }))
              }
            >
              <SelectTrigger className="h-9 w-[140px] text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                {Object.keys(statusConfig).map((s) => (
                  <SelectItem key={s} value={s}>
                    {statusConfig[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={filters.date}
              onChange={(e) =>
                setFilters((f) => ({ ...f, date: e.target.value }))
              }
              className="h-9 w-[140px] text-xs focus-visible:ring-[#3aa838]"
            />

            <Button
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

          {filtersOpen && (
            <div className="grid gap-3 border-t border-slate-200 bg-slate-50/60 px-3 py-3 md:grid-cols-4">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-600">
                  Dealer
                </label>
                <DealerFilterSelect
                  value={filters.dealerId}
                  onChange={(v) => {
                    setFilters((f) => ({
                      ...f,
                      dealerId: v,
                      invoiceId: "",
                    }));
                    setPage(1);
                  }}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-600">
                  Invoice
                </label>
                <InvoiceFilterSelect
                  dealerId={filters.dealerId || undefined}
                  value={filters.invoiceId}
                  onChange={(v) =>
                    setFilters((f) => ({ ...f, invoiceId: v }))
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-600">
                  MR No
                </label>
                <Input
                  value={filters.mrNo}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, mrNo: e.target.value }))
                  }
                  className="h-9 text-xs focus-visible:ring-[#3aa838]"
                  placeholder="MR No"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-600">
                  Online copy
                </label>
                <Input
                  value={filters.onlineCopyNo}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, onlineCopyNo: e.target.value }))
                  }
                  className="h-9 text-xs focus-visible:ring-[#3aa838]"
                  placeholder="OC No"
                />
              </div>
            </div>
          )}
        </div>

        {/* ============ TABLE ============ */}
        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    {[
                      "Voucher",
                      "Date",
                      "Dealers",
                      "Online copy",
                      "Cash",
                      "Commission",
                      "Net deposit",
                      "Status",
                    ].map((h) => (
                      <TableHead
                        key={h}
                        className={`border-b border-slate-200 px-3 py-2.5 text-[10px] font-medium uppercase tracking-wide text-slate-600 ${
                          ["Cash", "Commission", "Net deposit"].includes(h)
                            ? "text-right"
                            : ""
                        }`}
                      >
                        {h}
                      </TableHead>
                    ))}
                    <TableHead className="border-b border-slate-200 px-3 py-2.5 text-right text-[10px] font-medium uppercase tracking-wide text-slate-600">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-12 text-center">
                        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading collections...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : collections.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-16 text-center">
                        <div className="mx-auto flex max-w-sm flex-col items-center gap-3 text-muted-foreground">
                          <div className="rounded-full bg-slate-100 p-3">
                            <Banknote className="h-6 w-6" />
                          </div>
                          <div className="text-sm font-medium text-slate-700">
                            No collections found
                          </div>
                          <div className="text-xs">
                            {hasAnyFilter
                              ? "Try adjusting your filters."
                              : "Create your first collection to get started."}
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
                              onClick={() =>
                                router.push("/accounts/collections/new")
                              }
                              className="bg-[#3aa838] text-white hover:bg-[#2f8a2f]"
                            >
                              <Plus className="mr-1.5 h-3.5 w-3.5" />
                              New collection
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    collections.map((coll) => {
                      const summary = coll.summary || {};
                      const netDeposit =
                        summary.totalNetDeposited ??
                        summary.totalMRAmount -
                          summary.totalCommission -
                          summary.bankDepositCharge;
                      const stat = statusConfig[coll.status] || {
                        label: coll.status,
                        cls: "bg-slate-100 text-slate-700 border-slate-200",
                        icon: Clock,
                      };
                      const StatIcon = stat.icon;
                      const dealerNames =
                        coll.dealers?.map((d) => d.dealerName).join(", ") ||
                        "-";
                      const canChange =
                        allowedTransitions[coll.status]?.length > 0;

                      return (
                        <TableRow
                          key={coll._id}
                          className="border-b border-slate-100 last:border-0 transition-colors hover:bg-slate-50/70"
                        >
                          <TableCell className="px-3 py-2 font-mono text-xs font-semibold text-slate-900">
                            {coll.voucherNo}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-xs text-slate-600 tabular-nums">
                            {formatDate(coll.date)}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate px-3 py-2 text-xs text-slate-700">
                            {dealerNames}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-xs text-slate-600">
                            {coll.onlineCopy?.onlineCopyNo || "-"}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-right text-xs font-semibold tabular-nums text-slate-900">
                            ৳ {moneyFmt(summary.totalMRAmount || 0)}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-right text-xs font-semibold tabular-nums text-amber-700">
                            ৳ {moneyFmt(summary.totalCommission || 0)}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-right text-xs font-semibold tabular-nums text-[#2f8a2f]">
                            ৳ {moneyFmt(netDeposit)}
                          </TableCell>
                          <TableCell className="px-3 py-2">
                            <Badge
                              className={`inline-flex items-center gap-1 border text-[10px] font-semibold ${stat.cls}`}
                            >
                              <StatIcon className="h-2.5 w-2.5" />
                              {stat.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-3 py-2">
                            <div className="flex items-center justify-end gap-0.5">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() =>
                                  router.push(
                                    `/accounts/collections/${coll._id}`,
                                  )
                                }
                                className="h-7 w-7"
                                title="View"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              {canChange &&
                                coll.status !== "APPROVED" &&
                                coll.status !== "CANCELLED" && (
                                  <Select
                                    onValueChange={(val) =>
                                      handleStatusChange(coll._id, val)
                                    }
                                  >
                                    <SelectTrigger className="h-7 w-7 border-0 p-0 hover:bg-slate-100 [&>svg]:hidden">
                                      <span className="flex items-center justify-center">
                                        <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
                                      </span>
                                    </SelectTrigger>
                                    <SelectContent>
                                      {allowedTransitions[coll.status]?.map(
                                        (ns) => (
                                          <SelectItem key={ns} value={ns}>
                                            {statusConfig[ns]?.label || ns}
                                          </SelectItem>
                                        ),
                                      )}
                                    </SelectContent>
                                  </Select>
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

            {!loading && total > 0 && (
              <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50/60 px-3 py-2 md:flex-row md:items-center md:justify-between">
                <div className="text-xs text-muted-foreground">
                  Showing{" "}
                  <strong className="text-slate-900 tabular-nums">
                    {Math.min((page - 1) * limit + 1, total)}
                  </strong>{" "}
                  –{" "}
                  <strong className="text-slate-900 tabular-nums">
                    {Math.min(page * limit, total)}
                  </strong>{" "}
                  of <strong className="text-slate-900">{total}</strong>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Page <strong className="text-slate-900">{page}</strong> /{" "}
                    {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    disabled={page <= 1}
                    onClick={() => goToPage(page - 1)}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    disabled={page >= totalPages}
                    onClick={() => goToPage(page + 1)}
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