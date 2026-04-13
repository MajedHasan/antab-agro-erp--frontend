"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Check,
  RefreshCw,
  XCircle,
  FileText,
  Loader2,
  ExternalLink,
} from "lucide-react";
import TransferPrintTools from "@/app/(main)/sales/transfer/[id]/components/TransferPrintTools";

type TransferStatus =
  | "DRAFT"
  | "RECEIVER_NSM_APPROVED"
  | "SENDER_REVIEWED"
  | "SENDER_NSM_APPROVED"
  | "DISPATCHED"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED";

type TransferType = "WAREHOUSE_TO_WAREHOUSE" | "FACTORY_TO_WAREHOUSE";
type TransferMode = "REQUEST" | "DIRECT";

type TransferItem = {
  productId: any;
  requestedQty: number;
  finalQty: number;
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

const STATUS_TONE: Record<TransferStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-800 border-slate-200",
  RECEIVER_NSM_APPROVED: "bg-sky-100 text-sky-800 border-sky-200",
  SENDER_REVIEWED: "bg-violet-100 text-violet-800 border-violet-200",
  SENDER_NSM_APPROVED: "bg-indigo-100 text-indigo-800 border-indigo-200",
  DISPATCHED: "bg-amber-100 text-amber-800 border-amber-200",
  COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  REJECTED: "bg-red-100 text-red-800 border-red-200",
  CANCELLED: "bg-red-100 text-red-800 border-red-200",
};

function getName(loc: any) {
  return (
    loc?.name || loc?.warehouseName || loc?.factoryName || loc?.code || "-"
  );
}

function getKind(loc: any) {
  const t = String(
    loc?.type || loc?.kind || loc?.entityType || "",
  ).toLowerCase();
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

function getWorkflowStatuses(transfer?: TransferDoc | null): TransferStatus[] {
  if (!transfer) return [];

  if (transfer.transferType === "WAREHOUSE_TO_WAREHOUSE") {
    return [
      "DRAFT",
      "RECEIVER_NSM_APPROVED",
      "SENDER_REVIEWED",
      "SENDER_NSM_APPROVED",
      "DISPATCHED",
      "COMPLETED",
    ];
  }

  if (transfer.transferMode === "REQUEST") {
    return ["DRAFT", "RECEIVER_NSM_APPROVED", "DISPATCHED", "COMPLETED"];
  }

  return ["DRAFT", "DISPATCHED", "COMPLETED"];
}

function getWorkflowLabels(transfer?: TransferDoc | null): string[] {
  if (!transfer) return [];

  if (transfer.transferType === "WAREHOUSE_TO_WAREHOUSE") {
    return [
      "Draft / Created",
      "Receiver NSM",
      "Sender Review",
      "Sender NSM",
      "Dispatch",
      "Complete",
    ];
  }

  if (transfer.transferMode === "REQUEST") {
    return ["Draft / Created", "Receiver NSM", "Dispatch", "Complete"];
  }

  return ["Factory Created", "Dispatch", "Complete"];
}

function getStatusMeta(transfer: TransferDoc | null) {
  if (!transfer) {
    return {
      label: "-",
      tone: "bg-slate-100 text-slate-800 border-slate-200",
      hint: "",
    };
  }

  const tone = STATUS_TONE[transfer.status] || STATUS_TONE.DRAFT;

  if (transfer.status === "DRAFT") {
    if (
      transfer.transferType === "FACTORY_TO_WAREHOUSE" &&
      transfer.transferMode === "DIRECT"
    ) {
      return {
        label: "Factory Created",
        tone,
        hint: "Factory created transfer, ready to dispatch",
      };
    }

    if (transfer.transferMode === "REQUEST") {
      return {
        label: "Draft / Created",
        tone,
        hint: "Waiting for receiver NSM approval",
      };
    }

    return {
      label: "Draft",
      tone,
      hint: "Waiting for receiver NSM approval",
    };
  }

  if (transfer.status === "RECEIVER_NSM_APPROVED") {
    if (transfer.transferType === "WAREHOUSE_TO_WAREHOUSE") {
      return {
        label: "Receiver NSM Approved",
        tone,
        hint: "Waiting for sender review",
      };
    }

    if (transfer.transferMode === "REQUEST") {
      return {
        label: "Receiver NSM Approved",
        tone,
        hint: "Waiting for dispatch",
      };
    }

    return {
      label: "Receiver NSM Approved",
      tone,
      hint: "Waiting for dispatch",
    };
  }

  if (transfer.status === "SENDER_REVIEWED") {
    return {
      label: "Sender Reviewed",
      tone,
      hint: "Waiting for sender NSM approval",
    };
  }

  if (transfer.status === "SENDER_NSM_APPROVED") {
    return {
      label: "Sender NSM Approved",
      tone,
      hint: "Ready to dispatch",
    };
  }

  if (transfer.status === "DISPATCHED") {
    return {
      label: "Dispatched",
      tone,
      hint: "Waiting for receiver to receive and complete",
    };
  }

  if (transfer.status === "COMPLETED") {
    return {
      label: "Completed",
      tone,
      hint: "Transfer completed",
    };
  }

  if (transfer.status === "REJECTED") {
    return {
      label: "Rejected",
      tone,
      hint: "Transfer rejected",
    };
  }

  if (transfer.status === "CANCELLED") {
    return {
      label: "Cancelled",
      tone,
      hint: "Transfer cancelled",
    };
  }

  return {
    label: transfer.status,
    tone,
    hint: "",
  };
}

function currentWorkflowStep(transfer: TransferDoc | null) {
  if (!transfer) return 0;

  if (transfer.status === "COMPLETED") {
    // return getWorkflowLabels(transfer).length - 1;
    return getWorkflowLabels(transfer).length;
  }

  if (transfer.status === "REJECTED" || transfer.status === "CANCELLED") {
    return 0;
  }

  const workflow = getWorkflowStatuses(transfer);
  const idx = workflow.indexOf(transfer.status);
  return idx >= 0 ? idx : 0;
}

function canEditQty(transfer: TransferDoc | null) {
  return (
    transfer?.transferType === "FACTORY_TO_WAREHOUSE" &&
    transfer?.transferMode === "DIRECT" &&
    transfer?.status === "DRAFT"
  );
}

function canDispatch(transfer: TransferDoc | null) {
  if (!transfer) return false;

  if (transfer.transferType === "WAREHOUSE_TO_WAREHOUSE") {
    return transfer.status === "SENDER_NSM_APPROVED";
  }

  if (transfer.transferMode === "REQUEST") {
    return transfer.status === "RECEIVER_NSM_APPROVED";
  }

  return transfer.status === "DRAFT";
}

function canPrint(transfer: TransferDoc | null) {
  if (!transfer) return false;

  if (transfer.transferType === "WAREHOUSE_TO_WAREHOUSE") {
    return ["SENDER_NSM_APPROVED", "DISPATCHED", "COMPLETED"].includes(
      transfer.status,
    );
  }

  if (transfer.transferMode === "REQUEST") {
    return ["RECEIVER_NSM_APPROVED", "DISPATCHED", "COMPLETED"].includes(
      transfer.status,
    );
  }

  return ["DRAFT", "DISPATCHED", "COMPLETED"].includes(transfer.status);
}

function canCancel(transfer: TransferDoc | null) {
  if (!transfer) return false;
  return !["DISPATCHED", "COMPLETED", "CANCELLED", "REJECTED"].includes(
    transfer.status,
  );
}

function canReject(transfer: TransferDoc | null) {
  if (!transfer) return false;
  return !["DISPATCHED", "COMPLETED", "CANCELLED", "REJECTED"].includes(
    transfer.status,
  );
}

function getMediaPreviewUrl(mediaId?: string) {
  if (!mediaId) return "";
  // const base =
  //   process.env.NEXT_PUBLIC_MEDIA_URL?.replace(/\/$/, "") ||
  //   "http://localhost:5001/uploads/" ||
  //   "";
  const base = "http://localhost:5001/uploads";
  return `${base}/warehouse-transfer/signed-documents/${mediaId}`;
}

export default function FactoryTransferActionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [transfer, setTransfer] = useState<TransferDoc | null>(null);

  const [remarks, setRemarks] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    if (!id) return;
    loadTransfer();
    // TODO: later restrict action visibility by user.role and accessible factories.
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

  const statusMeta = getStatusMeta(transfer);
  const workflowLabels = useMemo(() => getWorkflowLabels(transfer), [transfer]);
  const stepIndex = currentWorkflowStep(transfer);

  const totals = useMemo(() => {
    const items = transfer?.items || [];
    const totalLines = items.length;
    const totalQty = items.reduce(
      (s, i) => s + Number(i.finalQty || i.requestedQty || 0),
      0,
    );
    const totalValue = items.reduce(
      (s, i) =>
        s +
        Number(i.finalQty || i.requestedQty || 0) * Number(i.costPrice || 0),
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
    try {
      setSubmitting(true);
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
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to save draft");
    } finally {
      setSubmitting(false);
    }
  }

  async function dispatchTransfer() {
    if (!transfer) return;
    try {
      setSubmitting(true);
      const res = await api.post(`/transfers/${id}/dispatch`);
      toast.success("Transfer dispatched");
      setTransfer(res.data?.data || transfer);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Dispatch failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelTransfer() {
    if (!transfer) return;
    try {
      setSubmitting(true);
      const res = await api.post(`/transfers/${id}/cancel`, {
        reason: cancelReason || "Cancelled from factory action page",
      });
      toast.success("Transfer cancelled");
      setTransfer(res.data?.data || transfer);
      setCancelReason("");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Cancel failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function rejectTransfer() {
    if (!transfer) return;
    try {
      setSubmitting(true);
      const res = await api.post(`/transfers/${id}/reject`, {
        reason: rejectReason || "Rejected from factory action page",
      });
      toast.success("Transfer rejected");
      setTransfer(res.data?.data || transfer);
      setRejectReason("");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Reject failed");
    } finally {
      setSubmitting(false);
    }
  }

  function itemName(item: TransferItem) {
    const p = item.productId;
    return p?.name || p?.sku || (typeof p === "string" ? p : "Product");
  }

  function itemSku(item: TransferItem) {
    const p = item.productId;
    return p?.sku || "-";
  }

  function rowHistory(item: TransferItem) {
    return (item.qtyHistory || []).slice(-3).map((h, idx) => (
      <div
        key={idx}
        className="inline-flex items-center gap-2 rounded-full border bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600"
      >
        <span className="font-semibold">{h.stage}</span>
        <span>→</span>
        <span>{h.qty}</span>
      </div>
    ));
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl space-y-4">
          <div className="h-32 animate-pulse rounded-3xl bg-slate-200" />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="h-[700px] animate-pulse rounded-3xl bg-slate-200" />
            <div className="h-[700px] animate-pulse rounded-3xl bg-slate-200" />
          </div>
        </div>
      </div>
    );
  }

  if (!transfer) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-3xl">
          <Card className="shadow-sm">
            <CardContent className="p-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                <XCircle className="h-7 w-7 text-slate-500" />
              </div>
              <h2 className="text-xl font-semibold">Transfer not found</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                The requested transfer could not be loaded.
              </p>
              <Button
                className="mt-5"
                variant="outline"
                onClick={() => router.push("/inventory/product-transfer")}
              >
                Back to list
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const senderName = getName(transfer.sender);
  const receiverName = getName(transfer.receiver);
  const editable = canEditQty(transfer);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6 space-y-6">
        <div className="rounded-3xl border bg-gradient-to-br from-slate-950 via-slate-900 to-slate-700 p-6 text-white shadow-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <Button
                variant="ghost"
                className="mb-4 -ml-3 text-slate-200 hover:bg-white/10 hover:text-white"
                onClick={() => router.push("/inventory/product-transfer")}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to list
              </Button>

              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight">
                  {transfer.transferNo}
                </h1>
                <Badge
                  variant="outline"
                  className={statusMeta.tone || "bg-slate-100 text-slate-800"}
                >
                  {statusMeta.label || transfer.status}
                </Badge>
                {transfer.locked ? (
                  <Badge
                    variant="outline"
                    className="bg-white/10 text-white border-white/20"
                  >
                    Locked
                  </Badge>
                ) : null}
                {transfer.status === "COMPLETED" ? (
                  <Badge
                    variant="outline"
                    className="bg-emerald-500/20 text-emerald-100 border-emerald-400/30"
                  >
                    Finished
                  </Badge>
                ) : null}
              </div>

              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                {transfer.transferMode === "DIRECT"
                  ? "Direct factory transfer"
                  : "Factory request transfer"}{" "}
                • {senderName} → {receiverName}
              </p>

              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">
                  {transfer.transferType}
                </span>
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">
                  {transfer.transferMode}
                </span>
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">
                  Step {Math.min(stepIndex + 1, workflowLabels.length)} /{" "}
                  {workflowLabels.length}
                </span>
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">
                  {statusMeta.hint}
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[380px]">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="text-xs uppercase tracking-wide text-slate-300">
                  Total lines
                </div>
                <div className="mt-1 text-2xl font-bold">
                  {totals.totalLines}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="text-xs uppercase tracking-wide text-slate-300">
                  Total qty
                </div>
                <div className="mt-1 text-2xl font-bold">{totals.totalQty}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="text-xs uppercase tracking-wide text-slate-300">
                  Estimated value
                </div>
                <div className="mt-1 text-2xl font-bold">
                  {currency(totals.totalValue)}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="text-xs uppercase tracking-wide text-slate-300">
                  Print status
                </div>
                <div className="mt-1 text-2xl font-bold">
                  {transfer.printSnapshot ? "Ready" : "Pending"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {transfer.status === "COMPLETED" ? (
          <Card className="shadow-sm border-emerald-200 bg-emerald-50">
            <CardContent className="flex items-center gap-3 p-4 text-emerald-900">
              <Check className="h-5 w-5" />
              <div>
                <div className="font-semibold">Transfer completed</div>
                <div className="text-sm">
                  The workflow is finished and no further stock actions are
                  available.
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle>Workflow progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-6">
              {workflowLabels.map((label, idx) => {
                const active = idx === stepIndex;
                const done = idx < stepIndex || transfer.status === "COMPLETED";
                return (
                  <div
                    key={label}
                    className={`rounded-2xl border p-4 ${
                      active
                        ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900"
                        : done
                          ? "border-emerald-200 bg-emerald-50"
                          : "bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">{label}</div>
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                          active
                            ? "bg-slate-900 text-white"
                            : done
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {done ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle>Transfer summary</CardTitle>
                <Button variant="outline" onClick={loadTransfer}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reload
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border bg-white p-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Sender
                    </div>
                    <div className="mt-1 font-semibold">{senderName}</div>
                    <div className="text-xs text-muted-foreground">
                      {getKind(transfer.sender)}
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-white p-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Receiver
                    </div>
                    <div className="mt-1 font-semibold">{receiverName}</div>
                    <div className="text-xs text-muted-foreground">
                      {getKind(transfer.receiver)}
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-white p-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Created by
                    </div>
                    <div className="mt-1 font-semibold">
                      {transfer.createdBy?.name ||
                        transfer.createdBy?.email ||
                        "-"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {transfer.createdAt
                        ? new Date(transfer.createdAt).toLocaleString()
                        : "-"}
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-white p-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Current stage
                    </div>
                    <div className="mt-1 font-semibold">{statusMeta.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {statusMeta.hint}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Items</CardTitle>
              </CardHeader>
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
                        </tr>
                      </thead>
                      <tbody>
                        {transfer.items.map((item, idx) => (
                          <tr
                            key={idx}
                            className="border-t align-top hover:bg-slate-50"
                          >
                            <td className="px-4 py-4">
                              <div className="space-y-2">
                                <div className="font-medium">
                                  {itemName(item)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  SKU: {itemSku(item)}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {rowHistory(item)}
                                </div>
                              </div>
                            </td>

                            <td className="px-4 py-4 text-sm font-medium">
                              {item.requestedQty}
                            </td>

                            <td className="px-4 py-4">
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
                                  className="h-11 w-28"
                                />
                              ) : (
                                <span className="text-sm font-medium">
                                  {item.finalQty}
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-4 text-sm">
                              {item.unit || "-"}
                            </td>

                            <td className="px-4 py-4 text-sm">
                              {currency(Number(item.costPrice || 0))}
                            </td>

                            <td className="px-4 py-4 text-sm font-semibold">
                              {currency(
                                Number(item.finalQty || 0) *
                                  Number(item.costPrice || 0),
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {editable ? (
                  <div className="mt-4 rounded-2xl border bg-slate-50 p-4 text-sm text-muted-foreground">
                    Direct factory transfer is still editable at draft stage.
                    {/* TODO: later role restriction should decide who can edit these values. */}
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border bg-slate-50 p-4 text-sm text-muted-foreground">
                    Quantities are locked for this stage.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Activity log</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(transfer.approvalLogs || []).length === 0 ? (
                    <div className="rounded-2xl border bg-slate-50 p-6 text-sm text-muted-foreground">
                      No activity yet.
                    </div>
                  ) : (
                    transfer.approvalLogs.map((log, idx) => (
                      <div
                        key={idx}
                        className="rounded-2xl border bg-white p-4"
                      >
                        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                          <div className="font-medium">
                            {log.status}
                            <span className="ml-2 text-xs text-muted-foreground">
                              by {log.role || "-"}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {log.actionAt
                              ? new Date(log.actionAt).toLocaleString()
                              : "-"}
                          </div>
                        </div>
                        {log.remarks ? (
                          <div className="mt-2 text-sm text-muted-foreground">
                            {log.remarks}
                          </div>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <div className="sticky top-6 space-y-6">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Status & next action</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Badge
                    variant="outline"
                    className={statusMeta.tone || "bg-slate-100 text-slate-800"}
                  >
                    {statusMeta.label || transfer.status}
                  </Badge>

                  <div className="rounded-2xl border bg-slate-50 p-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Next step
                    </div>
                    <div className="mt-1 font-semibold">{statusMeta.hint}</div>
                  </div>

                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>Lines</span>
                      <span className="font-medium text-slate-900">
                        {totals.totalLines}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Total qty</span>
                      <span className="font-medium text-slate-900">
                        {totals.totalQty}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Estimated value</span>
                      <span className="font-medium text-slate-900">
                        {currency(totals.totalValue)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Print snapshot</span>
                      <span className="font-medium text-slate-900">
                        {transfer.printSnapshot ? "Ready" : "Pending"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Signed copy</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">
                          {transfer.documents?.signed?.mediaId
                            ? "Uploaded"
                            : "Pending"}
                        </span>

                        {transfer.documents?.signed?.mediaId ? (
                          <a
                            href={getMediaPreviewUrl(
                              transfer.documents.signed.mediaId,
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                          >
                            Preview
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {transfer.status === "COMPLETED" ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                      ✅ This transfer is fully completed and stock has been
                      finalized.
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Remarks</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <textarea
                    className="min-h-[110px] w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Optional remarks"
                  />
                  <div className="text-xs text-muted-foreground">
                    Remarks are attached to workflow actions and logs.
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {editable ? (
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={saveDraft}
                      disabled={submitting}
                    >
                      Save draft
                    </Button>
                  ) : null}

                  {canPrint(transfer) ? (
                    <div className="w-full">
                      <TransferPrintTools
                        transfer={transfer}
                        onSnapshotReady={setTransfer}
                      />
                    </div>
                  ) : null}

                  {canDispatch(transfer) ? (
                    <Button
                      className="w-full"
                      onClick={dispatchTransfer}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FileText className="mr-2 h-4 w-4" />
                      )}
                      {transfer.status === "DRAFT"
                        ? "Dispatch transfer"
                        : "Dispatch now"}
                    </Button>
                  ) : null}

                  {transfer.status === "DISPATCHED" ? (
                    <div className="rounded-2xl border bg-amber-50 p-4 text-sm text-amber-900">
                      The receiver warehouse will receive the transfer and then
                      complete it from their action page.
                    </div>
                  ) : null}

                  {canReject(transfer) ? (
                    <div className="mt-2 grid gap-3">
                      <textarea
                        className="min-h-[90px] w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Reason for reject"
                      />
                      <Button
                        variant="destructive"
                        className="w-full"
                        onClick={rejectTransfer}
                        disabled={submitting}
                      >
                        Reject transfer
                      </Button>
                    </div>
                  ) : null}

                  {canCancel(transfer) ? (
                    <div className="mt-2 grid gap-3">
                      <textarea
                        className="min-h-[90px] w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none"
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="Reason for cancel"
                      />
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={cancelTransfer}
                        disabled={submitting}
                      >
                        Cancel transfer
                      </Button>
                    </div>
                  ) : null}

                  {transfer.status === "COMPLETED" ? (
                    <div className="rounded-2xl border bg-emerald-50 p-4 text-sm text-emerald-900">
                      This transfer is completed.
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Document status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="rounded-2xl border bg-white p-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Print snapshot
                    </div>
                    <div className="mt-1 font-semibold">
                      {transfer.printSnapshot ? "Ready" : "Not generated"}
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-white p-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Signed copy
                    </div>
                    <div className="mt-1 font-semibold">
                      {transfer.documents?.signed?.mediaId
                        ? "Uploaded"
                        : "Not uploaded"}
                    </div>
                    {transfer.documents?.signed?.mediaId ? (
                      <a
                        href={getMediaPreviewUrl(
                          transfer.documents.signed.mediaId,
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                      >
                        Preview uploaded document
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                  </div>

                  <div className="text-xs text-muted-foreground">
                    This page handles factory-side actions only. Receiving and
                    completion happen from the receiver side.
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
