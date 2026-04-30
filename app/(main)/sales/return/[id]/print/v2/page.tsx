"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type PrintItem = {
  productId?: any;
  productName?: string;
  sku?: string;
  soldQty?: number;
  soldBonusQty?: number;
  requestedQty?: number;
  finalApprovedQty?: number;
  warehouseReceivedQty?: number;
  returnAmountEstimate?: number;
  finalReturnAmount?: number;
  reason?: string;
};

type PrintBlock = {
  invoiceId?: any;
  invoiceNoSnapshot?: string;
  paymentStatusSnapshot?: string;
  balanceAmountSnapshot?: number;
  grandTotalSnapshot?: number;
  warehouseId?: any;
  items?: PrintItem[];
};

type PrintData = {
  returnDoc?: {
    _id?: string;
    returnNo?: string;
    customerId?: any;
    invoiceReturns?: PrintBlock[];
    totalRequestedAmount?: number;
    totalApprovedAmount?: number;
    totalReceivedAmount?: number;
    dealerDueReductionAmount?: number;
    printCount?: number;
    status?: string;
    createdAt?: string;
    updatedAt?: string;
    notes?: string;
    holdReason?: string;
    holdRemarks?: string;
  };
  qrCodeImage?: string;
  qrCodeData?: string;
  printPayload?: any;
};

const money = (n: number) =>
  Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

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

function lineQty(item: PrintItem) {
  return Number(item.finalApprovedQty || item.requestedQty || 0);
}

function receivedQty(item: PrintItem) {
  return Number(item.warehouseReceivedQty || 0);
}

function displayFinalQty(item: PrintItem) {
  return Number(item.finalApprovedQty || item.requestedQty || 0);
}

export default function SalesReturnPrintPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PrintData | null>(null);

  const printRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!id) return;

      setLoading(true);
      try {
        const res = await api.get(`/sales-returns/${id}/print`);
        setData(res.data?.data || res.data);
      } catch (err: any) {
        toast.error(
          err?.response?.data?.message ||
            err?.response?.data?.error ||
            err?.message ||
            "Failed to load print data.",
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  const doc = data?.returnDoc;

  const invoiceBlocks = useMemo(() => {
    return (doc?.invoiceReturns || []) as PrintBlock[];
  }, [doc]);

  const allItems = useMemo(() => {
    return invoiceBlocks.flatMap((block) =>
      (block.items || []).map((item) => ({
        block,
        item,
      })),
    );
  }, [invoiceBlocks]);

  const totals = useMemo(() => {
    let requested = 0;
    let approved = 0;
    let received = 0;

    for (const block of invoiceBlocks) {
      for (const item of block.items || []) {
        requested += Number(item.requestedQty || 0);
        approved += Number(item.finalApprovedQty || item.requestedQty || 0);
        received += Number(item.warehouseReceivedQty || 0);
      }
    }

    return {
      requested,
      approved,
      received,
    };
  }, [invoiceBlocks]);

  //   const onPrint = () => {
  //     const content = printRef.current;

  //     if (!content) {
  //       window.print();
  //       return;
  //     }

  //     const win = window.open("", "_blank", "width=1100,height=800");

  //     if (!win) {
  //       window.print();
  //       return;
  //     }

  //     const title = `Sales Return ${doc?.returnNo || ""}`;

  //     win.document.write(`
  //     <html>
  //       <head>
  //         <title>${title}</title>
  //         <style>
  //           body {
  //             font-family: Arial, sans-serif;
  //             padding: 24px;
  //             color: #111827;
  //             background: white;
  //           }

  //           .wrap {
  //             max-width: 980px;
  //             margin: 0 auto;
  //           }

  //           .row {
  //             display: flex;
  //             justify-content: space-between;
  //             gap: 16px;
  //           }

  //           .muted {
  //             color: #6b7280;
  //           }

  //           .card {
  //             border: 1px solid #e5e7eb;
  //             border-radius: 14px;
  //             padding: 16px;
  //             margin-bottom: 16px;
  //           }

  //           table {
  //             width: 100%;
  //             border-collapse: collapse;
  //             margin-top: 12px;
  //           }

  //           th, td {
  //             border: 1px solid #e5e7eb;
  //             padding: 8px;
  //             font-size: 12px;
  //           }

  //           th {
  //             background: #f9fafb;
  //             text-align: left;
  //           }

  //           .right {
  //             text-align: right;
  //           }

  //           .signature-box {
  //             height: 110px;
  //             border: 1px dashed #9ca3af;
  //             border-radius: 10px;
  //             display: flex;
  //             align-items: flex-end;
  //             justify-content: center;
  //             padding: 12px;
  //           }

  //           .qr-box {
  //             width: 150px;
  //             height: 150px;
  //             border: 1px solid #d1d5db;
  //             border-radius: 12px;
  //             display: flex;
  //             align-items: center;
  //             justify-content: center;
  //             text-align: center;
  //             padding: 10px;
  //             font-size: 11px;
  //             overflow-wrap: anywhere;
  //           }

  //           .small {
  //             font-size: 11px;
  //           }

  //           @page {
  //             size: A4;
  //             margin: 12mm;
  //           }
  //         </style>
  //       </head>
  //       <body>
  //         <div class="wrap">
  //           ${content.innerHTML}
  //         </div>
  //       </body>
  //     </html>
  //   `);

  //     win.document.close();

  //     setTimeout(() => {
  //       win.focus();
  //       win.print();
  //       win.close();
  //     }, 500);
  //   };

  const onPrint = () => {
    const content = printRef.current;

    if (!content) {
      window.print();
      return;
    }

    const win = window.open("", "_blank", "width=1100,height=800");

    if (!win) {
      window.print();
      return;
    }

    const title = `Sales Return ${doc?.returnNo || ""}`;

    win.document.open();

    win.document.write(`
    <html>
      <head>
        <title>${title}</title>

        <!-- IMPORTANT: Tailwind CDN so styles work -->
        <script src="https://cdn.tailwindcss.com"></script>

        <style>
          @page {
            size: A4;
            margin: 10mm;
          }

          body {
            font-family: Arial, sans-serif;
            background: #fff;
            color: #111827;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          table {
            border-collapse: collapse;
            width: 100%;
          }

          th, td {
            border: 1px solid #e5e7eb;
            padding: 6px;
          }

          th {
            background: #f9fafb;
          }

          .no-break {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .screen-only {
            display: none !important;
          }
        </style>
      </head>

      <body>
        <div class="p-4">
          ${content.outerHTML}
        </div>
      </body>
    </html>
  `);

    win.document.close();

    setTimeout(() => {
      win.focus();
      win.print();
      win.close();
    }, 500);
  };

  useEffect(() => {
    const afterPrint = () => {
      if (window.opener) {
        window.close();
      }
    };

    window.addEventListener("afterprint", afterPrint);
    return () => window.removeEventListener("afterprint", afterPrint);
  }, []);

  if (loading || !data || !doc) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto flex max-w-5xl items-center justify-center p-10">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading print view...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 print:bg-white">
      <div className="mx-auto w-full max-w-[210mm] px-4 py-4 md:px-6 md:py-6 print:max-w-none print:px-0 print:py-0">
        <div className="mb-4 flex items-center justify-between screen-only">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          <Button onClick={onPrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>

        <div
          ref={printRef}
          className="rounded-2xl border bg-white p-6 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none"
        >
          <div className="flex items-start justify-between gap-4 border-b pb-4 print:pb-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Sales Return Document
              </div>
              <h1 className="mt-1 text-2xl font-bold leading-tight">
                {doc.returnNo}
              </h1>
              <div className="mt-2 space-y-1 text-sm text-slate-600">
                <div>
                  Dealer:{" "}
                  <span className="font-medium text-slate-900">
                    {doc.customerId?.name || "-"}
                  </span>
                </div>
                <div>
                  Phone:{" "}
                  <span className="font-medium text-slate-900">
                    {doc.customerId?.phoneNumber || "-"}
                  </span>
                </div>
                <div>
                  Created:{" "}
                  <span className="font-medium">
                    {formatDateTime(doc.createdAt)}
                  </span>
                </div>
                <div>
                  Status:{" "}
                  <span className="font-medium">{doc.status || "-"}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              {data.qrCodeImage ? (
                <div className="rounded-xl border p-2">
                  <img
                    src={data.qrCodeImage}
                    alt="QR code"
                    className="h-28 w-28 object-contain"
                  />
                </div>
              ) : null}
              <div className="text-right text-xs text-slate-500">
                Scan to verify the return
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:gap-2">
            <Metric
              title="Requested"
              value={money(Number(doc.totalRequestedAmount || 0))}
            />
            <Metric
              title="Approved"
              value={money(Number(doc.totalApprovedAmount || 0))}
            />
            <Metric
              title="Received"
              value={money(Number(doc.totalReceivedAmount || 0))}
            />
            <Metric title="Print Count" value={Number(doc.printCount || 0)} />
          </div>

          <div className="mt-4 rounded-xl border bg-slate-50 p-4 text-sm text-slate-700">
            <div className="font-semibold text-slate-900">Workflow note</div>
            <div className="mt-1">
              This print is used for warehouse verification. If the physically
              received quantity does not match the printed approved quantity,
              the backend will move the return to HOLD.
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {invoiceBlocks.map((block, index) => {
              const blockRequested = (block.items || []).reduce(
                (sum, item) => sum + Number(item.requestedQty || 0),
                0,
              );
              const blockApproved = (block.items || []).reduce(
                (sum, item) =>
                  sum + Number(item.finalApprovedQty || item.requestedQty || 0),
                0,
              );
              const blockReceived = (block.items || []).reduce(
                (sum, item) => sum + Number(item.warehouseReceivedQty || 0),
                0,
              );

              return (
                <div
                  key={`${block.invoiceId}-${index}`}
                  className="rounded-2xl border print:break-inside-avoid"
                >
                  <div className="flex flex-col gap-2 border-b bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        Invoice: {block.invoiceNoSnapshot || "-"}
                      </div>
                      <div className="text-xs text-slate-500">
                        Payment: {block.paymentStatusSnapshot || "-"} · Balance
                        Snapshot:{" "}
                        {money(Number(block.balanceAmountSnapshot || 0))}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <MiniMetric label="Requested" value={blockRequested} />
                      <MiniMetric label="Approved" value={blockApproved} />
                      <MiniMetric label="Received" value={blockReceived} />
                    </div>
                  </div>

                  <div className="overflow-hidden">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-white text-left text-xs uppercase tracking-wide text-slate-500">
                          <th className="border-b px-4 py-3 font-medium">
                            Product
                          </th>
                          <th className="border-b px-4 py-3 font-medium">
                            Sold
                          </th>
                          <th className="border-b px-4 py-3 font-medium">
                            Requested
                          </th>
                          <th className="border-b px-4 py-3 font-medium">
                            Approved
                          </th>
                          <th className="border-b px-4 py-3 font-medium">
                            Received
                          </th>
                          <th className="border-b px-4 py-3 font-medium">
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(block.items || []).map((item, idx) => {
                          const approved = displayFinalQty(item);
                          return (
                            <tr
                              key={`${block.invoiceId}-${idx}`}
                              className="align-top print:break-inside-avoid"
                            >
                              <td className="border-b px-4 py-3">
                                <div className="font-medium text-slate-900">
                                  {item.productId?.name ||
                                    item.productName ||
                                    "-"}
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                  SKU: {item.sku || "-"}
                                </div>
                                {item.reason ? (
                                  <div className="mt-1 text-xs text-slate-500">
                                    Reason: {item.reason}
                                  </div>
                                ) : null}
                              </td>
                              <td className="border-b px-4 py-3">
                                {Number(item.soldQty || 0) +
                                  Number(item.soldBonusQty || 0)}
                              </td>
                              <td className="border-b px-4 py-3">
                                {Number(item.requestedQty || 0)}
                              </td>
                              <td className="border-b px-4 py-3">{approved}</td>
                              <td className="border-b px-4 py-3">
                                {receivedQty(item) || "-"}
                              </td>
                              <td className="border-b px-4 py-3">
                                {money(
                                  Number(
                                    item.finalReturnAmount ||
                                      item.returnAmountEstimate ||
                                      0,
                                  ),
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 print:gap-3">
            <div className="rounded-xl border p-4 print:break-inside-avoid">
              <div className="text-sm font-semibold text-slate-900">
                Return Summary
              </div>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                <Row label="Total Requested Qty" value={totals.requested} />
                <Row label="Total Approved Qty" value={totals.approved} />
                <Row label="Total Received Qty" value={totals.received} />
                <Row
                  label="Requested Amount"
                  value={money(Number(doc.totalRequestedAmount || 0))}
                />
                <Row
                  label="Approved Amount"
                  value={money(Number(doc.totalApprovedAmount || 0))}
                />
                <Row
                  label="Received Amount"
                  value={money(Number(doc.totalReceivedAmount || 0))}
                />
              </div>
            </div>

            <div className="rounded-xl border p-4 print:break-inside-avoid">
              <div className="text-sm font-semibold text-slate-900">Notes</div>
              <div className="mt-2 text-sm text-slate-700">
                {doc.notes || "No notes provided."}
              </div>

              {doc.holdReason ? (
                <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-700">
                  <div className="font-semibold">Hold Reason</div>
                  <div className="mt-1">{doc.holdReason}</div>
                  {doc.holdRemarks ? (
                    <div className="mt-1 text-xs">{doc.holdRemarks}</div>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-5 grid grid-cols-2 gap-3 text-xs text-slate-500">
                <div className="rounded-lg border p-3">
                  <div className="font-medium text-slate-700">Prepared By</div>
                  <div className="mt-2 h-6 border-b border-dashed" />
                </div>
                <div className="rounded-lg border p-3">
                  <div className="font-medium text-slate-700">Checked By</div>
                  <div className="mt-2 h-6 border-b border-dashed" />
                </div>
                <div className="rounded-lg border p-3">
                  <div className="font-medium text-slate-700">Warehouse</div>
                  <div className="mt-2 h-6 border-b border-dashed" />
                </div>
                <div className="rounded-lg border p-3">
                  <div className="font-medium text-slate-700">Head Account</div>
                  <div className="mt-2 h-6 border-b border-dashed" />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 text-right text-xs text-slate-500">
            Printed at {formatDateTime(new Date().toISOString())}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 10mm;
        }

        @media print {
          html,
          body {
            background: #ffffff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .screen-only {
            display: none !important;
          }

          .print\\:break-inside-avoid {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .print\\:rounded-none {
            border-radius: 0 !important;
          }

          .print\\:border-0 {
            border: 0 !important;
          }

          .print\\:shadow-none {
            box-shadow: none !important;
          }

          .print\\:p-0 {
            padding: 0 !important;
          }

          .print\\:px-0 {
            padding-left: 0 !important;
            padding-right: 0 !important;
          }

          .print\\:py-0 {
            padding-top: 0 !important;
            padding-bottom: 0 !important;
          }

          .print\\:gap-2 {
            gap: 0.5rem !important;
          }

          .print\\:break-after-page {
            break-after: page;
            page-break-after: always;
          }

          button {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-slate-50 px-3 py-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">
        {title}
      </div>
      <div className="mt-1 text-base font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border bg-white px-2 py-1 text-center">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}
