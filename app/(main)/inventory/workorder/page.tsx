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
  Plus,
  Edit,
  Trash2,
  Search,
  Eye,
  Check,
  X,
  Printer,
} from "lucide-react";
import { toast } from "sonner";

/**
 * Work Orders Page (single-file replacement)
 *
 * - Supports create/edit/view/print
 * - Supports improved status flow: Pending -> Processing -> Approved -> Completed -> Cancelled (cancel accepts reason)
 * - Adds GR (Goods Receipt) creation & management UI:
 *    - Create GR (file upload supported)
 *    - List GRs for WO
 *    - Approve / Reject GRs (reject requires reason)
 * - Does NOT enforce GR qty <= WO qty on client (per latest plan) — shows remaining & a warning
 *
 * If your backend has different GR route, replace `/grs` with the proper path.
 */

/* ----------------- Types ----------------- */
type IUser = { _id: string; name: string };
type Supplier = {
  _id: string;
  supplierName?: string;
  name?: string;
  address?: string;
  phoneNumber?: string;
  email?: string;
};
type Warehouse = { _id: string; name: string; address?: string };
type RawMaterial = {
  _id: string;
  name: string;
  unit?: string;
  salePrice?: number;
  purchasePrice?: number;
};
type PackagingItem = RawMaterial;

type ItemForm = {
  itemType?: "RawMaterial" | "PackagingItem";
  itemId?: string | RawMaterial | PackagingItem;
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
  status?: "Pending" | "Processing" | "Approved" | "Completed" | "Cancelled";
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
  createdBy?: string | IUser;
  approvedBy?: string | IUser;
  cancelReason?: string;
  createdAt?: string;
  updatedAt?: string;
};

type TermsTemplate = { _id?: string; title: string; content: string };

type GRItem = {
  itemType: "RawMaterial" | "PackagingItem";
  itemId: string;
  quantity: number;
  unit?: string;
  remarks?: string;
};

type GRForm = {
  workOrderId: string;
  grNo?: string;
  supplier?: string;
  warehouseOrFactory?: string;
  date?: string;
  items: GRItem[];
  notes?: string;
  attachments?: File[];
};

/* ----------------- Helpers: safe arithmetic & format ----------------- */
function safeMultiply(a: number, b: number) {
  return Math.round(a * b * 100) / 100;
}
function safeAdd(a: number, b: number) {
  return Math.round((a + b) * 100) / 100;
}
function formatCurrency(n?: number | null) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "-";
  const fixed = (Math.round((n as number) * 100) / 100).toFixed(2);
  return Number(fixed).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/* Number to words helper (kept simple) */
function numberToWords(num: number) {
  if (isNaN(num) || !isFinite(num)) return "";
  const a = [
    "",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
  ];
  const b = [
    "",
    "",
    "twenty",
    "thirty",
    "forty",
    "fifty",
    "sixty",
    "seventy",
    "eighty",
    "ninety",
  ];
  function toWords(n: number) {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? "-" + a[n % 10] : "");
    if (n < 1000)
      return (
        a[Math.floor(n / 100)] +
        " hundred" +
        (n % 100 ? " " + toWords(n % 100) : "")
      );
    if (n < 1000000)
      return (
        toWords(Math.floor(n / 1000)) +
        " thousand" +
        (n % 1000 ? " " + toWords(n % 1000) : "")
      );
    return (
      toWords(Math.floor(n / 1000000)) +
      " million" +
      (n % 1000000 ? " " + toWords(n % 1000000) : "")
    );
  }
  const intPart = Math.floor(Math.abs(num));
  const cents = Math.round((Math.abs(num) - intPart) * 100);
  const sign = num < 0 ? "minus " : "";
  const words = intPart === 0 ? "zero" : toWords(intPart);
  return `${sign}${words}${cents > 0 ? ` and ${cents}/100` : ""}`;
}

/* Compute totals (keeps original rounding semantics) */
function computeTotals(
  items: ItemForm[] = [],
  discountPercent = 0,
  taxPercent = 0,
) {
  let sub = 0;
  const cloned = (items || []).map((it) => ({ ...it }));
  for (let i = 0; i < cloned.length; i++) {
    const q = Number(cloned[i].quantity || 0);
    const p = Number(cloned[i].unitPrice || 0);
    const line = safeMultiply(q, p);
    cloned[i].lineTotal = line;
    sub = safeAdd(sub, line);
  }
  const discountAmount =
    Math.round(sub * (Number(discountPercent || 0) / 100) * 100) / 100;
  const taxedBase = Math.round((sub - discountAmount) * 100) / 100;
  const taxAmount =
    Math.round(taxedBase * (Number(taxPercent || 0) / 100) * 100) / 100;
  const grand = Math.round((taxedBase + taxAmount) * 100) / 100;
  return {
    items: cloned,
    subTotal: sub,
    discountAmount,
    taxTotal: taxAmount,
    grandTotal: grand,
  };
}

/* ----------------- Small utilities ----------------- */
const NONE = "none";
function getId(v?: any) {
  if (!v) return "";
  if (typeof v === "string") return v;
  return v._id ?? "";
}
function getName(v?: any) {
  if (!v) return "-";
  if (typeof v === "string") return v;
  return v.name ?? v.supplierName ?? "-";
}

/* ----------------- Main component ----------------- */
export default function WorkOrdersPage() {
  /* lookups */
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [packagingItems, setPackagingItems] = useState<PackagingItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [users, setUsers] = useState<IUser[]>([]);
  const [templates, setTemplates] = useState<TermsTemplate[]>([]);

  /* list + filters */
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

  /* modal / form state */
  const [openEdit, setOpenEdit] = useState(false);
  const [editing, setEditing] = useState<WorkOrderForm | null>(null);
  const [form, setForm] = useState<WorkOrderForm | null>(null);
  const [viewing, setViewing] = useState<WorkOrderForm | null>(null);

  /* GR state */
  const [grModalOpen, setGrModalOpen] = useState(false);
  const [grForm, setGrForm] = useState<GRForm | null>(null);
  const [grsForWo, setGrsForWo] = useState<any[]>([]); // minimal typing for GR list
  const [grLoading, setGrLoading] = useState(false);

  const [loadingWO, setLoadingWO] = useState(false);

  const printRef = useRef<HTMLDivElement | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  /* ----------------- Loaders ----------------- */
  const loadRawMaterials = useCallback(async () => {
    try {
      const res = await api.get("/raw-materials", { params: { limit: 1000 } });
      setRawMaterials(res.data.data || []);
    } catch {
      setRawMaterials([]);
    }
  }, []);

  const loadPackagingItems = useCallback(async () => {
    try {
      const res = await api.get("/packaging-items", {
        params: { limit: 1000 },
      });
      setPackagingItems(res.data.data || []);
    } catch {
      setPackagingItems([]);
    }
  }, []);

  const loadSuppliers = useCallback(async () => {
    try {
      const res = await api.get("/supplier", { params: { limit: 1000 } });
      setSuppliers(res.data.data || []);
    } catch {
      setSuppliers([]);
    }
  }, []);

  const loadWarehouses = useCallback(async () => {
    try {
      const res = await api.get("/warehouses?type=Factory", {
        params: { limit: 1000 },
      });
      setWarehouses(res.data.data || []);
    } catch {
      setWarehouses([]);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const me = await api.get("/users/me").catch(() => null);
      if (me?.data?.data) {
        const u: IUser = me.data.data;
        setUsers((prev) =>
          prev.find((x) => x._id === u._id) ? prev : [u, ...prev],
        );
      }
      const res = await api.get("/users", { params: { limit: 1000 } });
      setUsers((prev) => (res?.data?.data?.length ? res.data.data : prev));
    } catch {
      // ignore
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await api.get("/settings/workorder-terms");
      if (res?.data?.data) {
        setTemplates(res.data.data);
        return;
      }
    } catch {
      // fallback
    }
    setTemplates([
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
    ]);
  }, []);

  const loadWorkOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit };
      if (q) params.q = q;
      const filters: any = {};
      if (filterSupplier) filters.supplier = filterSupplier;
      if (filterWarehouseOrFactory)
        filters.warehouseOrFactory = filterWarehouseOrFactory;
      if (filterStatus) filters.status = filterStatus;
      if (Object.keys(filters).length) params.filter = JSON.stringify(filters);

      const res = await api.get("/workorders", { params });
      setWorkOrders(res.data.data || []);
      setTotal(res.data.total ?? 0);
    } catch {
      toast.error("Failed to load work orders");
      setWorkOrders([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, limit, q, filterSupplier, filterWarehouseOrFactory, filterStatus]);

  useEffect(() => {
    loadRawMaterials();
    loadPackagingItems();
    loadSuppliers();
    loadWarehouses();
    loadUsers();
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
  }, [q, filterSupplier, filterWarehouseOrFactory, filterStatus, limit]);

  useEffect(() => {
    loadWorkOrders();
  }, [loadWorkOrders]);

  /* ----------------- Form helpers ----------------- */
  const createEmptyItem = useCallback(
    (): ItemForm => ({
      itemType: "RawMaterial",
      itemId: "",
      description: "",
      quantity: 1,
      unit: "",
      unitPrice: 0,
      lineTotal: 0,
      remarks: "",
    }),
    [],
  );

  const onCreate = useCallback(async () => {
    try {
      const res = await api.get("/workorders/generate-no");
      const no = res?.data?.data;
      let createdBy = undefined;
      try {
        const me = await api.get("/users/me");
        if (me?.data?.data) createdBy = me.data.data._id;
      } catch {
        if (users.length) createdBy = users[0]._id;
      }

      const tpl = templates?.[0];
      const newForm: WorkOrderForm = {
        workOrderNo: no,
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
        terms: tpl?.content ?? "",
        selectedTemplateId: tpl?._id ?? null,
        discountPercent: 0,
        taxPercent: 0,
        subTotal: 0,
        discountAmount: 0,
        taxTotal: 0,
        grandTotal: 0,
        footerNote: "Thank you for your business.",
        createdBy,
      };

      setEditing(null);
      setForm(newForm);
      setOpenEdit(true);
    } catch {
      toast.error("Failed to generate work order number");
    }
  }, [templates, users, createEmptyItem]);

  const onEdit = useCallback(async (wo: WorkOrderForm) => {
    try {
      const res = await api.get(`/workorders/${getId(wo._id)}`);
      const doc: WorkOrderForm = res.data.data;
      const totals = computeTotals(
        doc.items || [],
        doc.discountPercent || 0,
        doc.taxPercent || 0,
      );
      doc.items = totals.items;
      doc.subTotal = totals.subTotal;
      doc.discountAmount = totals.discountAmount;
      doc.taxTotal = totals.taxTotal;
      doc.grandTotal = totals.grandTotal;
      setEditing(doc);
      setForm(doc);
      setOpenEdit(true);
    } catch {
      toast.error("Failed to load work order");
    }
  }, []);

  const onView = useCallback(async (wo: WorkOrderForm) => {
    try {
      setLoadingWO(true);
      const res = await api.get(`/workorders/${getId(wo._id)}`);
      const doc: WorkOrderForm = res.data.data;
      const totals = computeTotals(
        doc.items || [],
        doc.discountPercent || 0,
        doc.taxPercent || 0,
      );
      doc.items = totals.items;
      doc.subTotal = totals.subTotal;
      doc.discountAmount = totals.discountAmount;
      doc.taxTotal = totals.taxTotal;
      doc.grandTotal = totals.grandTotal;
      setViewing(doc);

      // load GRs for this WO (to show remaining qty and GR list)
      await loadGRsForWorkOrder(String(doc._id));
    } catch {
      toast.error("Failed to load work order");
    } finally {
      setLoadingWO(false);
    }
  }, []);

  const onDelete = useCallback(
    async (id?: string) => {
      if (!id) return;
      if (!confirm("Delete this work order?")) return;
      try {
        await api.delete(`/workorders/${id}?hard=true`);
        toast.success("Deleted");
        loadWorkOrders();
      } catch {
        toast.error("Failed to delete");
      }
    },
    [loadWorkOrders],
  );

  const addItemRow = useCallback(() => {
    if (!form) return;
    setForm({ ...form, items: [...(form.items || []), createEmptyItem()] });
  }, [form, createEmptyItem]);

  const removeItemRow = useCallback(
    (index: number) => {
      if (!form) return;
      const items = (form.items || []).filter((_, i) => i !== index);
      const totals = computeTotals(
        items,
        form.discountPercent || 0,
        form.taxPercent || 0,
      );
      setForm({
        ...form,
        items: totals.items,
        subTotal: totals.subTotal,
        discountAmount: totals.discountAmount,
        taxTotal: totals.taxTotal,
        grandTotal: totals.grandTotal,
      });
    },
    [form],
  );

  const selectItemForRow = useCallback(
    async (index: number, itemType: string, itemId: string) => {
      if (!form) return;
      try {
        const endpoint =
          itemType === "RawMaterial" ? "/raw-materials" : "/packaging-items";
        const res = await api.get(`${endpoint}/${itemId}`);
        const picked = res.data.data;
        const unit = picked?.unit || "";
        const price = picked?.salePrice ?? picked?.purchasePrice ?? 0;

        const items = (form.items || []).map((it, i) =>
          i === index
            ? {
                ...(it || {}),
                itemType: itemType as "RawMaterial" | "PackagingItem",
                itemId: itemId,
                unit,
                unitPrice: price,
                description: it.description || picked?.name || it.description,
              }
            : it,
        );
        const totals = computeTotals(
          items,
          form.discountPercent || 0,
          form.taxPercent || 0,
        );
        setForm({
          ...form,
          items: totals.items,
          subTotal: totals.subTotal,
          discountAmount: totals.discountAmount,
          taxTotal: totals.taxTotal,
          grandTotal: totals.grandTotal,
        });
      } catch {
        toast.error("Failed to load item");
      }
    },
    [form],
  );

  const updateItemField = useCallback(
    (index: number, patch: Partial<ItemForm>) => {
      if (!form) return;
      const items = (form.items || []).map((it, i) =>
        i === index ? { ...(it || {}), ...patch } : it,
      );
      const totals = computeTotals(
        items,
        form.discountPercent || 0,
        form.taxPercent || 0,
      );
      setForm({
        ...form,
        items: totals.items,
        subTotal: totals.subTotal,
        discountAmount: totals.discountAmount,
        taxTotal: totals.taxTotal,
        grandTotal: totals.grandTotal,
      });
    },
    [form],
  );

  const onTemplateChange = useCallback(
    (templateId: string | null) => {
      if (!form) return;
      if (!templateId || templateId === NONE || templateId === "custom") {
        setForm({ ...form, selectedTemplateId: null, terms: "" });
        return;
      }
      const t = templates.find((x) => x._id === templateId);
      if (t) setForm({ ...form, selectedTemplateId: t._id, terms: t.content });
      else setForm({ ...form, selectedTemplateId: null, terms: "" });
    },
    [form, templates],
  );

  const updateDiscountTax = useCallback(
    (discountPercent?: number | null, taxPercent?: number | null) => {
      if (!form) return;
      const d =
        discountPercent !== undefined && discountPercent !== null
          ? discountPercent
          : form.discountPercent || 0;
      const t =
        taxPercent !== undefined && taxPercent !== null
          ? taxPercent
          : form.taxPercent || 0;
      const totals = computeTotals(form.items || [], d, t);
      setForm({
        ...form,
        discountPercent: d,
        taxPercent: t,
        items: totals.items,
        subTotal: totals.subTotal,
        discountAmount: totals.discountAmount,
        taxTotal: totals.taxTotal,
        grandTotal: totals.grandTotal,
      });
    },
    [form],
  );

  const submitForm = useCallback(async () => {
    if (!form) return;
    try {
      if (!form.supplier) return toast.error("Select supplier");
      if (!form.warehouseOrFactory)
        return toast.error("Select warehouse/factory");
      if (!form.items || form.items.length === 0)
        return toast.error("Add at least one item");
      for (const it of form.items) {
        if (!it.itemType) return toast.error("Select item type for each row");
        if (!it.itemId) return toast.error("Select item for each row");
        if (!it.quantity || Number(it.quantity) <= 0)
          return toast.error("Item quantity must be > 0");
      }

      const payload: any = {
        workOrderNo: form.workOrderNo,
        supplier: getId(form.supplier),
        warehouseOrFactory: getId(form.warehouseOrFactory),
        issueDate: form.issueDate,
        expectedDeliveryDate: form.expectedDeliveryDate,
        items: (form.items || []).map((it) => ({
          itemType: it.itemType,
          itemId: getId(it.itemId),
          description: it.description || "",
          quantity: Number(it.quantity || 0),
          unit: it.unit || "",
          unitPrice: Number(it.unitPrice || 0),
          lineTotal: Number(it.lineTotal || 0),
          remarks: it.remarks || "",
        })),
        status: form.status,
        notes: form.notes,
        terms: form.terms,
        discountPercent: Number(form.discountPercent || 0),
        taxPercent: Number(form.taxPercent || 0),
        subTotal: form.subTotal,
        discountAmount: form.discountAmount,
        taxTotal: form.taxTotal,
        grandTotal: form.grandTotal,
        footerNote: form.footerNote,
        createdBy: getId(form.createdBy),
        approvedBy: form.approvedBy ? getId(form.approvedBy) : undefined,
      };

      if (editing && editing._id) {
        await api.put(`/workorders/${editing._id}`, payload);
        toast.success("Work order updated");
      } else {
        await api.post("/workorders", payload);
        toast.success("Work order created");
      }

      setOpenEdit(false);
      loadWorkOrders();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Save failed");
    }
  }, [form, editing, loadWorkOrders]);

  /* ----------------- Status actions (matches backend update patterns) ----------------- */
  const updateStatus = useCallback(
    async (
      wo: WorkOrderForm,
      status: WorkOrderForm["status"],
      reason?: string,
    ) => {
      try {
        let currentUserId: string | undefined;
        try {
          const me = await api.get("/users/me");
          currentUserId = me?.data?.data?._id;
        } catch {
          currentUserId = users?.[0]?._id;
        }

        /* send PUT /workorders/:id with { status, cancelReason?, approvedBy? } */
        const payload: any = { status };
        if (status === "Processing") payload.approvedBy = currentUserId;
        if (status === "Cancelled" && reason) payload.cancelReason = reason;

        await api.put(`/workorders/${getId(wo._id)}`, payload);

        toast.success(`Status updated to ${status}`);
        loadWorkOrders();
        if (viewing && viewing._id === wo._id) {
          onView(wo);
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to update status");
      }
    },
    [users, loadWorkOrders, viewing, onView],
  );

  /* ----------------- Printing ----------------- */
  const printInvoice = useCallback(
    (doc: WorkOrderForm | null) => {
      if (!doc) return;
      const win = window.open("", "_blank");
      if (!win) return toast.error("Pop-up blocked");
      const html = renderPrintableInvoiceHtml(doc);
      win.document.open();
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 300);
    },
    [suppliers, warehouses],
  );

  function escapeHtml(s?: string) {
    if (!s) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br/>");
  }

  function lookupItemName(itemType?: string, itemId?: any) {
    if (!itemId) return "-";
    const id = typeof itemId === "string" ? itemId : itemId._id;
    if (itemType === "RawMaterial") {
      return rawMaterials.find((r) => r._id === id)?.name ?? "-";
    }
    if (itemType === "PackagingItem") {
      return packagingItems.find((p) => p._id === id)?.name ?? "-";
    }
    return "-";
  }

  function renderPrintableInvoiceHtml(doc: WorkOrderForm) {
    const supplier =
      typeof doc.supplier === "string"
        ? suppliers.find((s) => s._id === doc.supplier)
        : (doc.supplier as Supplier | undefined);
    const warehouse =
      typeof doc.warehouseOrFactory === "string"
        ? warehouses.find((w) => w._id === doc.warehouseOrFactory)
        : (doc.warehouseOrFactory as Warehouse | undefined);
    const rows = (doc.items || [])
      .map(
        (it, i) => `
      <tr>
        <td style="padding:8px;border:1px solid #ddd">${i + 1}</td>
        <td style="padding:8px;border:1px solid #ddd">${escapeHtml(lookupItemName(it.itemType, it.itemId))}</td>
        <td style="padding:8px;border:1px solid #ddd">${escapeHtml(it.description || "")}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:right">${it.quantity ?? 0}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:right">${formatCurrency(it.unitPrice)}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:right">${formatCurrency(it.lineTotal)}</td>
      </tr>
    `,
      )
      .join("");
    return `
      <html><head><meta charset="utf-8"/><title>Work Order ${doc.workOrderNo}</title>
      <style>
        body{font-family:Arial;color:#111;padding:20px}
        table{border-collapse:collapse;width:100%;margin-top:12px}
        th,td{border:1px solid #ddd;padding:8px}
        th{background:#f8f8f8}
        .right{text-align:right}
      </style>
      </head><body>
      <div style="display:flex;justify-content:space-between">
        <div><strong>Your Company Name</strong><div>Address</div></div>
        <div style="text-align:right"><strong>WORK ORDER</strong><div>${escapeHtml(doc.workOrderNo || "")}</div><div>Issue: ${escapeHtml(doc.issueDate || "")}</div></div>
      </div>
      <div style="margin-top:12px">
        <strong>To:</strong> ${escapeHtml(supplier?.supplierName || supplier?.name || "-")}<br/>
        <strong>Factory:</strong> ${escapeHtml(warehouse?.name || "-")}
      </div>
      <table>
        <thead><tr><th>#</th><th>Item</th><th>Description</th><th class="right">Qty</th><th class="right">Unit Price</th><th class="right">Total</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>

      <div style="width:350px;margin-left:auto;margin-top:12px">
        <div style="display:flex;justify-content:space-between"><div>Subtotal</div><div>${formatCurrency(doc.subTotal)}</div></div>
        <div style="display:flex;justify-content:space-between"><div>Discount</div><div>- ${formatCurrency(doc.discountAmount || 0)}</div></div>
        <div style="display:flex;justify-content:space-between"><div>Tax</div><div>${formatCurrency(doc.taxTotal)}</div></div>
        <div style="display:flex;justify-content:space-between;font-weight:700"><div>Grand Total</div><div>${formatCurrency(doc.grandTotal)}</div></div>
      </div>
      </body></html>
    `;
  }

  /* ----------------- GR helpers ----------------- */
  async function loadGRsForWorkOrder(woId: string) {
    setGrLoading(true);
    try {
      // backend expected to support filter param
      const res = await api.get("/grs", {
        params: { filter: JSON.stringify({ workOrderId: woId }), limit: 100 },
      });
      setGrsForWo(res.data.data || []);
    } catch (err) {
      setGrsForWo([]);
    } finally {
      setGrLoading(false);
    }
  }

  function computeReceivedQtyMap(grs: any[]) {
    // returns map itemId -> received qty (sum of all approved GR items)
    const map: Record<string, number> = {};
    for (const g of grs) {
      if (!g.items) continue;
      for (const it of g.items) {
        const key = `${it.itemType}:${it.itemId}`;
        map[key] = (map[key] || 0) + Number(it.quantity || 0);
      }
    }
    return map;
  }

  function openCreateGRForWorkOrder(wo: WorkOrderForm) {
    const items = (wo.items || []).map((it) => ({
      itemType: it.itemType || "RawMaterial",
      itemId: getId(it.itemId),
      quantity: 0,
      unit: it.unit || "",
      remarks: "",
    }));
    setGrForm({
      workOrderId: String(wo._id),
      grNo: undefined,
      supplier: getId(wo.supplier),
      warehouseOrFactory: getId(wo.warehouseOrFactory),
      date: new Date().toISOString().slice(0, 10),
      items,
      notes: "",
      attachments: [],
    });
    setGrModalOpen(true);
  }

  // ============================= Create G.R. =============================
  async function submitGR() {
    if (!grForm) return;
    try {
      const fd = new FormData();
      fd.append("workOrderId", grForm.workOrderId);
      fd.append("supplier", grForm.supplier || "");
      fd.append("warehouseOrFactory", grForm.warehouseOrFactory || "");
      fd.append("date", grForm.date || new Date().toISOString().slice(0, 10));
      fd.append("notes", grForm.notes || "");

      fd.append(
        "items",
        JSON.stringify(
          grForm.items.map((it) => ({
            itemType: it.itemType,
            itemId: it.itemId,
            quantity: Number(it.quantity || 0),
            unit: it.unit || "",
            remarks: it.remarks || "",
          })),
        ),
      );

      (grForm.attachments || []).forEach((f, idx) => {
        fd.append("attachments", f, f.name || `file-${idx}`);
      });

      await api.post("/grs", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success("GR created");
      setGrModalOpen(false);
      if (viewing) await loadGRsForWorkOrder(String(viewing._id));
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to create GR");
    }
  }
  // =======================xxx=== Create G.R. ===xxx=======================

  // ============================= Update G.R. Status =============================
  async function updateGRStatus(
    grId: string,
    status: "Approved" | "Rejected",
    reason?: string,
  ) {
    try {
      const payload: any = { status };
      if (status === "Rejected") payload.rejectReason = reason;
      await api.put(`/grs/${grId}`, payload);
      toast.success(`GR ${status.toLowerCase()}`);
      if (viewing) await loadGRsForWorkOrder(String(viewing._id));
      // Optionally reload workorder to reflect any side-effects
      if (viewing) onView(viewing);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update GR");
    }
  }
  // =======================xxx=== Update G.R. Status ===xxx=======================

  /* ----------------- render helpers ----------------- */
  function StatusBadge({ status }: { status?: string }) {
    if (!status) return <span>-</span>;
    const base =
      "px-2 py-1 rounded text-sm font-semibold inline-block text-white";
    switch (status) {
      case "Pending":
        return <span className={`${base} bg-yellow-600`}>{status}</span>;
      case "Processing":
        return <span className={`${base} bg-blue-600`}>{status}</span>;
      case "Approved":
        return <span className={`${base} bg-indigo-600`}>{status}</span>;
      case "Completed":
        return <span className={`${base} bg-green-600`}>{status}</span>;
      case "Cancelled":
        return <span className={`${base} bg-red-600`}>{status}</span>;
      default:
        return <span className={`${base} bg-gray-600`}>{status}</span>;
    }
  }

  /* ----------------- small subcomponents for search (simple) ----------------- */
  function SearchableSelect({
    endpoint = "/supplier",
    value,
    onChange,
    placeholder = "Search...",
    labelKey = (s: any) => s.supplierName || s.name,
  }: {
    endpoint?: string;
    value?: string | null;
    onChange: (v: string | null) => void;
    placeholder?: string;
    labelKey?: (s: any) => string;
  }) {
    const [qLocal, setQLocal] = useState("");
    const [items, setItems] = useState<any[]>([]);
    const [loadingLocal, setLoadingLocal] = useState(false);

    useEffect(() => {
      let mounted = true;
      const fetcher = async () => {
        setLoadingLocal(true);
        try {
          const res = await api.get(endpoint, {
            params: { q: qLocal, limit: 50 },
          });
          if (!mounted) return;
          setItems(res.data.data || []);
        } catch {
          if (!mounted) return;
          setItems([]);
        } finally {
          if (mounted) setLoadingLocal(false);
        }
      };
      const id = setTimeout(fetcher, 250);
      return () => {
        mounted = false;
        clearTimeout(id);
      };
    }, [qLocal, endpoint]);

    return (
      <div>
        <div className="flex gap-2">
          <Input
            placeholder={placeholder}
            value={qLocal}
            onChange={(e) => setQLocal(e.target.value)}
          />
          <Button
            variant="ghost"
            onClick={() => {
              setQLocal("");
              onChange(null);
            }}
          >
            Clear
          </Button>
        </div>
        <div className="mt-2 border rounded max-h-44 overflow-auto bg-white">
          {loadingLocal && (
            <div className="p-2 text-sm text-muted-foreground">
              Searching...
            </div>
          )}
          {!loadingLocal && items.length === 0 && (
            <div className="p-2 text-sm text-muted-foreground">No results</div>
          )}
          {items.map((it) => (
            <div
              key={it._id}
              className="p-2 hover:bg-gray-50 cursor-pointer"
              onClick={() => {
                onChange(it._id);
                setQLocal(labelKey(it));
              }}
            >
              {labelKey(it)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ----------------- UI: main render ----------------- */
  return (
    <div className="p-4 space-y-6">
      {/* Header controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Work Orders</h2>
          <p className="text-sm text-muted-foreground">
            Create, approve, and manage Work Orders. Create GRs from approved
            work orders.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded px-2 py-1 gap-2 bg-white">
            <Search className="w-4 h-4 text-gray-500" />
            <Input
              placeholder="Search by WO#, supplier..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-64"
            />
          </div>

          <Select
            value={filterSupplier ?? NONE}
            onValueChange={(v) => setFilterSupplier(v === NONE ? null : v)}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by Supplier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>All Suppliers</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s._1 || s._id} value={s._id}>
                  {s.supplierName || s.name}
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
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by Warehouse/Factory" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>All Warehouses</SelectItem>
              {warehouses.map((w) => (
                <SelectItem key={w._id} value={w._id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filterStatus ?? NONE}
            onValueChange={(v) => setFilterStatus(v === NONE ? null : v)}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>All Status</SelectItem>
              {[
                "Pending",
                "Processing",
                "Approved",
                "Completed",
                "Cancelled",
              ].map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={onCreate}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" /> Create WO
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>WO No</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Grand Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-64">Action</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {workOrders.map((w, i) => (
                <TableRow key={w._id || i}>
                  <TableCell>{(page - 1) * limit + i + 1}</TableCell>
                  <TableCell>{w.workOrderNo}</TableCell>
                  <TableCell>{w.subject}</TableCell>
                  <TableCell>
                    {w.supplier && typeof w.supplier !== "string"
                      ? (w.supplier as any).supplierName ||
                        (w.supplier as any).name
                      : ((w.supplier as any)?.supplierName ?? "-")}
                  </TableCell>
                  <TableCell>
                    {w.issueDate
                      ? new Date(w.issueDate).toLocaleDateString()
                      : "-"}
                  </TableCell>
                  <TableCell>{formatCurrency(w.grandTotal)}</TableCell>
                  <TableCell>
                    <StatusBadge status={w.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onView(w)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEdit(w)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => onDelete(w._id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>

                      {/* Approve / Process / Complete / Cancel */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => updateStatus(w, "Processing")}
                        disabled={w.status !== "Pending"}
                        title="Start Processing"
                      >
                        <Check className="w-4 h-4" />
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatus(w, "Approved")}
                        disabled={w.status !== "Processing"}
                        title="Approve"
                      >
                        Approve
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => updateStatus(w, "Completed")}
                        disabled={w.status !== "Approved"}
                        title="Mark Completed"
                      >
                        ✅
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const reason = prompt("Cancel reason (optional):");
                          updateStatus(w, "Cancelled", reason ?? undefined);
                        }}
                        disabled={
                          w.status === "Completed" || w.status === "Cancelled"
                        }
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {workOrders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-6">
                    {loading ? "Loading..." : "No work orders found"}
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

      {/* VIEW DIALOG */}
      <Dialog open={!!viewing} onOpenChange={() => setViewing(null)}>
        <DialogContent className="!w-full !max-w-[98vw] max-h-[95vh] h-full overflow-y-auto p-0 rounded-xl shadow-2xl bg-background border">
          {viewing && (
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold">Work Order / Quotation</h3>
                  <div className="text-sm text-muted-foreground">
                    {viewing?.workOrderNo}
                  </div>
                  <div className="mt-1">{viewing?.subject}</div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => printInvoice(viewing)}>
                    <Printer className="w-4 h-4" />
                  </Button>

                  {/* Start processing */}
                  <Button
                    variant="ghost"
                    onClick={() => updateStatus(viewing, "Processing")}
                    disabled={viewing?.status !== "Pending"}
                  >
                    Start Processing
                  </Button>

                  {/* Approve */}
                  <Button
                    variant="ghost"
                    onClick={() => {
                      const confirmer = confirm(
                        "Approve this work order? This action marks it as Approved and allows GR creation.",
                      );
                      if (confirmer) updateStatus(viewing, "Approved");
                    }}
                    disabled={viewing?.status !== "Processing"}
                  >
                    Approve
                  </Button>

                  {/* Create GR: allowed when Approved (or even earlier if you want) */}
                  {/* ============================= Create G.R. ============================= */}
                  <Button
                    variant="primary"
                    onClick={() => openCreateGRForWorkOrder(viewing)}
                    disabled={!viewing}
                  >
                    Create G.R.
                  </Button>
                  {/* =======================xxx=== Create G.R. ===xxx======================= */}

                  <Button
                    variant="ghost"
                    onClick={() => updateStatus(viewing, "Completed")}
                    disabled={viewing?.status !== "Approved"}
                  >
                    Mark Completed
                  </Button>

                  <Button
                    variant="destructive"
                    onClick={() => {
                      const reason = prompt("Cancel reason (required):");
                      if (!reason || !reason.trim())
                        return alert("Cancel reason required.");
                      updateStatus(viewing, "Cancelled", reason);
                    }}
                    disabled={
                      viewing?.status === "Completed" ||
                      viewing?.status === "Cancelled"
                    }
                  >
                    Cancel
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">To</div>
                    <div className="font-medium">
                      {getName(viewing?.supplier)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {(viewing?.supplier as any)?.address}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-muted-foreground">Factory</div>
                    <div className="font-medium">
                      {getName(viewing?.warehouseOrFactory)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {(viewing?.warehouseOrFactory as any)?.address}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-muted-foreground">Details</div>
                    <div>
                      Issue:{" "}
                      {viewing?.issueDate
                        ? new Date(viewing.issueDate).toLocaleDateString()
                        : "-"}
                    </div>
                    <div>
                      Expected:{" "}
                      {viewing?.expectedDeliveryDate
                        ? new Date(
                            viewing.expectedDeliveryDate,
                          ).toLocaleDateString()
                        : "-"}
                    </div>
                    <div>
                      Status: <StatusBadge status={viewing?.status} />
                    </div>
                    {viewing?.cancelReason && (
                      <div className="mt-2 text-sm text-red-600">
                        Cancel reason: {viewing.cancelReason}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <table className="w-full table-auto border-collapse">
                    <thead>
                      <tr>
                        <th className="p-2 border-b">#</th>
                        <th className="p-2 border-b">Item</th>
                        <th className="p-2 border-b">Description</th>
                        <th className="p-2 border-b text-right">Qty</th>
                        <th className="p-2 border-b text-right">Received</th>
                        <th className="p-2 border-b text-right">Unit</th>
                        <th className="p-2 border-b text-right">Unit Price</th>
                        <th className="p-2 border-b text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(viewing?.items || []).map((it, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-2 align-top">{idx + 1}</td>
                          <td className="p-2 align-top">
                            {lookupItemName(it.itemType, it.itemId)}
                          </td>
                          <td className="p-2 align-top">
                            {it.description || "-"}
                          </td>
                          <td className="p-2 align-top text-right">
                            {it.quantity}
                          </td>
                          <td className="p-2 align-top text-right">
                            {it.receivedQty}
                          </td>
                          <td className="p-2 align-top text-right">
                            {it.unit}
                          </td>
                          <td className="p-2 align-top text-right">
                            {formatCurrency(it.unitPrice)}
                          </td>
                          <td className="p-2 align-top text-right">
                            {formatCurrency(it.lineTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* GR summary & list */}
                <div className="border rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">
                      Goods Receipts (G.R) for this WO
                    </div>
                    <div>
                      <Button
                        size="sm"
                        onClick={() => loadGRsForWorkOrder(String(viewing._id))}
                      >
                        Refresh
                      </Button>
                    </div>
                  </div>

                  {grLoading ? (
                    <div>Loading GRs...</div>
                  ) : (
                    <>
                      <div className="text-sm mb-2">
                        G.R created for this WO: {grsForWo.length}
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full table-auto border-collapse">
                          <thead>
                            <tr>
                              <th className="p-2 border-b">#</th>
                              <th className="p-2 border-b">G.R No</th>
                              <th className="p-2 border-b">Date</th>
                              <th className="p-2 border-b">Status</th>
                              <th className="p-2 border-b">Total Items</th>
                              <th className="p-2 border-b">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {grsForWo.map((g: any, idx: number) => (
                              <tr key={g._id || idx}>
                                <td className="p-2">{idx + 1}</td>
                                <td className="p-2">{g.grNo || g._id}</td>
                                <td className="p-2">
                                  {g.date
                                    ? new Date(g.date).toLocaleDateString()
                                    : "-"}
                                </td>
                                <td className="p-2">
                                  <StatusBadge status={g.status} />
                                </td>
                                <td className="p-2">
                                  {(g.items || []).reduce(
                                    (s: number, it: any) =>
                                      s + Number(it.quantity || 0),
                                    0,
                                  )}
                                </td>
                                <td className="p-2">
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        // open small viewer for GR (simple alert for brevity) — you can expand into modal
                                        const details = (g.items || [])
                                          .map(
                                            (it: any) =>
                                              `${it.itemType} - ${lookupItemName(it.itemType, it.itemId)} : ${it.quantity}`,
                                          )
                                          .join("\n");
                                        alert(
                                          `G.R: ${g.grNo || g._id}\nStatus: ${g.status}\n\n${details}`,
                                        );
                                      }}
                                    >
                                      View
                                    </Button>

                                    {g.status === "Created" && (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={async () => {
                                            const ok = confirm(
                                              "Approve this GR? Approving will typically increase stock (server action).",
                                            );
                                            if (!ok) return;
                                            await updateGRStatus(
                                              g._id,
                                              "Approved",
                                            );
                                          }}
                                        >
                                          Approve
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="destructive"
                                          onClick={async () => {
                                            const reason = prompt(
                                              "Reject reason (required):",
                                            );
                                            if (!reason || !reason.trim())
                                              return alert(
                                                "Reject reason required.",
                                              );
                                            await updateGRStatus(
                                              g._id,
                                              "Rejected",
                                              reason,
                                            );
                                          }}
                                        >
                                          Reject
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                            {grsForWo.length === 0 && (
                              <tr>
                                <td
                                  colSpan={6}
                                  className="p-4 text-sm text-muted-foreground"
                                >
                                  No G.R records for this WO.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="md:w-1/2">
                    <div className="font-medium">Terms & Conditions</div>
                    <div className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {viewing?.terms}
                    </div>
                  </div>

                  <div className="md:w-1/2">
                    <div className="border rounded p-3">
                      <div className="flex justify-between">
                        <div>Subtotal</div>
                        <div>{formatCurrency(viewing?.subTotal)}</div>
                      </div>
                      <div className="flex justify-between">
                        <div>Discount</div>
                        <div>- {formatCurrency(viewing?.discountAmount)}</div>
                      </div>
                      <div className="flex justify-between">
                        <div>Tax</div>
                        <div>{formatCurrency(viewing?.taxTotal)}</div>
                      </div>
                      <div className="flex justify-between font-semibold text-lg mt-2">
                        <div>Grand Total</div>
                        <div>{formatCurrency(viewing?.grandTotal)}</div>
                      </div>
                      <div className="text-sm text-muted-foreground mt-2">
                        In words:{" "}
                        {viewing?.grandTotal
                          ? numberToWords(Number(viewing.grandTotal))
                          : ""}
                      </div>
                    </div>

                    <div className="mt-3 text-sm">
                      <div>Prepared By: {getName(viewing?.createdBy)}</div>
                      <div>Approved By: {getName(viewing?.approvedBy)}</div>
                      <div>Chairman: ____________________</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-4">
                <Button variant="ghost" onClick={() => setViewing(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* EDIT / CREATE DIALOG (kept relatively compact) */}
      <Dialog
        open={openEdit}
        onOpenChange={() => {
          setOpenEdit(false);
          setForm(null);
          setEditing(null);
        }}
      >
        <DialogContent className="!w-full !max-w-[98vw] max-h-[95vh] h-full overflow-y-auto p-0 rounded-xl shadow-2xl bg-background border">
          <div className="p-6 flex gap-6" style={{ minHeight: "70vh" }}>
            {/* left: form */}
            <div
              style={{ width: "42%", maxHeight: "80vh", overflowY: "auto" }}
              className="bg-white border p-4 rounded"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold">
                    {editing ? "Edit Work Order" : "Create Work Order"}
                  </h3>
                  <div className="text-sm text-muted-foreground">
                    WO#: {form?.workOrderNo}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      // Save draft locally
                      try {
                        localStorage.setItem("wo_draft", JSON.stringify(form));
                        toast.success("Draft saved to localStorage");
                      } catch {
                        toast.error("Failed to save draft");
                      }
                    }}
                  >
                    Save Draft
                  </Button>
                  <Button onClick={() => submitForm()}>
                    {editing ? "Save" : "Create"}
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="border rounded p-3">
                  <div className="text-sm font-semibold mb-3">
                    Reference & Subject
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <Input
                      label="Subject"
                      value={form?.subject || ""}
                      onChange={(e) =>
                        setForm({ ...(form || {}), subject: e.target.value })
                      }
                      placeholder="Subject / Title"
                    />
                    <Input
                      label="Reference"
                      value={form?.reference || ""}
                      onChange={(e) =>
                        setForm({ ...(form || {}), reference: e.target.value })
                      }
                      placeholder="Reference / PO #"
                    />
                  </div>
                </div>

                <div className="border rounded p-3">
                  <div className="text-sm font-semibold mb-3">Recipient</div>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="text-sm">Supplier</label>
                      <SearchableSelect
                        endpoint="/supplier"
                        value={
                          typeof form?.supplier === "string"
                            ? form?.supplier
                            : (form?.supplier as any)?._id
                        }
                        onChange={(v) =>
                          setForm({ ...(form || {}), supplier: v || "" })
                        }
                      />
                    </div>
                    <Input
                      label="Attention (To)"
                      value={form?.attention || ""}
                      onChange={(e) =>
                        setForm({ ...(form || {}), attention: e.target.value })
                      }
                      placeholder="Contact person / department"
                    />
                    <Input
                      label="Salutation"
                      value={form?.salutation || ""}
                      onChange={(e) =>
                        setForm({ ...(form || {}), salutation: e.target.value })
                      }
                      placeholder="Dear Sir / Madam,"
                    />
                  </div>
                </div>

                <div className="border rounded p-3">
                  <div className="text-sm font-semibold mb-3">
                    Logistics & Dates
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm">Select Factory</label>
                      <Select
                        value={
                          typeof form?.warehouseOrFactory === "string"
                            ? form?.warehouseOrFactory
                            : (form?.warehouseOrFactory as any)?._id || NONE
                        }
                        onValueChange={(v) =>
                          setForm({
                            ...(form || {}),
                            warehouseOrFactory: v === NONE ? "" : v,
                          })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select Warehouse/Factory" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Select Factory</SelectItem>
                          {warehouses.map((w) => (
                            <SelectItem key={w._id} value={w._id}>
                              {w.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm">Issue Date</label>
                      <Input
                        type="date"
                        value={form?.issueDate?.slice(0, 10) || ""}
                        onChange={(e) =>
                          setForm({
                            ...(form || {}),
                            issueDate: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div>
                      <label className="text-sm">Expected Delivery</label>
                      <Input
                        type="date"
                        value={form?.expectedDeliveryDate?.slice(0, 10) || ""}
                        onChange={(e) =>
                          setForm({
                            ...(form || {}),
                            expectedDeliveryDate: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div>
                      <label className="text-sm">Status</label>
                      <Select
                        value={form?.status || "Pending"}
                        onValueChange={(v) =>
                          setForm({ ...(form || {}), status: v as any })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          {[
                            "Pending",
                            "Processing",
                            "Approved",
                            "Completed",
                            "Cancelled",
                          ].map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="border rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-muted-foreground">Items</div>
                    <Button size="sm" onClick={() => addItemRow()}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Item
                    </Button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full table-auto border-collapse">
                      <thead>
                        <tr>
                          <th className="p-2 border-b">#</th>
                          <th className="p-2 border-b">Item</th>
                          <th className="p-2 border-b">Description</th>
                          <th className="p-2 border-b text-right">Qty</th>
                          <th className="p-2 border-b text-right">Unit</th>
                          <th className="p-2 border-b text-right">
                            Unit Price
                          </th>
                          <th className="p-2 border-b text-right">Total</th>
                          <th className="p-2 border-b">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(form?.items || []).map((it, idx) => {
                          const currentType = it.itemType || "RawMaterial";
                          return (
                            <tr key={idx} className="border-t">
                              <td className="p-2 align-top">{idx + 1}</td>
                              <td className="p-2 align-top">
                                <div className="flex flex-col gap-1">
                                  <Select
                                    value={currentType}
                                    onValueChange={(v) =>
                                      updateItemField(idx, {
                                        itemType: v as any,
                                        itemId: "",
                                      })
                                    }
                                  >
                                    <SelectTrigger className="w-40">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value={"RawMaterial"}>
                                        Raw Material
                                      </SelectItem>
                                      <SelectItem value={"PackagingItem"}>
                                        Packaging
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>

                                  <div style={{ minWidth: 220 }}>
                                    {currentType === "RawMaterial" ? (
                                      <SearchableSelect
                                        endpoint="/raw-materials"
                                        value={
                                          typeof it.itemId === "string"
                                            ? it.itemId
                                            : (it.itemId as any)?._id
                                        }
                                        onChange={(v) =>
                                          selectItemForRow(
                                            idx,
                                            "RawMaterial",
                                            v || "",
                                          )
                                        }
                                        placeholder="Search raw material..."
                                        labelKey={(r: any) => r.name}
                                      />
                                    ) : (
                                      <SearchableSelect
                                        endpoint="/packaging-items"
                                        value={
                                          typeof it.itemId === "string"
                                            ? it.itemId
                                            : (it.itemId as any)?._id
                                        }
                                        onChange={(v) =>
                                          selectItemForRow(
                                            idx,
                                            "PackagingItem",
                                            v || "",
                                          )
                                        }
                                        placeholder="Search packaging..."
                                        labelKey={(p: any) => p.name}
                                      />
                                    )}
                                  </div>
                                </div>
                              </td>

                              <td className="p-2 align-top">
                                <Input
                                  value={it.description || ""}
                                  onChange={(e) =>
                                    updateItemField(idx, {
                                      description: e.target.value,
                                    })
                                  }
                                />
                              </td>

                              <td className="p-2 align-top text-right">
                                <Input
                                  type="number"
                                  min={0}
                                  value={String(it.quantity ?? "")}
                                  onChange={(e) =>
                                    updateItemField(idx, {
                                      quantity: Number(e.target.value),
                                    })
                                  }
                                  className="w-20"
                                />
                              </td>

                              <td className="p-2 align-top text-right">
                                <Input
                                  value={it.unit || ""}
                                  onChange={(e) =>
                                    updateItemField(idx, {
                                      unit: e.target.value,
                                    })
                                  }
                                  className="w-20"
                                />
                              </td>

                              <td className="p-2 align-top text-right">
                                <Input
                                  type="number"
                                  min={0}
                                  value={String(it.unitPrice ?? "")}
                                  onChange={(e) =>
                                    updateItemField(idx, {
                                      unitPrice: Number(e.target.value),
                                    })
                                  }
                                  className="w-28"
                                />
                              </td>

                              <td className="p-2 align-top text-right font-medium">
                                {formatCurrency(it.lineTotal)}
                              </td>

                              <td className="p-2 align-top">
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => removeItemRow(idx)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="border rounded p-3">
                  <div className="text-sm font-semibold mb-3">
                    Totals & Calculations
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium">
                        Discount (%)
                      </label>
                      <Input
                        type="number"
                        min={0}
                        value={String(form?.discountPercent ?? 0)}
                        onChange={(e) =>
                          updateDiscountTax(Number(e.target.value), undefined)
                        }
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Tax (%)</label>
                      <Input
                        type="number"
                        min={0}
                        value={String(form?.taxPercent ?? 0)}
                        onChange={(e) =>
                          updateDiscountTax(undefined, Number(e.target.value))
                        }
                      />
                    </div>
                  </div>

                  <div className="mt-3 border rounded p-3">
                    <div className="flex justify-between">
                      <div>Subtotal</div>
                      <div>{formatCurrency(form?.subTotal)}</div>
                    </div>
                    <div className="flex justify-between">
                      <div>Discount</div>
                      <div>- {formatCurrency(form?.discountAmount)}</div>
                    </div>
                    <div className="flex justify-between">
                      <div>Tax</div>
                      <div>{formatCurrency(form?.taxTotal)}</div>
                    </div>
                    <div className="flex justify-between font-semibold text-lg mt-2">
                      <div>Grand Total</div>
                      <div>{formatCurrency(form?.grandTotal)}</div>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      In words:{" "}
                      {form?.grandTotal
                        ? numberToWords(Number(form.grandTotal))
                        : ""}
                    </div>
                  </div>
                </div>

                <div className="border rounded p-3">
                  <div className="text-sm font-semibold mb-3">
                    Terms & Notes
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <Select
                      value={(form?.selectedTemplateId as string) || NONE}
                      onValueChange={(v) =>
                        onTemplateChange(v === NONE ? null : v)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select template" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>
                          -- Choose Template --
                        </SelectItem>
                        {templates.map((t) => (
                          <SelectItem key={t._id} value={t._id}>
                            {t.title}
                          </SelectItem>
                        ))}
                        <SelectItem value={"custom"}>Custom / Empty</SelectItem>
                      </SelectContent>
                    </Select>

                    <label className="text-sm font-medium">
                      Terms & Conditions
                    </label>
                    <textarea
                      value={form?.terms || ""}
                      onChange={(e) =>
                        setForm({ ...(form || {}), terms: e.target.value })
                      }
                      className="w-full border rounded p-2 min-h-[120px]"
                    />

                    <label className="text-sm font-medium">Notes</label>
                    <textarea
                      value={form?.notes || ""}
                      onChange={(e) =>
                        setForm({ ...(form || {}), notes: e.target.value })
                      }
                      className="w-full border rounded p-2 min-h-[80px]"
                    />
                  </div>
                </div>

                <div className="border rounded p-3">
                  <div className="text-sm font-semibold mb-3">
                    Footer & Signatures
                  </div>
                  <Input
                    value={form?.footerNote || ""}
                    onChange={(e) =>
                      setForm({ ...(form || {}), footerNote: e.target.value })
                    }
                    placeholder="Footer note shown on printed document"
                  />
                </div>
              </div>
            </div>

            {/* right: preview */}
            <div
              style={{ width: "58%", maxHeight: "80vh", overflowY: "auto" }}
              ref={printRef}
            >
              <div className="bg-white border rounded-lg p-6 shadow-sm">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center text-sm">
                        Logo
                      </div>
                      <div>
                        <div className="text-lg font-bold">
                          Your Company Name
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Company address, phone, email
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">
                      WORK ORDER / QUOTATION
                    </div>
                    <div className="text-xl font-bold">{form?.workOrderNo}</div>
                    <div className="text-sm text-muted-foreground">
                      Issue: {form?.issueDate}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Ref: {form?.reference}
                    </div>
                    <div className="mt-2">
                      <StatusBadge status={form?.status} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                  <div>
                    <div className="text-sm text-muted-foreground">To</div>
                    <div className="font-medium">
                      {(
                        suppliers.find(
                          (s) => getId(form?.supplier) === s._id,
                        ) as any
                      )?.supplierName ||
                        (form?.supplier as any)?.supplierName ||
                        (form?.supplier as any)?.name}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Factory</div>
                    <div className="font-medium">
                      {
                        warehouses.find(
                          (d) => getId(form?.warehouseOrFactory) === d._id,
                        )?.name
                      }
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Subject</div>
                    <div className="font-medium">{form?.subject}</div>
                  </div>
                </div>

                <div className="overflow-x-auto mb-4">
                  <table className="w-full table-auto border-collapse">
                    <thead>
                      <tr>
                        <th className="p-2 border-b text-left">#</th>
                        <th className="p-2 border-b text-left">Item</th>
                        <th className="p-2 border-b text-left">Description</th>
                        <th className="p-2 border-b text-right">Qty</th>
                        <th className="p-2 border-b text-right">Unit</th>
                        <th className="p-2 border-b text-right">Unit Price</th>
                        <th className="p-2 border-b text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(form?.items || []).map((it, idx) => (
                        <tr key={idx}>
                          <td className="p-2 align-top">{idx + 1}</td>
                          <td className="p-2 align-top">
                            {lookupItemName(it.itemType, it.itemId)}
                          </td>
                          <td className="p-2 align-top">{it.description}</td>
                          <td className="p-2 align-top text-right">
                            {it.quantity}
                          </td>
                          <td className="p-2 align-top text-right">
                            {it.unit}
                          </td>
                          <td className="p-2 align-top text-right">
                            {formatCurrency(it.unitPrice)}
                          </td>
                          <td className="p-2 align-top text-right">
                            {formatCurrency(it.lineTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-start justify-between gap-6">
                  <div className="w-1/2">
                    <div className="text-sm text-muted-foreground mb-2">
                      Terms & Conditions
                    </div>
                    <div className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {form?.terms}
                    </div>
                    <div className="text-sm text-muted-foreground mt-4">
                      {form?.notes}
                    </div>
                  </div>

                  <div className="w-1/2">
                    <div className="border rounded p-4 bg-gray-50">
                      <div className="flex justify-between">
                        <div>Subtotal</div>
                        <div>{formatCurrency(form?.subTotal)}</div>
                      </div>
                      <div className="flex justify-between">
                        <div>Discount ({form?.discountPercent ?? 0}%)</div>
                        <div>- {formatCurrency(form?.discountAmount)}</div>
                      </div>
                      <div className="flex justify-between">
                        <div>Tax ({form?.taxPercent ?? 0}%)</div>
                        <div>{formatCurrency(form?.taxTotal)}</div>
                      </div>
                      <div className="flex justify-between font-semibold text-lg mt-2">
                        <div>Grand Total</div>
                        <div>{formatCurrency(form?.grandTotal)}</div>
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        In words:{" "}
                        {form?.grandTotal
                          ? numberToWords(Number(form.grandTotal))
                          : ""}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mt-6">
                      <div className="text-center">
                        <div className="h-16 border-b" />
                        <div className="text-sm mt-2">Prepared By</div>
                      </div>
                      <div className="text-center">
                        <div className="h-16 border-b" />
                        <div className="text-sm mt-2">Approved By</div>
                      </div>
                      <div className="text-center">
                        <div className="h-16 border-b" />
                        <div className="text-sm mt-2">Chairman</div>
                      </div>
                    </div>

                    <div className="text-sm text-muted-foreground mt-4">
                      {form?.footerNote}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* GR modal */}
      <Dialog open={grModalOpen} onOpenChange={() => setGrModalOpen(false)}>
        <DialogContent className="!w-full !max-w-[80vw] max-h-[90vh] p-0 rounded-xl shadow-2xl bg-background border">
          <div className="p-6">
            <h3 className="text-lg font-bold">Create Goods Receipt (G.R)</h3>
            <div className="mt-3 space-y-3">
              <div>
                <label className="text-sm">G.R Date</label>
                <Input
                  type="date"
                  value={grForm?.date || ""}
                  onChange={(e) =>
                    setGrForm((g) => (g ? { ...g, date: e.target.value } : g))
                  }
                />
              </div>

              <div>
                <label className="text-sm">Supplier</label>
                <Input
                  value={grForm?.supplier || ""}
                  onChange={(e) =>
                    setGrForm((g) =>
                      g ? { ...g, supplier: e.target.value } : g,
                    )
                  }
                  placeholder="Supplier id (prefilled)"
                />
              </div>

              <div>
                <label className="text-sm">Items (received)</label>
                <div className="overflow-x-auto">
                  <table className="w-full table-auto border-collapse">
                    <thead>
                      <tr>
                        <th className="p-2 border-b">#</th>
                        <th className="p-2 border-b">Item</th>
                        <th className="p-2 border-b text-right">Qty</th>
                        <th className="p-2 border-b">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(grForm?.items || []).map((it, idx) => (
                        <tr key={idx}>
                          <td className="p-2">{idx + 1}</td>
                          <td className="p-2">
                            {lookupItemName(it.itemType, it.itemId)}
                          </td>
                          <td className="p-2 text-right">
                            <Input
                              type="number"
                              min={0}
                              value={String(it.quantity ?? "")}
                              onChange={(e) =>
                                setGrForm((g) => {
                                  if (!g) return g;
                                  const items = g.items.map((x, i) =>
                                    i === idx
                                      ? {
                                          ...x,
                                          quantity: Number(e.target.value || 0),
                                        }
                                      : x,
                                  );
                                  return { ...g, items };
                                })
                              }
                              className="w-24"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              value={it.remarks || ""}
                              onChange={(e) =>
                                setGrForm((g) => {
                                  if (!g) return g;
                                  const items = g.items.map((x, i) =>
                                    i === idx
                                      ? { ...x, remarks: e.target.value }
                                      : x,
                                  );
                                  return { ...g, items };
                                })
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="text-sm text-muted-foreground mt-2">
                  Note: client does not enforce WO qty limits — server will
                  decide acceptance. You may exceed WO qty here; UI warns below.
                </div>
              </div>

              <div>
                <label className="text-sm">Attachments</label>
                <input
                  type="file"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setGrForm((g) =>
                      g
                        ? {
                            ...g,
                            attachments: [...(g.attachments || []), ...files],
                          }
                        : g,
                    );
                  }}
                />
                <div className="mt-2">
                  {(grForm?.attachments || []).map((f, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div>{f.name}</div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setGrForm((g) =>
                            g
                              ? {
                                  ...g,
                                  attachments: (g.attachments || []).filter(
                                    (_, j) => j !== i,
                                  ),
                                }
                              : g,
                          )
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
                  value={grForm?.notes || ""}
                  onChange={(e) =>
                    setGrForm((g) => (g ? { ...g, notes: e.target.value } : g))
                  }
                  className="w-full border rounded p-2 min-h-[80px]"
                />
              </div>

              {/* remaining qty warning (computed) */}
              <div className="text-sm text-muted-foreground">
                {(() => {
                  if (!viewing) return null;
                  const receivedMap = computeReceivedQtyMap(grsForWo || []);
                  let anyExceeded = false;
                  let msg = "";
                  for (const it of viewing.items || []) {
                    const key = `${it.itemType}:${getId(it.itemId)}`;
                    const received = receivedMap[key] || 0;
                    const requested = Number(it.quantity || 0);
                    // compute grForm requested for this item
                    const grRequestedForThis =
                      (grForm?.items || []).find(
                        (g) =>
                          g.itemId === getId(it.itemId) &&
                          g.itemType === it.itemType,
                      )?.quantity || 0;
                    const totalAfter = received + grRequestedForThis;
                    if (totalAfter > requested) {
                      anyExceeded = true;
                      msg += `${lookupItemName(it.itemType, it.itemId)}: WO qty=${requested}, received=${received}, GR adding=${grRequestedForThis} → will be ${totalAfter}\n`;
                    }
                  }
                  if (!anyExceeded)
                    return (
                      <div className="text-sm text-muted-foreground">
                        All GR quantities are within or equal to WO quantities
                        (server may still accept more if configured).
                      </div>
                    );
                  return (
                    <div className="text-sm text-red-600 whitespace-pre-wrap">
                      Warning: these items will exceed WO qty:\n{msg}
                    </div>
                  );
                })()}
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setGrModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => submitGR()}>Create G.R</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
