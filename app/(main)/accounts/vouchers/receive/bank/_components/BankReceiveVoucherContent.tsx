// app/accounts/vouchers/receive/bank/_components/BankReceiveVoucherContent.tsx
import React from "react";

/* --------------------- types --------------------- */
type VoucherData = {
  voucherNo?: string;
  date?: string;
  type?: string;
  reference?: string;
  narration?: string;
  source?: { name?: string } | string;
  bankName?: string;
  submittedBy?: string;       // preparer name
  approvedBy?: string;        // authoriser name
  receivedBy?: string;        // e.g., bank officer
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

/* ------------------------------------------------------------------ */
/*  HTML builder for printing – identical to preview                  */
/* ------------------------------------------------------------------ */
export function buildBankReceiveVoucherHtml(
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
  border: 2px solid #1e293b;
  padding: 22px;
  background: #fdfdfb;
  position: relative;
  z-index: 2;
">

  <!-- header -->
  <div style="display: flex; justify-content: space-between; margin-bottom: 24px;">
    <div style="max-width: 60%;">
      <div style="font-size: 20px; font-weight: 700; color: #0f172a;">Antab Agro LTD</div>
      <div style="font-size: 11px; color: #475569; line-height: 1.6; margin-top: 4px;">
        123 Agro Street, Dhaka, Bangladesh<br/>
        +880 1711-111111 · info@antabagro.com
      </div>
    </div>
    <div style="text-align: right; min-width: 220px;">
      <div style="font-size: 18px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #cbd5e1; padding-bottom: 4px;">Bank Receive</div>
      <div style="font-size: 14px; font-weight: 600; margin-top: 6px;">Voucher #${voucher.voucherNo || ""}</div>
      <div style="font-size: 12px; color: #475569; margin-top: 4px;">
        Date: ${voucher.date ? new Date(voucher.date).toLocaleDateString("en-IN") : ""}
      </div>
    </div>
  </div>

  <!-- meta -->
  <div style="display: flex; gap: 20px; margin-bottom: 20px; background: #f8fafc; padding: 10px 16px; border-radius: 4px;">
    <div style="flex: 1;">
      <div style="font-size: 9px; color: #64748b; text-transform: uppercase; margin-bottom: 3px;">Reference</div>
      <div style="font-weight: 500;">${voucher.reference || "—"}</div>
    </div>
    <div style="flex: 1;">
      <div style="font-size: 9px; color: #64748b; text-transform: uppercase; margin-bottom: 3px;">Source</div>
      <div style="font-weight: 500;">${sourceName || "—"}</div>
    </div>
    <div style="flex: 1;">
      <div style="font-size: 9px; color: #64748b; text-transform: uppercase; margin-bottom: 3px;">Bank Account</div>
      <div style="font-weight: 500;">${voucher.bankName || "—"}</div>
    </div>
  </div>

  <!-- table -->
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
    <thead>
      <tr style="background: #f1f5f9; font-size: 10px; text-transform: uppercase; color: #475569;">
        <th style="text-align: left; padding: 8px 12px; border-bottom: 2px solid #cbd5e1;">Ledger</th>
        <th style="text-align: left; padding: 8px 12px; border-bottom: 2px solid #cbd5e1;">Narration</th>
        <th style="text-align: right; padding: 8px 12px; border-bottom: 2px solid #cbd5e1;">Debit (৳)</th>
        <th style="text-align: right; padding: 8px 12px; border-bottom: 2px solid #cbd5e1;">Credit (৳)</th>
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
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 6px 12px;">${accName}</td>
              <td style="padding: 6px 12px;">${ln.narration || ""}</td>
              <td style="padding: 6px 12px; text-align: right;">${ln.debit ? formatTaka(ln.debit) : ""}</td>
              <td style="padding: 6px 12px; text-align: right;">${ln.credit ? formatTaka(ln.credit) : ""}</td>
            </tr>`;
        })
        .join("")}
    </tbody>
    <tfoot>
      <tr style="font-weight: 700; background: #f8fafc;">
        <td colspan="2" style="padding: 8px 12px; text-align: right; border-top: 2px solid #cbd5e1;">Total</td>
        <td style="padding: 8px 12px; text-align: right; border-top: 2px solid #cbd5e1;">${formatTaka(totalDebit)}</td>
        <td style="padding: 8px 12px; text-align: right; border-top: 2px solid #cbd5e1;">${formatTaka(totalCredit)}</td>
      </tr>
    </tfoot>
  </table>

  <!-- narration -->
  <div style="margin-bottom: 20px;">
    <div style="font-size: 9px; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">Narration</div>
    <div style="font-size: 12px; line-height: 1.6; background: #f9fafb; padding: 10px; border-radius: 4px;">${voucher.narration || "—"}</div>
  </div>

  <!-- signature area -->
  <div style="display: flex; justify-content: space-between; margin-top: 40px; font-size: 11px; color: #475569;">
    <div style="width: 30%; text-align: center;">
      <div style="border-top: 1px solid #475569; padding-top: 6px; margin-top: 24px;">
        Prepared by<br/><strong>${voucher.submittedBy || "________________"}</strong>
      </div>
    </div>
    <div style="width: 30%; text-align: center;">
      <div style="border-top: 1px solid #475569; padding-top: 6px; margin-top: 24px;">
        Authorised by<br/><strong>${voucher.approvedBy || "________________"}</strong>
      </div>
    </div>
    <div style="width: 30%; text-align: center;">
      <div style="border-top: 1px solid #475569; padding-top: 6px; margin-top: 24px;">
        Received by<br/><strong>${voucher.receivedBy || "________________"}</strong>
      </div>
    </div>
  </div>

  <!-- footer -->
  <div style="margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 9px; color: #94a3b8; text-align: center;">
    Computer‑generated document · Printed on ${new Date().toLocaleDateString("en-IN")}
  </div>
</div>`;
}

/* ------------------------------------------------------------------ */
/*  React preview component (identical to above)                      */
/* ------------------------------------------------------------------ */
export function BankReceiveVoucherPreview({
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
    <div className="border-2 border-slate-800 p-6 md:p-8 max-w-[210mm] mx-auto bg-[#fdfdfb] text-slate-800 relative shadow-xl">
      {/* header */}
      <div className="flex justify-between mb-6">
        <div className="max-w-[60%]">
          <div className="text-xl font-bold text-slate-900">Antab Agro LTD</div>
          <div className="text-[11px] text-slate-500 mt-1 leading-relaxed">
            123 Agro Street, Dhaka, Bangladesh<br />
            +880 1711-111111 · info@antabagro.com
          </div>
        </div>
        <div className="text-right min-w-[220px]">
          <div className="text-lg font-bold text-slate-900 uppercase tracking-wide border-b-2 border-slate-300 pb-1 inline-block">
            Bank Receive
          </div>
          <div className="text-sm font-semibold mt-2">
            Voucher #{voucher.voucherNo || ""}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Date: {voucher.date ? new Date(voucher.date).toLocaleDateString("en-IN") : ""}
          </div>
        </div>
      </div>

      {/* meta */}
      <div className="flex gap-5 mb-5 bg-slate-100 p-4 rounded">
        <div className="flex-1">
          <div className="text-[9px] text-slate-500 uppercase mb-1">Reference</div>
          <div className="font-medium text-sm">{voucher.reference || "—"}</div>
        </div>
        <div className="flex-1">
          <div className="text-[9px] text-slate-500 uppercase mb-1">Source</div>
          <div className="font-medium text-sm">{sourceName || "—"}</div>
        </div>
        <div className="flex-1">
          <div className="text-[9px] text-slate-500 uppercase mb-1">Bank Account</div>
          <div className="font-medium text-sm">{voucher.bankName || "—"}</div>
        </div>
      </div>

      {/* table */}
      <table className="w-full border-collapse mb-6">
        <thead>
          <tr className="bg-slate-100 text-[10px] uppercase text-slate-600">
            <th className="text-left px-4 py-2.5 border-b-2 border-slate-300">Ledger</th>
            <th className="text-left px-4 py-2.5 border-b-2 border-slate-300">Narration</th>
            <th className="text-right px-4 py-2.5 border-b-2 border-slate-300">Debit (৳)</th>
            <th className="text-right px-4 py-2.5 border-b-2 border-slate-300">Credit (৳)</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((ln, i) => {
            const accName =
              ln.accountId && typeof ln.accountId === "object"
                ? ln.accountId.name || ""
                : String(ln.accountId || "");
            return (
              <tr key={i} className="border-b border-slate-200 even:bg-slate-50/50">
                <td className="px-4 py-2 text-sm">{accName}</td>
                <td className="px-4 py-2 text-sm">{ln.narration || ""}</td>
                <td className="px-4 py-2 text-sm text-right">{ln.debit ? formatTaka(ln.debit) : ""}</td>
                <td className="px-4 py-2 text-sm text-right">{ln.credit ? formatTaka(ln.credit) : ""}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="font-semibold bg-slate-100 text-sm">
            <td colSpan={2} className="px-4 py-2.5 text-right border-t-2 border-slate-300">Total</td>
            <td className="px-4 py-2.5 text-right border-t-2 border-slate-300">{formatTaka(totalDebit)}</td>
            <td className="px-4 py-2.5 text-right border-t-2 border-slate-300">{formatTaka(totalCredit)}</td>
          </tr>
        </tfoot>
      </table>

      {/* narration */}
      <div className="mb-6">
        <div className="text-[9px] text-slate-500 uppercase mb-1">Narration</div>
        <div className="text-sm bg-slate-50 p-3 rounded leading-relaxed">
          {voucher.narration || "—"}
        </div>
      </div>

      {/* signature area */}
      <div className="flex justify-between mt-12 text-[11px] text-slate-600">
        <div className="w-[30%] text-center">
          <div className="border-t border-slate-500 pt-3 mt-6">
            <div className="font-semibold text-xs mb-1">Prepared by</div>
            <div className="text-slate-800 font-medium">
              {voucher.submittedBy || "_______________"}
            </div>
          </div>
        </div>
        <div className="w-[30%] text-center">
          <div className="border-t border-slate-500 pt-3 mt-6">
            <div className="font-semibold text-xs mb-1">Authorised by</div>
            <div className="text-slate-800 font-medium">
              {voucher.approvedBy || "_______________"}
            </div>
          </div>
        </div>
        <div className="w-[30%] text-center">
          <div className="border-t border-slate-500 pt-3 mt-6">
            <div className="font-semibold text-xs mb-1">Received by</div>
            <div className="text-slate-800 font-medium">
              {voucher.receivedBy || "_______________"}
            </div>
          </div>
        </div>
      </div>

      {/* footer */}
      <div className="mt-8 border-t border-slate-200 pt-3 text-[9px] text-slate-400 text-center">
        Computer‑generated document · Printed on {new Date().toLocaleDateString("en-IN")}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Header‑right HTML for the global print button                     */
/* ------------------------------------------------------------------ */
export function buildVoucherPrintHeader(voucher: VoucherData) {
  return `
    <div style="text-align:right; min-width:200px;">
      <div style="font-size:18px; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:1px; border-bottom:2px solid #cbd5e1; padding-bottom:4px;">Bank Receive</div>
      <div style="font-size:14px; font-weight:600; margin-top:6px;">Voucher #${voucher.voucherNo || ""}</div>
      <div style="font-size:12px; color:#475569; margin-top:4px;">Date: ${voucher.date ? new Date(voucher.date).toLocaleDateString("en-IN") : ""}</div>
    </div>`;
}