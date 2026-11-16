"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Eye,
  X,
  RefreshCw,
  FilterX,
  ArrowRight,
  Clock3,
  CircleDashed,
  CheckCircle2,
  AlertTriangle,
  FileSearch,
  Inbox,
  Building2,
  Banknote,
} from "lucide-react";
import { toast } from "sonner";

import WorkOrderViewDialog from "./_components/WorkOrderViewDialog";
import WorkOrderAddEditDialog from "./_components/WorkOrderAddEditDialog";
import Protected from "@/components/auth/Protected";
import usePermissionCheck from "@/hooks/usePermissionCheck";
import type {
  ItemForm,
  WorkOrderItemType,
  WorkOrderView,
} from "./_components/workOrderShared";

/* =========================== Local types =========================== */
type Supplier = { _id: string; supplierName?: string; name?: string };
type Warehouse = { _id: string; name?: string };
type LookupItem = {
  _id: string;
  name?: string;
  supplierName?: string;
  unit?: string;
  salePrice?: number;
  purchasePrice?: number;
};

type WorkOrderStatus =
  | "Pending"
  | "Processing"
  | "UnderReview"
  | "Approved"
  | "Completed"
  | "Cancelled"
  | string;

type WorkOrderForm = WorkOrderView;

type TermsTemplate = { _id?: string; title: string; content: string };

type WorkOrderListResponse = {
  success?: boolean;
  data?: WorkOrderForm[];
  total?: number;
  page?: number;
  limit?: number;
};

/* =========================== Constants =========================== */
const NONE = "none";
const PAGE_SIZES = [10, 15, 25, 50];
const STATUS_OPTIONS: WorkOrderStatus[] = [
  "Pending",
  "Processing",
  "UnderReview",
  "Approved",
  "Completed",
  "Cancelled",
];
const FLOW = [
  "Pending",
  "Processing",
  "UnderReview",
  "Approved",
  "Completed",
] as const;
const ACTION_ORDER = ["processing", "review", "approve", "complete"] as const;
type WorkflowAction = (typeof ACTION_ORDER)[number];

const STATUS_META: Record<
  string,
  { label: string; icon: React.ElementType; pill: string; dot: string }
> = {
  Pending: {
    label: "Pending",
    icon: Clock3,
    pill: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200",
    dot: "bg-amber-500",
  },
  Processing: {
    label: "Processing",
    icon: CircleDashed,
    pill: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200",
    dot: "bg-sky-500",
  },
  UnderReview: {
    label: "Under Review",
    icon: AlertTriangle,
    pill: "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-200",
    dot: "bg-violet-500",
  },
  Approved: {
    label: "Approved",
    icon: CheckCircle2,
    pill: "border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-200",
    dot: "bg-indigo-500",
  },
  Completed: {
    label: "Completed",
    icon: CheckCircle2,
    pill: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200",
    dot: "bg-emerald-500",
  },
  Cancelled: {
    label: "Cancelled",
    icon: X,
    pill: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200",
    dot: "bg-rose-500",
  },
};

/* =========================== Helpers =========================== */
function getId(v?: any) {
  return !v ? "" : typeof v === "string" ? v : (v._id ?? "");
}

const n2 = (n: number) => Math.round(Number(n || 0) * 100) / 100;

function formatCurrency(n?: number | null) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "-";
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n2(Number(n)));
}

function formatDate(v?: string | Date | null) {
  if (!v) return "-";
  if (typeof v !== "string" && !(v instanceof Date)) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString();
}

function labelOfSupplier(v: any) {
  return v?.supplierName || v?.name || "-";
}

function labelOfWarehouse(v: any) {
  return v?.name || "-";
}

function useLookupMap<T extends { _id?: string }>(items: T[]) {
  return useMemo(() => {
    const m = new Map<string, T>();
    for (const item of items) if (item._id) m.set(item._id, item);
    return m;
  }, [items]);
}

function computeTotals(
  items: ItemForm[] = [],
  discountPercent = 0,
  taxPercent = 0,
) {
  const cloned = items.map((it) => ({ ...it }));
  let subTotal = 0;
  for (const item of cloned) {
    const line = n2(Number(item.quantity || 0) * Number(item.unitPrice || 0));
    item.lineTotal = line;
    subTotal = n2(subTotal + line);
  }
  const discountAmount = n2(subTotal * (Number(discountPercent || 0) / 100));
  const taxedBase = n2(subTotal - discountAmount);
  const taxTotal = n2(taxedBase * (Number(taxPercent || 0) / 100));
  const grandTotal = n2(taxedBase + taxTotal);
  return { items: cloned, subTotal, discountAmount, taxTotal, grandTotal };
}

function normalizeWorkOrder(doc: WorkOrderForm): WorkOrderForm {
  const totals = computeTotals(
    doc.items || [],
    Number(doc.discountPercent || 0),
    Number(doc.taxPercent || 0),
  );
  return { ...doc, ...totals };
}

function createEmptyItem(): ItemForm {
  return {
    itemType: "RawMaterial",
    itemId: "",
    name: "",
    description: "",
    quantity: 1,
    unit: "",
    unitPrice: 0,
    lineTotal: 0,
    remarks: "",
  };
}

function createEmptyWorkOrder(): WorkOrderForm {
  return {
    subject: "Work Order / Quotation",
    reference: "",
    attention: "",
    salutation: "Dear Sir / Madam,",
    supplier: "",
    warehouseOrFactory: "",
    issueDate: new Date().toISOString().slice(0, 10),
    expectedDeliveryDate: "",
    items: [createEmptyItem()],
    status: "Pending",
    notes: "",
    terms: "",
    selectedTemplateId: null,
    discountPercent: 0,
    taxPercent: 0,
    subTotal: 0,
    discountAmount: 0,
    taxTotal: 0,
    grandTotal: 0,
    footerNote: "Thank you for your business.",
  };
}

function getStatusMeta(status?: string) {
  return (
    STATUS_META[status || ""] || {
      label: status || "-",
      icon: Clock3,
      pill: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200",
      dot: "bg-slate-400",
    }
  );
}

function StatusBadge({ status }: { status?: string }) {
  if (!status) return <span className="text-xs text-slate-400">-</span>;
  const meta = getStatusMeta(status);
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${meta.pill}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

function WorkflowTracker({ status }: { status?: string }) {
  const index = FLOW.findIndex((s) => s === status);
  const cancelled = status === "Cancelled";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Workflow
        </span>
        <StatusBadge status={status} />
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {FLOW.map((step, i) => {
          const active = !cancelled && i <= index;
          const current = !cancelled && i === index;
          return (
            <div key={step} className="flex flex-col items-center gap-1">
              <div
                className={[
                  "flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-bold transition-all",
                  active
                    ? current
                      ? "border-[#3aa838] bg-[#3aa838] text-white shadow-sm shadow-[#3aa838]/30"
                      : "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                    : "border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500",
                ].join(" ")}
              >
                {i + 1}
              </div>
              {i < FLOW.length - 1 && (
                <div
                  className={[
                    "h-0.5 w-full rounded-full",
                    !cancelled && i < index
                      ? "bg-emerald-400"
                      : "bg-slate-200 dark:bg-slate-800",
                  ].join(" ")}
                />
              )}
              <span
                className={[
                  "text-center text-[9px] leading-tight",
                  active
                    ? "font-semibold text-slate-700 dark:text-slate-200"
                    : "text-slate-400 dark:text-slate-500",
                ].join(" ")}
              >
                {step === "UnderReview" ? "Review" : step}
              </span>
            </div>
          );
        })}
      </div>

      {cancelled && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[10px] text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
          Cancelled — workflow locked.
        </div>
      )}
    </div>
  );
}

function getNextAction(
  status?: string,
): { key: WorkflowAction; label: string } | null {
  switch (status) {
    case "Pending":
      return { key: "processing", label: "Start" };
    case "Processing":
      return { key: "review", label: "Review" };
    case "UnderReview":
      return { key: "approve", label: "Approve" };
    case "Approved":
      return { key: "complete", label: "Complete" };
    default:
      return null;
  }
}

function getAllowed(status?: string) {
  switch (status) {
    case "Completed":
    case "Cancelled":
      return { edit: false, cancel: false };
    default:
      return { edit: true, cancel: true };
  }
}

function MiniStat({
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
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
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

function MobileCard({
  wo,
  onView,
  onEdit,
  onDelete,
  onAction,
  onCancel,
  canEdit,
  canDelete,
}: {
  wo: WorkOrderForm;
  onView: (wo: WorkOrderForm) => void;
  onEdit: (wo: WorkOrderForm) => void;
  onDelete: (id?: string) => void;
  onAction: (wo: WorkOrderForm, action: WorkflowAction) => void;
  onCancel: (wo: WorkOrderForm) => void;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const nextAction = getNextAction(wo.status);
  const allowed = getAllowed(wo.status);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {wo.workOrderNo || "Work Order"}
            </h3>
            <StatusBadge status={wo.status} />
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {wo.subject || "-"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total</p>
          <p className="text-base font-bold text-slate-900 dark:text-white">
            {formatCurrency(wo.grandTotal)}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-950/40">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Supplier</p>
          <p className="mt-0.5 truncate font-medium text-slate-900 dark:text-slate-100">
            {labelOfSupplier(wo.supplier)}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-950/40">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Warehouse</p>
          <p className="mt-0.5 truncate font-medium text-slate-900 dark:text-slate-100">
            {labelOfWarehouse(wo.warehouseOrFactory)}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-950/40">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Issue</p>
          <p className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">
            {formatDate(wo.issueDate)}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-950/40">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Expected</p>
          <p className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">
            {formatDate(wo.expectedDeliveryDate)}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <WorkflowTracker status={wo.status} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" onClick={() => onView(wo)} className="h-8 gap-1 text-xs">
          <Eye className="h-3 w-3" />
          View
        </Button>

        {canEdit && allowed.edit && (
          <Button size="sm" variant="outline" onClick={() => onEdit(wo)} className="h-8 gap-1 text-xs">
            <Edit className="h-3 w-3" />
            Edit
          </Button>
        )}

        {canEdit && nextAction && (
          <Button size="sm" onClick={() => onAction(wo, nextAction.key)} className="h-8 gap-1 bg-[#3aa838] text-xs text-white hover:bg-[#2f8a2f]">
            <ArrowRight className="h-3 w-3" />
            {nextAction.label}
          </Button>
        )}

        {canEdit && allowed.cancel && (
          <Button size="sm" variant="ghost" onClick={() => onCancel(wo)} className="h-8 gap-1 text-xs text-amber-600">
            <X className="h-3 w-3" />
            Cancel
          </Button>
        )}

        {canDelete && (
          <Button size="sm" variant="ghost" onClick={() => onDelete(wo._id)} className="h-8 gap-1 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30">
            <Trash2 className="h-3 w-3" />
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}

/* =========================== Page (Protected) =========================== */
export default function WorkOrdersPage() {
  return (
    <Protected
      permissions={[
        "workorder.view",
        "workorder.create",
        "workorder.edit",
        "workorder.delete",
      ]}
    >
      <WorkOrdersPageInner />
    </Protected>
  );
}

function WorkOrdersPageInner() {
  const hasAccess = usePermissionCheck();
  const canCreate = hasAccess({ permissions: "workorder.create" });
  const canEdit = hasAccess({ permissions: "workorder.edit" });
  const canDelete = hasAccess({ permissions: "workorder.delete" });

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [templates, setTemplates] = useState<TermsTemplate[]>([]);

  const supplierMap = useLookupMap(suppliers);
  const warehouseMap = useLookupMap(warehouses);

  const [workOrders, setWorkOrders] = useState<WorkOrderForm[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [filterSupplier, setFilterSupplier] = useState<string | null>(null);
  const [filterWarehouseOrFactory, setFilterWarehouseOrFactory] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [openEdit, setOpenEdit] = useState(false);
  const [editing, setEditing] = useState<WorkOrderForm | null>(null);
  const [form, setForm] = useState<WorkOrderForm | null>(null);
  const [viewing, setViewing] = useState<WorkOrderForm | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const hasFilters = Boolean(
    q.trim() || filterSupplier || filterWarehouseOrFactory || filterStatus,
  );
  const activeFilterCount = [
    q.trim(),
    filterSupplier,
    filterWarehouseOrFactory,
    filterStatus,
  ].filter(Boolean).length;

  const loadLookups = useCallback(async () => {
    try {
      const [supplierRes, warehouseRes, templateRes] = await Promise.allSettled([
        api.get("/supplier", { params: { limit: 1000 } }),
        api.get("/warehouses", { params: { limit: 1000 } }),
        api.get("/settings/workorder-terms"),
      ]);

      setSuppliers(
        supplierRes.status === "fulfilled"
          ? supplierRes.value?.data?.data || []
          : [],
      );
      setWarehouses(
        warehouseRes.status === "fulfilled"
          ? warehouseRes.value?.data?.data || []
          : [],
      );

      const serverTemplates =
        templateRes.status === "fulfilled"
          ? templateRes.value?.data?.data
          : null;
      setTemplates(
        Array.isArray(serverTemplates) && serverTemplates.length
          ? serverTemplates
          : [
              {
                _id: "tmpl-1",
                title: "Default Terms",
                content:
                  "1. Payment due within 30 days.\n2. Goods remain property of supplier until paid.\n3. Warranty as per manufacturer's terms.",
              },
              {
                _id: "tmpl-2",
                title: "Standard Terms",
                content:
                  "1. 50% advance.\n2. Delivery subject to stock.\n3. Claims within 7 days.",
              },
            ],
      );
    } catch {
      setSuppliers([]);
      setWarehouses([]);
      setTemplates([]);
    }
  }, []);

  const loadWorkOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit };
      if (q.trim()) params.q = q.trim();

      const filters: Record<string, any> = {};
      if (filterSupplier) filters.supplier = filterSupplier;
      if (filterWarehouseOrFactory)
        filters.warehouseOrFactory = filterWarehouseOrFactory;
      if (filterStatus) filters.status = filterStatus;
      if (Object.keys(filters).length) params.filter = JSON.stringify(filters);

      const res = await api.get<WorkOrderListResponse>("/workorders", {
        params,
      });
      setWorkOrders((res.data?.data || []).map(normalizeWorkOrder));
      setTotal(res.data?.total ?? 0);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load work orders");
      setWorkOrders([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, limit, q, filterSupplier, filterWarehouseOrFactory, filterStatus]);

  const reloadViewing = useCallback(async (id: string) => {
    try {
      const res = await api.get(`/workorders/${id}`);
      const doc = normalizeWorkOrder(res.data?.data);
      setViewing(doc);
      return doc;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    setPage(1);
  }, [q, filterSupplier, filterWarehouseOrFactory, filterStatus, limit]);

  useEffect(() => {
    loadWorkOrders();
  }, [loadWorkOrders]);

  const closeEditDialog = useCallback(() => {
    setOpenEdit(false);
    setForm(null);
    setEditing(null);
  }, []);

  const onCreate = useCallback(() => {
    setEditing(null);
    setForm(createEmptyWorkOrder());
    setOpenEdit(true);
  }, []);

  const onEdit = useCallback(async (wo: WorkOrderForm) => {
    try {
      const id = getId(wo._id);
      if (!id) return;
      const res = await api.get(`/workorders/${id}`);
      const doc = normalizeWorkOrder(res.data?.data);
      setEditing(doc);
      setForm(doc);
      setOpenEdit(true);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load work order");
    }
  }, []);

  const onView = useCallback(async (wo: WorkOrderForm) => {
    try {
      const id = getId(wo._id);
      if (!id) return;
      setLoadingDetail(true);
      const res = await api.get(`/workorders/${id}`);
      setViewing(normalizeWorkOrder(res.data?.data));
    } catch (error) {
      console.error(error);
      toast.error("Failed to load work order");
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const onDelete = useCallback(
    async (id?: string) => {
      if (!id) return;
      if (!window.confirm("Delete this work order permanently?")) return;

      try {
        await api.delete(`/workorders/${id}?hard=true`);
        toast.success("Work order deleted");
        await loadWorkOrders();
      } catch (error) {
        console.error(error);
        toast.error("Failed to delete work order");
      }
    },
    [loadWorkOrders],
  );

  const onAction = useCallback(
    async (wo: WorkOrderForm, action: WorkflowAction) => {
      const id = getId(wo._id);
      if (!id) return;

      const endpointMap = {
        processing: `/workorders/${id}/processing`,
        review: `/workorders/${id}/review`,
        approve: `/workorders/${id}/approve`,
        complete: `/workorders/${id}/complete`,
      } as const;

      try {
        await api.post(endpointMap[action]);
        toast.success("Workflow updated");
        await loadWorkOrders();
        if (viewing?._id === wo._id) await reloadViewing(id);
      } catch (error: any) {
        console.error(error);
        toast.error(error?.response?.data?.message || "Status update failed");
      }
    },
    [loadWorkOrders, reloadViewing, viewing?._id],
  );

  const onCancel = useCallback(
    async (wo: WorkOrderForm) => {
      const id = getId(wo._id);
      if (!id) return;

      const reason = window.prompt("Cancel reason (optional):") || "";
      try {
        await api.post(`/workorders/${id}/cancel`, { reason });
        toast.success("Work order cancelled");
        await loadWorkOrders();
        if (viewing?._id === wo._id) await reloadViewing(id);
      } catch (error: any) {
        console.error(error);
        toast.error(error?.response?.data?.message || "Cancel failed");
      }
    },
    [loadWorkOrders, reloadViewing, viewing?._id],
  );

  const getSupplierName = useCallback(
    (supplier: any) => {
      if (!supplier) return "-";
      if (typeof supplier === "string") {
        return (
          supplierMap.get(supplier)?.supplierName ||
          supplierMap.get(supplier)?.name ||
          "-"
        );
      }
      return supplier?.supplierName || supplier?.name || "-";
    },
    [supplierMap],
  );

  const getWarehouseName = useCallback(
    (warehouse: any) => {
      if (!warehouse) return "-";
      if (typeof warehouse === "string")
        return warehouseMap.get(warehouse)?.name || "-";
      return warehouse?.name || "-";
    },
    [warehouseMap],
  );

  const stats = useMemo(() => {
    const pending = workOrders.filter((w) => w.status === "Pending").length;
    const inProgress = workOrders.filter((w) =>
      ["Processing", "UnderReview", "Approved"].includes(String(w.status)),
    ).length;
    const completed = workOrders.filter((w) => w.status === "Completed").length;
    const value = workOrders.reduce(
      (sum, w) => sum + Number(w.grandTotal || 0),
      0,
    );

    return [
      {
        label: "Visible Orders",
        value: workOrders.length,
        hint: `${total} total results`,
        icon: Inbox,
      },
      { label: "Pending", value: pending, hint: "Waiting to start", icon: Clock3 },
      { label: "In Progress", value: inProgress, hint: "Active workflow", icon: CircleDashed },
      { label: "Completed", value: completed, hint: "Finished successfully", icon: CheckCircle2 },
      {
        label: "Visible Value",
        value: formatCurrency(value),
        hint: `${templates.length} templates loaded`,
        icon: Banknote,
      },
    ];
  }, [workOrders, total, templates.length]);

  const clearFilters = () => {
    setQ("");
    setFilterSupplier(null);
    setFilterWarehouseOrFactory(null);
    setFilterStatus(null);
    setPage(1);
  };

  return (
    <div className="space-y-5 p-4 md:p-6">
      {/* HERO */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-6">
        <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-[#3aa838]/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-emerald-500/5 blur-3xl" />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                <Building2 className="h-2.5 w-2.5" />
                Operations
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-[#3aa838]/30 bg-[#3aa838]/5 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#2f8a2f] dark:border-[#3aa838]/30 dark:bg-[#3aa838]/10 dark:text-[#9bdd91]">
                Workflow-first
              </span>
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white md:text-3xl">
                Work Orders
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                A high-visibility workspace for creating, monitoring, and
                driving work orders through every stage.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadWorkOrders}
              disabled={loading}
              className="h-9 gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              disabled={!hasFilters}
              className="h-9 gap-1.5"
            >
              <FilterX className="h-3.5 w-3.5" />
              Clear
              {activeFilterCount > 0 && (
                <span className="ml-0.5 rounded-full bg-[#3aa838] px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </Button>
            {canCreate && (
              <Button
                size="sm"
                onClick={onCreate}
                className="h-9 gap-1.5 bg-[#3aa838] text-white shadow-sm shadow-[#3aa838]/20 hover:bg-[#2f8a2f]"
              >
                <Plus className="h-4 w-4" />
                Create Work Order
              </Button>
            )}
          </div>
        </div>

        <div className="relative mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {stats.map((s) => (
            <MiniStat
              key={s.label}
              icon={s.icon}
              label={s.label}
              value={s.value}
              hint={s.hint}
            />
          ))}
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-2 xl:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_auto] xl:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search work order no, subject, reference, status"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-10 pl-9"
            />
          </div>

          <Select
            value={filterSupplier ?? NONE}
            onValueChange={(v) => setFilterSupplier(v === NONE ? null : v)}
          >
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Supplier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>All Suppliers</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s._id} value={s._id}>
                  {labelOfSupplier(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filterWarehouseOrFactory ?? NONE}
            onValueChange={(v) =>
              setFilterWarehouseOrFactory(v === NONE ? null : v)
            }
          >
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Warehouse / Factory" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>All Warehouses</SelectItem>
              {warehouses.map((w) => (
                <SelectItem key={w._id} value={w._id}>
                  {labelOfWarehouse(w)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filterStatus ?? NONE}
            onValueChange={(v) => setFilterStatus(v === NONE ? null : v)}
          >
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>All Status</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {getStatusMeta(s).label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center justify-end gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {activeFilterCount ? `${activeFilterCount} filter(s)` : "No filters"}
            </span>
            {canCreate && (
              <Button onClick={onCreate} size="sm" className="h-10 gap-1.5 bg-[#3aa838] text-white hover:bg-[#2f8a2f] xl:hidden">
                <Plus className="h-4 w-4" />
                Create
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* TABLE CARD */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Live Work Orders</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Every row shows the active workflow stage in a visual tracker.
              </p>
            </div>
            {loadingDetail && (
              <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Loading detail…
              </div>
            )}
          </div>
        </div>

        <div>
          {/* Desktop */}
          <div className="hidden md:block">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/50">
                    <TableHead className="w-[56px] px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">#</TableHead>
                    <TableHead className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Work Order</TableHead>
                    <TableHead className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Parties</TableHead>
                    <TableHead className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Dates</TableHead>
                    <TableHead className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total</TableHead>
                    <TableHead className="min-w-[260px] px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Workflow</TableHead>
                    <TableHead className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</TableHead>
                    <TableHead className="w-[320px] px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {workOrders.map((w, i) => {
                    const nextAction = getNextAction(w.status);
                    const allowed = getAllowed(w.status);

                    return (
                      <TableRow
                        key={w._id || i}
                        className="align-top transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/30"
                      >
                        <TableCell className="px-4 py-3 align-middle text-xs font-medium text-slate-400">
                          {(page - 1) * limit + i + 1}
                        </TableCell>

                        <TableCell className="px-4 py-3 align-middle">
                          <button type="button" onClick={() => onView(w)} className="text-left">
                            <div className="text-sm font-semibold text-slate-900 dark:text-white">
                              {w.workOrderNo || "-"}
                            </div>
                            <div className="mt-0.5 text-[10px] font-mono text-slate-400">
                              {w.reference || "-"}
                            </div>
                            <div className="mt-0.5 max-w-[220px] truncate text-xs text-slate-500 dark:text-slate-400">
                              {w.subject || "-"}
                            </div>
                          </button>
                        </TableCell>

                        <TableCell className="px-4 py-3 align-middle">
                          <div className="text-xs font-medium text-slate-900 dark:text-slate-100">
                            {getSupplierName(w.supplier)}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                            <Building2 className="h-2.5 w-2.5" />
                            {getWarehouseName(w.warehouseOrFactory)}
                          </div>
                          <div className="mt-0.5 text-[10px] text-slate-400">
                            {w.items?.length || 0} item{(w.items?.length || 0) === 1 ? "" : "s"}
                          </div>
                        </TableCell>

                        <TableCell className="px-4 py-3 align-middle">
                          <div className="text-xs text-slate-900 dark:text-slate-100">
                            {formatDate(w.issueDate)}
                          </div>
                          <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                            Expected: {formatDate(w.expectedDeliveryDate)}
                          </div>
                        </TableCell>

                        <TableCell className="px-4 py-3 align-middle text-sm font-bold text-slate-900 dark:text-white">
                          {formatCurrency(w.grandTotal)}
                        </TableCell>

                        <TableCell className="min-w-[260px] px-4 py-3 align-middle">
                          <WorkflowTracker status={w.status} />
                        </TableCell>

                        <TableCell className="px-4 py-3 align-middle">
                          <StatusBadge status={w.status} />
                        </TableCell>

                        <TableCell className="px-4 py-3 align-middle">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onView(w)}
                              className="h-7 gap-1 px-2 text-[10px]"
                            >
                              <Eye className="h-3 w-3" />
                              View
                            </Button>

                            {canEdit && allowed.edit && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onEdit(w)}
                                className="h-7 gap-1 px-2 text-[10px]"
                              >
                                <Edit className="h-3 w-3" />
                                Edit
                              </Button>
                            )}

                            {canEdit && nextAction && (
                              <Button
                                size="sm"
                                onClick={() => onAction(w, nextAction.key)}
                                className="h-7 gap-1 bg-[#3aa838] px-2 text-[10px] text-white hover:bg-[#2f8a2f]"
                              >
                                <ArrowRight className="h-3 w-3" />
                                {nextAction.label}
                              </Button>
                            )}

                            {canEdit && allowed.cancel && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onCancel(w)}
                                className="h-7 gap-1 px-2 text-[10px] text-amber-600"
                              >
                                <X className="h-3 w-3" />
                                Cancel
                              </Button>
                            )}

                            {canDelete && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onDelete(w._id)}
                                className="h-7 w-7 p-0 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {!workOrders.length && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-12 text-center">
                        <div className="flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
                          {loading ? (
                            <>
                              <RefreshCw className="h-5 w-5 animate-spin" />
                              <span className="text-xs">Loading work orders…</span>
                            </>
                          ) : (
                            <>
                              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                                <FileSearch className="h-6 w-6 text-slate-400" />
                              </div>
                              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                No work orders found
                              </span>
                              <span className="max-w-sm text-xs">
                                Adjust filters or create a new work order to begin.
                              </span>
                              {canCreate && (
                                <Button size="sm" onClick={onCreate} className="mt-2 h-8 gap-1 bg-[#3aa838] text-xs text-white hover:bg-[#2f8a2f]">
                                  <Plus className="h-3 w-3" />
                                  Create Work Order
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Mobile */}
          <div className="grid gap-3 p-3 md:hidden">
            {workOrders.map((w) => (
              <MobileCard
                key={w._id}
                wo={w}
                onView={onView}
                onEdit={onEdit}
                onDelete={onDelete}
                onAction={onAction}
                onCancel={onCancel}
                canEdit={canEdit}
                canDelete={canDelete}
              />
            ))}

            {!workOrders.length && (
              <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center dark:border-slate-800">
                <FileSearch className="mx-auto h-6 w-6 text-slate-400" />
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                  {loading ? "Loading work orders…" : "No work orders found"}
                </p>
              </div>
            )}
          </div>

          {/* Pagination */}
          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {total === 0
                ? "No records"
                : `Showing ${(page - 1) * limit + 1} - ${Math.min(page * limit, total)} of ${total}`}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-[#3aa838]/40 focus:ring-2 focus:ring-[#3aa838]/10 dark:border-slate-800 dark:bg-slate-900"
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}/page
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  variant="outline"
                  size="sm"
                  className="h-8"
                >
                  Prev
                </Button>
                <div className="min-w-[70px] rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white">
                  {page} / {totalPages}
                </div>
                <Button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  variant="outline"
                  size="sm"
                  className="h-8"
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* DIALOGS */}
      {viewing && (
        <WorkOrderViewDialog viewing={viewing} setViewing={setViewing} />
      )}

      {openEdit && (
        <WorkOrderAddEditDialog
          openEdit={openEdit}
          setOpenEdit={(open) => {
            if (!open) closeEditDialog();
            else setOpenEdit(open);
          }}
          form={form}
          setForm={setForm}
          editing={editing}
          setEditing={setEditing}
          suppliers={suppliers}
          warehouses={warehouses}
          StatusBadge={StatusBadge}
          loadWorkOrders={loadWorkOrders}
        />
      )}
    </div>
  );
}