"use client";

import React, { useEffect, useMemo, useState } from "react";
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
import { Play, RefreshCcw, AlertTriangle } from "lucide-react";

/* ---------- Types ---------- */
type Product = { _id: string; name: string; sku?: string };
type WarehouseOrFactory = {
  _id: string;
  name: string;
  code?: string;
  type?: string;
};
type BOMComponent = {
  itemType: "RawMaterial" | "PackagingItem";
  itemId: any; // may be ObjectId string OR populated object
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

/* ---------- Unit helpers ---------- */
const MASS = ["kg", "g"];
const VOLUME = ["ltr", "ml"];
const PIECE = ["pcs"];

function convertUnit(value: number, from?: string, to?: string): number {
  if (!from || !to || from === to || value === 0) return value;
  // mass
  if (from === "kg" && to === "g") return value * 1000;
  if (from === "g" && to === "kg") return value / 1000;
  // volume
  if (from === "ltr" && to === "ml") return value * 1000;
  if (from === "ml" && to === "ltr") return value / 1000;
  // pieces or unknown: no conversion
  return value;
}

function applyRounding(v: number, method?: string) {
  if (!method || method === "NONE") return v;
  if (method === "CEIL") return Math.ceil(v);
  if (method === "FLOOR") return Math.floor(v);
  if (method === "ROUND") return Math.round(v);
  return v;
}

/* ---------- Helpers: safe id/name extraction ---------- */
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

/* -------------------- Production Page -------------------- */
export default function ProductionPage() {
  // lists
  const [products, setProducts] = useState<Product[]>([]);
  const [factories, setFactories] = useState<WarehouseOrFactory[]>([]);

  // selection
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedFactoryId, setSelectedFactoryId] = useState<string>("");

  // BOM & stocks
  const [bom, setBom] = useState<BOM | null>(null);
  const [rawStocks, setRawStocks] = useState<any[]>([]);
  const [packStocks, setPackStocks] = useState<any[]>([]);

  // ui
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
  }, [selectedFactoryId]);

  /* ---------- Preview calculation (fixed id matching & units) ---------- */
  async function calculatePreview() {
    if (!bom) return toast.error("Select a product with an active BOM");
    if (!selectedFactoryId) return toast.error("Select factory");
    if (!productionQty || productionQty <= 0)
      return toast.error("Enter production quantity");

    setCalculatingPreview(true);
    try {
      // ensure stocks loaded
      if (!rawStocks.length || !packStocks.length) {
        await loadStocksForFactory(selectedFactoryId);
      }

      const rows: typeof previewRows = [];

      for (const comp of bom.components) {
        // compute required in component unit
        let requiredComp = 0;
        if (comp.rule?.type === "PER_UNIT") {
          requiredComp = productionQty * safeNum(comp.quantity);
        } else {
          const n = comp.rule?.n && comp.rule.n > 0 ? comp.rule.n : 1;
          const batches = Math.ceil(productionQty / n);
          requiredComp = batches * safeNum(comp.quantity);
        }

        // wastage
        if (comp.wastagePercent && comp.wastagePercent > 0) {
          requiredComp = requiredComp * (1 + comp.wastagePercent / 100);
        }

        // rounding
        requiredComp = applyRounding(requiredComp, comp.roundingMethod);

        // find stock records for this component in the factory and accumulate available in a chosen stockUnit
        // pick stockUnit: prefer stock record unit if exists; otherwise fallback to BOM unit
        let stockUnit = comp.unit || "pcs";
        let availableStockInStockUnit = 0;

        const compId = idOf(comp.itemId);
        if (comp.itemType === "RawMaterial") {
          for (const s of rawStocks) {
            const sId = idOf(s.rawMaterialId);
            if (!sId) continue;
            if (String(sId) === String(compId)) {
              const sUnit = s.unit || comp.unit || "kg";
              stockUnit = sUnit; // use stock unit (if multiple records with different units exist this takes last - but typically unique)
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

        // convert required in comp.unit -> stockUnit
        const requiredInStockUnit = convertUnit(
          requiredComp,
          comp.unit,
          stockUnit,
        );

        // If BOM unit and stock unit are in different groups but convertible (kg<->g etc.) convertUnit handles common cases.
        // Compute shortage in stockUnit
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

  /* ---------- Produce (call backend) ---------- */
  async function doProduce() {
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
      // note: backend route mounted under /api/productions per server setup
      const res = await api.post("/productions/start", payload);
      const wip = res.data?.data?.wip || res.data?.data || res.data;
      toast.success("Production started (WIP created)");

      // refresh factory stocks & reset preview
      await loadStocksForFactory(selectedFactoryId);
      setPreviewRows([]);
      setProductionQty(0);

      // optionally show wip id in toast (if needed)
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

  /* ---------- Render ---------- */
  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Production — Start Production (WIP)
          </h1>
          <p className="text-sm text-muted-foreground">
            Select product and factory (materials will be consumed from factory
            stock). Use preview to verify requirements. Transfer finished goods
            to warehouse later from WIP.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setSelectedProductId("");
              setBom(null);
              setPreviewRows([]);
              setSelectedFactoryId("");
              setProductionQty(0);
            }}
          >
            Reset
          </Button>

          <Button
            onClick={() => calculatePreview()}
            disabled={!bom || !selectedFactoryId || !productionQty}
          >
            <RefreshCcw className="w-4 h-4 mr-2" /> Calculate Preview
          </Button>
        </div>
      </div>

      {/* Form */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-sm">Product</label>
          <select
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className="border rounded px-2 py-1 w-full"
          >
            <option value="">Select product</option>
            {products.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name} {p.sku ? `(${p.sku})` : ""}
              </option>
            ))}
          </select>
          <div className="text-xs text-muted-foreground mt-1">
            Active BOM will be loaded automatically.
          </div>
        </div>

        <div>
          <label className="text-sm">Factory (consume stock)</label>
          <select
            value={selectedFactoryId}
            onChange={(e) => setSelectedFactoryId(e.target.value)}
            className="border rounded px-2 py-1 w-full"
          >
            <option value="">Select factory</option>
            {factories.map((f) => (
              <option key={f._id} value={f._id}>
                {f.name} {f.code ? `(${f.code})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm">
            Production quantity (finished units)
          </label>
          <Input
            type="number"
            value={productionQty || ""}
            onChange={(e) => setProductionQty(Number(e.target.value))}
            placeholder="e.g. 480"
          />
        </div>
      </div>

      {/* BOM summary */}
      <div className="bg-card border rounded p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">BOM summary</h3>
            <div className="text-sm text-muted-foreground">
              {bom
                ? `Version ${bom.version || 1} — ${bom.components.length} components`
                : "No BOM loaded for selected product"}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                if (!selectedProductId) return toast.error("Select product");
                toast("To edit BOM go to BOM management");
              }}
              variant="ghost"
            >
              Edit BOM
            </Button>
          </div>
        </div>

        {bom && (
          <div className="mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Qty (component unit)</TableHead>
                  <TableHead>Rule</TableHead>
                  <TableHead>Wastage</TableHead>
                  <TableHead>Rounding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bom.components.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>{c.itemType}</TableCell>
                    <TableCell className="text-sm">
                      {getItemName(c.itemId)}
                    </TableCell>
                    <TableCell>
                      {c.quantity} {c.unit}
                    </TableCell>
                    <TableCell>
                      {c.rule.type}
                      {c.rule.type === "PER_N_UNITS" ? ` (n=${c.rule.n})` : ""}
                    </TableCell>
                    <TableCell>{c.wastagePercent ?? 0}%</TableCell>
                    <TableCell>{c.roundingMethod}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Preview */}
      <div className="bg-card border rounded p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Preview / Requirements</h3>
            <div className="text-sm text-muted-foreground">
              Run calculation to see required vs available (factory inventory)
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => calculatePreview()}
              disabled={
                !bom ||
                !selectedFactoryId ||
                !productionQty ||
                calculatingPreview
              }
            >
              {calculatingPreview ? (
                "Calculating..."
              ) : (
                <>
                  <RefreshCcw className="w-4 h-4 mr-2" /> Calculate
                </>
              )}
            </Button>
          </div>
        </div>

        {previewRows.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No preview calculated yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Component</TableHead>
                  <TableHead>Required (comp unit)</TableHead>
                  <TableHead>Required (stock unit)</TableHead>
                  <TableHead>Available (stock unit)</TableHead>
                  <TableHead>Shortage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>{r.component.itemType}</TableCell>
                    <TableCell className="text-sm">
                      {getItemName(r.component.itemId)}
                    </TableCell>
                    <TableCell>
                      {Number(r.required_comp_unit.toFixed(6))}{" "}
                      {r.component.unit}
                    </TableCell>
                    <TableCell>
                      {Number(r.required_stock_unit.toFixed(6))} {r.stockUnit}
                    </TableCell>
                    <TableCell>
                      {Number(r.available_stock_unit.toFixed(6))} {r.stockUnit}
                    </TableCell>
                    <TableCell
                      className={r.shortage > 0 ? "text-red-600 font-bold" : ""}
                    >
                      {Number(r.shortage.toFixed(6))} {r.stockUnit}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {hasShortage ? (
              <div className="flex items-center gap-2 text-yellow-700">
                <AlertTriangle className="w-5 h-5" />
                <div>Shortages detected — production blocked</div>
              </div>
            ) : (
              <div className="text-green-700">All components available</div>
            )}
          </div>

          <div>
            <Button
              onClick={doProduce}
              disabled={hasShortage || !previewRows.length || producing}
            >
              {producing ? (
                "Starting..."
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" /> Start Production
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
