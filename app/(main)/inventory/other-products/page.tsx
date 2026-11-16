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
type OtherProduct = {
  _id?: string;
  name: string;
  sku: string;
  unit?: string;
  purchasePrice?: number;
  minStockLevel?: number;
  isReusable?: boolean;
  isActive?: boolean;
  notes?: string;
};

type OtherProductStock = {
  _id?: string;
  otherProductId: string | { _id: string; name?: string };
  factoryId: string | { _id: string; name?: string };
  factory?: { _id: string; name?: string };
  quantity: number;
  unit?: string;
  batch?: string;
  expiryDate?: string;
  lastUpdated?: string;
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

const PAGE_SIZES = [10, 15, 25, 50];

/* =========================== Helpers =========================== */
function idOf(x: any): string {
  if (!x) return "";
  return typeof x === "string" ? x : (x._id ?? "");
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
export default function OtherProductsPage() {
  return (
    <Protected
      permissions={[
        "otherproducts.view",
        "otherproducts.create",
        "otherproducts.edit",
        "otherproducts.delete",
      ]}
    >
      <OtherProductsPageInner />
    </Protected>
  );
}

/* =========================== Inner =========================== */
function OtherProductsPageInner() {
  const hasAccess = usePermissionCheck();
  const canCreate = hasAccess({ permissions: "otherproducts.create" });
  const canEdit = hasAccess({ permissions: "otherproducts.edit" });
  const canDelete = hasAccess({ permissions: "otherproducts.delete" });

  /* ---- List state ---- */
  const [items, setItems] = useState<OtherProduct[]>([]);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(15);
  const [total, setTotal] = useState<number>(0);
  const [q, setQ] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  /* ---- Form modal ---- */
  const [openForm, setOpenForm] = useState<boolean>(false);
  const [editing, setEditing] = useState<OtherProduct | null>(null);
  const [form, setForm] = useState<OtherProduct>({
    name: "",
    sku: "",
    unit: "pcs",
    purchasePrice: 0,
    minStockLevel: 0,
    isReusable: false,
    isActive: true,
    notes: "",
  });

  /* ---- Stock state ---- */
  const [stocks, setStocks] = useState<OtherProductStock[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<OtherProduct | null>(null);

  /* ---- Quick adjustment modal ---- */
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustRecord, setAdjustRecord] = useState<
    Partial<OtherProductStock> & { amount?: number }
  >({});

  /* ---- Stock transactions state ---- */
  const [txLoading, setTxLoading] = useState(false);
  const [stockTransactions, setStockTransactions] = useState<
    StockTransaction[]
  >([]);
  const [selectedStockForTx, setSelectedStockForTx] =
    useState<OtherProductStock | null>(null);

  /* ---- Factories ---- */
  const [factories, setFactories] = useState<{ _id: string; name: string }[]>(
    [],
  );

  const totalPages = Math.max(1, Math.ceil(total / limit));

  /* ---------- Fetch factories ---------- */
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/warehouses-or-factories?type=Factory", {
          params: { limit: 100 },
        });
        setFactories(res.data.data || []);
      } catch {
        toast.error("Failed to load factories");
      }
    })();
  }, []);

  /* ---------- Fetch list ---------- */
  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/other-products", {
        params: { page, limit, q },
      });
      setItems(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch {
      toast.error("Failed to load other products");
    } finally {
      setLoading(false);
    }
  }, [page, limit, q]);

  const fetchStocksForAll = useCallback(async () => {
    setStockLoading(true);
    try {
      const res = await api.get("/other-product-stocks", {
        params: { page: 1, limit: 10000 },
      });
      setStocks(res.data.data || []);
    } catch {
      toast.error("Failed to load stocks");
    } finally {
      setStockLoading(false);
    }
  }, []);

  const fetchStockTransactions = useCallback(
    async (stock: OtherProductStock) => {
      if (!selectedItem) return;
      setTxLoading(true);
      try {
        const itemId = selectedItem._id;
        const factoryId = idOf(stock.factoryId);
        const res = await api.get("/stock-transactions", {
          params: {
            itemType: "OtherProducts",
            itemId,
            locationId: factoryId,
            sort: "-transactionDate",
            limit: 100,
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
    [selectedItem],
  );

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  useEffect(() => {
    if (items.length > 0) void fetchStocksForAll();
    else setStocks([]);
  }, [items, fetchStocksForAll]);

  /* ---------- Aggregation ---------- */
  const stockByItem = useMemo(() => {
    const map = new Map<
      string,
      { total: number; rows: OtherProductStock[] }
    >();
    for (const s of stocks) {
      const pid = idOf(s.otherProductId);
      const entry = map.get(pid) || { total: 0, rows: [] };
      entry.total += Number(s.quantity || 0);
      entry.rows.push(s);
      map.set(pid, entry);
    }
    return map;
  }, [stocks]);

  const stockByItemAndFactory = useMemo(() => {
    const map = new Map<string, OtherProductStock>();
    for (const s of stocks) {
      const pid = idOf(s.otherProductId);
      const fid = idOf(s.factoryId);
      map.set(`${pid}_${fid}`, s);
    }
    return map;
  }, [stocks]);

  /* ---------- Summary stats ---------- */
  const summaryStats = useMemo(() => {
    const totalItems = items.length;
    const lowStockCount = items.filter((m) => {
      const stock = stockByItem.get(m._id || "")?.total || 0;
      return stock <= (m.minStockLevel || 0);
    }).length;
    const totalValue = items.reduce((acc, m) => {
      const stock = stockByItem.get(m._id || "")?.total || 0;
      return acc + stock * (m.purchasePrice || 0);
    }, 0);
    return { totalItems, lowStockCount, totalValue };
  }, [items, stockByItem]);

  /* ---------- Actions ---------- */
  function openCreate() {
    setEditing(null);
    setForm({
      name: "",
      sku: "",
      unit: "pcs",
      purchasePrice: 0,
      minStockLevel: 0,
      isReusable: false,
      isActive: true,
      notes: "",
    });
    setOpenForm(true);
  }

  function openEdit(item: OtherProduct) {
    setEditing(item);
    setForm({ ...item });
    setOpenForm(true);
  }

  async function submitForm(e?: React.FormEvent) {
    e?.preventDefault();
    if (!form.name?.trim()) return toast.error("Name is required");
    if (!form.sku?.trim()) return toast.error("SKU is required");
    try {
      const payload = {
        ...form,
        name: String(form.name).trim(),
        sku: String(form.sku).trim(),
      };
      if (editing?._id) {
        await api.put(`/other-products/${editing._id}`, payload);
        toast.success("Updated other product");
      } else {
        await api.post("/other-products", payload);
        toast.success("Created other product");
      }
      setOpenForm(false);
      void fetchList();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Save failed");
    }
  }

  async function deleteItem(id?: string) {
    if (!id || !confirm("Delete other product?")) return;
    try {
      await api.delete(`/other-products/${id}`);
      toast.success("Deleted");
      void fetchList();
    } catch {
      toast.error("Delete failed");
    }
  }

  async function exportCSV() {
    try {
      const res = await api.get("/other-products/export", {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "other_products.csv";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Export failed");
    }
  }

  async function toggleActive(item: OtherProduct) {
    if (!item._id) return;
    try {
      const newVal = !item.isActive;
      await api.put(`/other-products/${item._id}`, { isActive: newVal });
      toast.success("Status updated");
      setItems((prev) =>
        prev.map((p) => (p._id === item._id ? { ...p, isActive: newVal } : p)),
      );
    } catch {
      toast.error("Failed to update status");
      void fetchList();
    }
  }

  function openStockModal(item: OtherProduct) {
    setSelectedItem(item);
    setSelectedStockForTx(null);
    setStockTransactions([]);
    setStockModalOpen(true);
  }

  function openAdjustModal(stock?: OtherProductStock, item?: OtherProduct) {
    const itemId = stock ? idOf(stock.otherProductId) : item?._id;
    const factoryId = stock ? idOf(stock.factoryId) : undefined;
    setAdjustRecord({
      _id: stock?._id,
      otherProductId: itemId,
      factoryId,
      quantity: stock?.quantity ?? 0,
      unit: stock?.unit ?? item?.unit ?? "pcs",
      batch: stock?.batch ?? "",
      expiryDate: stock?.expiryDate ?? "",
      amount: 0,
    });
    setAdjustOpen(true);
  }

  function handleAdjustFactoryChange(factoryId: string) {
    const key = `${adjustRecord.otherProductId}_${factoryId}`;
    const existing = stockByItemAndFactory.get(key);
    setAdjustRecord({
      ...adjustRecord,
      factoryId,
      quantity: existing?.quantity ?? 0,
      unit: existing?.unit ?? adjustRecord.unit ?? "pcs",
      batch: existing?.batch ?? "",
      expiryDate: existing?.expiryDate ?? "",
      _id: existing?._id,
    });
  }

  async function submitAdjust(e?: React.FormEvent) {
    e?.preventDefault();
    const rec = adjustRecord;
    if (!rec.otherProductId || !rec.factoryId)
      return toast.error("Select factory and item");
    try {
      if (rec._id) {
        let newQty = Number(rec.quantity || 0);
        if (rec.amount) newQty += Number(rec.amount);
        await api.put(`/other-product-stocks/${rec._id}`, {
          quantity: newQty,
          batch: rec.batch,
          expiryDate: rec.expiryDate,
          unit: rec.unit,
        });
        toast.success("Stock updated");
      } else {
        await api.post("/other-product-stocks", {
          otherProductId: rec.otherProductId,
          factoryId: rec.factoryId,
          quantity: Number(rec.amount || 0),
          unit: rec.unit,
          batch: rec.batch,
          expiryDate: rec.expiryDate,
        });
        toast.success("Stock added");
      }
      setAdjustOpen(false);
      await fetchStocksForAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Stock update failed");
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
                  Other Products
                </span>
              </div>

              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white md:text-3xl">
                Other Products
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                Manage other products, stock levels, and transactions across
                factories.
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
              label="Total Items"
              value={summaryStats.totalItems}
              hint={`${total} total in catalog`}
              tone="slate"
            />
            <StatCard
              icon={AlertTriangle}
              label="Low Stock Alerts"
              value={summaryStats.lowStockCount}
              hint="Below minimum level"
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
                    { key: "purchase", label: "Purchase" },
                    { key: "stock", label: "Stock" },
                    { key: "min", label: "Min Stock" },
                    { key: "reusable", label: "Reusable" },
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
                {items.map((it, idx) => {
                  const agg = stockByItem.get(it._id || "") ?? {
                    total: 0,
                    rows: [],
                  };
                  const low = agg.total <= (it.minStockLevel || 0);

                  return (
                    <TableRow
                      key={it._id || idx}
                      className="group border-b border-slate-100 transition-colors hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/30"
                    >
                      <TableCell className="px-4 py-3 align-middle text-xs font-medium text-slate-400">
                        {(page - 1) * limit + idx + 1}
                      </TableCell>
                      <TableCell className="px-4 py-3 align-middle">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            {it.name}
                          </div>
                          {it.notes && (
                            <div className="mt-0.5 max-w-[220px] truncate text-[10px] text-slate-500 dark:text-slate-400">
                              {it.notes}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 align-middle">
                        <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
                          {it.sku}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3 align-middle">
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {it.unit ?? "pcs"}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3 align-middle text-xs font-medium text-slate-700 dark:text-slate-300">
                        ৳ {it.purchasePrice ?? 0}
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
                            {agg.total}
                          </span>
                          <button
                            type="button"
                            onClick={() => openStockModal(it)}
                            className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
                            title="View stock breakdown"
                          >
                            <Eye className="h-3 w-3" />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 align-middle text-xs text-slate-600 dark:text-slate-400">
                        {it.minStockLevel ?? 0}
                      </TableCell>
                      <TableCell className="px-4 py-3 align-middle">
                        {it.isReusable ? (
                          <span className="inline-flex items-center rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                            Yes
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            No
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3 align-middle">
                        <button
                          onClick={() => canEdit && toggleActive(it)}
                          disabled={!canEdit}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            it.isActive
                              ? "bg-emerald-500"
                              : "bg-slate-300 dark:bg-slate-700"
                          } ${!canEdit ? "cursor-not-allowed opacity-60" : ""}`}
                          title={canEdit ? "Toggle status" : "Read-only"}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                              it.isActive
                                ? "translate-x-4.5"
                                : "translate-x-0.5"
                            }`}
                          />
                        </button>
                      </TableCell>
                      <TableCell className="px-4 py-3 align-middle">
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => openEdit(it)}
                              title="Edit"
                              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-[#3aa838]/10 hover:text-[#2f8a2f]"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => openAdjustModal(undefined, it)}
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
                              onClick={() => deleteItem(it._id)}
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
                    <TableCell colSpan={10} className="py-14 text-center">
                      {loading ? (
                        <div className="flex flex-col items-center gap-2 text-slate-500 dark:text-slate-400">
                          <RefreshCcw className="h-5 w-5 animate-spin" />
                          <span className="text-xs">
                            Loading other products…
                          </span>
                        </div>
                      ) : (
                        <div className="mx-auto max-w-sm">
                          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                            <Inbox className="h-6 w-6 text-slate-400" />
                          </div>
                          <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
                            {q
                              ? "No products match your search"
                              : "No other products yet"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {q
                              ? "Try a different search term."
                              : "Create your first other product to get started."}
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
          className="!w-[96vw] !max-w-[560px] p-0 gap-0 rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">
            {editing?._id ? "Edit Other Product" : "New Other Product"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Add or update other product details.
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
                  {editing?._id ? "Edit Other Product" : "New Other Product"}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {editing?._id
                    ? `Updating ${editing.name}`
                    : "Fill in the item details below"}
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={submitForm} className="space-y-3 p-5">
            <div className="grid gap-2.5">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Name <span className="text-rose-500">*</span>
                </label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="h-9 text-sm"
                  placeholder="e.g. Sample Product"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  SKU <span className="text-rose-500">*</span>
                </label>
                <Input
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  className="h-9 text-sm font-mono"
                  placeholder="OP-001"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Unit
                </label>
                <select
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-[#3aa838]/40 focus:ring-2 focus:ring-[#3aa838]/10 dark:border-slate-800 dark:bg-slate-900"
                >
                  <option value="pcs">pcs</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Purchase Price
                  </label>
                  <Input
                    type="number"
                    value={form.purchasePrice ?? 0}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        purchasePrice: Number(e.target.value),
                      })
                    }
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Min Stock Level
                  </label>
                  <Input
                    type="number"
                    value={form.minStockLevel ?? 0}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        minStockLevel: Number(e.target.value),
                      })
                    }
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Reusable
                </label>
                <select
                  value={String(form.isReusable ?? false)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      isReusable: e.target.value === "true",
                    })
                  }
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-[#3aa838]/40 focus:ring-2 focus:ring-[#3aa838]/10 dark:border-slate-800 dark:bg-slate-900"
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Notes
                </label>
                <Input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
                    setForm({ ...form, isActive: !form.isActive })
                  }
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    form.isActive
                      ? "bg-emerald-500"
                      : "bg-slate-300 dark:bg-slate-700"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                      form.isActive ? "translate-x-4.5" : "translate-x-0.5"
                    }`}
                  />
                </button>
                <span className="text-[11px] text-slate-600 dark:text-slate-400">
                  {form.isActive ? "Active" : "Inactive"}
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
                {editing?._id ? "Save Changes" : "Create Item"}
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
            Stock breakdown — {selectedItem?.name || "Item"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Per-factory stock levels and transaction history.
          </DialogDescription>

          {selectedItem && (
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
                        {selectedItem.name}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        SKU:{" "}
                        <span className="font-mono">{selectedItem.sku}</span> ·
                        Stock breakdown & history
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {canEdit && (
                      <Button
                        size="sm"
                        onClick={() =>
                          openAdjustModal(undefined, selectedItem)
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
                          {stockByItem.get(selectedItem._id || "")?.rows
                            .length || 0}
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
                          {stockByItem.get(selectedItem._id || "")?.total ||
                            0}{" "}
                          <span className="text-xs font-normal text-slate-500">
                            {selectedItem.unit ?? "pcs"}
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
                            (stockByItem.get(selectedItem._id || "")
                              ?.total || 0) *
                            (selectedItem.purchasePrice || 0)
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
                    {(
                      stockByItem.get(selectedItem._id || "")?.rows || []
                    ).map((s) => {
                      const factoryName =
                        (s.factory as any)?.name ||
                        (s.factoryId as any)?.name ||
                        (s.factoryId as any)?._id ||
                        "Unknown Factory";
                      const isSelected = selectedStockForTx?._id === s._id;
                      const minLevel = selectedItem.minStockLevel || 0;
                      const reorderLevel = minLevel > 0 ? minLevel * 2 : 100;
                      const stockPercent = Math.min(
                        100,
                        Math.round(
                          (s.quantity /
                            (reorderLevel > 0 ? reorderLevel : 100)) *
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
                                    {factoryName}
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
                                      openAdjustModal(s, selectedItem)
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
                                  Current: {s.quantity} {s.unit ?? "pcs"}
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
                                Unit: {s.unit ?? "pcs"}
                              </span>
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
                                                {selectedItem.unit ?? "pcs"}
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

                    {(
                      stockByItem.get(selectedItem._id || "")?.rows || []
                    ).length === 0 && (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center dark:border-slate-700 dark:bg-slate-900">
                        <Warehouse className="mx-auto mb-2 h-10 w-10 text-slate-300" />
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          No stock records for this item
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
                              openAdjustModal(undefined, selectedItem)
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
                Factory <span className="text-rose-500">*</span>
              </label>
              <select
                value={
                  typeof adjustRecord.factoryId === "string"
                    ? adjustRecord.factoryId
                    : adjustRecord.factoryId?._id || ""
                }
                onChange={(e) => handleAdjustFactoryChange(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-[#3aa838]/40 focus:ring-2 focus:ring-[#3aa838]/10 dark:border-slate-800 dark:bg-slate-900"
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
                value={adjustRecord.unit ?? "pcs"}
                onChange={(e) =>
                  setAdjustRecord({ ...adjustRecord, unit: e.target.value })
                }
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-[#3aa838]/40 focus:ring-2 focus:ring-[#3aa838]/10 dark:border-slate-800 dark:bg-slate-900"
              >
                <option value="pcs">pcs</option>
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