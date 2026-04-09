"use client";

import React, { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import { type WorkOrderView } from "./workOrderShared";

// Build printable HTML with watermark
function buildPrintHtml(
  viewing: WorkOrderView,
  company: {
    name: string;
    address: string;
    phone: string;
    email: string;
  },
) {
  const { name, address, phone, email } = company;

  return `
  <html>
    <head>
      <title>Work Order ${viewing.workOrderNo}</title>
      <style>
        body { font-family: Arial, sans-serif; margin:0; padding:0; color:#111827; }
        .page { padding: 40px; position: relative; }
        .header { text-align: center; margin-bottom: 20px; }
        .header h1 { margin: 0; font-size: 28px; }
        .header h2 { margin: 0; font-size: 16px; font-weight: normal; color: #6b7280; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
        th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
        th { background-color: #f3f4f6; }
        .totals { margin-top: 20px; width: 100%; display: flex; justify-content: flex-end; font-size: 16px; font-weight: bold; }
        /* Watermark */
        .watermark {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-28deg);
          font-size: 80px;
          font-weight: 900;
          color: rgba(17,24,39,0.08);
          letter-spacing: 0.15em;
          pointer-events: none;
          user-select: none;
          z-index: 9999;
        }
      </style>
    </head>
    <body>
      <div class="watermark">${name}</div>
      <div class="page">
        <div class="header">
          <h1>${name}</h1>
          <h2>${address} | ${phone} | ${email}</h2>
          <h2>Work Order: ${viewing.workOrderNo}</h2>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Item</th>
              <th>Description</th>
              <th>Qty</th>
              <th>Received</th>
              <th>Unit</th>
              <th>Unit Price</th>
              <th>Line Total</th>
            </tr>
          </thead>
          <tbody>
            ${viewing.items
              .map(
                (it, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${it.name || it._id}</td>
                <td>${it.description || "-"}</td>
                <td>${it.quantity ?? 0}</td>
                <td>${it.receivedQty ?? 0}</td>
                <td>${it.unit || "-"}</td>
                <td>${it.unitPrice?.toFixed(2) || "0.00"}</td>
                <td>${it.lineTotal?.toFixed(2) || "0.00"}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>

        <div class="totals">
          <div>
            Subtotal: ${viewing.subTotal?.toFixed(2) || "0.00"}<br>
            Discount: -${viewing.discountAmount?.toFixed(2) || "0.00"}<br>
            Tax: ${viewing.taxTotal?.toFixed(2) || "0.00"}<br>
            Grand Total: ${viewing.grandTotal?.toFixed(2) || "0.00"}
          </div>
        </div>
      </div>
    </body>
  </html>
  `;
}

type Props = {
  viewing: WorkOrderView | null;
  label?: string;
  className?: string;
};

export default function PrintWorkOrderInvoiceV2({
  viewing,
  label = "Print",
  className,
}: Props) {
  const handlePrint = useCallback(() => {
    if (!viewing) return;

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.left = "0";
    iframe.style.top = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";

    const html = buildPrintHtml(viewing, {
      name: "Antab Agro LTD",
      address: "Company address, city, country",
      phone: "+000 000 000",
      email: "info@company.com",
    });

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const cleanup = () => {
      URL.revokeObjectURL(url);
      if (iframe.parentNode) iframe.remove();
    };

    iframe.onload = () => {
      const win = iframe.contentWindow;
      if (!win) {
        cleanup();
        toast.error("Printing failed");
        return;
      }

      win.onafterprint = cleanup;

      setTimeout(() => {
        try {
          win.focus();
          win.print();
        } catch {
          cleanup();
          toast.error("Printing failed");
        }
      }, 300);

      setTimeout(cleanup, 3000);
    };

    iframe.src = url;
    document.body.appendChild(iframe);
  }, [viewing]);

  return (
    <Button
      variant="outline"
      className={`flex items-center gap-2 ${className || ""}`}
      onClick={handlePrint}
      disabled={!viewing}
    >
      <Printer className="h-5 w-5" />
      {label}
    </Button>
  );
}
