// src/app/delivery-chalan/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import api from "@/lib/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Truck,
  RefreshCw,
  Filter as FilterIcon,
  ChevronDown,
  ChevronUp,
  X,
  Eye,
  Loader2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  Printer,
  UserCheck,
  Package,
  Wallet,
  CalendarRange,
  Building2,
  Hash,
} from "lucide-react";

/* ---------------- Types ---------------- */
type InvoicePayment = {
  method?: string;
  amount?: number;
  paymentDate?: string;
  referenceNo?: string;
};

type SalesInvoice = {
  _id: string;
  invoiceNo?: string;
  orderId?: any;
  customerId?: any;
  warehouseId?: any;
  invoiceDate?: string;
  items?: any[];
  subTotal?: number;
  totalTax?: number;
  grandTotal?: number;
  paymentStatus?: string;
  paidAmount?: number;
  balanceAmount?: number;
  payments?: InvoicePayment[];
  status?: string;
};

type UserLite = {
  _id: string;
  name?: string;
  phoneNumber?: string;
  role?: any;
};

type DatePreset =
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_3_months"
  | "this_year"
  | "";

/* ---------------- Helpers ---------------- */
const fmtCurrency = (n?: number) =>
  (n ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

const shortId = (s?: string) => (s ? String(s).slice(0, 8) : "—");

function useClientDateFormatter() {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(true), []);
  const format = (d?: string | Date) => {
    if (!d) return "—";
    if (!isClient) return String(d).slice(0, 19).replace("T", " ");
    try {
      return new Date(d).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return String(d);
    }
  };
  return { format };
}

function localDateTimeInputValue(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function getPresetRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  switch (preset) {
    case "this_week": {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - diff);
      return { from: fmt(monday), to: fmt(now) };
    }
    case "last_week": {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1;
      const lastMonday = new Date(now);
      lastMonday.setDate(now.getDate() - diff - 7);
      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastMonday.getDate() + 6);
      return { from: fmt(lastMonday), to: fmt(lastSunday) };
    }
    case "this_month": {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: fmt(first), to: fmt(now) };
    }
    case "last_3_months": {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 3);
      return { from: fmt(d), to: fmt(now) };
    }
    case "this_year": {
      const first = new Date(now.getFullYear(), 0, 1);
      return { from: fmt(first), to: fmt(now) };
    }
    default:
      return { from: "", to: "" };
  }
}

/* ---------------- Badges ---------------- */
function InvoiceStatusBadge({ status }: { status?: string }) {
  const s = (status || "").toUpperCase();
  if (s === "ACTIVE") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[#3aa838]/30 bg-[#3aa838]/10 px-2 py-0.5 text-[11px] font-semibold text-[#2f8a2f]">
        Active
      </span>
    );
  }
  if (s === "CANCELLED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
        Cancelled
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
      {status || "—"}
    </span>
  );
}

function PaymentStatusBadge({ status }: { status?: string }) {
  const s = (status || "").toUpperCase();
  if (s === "PAID") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[#3aa838]/30 bg-[#3aa838]/10 px-2 py-0.5 text-[11px] font-semibold text-[#2f8a2f]">
        <CheckCircle2 className="h-3 w-3" /> Paid
      </span>
    );
  }
  if (s === "PARTIAL") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
        <AlertTriangle className="h-3 w-3" /> Partial
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
      <Clock className="h-3 w-3" /> Unpaid
    </span>
  );
}

/* ---------------- Hero stat ---------------- */
function HeroStat({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "slate" | "green" | "amber" | "rose";
}) {
  const cls = {
    slate: "text-slate-600",
    green: "text-[#2f8a2f]",
    amber: "text-amber-700",
    rose: "text-rose-700",
  }[tone];
  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <b className={`tabular-nums ${cls}`}>{value}</b>
    </div>
  );
}

/* ---------------- Page ---------------- */
export default function DeliveryChalanPage() {
  const { format } = useClientDateFormatter();

  const currentUser = useSelector((s: RootState) => s.user.currentUser);
  const isSystemUser =
    !!currentUser &&
    typeof currentUser.role === "object" &&
    !!(currentUser.role as any).isSystem;

  /* list state */
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const qTimer = useRef<number | null>(null);

  /* filters */
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [datePreset, setDatePreset] = useState<DatePreset>("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  /* chalan modal */
  const [chalanInvoice, setChalanInvoice] = useState<SalesInvoice | null>(null);
  const [chalanLoading, setChalanLoading] = useState(false);

  /* delivery helpers */
  const [deliveryMen, setDeliveryMen] = useState<UserLite[]>([]);
  const [selectedDeliveryManId, setSelectedDeliveryManId] = useState<
    string | null
  >(null);
  const [deliveryDate, setDeliveryDate] = useState<string | null>(null);
  const [actionLoadingFor, setActionLoadingFor] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  /* ---------------- Fetch invoices ---------------- */
  async function fetchInvoices(fetchPage = page, fetchLimit = limit) {
    setLoading(true);
    try {
      const params: any = { page: fetchPage, limit: fetchLimit };
      if (q?.trim()) params.q = q.trim();
      if (paymentStatusFilter && paymentStatusFilter !== "ALL")
        params.paymentStatus = paymentStatusFilter;
      if (statusFilter && statusFilter !== "ALL") params.status = statusFilter;
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;

      const res = await api.get("/sales-invoices", { params });
      const payload = res.data ?? res;

      const rowsSrc =
        Array.isArray(payload.data) && Array.isArray(payload.data)
          ? payload.data
          : Array.isArray(payload)
            ? payload
            : (payload.data?.data ?? payload.data ?? payload.rows ?? []);

      const metaTotal =
        payload.data?.total ?? payload.total ?? payload.count ?? rowsSrc.length;

      const normalized = (rowsSrc || []).map((r: any) => ({
        _id: r._id ?? r.id,
        invoiceNo: r.invoiceNo ?? r.invoice_no,
        orderId: r.orderId ?? r.order ?? r.salesOrder,
        customerId: r.customerId ?? r.customer,
        warehouseId: r.warehouseId ?? r.warehouse,
        invoiceDate: r.invoiceDate ?? r.createdAt,
        items: r.items ?? [],
        subTotal: r.subTotal ?? r.sub_total,
        totalTax: r.totalTax ?? r.total_tax,
        grandTotal: r.grandTotal ?? r.grand_total ?? r.total,
        paymentStatus: r.paymentStatus ?? r.payment_status,
        paidAmount: r.paidAmount ?? r.paid_amount ?? 0,
        balanceAmount: r.balanceAmount ?? r.balance_amount ?? r.grandTotal ?? 0,
        payments: r.payments ?? [],
        status: r.status,
      })) as SalesInvoice[];

      setInvoices(normalized);
      setTotal(Number(metaTotal ?? normalized.length));
      setPage(Number(fetchPage));
      setLimit(Number(fetchLimit));
    } catch (err: any) {
      console.error("fetchInvoices error", err);
      toast.error(err?.response?.data?.message ?? "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchInvoices(1, limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  /* debounce search */
  useEffect(() => {
    if (qTimer.current) window.clearTimeout(qTimer.current);
    qTimer.current = window.setTimeout(() => {
      setPage(1);
      fetchInvoices(1, limit);
    }, 350) as unknown as number;
    return () => {
      if (qTimer.current) window.clearTimeout(qTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  /* ---------------- Fetch delivery men ---------------- */
  async function fetchDeliveryMen() {
    try {
      const res = await api
        .get("/users", { params: { role: "DELIVERY", page: 1, limit: 1000 } })
        .catch(() => api.get("/users", { params: { page: 1, limit: 1000 } }));

      const rows = res.data?.data ?? res.data ?? [];
      const normalized = (rows || []).map((u: any) => ({
        _id: u._id ?? u.id,
        name: u.name ?? u.fullName ?? u.username ?? shortId(u._id ?? u.id),
        phoneNumber: u.phoneNumber ?? u.phone ?? "",
        role: u.role,
      })) as UserLite[];

      const deliveryOnly = normalized.filter(
        (u) =>
          (u.role && (u.role === "DELIVERY" || u.role?.code === "DELIVERY")) ||
          String(u.name).toLowerCase().includes("deliver"),
      );
      setDeliveryMen(deliveryOnly.length ? deliveryOnly : normalized);
    } catch (err) {
      console.error("fetchDeliveryMen err", err);
      setDeliveryMen([]);
    }
  }

  useEffect(() => {
    fetchDeliveryMen();
  }, []);

  /* ---------------- Summary ---------------- */
  const summary = useMemo(() => {
    const paid = invoices.filter(
      (i) => (i.paymentStatus || "").toUpperCase() === "PAID",
    ).length;
    const partial = invoices.filter(
      (i) => (i.paymentStatus || "").toUpperCase() === "PARTIAL",
    ).length;
    const unpaid = invoices.filter(
      (i) =>
        !i.paymentStatus || (i.paymentStatus || "").toUpperCase() === "UNPAID",
    ).length;
    const grand = invoices.reduce((s, i) => s + Number(i.grandTotal || 0), 0);
    const balance = invoices.reduce(
      (s, i) => s + Number(i.balanceAmount || 0),
      0,
    );
    return { paid, partial, unpaid, grand, balance };
  }, [invoices]);

  const activeFilterCount =
    (paymentStatusFilter !== "ALL" ? 1 : 0) +
    (statusFilter !== "ALL" ? 1 : 0) +
    (fromDate || toDate ? 1 : 0);

  const hasAnyFilter = activeFilterCount > 0 || Boolean(q);

  /* ---------------- Date actions ---------------- */
  const applyPreset = (preset: DatePreset) => {
    if (!preset) {
      setFromDate("");
      setToDate("");
      setDatePreset("");
      setPage(1);
      fetchInvoices(1, limit);
      return;
    }
    const { from, to } = getPresetRange(preset);
    setFromDate(from);
    setToDate(to);
    setDatePreset(preset);
    setPage(1);
    fetchInvoices(1, limit);
  };

  const onDateChange = (which: "from" | "to", value: string) => {
    if (which === "from") setFromDate(value);
    else setToDate(value);
    setDatePreset("");
    setPage(1);
    fetchInvoices(1, limit);
  };

  const clearDates = () => {
    setFromDate("");
    setToDate("");
    setDatePreset("");
    setPage(1);
    fetchInvoices(1, limit);
  };

  const clearAll = () => {
    setQ("");
    setPaymentStatusFilter("ALL");
    setStatusFilter("ALL");
    setFromDate("");
    setToDate("");
    setDatePreset("");
    setPage(1);
    fetchInvoices(1, limit);
  };

  /* ---------------- Open Chalan ---------------- */
  async function openChalan(invoice: SalesInvoice) {
    setChalanInvoice(null);
    setChalanLoading(true);
    setSelectedDeliveryManId(null);
    setDeliveryDate(null);

    try {
      const res = await api.get(`/sales-invoices/${invoice._id}`);
      const payload = res.data?.data ?? res.data ?? res;
      const inv = { ...invoice, ...payload } as SalesInvoice;

      const orderRef = inv.orderId;
      const deliveryManId =
        orderRef && typeof orderRef === "object"
          ? (orderRef.deliveryManId ?? orderRef.deliveryMan?._id ?? null)
          : null;

      setChalanInvoice(inv);
      setSelectedDeliveryManId(deliveryManId ? String(deliveryManId) : null);
      setDeliveryDate(localDateTimeInputValue());
    } catch (err) {
      console.error("openChalan err", err);
      toast.error("Failed to load invoice details");
    } finally {
      setChalanLoading(false);
    }
  }

  function closeChalan() {
    setChalanInvoice(null);
    setSelectedDeliveryManId(null);
    setDeliveryDate(null);
  }

  /* ---------------- Assign delivery man ---------------- */
  async function assignDeliveryMan() {
    if (!chalanInvoice) return;
    const orderId =
      chalanInvoice.orderId && typeof chalanInvoice.orderId === "object"
        ? (chalanInvoice.orderId._id ?? chalanInvoice.orderId.id)
        : chalanInvoice.orderId;
    if (!orderId) return toast.error("Related order not found on invoice");

    if (!selectedDeliveryManId)
      return toast.error("Select a delivery man first");

    setActionLoadingFor(orderId);
    try {
      await api.put(`/sales-orders/${orderId}`, {
        deliveryManId: selectedDeliveryManId,
        updatedBy: currentUser?.id,
      });
      toast.success("Delivery man assigned to order");
      const res = await api.get(`/sales-invoices/${chalanInvoice._id}`);
      setChalanInvoice(res.data?.data ?? res.data ?? chalanInvoice);
      await fetchInvoices(page, limit);
    } catch (err: any) {
      console.error("assignDeliveryMan err", err);
      toast.error(
        err?.response?.data?.message ?? "Failed to assign delivery man",
      );
    } finally {
      setActionLoadingFor(null);
    }
  }

  /* ---------------- Mark delivered ---------------- */
  async function markDelivered() {
    if (!chalanInvoice) return;
    const orderId =
      chalanInvoice.orderId && typeof chalanInvoice.orderId === "object"
        ? (chalanInvoice.orderId._id ?? chalanInvoice.orderId.id)
        : chalanInvoice.orderId;
    if (!orderId) return toast.error("Related order not found on invoice");

    if (!confirm("Mark this order as DELIVERED?")) return;

    setActionLoadingFor(orderId);
    try {
      await api.post(`/sales-orders/${orderId}/deliver`);

      const res = await api.get(`/sales-invoices/${chalanInvoice._id}`);
      setChalanInvoice(res.data?.data ?? res.data ?? chalanInvoice);

      toast.success("Order marked as delivered");
      await fetchInvoices(page, limit);
      closeChalan();
    } catch (err: any) {
      console.error("markDelivered err", err);
      toast.error(err?.response?.data?.message ?? "Failed to mark delivered");
    } finally {
      setActionLoadingFor(null);
    }
  }

  /* ---------------- Print Chalan ---------------- */
  function printChalan() {
    if (!chalanInvoice) return toast.error("No invoice to print");

    const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME ?? "Company";
    const invoice = chalanInvoice;
    const orderRef =
      invoice.orderId && typeof invoice.orderId === "object"
        ? invoice.orderId
        : { _id: invoice.orderId };

    const deliveryMan =
      deliveryMen.find((d) => d._id === selectedDeliveryManId) ??
      (orderRef && (orderRef as any).deliveryMan
        ? (orderRef as any).deliveryMan
        : null);

    const items = invoice.items ?? [];
    const totalQty = items.reduce(
      (s, it: any) => s + Number(it.qty ?? it.quantity ?? 0),
      0,
    );

    const itemsHtml =
      items.length > 0
        ? items
            .map((it: any, i: number) => {
              const p = it.productId ?? it;
              const name = p?.name ?? p?.title ?? it.name ?? "—";
              const qty = it.qty ?? it.quantity ?? 0;
              const price = it.unitPrice ?? it.price ?? 0;
              const line = (Number(qty) * Number(price)).toFixed(2);
              return `<tr>
                <td class="center">${i + 1}</td>
                <td>${name}</td>
                <td class="center">${qty}</td>
                <td class="right">${Number(price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td class="right">${Number(line).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>`;
            })
            .join("")
        : `<tr><td colspan="5" class="center">No items</td></tr>`;

    const html = `
      <html>
        <head>
          <title>Delivery Chalan - ${invoice.invoiceNo ?? shortId(invoice._id)}</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 24px; }
            .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:22px; padding-bottom:16px; border-bottom:2px solid #0f172a; }
            .brand { display:flex; align-items:center; gap:12px; }
            .brand-mark { width:44px; height:44px; border-radius:12px; background:#3aa838; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:800; font-size:20px; }
            .company { font-size:20px; font-weight:800; letter-spacing:-0.3px; }
            .tagline { font-size:11px; color:#64748b; margin-top:2px; }
            .meta { text-align:right; font-size:12px; color:#334155; }
            .meta .title { font-size:22px; font-weight:800; text-transform:uppercase; letter-spacing:1px; color:#0f172a; margin-bottom:6px; }
            .meta div { margin-top:2px; }
            .meta strong { color:#0f172a; }
            .grid { display:flex; gap:16px; margin-bottom:16px; }
            .box { flex:1; border:1px solid #e2e8f0; border-radius:10px; padding:12px 14px; background:#f8fafc; }
            .box-label { font-size:10px; text-transform:uppercase; letter-spacing:.6px; color:#64748b; font-weight:700; margin-bottom:4px; }
            .box-main { font-size:14px; font-weight:700; color:#0f172a; }
            .box-sub { font-size:11px; color:#64748b; margin-top:2px; }
            table.items { width:100%; border-collapse:collapse; margin-top:8px; }
            table.items th { background:#0f172a; color:#fff; font-size:11px; text-transform:uppercase; letter-spacing:.5px; padding:9px 10px; text-align:left; }
            table.items td { padding:9px 10px; border-bottom:1px solid #e2e8f0; font-size:12px; }
            table.items tr:nth-child(even) td { background:#f8fafc; }
            .center { text-align:center; }
            .right { text-align:right; }
            .totals { display:flex; justify-content:flex-end; margin-top:14px; }
            .totals-box { width:320px; }
            .totals-row { display:flex; justify-content:space-between; padding:6px 0; font-size:13px; border-bottom:1px dashed #e2e8f0; }
            .totals-row.grand { border-bottom:none; border-top:2px solid #0f172a; margin-top:4px; padding-top:10px; font-size:16px; font-weight:800; color:#0f172a; }
            .signs { display:flex; justify-content:space-between; margin-top:40px; gap:30px; }
            .sign { flex:1; text-align:center; font-size:11px; color:#475569; }
            .sign-line { border-top:1.5px solid #94a3b8; margin-top:50px; padding-top:8px; }
            .footer { margin-top:28px; padding-top:10px; border-top:1px solid #e2e8f0; text-align:center; font-size:10px; color:#94a3b8; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="brand">
              <div class="brand-mark">${companyName.charAt(0)}</div>
              <div>
                <div class="company">${companyName}</div>
                <div class="tagline">Delivery Chalan / Delivery Note</div>
              </div>
            </div>
            <div class="meta">
              <div class="title">Delivery Chalan</div>
              <div><strong>Chalan #:</strong> ${invoice.invoiceNo ?? shortId(invoice._id)}</div>
              <div><strong>Date:</strong> ${new Date().toLocaleString()}</div>
              <div><strong>Order:</strong> ${orderRef.orderNo ?? orderRef._id ?? "—"}</div>
            </div>
          </div>

          <div class="grid">
            <div class="box">
              <div class="box-label">Deliver To</div>
              <div class="box-main">${(invoice.customerId && (invoice.customerId.name ?? invoice.customerId)) ?? "—"}</div>
              <div class="box-sub">${(invoice.customerId && invoice.customerId.address) ?? ""}</div>
            </div>
            <div class="box">
              <div class="box-label">Warehouse</div>
              <div class="box-main">${(invoice.warehouseId && (invoice.warehouseId.name ?? invoice.warehouseId)) ?? "—"}</div>
              <div class="box-sub">Dispatch location</div>
            </div>
            <div class="box">
              <div class="box-label">Summary</div>
              <div class="box-main">${items.length} items · ${totalQty} qty</div>
              <div class="box-sub">Total: ৳ ${Number(invoice.grandTotal ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
          </div>

          <table class="items">
            <thead>
              <tr>
                <th style="width:8%;">#</th>
                <th>Product</th>
                <th style="width:12%;" class="center">Qty</th>
                <th style="width:18%;" class="right">Unit Price</th>
                <th style="width:18%;" class="right">Line Total</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>

          <div class="totals">
            <div class="totals-box">
              <div class="totals-row"><span>Subtotal</span><span>৳ ${Number(invoice.subTotal ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
              <div class="totals-row"><span>Tax</span><span>৳ ${Number(invoice.totalTax ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
              <div class="totals-row grand"><span>Grand Total</span><span>৳ ${Number(invoice.grandTotal ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
            </div>
          </div>

          <div class="grid" style="margin-top:20px;">
            <div class="box">
              <div class="box-label">Delivery Man</div>
              <div class="box-main">${deliveryMan ? (deliveryMan.name ?? shortId(deliveryMan._id)) : "—"}</div>
              <div class="box-sub">${deliveryMan && (deliveryMan as any).phoneNumber ? (deliveryMan as any).phoneNumber : ""}</div>
            </div>
            <div class="box">
              <div class="box-label">Delivery Date</div>
              <div class="box-main">${deliveryDate ? new Date(deliveryDate).toLocaleString() : "—"}</div>
              <div class="box-sub">Scheduled / actual</div>
            </div>
          </div>

          <div class="signs">
            <div class="sign"><div class="sign-line">Prepared By</div></div>
            <div class="sign"><div class="sign-line">Delivered By</div></div>
            <div class="sign"><div class="sign-line">Received By (Dealer)</div></div>
          </div>

          <div class="footer">
            Computer-generated delivery chalan · ${companyName}
          </div>
        </body>
      </html>
    `;

    const w = window.open("", "_blank", "width=900,height=750");
    if (!w) {
      toast.error("Please allow popups for printing");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    setTimeout(() => {
      try {
        w.focus();
        w.print();
      } catch (err) {
        console.error("printChalan error", err);
      }
    }, 350);
  }

  /* ---------------- Render ---------------- */
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl p-3 md:p-4">
        {/* ================= HERO ================= */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#3aa838]/10">
              <Truck className="h-4 w-4 text-[#3aa838]" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-semibold leading-tight">
                Delivery Chalan
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                <HeroStat
                  label="Visible"
                  value={invoices.length}
                  tone="slate"
                />
                <HeroStat label="Paid" value={summary.paid} tone="green" />
                <HeroStat
                  label="Partial"
                  value={summary.partial}
                  tone="amber"
                />
                <HeroStat label="Unpaid" value={summary.unpaid} tone="rose" />
                <span className="text-slate-300">·</span>
                <HeroStat
                  label="Page total"
                  value={`৳ ${fmtCurrency(summary.grand)}`}
                  tone="slate"
                />
                <span className="text-slate-300">·</span>
                <HeroStat
                  label="Balance"
                  value={`৳ ${fmtCurrency(summary.balance)}`}
                  tone="rose"
                />
              </div>
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fetchInvoices(page, limit)}
              title="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* ================= FILTER BAR ================= */}
        <div className="mb-3 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-2 px-3 py-2">
            <Input
              placeholder="Search invoice / order / customer..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-9 w-full max-w-[260px] text-sm"
            />

            <Select
              value={paymentStatusFilter}
              onValueChange={(v) => {
                setPaymentStatusFilter(v);
                setPage(1);
                fetchInvoices(1, limit);
              }}
            >
              <SelectTrigger className="h-9 w-[140px] text-xs">
                <SelectValue placeholder="Payment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All payments</SelectItem>
                <SelectItem value="UNPAID">Unpaid</SelectItem>
                <SelectItem value="PARTIAL">Partial</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setPage(1);
                fetchInvoices(1, limit);
              }}
            >
              <SelectTrigger className="h-9 w-[130px] text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <select
              value={datePreset}
              onChange={(e) => applyPreset(e.target.value as DatePreset)}
              className="h-9 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-[#3aa838]"
            >
              <option value="">
                {fromDate || toDate ? "Custom range" : "All dates"}
              </option>
              <option value="this_week">This Week</option>
              <option value="last_week">Last Week</option>
              <option value="this_month">This Month</option>
              <option value="last_3_months">Last 3 Months</option>
              <option value="this_year">This Year</option>
            </select>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFiltersOpen((v) => !v)}
              className={`h-9 ${
                activeFilterCount > 0
                  ? "border-[#3aa838]/40 bg-[#3aa838]/5 text-[#2f8a2f]"
                  : ""
              }`}
            >
              <FilterIcon className="mr-1.5 h-3.5 w-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-1.5 rounded-full bg-[#3aa838] px-1.5 py-0 text-[10px] font-bold text-white tabular-nums">
                  {activeFilterCount}
                </span>
              )}
              {filtersOpen ? (
                <ChevronUp className="ml-1.5 h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
              )}
            </Button>

            {hasAnyFilter && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="h-9 text-slate-500"
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Clear
              </Button>
            )}

            <div className="ml-auto text-xs text-muted-foreground tabular-nums">
              {total} records
            </div>
          </div>

          {filtersOpen && (
            <div className="grid gap-3 border-t border-slate-200 bg-slate-50/60 px-3 py-3 md:grid-cols-3">
              <div className="space-y-1">
                <label className="flex items-center gap-1 text-[11px] font-medium text-slate-600">
                  <CalendarRange className="h-3 w-3" /> From date
                </label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => onDateChange("from", e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="flex items-center gap-1 text-[11px] font-medium text-slate-600">
                  <CalendarRange className="h-3 w-3" /> To date
                </label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => onDateChange("to", e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearDates}
                  className="h-9 w-full text-xs"
                >
                  <X className="mr-1 h-3 w-3" />
                  Clear dates
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ================= TABLE ================= */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-left">
                <tr>
                  {[
                    "Invoice",
                    "Order",
                    "Customer",
                    "Date",
                    "Status",
                    "Payment",
                  ].map((h) => (
                    <th
                      key={h}
                      className="border-b border-slate-200 px-3 py-2.5 text-[11px] font-medium uppercase tracking-wide text-slate-600"
                    >
                      {h}
                    </th>
                  ))}
                  <th className="border-b border-slate-200 px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wide text-slate-600">
                    Total
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wide text-slate-600">
                    Balance
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wide text-slate-600">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading &&
                  Array.from({ length: Math.min(limit, 6) }).map((_, i) => (
                    <tr
                      key={i}
                      className="animate-pulse border-b border-slate-100"
                    >
                      {Array.from({ length: 9 }).map((__, j) => (
                        <td key={j} className="px-3 py-3">
                          <div className="h-4 w-full max-w-[100px] rounded bg-slate-100" />
                        </td>
                      ))}
                    </tr>
                  ))}

                {!loading && invoices.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-16 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center gap-3 text-muted-foreground">
                        <div className="rounded-full bg-slate-100 p-3">
                          <Truck className="h-6 w-6" />
                        </div>
                        <div className="text-sm font-medium text-slate-700">
                          No invoices found
                        </div>
                        <div className="text-xs">
                          {hasAnyFilter
                            ? "Try widening the filters or date range."
                            : "Invoices are created automatically when a sales order is shipped."}
                        </div>
                        {hasAnyFilter && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={clearAll}
                          >
                            <X className="mr-1.5 h-3.5 w-3.5" />
                            Clear filters
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}

                {!loading &&
                  invoices.map((inv) => {
                    const orderRef =
                      inv.orderId && typeof inv.orderId === "object"
                        ? inv.orderId
                        : { _id: inv.orderId };
                    return (
                      <tr
                        key={inv._id}
                        className="border-b border-slate-100 last:border-0 transition-colors hover:bg-slate-50/70"
                      >
                        <td className="px-3 py-2">
                          <div className="font-mono text-xs font-semibold text-slate-900">
                            {inv.invoiceNo ?? shortId(inv._id)}
                          </div>
                        </td>

                        <td className="px-3 py-2 font-mono text-xs text-slate-700">
                          {orderRef?.orderNo ??
                            String(orderRef._id ?? "—")}
                        </td>

                        <td className="px-3 py-2 text-sm">
                          <div className="font-medium text-slate-900">
                            {inv.customerId?.name ?? inv.customerId ?? "—"}
                          </div>
                          {inv.customerId?.phoneNumber && (
                            <div className="text-[11px] text-muted-foreground">
                              {inv.customerId.phoneNumber}
                            </div>
                          )}
                        </td>

                        <td className="px-3 py-2 text-xs text-slate-600 tabular-nums">
                          {format(inv.invoiceDate)}
                        </td>

                        <td className="px-3 py-2">
                          <InvoiceStatusBadge status={inv.status} />
                        </td>

                        <td className="px-3 py-2">
                          <PaymentStatusBadge
                            status={inv.paymentStatus}
                          />
                        </td>

                        <td className="px-3 py-2 text-right text-sm font-semibold tabular-nums text-slate-900">
                          ৳ {fmtCurrency(inv.grandTotal)}
                        </td>

                        <td className="px-3 py-2 text-right text-xs tabular-nums">
                          <span
                            className={
                              Number(inv.balanceAmount || 0) > 0
                                ? "font-semibold text-rose-600"
                                : "text-slate-500"
                            }
                          >
                            ৳ {fmtCurrency(inv.balanceAmount)}
                          </span>
                        </td>

                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => void openChalan(inv)}
                              className="h-7 bg-[#3aa838] px-2 text-[11px] text-white hover:bg-[#2f8a2f]"
                            >
                              <Truck className="mr-1 h-3 w-3" />
                              Open
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50/60 px-3 py-2 md:flex-row md:items-center md:justify-between">
            <div className="text-xs text-muted-foreground">
              {total > 0 ? (
                <>
                  Showing{" "}
                  <strong className="text-slate-900">
                    {(page - 1) * limit + 1}
                  </strong>
                  –
                  <strong className="text-slate-900">
                    {Math.min(page * limit, total)}
                  </strong>{" "}
                  of <strong className="text-slate-900">{total}</strong>
                </>
              ) : (
                <>No records</>
              )}
            </div>

            <div className="flex items-center gap-2">
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                  fetchInvoices(1, Number(e.target.value));
                }}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-[#3aa838]"
              >
                <option value={10}>10 / page</option>
                <option value={15}>15 / page</option>
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
              </select>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => {
                  if (page > 1) {
                    setPage(page - 1);
                    fetchInvoices(page - 1, limit);
                  }
                }}
                disabled={page === 1}
              >
                Prev
              </Button>

              <div className="min-w-20 text-center text-xs text-muted-foreground">
                Page <strong className="text-slate-900">{page}</strong> /{" "}
                {totalPages}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => {
                  if (page < totalPages) {
                    setPage(page + 1);
                    fetchInvoices(page + 1, limit);
                  }
                }}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </div>

        {/* ================= CHALAN MODAL ================= */}
        <Dialog
          open={!!chalanInvoice}
          onOpenChange={(open) => {
            if (!open) closeChalan();
          }}
        >
          <DialogContent className="!max-w-[95vw] !h-[95vh] mx-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#3aa838]/10">
                  <Truck className="h-4 w-4 text-[#3aa838]" />
                </span>
                Delivery Chalan
                {chalanInvoice && (
                  <span className="font-mono text-sm text-slate-500">
                    — {chalanInvoice.invoiceNo ?? shortId(chalanInvoice._id)}
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>

            <div className="mt-4 grid h-full grid-cols-1 gap-4 overflow-y-auto md:grid-cols-3">
              {/* Left: 2 cols */}
              <div className="space-y-3 md:col-span-2">
                {/* Info grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      <Building2 className="h-3 w-3" /> Customer
                    </div>
                    <div className="mt-0.5 truncate text-sm font-semibold text-slate-900">
                      {chalanInvoice?.customerId?.name ??
                        chalanInvoice?.customerId ??
                        "—"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      <Package className="h-3 w-3" /> Warehouse
                    </div>
                    <div className="mt-0.5 truncate text-sm font-semibold text-slate-900">
                      {chalanInvoice?.warehouseId?.name ??
                        chalanInvoice?.warehouseId ??
                        "—"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      <CalendarRange className="h-3 w-3" /> Invoice date
                    </div>
                    <div className="mt-0.5 text-sm font-semibold text-slate-900 tabular-nums">
                      {format(chalanInvoice?.invoiceDate)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      <Hash className="h-3 w-3" /> Order
                    </div>
                    <div className="mt-0.5 truncate text-sm font-semibold text-slate-900 font-mono">
                      {chalanInvoice?.orderId &&
                      typeof chalanInvoice.orderId === "object"
                        ? chalanInvoice.orderId.orderNo ??
                          chalanInvoice.orderId._id
                        : chalanInvoice?.orderId ?? "—"}
                    </div>
                  </div>
                </div>

                {/* Items */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <Package className="h-3.5 w-3.5" /> Items
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {chalanInvoice?.items?.length ?? 0} line item
                      {(chalanInvoice?.items?.length ?? 0) === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="overflow-hidden rounded-lg border border-slate-200">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          {["Product", "Qty", "Price", "Total"].map((h) => (
                            <th
                              key={h}
                              className={`px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-slate-600 ${
                                h === "Product" ? "text-left" : "text-right"
                              }`}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(chalanInvoice?.items ?? []).map(
                          (it: any, i: number) => (
                            <tr
                              key={i}
                              className="border-t border-slate-100"
                            >
                              <td className="px-3 py-2">
                                {it.productId?.name ?? it.name ?? "—"}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {it.qty ?? it.quantity ?? 0}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {fmtCurrency(it.unitPrice ?? it.price ?? 0)}
                              </td>
                              <td className="px-3 py-2 text-right font-semibold tabular-nums">
                                {fmtCurrency(
                                  (it.qty ?? 0) *
                                    (it.unitPrice ?? it.price ?? 0),
                                )}
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Payment summary */}
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <Wallet className="h-3.5 w-3.5" /> Payment
                    </div>
                    <PaymentStatusBadge
                      status={chalanInvoice?.paymentStatus}
                    />
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <div className="text-[11px] text-muted-foreground">
                        Total
                      </div>
                      <div className="font-semibold tabular-nums text-slate-900">
                        ৳ {fmtCurrency(chalanInvoice?.grandTotal)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-muted-foreground">
                        Paid
                      </div>
                      <div className="font-semibold tabular-nums text-[#2f8a2f]">
                        ৳ {fmtCurrency(chalanInvoice?.paidAmount)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-muted-foreground">
                        Balance
                      </div>
                      <div className="font-semibold tabular-nums text-rose-600">
                        ৳ {fmtCurrency(chalanInvoice?.balanceAmount)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: actions */}
              <div className="space-y-3">
                {/* Delivery assignment */}
                <div className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <UserCheck className="h-3.5 w-3.5" /> Delivery assignment
                  </div>

                  <div className="mt-3 space-y-2">
                    <div>
                      <Label className="text-[11px] text-slate-600">
                        Delivery man
                      </Label>
                      <Select
                        value={selectedDeliveryManId ?? "__none__"}
                        onValueChange={(v) =>
                          setSelectedDeliveryManId(v === "__none__" ? null : v)
                        }
                      >
                        <SelectTrigger className="mt-1 h-9 w-full text-xs">
                          <SelectValue placeholder="Select delivery man" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {deliveryMen.map((d) => (
                            <SelectItem key={d._id} value={d._id}>
                              {d.name}
                              {d.phoneNumber ? ` · ${d.phoneNumber}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-[11px] text-slate-600">
                        Delivery date & time
                      </Label>
                      <Input
                        type="datetime-local"
                        value={deliveryDate ?? ""}
                        onChange={(e) => setDeliveryDate(e.target.value)}
                        className="mt-1 h-9 text-xs"
                      />
                    </div>

                    {isSystemUser && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={assignDeliveryMan}
                        disabled={
                          !selectedDeliveryManId || actionLoadingFor !== null
                        }
                        className="w-full border-[#3aa838]/40 text-[#2f8a2f] hover:bg-[#3aa838]/5 hover:text-[#2f8a2f]"
                      >
                        {actionLoadingFor ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <UserCheck className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Assign
                      </Button>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <Printer className="h-3.5 w-3.5" /> Actions
                  </div>
                  <div className="mt-3 space-y-2">
                    <Button
                      type="button"
                      onClick={printChalan}
                      disabled={!chalanInvoice || chalanLoading}
                      className="w-full bg-[#3aa838] text-white hover:bg-[#2f8a2f]"
                    >
                      <Printer className="mr-1.5 h-4 w-4" />
                      Print Chalan
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={markDelivered}
                      disabled={actionLoadingFor !== null}
                      className="w-full border-[#3aa838]/40 text-[#2f8a2f] hover:bg-[#3aa838]/5 hover:text-[#2f8a2f]"
                    >
                      {actionLoadingFor ? (
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-1.5 h-4 w-4" />
                      )}
                      Mark Delivered
                    </Button>
                  </div>
                </div>

                {/* Metadata */}
                <div className="rounded-lg border border-slate-200 p-4 text-xs">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <FileText className="h-3.5 w-3.5" /> Metadata
                  </div>
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Invoice</span>
                      <span className="font-mono font-semibold text-slate-900">
                        {chalanInvoice?.invoiceNo ??
                          shortId(chalanInvoice?._id)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <InvoiceStatusBadge status={chalanInvoice?.status} />
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={closeChalan}
                  className="w-full"
                >
                  Close
                </Button>
              </div>
            </div>

            <DialogFooter>
              <div className="flex justify-end gap-2 pt-2">
                <Button onClick={closeChalan}>Close</Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}