// app/accounting/trial-balance/page.tsx
"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Download,
  Printer,
  Search,
  Clipboard,
  ChevronRight,
} from "lucide-react";

type AccountType = "Asset" | "Liability" | "Equity" | "Revenue" | "Expense";

type TBRow = {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  opening: number; // signed: positive = DR, negative = CR
  debit: number; // period debit (always >=0)
  credit: number; // period credit (always >=0)
  // Optionally: currency, costCenter, branch...
};

const TYPES: AccountType[] = [
  "Asset",
  "Liability",
  "Equity",
  "Revenue",
  "Expense",
];

// Format money (keeps USD as earlier)
const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(v);

// Return DR/CR columns: positive -> DR, negative -> CR
const openingDR = (v: number) => (v > 0 ? v : 0);
const openingCR = (v: number) => (v < 0 ? -v : 0);
const closingValue = (r: TBRow) => r.opening + r.debit - r.credit;
const closingDR = (v: number) => (v > 0 ? v : 0);
const closingCR = (v: number) => (v < 0 ? -v : 0);

// Small inline sparkline (visual only)
function SparkMini({ r }: { r: TBRow }) {
  const c = closingValue(r);
  const values = [Math.abs(r.opening), r.debit, r.credit, Math.abs(c)];
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-center gap-1 w-28">
      {values.map((val, i) => {
        const w = Math.max(2, Math.round((val / max) * 20));
        const bg =
          i === 0
            ? "bg-emerald-300"
            : i === 1
              ? "bg-emerald-500"
              : i === 2
                ? "bg-rose-400"
                : "bg-emerald-700";
        return (
          <div
            key={i}
            className={`${bg} h-2 rounded`}
            style={{ width: `${w}px` }}
          />
        );
      })}
    </div>
  );
}

// Demo ledger entries for drill-down (keeps your existing demo modal)
const LEDGERS: Record<
  string,
  { date: string; desc: string; debit: number; credit: number }[]
> = {
  a1: [
    { date: "2026-01-01", desc: "Opening balance", debit: 10000, credit: 0 },
    { date: "2026-01-10", desc: "Customer payment", debit: 5000, credit: 0 },
    { date: "2026-01-20", desc: "Bank transfer", debit: 0, credit: 2000 },
  ],
  r1: [
    { date: "2026-01-05", desc: "Invoice #1001", debit: 0, credit: 30000 },
    { date: "2026-01-21", desc: "Invoice #1002", debit: 0, credit: 20000 },
  ],
};

export default function Page() {
  // --- Period selection to match backend API ---
  // Default kept to match your previous demo header (Jan 2026)
  const [periodType] = useState<"monthly" | "yearly">("monthly");
  const [period] = useState<string>("2026-01");

  // API base — allow override with NEXT_PUBLIC_API_URL; otherwise use localhost:5001
  const API_BASE =
    (typeof window !== "undefined" && process.env.NEXT_PUBLIC_API_URL) ||
    "http://localhost:5001";

  // --- Data state (fetched from backend) ---
  const [data, setData] = useState<TBRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [showZero, setShowZero] = useState(false);
  const [openModalId, setOpenModalId] = useState<string | null>(null);

  // Fetch trial balance when page mounts (or when period changes)
  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const url = `${API_BASE}/api/reports/trial-balance?periodType=${encodeURIComponent(
          periodType,
        )}&period=${encodeURIComponent(period)}`;
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) {
          const txt = await res.text();
          // try parse json
          try {
            const j = JSON.parse(txt);
            throw new Error(j?.error || j?.message || res.statusText);
          } catch {
            throw new Error(txt || res.statusText);
          }
        }
        const j = await res.json();
        if (!mounted) return;
        if (j?.success && Array.isArray(j.data)) {
          // backend returns TrialBalanceRow[] matching TBRow shape
          setData(j.data as TBRow[]);
        } else {
          // fallback empty
          setData([]);
          alert("Unexpected response from trial balance API");
        }
      } catch (err: any) {
        console.error("Failed to load trial balance:", err);
        alert(`Failed to load trial balance: ${err?.message || err}`);
        // optionally keep demo fallback? We leave data empty so UI shows none
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [API_BASE, periodType, period]);

  // Derived rows with closing
  const rows = useMemo(
    () => data.map((r) => ({ ...r, closing: closingValue(r) })),
    [data],
  );

  // Filtered with search + zero filter
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (!showZero) {
        if (
          Math.abs(r.opening) < 0.0001 &&
          Math.abs(r.debit) < 0.0001 &&
          Math.abs(r.credit) < 0.0001 &&
          Math.abs(r.closing) < 0.0001
        ) {
          return false;
        }
      }
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.code.includes(q) ||
        r.type.toLowerCase().includes(q)
      );
    });
  }, [rows, query, showZero]);

  // Group by account type for subtotals
  const grouped = useMemo(() => {
    const map = new Map<AccountType, typeof filtered>();
    TYPES.forEach((t) => map.set(t, []));
    filtered.forEach((r) => map.get(r.type)!.push(r));
    return map;
  }, [filtered]);

  // Totals by column as DR/CR (show DR/CR separate)
  const totals = useMemo(() => {
    const openingDr = rows.reduce((s, r) => s + openingDR(r.opening), 0);
    const openingCr = rows.reduce((s, r) => s + openingCR(r.opening), 0);
    const periodDr = rows.reduce((s, r) => s + r.debit, 0);
    const periodCr = rows.reduce((s, r) => s + r.credit, 0);
    const closingVals = rows.map((r) => closingValue(r));
    const closingDr = closingVals.reduce((s, v) => s + (v > 0 ? v : 0), 0);
    const closingCr = closingVals.reduce((s, v) => s + (v < 0 ? -v : 0), 0);
    return { openingDr, openingCr, periodDr, periodCr, closingDr, closingCr };
  }, [rows]);

  // Local helper: get a friendly period label
  function periodLabel() {
    if (periodType === "monthly") {
      const [y, m] = period.split("-").map(Number);
      if (!y || !m) return period;
      const from = new Date(y, m - 1, 1);
      const to = new Date(y, m, 0);
      return `${from.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })} to ${to.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}`;
    }
    // yearly
    return `Year ${period}`;
  }

  // CSV export (flat)
  function exportCsv(all = false) {
    const source = all ? rows : filtered;
    const header = [
      "Code",
      "Account",
      "Type",
      "Opening DR",
      "Opening CR",
      "Period DR",
      "Period CR",
      "Closing DR",
      "Closing CR",
    ];
    const lines = [header.join(",")];
    for (const r of source) {
      const opDR = openingDR(r.opening);
      const opCR = openingCR(r.opening);
      const cl = closingValue(r);
      lines.push(
        [
          r.code,
          `"${r.name}"`,
          r.type,
          opDR.toFixed(2),
          opCR.toFixed(2),
          r.debit.toFixed(2),
          r.credit.toFixed(2),
          cl > 0 ? cl.toFixed(2) : "0.00",
          cl < 0 ? (-cl).toFixed(2) : "0.00",
        ].join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trial-balance-${periodType}-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Copy totals to clipboard
  async function copyTotals() {
    const text = `Totals (${periodLabel()})
Opening DR: ${fmt(totals.openingDr)} | Opening CR: ${fmt(totals.openingCr)}
Period DR: ${fmt(totals.periodDr)} | Period CR: ${fmt(totals.periodCr)}
Closing DR: ${fmt(totals.closingDr)} | Closing CR: ${fmt(totals.closingCr)}
`;
    await navigator.clipboard.writeText(text);
    alert("Totals copied to clipboard");
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-sky-600 via-emerald-500 to-rose-500">
            Trial Balance
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Demo Corp — {periodLabel()}
          </p>
        </div>

        <div className="flex gap-2 items-center">
          <Button
            variant="ghost"
            onClick={() => copyTotals()}
            title="Copy totals"
          >
            <Clipboard className="mr-2 h-4 w-4" />
            Copy Totals
          </Button>
          <Button onClick={() => exportCsv(false)} title="Export shown rows">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>
      </header>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase text-slate-400">
              Opening (DR / CR)
            </div>
            <div className="mt-2 text-lg font-semibold flex items-baseline gap-3">
              <span className="text-emerald-600">
                {loading ? "Loading..." : fmt(totals.openingDr)}
              </span>
              <span className="text-slate-400">/</span>
              <span className="text-rose-600">
                {loading ? "Loading..." : fmt(totals.openingCr)}
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Opening balances across selected period
            </div>
          </div>
          <div className="text-xs text-slate-400">
            <div className="text-right">Accounts</div>
            <div className="mt-2 font-semibold text-slate-700">
              {loading ? "..." : rows.length}
            </div>
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase text-slate-400">
              Period Movement
            </div>
            <div className="mt-2 text-lg font-semibold">
              <span className="text-emerald-600 mr-3">
                {loading ? "Loading..." : fmt(totals.periodDr)}
              </span>
              <span className="text-rose-600">
                {loading ? "Loading..." : fmt(totals.periodCr)}
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Total Debits vs Credits posted
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Balance diff</div>
            <div
              className={`mt-2 font-semibold ${
                totals.periodDr - totals.periodCr === 0
                  ? "text-emerald-600"
                  : "text-rose-600"
              }`}
            >
              {loading ? "..." : fmt(totals.periodDr - totals.periodCr)}
            </div>
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase text-slate-400">
              Closing (DR / CR)
            </div>
            <div className="mt-2 text-lg font-semibold">
              <span className="text-emerald-600 mr-3">
                {loading ? "Loading..." : fmt(totals.closingDr)}
              </span>
              <span className="text-rose-600">
                {loading ? "Loading..." : fmt(totals.closingCr)}
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Post-period closing balances
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">Status</div>
            <div
              className={`mt-2 font-semibold ${
                totals.closingDr === totals.closingCr
                  ? "text-emerald-600"
                  : "text-rose-600"
              }`}
            >
              {loading
                ? "Loading..."
                : totals.closingDr === totals.closingCr
                  ? "Balanced"
                  : "Mismatch"}
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3 w-full md:w-1/2">
            <div className="relative flex-1">
              <Input
                placeholder="Search account name, code or type..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="zero"
                checked={showZero}
                onCheckedChange={(v) => setShowZero(Boolean(v))}
              />
              <Label htmlFor="zero">Show zero balances</Label>
            </div>
          </div>

          <div className="flex gap-2 items-center">
            <Button variant="ghost" onClick={() => setQuery("")}>
              Clear
            </Button>
            <Button variant="secondary" onClick={() => exportCsv(true)}>
              Export All
            </Button>
          </div>
        </div>
      </Card>

      {/* Big table */}
      <Card className="overflow-x-auto print:overflow-visible">
        <table className="w-full border-collapse table-auto">
          <thead className="sticky top-0 z-10 backdrop-blur bg-white/60 print:bg-white">
            <tr className="text-sm text-slate-500">
              <th rowSpan={2} className="px-4 py-3 text-left">
                Code
              </th>
              <th rowSpan={2} className="px-4 py-3 text-left">
                Account
              </th>
              <th
                rowSpan={2}
                className="px-4 py-3 text-left hidden md:table-cell"
              >
                Type
              </th>

              <th colSpan={2} className="px-4 py-2 text-center border-l">
                Opening
              </th>
              <th colSpan={2} className="px-4 py-2 text-center border-l">
                Period
              </th>
              <th colSpan={2} className="px-4 py-2 text-center border-l">
                Closing
              </th>

              <th
                rowSpan={2}
                className="px-4 py-3 text-right hidden md:table-cell"
              >
                Trend
              </th>
              <th rowSpan={2} className="px-4 py-3 text-right">
                Actions
              </th>
            </tr>
            <tr className="text-xs text-slate-400">
              <th className="px-4 py-1 text-right text-emerald-600">DR</th>
              <th className="px-4 py-1 text-right text-rose-600">CR</th>

              <th className="px-4 py-1 text-right text-emerald-600">DR</th>
              <th className="px-4 py-1 text-right text-rose-600">CR</th>

              <th className="px-4 py-1 text-right text-emerald-600">DR</th>
              <th className="px-4 py-1 text-right text-rose-600">CR</th>
            </tr>
          </thead>

          <tbody>
            {Array.from(grouped.entries()).map(([type, accounts]) => {
              if (!accounts.length) return null;
              // subtotal per type
              const sOpeningDr = accounts.reduce(
                (s, r) => s + openingDR(r.opening),
                0,
              );
              const sOpeningCr = accounts.reduce(
                (s, r) => s + openingCR(r.opening),
                0,
              );
              const sPeriodDr = accounts.reduce((s, r) => s + r.debit, 0);
              const sPeriodCr = accounts.reduce((s, r) => s + r.credit, 0);
              const sClosingArr = accounts.map((r) => closingValue(r));
              const sClosingDr = sClosingArr.reduce(
                (s, v) => s + (v > 0 ? v : 0),
                0,
              );
              const sClosingCr = sClosingArr.reduce(
                (s, v) => s + (v < 0 ? -v : 0),
                0,
              );

              return (
                <React.Fragment key={type}>
                  <tr className="bg-slate-50">
                    <td
                      colSpan={11}
                      className="px-4 py-2 font-semibold text-slate-700"
                    >
                      {type}
                    </td>
                  </tr>

                  {accounts.map((r) => {
                    const cl = closingValue(r);
                    return (
                      <tr
                        key={r.id}
                        className="hover:bg-slate-50 even:bg-white"
                      >
                        <td className="px-4 py-3 text-sm">{r.code}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{r.name}</div>
                          <div className="text-xs text-slate-400">#{r.id}</div>
                        </td>
                        <td className="px-4 py-3 text-sm hidden md:table-cell">
                          {r.type}
                        </td>

                        <td className="px-4 py-3 text-right text-emerald-600">
                          {r.opening > 0 ? fmt(r.opening) : "-"}
                        </td>
                        <td className="px-4 py-3 text-right text-rose-600">
                          {r.opening < 0 ? fmt(-r.opening) : "-"}
                        </td>

                        <td className="px-4 py-3 text-right text-emerald-600">
                          {r.debit ? fmt(r.debit) : "-"}
                        </td>
                        <td className="px-4 py-3 text-right text-rose-600">
                          {r.credit ? fmt(r.credit) : "-"}
                        </td>

                        <td
                          className={`px-4 py-3 text-right ${
                            cl > 0
                              ? "text-emerald-700"
                              : cl < 0
                                ? "text-rose-700"
                                : "text-slate-500"
                          }`}
                        >
                          {cl > 0 ? fmt(cl) : "-"}
                        </td>
                        <td
                          className={`px-4 py-3 text-right ${
                            cl < 0
                              ? "text-rose-700"
                              : cl > 0
                                ? "text-emerald-700"
                                : "text-slate-500"
                          }`}
                        >
                          {cl < 0 ? fmt(-cl) : "-"}
                        </td>

                        <td className="px-4 py-3 hidden md:table-cell">
                          <SparkMini r={r} />
                        </td>

                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Dialog
                              open={openModalId === r.id}
                              onOpenChange={(open) =>
                                setOpenModalId(open ? r.id : null)
                              }
                            >
                              <DialogTrigger asChild>
                                <button className="text-sm text-sky-600 hover:underline flex items-center gap-1">
                                  View <ChevronRight className="h-4 w-4" />
                                </button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>
                                    Ledger — {r.name} ({r.code})
                                  </DialogTitle>
                                  <DialogDescription>
                                    Demo ledger for drill-down. Replace with
                                    your API call to fetch ledger entries.
                                  </DialogDescription>
                                </DialogHeader>

                                {LEDGERS[r.id] ? (
                                  <table className="w-full mt-4">
                                    <thead className="text-xs text-slate-500">
                                      <tr>
                                        <th className="text-left">Date</th>
                                        <th className="text-left">
                                          Description
                                        </th>
                                        <th className="text-right">Debit</th>
                                        <th className="text-right">Credit</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {LEDGERS[r.id].map((t, i) => (
                                        <tr key={i} className="border-t">
                                          <td className="py-2 text-sm">
                                            {t.date}
                                          </td>
                                          <td className="py-2 text-sm">
                                            {t.desc}
                                          </td>
                                          <td className="py-2 text-sm text-right">
                                            {t.debit ? fmt(t.debit) : "-"}
                                          </td>
                                          <td className="py-2 text-sm text-right">
                                            {t.credit ? fmt(t.credit) : "-"}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                ) : (
                                  <p className="mt-4 text-sm text-slate-500">
                                    No ledger demo entries for this account.
                                  </p>
                                )}
                                <div className="mt-6 flex justify-end">
                                  <Button onClick={() => setOpenModalId(null)}>
                                    Close
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {/* Subtotal row */}
                  <tr className="bg-slate-100 border-t">
                    <td colSpan={3} className="px-4 py-3 font-semibold">
                      Subtotal {type}
                    </td>

                    <td className="px-4 py-3 text-right text-emerald-600 font-semibold">
                      {sOpeningDr ? fmt(sOpeningDr) : "-"}
                    </td>
                    <td className="px-4 py-3 text-right text-rose-600 font-semibold">
                      {sOpeningCr ? fmt(sOpeningCr) : "-"}
                    </td>

                    <td className="px-4 py-3 text-right text-emerald-600 font-semibold">
                      {sPeriodDr ? fmt(sPeriodDr) : "-"}
                    </td>
                    <td className="px-4 py-3 text-right text-rose-600 font-semibold">
                      {sPeriodCr ? fmt(sPeriodCr) : "-"}
                    </td>

                    <td className="px-4 py-3 text-right text-emerald-700 font-semibold">
                      {sClosingDr ? fmt(sClosingDr) : "-"}
                    </td>
                    <td className="px-4 py-3 text-right text-rose-700 font-semibold">
                      {sClosingCr ? fmt(sClosingCr) : "-"}
                    </td>

                    <td colSpan={2} />
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>

          <tfoot>
            <tr className="bg-gradient-to-r from-slate-50 to-white border-t-2 font-semibold">
              <td colSpan={3} className="px-4 py-3">
                Grand Total
              </td>

              <td className="px-4 py-3 text-right text-emerald-700">
                {fmt(totals.openingDr)}
              </td>
              <td className="px-4 py-3 text-right text-rose-700">
                {fmt(totals.openingCr)}
              </td>

              <td className="px-4 py-3 text-right text-emerald-700">
                {fmt(totals.periodDr)}
              </td>
              <td className="px-4 py-3 text-right text-rose-700">
                {fmt(totals.periodCr)}
              </td>

              <td className="px-4 py-3 text-right text-emerald-700">
                {fmt(totals.closingDr)}
              </td>
              <td className="px-4 py-3 text-right text-rose-700">
                {fmt(totals.closingCr)}
              </td>

              <td colSpan={2} />
            </tr>
            <tr className="text-xs text-slate-500">
              <td colSpan={11} className="px-4 py-2">
                Sanity check: Opening + Period Debit - Period Credit = Closing
                (All shown as DR/CR). &nbsp;If totals mismatch, highlight shows
                above.
              </td>
            </tr>
          </tfoot>
        </table>
      </Card>

      {/* Print-friendly footer / developer notes (hidden on print) */}
      <Card className="p-4 print:hidden">
        <div className="text-sm text-slate-500">
          <strong>Developer notes:</strong> This page now fetches data from
          <code>
            {" "}
            /api/reports/trial-balance?periodType=monthly&period=YYYY-MM
          </code>
          . Backend should return signed opening balances (positive = DR,
          negative = CR), and non-negative period debit/credit numbers. The page
          computes closing = opening + debit - credit and splits amounts into
          DR/CR presentation for clarity.
        </div>
      </Card>

      {/* Minimal print styles */}
      <style jsx>{`
        @media print {
          :root {
            color-scheme: light;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:overflow-visible {
            overflow: visible !important;
          }
        }
      `}</style>
    </div>
  );
}
