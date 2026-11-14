// app/reports/trial-balance/page.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import api from "@/lib/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DateRange } from "react-day-picker";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Calendar,
  Download,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Search,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Layers,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import GlobalPrintButton from "@/components/common/print/GlobalPrintButton";

/* ---------- Types ---------- */
type AccountNode = {
  _id: string;
  code: string;
  name: string;
  type: "Asset" | "Liability" | "Equity" | "Revenue" | "Expense";
  openingBalance?: number;
  periodDebit?: number;
  periodCredit?: number;
  closingBalance?: number;
  children?: AccountNode[];
};
type FlatAccount = AccountNode & { depth: number };

/* ---------- Constants ---------- */
const TYPE_PRIORITY: Record<AccountNode["type"], number> = {
  Asset: 1,
  Liability: 2,
  Equity: 3,
  Revenue: 4,
  Expense: 5,
};

const TYPE_DOT: Record<AccountNode["type"], string> = {
  Asset: "bg-[#3aa838]",
  Liability: "bg-rose-500",
  Equity: "bg-slate-500",
  Revenue: "bg-teal-500",
  Expense: "bg-amber-500",
};

/* ---------- Helpers ---------- */
const formatTaka = (n = 0) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

function sortTree(nodes: AccountNode[]): AccountNode[] {
  return [...nodes]
    .sort((a, b) => {
      const pa = TYPE_PRIORITY[a.type] ?? 99;
      const pb = TYPE_PRIORITY[b.type] ?? 99;
      if (pa !== pb) return pa - pb;
      return String(a.code || "").localeCompare(String(b.code || ""));
    })
    .map((n) => ({
      ...n,
      children: n.children ? sortTree(n.children) : undefined,
    }));
}

function flattenTree(nodes: AccountNode[], depth = 0): FlatAccount[] {
  const result: FlatAccount[] = [];
  for (const node of nodes) {
    result.push({ ...node, depth });
    if (node.children && node.children.length > 0) {
      result.push(...flattenTree(node.children, depth + 1));
    }
  }
  return result;
}

function groupByType(accounts: FlatAccount[]) {
  const groups: Record<string, FlatAccount[]> = {
    Asset: [],
    Liability: [],
    Equity: [],
    Revenue: [],
    Expense: [],
  };
  accounts.forEach((acc) => {
    if (groups[acc.type]) groups[acc.type].push(acc);
  });
  return groups;
}

/* ---------- Sidebar tree item ---------- */
function TreeItem({
  node,
  depth,
  searchTerm,
  typeFilter,
}: {
  node: AccountNode;
  depth: number;
  searchTerm: string;
  typeFilter: string;
}) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = !!node.children && node.children.length > 0;
  const closing = node.closingBalance ?? 0;

  const matchesSearch =
    !searchTerm ||
    node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    node.code.toLowerCase().includes(searchTerm.toLowerCase());
  const matchesType = typeFilter === "all" || node.type === typeFilter;
  if (!matchesSearch || !matchesType) return null;

  const effectiveOpen = searchTerm ? true : open;
  const dot = TYPE_DOT[node.type] || "bg-slate-400";

  return (
    <div>
      <div
        className="flex cursor-pointer items-center justify-between rounded px-1.5 py-1 text-xs hover:bg-slate-50"
        style={{ paddingLeft: `${depth * 14 + 6}px` }}
        onClick={() => hasChildren && setOpen(!open)}
      >
        <div className="flex min-w-0 items-center gap-1">
          {hasChildren ? (
            effectiveOpen ? (
              <ChevronDown className="h-3 w-3 shrink-0 text-slate-400" />
            ) : (
              <ChevronRight className="h-3 w-3 shrink-0 text-slate-400" />
            )
          ) : (
            <span className="w-3 shrink-0" />
          )}
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dot)} />
          <span className="mr-1 shrink-0 font-mono text-[10px] text-slate-500">
            {node.code}
          </span>
          <span className="truncate">{node.name}</span>
        </div>
        <span
          className={cn(
            "ml-2 shrink-0 font-mono text-[10px] tabular-nums",
            closing >= 0 ? "text-slate-700" : "text-rose-600",
          )}
        >
          {formatTaka(closing)}
        </span>
      </div>
      {effectiveOpen &&
        hasChildren &&
        node.children!.map((c) => (
          <TreeItem
            key={c._id}
            node={c}
            depth={depth + 1}
            searchTerm={searchTerm}
            typeFilter={typeFilter}
          />
        ))}
    </div>
  );
}

/* ---------- Main ---------- */
export default function TrialBalancePage() {
  const [tree, setTree] = useState<AccountNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    Asset: true,
    Liability: true,
    Equity: true,
    Revenue: true,
    Expense: true,
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (dateRange?.from) params.from = dateRange.from.toISOString();
      if (dateRange?.to) params.to = dateRange.to.toISOString();
      const res = await api.get("/accounts/tree", { params });
      const raw = (res?.data?.data ?? []) as AccountNode[];
      setTree(sortTree(raw));
    } catch {
      toast.error("Failed to load trial balance");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const flatAccounts = useMemo(() => flattenTree(tree), [tree]);

  const filteredAccounts = useMemo(() => {
    return flatAccounts.filter((acc) => {
      const matchSearch =
        !searchTerm ||
        acc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        acc.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchType = typeFilter === "all" || acc.type === typeFilter;
      return matchSearch && matchType;
    });
  }, [flatAccounts, searchTerm, typeFilter]);

  const groupedAccounts = useMemo(
    () => groupByType(filteredAccounts),
    [filteredAccounts],
  );

  const typeTotals = useMemo(() => {
    const totals: Record<
      string,
      { debit: number; credit: number; net: number; count: number }
    > = {};
    for (const type of Object.keys(groupedAccounts)) {
      let debit = 0,
        credit = 0,
        count = 0;
      const leaves = groupedAccounts[type].filter(
        (a) => !a.children || a.children.length === 0,
      );
      leaves.forEach((a) => {
        const closing = a.closingBalance ?? 0;
        if (closing > 0) debit += closing;
        else credit += Math.abs(closing);
        count++;
      });
      totals[type] = { debit, credit, net: debit - credit, count };
    }
    return totals;
  }, [groupedAccounts]);

  const overallTotals = useMemo(() => {
    let totalDebit = 0,
      totalCredit = 0;
    Object.values(typeTotals).forEach((t) => {
      totalDebit += t.debit;
      totalCredit += t.credit;
    });
    return { totalDebit, totalCredit, net: totalDebit - totalCredit };
  }, [typeTotals]);

  const isBalanced = Math.abs(overallTotals.net) < 0.005;

  const toggleSection = (type: string) => {
    setExpandedSections((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const exportCSV = () => {
    if (flatAccounts.length === 0) return toast.error("No data");
    const headers = ["Code", "Name", "Type", "Debit Balance", "Credit Balance"];
    const rows = flatAccounts.map((a) => {
      const closing = a.closingBalance ?? 0;
      return [
        a.code,
        a.name,
        a.type,
        closing > 0 ? closing.toFixed(2) : "",
        closing < 0 ? Math.abs(closing).toFixed(2) : "",
      ];
    });
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trial-balance-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printHtml = useMemo(() => {
    const sections = Object.keys(groupedAccounts)
      .map((type) => {
        const accounts = groupedAccounts[type];
        if (accounts.length === 0) return "";
        const rows = accounts
          .map((a) => {
            const closing = a.closingBalance ?? 0;
            return `
            <tr>
              <td style="padding:4px 8px; padding-left:${a.depth * 12 + 8}px;">${a.code} - ${a.name}</td>
              <td style="padding:4px 8px; text-align:right;">${closing > 0 ? formatTaka(closing) : ""}</td>
              <td style="padding:4px 8px; text-align:right;">${closing < 0 ? formatTaka(Math.abs(closing)) : ""}</td>
            </tr>`;
          })
          .join("");
        const t = typeTotals[type];
        return `
          <tr style="background:#f8fafc; font-weight:bold;">
            <td style="padding:6px 8px; border-top:2px solid #cbd5e1;">${type} (${accounts.length})</td>
            <td style="padding:6px 8px; text-align:right; border-top:2px solid #cbd5e1;">${formatTaka(t.debit)}</td>
            <td style="padding:6px 8px; text-align:right; border-top:2px solid #cbd5e1;">${formatTaka(t.credit)}</td>
          </tr>
          ${rows}
        `;
      })
      .join("");

    return `
    <div style="font-family:'Inter',sans-serif;font-size:12px;color:#1e293b;padding:20px;max-width:100%;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;border-bottom:2px solid #0f172a;padding-bottom:12px;">
        <h2 style="margin:0;font-size:22px;font-weight:700;">Trial Balance</h2>
        <div style="text-align:right;font-size:11px;color:#475569;">
          ${dateRange?.from ? `From ${format(dateRange.from, "PPP")}` : "Beginning"}
          ${dateRange?.to ? ` to ${format(dateRange.to, "PPP")}` : ""}
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f1f5f9;font-size:11px;text-transform:uppercase;color:#475569;">
            <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #cbd5e1;">Account</th>
            <th style="text-align:right;padding:6px 8px;border-bottom:2px solid #cbd5e1;">Debit</th>
            <th style="text-align:right;padding:6px 8px;border-bottom:2px solid #cbd5e1;">Credit</th>
          </tr>
        </thead>
        <tbody>${sections}</tbody>
        <tfoot>
          <tr style="font-weight:bold;background:#f8fafc;">
            <td style="padding:8px;text-align:right;border-top:2px solid #cbd5e1;">Totals</td>
            <td style="padding:8px;text-align:right;border-top:2px solid #cbd5e1;">${formatTaka(overallTotals.totalDebit)}</td>
            <td style="padding:8px;text-align:right;border-top:2px solid #cbd5e1;">${formatTaka(overallTotals.totalCredit)}</td>
          </tr>
          <tr>
            <td colspan="3" style="text-align:right;padding:4px 8px;color:${isBalanced ? "#2f8a2f" : "#dc2626"};font-size:11px;">
              ${isBalanced ? "✓ Balanced" : `✗ Difference: ${formatTaka(overallTotals.net)}`}
            </td>
          </tr>
        </tfoot>
      </table>
      <div style="margin-top:16px;text-align:center;font-size:9px;color:#94a3b8;">Computer‑generated — Antab Agro LTD</div>
    </div>`;
  }, [groupedAccounts, typeTotals, dateRange, overallTotals, isBalanced]);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex shrink-0 flex-col border-r border-slate-200 bg-white transition-all duration-300",
          sidebarOpen ? "w-72" : "w-0 overflow-hidden",
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#3aa838]/10">
              <Layers className="h-3.5 w-3.5 text-[#3aa838]" />
            </div>
            <span className="text-sm font-semibold">Chart of accounts</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setSidebarOpen(false)}
          >
            <PanelLeftClose className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="space-y-2 border-b border-slate-200 p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search code or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-8 text-xs focus-visible:ring-[#3aa838]"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="Asset">Asset</SelectItem>
              <SelectItem value="Liability">Liability</SelectItem>
              <SelectItem value="Equity">Equity</SelectItem>
              <SelectItem value="Revenue">Revenue</SelectItem>
              <SelectItem value="Expense">Expense</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 overflow-auto p-1.5">
          {loading ? (
            <div className="py-10 text-center text-xs text-muted-foreground">
              Loading...
            </div>
          ) : (
            tree.map((node) => (
              <TreeItem
                key={node._id}
                node={node}
                depth={0}
                searchTerm={searchTerm}
                typeFilter={typeFilter}
              />
            ))
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-7xl p-3 md:p-4">
          {/* Hero */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {!sidebarOpen && (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setSidebarOpen(true)}
                >
                  <PanelLeftOpen className="h-4 w-4" />
                </Button>
              )}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#3aa838]/10">
                <Layers className="h-4 w-4 text-[#3aa838]" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-base font-semibold leading-tight">
                  Trial Balance
                </h1>
                <p className="truncate text-[11px] text-muted-foreground">
                  {flatAccounts.length} accounts ·{" "}
                  {isBalanced ? "balanced" : "not balanced"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs">
                    <Calendar className="mr-1.5 h-3.5 w-3.5" />
                    {dateRange?.from
                      ? dateRange.to
                        ? `${format(dateRange.from, "MMM dd")} – ${format(dateRange.to, "MMM dd")}`
                        : format(dateRange.from, "MMM dd")
                      : "Pick range"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <CalendarComponent
                    initialFocus
                    mode="range"
                    required
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setDateRange({ from: undefined, to: undefined })}
              >
                All
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  const now = new Date();
                  setDateRange({
                    from: new Date(now.getFullYear(), now.getMonth(), 1),
                    to: now,
                  });
                }}
              >
                This month
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  const now = new Date();
                  const lastMonth = new Date(
                    now.getFullYear(),
                    now.getMonth() - 1,
                    1,
                  );
                  const lastMonthEnd = new Date(
                    now.getFullYear(),
                    now.getMonth(),
                    0,
                  );
                  setDateRange({ from: lastMonth, to: lastMonthEnd });
                }}
              >
                Last month
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={exportCSV}
                disabled={flatAccounts.length === 0}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                CSV
              </Button>
              {flatAccounts.length > 0 && (
                <GlobalPrintButton
                  contentHtml={printHtml}
                  label="Print"
                  title="Trial Balance"
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
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={fetchData}
                disabled={loading}
                title="Refresh"
              >
                <RefreshCw
                  className={cn("h-3.5 w-3.5", loading && "animate-spin")}
                />
              </Button>
            </div>
          </div>

          {/* Totals */}
          <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-3">
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <CardContent className="flex items-start justify-between gap-2 p-3">
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Total debit
                  </div>
                  <div className="mt-1 truncate text-lg font-bold tabular-nums text-[#2f8a2f]">
                    ৳ {formatTaka(overallTotals.totalDebit)}
                  </div>
                </div>
                <div className="rounded-lg bg-[#3aa838]/10 p-1.5">
                  <Layers className="h-3.5 w-3.5 text-[#3aa838]" />
                </div>
              </CardContent>
            </Card>
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <CardContent className="flex items-start justify-between gap-2 p-3">
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Total credit
                  </div>
                  <div className="mt-1 truncate text-lg font-bold tabular-nums text-rose-700">
                    ৳ {formatTaka(overallTotals.totalCredit)}
                  </div>
                </div>
                <div className="rounded-lg bg-rose-50 p-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
                </div>
              </CardContent>
            </Card>
            <Card
              className={cn(
                "overflow-hidden border-slate-200 shadow-sm",
                isBalanced
                  ? "border-l-4 border-l-[#3aa838]"
                  : "border-l-4 border-l-amber-500",
              )}
            >
              <CardContent className="flex items-start justify-between gap-2 p-3">
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {isBalanced ? "Status" : "Difference"}
                  </div>
                  {isBalanced ? (
                    <div className="mt-1 flex items-center gap-1.5 text-lg font-bold text-[#2f8a2f]">
                      <CheckCircle className="h-4 w-4" />
                      Balanced
                    </div>
                  ) : (
                    <div className="mt-1 truncate text-lg font-bold tabular-nums text-amber-700">
                      ৳ {formatTaka(overallTotals.net)}
                    </div>
                  )}
                </div>
                <div
                  className={cn(
                    "rounded-lg p-1.5",
                    isBalanced ? "bg-[#3aa838]/10" : "bg-amber-50",
                  )}
                >
                  {isBalanced ? (
                    <CheckCircle className="h-3.5 w-3.5 text-[#3aa838]" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sections */}
          {loading ? (
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="py-16 text-center text-sm text-muted-foreground">
                Loading trial balance...
              </CardContent>
            </Card>
          ) : Object.keys(groupedAccounts).every(
              (k) => groupedAccounts[k].length === 0,
            ) ? (
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="py-16 text-center text-sm text-muted-foreground">
                No accounts found for the selected criteria.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {Object.keys(groupedAccounts).map((type) => {
                const accounts = groupedAccounts[type];
                if (accounts.length === 0) return null;
                const totals = typeTotals[type];
                const expanded = expandedSections[type];
                const dot = TYPE_DOT[type as AccountNode["type"]];

                return (
                  <Card
                    key={type}
                    className="overflow-hidden border-slate-200 shadow-sm"
                  >
                    <div
                      className="flex cursor-pointer items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/60 px-3 py-2 hover:bg-slate-50"
                      onClick={() => toggleSection(type)}
                    >
                      <div className="flex items-center gap-2">
                        {expanded ? (
                          <ChevronDown className="h-4 w-4 text-slate-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-slate-500" />
                        )}
                        <span
                          className={cn("h-2 w-2 rounded-full", dot)}
                        />
                        <span className="text-sm font-semibold uppercase tracking-wide text-slate-800">
                          {type}
                        </span>
                        <Badge className="border border-slate-200 bg-white text-[10px] font-medium text-slate-600">
                          {accounts.length}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-muted-foreground">
                          Dr <b className="text-[#2f8a2f] tabular-nums">৳ {formatTaka(totals.debit)}</b> · Cr{" "}
                          <b className="text-rose-700 tabular-nums">৳ {formatTaka(totals.credit)}</b>
                        </span>
                        <Badge
                          className={cn(
                            "border text-[10px] font-semibold",
                            totals.net >= 0
                              ? "border-[#3aa838]/30 bg-[#3aa838]/10 text-[#2f8a2f]"
                              : "border-rose-200 bg-rose-50 text-rose-700",
                          )}
                        >
                          {totals.net >= 0 ? "DR" : "CR"} ৳{" "}
                          {formatTaka(Math.abs(totals.net))}
                        </Badge>
                      </div>
                    </div>

                    {expanded && (
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50 hover:bg-slate-50">
                            <TableHead className="px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                              Account
                            </TableHead>
                            <TableHead className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wide text-slate-600">
                              Debit
                            </TableHead>
                            <TableHead className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wide text-slate-600">
                              Credit
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {accounts.map((acc) => {
                            const closing = acc.closingBalance ?? 0;
                            return (
                              <TableRow
                                key={acc._id}
                                className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                              >
                                <TableCell
                                  className="px-3 py-1.5 text-xs"
                                  style={{
                                    paddingLeft: `${acc.depth * 16 + 12}px`,
                                  }}
                                >
                                  <span className="mr-1 font-mono text-[10px] text-slate-500">
                                    {acc.code}
                                  </span>
                                  <span className="text-slate-800">{acc.name}</span>
                                </TableCell>
                                <TableCell className="px-3 py-1.5 text-right text-xs font-semibold tabular-nums text-[#2f8a2f]">
                                  {closing > 0 ? formatTaka(closing) : ""}
                                </TableCell>
                                <TableCell className="px-3 py-1.5 text-right text-xs font-semibold tabular-nums text-rose-600">
                                  {closing < 0 ? formatTaka(Math.abs(closing)) : ""}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}