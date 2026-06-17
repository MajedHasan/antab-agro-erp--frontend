// components/print/CashPaymentVoucherContent.tsx

import React from "react";

type VoucherData = {
  voucherNo?: string;
  date?: string;
  type?: string;
  reference?: string;
  narration?: string;
  source?: { name?: string } | string;
  cashName?: string;
  submittedBy?: string;
  approvedBy?: string;
};

type VoucherLine = {
  accountId?: { name?: string; code?: string } | string;
  debit?: number;
  credit?: number;
  narration?: string;
};

const formatTaka = (n = 0) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

/* HTML builder for printing */
export function buildCashPaymentVoucherHtml(
  voucher: VoucherData,
  lines: VoucherLine[],
) {
  const sourceName =
    typeof voucher.source === "object"
      ? voucher.source?.name || ""
      : voucher.source || "";

  const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);

  return `
<div style="
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  font-size: 12px;
  color: #1e293b;
  border: 2px solid #0f172a;
  padding: 20px;
  background: #ffffff;
  max-width: 100%;
  margin: 0 auto;
">
  <!-- Header -->
  <table style="width:100%; margin-bottom:16px; border-collapse:collapse;">
    <tr>
      <td style="width:65%; vertical-align:top;">
        <div style="font-size:20px; font-weight:700; color:#0f172a;">Antab Agro LTD</div>
        <div style="font-size:11px; color:#475569; line-height:1.4; margin-top:2px;">
          123 Agro Street, Dhaka, Bangladesh<br/>
          +880 1711-111111 &middot; info@antabagro.com
        </div>
      </td>
      <td style="width:35%; text-align:right; vertical-align:top;">
        <div style="font-size:18px; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:1px;">Cash Payment</div>
        <div style="font-size:14px; font-weight:600; margin-top:6px;">Voucher #${voucher.voucherNo || ""}</div>
        <div style="font-size:12px; color:#475569; margin-top:4px;">
          Date: ${voucher.date ? new Date(voucher.date).toLocaleDateString("en-IN") : ""}
        </div>
      </td>
    </tr>
  </table>

  <!-- Meta -->
  <table style="width:100%; margin-bottom:16px; background:#f8fafc; padding:10px 16px; border-radius:4px;">
    <tr>
      <td style="width:33%; padding:4px 0;">
        <div style="font-size:9px; color:#64748b; text-transform:uppercase;">Reference</div>
        <div style="font-weight:500;">${voucher.reference || "—"}</div>
      </td>
      <td style="width:33%; padding:4px 0;">
        <div style="font-size:9px; color:#64748b; text-transform:uppercase;">Payee</div>
        <div style="font-weight:500;">${sourceName || "—"}</div>
      </td>
      <td style="width:34%; padding:4px 0;">
        <div style="font-size:9px; color:#64748b; text-transform:uppercase;">Cash Account</div>
        <div style="font-weight:500;">${voucher.cashName || "—"}</div>
      </td>
    </tr>
  </table>

  <!-- Ledger Table -->
  <table style="width:100%; border-collapse:collapse; margin-bottom:16px;">
    <thead>
      <tr style="background:#e2e8f0; font-size:10px; text-transform:uppercase; color:#334155;">
        <th style="text-align:left; padding:6px 8px; border-bottom:2px solid #94a3b8;">Ledger</th>
        <th style="text-align:left; padding:6px 8px; border-bottom:2px solid #94a3b8;">Narration</th>
        <th style="text-align:right; padding:6px 8px; border-bottom:2px solid #94a3b8;">Debit (৳)</th>
        <th style="text-align:right; padding:6px 8px; border-bottom:2px solid #94a3b8;">Credit (৳)</th>
      </tr>
    </thead>
    <tbody>
      ${lines
        .map((ln) => {
          const accName =
            ln.accountId && typeof ln.accountId === "object"
              ? ln.accountId.name || ""
              : String(ln.accountId || "");
          return `
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:5px 8px;">${accName}</td>
              <td style="padding:5px 8px;">${ln.narration || ""}</td>
              <td style="padding:5px 8px; text-align:right;">${ln.debit ? formatTaka(ln.debit) : ""}</td>
              <td style="padding:5px 8px; text-align:right;">${ln.credit ? formatTaka(ln.credit) : ""}</td>
            </tr>`;
        })
        .join("")}
    </tbody>
    <tfoot>
      <tr style="font-weight:700; background:#f8fafc;">
        <td colspan="2" style="padding:6px 8px; text-align:right; border-top:2px solid #94a3b8;">Total</td>
        <td style="padding:6px 8px; text-align:right; border-top:2px solid #94a3b8;">${formatTaka(totalDebit)}</td>
        <td style="padding:6px 8px; text-align:right; border-top:2px solid #94a3b8;">${formatTaka(totalCredit)}</td>
      </tr>
    </tfoot>
  </table>

  <!-- Narration -->
  <div style="margin-bottom:16px;">
    <div style="font-size:9px; color:#64748b; text-transform:uppercase; margin-bottom:2px;">Narration</div>
    <div style="font-size:12px; line-height:1.5; background:#f9fafb; padding:8px; border-radius:4px;">${voucher.narration || "—"}</div>
  </div>

  <!-- Signatures -->
  <table style="width:100%; margin-top:30px; border-collapse:collapse;">
    <tr>
      <td style="width:33%; text-align:center; font-size:11px; color:#475569;">
        <div style="border-top:1px solid #cbd5e1; padding-top:8px; margin-top:8px;">
          ${voucher.submittedBy || "Prepared by"}
        </div>
      </td>
      <td style="width:34%; text-align:center; font-size:11px; color:#475569;">
        <div style="border-top:1px solid #cbd5e1; padding-top:8px; margin-top:8px;">
          ${voucher.approvedBy || "Authorised by"}
        </div>
      </td>
      <td style="width:33%; text-align:center; font-size:11px; color:#475569;">
        <div style="border-top:1px solid #cbd5e1; padding-top:8px; margin-top:8px;">
          Paid by
        </div>
      </td>
    </tr>
  </table>

  <!-- Footer -->
  <div style="margin-top:20px; border-top:1px solid #e2e8f0; padding-top:8px; font-size:9px; color:#94a3b8; text-align:center;">
    This is a computer‑generated document. Printed on ${new Date().toLocaleDateString("en-IN")}
  </div>
</div>`;
}

/* React preview component */
export function CashPaymentVoucherPreview({
  voucher,
  lines,
}: {
  voucher: VoucherData;
  lines: VoucherLine[];
}) {
  const sourceName =
    typeof voucher.source === "object"
      ? voucher.source?.name || ""
      : voucher.source || "";

  const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);

  return (
    <div className="border-2 border-slate-800 p-6 md:p-8 max-w-[210mm] mx-auto bg-white text-slate-800 shadow-sm">
      {/* Header */}
      <div className="flex justify-between mb-4">
        <div>
          <div className="text-xl font-bold text-slate-900">Antab Agro LTD</div>
          <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
            123 Agro Street, Dhaka, Bangladesh<br />
            +880 1711-111111 &middot; info@antabagro.com
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-slate-800 uppercase tracking-wide">Cash Payment</div>
          <div className="text-sm font-semibold mt-2">Voucher #{voucher.voucherNo || ""}</div>
          <div className="text-xs text-slate-500 mt-1">
            Date: {voucher.date ? new Date(voucher.date).toLocaleDateString("en-IN") : ""}
          </div>
        </div>
      </div>

      {/* Meta */}
      <div className="flex gap-4 mb-4 bg-slate-100 rounded p-3">
        <div className="flex-1">
          <div className="text-[9px] text-slate-500 uppercase">Reference</div>
          <div className="font-medium text-sm">{voucher.reference || "—"}</div>
        </div>
        <div className="flex-1">
          <div className="text-[9px] text-slate-500 uppercase">Payee</div>
          <div className="font-medium text-sm">{sourceName || "—"}</div>
        </div>
        <div className="flex-1">
          <div className="text-[9px] text-slate-500 uppercase">Cash Account</div>
          <div className="font-medium text-sm">{voucher.cashName || "—"}</div>
        </div>
      </div>

      {/* Ledger Table */}
      <table className="w-full border-collapse mb-4">
        <thead>
          <tr className="bg-slate-200 text-[10px] uppercase text-slate-600">
            <th className="text-left px-3 py-2 border-b-2 border-slate-300">Ledger</th>
            <th className="text-left px-3 py-2 border-b-2 border-slate-300">Narration</th>
            <th className="text-right px-3 py-2 border-b-2 border-slate-300">Debit (৳)</th>
            <th className="text-right px-3 py-2 border-b-2 border-slate-300">Credit (৳)</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((ln, i) => {
            const accName =
              ln.accountId && typeof ln.accountId === "object"
                ? ln.accountId.name || ""
                : String(ln.accountId || "");
            return (
              <tr key={i} className="border-b border-slate-200">
                <td className="px-3 py-1.5 text-sm">{accName}</td>
                <td className="px-3 py-1.5 text-sm">{ln.narration || ""}</td>
                <td className="px-3 py-1.5 text-sm text-right">
                  {ln.debit ? formatTaka(ln.debit) : ""}
                </td>
                <td className="px-3 py-1.5 text-sm text-right">
                  {ln.credit ? formatTaka(ln.credit) : ""}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="font-semibold bg-slate-50 text-sm">
            <td colSpan={2} className="px-3 py-2 text-right border-t-2 border-slate-300">
              Total
            </td>
            <td className="px-3 py-2 text-right border-t-2 border-slate-300">
              {formatTaka(totalDebit)}
            </td>
            <td className="px-3 py-2 text-right border-t-2 border-slate-300">
              {formatTaka(totalCredit)}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Narration */}
      <div className="mb-4">
        <div className="text-[9px] text-slate-500 uppercase mb-1">Narration</div>
        <div className="text-sm bg-slate-50 p-3 rounded">{voucher.narration || "—"}</div>
      </div>

      {/* Signatures */}
      <div className="flex justify-between mt-8 mb-6">
        <div className="text-center w-3/10">
          <div className="border-t border-slate-300 pt-2 text-[11px] text-slate-500">
            {voucher.submittedBy || "Prepared by"}
          </div>
        </div>
        <div className="text-center w-3/10">
          <div className="border-t border-slate-300 pt-2 text-[11px] text-slate-500">
            {voucher.approvedBy || "Authorised by"}
          </div>
        </div>
        <div className="text-center w-3/10">
          <div className="border-t border-slate-300 pt-2 text-[11px] text-slate-500">
            Paid by
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 pt-3 text-[9px] text-slate-400 text-center">
        Computer‑generated document &middot; Printed on {new Date().toLocaleDateString("en-IN")}
      </div>
    </div>
  );
}

/* Header‑right HTML for the global print button */
export function buildVoucherPrintHeader(voucher: VoucherData) {
  return `
    <div style="text-align:right; min-width:200px;">
      <div style="font-size:18px; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:1px;">Cash Payment</div>
      <div style="font-size:14px; font-weight:600; margin-top:6px;">Voucher #${voucher.voucherNo || ""}</div>
      <div style="font-size:12px; color:#475569; margin-top:4px;">Date: ${voucher.date ? new Date(voucher.date).toLocaleDateString("en-IN") : ""}</div>
    </div>`;
}