// app/ledger/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  Download,
  Filter,
  Calendar,
  ChevronDown,
  ChevronUp,
  FileText,
  Receipt,
  CreditCard,
  Building,
  User,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  MoreVertical,
  Eye,
  FileEdit,
  Trash2,
  RefreshCw,
  Printer,
  Mail,
  TrendingUp,
  TrendingDown,
  Plus,
  Minus,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateRange } from "react-day-picker";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import api from "@/lib/api";

/* ---------------- Types ---------------- */

interface Account {
  id: string;
  code: string;
  name: string;
  type: "Asset" | "Liability" | "Equity" | "Revenue" | "Expense";
  category: string;
  balance: number;
  currency?: string;
  description?: string;
}

interface JournalEntry {
  id: string;
  entryNumber: string;
  date: string | Date;
  description: string;
  reference: string;
  status: "Posted" | "Draft" | "Void";
  createdBy: string;
  createdAt: string | Date;
}

interface LedgerTransaction {
  id: string;
  entryId: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  date: string | Date;
  description: string;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
  journalEntry: JournalEntry;
  type:
    | "Invoice"
    | "Payment"
    | "Journal"
    | "Adjustment"
    | "Expense"
    | "Receipt"
    | "Purchase"
    | string;
  contactName?: string;
  contactType?: "Customer" | "Vendor" | "Employee" | "Bank" | string;
}

interface LedgerSummary {
  account: Account | null;
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  transactionCount: number;
  avgTransaction: number;
}

/* ---------------- Helpers (UI-only) ---------------- */

function getTransactionTypeConfig(type: LedgerTransaction["type"]) {
  const configs: Record<string, any> = {
    Invoice: {
      color: "bg-green-50 dark:bg-green-950/30 border-l-4 border-l-green-500",
      badge:
        "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300",
      icon: Receipt,
      label: "Invoice",
    },
    Payment: {
      color: "bg-blue-50 dark:bg-blue-950/30 border-l-4 border-l-blue-500",
      badge: "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300",
      icon: CreditCard,
      label: "Payment",
    },
    Journal: {
      color:
        "bg-purple-50 dark:bg-purple-950/30 border-l-4 border-l-purple-500",
      badge:
        "bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300",
      icon: FileText,
      label: "Journal",
    },
    Adjustment: {
      color: "bg-amber-50 dark:bg-amber-950/30 border-l-4 border-l-amber-500",
      badge:
        "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300",
      icon: RefreshCw,
      label: "Adjustment",
    },
    Expense: {
      color: "bg-red-50 dark:bg-red-950/30 border-l-4 border-l-red-500",
      badge: "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300",
      icon: DollarSign,
      label: "Expense",
    },
    Receipt: {
      color:
        "bg-emerald-50 dark:bg-emerald-950/30 border-l-4 border-l-emerald-500",
      badge:
        "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300",
      icon: CheckCircle,
      label: "Receipt",
    },
    Purchase: {
      color:
        "bg-indigo-50 dark:bg-indigo-950/30 border-l-4 border-l-indigo-500",
      badge:
        "bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300",
      icon: Building,
      label: "Purchase",
    },
  };
  return configs[type] || configs.Journal;
}

function getAccountTypeColor(type: Account["type"]) {
  const colors: Record<Account["type"], string> = {
    Asset: "text-blue-600 dark:text-blue-400",
    Liability: "text-red-600 dark:text-red-400",
    Equity: "text-purple-600 dark:text-purple-400",
    Revenue: "text-green-600 dark:text-green-400",
    Expense: "text-amber-600 dark:text-amber-400",
  };
  return colors[type];
}

function getStatusIcon(status: JournalEntry["status"]) {
  switch (status) {
    case "Posted":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "Draft":
      return <Clock className="h-4 w-4 text-amber-500" />;
    case "Void":
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return null;
  }
}

/* ---------------- Component ---------------- */

export default function LedgerPage() {
  // Accounts list from API
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);

  // Selected account
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

  // Transactions returned from API (already filtered server-side)
  const [filteredTransactions, setFilteredTransactions] = useState<
    LedgerTransaction[]
  >([]);

  // Summary (opening/period/closing)
  const [ledgerSummary, setLedgerSummary] = useState<LedgerSummary | null>(
    null,
  );

  // UI state / filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  });

  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] =
    useState<LedgerTransaction | null>(null);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

  const [sortConfig, setSortConfig] = useState<{
    key: keyof LedgerTransaction;
    direction: "asc" | "desc";
  }>({ key: "date", direction: "desc" });

  const [loadingTransactions, setLoadingTransactions] = useState(false);

  /* ------------------ Fetch Accounts ------------------ */
  useEffect(() => {
    let mounted = true;
    setAccountsLoading(true);
    api
      .get("/ledger/accounts")
      .then((res) => {
        if (!mounted) return;
        const list: any[] = res?.data?.data ?? [];
        // Normalize to Account type expected by UI
        const normalized: Account[] = list.map((a) => ({
          id: String(a._id ?? a.id ?? a.id),
          code: a.code ?? "",
          name: a.name ?? a.title ?? "Unnamed",
          type: a.type,
          category: a.category ?? "",
          balance:
            typeof a.balance === "number"
              ? a.balance
              : Number(a.openingBalance ?? 0),
          currency: a.currency ?? "USD",
          description: a.description ?? a.note ?? "",
        }));
        setAccounts(normalized);
        if (normalized.length > 0 && !selectedAccount) {
          setSelectedAccount(normalized[0]);
        }
      })
      .catch((err) => {
        console.error("Failed to load accounts:", err);
        // keep demo fallback? we keep empty and show message
        alert("Failed to load accounts. Check console.");
      })
      .finally(() => {
        if (mounted) setAccountsLoading(false);
      });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------ Helper: format currency ------------------ */
  const formatCurrency = (amount: number) => {
    const currency = selectedAccount?.currency ?? "USD";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  /* ------------------ Fetch transactions (server-side filtering) ------------------ */
  useEffect(() => {
    // Whenever selectedAccount or filters change, fetch transactions from backend
    if (!selectedAccount) {
      setFilteredTransactions([]);
      setLedgerSummary(null);
      return;
    }

    let mounted = true;
    const fetchData = async () => {
      setLoadingTransactions(true);
      try {
        // Build params
        const params: any = {
          limit: 1000,
        };
        if (dateRange?.from) params.from = dateRange.from.toISOString();
        if (dateRange?.to) params.to = dateRange.to.toISOString();
        if (filterType && filterType !== "all") params.type = filterType;
        if (filterStatus && filterStatus !== "all")
          params.status = filterStatus;
        if (searchTerm) params.search = searchTerm;
        if (sortConfig?.key) {
          params.sortBy = sortConfig.key;
          params.sortDir = sortConfig.direction;
        }

        // Transactions endpoint
        const txRes = await api.get(
          `/ledger/${encodeURIComponent(selectedAccount.id)}/transactions`,
          { params },
        );
        const txData = txRes?.data?.data ?? txRes?.data ?? null;
        // Expect object: { transactions: [...], meta: {...}, totals: {...} }
        const txsRaw: any[] = txData?.transactions ?? [];

        // Convert date strings to Date
        const txs: LedgerTransaction[] = txsRaw.map((t: any) => ({
          ...t,
          date: t.date ? new Date(t.date) : new Date(),
          journalEntry: {
            ...t.journalEntry,
            date: t.journalEntry?.date
              ? new Date(t.journalEntry.date)
              : new Date(),
            createdAt: t.journalEntry?.createdAt
              ? new Date(t.journalEntry.createdAt)
              : new Date(),
          },
        }));

        if (mounted) setFilteredTransactions(txs);
      } catch (err) {
        console.error("Failed to load transactions:", err);
        alert("Failed to load transactions. Check console.");
      } finally {
        if (mounted) setLoadingTransactions(false);
      }
    };

    fetchData();

    return () => {
      mounted = false;
    };
    // include dependencies for filters
  }, [
    selectedAccount,
    dateRange,
    filterType,
    filterStatus,
    searchTerm,
    sortConfig,
  ]);

  /* ------------------ Fetch ledger summary ------------------ */
  useEffect(() => {
    if (!selectedAccount) {
      setLedgerSummary(null);
      return;
    }

    let mounted = true;
    const fetchSummary = async () => {
      try {
        const params: any = {};
        if (dateRange?.from) params.from = dateRange.from.toISOString();
        if (dateRange?.to) params.to = dateRange.to.toISOString();

        const res = await api.get(
          `/ledger/${encodeURIComponent(selectedAccount.id)}/summary`,
          { params },
        );
        const data = res?.data?.data ?? null;
        if (!mounted) return;

        if (data) {
          // Data shape from backend:
          // { account, openingBalance, totalDebit, totalCredit, closingBalance, transactionCount, avgTransaction }
          const accountObj = data.account
            ? {
                id: String(data.account._id ?? data.account.id),
                code: data.account.code ?? "",
                name: data.account.name ?? "",
                type: data.account.type,
                category: data.account.category ?? "",
                balance:
                  typeof data.account.balance === "number"
                    ? data.account.balance
                    : Number(data.account.openingBalance ?? 0),
                currency: data.account.currency ?? selectedAccount.currency,
                description: data.account.description ?? "",
              }
            : selectedAccount;

          setLedgerSummary({
            account: accountObj,
            openingBalance: Number(data.openingBalance || 0),
            totalDebit: Number(data.totalDebit || 0),
            totalCredit: Number(data.totalCredit || 0),
            closingBalance: Number(data.closingBalance || 0),
            transactionCount: Number(data.transactionCount || 0),
            avgTransaction: Number(data.avgTransaction || 0),
          });
        } else {
          setLedgerSummary(null);
        }
      } catch (err) {
        console.error("Failed to load ledger summary:", err);
        // don't annoy user every time; show console
      }
    };

    fetchSummary();

    return () => {
      mounted = false;
    };
  }, [selectedAccount, dateRange]);

  /* ------------------ Sorting ------------------ */
  const handleSort = (key: keyof LedgerTransaction) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  /* ------------------ Row rendering & helpers ------------------ */

  // Get contact icon
  const getContactIcon = (transaction: LedgerTransaction) => {
    if (!transaction.contactType) return null;

    const icons: any = {
      Customer: User,
      Vendor: Building,
      Employee: User,
      Bank: Building,
    };
    const Icon = icons[transaction.contactType] ?? User;
    return <Icon className="h-3.5 w-3.5" />;
  };

  // Sort icon component
  const SortIcon = ({ columnKey }: { columnKey: keyof LedgerTransaction }) => {
    if (sortConfig.key !== columnKey) {
      return <ChevronDown className="h-3 w-3 opacity-30" />;
    }
    return sortConfig.direction === "asc" ? (
      <ChevronUp className="h-3 w-3" />
    ) : (
      <ChevronDown className="h-3 w-3" />
    );
  };

  // Open transaction detail
  const openDetailDialog = (transaction: LedgerTransaction) => {
    setSelectedTransaction(transaction);
    setIsDetailDialogOpen(true);
  };

  // Render transaction row
  const renderTransactionRow = (transaction: LedgerTransaction) => {
    const typeConfig = getTransactionTypeConfig(transaction.type);
    const TypeIcon = typeConfig.icon;

    const txDate =
      transaction.date instanceof Date
        ? transaction.date
        : new Date(transaction.date);

    return (
      <tr
        key={transaction.id}
        className={`hover:bg-accent/50 transition-colors duration-150 ${typeConfig.color}`}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-white dark:bg-gray-800 border">
              <TypeIcon className="h-3.5 w-3.5" />
            </div>
            <div>
              <div className="font-medium text-sm">{transaction.reference}</div>
              <div className="text-xs text-muted-foreground">
                {transaction.journalEntry?.entryNumber}
              </div>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="text-sm font-medium">
            {format(txDate, "MMM dd, yyyy")}
          </div>
          <div className="text-xs text-muted-foreground">
            {format(txDate, "EEE")}
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="max-w-xs">
            <div className="text-sm font-medium">{transaction.description}</div>
            {transaction.contactName && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                {getContactIcon(transaction)}
                <span>{transaction.contactName}</span>
              </div>
            )}
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="max-w-xs">
            <div className="text-sm font-medium">{transaction?.source}</div>
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="max-w-xs">
            <div className="text-sm font-medium">{transaction?.mode}</div>
          </div>
        </td>
        <td className="px-4 py-3 text-right">
          {transaction.debit > 0 && (
            <div className="flex items-center justify-end gap-1">
              <ArrowUpRight className="h-3.5 w-3.5 text-green-600" />
              <div className="text-green-600 dark:text-green-400 font-mono font-medium">
                {formatCurrency(transaction.debit)}
              </div>
            </div>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          {transaction.credit > 0 && (
            <div className="flex items-center justify-end gap-1">
              <ArrowDownRight className="h-3.5 w-3.5 text-red-600" />
              <div className="text-red-600 dark:text-red-400 font-mono font-medium">
                {formatCurrency(transaction.credit)}
              </div>
            </div>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="font-mono font-medium">
            {formatCurrency(transaction.balance)}
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {getStatusIcon(transaction.journalEntry.status)}
            <Badge
              variant={
                transaction.journalEntry.status === "Posted"
                  ? "default"
                  : transaction.journalEntry.status === "Draft"
                    ? "secondary"
                    : "destructive"
              }
              className="text-xs"
            >
              {transaction.journalEntry.status}
            </Badge>
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openDetailDialog(transaction)}
              className="h-7 w-7 p-0"
              title="View Details"
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openDetailDialog(transaction)}>
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <FileEdit className="mr-2 h-4 w-4" />
                  Edit Entry
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Void Transaction
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </td>
      </tr>
    );
  };

  /* ------------------ Exports & helpers ------------------ */

  function exportServerCsv() {
    // You can implement server export later; for now reuse client-side rows
    const rows = filteredTransactions;
    const header = [
      "Reference",
      "Date",
      "Description",
      "Debit",
      "Credit",
      "Balance",
    ];
    const lines = [header.join(",")];
    for (const r of rows) {
      const dateStr =
        r.date instanceof Date ? r.date.toISOString() : String(r.date);
      lines.push(
        [
          `"${r.reference}"`,
          dateStr,
          `"${(r.description || "").replace(/"/g, '""')}"`,
          r.debit.toFixed(2),
          r.credit.toFixed(2),
          r.balance.toFixed(2),
        ].join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ledger-${selectedAccount?.code || "account"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Copy totals (using ledgerSummary if available)
  async function copyTotals() {
    if (!ledgerSummary) {
      alert("No ledger summary to copy");
      return;
    }
    const text = `Opening: ${formatCurrency(ledgerSummary.openingBalance)}
Total Debit: ${formatCurrency(ledgerSummary.totalDebit)}
Total Credit: ${formatCurrency(ledgerSummary.totalCredit)}
Closing: ${formatCurrency(ledgerSummary.closingBalance)}`;
    await navigator.clipboard.writeText(text);
    alert("Totals copied to clipboard");
  }

  // Simple export handler wrapper
  const handleExport = (format: "pdf" | "excel" | "csv") => {
    if (format === "csv") exportServerCsv();
    else alert(`Export ${format} not implemented in demo`);
    setIsExportDialogOpen(false);
  };

  /* ------------------ Render (UI kept as original) ------------------ */

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-full mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              General Ledger
            </h1>
            <p className="text-muted-foreground mt-1">
              Track all accounting transactions with running balances and
              detailed reporting
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setIsExportDialogOpen(true)}
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4" />
              Print
            </Button>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Transaction
            </Button>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Account Selector */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Select Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                value={selectedAccount?.id ?? ""}
                onValueChange={(value) => {
                  const account = accounts.find((a) => a.id === value);
                  if (account) setSelectedAccount(account);
                }}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      accountsLoading ? "Loading..." : "Select an account"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex items-center justify-between w-full">
                        <div className="flex-1">
                          <div className="font-medium">
                            {account.code} - {account.name}
                          </div>
                          <div
                            className={`text-xs ${getAccountTypeColor(
                              account.type,
                            )}`}
                          >
                            {account.type}
                          </div>
                        </div>
                        <div className="font-mono text-sm">
                          {formatCurrency(account.balance)}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Selected Account Info */}
              <div className="space-y-3 pt-4 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Account Code
                  </span>
                  <span className="font-semibold">
                    {selectedAccount?.code ?? "-"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Account Type
                  </span>
                  <Badge
                    variant="outline"
                    className={
                      selectedAccount
                        ? getAccountTypeColor(selectedAccount.type)
                        : ""
                    }
                  >
                    {selectedAccount?.type ?? "-"}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Category
                  </span>
                  <span className="text-sm">
                    {selectedAccount?.category ?? "-"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Current Balance
                  </span>
                  <span className="font-mono font-semibold">
                    {selectedAccount
                      ? formatCurrency(selectedAccount.balance)
                      : "-"}
                  </span>
                </div>
                {selectedAccount?.description && (
                  <div className="pt-2 text-sm text-muted-foreground border-t">
                    {selectedAccount.description}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Right Column - Date Range and Summary */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Date Range & Summary</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Date Range Picker */}
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateRange && "text-muted-foreground",
                        )}
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
                          <span>Select date range</span>
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
                </div>
                <Button
                  variant="outline"
                  onClick={() =>
                    setDateRange({ from: undefined, to: undefined })
                  }
                >
                  Clear Dates
                </Button>
                <Button
                  onClick={() => {
                    const today = new Date();
                    const firstDay = new Date(
                      today.getFullYear(),
                      today.getMonth(),
                      1,
                    );
                    setDateRange({ from: firstDay, to: today });
                  }}
                >
                  This Month
                </Button>
              </div>

              {/* Ledger Summary Cards */}
              {ledgerSummary && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <TrendingUp className="h-4 w-4" />
                        Opening Balance
                      </div>
                      <div className="text-2xl font-bold mt-2">
                        {formatCurrency(ledgerSummary.openingBalance)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <ArrowUpRight className="h-4 w-4 text-green-600" />
                        Total Debit
                      </div>
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400 mt-2">
                        {formatCurrency(ledgerSummary.totalDebit)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <ArrowDownRight className="h-4 w-4 text-red-600" />
                        Total Credit
                      </div>
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-2">
                        {formatCurrency(ledgerSummary.totalCredit)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <TrendingDown className="h-4 w-4" />
                        Closing Balance
                      </div>
                      <div className="text-2xl font-bold mt-2">
                        {formatCurrency(ledgerSummary.closingBalance)}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Filters Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search transactions by description, reference, or contact..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Transaction Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Invoice">Invoice</SelectItem>
                  <SelectItem value="Payment">Payment</SelectItem>
                  <SelectItem value="Receipt">Receipt</SelectItem>
                  <SelectItem value="Expense">Expense</SelectItem>
                  <SelectItem value="Journal">Journal</SelectItem>
                  <SelectItem value="Adjustment">Adjustment</SelectItem>
                  <SelectItem value="Purchase">Purchase</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Entry Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Posted">Posted</SelectItem>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Void">Void</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm("");
                  setFilterType("all");
                  setFilterStatus("all");
                  setDateRange({ from: undefined, to: undefined });
                }}
                className="gap-2"
              >
                <Filter className="h-4 w-4" />
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Transactions Table Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Ledger Transactions</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {filteredTransactions.length} transactions found •
                {dateRange?.from &&
                  ` From ${format(dateRange.from, "MMM dd, yyyy")}`}
                {dateRange?.to && ` to ${format(dateRange.to, "MMM dd, yyyy")}`}
                {ledgerSummary &&
                  ` • Net Change: ${formatCurrency(
                    ledgerSummary.totalDebit - ledgerSummary.totalCredit,
                  )}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSort("date")}
                className="gap-1"
              >
                Sort by Date
                <SortIcon columnKey="date" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <Button
                        variant="ghost"
                        className="hover:bg-transparent p-0 h-auto font-semibold"
                        onClick={() => handleSort("reference")}
                      >
                        Reference
                        <SortIcon columnKey="reference" />
                      </Button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <Button
                        variant="ghost"
                        className="hover:bg-transparent p-0 h-auto font-semibold"
                        onClick={() => handleSort("date")}
                      >
                        Date
                        <SortIcon columnKey="date" />
                      </Button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Source
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Mode
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Debit
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Credit
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <Button
                        variant="ghost"
                        className="hover:bg-transparent p-0 h-auto font-semibold"
                        onClick={() => handleSort("balance")}
                      >
                        Balance
                        <SortIcon columnKey="balance" />
                      </Button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-12 text-center text-muted-foreground"
                      >
                        <Search className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        <p className="text-base">No transactions found</p>
                        <p className="text-sm mt-2">
                          Try selecting a different account or adjusting your
                          filters
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((transaction) =>
                      renderTransactionRow(transaction),
                    )
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Transaction Detail Dialog */}
        <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Transaction Details</DialogTitle>
              <DialogDescription>
                Complete transaction information and journal entry details
              </DialogDescription>
            </DialogHeader>
            {selectedTransaction && (
              <div className="space-y-6">
                {/* Header Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">
                        Transaction Reference
                      </Label>
                      <div className="text-xl font-bold flex items-center gap-2">
                        {selectedTransaction.reference}
                        <Badge
                          className={
                            getTransactionTypeConfig(selectedTransaction.type)
                              .badge
                          }
                        >
                          {selectedTransaction.type}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">
                        Description
                      </Label>
                      <div className="text-base font-medium">
                        {selectedTransaction.description}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">
                        Account
                      </Label>
                      <div className="text-base">
                        {selectedTransaction.accountCode} -{" "}
                        {selectedTransaction.accountName}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">
                        Journal Entry
                      </Label>
                      <div className="text-xl font-bold">
                        {selectedTransaction.journalEntry.entryNumber}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">
                        Date
                      </Label>
                      <div className="text-base font-medium">
                        {format(
                          selectedTransaction.date instanceof Date
                            ? selectedTransaction.date
                            : new Date(selectedTransaction.date),
                          "PPPP",
                        )}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">
                        Amount
                      </Label>
                      <div
                        className={`text-2xl font-bold ${
                          selectedTransaction.debit > 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {selectedTransaction.debit > 0
                          ? `+${formatCurrency(selectedTransaction.debit)}`
                          : `-${formatCurrency(selectedTransaction.credit)}`}
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Contact Information */}
                {selectedTransaction.contactName && (
                  <div className="space-y-3">
                    <h4 className="font-semibold">Contact Information</h4>
                    <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                      <div className="p-2 rounded-md bg-background">
                        {getContactIcon(selectedTransaction)}
                      </div>
                      <div>
                        <div className="font-medium">
                          {selectedTransaction.contactName}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {selectedTransaction.contactType}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Journal Entry Details */}
                <div className="space-y-3">
                  <h4 className="font-semibold">Journal Entry Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Entry Status:
                        </span>
                        <span className="font-medium">
                          {selectedTransaction.journalEntry.status}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Created By:
                        </span>
                        <span>
                          {selectedTransaction.journalEntry.createdBy}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Created At:
                        </span>
                        <span>
                          {format(
                            selectedTransaction.journalEntry
                              .createdAt instanceof Date
                              ? selectedTransaction.journalEntry.createdAt
                              : new Date(
                                  selectedTransaction.journalEntry.createdAt,
                                ),
                            "PPpp",
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Entry Description:
                        </span>
                        <span className="text-right">
                          {selectedTransaction.journalEntry.description}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Related Transactions (would show other sides of the journal entry) */}
                <div className="space-y-3">
                  <h4 className="font-semibold">Related Transactions</h4>
                  <div className="text-sm text-muted-foreground italic">
                    This transaction is part of journal entry{" "}
                    {selectedTransaction.journalEntry.entryNumber}. Other
                    transactions in this entry would be listed here.
                  </div>
                </div>
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setIsDetailDialogOpen(false)}
              >
                Close
              </Button>
              <Button>View Full Journal Entry</Button>
              <Button variant="outline">
                <FileEdit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Export Dialog */}
        <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Export Ledger Report</DialogTitle>
              <DialogDescription>
                Export ledger transactions for {selectedAccount?.name} (
                {selectedAccount?.code})
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              <div className="space-y-4">
                <Label>Export Format</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    className="h-20 flex-col"
                    onClick={() => handleExport("pdf")}
                  >
                    <FileText className="h-8 w-8 mb-2" />
                    <span>PDF</span>
                    <span className="text-xs text-muted-foreground mt-1">
                      For printing
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-20 flex-col"
                    onClick={() => handleExport("excel")}
                  >
                    <Download className="h-8 w-8 mb-2" />
                    <span>Excel</span>
                    <span className="text-xs text-muted-foreground mt-1">
                      For analysis
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-20 flex-col"
                    onClick={() => handleExport("csv")}
                  >
                    <FileText className="h-8 w-8 mb-2" />
                    <span>CSV</span>
                    <span className="text-xs text-muted-foreground mt-1">
                      For import
                    </span>
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Date Range</Label>
                <div className="text-sm">
                  {dateRange?.from ? (
                    <span>
                      {format(dateRange.from, "MMM dd, yyyy")}
                      {dateRange.to &&
                        ` to ${format(dateRange.to, "MMM dd, yyyy")}`}
                    </span>
                  ) : (
                    "All dates"
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Include</Label>
                <div className="space-y-2">
                  {[
                    { id: "summary", label: "Summary Section", checked: true },
                    {
                      id: "transactions",
                      label: "All Transactions",
                      checked: true,
                    },
                    {
                      id: "running-balance",
                      label: "Running Balance",
                      checked: true,
                    },
                    {
                      id: "contact-info",
                      label: "Contact Information",
                      checked: true,
                    },
                    {
                      id: "entry-details",
                      label: "Journal Entry Details",
                      checked: false,
                    },
                  ].map((item) => (
                    <div key={item.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={item.id}
                        defaultChecked={item.checked}
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor={item.id} className="text-sm">
                        {item.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsExportDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={() => handleExport("pdf")} className="gap-2">
                <Download className="h-4 w-4" />
                Export Now
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
