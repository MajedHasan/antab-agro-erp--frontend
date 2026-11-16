// app/reports/inventory/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  BarChart3,
  DollarSign,
  Box,
  ArrowDownIcon,
  ArrowUpIcon,
  Layers,
  ArrowRight,
  Building2,
  Inbox,
} from "lucide-react";

import Protected from "@/components/auth/Protected";
import usePermissionCheck from "@/hooks/usePermissionCheck";

/* =========================== Types =========================== */
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

/* =========================== Helpers =========================== */
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

/* =========================== MultiSelect =========================== */
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
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = items.filter((i) =>
    i.label.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="relative" ref={containerRef}>
      <div
        className="flex min-h-[2.25rem] cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 shadow-sm transition-colors hover:border-[#3aa838]/40 dark:border-slate-800 dark:bg-slate-900"
        onClick={() => setOpen(!open)}
      >
        {selected.length === 0 ? (
          <span className="px-1 text-xs text-slate-400">Select items…</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {selected.slice(0, 3).map((val) => {
              const item = items.find((i) => i.value === val);
              return (
                <span
                  key={val}
                  className="inline-flex items-center gap-1 rounded-md bg-[#3aa838]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#2f8a2f] dark:bg-[#3aa838]/15 dark:text-[#9bdd91]"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(selected.filter((s) => s !== val));
                  }}
                >
                  {item?.label || val}
                  <X className="h-2.5 w-2.5" />
                </span>
              );
            })}
            {selected.length > 3 && (
              <span className="text-[10px] text-slate-500">
                +{selected.length - 3} more
              </span>
            )}
          </div>
        )}
        <ChevronDown className="ml-auto h-3.5 w-3.5 text-slate-400" />
      </div>

      {open &&
        containerRef.current &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999]"
            onClick={() => setOpen(false)}
          >
            <div
              className="absolute mt-1 max-h-64 w-80 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
              style={{
                top:
                  containerRef.current.getBoundingClientRect().bottom +
                  window.scrollY +
                  4,
                left:
                  containerRef.current.getBoundingClientRect().left +
                  window.scrollX,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-2">
                <Input
                  placeholder="Search items…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 text-xs"
                  autoFocus
                />
              </div>
              <div className="max-h-48 overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="p-2 text-xs text-slate-500">No items found</p>
                ) : (
                  filtered.map((item) => {
                    const isSelected = selected.includes(item.value);
                    return (
                      <div
                        key={item.value}
                        className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${
                          isSelected
                            ? "bg-[#3aa838]/5 font-medium text-[#2f8a2f] dark:bg-[#3aa838]/10 dark:text-[#9bdd91]"
                            : ""
                        }`}
                        onClick={() => {
                          if (isSelected) {
                            onChange(selected.filter((s) => s !== item.value));
                          } else {
                            onChange([...selected, item.value]);
                          }
                        }}
                      >
                        <div
                          className={`flex h-3.5 w-3.5 items-center justify-center rounded border ${
                            isSelected
                              ? "border-[#3aa838] bg-[#3aa838]"
                              : "border-slate-300 dark:border-slate-600"
                          }`}
                        >
                          {isSelected && (
                            <svg
                              className="h-2.5 w-2.5 text-white"
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
              <div className="border-t border-slate-200 p-2 dark:border-slate-800">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => setOpen(false)}
                >
                  Done
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

/* =========================== StatCard =========================== */
function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "slate",
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  hint: string;
  tone?: "slate" | "amber" | "green" | "sky";
}) {
  const map = {
    slate: {
      bg: "bg-slate-100 dark:bg-slate-800",
      fg: "text-slate-600 dark:text-slate-300",
    },
    amber: {
      bg: "bg-amber-100 dark:bg-amber-950/40",
      fg: "text-amber-600 dark:text-amber-300",
    },
    green: {
      bg: "bg-[#3aa838]/10 dark:bg-[#3aa838]/15",
      fg: "text-[#2f8a2f] dark:text-[#9bdd91]",
    },
    sky: {
      bg: "bg-sky-100 dark:bg-sky-950/40",
      fg: "text-sky-600 dark:text-sky-300",
    },
  } as const;
  const t = map[tone];

  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-lg ${t.bg} ${t.fg}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <div className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
        {value}
      </div>
      <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
        {hint}
      </p>
    </div>
  );
}

/* =========================== KindBadge =========================== */
function KindBadge({ kind }: { kind: ReportKind }) {
  const map: Record<ReportKind, string> = {
    RAW:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/60",
    PACK:
      "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900/60",
    FINISHED:
      "bg-[#3aa838]/10 text-[#2f8a2f] border-[#3aa838]/30 dark:bg-[#3aa838]/15 dark:text-[#9bdd91] dark:border-[#3aa838]/40",
    OTHER:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60",
  };
  const label =
    kind === "RAW"
      ? "Raw Material"
      : kind === "PACK"
        ? "Packing"
        : kind === "FINISHED"
          ? "Finished Goods"
          : "Other Product";
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${map[kind]}`}
    >
      {label}
    </span>
  );
}

/* =========================== Page (Protected) =========================== */
export default function InventoryReportPage() {
  return (
    <Protected permissions="inventoryreport.view">
      <InventoryReportPageInner />
    </Protected>
  );
}

/* =========================== Inner =========================== */
function InventoryReportPageInner() {
  const hasAccess = usePermissionCheck();
  const canView = hasAccess({ permissions: "inventoryreport.view" });
  /* Exports are read-only, gated by same view permission. Kept as a
     separate variable so a dedicated `.export` permission can be added
     later without touching the JSX. */
  const canExport = canView;

  /* ---------- base data ---------- */
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

  /* ---------- UI state ---------- */
  const [activeTab, setActiveTab] = useState<ReportTab>("ALL");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [onlyNonZero, setOnlyNonZero] = useState(false);
  const [showFactories, setShowFactories] = useState(true);
  const [showWarehouses, setShowWarehouses] = useState(true);

  const [viewTab, setViewTab] = useState<ViewTab>("overview");

  /* ---------- filter state ---------- */
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

  /* ---------- load all data ---------- */
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

  /* ---------- location columns ---------- */
  const locations = useMemo(() => {
    const cols: {
      id: string;
      label: string;
      kind: "Factory" | "Warehouse";
    }[] = [];
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

  /* ---------- matrix rows ---------- */
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

  /* ---------- transactions loading ---------- */
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
      if (activeDateRange.end) {
        txs = txs.filter(
          (tx) => new Date(tx.transactionDate) <= activeDateRange.end!,
        );
      }
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

  /* ---------- movement data ---------- */
  const movementData = useMemo(() => {
    if (viewTab !== "movement" || transactions.length === 0) return [];
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

  /* ---------- summaries for tabs ---------- */
  const txSummary = useMemo(() => {
    const totalIn = transactions
      .filter((t) => t.quantity > 0)
      .reduce((a, t) => a + t.quantity, 0);
    const totalOut = transactions
      .filter((t) => t.quantity < 0)
      .reduce((a, t) => a + Math.abs(t.quantity), 0);
    const uniqueItems = new Set(transactions.map((t) => idOf(t.itemId))).size;
    const typeCounts: Record<string, number> = {};
    transactions.forEach((t) => {
      typeCounts[t.transactionType] = (typeCounts[t.transactionType] || 0) + 1;
    });
    return {
      totalIn,
      totalOut,
      count: transactions.length,
      uniqueItems,
      typeCounts,
    };
  }, [transactions]);

  const movementSummary = useMemo(() => {
    const totalItems = movementData.length;
    const totalNetChange = movementData.reduce(
      (a, m) => a + (m.closing - m.opening),
      0,
    );
    return { totalItems, totalNetChange };
  }, [movementData]);

  function exportTransactionsCSV() {
    if (transactions.length === 0)
      return toast.error("No transactions to export");
    const headers = [
      "Date",
      "Type",
      "Item",
      "Location",
      "Qty",
      "Unit Cost",
      "Total Cost",
      "Batch",
    ];
    const csvRows = transactions.map((tx) => {
      const itemName =
        rawMaterials.find((i) => i._id === idOf(tx.itemId))?.name ||
        packagingItems.find((i) => i._id === idOf(tx.itemId))?.name ||
        products.find((i) => i._id === idOf(tx.itemId))?.name ||
        otherProducts.find((i) => i._id === idOf(tx.itemId))?.name ||
        idOf(tx.itemId);
      const locName =
        factories.find((f) => f._id === idOf(tx.locationId))?.name ||
        warehouses.find((w) => w._id === idOf(tx.locationId))?.name ||
        idOf(tx.locationId);
      return [
        new Date(tx.transactionDate).toLocaleDateString(),
        tx.transactionType,
        itemName,
        locName,
        tx.quantity,
        tx.unitCost?.toFixed(2),
        tx.totalCost?.toFixed(2),
        tx.batch || "",
      ]
        .map(csvEscape)
        .join(",");
    });
    const csv = [headers.map(csvEscape).join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stock_transactions_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportMovementCSV() {
    if (movementData.length === 0)
      return toast.error("No movement data to export");
    const headers = [
      "Item",
      "SKU",
      "Unit",
      "Location",
      "Opening",
      "In",
      "Out",
      "Net",
      "Closing",
    ];
    const csvRows = movementData.map((m) =>
      [
        m.itemName,
        m.sku,
        m.unit,
        m.locationName,
        m.opening,
        m.inward,
        m.outward,
        m.inward - m.outward,
        m.closing,
      ]
        .map(csvEscape)
        .join(","),
    );
    const csv = [headers.map(csvEscape).join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stock_movement_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* =========================== Render =========================== */
  return (
    <div className="min-h-screen bg-slate-50/60 p-4 dark:bg-slate-950 md:p-6">
      <div className="mx-auto max-w-[1600px] space-y-5">
        {/* ============ HERO ============ */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-6">
          <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-[#3aa838]/5 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-emerald-500/5 blur-3xl" />

          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                  <BarChart3 className="h-2.5 w-2.5" />
                  Reports
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-[#3aa838]/30 bg-[#3aa838]/5 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#2f8a2f] dark:border-[#3aa838]/30 dark:bg-[#3aa838]/10 dark:text-[#9bdd91]">
                  <PackageOpen className="h-2.5 w-2.5" />
                  Inventory
                </span>
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white md:text-3xl">
                Inventory Report
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                Complete stock matrix, transactions, and movement analysis
                across factories and warehouses.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadRefsAndData()}
                disabled={loading}
                className="h-9 gap-1.5"
              >
                <RefreshCcw
                  className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
              {canExport && (
                <Button
                  size="sm"
                  onClick={exportCsv}
                  disabled={loading || visibleRows.length === 0}
                  className="h-9 gap-1.5 bg-[#3aa838] text-white shadow-sm shadow-[#3aa838]/20 hover:bg-[#2f8a2f]"
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
              )}
            </div>
          </div>

          {/* Summary cards */}
          <div className="relative mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={Box}
              label="Total Items"
              value={rows.length}
              hint="Across all categories"
              tone="slate"
            />
            <StatCard
              icon={TrendingUp}
              label="Total Stock"
              value={
                totalsByColumn.totalFactory + totalsByColumn.totalWarehouse
              }
              hint="Factory + Warehouse"
              tone="green"
            />
            <StatCard
              icon={DollarSign}
              label="Stock Value"
              value="-"
              hint="Awaiting valuation"
              tone="amber"
            />
            <StatCard
              icon={Building2}
              label="Locations"
              value={factories.length + warehouses.length}
              hint={`${factories.length} factories · ${warehouses.length} warehouses`}
              tone="sky"
            />
          </div>
        </div>

        {/* ============ FILTERS ============ */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div
            className="flex cursor-pointer items-center justify-between p-4"
            onClick={() => setShowFilters(!showFilters)}
          >
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <Filter className="h-3.5 w-3.5 text-[#3aa838]" />
              Filters & Date Range
            </h2>
            {showFilters ? (
              <ChevronUp className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )}
          </div>
          {showFilters && (
            <div className="grid grid-cols-1 gap-3 p-4 pt-0 md:grid-cols-4">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
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
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-[#3aa838]/40 focus:ring-2 focus:ring-[#3aa838]/10 dark:border-slate-800 dark:bg-slate-900"
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
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      From
                    </label>
                    <Input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      To
                    </label>
                    <Input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                </>
              )}
              <div className="md:col-span-2">
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
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
                  size="sm"
                  className="h-9 gap-1.5 bg-[#3aa838] text-white shadow-sm shadow-[#3aa838]/20 hover:bg-[#2f8a2f]"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  Apply Filters
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ============ MAIN TABS ============ */}
        <Tabs value={viewTab} onValueChange={(v) => setViewTab(v as ViewTab)}>
          <div className="mb-4 flex justify-center">
            <TabsList className="border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
              <TabsTrigger
                value="overview"
                className="gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold data-[state=active]:bg-[#3aa838] data-[state=active]:text-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-[#3aa838] dark:data-[state=active]:text-white"
              >
                <PackageOpen className="h-3.5 w-3.5" />
                Stock Overview
              </TabsTrigger>
              <TabsTrigger
                value="transactions"
                className="gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold data-[state=active]:bg-[#3aa838] data-[state=active]:text-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-[#3aa838] dark:data-[state=active]:text-white"
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
                Transactions
              </TabsTrigger>
              <TabsTrigger
                value="movement"
                className="gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold data-[state=active]:bg-[#3aa838] data-[state=active]:text-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-[#3aa838] dark:data-[state=active]:text-white"
              >
                <TrendingUp className="h-3.5 w-3.5" />
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
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <TabsList className="w-full border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900 md:w-auto">
                    <TabsTrigger
                      value="ALL"
                      className="gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold data-[state=active]:bg-[#3aa838] data-[state=active]:text-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-[#3aa838] dark:data-[state=active]:text-white"
                    >
                      <PackageOpen className="h-3.5 w-3.5" /> All
                      <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold">
                        {rows.length}
                      </span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="RAW"
                      className="gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold data-[state=active]:bg-[#3aa838] data-[state=active]:text-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-[#3aa838] dark:data-[state=active]:text-white"
                    >
                      <Package className="h-3.5 w-3.5" /> Raw
                      <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold">
                        {countsByKind.RAW}
                      </span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="PACK"
                      className="gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold data-[state=active]:bg-[#3aa838] data-[state=active]:text-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-[#3aa838] dark:data-[state=active]:text-white"
                    >
                      <Package className="h-3.5 w-3.5" /> Packing
                      <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold">
                        {countsByKind.PACK}
                      </span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="FINISHED"
                      className="gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold data-[state=active]:bg-[#3aa838] data-[state=active]:text-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-[#3aa838] dark:data-[state=active]:text-white"
                    >
                      <PackageOpen className="h-3.5 w-3.5" /> Finished
                      <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold">
                        {countsByKind.FINISHED}
                      </span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="OTHER"
                      className="gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold data-[state=active]:bg-[#3aa838] data-[state=active]:text-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-[#3aa838] dark:data-[state=active]:text-white"
                    >
                      <PackageOpen className="h-3.5 w-3.5" /> Other
                      <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold">
                        {countsByKind.OTHER}
                      </span>
                    </TabsTrigger>
                  </TabsList>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                      <Input
                        value={q}
                        placeholder="Search name / SKU…"
                        onChange={(e) => setQ(e.target.value)}
                        className="h-9 w-56 pl-9 text-sm"
                      />
                    </div>
                    <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={onlyNonZero}
                        onChange={(e) => setOnlyNonZero(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-[#3aa838] focus:ring-[#3aa838]/30"
                      />
                      Non-zero
                    </label>
                    <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={showFactories}
                        onChange={(e) => setShowFactories(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-[#3aa838] focus:ring-[#3aa838]/30"
                      />
                      Factories
                    </label>
                    <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={showWarehouses}
                        onChange={(e) => setShowWarehouses(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-[#3aa838] focus:ring-[#3aa838]/30"
                      />
                      Warehouses
                    </label>
                  </div>
                </div>
              </div>

              <TabsContent value={activeTab} className="mt-4">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="max-h-[65vh] overflow-auto">
                    <Table>
                      <TableHeader className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-950">
                        <TableRow className="border-b border-slate-200 dark:border-slate-800">
                          <TableHead className="w-10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            #
                          </TableHead>
                          <TableHead className="min-w-64 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Item
                          </TableHead>
                          <TableHead className="min-w-32 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Type
                          </TableHead>
                          <TableHead className="min-w-28 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            SKU
                          </TableHead>
                          <TableHead className="min-w-20 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Unit
                          </TableHead>
                          {factoryCols.length > 0 && (
                            <TableHead
                              colSpan={factoryCols.length}
                              className="border-l border-slate-200 px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400"
                            >
                              <span className="inline-flex items-center gap-1">
                                <FactoryIcon className="h-3 w-3 text-[#3aa838]" />
                                Factories
                              </span>
                            </TableHead>
                          )}
                          {warehouseCols.length > 0 && (
                            <TableHead
                              colSpan={warehouseCols.length}
                              className="border-l border-slate-200 px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400"
                            >
                              <span className="inline-flex items-center gap-1">
                                <WarehouseIcon className="h-3 w-3 text-[#3aa838]" />
                                Warehouses
                              </span>
                            </TableHead>
                          )}
                          <TableHead className="min-w-24 border-l border-slate-200 px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400">
                            Factory
                          </TableHead>
                          <TableHead className="min-w-24 px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Warehouse
                          </TableHead>
                          <TableHead className="min-w-24 px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Total
                          </TableHead>
                        </TableRow>
                        <TableRow className="border-b border-slate-200 dark:border-slate-800">
                          <TableHead />
                          <TableHead />
                          <TableHead />
                          <TableHead />
                          <TableHead />
                          {factoryCols.map((c) => (
                            <TableHead
                              key={c.id}
                              className="min-w-32 px-3 py-2 text-[10px] font-medium text-slate-600 dark:text-slate-400"
                            >
                              {c.label}
                            </TableHead>
                          ))}
                          {warehouseCols.map((c) => (
                            <TableHead
                              key={c.id}
                              className="min-w-32 px-3 py-2 text-[10px] font-medium text-slate-600 dark:text-slate-400"
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
                              className="py-10 text-center text-xs text-slate-400"
                            >
                              <RefreshCcw className="mx-auto mb-2 h-5 w-5 animate-spin" />
                              Loading…
                            </TableCell>
                          </TableRow>
                        )}
                        {!loading &&
                          groupedRows.map((g) => (
                            <React.Fragment key={g.label || "rows"}>
                              {g.label && g.rows.length > 0 && (
                                <TableRow className="bg-slate-50/80 dark:bg-slate-950/40">
                                  <TableCell
                                    colSpan={
                                      8 +
                                      factoryCols.length +
                                      warehouseCols.length
                                    }
                                    className="py-2 font-semibold text-slate-900 dark:text-white"
                                  >
                                    <span className="text-xs font-bold uppercase tracking-wider">
                                      {g.label}
                                    </span>
                                    <span className="ml-2 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                      {g.rows.length}
                                    </span>
                                  </TableCell>
                                </TableRow>
                              )}
                              {g.rows.map((r, idx) => (
                                <TableRow
                                  key={r.key}
                                  className="border-b border-slate-100 transition-colors hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/30"
                                >
                                  <TableCell className="px-3 py-2 text-xs text-slate-400">
                                    {idx + 1}
                                  </TableCell>
                                  <TableCell className="px-3 py-2">
                                    <div className="text-sm font-medium text-slate-900 dark:text-white">
                                      {r.name}
                                    </div>
                                  </TableCell>
                                  <TableCell className="px-3 py-2">
                                    <KindBadge kind={r.kind} />
                                  </TableCell>
                                  <TableCell className="px-3 py-2 font-mono text-xs text-slate-600 dark:text-slate-400">
                                    {r.sku}
                                  </TableCell>
                                  <TableCell className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400">
                                    {r.unit}
                                  </TableCell>
                                  {factoryCols.map((c) => (
                                    <TableCell
                                      key={c.id}
                                      className="px-3 py-2 text-xs tabular-nums text-slate-700 dark:text-slate-300"
                                    >
                                      {r.totals[c.id] ?? 0}
                                    </TableCell>
                                  ))}
                                  {warehouseCols.map((c) => (
                                    <TableCell
                                      key={c.id}
                                      className="px-3 py-2 text-xs tabular-nums text-slate-700 dark:text-slate-300"
                                    >
                                      {r.totals[c.id] ?? 0}
                                    </TableCell>
                                  ))}
                                  <TableCell className="border-l border-slate-200 px-3 py-2 text-right text-xs font-medium tabular-nums text-slate-900 dark:border-slate-800 dark:text-white">
                                    {r.totalFactory}
                                  </TableCell>
                                  <TableCell className="px-3 py-2 text-right text-xs font-medium tabular-nums text-slate-900 dark:text-white">
                                    {r.totalWarehouse}
                                  </TableCell>
                                  <TableCell className="px-3 py-2 text-right text-xs font-bold tabular-nums text-[#2f8a2f] dark:text-[#9bdd91]">
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
                              className="py-14 text-center"
                            >
                              <div className="mx-auto max-w-sm">
                                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                                  <Inbox className="h-6 w-6 text-slate-400" />
                                </div>
                                <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
                                  No rows to display
                                </p>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                  Adjust filters or search to see items.
                                </p>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                        {!loading && visibleRows.length > 0 && (
                          <TableRow className="sticky bottom-0 z-20 border-t-2 border-[#3aa838] bg-slate-50 dark:border-[#3aa838] dark:bg-slate-950">
                            <TableCell />
                            <TableCell className="text-xs font-bold text-slate-900 dark:text-white">
                              Totals
                            </TableCell>
                            <TableCell />
                            <TableCell />
                            <TableCell />
                            {factoryCols.map((c) => (
                              <TableCell
                                key={c.id}
                                className="text-xs font-bold tabular-nums text-slate-900 dark:text-white"
                              >
                                {totalsByColumn.colTotals[c.id] ?? 0}
                              </TableCell>
                            ))}
                            {warehouseCols.map((c) => (
                              <TableCell
                                key={c.id}
                                className="text-xs font-bold tabular-nums text-slate-900 dark:text-white"
                              >
                                {totalsByColumn.colTotals[c.id] ?? 0}
                              </TableCell>
                            ))}
                            <TableCell className="border-l border-slate-200 text-right text-xs font-bold tabular-nums text-slate-900 dark:border-slate-800 dark:text-white">
                              {totalsByColumn.totalFactory}
                            </TableCell>
                            <TableCell className="text-right text-xs font-bold tabular-nums text-slate-900 dark:text-white">
                              {totalsByColumn.totalWarehouse}
                            </TableCell>
                            <TableCell className="text-right text-xs font-bold tabular-nums text-[#2f8a2f] dark:text-[#9bdd91]">
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
            <div className="space-y-4">
              {transactions.length > 0 && (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <StatCard
                    icon={ArrowDownIcon}
                    label="Total Inward"
                    value={txSummary.totalIn}
                    hint="Items received"
                    tone="green"
                  />
                  <StatCard
                    icon={ArrowUpIcon}
                    label="Total Outward"
                    value={txSummary.totalOut}
                    hint="Items dispatched"
                    tone="amber"
                  />
                  <StatCard
                    icon={Layers}
                    label="Transactions"
                    value={txSummary.count}
                    hint="In selected period"
                    tone="slate"
                  />
                  <StatCard
                    icon={Package}
                    label="Unique Items"
                    value={txSummary.uniqueItems}
                    hint="Distinct SKUs"
                    tone="sky"
                  />
                </div>
              )}

              {Object.keys(txSummary.typeCounts).length > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                  {Object.entries(txSummary.typeCounts).map(([type, count]) => (
                    <span
                      key={type}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                      {type}
                      <span className="font-bold">{count}</span>
                    </span>
                  ))}
                  {canExport && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportTransactionsCSV}
                      className="ml-auto h-8 gap-1.5 text-xs"
                    >
                      <Download className="h-3.5 w-3.5" /> Export
                    </Button>
                  )}
                </div>
              )}

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                {txLoading ? (
                  <div className="flex flex-col items-center gap-2 p-10 text-slate-500 dark:text-slate-400">
                    <RefreshCcw className="h-5 w-5 animate-spin" />
                    <span className="text-xs">Loading transactions…</span>
                  </div>
                ) : (
                  <div className="max-h-[60vh] overflow-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-slate-50 dark:bg-slate-950">
                        <TableRow className="border-b border-slate-200 dark:border-slate-800">
                          {[
                            "Date",
                            "Type",
                            "Item",
                            "Location",
                            "Qty",
                            "Unit Cost",
                            "Total Cost",
                            "Batch",
                          ].map((h, i) => (
                            <TableHead
                              key={h}
                              className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${i >= 4 && i <= 6 ? "text-right" : ""}`}
                            >
                              {h}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map((tx) => {
                          const itemName =
                            rawMaterials.find(
                              (i) => i._id === idOf(tx.itemId),
                            )?.name ||
                            packagingItems.find(
                              (i) => i._id === idOf(tx.itemId),
                            )?.name ||
                            products.find((i) => i._id === idOf(tx.itemId))
                              ?.name ||
                            otherProducts.find(
                              (i) => i._id === idOf(tx.itemId),
                            )?.name ||
                            idOf(tx.itemId);
                          const locName =
                            factories.find(
                              (f) => f._id === idOf(tx.locationId),
                            )?.name ||
                            warehouses.find(
                              (w) => w._id === idOf(tx.locationId),
                            )?.name ||
                            idOf(tx.locationId);
                          const typeTone =
                            tx.transactionType === "purchase"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60"
                              : tx.transactionType === "sale"
                                ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60"
                                : tx.transactionType === "transfer_in"
                                  ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/60"
                                  : "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
                          return (
                            <TableRow
                              key={tx._id}
                              className="border-b border-slate-100 transition-colors hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/30"
                            >
                              <TableCell className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400">
                                {new Date(
                                  tx.transactionDate,
                                ).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="px-3 py-2">
                                <span
                                  className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold capitalize ${typeTone}`}
                                >
                                  {tx.transactionType}
                                </span>
                              </TableCell>
                              <TableCell className="px-3 py-2 text-xs font-medium text-slate-900 dark:text-white">
                                {itemName}
                              </TableCell>
                              <TableCell className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400">
                                {locName}
                              </TableCell>
                              <TableCell
                                className={`px-3 py-2 text-right text-xs font-mono font-semibold ${
                                  tx.quantity >= 0
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-rose-600 dark:text-rose-400"
                                }`}
                              >
                                {tx.quantity > 0 ? "+" : ""}
                                {tx.quantity}
                              </TableCell>
                              <TableCell className="px-3 py-2 text-right text-xs text-slate-600 dark:text-slate-400">
                                ৳ {tx.unitCost?.toFixed(2)}
                              </TableCell>
                              <TableCell className="px-3 py-2 text-right text-xs font-medium text-slate-900 dark:text-white">
                                ৳ {tx.totalCost?.toFixed(2)}
                              </TableCell>
                              <TableCell className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                                {tx.batch || "-"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {transactions.length === 0 && (
                          <TableRow>
                            <TableCell
                              colSpan={8}
                              className="py-14 text-center"
                            >
                              <div className="mx-auto max-w-sm">
                                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                                  <BarChart3 className="h-6 w-6 text-slate-400" />
                                </div>
                                <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
                                  No transactions for this period
                                </p>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                  Try a different date range or item filter.
                                </p>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ---------- Stock Movement ---------- */}
          <TabsContent value="movement" className="mt-0">
            <div className="space-y-4">
              {movementData.length > 0 && (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  <StatCard
                    icon={Layers}
                    label="Items with Movement"
                    value={movementSummary.totalItems}
                    hint="Active in period"
                    tone="amber"
                  />
                  <StatCard
                    icon={ArrowRight}
                    label="Net Change"
                    value={`${movementSummary.totalNetChange > 0 ? "+" : ""}${movementSummary.totalNetChange}`}
                    hint="Across all items"
                    tone="green"
                  />
                  {canExport && (
                    <div className="flex items-end justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={exportMovementCSV}
                        className="h-9 gap-1.5"
                      >
                        <Download className="h-3.5 w-3.5" /> Export
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                {movementData.length === 0 ? (
                  <div className="p-14 text-center">
                    <div className="mx-auto max-w-sm">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                        <TrendingUp className="h-6 w-6 text-slate-400" />
                      </div>
                      <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
                        No movement data
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Apply a date range to see stock movement.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="max-h-[60vh] overflow-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-slate-50 dark:bg-slate-950">
                        <TableRow className="border-b border-slate-200 dark:border-slate-800">
                          {[
                            "Item",
                            "Location",
                            "Opening",
                            "In",
                            "Out",
                            "Net",
                            "Closing",
                          ].map((h, i) => (
                            <TableHead
                              key={h}
                              className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${i >= 2 ? "text-right" : ""}`}
                            >
                              {h}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {movementData.map((m) => {
                          const net = m.inward - m.outward;
                          return (
                            <TableRow
                              key={`${m.itemId}_${m.locationId}`}
                              className="border-b border-slate-100 transition-colors hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/30"
                            >
                              <TableCell className="px-3 py-2">
                                <div className="text-sm font-medium text-slate-900 dark:text-white">
                                  {m.itemName}
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                  {m.sku} · {m.unit}
                                </div>
                              </TableCell>
                              <TableCell className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400">
                                {m.locationName}
                              </TableCell>
                              <TableCell className="px-3 py-2 text-right text-xs tabular-nums text-slate-700 dark:text-slate-300">
                                {m.opening}
                              </TableCell>
                              <TableCell className="px-3 py-2 text-right text-xs font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                                +{m.inward}
                              </TableCell>
                              <TableCell className="px-3 py-2 text-right text-xs font-medium tabular-nums text-rose-600 dark:text-rose-400">
                                -{m.outward}
                              </TableCell>
                              <TableCell
                                className={`px-3 py-2 text-right text-xs font-semibold tabular-nums ${
                                  net >= 0
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-rose-600 dark:text-rose-400"
                                }`}
                              >
                                {net > 0 ? "+" : ""}
                                {net}
                              </TableCell>
                              <TableCell className="px-3 py-2 text-right text-xs font-bold tabular-nums text-[#2f8a2f] dark:text-[#9bdd91]">
                                {m.closing}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}