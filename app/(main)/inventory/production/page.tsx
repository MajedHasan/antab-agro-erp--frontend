"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Play,
  RefreshCcw,
  AlertTriangle,
  CheckCircle2,
  Factory as FactoryIcon,
  Package,
  Layers3,
  ChevronDown,
  Search,
  Check,
  Inbox,
  FileText,
} from "lucide-react";

import Protected from "@/components/auth/Protected";
import usePermissionCheck from "@/hooks/usePermissionCheck";

/* =========================== Types =========================== */
type Product = { _id: string; name: string; sku?: string };
type WarehouseOrFactory = {
  _id: string;
  name: string;
  code?: string;
  type?: string;
};
type BOMComponent = {
  itemType: "RawMaterial" | "PackagingItem";
  itemId: any;
  quantity: number;
  unit?: string;
  rule: { type: "PER_UNIT" | "PER_N_UNITS"; n?: number };
  roundingMethod?: "NONE" | "CEIL" | "FLOOR" | "ROUND";
  wastagePercent?: number;
};
type BOM = {
  _id?: string;
  productId?: string;
  version?: number;
  components: BOMComponent[];
};

/* =========================== Unit helpers =========================== */
const MASS = ["kg", "g"];
const VOLUME = ["ltr", "ml"];
const PIECE = ["pcs"];

function convertUnit(value: number, from?: string, to?: string): number {
  if (!from || !to || from === to || value === 0) return value;
  if (from === "kg" && to === "g") return value * 1000;
  if (from === "g" && to === "kg") return value / 1000;
  if (from === "ltr" && to === "ml") return value * 1000;
  if (from === "ml" && to === "ltr") return value / 1000;
  return value;
}

function applyRounding(v: number, method?: string) {
  if (!method || method === "NONE") return v;
  if (method === "CEIL") return Math.ceil(v);
  if (method === "FLOOR") return Math.floor(v);
  if (method === "ROUND") return Math.round(v);
  return v;
}

function idOf(maybe: any): string | null {
  if (!maybe) return null;
  if (typeof maybe === "string") return maybe;
  if (typeof maybe === "object") {
    if ("_id" in maybe) return String(maybe._id);
    if ("id" in maybe) return String(maybe.id);
  }
  return null;
}
function nameOf(maybe: any) {
  if (!maybe) return "-";
  if (typeof maybe === "string") return maybe;
  return maybe.name || maybe?.title || maybe._id || "-";
}
function safeNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/* =========================== SearchableSelect =========================== */
type SearchOption = { value: string; label: string; subLabel?: string };

function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  emptyText = "No results",
  disabled = false,
}: {
  options: SearchOption[];
  value?: string;
  onChange: (id: string) => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(term) ||
        (o.subLabel && o.subLabel.toLowerCase().includes(term)),
    );
  }, [options, query]);

  function pick(id: string) {
    onChange(id);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2 text-left text-sm outline-none transition focus:border-[#3aa838]/40 focus:ring-2 focus:ring-[#3aa838]/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900"
      >
        <span
          className={
            selected
              ? "truncate text-slate-900 dark:text-white"
              : "truncate text-slate-400"
          }
        >
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 p-1.5 dark:border-slate-800">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="h-8 w-full rounded-md border border-slate-200 bg-white pl-7 pr-2 text-xs outline-none focus:border-[#3aa838]/40 focus:ring-2 focus:ring-[#3aa838]/10 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
            </div>
          </div>
          <div className="max-h-56 overflow-auto">
            {filtered.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-500 dark:text-slate-400">
                {emptyText}
              </div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => pick(o.value)}
                  className={`flex w-full items-start justify-between gap-2 px-2.5 py-1.5 text-left text-xs transition hover:bg-slate-50 dark:hover:bg-slate-800 ${
                    o.value === value
                      ? "bg-[#3aa838]/10 font-semibold text-[#2f8a2f] dark:bg-[#3aa838]/15 dark:text-[#9bdd91]"
                      : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{o.label}</div>
                    {o.subLabel && (
                      <div className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                        {o.subLabel}
                      </div>
                    )}
                  </div>
                  {o.value === value && (
                    <Check className="mt-0.5 h-3 w-3 shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================== Page (Protected) =========================== */
export default function ProductionPage() {
  return (
    <Protected permissions={["production.view", "production.create"]}>
      <ProductionPageInner />
    </Protected>
  );
}

/* =========================== Inner =========================== */
function ProductionPageInner() {
  const hasAccess = usePermissionCheck();
  const canProduce = hasAccess({ permissions: "production.create" });

  const [products, setProducts] = useState<Product[]>([]);
  const [factories, setFactories] = useState<WarehouseOrFactory[]>([]);

  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedFactoryId, setSelectedFactoryId] = useState<string>("");

  const [bom, setBom] = useState<BOM | null>(null);
  const [rawStocks, setRawStocks] = useState<any[]>([]);
  const [packStocks, setPackStocks] = useState<any[]>([]);

  const [productionQty, setProductionQty] = useState<number>(0);
  const [loadingReferences, setLoadingReferences] = useState(false);
  const [loadingBom, setLoadingBom] = useState(false);
  const [previewRows, setPreviewRows] = useState<
    {
      component: BOMComponent;
      required_comp_unit: number;
      required_stock_unit: number;
      available_stock_unit: number;
      stockUnit: string;
      shortage: number;
    }[]
  >([]);
  const [calculatingPreview, setCalculatingPreview] = useState(false);
  const [producing, setProducing] = useState(false);

  /* ---------- Load references ---------- */
  useEffect(() => {
    (async () => {
      setLoadingReferences(true);
      try {
        const [pRes, fRes] = await Promise.all([
          api.get("/products", { params: { page: 1, limit: 1000 } }),
          api.get("/warehouses", {
            params: { type: "Factory", page: 1, limit: 1000 },
          }),
        ]);
        setProducts(pRes.data.data || []);
        setFactories(fRes.data.data || []);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load product/factory lists");
      } finally {
        setLoadingReferences(false);
      }
    })();
  }, []);

  /* ---------- Load BOM when product changes ---------- */
  useEffect(() => {
    if (!selectedProductId) {
      setBom(null);
      setPreviewRows([]);
      return;
    }
    (async () => {
      setLoadingBom(true);
      try {
        const res = await api.get("/bom", {
          params: { productId: selectedProductId, isActive: true, limit: 10 },
        });
        const arr = res.data.data || [];
        const active = arr.find((b: any) => b.isActive) || arr[0] || null;
        setBom(active);
        setPreviewRows([]);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load BOM for product");
        setBom(null);
      } finally {
        setLoadingBom(false);
      }
    })();
  }, [selectedProductId]);

  /* ---------- Load stocks for factory ---------- */
  async function loadStocksForFactory(factoryId: string) {
    if (!factoryId) {
      setRawStocks([]);
      setPackStocks([]);
      return;
    }
    try {
      const [rmRes, pkRes] = await Promise.all([
        api.get("/raw-material-stocks", {
          params: { factoryId, page: 1, limit: 10000 },
        }),
        api.get("/packaging-stocks", {
          params: { factoryId, page: 1, limit: 10000 },
        }),
      ]);
      setRawStocks(rmRes.data.data || []);
      setPackStocks(pkRes.data.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load stocks for selected factory");
      setRawStocks([]);
      setPackStocks([]);
    }
  }

  useEffect(() => {
    if (selectedFactoryId) loadStocksForFactory(selectedFactoryId);
    else {
      setRawStocks([]);
      setPackStocks([]);
    }
    setPreviewRows([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFactoryId]);

  /* ---------- Preview calculation ---------- */
  async function calculatePreview() {
    if (!bom) return toast.error("Select a product with an active BOM");
    if (!selectedFactoryId) return toast.error("Select factory");
    if (!productionQty || productionQty <= 0)
      return toast.error("Enter production quantity");

    setCalculatingPreview(true);
    try {
      if (!rawStocks.length || !packStocks.length) {
        await loadStocksForFactory(selectedFactoryId);
      }

      const rows: typeof previewRows = [];

      for (const comp of bom.components) {
        let requiredComp = 0;
        if (comp.rule?.type === "PER_UNIT") {
          requiredComp = productionQty * safeNum(comp.quantity);
        } else {
          const n = comp.rule?.n && comp.rule.n > 0 ? comp.rule.n : 1;
          const batches = Math.ceil(productionQty / n);
          requiredComp = batches * safeNum(comp.quantity);
        }

        if (comp.wastagePercent && comp.wastagePercent > 0) {
          requiredComp = requiredComp * (1 + comp.wastagePercent / 100);
        }

        requiredComp = applyRounding(requiredComp, comp.roundingMethod);

        let stockUnit = comp.unit || "pcs";
        let availableStockInStockUnit = 0;

        const compId = idOf(comp.itemId);
        if (comp.itemType === "RawMaterial") {
          for (const s of rawStocks) {
            const sId = idOf(s.rawMaterialId);
            if (!sId) continue;
            if (String(sId) === String(compId)) {
              const sUnit = s.unit || comp.unit || "kg";
              stockUnit = sUnit;
              availableStockInStockUnit += safeNum(s.quantity);
            }
          }
        } else {
          for (const s of packStocks) {
            const sId = idOf(s.packagingItemId);
            if (!sId) continue;
            if (String(sId) === String(compId)) {
              const sUnit = s.unit || comp.unit || "pcs";
              stockUnit = sUnit;
              availableStockInStockUnit += safeNum(s.quantity);
            }
          }
        }

        const requiredInStockUnit = convertUnit(
          requiredComp,
          comp.unit,
          stockUnit,
        );

        const shortage = Math.max(
          0,
          requiredInStockUnit - availableStockInStockUnit,
        );

        rows.push({
          component: comp,
          required_comp_unit: Number(requiredComp),
          required_stock_unit: Number(requiredInStockUnit),
          available_stock_unit: Number(availableStockInStockUnit),
          stockUnit,
          shortage: Number(shortage),
        });
      }

      setPreviewRows(rows);

      if (rows.some((r) => r.shortage > 0)) {
        toast.warning(
          "Preview ready — shortages detected. Production is blocked until shortages are resolved.",
        );
      } else {
        toast.success("Preview ready — all components available.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Preview calculation failed");
    } finally {
      setCalculatingPreview(false);
    }
  }

  /* ---------- Derived: is production allowed ---------- */
  const hasShortage = useMemo(
    () => previewRows.some((r) => r.shortage > 0),
    [previewRows],
  );

  /* ---------- Produce ---------- */
  async function doProduce() {
    if (!canProduce) {
      toast.error("You don't have permission to start production");
      return;
    }
    if (!selectedProductId) return toast.error("Select product");
    if (!bom) return toast.error("No active BOM");
    if (!selectedFactoryId) return toast.error("Select factory");
    if (!productionQty || productionQty <= 0)
      return toast.error("Enter production quantity");
    if (!previewRows.length) return toast.error("Run preview first");
    if (hasShortage)
      return toast.error(
        "Cannot produce: shortages detected. Replenish stock first.",
      );

    if (
      !confirm(
        `Start production for ${productionQty} units of the selected product? This will deduct raw/packaging stock from the selected factory and create a WIP (Work In Progress).`,
      )
    )
      return;

    setProducing(true);
    try {
      const payload = {
        productId: selectedProductId,
        quantity: productionQty,
        factoryId: selectedFactoryId,
      };
      const res = await api.post("/productions/start", payload);
      const wip = res.data?.data?.wip || res.data?.data || res.data;
      toast.success("Production started (WIP created)");

      await loadStocksForFactory(selectedFactoryId);
      setPreviewRows([]);
      setProductionQty(0);

      if (wip && wip._id) {
        toast(`WIP created: ${wip._id}`);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to start production");
    } finally {
      setProducing(false);
    }
  }

  function getItemName(item: any) {
    return nameOf(item);
  }

  /* ---------- Option builders ---------- */
  const productOptions: SearchOption[] = useMemo(
    () =>
      products
        .filter((p) => p._id)
        .map((p) => ({
          value: p._id,
          label: p.name,
          subLabel: p.sku || undefined,
        })),
    [products],
  );

  const factoryOptions: SearchOption[] = useMemo(
    () =>
      factories
        .filter((f) => f._id)
        .map((f) => ({
          value: f._id,
          label: f.name,
          subLabel: f.code ? `Code: ${f.code}` : undefined,
        })),
    [factories],
  );

  /* ---------- Derived stats for header ---------- */
  const totalComponents = bom?.components.length ?? 0;
  const shortageCount = previewRows.filter((r) => r.shortage > 0).length;

  /* =========================== Render =========================== */
  return (
    <div className="min-h-screen bg-slate-50/60 p-4 dark:bg-slate-950 md:p-6">
      <div className="mx-auto max-w-[1600px] space-y-4">
        {/* ============ COMPACT HEADER ============ */}
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#3aa838]/10 text-[#3aa838]">
              <Play className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                Production — Start WIP
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {bom
                  ? `BOM v${bom.version ?? 1} · ${totalComponents} components`
                  : "Select a product to load its active BOM"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedProductId("");
                setBom(null);
                setPreviewRows([]);
                setSelectedFactoryId("");
                setProductionQty(0);
              }}
              className="h-9 gap-1.5"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
            <Button
              size="sm"
              onClick={() => void calculatePreview()}
              disabled={
                !bom ||
                !selectedFactoryId ||
                !productionQty ||
                calculatingPreview
              }
              className="h-9 gap-1.5 bg-[#3aa838] text-white shadow-sm shadow-[#3aa838]/20 hover:bg-[#2f8a2f]"
            >
              <RefreshCcw
                className={`h-3.5 w-3.5 ${calculatingPreview ? "animate-spin" : ""}`}
              />
              {calculatingPreview ? "Calculating…" : "Calculate Preview"}
            </Button>
          </div>
        </div>

        {/* ============ SELECTION ROW ============ */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Product <span className="text-rose-500">*</span>
              </label>
              <SearchableSelect
                options={productOptions}
                value={selectedProductId}
                onChange={setSelectedProductId}
                placeholder="Search and select product…"
                emptyText="No products found"
                disabled={loadingReferences}
              />
              <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                Active BOM loads automatically.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Factory <span className="text-rose-500">*</span>
              </label>
              <SearchableSelect
                options={factoryOptions}
                value={selectedFactoryId}
                onChange={setSelectedFactoryId}
                placeholder="Search and select factory…"
                emptyText="No factories found"
                disabled={loadingReferences}
              />
              <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                Materials consumed from this factory.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Production Quantity
              </label>
              <Input
                type="number"
                value={productionQty || ""}
                onChange={(e) => setProductionQty(Number(e.target.value))}
                placeholder="e.g. 480"
                className="h-9 text-sm"
              />
              <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                Finished units to produce.
              </p>
            </div>
          </div>
        </div>

        {/* ============ BOM SUMMARY ============ */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Layers3 className="h-3.5 w-3.5 text-[#3aa838]" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                BOM Summary
              </h2>
              {bom && (
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  v{bom.version ?? 1} · {totalComponents}
                </span>
              )}
            </div>
            {bom && (
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                Read-only — edit from BOM management
              </span>
            )}
          </div>

          {loadingBom ? (
            <div className="flex items-center justify-center gap-2 p-10 text-slate-500 dark:text-slate-400">
              <RefreshCcw className="h-4 w-4 animate-spin" />
              <span className="text-xs">Loading BOM…</span>
            </div>
          ) : !bom ? (
            <div className="p-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                <FileText className="h-6 w-6 text-slate-400" />
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
                No BOM loaded
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Select a product above to see its active BOM.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-slate-200 bg-slate-50/80 hover:bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/50">
                    {[
                      { key: "idx", label: "#", className: "w-12" },
                      { key: "type", label: "Type" },
                      { key: "item", label: "Item" },
                      { key: "qty", label: "Qty (component unit)" },
                      { key: "rule", label: "Rule" },
                      { key: "wastage", label: "Wastage" },
                      { key: "rounding", label: "Rounding" },
                    ].map((h) => (
                      <TableHead
                        key={h.key}
                        className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${h.className || ""}`}
                      >
                        {h.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bom.components.map((c, i) => (
                    <TableRow
                      key={i}
                      className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/30"
                    >
                      <TableCell className="px-4 py-2.5 text-xs font-medium text-slate-400">
                        {i + 1}
                      </TableCell>
                      <TableCell className="px-4 py-2.5">
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {c.itemType}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white">
                        {getItemName(c.itemId)}
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-xs tabular-nums text-slate-700 dark:text-slate-300">
                        {c.quantity} {c.unit || ""}
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-xs text-slate-700 dark:text-slate-300">
                        {c.rule.type === "PER_N_UNITS"
                          ? `PER_N_UNITS (n=${c.rule.n ?? 1})`
                          : "PER_UNIT"}
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-xs tabular-nums text-slate-700 dark:text-slate-300">
                        {c.wastagePercent ?? 0}%
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-xs text-slate-700 dark:text-slate-300">
                        {c.roundingMethod || "NONE"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* ============ PREVIEW / REQUIREMENTS ============ */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Package className="h-3.5 w-3.5 text-[#3aa838]" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Preview / Requirements
              </h2>
              {previewRows.length > 0 && (
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {previewRows.length} lines
                </span>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void calculatePreview()}
              disabled={
                !bom ||
                !selectedFactoryId ||
                !productionQty ||
                calculatingPreview
              }
              className="h-8 gap-1.5 text-xs"
            >
              <RefreshCcw
                className={`h-3 w-3 ${calculatingPreview ? "animate-spin" : ""}`}
              />
              Calculate
            </Button>
          </div>

          {previewRows.length === 0 ? (
            <div className="p-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                <Inbox className="h-6 w-6 text-slate-400" />
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
                No preview yet
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Select a product, factory, and quantity, then click
                &ldquo;Calculate Preview&rdquo;.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto p-3">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/50">
                    {[
                      { key: "idx", label: "#", className: "w-12" },
                      { key: "type", label: "Type" },
                      { key: "component", label: "Component" },
                      { key: "req_comp", label: "Required (comp unit)" },
                      { key: "req_stock", label: "Required (stock unit)" },
                      { key: "avail", label: "Available (stock unit)" },
                      { key: "shortage", label: "Shortage" },
                    ].map((h, i) => (
                      <TableHead
                        key={h.key}
                        className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${
                          i >= 3 ? "text-right" : "text-left"
                        } ${h.className || ""}`}
                      >
                        {h.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((r, i) => (
                    <TableRow
                      key={i}
                      className={`border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/30 ${
                        r.shortage > 0 ? "bg-rose-50/50 dark:bg-rose-950/20" : ""
                      }`}
                    >
                      <TableCell className="px-4 py-2.5 text-xs font-medium text-slate-400">
                        {i + 1}
                      </TableCell>
                      <TableCell className="px-4 py-2.5">
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {r.component.itemType}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white">
                        {getItemName(r.component.itemId)}
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-right text-xs tabular-nums text-slate-700 dark:text-slate-300">
                        {Number(r.required_comp_unit.toFixed(6))}{" "}
                        {r.component.unit}
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-right text-xs tabular-nums text-slate-700 dark:text-slate-300">
                        {Number(r.required_stock_unit.toFixed(6))}{" "}
                        {r.stockUnit}
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-right text-xs tabular-nums text-slate-700 dark:text-slate-300">
                        {Number(r.available_stock_unit.toFixed(6))}{" "}
                        {r.stockUnit}
                      </TableCell>
                      <TableCell
                        className={`px-4 py-2.5 text-right text-xs tabular-nums ${
                          r.shortage > 0
                            ? "font-bold text-rose-600 dark:text-rose-400"
                            : "text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {Number(r.shortage.toFixed(6))} {r.stockUnit}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Status + Start Production */}
          <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40 sm:flex-row sm:items-center sm:justify-between">
            {previewRows.length === 0 ? (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Run calculation to check availability.
              </div>
            ) : hasShortage ? (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div>
                  <strong>Shortages detected</strong> — production blocked.{" "}
                  {shortageCount} line{shortageCount === 1 ? "" : "s"} need
                  replenishment.
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                All components available
              </div>
            )}

            {canProduce && (
              <Button
                size="sm"
                onClick={() => void doProduce()}
                // disabled={hasShortage || !previewRows.length || producing}
                disabled={true}
                className="h-9 gap-1.5 bg-[#3aa838] text-xs text-white shadow-sm shadow-[#3aa838]/20 hover:bg-[#2f8a2f] disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
              >
                <Play className="h-3.5 w-3.5" />
                {/* {producing ? "Starting…" : "Start Production"} */}
                Can't Start (Disabled)
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}