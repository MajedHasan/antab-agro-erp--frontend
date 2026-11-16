// app/inventory/product-transfer/[id]/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import GlobalPrintButton from "@/components/common/print/GlobalPrintButton";
import {
  ArrowLeft,
  Check,
  RefreshCw,
  FileText,
  Loader2,
  ExternalLink,
  ArrowRightLeft,
  Factory,
  Building2,
  Inbox,
  Package,
  DollarSign,
  Clock3,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

import Protected from "@/components/auth/Protected";
import usePermissionCheck from "@/hooks/usePermissionCheck";

/* =========================== Types =========================== */
type TransferStatus =
  | "REQUESTED"
  | "RECEIVER_NSM_APPROVED"
  | "SENDER_REVIEWED"
  | "SENDER_NSM_APPROVED"
  | "SENT"
  | "HOLD"
  | "AWAITING_REMAINING"
  | "COMPLETED";

type TransferType = "WAREHOUSE_TO_WAREHOUSE" | "FACTORY_TO_WAREHOUSE";
type TransferMode = "REQUEST" | "DIRECT";

type TransferItem = {
  productId: any;
  requestedQty: number;
  finalQty: number;
  receivedQty?: number;
  unit?: string;
  costPrice?: number;
  qtyHistory?: {
    stage: string;
    qty: number;
    changedBy?: any;
    changedAt?: string;
    note?: string;
  }[];
};

type TransferDoc = {
  _id: string;
  transferNo: string;
  transferType: TransferType;
  transferMode: TransferMode;
  status: TransferStatus;
  locked?: boolean;
  voucherId?: string;

  sender?: any;
  receiver?: any;
  createdBy?: any;

  items: TransferItem[];

  receiverNsmApprovedBy?: any;
  senderReviewedBy?: any;
  senderNsmApprovedBy?: any;
  dispatchedBy?: any;
  receivedBy?: any;

  receiverNsmApprovedAt?: string;
  senderReviewedAt?: string;
  senderNsmApprovedAt?: string;
  dispatchedAt?: string;
  receivedAt?: string;

  printSnapshot?: any;
  documents?: {
    signed?: {
      mediaId?: any;
      uploadedBy?: any;
      uploadedAt?: string;
    };
    damage?: {
      mediaId?: any;
      uploadedBy?: any;
      uploadedByName?: string;
      uploadedAt?: string;
      reason?: string;
    };
  };

  approvalLogs?: {
    actionBy?: any;
    role?: string;
    status?: string;
    remarks?: string;
    actionAt?: string;
  }[];

  createdAt?: string;
  updatedAt?: string;
};

/* =========================== Config =========================== */
const STATUS_TONE: Record<TransferStatus, string> = {
  REQUESTED:
    "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
  RECEIVER_NSM_APPROVED:
    "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900/60",
  SENDER_REVIEWED:
    "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900/60",
  SENDER_NSM_APPROVED:
    "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/60",
  SENT:
    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60",
  HOLD:
    "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900/60",
  AWAITING_REMAINING:
    "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900/60",
  COMPLETED:
    "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60",
};

/* =========================== Helpers =========================== */
function getName(loc: any) {
  return (
    loc?.name || loc?.warehouseName || loc?.factoryName || loc?.code || "-"
  );
}

function getKind(loc: any) {
  const t = String(loc?.type || loc?.kind || loc?.entityType || "").toLowerCase();
  if (t.includes("factory")) return "Factory";
  if (t.includes("warehouse")) return "Warehouse";
  return "Location";
}

function currency(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function hasPartialReceipt(transfer: TransferDoc): boolean {
  return transfer.items.some(
    (item) =>
      (item.receivedQty || 0) > 0 && (item.receivedQty || 0) < item.finalQty,
  );
}

function getWorkflowLabels(transfer: TransferDoc): string[] {
  const t = transfer;
  const includeHoldSteps =
    t.status === "HOLD" ||
    t.status === "AWAITING_REMAINING" ||
    (t.status === "COMPLETED" && hasPartialReceipt(t));

  if (t.transferMode === "DIRECT") {
    const base = ["Factory Created", "Sent"];
    if (includeHoldSteps) base.push("Hold", "Awaiting Remaining");
    base.push("Completed");
    return base;
  }

  if (
    t.transferType === "FACTORY_TO_WAREHOUSE" &&
    t.transferMode === "REQUEST"
  ) {
    const base = ["Requested", "Receiver NSM", "Sent"];
    if (includeHoldSteps) base.push("Hold", "Awaiting Remaining");
    base.push("Completed");
    return base;
  }

  const base = ["Requested", "Sent"];
  if (includeHoldSteps) base.push("Hold", "Awaiting Remaining");
  base.push("Completed");
  return base;
}

function getWorkflowStatuses(transfer: TransferDoc): TransferStatus[] {
  const labels = getWorkflowLabels(transfer);
  const map: Record<string, TransferStatus> = {
    "Factory Created": "REQUESTED",
    Requested: "REQUESTED",
    "Receiver NSM": "RECEIVER_NSM_APPROVED",
    "Sender Review": "SENDER_REVIEWED",
    "Sender NSM": "SENDER_NSM_APPROVED",
    Sent: "SENT",
    Hold: "HOLD",
    "Awaiting Remaining": "AWAITING_REMAINING",
    Completed: "COMPLETED",
  };
  return labels.map((l) => map[l] || "REQUESTED");
}

function getStatusMeta(transfer: TransferDoc | null) {
  if (!transfer)
    return {
      label: "-",
      tone: "bg-slate-100 text-slate-800 border-slate-200",
      hint: "",
    };
  const tone = STATUS_TONE[transfer.status] || STATUS_TONE.REQUESTED;
  const map: Record<TransferStatus, { label: string; hint: string }> = {
    REQUESTED: { label: "Requested", hint: "Transfer created" },
    RECEIVER_NSM_APPROVED: {
      label: "Receiver NSM Approved",
      hint:
        transfer.transferType === "WAREHOUSE_TO_WAREHOUSE"
          ? "Waiting for sender review"
          : "Waiting for dispatch",
    },
    SENDER_REVIEWED: {
      label: "Sender Reviewed",
      hint: "Waiting for sender NSM approval",
    },
    SENDER_NSM_APPROVED: {
      label: "Sender NSM Approved",
      hint: "Ready to print and send",
    },
    SENT: { label: "Sent", hint: "Waiting for receiver to receive" },
    HOLD: { label: "Hold", hint: "Received quantities don't match final qty" },
    AWAITING_REMAINING: {
      label: "Awaiting Remaining",
      hint: "Received qty processed, awaiting remaining resolution",
    },
    COMPLETED: { label: "Completed", hint: "Transfer completed" },
  };
  return { ...map[transfer.status], tone };
}

function currentWorkflowStep(transfer: TransferDoc): number {
  const statuses = getWorkflowStatuses(transfer);
  const idx = statuses.indexOf(transfer.status);
  return idx >= 0 ? idx + 1 : 0;
}

function canEditQty(transfer: TransferDoc | null) {
  return (
    transfer?.transferType === "FACTORY_TO_WAREHOUSE" &&
    transfer?.transferMode === "DIRECT" &&
    transfer?.status === "REQUESTED"
  );
}

function canDispatch(transfer: TransferDoc | null) {
  if (!transfer) return false;
  if (transfer.transferType === "WAREHOUSE_TO_WAREHOUSE")
    return transfer.status === "SENDER_NSM_APPROVED";
  if (transfer.transferMode === "REQUEST")
    return transfer.status === "RECEIVER_NSM_APPROVED";
  return transfer.status === "REQUESTED";
}

function canPrint(transfer: TransferDoc | null) {
  if (!transfer) return false;
  if (transfer.transferType === "WAREHOUSE_TO_WAREHOUSE")
    return ["SENDER_NSM_APPROVED", "SENT", "COMPLETED"].includes(
      transfer.status,
    );
  if (transfer.transferMode === "REQUEST")
    return ["RECEIVER_NSM_APPROVED", "SENT", "COMPLETED"].includes(
      transfer.status,
    );
  return ["REQUESTED", "SENT", "COMPLETED"].includes(transfer.status);
}

/* ---------- print helpers ---------- */
function getMediaPreviewUrl(mediaId?: any) {
  if (!mediaId) return "";
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";
  const url = typeof mediaId === "string" ? "" : mediaId?.url || "";
  return url ? `${base}${url}` : "";
}

function buildTransferPrintHeaderRight(transfer: TransferDoc): string {
  const meta = getStatusMeta(transfer);
  return `
    <div style="text-align:right;">
      <div style="font-size: 20px; font-weight: 800; color: #0f172a;">#${transfer.transferNo}</div>
      <div style="font-size: 13px; color: #475569; margin-top: 2px;">
        ${transfer.transferType === "WAREHOUSE_TO_WAREHOUSE" ? "Warehouse ⇄ Warehouse" : "Factory → Warehouse"}
        · ${transfer.transferMode}
      </div>
      <div style="
        display: inline-block; background: ${meta.tone.includes("emerald") ? "#065f46" : meta.tone.includes("amber") ? "#92400e" : meta.tone.includes("red") ? "#b91c1c" : "#1e40af"};
        color: white; padding: 4px 16px; border-radius: 100px; font-size: 13px; margin-top: 8px; font-weight: 700;
      ">${meta.label}</div>
    </div>`;
}

function buildTransferPrintHtml(transfer: TransferDoc): string {
  const snapshot = transfer.printSnapshot;
  const items = transfer.items;
  const transferNo = transfer.transferNo;
  const senderName = snapshot?.sender?.name || getName(transfer.sender);
  const receiverName = snapshot?.receiver?.name || getName(transfer.receiver);
  const senderKind = getKind(transfer.sender);
  const receiverKind = getKind(transfer.receiver);
  const senderCode = transfer.sender?.code || "";
  const receiverCode = transfer.receiver?.code || "";
  const dateFmt = (d: any) =>
    d
      ? new Date(d).toLocaleDateString("en-IN", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "—";

  const statuses = getWorkflowStatuses(transfer);
  const labels = getWorkflowLabels(transfer);
  const currentIdx = statuses.indexOf(transfer.status);
  const workflowHtml = labels
    .map((label, i) => {
      const done = i < currentIdx || transfer.status === "COMPLETED";
      const active = i === currentIdx && transfer.status !== "COMPLETED";
      return `
      <div style="display:flex; align-items:center; gap:4px;">
        <div style="
          width:22px; height:22px; border-radius:50%;
          background:${done ? "#16a34a" : active ? "#0f172a" : "#f1f5f9"};
          color:${done || active ? "white" : "#94a3b8"};
          display:flex; align-items:center; justify-content:center;
          font-size:11px; font-weight:700;
          border:2px solid ${done ? "#16a34a" : active ? "#0f172a" : "#e2e8f0"};
        ">${done ? "✓" : i + 1}</div>
        <span style="font-size:11px; font-weight:600; color:${done ? "#065f46" : active ? "#0f172a" : "#94a3b8"}; margin-right:10px;">${label}</span>
      </div>`;
    })
    .join("");

  const rowsHtml = items
    .map((item: any) => {
      const prod = item.productId || {};
      const name = prod.name || "-";
      const requestedQty = Number(item.requestedQty || 0);
      const finalQty = Number(item.finalQty || 0);
      const unit = item.unit || "-";
      const cost = Number(item.costPrice || 0);
      const lineTotal = finalQty * cost;
      return `
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:8px 10px; font-weight:600;">${name}</td>
        <td style="padding:8px 10px; text-align:center;">${requestedQty}</td>
        <td style="padding:8px 10px; text-align:center; font-weight:700;">${finalQty}</td>
        <td style="padding:8px 10px; text-align:center;">${unit}</td>
        <td style="padding:8px 10px; text-align:right; font-family:monospace;">${cost.toFixed(2)}</td>
        <td style="padding:8px 10px; text-align:right; font-weight:700; font-family:monospace;">${lineTotal.toFixed(2)}</td>
        <td style="padding:8px 10px; text-align:center;">
          <div style="width:50px; height:28px; border:2px dashed #cbd5e1; border-radius:6px; display:inline-flex; align-items:center; justify-content:center; font-size:12px; color:#94a3b8;">/</div>
        </td>
      </tr>`;
    })
    .join("");

  const totals = {
    items: items.length,
    requested: items.reduce(
      (s: number, i: any) => s + Number(i.requestedQty || 0),
      0,
    ),
    final: items.reduce(
      (s: number, i: any) => s + Number(i.finalQty || 0),
      0,
    ),
    cost: items.reduce(
      (s: number, i: any) =>
        s + Number(i.finalQty || 0) * Number(i.costPrice || 0),
      0,
    ),
  };

  const createdDate = transfer.createdAt;
  const dispatchedDate = transfer.dispatchedAt;
  const receivedDate = transfer.receivedAt;
  const preparedByName = transfer.createdBy?.name || "—";
  const dispatchedByName = transfer.dispatchedBy?.name || "—";
  const receivedByName = transfer.receivedBy?.name || "—";

  return `
<div style="font-family: 'Inter', sans-serif; max-width: 100%; margin: 0 auto; color: #1e293b; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.04);">
  <div style="background: linear-gradient(135deg, #0f172a, #1e293b); padding: 18px 28px; display: flex; justify-content: space-between; align-items: center; color: white;">
    <div>
      <div style="font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">TRANSFER SHEET</div>
      <div style="font-size: 13px; opacity: 0.9; margin-top: 2px;">${transfer.transferType === "WAREHOUSE_TO_WAREHOUSE" ? "Warehouse ⇄ Warehouse" : "Factory → Warehouse"} · ${transfer.transferMode}</div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 22px; font-weight: 800;">#${transferNo}</div>
      <div style="font-size: 12px; opacity: 0.8;">${dateFmt(createdDate)}</div>
      ${transfer.voucherId ? `<div style="font-size: 11px; opacity: 0.7; margin-top: 2px;">Voucher: ${transfer.voucherId}</div>` : ""}
    </div>
  </div>

  <div style="padding: 14px 28px; display: flex; gap: 16px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
    <div style="flex: 1; background: white; border-radius: 10px; padding: 10px 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
      <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700;">Sender</div>
      <div style="font-weight: 700; margin-top: 2px;">${senderName}${senderCode ? ` (${senderCode})` : ""}</div>
      <div style="font-size: 12px; color: #475569;">${senderKind}</div>
    </div>
    <div style="flex: 1; background: white; border-radius: 10px; padding: 10px 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
      <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700;">Receiver</div>
      <div style="font-weight: 700; margin-top: 2px;">${receiverName}${receiverCode ? ` (${receiverCode})` : ""}</div>
      <div style="font-size: 12px; color: #475569;">${receiverKind}</div>
    </div>
    <div style="flex: 2; background: white; border-radius: 10px; padding: 10px 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
      <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 4px;">Progress</div>
      <div style="display: flex; flex-wrap: wrap; gap: 6px;">${workflowHtml}</div>
    </div>
  </div>

  <div style="padding: 16px 28px;">
    <h3 style="font-size: 16px; font-weight: 700; margin: 0 0 10px;">Items (${totals.items})</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
      <thead>
        <tr style="background: #f1f5f9; font-weight: 700; color: #334155; text-transform: uppercase; font-size: 11px;">
          <th style="padding: 10px 12px; text-align: left;">Product</th>
          <th style="padding: 10px 12px; text-align: center;">Req.</th>
          <th style="padding: 10px 12px; text-align: center;">Final</th>
          <th style="padding: 10px 12px; text-align: center;">Unit</th>
          <th style="padding: 10px 12px; text-align: right;">Cost (৳)</th>
          <th style="padding: 10px 12px; text-align: right;">Total (৳)</th>
          <th style="padding: 10px 12px; text-align: center;">Recv'd</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </div>

  <div style="display: flex; justify-content: space-between; padding: 14px 28px; background: #f8fafc; border-top: 1px solid #e2e8f0;">
    <div style="display: flex; gap: 32px;">
      <div><div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700;">Total Qty (Req.)</div><div style="font-size: 22px; font-weight: 800;">${totals.requested}</div></div>
      <div><div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700;">Total Qty (Final)</div><div style="font-size: 22px; font-weight: 800;">${totals.final}</div></div>
      <div><div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700;">Estimated Cost</div><div style="font-size: 22px; font-weight: 800;">৳ ${totals.cost.toFixed(2)}</div></div>
    </div>
    <div style="display: flex; gap: 32px; text-align: center;">
      <div><div style="border-top: 2px solid #cbd5e1; margin-top: 32px; padding-top: 8px; font-size: 11px; color: #475569; font-weight: 600;">Prepared</div><div style="font-size: 12px; font-weight: 700;">${preparedByName}</div><div style="font-size: 10px; color: #94a3b8;">${dateFmt(createdDate)}</div></div>
      <div><div style="border-top: 2px solid #cbd5e1; margin-top: 32px; padding-top: 8px; font-size: 11px; color: #475569; font-weight: 600;">Dispatched</div><div style="font-size: 12px; font-weight: 700;">${dispatchedByName}</div><div style="font-size: 10px; color: #94a3b8;">${dateFmt(dispatchedDate)}</div></div>
      <div><div style="border-top: 2px solid #cbd5e1; margin-top: 32px; padding-top: 8px; font-size: 11px; color: #475569; font-weight: 600;">Received</div><div style="font-size: 12px; font-weight: 700;">${receivedByName}</div><div style="font-size: 10px; color: #94a3b8;">${dateFmt(receivedDate)}</div></div>
    </div>
  </div>

  <div style="background: #0f172a; color: #94a3b8; text-align: center; padding: 8px 28px; font-size: 10px; display: flex; justify-content: space-between;">
    <div>Computer‑generated document</div>
    <div>© Antab Agro LTD</div>
  </div>
</div>`;
}

/* =========================== StatCard =========================== */
function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "slate",
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "slate" | "sky" | "green" | "amber";
}) {
  const map = {
    slate: {
      bg: "bg-slate-100 dark:bg-slate-800",
      fg: "text-slate-600 dark:text-slate-300",
    },
    sky: {
      bg: "bg-sky-100 dark:bg-sky-950/40",
      fg: "text-sky-600 dark:text-sky-300",
    },
    green: {
      bg: "bg-[#3aa838]/10 dark:bg-[#3aa838]/15",
      fg: "text-[#2f8a2f] dark:text-[#9bdd91]",
    },
    amber: {
      bg: "bg-amber-100 dark:bg-amber-950/40",
      fg: "text-amber-600 dark:text-amber-300",
    },
  } as const;
  const t = map[tone];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-lg ${t.bg} ${t.fg}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <div className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
        {value}
      </div>
      {hint && (
        <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      )}
    </div>
  );
}

/* =========================== Page (Protected) =========================== */
export default function FactoryTransferActionPage() {
  return (
    <Protected permissions="factorytransfer.view">
      <FactoryTransferActionPageInner />
    </Protected>
  );
}

/* =========================== Inner =========================== */
function FactoryTransferActionPageInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const hasAccess = usePermissionCheck();
  const canEdit = hasAccess({ permissions: "factorytransfer.edit" });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [transfer, setTransfer] = useState<TransferDoc | null>(null);
  const [remarks, setRemarks] = useState("");

  useEffect(() => {
    if (!id) return;
    loadTransfer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadTransfer() {
    try {
      setLoading(true);
      const res = await api.get(`/transfers/${id}`);
      setTransfer(res.data?.data as TransferDoc);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load transfer");
    } finally {
      setLoading(false);
    }
  }

  const workflowLabels = useMemo(
    () => (transfer ? getWorkflowLabels(transfer) : []),
    [transfer],
  );
  const stepIndex = useMemo(
    () => (transfer ? currentWorkflowStep(transfer) : 0),
    [transfer],
  );
  const statusMeta = getStatusMeta(transfer);

  const totals = useMemo(() => {
    const items = transfer?.items || [];
    const totalLines = items.length;
    const totalQty = items.reduce((s, i) => s + Number(i.finalQty || 0), 0);
    const totalValue = items.reduce(
      (s, i) => s + Number(i.finalQty || 0) * Number(i.costPrice || 0),
      0,
    );
    return { totalLines, totalQty, totalValue };
  }, [transfer]);

  function updateItem(index: number, key: keyof TransferItem, value: any) {
    if (!transfer) return;
    const copy = [...transfer.items];
    const item = { ...copy[index] } as any;
    item[key] = value;
    if (key === "finalQty") {
      item.qtyHistory = item.qtyHistory || [];
      item.qtyHistory = [
        ...(item.qtyHistory || []),
        {
          stage: "DRAFT_UPDATED",
          qty: Number(value),
          changedAt: new Date().toISOString(),
          note: "Edited before dispatch",
        },
      ];
    }
    copy[index] = item;
    setTransfer({ ...transfer, items: copy });
  }

  function actionPayload() {
    if (!transfer) return [];
    return transfer.items.map((i) => ({
      productId:
        typeof i.productId === "object" ? i.productId?._id : i.productId,
      requestedQty: i.requestedQty,
      finalQty: i.finalQty,
      unit: i.unit,
      costPrice: i.costPrice,
    }));
  }

  async function saveDraft() {
    if (!transfer) return;
    if (!canEdit) {
      toast.error("You don't have permission to edit this transfer");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.put(`/transfers/${id}`, {
        transferNo: transfer.transferNo,
        transferType: transfer.transferType,
        transferMode: transfer.transferMode,
        sender: transfer.sender?._id || transfer.sender,
        receiver: transfer.receiver?._id || transfer.receiver,
        items: actionPayload(),
        remarks: remarks || undefined,
      });
      toast.success("Draft saved");
      setTransfer(res.data?.data || transfer);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to save draft");
    } finally {
      setSubmitting(false);
    }
  }

  async function dispatchTransfer() {
    if (!transfer) return;
    if (!canEdit) {
      toast.error("You don't have permission to dispatch this transfer");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post(`/transfers/${id}/dispatch`);
      toast.success("Transfer sent");
      setTransfer(res.data?.data || transfer);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Dispatch failed");
    } finally {
      setSubmitting(false);
    }
  }

  function itemName(item: TransferItem) {
    const p = item.productId;
    return p?.name || p?.sku || (typeof p === "string" ? p : "Product");
  }

  /* =========================== Loading / empty states =========================== */
  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50/60 p-6 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-[#3aa838]" />
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Loading transfer…
          </span>
        </div>
      </div>
    );

  if (!transfer)
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50/60 p-6 dark:bg-slate-950">
        <div className="max-w-sm text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
            <Inbox className="h-6 w-6 text-slate-400" />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
            Transfer not found
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/inventory/product-transfer")}
            className="mt-4 h-8 gap-1.5 text-xs"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to list
          </Button>
        </div>
      </div>
    );

  const senderName = getName(transfer.sender);
  const receiverName = getName(transfer.receiver);

  const editableByState = canEditQty(transfer);
  const editable = editableByState && canEdit;
  const dispatchAllowed = canDispatch(transfer) && canEdit;

  /* =========================== Render =========================== */
  return (
    <div className="min-h-screen bg-slate-50/60 p-4 dark:bg-slate-950 md:p-6">
      <div className="mx-auto max-w-[1600px] space-y-5">
        {/* ============ HERO ============ */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-6">
          <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-[#3aa838]/5 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-emerald-500/5 blur-3xl" />

          <div className="relative flex flex-col gap-4">
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/inventory/product-transfer")}
                className="h-8 gap-1.5 text-xs"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to list
              </Button>
            </div>

            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                    <ArrowRightLeft className="h-2.5 w-2.5" />
                    Operations
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusMeta.tone}`}
                  >
                    {statusMeta.label}
                  </span>
                  {transfer.locked && (
                    <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                      Locked
                    </span>
                  )}
                  {transfer.status === "COMPLETED" && (
                    <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                      Finished
                    </span>
                  )}
                </div>
                <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white md:text-3xl">
                  {transfer.transferNo}
                </h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {transfer.transferMode === "DIRECT"
                    ? "Direct factory transfer"
                    : "Factory request transfer"}{" "}
                  · {senderName} → {receiverName}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                    {transfer.transferType}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                    {transfer.transferMode}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                    Step {Math.min(stepIndex + 1, workflowLabels.length)} /{" "}
                    {workflowLabels.length}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-[#3aa838]/30 bg-[#3aa838]/5 px-2 py-0.5 text-[10px] font-semibold text-[#2f8a2f] dark:border-[#3aa838]/30 dark:bg-[#3aa838]/10 dark:text-[#9bdd91]">
                    {statusMeta.hint}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadTransfer}
                  className="h-9 gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Reload
                </Button>
              </div>
            </div>

            {/* Stat cards */}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                icon={Package}
                label="Total Lines"
                value={totals.totalLines}
                hint="Items in transfer"
                tone="slate"
              />
              <StatCard
                icon={Factory}
                label="Total Qty"
                value={totals.totalQty}
                hint="Across all items"
                tone="sky"
              />
              <StatCard
                icon={DollarSign}
                label="Estimated Value"
                value={`৳ ${currency(totals.totalValue)}`}
                hint="Final qty × cost"
                tone="green"
              />
              <StatCard
                icon={FileText}
                label="Print Status"
                value={transfer.printSnapshot ? "Ready" : "Pending"}
                hint={
                  transfer.printSnapshot
                    ? "Snapshot generated"
                    : "Not generated yet"
                }
                tone={transfer.printSnapshot ? "green" : "amber"}
              />
            </div>
          </div>
        </div>

        {/* ============ WORKFLOW ============ */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Workflow Progress
            </h2>
          </div>
          <div className="p-4">
            <div
              className="grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${workflowLabels.length}, minmax(0, 1fr))`,
              }}
            >
              {workflowLabels.map((label, idx) => {
                const active =
                  idx === stepIndex - 1 && transfer.status !== "COMPLETED";
                const done =
                  idx < stepIndex - 1 || transfer.status === "COMPLETED";
                return (
                  <div
                    key={label}
                    className={`rounded-xl border p-3 transition-all ${
                      active
                        ? "border-[#3aa838] bg-[#3aa838]/5 shadow-sm"
                        : done
                          ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30"
                          : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div
                        className={`truncate text-xs font-medium ${
                          active
                            ? "text-[#2f8a2f] dark:text-[#9bdd91]"
                            : done
                              ? "text-emerald-700 dark:text-emerald-300"
                              : "text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        {label}
                      </div>
                      <div
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                          active
                            ? "bg-[#3aa838] text-white"
                            : done
                              ? "bg-emerald-500 text-white"
                              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {done ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          idx + 1
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ============ MAIN CONTENT ============ */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* Left column */}
          <div className="space-y-5">
            {/* Transfer summary */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Transfer Summary
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadTransfer}
                  className="h-8 gap-1.5 text-xs"
                >
                  <RefreshCw className="h-3 w-3" />
                  Reload
                </Button>
              </div>
              <div className="p-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Sender
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      {senderName}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      {getKind(transfer.sender)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Receiver
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      {receiverName}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      {getKind(transfer.receiver)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Created By
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      {transfer.createdBy?.name ||
                        transfer.createdBy?.email ||
                        "-"}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      {transfer.createdAt
                        ? new Date(transfer.createdAt).toLocaleString()
                        : "-"}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Current Stage
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      {statusMeta.label}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      {statusMeta.hint}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Items ({transfer.items.length})
                </h2>
              </div>
              <div className="p-3">
                <div className="max-h-[560px] overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full min-w-full table-auto">
                    <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
                      <tr>
                        {[
                          "Product",
                          "Requested",
                          "Final",
                          "Unit",
                          "Cost",
                          "Value",
                          "Received",
                        ].map((h, i) => (
                          <th
                            key={h}
                            className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${
                              i === 0
                                ? "text-left"
                                : i >= 1 && i <= 4
                                  ? "text-center"
                                  : i === 5
                                    ? "text-right"
                                    : "text-center"
                            }`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {transfer.items.map((item, idx) => (
                        <tr
                          key={idx}
                          className="border-b border-slate-100 align-top transition-colors last:border-b-0 hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/30"
                        >
                          <td className="min-w-[220px] px-3 py-3">
                            <div className="text-sm font-medium text-slate-900 dark:text-white">
                              {itemName(item)}
                            </div>
                            <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                              SKU: {item.productId?.sku || "-"}
                            </div>
                            {(item.qtyHistory || []).length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {(item.qtyHistory || [])
                                  .slice(-3)
                                  .map((h, hIdx) => (
                                    <span
                                      key={hIdx}
                                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400"
                                    >
                                      <strong>{h.stage}</strong>
                                      <span>→</span>
                                      <span>{h.qty}</span>
                                    </span>
                                  ))}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center text-sm font-medium tabular-nums text-slate-900 dark:text-white">
                            {item.requestedQty}
                          </td>
                          <td className="px-3 py-3 text-center">
                            {editable ? (
                              <Input
                                type="number"
                                min={1}
                                value={item.finalQty}
                                onChange={(e) =>
                                  updateItem(
                                    idx,
                                    "finalQty",
                                    Number(e.target.value),
                                  )
                                }
                                className="h-8 w-24 text-center text-sm font-semibold"
                              />
                            ) : (
                              <span className="text-sm font-medium tabular-nums text-slate-900 dark:text-white">
                                {item.finalQty}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center text-sm text-slate-700 dark:text-slate-300">
                            {item.unit || "-"}
                          </td>
                          <td className="px-3 py-3 text-center text-sm tabular-nums text-slate-700 dark:text-slate-300">
                            {currency(Number(item.costPrice || 0))}
                          </td>
                          <td className="px-3 py-3 text-right text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                            {currency(
                              Number(item.finalQty || 0) *
                                Number(item.costPrice || 0),
                            )}
                          </td>
                          <td className="px-3 py-3 text-center text-sm tabular-nums text-slate-700 dark:text-slate-300">
                            {item.receivedQty ?? 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {editable ? (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#3aa838]/20 bg-[#3aa838]/5 p-3 text-xs text-slate-600 dark:border-[#3aa838]/30 dark:bg-[#3aa838]/10 dark:text-slate-300">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#3aa838]" />
                    <div>
                      <strong className="text-slate-900 dark:text-white">
                        Direct factory transfer
                      </strong>{" "}
                      is still editable at draft stage.
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <div>Quantities are locked for this stage.</div>
                  </div>
                )}
              </div>
            </div>

            {/* Activity log */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Activity Log
                </h2>
              </div>
              <div className="space-y-2 p-4">
                {(transfer.approvalLogs || []).length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
                    <Clock3 className="mx-auto mb-2 h-5 w-5 text-slate-300" />
                    No activity yet.
                  </div>
                ) : (
                  transfer.approvalLogs!.map((log, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/40"
                    >
                      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                        <div className="text-sm font-medium text-slate-900 dark:text-white">
                          {log.status}{" "}
                          <span className="ml-1 text-[10px] font-normal text-slate-500 dark:text-slate-400">
                            by {log.role || "-"}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          {log.actionAt
                            ? new Date(log.actionAt).toLocaleString()
                            : "-"}
                        </div>
                      </div>
                      {log.remarks && (
                        <div className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                          {log.remarks}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          <aside className="space-y-5">
            <div className="sticky top-6 space-y-5">
              {/* Status & next action */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Status & Next Action
                  </h2>
                </div>
                <div className="space-y-3 p-4">
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${statusMeta.tone}`}
                  >
                    {statusMeta.label}
                  </span>
                  <div className="rounded-lg border border-[#3aa838]/20 bg-[#3aa838]/5 p-3 dark:border-[#3aa838]/30 dark:bg-[#3aa838]/10">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#2f8a2f] dark:text-[#9bdd91]">
                      Next step
                    </div>
                    <div className="mt-0.5 text-xs font-semibold text-slate-900 dark:text-white">
                      {statusMeta.hint}
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">
                        Lines
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {totals.totalLines}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">
                        Total qty
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {totals.totalQty}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">
                        Estimated value
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        ৳ {currency(totals.totalValue)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">
                        Print snapshot
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {transfer.printSnapshot ? "Ready" : "Pending"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">
                        Signed copy
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {transfer.documents?.signed?.mediaId
                            ? "Uploaded"
                            : "Pending"}
                        </span>
                        {transfer.documents?.signed?.mediaId &&
                          getMediaPreviewUrl(
                            transfer.documents.signed.mediaId,
                          ) && (
                            <a
                              href={getMediaPreviewUrl(
                                transfer.documents.signed.mediaId,
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 text-[10px] font-medium text-[#2f8a2f] hover:underline dark:text-[#9bdd91]"
                            >
                              <ExternalLink className="h-2.5 w-2.5" />
                              Preview
                            </a>
                          )}
                      </div>
                    </div>
                  </div>

                  {transfer.status === "COMPLETED" && (
                    <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      This transfer is fully completed.
                    </div>
                  )}
                </div>
              </div>

              {/* Remarks */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Remarks
                  </h2>
                </div>
                <div className="space-y-2 p-4">
                  <textarea
                    className="min-h-[90px] w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs outline-none transition focus:border-[#3aa838]/40 focus:ring-2 focus:ring-[#3aa838]/10 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Optional remarks"
                  />
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    Remarks are attached to workflow actions and logs.
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Actions
                  </h2>
                </div>
                <div className="space-y-2 p-4">
                  {editable && (
                    <Button
                      className="h-9 w-full text-xs"
                      variant="outline"
                      onClick={saveDraft}
                      disabled={submitting}
                    >
                      {submitting ? "Saving…" : "Save Draft"}
                    </Button>
                  )}

                  {canPrint(transfer) && (
                    <GlobalPrintButton
                      contentHtml={buildTransferPrintHtml(transfer)}
                      headerRightHtml={buildTransferPrintHeaderRight(
                        transfer,
                      )}
                      label="Print Transfer Sheet"
                      title="Transfer Sheet"
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

                  {dispatchAllowed && (
                    <Button
                      className="h-9 w-full gap-1.5 bg-[#3aa838] text-xs text-white shadow-sm shadow-[#3aa838]/20 hover:bg-[#2f8a2f]"
                      onClick={dispatchTransfer}
                      disabled={submitting}
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                      Dispatch Now
                    </Button>
                  )}

                  {transfer.status === "SENT" && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                      <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      The receiver warehouse will receive the transfer and then
                      complete it from their action page.
                    </div>
                  )}
                </div>
              </div>

              {/* Documents */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Document Status
                  </h2>
                </div>
                <div className="space-y-2 p-4 text-xs">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Print snapshot
                    </div>
                    <div className="mt-0.5 font-semibold text-slate-900 dark:text-white">
                      {transfer.printSnapshot ? "Ready" : "Not generated"}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Signed copy
                    </div>
                    <div className="mt-0.5 font-semibold text-slate-900 dark:text-white">
                      {transfer.documents?.signed?.mediaId
                        ? "Uploaded"
                        : "Not uploaded"}
                    </div>
                    {transfer.documents?.signed?.mediaId &&
                      getMediaPreviewUrl(transfer.documents.signed.mediaId) && (
                        <a
                          href={getMediaPreviewUrl(
                            transfer.documents.signed.mediaId,
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-0.5 text-[10px] font-medium text-[#2f8a2f] hover:underline dark:text-[#9bdd91]"
                        >
                          Preview uploaded document
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                  </div>

                  {transfer.documents?.damage?.mediaId && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 dark:border-rose-900/60 dark:bg-rose-950/40">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-300">
                        Damage document
                      </div>
                      <div className="mt-0.5 font-semibold text-rose-800 dark:text-rose-200">
                        Uploaded
                      </div>
                      {getMediaPreviewUrl(
                        transfer.documents.damage.mediaId,
                      ) && (
                        <a
                          href={getMediaPreviewUrl(
                            transfer.documents.damage.mediaId,
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-0.5 text-[10px] font-medium text-rose-700 hover:underline dark:text-rose-300"
                        >
                          Preview damage document
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                      {transfer.documents.damage.reason && (
                        <div className="mt-1 text-[10px] text-rose-700 dark:text-rose-300">
                          Reason: {transfer.documents.damage.reason}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}