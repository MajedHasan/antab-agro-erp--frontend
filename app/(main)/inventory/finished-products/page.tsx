// src/app/products/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Trash2,
  Edit,
  Plus,
  Search,
  Eye,
  Package,
  AlertTriangle,
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
  Sliders,
  Download,
  Inbox,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Factory,
  BarChart3,
  DollarSign,
  X,
} from "lucide-react";
import { toast } from "sonner";

import Protected from "@/components/auth/Protected";
import usePermissionCheck from "@/hooks/usePermissionCheck";

/* =========================== Types =========================== */
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

/* =========================== Config =========================== */
const txConfig: Record<
  string,
  { icon: React.ElementType; bg: string; label: string }
> = {
  purchase: {
    icon: ArrowDownCircle,
    bg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    label: "Purchase",
  },
  consumption: {
    icon: ArrowUpCircle,
    bg: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
    label: "Consumption",
  },
  transfer_in: {
    icon: ArrowDownCircle,
    bg: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    label: "Transfer In",
  },
  transfer_out: {
    icon: ArrowUpCircle,
    bg: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
    label: "Transfer Out",
  },
  sale: {
    icon: ShoppingCart,
    bg: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
    label: "Sale",
  },
  return: {
    icon: RefreshCcw,
    bg: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300",
    label: "Return",
  },
  wastage: {
    icon: Trash2,
    bg: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    label: "Wastage",
  },
  adjustment: {
    icon: Sliders,
    bg: "bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-300",
    label: "Adjustment",
  },
  reservation: {
    icon: ClipboardList,
    bg: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    label: "Reservation",
  },
};

const PAGE_SIZES = [10, 15, 25, 50, 100];
const UNIT_OPTIONS = ["pcs", "kg", "g", "ltr", "ml"];

/* =========================== Helpers =========================== */
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

function getPaginationRange(
  current: number,
  total: number,
): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, 4, "...", total];
  if (current >= total - 2)
    return [1, "...", total - 3, total - 2, total - 1, total];
  return [1, "...", current - 1, current, current + 1, "...", total];
}

/* =========================== Small UI =========================== */
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
  tone?: "slate" | "amber" | "green";
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

/* =========================== Page (Protected) =========================== */
export default function ProductsPage() {
  return (
    <Protected
      permissions={[
        "products.view",
        "products.create",
        "products.edit",
        "products.delete",
      ]}
    >
      <ProductsPageInner />
    </Protected>
  );
}

/* =========================== Inner =========================== */
function ProductsPageInner() {
  const hasAccess = usePermissionCheck();
  const canCreate = hasAccess({ permissions: "products.create" });
  const canEdit = hasAccess({ permissions: "products.edit" });
  const canDelete = hasAccess({ permissions: "products.delete" });

  /* ---- List state ---- */
  const [items, setItems] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  /* ---- Form modal ---- */
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

  /* ---- Stock modal state ---- */
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productStocks, setProductStocks] = useState<ProductStock[]>([]);
  const [stockLoading, setStockLoading] = useState(false);

  /* ---- Quick adjustment modal ---- */
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustRecord, setAdjustRecord] = useState<
    Partial<ProductStock> & { amount?: number }
  >({});

  /* ---- Stock transactions state ---- */
  const [txLoading, setTxLoading] = useState(false);
  const [stockTransactions, setStockTransactions] = useState<
    StockTransaction[]
  >([]);
  const [selectedStockForTx, setSelectedStockForTx] =
    useState<ProductStock | null>(null);

  /* ---- Warehouses for selector ---- */
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
      } catch {
        toast.error("Failed to load warehouses");
      } finally {
        setRefsLoading(false);
      }
    })();
  }, []);

  /* ---------- Fetch products ---------- */
  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
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
    } catch {
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [page, limit, q]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  /* ---------- Fetch stocks for selected product ---------- */
  const fetchProductStocks = useCallback(async (productId: string) => {
    setStockLoading(true);
    try {
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
    } catch {
      toast.error("Failed to load product stocks");
      setProductStocks([]);
    } finally {
      setStockLoading(false);
    }
  }, []);

  /* ---------- Fetch stock transactions ---------- */
  const fetchStockTransactions = useCallback(
    async (stock: ProductStock) => {
      if (!selectedProduct) return;
      setTxLoading(true);
      try {
        const productId = selectedProduct._id;
        const warehouseId = idOf(stock.warehouseId);
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
      } catch {
        toast.error("Failed to load stock transactions");
        setStockTransactions([]);
      } finally {
        setTxLoading(false);
      }
    },
    [selectedProduct],
  );

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
      void fetchList();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Save failed");
    }
  }

  async function removeItem(id?: string) {
    if (!id || !confirm("Delete product?")) return;
    try {
      await api.delete(`/products/${id}`);
      toast.success("Deleted");
      void fetchList();
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
      void fetchList();
    }
  }

  function openStockModal(item: Product) {
    setSelectedProduct(item);
    setSelectedStockForTx(null);
    setStockTransactions([]);
    setStockModalOpen(true);
    if (item._id) void fetchProductStocks(item._id);
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
    const rec = adjustRecord;
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
      void fetchList();
      setAdjustOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Stock save failed");
    }
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
                  <Package className="h-2.5 w-2.5" />
                  Inventory
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-[#3aa838]/30 bg-[#3aa838]/5 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#2f8a2f] dark:border-[#3aa838]/30 dark:bg-[#3aa838]/10 dark:text-[#9bdd91]">
                  Finished Products
                </span>
              </div>

              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white md:text-3xl">
                Products
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                Manage finished products, factory stocks, and transactions.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search name, SKU…"
                  className="h-9 w-full pl-9 md:w-64"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={exportCSV}
                className="h-9 gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </Button>
              {canCreate && (
                <Button
                  size="sm"
                  onClick={openCreate}
                  className="h-9 gap-1.5 bg-[#3aa838] text-white shadow-sm shadow-[#3aa838]/20 hover:bg-[#2f8a2f]"
                >
                  <Plus className="h-4 w-4" />
                  New Product
                </Button>
              )}
            </div>
          </div>

          {/* Summary cards */}
          <div className="relative mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              icon={Box}
              label="Total Products"
              value={summaryStats.totalItems}
              hint={`${total} total in catalog`}
              tone="slate"
            />
            <StatCard
              icon={AlertTriangle}
              label="Low Stock Alerts"
              value={summaryStats.lowStockCount}
              hint="Below reorder level"
              tone="amber"
            />
            <StatCard
              icon={DollarSign}
              label="Inventory Value"
              value={`৳ ${summaryStats.totalValue.toLocaleString()}`}
              hint="Total stock value"
              tone="green"
            />
          </div>
        </div>

        {/* ============ TABLE ============ */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 bg-slate-50/80 hover:bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/50">
                  {[
                    { key: "idx", label: "#", className: "w-10" },
                    { key: "name", label: "Name" },
                    { key: "sku", label: "SKU" },
                    { key: "unit", label: "Unit" },
                    { key: "sale", label: "Sale Price" },
                    { key: "stock", label: "Stock (snapshot)" },
                    { key: "reorder", label: "Reorder" },
                    { key: "status", label: "Status" },
                    {
                      key: "actions",
                      label: "Actions",
                      className: "w-48 text-right",
                    },
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
                {items.map((p, idx) => {
                  const stock = safeNumber(p.stock);
                  const reorder = p.reorderLevel || 0;
                  const low = stock <= reorder;
                  const isActive = p.status === "Active";

                  return (
                    <TableRow
                      key={p._id || idx}
                      className="group border-b border-slate-100 transition-colors hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/30"
                    >
                      <TableCell className="px-4 py-3 align-middle text-xs font-medium text-slate-400">
                        {(page - 1) * limit + idx + 1}
                      </TableCell>
                      <TableCell className="px-4 py-3 align-middle">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            {p.name}
                          </div>
                          {p.description && (
                            <div className="mt-0.5 max-w-[220px] truncate text-[10px] text-slate-500 dark:text-slate-400">
                              {p.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 align-middle">
                        <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
                          {p.sku}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3 align-middle">
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {p.unit || "pcs"}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3 align-middle text-xs font-medium text-slate-700 dark:text-slate-300">
                        ৳ {p.salePrice ?? 0}
                      </TableCell>
                      <TableCell className="px-4 py-3 align-middle">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              low
                                ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                                : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            }`}
                          >
                            {low ? (
                              <AlertTriangle className="h-2.5 w-2.5" />
                            ) : (
                              <Package className="h-2.5 w-2.5" />
                            )}
                            {stock}
                          </span>
                          <button
                            type="button"
                            onClick={() => openStockModal(p)}
                            className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
                            title="View stock breakdown"
                          >
                            <Eye className="h-3 w-3" />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 align-middle text-xs text-slate-600 dark:text-slate-400">
                        {reorder}
                      </TableCell>
                      <TableCell className="px-4 py-3 align-middle">
                        <button
                          onClick={() => canEdit && toggleStatus(p)}
                          disabled={!canEdit}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            isActive
                              ? "bg-emerald-500"
                              : "bg-slate-300 dark:bg-slate-700"
                          } ${!canEdit ? "cursor-not-allowed opacity-60" : ""}`}
                          title={canEdit ? "Toggle status" : "Read-only"}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                              isActive ? "translate-x-4.5" : "translate-x-0.5"
                            }`}
                          />
                        </button>
                      </TableCell>
                      <TableCell className="px-4 py-3 align-middle">
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => openEdit(p)}
                              title="Edit"
                              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-[#3aa838]/10 hover:text-[#2f8a2f]"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => openAdjust(undefined, p)}
                              title="Add Stock"
                              className="flex h-7 items-center gap-1 rounded-md bg-[#3aa838]/10 px-2 text-[10px] font-semibold text-[#2f8a2f] transition-colors hover:bg-[#3aa838]/20 dark:bg-[#3aa838]/15 dark:text-[#9bdd91]"
                            >
                              <Plus className="h-2.5 w-2.5" />
                              Stock
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => removeItem(p._id)}
                              title="Delete"
                              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="py-14 text-center">
                      {loading ? (
                        <div className="flex flex-col items-center gap-2 text-slate-500 dark:text-slate-400">
                          <RefreshCcw className="h-5 w-5 animate-spin" />
                          <span className="text-xs">Loading products…</span>
                        </div>
                      ) : (
                        <div className="mx-auto max-w-sm">
                          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                            <Inbox className="h-6 w-6 text-slate-400" />
                          </div>
                          <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
                            {q
                              ? "No products match your search"
                              : "No products yet"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {q
                              ? "Try a different search term."
                              : "Create your first product to get started."}
                          </p>
                          {canCreate && !q && (
                            <Button
                              size="sm"
                              onClick={openCreate}
                              className="mt-4 h-8 gap-1.5 bg-[#3aa838] text-xs text-white hover:bg-[#2f8a2f]"
                            >
                              <Plus className="h-3 w-3" />
                              New Product
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {total === 0
                ? "No records"
                : `Showing ${(page - 1) * limit + 1} - ${Math.min(
                    page * limit,
                    total,
                  )} of ${total}`}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-[#3aa838]/40 focus:ring-2 focus:ring-[#3aa838]/10 dark:border-slate-800 dark:bg-slate-900"
              >
                {PAGE_SIZES.map((l) => (
                  <option key={l} value={l}>
                    {l}/page
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <div className="flex items-center gap-1">
                  {getPaginationRange(page, totalPages).map((p, idx) =>
                    p === "..." ? (
                      <span
                        key={`e-${idx}`}
                        className="px-1 text-xs text-slate-400"
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p as number)}
                        className={`h-7 min-w-7 rounded-md px-2 text-xs font-semibold transition-colors ${
                          p === page
                            ? "bg-[#3aa838] text-white"
                            : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                        }`}
                      >
                        {p}
                      </button>
                    ),
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={page === totalPages}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============ CREATE / EDIT MODAL ============ */}
      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent
          className="!w-[96vw] !max-w-[640px] p-0 gap-0 rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">
            {editing?._id ? "Edit Product" : "New Product"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Add or update product details.
          </DialogDescription>

          <div className="border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3aa838]/10 text-[#3aa838]">
                {editing?._id ? (
                  <Edit className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {editing?._id ? "Edit Product" : "New Product"}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {editing?._id
                    ? `Updating ${editing.name}`
                    : "Fill in the product details below"}
                </p>
              </div>
            </div>
          </div>

          <form
            onSubmit={submitForm}
            className="space-y-3 p-5 max-h-[70vh] overflow-y-auto"
          >
            <div className="grid gap-2.5">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Name <span className="text-rose-500">*</span>
                </label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="h-9 text-sm"
                  placeholder="e.g. Premium Rice 5kg"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    SKU <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    value={form.sku}
                    onChange={(e) =>
                      setForm({ ...form, sku: e.target.value })
                    }
                    className="h-9 text-sm font-mono"
                    placeholder="PR-001"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Code
                  </label>
                  <Input
                    value={form.code || ""}
                    onChange={(e) =>
                      setForm({ ...form, code: e.target.value })
                    }
                    className="h-9 text-sm"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Category
                  </label>
                  <Input
                    value={form.category || ""}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value })
                    }
                    className="h-9 text-sm"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Unit
                  </label>
                  <select
                    value={form.unit}
                    onChange={(e) =>
                      setForm({ ...form, unit: e.target.value })
                    }
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-[#3aa838]/40 focus:ring-2 focus:ring-[#3aa838]/10 dark:border-slate-800 dark:bg-slate-900"
                  >
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Cost Price
                  </label>
                  <Input
                    type="number"
                    value={form.costPrice ?? 0}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        costPrice: Number(e.target.value),
                      })
                    }
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Sale Price
                  </label>
                  <Input
                    type="number"
                    value={form.salePrice ?? 0}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        salePrice: Number(e.target.value),
                      })
                    }
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Tax %
                  </label>
                  <Input
                    type="number"
                    value={form.taxRate ?? 0}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        taxRate: Number(e.target.value),
                      })
                    }
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Reorder Level
                  </label>
                  <Input
                    type="number"
                    value={form.reorderLevel ?? 0}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        reorderLevel: Number(e.target.value),
                      })
                    }
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Barcode
                  </label>
                  <Input
                    value={form.barcode || ""}
                    onChange={(e) =>
                      setForm({ ...form, barcode: e.target.value })
                    }
                    className="h-9 text-sm"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Description
                </label>
                <Input
                  value={form.description || ""}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  className="h-9 text-sm"
                  placeholder="Optional"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Status
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      status:
                        form.status === "Active" ? "Inactive" : "Active",
                    })
                  }
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    form.status === "Active"
                      ? "bg-emerald-500"
                      : "bg-slate-300 dark:bg-slate-700"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                      form.status === "Active"
                        ? "translate-x-4.5"
                        : "translate-x-0.5"
                    }`}
                  />
                </button>
                <span className="text-[11px] text-slate-600 dark:text-slate-400">
                  {form.status === "Active" ? "Active" : "Inactive"}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpenForm(false)}
                className="h-9"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-9 gap-1.5 bg-[#3aa838] text-white shadow-sm shadow-[#3aa838]/20 hover:bg-[#2f8a2f]"
              >
                {editing?._id ? "Save Changes" : "Create Product"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============ STOCK DASHBOARD ============ */}
      <Dialog open={stockModalOpen} onOpenChange={setStockModalOpen}>
        <DialogContent
          className="!w-[96vw] !max-w-[900px] h-[92vh] p-0 gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950 flex flex-col"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">
            Stock breakdown — {selectedProduct?.name || "Product"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Per-factory stock levels and transaction history.
          </DialogDescription>

          {selectedProduct && (
            <div className="flex h-full min-h-0 flex-col">
              {/* Header */}
              <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-3.5 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#3aa838]/10 text-[#3aa838]">
                      <Layers className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {selectedProduct.name}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        SKU:{" "}
                        <span className="font-mono">{selectedProduct.sku}</span>{" "}
                        · Stock breakdown & history
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {canEdit && (
                      <Button
                        size="sm"
                        onClick={() =>
                          openAdjust(undefined, selectedProduct)
                        }
                        className="h-8 gap-1 bg-[#3aa838] text-xs text-white hover:bg-[#2f8a2f]"
                      >
                        <Plus className="h-3 w-3" />
                        Add Stock
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setStockModalOpen(false)}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Body — scrollable */}
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50/70 p-4 dark:bg-slate-950/40 md:p-5">
                {/* Quick stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        <Warehouse className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          Factories
                        </div>
                        <div className="text-lg font-bold text-slate-900 dark:text-white">
                          {productStocks.length}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <Package className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          Total Stock
                        </div>
                        <div className="text-lg font-bold text-slate-900 dark:text-white">
                          {productStocks.reduce(
                            (acc, s) => acc + safeNumber(s.quantity),
                            0,
                          )}{" "}
                          <span className="text-xs font-normal text-slate-500">
                            {selectedProduct.unit || "pcs"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#3aa838]/10 text-[#2f8a2f] dark:bg-[#3aa838]/15 dark:text-[#9bdd91]">
                        <DollarSign className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          Est. Value
                        </div>
                        <div className="text-lg font-bold text-slate-900 dark:text-white">
                          ৳{" "}
                          {(
                            productStocks.reduce(
                              (acc, s) => acc + safeNumber(s.quantity),
                              0,
                            ) * (selectedProduct.costPrice || 0)
                          ).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Per-factory cards */}
                {stockLoading ? (
                  <div className="flex flex-col items-center gap-2 py-10 text-slate-500 dark:text-slate-400">
                    <RefreshCcw className="h-5 w-5 animate-spin" />
                    <span className="text-xs">Loading stocks…</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {productStocks.map((s) => {
                      const warehouseName =
                        s.warehouse?.name ||
                        nameOf(s.warehouseId) ||
                        "Unknown Factory";
                      const isSelected = selectedStockForTx?._id === s._id;
                      const minLevel = selectedProduct.reorderLevel || 0;
                      const stockPercent = Math.min(
                        100,
                        Math.round(
                          (s.quantity / (minLevel > 0 ? minLevel : 100)) *
                            100,
                        ),
                      );
                      const isLow = s.quantity <= minLevel;

                      return (
                        <div
                          key={s._id}
                          className={`overflow-hidden rounded-xl border bg-white transition-all dark:bg-slate-900 ${
                            isSelected
                              ? "border-[#3aa838] shadow-sm"
                              : "border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700"
                          }`}
                        >
                          <div className="p-4">
                            {/* Factory row */}
                            <div className="mb-3 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                                    isLow
                                      ? "bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300"
                                      : "bg-[#3aa838]/10 text-[#3aa838] dark:bg-[#3aa838]/15 dark:text-[#9bdd91]"
                                  }`}
                                >
                                  <Factory className="h-4 w-4" />
                                </div>
                                <div>
                                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                    {warehouseName}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                                    <Clock className="h-2.5 w-2.5" />
                                    {s.lastUpdated
                                      ? new Date(
                                          s.lastUpdated,
                                        ).toLocaleDateString()
                                      : "-"}
                                    <span>·</span>
                                    <span>Batch: {s.batch || "N/A"}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                {canEdit && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      openAdjust(s, selectedProduct)
                                    }
                                    className="h-7 px-2 text-[10px]"
                                  >
                                    Adjust
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant={
                                    isSelected ? "default" : "outline"
                                  }
                                  onClick={() => fetchStockTransactions(s)}
                                  className={`h-7 gap-1 px-2 text-[10px] ${
                                    isSelected
                                      ? "bg-[#3aa838] text-white hover:bg-[#2f8a2f]"
                                      : ""
                                  }`}
                                >
                                  <Clock className="h-3 w-3" />
                                  {isSelected ? "Hide" : "History"}
                                </Button>
                              </div>
                            </div>

                            {/* Stock bar */}
                            <div className="mb-2">
                              <div className="mb-1 flex justify-between text-[10px]">
                                <span
                                  className={`font-semibold ${isLow ? "text-rose-600 dark:text-rose-300" : "text-slate-700 dark:text-slate-300"}`}
                                >
                                  Current: {s.quantity} {s.unit}
                                </span>
                                <span className="text-slate-500 dark:text-slate-400">
                                  Min: {minLevel}
                                </span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    isLow
                                      ? "bg-rose-500"
                                      : stockPercent < 50
                                        ? "bg-amber-500"
                                        : "bg-emerald-500"
                                  }`}
                                  style={{ width: `${stockPercent}%` }}
                                />
                              </div>
                              {isLow && (
                                <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-rose-600 dark:text-rose-300">
                                  <AlertTriangle className="h-2.5 w-2.5" />
                                  Low stock!
                                </div>
                              )}
                            </div>

                            {/* Chips */}
                            <div className="flex flex-wrap gap-1.5">
                              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                Expiry:{" "}
                                {s.expiryDate
                                  ? new Date(
                                      s.expiryDate,
                                    ).toLocaleDateString()
                                  : "N/A"}
                              </span>
                              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                Unit: {s.unit}
                              </span>
                              {(s.reservedForSales ?? 0) > 0 && (
                                <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                                  Reserved: {s.reservedForSales}
                                </span>
                              )}
                            </div>

                            {/* Timeline */}
                            {isSelected && (
                              <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-800">
                                <div className="mb-2 flex items-center justify-between">
                                  <h5 className="flex items-center gap-1 text-xs font-bold text-slate-900 dark:text-white">
                                    <BarChart3 className="h-3 w-3 text-[#3aa838]" />
                                    Transaction Timeline
                                  </h5>
                                  <button
                                    onClick={() => {
                                      setSelectedStockForTx(null);
                                      setStockTransactions([]);
                                    }}
                                    className="text-[10px] font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                                  >
                                    Close
                                  </button>
                                </div>
                                {txLoading ? (
                                  <div className="flex items-center gap-2 py-4 text-xs text-slate-500 dark:text-slate-400">
                                    <RefreshCcw className="h-3 w-3 animate-spin" />
                                    Loading transactions…
                                  </div>
                                ) : stockTransactions.length === 0 ? (
                                  <div className="rounded-lg bg-slate-50 py-6 text-center dark:bg-slate-950/40">
                                    <Package className="mx-auto mb-1.5 h-6 w-6 text-slate-300" />
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                      No transactions recorded yet.
                                    </p>
                                  </div>
                                ) : (
                                  <div className="relative space-y-3 border-l-2 border-slate-200 pl-6 dark:border-slate-800">
                                    {stockTransactions.map((tx) => {
                                      const config =
                                        txConfig[tx.transactionType] || {
                                          icon: FileText,
                                          bg: "bg-slate-100 text-slate-700",
                                          label: tx.transactionType,
                                        };
                                      const Icon = config.icon;
                                      return (
                                        <div
                                          key={tx._id}
                                          className="relative"
                                        >
                                          <div
                                            className={`absolute -left-[26px] top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white shadow-sm ${config.bg} dark:border-slate-900`}
                                          >
                                            <Icon className="h-2.5 w-2.5" />
                                          </div>
                                          <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 transition-colors hover:bg-white dark:border-slate-800 dark:bg-slate-950/40 dark:hover:bg-slate-900">
                                            <div className="mb-1 flex items-center justify-between gap-2">
                                              <span className="text-xs font-semibold text-slate-900 dark:text-white">
                                                {config.label}
                                              </span>
                                              <span className="text-[9px] text-slate-500 dark:text-slate-400">
                                                {new Date(
                                                  tx.transactionDate,
                                                ).toLocaleString()}
                                              </span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
                                              <span
                                                className={`font-mono font-semibold ${
                                                  tx.quantity > 0
                                                    ? "text-emerald-600 dark:text-emerald-400"
                                                    : "text-rose-600 dark:text-rose-400"
                                                }`}
                                              >
                                                {tx.quantity > 0 ? "+" : ""}
                                                {tx.quantity}{" "}
                                                {selectedProduct.unit}
                                              </span>
                                              <span className="text-slate-500 dark:text-slate-400">
                                                ৳{" "}
                                                {tx.unitCost?.toFixed(2)}
                                                /unit
                                              </span>
                                              <span className="font-semibold text-slate-900 dark:text-white">
                                                ৳ {tx.totalCost?.toFixed(2)}
                                              </span>
                                            </div>
                                            {tx.sourceModel && (
                                              <div className="mt-0.5 flex items-center gap-1 text-[9px] text-slate-500 dark:text-slate-400">
                                                <FileText className="h-2.5 w-2.5" />
                                                {tx.sourceModel}
                                                {tx.sourceId
                                                  ? ` (${tx.sourceId.slice(-6)})`
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
                          </div>
                        </div>
                      );
                    })}

                    {productStocks.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center dark:border-slate-700 dark:bg-slate-900">
                        <Warehouse className="mx-auto mb-2 h-10 w-10 text-slate-300" />
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          No stock records for this product
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                          {canEdit
                            ? 'Click "Add Stock" to create one.'
                            : "Contact an admin to add stock."}
                        </p>
                        {canEdit && (
                          <Button
                            size="sm"
                            onClick={() =>
                              openAdjust(undefined, selectedProduct)
                            }
                            className="mt-3 h-8 gap-1 bg-[#3aa838] text-xs text-white hover:bg-[#2f8a2f]"
                          >
                            <Plus className="h-3 w-3" />
                            Add Stock
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-2.5 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStockModalOpen(false)}
                    className="h-9"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ============ ADJUST STOCK MODAL ============ */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent
          className="!w-[96vw] !max-w-[520px] p-0 gap-0 rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">Adjust Stock</DialogTitle>
          <DialogDescription className="sr-only">
            Add or adjust stock quantity for a factory.
          </DialogDescription>

          <div className="border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3aa838]/10 text-[#3aa838]">
                <BarChart3 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Adjust Stock
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {adjustRecord._id
                    ? "Update existing stock record"
                    : "Add a new stock record"}
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={submitAdjust} className="space-y-3 p-5">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Product
              </label>
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-900 dark:bg-slate-950/40 dark:text-white">
                {nameOf(
                  items.find((p) => p._id === adjustRecord.productId) ||
                    selectedProduct ||
                    adjustRecord.productId,
                )}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Factory <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={String(adjustRecord.warehouseId ?? "")}
                onChange={(e) =>
                  setAdjustRecord({
                    ...adjustRecord,
                    warehouseId: e.target.value,
                  })
                }
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-[#3aa838]/40 focus:ring-2 focus:ring-[#3aa838]/10 dark:border-slate-800 dark:bg-slate-900"
              >
                <option value="">Select factory</option>
                {warehouses.map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.name} {w.code ? `(${w.code})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Current Quantity
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
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Amount (+ / −)
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
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Unit
              </label>
              <select
                value={adjustRecord.unit ?? selectedProduct?.unit ?? "pcs"}
                onChange={(e) =>
                  setAdjustRecord({ ...adjustRecord, unit: e.target.value })
                }
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-[#3aa838]/40 focus:ring-2 focus:ring-[#3aa838]/10 dark:border-slate-800 dark:bg-slate-900"
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Batch
              </label>
              <Input
                value={adjustRecord.batch ?? ""}
                onChange={(e) =>
                  setAdjustRecord({
                    ...adjustRecord,
                    batch: e.target.value,
                  })
                }
                className="h-9 text-sm"
                placeholder="Optional"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Expiry Date
              </label>
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
                className="h-9 text-sm"
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAdjustOpen(false)}
                className="h-9"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-9 gap-1.5 bg-[#3aa838] text-white shadow-sm shadow-[#3aa838]/20 hover:bg-[#2f8a2f]"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Save Stock
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}