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
import {
  Eye,
  Check,
  X,
  Search,
  Download,
  Plus,
  CreditCard,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

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
    unit?: string;
    remarks?: string;
    itemName?: string;
    transportCost?: number;
    transportPaymentSource?: string;
    transportNotes?: string;
  }>;
  attachments?: Array<{
    _id?: string;
    originalName?: string;
    url?: string;
    name?: string;
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

const ITEM_SOURCES: Record<
  ItemType | "Product",
  { endpoint: string; label: string }
> = {
  RawMaterial: { endpoint: "/raw-materials", label: "Raw Material" },
  PackagingItem: { endpoint: "/packaging-items", label: "Packaging Item" },
  Product: { endpoint: "/products", label: "Product" },
  FinishedProduct: { endpoint: "/products", label: "Finished Product" }, // optional if you still have FP
  OtherProducts: { endpoint: "/other-products", label: "Other Product" },
};

const today = () => new Date().toISOString().slice(0, 10);
const n = (v: any) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};
const round = (v: number) => Math.round(v * 10000) / 10000;
const fmt = (v?: number) =>
  typeof v === "number" && Number.isFinite(v) ? Number(v).toFixed(2) : "-";

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
    case "OtherProducts": // handle both
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

const statusClass = (s?: string) => {
  if (s === "Approved" || s === "Paid") return "bg-green-600";
  if (s === "Pending") return "bg-blue-600";
  if (s === "Partial") return "bg-amber-600";
  return "bg-red-600";
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

function useDebounced<T>(value: T, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function Badge({ value }: { value?: string }) {
  return (
    <span
      className={`inline-flex rounded px-2 py-1 text-xs font-medium text-white ${statusClass(value)}`}
    >
      {value || "-"}
    </span>
  );
}

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
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
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
        if (obj)
          setItems((prev) =>
            prev.some((p) => String(p._id) === String(obj._id))
              ? prev
              : [obj, ...prev],
          );
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, [value, endpoint, items]);

  const selected = items.find((it) => String(it._id) === String(value)) ?? null;

  return (
    <div ref={ref} className="relative">
      <div
        className="flex min-h-[44px] cursor-pointer items-center justify-between rounded-md border bg-white px-3 py-2"
        onClick={() => {
          setOpen((s) => !s);
          setQ("");
          void load("");
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
        <div className="absolute z-50 mt-1 max-h-80 w-full overflow-auto rounded border bg-white shadow">
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
                className="cursor-pointer px-3 py-2 hover:bg-gray-50"
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
    <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-800">
        <AlertTriangle className="h-4 w-4" />
        Unit mismatch
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="flex items-center gap-2 rounded bg-white px-3 py-2 text-sm">
          <span className="font-medium">1</span>
          <span>{line.workOrderUnit || "WO unit"}</span>
          <span>=</span>
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
            className="bg-white"
          />
        </div>
        <div className="flex items-center gap-2 rounded bg-white px-3 py-2 text-sm">
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
          >
            Suggested
          </Button>
        </div>
      </div>
      <div className="mt-2 text-xs text-amber-900">
        Example: 1 {line.workOrderUnit || "WO unit"} ={" "}
        {round(line.conversionFactor || suggested)}{" "}
        {line.inventoryUnit || "inventory unit"}.
      </div>
    </div>
  );
}

export default function GoodsReceiptPage() {
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
          Product: buildMap(fpRes.data.data || []), // use `/products` API
          FinishedProduct: buildMap(fpRes.data.data || []), // optional
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
    FinishedProduct: "Product", // optional if you still have FP
    OtherProducts: "OtherProducts", // 🔥 backend expects this exact enum
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
            // itemType: ITEM_TYPE_MAP[type] || type,
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
        if (it.receiveQty > it.remainingQty) {
          return toast.error(
            `Cannot receive more than remaining quantity for ${it.itemName || it.itemId}`,
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
          itemType: ITEM_TYPE_MAP[it.itemType] || it.itemType, // ✅ map to backend enum
          itemId: String(it.itemId),
          receivedQty: n(it.receiveQty), // WO quantity
          inventoryQty: n(it.inventoryQty), // converted inventory quantity
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

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Goods Receipts Notes</h2>
          <div className="text-sm text-muted-foreground">
            Create, review and approve G.R.N.s
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-md border bg-white px-3 py-2">
            <Search className="h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search GR#, status..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-64 border-0 p-0 shadow-none focus-visible:ring-0"
            />
          </div>

          <Select
            value={filterStatus ?? "all"}
            onValueChange={(v) => setFilterStatus(v === "all" ? null : v)}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Approved">Approved</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>

          <Button
            className="bg-green-600 text-white hover:bg-green-700"
            onClick={() => {
              setForm(emptyForm());
              setFiles([]);
              setCreateOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create G.R.N
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <div className="overflow-x-auto p-4">
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
                        ? g.workOrderId.workOrderNo || g.workOrderId._id
                        : g.workOrderId)}
                  </TableCell>
                  <TableCell>
                    {typeof g.supplier === "string"
                      ? supplierMap.get(g.supplier)?.supplierName ||
                        supplierMap.get(g.supplier)?.name ||
                        g.supplier
                      : g.supplier?.supplierName || g.supplier?.name || "-"}
                  </TableCell>
                  <TableCell>
                    {g.issueDate
                      ? new Date(g.issueDate).toLocaleDateString()
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge value={g.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openView(String(g._id))}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {g.status === "Pending" && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => approve(String(g._id))}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => openReject(String(g._id))}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {grs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-6 text-center">
                    {loading ? "Loading..." : "No records"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between border-t p-4">
          <div className="text-sm text-muted-foreground">
            {total === 0
              ? "Showing 0 records"
              : `Showing ${(page - 1) * limit + 1} - ${Math.min(page * limit, total)} of ${total}`}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="rounded border px-2 py-1"
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

      <Dialog
        open={createOpen}
        onOpenChange={(o) => !o && setCreateOpen(false)}
      >
        <DialogContent className="h-[88vh] !w-[94vw] !max-w-[1200px] p-0">
          <div className="flex h-full overflow-hidden rounded-xl bg-white shadow">
            <div className="w-2/3 space-y-6 overflow-auto p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">
                    Create Goods Receipt Note
                  </h3>
                  <div className="text-sm text-muted-foreground">
                    Select a work order. Items load automatically.
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                    Close
                  </Button>
                  <Button
                    onClick={() => void submitCreate()}
                    className="bg-green-600 text-white hover:bg-green-700"
                  >
                    Create G.R.N
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-3">
                  <div>
                    <label className="mb-1 block text-sm">Work Order *</label>
                    <Select
                      value={form.workOrderId || ""}
                      onValueChange={(v) => void preloadWorkOrder(v)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select work order..." />
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
                      <label className="mb-1 block text-sm">Supplier *</label>
                      <AsyncSelect
                        endpoint="/supplier"
                        value={form.supplier}
                        onChange={(v) =>
                          setForm((p) => ({ ...p, supplier: v || "" }))
                        }
                        labelKey={(d: any) => d.supplierName || d.name}
                        placeholder="Search supplier..."
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm">Factory *</label>
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
                        placeholder="Search factory..."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-sm">G.R Date</label>
                      <Input
                        type="date"
                        value={form.date}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, date: e.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm">Notes</label>
                      <Input
                        value={form.notes}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, notes: e.target.value }))
                        }
                        placeholder="Optional"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm">
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
                    />
                  </div>
                </div>

                <div className="rounded-md bg-gray-50 p-4">
                  <div className="text-sm text-muted-foreground">Preview</div>
                  <div className="mt-2 space-y-3 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">
                        Work Order
                      </div>
                      <div className="font-medium">
                        {selectedWO?.workOrderNo || form.workOrderId || "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">
                        Supplier
                      </div>
                      <div className="font-medium">
                        {typeof form.supplier === "string"
                          ? supplierMap.get(form.supplier)?.supplierName ||
                            supplierMap.get(form.supplier)?.name ||
                            "-"
                          : getEntityName(form.supplier, "-")}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">
                        Factory
                      </div>
                      <div className="font-medium">
                        {typeof form.warehouseOrFactory === "string"
                          ? warehouseMap.get(form.warehouseOrFactory)?.name ||
                            "-"
                          : getEntityName(form.warehouseOrFactory, "-")}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Date</div>
                      <div className="font-semibold">{form.date}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-semibold">Items</div>
                  <div className="text-sm text-muted-foreground">
                    Loaded from the selected work order
                  </div>
                </div>

                <div className="overflow-auto rounded-md border">
                  <table className="w-full table-auto">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="p-3 text-left">#</th>
                        <th className="p-3 text-left">Product</th>
                        <th className="p-3 text-right">W.O. Qty</th>
                        <th className="p-3 text-right">Remaining</th>
                        <th className="p-3 text-right">Receive Now</th>
                        <th className="p-3 text-right">Inventory Qty</th>
                        <th className="p-3 text-right">Transport</th>
                        <th className="p-3 text-left">Transport Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.items.map((it, idx) => {
                        const mismatch = !sameUnit(
                          it.workOrderUnit,
                          it.inventoryUnit,
                        );
                        return (
                          <>
                            <tr
                              key={`${it.itemId}-${idx}`}
                              className="border-t"
                            >
                              <td className="align-top p-3">{idx + 1}</td>
                              <td className="align-top p-3">
                                <div className="font-medium">
                                  {resolveItemName(it)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Type:{" "}
                                  {ITEM_SOURCES[it.itemType]?.label ||
                                    it.itemType}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  WO Unit: {it.workOrderUnit || "-"} | Inventory
                                  Unit: {it.inventoryUnit || "-"}
                                </div>
                                {(it.remainingQty ?? 0) <= 0 && (
                                  <div className="mt-1 text-xs text-green-600">
                                    Completed
                                  </div>
                                )}
                                {/* {mismatch && (
                                <ConversionBox
                                  line={it}
                                  onChange={(patch) => updateLine(idx, patch)}
                                />
                              )} */}
                              </td>
                              <td className="align-top p-3 text-right">
                                {it.expectedQty}
                              </td>
                              <td className="align-top p-3 text-right">
                                {it.remainingQty}
                              </td>
                              <td className="align-top p-3 text-right">
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
                                  className="w-28 text-right"
                                />
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {it.workOrderUnit || "-"}
                                </div>
                              </td>
                              <td className="align-top p-3 text-right">
                                <div className="w-28 text-right font-medium">
                                  {round(it.inventoryQty)}
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {it.inventoryUnit || it.workOrderUnit || "-"}
                                </div>
                              </td>
                              <td className="align-top p-3 text-right">
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
                                  className="w-28 text-right"
                                />
                              </td>
                              <td className="align-top p-3">
                                <Input
                                  type="text"
                                  value={it.transportNotes || ""}
                                  onChange={(e) =>
                                    updateLine(idx, {
                                      transportNotes: e.target.value,
                                    })
                                  }
                                  placeholder="Optional"
                                />
                              </td>
                            </tr>
                            <tr>
                              <td colSpan={8}>
                                {mismatch && (
                                  <ConversionBox
                                    line={it}
                                    onChange={(patch) => updateLine(idx, patch)}
                                  />
                                )}
                              </td>
                            </tr>
                          </>
                        );
                      })}
                      {form.items.length === 0 && (
                        <tr>
                          <td
                            colSpan={8}
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

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Attachments</label>
                  <div
                    onDrop={(e) => {
                      e.preventDefault();
                      pushFiles(e.dataTransfer.files);
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    className="mt-2 cursor-pointer rounded border border-dashed p-4 text-center"
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
                    {filePreviews.map((p, i) => {
                      const isImage = p.file.type.startsWith("image/");
                      return (
                        <div
                          key={`${p.file.name}-${i}`}
                          className="flex items-start gap-2 rounded border p-2"
                        >
                          <div className="flex h-14 w-14 items-center justify-center bg-gray-50">
                            {isImage ? (
                              <img
                                src={p.url}
                                alt={p.file.name}
                                className="max-h-full max-w-full"
                              />
                            ) : (
                              <div className="px-1 text-xs text-muted-foreground">
                                {p.file.name}
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium">
                              {p.file.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {(p.file.size / 1024).toFixed(1)} KB
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeFile(i)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
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

                <div className="rounded border p-3">
                  <div className="mb-2 text-sm font-semibold">Review</div>
                  <div className="text-sm">
                    Supplier:{" "}
                    {typeof form.supplier === "string"
                      ? supplierMap.get(form.supplier)?.supplierName ||
                        supplierMap.get(form.supplier)?.name ||
                        "-"
                      : getEntityName(form.supplier, "-")}
                  </div>
                  <div className="text-sm">
                    Factory:{" "}
                    {typeof form.warehouseOrFactory === "string"
                      ? warehouseMap.get(form.warehouseOrFactory)?.name || "-"
                      : getEntityName(form.warehouseOrFactory, "-")}
                  </div>
                  <div className="text-sm">Items: {form.items.length}</div>
                  <div className="mt-2 text-sm">
                    <span className="text-muted-foreground">
                      Total Receive Now:
                    </span>{" "}
                    <span className="font-semibold">{round(totals.woQty)}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">
                      Total Inventory Qty:
                    </span>{" "}
                    <span className="font-semibold">
                      {round(totals.inventoryQty)}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">
                      Transport Total:
                    </span>{" "}
                    <span className="font-semibold">
                      {fmt(totals.transport)}
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

            <div className="w-1/3 overflow-auto border-l bg-gray-50 p-6">
              <div className="sticky top-6">
                <div className="rounded-lg bg-white p-4 shadow-sm">
                  <div className="mb-4 flex items-start justify-between">
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
                        {selectedWO?.workOrderNo || "New"}
                      </div>
                      <div className="text-sm">{form.date}</div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="text-xs text-muted-foreground">
                      Supplier
                    </div>
                    <div className="font-medium">
                      {typeof form.supplier === "string"
                        ? supplierMap.get(form.supplier)?.supplierName ||
                          supplierMap.get(form.supplier)?.name ||
                          "-"
                        : getEntityName(form.supplier, "-")}
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="text-xs text-muted-foreground">Factory</div>
                    <div className="font-medium">
                      {typeof form.warehouseOrFactory === "string"
                        ? warehouseMap.get(form.warehouseOrFactory)?.name || "-"
                        : getEntityName(form.warehouseOrFactory, "-")}
                    </div>
                  </div>

                  <div className="mb-3 overflow-auto max-h-52">
                    <table className="w-full table-auto">
                      <thead>
                        <tr>
                          <th className="text-left text-xs text-muted-foreground">
                            Item
                          </th>
                          <th className="text-right text-xs text-muted-foreground">
                            WO Qty
                          </th>
                          <th className="text-right text-xs text-muted-foreground">
                            Inventory
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.items.map((it, idx) => (
                          <tr key={`${it.itemId}-${idx}`}>
                            <td className="py-2 text-sm">
                              {resolveItemName(it)}
                            </td>
                            <td className="py-2 text-right text-sm">
                              {round(it.receiveQty)}
                            </td>
                            <td className="py-2 text-right text-sm">
                              {round(it.inventoryQty)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="border-t pt-3">
                    <div className="flex justify-between">
                      <div className="text-sm text-muted-foreground">
                        Total Receive Now
                      </div>
                      <div className="font-semibold">{round(totals.woQty)}</div>
                    </div>
                    <div className="mt-1 flex justify-between">
                      <div className="text-sm text-muted-foreground">
                        Total Inventory Qty
                      </div>
                      <div className="font-semibold">
                        {round(totals.inventoryQty)}
                      </div>
                    </div>
                    <div className="mt-1 flex justify-between">
                      <div className="text-sm text-muted-foreground">
                        Total Transport
                      </div>
                      <div className="font-semibold">
                        {fmt(totals.transport)}
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
                      className="bg-green-600 text-white hover:bg-green-700"
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

      <Dialog
        open={!!viewing}
        onOpenChange={(o) => {
          if (!o) setViewing(null);
        }}
      >
        <DialogContent className="!w-[90vw] !max-w-[1100px] p-0">
          {viewing && (
            <div className="rounded-lg bg-white p-6">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold">Goods Receipt</h3>
                  <div className="text-sm text-muted-foreground">
                    {viewing.grNo || viewing._id}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge value={viewing.status} />
                  <Button variant="ghost" onClick={() => setViewing(null)}>
                    Close
                  </Button>
                  {viewing.status === "Pending" && (
                    <>
                      <Button onClick={() => approve(String(viewing._id))}>
                        <Check className="mr-2 h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => openReject(String(viewing._id))}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <div className="text-sm text-muted-foreground">Supplier</div>
                  <div className="font-medium">
                    {typeof viewing.supplier === "string"
                      ? supplierMap.get(viewing.supplier)?.supplierName ||
                        supplierMap.get(viewing.supplier)?.name ||
                        viewing.supplier
                      : viewing.supplier?.supplierName ||
                        viewing.supplier?.name ||
                        "-"}
                  </div>
                </div>

                <div>
                  <div className="text-sm text-muted-foreground">Factory</div>
                  <div className="font-medium">
                    {typeof viewing.warehouseOrFactory === "string"
                      ? warehouseMap.get(viewing.warehouseOrFactory)?.name ||
                        viewing.warehouseOrFactory
                      : viewing.warehouseOrFactory?.name || "-"}
                  </div>
                </div>

                <div>
                  <div className="text-sm text-muted-foreground">Date</div>
                  <div className="font-medium">
                    {viewing.issueDate
                      ? new Date(viewing.issueDate).toLocaleDateString()
                      : "-"}
                  </div>
                </div>
              </div>

              <div className="mb-4 overflow-x-auto">
                <table className="w-full table-auto">
                  <thead>
                    <tr>
                      <th className="border-b p-2 text-left">#</th>
                      <th className="border-b p-2 text-left">Item</th>
                      <th className="border-b p-2 text-right">Qty</th>
                      <th className="border-b p-2">Unit</th>
                      <th className="border-b p-2">Remarks</th>
                      <th className="border-b p-2 text-right">Transport</th>
                      <th className="border-b p-2">Transport Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(viewing.items || []).map((it, idx) => (
                      <tr key={idx}>
                        <td className="p-2">{idx + 1}</td>
                        <td className="p-2 font-medium">
                          {resolveItemName(it)}
                          <div className="text-xs text-muted-foreground">
                            {ITEM_SOURCES[normalizeType(it.itemType)]?.label ||
                              it.itemType}
                          </div>
                        </td>
                        <td className="p-2 text-right">{it.receivedQty}</td>
                        <td className="p-2">{it.unit || "-"}</td>
                        <td className="p-2">{it.remarks || "-"}</td>
                        <td className="p-2 text-right">
                          {it.transportCost != null
                            ? fmt(Number(it.transportCost))
                            : "-"}
                        </td>
                        <td className="p-2">{it.transportNotes || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <div className="mb-2 font-semibold">Attachments</div>
                  <div className="space-y-2">
                    {(viewing.attachments || []).length ? (
                      viewing.attachments!.map((a, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-3 rounded border p-2"
                        >
                          <div className="flex items-center gap-3">
                            {a.url ? (
                              <img
                                src={a.url}
                                alt={a.originalName || a.name || "attachment"}
                                className="max-h-[80px] max-w-[120px]"
                              />
                            ) : (
                              <div className="text-sm text-muted-foreground">
                                {a.originalName || a.name || a._id}
                              </div>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              a.url && window.open(a.url, "_blank")
                            }
                            disabled={!a.url}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        No attachments
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  {viewing.rejectReason && (
                    <div>
                      <div className="font-semibold">Reject Reason</div>
                      <div className="text-sm text-red-600">
                        {viewing.rejectReason}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="font-semibold">Notes</div>
                    <div className="text-sm text-muted-foreground">
                      {viewing.notes || "-"}
                    </div>
                  </div>

                  <div>
                    <div className="font-semibold">Transportation Notes</div>
                    <div className="text-sm text-muted-foreground">
                      {viewing.transportationNotes || "-"}
                    </div>
                  </div>

                  <div className="rounded border p-3">
                    <div className="mb-2 font-semibold">Payment Summary</div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <div className="text-muted-foreground">Grand Total</div>
                        <div className="font-medium">
                          {fmt(viewing.grandTotal)}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Paid</div>
                        <div className="font-medium">
                          {fmt(viewing.paidAmount)}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Remaining</div>
                        <div className="font-medium">
                          {fmt(viewing.remainingAmount)}
                        </div>
                      </div>
                    </div>

                    {viewing.status === "Approved" &&
                      (viewing.remainingAmount ?? 0) > 0 && (
                        <div className="mt-3 space-y-2">
                          <div className="text-sm font-medium">Add Payment</div>
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={payAmount}
                              onChange={(e) => setPayAmount(e.target.value)}
                              placeholder="Amount"
                            />
                            <Button
                              onClick={() =>
                                viewing._id &&
                                submitPayment(String(viewing._id))
                              }
                            >
                              <CreditCard className="mr-2 h-4 w-4" />
                              Pay
                            </Button>
                          </div>
                        </div>
                      )}

                    {viewing.paymentStatus && (
                      <div className="mt-3">
                        <Badge value={viewing.paymentStatus} />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <Button onClick={() => setViewing(null)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!rejectState}
        onOpenChange={(o) => {
          if (!o) setRejectState(null);
        }}
      >
        <DialogContent className="!w-[520px]">
          <div className="p-4">
            <h3 className="text-lg font-semibold">Reject G.R</h3>
            <div className="mt-2">
              <label className="text-sm">Reason</label>
              <textarea
                className="min-h-[120px] w-full rounded border p-2"
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
            <div className="mt-3 flex justify-end gap-2">
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
