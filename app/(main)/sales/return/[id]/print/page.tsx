"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

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
  items?: PrintItem[];
};

type PrintData = {
  returnDoc?: any;
  qrCodeImage?: string;
};

const money = (n: number) =>
  Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatDateTime = (value?: string) => {
  if (!value) return "-";
  const d = new Date(value);
  return isNaN(d.getTime())
    ? "-"
    : d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
};

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
      try {
        const res = await api.get(`/sales-returns/${id}/print`);
        setData(res.data?.data || res.data);
      } catch (err: any) {
        toast.error(err?.message || "Failed to load print data.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const doc = data?.returnDoc;
  const blocks = doc?.invoiceReturns || [];

  const onPrint = () => window.print();

  if (loading || !doc) {
    return (
      <div className="p-10 flex items-center gap-2 text-gray-500">
        <Loader2 className="animate-spin h-4 w-4" />
        Loading...
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen print:bg-white">
      {/* Top bar */}
      <div className="screen-only flex justify-between p-3">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button onClick={onPrint}>
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
      </div>

      {/* PRINT AREA */}
      <div
        ref={printRef}
        className="mx-auto w-[210mm] bg-white p-4 print:p-2 text-sm text-slate-900"
      >
        {/* HEADER (compressed) */}
        <div className="flex justify-between border-b pb-2">
          <div>
            <div className="text-xs uppercase text-gray-500">Sales Return</div>
            <div className="text-lg font-bold">{doc.returnNo}</div>

            <div className="text-xs text-gray-600 mt-1">
              Dealer: {doc.customerId?.name || "-"} | Phone:{" "}
              {doc.customerId?.phoneNumber || "-"}
            </div>

            <div className="text-xs text-gray-500">
              {formatDateTime(doc.createdAt)} | {doc.status}
            </div>
          </div>

          {data.qrCodeImage && (
            <img src={data.qrCodeImage} className="h-20 w-20" alt="QR" />
          )}
        </div>

        {/* TABLES */}
        <div className="mt-2 space-y-2">
          {blocks.map((block: PrintBlock, i: number) => (
            <div key={i} className="border rounded">
              {/* invoice header */}
              <div className="flex justify-between bg-gray-50 px-2 py-1 text-xs">
                <div>Invoice: {block.invoiceNoSnapshot}</div>
                <div>Balance: {money(block.balanceAmountSnapshot || 0)}</div>
              </div>

              {/* table */}
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-1 text-left">Product</th>
                    <th className="p-1">Req</th>
                    <th className="p-1">App</th>
                    <th className="p-1">Rec</th>
                    <th className="p-1">Amt</th>
                  </tr>
                </thead>

                <tbody>
                  {(block.items || []).map((item, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-1">
                        <div className="font-medium">{item.productName}</div>
                        <div className="text-[10px] text-gray-500">
                          {item.sku}
                        </div>
                      </td>
                      <td className="text-center p-1">{item.requestedQty}</td>
                      <td className="text-center p-1">
                        {item.finalApprovedQty || item.requestedQty}
                      </td>
                      <td className="text-center p-1">
                        {item.warehouseReceivedQty || 0}
                      </td>
                      <td className="text-right p-1">
                        {money(item.finalReturnAmount || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        {/* SUMMARY (compact) */}
        <div className="mt-2 flex justify-between text-xs border-t pt-2">
          <div>Requested: {money(doc.totalRequestedAmount)}</div>
          <div>Approved: {money(doc.totalApprovedAmount)}</div>
          <div>Received: {money(doc.totalReceivedAmount)}</div>
        </div>

        {/* NOTES minimal */}
        <div className="mt-2 text-[11px] text-gray-600">
          Notes: {doc.notes || "-"}
        </div>

        {/* SIGNATURES compact */}
        <div className="mt-2 grid grid-cols-4 gap-2 text-[10px]">
          {["Prepared", "Checked", "Warehouse", "Accounts"].map((t) => (
            <div key={t} className="border p-1 text-center">
              <div>{t}</div>
              <div className="border-b border-dashed mt-4"></div>
            </div>
          ))}
        </div>

        {/* footer */}
        <div className="text-right text-[10px] text-gray-500 mt-2">
          Printed: {formatDateTime(new Date().toISOString())}
        </div>
      </div>

      {/* PRINT CSS */}
      <style jsx global>{`
        @page {
          size: A4;
          margin: 6mm;
        }

        @media print {
          .screen-only {
            display: none !important;
          }

          body {
            background: white !important;
          }

          table td,
          table th {
            padding: 2px !important;
          }

          .p-4 {
            padding: 4px !important;
          }
        }
      `}</style>
    </div>
  );
}
