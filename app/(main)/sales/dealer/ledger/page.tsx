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
  Filter as FilterIcon,
  CalendarRange,
  X,
  RefreshCw,
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
type DatePreset =
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_3_months"
  | "this_year"
  | "";

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

function getPresetRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  switch (preset) {
    case "this_week": {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - diff);
      return { from: fmt(monday), to: fmt(now) };
    }
    case "last_week": {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1;
      const lastMonday = new Date(now);
      lastMonday.setDate(now.getDate() - diff - 7);
      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastMonday.getDate() + 6);
      return { from: fmt(lastMonday), to: fmt(lastSunday) };
    }
    case "this_month": {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: fmt(first), to: fmt(now) };
    }
    case "last_3_months": {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 3);
      return { from: fmt(d), to: fmt(now) };
    }
    case "this_year": {
      const first = new Date(now.getFullYear(), 0, 1);
      return { from: fmt(first), to: fmt(now) };
    }
    default:
      return { from: "", to: "" };
  }
}

const typeConfig: Record<
  LedgerEntry["type"],
  { icon: LucideIcon; color: string; label: string }
> = {
  SALE: { icon: ArrowUpRight, color: "text-[#3aa838]", label: "Sale" },
  PAYMENT: { icon: ArrowDownLeft, color: "text-[#2f8a2f]", label: "Payment" },
  RETURN: { icon: RotateCcw, color: "text-amber-600", label: "Return" },
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
          className="h-9 w-full justify-between truncate bg-white text-xs"
        >
          <span className="truncate">{selectedLabel || "Search dealer..."}</span>
          <Search className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
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

/* --------------------------- Summary strip --------------------------- */
type SummaryColor = "slate" | "green" | "greenDark";

const summaryBorderMap: Record<SummaryColor, string> = {
  slate: "border-l-slate-400",
  green: "border-l-[#3aa838]",
  greenDark: "border-l-[#2f8a2f]",
};

function LedgerSummaryCard({
  label,
  value,
  hint,
  color,
  highlight = false,
}: {
  label: string;
  value: string;
  hint?: string;
  color: SummaryColor;
  highlight?: boolean;
}) {
  return (
    <Card
      className={`min-w-[110px] flex-1 border-l-4 ${summaryBorderMap[color]} shadow-sm ${
        highlight ? "ring-2 ring-[#3aa838] ring-offset-1" : ""
      }`}
    >
      <CardContent className="p-2.5 md:p-3">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="mt-0.5 truncate text-sm font-bold tabular-nums md:text-base">
          ৳ {value}
        </div>
        {hint && (
          <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
            {hint}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OperatorBadge({ op }: { op: "+" | "−" | "=" }) {
  const styles: Record<"+" | "−" | "=", string> = {
    "+": "bg-[#3aa838] text-white shadow-[#3aa838]/30",
    "−": "bg-rose-500 text-white shadow-rose-200/60",
    "=": "bg-slate-800 text-white shadow-slate-300/60",
  };
  return (
    <div
      aria-label={`operator ${op}`}
      className={`flex h-6 w-6 shrink-0 items-center justify-center self-center rounded-full text-xs font-bold shadow-md ${styles[op]}`}
    >
      {op}
    </div>
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
    ? "bg-[#3aa838]/10 text-[#2f8a2f] border-[#3aa838]/30"
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
        <td className="px-3 py-2 text-right font-mono text-xs">
          {entry.debit > 0 ? money(entry.debit) : "—"}
        </td>
        <td className="px-3 py-2 text-right font-mono text-xs">
          {entry.credit > 0 ? money(entry.credit) : "—"}
        </td>
        <td className="px-3 py-2 text-right text-xs font-bold tabular-nums">
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
                  <span className="rounded bg-[#3aa838]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#2f8a2f]">
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
              <div className="font-bold text-[#2f8a2f]">
                ৳ {money(d.totalCredit)}
              </div>
            </div>
          </div>

          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900">
            <strong>Debug:</strong> source=
            <code>{d.commissionSource || "none"}</code>
            {" · "}calcMode=<code>{commMode}</code>
            {" · "}direction=<code>{commDir}</code>
            {" · "}effect=
            <code>
              {commEff >= 0 ? "+" : ""}
              {money(commEff)}
            </code>
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

/* --------------------------- Print helpers (unchanged) --------------------------- */
function buildSummaryPrintHtml(data: LedgerData): string {
  const { dealer, summary, entries } = data;
  const rows = entries
    .map((e) => {
      const cfg = typeConfig[e.type];
      return `<tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:5px 6px;font-size:10px;">${formatDate(e.date)}</td>
        <td style="padding:5px 6px;font-size:10px;">${e.reference}</td>
        <td style="padding:5px 6px;font-size:10px;">${cfg.label}</td>
        <td style="padding:5px 6px;text-align:right;font-size:10px;">${
          e.debit > 0 ? money(e.debit) : "—"
        }</td>
        <td style="padding:5px 6px;text-align:right;font-size:10px;">${
          e.credit > 0 ? money(e.credit) : "—"
        }</td>
        <td style="padding:5px 6px;text-align:right;font-size:10px;font-weight:700;">${money(
          e.balance,
        )}</td>
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
  const [datePreset, setDatePreset] = useState<DatePreset>("");
  const [filtersOpen, setFiltersOpen] = useState(false);

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

  /* ------------------- Date preset actions ------------------- */
  const applyPreset = (preset: DatePreset) => {
    if (!preset) {
      setStartDate("");
      setEndDate("");
      setDatePreset("");
      return;
    }
    const { from, to } = getPresetRange(preset);
    setStartDate(from);
    setEndDate(to);
    setDatePreset(preset);
  };

  const onDateChange = (which: "from" | "to", value: string) => {
    if (which === "from") setStartDate(value);
    else setEndDate(value);
    setDatePreset("");
  };

  const clearAll = () => {
    setStartDate("");
    setEndDate("");
    setTypeFilter("ALL");
    setDatePreset("");
  };

  const activeFilterCount =
    (startDate || endDate ? 1 : 0) + (typeFilter !== "ALL" ? 1 : 0);
  const hasAnyFilter = activeFilterCount > 0;

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
      <div className="mx-auto w-full max-w-7xl p-3 md:p-4">
        {/* ============ COMPACT HERO ============ */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#3aa838]/10">
              <Wallet className="h-4 w-4 text-[#3aa838]" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-semibold leading-tight">
                Dealer Ledger
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                {selectedDealer ? (
                  <>
                    <span className="truncate">
                      <b className="text-slate-900">{selectedDealer.label}</b>
                    </span>
                    {data && (
                      <>
                        <span className="text-slate-300">·</span>
                        <span>
                          Current due{" "}
                          <b className="text-[#2f8a2f] tabular-nums">
                            ৳ {money(data.summary.closingBalance)}
                          </b>
                        </span>
                        <span className="text-slate-300">·</span>
                        <span>
                          Limit{" "}
                          <b className="text-slate-900 tabular-nums">
                            ৳ {money(data.dealer.creditLimit)}
                          </b>
                        </span>
                      </>
                    )}
                  </>
                ) : (
                  <span>Select a dealer to see their ledger.</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => void fetchLedger()}
              disabled={loading || !selectedDealer}
              title="Refresh"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
            </Button>
            {data && (
              <>
                <GlobalPrintButton
                  contentHtml={buildSummaryPrintHtml(data)}
                  label="Summary"
                  title="Dealer Ledger (Summary)"
                  orientation="landscape"
                  company={printCompany}
                  showHeader={false}
                  showFooter={false}
                />
                <GlobalPrintButton
                  contentHtml={buildDetailedPrintHtml(data)}
                  label="Detailed"
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

        {/* ============ FILTER BAR ============ */}
        <div className="mb-3 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-2 px-3 py-2">
            <div className="w-full max-w-[280px]">
              <DealerSearchSelect
                value={selectedDealer?.value}
                selectedLabel={selectedDealer?.label}
                onPick={setSelectedDealer}
              />
            </div>

            <select
              value={datePreset}
              onChange={(e) => applyPreset(e.target.value as DatePreset)}
              className="h-9 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-[#3aa838]"
            >
              <option value="">
                {startDate || endDate ? "Custom range" : "All dates"}
              </option>
              <option value="this_week">This Week</option>
              <option value="last_week">Last Week</option>
              <option value="this_month">This Month</option>
              <option value="last_3_months">Last 3 Months</option>
              <option value="this_year">This Year</option>
            </select>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFiltersOpen((v) => !v)}
              className={`h-9 ${
                activeFilterCount > 0
                  ? "border-[#3aa838]/40 bg-[#3aa838]/5 text-[#2f8a2f]"
                  : ""
              }`}
            >
              <FilterIcon className="mr-1.5 h-3.5 w-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-1.5 rounded-full bg-[#3aa838] px-1.5 py-0 text-[10px] font-bold text-white tabular-nums">
                  {activeFilterCount}
                </span>
              )}
              {filtersOpen ? (
                <ChevronUp className="ml-1.5 h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
              )}
            </Button>

            {hasAnyFilter && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="h-9 text-slate-500"
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Clear
              </Button>
            )}

            <div className="ml-auto text-xs text-muted-foreground tabular-nums">
              {data ? `${data.pagination.total} records` : "No data"}
            </div>
          </div>

          {filtersOpen && (
            <div className="grid gap-3 border-t border-slate-200 bg-slate-50/60 px-3 py-3 md:grid-cols-3">
              <div className="space-y-1">
                <label className="flex items-center gap-1 text-[11px] font-medium text-slate-600">
                  <CalendarRange className="h-3 w-3" /> Start date
                </label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => onDateChange("from", e.target.value)}
                  className="h-9 text-xs focus-visible:ring-[#3aa838]"
                />
              </div>
              <div className="space-y-1">
                <label className="flex items-center gap-1 text-[11px] font-medium text-slate-600">
                  <CalendarRange className="h-3 w-3" /> End date
                </label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => onDateChange("to", e.target.value)}
                  className="h-9 text-xs focus-visible:ring-[#3aa838]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-600">
                  Transaction type
                </label>
                <select
                  value={typeFilter}
                  onChange={(e) =>
                    setTypeFilter(e.target.value as FilterType)
                  }
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-[#3aa838]"
                >
                  <option value="ALL">All</option>
                  <option value="SALE">Sales</option>
                  <option value="PAYMENT">Payments</option>
                  <option value="RETURN">Returns</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* ============ SUMMARY STRIP ============ */}
        {data && (
          <div className="mb-3 flex flex-col gap-1.5 lg:flex-row lg:items-stretch lg:gap-1.5">
            <LedgerSummaryCard
              label="Opening"
              value={money(data.summary.openingBalance)}
              color="slate"
            />
            <OperatorBadge op="+" />
            <LedgerSummaryCard
              label="Total Sales"
              value={money(data.summary.totalSales)}
              color="green"
            />
            <OperatorBadge op="−" />
            <LedgerSummaryCard
              label="Total Payments"
              value={money(data.summary.totalPayments)}
              hint="cash only"
              color="greenDark"
            />
            <OperatorBadge
              op={data.summary.totalCommissionEffect >= 0 ? "−" : "+"}
            />
            <LedgerSummaryCard
              label="Total Commission"
              value={money(data.summary.totalCommission)}
              hint={
                data.summary.totalCommissionEffect >= 0
                  ? "credited"
                  : "deducted"
              }
              color="greenDark"
            />
            <OperatorBadge op="−" />
            <LedgerSummaryCard
              label="Total Returns"
              value={money(data.summary.totalReturns)}
              color="greenDark"
            />
            <OperatorBadge op="=" />
            <LedgerSummaryCard
              label="Current Due"
              value={money(data.summary.closingBalance)}
              hint={`Limit: ৳ ${money(data.dealer.creditLimit)}`}
              color="green"
              highlight
            />
          </div>
        )}

        {/* ============ DUE MISMATCH ============ */}
        {data && data.summary.dueMismatch !== 0 && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <strong>Note:</strong> stored due{" "}
            <code>৳ {money(data.summary.storedDue)}</code> differs from computed{" "}
            <code>৳ {money(data.summary.closingBalance)}</code> (diff{" "}
            <code>৳ {money(data.summary.dueMismatch)}</code>). The stored value
            doesn&apos;t include commission — the ledger shown here does.
          </div>
        )}

        {/* ============ TABLE ============ */}
        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-slate-50 text-left">
                  <tr>
                    {[
                      "Date",
                      "Reference",
                      "Type",
                      "Debit",
                      "Credit",
                      "Balance",
                    ].map((h, i) => (
                      <th
                        key={h}
                        className={`border-b border-slate-200 px-3 py-2.5 text-[10px] font-medium uppercase tracking-wide text-slate-600 ${
                          i >= 3 && i <= 5 ? "text-right" : ""
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                    <th className="w-8 border-b border-slate-200"></th>
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
                      <td className="px-3 py-2 text-right text-xs font-bold tabular-nums">
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
                        className="px-4 py-12 text-center text-rose-600"
                      >
                        {error}
                        <div className="mt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void fetchLedger()}
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
                      <td colSpan={7} className="px-4 py-16 text-center">
                        <div className="mx-auto flex max-w-sm flex-col items-center gap-3 text-muted-foreground">
                          <div className="rounded-full bg-slate-100 p-3">
                            <Wallet className="h-6 w-6" />
                          </div>
                          <div className="text-sm font-medium text-slate-700">
                            {selectedDealer
                              ? "No transactions found"
                              : "No dealer selected"}
                          </div>
                          <div className="text-xs">
                            {selectedDealer
                              ? "Try widening the filters or date range."
                              : "Pick a dealer above to see their ledger."}
                          </div>
                          {selectedDealer && hasAnyFilter && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={clearAll}
                            >
                              <X className="mr-1.5 h-3.5 w-3.5" />
                              Clear filters
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ============ PAGINATION ============ */}
        {data && data.pagination.total > 0 && (
          <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>
                Showing{" "}
                <strong className="text-slate-900 tabular-nums">{from}</strong>–
                <strong className="text-slate-900 tabular-nums">{to}</strong> of{" "}
                <strong className="text-slate-900">
                  {data.pagination.total}
                </strong>
              </span>
              <div className="flex items-center gap-1">
                <span>Rows:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-[#3aa838]"
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
                Page{" "}
                <strong className="text-slate-900">
                  {data.pagination.page}
                </strong>{" "}
                / {data.pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!data.pagination.hasPrev || loading}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
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