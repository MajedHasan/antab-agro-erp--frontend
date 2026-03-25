"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
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
import { Eye, Check, X, Trash2, Search, Download, Plus } from "lucide-react";
import { toast } from "sonner";

/* ============================
   Types
   ============================ */
type Supplier = {
  _id: string;
  supplierName?: string;
  name?: string;
  address?: string;
};
type Warehouse = { _id: string; name?: string; address?: string };

type WorkOrderItem = {
  _id?: string;
  itemType: "RawMaterial" | "PackagingItem";
  itemId: any;
  quantity: number;
  unit?: string;
  remarks?: string;
  transportCost?: number;
  transportNotes?: string;
  // may be included by backend/enrichment:
  receivedQty?: number;
  remainingQty?: number;
};

type WorkOrder = {
  _id: string;
  workOrderNo?: string;
  supplier?: any;
  warehouseOrFactory?: any;
  items?: WorkOrderItem[];
  issueDate?: string;
};

type ItemOption = { _id: string; name: string; unit?: string };

type CreateItem = {
  workOrderItemId?: string;
  itemType: "RawMaterial" | "PackagingItem";
  itemId: string;
  itemName?: string;
  expectedQty: number;
  remainingQty: number;
  receivedQty: number;
  unit?: string;
  remarks?: string;
  transportCost?: number;
  transportPaymentSource?: "Pending" | "Factory";
  transportNotes?: string;
};

type GR = {
  _id?: string;
  grNo?: string;
  workOrderId?: any;
  supplier?: string | Supplier;
  warehouseOrFactory?: string | Warehouse;
  date?: string;
  items?: Array<{
    itemType: string;
    itemId: string;
    workOrderItemId?: string;
    receivedQty: number;
    unit?: string;
    remarks?: string;
    itemName?: string;
    transportCost?: number;
    transportPaymentSource?: string;
    transportNotes?: string;
  }>;
  attachments?: Array<{ _id?: string; originalName?: string; url?: string }>;
  notes?: string;
  transportationNotes?: string;
  status?: "Pending" | "Approved" | "Rejected";
  rejectReason?: string;
};

/* ============================
   Helpers & constants
   ============================ */
const today = () => new Date().toISOString().slice(0, 10);
const currency = (n?: number) =>
  typeof n === "number" ? Number(n).toFixed(2) : "-";
const debounce = <T extends (...args: any[]) => void>(fn: T, wait = 250) => {
  let t: any;
  return (...a: any[]) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), wait);
  };
};

/* ============================
   AsyncSelect (preload & search)
   ============================ */
function AsyncSelect({
  endpoint,
  value,
  onChange,
  labelKey = (d: any) => d.name || d.supplierName || d.workOrderNo || d._id,
  placeholder = "Select...",
  params = {},
}: {
  endpoint: string;
  value?: string;
  onChange: (id: string | null) => void;
  labelKey?: (d: any) => string;
  placeholder?: string;
  params?: any;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const load = useCallback(
    debounce(async (qv: string) => {
      setLoading(true);
      try {
        const p = { ...params, q: qv, limit: 50 };
        const res = await api.get(endpoint, { params: p });
        setItems(res.data.data || []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 300),
    [endpoint, JSON.stringify(params)],
  );

  // preload selected
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!value) return;
      if (items.find((it) => String(it._id) === String(value))) return;
      try {
        const res = await api.get(`${endpoint}/${value}`);
        if (!mounted) return;
        const obj = res?.data?.data ?? res?.data ?? null;
        if (obj)
          setItems((prev) =>
            prev.find((p) => String(p._id) === String(obj._id))
              ? prev
              : [obj, ...prev],
          );
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, endpoint]);

  useEffect(() => {
    if (open) load(q);
  }, [open, q, load]);

  const selected = items.find((it) => String(it._id) === String(value)) ?? null;

  return (
    <div ref={ref} className="relative">
      <div
        className="border rounded-md px-3 py-2 flex items-center justify-between cursor-pointer min-h-[44px] bg-white"
        onClick={() => {
          setOpen((s) => !s);
          setQ("");
          load("");
        }}
      >
        <div className="text-sm text-slate-700">
          {selected ? (
            labelKey(selected)
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {selected ? "" : "▼"}
        </div>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border rounded shadow max-h-80 overflow-auto">
          <div className="p-2">
            <Input
              placeholder="Search..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {loading && (
            <div className="p-2 text-sm text-muted-foreground">
              Searching...
            </div>
          )}
          {!loading && items.length === 0 && (
            <div className="p-3 text-sm text-muted-foreground">No results</div>
          )}
          {!loading &&
            items.map((it: any) => (
              <div
                key={it._id}
                className="px-3 py-2 hover:bg-gray-50 cursor-pointer"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(it._id);
                  setOpen(false);
                }}
              >
                <div className="font-medium">{labelKey(it)}</div>
                <div className="text-xs text-muted-foreground">
                  {(it.address || it.unit || "").toString()}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function AsyncSelectWrapper({
  name,
  value,
  onSelect,
}: {
  name: "supplier" | "warehouse";
  value?: string;
  onSelect: (v: string | null) => void;
}) {
  if (name === "supplier")
    return (
      <AsyncSelect
        endpoint="/supplier"
        value={value}
        onChange={onSelect}
        labelKey={(d: any) => d.supplierName || d.name}
        placeholder="Search supplier..."
      />
    );
  return (
    <AsyncSelect
      endpoint="/warehouses"
      value={value}
      onChange={onSelect}
      labelKey={(d: any) => d.name}
      placeholder="Search factory..."
    />
  );
}

/* ============================
   Main Component
   ============================ */
export default function GoodsReceiptPage() {
  /* --- lists --- */
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [rawMap, setRawMap] = useState<Map<string, ItemOption>>(new Map());
  const [packMap, setPackMap] = useState<Map<string, ItemOption>>(new Map());

  /* --- GR list --- */
  const [grs, setGrs] = useState<GR[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /* --- create modal state --- */
  const [createOpen, setCreateOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState<{
    workOrderId?: string;
    supplier?: string;
    warehouseOrFactory?: string;
    date?: string;
    notes?: string;
    transportationNotes?: string;
    items: CreateItem[];
  }>({ items: [], date: today() });

  const [viewing, setViewing] = useState<GR | null>(null);
  const [rejectState, setRejectState] = useState<{
    id?: string;
    reason?: string;
  } | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  /* ---------------------------
     preload lists (one shot)
     --------------------------- */
  useEffect(() => {
    (async () => {
      try {
        const [sRes, wRes, rmRes, pkRes, woRes] = await Promise.all([
          api
            .get("/supplier", { params: { limit: 1000 } })
            .catch(() => ({ data: { data: [] } })),
          api
            .get("/warehouses", { params: { limit: 1000 } })
            .catch(() => ({ data: { data: [] } })),
          api
            .get("/raw-materials", { params: { limit: 2000 } })
            .catch(() => ({ data: { data: [] } })),
          api
            .get("/packaging-items", { params: { limit: 2000 } })
            .catch(() => ({ data: { data: [] } })),
          api
            .get("/workorders", { params: { limit: 1000, status: "Approved" } })
            .catch(() => ({ data: { data: [] } })),
        ]);

        setSuppliers(sRes.data.data || []);
        setWarehouses(wRes.data.data || []);
        setWorkOrders(woRes.data.data || []);

        const rm = (rmRes.data.data || []).reduce(
          (m: Map<string, ItemOption>, r: any) =>
            m.set(r._id, { _id: r._id, name: r.name, unit: r.unit }),
          new Map(),
        );
        const pk = (pkRes.data.data || []).reduce(
          (m: Map<string, ItemOption>, p: any) =>
            m.set(p._id, { _id: p._id, name: p.name, unit: p.unit }),
          new Map(),
        );

        setRawMap(rm);
        setPackMap(pk);
      } catch (err) {
        console.warn("initial preload failed", err);
      }
    })();
  }, []);

  /* ---------------------------
     load GRs
     --------------------------- */
  const loadGRs = useCallback(
    async (opts?: { page?: number }) => {
      setLoading(true);
      try {
        const params: any = { page: opts?.page ?? page, limit };
        if (q) params.q = q;
        const f: any = {};
        if (filterStatus) f.status = filterStatus;
        if (Object.keys(f).length) params.filter = JSON.stringify(f);
        const res = await api.get("/grs", { params });
        setGrs(res.data.data || []);
        setTotal(res.data.total || 0);
      } catch {
        toast.error("Failed to load G.Rs");
      } finally {
        setLoading(false);
      }
    },
    [page, limit, q, filterStatus],
  );

  useEffect(() => {
    void loadGRs({ page });
  }, [loadGRs, page, limit, q, filterStatus]);

  /* ---------------------------
     maps & resolvers (memoized)
     --------------------------- */
  const supplierMap = useMemo(
    () => new Map(suppliers.map((s) => [s._id, s])),
    [suppliers],
  );
  const warehouseMap = useMemo(
    () => new Map(warehouses.map((w) => [w._id, w])),
    [warehouses],
  );

  const resolveItemName = useCallback(
    (it: { itemType?: string; itemId?: string; itemName?: string }) => {
      return (
        it.itemName ||
        (it.itemType === "RawMaterial"
          ? rawMap.get(it.itemId || "")?.name
          : packMap.get(it.itemId || "")?.name) ||
        String(it.itemId)
      );
    },
    [rawMap, packMap],
  );

  /* ---------------------------
     preload selected Work Order -> items (compute remaining by summing existing GRs)
     --------------------------- */
  const preloadWorkOrder = useCallback(async (id?: string) => {
    if (!id) return;
    try {
      const [r, grRes] = await Promise.all([
        api.get(`/workorders/${id}`),
        // fetch related GRs to compute already received quantities
        api
          .get("/grs", { params: { workOrderId: id, limit: 1000 } })
          .catch(() => ({ data: { data: [] } })),
      ]);

      const wo: WorkOrder = r.data.data;
      const grList: GR[] = grRes?.data?.data || [];

      // build map: workOrderItemId -> sum(receivedQty)
      const receivedMap = new Map<string, number>();
      for (const gr of grList) {
        for (const item of gr.items || []) {
          const key = String(item.workOrderItemId ?? item.itemId ?? "");
          const prev = receivedMap.get(key) || 0;
          receivedMap.set(key, prev + Number(item.receivedQty || 0));
        }
      }

      const items = (wo.items || []).map((it: any) => {
        const key = String(it._id ?? it.itemId ?? "");
        const alreadyReceived = receivedMap.get(key) || 0;
        const expected = Number(it.quantity ?? 0);
        const remaining = Math.max(0, expected - alreadyReceived);

        return {
          workOrderItemId: it._id || undefined,
          itemType: it.itemType,
          itemId: it.itemId?._id || it.itemId,
          itemName: it.itemId?.name || undefined,
          expectedQty: expected,
          remainingQty: remaining,
          receivedQty: 0, // user input (Receive Now)
          unit: it.unit || "",
          remarks: it.remarks || "",
          transportCost: it.transportCost ? Number(it.transportCost) : 0,
          transportPaymentSource: "Pending" as "Pending" | "Factory",
          transportNotes: it.transportNotes || "",
        } as CreateItem;
      }) as CreateItem[];

      setForm((prev) => ({
        ...(prev || {}),
        workOrderId: wo._id,
        supplier: wo.supplier?._id || wo.supplier,
        warehouseOrFactory: wo.warehouseOrFactory?._id || wo.warehouseOrFactory,
        date: wo.issueDate
          ? new Date(wo.issueDate).toISOString().slice(0, 10)
          : today(),
        items,
      }));
    } catch (err) {
      console.error("preloadWorkOrder error", err);
      toast.error("Failed to load Work Order");
    }
  }, []);

  /* ---------------------------
     update item (no add/remove)
     - removed clamp: user can enter any Receive Now qty per your request
     --------------------------- */
  const updateItem = useCallback((i: number, patch: Partial<CreateItem>) => {
    setForm((f) => {
      if (!f) return f;
      const items = (f.items || []).map((it, idx) => {
        if (idx !== i) return it;
        const merged: CreateItem = { ...(it || {}), ...patch } as any;

        // auto set payment source if transportCost entered
        if (patch.transportCost !== undefined) {
          const cost = Number(patch.transportCost || 0);
          merged.transportPaymentSource = cost > 0 ? "Factory" : "Pending";
        }

        // ensure non-negative numeric fields
        if (merged.transportCost && merged.transportCost < 0)
          merged.transportCost = 0;
        if (merged.receivedQty && merged.receivedQty < 0)
          merged.receivedQty = 0;

        // no clamping to remainingQty (user requested)
        return merged;
      });
      return { ...f, items };
    });
  }, []);

  /* ---------------------------
     file helpers
     --------------------------- */
  const pushFiles = useCallback((fl?: FileList | null) => {
    if (!fl) return;
    setFiles((prev) => [...prev, ...Array.from(fl)]);
  }, []);
  const removeFile = useCallback(
    (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i)),
    [],
  );

  /* ---------------------------
     totals
     --------------------------- */
  const totals = useMemo(() => {
    const totalExpected = (form.items || []).reduce(
      (s, it) => s + Number(it.expectedQty || 0),
      0,
    );
    const totalReceived = (form.items || []).reduce(
      (s, it) => s + Number(it.receivedQty || 0),
      0,
    );
    const totalTransport = (form.items || []).reduce(
      (s, it) => s + Number(it.transportCost || 0),
      0,
    );
    return { totalExpected, totalReceived, totalTransport };
  }, [form.items]);

  /* ---------------------------
     submit create
     --------------------------- */
  const submitCreate = useCallback(async () => {
    if (!form) return;
    try {
      if (!form.workOrderId) return toast.error("Select a Work Order");
      if (!form.supplier) return toast.error("Select supplier");
      if (!form.warehouseOrFactory) return toast.error("Select factory");
      if (!form.items || form.items.length === 0)
        return toast.error("No items found in the selected Work Order");

      for (const it of form.items) {
        if (!it.itemId) return toast.error("Invalid product in Work Order");
        if (it.expectedQty <= 0)
          return toast.error("Expected quantity must be greater than 0");
        if (it.receivedQty < 0)
          return toast.error("Received quantity cannot be negative");
        if (it.transportCost && it.transportCost < 0)
          return toast.error("Transport cost cannot be negative");
      }

      if (!files || files.length === 0)
        return toast.error("Please upload at least one Chalan file");

      const payload = {
        workOrderId: String(form.workOrderId),
        supplier: String(form.supplier),
        warehouseOrFactory: String(form.warehouseOrFactory),
        date: form.date || today(),
        notes: form.notes || "",
        transportationNotes: form.transportationNotes || "",
        items: form.items.map((it) => ({
          workOrderItemId: it.workOrderItemId
            ? String(it.workOrderItemId)
            : undefined,
          itemType: it.itemType,
          itemId: String(it.itemId),
          receivedQty: Number(it.receivedQty || 0),
          unit: it.unit || "",
          remarks: it.remarks || "",
          transportCost: Number(it.transportCost || 0),
          transportPaymentSource:
            it.transportCost && Number(it.transportCost) > 0
              ? "Factory"
              : "Pending",
          transportNotes: it.transportNotes || "",
        })),
      };

      const res = await api.post("/grs", payload);
      const grId = res?.data?.data?._id;

      if (grId) {
        for (const f of files) {
          const fd = new FormData();
          fd.append("file", f, f.name);
          const up = await api.post("/media/upload?module=gr&folder=gr", fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          const mediaId = up?.data?.data?._id;
          if (mediaId) {
            await api.post(`/grs/${grId}/attach-file`, { fileId: mediaId });
          }
        }
      }

      toast.success("G.R created successfully");
      setCreateOpen(false);
      setForm({ items: [], date: today() });
      setFiles([]);
      void loadGRs({ page: 1 });
    } catch (err: any) {
      console.error("GR creation error", err);
      toast.error(err?.response?.data?.message || "Create failed");
    }
  }, [form, files, loadGRs]);

  /* ---------------------------
     view / approve / reject / pay
     --------------------------- */
  const openView = useCallback(async (id: string) => {
    try {
      const r = await api.get(`/grs/${id}`);
      setViewing(r.data.data);
    } catch {
      toast.error("Failed to load G.R");
    }
  }, []);

  const approve = useCallback(
    async (id?: string) => {
      if (!id) return;
      if (!confirm("Approve this G.R? This will update stock and WO progress."))
        return;
      try {
        await api.post(`/grs/${id}/approve`);
        toast.success("Approved");
        if (viewing && viewing._id === id) await openView(id);
        void loadGRs();
      } catch (err: any) {
        console.error("approve error", err);
        toast.error(err?.response?.data?.message || "Approve failed");
      }
    },
    [viewing, openView, loadGRs],
  );

  const openReject = useCallback(
    (id: string) => setRejectState({ id, reason: "" }),
    [],
  );
  const submitReject = useCallback(async () => {
    if (!rejectState?.id) return;
    if (!rejectState.reason || !rejectState.reason.trim())
      return toast.error("Reason required");
    try {
      await api.post(`/grs/${rejectState.id}/reject`, {
        reason: rejectState.reason.trim(),
      });
      toast.success("Rejected");
      setRejectState(null);
      if (viewing && viewing._id === rejectState.id)
        await openView(rejectState.id);
      void loadGRs();
    } catch {
      toast.error("Reject failed");
    }
  }, [rejectState, viewing, openView, loadGRs]);

  const addPayment = useCallback(
    async (grId: string, amount: number) => {
      if (!confirm(`Add payment of ${amount}?`)) return;
      try {
        await api.post(`/grs/${grId}/pay`, { amount });
        toast.success("Payment recorded");
        void loadGRs();
        if (viewing && viewing._id === grId) await openView(grId);
      } catch {
        toast.error("Payment failed");
      }
    },
    [viewing, loadGRs, openView],
  );

  /* ---------------------------
     UI
     --------------------------- */
  return (
    <div className="p-6 space-y-6">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Goods Receipts Notes</h2>
          <div className="text-sm text-muted-foreground">
            Create, review and approve G.R.N.s
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center border rounded-md px-3 py-2 gap-2 bg-white">
            <Search className="w-4 h-4 text-gray-500" />
            <Input
              placeholder="Search GR#, supplier..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-64"
            />
          </div>

          <Select
            value={filterStatus ?? "none"}
            onValueChange={(v) => setFilterStatus(v === "none" ? null : v)}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">All</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Approved">Approved</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>

          <Button
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={() => {
              setForm({ items: [], date: today() });
              setCreateOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" /> Create G.R.N
          </Button>
        </div>
      </div>

      {/* table of GRs */}
      <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
        <div className="p-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>G.R No</TableHead>
                <TableHead>WO</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-56">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {grs.map((g, i) => (
                <TableRow key={g._id || i}>
                  <TableCell>{(page - 1) * limit + i + 1}</TableCell>
                  <TableCell>{g.grNo || g._id}</TableCell>
                  <TableCell>
                    {g.workOrderId &&
                      (typeof g.workOrderId === "object"
                        ? (g.workOrderId as any).workOrderNo
                        : g.workOrderId)}
                  </TableCell>
                  <TableCell>
                    {typeof g.supplier === "string"
                      ? supplierMap.get(g.supplier)?.supplierName || "-"
                      : (g.supplier as any)?.supplierName ||
                        (g.supplier as any)?.name ||
                        "-"}
                  </TableCell>
                  <TableCell>
                    {g.date ? new Date(g.date).toLocaleDateString() : "-"}
                  </TableCell>
                  <TableCell>
                    {g.status ? (
                      <span
                        className={`px-2 py-1 rounded text-white text-sm ${g.status === "Approved" ? "bg-green-600" : g.status === "Pending" ? "bg-blue-600" : "bg-red-600"}`}
                      >
                        {g.status}
                      </span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openView(String(g._id))}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {g.status === "Pending" && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => approve(String(g._id))}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => openReject(String(g._id))}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {grs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6">
                    {loading ? "Loading..." : "No records"}
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

      {/* Create modal */}
      <Dialog open={createOpen} onOpenChange={() => setCreateOpen(false)}>
        <DialogContent className="!w-[94vw] !max-w-[1200px] !h-[88vh] p-0 rounded-xl bg-transparent">
          <div className="flex h-full bg-white rounded-xl overflow-hidden shadow">
            {/* left: form */}
            <div className="w-2/3 p-6 overflow-auto space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">
                    Create Goods Receipt Notes
                  </h3>
                  <div className="text-sm text-muted-foreground">
                    Work Order required. Products auto-populate from selected
                    Work Order. Remaining is computed from previous G.R.s.
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                    Close
                  </Button>
                  <Button
                    onClick={() => void submitCreate()}
                    className="bg-green-600 text-white"
                  >
                    Create G.R.N
                  </Button>
                </div>
              </div>

              {/* Info */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-3">
                  <div>
                    <label className="block text-sm mb-1">Work Order *</label>
                    <Select
                      value={form.workOrderId || ""}
                      onValueChange={(v) => void preloadWorkOrder(v)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {workOrders.map((w) => (
                          <SelectItem key={w._id} value={w._id}>
                            {w.workOrderNo || w._id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!form.workOrderId && (
                      <div className="text-xs text-red-600 mt-1">
                        Work Order required
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm mb-1">Supplier</label>
                      <AsyncSelectWrapper
                        name="supplier"
                        value={form.supplier}
                        onSelect={(v) =>
                          setForm((p) => ({ ...(p || {}), supplier: v || "" }))
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-sm mb-1">Factory</label>
                      <AsyncSelectWrapper
                        name="warehouse"
                        value={form.warehouseOrFactory}
                        onSelect={(v) =>
                          setForm((p) => ({
                            ...(p || {}),
                            warehouseOrFactory: v || "",
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm mb-1">G.R Date</label>
                      <Input
                        type="date"
                        value={form.date || ""}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...(p || {}),
                            date: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Notes</label>
                      <Input
                        value={form.notes || ""}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...(p || {}),
                            notes: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm mb-1">
                      Transportation Notes (GR level)
                    </label>
                    <Input
                      value={form.transportationNotes || ""}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...(p || {}),
                          transportationNotes: e.target.value,
                        }))
                      }
                      placeholder="Overall transport notes (optional)"
                    />
                  </div>
                </div>

                {/* right summary */}
                <div className="bg-gray-50 p-4 rounded-md h-full">
                  <div className="text-sm text-muted-foreground">Preview</div>
                  <div className="mt-2 text-sm">
                    <div className="font-medium">
                      {supplierMap.get(form.supplier || "")?.supplierName ||
                        "-"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {warehouseMap.get(form.warehouseOrFactory || "")?.name ||
                        "-"}
                    </div>
                    <div className="mt-3">
                      <div className="text-xs text-muted-foreground">Date</div>
                      <div className="font-semibold">{form.date}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Items table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold">Items</div>
                  <div className="text-sm text-muted-foreground">
                    Products populated from selected Work Order
                  </div>
                </div>

                <div className="border rounded-md overflow-auto">
                  <table className="w-full table-auto">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="p-3 text-left">#</th>
                        <th className="p-3 text-left">Product</th>
                        <th className="p-3 text-right">
                          {/* Expected */}
                          W.O. QTY <br />
                          <span className="text-xs">(kg/ltr/pcs)</span>
                        </th>
                        <th className="p-3 text-right">
                          Remaining <br />
                          <span className="text-xs">(kg/ltr/pcs)</span>
                        </th>
                        <th className="p-3 text-right">
                          Receive Now <br />
                          <span className="text-xs">(kg/ltr/pcs)</span>
                        </th>
                        <th className="p-3 text-right">
                          Transport <br />
                          <span className="text-xs">(tk)</span>
                        </th>
                        <th className="p-3 text-left">Transport Notes</th>
                      </tr>
                    </thead>

                    <tbody>
                      {(form.items || []).map((it, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-3 align-top w-8">{idx + 1}</td>

                          <td className="p-3 align-top">
                            <div className="font-medium">
                              {resolveItemName(it)}
                            </div>
                            {it.unit ? (
                              <div className="text-xs text-muted-foreground">
                                Unit: {it.unit}
                              </div>
                            ) : null}
                            {(it.remainingQty ?? 0) <= 0 && (
                              <div className="text-xs text-green-600 mt-1">
                                Completed
                              </div>
                            )}
                          </td>

                          <td className="p-3 text-right align-top">
                            <div className="w-24 text-right font-medium">
                              {it.expectedQty}
                            </div>
                          </td>

                          <td className="p-3 text-right align-top">
                            <div className="w-24 text-right">
                              {it.remainingQty ?? it.expectedQty}
                            </div>
                          </td>

                          <td className="p-3 text-right align-top">
                            <input
                              type="number"
                              min={0}
                              value={String(it.receivedQty ?? "")}
                              onChange={(e) =>
                                updateItem(idx, {
                                  receivedQty: Number(e.target.value) || 0,
                                })
                              }
                              className="w-28 border rounded px-2 py-1 text-right"
                            />
                          </td>

                          <td className="p-3 text-right align-top">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={it.transportCost ?? ""}
                              onChange={(e) =>
                                updateItem(idx, {
                                  transportCost: Number(e.target.value) || 0,
                                })
                              }
                              className="w-28 border rounded px-2 py-1 text-right"
                            />
                          </td>

                          <td className="p-3 align-top">
                            <input
                              type="text"
                              value={it.transportNotes || ""}
                              onChange={(e) =>
                                updateItem(idx, {
                                  transportNotes: e.target.value,
                                })
                              }
                              placeholder="optional notes"
                              className="border rounded px-2 py-1 w-full"
                            />
                          </td>
                        </tr>
                      ))}

                      {(form.items || []).length === 0 && (
                        <tr>
                          <td
                            colSpan={7}
                            className="p-4 text-sm text-muted-foreground"
                          >
                            No items — select a Work Order to load products
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* attachments & review */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm">Attachments</label>
                  <div
                    onDrop={(e) => {
                      e.preventDefault();
                      pushFiles(e.dataTransfer.files);
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    className="mt-2 p-4 border-dashed border rounded text-center cursor-pointer"
                    onClick={() => fileRef.current?.click()}
                  >
                    <div className="text-sm">
                      Drag & drop files or click to browse
                    </div>
                    <input
                      ref={fileRef}
                      className="hidden"
                      type="file"
                      multiple
                      onChange={(e) => pushFiles(e.target.files)}
                    />
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-3">
                    {files.map((f, i) => {
                      const isImage = f.type.startsWith("image/");
                      const url = URL.createObjectURL(f);
                      return (
                        <div
                          key={i}
                          className="border rounded p-2 flex items-start gap-2"
                        >
                          <div className="w-14 h-14 bg-gray-50 flex items-center justify-center">
                            {isImage ? (
                              <img
                                src={url}
                                alt={f.name}
                                className="max-w-full max-h-full"
                              />
                            ) : (
                              <div className="text-xs text-muted-foreground">
                                {f.name}
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-sm">{f.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {(f.size / 1024).toFixed(1)} KB
                            </div>
                          </div>
                          <div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeFile(i)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    {files.length === 0 && (
                      <div className="text-sm text-muted-foreground">
                        No files attached
                      </div>
                    )}
                  </div>
                </div>

                <div className="border rounded p-3">
                  <div className="text-sm font-semibold mb-2">Review</div>
                  <div className="text-sm">
                    Supplier:{" "}
                    {supplierMap.get(form.supplier || "")?.supplierName || "-"}
                  </div>
                  <div className="text-sm">
                    Factory:{" "}
                    {warehouseMap.get(form.warehouseOrFactory || "")?.name ||
                      "-"}
                  </div>
                  <div className="text-sm">
                    Items: {(form.items || []).length}
                  </div>
                  <div className="text-sm mt-2">
                    Transport Total:{" "}
                    <span className="font-semibold ml-2">
                      {currency(totals.totalTransport)}
                    </span>
                  </div>
                  <div className="mt-2 text-sm">
                    <div className="font-semibold">Transportation Notes</div>
                    <div className="text-muted-foreground">
                      {form.transportationNotes || "-"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* right: live preview */}
            <div className="w-1/3 p-6 bg-gray-50 border-l overflow-auto">
              <div className="sticky top-6">
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="text-lg font-bold">Company</div>
                      <div className="text-xs text-muted-foreground">
                        address
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">
                        G.R Preview
                      </div>
                      <div className="text-lg font-semibold">
                        {form.workOrderId
                          ? `WO ${String(form.workOrderId).slice(0, 8)}`
                          : "New"}
                      </div>
                      <div className="text-sm">{form.date}</div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="text-xs text-muted-foreground">
                      Supplier
                    </div>
                    <div className="font-medium">
                      {supplierMap.get(form.supplier || "")?.supplierName ||
                        "-"}
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="text-xs text-muted-foreground">Factory</div>
                    <div className="font-medium">
                      {warehouseMap.get(form.warehouseOrFactory || "")?.name ||
                        "-"}
                    </div>
                  </div>

                  <div className="overflow-auto max-h-52 mb-3">
                    <table className="w-full table-auto">
                      <thead>
                        <tr>
                          <th className="text-left text-xs text-muted-foreground">
                            Item
                          </th>
                          <th className="text-right text-xs text-muted-foreground">
                            Expected
                          </th>
                          <th className="text-right text-xs text-muted-foreground">
                            Remaining
                          </th>
                          <th className="text-right text-xs text-muted-foreground">
                            Receive
                          </th>
                          <th className="text-right text-xs text-muted-foreground">
                            Transport
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(form.items || []).map((it, idx) => (
                          <tr key={idx}>
                            <td className="py-2 text-sm">
                              {it.itemName ||
                                (it.itemType === "RawMaterial"
                                  ? rawMap.get(it.itemId)?.name
                                  : packMap.get(it.itemId)?.name) ||
                                it.itemId}
                            </td>
                            <td className="py-2 text-sm text-right">
                              {it.expectedQty}
                            </td>
                            <td className="py-2 text-sm text-right">
                              {it.remainingQty}
                            </td>
                            <td className="py-2 text-sm text-right">
                              {it.receivedQty}
                            </td>
                            <td className="py-2 text-sm text-right">
                              {it.transportCost != null
                                ? currency(it.transportCost)
                                : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="border-t pt-3">
                    <div className="flex justify-between">
                      <div className="text-sm text-muted-foreground">
                        Total Expected
                      </div>
                      <div className="font-semibold">
                        {totals.totalExpected}
                      </div>
                    </div>
                    <div className="flex justify-between mt-1">
                      <div className="text-sm text-muted-foreground">
                        Total Receive Now
                      </div>
                      <div className="font-semibold">
                        {totals.totalReceived}
                      </div>
                    </div>
                    <div className="flex justify-between mt-1">
                      <div className="text-sm text-muted-foreground">
                        Total Transport
                      </div>
                      <div className="font-semibold">
                        {currency(totals.totalTransport)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="text-sm font-semibold">Notes</div>
                    <div className="text-sm text-muted-foreground">
                      {form.notes || "-"}
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="text-sm font-semibold">
                      Transportation Notes
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {form.transportationNotes || "-"}
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => setCreateOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => void submitCreate()}
                      className="bg-green-600 text-white"
                    >
                      Create G.R.N
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* view modal */}
      <Dialog open={!!viewing} onOpenChange={() => setViewing(null)}>
        <DialogContent className="!w-[90vw] !max-w-[1000px] p-0">
          {viewing && (
            <div className="p-6 bg-white rounded-lg">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold">Goods Receipt</h3>
                  <div className="text-sm text-muted-foreground">
                    {viewing.grNo || viewing._id}
                  </div>
                </div>

                <div className="flex gap-2 items-center">
                  <div className="mr-2">
                    <span
                      className={`px-2 py-1 rounded text-white text-sm ${viewing.status === "Approved" ? "bg-green-600" : viewing.status === "Pending" ? "bg-blue-600" : "bg-red-600"}`}
                    >
                      {viewing.status}
                    </span>
                  </div>
                  <Button variant="ghost" onClick={() => setViewing(null)}>
                    Close
                  </Button>
                  {viewing.status === "Pending" && (
                    <Button onClick={() => approve(String(viewing._id))}>
                      <Check className="w-4 h-4" /> Approve
                    </Button>
                  )}
                  {viewing.status === "Pending" && (
                    <Button
                      variant="destructive"
                      onClick={() => openReject(String(viewing._id))}
                    >
                      <X className="w-4 h-4" /> Reject
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <div className="text-sm text-muted-foreground">Supplier</div>
                  <div className="font-medium">
                    {typeof viewing.supplier === "string"
                      ? supplierMap.get(viewing.supplier)?.supplierName ||
                        viewing.supplier
                      : (viewing.supplier as any)?.supplierName ||
                        (viewing.supplier as any)?.name}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Factory</div>
                  <div className="font-medium">
                    {typeof viewing.warehouseOrFactory === "string"
                      ? warehouseMap.get(viewing.warehouseOrFactory)?.name ||
                        viewing.warehouseOrFactory
                      : (viewing.warehouseOrFactory as any)?.name}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Date</div>
                  <div className="font-medium">
                    {viewing.date
                      ? new Date(viewing.date).toLocaleDateString()
                      : "-"}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto mb-4">
                <table className="w-full table-auto">
                  <thead>
                    <tr>
                      <th className="p-2 border-b text-left">#</th>
                      <th className="p-2 border-b text-left">Item</th>
                      <th className="p-2 border-b text-right">
                        Qty (received)
                      </th>
                      <th className="p-2 border-b">Unit</th>
                      <th className="p-2 border-b">Remarks</th>
                      <th className="p-2 border-b text-right">Transport</th>
                      <th className="p-2 border-b">Transport Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(viewing.items || []).map((it, idx) => (
                      <tr key={idx}>
                        <td className="p-2">{idx + 1}</td>
                        <td className="p-2 font-medium">
                          {resolveItemName(it)}
                        </td>
                        <td className="p-2 text-right">{it.receivedQty}</td>
                        <td className="p-2">{it.unit || "-"}</td>
                        <td className="p-2">{it.remarks || "-"}</td>
                        <td className="p-2 text-right">
                          {it.transportCost != null
                            ? currency(Number(it.transportCost))
                            : "-"}
                        </td>
                        <td className="p-2">{it.transportNotes || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="font-semibold mb-2">Attachments</div>
                  <div className="space-y-2">
                    {(viewing.attachments || []).length ? (
                      viewing.attachments!.map((a, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between"
                        >
                          <div>
                            <img
                              src={a.url}
                              alt={a.originalName}
                              className="max-w-[120px] max-h-[80px]"
                            />
                          </div>
                          <div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => window.open(a.url || "", "_blank")}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        No attachments
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  {viewing.rejectReason && (
                    <div className="mb-2">
                      <div className="font-semibold">Reject Reason</div>
                      <div className="text-sm text-red-600">
                        {viewing.rejectReason}
                      </div>
                    </div>
                  )}
                  <div className="font-semibold mb-2">Notes</div>
                  <div className="text-sm mb-3">{viewing.notes || "-"}</div>
                  <div className="font-semibold mb-2">Transportation Notes</div>
                  <div className="text-sm">
                    {viewing.transportationNotes || "-"}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <Button onClick={() => setViewing(null)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* reject modal */}
      <Dialog open={!!rejectState} onOpenChange={() => setRejectState(null)}>
        <DialogContent className="!w-[520px]">
          <div className="p-4">
            <h3 className="text-lg font-semibold">Reject G.R</h3>
            <div className="mt-2">
              <label className="text-sm">Reason</label>
              <textarea
                className="w-full border rounded p-2 min-h-[120px]"
                value={rejectState?.reason || ""}
                onChange={(e) =>
                  setRejectState((s) =>
                    s
                      ? { ...s, reason: e.target.value }
                      : { id: "", reason: e.target.value },
                  )
                }
              />
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <Button variant="ghost" onClick={() => setRejectState(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => submitReject()}>
                Reject
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
