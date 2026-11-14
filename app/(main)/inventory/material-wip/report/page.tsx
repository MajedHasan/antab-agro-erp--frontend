// app/inventory/material-wip/report/page.tsx
"use client";

import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  ArrowLeft,
  RefreshCw,
  Search,
  Download,
  TrendingUp,
  Boxes,
  Scale,
  Activity,
  Package,
  PieChart as PieChartIcon,
  BarChart3,
  LineChart as LineChartIcon,
  Filter as FilterIcon,
  ChevronDown,
  ChevronUp,
  X,
  Check,
  ChevronsUpDown,
  Factory,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------- palette ---------- */
const GREEN = "#3aa838";
const GREEN_DARK = "#2f8a2f";
const GREEN_LIGHT = "#7cd67a";
const GREEN_PALE = "#c6e8c5";
const AMBER = "#f59e0b";
const ROSE = "#ef4444";
const SLATE = "#64748b";

/* ---------- types ---------- */
type FactoryType = { _id: string; name: string; code?: string };
type RawMaterialType = {
  _id: string;
  name: string;
  sku?: string;
  unit?: string;
};
type ProductType = {
  _id: string;
  name: string;
  sku?: string;
  unit?: string;
};
type PackagingItemType = {
  _id: string;
  name: string;
  sku?: string;
  unit?: string;
};

type SummaryType = {
  totalRecords: number;
  totalIssuedQuantity: number;
  totalReturnedQuantity: number;
  totalConsumedQuantity: number;
  totalExpectedRawUsed: number;
  totalAllowedWastageRawUsed: number;
  totalActualRawUsed: number;
  totalGainQuantity: number;
  totalNormalWastageQuantity: number;
  totalProductionLossQuantity: number;
  totalRawMaterialCost: number;
  totalPackagingMaterialCost: number;
  totalOtherMaterialCost: number;
  totalInputCost: number;
  totalFinishedGoodsCost: number;
  activeCount: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
};

type TrendRow = {
  label: string;
  totalRecords: number;
  issued: number;
  returned: number;
  consumed: number;
  expected: number;
  actual: number;
  gain: number;
  wastage: number;
  loss: number;
  inputCost: number;
  finishedGoodsCost: number;
};

type WiseRow = {
  rawMaterialId?: string;
  packagingItemId?: string;
  productId?: string;
  rawMaterialName?: string | null;
  packagingItemName?: string | null;
  productName?: string | null;
  sku?: string | null;
  unit?: string | null;
  wipCount: number;
  totalIssuedQuantity?: number;
  totalReturnedQuantity?: number;
  totalConsumedQuantity?: number;
  totalExpectedRawUsed?: number;
  totalAllowedWastageRawUsed?: number;
  totalActualRawUsed?: number;
  totalGainQuantity?: number;
  totalNormalWastageQuantity?: number;
  totalProductionLossQuantity?: number;
  totalRawMaterialCost?: number;
  totalPackagingMaterialCost?: number;
  totalOtherMaterialCost?: number;
  totalInputCost?: number;
  totalFinishedGoodsCost?: number;
  totalQtyProduced?: number;
  usedQty?: number;
  totalCost?: number;
  avgUnitCost?: number;
};

type SearchOption = {
  value: string;
  label: string;
  description?: string;
  searchText?: string;
};

/* ---------- helpers ---------- */
const money = (v: any) =>
  `৳ ${Number(v || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const qtyText = (v: any) =>
  Number(v || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    ACTIVE: "bg-slate-100 text-slate-700 border-slate-200",
    PENDING_APPROVAL: "bg-amber-50 text-amber-700 border-amber-200",
    APPROVED: "bg-[#3aa838]/10 text-[#2f8a2f] border-[#3aa838]/30",
    REJECTED: "bg-rose-50 text-rose-700 border-rose-200",
  };
  return (
    <Badge
      className={cn(
        "border text-[10px] font-semibold",
        map[status] || "bg-slate-100 text-slate-700",
      )}
    >
      {status === "PENDING_APPROVAL" ? "PENDING" : status}
    </Badge>
  );
};

/* ---------- searchable select ---------- */
function SearchableSelect({
  value,
  selectedLabel,
  options,
  onPick,
  placeholder,
  searchPlaceholder,
  icon: Icon,
}: {
  value?: string;
  selectedLabel?: string;
  options: SearchOption[];
  onPick: (opt: SearchOption) => void;
  placeholder: string;
  searchPlaceholder: string;
  icon?: React.ElementType;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-9 w-full justify-between bg-white text-xs"
        >
          <span className="truncate">{selectedLabel || placeholder}</span>
          <div className="ml-2 flex shrink-0 items-center gap-1">
            {Icon && <Icon className="h-3.5 w-3.5 opacity-40" />}
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start" sideOffset={4}>
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={`${opt.label} ${opt.description || ""} ${
                    opt.searchText || ""
                  }`}
                  onSelect={() => {
                    onPick(opt);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-3.5 w-3.5 shrink-0",
                      opt.value === value
                        ? "opacity-100 text-[#3aa838]"
                        : "opacity-0",
                    )}
                  />
                  <div className="min-w-0 flex-1">
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

/* ---------- stat card ---------- */
function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  loading,
  tone = "green",
}: {
  title: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon: React.ElementType;
  loading?: boolean;
  tone?: "green" | "amber" | "rose" | "slate";
}) {
  const toneMap = {
    green: {
      chip: "bg-[#3aa838]/10 text-[#3aa838]",
      num: "text-[#2f8a2f]",
    },
    amber: { chip: "bg-amber-50 text-amber-600", num: "text-amber-700" },
    rose: { chip: "bg-rose-50 text-rose-600", num: "text-rose-700" },
    slate: { chip: "bg-slate-100 text-slate-600", num: "text-slate-900" },
  } as const;
  const t = toneMap[tone];

  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {title}
            </div>
            <div
              className={`mt-1 truncate text-lg font-bold tabular-nums ${t.num}`}
            >
              {loading ? "..." : value}
            </div>
            {sub && (
              <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                {sub}
              </div>
            )}
          </div>
          <div className={`shrink-0 rounded-lg p-1.5 ${t.chip}`}>
            <Icon className="h-3.5 w-3.5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- chart shell ---------- */
function ChartCard({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-2.5">
        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          {subtitle && (
            <div className="text-[11px] text-muted-foreground">
              {subtitle}
            </div>
          )}
        </div>
        {action}
      </div>
      <CardContent className="p-4">{children}</CardContent>
    </Card>
  );
}

/* ---------- main ---------- */
export default function MaterialWipReportPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  const [factories, setFactories] = useState<FactoryType[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterialType[]>([]);
  const [products, setProducts] = useState<ProductType[]>([]);
  const [packagingItems, setPackagingItems] = useState<PackagingItemType[]>(
    [],
  );

  const [summary, setSummary] = useState<SummaryType | null>(null);
  const [trend, setTrend] = useState<TrendRow[]>([]);
  const [rawWise, setRawWise] = useState<WiseRow[]>([]);
  const [productWise, setProductWise] = useState<WiseRow[]>([]);
  const [packWise, setPackWise] = useState<WiseRow[]>([]);

  const [filtersOpen, setFiltersOpen] = useState(false);

  const [filters, setFilters] = useState({
    factoryId: "all",
    rawMaterialId: "all",
    productId: "all",
    packagingItemId: "all",
    status: "all",
    preset: "thisMonth",
    groupBy: "day",
    fromDate: "",
    toDate: "",
    q: "",
  });

  const queryParams = useMemo(
    () => ({
      preset: filters.preset !== "all" ? filters.preset : undefined,
      groupBy: filters.groupBy,
      factoryId: filters.factoryId !== "all" ? filters.factoryId : undefined,
      rawMaterialId:
        filters.rawMaterialId !== "all" ? filters.rawMaterialId : undefined,
      productId: filters.productId !== "all" ? filters.productId : undefined,
      packagingItemId:
        filters.packagingItemId !== "all"
          ? filters.packagingItemId
          : undefined,
      status: filters.status !== "all" ? filters.status : undefined,
      fromDate: filters.fromDate || undefined,
      toDate: filters.toDate || undefined,
      q: filters.q.trim() || undefined,
    }),
    [filters],
  );

  const loadLookups = useCallback(async () => {
    try {
      const [fRes, rmRes, pRes, packRes] = await Promise.all([
        api.get("/warehouses", { params: { type: "Factory", limit: 1000 } }),
        api.get("/raw-materials", { params: { limit: 2000 } }),
        api.get("/products", { params: { limit: 2000 } }),
        api.get("/packaging-items", { params: { limit: 2000 } }),
      ]);
      setFactories(fRes.data?.data || []);
      setRawMaterials(rmRes.data?.data || []);
      setProducts(pRes.data?.data || []);
      setPackagingItems(packRes.data?.data || []);
    } catch {
      toast.error("Failed to load filters");
    }
  }, []);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, trendRes, rawWiseRes, productWiseRes, packWiseRes] =
        await Promise.all([
          api.get("/wip-reports/summary", { params: queryParams }),
          api.get("/wip-reports/trend", { params: queryParams }),
          api.get("/wip-reports/raw-material-wise", { params: queryParams }),
          api.get("/wip-reports/product-wise", { params: queryParams }),
          api.get("/wip-reports/packaging-wise", { params: queryParams }),
        ]);
      setSummary(summaryRes.data?.data || null);
      setTrend(Array.isArray(trendRes.data?.data) ? trendRes.data.data : []);
      setRawWise(
        Array.isArray(rawWiseRes.data?.data) ? rawWiseRes.data.data : [],
      );
      setProductWise(
        Array.isArray(productWiseRes.data?.data)
          ? productWiseRes.data.data
          : [],
      );
      setPackWise(
        Array.isArray(packWiseRes.data?.data) ? packWiseRes.data.data : [],
      );
    } catch {
      toast.error("Failed to load WIP report");
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const resetFilters = () =>
    setFilters({
      factoryId: "all",
      rawMaterialId: "all",
      productId: "all",
      packagingItemId: "all",
      status: "all",
      preset: "thisMonth",
      groupBy: "day",
      fromDate: "",
      toDate: "",
      q: "",
    });

  const activeFilterCount =
    (filters.factoryId !== "all" ? 1 : 0) +
    (filters.rawMaterialId !== "all" ? 1 : 0) +
    (filters.productId !== "all" ? 1 : 0) +
    (filters.packagingItemId !== "all" ? 1 : 0) +
    (filters.status !== "all" ? 1 : 0) +
    (filters.fromDate || filters.toDate ? 1 : 0);

  const hasAnyFilter = activeFilterCount > 0 || Boolean(filters.q);

  /* derived chart data */
  const trendChart = useMemo(
    () =>
      trend.map((r) => ({
        label: r.label,
        issued: Number(r.issued || 0),
        returned: Number(r.returned || 0),
        consumed: Number(r.consumed || 0),
        expected: Number(r.expected || 0),
        actual: Number(r.actual || 0),
        gain: Number(r.gain || 0),
        wastage: Number(r.wastage || 0),
        loss: Number(r.loss || 0),
        inputCost: Number(r.inputCost || 0),
        finishedGoodsCost: Number(r.finishedGoodsCost || 0),
      })),
    [trend],
  );

  const statusPie = useMemo(
    () =>
      [
        { name: "Active", value: summary?.activeCount || 0, color: SLATE },
        { name: "Pending", value: summary?.pendingCount || 0, color: AMBER },
        { name: "Approved", value: summary?.approvedCount || 0, color: GREEN },
        { name: "Rejected", value: summary?.rejectedCount || 0, color: ROSE },
      ].filter((x) => x.value > 0),
    [summary],
  );

  const costPie = useMemo(
    () =>
      [
        {
          name: "Raw",
          value: summary?.totalRawMaterialCost || 0,
          color: GREEN,
        },
        {
          name: "Packaging",
          value: summary?.totalPackagingMaterialCost || 0,
          color: GREEN_DARK,
        },
        {
          name: "Other",
          value: summary?.totalOtherMaterialCost || 0,
          color: SLATE,
        },
      ].filter((x) => x.value > 0),
    [summary],
  );

  /* searchable options */
  const factoryOptions = useMemo<SearchOption[]>(
    () => [
      { value: "all", label: "All factories" },
      ...factories.map<SearchOption>((f) => ({
        value: f._id,
        label: f.name,
        description: f.code ? `Code: ${f.code}` : undefined,
      })),
    ],
    [factories],
  );

  const rawMaterialOptions = useMemo<SearchOption[]>(
    () => [
      { value: "all", label: "All raw materials" },
      ...rawMaterials.map<SearchOption>((m) => ({
        value: m._id,
        label: m.name,
        description: [m.unit, m.sku].filter(Boolean).join(" · "),
        searchText: m.sku,
      })),
    ],
    [rawMaterials],
  );

  const productOptions = useMemo<SearchOption[]>(
    () => [
      { value: "all", label: "All products" },
      ...products.map<SearchOption>((p) => ({
        value: p._id,
        label: p.name,
        description: [p.unit, p.sku].filter(Boolean).join(" · "),
        searchText: p.sku,
      })),
    ],
    [products],
  );

  const packagingOptions = useMemo<SearchOption[]>(
    () => [
      { value: "all", label: "All packaging" },
      ...packagingItems.map<SearchOption>((p) => ({
        value: p._id,
        label: p.name,
        description: [p.unit, p.sku].filter(Boolean).join(" · "),
        searchText: p.sku,
      })),
    ],
    [packagingItems],
  );

  /* render */
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl p-3 md:p-4">
        {/* ============ HERO ============ */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => router.back()}
              className="h-8 w-8"
              title="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3aa838]/10">
              <TrendingUp className="h-4 w-4 text-[#3aa838]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-semibold leading-tight">
                WIP Analytics
              </h1>
              <p className="truncate text-[11px] text-muted-foreground">
                {summary
                  ? `${summary.totalRecords} records · ${qtyText(
                      summary.totalIssuedQuantity,
                    )} issued`
                  : "Production insights & material efficiency"}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadReport}
              disabled={loading}
              className="h-8"
              title="Refresh"
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", loading && "animate-spin")}
              />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="h-8"
              title="Print"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* ============ FILTER BAR ============ */}
        <div className="mb-3 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-2 px-3 py-2">
            <div className="relative w-full max-w-[240px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search material / product..."
                value={filters.q}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, q: e.target.value }))
                }
                className="h-9 pl-8 text-sm focus-visible:ring-[#3aa838]"
              />
            </div>

            <select
              value={filters.preset}
              onChange={(e) =>
                setFilters((p) => ({ ...p, preset: e.target.value }))
              }
              className="h-9 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-[#3aa838]"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="thisWeek">This week</option>
              <option value="lastWeek">Last week</option>
              <option value="thisMonth">This month</option>
              <option value="lastMonth">Last month</option>
              <option value="thisYear">This year</option>
              <option value="lastYear">Last year</option>
              <option value="all">All time</option>
            </select>

            <select
              value={filters.groupBy}
              onChange={(e) =>
                setFilters((p) => ({ ...p, groupBy: e.target.value }))
              }
              className="h-9 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-[#3aa838]"
            >
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
              <option value="year">Yearly</option>
            </select>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFiltersOpen((v) => !v)}
              className={cn(
                "h-9",
                activeFilterCount > 0 &&
                  "border-[#3aa838]/40 bg-[#3aa838]/5 text-[#2f8a2f]",
              )}
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
                onClick={resetFilters}
                className="h-9 text-slate-500"
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Clear
              </Button>
            )}
          </div>

          {filtersOpen && (
            <div className="grid gap-3 border-t border-slate-200 bg-slate-50/60 px-3 py-3 md:grid-cols-4">
              {/* From */}
              <div className="space-y-1">
                <Label className="text-[11px] text-slate-600">From</Label>
                <Input
                  type="date"
                  value={filters.fromDate}
                  onChange={(e) =>
                    setFilters((p) => ({ ...p, fromDate: e.target.value }))
                  }
                  className="h-9 text-xs focus-visible:ring-[#3aa838]"
                />
              </div>

              {/* To */}
              <div className="space-y-1">
                <Label className="text-[11px] text-slate-600">To</Label>
                <Input
                  type="date"
                  value={filters.toDate}
                  onChange={(e) =>
                    setFilters((p) => ({ ...p, toDate: e.target.value }))
                  }
                  className="h-9 text-xs focus-visible:ring-[#3aa838]"
                />
              </div>

              {/* Factory */}
              <div className="space-y-1">
                <Label className="text-[11px] text-slate-600">Factory</Label>
                <SearchableSelect
                  value={filters.factoryId}
                  selectedLabel={
                    filters.factoryId === "all"
                      ? "All factories"
                      : factories.find((f) => f._id === filters.factoryId)?.name
                  }
                  options={factoryOptions}
                  onPick={(opt) =>
                    setFilters((p) => ({ ...p, factoryId: opt.value }))
                  }
                  placeholder="All factories"
                  searchPlaceholder="Search factory..."
                  icon={Factory}
                />
              </div>

              {/* Status */}
              <div className="space-y-1">
                <Label className="text-[11px] text-slate-600">Status</Label>
                <select
                  value={filters.status}
                  onChange={(e) =>
                    setFilters((p) => ({ ...p, status: e.target.value }))
                  }
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-[#3aa838]"
                >
                  <option value="all">All status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="PENDING_APPROVAL">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>

              {/* Raw material */}
              <div className="space-y-1">
                <Label className="text-[11px] text-slate-600">
                  Raw material
                </Label>
                <SearchableSelect
                  value={filters.rawMaterialId}
                  selectedLabel={
                    filters.rawMaterialId === "all"
                      ? "All raw materials"
                      : rawMaterials.find(
                          (m) => m._id === filters.rawMaterialId,
                        )?.name
                  }
                  options={rawMaterialOptions}
                  onPick={(opt) =>
                    setFilters((p) => ({ ...p, rawMaterialId: opt.value }))
                  }
                  placeholder="All raw materials"
                  searchPlaceholder="Search raw material..."
                  icon={Search}
                />
              </div>

              {/* Product */}
              <div className="space-y-1">
                <Label className="text-[11px] text-slate-600">Product</Label>
                <SearchableSelect
                  value={filters.productId}
                  selectedLabel={
                    filters.productId === "all"
                      ? "All products"
                      : products.find((p) => p._id === filters.productId)?.name
                  }
                  options={productOptions}
                  onPick={(opt) =>
                    setFilters((p) => ({ ...p, productId: opt.value }))
                  }
                  placeholder="All products"
                  searchPlaceholder="Search product..."
                  icon={Package}
                />
              </div>

              {/* Packaging */}
              <div className="space-y-1">
                <Label className="text-[11px] text-slate-600">Packaging</Label>
                <SearchableSelect
                  value={filters.packagingItemId}
                  selectedLabel={
                    filters.packagingItemId === "all"
                      ? "All packaging"
                      : packagingItems.find(
                          (p) => p._id === filters.packagingItemId,
                        )?.name
                  }
                  options={packagingOptions}
                  onPick={(opt) =>
                    setFilters((p) => ({ ...p, packagingItemId: opt.value }))
                  }
                  placeholder="All packaging"
                  searchPlaceholder="Search packaging..."
                  icon={Boxes}
                />
              </div>
            </div>
          )}
        </div>

        {/* ============ STAT CARDS ============ */}
        <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          <StatCard
            title="WIP Records"
            value={summary?.totalRecords ?? 0}
            sub={`${summary?.activeCount || 0} active · ${
              summary?.pendingCount || 0
            } pending`}
            icon={Activity}
            loading={loading}
            tone="slate"
          />
          <StatCard
            title="Raw Issued"
            value={qtyText(summary?.totalIssuedQuantity ?? 0)}
            sub={`Returned ${qtyText(summary?.totalReturnedQuantity ?? 0)}`}
            icon={Scale}
            loading={loading}
            tone="green"
          />
          <StatCard
            title="Finished Cost"
            value={money(summary?.totalFinishedGoodsCost ?? 0)}
            sub={`Input ${money(summary?.totalInputCost ?? 0)}`}
            icon={Package}
            loading={loading}
            tone="green"
          />
          <StatCard
            title="Efficiency"
            value={
              summary && summary.totalExpectedRawUsed > 0
                ? `${qtyText(
                    (summary.totalActualRawUsed /
                      summary.totalExpectedRawUsed) *
                      100,
                  )}%`
                : "0%"
            }
            sub={`Gain ${qtyText(
              summary?.totalGainQuantity ?? 0,
            )} · Loss ${qtyText(summary?.totalProductionLossQuantity ?? 0)}`}
            icon={TrendingUp}
            loading={loading}
            tone="amber"
          />
        </div>

        {/* ============ TABS ============ */}
        <Tabs defaultValue="overview" className="space-y-3">
          <TabsList className="grid w-full max-w-lg grid-cols-4 border border-slate-200 bg-white">
            <TabsTrigger
              value="overview"
              className="text-xs data-[state=active]:bg-[#3aa838] data-[state=active]:text-white"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="materials"
              className="text-xs data-[state=active]:bg-[#3aa838] data-[state=active]:text-white"
            >
              Materials
            </TabsTrigger>
            <TabsTrigger
              value="products"
              className="text-xs data-[state=active]:bg-[#3aa838] data-[state=active]:text-white"
            >
              Products
            </TabsTrigger>
            <TabsTrigger
              value="packaging"
              className="text-xs data-[state=active]:bg-[#3aa838] data-[state=active]:text-white"
            >
              Packaging
            </TabsTrigger>
          </TabsList>

          {/* -------- OVERVIEW -------- */}
          <TabsContent value="overview" className="space-y-3">
            <div className="grid gap-3 xl:grid-cols-2">
              <ChartCard
                title="Production trend"
                subtitle="Issued, consumed, expected vs actual"
                action={<LineChartIcon className="h-4 w-4 text-slate-400" />}
              >
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: any) => qtyText(v)} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line
                        type="monotone"
                        dataKey="issued"
                        stroke={GREEN}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="consumed"
                        stroke={GREEN_DARK}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="expected"
                        stroke={AMBER}
                        strokeWidth={2}
                        dot={false}
                        strokeDasharray="4 4"
                      />
                      <Line
                        type="monotone"
                        dataKey="actual"
                        stroke={ROSE}
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard
                title="Status distribution"
                subtitle="WIP lifecycle"
                action={<PieChartIcon className="h-4 w-4 text-slate-400" />}
              >
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusPie}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={110}
                        label
                      >
                        {statusPie.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            </div>

            <div className="grid gap-3 xl:grid-cols-2">
              <ChartCard
                title="Cost composition"
                subtitle="Raw vs packaging vs other"
                action={<BarChart3 className="h-4 w-4 text-slate-400" />}
              >
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={costPie}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: any) => money(v)} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {costPie.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard
                title="Gain / wastage / loss"
                subtitle="Manufacturing variance"
                action={<TrendingUp className="h-4 w-4 text-slate-400" />}
              >
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Area
                        type="monotone"
                        dataKey="gain"
                        stackId="1"
                        stroke={GREEN}
                        fill={GREEN_PALE}
                      />
                      <Area
                        type="monotone"
                        dataKey="wastage"
                        stackId="2"
                        stroke={AMBER}
                        fill="#fde68a"
                      />
                      <Area
                        type="monotone"
                        dataKey="loss"
                        stackId="3"
                        stroke={ROSE}
                        fill="#fecaca"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            </div>
          </TabsContent>

          {/* -------- MATERIALS -------- */}
          <TabsContent value="materials" className="space-y-3">
            <ChartCard
              title="Raw material performance"
              subtitle="Top raw materials by consumed / gain / loss"
              action={<Boxes className="h-4 w-4 text-slate-400" />}
            >
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rawWise.slice(0, 12)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="rawMaterialName"
                      width={160}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip formatter={(v: any) => qtyText(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar
                      dataKey="totalConsumedQuantity"
                      name="Consumed"
                      fill={GREEN}
                      radius={[0, 6, 6, 0]}
                    />
                    <Bar
                      dataKey="totalGainQuantity"
                      name="Gain"
                      fill={GREEN_LIGHT}
                      radius={[0, 6, 6, 0]}
                    />
                    <Bar
                      dataKey="totalProductionLossQuantity"
                      name="Loss"
                      fill={ROSE}
                      radius={[0, 6, 6, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <div className="grid gap-3 xl:grid-cols-2">
              <Card className="overflow-hidden border-slate-200 shadow-sm">
                <div className="border-b border-slate-200 px-4 py-2.5">
                  <div className="text-sm font-semibold">
                    Raw material ranking
                  </div>
                </div>
                <CardContent className="space-y-2 p-3">
                  {rawWise.slice(0, 8).map((row, index) => (
                    <div
                      key={String(row.rawMaterialId)}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-2 py-1.5 hover:bg-slate-50"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#3aa838]/10 text-[10px] font-bold text-[#2f8a2f]">
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-slate-900">
                            {row.rawMaterialName || "-"}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {row.sku || "-"} · {row.unit || "-"}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold tabular-nums text-slate-900">
                          {qtyText(row.totalConsumedQuantity)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {money(row.totalRawMaterialCost)}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="overflow-hidden border-slate-200 shadow-sm">
                <div className="border-b border-slate-200 px-4 py-2.5">
                  <div className="text-sm font-semibold">
                    Material summary
                  </div>
                </div>
                <CardContent className="space-y-2 p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expected raw</span>
                    <span className="tabular-nums">
                      {qtyText(summary?.totalExpectedRawUsed || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Allowed wastage
                    </span>
                    <span className="tabular-nums">
                      {qtyText(summary?.totalAllowedWastageRawUsed || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Actual raw</span>
                    <span className="font-medium tabular-nums text-slate-900">
                      {qtyText(summary?.totalActualRawUsed || 0)}
                    </span>
                  </div>
                  <div className="my-1 h-px bg-slate-200" />
                  <div className="flex justify-between">
                    <span className="text-[#2f8a2f]">Gain</span>
                    <span className="font-semibold tabular-nums text-[#2f8a2f]">
                      +{qtyText(summary?.totalGainQuantity || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-700">Normal wastage</span>
                    <span className="font-semibold tabular-nums text-amber-700">
                      {qtyText(summary?.totalNormalWastageQuantity || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-rose-700">Production loss</span>
                    <span className="font-semibold tabular-nums text-rose-700">
                      -{qtyText(summary?.totalProductionLossQuantity || 0)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* -------- PRODUCTS -------- */}
          <TabsContent value="products" className="space-y-3">
            <ChartCard
              title="Finished product costing"
              subtitle="Cost breakdown by product"
              action={<Package className="h-4 w-4 text-slate-400" />}
            >
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={productWise.slice(0, 12)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="productName"
                      tick={{ fontSize: 11 }}
                      angle={-20}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => money(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar
                      dataKey="totalRawMaterialCost"
                      name="Raw"
                      fill={GREEN}
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      dataKey="totalPackagingMaterialCost"
                      name="Packaging"
                      fill={AMBER}
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      dataKey="totalOtherMaterialCost"
                      name="Other"
                      fill={SLATE}
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <div className="grid gap-3 xl:grid-cols-2">
              <Card className="overflow-hidden border-slate-200 shadow-sm">
                <div className="border-b border-slate-200 px-4 py-2.5">
                  <div className="text-sm font-semibold">
                    Top finished products
                  </div>
                </div>
                <CardContent className="space-y-2 p-3">
                  {productWise.slice(0, 8).map((row, index) => (
                    <div
                      key={String(row.productId)}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-2 py-1.5 hover:bg-slate-50"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#3aa838]/10 text-[10px] font-bold text-[#2f8a2f]">
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-slate-900">
                            {row.productName || "-"}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {row.sku || "-"} · Qty{" "}
                            {qtyText(row.totalQtyProduced)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold tabular-nums text-[#2f8a2f]">
                          {money(row.totalCost)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {money(row.avgUnitCost)} avg
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="overflow-hidden border-slate-200 shadow-sm">
                <div className="border-b border-slate-200 px-4 py-2.5">
                  <div className="text-sm font-semibold">
                    Product cost mix
                  </div>
                </div>
                <CardContent className="h-[300px] p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={productWise.slice(0, 6).map((r, i) => ({
                          name: r.productName || "-",
                          value: Number(r.totalCost || 0),
                          color: [
                            GREEN,
                            GREEN_DARK,
                            GREEN_LIGHT,
                            AMBER,
                            SLATE,
                            ROSE,
                          ][i % 6],
                        }))}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label
                      >
                        {productWise.slice(0, 6).map((_, i) => (
                          <Cell
                            key={i}
                            fill={
                              [
                                GREEN,
                                GREEN_DARK,
                                GREEN_LIGHT,
                                AMBER,
                                SLATE,
                                ROSE,
                              ][i % 6]
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => money(v)} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* -------- PACKAGING -------- */}
          <TabsContent value="packaging" className="space-y-3">
            <ChartCard
              title="Packaging usage"
              subtitle="Quantity & cost"
              action={<Boxes className="h-4 w-4 text-slate-400" />}
            >
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={packWise.slice(0, 12)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="packagingItemName"
                      width={160}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip formatter={(v: any) => qtyText(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar
                      dataKey="usedQty"
                      name="Used Qty"
                      fill={GREEN}
                      radius={[0, 6, 6, 0]}
                    />
                    <Bar
                      dataKey="totalCost"
                      name="Cost"
                      fill={GREEN_DARK}
                      radius={[0, 6, 6, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <div className="border-b border-slate-200 px-4 py-2.5">
                <div className="text-sm font-semibold">Packaging ranking</div>
              </div>
              <CardContent className="space-y-2 p-3">
                {packWise.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    No packaging data found.
                  </div>
                ) : (
                  packWise.slice(0, 8).map((row, index) => (
                    <div
                      key={String(row.packagingItemId)}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-2 py-1.5 hover:bg-slate-50"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#3aa838]/10 text-[10px] font-bold text-[#2f8a2f]">
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-slate-900">
                            {row.packagingItemName || "-"}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {row.sku || "-"} · {row.unit || "-"}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold tabular-nums text-slate-900">
                          {qtyText(row.usedQty)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {money(row.totalCost)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* ============ SNAPSHOT STRIP ============ */}
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <div className="rounded-lg border border-[#3aa838]/30 bg-gradient-to-br from-[#3aa838]/5 to-white p-3">
            <div className="text-[10px] font-medium uppercase tracking-wide text-[#2f8a2f]">
              Efficiency
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-[#2f8a2f]">
              {summary?.totalExpectedRawUsed
                ? `${qtyText(
                    (summary.totalActualRawUsed /
                      summary.totalExpectedRawUsed) *
                      100,
                  )}%`
                : "0%"}
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              Actual raw used vs expected
            </div>
          </div>

          <div className="rounded-lg border border-[#3aa838]/30 bg-gradient-to-br from-[#3aa838]/5 to-white p-3">
            <div className="text-[10px] font-medium uppercase tracking-wide text-[#2f8a2f]">
              Total input cost
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-[#2f8a2f]">
              {money(summary?.totalInputCost || 0)}
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              Across all materials
            </div>
          </div>

          <div className="rounded-lg border border-rose-200 bg-gradient-to-br from-rose-50 to-white p-3">
            <div className="text-[10px] font-medium uppercase tracking-wide text-rose-700">
              Production loss
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-rose-700">
              {qtyText(summary?.totalProductionLossQuantity || 0)}
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              Exceeding allowed wastage
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}