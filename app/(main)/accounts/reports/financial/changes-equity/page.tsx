// app/accounts/reports/financial-reports/statement-of-changes-in-equity/page.tsx
"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Printer, TrendingUp } from "lucide-react";

type EquityRow = {
  label: string;
  shareCapital: number;
  retainedEarnings: number;
  revaluationReserve: number;
  otherReserves: number;
};

type EquityStatement = {
  opening: EquityRow;
  profitForPeriod: EquityRow;
  oci: EquityRow;
  ownerContribution: EquityRow;
  dividends: EquityRow;
  transfers: EquityRow;
};

const DATA: Record<string, EquityStatement> = {
  "2025": {
    opening: { label: "Opening balance", shareCapital: 1_000_000, retainedEarnings: 350_000, revaluationReserve: 100_000, otherReserves: 50_000 },
    profitForPeriod: { label: "Profit for the period", shareCapital: 0, retainedEarnings: 220_000, revaluationReserve: 0, otherReserves: 0 },
    oci: { label: "Other comprehensive income", shareCapital: 0, retainedEarnings: 0, revaluationReserve: 30_000, otherReserves: 0 },
    ownerContribution: { label: "Issue of share capital", shareCapital: 250_000, retainedEarnings: 0, revaluationReserve: 0, otherReserves: 0 },
    dividends: { label: "Dividends paid", shareCapital: 0, retainedEarnings: -120_000, revaluationReserve: 0, otherReserves: 0 },
    transfers: { label: "Transfer to reserves", shareCapital: 0, retainedEarnings: -50_000, revaluationReserve: 0, otherReserves: 50_000 },
  },
  "2024": {
    opening: { label: "Opening balance", shareCapital: 800_000, retainedEarnings: 200_000, revaluationReserve: 70_000, otherReserves: 30_000 },
    profitForPeriod: { label: "Profit for the period", shareCapital: 0, retainedEarnings: 150_000, revaluationReserve: 0, otherReserves: 0 },
    oci: { label: "Other comprehensive income", shareCapital: 0, retainedEarnings: 0, revaluationReserve: 30_000, otherReserves: 0 },
    ownerContribution: { label: "Issue of share capital", shareCapital: 200_000, retainedEarnings: 0, revaluationReserve: 0, otherReserves: 0 },
    dividends: { label: "Dividends paid", shareCapital: 0, retainedEarnings: -70_000, revaluationReserve: 0, otherReserves: 0 },
    transfers: { label: "Transfer to reserves", shareCapital: 0, retainedEarnings: -30_000, revaluationReserve: 0, otherReserves: 30_000 },
  },
};

const currency = (n: number) =>
  new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

function sumRow(row: EquityRow) {
  return row.shareCapital + row.retainedEarnings + row.revaluationReserve + row.otherReserves;
}

export default function StatementOfChangesInEquityPage() {
  const years = Object.keys(DATA).sort((a, b) => b.localeCompare(a));
  const [year, setYear] = useState(years[0]);
  const [compareYear, setCompareYear] = useState<string>("none");

  const statement = DATA[year];
  const compare = compareYear !== "none" ? DATA[compareYear] : null;

  const closing = useMemo(() => {
    const rows = Object.values(statement);
    return rows.reduce(
      (acc, r) => ({
        shareCapital: acc.shareCapital + r.shareCapital,
        retainedEarnings: acc.retainedEarnings + r.retainedEarnings,
        revaluationReserve: acc.revaluationReserve + r.revaluationReserve,
        otherReserves: acc.otherReserves + r.otherReserves,
      }),
      { shareCapital: 0, retainedEarnings: 0, revaluationReserve: 0, otherReserves: 0 },
    );
  }, [statement]);

  const exportCsv = () => {
    const headers = ["Particulars", "Share Capital", "Retained Earnings", "Revaluation Reserve", "Other Reserves", "Total"];
    const rows = [headers];
    Object.values(statement).forEach((r) => {
      rows.push([
        r.label, r.shareCapital.toFixed(2), r.retainedEarnings.toFixed(2),
        r.revaluationReserve.toFixed(2), r.otherReserves.toFixed(2), sumRow(r).toFixed(2),
      ]);
    });
    rows.push([
      "Closing Balance", closing.shareCapital.toFixed(2), closing.retainedEarnings.toFixed(2),
      closing.revaluationReserve.toFixed(2), closing.otherReserves.toFixed(2),
      (closing.shareCapital + closing.retainedEarnings + closing.revaluationReserve + closing.otherReserves).toFixed(2),
    ]);
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `statement_of_changes_in_equity_${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalClosing =
    closing.shareCapital + closing.retainedEarnings + closing.revaluationReserve + closing.otherReserves;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl p-3 md:p-4">
        {/* Hero */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#3aa838]/10">
              <TrendingUp className="h-4 w-4 text-[#3aa838]" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold leading-tight">
                Statement of Changes in Equity
              </h1>
              <p className="truncate text-[11px] text-muted-foreground">
                Year ended 31 December {year}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={exportCsv}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => window.print()}>
              <Printer className="mr-1.5 h-3.5 w-3.5" /> Print
            </Button>
          </div>
        </div>

        {/* Controls */}
        <Card className="mb-3 border-slate-200 shadow-sm">
          <CardContent className="flex flex-wrap gap-3 p-3">
            <div className="space-y-1">
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Year</div>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Compare with</div>
              <Select value={compareYear} onValueChange={setCompareYear}>
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Report */}
        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    {["Particulars", "Share capital", "Retained earnings", "Revaluation", "Other reserves", "Total equity"].map((h) => (
                      <th
                        key={h}
                        className={`px-2 py-2.5 text-[10px] font-medium uppercase tracking-wide text-slate-600 ${h === "Particulars" ? "text-left" : "text-right"}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.values(statement).map((row) => (
                    <tr key={row.label} className="border-b border-slate-100 hover:bg-slate-50/60">
                      <td className="px-2 py-1.5 text-xs font-medium text-slate-800">{row.label}</td>
                      <td className="px-2 py-1.5 text-right text-xs tabular-nums text-slate-700">{currency(row.shareCapital)}</td>
                      <td className="px-2 py-1.5 text-right text-xs tabular-nums text-slate-700">{currency(row.retainedEarnings)}</td>
                      <td className="px-2 py-1.5 text-right text-xs tabular-nums text-slate-700">{currency(row.revaluationReserve)}</td>
                      <td className="px-2 py-1.5 text-right text-xs tabular-nums text-slate-700">{currency(row.otherReserves)}</td>
                      <td className="px-2 py-1.5 text-right text-xs font-semibold tabular-nums text-slate-900">{currency(sumRow(row))}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-900 bg-[#3aa838]/15">
                    <td className="px-2 py-2 text-xs font-bold text-[#2f8a2f]">Closing balance</td>
                    <td className="px-2 py-2 text-right text-xs font-bold tabular-nums text-[#2f8a2f]">{currency(closing.shareCapital)}</td>
                    <td className="px-2 py-2 text-right text-xs font-bold tabular-nums text-[#2f8a2f]">{currency(closing.retainedEarnings)}</td>
                    <td className="px-2 py-2 text-right text-xs font-bold tabular-nums text-[#2f8a2f]">{currency(closing.revaluationReserve)}</td>
                    <td className="px-2 py-2 text-right text-xs font-bold tabular-nums text-[#2f8a2f]">{currency(closing.otherReserves)}</td>
                    <td className="px-2 py-2 text-right text-xs font-bold tabular-nums text-[#2f8a2f]">{currency(totalClosing)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}