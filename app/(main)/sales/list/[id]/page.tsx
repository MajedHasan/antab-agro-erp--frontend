"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Printer,
  RefreshCw,
  Truck,
  Ban,
  Upload,
  Pencil,
} from "lucide-react";

type OrderStatus =
  | "PENDING_AM"
  | "PENDING_RM"
  | "PENDING_NSM"
  | "PENDING_FULFILLMENT"
  | "IN_SHIPPING"
  | "DELIVERED"
  | "REJECTED"
  | "CANCELLED";

type SalesOrderDetail = {
  _id: string;
  orderNo: string;
  orderDate?: string;
  customerId?: any;
  warehouseId?: any;
  invoiceId?: any;
  items?: any[];
  subTotal?: number;
  totalDiscount?: number;
  totalTax?: number;
  grandTotal?: number;
  totalBonusQty?: number;
  paymentMethod?: "CASH" | "CREDIT";
  creditSnapshot?: {
    creditLimit?: number;
    used?: number;
    available?: number;
  };
  status: OrderStatus;
  isInvoiced?: boolean;
  notes?: string;
  approvalLogs?: Array<{
    role?: string;
    status?: string;
    remarks?: string;
    actionDate?: string;
    userId?: any;
  }>;
  createdAt?: string;
  updatedAt?: string;
};

const MEDIA_UPLOAD_ENDPOINT = "/media"; // change only if your upload route is different

function money(n: number | undefined) {
  return Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(value?: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const styles: Record<OrderStatus, string> = {
    PENDING_AM: "bg-slate-100 text-slate-700 border-slate-200",
    PENDING_RM: "bg-indigo-100 text-indigo-700 border-indigo-200",
    PENDING_NSM: "bg-violet-100 text-violet-700 border-violet-200",
    PENDING_FULFILLMENT: "bg-amber-100 text-amber-700 border-amber-200",
    IN_SHIPPING: "bg-cyan-100 text-cyan-700 border-cyan-200",
    DELIVERED: "bg-emerald-100 text-emerald-700 border-emerald-200",
    REJECTED: "bg-red-100 text-red-700 border-red-200",
    CANCELLED: "bg-rose-100 text-rose-700 border-rose-200",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${styles[status]}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

function PaymentBadge({ method }: { method?: "CASH" | "CREDIT" }) {
  if (!method) return <span className="text-xs text-muted-foreground">-</span>;
  const styles =
    method === "CREDIT"
      ? "bg-orange-100 text-orange-700 border-orange-200"
      : "bg-slate-100 text-slate-700 border-slate-200";

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${styles}`}
    >
      {method}
    </span>
  );
}

function lineSubtotal(item: any) {
  return Number(
    item?.lineSubtotal ?? Number(item?.qty || 0) * Number(item?.unitPrice || 0),
  );
}

function lineTotal(item: any) {
  return Number(item?.lineTotal ?? lineSubtotal(item));
}

export default function SalesOrderViewPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const orderId = params?.id;

  const [loading, setLoading] = useState(true);
  const [savingAction, setSavingAction] = useState<string | null>(null);
  const [order, setOrder] = useState<SalesOrderDetail | null>(null);

  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofUploading, setProofUploading] = useState(false);

  const printRef = useRef<HTMLDivElement | null>(null);

  const loadOrder = useCallback(async () => {
    if (!orderId) return;

    setLoading(true);
    try {
      const res = await api.get(`/sales-orders/${orderId}`);
      const data = res.data?.data || res.data;
      setOrder(data);
    } catch (err: any) {
      console.error(err);
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load sales order.",
      );
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  const dealer = order?.customerId || {};
  const warehouse = order?.warehouseId || {};
  const invoice = order?.invoiceId || null;
  const items = order?.items || [];

  const totals = useMemo(() => {
    const qty = items.reduce((s, it) => s + Number(it.qty || 0), 0);
    const bonusQty = items.reduce((s, it) => s + Number(it.bonusQty || 0), 0);
    const subtotal = items.reduce((s, it) => s + lineSubtotal(it), 0);
    const total = items.reduce((s, it) => s + lineTotal(it), 0);
    return { qty, bonusQty, subtotal, total };
  }, [items]);

  const approvalFlow = useMemo(
    () =>
      [
        "PENDING_AM",
        "PENDING_RM",
        "PENDING_NSM",
        "PENDING_FULFILLMENT",
        "IN_SHIPPING",
        "DELIVERED",
      ] as OrderStatus[],
    [],
  );

  const canEdit =
    order &&
    ["PENDING_AM", "PENDING_RM", "PENDING_NSM", "PENDING_FULFILLMENT"].includes(
      order.status,
    );

  const canShip = order?.status === "PENDING_FULFILLMENT";
  const canDeliver = order?.status === "IN_SHIPPING";
  const canCancel = order
    ? !["DELIVERED", "CANCELLED"].includes(order.status)
    : false;

  const handlePrint = () => {
    if (!printRef.current) {
      window.print();
      return;
    }

    const win = window.open("", "_blank", "width=1100,height=800");
    if (!win) {
      window.print();
      return;
    }

    win.document.write(`
      <html>
        <head>
          <title>Sales Order ${order?.orderNo || ""}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            .wrap { max-width: 980px; margin: 0 auto; }
            .row { display: flex; justify-content: space-between; gap: 16px; }
            .muted { color: #6b7280; }
            .card { border: 1px solid #e5e7eb; border-radius: 14px; padding: 16px; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #e5e7eb; padding: 8px; font-size: 12px; }
            th { background: #f9fafb; text-align: left; }
            .right { text-align: right; }
            .signature-box { height: 110px; border: 1px dashed #9ca3af; border-radius: 10px; display: flex; align-items: flex-end; justify-content: center; padding: 12px; }
            .qr-box { width: 150px; height: 150px; border: 1px solid #d1d5db; border-radius: 12px; display: flex; align-items: center; justify-content: center; text-align: center; padding: 10px; font-size: 11px; overflow-wrap: anywhere; }
            .small { font-size: 11px; }
          </style>
        </head>
        <body>
          ${printRef.current.innerHTML}
        </body>
      </html>
    `);
    win.document.close();
    setTimeout(() => {
      win.focus();
      win.print();
      win.close();
    }, 400);
  };

  const uploadProofFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await api.post(MEDIA_UPLOAD_ENDPOINT, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    const data = res.data?.data || res.data;
    const mediaId = data?._id || data?.id;
    if (!mediaId) {
      throw new Error("Uploaded file id not returned by upload API.");
    }

    return String(mediaId);
  };

  const handleShip = async () => {
    if (!orderId) return;

    if (!confirm("Create invoice and move this order to fulfillment?")) return;

    setSavingAction("ship");
    try {
      await api.post(`/sales-orders/${orderId}/ship`);
      toast.success("Invoice created.");
      await loadOrder();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || err?.message || "Failed to ship order.",
      );
    } finally {
      setSavingAction(null);
    }
  };

  const handleCancel = async () => {
    if (!orderId) return;

    if (!confirm("Cancel this sales order?")) return;

    setSavingAction("cancel");
    try {
      await api.post(`/sales-orders/${orderId}/cancel`);
      toast.success("Order cancelled.");
      await loadOrder();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to cancel order.",
      );
    } finally {
      setSavingAction(null);
    }
  };

  const handleDeliver = async () => {
    if (!orderId) return;

    if (!proofFile) {
      toast.error("Please upload the signed invoice first.");
      return;
    }

    setSavingAction("deliver");
    setProofUploading(true);
    try {
      const uploadedDocumentFileId = await uploadProofFile(proofFile);

      await api.post(`/sales-orders/${orderId}/deliver`, {
        uploadedDocumentFileId,
      });

      toast.success("Delivery approved.");
      setProofFile(null);
      await loadOrder();
    } catch (err: any) {
      console.error(err);
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to deliver order.",
      );
    } finally {
      setProofUploading(false);
      setSavingAction(null);
    }
  };

  const qrPayload = typeof invoice?.qrCode === "string" ? invoice.qrCode : "";
  const dealerSignatureId =
    dealer?.attachments?.required?.signature?._id ||
    dealer?.attachments?.required?.signature?.id ||
    dealer?.attachments?.required?.signature ||
    "";

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading sales order...
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="w-full max-w-lg">
          <CardContent className="p-6 text-center">
            <div className="text-lg font-semibold">Sales order not found</div>
            <div className="mt-2 text-sm text-muted-foreground">
              The requested record may have been deleted or the URL is invalid.
            </div>
            <Button
              className="mt-4"
              onClick={() => router.push("/sales-orders")}
            >
              Back to list
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl p-4 md:p-6">
        <div className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-sm text-muted-foreground">
                Sales Order Details
              </div>
              <h1 className="text-2xl font-semibold">{order.orderNo}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={order.status} />
                <PaymentBadge method={order.paymentMethod} />
                <span className="text-sm text-muted-foreground">
                  Created: {fmtDate(order.createdAt || order.orderDate)}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadOrder()}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>

              {canEdit ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/sales/list/${order._id}/edit`)}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              ) : null}

              {invoice ? (
                <Button type="button" variant="outline" onClick={handlePrint}>
                  <Printer className="mr-2 h-4 w-4" />
                  Print invoice
                </Button>
              ) : null}

              {canShip ? (
                <Button type="button" onClick={() => void handleShip()}>
                  {savingAction === "ship" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Truck className="mr-2 h-4 w-4" />
                  )}
                  Ship
                </Button>
              ) : null}

              {canCancel ? (
                <Button
                  type="button"
                  variant="outline"
                  className="text-red-600 hover:text-red-700"
                  onClick={() => void handleCancel()}
                >
                  {savingAction === "cancel" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Ban className="mr-2 h-4 w-4" />
                  )}
                  Cancel
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Order information</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-md border bg-slate-50 p-4">
                  <div className="text-xs text-muted-foreground">Dealer</div>
                  <div className="mt-1 font-semibold">
                    {dealer?.name || dealer?.proprietor || "-"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {dealer?.phoneNumber || dealer?.phone || "-"}
                  </div>
                </div>

                <div className="rounded-md border bg-slate-50 p-4">
                  <div className="text-xs text-muted-foreground">Warehouse</div>
                  <div className="mt-1 font-semibold">
                    {warehouse?.name || "-"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {warehouse?.code || ""}
                  </div>
                </div>

                <div className="rounded-md border bg-slate-50 p-4">
                  <div className="text-xs text-muted-foreground">
                    Order date
                  </div>
                  <div className="mt-1 font-semibold">
                    {fmtDate(order.orderDate || order.createdAt)}
                  </div>
                </div>

                <div className="rounded-md border bg-slate-50 p-4">
                  <div className="text-xs text-muted-foreground">
                    Payment method
                  </div>
                  <div className="mt-1 font-semibold">
                    {order.paymentMethod || "-"}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Items</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-slate-100 text-left">
                    <tr>
                      <th className="border-b px-4 py-3">#</th>
                      <th className="border-b px-4 py-3">Product</th>
                      <th className="border-b px-4 py-3 text-right">Qty</th>
                      <th className="border-b px-4 py-3 text-right">Bonus</th>
                      <th className="border-b px-4 py-3 text-right">
                        Unit price
                      </th>
                      <th className="border-b px-4 py-3 text-right">
                        Subtotal
                      </th>
                      <th className="border-b px-4 py-3 text-right">Tax</th>
                      <th className="border-b px-4 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr
                        key={item._id || index}
                        className="border-b last:border-0 hover:bg-slate-50"
                      >
                        <td className="px-4 py-3">{index + 1}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium">
                            {item.productId?.name ||
                              item.productName ||
                              item.name ||
                              item.productId?._id ||
                              "-"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.productId?.sku || item.productId?.code || ""}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {Number(item.qty || 0)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {Number(item.bonusQty || 0)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {money(Number(item.unitPrice || 0))}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {money(lineSubtotal(item))}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {money(Number(item.taxAmount || 0))}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {money(lineTotal(item))}
                        </td>
                      </tr>
                    ))}

                    {!items.length ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-4 py-10 text-center text-muted-foreground"
                        >
                          No items found.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Approval timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {approvalFlow.map((step) => {
                    const matched = order.approvalLogs?.find(
                      (l) => l.role === step,
                    );
                    const active = step === order.status;
                    const done =
                      matched?.status === "APPROVED" ||
                      ["DELIVERED"].includes(order.status) ||
                      approvalFlow.indexOf(step) <
                        approvalFlow.indexOf(order.status);

                    return (
                      <div
                        key={step}
                        className={`rounded-md border p-4 ${
                          active
                            ? "border-indigo-300 bg-indigo-50"
                            : done
                              ? "border-emerald-200 bg-emerald-50/70"
                              : "bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium">
                            {step.replaceAll("_", " ")}
                          </div>
                          <StatusBadge status={step} />
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          {matched?.actionDate
                            ? fmtDate(matched.actionDate)
                            : "No action yet"}
                        </div>
                        {matched?.remarks ? (
                          <div className="mt-2 text-xs text-muted-foreground">
                            {matched.remarks}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border bg-slate-50 p-4 text-sm">
                  {order.notes || "No notes provided."}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Totals</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Qty</span>
                  <span className="font-medium">{totals.qty}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Bonus qty
                  </span>
                  <span className="font-medium">{totals.bonusQty}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Sub total
                  </span>
                  <span className="font-medium">
                    {money(order.subTotal ?? totals.subtotal)} BDT
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Discount
                  </span>
                  <span className="font-medium">
                    {money(order.totalDiscount)} BDT
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Tax</span>
                  <span className="font-medium">
                    {money(order.totalTax)} BDT
                  </span>
                </div>
                <div className="flex items-center justify-between border-t pt-3">
                  <span className="text-base font-semibold">Grand total</span>
                  <span className="text-lg font-bold text-indigo-700">
                    {money(order.grandTotal ?? totals.total)} BDT
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Credit summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Credit limit</span>
                  <span className="font-medium">
                    {money(order.creditSnapshot?.creditLimit)} BDT
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Used</span>
                  <span className="font-medium">
                    {money(order.creditSnapshot?.used)} BDT
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Available</span>
                  <span className="font-medium">
                    {money(order.creditSnapshot?.available)} BDT
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Invoice</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {invoice ? (
                  <>
                    <div className="rounded-md border bg-slate-50 p-4">
                      <div className="text-xs text-muted-foreground">
                        Invoice No
                      </div>
                      <div className="mt-1 font-semibold">
                        {invoice.invoiceNo || "-"}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        Date: {fmtDate(invoice.invoiceDate || order.createdAt)}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Payment: {invoice.paymentStatus || "UNPAID"}
                      </div>
                    </div>

                    <div className="rounded-md border bg-white p-4">
                      <div className="text-xs font-medium text-muted-foreground">
                        QR payload
                      </div>
                      <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md bg-slate-50 p-3 text-xs">
                        {qrPayload || "-"}
                      </pre>
                    </div>

                    <div className="rounded-md border bg-white p-4">
                      <div className="text-xs font-medium text-muted-foreground">
                        Dealer signature template
                      </div>
                      <div className="mt-2 rounded-md border border-dashed bg-slate-50 p-4 text-sm">
                        {dealerSignatureId ? (
                          <div>
                            Signature media linked:{" "}
                            <span className="font-medium">
                              {String(dealerSignatureId)}
                            </span>
                          </div>
                        ) : (
                          <div className="text-muted-foreground">
                            No dealer signature uploaded.
                          </div>
                        )}
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={handlePrint}
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      Print invoice
                    </Button>
                  </>
                ) : (
                  <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    Invoice has not been created yet. Use Ship to generate it.
                  </div>
                )}
              </CardContent>
            </Card>

            {canDeliver ? (
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle>Delivery verification</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    Upload the signed invoice scan/photo. The backend should
                    verify the QR and dealer signature before delivery is
                    approved.
                  </div>

                  <Input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                  />

                  {proofFile ? (
                    <div className="rounded-md border bg-slate-50 p-3 text-sm">
                      Selected file:{" "}
                      <span className="font-medium">{proofFile.name}</span>
                    </div>
                  ) : null}

                  <Button
                    type="button"
                    className="w-full"
                    onClick={() => void handleDeliver()}
                    disabled={
                      proofUploading || savingAction === "deliver" || !proofFile
                    }
                  >
                    {proofUploading || savingAction === "deliver" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    Verify and deliver
                  </Button>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>

        <div ref={printRef} className="hidden">
          <div className="wrap">
            <div className="card">
              <div className="row">
                <div>
                  <div>
                    <strong>Sales Order / Invoice</strong>
                  </div>
                  <div className="muted small">Order No: {order.orderNo}</div>
                  <div className="muted small">
                    Date: {fmtDate(order.orderDate || order.createdAt)}
                  </div>
                </div>
                <div className="right">
                  <div>
                    <strong>{dealer?.name || dealer?.proprietor || "-"}</strong>
                  </div>
                  <div className="muted small">
                    {dealer?.phoneNumber || dealer?.phone || "-"}
                  </div>
                  <div className="muted small">
                    Warehouse: {warehouse?.name || "-"}
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Product</th>
                    <th className="right">Qty</th>
                    <th className="right">Bonus</th>
                    <th className="right">Price</th>
                    <th className="right">Subtotal</th>
                    <th className="right">Tax</th>
                    <th className="right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item._id || index}>
                      <td>{index + 1}</td>
                      <td>
                        {item.productId?.name ||
                          item.productName ||
                          item.name ||
                          "-"}
                      </td>
                      <td className="right">{Number(item.qty || 0)}</td>
                      <td className="right">{Number(item.bonusQty || 0)}</td>
                      <td className="right">
                        {money(Number(item.unitPrice || 0))}
                      </td>
                      <td className="right">{money(lineSubtotal(item))}</td>
                      <td className="right">
                        {money(Number(item.taxAmount || 0))}
                      </td>
                      <td className="right">{money(lineTotal(item))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="row">
              <div className="card" style={{ width: "48%" }}>
                <div>
                  <strong>QR Code Area</strong>
                </div>
                <div className="muted small">QR payload</div>
                <div className="qr-box">
                  {qrPayload || "QR payload missing"}
                </div>
              </div>

              <div className="card" style={{ width: "48%" }}>
                <div>
                  <strong>Dealer Signature</strong>
                </div>
                <div className="muted small">
                  Sign in this box after receiving the goods
                </div>
                <div className="signature-box">Dealer signature</div>
                <div className="muted small" style={{ marginTop: "10px" }}>
                  Signature template:{" "}
                  {dealerSignatureId ? String(dealerSignatureId) : "Not linked"}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="row">
                <div>
                  <div className="muted small">Subtotal</div>
                  <div>
                    <strong>
                      {money(order.subTotal ?? totals.subtotal)} BDT
                    </strong>
                  </div>
                </div>
                <div>
                  <div className="muted small">Discount</div>
                  <div>
                    <strong>{money(order.totalDiscount)} BDT</strong>
                  </div>
                </div>
                <div>
                  <div className="muted small">Tax</div>
                  <div>
                    <strong>{money(order.totalTax)} BDT</strong>
                  </div>
                </div>
                <div>
                  <div className="muted small">Grand Total</div>
                  <div>
                    <strong>
                      {money(order.grandTotal ?? totals.total)} BDT
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
