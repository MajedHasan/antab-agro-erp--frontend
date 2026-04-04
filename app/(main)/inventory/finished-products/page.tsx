// src/app/products/page.tsx
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
import { Plus, Trash2, Edit, Search, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

/**
 * Product Page
 *
 * Features:
 * - List products with pagination/search
 * - Create / Edit product
 * - Export CSV
 * - View per-warehouse product stocks (product-stocks)
 * - Adjust stock: add or update per-warehouse stock record
 */

/* ---------- types ---------- */
type Product = {
  _id?: string;
  name: string;
  sku: string;
  code?: string;
  category?: string | null;
  tags?: string[];
  unit?: string;
  costPrice?: number;
  salePrice?: number;
  taxRate?: number;
  barcode?: string;
  stock?: number;
  reorderLevel?: number;
  description?: string;
  images?: { url: string; alt?: string }[];
  status?: string;
};

type Warehouse = { _id: string; name: string; code?: string; type?: string };

type ProductStock = {
  _id?: string;
  productId: string | any;
  warehouseId: string | any;
  warehouse?: Warehouse;
  quantity: number;
  unit: string;
  batch?: string;
  expiryDate?: string;
  lastUpdated?: string;
};

/* ---------- helpers ---------- */
function idOf(m: any): string | null {
  if (!m) return null;
  if (typeof m === "string") return m;
  if (m._id) return String(m._id);
  if (m.id) return String(m.id);
  return null;
}
function nameOf(m: any) {
  if (!m) return "-";
  if (typeof m === "string") return m;
  return m.name || m.title || m._id || "-";
}
function safeNumber(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/* standard units for products (you can extend) */
const UNIT_OPTIONS = ["pcs", "kg", "g", "ltr", "ml"];

export default function ProductsPage() {
  /* ---------- list state ---------- */
  const [items, setItems] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  /* ---------- modal: create/edit product ---------- */
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<Product>({
    name: "",
    sku: "",
    code: "",
    category: "",
    tags: [],
    unit: "pcs",
    costPrice: 0,
    salePrice: 0,
    taxRate: 0,
    barcode: "",
    stock: 0,
    reorderLevel: 0,
    description: "",
    images: [],
    status: "Active",
  });

  /* ---------- stock view/adjust ---------- */
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productStocks, setProductStocks] = useState<ProductStock[]>([]);
  const [stockLoading, setStockLoading] = useState(false);

  // adjust modal (reuse)
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustRecord, setAdjustRecord] = useState<
    Partial<ProductStock> & { amount?: number }
  >({});

  /* ---------- warehouses for selector ---------- */
  const [factories, setFactories] = useState<Warehouse[]>([]);
  const [refsLoading, setRefsLoading] = useState(false);

  /* ---------- fetch references ---------- */
  useEffect(() => {
    (async function loadRefs() {
      setRefsLoading(true);
      try {
        const res = await api.get("/warehouses", {
          params: { type: "Factory", page: 1, limit: 1000 },
        });
        setFactories(res.data.data || []);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load factories");
      } finally {
        setRefsLoading(false);
      }
    })();
  }, []);

  /* ---------- list fetch ---------- */
  async function fetchList() {
    try {
      setLoading(true);
      const res = await api.get("/products", {
        params: { page, limit, q, locationType: "factory" },
      });
      setItems(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchList();
  }, [page, limit, q]);

  /* ---------- product CRUD ---------- */
  function openCreate() {
    setEditing(null);
    setForm({
      name: "",
      sku: "",
      code: "",
      category: "",
      tags: [],
      unit: "pcs",
      costPrice: 0,
      salePrice: 0,
      taxRate: 0,
      barcode: "",
      stock: 0,
      reorderLevel: 0,
      description: "",
      images: [],
      status: "Active",
    });
    setOpenForm(true);
  }

  function openEdit(item: Product) {
    setEditing(item);
    setForm({
      name: item.name,
      sku: item.sku,
      code: item.code,
      category: item.category,
      tags: item.tags || [],
      unit: item.unit || "pcs",
      costPrice: item.costPrice ?? 0,
      salePrice: item.salePrice ?? 0,
      taxRate: item.taxRate ?? 0,
      barcode: item.barcode ?? "",
      stock: item.stock ?? 0,
      reorderLevel: item.reorderLevel ?? 0,
      description: item.description ?? "",
      images: item.images ?? [],
      status: item.status ?? "Active",
    });
    setOpenForm(true);
  }

  async function submitForm(e?: React.FormEvent) {
    e?.preventDefault();
    if (!form.name?.trim()) return toast.error("Name required");
    if (!form.sku?.trim()) return toast.error("SKU required");

    try {
      if (editing?._id) {
        await api.put(`/products/${editing._id}`, form);
        toast.success("Product updated");
      } else {
        await api.post("/products", form);
        toast.success("Product created");
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
    if (!confirm("Delete product?")) return;
    try {
      await api.delete(`/products/${id}`);
      toast.success("Deleted");
      fetchList();
    } catch {
      toast.error("Delete failed");
    }
  }

  async function exportCSV() {
    try {
      const res = await api.get("/products/export", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "products.csv";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Export failed");
    }
  }

  async function toggleStatus(item: Product) {
    if (!item._id) return;
    try {
      const newStatus = item.status === "Active" ? "Inactive" : "Active";
      await api.put(`/products/${item._id}`, { status: newStatus });
      toast.success("Status updated");
      setItems((prev) =>
        prev.map((p) => (p._id === item._id ? { ...p, status: newStatus } : p)),
      );
    } catch {
      toast.error("Failed to toggle status");
      fetchList();
    }
  }

  /* ---------- product stocks ---------- */
  async function openStockModal(item: Product) {
    setSelectedProduct(item);
    setStockModalOpen(true);
    await fetchProductStocks(item._id!);
  }

  async function fetchProductStocks(productId: string) {
    try {
      setStockLoading(true);
      const res = await api.get("/product-stocks", {
        params: { productId, page: 1, limit: 10000, locationType: "factory" },
      });
      const rows = res.data.data || [];
      // ensure warehouse denorm name exists if backend populated
      setProductStocks(rows);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load product stocks");
      setProductStocks([]);
    } finally {
      setStockLoading(false);
    }
  }

  /* ---------- adjust stock modal ---------- */
  // open adjust either from table (create new) or from stock row (edit)
  function openAdjust(stock?: ProductStock, product?: Product) {
    setAdjustRecord({
      _id: stock?._id,
      productId: stock
        ? idOf(stock.productId) || String(product?._id)
        : String(product?._id),
      warehouseId: stock ? idOf(stock.warehouseId) : "",
      quantity: stock ? safeNumber(stock.quantity) : 0,
      unit: stock ? stock.unit : product?.unit || "pcs",
      batch: stock?.batch || "",
      expiryDate: stock?.expiryDate ? stock.expiryDate.toString() : "",
      amount: 0,
    });
    setAdjustOpen(true);
  }

  async function submitAdjust(e?: React.FormEvent) {
    e?.preventDefault();
    const rec = adjustRecord as Partial<ProductStock> & { amount?: number };
    if (!rec.productId) return toast.error("Product missing");
    if (!rec.warehouseId) return toast.error("Select warehouse");

    try {
      if (rec._id) {
        // update existing record: we'll set new quantity (quantity + amount if amount provided)
        let newQty = safeNumber(rec.quantity);
        if (rec.amount) newQty = newQty + safeNumber(rec.amount);
        await api.put(`/product-stocks/${rec._id}`, {
          quantity: newQty,
          unit: rec.unit,
          batch: rec.batch,
          expiryDate: rec.expiryDate || null,
        });
        toast.success("Stock updated");
      } else {
        // create: amount becomes initial quantity
        const qty = safeNumber(rec.amount) || safeNumber(rec.quantity);
        await api.post("/product-stocks", {
          productId: rec.productId,
          warehouseId: rec.warehouseId,
          quantity: qty,
          unit: rec.unit || "pcs",
          batch: rec.batch,
          expiryDate: rec.expiryDate || null,
        });
        toast.success("Stock record created");
      }

      // refresh stocks and product list snapshot
      if (rec.productId) await fetchProductStocks(String(rec.productId));
      fetchList();
      setAdjustOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Stock save failed");
    }
  }

  /* ---------- derived helpers ---------- */
  const totalPages = Math.max(1, Math.ceil(total / limit));

  /* ---------- render ---------- */
  return (
    <div className="p-4 space-y-6">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Products</h2>
          <p className="text-sm text-muted-foreground">
            Products catalog — manage SKUs, pricing and warehouse stocks
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-md px-2 py-1 gap-2">
            <Search className="w-4 h-4 text-gray-500" />
            <Input
              value={q}
              placeholder="Search name / sku..."
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
              fetchList();
            }}
          >
            <RefreshCcw className="w-4 h-4" /> Refresh
          </Button>
        </div>
      </div>

      {/* table */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="p-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Sale Price</TableHead>
                <TableHead>Stock (snapshot)</TableHead>
                <TableHead>Reorder</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-44">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {items.map((p, idx) => (
                <TableRow key={p._id || idx}>
                  <TableCell>{(page - 1) * limit + idx + 1}</TableCell>

                  <TableCell>
                    <div className="flex flex-col">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.description}
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="text-sm">{p.sku}</TableCell>
                  <TableCell>{p.unit || "pcs"}</TableCell>
                  <TableCell>৳ {p.salePrice ?? 0}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{p.stock ?? 0}</div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openStockModal(p)}
                      >
                        View stocks
                      </Button>
                    </div>
                  </TableCell>

                  <TableCell>{p.reorderLevel ?? 0}</TableCell>

                  <TableCell>
                    <div className="text-sm">{p.status ?? "Active"}</div>
                  </TableCell>

                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEdit(p)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>

                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => removeItem(p._id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openAdjust(undefined, p)}
                      >
                        Adjust Stock
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-6">
                    {loading ? "Loading..." : "No products found"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* pagination */}
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

      {/* Create / Edit Modal */}
      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent>
          <form onSubmit={submitForm} className="space-y-4">
            <h3 className="text-lg font-semibold">
              {editing?._id ? "Edit Product" : "New Product"}
            </h3>

            <div>
              <label className="text-sm">Name</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm">SKU</label>
                <Input
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm">Code</label>
                <Input
                  value={form.code || ""}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm">Category</label>
                <Input
                  value={form.category || ""}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-sm">Unit</label>
                <select
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  className="border rounded px-2 py-1 w-full"
                >
                  {UNIT_OPTIONS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-sm">Cost Price</label>
                <Input
                  type="number"
                  value={form.costPrice ?? 0}
                  onChange={(e) =>
                    setForm({ ...form, costPrice: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <label className="text-sm">Sale Price</label>
                <Input
                  type="number"
                  value={form.salePrice ?? 0}
                  onChange={(e) =>
                    setForm({ ...form, salePrice: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <label className="text-sm">Tax %</label>
                <Input
                  type="number"
                  value={form.taxRate ?? 0}
                  onChange={(e) =>
                    setForm({ ...form, taxRate: Number(e.target.value) })
                  }
                />
              </div>
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

            <div>
              <label className="text-sm">Description</label>
              <Input
                value={form.description || ""}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>

            <div>
              <label className="text-sm">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="border rounded px-2 py-1 w-full"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                type="button"
                onClick={() => setOpenForm(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editing?._id ? "Save changes" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Stocks Modal */}
      <Dialog
        open={stockModalOpen}
        onOpenChange={() => {
          setStockModalOpen(false);
          setSelectedProduct(null);
        }}
      >
        <DialogContent className="!max-w-4xl">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                Stocks — {selectedProduct?.name}
              </h3>
              <div>
                <Button
                  size="sm"
                  onClick={() =>
                    openAdjust(undefined, selectedProduct || undefined)
                  }
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
                      <TableHead>#</TableHead>
                      <TableHead>Warehouse</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productStocks.map((s, i) => (
                      <TableRow key={s._id || i}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell>
                          {nameOf(s.warehouse || s.warehouseId)}
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
                                openAdjust(s, selectedProduct || undefined)
                              }
                            >
                              Adjust
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}

                    {productStocks.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-4">
                          No stock records
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setStockModalOpen(false);
                  setSelectedProduct(null);
                }}
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Adjust Stock Modal */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <form onSubmit={submitAdjust} className="space-y-4">
            <h3 className="text-lg font-semibold">Adjust Stock</h3>

            <div>
              <label className="text-sm">Product</label>
              <div className="py-2">
                {nameOf(
                  items.find((p) => p._id === adjustRecord.productId) ||
                    selectedProduct ||
                    adjustRecord.productId,
                )}
              </div>
            </div>

            <div>
              <label className="text-sm">Warehouse</label>
              <select
                required
                value={String(adjustRecord.warehouseId ?? "")}
                onChange={(e) =>
                  setAdjustRecord({
                    ...adjustRecord,
                    warehouseId: e.target.value,
                  })
                }
                className="border rounded px-2 py-1 w-full"
              >
                <option value="">Select warehouse</option>
                {factories.map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.name} {w.code ? `(${w.code})` : ""}
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
                value={adjustRecord.unit ?? selectedProduct?.unit ?? "pcs"}
                onChange={(e) =>
                  setAdjustRecord({ ...adjustRecord, unit: e.target.value })
                }
                className="border rounded px-2 py-1 w-full"
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm">Batch</label>
              <Input
                value={adjustRecord.batch ?? ""}
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
              <Button variant="ghost" onClick={() => setAdjustOpen(false)}>
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
