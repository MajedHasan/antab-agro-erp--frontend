"use client";

import React, { useMemo, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Printer, X, Loader2 } from "lucide-react";

type TransferPrintToolsProps = {
  transfer: any;
  onSnapshotReady?: (updatedTransfer: any) => void;
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

function formatDate(value?: string | Date | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

function escapeHtml(input: any) {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getItemName(item: any) {
  return (
    item?.name ||
    item?.productId?.name ||
    item?.productId?.sku ||
    item?.productId?.code ||
    "Product"
  );
}

function getItemSku(item: any) {
  return item?.sku || item?.productId?.sku || "-";
}

function getQty(item: any) {
  return Number(item?.qty ?? item?.finalQty ?? item?.requestedQty ?? 0);
}

function getCost(item: any) {
  return Number(item?.costPrice ?? 0);
}

function getLineTotal(item: any) {
  return getQty(item) * getCost(item);
}

export default function TransferPrintTools({
  transfer,
  onSnapshotReady,
}: TransferPrintToolsProps) {
  const [open, setOpen] = useState(false);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [printing, setPrinting] = useState(false);

  const snapshot = transfer?.printSnapshot || null;

  const printableItems = useMemo(() => {
    if (snapshot?.items?.length) {
      return snapshot.items.map((item: any) => ({
        productId: item.productId?._id || item.productId,
        name:
          item.name || item.productId?.name || item.productId?.sku || "Product",
        sku: item.sku || item.productId?.sku || "-",
        qty: Number(item.qty ?? item.finalQty ?? item.requestedQty ?? 0),
        unit: item.unit || "-",
        costPrice: Number(item.costPrice ?? 0),
      }));
    }

    return (transfer?.items || []).map((item: any) => ({
      productId: item.productId?._id || item.productId,
      name: item.productId?.name || item.productId?.sku || "Product",
      sku: item.productId?.sku || "-",
      qty: Number(item.finalQty ?? item.requestedQty ?? 0),
      unit: item.unit || "-",
      costPrice: Number(item.costPrice ?? 0),
    }));
  }, [snapshot, transfer]);

  const totals = useMemo(() => {
    const totalLines = printableItems.length;
    const totalQty = printableItems.reduce((s, i) => s + Number(i.qty || 0), 0);
    const totalValue = printableItems.reduce(
      (s, i) => s + Number(i.qty || 0) * Number(i.costPrice || 0),
      0,
    );

    return { totalLines, totalQty, totalValue };
  }, [printableItems]);

  async function ensureSnapshot() {
    if (!transfer?._id) {
      throw new Error("Transfer not available");
    }

    if (transfer.printSnapshot) {
      return transfer;
    }

    setLoadingSnapshot(true);
    try {
      const res = await api.post(`/transfers/${transfer._id}/print-snapshot`);
      const updated = res.data?.data;
      onSnapshotReady?.(updated);
      return updated;
    } finally {
      setLoadingSnapshot(false);
    }
  }

  function buildPrintHtml(updated: any) {
    const snap = updated?.printSnapshot || null;
    const senderName = snap?.sender?.name || getName(updated?.sender);
    const receiverName = snap?.receiver?.name || getName(updated?.receiver);

    const items = (snap?.items?.length ? snap.items : updated?.items || []).map(
      (item: any, idx: number) => {
        const name = getItemName(item);
        const sku = getItemSku(item);
        const qty = Number(
          item?.qty ?? item?.finalQty ?? item?.requestedQty ?? 0,
        );
        const unit = item?.unit || "-";
        const cost = Number(item?.costPrice ?? 0);
        const lineTotal = qty * cost;

        return `
          <tr>
            <td>${idx + 1}</td>
            <td>${escapeHtml(name)}</td>
            <td>${escapeHtml(sku)}</td>
            <td class="num">${qty}</td>
            <td>${escapeHtml(unit)}</td>
            <td class="num">${currency(cost)}</td>
            <td class="num">${currency(lineTotal)}</td>
          </tr>
        `;
      },
    );

    const logs = (updated?.approvalLogs || [])
      .slice()
      .reverse()
      .map(
        (log: any) => `
          <div class="log-item">
            <div class="log-left">
              <div class="log-status">${escapeHtml(log?.status || "-")}</div>
              <div class="log-meta">${escapeHtml(log?.role || "-")} • ${formatDate(log?.actionAt)}</div>
            </div>
            <div class="log-remarks">${escapeHtml(log?.remarks || "")}</div>
          </div>
        `,
      )
      .join("");

    return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Transfer ${escapeHtml(updated?.transferNo || "")}</title>
  <style>
    @page {
      size: A4;
      margin: 12mm;
    }
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      color: #111827;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet {
      width: 100%;
      max-width: 210mm;
      margin: 0 auto;
      padding: 0;
    }
    .header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      border-bottom: 2px solid #111827;
      padding-bottom: 14px;
      margin-bottom: 16px;
    }
    .title {
      font-size: 24px;
      font-weight: 700;
      line-height: 1.2;
      margin: 0;
    }
    .subtitle {
      margin-top: 6px;
      font-size: 12px;
      color: #4b5563;
    }
    .badge {
      display: inline-block;
      border: 1px solid #d1d5db;
      border-radius: 999px;
      padding: 6px 10px;
      font-size: 12px;
      margin-left: 8px;
      vertical-align: middle;
    }
    .section {
      margin-bottom: 16px;
    }
    .section-title {
      font-size: 14px;
      font-weight: 700;
      margin: 0 0 8px 0;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .meta {
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 12px;
      background: #fafafa;
      min-height: 74px;
    }
    .meta-label {
      font-size: 11px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 5px;
    }
    .meta-value {
      font-size: 13px;
      font-weight: 600;
      line-height: 1.4;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    th, td {
      border: 1px solid #d1d5db;
      padding: 8px 7px;
      vertical-align: top;
    }
    th {
      background: #f3f4f6;
      text-align: left;
      font-weight: 700;
    }
    td.num, th.num {
      text-align: right;
      white-space: nowrap;
    }
    .summary-row {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
    }
    .summary-box {
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 12px;
      background: #fff;
    }
    .summary-label {
      font-size: 11px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 4px;
    }
    .summary-value {
      font-size: 15px;
      font-weight: 700;
    }
    .log-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .log-item {
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 10px 12px;
      background: #fff;
    }
    .log-left {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: baseline;
    }
    .log-status {
      font-weight: 700;
      font-size: 12px;
    }
    .log-meta {
      font-size: 11px;
      color: #6b7280;
    }
    .log-remarks {
      margin-top: 6px;
      font-size: 12px;
      color: #374151;
      white-space: pre-wrap;
    }
    .signatures {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
      margin-top: 24px;
    }
    .sig {
      border-top: 1px solid #111827;
      padding-top: 8px;
      font-size: 12px;
      min-height: 50px;
    }
    .footer {
      margin-top: 18px;
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #6b7280;
      border-top: 1px solid #e5e7eb;
      padding-top: 10px;
    }
    .muted {
      color: #6b7280;
      font-weight: 400;
    }
    .page-break {
      page-break-before: always;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div>
        <h1 class="title">Transfer Sheet</h1>
        <div class="subtitle">
          Transfer No: <strong>${escapeHtml(updated?.transferNo || "-")}</strong>
          <span class="badge">${escapeHtml(updated?.transferType || "-")}</span>
          <span class="badge">${escapeHtml(updated?.transferMode || "-")}</span>
          <span class="badge">${escapeHtml(updated?.status || "-")}</span>
        </div>
      </div>
      <div style="text-align:right;">
        <div class="subtitle">Prepared for dispatch / receiving</div>
        <div class="subtitle">Printed At: ${escapeHtml(formatDate(snap?.printedAt || new Date()))}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Summary</div>
      <div class="summary-row">
        <div class="summary-box">
          <div class="summary-label">Sender</div>
          <div class="summary-value">${escapeHtml(senderName)}</div>
          <div class="muted">${escapeHtml(getKind(updated?.sender))}</div>
        </div>
        <div class="summary-box">
          <div class="summary-label">Receiver</div>
          <div class="summary-value">${escapeHtml(receiverName)}</div>
          <div class="muted">${escapeHtml(getKind(updated?.receiver))}</div>
        </div>
        <div class="summary-box">
          <div class="summary-label">Created By</div>
          <div class="summary-value">${escapeHtml(updated?.createdBy?.name || updated?.createdBy?.email || "-")}</div>
          <div class="muted">${escapeHtml(formatDate(updated?.createdAt))}</div>
        </div>
        <div class="summary-box">
          <div class="summary-label">Current Stage</div>
          <div class="summary-value">${escapeHtml(updated?.status || "-")}</div>
          <div class="muted">${escapeHtml(updated?.locked ? "Locked" : "Editable")}</div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Location details</div>
      <div class="grid">
        <div class="meta">
          <div class="meta-label">Sender location</div>
          <div class="meta-value">${escapeHtml(senderName)}</div>
          <div class="muted">${escapeHtml(getKind(updated?.sender))}</div>
        </div>
        <div class="meta">
          <div class="meta-label">Receiver location</div>
          <div class="meta-value">${escapeHtml(receiverName)}</div>
          <div class="muted">${escapeHtml(getKind(updated?.receiver))}</div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Items</div>
      <table>
        <thead>
          <tr>
            <th style="width: 36px;">#</th>
            <th>Product</th>
            <th>SKU</th>
            <th class="num" style="width: 70px;">Requested</th>
            <th class="num" style="width: 60px;">Final</th>
            <th style="width: 60px;">Unit</th>
            <th class="num" style="width: 90px;">Cost</th>
            <th class="num" style="width: 100px;">Line Total</th>
          </tr>
        </thead>
        <tbody>
          ${items}
        </tbody>
      </table>
    </div>

    <div class="section">
      <div class="section-title">Totals</div>
      <div class="summary-row">
        <div class="summary-box">
          <div class="summary-label">Total lines</div>
          <div class="summary-value">${totals.totalLines}</div>
        </div>
        <div class="summary-box">
          <div class="summary-label">Total qty</div>
          <div class="summary-value">${totals.totalQty}</div>
        </div>
        <div class="summary-box">
          <div class="summary-label">Estimated value</div>
          <div class="summary-value">${currency(totals.totalValue)}</div>
        </div>
        <div class="summary-box">
          <div class="summary-label">Documents</div>
          <div class="summary-value">${updated?.printSnapshot ? "Ready" : "Pending"}</div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Approval / activity log</div>
      <div class="log-list">
        ${
          logs ||
          `<div class="meta"><div class="meta-value">No activity log available.</div></div>`
        }
      </div>
    </div>

    <div class="signatures">
      <div class="sig">
        Sender / Dispatch Signature
        <div class="muted" style="margin-top: 4px;">____________________________</div>
      </div>
      <div class="sig" style="text-align:right;">
        Receiver Signature
        <div class="muted" style="margin-top: 4px;">____________________________</div>
      </div>
    </div>

    <div class="footer">
      <div>Printed by: ${escapeHtml(snap?.printedByName || updated?.createdBy?.name || "-")}</div>
      <div>Generated from ERP transfer module</div>
    </div>
  </div>
</body>
</html>`;
  }

  async function ensureSnapshot() {
    if (!transfer?._id) {
      throw new Error("Transfer not available");
    }

    if (transfer.printSnapshot) {
      return transfer;
    }

    setLoadingSnapshot(true);
    try {
      const res = await api.post(`/transfers/${transfer._id}/print-snapshot`);
      const updated = res.data?.data;
      onSnapshotReady?.(updated);
      return updated;
    } finally {
      setLoadingSnapshot(false);
    }
  }

  async function handlePreview() {
    try {
      const updated = await ensureSnapshot();
      if (!updated) return;
      setOpen(true);
    } catch (err: any) {
      console.error(err);
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to prepare print sheet",
      );
    }
  }

  async function handlePrint() {
    try {
      setPrinting(true);

      const updated = await ensureSnapshot();
      if (!updated) return;

      const printWindow = window.open(
        "",
        "_blank",
        "noopener,noreferrer,width=1100,height=900",
      );

      if (!printWindow) {
        toast.error("Popup blocked");
        setPrinting(false);
        return;
      }

      const html = buildPrintHtml(updated);

      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();

      const triggerPrint = () => {
        try {
          printWindow.print();
        } catch (e) {
          console.error(e);
        }
      };

      if (printWindow.document.readyState === "complete") {
        setTimeout(triggerPrint, 300);
      } else {
        printWindow.onload = () => setTimeout(triggerPrint, 300);
      }

      printWindow.onafterprint = () => {
        try {
          printWindow.close();
        } catch {
          // ignore
        }
      };

      setPrinting(false);
    } catch (err: any) {
      console.error(err);
      toast.error(
        err?.response?.data?.message || err?.message || "Print failed",
      );
      setPrinting(false);
    }
  }

  if (!transfer) return null;

  const previewSheet = (
    <div className="mx-auto w-full max-w-[210mm] bg-white text-black shadow-2xl">
      <div className="border-b border-slate-300 px-8 py-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-2xl font-bold">Transfer Sheet</div>
            <div className="mt-1 text-sm">
              Transfer No: <strong>{transfer.transferNo}</strong>
            </div>
            <div className="mt-1 text-sm text-slate-600">
              {transfer.transferType} • {transfer.transferMode} •{" "}
              {transfer.status}
            </div>
          </div>
          <div className="text-right text-sm text-slate-600">
            <div>Created: {formatDate(transfer.createdAt)}</div>
            <div>Updated: {formatDate(transfer.updatedAt)}</div>
          </div>
        </div>
      </div>

      <div className="space-y-6 px-8 py-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="rounded-lg border border-slate-300 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Sender
            </div>
            <div className="mt-1 font-semibold">{getName(transfer.sender)}</div>
            <div className="text-slate-600">{getKind(transfer.sender)}</div>
          </div>
          <div className="rounded-lg border border-slate-300 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Receiver
            </div>
            <div className="mt-1 font-semibold">
              {getName(transfer.receiver)}
            </div>
            <div className="text-slate-600">{getKind(transfer.receiver)}</div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-lg border border-slate-300 p-4">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">
              Total lines
            </div>
            <div className="mt-1 text-xl font-bold">{totals.totalLines}</div>
          </div>
          <div className="rounded-lg border border-slate-300 p-4">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">
              Total qty
            </div>
            <div className="mt-1 text-xl font-bold">{totals.totalQty}</div>
          </div>
          <div className="rounded-lg border border-slate-300 p-4">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">
              Estimated value
            </div>
            <div className="mt-1 text-xl font-bold">
              {currency(totals.totalValue)}
            </div>
          </div>
          <div className="rounded-lg border border-slate-300 p-4">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">
              Documents
            </div>
            <div className="mt-1 text-xl font-bold">
              {transfer.printSnapshot ? "Ready" : "Pending"}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 text-sm font-semibold">Items</div>
          <div className="overflow-hidden rounded-lg border border-slate-300">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 p-2 text-left">#</th>
                  <th className="border border-slate-300 p-2 text-left">
                    Product
                  </th>
                  <th className="border border-slate-300 p-2 text-left">SKU</th>
                  <th className="border border-slate-300 p-2 text-right">
                    Requested
                  </th>
                  <th className="border border-slate-300 p-2 text-right">
                    Final
                  </th>
                  <th className="border border-slate-300 p-2 text-left">
                    Unit
                  </th>
                  <th className="border border-slate-300 p-2 text-right">
                    Cost
                  </th>
                  <th className="border border-slate-300 p-2 text-right">
                    Line total
                  </th>
                </tr>
              </thead>
              <tbody>
                {printableItems.map((item: any, idx: number) => (
                  <tr key={idx}>
                    <td className="border border-slate-300 p-2">{idx + 1}</td>
                    <td className="border border-slate-300 p-2">
                      {item.name || "-"}
                    </td>
                    <td className="border border-slate-300 p-2">
                      {item.sku || "-"}
                    </td>
                    <td className="border border-slate-300 p-2 text-right">
                      {Number(item.requestedQty ?? item.qty ?? 0)}
                    </td>
                    <td className="border border-slate-300 p-2 text-right">
                      {Number(
                        item.qty ?? item.finalQty ?? item.requestedQty ?? 0,
                      )}
                    </td>
                    <td className="border border-slate-300 p-2">
                      {item.unit || "-"}
                    </td>
                    <td className="border border-slate-300 p-2 text-right">
                      {currency(Number(item.costPrice || 0))}
                    </td>
                    <td className="border border-slate-300 p-2 text-right">
                      {currency(
                        Number(item.qty || 0) * Number(item.costPrice || 0),
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 text-sm">
          <div>
            <div className="rounded-lg border border-slate-300 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                Approval log
              </div>
              <div className="mt-2 space-y-2">
                {(transfer.approvalLogs || []).length ? (
                  transfer.approvalLogs.map((log: any, idx: number) => (
                    <div
                      key={idx}
                      className="border-b border-slate-200 pb-2 last:border-b-0 last:pb-0"
                    >
                      <div className="font-medium">{log.status}</div>
                      <div className="text-xs text-slate-600">
                        {log.role || "-"} • {formatDate(log.actionAt)}
                      </div>
                      {log.remarks ? (
                        <div className="mt-1 text-xs text-slate-700">
                          {log.remarks}
                        </div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="text-slate-600">No activity yet.</div>
                )}
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-300 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                Printed by
              </div>
              <div className="mt-1 font-semibold">
                {snapshot?.printedByName || transfer.createdBy?.name || "-"}
              </div>
              <div className="text-slate-600">
                {formatDate(snapshot?.printedAt || new Date())}
              </div>
            </div>
            <div className="rounded-lg border border-slate-300 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                Signature
              </div>
              <div className="mt-8 border-t border-slate-900 pt-2 text-center text-slate-700">
                Receiver Signature
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Button
        variant="outline"
        onClick={handlePreview}
        disabled={loadingSnapshot || printing}
        className="w-full"
      >
        <FileText className="mr-2 h-4 w-4" />
        {loadingSnapshot ? "Preparing..." : "Preview / Print"}
      </Button>

      {open && (
        <div className="fixed inset-0 z-[100] bg-black/60 p-4 print:hidden">
          <div className="mx-auto flex h-full max-w-[95vw] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <div className="text-lg font-bold">Print Preview</div>
                <div className="text-sm text-muted-foreground">
                  Transfer No: {transfer.transferNo}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  <X className="mr-2 h-4 w-4" />
                  Close
                </Button>

                <Button
                  onClick={handlePrint}
                  disabled={loadingSnapshot || printing}
                >
                  <Printer className="mr-2 h-4 w-4" />
                  {printing ? "Printing..." : "Print"}
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-slate-100 p-6">
              <div className="mx-auto max-w-[210mm]">{previewSheet}</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
