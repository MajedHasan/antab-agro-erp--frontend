export type Party = {
  _id?: string;
  name?: string;
  supplierName?: string;
  address?: string;
  phoneNumber?: string;
  email?: string;
};

export type Warehouse = {
  _id?: string;
  name?: string;
  address?: string;
  phoneNumber?: string;
  email?: string;
};

export type IUser = { _id?: string; name?: string };

export type WorkOrderItem = {
  _id?: string;
  name?: string;
  itemType?: string;
  itemId?: string | { _id?: string; name?: string };
  description?: string;
  quantity?: number;
  receivedQty?: number;
  unit?: string;
  unitPrice?: number;
  lineTotal?: number;
  remarks?: string;
};

export type WorkOrderView = {
  _id?: string;
  workOrderNo?: string;
  subject?: string;
  reference?: string;
  attention?: string;
  salutation?: string;
  supplier?: string | Party;
  warehouseOrFactory?: string | Warehouse;
  issueDate?: string;
  expectedDeliveryDate?: string;
  items?: WorkOrderItem[];
  status?:
    | "Pending"
    | "Processing"
    | "Approved"
    | "Completed"
    | "Cancelled"
    | string;
  notes?: string;
  terms?: string;
  selectedTemplateId?: string | null;
  discountPercent?: number;
  taxPercent?: number;
  subTotal?: number;
  discountAmount?: number;
  taxTotal?: number;
  grandTotal?: number;
  footerNote?: string;
  createdBy?: string | IUser;
  approvedBy?: string | IUser;
  cancelReason?: string;
  createdAt?: string;
  updatedAt?: string;
};

const moneyFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function fmtMoney(n?: number | null) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "-";
  return moneyFormatter.format(Math.round(Number(n) * 100) / 100);
}

/**
 * Stable date output to avoid hydration mismatch.
 * If the backend stores ISO dates, this returns YYYY-MM-DD consistently.
 */
export function fmtDate(input?: string) {
  if (!input) return "-";
  if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}/.test(input)) {
    return input.slice(0, 10);
  }
  return input;
}

export function safeName(v?: any) {
  if (!v) return "-";
  if (typeof v === "string") return v;
  return v.name ?? v.supplierName ?? "-";
}

export function safeAddress(v?: any) {
  if (!v || typeof v === "string") return "-";
  return v.address ?? "-";
}

export const text = safeName;
export const addr = safeAddress;

export function itemName(it: WorkOrderItem) {
  return (
    it?.name || (typeof it?.itemId === "object" ? it.itemId?.name : "") || "-"
  );
}

export const statusClassMap: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-800 ring-1 ring-amber-200",
  Processing: "bg-sky-100 text-sky-800 ring-1 ring-sky-200",
  Approved: "bg-indigo-100 text-indigo-800 ring-1 ring-indigo-200",
  Completed: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200",
  Cancelled: "bg-rose-100 text-rose-800 ring-1 ring-rose-200",
};

export function words(num: number) {
  if (Number.isNaN(num) || !Number.isFinite(num)) return "";

  const a = [
    "",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
  ];
  const b = [
    "",
    "",
    "twenty",
    "thirty",
    "forty",
    "fifty",
    "sixty",
    "seventy",
    "eighty",
    "ninety",
  ];

  const toWords = (n: number): string => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? "-" + a[n % 10] : "");
    if (n < 1000)
      return (
        a[Math.floor(n / 100)] +
        " hundred" +
        (n % 100 ? " " + toWords(n % 100) : "")
      );
    if (n < 1000000)
      return (
        toWords(Math.floor(n / 1000)) +
        " thousand" +
        (n % 1000 ? " " + toWords(n % 1000) : "")
      );
    return (
      toWords(Math.floor(n / 1000000)) +
      " million" +
      (n % 1000000 ? " " + toWords(n % 1000000) : "")
    );
  };

  const intPart = Math.floor(Math.abs(num));
  const cents = Math.round((Math.abs(num) - intPart) * 100);
  return `${num < 0 ? "minus " : ""}${intPart === 0 ? "zero" : toWords(intPart)}${
    cents > 0 ? ` and ${cents}/100` : ""
  }`;
}

export function esc(s?: string) {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\n/g, "<br/>");
}

export function buildPrintHtml(
  viewing: WorkOrderView,
  company = {
    name: "Antab Agro LDT",
    address: "Company address, city, country",
    phone: "Phone: +000 000 000",
    email: "Email: info@company.com",
  },
) {
  const rows = (viewing.items || [])
    .map(
      (it, i) => `
        <tr>
          <td>${i + 1}</td>
          <td><strong>${esc(itemName(it))}</strong></td>
          <td>${esc(it.description || "-")}</td>
          <td class="right">${it.quantity ?? 0}</td>
          <td class="right">${esc(it.unit || "-")}</td>
          <td class="right">${fmtMoney(it.unitPrice)}</td>
          <td class="right">${fmtMoney(it.lineTotal)}</td>
          <td class="right">${it.remarks}</td>
        </tr>
      `,
    )
    .join("");

  return `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Work Order ${esc(viewing.workOrderNo || "")}</title>
      <style>
        @page { size: A4; margin: 12mm; }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111827; font-size: 12px; }
        .top { display:flex; justify-content:space-between; gap:16px; border-bottom:2px solid #111827; padding-bottom:14px; margin-bottom:14px; }
        .brand { max-width: 58%; }
        .brand h1 { margin:0; font-size:22px; }
        .brand .m { margin-top:4px; color:#6b7280; }
        .doc { text-align:right; min-width:280px; }
        .doc h2 { margin:0; font-size:24px; }
        .doc .no { margin-top:4px; font-size:14px; font-weight:700; }
        .chip { display:inline-block; margin-top:8px; padding:5px 10px; border-radius:999px; background:#f3f4f6; font-size:11px; font-weight:700; text-transform:uppercase; }
        .meta { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:14px; }
        .box { border:1px solid #d1d5db; border-radius:12px; padding:12px; }
        .metabox{
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 20px;
        }
        .lab { font-size:11px; color:#6b7280; text-transform:uppercase; letter-spacing:.08em; margin-bottom:4px; }
        .val { font-weight:700; }
        .two { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:14px; }
        .card { border:1px solid #d1d5db; border-radius:12px; padding:12px; }
        .t { font-size:11px; color:#6b7280; text-transform:uppercase; letter-spacing:.08em; margin-bottom:8px; font-weight:700; }
        table { width:100%; border-collapse:collapse; }
        th, td { border:1px solid #d1d5db; padding:8px; vertical-align:top; }
        th { background:#f8fafc; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:.06em; }
        .right { text-align:right; }
        .sumwrap { display:flex; justify-content:flex-end; margin-top:12px; }
        .sum { width:360px; border:1px solid #d1d5db; border-radius:12px; overflow:hidden; }
        .row { display:flex; justify-content:space-between; padding:8px 12px; border-bottom:1px solid #e5e7eb; }
        .row:last-child { border-bottom:none; }
        .grand { font-weight:700; background:#f8fafc; }
        .words { margin-top:8px; color:#6b7280; font-size:11px; }
        .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:14px; }
        .pre { white-space:pre-wrap; }
        .sigs { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-top:16px; }
        .sig { text-align:center; }
        .line { border-bottom:1px solid #111827; height:46px; }
        .sl { margin-top:8px; font-size:12px; font-weight:700; }
        .ft { margin-top:16px; padding-top:10px; border-top:1px solid #d1d5db; color:#6b7280; font-size:11px; text-align:center; }
      </style>
    </head>
    <body>
      <div class="top">
        <div class="brand">
          <h1>${esc(company.name)}</h1>
          <div class="m">${esc(company.address)}<br/>${esc(company.phone)}<br/>${esc(company.email)}</div>
        </div>
        <div class="doc">
          <h2>WORK ORDER</h2>
          <div class="no">${esc(viewing.workOrderNo || "-")}</div>
          <div class="m">Issue: ${esc(fmtDate(viewing.issueDate))}</div>
          <div class="m">Expected: ${esc(fmtDate(viewing.expectedDeliveryDate))}</div>
        </div>
      </div>

      <div class="two">
        <div class="">
          <div class="t">WO To</div>
          <div class="val">${esc(safeName(viewing.supplier))}</div>
          <div class="m">${esc(safeAddress(viewing.supplier))}</div>
        </div>
        <div class="">
          <div class="t">Factory / Ship To</div>
          <div class="val">${esc(safeName(viewing.warehouseOrFactory))}</div>
          <div class="m">${esc(safeAddress(viewing.warehouseOrFactory))}</div>
        </div>
      </div>

      <div class="metabox">
        <div><strong>Ref:</strong> ${esc(viewing.reference)}</div>
        <div><strong>Subject:</strong> ${esc(viewing.subject)}</div>
        <div> Dear Sir / Madam, <br/> ${esc(viewing.salutation)}</div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width:20px;">#</th>
            <th style="width:170px;">Item</th>
            <th >Description</th>
            <th class="right" style="width:40px;">Qty</th>
            <th class="right" style="width:40px;">Unit</th>
            <th class="right" style="width:90px;">Unit Price</th>
            <th class="right" style="width:90px;">Line Total</th>
            <th class="right" style="width:130px;">Remarks</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="7" style="text-align:center;color:#6b7280;padding:16px;">No items found.</td></tr>`}
        </tbody>
      </table>

      <div class="sumwrap">
        <div class="sum">
          <div class="row"><div>Subtotal</div><div>${fmtMoney(viewing.subTotal)}</div></div>
          <div class="row"><div>Discount (${viewing.discountPercent ?? 0}%)</div><div>- ${fmtMoney(viewing.discountAmount)}</div></div>
          <div class="row"><div>Tax (${viewing.taxPercent ?? 0}%)</div><div>${fmtMoney(viewing.taxTotal)}</div></div>
          <div class="row grand"><div>Grand Total</div><div>${fmtMoney(viewing.grandTotal)}</div></div>
        </div>
      </div>

      <div class="words">Amount in words: ${esc(words(Number(viewing.grandTotal || 0)) || "-")}</div>

      <div class="grid2">
        <div class="card">
          <div class="t">Terms & Conditions</div>
          <div class="pre">${esc(viewing.terms || "-")}</div>
        </div>
        <div class="card">
          <div class="t">Notes</div>
          <div class="pre">${esc(viewing.notes || "-")}</div>
          ${
            viewing.cancelReason
              ? `<div style="margin-top:10px;color:#b91c1c;font-weight:700;">Cancel Reason</div><div class="pre" style="color:#b91c1c;">${esc(viewing.cancelReason)}</div>`
              : ""
          }
        </div>
      </div>

      <div class="sigs">
        <div class="sig"><div class="line"></div><div class="sl">Prepared By</div><div class="m">${esc(safeName(viewing.createdBy))}</div></div>
        <div class="sig"><div class="line"></div><div class="sl">Approved By</div><div class="m">${esc(safeName(viewing.approvedBy))}</div></div>
        <div class="sig"><div class="line"></div><div class="sl">Chairman</div><div class="m">-</div></div>
      </div>

      <div class="ft">${esc(viewing.footerNote || company.name + " · " + company.phone + " · " + company.email)}</div>
    </body>
  </html>`;
}
