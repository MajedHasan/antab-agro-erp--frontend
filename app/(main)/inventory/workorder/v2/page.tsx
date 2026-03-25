"use client";

import React, { useEffect, useRef, useState } from "react";
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
import { motion, AnimatePresence } from "framer-motion";
import { FaTruck, FaBox, FaWalking } from "react-icons/fa"; // truck, package, person
import AnimatedCinematicStepper from "../_components/AnimatedCinematicStepper";
// import AnimatedCinematicStepper from "./_components/UltraCinematicStatusStepper";

/**
 * Full-width, scrollable left-edit / right-preview Work Order modal
 *
 * Notes:
 *  - Uses /raw-materials, /packaging-items, /supplier, /warehouses, /workorders endpoints
 *  - Uses /workorders/generate-no for WO number
 *  - Uses /settings/workorder-terms if present, otherwise fallback templates
 */

/* -------------------- Types -------------------- */
type IUser = { _id: string; name: string };
type Supplier = {
  _id: string;
  name: string;
  address?: string;
  phoneNumber?: string;
  email?: string;
  supplierName?: string;
};
type Warehouse = { _id: string; name: string; address?: string };

type RawMaterial = {
  _id: string;
  name: string;
  unit?: string;
  costPrice?: number;
  salePrice?: number;
  stock?: number;
};

type PackagingItem = {
  _id: string;
  name: string;
  unit?: string;
  costPrice?: number;
  salePrice?: number;
  stock?: number;
};

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
  status?: "Pending" | "Processing" | "Completed" | "Cancelled";
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
  createdAt?: string;
  updatedAt?: string;
};

type TermsTemplate = { _id?: string; title: string; content: string };

const NONE = "none";

/* -------------------- Component -------------------- */
export default function WorkOrdersPage() {
  // lookups
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [packagingItems, setPackagingItems] = useState<PackagingItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [users, setUsers] = useState<IUser[]>([]);
  const [templates, setTemplates] = useState<TermsTemplate[]>([]);

  // list + filters
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

  // modal state
  const [openEdit, setOpenEdit] = useState(false);
  const [editing, setEditing] = useState<WorkOrderForm | null>(null);
  const [form, setForm] = useState<WorkOrderForm | null>(null);
  const [viewing, setViewing] = useState<WorkOrderForm | null>(null);

  const printRef = useRef<HTMLDivElement | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  /* -------------------- Loaders -------------------- */
  const loadRawMaterials = async () => {
    try {
      const res = await api.get("/raw-materials", { params: { limit: 1000 } });
      setRawMaterials(res.data.data || []);
    } catch {
      setRawMaterials([]);
    }
  };

  const loadPackagingItems = async () => {
    try {
      const res = await api.get("/packaging-items", {
        params: { limit: 1000 },
      });
      setPackagingItems(res.data.data || []);
    } catch {
      setPackagingItems([]);
    }
  };

  const loadSuppliers = async () => {
    try {
      const res = await api.get("/supplier", { params: { limit: 1000 } });
      setSuppliers(res.data.data || []);
    } catch {
      setSuppliers([]);
    }
  };

  const loadWarehouses = async () => {
    try {
      // backend mounts warehouses at /warehouses (or /warehouses-or-factories)
      const res = await api.get("/warehouses?type=Factory", {
        params: { limit: 1000 },
      });
      setWarehouses(res.data.data || []);
    } catch {
      setWarehouses([]);
    }
  };

  const loadUsers = async () => {
    try {
      const me = await api.get("/users/me").catch(() => null);
      if (me?.data?.data) {
        const u: IUser = me.data.data;
        setUsers((prev) =>
          prev.find((x) => x._id === u._id) ? prev : [u, ...prev],
        );
      }
      const res = await api.get("/users", { params: { limit: 1000 } });
      setUsers(res.data.data && res.data.data.length ? res.data.data : users);
    } catch {
      // ignore
    }
  };

  const loadTemplates = async () => {
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
  };

  const loadWorkOrders = async () => {
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
  };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, q, filterSupplier, filterWarehouseOrFactory, filterStatus]);

  /* -------------------- Helpers -------------------- */
  function getId(v?: any) {
    if (!v) return "";
    if (typeof v === "string") return v;
    return v._id ?? "";
  }
  function getNameForItem(item?: any) {
    if (!item) return "-";
    if (typeof item === "string") return "-";
    return item.name ?? "-";
  }
  function getName(v?: any) {
    if (!v) return "-";
    if (typeof v === "string") return v;
    return v.name ?? "-";
  }
  function formatCurrency(n?: number | null) {
    if (n === null || n === undefined) return "-";
    // digit-by-digit safe rounding
    const fixed = (Math.round((n as number) * 100) / 100).toFixed(2);
    return Number(fixed).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

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
      if (n < 100)
        return b[Math.floor(n / 10)] + (n % 10 ? "-" + a[n % 10] : "");
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

  function computeTotals(
    items: ItemForm[] = [],
    discountPercent = 0,
    taxPercent = 0,
  ) {
    // compute safely, digit-by-digit
    let sub = 0;
    const cloned = (items || []).map((it) => ({ ...it }));
    for (let i = 0; i < cloned.length; i++) {
      const q = Number(cloned[i].quantity || 0);
      const p = Number(cloned[i].unitPrice || 0);
      const line = Math.round(q * p * 100) / 100;
      cloned[i].lineTotal = line;
      sub = Math.round((sub + line) * 100) / 100;
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

  /* -------------------- Form operations -------------------- */
  const createEmptyItem = (): ItemForm => ({
    itemType: "RawMaterial",
    itemId: "",
    description: "",
    quantity: 1,
    unit: "",
    unitPrice: 0,
    lineTotal: 0,
    remarks: "",
  });

  const onCreate = async () => {
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
  };

  const onEdit = async (wo: WorkOrderForm) => {
    try {
      const res = await api.get(`/workorders/${getId(wo._id)}`);
      const doc: WorkOrderForm = res.data.data;
      (doc.items || []).forEach((it) => {
        it.lineTotal = Number(
          it.lineTotal ?? Number(it.quantity || 0) * Number(it.unitPrice || 0),
        );
      });
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
  };

  const onView = async (wo: WorkOrderForm) => {
    try {
      const res = await api.get(`/workorders/${getId(wo._id)}`);
      const doc: WorkOrderForm = res.data.data;
      (doc.items || []).forEach((it) => {
        it.lineTotal = Number(
          it.lineTotal ?? Number(it.quantity || 0) * Number(it.unitPrice || 0),
        );
      });
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
    } catch {
      toast.error("Failed to load work order");
    }
  };

  const onDelete = async (id?: string) => {
    if (!id) return;
    if (!confirm("Delete this work order?")) return;
    try {
      await api.delete(`/workorders/${id}?hard=true`);
      toast.success("Deleted");
      loadWorkOrders();
    } catch {
      toast.error("Failed to delete");
    }
  };

  const addItemRow = () => {
    if (!form) return;
    setForm({ ...form, items: [...(form.items || []), createEmptyItem()] });
  };

  const removeItemRow = (index: number) => {
    if (!form) return;
    const items = (form.items || []).filter((_, i) => i !== index);
    const totals = computeTotals(
      items,
      form.discountPercent || 0,
      form.taxPercent || 0,
    );
    setForm({ ...form, items: totals.items, ...totals });
  };

  const selectItemForRow = (
    index: number,
    itemType: string,
    itemId: string,
  ) => {
    if (!form) return;
    const picked =
      itemType === "RawMaterial"
        ? rawMaterials.find((r) => r._id === itemId)
        : packagingItems.find((p) => p._id === itemId);

    const unit = (picked as any)?.unit || "";
    const price = (picked as any)?.salePrice ?? (picked as any)?.costPrice ?? 0;

    const items = (form.items || []).map((it, i) =>
      i === index
        ? {
            ...(it || {}),
            itemType: itemType as "RawMaterial" | "PackagingItem",
            itemId: itemId,
            unit,
            unitPrice: price,
          }
        : it,
    );
    const totals = computeTotals(
      items,
      form.discountPercent || 0,
      form.taxPercent || 0,
    );
    setForm({ ...form, items: totals.items, ...totals });
  };

  const updateItemField = (index: number, patch: Partial<ItemForm>) => {
    if (!form) return;
    const items = (form.items || []).map((it, i) =>
      i === index ? { ...(it || {}), ...patch } : it,
    );
    const totals = computeTotals(
      items,
      form.discountPercent || 0,
      form.taxPercent || 0,
    );
    setForm({ ...form, items: totals.items, ...totals });
  };

  const onTemplateChange = (templateId: string | null) => {
    if (!form) return;
    if (!templateId || templateId === NONE || templateId === "custom") {
      setForm({ ...form, selectedTemplateId: null, terms: "" });
      return;
    }
    const t = templates.find((x) => x._id === templateId);
    if (t) setForm({ ...form, selectedTemplateId: t._id, terms: t.content });
    else setForm({ ...form, selectedTemplateId: null, terms: "" });
  };

  const updateDiscountTax = (
    discountPercent?: number | null,
    taxPercent?: number | null,
  ) => {
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
    setForm({ ...form, discountPercent: d, taxPercent: t, ...totals });
  };

  const submitForm = async () => {
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
        warehouseOrFactory: getId(form.warehouseOrFactory), // backend expects warehouseOrFactory
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
  };

  /* -------------------- Status actions -------------------- */
  const updateStatus = async (
    wo: WorkOrderForm,
    status: WorkOrderForm["status"],
  ) => {
    try {
      let currentUserId: string | undefined;
      try {
        const me = await api.get("/users/me");
        currentUserId = me?.data?.data?._id;
      } catch {
        currentUserId = users?.[0]?._id;
      }

      if (status === "Completed") {
        // use the special endpoint that adjusts stock
        await api.post(`/workorders/${getId(wo._id)}/complete`);
      } else {
        const payload: any = { status };
        if (status === "Processing") payload.approvedBy = currentUserId;
        await api.put(`/workorders/${getId(wo._id)}`, payload);
      }

      toast.success(`Status updated to ${status}`);
      loadWorkOrders();
      if (viewing && viewing._id === wo._id) onView(wo);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update status");
    }
  };

  /* -------------------- Print -------------------- */
  const printInvoice = (doc: WorkOrderForm | null) => {
    if (!doc) return;
    const win = window.open("", "_blank") as Window | null;
    if (!win) return toast.error("Pop-up blocked");
    const html = renderPrintableInvoiceHtml(doc);
    win.document.open();
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

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
    const createdByName =
      typeof doc.createdBy === "string"
        ? (users.find((u) => u._id === doc.createdBy)?.name ?? "-")
        : ((doc.createdBy as any)?.name ?? "-");
    const approvedByName =
      typeof doc.approvedBy === "string"
        ? (users.find((u) => u._id === doc.approvedBy)?.name ?? "-")
        : ((doc.approvedBy as any)?.name ?? "-");

    const rows = (doc.items || [])
      .map(
        (it, i) => `
      <tr>
        <td style="padding:8px;border:1px solid #ddd">${i + 1}</td>
        <td style="padding:8px;border:1px solid #ddd">${escapeHtml(
          lookupItemName(it.itemType, it.itemId),
        )}</td>
        <td style="padding:8px;border:1px solid #ddd">${escapeHtml(
          it.description || "",
        )}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:right">${
          it.quantity ?? 0
        }</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:right">${formatCurrency(
          it.unitPrice,
        )}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:right">${formatCurrency(
          it.lineTotal,
        )}</td>
      </tr>
    `,
      )
      .join("");

    return `
      <html><head><meta charset="utf-8"/><title>Work Order ${
        doc.workOrderNo
      }</title>
      <style>
        body { font-family: Arial, sans-serif; padding:20px; color:#111 }
        .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px }
        table { border-collapse:collapse; width:100%; margin-top:12px }
        th, td { border:1px solid #ddd; padding:8px }
        th { background:#f8f8f8; text-align:left }
        .right { text-align:right }
        .totals { width:360px; float:right; margin-top:12px }
        .terms { margin-top:30px; white-space:pre-wrap }
        .sign { margin-top:40px; display:flex; justify-content:space-between }
        .footer { margin-top:40px; font-size:12px; color:#666; border-top:1px solid #eee; padding-top:8px }
      </style></head><body>
      <div class="header">
        <div><div style="font-weight:700;font-size:18px">Your Company Name</div><div>Address line 1</div><div>Phone / Email</div></div>
        <div style="text-align:right"><div style="font-weight:700">WORK ORDER / QUOTATION</div><div>${escapeHtml(
          doc.workOrderNo,
        )}</div><div>Issue Date: ${escapeHtml(
          doc.issueDate || "",
        )}</div><div>Ref: ${escapeHtml(doc.reference || "")}</div></div>
      </div>

      <div style="display:flex;gap:20px">
        <div style="flex:1">
          <strong>To:</strong><br/>${escapeHtml(
            supplier?.name ?? "-",
          )}<br/>${escapeHtml(
            (supplier as any)?.address ?? "",
          )}<br/>${escapeHtml((supplier as any)?.phoneNumber ?? "")}
        </div>
        <div style="flex:1">
          <strong>Warehouse:</strong><br/>${escapeHtml(
            warehouse?.name ?? "-",
          )}<br/>${escapeHtml((warehouse as any)?.address ?? "")}
        </div>
      </div>

      <p>${escapeHtml(doc.salutation || "")}</p>

      <table>
        <thead><tr><th>#</th><th>Item</th><th>Description</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="totals">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px;border:1px solid #ddd">Subtotal</td><td style="padding:6px;border:1px solid #ddd;text-align:right">${formatCurrency(
            doc.subTotal,
          )}</td></tr>
          <tr><td style="padding:6px;border:1px solid #ddd">Discount</td><td style="padding:6px;border:1px solid #ddd;text-align:right">- ${formatCurrency(
            doc.discountAmount || 0,
          )}</td></tr>
          <tr><td style="padding:6px;border:1px solid #ddd">Tax</td><td style="padding:6px;border:1px solid #ddd;text-align:right">${formatCurrency(
            doc.taxTotal,
          )}</td></tr>
          <tr><td style="padding:6px;border:1px solid #ddd"><strong>Grand Total</strong></td><td style="padding:6px;border:1px solid #ddd;text-align:right"><strong>${formatCurrency(
            doc.grandTotal,
          )}</strong></td></tr>
        </table>
      </div>

      <div style="clear:both"></div>

      <div class="terms"><strong>Terms & Conditions</strong><div>${escapeHtml(
        doc.terms || "",
      )}</div></div>

      <div class="sign"><div>Prepared By: ${escapeHtml(
        createdByName,
      )}</div><div>Approved By: ${escapeHtml(
        approvedByName,
      )}</div><div>Chairman: ____________________</div></div>

      <div class="footer">${escapeHtml(doc.footerNote || "")}</div>

      </body></html>
    `;
  }

  // Status progression order
  const STATUS_STEPS = ["Pending", "Processing", "Completed", "Cancelled"];

  function StatusProgress({ status }: { status: string }) {
    const currentIndex = STATUS_STEPS.indexOf(status);

    return (
      <div className="flex items-center gap-2">
        {STATUS_STEPS.map((step, idx) => (
          <div key={step} className="flex items-center">
            {/* Circle */}
            <motion.div
              layout
              initial={{ scale: 0 }}
              animate={{
                scale: idx <= currentIndex ? 1.2 : 1,
                backgroundColor:
                  idx < currentIndex
                    ? "#22c55e" // green for completed
                    : idx === currentIndex
                      ? "#3b82f6" // blue for active
                      : "#d1d5db", // gray for pending
                boxShadow:
                  idx === currentIndex
                    ? "0 0 10px rgba(59,130,246,0.5)"
                    : "none",
              }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs"
            >
              {idx + 1}
            </motion.div>

            {/* Connector line */}
            {idx < STATUS_STEPS.length - 1 && (
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: idx < currentIndex ? 1 : 0 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                className="h-1 bg-gradient-to-r from-blue-400 to-green-400 origin-left flex-1"
              />
            )}
          </div>
        ))}
        {/* Labels */}
        <div className="absolute -bottom-6 flex justify-between w-full text-xs text-gray-600 px-1">
          {STATUS_STEPS.map((s) => (
            <span key={s}>{s}</span>
          ))}
        </div>
      </div>
    );
  }

  function AnimatedTruckStepper({ status }: { status?: string | null }) {
    const steps = ["Pending", "Processing", "Completed"];
    const idx = steps.indexOf(status || "Pending");
    const safeIdx = Math.max(0, idx);

    const percent = (safeIdx / (steps.length - 1)) * 100;

    // trigger confetti
    const [burstKey, setBurstKey] = React.useState(0);
    React.useEffect(() => {
      if (status === "Completed") setBurstKey((k) => k + 1);
    }, [status]);

    // colors for steps
    const stepColors = ["#f59e0b", "#3b82f6", "#10b981"];

    // confetti
    const Confetti = ({ keyProp }: { keyProp: number }) => {
      const pieces = new Array(12).fill(0);
      return (
        <div style={{ position: "absolute", width: 0, height: 0 }}>
          {pieces.map((_, i) => (
            <motion.div
              key={`${keyProp}-${i}`}
              initial={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 0.5 }}
              animate={{
                x: (Math.random() - 0.5) * 80,
                y: -Math.random() * 60,
                rotate: Math.random() * 360,
                opacity: [1, 0],
                scale: [0.5, 1, 0.2],
              }}
              transition={{ duration: 1, ease: "easeOut" }}
              style={{
                position: "absolute",
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: ["#f43f5e", "#facc15", "#3b82f6"][i % 3],
              }}
            />
          ))}
        </div>
      );
    };

    return (
      <div style={{ position: "relative", width: 160, height: 40 }}>
        {/* Track background */}
        <div
          style={{
            width: "100%",
            height: 8,
            background: "#e5e7eb",
            borderRadius: 4,
            position: "absolute",
            top: 16,
          }}
        />
        {/* Truck / Person moving */}
        <motion.div
          style={{
            position: "absolute",
            top: 8,
            left: `${percent}%`,
            width: 24,
            height: 24,
            fontSize: 24,
            color: stepColors[safeIdx],
            transform: "translateX(-50%)",
          }}
          animate={{ left: `${percent}%` }}
          transition={{ type: "spring", stiffness: 260, damping: 25 }}
        >
          {/* swap icons if you want truck, person, or box */}
          <FaTruck />
        </motion.div>

        {/* step dots */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            position: "absolute",
            width: "100%",
            top: 8,
          }}
        >
          {steps.map((s, i) => (
            <div
              key={s}
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: i <= safeIdx ? stepColors[i] : "#d1d5db",
              }}
            />
          ))}
        </div>

        {/* confetti */}
        <AnimatePresence>
          {status === "Completed" && (
            <Confetti key={burstKey} keyProp={burstKey} />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // The `return` JSX follows after this block in your file
  // (user asked to provide all code before `return`)

  /* -------------------- Render -------------------- */
  return (
    <div className="p-4 space-y-6">
      {/* Header controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Work Orders — Invoice</h2>
          <p className="text-sm text-muted-foreground">
            Create and manage work orders (invoice/quotation style)
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
                <SelectItem key={s._id} value={s._id}>
                  {s?.supplierName || s?.name}
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
              {["Pending", "Processing", "Completed", "Cancelled"].map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={() => onCreate()}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" /> Create WO
          </Button>
        </div>
      </div>

      {/* Table (simple) */}
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

            {/* Inline CSS for stepper + animations */}
            <style>
              {`
              .wo-stepper { display:flex; align-items:center; gap:12px; min-width:220px; }
              .stepper-track { position:relative; width:140px; height:6px; background:#eee; border-radius:999px; overflow:hidden; }
              .stepper-fill { position:absolute; left:0; top:0; height:100%; background:linear-gradient(90deg,#4f46e5,#06b6d4); width:0%; transition: width 700ms cubic-bezier(.2,.9,.2,1); }
              .stepper-steps { display:flex; gap:8px; align-items:center; margin-left:8px; }
              .step-dot { width:12px; height:12px; border-radius:50%; background:#fff; border:2px solid #ddd; display:inline-block; box-sizing:content-box; transition: transform 300ms, background-color 300ms, border-color 300ms; }
              .step-dot.active { background:#4f46e5; border-color:#4f46e5; transform: scale(1); }
              .step-dot.current { box-shadow:0 0 0 6px rgba(79,70,229,0.12); animation: pulse 1400ms infinite; transform: scale(1.12); }
              .step-label { font-size:11px; color:#555; white-space:nowrap; }
              .step-label.active { color:#111; font-weight:600; }
              @keyframes pulse { 0% { box-shadow:0 0 0 0 rgba(79,70,229,0.18); } 70% { box-shadow:0 0 0 10px rgba(79,70,229,0); } 100% { box-shadow:0 0 0 0 rgba(79,70,229,0); } }

              .cancelled-pill { display:inline-block; padding:6px 10px; background:linear-gradient(180deg,#ef4444,#dc2626); color:white; border-radius:999px; font-weight:600; animation: shake 700ms; }
              @keyframes shake { 10% { transform: translateX(-2px); } 30% { transform: translateX(2px); } 50% { transform: translateX(-1px); } 70% { transform: translateX(1px); } 100% { transform: translateX(0); } }

              /* small responsive tweak */
              @media (max-width: 720px) {
                .wo-stepper { min-width:160px; gap:8px; }
                .stepper-track { width:110px; }
                .step-label { display:none; }
              }
            `}
            </style>

            <style>
              {`
              /* small, self-contained styles for the animated stepper */
              .wow-stepper { display:flex; gap:12px; align-items:center; min-width:260px; }
              .wow-badge { min-width:96px; display:inline-flex; align-items:center; justify-content:center; padding:6px 10px; border-radius:999px; font-weight:600; color:#fff; }
              .wow-badge.pending { background: linear-gradient(90deg,#f59e0b,#f97316); }
              .wow-badge.processing { background: linear-gradient(90deg,#06b6d4,#3b82f6); }
              .wow-badge.completed { background: linear-gradient(90deg,#10b981,#059669); }
              .wow-badge.cancelled { background: linear-gradient(90deg,#ef4444,#dc2626); }

              /* particle container */
              .particle-root { position: relative; width: 0; height: 0; pointer-events: none; }
            `}
            </style>

            <TableBody>
              {workOrders.map((w, i) => (
                <TableRow key={w._id || i}>
                  <TableCell>{(page - 1) * limit + i + 1}</TableCell>
                  <TableCell>{w.workOrderNo}</TableCell>
                  <TableCell>{w.subject}</TableCell>
                  <TableCell>{w?.supplier?.supplierName}</TableCell>
                  <TableCell>
                    {w.issueDate
                      ? new Date(w.issueDate).toLocaleDateString()
                      : "-"}
                  </TableCell>
                  <TableCell>{formatCurrency(w.grandTotal)}</TableCell>
                  <AnimatedCinematicStepper status={w.status} />

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
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => updateStatus(w, "Processing")}
                        disabled={w.status !== "Pending"}
                        title="Approve"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => updateStatus(w, "Completed")}
                        disabled={w.status !== "Processing"}
                        title="Complete"
                      >
                        ✅
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => updateStatus(w, "Cancelled")}
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

      {/* VIEW DIALOG (simple invoice) */}
      <Dialog open={!!viewing} onOpenChange={() => setViewing(null)}>
        <DialogContent className="!w-full !max-w-[98vw] max-h-[95vh] h-full overflow-y-auto p-0 rounded-xl shadow-2xl bg-background border">
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
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (viewing) updateStatus(viewing, "Processing");
                  }}
                  disabled={viewing?.status !== "Pending"}
                >
                  Approve
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (viewing) updateStatus(viewing, "Completed");
                  }}
                  disabled={viewing?.status !== "Processing"}
                >
                  Complete
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (viewing) updateStatus(viewing, "Cancelled");
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

            {/* invoice content */}
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
                  <div>Status: {statusBadge(viewing?.status)}</div>
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
                        <td className="p-2 align-top text-right">{it.unit}</td>
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
        </DialogContent>
      </Dialog>

      {/* FULL-WIDTH EDIT / CREATE DIALOG: left = form (scrollable) ; right = preview */}
      <Dialog
        open={openEdit}
        onOpenChange={(o) => {
          if (!o) setOpenEdit(false);
        }}
      >
        <DialogContent className="!w-[100vw] !max-w-none !h-[92vh] p-0 m-0 rounded-none bg-transparent">
          <div className="flex h-full">
            {/* LEFT: FORM (scrollable) */}
            <div
              className="w-5/12 overflow-y-auto p-6 bg-white border-r"
              style={{ maxHeight: "92vh" }}
            >
              <div className="flex items-start justify-between">
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
                      toast.success("Draft saved locally (not persisted)");
                    }}
                  >
                    Save Draft
                  </Button>
                  <Button onClick={() => submitForm()}>
                    {editing ? "Save" : "Create"}
                  </Button>
                </div>
              </div>

              {/* spaced sections */}
              <div className="mt-4 space-y-4">
                <Section title="Reference & Subject">
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
                </Section>

                <Section title="Recipient">
                  <div className="grid grid-cols-1 gap-3">
                    <Select
                      value={getId(form?.supplier) || NONE}
                      onValueChange={(v) =>
                        setForm({
                          ...(form || {}),
                          supplier: v === NONE ? "" : v,
                        })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select Supplier" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Select Supplier</SelectItem>
                        {suppliers.map((s) => (
                          <SelectItem key={s._id} value={s._id}>
                            {s.supplierName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                </Section>

                <Section title="Logistics & Dates">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col">
                      <label htmlFor="" className="whitespace-nowrap text-xs">
                        Select Factory
                      </label>
                      <Select
                        value={getId(form?.warehouseOrFactory) || NONE}
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

                    <div className="flex flex-col">
                      <label htmlFor="" className="whitespace-nowrap text-xs">
                        Issue Date
                      </label>
                      <Input
                        type="date"
                        label="Issue Date"
                        value={form?.issueDate?.slice(0, 10) || ""}
                        onChange={(e) =>
                          setForm({
                            ...(form || {}),
                            issueDate: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="" className="whitespace-nowrap text-xs">
                        Expected Delivery
                      </label>
                      <Input
                        type="date"
                        label="Expected Delivery"
                        value={form?.expectedDeliveryDate?.slice(0, 10) || ""}
                        onChange={(e) =>
                          setForm({
                            ...(form || {}),
                            expectedDeliveryDate: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="" className="whitespace-nowrap text-xs">
                        Status
                      </label>
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
                </Section>

                <Section title="Items">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-muted-foreground">
                      Add items (raw materials or packaging). Unit price is
                      editable.
                    </div>
                    <Button size="sm" onClick={addItemRow}>
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
                                        itemType: v as
                                          | "RawMaterial"
                                          | "PackagingItem",
                                        itemId: "",
                                      })
                                    }
                                  >
                                    <SelectTrigger className="w-40">
                                      <SelectValue placeholder="Type" />
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

                                  <Select
                                    value={getId(it.itemId) || NONE}
                                    onValueChange={(v) => {
                                      if (v === NONE)
                                        updateItemField(idx, { itemId: "" });
                                      else
                                        selectItemForRow(idx, currentType, v);
                                    }}
                                  >
                                    <SelectTrigger className="w-56">
                                      <SelectValue placeholder="Select item" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value={NONE}>
                                        Select item
                                      </SelectItem>
                                      {currentType === "RawMaterial"
                                        ? rawMaterials.map((r) => (
                                            <SelectItem
                                              key={r._id}
                                              value={r._id}
                                            >
                                              {r.name}
                                            </SelectItem>
                                          ))
                                        : packagingItems.map((p) => (
                                            <SelectItem
                                              key={p._id}
                                              value={p._id}
                                            >
                                              {p.name}
                                            </SelectItem>
                                          ))}
                                    </SelectContent>
                                  </Select>
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
                </Section>

                <Section title="Totals & Calculations">
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
                </Section>

                <Section title="Terms & Notes">
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
                </Section>

                <Section title="Footer & Signatures">
                  <Input
                    value={form?.footerNote || ""}
                    onChange={(e) =>
                      setForm({ ...(form || {}), footerNote: e.target.value })
                    }
                    placeholder="Footer note shown on printed document"
                  />
                  <div className="flex gap-4 mt-3">
                    <div className="text-center w-1/3">
                      <div className="h-14 border-b"></div>
                      <div className="text-sm mt-1">Prepared By</div>
                    </div>
                    <div className="text-center w-1/3">
                      <div className="h-14 border-b"></div>
                      <div className="text-sm mt-1">Approved By</div>
                    </div>
                    <div className="text-center w-1/3">
                      <div className="h-14 border-b"></div>
                      <div className="text-sm mt-1">Chairman</div>
                    </div>
                  </div>
                </Section>
              </div>
            </div>

            {/* RIGHT: PREVIEW (non-scrollable header + scrollable body) */}
            <div
              className="w-7/12 overflow-y-auto p-8 bg-gray-50"
              style={{ maxHeight: "92vh" }}
              ref={printRef}
            >
              <div className="bg-white border rounded-lg p-6 shadow-sm">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <div>
                    {/* placeholder logo & company */}
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
                    <div className="mt-2">{statusBadge(form?.status)}</div>
                  </div>
                </div>

                {/* To / Warehouse / Subject */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                  <div>
                    <div className="text-sm text-muted-foreground">To</div>
                    <div className="font-medium">
                      {
                        suppliers.find((s) => form?.supplier === s._id)
                          ?.supplierName
                      }
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {(form?.supplier as any)?.address}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Factory</div>
                    <div className="font-medium">
                      {
                        warehouses.find(
                          (d) => form?.warehouseOrFactory === d._id,
                        )?.name
                      }
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {(form?.warehouseOrFactory as any)?.address}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Subject</div>
                    <div className="font-medium">{form?.subject}</div>
                    <div className="text-sm text-muted-foreground">
                      {form?.attention}
                    </div>
                  </div>
                </div>

                {/* salutation */}
                <div className="mb-4 text-sm">{form?.salutation}</div>

                {/* Items table */}
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

                {/* totals */}
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
    </div>
  );

  /* -------------------- Small helpers -------------------- */
  function statusBadge(status?: string) {
    if (!status) return <span>-</span>;
    const base =
      "px-2 py-1 rounded text-sm font-semibold inline-block text-white";
    switch (status) {
      case "Pending":
        return <span className={`${base} bg-yellow-600`}>{status}</span>;
      case "Processing":
        return <span className={`${base} bg-blue-600`}>{status}</span>;
      case "Completed":
        return <span className={`${base} bg-green-600`}>{status}</span>;
      case "Cancelled":
        return <span className={`${base} bg-red-600`}>{status}</span>;
      default:
        return <span className={`${base} bg-gray-600`}>{status}</span>;
    }
  }
}

/* -------------------- Small UI section component -------------------- */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border rounded p-3">
      <div className="text-sm font-semibold mb-3">{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export function AnimatedStatusStepper({
  status,
  demo = false,
}: {
  status?: string | null;
  demo?: boolean;
}) {
  // Ordered steps and index
  const steps = ["Pending", "Processing", "Completed"];
  const idx = status ? Math.max(0, steps.indexOf(status)) : -1;
  const percent = idx < 0 ? 0 : (idx / (steps.length - 1)) * 100;

  // Track measurements (for responsive exact positioning)
  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const [trackW, setTrackW] = React.useState(220); // default
  React.useLayoutEffect(() => {
    function upd() {
      const w = trackRef.current?.clientWidth;
      if (w) setTrackW(w);
    }
    upd();
    window.addEventListener("resize", upd);
    return () => window.removeEventListener("resize", upd);
  }, []);

  // vehicle dimensions & computed target
  const vehicleW = 48;
  const padding = 8;
  const maxTravel = Math.max(0, trackW - vehicleW - padding * 2);
  const targetX = (percent / 100) * maxTravel;

  // trigger confetti key when completed
  const [confettiKey, setConfettiKey] = React.useState(0);
  React.useEffect(() => {
    if (status === "Completed") setConfettiKey((k) => k + 1);
  }, [status]);

  // optional demo autoplay (for marketing / hero)
  React.useEffect(() => {
    if (!demo) return;
    let seq = 0;
    const ids: any[] = [];
    const order = ["Pending", "Processing", "Completed"];
    function playOnce() {
      order.forEach((s, i) => {
        ids.push(
          setTimeout(
            () => {
              // you'll need to hook demo into parent state to show; left as optional
            },
            1000 * (i + 1),
          ),
        );
      });
    }
    playOnce();
    return () => ids.forEach(clearTimeout);
  }, [demo]);

  /* ---------- Framer variants ---------- */
  const vehicleVariants = {
    initial: { x: 0, scale: 1, rotate: 0 },
    move: (x: number) => ({
      x,
      transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] },
    }),
  };

  const wheelSpin = (speed = 1) => ({
    rotate: [0, 360],
    transition: { repeat: Infinity, ease: "linear", duration: 0.6 / speed },
  });

  const walkerVariants = {
    idle: { x: 0, y: 0 },
    walk: {
      x: [0, -6, 0, 6, 0],
      transition: { duration: 1.0, repeat: Infinity, ease: "linear" },
    },
  };

  /* ---------- Small subcomponents as inline SVGs ---------- */

  const VanSVG = ({ color = "#4f46e5" }: { color?: string }) => (
    <svg
      width="48"
      height="28"
      viewBox="0 0 64 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="2" y="10" rx="4" ry="4" width="44" height="16" fill={color} />
      <rect
        x="42"
        y="6"
        rx="3"
        ry="3"
        width="18"
        height="12"
        fill="#111827"
        opacity="0.04"
      />
      <rect
        x="6"
        y="12"
        width="12"
        height="8"
        rx="1"
        fill="white"
        opacity="0.06"
      />
      <circle cx="18" cy="28" r="4" fill="#111827" />
      <circle cx="46" cy="28" r="4" fill="#111827" />
      <circle cx="18" cy="28" r="2.2" fill="#e6e6e6" />
      <circle cx="46" cy="28" r="2.2" fill="#e6e6e6" />
    </svg>
  );

  const WalkerSVG = ({ color = "#111827" }: { color?: string }) => (
    <svg
      width="28"
      height="40"
      viewBox="0 0 24 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* simple stylized person */}
      <circle cx="12" cy="6" r="4" fill={color} />
      <rect x="9" y="10" width="6" height="10" rx="2" fill={color} />
      <path
        d="M9 20c0 0-2 8 3 10s6-1 6-1"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 12l-4 6"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M15 12l4 6"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );

  /* ---------- Confetti (simple blobs) ---------- */
  function Confetti({ keyProp = 0 }: { keyProp?: number }) {
    const pieces = new Array(14).fill(0);
    return (
      <div
        style={{
          position: "absolute",
          left: 0,
          top: -28,
          pointerEvents: "none",
          width: trackW,
        }}
      >
        {pieces.map((_, i) => {
          const left = Math.floor(Math.random() * trackW);
          const bg = ["#FB7185", "#F59E0B", "#60A5FA", "#34D399", "#A78BFA"][
            i % 5
          ];
          return (
            <motion.div
              key={`${keyProp}-${i}`}
              initial={{ opacity: 0, y: 0, scale: 0.3, x: left }}
              animate={{ opacity: 1, y: -60 + Math.random() * -20, scale: 1 }}
              exit={{ opacity: 0, y: -120 }}
              transition={{
                duration: 0.9 + Math.random() * 0.6,
                ease: "easeOut",
                delay: i * 0.02,
              }}
              style={{
                position: "absolute",
                left,
                width: 8 + (i % 3) * 3,
                height: 8 + (i % 3) * 3,
                borderRadius: 3,
                background: bg,
              }}
            />
          );
        })}
      </div>
    );
  }

  /* ---------- Marker labels (small) ---------- */
  const StepMarker = ({ label }: { label: string }) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        fontSize: 11,
        color: "#4b5563",
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: 8,
          background: "#fff",
          border: "2px solid #e6e6e6",
          marginBottom: 6,
        }}
      />
      <div style={{ fontSize: 10 }}>{label}</div>
    </div>
  );

  /* ---------- Render ---------- */
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        position: "relative",
        minWidth: 300,
      }}
    >
      {/* track with markers */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <div style={{ width: 12 }} /> {/* left padding */}
          <div
            ref={trackRef}
            style={{
              position: "relative",
              width: 260,
              height: 12,
              borderRadius: 999,
              background: "linear-gradient(90deg,#eef2ff,#f8fafc)",
              overflow: "visible",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)",
            }}
          >
            {/* fill */}
            <motion.div
              style={{
                position: "absolute",
                left: 4,
                top: 0,
                bottom: 0,
                height: "100%",
                borderRadius: 999,
                background: "linear-gradient(90deg,#4f46e5,#06b6d4)",
                width: `${percent}%`,
                transformOrigin: "left center",
              }}
              animate={{ width: `${Math.max(0, percent)}%` }}
              transition={{ duration: 0.9, ease: [0.2, 1, 0.22, 1] }}
            />

            {/* vehicle (absolute) */}
            <motion.div
              key={`vehicle-${percent}`}
              style={{
                position: "absolute",
                top: -20,
                left: padding,
                width: vehicleW,
                height: 28,
                willChange: "transform",
                transform: `translateX(${targetX}px)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
              }}
              animate={{ x: targetX }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* little shadow */}
              <motion.div
                initial={{ scale: 0.9, opacity: 0.24 }}
                animate={{ scale: 1, opacity: 0.28 }}
                transition={{ duration: 0.9 }}
                style={{
                  position: "absolute",
                  bottom: 2,
                  width: vehicleW * 0.8,
                  height: 6,
                  borderRadius: 999,
                  background: "rgba(15,23,42,0.06)",
                  filter: "blur(6px)",
                }}
              />

              {/* van SVG */}
              <div
                style={{
                  width: vehicleW,
                  height: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <VanSVG
                  color={
                    status === "Completed"
                      ? "#10b981"
                      : status === "Processing"
                        ? "#4f46e5"
                        : "#9CA3AF"
                  }
                />
                {/* wheels spin */}
                <motion.div
                  style={{
                    position: "absolute",
                    left: 8,
                    bottom: 2,
                    width: 8,
                    height: 8,
                    borderRadius: 16,
                    background: "transparent",
                  }}
                  animate={wheelSpin(1 + percent / 100)}
                />
              </div>
            </motion.div>

            {/* confetti on completed */}
            <AnimatePresence>
              {status === "Completed" && (
                <Confetti key={confettiKey} keyProp={confettiKey} />
              )}
            </AnimatePresence>
          </div>
          {/* walker */}
          <motion.div
            animate={status === "Processing" ? "walk" : "idle"}
            variants={walkerVariants}
            style={{
              width: 46,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginLeft: 6,
            }}
          >
            <WalkerSVG color={status === "Completed" ? "#059669" : "#111827"} />
          </motion.div>
        </div>

        {/* nice small markers under the track */}
        <div style={{ display: "flex", gap: 64, paddingLeft: 16 }}>
          <StepMarker label="Pending" />
          <StepMarker label="Processing" />
          <StepMarker label="Completed" />
        </div>
      </div>
    </div>
  );
}
