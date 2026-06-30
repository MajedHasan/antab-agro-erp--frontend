// app/inventory/material-wip/report/page.tsx
"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  TrendingDown,
  Minus,
  Factory,
  Boxes,
  Scale,
  Activity,
  Package,
  PieChart as PieChartIcon,
  BarChart3,
  LineChart as LineChartIcon,
  CalendarDays,
  ListFilter,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------- types ---------- */
type FactoryType = { _id: string; name: string; code?: string };
type RawMaterialType = { _id: string; name: string; sku?: string; unit?: string };
type ProductType = { _id: string; name: string; sku?: string; unit?: string };
type PackagingItemType = { _id: string; name: string; sku?: string; unit?: string };

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

const COLORS = [
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#14b8a6",
  "#f97316",
];

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

const nameOf = (maybe: any) => {
  if (!maybe) return "-";
  if (typeof maybe === "string") return maybe;
  return maybe.name || maybe.sku || maybe._id || "-";
};

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    ACTIVE: "bg-blue-50 text-blue-700 border-blue-200",
    PENDING_APPROVAL: "bg-amber-50 text-amber-700 border-amber-200",
    APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    REJECTED: "bg-red-50 text-red-700 border-red-200",
  };

  return (
    <Badge className={cn("font-normal text-xs", map[status] || "bg-gray-50 text-gray-700")}>
      {status === "PENDING_APPROVAL" ? "PENDING" : status}
    </Badge>
  );
};

function StatCard({
  title,
  value,
  sub,
  icon,
  loading,
}: {
  title: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <Card className="shadow-sm border-gray-200/80 hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wider text-gray-500">{title}</p>
            <div className="mt-1 text-2xl font-semibold text-gray-900">
              {loading ? "..." : value}
            </div>
            {sub ? <div className="mt-1 text-xs text-gray-500">{sub}</div> : null}
          </div>
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 text-gray-700 shadow-inner">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

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
    <Card className="shadow-sm border-gray-200/80 hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base font-semibold text-gray-900">{title}</CardTitle>
            {subtitle ? <p className="text-sm text-gray-500 mt-1">{subtitle}</p> : null}
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function MaterialWipReportPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  const [factories, setFactories] = useState<FactoryType[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterialType[]>([]);
  const [products, setProducts] = useState<ProductType[]>([]);
  const [packagingItems, setPackagingItems] = useState<PackagingItemType[]>([]);

  const [summary, setSummary] = useState<SummaryType | null>(null);
  const [trend, setTrend] = useState<TrendRow[]>([]);
  const [rawWise, setRawWise] = useState<WiseRow[]>([]);
  const [productWise, setProductWise] = useState<WiseRow[]>([]);
  const [packWise, setPackWise] = useState<WiseRow[]>([]);

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

  const queryParams = useMemo(() => {
    return {
      preset: filters.preset !== "all" ? filters.preset : undefined,
      groupBy: filters.groupBy,
      factoryId: filters.factoryId !== "all" ? filters.factoryId : undefined,
      rawMaterialId: filters.rawMaterialId !== "all" ? filters.rawMaterialId : undefined,
      productId: filters.productId !== "all" ? filters.productId : undefined,
      packagingItemId: filters.packagingItemId !== "all" ? filters.packagingItemId : undefined,
      status: filters.status !== "all" ? filters.status : undefined,
      fromDate: filters.fromDate || undefined,
      toDate: filters.toDate || undefined,
      q: filters.q.trim() || undefined,
    };
  }, [filters]);

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
      const [summaryRes, trendRes, rawWiseRes, productWiseRes, packWiseRes] = await Promise.all([
        api.get("/wip-reports/summary", { params: queryParams }),
        api.get("/wip-reports/trend", { params: queryParams }),
        api.get("/wip-reports/raw-material-wise", { params: queryParams }),
        api.get("/wip-reports/product-wise", { params: queryParams }),
        api.get("/wip-reports/packaging-wise", { params: queryParams }),
      ]);

      setSummary(summaryRes.data?.data || null);
      setTrend(Array.isArray(trendRes.data?.data) ? trendRes.data.data : []);
      setRawWise(Array.isArray(rawWiseRes.data?.data) ? rawWiseRes.data.data : []);
      setProductWise(Array.isArray(productWiseRes.data?.data) ? productWiseRes.data.data : []);
      setPackWise(Array.isArray(packWiseRes.data?.data) ? packWiseRes.data.data : []);
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

  const resetFilters = () => {
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
  };

  const selectedFactoryName = useMemo(
    () => factories.find((f) => f._id === filters.factoryId)?.name || "All factories",
    [factories, filters.factoryId],
  );

  const selectedRawName = useMemo(
    () => rawMaterials.find((r) => r._id === filters.rawMaterialId)?.name || "All raw materials",
    [rawMaterials, filters.rawMaterialId],
  );

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

  const statusPie = useMemo(() => {
    const data = [
      { name: "Active", value: summary?.activeCount || 0 },
      { name: "Pending", value: summary?.pendingCount || 0 },
      { name: "Approved", value: summary?.approvedCount || 0 },
      { name: "Rejected", value: summary?.rejectedCount || 0 },
    ].filter((x) => x.value > 0);
    return data;
  }, [summary]);

  const costPie = useMemo(() => {
    const data = [
      { name: "Raw Materials", value: summary?.totalRawMaterialCost || 0 },
      { name: "Packaging", value: summary?.totalPackagingMaterialCost || 0 },
      { name: "Other", value: summary?.totalOtherMaterialCost || 0 },
    ].filter((x) => x.value > 0);
    return data;
  }, [summary]);

  const topRaw = useMemo(() => rawWise.slice(0, 10), [rawWise]);
  const topProducts = useMemo(() => productWise.slice(0, 10), [productWise]);
  const topPackaging = useMemo(() => packWise.slice(0, 10), [packWise]);

  return (
    <div className="p-6 max-w-full mx-auto space-y-6 bg-gradient-to-br from-gray-50 via-white to-gray-100 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-3"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-amber-500" />
            WIP Analytics
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Real‑time production insights & material efficiency.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={loadReport}
            disabled={loading}
            className="gap-2 bg-white/80 backdrop-blur-sm"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => window.print()} className="gap-2 bg-white/80 backdrop-blur-sm">
            <Download className="h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="shadow-sm border-gray-200/80 bg-white/70 backdrop-blur-sm">
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div className="xl:col-span-2 space-y-1.5">
              <Label className="text-xs text-gray-500">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by material / product..."
                  value={filters.q}
                  onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))}
                  className="pl-9 h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Preset</Label>
              <Select
                value={filters.preset}
                onValueChange={(v) => setFilters((p) => ({ ...p, preset: v }))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Date preset" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="thisWeek">This week</SelectItem>
                  <SelectItem value="lastWeek">Last week</SelectItem>
                  <SelectItem value="thisMonth">This month</SelectItem>
                  <SelectItem value="lastMonth">Last month</SelectItem>
                  <SelectItem value="thisYear">This year</SelectItem>
                  <SelectItem value="lastYear">Last year</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Group By</Label>
              <Select
                value={filters.groupBy}
                onValueChange={(v) => setFilters((p) => ({ ...p, groupBy: v }))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Group by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Daily</SelectItem>
                  <SelectItem value="week">Weekly</SelectItem>
                  <SelectItem value="month">Monthly</SelectItem>
                  <SelectItem value="year">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">From</Label>
              <Input
                type="date"
                value={filters.fromDate}
                onChange={(e) => setFilters((p) => ({ ...p, fromDate: e.target.value }))}
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">To</Label>
              <Input
                type="date"
                value={filters.toDate}
                onChange={(e) => setFilters((p) => ({ ...p, toDate: e.target.value }))}
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Factory</Label>
              <Select
                value={filters.factoryId}
                onValueChange={(v) => setFilters((p) => ({ ...p, factoryId: v }))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All factories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All factories</SelectItem>
                  {factories.map((f) => (
                    <SelectItem key={f._id} value={f._id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Raw Material</Label>
              <Select
                value={filters.rawMaterialId}
                onValueChange={(v) => setFilters((p) => ({ ...p, rawMaterialId: v }))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All raw materials" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All raw materials</SelectItem>
                  {rawMaterials.map((m) => (
                    <SelectItem key={m._id} value={m._id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Product</Label>
              <Select
                value={filters.productId}
                onValueChange={(v) => setFilters((p) => ({ ...p, productId: v }))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All products" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All products</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p._id} value={p._id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Packaging</Label>
              <Select
                value={filters.packagingItemId}
                onValueChange={(v) => setFilters((p) => ({ ...p, packagingItemId: v }))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All packaging" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All packaging</SelectItem>
                  {packagingItems.map((p) => (
                    <SelectItem key={p._id} value={p._id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Status</Label>
              <Select
                value={filters.status}
                onValueChange={(v) => setFilters((p) => ({ ...p, status: v }))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="PENDING_APPROVAL">Pending</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 justify-between items-center">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="bg-white/70 backdrop-blur-sm">
                <ListFilter className="h-3.5 w-3.5 mr-1" />
                {selectedFactoryName}
              </Badge>
              <Badge variant="outline" className="bg-white/70 backdrop-blur-sm">
                Raw: {selectedRawName}
              </Badge>
              <Badge variant="outline" className="bg-white/70 backdrop-blur-sm">
                Group: {filters.groupBy}
              </Badge>
              <Badge variant="outline" className="bg-white/70 backdrop-blur-sm">
                Preset: {filters.preset}
              </Badge>
            </div>

            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                Clear filters
              </Button>
              <Button variant="outline" size="sm" onClick={loadReport} disabled={loading} className="bg-white/80 backdrop-blur-sm">
                <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                Reload
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="WIP Records"
          value={summary?.totalRecords ?? 0}
          sub="Active / pending / approved"
          icon={<Activity className="h-5 w-5" />}
          loading={loading}
        />
        <StatCard
          title="Raw Issued"
          value={`${qtyText(summary?.totalIssuedQuantity ?? 0)} kg`}
          sub={`Returned: ${qtyText(summary?.totalReturnedQuantity ?? 0)} kg`}
          icon={<Scale className="h-5 w-5" />}
          loading={loading}
        />
        <StatCard
          title="Finished Goods Cost"
          value={money(summary?.totalFinishedGoodsCost ?? 0)}
          sub={`Input cost: ${money(summary?.totalInputCost ?? 0)}`}
          icon={<Package className="h-5 w-5" />}
          loading={loading}
        />
        <StatCard
          title="Efficiency"
          value={
            summary && summary.totalExpectedRawUsed > 0
              ? `${qtyText((summary.totalActualRawUsed / summary.totalExpectedRawUsed) * 100)}%`
              : "0%"
          }
          sub={`Gain: ${qtyText(summary?.totalGainQuantity ?? 0)} kg · Loss: ${qtyText(summary?.totalProductionLossQuantity ?? 0)} kg`}
          icon={<TrendingUp className="h-5 w-5" />}
          loading={loading}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl bg-white/70 backdrop-blur-md border border-gray-200/80">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="materials">Materials</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="packaging">Packaging</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <ChartCard
              title="Production Trend"
              subtitle="Issued, consumed, expected vs actual"
              action={<LineChartIcon className="h-5 w-5 text-gray-400" />}
            >
              <div className="h-[360px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: any) => qtyText(v)} />
                    <Legend />
                    <Line type="monotone" dataKey="issued" stroke="#2563eb" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="consumed" stroke="#16a34a" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="expected" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="actual" stroke="#ef4444" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard
              title="Status Distribution"
              subtitle="WIP lifecycle"
              action={<PieChartIcon className="h-5 w-5 text-gray-400" />}
            >
              <div className="h-[360px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusPie}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={120}
                      label
                    >
                      {statusPie.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <ChartCard
              title="Cost Composition"
              subtitle="Raw, packaging, other"
              action={<BarChart3 className="h-5 w-5 text-gray-400" />}
            >
              <div className="h-[340px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={costPie}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: any) => money(v)} />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                      {costPie.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard
              title="Gain / Wastage / Loss"
              subtitle="Manufacturing variance"
              action={<TrendingUp className="h-5 w-5 text-gray-400" />}
            >
              <div className="h-[340px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="gain" stackId="1" stroke="#16a34a" fill="#bbf7d0" />
                    <Area type="monotone" dataKey="wastage" stackId="2" stroke="#f59e0b" fill="#fde68a" />
                    <Area type="monotone" dataKey="loss" stackId="3" stroke="#ef4444" fill="#fecaca" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>
        </TabsContent>

        {/* Materials */}
        <TabsContent value="materials" className="space-y-6">
          <ChartCard
            title="Raw Material Performance"
            subtitle="Top raw materials by usage and cost"
            action={<Boxes className="h-5 w-5 text-gray-400" />}
          >
            <div className="h-[420px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rawWise.slice(0, 12)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="rawMaterialName" width={180} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: any) => qtyText(v)} />
                  <Legend />
                  <Bar dataKey="totalConsumedQuantity" name="Consumed" fill="#2563eb" radius={[0, 8, 8, 0]} />
                  <Bar dataKey="totalGainQuantity" name="Gain" fill="#16a34a" radius={[0, 8, 8, 0]} />
                  <Bar dataKey="totalProductionLossQuantity" name="Loss" fill="#ef4444" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card className="shadow-sm border-gray-200/80">
              <CardHeader>
                <CardTitle className="text-base">Raw material ranking</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {rawWise.slice(0, 8).map((row, index) => (
                  <div key={String(row.rawMaterialId)} className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-sm font-medium text-gray-700">
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 truncate">{row.rawMaterialName || "-"}</div>
                        <div className="text-xs text-gray-500">
                          {row.sku || "-"} • {row.unit || "-"}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{qtyText(row.totalConsumedQuantity)}</div>
                      <div className="text-xs text-gray-500">{money(row.totalRawMaterialCost)}</div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="shadow-sm border-gray-200/80">
              <CardHeader>
                <CardTitle className="text-base">Material summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Expected raw used</span>
                  <span className="font-medium">{qtyText(summary?.totalExpectedRawUsed || 0)} kg</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Allowed wastage</span>
                  <span className="font-medium">{qtyText(summary?.totalAllowedWastageRawUsed || 0)} kg</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Actual raw used</span>
                  <span className="font-medium">{qtyText(summary?.totalActualRawUsed || 0)} kg</span>
                </div>
                <div className="h-px bg-gray-200 my-2" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-green-700">Gain</span>
                  <span className="font-medium text-green-700">{qtyText(summary?.totalGainQuantity || 0)} kg</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-amber-700">Normal wastage</span>
                  <span className="font-medium text-amber-700">{qtyText(summary?.totalNormalWastageQuantity || 0)} kg</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-red-700">Production loss</span>
                  <span className="font-medium text-red-700">{qtyText(summary?.totalProductionLossQuantity || 0)} kg</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Products */}
        <TabsContent value="products" className="space-y-6">
          <ChartCard
            title="Finished Product Costing"
            subtitle="Cost breakdown by product"
            action={<Package className="h-5 w-5 text-gray-400" />}
          >
            <div className="h-[420px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productWise.slice(0, 12)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="productName" tick={{ fontSize: 12 }} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: any) => money(v)} />
                  <Legend />
                  <Bar dataKey="totalRawMaterialCost" name="Raw" fill="#2563eb" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="totalPackagingMaterialCost" name="Packaging" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="totalOtherMaterialCost" name="Other" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card className="shadow-sm border-gray-200/80">
              <CardHeader>
                <CardTitle className="text-base">Top finished products</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {topProducts.map((row, index) => (
                  <div key={String(row.productId)} className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-sm font-medium text-gray-700">
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 truncate">{row.productName || "-"}</div>
                        <div className="text-xs text-gray-500">
                          {row.sku || "-"} • Qty: {qtyText(row.totalQtyProduced)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{money(row.totalCost)}</div>
                      <div className="text-xs text-gray-500">{money(row.avgUnitCost)} avg</div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="shadow-sm border-gray-200/80">
              <CardHeader>
                <CardTitle className="text-base">Product cost mix</CardTitle>
              </CardHeader>
              <CardContent className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={productWise.slice(0, 6).map((r) => ({
                        name: r.productName || "-",
                        value: Number(r.totalCost || 0),
                      }))}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={110}
                      label
                    >
                      {productWise.slice(0, 6).map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => money(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Packaging */}
        <TabsContent value="packaging" className="space-y-6">
          <ChartCard
            title="Packaging Usage"
            subtitle="Quantity & cost"
            action={<Boxes className="h-5 w-5 text-gray-400" />}
          >
            <div className="h-[420px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={packWise.slice(0, 12)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="packagingItemName" width={180} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: any) => qtyText(v)} />
                  <Legend />
                  <Bar dataKey="usedQty" name="Used Qty" fill="#06b6d4" radius={[0, 8, 8, 0]} />
                  <Bar dataKey="totalCost" name="Cost" fill="#2563eb" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <Card className="shadow-sm border-gray-200/80">
            <CardHeader>
              <CardTitle className="text-base">Packaging ranking</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {packWise.length === 0 ? (
                <div className="text-sm text-gray-400">No packaging data found.</div>
              ) : (
                packWise.slice(0, 8).map((row, index) => (
                  <div key={String(row.packagingItemId)} className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-sm font-medium text-gray-700">
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 truncate">{row.packagingItemName || "-"}</div>
                        <div className="text-xs text-gray-500">
                          {row.sku || "-"} • {row.unit || "-"}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{qtyText(row.usedQty)}</div>
                      <div className="text-xs text-gray-500">{money(row.totalCost)}</div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick snapshot */}
      <Card className="shadow-sm border-gray-200/80 bg-white/70 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quick analytics snapshot</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-xl border bg-gradient-to-br from-blue-50 to-blue-100/50 p-5">
            <div className="text-xs uppercase tracking-wider text-gray-500">Efficiency</div>
            <div className="mt-2 text-2xl font-bold text-gray-900">
              {summary?.totalExpectedRawUsed
                ? `${qtyText((summary.totalActualRawUsed / summary.totalExpectedRawUsed) * 100)}%`
                : "0%"}
            </div>
            <div className="mt-1 text-sm text-gray-500">
              Actual raw used vs expected.
            </div>
          </div>

          <div className="rounded-xl border bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-5">
            <div className="text-xs uppercase tracking-wider text-gray-500">Total Input Cost</div>
            <div className="mt-2 text-2xl font-bold text-gray-900">
              {money(summary?.totalInputCost || 0)}
            </div>
            <div className="mt-1 text-sm text-gray-500">
              Across all materials.
            </div>
          </div>

          <div className="rounded-xl border bg-gradient-to-br from-red-50 to-red-100/50 p-5">
            <div className="text-xs uppercase tracking-wider text-gray-500">Production Loss</div>
            <div className="mt-2 text-2xl font-bold text-red-600">
              {qtyText(summary?.totalProductionLossQuantity || 0)} kg
            </div>
            <div className="mt-1 text-sm text-gray-500">
              Exceeding allowed wastage.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}