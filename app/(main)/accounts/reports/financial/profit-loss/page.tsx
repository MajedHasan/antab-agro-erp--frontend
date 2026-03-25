// app/reports/financial/statement-of-profit-loss/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Printer, ArrowUp, ArrowDown } from "lucide-react";
import api from "@/lib/api";

/* ---------------- Demo monthly source data (per month) ----------------
   Keys: "YYYY-MM"
   Kept as fallback/demo when API has no data.
*/
type AccountEntry = { name: string; amount: number };

const MONTHLY: Record<
  string,
  {
    revenue: AccountEntry[];
    costOfSales: AccountEntry[];
    selling: AccountEntry[];
    admin: AccountEntry[];
    nonOperating: AccountEntry[];
    financeCost: AccountEntry[];
    tax: AccountEntry[];
  }
> = {
  "2025-12": {
    revenue: [
      { name: "Sales Revenue", amount: 1_200_000 },
      { name: "Service Revenue", amount: 150_000 },
    ],
    costOfSales: [
      { name: "Direct Materials", amount: 450_000 },
      { name: "Direct Labor", amount: 150_000 },
    ],
    selling: [
      { name: "Marketing Expenses", amount: 60_000 },
      { name: "Logistics Expenses", amount: 30_000 },
    ],
    admin: [
      { name: "Salaries", amount: 120_000 },
      { name: "Office Rent", amount: 20_000 },
    ],
    nonOperating: [{ name: "Interest Income", amount: 5_000 }],
    financeCost: [{ name: "Bank Interest", amount: 12_000 }],
    tax: [{ name: "Income Tax", amount: 80_000 }],
  },
  "2026-01": {
    revenue: [
      { name: "Sales Revenue", amount: 250_000 },
      { name: "Service Revenue", amount: 50_000 },
    ],
    costOfSales: [
      { name: "Direct Materials", amount: 80_000 },
      { name: "Direct Labor", amount: 40_000 },
    ],
    selling: [
      { name: "Marketing Expenses", amount: 15_000 },
      { name: "Logistics Expenses", amount: 10_000 },
    ],
    admin: [
      { name: "Salaries", amount: 20_000 },
      { name: "Office Rent", amount: 5_000 },
    ],
    nonOperating: [
      { name: "Interest Income", amount: 2_000 },
      { name: "Misc Income", amount: 1_000 },
    ],
    financeCost: [{ name: "Bank Interest", amount: 3_000 }],
    tax: [{ name: "Income Tax", amount: 15_000 }],
  },
  "2026-02": {
    revenue: [
      { name: "Sales Revenue", amount: 180_000 },
      { name: "Service Revenue", amount: 40_000 },
    ],
    costOfSales: [
      { name: "Direct Materials", amount: 60_000 },
      { name: "Direct Labor", amount: 35_000 },
    ],
    selling: [
      { name: "Marketing Expenses", amount: 12_000 },
      { name: "Logistics Expenses", amount: 8_000 },
    ],
    admin: [
      { name: "Salaries", amount: 18_000 },
      { name: "Office Rent", amount: 5_000 },
    ],
    nonOperating: [
      { name: "Interest Income", amount: 1_000 },
      { name: "Misc Income", amount: 500 },
    ],
    financeCost: [{ name: "Bank Interest", amount: 2_000 }],
    tax: [{ name: "Income Tax", amount: 12_000 }],
  },
};

/* ---------------- Utilities ---------------- */

const currency = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);

function pctChange(current: number, previous: number) {
  if (previous === 0) {
    if (current === 0) return 0;
    return current > 0 ? 100 : -100;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

function safeSum(arr?: AccountEntry[] | null) {
  if (!arr) return 0;
  return arr.reduce((s, a) => s + (a.amount || 0), 0);
}

/* ---------------- Component ---------------- */

export default function StatementOfProfitLossPage() {
  // UI state
  const [periodType, setPeriodType] = useState<"monthly" | "yearly">("monthly");

  const availableMonths = Object.keys(MONTHLY).sort((a, b) =>
    b.localeCompare(a),
  ); // newest first
  const availableYears = Array.from(
    new Set(availableMonths.map((m) => m.slice(0, 4))),
  ).sort((a, b) => b.localeCompare(a));
  const [period, setPeriod] = useState<string>(availableMonths[0] ?? "");
  const [compareEnabled, setCompareEnabled] = useState<boolean>(false);
  const [comparePeriod, setComparePeriod] = useState<string>("none"); // "none" means no compare

  // backend-backed state
  const [data, setData] = useState<{
    revenue: AccountEntry[];
    costOfSales: AccountEntry[];
    selling: AccountEntry[];
    admin: AccountEntry[];
    nonOperating: AccountEntry[];
    financeCost: AccountEntry[];
    tax: AccountEntry[];
  } | null>(() => MONTHLY[availableMonths[0]] ?? null);
  const [compareData, setCompareData] = useState<typeof data | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load from backend whenever selection changes
  useEffect(() => {
    async function load() {
      if (!period) {
        setData(null);
        setCompareData(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Build query string
        const q = new URLSearchParams();
        q.set("periodType", periodType);
        q.set("period", period);
        if (compareEnabled && comparePeriod && comparePeriod !== "none") {
          q.set("comparePeriod", comparePeriod);
        }

        // Call backend via api helper (axios-like)
        // If your api.get supports params object, you can switch to that signature;
        // using query string keeps it robust.
        const res = await api.get(
          `/reports/profit-loss/statement-of-profit-loss?${q.toString()}`,
        );

        // Normalize different response shapes:
        // - axios-like: res.data or res.data.data
        // - fetch-like: res (unlikely with api.get, but be safe)
        const payload =
          (res && (res.data?.data ?? res.data ?? (res as any))) ?? null;

        // backend expected to return { current, compare } OR directly the current object
        const backendCurrent =
          payload?.current ?? payload?.data ?? payload ?? null;
        const backendCompare = payload?.compare ?? null;

        // Helper to map backend object to our internal shape.
        // Accepts either category arrays or an object with named sums/lines.
        function normalizePL(obj: any) {
          if (!obj) return null;
          // If object already has the arrays we need, return them (safely)
          const withArrays = {
            revenue: Array.isArray(obj.revenue) ? obj.revenue : [],
            costOfSales: Array.isArray(obj.costOfSales) ? obj.costOfSales : [],
            selling: Array.isArray(obj.selling) ? obj.selling : [],
            admin: Array.isArray(obj.admin) ? obj.admin : [],
            nonOperating: Array.isArray(obj.nonOperating)
              ? obj.nonOperating
              : [],
            financeCost: Array.isArray(obj.financeCost) ? obj.financeCost : [],
            tax: Array.isArray(obj.tax) ? obj.tax : [],
          };

          // If backend returned totals only (numbers) try to fabricate arrays with totals
          // (we keep zero-length arrays where no line detail exists)
          // Example supported keys: totalRevenue, totalCost, totalSelling, totalAdmin, etc.
          if (
            withArrays.revenue.length === 0 &&
            typeof obj.totalRevenue === "number"
          ) {
            withArrays.revenue = [
              { name: "Total Revenue", amount: obj.totalRevenue },
            ];
          }
          if (
            withArrays.costOfSales.length === 0 &&
            typeof obj.totalCost === "number"
          ) {
            withArrays.costOfSales = [
              { name: "Total Cost of Sales", amount: obj.totalCost },
            ];
          }
          if (
            withArrays.selling.length === 0 &&
            typeof obj.totalSelling === "number"
          ) {
            withArrays.selling = [
              { name: "Selling & Distribution", amount: obj.totalSelling },
            ];
          }
          if (
            withArrays.admin.length === 0 &&
            typeof obj.totalAdmin === "number"
          ) {
            withArrays.admin = [
              { name: "Administrative", amount: obj.totalAdmin },
            ];
          }
          if (
            withArrays.nonOperating.length === 0 &&
            typeof obj.totalNonOp === "number"
          ) {
            withArrays.nonOperating = [
              { name: "Non-operating", amount: obj.totalNonOp },
            ];
          }
          if (
            withArrays.financeCost.length === 0 &&
            typeof obj.totalFinance === "number"
          ) {
            withArrays.financeCost = [
              { name: "Finance Cost", amount: obj.totalFinance },
            ];
          }
          if (withArrays.tax.length === 0 && typeof obj.totalTax === "number") {
            withArrays.tax = [{ name: "Tax", amount: obj.totalTax }];
          }

          return withArrays;
        }

        const normCurrent = normalizePL(backendCurrent) ?? null;
        const normCompare = normalizePL(backendCompare) ?? null;

        // If backend provided something useful, use it; else fallback to demo
        if (normCurrent) {
          setData(normCurrent);
        } else {
          // fallback demo for the chosen period (if monthly/yearly available)
          if (periodType === "monthly" && MONTHLY[period]) {
            setData(MONTHLY[period]);
          } else if (periodType === "yearly") {
            // aggregate months for that year from MONTHLY demo
            const months = Object.keys(MONTHLY).filter((m) =>
              m.startsWith(period + "-"),
            );
            if (months.length) {
              // aggregate similar to earlier helper
              const agg: any = {
                revenue: [],
                costOfSales: [],
                selling: [],
                admin: [],
                nonOperating: [],
                financeCost: [],
                tax: [],
              };
              function merge(target: AccountEntry[], src: AccountEntry[]) {
                for (const s of src) {
                  const ex = target.find((t) => t.name === s.name);
                  if (ex) ex.amount += s.amount;
                  else target.push({ ...s });
                }
              }
              for (const m of months) {
                const src = MONTHLY[m];
                merge(agg.revenue, src.revenue);
                merge(agg.costOfSales, src.costOfSales);
                merge(agg.selling, src.selling);
                merge(agg.admin, src.admin);
                merge(agg.nonOperating, src.nonOperating);
                merge(agg.financeCost, src.financeCost);
                merge(agg.tax, src.tax);
              }
              setData(agg);
            } else {
              setData(null);
            }
          } else {
            setData(null);
          }
        }

        if (compareEnabled && comparePeriod && comparePeriod !== "none") {
          if (normCompare) {
            setCompareData(normCompare);
          } else {
            // fallback to demo compare (same logic)
            if (periodType === "monthly" && MONTHLY[comparePeriod]) {
              setCompareData(MONTHLY[comparePeriod]);
            } else {
              setCompareData(null);
            }
          }
        } else {
          setCompareData(null);
        }
      } catch (err: any) {
        console.error("Failed to load P&L:", err);
        setError(
          err?.response?.data?.message ||
            err?.message ||
            "Failed to load report from server",
        );
        // fallback to demo
        if (periodType === "monthly" && MONTHLY[period]) {
          setData(MONTHLY[period]);
        } else {
          setData(null);
        }
        setCompareData(null);
      } finally {
        setLoading(false);
      }
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodType, period, compareEnabled, comparePeriod]);

  // compute totals for given dataset
  function computeTotals(
    d: {
      revenue: AccountEntry[];
      costOfSales: AccountEntry[];
      selling: AccountEntry[];
      admin: AccountEntry[];
      nonOperating: AccountEntry[];
      financeCost: AccountEntry[];
      tax: AccountEntry[];
    } | null,
  ) {
    if (!d) return null;
    const totalRevenue = safeSum(d.revenue);
    const totalCost = safeSum(d.costOfSales);
    const grossProfit = totalRevenue - totalCost;
    const totalSelling = safeSum(d.selling);
    const totalAdmin = safeSum(d.admin);
    const profitOps = grossProfit - totalSelling - totalAdmin;
    const totalNonOp = safeSum(d.nonOperating);
    const totalFinance = safeSum(d.financeCost);
    const profitBeforeTax = profitOps + totalNonOp - totalFinance;
    const totalTax = safeSum(d.tax);
    const netProfit = profitBeforeTax - totalTax;
    return {
      totalRevenue,
      totalCost,
      grossProfit,
      totalSelling,
      totalAdmin,
      profitOps,
      totalNonOp,
      totalFinance,
      profitBeforeTax,
      totalTax,
      netProfit,
    };
  }

  const totals = useMemo(() => computeTotals(data), [data]);
  const cTotals = useMemo(() => computeTotals(compareData), [compareData]);

  /* ---------- Export CSV (with comparison & delta) ---------- */
  function exportCsv() {
    if (!data || !totals) return;
    const header = [
      "Particulars",
      "Current",
      compareEnabled && compareData ? `Compare (${comparePeriod})` : "Compare",
      "Delta",
      "%",
    ];
    const rows: string[][] = [header];
    function pushLines(
      title: string,
      entries: AccountEntry[],
      cEntries?: AccountEntry[],
      entryTotal?: number,
      cTotal?: number,
    ) {
      rows.push([title, "", cTotal != null ? "" : "", "", ""]);
      entries.forEach((e) => {
        const cVal = cEntries?.find((x) => x.name === e.name)?.amount ?? 0;
        const delta = e.amount - cVal;
        const pct =
          cVal === 0
            ? e.amount === 0
              ? 0
              : 100
            : (delta / Math.abs(cVal)) * 100;
        rows.push([
          `  ${e.name}`,
          e.amount.toFixed(2),
          cVal ? cVal.toFixed(2) : "",
          delta.toFixed(2),
          pct.toFixed(2) + "%",
        ]);
      });
      rows.push([
        `Total ${title}`,
        (entryTotal ?? 0).toFixed(2),
        (cTotal ?? 0).toFixed(2),
        ((entryTotal ?? 0) - (cTotal ?? 0)).toFixed(2),
        pctChange(entryTotal ?? 0, cTotal ?? 0).toFixed(2) + "%",
      ]);
    }

    pushLines(
      "Revenue",
      data!.revenue,
      compareData?.revenue,
      totals.totalRevenue,
      cTotals?.totalRevenue,
    );
    pushLines(
      "Cost of Sales",
      data!.costOfSales,
      compareData?.costOfSales,
      totals.totalCost,
      cTotals?.totalCost,
    );
    rows.push([
      "Gross Profit",
      totals.grossProfit.toFixed(2),
      (cTotals?.grossProfit ?? 0).toFixed(2),
      (totals.grossProfit - (cTotals?.grossProfit ?? 0)).toFixed(2),
      pctChange(totals.grossProfit, cTotals?.grossProfit ?? 0).toFixed(2) + "%",
    ]);
    pushLines(
      "Selling & Distribution Expenses",
      data!.selling,
      compareData?.selling,
      totals.totalSelling,
      cTotals?.totalSelling,
    );
    pushLines(
      "Administrative Expenses",
      data!.admin,
      compareData?.admin,
      totals.totalAdmin,
      cTotals?.totalAdmin,
    );
    rows.push([
      "Profit from Operations",
      totals.profitOps.toFixed(2),
      (cTotals?.profitOps ?? 0).toFixed(2),
      (totals.profitOps - (cTotals?.profitOps ?? 0)).toFixed(2),
      pctChange(totals.profitOps, cTotals?.profitOps ?? 0).toFixed(2) + "%",
    ]);
    pushLines(
      "Non-operating Income",
      data!.nonOperating,
      compareData?.nonOperating,
      totals.totalNonOp,
      cTotals?.totalNonOp,
    );
    pushLines(
      "Finance Cost",
      data!.financeCost,
      compareData?.financeCost,
      totals.totalFinance,
      cTotals?.totalFinance,
    );
    rows.push([
      "Profit Before Tax",
      totals.profitBeforeTax.toFixed(2),
      (cTotals?.profitBeforeTax ?? 0).toFixed(2),
      (totals.profitBeforeTax - (cTotals?.profitBeforeTax ?? 0)).toFixed(2),
      pctChange(totals.profitBeforeTax, cTotals?.profitBeforeTax ?? 0).toFixed(
        2,
      ) + "%",
    ]);
    pushLines(
      "Tax Expense",
      data!.tax,
      compareData?.tax,
      totals.totalTax,
      cTotals?.totalTax,
    );
    rows.push([
      "Net Profit / (Loss) After Tax",
      totals.netProfit.toFixed(2),
      (cTotals?.netProfit ?? 0).toFixed(2),
      (totals.netProfit - (cTotals?.netProfit ?? 0)).toFixed(2),
      pctChange(totals.netProfit, cTotals?.netProfit ?? 0).toFixed(2) + "%",
    ]);

    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `profit_loss_${
      periodType === "monthly" ? period : period
    }_report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printReport() {
    alert(
      "Demo: use Export CSV for data, or implement HTML print view similarly.",
    );
  }

  /* ---------- UI helpers ---------- */
  const showCompare = compareEnabled && comparePeriod !== "none" && !!cTotals;

  const deltaCell = (cur: number, cmp: number | undefined) => {
    const cmpVal = cmp ?? 0;
    const d = cur - cmpVal;
    const p = pctChange(cur, cmpVal);
    return (
      <div className="flex items-center justify-end gap-3">
        <div
          className={`text-sm ${
            d > 0
              ? "text-emerald-600"
              : d < 0
                ? "text-rose-600"
                : "text-slate-700"
          }`}
        >
          {currency(d)}
        </div>
        <div
          className={`text-xs font-medium ${
            p > 0
              ? "text-emerald-600"
              : p < 0
                ? "text-rose-600"
                : "text-slate-500"
          }`}
        >
          {p === Infinity || p === -Infinity ? "—" : p.toFixed(1) + "%"}
        </div>
        <div aria-hidden>
          {d > 0 ? (
            <ArrowUp className="text-emerald-600" />
          ) : d < 0 ? (
            <ArrowDown className="text-rose-600" />
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            Statement of Profit or Loss
          </h1>
          <p className="text-sm text-slate-500">
            Step-down format (Revenue → Net Profit). Demo data — replaced by
            backend when available.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="secondary" onClick={printReport}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </header>

      {/* Controls */}
      <Card className="p-4 flex flex-col md:flex-row gap-4 items-end">
        <div>
          <div className="text-xs text-slate-500">Period Type</div>
          <div className="mt-1 flex gap-2">
            <button
              onClick={() => {
                setPeriodType("monthly");
                setPeriod(availableMonths[0] ?? "");
              }}
              className={`px-3 py-1 rounded ${
                periodType === "monthly"
                  ? "bg-slate-800 text-white"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => {
                setPeriodType("yearly");
                setPeriod(availableYears[0] ?? "");
              }}
              className={`px-3 py-1 rounded ${
                periodType === "yearly"
                  ? "bg-slate-800 text-white"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              Yearly
            </button>
          </div>
        </div>

        <div>
          <div className="text-xs text-slate-500">Period</div>
          {periodType === "monthly" ? (
            <Select value={period} onValueChange={(v) => setPeriod(v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {availableMonths.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Select value={period} onValueChange={(v) => setPeriod(v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex items-center gap-3">
          <input
            id="compare"
            type="checkbox"
            checked={compareEnabled}
            onChange={(e) => {
              setCompareEnabled(e.target.checked);
              if (!e.target.checked) setComparePeriod("none");
            }}
          />
          <label htmlFor="compare" className="text-sm select-none">
            Enable comparison
          </label>
        </div>

        {compareEnabled && (
          <div>
            <div className="text-xs text-slate-500">Compare to</div>
            {periodType === "monthly" ? (
              <Select
                value={comparePeriod}
                onValueChange={(v) => setComparePeriod(v)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select compare month" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {availableMonths.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select
                value={comparePeriod}
                onValueChange={(v) => setComparePeriod(v)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select compare year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {availableYears.map((y) => (
                    <SelectItem key={y} value={y}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}
      </Card>

      {/* Report */}
      <Card className="p-4 overflow-x-auto">
        {loading ? (
          <div className="text-slate-500">Loading...</div>
        ) : error ? (
          <div className="text-rose-600">Error: {error}</div>
        ) : !data || !totals ? (
          <div className="text-slate-500">No data for selected period.</div>
        ) : (
          <table className="w-full text-sm table-auto border-collapse">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="pb-2">Particulars</th>
                <th className="pb-2 text-right w-40">Current</th>
                {showCompare && (
                  <th className="pb-2 text-right w-40">Compare</th>
                )}
                {showCompare && <th className="pb-2 text-right w-56">Δ / %</th>}
              </tr>
            </thead>

            <tbody>
              {/* Revenue */}
              <tr className="font-semibold text-slate-700">
                <td>Revenue</td>
                <td className="text-right">{currency(totals.totalRevenue)}</td>
                {showCompare && (
                  <td className="text-right">
                    {currency(cTotals?.totalRevenue ?? 0)}
                  </td>
                )}
                {showCompare && (
                  <td>
                    {deltaCell(totals.totalRevenue, cTotals?.totalRevenue)}
                  </td>
                )}
              </tr>
              {data.revenue.map((r) => (
                <tr key={r.name} className="hover:bg-slate-50">
                  <td className="pl-4">{r.name}</td>
                  <td className="text-right">{currency(r.amount)}</td>
                  {showCompare && (
                    <td className="text-right">
                      {currency(
                        compareData?.revenue.find((x) => x.name === r.name)
                          ?.amount ?? 0,
                      )}
                    </td>
                  )}
                  {showCompare && (
                    <td>
                      {deltaCell(
                        r.amount,
                        compareData?.revenue.find((x) => x.name === r.name)
                          ?.amount,
                      )}
                    </td>
                  )}
                </tr>
              ))}
              <tr className="font-bold bg-slate-100">
                <td>Total Revenue</td>
                <td className="text-right">{currency(totals.totalRevenue)}</td>
                {showCompare && (
                  <td className="text-right">
                    {currency(cTotals?.totalRevenue ?? 0)}
                  </td>
                )}
                {showCompare && (
                  <td>
                    {deltaCell(totals.totalRevenue, cTotals?.totalRevenue)}
                  </td>
                )}
              </tr>

              {/* Cost of Sales */}
              <tr className="font-semibold text-slate-700 mt-4">
                <td className="pt-4">Less: Cost of Sales</td>
                <td></td>
                {showCompare && <td></td>}
                {showCompare && <td></td>}
              </tr>
              {data.costOfSales.map((c) => (
                <tr key={c.name} className="hover:bg-slate-50">
                  <td className="pl-4">{c.name}</td>
                  <td className="text-right">{currency(c.amount)}</td>
                  {showCompare && (
                    <td className="text-right">
                      {currency(
                        compareData?.costOfSales.find((x) => x.name === c.name)
                          ?.amount ?? 0,
                      )}
                    </td>
                  )}
                  {showCompare && (
                    <td>
                      {deltaCell(
                        c.amount,
                        compareData?.costOfSales.find((x) => x.name === c.name)
                          ?.amount,
                      )}
                    </td>
                  )}
                </tr>
              ))}
              <tr className="font-bold bg-slate-100">
                <td>Total Cost of Sales</td>
                <td className="text-right">{currency(totals.totalCost)}</td>
                {showCompare && (
                  <td className="text-right">
                    {currency(cTotals?.totalCost ?? 0)}
                  </td>
                )}
                {showCompare && (
                  <td>{deltaCell(totals.totalCost, cTotals?.totalCost)}</td>
                )}
              </tr>

              {/* Gross Profit */}
              <tr className="font-bold bg-emerald-50">
                <td>Gross Profit</td>
                <td className="text-right">{currency(totals.grossProfit)}</td>
                {showCompare && (
                  <td className="text-right">
                    {currency(cTotals?.grossProfit ?? 0)}
                  </td>
                )}
                {showCompare && (
                  <td>{deltaCell(totals.grossProfit, cTotals?.grossProfit)}</td>
                )}
              </tr>

              {/* Selling & Admin */}
              {data.selling.map((s) => (
                <tr key={s.name} className="hover:bg-slate-50">
                  <td className="pl-4">{s.name}</td>
                  <td className="text-right">{currency(s.amount)}</td>
                  {showCompare && (
                    <td className="text-right">
                      {currency(
                        compareData?.selling.find((x) => x.name === s.name)
                          ?.amount ?? 0,
                      )}
                    </td>
                  )}
                  {showCompare && (
                    <td>
                      {deltaCell(
                        s.amount,
                        compareData?.selling.find((x) => x.name === s.name)
                          ?.amount,
                      )}
                    </td>
                  )}
                </tr>
              ))}
              <tr className="font-bold bg-slate-100">
                <td>Total Selling & Distribution Expenses</td>
                <td className="text-right">{currency(totals.totalSelling)}</td>
                {showCompare && (
                  <td className="text-right">
                    {currency(cTotals?.totalSelling ?? 0)}
                  </td>
                )}
                {showCompare && (
                  <td>
                    {deltaCell(totals.totalSelling, cTotals?.totalSelling)}
                  </td>
                )}
              </tr>

              {data.admin.map((a) => (
                <tr key={a.name} className="hover:bg-slate-50">
                  <td className="pl-4">{a.name}</td>
                  <td className="text-right">{currency(a.amount)}</td>
                  {showCompare && (
                    <td className="text-right">
                      {currency(
                        compareData?.admin.find((x) => x.name === a.name)
                          ?.amount ?? 0,
                      )}
                    </td>
                  )}
                  {showCompare && (
                    <td>
                      {deltaCell(
                        a.amount,
                        compareData?.admin.find((x) => x.name === a.name)
                          ?.amount,
                      )}
                    </td>
                  )}
                </tr>
              ))}
              <tr className="font-bold bg-slate-100">
                <td>Total Administrative Expenses</td>
                <td className="text-right">{currency(totals.totalAdmin)}</td>
                {showCompare && (
                  <td className="text-right">
                    {currency(cTotals?.totalAdmin ?? 0)}
                  </td>
                )}
                {showCompare && (
                  <td>{deltaCell(totals.totalAdmin, cTotals?.totalAdmin)}</td>
                )}
              </tr>

              {/* Profit from Operations */}
              <tr className="font-bold bg-emerald-100">
                <td>Profit from Operations</td>
                <td className="text-right">{currency(totals.profitOps)}</td>
                {showCompare && (
                  <td className="text-right">
                    {currency(cTotals?.profitOps ?? 0)}
                  </td>
                )}
                {showCompare && (
                  <td>{deltaCell(totals.profitOps, cTotals?.profitOps)}</td>
                )}
              </tr>

              {/* Non-operating */}
              {data.nonOperating.map((n) => (
                <tr key={n.name} className="hover:bg-slate-50">
                  <td className="pl-4">{n.name}</td>
                  <td className="text-right">{currency(n.amount)}</td>
                  {showCompare && (
                    <td className="text-right">
                      {currency(
                        compareData?.nonOperating.find((x) => x.name === n.name)
                          ?.amount ?? 0,
                      )}
                    </td>
                  )}
                  {showCompare && (
                    <td>
                      {deltaCell(
                        n.amount,
                        compareData?.nonOperating.find((x) => x.name === n.name)
                          ?.amount,
                      )}
                    </td>
                  )}
                </tr>
              ))}
              <tr className="font-bold bg-slate-100">
                <td>Total Non-operating Income</td>
                <td className="text-right">{currency(totals.totalNonOp)}</td>
                {showCompare && (
                  <td className="text-right">
                    {currency(cTotals?.totalNonOp ?? 0)}
                  </td>
                )}
                {showCompare && (
                  <td>{deltaCell(totals.totalNonOp, cTotals?.totalNonOp)}</td>
                )}
              </tr>

              {/* Finance Cost */}
              {data.financeCost.map((f) => (
                <tr key={f.name} className="hover:bg-slate-50">
                  <td className="pl-4">{f.name}</td>
                  <td className="text-right">{currency(f.amount)}</td>
                  {showCompare && (
                    <td className="text-right">
                      {currency(
                        compareData?.financeCost.find((x) => x.name === f.name)
                          ?.amount ?? 0,
                      )}
                    </td>
                  )}
                  {showCompare && (
                    <td>
                      {deltaCell(
                        f.amount,
                        compareData?.financeCost.find((x) => x.name === f.name)
                          ?.amount,
                      )}
                    </td>
                  )}
                </tr>
              ))}
              <tr className="font-bold bg-slate-100">
                <td>Total Finance Cost</td>
                <td className="text-right">{currency(totals.totalFinance)}</td>
                {showCompare && (
                  <td className="text-right">
                    {currency(cTotals?.totalFinance ?? 0)}
                  </td>
                )}
                {showCompare && (
                  <td>
                    {deltaCell(totals.totalFinance, cTotals?.totalFinance)}
                  </td>
                )}
              </tr>

              {/* Profit Before Tax */}
              <tr className="font-bold bg-emerald-200">
                <td>Profit Before Tax</td>
                <td className="text-right">
                  {currency(totals.profitBeforeTax)}
                </td>
                {showCompare && (
                  <td className="text-right">
                    {currency(cTotals?.profitBeforeTax ?? 0)}
                  </td>
                )}
                {showCompare && (
                  <td>
                    {deltaCell(
                      totals.profitBeforeTax,
                      cTotals?.profitBeforeTax,
                    )}
                  </td>
                )}
              </tr>

              {/* Tax & Net Profit */}
              {data.tax.map((t) => (
                <tr key={t.name} className="hover:bg-slate-50">
                  <td className="pl-4">{t.name}</td>
                  <td className="text-right">{currency(t.amount)}</td>
                  {showCompare && (
                    <td className="text-right">
                      {currency(
                        compareData?.tax.find((x) => x.name === t.name)
                          ?.amount ?? 0,
                      )}
                    </td>
                  )}
                  {showCompare && (
                    <td>
                      {deltaCell(
                        t.amount,
                        compareData?.tax.find((x) => x.name === t.name)?.amount,
                      )}
                    </td>
                  )}
                </tr>
              ))}
              <tr className="font-bold bg-yellow-100">
                <td>Net Profit / (Loss) After Tax</td>
                <td className="text-right">{currency(totals.netProfit)}</td>
                {showCompare && (
                  <td className="text-right">
                    {currency(cTotals?.netProfit ?? 0)}
                  </td>
                )}
                {showCompare && (
                  <td>{deltaCell(totals.netProfit, cTotals?.netProfit)}</td>
                )}
              </tr>
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
