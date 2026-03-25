// src/app/sales-invoices/page.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import api from "@/lib/api";
import { toast } from "sonner";

/* shadcn UI components (adjust paths if needed) */
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

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

/* ---------------- Helpers ---------------- */
const fmtCurrency = (n?: number) =>
  (n ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

const shortId = (s?: string) => (s ? String(s).slice(0, 8) : "—");

/* Client-only date formatter (avoid SSR mismatch) */
function useClientDateFormatter() {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(true), []);
  const format = (d?: string | Date) => {
    if (!d) return "—";
    if (!isClient) return String(d).slice(0, 19).replace("T", " ");
    try {
      return new Date(d).toLocaleString();
    } catch {
      return String(d);
    }
  };
  return { format };
}

/* ---------------- Page Component ---------------- */
export default function SalesInvoicesPage() {
  const { format } = useClientDateFormatter();

  /* user (for receivedBy) */
  const currentUser = useSelector((s: RootState) => s.user.currentUser);

  /* list state */
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const qTimer = useRef<number | null>(null);

  /* preview & modals */
  const [previewInvoice, setPreviewInvoice] = useState<SalesInvoice | null>(
    null,
  );
  const [previewLoading, setPreviewLoading] = useState(false);

  const [paymentModal, setPaymentModal] = useState<{
    open: boolean;
    invoiceId?: string;
  }>({ open: false });

  /* payment form */
  const [paymentAmount, setPaymentAmount] = useState<number | "">("");
  const [paymentMethod, setPaymentMethod] = useState<string>("CASH");
  const [paymentReference, setPaymentReference] = useState<string>("");

  /* canceling */
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

      const res = await api.get("/sales-invoices", { params });
      const payload = res.data ?? res;

      // normalize various shapes
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

  /* ---------------- Preview ---------------- */
  async function openPreview(invoice: SalesInvoice) {
    setPreviewInvoice(invoice);
    setPreviewLoading(true);
    try {
      const res = await api.get(`/sales-invoices/${invoice._id}`);
      const payload = res.data?.data ?? res.data ?? res;
      setPreviewInvoice({
        ...invoice,
        ...payload,
      });
    } catch (err) {
      console.error("openPreview err", err);
      toast.error("Failed to load invoice details");
    } finally {
      setPreviewLoading(false);
    }
  }

  function closePreview() {
    setPreviewInvoice(null);
  }

  /* ---------------- Add Payment ---------------- */
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

      // refresh list and preview
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

  /* ---------------- Cancel Invoice ---------------- */
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

  /* ---------------- Export CSV (current page) ---------------- */
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

  /* ---------------- Render ---------------- */
  return (
    <div className="min-h-screen p-6 bg-slate-50">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Sales Invoices</h1>
            <p className="text-sm text-slate-500">
              Payments • Status • Invoice lifecycle
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={() => fetchInvoices(1, limit)}>Refresh</Button>
            <Button variant="ghost" onClick={() => exportCSV()}>
              Export CSV
            </Button>
          </div>
        </div>

        {/* filters */}
        <div className="bg-white p-4 rounded shadow">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-4">
              <Label>Search (invoice / order / customer)</Label>
              <Input
                placeholder="Search invoices..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            <div className="md:col-span-3">
              <Label>Payment Status</Label>
              <Select
                value={paymentStatusFilter}
                onValueChange={(v) => {
                  setPaymentStatusFilter(v);
                  setPage(1);
                  fetchInvoices(1, limit);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Any</SelectItem>
                  <SelectItem value="UNPAID">UNPAID</SelectItem>
                  <SelectItem value="PARTIAL">PARTIAL</SelectItem>
                  <SelectItem value="PAID">PAID</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-3">
              <Label>Invoice Status</Label>
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v);
                  setPage(1);
                  fetchInvoices(1, limit);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Any</SelectItem>
                  <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                  <SelectItem value="CANCELLED">CANCELLED</SelectItem>
                  <SelectItem value="REFUNDED">REFUNDED</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2 flex items-end gap-2">
              <Button
                onClick={() => {
                  setQ("");
                  setPaymentStatusFilter("ALL");
                  setStatusFilter("ALL");
                  fetchInvoices(1, limit);
                }}
              >
                Clear
              </Button>
              <Button
                onClick={() => {
                  setPage(1);
                  fetchInvoices(1, limit);
                }}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>

        {/* table */}
        <div className="bg-white rounded shadow overflow-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left">Invoice</th>
                <th className="px-4 py-3 text-left">Order</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Payment</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3 text-center w-48">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading &&
                Array.from({ length: limit }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="p-4">
                      <div className="h-4 w-28 bg-slate-200 rounded" />
                    </td>
                    <td className="p-4">
                      <div className="h-4 w-20 bg-slate-200 rounded" />
                    </td>
                    <td className="p-4">
                      <div className="h-4 w-36 bg-slate-200 rounded" />
                    </td>
                    <td className="p-4">
                      <div className="h-4 w-28 bg-slate-200 rounded" />
                    </td>
                    <td className="p-4">
                      <div className="h-4 w-24 bg-slate-200 rounded" />
                    </td>
                    <td className="p-4 text-right">
                      <div className="h-4 w-20 bg-slate-200 rounded ml-auto" />
                    </td>
                    <td className="p-4 text-right">
                      <div className="h-4 w-16 bg-slate-200 rounded ml-auto" />
                    </td>
                    <td className="p-4 text-right">
                      <div className="h-4 w-16 bg-slate-200 rounded ml-auto" />
                    </td>
                    <td className="p-4 text-center">
                      <div className="h-6 w-24 bg-slate-200 rounded mx-auto" />
                    </td>
                  </tr>
                ))}

              {!loading && invoices.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-slate-500">
                    No invoices found
                  </td>
                </tr>
              )}

              {!loading &&
                invoices.map((inv) => (
                  <tr key={inv._id} className="border-t hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {inv.invoiceNo ?? shortId(inv._id)}
                      </div>
                      <div className="text-xs text-slate-500">{inv.status}</div>
                    </td>

                    <td className="px-4 py-3">
                      {inv.orderId
                        ? (inv.orderId.orderNo ?? String(inv.orderId))
                        : "—"}
                    </td>

                    <td className="px-4 py-3">
                      {inv.customerId?.name ?? inv.customerId ?? "—"}
                    </td>

                    <td className="px-4 py-3">{format(inv.invoiceDate)}</td>

                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          inv.paymentStatus === "PAID"
                            ? "secondary"
                            : inv.paymentStatus === "PARTIAL"
                              ? "outline"
                              : "destructive"
                        }
                      >
                        {inv.paymentStatus ?? "—"}
                      </Badge>
                    </td>

                    <td className="px-4 py-3 text-right font-semibold">
                      {fmtCurrency(inv.grandTotal)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {fmtCurrency(inv.paidAmount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {fmtCurrency(inv.balanceAmount)}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <div className="flex gap-2 justify-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openPreview(inv)}
                        >
                          View
                        </Button>

                        {/* Add payment when not fully paid and invoice active */}
                        {inv.paymentStatus !== "PAID" &&
                          inv.status === "ACTIVE" && (
                            <Button
                              size="sm"
                              onClick={() => openPaymentDialog(inv._id)}
                              disabled={actionLoadingFor === inv._id}
                            >
                              {actionLoadingFor === inv._id
                                ? "..."
                                : "Add Payment"}
                            </Button>
                          )}

                        {/* Cancel invoice */}
                        {inv.status === "ACTIVE" && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => cancelInvoice(inv._id)}
                            disabled={actionLoadingFor === inv._id}
                          >
                            {actionLoadingFor === inv._id ? "..." : "Cancel"}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>

          {/* footer */}
          <div className="flex items-center justify-between p-3 bg-slate-50">
            <div className="text-sm text-slate-600">
              Showing <strong>{Math.min((page - 1) * limit + 1, total)}</strong>{" "}
              to <strong>{Math.min(page * limit, total)}</strong> of{" "}
              <strong>{total}</strong>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
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

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={page}
                  onChange={(e) => {
                    const v = Math.max(
                      1,
                      Math.min(totalPages, Number(e.target.value) || 1),
                    );
                    setPage(v);
                    fetchInvoices(v, limit);
                  }}
                  className="w-16 text-center border rounded px-2 py-1"
                />
                <div>/ {totalPages}</div>
              </div>

              <Button
                size="sm"
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

              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                  fetchInvoices(1, Number(e.target.value));
                }}
                className="border rounded px-2 py-1"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </div>

        {/* Preview dialog */}
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 h-full overflow-y-auto">
              {/* left: items */}
              <div className="md:col-span-2">
                <div className="text-xs text-slate-500">Customer</div>
                <div className="font-medium mb-3">
                  {previewInvoice?.customerId?.name ??
                    previewInvoice?.customerId ??
                    "—"}
                </div>

                <div className="text-xs text-slate-500">Items</div>
                <div className="mt-2 border rounded">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="p-2 text-left">Product</th>
                        <th className="p-2 text-right">Qty</th>
                        <th className="p-2 text-right">Price</th>
                        <th className="p-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(previewInvoice?.items ?? []).map(
                        (it: any, idx: number) => (
                          <tr key={idx} className="border-t">
                            <td className="p-2">
                              {it.productId?.name ?? it.name ?? "—"}
                            </td>
                            <td className="p-2 text-right">
                              {it.qty ?? it.quantity ?? 0}
                            </td>
                            <td className="p-2 text-right">
                              {fmtCurrency(it.unitPrice ?? it.price ?? 0)}
                            </td>
                            <td className="p-2 text-right">
                              {fmtCurrency(
                                (it.qty ?? 0) * (it.unitPrice ?? it.price ?? 0),
                              )}
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4">
                  <div className="font-medium">Payments</div>
                  <div className="mt-2 border rounded p-2 max-h-48 overflow-auto">
                    {previewLoading && (
                      <div className="text-sm text-slate-500">Loading…</div>
                    )}
                    {!previewLoading &&
                      (!previewInvoice?.payments ||
                        previewInvoice.payments.length === 0) && (
                        <div className="text-sm text-slate-500">
                          No payments recorded
                        </div>
                      )}
                    {!previewLoading &&
                      (previewInvoice?.payments ?? []).map(
                        (p: InvoicePayment, i: number) => (
                          <div
                            key={i}
                            className="flex justify-between py-2 border-b last:border-b-0"
                          >
                            <div>
                              <div className="font-medium">{p.method}</div>
                              <div className="text-xs text-slate-400">
                                {p.referenceNo ?? ""}
                              </div>
                            </div>
                            <div className="text-right">
                              <div>{fmtCurrency(p.amount)}</div>
                              <div className="text-xs text-slate-400">
                                {format(p.paymentDate)}
                              </div>
                            </div>
                          </div>
                        ),
                      )}
                  </div>
                </div>
              </div>

              {/* right: totals and actions */}
              <div className="space-y-3">
                <div className="border rounded p-3 bg-slate-50">
                  <div className="text-xs text-slate-500">Totals</div>
                  <div className="text-lg font-semibold mt-2">
                    {fmtCurrency(previewInvoice?.grandTotal)}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Sub: {fmtCurrency(previewInvoice?.subTotal)} • Tax:{" "}
                    {fmtCurrency(previewInvoice?.totalTax)}
                  </div>
                </div>

                <div className="border rounded p-3">
                  <div className="text-sm font-medium mb-2">Status</div>
                  <div className="mb-2">
                    <div className="text-xs text-slate-400">Invoice</div>
                    <div className="font-medium">{previewInvoice?.status}</div>
                  </div>

                  <div>
                    <div className="text-xs text-slate-400">Payment</div>
                    <div className="font-medium">
                      {previewInvoice?.paymentStatus}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      Paid: {fmtCurrency(previewInvoice?.paidAmount)} • Balance:{" "}
                      {fmtCurrency(previewInvoice?.balanceAmount)}
                    </div>
                  </div>
                </div>

                <div className="border rounded p-3">
                  <div className="flex flex-col gap-2">
                    {previewInvoice &&
                      previewInvoice.paymentStatus !== "PAID" &&
                      previewInvoice.status === "ACTIVE" && (
                        <Button
                          onClick={() => openPaymentDialog(previewInvoice._id)}
                        >
                          Add Payment
                        </Button>
                      )}

                    {previewInvoice && previewInvoice.status === "ACTIVE" && (
                      <Button
                        variant="destructive"
                        onClick={() => cancelInvoice(previewInvoice._id)}
                      >
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

        {/* Payment Modal */}
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
                    // allow empty or numeric
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
