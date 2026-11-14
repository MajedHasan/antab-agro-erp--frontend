// app/reports/financial/statement-of-profit-loss/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, ArrowUp, ArrowDown, RefreshCw } from "lucide-react";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

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

const currency = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
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

export default function StatementOfProfitLossPage() {
  const [periodType, setPeriodType] = useState<"monthly" | "yearly">("monthly");
  const availableMonths = Object.keys(MONTHLY).sort((a, b) => b.localeCompare(a));
  const availableYears = Array.from(
    new Set(availableMonths.map((m) => m.slice(0, 4))),
  ).sort((a, b) => b.localeCompare(a));
  const [period, setPeriod] = useState<string>(availableMonths[0] ?? "");
  const [compareEnabled, setCompareEnabled] = useState<boolean>(false);
  const [comparePeriod, setComparePeriod] = useState<string>("none");

  const [data, setData] = useState<typeof MONTHLY[string] | null>(
    () => MONTHLY[availableMonths[0]] ?? null,
  );
  const [compareData, setCompareData] = useState<typeof data | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        const q = new URLSearchParams();
        q.set("periodType", periodType);
        q.set("period", period);
        if (compareEnabled && comparePeriod && comparePeriod !== "none") {
          q.set("comparePeriod", comparePeriod);
        }
        const res = await api.get(
          `/reports/profit-loss/statement-of-profit-loss?${q.toString()}`,
        );
        const payload = res?.data?.data ?? res.data ?? res;
        const backendCurrent = payload?.current ?? payload?.data ?? payload ?? null;
        const backendCompare = payload?.compare ?? null;

        function normalizePL(obj: any) {
          if (!obj) return null;
          const withArrays = {
            revenue: Array.isArray(obj.revenue) ? obj.revenue : [],
            costOfSales: Array.isArray(obj.costOfSales) ? obj.costOfSales : [],
            selling: Array.isArray(obj.selling) ? obj.selling : [],
            admin: Array.isArray(obj.admin) ? obj.admin : [],
            nonOperating: Array.isArray(obj.nonOperating) ? obj.nonOperating : [],
            financeCost: Array.isArray(obj.financeCost) ? obj.financeCost : [],
            tax: Array.isArray(obj.tax) ? obj.tax : [],
          };
          if (withArrays.revenue.length === 0 && typeof obj.totalRevenue === "number")
            withArrays.revenue = [{ name: "Total Revenue", amount: obj.totalRevenue }];
          if (withArrays.costOfSales.length === 0 && typeof obj.totalCost === "number")
            withArrays.costOfSales = [{ name: "Total Cost of Sales", amount: obj.totalCost }];
          if (withArrays.selling.length === 0 && typeof obj.totalSelling === "number")
            withArrays.selling = [{ name: "Selling & Distribution", amount: obj.totalSelling }];
          if (withArrays.admin.length === 0 && typeof obj.totalAdmin === "number")
            withArrays.admin = [{ name: "Administrative", amount: obj.totalAdmin }];
          if (withArrays.nonOperating.length === 0 && typeof obj.totalNonOp === "number")
            withArrays.nonOperating = [{ name: "Non-operating", amount: obj.totalNonOp }];
          if (withArrays.financeCost.length === 0 && typeof obj.totalFinance === "number")
            withArrays.financeCost = [{ name: "Finance Cost", amount: obj.totalFinance }];
          if (withArrays.tax.length === 0 && typeof obj.totalTax === "number")
            withArrays.tax = [{ name: "Tax", amount: obj.totalTax }];
          return withArrays;
        }

        const normCurrent = normalizePL(backendCurrent);
        const normCompare = normalizePL(backendCompare);

        if (normCurrent) setData(normCurrent);
        else if (periodType === "monthly" && MONTHLY[period]) setData(MONTHLY[period]);
        else if (periodType === "yearly") {
          const months = Object.keys(MONTHLY).filter((m) => m.startsWith(period + "-"));
          if (months.length) {
            const agg: any = {
              revenue: [], costOfSales: [], selling: [], admin: [],
              nonOperating: [], financeCost: [], tax: [],
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
          } else setData(null);
        } else setData(null);

        if (compareEnabled && comparePeriod && comparePeriod !== "none") {
          if (normCompare) setCompareData(normCompare);
          else if (periodType === "monthly" && MONTHLY[comparePeriod])
            setCompareData(MONTHLY[comparePeriod]);
          else setCompareData(null);
        } else setCompareData(null);
      } catch (err: any) {
        setError(
          err?.response?.data?.message || err?.message || "Failed to load report",
        );
        if (periodType === "monthly" && MONTHLY[period]) setData(MONTHLY[period]);
        else setData(null);
        setCompareData(null);
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodType, period, compareEnabled, comparePeriod]);

  function computeTotals(d: typeof data) {
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
      totalRevenue, totalCost, grossProfit,
      totalSelling, totalAdmin, profitOps,
      totalNonOp, totalFinance, profitBeforeTax,
      totalTax, netProfit,
    };
  }

  const totals = useMemo(() => computeTotals(data), [data]);
  const cTotals = useMemo(() => computeTotals(compareData), [compareData]);

  function exportCsv() {
    if (!data || !totals) return;
    const header = [
      "Particulars", "Current",
      compareEnabled && compareData ? `Compare (${comparePeriod})` : "Compare",
      "Delta", "%",
    ];
    const rows: string[][] = [header];
    function pushLines(
      title: string, entries: AccountEntry[], cEntries?: AccountEntry[],
      entryTotal?: number, cTotal?: number,
    ) {
      rows.push([title, "", "", "", ""]);
      entries.forEach((e) => {
        const cVal = cEntries?.find((x) => x.name === e.name)?.amount ?? 0;
        const delta = e.amount - cVal;
        const pct = pctChange(e.amount, cVal);
        rows.push([
          `  ${e.name}`, e.amount.toFixed(2),
          cVal ? cVal.toFixed(2) : "", delta.toFixed(2), pct.toFixed(2) + "%",
        ]);
      });
      rows.push([
        `Total ${title}`, (entryTotal ?? 0).toFixed(2), (cTotal ?? 0).toFixed(2),
        ((entryTotal ?? 0) - (cTotal ?? 0)).toFixed(2),
        pctChange(entryTotal ?? 0, cTotal ?? 0).toFixed(2) + "%",
      ]);
    }
    pushLines("Revenue", data!.revenue, compareData?.revenue, totals.totalRevenue, cTotals?.totalRevenue);
    pushLines("Cost of Sales", data!.costOfSales, compareData?.costOfSales, totals.totalCost, cTotals?.totalCost);
    rows.push(["Gross Profit", totals.grossProfit.toFixed(2), (cTotals?.grossProfit ?? 0).toFixed(2), (totals.grossProfit - (cTotals?.grossProfit ?? 0)).toFixed(2), pctChange(totals.grossProfit, cTotals?.grossProfit ?? 0).toFixed(2) + "%"]);
    pushLines("Selling & Distribution Expenses", data!.selling, compareData?.selling, totals.totalSelling, cTotals?.totalSelling);
    pushLines("Administrative Expenses", data!.admin, compareData?.admin, totals.totalAdmin, cTotals?.totalAdmin);
    rows.push(["Profit from Operations", totals.profitOps.toFixed(2), (cTotals?.profitOps ?? 0).toFixed(2), (totals.profitOps - (cTotals?.profitOps ?? 0)).toFixed(2), pctChange(totals.profitOps, cTotals?.profitOps ?? 0).toFixed(2) + "%"]);
    pushLines("Non-operating Income", data!.nonOperating, compareData?.nonOperating, totals.totalNonOp, cTotals?.totalNonOp);
    pushLines("Finance Cost", data!.financeCost, compareData?.financeCost, totals.totalFinance, cTotals?.totalFinance);
    rows.push(["Profit Before Tax", totals.profitBeforeTax.toFixed(2), (cTotals?.profitBeforeTax ?? 0).toFixed(2), (totals.profitBeforeTax - (cTotals?.profitBeforeTax ?? 0)).toFixed(2), pctChange(totals.profitBeforeTax, cTotals?.profitBeforeTax ?? 0).toFixed(2) + "%"]);
    pushLines("Tax Expense", data!.tax, compareData?.tax, totals.totalTax, cTotals?.totalTax);
    rows.push(["Net Profit / (Loss) After Tax", totals.netProfit.toFixed(2), (cTotals?.netProfit ?? 0).toFixed(2), (totals.netProfit - (cTotals?.netProfit ?? 0)).toFixed(2), pctChange(totals.netProfit, cTotals?.netProfit ?? 0).toFixed(2) + "%"]);

    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `profit_loss_${period}_report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const showCompare = compareEnabled && comparePeriod !== "none" && !!cTotals;

  const deltaCell = (cur: number, cmp: number | undefined) => {
    const cmpVal = cmp ?? 0;
    const d = cur - cmpVal;
    const p = pctChange(cur, cmpVal);
    return (
      <div className="flex items-center justify-end gap-2">
        <div className={cn("text-[11px] tabular-nums", d > 0 ? "text-[#2f8a2f]" : d < 0 ? "text-rose-600" : "text-slate-700")}>
          {currency(d)}
        </div>
        <div className={cn("text-[10px] font-medium tabular-nums", p > 0 ? "text-[#2f8a2f]" : p < 0 ? "text-rose-600" : "text-slate-500")}>
          {p === Infinity || p === -Infinity ? "—" : p.toFixed(1) + "%"}
        </div>
        {d > 0 ? <ArrowUp className="h-3 w-3 text-[#2f8a2f]" /> : d < 0 ? <ArrowDown className="h-3 w-3 text-rose-600" /> : null}
      </div>
    );
  };

  const Section = ({ title, total, cTotal, children }: any) => (
    <tr className="bg-slate-100">
      <td className="px-2 py-1.5 text-xs font-bold text-slate-900">{title}</td>
      <td className="px-2 py-1.5 text-right text-xs font-bold tabular-nums text-slate-900">{currency(total)}</td>
      {showCompare && <td className="px-2 py-1.5 text-right text-xs font-bold tabular-nums text-slate-700">{currency(cTotal ?? 0)}</td>}
      {showCompare && <td className="px-2 py-1.5">{deltaCell(total, cTotal)}</td>}
    </tr>
  );

  const Line = ({ name, amount, cAmount }: any) => (
    <tr className="border-b border-slate-100 hover:bg-slate-50/60">
      <td className="px-2 py-1.5 pl-6 text-xs text-slate-700">{name}</td>
      <td className="px-2 py-1.5 text-right text-xs tabular-nums text-slate-800">{currency(amount)}</td>
      {showCompare && <td className="px-2 py-1.5 text-right text-xs tabular-nums text-slate-600">{currency(cAmount ?? 0)}</td>}
      {showCompare && <td className="px-2 py-1.5">{deltaCell(amount, cAmount)}</td>}
    </tr>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl p-3 md:p-4">
        {/* Hero */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#3aa838]/10">
              <ArrowUp className="h-4 w-4 text-[#3aa838]" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold leading-tight">
                Statement of Profit or Loss
              </h1>
              <p className="truncate text-[11px] text-muted-foreground">
                {periodType === "monthly" ? "Monthly" : "Yearly"} · {period}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={exportCsv}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
            </Button>
          </div>
        </div>

        {/* Controls */}
        <Card className="mb-3 border-slate-200 shadow-sm">
          <CardContent className="flex flex-wrap items-end gap-3 p-3">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Period type</div>
              <div className="mt-1 flex gap-1">
                <Button
                  size="sm"
                  variant={periodType === "monthly" ? "default" : "outline"}
                  className={cn("h-8 text-xs", periodType === "monthly" && "bg-[#3aa838] text-white hover:bg-[#2f8a2f]")}
                  onClick={() => {
                    setPeriodType("monthly");
                    setPeriod(availableMonths[0] ?? "");
                  }}
                >
                  Monthly
                </Button>
                <Button
                  size="sm"
                  variant={periodType === "yearly" ? "default" : "outline"}
                  className={cn("h-8 text-xs", periodType === "yearly" && "bg-[#3aa838] text-white hover:bg-[#2f8a2f]")}
                  onClick={() => {
                    setPeriodType("yearly");
                    setPeriod(availableYears[0] ?? "");
                  }}
                >
                  Yearly
                </Button>
              </div>
            </div>

            <div>
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Period</div>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="mt-1 h-8 w-40 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(periodType === "monthly" ? availableMonths : availableYears).map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <label className="flex h-8 items-center gap-2 rounded-md border border-input bg-background px-2 text-xs">
              <input
                type="checkbox"
                checked={compareEnabled}
                onChange={(e) => {
                  setCompareEnabled(e.target.checked);
                  if (!e.target.checked) setComparePeriod("none");
                }}
                className="rounded border-slate-300 text-[#3aa838] focus:ring-[#3aa838]"
              />
              Compare
            </label>

            {compareEnabled && (
              <div>
                <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Against</div>
                <Select value={comparePeriod} onValueChange={setComparePeriod}>
                  <SelectTrigger className="mt-1 h-8 w-40 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {(periodType === "monthly" ? availableMonths : availableYears).map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Report */}
        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-2 py-2.5 text-left text-[10px] font-medium uppercase tracking-wide text-slate-600">Particulars</th>
                    <th className="w-36 px-2 py-2.5 text-right text-[10px] font-medium uppercase tracking-wide text-slate-600">Current</th>
                    {showCompare && <th className="w-36 px-2 py-2.5 text-right text-[10px] font-medium uppercase tracking-wide text-slate-600">Compare</th>}
                    {showCompare && <th className="w-48 px-2 py-2.5 text-right text-[10px] font-medium uppercase tracking-wide text-slate-600">Δ / %</th>}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={showCompare ? 4 : 2} className="py-16 text-center text-sm text-muted-foreground">Loading...</td></tr>
                  ) : error ? (
                    <tr><td colSpan={showCompare ? 4 : 2} className="py-16 text-center text-sm text-rose-600">{error}</td></tr>
                  ) : !data || !totals ? (
                    <tr><td colSpan={showCompare ? 4 : 2} className="py-16 text-center text-sm text-muted-foreground">No data for selected period.</td></tr>
                  ) : (
                    <>
                      {data.revenue.map((r) => <Line key={r.name} name={r.name} amount={r.amount} cAmount={compareData?.revenue.find((x) => x.name === r.name)?.amount} />)}
                      <Section title="Total Revenue" total={totals.totalRevenue} cTotal={cTotals?.totalRevenue} />

                      {data.costOfSales.map((c) => <Line key={c.name} name={c.name} amount={c.amount} cAmount={compareData?.costOfSales.find((x) => x.name === c.name)?.amount} />)}
                      <Section title="Total Cost of Sales" total={totals.totalCost} cTotal={cTotals?.totalCost} />

                      <tr className="bg-[#3aa838]/10">
                        <td className="px-2 py-2 text-xs font-bold text-[#2f8a2f]">Gross Profit</td>
                        <td className="px-2 py-2 text-right text-xs font-bold tabular-nums text-[#2f8a2f]">{currency(totals.grossProfit)}</td>
                        {showCompare && <td className="px-2 py-2 text-right text-xs font-bold tabular-nums text-[#2f8a2f]">{currency(cTotals?.grossProfit ?? 0)}</td>}
                        {showCompare && <td className="px-2 py-2">{deltaCell(totals.grossProfit, cTotals?.grossProfit)}</td>}
                      </tr>

                      {data.selling.map((s) => <Line key={s.name} name={s.name} amount={s.amount} cAmount={compareData?.selling.find((x) => x.name === s.name)?.amount} />)}
                      <Section title="Total Selling & Distribution" total={totals.totalSelling} cTotal={cTotals?.totalSelling} />

                      {data.admin.map((a) => <Line key={a.name} name={a.name} amount={a.amount} cAmount={compareData?.admin.find((x) => x.name === a.name)?.amount} />)}
                      <Section title="Total Administrative" total={totals.totalAdmin} cTotal={cTotals?.totalAdmin} />

                      <tr className="bg-[#3aa838]/15">
                        <td className="px-2 py-2 text-xs font-bold text-[#2f8a2f]">Profit from Operations</td>
                        <td className="px-2 py-2 text-right text-xs font-bold tabular-nums text-[#2f8a2f]">{currency(totals.profitOps)}</td>
                        {showCompare && <td className="px-2 py-2 text-right text-xs font-bold tabular-nums text-[#2f8a2f]">{currency(cTotals?.profitOps ?? 0)}</td>}
                        {showCompare && <td className="px-2 py-2">{deltaCell(totals.profitOps, cTotals?.profitOps)}</td>}
                      </tr>

                      {data.nonOperating.map((n) => <Line key={n.name} name={n.name} amount={n.amount} cAmount={compareData?.nonOperating.find((x) => x.name === n.name)?.amount} />)}
                      <Section title="Total Non-operating Income" total={totals.totalNonOp} cTotal={cTotals?.totalNonOp} />

                      {data.financeCost.map((f) => <Line key={f.name} name={f.name} amount={f.amount} cAmount={compareData?.financeCost.find((x) => x.name === f.name)?.amount} />)}
                      <Section title="Total Finance Cost" total={totals.totalFinance} cTotal={cTotals?.totalFinance} />

                      <tr className="bg-[#3aa838]/20">
                        <td className="px-2 py-2 text-xs font-bold text-[#2f8a2f]">Profit Before Tax</td>
                        <td className="px-2 py-2 text-right text-xs font-bold tabular-nums text-[#2f8a2f]">{currency(totals.profitBeforeTax)}</td>
                        {showCompare && <td className="px-2 py-2 text-right text-xs font-bold tabular-nums text-[#2f8a2f]">{currency(cTotals?.profitBeforeTax ?? 0)}</td>}
                        {showCompare && <td className="px-2 py-2">{deltaCell(totals.profitBeforeTax, cTotals?.profitBeforeTax)}</td>}
                      </tr>

                      {data.tax.map((t) => <Line key={t.name} name={t.name} amount={t.amount} cAmount={compareData?.tax.find((x) => x.name === t.name)?.amount} />)}

                      <tr className="border-t-2 border-slate-900 bg-[#3aa838]/25">
                        <td className="px-2 py-2.5 text-sm font-bold text-[#2f8a2f]">Net Profit / (Loss)</td>
                        <td className="px-2 py-2.5 text-right text-sm font-bold tabular-nums text-[#2f8a2f]">{currency(totals.netProfit)}</td>
                        {showCompare && <td className="px-2 py-2.5 text-right text-sm font-bold tabular-nums text-[#2f8a2f]">{currency(cTotals?.netProfit ?? 0)}</td>}
                        {showCompare && <td className="px-2 py-2.5">{deltaCell(totals.netProfit, cTotals?.netProfit)}</td>}
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}