"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
  Plus,
  Trash2,
  Edit,
  Search,
  RefreshCw,
  Layers3,
  Inbox,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  Package,
} from "lucide-react";
import { toast } from "sonner";

import Protected from "@/components/auth/Protected";
import usePermissionCheck from "@/hooks/usePermissionCheck";

/* =========================== Types =========================== */
type PopulatedRef =
  | string
  | { _id?: string; name?: string; sku?: string; unit?: string };

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
  tempId?: string;
  itemType: "RawMaterial" | "PackagingItem";
  itemId?: PopulatedRef;
  quantity: number;
  unit?: string;
  rule: { type: RuleType; n?: number };
  roundingMethod?: RoundingMethod;
  wastagePercent?: number;
};

type BOM = {
  _id?: string;
  productId?: PopulatedRef;
  version?: number;
  isActive?: boolean;
  components: BOMComponent[];
};

/* =========================== Unit conversion =========================== */
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

function convertUnit(value: number, from?: string, to?: string) {
  if (!from || !to) return value;
  if (from === to) return value;
  if (from === "kg" && to === "g") return value * 1000;
  if (from === "g" && to === "kg") return value / 1000;
  if (from === "ltr" && to === "ml") return value * 1000;
  if (from === "ml" && to === "ltr") return value / 1000;
  return value;
}

function applyRounding(val: number, method?: RoundingMethod) {
  if (!method || method === "NONE") return val;
  if (method === "CEIL") return Math.ceil(val);
  if (method === "FLOOR") return Math.floor(val);
  if (method === "ROUND") return Math.round(val);
  return val;
}

function idFromRef(ref?: PopulatedRef): string {
  if (!ref) return "";
  if (typeof ref === "string") return ref;
  return ref._id || "";
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

/* =========================== SearchableSelect =========================== */
type SearchOption = {
  value: string;
  label: string;
  subLabel?: string;
};

function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  emptyText = "No results",
  disabled = false,
}: {
  options: SearchOption[];
  value?: string;
  onChange: (id: string) => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(term) ||
        (o.subLabel && o.subLabel.toLowerCase().includes(term)),
    );
  }, [options, query]);

  function handleSelect(id: string) {
    onChange(id);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2 text-left text-sm outline-none transition focus:border-[#3aa838]/40 focus:ring-2 focus:ring-[#3aa838]/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900"
      >
        <span
          className={
            selected
              ? "truncate text-slate-900 dark:text-white"
              : "truncate text-slate-400"
          }
        >
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 p-1.5 dark:border-slate-800">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs outline-none focus:border-[#3aa838]/40 focus:ring-2 focus:ring-[#3aa838]/10 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
          </div>
          <div className="max-h-56 overflow-auto">
            {filtered.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-500 dark:text-slate-400">
                {emptyText}
              </div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => handleSelect(o.value)}
                  className={`flex w-full items-start justify-between gap-2 px-2.5 py-1.5 text-left text-xs transition hover:bg-slate-50 dark:hover:bg-slate-800 ${
                    o.value === value
                      ? "bg-[#3aa838]/10 font-semibold text-[#2f8a2f] dark:bg-[#3aa838]/15 dark:text-[#9bdd91]"
                      : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{o.label}</div>
                    {o.subLabel && (
                      <div className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                        {o.subLabel}
                      </div>
                    )}
                  </div>
                  {o.value === value && (
                    <Check className="mt-0.5 h-3 w-3 shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================== Page (Protected) =========================== */
export default function BomPage() {
  return (
    <Protected
      permissions={["bom.view", "bom.create", "bom.edit", "bom.delete"]}
    >
      <BomPageInner />
    </Protected>
  );
}

/* =========================== Inner =========================== */
function BomPageInner() {
  const hasAccess = usePermissionCheck();
  const canCreate = hasAccess({ permissions: "bom.create" });
  const canEdit = hasAccess({ permissions: "bom.edit" });
  const canDelete = hasAccess({ permissions: "bom.delete" });

  const [products, setProducts] = useState<Product[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [packagingItems, setPackagingItems] = useState<PackagingItem[]>([]);
  const [rawStocks, setRawStocks] = useState<any[]>([]);
  const [packStocks, setPackStocks] = useState<any[]>([]);

  const [boms, setBoms] = useState<BOM[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<BOM | null>(null);
  const [form, setForm] = useState<BOM>({
    productId: "",
    version: 1,
    isActive: true,
    components: [],
  });

  const [productionQty, setProductionQty] = useState<number>(0);
  const [preview, setPreview] = useState<
    Array<{
      comp: BOMComponent;
      required_in_comp_unit: number;
      required_in_stock_unit: number;
      available_in_stock_unit: number;
      shortage_in_stock_unit: number;
      stockUnit?: string;
    }>
  >([]);

  useEffect(() => {
    loadReferences();
    fetchBoms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function getItemName(c: BOMComponent) {
    const id = idFromRef(c.itemId);
    if (!id) return "—";
    if (c.itemType === "RawMaterial") {
      return rawMaterials.find((r) => r._id === id)?.name || "—";
    }
    return packagingItems.find((p) => p._id === id)?.name || "—";
  }

  function getItemNativeUnit(c: BOMComponent) {
    const id = idFromRef(c.itemId);
    if (c.itemType === "RawMaterial")
      return rawMaterials.find((r) => r._id === id)?.unit || "kg";
    return packagingItems.find((p) => p._id === id)?.unit || "pcs";
  }

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
    if (patch.itemId && patch.itemType) {
      const native =
        patch.itemType === "RawMaterial"
          ? rawMaterials.find((r) => r._id === idFromRef(patch.itemId))
          : packagingItems.find((p) => p._id === idFromRef(patch.itemId));
      if (native?.unit) comps[idx].unit = native.unit;
    } else if (patch.itemId && !patch.itemType) {
      const native =
        comps[idx].itemType === "RawMaterial"
          ? rawMaterials.find((r) => r._id === idFromRef(patch.itemId))
          : packagingItems.find((p) => p._id === idFromRef(patch.itemId));
      if (native?.unit) comps[idx].unit = native.unit;
    }
    setForm({ ...form, components: comps });
  }

  async function saveBOM(e?: React.FormEvent) {
    e?.preventDefault();
    if (editing?._id) {
      if (!canEdit) {
        toast.error("You don't have permission to edit BOMs");
        return;
      }
    } else {
      if (!canCreate) {
        toast.error("You don't have permission to create BOMs");
        return;
      }
    }

    if (!idFromRef(form.productId)) return toast.error("Select product");
    if (!form.components.length)
      return toast.error("Add at least one component");

    for (const c of form.components) {
      if (!idFromRef(c.itemId))
        return toast.error("Select item for all components");
      if (!c.unit) return toast.error("Unit must be set for all components");
      if (c.rule.type === "PER_N_UNITS" && !(c.rule.n && c.rule.n > 0))
        return toast.error("Enter N for PER_N_UNITS");
    }

    try {
      const payload = {
        ...form,
        productId: idFromRef(form.productId),
        components: form.components.map((c) => ({
          ...c,
          itemId: idFromRef(c.itemId),
        })),
      };

      if (editing?._id) {
        await api.put(`/bom/${editing._id}`, payload);
        toast.success("BOM updated");
      } else {
        await api.post("/bom", payload);
        toast.success("BOM created");
      }
      setOpenForm(false);
      void fetchBoms();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Save failed");
    }
  }

  async function deleteBom(id?: string) {
    if (!id) return;
    if (!canDelete) {
      toast.error("You don't have permission to delete BOMs");
      return;
    }
    if (!confirm("Delete BOM?")) return;
    try {
      await api.delete(`/bom/${id}`);
      toast.success("Deleted");
      void fetchBoms();
    } catch (err) {
      console.error(err);
      toast.error("Delete failed");
    }
  }

  async function calculatePreview() {
    if (!productionQty || productionQty <= 0)
      return toast.error("Enter production quantity");
    if (!form.components.length)
      return toast.error("Add components for preview");

    try {
      const [rmStocksRes, pkStocksRes] = await Promise.all([
        api.get("/raw-material-stocks", { params: { page: 1, limit: 10000 } }),
        api.get("/packaging-stocks", { params: { page: 1, limit: 10000 } }),
      ]);
      const rmStocks = rmStocksRes.data.data || [];
      const pkStocks = pkStocksRes.data.data || [];

      const results = form.components.map((c) => {
        let required_in_comp_unit = 0;
        if (c.rule.type === "PER_UNIT") {
          required_in_comp_unit = productionQty * c.quantity;
        } else {
          const n = c.rule.n || 1;
          const batches = Math.ceil(productionQty / n);
          required_in_comp_unit = batches * c.quantity;
        }

        if (c.wastagePercent && c.wastagePercent > 0) {
          required_in_comp_unit =
            required_in_comp_unit * (1 + c.wastagePercent / 100);
        }

        required_in_comp_unit = applyRounding(
          required_in_comp_unit,
          c.roundingMethod,
        );

        let availableInStockUnit = 0;
        let stockUnit = c.unit;

        if (c.itemType === "RawMaterial") {
          const cid = idFromRef(c.itemId);
          for (const s of rmStocks) {
            const sid =
              typeof s.rawMaterialId === "string"
                ? s.rawMaterialId
                : s.rawMaterialId?._id;
            if (String(sid) === String(cid)) {
              const sUnit = s.unit || getItemNativeUnit(c);
              stockUnit = sUnit;
            }
          }
          const required_in_stock_unit = convertUnit(
            required_in_comp_unit,
            c.unit,
            stockUnit,
          );
          for (const s of rmStocks) {
            const sid =
              typeof s.rawMaterialId === "string"
                ? s.rawMaterialId
                : s.rawMaterialId?._id;
            if (String(sid) === String(cid)) {
              const sUnit = s.unit || getItemNativeUnit(c);
              const qtyInStockUnit = convertUnit(
                Number(s.quantity || 0),
                sUnit,
                stockUnit,
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
              required_in_stock_unit - availableInStockUnit,
            ),
            stockUnit,
          };
        } else {
          const cid = idFromRef(c.itemId);
          for (const s of pkStocks) {
            const sid =
              typeof s.packagingItemId === "string"
                ? s.packagingItemId
                : s.packagingItemId?._id;
            if (String(sid) === String(cid)) {
              const sUnit = s.unit || getItemNativeUnit(c);
              stockUnit = sUnit;
            }
          }
          const required_in_stock_unit = convertUnit(
            required_in_comp_unit,
            c.unit,
            stockUnit,
          );
          for (const s of pkStocks) {
            const sid =
              typeof s.packagingItemId === "string"
                ? s.packagingItemId
                : s.packagingItemId?._id;
            if (String(sid) === String(cid)) {
              const sUnit = s.unit || getItemNativeUnit(c);
              availableInStockUnit += convertUnit(
                Number(s.quantity || 0),
                sUnit,
                stockUnit,
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
              required_in_stock_unit - availableInStockUnit,
            ),
            stockUnit,
          };
        }
      });

      setPreview(results);
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

  /* option builders for searchable selects */
  const productOptions: SearchOption[] = useMemo(
    () =>
      products
        .filter((p) => p._id)
        .map((p) => ({
          value: p._id as string,
          label: p.name,
          subLabel: p.sku || undefined,
        })),
    [products],
  );

  function itemOptionsFor(type: "RawMaterial" | "PackagingItem"): SearchOption[] {
    if (type === "RawMaterial") {
      return rawMaterials
        .filter((r) => r._id)
        .map((r) => ({
          value: r._id as string,
          label: r.name,
          subLabel: r.unit ? `Unit: ${r.unit}` : undefined,
        }));
    }
    return packagingItems
      .filter((p) => p._id)
      .map((p) => ({
        value: p._id as string,
        label: p.name,
        subLabel: p.unit ? `Unit: ${p.unit}` : undefined,
      }));
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  /* =========================== Render =========================== */
  return (
    <div className="min-h-screen bg-slate-50/60 p-4 dark:bg-slate-950 md:p-6">
      <div className="mx-auto max-w-[1600px] space-y-4">
        {/* ============ COMPACT HEADER ============ */}
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#3aa838]/10 text-[#3aa838]">
              <Layers3 className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                Bill of Materials
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {total} BOM{total === 1 ? "" : "s"} · Page {page} of {totalPages}
              </p>
            </div>
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
                placeholder="Search product or version…"
                className="h-9 w-full pl-9 sm:w-56"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchBoms()}
              disabled={loading}
              className="h-9 gap-1.5"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            {canCreate && (
              <Button
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setForm({
                    productId: "",
                    version: 1,
                    isActive: true,
                    components: [],
                  });
                  setPreview([]);
                  setProductionQty(0);
                  setOpenForm(true);
                }}
                className="h-9 gap-1.5 bg-[#3aa838] text-white shadow-sm shadow-[#3aa838]/20 hover:bg-[#2f8a2f]"
              >
                <Plus className="h-4 w-4" />
                New BOM
              </Button>
            )}
          </div>
        </div>

        {/* ============ TABLE ============ */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 bg-slate-50/80 hover:bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/50">
                  {[
                    { key: "idx", label: "#", className: "w-12" },
                    { key: "product", label: "Product" },
                    { key: "version", label: "Version", className: "w-24" },
                    { key: "active", label: "Active", className: "w-24" },
                    {
                      key: "components",
                      label: "Components",
                      className: "w-28",
                    },
                    {
                      key: "actions",
                      label: "Actions",
                      className: "w-40 text-right",
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
                {boms.map((b, i) => (
                  <TableRow
                    key={b._id || i}
                    className="group border-b border-slate-100 transition-colors hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/30"
                  >
                    <TableCell className="px-4 py-3 align-middle text-xs font-medium text-slate-400">
                      {(page - 1) * limit + i + 1}
                    </TableCell>
                    <TableCell className="px-4 py-3 align-middle">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {products.find(
                          (p) => p._id === idFromRef(b.productId),
                        )?.name || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 align-middle">
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        v{b.version ?? 1}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 align-middle">
                      {b.isActive ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                          Inactive
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 align-middle">
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        {b.components?.length ?? 0}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 align-middle">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(b);
                              setForm({ ...b });
                              setPreview([]);
                              setProductionQty(0);
                              setOpenForm(true);
                            }}
                            title="Edit"
                            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-[#3aa838]/10 hover:text-[#2f8a2f]"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => void deleteBom(b._id)}
                            title="Delete"
                            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

                {boms.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-14 text-center">
                      {loading ? (
                        <div className="flex flex-col items-center gap-2 text-slate-500 dark:text-slate-400">
                          <RefreshCw className="h-5 w-5 animate-spin" />
                          <span className="text-xs">Loading BOMs…</span>
                        </div>
                      ) : (
                        <div className="mx-auto max-w-sm">
                          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                            <Inbox className="h-6 w-6 text-slate-400" />
                          </div>
                          <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
                            {q ? "No BOMs match your search" : "No BOMs yet"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {q
                              ? "Try a different search term."
                              : "Create your first BOM to get started."}
                          </p>
                          {canCreate && !q && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setEditing(null);
                                setForm({
                                  productId: "",
                                  version: 1,
                                  isActive: true,
                                  components: [],
                                });
                                setPreview([]);
                                setProductionQty(0);
                                setOpenForm(true);
                              }}
                              className="mt-4 h-8 gap-1.5 bg-[#3aa838] text-xs text-white hover:bg-[#2f8a2f]"
                            >
                              <Plus className="h-3 w-3" />
                              New BOM
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
              Showing{" "}
              <span className="font-semibold text-slate-900 dark:text-white">
                {total === 0 ? 0 : (page - 1) * limit + 1}
              </span>{" "}
              –{" "}
              <span className="font-semibold text-slate-900 dark:text-white">
                {Math.min(page * limit, total)}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-slate-900 dark:text-white">
                {total}
              </span>
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
                {[10, 15, 25, 50].map((l) => (
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
          className="!w-[96vw] !max-w-[1200px] h-[92vh] p-0 gap-0 rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950 flex flex-col"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">
            {editing?._id ? "Edit BOM" : "New BOM"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Configure BOM components and rules.
          </DialogDescription>

          <form onSubmit={saveBOM} className="flex h-full min-h-0 flex-col">
            {/* Header */}
            <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-3.5 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3aa838]/10 text-[#3aa838]">
                    <Layers3 className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {editing?._id ? "Edit BOM" : "New BOM"}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {editing?._id
                        ? "Update components and rules"
                        : "Define components, units, and rules"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Preview Qty
                    </label>
                    <Input
                      type="number"
                      value={productionQty || ""}
                      onChange={(e) =>
                        setProductionQty(Number(e.target.value))
                      }
                      placeholder="0"
                      className="h-8 w-24 text-center text-xs"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={() => void calculatePreview()}
                    size="sm"
                    className="h-8 gap-1.5 bg-[#3aa838] text-xs text-white hover:bg-[#2f8a2f]"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Calculate Preview
                  </Button>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50/60 p-4 dark:bg-slate-950/40 md:p-5">
              {/* Product + Version */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Product <span className="text-rose-500">*</span>
                    </label>
                    <SearchableSelect
                      options={productOptions}
                      value={idFromRef(form.productId)}
                      onChange={(id) =>
                        setForm({ ...form, productId: id })
                      }
                      placeholder="Search and select product…"
                      emptyText="No products match your search"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Version
                    </label>
                    <Input
                      type="number"
                      value={form.version ?? 1}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          version: Number(e.target.value),
                        })
                      }
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Components */}
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                      Components ({form.components.length})
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      Add at least one component
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addComponent}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Component
                  </Button>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {form.components.map((c, idx) => (
                    <div key={c.tempId || idx} className="p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="text-xs font-semibold text-slate-900 dark:text-white">
                          Component #{idx + 1}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => removeComponent(idx)}
                          className="h-7 gap-1 px-2 text-[10px] text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                        >
                          <Trash2 className="h-3 w-3" />
                          Remove
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Type
                          </label>
                          <select
                            value={c.itemType}
                            onChange={(e) =>
                              updateComponent(idx, {
                                itemType: e.target.value as any,
                                itemId: "",
                                unit: "",
                              })
                            }
                            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-[#3aa838]/40 focus:ring-2 focus:ring-[#3aa838]/10 dark:border-slate-800 dark:bg-slate-900"
                          >
                            <option value="RawMaterial">Raw Material</option>
                            <option value="PackagingItem">
                              Packaging Item
                            </option>
                          </select>
                        </div>

                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Item <span className="text-rose-500">*</span>
                          </label>
                          <SearchableSelect
                            options={itemOptionsFor(c.itemType)}
                            value={idFromRef(c.itemId)}
                            onChange={(id) =>
                              updateComponent(idx, { itemId: id })
                            }
                            placeholder={
                              c.itemType === "RawMaterial"
                                ? "Search raw material…"
                                : "Search packaging item…"
                            }
                            emptyText={
                              c.itemType === "RawMaterial"
                                ? "No raw materials match"
                                : "No packaging items match"
                            }
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Qty (base)
                          </label>
                          <Input
                            type="number"
                            value={c.quantity}
                            onChange={(e) =>
                              updateComponent(idx, {
                                quantity: Number(e.target.value),
                              })
                            }
                            className="h-9 text-sm"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Unit
                          </label>
                          <select
                            value={c.unit || ""}
                            onChange={(e) =>
                              updateComponent(idx, {
                                unit: e.target.value,
                              })
                            }
                            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-[#3aa838]/40 focus:ring-2 focus:ring-[#3aa838]/10 dark:border-slate-800 dark:bg-slate-900"
                          >
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
                        </div>

                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Rule
                          </label>
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
                            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-[#3aa838]/40 focus:ring-2 focus:ring-[#3aa838]/10 dark:border-slate-800 dark:bg-slate-900"
                          >
                            <option value="PER_UNIT">PER_UNIT</option>
                            <option value="PER_N_UNITS">PER_N_UNITS</option>
                          </select>
                        </div>

                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            N (for PER_N_UNITS)
                          </label>
                          <Input
                            type="number"
                            value={c.rule.n ?? 1}
                            onChange={(e) =>
                              updateComponent(idx, {
                                rule: {
                                  ...c.rule,
                                  n: Number(e.target.value),
                                },
                              })
                            }
                            disabled={c.rule.type !== "PER_N_UNITS"}
                            className="h-9 text-sm disabled:cursor-not-allowed disabled:bg-slate-50 dark:disabled:bg-slate-950/40"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Wastage %
                          </label>
                          <Input
                            type="number"
                            value={c.wastagePercent ?? 0}
                            onChange={(e) =>
                              updateComponent(idx, {
                                wastagePercent: Number(e.target.value),
                              })
                            }
                            className="h-9 text-sm"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Rounding
                          </label>
                          <select
                            value={c.roundingMethod || "NONE"}
                            onChange={(e) =>
                              updateComponent(idx, {
                                roundingMethod: e.target
                                  .value as RoundingMethod,
                              })
                            }
                            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-[#3aa838]/40 focus:ring-2 focus:ring-[#3aa838]/10 dark:border-slate-800 dark:bg-slate-900"
                          >
                            <option value="NONE">NONE</option>
                            <option value="CEIL">CEIL</option>
                            <option value="FLOOR">FLOOR</option>
                            <option value="ROUND">ROUND</option>
                          </select>
                        </div>
                      </div>

                      <div className="mt-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[10px] text-slate-600 dark:bg-slate-950/40 dark:text-slate-400">
                        Preview name:{" "}
                        <strong className="text-slate-900 dark:text-white">
                          {getItemName(c)}
                        </strong>{" "}
                        — native unit:{" "}
                        <strong className="text-slate-900 dark:text-white">
                          {getItemNativeUnit(c)}
                        </strong>
                      </div>
                    </div>
                  ))}

                  {form.components.length === 0 && (
                    <div className="p-10 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                        <Package className="h-6 w-6 text-slate-400" />
                      </div>
                      <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
                        No components yet
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Click &ldquo;Add Component&rdquo; to begin.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Preview grid */}
              {preview.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                  <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                      Preview for {productionQty} finished units
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      Required quantities converted into each component's stock
                      unit.
                    </div>
                  </div>
                  <div className="overflow-x-auto p-3">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60">
                          {[
                            "Type",
                            "Item",
                            "Required (component unit)",
                            "Required (stock unit)",
                            "Available (stock unit)",
                            "Shortage",
                          ].map((h, i) => (
                            <TableHead
                              key={h}
                              className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${
                                i >= 2 ? "text-right" : "text-left"
                              }`}
                            >
                              {h}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.map((r, i) => (
                          <TableRow
                            key={i}
                            className="border-b border-slate-100 last:border-b-0 dark:border-slate-800"
                          >
                            <TableCell className="px-3 py-2 text-xs">
                              <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                {r.comp.itemType}
                              </span>
                            </TableCell>
                            <TableCell className="px-3 py-2 text-xs font-medium text-slate-900 dark:text-white">
                              {getItemName(r.comp)}
                            </TableCell>
                            <TableCell className="px-3 py-2 text-right text-xs tabular-nums text-slate-700 dark:text-slate-300">
                              {Number(r.required_in_comp_unit.toFixed(6))}{" "}
                              {r.comp.unit}
                            </TableCell>
                            <TableCell className="px-3 py-2 text-right text-xs tabular-nums text-slate-700 dark:text-slate-300">
                              {Number(r.required_in_stock_unit.toFixed(6))}{" "}
                              {r.stockUnit}
                            </TableCell>
                            <TableCell className="px-3 py-2 text-right text-xs tabular-nums text-slate-700 dark:text-slate-300">
                              {Number(
                                r.available_in_stock_unit.toFixed(6),
                              )}{" "}
                              {r.stockUnit}
                            </TableCell>
                            <TableCell
                              className={`px-3 py-2 text-right text-xs tabular-nums ${
                                r.shortage_in_stock_unit > 0
                                  ? "font-bold text-rose-600 dark:text-rose-400"
                                  : "text-slate-700 dark:text-slate-300"
                              }`}
                            >
                              {Number(
                                r.shortage_in_stock_unit.toFixed(6),
                              )}{" "}
                              {r.stockUnit}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-center justify-between">
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
                  disabled={
                    (editing?._id && !canEdit) ||
                    (!editing?._id && !canCreate)
                  }
                  className="h-9 gap-1.5 bg-[#3aa838] text-white shadow-sm shadow-[#3aa838]/20 hover:bg-[#2f8a2f]"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Save BOM
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}