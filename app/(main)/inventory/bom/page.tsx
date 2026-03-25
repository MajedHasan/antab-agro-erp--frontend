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
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Plus, Trash2, Edit, Search } from "lucide-react";
import { toast } from "sonner";

/**
 * BOM Page (copy-paste ready)
 *
 * Features:
 * - Add components (RawMaterial or PackagingItem)
 * - Each component has: quantity + unit (select, auto-filled), rule (PER_UNIT / PER_N_UNITS), n, rounding, wastage%
 * - Production quantity (number of finished units) input
 * - Preview calculation: required qty (converted into each component's stock unit), available qty (sum across stocks), shortage
 * - Unit conversion supports kg <-> g, ltr <-> ml, pcs
 *
 * Drop into your Next.js app (use client). Uses your existing UI components.
 */

/* ----------------- Types ----------------- */
type Product = { _id?: string; name: string; sku?: string };
type RawMaterial = { _id?: string; name: string; sku?: string; unit?: string };
type PackagingItem = {
  _id?: string;
  name: string;
  sku?: string;
  unit?: string;
};

type RuleType = "PER_UNIT" | "PER_N_UNITS";
type RoundingMethod = "NONE" | "CEIL" | "FLOOR" | "ROUND";

type BOMComponent = {
  tempId?: string; // local UI id for list keys
  itemType: "RawMaterial" | "PackagingItem";
  itemId?: string;
  quantity: number; // base amount (in component.unit)
  unit?: string; // selectable (kg/g/ltr/ml/pcs)
  rule: { type: RuleType; n?: number }; // n used when PER_N_UNITS
  roundingMethod?: RoundingMethod;
  wastagePercent?: number;
};

type BOM = {
  _id?: string;
  productId?: string;
  version?: number;
  isActive?: boolean;
  components: BOMComponent[];
};

/* ----------------- Unit conversion helpers ----------------- */
const unitGroups: Record<string, string[]> = {
  mass: ["kg", "g"],
  volume: ["ltr", "ml"],
  piece: ["pcs"],
};

function unitGroupOf(u?: string) {
  if (!u) return null;
  if (unitGroups.mass.includes(u)) return "mass";
  if (unitGroups.volume.includes(u)) return "volume";
  if (unitGroups.piece.includes(u)) return "piece";
  return null;
}

function convertUnit(
  value: number,
  from: string | undefined,
  to: string | undefined
) {
  if (!from || !to) return value;
  if (from === to) return value;
  // mass
  if (from === "kg" && to === "g") return value * 1000;
  if (from === "g" && to === "kg") return value / 1000;
  // volume
  if (from === "ltr" && to === "ml") return value * 1000;
  if (from === "ml" && to === "ltr") return value / 1000;
  // pcs -> pcs (already handled)
  return value; // for unfamiliar conversions, return input (safe fallback)
}

/* rounding helper */
function applyRounding(val: number, method?: RoundingMethod) {
  if (!method || method === "NONE") return val;
  if (method === "CEIL") return Math.ceil(val);
  if (method === "FLOOR") return Math.floor(val);
  if (method === "ROUND") return Math.round(val);
  return val;
}

/* ----------------- Page Component ----------------- */
export default function BomPage() {
  /* lists & refs */
  const [products, setProducts] = useState<Product[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [packagingItems, setPackagingItems] = useState<PackagingItem[]>([]);
  const [rawStocks, setRawStocks] = useState<any[]>([]); // raw material stocks (populated or id)
  const [packStocks, setPackStocks] = useState<any[]>([]);

  /* BOM list (for showing existing BOMs) - minimal listing, you can expand */
  const [boms, setBoms] = useState<BOM[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  /* form state (create/edit) */
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<BOM | null>(null);
  const [form, setForm] = useState<BOM>({
    productId: "",
    version: 1,
    isActive: true,
    components: [],
  });

  useEffect(() => {
    console.log("Set Eidting: ", editing);
  }, [editing]);

  /* preview */
  const [productionQty, setProductionQty] = useState<number>(0);
  const [preview, setPreview] = useState<
    {
      comp: BOMComponent;
      required_in_comp_unit: number;
      required_in_stock_unit: number;
      available_in_stock_unit: number;
      shortage_in_stock_unit: number;
      stockUnit?: string;
    }[]
  >([]);

  useEffect(() => {
    loadReferences();
    fetchBoms();
  }, [page, limit, q]);

  async function loadReferences() {
    try {
      const [pRes, rmRes, pkRes, rmStocksRes, pkStocksRes] = await Promise.all([
        api.get("/products", { params: { page: 1, limit: 1000 } }),
        api.get("/raw-materials", { params: { page: 1, limit: 1000 } }),
        api.get("/packaging-items", { params: { page: 1, limit: 1000 } }),
        api.get("/raw-material-stocks", { params: { page: 1, limit: 10000 } }),
        api.get("/packaging-stocks", { params: { page: 1, limit: 10000 } }),
      ]);
      setProducts(pRes.data.data || []);
      setRawMaterials(rmRes.data.data || []);
      setPackagingItems(pkRes.data.data || []);
      setRawStocks(rmStocksRes.data.data || []);
      setPackStocks(pkStocksRes.data.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load references");
    }
  }

  async function fetchBoms() {
    try {
      setLoading(true);
      const res = await api.get("/bom", { params: { page, limit, q } });
      setBoms(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load BOMs");
    } finally {
      setLoading(false);
    }
  }

  /* helpers to find item data */
  function getItemName(c: BOMComponent) {
    if (!c.itemId) return "—";
    if (c.itemType === "RawMaterial") {
      return (
        rawMaterials.find((r) => r._id === (editing ? c.itemId?._id : c.itemId))
          ?.name || "—"
      );
    }
    return (
      packagingItems.find((p) => p._id === (editing ? c.itemId?._id : c.itemId))
        ?.name || "—"
    );
  }

  function getItemNativeUnit(c: BOMComponent) {
    if (c.itemType === "RawMaterial")
      return rawMaterials.find((r) => r._id === c.itemId)?.unit || "kg";
    return packagingItems.find((p) => p._id === c.itemId)?.unit || "pcs";
  }

  /* Add / remove components */
  function addComponent() {
    const newComp: BOMComponent = {
      tempId: String(Date.now()) + Math.random().toString(36).slice(2),
      itemType: "RawMaterial",
      itemId: "",
      quantity: 0,
      unit: "kg",
      rule: { type: "PER_UNIT", n: 1 },
      roundingMethod: "NONE",
      wastagePercent: 0,
    };
    setForm((s) => ({ ...s, components: [...s.components, newComp] }));
  }

  function removeComponent(idx: number) {
    const comps = [...form.components];
    comps.splice(idx, 1);
    setForm({ ...form, components: comps });
  }

  function updateComponent(idx: number, patch: Partial<BOMComponent>) {
    const comps = [...form.components];
    comps[idx] = { ...comps[idx], ...patch };
    // when itemId changed, auto-fill unit from item
    if (patch.itemId && patch.itemType) {
      const native =
        patch.itemType === "RawMaterial"
          ? rawMaterials.find((r) => r._id === patch.itemId)
          : packagingItems.find((p) => p._id === patch.itemId);
      if (native?.unit) comps[idx].unit = native.unit;
    } else if (patch.itemId && !patch.itemType) {
      // patch contains itemId only, keep itemType
      const native =
        comps[idx].itemType === "RawMaterial"
          ? rawMaterials.find((r) => r._id === patch.itemId)
          : packagingItems.find((p) => p._id === patch.itemId);
      if (native?.unit) comps[idx].unit = native.unit;
    }
    setForm({ ...form, components: comps });
  }

  /* Save BOM */
  async function saveBOM(e?: React.FormEvent) {
    e?.preventDefault();
    if (!form.productId) return toast.error("Select product");
    if (!form.components.length)
      return toast.error("Add at least one component");

    // basic validations
    for (const c of form.components) {
      if (!c.itemId) return toast.error("Select item for all components");
      if (!c.unit) return toast.error("Unit must be set for all components");
      if (c.rule.type === "PER_N_UNITS" && !(c.rule.n && c.rule.n > 0))
        return toast.error("Enter N for PER_N_UNITS");
    }

    try {
      if (editing?._id) {
        await api.put(`/bom/${editing._id}`, form);
        toast.success("BOM updated");
      } else {
        await api.post("/bom", form);
        toast.success("BOM created");
      }
      setOpenForm(false);
      fetchBoms();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Save failed");
    }
  }

  /* ---------- Preview calculation ---------- */
  async function calculatePreview() {
    if (!productionQty || productionQty <= 0)
      return toast.error("Enter production quantity");
    if (!form.components.length)
      return toast.error("Add components for preview");

    // ensure we have up-to-date stock lists
    try {
      const [rmStocksRes, pkStocksRes] = await Promise.all([
        api.get("/raw-material-stocks", { params: { page: 1, limit: 10000 } }),
        api.get("/packaging-stocks", { params: { page: 1, limit: 10000 } }),
      ]);
      const rmStocks = rmStocksRes.data.data || [];
      const pkStocks = pkStocksRes.data.data || [];

      const results = form.components.map((c) => {
        // 1) compute required in component.unit
        let required_in_comp_unit = 0;
        if (c.rule.type === "PER_UNIT") {
          required_in_comp_unit = productionQty * c.quantity;
        } else {
          // PER_N_UNITS: interpret quantity as "quantity per N finished units"
          const n = c.rule.n || 1;
          // number of batches of size n
          const batches = Math.ceil(productionQty / n);
          required_in_comp_unit = batches * c.quantity;
        }

        // apply wastage %
        if (c.wastagePercent && c.wastagePercent > 0) {
          required_in_comp_unit =
            required_in_comp_unit * (1 + c.wastagePercent / 100);
        }

        // apply rounding (after wastage)
        required_in_comp_unit = applyRounding(
          required_in_comp_unit,
          c.roundingMethod
        );

        // 2) find stock entries and their stock unit
        let availableInStockUnit = 0;
        let stockUnit = c.unit; // default fallback — we will compute in this unit

        // if raw material
        if (c.itemType === "RawMaterial") {
          // sum all rawStocks where rawMaterialId matches
          for (const s of rmStocks) {
            const sid =
              typeof s.rawMaterialId === "string"
                ? s.rawMaterialId
                : s.rawMaterialId?._id;
            if (String(sid) === String(c.itemId)) {
              const sUnit = s.unit || getItemNativeUnit(c); // stock record unit or native
              stockUnit = sUnit;
              // convert s.quantity to component.unit then to stockUnit later
              // easiest: convert required_in_comp_unit (comp.unit) -> stockUnit
            }
          }
          // Now compute required_in_stock_unit by converting required_in_comp_unit (comp.unit -> stockUnit)
          const required_in_stock_unit = convertUnit(
            required_in_comp_unit,
            c.unit,
            stockUnit
          );
          // sum available (in stock unit)
          for (const s of rmStocks) {
            const sid =
              typeof s.rawMaterialId === "string"
                ? s.rawMaterialId
                : s.rawMaterialId?._id;
            if (String(sid) === String(c.itemId)) {
              const sUnit = s.unit || getItemNativeUnit(c);
              const qtyInStockUnit = convertUnit(
                Number(s.quantity || 0),
                sUnit,
                stockUnit
              );
              availableInStockUnit += qtyInStockUnit;
            }
          }

          return {
            comp: c,
            required_in_comp_unit,
            required_in_stock_unit,
            available_in_stock_unit: availableInStockUnit,
            shortage_in_stock_unit: Math.max(
              0,
              required_in_stock_unit - availableInStockUnit
            ),
            stockUnit,
          };
        } else {
          // packaging
          for (const s of pkStocks) {
            const sid =
              typeof s.packagingItemId === "string"
                ? s.packagingItemId
                : s.packagingItemId?._id;
            if (String(sid) === String(c.itemId)) {
              const sUnit = s.unit || getItemNativeUnit(c);
              stockUnit = sUnit;
            }
          }
          const required_in_stock_unit = convertUnit(
            required_in_comp_unit,
            c.unit,
            stockUnit
          );
          for (const s of pkStocks) {
            const sid =
              typeof s.packagingItemId === "string"
                ? s.packagingItemId
                : s.packagingItemId?._id;
            if (String(sid) === String(c.itemId)) {
              const sUnit = s.unit || getItemNativeUnit(c);
              availableInStockUnit += convertUnit(
                Number(s.quantity || 0),
                sUnit,
                stockUnit
              );
            }
          }

          return {
            comp: c,
            required_in_comp_unit,
            required_in_stock_unit,
            available_in_stock_unit: availableInStockUnit,
            shortage_in_stock_unit: Math.max(
              0,
              required_in_stock_unit - availableInStockUnit
            ),
            stockUnit,
          };
        }
      });

      setPreview(results);
      // scroll or notify user
      if (results.some((r) => r.shortage_in_stock_unit > 0)) {
        toast.warning("Preview calculated — shortages found (highlighted).");
      } else {
        toast.success("Preview calculated — all components available.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch stocks for preview.");
    }
  }

  /* UI helpers */
  const totalPages = Math.max(1, Math.ceil(total / limit));

  /* Render */
  return (
    <div className="space-y-6 p-4">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Bill of Materials (BOM)</h2>
          <p className="text-sm text-muted-foreground">
            Flexible units, conversions, PER_UNIT/PER_N rules, wastage and
            rounding. Preview shortages before production.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center border rounded-md px-2 py-1 gap-2">
            <Search className="w-4 h-4 text-gray-500" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search product or version..."
              className="border-0 p-0"
            />
          </div>
          <Button
            onClick={() => {
              setEditing(null);
              setForm({
                productId: "",
                version: 1,
                isActive: true,
                components: [],
              });
              setOpenForm(true);
            }}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New BOM
          </Button>
        </div>
      </div>

      {/* BOM list */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="p-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Components</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {boms.map((b, i) => (
                <TableRow key={b._id || i}>
                  <TableCell>{(page - 1) * limit + i + 1}</TableCell>
                  <TableCell>
                    {products.find((p) => p._id === b.productId?._id)?.name ||
                      "—"}
                  </TableCell>
                  <TableCell>{b.version}</TableCell>
                  <TableCell>{b.isActive ? "Yes" : "No"}</TableCell>
                  <TableCell>{b.components?.length ?? 0}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing(b);
                          setForm({ ...b });
                          setOpenForm(true);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={async () => {
                          if (!b._id) return;
                          if (!confirm("Delete BOM?")) return;
                          await api.delete(`/bom/${b._id}`);
                          toast.success("Deleted");
                          fetchBoms();
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {boms.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6">
                    {loading ? "Loading..." : "No BOMs found"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* pager */}
        <div className="flex items-center justify-between p-4 border-t">
          <div>
            <span className="text-sm text-muted-foreground">
              Showing {(page - 1) * limit + 1} - {Math.min(page * limit, total)}{" "}
              of {total}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="border rounded px-2 py-1"
            >
              {[10, 15, 25, 50].map((l) => (
                <option key={l} value={l}>
                  {l} / page
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1">
              <Button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Prev
              </Button>
              <div className="px-3">
                {page} / {totalPages}
              </div>
              <Button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* create/edit modal */}
      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="w-full md:!min-w-4xl !max-w-[90vw] max-h-[90vh] overflow-y-scroll">
          <form onSubmit={saveBOM} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {editing?._id ? "Edit BOM" : "New BOM"}
              </h3>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Preview Qty"
                  value={productionQty || ""}
                  onChange={(e) => setProductionQty(Number(e.target.value))}
                />
                <Button type="button" onClick={calculatePreview}>
                  Calculate Preview
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm">Product</label>
                <select
                  value={editing ? form.productId?._id : form.productId || ""}
                  onChange={(e) => {
                    setForm({ ...form, productId: e.target.value });
                    console.log(e.target.value);
                    console.log(form.productId?._id);
                  }}
                  className="border rounded px-2 py-1 w-full"
                >
                  <option value="">Select product</option>
                  {products.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm">Version</label>
                <Input
                  type="number"
                  value={form.version ?? 1}
                  onChange={(e) =>
                    setForm({ ...form, version: Number(e.target.value) })
                  }
                />
              </div>
            </div>

            <div>
              <label className="text-sm">Components</label>

              <div className="space-y-3 mt-2">
                {form.components.map((c, idx) => (
                  <div key={c.tempId || idx} className="border rounded p-3">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">Component #{idx + 1}</div>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => removeComponent(idx)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-6 gap-2 mt-2">
                      <div>
                        <label className="text-xs">Type</label>
                        <select
                          value={c.itemType}
                          onChange={(e) =>
                            updateComponent(idx, {
                              itemType: e.target.value as any,
                              itemId: "",
                              unit: "",
                            })
                          }
                          className="border rounded px-2 py-1 w-full"
                        >
                          <option value="RawMaterial">Raw Material</option>
                          <option value="PackagingItem">Packaging Item</option>
                        </select>
                      </div>

                      <div className="col-span-2">
                        <label className="text-xs">Item</label>
                        <select
                          value={editing ? c.itemId?._id : c.itemId || ""}
                          onChange={(e) =>
                            updateComponent(idx, { itemId: e.target.value })
                          }
                          className="border rounded px-2 py-1 w-full"
                        >
                          <option value="">Select item</option>
                          {c.itemType === "RawMaterial"
                            ? rawMaterials.map((r) => (
                                <option key={r._id} value={r._id}>
                                  {r.name} ({r.unit})
                                </option>
                              ))
                            : packagingItems.map((p) => (
                                <option key={p._id} value={p._id}>
                                  {p.name}
                                </option>
                              ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs">Qty (base)</label>
                        <Input
                          type="number"
                          value={c.quantity}
                          onChange={(e) =>
                            updateComponent(idx, {
                              quantity: Number(e.target.value),
                            })
                          }
                        />
                      </div>

                      <div>
                        <label className="text-xs">Unit</label>
                        <select
                          value={c.unit || ""}
                          onChange={(e) =>
                            updateComponent(idx, { unit: e.target.value })
                          }
                          className="border rounded px-2 py-1 w-full"
                        >
                          {/* allowed units depend on type; mass/volume/piece */}
                          <optgroup label="Mass">
                            <option value="kg">kg</option>
                            <option value="g">g</option>
                          </optgroup>
                          <optgroup label="Volume">
                            <option value="ltr">ltr</option>
                            <option value="ml">ml</option>
                          </optgroup>
                          <optgroup label="Piece">
                            <option value="pcs">pcs</option>
                          </optgroup>
                        </select>
                        <div className="text-xs text-muted-foreground">
                          Auto-filled from item but can be overridden
                        </div>
                      </div>

                      <div>
                        <label className="text-xs">Rule</label>
                        <select
                          value={c.rule.type}
                          onChange={(e) =>
                            updateComponent(idx, {
                              rule: {
                                ...c.rule,
                                type: e.target.value as RuleType,
                              },
                            })
                          }
                          className="border rounded px-2 py-1 w-full"
                        >
                          <option value="PER_UNIT">
                            PER_UNIT (per finished unit)
                          </option>
                          <option value="PER_N_UNITS">
                            PER_N_UNITS (per N finished units)
                          </option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs">
                          N (if using PER_N_UNITS)
                        </label>
                        <Input
                          type="number"
                          value={c.rule.n ?? 1}
                          onChange={(e) =>
                            updateComponent(idx, {
                              rule: { ...c.rule, n: Number(e.target.value) },
                            })
                          }
                          disabled={c.rule.type !== "PER_N_UNITS"}
                        />
                      </div>

                      <div>
                        <label className="text-xs">Wastage %</label>
                        <Input
                          type="number"
                          value={c.wastagePercent ?? 0}
                          onChange={(e) =>
                            updateComponent(idx, {
                              wastagePercent: Number(e.target.value),
                            })
                          }
                        />
                      </div>

                      <div>
                        <label className="text-xs">Rounding</label>
                        <select
                          value={c.roundingMethod || "NONE"}
                          onChange={(e) =>
                            updateComponent(idx, {
                              roundingMethod: e.target.value as RoundingMethod,
                            })
                          }
                          className="border rounded px-2 py-1 w-full"
                        >
                          <option value="NONE">NONE</option>
                          <option value="CEIL">CEIL</option>
                          <option value="FLOOR">FLOOR</option>
                          <option value="ROUND">ROUND</option>
                        </select>
                        <div className="text-xs text-muted-foreground">
                          Rounding applies after wastage (useful for cartons)
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 text-sm text-muted-foreground">
                      Preview name: <strong>{getItemName(c)}</strong> — native
                      unit: <strong>{getItemNativeUnit(c)}</strong>
                    </div>
                  </div>
                ))}

                <div>
                  <Button variant="outline" size="sm" onClick={addComponent}>
                    <Plus className="w-4 h-4" /> Add component
                  </Button>
                </div>
              </div>
            </div>

            {/* footer */}
            <div className="flex items-center justify-between pt-3">
              <div>
                <Button variant="ghost" onClick={() => setOpenForm(false)}>
                  Cancel
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button type="submit">Save BOM</Button>
              </div>
            </div>

            {/* Preview grid */}
            {preview.length > 0 && (
              <div className="mt-4 border rounded p-3">
                <h4 className="font-medium mb-2">
                  Preview for {productionQty} finished units
                </h4>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Required (component unit)</TableHead>
                        <TableHead>Required (stock unit)</TableHead>
                        <TableHead>Available (stock unit)</TableHead>
                        <TableHead>Shortage</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell>{r.comp.itemType}</TableCell>
                          <TableCell>{getItemName(r.comp)}</TableCell>
                          <TableCell>
                            {Number(r.required_in_comp_unit.toFixed(6))}{" "}
                            {r.comp.unit}
                          </TableCell>
                          <TableCell>
                            {Number(r.required_in_stock_unit.toFixed(6))}{" "}
                            {r.stockUnit}
                          </TableCell>
                          <TableCell>
                            {Number(r.available_in_stock_unit.toFixed(6))}{" "}
                            {r.stockUnit}
                          </TableCell>
                          <TableCell
                            className={
                              r.shortage_in_stock_unit > 0
                                ? "text-red-600 font-bold"
                                : ""
                            }
                          >
                            {Number(r.shortage_in_stock_unit.toFixed(6))}{" "}
                            {r.stockUnit}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
