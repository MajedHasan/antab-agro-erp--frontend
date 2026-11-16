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
import { Badge } from "@/components/ui/badge";
import {
  Trash2,
  Edit,
  Plus,
  Search,
  Eye,
  Package,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
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
  Sliders,
  X,
  Download,
  Inbox,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

import Protected from "@/components/auth/Protected";
import usePermissionCheck from "@/hooks/usePermissionCheck";

/* =========================== Types =========================== */
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
  rawMaterialId: any;
  factoryId: any;
  factory?: { _id: string; name?: string; code?: string; type?: string };
  quantity: number;
  unit: "kg" | "g" | "ltr" | "ml" | "pcs";
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

const categoryColors: Record<string, string> = {
  chemical:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/60",
  liquid:
    "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/60",
  powder:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60",
};

const categoryIcons: Record<string, React.ElementType> = {
  chemical: AlertTriangle,
  liquid: TrendingDown,
  powder: TrendingUp,
};

const PAGE_SIZES = [10, 15, 25, 50];

/* =========================== Small UI =========================== */
function CategoryBadge({ category }: { category?: string }) {
  if (!category)
    return (
      <Badge variant="outline" className="text-[10px]">
        -
      </Badge>
    );
  const color =
    categoryColors[category] ||
    "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
  const Icon = categoryIcons[category] || Box;
  return (
    <Badge
      variant="outline"
      className={`flex items-center gap-1 border ${color} text-[10px] font-semibold`}
    >
      <Icon className="h-2.5 w-2.5" />
      {category}
    </Badge>
  );
}

function UnitBadge({ unit }: { unit: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
      {unit}
    </span>
  );
}

function StockLevelBadge({
  current,
  min,
}: {
  current: number;
  min: number;
}) {
  const isLow = current <= min;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        isLow
          ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
          : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      }`}
    >
      {isLow ? (
        <AlertTriangle className="h-2.5 w-2.5" />
      ) : (
        <Package className="h-2.5 w-2.5" />
      )}
      {current}
    </span>
  );
}

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

/* =========================== Page (Protected) =========================== */
export default function RawMaterialsPage() {
  return (
    <Protected
      permissions={[
        "rawmaterials.view",
        "rawmaterials.create",
        "rawmaterials.edit",
        "rawmaterials.delete",
      ]}
    >
      <RawMaterialsPageInner />
    </Protected>
  );
}

/* =========================== Inner =========================== */
function RawMaterialsPageInner() {
  const hasAccess = usePermissionCheck();
  const canCreate = hasAccess({ permissions: "rawmaterials.create" });
  const canEdit = hasAccess({ permissions: "rawmaterials.edit" });
  const canDelete = hasAccess({ permissions: "rawmaterials.delete" });

  /* ---- State ---- */
  const [items, setItems] = useState<RawMaterial[]>([]);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(15);
  const [total, setTotal] = useState<number>(0);
  const [q, setQ] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

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

  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<RawMaterial | null>(
    null,
  );

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustRecord, setAdjustRecord] = useState<
    Partial<StockItem> & { amount?: number }
  >({});

  const [txLoading, setTxLoading] = useState(false);
  const [stockTransactions, setStockTransactions] = useState<
    StockTransaction[]
  >([]);
  const [selectedStockForTx, setSelectedStockForTx] =
    useState<StockItem | null>(null);

  const [factories, setFactories] = useState<{ _id: string; name: string }[]>(
    [],
  );

  const totalPages = Math.max(1, Math.ceil(total / limit));

  /* ---- Fetch factories ---- */
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

  /* ---- Fetch functions ---- */
  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/raw-materials", {
        params: { page, limit, q },
      });
      setItems(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch {
      toast.error("Failed to load raw materials");
    } finally {
      setLoading(false);
    }
  }, [page, limit, q]);

  const fetchStocksForAll = useCallback(async () => {
    setStockLoading(true);
    try {
      const res = await api.get("/raw-material-stocks", {
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
    async (stock: StockItem) => {
      if (!selectedMaterial) return;
      setTxLoading(true);
      try {
        const materialId = selectedMaterial._id;
        const factoryId =
          typeof stock.factoryId === "string"
            ? stock.factoryId
            : stock.factoryId?._id;
        const res = await api.get("/stock-transactions", {
          params: {
            itemType: "RawMaterial",
            itemId: materialId,
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
    [selectedMaterial],
  );

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  useEffect(() => {
    if (items.length > 0) void fetchStocksForAll();
    else setStocks([]);
  }, [items, fetchStocksForAll]);

  /* ---- Aggregation ---- */
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

  const stockByMaterialAndFactory = useMemo(() => {
    const map = new Map<string, StockItem>();
    for (const s of stocks) {
      const materialId =
        typeof s.rawMaterialId === "string"
          ? s.rawMaterialId
          : s.rawMaterialId._id;
      const factoryId =
        typeof s.factoryId === "string" ? s.factoryId : s.factoryId._id;
      map.set(`${materialId}_${factoryId}`, s);
    }
    return map;
  }, [stocks]);

  const summaryStats = useMemo(() => {
    const totalItems = items.length;
    const lowStockCount = items.filter((m) => {
      const stock = stockByMaterial.get(m._id || "")?.total || 0;
      return stock <= (m.minStockLevel || 0);
    }).length;
    const totalValue = items.reduce((acc, m) => {
      const stock = stockByMaterial.get(m._id || "")?.total || 0;
      return acc + stock * (m.purchasePrice || 0);
    }, 0);
    return { totalItems, lowStockCount, totalValue };
  }, [items, stockByMaterial]);

  /* ---- Actions ---- */
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
    setForm({ ...item, notes: item.notes || "" });
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
      void fetchList();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Save failed");
    }
  }

  async function removeItem(id?: string) {
    if (!id || !confirm("Delete raw material?")) return;
    try {
      await api.delete(`/raw-materials/${id}`);
      toast.success("Deleted");
      void fetchList();
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
    } catch {
      toast.error("Export failed");
    }
  }

  async function toggleActive(item: RawMaterial) {
    if (!item._id) return;
    try {
      const newVal = !item.isActive;
      await api.put(`/raw-materials/${item._id}`, { isActive: newVal });
      toast.success("Status updated");
      setItems((prev) =>
        prev.map((p) => (p._id === item._id ? { ...p, isActive: newVal } : p)),
      );
    } catch {
      toast.error("Failed to update status");
      void fetchList();
    }
  }

  function openStockModal(item: RawMaterial) {
    setSelectedMaterial(item);
    setSelectedStockForTx(null);
    setStockTransactions([]);
    setStockModalOpen(true);
  }

  function openAdjustModal(stock?: StockItem, material?: RawMaterial) {
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
    const rec = adjustRecord;
    if (!rec.rawMaterialId || !rec.factoryId)
      return toast.error("Select factory and raw material");
    try {
      if (rec._id) {
        let newQty = Number(rec.quantity || 0);
        if (rec.amount) newQty += Number(rec.amount);
        await api.put(`/raw-material-stocks/${rec._id}`, { quantity: newQty });
        toast.success("Stock updated");
      } else {
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
                  Raw Materials
                </span>
              </div>

              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white md:text-3xl">
                Raw Materials
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                Manage raw materials, stock levels, and transactions across
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
                  placeholder="Search name, SKU, category…"
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
                  New Material
                </Button>
              )}
            </div>
          </div>

          {/* Summary cards */}
          <div className="relative mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              icon={Box}
              label="Total Materials"
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
                    { key: "category", label: "Category" },
                    { key: "unit", label: "Unit" },
                    { key: "purchase", label: "Purchase" },
                    { key: "avg", label: "Avg" },
                    { key: "stock", label: "Stock" },
                    { key: "min", label: "Min / Reorder" },
                    { key: "status", label: "Status" },
                    { key: "actions", label: "Actions", className: "w-48 text-right" },
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
                {items.map((m, idx) => {
                  const agg = stockByMaterial.get(m._id || "") ?? {
                    total: 0,
                    rows: [],
                  };
                  return (
                    <TableRow
                      key={m._id || idx}
                      className="group border-b border-slate-100 transition-colors hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/30"
                    >
                      <TableCell className="px-4 py-3 align-middle text-xs font-medium text-slate-400">
                        {(page - 1) * limit + idx + 1}
                      </TableCell>
                      <TableCell className="px-4 py-3 align-middle">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            {m.name}
                          </div>
                          {m.notes && (
                            <div className="mt-0.5 max-w-[220px] truncate text-[10px] text-slate-500 dark:text-slate-400">
                              {m.notes}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 align-middle">
                        <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
                          {m.sku}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3 align-middle">
                        <CategoryBadge category={m.category} />
                      </TableCell>
                      <TableCell className="px-4 py-3 align-middle">
                        <UnitBadge unit={m.unit} />
                      </TableCell>
                      <TableCell className="px-4 py-3 align-middle text-xs font-medium text-slate-700 dark:text-slate-300">
                        ৳ {m.purchasePrice ?? 0}
                      </TableCell>
                      <TableCell className="px-4 py-3 align-middle text-xs text-slate-600 dark:text-slate-400">
                        ৳ {m.averagePrice ?? 0}
                      </TableCell>
                      <TableCell className="px-4 py-3 align-middle">
                        <div className="flex items-center gap-1.5">
                          <StockLevelBadge
                            current={agg.total}
                            min={m.minStockLevel || 0}
                          />
                          <button
                            type="button"
                            onClick={() => openStockModal(m)}
                            className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
                            title="View stock breakdown"
                          >
                            <Eye className="h-3 w-3" />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 align-middle">
                        <div className="space-y-0.5 text-[10px]">
                          <div className="text-slate-500 dark:text-slate-400">
                            Min:{" "}
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {m.minStockLevel ?? 0}
                            </span>
                          </div>
                          <div className="text-slate-500 dark:text-slate-400">
                            Reorder:{" "}
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {m.reorderLevel ?? 0}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 align-middle">
                        <button
                          onClick={() => canEdit && toggleActive(m)}
                          disabled={!canEdit}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            m.isActive
                              ? "bg-emerald-500"
                              : "bg-slate-300 dark:bg-slate-700"
                          } ${!canEdit ? "cursor-not-allowed opacity-60" : ""}`}
                          title={canEdit ? "Toggle status" : "Read-only"}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                              m.isActive ? "translate-x-4.5" : "translate-x-0.5"
                            }`}
                          />
                        </button>
                      </TableCell>
                      <TableCell className="px-4 py-3 align-middle">
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => openEdit(m)}
                              title="Edit"
                              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-[#3aa838]/10 hover:text-[#2f8a2f]"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => openAdjustModal(undefined, m)}
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
                              onClick={() => removeItem(m._id)}
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
                    <TableCell colSpan={11} className="py-14 text-center">
                      {loading ? (
                        <div className="flex flex-col items-center gap-2 text-slate-500 dark:text-slate-400">
                          <RefreshCcw className="h-5 w-5 animate-spin" />
                          <span className="text-xs">Loading raw materials…</span>
                        </div>
                      ) : (
                        <div className="mx-auto max-w-sm">
                          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                            <Inbox className="h-6 w-6 text-slate-400" />
                          </div>
                          <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
                            {q ? "No materials match your search" : "No raw materials yet"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {q
                              ? "Try a different search term."
                              : "Create your first raw material to get started."}
                          </p>
                          {canCreate && !q && (
                            <Button
                              size="sm"
                              onClick={openCreate}
                              className="mt-4 h-8 gap-1.5 bg-[#3aa838] text-xs text-white hover:bg-[#2f8a2f]"
                            >
                              <Plus className="h-3 w-3" />
                              New Material
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
            {editing?._id ? "Edit Raw Material" : "New Raw Material"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Add or update raw material details.
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
                  {editing?._id ? "Edit Raw Material" : "New Raw Material"}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {editing?._id
                    ? `Updating ${editing.name}`
                    : "Fill in the material details below"}
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
                  placeholder="e.g. Urea"
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
                  placeholder="e.g. RM-001"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Category
                  </label>
                  <select
                    value={form.category || ""}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value })
                    }
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-[#3aa838]/40 focus:ring-2 focus:ring-[#3aa838]/10 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <option value="">Select category</option>
                    <option value="chemical">Chemical</option>
                    <option value="liquid">Liquid</option>
                    <option value="powder">Powder</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Unit <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={form.unit}
                    onChange={(e) =>
                      setForm({ ...form, unit: e.target.value as any })
                    }
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-[#3aa838]/40 focus:ring-2 focus:ring-[#3aa838]/10 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="ltr">ltr</option>
                    <option value="ml">ml</option>
                  </select>
                </div>
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
                    Average Price
                  </label>
                  <Input
                    type="number"
                    value={form.averagePrice ?? 0}
                    onChange={(e) =>
                      setForm({ ...form, averagePrice: Number(e.target.value) })
                    }
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
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
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Reorder Level
                  </label>
                  <Input
                    type="number"
                    value={form.reorderLevel ?? 0}
                    onChange={(e) =>
                      setForm({ ...form, reorderLevel: Number(e.target.value) })
                    }
                    className="h-9 text-sm"
                  />
                </div>
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
                {editing?._id ? "Save Changes" : "Create Material"}
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
            Stock breakdown — {selectedMaterial?.name || "Material"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Per-factory stock levels and transaction history.
          </DialogDescription>

          {selectedMaterial && (
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
                        {selectedMaterial.name}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        SKU:{" "}
                        <span className="font-mono">
                          {selectedMaterial.sku}
                        </span>{" "}
                        · Stock breakdown & history
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {canEdit && (
                      <Button
                        size="sm"
                        onClick={() =>
                          openAdjustModal(undefined, selectedMaterial)
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
                          {stockByMaterial.get(selectedMaterial._id || "")
                            ?.rows.length || 0}
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
                          {stockByMaterial.get(selectedMaterial._id || "")
                            ?.total || 0}{" "}
                          <span className="text-xs font-normal text-slate-500">
                            {selectedMaterial.unit}
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
                            (stockByMaterial.get(selectedMaterial._id || "")
                              ?.total || 0) *
                            (selectedMaterial.purchasePrice || 0)
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
                      stockByMaterial.get(selectedMaterial._id || "")?.rows ||
                      []
                    ).map((s) => {
                      const factoryName =
                        s.factoryId?.name ||
                        s.factory?.name ||
                        (s.factoryId as any)?._id ||
                        "Unknown Factory";
                      const isSelected = selectedStockForTx?._id === s._id;
                      const minLevel = selectedMaterial.minStockLevel || 0;
                      const reorderLevel =
                        selectedMaterial.reorderLevel || 0;
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
                                      openAdjustModal(s, selectedMaterial)
                                    }
                                    className="h-7 px-2 text-[10px]"
                                  >
                                    Adjust
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant={isSelected ? "default" : "outline"}
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
                                  Min: {minLevel} · Reorder: {reorderLevel}
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
                              <div className="mt-1 flex justify-between text-[9px]">
                                <span className="text-slate-500 dark:text-slate-400">
                                  {stockPercent}% of reorder level
                                </span>
                                {isLow && (
                                  <span className="flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-300">
                                    <AlertTriangle className="h-2.5 w-2.5" />
                                    Low stock!
                                  </span>
                                )}
                              </div>
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
                                                {selectedMaterial.unit}
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
                      stockByMaterial.get(selectedMaterial._id || "")?.rows ||
                      []
                    ).length === 0 && (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center dark:border-slate-700 dark:bg-slate-900">
                        <Warehouse className="mx-auto mb-2 h-10 w-10 text-slate-300" />
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          No stock records for this material
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
                              openAdjustModal(undefined, selectedMaterial)
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
                onChange={(e) => {
                  const factoryId = e.target.value;
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
                value={adjustRecord.unit || "kg"}
                onChange={(e) =>
                  setAdjustRecord({ ...adjustRecord, unit: e.target.value })
                }
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-[#3aa838]/40 focus:ring-2 focus:ring-[#3aa838]/10 dark:border-slate-800 dark:bg-slate-900"
              >
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="ltr">ltr</option>
                <option value="ml">ml</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Batch
              </label>
              <Input
                value={adjustRecord.batch || ""}
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