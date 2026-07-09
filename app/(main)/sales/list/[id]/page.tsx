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
import QRCode from "qrcode";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import GlobalPrintButton from "@/components/common/print/GlobalPrintButton";
import {
  Loader2,
  Printer,
  RefreshCw,
  Truck,
  Ban,
  Upload,
  Pencil,
  FileText,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";

// --------------------------- Types ---------------------------
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
  dcMediaId?: string;
  dcUploadedBy?: any;
  dcUploadedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

type QrData = {
  invoiceId: string;
  orderId: string;
  invoiceNo: string;
  grandTotal: number;
  dealer: {
    code: string;
    name: string;
    phone: string;
    creditLimit: number;
    currentDue: number;
    available: number;
  };
  products: Array<{
    name: string;
    qty: number;
    unitPrice: number;
  }>;
};

const MEDIA_UPLOAD_ENDPOINT =
  "/media/upload?module=sales-order&folder=signed-documents";

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
  return Number(item?.lineSubtotal ?? Number(item?.qty || 0) * Number(item?.unitPrice || 0));
}

function lineTotal(item: any) {
  return Number(item?.lineTotal ?? lineSubtotal(item));
}

// --------------------------- PRINT HELPERS ---------------------------
function buildSalesOrderPrintHtml(order: SalesOrderDetail, qrImageDataUrl: string): string {
  const dealer = order.customerId || {};
  const warehouse = order.warehouseId || {};
  const items = order.items || [];
  const dateFmt = (d: any) => (d ? new Date(d).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" }) : "—");

  const invoiceNo = order.invoiceId?.invoiceNo || order.orderNo.replace(/^SO/, "INV");
  const paymentStatus = order.invoiceId?.paymentStatus || "UNPAID";

  const rowsHtml = items
    .map((item, idx) => {
      return `
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:8px 10px; font-weight:600;">${item.productId?.name || item.productName || item.name || "-"}</td>
        <td style="padding:8px 10px; text-align:center;">${Number(item.qty || 0)}</td>
        <td style="padding:8px 10px; text-align:center;">${Number(item.bonusQty || 0) > 0 ? Number(item.bonusQty || 0) : "-"}</td>
        <td style="padding:8px 10px; text-align:right; font-family:monospace;">${Number(item.unitPrice || 0).toFixed(2)}</td>
        <td style="padding:8px 10px; text-align:right; font-family:monospace;">${lineSubtotal(item).toFixed(2)}</td>
        <td style="padding:8px 10px; text-align:right; font-family:monospace;">${Number(item.taxAmount || 0).toFixed(2)}</td>
        <td style="padding:8px 10px; text-align:right; font-weight:700; font-family:monospace;">${lineTotal(item).toFixed(2)}</td>
      </tr>`;
    })
    .join("");

  return `
<div style="font-family: 'Inter', sans-serif; max-width: 100%; margin: 0 auto; color: #1e293b; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.04);">
  <div style="background: linear-gradient(135deg, #0f172a, #1e293b); padding: 18px 28px; display: flex; justify-content: space-between; align-items: center; color: white;">
    <div>
      <div style="font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">SALES INVOICE</div>
      <div style="font-size: 13px; opacity: 0.9; margin-top: 2px;">
        ${order.paymentMethod === "CREDIT" ? "Credit Sale" : "Cash Sale"} · ${paymentStatus}
      </div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 22px; font-weight: 800;">#${invoiceNo}</div>
      <div style="font-size: 12px; opacity: 0.8;">${dateFmt(order.orderDate || order.createdAt)}</div>
      <div style="font-size: 11px; opacity: 0.7; margin-top: 2px;">Order: ${order.orderNo}</div>
    </div>
  </div>

  <div style="padding: 14px 28px; display: flex; gap: 16px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
    <div style="flex: 1; background: white; border-radius: 10px; padding: 10px 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
      <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700;">Dealer</div>
      <div style="font-weight: 700; margin-top: 2px;">${dealer.name || dealer.proprietor || "-"}</div>
      <div style="font-size: 12px; color: #475569;">${dealer.phoneNumber || dealer.phone || "-"}</div>
    </div>
    <div style="flex: 1; background: white; border-radius: 10px; padding: 10px 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
      <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700;">Warehouse</div>
      <div style="font-weight: 700; margin-top: 2px;">${warehouse.name || "-"}</div>
      <div style="font-size: 12px; color: #475569;">Dispatch location</div>
    </div>
    <div style="flex: 1; background: white; border-radius: 10px; padding: 10px 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
      <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700;">Payment</div>
      <div style="font-weight: 700; margin-top: 2px; color: ${order.paymentMethod === "CREDIT" ? "#f59e0b" : "#16a34a"};">${order.paymentMethod}</div>
      <div style="font-size: 12px; color: #475569;">Grand Total: ৳ ${(order.grandTotal ?? 0).toFixed(2)}</div>
    </div>
  </div>

  <div style="padding: 16px 28px;">
    <h3 style="font-size: 16px; font-weight: 700; margin: 0 0 10px;">Items (${items.length})</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
      <thead>
        <tr style="background: #f1f5f9; font-weight: 700; color: #334155; text-transform: uppercase; font-size: 11px;">
          <th style="padding: 10px 12px; text-align: left;">Product</th>
          <th style="padding: 10px 12px; text-align: center;">Qty</th>
          <th style="padding: 10px 12px; text-align: center;">Bonus</th>
          <th style="padding: 10px 12px; text-align: right;">Unit Price</th>
          <th style="padding: 10px 12px; text-align: right;">Subtotal</th>
          <th style="padding: 10px 12px; text-align: right;">Tax</th>
          <th style="padding: 10px 12px; text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </div>

  <div style="display: flex; justify-content: flex-end; padding: 14px 28px; background: #f8fafc; border-top: 2px solid #e2e8f0;">
    <div style="width: 320px;">
      <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; border-bottom:1px solid #e2e8f0;">
        <span style="color:#475569;">Subtotal</span>
        <span style="font-weight:600;">৳ ${(order.subTotal ?? 0).toFixed(2)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; border-bottom:1px solid #e2e8f0;">
        <span style="color:#475569;">Discount</span>
        <span style="font-weight:600; color:#dc2626;">- ৳ ${(order.totalDiscount ?? 0).toFixed(2)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; border-bottom:1px solid #e2e8f0;">
        <span style="color:#475569;">Tax</span>
        <span style="font-weight:600;">৳ ${(order.totalTax ?? 0).toFixed(2)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 8px 0; font-size: 16px; font-weight: 800;">
        <span>Grand Total</span>
        <span style="color:#0f172a;">৳ ${(order.grandTotal ?? 0).toFixed(2)}</span>
      </div>
      <div style="margin-top: 8px; padding: 6px 10px; background: ${order.paymentMethod === "CREDIT" ? "#fef3c7" : "#d1fae5"}; border-radius: 8px; font-size: 11px; text-align: center; color: ${order.paymentMethod === "CREDIT" ? "#92400e" : "#065f46"};">
        ${order.paymentMethod === "CREDIT" ? "This is a credit sale." : "This is a cash sale."} · Total bonus items: ${order.totalBonusQty || 0}
      </div>
    </div>
  </div>

  <div style="display: flex; gap: 16px; padding: 14px 28px; background: #f8fafc; border-top: 1px solid #e2e8f0;">
    <div style="flex: 1; background: white; border-radius: 10px; padding: 14px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
      <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 8px;">QR Code</div>
      ${qrImageDataUrl ? `<img src="${qrImageDataUrl}" alt="QR" style="width:140px; height:140px; border:1px solid #e2e8f0; border-radius:10px;" />` : `<div style="width:140px; height:140px; border:2px dashed #cbd5e1; border-radius:10px; display:inline-flex; align-items:center; justify-content:center; color:#94a3b8; font-size:11px;">QR not ready</div>`}
      <div style="font-size: 10px; color: #94a3b8; margin-top: 6px;">Scan to verify</div>
    </div>
    <div style="flex: 2; background: white; border-radius: 10px; padding: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
      <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 8px;">Dealer Signature</div>
      <div style="height: 110px; border: 2px dashed #cbd5e1; border-radius: 10px; display: flex; align-items: flex-end; justify-content: center; padding: 10px; color: #94a3b8; font-size: 12px;">
        Sign here after receiving goods
      </div>
      <div style="font-size: 10px; color: #94a3b8; margin-top: 6px;">I confirm receipt of the above items in good condition.</div>
    </div>
  </div>

  <div style="background: #0f172a; color: #94a3b8; text-align: center; padding: 8px 28px; font-size: 10px; display: flex; justify-content: space-between;">
    <div>Computer‑generated invoice</div>
    <div>© Antab Agro LTD</div>
  </div>
</div>`;
}

function buildSalesOrderPrintHeaderRight(order: SalesOrderDetail): string {
  const paymentStatus = order.invoiceId?.paymentStatus || "UNPAID";
  return `
    <div style="text-align:right;">
      <div style="font-size: 20px; font-weight: 800; color: #0f172a;">#${order.orderNo}</div>
      <div style="font-size: 13px; color: #475569; margin-top: 2px;">
        ${order.paymentMethod === "CREDIT" ? "Credit Sale" : "Cash Sale"} · ${paymentStatus}
      </div>
      <div style="
        display: inline-block; background: ${order.status === "DELIVERED" ? "#065f46" : order.status === "CANCELLED" ? "#b91c1c" : "#1e40af"};
        color: white; padding: 4px 16px; border-radius: 100px; font-size: 13px; margin-top: 8px; font-weight: 700;
      ">${order.status.replaceAll("_", " ")}</div>
    </div>`;
}

function buildDCPrintHtml(order: SalesOrderDetail): string {
  const dealer = order.customerId || {};
  const warehouse = order.warehouseId || {};
  const items = order.items || [];
  const dateFmt = (d: any) => (d ? new Date(d).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" }) : "—");

  const rowsHtml = items
    .map((item, idx) => {
      return `
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:8px 10px;">${idx + 1}</td>
        <td style="padding:8px 10px; font-weight:600;">${item.productId?.name || item.productName || item.name || "-"}</td>
        <td style="padding:8px 10px; text-align:center;">${Number(item.qty || 0)}</td>
        <td style="padding:8px 10px; text-align:center;">${Number(item.bonusQty || 0) > 0 ? Number(item.bonusQty || 0) : "-"}</td>
        <td style="padding:8px 10px; text-align:center;">
          <div style="width:40px; height:24px; border:2px dashed #cbd5e1; border-radius:6px; display:inline-flex; align-items:center; justify-content:center; font-size:11px; color:#94a3b8;">/</div>
        </td>
        <td style="padding:8px 10px; text-align:center;">
          <div style="width:40px; height:24px; border:2px dashed #cbd5e1; border-radius:6px; display:inline-flex; align-items:center; justify-content:center; font-size:11px; color:#94a3b8;">/</div>
        </td>
      </tr>`;
    })
    .join("");

  return `
<div style="font-family: 'Inter', sans-serif; max-width: 100%; margin: 0 auto; color: #1e293b; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.04);">
  <div style="background: #1e293b; padding: 16px 28px; display: flex; justify-content: space-between; align-items: center; color: white;">
    <div>
      <div style="font-size: 22px; font-weight: 800;">DELIVERY CHALAN</div>
      <div style="font-size: 13px; opacity: 0.9;">Original / Duplicate</div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 18px; font-weight: 800;">DC #${order.orderNo}</div>
      <div style="font-size: 12px; opacity: 0.8;">Date: ${dateFmt(order.orderDate || order.createdAt)}</div>
    </div>
  </div>

  <div style="padding: 14px 28px; display: flex; gap: 16px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
    <div style="flex: 1; background: white; border-radius: 10px; padding: 10px 14px;">
      <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700;">Dealer</div>
      <div style="font-weight: 700;">${dealer.name || dealer.proprietor || "-"}</div>
      <div style="font-size: 12px; color: #475569;">${dealer.phoneNumber || dealer.phone || "-"}</div>
    </div>
    <div style="flex: 1; background: white; border-radius: 10px; padding: 10px 14px;">
      <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700;">Warehouse</div>
      <div style="font-weight: 700;">${warehouse.name || "-"}</div>
      <div style="font-size: 12px; color: #475569;">Dispatch Location</div>
    </div>
    <div style="flex: 1; background: white; border-radius: 10px; padding: 10px 14px;">
      <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700;">Vehicle / Driver</div>
      <div style="font-weight: 700; color: #94a3b8;">.............................</div>
      <div style="font-size: 12px; color: #475569;">Phone: .............................</div>
    </div>
  </div>

  <div style="padding: 16px 28px;">
    <h3 style="font-size: 16px; font-weight: 700; margin: 0 0 10px;">Items (${items.length})</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
      <thead>
        <tr style="background: #f1f5f9; font-weight: 700; color: #334155; text-transform: uppercase; font-size: 11px;">
          <th style="padding: 10px 8px; text-align: left;">#</th>
          <th style="padding: 10px 8px; text-align: left;">Product</th>
          <th style="padding: 10px 8px; text-align: center;">Qty</th>
          <th style="padding: 10px 8px; text-align: center;">Bonus</th>
          <th style="padding: 10px 8px; text-align: center;">Recv'd</th>
          <th style="padding: 10px 8px; text-align: center;">Remarks</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <div style="margin-top: 16px; font-size: 12px; color: #475569; border-top: 2px solid #e2e8f0; padding-top: 10px;">
      <strong>Total Qty:</strong> ${items.reduce((s, i) => s + Number(i.qty || 0), 0)} &nbsp;&nbsp;|&nbsp;&nbsp;
      <strong>Total Bonus:</strong> ${order.totalBonusQty || 0}
    </div>
  </div>

  <div style="display: flex; gap: 16px; padding: 14px 28px; background: #f8fafc; border-top: 1px solid #e2e8f0;">
    <div style="flex: 1; background: white; border-radius: 10px; padding: 12px; text-align: center;">
      <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 8px;">Prepared By</div>
      <div style="border-top: 2px solid #cbd5e1; margin-top: 28px; padding-top: 8px; font-size: 11px; color: #94a3b8;">(Signature / Name)</div>
    </div>
    <div style="flex: 1; background: white; border-radius: 10px; padding: 12px; text-align: center;">
      <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 8px;">Security Check</div>
      <div style="border-top: 2px solid #cbd5e1; margin-top: 28px; padding-top: 8px; font-size: 11px; color: #94a3b8;">(Signature / Name)</div>
    </div>
    <div style="flex: 1; background: white; border-radius: 10px; padding: 12px; text-align: center;">
      <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 8px;">Received By</div>
      <div style="border-top: 2px solid #cbd5e1; margin-top: 28px; padding-top: 8px; font-size: 11px; color: #94a3b8;">(Signature / Name)</div>
    </div>
  </div>

  <div style="background: #0f172a; color: #94a3b8; text-align: center; padding: 8px 28px; font-size: 10px;">
    Computer‑generated document · © Antab Agro LTD
  </div>
</div>`;
}

// ================================================
// Main View Page Component
// ================================================
export default function SalesOrderViewPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const orderId = params?.id;

  const [loading, setLoading] = useState(true);
  const [savingAction, setSavingAction] = useState<string | null>(null);
  const [order, setOrder] = useState<SalesOrderDetail | null>(null);

  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofUploading, setProofUploading] = useState(false);

  // DC upload state
  const [dcFile, setDcFile] = useState<File | null>(null);
  const [dcUploadLoading, setDcUploadLoading] = useState(false);
  const [dcMediaId, setDcMediaId] = useState<string | null>(null);

  // QR image state
  const [qrImage, setQrImage] = useState<string>("");
  const [qrParsed, setQrParsed] = useState<QrData | null>(null);
  const [qrImageForPrint, setQrImageForPrint] = useState<string>("");

  const loadOrder = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const res = await api.get(`/sales-orders/${orderId}`);
      const data = res.data?.data || res.data;
      setOrder(data);
      // pre-populate DC media id if present
      if (data.dcMediaId) {
        setDcMediaId(String(data.dcMediaId));
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to load sales order.");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  // QR generation effect
  useEffect(() => {
    if (!order?.invoiceId) {
      setQrImage("");
      setQrImageForPrint("");
      setQrParsed(null);
      return;
    }
    const qrPayload = typeof order.invoiceId?.qrCode === "string" ? order.invoiceId.qrCode : "";
    if (!qrPayload) {
      setQrImage("");
      setQrImageForPrint("");
      setQrParsed(null);
      return;
    }

    try {
      const parsed = JSON.parse(qrPayload) as QrData;
      setQrParsed(parsed);
    } catch {
      setQrParsed(null);
    }

    let mounted = true;
    QRCode.toDataURL(qrPayload, { width: 220, margin: 2, errorCorrectionLevel: "M" })
      .then((dataUrl) => {
        if (mounted) {
          setQrImage(dataUrl);
          setQrImageForPrint(dataUrl);
        }
      })
      .catch(() => {
        if (mounted) {
          setQrImage("");
          setQrImageForPrint("");
        }
      });

    return () => {
      mounted = false;
    };
  }, [order?.invoiceId]);

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
    ["PENDING_AM", "PENDING_RM", "PENDING_NSM", "PENDING_FULFILLMENT"].includes(order.status);

  const canShip = order?.status === "PENDING_FULFILLMENT";
  const canDeliver = order?.status === "IN_SHIPPING";
  const canCancel = order
    ? !["DELIVERED", "CANCELLED"].includes(order.status)
    : false;

  const uploadProofFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await api.post(MEDIA_UPLOAD_ENDPOINT, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    const data = res.data?.data || res.data;
    const mediaId = data?._id || data?.id;
    if (!mediaId) throw new Error("Uploaded file id not returned by upload API.");
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
      toast.error(err?.response?.data?.message || "Failed to ship order.");
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
      toast.error(err?.response?.data?.message || "Failed to cancel order.");
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
      await api.post(`/sales-orders/${orderId}/deliver`, { uploadedDocumentFileId });
      toast.success("Delivery approved.");
      setProofFile(null);
      await loadOrder();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to deliver order.");
    } finally {
      setProofUploading(false);
      setSavingAction(null);
    }
  };

  const handleDCUpload = async () => {
    if (!dcFile) {
      toast.error("Select a DC file first");
      return;
    }
    setDcUploadLoading(true);
    try {
      const mediaId = await uploadProofFile(dcFile);
      await api.post(`/sales-orders/${orderId}/upload-dc`, { dcMediaId: mediaId });
      setDcMediaId(mediaId);
      toast.success("Delivery Chalan uploaded.");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "DC upload failed");
    } finally {
      setDcUploadLoading(false);
    }
  };

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
            <Button className="mt-4" onClick={() => router.push("/sales-orders")}>
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
        {/* Header */}
        <div className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Sales Order Details</div>
              <h1 className="text-2xl font-semibold">{order.orderNo}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={order.status} />
                <PaymentBadge method={order.paymentMethod} />
                <span className="text-sm text-muted-foreground">
                  Created: {fmtDate(order.createdAt || order.orderDate)}
                </span>
                {invoice && (
                  <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                    Invoice: {invoice.invoiceNo}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => void loadOrder()}>
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh
              </Button>

              {canEdit && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/sales/list/${order._id}/edit`)}
                >
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </Button>
              )}

              {invoice && (
                <GlobalPrintButton
                  contentHtml={buildSalesOrderPrintHtml(order, qrImageForPrint)}
                  headerRightHtml={buildSalesOrderPrintHeaderRight(order)}
                  label="Print Invoice"
                  title="Sales Invoice"
                  orientation="portrait"
                  company={{
                    name: "Antab Agro LTD",
                    address: "123 Agro Street, Dhaka",
                    phone: "+880 1711-111111",
                    email: "info@antabagro.com",
                  }}
                  showHeader={false}
                  showFooter={false}
                />
              )}

              {canShip && (
                <Button type="button" onClick={() => void handleShip()}>
                  {savingAction === "ship" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Truck className="mr-2 h-4 w-4" />
                  )}
                  Ship
                </Button>
              )}

              {canCancel && (
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
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          {/* Left column */}
          <div className="space-y-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Order information</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-md border bg-slate-50 p-4">
                  <div className="text-xs text-muted-foreground">Dealer</div>
                  <div className="mt-1 font-semibold">{dealer?.name || dealer?.proprietor || "-"}</div>
                  <div className="text-sm text-muted-foreground">{dealer?.phoneNumber || dealer?.phone || "-"}</div>
                </div>
                <div className="rounded-md border bg-slate-50 p-4">
                  <div className="text-xs text-muted-foreground">Warehouse</div>
                  <div className="mt-1 font-semibold">{warehouse?.name || "-"}</div>
                  <div className="text-sm text-muted-foreground">{warehouse?.code || ""}</div>
                </div>
                <div className="rounded-md border bg-slate-50 p-4">
                  <div className="text-xs text-muted-foreground">Order date</div>
                  <div className="mt-1 font-semibold">{fmtDate(order.orderDate || order.createdAt)}</div>
                </div>
                <div className="rounded-md border bg-slate-50 p-4">
                  <div className="text-xs text-muted-foreground">Payment method</div>
                  <div className="mt-1 font-semibold">{order.paymentMethod || "-"}</div>
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
                      <th className="border-b px-4 py-3 text-right">Unit price</th>
                      <th className="border-b px-4 py-3 text-right">Subtotal</th>
                      <th className="border-b px-4 py-3 text-right">Tax</th>
                      <th className="border-b px-4 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={item._id || index} className="border-b last:border-0 hover:bg-slate-50">
                        <td className="px-4 py-3">{index + 1}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium">
                            {item.productId?.name || item.productName || item.name || item.productId?._id || "-"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.productId?.sku || item.productId?.code || ""}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">{Number(item.qty || 0)}</td>
                        <td className="px-4 py-3 text-right">{Number(item.bonusQty || 0)}</td>
                        <td className="px-4 py-3 text-right">{money(Number(item.unitPrice || 0))}</td>
                        <td className="px-4 py-3 text-right">{money(lineSubtotal(item))}</td>
                        <td className="px-4 py-3 text-right">{money(Number(item.taxAmount || 0))}</td>
                        <td className="px-4 py-3 text-right font-medium">{money(lineTotal(item))}</td>
                      </tr>
                    ))}
                    {!items.length && (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                          No items found.
                        </td>
                      </tr>
                    )}
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
                    const matched = order.approvalLogs?.find((l) => l.role === step);
                    const active = step === order.status;
                    const done =
                      matched?.status === "APPROVED" ||
                      ["DELIVERED"].includes(order.status) ||
                      approvalFlow.indexOf(step) < approvalFlow.indexOf(order.status);

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
                          <div className="font-medium">{step.replaceAll("_", " ")}</div>
                          <StatusBadge status={step} />
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          {matched?.actionDate ? fmtDate(matched.actionDate) : "No action yet"}
                        </div>
                        {matched?.remarks && (
                          <div className="mt-2 text-xs text-muted-foreground">{matched.remarks}</div>
                        )}
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

          {/* Right column */}
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
                  <span className="text-sm text-muted-foreground">Bonus qty</span>
                  <span className="font-medium">{totals.bonusQty}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Sub total</span>
                  <span className="font-medium">{money(order.subTotal ?? totals.subtotal)} BDT</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Discount</span>
                  <span className="font-medium">{money(order.totalDiscount)} BDT</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Tax</span>
                  <span className="font-medium">{money(order.totalTax)} BDT</span>
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
                  <span className="font-medium">{money(order.creditSnapshot?.creditLimit)} BDT</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Used</span>
                  <span className="font-medium">{money(order.creditSnapshot?.used)} BDT</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Available</span>
                  <span className="font-medium">{money(order.creditSnapshot?.available)} BDT</span>
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
                      <div className="text-xs text-muted-foreground">Invoice No</div>
                      <div className="mt-1 font-semibold">{invoice.invoiceNo || "-"}</div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        Date: {fmtDate(invoice.invoiceDate || order.createdAt)}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Payment: {invoice.paymentStatus || "UNPAID"}
                      </div>
                    </div>

                    <div className="rounded-md border bg-white p-4">
                      <div className="text-xs font-medium text-muted-foreground">QR image</div>
                      <div className="mt-3 flex items-center justify-center rounded-md border bg-slate-50 p-3">
                        {qrImage ? (
                          <img src={qrImage} alt="Invoice QR" className="h-44 w-44" />
                        ) : (
                          <div className="text-sm text-muted-foreground">QR not ready yet</div>
                        )}
                      </div>
                      {qrParsed && (
                        <div className="mt-3 space-y-2 rounded-md bg-blue-50 p-3 text-xs">
                          <div className="font-medium text-blue-800">Decoded QR data</div>
                          <div>
                            <span className="text-muted-foreground">Dealer: </span>
                            <span className="font-medium">
                              {qrParsed?.dealer?.name} ({qrParsed?.dealer?.code})
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Phone: </span>
                            {qrParsed?.dealer?.phone}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Credit: </span>
                            {money(qrParsed?.dealer?.creditLimit)} limit / {money(qrParsed?.dealer?.available)} avail
                          </div>
                          <div className="mt-1 font-medium">Products:</div>
                          {qrParsed?.products?.map((p, i) => (
                            <div key={i} className="ml-2 text-slate-600">
                              {p.name} – {p.qty} × {money(p.unitPrice)} BDT
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-md border bg-white p-4">
                      <div className="text-xs font-medium text-muted-foreground">
                        Dealer signature template
                      </div>
                      <div className="mt-2 rounded-md border border-dashed bg-slate-50 p-4 text-sm">
                        {dealerSignatureId ? (
                          <div>
                            Signature media linked:{" "}
                            <span className="font-medium">{String(dealerSignatureId)}</span>
                          </div>
                        ) : (
                          <div className="text-muted-foreground">No dealer signature uploaded.</div>
                        )}
                      </div>
                    </div>

                    <GlobalPrintButton
                      contentHtml={buildSalesOrderPrintHtml(order, qrImageForPrint)}
                      headerRightHtml={buildSalesOrderPrintHeaderRight(order)}
                      label="Print Invoice"
                      title="Sales Invoice"
                      orientation="portrait"
                      company={{
                        name: "Antab Agro LTD",
                        address: "123 Agro Street, Dhaka",
                        phone: "+880 1711-111111",
                        email: "info@antabagro.com",
                      }}
                      showHeader={false}
                      showFooter={false}
                    />
                  </>
                ) : (
                  <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    Invoice has not been created yet. Use Ship to generate it.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 🆕 Delivery Chalan Card */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Delivery Chalan (DC)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <GlobalPrintButton
                  contentHtml={buildDCPrintHtml(order)}
                  headerRightHtml={`<div style="text-align:right;"><div style="font-size: 20px; font-weight: 800; color: #0f172a;">DC #${order.orderNo}</div></div>`}
                  label="Print D.C."
                  title="Delivery Chalan"
                  orientation="portrait"
                  company={{
                    name: "Antab Agro LTD",
                    address: "123 Agro Street, Dhaka",
                    phone: "+880 1711-111111",
                    email: "info@antabagro.com",
                  }}
                  showHeader={false}
                  showFooter={false}
                />

                <div className="text-sm text-muted-foreground">
                  Upload the signed Delivery Chalan (optional).
                </div>

                <Input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setDcFile(e.target.files?.[0] || null)}
                />

                {dcFile && (
                  <div className="rounded-md border bg-slate-50 p-3 text-sm">
                    Selected file: <span className="font-medium">{dcFile.name}</span>
                  </div>
                )}

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleDCUpload}
                  disabled={dcUploadLoading || !dcFile}
                >
                  {dcUploadLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Upload DC
                </Button>

                {dcMediaId && (
                  <div className="rounded-md bg-emerald-50 p-3 text-sm">
                    <div className="flex items-center gap-1 font-medium text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" /> DC uploaded
                    </div>
                    <div className="mt-1 text-xs text-emerald-600">
                      Media ID: {dcMediaId}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {canDeliver && (
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle>Delivery verification</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    Upload the signed invoice scan/photo. The backend should verify the QR and dealer signature before delivery is approved.
                  </div>

                  <Input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                  />

                  {proofFile && (
                    <div className="rounded-md border bg-slate-50 p-3 text-sm">
                      Selected file: <span className="font-medium">{proofFile.name}</span>
                    </div>
                  )}

                  <Button
                    type="button"
                    className="w-full"
                    onClick={() => void handleDeliver()}
                    disabled={proofUploading || savingAction === "deliver" || !proofFile}
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}