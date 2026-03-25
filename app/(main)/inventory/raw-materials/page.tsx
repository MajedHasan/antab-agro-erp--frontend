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
import { Trash2, Edit, Plus, Search, ChevronDown, Sliders } from "lucide-react";
import { toast } from "sonner";

/**
 * Frontend page for Raw Materials (matches your rawMaterial.model.ts)
 *
 * - Shows list with pagination, search, export, status toggle
 * - Edit/Create modal uses schema fields: name, sku, category, unit, purchasePrice, averagePrice, minStockLevel, reorderLevel, isActive, notes
 * - Shows aggregated stock per-material (sums across factories using /raw-material-stocks)
 * - Stock Detail modal per material (shows per-factory rows), with quick adjustment (create/update a RawMaterialStock record)
 *
 * NOTE: This code expects these backend endpoints:
 *   GET /raw-materials (list)
 *   POST /raw-materials
 *   PUT /raw-materials/:id
 *   DELETE /raw-materials/:id
 *
 *   GET /raw-material-stocks (list)
 *   POST /raw-material-stocks
 *   PUT /raw-material-stocks/:id
 *
 * Adjust if your API paths differ.
 */

/* ---------- Types ---------- */
type RawMaterial = {
  _id?: string;
  name: string;
  sku: string;
  category?: string;
  unit: "kg" | "g" | "ltr" | "ml";
  purchasePrice?: number;
  averagePrice?: number;
  minStockLevel?: number;
  reorderLevel?: number;
  isActive?: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

type StockItem = {
  _id?: string;
  rawMaterialId: string;
  factoryId: string;
  factory?: { _id: string; name?: string; code?: string; type?: string };
  quantity: number;
  unit: "kg" | "g" | "ltr" | "ml" | "pcs";
  batch?: string;
  expiryDate?: string;
  lastUpdated?: string;
};

/* ---------- Small UI bits ---------- */
function UnitBadge({ unit }: { unit: string }) {
  return (
    <span className="px-2 py-0.5 rounded-full text-xs border">{unit}</span>
  );
}

function StatusBadge({ active }: { active?: boolean }) {
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs ${
        active ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

/* ---------- Component ---------- */
export default function RawMaterialsPage() {
  /* ---- list state ---- */
  const [items, setItems] = useState<RawMaterial[]>([]);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(15);
  const [total, setTotal] = useState<number>(0);
  const [q, setQ] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  /* ---- form modal ---- */
  const [openForm, setOpenForm] = useState<boolean>(false);
  const [editing, setEditing] = useState<RawMaterial | null>(null);
  const [form, setForm] = useState<RawMaterial>({
    name: "",
    sku: "",
    category: "",
    unit: "kg",
    purchasePrice: 0,
    averagePrice: 0,
    minStockLevel: 0,
    reorderLevel: 0,
    isActive: true,
    notes: "",
  });

  /* ---- stock state (aggregated client side) ---- */
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<RawMaterial | null>(
    null
  );

  /* ---- quick adjustment modal ---- */
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustRecord, setAdjustRecord] = useState<
    Partial<StockItem> & { amount?: number }
  >({});

  /* ---- derived ---- */
  const totalPages = Math.max(1, Math.ceil(total / limit));

  /* ---------- Factory state ---------- */
  const [factories, setFactories] = useState<{ _id: string; name: string }[]>(
    []
  );

  /* ---------- Fetch factories once ---------- */
  useEffect(() => {
    const fetchFactories = async () => {
      try {
        const res = await api.get("/warehouses-or-factories?type=Factory", {
          params: { limit: 100 },
        });
        setFactories(res.data.data || []);
      } catch (err) {
        toast.error("Failed to load factories");
      }
    };
    fetchFactories();
  }, []);

  /* ---------- Fetch functions ---------- */
  async function fetchList() {
    try {
      setLoading(true);
      const res = await api.get("/raw-materials", {
        params: { page, limit, q },
      });
      setItems(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load raw materials");
    } finally {
      setLoading(false);
    }
  }

  async function fetchStocksForAll() {
    // Fetch all stocks (limited to a large number). If you have huge data, change to backend aggregation endpoint.
    try {
      setStockLoading(true);
      // Request high limit; adjust per your dataset or implement backend aggregate endpoint.
      const res = await api.get("/raw-material-stocks", {
        params: { page: 1, limit: 10000 },
      });
      setStocks(res.data.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load stocks");
    } finally {
      setStockLoading(false);
    }
  }

  // initial load & reload triggers
  useEffect(() => {
    fetchList();
  }, [page, limit, q]);

  // fetch stocks whenever items change (to compute aggregated stock)
  useEffect(() => {
    if (items.length > 0) {
      // Keep stocks fresh when listing changes
      fetchStocksForAll();
    } else {
      setStocks([]);
    }
  }, [items]);

  /* ---------- helpers: compute aggregated stock for a material ---------- */
  const stockByMaterial = useMemo(() => {
    const map = new Map<string, { total: number; rows: StockItem[] }>();
    for (const s of stocks) {
      const id =
        typeof s.rawMaterialId === "string"
          ? s.rawMaterialId
          : s.rawMaterialId._id;
      const entry = map.get(id) || { total: 0, rows: [] };
      entry.total += Number(s.quantity || 0);
      entry.rows.push(s);
      map.set(id, entry);
    }
    return map;
  }, [stocks]);

  /* ---------- actions ---------- */
  function openCreate() {
    setEditing(null);
    setForm({
      name: "",
      sku: "",
      category: "",
      unit: "kg",
      purchasePrice: 0,
      averagePrice: 0,
      minStockLevel: 0,
      reorderLevel: 0,
      isActive: true,
      notes: "",
    });
    setOpenForm(true);
  }

  function openEdit(item: RawMaterial) {
    setEditing(item);
    setForm({
      name: item.name,
      sku: item.sku,
      category: item.category,
      unit: item.unit,
      purchasePrice: item.purchasePrice || 0,
      averagePrice: item.averagePrice || 0,
      minStockLevel: item.minStockLevel || 0,
      reorderLevel: item.reorderLevel || 0,
      isActive: item.isActive ?? true,
      notes: item.notes || "",
    });
    setOpenForm(true);
  }

  async function submitForm(e?: React.FormEvent) {
    e?.preventDefault();
    if (!form.name?.trim()) return toast.error("Name is required");
    if (!form.sku?.trim()) return toast.error("SKU is required");
    if (!form.unit) return toast.error("Unit is required");

    try {
      if (editing?._id) {
        await api.put(`/raw-materials/${editing._id}`, form);
        toast.success("Updated raw material");
      } else {
        await api.post("/raw-materials", form);
        toast.success("Created raw material");
      }
      setOpenForm(false);
      fetchList();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Save failed");
    }
  }

  async function removeItem(id?: string) {
    if (!id) return;
    if (!confirm("Delete raw material?")) return;
    try {
      await api.delete(`/raw-materials/${id}`);
      toast.success("Deleted");
      fetchList();
    } catch {
      toast.error("Delete failed");
    }
  }

  async function exportCSV() {
    try {
      const res = await api.get("/raw-materials/export", {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "raw_materials.csv";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error("Export failed");
    }
  }

  async function toggleActive(item: RawMaterial) {
    if (!item._id) return;
    try {
      const newVal = !item.isActive;
      await api.put(`/raw-materials/${item._id}`, { isActive: newVal });
      toast.success(`Status updated`);
      // optimistic update
      setItems((prev) =>
        prev.map((p) => (p._id === item._id ? { ...p, isActive: newVal } : p))
      );
    } catch (err) {
      toast.error("Failed to update status");
      fetchList();
    }
  }

  /* ---------- Stock modal actions ---------- */
  function openStockModal(item: RawMaterial) {
    setSelectedMaterial(item);
    setStockModalOpen(true);
  }

  async function openAdjustModal(stock?: StockItem, material?: RawMaterial) {
    const rawMaterialId = stock
      ? typeof stock.rawMaterialId === "string"
        ? stock.rawMaterialId
        : stock.rawMaterialId._id
      : material?._id;

    const factoryId = stock
      ? typeof stock.factoryId === "string"
        ? stock.factoryId
        : stock.factoryId._id
      : undefined;

    setAdjustRecord({
      _id: stock?._id,
      rawMaterialId,
      factoryId,
      quantity: stock?.quantity || 0,
      unit: stock?.unit || material?.unit || "kg",
      batch: stock?.batch || "",
      expiryDate: stock?.expiryDate || "",
      amount: 0,
    });

    setAdjustOpen(true);
  }

  async function submitAdjust(e?: React.FormEvent) {
    e?.preventDefault();
    const rec = adjustRecord as Partial<StockItem> & { amount?: number };
    if (!rec.rawMaterialId || !rec.factoryId) {
      return toast.error("Select factory and raw material");
    }
    // if _id present -> update; else create
    try {
      if (rec._id) {
        // update quantity to exact value or increment? We'll support setting quantity to rec.quantity + amount
        let newQty = Number(rec.quantity || 0);
        if (rec.amount) newQty = newQty + Number(rec.amount);
        await api.put(`/raw-material-stocks/${rec._id}`, { quantity: newQty });
        toast.success("Stock updated");
      } else {
        // create new stock record with quantity = amount
        await api.post(`/raw-material-stocks`, {
          rawMaterialId: rec.rawMaterialId,
          factoryId: rec.factoryId,
          quantity: Number(rec.amount || 0),
          unit: rec.unit,
          batch: rec.batch,
          expiryDate: rec.expiryDate,
        });
        toast.success("Stock added");
      }
      setAdjustOpen(false);
      setStockModalOpen(true);
      await fetchStocksForAll();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Stock update failed");
    }
  }

  const stockByMaterialAndFactory = useMemo(() => {
    const map = new Map<string, StockItem>();
    for (const s of stocks) {
      const materialId =
        typeof s.rawMaterialId === "string"
          ? s.rawMaterialId
          : s.rawMaterialId._id;
      const factoryId =
        typeof s.factoryId === "string" ? s.factoryId : s.factoryId._id;
      const key = `${materialId}_${factoryId}`;
      map.set(key, s);
    }
    return map;
  }, [stocks]);

  /* ---------- Render ---------- */
  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Raw Materials</h2>
          <p className="text-sm text-muted-foreground">
            Manage raw materials — SKU, category, units, prices and stock across
            factories
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center border rounded-md px-2 py-1 gap-2">
            <Search className="w-4 h-4 text-gray-500" />
            <Input
              value={q}
              placeholder="Search name, sku or category..."
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              className="border-0 p-0"
            />
          </div>

          <Button onClick={openCreate} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New
          </Button>

          <Button variant="secondary" onClick={exportCSV}>
            Export CSV
          </Button>

          <Button
            variant="ghost"
            onClick={() => {
              setPage(1);
              setLimit(15);
              fetchStocksForAll();
            }}
          >
            <Sliders className="w-4 h-4" />
            Refresh Stocks
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="p-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Purchase Price</TableHead>
                <TableHead>Avg Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Min / Reorder</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-40">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {items.map((m, idx) => {
                const agg = stockByMaterial.get(m._id || "") ?? {
                  total: 0,
                  rows: [],
                };
                const belowMin = (agg.total || 0) < (m.minStockLevel || 0);
                return (
                  <TableRow key={m._id || idx}>
                    <TableCell>{(page - 1) * limit + idx + 1}</TableCell>

                    <TableCell>
                      <div className="flex flex-col">
                        <div className="font-medium">{m.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {m.notes}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="text-sm">{m.sku}</TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs ${
                          m.category === "chemical"
                            ? "bg-red-100 text-red-800"
                            : m.category === "liquid"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {m.category || "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <UnitBadge unit={m.unit} />
                    </TableCell>

                    <TableCell className="text-sm">
                      ৳ {m.purchasePrice ?? 0}
                    </TableCell>
                    <TableCell className="text-sm">
                      ৳ {m.averagePrice ?? 0}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div
                          className={`font-medium ${
                            belowMin ? "text-red-600" : ""
                          }`}
                        >
                          {agg.total ?? 0}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openStockModal(m)}
                        >
                          View stocks
                        </Button>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="text-sm">
                        <div>Min: {m.minStockLevel ?? 0}</div>
                        <div>Reorder: {m.reorderLevel ?? 0}</div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StatusBadge active={m.isActive} />
                        <button
                          onClick={() => toggleActive(m)}
                          className="ml-1 inline-flex items-center gap-2 px-2 py-1 rounded-md border text-sm"
                          title={m.isActive ? "Deactivate" : "Activate"}
                        >
                          <span
                            className={`w-6 h-3 rounded-full inline-block relative ${
                              m.isActive ? "bg-green-400" : "bg-gray-300"
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 w-2 h-2 rounded-full bg-white shadow transform ${
                                m.isActive ? "translate-x-3" : ""
                              }`}
                            />
                          </span>
                        </button>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEdit(m)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => removeItem(m._id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            openAdjustModal(undefined, m);
                            console.log(m);
                          }}
                        >
                          Adjust Stock
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}

              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-6">
                    {loading ? "Loading..." : "No raw materials found"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
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

      {/* ---------- Create / Edit Modal ---------- */}
      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent>
          <form onSubmit={submitForm} className="space-y-4">
            <h3 className="text-lg font-semibold">
              {editing?._id ? "Edit Raw Material" : "New Raw Material"}
            </h3>

            <div>
              <label className="text-sm">Name</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm">SKU</label>
              <Input
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm">Category</label>
              <select
                value={form.category || ""}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="border rounded px-2 py-1 w-full text-sm"
              >
                <option value="">Select category</option>
                <option value="chemical">Chemical</option>
                <option value="liquid">Liquid</option>
                <option value="powder">Powder</option>
              </select>
            </div>

            <div>
              <label className="text-sm">Unit</label>
              <select
                value={form.unit}
                onChange={(e) =>
                  setForm({
                    ...form,
                    unit: e.target.value as RawMaterial["unit"],
                  })
                }
                className="border rounded px-2 py-1 w-full text-sm"
              >
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="ltr">ltr</option>
                <option value="ml">ml</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm">Purchase Price</label>
                <Input
                  type="number"
                  value={form.purchasePrice ?? 0}
                  onChange={(e) =>
                    setForm({ ...form, purchasePrice: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <label className="text-sm">Average Price</label>
                <Input
                  type="number"
                  value={form.averagePrice ?? 0}
                  onChange={(e) =>
                    setForm({ ...form, averagePrice: Number(e.target.value) })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm">Min Stock Level</label>
                <Input
                  type="number"
                  value={form.minStockLevel ?? 0}
                  onChange={(e) =>
                    setForm({ ...form, minStockLevel: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <label className="text-sm">Reorder Level</label>
                <Input
                  type="number"
                  value={form.reorderLevel ?? 0}
                  onChange={(e) =>
                    setForm({ ...form, reorderLevel: Number(e.target.value) })
                  }
                />
              </div>
            </div>

            <div>
              <label className="text-sm">Notes</label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm">Status</label>
              <select
                value={form.isActive ? "Active" : "Inactive"}
                onChange={(e) =>
                  setForm({ ...form, isActive: e.target.value === "Active" })
                }
                className="border rounded px-2 py-1 w-full"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpenForm(false)}
              >
                Cancel
              </Button>
              <Button type="submit">{editing?._id ? "Save" : "Create"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ---------- Stock Modal (per-material) ---------- */}
      <Dialog open={stockModalOpen} onOpenChange={setStockModalOpen}>
        <DialogContent className="w-full md:!min-w-3xl !max-w-3xl">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                Stocks for {selectedMaterial?.name}
              </h3>
              <div>
                <Button
                  size="sm"
                  onClick={() => openAdjustModal(undefined, selectedMaterial!)}
                >
                  Add Stock
                </Button>
              </div>
            </div>

            {stockLoading ? (
              <div>Loading stocks…</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Factory</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(
                      stockByMaterial.get(selectedMaterial?._id || "")?.rows ||
                      []
                    ).map((s) => (
                      <TableRow key={s._id}>
                        <TableCell>
                          {s.factoryId?.name ||
                            s.factory?.name ||
                            (s.factoryId as any)._id}
                        </TableCell>
                        <TableCell>{s.quantity}</TableCell>
                        <TableCell>{s.unit}</TableCell>
                        <TableCell>{s.batch || "-"}</TableCell>
                        <TableCell>
                          {s.expiryDate
                            ? new Date(s.expiryDate).toLocaleDateString()
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {s.lastUpdated
                            ? new Date(s.lastUpdated).toLocaleString()
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                openAdjustModal(s, selectedMaterial!)
                              }
                            >
                              Adjust
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}

                    {(
                      stockByMaterial.get(selectedMaterial?._id || "")?.rows ||
                      []
                    ).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-4">
                          No stock records
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setStockModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ---------- Adjust Stock Modal ---------- */}
      {/* ---------- Adjust Stock Modal ---------- */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <form onSubmit={submitAdjust} className="space-y-4">
            <h3 className="text-lg font-semibold">Adjust Stock</h3>

            {/* Factory select */}
            <div>
              <label className="text-sm">Factory</label>
              <select
                value={adjustRecord.factoryId || ""}
                onChange={(e) => {
                  const factoryId = e.target.value;

                  // normalize key for lookup
                  const key = `${adjustRecord.rawMaterialId}_${factoryId}`;
                  const existingStock = stockByMaterialAndFactory.get(key);

                  setAdjustRecord({
                    ...adjustRecord,
                    factoryId,
                    quantity: existingStock?.quantity || 0,
                    unit: existingStock?.unit || adjustRecord.unit || "kg",
                    batch: existingStock?.batch || "",
                    expiryDate: existingStock?.expiryDate || "",
                    _id: existingStock?._id,
                  });
                }}
                className="border rounded px-2 py-1 w-full"
                required
              >
                <option value="">Select factory</option>
                {factories.map((f) => (
                  <option key={f._id} value={f._id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm">Current Quantity (if editing)</label>
              <Input
                type="number"
                value={adjustRecord.quantity ?? 0}
                onChange={(e) =>
                  setAdjustRecord({
                    ...adjustRecord,
                    quantity: Number(e.target.value),
                  })
                }
              />
            </div>

            <div>
              <label className="text-sm">
                Amount (positive to add, negative to subtract)
              </label>
              <Input
                type="number"
                value={adjustRecord.amount ?? 0}
                onChange={(e) =>
                  setAdjustRecord({
                    ...adjustRecord,
                    amount: Number(e.target.value),
                  })
                }
              />
            </div>

            <div>
              <label className="text-sm">Unit</label>
              <select
                value={adjustRecord.unit || "kg"}
                onChange={(e) =>
                  setAdjustRecord({ ...adjustRecord, unit: e.target.value })
                }
                className="border rounded px-2 py-1 w-full"
              >
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="ltr">ltr</option>
                <option value="ml">ml</option>
              </select>
            </div>

            <div>
              <label className="text-sm">Batch</label>
              <Input
                value={adjustRecord.batch || ""}
                onChange={(e) =>
                  setAdjustRecord({ ...adjustRecord, batch: e.target.value })
                }
              />
            </div>

            <div>
              <label className="text-sm">Expiry Date</label>
              <Input
                type="date"
                value={
                  adjustRecord.expiryDate
                    ? new Date(adjustRecord.expiryDate)
                        .toISOString()
                        .slice(0, 10)
                    : ""
                }
                onChange={(e) =>
                  setAdjustRecord({
                    ...adjustRecord,
                    expiryDate: e.target.value,
                  })
                }
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                type="button"
                onClick={() => setAdjustOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
