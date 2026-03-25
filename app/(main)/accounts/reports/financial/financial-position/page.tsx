// app/accounts/reports/financial-reports/statement-of-financial-position/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, Printer } from "lucide-react";

/* ---------------- Types ---------------- */

type AccountRow = {
  id: string;
  code: string;
  name: string;
  group: string; // e.g., "Current Assets"
  currentBalance: number;
  priorBalance?: number;
  noteRef?: string | null;
};

/* ---------------- Helpers / Constants ---------------- */

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
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Math.abs(n));

function drCrLabel(n: number) {
  if (Math.abs(n) < 0.005) return "-";
  return `${currency(n)} ${n >= 0 ? "DR" : "CR"}`;
}

/* ---------------- Component ---------------- */

export default function StatementOfFinancialPositionPage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5001";

  const [asOfDate, setAsOfDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [year, setYear] = useState<number>(() => new Date().getFullYear());
  const [showComparative, setShowComparative] = useState(true);

  // data
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // drilldown modal
  const [openLedger, setOpenLedger] = useState<AccountRow | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const url = `${API_BASE}/api/reports/statement-of-financial-position/statement-of-financial-position?asOfDate=${encodeURIComponent(
          asOfDate,
        )}&year=${encodeURIComponent(String(year))}&comparative=${encodeURIComponent(
          String(showComparative),
        )}`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(
            `Failed to load report: ${res.status} ${res.statusText} ${txt}`,
          );
        }
        const json = await res.json();
        // backend returns { asOfDate, year, comparative, groups, totals }
        const groups = json?.groups ?? [];
        // flatten accounts, ensure each account has group, currentBalance, priorBalance
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
            noteRef: a.noteRef ?? a.noteRef ?? null,
          })),
        );
        setAccounts(flat);
      } catch (err: any) {
        if (err.name === "AbortError") return;
        console.error(err);
        setError(err.message || "Failed to load report");
        // keep accounts as-is (empty or previous)
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [API_BASE, asOfDate, year, showComparative]);

  // grouping
  const grouped = useMemo(() => {
    const map = new Map<string, AccountRow[]>();
    GROUPS.forEach((g) => map.set(g, []));
    for (const acc of accounts) {
      if (!map.has(acc.group)) map.set(acc.group, []);
      map.get(acc.group)!.push(acc);
    }
    return map;
  }, [accounts]);

  function subtotal(groupName: string, key: "currentBalance" | "priorBalance") {
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

  // CSV export
  function exportCsv() {
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
  }

  // print
  function printReport() {
    const rowsHtml = GROUPS.map((g) => {
      const arr = grouped.get(g) ?? [];
      if (arr.length === 0) return "";
      const itemsHtml = arr
        .map(
          (a) =>
            `<tr><td style="padding:6px;border:1px solid #ddd">${a.code} — ${
              a.name
            }${
              a.noteRef ? ` <small>(Note ${a.noteRef})</small>` : ""
            }</td><td style="padding:6px;border:1px solid #ddd;text-align:right">${drCrLabel(
              a.currentBalance,
            )}</td>${
              showComparative
                ? `<td style="padding:6px;border:1px solid #ddd;text-align:right">${drCrLabel(
                    a.priorBalance ?? 0,
                  )}</td>`
                : ""
            }</tr>`,
        )
        .join("");
      const subtotalHtml = `<tr style="font-weight:bold"><td style="padding:6px;border:1px solid #ddd">${g} — Subtotal</td><td style="padding:6px;border:1px solid #ddd;text-align:right">${drCrLabel(
        subtotal(g, "currentBalance"),
      )}</td>${
        showComparative
          ? `<td style="padding:6px;border:1px solid #ddd;text-align:right">${drCrLabel(
              subtotal(g, "priorBalance"),
            )}</td>`
          : ""
      }</tr>`;
      return `<thead><tr><th colspan="${
        showComparative ? 3 : 2
      }" style="text-align:left;padding:8px;background:#f7f7f7">${g}</th></tr></thead><tbody>${itemsHtml}${subtotalHtml}</tbody>`;
    }).join("");

    const totalsHtml = `<tr style="font-weight:bold"><td style="padding:6px;border:1px solid #ddd">Total Assets</td><td style="padding:6px;border:1px solid #ddd;text-align:right">${drCrLabel(
      totals.assetsTotal,
    )}</td>${
      showComparative
        ? `<td style="padding:6px;border:1px solid #ddd;text-align:right">${drCrLabel(
            totals.assetsTotalPrior ?? 0,
          )}</td>`
        : ""
    }</tr>
      <tr style="font-weight:bold"><td style="padding:6px;border:1px solid #ddd">Total Liabilities & Equity</td><td style="padding:6px;border:1px solid #ddd;text-align:right">${drCrLabel(
        totals.liabilitiesPlusEquity,
      )}</td>${
        showComparative
          ? `<td style="padding:6px;border:1px solid #ddd;text-align:right">${drCrLabel(
              totals.liabilitiesPlusEquityPrior ?? 0,
            )}</td>`
          : ""
      }</tr>`;

    const html = `
      <html>
        <head><title>Statement of Financial Position - ${year}</title></head>
        <body style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,'Helvetica Neue',Arial;padding:20px">
          <h1>Statement of Financial Position</h1>
          <div>As at: ${asOfDate} • Year: ${year}</div>
          <table style="width:100%;border-collapse:collapse;margin-top:12px">${rowsHtml}<tfoot>${totalsHtml}</tfoot></table>
        </body>
      </html>`;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.print();
  }

  // modal
  function openAccountModal(acc: AccountRow) {
    setOpenLedger(acc);
  }
  function closeAccountModal() {
    setOpenLedger(null);
  }

  const balanced =
    Math.abs(totals.assetsTotal - totals.liabilitiesPlusEquity) < 0.005;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Statement of Financial Position
          </h1>
          <p className="text-sm text-slate-500">
            Assets, liabilities and equity as at selected date. (Balance Sheet)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => exportCsv()}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="secondary" onClick={() => printReport()}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </header>

      {/* Controls */}
      <Card className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div>
          <Label>As at date</Label>
          <Input
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
          />
        </div>

        <div>
          <Label>Year</Label>
          <select
            className="w-full border rounded-md px-3 py-2"
            value={String(year)}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            <option value={String(new Date().getFullYear() - 1)}>
              {new Date().getFullYear() - 1}
            </option>
            <option value={String(new Date().getFullYear())}>
              {new Date().getFullYear()}
            </option>
            <option value={String(new Date().getFullYear() + 1)}>
              {new Date().getFullYear() + 1}
            </option>
          </select>
        </div>

        <div>
          <Label>Comparative</Label>
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={showComparative}
                onChange={(e) => setShowComparative(e.target.checked)}
              />
              <span className="text-sm">Show prior year</span>
            </label>
          </div>
        </div>

        <div>
          <Label>Validation</Label>
          <div className="mt-2">
            {loading ? (
              <div className="text-slate-500">Loading...</div>
            ) : balanced ? (
              <div className="text-emerald-700 font-semibold">
                Balanced: Assets = Liabilities + Equity
              </div>
            ) : (
              <div className="text-rose-600 font-semibold">
                Not Balanced — check totals
              </div>
            )}
            {error && (
              <div className="text-rose-600 text-sm mt-2">Error: {error}</div>
            )}
          </div>
        </div>
      </Card>

      {/* Report table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-auto">
            <thead className="bg-slate-100 text-sm">
              <tr>
                <th className="px-4 py-3 text-left">Account / Group</th>
                <th className="px-4 py-3 text-right w-48">{year}</th>
                {showComparative && (
                  <th className="px-4 py-3 text-right w-48">{year - 1}</th>
                )}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={showComparative ? 3 : 2}
                    className="p-6 text-center"
                  >
                    Loading...
                  </td>
                </tr>
              ) : (
                GROUPS.map((g) => {
                  const arr = grouped.get(g) ?? [];
                  if (!arr || arr.length === 0) return null;
                  return (
                    <React.Fragment key={g}>
                      <tr className="bg-slate-50">
                        <td className="px-4 py-2 font-semibold">{g}</td>
                        <td className="px-4 py-2 text-right font-semibold">
                          {drCrLabel(subtotal(g, "currentBalance"))}
                        </td>
                        {showComparative && (
                          <td className="px-4 py-2 text-right font-semibold">
                            {drCrLabel(subtotal(g, "priorBalance"))}
                          </td>
                        )}
                      </tr>

                      {arr.map((a) => (
                        <tr key={a.id} className="border-t hover:bg-slate-50">
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <button
                                className="inline-flex items-center gap-2 text-sm text-slate-700"
                                onClick={() => openAccountModal(a)}
                              >
                                <span className="text-xs text-slate-400">
                                  {a.code}
                                </span>
                                <span>{a.name}</span>
                                {a.noteRef && (
                                  <span className="ml-2 px-2 py-0.5 text-xs rounded bg-blue-50 text-blue-600">
                                    Note {a.noteRef}
                                  </span>
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-right">
                            {drCrLabel(a.currentBalance)}
                          </td>
                          {showComparative && (
                            <td className="px-4 py-2 text-right">
                              {drCrLabel(a.priorBalance ?? 0)}
                            </td>
                          )}
                        </tr>
                      ))}

                      <tr className="border-t">
                        <td className="px-4 py-2 text-right italic">
                          Subtotal {g}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold">
                          {drCrLabel(subtotal(g, "currentBalance"))}
                        </td>
                        {showComparative && (
                          <td className="px-4 py-2 text-right font-semibold">
                            {drCrLabel(subtotal(g, "priorBalance"))}
                          </td>
                        )}
                      </tr>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>

            <tfoot className="bg-slate-50">
              <tr>
                <td className="px-4 py-3 font-bold">Total Assets</td>
                <td className="px-4 py-3 text-right font-bold">
                  {drCrLabel(totals.assetsTotal)}
                </td>
                {showComparative && (
                  <td className="px-4 py-3 text-right font-bold">
                    {drCrLabel(totals.assetsTotalPrior ?? 0)}
                  </td>
                )}
              </tr>

              <tr>
                <td className="px-4 py-3 font-bold">
                  Total Liabilities & Equity
                </td>
                <td className="px-4 py-3 text-right font-bold">
                  {drCrLabel(totals.liabilitiesPlusEquity)}
                </td>
                {showComparative && (
                  <td className="px-4 py-3 text-right font-bold">
                    {drCrLabel(totals.liabilitiesPlusEquityPrior ?? 0)}
                  </td>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Ledger drill-down modal */}
      <Dialog
        open={!!openLedger}
        onOpenChange={(open) => {
          if (!open) setOpenLedger(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {openLedger?.code} — {openLedger?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div>
              <div className="text-sm text-slate-500">Group</div>
              <div className="font-medium">{openLedger?.group}</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <div className="text-xs text-slate-500">Current ({year})</div>
                <div className="font-semibold">
                  {openLedger ? drCrLabel(openLedger.currentBalance) : "-"}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Prior ({year - 1})</div>
                <div className="font-semibold">
                  {openLedger ? drCrLabel(openLedger.priorBalance ?? 0) : "-"}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Related note</div>
                <div className="font-medium">{openLedger?.noteRef ?? "—"}</div>
              </div>
            </div>

            <div>
              <Label>Quick ledger details (demo)</Label>
              <div className="mt-2 text-sm text-slate-600">
                This is a demo drill-down. Replace with API call to fetch ledger
                transactions and aging / movement for the period.
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpenLedger(null)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  alert("Open ledger details (demo)");
                }}
              >
                Open Full Ledger
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
