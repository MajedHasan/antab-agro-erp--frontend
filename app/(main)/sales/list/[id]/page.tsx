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
  RefreshCw,
  Truck,
  Ban,
  Upload,
  Pencil,
  FileText,
  CheckCircle2,
  Building2,
  Warehouse,
  Calendar,
  CreditCard,
  Package,
  Wallet,
  TrendingUp,
  Receipt,
  Check,
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
    PENDING_RM: "bg-slate-100 text-slate-700 border-slate-200",
    PENDING_NSM: "bg-slate-100 text-slate-700 border-slate-200",
    PENDING_FULFILLMENT: "bg-amber-50 text-amber-700 border-amber-200",
    IN_SHIPPING: "bg-amber-50 text-amber-700 border-amber-200",
    DELIVERED: "bg-[#3aa838]/10 text-[#2f8a2f] border-[#3aa838]/30",
    REJECTED: "bg-rose-50 text-rose-700 border-rose-200",
    CANCELLED: "bg-rose-50 text-rose-700 border-rose-200",
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${styles[status]}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

function PaymentBadge({ method }: { method?: "CASH" | "CREDIT" }) {
  if (!method) return <span className="text-xs text-muted-foreground">-</span>;
  const styles =
    method === "CREDIT"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-[#3aa838]/10 text-[#2f8a2f] border-[#3aa838]/30";
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${styles}`}
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

/* ------------------------------ SectionHeader ------------------------------ */
function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  right,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#3aa838]/10 text-[#3aa838]">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold">{title}</div>
          {subtitle && (
            <div className="text-xs text-muted-foreground">{subtitle}</div>
          )}
        </div>
      </div>
      {right}
    </div>
  );
}

/* ------------------------------ Upload tile ------------------------------ */
function UploadTile({
  label,
  hint,
  onFile,
}: {
  label: string;
  hint: string;
  onFile: (f: File | null) => void;
}) {
  return (
    <label className="block cursor-pointer rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center transition-colors hover:border-[#3aa838] hover:bg-[#3aa838]/5">
      <Upload className="mx-auto h-6 w-6 text-slate-400" />
      <div className="mt-2 text-xs font-medium text-slate-700">{label}</div>
      <div className="text-[10px] text-muted-foreground">{hint}</div>
      <input
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] || null)}
      />
    </label>
  );
}

// ================================================
// PRINT HELPERS  (unchanged)
// ================================================
function buildSalesOrderPrintHtml(
  order: SalesOrderDetail,
  qrImageDataUrl: string,
): string {
  const dealer = order.customerId || {};
  const warehouse = order.warehouseId || {};
  const items = order.items || [];
  const dateFmt = (d: any) =>
    d
      ? new Date(d).toLocaleDateString("en-IN", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "—";

  const invoiceNo =
    order.invoiceId?.invoiceNo || order.orderNo.replace(/^SO/, "INV");
  const paymentStatus = order.invoiceId?.paymentStatus || "UNPAID";

  const rowsHtml = items
    .map((item) => {
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
  const dateFmt = (d: any) =>
    d
      ? new Date(d).toLocaleDateString("en-IN", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "—";

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

  useEffect(() => {
    if (!order?.invoiceId) {
      setQrImage("");
      setQrImageForPrint("");
      setQrParsed(null);
      return;
    }
    const qrPayload =
      typeof order.invoiceId?.qrCode === "string" ? order.invoiceId.qrCode : "";
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
    QRCode.toDataURL(qrPayload, {
      width: 220,
      margin: 2,
      errorCorrectionLevel: "M",
    })
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
    ["PENDING_AM", "PENDING_RM", "PENDING_NSM", "PENDING_FULFILLMENT"].includes(
      order.status,
    );

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
      await api.post(`/sales-orders/${orderId}/deliver`, {
        uploadedDocumentFileId,
      });
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
      await api.post(`/sales-orders/${orderId}/upload-dc`, {
        dcMediaId: mediaId,
      });
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

  /* ------------------------------ loading / not-found ------------------------------ */
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading sales order...
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
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

  /* ------------------------------ stepper helpers ------------------------------ */
  const statusIndex = approvalFlow.indexOf(order.status);
  const isFinalFailed = ["REJECTED", "CANCELLED"].includes(order.status);
  const lastFailedStep = isFinalFailed
    ? (order.approvalLogs
        ?.map((l) => approvalFlow.indexOf(l.role as OrderStatus))
        .filter((i) => i >= 0)
        .sort((a, b) => b - a)[0] ?? -1)
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
  const creditPct =
    creditLimit > 0 ? Math.min(100, (creditUsed / creditLimit) * 100) : 0;
  const creditDanger = creditPct > 80;

  const printCompany = {
    name: "Antab Agro LTD",
    address: "123 Agro Street, Dhaka",
    phone: "+880 1711-111111",
    email: "info@antabagro.com",
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl p-4 md:p-6">
        {/* ---------- HERO ---------- */}
        <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-[#1a4d1a] p-6 text-white shadow-lg">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(58,168,56,0.25),transparent_55%)]" />
          <div className="relative">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-white/60">
                  Sales Order
                </div>
                <h1 className="mt-1 text-3xl font-bold tracking-tight tabular-nums">
                  {order.orderNo}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusBadge status={order.status} />
                  <PaymentBadge method={order.paymentMethod} />
                  {invoice && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium ring-1 ring-white/15">
                      <FileText className="h-3 w-3" />
                      {invoice.invoiceNo}
                    </span>
                  )}
                  <span className="text-xs text-white/60">
                    {fmtDate(order.createdAt || order.orderDate)}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void loadOrder()}
                  className="border border-white/20 bg-white/10 text-white hover:bg-white/20"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>

                {canEdit && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="border border-white/20 bg-white/10 text-white hover:bg-white/20"
                    onClick={() =>
                      router.push(`/sales/list/${order._id}/edit`)
                    }
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
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

                {canShip && (
                  <Button
                    size="sm"
                    className="bg-[#3aa838] text-white hover:bg-[#2f8a2f]"
                    onClick={() => void handleShip()}
                  >
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
                    variant="secondary"
                    size="sm"
                    className="border border-rose-500/30 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25"
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

            {/* Quick info pills */}
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg bg-white/10 px-3 py-2 ring-1 ring-white/15 backdrop-blur-sm">
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-white/60">
                  <Building2 className="h-3 w-3" />
                  Dealer
                </div>
                <div className="mt-0.5 truncate text-sm font-semibold">
                  {dealer?.name || dealer?.proprietor || "-"}
                </div>
                <div className="truncate text-[11px] text-white/60">
                  {dealer?.phoneNumber || dealer?.phone || ""}
                </div>
              </div>
              <div className="rounded-lg bg-white/10 px-3 py-2 ring-1 ring-white/15 backdrop-blur-sm">
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-white/60">
                  <Warehouse className="h-3 w-3" />
                  Warehouse
                </div>
                <div className="mt-0.5 truncate text-sm font-semibold">
                  {warehouse?.name || "-"}
                </div>
                <div className="truncate text-[11px] text-white/60">
                  {warehouse?.code || ""}
                </div>
              </div>
              <div className="rounded-lg bg-white/10 px-3 py-2 ring-1 ring-white/15 backdrop-blur-sm">
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-white/60">
                  <Calendar className="h-3 w-3" />
                  Order date
                </div>
                <div className="mt-0.5 text-sm font-semibold">
                  {fmtDate(order.orderDate || order.createdAt)}
                </div>
              </div>
              <div className="rounded-lg bg-[#3aa838] px-3 py-2 shadow-md shadow-black/40">
                <div className="text-[10px] uppercase tracking-wide text-[#c6e8c5]">
                  Grand total
                </div>
                <div className="mt-0.5 text-base font-bold tabular-nums">
                  ৳ {money(order.grandTotal ?? totals.total)}
                </div>
                <div className="text-[11px] text-[#c6e8c5]">
                  {order.paymentMethod}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ---------- BODY ---------- */}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          {/* ============ LEFT ============ */}
          <div className="space-y-6">
            {/* Items */}
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <SectionHeader
                icon={Package}
                title="Order items"
                subtitle={`${items.length} line item${items.length === 1 ? "" : "s"}`}
              />
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        {[
                          "#",
                          "Product",
                          "Qty",
                          "Bonus",
                          "Unit price",
                          "Subtotal",
                          "Tax",
                          "Total",
                        ].map((h) => (
                          <th
                            key={h}
                            className={`border-b border-slate-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-600 ${
                              ["#", "Product"].includes(h)
                                ? "text-left"
                                : "text-right"
                            }`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, index) => (
                        <tr
                          key={item._id || index}
                          className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                        >
                          <td className="px-4 py-3 text-slate-500">
                            {index + 1}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium">
                              {item.productId?.name ||
                                item.productName ||
                                item.name ||
                                "-"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {item.productId?.sku ||
                                item.productId?.code ||
                                ""}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {Number(item.qty || 0)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {Number(item.bonusQty || 0) > 0 ? (
                              <span className="inline-flex rounded bg-[#3aa838]/10 px-2 py-0.5 text-xs font-medium text-[#2f8a2f]">
                                +{Number(item.bonusQty || 0)}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {money(Number(item.unitPrice || 0))}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {money(lineSubtotal(item))}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {money(Number(item.taxAmount || 0))}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                            {money(lineTotal(item))}
                          </td>
                        </tr>
                      ))}
                      {!items.length && (
                        <tr>
                          <td
                            colSpan={8}
                            className="px-4 py-10 text-center text-muted-foreground"
                          >
                            No items found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Approval stepper + activity log */}
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <SectionHeader
                icon={CheckCircle2}
                title="Approval progress"
                subtitle="Track the order through the workflow"
              />
              <CardContent className="p-5">
                <div className="overflow-x-auto pb-2">
                  <div className="flex min-w-max items-start justify-between">
                    {approvalFlow.map((step, i) => {
                      const state = stepState(i);
                      const circleClass =
                        state === "done"
                          ? "bg-[#3aa838] text-white"
                          : state === "active"
                            ? "bg-[#3aa838] text-white ring-4 ring-[#3aa838]/20"
                            : "bg-slate-200 text-slate-500";
                      const labelClass =
                        state === "done" || state === "active"
                          ? "font-semibold text-slate-900"
                          : "text-slate-500";
                      const connectorDone =
                        state === "done" || order.status === "DELIVERED";
                      return (
                        <React.Fragment key={step}>
                          <div className="flex min-w-[70px] flex-col items-center gap-1.5">
                            <div
                              className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all ${circleClass}`}
                            >
                              {state === "done" ? (
                                <Check className="h-4 w-4" />
                              ) : (
                                i + 1
                              )}
                            </div>
                            <div
                              className={`max-w-[70px] truncate text-center text-[10px] uppercase tracking-wide ${labelClass}`}
                            >
                              {step.replaceAll("_", " ")}
                            </div>
                          </div>
                          {i < approvalFlow.length - 1 && (
                            <div
                              className={`mx-1 mt-4 h-0.5 flex-1 rounded ${
                                connectorDone
                                  ? "bg-[#3aa838]"
                                  : "bg-slate-200"
                              }`}
                            />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>

                {isFinalFailed && (
                  <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
                    Order was {order.status.toLowerCase()}.
                  </div>
                )}

                {/* Activity log */}
                {order.approvalLogs && order.approvalLogs.length > 0 ? (
                  <div className="mt-5 space-y-2 border-t border-slate-200 pt-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Activity
                    </div>
                    {order.approvalLogs.map((log, i) => {
                      const approved =
                        (log.status || "").toUpperCase() === "APPROVED";
                      return (
                        <div
                          key={i}
                          className="flex items-start gap-2 text-sm"
                        >
                          <div
                            className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                              approved ? "bg-[#3aa838]/10" : "bg-rose-50"
                            }`}
                          >
                            <Check
                              className={`h-3 w-3 ${
                                approved ? "text-[#3aa838]" : "text-rose-500"
                              }`}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-1.5">
                              <span className="font-medium">
                                {log.role?.replaceAll("_", " ") || "Step"}
                              </span>
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                  approved
                                    ? "bg-[#3aa838]/10 text-[#2f8a2f]"
                                    : "bg-rose-50 text-rose-700"
                                }`}
                              >
                                {log.status}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {fmtDate(log.actionDate)}
                              </span>
                            </div>
                            {log.remarks && (
                              <div className="mt-0.5 text-xs text-muted-foreground">
                                {log.remarks}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-5 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-muted-foreground">
                    No approval actions recorded yet.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notes */}
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <SectionHeader icon={FileText} title="Notes" />
              <CardContent className="p-5">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                  {order.notes || "No notes provided."}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ============ RIGHT ============ */}
          <div className="h-fit space-y-6 lg:sticky lg:top-6">
            {/* Summary */}
            <Card className="overflow-hidden border-slate-200 shadow-md">
              <SectionHeader icon={Wallet} title="Summary" />
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Qty</span>
                  <span className="font-medium tabular-nums">{totals.qty}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Bonus qty</span>
                  <span className="font-medium tabular-nums">
                    {totals.bonusQty}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Sub total</span>
                  <span className="font-medium tabular-nums">
                    {money(order.subTotal ?? totals.subtotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="font-medium tabular-nums text-rose-600">
                    - {money(order.totalDiscount)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="font-medium tabular-nums">
                    {money(order.totalTax)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                  <span className="text-sm font-semibold">Grand total</span>
                  <span className="text-xl font-extrabold tabular-nums text-[#2f8a2f]">
                    ৳ {money(order.grandTotal ?? totals.total)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Credit summary */}
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <SectionHeader icon={TrendingUp} title="Credit summary" />
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Credit limit</span>
                  <span className="font-medium tabular-nums">
                    {money(order.creditSnapshot?.creditLimit)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Used</span>
                  <span className="font-medium tabular-nums">
                    {money(order.creditSnapshot?.used)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Available</span>
                  <span className="font-bold tabular-nums text-[#3aa838]">
                    {money(order.creditSnapshot?.available)}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full transition-all ${
                      creditDanger ? "bg-rose-500" : "bg-[#3aa838]"
                    }`}
                    style={{ width: `${creditPct}%` }}
                  />
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {creditPct.toFixed(1)}% of limit used
                </div>
              </CardContent>
            </Card>

            {/* Invoice */}
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <SectionHeader icon={Receipt} title="Invoice" />
              <CardContent className="space-y-4 p-5">
                {invoice ? (
                  <>
                    <div className="rounded-lg border border-[#3aa838]/20 bg-[#3aa838]/5 p-4">
                      <div className="text-[10px] uppercase tracking-wide text-[#2f8a2f]">
                        Invoice No
                      </div>
                      <div className="mt-0.5 font-semibold text-slate-900">
                        {invoice.invoiceNo || "-"}
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <div className="text-muted-foreground">Date</div>
                          <div className="font-medium">
                            {fmtDate(invoice.invoiceDate || order.createdAt)}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Payment</div>
                          <div className="font-medium">
                            {invoice.paymentStatus || "UNPAID"}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white p-4 text-center">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        QR Code
                      </div>
                      <div className="mt-3 flex justify-center">
                        {qrImage ? (
                          <img
                            src={qrImage}
                            alt="Invoice QR"
                            className="h-48 w-48 rounded border border-slate-200"
                          />
                        ) : (
                          <div className="flex h-48 w-48 items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 text-xs text-muted-foreground">
                            QR not ready
                          </div>
                        )}
                      </div>
                      <div className="mt-2 text-[10px] text-muted-foreground">
                        Scan to verify
                      </div>
                    </div>

                    {qrParsed && (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                        <div className="font-semibold text-slate-900">
                          Decoded data
                        </div>
                        <div className="mt-2 space-y-1 text-slate-600">
                          <div>
                            <span className="text-muted-foreground">
                              Dealer:
                            </span>{" "}
                            <span className="font-medium">
                              {qrParsed?.dealer?.name}
                            </span>{" "}
                            ({qrParsed?.dealer?.code})
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Phone:
                            </span>{" "}
                            {qrParsed?.dealer?.phone}
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Credit:
                            </span>{" "}
                            {money(qrParsed?.dealer?.creditLimit)} limit /{" "}
                            {money(qrParsed?.dealer?.available)} avail
                          </div>
                        </div>
                        {qrParsed?.products && qrParsed.products.length > 0 && (
                          <div className="mt-2 border-t border-slate-200 pt-2">
                            <div className="font-semibold text-slate-900">
                              Products
                            </div>
                            <div className="mt-1 space-y-0.5 text-slate-600">
                              {qrParsed.products.map((p, i) => (
                                <div key={i} className="truncate">
                                  {p.name} · {p.qty} × {money(p.unitPrice)}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Dealer signature template
                      </div>
                      <div className="mt-2 text-sm">
                        {dealerSignatureId ? (
                          <div className="rounded border border-[#3aa838]/30 bg-[#3aa838]/5 p-2 font-mono text-xs text-[#2f8a2f]">
                            {String(dealerSignatureId)}
                          </div>
                        ) : (
                          <div className="text-muted-foreground">
                            No dealer signature uploaded.
                          </div>
                        )}
                      </div>
                    </div>

                    <GlobalPrintButton
                      contentHtml={buildSalesOrderPrintHtml(
                        order,
                        qrImageForPrint,
                      )}
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
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
                    <FileText className="mx-auto h-8 w-8 text-slate-300" />
                    <div className="mt-2 text-sm font-medium text-slate-700">
                      No invoice yet
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Use Ship to generate the invoice.
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Delivery Chalan */}
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <SectionHeader
                icon={FileText}
                title="Delivery Chalan (DC)"
              />
              <CardContent className="space-y-4 p-5">
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

                <div className="text-xs text-muted-foreground">
                  Upload the signed DC (optional).
                </div>

                <UploadTile
                  label="Click to upload DC"
                  hint="PDF or image"
                  onFile={setDcFile}
                />

                {dcFile && (
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs">
                    <span className="text-muted-foreground">Selected:</span>{" "}
                    <span className="font-medium">{dcFile.name}</span>
                  </div>
                )}

                <Button
                  type="button"
                  className="w-full bg-[#3aa838] text-white hover:bg-[#2f8a2f]"
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
                  <div className="rounded-lg border border-[#3aa838]/30 bg-[#3aa838]/10 p-3">
                    <div className="flex items-center gap-1 text-sm font-medium text-[#2f8a2f]">
                      <CheckCircle2 className="h-4 w-4" /> DC uploaded
                    </div>
                    <div className="mt-1 truncate font-mono text-[10px] text-[#2f8a2f]">
                      {dcMediaId}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Delivery verification */}
            {canDeliver && (
              <Card className="overflow-hidden border-[#3aa838]/30 shadow-md ring-2 ring-[#3aa838]/10">
                <SectionHeader
                  icon={Truck}
                  title="Delivery verification"
                  subtitle="Upload signed invoice to complete delivery"
                />
                <CardContent className="space-y-4 p-5">
                  <div className="rounded-lg border border-[#3aa838]/20 bg-[#3aa838]/5 p-3 text-xs text-[#2f8a2f]">
                    Upload the signed invoice. The backend will verify the QR
                    and dealer signature before approving delivery.
                  </div>

                  <UploadTile
                    label="Click to upload signed invoice"
                    hint="PDF or image"
                    onFile={setProofFile}
                  />

                  {proofFile && (
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs">
                      <span className="text-muted-foreground">Selected:</span>{" "}
                      <span className="font-medium">{proofFile.name}</span>
                    </div>
                  )}

                  <Button
                    type="button"
                    className="w-full bg-[#3aa838] text-white hover:bg-[#2f8a2f]"
                    onClick={() => void handleDeliver()}
                    disabled={
                      proofUploading ||
                      savingAction === "deliver" ||
                      !proofFile
                    }
                  >
                    {proofUploading || savingAction === "deliver" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-4 w-4" />
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