"use client";

import React, { useMemo, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Printer, X } from "lucide-react";

type Props = {
  transfer: any;
  onSnapshotReady?: (updated: any) => void;
};

function getName(loc: any) {
  return (
    loc?.name || loc?.warehouseName || loc?.factoryName || loc?.code || "-"
  );
}

function getKind(loc: any) {
  const t = String(loc?.type || loc?.kind || "").toLowerCase();
  if (t.includes("factory")) return "Factory";
  if (t.includes("warehouse")) return "Warehouse";
  return "Location";
}

function currency(n: number) {
  return Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function TransferPrintTools({
  transfer,
  onSnapshotReady,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);

  if (!transfer) return null;

  // ✅ SINGLE SOURCE OF TRUTH
  const snapshot = transfer.printSnapshot;
  const items = useMemo(() => {
    const base = snapshot?.items || transfer.items || [];
    return base.map((i: any) => ({
      name: i.productId?.name || i.name || "-",
      sku: i.productId?.sku || i.sku || "-",
      qty: i.finalQty ?? i.qty ?? 0,
      unit: i.unit || "-",
      costPrice: i.costPrice || 0,
    }));
  }, [snapshot, transfer]);

  async function ensureSnapshot() {
    if (transfer.printSnapshot) return transfer;

    setLoading(true);
    try {
      const res = await api.post(`/transfers/${transfer._id}/print-snapshot`);
      const updated = res.data?.data;
      onSnapshotReady?.(updated);
      return updated;
    } finally {
      setLoading(false);
    }
  }

  async function handlePreview() {
    try {
      await ensureSnapshot();
      setOpen(true);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load preview");
    }
  }

  async function handlePrint() {
    try {
      setPrinting(true);

      const updated = await ensureSnapshot();
      const snap = updated.printSnapshot;
      const list = snap?.items || updated.items || [];

      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        toast.error("Popup blocked");
        return;
      }

      const html = `
<!DOCTYPE html>
<html>
<head>
<title>Transfer Print</title>
<style>
  @page { size: A4; margin: 18mm; }

  body {
    font-family: Arial, sans-serif;
    color: #000;
    font-size: 12px;
  }

  .header {
    border-bottom: 2px solid #000;
    padding-bottom: 10px;
    margin-bottom: 15px;
  }

  .title {
    font-size: 20px;
    font-weight: bold;
  }

  .meta {
    margin-top: 6px;
    font-size: 12px;
  }

  .grid {
    display: flex;
    justify-content: space-between;
    margin: 15px 0;
  }

  .box {
    width: 48%;
    border: 1px solid #000;
    padding: 10px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 15px;
  }

  th, td {
    border: 1px solid #000;
    padding: 6px;
    font-size: 11px;
  }

  th {
    background: #f0f0f0;
    text-align: left;
  }

  td.num {
    text-align: right;
  }

  .footer {
    margin-top: 30px;
    display: flex;
    justify-content: space-between;
    font-size: 12px;
  }

  .sign {
    margin-top: 40px;
  }
</style>
</head>

<body>
  <div class="header">
    <div class="title">WAREHOUSE TRANSFER</div>
    <div class="meta">
      <div><b>No:</b> ${updated.transferNo}</div>
      <div><b>Status:</b> ${updated.status}</div>
      <div><b>Type:</b> ${updated.transferType}</div>
    </div>
  </div>

  <div class="grid">
    <div class="box">
      <b>Sender</b><br/>
      ${getName(updated.sender)}<br/>
      ${getKind(updated.sender)}
    </div>

    <div class="box">
      <b>Receiver</b><br/>
      ${getName(updated.receiver)}<br/>
      ${getKind(updated.receiver)}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Product</th>
        <th>SKU</th>
        <th>Qty</th>
        <th>Unit</th>
        <th>Cost</th>
        <th>Value</th>
      </tr>
    </thead>

    <tbody>
      ${list
        .map(
          (i: any, idx: number) => `
        <tr>
          <td>${idx + 1}</td>
          <td>${i.productId?.name || i.name || "-"}</td>
          <td>${i.productId?.sku || "-"}</td>
          <td class="num">${i.finalQty ?? i.qty ?? 0}</td>
          <td>${i.unit || "-"}</td>
          <td class="num">${currency(i.costPrice)}</td>
          <td class="num">${currency((i.finalQty ?? i.qty ?? 0) * (i.costPrice || 0))}</td>
        </tr>
      `,
        )
        .join("")}
    </tbody>
  </table>

  <div class="footer">
    <div>
      Printed By: ${snap?.printedByName || "-"}<br/>
      Printed At: ${snap?.printedAt ? new Date(snap.printedAt).toLocaleString() : "-"}
    </div>

    <div class="sign">
      Receiver Signature: ________________________
    </div>
  </div>

<script>
  window.onload = function () {
    setTimeout(() => {
      window.print();
      window.onafterprint = () => window.close();
    }, 300);
  };
</script>

</body>
</html>
`;

      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();

      setTimeout(() => setPrinting(false), 500);
    } catch (e: any) {
      setPrinting(false);
      toast.error(e?.message || "Print failed");
    }
  }

  return (
    <>
      <Button
        onClick={handlePreview}
        disabled={loading || printing}
        variant="outline"
        className="w-full"
      >
        <FileText className="mr-2 h-4 w-4" />
        {loading ? "Preparing..." : "Preview / Print"}
      </Button>

      {/* PREVIEW MODAL */}
      {open && (
        <div className="fixed inset-0 z-[100] bg-black/60 p-4 print:hidden">
          <div className="mx-auto flex h-full max-w-6xl flex-col rounded-2xl bg-white">
            {/* header */}
            <div className="flex items-center justify-between border-b p-4">
              <div>
                <div className="text-lg font-bold">Print Preview</div>
                <div className="text-sm text-muted-foreground">
                  {transfer.transferNo}
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  <X className="mr-2 h-4 w-4" />
                  Close
                </Button>

                <Button onClick={handlePrint} disabled={printing}>
                  <Printer className="mr-2 h-4 w-4" />
                  {printing ? "Printing..." : "Print"}
                </Button>
              </div>
            </div>

            {/* preview body */}
            <div className="flex-1 overflow-auto bg-slate-100 p-6">
              <Card className="mx-auto max-w-5xl">
                <CardContent className="p-6 text-black">
                  <div className="text-xl font-bold">
                    WAREHOUSE TRANSFER SHEET
                  </div>

                  <div className="mt-2 text-sm">
                    {transfer.transferNo} • {transfer.status}
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
                    <div className="border p-3">
                      <b>Sender</b>
                      <br />
                      {getName(transfer.sender)}
                    </div>
                    <div className="border p-3">
                      <b>Receiver</b>
                      <br />
                      {getName(transfer.receiver)}
                    </div>
                  </div>

                  <table className="mt-6 w-full border text-sm">
                    <thead>
                      <tr>
                        <th className="border p-2">Product</th>
                        <th className="border p-2">Qty</th>
                        <th className="border p-2">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((i, idx) => (
                        <tr key={idx}>
                          <td className="border p-2">{i.name}</td>
                          <td className="border p-2">{i.qty}</td>
                          <td className="border p-2">
                            {currency(i.costPrice)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
