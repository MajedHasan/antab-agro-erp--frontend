// app/accounts/reports/financial-reports/statement-of-financial-position/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Download, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

type AccountRow = {
  id: string;
  code: string;
  name: string;
  group: string;
  currentBalance: number;
  priorBalance?: number;
  noteRef?: string | null;
};

function uid(prefix = "") {
  return prefix + Math.random().toString(36).slice(2, 9);
}

const GROUPS = [
  "Current Assets",
  "Non-Current Assets",
  "Current Liabilities",
  "Non-Current Liabilities",
  "Equity",
];

const currency = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(n));

function drCrLabel(n: number) {
  if (Math.abs(n) < 0.005) return "—";
  return `৳ ${currency(n)} ${n >= 0 ? "DR" : "CR"}`;
}

export default function StatementOfFinancialPositionPage() {
  const [asOfDate, setAsOfDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [year, setYear] = useState<number>(() => new Date().getFullYear());
  const [showComparative, setShowComparative] = useState(true);

  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [openLedger, setOpenLedger] = useState<AccountRow | null>(null);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(
        `/reports/statement-of-financial-position/statement-of-financial-position`,
        {
          params: {
            asOfDate,
            year,
            comparative: String(showComparative),
          },
        },
      );
      const groups = res?.data?.groups ?? [];
      const flat: AccountRow[] = groups.flatMap((g: any) =>
        (g.accounts || []).map((a: any) => ({
          id: String(a.id ?? a._id ?? uid("a_")),
          code: a.code ?? a.accountCode ?? "",
          name: a.name ?? a.accountName ?? "",
          group: g.name ?? a.group ?? "",
          currentBalance:
            typeof a.currentBalance === "number"
              ? a.currentBalance
              : Number(a.balance ?? 0),
          priorBalance:
            typeof a.priorBalance === "number"
              ? a.priorBalance
              : a.priorBalance === undefined
                ? undefined
                : Number(a.priorBalance),
          noteRef: a.noteRef ?? null,
        })),
      );
      setAccounts(flat);
    } catch (err: any) {
      setError(
        err?.response?.data?.message || err?.message || "Failed to load report",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asOfDate, year, showComparative]);

  const grouped = useMemo(() => {
    const map = new Map<string, AccountRow[]>();
    GROUPS.forEach((g) => map.set(g, []));
    for (const acc of accounts) {
      if (!map.has(acc.group)) map.set(acc.group, []);
      map.get(acc.group)!.push(acc);
    }
    return map;
  }, [accounts]);

  function subtotal(
    groupName: string,
    key: "currentBalance" | "priorBalance",
  ) {
    const arr = grouped.get(groupName) ?? [];
    return arr.reduce((s, a) => s + (a[key] ?? 0), 0);
  }

  const totals = useMemo(() => {
    const assetsTotal =
      subtotal("Current Assets", "currentBalance") +
      subtotal("Non-Current Assets", "currentBalance");
    const liabilitiesTotal =
      subtotal("Current Liabilities", "currentBalance") +
      subtotal("Non-Current Liabilities", "currentBalance");
    const equityTotal = subtotal("Equity", "currentBalance");
    return {
      assetsTotal,
      liabilitiesPlusEquity: liabilitiesTotal + equityTotal,
      assetsTotalPrior: showComparative
        ? subtotal("Current Assets", "priorBalance") +
          subtotal("Non-Current Assets", "priorBalance")
        : undefined,
      liabilitiesPlusEquityPrior: showComparative
        ? subtotal("Current Liabilities", "priorBalance") +
          subtotal("Non-Current Liabilities", "priorBalance") +
          subtotal("Equity", "priorBalance")
        : undefined,
    };
  }, [accounts, grouped, showComparative]);

  const balanced =
    Math.abs(totals.assetsTotal - totals.liabilitiesPlusEquity) < 0.005;

  const exportCsv = () => {
    const header = [
      "Group",
      "AccountCode",
      "AccountName",
      `Balance (${year})`,
      showComparative ? `Balance (${year - 1})` : "",
    ];
    const rows: string[] = [header.join(",")];
    for (const g of GROUPS) {
      const arr = grouped.get(g) ?? [];
      if (arr.length === 0) continue;
      for (const a of arr) {
        rows.push(
          [
            `"${g}"`,
            a.code,
            `"${a.name.replace(/"/g, '""')}"`,
            `"${a.currentBalance.toFixed(2)}"`,
            showComparative ? `"${(a.priorBalance ?? 0).toFixed(2)}"` : "",
          ].join(","),
        );
      }
      rows.push(
        [
          `"${g} - Subtotal"`,
          "",
          "",
          `"${subtotal(g, "currentBalance").toFixed(2)}"`,
          showComparative ? `"${subtotal(g, "priorBalance").toFixed(2)}"` : "",
        ].join(","),
      );
    }
    rows.push(
      [
        `"Total Assets"`,
        "",
        "",
        `"${totals.assetsTotal.toFixed(2)}"`,
        showComparative ? `"${totals.assetsTotalPrior?.toFixed(2) ?? 0}"` : "",
      ].join(","),
    );
    rows.push(
      [
        `"Total Liabilities & Equity"`,
        "",
        "",
        `"${totals.liabilitiesPlusEquity.toFixed(2)}"`,
        showComparative
          ? `"${totals.liabilitiesPlusEquityPrior?.toFixed(2) ?? 0}"`
          : "",
      ].join(","),
    );
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `statement_of_financial_position_${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    const rowsHtml = GROUPS.map((g) => {
      const arr = grouped.get(g) ?? [];
      if (arr.length === 0) return "";
      const itemsHtml = arr
        .map(
          (a) =>
            `<tr><td style="padding:6px;border:1px solid #ddd">${a.code} — ${a.name}${
              a.noteRef ? ` <small>(Note ${a.noteRef})</small>` : ""
            }</td><td style="padding:6px;border:1px solid #ddd;text-align:right">${drCrLabel(
              a.currentBalance,
            )}</td>${
              showComparative
                ? `<td style="padding:6px;border:1px solid #ddd;text-align:right">${drCrLabel(a.priorBalance ?? 0)}</td>`
                : ""
            }</tr>`,
        )
        .join("");
      return `<thead><tr><th colspan="${showComparative ? 3 : 2}" style="text-align:left;padding:8px;background:#f7f7f7">${g}</th></tr></thead><tbody>${itemsHtml}<tr style="font-weight:bold"><td style="padding:6px;border:1px solid #ddd">${g} — Subtotal</td><td style="padding:6px;border:1px solid #ddd;text-align:right">${drCrLabel(subtotal(g, "currentBalance"))}</td>${showComparative ? `<td style="padding:6px;border:1px solid #ddd;text-align:right">${drCrLabel(subtotal(g, "priorBalance"))}</td>` : ""}</tr></tbody>`;
    }).join("");

    const html = `<html><head><title>Statement of Financial Position - ${year}</title></head>
      <body style="font-family:Inter,sans-serif;padding:20px">
        <h1>Statement of Financial Position</h1>
        <div>As at: ${asOfDate} • Year: ${year}</div>
        <table style="width:100%;border-collapse:collapse;margin-top:12px">${rowsHtml}
          <tfoot>
            <tr style="font-weight:bold"><td style="padding:6px;border:1px solid #ddd">Total Assets</td><td style="padding:6px;border:1px solid #ddd;text-align:right">${drCrLabel(totals.assetsTotal)}</td>${showComparative ? `<td style="padding:6px;border:1px solid #ddd;text-align:right">${drCrLabel(totals.assetsTotalPrior ?? 0)}</td>` : ""}</tr>
            <tr style="font-weight:bold"><td style="padding:6px;border:1px solid #ddd">Total Liabilities & Equity</td><td style="padding:6px;border:1px solid #ddd;text-align:right">${drCrLabel(totals.liabilitiesPlusEquity)}</td>${showComparative ? `<td style="padding:6px;border:1px solid #ddd;text-align:right">${drCrLabel(totals.liabilitiesPlusEquityPrior ?? 0)}</td>` : ""}</tr>
          </tfoot>
        </table>
      </body></html>`;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.print();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl p-3 md:p-4">
        {/* Hero */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#3aa838]/10">
              <CheckCircle2 className="h-4 w-4 text-[#3aa838]" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold leading-tight">
                Statement of Financial Position
              </h1>
              <p className="truncate text-[11px] text-muted-foreground">
                Assets, liabilities and equity · As at {asOfDate}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={exportCsv}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={printReport}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Print
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={fetchReport} disabled={loading}>
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Controls */}
        <Card className="mb-3 border-slate-200 shadow-sm">
          <CardContent className="grid gap-3 p-3 md:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-[11px] text-slate-600">As at date</Label>
              <Input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="h-9 text-xs focus-visible:ring-[#3aa838]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-slate-600">Year</Label>
              <select
                value={String(year)}
                onChange={(e) => setYear(Number(e.target.value))}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-[#3aa838]"
              >
                {[year - 1, year, year + 1].map((y) => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-slate-600">Comparative</Label>
              <label className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-2 text-xs">
                <input
                  type="checkbox"
                  checked={showComparative}
                  onChange={(e) => setShowComparative(e.target.checked)}
                  className="rounded border-slate-300 text-[#3aa838] focus:ring-[#3aa838]"
                />
                Show prior year
              </label>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-slate-600">Status</Label>
              <div className="flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-2 text-xs">
                {loading ? (
                  <span className="text-slate-500">Loading...</span>
                ) : balanced ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#3aa838]" />
                    <span className="font-semibold text-[#2f8a2f]">Balanced</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
                    <span className="font-semibold text-rose-600">Not balanced</span>
                  </>
                )}
              </div>
            </div>
            {error && (
              <div className="md:col-span-4 rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] text-rose-700">
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Report */}
        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wide text-slate-600">
                      Account / group
                    </th>
                    <th className="w-40 px-3 py-2.5 text-right text-[10px] font-medium uppercase tracking-wide text-slate-600">
                      {year}
                    </th>
                    {showComparative && (
                      <th className="w-40 px-3 py-2.5 text-right text-[10px] font-medium uppercase tracking-wide text-slate-600">
                        {year - 1}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={showComparative ? 3 : 2} className="py-16 text-center text-sm text-muted-foreground">
                        Loading...
                      </td>
                    </tr>
                  ) : accounts.length === 0 ? (
                    <tr>
                      <td colSpan={showComparative ? 3 : 2} className="py-16 text-center text-sm text-muted-foreground">
                        No data for the selected period.
                      </td>
                    </tr>
                  ) : (
                    GROUPS.map((g) => {
                      const arr = grouped.get(g) ?? [];
                      if (arr.length === 0) return null;
                      return (
                        <React.Fragment key={g}>
                          <tr className="bg-slate-100/60">
                            <td className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-800">
                              {g}
                            </td>
                            <td className="px-3 py-1.5 text-right text-xs font-bold tabular-nums text-slate-800">
                              {drCrLabel(subtotal(g, "currentBalance"))}
                            </td>
                            {showComparative && (
                              <td className="px-3 py-1.5 text-right text-xs font-bold tabular-nums text-slate-800">
                                {drCrLabel(subtotal(g, "priorBalance"))}
                              </td>
                            )}
                          </tr>
                          {arr.map((a) => (
                            <tr key={a.id} className="border-t border-slate-100 last:border-0 hover:bg-slate-50/60">
                              <td className="px-3 py-1.5">
                                <button
                                  onClick={() => setOpenLedger(a)}
                                  className="flex items-center gap-1.5 text-xs"
                                >
                                  <span className="font-mono text-[10px] text-slate-500">{a.code}</span>
                                  <span className="text-slate-800">{a.name}</span>
                                  {a.noteRef && (
                                    <Badge className="border border-[#3aa838]/30 bg-[#3aa838]/10 text-[9px] font-medium text-[#2f8a2f]">
                                      Note {a.noteRef}
                                    </Badge>
                                  )}
                                </button>
                              </td>
                              <td className="px-3 py-1.5 text-right text-xs tabular-nums text-slate-800">
                                {drCrLabel(a.currentBalance)}
                              </td>
                              {showComparative && (
                                <td className="px-3 py-1.5 text-right text-xs tabular-nums text-slate-600">
                                  {drCrLabel(a.priorBalance ?? 0)}
                                </td>
                              )}
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-900 bg-slate-50">
                    <td className="px-3 py-2 text-sm font-bold text-slate-900">Total Assets</td>
                    <td className="px-3 py-2 text-right text-sm font-bold tabular-nums text-[#2f8a2f]">
                      {drCrLabel(totals.assetsTotal)}
                    </td>
                    {showComparative && (
                      <td className="px-3 py-2 text-right text-sm font-bold tabular-nums text-slate-700">
                        {drCrLabel(totals.assetsTotalPrior ?? 0)}
                      </td>
                    )}
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="px-3 py-2 text-sm font-bold text-slate-900">Total Liabilities & Equity</td>
                    <td className="px-3 py-2 text-right text-sm font-bold tabular-nums text-[#2f8a2f]">
                      {drCrLabel(totals.liabilitiesPlusEquity)}
                    </td>
                    {showComparative && (
                      <td className="px-3 py-2 text-right text-sm font-bold tabular-nums text-slate-700">
                        {drCrLabel(totals.liabilitiesPlusEquityPrior ?? 0)}
                      </td>
                    )}
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Drill-down modal */}
      <Dialog open={!!openLedger} onOpenChange={(open) => !open && setOpenLedger(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">
              {openLedger?.code} — {openLedger?.name}
            </DialogTitle>
          </DialogHeader>
          {openLedger && (
            <div className="mt-4 space-y-3 text-xs">
              <div>
                <span className="text-muted-foreground">Group:</span>{" "}
                <span className="font-medium text-slate-900">{openLedger.group}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-md border border-[#3aa838]/30 bg-[#3aa838]/5 px-2 py-1.5">
                  <div className="text-[10px] uppercase text-[#2f8a2f]">Current ({year})</div>
                  <div className="font-semibold text-[#2f8a2f]">{drCrLabel(openLedger.currentBalance)}</div>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                  <div className="text-[10px] uppercase text-muted-foreground">Prior ({year - 1})</div>
                  <div className="font-semibold text-slate-800">{drCrLabel(openLedger.priorBalance ?? 0)}</div>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                  <div className="text-[10px] uppercase text-muted-foreground">Note</div>
                  <div className="font-semibold text-slate-800">{openLedger.noteRef ?? "—"}</div>
                </div>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-600">
                Drill-down placeholder — connect to <code>/ledger/{"{accountId}"}/transactions</code> to fetch period movement.
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}