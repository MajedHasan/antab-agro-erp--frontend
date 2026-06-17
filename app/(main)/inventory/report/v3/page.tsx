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

type ReportKind = "RAW" | "PACK" | "OTHER" | "FINISHED";
type ReportTab = "ALL" | ReportKind;

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

function sameUnit(a?: string, b?: string) {
  return (
    String(a || "")
      .trim()
      .toUpperCase() ===
    String(b || "")
      .trim()
      .toUpperCase()
  );
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

  const [otherProducts, setOtherProducts] = useState<OtherProduct[]>([]);
  const [otherProductStocks, setOtherProductStocks] = useState<
    OtherProductStock[]
  >([]);

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
        String(name ?? "")
          .toLowerCase()
          .includes(search) ||
        String(sku ?? "")
          .toLowerCase()
          .includes(search)
      );
    };

    const result: ReportRow[] = [];

    // RAW MATERIALS
    {
      const map = makeTotalsMap(rawStocks, "rawMaterialId");

      for (const m of rawMaterials) {
        if (!match(m.name, m.sku)) continue;

        const totals: Record<string, number> = {};
        let totalFactory = 0;
        let totalWarehouse = 0;

        for (const loc of locations) {
          const qty = map.get(`${m._id}_${loc.id}`) || 0;
          totals[loc.id] = qty;
          if (loc.kind === "Factory") totalFactory += qty;
          if (loc.kind === "Warehouse") totalWarehouse += qty;
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

    // PACKAGING ITEMS
    {
      const map = makeTotalsMap(packStocks, "packagingItemId");

      for (const it of packagingItems) {
        if (!match(it.name, it.sku)) continue;

        const totals: Record<string, number> = {};
        let totalFactory = 0;
        let totalWarehouse = 0;

        for (const loc of locations) {
          const qty = map.get(`${it._id}_${loc.id}`) || 0;
          totals[loc.id] = qty;
          if (loc.kind === "Factory") totalFactory += qty;
          if (loc.kind === "Warehouse") totalWarehouse += qty;
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

    // FINISHED PRODUCTS
    {
      const map = makeTotalsMap(productStocks, "productId");

      for (const p of products) {
        if (!match(p.name, p.sku)) continue;

        const totals: Record<string, number> = {};
        let totalFactory = 0;
        let totalWarehouse = 0;

        for (const loc of locations) {
          const qty = map.get(`${p._id}_${loc.id}`) || 0;
          totals[loc.id] = qty;
          if (loc.kind === "Factory") totalFactory += qty;
          if (loc.kind === "Warehouse") totalWarehouse += qty;
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

    // OTHER PRODUCTS
    {
      const map = makeTotalsMap(otherProductStocks, "otherProductId");

      for (const p of otherProducts) {
        if (!match(p.name, p.sku)) continue;

        const totals: Record<string, number> = {};
        let totalFactory = 0;
        let totalWarehouse = 0;

        for (const loc of locations) {
          const qty = map.get(`${p._id}_${loc.id}`) || 0;
          totals[loc.id] = qty;
          if (loc.kind === "Factory") totalFactory += qty;
          if (loc.kind === "Warehouse") totalWarehouse += qty;
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

    result.sort((a, b) => {
      const n = a.name.localeCompare(b.name);
      if (n !== 0) return n;
      return a.sku.localeCompare(b.sku);
    });

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

  const effectiveColumns = locations;

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
    a.download = `inventory_report_${new Date().toISOString().slice(0, 10)}.csv`;
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

    const groups: Array<{
      label: string;
      kind: ReportKind;
      rows: ReportRow[];
    }> = [
      { label: "Raw Materials", kind: "RAW", rows: [] },
      { label: "Packing Materials", kind: "PACK", rows: [] },
      { label: "Finished Goods", kind: "FINISHED", rows: [] },
      { label: "Other Products", kind: "OTHER", rows: [] },
    ];

    const map = new Map<ReportKind, (typeof groups)[number]>();
    for (const g of groups) map.set(g.kind, g);

    for (const r of visibleRows) {
      map.get(r.kind)?.rows.push(r);
    }

    return groups.map((g) => ({
      label: g.label,
      rows: g.rows,
    }));
  }, [activeTab, visibleRows]);

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Inventory Report
          </h1>
          <p className="text-sm text-muted-foreground">
            Fast stock matrix across factories and warehouses.
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
          <Button
            variant="outline"
            onClick={() => loadRefsAndData()}
            disabled={loading}
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button
            onClick={exportCsv}
            disabled={loading || visibleRows.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as ReportTab)}
      >
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

          <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <Input
                value={q}
                placeholder="Search item name or SKU…"
                onChange={(e) => setQ(e.target.value)}
                className="md:w-80"
              />
              <label className="flex items-center gap-2 text-sm whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={onlyNonZero}
                  onChange={(e) => setOnlyNonZero(e.target.checked)}
                />
                Only non-zero
              </label>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={showFactories}
                  onChange={(e) => setShowFactories(e.target.checked)}
                />
                Factories
              </label>
              <label className="flex items-center gap-2 text-sm whitespace-nowrap">
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
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="max-h-[72vh] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
                  <TableRow>
                    <TableHead className="sticky left-0 z-30 w-10 bg-background/95 backdrop-blur" />
                    <TableHead className="sticky left-10 z-30 min-w-64 bg-background/95 backdrop-blur">
                      Item
                    </TableHead>
                    <TableHead className="sticky left-[18.5rem] z-30 min-w-32 bg-background/95 backdrop-blur">
                      Type
                    </TableHead>
                    <TableHead className="min-w-28">SKU</TableHead>
                    <TableHead className="min-w-20">Unit</TableHead>
                    {factoryCols.length > 0 && (
                      <TableHead
                        colSpan={factoryCols.length}
                        className="text-center"
                      >
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
                    <TableHead className="min-w-28 text-right">
                      Factory
                    </TableHead>
                    <TableHead className="min-w-28 text-right">
                      Warehouse
                    </TableHead>
                    <TableHead className="min-w-28 text-right">Total</TableHead>
                  </TableRow>

                  <TableRow>
                    <TableHead className="sticky left-0 z-30 w-10 bg-background/95 backdrop-blur">
                      #
                    </TableHead>
                    <TableHead className="sticky left-10 z-30 min-w-64 bg-background/95 backdrop-blur" />
                    <TableHead className="sticky left-[18.5rem] z-30 min-w-32 bg-background/95 backdrop-blur" />
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
                        colSpan={8 + factoryCols.length + warehouseCols.length}
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
                              <span className="ml-2 text-xs font-normal text-muted-foreground">
                                ({g.rows.length})
                              </span>
                            </TableCell>
                          </TableRow>
                        )}

                        {g.rows.map((r, idx) => (
                          <TableRow key={r.key} className="hover:bg-muted/40">
                            <TableCell className="sticky left-0 z-10 w-10 bg-card">
                              {idx + 1}
                            </TableCell>
                            <TableCell className="sticky left-10 z-10 min-w-64 bg-card">
                              <div className="font-medium">{r.name}</div>
                            </TableCell>
                            <TableCell className="sticky left-[18.5rem] z-10 min-w-32 bg-card">
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
                        ))}
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
                    <TableRow className="sticky bottom-0 z-20 border-t bg-background/95 backdrop-blur">
                      <TableCell className="sticky left-0 z-30 w-10 bg-background/95 backdrop-blur" />
                      <TableCell className="sticky left-10 z-30 min-w-64 bg-background/95 backdrop-blur font-semibold">
                        Totals
                      </TableCell>
                      <TableCell className="sticky left-[18.5rem] z-30 min-w-32 bg-background/95 backdrop-blur" />
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
