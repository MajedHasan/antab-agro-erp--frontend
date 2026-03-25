// src/app/grs/page.tsx
"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import api from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Plus, Upload, Check, X, Eye, CreditCard } from "lucide-react";
import { toast } from "sonner";

/* ======================
   Types (kept compact)
   ====================== */
type Supplier = {
  _id: string;
  supplierName?: string;
  name?: string;
  address?: string;
};
type Warehouse = { _id: string; name?: string; address?: string };
type Product = {
  _id: string;
  name: string;
  unit?: string;
  purchasePrice?: number;
};
type WorkOrder = {
  _id: string;
  workOrderNo?: string;
  supplier?: Supplier | string;
  warehouseOrFactory?: Warehouse | string;
  items?: any[];
};

type GRItem = {
  itemType: "RawMaterial" | "PackagingItem";
  itemId: string;
  receivedQty: number;
  unit?: string;
  unitPrice?: number;
  remarks?: string;
};
type GRForm = {
  grNo?: string;
  workOrderId?: string | null;
  supplier?: string;
  warehouseOrFactory?: string;
  date?: string;
  items: GRItem[];
  notes?: string;
  attachments?: File[];
};

type GR = {
  _id: string;
  grNo?: string;
  workOrderId?: string;
  supplier?: Supplier | string;
  warehouseOrFactory?: Warehouse | string;
  date?: string;
  items?: any[];
  status?: "Pending" | "Approved" | "Rejected";
  attachments?: any[];
  payments?: any[];
};

/* ======================
   Small helpers
   ====================== */
const NONE = "none";

function cents(n = 0) {
  return Math.round(Number(n || 0) * 100);
} // cents integer
function fromCents(c: number) {
  return (c / 100).toFixed(2);
}
function money(n?: number) {
  if (n === undefined || n === null || Number.isNaN(Number(n))) return "-";
  return Number(Math.round(n * 100) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
function debounce<T extends (...a: any[]) => void>(fn: T, ms = 250) {
  let t: any;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/* ======================
   Reusable small components
   ====================== */

function StatusBadge({ s }: { s?: string }) {
  const base =
    "px-2 py-1 rounded text-sm font-semibold inline-block text-white";
  if (!s) return <span>-</span>;
  return (
    <span
      className={
        base +
        " " +
        (s === "Pending"
          ? "bg-yellow-600"
          : s === "Approved"
            ? "bg-indigo-600"
            : "bg-red-600")
      }
    >
      {s}
    </span>
  );
}

/* SearchSelect: lightweight debounced search listing items returned under { data } */
function SearchSelect({
  endpoint,
  placeholder,
  onSelect,
  valueId,
  label = (x: any) => x.name || x.supplierName,
  minChars = 1,
}: {
  endpoint: string;
  placeholder?: string;
  onSelect: (id: string | null, full?: any) => void;
  valueId?: string | null;
  label?: (a: any) => string;
  minChars?: number;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetcher = useCallback(
    debounce(async (qq: string) => {
      if (qq.length < minChars) {
        setItems([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await api.get(endpoint, { params: { q: qq, limit: 50 } });
        setItems(res?.data?.data || []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 300),
    [endpoint, minChars],
  );

  useEffect(() => {
    if (!open) return;
    fetcher(q);
  }, [q, open, fetcher]);

  return (
    <div className="relative">
      <div className="flex gap-2">
        <Input
          placeholder={placeholder}
          value={q}
          onFocus={() => setOpen(true)}
          onChange={(e) => setQ(e.target.value)}
        />
        <Button
          variant="ghost"
          onClick={() => {
            setQ("");
            onSelect(null);
          }}
        >
          Clear
        </Button>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border rounded shadow max-h-56 overflow-auto">
          {loading && (
            <div className="p-2 text-sm text-muted-foreground">
              Searching...
            </div>
          )}
          {!loading && items.length === 0 && (
            <div className="p-2 text-sm text-muted-foreground">No results</div>
          )}
          {!loading &&
            items.map((it) => (
              <div
                key={it._id}
                className="p-2 hover:bg-gray-50 cursor-pointer"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(it._id, it);
                  setOpen(false);
                }}
              >
                <div className="text-sm font-medium">{label(it)}</div>
                <div className="text-xs text-muted-foreground">
                  {(it.address || it._id) + ""}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

/* ======================
   Reducer for GR form
   ====================== */
type Action =
  | { type: "set"; payload: Partial<GRForm> }
  | { type: "setItem"; payload: { idx: number; patch: Partial<GRItem> } }
  | { type: "pushItem"; payload: GRItem }
  | { type: "removeItem"; payload: number }
  | { type: "setAttachments"; payload: File[] }
  | { type: "reset"; payload?: Partial<GRForm> };

function reducer(state: GRForm, action: Action): GRForm {
  switch (action.type) {
    case "set":
      return { ...state, ...(action.payload || {}) };
    case "setItem": {
      const items = state.items.map((it, i) =>
        i === action.payload.idx ? { ...it, ...action.payload.patch } : it,
      );
      return { ...state, items };
    }
    case "pushItem":
      return { ...state, items: [...state.items, action.payload] };
    case "removeItem":
      return {
        ...state,
        items: state.items.filter((_, i) => i !== action.payload),
      };
    case "setAttachments":
      return { ...state, attachments: action.payload };
    case "reset":
      return {
        grNo: undefined,
        workOrderId: null,
        supplier: "",
        warehouseOrFactory: "",
        date: new Date().toISOString().slice(0, 10),
        items: [],
        notes: "",
        attachments: [],
        ...(action.payload || {}),
      };
    default:
      return state;
  }
}

/* ======================
   Single-file "services" & caches (compact)
   ====================== */
const productCache: Record<string, Product> = {};
const woCache: Record<string, WorkOrder> = {};
const grsByWoCache: Record<string, GR[]> = {};

/* ======================
   Main Component
   ====================== */
export default function GoodsReceiptPage() {
  // lookups & list
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [grs, setGrs] = useState<GR[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // current user roles
  const [me, setMe] = useState<any>(null);

  // dialogs
  const [view, setView] = useState<GR | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [payFor, setPayFor] = useState<GR | null>(null);

  // form
  const [form, dispatchForm] = useReducer(reducer, {
    grNo: undefined,
    workOrderId: null,
    supplier: "",
    warehouseOrFactory: "",
    date: new Date().toISOString().slice(0, 10),
    items: [],
    notes: "",
    attachments: [],
  } as GRForm);

  const formRef = useRef(form);
  useEffect(() => {
    formRef.current = form;
  }, [form]);

  /* Initial load */
  useEffect(() => {
    api
      .get("/supplier", { params: { limit: 1000 } })
      .then((r) => setSuppliers(r?.data?.data || []))
      .catch(() => setSuppliers([]));
    api
      .get("/warehouses", { params: { limit: 1000 } })
      .then((r) => setWarehouses(r?.data?.data || []))
      .catch(() => setWarehouses([]));
    api
      .get("/workorders", { params: { limit: 500 } })
      .then((r) => setWorkOrders(r?.data?.data || []))
      .catch(() => setWorkOrders([]));
    api
      .get("/users/me")
      .then((r) => setMe(r?.data?.data))
      .catch(() => setMe(null));
  }, []);

  /* Load GRs list (debounced) */
  const loadGrs = useCallback(
    async (opts?: {
      page?: number;
      limit?: number;
      q?: string;
      status?: string | null;
    }) => {
      setLoading(true);
      try {
        const params: any = {
          page: opts?.page ?? page,
          limit: opts?.limit ?? limit,
        };
        if (opts?.q ?? q) params.q = opts?.q ?? q;
        const filter: any = {};
        if (opts?.status ?? filterStatus)
          filter.status = opts?.status ?? filterStatus;
        if (Object.keys(filter).length) params.filter = JSON.stringify(filter);
        const res = await api.get("/grs", { params });
        setGrs(res.data.data || []);
        setTotal(res.data.total ?? 0);
      } catch {
        toast.error("Failed to load G.R.s");
        setGrs([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [page, limit, q, filterStatus],
  );

  useEffect(() => {
    setPage(1);
  }, [q, filterStatus, limit]);
  useEffect(() => {
    loadGrs();
  }, [loadGrs, page, limit]);

  /* Generate GR number for new forms (one-time) */
  useEffect(() => {
    (async () => {
      try {
        const r = await api.get("/grs/generate-no");
        if (r?.data?.data)
          dispatchForm({ type: "set", payload: { grNo: r.data.data } });
      } catch {
        /* ignore */
      }
    })();
  }, []);

  /* Load WO or cached WO */
  const fetchWorkOrder = useCallback(async (id: string) => {
    if (!id) return null;
    if (woCache[id]) return woCache[id];
    try {
      const r = await api.get(`/workorders/${id}`);
      woCache[id] = r.data.data;
      return woCache[id];
    } catch {
      return null;
    }
  }, []);

  /* Load GRs for WO (cache) */
  const loadGrsForWo = useCallback(async (woId: string) => {
    if (!woId) return [];
    if (grsByWoCache[woId]) return grsByWoCache[woId];
    try {
      const r = await api.get("/grs", {
        params: { filter: JSON.stringify({ workOrderId: woId }), limit: 1000 },
      });
      grsByWoCache[woId] = r.data.data || [];
      return grsByWoCache[woId];
    } catch {
      return [];
    }
  }, []);

  /* Add product to form by picking product id (will fetch product & cache) */
  const addProduct = useCallback(
    async (type: "RawMaterial" | "PackagingItem", id: string) => {
      if (!id) return;
      try {
        if (!productCache[id]) {
          const ep =
            type === "RawMaterial" ? "/raw-materials" : "/packaging-items";
          const r = await api.get(`${ep}/${id}`);
          productCache[id] = r.data.data;
        }
        const p = productCache[id];
        dispatchForm({
          type: "pushItem",
          payload: {
            itemType: type,
            itemId: id,
            receivedQty: 0,
            unit: p?.unit || "",
            unitPrice: p?.purchasePrice ?? 0,
            remarks: "",
          },
        });
      } catch {
        toast.error("Unable to add product");
      }
    },
    [],
  );

  /* Open create form: optionally prefill from WO */
  const openCreateForWO = useCallback(
    async (woId?: string | null) => {
      try {
        const gen = await api.get("/grs/generate-no");
        const grNo = gen?.data?.data;
        if (!woId) {
          dispatchForm({ type: "reset", payload: { grNo } });
          setOpenCreate(true);
          return;
        }
        const doc = await fetchWorkOrder(woId);
        if (!doc) {
          toast.error("Work order not found");
          return;
        }
        const items: GRItem[] = (doc.items || []).map((it: any) => ({
          itemType: it.itemType,
          itemId:
            typeof it.itemId === "string"
              ? it.itemId
              : it.itemId._id || String(it.itemId),
          receivedQty: 0,
          unit: it.unit || "",
          unitPrice: it.unitPrice ?? 0,
          remarks: "",
        }));
        dispatchForm({
          type: "reset",
          payload: {
            grNo,
            workOrderId: doc._id,
            supplier:
              typeof doc.supplier === "string"
                ? doc.supplier
                : (doc.supplier && (doc.supplier as any)._id) || "",
            warehouseOrFactory:
              typeof doc.warehouseOrFactory === "string"
                ? doc.warehouseOrFactory
                : (doc.warehouseOrFactory &&
                    (doc.warehouseOrFactory as any)._id) ||
                  "",
            items,
            date: new Date().toISOString().slice(0, 10),
          },
        });
        await loadGrsForWo(doc._id);
        setOpenCreate(true);
      } catch (e) {
        console.error(e);
        toast.error("Failed to open form");
      }
    },
    [fetchWorkOrder, loadGrsForWo],
  );

  /* Submit GR (FormData) */
  const submit = useCallback(async () => {
    try {
      // validation
      if (!form.supplier) return toast.error("Choose supplier");
      if (!form.warehouseOrFactory)
        return toast.error("Choose warehouse/factory");
      if (!form.items || form.items.length === 0)
        return toast.error("Add at least one item");
      for (const it of form.items)
        if (!it.itemId || !it.receivedQty || Number(it.receivedQty) <= 0)
          return toast.error("Each item needs product and qty>0");

      const fd = new FormData();
      if (form.grNo) fd.append("grNo", form.grNo);
      if (form.workOrderId) fd.append("workOrderId", String(form.workOrderId));
      fd.append("supplier", String(form.supplier || ""));
      fd.append("warehouseOrFactory", String(form.warehouseOrFactory || ""));
      fd.append(
        "date",
        String(form.date || new Date().toISOString().slice(0, 10)),
      );
      fd.append("notes", String(form.notes || ""));
      // backend expects receivedQty in items
      fd.append(
        "items",
        JSON.stringify(
          form.items.map((it) => ({
            itemType: it.itemType,
            itemId: it.itemId,
            receivedQty: Number(it.receivedQty || 0),
            unit: it.unit || "",
            unitPrice: Number(it.unitPrice || 0),
            remarks: it.remarks || "",
          })),
        ),
      );
      (form.attachments || []).forEach((f) =>
        fd.append("attachments", f, f.name),
      );
      await api.post("/grs", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("G.R created");
      setOpenCreate(false);
      dispatchForm({ type: "reset" });
      loadGrs({ page: 1 });
      if (form.workOrderId) {
        delete grsByWoCache[String(form.workOrderId)];
        await loadGrsForWo(String(form.workOrderId));
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Create failed");
    }
  }, [form, loadGrs, loadGrsForWo]);

  /* Approve / Reject / Pay */
  const approve = useCallback(
    async (id: string) => {
      try {
        if (!confirm("Approve this G.R?")) return;
        await api.post(`/grs/${id}/approve`);
        toast.success("Approved");
        loadGrs();
      } catch {
        toast.error("Approve failed");
      }
    },
    [loadGrs],
  );
  const reject = useCallback(
    async (id: string) => {
      try {
        const r = prompt("Reject reason (required):");
        if (!r || !r.trim()) return alert("Reason required");
        await api.post(`/grs/${id}/reject`, { reason: r });
        toast.success("Rejected");
        loadGrs();
      } catch {
        toast.error("Reject failed");
      }
    },
    [loadGrs],
  );
  const pay = useCallback(
    async (id: string, amount: number, date?: string) => {
      try {
        if (!amount || amount <= 0) return toast.error("Amount required");
        await api.post(`/grs/${id}/pay`, {
          amount,
          paymentDate: date || new Date().toISOString(),
        });
        toast.success("Payment recorded");
        setPayFor(null);
        loadGrs();
      } catch {
        toast.error("Payment failed");
      }
    },
    [loadGrs],
  );

  /* View single GR fresh */
  const openView = useCallback(async (g: GR) => {
    try {
      const r = await api.get(`/grs/${g._id}`);
      setView(r.data.data || g);
    } catch {
      setView(g);
    }
  }, []);

  /* Derived: warnings when linked WO exceeded */
  const woWarnings = useMemo(() => {
    if (!form.workOrderId)
      return { warnings: [] as string[], map: {} as Record<string, number> };
    const cached = grsByWoCache[form.workOrderId] || [];
    const receivedMap: Record<string, number> = {};
    for (const gr of cached) {
      if (gr.status !== "Approved") continue;
      for (const it of gr.items || []) {
        const key = `${it.itemType}:${it.itemId}`;
        receivedMap[key] =
          (receivedMap[key] || 0) + Number(it.receivedQty ?? it.quantity ?? 0);
      }
    }
    // add current form
    const afterMap = { ...receivedMap };
    for (const it of form.items || []) {
      const key = `${it.itemType}:${it.itemId}`;
      afterMap[key] = (afterMap[key] || 0) + Number(it.receivedQty || 0);
    }
    const wo = woCache[form.workOrderId as string];
    const warnings: string[] = [];
    if (wo && wo.items) {
      for (const it of wo.items) {
        const key = `${it.itemType}:${typeof it.itemId === "string" ? it.itemId : (it.itemId as any)._id || String(it.itemId)}`;
        const req = Number(it.quantity || 0),
          before = receivedMap[key] || 0,
          after = afterMap[key] || 0;
        if (after > req)
          warnings.push(
            `${key} requested=${req} before=${before} after=${after}`,
          );
      }
    }
    return { warnings, map: afterMap };
  }, [form]);

  /* Simple small UI: compact header + list + dialogs */
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Goods Receipts</h2>
          <div className="text-sm text-muted-foreground">
            Receive supplier deliveries, approve, and manage payments.
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center border rounded px-2 py-1 bg-white">
            <Search className="w-4 h-4 text-gray-500" />
            <Input
              placeholder="Search GR#, supplier..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-64"
            />
          </div>

          <Select
            value={filterStatus ?? NONE}
            onValueChange={(v) => setFilterStatus(v === NONE ? null : v)}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>All</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Approved">Approved</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>

          <Button
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={() => openCreateForWO(null)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create G.R
          </Button>
        </div>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="p-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>G.R No</TableHead>
                <TableHead>Work Order</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-64">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grs.map((g, i) => (
                <TableRow key={g._id || i}>
                  <TableCell>{(page - 1) * limit + i + 1}</TableCell>
                  <TableCell>{g.grNo || g._id}</TableCell>
                  <TableCell>
                    {g.workOrderId
                      ? workOrders.find((w) => w._id === g.workOrderId)
                          ?.workOrderNo || g.workOrderId
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {typeof g.supplier === "string"
                      ? g.supplier
                      : (g.supplier as any)?.supplierName ||
                        (g.supplier as any)?.name ||
                        "-"}
                  </TableCell>
                  <TableCell>
                    {g.date ? new Date(g.date).toLocaleDateString() : "-"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge s={g.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openView(g)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {me &&
                        (me.role === "admin" || me.role === "manager") &&
                        g.status === "Pending" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => approve(g._id)}
                          >
                            <Check className="w-4 h-4" />
                            Approve
                          </Button>
                        )}
                      {me &&
                        (me.role === "admin" || me.role === "manager") &&
                        g.status === "Pending" && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => reject(g._id)}
                          >
                            <X className="w-4 h-4" />
                            Reject
                          </Button>
                        )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPayFor(g)}
                      >
                        <CreditCard className="w-4 h-4" />
                        Pay
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {grs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    {loading ? "Loading..." : "No records found"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="p-4 flex items-center justify-between border-t">
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
              className="border rounded px-2 py-1"
            >
              {[10, 15, 25, 50].map((l) => (
                <option key={l} value={l}>
                  {l}/page
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

      {/* View dialog */}
      <Dialog open={!!view} onOpenChange={() => setView(null)}>
        <DialogContent className="!w-full !max-w-[90vw] max-h-[90vh] p-0 rounded-xl shadow-2xl bg-background border">
          {view && (
            <div className="p-6 overflow-y-auto">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold">G.R {view.grNo}</h3>
                  <div className="text-sm text-muted-foreground">
                    {view._id}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() =>
                      navigator.clipboard?.writeText(window.location.href)
                    }
                  >
                    Copy Link
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <div className="text-sm text-muted-foreground">Supplier</div>
                  <div className="font-medium">
                    {typeof view.supplier === "string"
                      ? view.supplier
                      : (view.supplier as any)?.supplierName ||
                        (view.supplier as any)?.name}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Factory</div>
                  <div className="font-medium">
                    {typeof view.warehouseOrFactory === "string"
                      ? view.warehouseOrFactory
                      : (view.warehouseOrFactory as any)?.name}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Date</div>
                  <div>
                    {view.date ? new Date(view.date).toLocaleDateString() : "-"}
                  </div>
                  <div className="mt-2">
                    Status: <StatusBadge s={view.status} />
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto mb-4">
                <table className="w-full table-auto border-collapse">
                  <thead>
                    <tr>
                      <th className="p-2 border-b">#</th>
                      <th className="p-2 border-b">Item</th>
                      <th className="p-2 border-b text-right">Qty</th>
                      <th className="p-2 border-b">Unit</th>
                      <th className="p-2 border-b">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(view.items || []).map((it: any, idx: number) => (
                      <tr key={idx}>
                        <td className="p-2">{idx + 1}</td>
                        <td className="p-2">
                          {(it.itemType || "") + ":" + (it.itemId || "")}
                        </td>
                        <td className="p-2 text-right">
                          {it.receivedQty ?? it.quantity ?? 0}
                        </td>
                        <td className="p-2">{it.unit}</td>
                        <td className="p-2">{it.remarks || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-semibold">Attachments</div>
                  <div className="mt-2">
                    {(view.attachments || []).length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        No attachments
                      </div>
                    ) : (
                      (view.attachments || []).map((a: any, i: number) => (
                        <div key={i}>
                          <a
                            href={a.url || a.path || "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="text-indigo-600 underline"
                          >
                            {a.filename || a.name || `File ${i + 1}`}
                          </a>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-semibold">Payments</div>
                  <div className="mt-2">
                    {(view.payments || []).length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        No payments
                      </div>
                    ) : (
                      (view.payments || []).map((p: any, i: number) => (
                        <div key={i} className="flex justify-between">
                          <div>{p.reference || `Payment ${i + 1}`}</div>
                          <div>
                            {money(p.amount)}{" "}
                            {p.paidAt
                              ? `(${new Date(p.paidAt).toLocaleDateString()})`
                              : ""}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                {me &&
                  (me.role === "admin" || me.role === "manager") &&
                  view.status === "Pending" && (
                    <Button variant="ghost" onClick={() => approve(view._id)}>
                      <Check className="w-4 h-4" />
                      Approve
                    </Button>
                  )}
                {me &&
                  (me.role === "admin" || me.role === "manager") &&
                  view.status === "Pending" && (
                    <Button
                      variant="destructive"
                      onClick={() => reject(view._id)}
                    >
                      <X className="w-4 h-4" />
                      Reject
                    </Button>
                  )}
                <Button onClick={() => setView(null)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create dialog (compact, powerful) */}
      <Dialog
        open={openCreate}
        onOpenChange={() => {
          setOpenCreate(false);
          dispatchForm({ type: "reset" });
        }}
      >
        <DialogContent className="!w-full !max-w-[98vw] max-h-[95vh] p-0 rounded-xl shadow-2xl bg-background border">
          <div className="p-6 overflow-y-auto max-h-[85vh] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Create Goods Receipt</h3>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => dispatchForm({ type: "reset" })}
                >
                  Reset
                </Button>
                <Button onClick={() => submit()}>
                  <Upload className="w-4 h-4 mr-2" />
                  Create
                </Button>
              </div>
            </div>

            {/* meta */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-sm">G.R No</label>
                <Input
                  value={form.grNo || ""}
                  onChange={(e) =>
                    dispatchForm({
                      type: "set",
                      payload: { grNo: e.target.value },
                    })
                  }
                />
              </div>

              <div>
                <label className="text-sm">Work Order (optional)</label>
                <Select
                  value={form.workOrderId ?? NONE}
                  onValueChange={async (v) => {
                    const id = v === NONE ? null : v;
                    if (!id) {
                      dispatchForm({
                        type: "set",
                        payload: { workOrderId: null, items: [] },
                      });
                      return;
                    }
                    const doc = await fetchWorkOrder(id);
                    if (!doc) return toast.error("WO not found");
                    const items = (doc.items || []).map((it: any) => ({
                      itemType: it.itemType,
                      itemId:
                        typeof it.itemId === "string"
                          ? it.itemId
                          : (it.itemId as any)?._id || String(it.itemId),
                      receivedQty: 0,
                      unit: it.unit || "",
                      unitPrice: it.unitPrice ?? 0,
                      remarks: "",
                    }));
                    dispatchForm({
                      type: "set",
                      payload: {
                        workOrderId: id,
                        supplier:
                          typeof doc.supplier === "string"
                            ? doc.supplier
                            : (doc.supplier && (doc.supplier as any)._id) || "",
                        warehouseOrFactory:
                          typeof doc.warehouseOrFactory === "string"
                            ? doc.warehouseOrFactory
                            : (doc.warehouseOrFactory &&
                                (doc.warehouseOrFactory as any)._id) ||
                              "",
                        items,
                      },
                    });
                    await loadGrsForWo(id);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Link to Work Order (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>-- None --</SelectItem>
                    {workOrders.map((w) => (
                      <SelectItem key={w._id} value={w._id}>
                        {w.workOrderNo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm">Date</label>
                <Input
                  type="date"
                  value={form.date || ""}
                  onChange={(e) =>
                    dispatchForm({
                      type: "set",
                      payload: { date: e.target.value },
                    })
                  }
                />
              </div>
            </div>

            {/* supplier / warehouse */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm">Supplier</label>
                <Select
                  value={form.supplier || NONE}
                  onValueChange={(v) =>
                    dispatchForm({
                      type: "set",
                      payload: { supplier: v === NONE ? "" : v },
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>-- Select --</SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s._id} value={s._id}>
                        {s.supplierName || s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm">Warehouse / Factory</label>
                <Select
                  value={form.warehouseOrFactory || NONE}
                  onValueChange={(v) =>
                    dispatchForm({
                      type: "set",
                      payload: { warehouseOrFactory: v === NONE ? "" : v },
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>-- Select --</SelectItem>
                    {warehouses.map((w) => (
                      <SelectItem key={w._id} value={w._id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* items table */}
            <div className="border rounded p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold">Items (received)</div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      dispatchForm({
                        type: "pushItem",
                        payload: {
                          itemType: "RawMaterial",
                          itemId: "",
                          receivedQty: 0,
                          unit: "",
                          unitPrice: 0,
                          remarks: "",
                        },
                      })
                    }
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add
                  </Button>
                  <SearchSelect
                    endpoint="/raw-materials"
                    placeholder="Add raw material..."
                    onSelect={(id) => id && addProduct("RawMaterial", id)}
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full table-auto border-collapse">
                  <thead>
                    <tr>
                      <th className="p-2 border-b">#</th>
                      <th className="p-2 border-b">Item</th>
                      <th className="p-2 border-b text-right">Qty</th>
                      <th className="p-2 border-b">Unit</th>
                      <th className="p-2 border-b">Unit Price</th>
                      <th className="p-2 border-b">Remarks</th>
                      <th className="p-2 border-b">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.items.map((it, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-2 align-top">{idx + 1}</td>
                        <td className="p-2 align-top">
                          {it.itemId ? (
                            productCache[it.itemId]?.name || it.itemId
                          ) : (
                            <SearchSelect
                              endpoint={
                                it.itemType === "RawMaterial"
                                  ? "/raw-materials"
                                  : "/packaging-items"
                              }
                              placeholder="Search product"
                              onSelect={async (id, full) => {
                                if (!id) return;
                                try {
                                  const ep =
                                    it.itemType === "RawMaterial"
                                      ? "/raw-materials"
                                      : "/packaging-items";
                                  const r = await api.get(`${ep}/${id}`);
                                  productCache[id] = r.data.data;
                                  dispatchForm({
                                    type: "setItem",
                                    payload: {
                                      idx,
                                      patch: {
                                        itemId: id,
                                        unit: r.data.data?.unit || it.unit,
                                        unitPrice:
                                          r.data.data?.purchasePrice ??
                                          it.unitPrice,
                                      },
                                    },
                                  });
                                } catch {
                                  toast.error("Load failed");
                                }
                              }}
                            />
                          )}
                        </td>
                        <td className="p-2 align-top text-right">
                          <Input
                            type="number"
                            min={0}
                            className="w-24"
                            value={String(it.receivedQty || "")}
                            onChange={(e) =>
                              dispatchForm({
                                type: "setItem",
                                payload: {
                                  idx,
                                  patch: {
                                    receivedQty: Number(e.target.value || 0),
                                  },
                                },
                              })
                            }
                          />
                        </td>
                        <td className="p-2 align-top">
                          <Input
                            value={it.unit || ""}
                            onChange={(e) =>
                              dispatchForm({
                                type: "setItem",
                                payload: {
                                  idx,
                                  patch: { unit: e.target.value },
                                },
                              })
                            }
                            className="w-28"
                          />
                        </td>
                        <td className="p-2 align-top">
                          <Input
                            type="number"
                            min={0}
                            className="w-28"
                            value={String(it.unitPrice ?? "")}
                            onChange={(e) =>
                              dispatchForm({
                                type: "setItem",
                                payload: {
                                  idx,
                                  patch: {
                                    unitPrice: Number(e.target.value || 0),
                                  },
                                },
                              })
                            }
                          />
                        </td>
                        <td className="p-2 align-top">
                          <Input
                            value={it.remarks || ""}
                            onChange={(e) =>
                              dispatchForm({
                                type: "setItem",
                                payload: {
                                  idx,
                                  patch: { remarks: e.target.value },
                                },
                              })
                            }
                          />
                        </td>
                        <td className="p-2 align-top">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              dispatchForm({ type: "removeItem", payload: idx })
                            }
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* warnings */}
              <div className="mt-3">
                {form.workOrderId ? (
                  woWarnings.warnings.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      All items within WO requested qty (based on approved GRs).
                    </div>
                  ) : (
                    <div className="text-sm text-red-600 whitespace-pre-wrap">
                      Warning — these will exceed:{"\n"}
                      {woWarnings.warnings.join("\n")}
                    </div>
                  )
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Not linked to a WO — standalone GR.
                  </div>
                )}
              </div>
            </div>

            {/* attachments & notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm">Attachments</label>
                <input
                  type="file"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    dispatchForm({
                      type: "setAttachments",
                      payload: [...(form.attachments || []), ...files],
                    });
                  }}
                />
                <div className="mt-2 space-y-2">
                  {(form.attachments || []).map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between bg-gray-50 p-2 rounded"
                    >
                      <div>{f.name}</div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          dispatchForm({
                            type: "setAttachments",
                            payload: (form.attachments || []).filter(
                              (_, j) => j !== i,
                            ),
                          })
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm">Notes</label>
                <textarea
                  value={form.notes || ""}
                  onChange={(e) =>
                    dispatchForm({
                      type: "set",
                      payload: { notes: e.target.value },
                    })
                  }
                  className="w-full border rounded p-2 min-h-[80px]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setOpenCreate(false);
                  dispatchForm({ type: "reset" });
                }}
              >
                Cancel
              </Button>
              <Button onClick={() => submit()}>
                <Upload className="w-4 h-4 mr-2" />
                Create G.R
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment dialog (compact) */}
      <Dialog open={!!payFor} onOpenChange={() => setPayFor(null)}>
        <DialogContent className="!w-full !max-w-[30rem] p-0 rounded-xl shadow-2xl bg-background border">
          {payFor && (
            <div className="p-6">
              <h3 className="text-lg font-bold">Add Payment — {payFor.grNo}</h3>
              <div className="mt-3">
                <label className="text-sm">Amount</label>
                <Input id="p_amt" type="number" min={0} />
              </div>
              <div className="mt-3">
                <label className="text-sm">Date</label>
                <Input
                  id="p_date"
                  type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                />
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="ghost" onClick={() => setPayFor(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    const a =
                      (
                        document.getElementById(
                          "p_amt",
                        ) as HTMLInputElement | null
                      )?.value || "0";
                    const d = (
                      document.getElementById(
                        "p_date",
                      ) as HTMLInputElement | null
                    )?.value;
                    pay(payFor._id, Number(a), d);
                  }}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Add
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
