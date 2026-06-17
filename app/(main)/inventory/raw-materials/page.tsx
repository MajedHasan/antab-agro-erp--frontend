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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Trash2,
  Edit,
  Plus,
  Search,
  Sliders,
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
} from "lucide-react";
import { toast } from "sonner";

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

/* ---------- Small UI bits ---------- */
const categoryColors: Record<string, string> = {
  chemical: "bg-red-100 text-red-800 border-red-300",
  liquid: "bg-blue-100 text-blue-800 border-blue-300",
  powder: "bg-amber-100 text-amber-800 border-amber-300",
};
const categoryIcons: Record<string, any> = {
  chemical: AlertTriangle,
  liquid: TrendingDown,
  powder: TrendingUp,
};

function CategoryBadge({ category }: { category?: string }) {
  if (!category) return <Badge variant="outline">-</Badge>;
  const color = categoryColors[category] || "bg-gray-100 text-gray-800";
  const Icon = categoryIcons[category] || Box;
  return (
    <Badge variant="outline" className={`flex items-center gap-1 ${color}`}>
      <Icon className="w-3 h-3" /> {category}
    </Badge>
  );
}

function UnitBadge({ unit }: { unit: string }) {
  return (
    <Badge variant="secondary" className="px-2 py-0.5 text-xs">
      {unit}
    </Badge>
  );
}

function StockLevelBadge({ current, min }: { current: number; min: number }) {
  const isLow = current <= min;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
        isLow ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
      }`}
    >
      {isLow ? (
        <AlertTriangle className="w-3 h-3" />
      ) : (
        <Package className="w-3 h-3" />
      )}
      {current}
    </span>
  );
}

export default function RawMaterialsPage() {
  /* ---- state ---- */
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

  /* ---------- Fetch factories ---------- */
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/warehouses-or-factories?type=Factory", {
          params: { limit: 100 },
        });
        setFactories(res.data.data || []);
      } catch (err) {
        toast.error("Failed to load factories");
      }
    })();
  }, []);

  /* ---------- Fetch functions ---------- */
  async function fetchList() {
    setLoading(true);
    try {
      const res = await api.get("/raw-materials", {
        params: { page, limit, q },
      });
      setItems(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      toast.error("Failed to load raw materials");
    } finally {
      setLoading(false);
    }
  }

  async function fetchStocksForAll() {
    setStockLoading(true);
    try {
      const res = await api.get("/raw-material-stocks", {
        params: { page: 1, limit: 10000 },
      });
      setStocks(res.data.data || []);
    } catch (err) {
      toast.error("Failed to load stocks");
    } finally {
      setStockLoading(false);
    }
  }

  async function fetchStockTransactions(stock: StockItem) {
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
    } catch (err) {
      toast.error("Failed to load stock transactions");
      setStockTransactions([]);
    } finally {
      setTxLoading(false);
    }
  }

  useEffect(() => {
    fetchList();
  }, [page, limit, q]);
  useEffect(() => {
    if (items.length > 0) fetchStocksForAll();
    else setStocks([]);
  }, [items]);

  /* ---------- Aggregation ---------- */
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

  /* ---------- Actions ---------- */
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
      fetchList();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Save failed");
    }
  }

  async function removeItem(id?: string) {
    if (!id || !confirm("Delete raw material?")) return;
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
      fetchList();
    }
  }

  function openStockModal(item: RawMaterial) {
    setSelectedMaterial(item);
    setSelectedStockForTx(null);
    setStockTransactions([]);
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

  /* ---------- Render ---------- */
  return (
    <div className="space-y-6 p-4 md:p-6 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-800 flex items-center gap-2">
            <Package className="w-8 h-8 text-indigo-600" /> Raw Materials
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage raw materials, stock levels, and transactions across
            factories.
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
              placeholder="Search name, SKU, category..."
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
              Total Materials
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
            <p className="text-xs text-muted-foreground">Below minimum level</p>
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
                const belowMin = (agg.total || 0) <= (m.minStockLevel || 0);
                return (
                  <TableRow
                    key={m._id || idx}
                    className="hover:bg-indigo-50/50 transition-colors"
                  >
                    <TableCell>{(page - 1) * limit + idx + 1}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-800">
                          {m.name}
                        </span>
                        {m.notes && (
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {m.notes}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-mono">{m.sku}</TableCell>
                    <TableCell>
                      <CategoryBadge category={m.category} />
                    </TableCell>
                    <TableCell>
                      <UnitBadge unit={m.unit} />
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      ৳ {m.purchasePrice ?? 0}
                    </TableCell>
                    <TableCell className="text-sm">
                      ৳ {m.averagePrice ?? 0}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StockLevelBadge
                          current={agg.total}
                          min={m.minStockLevel || 0}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openStockModal(m)}
                          className="h-6 p-0"
                        >
                          <Eye className="w-3 h-3 mr-1" /> view
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs space-y-1">
                        <div>
                          <span className="text-muted-foreground">Min:</span>{" "}
                          {m.minStockLevel ?? 0}
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Reorder:
                          </span>{" "}
                          {m.reorderLevel ?? 0}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => toggleActive(m)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${m.isActive ? "bg-emerald-500" : "bg-gray-300"}`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${m.isActive ? "translate-x-6" : "translate-x-1"}`}
                        />
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEdit(m)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeItem(m._id)}
                        >
                          <Trash2 className="w-4 h-4 text-rose-500" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openAdjustModal(undefined, m)}
                        >
                          <Plus className="w-3 h-3 mr-1" /> Stock
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {items.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={11}
                    className="text-center py-10 text-muted-foreground"
                  >
                    {loading ? "Loading..." : "No raw materials found"}
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
              {[10, 15, 25, 50].map((l) => (
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
              {editing?._id ? "Edit Raw Material" : "New Raw Material"}
            </h3>
            <div className="grid gap-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">SKU</label>
                <Input
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Category</label>
                  <select
                    value={form.category || ""}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value })
                    }
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  >
                    <option value="">Select category</option>
                    <option value="chemical">Chemical</option>
                    <option value="liquid">Liquid</option>
                    <option value="powder">Powder</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Unit</label>
                  <select
                    value={form.unit}
                    onChange={(e) =>
                      setForm({ ...form, unit: e.target.value as any })
                    }
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  >
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="ltr">ltr</option>
                    <option value="ml">ml</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Purchase Price</label>
                  <Input
                    type="number"
                    value={form.purchasePrice ?? 0}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        purchasePrice: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Average Price</label>
                  <Input
                    type="number"
                    value={form.averagePrice ?? 0}
                    onChange={(e) =>
                      setForm({ ...form, averagePrice: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Min Stock Level</label>
                  <Input
                    type="number"
                    value={form.minStockLevel ?? 0}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        minStockLevel: Number(e.target.value),
                      })
                    }
                  />
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
              </div>
              <div>
                <label className="text-sm font-medium">Notes</label>
                <Input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Status</label>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, isActive: !form.isActive })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isActive ? "bg-emerald-500" : "bg-gray-300"}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.isActive ? "translate-x-6" : "translate-x-1"}`}
                  />
                </button>
                <span className="text-sm">
                  {form.isActive ? "Active" : "Inactive"}
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

      {/* ---------- 🚀 STOCK & TRANSACTIONS DASHBOARD ---------- */}
      <Dialog open={stockModalOpen} onOpenChange={setStockModalOpen}>
        <DialogContent className="w-full md:!min-w-4xl !max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="space-y-6">
            {/* Material Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold flex items-center gap-2">
                  <Layers className="w-6 h-6 text-indigo-600" />
                  {selectedMaterial?.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Stock breakdown & transaction history per factory
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => openAdjustModal(undefined, selectedMaterial!)}
              >
                <Plus className="w-4 h-4 mr-1" /> Add Stock
              </Button>
            </div>

            {/* Quick Stats for the material */}
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
                      {stockByMaterial.get(selectedMaterial?._id || "")?.rows
                        .length || 0}
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
                      {stockByMaterial.get(selectedMaterial?._id || "")
                        ?.total || 0}{" "}
                      {selectedMaterial?.unit}
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
                        (stockByMaterial.get(selectedMaterial?._id || "")
                          ?.total || 0) * (selectedMaterial?.purchasePrice || 0)
                      ).toLocaleString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Per-Factory Stock Cards */}
            {stockLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading stocks…
              </div>
            ) : (
              <div className="grid gap-4">
                {(
                  stockByMaterial.get(selectedMaterial?._id || "")?.rows || []
                ).map((s) => {
                  const factoryName =
                    s.factoryId?.name ||
                    s.factory?.name ||
                    (s.factoryId as any)?._id ||
                    "Unknown Factory";
                  const isSelected = selectedStockForTx?._id === s._id;
                  const minLevel = selectedMaterial?.minStockLevel || 0;
                  const reorderLevel = selectedMaterial?.reorderLevel || 0;
                  const stockPercent = Math.min(
                    100,
                    Math.round(
                      (s.quantity / (reorderLevel > 0 ? reorderLevel : 100)) *
                        100,
                    ),
                  );
                  const isLow = s.quantity <= minLevel;

                  return (
                    <Card
                      key={s._id}
                      className={`border-2 transition-all ${isSelected ? "border-indigo-400 shadow-lg" : "border-slate-200 hover:border-slate-300"}`}
                    >
                      <CardContent className="p-5">
                        {/* Factory Row */}
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
                                {factoryName}
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
                              onClick={() =>
                                openAdjustModal(s, selectedMaterial!)
                              }
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
                              Min: {minLevel} | Reorder: {reorderLevel}
                            </span>
                          </div>
                          <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${isLow ? "bg-red-500" : stockPercent < 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                              style={{ width: `${stockPercent}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-xs mt-1">
                            <span>{stockPercent}% of reorder level</span>
                            {isLow && (
                              <span className="text-red-600 font-semibold flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> Low stock!
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Quick stat pills */}
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
                        </div>

                        {/* Transaction History (Timeline) */}
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
                                      {/* Dot on the timeline */}
                                      <div
                                        className={`absolute -left-[26px] top-1 w-6 h-6 rounded-full border-2 border-white ${config.bg} flex items-center justify-center shadow-sm`}
                                      >
                                        <Icon className="w-3.5 h-3.5" />
                                      </div>
                                      {/* Card */}
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
                                            {selectedMaterial?.unit || "units"}
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
                {(stockByMaterial.get(selectedMaterial?._id || "")?.rows || [])
                  .length === 0 && (
                  <div className="text-center py-12 text-muted-foreground bg-white rounded-2xl border">
                    <Warehouse className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-lg font-medium">
                      No stock records for this material.
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
              <label className="text-sm font-medium">Factory</label>
              <select
                value={adjustRecord.factoryId || ""}
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
                className="w-full rounded-lg border px-3 py-2 text-sm"
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
                value={adjustRecord.unit || "kg"}
                onChange={(e) =>
                  setAdjustRecord({ ...adjustRecord, unit: e.target.value })
                }
                className="w-full rounded-lg border px-3 py-2 text-sm"
              >
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="ltr">ltr</option>
                <option value="ml">ml</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Batch</label>
              <Input
                value={adjustRecord.batch || ""}
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
