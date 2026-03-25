// src/app/product-promotions/page.tsx
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
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  Edit,
  Search,
  RefreshCcw,
  Eye,
  Zap,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

/* ---------- types ---------- */
type PromotionType =
  | "BUY_X_GET_Y"
  | "PERCENT_DISCOUNT"
  | "FLAT_DISCOUNT"
  | "QTY_DISCOUNT";

type ProductEntry = {
  id?: string; // UI-local id
  productId?: string;
  productName?: string; // denormalized for UI
  buyQty?: number;
  getQty?: number;
  discountPercent?: number;
  discountAmount?: number;
  maxBonusQty?: number;
  expanded?: boolean;
};

type Promotion = {
  _id?: string;
  name: string;
  description?: string;
  promotionType: PromotionType;
  // frontend friendly products (mapped from backend rules on fetch)
  products: ProductEntry[];
  warehouseIds?: string[];
  customerGroupIds?: string[];
  startDate?: string;
  endDate?: string;
  priority?: number;
  status?: string;
  isActive?: boolean;
};

type SimpleProduct = { _id: string; name: string; sku?: string };
type Warehouse = { _id: string; name: string };
type CustomerGroup = { _id: string; name: string };

/* ---------- helpers ---------- */
function uid() {
  return Math.random().toString(36).slice(2, 9);
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
function fmtDate(d?: string) {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return "-";
  }
}

/* ---------- constants ---------- */
const PROMOTION_TYPES: PromotionType[] = [
  "BUY_X_GET_Y",
  "PERCENT_DISCOUNT",
  "FLAT_DISCOUNT",
  "QTY_DISCOUNT",
];

/* ---------- Small MultiSelect (checkbox dropdown) ---------- */
function MultiSelect({
  values,
  options,
  placeholder,
  onChange,
}: {
  values: string[];
  options: { id: string; label: string }[];
  placeholder?: string;
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  const toggle = (id: string) => {
    if (values.includes(id)) onChange(values.filter((x) => x !== id));
    else onChange([...values, id]);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="border rounded px-3 py-2 w-full text-sm flex justify-between items-center bg-white"
        onClick={() => setOpen((s) => !s)}
      >
        <span>
          {values.length === 0
            ? placeholder || "Any"
            : `${values.length} selected`}
        </span>
        <ChevronDown className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border rounded shadow-md max-h-52 overflow-auto p-2">
          {options.length === 0 && (
            <div className="text-sm text-muted-foreground p-2">No options</div>
          )}
          {options.map((opt) => (
            <label
              key={opt.id}
              className="flex items-center gap-2 p-1 rounded hover:bg-slate-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={values.includes(opt.id)}
                onChange={() => toggle(opt.id)}
                className="h-4 w-4"
              />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- ProductAutocomplete ---------- */
function ProductAutocomplete({
  products,
  value,
  onSelect,
  placeholder,
}: {
  products: SimpleProduct[];
  value?: { id?: string; name?: string } | undefined;
  onSelect: (p?: SimpleProduct | null) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState(value?.name || "");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  useEffect(() => setQ(value?.name || ""), [value]);

  const filtered = useMemo(() => {
    if (!q) return products.slice(0, 10);
    const s = q.toLowerCase();
    return products
      .filter(
        (p) =>
          (p.name || "").toLowerCase().includes(s) ||
          (p.sku || "").toLowerCase().includes(s),
      )
      .slice(0, 20);
  }, [q, products]);

  return (
    <div className="relative" ref={ref}>
      <input
        className="border rounded px-2 py-2 w-full text-sm bg-white"
        placeholder={placeholder || "Search product..."}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border rounded shadow-md max-h-48 overflow-auto">
          {filtered.map((p) => (
            <div
              key={p._id}
              className="p-2 hover:bg-slate-50 cursor-pointer text-sm"
              onClick={() => {
                onSelect(p);
                setQ(p.name);
                setOpen(false);
              }}
            >
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-muted-foreground">{p.sku}</div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="p-2 text-sm text-muted-foreground">No products</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Page component ---------- */
export default function ProductPromotionsPage() {
  /* list state & filters */
  const [items, setItems] = useState<Promotion[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const [filterProductId, setFilterProductId] = useState<string | undefined>(
    undefined,
  );
  const [filterWarehouseId, setFilterWarehouseId] = useState<
    string | undefined
  >(undefined);
  const [filterStatus, setFilterStatus] = useState<string | undefined>(
    undefined,
  );

  /* form/modal */
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [form, setForm] = useState<Promotion>({
    name: "",
    description: "",
    promotionType: "BUY_X_GET_Y",
    products: [],
    warehouseIds: [],
    customerGroupIds: [],
    startDate: "",
    endDate: "",
    priority: 0,
    status: "Draft",
    isActive: false,
  });

  /* preview */
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewParams, setPreviewParams] = useState<{
    productId?: string;
    qty?: number;
    warehouseId?: string;
    customerGroupId?: string;
  }>({});
  const [previewResult, setPreviewResult] = useState<{
    bonusQty: number;
    appliedPromotionId?: string;
  } | null>(null);

  /* refs */
  const [products, setProducts] = useState<SimpleProduct[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([]);
  const [refsLoading, setRefsLoading] = useState(false);

  /* load refs first, then list (so we can map product names) */
  useEffect(() => {
    (async function loadRefs() {
      setRefsLoading(true);
      try {
        const [pRes, wRes, cgRes] = await Promise.all([
          api.get("/products", { params: { page: 1, limit: 1000 } }),
          api.get("/warehouses", {
            params: { type: "Warehouse", page: 1, limit: 1000 },
          }),
          api
            .get("/customer-groups", { params: { page: 1, limit: 1000 } })
            .catch(() => ({ data: { data: [] } })),
        ]);
        setProducts(pRes.data.data || []);
        setWarehouses(wRes.data.data || []);
        setCustomerGroups(cgRes.data.data || []);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load reference data");
      } finally {
        setRefsLoading(false);
      }
    })();
  }, []);

  /* fetch list - dependent on filters/pagination/search */
  async function fetchList() {
    try {
      setLoading(true);
      const params: any = { page, limit };
      if (q) params.q = q;
      if (filterProductId) params.productId = filterProductId;
      if (filterWarehouseId) params.warehouseId = filterWarehouseId;
      if (filterStatus) params.status = filterStatus;

      const res = await api.get("/promotions", { params });
      const raw = res.data.data || [];
      const totalRes = res.data.total ?? 0;

      // normalize each promotion: map backend rules -> frontend products[]
      const mapped: Promotion[] = raw.map((pr: any) => {
        const rules = pr.rules || [];
        const productsMapped: ProductEntry[] = rules.map((r: any) => {
          // r.productId may be populated object or id string
          let prodId: string | undefined;
          let prodName: string | undefined;
          if (!r)
            return { id: uid(), productId: undefined, productName: undefined };
          if (typeof r.productId === "string") {
            prodId = r.productId;
            const found = products.find((p) => p._id === r.productId);
            prodName = found?.name;
          } else if (r.productId && typeof r.productId === "object") {
            prodId =
              r.productId._id || r.productId.id || r.productId.toString?.();
            prodName =
              r.productId.name ||
              (typeof r.productId === "string" ? r.productId : undefined);
          }

          return {
            id: uid(),
            productId: prodId,
            productName: prodName,
            buyQty: r.buyQty,
            getQty: r.getQty,
            discountPercent: r.discountPercent,
            discountAmount: r.discountAmount,
            maxBonusQty: r.maxBonusQty,
            expanded: false,
          } as ProductEntry;
        });

        return {
          _id: pr._id,
          name: pr.name,
          description: pr.description,
          promotionType: pr.promotionType,
          products: productsMapped,
          warehouseIds: pr.warehouseIds || [],
          customerGroupIds: pr.customerGroupIds || [],
          startDate: pr.startDate,
          endDate: pr.endDate,
          priority: pr.priority,
          status: pr.status,
          isActive: !!pr.isActive,
        } as Promotion;
      });

      setItems(mapped);
      setTotal(totalRes);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load promotions");
    } finally {
      setLoading(false);
    }
  }

  // fetch list when refs loaded or filters change
  useEffect(() => {
    // wait for refs to load once, then fetch list — but also fetch on filter changes
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    page,
    limit,
    q,
    filterProductId,
    filterWarehouseId,
    filterStatus,
    refsLoading,
  ]);

  /* ---------- form helpers ---------- */
  function openCreate() {
    setEditing(null);
    setForm({
      name: "",
      description: "",
      promotionType: "BUY_X_GET_Y",
      products: [],
      warehouseIds: [],
      customerGroupIds: [],
      startDate: "",
      endDate: "",
      priority: 0,
      status: "Draft",
      isActive: false,
    });
    setOpenForm(true);
  }

  function openEdit(item: Promotion) {
    // when editing, ensure product entries include productName (lookup)
    const productsWithNames = (item.products || []).map((p) => {
      if (!p.productName && p.productId) {
        const found = products.find((x) => x._id === p.productId);
        return {
          ...p,
          productName: found?.name,
          id: p.id || uid(),
          expanded: false,
        };
      }
      return { ...p, id: p.id || uid(), expanded: false };
    });

    setEditing(item);
    setForm({
      ...item,
      products: productsWithNames,
      warehouseIds: item.warehouseIds || [],
      customerGroupIds: item.customerGroupIds || [],
    });
    setOpenForm(true);
  }

  function addProductEntry() {
    setForm((prev) => ({
      ...prev,
      products: [
        ...(prev.products || []),
        {
          id: uid(),
          productId: "",
          productName: "",
          buyQty: undefined,
          getQty: undefined,
          expanded: true,
        },
      ],
    }));
  }

  function removeProductEntry(localId: string) {
    setForm((prev) => ({
      ...prev,
      products: (prev.products || []).filter((p) => p.id !== localId),
    }));
  }

  function updateProductEntry(localId: string, patch: Partial<ProductEntry>) {
    setForm((prev) => {
      const productsArr = (prev.products || []).map((p) =>
        p.id === localId ? { ...p, ...patch } : p,
      );
      return { ...prev, products: productsArr };
    });
  }

  /* ---------- submit ---------- */
  async function submitForm(e?: React.FormEvent) {
    e?.preventDefault();
    if (!form.name?.trim()) return toast.error("Name required");
    if (!form.promotionType) return toast.error("Promotion type required");

    if (form.promotionType === "BUY_X_GET_Y") {
      if (!form.products || form.products.length === 0)
        return toast.error("Add at least one product");
      for (const entry of form.products) {
        if (!entry.productId)
          return toast.error("Select product for each entry");
        if (!entry.buyQty || entry.buyQty < 1)
          return toast.error("buyQty must be >= 1");
        if (!entry.getQty || entry.getQty < 1)
          return toast.error("getQty must be >= 1");
      }
    }

    const payload: any = {
      name: form.name,
      description: form.description,
      promotionType: form.promotionType,
      rules: (form.products || []).map((p) => ({
        productId: p.productId,
        buyQty: p.buyQty,
        getQty: p.getQty,
        discountPercent: p.discountPercent,
        discountAmount: p.discountAmount,
        maxBonusQty: p.maxBonusQty,
      })),
      warehouseIds: form.warehouseIds || [],
      customerGroupIds: form.customerGroupIds || [],
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      priority: form.priority || 0,
      status: form.status || "Draft",
      isActive: !!form.isActive,
    };

    try {
      if (editing?._id) {
        await api.put(`/promotions/${editing._id}`, payload);
        toast.success("Promotion updated");
      } else {
        await api.post("/promotions", payload);
        toast.success("Promotion created");
      }
      setOpenForm(false);
      fetchList();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Save failed");
    }
  }

  /* ---------- delete / toggle ---------- */
  async function removeItem(id?: string) {
    if (!id) return;
    if (!confirm("Delete promotion?")) return;
    try {
      await api.delete(`/promotions/${id}`);
      toast.success("Deleted");
      fetchList();
    } catch (err) {
      console.error(err);
      toast.error("Delete failed");
    }
  }

  async function toggleStatus(item: Promotion) {
    if (!item._id) return;
    try {
      const newStatus = item.status === "Active" ? "Paused" : "Active";
      await api.put(`/promotions/${item._id}`, { status: newStatus });
      toast.success("Status updated");
      fetchList();
    } catch (err) {
      console.error(err);
      toast.error("Failed to toggle status");
    }
  }

  async function exportCSV() {
    try {
      const res = await api.get("/promotions/export", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "promotions.csv";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      toast.error("Export failed");
    }
  }

  /* ---------- preview ---------- */
  async function previewBonus() {
    if (!previewParams.productId)
      return toast.error("Select product for preview");
    if (!previewParams.qty || previewParams.qty <= 0)
      return toast.error("Enter positive qty");
    try {
      setPreviewResult(null);
      const res = await api.get("/promotions/calculate-bonus", {
        params: {
          productId: previewParams.productId,
          qty: previewParams.qty,
          // pass customerId only if user selected a real customer; for groups backend might not filter by group
          customerId: previewParams.customerGroupId ?? undefined,
          warehouseId: previewParams.warehouseId ?? undefined,
        },
      });
      setPreviewResult(res.data.data || { bonusQty: 0 });
    } catch (err) {
      console.error(err);
      toast.error("Preview failed");
    }
  }

  /* ---------- derived ---------- */
  const totalPages = Math.max(1, Math.ceil(total / limit));

  /* ---------- render ---------- */
  return (
    <div className="p-4 space-y-6">
      {/* header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Product Promotions</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Create campaigns — Buy X → Get Y and discount rules per product.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex items-center gap-2 border rounded px-2 py-1 bg-white">
            <Search className="w-4 h-4 text-gray-500" />
            <Input
              value={q}
              placeholder="Search promotions..."
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              className="border-0 p-0"
            />
          </div>

          <Button onClick={openCreate} className="flex items-center gap-2">
            <Plus className="w-4 h-4" /> New
          </Button>

          <Button variant="secondary" onClick={exportCSV}>
            Export
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

      {/* filters row */}
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
        <div className="w-full md:w-1/3">
          <ProductAutocomplete
            products={products}
            value={
              filterProductId
                ? {
                    id: filterProductId,
                    name: products.find((p) => p._id === filterProductId)?.name,
                  }
                : undefined
            }
            onSelect={(p) => {
              setFilterProductId(p ? p._id : undefined);
              setPage(1);
            }}
            placeholder="Filter by product"
          />
        </div>

        <div className="w-full md:w-1/4">
          <select
            className="border rounded px-3 py-2 w-full"
            value={filterWarehouseId || ""}
            onChange={(e) => {
              setFilterWarehouseId(e.target.value || undefined);
              setPage(1);
            }}
          >
            <option value="">All warehouses</option>
            {warehouses.map((w) => (
              <option key={w._id} value={w._id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>

        <div className="w-full md:w-1/6">
          <select
            className="border rounded px-3 py-2 w-full"
            value={filterStatus || ""}
            onChange={(e) => {
              setFilterStatus(e.target.value || undefined);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="Draft">Draft</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Active">Active</option>
            <option value="Paused">Paused</option>
            <option value="Cancelled">Cancelled</option>
          </select>
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
                <TableHead>Type</TableHead>
                <TableHead>Products</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead>Dates</TableHead>
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

                  <TableCell className="text-sm">{p.promotionType}</TableCell>

                  <TableCell className="text-sm">
                    {(p.products || []).slice(0, 2).map((r, i) => (
                      <div key={i}>
                        {r.productName ||
                          nameOf(
                            products.find((pr) => pr._id === r.productId) ||
                              r.productId,
                          )}
                        {" — "}
                        {p.promotionType === "BUY_X_GET_Y"
                          ? `${r.buyQty ?? 0} → ${r.getQty ?? 0}`
                          : `${r.discountPercent ?? 0}${p.promotionType === "PERCENT_DISCOUNT" ? "%" : ""}`}
                      </div>
                    ))}
                    {(p.products || []).length > 2 && (
                      <div className="text-xs text-muted-foreground">
                        +{(p.products || []).length - 2} more
                      </div>
                    )}
                  </TableCell>

                  <TableCell className="text-sm">
                    {p.warehouseIds && p.warehouseIds.length ? (
                      <div>{p.warehouseIds.length} warehouses</div>
                    ) : (
                      <div>All warehouses</div>
                    )}
                    {p.customerGroupIds && p.customerGroupIds.length ? (
                      <div>{p.customerGroupIds.length} groups</div>
                    ) : (
                      <div>All customers</div>
                    )}
                  </TableCell>

                  <TableCell className="text-sm">
                    {fmtDate(p.startDate)} — {fmtDate(p.endDate)}
                  </TableCell>

                  <TableCell>
                    <div
                      className={`inline-block text-xs px-2 py-1 rounded ${p.status === "Active" ? "bg-green-100 text-green-800" : p.status === "Paused" ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-700"}`}
                    >
                      {p.status || "Draft"}
                    </div>
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
                        onClick={() => toggleStatus(p)}
                      >
                        {p.status === "Active" ? "Pause" : "Activate"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setPreviewParams({
                            productId:
                              p.products &&
                              p.products[0] &&
                              p.products[0].productId,
                            qty:
                              p.products &&
                              p.products[0] &&
                              p.products[0].buyQty
                                ? p.products[0].buyQty
                                : 1,
                          });
                          setPreviewResult(null);
                          setPreviewOpen(true);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    {loading ? "Loading..." : "No promotions found"}
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
          <form onSubmit={submitForm} className="space-y-4 max-w-4xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {editing?._id ? "Edit Promotion" : "New Promotion"}
              </h3>
              <div className="text-sm text-muted-foreground">
                Tip: add products and configure per-product rules
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm">Name</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm">Type</label>
                <select
                  value={form.promotionType}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      promotionType: e.target.value as PromotionType,
                    })
                  }
                  className="border rounded px-2 py-2 w-full text-sm"
                >
                  {PROMOTION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
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

            {/* products */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Products</label>
                <div>
                  <Button size="sm" onClick={addProductEntry}>
                    <Plus className="w-3 h-3" /> Add product
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {(form.products || []).map((entry) => (
                  <div key={entry.id} className="border rounded p-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 grid grid-cols-3 gap-2 items-end">
                        <div className="col-span-1">
                          <label className="text-xs">Product</label>
                          <ProductAutocomplete
                            products={products}
                            value={
                              entry.productId
                                ? {
                                    id: entry.productId,
                                    name: entry.productName,
                                  }
                                : undefined
                            }
                            onSelect={(p) =>
                              updateProductEntry(entry.id!, {
                                productId: p ? p._id : undefined,
                                productName: p ? p.name : undefined,
                              })
                            }
                          />
                        </div>

                        {form.promotionType === "BUY_X_GET_Y" ? (
                          <>
                            <div>
                              <label className="text-xs">Buy Qty</label>
                              <Input
                                type="number"
                                value={entry.buyQty ?? ""}
                                onChange={(e) =>
                                  updateProductEntry(entry.id!, {
                                    buyQty: Number(e.target.value),
                                  })
                                }
                              />
                            </div>
                            <div>
                              <label className="text-xs">Get Qty</label>
                              <Input
                                type="number"
                                value={entry.getQty ?? ""}
                                onChange={(e) =>
                                  updateProductEntry(entry.id!, {
                                    getQty: Number(e.target.value),
                                  })
                                }
                              />
                            </div>
                            <div>
                              <label className="text-xs">Max Bonus</label>
                              <Input
                                type="number"
                                value={entry.maxBonusQty ?? ""}
                                onChange={(e) =>
                                  updateProductEntry(entry.id!, {
                                    maxBonusQty: Number(e.target.value),
                                  })
                                }
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <label className="text-xs">Discount %</label>
                              <Input
                                type="number"
                                value={entry.discountPercent ?? ""}
                                onChange={(e) =>
                                  updateProductEntry(entry.id!, {
                                    discountPercent: Number(e.target.value),
                                  })
                                }
                              />
                            </div>
                            <div>
                              <label className="text-xs">Discount Amount</label>
                              <Input
                                type="number"
                                value={entry.discountAmount ?? ""}
                                onChange={(e) =>
                                  updateProductEntry(entry.id!, {
                                    discountAmount: Number(e.target.value),
                                  })
                                }
                              />
                            </div>
                            <div />
                          </>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              updateProductEntry(entry.id!, {
                                expanded: !entry.expanded,
                              })
                            }
                            className="p-1 border rounded"
                          >
                            {entry.expanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => removeProductEntry(entry.id!)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>

                        {entry.expanded && (
                          <div className="w-56 text-xs text-muted-foreground">
                            Extra per-product settings (optional)
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* assignments */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm">Assign Warehouses</label>
                <MultiSelect
                  values={form.warehouseIds || []}
                  options={warehouses.map((w) => ({
                    id: w._id,
                    label: w.name,
                  }))}
                  placeholder="Any warehouse"
                  onChange={(vals) =>
                    setForm((prev) => ({ ...prev, warehouseIds: vals }))
                  }
                />
                <div className="text-xs text-muted-foreground mt-1">
                  Leave empty to apply to all warehouses
                </div>
              </div>

              <div>
                <label className="text-sm">Customer Groups</label>
                <MultiSelect
                  values={form.customerGroupIds || []}
                  options={customerGroups.map((c) => ({
                    id: c._id,
                    label: c.name,
                  }))}
                  placeholder="Any customer group"
                  onChange={(vals) =>
                    setForm((prev) => ({ ...prev, customerGroupIds: vals }))
                  }
                />
                <div className="text-xs text-muted-foreground mt-1">
                  Leave empty to apply to all customers
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-sm">Start Date</label>
                <Input
                  type="date"
                  value={form.startDate || ""}
                  onChange={(e) =>
                    setForm({ ...form, startDate: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-sm">End Date</label>
                <Input
                  type="date"
                  value={form.endDate || ""}
                  onChange={(e) =>
                    setForm({ ...form, endDate: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-sm">Priority</label>
                <Input
                  type="number"
                  value={form.priority ?? 0}
                  onChange={(e) =>
                    setForm({ ...form, priority: Number(e.target.value) })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 items-center">
              <div>
                <label className="text-sm">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="border rounded px-2 py-2 w-full text-sm"
                >
                  <option value="Draft">Draft</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="Active">Active</option>
                  <option value="Paused">Paused</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm">Is Active</label>
                {/* small switch */}
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({ ...prev, isActive: !prev.isActive }))
                  }
                  className={`w-12 h-6 rounded-full p-0.5 ${form.isActive ? "bg-green-500" : "bg-gray-300"}`}
                >
                  <div
                    className={`h-5 w-5 rounded-full bg-white shadow transform transition ${form.isActive ? "translate-x-6" : "translate-x-0"}`}
                  />
                </button>
              </div>
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

      {/* Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent>
          <div className="space-y-4 max-w-lg">
            <h3 className="text-lg font-semibold">Promotion Preview</h3>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm">Product</label>
                <ProductAutocomplete
                  products={products}
                  value={
                    previewParams.productId
                      ? {
                          id: previewParams.productId,
                          name: products.find(
                            (p) => p._id === previewParams.productId,
                          )?.name,
                        }
                      : undefined
                  }
                  onSelect={(p) =>
                    setPreviewParams((prev) => ({
                      ...prev,
                      productId: p ? p._id : undefined,
                    }))
                  }
                />
              </div>

              <div>
                <label className="text-sm">Qty</label>
                <Input
                  type="number"
                  value={previewParams.qty ?? ""}
                  onChange={(e) =>
                    setPreviewParams((prev) => ({
                      ...prev,
                      qty: Number(e.target.value),
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm">Warehouse (optional)</label>
                <select
                  value={previewParams.warehouseId || ""}
                  onChange={(e) =>
                    setPreviewParams((prev) => ({
                      ...prev,
                      warehouseId: e.target.value,
                    }))
                  }
                  className="border rounded px-2 py-2 w-full text-sm"
                >
                  <option value="">Any</option>
                  {warehouses.map((w) => (
                    <option key={w._id} value={w._id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm">Customer Group (optional)</label>
                <select
                  value={previewParams.customerGroupId || ""}
                  onChange={(e) =>
                    setPreviewParams((prev) => ({
                      ...prev,
                      customerGroupId: e.target.value,
                    }))
                  }
                  className="border rounded px-2 py-2 w-full text-sm"
                >
                  <option value="">Any</option>
                  {customerGroups.map((cg) => (
                    <option key={cg._id} value={cg._id}>
                      {cg.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={previewBonus}>
                <Zap className="w-4 h-4" /> Preview Bonus
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setPreviewParams({});
                  setPreviewResult(null);
                }}
              >
                Reset
              </Button>
            </div>

            <div>
              <h4 className="text-sm font-medium">Result</h4>
              {previewResult ? (
                <div>
                  <div className="text-lg">
                    Bonus Qty:{" "}
                    <span className="font-bold">{previewResult.bonusQty}</span>
                  </div>
                  {previewResult.appliedPromotionId && (
                    <div className="text-xs text-muted-foreground">
                      Applied promotion: {previewResult.appliedPromotionId}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No preview yet
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setPreviewOpen(false);
                  setPreviewResult(null);
                }}
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
