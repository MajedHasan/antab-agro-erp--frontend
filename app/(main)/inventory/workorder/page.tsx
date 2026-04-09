"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import WorkOrderViewDialog from "./_components/WorkOrderViewDialog";
import WorkOrderAddEditDialog from "./_components/WorkOrderAddEditDialog";

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

type WorkOrderItemType =
  | "RawMaterial"
  | "PackagingItem"
  | "Product"
  | "OtherProduct";

type WorkOrderStatus =
  | "Pending"
  | "Processing"
  | "UnderReview"
  | "Approved"
  | "Completed"
  | "Cancelled"
  | string;

type ItemForm = {
  itemType?: WorkOrderItemType;
  itemId?: string | LookupItem;
  name?: string;
  description?: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  lineTotal?: number;
  remarks?: string;
  _id?: string;
};

type WorkOrderForm = {
  _id?: string;
  workOrderNo?: string;
  subject?: string;
  reference?: string;
  attention?: string;
  salutation?: string;
  supplier?: string | Supplier;
  warehouseOrFactory?: string | Warehouse;
  issueDate?: string;
  expectedDeliveryDate?: string;
  items?: ItemForm[];
  status?: WorkOrderStatus;
  notes?: string;
  terms?: string;
  selectedTemplateId?: string | null;
  discountPercent?: number;
  taxPercent?: number;
  subTotal?: number;
  discountAmount?: number;
  taxTotal?: number;
  grandTotal?: number;
  footerNote?: string;
  createdBy?: string;
  updatedBy?: string;
  approvedBy?: string;
  cancelReason?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

type TermsTemplate = { _id?: string; title: string; content: string };

type WorkOrderListResponse = {
  success?: boolean;
  data?: WorkOrderForm[];
  total?: number;
  page?: number;
  limit?: number;
};

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
  { label: string; icon: any; pill: string; dot: string }
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
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString();
}

function labelOfSupplier(v: any) {
  return v?.supplierName || v?.name || "-";
}

function labelOfWarehouse(v: any) {
  return v?.name || "-";
}

function useLookupMap<T extends { _id: string }>(items: T[]) {
  return useMemo(() => new Map(items.map((item) => [item._id, item])), [items]);
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

function normalizeWorkOrder(doc: WorkOrderForm) {
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
  if (!status) return <span className="text-sm text-muted-foreground">-</span>;
  const meta = getStatusMeta(status);
  const Icon = meta.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${meta.pill}`}
    >
      <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
      <Icon className="h-3.5 w-3.5" />
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
        <span className="text-xs font-medium text-muted-foreground">
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
                  "flex h-8 w-8 items-center justify-center rounded-full border text-[11px] font-semibold transition-all",
                  active
                    ? current
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                    : "border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500",
                ].join(" ")}
              >
                {i + 1}
              </div>

              {i < FLOW.length - 1 && (
                <div
                  className={[
                    "h-1 w-full rounded-full",
                    !cancelled && i < index
                      ? "bg-emerald-400"
                      : "bg-slate-200 dark:bg-slate-800",
                  ].join(" ")}
                />
              )}

              <span
                className={[
                  "text-center text-[10px] leading-tight",
                  active
                    ? "font-medium text-slate-700 dark:text-slate-200"
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
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
          Cancelled work orders stop the workflow immediately.
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
      return { key: "processing", label: "Start Processing" };
    case "Processing":
      return { key: "review", label: "Send to Review" };
    case "UnderReview":
      return { key: "approve", label: "Approve" };
    case "Approved":
      return { key: "complete", label: "Mark Completed" };
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
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border bg-card/70 p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-2 text-2xl font-bold tracking-tight">{value}</div>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
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
}: {
  wo: WorkOrderForm;
  onView: (wo: WorkOrderForm) => void;
  onEdit: (wo: WorkOrderForm) => void;
  onDelete: (id?: string) => void;
  onAction: (wo: WorkOrderForm, action: WorkflowAction) => void;
  onCancel: (wo: WorkOrderForm) => void;
}) {
  const nextAction = getNextAction(wo.status);
  const allowed = getAllowed(wo.status);

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold">
              {wo.workOrderNo || "Work Order"}
            </h3>
            <StatusBadge status={wo.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {wo.subject || "-"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-lg font-semibold">
            {formatCurrency(wo.grandTotal)}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">Supplier</p>
          <p className="mt-1 font-medium">{labelOfSupplier(wo.supplier)}</p>
        </div>
        <div className="rounded-xl bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">Warehouse</p>
          <p className="mt-1 font-medium">
            {labelOfWarehouse(wo.warehouseOrFactory)}
          </p>
        </div>
        <div className="rounded-xl bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">Issue</p>
          <p className="mt-1 font-medium">{formatDate(wo.issueDate)}</p>
        </div>
        <div className="rounded-xl bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">Expected</p>
          <p className="mt-1 font-medium">
            {formatDate(wo.expectedDeliveryDate)}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <WorkflowTracker status={wo.status} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => onView(wo)}>
          <Eye className="mr-2 h-4 w-4" />
          View
        </Button>

        {allowed.edit && (
          <Button size="sm" variant="outline" onClick={() => onEdit(wo)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
        )}

        {nextAction && (
          <Button size="sm" onClick={() => onAction(wo, nextAction.key)}>
            <ArrowRight className="mr-2 h-4 w-4" />
            {nextAction.label}
          </Button>
        )}

        {allowed.cancel && (
          <Button size="sm" variant="ghost" onClick={() => onCancel(wo)}>
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
        )}

        <Button
          size="sm"
          variant="destructive"
          onClick={() => onDelete(wo._id)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </div>
    </div>
  );
}

export default function WorkOrdersPage() {
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
  const [filterWarehouseOrFactory, setFilterWarehouseOrFactory] = useState<
    string | null
  >(null);
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
      const [supplierRes, warehouseRes, templateRes] = await Promise.allSettled(
        [
          api.get("/supplier", { params: { limit: 1000 } }),
          api.get("/warehouses", { params: { limit: 1000 } }),
          api.get("/settings/workorder-terms"),
        ],
      );

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
      },
      { label: "Pending", value: pending, hint: "Waiting to start" },
      { label: "In Progress", value: inProgress, hint: "Active workflow" },
      { label: "Completed", value: completed, hint: "Finished successfully" },
      {
        label: "Visible Value",
        value: formatCurrency(value),
        hint: `${templates.length} templates loaded`,
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
    <div className="space-y-6 p-4 md:p-6">
      <div className="rounded-[2rem] border bg-gradient-to-br from-background via-background to-muted/30 p-5 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border bg-muted/60 px-3 py-1 text-xs font-semibold text-muted-foreground">
                Operations
              </span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
                Workflow-first UI
              </span>
              <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-200">
                Fast approval flow
              </span>
            </div>

            <div>
              <h2 className="text-3xl font-bold tracking-tight">Work Orders</h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                A high-visibility workspace for creating, monitoring, and
                driving work orders through every stage.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={loadWorkOrders}
              disabled={loading}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={clearFilters}
              disabled={!hasFilters}
            >
              <FilterX className="mr-2 h-4 w-4" />
              Clear
            </Button>
            <Button onClick={onCreate} className="shadow-sm">
              <Plus className="mr-2 h-4 w-4" />
              Create Work Order
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {stats.map((s) => (
            <MiniStat
              key={s.label}
              label={s.label}
              value={s.value}
              hint={s.hint}
            />
          ))}
        </div>
      </div>

      <div className="rounded-[2rem] border bg-card shadow-sm">
        <div className="border-b p-4 md:p-5">
          <div className="grid gap-3 xl:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_auto] xl:items-center">
            <div className="flex items-center gap-3 rounded-2xl border bg-muted/30 px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search work order no, subject, reference, status"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
              />
            </div>

            <Select
              value={filterSupplier ?? NONE}
              onValueChange={(v) => setFilterSupplier(v === NONE ? null : v)}
            >
              <SelectTrigger className="h-11 rounded-2xl">
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
              <SelectTrigger className="h-11 rounded-2xl">
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
              <SelectTrigger className="h-11 rounded-2xl">
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

            <div className="flex items-center justify-between gap-2 xl:justify-end">
              <span className="text-sm text-muted-foreground">
                {activeFilterCount
                  ? `${activeFilterCount} filter(s)`
                  : "No filters"}
              </span>
              <Button onClick={onCreate} className="xl:hidden">
                <Plus className="mr-2 h-4 w-4" />
                Create
              </Button>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Live Work Orders</p>
              <p className="text-xs text-muted-foreground">
                Every row shows the active workflow stage in a visual tracker.
              </p>
            </div>
            {loadingDetail && (
              <div className="rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
                Loading detail...
              </div>
            )}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border md:block">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-[56px]">#</TableHead>
                    <TableHead>Work Order</TableHead>
                    <TableHead>Parties</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead className="min-w-[260px]">Workflow</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[320px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {workOrders.map((w, i) => {
                    const nextAction = getNextAction(w.status);
                    const allowed = getAllowed(w.status);

                    return (
                      <TableRow key={w._id || i} className="align-top">
                        <TableCell className="font-medium">
                          {(page - 1) * limit + i + 1}
                        </TableCell>

                        <TableCell>
                          <div className="font-semibold">
                            {w.workOrderNo || "-"}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {w.reference || "-"}
                          </div>
                          <div className="mt-2 max-w-[220px] truncate text-sm text-muted-foreground">
                            {w.subject || "-"}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="font-medium">
                            {getSupplierName(w.supplier)}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {getWarehouseName(w.warehouseOrFactory)}
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            {w.items?.length || 0} item(s)
                          </div>
                        </TableCell>

                        <TableCell>
                          <div>{formatDate(w.issueDate)}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Expected: {formatDate(w.expectedDeliveryDate)}
                          </div>
                        </TableCell>

                        <TableCell className="font-semibold">
                          {formatCurrency(w.grandTotal)}
                        </TableCell>

                        <TableCell className="min-w-[260px]">
                          <WorkflowTracker status={w.status} />
                        </TableCell>

                        <TableCell>
                          <StatusBadge status={w.status} />
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onView(w)}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </Button>

                            {allowed.edit && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onEdit(w)}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </Button>
                            )}

                            {nextAction && (
                              <Button
                                size="sm"
                                onClick={() => onAction(w, nextAction.key)}
                              >
                                <ArrowRight className="mr-2 h-4 w-4" />
                                {nextAction.label}
                              </Button>
                            )}

                            {allowed.cancel && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onCancel(w)}
                              >
                                <X className="mr-2 h-4 w-4" />
                                Cancel
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => onDelete(w._id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {!workOrders.length && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center">
                        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                          {loading ? (
                            <>
                              <RefreshCw className="h-5 w-5 animate-spin" />
                              <span>Loading work orders...</span>
                            </>
                          ) : (
                            <>
                              <span className="font-medium text-foreground">
                                No work orders found
                              </span>
                              <span className="text-sm">
                                Adjust filters or create a new work order to
                                begin.
                              </span>
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

          <div className="grid gap-4 md:hidden">
            {workOrders.map((w) => (
              <MobileCard
                key={w._id}
                wo={w}
                onView={onView}
                onEdit={onEdit}
                onDelete={onDelete}
                onAction={onAction}
                onCancel={onCancel}
              />
            ))}

            {!workOrders.length && (
              <div className="rounded-2xl border p-8 text-center text-sm text-muted-foreground">
                {loading ? "Loading work orders..." : "No work orders found"}
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-col gap-3 border-t pt-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-sm text-muted-foreground">
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
                className="h-10 rounded-xl border bg-background px-3 text-sm outline-none"
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
                >
                  Prev
                </Button>
                <div className="min-w-24 rounded-xl border bg-muted/30 px-3 py-2 text-center text-sm">
                  {page} / {totalPages}
                </div>
                <Button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  variant="outline"
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

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
