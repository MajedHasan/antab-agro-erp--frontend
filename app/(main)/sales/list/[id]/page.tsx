"use client";

import React, {
  useCallback, useEffect, useMemo, useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";
import QRCode from "qrcode";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import GlobalPrintButton from "@/components/common/print/GlobalPrintButton";
import {
  Loader2, RefreshCw, Truck, Ban, Upload, Pencil, FileText, CheckCircle2,
  Building2, Warehouse, Calendar, Package, Wallet, TrendingUp, Receipt,
  Check, Inbox,
} from "lucide-react";

import Protected from "@/components/auth/Protected";
import usePermissionCheck from "@/hooks/usePermissionCheck";

// 🆕 new imports
import QtyChangeHistoryCard from "../_components/QtyChangeHistoryCard";
import OrderAttachmentsPanel from "../_components/OrderAttachmentsPanel";
import type {
  QtyChangeLog,
  OrderAttachment,
} from "../_components/order-detail-types";

/* =========================== Types =========================== */
type OrderStatus =
  | "PENDING_AM" | "PENDING_RM" | "PENDING_NSM" | "PENDING_FULFILLMENT"
  | "IN_SHIPPING" | "DELIVERED" | "REJECTED" | "CANCELLED";

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
  creditSnapshot?: { creditLimit?: number; used?: number; available?: number };
  status: OrderStatus;
  isInvoiced?: boolean;
  notes?: string;
  approvalLogs?: Array<{
    role?: string; status?: string; remarks?: string;
    actionDate?: string; userId?: any;
  }>;
  dcMediaId?: string;
  dcUploadedBy?: any;
  dcUploadedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  // 🆕 new fields (safe for old orders — render empty when missing)
  qtyChangeLogs?: QtyChangeLog[] | null;
  attachments?: OrderAttachment[] | null;
};

type QrData = {
  invoiceId: string; orderId: string; invoiceNo: string; grandTotal: number;
  dealer: { code: string; name: string; phone: string; creditLimit: number; currentDue: number; available: number; };
  products: Array<{ name: string; qty: number; unitPrice: number }>;
};

/* =========================== Config =========================== */
const MEDIA_UPLOAD_ENDPOINT =
  "/media/upload?module=sales-order&folder=signed-documents";

const printCompany = {
  name: "Antab Agro LTD",
  address: "123 Agro Street, Dhaka",
  phone: "+880 1711-111111",
  email: "info@antabagro.com",
};

/* =========================== Helpers =========================== */
function money(n: number | undefined) {
  return Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}
function fmtDate(value?: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(d);
}
function lineSubtotal(item: any) {
  return Number(item?.lineSubtotal ?? Number(item?.qty || 0) * Number(item?.unitPrice || 0));
}
function lineTotal(item: any) { return Number(item?.lineTotal ?? lineSubtotal(item)); }

/* =========================== Badges =========================== */
function StatusBadge({ status }: { status: OrderStatus }) {
  const styles: Record<OrderStatus, string> = {
    PENDING_AM: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    PENDING_RM: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    PENDING_NSM: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    PENDING_FULFILLMENT: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60",
    IN_SHIPPING: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60",
    DELIVERED: "bg-[#3aa838]/10 text-[#2f8a2f] border-[#3aa838]/30 dark:bg-[#3aa838]/15 dark:text-[#9bdd91] dark:border-[#3aa838]/40",
    REJECTED: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60",
    CANCELLED: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60",
  };
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${styles[status]}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}
function PaymentBadge({ method }: { method?: "CASH" | "CREDIT" }) {
  if (!method) return <span className="text-xs text-slate-400">-</span>;
  const styles = method === "CREDIT"
    ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60"
    : "bg-[#3aa838]/10 text-[#2f8a2f] border-[#3aa838]/30 dark:bg-[#3aa838]/15 dark:text-[#9bdd91] dark:border-[#3aa838]/40";
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${styles}`}>
      {method}
    </span>
  );
}

function SectionHeader({
  icon: Icon, title, subtitle, right,
}: {
  icon: React.ElementType; title: string; subtitle?: string; right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3aa838]/10 text-[#3aa838] dark:bg-[#3aa838]/15 dark:text-[#9bdd91]">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-bold text-slate-900 dark:text-white">{title}</div>
          {subtitle && (
            <div className="text-[11px] text-slate-500 dark:text-slate-400">{subtitle}</div>
          )}
        </div>
      </div>
      {right}
    </div>
  );
}

function UploadTile({
  label, hint, onFile, disabled = false,
}: {
  label: string; hint: string; onFile: (f: File | null) => void; disabled?: boolean;
}) {
  return (
    <label
      className={`block cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
        disabled
          ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60 dark:border-slate-800 dark:bg-slate-950/40"
          : "border-slate-300 bg-slate-50 hover:border-[#3aa838] hover:bg-[#3aa838]/5 dark:border-slate-700 dark:bg-slate-950/40 dark:hover:border-[#3aa838]/60"
      }`}
    >
      <Upload className="mx-auto h-6 w-6 text-slate-400" />
      <div className="mt-2 text-xs font-medium text-slate-700 dark:text-slate-300">{label}</div>
      <div className="text-[10px] text-slate-500 dark:text-slate-400">{hint}</div>
      <input
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        disabled={disabled}
        onChange={(e) => onFile(e.target.files?.[0] || null)}
      />
    </label>
  );
}

/* =========================== Print helpers =========================== */
function buildSalesOrderPrintHtml(order: SalesOrderDetail, qrImageDataUrl: string): string {
  const dealer = order.customerId || {};
  const warehouse = order.warehouseId || {};
  const items = order.items || [];
  const dateFmt = (d: any) =>
    d ? new Date(d).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" }) : "—";
  const invoiceNo = order.invoiceId?.invoiceNo || order.orderNo.replace(/^SO/, "INV");
  const paymentStatus = order.invoiceId?.paymentStatus || "UNPAID";

  const rowsHtml = items
    .map((item) => `
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:8px 10px; font-weight:600;">${item.productId?.name || item.productName || item.name || "-"}</td>
        <td style="padding:8px 10px; text-align:center;">${Number(item.qty || 0)}</td>
        <td style="padding:8px 10px; text-align:center;">${Number(item.bonusQty || 0) > 0 ? Number(item.bonusQty || 0) : "-"}</td>
        <td style="padding:8px 10px; text-align:right; font-family:monospace;">${Number(item.unitPrice || 0).toFixed(2)}</td>
        <td style="padding:8px 10px; text-align:right; font-family:monospace;">${lineSubtotal(item).toFixed(2)}</td>
        <td style="padding:8px 10px; text-align:right; font-family:monospace;">${Number(item.taxAmount || 0).toFixed(2)}</td>
        <td style="padding:8px 10px; text-align:right; font-weight:700; font-family:monospace;">${lineTotal(item).toFixed(2)}</td>
      </tr>`)
    .join("");

  return `
<div style="font-family: 'Inter', sans-serif; max-width: 100%; margin: 0 auto; color: #1e293b; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.04);">
  <div style="background: linear-gradient(135deg, #0f172a, #1e293b); padding: 18px 28px; display: flex; justify-content: space-between; align-items: center; color: white;">
    <div>
      <div style="font-size: 24px; font-weight: 800;">SALES INVOICE</div>
      <div style="font-size: 13px; opacity: 0.9; margin-top: 2px;">${order.paymentMethod === "CREDIT" ? "Credit Sale" : "Cash Sale"} · ${paymentStatus}</div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 22px; font-weight: 800;">#${invoiceNo}</div>
      <div style="font-size: 12px; opacity: 0.8;">${dateFmt(order.orderDate || order.createdAt)}</div>
      <div style="font-size: 11px; opacity: 0.7; margin-top: 2px;">Order: ${order.orderNo}</div>
    </div>
  </div>
  <div style="padding: 14px 28px; display: flex; gap: 16px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
    <div style="flex: 1; background: white; border-radius: 10px; padding: 10px 14px;">
      <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700;">Dealer</div>
      <div style="font-weight: 700; margin-top: 2px;">${dealer.name || dealer.proprietor || "-"}</div>
      <div style="font-size: 12px; color: #475569;">${dealer.phoneNumber || dealer.phone || "-"}</div>
    </div>
    <div style="flex: 1; background: white; border-radius: 10px; padding: 10px 14px;">
      <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700;">Warehouse</div>
      <div style="font-weight: 700; margin-top: 2px;">${warehouse.name || "-"}</div>
      <div style="font-size: 12px; color: #475569;">Dispatch location</div>
    </div>
    <div style="flex: 1; background: white; border-radius: 10px; padding: 10px 14px;">
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
        <span style="color:#475569;">Subtotal</span><span style="font-weight:600;">৳ ${(order.subTotal ?? 0).toFixed(2)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; border-bottom:1px solid #e2e8f0;">
        <span style="color:#475569;">Discount</span><span style="font-weight:600; color:#dc2626;">- ৳ ${(order.totalDiscount ?? 0).toFixed(2)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; border-bottom:1px solid #e2e8f0;">
        <span style="color:#475569;">Tax</span><span style="font-weight:600;">৳ ${(order.totalTax ?? 0).toFixed(2)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 8px 0; font-size: 16px; font-weight: 800;">
        <span>Grand Total</span><span style="color:#0f172a;">৳ ${(order.grandTotal ?? 0).toFixed(2)}</span>
      </div>
    </div>
  </div>
  <div style="display: flex; gap: 16px; padding: 14px 28px; background: #f8fafc; border-top: 1px solid #e2e8f0;">
    <div style="flex: 1; background: white; border-radius: 10px; padding: 14px; text-align: center;">
      <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 8px;">QR Code</div>
      ${qrImageDataUrl ? `<img src="${qrImageDataUrl}" alt="QR" style="width:140px; height:140px; border:1px solid #e2e8f0; border-radius:10px;" />` : `<div style="width:140px; height:140px; border:2px dashed #cbd5e1; border-radius:10px; display:inline-flex; align-items:center; justify-content:center; color:#94a3b8; font-size:11px;">QR not ready</div>`}
      <div style="font-size: 10px; color: #94a3b8; margin-top: 6px;">Scan to verify</div>
    </div>
    <div style="flex: 2; background: white; border-radius: 10px; padding: 14px;">
      <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 8px;">Dealer Signature</div>
      <div style="height: 110px; border: 2px dashed #cbd5e1; border-radius: 10px; display: flex; align-items: flex-end; justify-content: center; padding: 10px; color: #94a3b8; font-size: 12px;">
        Sign here after receiving goods
      </div>
    </div>
  </div>
  <div style="background: #0f172a; color: #94a3b8; text-align: center; padding: 8px 28px; font-size: 10px; display: flex; justify-content: space-between;">
    <div>Computer‑generated invoice</div><div>© Antab Agro LTD</div>
  </div>
</div>`;
}

function buildSalesOrderPrintHeaderRight(order: SalesOrderDetail): string {
  const paymentStatus = order.invoiceId?.paymentStatus || "UNPAID";
  return `
    <div style="text-align:right;">
      <div style="font-size: 20px; font-weight: 800; color: #0f172a;">#${order.orderNo}</div>
      <div style="font-size: 13px; color: #475569; margin-top: 2px;">${order.paymentMethod === "CREDIT" ? "Credit Sale" : "Cash Sale"} · ${paymentStatus}</div>
      <div style="display: inline-block; background: ${order.status === "DELIVERED" ? "#065f46" : order.status === "CANCELLED" ? "#b91c1c" : "#1e40af"}; color: white; padding: 4px 16px; border-radius: 100px; font-size: 13px; margin-top: 8px; font-weight: 700;">${order.status.replaceAll("_", " ")}</div>
    </div>`;
}

function buildDCPrintHtml(order: SalesOrderDetail): string {
  const dealer = order.customerId || {};
  const warehouse = order.warehouseId || {};
  const items = order.items || [];
  const dateFmt = (d: any) =>
    d ? new Date(d).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" }) : "—";
  const rowsHtml = items
    .map((item, idx) => `
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:8px 10px;">${idx + 1}</td>
        <td style="padding:8px 10px; font-weight:600;">${item.productId?.name || item.productName || item.name || "-"}</td>
        <td style="padding:8px 10px; text-align:center;">${Number(item.qty || 0)}</td>
        <td style="padding:8px 10px; text-align:center;">${Number(item.bonusQty || 0) > 0 ? Number(item.bonusQty || 0) : "-"}</td>
        <td style="padding:8px 10px; text-align:center;"><div style="width:40px; height:24px; border:2px dashed #cbd5e1; border-radius:6px; display:inline-flex; align-items:center; justify-content:center; font-size:11px; color:#94a3b8;">/</div></td>
        <td style="padding:8px 10px; text-align:center;"><div style="width:40px; height:24px; border:2px dashed #cbd5e1; border-radius:6px; display:inline-flex; align-items:center; justify-content:center; font-size:11px; color:#94a3b8;">/</div></td>
      </tr>`)
    .join("");

  return `
<div style="font-family: 'Inter', sans-serif; max-width: 100%; margin: 0 auto; color: #1e293b; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden;">
  <div style="background: #1e293b; padding: 16px 28px; display: flex; justify-content: space-between; align-items: center; color: white;">
    <div><div style="font-size: 22px; font-weight: 800;">DELIVERY CHALAN</div><div style="font-size: 13px; opacity: 0.9;">Original / Duplicate</div></div>
    <div style="text-align: right;"><div style="font-size: 18px; font-weight: 800;">DC #${order.orderNo}</div><div style="font-size: 12px; opacity: 0.8;">Date: ${dateFmt(order.orderDate || order.createdAt)}</div></div>
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
    </div>
    <div style="flex: 1; background: white; border-radius: 10px; padding: 10px 14px;">
      <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700;">Vehicle / Driver</div>
      <div style="color:#94a3b8;">.............................</div>
    </div>
  </div>
  <div style="padding: 16px 28px;">
    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
      <thead><tr style="background: #f1f5f9; font-weight: 700; color: #334155; text-transform: uppercase; font-size: 11px;">
        <th style="padding: 10px 8px; text-align: left;">#</th>
        <th style="padding: 10px 8px; text-align: left;">Product</th>
        <th style="padding: 10px 8px; text-align: center;">Qty</th>
        <th style="padding: 10px 8px; text-align: center;">Bonus</th>
        <th style="padding: 10px 8px; text-align: center;">Recv'd</th>
        <th style="padding: 10px 8px; text-align: center;">Remarks</th>
      </tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </div>
  <div style="display: flex; gap: 16px; padding: 14px 28px; background: #f8fafc; border-top: 1px solid #e2e8f0;">
    <div style="flex: 1; background: white; border-radius: 10px; padding: 12px; text-align: center;">
      <div style="font-size: 10px; font-weight: 700; color:#64748b;">Prepared By</div>
      <div style="border-top: 2px solid #cbd5e1; margin-top: 28px; padding-top: 8px; font-size: 11px; color: #94a3b8;">(Signature / Name)</div>
    </div>
    <div style="flex: 1; background: white; border-radius: 10px; padding: 12px; text-align: center;">
      <div style="font-size: 10px; font-weight: 700; color:#64748b;">Security Check</div>
      <div style="border-top: 2px solid #cbd5e1; margin-top: 28px; padding-top: 8px; font-size: 11px; color: #94a3b8;">(Signature / Name)</div>
    </div>
    <div style="flex: 1; background: white; border-radius: 10px; padding: 12px; text-align: center;">
      <div style="font-size: 10px; font-weight: 700; color:#64748b;">Received By</div>
      <div style="border-top: 2px solid #cbd5e1; margin-top: 28px; padding-top: 8px; font-size: 11px; color: #94a3b8;">(Signature / Name)</div>
    </div>
  </div>
</div>`;
}

/* =========================== Page (Protected) =========================== */
export default function SalesOrderViewPage() {
  return (
    <Protected permissions="sales.view">
      <SalesOrderViewPageInner />
    </Protected>
  );
}

/* =========================== Inner =========================== */
function SalesOrderViewPageInner() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const orderId = params?.id;

  const hasAccess = usePermissionCheck();
  const canEdit = hasAccess({ permissions: "sales.edit" });

  const [loading, setLoading] = useState(true);
  const [savingAction, setSavingAction] = useState<string | null>(null);
  const [order, setOrder] = useState<SalesOrderDetail | null>(null);

  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofUploading, setProofUploading] = useState(false);

  const [dcFile, setDcFile] = useState<File | null>(null);
  const [dcUploadLoading, setDcUploadLoading] = useState(false);
  const [dcMediaId, setDcMediaId] = useState<string | null>(null);

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
      if (data.dcMediaId) setDcMediaId(String(data.dcMediaId));
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to load sales order.");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { void loadOrder(); }, [loadOrder]);

  useEffect(() => {
    if (!order?.invoiceId) { setQrImage(""); setQrImageForPrint(""); setQrParsed(null); return; }
    const qrPayload = typeof order.invoiceId?.qrCode === "string" ? order.invoiceId.qrCode : "";
    if (!qrPayload) { setQrImage(""); setQrImageForPrint(""); setQrParsed(null); return; }
    try { setQrParsed(JSON.parse(qrPayload) as QrData); } catch { setQrParsed(null); }
    let mounted = true;
    QRCode.toDataURL(qrPayload, { width: 220, margin: 2, errorCorrectionLevel: "M" })
      .then((d) => { if (mounted) { setQrImage(d); setQrImageForPrint(d); } })
      .catch(() => { if (mounted) { setQrImage(""); setQrImageForPrint(""); } });
    return () => { mounted = false; };
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
    () => ["PENDING_AM", "PENDING_RM", "PENDING_NSM", "PENDING_FULFILLMENT", "IN_SHIPPING", "DELIVERED"] as OrderStatus[],
    [],
  );

  const canEditOrder = order && ["PENDING_AM", "PENDING_RM", "PENDING_NSM", "PENDING_FULFILLMENT"].includes(order.status);
  const canShip = order?.status === "PENDING_FULFILLMENT";
  const canDeliver = order?.status === "IN_SHIPPING";
  const canCancel = order ? !["DELIVERED", "CANCELLED"].includes(order.status) : false;

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
    if (!canEdit) { toast.error("You don't have permission to ship this order."); return; }
    if (!orderId) return;
    if (!confirm("Create invoice and move this order to fulfillment?")) return;
    setSavingAction("ship");
    try {
      await api.post(`/sales-orders/${orderId}/ship`);
      toast.success("Invoice created.");
      await loadOrder();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to ship order.");
    } finally { setSavingAction(null); }
  };

  const handleCancel = async () => {
    if (!canEdit) { toast.error("You don't have permission to cancel this order."); return; }
    if (!orderId) return;
    if (!confirm("Cancel this sales order?")) return;
    setSavingAction("cancel");
    try {
      await api.post(`/sales-orders/${orderId}/cancel`);
      toast.success("Order cancelled.");
      await loadOrder();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to cancel order.");
    } finally { setSavingAction(null); }
  };

  const handleDeliver = async () => {
    if (!canEdit) { toast.error("You don't have permission to complete delivery."); return; }
    if (!orderId) return;
    if (!proofFile) { toast.error("Please upload the signed invoice first."); return; }
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
    } finally { setProofUploading(false); setSavingAction(null); }
  };

  const handleDCUpload = async () => {
    if (!canEdit) { toast.error("You don't have permission to upload the DC."); return; }
    if (!dcFile) { toast.error("Select a DC file first"); return; }
    setDcUploadLoading(true);
    try {
      const mediaId = await uploadProofFile(dcFile);
      await api.post(`/sales-orders/${orderId}/upload-dc`, { dcMediaId: mediaId });
      setDcMediaId(mediaId);
      toast.success("Delivery Chalan uploaded.");
      await loadOrder();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "DC upload failed");
    } finally { setDcUploadLoading(false); }
  };

  const dealerSignatureId =
    dealer?.attachments?.required?.signature?._id ||
    dealer?.attachments?.required?.signature?.id ||
    dealer?.attachments?.required?.signature ||
    "";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50/60 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-[#3aa838]" />
          <span className="text-xs text-slate-500 dark:text-slate-400">Loading sales order…</span>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50/60 p-4 dark:bg-slate-950">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
            <Inbox className="h-6 w-6 text-slate-400" />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">Sales order not found</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">The record may have been deleted or the URL is invalid.</p>
          <Button className="mt-4 h-9 gap-1.5 bg-[#3aa838] text-white hover:bg-[#2f8a2f]" onClick={() => router.push("/sales/list")}>
            Back to list
          </Button>
        </div>
      </div>
    );
  }

  const statusIndex = approvalFlow.indexOf(order.status);
  const isFinalFailed = ["REJECTED", "CANCELLED"].includes(order.status);
  const lastFailedStep = isFinalFailed
    ? (order.approvalLogs?.map((l) => approvalFlow.indexOf(l.role as OrderStatus)).filter((i) => i >= 0).sort((a, b) => b - a)[0] ?? -1)
    : -1;

  const stepState = (i: number): "done" | "active" | "pending" => {
    if (order.status === "DELIVERED") return "done";
    if (isFinalFailed) return i <= lastFailedStep ? "done" : "pending";
    if (statusIndex < 0) return "pending";
    if (i < statusIndex) return "done";
    if (i === statusIndex) return "active";
    return "pending";
  };

  const creditLimit = Number(order.creditSnapshot?.creditLimit || 0);
  const creditUsed = Number(order.creditSnapshot?.used || 0);
  const creditPct = creditLimit > 0 ? Math.min(100, (creditUsed / creditLimit) * 100) : 0;
  const creditDanger = creditPct > 80;

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950">
      <div className="mx-auto w-full max-w-[1600px] p-4 md:p-6">
        {/* ============ HERO ============ */}
        <div className="relative mb-4 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-[#1a4d1a] p-5 text-white shadow-lg md:p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(58,168,56,0.25),transparent_55%)]" />
          <div className="relative">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/60">Sales Order</div>
                <h1 className="mt-1 text-2xl font-bold tracking-tight tabular-nums md:text-3xl">{order.orderNo}</h1>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusBadge status={order.status} />
                  <PaymentBadge method={order.paymentMethod} />
                  {invoice && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium ring-1 ring-white/15">
                      <FileText className="h-3 w-3" />{invoice.invoiceNo}
                    </span>
                  )}
                  <span className="text-[11px] text-white/60">{fmtDate(order.createdAt || order.orderDate)}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <Button variant="secondary" size="sm" onClick={() => void loadOrder()} className="h-9 gap-1.5 border border-white/20 bg-white/10 text-xs text-white hover:bg-white/20">
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </Button>
                {canEdit && canEditOrder && (
                  <Button variant="secondary" size="sm" className="h-9 gap-1.5 border border-white/20 bg-white/10 text-xs text-white hover:bg-white/20" onClick={() => router.push(`/sales/list/${order._id}/edit`)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                )}
                {invoice && (
                  <GlobalPrintButton
                    contentHtml={buildSalesOrderPrintHtml(order, qrImageForPrint)}
                    headerRightHtml={buildSalesOrderPrintHeaderRight(order)}
                    label="Print Invoice"
                    title="Sales Invoice"
                    orientation="portrait"
                    company={printCompany}
                    showHeader={false}
                    showFooter={false}
                  />
                )}
                {canEdit && canShip && (
                  <Button size="sm" className="h-9 gap-1.5 bg-[#3aa838] text-xs text-white hover:bg-[#2f8a2f]" onClick={() => void handleShip()} disabled={savingAction === "ship"}>
                    {savingAction === "ship" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Truck className="h-3.5 w-3.5" />}
                    Ship
                  </Button>
                )}
                {canEdit && canCancel && (
                  <Button variant="secondary" size="sm" className="h-9 gap-1.5 border border-rose-500/30 bg-rose-500/15 text-xs text-rose-200 hover:bg-rose-500/25" onClick={() => void handleCancel()} disabled={savingAction === "cancel"}>
                    {savingAction === "cancel" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                    Cancel
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg bg-white/10 px-3 py-2 ring-1 ring-white/15 backdrop-blur-sm">
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-white/60"><Building2 className="h-3 w-3" /> Dealer</div>
                <div className="mt-0.5 truncate text-sm font-semibold">{dealer?.name || dealer?.proprietor || "-"}</div>
                <div className="truncate text-[11px] text-white/60">{dealer?.phoneNumber || dealer?.phone || ""}</div>
              </div>
              <div className="rounded-lg bg-white/10 px-3 py-2 ring-1 ring-white/15 backdrop-blur-sm">
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-white/60"><Warehouse className="h-3 w-3" /> Warehouse</div>
                <div className="mt-0.5 truncate text-sm font-semibold">{warehouse?.name || "-"}</div>
                <div className="truncate text-[11px] text-white/60">{warehouse?.code || ""}</div>
              </div>
              <div className="rounded-lg bg-white/10 px-3 py-2 ring-1 ring-white/15 backdrop-blur-sm">
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-white/60"><Calendar className="h-3 w-3" /> Order date</div>
                <div className="mt-0.5 text-sm font-semibold">{fmtDate(order.orderDate || order.createdAt)}</div>
              </div>
              <div className="rounded-lg bg-[#3aa838] px-3 py-2 shadow-md shadow-black/40">
                <div className="text-[10px] uppercase tracking-wide text-[#c6e8c5]">Grand total</div>
                <div className="mt-0.5 text-base font-bold tabular-nums">৳ {money(order.grandTotal ?? totals.total)}</div>
                <div className="text-[11px] text-[#c6e8c5]">{order.paymentMethod}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ============ BODY ============ */}
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          {/* ============ LEFT ============ */}
          <div className="space-y-4">
            {/* Items */}
            <Card className="overflow-hidden border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <SectionHeader icon={Package} title="Order items" subtitle={`${items.length} line item${items.length === 1 ? "" : "s"}`} />
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-950/60">
                      <tr>
                        {["#", "Product", "Qty", "Bonus", "Unit price", "Subtotal", "Tax", "Total"].map((h) => (
                          <th key={h} className={`border-b border-slate-200 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400 ${["#", "Product"].includes(h) ? "text-left" : "text-right"}`}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, index) => (
                        <tr key={item._id || index} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/30">
                          <td className="px-3 py-2.5 text-xs text-slate-400">{index + 1}</td>
                          <td className="px-3 py-2.5">
                            <div className="text-sm font-medium text-slate-900 dark:text-white">{item.productId?.name || item.productName || item.name || "-"}</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">{item.productId?.sku || item.productId?.code || ""}</div>
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs tabular-nums text-slate-700 dark:text-slate-300">{Number(item.qty || 0)}</td>
                          <td className="px-3 py-2.5 text-right text-xs tabular-nums">
                            {Number(item.bonusQty || 0) > 0 ? (
                              <span className="inline-flex rounded bg-[#3aa838]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#2f8a2f] dark:bg-[#3aa838]/15 dark:text-[#9bdd91]">+{Number(item.bonusQty || 0)}</span>
                            ) : <span className="text-slate-400">-</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs tabular-nums text-slate-700 dark:text-slate-300">{money(Number(item.unitPrice || 0))}</td>
                          <td className="px-3 py-2.5 text-right text-xs tabular-nums text-slate-700 dark:text-slate-300">{money(lineSubtotal(item))}</td>
                          <td className="px-3 py-2.5 text-right text-xs tabular-nums text-slate-700 dark:text-slate-300">{money(Number(item.taxAmount || 0))}</td>
                          <td className="px-3 py-2.5 text-right text-xs font-semibold tabular-nums text-slate-900 dark:text-white">{money(lineTotal(item))}</td>
                        </tr>
                      ))}
                      {!items.length && (
                        <tr>
                          <td colSpan={8} className="px-3 py-10 text-center text-xs text-slate-500 dark:text-slate-400">No items found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* 🆕 QTY CHANGE HISTORY */}
            <QtyChangeHistoryCard logs={order.qtyChangeLogs} />

            {/* Approval stepper + activity log */}
            <Card className="overflow-hidden border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <SectionHeader icon={CheckCircle2} title="Approval progress" subtitle="Track the order through the workflow" />
              <CardContent className="p-4">
                <div className="overflow-x-auto pb-2">
                  <div className="flex min-w-max items-start justify-between">
                    {approvalFlow.map((step, i) => {
                      const state = stepState(i);
                      const circleClass =
                        state === "done" ? "bg-[#3aa838] text-white" :
                        state === "active" ? "bg-[#3aa838] text-white ring-4 ring-[#3aa838]/20" :
                        "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400";
                      const labelClass = state === "done" || state === "active"
                        ? "font-semibold text-slate-900 dark:text-white"
                        : "text-slate-500 dark:text-slate-400";
                      const connectorDone = state === "done" || order.status === "DELIVERED";
                      return (
                        <React.Fragment key={step}>
                          <div className="flex min-w-[70px] flex-col items-center gap-1.5">
                            <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all ${circleClass}`}>
                              {state === "done" ? <Check className="h-4 w-4" /> : i + 1}
                            </div>
                            <div className={`max-w-[70px] truncate text-center text-[10px] uppercase tracking-wide ${labelClass}`}>
                              {step.replaceAll("_", " ")}
                            </div>
                          </div>
                          {i < approvalFlow.length - 1 && (
                            <div className={`mx-1 mt-4 h-0.5 flex-1 rounded ${connectorDone ? "bg-[#3aa838]" : "bg-slate-200 dark:bg-slate-800"}`} />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
                {isFinalFailed && (
                  <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                    Order was {order.status.toLowerCase()}.
                  </div>
                )}
                {order.approvalLogs && order.approvalLogs.length > 0 ? (
                  <div className="mt-4 space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Activity</div>
                    {order.approvalLogs.map((log, i) => {
                      const approved = (log.status || "").toUpperCase() === "APPROVED";
                      return (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <div className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${approved ? "bg-[#3aa838]/10 dark:bg-[#3aa838]/15" : "bg-rose-50 dark:bg-rose-950/40"}`}>
                            <Check className={`h-3 w-3 ${approved ? "text-[#3aa838] dark:text-[#9bdd91]" : "text-rose-500"}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-1.5">
                              <span className="text-xs font-medium text-slate-900 dark:text-white">{log.role?.replaceAll("_", " ") || "Step"}</span>
                              <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${approved ? "bg-[#3aa838]/10 text-[#2f8a2f] dark:bg-[#3aa838]/15 dark:text-[#9bdd91]" : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"}`}>{log.status}</span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400">{fmtDate(log.actionDate)}</span>
                            </div>
                            {log.remarks && <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{log.remarks}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
                    No approval actions recorded yet.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 🆕 ATTACHMENTS */}
            <OrderAttachmentsPanel
              orderId={orderId!}
              attachments={order.attachments}
              canUpload={canEdit}
              canDelete={canEdit}
              onRefresh={loadOrder}
            />

            {/* Notes */}
            <Card className="overflow-hidden border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <SectionHeader icon={FileText} title="Notes" />
              <CardContent className="p-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
                  {order.notes || "No notes provided."}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ============ RIGHT ============ */}
          <div className="h-fit space-y-4 lg:sticky lg:top-4">
            <Card className="overflow-hidden border-slate-200 shadow-md dark:border-slate-800 dark:bg-slate-900">
              <SectionHeader icon={Wallet} title="Summary" />
              <CardContent className="space-y-2.5 p-4">
                <div className="flex items-center justify-between text-xs"><span className="text-slate-500 dark:text-slate-400">Qty</span><span className="font-semibold tabular-nums text-slate-900 dark:text-white">{totals.qty}</span></div>
                <div className="flex items-center justify-between text-xs"><span className="text-slate-500 dark:text-slate-400">Bonus qty</span><span className="font-semibold tabular-nums text-slate-900 dark:text-white">{totals.bonusQty}</span></div>
                <div className="flex items-center justify-between text-xs"><span className="text-slate-500 dark:text-slate-400">Sub total</span><span className="font-semibold tabular-nums text-slate-900 dark:text-white">{money(order.subTotal ?? totals.subtotal)}</span></div>
                <div className="flex items-center justify-between text-xs"><span className="text-slate-500 dark:text-slate-400">Discount</span><span className="font-semibold tabular-nums text-rose-600 dark:text-rose-400">- {money(order.totalDiscount)}</span></div>
                <div className="flex items-center justify-between text-xs"><span className="text-slate-500 dark:text-slate-400">Tax</span><span className="font-semibold tabular-nums text-slate-900 dark:text-white">{money(order.totalTax)}</span></div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-2.5 dark:border-slate-800">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">Grand total</span>
                  <span className="text-lg font-extrabold tabular-nums text-[#2f8a2f] dark:text-[#9bdd91]">৳ {money(order.grandTotal ?? totals.total)}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <SectionHeader icon={TrendingUp} title="Credit summary" />
              <CardContent className="space-y-2.5 p-4">
                <div className="flex items-center justify-between text-xs"><span className="text-slate-500 dark:text-slate-400">Credit limit</span><span className="font-semibold tabular-nums text-slate-900 dark:text-white">{money(order.creditSnapshot?.creditLimit)}</span></div>
                <div className="flex items-center justify-between text-xs"><span className="text-slate-500 dark:text-slate-400">Used</span><span className="font-semibold tabular-nums text-slate-900 dark:text-white">{money(order.creditSnapshot?.used)}</span></div>
                <div className="flex items-center justify-between text-xs"><span className="text-slate-500 dark:text-slate-400">Available</span><span className="font-bold tabular-nums text-[#3aa838] dark:text-[#9bdd91]">{money(order.creditSnapshot?.available)}</span></div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div className={`h-full rounded-full transition-all ${creditDanger ? "bg-rose-500" : "bg-[#3aa838]"}`} style={{ width: `${creditPct}%` }} />
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">{creditPct.toFixed(1)}% of limit used</div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <SectionHeader icon={Receipt} title="Invoice" />
              <CardContent className="space-y-3 p-4">
                {invoice ? (
                  <>
                    <div className="rounded-lg border border-[#3aa838]/20 bg-[#3aa838]/5 p-3 dark:border-[#3aa838]/30 dark:bg-[#3aa838]/10">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#2f8a2f] dark:text-[#9bdd91]">Invoice No</div>
                      <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">{invoice.invoiceNo || "-"}</div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div><div className="text-slate-500 dark:text-slate-400">Date</div><div className="font-medium text-slate-900 dark:text-white">{fmtDate(invoice.invoiceDate || order.createdAt)}</div></div>
                        <div><div className="text-slate-500 dark:text-slate-400">Payment</div><div className="font-medium text-slate-900 dark:text-white">{invoice.paymentStatus || "UNPAID"}</div></div>
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3 text-center dark:border-slate-800 dark:bg-slate-950/40">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">QR Code</div>
                      <div className="mt-2 flex justify-center">
                        {qrImage ? (
                          <img src={qrImage} alt="Invoice QR" className="h-44 w-44 rounded border border-slate-200 dark:border-slate-700" />
                        ) : (
                          <div className="flex h-44 w-44 items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 text-[10px] text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">QR not ready</div>
                        )}
                      </div>
                      <div className="mt-1.5 text-[10px] text-slate-500 dark:text-slate-400">Scan to verify</div>
                    </div>
                    {qrParsed && (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-950/40">
                        <div className="font-semibold text-slate-900 dark:text-white">Decoded data</div>
                        <div className="mt-1.5 space-y-0.5 text-slate-600 dark:text-slate-400">
                          <div><span className="text-slate-500 dark:text-slate-500">Dealer:</span> <span className="font-medium text-slate-900 dark:text-white">{qrParsed?.dealer?.name}</span> ({qrParsed?.dealer?.code})</div>
                          <div><span className="text-slate-500 dark:text-slate-500">Phone:</span> {qrParsed?.dealer?.phone}</div>
                          <div><span className="text-slate-500 dark:text-slate-500">Credit:</span> {money(qrParsed?.dealer?.creditLimit)} limit / {money(qrParsed?.dealer?.available)} avail</div>
                        </div>
                      </div>
                    )}
                    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/40">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Dealer signature template</div>
                      <div className="mt-1.5 text-xs">
                        {dealerSignatureId ? (
                          <div className="truncate rounded border border-[#3aa838]/30 bg-[#3aa838]/5 p-1.5 font-mono text-[10px] text-[#2f8a2f] dark:border-[#3aa838]/40 dark:bg-[#3aa838]/10 dark:text-[#9bdd91]">{String(dealerSignatureId)}</div>
                        ) : (
                          <div className="text-slate-500 dark:text-slate-400">No dealer signature uploaded.</div>
                        )}
                      </div>
                    </div>
                    <GlobalPrintButton
                      contentHtml={buildSalesOrderPrintHtml(order, qrImageForPrint)}
                      headerRightHtml={buildSalesOrderPrintHeaderRight(order)}
                      label="Print Invoice"
                      title="Sales Invoice"
                      orientation="portrait"
                      company={printCompany}
                      showHeader={false}
                      showFooter={false}
                    />
                  </>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center dark:border-slate-700 dark:bg-slate-950/40">
                    <FileText className="mx-auto h-6 w-6 text-slate-400" />
                    <div className="mt-2 text-xs font-semibold text-slate-900 dark:text-white">No invoice yet</div>
                    <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">Use Ship to generate the invoice.</div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <SectionHeader icon={FileText} title="Delivery Chalan (DC)" />
              <CardContent className="space-y-3 p-4">
                <GlobalPrintButton
                  contentHtml={buildDCPrintHtml(order)}
                  headerRightHtml={`<div style="text-align:right;"><div style="font-size:20px;font-weight:800;color:#0f172a;">DC #${order.orderNo}</div></div>`}
                  label="Print D.C."
                  title="Delivery Chalan"
                  orientation="portrait"
                  company={printCompany}
                  showHeader={false}
                  showFooter={false}
                />
                <div className="text-[10px] text-slate-500 dark:text-slate-400">Upload the signed DC (optional).</div>
                <UploadTile label="Click to upload DC" hint="PDF or image" onFile={setDcFile} disabled={!canEdit} />
                {dcFile && (
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-[10px] dark:border-slate-800 dark:bg-slate-950/40">
                    <span className="text-slate-500 dark:text-slate-400">Selected:</span>{" "}
                    <span className="font-medium text-slate-900 dark:text-white">{dcFile.name}</span>
                  </div>
                )}
                {canEdit && (
                  <Button type="button" className="h-9 w-full gap-1.5 bg-[#3aa838] text-xs text-white shadow-sm shadow-[#3aa838]/20 hover:bg-[#2f8a2f]" onClick={handleDCUpload} disabled={dcUploadLoading || !dcFile}>
                    {dcUploadLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    Upload DC
                  </Button>
                )}
                {dcMediaId && (
                  <div className="rounded-lg border border-[#3aa838]/30 bg-[#3aa838]/5 p-2.5 dark:border-[#3aa838]/40 dark:bg-[#3aa838]/10">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[#2f8a2f] dark:text-[#9bdd91]"><CheckCircle2 className="h-3.5 w-3.5" /> DC uploaded</div>
                    <div className="mt-0.5 truncate font-mono text-[10px] text-[#2f8a2f] dark:text-[#9bdd91]">{dcMediaId}</div>
                  </div>
                )}
              </CardContent>
            </Card>

            {canEdit && canDeliver && (
              <Card className="overflow-hidden border-[#3aa838]/30 shadow-md ring-2 ring-[#3aa838]/10 dark:border-[#3aa838]/40 dark:bg-slate-900">
                <SectionHeader icon={Truck} title="Delivery verification" subtitle="Upload signed invoice to complete delivery" />
                <CardContent className="space-y-3 p-4">
                  <div className="rounded-lg border border-[#3aa838]/20 bg-[#3aa838]/5 p-2.5 text-[11px] text-[#2f8a2f] dark:border-[#3aa838]/30 dark:bg-[#3aa838]/10 dark:text-[#9bdd91]">
                    Upload the signed invoice. The backend will verify the QR and dealer signature before approving delivery.
                  </div>
                  <UploadTile label="Click to upload signed invoice" hint="PDF or image" onFile={setProofFile} />
                  {proofFile && (
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-[10px] dark:border-slate-800 dark:bg-slate-950/40">
                      <span className="text-slate-500 dark:text-slate-400">Selected:</span>{" "}
                      <span className="font-medium text-slate-900 dark:text-white">{proofFile.name}</span>
                    </div>
                  )}
                  <Button type="button" className="h-9 w-full gap-1.5 bg-[#3aa838] text-xs text-white shadow-sm shadow-[#3aa838]/20 hover:bg-[#2f8a2f]" onClick={() => void handleDeliver()} disabled={proofUploading || savingAction === "deliver" || !proofFile}>
                    {proofUploading || savingAction === "deliver" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
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