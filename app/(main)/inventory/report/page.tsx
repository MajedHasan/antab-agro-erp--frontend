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
} from "lucide-react";

type Warehouse = { _id: string; name?: string; code?: string; type?: string };

type RawMaterial = { _id: string; name: string; sku: string; unit?: string };
type RawMaterialStock = {
  _id?: string;
  rawMaterialId: string | any;
  factoryId: string | any;
  quantity: number;
  unit?: string;
};

type PackagingItem = { _id: string; name: string; sku: string; unit?: string };
type PackagingStock = {
  _id?: string;
  packagingItemId: string | any;
  factoryId: string | any;
  quantity: number;
  unit?: string;
};

type Product = {
  _id: string;
  name: string;
  sku: string;
  unit?: string;
  category?: string | null;
};
type ProductStock = {
  _id?: string;
  productId: string | any;
  warehouseId: string | any;
  quantity: number;
  unit?: string;
  reservedForSales?: number;
  reservedForTransfer?: number;
  incomingTransfer?: number;
};

type ReportKind = "RAW" | "PACK" | "OTHER" | "FINISHED";
type ReportTab = "ALL" | ReportKind;

type ReportRow = {
  key: string;
  kind: ReportKind;
  name: string;
  sku: string;
  unit: string;
  totals: Record<string, number>; // locationId -> qty
  totalFactory: number;
  totalWarehouse: number;
  grandTotal: number;
};

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

function normalizeKindFromProductCategory(category?: string | null): ReportKind {
  const c = String(category ?? "").toLowerCase();
  if (c.includes("finish") || c.includes("fg") || c.includes("goods"))
    return "FINISHED";
  return "OTHER";
}

function csvEscape(s: any) {
  if (s === null || s === undefined) return "";
  return `"${String(s).replace(/"/g, '""')}"`;
}

export default function InventoryReportPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>("ALL");

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [factories, setFactories] = useState<Warehouse[]>([]);

  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [rawStocks, setRawStocks] = useState<RawMaterialStock[]>([]);

  const [packagingItems, setPackagingItems] = useState<PackagingItem[]>([]);
  const [packStocks, setPackStocks] = useState<PackagingStock[]>([]);

  const [products, setProducts] = useState<Product[]>([]);
  const [productStocks, setProductStocks] = useState<ProductStock[]>([]);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [onlyNonZero, setOnlyNonZero] = useState(false);
  const [showFactories, setShowFactories] = useState(true);
  const [showWarehouses, setShowWarehouses] = useState(true);

  const [loading, setLoading] = useState(false);
  const mounted = useRef(true);

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
      ] = await Promise.all([
        api.get("/warehouses", { params: { type: "Warehouse", page: 1, limit: 5000 } }),
        api.get("/warehouses", { params: { type: "Factory", page: 1, limit: 5000 } }),
        api.get("/raw-materials", { params: { page: 1, limit: 10000 } }),
        api.get("/raw-material-stocks", { params: { page: 1, limit: 100000 } }),
        api.get("/packaging-items", { params: { page: 1, limit: 10000 } }),
        api.get("/packaging-stocks", { params: { page: 1, limit: 100000 } }),
        api.get("/products", { params: { page: 1, limit: 10000 } }),
        api.get("/product-stocks", { params: { page: 1, limit: 200000 } }),
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
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to load inventory report");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

  useEffect(() => {
    loadRefsAndData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const rows: ReportRow[] = useMemo(() => {
    const search = debouncedQ.toLowerCase();
    const match = (name?: string, sku?: string) => {
      if (!search) return true;
      return (
        String(name ?? "").toLowerCase().includes(search) ||
        String(sku ?? "").toLowerCase().includes(search)
      );
    };

    const result: ReportRow[] = [];

    // --- RAW MATERIALS (factories only; warehouses will remain 0) ---
    {
      const totalsByMaterialFactory = new Map<string, number>(); // `${materialId}_${factoryId}`
      for (const s of rawStocks) {
        const mid = idOf(s.rawMaterialId);
        const fid = idOf(s.factoryId);
        if (!mid || !fid) continue;
        const key = `${mid}_${fid}`;
        totalsByMaterialFactory.set(
          key,
          (totalsByMaterialFactory.get(key) || 0) + safeNum(s.quantity),
        );
      }

      for (const m of rawMaterials) {
        if (!match(m.name, m.sku)) continue;
        const totals: Record<string, number> = {};
        let totalFactory = 0;
        for (const f of factories) {
          const qty = totalsByMaterialFactory.get(`${m._id}_${f._id}`) || 0;
          totals[f._id] = qty;
          totalFactory += qty;
        }
        // keep warehouse columns for unified table (0 by default)
        for (const w of warehouses) totals[w._id] = totals[w._id] ?? 0;

        const grandTotal = totalFactory;
        if (onlyNonZero && grandTotal === 0) continue;
        result.push({
          key: `RAW_${m._id}`,
          kind: "RAW",
          name: m.name,
          sku: m.sku,
          unit: m.unit || "kg",
          totals,
          totalFactory,
          totalWarehouse: 0,
          grandTotal,
        });
      }
    }

    // --- PACKING MATERIALS (factories only; warehouses will remain 0) ---
    {
      const totalsByItemFactory = new Map<string, number>();
      for (const s of packStocks) {
        const pid = idOf(s.packagingItemId);
        const fid = idOf(s.factoryId);
        if (!pid || !fid) continue;
        const key = `${pid}_${fid}`;
        totalsByItemFactory.set(
          key,
          (totalsByItemFactory.get(key) || 0) + safeNum(s.quantity),
        );
      }

      for (const it of packagingItems) {
        if (!match(it.name, it.sku)) continue;
        const totals: Record<string, number> = {};
        let totalFactory = 0;
        for (const f of factories) {
          const qty = totalsByItemFactory.get(`${it._id}_${f._id}`) || 0;
          totals[f._id] = qty;
          totalFactory += qty;
        }
        for (const w of warehouses) totals[w._id] = totals[w._id] ?? 0;

        const grandTotal = totalFactory;
        if (onlyNonZero && grandTotal === 0) continue;
        result.push({
          key: `PACK_${it._id}`,
          kind: "PACK",
          name: it.name,
          sku: it.sku,
          unit: it.unit || "pcs",
          totals,
          totalFactory,
          totalWarehouse: 0,
          grandTotal,
        });
      }
    }

    // --- PRODUCTS (warehouses + factories via product-stocks) ---
    {
      const totalsByProductLocation = new Map<string, number>(); // `${productId}_${warehouseId}`
      for (const s of productStocks) {
        const pid = idOf(s.productId);
        const wid = idOf(s.warehouseId);
        if (!pid || !wid) continue;
        totalsByProductLocation.set(
          `${pid}_${wid}`,
          (totalsByProductLocation.get(`${pid}_${wid}`) || 0) + safeNum(s.quantity),
        );
      }

      const factoryIds = new Set(factories.map((f) => f._id));
      const warehouseIds = new Set(warehouses.map((w) => w._id));

      for (const p of products) {
        const kind = normalizeKindFromProductCategory(p.category);
        if (!match(p.name, p.sku)) continue;

        const totals: Record<string, number> = {};
        let totalFactory = 0;
        let totalWarehouse = 0;

        // Always compute both (even if columns are hidden)
        for (const f of factories) {
          const qty = totalsByProductLocation.get(`${p._id}_${f._id}`) || 0;
          totals[f._id] = qty;
          totalFactory += qty;
        }
        for (const w of warehouses) {
          const qty = totalsByProductLocation.get(`${p._id}_${w._id}`) || 0;
          totals[w._id] = qty;
          totalWarehouse += qty;
        }

        // sanity (in case you store product stocks for unknown locations)
        for (const [locId, qty] of Object.entries(totals)) {
          if (factoryIds.has(locId)) totalFactory += 0;
          if (warehouseIds.has(locId)) totalWarehouse += 0;
          totals[locId] = safeNum(qty);
        }

        const grandTotal = totalFactory + totalWarehouse;
        if (onlyNonZero && grandTotal === 0) continue;
        result.push({
          key: `${kind}_${p._id}`,
          kind,
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

    // stable sort by name, then sku
    result.sort((a, b) => {
      const n = a.name.localeCompare(b.name);
      if (n !== 0) return n;
      return a.sku.localeCompare(b.sku);
    });

    return result;
  }, [
    debouncedQ,
    factories,
    warehouses,
    onlyNonZero,
    rawMaterials,
    rawStocks,
    packagingItems,
    packStocks,
    products,
    productStocks,
  ]);

  const visibleRows = useMemo(() => {
    if (activeTab === "ALL") return rows;
    return rows.filter((r) => r.kind === activeTab);
  }, [rows, activeTab]);

  const effectiveColumns = useMemo(() => {
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
    for (const col of effectiveColumns) colTotals[col.id] = 0;
    let totalFactory = 0;
    let totalWarehouse = 0;
    let grandTotal = 0;
    for (const r of visibleRows) {
      for (const col of effectiveColumns) {
        colTotals[col.id] += safeNum(r.totals[col.id] ?? 0);
      }
      totalFactory += safeNum(r.totalFactory);
      totalWarehouse += safeNum(r.totalWarehouse);
      grandTotal += safeNum(r.grandTotal);
    }
    return { colTotals, totalFactory, totalWarehouse, grandTotal };
  }, [effectiveColumns, visibleRows]);

  function kindLabel(k: ReportKind) {
    if (k === "RAW") return "Raw Material";
    if (k === "PACK") return "Packing";
    if (k === "FINISHED") return "Finished Goods";
    return "Other Product";
  }

  function kindBadgeVariant(k: ReportKind): React.ComponentProps<
    typeof Badge
  >["variant"] {
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
      ...effectiveColumns.map((c) => c.label),
      "total_factory",
      "total_warehouse",
      "grand_total",
    ];

    const csvRows = visibleRows.map((r) => {
      const cells = [
        csvEscape(r.kind),
        csvEscape(r.name),
        csvEscape(r.sku),
        csvEscape(r.unit),
        ...effectiveColumns.map((c) => csvEscape(r.totals[c.id] ?? 0)),
        csvEscape(r.totalFactory),
        csvEscape(r.totalWarehouse),
        csvEscape(r.grandTotal),
      ];
      return cells.join(",");
    });

    const csv = [headers.map(csvEscape).join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory_report_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const factoryCols = useMemo(
    () => effectiveColumns.filter((c) => c.kind === "Factory"),
    [effectiveColumns],
  );
  const warehouseCols = useMemo(
    () => effectiveColumns.filter((c) => c.kind === "Warehouse"),
    [effectiveColumns],
  );

  const groupedRows = useMemo(() => {
    if (activeTab !== "ALL") return [{ label: "", rows: visibleRows }];
    const groups: Array<{ label: string; kind: ReportKind; rows: ReportRow[] }> =
      [
        { label: "Raw Materials", kind: "RAW", rows: [] },
        { label: "Packing Materials", kind: "PACK", rows: [] },
        { label: "Finished Goods", kind: "FINISHED", rows: [] },
        { label: "Other Products", kind: "OTHER", rows: [] },
      ];
    const map = new Map<ReportKind, (typeof groups)[number]>();
    for (const g of groups) map.set(g.kind, g);
    for (const r of visibleRows) map.get(r.kind)?.rows.push(r);
    return groups.map((g) => ({
      label: g.label,
      rows: g.rows,
    }));
  }, [activeTab, visibleRows]);

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory Report</h1>
          <p className="text-sm text-muted-foreground">
            Fast, readable stock matrix across factories and warehouses.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5">
              <FactoryIcon className="h-3.5 w-3.5" />
              {factories.length} factories
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5">
              <WarehouseIcon className="h-3.5 w-3.5" />
              {warehouses.length} warehouses
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5">
              <Package className="h-3.5 w-3.5" />
              {rows.length} items
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => loadRefsAndData()} disabled={loading}>
            <RefreshCcw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={exportCsv} disabled={loading || visibleRows.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* tabs + controls */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ReportTab)}>
        <div className="flex flex-col gap-3">
          <TabsList className="w-full">
            <TabsTrigger value="ALL" className="gap-2">
              <PackageOpen className="h-4 w-4" />
              All
              <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                {rows.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="RAW" className="gap-2">
              <Package className="h-4 w-4" />
              Raw
              <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                {countsByKind.RAW}
              </span>
            </TabsTrigger>
            <TabsTrigger value="PACK" className="gap-2">
              <Package className="h-4 w-4" />
              Packing
              <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                {countsByKind.PACK}
              </span>
            </TabsTrigger>
            <TabsTrigger value="FINISHED" className="gap-2">
              <PackageOpen className="h-4 w-4" />
              Finished
              <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                {countsByKind.FINISHED}
              </span>
            </TabsTrigger>
            <TabsTrigger value="OTHER" className="gap-2">
              <PackageOpen className="h-4 w-4" />
              Other
              <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                {countsByKind.OTHER}
              </span>
            </TabsTrigger>
          </TabsList>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-xl border bg-card p-3">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <Input
                value={q}
                placeholder="Search item name or SKU…"
                onChange={(e) => setQ(e.target.value)}
                className="md:w-80"
              />
              <label className="text-sm whitespace-nowrap flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={onlyNonZero}
                  onChange={(e) => setOnlyNonZero(e.target.checked)}
                />
                Only non-zero
              </label>
            </div>

            <div className="flex items-center gap-4">
              <label className="text-sm whitespace-nowrap flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showFactories}
                  onChange={(e) => setShowFactories(e.target.checked)}
                />
                Factories
              </label>
              <label className="text-sm whitespace-nowrap flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showWarehouses}
                  onChange={(e) => setShowWarehouses(e.target.checked)}
                />
                Warehouses
              </label>
            </div>
          </div>
        </div>

        <TabsContent value={activeTab} className="mt-4">
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="max-h-[72vh] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b">
                  {/* Grouped header */}
                  <TableRow>
                    <TableHead className="sticky left-0 z-30 bg-background/95 backdrop-blur w-10" />
                    <TableHead className="sticky left-10 z-30 bg-background/95 backdrop-blur min-w-64">
                      Item
                    </TableHead>
                    <TableHead className="sticky left-[18.5rem] z-30 bg-background/95 backdrop-blur min-w-32">
                      Type
                    </TableHead>
                    <TableHead className="min-w-28">SKU</TableHead>
                    <TableHead className="min-w-20">Unit</TableHead>
                    {factoryCols.length > 0 && (
                      <TableHead colSpan={factoryCols.length} className="text-center">
                        <span className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                          <FactoryIcon className="h-4 w-4" />
                          Factories
                        </span>
                      </TableHead>
                    )}
                    {warehouseCols.length > 0 && (
                      <TableHead
                        colSpan={warehouseCols.length}
                        className="text-center"
                      >
                        <span className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                          <WarehouseIcon className="h-4 w-4" />
                          Warehouses
                        </span>
                      </TableHead>
                    )}
                    <TableHead className="min-w-28 text-right">Factory</TableHead>
                    <TableHead className="min-w-28 text-right">Warehouse</TableHead>
                    <TableHead className="min-w-28 text-right">Total</TableHead>
                  </TableRow>

                  {/* Location header row */}
                  <TableRow>
                    <TableHead className="sticky left-0 z-30 bg-background/95 backdrop-blur w-10">
                      #
                    </TableHead>
                    <TableHead className="sticky left-10 z-30 bg-background/95 backdrop-blur min-w-64" />
                    <TableHead className="sticky left-[18.5rem] z-30 bg-background/95 backdrop-blur min-w-32" />
                    <TableHead className="min-w-28" />
                    <TableHead className="min-w-20" />
                    {factoryCols.map((c) => (
                      <TableHead key={c.id} className="min-w-44">
                        {c.label}
                      </TableHead>
                    ))}
                    {warehouseCols.map((c) => (
                      <TableHead key={c.id} className="min-w-44">
                        {c.label}
                      </TableHead>
                    ))}
                    <TableHead className="min-w-28 text-right" />
                    <TableHead className="min-w-28 text-right" />
                    <TableHead className="min-w-28 text-right" />
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell
                        colSpan={
                          8 + factoryCols.length + warehouseCols.length
                        }
                        className="py-10 text-center"
                      >
                        Loading…
                      </TableCell>
                    </TableRow>
                  )}

                  {!loading &&
                    groupedRows.map((g) => (
                      <React.Fragment key={g.label || "rows"}>
                        {g.label && (
                          <TableRow className="bg-muted/40">
                            <TableCell
                              colSpan={
                                8 + factoryCols.length + warehouseCols.length
                              }
                              className="py-3 font-semibold"
                            >
                              {g.label}
                              <span className="ml-2 text-xs text-muted-foreground font-normal">
                                ({g.rows.length})
                              </span>
                            </TableCell>
                          </TableRow>
                        )}

                        {g.rows.map((r, idx) => {
                          const rowIndex =
                            activeTab === "ALL"
                              ? idx + 1
                              : idx + 1;
                          return (
                            <TableRow key={r.key} className="hover:bg-muted/40">
                              <TableCell className="sticky left-0 z-10 bg-card w-10">
                                {rowIndex}
                              </TableCell>
                              <TableCell className="sticky left-10 z-10 bg-card min-w-64">
                                <div className="font-medium">{r.name}</div>
                              </TableCell>
                              <TableCell className="sticky left-[18.5rem] z-10 bg-card min-w-32">
                                <Badge variant={kindBadgeVariant(r.kind)}>
                                  {kindLabel(r.kind)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm">{r.sku}</TableCell>
                              <TableCell className="text-sm">{r.unit}</TableCell>
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
                              <TableCell className="text-right font-bold tabular-nums">
                                {r.grandTotal}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </React.Fragment>
                    ))}

                  {!loading && visibleRows.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={8 + factoryCols.length + warehouseCols.length}
                        className="py-10 text-center text-muted-foreground"
                      >
                        No rows found
                      </TableCell>
                    </TableRow>
                  )}

                  {!loading && visibleRows.length > 0 && (
                    <TableRow className="sticky bottom-0 z-20 bg-background/95 backdrop-blur border-t">
                      <TableCell className="sticky left-0 z-30 bg-background/95 backdrop-blur w-10" />
                      <TableCell className="sticky left-10 z-30 bg-background/95 backdrop-blur min-w-64 font-semibold">
                        Totals
                      </TableCell>
                      <TableCell className="sticky left-[18.5rem] z-30 bg-background/95 backdrop-blur min-w-32" />
                      <TableCell />
                      <TableCell />
                      {factoryCols.map((c) => (
                        <TableCell key={c.id} className="font-semibold tabular-nums">
                          {totalsByColumn.colTotals[c.id] ?? 0}
                        </TableCell>
                      ))}
                      {warehouseCols.map((c) => (
                        <TableCell key={c.id} className="font-semibold tabular-nums">
                          {totalsByColumn.colTotals[c.id] ?? 0}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-semibold tabular-nums">
                        {totalsByColumn.totalFactory}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {totalsByColumn.totalWarehouse}
                      </TableCell>
                      <TableCell className="text-right font-bold tabular-nums">
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
    </div>
  );
}
