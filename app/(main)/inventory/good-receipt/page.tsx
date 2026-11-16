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
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Eye,
  Check,
  X,
  Search,
  Download,
  Plus,
  CreditCard,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Inbox,
  Banknote,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FilterX,
  RefreshCw,
  Building2,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

import Protected from "@/components/auth/Protected";
import usePermissionCheck from "@/hooks/usePermissionCheck";

/* =========================== Types =========================== */
type ItemType =
  | "RawMaterial"
  | "PackagingItem"
  | "FinishedProduct"
  | "OtherProducts";

type Supplier = {
  _id: string;
  supplierName?: string;
  name?: string;
  address?: string;
};

type Warehouse = {
  _id: string;
  name?: string;
  address?: string;
  type?: string;
};

type ItemOption = { _id: string; name: string; unit?: string };

type WorkOrderItem = {
  _id?: string;
  itemType: "RawMaterial" | "PackagingItem" | "Product" | "OtherProducts";
  itemId: any;
  quantity: number;
  unit?: string;
  remarks?: string;
  transportCost?: number;
  transportNotes?: string;
  receivedQty?: number;
};

type WorkOrder = {
  _id: string;
  workOrderNo?: string;
  supplier?: any;
  warehouseOrFactory?: any;
  items?: WorkOrderItem[];
  issueDate?: string;
  status?: string;
};

type ReceiptLine = {
  workOrderItemId?: string;
  itemType: ItemType;
  itemId: string;
  itemName?: string;
  workOrderUnit: string;
  inventoryUnit: string;
  expectedQty: number;
  remainingQty: number;
  receiveQty: number;
  conversionFactor: number;
  inventoryQty: number;
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
  issueDate?: string;
  items?: Array<{
    itemType: string;
    itemId: string;
    workOrderItemId?: string;
    receivedQty: number;
    inventoryQty?: number;
    workOrderUnit?: string;
    inventoryUnit?: string;
    conversionFactor?: number;
    convertedQty?: number;
    unit?: string;
    unitPrice?: number;
    remarks?: string;
    itemName?: string;
    transportCost?: number;
    transportPaymentSource?: string;
    transportNotes?: string;
    lineTotal?: number;
    transportVoucherId?: string;
  }>;
  attachments?: Array<{
    _id?: string;
    originalName?: string;
    url?: string;
    name?: string;
    /* ✅ FIX: added optional backend fields used by view dialog */
    mimeType?: string;
    size?: number;
  }>;
  notes?: string;
  transportationNotes?: string;
  status?: "Pending" | "Approved" | "Rejected";
  rejectReason?: string;
  paymentStatus?: "Unpaid" | "Partial" | "Paid";
  paidAmount?: number;
  remainingAmount?: number;
  grandTotal?: number;
};

/* =========================== Constants =========================== */
const ITEM_SOURCES: Record<
  ItemType | "Product",
  { endpoint: string; label: string }
> = {
  RawMaterial: { endpoint: "/raw-materials", label: "Raw Material" },
  PackagingItem: { endpoint: "/packaging-items", label: "Packaging Item" },
  Product: { endpoint: "/products", label: "Product" },
  FinishedProduct: { endpoint: "/products", label: "Finished Product" },
  OtherProducts: { endpoint: "/other-products", label: "Other Product" },
};

const today = () => new Date().toISOString().slice(0, 10);

/* =========================== Helpers =========================== */
const n = (v: any) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

const round = (v: number) => Math.round(v * 10000) / 10000;

const fmt = (v?: number) =>
  typeof v === "number" && Number.isFinite(v) ? Number(v).toFixed(2) : "-";

const qtyFmt = (v?: number) =>
  typeof v === "number" && Number.isFinite(v) ? String(round(v)) : "-";

const normalizeType = (t?: string): ItemType => {
  switch (t) {
    case "RawMaterial":
      return "RawMaterial";
    case "PackagingItem":
      return "PackagingItem";
    case "Product":
    case "FinishedProduct":
      return "FinishedProduct";
    case "OtherProduct":
    case "OtherProducts":
      return "OtherProducts";
    default:
      return "RawMaterial";
  }
};

const u = (s?: string) => (s || "").trim().toUpperCase();

const sameUnit = (a?: string, b?: string) => u(a) === u(b);

const getEntityName = (entity: any, defaultValue: string): string => {
  if (!entity) return defaultValue;
  if (typeof entity === "string") return entity;
  return entity.supplierName || entity.name || defaultValue;
};

const suggestFactor = (from?: string, to?: string) => {
  const k = `${u(from)}->${u(to)}`;
  const map: Record<string, number> = {
    "KG->G": 1000,
    "G->KG": 0.001,
    "LTR->ML": 1000,
    "ML->LTR": 0.001,
    "TON->KG": 1000,
    "KG->TON": 0.001,
    "PCS->BOX": 1,
    "BOX->PCS": 1,
  };
  return map[k] ?? 1;
};

const buildMap = (arr: any[]) =>
  new Map(
    arr.map((x: any) => [
      String(x._id),
      {
        _id: String(x._id),
        name: x.name || x.supplierName || x.workOrderNo || String(x._id),
        unit: x.unit,
      } as ItemOption,
    ]),
  );

const toLine = (p: Partial<ReceiptLine>): ReceiptLine => {
  const workOrderUnit = p.workOrderUnit || "";
  const inventoryUnit = p.inventoryUnit || workOrderUnit || "";
  const receiveQty = Math.max(0, n(p.receiveQty));
  const conversionFactor = sameUnit(workOrderUnit, inventoryUnit)
    ? 1
    : n(p.conversionFactor) > 0
      ? n(p.conversionFactor)
      : suggestFactor(workOrderUnit, inventoryUnit);

  return {
    workOrderItemId: p.workOrderItemId,
    itemType: normalizeType(p.itemType),
    itemId: String(p.itemId || ""),
    itemName: p.itemName || "",
    workOrderUnit,
    inventoryUnit,
    expectedQty: Math.max(0, n(p.expectedQty)),
    remainingQty: Math.max(0, n(p.remainingQty)),
    receiveQty,
    conversionFactor,
    inventoryQty: round(receiveQty * conversionFactor),
    unit: p.unit || inventoryUnit || workOrderUnit,
    remarks: p.remarks || "",
    transportCost: Math.max(0, n(p.transportCost)),
    transportPaymentSource: n(p.transportCost) > 0 ? "Factory" : "Pending",
    transportNotes: p.transportNotes || "",
  };
};

function getPaginationRange(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, 4, "...", total];
  if (current >= total - 2)
    return [1, "...", total - 3, total - 2, total - 1, total];
  return [1, "...", current - 1, current, current + 1, "...", total];
}

/* =========================== Status meta =========================== */
const STATUS_META: Record<
  string,
  { label: string; icon: React.ElementType; tone: string; dot: string }
> = {
  Pending: {
    label: "Pending",
    icon: Clock,
    tone:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200",
    dot: "bg-amber-500",
  },
  Approved: {
    label: "Approved",
    icon: CheckCircle2,
    tone:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200",
    dot: "bg-emerald-500",
  },
  Rejected: {
    label: "Rejected",
    icon: XCircle,
    tone:
      "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200",
    dot: "bg-rose-500",
  },
  Paid: {
    label: "Paid",
    icon: CheckCircle2,
    tone:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200",
    dot: "bg-emerald-500",
  },
  Partial: {
    label: "Partial",
    icon: Clock,
    tone:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200",
    dot: "bg-amber-500",
  },
  Unpaid: {
    label: "Unpaid",
    icon: XCircle,
    tone:
      "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200",
    dot: "bg-rose-500",
  },
};

function getMeta(value?: string) {
  return (
    STATUS_META[value || ""] || {
      label: value || "-",
      icon: Clock,
      tone:
        "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200",
      dot: "bg-slate-400",
    }
  );
}

function Badge({ value }: { value?: string }) {
  if (!value) return <span className="text-xs text-slate-400">-</span>;
  const meta = getMeta(value);
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${meta.tone}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

/* =========================== Debounce hook =========================== */
function useDebounced<T>(value: T, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

/* =========================== AsyncSelect =========================== */
function AsyncSelect({
  endpoint,
  value,
  onChange,
  labelKey = (d: any) => d.name || d.supplierName || d.workOrderNo || d._id,
  placeholder = "Select...",
}: {
  endpoint: string;
  value?: string;
  onChange: (id: string | null) => void;
  labelKey?: (d: any) => string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const load = useCallback(
    async (query = "") => {
      setLoading(true);
      try {
        const res = await api.get(endpoint, {
          params: { q: query, limit: 50 },
        });
        setItems(res.data.data || []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [endpoint],
  );

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => void load(q), 250);
    return () => clearTimeout(t);
  }, [open, q, load]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!value) return;
      if (items.some((it) => String(it._id) === String(value))) return;
      try {
        const res = await api.get(`${endpoint}/${value}`);
        if (!mounted) return;
        const obj = res?.data?.data ?? res?.data ?? null;
        if (obj) {
          setItems((prev) =>
            prev.some((p) => String(p._id) === String(obj._id))
              ? prev
              : [obj, ...prev],
          );
        }
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, [value, endpoint, items]);

  const selected = items.find((it) => String(it._id) === String(value)) ?? null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((s) => !s);
          setQ("");
          void load("");
        }}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 text-left text-sm outline-none transition-colors hover:border-slate-300 focus:border-[#3aa838]/40 focus:ring-2 focus:ring-[#3aa838]/10 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
      >
        <span className={selected ? "text-slate-900 dark:text-white" : "text-slate-400"}>
          {selected ? labelKey(selected) : placeholder}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 max-h-80 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
          <div className="p-2">
            <Input
              placeholder="Search..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-9"
            />
          </div>
          {loading && (
            <div className="flex items-center gap-2 p-3 text-xs text-slate-500 dark:text-slate-400">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Searching...
            </div>
          )}
          {!loading && items.length === 0 && (
            <div className="p-3 text-xs text-slate-500 dark:text-slate-400">
              No results
            </div>
          )}
          {!loading &&
            items.map((it: any) => (
              <button
                key={it._id}
                type="button"
                className="block w-full border-t border-slate-100 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(it._id);
                  setOpen(false);
                }}
              >
                <div className="font-medium text-slate-900 dark:text-white">
                  {labelKey(it)}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {(it.address || it.unit || "").toString()}
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

/* =========================== ConversionBox =========================== */
function ConversionBox({
  line,
  onChange,
}: {
  line: ReceiptLine;
  onChange: (patch: Partial<ReceiptLine>) => void;
}) {
  if (sameUnit(line.workOrderUnit, line.inventoryUnit)) return null;

  const suggested = suggestFactor(line.workOrderUnit, line.inventoryUnit);

  return (
    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/60 dark:bg-amber-950/30">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-200">
        <AlertTriangle className="h-3.5 w-3.5" />
        Unit mismatch — set conversion factor
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm dark:bg-slate-900">
          <span className="font-semibold">1</span>
          <span className="font-medium">{line.workOrderUnit || "WO unit"}</span>
          <span className="text-slate-400">=</span>
        </div>
        <div>
          <Input
            type="number"
            min={0}
            step="0.0001"
            value={line.conversionFactor}
            onChange={(e) =>
              onChange({
                conversionFactor: Number(e.target.value) || 0,
                inventoryQty: round(
                  line.receiveQty * (Number(e.target.value) || 0),
                ),
              })
            }
            className="h-9 bg-white dark:bg-slate-900"
          />
        </div>
        <div className="flex items-center justify-between gap-2 rounded-md bg-white px-3 py-2 text-sm dark:bg-slate-900">
          <span className="font-medium">
            {line.inventoryUnit || "inventory unit"}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onChange({
                conversionFactor: suggested,
                inventoryQty: round(line.receiveQty * suggested),
              })
            }
            className="h-7 text-[11px]"
          >
            Suggest
          </Button>
        </div>
      </div>
    </div>
  );
}

/* =========================== Stat card =========================== */
function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  hint: string;
}) {
  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#3aa838]/10 text-[#2f8a2f] dark:bg-[#3aa838]/15 dark:text-[#9bdd91]">
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <div className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
        {value}
      </div>
      <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">{hint}</p>
    </div>
  );
}

/* =========================== Page (Protected) =========================== */
export default function GoodsReceiptPage() {
  return (
    <Protected
      permissions={[
        "goodreceipt.view",
        "goodreceipt.create",
        "goodreceipt.edit",
        "goodreceipt.delete",
      ]}
    >
      <GoodsReceiptPageInner />
    </Protected>
  );
}

/* =========================== Inner =========================== */
function GoodsReceiptPageInner() {
  const hasAccess = usePermissionCheck();
  const canCreate = hasAccess({ permissions: "goodreceipt.create" });
  const canEdit = hasAccess({ permissions: "goodreceipt.edit" });

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [itemMaps, setItemMaps] = useState<
    Record<ItemType | "Product", Map<string, ItemOption>>
  >({
    RawMaterial: new Map(),
    PackagingItem: new Map(),
    Product: new Map(),
    FinishedProduct: new Map(),
    OtherProducts: new Map(),
  });

  const [grs, setGrs] = useState<GR[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q, 300);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const emptyForm = useCallback(
    () => ({
      workOrderId: "",
      supplier: "",
      warehouseOrFactory: "",
      date: today(),
      notes: "",
      transportationNotes: "",
      items: [] as ReceiptLine[],
    }),
    [],
  );

  const [form, setForm] = useState(emptyForm());
  const [viewing, setViewing] = useState<GR | null>(null);
  const [rejectState, setRejectState] = useState<{
    id?: string;
    reason?: string;
  } | null>(null);
  const [payAmount, setPayAmount] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const supplierMap = useMemo(
    () => new Map(suppliers.map((s) => [s._id, s])),
    [suppliers],
  );
  const warehouseMap = useMemo(
    () => new Map(warehouses.map((w) => [w._id, w])),
    [warehouses],
  );
  const workOrderMap = useMemo(
    () => new Map(workOrders.map((w) => [w._id, w])),
    [workOrders],
  );

  const selectedWO = useMemo(
    () => (form.workOrderId ? workOrderMap.get(form.workOrderId) : undefined),
    [form.workOrderId, workOrderMap],
  );

  const viewingWorkOrderItems = useMemo(() => {
    const wo = viewing?.workOrderId;
    return typeof wo === "object" && Array.isArray(wo.items) ? wo.items : [];
  }, [viewing]);

  const findViewingWorkOrderItem = useCallback(
    (grItem: any) => {
      const id = String(grItem?.workOrderItemId || "");
      if (!id) return null;
      return (
        viewingWorkOrderItems.find((w: any) => String(w._id) === id) || null
      );
    },
    [viewingWorkOrderItems],
  );

  const formatConversionText = useCallback((it: any) => {
    const woUnit = it.workOrderUnit || it.unit || "";
    const invUnit = it.inventoryUnit || it.unit || "";
    if (sameUnit(woUnit, invUnit)) return "Same unit";
    const factor = n(it.conversionFactor || 1);
    return `1 ${woUnit || "WO unit"} = ${round(factor)} ${
      invUnit || "inventory unit"
    }`;
  }, []);

  const filePreviews = useMemo(
    () => files.map((f) => ({ file: f, url: URL.createObjectURL(f) })),
    [files],
  );

  useEffect(() => {
    return () => filePreviews.forEach((p) => URL.revokeObjectURL(p.url));
  }, [filePreviews]);

  useEffect(() => {
    (async () => {
      try {
        const [sRes, wRes, rmRes, pkRes, fpRes, opRes, woRes] =
          await Promise.all([
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
              .get("/products", { params: { limit: 2000 } })
              .catch(() => ({ data: { data: [] } })),
            api
              .get("/other-products", { params: { limit: 2000 } })
              .catch(() => ({ data: { data: [] } })),
            api
              .get("/workorders", {
                params: {
                  limit: 500,
                  status: "Approved",
                },
              })
              .catch(() => ({ data: { data: [] } })),
          ]);

        setSuppliers(sRes.data.data || []);
        setWarehouses(wRes.data.data || []);
        setWorkOrders(woRes.data.data || []);
        setItemMaps({
          RawMaterial: buildMap(rmRes.data.data || []),
          PackagingItem: buildMap(pkRes.data.data || []),
          Product: buildMap(fpRes.data.data || []),
          FinishedProduct: buildMap(fpRes.data.data || []),
          OtherProducts: buildMap(opRes.data.data || []),
        });
      } catch (err) {
        console.warn("preload failed", err);
      }
    })();
  }, []);

  const ITEM_TYPE_MAP: Record<string, string> = {
    RawMaterial: "RawMaterial",
    PackagingItem: "PackagingItem",
    Product: "Product",
    FinishedProduct: "Product",
    OtherProducts: "OtherProducts",
  };

  const resolveItem = useCallback(
    (type?: string, id?: string) =>
      itemMaps[normalizeType(type)].get(String(id || "")),
    [itemMaps],
  );

  const resolveItemName = useCallback(
    (it: { itemType?: string; itemId?: string; itemName?: string }) =>
      it.itemName ||
      resolveItem(it.itemType, it.itemId)?.name ||
      String(it.itemId || "-"),
    [resolveItem],
  );

  const loadGRs = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit };
      if (debouncedQ) params.q = debouncedQ;
      if (filterStatus)
        params.filter = JSON.stringify({ status: filterStatus });

      const res = await api.get("/grs", { params });
      setGrs(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch {
      toast.error("Failed to load G.R.s");
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedQ, filterStatus]);

  useEffect(() => {
    void loadGRs();
  }, [loadGRs]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, filterStatus, limit]);

  const preloadWorkOrder = useCallback(
    async (id?: string) => {
      if (!id) return;
      try {
        const [woRes, grRes] = await Promise.all([
          api.get(`/workorders/${id}`),
          api
            .get("/grs", {
              params: {
                limit: 1000,
                filter: JSON.stringify({ workOrderId: id }),
              },
            })
            .catch(() => ({ data: { data: [] } })),
        ]);

        const wo: WorkOrder = woRes.data.data;
        const grList: GR[] = grRes?.data?.data || [];

        const receivedMap = new Map<string, number>();
        for (const gr of grList) {
          for (const item of gr.items || []) {
            const key = String(item.workOrderItemId || item.itemId || "");
            receivedMap.set(
              key,
              (receivedMap.get(key) || 0) + n(item.receivedQty),
            );
          }
        }

        const items = (wo.items || []).map((it: any) => {
          const type = normalizeType(it.itemType);
          const itemId = String(
            (it.itemId && it.itemId._id) || it.itemId || "",
          );
          const itemName =
            (it.itemId && it.itemId.name) ||
            resolveItem(type, itemId)?.name ||
            itemId;
          const workOrderUnit = (it.itemId && it.itemId.unit) || it.unit || "";
          const inventoryUnit =
            resolveItem(type, itemId)?.unit || workOrderUnit || "";
          const expectedQty = n(it.quantity);
          const alreadyReceived =
            receivedMap.get(String(it._id || itemId)) || n(it.receivedQty);
          const remainingQty = Math.max(0, expectedQty - alreadyReceived);
          const factor = sameUnit(workOrderUnit, inventoryUnit)
            ? 1
            : suggestFactor(workOrderUnit, inventoryUnit);

          return toLine({
            workOrderItemId: it._id,
            itemType: type,
            itemId,
            itemName,
            workOrderUnit,
            inventoryUnit,
            expectedQty,
            remainingQty,
            receiveQty: 0,
            conversionFactor: factor,
            inventoryQty: 0,
            unit: inventoryUnit || workOrderUnit,
            remarks: it.remarks || "",
            transportCost: n(it.transportCost),
            transportPaymentSource:
              n(it.transportCost) > 0 ? "Factory" : "Pending",
            transportNotes: it.transportNotes || "",
          });
        });

        setForm((prev) => ({
          ...prev,
          workOrderId: wo._id,
          supplier: wo.supplier?._id || wo.supplier || "",
          warehouseOrFactory:
            wo.warehouseOrFactory?._id || wo.warehouseOrFactory || "",
          date: wo.issueDate
            ? new Date(wo.issueDate).toISOString().slice(0, 10)
            : today(),
          items,
        }));
      } catch (err) {
        console.error(err);
        toast.error("Failed to load Work Order");
      }
    },
    [resolveItem],
  );

  const updateLine = useCallback(
    (index: number, patch: Partial<ReceiptLine>) => {
      setForm((prev) => {
        const items = prev.items.map((it, i) => {
          if (i !== index) return it;
          return toLine({ ...it, ...patch });
        });
        return { ...prev, items };
      });
    },
    [],
  );

  const totals = useMemo(
    () => ({
      woQty: form.items.reduce((s, it) => s + n(it.receiveQty), 0),
      inventoryQty: form.items.reduce((s, it) => s + n(it.inventoryQty), 0),
      transport: form.items.reduce((s, it) => s + n(it.transportCost), 0),
    }),
    [form.items],
  );

  const resetCreate = useCallback(() => {
    setForm(emptyForm());
    setFiles([]);
    setCreateOpen(false);
  }, [emptyForm]);

  const pushFiles = useCallback((fl?: FileList | null) => {
    if (!fl) return;
    setFiles((prev) => [...prev, ...Array.from(fl)]);
  }, []);

  const removeFile = useCallback(
    (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i)),
    [],
  );

  const submitCreate = useCallback(async () => {
    try {
      if (!form.workOrderId) return toast.error("Select a Work Order");
      if (!form.supplier) return toast.error("Select supplier");
      if (!form.warehouseOrFactory) return toast.error("Select factory");
      if (!form.items.length)
        return toast.error("No items found in the selected Work Order");
      if (!files.length)
        return toast.error("Please upload at least one Chalan file");

      for (const it of form.items) {
        if (!it.itemId) return toast.error("Invalid item in Work Order");
        if (it.expectedQty <= 0)
          return toast.error("Expected quantity must be greater than 0");
        if (it.receiveQty < 0)
          return toast.error("Received quantity cannot be negative");
        if (it.transportCost && it.transportCost < 0)
          return toast.error("Transport cost cannot be negative");
        if (
          !sameUnit(it.workOrderUnit, it.inventoryUnit) &&
          n(it.conversionFactor) <= 0
        ) {
          return toast.error(
            `Conversion factor required for ${it.itemName || it.itemId}`,
          );
        }
      }

      const payload = {
        workOrderId: String(form.workOrderId),
        supplier: String(form.supplier),
        warehouseOrFactory: String(form.warehouseOrFactory),
        issueDate: form.date || today(),
        notes: form.notes || "",
        transportationNotes: form.transportationNotes || "",
        items: form.items.map((it) => ({
          workOrderItemId: it.workOrderItemId
            ? String(it.workOrderItemId)
            : undefined,
          itemType: ITEM_TYPE_MAP[it.itemType] || it.itemType,
          itemId: String(it.itemId),
          receivedQty: n(it.receiveQty),
          inventoryQty: n(it.inventoryQty),
          unit: it.inventoryUnit || it.workOrderUnit || "",
          remarks: it.remarks || "",
          transportCost: n(it.transportCost),
          transportPaymentSource:
            n(it.transportCost) > 0 ? "Factory" : "Pending",
          transportNotes: it.transportNotes || "",
          conversionFactor: n(it.conversionFactor),
          workOrderUnit: it.workOrderUnit,
          inventoryUnit: it.inventoryUnit,
        })),
      };

      const res = await api.post("/grs", payload);
      const grId = res?.data?.data?._id;

      if (grId) {
        const uploaded = await Promise.all(
          files.map(async (file) => {
            try {
              const fd = new FormData();
              fd.append("file", file, file.name);
              const up = await api.post(
                "/media/upload?module=gr&folder=gr",
                fd,
                {
                  headers: { "Content-Type": "multipart/form-data" },
                },
              );
              return up?.data?.data?._id || null;
            } catch {
              return null;
            }
          }),
        );

        await Promise.all(
          uploaded
            .filter(Boolean)
            .map((fileId) => api.post(`/grs/${grId}/attach-file`, { fileId })),
        );
      }

      toast.success("G.R created successfully");
      resetCreate();
      void loadGRs();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Create failed");
    }
  }, [form, files, loadGRs, resetCreate]);

  const openView = useCallback(async (id: string) => {
    try {
      const r = await api.get(`/grs/${id}`);
      setViewing(r.data.data);
      setPayAmount("");
    } catch {
      toast.error("Failed to load G.R");
    }
  }, []);

  const approve = useCallback(
    async (id?: string) => {
      if (!id) return;
      if (
        !confirm(
          "Approve this G.R? This will update stock and Work Order progress.",
        )
      )
        return;
      try {
        await api.post(`/grs/${id}/approve`);
        toast.success("Approved");
        if (viewing && viewing._id === id) await openView(id);
        void loadGRs();
      } catch (err: any) {
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
    if (!rejectState.reason?.trim()) return toast.error("Reason required");
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

  const submitPayment = useCallback(
    async (grId: string) => {
      const amount = n(payAmount);
      if (amount <= 0) return toast.error("Enter a valid payment amount");
      if (!confirm(`Add payment of ${fmt(amount)}?`)) return;
      try {
        await api.post(`/grs/${grId}/pay`, { amount });
        toast.success("Payment recorded");
        setPayAmount("");
        void loadGRs();
        if (viewing && viewing._id === grId) await openView(grId);
      } catch {
        toast.error("Payment failed");
      }
    },
    [payAmount, loadGRs, openView, viewing],
  );

  /* Stats for hero cards */
  const stats = useMemo(() => {
    const pending = grs.filter((g) => g.status === "Pending").length;
    const approved = grs.filter((g) => g.status === "Approved").length;
    const value = grs.reduce((s, g) => s + Number(g.grandTotal || 0), 0);
    return { pending, approved, value };
  }, [grs]);

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
                  <Building2 className="h-2.5 w-2.5" />
                  Operations
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-[#3aa838]/30 bg-[#3aa838]/5 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#2f8a2f] dark:border-[#3aa838]/30 dark:bg-[#3aa838]/10 dark:text-[#9bdd91]">
                  Goods Receipts
                </span>
              </div>

              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white md:text-3xl">
                Goods Receipt Notes
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                Create, review and approve G.R.N.s. Stock is updated on
                approval and linked to Work Order progress.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadGRs}
                disabled={loading}
                className="h-9 gap-1.5"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
              {(q || filterStatus) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setQ("");
                    setFilterStatus(null);
                  }}
                  className="h-9 gap-1.5"
                >
                  <FilterX className="h-3.5 w-3.5" />
                  Clear
                </Button>
              )}
              {canCreate && (
                <Button
                  size="sm"
                  onClick={() => {
                    setForm(emptyForm());
                    setFiles([]);
                    setCreateOpen(true);
                  }}
                  className="h-9 gap-1.5 bg-[#3aa838] text-white shadow-sm shadow-[#3aa838]/20 hover:bg-[#2f8a2f]"
                >
                  <Plus className="h-4 w-4" />
                  Create G.R.N
                </Button>
              )}
            </div>
          </div>

          {/* Stat cards */}
          <div className="relative mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={Inbox}
              label="Visible"
              value={grs.length}
              hint={`${total} total records`}
            />
            <StatCard
              icon={Clock}
              label="Pending"
              value={stats.pending}
              hint="Awaiting approval"
            />
            <StatCard
              icon={CheckCircle2}
              label="Approved"
              value={stats.approved}
              hint="Stock updated"
            />
            <StatCard
              icon={Banknote}
              label="Visible Value"
              value={`৳${stats.value.toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}`}
              hint="On this page"
            />
          </div>
        </div>

        {/* ============ FILTERS ============ */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Status tabs */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { key: null, label: "All" },
                { key: "Pending", label: "Pending" },
                { key: "Approved", label: "Approved" },
                { key: "Rejected", label: "Rejected" },
              ].map((tab) => {
                const active = filterStatus === tab.key;
                return (
                  <button
                    key={tab.key ?? "all"}
                    type="button"
                    onClick={() => setFilterStatus(tab.key)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      active
                        ? "bg-[#3aa838] text-white shadow-sm shadow-[#3aa838]/20"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Search */}
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search GR#, status…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="h-9 pl-9"
              />
            </div>
          </div>
        </div>

        {/* ============ TABLE ============ */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 bg-slate-50/80 hover:bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/50">
                  <TableHead className="w-12 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    #
                  </TableHead>
                  <TableHead className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    G.R No
                  </TableHead>
                  <TableHead className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Work Order
                  </TableHead>
                  <TableHead className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Supplier
                  </TableHead>
                  <TableHead className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Date
                  </TableHead>
                  <TableHead className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Status
                  </TableHead>
                  <TableHead className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Payment
                  </TableHead>
                  <TableHead className="w-56 px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grs.map((g, i) => {
                  const supplierName =
                    typeof g.supplier === "string"
                      ? supplierMap.get(g.supplier)?.supplierName ||
                        supplierMap.get(g.supplier)?.name ||
                        g.supplier
                      : g.supplier?.supplierName || g.supplier?.name || "-";
                  const woNo =
                    g.workOrderId &&
                    (typeof g.workOrderId === "object"
                      ? g.workOrderId.workOrderNo || g.workOrderId._id
                      : g.workOrderId);
                  const initials = String(supplierName)
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((s: string) => s[0]?.toUpperCase())
                    .join("");

                  return (
                    <TableRow
                      key={g._id || i}
                      className="group border-b border-slate-100 transition-colors hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/30"
                    >
                      <TableCell className="px-4 py-3 align-middle text-xs font-medium text-slate-400">
                        {(page - 1) * limit + i + 1}
                      </TableCell>
                      <TableCell className="px-4 py-3 align-middle">
                        <button
                          type="button"
                          onClick={() => openView(String(g._id))}
                          className="text-left text-sm font-semibold text-slate-900 hover:text-[#2f8a2f] dark:text-white"
                        >
                          {g.grNo || g._id}
                        </button>
                      </TableCell>
                      <TableCell className="px-4 py-3 align-middle">
                        <div className="text-xs font-mono text-slate-600 dark:text-slate-400">
                          {woNo || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 align-middle">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#3aa838]/10 text-[10px] font-bold text-[#2f8a2f] dark:bg-[#3aa838]/15 dark:text-[#9bdd91]">
                            {initials || "?"}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-xs font-medium text-slate-900 dark:text-slate-100">
                              {supplierName}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 align-middle text-xs text-slate-600 dark:text-slate-300">
                        {g.issueDate
                          ? new Date(g.issueDate).toLocaleDateString()
                          : "-"}
                      </TableCell>
                      <TableCell className="px-4 py-3 align-middle">
                        <Badge value={g.status} />
                      </TableCell>
                      <TableCell className="px-4 py-3 align-middle">
                        {g.paymentStatus ? (
                          <Badge value={g.paymentStatus} />
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3 align-middle">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openView(String(g._id))}
                            className="h-7 gap-1 px-2 text-[11px]"
                          >
                            <Eye className="h-3 w-3" />
                            View
                          </Button>
                          {canEdit && g.status === "Pending" && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => approve(String(g._id))}
                                className="h-7 gap-1 bg-[#3aa838] px-2 text-[11px] text-white hover:bg-[#2f8a2f]"
                              >
                                <Check className="h-3 w-3" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openReject(String(g._id))}
                                className="h-7 gap-1 border-rose-200 px-2 text-[11px] text-rose-600 hover:bg-rose-50 dark:border-rose-900/60 dark:hover:bg-rose-950/30"
                              >
                                <X className="h-3 w-3" />
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {grs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-14 text-center">
                      {loading ? (
                        <div className="flex flex-col items-center gap-2 text-slate-500 dark:text-slate-400">
                          <RefreshCw className="h-5 w-5 animate-spin" />
                          <span className="text-xs">Loading G.R.s…</span>
                        </div>
                      ) : (
                        <div className="mx-auto max-w-sm">
                          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                            <FileText className="h-6 w-6 text-slate-400" />
                          </div>
                          <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
                            {q || filterStatus
                              ? "No G.R.s match your filters"
                              : "No G.R.s yet"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {q || filterStatus
                              ? "Try adjusting your search or filters."
                              : "Create your first Goods Receipt from an approved Work Order."}
                          </p>
                          {(q || filterStatus) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setQ("");
                                setFilterStatus(null);
                              }}
                              className="mt-4 h-8 gap-1.5 text-xs"
                            >
                              <FilterX className="h-3 w-3" />
                              Clear filters
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
                {[10, 15, 25, 50].map((l) => (
                  <option key={l} value={l}>
                    {l}/page
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
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
                  variant="outline"
                  size="sm"
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

      {/* ============ CREATE DIALOG ============ */}
      <Dialog
        open={createOpen}
        onOpenChange={(o) => !o && setCreateOpen(false)}
      >
        <DialogContent
          className="!w-[96vw] !max-w-[1200px] h-[92vh] p-0 gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950 flex flex-col"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">
            Create Goods Receipt Note
          </DialogTitle>
          <DialogDescription className="sr-only">
            Create a new G.R.N from an approved Work Order.
          </DialogDescription>

          <div className="flex h-full min-h-0 overflow-hidden">
            {/* LEFT — form */}
            <div className="w-2/3 min-h-0 space-y-5 overflow-y-auto bg-slate-50 p-5 dark:bg-slate-950 md:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Create Goods Receipt Note
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Select a Work Order — items load automatically.
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCreateOpen(false)}
                    className="h-8 text-xs"
                  >
                    Close
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => void submitCreate()}
                    className="h-8 gap-1 bg-[#3aa838] text-xs text-white hover:bg-[#2f8a2f]"
                  >
                    <Check className="h-3 w-3" />
                    Create G.R.N
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      Work Order <span className="text-rose-500">*</span>
                    </label>
                    <Select
                      value={form.workOrderId || ""}
                      onValueChange={(v) => void preloadWorkOrder(v)}
                    >
                      <SelectTrigger className="h-9 w-full text-sm">
                        <SelectValue placeholder="Select work order…" />
                      </SelectTrigger>
                      <SelectContent>
                        {workOrders.map((w) => (
                          <SelectItem key={w._id} value={w._id}>
                            {w.workOrderNo || w._id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Supplier <span className="text-rose-500">*</span>
                      </label>
                      <AsyncSelect
                        endpoint="/supplier"
                        value={form.supplier}
                        onChange={(v) =>
                          setForm((p) => ({ ...p, supplier: v || "" }))
                        }
                        labelKey={(d: any) => d.supplierName || d.name}
                        placeholder="Search supplier…"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Factory <span className="text-rose-500">*</span>
                      </label>
                      <AsyncSelect
                        endpoint="/warehouses"
                        value={form.warehouseOrFactory}
                        onChange={(v) =>
                          setForm((p) => ({
                            ...p,
                            warehouseOrFactory: v || "",
                          }))
                        }
                        labelKey={(d: any) => d.name}
                        placeholder="Search factory…"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        G.R Date
                      </label>
                      <Input
                        type="date"
                        value={form.date}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, date: e.target.value }))
                        }
                        className="h-9 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Notes
                      </label>
                      <Input
                        value={form.notes}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, notes: e.target.value }))
                        }
                        placeholder="Optional"
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      Transportation Notes
                    </label>
                    <Input
                      value={form.transportationNotes}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          transportationNotes: e.target.value,
                        }))
                      }
                      placeholder="Optional"
                      className="h-9 text-sm"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Preview
                  </div>
                  <div className="mt-2 space-y-2.5 text-xs">
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        Work Order
                      </div>
                      <div className="mt-0.5 font-medium text-slate-900 dark:text-white">
                        {selectedWO?.workOrderNo || form.workOrderId || "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        Supplier
                      </div>
                      <div className="mt-0.5 font-medium text-slate-900 dark:text-white">
                        {typeof form.supplier === "string"
                          ? supplierMap.get(form.supplier)?.supplierName ||
                            supplierMap.get(form.supplier)?.name ||
                            "-"
                          : getEntityName(form.supplier, "-")}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        Factory
                      </div>
                      <div className="mt-0.5 font-medium text-slate-900 dark:text-white">
                        {typeof form.warehouseOrFactory === "string"
                          ? warehouseMap.get(form.warehouseOrFactory)?.name ||
                            "-"
                          : getEntityName(form.warehouseOrFactory, "-")}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        Date
                      </div>
                      <div className="mt-0.5 font-semibold text-slate-900 dark:text-white">
                        {form.date}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Items
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Loaded from the selected Work Order
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full table-auto text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-950/60">
                      <tr>
                        {[
                          "#",
                          "Product",
                          "W.O. Qty",
                          "Remaining",
                          "Receive Now",
                          "Inventory Qty",
                          "Transport",
                          "Notes",
                        ].map((h, i) => (
                          <th
                            key={h}
                            className={`px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${
                              i >= 2 && i <= 6 ? "text-right" : "text-left"
                            }`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {form.items.map((it, idx) => {
                        const mismatch = !sameUnit(
                          it.workOrderUnit,
                          it.inventoryUnit,
                        );
                        return (
                          <React.Fragment key={`${it.itemId}-${idx}`}>
                            <tr className="border-t border-slate-100 dark:border-slate-800">
                              <td className="px-3 py-2 align-top text-[11px] text-slate-400">
                                {idx + 1}
                              </td>
                              <td className="px-3 py-2 align-top">
                                <div className="text-xs font-medium text-slate-900 dark:text-white">
                                  {resolveItemName(it)}
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                  {ITEM_SOURCES[it.itemType]?.label ||
                                    it.itemType}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  WO: {it.workOrderUnit || "-"} · Inv:{" "}
                                  {it.inventoryUnit || "-"}
                                </div>
                                {(it.remainingQty ?? 0) <= 0 && (
                                  <div className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                    <CheckCircle2 className="h-2.5 w-2.5" />
                                    Complete
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2 align-top text-right text-xs">
                                {it.expectedQty}
                              </td>
                              <td className="px-3 py-2 align-top text-right text-xs">
                                {it.remainingQty}
                              </td>
                              <td className="px-3 py-2 align-top text-right">
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.0001"
                                  value={String(it.receiveQty || "")}
                                  onChange={(e) =>
                                    updateLine(idx, {
                                      receiveQty: Number(e.target.value) || 0,
                                      inventoryQty: round(
                                        (Number(e.target.value) || 0) *
                                          (it.conversionFactor || 1),
                                      ),
                                    })
                                  }
                                  className="h-8 w-24 text-right text-xs"
                                />
                                <div className="mt-0.5 text-[10px] text-slate-400">
                                  {it.workOrderUnit || "-"}
                                </div>
                              </td>
                              <td className="px-3 py-2 align-top text-right">
                                <div className="text-xs font-semibold text-slate-900 dark:text-white">
                                  {round(it.inventoryQty)}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {it.inventoryUnit ||
                                    it.workOrderUnit ||
                                    "-"}
                                </div>
                              </td>
                              <td className="px-3 py-2 align-top text-right">
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={String(it.transportCost ?? "")}
                                  onChange={(e) =>
                                    updateLine(idx, {
                                      transportCost:
                                        Number(e.target.value) || 0,
                                    })
                                  }
                                  className="h-8 w-24 text-right text-xs"
                                />
                              </td>
                              <td className="px-3 py-2 align-top">
                                <Input
                                  type="text"
                                  value={it.transportNotes || ""}
                                  onChange={(e) =>
                                    updateLine(idx, {
                                      transportNotes: e.target.value,
                                    })
                                  }
                                  placeholder="Optional"
                                  className="h-8 text-xs"
                                />
                              </td>
                            </tr>
                            {mismatch && (
                              <tr>
                                <td colSpan={8} className="px-3 pb-3">
                                  <ConversionBox
                                    line={it}
                                    onChange={(patch) =>
                                      updateLine(idx, patch)
                                    }
                                  />
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                      {form.items.length === 0 && (
                        <tr>
                          <td
                            colSpan={8}
                            className="p-8 text-center text-xs text-slate-500 dark:text-slate-400"
                          >
                            No items — select a Work Order to load products
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Attachments */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Attachments <span className="text-rose-500">*</span>
                </label>
                <div
                  onDrop={(e) => {
                    e.preventDefault();
                    pushFiles(e.dataTransfer.files);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  className="cursor-pointer rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition-colors hover:border-[#3aa838]/40 hover:bg-[#3aa838]/5 dark:border-slate-700 dark:bg-slate-950/50"
                  onClick={() => fileRef.current?.click()}
                >
                  <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Drag & drop files or click to browse
                  </div>
                  <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                    Images or PDFs · Chalan copy required
                  </div>
                  <input
                    ref={fileRef}
                    className="hidden"
                    type="file"
                    multiple
                    onChange={(e) => pushFiles(e.target.files)}
                  />
                </div>

                {filePreviews.length > 0 ? (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {filePreviews.map((f, idx) => {
                      const isImage = f.file.type.startsWith("image/");
                      const isPdf = f.file.type === "application/pdf";

                      return (
                        <div
                          key={idx}
                          className="relative flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-center dark:border-slate-800 dark:bg-slate-950"
                        >
                          {isImage ? (
                            <img
                              src={f.url}
                              alt={f.file.name}
                              className="h-20 w-full object-contain"
                            />
                          ) : isPdf ? (
                            <div className="flex h-20 w-full items-center justify-center rounded bg-rose-50 text-[10px] font-medium text-rose-600 dark:bg-rose-950/30 dark:text-rose-300">
                              PDF
                            </div>
                          ) : (
                            <div className="flex h-20 w-full items-center justify-center rounded bg-slate-100 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              File
                            </div>
                          )}

                          <div className="mt-1 w-full truncate text-[10px] text-slate-700 dark:text-slate-300">
                            {f.file.name}
                          </div>
                          <div className="text-[9px] text-slate-400">
                            {(f.file.size / 1024).toFixed(1)} KB
                          </div>

                          <div className="mt-1 flex gap-1.5">
                            {f.url && (
                              <a
                                href={f.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] font-medium text-[#2f8a2f] hover:underline"
                              >
                                View
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => removeFile(idx)}
                              className="text-[10px] font-medium text-rose-600 hover:underline"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-2 text-[10px] text-slate-400">
                    No files attached
                  </div>
                )}
              </div>

              {/* Review */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Review
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-950/40">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Supplier
                    </div>
                    <div className="mt-0.5 font-medium text-slate-900 dark:text-white">
                      {typeof form.supplier === "string"
                        ? supplierMap.get(form.supplier)?.supplierName ||
                          supplierMap.get(form.supplier)?.name ||
                          "-"
                        : getEntityName(form.supplier, "-")}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-950/40">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Factory
                    </div>
                    <div className="mt-0.5 font-medium text-slate-900 dark:text-white">
                      {typeof form.warehouseOrFactory === "string"
                        ? warehouseMap.get(form.warehouseOrFactory)?.name ||
                          "-"
                        : getEntityName(form.warehouseOrFactory, "-")}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-950/40">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Items
                    </div>
                    <div className="mt-0.5 font-medium text-slate-900 dark:text-white">
                      {form.items.length}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-950/40">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Transport Total
                    </div>
                    <div className="mt-0.5 font-semibold text-slate-900 dark:text-white">
                      {fmt(totals.transport)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT — preview sidebar */}
            <div className="w-1/3 min-h-0 overflow-y-auto border-l border-slate-200 bg-slate-100 p-5 dark:border-slate-800 dark:bg-slate-900/40">
              <div className="sticky top-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                      Antab Agro
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      Goods Receipt Preview
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#3aa838]">
                      G.R.N
                    </div>
                    <div className="mt-0.5 text-base font-bold text-slate-900 dark:text-white">
                      {selectedWO?.workOrderNo || "New"}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      {form.date}
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2">
                  <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-950/40">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Supplier
                    </div>
                    <div className="mt-0.5 text-xs font-medium text-slate-900 dark:text-white">
                      {typeof form.supplier === "string"
                        ? supplierMap.get(form.supplier)?.supplierName ||
                          supplierMap.get(form.supplier)?.name ||
                          "-"
                        : getEntityName(form.supplier, "-")}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-950/40">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Factory
                    </div>
                    <div className="mt-0.5 text-xs font-medium text-slate-900 dark:text-white">
                      {typeof form.warehouseOrFactory === "string"
                        ? warehouseMap.get(form.warehouseOrFactory)?.name ||
                          "-"
                        : getEntityName(form.warehouseOrFactory, "-")}
                    </div>
                  </div>
                </div>

                <div className="mt-3 max-h-48 overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-950/60">
                      <tr>
                        <th className="px-2 py-1.5 text-left text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Item
                        </th>
                        <th className="px-2 py-1.5 text-right text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          WO
                        </th>
                        <th className="px-2 py-1.5 text-right text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Inv
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.items.map((it, idx) => (
                        <tr
                          key={`${it.itemId}-${idx}`}
                          className="border-t border-slate-100 dark:border-slate-800"
                        >
                          <td className="truncate px-2 py-1.5 text-[10px] text-slate-700 dark:text-slate-300">
                            {resolveItemName(it)}
                          </td>
                          <td className="px-2 py-1.5 text-right text-[10px] font-medium text-slate-900 dark:text-white">
                            {round(it.receiveQty)}
                          </td>
                          <td className="px-2 py-1.5 text-right text-[10px] font-medium text-slate-900 dark:text-white">
                            {round(it.inventoryQty)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">
                      Total Receive Now
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {round(totals.woQty)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">
                      Total Inventory Qty
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {round(totals.inventoryQty)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">
                      Transport
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {fmt(totals.transport)}
                    </span>
                  </div>
                </div>

                {form.notes && (
                  <div className="mt-3 rounded-lg bg-slate-50 p-2 dark:bg-slate-950/40">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Notes
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-600 dark:text-slate-400">
                      {form.notes}
                    </div>
                  </div>
                )}

                {form.transportationNotes && (
                  <div className="mt-2 rounded-lg bg-slate-50 p-2 dark:bg-slate-950/40">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Transportation Notes
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-600 dark:text-slate-400">
                      {form.transportationNotes}
                    </div>
                  </div>
                )}

                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCreateOpen(false)}
                    className="h-8 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => void submitCreate()}
                    className="h-8 gap-1 bg-[#3aa838] text-xs text-white hover:bg-[#2f8a2f]"
                  >
                    <Check className="h-3 w-3" />
                    Create
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============ VIEW DIALOG ============ */}
      <Dialog
        open={!!viewing}
        onOpenChange={(o) => {
          if (!o) setViewing(null);
        }}
      >
        <DialogContent
          className="!w-[92vw] !max-w-[1200px] h-[90vh] p-0 gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950 flex flex-col"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">
            G.R.N {viewing?.grNo || viewing?._id || ""}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Goods Receipt details, items, payment and attachments.
          </DialogDescription>

          {viewing && (
            <div className="flex h-full min-h-0 flex-col">
              {/* Header */}
              <div className="relative shrink-0 overflow-hidden border-b border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 px-5 py-4 text-white md:px-6">
                <div className="pointer-events-none absolute inset-0 flex items-center justify-end pr-8 opacity-[0.04]">
                  <span className="text-8xl font-black tracking-tighter">
                    GRN
                  </span>
                </div>
                <div className="relative flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300">
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5">
                        Goods Receipt
                      </span>
                      <span className="rounded-full border border-[#3aa838]/30 bg-[#3aa838]/15 px-2.5 py-0.5 text-[#9bdd91]">
                        {viewing.status || "-"}
                      </span>
                    </div>
                    <h3 className="mt-2 text-xl font-bold tracking-tight md:text-2xl">
                      {viewing.grNo || viewing._id}
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {canEdit && viewing.status === "Pending" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => approve(String(viewing._id))}
                          className="h-9 gap-1.5 bg-[#3aa838] text-white hover:bg-[#2f8a2f]"
                        >
                          <Check className="h-4 w-4" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => openReject(String(viewing._id))}
                          className="h-9 gap-1.5"
                        >
                          <X className="h-4 w-4" />
                          Reject
                        </Button>
                      </>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setViewing(null)}
                      className="h-9 gap-1.5 bg-white text-slate-900 hover:bg-slate-100"
                    >
                      <X className="h-4 w-4" />
                      Close
                    </Button>
                  </div>
                </div>
              </div>

              {/* Body — scrollable */}
              <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 p-4 dark:bg-slate-950/40 md:p-5">
                <div className="mx-auto max-w-5xl space-y-4">
                  {/* Overview */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                      <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950/40">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          Supplier
                        </div>
                        <div className="mt-0.5 text-sm font-medium text-slate-900 dark:text-white">
                          {typeof viewing.supplier === "string"
                            ? supplierMap.get(viewing.supplier)
                                ?.supplierName ||
                              supplierMap.get(viewing.supplier)?.name ||
                              viewing.supplier
                            : viewing.supplier?.supplierName ||
                              viewing.supplier?.name ||
                              "-"}
                        </div>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950/40">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          Factory
                        </div>
                        <div className="mt-0.5 text-sm font-medium text-slate-900 dark:text-white">
                          {typeof viewing.warehouseOrFactory === "string"
                            ? warehouseMap.get(viewing.warehouseOrFactory)
                                ?.name || viewing.warehouseOrFactory
                            : viewing.warehouseOrFactory?.name || "-"}
                        </div>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950/40">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          Date
                        </div>
                        <div className="mt-0.5 text-sm font-medium text-slate-900 dark:text-white">
                          {viewing.issueDate
                            ? new Date(
                                viewing.issueDate,
                              ).toLocaleDateString()
                            : "-"}
                        </div>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950/40">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          Payment
                        </div>
                        <div className="mt-1">
                          <Badge value={viewing.paymentStatus} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                    <div className="border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Items ({(viewing.items || []).length})
                      </div>
                    </div>
                    <div className="overflow-x-auto p-2">
                      <table className="w-full table-auto text-xs">
                        <thead>
                          <tr>
                            {[
                              "#",
                              "Item",
                              "WO Qty",
                              "Inv Qty",
                              "Units",
                              "Conversion",
                              "Transport",
                              "Notes",
                            ].map((h, i) => (
                              <th
                                key={h}
                                className={`px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${
                                  i >= 2 && i <= 6 ? "text-right" : "text-left"
                                }`}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(viewing.items || []).map((it, idx) => {
                            const woItem = findViewingWorkOrderItem(it);
                            const woUnit =
                              it.workOrderUnit ||
                              woItem?.unit ||
                              woItem?.itemId?.unit ||
                              it.unit ||
                              "-";
                            const invUnit =
                              it.inventoryUnit ||
                              it.unit ||
                              woItem?.itemId?.unit ||
                              woUnit ||
                              "-";
                            const isMismatch = !sameUnit(woUnit, invUnit);
                            const convFactor = n(it.conversionFactor || 1);

                            return (
                              <tr
                                key={it._id || idx}
                                className="border-t border-slate-100 dark:border-slate-800"
                              >
                                <td className="px-3 py-2 align-top text-slate-400">
                                  {idx + 1}
                                </td>
                                <td className="px-3 py-2 align-top">
                                  <div className="text-xs font-medium text-slate-900 dark:text-white">
                                    {resolveItemName(it)}
                                  </div>
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                    {ITEM_SOURCES[normalizeType(it.itemType)]
                                      ?.label || it.itemType}
                                  </div>
                                  {woItem && (
                                    <div className="mt-0.5 text-[10px] text-slate-400">
                                      Ordered: {qtyFmt(woItem.quantity)}{" "}
                                      {woItem.unit || woUnit}
                                    </div>
                                  )}
                                </td>
                                <td className="px-3 py-2 align-top text-right">
                                  <div className="text-xs">
                                    {qtyFmt(it.receivedQty)}
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    {woUnit}
                                  </div>
                                </td>
                                <td className="px-3 py-2 align-top text-right">
                                  <div className="text-xs font-semibold text-slate-900 dark:text-white">
                                    {qtyFmt(
                                      it.inventoryQty ?? it.convertedQty,
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    {invUnit}
                                  </div>
                                </td>
                                <td className="px-3 py-2 align-top">
                                  <div className="text-[10px]">
                                    WO:{" "}
                                    <span className="font-semibold">
                                      {woUnit}
                                    </span>
                                  </div>
                                  <div className="text-[10px]">
                                    Inv:{" "}
                                    <span className="font-semibold">
                                      {invUnit}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-3 py-2 align-top">
                                  {isMismatch ? (
                                    <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] dark:border-amber-900/60 dark:bg-amber-950/40">
                                      <div className="font-semibold text-amber-800 dark:text-amber-200">
                                        1 {woUnit} = {round(convFactor)} {invUnit}
                                      </div>
                                      <div className="text-amber-700 dark:text-amber-300">
                                        Qty:{" "}
                                        {qtyFmt(
                                          it.inventoryQty ?? it.convertedQty,
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-slate-400">
                                      Same unit
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2 align-top text-right text-xs">
                                  {it.transportCost != null
                                    ? fmt(Number(it.transportCost))
                                    : "-"}
                                </td>
                                <td className="px-3 py-2 align-top text-[10px] text-slate-500 dark:text-slate-400">
                                  {it.transportNotes || "-"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Attachments + Payment */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Attachments
                      </div>
                      {(viewing.attachments || []).length > 0 ? (
                        <div className="grid grid-cols-2 gap-2">
                          {(viewing.attachments || []).map((a, i) => {
                            const isImage =
                              a?.mimeType?.startsWith("image/") ||
                              /\.(jpg|jpeg|png|gif|webp)$/i.test(
                                a.url || "",
                              );
                            const isPdf =
                              a?.mimeType === "application/pdf" ||
                              /\.pdf$/i.test(a.url || "");

                            return (
                              <div
                                key={i}
                                className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-950"
                              >
                                {isImage ? (
                                  <img
                                    src={a.url}
                                    alt={a.originalName || a.name || "file"}
                                    className="h-20 w-full rounded object-contain"
                                  />
                                ) : isPdf ? (
                                  <div className="flex h-20 w-full items-center justify-center rounded bg-rose-50 text-[10px] font-medium text-rose-600 dark:bg-rose-950/30 dark:text-rose-300">
                                    PDF
                                  </div>
                                ) : (
                                  <div className="flex h-20 w-full items-center justify-center rounded bg-slate-100 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                    File
                                  </div>
                                )}
                                <div className="mt-1 truncate text-[10px] text-slate-700 dark:text-slate-300">
                                  {a.originalName || a.name || a._id}
                                </div>
                                {a.size != null && (
                                  <div className="text-[9px] text-slate-400">
                                    {(a.size / 1024).toFixed(1)} KB
                                  </div>
                                )}
                                {a.url && (
                                  <button
                                    onClick={() =>
                                      window.open(
                                        `http://localhost:5001${a.url}`,
                                        "_blank",
                                      )
                                    }
                                    className="mt-1 text-[10px] font-medium text-[#2f8a2f] hover:underline"
                                  >
                                    View
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400">
                          No attachments
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                      {viewing.rejectReason && (
                        <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 dark:border-rose-900/60 dark:bg-rose-950/40">
                          <div className="text-[9px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-300">
                            Reject Reason
                          </div>
                          <div className="mt-0.5 text-xs text-rose-700 dark:text-rose-200">
                            {viewing.rejectReason}
                          </div>
                        </div>
                      )}

                      <div>
                        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          Notes
                        </div>
                        <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                          {viewing.notes || "-"}
                        </div>
                      </div>

                      <div>
                        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          Transportation Notes
                        </div>
                        <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                          {viewing.transportationNotes || "-"}
                        </div>
                      </div>

                      <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950/40">
                        <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Payment Summary
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <div className="text-[9px] text-slate-400">
                              Grand Total
                            </div>
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {fmt(viewing.grandTotal)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[9px] text-slate-400">
                              Paid
                            </div>
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {fmt(viewing.paidAmount)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[9px] text-slate-400">
                              Remaining
                            </div>
                            <div className="font-semibold text-[#2f8a2f] dark:text-[#9bdd91]">
                              {fmt(viewing.remainingAmount)}
                            </div>
                          </div>
                        </div>

                        {canEdit &&
                          viewing.status === "Approved" &&
                          (viewing.remainingAmount ?? 0) > 0 && (
                            <div className="mt-3 space-y-2">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Add Payment
                              </div>
                              <div className="flex gap-2">
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={payAmount}
                                  onChange={(e) =>
                                    setPayAmount(e.target.value)
                                  }
                                  placeholder="Amount"
                                  className="h-8 text-xs"
                                />
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    viewing._id &&
                                    submitPayment(String(viewing._id))
                                  }
                                  className="h-8 gap-1 bg-[#3aa838] text-xs text-white hover:bg-[#2f8a2f]"
                                >
                                  <CreditCard className="h-3 w-3" />
                                  Pay
                                </Button>
                              </div>
                            </div>
                          )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ============ REJECT DIALOG ============ */}
      <Dialog
        open={!!rejectState}
        onOpenChange={(o) => {
          if (!o) setRejectState(null);
        }}
      >
        <DialogContent
          className="!w-[520px] !max-w-[95vw] p-0 gap-0 rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">Reject G.R</DialogTitle>
          <DialogDescription className="sr-only">
            Provide a reason for rejecting the G.R.
          </DialogDescription>

          <div className="border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Reject G.R
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              This action cannot be undone — the G.R will be marked rejected.
            </p>
          </div>

          <div className="px-5 py-4">
            <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              className="min-h-[120px] w-full rounded-lg border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-[#3aa838]/40 focus:ring-2 focus:ring-[#3aa838]/10 dark:border-slate-800 dark:bg-slate-900"
              value={rejectState?.reason || ""}
              onChange={(e) =>
                setRejectState((s) =>
                  s
                    ? { ...s, reason: e.target.value }
                    : { id: "", reason: e.target.value },
                )
              }
              placeholder="Explain why this G.R is being rejected…"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 dark:border-slate-800 dark:bg-slate-950/50">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejectState(null)}
              className="h-9"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => submitReject()}
              className="h-9 gap-1"
            >
              <X className="h-3.5 w-3.5" />
              Reject G.R
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}