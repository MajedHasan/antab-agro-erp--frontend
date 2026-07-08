"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import GlobalPrintButton from "@/components/common/print/GlobalPrintButton";
import {
  ArrowLeft,
  Check,
  RefreshCw,
  XCircle,
  FileText,
  Loader2,
  ExternalLink,
} from "lucide-react";

/* ---------- updated types ---------- */
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
      mediaId?: string;
      uploadedBy?: any;
      uploadedAt?: string;
    };
    damage?: {
      mediaId?: string;
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

/* ---------- helpers ---------- */
const STATUS_TONE: Record<TransferStatus, string> = {
  REQUESTED: "bg-slate-100 text-slate-800 border-slate-200",
  RECEIVER_NSM_APPROVED: "bg-sky-100 text-sky-800 border-sky-200",
  SENDER_REVIEWED: "bg-violet-100 text-violet-800 border-violet-200",
  SENDER_NSM_APPROVED: "bg-indigo-100 text-indigo-800 border-indigo-200",
  SENT: "bg-amber-100 text-amber-800 border-amber-200",
  HOLD: "bg-orange-100 text-orange-800 border-orange-200",
  AWAITING_REMAINING: "bg-purple-100 text-purple-800 border-purple-200",
  COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

function getName(loc: any) {
  return loc?.name || loc?.warehouseName || loc?.factoryName || loc?.code || "-";
}
function getKind(loc: any) {
  const t = String(loc?.type || loc?.kind || loc?.entityType || "").toLowerCase();
  if (t.includes("factory")) return "Factory";
  if (t.includes("warehouse")) return "Warehouse";
  return "Location";
}
function currency(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ---------- workflow helpers (dynamic) ---------- */
function hasPartialReceipt(transfer: TransferDoc): boolean {
  return transfer.items.some(item => (item.receivedQty || 0) > 0 && (item.receivedQty || 0) < item.finalQty);
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

  // REQUEST mode (warehouse → factory)
  if (t.transferType === "FACTORY_TO_WAREHOUSE" && t.transferMode === "REQUEST") {
    const base = ["Requested", "Receiver NSM", "Sent"];
    if (includeHoldSteps) base.push("Hold", "Awaiting Remaining");
    base.push("Completed");
    return base;
  }

  // fallback (should not happen on factory page)
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
  return labels.map(l => map[l] || "REQUESTED");
}

function getStatusMeta(transfer: TransferDoc | null) {
  if (!transfer) return { label: "-", tone: "bg-slate-100 text-slate-800 border-slate-200", hint: "" };
  const tone = STATUS_TONE[transfer.status] || STATUS_TONE.REQUESTED;
  const map: Record<TransferStatus, { label: string; hint: string }> = {
    REQUESTED: { label: "Requested", hint: "Transfer created" },
    RECEIVER_NSM_APPROVED: {
      label: "Receiver NSM Approved",
      hint: transfer.transferType === "WAREHOUSE_TO_WAREHOUSE" ? "Waiting for sender review" : "Waiting for dispatch",
    },
    SENDER_REVIEWED: { label: "Sender Reviewed", hint: "Waiting for sender NSM approval" },
    SENDER_NSM_APPROVED: { label: "Sender NSM Approved", hint: "Ready to print and send" },
    SENT: { label: "Sent", hint: "Waiting for receiver to receive" },
    HOLD: { label: "Hold", hint: "Received quantities don't match final qty" },
    AWAITING_REMAINING: { label: "Awaiting Remaining", hint: "Received qty processed, awaiting remaining resolution" },
    COMPLETED: { label: "Completed", hint: "Transfer completed" },
  };
  return { ...map[transfer.status], tone };
}

function currentWorkflowStep(transfer: TransferDoc): number {
  const statuses = getWorkflowStatuses(transfer);
  const idx = statuses.indexOf(transfer.status);
  return idx >= 0 ? idx + 1 : 0;
}

/* ---------- action helpers (factory‑side) ---------- */
function canEditQty(transfer: TransferDoc | null) {
  return (
    transfer?.transferType === "FACTORY_TO_WAREHOUSE" &&
    transfer?.transferMode === "DIRECT" &&
    transfer?.status === "REQUESTED"
  );
}
function canDispatch(transfer: TransferDoc | null) {
  if (!transfer) return false;
  if (transfer.transferType === "WAREHOUSE_TO_WAREHOUSE") return transfer.status === "SENDER_NSM_APPROVED";
  if (transfer.transferMode === "REQUEST") return transfer.status === "RECEIVER_NSM_APPROVED";
  return transfer.status === "REQUESTED";
}
function canPrint(transfer: TransferDoc | null) {
  if (!transfer) return false;
  if (transfer.transferType === "WAREHOUSE_TO_WAREHOUSE") return ["SENDER_NSM_APPROVED", "SENT", "COMPLETED"].includes(transfer.status);
  if (transfer.transferMode === "REQUEST") return ["RECEIVER_NSM_APPROVED", "SENT", "COMPLETED"].includes(transfer.status);
  return ["REQUESTED", "SENT", "COMPLETED"].includes(transfer.status);
}

/* ---------- print helpers ---------- */
function getMediaPreviewUrl(mediaId?: any) {
  if (!mediaId) return "";
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";
  return `${base}${mediaId?.url}`;
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
  const dateFmt = (d: any) => d ? new Date(d).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" }) : "—";

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
    .map((item: any, idx: number) => {
      const prod = item.productId || {};
      const name = prod.name || "-";
      const sku = prod.sku || "-";
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
    requested: items.reduce((s: number, i: any) => s + Number(i.requestedQty || 0), 0),
    final: items.reduce((s: number, i: any) => s + Number(i.finalQty || 0), 0),
    cost: items.reduce((s: number, i: any) => s + Number(i.finalQty || 0) * Number(i.costPrice || 0), 0),
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

/* =============================================================== */
export default function FactoryTransferActionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [transfer, setTransfer] = useState<TransferDoc | null>(null);
  const [remarks, setRemarks] = useState("");

  useEffect(() => { if (!id) return; loadTransfer(); }, [id]);

  async function loadTransfer() {
    try {
      setLoading(true);
      const res = await api.get(`/transfers/${id}`);
      setTransfer(res.data?.data as TransferDoc);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load transfer");
    } finally { setLoading(false); }
  }

  const workflowLabels = useMemo(() => (transfer ? getWorkflowLabels(transfer) : []), [transfer]);
  const stepIndex = useMemo(() => (transfer ? currentWorkflowStep(transfer) : 0), [transfer]);
  const statusMeta = getStatusMeta(transfer);

  const totals = useMemo(() => {
    const items = transfer?.items || [];
    const totalLines = items.length;
    const totalQty = items.reduce((s, i) => s + Number(i.finalQty || 0), 0);
    const totalValue = items.reduce((s, i) => s + Number(i.finalQty || 0) * Number(i.costPrice || 0), 0);
    return { totalLines, totalQty, totalValue };
  }, [transfer]);

  function updateItem(index: number, key: keyof TransferItem, value: any) {
    if (!transfer) return;
    const copy = [...transfer.items];
    const item = { ...copy[index] } as any;
    item[key] = value;
    if (key === "finalQty") {
      item.qtyHistory = item.qtyHistory || [];
      item.qtyHistory = [...(item.qtyHistory || []), { stage: "DRAFT_UPDATED", qty: Number(value), changedAt: new Date().toISOString(), note: "Edited before dispatch" }];
    }
    copy[index] = item;
    setTransfer({ ...transfer, items: copy });
  }

  function actionPayload() {
    if (!transfer) return [];
    return transfer.items.map(i => ({
      productId: typeof i.productId === "object" ? i.productId?._id : i.productId,
      requestedQty: i.requestedQty,
      finalQty: i.finalQty,
      unit: i.unit,
      costPrice: i.costPrice,
    }));
  }

  async function saveDraft() {
    if (!transfer) return;
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
    } finally { setSubmitting(false); }
  }

  async function dispatchTransfer() {
    if (!transfer) return;
    setSubmitting(true);
    try {
      const res = await api.post(`/transfers/${id}/dispatch`);
      toast.success("Transfer sent");
      setTransfer(res.data?.data || transfer);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Dispatch failed");
    } finally { setSubmitting(false); }
  }

  function itemName(item: TransferItem) {
    const p = item.productId;
    return p?.name || p?.sku || (typeof p === "string" ? p : "Product");
  }

  if (loading) return <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!transfer) return <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">Transfer not found</div>;

  const senderName = getName(transfer.sender);
  const receiverName = getName(transfer.receiver);
  const editable = canEditQty(transfer);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6 space-y-6">
        {/* Hero Header */}
        <div className="rounded-3xl border bg-gradient-to-br from-slate-950 via-slate-900 to-slate-700 p-6 text-white shadow-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <Button variant="ghost" className="mb-4 -ml-3 text-slate-200 hover:bg-white/10 hover:text-white" onClick={() => router.push("/inventory/product-transfer")}><ArrowLeft className="mr-2 h-4 w-4" />Back to list</Button>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight">{transfer.transferNo}</h1>
                <Badge variant="outline" className={statusMeta.tone}>{statusMeta.label}</Badge>
                {transfer.locked && <Badge variant="outline" className="bg-white/10 text-white border-white/20">Locked</Badge>}
                {transfer.status === "COMPLETED" && <Badge variant="outline" className="bg-emerald-500/20 text-emerald-100 border-emerald-400/30">Finished</Badge>}
              </div>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">{transfer.transferMode === "DIRECT" ? "Direct factory transfer" : "Factory request transfer"} • {senderName} → {receiverName}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">{transfer.transferType}</span>
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">{transfer.transferMode}</span>
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">Step {Math.min(stepIndex + 1, workflowLabels.length)} / {workflowLabels.length}</span>
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">{statusMeta.hint}</span>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[380px]">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur"><div className="text-xs uppercase tracking-wide text-slate-300">Total lines</div><div className="mt-1 text-2xl font-bold">{totals.totalLines}</div></div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur"><div className="text-xs uppercase tracking-wide text-slate-300">Total qty</div><div className="mt-1 text-2xl font-bold">{totals.totalQty}</div></div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur"><div className="text-xs uppercase tracking-wide text-slate-300">Estimated value</div><div className="mt-1 text-2xl font-bold">{currency(totals.totalValue)}</div></div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur"><div className="text-xs uppercase tracking-wide text-slate-300">Print status</div><div className="mt-1 text-2xl font-bold">{transfer.printSnapshot ? "Ready" : "Pending"}</div></div>
            </div>
          </div>
        </div>

        {/* Workflow */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3"><CardTitle>Workflow progress</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${workflowLabels.length}, minmax(0, 1fr))` }}>
              {workflowLabels.map((label, idx) => {
                const active = idx === stepIndex - 1 && transfer.status !== "COMPLETED";
                const done = idx < stepIndex - 1 || transfer.status === "COMPLETED";
                return (
                  <div key={label} className={`rounded-2xl border p-4 ${active ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900" : done ? "border-emerald-200 bg-emerald-50" : "bg-white"}`}>
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">{label}</div>
                      <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${active ? "bg-slate-900 text-white" : done ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                        {done ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Main content */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* Left column */}
          <div className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle>Transfer summary</CardTitle>
                <Button variant="outline" onClick={loadTransfer}><RefreshCw className="mr-2 h-4 w-4" />Reload</Button>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border bg-white p-4"><div className="text-xs uppercase tracking-wide text-muted-foreground">Sender</div><div className="mt-1 font-semibold">{senderName}</div><div className="text-xs text-muted-foreground">{getKind(transfer.sender)}</div></div>
                  <div className="rounded-2xl border bg-white p-4"><div className="text-xs uppercase tracking-wide text-muted-foreground">Receiver</div><div className="mt-1 font-semibold">{receiverName}</div><div className="text-xs text-muted-foreground">{getKind(transfer.receiver)}</div></div>
                  <div className="rounded-2xl border bg-white p-4"><div className="text-xs uppercase tracking-wide text-muted-foreground">Created by</div><div className="mt-1 font-semibold">{transfer.createdBy?.name || transfer.createdBy?.email || "-"}</div><div className="text-xs text-muted-foreground">{transfer.createdAt ? new Date(transfer.createdAt).toLocaleString() : "-"}</div></div>
                  <div className="rounded-2xl border bg-white p-4"><div className="text-xs uppercase tracking-wide text-muted-foreground">Current stage</div><div className="mt-1 font-semibold">{statusMeta.label}</div><div className="text-xs text-muted-foreground">{statusMeta.hint}</div></div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader><CardTitle>Items</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-2xl border bg-white">
                  <div className="max-h-[560px] overflow-auto">
                    <table className="min-w-full table-auto">
                      <thead className="sticky top-0 z-10 bg-slate-50 text-left text-sm shadow-sm">
                        <tr>
                          <th className="px-4 py-3">Product</th>
                          <th className="px-4 py-3">Requested</th>
                          <th className="px-4 py-3">Final</th>
                          <th className="px-4 py-3">Unit</th>
                          <th className="px-4 py-3">Cost</th>
                          <th className="px-4 py-3">Value</th>
                          <th className="px-4 py-3">Received</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transfer.items.map((item, idx) => (
                          <tr key={idx} className="border-t align-top hover:bg-slate-50">
                            <td className="px-4 py-4">
                              <div className="space-y-2">
                                <div className="font-medium">{itemName(item)}</div>
                                <div className="text-xs text-muted-foreground">SKU: {item.productId?.sku || "-"}</div>
                                <div className="flex flex-wrap gap-2">
                                  {(item.qtyHistory || []).slice(-3).map((h, hIdx) => (
                                    <span key={hIdx} className="inline-flex items-center gap-2 rounded-full border bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600">
                                      <strong>{h.stage}</strong> <span>→</span> <span>{h.qty}</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-sm font-medium">{item.requestedQty}</td>
                            <td className="px-4 py-4">
                              {editable ? (
                                <Input type="number" min={1} value={item.finalQty} onChange={e => updateItem(idx, "finalQty", Number(e.target.value))} className="h-11 w-28" />
                              ) : (
                                <span className="text-sm font-medium">{item.finalQty}</span>
                              )}
                            </td>
                            <td className="px-4 py-4 text-sm">{item.unit || "-"}</td>
                            <td className="px-4 py-4 text-sm">{currency(Number(item.costPrice || 0))}</td>
                            <td className="px-4 py-4 text-sm font-semibold">{currency(Number(item.finalQty || 0) * Number(item.costPrice || 0))}</td>
                            <td className="px-4 py-4 text-sm">{item.receivedQty ?? 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                {editable ? <div className="mt-4 rounded-2xl border bg-slate-50 p-4 text-sm text-muted-foreground">Direct factory transfer is still editable at draft stage.</div> : <div className="mt-4 rounded-2xl border bg-slate-50 p-4 text-sm text-muted-foreground">Quantities are locked for this stage.</div>}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader><CardTitle>Activity log</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(transfer.approvalLogs || []).length === 0 ? <div className="rounded-2xl border bg-slate-50 p-6 text-sm text-muted-foreground">No activity yet.</div> :
                    transfer.approvalLogs.map((log, idx) => (
                      <div key={idx} className="rounded-2xl border bg-white p-4">
                        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                          <div className="font-medium">{log.status} <span className="ml-2 text-xs text-muted-foreground">by {log.role || "-"}</span></div>
                          <div className="text-xs text-muted-foreground">{log.actionAt ? new Date(log.actionAt).toLocaleString() : "-"}</div>
                        </div>
                        {log.remarks && <div className="mt-2 text-sm text-muted-foreground">{log.remarks}</div>}
                      </div>
                    ))
                  }
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right sidebar */}
          <div className="space-y-6">
            <div className="sticky top-6 space-y-6">
              <Card className="shadow-sm">
                <CardHeader><CardTitle>Status & next action</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <Badge variant="outline" className={statusMeta.tone}>{statusMeta.label}</Badge>
                  <div className="rounded-2xl border bg-slate-50 p-4"><div className="text-xs uppercase tracking-wide text-muted-foreground">Next step</div><div className="mt-1 font-semibold">{statusMeta.hint}</div></div>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center justify-between"><span>Lines</span><span className="font-medium text-slate-900">{totals.totalLines}</span></div>
                    <div className="flex items-center justify-between"><span>Total qty</span><span className="font-medium text-slate-900">{totals.totalQty}</span></div>
                    <div className="flex items-center justify-between"><span>Estimated value</span><span className="font-medium text-slate-900">{currency(totals.totalValue)}</span></div>
                    <div className="flex items-center justify-between"><span>Print snapshot</span><span className="font-medium text-slate-900">{transfer.printSnapshot ? "Ready" : "Pending"}</span></div>
                    <div className="flex items-center justify-between"><span>Signed copy</span><div className="flex items-center gap-2"><span className="font-medium text-slate-900">{transfer.documents?.signed?.mediaId ? "Uploaded" : "Pending"}</span>{transfer.documents?.signed?.mediaId && <a href={getMediaPreviewUrl(transfer.documents.signed.mediaId)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">Preview<ExternalLink className="h-3.5 w-3.5"/></a>}</div></div>
                  </div>
                  {transfer.status === "COMPLETED" && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">✅ This transfer is fully completed.</div>}
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader><CardTitle>Remarks</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <textarea className="min-h-[110px] w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Optional remarks" />
                  <div className="text-xs text-muted-foreground">Remarks are attached to workflow actions and logs.</div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {editable && <Button className="w-full" variant="outline" onClick={saveDraft} disabled={submitting}>Save draft</Button>}

                  {canPrint(transfer) && (
                    <GlobalPrintButton
                      contentHtml={buildTransferPrintHtml(transfer)}
                      headerRightHtml={buildTransferPrintHeaderRight(transfer)}
                      label="Print Transfer Sheet"
                      title="Transfer Sheet"
                      orientation="portrait"
                      company={{ name: "Antab Agro LTD", address: "123 Agro Street, Dhaka", phone: "+880 1711-111111", email: "info@antabagro.com" }}
                      showHeader={false}
                      showFooter={false}
                    />
                  )}

                  {canDispatch(transfer) && (
                    <Button className="w-full" onClick={dispatchTransfer} disabled={submitting}>
                      <FileText className="mr-2 h-4 w-4" />Dispatch now
                    </Button>
                  )}

                  {transfer.status === "SENT" && (
                    <div className="rounded-2xl border bg-amber-50 p-4 text-sm text-amber-900">
                      The receiver warehouse will receive the transfer and then complete it from their action page.
                    </div>
                  )}

                  {transfer.status === "COMPLETED" && (
                    <div className="rounded-2xl border bg-emerald-50 p-4 text-sm text-emerald-900">
                      This transfer is completed.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader><CardTitle>Document status</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="rounded-2xl border bg-white p-4"><div className="text-xs uppercase tracking-wide text-muted-foreground">Print snapshot</div><div className="mt-1 font-semibold">{transfer.printSnapshot ? "Ready" : "Not generated"}</div></div>
                  <div className="rounded-2xl border bg-white p-4"><div className="text-xs uppercase tracking-wide text-muted-foreground">Signed copy</div><div className="mt-1 font-semibold">{transfer.documents?.signed?.mediaId ? "Uploaded" : "Not uploaded"}</div>{transfer.documents?.signed?.mediaId && <a href={getMediaPreviewUrl(transfer.documents.signed.mediaId)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">Preview uploaded document<ExternalLink className="h-3.5 w-3.5"/></a>}</div>
                  {transfer.documents?.damage?.mediaId && (
                    <div className="rounded-2xl border bg-white p-4">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Damage document</div>
                      <div className="mt-1 font-semibold">Uploaded</div>
                      <a href={getMediaPreviewUrl(transfer.documents.damage.mediaId)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">Preview damage document<ExternalLink className="h-3.5 w-3.5"/></a>
                      {transfer.documents.damage.reason && <div className="mt-2 text-xs text-muted-foreground">Reason: {transfer.documents.damage.reason}</div>}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}