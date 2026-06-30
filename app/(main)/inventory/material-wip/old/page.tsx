"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Eye,
  Loader2,
  Play,
  RefreshCcw,
  XCircle,
} from "lucide-react";

/* =========================
   Types
========================= */

type RefEntity = {
  _id: string;
  name: string;
  sku?: string;
  code?: string;
  type?: string;
};

type RawMaterial = {
  _id: string;
  name: string;
  sku?: string;
  unit: string;
};

type PackagingItem = {
  _id: string;
  name: string;
  sku?: string;
  unit: string;
};

type MaterialWIP = {
  _id: string;
  factoryId: any;
  rawMaterialId: any;
  initialQuantity: number;
  remainingQuantity: number;
  unit: string;
  status: "ACTIVE" | "COMPLETED";
  conversions?: Conversion[];
  createdBy?: any;
  createdAt?: string;
  completedAt?: string;
};

type Conversion = {
  products?: Array<{
    productId: any;
    quantityProduced: number;
  }>;
  productId?: any;
  quantityProduced?: number;

  expectedRawUsed?: number;
  actualRawUsed?: number;
  variance?: number;
  varianceType?: "GAIN" | "LOSS" | "PERFECT";

  rawMaterialUsed?: number;
  otherMaterialsUsed?: Array<{
    itemType: "RawMaterial" | "PackagingItem";
    itemId: any;
    quantity: number;
    unit?: string;
  }>;
  createdAt?: string;
};

type BOMComponent = {
  itemType: "RawMaterial" | "PackagingItem";
  itemId: any;
  quantity: number;
  unit?: string;
  rule?: { type: "PER_UNIT" | "PER_N_UNITS"; n?: number };
  roundingMethod?: "NONE" | "CEIL" | "FLOOR" | "ROUND";
  wastagePercent?: number;
};

type BOM = {
  _id?: string;
  productId?: any;
  version?: number;
  isActive?: boolean;
  components: BOMComponent[];
};

type FactoryStocks = {
  raw: any[];
  pack: any[];
};

type ConvertModalState = {
  wip: MaterialWIP;
  step: 1 | 2;
  products: Array<{
    productId: string;
    quantityProduced: number;
  }>;
  remainingRawQuantity: number;
};

type PreviewMaterialRow = {
  itemType: "RawMaterial" | "PackagingItem";
  itemId: any;
  requiredQty: number;
  availableQty: number;
  shortage: number;
  unit: string;
};

type SelectedProductPreview = {
  productId: string;
  quantityProduced: number;
  bom?: BOM | null;
  expectedRawForThisProduct: number;
};

type ConvertPreview = {
  expectedRawUsed: number;
  actualRawUsed: number;
  variance: number;
  varianceType: "GAIN" | "LOSS" | "PERFECT";
  productSummaries: SelectedProductPreview[];
  materialRows: PreviewMaterialRow[];
  shortages: PreviewMaterialRow[];
};

/* =========================
   Helpers
========================= */

const safeNum = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
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

function nameOf(maybe: any) {
  if (!maybe) return "-";
  if (typeof maybe === "string") return maybe;
  return maybe.name || maybe.title || maybe.sku || maybe._id || "-";
}

function formatDate(d?: string | Date) {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return String(d);
  }
}

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

function csvEscape(s: any) {
  if (s === null || s === undefined) return '""';
  return `"${String(s).replace(/"/g, '""')}"`;
}

/* =========================
   Page
========================= */

export default function MaterialWipPage() {
  /* ---------- references ---------- */
  const [factories, setFactories] = useState<RefEntity[]>([]);
  const [products, setProducts] = useState<RefEntity[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [packagingItems, setPackagingItems] = useState<PackagingItem[]>([]);

  /* ---------- WIP list ---------- */
  const [wips, setWips] = useState<MaterialWIP[]>([]);
  const [loadingWips, setLoadingWips] = useState(false);

  /* ---------- filters ---------- */
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [factoryFilter, setFactoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  /* ---------- start WIP ---------- */
  const [startFactoryId, setStartFactoryId] = useState("");
  const [startRawMaterialId, setStartRawMaterialId] = useState("");
  const [startQty, setStartQty] = useState<number>(0);
  const [starting, setStarting] = useState(false);

  /* ---------- caches ---------- */
  const [factoryStocks, setFactoryStocks] = useState<
    Record<string, FactoryStocks>
  >({});
  const [factoryActiveWips, setFactoryActiveWips] = useState<
    Record<string, MaterialWIP[]>
  >({});
  const [possibleBomsByRaw, setPossibleBomsByRaw] = useState<
    Record<string, BOM[]>
  >({});
  const [loadingPossibleRawId, setLoadingPossibleRawId] = useState<string>("");
  const [loadingStocksFactoryId, setLoadingStocksFactoryId] =
    useState<string>("");

  /* ---------- row expansion ---------- */
  const [expandedWipId, setExpandedWipId] = useState<string>("");

  /* ---------- conversion modal ---------- */
  const [convertModal, setConvertModal] = useState<ConvertModalState | null>(
    null,
  );
  const [converting, setConverting] = useState(false);

  /* =========================
     Load references
  ========================= */
  useEffect(() => {
    (async () => {
      try {
        const [fRes, pRes, rmRes, pkRes] = await Promise.all([
          api.get("/warehouses", { params: { page: 1, limit: 1000 } }),
          api.get("/products", { params: { page: 1, limit: 1000 } }),
          api.get("/raw-materials", { params: { page: 1, limit: 1000 } }),
          api.get("/packaging-items", { params: { page: 1, limit: 1000 } }),
        ]);

        setFactories(fRes.data?.data || []);
        setProducts(pRes.data?.data || []);
        setRawMaterials(rmRes.data?.data || []);
        setPackagingItems(pkRes.data?.data || []);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load reference data");
      }
    })();
  }, []);

  /* =========================
     Search debounce
  ========================= */
  useEffect(() => {
    const t = setTimeout(
      () => setDebouncedSearch(search.trim().toLowerCase()),
      350,
    );
    return () => clearTimeout(t);
  }, [search]);

  /* =========================
     Load WIPs
  ========================= */
  const loadWips = useCallback(async () => {
    setLoadingWips(true);
    try {
      const res = await api.get("/material-wip", {
        params: {
          factoryId: factoryFilter || undefined,
          status: statusFilter || undefined,
        },
      });

      setWips(res.data?.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load WIP list");
    } finally {
      setLoadingWips(false);
    }
  }, [factoryFilter, statusFilter]);

  useEffect(() => {
    loadWips();
  }, [loadWips]);

  /* =========================
     Stock cache per factory
  ========================= */
  const ensureStocksForFactory = useCallback(
    async (factoryId: string, force = false) => {
      if (!factoryId) return;
      if (!force && factoryStocks[factoryId]) return;

      setLoadingStocksFactoryId(factoryId);
      try {
        const [rawRes, packRes] = await Promise.all([
          api.get("/raw-material-stocks", {
            params: { factoryId, page: 1, limit: 10000 },
          }),
          api.get("/packaging-stocks", {
            params: { factoryId, page: 1, limit: 10000 },
          }),
        ]);

        setFactoryStocks((prev) => ({
          ...prev,
          [factoryId]: {
            raw: rawRes.data?.data || [],
            pack: packRes.data?.data || [],
          },
        }));
      } catch (err) {
        console.error(err);
        toast.error("Failed to load factory stock data");
      } finally {
        setLoadingStocksFactoryId("");
      }
    },
    [factoryStocks],
  );

  /* =========================
     Active WIP cache for lock
  ========================= */
  const ensureActiveWipsForFactory = useCallback(
    async (factoryId: string, force = false) => {
      if (!factoryId) return;
      if (!force && factoryActiveWips[factoryId]) return;

      try {
        const res = await api.get("/material-wip", {
          params: { factoryId, status: "ACTIVE" },
        });

        setFactoryActiveWips((prev) => ({
          ...prev,
          [factoryId]: res.data?.data || [],
        }));
      } catch (err) {
        console.error(err);
        toast.error("Failed to load active WIP data");
      }
    },
    [factoryActiveWips],
  );

  useEffect(() => {
    if (startFactoryId) {
      ensureActiveWipsForFactory(startFactoryId);
      ensureStocksForFactory(startFactoryId);
    }
  }, [startFactoryId, ensureActiveWipsForFactory, ensureStocksForFactory]);

  /* =========================
     Helpers: stocks
  ========================= */
  function getFactoryStocks(factoryId: string): FactoryStocks {
    return factoryStocks[factoryId] || { raw: [], pack: [] };
  }

  function findRawStock(factoryId: string, rawMaterialId: string) {
    const stocks = getFactoryStocks(factoryId).raw;
    return stocks.find((s) => idOf(s.rawMaterialId) === rawMaterialId);
  }

  /* =========================
     Filtered WIPs
  ========================= */
  const filteredWips = useMemo(() => {
    if (!debouncedSearch) return wips;

    return wips.filter((w) => {
      const rawName = nameOf(w.rawMaterialId).toLowerCase();
      const rawSku = String(w.rawMaterialId?.sku || "").toLowerCase();
      const wipId = String(w._id).toLowerCase();
      return (
        rawName.includes(debouncedSearch) ||
        rawSku.includes(debouncedSearch) ||
        wipId.includes(debouncedSearch)
      );
    });
  }, [wips, debouncedSearch]);

  /* =========================
     Start WIP
  ========================= */
  const startRawStock = useMemo(() => {
    if (!startFactoryId || !startRawMaterialId) return null;
    return findRawStock(startFactoryId, startRawMaterialId) || null;
  }, [startFactoryId, startRawMaterialId, factoryStocks]);

  const startActiveLock = useMemo(() => {
    if (!startFactoryId || !startRawMaterialId) return null;
    const activeList = factoryActiveWips[startFactoryId] || [];
    return (
      activeList.find(
        (w) =>
          idOf(w.rawMaterialId) === startRawMaterialId && w.status === "ACTIVE",
      ) || null
    );
  }, [factoryActiveWips, startFactoryId, startRawMaterialId]);

  async function doStartWip() {
    if (!startFactoryId) return toast.error("Select a factory");
    if (!startRawMaterialId) return toast.error("Select a raw material");
    if (!startQty || startQty <= 0)
      return toast.error("Enter a valid quantity");

    if (startActiveLock) {
      return toast.error("This raw material already has an active WIP");
    }

    const available = safeNum(startRawStock?.quantity);
    if (startQty > available) {
      return toast.error(`Insufficient stock. Available: ${available}`);
    }

    setStarting(true);
    try {
      await api.post("/material-wip/start", {
        rawMaterialId: startRawMaterialId,
        factoryId: startFactoryId,
        quantity: startQty,
      });

      toast.success("WIP created successfully");
      setStartQty(0);

      await Promise.all([
        loadWips(),
        ensureActiveWipsForFactory(startFactoryId, true),
        ensureStocksForFactory(startFactoryId, true),
      ]);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to start WIP");
    } finally {
      setStarting(false);
    }
  }

  /* =========================
     Load possible products
  ========================= */
  const loadPossibleProducts = useCallback(
    async (rawMaterialId: string) => {
      if (!rawMaterialId) return;
      if (possibleBomsByRaw[rawMaterialId]) return;

      setLoadingPossibleRawId(rawMaterialId);
      try {
        const res = await api.get(`/material-wip/products/${rawMaterialId}`);
        const rows: BOM[] = res.data?.data || [];

        const uniq = new Map<string, BOM>();
        for (const bom of rows) {
          const pid = idOf(bom.productId);
          if (!pid) continue;
          if (!uniq.has(pid)) uniq.set(pid, bom);
        }

        setPossibleBomsByRaw((prev) => ({
          ...prev,
          [rawMaterialId]: Array.from(uniq.values()),
        }));
      } catch (err) {
        console.error(err);
        toast.error("Failed to load possible products");
        setPossibleBomsByRaw((prev) => ({ ...prev, [rawMaterialId]: [] }));
      } finally {
        setLoadingPossibleRawId("");
      }
    },
    [possibleBomsByRaw],
  );

  /* =========================
     Open modal
  ========================= */
  async function openProductionModal(wip: MaterialWIP) {
    const rawId = idOf(wip.rawMaterialId);
    const factoryId = idOf(wip.factoryId);

    if (rawId) await loadPossibleProducts(rawId);
    if (factoryId) await ensureStocksForFactory(factoryId, true);

    setConvertModal({
      wip,
      step: 1,
      products: [],
      remainingRawQuantity: 0,
    });
  }

  function closeProductionModal() {
    setConvertModal(null);
    setConverting(false);
  }

  function updateSelectedProductQty(
    productId: string,
    quantityProduced: number,
  ) {
    setConvertModal((prev) => {
      if (!prev) return prev;
      const filtered = prev.products.filter((p) => p.productId !== productId);
      if (!quantityProduced || quantityProduced <= 0) {
        return { ...prev, products: filtered };
      }
      return {
        ...prev,
        products: [...filtered, { productId, quantityProduced }],
      };
    });
  }

  function removeSelectedProduct(productId: string) {
    setConvertModal((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        products: prev.products.filter((p) => p.productId !== productId),
      };
    });
  }

  /* =========================
     Conversion preview
  ========================= */
  const conversionPreview: ConvertPreview | null = useMemo(() => {
    if (!convertModal) return null;

    const wip = convertModal.wip;
    const factoryId = idOf(wip.factoryId);
    const rawId = idOf(wip.rawMaterialId);
    const stocks = getFactoryStocks(factoryId);
    const rawBoms = possibleBomsByRaw[rawId] || [];

    const materialMap = new Map<string, PreviewMaterialRow>();
    const productSummaries: SelectedProductPreview[] = [];
    let expectedRawUsed = 0;

    for (const selected of convertModal.products) {
      const bom = rawBoms.find((b) => idOf(b.productId) === selected.productId);

      if (!bom) {
        productSummaries.push({
          productId: selected.productId,
          quantityProduced: selected.quantityProduced,
          bom: null,
          expectedRawForThisProduct: 0,
        });
        continue;
      }

      let expectedRawForThisProduct = 0;

      for (const comp of bom.components || []) {
        const compId = idOf(comp.itemId);
        const baseQty = safeNum(comp.quantity);
        const productQty = safeNum(selected.quantityProduced);

        let requiredComp = 0;
        if (comp.rule?.type === "PER_UNIT") {
          requiredComp = productQty * baseQty;
        } else {
          const n = comp.rule?.n && comp.rule.n > 0 ? comp.rule.n : 1;
          const batches = Math.ceil(productQty / n);
          requiredComp = batches * baseQty;
        }

        if (comp.wastagePercent && comp.wastagePercent > 0) {
          requiredComp = requiredComp * (1 + comp.wastagePercent / 100);
        }

        requiredComp = applyRounding(requiredComp, comp.roundingMethod);

        const bomUnit = comp.unit || wip.unit;

        if (comp.itemType === "RawMaterial" && compId === rawId) {
          const convertedToWipUnit = convertUnit(
            requiredComp,
            bomUnit,
            wip.unit,
          );
          expectedRawUsed += convertedToWipUnit;
          expectedRawForThisProduct += convertedToWipUnit;
          continue;
        }

        if (comp.itemType === "RawMaterial") {
          const stock = stocks.raw.find(
            (s) => idOf(s.rawMaterialId) === compId,
          );
          const stockUnit = stock?.unit || bomUnit || wip.unit;
          const requiredStockUnit = convertUnit(
            requiredComp,
            bomUnit,
            stockUnit,
          );
          const availableQty = safeNum(stock?.quantity);

          const key = `RawMaterial:${compId}:${stockUnit}`;
          const current = materialMap.get(key);

          materialMap.set(key, {
            itemType: "RawMaterial",
            itemId: comp.itemId,
            requiredQty: (current?.requiredQty || 0) + requiredStockUnit,
            availableQty: availableQty,
            shortage: Math.max(
              0,
              (current?.requiredQty || 0) + requiredStockUnit - availableQty,
            ),
            unit: stockUnit,
          });
        } else {
          const stock = stocks.pack.find(
            (s) => idOf(s.packagingItemId) === compId,
          );
          const stockUnit = stock?.unit || bomUnit || "pcs";
          const requiredStockUnit = convertUnit(
            requiredComp,
            bomUnit,
            stockUnit,
          );
          const availableQty = safeNum(stock?.quantity);

          const key = `PackagingItem:${compId}:${stockUnit}`;
          const current = materialMap.get(key);

          materialMap.set(key, {
            itemType: "PackagingItem",
            itemId: comp.itemId,
            requiredQty: (current?.requiredQty || 0) + requiredStockUnit,
            availableQty: availableQty,
            shortage: Math.max(
              0,
              (current?.requiredQty || 0) + requiredStockUnit - availableQty,
            ),
            unit: stockUnit,
          });
        }
      }

      productSummaries.push({
        productId: selected.productId,
        quantityProduced: selected.quantityProduced,
        bom,
        expectedRawForThisProduct,
      });
    }

    const materialRows = Array.from(materialMap.values());
    const shortages = materialRows.filter((r) => r.shortage > 0);

    const actualRawUsed = Math.max(
      0,
      safeNum(wip.initialQuantity) - safeNum(convertModal.remainingRawQuantity),
    );

    const variance = actualRawUsed - expectedRawUsed;
    const varianceType: "GAIN" | "LOSS" | "PERFECT" =
      variance < 0 ? "GAIN" : variance > 0 ? "LOSS" : "PERFECT";

    return {
      expectedRawUsed,
      actualRawUsed,
      variance,
      varianceType,
      productSummaries,
      materialRows,
      shortages,
    };
  }, [convertModal, possibleBomsByRaw, factoryStocks]);

  const canProceedToStep2 = useMemo(() => {
    if (!convertModal) return false;
    return convertModal.products.some((p) => safeNum(p.quantityProduced) > 0);
  }, [convertModal]);

  const canSubmitConversion = useMemo(() => {
    if (!convertModal || !conversionPreview) return false;
    if (!convertModal.products.length) return false;
    if (safeNum(convertModal.remainingRawQuantity) < 0) return false;
    if (
      safeNum(convertModal.remainingRawQuantity) >
      safeNum(convertModal.wip.initialQuantity)
    )
      return false;
    if (conversionPreview.shortages.length > 0) return false;
    return true;
  }, [convertModal, conversionPreview]);

  async function doConvert() {
    if (!convertModal || !conversionPreview) return;

    if (!canSubmitConversion) {
      if (conversionPreview.shortages.length > 0) {
        toast.error(
          "Shortages detected for other materials. Production is blocked.",
        );
        return;
      }
      toast.error("Please complete the production details.");
      return;
    }

    const confirmed = confirm(
      "Submit this production batch? Any raw gain will be returned to stock and losses will be recorded.",
    );
    if (!confirmed) return;

    setConverting(true);
    try {
      await api.post("/material-wip/convert", {
        wipId: convertModal.wip._id,
        factoryId: idOf(convertModal.wip.factoryId),
        products: convertModal.products,
        remainingRawQuantity: convertModal.remainingRawQuantity,
      });

      toast.success("Production submitted successfully");
      closeProductionModal();

      await Promise.all([
        loadWips(),
        ensureStocksForFactory(idOf(convertModal.wip.factoryId), true),
        ensureActiveWipsForFactory(idOf(convertModal.wip.factoryId), true),
      ]);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Production failed");
    } finally {
      setConverting(false);
    }
  }

  /* =========================
     Complete WIP
  ========================= */
  async function completeWip(wipId: string) {
    if (!confirm("Mark this WIP as completed?")) return;
    try {
      await api.post("/material-wip/complete", { wipId });
      toast.success("WIP marked as completed");
      await loadWips();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to complete WIP");
    }
  }

  /* =========================
     Labels
  ========================= */
  function resolveFactoryName(factoryId: any) {
    const id = idOf(factoryId);
    const item = factories.find((f) => f._id === id);
    if (!item) return id || "-";
    return item.code ? `${item.name} (${item.code})` : item.name;
  }

  function resolveRawMaterialName(rawId: any) {
    const id = idOf(rawId);
    const item = rawMaterials.find((r) => r._id === id);
    if (!item) return nameOf(rawId);
    return item.sku ? `${item.name} (${item.sku})` : item.name;
  }

  function resolveProductName(productId: any) {
    const id = idOf(productId);
    const item = products.find((p) => p._id === id);
    if (!item) return nameOf(productId);
    return item.sku ? `${item.name} (${item.sku})` : item.name;
  }

  function resolveOtherItemName(itemType: string, itemId: any) {
    const id = idOf(itemId);
    if (itemType === "RawMaterial") {
      const item = rawMaterials.find((r) => r._id === id);
      return item
        ? `${item.name}${item.sku ? ` (${item.sku})` : ""}`
        : id || "-";
    }
    if (itemType === "PackagingItem") {
      const item = packagingItems.find((p) => p._id === id);
      return item
        ? `${item.name}${item.sku ? ` (${item.sku})` : ""}`
        : id || "-";
    }
    return id || "-";
  }

  /* =========================
     Expand WIP row
  ========================= */
  async function toggleExpand(wip: MaterialWIP) {
    const next = expandedWipId === wip._id ? "" : wip._id;
    setExpandedWipId(next);

    if (next === wip._id) {
      const rawId = idOf(wip.rawMaterialId);
      const factoryId = idOf(wip.factoryId);

      if (rawId) await loadPossibleProducts(rawId);
      if (factoryId) await ensureStocksForFactory(factoryId);
    }
  }

  /* =========================
     Export CSV
  ========================= */
  function exportCsv() {
    if (!filteredWips.length) return toast.error("No WIP rows to export");

    const headers = [
      "wip_id",
      "factory",
      "raw_material",
      "initial_qty",
      "remaining_qty",
      "unit",
      "status",
      "created_at",
      "completed_at",
    ];

    const rows = filteredWips.map((w) => [
      csvEscape(w._id),
      csvEscape(resolveFactoryName(w.factoryId)),
      csvEscape(resolveRawMaterialName(w.rawMaterialId)),
      csvEscape(w.initialQuantity),
      csvEscape(w.remainingQuantity),
      csvEscape(w.unit),
      csvEscape(w.status),
      csvEscape(w.createdAt || ""),
      csvEscape(w.completedAt || ""),
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `material_wip_${new Date().toISOString()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /* =========================
     Render
  ========================= */
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Material WIP Production</h1>
          <p className="text-sm text-muted-foreground">
            Start a raw material WIP, continue production in a simple 2-step
            flow, and track gain or loss automatically.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={exportCsv}>
            Export CSV
          </Button>
          <Button variant="outline" onClick={loadWips}>
            <RefreshCcw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Start WIP */}
      <div className="border rounded-lg bg-card p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Start New WIP</h2>
            <p className="text-sm text-muted-foreground">
              Choose a factory, select one raw material, and lock the quantity
              for production.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {loadingStocksFactoryId === startFactoryId && startFactoryId ? (
              <Badge variant="secondary">
                <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                Loading stock
              </Badge>
            ) : null}
            {startActiveLock ? (
              <Badge variant="destructive">Active WIP exists</Badge>
            ) : (
              <Badge variant="secondary">Ready</Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-sm">Factory</label>
            <select
              className="w-full border rounded px-3 py-2 bg-background"
              value={startFactoryId}
              onChange={(e) => {
                setStartFactoryId(e.target.value);
                setStartRawMaterialId("");
                setStartQty(0);
              }}
            >
              <option value="">Select factory</option>
              {factories.map((f) => (
                <option key={f._id} value={f._id}>
                  {f.code ? `${f.name} (${f.code})` : f.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm">Raw material</label>
            <select
              className="w-full border rounded px-3 py-2 bg-background"
              value={startRawMaterialId}
              onChange={(e) => setStartRawMaterialId(e.target.value)}
            >
              <option value="">Select raw material</option>
              {rawMaterials.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.sku ? `${r.name} (${r.sku})` : r.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm">Quantity</label>
            <Input
              type="number"
              value={startQty || ""}
              onChange={(e) => setStartQty(Number(e.target.value))}
              placeholder="e.g. 50"
            />
          </div>

          <div className="flex items-end">
            <Button
              className="w-full"
              onClick={doStartWip}
              disabled={
                starting || !startFactoryId || !startRawMaterialId || !startQty
              }
            >
              {starting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Start WIP
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="border rounded p-3">
            <div className="text-xs text-muted-foreground">Available stock</div>
            <div className="text-lg font-semibold">
              {safeNum(startRawStock?.quantity)} {startRawStock?.unit || ""}
            </div>
          </div>

          <div className="border rounded p-3">
            <div className="text-xs text-muted-foreground">Locked in WIP</div>
            <div className="text-lg font-semibold">
              {startActiveLock
                ? `${startActiveLock.initialQuantity} ${startActiveLock.unit}`
                : "0"}
            </div>
          </div>

          <div className="border rounded p-3">
            <div className="text-xs text-muted-foreground">Lock rule</div>
            <div className="text-sm font-medium">
              One active WIP per raw material + factory
            </div>
          </div>
        </div>

        {startActiveLock && (
          <div className="flex items-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="w-4 h-4" />
            This raw material already has an active WIP. Continue production or
            complete it before starting another one.
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="border rounded-lg bg-card p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search WIP by raw material or ID"
          />

          <select
            className="w-full border rounded px-3 py-2 bg-background"
            value={factoryFilter}
            onChange={(e) => setFactoryFilter(e.target.value)}
          >
            <option value="">All factories</option>
            {factories.map((f) => (
              <option key={f._id} value={f._id}>
                {f.code ? `${f.name} (${f.code})` : f.name}
              </option>
            ))}
          </select>

          <select
            className="w-full border rounded px-3 py-2 bg-background"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All status</option>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
          </select>

          <Button
            variant="ghost"
            onClick={() => {
              setSearch("");
              setFactoryFilter("");
              setStatusFilter("");
            }}
          >
            Reset Filters
          </Button>
        </div>
      </div>

      {/* WIP List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Work In Progress</h2>
            <p className="text-sm text-muted-foreground">
              Simple view for the production team.
            </p>
          </div>
          <div className="text-sm text-muted-foreground">
            {filteredWips.length} row(s)
          </div>
        </div>

        {loadingWips ? (
          <div className="border rounded-lg bg-card p-8 text-center">
            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          </div>
        ) : filteredWips.length === 0 ? (
          <div className="border rounded-lg bg-card p-8 text-center text-muted-foreground">
            No WIP records found
          </div>
        ) : (
          filteredWips.map((wip) => {
            const isOpen = expandedWipId === wip._id;
            const rawId = idOf(wip.rawMaterialId);
            const possibleBoms = rawId ? possibleBomsByRaw[rawId] || [] : [];
            const activeFactoryId = idOf(wip.factoryId);

            return (
              <div key={wip._id} className="border rounded-lg bg-card p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">
                      {wip._id}
                    </div>
                    <div className="text-lg font-semibold">
                      {resolveRawMaterialName(wip.rawMaterialId)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Factory: {resolveFactoryName(wip.factoryId)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Started: {formatDate(wip.createdAt)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        wip.status === "ACTIVE" ? "secondary" : "default"
                      }
                    >
                      {wip.status}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                  <div className="border rounded p-3">
                    <div className="text-xs text-muted-foreground">Initial</div>
                    <div className="text-base font-semibold">
                      {wip.initialQuantity} {wip.unit}
                    </div>
                  </div>

                  <div className="border rounded p-3">
                    <div className="text-xs text-muted-foreground">
                      Remaining
                    </div>
                    <div className="text-base font-semibold">
                      {wip.remainingQuantity} {wip.unit}
                    </div>
                  </div>

                  <div className="border rounded p-3">
                    <div className="text-xs text-muted-foreground">
                      Completed
                    </div>
                    <div className="text-base font-semibold">
                      {formatDate(wip.completedAt)}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-4">
                  <Button
                    onClick={() => openProductionModal(wip)}
                    disabled={wip.status !== "ACTIVE"}
                  >
                    Continue Production
                  </Button>

                  <Button variant="ghost" onClick={() => toggleExpand(wip)}>
                    <Eye className="w-4 h-4 mr-2" />
                    {isOpen ? "Hide details" : "View details"}
                  </Button>

                  {wip.status === "ACTIVE" && (
                    <Button
                      variant="destructive"
                      onClick={() => completeWip(wip._id)}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Complete
                    </Button>
                  )}
                </div>

                {isOpen && (
                  <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <div className="border rounded p-4 bg-background">
                      <h3 className="font-semibold">Production history</h3>

                      {wip.conversions && wip.conversions.length > 0 ? (
                        <div className="mt-3 space-y-3">
                          {wip.conversions.map((c, idx) => {
                            const list = c.products?.length
                              ? c.products
                              : c.productId
                                ? [
                                    {
                                      productId: c.productId,
                                      quantityProduced: c.quantityProduced || 0,
                                    },
                                  ]
                                : [];

                            return (
                              <div key={idx} className="border rounded p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="font-medium">
                                    {list.length > 0
                                      ? list
                                          .map(
                                            (p) =>
                                              `${resolveProductName(p.productId)} × ${p.quantityProduced}`,
                                          )
                                          .join(", ")
                                      : "Production batch"}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {formatDate(c.createdAt)}
                                  </div>
                                </div>

                                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">
                                      Expected raw:
                                    </span>{" "}
                                    {safeNum(c.expectedRawUsed)}
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">
                                      Actual raw:
                                    </span>{" "}
                                    {safeNum(
                                      c.actualRawUsed || c.rawMaterialUsed,
                                    )}
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">
                                      Variance:
                                    </span>{" "}
                                    <span
                                      className={
                                        safeNum(c.variance || 0) < 0
                                          ? "text-green-600 font-semibold"
                                          : safeNum(c.variance || 0) > 0
                                            ? "text-red-600 font-semibold"
                                            : ""
                                      }
                                    >
                                      {safeNum(c.variance || 0)}{" "}
                                      {safeNum(c.variance || 0) < 0
                                        ? "(GAIN)"
                                        : safeNum(c.variance || 0) > 0
                                          ? "(LOSS)"
                                          : "(PERFECT)"}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">
                                      Type:
                                    </span>{" "}
                                    {c.varianceType || "PERFECT"}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="mt-3 text-sm text-muted-foreground">
                          No production records yet.
                        </div>
                      )}
                    </div>

                    <div className="border rounded p-4 bg-background">
                      <h3 className="font-semibold">Factory stock snapshot</h3>
                      <div className="mt-3 text-sm space-y-2">
                        <div>
                          Raw material stock:{" "}
                          {getFactoryStocks(activeFactoryId).raw.length} item(s)
                        </div>
                        <div>
                          Packaging stock:{" "}
                          {getFactoryStocks(activeFactoryId).pack.length}{" "}
                          item(s)
                        </div>
                      </div>

                      <div className="mt-4 border rounded p-3 bg-muted/30 text-sm text-muted-foreground">
                        Open “Continue Production” to see product choices from
                        BOM and complete the batch.
                      </div>

                      {possibleBoms.length > 0 && (
                        <div className="mt-4">
                          <div className="text-sm font-medium mb-2">
                            Possible finished products
                          </div>
                          <div className="space-y-2">
                            {possibleBoms.slice(0, 5).map((bom, idx) => (
                              <div
                                key={idx}
                                className="border rounded p-2 text-sm"
                              >
                                {resolveProductName(bom.productId)}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Production Modal */}
      {convertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeProductionModal}
          />
          <div className="relative z-10 w-full max-w-5xl rounded-lg bg-background shadow-xl border p-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold">Production Entry</h3>
                <p className="text-sm text-muted-foreground">
                  Raw material:{" "}
                  {resolveRawMaterialName(convertModal.wip.rawMaterialId)} •
                  Factory: {resolveFactoryName(convertModal.wip.factoryId)}
                </p>
              </div>

              <Button variant="ghost" onClick={closeProductionModal}>
                <XCircle className="w-4 h-4 mr-2" />
                Close
              </Button>
            </div>

            <div className="mt-5 flex items-center gap-2 text-sm">
              <Badge
                variant={convertModal.step === 1 ? "default" : "secondary"}
              >
                1
              </Badge>
              <span className="text-muted-foreground">Choose products</span>
              <Badge
                variant={convertModal.step === 2 ? "default" : "secondary"}
              >
                2
              </Badge>
              <span className="text-muted-foreground">Enter remaining raw</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-5">
              {/* Left panel */}
              <div className="lg:col-span-1 space-y-4">
                <div className="border rounded p-4">
                  <div className="text-sm text-muted-foreground">
                    Raw material lock
                  </div>
                  <div className="text-lg font-semibold">
                    {resolveRawMaterialName(convertModal.wip.rawMaterialId)}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-muted-foreground">Initial</div>
                      <div>
                        {convertModal.wip.initialQuantity}{" "}
                        {convertModal.wip.unit}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">
                        Current remaining
                      </div>
                      <div>
                        {convertModal.wip.remainingQuantity}{" "}
                        {convertModal.wip.unit}
                      </div>
                    </div>
                  </div>
                </div>

                {convertModal.step === 1 && (
                  <div className="border rounded p-4">
                    <h4 className="font-semibold">Step 1: choose products</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Add one or more finished products and enter how many units
                      were produced.
                    </p>

                    <div className="mt-4 space-y-3">
                      {(
                        possibleBomsByRaw[
                          idOf(convertModal.wip.rawMaterialId)
                        ] || []
                      ).length > 0 ? (
                        (
                          possibleBomsByRaw[
                            idOf(convertModal.wip.rawMaterialId)
                          ] || []
                        ).map((bom, idx) => {
                          const pid = idOf(bom.productId);
                          const selectedLine = convertModal.products.find(
                            (p) => p.productId === pid,
                          );

                          return (
                            <div
                              key={`${pid}-${idx}`}
                              className="border rounded p-3"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="font-medium">
                                    {resolveProductName(bom.productId)}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    BOM v{bom.version || 1}
                                  </div>
                                </div>

                                {selectedLine ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => removeSelectedProduct(pid)}
                                  >
                                    Remove
                                  </Button>
                                ) : null}
                              </div>

                              <div className="mt-3">
                                <label className="text-sm">
                                  Produced quantity
                                </label>
                                <Input
                                  type="number"
                                  min={0}
                                  value={selectedLine?.quantityProduced || ""}
                                  onChange={(e) => {
                                    const qty = Number(e.target.value);
                                    updateSelectedProductQty(pid, qty);
                                  }}
                                  placeholder="e.g. 100"
                                />
                              </div>
                            </div>
                          );
                        })
                      ) : loadingPossibleRawId ===
                        idOf(convertModal.wip.rawMaterialId) ? (
                        <div className="py-6 flex items-center justify-center text-sm text-muted-foreground">
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Loading products...
                        </div>
                      ) : (
                        <div className="py-6 text-sm text-muted-foreground">
                          No active BOM found for this raw material.
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex justify-end">
                      <Button
                        onClick={() =>
                          setConvertModal((prev) =>
                            prev ? { ...prev, step: 2 } : prev,
                          )
                        }
                        disabled={!canProceedToStep2}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}

                {convertModal.step === 2 && (
                  <div className="border rounded p-4">
                    <h4 className="font-semibold">
                      Step 2: remaining raw material
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Enter how much raw material is left after production. The
                      system will calculate gain or loss for you.
                    </p>

                    <div className="mt-4">
                      <label className="text-sm">Remaining raw material</label>
                      <Input
                        type="number"
                        min={0}
                        max={safeNum(convertModal.wip.initialQuantity)}
                        value={convertModal.remainingRawQuantity || ""}
                        onChange={(e) =>
                          setConvertModal((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  remainingRawQuantity: Number(e.target.value),
                                }
                              : prev,
                          )
                        }
                        placeholder="e.g. 40"
                      />
                    </div>

                    {conversionPreview && (
                      <div className="mt-4 border rounded p-3 text-sm space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-muted-foreground">
                            Expected raw usage
                          </div>
                          <div className="font-medium">
                            {conversionPreview.expectedRawUsed.toFixed(6)}{" "}
                            {convertModal.wip.unit}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <div className="text-muted-foreground">
                            Actual raw usage
                          </div>
                          <div className="font-medium">
                            {conversionPreview.actualRawUsed.toFixed(6)}{" "}
                            {convertModal.wip.unit}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <div className="text-muted-foreground">Variance</div>
                          <div
                            className={
                              conversionPreview.varianceType === "GAIN"
                                ? "text-green-600 font-semibold"
                                : conversionPreview.varianceType === "LOSS"
                                  ? "text-red-600 font-semibold"
                                  : "font-semibold"
                            }
                          >
                            {conversionPreview.variance.toFixed(6)}{" "}
                            {conversionPreview.varianceType === "GAIN"
                              ? "(GAIN)"
                              : conversionPreview.varianceType === "LOSS"
                                ? "(LOSS)"
                                : "(PERFECT)"}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-4 flex items-center justify-between gap-2">
                      <Button
                        variant="ghost"
                        onClick={() =>
                          setConvertModal((prev) =>
                            prev ? { ...prev, step: 1 } : prev,
                          )
                        }
                      >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back
                      </Button>

                      <Button
                        onClick={doConvert}
                        disabled={!canSubmitConversion || converting}
                      >
                        {converting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Submit Production
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Right panel */}
              <div className="lg:col-span-2 space-y-4">
                <div className="border rounded p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-semibold">Selected products</h4>
                    <div className="text-xs text-muted-foreground">
                      Add one or many products in Step 1
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {convertModal.products.length === 0 ? (
                      <div className="py-8 text-center text-muted-foreground border rounded">
                        No products selected yet
                      </div>
                    ) : (
                      convertModal.products.map((p, idx) => {
                        const bom = (
                          possibleBomsByRaw[
                            idOf(convertModal.wip.rawMaterialId)
                          ] || []
                        ).find((b) => idOf(b.productId) === p.productId);

                        let rawForThis = 0;
                        if (bom) {
                          const rawComp = (bom.components || []).find(
                            (c) =>
                              c.itemType === "RawMaterial" &&
                              idOf(c.itemId) ===
                                idOf(convertModal.wip.rawMaterialId),
                          );

                          if (rawComp) {
                            const compUnit =
                              rawComp.unit || convertModal.wip.unit;
                            let base = 0;

                            if (rawComp.rule?.type === "PER_UNIT") {
                              base =
                                safeNum(rawComp.quantity) * p.quantityProduced;
                            } else {
                              const n =
                                rawComp.rule?.n && rawComp.rule.n > 0
                                  ? rawComp.rule.n
                                  : 1;
                              const batches = Math.ceil(p.quantityProduced / n);
                              base = batches * safeNum(rawComp.quantity);
                            }

                            if (
                              rawComp.wastagePercent &&
                              rawComp.wastagePercent > 0
                            ) {
                              base = base * (1 + rawComp.wastagePercent / 100);
                            }

                            base = applyRounding(base, rawComp.roundingMethod);
                            rawForThis = convertUnit(
                              base,
                              compUnit,
                              convertModal.wip.unit,
                            );
                          }
                        }

                        return (
                          <div
                            key={`${p.productId}-${idx}`}
                            className="border rounded p-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-medium">
                                {resolveProductName(p.productId)}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Qty: {p.quantityProduced}
                              </div>
                            </div>
                            <div className="mt-2 text-sm text-muted-foreground">
                              Expected raw for this product:{" "}
                              {rawForThis.toFixed(6)} {convertModal.wip.unit}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="border rounded p-4">
                  <h4 className="font-semibold">Simple summary</h4>

                  {conversionPreview ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3 text-sm">
                        <div className="border rounded p-3">
                          <div className="text-muted-foreground">
                            Products selected
                          </div>
                          <div className="text-lg font-semibold">
                            {convertModal.products.length}
                          </div>
                        </div>

                        <div className="border rounded p-3">
                          <div className="text-muted-foreground">
                            Expected raw
                          </div>
                          <div className="text-lg font-semibold">
                            {conversionPreview.expectedRawUsed.toFixed(6)}{" "}
                            {convertModal.wip.unit}
                          </div>
                        </div>

                        <div className="border rounded p-3">
                          <div className="text-muted-foreground">
                            Actual raw
                          </div>
                          <div className="text-lg font-semibold">
                            {conversionPreview.actualRawUsed.toFixed(6)}{" "}
                            {convertModal.wip.unit}
                          </div>
                        </div>

                        <div className="border rounded p-3">
                          <div className="text-muted-foreground">Variance</div>
                          <div
                            className={
                              conversionPreview.varianceType === "GAIN"
                                ? "text-green-600 text-lg font-semibold"
                                : conversionPreview.varianceType === "LOSS"
                                  ? "text-red-600 text-lg font-semibold"
                                  : "text-lg font-semibold"
                            }
                          >
                            {conversionPreview.variance.toFixed(6)}{" "}
                            {conversionPreview.varianceType === "GAIN"
                              ? "(GAIN)"
                              : conversionPreview.varianceType === "LOSS"
                                ? "(LOSS)"
                                : "(PERFECT)"}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 rounded border bg-muted/30 p-3 text-sm">
                        {conversionPreview.varianceType === "GAIN"
                          ? "Gain means extra raw material will go back to the raw material stock."
                          : conversionPreview.varianceType === "LOSS"
                            ? "Loss will be recorded for later reporting."
                            : "Perfect usage. Expected and actual are the same."}
                      </div>
                    </>
                  ) : (
                    <div className="mt-3 text-sm text-muted-foreground">
                      Select products and enter remaining raw material to see
                      the result.
                    </div>
                  )}
                </div>

                <div className="border rounded p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-semibold">Other material check</h4>
                    <div className="text-xs text-muted-foreground">
                      These items must be available
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {!conversionPreview ||
                    conversionPreview.materialRows.length === 0 ? (
                      <div className="py-6 text-center text-muted-foreground border rounded">
                        No extra materials required or nothing selected yet
                      </div>
                    ) : (
                      conversionPreview.materialRows.map((row, idx) => (
                        <div
                          key={`${row.itemType}-${idOf(row.itemId)}-${idx}`}
                          className="flex items-center justify-between gap-3 border rounded p-3"
                        >
                          <div>
                            <div className="font-medium">
                              {resolveOtherItemName(row.itemType, row.itemId)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {row.itemType}
                            </div>
                          </div>

                          <div className="text-sm text-right">
                            <div>
                              Required: {row.requiredQty.toFixed(6)} {row.unit}
                            </div>
                            <div>
                              Available: {row.availableQty.toFixed(6)}{" "}
                              {row.unit}
                            </div>
                            <div
                              className={
                                row.shortage > 0
                                  ? "text-red-600 font-semibold"
                                  : "text-green-600"
                              }
                            >
                              Shortage: {row.shortage.toFixed(6)} {row.unit}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {conversionPreview &&
                  conversionPreview.shortages.length > 0 ? (
                    <div className="mt-4 flex items-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      <AlertTriangle className="w-4 h-4" />
                      Shortages detected in other materials. Production is
                      blocked until they are available.
                    </div>
                  ) : convertModal.step === 2 ? (
                    <div className="mt-4 flex items-center gap-2 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                      <CheckCircle className="w-4 h-4" />
                      No shortages in other materials. Ready to submit.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
