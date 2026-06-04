"use client";

import React, { memo, useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Printer, Sparkles } from "lucide-react";
import { toast } from "sonner";

type CompanyInfo = {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
};

type GlobalPrintButtonProps = {
  label?: string;
  className?: string;
  title?: string;
  contentHtml: string;
  headerRightHtml?: string;
  company?: CompanyInfo;
  watermarkText?: string;
  watermarkLogoUrl?: string;
  disabled?: boolean;
};

const DEFAULT_COMPANY_NAME = "Antab Agro LTD";

function esc(s?: string) {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\n/g, "<br/>");
}

function buildPrintHtml({
  title = "Print",
  contentHtml,
  headerRightHtml,
  company,
  watermarkText,
  watermarkLogoUrl,
}: {
  title?: string;
  contentHtml: string;
  headerRightHtml?: string;
  company?: CompanyInfo;
  watermarkText?: string;
  watermarkLogoUrl?: string;
}) {
  const companyName = company?.name || DEFAULT_COMPANY_NAME;

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${esc(title)}</title>
      <style>
        @page { size: A4; margin: 12mm; }

        * { box-sizing: border-box; }

        html, body {
          margin: 0;
          padding: 0;
          font-family: Arial, Helvetica, sans-serif;
          color: #111827;
          font-size: 12px;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        body {
          position: relative;
          min-height: 100vh;
          background: #fff;
        }

        .print-shell {
          position: relative;
          z-index: 2;
        }

        .print-header {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          border-bottom: 2px solid #111827;
          padding-bottom: 14px;
          margin-bottom: 14px;
        }

        .print-brand {
          max-width: 58%;
        }

        .print-brand h1 {
          margin: 0;
          font-size: 22px;
          line-height: 1.2;
        }

        .print-brand .muted {
          margin-top: 4px;
          color: #6b7280;
          line-height: 1.6;
        }

        .print-doc {
          text-align: right;
          min-width: 280px;
        }

        .print-doc h2 {
          margin: 0;
          font-size: 24px;
          line-height: 1.2;
        }

        .print-doc .no {
          margin-top: 4px;
          font-size: 14px;
          font-weight: 700;
        }

        .print-doc .muted {
          margin-top: 4px;
          color: #6b7280;
          line-height: 1.5;
        }

        .print-footer {
          margin-top: 16px;
          padding-top: 10px;
          border-top: 1px solid #d1d5db;
          color: #6b7280;
          font-size: 11px;
          text-align: center;
        }

        .print-watermark {
          position: fixed;
          inset: 0;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          user-select: none;
        }

        .print-watermark__text {
          transform: rotate(-28deg);
          font-size: 68px;
          font-weight: 900;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: rgba(17, 24, 39, 0.08);
          white-space: nowrap;
          line-height: 1;
        }

        .print-watermark__logo {
          width: 500px;
          opacity: 0.12;
          pointer-events: none;
          user-select: none;
        }

        .print-content {
          position: relative;
          z-index: 2;
        }

        @media print {
          .avoid-break {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      </style>
    </head>
    <body>
      <div class="print-watermark">
        ${
          watermarkLogoUrl
            ? `<img src="${esc(watermarkLogoUrl)}" alt="${esc(
                watermarkText || companyName,
              )}" class="print-watermark__logo" />`
            : `<div class="print-watermark__text">${esc(
                watermarkText || companyName,
              )}</div>`
        }
      </div>

      <div class="print-shell">
        <header class="print-header">
          <div class="print-brand">
            <h1>${esc(company?.name || companyName)}</h1>
            <div class="muted">
              ${esc(company?.address || "")}<br/>
              ${esc(company?.phone || "")}<br/>
              ${esc(company?.email || "")}
            </div>
          </div>
          <div class="print-doc">
            ${headerRightHtml && headerRightHtml}
          </div>
        </header>

        <main class="print-content">
          ${contentHtml}
        </main>

        <footer class="print-footer">
          ${esc(company?.name || companyName)}${company?.phone ? ` · ${esc(company.phone)}` : ""}${
            company?.email ? ` · ${esc(company.email)}` : ""
          }
        </footer>
      </div>
    </body>
  </html>`;
}

function printHtml(html: string) {
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

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  let cleaned = false;

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    URL.revokeObjectURL(url);
    iframe.remove();
  };

  iframe.onload = () => {
    const win = iframe.contentWindow;
    if (!win) {
      toast.error("Printing failed");
      cleanup();
      return;
    }

    const startPrint = () => {
      win.onafterprint = cleanup;
      win.focus();
      win.print();
    };

    startPrint();
  };

  iframe.onerror = () => {
    toast.error("Printing failed");
    cleanup();
  };

  iframe.src = url;
  document.body.appendChild(iframe);

  window.setTimeout(() => {
    cleanup();
  }, 10000);
}

export default memo(function GlobalPrintButton({
  label = "Print",
  className = "",
  title = "Print",
  contentHtml,
  headerRightHtml = "",
  company,
  watermarkText,
  watermarkLogoUrl = "/images/logo-green.png",
  disabled = false,
}: GlobalPrintButtonProps) {
  const [printing, setPrinting] = useState(false);

  const handlePrint = useCallback(() => {
    if (printing || disabled || !contentHtml) return;

    setPrinting(true);

    try {
      const html = buildPrintHtml({
        title,
        contentHtml,
        headerRightHtml,
        company,
        watermarkText,
        watermarkLogoUrl,
      });

      printHtml(html);
    } catch (error) {
      console.error(error);
      toast.error("Printing failed");
    } finally {
      window.setTimeout(() => setPrinting(false), 300);
    }
  }, [
    printing,
    disabled,
    contentHtml,
    title,
    company,
    watermarkText,
    watermarkLogoUrl,
  ]);

  return (
    <Button
      type="button"
      onClick={handlePrint}
      disabled={disabled || printing || !contentHtml}
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
