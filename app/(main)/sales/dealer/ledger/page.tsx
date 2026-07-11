// src/app/(main)/dealer-ledger/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import {
  Search,
  Loader2,
  ChevronDown,
  ChevronUp,
  Printer,
  Check,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  Calendar,
  Filter,
  DollarSign,
  CreditCard,
  Receipt,
  Package,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
type DealerOption = {
  value: string;
  label: string;
  description?: string;
};

type LedgerEntry = {
  id: string;
  date: string;
  type: "SALE" | "PAYMENT" | "RETURN";
  reference: string;
  debit: number;
  credit: number;
  balance: number;
  details: any;
};

type DealerInfo = {
  id: string;
  name: string;
  phone: string;
  creditLimit: number;
  currentDue: number;
  openingBalance: number;
};

type LedgerSummary = {
  openingBalance: number;
  totalSales: number;
  totalPayments: number;
  totalReturns: number;
  closingBalance: number;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type LedgerData = {
  dealer: DealerInfo;
  entries: LedgerEntry[];
  summary: LedgerSummary;
  pagination: Pagination;
};

/* --------------------------- Helpers --------------------------- */
const money = (n: number) =>
  Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatDate = (value?: string) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const typeConfig: Record<
  string,
  { icon: React.ElementType; color: string; label: string }
> = {
  SALE: { icon: ArrowUpRight, color: "text-emerald-600", label: "Sale" },
  PAYMENT: { icon: ArrowDownLeft, color: "text-blue-600", label: "Payment" },
  RETURN: { icon: RotateCcw, color: "text-orange-600", label: "Return" },
};

/* --------------------------- Dealer Search Select --------------------------- */
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
  const cacheRef = useRef<Record<string, DealerOption[]>>({});

  const fetchDealers = useCallback(async (search: string) => {
    const res = await api.get("/dealers", {
      params: { q: search || undefined, page: 1, limit: 30 },
    });
    return (res.data?.data || []).map((d: any) => ({
      value: String(d._id || d.id),
      label: d.name || d.proprietor || String(d._id || d.id),
      description: `${d.phoneNumber || d.phone || ""}${d.status ? ` · ${d.status}` : ""}`,
    }));
  }, []);

  useEffect(() => {
    if (!open) return;
    const key = query.trim().toLowerCase();
    const timer = setTimeout(async () => {
      if (cacheRef.current[key]) {
        setOptions(cacheRef.current[key]);
        return;
      }
      setLoading(true);
      try {
        const list = await fetchDealers(query);
        cacheRef.current[key] = list;
        setOptions(list);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
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
            <CommandEmpty>{loading ? "Loading..." : "No dealer found."}</CommandEmpty>
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
                  <Check
                    className={`mr-2 h-4 w-4 ${
                      opt.value === value ? "opacity-100" : "opacity-0"
                    }`}
                  />
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

/* --------------------------- Expandable Row Component --------------------------- */
function LedgerRow({
  entry,
  isExpanded,
  onToggle,
}: {
  entry: LedgerEntry;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const config = typeConfig[entry.type] || typeConfig.SALE;
  const Icon = config.icon;

  return (
    <>
      <tr
        className="cursor-pointer border-b hover:bg-slate-50 transition-colors"
        onClick={onToggle}
      >
        <td className="px-3 py-2 text-xs whitespace-nowrap">
          {formatDate(entry.date)}
        </td>
        <td className="px-3 py-2 text-xs font-medium">{entry.reference}</td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-1.5">
            <Icon className={`h-3.5 w-3.5 ${config.color}`} />
            <span className="text-xs font-medium">{config.label}</span>
          </div>
        </td>
        <td className="px-3 py-2 text-right text-xs font-mono">
          {entry.debit > 0 ? money(entry.debit) : "-"}
        </td>
        <td className="px-3 py-2 text-right text-xs font-mono">
          {entry.credit > 0 ? money(entry.credit) : "-"}
        </td>
        <td className="px-3 py-2 text-right text-xs font-bold">
          {money(entry.balance)}
        </td>
        <td className="px-2 py-2 text-center">
          {isExpanded ? (
            <ChevronUp className="h-3.5 w-3.5 inline-block" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 inline-block" />
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

function ExpandedDetails({ entry }: { entry: LedgerEntry }) {
  const details = entry.details;

  if (entry.type === "SALE") {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs text-muted-foreground">Order No:</span>{" "}
            <span className="text-xs font-medium">{details.orderNo}</span>
          </div>
          <div className="text-xs">
            <span className="text-muted-foreground">Warehouse:</span>{" "}
            {details.warehouse || "-"}
          </div>
        </div>
        <table className="w-full text-xs border-collapse">
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
            {details.items?.map((item: any, idx: number) => (
              <tr key={idx} className="border-t border-slate-100">
                <td className="px-2 py-1.5">{item.productName}</td>
                <td className="px-2 py-1.5 text-right">{item.qty}</td>
                <td className="px-2 py-1.5 text-right">{item.bonusQty}</td>
                <td className="px-2 py-1.5 text-right">{money(item.unitPrice)}</td>
                <td className="px-2 py-1.5 text-right">{money(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-end gap-4 text-xs">
          <span>Subtotal: {money(details.subTotal)}</span>
          <span className="font-semibold">Grand Total: {money(details.grandTotal)}</span>
        </div>
      </div>
    );
  }

  if (entry.type === "PAYMENT") {
    return (
      <div className="space-y-2 text-xs">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-muted-foreground">MR No:</span>{" "}
            <span className="font-medium">{details.mrNo}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Invoice:</span>{" "}
            <span className="font-medium">{details.invoiceNo}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Online Copy:</span>{" "}
            {details.onlineCopyNo || "-"}
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div>Taka: {money(details.taka)}</div>
          <div>Commission: {money(details.commission)}</div>
          <div>Deduction: {money(details.deduction)}</div>
          <div className="font-semibold">Net Payment: {money(details.netPayment)}</div>
        </div>
      </div>
    );
  }

  if (entry.type === "RETURN") {
    return (
      <div className="space-y-3">
        <div>
          <span className="text-xs text-muted-foreground">Return No:</span>{" "}
          <span className="text-xs font-medium">{details.returnNo}</span>
        </div>
        <table className="w-full text-xs border-collapse">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">Product</th>
              <th className="px-2 py-1.5 text-right font-medium">Qty</th>
              <th className="px-2 py-1.5 text-right font-medium">Unit Price</th>
              <th className="px-2 py-1.5 text-right font-medium">Return Amount</th>
            </tr>
          </thead>
          <tbody>
            {details.items?.map((item: any, idx: number) => (
              <tr key={idx} className="border-t border-slate-100">
                <td className="px-2 py-1.5">{item.productName}</td>
                <td className="px-2 py-1.5 text-right">{item.qty}</td>
                <td className="px-2 py-1.5 text-right">{money(item.unitPrice)}</td>
                <td className="px-2 py-1.5 text-right">{money(item.returnAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="text-right text-xs font-semibold">
          Total Return: {money(details.totalReturnAmount)}
        </div>
      </div>
    );
  }

  return null;
}

/* --------------------------- Main Page --------------------------- */
export default function DealerLedgerPage() {
  const [selectedDealer, setSelectedDealer] = useState<DealerOption | null>(null);
  const [ledgerData, setLedgerData] = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(false);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const limit = 30;

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const fetchLedger = useCallback(async () => {
    if (!selectedDealer?.value) return;
    setLoading(true);
    try {
      const res = await api.get(`/dealer-ledger/${selectedDealer.value}/ledger`, {
        params: {
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          type: typeFilter !== "ALL" ? typeFilter : undefined,
          page,
          limit,
        },
      });
      setLedgerData(res.data?.data);
      setExpandedRows(new Set());
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load ledger.");
    } finally {
      setLoading(false);
    }
  }, [selectedDealer, startDate, endDate, typeFilter, page, limit]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  const toggleExpand = (entryId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  };

  // Print helpers
  const buildLedgerPrintHtml = () => {
    if (!ledgerData) return "";
    const { dealer, summary, entries } = ledgerData;
    const rowsHtml = entries
      .map((entry) => {
        const config = typeConfig[entry.type] || typeConfig.SALE;
        return `
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:4px 6px; font-size:10px;">${formatDate(entry.date)}</td>
        <td style="padding:4px 6px; font-size:10px;">${entry.reference}</td>
        <td style="padding:4px 6px; font-size:10px;">${config.label}</td>
        <td style="padding:4px 6px; text-align:right; font-size:10px;">${entry.debit > 0 ? money(entry.debit) : "-"}</td>
        <td style="padding:4px 6px; text-align:right; font-size:10px;">${entry.credit > 0 ? money(entry.credit) : "-"}</td>
        <td style="padding:4px 6px; text-align:right; font-weight:700; font-size:10px;">${money(entry.balance)}</td>
      </tr>`;
      })
      .join("");

    return `
<div style="font-family: 'Inter', sans-serif; max-width: 100%; margin: 0 auto; color: #1e293b; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.04);">
  <div style="background: linear-gradient(135deg, #0f172a, #1e293b); padding: 18px 28px; display: flex; justify-content: space-between; align-items: center; color: white;">
    <div>
      <div style="font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">DEALER LEDGER</div>
      <div style="font-size: 13px; opacity: 0.9; margin-top: 2px;">${dealer.name} (${dealer.phone || "-"})</div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 16px; font-weight: 800;">Opening: ৳ ${money(summary.openingBalance)}</div>
      <div style="font-size: 12px; opacity: 0.8;">Current Due: ৳ ${money(dealer.currentDue)}</div>
    </div>
  </div>
  <div style="padding: 14px 28px; display: flex; gap: 16px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
    <div style="flex:1; background:white; border-radius:10px; padding:10px;">
      <div style="font-size:10px; text-transform:uppercase; color:#64748b;">Total Sales</div>
      <div style="font-weight:700;">৳ ${money(summary.totalSales)}</div>
    </div>
    <div style="flex:1; background:white; border-radius:10px; padding:10px;">
      <div style="font-size:10px; text-transform:uppercase; color:#64748b;">Total Payments</div>
      <div style="font-weight:700;">৳ ${money(summary.totalPayments)}</div>
    </div>
    <div style="flex:1; background:white; border-radius:10px; padding:10px;">
      <div style="font-size:10px; text-transform:uppercase; color:#64748b;">Total Returns</div>
      <div style="font-weight:700;">৳ ${money(summary.totalReturns)}</div>
    </div>
    <div style="flex:1; background:white; border-radius:10px; padding:10px;">
      <div style="font-size:10px; text-transform:uppercase; color:#64748b;">Closing Due</div>
      <div style="font-weight:700;">৳ ${money(summary.closingBalance)}</div>
    </div>
  </div>
  <div style="padding:16px 28px;">
    <table style="width:100%; border-collapse: collapse; font-size:12px;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:6px 8px; text-align:left;">Date</th>
          <th style="padding:6px 8px; text-align:left;">Reference</th>
          <th style="padding:6px 8px; text-align:left;">Type</th>
          <th style="padding:6px 8px; text-align:right;">Debit</th>
          <th style="padding:6px 8px; text-align:right;">Credit</th>
          <th style="padding:6px 8px; text-align:right;">Balance</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </div>
  <div style="background: #0f172a; color: #94a3b8; text-align: center; padding: 8px 28px; font-size: 10px; display: flex; justify-content: space-between;">
    <div>Computer‑generated ledger</div>
    <div>© Antab Agro LTD</div>
  </div>
</div>`;
  };

  const buildLedgerPrintHeaderRight = () => {
    if (!ledgerData) return "";
    const { dealer } = ledgerData;
    return `
    <div style="text-align:right;">
      <div style="font-size: 20px; font-weight: 800; color: #0f172a;">${dealer.name}</div>
      <div style="font-size: 13px; color: #475569; margin-top: 2px;">Ledger Statement</div>
    </div>`;
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
            <div className="flex items-center gap-2">
              {ledgerData && (
                <GlobalPrintButton
                  contentHtml={buildLedgerPrintHtml()}
                  headerRightHtml={buildLedgerPrintHeaderRight()}
                  label="Print Ledger"
                  title="Dealer Ledger"
                  orientation="landscape"
                  company={{
                    name: "Antab Agro LTD",
                    address: "123 Agro Street, Dhaka",
                    phone: "+880 1711-111111",
                    email: "info@antabagro.com",
                  }}
                  showHeader={false}
                  showFooter={false}
                />
              )}
            </div>
          </div>
        </div>

        {/* Filters & Dealer Selection */}
        <Card className="mb-6 border-slate-200 shadow-sm">
          <CardContent className="grid gap-4 p-4 md:grid-cols-5">
            <div className="space-y-2 md:col-span-1">
              <div className="text-sm font-medium">Select Dealer</div>
              <DealerSearchSelect
                value={selectedDealer?.value}
                selectedLabel={selectedDealer?.label}
                onPick={(opt) => {
                  setSelectedDealer(opt);
                  setPage(1);
                }}
              />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Start Date</div>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">End Date</div>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Transaction Type</div>
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPage(1);
                }}
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
                  setPage(1);
                }}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        {ledgerData && (
          <div className="mb-6 grid gap-4 md:grid-cols-5">
            <Card className="border-l-4 border-l-indigo-500 shadow-sm">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Opening Balance</div>
                <div className="mt-1 text-xl font-bold">
                  ৳ {money(ledgerData.summary.openingBalance)}
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-emerald-500 shadow-sm">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Total Sales</div>
                <div className="mt-1 text-xl font-bold">
                  ৳ {money(ledgerData.summary.totalSales)}
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-blue-500 shadow-sm">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Total Payments</div>
                <div className="mt-1 text-xl font-bold">
                  ৳ {money(ledgerData.summary.totalPayments)}
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-orange-500 shadow-sm">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Total Returns</div>
                <div className="mt-1 text-xl font-bold">
                  ৳ {money(ledgerData.summary.totalReturns)}
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-amber-500 shadow-sm">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Closing Due</div>
                <div className="mt-1 text-xl font-bold">
                  ৳ {money(ledgerData.summary.closingBalance)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Limit: ৳ {money(ledgerData.dealer.creditLimit)}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Ledger Table */}
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-100 text-left">
                  <tr>
                    <th className="border-b px-3 py-2.5 font-medium">Date</th>
                    <th className="border-b px-3 py-2.5 font-medium">Reference</th>
                    <th className="border-b px-3 py-2.5 font-medium">Type</th>
                    <th className="border-b px-3 py-2.5 text-right font-medium">Debit</th>
                    <th className="border-b px-3 py-2.5 text-right font-medium">Credit</th>
                    <th className="border-b px-3 py-2.5 text-right font-medium">Balance</th>
                    <th className="border-b px-3 py-2.5 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center">
                        <div className="flex items-center justify-center gap-2 text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading ledger...
                        </div>
                      </td>
                    </tr>
                  ) : ledgerData && ledgerData.entries.length > 0 ? (
                    ledgerData.entries.map((entry) => (
                      <LedgerRow
                        key={entry.id}
                        entry={entry}
                        isExpanded={expandedRows.has(entry.id)}
                        onToggle={() => toggleExpand(entry.id)}
                      />
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
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
        {ledgerData && ledgerData.pagination.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Page {ledgerData.pagination.page} of {ledgerData.pagination.totalPages} ({ledgerData.pagination.total} records)
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setPage((p) => Math.min(ledgerData.pagination.totalPages, p + 1))
                }
                disabled={page >= ledgerData.pagination.totalPages}
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