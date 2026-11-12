// src/app/sales-invoices/page.tsx
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
  Receipt,
  RefreshCw,
  Download,
  Filter as FilterIcon,
  ChevronDown,
  ChevronUp,
  X,
  Eye,
  Ban,
  Loader2,
  CheckCircle2,
  Wallet,
  FileText,
  Clock,
  AlertTriangle,
  Plus,
  CalendarRange,
  DollarSign,
  Printer,
} from "lucide-react";

/* ---------------- Types ---------------- */
type InvoicePayment = {
  method: "CASH" | "CARD" | "BANK_TRANSFER" | "CHEQUE" | "CREDIT" | string;
  amount: number;
  paymentDate?: string;
  referenceNo?: string;
  receivedBy?: any;
};

type SalesInvoice = {
  _id: string;
  invoiceNo?: string;
  orderId?: any;
  customerId?: any;
  warehouseId?: any;
  invoiceDate?: string;
  dueDate?: string;
  items?: any[];
  subTotal?: number;
  totalDiscount?: number;
  totalTax?: number;
  grandTotal?: number;
  totalBonusQty?: number;
  paymentStatus?: "UNPAID" | "PARTIAL" | "PAID" | string;
  paidAmount?: number;
  balanceAmount?: number;
  payments?: InvoicePayment[];
  status?: "ACTIVE" | "CANCELLED" | "REFUNDED" | string;
  createdBy?: any;
  updatedBy?: any;
  createdAt?: string;
  updatedAt?: string;
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

/* ---------------- Status / Payment Badges ---------------- */
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
  if (s === "REFUNDED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
        Refunded
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
      {status || "—"}
    </span>
  );
}

/* ---------------- Small stat pill in hero ---------------- */
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
export default function SalesInvoicesPage() {
  const { format } = useClientDateFormatter();
  const currentUser = useSelector((s: RootState) => s.user.currentUser);

  /* list state */
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const qTimer = useRef<number | null>(null);

  /* 🆕 date range */
  const [datePreset, setDatePreset] = useState<DatePreset>("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  /* preview & modals */
  const [previewInvoice, setPreviewInvoice] = useState<SalesInvoice | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [paymentModal, setPaymentModal] = useState<{
    open: boolean;
    invoiceId?: string;
  }>({ open: false });

  const [paymentAmount, setPaymentAmount] = useState<number | "">("");
  const [paymentMethod, setPaymentMethod] = useState<string>("CASH");
  const [paymentReference, setPaymentReference] = useState<string>("");

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
      // 🆕 date range
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
        dueDate: r.dueDate,
        items: r.items ?? [],
        subTotal: r.subTotal ?? r.sub_total,
        totalDiscount: r.totalDiscount ?? r.total_discount,
        totalTax: r.totalTax ?? r.total_tax,
        grandTotal: r.grandTotal ?? r.grand_total ?? r.total,
        totalBonusQty: r.totalBonusQty ?? r.total_bonus_qty,
        paymentStatus: r.paymentStatus ?? r.payment_status,
        paidAmount: r.paidAmount ?? r.paid_amount ?? 0,
        balanceAmount: r.balanceAmount ?? r.balance_amount ?? r.grandTotal ?? 0,
        payments: r.payments ?? [],
        status: r.status,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
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

  /* debounce q */
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
    const paidAmt = invoices.reduce((s, i) => s + Number(i.paidAmount || 0), 0);
    const balance = invoices.reduce(
      (s, i) => s + Number(i.balanceAmount || 0),
      0,
    );
    return { paid, partial, unpaid, grand, paidAmt, balance };
  }, [invoices]);

  const activeFilterCount =
    (paymentStatusFilter !== "ALL" ? 1 : 0) +
    (statusFilter !== "ALL" ? 1 : 0) +
    (fromDate || toDate ? 1 : 0);

  const hasAnyFilter = activeFilterCount > 0 || Boolean(q);

  /* ---------------- Preview ---------------- */
  async function openPreview(invoice: SalesInvoice) {
    setPreviewInvoice(invoice);
    setPreviewLoading(true);
    try {
      const res = await api.get(`/sales-invoices/${invoice._id}`);
      const payload = res.data?.data ?? res.data ?? res;
      setPreviewInvoice({ ...invoice, ...payload });
    } catch (err) {
      console.error("openPreview err", err);
      toast.error("Failed to load invoice details");
    } finally {
      setPreviewLoading(false);
    }
  }

  /* ---------------- Payment ---------------- */
  function openPaymentDialog(invoiceId: string) {
    setPaymentAmount("");
    setPaymentMethod("CASH");
    setPaymentReference("");
    setPaymentModal({ open: true, invoiceId });
  }

  function closePaymentDialog() {
    setPaymentModal({ open: false });
  }

  async function submitPayment() {
    const invoiceId = paymentModal.invoiceId;
    if (!invoiceId) return toast.error("Invoice not selected");
    if (!paymentMethod) return toast.error("Select payment method");
    if (!paymentAmount || Number(paymentAmount) <= 0)
      return toast.error("Enter a positive amount");

    setActionLoadingFor(invoiceId);
    try {
      const payload = {
        method: paymentMethod,
        amount: Number(paymentAmount),
        paymentDate: new Date().toISOString(),
        referenceNo: paymentReference || undefined,
        receivedBy: currentUser?.id || undefined,
      };

      await api.post(`/sales-invoices/${invoiceId}/pay`, payload);

      toast.success("Payment recorded");
      closePaymentDialog();

      await fetchInvoices(page, limit);
      if (previewInvoice?._id === invoiceId) {
        const res = await api.get(`/sales-invoices/${invoiceId}`);
        setPreviewInvoice(res.data?.data ?? res.data ?? null);
      }
    } catch (err: any) {
      console.error("submitPayment err", err);
      toast.error(err?.response?.data?.message ?? "Failed to add payment");
    } finally {
      setActionLoadingFor(null);
    }
  }

  /* ---------------- Cancel ---------------- */
  async function cancelInvoice(invoiceId: string) {
    if (
      !confirm("Cancel this invoice? This action is reversible only by admin.")
    )
      return;
    setActionLoadingFor(invoiceId);
    try {
      await api.post(`/sales-invoices/${invoiceId}/cancel`);
      toast.success("Invoice cancelled");
      await fetchInvoices(page, limit);
      if (previewInvoice?._id === invoiceId) {
        const res = await api.get(`/sales-invoices/${invoiceId}`);
        setPreviewInvoice(res.data?.data ?? res.data ?? null);
      }
    } catch (err: any) {
      console.error("cancelInvoice err", err);
      toast.error(err?.response?.data?.message ?? "Failed to cancel invoice");
    } finally {
      setActionLoadingFor(null);
    }
  }

  /* ---------------- Export ---------------- */
  function exportCSV() {
    const rows = invoices.map((inv) => ({
      invoice: inv.invoiceNo ?? shortId(inv._id),
      order: inv.orderId ? (inv.orderId.orderNo ?? inv.orderId) : "",
      customer: inv.customerId?.name ?? inv.customerId ?? "",
      date: inv.invoiceDate ?? "",
      status: inv.status ?? "",
      paymentStatus: inv.paymentStatus ?? "",
      total: inv.grandTotal ?? 0,
      paid: inv.paidAmount ?? 0,
      balance: inv.balanceAmount ?? 0,
    }));
    if (!rows.length) return toast.error("No rows to export");
    const header = Object.keys(rows[0]).join(",");
    const csv = [
      header,
      ...rows.map((row) =>
        Object.values(row)
          .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-invoices-page-${page}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ---------------- Clear all ---------------- */
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

  /* ---------------- Render ---------------- */
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl p-3 md:p-4">
        {/* ================= HERO ================= */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#3aa838]/10">
              <Receipt className="h-4 w-4 text-[#3aa838]" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-semibold leading-tight">
                Sales Invoices
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                <HeroStat label="Visible" value={invoices.length} tone="slate" />
                <HeroStat label="Paid" value={summary.paid} tone="green" />
                <HeroStat label="Partial" value={summary.partial} tone="amber" />
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => exportCSV()}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export
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
                <SelectItem value="REFUNDED">Refunded</SelectItem>
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
                    Paid
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
                    <tr key={i} className="animate-pulse border-b border-slate-100">
                      {Array.from({ length: 10 }).map((__, j) => (
                        <td key={j} className="px-3 py-3">
                          <div className="h-4 w-full max-w-[100px] rounded bg-slate-100" />
                        </td>
                      ))}
                    </tr>
                  ))}

                {!loading && invoices.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-16 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center gap-3 text-muted-foreground">
                        <div className="rounded-full bg-slate-100 p-3">
                          <Receipt className="h-6 w-6" />
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
                    const isBusy = actionLoadingFor === inv._id;
                    const canPay =
                      (inv.paymentStatus || "").toUpperCase() !== "PAID" &&
                      (inv.status || "").toUpperCase() === "ACTIVE";
                    const canCancel =
                      (inv.status || "").toUpperCase() === "ACTIVE";

                    return (
                      <tr
                        key={inv._id}
                        className="border-b border-slate-100 last:border-0 transition-colors hover:bg-slate-50/70"
                      >
                        <td className="px-3 py-2">
                          <div className="font-mono text-xs font-semibold text-slate-900">
                            {inv.invoiceNo ?? shortId(inv._id)}
                          </div>
                          <div className="mt-0.5">
                            <InvoiceStatusBadge status={inv.status} />
                          </div>
                        </td>

                        <td className="px-3 py-2 text-xs text-slate-700">
                          {inv.orderId
                            ? inv.orderId.orderNo ?? String(inv.orderId)
                            : "—"}
                        </td>

                        <td className="px-3 py-2 text-sm">
                          <div className="font-medium text-slate-900">
                            {inv.customerId?.name ??
                              inv.customerId ??
                              "—"}
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
                          <PaymentStatusBadge status={inv.paymentStatus} />
                        </td>

                        <td className="px-3 py-2 text-right text-sm font-semibold tabular-nums text-slate-900">
                          ৳ {fmtCurrency(inv.grandTotal)}
                        </td>

                        <td className="px-3 py-2 text-right text-xs tabular-nums text-[#2f8a2f]">
                          ৳ {fmtCurrency(inv.paidAmount)}
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
                          <div className="flex items-center justify-end gap-0.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openPreview(inv)}
                              title="View"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>

                            {canPay && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => openPaymentDialog(inv._id)}
                                disabled={isBusy}
                                className="h-7 border-[#3aa838]/40 px-2 text-[11px] text-[#2f8a2f] hover:bg-[#3aa838]/5 hover:text-[#2f8a2f]"
                              >
                                {isBusy ? (
                                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                ) : (
                                  <Plus className="mr-1 h-3 w-3" />
                                )}
                                Pay
                              </Button>
                            )}

                            {canCancel && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                onClick={() => cancelInvoice(inv._id)}
                                disabled={isBusy}
                                title="Cancel"
                              >
                                {isBusy ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Ban className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            )}
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

        {/* ================= PREVIEW DIALOG ================= */}
        <Dialog
          open={!!previewInvoice}
          onOpenChange={(open) => {
            if (!open) setPreviewInvoice(null);
          }}
        >
          <DialogContent className="!max-w-[95vw] !h-[95vh] mx-auto">
            <DialogHeader>
              <DialogTitle>
                Invoice{" "}
                {previewInvoice?.invoiceNo ?? shortId(previewInvoice?._id)}
              </DialogTitle>
            </DialogHeader>

            <div className="mt-4 grid h-full grid-cols-1 gap-4 overflow-y-auto md:grid-cols-3">
              {/* Left: items + payments */}
              <div className="md:col-span-2">
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" />
                    Customer
                  </div>
                  <div className="mt-1 text-base font-semibold">
                    {previewInvoice?.customerId?.name ??
                      previewInvoice?.customerId ??
                      "—"}
                  </div>
                  {previewInvoice?.customerId?.phoneNumber && (
                    <div className="text-xs text-muted-foreground">
                      {previewInvoice.customerId.phoneNumber}
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Items
                  </div>
                  <div className="overflow-hidden rounded-lg border border-slate-200">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-slate-600">
                            Product
                          </th>
                          <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-slate-600">
                            Qty
                          </th>
                          <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-slate-600">
                            Price
                          </th>
                          <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-slate-600">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(previewInvoice?.items ?? []).map(
                          (it: any, idx: number) => (
                            <tr
                              key={idx}
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

                <div className="mt-4">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Payments
                  </div>
                  <div className="max-h-48 overflow-auto rounded-lg border border-slate-200 p-2">
                    {previewLoading && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading...
                      </div>
                    )}
                    {!previewLoading &&
                      (!previewInvoice?.payments ||
                        previewInvoice.payments.length === 0) && (
                        <div className="py-4 text-center text-sm text-muted-foreground">
                          No payments recorded
                        </div>
                      )}
                    {!previewLoading &&
                      (previewInvoice?.payments ?? []).map(
                        (p: InvoicePayment, i: number) => (
                          <div
                            key={i}
                            className="flex items-center justify-between border-b border-slate-100 py-2 last:border-b-0"
                          >
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#3aa838]/10">
                                <DollarSign className="h-3.5 w-3.5 text-[#3aa838]" />
                              </div>
                              <div>
                                <div className="text-sm font-medium">
                                  {p.method}
                                </div>
                                {p.referenceNo && (
                                  <div className="text-xs text-muted-foreground">
                                    {p.referenceNo}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-semibold tabular-nums text-[#2f8a2f]">
                                ৳ {fmtCurrency(p.amount)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {format(p.paymentDate)}
                              </div>
                            </div>
                          </div>
                        ),
                      )}
                  </div>
                </div>
              </div>

              {/* Right: totals + actions */}
              <div className="space-y-3">
                <div className="rounded-lg border border-[#3aa838]/20 bg-[#3aa838]/5 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-[#2f8a2f]">
                    Total
                  </div>
                  <div className="mt-1 text-2xl font-extrabold tabular-nums text-[#2f8a2f]">
                    ৳ {fmtCurrency(previewInvoice?.grandTotal)}
                  </div>
                  <div className="mt-1 text-[11px] text-[#2f8a2f]/80">
                    Sub: {fmtCurrency(previewInvoice?.subTotal)} · Tax:{" "}
                    {fmtCurrency(previewInvoice?.totalTax)}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 p-4">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </div>
                  <div className="space-y-2">
                    <div>
                      <div className="text-[11px] text-muted-foreground">
                        Invoice
                      </div>
                      <InvoiceStatusBadge status={previewInvoice?.status} />
                    </div>
                    <div>
                      <div className="text-[11px] text-muted-foreground">
                        Payment
                      </div>
                      <PaymentStatusBadge status={previewInvoice?.paymentStatus} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 border-t border-slate-200 pt-2 text-xs">
                      <div>
                        <div className="text-muted-foreground">Paid</div>
                        <div className="font-semibold tabular-nums text-[#2f8a2f]">
                          ৳ {fmtCurrency(previewInvoice?.paidAmount)}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Balance</div>
                        <div className="font-semibold tabular-nums text-rose-600">
                          ৳ {fmtCurrency(previewInvoice?.balanceAmount)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-col gap-2">
                    {previewInvoice &&
                      previewInvoice.paymentStatus !== "PAID" &&
                      previewInvoice.status === "ACTIVE" && (
                        <Button
                          className="bg-[#3aa838] text-white hover:bg-[#2f8a2f]"
                          onClick={() =>
                            openPaymentDialog(previewInvoice._id)
                          }
                        >
                          <Plus className="mr-1.5 h-4 w-4" />
                          Add Payment
                        </Button>
                      )}

                    {previewInvoice && previewInvoice.status === "ACTIVE" && (
                      <Button
                        variant="outline"
                        className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        onClick={() => cancelInvoice(previewInvoice._id)}
                      >
                        <Ban className="mr-1.5 h-4 w-4" />
                        Cancel Invoice
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      onClick={() => setPreviewInvoice(null)}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <div className="flex justify-end gap-2 pt-2">
                <Button onClick={() => setPreviewInvoice(null)}>Close</Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ================= PAYMENT DIALOG ================= */}
        <Dialog
          open={paymentModal.open}
          onOpenChange={(open) => {
            if (!open) closePaymentDialog();
          }}
        >
          <DialogContent className="!max-w-md">
            <DialogHeader>
              <DialogTitle>Add Payment</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div>
                <Label>Amount</Label>
                <Input
                  placeholder="Amount"
                  value={paymentAmount === "" ? "" : String(paymentAmount)}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") setPaymentAmount("");
                    else setPaymentAmount(Number(v));
                  }}
                />
              </div>

              <div>
                <Label>Method</Label>
                <Select
                  value={paymentMethod}
                  onValueChange={(v) => setPaymentMethod(v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">CASH</SelectItem>
                    <SelectItem value="CARD">CARD</SelectItem>
                    <SelectItem value="BANK_TRANSFER">BANK TRANSFER</SelectItem>
                    <SelectItem value="CHEQUE">CHEQUE</SelectItem>
                    <SelectItem value="CREDIT">CREDIT</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Reference (optional)</Label>
                <Input
                  placeholder="Reference number"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => closePaymentDialog()}>
                  Cancel
                </Button>
                <Button
                  onClick={() => submitPayment()}
                  disabled={actionLoadingFor !== null}
                  className="bg-[#3aa838] text-white hover:bg-[#2f8a2f]"
                >
                  {actionLoadingFor ? "Processing..." : "Submit Payment"}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}