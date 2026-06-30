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

/* ---------- Helpers ---------- */
const formatTaka = (n = 0) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

function accountTypeColor(type: string) {
  const map: Record<string, string> = {
    Asset: "text-blue-700",
    Liability: "text-red-700",
    Equity: "text-purple-700",
    Revenue: "text-green-700",
    Expense: "text-amber-700",
  };
  return map[type] || "text-gray-700";
}

/* ---------- flatten tree ---------- */
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

/* ---------- group by type ---------- */
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

/* ---------- Main Component ---------- */
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
      setTree(res?.data?.data ?? []);
    } catch (err) {
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
    [filteredAccounts]
  );

  // subtotals per type (leaf only to avoid double counting)
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
        (a) => !a.children || a.children.length === 0
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

  // Print HTML (classic statement)
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
              <td style="padding:2px 8px; padding-left:${a.depth * 12 + 8}px;">${a.code} - ${a.name}</td>
              <td style="padding:2px 8px; text-align:right;">${closing > 0 ? formatTaka(closing) : ""}</td>
              <td style="padding:2px 8px; text-align:right;">${closing < 0 ? formatTaka(Math.abs(closing)) : ""}</td>
            </tr>`;
          })
          .join("");
        const t = typeTotals[type];
        return `
          <tr style="background:#f8fafc; font-weight:bold;">
            <td colspan="1" style="padding:6px 8px; border-top:2px solid #cbd5e1;">${type} (${accounts.length})</td>
            <td style="padding:6px 8px; text-align:right; border-top:2px solid #cbd5e1;">${formatTaka(t.debit)}</td>
            <td style="padding:6px 8px; text-align:right; border-top:2px solid #cbd5e1;">${formatTaka(t.credit)}</td>
          </tr>
          ${rows}
        `;
      })
      .join("");

    return `
    <div style="font-family: 'Segoe UI', sans-serif; font-size:12px; color:#1e293b; padding:20px; max-width:100%;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
        <h2 style="margin:0; font-size:22px; font-weight:700;">Trial Balance</h2>
        <div style="text-align:right; font-size:11px; color:#475569;">
          ${dateRange?.from ? `From ${format(dateRange.from, "PPP")}` : "Beginning"} 
          ${dateRange?.to ? ` to ${format(dateRange.to, "PPP")}` : ""}
        </div>
      </div>
      <table style="width:100%; border-collapse:collapse;">
        <thead>
          <tr style="background:#f1f5f9; font-size:11px; text-transform:uppercase; color:#475569;">
            <th style="text-align:left; padding:6px 8px; border-bottom:2px solid #cbd5e1;">Account</th>
            <th style="text-align:right; padding:6px 8px; border-bottom:2px solid #cbd5e1;">Debit</th>
            <th style="text-align:right; padding:6px 8px; border-bottom:2px solid #cbd5e1;">Credit</th>
          </tr>
        </thead>
        <tbody>
          ${sections}
        </tbody>
        <tfoot>
          <tr style="font-weight:bold; background:#f8fafc;">
            <td style="padding:8px; text-align:right; border-top:2px solid #cbd5e1;">Totals</td>
            <td style="padding:8px; text-align:right; border-top:2px solid #cbd5e1;">${formatTaka(overallTotals.totalDebit)}</td>
            <td style="padding:8px; text-align:right; border-top:2px solid #cbd5e1;">${formatTaka(overallTotals.totalCredit)}</td>
          </tr>
          <tr>
            <td colspan="3" style="text-align:right; padding:4px 8px; color:${isBalanced ? "#16a34a" : "#dc2626"}; font-size:11px;">
              ${isBalanced ? "✓ Balanced" : `✗ Difference: ${formatTaka(overallTotals.net)}`}
            </td>
          </tr>
        </tfoot>
      </table>
      <div style="margin-top:16px; text-align:center; font-size:9px; color:#94a3b8;">
        Computer‑generated statement — Antab Agro LTD
      </div>
    </div>`;
  }, [groupedAccounts, typeTotals, dateRange, overallTotals, isBalanced]);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar – Chart of Accounts */}
      <aside
        className={cn(
          "border-r bg-white flex flex-col shrink-0 transition-all duration-300",
          sidebarOpen ? "w-72" : "w-0 overflow-hidden"
        )}
      >
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2 text-sm">
            <Layers className="h-4 w-4" />
            Chart of Accounts
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(false)}
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-3 space-y-2 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search code or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9 text-sm">
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
        <div className="flex-1 overflow-auto p-2">
          {loading ? (
            <div className="text-center py-10 text-gray-400">Loading...</div>
          ) : (
            <AccountTreeList
              nodes={tree}
              depth={0}
              searchTerm={searchTerm}
              typeFilter={typeFilter}
            />
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
              >
                <PanelLeftOpen className="h-5 w-5" />
              </Button>
            )}
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                Trial Balance
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Snapshot of all account balances for the selected period.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportCSV}
              disabled={flatAccounts.length === 0}
            >
              <Download className="h-4 w-4 mr-1" /> Export CSV
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
              size="sm"
              onClick={fetchData}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
          </div>
        </div>

        {/* Date range */}
        <Card className="shadow-sm border-gray-200 mb-6">
          <CardContent className="p-4 flex flex-wrap items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(!dateRange && "text-muted-foreground")}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "MMM dd, yyyy")} -{" "}
                        {format(dateRange.to, "MMM dd, yyyy")}
                      </>
                    ) : (
                      format(dateRange.from, "MMM dd, yyyy")
                    )
                  ) : (
                    "Pick a range"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDateRange({ from: undefined, to: undefined })}
            >
              All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const now = new Date();
                setDateRange({
                  from: new Date(now.getFullYear(), now.getMonth(), 1),
                  to: now,
                });
              }}
            >
              This Month
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const now = new Date();
                const lastMonth = new Date(
                  now.getFullYear(),
                  now.getMonth() - 1,
                  1
                );
                const lastMonthEnd = new Date(
                  now.getFullYear(),
                  now.getMonth(),
                  0
                );
                setDateRange({ from: lastMonth, to: lastMonthEnd });
              }}
            >
              Last Month
            </Button>
          </CardContent>
        </Card>

        {/* Overall balance summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="shadow-sm border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                Total Debit
              </p>
              <p className="text-2xl font-bold text-blue-700 mt-1">
                {formatTaka(overallTotals.totalDebit)}
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-l-4 border-l-red-500">
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                Total Credit
              </p>
              <p className="text-2xl font-bold text-red-700 mt-1">
                {formatTaka(overallTotals.totalCredit)}
              </p>
            </CardContent>
          </Card>
          <Card
            className={cn(
              "shadow-sm border-l-4",
              isBalanced ? "border-l-emerald-500" : "border-l-amber-500"
            )}
          >
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                {isBalanced ? "Status" : "Difference"}
              </p>
              {isBalanced ? (
                <div className="flex items-center gap-2 mt-1">
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                  <span className="text-lg font-semibold text-emerald-700">
                    Balanced
                  </span>
                </div>
              ) : (
                <p className="text-2xl font-bold text-amber-700 mt-1">
                  {formatTaka(overallTotals.net)}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Grouped account type cards */}
        {loading ? (
          <div className="text-center py-20 text-gray-400">
            Loading trial balance...
          </div>
        ) : Object.keys(groupedAccounts).every(
            (k) => groupedAccounts[k].length === 0
          ) ? (
          <div className="text-center py-20 text-gray-400">
            No accounts found for the selected criteria.
          </div>
        ) : (
          <div className="space-y-4">
            {Object.keys(groupedAccounts).map((type) => {
              const accounts = groupedAccounts[type];
              if (accounts.length === 0) return null;
              const totals = typeTotals[type];
              const expanded = expandedSections[type];

              return (
                <Card
                  key={type}
                  className="shadow-sm border-gray-200 overflow-hidden"
                >
                  <div
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => toggleSection(type)}
                  >
                    <div className="flex items-center gap-3">
                      {expanded ? (
                        <ChevronDown className="h-5 w-5 text-gray-500" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-500" />
                      )}
                      <div>
                        <h3 className="font-semibold text-gray-900 uppercase text-sm">
                          {type}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {accounts.length} accounts
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm text-gray-500">
                          Dr {formatTaka(totals.debit)} · Cr{" "}
                          {formatTaka(totals.credit)}
                        </div>
                        <p
                          className={cn(
                            "text-sm font-semibold",
                            totals.net >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          )}
                        >
                          Net {formatTaka(totals.net)}
                        </p>
                      </div>
                      <Badge
                        className={cn(
                          "text-xs font-medium",
                          totals.net >= 0
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-red-50 text-red-700 border-red-200"
                        )}
                      >
                        {totals.net >= 0 ? "CR Balance" : "DR Balance"}
                      </Badge>
                    </div>
                  </div>

                  {expanded && (
                    <div className="border-t">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50 hover:bg-gray-50">
                            <TableHead className="w-[60%]">Account</TableHead>
                            <TableHead className="text-right">
                              Debit
                            </TableHead>
                            <TableHead className="text-right">
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
                                className="hover:bg-gray-50/50 transition-colors"
                              >
                                <TableCell
                                  style={{
                                    paddingLeft: `${acc.depth * 16 + 20}px`,
                                  }}
                                >
                                  <span className="font-mono text-sm">
                                    {acc.code}
                                  </span>{" "}
                                  —{" "}
                                  <span className="text-sm">{acc.name}</span>
                                </TableCell>
                                <TableCell className="text-right text-sm text-green-700">
                                  {closing > 0
                                    ? formatTaka(closing)
                                    : ""}
                                </TableCell>
                                <TableCell className="text-right text-sm text-red-700">
                                  {closing < 0
                                    ? formatTaka(Math.abs(closing))
                                    : ""}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

/* ---------- Sidebar Tree List (recursive) ---------- */
function AccountTreeList({
  nodes,
  depth,
  searchTerm,
  typeFilter,
}: {
  nodes: AccountNode[];
  depth: number;
  searchTerm: string;
  typeFilter: string;
}) {
  return (
    <>
      {nodes.map((node) => {
        const hasChildren = node.children && node.children.length > 0;
        const closing = node.closingBalance ?? 0;
        const matchesSearch =
          !searchTerm ||
          node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          node.code.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType =
          typeFilter === "all" || node.type === typeFilter;
        if (!matchesSearch || !matchesType) return null;

        return (
          <React.Fragment key={node._id}>
            <div
              className="flex items-center justify-between py-1 px-2 rounded hover:bg-gray-50 cursor-default text-sm"
              style={{ paddingLeft: `${depth * 16 + 8}px` }}
            >
              <span className="truncate flex items-center gap-1">
                {hasChildren && (
                  <ChevronRight className="h-3 w-3 text-gray-400 shrink-0" />
                )}
                <span className="font-mono text-xs text-gray-500">
                  {node.code}
                </span>
                <span className="ml-1">{node.name}</span>
              </span>
              <span
                className={cn(
                  "text-xs font-mono",
                  closing >= 0 ? "text-gray-700" : "text-red-600"
                )}
              >
                {formatTaka(closing)}
              </span>
            </div>
            {hasChildren && (
              <AccountTreeList
                nodes={node.children!}
                depth={depth + 1}
                searchTerm={searchTerm}
                typeFilter={typeFilter}
              />
            )}
          </React.Fragment>
        );
      })}
    </>
  );
}