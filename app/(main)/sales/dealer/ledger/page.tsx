// src/app/(main)/dealer-ledger/page.tsx
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import {
  Search,
  Loader2,
  ChevronDown,
  ChevronUp,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import GlobalPrintButton from "@/components/common/print/GlobalPrintButton";

/* --------------------------- Types --------------------------- */
type DealerOption = { value: string; label: string; description?: string };
type CommissionDirection = "ADD" | "DEDUCT";
type CommissionCalcMode = "PERCENT" | "FLAT" | "NONE";
type FilterType = "ALL" | "SALE" | "PAYMENT" | "RETURN";

type LedgerEntry = {
  id: string;
  date: string;
  type: "SALE" | "PAYMENT" | "RETURN";
  reference: string;
  debit: number;
  credit: number;
  grossCredit?: number;
  commission?: number;
  commissionCredited?: number;
  commissionDirection?: CommissionDirection;
  commissionCalcMode?: CommissionCalcMode;
  commissionRate?: number;
  commissionSource?: string;
  balance: number;
  details: Record<string, any>;
};

type LedgerData = {
  dealer: {
    id: string;
    name: string;
    phone: string;
    creditLimit: number;
    currentDue: number;
    openingBalance: number;
  };
  entries: LedgerEntry[];
  summary: {
    openingBalance: number;
    totalSales: number;
    totalPayments: number;
    totalCommission: number;
    totalCommissionEffect: number;
    totalCredited: number;
    totalReturns: number;
    closingBalance: number;
    storedDue: number;
    dueMismatch: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasPrev: boolean;
    hasNext: boolean;
  };
};

/* --------------------------- Helpers --------------------------- */
const money = (n: number) =>
  Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatDate = (v?: string | Date) => {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const typeConfig: Record<
  LedgerEntry["type"],
  { icon: LucideIcon; color: string; label: string }
> = {
  SALE: { icon: ArrowUpRight, color: "text-emerald-600", label: "Sale" },
  PAYMENT: { icon: ArrowDownLeft, color: "text-blue-600", label: "Payment" },
  RETURN: { icon: RotateCcw, color: "text-orange-600", label: "Return" },
};

/* --------------------------- Dealer Search --------------------------- */
function DealerSearchSelect({
  value,
  selectedLabel,
  onPick,
}: {
  value?: string;
  selectedLabel?: string;
  onPick: (opt: DealerOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<DealerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const cache = useRef<Record<string, DealerOption[]>>({});

  const fetchDealers = useCallback(async (search: string) => {
    const res = await api.get("/dealers", {
      params: { q: search || undefined, page: 1, limit: 30 },
    });
    return ((res.data?.data || []) as any[]).map<DealerOption>((d) => ({
      value: String(d._id || d.id),
      label: d.name || d.proprietor || String(d._id || d.id),
      description: [d.phoneNumber || d.phone, d.status]
        .filter(Boolean)
        .join(" · "),
    }));
  }, []);

  useEffect(() => {
    if (!open) return;
    const key = query.trim().toLowerCase();
    const t = setTimeout(async () => {
      if (cache.current[key]) return setOptions(cache.current[key]);
      setLoading(true);
      try {
        const list = await fetchDealers(query);
        cache.current[key] = list;
        setOptions(list);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [open, query, fetchDealers]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-between truncate"
        >
          <span className="truncate">{selectedLabel || "Search dealer..."}</span>
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Type dealer name or phone..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? "Loading..." : "No dealer found."}
            </CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={`${opt.label} ${opt.description || ""}`}
                  onSelect={() => {
                    onPick(opt);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{opt.label}</div>
                    {opt.description && (
                      <div className="truncate text-xs text-muted-foreground">
                        {opt.description}
                      </div>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* --------------------------- Commission badge --------------------------- */
function CommissionBadge({ entry }: { entry: LedgerEntry }) {
  if (entry.type !== "PAYMENT") return null;

  const amount = entry.commission ?? 0;
  const direction = entry.commissionDirection ?? "ADD";
  const rate = entry.commissionRate ?? 0;
  const calcMode = entry.commissionCalcMode ?? "NONE";

  if (amount <= 0) {
    return (
      <div className="mt-0.5 text-[10px] font-medium text-amber-700">
        no commission
      </div>
    );
  }

  const isAdd = direction === "ADD";
  const sign = isAdd ? "+" : "−";
  const cls = isAdd
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : "bg-rose-50 text-rose-700 border-rose-200";
  const rateLabel =
    calcMode === "PERCENT" ? `${rate}%` : calcMode === "FLAT" ? "flat" : "";

  return (
    <div className="mt-0.5">
      <span
        className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium ${cls}`}
        title={`Source: ${entry.commissionSource || "unknown"}`}
      >
        {sign}৳ {money(amount)}
        {rateLabel && <span className="opacity-70">({rateLabel})</span>}
      </span>
    </div>
  );
}

/* --------------------------- Row + expansion --------------------------- */
function LedgerRow({
  entry,
  isExpanded,
  onToggle,
}: {
  entry: LedgerEntry;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const cfg = typeConfig[entry.type];
  const Icon = cfg.icon;

  return (
    <>
      <tr
        className="cursor-pointer border-b transition-colors hover:bg-slate-50"
        onClick={onToggle}
      >
        <td className="whitespace-nowrap px-3 py-2 text-xs">
          {formatDate(entry.date)}
        </td>
        <td className="px-3 py-2 text-xs font-medium">{entry.reference}</td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-1.5">
            <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
            <span className="text-xs font-medium">{cfg.label}</span>
          </div>
          <CommissionBadge entry={entry} />
        </td>
        <td className="px-3 py-2 text-right text-xs font-mono">
          {entry.debit > 0 ? money(entry.debit) : "—"}
        </td>
        <td className="px-3 py-2 text-right text-xs font-mono">
          {entry.credit > 0 ? money(entry.credit) : "—"}
        </td>
        <td className="px-3 py-2 text-right text-xs font-bold">
          {money(entry.balance)}
        </td>
        <td className="px-2 py-2 text-center">
          {isExpanded ? (
            <ChevronUp className="inline-block h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="inline-block h-3.5 w-3.5" />
          )}
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-slate-50/70">
          <td colSpan={7} className="px-4 py-3">
            <ExpandedDetails entry={entry} />
          </td>
        </tr>
      )}
    </>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="text-xs">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="font-medium">{value ?? "—"}</div>
    </div>
  );
}

function ExpandedDetails({ entry }: { entry: LedgerEntry }) {
  const d = entry.details || {};

  if (entry.type === "SALE") {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Field label="Order No" value={d.orderNo} />
          <Field label="Order Date" value={formatDate(d.orderDate)} />
          <Field label="Delivered" value={formatDate(d.deliveredAt)} />
          <Field label="Warehouse" value={d.warehouse} />
          <Field label="Invoice No" value={d.invoiceNo} />
          <Field label="Subtotal" value={`৳ ${money(d.subTotal)}`} />
          <Field label="Discount" value={`৳ ${money(d.discount)}`} />
          <Field label="Tax" value={`৳ ${money(d.tax)}`} />
        </div>
        <table className="w-full border-collapse text-xs">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">Product</th>
              <th className="px-2 py-1.5 text-right font-medium">Qty</th>
              <th className="px-2 py-1.5 text-right font-medium">Bonus</th>
              <th className="px-2 py-1.5 text-right font-medium">Unit Price</th>
              <th className="px-2 py-1.5 text-right font-medium">Line Total</th>
            </tr>
          </thead>
          <tbody>
            {(d.items || []).map((it: any, i: number) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="px-2 py-1.5">
                  {it.productName}
                  {it.sku && (
                    <span className="ml-1 text-muted-foreground">
                      ({it.sku})
                    </span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-right">{it.qty}</td>
                <td className="px-2 py-1.5 text-right">{it.bonusQty}</td>
                <td className="px-2 py-1.5 text-right">
                  {money(it.unitPrice)}
                </td>
                <td className="px-2 py-1.5 text-right">
                  {money(it.lineTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-end text-xs font-semibold">
          Grand Total: ৳ {money(d.grandTotal)}
        </div>
      </div>
    );
  }

  if (entry.type === "PAYMENT") {
    const commAmount = Number(d.commission) || 0;
    const commEff = Number(d.commissionEffect) || 0;
    const commDir = String(d.commissionDirection || "ADD");
    const commMode = String(d.commissionCalcMode || "NONE");
    const commRate = Number(d.commissionRate) || 0;

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Field label="MR No" value={d.mrNo} />
          <Field label="MR Date" value={formatDate(d.mrDate)} />
          <Field label="Invoice No" value={d.invoiceNo} />
          <Field label="Collection Date" value={formatDate(d.collectionDate)} />
          <Field label="Payment Mode" value={d.paymentMode} />
          <Field label="Bank" value={d.bank} />
          <Field label="Cheque No" value={d.chequeNo} />
          <Field label="Online Copy" value={d.onlineCopyNo} />
        </div>

        <div className="rounded-lg border bg-white p-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="text-xs">
              <div className="text-muted-foreground">Cash (Taka)</div>
              <div className="font-semibold">৳ {money(d.taka)}</div>
            </div>
            <div className="text-xs">
              <div className="text-muted-foreground">Commission</div>
              <div className="font-semibold">
                ৳ {money(commAmount)}
                {commMode === "PERCENT" && commRate > 0 && (
                  <span className="ml-1 text-muted-foreground">
                    ({commRate}%)
                  </span>
                )}
              </div>
            </div>
            <div className="text-xs">
              <div className="text-muted-foreground">Direction</div>
              <div>
                {commDir === "ADD" ? (
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
                    ADDED
                  </span>
                ) : (
                  <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-800">
                    DEDUCTED
                  </span>
                )}
              </div>
            </div>
            <div className="text-xs">
              <div className="text-muted-foreground">Total Credit</div>
              <div className="font-bold text-emerald-700">
                ৳ {money(d.totalCredit)}
              </div>
            </div>
          </div>

          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900">
            <strong>Debug:</strong> source=
            <code>{d.commissionSource || "none"}</code>
            {" · "}calcMode=<code>{commMode}</code>
            {" · "}direction=<code>{commDir}</code>
            {" · "}effect=<code>{commEff >= 0 ? "+" : ""}{money(commEff)}</code>
            {d.commissionRaw != null && (
              <div className="mt-0.5 text-[10px] text-amber-700">
                raw: <code>{JSON.stringify(d.commissionRaw)}</code> · flag=
                <code>{String(d.deductCommissionFlag)}</code>
              </div>
            )}
          </div>
        </div>

        {d.remarks && (
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Remarks: </span>
            {d.remarks}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Field label="Return No" value={d.returnNo} />
        <Field label="Created" value={formatDate(d.createdAt)} />
        <Field label="Completed" value={formatDate(d.completedAt)} />
        <Field
          label="Invoice No(s)"
          value={Array.isArray(d.invoiceNos) ? d.invoiceNos.join(", ") : "—"}
        />
      </div>
      {d.reason && (
        <div className="text-xs">
          <span className="text-muted-foreground">Reason: </span>
          <span className="font-medium">{d.reason}</span>
        </div>
      )}
      <table className="w-full border-collapse text-xs">
        <thead className="bg-slate-100">
          <tr>
            <th className="px-2 py-1.5 text-left font-medium">Product</th>
            <th className="px-2 py-1.5 text-right font-medium">Qty</th>
            <th className="px-2 py-1.5 text-right font-medium">Unit Price</th>
            <th className="px-2 py-1.5 text-right font-medium">Return Amount</th>
          </tr>
        </thead>
        <tbody>
          {(d.items || []).map((it: any, i: number) => (
            <tr key={i} className="border-t border-slate-100">
              <td className="px-2 py-1.5">{it.productName}</td>
              <td className="px-2 py-1.5 text-right">{it.qty}</td>
              <td className="px-2 py-1.5 text-right">
                {money(it.unitPrice)}
              </td>
              <td className="px-2 py-1.5 text-right">
                {money(it.returnAmount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-right text-xs font-semibold">
        Total Return: ৳ {money(d.totalReturnAmount)}
      </div>
    </div>
  );
}

/* --------------------------- Print helpers --------------------------- */
function buildSummaryPrintHtml(data: LedgerData): string {
  const { dealer, summary, entries } = data;
  const rows = entries
    .map((e) => {
      const cfg = typeConfig[e.type];
      return `<tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:5px 6px;font-size:10px;">${formatDate(e.date)}</td>
        <td style="padding:5px 6px;font-size:10px;">${e.reference}</td>
        <td style="padding:5px 6px;font-size:10px;">${cfg.label}</td>
        <td style="padding:5px 6px;text-align:right;font-size:10px;">${e.debit > 0 ? money(e.debit) : "—"}</td>
        <td style="padding:5px 6px;text-align:right;font-size:10px;">${e.credit > 0 ? money(e.credit) : "—"}</td>
        <td style="padding:5px 6px;text-align:right;font-size:10px;font-weight:700;">${money(e.balance)}</td>
      </tr>`;
    })
    .join("");

  return `
<div style="font-family:'Inter',sans-serif;max-width:100%;margin:0 auto;color:#1e293b;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
  <div style="background:linear-gradient(135deg,#0f172a,#1e293b);padding:18px 28px;display:flex;justify-content:space-between;align-items:center;color:#fff;">
    <div>
      <div style="font-size:22px;font-weight:800;letter-spacing:-0.5px;">DEALER LEDGER — SUMMARY</div>
      <div style="font-size:13px;opacity:.9;margin-top:2px;">${dealer.name} (${dealer.phone || "—"})</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:16px;font-weight:800;">Opening: ৳ ${money(summary.openingBalance)}</div>
      <div style="font-size:12px;opacity:.8;">Current Due: ৳ ${money(summary.closingBalance)}</div>
    </div>
  </div>
  <div style="padding:14px 28px;display:flex;gap:10px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
    <div style="flex:1;background:#fff;border-radius:10px;padding:10px;"><div style="font-size:10px;text-transform:uppercase;color:#64748b;">Opening</div><div style="font-weight:700;">৳ ${money(summary.openingBalance)}</div></div>
    <div style="flex:1;background:#fff;border-radius:10px;padding:10px;"><div style="font-size:10px;text-transform:uppercase;color:#64748b;">Sales</div><div style="font-weight:700;">৳ ${money(summary.totalSales)}</div></div>
    <div style="flex:1;background:#fff;border-radius:10px;padding:10px;"><div style="font-size:10px;text-transform:uppercase;color:#64748b;">Payments</div><div style="font-weight:700;">৳ ${money(summary.totalPayments)}</div></div>
    <div style="flex:1;background:#fff;border-radius:10px;padding:10px;"><div style="font-size:10px;text-transform:uppercase;color:#64748b;">Commission</div><div style="font-weight:700;">৳ ${money(summary.totalCommission)}</div></div>
    <div style="flex:1;background:#fff;border-radius:10px;padding:10px;"><div style="font-size:10px;text-transform:uppercase;color:#64748b;">Total Credited</div><div style="font-weight:700;">৳ ${money(summary.totalCredited)}</div></div>
    <div style="flex:1;background:#fff;border-radius:10px;padding:10px;"><div style="font-size:10px;text-transform:uppercase;color:#64748b;">Returns</div><div style="font-weight:700;">৳ ${money(summary.totalReturns)}</div></div>
    <div style="flex:1;background:#fff;border-radius:10px;padding:10px;"><div style="font-size:10px;text-transform:uppercase;color:#64748b;">Due</div><div style="font-weight:700;">৳ ${money(summary.closingBalance)}</div></div>
  </div>
  <div style="padding:16px 28px;">
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr style="background:#f1f5f9;">
        <th style="padding:6px;text-align:left;">Date</th>
        <th style="padding:6px;text-align:left;">Reference</th>
        <th style="padding:6px;text-align:left;">Type</th>
        <th style="padding:6px;text-align:right;">Debit</th>
        <th style="padding:6px;text-align:right;">Credit</th>
        <th style="padding:6px;text-align:right;">Balance</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <div style="background:#0f172a;color:#94a3b8;text-align:center;padding:8px 28px;font-size:10px;display:flex;justify-content:space-between;">
    <div>Computer‑generated ledger (summary)</div>
    <div>© Antab Agro LTD</div>
  </div>
</div>`;
}

function buildDetailedPrintHtml(data: LedgerData): string {
  const { dealer, summary, entries } = data;

  const rows = entries
    .map((e) => {
      const cfg = typeConfig[e.type];
      let detailsHtml = "";

      if (e.type === "SALE") {
        const items = (e.details.items || [])
          .map(
            (it: any) =>
              `<tr><td style="padding:2px 4px;border-bottom:1px dotted #e2e8f0;">${it.productName}</td>
               <td style="padding:2px 4px;border-bottom:1px dotted #e2e8f0;text-align:right;">${it.qty}</td>
               <td style="padding:2px 4px;border-bottom:1px dotted #e2e8f0;text-align:right;">${it.bonusQty ?? 0}</td>
               <td style="padding:2px 4px;border-bottom:1px dotted #e2e8f0;text-align:right;">${money(it.unitPrice)}</td>
               <td style="padding:2px 4px;border-bottom:1px dotted #e2e8f0;text-align:right;">${money(it.lineTotal)}</td></tr>`,
          )
          .join("");
        detailsHtml = `<table style="width:100%;font-size:9px;margin-top:2px;"><thead><tr style="background:#f8fafc;"><th style="text-align:left;padding:2px 4px;">Product</th><th style="text-align:right;padding:2px 4px;">Qty</th><th style="text-align:right;padding:2px 4px;">Bonus</th><th style="text-align:right;padding:2px 4px;">Rate</th><th style="text-align:right;padding:2px 4px;">Total</th></tr></thead><tbody>${items}</tbody></table>`;
      } else if (e.type === "PAYMENT") {
        const comm = e.details.commission || 0;
        const commDir = e.details.commissionDirection || "ADD";
        const commMode = e.details.commissionCalcMode || "NONE";
        const commRate = e.details.commissionRate || 0;
        const commSrc = e.details.commissionSource || "none";
        detailsHtml = `<div style="font-size:9px;color:#475569;margin-top:2px;">
          MR: ${e.details.mrNo || "—"} · Invoice: ${e.details.invoiceNo || "—"} · Mode: ${e.details.paymentMode || "—"} · Bank: ${e.details.bank || "—"} · Cheque: ${e.details.chequeNo || "—"}
        </div>
        <div style="font-size:9px;color:#0f172a;margin-top:2px;">
          Cash: ৳ ${money(e.details.taka)} ·
          Commission: ৳ ${money(comm)} ${commMode === "PERCENT" && commRate ? `(${commRate}%)` : ""} ·
          Direction: ${commDir} ·
          Total credit: ৳ ${money(e.details.totalCredit)}
          <span style="color:#94a3b8;"> (src: ${commSrc})</span>
        </div>`;
      } else {
        const items = (e.details.items || [])
          .map(
            (it: any) =>
              `<tr><td style="padding:2px 4px;border-bottom:1px dotted #e2e8f0;">${it.productName}</td>
               <td style="padding:2px 4px;border-bottom:1px dotted #e2e8f0;text-align:right;">${it.qty}</td>
               <td style="padding:2px 4px;border-bottom:1px dotted #e2e8f0;text-align:right;">${money(it.unitPrice)}</td>
               <td style="padding:2px 4px;border-bottom:1px dotted #e2e8f0;text-align:right;">${money(it.returnAmount)}</td></tr>`,
          )
          .join("");
        detailsHtml = `<div style="font-size:9px;color:#475569;margin-top:2px;">Return No: ${e.details.returnNo} · Invoices: ${(e.details.invoiceNos || []).join(", ") || "—"}</div>
          <table style="width:100%;font-size:9px;margin-top:2px;"><thead><tr style="background:#f8fafc;"><th style="text-align:left;padding:2px 4px;">Product</th><th style="text-align:right;padding:2px 4px;">Qty</th><th style="text-align:right;padding:2px 4px;">Rate</th><th style="text-align:right;padding:2px 4px;">Amount</th></tr></thead><tbody>${items}</tbody></table>`;
      }

      return `<tr style="border-bottom:1px solid #e2e8f0;page-break-inside:avoid;">
        <td style="padding:5px 6px;font-size:10px;vertical-align:top;">${formatDate(e.date)}</td>
        <td style="padding:5px 6px;font-size:10px;vertical-align:top;">${e.reference}</td>
        <td style="padding:5px 6px;font-size:10px;vertical-align:top;">${cfg.label}</td>
        <td style="padding:5px 6px;text-align:right;font-size:10px;vertical-align:top;">${e.debit > 0 ? money(e.debit) : "—"}</td>
        <td style="padding:5px 6px;text-align:right;font-size:10px;vertical-align:top;">${e.credit > 0 ? money(e.credit) : "—"}</td>
        <td style="padding:5px 6px;text-align:right;font-size:10px;vertical-align:top;font-weight:700;">${money(e.balance)}</td>
        <td colspan="6" style="padding:0 6px 5px 6px;">${detailsHtml}</td>
      </tr>`;
    })
    .join("");

  return `
<div style="font-family:'Inter',sans-serif;max-width:100%;margin:0 auto;color:#1e293b;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
  <div style="background:linear-gradient(135deg,#0f172a,#1e293b);padding:18px 28px;display:flex;justify-content:space-between;align-items:center;color:#fff;">
    <div>
      <div style="font-size:22px;font-weight:800;letter-spacing:-0.5px;">DEALER LEDGER — DETAILED</div>
      <div style="font-size:13px;opacity:.9;margin-top:2px;">${dealer.name} (${dealer.phone || "—"})</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:16px;font-weight:800;">Opening: ৳ ${money(summary.openingBalance)}</div>
      <div style="font-size:12px;opacity:.8;">Current Due: ৳ ${money(summary.closingBalance)}</div>
    </div>
  </div>
  <div style="padding:16px 28px;">
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr style="background:#f1f5f9;">
        <th style="padding:6px;text-align:left;">Date</th>
        <th style="padding:6px;text-align:left;">Reference</th>
        <th style="padding:6px;text-align:left;">Type</th>
        <th style="padding:6px;text-align:right;">Debit</th>
        <th style="padding:6px;text-align:right;">Credit</th>
        <th style="padding:6px;text-align:right;">Balance</th>
        <th colspan="6"></th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <div style="background:#0f172a;color:#94a3b8;text-align:center;padding:8px 28px;font-size:10px;display:flex;justify-content:space-between;">
    <div>Computer‑generated ledger (detailed)</div>
    <div>© Antab Agro LTD</div>
  </div>
</div>`;
}

/* --------------------------- Page --------------------------- */
export default function DealerLedgerPage() {
  const [selectedDealer, setSelectedDealer] = useState<DealerOption | null>(
    null,
  );
  const [data, setData] = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [typeFilter, setTypeFilter] = useState<FilterType>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    setPage(1);
  }, [selectedDealer, startDate, endDate, typeFilter, pageSize]);

  const fetchLedger = useCallback(async () => {
    if (!selectedDealer?.value) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(
        `/dealer-ledger/${selectedDealer.value}/ledger`,
        {
          params: {
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            type: typeFilter !== "ALL" ? typeFilter : undefined,
            page,
            limit: pageSize,
          },
        },
      );
      setData((res.data?.data as LedgerData) ?? null);
      setExpanded(new Set());
    } catch (e: unknown) {
      const msg =
        (e as any)?.response?.data?.message ||
        (e as any)?.message ||
        "Failed to load ledger";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [selectedDealer, startDate, endDate, typeFilter, page, pageSize]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const from =
    data && data.entries.length
      ? (data.pagination.page - 1) * data.pagination.limit + 1
      : 0;
  const to = data
    ? Math.min(
        (data.pagination.page - 1) * data.pagination.limit +
          data.entries.length,
        data.pagination.total,
      )
    : 0;

  const printCompany = {
    name: "Antab Agro LTD",
    address: "123 Agro Street, Dhaka",
    phone: "+880 1711-111111",
    email: "info@antabagro.com",
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl p-4 md:p-6">
        {/* Header */}
        <div className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Dealer Ledger</h1>
              <p className="text-sm text-muted-foreground">
                Complete transaction history and balances for any dealer.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {data && (
                <>
                  <GlobalPrintButton
                    contentHtml={buildSummaryPrintHtml(data)}
                    label="Print Summary"
                    title="Dealer Ledger (Summary)"
                    orientation="landscape"
                    company={printCompany}
                    showHeader={false}
                    showFooter={false}
                  />
                  <GlobalPrintButton
                    contentHtml={buildDetailedPrintHtml(data)}
                    label="Print Detailed"
                    title="Dealer Ledger (Detailed)"
                    orientation="landscape"
                    company={printCompany}
                    showHeader={false}
                    showFooter={false}
                  />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6 border-slate-200 shadow-sm">
          <CardContent className="grid gap-4 p-4 md:grid-cols-5">
            <div className="space-y-2 md:col-span-1">
              <div className="text-sm font-medium">Select Dealer</div>
              <DealerSearchSelect
                value={selectedDealer?.value}
                selectedLabel={selectedDealer?.label}
                onPick={setSelectedDealer}
              />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Start Date</div>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">End Date</div>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Transaction Type</div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as FilterType)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none"
              >
                <option value="ALL">All</option>
                <option value="SALE">Sales</option>
                <option value="PAYMENT">Payments</option>
                <option value="RETURN">Returns</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                  setTypeFilter("ALL");
                }}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary cards — 7 cards, all equal width */}
        {data && (
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
            <Card className="border-l-4 border-l-indigo-500 shadow-sm">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Opening</div>
                <div className="mt-1 text-lg font-bold">
                  ৳ {money(data.summary.openingBalance)}
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-emerald-500 shadow-sm">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Total Sales</div>
                <div className="mt-1 text-lg font-bold">
                  ৳ {money(data.summary.totalSales)}
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-blue-500 shadow-sm">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">
                  Total Payments
                </div>
                <div className="mt-1 text-lg font-bold">
                  ৳ {money(data.summary.totalPayments)}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  cash only
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-purple-500 shadow-sm">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">
                  Total Commission
                </div>
                <div className="mt-1 text-lg font-bold">
                  ৳ {money(data.summary.totalCommission)}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {data.summary.totalCommissionEffect >= 0
                    ? "credited"
                    : "deducted"}
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-cyan-500 shadow-sm">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">
                  Total Credited
                </div>
                <div className="mt-1 text-lg font-bold">
                  ৳ {money(data.summary.totalCredited)}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  payments + commission
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-orange-500 shadow-sm">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">
                  Total Returns
                </div>
                <div className="mt-1 text-lg font-bold">
                  ৳ {money(data.summary.totalReturns)}
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-amber-500 shadow-sm">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">
                  Current Due
                </div>
                <div className="mt-1 text-lg font-bold">
                  ৳ {money(data.summary.closingBalance)}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Limit: ৳ {money(data.dealer.creditLimit)}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Due mismatch warning */}
        {data && data.summary.dueMismatch !== 0 && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <strong>Note:</strong> stored due{" "}
            <code>৳ {money(data.summary.storedDue)}</code> differs from computed{" "}
            <code>৳ {money(data.summary.closingBalance)}</code> (diff{" "}
            <code>৳ {money(data.summary.dueMismatch)}</code>). The stored value
            doesn&apos;t include commission — the ledger shown here does.
          </div>
        )}

        {/* Table */}
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-100 text-left">
                  <tr>
                    <th className="border-b px-3 py-2.5 font-medium">Date</th>
                    <th className="border-b px-3 py-2.5 font-medium">
                      Reference
                    </th>
                    <th className="border-b px-3 py-2.5 font-medium">Type</th>
                    <th className="border-b px-3 py-2.5 text-right font-medium">
                      Debit
                    </th>
                    <th className="border-b px-3 py-2.5 text-right font-medium">
                      Credit
                    </th>
                    <th className="border-b px-3 py-2.5 text-right font-medium">
                      Balance
                    </th>
                    <th className="w-8 border-b px-3 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {data && data.pagination.page === 1 && (
                    <tr className="border-b bg-slate-50/80">
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        —
                      </td>
                      <td className="px-3 py-2 text-xs font-medium text-muted-foreground">
                        Opening Balance
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <Wallet className="h-3.5 w-3.5 text-slate-500" />
                          <span className="text-xs font-medium text-slate-600">
                            B/F
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-xs">—</td>
                      <td className="px-3 py-2 text-right text-xs">—</td>
                      <td className="px-3 py-2 text-right text-xs font-bold">
                        {money(data.summary.openingBalance)}
                      </td>
                      <td />
                    </tr>
                  )}

                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center">
                        <div className="flex items-center justify-center gap-2 text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading ledger...
                        </div>
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-12 text-center text-red-600"
                      >
                        {error}
                        <div className="mt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={fetchLedger}
                          >
                            Retry
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ) : data && data.entries.length ? (
                    data.entries.map((e) => (
                      <LedgerRow
                        key={e.id}
                        entry={e}
                        isExpanded={expanded.has(e.id)}
                        onToggle={() => toggle(e.id)}
                      />
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-12 text-center text-muted-foreground"
                      >
                        {selectedDealer
                          ? "No transactions found for the selected period."
                          : "Select a dealer to view their ledger."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Pagination */}
        {data && data.pagination.total > 0 && (
          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>
                Showing <strong>{from}</strong>–<strong>{to}</strong> of{" "}
                <strong>{data.pagination.total}</strong>
              </span>
              <div className="flex items-center gap-1">
                <span className="text-xs">Rows:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                >
                  {[10, 20, 30, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Page {data.pagination.page} / {data.pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!data.pagination.hasPrev || loading}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={!data.pagination.hasNext || loading}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}