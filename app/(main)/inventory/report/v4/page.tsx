// app/reports/inventory/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Download,
  Factory as FactoryIcon,
  Package,
  PackageOpen,
  RefreshCcw,
  Warehouse as WarehouseIcon,
  ArrowRightLeft,
  TrendingUp,
  Calendar,
  Filter,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  Plus,
  BarChart3,
  TrendingDown,
  DollarSign,
  Box,
} from "lucide-react";

/* ---------- types (original + new) ---------- */
type Warehouse = {
  _id: string;
  name?: string;
  code?: string;
  type?: string;
};

type BaseItem = {
  _id: string;
  name: string;
  sku: string;
  unit?: string;
};

type RawMaterial = BaseItem;
type PackagingItem = BaseItem;
type Product = BaseItem;
type OtherProduct = BaseItem;

type RawMaterialStock = {
  _id?: string;
  rawMaterialId: string | any;
  factoryId?: string | any;
  warehouseId?: string | any;
  locationId?: string | any;
  warehouseOrFactoryId?: string | any;
  quantity: number;
  unit?: string;
};
type PackagingStock = {
  _id?: string;
  packagingItemId: string | any;
  factoryId?: string | any;
  warehouseId?: string | any;
  locationId?: string | any;
  warehouseOrFactoryId?: string | any;
  quantity: number;
  unit?: string;
};
type ProductStock = {
  _id?: string;
  productId: string | any;
  warehouseId?: string | any;
  factoryId?: string | any;
  locationId?: string | any;
  warehouseOrFactoryId?: string | any;
  quantity: number;
  unit?: string;
  reservedForSales?: number;
  reservedForTransfer?: number;
  incomingTransfer?: number;
};
type OtherProductStock = {
  _id?: string;
  otherProductId: string | any;
  warehouseId?: string | any;
  factoryId?: string | any;
  locationId?: string | any;
  warehouseOrFactoryId?: string | any;
  quantity: number;
  unit?: string;
};

type StockTransaction = {
  _id: string;
  itemType: string;
  itemId: string | any;
  locationId: string | any;
  transactionType: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  transactionDate: string;
  sourceId?: string;
  sourceModel?: string;
  batch?: string;
};

type ReportKind = "RAW" | "PACK" | "OTHER" | "FINISHED";
type ReportTab = "ALL" | ReportKind;
type ViewTab = "overview" | "transactions" | "movement";

type ReportRow = {
  key: string;
  kind: ReportKind;
  name: string;
  sku: string;
  unit: string;
  totals: Record<string, number>;
  totalFactory: number;
  totalWarehouse: number;
  grandTotal: number;
};

/* ---------- helpers (original) ---------- */
function idOf(maybe: any): string {
  if (!maybe) return "";
  if (typeof maybe === "string") return maybe;
  if (typeof maybe === "object") {
    if ("_id" in maybe) return String(maybe._id);
    if ("id" in maybe) return String(maybe.id);
  }
  return "";
}
function safeNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function csvEscape(s: any) {
  if (s === null || s === undefined) return "";
  return `"${String(s).replace(/"/g, '""')}"`;
}
function stockLocationId(s: any) {
  return idOf(
    s?.warehouseId ||
      s?.factoryId ||
      s?.locationId ||
      s?.warehouseOrFactoryId ||
      s?.location ||
      s?.warehouseOrFactory,
  );
}
function stockItemId(s: any, field: string) {
  return idOf(s?.[field]);
}
function makeTotalsMap(stocks: any[], itemField: string) {
  const map = new Map<string, number>();
  for (const s of stocks) {
    const iid = stockItemId(s, itemField);
    const lid = stockLocationId(s);
    if (!iid || !lid) continue;
    const key = `${iid}_${lid}`;
    map.set(key, (map.get(key) || 0) + safeNum(s.quantity));
  }
  return map;
}

/* ---------- date helpers ---------- */
function getPresetDates(preset: string): { start: Date; end: Date } | null {
  const now = new Date();
  let start: Date, end: Date;
  switch (preset) {
    case "this_week": {
      const day = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - day + 1);
      start = new Date(monday.setHours(0, 0, 0, 0));
      end = now;
      break;
    }
    case "last_week": {
      const day = now.getDay();
      const lastMon = new Date(now);
      lastMon.setDate(now.getDate() - day - 6);
      const lastSun = new Date(lastMon);
      lastSun.setDate(lastMon.getDate() + 6);
      start = lastMon;
      end = lastSun;
      break;
    }
    case "this_month": {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = now;
      break;
    }
    case "last_month": {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
      break;
    }
    case "last_3_months": {
      start = new Date(now);
      start.setMonth(now.getMonth() - 3);
      end = now;
      break;
    }
    case "this_year": {
      start = new Date(now.getFullYear(), 0, 1);
      end = now;
      break;
    }
    case "last_year": {
      start = new Date(now.getFullYear() - 1, 0, 1);
      end = new Date(now.getFullYear() - 1, 11, 31);
      break;
    }
    default:
      return null;
  }
  return { start, end };
}

/* ---------- Multi‑select component (improved) ---------- */
function MultiSelect({
  items,
  selected,
  onChange,
}: {
  items: { value: string; label: string }[];
  selected: string[];
  onChange: (vals: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = items.filter((i) =>
    i.label.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="relative">
      <div
        className="flex min-h-[2.5rem] items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        {selected.length === 0 ? (
          <span className="px-2 text-sm text-slate-400">Select items…</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {selected.slice(0, 3).map((val) => {
              const item = items.find((i) => i.value === val);
              return (
                <Badge
                  key={val}
                  variant="secondary"
                  className="cursor-pointer py-0.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(selected.filter((s) => s !== val));
                  }}
                >
                  {item?.label || val}
                  <X className="ml-1 h-3 w-3" />
                </Badge>
              );
            })}
            {selected.length > 3 && (
              <span className="text-xs text-slate-500">
                +{selected.length - 3} more
              </span>
            )}
          </div>
        )}
        <ChevronDown className="ml-auto h-4 w-4 text-slate-400" />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="p-2">
            <Input
              placeholder="Search items…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm"
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="p-2 text-sm text-slate-500">No items found</p>
            ) : (
              filtered.map((item) => {
                const isSelected = selected.includes(item.value);
                return (
                  <div
                    key={item.value}
                    className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 ${
                      isSelected ? "bg-indigo-50 text-indigo-700" : ""
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isSelected) {
                        onChange(selected.filter((s) => s !== item.value));
                      } else {
                        onChange([...selected, item.value]);
                      }
                    }}
                  >
                    <div
                      className={`h-4 w-4 rounded border ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-500"
                          : "border-slate-300"
                      } flex items-center justify-center`}
                    >
                      {isSelected && (
                        <svg
                          className="h-3 w-3 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                    {item.label}
                  </div>
                );
              })
            )}
          </div>
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setOpen(false)}
            >
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
export default function InventoryReportPage() {
  /* ---------- base data (original) ---------- */
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [factories, setFactories] = useState<Warehouse[]>([]);

  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [rawStocks, setRawStocks] = useState<RawMaterialStock[]>([]);

  const [packagingItems, setPackagingItems] = useState<PackagingItem[]>([]);
  const [packStocks, setPackStocks] = useState<PackagingStock[]>([]);

  const [products, setProducts] = useState<Product[]>([]);
  const [productStocks, setProductStocks] = useState<ProductStock[]>([]);

  const [otherProducts, setOtherProducts] = useState<OtherProduct[]>([]);
  const [otherProductStocks, setOtherProductStocks] = useState<
    OtherProductStock[]
  >([]);

  /* ---------- UI state (original) ---------- */
  const [activeTab, setActiveTab] = useState<ReportTab>("ALL");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [onlyNonZero, setOnlyNonZero] = useState(false);
  const [showFactories, setShowFactories] = useState(true);
  const [showWarehouses, setShowWarehouses] = useState(true);

  /* ---------- view tab (new) ---------- */
  const [viewTab, setViewTab] = useState<ViewTab>("overview");

  /* ---------- date & item filter (new) ---------- */
  const [datePreset, setDatePreset] = useState("this_month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(true);

  /* ---------- transaction data ---------- */
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const mounted = useRef(true);

  /* ---------- derived date range ---------- */
  const activeDateRange = useMemo(() => {
    if (datePreset === "custom") {
      return {
        start: customStart ? new Date(customStart) : null,
        end: customEnd ? new Date(customEnd) : null,
      };
    }
    const preset = getPresetDates(datePreset);
    return preset
      ? { start: preset.start, end: preset.end }
      : { start: null, end: null };
  }, [datePreset, customStart, customEnd]);

  /* ---------- load all static data (original) ---------- */
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => window.clearTimeout(t);
  }, [q]);

  async function loadRefsAndData() {
    setLoading(true);
    try {
      const [
        wRes,
        fRes,
        rmRes,
        rmsRes,
        pkRes,
        pksRes,
        prRes,
        prsRes,
        opRes,
        opsRes,
      ] = await Promise.all([
        api
          .get("/warehouses", {
            params: { type: "Warehouse", page: 1, limit: 5000 },
          })
          .catch(() => ({ data: { data: [] } })),
        api
          .get("/warehouses", {
            params: { type: "Factory", page: 1, limit: 5000 },
          })
          .catch(() => ({ data: { data: [] } })),
        api
          .get("/raw-materials", { params: { page: 1, limit: 10000 } })
          .catch(() => ({ data: { data: [] } })),
        api
          .get("/raw-material-stocks", { params: { page: 1, limit: 100000 } })
          .catch(() => ({ data: { data: [] } })),
        api
          .get("/packaging-items", { params: { page: 1, limit: 10000 } })
          .catch(() => ({ data: { data: [] } })),
        api
          .get("/packaging-stocks", { params: { page: 1, limit: 100000 } })
          .catch(() => ({ data: { data: [] } })),
        api
          .get("/products", { params: { page: 1, limit: 10000 } })
          .catch(() => ({ data: { data: [] } })),
        api
          .get("/product-stocks", { params: { page: 1, limit: 200000 } })
          .catch(() => ({ data: { data: [] } })),
        api
          .get("/other-products", { params: { page: 1, limit: 10000 } })
          .catch(() => ({ data: { data: [] } })),
        api
          .get("/other-product-stocks", { params: { page: 1, limit: 200000 } })
          .catch(() => ({ data: { data: [] } })),
      ]);
      if (!mounted.current) return;
      setWarehouses(wRes.data?.data || []);
      setFactories(fRes.data?.data || []);
      setRawMaterials(rmRes.data?.data || []);
      setRawStocks(rmsRes.data?.data || []);
      setPackagingItems(pkRes.data?.data || []);
      setPackStocks(pksRes.data?.data || []);
      setProducts(prRes.data?.data || []);
      setProductStocks(prsRes.data?.data || []);
      setOtherProducts(opRes.data?.data || []);
      setOtherProductStocks(opsRes.data?.data || []);
    } catch (err: any) {
      console.error(err);
      toast.error(
        err?.response?.data?.message || "Failed to load inventory report",
      );
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

  useEffect(() => {
    loadRefsAndData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- location columns (original) ---------- */
  const locations = useMemo(() => {
    const cols: { id: string; label: string; kind: "Factory" | "Warehouse" }[] =
      [];
    if (showFactories) {
      for (const f of factories) {
        cols.push({
          id: f._id,
          label: `${f.name ?? "Factory"}${f.code ? ` (${f.code})` : ""}`,
          kind: "Factory",
        });
      }
    }
    if (showWarehouses) {
      for (const w of warehouses) {
        cols.push({
          id: w._id,
          label: `${w.name ?? "Warehouse"}${w.code ? ` (${w.code})` : ""}`,
          kind: "Warehouse",
        });
      }
    }
    return cols;
  }, [factories, warehouses, showFactories, showWarehouses]);

  /* ---------- original matrix rows ---------- */
  const rows: ReportRow[] = useMemo(() => {
    const search = debouncedQ.toLowerCase();
    const match = (name?: string, sku?: string) => {
      if (!search) return true;
      return (
        String(name ?? "")
          .toLowerCase()
          .includes(search) ||
        String(sku ?? "")
          .toLowerCase()
          .includes(search)
      );
    };
    const result: ReportRow[] = [];
    // RAW
    {
      const map = makeTotalsMap(rawStocks, "rawMaterialId");
      for (const m of rawMaterials) {
        if (!match(m.name, m.sku)) continue;
        const totals: Record<string, number> = {};
        let totalFactory = 0,
          totalWarehouse = 0;
        for (const loc of locations) {
          const qty = map.get(`${m._id}_${loc.id}`) || 0;
          totals[loc.id] = qty;
          if (loc.kind === "Factory") totalFactory += qty;
          else totalWarehouse += qty;
        }
        const grandTotal = totalFactory + totalWarehouse;
        if (onlyNonZero && grandTotal === 0) continue;
        result.push({
          key: `RAW_${m._id}`,
          kind: "RAW",
          name: m.name,
          sku: m.sku,
          unit: m.unit || "kg",
          totals,
          totalFactory,
          totalWarehouse,
          grandTotal,
        });
      }
    }
    // PACK
    {
      const map = makeTotalsMap(packStocks, "packagingItemId");
      for (const it of packagingItems) {
        if (!match(it.name, it.sku)) continue;
        const totals: Record<string, number> = {};
        let totalFactory = 0,
          totalWarehouse = 0;
        for (const loc of locations) {
          const qty = map.get(`${it._id}_${loc.id}`) || 0;
          totals[loc.id] = qty;
          if (loc.kind === "Factory") totalFactory += qty;
          else totalWarehouse += qty;
        }
        const grandTotal = totalFactory + totalWarehouse;
        if (onlyNonZero && grandTotal === 0) continue;
        result.push({
          key: `PACK_${it._id}`,
          kind: "PACK",
          name: it.name,
          sku: it.sku,
          unit: it.unit || "pcs",
          totals,
          totalFactory,
          totalWarehouse,
          grandTotal,
        });
      }
    }
    // FINISHED
    {
      const map = makeTotalsMap(productStocks, "productId");
      for (const p of products) {
        if (!match(p.name, p.sku)) continue;
        const totals: Record<string, number> = {};
        let totalFactory = 0,
          totalWarehouse = 0;
        for (const loc of locations) {
          const qty = map.get(`${p._id}_${loc.id}`) || 0;
          totals[loc.id] = qty;
          if (loc.kind === "Factory") totalFactory += qty;
          else totalWarehouse += qty;
        }
        const grandTotal = totalFactory + totalWarehouse;
        if (onlyNonZero && grandTotal === 0) continue;
        result.push({
          key: `FINISHED_${p._id}`,
          kind: "FINISHED",
          name: p.name,
          sku: p.sku,
          unit: p.unit || "pcs",
          totals,
          totalFactory,
          totalWarehouse,
          grandTotal,
        });
      }
    }
    // OTHER
    {
      const map = makeTotalsMap(otherProductStocks, "otherProductId");
      for (const p of otherProducts) {
        if (!match(p.name, p.sku)) continue;
        const totals: Record<string, number> = {};
        let totalFactory = 0,
          totalWarehouse = 0;
        for (const loc of locations) {
          const qty = map.get(`${p._id}_${loc.id}`) || 0;
          totals[loc.id] = qty;
          if (loc.kind === "Factory") totalFactory += qty;
          else totalWarehouse += qty;
        }
        const grandTotal = totalFactory + totalWarehouse;
        if (onlyNonZero && grandTotal === 0) continue;
        result.push({
          key: `OTHER_${p._id}`,
          kind: "OTHER",
          name: p.name,
          sku: p.sku,
          unit: p.unit || "pcs",
          totals,
          totalFactory,
          totalWarehouse,
          grandTotal,
        });
      }
    }
    result.sort(
      (a, b) => a.name.localeCompare(b.name) || a.sku.localeCompare(b.sku),
    );
    return result;
  }, [
    debouncedQ,
    locations,
    onlyNonZero,
    rawMaterials,
    rawStocks,
    packagingItems,
    packStocks,
    products,
    productStocks,
    otherProducts,
    otherProductStocks,
  ]);

  const visibleRows = useMemo(() => {
    if (activeTab === "ALL") return rows;
    return rows.filter((r) => r.kind === activeTab);
  }, [rows, activeTab]);

  const countsByKind = useMemo(() => {
    const c = { RAW: 0, PACK: 0, OTHER: 0, FINISHED: 0 } as Record<
      ReportKind,
      number
    >;
    for (const r of rows) c[r.kind] += 1;
    return c;
  }, [rows]);

  const totalsByColumn = useMemo(() => {
    const colTotals: Record<string, number> = {};
    for (const col of locations) colTotals[col.id] = 0;
    let totalFactory = 0,
      totalWarehouse = 0,
      grandTotal = 0;
    for (const r of visibleRows) {
      for (const col of locations) {
        colTotals[col.id] += safeNum(r.totals[col.id] ?? 0);
      }
      totalFactory += safeNum(r.totalFactory);
      totalWarehouse += safeNum(r.totalWarehouse);
      grandTotal += safeNum(r.grandTotal);
    }
    return { colTotals, totalFactory, totalWarehouse, grandTotal };
  }, [locations, visibleRows]);

  const factoryCols = locations.filter((c) => c.kind === "Factory");
  const warehouseCols = locations.filter((c) => c.kind === "Warehouse");

  const groupedRows = useMemo(() => {
    if (activeTab !== "ALL") return [{ label: "", rows: visibleRows }];
    const groups: { label: string; kind: ReportKind; rows: ReportRow[] }[] = [
      { label: "Raw Materials", kind: "RAW", rows: [] },
      { label: "Packing Materials", kind: "PACK", rows: [] },
      { label: "Finished Goods", kind: "FINISHED", rows: [] },
      { label: "Other Products", kind: "OTHER", rows: [] },
    ];
    const map = new Map<ReportKind, (typeof groups)[number]>();
    for (const g of groups) map.set(g.kind, g);
    for (const r of visibleRows) map.get(r.kind)?.rows.push(r);
    return groups.map((g) => ({ label: g.label, rows: g.rows }));
  }, [activeTab, visibleRows]);

  function kindLabel(k: ReportKind) {
    if (k === "RAW") return "Raw Material";
    if (k === "PACK") return "Packing";
    if (k === "FINISHED") return "Finished Goods";
    return "Other Product";
  }
  function kindBadgeVariant(
    k: ReportKind,
  ): React.ComponentProps<typeof Badge>["variant"] {
    if (k === "FINISHED") return "default";
    if (k === "RAW") return "secondary";
    if (k === "PACK") return "outline";
    return "secondary";
  }

  function exportCsv() {
    if (!visibleRows.length) return toast.error("No rows to export");
    const headers = [
      "type",
      "name",
      "sku",
      "unit",
      ...locations.map((c) => c.label),
      "total_factory",
      "total_warehouse",
      "grand_total",
    ];
    const csvRows = visibleRows.map((r) =>
      [
        r.kind,
        r.name,
        r.sku,
        r.unit,
        ...locations.map((c) => r.totals[c.id] ?? 0),
        r.totalFactory,
        r.totalWarehouse,
        r.grandTotal,
      ]
        .map(csvEscape)
        .join(","),
    );
    const csv = [headers.map(csvEscape).join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory_report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ---------- load transactions (new) ---------- */
  const allItemsForFilter = useMemo(() => {
    return [
      ...rawMaterials,
      ...packagingItems,
      ...products,
      ...otherProducts,
    ].map((i) => ({
      value: i._id,
      label: `${i.name} (${i.sku})`,
    }));
  }, [rawMaterials, packagingItems, products, otherProducts]);

  async function loadTransactions() {
    if (!activeDateRange.start) return;
    setTxLoading(true);
    try {
      const res = await api.get("/stock-transactions", {
        params: {
          sort: "-transactionDate",
          limit: 100000,
          filter: {
            transactionDate: { $gte: activeDateRange.start.toISOString() },
          },
        },
      });
      let txs: StockTransaction[] = res.data?.data || [];
      // client-side end date filter
      if (activeDateRange.end) {
        txs = txs.filter(
          (tx) => new Date(tx.transactionDate) <= activeDateRange.end!,
        );
      }
      // item filter
      if (selectedItems.length > 0) {
        txs = txs.filter((tx) => selectedItems.includes(idOf(tx.itemId)));
      }
      setTransactions(txs);
    } catch (err) {
      toast.error("Failed to load transactions");
    } finally {
      setTxLoading(false);
    }
  }

  useEffect(() => {
    if (viewTab === "transactions" || viewTab === "movement") {
      loadTransactions();
    }
  }, [viewTab, activeDateRange, selectedItems]); // eslint-disable-line

  /* ---------- movement data (new) ---------- */
  const movementData = useMemo(() => {
    if (viewTab !== "movement" || transactions.length === 0) return [];
    // current stock map across all stocks
    const stockMap = new Map<string, number>();
    const allStocks: any[] = [
      ...rawStocks,
      ...packStocks,
      ...productStocks,
      ...otherProductStocks,
    ];
    allStocks.forEach((s) => {
      let itemField: string | undefined;
      if (s.rawMaterialId) itemField = "rawMaterialId";
      else if (s.packagingItemId) itemField = "packagingItemId";
      else if (s.productId) itemField = "productId";
      else if (s.otherProductId) itemField = "otherProductId";
      const itemId = itemField ? stockItemId(s, itemField) : null;
      const locId = stockLocationId(s);
      if (!itemId || !locId) return;
      stockMap.set(`${itemId}_${locId}`, safeNum(s.quantity));
    });

    const txMap = new Map<string, { inward: number; outward: number }>();
    const itemLocKeys = new Set<string>();
    transactions.forEach((tx) => {
      const iid = idOf(tx.itemId);
      const lid = idOf(tx.locationId);
      if (!iid || !lid) return;
      const key = `${iid}_${lid}`;
      itemLocKeys.add(key);
      const entry = txMap.get(key) || { inward: 0, outward: 0 };
      if (tx.quantity > 0) entry.inward += tx.quantity;
      else entry.outward += Math.abs(tx.quantity);
      txMap.set(key, entry);
    });

    const movements: {
      itemId: string;
      itemName: string;
      sku: string;
      unit: string;
      locationId: string;
      locationName: string;
      opening: number;
      inward: number;
      outward: number;
      closing: number;
    }[] = [];

    for (const key of itemLocKeys) {
      const [iid, lid] = key.split("_");
      const current = stockMap.get(key) || 0;
      const { inward, outward } = txMap.get(key)!;
      const totalChange = inward - outward;
      const opening = current - totalChange;
      const item = [
        ...rawMaterials,
        ...packagingItems,
        ...products,
        ...otherProducts,
      ].find((i) => i._id === iid);
      const loc = [...factories, ...warehouses].find((l) => l._id === lid);
      movements.push({
        itemId: iid,
        itemName: item?.name || "Unknown",
        sku: item?.sku || "",
        unit: item?.unit || "pcs",
        locationId: lid,
        locationName: loc?.name || "Unknown",
        opening,
        inward,
        outward,
        closing: current,
      });
    }
    return movements;
  }, [
    viewTab,
    transactions,
    rawStocks,
    packStocks,
    productStocks,
    otherProductStocks,
    factories,
    warehouses,
    rawMaterials,
    packagingItems,
    products,
    otherProducts,
  ]);

  /* ================================================================== */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-blue-50 p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-800 flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-indigo-600" />
            Inventory Report
          </h1>
          <p className="text-sm text-slate-600">
            Complete stock matrix, transactions, and movement analysis.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => loadRefsAndData()}
            disabled={loading}
            className="gap-2 border-slate-200 bg-white/70 backdrop-blur-sm hover:bg-white"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </Button>
          <Button
            onClick={exportCsv}
            disabled={loading || visibleRows.length === 0}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white/70 backdrop-blur-sm border border-indigo-100 p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="p-3 rounded-xl bg-indigo-100">
            <Box className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800">
              {rows.length}
            </div>
            <div className="text-xs text-slate-500">Total Items</div>
          </div>
        </div>
        <div className="rounded-2xl bg-white/70 backdrop-blur-sm border border-emerald-100 p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="p-3 rounded-xl bg-emerald-100">
            <TrendingUp className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800">
              {totalsByColumn.totalFactory + totalsByColumn.totalWarehouse}
            </div>
            <div className="text-xs text-slate-500">Total Stock</div>
          </div>
        </div>
        <div className="rounded-2xl bg-white/70 backdrop-blur-sm border border-amber-100 p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="p-3 rounded-xl bg-amber-100">
            <DollarSign className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800">-</div>
            <div className="text-xs text-slate-500">Stock Value</div>
          </div>
        </div>
        <div className="rounded-2xl bg-white/70 backdrop-blur-sm border border-purple-100 p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="p-3 rounded-xl bg-purple-100">
            <FactoryIcon className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800">
              {factories.length + warehouses.length}
            </div>
            <div className="text-xs text-slate-500">Locations</div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-2xl bg-white/70 backdrop-blur-sm border border-slate-200 shadow-sm overflow-hidden">
        <div
          className="flex items-center justify-between p-4 cursor-pointer"
          onClick={() => setShowFilters(!showFilters)}
        >
          <h2 className="font-semibold text-slate-700 flex items-center gap-2">
            <Filter className="h-5 w-5 text-indigo-500" />
            Filters & Date Range
          </h2>
          {showFilters ? (
            <ChevronUp className="h-5 w-5 text-slate-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-slate-400" />
          )}
        </div>
        {showFilters && (
          <div className="p-4 pt-0 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">
                Period
              </label>
              <select
                value={datePreset}
                onChange={(e) => {
                  setDatePreset(e.target.value);
                  if (e.target.value !== "custom") {
                    setCustomStart("");
                    setCustomEnd("");
                  }
                }}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
              >
                <option value="this_week">This Week</option>
                <option value="last_week">Last Week</option>
                <option value="this_month">This Month</option>
                <option value="last_month">Last Month</option>
                <option value="last_3_months">Last 3 Months</option>
                <option value="this_year">This Year</option>
                <option value="last_year">Last Year</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            {datePreset === "custom" && (
              <>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">
                    From
                  </label>
                  <Input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">
                    To
                  </label>
                  <Input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="bg-white"
                  />
                </div>
              </>
            )}
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-slate-500 mb-1 block">
                Items (optional)
              </label>
              <MultiSelect
                items={allItemsForFilter}
                selected={selectedItems}
                onChange={setSelectedItems}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={loadTransactions}
                className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <Calendar className="h-4 w-4" />
                Apply
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* View tabs */}
      <Tabs value={viewTab} onValueChange={(v) => setViewTab(v as ViewTab)}>
        <div className="flex justify-center mb-4">
          <TabsList className="bg-white/60 backdrop-blur-sm border border-slate-200 p-1 rounded-xl">
            <TabsTrigger
              value="overview"
              className="data-[state=active]:bg-indigo-100 data-[state=active]:text-indigo-700 rounded-lg px-4 py-2 font-medium transition-all"
            >
              <PackageOpen className="mr-2 h-4 w-4" />
              Stock Overview
            </TabsTrigger>
            <TabsTrigger
              value="transactions"
              className="data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-700 rounded-lg px-4 py-2 font-medium transition-all"
            >
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              Transactions
            </TabsTrigger>
            <TabsTrigger
              value="movement"
              className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-700 rounded-lg px-4 py-2 font-medium transition-all"
            >
              <TrendingUp className="mr-2 h-4 w-4" />
              Stock Movement
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ---------- Stock Overview ---------- */}
        <TabsContent value="overview" className="mt-0 space-y-4">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as ReportTab)}
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <TabsList className="bg-white/60 backdrop-blur-sm border border-slate-200 p-1 rounded-xl w-full md:w-auto">
                  <TabsTrigger
                    value="ALL"
                    className="gap-2 rounded-lg data-[state=active]:bg-indigo-100 data-[state=active]:text-indigo-700"
                  >
                    <PackageOpen className="h-4 w-4" /> All
                    <span className="ml-1 rounded-full bg-white px-2 py-0.5 text-xs font-medium">
                      {rows.length}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="RAW"
                    className="gap-2 rounded-lg data-[state=active]:bg-indigo-100 data-[state=active]:text-indigo-700"
                  >
                    <Package className="h-4 w-4" /> Raw
                    <span className="ml-1 rounded-full bg-white px-2 py-0.5 text-xs font-medium">
                      {countsByKind.RAW}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="PACK"
                    className="gap-2 rounded-lg data-[state=active]:bg-indigo-100 data-[state=active]:text-indigo-700"
                  >
                    <Package className="h-4 w-4" /> Packing
                    <span className="ml-1 rounded-full bg-white px-2 py-0.5 text-xs font-medium">
                      {countsByKind.PACK}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="FINISHED"
                    className="gap-2 rounded-lg data-[state=active]:bg-indigo-100 data-[state=active]:text-indigo-700"
                  >
                    <PackageOpen className="h-4 w-4" /> Finished
                    <span className="ml-1 rounded-full bg-white px-2 py-0.5 text-xs font-medium">
                      {countsByKind.FINISHED}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="OTHER"
                    className="gap-2 rounded-lg data-[state=active]:bg-indigo-100 data-[state=active]:text-indigo-700"
                  >
                    <PackageOpen className="h-4 w-4" /> Other
                    <span className="ml-1 rounded-full bg-white px-2 py-0.5 text-xs font-medium">
                      {countsByKind.OTHER}
                    </span>
                  </TabsTrigger>
                </TabsList>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      value={q}
                      placeholder="Search name / SKU…"
                      onChange={(e) => setQ(e.target.value)}
                      className="pl-9 w-64 rounded-xl border-slate-200 bg-white"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={onlyNonZero}
                      onChange={(e) => setOnlyNonZero(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    Non-zero only
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={showFactories}
                      onChange={(e) => setShowFactories(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    Factories
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={showWarehouses}
                      onChange={(e) => setShowWarehouses(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    Warehouses
                  </label>
                </div>
              </div>
            </div>

            <TabsContent value={activeTab} className="mt-4">
              <div className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur-sm shadow-sm overflow-hidden">
                <div className="max-h-[65vh] overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 z-20 bg-gradient-to-r from-indigo-50/90 to-blue-50/90 backdrop-blur-md">
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead className="min-w-64">Item</TableHead>
                        <TableHead className="min-w-32">Type</TableHead>
                        <TableHead className="min-w-28">SKU</TableHead>
                        <TableHead className="min-w-20">Unit</TableHead>
                        {factoryCols.length > 0 && (
                          <TableHead
                            colSpan={factoryCols.length}
                            className="text-center"
                          >
                            <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
                              <FactoryIcon className="h-4 w-4" /> Factories
                            </span>
                          </TableHead>
                        )}
                        {warehouseCols.length > 0 && (
                          <TableHead
                            colSpan={warehouseCols.length}
                            className="text-center"
                          >
                            <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
                              <WarehouseIcon className="h-4 w-4" /> Warehouses
                            </span>
                          </TableHead>
                        )}
                        <TableHead className="min-w-28 text-right">
                          Factory
                        </TableHead>
                        <TableHead className="min-w-28 text-right">
                          Warehouse
                        </TableHead>
                        <TableHead className="min-w-28 text-right">
                          Total
                        </TableHead>
                      </TableRow>
                      <TableRow>
                        <TableHead />
                        <TableHead />
                        <TableHead />
                        <TableHead />
                        <TableHead />
                        {factoryCols.map((c) => (
                          <TableHead
                            key={c.id}
                            className="min-w-44 text-xs font-medium text-slate-600"
                          >
                            {c.label}
                          </TableHead>
                        ))}
                        {warehouseCols.map((c) => (
                          <TableHead
                            key={c.id}
                            className="min-w-44 text-xs font-medium text-slate-600"
                          >
                            {c.label}
                          </TableHead>
                        ))}
                        <TableHead />
                        <TableHead />
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading && (
                        <TableRow>
                          <TableCell
                            colSpan={
                              8 + factoryCols.length + warehouseCols.length
                            }
                            className="py-10 text-center text-slate-400"
                          >
                            Loading…
                          </TableCell>
                        </TableRow>
                      )}
                      {!loading &&
                        groupedRows.map((g) => (
                          <React.Fragment key={g.label || "rows"}>
                            {g.label && (
                              <TableRow className="bg-slate-50/80">
                                <TableCell
                                  colSpan={
                                    8 +
                                    factoryCols.length +
                                    warehouseCols.length
                                  }
                                  className="py-3 font-semibold text-slate-700"
                                >
                                  {g.label}
                                  <span className="ml-2 text-xs font-normal text-slate-500">
                                    ({g.rows.length})
                                  </span>
                                </TableCell>
                              </TableRow>
                            )}
                            {g.rows.map((r, idx) => (
                              <TableRow
                                key={r.key}
                                className="hover:bg-indigo-50/50 transition-colors"
                              >
                                <TableCell className="text-sm text-slate-500">
                                  {idx + 1}
                                </TableCell>
                                <TableCell>
                                  <div className="font-medium text-slate-800">
                                    {r.name}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant={kindBadgeVariant(r.kind)}
                                    className="font-normal"
                                  >
                                    {kindLabel(r.kind)}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm text-slate-600">
                                  {r.sku}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {r.unit}
                                </TableCell>
                                {factoryCols.map((c) => (
                                  <TableCell
                                    key={c.id}
                                    className="text-sm tabular-nums"
                                  >
                                    {r.totals[c.id] ?? 0}
                                  </TableCell>
                                ))}
                                {warehouseCols.map((c) => (
                                  <TableCell
                                    key={c.id}
                                    className="text-sm tabular-nums"
                                  >
                                    {r.totals[c.id] ?? 0}
                                  </TableCell>
                                ))}
                                <TableCell className="text-right font-medium tabular-nums">
                                  {r.totalFactory}
                                </TableCell>
                                <TableCell className="text-right font-medium tabular-nums">
                                  {r.totalWarehouse}
                                </TableCell>
                                <TableCell className="text-right font-bold tabular-nums text-indigo-600">
                                  {r.grandTotal}
                                </TableCell>
                              </TableRow>
                            ))}
                          </React.Fragment>
                        ))}
                      {!loading && visibleRows.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={
                              8 + factoryCols.length + warehouseCols.length
                            }
                            className="py-10 text-center text-slate-400"
                          >
                            No rows found
                          </TableCell>
                        </TableRow>
                      )}
                      {!loading && visibleRows.length > 0 && (
                        <TableRow className="sticky bottom-0 z-20 bg-gradient-to-r from-indigo-50/95 to-blue-50/95 backdrop-blur-md border-t-2 border-slate-200">
                          <TableCell />
                          <TableCell className="font-semibold text-slate-800">
                            Totals
                          </TableCell>
                          <TableCell />
                          <TableCell />
                          <TableCell />
                          {factoryCols.map((c) => (
                            <TableCell
                              key={c.id}
                              className="font-semibold tabular-nums"
                            >
                              {totalsByColumn.colTotals[c.id] ?? 0}
                            </TableCell>
                          ))}
                          {warehouseCols.map((c) => (
                            <TableCell
                              key={c.id}
                              className="font-semibold tabular-nums"
                            >
                              {totalsByColumn.colTotals[c.id] ?? 0}
                            </TableCell>
                          ))}
                          <TableCell className="text-right font-semibold tabular-nums">
                            {totalsByColumn.totalFactory}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            {totalsByColumn.totalWarehouse}
                          </TableCell>
                          <TableCell className="text-right font-bold tabular-nums text-indigo-600">
                            {totalsByColumn.grandTotal}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ---------- Transactions ---------- */}
        <TabsContent value="transactions" className="mt-0">
          <div className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur-sm shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-gradient-to-r from-emerald-50 to-teal-50">
              <h3 className="text-lg font-semibold text-slate-800">
                Stock Transactions
              </h3>
              <p className="text-sm text-slate-500">
                All inventory movements within the selected period.
              </p>
            </div>
            {txLoading ? (
              <div className="p-10 text-center text-slate-400">
                Loading transactions…
              </div>
            ) : (
              <div className="max-h-[65vh] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-white/90 backdrop-blur-sm">
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Cost</TableHead>
                      <TableHead className="text-right">Total Cost</TableHead>
                      <TableHead>Batch</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => {
                      const itemName =
                        rawMaterials.find((i) => i._id === idOf(tx.itemId))
                          ?.name ||
                        packagingItems.find((i) => i._id === idOf(tx.itemId))
                          ?.name ||
                        products.find((i) => i._id === idOf(tx.itemId))?.name ||
                        otherProducts.find((i) => i._id === idOf(tx.itemId))
                          ?.name ||
                        idOf(tx.itemId);
                      const locName =
                        factories.find((f) => f._id === idOf(tx.locationId))
                          ?.name ||
                        warehouses.find((w) => w._id === idOf(tx.locationId))
                          ?.name ||
                        idOf(tx.locationId);
                      return (
                        <TableRow
                          key={tx._id}
                          className="hover:bg-emerald-50/30 transition-colors"
                        >
                          <TableCell className="text-sm">
                            {new Date(tx.transactionDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                              {tx.transactionType}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium text-slate-800">
                            {itemName}
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {locName}
                          </TableCell>
                          <TableCell
                            className={`text-right font-mono font-semibold ${tx.quantity >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                          >
                            {tx.quantity > 0 ? "+" : ""}
                            {tx.quantity}
                          </TableCell>
                          <TableCell className="text-right">
                            ৳ {tx.unitCost?.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            ৳ {tx.totalCost?.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-sm text-slate-500">
                            {tx.batch || "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {transactions.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="py-10 text-center text-slate-400"
                        >
                          No transactions for the selected period.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ---------- Stock Movement ---------- */}
        <TabsContent value="movement" className="mt-0">
          <div className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur-sm shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-gradient-to-r from-amber-50 to-orange-50">
              <h3 className="text-lg font-semibold text-slate-800">
                Stock Movement
              </h3>
              <p className="text-sm text-slate-500">
                Opening balance, inward, outward, and closing for the period.
              </p>
            </div>
            {movementData.length === 0 ? (
              <div className="p-10 text-center text-slate-400">
                Select a date range and apply to see stock movement.
              </div>
            ) : (
              <div className="max-h-[65vh] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-white/90 backdrop-blur-sm">
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-right">Opening</TableHead>
                      <TableHead className="text-right">In</TableHead>
                      <TableHead className="text-right">Out</TableHead>
                      <TableHead className="text-right">Closing</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movementData.map((m, i) => (
                      <TableRow
                        key={`${m.itemId}_${m.locationId}`}
                        className="hover:bg-amber-50/30 transition-colors"
                      >
                        <TableCell>
                          <div className="font-medium text-slate-800">
                            {m.itemName}
                          </div>
                          <div className="text-xs text-slate-500">{m.sku}</div>
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {m.locationName}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {m.opening}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-emerald-600 font-medium">
                          +{m.inward}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-rose-600 font-medium">
                          -{m.outward}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-bold text-indigo-600">
                          {m.closing}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
