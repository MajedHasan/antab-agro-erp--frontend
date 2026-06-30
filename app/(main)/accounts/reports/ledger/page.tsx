// app/ledger/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { format } from "date-fns";
import api from "@/lib/api";
import { toast } from "sonner";

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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  Download,
  Filter,
  Calendar,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Eye,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle,
  Clock,
  XCircle,
  FileText,
  Layers,
  Wallet,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowUp,
  ArrowDown,
  Printer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import GlobalPrintButton from "@/components/common/print/GlobalPrintButton";

/* ---------- types ---------- */
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

type Transaction = {
  id: string;
  entryId: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  date: string;
  description: string;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
  journalEntry: {
    id: string;
    entryNumber: string;
    date: string;
    description: string;
    reference: string;
    status: string;
    createdBy: string;
    createdAt: string;
  };
  type: string;
};

type LedgerSummary = {
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  transactionCount: number;
  avgTransaction: number;
};

/* ---------- helpers ---------- */
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

function statusBadge(status: string) {
  if (status === "Approved")
    return (
      <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200">
        Approved
      </Badge>
    );
  if (status === "Pending")
    return (
      <Badge className="bg-amber-50 text-amber-700 border border-amber-200">
        Pending
      </Badge>
    );
  if (status === "Rejected")
    return <Badge variant="destructive">Rejected</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

/* ---------- Account Tree Item (with expand/collapse icons) ---------- */
function AccountTreeItem({
  node,
  depth,
  selectedId,
  onSelect,
  searchTerm,
}: {
  node: AccountNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  searchTerm: string;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  const balance = node.closingBalance ?? 0;

  const matchesSearch =
    !searchTerm ||
    node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    node.code.toLowerCase().includes(searchTerm.toLowerCase());

  if (!matchesSearch && !hasChildren) return null;

  return (
    <div>
      <div
        className={cn(
          "flex items-center justify-between py-1.5 px-2 rounded cursor-pointer transition-colors",
          selectedId === node._id
            ? "bg-gray-100 font-medium"
            : "hover:bg-gray-50"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => {
          if (hasChildren) setExpanded(!expanded);
          onSelect(node._id);
        }}
      >
        <div className="flex items-center gap-1 min-w-0">
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            )
          ) : (
            <span className="w-3.5 shrink-0" />
          )}
          <span className="text-xs font-mono text-gray-500 mr-2 shrink-0">
            {node.code}
          </span>
          <span className="text-sm truncate">{node.name}</span>
        </div>
        <span
          className={cn(
            "text-xs font-mono shrink-0 ml-2",
            balance >= 0 ? "text-gray-700" : "text-red-600"
          )}
        >
          {formatTaka(balance)}
        </span>
      </div>
      {expanded &&
        hasChildren &&
        node.children!.map((child) => (
          <AccountTreeItem
            key={child._id}
            node={child}
            depth={depth + 1}
            selectedId={selectedId}
            onSelect={onSelect}
            searchTerm={searchTerm}
          />
        ))}
    </div>
  );
}

/* ---------- Main Page ---------- */
export default function LedgerPage() {
  // Sidebar collapse
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Date range
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  });

  // Account tree
  const [tree, setTree] = useState<AccountNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    null
  );
  const [accountSearch, setAccountSearch] = useState("");
  const [accountTypeFilter, setAccountTypeFilter] = useState<string>("all");
  const [expandAll, setExpandAll] = useState(false); // we'll use this to force expand

  // Selected account details
  const selectedAccount = useMemo(() => {
    const flat = flattenTree(tree);
    return flat.find((a) => a._id === selectedAccountId) || null;
  }, [tree, selectedAccountId]);

  // Transactions
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txTotal, setTxTotal] = useState(0);
  const [txPage, setTxPage] = useState(1);
  const [txLimit, setTxLimit] = useState(25);
  const [txSortBy, setTxSortBy] = useState("date");
  const [txSortDir, setTxSortDir] = useState<"asc" | "desc">("desc");
  const [txSearch, setTxSearch] = useState("");
  const [txTypeFilter, setTxTypeFilter] = useState("all");
  const [txStatusFilter, setTxStatusFilter] = useState("all");

  // Summary
  const [summary, setSummary] = useState<LedgerSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Detail modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  // Flatten helper
  function flattenTree(nodes: AccountNode[]): AccountNode[] {
    let flat: AccountNode[] = [];
    for (const n of nodes) {
      flat.push(n);
      if (n.children) flat = flat.concat(flattenTree(n.children));
    }
    return flat;
  }

  // Fetch account tree with balances
  const fetchTree = useCallback(async () => {
    setTreeLoading(true);
    try {
      const params: any = {};
      if (dateRange?.from) params.from = dateRange.from.toISOString();
      if (dateRange?.to) params.to = dateRange.to.toISOString();
      const res = await api.get("/accounts/tree", { params });
      const data = res?.data?.data ?? [];
      setTree(data);
      if (!selectedAccountId && data.length > 0) {
        const flat = flattenTree(data);
        const first = flat.find((a) => a._id);
        if (first) setSelectedAccountId(first._id);
      }
    } catch (err) {
      toast.error("Failed to load chart of accounts");
    } finally {
      setTreeLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  // Filter tree by type and search
  const filteredTree = useMemo(() => {
    const filter = (nodes: AccountNode[]): AccountNode[] => {
      return nodes
        .map((node) => {
          const children = node.children ? filter(node.children) : [];
          const matchesType =
            accountTypeFilter === "all" || node.type === accountTypeFilter;
          const matchesSearch =
            !accountSearch ||
            node.name
              .toLowerCase()
              .includes(accountSearch.toLowerCase()) ||
            node.code
              .toLowerCase()
              .includes(accountSearch.toLowerCase());
          if (children.length > 0 || (matchesType && matchesSearch))
            return {
              ...node,
              children: children.length > 0 ? children : undefined,
            };
          return null;
        })
        .filter(Boolean) as AccountNode[];
    };
    return filter(tree);
  }, [tree, accountTypeFilter, accountSearch]);

  // Fetch transactions for selected account
  const fetchTransactions = useCallback(async () => {
    if (!selectedAccountId) return;
    setTxLoading(true);
    try {
      const params: any = {
        limit: txLimit,
        skip: (txPage - 1) * txLimit,
        sortBy: txSortBy,
        sortDir: txSortDir,
        q: txSearch || undefined,
        type: txTypeFilter !== "all" ? txTypeFilter : undefined,
        status: txStatusFilter !== "all" ? txStatusFilter : undefined,
        from: dateRange?.from?.toISOString(),
        to: dateRange?.to?.toISOString(),
      };
      const res = await api.get(
        `/ledger/${selectedAccountId}/transactions`,
        { params }
      );
      const data = res?.data?.data;
      setTransactions(data?.transactions ?? []);
      setTxTotal(data?.meta?.total ?? 0);
    } catch (err) {
      toast.error("Failed to load transactions");
    } finally {
      setTxLoading(false);
    }
  }, [
    selectedAccountId,
    txPage,
    txLimit,
    txSortBy,
    txSortDir,
    txSearch,
    txTypeFilter,
    txStatusFilter,
    dateRange,
  ]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Fetch summary
  const fetchSummary = useCallback(async () => {
    if (!selectedAccountId) return;
    setSummaryLoading(true);
    try {
      const params: any = {};
      if (dateRange?.from) params.from = dateRange.from.toISOString();
      if (dateRange?.to) params.to = dateRange.to.toISOString();
      const res = await api.get(
        `/ledger/${selectedAccountId}/summary`,
        { params }
      );
      const data = res?.data?.data;
      if (data) {
        setSummary({
          openingBalance: data.openingBalance || 0,
          totalDebit: data.totalDebit || 0,
          totalCredit: data.totalCredit || 0,
          closingBalance: data.closingBalance || 0,
          transactionCount: data.transactionCount || 0,
          avgTransaction: data.avgTransaction || 0,
        });
      }
    } catch (err) {
      toast.error("Failed to load summary");
    } finally {
      setSummaryLoading(false);
    }
  }, [selectedAccountId, dateRange]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const exportCSV = () => {
    if (transactions.length === 0) return toast.error("No data");
    const headers = [
      "Date",
      "Reference",
      "Description",
      "Debit",
      "Credit",
      "Balance",
      "Status",
    ];
    const rows = transactions.map((t) => [
      format(new Date(t.date), "yyyy-MM-dd"),
      t.reference,
      t.description,
      t.debit.toFixed(2),
      t.credit.toFixed(2),
      t.balance.toFixed(2),
      t.journalEntry.status,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ledger-${selectedAccount?.code || "account"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalTxPages = Math.max(1, Math.ceil(txTotal / txLimit));

  // Print content for modal transaction
  const printContentForTx = useMemo(() => {
    if (!selectedTx) return "";
    // Build a simple mini voucher HTML
    const linesHtml = `
      <tr>
        <td>${selectedTx.description}</td>
        <td style="text-align:right;">${selectedTx.debit > 0 ? formatTaka(selectedTx.debit) : ""}</td>
        <td style="text-align:right;">${selectedTx.credit > 0 ? formatTaka(selectedTx.credit) : ""}</td>
      </tr>
    `;
    return `
      <div style="font-family:Arial; font-size:12px; border:2px solid #000; padding:16px;">
        <div style="font-size:18px; font-weight:bold; margin-bottom:12px;">Transaction Voucher</div>
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
          <div><strong>Reference:</strong> ${selectedTx.reference}</div>
          <div><strong>Date:</strong> ${format(new Date(selectedTx.date), "PPP")}</div>
        </div>
        <table style="width:100%; border-collapse:collapse; margin-bottom:8px;">
          <thead>
            <tr style="background:#f0f0f0;">
              <th style="text-align:left; padding:4px;">Description</th>
              <th style="text-align:right; padding:4px;">Debit</th>
              <th style="text-align:right; padding:4px;">Credit</th>
            </tr>
          </thead>
          <tbody>${linesHtml}</tbody>
          <tfoot>
            <tr style="font-weight:bold;">
              <td style="text-align:right; padding:4px;">Total</td>
              <td style="text-align:right; padding:4px;">${formatTaka(selectedTx.debit)}</td>
              <td style="text-align:right; padding:4px;">${formatTaka(selectedTx.credit)}</td>
            </tr>
          </tfoot>
        </table>
        <div><strong>Journal:</strong> ${selectedTx.journalEntry.entryNumber}</div>
        <div><strong>Status:</strong> ${selectedTx.journalEntry.status}</div>
      </div>
    `;
  }, [selectedTx]);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside
        className={cn(
          "border-r bg-white flex flex-col shrink-0 transition-all duration-300",
          sidebarOpen ? "w-80" : "w-0 overflow-hidden"
        )}
      >
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Layers className="h-5 w-5 text-gray-600" />
            Accounts
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
              value={accountSearch}
              onChange={(e) => setAccountSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <Select
            value={accountTypeFilter}
            onValueChange={setAccountTypeFilter}
          >
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpandAll((prev) => !prev)}
            className="text-xs"
          >
            {expandAll ? "Collapse All" : "Expand All"}
          </Button>
        </div>
        <div className="flex-1 overflow-auto p-2">
          {treeLoading ? (
            <div className="text-center py-10 text-gray-400">Loading...</div>
          ) : filteredTree.length === 0 ? (
            <div className="text-center py-10 text-gray-400">No accounts</div>
          ) : (
            filteredTree.map((node) => (
              <AccountTreeItem
                key={node._id}
                node={node}
                depth={0}
                selectedId={selectedAccountId}
                onSelect={setSelectedAccountId}
                searchTerm={accountSearch}
              />
            ))
          )}
        </div>
      </aside>

      {/* Main Content */}
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
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Wallet className="h-6 w-6 text-gray-700" />
                {selectedAccount?.name || "Select an Account"}
              </h1>
              {selectedAccount && (
                <p className="text-sm text-gray-500 mt-1">
                  {selectedAccount.code} · {selectedAccount.type}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
          </div>
        </div>

        {/* Date Range & Summary */}
        <Card className="shadow-sm border-gray-200 mb-5">
          <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
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
                Clear
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
            </div>
            <div className="text-sm text-gray-500">
              {txTotal} transaction{txTotal !== 1 && "s"}
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        {selectedAccount && summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            <div className="bg-white rounded-lg shadow-sm p-4 text-center border">
              <div className="text-xs text-gray-500">Opening</div>
              <div className="text-lg font-semibold mt-1">
                {formatTaka(summary.openingBalance)}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 text-center border border-green-100">
              <div className="text-xs text-green-700">Total Debit</div>
              <div className="text-lg font-semibold text-green-700 mt-1">
                {formatTaka(summary.totalDebit)}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 text-center border border-red-100">
              <div className="text-xs text-red-700">Total Credit</div>
              <div className="text-lg font-semibold text-red-700 mt-1">
                {formatTaka(summary.totalCredit)}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 text-center border">
              <div className="text-xs text-gray-500">Closing</div>
              <div className="text-lg font-semibold mt-1">
                {formatTaka(summary.closingBalance)}
              </div>
            </div>
          </div>
        )}

        {/* Transaction Filters */}
        <Card className="shadow-sm border-gray-200 mb-5">
          <CardContent className="p-3 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search transactions..."
                value={txSearch}
                onChange={(e) => {
                  setTxSearch(e.target.value);
                  setTxPage(1);
                }}
                className="pl-9 h-9"
              />
            </div>
            <Select
              value={txTypeFilter}
              onValueChange={(v) => {
                setTxTypeFilter(v);
                setTxPage(1);
              }}
            >
              <SelectTrigger className="w-40 h-9">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="BankReceive">Bank Receive</SelectItem>
                <SelectItem value="CashReceive">Cash Receive</SelectItem>
                <SelectItem value="BankPayment">Bank Payment</SelectItem>
                <SelectItem value="CashPayment">Cash Payment</SelectItem>
                <SelectItem value="Journal">Journal</SelectItem>
                <SelectItem value="Contra">Contra</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={txStatusFilter}
              onValueChange={(v) => {
                setTxStatusFilter(v);
                setTxPage(1);
              }}
            >
              <SelectTrigger className="w-40 h-9">
                <SelectValue placeholder="All status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setTxSearch("");
                setTxTypeFilter("all");
                setTxStatusFilter("all");
                setTxPage(1);
              }}
            >
              <Filter className="h-4 w-4 mr-1" /> Clear
            </Button>
          </CardContent>
        </Card>

        {/* Transactions Table */}
        <Card className="shadow-sm border-gray-200 overflow-hidden">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 hover:bg-gray-50">
                  <TableHead className="w-[100px]">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-0 font-medium"
                      onClick={() => {
                        setTxSortBy("date");
                        setTxSortDir((d) =>
                          d === "asc" ? "desc" : "asc"
                        );
                      }}
                    >
                      Date
                      {txSortBy === "date" &&
                        (txSortDir === "asc" ? (
                          <ArrowUp className="ml-1 h-3 w-3" />
                        ) : (
                          <ArrowDown className="ml-1 h-3 w-3" />
                        ))}
                    </Button>
                  </TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {txLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-gray-500">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-gray-500">
                      No transactions found.
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((tx) => (
                    <TableRow
                      key={tx.id}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <TableCell className="text-sm font-medium">
                        {format(new Date(tx.date), "dd MMM yy")}
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {tx.reference}
                      </TableCell>
                      <TableCell className="text-sm max-w-[250px] truncate">
                        {tx.description}
                      </TableCell>
                      <TableCell className="text-right text-sm text-green-700">
                        {tx.debit > 0 ? formatTaka(tx.debit) : ""}
                      </TableCell>
                      <TableCell className="text-right text-sm text-red-700">
                        {tx.credit > 0 ? formatTaka(tx.credit) : ""}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {formatTaka(tx.balance)}
                      </TableCell>
                      <TableCell>{statusBadge(tx.journalEntry.status)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedTx(tx);
                            setDetailOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {txTotal > 0 && (
            <div className="flex items-center justify-between p-4 border-t bg-gray-50/50">
              <div className="text-sm text-gray-600">
                Page {txPage} of {totalTxPages} ({txTotal} records)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTxPage(1)}
                  disabled={txPage === 1}
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                  disabled={txPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium px-2">{txPage}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setTxPage((p) => Math.min(totalTxPages, p + 1))
                  }
                  disabled={txPage === totalTxPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTxPage(totalTxPages)}
                  disabled={txPage === totalTxPages}
                >
                  Last
                </Button>
                <Select
                  value={String(txLimit)}
                  onValueChange={(v) => {
                    setTxLimit(Number(v));
                    setTxPage(1);
                  }}
                >
                  <SelectTrigger className="w-20 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </Card>

        {/* Detail Modal (enhanced) */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>Transaction Detail</span>
                {selectedTx && (
                  <GlobalPrintButton
                    contentHtml={printContentForTx}
                    label="Print"
                    title="Transaction Voucher"
                    company={{
                      name: "Antab Agro LTD",
                      address: "123 Agro Street, Dhaka",
                      phone: "+880 1711-111111",
                      email: "info@antabagro.com",
                    }}
                    showHeader={false}
                    showFooter={false}
                    watermarkSize="200px"
                    watermarkRotate="-30"
                  />
                )}
              </DialogTitle>
              <DialogDescription>
                {selectedTx?.reference} — {selectedTx?.journalEntry?.entryNumber}
              </DialogDescription>
            </DialogHeader>
            {selectedTx && (
              <div className="space-y-4">
                {/* Key figures */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500">Debit</div>
                    <div className="text-lg font-semibold text-green-700">
                      {formatTaka(selectedTx.debit)}
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500">Credit</div>
                    <div className="text-lg font-semibold text-red-700">
                      {formatTaka(selectedTx.credit)}
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500">Balance</div>
                    <div className="text-lg font-semibold">
                      {formatTaka(selectedTx.balance)}
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Date:</span>{" "}
                    {format(new Date(selectedTx.date), "PPP")}
                  </div>
                  <div>
                    <span className="text-gray-500">Type:</span> {selectedTx.type}
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Description:</span>{" "}
                    {selectedTx.description}
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Journal Entry:</span>{" "}
                    {selectedTx.journalEntry.entryNumber}
                  </div>
                  <div>
                    <span className="text-gray-500">Status:</span>{" "}
                    {statusBadge(selectedTx.journalEntry.status)}
                  </div>
                  <div>
                    <span className="text-gray-500">Created by:</span>{" "}
                    {selectedTx.journalEntry.createdBy}
                  </div>
                  <div>
                    <span className="text-gray-500">Created at:</span>{" "}
                    {format(new Date(selectedTx.journalEntry.createdAt), "PPp")}
                  </div>
                </div>

                {selectedTx.journalEntry.description && (
                  <>
                    <Separator />
                    <div className="text-sm">
                      <span className="text-gray-500">
                        Journal Description:
                      </span>{" "}
                      {selectedTx.journalEntry.description}
                    </div>
                  </>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDetailOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}