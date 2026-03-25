// src/app/delivery-chalan/page.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import api from "@/lib/api";
import { toast } from "sonner";

/* shadcn components — adjust imports if needed */
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
import { Badge } from "@/components/ui/badge";

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
      return new Date(d).toLocaleString();
    } catch {
      return String(d);
    }
  };
  return { format };
}

/**
 * Delivery Chalan Page
 */
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

  /* preview / chalan modal */
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

  /* ---------------- Fetch delivery men (best-effort) ---------------- */
  async function fetchDeliveryMen() {
    try {
      // Try supporting role filter; fallback to all users (then filter)
      const res = await api
        .get("/users", { params: { role: "DELIVERY", page: 1, limit: 1000 } })
        .catch(() => api.get("/users", { params: { page: 1, limit: 1000 } }));

      const rows = res.data?.data ?? res.data ?? [];
      // prefer those whose role matches DELIVERY
      const normalized = (rows || []).map((u: any) => ({
        _id: u._id ?? u.id,
        name: u.name ?? u.fullName ?? u.username ?? shortId(u._id ?? u.id),
        phoneNumber: u.phoneNumber ?? u.phone ?? "",
        role: u.role,
      })) as UserLite[];

      // try to keep only delivery-role users if present
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

  /* ---------------- Open Chalan (loads full invoice) ---------------- */
  async function openChalan(invoice: SalesInvoice) {
    setChalanInvoice(null);
    setChalanLoading(true);
    setSelectedDeliveryManId(null);
    setDeliveryDate(null);

    try {
      const res = await api.get(`/sales-invoices/${invoice._id}`);
      const payload = res.data?.data ?? res.data ?? res;
      const inv = {
        ...invoice,
        ...payload,
      } as SalesInvoice;

      // If invoice has orderId populated object, try to get deliveryMan
      const orderRef = inv.orderId;
      // If orderRef has deliveryManId, set as selected
      const deliveryManId =
        orderRef && typeof orderRef === "object"
          ? (orderRef.deliveryManId ?? orderRef.deliveryMan?._id ?? null)
          : null;

      setChalanInvoice(inv);
      setSelectedDeliveryManId(deliveryManId ? String(deliveryManId) : null);

      // set default delivery date to now
      setDeliveryDate(new Date().toISOString().slice(0, 16)); // yyyy-mm-ddTHH:MM
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

  /* ---------------- Assign delivery man on order (admin action) ---------------- */
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
      // refresh invoice data
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

  /* ---------------- Mark Delivered (calls sales-order deliver endpoint)
     This endpoint sets deliveryManId using the authenticated user on the backend.
  ---------------------- */
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
      // call deliver (authenticated user will be used as delivery man)
      await api.post(`/sales-orders/${orderId}/deliver`);

      // Optionally: update chalanInvoice to reflect delivered state
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

  /* ---------------- Print Chalan (opens new window for printing) ---------------- */
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
      (orderRef && orderRef.deliveryMan ? orderRef.deliveryMan : null);

    const html = `
      <html>
        <head>
          <title>Delivery Chalan - ${invoice.invoiceNo ?? shortId(invoice._id)}</title>
          <style>
            body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 20px; }
            .header { display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; }
            .company { font-size:18px; font-weight:700; }
            .meta { text-align:right; }
            table { width:100%; border-collapse:collapse; margin-top:10px; }
            th, td { border:1px solid #ddd; padding:8px; text-align:left; }
            th { background:#f7f7f7; }
            .totals { margin-top:12px; width:100%; display:flex; justify-content:flex-end; }
            .totals div { width: 320px; }
            .small { font-size:12px; color:#555; }
            .center { text-align:center; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="company">${companyName}</div>
              <div class="small">Delivery Chalan</div>
            </div>
            <div class="meta">
              <div><strong>Chalan for Invoice:</strong> ${invoice.invoiceNo ?? shortId(invoice._id)}</div>
              <div><strong>Date:</strong> ${new Date().toLocaleString()}</div>
              <div><strong>Order:</strong> ${orderRef.orderNo ?? orderRef._id ?? "—"}</div>
            </div>
          </div>

          <div>
            <strong>Deliver To:</strong>
            <div>${(invoice.customerId && (invoice.customerId.name ?? invoice.customerId)) ?? "—"}</div>
            <div class="small">${(invoice.customerId && invoice.customerId.address) ?? ""}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width:8%;">#</th>
                <th>Product</th>
                <th style="width:12%;" class="center">Qty</th>
                <th style="width:18%;">Unit Price</th>
                <th style="width:18%;">Line Total</th>
              </tr>
            </thead>
            <tbody>
              ${
                (invoice.items ?? [])
                  .map((it: any, i: number) => {
                    const p = it.productId ?? it;
                    const name = p?.name ?? p?.title ?? it.name ?? "—";
                    const qty = it.qty ?? it.quantity ?? 0;
                    const price = it.unitPrice ?? it.price ?? 0;
                    const line = (qty * price).toFixed(2);
                    return `<tr>
                      <td class="center">${i + 1}</td>
                      <td>${name}</td>
                      <td class="center">${qty}</td>
                      <td class="right">${Number(price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td class="right">${Number(line).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>`;
                  })
                  .join("") ||
                "<tr><td colspan='5' class='center'>No items</td></tr>"
              }
            </tbody>
          </table>

          <div class="totals">
            <div>
              <table>
                <tr>
                  <td>Subtotal</td>
                  <td style="text-align:right;">${Number(invoice.subTotal ?? 0).toLocaleString()}</td>
                </tr>
                <tr>
                  <td>Tax</td>
                  <td style="text-align:right;">${Number(invoice.totalTax ?? 0).toLocaleString()}</td>
                </tr>
                <tr>
                  <td><strong>Grand Total</strong></td>
                  <td style="text-align:right;"><strong>${Number(invoice.grandTotal ?? 0).toLocaleString()}</strong></td>
                </tr>
              </table>
              <div style="margin-top:16px;">
                <div><strong>Delivery Man:</strong> ${deliveryMan ? (deliveryMan.name ?? shortId(deliveryMan._id)) : "—"}</div>
                <div><strong>Delivery Date:</strong> ${deliveryDate ? new Date(deliveryDate).toLocaleString() : "—"}</div>
              </div>

              <div style="margin-top:28px;">
                <div>______________________________</div>
                <div>Receiver Signature</div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) {
      toast.error("Please allow popups for printing");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    // wait a tick for content to load then print
    setTimeout(() => {
      try {
        w.focus();
        w.print();
        // optionally close after printing
        // w.close();
      } catch (err) {
        console.error("printChalan error", err);
      }
    }, 300);
  }

  /* ---------------- Render ---------------- */
  return (
    <div className="min-h-screen p-6 bg-slate-50">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Delivery Chalan</h1>
            <p className="text-sm text-slate-500">
              Generate and print delivery chalan for invoices & mark orders
              delivered.
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => fetchInvoices(1, limit)}>Refresh</Button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded shadow">
          <div className="grid grid-cols-1 md:grid-cols-8 gap-3">
            <div className="md:col-span-4">
              <Label>Search (invoice / order / customer)</Label>
              <Input
                placeholder="Search..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            <div className="md:col-span-2 flex items-end gap-2">
              <Button
                onClick={() => {
                  setQ("");
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

        {/* invoices table */}
        <div className="bg-white rounded shadow overflow-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left">Invoice</th>
                <th className="px-4 py-3 text-left">Order</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3 text-center w-56">Actions</th>
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
                      <div className="h-4 w-24 bg-slate-200 rounded" />
                    </td>
                    <td className="p-4">
                      <div className="h-4 w-36 bg-slate-200 rounded" />
                    </td>
                    <td className="p-4">
                      <div className="h-4 w-28 bg-slate-200 rounded" />
                    </td>
                    <td className="p-4 text-right">
                      <div className="h-4 w-20 bg-slate-200 rounded ml-auto" />
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
                  <td colSpan={7} className="p-10 text-center text-slate-500">
                    No invoices found
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
                    <tr key={inv._id} className="border-t hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-medium">
                          {inv.invoiceNo ?? shortId(inv._id)}
                        </div>
                        <div className="text-xs text-slate-500">
                          {inv.status}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        {orderRef?.orderNo ?? String(orderRef._id ?? "—")}
                      </td>
                      <td className="px-4 py-3">
                        {inv.customerId?.name ?? inv.customerId ?? "—"}
                      </td>
                      <td className="px-4 py-3">{format(inv.invoiceDate)}</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {fmtCurrency(inv.grandTotal)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {fmtCurrency(inv.balanceAmount)}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <div className="flex gap-2 justify-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openChalan(inv)}
                          >
                            Chalan
                          </Button>

                          {/* If current user is delivery role (or system) show mark delivered */}
                          <Button
                            size="sm"
                            onClick={async () => {
                              await openChalan(inv);
                              // keep modal open for user to mark delivered if desired
                            }}
                          >
                            Preview
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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

        {/* Chalan modal */}
        <Dialog
          open={!!chalanInvoice}
          onOpenChange={(open) => {
            if (!open) closeChalan();
          }}
        >
          <DialogContent className="!max-w-[95vw] !h-[95vh] mx-auto">
            <DialogHeader>
              <DialogTitle>
                Delivery Chalan{" "}
                {chalanInvoice
                  ? `— ${chalanInvoice.invoiceNo ?? shortId(chalanInvoice._id)}`
                  : ""}
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 h-full overflow-y-auto">
              <div className="md:col-span-2 space-y-3">
                <div>
                  <div className="text-xs text-slate-500">Customer</div>
                  <div className="font-medium">
                    {chalanInvoice?.customerId?.name ??
                      chalanInvoice?.customerId ??
                      "—"}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500">Warehouse</div>
                  <div className="font-medium">
                    {chalanInvoice?.warehouseId?.name ??
                      chalanInvoice?.warehouseId ??
                      "—"}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500">Invoice Date</div>
                  <div className="font-medium">
                    {format(chalanInvoice?.invoiceDate)}
                  </div>
                </div>

                <div>
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
                        {(chalanInvoice?.items ?? []).map(
                          (it: any, i: number) => (
                            <tr key={i} className="border-t">
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

                <div>
                  <div className="text-xs text-slate-500">Payments</div>
                  <div className="mt-2 text-sm">
                    Paid: {fmtCurrency(chalanInvoice?.paidAmount)} • Balance:{" "}
                    {fmtCurrency(chalanInvoice?.balanceAmount)}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="border rounded p-3 bg-slate-50">
                  <div className="text-xs text-slate-500">Totals</div>
                  <div className="text-lg font-semibold mt-2">
                    {fmtCurrency(chalanInvoice?.grandTotal)}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Sub: {fmtCurrency(chalanInvoice?.subTotal)} • Tax:{" "}
                    {fmtCurrency(chalanInvoice?.totalTax)}
                  </div>
                </div>

                <div className="border rounded p-3">
                  <div className="text-sm font-medium mb-2">Delivery</div>

                  <div className="mb-2">
                    <Label>Delivery Man</Label>
                    <Select
                      value={selectedDeliveryManId ?? ""}
                      onValueChange={(v) => setSelectedDeliveryManId(v || null)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select delivery man" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {deliveryMen.map((d) => (
                          <SelectItem key={d._id} value={d._id}>
                            {d.name} {d.phoneNumber ? `• ${d.phoneNumber}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="mb-2">
                    <Label>Delivery Date & Time</Label>
                    <Input
                      type="datetime-local"
                      value={deliveryDate ?? ""}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                    />
                    <div className="text-xs text-slate-400 mt-1">
                      Defaults to now when printing/marking delivered
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3">
                    {/* Assign button only for system/admin users */}
                    {isSystemUser && (
                      <Button
                        variant="outline"
                        onClick={assignDeliveryMan}
                        disabled={
                          !selectedDeliveryManId || actionLoadingFor !== null
                        }
                      >
                        {actionLoadingFor ? "..." : "Assign"}
                      </Button>
                    )}

                    <Button
                      onClick={printChalan}
                      disabled={!chalanInvoice || chalanLoading}
                    >
                      Print Chalan
                    </Button>

                    {/* Mark delivered: available to any authenticated user. Backend will set deliveryManId to authenticated user. */}
                    <Button
                      variant="destructive"
                      onClick={markDelivered}
                      disabled={actionLoadingFor !== null}
                    >
                      {actionLoadingFor ? "Processing..." : "Mark Delivered"}
                    </Button>
                  </div>
                </div>

                <div className="border rounded p-3">
                  <div className="text-sm font-medium mb-2">Metadata</div>
                  <div className="text-xs text-slate-500">Invoice</div>
                  <div className="mb-2">
                    {chalanInvoice?.invoiceNo ?? shortId(chalanInvoice?._id)}
                  </div>

                  <div className="text-xs text-slate-500">Status</div>
                  <div className="mb-2">
                    <Badge>{chalanInvoice?.status ?? "—"}</Badge>
                  </div>

                  <div className="flex justify-end gap-2 mt-3">
                    <Button variant="ghost" onClick={closeChalan}>
                      Close
                    </Button>
                  </div>
                </div>
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
