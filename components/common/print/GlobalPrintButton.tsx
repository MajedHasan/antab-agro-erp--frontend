// components/print/GlobalPrintButton.tsx
"use client";

import React, { memo, useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Printer, Sparkles } from "lucide-react";
import { toast } from "sonner";

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */
type CompanyInfo = {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
};

type BorderStyle = "none" | "thin" | "thick" | "double" | "dashed" | "custom";

type GlobalPrintButtonProps = {
  /* –– Button appearance –– */
  label?: string;
  className?: string;
  disabled?: boolean;

  /* –– Document meta –– */
  title?: string;
  contentHtml: string;
  headerRightHtml?: string;

  /* –– Visibility –– */
  showHeader?: boolean;
  showFooter?: boolean;
  showWatermark?: boolean;       // default true

  /* –– Company / Watermark –– */
  company?: CompanyInfo;
  watermarkText?: string;
  watermarkLogoUrl?: string;
  watermarkOpacity?: number;     // default 0.12
  watermarkRotate?: string;
  watermarkSize?: string;
  watermarkPosition?: string;    // "center" (default) | "top-left" | "top-right" etc.

  /* –– Page settings –– */
  orientation?: "portrait" | "landscape";
  pageSize?: string;
  margin?: string;
  scale?: number;
  customPageCss?: string;

  /* –– Container (around contentHtml) –– */
  containerClass?: string;
  containerStyle?: string;
  borderStyle?: BorderStyle;
  customBorderCss?: string;

  /* –– Header customisation –– */
  headerLeftHtml?: string;
  headerClass?: string;
  headerStyle?: string;

  /* –– Footer customisation –– */
  footerHtml?: string;
  footerClass?: string;
  footerStyle?: string;

  /* –– Advanced –– */
  extraHead?: string;
  printOnlyCss?: string;
  customWatermarkStyle?: string;
  bodyClassName?: string;
  printStyles?: string;
};

/* ================================================================== */
/*  Constants & helpers                                                */
/* ================================================================== */
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

const BORDER_CSS: Record<Exclude<BorderStyle, "custom">, string> = {
  none: "",
  thin: "border: 1px solid #cbd5e1;",
  thick: "border: 3px solid #334155;",
  double: "border: 3px double #334155;",
  dashed: "border: 1px dashed #94a3b8;",
};

/* ================================================================== */
/*  Print HTML builder                                                 */
/* ================================================================== */
function buildPrintHtml({
  title = "Print",
  contentHtml,
  headerRightHtml,
  company,
  watermarkText,
  watermarkLogoUrl,
  showHeader = true,
  showFooter = true,
  showWatermark = true,
  orientation = "portrait",
  pageSize = "A4",
  margin = "12mm",
  scale = 1,
  customPageCss,
  watermarkOpacity = 0.12,
  watermarkRotate = "-28deg",
  watermarkSize,
  watermarkPosition,
  extraHead,
  customWatermarkStyle,
  bodyClassName,
  printStyles,
  printOnlyCss,
  containerClass,
  containerStyle,
  borderStyle = "none",
  customBorderCss,
  headerLeftHtml,
  headerClass,
  headerStyle,
  footerHtml,
  footerClass,
  footerStyle,
}: {
  title?: string;
  contentHtml: string;
  headerRightHtml?: string;
  company?: CompanyInfo;
  watermarkText?: string;
  watermarkLogoUrl?: string;
  showHeader?: boolean;
  showFooter?: boolean;
  showWatermark?: boolean;
  orientation?: "portrait" | "landscape";
  pageSize?: string;
  margin?: string;
  scale?: number;
  customPageCss?: string;
  watermarkOpacity?: number;
  watermarkRotate?: string;
  watermarkSize?: string;
  watermarkPosition?: string;
  extraHead?: string;
  customWatermarkStyle?: string;
  bodyClassName?: string;
  printStyles?: string;
  printOnlyCss?: string;
  containerClass?: string;
  containerStyle?: string;
  borderStyle?: BorderStyle;
  customBorderCss?: string;
  headerLeftHtml?: string;
  headerClass?: string;
  headerStyle?: string;
  footerHtml?: string;
  footerClass?: string;
  footerStyle?: string;
}) {
  const companyName = company?.name || DEFAULT_COMPANY_NAME;

  // Page CSS
  const pageCss = `
    @page {
      size: ${pageSize} ${orientation};
      margin: ${margin};
      ${customPageCss ?? ""}
    }
  `;

  // Watermark CSS
  const watermarkCss = customWatermarkStyle
    ? customWatermarkStyle
    : `
      .print-watermark__text {
        transform: rotate(${watermarkRotate});
        font-size: 68px;
        font-weight: 900;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: rgba(17, 24, 39, ${watermarkOpacity});
        white-space: nowrap;
        line-height: 1;
      }
      .print-watermark__logo {
        width: ${watermarkSize || "500px"};
        opacity: ${watermarkOpacity};
        pointer-events: none;
        user-select: none;
        transform: rotate(${watermarkRotate});
      }
    `;

  // Container border CSS
  const borderCss =
    borderStyle === "custom"
      ? customBorderCss || ""
      : BORDER_CSS[borderStyle] || "";

  // Watermark alignment
  const align = watermarkPosition === "center" || !watermarkPosition ? "center" : "flex-start";
  const justify = watermarkPosition === "center" || !watermarkPosition ? "center" : "flex-start";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(title)}</title>
    ${extraHead ?? ""}
    <style>
      ${pageCss}

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
        transform: scale(${scale});
        transform-origin: top left;
      }

      /* The shell is the container that determines the watermark area */
      .print-shell {
        position: relative;
        z-index: 1;
      }

      .print-header {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        border-bottom: 2px solid #111827;
        padding-bottom: 14px;
        margin-bottom: 14px;
      }
      .print-brand { max-width: 58%; }
      .print-brand h1 { margin: 0; font-size: 22px; line-height: 1.2; }
      .print-brand .muted { margin-top: 4px; color: #6b7280; line-height: 1.6; }
      .print-doc { text-align: right; min-width: 280px; }
      .print-doc h2 { margin: 0; font-size: 24px; line-height: 1.2; }
      .print-doc .no { margin-top: 4px; font-size: 14px; font-weight: 700; }
      .print-doc .muted { margin-top: 4px; color: #6b7280; line-height: 1.5; }

      .print-footer {
        margin-top: 16px;
        padding-top: 10px;
        border-top: 1px solid #d1d5db;
        color: #6b7280;
        font-size: 11px;
        text-align: center;
      }

      /* Watermark OVERLAY – on top of content, exactly matching the shell’s size */
      .print-watermark {
        position: absolute;
        inset: 0;
        z-index: 2;
        display: flex;
        pointer-events: none;
        user-select: none;
      }

      ${watermarkCss}

      .print-content {
        position: relative;
        z-index: 1;
      }

      .print-content-container {
        ${containerStyle ?? ""}
        ${borderCss}
        padding: ${containerStyle ? "" : "0"};
      }

      @media print {
        .avoid-break {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        ${printOnlyCss ?? ""}
      }

      /* Hide header/footer */
      ${!showHeader ? '.print-header { display: none !important; }' : ''}
      ${!showFooter ? '.print-footer { display: none !important; }' : ''}

      ${printStyles ?? ""}
    </style>
  </head>
  <body${bodyClassName ? ` class="${esc(bodyClassName)}"` : ""}>
    <div class="print-shell">
      <!-- Watermark overlay (always on top, semi‑transparent) -->
      ${
        showWatermark
          ? `
      <div class="print-watermark" style="align-items: ${align}; justify-content: ${justify};">
        ${
          watermarkLogoUrl
            ? `<img src="${esc(watermarkLogoUrl)}" alt="${esc(
                watermarkText || companyName,
              )}" class="print-watermark__logo" />`
            : `<div class="print-watermark__text">${esc(
                watermarkText || companyName,
              )}</div>`
        }
      </div>`
          : ""
      }

      ${
        showHeader
          ? `
        <header class="print-header${headerClass ? ` ${esc(headerClass)}` : ""}"${
              headerStyle ? ` style="${esc(headerStyle)}"` : ""
            }>
          <div class="print-brand">
            ${
              headerLeftHtml
                ? headerLeftHtml
                : `
              <h1>${esc(company?.name || companyName)}</h1>
              <div class="muted">
                ${esc(company?.address || "")}<br/>
                ${esc(company?.phone || "")}<br/>
                ${esc(company?.email || "")}
              </div>`
            }
          </div>
          <div class="print-doc">
            ${headerRightHtml || ""}
          </div>
        </header>`
          : ""
      }

      <main class="print-content">
        <div class="print-content-container${containerClass ? ` ${esc(containerClass)}` : ""}">
          ${contentHtml}
        </div>
      </main>

      ${
        showFooter
          ? `
      <footer class="print-footer${footerClass ? ` ${esc(footerClass)}` : ""}"${
              footerStyle ? ` style="${esc(footerStyle)}"` : ""
            }>
        ${footerHtml ? footerHtml : `${esc(company?.name || companyName)}${company?.phone ? ` · ${esc(company.phone)}` : ""}${company?.email ? ` · ${esc(company.email)}` : ""}`}
      </footer>`
          : ""
      }
    </div>
  </body>
</html>`;
}

/* ================================================================== */
/*  Print helper                                                       */
/* ================================================================== */
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
    win.onafterprint = cleanup;
    win.focus();
    win.print();
  };

  iframe.onerror = () => {
    toast.error("Printing failed");
    cleanup();
  };

  iframe.src = url;
  document.body.appendChild(iframe);

  window.setTimeout(cleanup, 10000);
}

/* ================================================================== */
/*  Component                                                          */
/* ================================================================== */
export default memo(function GlobalPrintButton({
  label = "Print",
  className = "",
  title = "Print",
  contentHtml,
  headerRightHtml = "",
  company,
  watermarkText,
  watermarkLogoUrl,
  showHeader = true,
  showFooter = true,
  showWatermark = true,
  orientation = "portrait",
  pageSize = "A4",
  margin = "12mm",
  scale = 1,
  customPageCss,
  watermarkOpacity = 0.12,
  watermarkRotate = "-28deg",
  watermarkSize,
  watermarkPosition,
  extraHead,
  customWatermarkStyle,
  bodyClassName,
  printStyles,
  printOnlyCss,
  containerClass,
  containerStyle,
  borderStyle = "none",
  customBorderCss,
  headerLeftHtml,
  headerClass,
  headerStyle,
  footerHtml,
  footerClass,
  footerStyle,
  disabled = false,
}: GlobalPrintButtonProps) {
  const [printing, setPrinting] = useState(false);

  const finalWatermarkLogoUrl = useMemo(() => {
    if (watermarkLogoUrl) return watermarkLogoUrl;
    if (typeof window !== "undefined") {
      return `${window.location.origin}/images/logo-green.png`;
    }
    return "/images/logo-green.png";
  }, [watermarkLogoUrl]);

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
        watermarkLogoUrl: finalWatermarkLogoUrl,
        showHeader,
        showFooter,
        showWatermark,
        orientation,
        pageSize,
        margin,
        scale,
        customPageCss,
        watermarkOpacity,
        watermarkRotate,
        watermarkSize,
        watermarkPosition,
        extraHead,
        customWatermarkStyle,
        bodyClassName,
        printStyles,
        printOnlyCss,
        containerClass,
        containerStyle,
        borderStyle,
        customBorderCss,
        headerLeftHtml,
        headerClass,
        headerStyle,
        footerHtml,
        footerClass,
        footerStyle,
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
    finalWatermarkLogoUrl,
    showHeader,
    showFooter,
    showWatermark,
    orientation,
    pageSize,
    margin,
    scale,
    customPageCss,
    watermarkOpacity,
    watermarkRotate,
    watermarkSize,
    watermarkPosition,
    extraHead,
    customWatermarkStyle,
    bodyClassName,
    printStyles,
    printOnlyCss,
    containerClass,
    containerStyle,
    borderStyle,
    customBorderCss,
    headerLeftHtml,
    headerClass,
    headerStyle,
    footerHtml,
    footerClass,
    footerStyle,
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