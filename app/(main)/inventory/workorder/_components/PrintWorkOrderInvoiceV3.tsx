"use client";

import React, { memo, useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Printer, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { buildPrintHtml, type WorkOrderView } from "./workOrderShared";

type Props = {
  viewing: WorkOrderView | null;
  label?: string;
  className?: string;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
};

const DEFAULT_COMPANY_NAME = "Antab Agro LTD";

function injectWatermark(doc: Document, companyName: string, logoUrl?: string) {
  const old = doc.getElementById("antab-watermark");
  old?.remove();

  const style = doc.createElement("style");
  style.id = "antab-watermark-style";
  style.textContent = `
    @media print {
      .antab-watermark {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        z-index: 9999;
      }

      .antab-watermark__text {
        transform: rotate(-28deg);
        font-size: 68px;
        font-weight: 900;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: rgba(17, 24, 39, 0.08);
        white-space: nowrap;
        user-select: none;
      }

      .antab-watermark__logo {
        // max-width: 50%;
        // max-height: 50%;
        width: 500px;
        opacity: 0.12;
        // transform: rotate(-28deg);
        pointer-events: none;
        user-select: none;
      }
    }
  `;
  doc.head.appendChild(style);

  const watermark = doc.createElement("div");
  watermark.id = "antab-watermark";
  watermark.className = "antab-watermark";

  if (logoUrl) {
    watermark.innerHTML = `<img src="${logoUrl}" alt="${companyName}" class="antab-watermark__logo" />`;
  } else {
    watermark.innerHTML = `<div class="antab-watermark__text">${companyName}</div>`;
  }

  doc.body.appendChild(watermark);
}

export default memo(function PrintWorkOrderInvoiceV3({
  viewing,
  label = "Print Invoice",
  className = "",
  companyName = DEFAULT_COMPANY_NAME,
  companyAddress = "House #63 (1st floor), Road no #6, Sector-4, Uttara, Dhaka-1230.",
  companyPhone = "Phone: +88-02-7111708, +88-02-58953033",
  companyEmail = "Email: mehran_anwar@hotmail.com, sarzanavg@gmail.com",
}: Props) {
  const [printing, setPrinting] = useState(false);

  const handlePrint = useCallback(() => {
    if (!viewing || printing) return;

    setPrinting(true);

    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText = [
      "position:fixed",
      "right:0",
      "bottom:0",
      "width:0",
      "height:0",
      "border:0",
      "opacity:0",
      "pointer-events:none",
    ].join(";");

    const html = buildPrintHtml(viewing, {
      name: companyName,
      address: companyAddress,
      phone: companyPhone,
      email: companyEmail,
    });

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    let cleaned = false;

    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;

      URL.revokeObjectURL(url);
      iframe.remove();
      setPrinting(false);
    };

    iframe.onload = () => {
      const win = iframe.contentWindow;
      const doc = win?.document;

      if (!win || !doc) {
        toast.error("Printing failed");
        cleanup();
        return;
      }

      injectWatermark(
        doc,
        companyName,
        window.location.origin + "/images/logo-green.png",
      );

      const img = doc.querySelector(
        ".antab-watermark__logo",
      ) as HTMLImageElement;

      const startPrint = () => {
        win.onafterprint = cleanup;
        win.focus();
        win.print();
      };

      if (img) {
        img.onload = startPrint;
        img.onerror = startPrint;
      } else {
        startPrint();
      }
    };

    iframe.src = url;
    document.body.appendChild(iframe);

    window.setTimeout(() => {
      cleanup();
    }, 10000);
  }, [
    viewing,
    printing,
    companyName,
    companyAddress,
    companyPhone,
    companyEmail,
  ]);

  return (
    <Button
      type="button"
      onClick={handlePrint}
      disabled={!viewing || printing}
      className={[
        "group relative overflow-hidden rounded-2xl border border-slate-200",
        "bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 px-4 py-2.5",
        "font-semibold text-white shadow-lg shadow-slate-950/20 transition-all",
        "hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-950/25",
        "active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      ].join(" ")}
      aria-busy={printing}
    >
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_35%)]" />
      <span className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <span className="relative flex items-center gap-2">
        {printing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Printer className="h-4 w-4" />
        )}
        <span>{printing ? "Preparing print..." : label}</span>
        {!printing ? <Sparkles className="h-4 w-4 text-amber-300" /> : null}
      </span>
    </Button>
  );
});
