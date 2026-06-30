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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Trash2,
  Edit,
  Plus,
  Search,
  Sliders,
  Eye,
  Package,
  AlertTriangle,
  BarChart3,
  Factory,
  DollarSign,
  Box,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCcw,
  ShoppingCart,
  ClipboardList,
  Layers,
  FileText,
  Warehouse,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

/* ---------- Types ---------- */
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

type ProductStock = {
  _id?: string;
  productId: string | any;
  warehouseId: string | any;
  warehouse?: { _id: string; name?: string; code?: string };
  quantity: number;
  unit: string;
  batch?: string;
  expiryDate?: string;
  lastUpdated?: string;
  reservedForSales?: number;
  reservedForTransfer?: number;
  incomingTransfer?: number;
  availableStock?: number;
};

type StockTransaction = {
  _id: string;
  itemType: string;
  itemId: string;
  locationId: string;
  transactionType: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  sourceId?: string;
  sourceModel?: string;
  transactionDate: string;
  createdBy?: string;
  batch?: string;
};

/* ---------- Transaction colours & icons ---------- */
const txConfig: Record<string, { icon: any; bg: string; label: string }> = {
  purchase: {
    icon: ArrowDownCircle,
    bg: "bg-emerald-100 text-emerald-700",
    label: "Purchase",
  },
  consumption: {
    icon: ArrowUpCircle,
    bg: "bg-rose-100 text-rose-700",
    label: "Consumption",
  },
  transfer_in: {
    icon: ArrowDownCircle,
    bg: "bg-blue-100 text-blue-700",
    label: "Transfer In",
  },
  transfer_out: {
    icon: ArrowUpCircle,
    bg: "bg-orange-100 text-orange-700",
    label: "Transfer Out",
  },
  sale: {
    icon: ShoppingCart,
    bg: "bg-purple-100 text-purple-700",
    label: "Sale",
  },
  return: {
    icon: RefreshCcw,
    bg: "bg-cyan-100 text-cyan-700",
    label: "Return",
  },
  wastage: { icon: Trash2, bg: "bg-red-100 text-red-700", label: "Wastage" },
  adjustment: {
    icon: Sliders,
    bg: "bg-gray-100 text-gray-700",
    label: "Adjustment",
  },
  reservation: {
    icon: ClipboardList,
    bg: "bg-amber-100 text-amber-700",
    label: "Reservation",
  },
};

/* ---------- Helpers ---------- */
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

const UNIT_OPTIONS = ["pcs", "kg", "g", "ltr", "ml"];

export default function ProductsPage() {
  /* ---- list state ---- */
  const [items, setItems] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  /* ---- form modal ---- */
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

  /* ---- stock modal state ---- */
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productStocks, setProductStocks] = useState<ProductStock[]>([]);
  const [stockLoading, setStockLoading] = useState(false);

  /* ---- quick adjustment modal ---- */
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustRecord, setAdjustRecord] = useState<
    Partial<ProductStock> & { amount?: number }
  >({});

  /* ---- stock transactions state ---- */
  const [txLoading, setTxLoading] = useState(false);
  const [stockTransactions, setStockTransactions] = useState<
    StockTransaction[]
  >([]);
  const [selectedStockForTx, setSelectedStockForTx] =
    useState<ProductStock | null>(null);

  /* ---- warehouses for selector ---- */
  const [warehouses, setWarehouses] = useState<
    { _id: string; name: string; code?: string; type?: string }[]
  >([]);
  const [refsLoading, setRefsLoading] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  /* ---------- Fetch warehouses ---------- */
  useEffect(() => {
    (async () => {
      setRefsLoading(true);
      try {
        const res = await api.get("/warehouses", {
          params: { type: "Factory", page: 1, limit: 1000 },
        });
        setWarehouses(res.data.data || []);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load warehouses");
      } finally {
        setRefsLoading(false);
      }
    })();
  }, []);

  /* ---------- Fetch products ---------- */
  async function fetchList() {
    setLoading(true);
    try {
      // ✅ FIX: locationType inside filter so it reaches the service
      const res = await api.get("/products", {
        params: {
          page,
          limit,
          q,
          filter: { locationType: "factory" },
        },
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

  /* ---------- Fetch stocks for selected product ---------- */
  async function fetchProductStocks(productId: string) {
    setStockLoading(true);
    try {
      // ✅ FIX: pass productId and locationType inside filter
      const res = await api.get("/product-stocks", {
        params: {
          page: 1,
          limit: 10000,
          filter: {
            productId,
            locationType: "factory",
          },
        },
      });
      setProductStocks(res.data.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load product stocks");
      setProductStocks([]);
    } finally {
      setStockLoading(false);
    }
  }

  /* ---------- Fetch stock transactions ---------- */
  async function fetchStockTransactions(stock: ProductStock) {
    if (!selectedProduct) return;
    setTxLoading(true);
    try {
      const productId = selectedProduct._id;
      const warehouseId = idOf(stock.warehouseId);
      // ✅ FIX: use filter object for backend allowedFilterFields
      const res = await api.get("/stock-transactions", {
        params: {
          sort: "-transactionDate",
          limit: 100,
          filter: {
            itemType: "Product",
            itemId: productId,
            locationId: warehouseId,
          },
        },
      });
      setStockTransactions(res.data.data || []);
      setSelectedStockForTx(stock);
    } catch (err) {
      toast.error("Failed to load stock transactions");
      setStockTransactions([]);
    } finally {
      setTxLoading(false);
    }
  }

  /* ---------- Summary stats ---------- */
  const summaryStats = useMemo(() => {
    const totalItems = items.length;
    const lowStockCount = items.filter((m) => {
      const stock = safeNumber(m.stock) || 0;
      return stock <= (m.reorderLevel || 0);
    }).length;
    const totalValue = items.reduce(
      (acc, m) => acc + safeNumber(m.stock) * (m.costPrice || 0),
      0,
    );
    return { totalItems, lowStockCount, totalValue };
  }, [items]);

  /* ---------- CRUD actions ---------- */
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
    setForm({ ...item });
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
      toast.error(err?.response?.data?.message || "Save failed");
    }
  }

  async function removeItem(id?: string) {
    if (!id || !confirm("Delete product?")) return;
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

  function openStockModal(item: Product) {
    setSelectedProduct(item);
    setSelectedStockForTx(null);
    setStockTransactions([]);
    setStockModalOpen(true);
    if (item._id) fetchProductStocks(item._id);
  }

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
    if (!rec.productId || !rec.warehouseId)
      return toast.error("Product and warehouse required");
    try {
      if (rec._id) {
        let newQty = safeNumber(rec.quantity);
        if (rec.amount) newQty += safeNumber(rec.amount);
        await api.put(`/product-stocks/${rec._id}`, {
          quantity: newQty,
          unit: rec.unit,
          batch: rec.batch,
          expiryDate: rec.expiryDate || null,
        });
        toast.success("Stock updated");
      } else {
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
      if (rec.productId) await fetchProductStocks(String(rec.productId));
      fetchList();
      setAdjustOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Stock save failed");
    }
  }

  /* ---------- Render ---------- */
  return (
    <div className="space-y-6 p-4 md:p-6 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-800 flex items-center gap-2">
            <Package className="w-8 h-8 text-indigo-600" />
            Products
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage finished products, factory stocks, and transactions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search name, SKU..."
              className="pl-9 rounded-xl border-slate-200 focus:border-indigo-400"
            />
          </div>
          <Button
            onClick={openCreate}
            className="gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md"
          >
            <Plus className="w-4 h-4" /> New
          </Button>
          <Button
            variant="outline"
            onClick={exportCSV}
            className="gap-2 rounded-xl"
          >
            <Sliders className="w-4 h-4" /> Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="shadow-sm hover:shadow-md transition border-l-4 border-l-indigo-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Products
            </CardTitle>
            <Box className="w-4 h-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats.totalItems}</div>
            <p className="text-xs text-muted-foreground">Active SKUs</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm hover:shadow-md transition border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Low Stock Alerts
            </CardTitle>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summaryStats.lowStockCount}
            </div>
            <p className="text-xs text-muted-foreground">Below reorder level</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm hover:shadow-md transition border-l-4 border-l-emerald-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Inventory Value
            </CardTitle>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ৳ {summaryStats.totalValue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Total stock value</p>
          </CardContent>
        </Card>
      </div>

      {/* Table Card */}
      <Card className="shadow-lg border-0 rounded-2xl overflow-hidden bg-white/80 backdrop-blur-sm">
        <div className="p-4 overflow-x-auto">
          <Table>
            <TableHeader className="bg-gradient-to-r from-indigo-50 to-blue-50">
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
                <TableRow
                  key={p._id || idx}
                  className="hover:bg-indigo-50/50 transition-colors"
                >
                  <TableCell>{(page - 1) * limit + idx + 1}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-800">
                        {p.name}
                      </span>
                      {p.description && (
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {p.description}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm font-mono">{p.sku}</TableCell>
                  <TableCell>{p.unit || "pcs"}</TableCell>
                  <TableCell className="text-sm font-medium">
                    ৳ {p.salePrice ?? 0}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">
                        {p.stock ?? 0}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openStockModal(p)}
                        className="h-6 p-0"
                      >
                        <Eye className="w-3 h-3 mr-1" /> view
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.reorderLevel ?? 0}
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => toggleStatus(p)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${p.status === "Active" ? "bg-emerald-500" : "bg-gray-300"}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${p.status === "Active" ? "translate-x-6" : "translate-x-1"}`}
                      />
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEdit(p)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeItem(p._id)}
                      >
                        <Trash2 className="w-4 h-4 text-rose-500" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openAdjust(undefined, p)}
                      >
                        <Plus className="w-3 h-3 mr-1" /> Stock
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center py-10 text-muted-foreground"
                  >
                    {loading ? "Loading..." : "No products found"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between p-4 border-t border-slate-100">
          <div className="text-sm text-muted-foreground">
            Showing {(page - 1) * limit + 1} - {Math.min(page * limit, total)}{" "}
            of {total}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="border rounded-lg px-2 py-1 text-sm"
            >
              {[10, 15, 25, 50, 100].map((l) => (
                <option key={l} value={l}>
                  {l} / page
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Prev
              </Button>
              <span className="px-3 text-sm">
                {page} / {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* ---------- Create / Edit Modal ---------- */}
      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="max-w-lg">
          <form onSubmit={submitForm} className="space-y-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
              {editing?._id ? (
                <Edit className="w-5 h-5" />
              ) : (
                <Plus className="w-5 h-5" />
              )}
              {editing?._id ? "Edit Product" : "New Product"}
            </h3>
            <div className="grid gap-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">SKU</label>
                  <Input
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Code</label>
                  <Input
                    value={form.code || ""}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Category</label>
                  <Input
                    value={form.category || ""}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Unit</label>
                  <select
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  >
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">Cost Price</label>
                  <Input
                    type="number"
                    value={form.costPrice ?? 0}
                    onChange={(e) =>
                      setForm({ ...form, costPrice: Number(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Sale Price</label>
                  <Input
                    type="number"
                    value={form.salePrice ?? 0}
                    onChange={(e) =>
                      setForm({ ...form, salePrice: Number(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Tax %</label>
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
                <label className="text-sm font-medium">Reorder Level</label>
                <Input
                  type="number"
                  value={form.reorderLevel ?? 0}
                  onChange={(e) =>
                    setForm({ ...form, reorderLevel: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Input
                  value={form.description || ""}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Status</label>
                <button
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      status: form.status === "Active" ? "Inactive" : "Active",
                    })
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.status === "Active" ? "bg-emerald-500" : "bg-gray-300"}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.status === "Active" ? "translate-x-6" : "translate-x-1"}`}
                  />
                </button>
                <span className="text-sm">
                  {form.status === "Active" ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpenForm(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editing?._id ? "Save Changes" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ---------- Stock & Transactions Dashboard ---------- */}
      <Dialog open={stockModalOpen} onOpenChange={setStockModalOpen}>
        <DialogContent className="w-full md:!min-w-4xl !max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold flex items-center gap-2">
                  <Layers className="w-6 h-6 text-indigo-600" />
                  {selectedProduct?.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Stock breakdown & transaction history per factory
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => openAdjust(undefined, selectedProduct!)}
              >
                <Plus className="w-4 h-4 mr-1" /> Add Stock
              </Button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="shadow-sm border-l-4 border-l-indigo-500">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-100">
                    <Warehouse className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Total Factories
                    </div>
                    <div className="text-xl font-bold">
                      {productStocks.length}
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm border-l-4 border-l-emerald-500">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-100">
                    <Package className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Total Stock
                    </div>
                    <div className="text-xl font-bold">
                      {productStocks.reduce(
                        (acc, s) => acc + safeNumber(s.quantity),
                        0,
                      )}{" "}
                      {selectedProduct?.unit}
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm border-l-4 border-l-blue-500">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <DollarSign className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Est. Value
                    </div>
                    <div className="text-xl font-bold">
                      ৳{" "}
                      {(
                        productStocks.reduce(
                          (acc, s) => acc + safeNumber(s.quantity),
                          0,
                        ) * (selectedProduct?.costPrice || 0)
                      ).toLocaleString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Per‑Factory Stock Cards */}
            {stockLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading stocks…
              </div>
            ) : (
              <div className="grid gap-4">
                {productStocks.map((s) => {
                  const warehouseName =
                    s.warehouse?.name ||
                    nameOf(s.warehouseId) ||
                    "Unknown Factory";
                  const isSelected = selectedStockForTx?._id === s._id;
                  const minLevel = selectedProduct?.reorderLevel || 0;
                  const stockPercent = Math.min(
                    100,
                    Math.round(
                      (s.quantity / (minLevel > 0 ? minLevel : 100)) * 100,
                    ),
                  );
                  const isLow = s.quantity <= minLevel;

                  return (
                    <Card
                      key={s._id}
                      className={`border-2 transition-all ${isSelected ? "border-indigo-400 shadow-lg" : "border-slate-200 hover:border-slate-300"}`}
                    >
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`p-2 rounded-xl ${isLow ? "bg-red-100" : "bg-indigo-100"}`}
                            >
                              <Factory
                                className={`w-5 h-5 ${isLow ? "text-red-600" : "text-indigo-600"}`}
                              />
                            </div>
                            <div>
                              <h4 className="font-semibold text-lg text-slate-800">
                                {warehouseName}
                              </h4>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>
                                  Last updated:{" "}
                                  {s.lastUpdated
                                    ? new Date(
                                        s.lastUpdated,
                                      ).toLocaleDateString()
                                    : "-"}
                                </span>
                                <span>·</span>
                                <span>Batch: {s.batch || "N/A"}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openAdjust(s, selectedProduct!)}
                            >
                              Adjust
                            </Button>
                            <Button
                              size="sm"
                              variant={isSelected ? "default" : "outline"}
                              onClick={() => fetchStockTransactions(s)}
                            >
                              <Clock className="w-4 h-4 mr-1" />{" "}
                              {isSelected ? "Hide History" : "History"}
                            </Button>
                          </div>
                        </div>

                        {/* Stock Level Bar */}
                        <div className="mb-4">
                          <div className="flex justify-between text-xs mb-1">
                            <span
                              className={`font-medium ${isLow ? "text-red-600" : "text-slate-600"}`}
                            >
                              Current: {s.quantity} {s.unit}
                            </span>
                            <span className="text-muted-foreground">
                              Min: {minLevel}
                            </span>
                          </div>
                          <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${isLow ? "bg-red-500" : stockPercent < 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                              style={{ width: `${stockPercent}%` }}
                            />
                          </div>
                          {isLow && (
                            <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
                              <AlertTriangle className="w-3 h-3" /> Low stock!
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2 mb-3">
                          <span className="px-2 py-1 rounded-lg bg-slate-100 text-xs font-medium">
                            Expiry:{" "}
                            {s.expiryDate
                              ? new Date(s.expiryDate).toLocaleDateString()
                              : "N/A"}
                          </span>
                          <span className="px-2 py-1 rounded-lg bg-slate-100 text-xs font-medium">
                            Unit: {s.unit}
                          </span>
                          {(s.reservedForSales ?? 0) > 0 && (
                            <span className="px-2 py-1 rounded-lg bg-amber-100 text-xs font-medium">
                              Reserved: {s.reservedForSales}
                            </span>
                          )}
                        </div>

                        {isSelected && (
                          <div className="border-t pt-4 mt-4">
                            <div className="flex items-center justify-between mb-4">
                              <h5 className="font-semibold text-sm flex items-center gap-1">
                                <BarChart3 className="w-4 h-4 text-indigo-500" />{" "}
                                Transaction Timeline
                              </h5>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedStockForTx(null);
                                  setStockTransactions([]);
                                }}
                              >
                                Close
                              </Button>
                            </div>
                            {txLoading ? (
                              <div className="text-center py-4 text-sm text-muted-foreground">
                                Loading transactions...
                              </div>
                            ) : stockTransactions.length === 0 ? (
                              <div className="text-center py-6 text-sm text-muted-foreground bg-slate-50 rounded-lg">
                                <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                No transactions recorded yet.
                              </div>
                            ) : (
                              <div className="relative pl-8 border-l-2 border-slate-200 space-y-5">
                                {stockTransactions.map((tx, i) => {
                                  const config = txConfig[
                                    tx.transactionType
                                  ] || {
                                    icon: FileText,
                                    bg: "bg-gray-100 text-gray-700",
                                    label: tx.transactionType,
                                  };
                                  const Icon = config.icon;
                                  return (
                                    <div key={tx._id} className="relative">
                                      <div
                                        className={`absolute -left-[26px] top-1 w-6 h-6 rounded-full border-2 border-white ${config.bg} flex items-center justify-center shadow-sm`}
                                      >
                                        <Icon className="w-3.5 h-3.5" />
                                      </div>
                                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-white transition-colors">
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="font-medium text-sm text-slate-800">
                                            {config.label}
                                          </span>
                                          <span className="text-xs text-muted-foreground">
                                            {new Date(
                                              tx.transactionDate,
                                            ).toLocaleString()}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm">
                                          <span
                                            className={`font-mono font-semibold ${tx.quantity > 0 ? "text-emerald-600" : "text-rose-600"}`}
                                          >
                                            {tx.quantity > 0 ? "+" : ""}
                                            {tx.quantity}{" "}
                                            {selectedProduct?.unit}
                                          </span>
                                          <span className="text-xs text-muted-foreground">
                                            ৳ {tx.unitCost?.toFixed(2)}/unit
                                          </span>
                                          <span className="font-semibold text-slate-800">
                                            ৳ {tx.totalCost?.toFixed(2)}
                                          </span>
                                        </div>
                                        {tx.sourceModel && (
                                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                            <FileText className="w-3 h-3" />
                                            {tx.sourceModel}{" "}
                                            {tx.sourceId
                                              ? `(${tx.sourceId.slice(-6)})`
                                              : ""}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
                {productStocks.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground bg-white rounded-2xl border">
                    <Warehouse className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-lg font-medium">
                      No stock records for this product.
                    </p>
                    <p className="text-sm">Click "Add Stock" to create one.</p>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="ghost" onClick={() => setStockModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ---------- Adjust Stock Modal ---------- */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <form onSubmit={submitAdjust} className="space-y-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <BarChart3 className="w-5 h-5" /> Adjust Stock
            </h3>
            <div>
              <label className="text-sm font-medium">Product</label>
              <div className="py-2 font-medium">
                {nameOf(
                  items.find((p) => p._id === adjustRecord.productId) ||
                    selectedProduct ||
                    adjustRecord.productId,
                )}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Factory</label>
              <select
                required
                value={String(adjustRecord.warehouseId ?? "")}
                onChange={(e) =>
                  setAdjustRecord({
                    ...adjustRecord,
                    warehouseId: e.target.value,
                  })
                }
                className="w-full rounded-lg border px-3 py-2 text-sm"
              >
                <option value="">Select factory</option>
                {warehouses.map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.name} {w.code ? `(${w.code})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">
                Current Quantity (if editing)
              </label>
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
              <label className="text-sm font-medium">
                Amount (+ add, - subtract)
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
              <label className="text-sm font-medium">Unit</label>
              <select
                value={adjustRecord.unit ?? selectedProduct?.unit ?? "pcs"}
                onChange={(e) =>
                  setAdjustRecord({ ...adjustRecord, unit: e.target.value })
                }
                className="w-full rounded-lg border px-3 py-2 text-sm"
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Batch</label>
              <Input
                value={adjustRecord.batch ?? ""}
                onChange={(e) =>
                  setAdjustRecord({ ...adjustRecord, batch: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium">Expiry Date</label>
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
