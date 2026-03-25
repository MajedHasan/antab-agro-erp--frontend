"use client";

import React, { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Printer } from "lucide-react";

/* ------------------ DEMO DATA (Replace with API later) ------------------ */

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
    opening: {
      label: "Opening Balance",
      shareCapital: 1_000_000,
      retainedEarnings: 350_000,
      revaluationReserve: 100_000,
      otherReserves: 50_000,
    },
    profitForPeriod: {
      label: "Profit for the period",
      shareCapital: 0,
      retainedEarnings: 220_000,
      revaluationReserve: 0,
      otherReserves: 0,
    },
    oci: {
      label: "Other comprehensive income",
      shareCapital: 0,
      retainedEarnings: 0,
      revaluationReserve: 30_000,
      otherReserves: 0,
    },
    ownerContribution: {
      label: "Issue of share capital",
      shareCapital: 250_000,
      retainedEarnings: 0,
      revaluationReserve: 0,
      otherReserves: 0,
    },
    dividends: {
      label: "Dividends paid",
      shareCapital: 0,
      retainedEarnings: -120_000,
      revaluationReserve: 0,
      otherReserves: 0,
    },
    transfers: {
      label: "Transfer to reserves",
      shareCapital: 0,
      retainedEarnings: -50_000,
      revaluationReserve: 0,
      otherReserves: 50_000,
    },
  },

  "2024": {
    opening: {
      label: "Opening Balance",
      shareCapital: 800_000,
      retainedEarnings: 200_000,
      revaluationReserve: 70_000,
      otherReserves: 30_000,
    },
    profitForPeriod: {
      label: "Profit for the period",
      shareCapital: 0,
      retainedEarnings: 150_000,
      revaluationReserve: 0,
      otherReserves: 0,
    },
    oci: {
      label: "Other comprehensive income",
      shareCapital: 0,
      retainedEarnings: 0,
      revaluationReserve: 30_000,
      otherReserves: 0,
    },
    ownerContribution: {
      label: "Issue of share capital",
      shareCapital: 200_000,
      retainedEarnings: 0,
      revaluationReserve: 0,
      otherReserves: 0,
    },
    dividends: {
      label: "Dividends paid",
      shareCapital: 0,
      retainedEarnings: -70_000,
      revaluationReserve: 0,
      otherReserves: 0,
    },
    transfers: {
      label: "Transfer to reserves",
      shareCapital: 0,
      retainedEarnings: -30_000,
      revaluationReserve: 0,
      otherReserves: 30_000,
    },
  },
};

/* ------------------ HELPERS ------------------ */

const currency = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

function sumRow(row: EquityRow) {
  return (
    row.shareCapital +
    row.retainedEarnings +
    row.revaluationReserve +
    row.otherReserves
  );
}

/* ------------------ PAGE ------------------ */

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
      {
        shareCapital: 0,
        retainedEarnings: 0,
        revaluationReserve: 0,
        otherReserves: 0,
      }
    );
  }, [statement]);

  function exportCsv() {
    alert("CSV export hook ready – connect to backend later.");
  }

  function printPage() {
    window.print();
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold">
            Statement of Changes in Equity
          </h1>
          <p className="text-sm text-muted-foreground">
            For the year ended 31 December {year}
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="ghost" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
          <Button variant="secondary" onClick={printPage}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
        </div>
      </div>

      {/* Controls */}
      <Card className="p-4 flex gap-4 items-end">
        <div>
          <div className="text-xs text-muted-foreground">Year</div>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <div className="text-xs text-muted-foreground">Compare with</div>
          <Select value={compareYear} onValueChange={setCompareYear}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {years.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Table */}
      <Card className="p-4 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-xs text-muted-foreground border-b">
              <th className="text-left py-2">Particulars</th>
              <th className="text-right">Share Capital</th>
              <th className="text-right">Retained Earnings</th>
              <th className="text-right">Revaluation Reserve</th>
              <th className="text-right">Other Reserves</th>
              <th className="text-right">Total Equity</th>
            </tr>
          </thead>

          <tbody>
            {Object.values(statement).map((row) => (
              <tr key={row.label} className="border-b hover:bg-slate-50">
                <td className="py-2 font-medium">{row.label}</td>
                <td className="text-right">{currency(row.shareCapital)}</td>
                <td className="text-right">{currency(row.retainedEarnings)}</td>
                <td className="text-right">
                  {currency(row.revaluationReserve)}
                </td>
                <td className="text-right">{currency(row.otherReserves)}</td>
                <td className="text-right font-semibold">
                  {currency(sumRow(row))}
                </td>
              </tr>
            ))}

            {/* Closing Balance */}
            <tr className="font-bold bg-emerald-100">
              <td className="py-2">Closing Balance</td>
              <td className="text-right">{currency(closing.shareCapital)}</td>
              <td className="text-right">
                {currency(closing.retainedEarnings)}
              </td>
              <td className="text-right">
                {currency(closing.revaluationReserve)}
              </td>
              <td className="text-right">{currency(closing.otherReserves)}</td>
              <td className="text-right">
                {currency(
                  closing.shareCapital +
                    closing.retainedEarnings +
                    closing.revaluationReserve +
                    closing.otherReserves
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </Card>
    </div>
  );
}
