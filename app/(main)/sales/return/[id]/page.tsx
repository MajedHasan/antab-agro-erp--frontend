"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";
import QRCode from "qrcode";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileText,
  Loader2,
  PackageCheck,
  PlayCircle,
  Printer,
  RefreshCw,
  Send,
  ShieldAlert,
  Truck,
  Undo2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import GlobalPrintButton from "@/components/common/print/GlobalPrintButton";

/* ------------------------------------------------------------------
   Types
   ------------------------------------------------------------------ */
type ReturnRole =
  | "M.O"
  | "A.M"
  | "R.M"
  | "N.S.M"
  | "WAREHOUSE"
  | "HEAD_ACCOUNT"
  | "";

type SalesReturnStatus =
  | "PENDING_AM"
  | "PENDING_RM"
  | "PENDING_NSM"
  | "READY_FOR_PRINT"
  | "PRINTED"
  | "SENT_TO_WAREHOUSE"
  | "WAREHOUSE_RECEIVED"
  | "HOLD"
  | "RESOLVED"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED";

type QtyField = "amQty" | "rmQty" | "nsmQty" | "warehouseReceivedQty";

type ItemAudit = {
  stage?: string;
  qty?: number;
  remarks?: string;
  actionDate?: string;
  userId?: any;
};

type ReturnItemUI = {
  productId: string;
  productName: string;
  sku?: string;
  soldQty: number;
  soldBonusQty: number;
  requestedQty: number;
  amQty: string;
  rmQty: string;
  nsmQty: string;
  finalApprovedQty: number;
  warehouseReceivedQty: string;
  returnAmountEstimate: number;
  finalReturnAmount: number;
  reason?: string;
  notes?: string;
  status?: string;
  soldLineTotal?: number;
  qtyAuditLogs?: ItemAudit[];
};

type ReturnBlockUI = {
  invoiceId: string;
  invoiceNoSnapshot?: string;
  paymentStatusSnapshot?: string;
  balanceAmountSnapshot?: number;
  grandTotalSnapshot?: number;
  warehouseId?: any;
  items: ReturnItemUI[];
};

type ReturnDoc = {
  _id: string;
  returnNo: string;
  status: SalesReturnStatus;
  customerId?: any;
  invoiceReturns: ReturnBlockUI[];
  approvalLogs?: any[];
  notes?: string;
  printCount?: number;
  totalRequestedAmount?: number;
  totalApprovedAmount?: number;
  totalReceivedAmount?: number;
  dealerDueReductionAmount?: number;
  createdAt?: string;
  updatedAt?: string;
  submittedAt?: string;
  warehouseReceivedAt?: string;
  completedAt?: string;
  resolvedAt?: string;
  holdReason?: string;
  holdRemarks?: string;
  qrCode?: string;
};

type DraftMap = Record<
  string,
  Record<
    string,
    {
      amQty: string;
      rmQty: string;
      nsmQty: string;
      warehouseReceivedQty: string;
    }
  >
>;

/* ------------------------------------------------------------------
   Helpers (preserved)
   ------------------------------------------------------------------ */
const money = (n: number) =>
  Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatDateTime = (value?: string) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDate = (value?: string) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

function statusLabel(status: SalesReturnStatus) {
  switch (status) {
    case "PENDING_AM":
      return "Pending AM";
    case "PENDING_RM":
      return "Pending RM";
    case "PENDING_NSM":
      return "Pending NSM";
    case "READY_FOR_PRINT":
      return "Ready for Print";
    case "PRINTED":
      return "Printed";
    case "SENT_TO_WAREHOUSE":
      return "Sent to Warehouse";
    case "WAREHOUSE_RECEIVED":
      return "Warehouse Received";
    case "HOLD":
      return "Hold";
    case "RESOLVED":
      return "Resolved";
    case "COMPLETED":
      return "Completed";
    case "REJECTED":
      return "Rejected";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

/* 🎨 Palette-locked status colors */
function badgeClass(status: SalesReturnStatus) {
  switch (status) {
    case "COMPLETED":
    case "RESOLVED":
    case "WAREHOUSE_RECEIVED":
      return "bg-[#3aa838]/10 text-[#2f8a2f] border-[#3aa838]/30";
    case "READY_FOR_PRINT":
    case "PRINTED":
    case "SENT_TO_WAREHOUSE":
      return "bg-[#3aa838]/5 text-[#2f8a2f] border-[#3aa838]/20";
    case "PENDING_AM":
    case "PENDING_RM":
    case "PENDING_NSM":
    case "HOLD":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "REJECTED":
    case "CANCELLED":
      return "bg-rose-50 text-rose-700 border-rose-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function workflowStepIndex(status: SalesReturnStatus) {
  switch (status) {
    case "PENDING_AM":
      return 1;
    case "PENDING_RM":
      return 2;
    case "PENDING_NSM":
      return 3;
    case "READY_FOR_PRINT":
    case "PRINTED":
      return 4;
    case "SENT_TO_WAREHOUSE":
      return 5;
    case "WAREHOUSE_RECEIVED":
      return 6;
    case "HOLD":
      return 7;
    case "RESOLVED":
      return 8;
    case "COMPLETED":
      return 9;
    default:
      return 0;
  }
}

function actorFromStatus(status: SalesReturnStatus): ReturnRole {
  if (status === "PENDING_AM") return "A.M";
  if (status === "PENDING_RM") return "R.M";
  if (status === "PENDING_NSM") return "N.S.M";
  if (status === "READY_FOR_PRINT" || status === "PRINTED") return "M.O";
  if (status === "SENT_TO_WAREHOUSE") return "WAREHOUSE";
  if (status === "HOLD") return "HEAD_ACCOUNT";
  if (status === "RESOLVED" || status === "WAREHOUSE_RECEIVED")
    return "HEAD_ACCOUNT";
  return "";
}

function canApprove(status: SalesReturnStatus) {
  return (
    status === "PENDING_AM" ||
    status === "PENDING_RM" ||
    status === "PENDING_NSM"
  );
}

function canReject(status: SalesReturnStatus) {
  return canApprove(status);
}

function canCancel(status: SalesReturnStatus, role: ReturnRole) {
  return (
    role === "M.O" &&
    [
      "PENDING_AM",
      "PENDING_RM",
      "PENDING_NSM",
      "READY_FOR_PRINT",
      "PRINTED",
    ].includes(status)
  );
}

function canPrint(status: SalesReturnStatus, role: ReturnRole) {
  return status === "READY_FOR_PRINT" && role === "M.O";
}

function canMarkPrinted(status: SalesReturnStatus, role: ReturnRole) {
  return status === "READY_FOR_PRINT" && role === "M.O";
}

function canSendToWarehouse(status: SalesReturnStatus, role: ReturnRole) {
  return status === "PRINTED" && role === "M.O";
}

function canWarehouseReceive(status: SalesReturnStatus, role: ReturnRole) {
  return status === "SENT_TO_WAREHOUSE" && role === "WAREHOUSE";
}

function canResolveHold(status: SalesReturnStatus, role: ReturnRole) {
  return status === "HOLD" && role === "HEAD_ACCOUNT";
}

function canComplete(status: SalesReturnStatus, role: ReturnRole) {
  return (
    (status === "RESOLVED" || status === "WAREHOUSE_RECEIVED") &&
    (role === "M.O" || role === "HEAD_ACCOUNT")
  );
}

function currentEditableField(
  status: SalesReturnStatus,
  role: ReturnRole,
): QtyField | null {
  if (status === "PENDING_AM" && role === "A.M") return "amQty";
  if (status === "PENDING_RM" && role === "R.M") return "rmQty";
  if (status === "PENDING_NSM" && role === "N.S.M") return "nsmQty";
  if (status === "SENT_TO_WAREHOUSE" && role === "WAREHOUSE")
    return "warehouseReceivedQty";
  if (status === "HOLD" && role === "HEAD_ACCOUNT")
    return "warehouseReceivedQty";
  return null;
}

function soldPieces(item: ReturnItemUI) {
  return Number(item.soldQty || 0) + Number(item.soldBonusQty || 0);
}

function getStageMax(
  item: ReturnItemUI,
  status: SalesReturnStatus,
  field: QtyField,
) {
  if (field === "amQty") return Number(item.requestedQty || 0);
  if (field === "rmQty") return Number(item.requestedQty || 0);
  if (field === "nsmQty") return soldPieces(item);
  return soldPieces(item);
}

function getItemDisplayStageValue(item: ReturnItemUI, role: ReturnRole) {
  if (role === "A.M") return item.amQty;
  if (role === "R.M") return item.rmQty;
  if (role === "N.S.M") return item.nsmQty;
  if (role === "WAREHOUSE" || role === "HEAD_ACCOUNT")
    return item.warehouseReceivedQty;
  return "";
}

function normalizeReturnDoc(data: any): ReturnDoc {
  return {
    _id: String(data?._id || ""),
    returnNo: String(data?.returnNo || ""),
    status: data?.status || "PENDING_AM",
    customerId: data?.customerId || null,
    approvalLogs: Array.isArray(data?.approvalLogs) ? data.approvalLogs : [],
    notes: data?.notes || "",
    printCount: Number(data?.printCount || 0),
    totalRequestedAmount: Number(data?.totalRequestedAmount || 0),
    totalApprovedAmount: Number(data?.totalApprovedAmount || 0),
    totalReceivedAmount: Number(data?.totalReceivedAmount || 0),
    dealerDueReductionAmount: Number(data?.dealerDueReductionAmount || 0),
    createdAt: data?.createdAt,
    updatedAt: data?.updatedAt,
    submittedAt: data?.submittedAt,
    warehouseReceivedAt: data?.warehouseReceivedAt,
    completedAt: data?.completedAt,
    resolvedAt: data?.resolvedAt,
    holdReason: data?.holdReason,
    holdRemarks: data?.holdRemarks,
    qrCode: data?.qrCode,
    invoiceReturns: (data?.invoiceReturns || []).map((block: any) => ({
      invoiceId: String(block?.invoiceId?._id || block?.invoiceId || ""),
      invoiceNoSnapshot:
        block?.invoiceNoSnapshot || block?.invoiceId?.invoiceNo || "",
      paymentStatusSnapshot:
        block?.paymentStatusSnapshot || block?.invoiceId?.paymentStatus || "",
      balanceAmountSnapshot: Number(
        block?.balanceAmountSnapshot || block?.invoiceId?.balanceAmount || 0,
      ),
      grandTotalSnapshot: Number(
        block?.grandTotalSnapshot || block?.invoiceId?.grandTotal || 0,
      ),
      warehouseId: block?.warehouseId,
      items: (block?.items || []).map((item: any) => {
        const product = item?.productId || {};
        return {
          productId: String(product?._id || item?.productId || ""),
          productName: String(product?.name || item?.productName || "Product"),
          sku: product?.sku || item?.sku || "",
          soldQty: Number(item?.soldQty || 0),
          soldBonusQty: Number(item?.soldBonusQty || 0),
          requestedQty: Number(item?.requestedQty || 0),
          amQty: String(item?.amQty ?? ""),
          rmQty: String(item?.rmQty ?? ""),
          nsmQty: String(item?.nsmQty ?? ""),
          finalApprovedQty: Number(item?.finalApprovedQty || 0),
          warehouseReceivedQty: String(item?.warehouseReceivedQty ?? ""),
          returnAmountEstimate: Number(item?.returnAmountEstimate || 0),
          finalReturnAmount: Number(item?.finalReturnAmount || 0),
          reason: item?.reason || "",
          notes: item?.notes || "",
          status: item?.status || "PENDING",
          soldLineTotal: Number(item?.soldLineTotal || 0),
          qtyAuditLogs: Array.isArray(item?.qtyAuditLogs)
            ? item.qtyAuditLogs
            : [],
        };
      }),
    })),
  };
}

function buildInitialDrafts(doc: ReturnDoc | null): DraftMap {
  if (!doc) return {};
  const drafts: DraftMap = {};
  for (const block of doc.invoiceReturns || []) {
    drafts[block.invoiceId] = {};
    for (const item of block.items || []) {
      drafts[block.invoiceId][item.productId] = {
        amQty: item.amQty ? String(item.amQty) : "",
        rmQty: item.rmQty ? String(item.rmQty) : "",
        nsmQty: item.nsmQty ? String(item.nsmQty) : "",
        warehouseReceivedQty: item.warehouseReceivedQty
          ? String(item.warehouseReceivedQty)
          : "",
      };
    }
  }
  return drafts;
}

/* ------------------------------------------------------------------
   Print builders (preserved verbatim)
   ------------------------------------------------------------------ */
function buildReturnPrintHtml(doc: ReturnDoc, qrImageDataUrl: string): string {
  const dealer = doc.customerId || {};
  const dateFmt = (d: any) =>
    d
      ? new Date(d).toLocaleDateString("en-IN", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "—";

  const itemsHtml = doc.invoiceReturns
    .map((block) => {
      return `
      <div style="margin-top: 16px;">
        <div style="font-size: 14px; font-weight: 700; background: #f1f5f9; padding: 8px 12px; border-radius: 8px; margin-bottom: 8px;">
          Invoice: ${block.invoiceNoSnapshot || "-"} (${block.paymentStatusSnapshot || ""}) – Balance: ৳${money(block.balanceAmountSnapshot || 0)}
        </div>
        <table style="width:100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #f8fafc;">
              <th style="padding:6px 8px; text-align:left;">Product</th>
              <th style="padding:6px 8px; text-align:center;">Sold</th>
              <th style="padding:6px 8px; text-align:center;">Req</th>
              <th style="padding:6px 8px; text-align:center;">Final Approved</th>
              <th style="padding:6px 8px; text-align:center;">Recv'd</th>
              <th style="padding:6px 8px; text-align:right;">Return Amount</th>
            </tr>
          </thead>
          <tbody>
            ${block.items
              .map(
                (item) => `
              <tr style="border-bottom:1px solid #e2e8f0;">
                <td style="padding:6px 8px; font-weight:600;">${item.productName}</td>
                <td style="padding:6px 8px; text-align:center;">${soldPieces(item)}</td>
                <td style="padding:6px 8px; text-align:center;">${item.requestedQty}</td>
                <td style="padding:6px 8px; text-align:center;">${
                  item.finalApprovedQty ||
                  Number(
                    item.nsmQty ||
                      item.rmQty ||
                      item.amQty ||
                      item.requestedQty ||
                      0,
                  )
                }</td>
                <td style="padding:6px 8px; text-align:center;">${
                  item.warehouseReceivedQty || "-"
                }</td>
                <td style="padding:6px 8px; text-align:right; font-weight:700;">৳${money(
                  item.finalReturnAmount || item.returnAmountEstimate || 0,
                )}</td>
              </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>`;
    })
    .join("");

  return `
<div style="font-family: 'Inter', sans-serif; max-width: 100%; margin: 0 auto; color: #1e293b; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.04);">
  <div style="background: linear-gradient(135deg, #0f172a, #1e293b); padding: 18px 28px; display: flex; justify-content: space-between; align-items: center; color: white;">
    <div>
      <div style="font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">SALES RETURN</div>
      <div style="font-size: 13px; opacity: 0.9; margin-top: 2px;">${statusLabel(doc.status)} · ${dealer.name || dealer.proprietor || "-"}</div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 22px; font-weight: 800;">#${doc.returnNo}</div>
      <div style="font-size: 12px; opacity: 0.8;">Date: ${dateFmt(doc.createdAt)}</div>
      ${doc.printCount ? `<div style="font-size: 11px; opacity: 0.7; margin-top: 2px;">Print count: ${doc.printCount}</div>` : ""}
    </div>
  </div>

  <div style="padding: 14px 28px; display: flex; gap: 16px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
    <div style="flex: 1; background: white; border-radius: 10px; padding: 10px 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
      <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700;">Dealer</div>
      <div style="font-weight: 700;">${dealer.name || dealer.proprietor || "-"}</div>
      <div style="font-size: 12px; color: #475569;">${dealer.phoneNumber || dealer.phone || "-"}</div>
    </div>
    <div style="flex: 1; background: white; border-radius: 10px; padding: 10px 14px;">
      <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700;">Totals</div>
      <div style="font-weight: 700;">Req: ৳${money(doc.totalRequestedAmount || 0)}</div>
      <div style="font-size: 12px; color: #475569;">Approved: ৳${money(doc.totalApprovedAmount || 0)} | Received: ৳${money(doc.totalReceivedAmount || 0)}</div>
    </div>
    <div style="flex: 1; background: white; border-radius: 10px; padding: 10px 14px; text-align: center;">
      <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 8px;">QR Code</div>
      ${qrImageDataUrl ? `<img src="${qrImageDataUrl}" alt="QR" style="width:120px; height:120px; border:1px solid #e2e8f0; border-radius:10px;" />` : `<div style="width:120px; height:120px; border:2px dashed #cbd5e1; border-radius:10px; display:inline-flex; align-items:center; justify-content:center; color:#94a3b8; font-size:11px;">QR not ready</div>`}
    </div>
  </div>

  <div style="padding: 16px 28px;">
    ${itemsHtml}
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

function buildReturnPrintHeaderRight(doc: ReturnDoc): string {
  return `
    <div style="text-align:right;">
      <div style="font-size: 20px; font-weight: 800; color: #0f172a;">#${doc.returnNo}</div>
      <div style="font-size: 13px; color: #475569; margin-top: 2px;">${statusLabel(doc.status)}</div>
      <div style="
        display: inline-block; background: ${doc.status === "COMPLETED" ? "#065f46" : doc.status === "CANCELLED" || doc.status === "REJECTED" ? "#b91c1c" : "#1e40af"};
        color: white; padding: 4px 16px; border-radius: 100px; font-size: 13px; margin-top: 8px; font-weight: 700;
      ">${statusLabel(doc.status)}</div>
    </div>`;
}

/* ------------------------------------------------------------------
   Sub-components
   ------------------------------------------------------------------ */
function Stepper({ status }: { status: SalesReturnStatus }) {
  const step = workflowStepIndex(status);
  const steps = [
    { key: 1, label: "AM" },
    { key: 2, label: "RM" },
    { key: 3, label: "NSM" },
    { key: 4, label: "Print" },
    { key: 5, label: "Dispatch" },
    { key: 6, label: "Warehouse" },
    { key: 7, label: "Hold" },
    { key: 8, label: "Resolve" },
    { key: 9, label: "Complete" },
  ];

  return (
    <div className="grid gap-1.5 md:grid-cols-3 xl:grid-cols-9">
      {steps.map((s) => {
        const active = step > 0 && s.key <= step;
        return (
          <div
            key={s.key}
            className={`rounded-lg border px-2 py-1.5 text-center text-[11px] font-medium transition-colors ${
              active
                ? "border-[#3aa838]/30 bg-[#3aa838]/10 text-[#2f8a2f]"
                : "border-slate-200 bg-slate-50 text-slate-500"
            }`}
          >
            {s.label}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------
   Main Page
   ------------------------------------------------------------------ */
export default function SalesReturnActionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const [doc, setDoc] = useState<ReturnDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [remarks, setRemarks] = useState("");
  const [holdReason, setHoldReason] = useState("");
  const [invoiceReturns, setInvoiceReturns] = useState<ReturnBlockUI[]>([]);
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [qrImage, setQrImage] = useState<string>("");

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get(`/sales-returns/${id}`);
      const data = normalizeReturnDoc(res.data?.data || res.data);
      setDoc(data);
      setInvoiceReturns(data.invoiceReturns);
      setDrafts(buildInitialDrafts(data));
      if (data.qrCode) {
        QRCode.toDataURL(data.qrCode, {
          width: 220,
          margin: 2,
          errorCorrectionLevel: "M",
        })
          .then(setQrImage)
          .catch(() => setQrImage(""));
      } else {
        setQrImage("");
      }
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Failed to load sales return.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const refresh = async () => {
    await load();
  };

  const role: ReturnRole = useMemo(() => {
    if (!doc) return "";
    return actorFromStatus(doc.status);
  }, [doc]);

  const editableField = useMemo(() => {
    if (!doc) return null;
    return currentEditableField(doc.status, role);
  }, [doc, role]);

  const totalInvoices = doc?.invoiceReturns?.length || 0;
  const totalProducts =
    doc?.invoiceReturns?.reduce((sum, b) => sum + (b.items?.length || 0), 0) ||
    0;

  const requestedQty = doc?.invoiceReturns?.reduce(
    (sum, b) =>
      sum +
      (b.items || []).reduce((s, i) => s + Number(i.requestedQty || 0), 0),
    0,
  );
  const approvedQty = doc?.invoiceReturns?.reduce(
    (sum, b) =>
      sum +
      (b.items || []).reduce(
        (s, i) =>
          s +
          Number(
            i.finalApprovedQty ||
              i.nsmQty ||
              i.rmQty ||
              i.amQty ||
              i.requestedQty ||
              0,
          ),
        0,
      ),
    0,
  );
  const receivedQty = doc?.invoiceReturns?.reduce(
    (sum, b) =>
      sum +
      (b.items || []).reduce(
        (s, i) => s + Number(i.warehouseReceivedQty || 0),
        0,
      ),
    0,
  );

  const workflowHint = useMemo(() => {
    if (!doc) return "";
    if (doc.status === "PENDING_AM")
      return "A.M should review the created return and enter approved quantities.";
    if (doc.status === "PENDING_RM")
      return "R.M should review the A.M-approved quantities and either approve or reject.";
    if (doc.status === "PENDING_NSM")
      return "N.S.M gives final approval qty. Can go above M.O request but never above sold availability.";
    if (doc.status === "READY_FOR_PRINT")
      return "M.O should print the approved document and mark it printed.";
    if (doc.status === "PRINTED")
      return "M.O should send the printed return to the warehouse/depo incharge.";
    if (doc.status === "SENT_TO_WAREHOUSE")
      return "Warehouse should physically verify items and enter received quantities. Mismatch moves the return to HOLD.";
    if (doc.status === "HOLD")
      return "Head Account should resolve the hold with corrected received quantities.";
    if (doc.status === "RESOLVED")
      return "Head Account or M.O should complete the return.";
    if (doc.status === "WAREHOUSE_RECEIVED") return "Return is ready to be completed.";
    if (doc.status === "COMPLETED") return "Return is fully completed.";
    if (doc.status === "REJECTED") return "Return has been rejected.";
    if (doc.status === "CANCELLED") return "Return has been cancelled.";
    return "";
  }, [doc]);

  const titleAction = useMemo(() => {
    if (!doc) return "No Action";
    if (doc.status === "PENDING_AM") return "Approve as A.M";
    if (doc.status === "PENDING_RM") return "Approve as R.M";
    if (doc.status === "PENDING_NSM") return "Approve as N.S.M";
    if (doc.status === "READY_FOR_PRINT") return "Print";
    if (doc.status === "PRINTED") return "Send to Warehouse";
    if (doc.status === "SENT_TO_WAREHOUSE") return "Warehouse Receive";
    if (doc.status === "HOLD") return "Resolve Hold";
    if (doc.status === "RESOLVED" || doc.status === "WAREHOUSE_RECEIVED")
      return "Complete Return";
    return "No Action";
  }, [doc]);

  const stageLabel = useMemo(() => {
    if (doc?.status === "PENDING_AM") return "A.M Qty";
    if (doc?.status === "PENDING_RM") return "R.M Qty";
    if (doc?.status === "PENDING_NSM") return "N.S.M Qty";
    if (doc?.status === "SENT_TO_WAREHOUSE") return "Warehouse Received Qty";
    if (doc?.status === "HOLD") return "Resolved Qty";
    return "Qty";
  }, [doc]);

  const setDraftValue = (
    invoiceId: string,
    productId: string,
    field: QtyField,
    value: string,
  ) => {
    const cleaned = value.replace(/[^\d]/g, "");
    setDrafts((curr) => ({
      ...curr,
      [invoiceId]: {
        ...(curr[invoiceId] || {}),
        [productId]: {
          ...(curr[invoiceId]?.[productId] || {
            amQty: "",
            rmQty: "",
            nsmQty: "",
            warehouseReceivedQty: "",
          }),
          [field]: cleaned,
        },
      },
    }));
  };

  const buildPayload = () => {
    if (!doc) return [];
    return invoiceReturns.map((block) => ({
      invoiceId: block.invoiceId,
      items: block.items.map((item) => {
        if (doc.status === "SENT_TO_WAREHOUSE" || doc.status === "HOLD") {
          return {
            productId: item.productId,
            receivedQty: Number(
              drafts[block.invoiceId]?.[item.productId]?.warehouseReceivedQty ||
                item.warehouseReceivedQty ||
                item.finalApprovedQty ||
                item.nsmQty ||
                item.rmQty ||
                item.amQty ||
                item.requestedQty ||
                0,
            ),
          };
        }
        const field =
          doc.status === "PENDING_AM"
            ? "amQty"
            : doc.status === "PENDING_RM"
              ? "rmQty"
              : "nsmQty";
        return {
          productId: item.productId,
          qty: Number(
            drafts[block.invoiceId]?.[item.productId]?.[field] ||
              item.amQty ||
              item.rmQty ||
              item.nsmQty ||
              item.requestedQty ||
              0,
          ),
        };
      }),
    }));
  };

  const validateStage = () => {
    if (!doc) return false;
    if (canApprove(doc.status)) return true;
    if (canPrint(doc.status, role)) return true;
    if (canMarkPrinted(doc.status, role)) return true;
    if (canSendToWarehouse(doc.status, role)) return true;
    if (canWarehouseReceive(doc.status, role)) return true;
    if (canResolveHold(doc.status, role)) return true;
    if (canComplete(doc.status, role)) return true;
    if (canCancel(doc.status, role)) return true;
    toast.error("No valid action is available at the current stage.");
    return false;
  };

  const approve = async () => {
    if (!doc) return;
    if (!validateStage()) return;
    if (!canApprove(doc.status)) {
      toast.error("This return is not waiting for approval.");
      return;
    }
    const stageField =
      doc.status === "PENDING_AM"
        ? "amQty"
        : doc.status === "PENDING_RM"
          ? "rmQty"
          : "nsmQty";

    for (const block of doc.invoiceReturns) {
      for (const item of block.items) {
        const value =
          Number(drafts[block.invoiceId]?.[item.productId]?.[stageField] || 0) ||
          0;
        if (value <= 0) {
          toast.error(
            `${item.productName}: ${stageLabel} must be greater than zero.`,
          );
          return;
        }
        const max = getStageMax(item, doc.status, stageField as QtyField);
        if (value > max) {
          toast.error(
            `${item.productName}: ${stageLabel} cannot exceed ${max}.`,
          );
          return;
        }
      }
    }

    setBusy(true);
    try {
      await api.post(`/sales-returns/${doc._id}/approve`, {
        role,
        remarks: remarks || undefined,
        invoiceReturns: buildPayload(),
      });
      toast.success("Approved successfully.");
      await refresh();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Approval failed.",
      );
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!doc) return;
    if (!validateStage()) return;
    if (!canReject(doc.status)) {
      toast.error("This return cannot be rejected at the current stage.");
      return;
    }
    if (!window.confirm("Reject this sales return?")) return;

    setBusy(true);
    try {
      await api.post(`/sales-returns/${doc._id}/reject`, {
        role,
        remarks: remarks || undefined,
      });
      toast.success("Rejected successfully.");
      await refresh();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Reject failed.",
      );
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!doc) return;
    if (!canCancel(doc.status, role)) {
      toast.error("Cancel is only available for M.O before dispatch.");
      return;
    }
    if (!window.confirm("Cancel this sales return?")) return;

    setBusy(true);
    try {
      await api.post(`/sales-returns/${doc._id}/cancel`, {
        remarks: remarks || undefined,
      });
      toast.success("Sales return cancelled.");
      await refresh();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Cancel failed.",
      );
    } finally {
      setBusy(false);
    }
  };

  const markPrinted = async () => {
    if (!doc) return;
    if (!canMarkPrinted(doc.status, role)) {
      toast.error("Mark printed is only available for M.O at READY_FOR_PRINT.");
      return;
    }
    setBusy(true);
    try {
      await api.post(`/sales-returns/${doc._id}/printed`);
      toast.success("Marked as printed.");
      await refresh();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Mark printed failed.",
      );
    } finally {
      setBusy(false);
    }
  };

  const sendToWarehouse = async () => {
    if (!doc) return;
    if (!canSendToWarehouse(doc.status, role)) {
      toast.error("Send to warehouse is only available after printing.");
      return;
    }
    setBusy(true);
    try {
      await api.post(`/sales-returns/${doc._id}/send-to-warehouse`, {
        remarks: remarks || undefined,
      });
      toast.success("Sent to warehouse.");
      await refresh();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Send to warehouse failed.",
      );
    } finally {
      setBusy(false);
    }
  };

  const warehouseReceive = async () => {
    if (!doc) return;
    if (!canWarehouseReceive(doc.status, role)) {
      toast.error("Warehouse receive is only available at SENT_TO_WAREHOUSE.");
      return;
    }
    for (const block of doc.invoiceReturns) {
      for (const item of block.items) {
        const value = Number(
          drafts[block.invoiceId]?.[item.productId]?.warehouseReceivedQty || 0,
        );
        if (value <= 0) {
          toast.error(
            `${item.productName}: received qty must be greater than zero.`,
          );
          return;
        }
        const max = soldPieces(item);
        if (value > max) {
          toast.error(
            `${item.productName}: received qty cannot exceed sold qty (${max}).`,
          );
          return;
        }
      }
    }

    setBusy(true);
    try {
      await api.post(`/sales-returns/${doc._id}/warehouse-receive`, {
        remarks: remarks || undefined,
        holdReason: holdReason || undefined,
        invoiceReturns: buildPayload(),
      });
      toast.success("Warehouse verification submitted.");
      await refresh();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Warehouse receive failed.",
      );
    } finally {
      setBusy(false);
    }
  };

  const resolveHold = async () => {
    if (!doc) return;
    if (!canResolveHold(doc.status, role)) {
      toast.error(
        "Resolve hold is only available for Head Account when status is HOLD.",
      );
      return;
    }
    setBusy(true);
    try {
      await api.post(`/sales-returns/${doc._id}/resolve-hold`, {
        remarks: remarks || undefined,
        invoiceReturns: buildPayload(),
      });
      toast.success("Hold resolved.");
      await refresh();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Resolve hold failed.",
      );
    } finally {
      setBusy(false);
    }
  };

  const resolveAndComplete = async () => {
    if (!doc) return;
    if (!canResolveHold(doc.status, role)) {
      toast.error(
        "Resolve & complete is only available for Head Account when status is HOLD.",
      );
      return;
    }
    setBusy(true);
    try {
      await api.post(`/sales-returns/${doc._id}/resolve-hold`, {
        remarks: remarks || undefined,
        invoiceReturns: buildPayload(),
      });
      await api.post(`/sales-returns/${doc._id}/complete`, {
        remarks: remarks || "Resolved and completed",
      });
      toast.success("Hold resolved and return completed.");
      await refresh();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Resolve & complete failed.",
      );
    } finally {
      setBusy(false);
    }
  };

  const complete = async () => {
    if (!doc) return;
    if (!canComplete(doc.status, role)) {
      toast.error(
        "Complete is only available after warehouse completion or hold resolution.",
      );
      return;
    }
    setBusy(true);
    try {
      await api.post(`/sales-returns/${doc._id}/complete`, {
        remarks: remarks || undefined,
      });
      toast.success("Sales return completed.");
      await refresh();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Complete failed.",
      );
    } finally {
      setBusy(false);
    }
  };

  const resetLocalInputs = () => {
    if (!doc) return;
    setDrafts(buildInitialDrafts(doc));
    setRemarks("");
    setHoldReason("");
    toast.message("Inputs reset.");
  };

  /* ------------------- Loading / not found ------------------- */
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading sales return...
        </div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Card className="w-full max-w-lg">
          <CardContent className="p-8 text-center">
            <div className="text-lg font-semibold">Sales return not found</div>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => router.push("/sales/return")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to list
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ------------------- Render ------------------- */
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl p-3 md:p-4">
        {/* ============ HERO ============ */}
        <div className="relative mb-3 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-[#1a4d1a] p-5 text-white shadow-lg">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(58,168,56,0.25),transparent_55%)]" />
          <div className="relative">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => router.push("/sales/return")}
                  className="border border-white/20 bg-white/10 text-white hover:bg-white/20"
                >
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                  Back to list
                </Button>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#3aa838]/25 ring-1 ring-[#3aa838]/40">
                    <Undo2 className="h-5 w-5 text-[#7cd67a]" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-wider text-white/60">
                      Sales Return
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight tabular-nums">
                      {doc.returnNo}
                    </h1>
                  </div>
                  <Badge className={`${badgeClass(doc.status)} border`}>
                    {statusLabel(doc.status)}
                  </Badge>
                </div>

                <div className="mt-2 text-sm text-white/70">
                  <span className="font-medium text-white">
                    {doc.customerId?.name || "-"}
                  </span>
                  {doc.customerId?.phoneNumber && (
                    <> · {doc.customerId.phoneNumber}</>
                  )}
                  {" · "}Created {formatDate(doc.createdAt)}
                </div>
              </div>

              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void refresh()}
                  className="border border-white/20 bg-white/10 text-white hover:bg-white/20"
                >
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Refresh
                </Button>
              </div>
            </div>

            {/* Inline stat pills */}
            <div className="mt-4 flex flex-wrap gap-2">
              <div className="rounded-lg bg-white/10 px-3 py-2 ring-1 ring-white/15 backdrop-blur-sm">
                <div className="text-[10px] uppercase tracking-wide text-white/60">
                  Invoices
                </div>
                <div className="text-sm font-semibold tabular-nums">
                  {totalInvoices}
                </div>
              </div>
              <div className="rounded-lg bg-white/10 px-3 py-2 ring-1 ring-white/15 backdrop-blur-sm">
                <div className="text-[10px] uppercase tracking-wide text-white/60">
                  Products
                </div>
                <div className="text-sm font-semibold tabular-nums">
                  {totalProducts}
                </div>
              </div>
              <div className="rounded-lg bg-white/10 px-3 py-2 ring-1 ring-white/15 backdrop-blur-sm">
                <div className="text-[10px] uppercase tracking-wide text-white/60">
                  Qty
                </div>
                <div className="text-sm font-semibold tabular-nums">
                  {requestedQty} → {approvedQty} → {receivedQty}
                </div>
              </div>
              <div className="rounded-lg bg-[#3aa838] px-3 py-2 shadow-md shadow-black/40">
                <div className="text-[10px] uppercase tracking-wide text-[#c6e8c5]">
                  Requested
                </div>
                <div className="text-sm font-bold tabular-nums">
                  ৳ {money(Number(doc.totalRequestedAmount || 0))}
                </div>
              </div>
              <div className="rounded-lg bg-[#3aa838] px-3 py-2 shadow-md shadow-black/40">
                <div className="text-[10px] uppercase tracking-wide text-[#c6e8c5]">
                  Approved
                </div>
                <div className="text-sm font-bold tabular-nums">
                  ৳ {money(Number(doc.totalApprovedAmount || 0))}
                </div>
              </div>
              <div className="rounded-lg bg-[#3aa838] px-3 py-2 shadow-md shadow-black/40">
                <div className="text-[10px] uppercase tracking-wide text-[#c6e8c5]">
                  Received
                </div>
                <div className="text-sm font-bold tabular-nums">
                  ৳ {money(Number(doc.totalReceivedAmount || 0))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ============ STEPPER + WORKFLOW HINT ============ */}
        <div className="mb-4 space-y-2">
          <Stepper status={doc.status} />
          <div
            className={`rounded-lg border px-3 py-2 text-xs ${
              doc.status === "HOLD"
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-slate-200 bg-white text-slate-700"
            }`}
          >
            {workflowHint}
          </div>
        </div>

        {/* ============ MAIN GRID ============ */}
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          {/* ----- LEFT: Invoice cards ----- */}
          <div className="space-y-4">
            {doc.invoiceReturns.map((block, blockIndex) => {
              const blockRequested = block.items.reduce(
                (sum, item) => sum + Number(item.requestedQty || 0),
                0,
              );
              const blockApproved = block.items.reduce(
                (sum, item) =>
                  sum +
                  Number(
                    item.finalApprovedQty ||
                      item.nsmQty ||
                      item.rmQty ||
                      item.amQty ||
                      item.requestedQty ||
                      0,
                  ),
                0,
              );
              const blockReceived = block.items.reduce(
                (sum, item) => sum + Number(item.warehouseReceivedQty || 0),
                0,
              );

              return (
                <Card
                  key={`${block.invoiceId}-${blockIndex}`}
                  className="overflow-hidden border-slate-200 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#3aa838]/10">
                        <FileText className="h-4 w-4 text-[#3aa838]" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-mono text-sm font-semibold text-slate-900">
                          {block.invoiceNoSnapshot || "Invoice"}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {block.paymentStatusSnapshot || "-"} · Balance ৳{" "}
                          {money(Number(block.balanceAmountSnapshot || 0))} ·
                          Warehouse{" "}
                          {String(
                            block.warehouseId?.name || block.warehouseId || "-",
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-center">
                        <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
                          Req
                        </div>
                        <div className="text-xs font-semibold tabular-nums">
                          {blockRequested}
                        </div>
                      </div>
                      <div className="rounded-md border border-[#3aa838]/30 bg-[#3aa838]/5 px-2 py-1 text-center">
                        <div className="text-[9px] uppercase tracking-wide text-[#2f8a2f]">
                          Appr
                        </div>
                        <div className="text-xs font-semibold tabular-nums text-[#2f8a2f]">
                          {blockApproved}
                        </div>
                      </div>
                      <div className="rounded-md border border-[#3aa838]/30 bg-[#3aa838]/5 px-2 py-1 text-center">
                        <div className="text-[9px] uppercase tracking-wide text-[#2f8a2f]">
                          Recv
                        </div>
                        <div className="text-xs font-semibold tabular-nums text-[#2f8a2f]">
                          {blockReceived}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-hidden">
                    {/* Header row */}
                    <div className="grid grid-cols-12 gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                      <div className="col-span-4">Product</div>
                      <div className="col-span-1 text-center">Sold</div>
                      <div className="col-span-1 text-center">Req</div>
                      <div className="col-span-2 text-center">{stageLabel}</div>
                      <div className="col-span-2 text-center">Final</div>
                      <div className="col-span-2 text-right">Amount</div>
                    </div>

                    <div className="divide-y divide-slate-100 bg-white">
                      {block.items.map((item) => {
                        const field = editableField;
                        const stageValue =
                          field && drafts[block.invoiceId]?.[item.productId]
                            ? drafts[block.invoiceId][item.productId][field]
                            : getItemDisplayStageValue(item, role);

                        const stageMax = field
                          ? getStageMax(item, doc.status, field)
                          : 0;

                        return (
                          <div
                            key={item.productId}
                            className="px-3 py-2 transition-colors hover:bg-slate-50/40"
                          >
                            <div className="grid grid-cols-12 items-center gap-2">
                              <div className="col-span-12 md:col-span-4">
                                <div className="text-sm font-medium text-slate-900">
                                  {item.productName || "Product"}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {item.sku ? `SKU: ${item.sku}` : ""}
                                  {item.reason
                                    ? `${item.sku ? " · " : ""}Reason: ${item.reason}`
                                    : ""}
                                </div>
                              </div>

                              <div className="col-span-4 text-center md:col-span-1">
                                <div className="text-sm font-semibold tabular-nums text-slate-900">
                                  {soldPieces(item)}
                                </div>
                                <div className="text-[9px] uppercase text-muted-foreground md:hidden">
                                  Sold
                                </div>
                              </div>

                              <div className="col-span-4 text-center md:col-span-1">
                                <div className="text-sm font-semibold tabular-nums text-slate-900">
                                  {Number(item.requestedQty || 0)}
                                </div>
                                <div className="text-[9px] uppercase text-muted-foreground md:hidden">
                                  Req
                                </div>
                              </div>

                              <div className="col-span-12 md:col-span-2">
                                {field ? (
                                  <div className="space-y-1">
                                    <Input
                                      inputMode="numeric"
                                      value={stageValue || ""}
                                      onChange={(e) =>
                                        setDraftValue(
                                          block.invoiceId,
                                          item.productId,
                                          field,
                                          e.target.value,
                                        )
                                      }
                                      placeholder="0"
                                      className="h-9 text-center text-sm font-semibold tabular-nums focus-visible:ring-[#3aa838]"
                                    />
                                    <div className="text-center text-[10px] text-muted-foreground">
                                      Max {stageMax}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-center text-sm font-semibold tabular-nums text-slate-900">
                                    {getItemDisplayStageValue(item, role)
                                      ? Number(
                                          getItemDisplayStageValue(item, role),
                                        )
                                      : "—"}
                                  </div>
                                )}
                              </div>

                              <div className="col-span-6 text-center md:col-span-2">
                                <div className="text-sm font-semibold tabular-nums text-[#2f8a2f]">
                                  {Number(
                                    item.finalApprovedQty ||
                                      item.nsmQty ||
                                      item.rmQty ||
                                      item.amQty ||
                                      item.requestedQty ||
                                      0,
                                  )}
                                </div>
                                <div className="text-[9px] uppercase text-muted-foreground md:hidden">
                                  Final
                                </div>
                              </div>

                              <div className="col-span-6 text-right md:col-span-2">
                                <div className="text-sm font-semibold tabular-nums text-slate-900">
                                  ৳{" "}
                                  {money(
                                    Number(
                                      item.finalReturnAmount ||
                                        item.returnAmountEstimate ||
                                        0,
                                    ),
                                  )}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  Recv{" "}
                                  {Number(item.warehouseReceivedQty || 0) ||
                                    "—"}
                                </div>
                              </div>
                            </div>

                            <details className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                              <summary className="cursor-pointer text-[11px] font-medium text-slate-700">
                                Audit trail ({(item.qtyAuditLogs || []).length})
                              </summary>
                              <div className="mt-2 space-y-1.5">
                                {(item.qtyAuditLogs || []).length ? (
                                  item.qtyAuditLogs!.map((log, idx) => (
                                    <div
                                      key={idx}
                                      className="rounded-md border border-slate-200 bg-white p-2 text-[11px]"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="font-medium text-slate-800">
                                          {log.stage || "-"} · Qty{" "}
                                          {log.qty ?? "-"}
                                        </div>
                                        <div className="text-muted-foreground">
                                          {formatDateTime(log.actionDate)}
                                        </div>
                                      </div>
                                      <div className="mt-0.5 text-muted-foreground">
                                        {log.remarks || "No remarks"}
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-[11px] text-muted-foreground">
                                    No audit logs yet.
                                  </div>
                                )}
                              </div>
                            </details>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* ----- RIGHT: sticky sidebar ----- */}
          <div className="h-fit space-y-4 xl:sticky xl:top-4">
            {/* Action panel */}
            <Card className="overflow-hidden border-slate-200 shadow-md">
              <CardHeader className="border-b border-slate-200 py-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#3aa838]/10">
                    <ShieldAlert className="h-3.5 w-3.5 text-[#3aa838]" />
                  </div>
                  Action panel
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Workflow actor
                  </div>
                  <div className="mt-0.5 text-base font-semibold text-slate-900">
                    {role || "-"}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {workflowHint}
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-[11px]">
                    <Clock3 className="h-3 w-3 text-slate-500" />
                    Status:{" "}
                    <Badge className={`${badgeClass(doc.status)} border text-[10px]`}>
                      {statusLabel(doc.status)}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-medium text-slate-600">
                    Remarks
                  </div>
                  <Textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Remarks for this action..."
                    className="min-h-[70px] text-xs focus-visible:ring-[#3aa838]"
                  />
                </div>

                {doc.status === "HOLD" ? (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-slate-600">
                      Hold reason
                    </div>
                    <Input
                      value={holdReason}
                      onChange={(e) => setHoldReason(e.target.value)}
                      placeholder="Reason for hold..."
                      className="h-9 text-xs focus-visible:ring-[#3aa838]"
                    />
                  </div>
                ) : null}

                <div className="space-y-2">
                  {(doc.status === "PENDING_AM" ||
                    doc.status === "PENDING_RM" ||
                    doc.status === "PENDING_NSM") && (
                    <>
                      <Button
                        className="w-full bg-[#3aa838] text-white hover:bg-[#2f8a2f]"
                        onClick={approve}
                        disabled={busy}
                      >
                        {busy ? (
                          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="mr-1.5 h-4 w-4" />
                        )}
                        {titleAction}
                      </Button>
                      <Button
                        className="w-full text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        variant="outline"
                        onClick={reject}
                        disabled={busy}
                      >
                        <CircleAlert className="mr-1.5 h-4 w-4" />
                        Reject at {role}
                      </Button>
                      {canCancel(doc.status, role) && (
                        <Button
                          className="w-full"
                          variant="outline"
                          onClick={cancel}
                          disabled={busy}
                        >
                          <Ban className="mr-1.5 h-4 w-4" />
                          Cancel return
                        </Button>
                      )}
                    </>
                  )}

                  {doc.status === "READY_FOR_PRINT" && role === "M.O" && (
                    <>
                      <GlobalPrintButton
                        contentHtml={buildReturnPrintHtml(doc, qrImage)}
                        headerRightHtml={buildReturnPrintHeaderRight(doc)}
                        label="Print Return"
                        title="Sales Return"
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
                      <Button
                        className="w-full bg-[#3aa838] text-white hover:bg-[#2f8a2f]"
                        onClick={markPrinted}
                        disabled={busy}
                      >
                        <Printer className="mr-1.5 h-4 w-4" />
                        Mark printed
                      </Button>
                    </>
                  )}

                  {doc.status === "PRINTED" && role === "M.O" && (
                    <Button
                      className="w-full bg-[#3aa838] text-white hover:bg-[#2f8a2f]"
                      onClick={sendToWarehouse}
                      disabled={busy}
                    >
                      <Send className="mr-1.5 h-4 w-4" />
                      Send to warehouse
                    </Button>
                  )}

                  {doc.status === "SENT_TO_WAREHOUSE" &&
                    role === "WAREHOUSE" && (
                      <Button
                        className="w-full bg-[#3aa838] text-white hover:bg-[#2f8a2f]"
                        onClick={warehouseReceive}
                        disabled={busy}
                      >
                        <Truck className="mr-1.5 h-4 w-4" />
                        Receive & validate
                      </Button>
                    )}

                  {doc.status === "HOLD" && role === "HEAD_ACCOUNT" && (
                    <>
                      <Button
                        className="w-full bg-[#3aa838] text-white hover:bg-[#2f8a2f]"
                        onClick={resolveAndComplete}
                        disabled={busy}
                      >
                        <PlayCircle className="mr-1.5 h-4 w-4" />
                        Resolve & complete
                      </Button>
                      <Button
                        className="w-full border-[#3aa838]/40 text-[#2f8a2f] hover:bg-[#3aa838]/5 hover:text-[#2f8a2f]"
                        variant="outline"
                        onClick={resolveHold}
                        disabled={busy}
                      >
                        <ShieldAlert className="mr-1.5 h-4 w-4" />
                        Resolve hold only
                      </Button>
                    </>
                  )}

                  {(doc.status === "RESOLVED" ||
                    doc.status === "WAREHOUSE_RECEIVED") &&
                    (role === "M.O" || role === "HEAD_ACCOUNT") && (
                      <Button
                        className="w-full bg-[#3aa838] text-white hover:bg-[#2f8a2f]"
                        onClick={complete}
                        disabled={busy}
                      >
                        <PackageCheck className="mr-1.5 h-4 w-4" />
                        Complete return
                      </Button>
                    )}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-xs text-slate-500"
                  onClick={resetLocalInputs}
                >
                  Reset typed quantities
                </Button>
              </CardContent>
            </Card>

            {/* Summary */}
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-200 py-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#3aa838]/10">
                    <FileText className="h-3.5 w-3.5 text-[#3aa838]" />
                  </div>
                  Return summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Dealer</span>
                  <span className="font-medium truncate max-w-[180px]">
                    {doc.customerId?.name || "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Phone</span>
                  <span className="font-medium">
                    {doc.customerId?.phoneNumber || "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Requested</span>
                  <span className="font-semibold tabular-nums text-slate-900">
                    ৳ {money(Number(doc.totalRequestedAmount || 0))}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Approved</span>
                  <span className="font-semibold tabular-nums text-[#2f8a2f]">
                    ৳ {money(Number(doc.totalApprovedAmount || 0))}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Received</span>
                  <span className="font-semibold tabular-nums text-[#2f8a2f]">
                    ৳ {money(Number(doc.totalReceivedAmount || 0))}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Print count</span>
                  <span className="font-medium tabular-nums">
                    {doc.printCount || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span className="font-medium">
                    {formatDate(doc.createdAt)}
                  </span>
                </div>
                {doc.holdReason && (
                  <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                    <div className="font-medium">Hold reason</div>
                    <div className="mt-0.5">{doc.holdReason}</div>
                    {doc.holdRemarks && (
                      <div className="mt-0.5 text-[11px]">
                        {doc.holdRemarks}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Logs */}
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-200 py-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#3aa838]/10">
                    <Clock3 className="h-3.5 w-3.5 text-[#3aa838]" />
                  </div>
                  Recent logs
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-4">
                {(doc.approvalLogs || [])
                  .slice()
                  .reverse()
                  .slice(0, 8)
                  .map((log, idx) => {
                    const approved = log?.status === "APPROVED";
                    return (
                      <div
                        key={idx}
                        className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-slate-900">
                              {log.role || "-"}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                approved
                                  ? "bg-[#3aa838]/10 text-[#2f8a2f]"
                                  : log?.status === "REJECTED"
                                    ? "bg-rose-50 text-rose-700"
                                    : "bg-amber-50 text-amber-700"
                              }`}
                            >
                              {log.status || "-"}
                            </span>
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {formatDateTime(log.actionDate)}
                          </div>
                        </div>
                        <div className="mt-1 text-muted-foreground">
                          {log.remarks || "No remarks"}
                        </div>
                      </div>
                    );
                  })}
                {!(doc.approvalLogs || []).length && (
                  <div className="text-xs text-muted-foreground">
                    No logs yet.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}