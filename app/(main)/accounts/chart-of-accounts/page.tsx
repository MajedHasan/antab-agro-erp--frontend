// app/accounts/chart-of-accounts/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import {
  Plus,
  Minus,
  Search,
  Download,
  Edit,
  ChevronDown,
  ChevronRight,
  Building2,
  TrendingUp,
  TrendingDown,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import api from "@/lib/api";

/* ---------------- Types ---------------- */

interface Account {
  id: string;
  code: string;
  name: string;
  type: "Asset" | "Liability" | "Equity" | "Revenue" | "Expense";
  category: string;
  parent?: string | null;
  balance?: number;
  openingBalance?: number;
  closingBalance?: number;
  periodDebit?: number;
  periodCredit?: number;
  currency: string;
  status: "Active" | "Inactive";
  description?: string;
  taxType?: string;
  children?: Account[];
  // keep raw for possible heuristics if needed
  _raw?: any;
}

/* ---------------- Helpers ---------------- */

function getAccountTypeConfig(type: Account["type"]) {
  const configs = {
    Asset: {
      color:
        "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
      badge: "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300",
      icon: "text-blue-600 dark:text-blue-400",
    },
    Liability: {
      color:
        "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
      badge: "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300",
      icon: "text-red-600 dark:text-red-400",
    },
    Equity: {
      color:
        "bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
      badge:
        "bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300",
      icon: "text-purple-600 dark:text-purple-400",
    },
    Revenue: {
      color:
        "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800",
      badge:
        "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300",
      icon: "text-green-600 dark:text-green-400",
    },
    Expense: {
      color:
        "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
      badge:
        "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300",
      icon: "text-amber-600 dark:text-amber-400",
    },
  } as const;
  return configs[type];
}

/** Format number using your existing "K" style. */
function formatAmount(amount: number | undefined | null, currency = "৳") {
  const v = Number(amount ?? 0);
  if (v === 0) return `${currency} 0`;
  // keep your original behavior: show in K with 1 decimal
  return `${currency} ${(v / 1000).toFixed(1)}K`;
}

function isCreditNature(type: Account["type"]) {
  return type === "Liability" || type === "Equity" || type === "Revenue";
}

function formatOpeningBalance(account: Account) {
  const raw = Number(account.openingBalance ?? 0);
  if (raw === 0) return "0";

  const value = Math.abs(raw);
  const suffix = isCreditNature(account.type) ? "Cr" : "Dr";

  return `${value.toLocaleString()} ${suffix}`;
}

function normalizeAccount(raw: any): Account {
  const id = raw._id || raw.id;
  const parent =
    raw.parent && typeof raw.parent === "object"
      ? raw.parent._id || raw.parent.id
      : raw.parent || null;

  // Backend may return openingBalance/closingBalance (new) or balance (old).
  // Map them safely.
  const opening = raw.openingBalance ?? raw.opening ?? 0;
  const closing =
    raw.closingBalance ?? raw.closing ?? raw.balance ?? raw.currentBalance ?? 0;
  const periodDr = raw.periodDebit ?? raw.periodDr ?? 0;
  const periodCr = raw.periodCredit ?? raw.periodCr ?? 0;

  return {
    id: String(id),
    code: raw.code || "",
    name: raw.name || "",
    type: raw.type,
    category: raw.category || "",
    parent,
    // keep legacy `balance` as well (some endpoints may still use it)
    balance: raw.balance ?? closing,
    openingBalance: opening,
    closingBalance: closing,
    periodDebit: periodDr,
    periodCredit: periodCr,
    currency: raw.currency || "USD",
    status: raw.status || "Active",
    description: raw.description || "",
    taxType: raw.taxType,
    children: Array.isArray(raw.children)
      ? raw.children.map((c: any) => normalizeAccount(c))
      : undefined,
    _raw: raw,
  };
}

/* ---------- Sorting & tree utilities ---------- */

/** Desired top-level type order */
const TYPE_ORDER: Record<string, number> = {
  Asset: 1,
  Liability: 2,
  Equity: 3,
  Revenue: 4,
  Expense: 5,
};

function compareAccountsForSort(a: Account, b: Account) {
  // 1) by type order
  const ta = TYPE_ORDER[a.type] ?? 99;
  const tb = TYPE_ORDER[b.type] ?? 99;
  if (ta !== tb) return ta - tb;

  // 2) try numeric code (prefix numbers)
  const numA = parseLeadingNumber(a.code);
  const numB = parseLeadingNumber(b.code);
  if (numA !== null && numB !== null) return numA - numB;
  if (numA !== null) return -1; // numeric first
  if (numB !== null) return 1;

  // 3) fallback to lexicographic code
  const c = a.code.localeCompare(b.code);
  if (c !== 0) return c;

  // 4) finally by name
  return a.name.localeCompare(b.name);
}

function parseLeadingNumber(code: string): number | null {
  if (!code) return null;
  const match = code.match(/^(\d+)/);
  if (!match) return null;
  return Number(match[1]);
}

/** Recursively sort children arrays */
function sortTreeRecursive(nodes?: Account[]) {
  if (!nodes) return;
  nodes.sort(compareAccountsForSort);
  nodes.forEach((n) => {
    if (n.children) sortTreeRecursive(n.children);
  });
}

/**
 * Find node by predicate recursively (returns first match)
 */
function findNodeRecursively(
  nodes: Account[] | undefined,
  fn: (n: Account) => boolean,
): Account | null {
  if (!nodes) return null;
  for (const n of nodes) {
    if (fn(n)) return n;
    const child = findNodeRecursively(n.children, fn);
    if (child) return child;
  }
  return null;
}

/**
 * Remove items from top-level roots by predicate and return the removed list.
 * (Only operates on the root array.)
 */
function extractRootsByPredicate(
  roots: Account[],
  predicate: (n: Account) => boolean,
): Account[] {
  const removed: Account[] = [];
  for (let i = roots.length - 1; i >= 0; i--) {
    if (predicate(roots[i])) {
      removed.unshift(roots[i]); // preserve order among removed
      roots.splice(i, 1);
    }
  }
  return removed;
}

/* ---------------- Component ---------------- */

export default function ChartOfAccounts() {
  // Data state
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any | null>(null);

  // UI state (kept same as your original)
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(
    new Set(),
  );
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [parentForChild, setParentForChild] = useState<Account | null>(null);
  const [formData, setFormData] = useState<Partial<Account>>({
    code: "",
    name: "",
    type: "Asset",
    category: "",
    balance: 0,
    currency: "USD",
    status: "Active",
    description: "",
  });

  /* ---------- Initial load ---------- */
  useEffect(() => {
    loadTree();
    loadSummary();
  }, []);

  async function loadTree() {
    setLoading(true);
    try {
      // endpoint provided by your account.controller.tree
      const res = await api.get("/accounts/tree");
      // your controller returns { success: true, data }
      const data = res.data?.data ?? res.data ?? [];
      // normalize (this preserves nested children if API returned them)
      const normalized = (data as any[]).map(normalizeAccount);

      // ---------- POST-PROCESSING for display ----------
      // 1) We will ensure dealers (codes starting with "DLR-") are shown under "Accounts Receivable"
      //    If API placed them at top-level by mistake, we move them (display-only) so the UI matches desired hierarchy.

      // Work on a shallow copy roots array
      const roots = [...normalized];

      // Find accounts receivable node in the existing tree (search recursively)
      const arNode = findNodeRecursively(
        roots,
        (n) => (n.name || "").toLowerCase() === "accounts receivable",
      );

      // Extract top-level roots that look like dealer accounts (code starts with DLR- case-insensitive)
      const dealerRoots = extractRootsByPredicate(
        roots,
        (r) =>
          typeof r.code === "string" &&
          r.code.trim().toUpperCase().startsWith("DLR-"),
      );

      // If we found AR node, attach dealer roots under it (append)
      if (arNode) {
        // ensure children array exists
        if (!arNode.children) arNode.children = [];
        // append dealer nodes
        for (const d of dealerRoots) {
          // Prevent duplication if it's already somewhere in sub-tree
          const alreadyInside = findNodeRecursively(
            [arNode],
            (x) => x.id === d.id,
          );
          if (!alreadyInside) {
            arNode.children.push(d);
          }
        }
      } else {
        // If Accounts Receivable not found, fallback: if there are dealers at root, leave them as-is.
        // We do not change DB here.
      }

      // 2) Recursively sort to ensure predictable ordering in UI
      sortTreeRecursive(roots);

      // set sanitized/display tree
      setAccounts(roots);

      // Expand top-level roots by default
      setExpandedAccounts(new Set(roots.map((r) => r.id)));
    } catch (err: any) {
      console.error("Failed to load account tree", err);
      alert("Failed to load accounts. See console for details.");
    } finally {
      setLoading(false);
    }
  }

  async function loadSummary() {
    try {
      const res = await api.get("/accounts/opening-balance-summary");
      // controller returns { success: true, data: totals }
      const totals = res.data?.data ?? res.data ?? null;
      setSummary(totals);
    } catch (err) {
      console.warn("summary load failed", err);
      setSummary(null);
    }
  }

  /* ---------- Expand toggle ---------- */
  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedAccounts);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedAccounts(newExpanded);
  };

  /* ---------- Dialog openers ---------- */
  const openAddChildDialog = (parentAccount: Account) => {
    setParentForChild(parentAccount);
    setFormData({
      code: "",
      name: "",
      type: parentAccount.type,
      category: parentAccount.category,
      balance: 0,
      currency: parentAccount.currency,
      status: "Active",
      description: "",
    });
    setIsAddDialogOpen(true);
  };

  const openEditDialog = (account: Account) => {
    setSelectedAccount(account);
    setFormData({
      code: account.code,
      name: account.name,
      type: account.type,
      category: account.category,
      balance: account.balance ?? account.closingBalance ?? 0,
      currency: account.currency,
      status: account.status,
      description: account.description,
      taxType: (account as any).taxType,
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (account: Account) => {
    setSelectedAccount(account);
    setIsDeleteDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      type: "Asset",
      category: "",
      balance: 0,
      currency: "USD",
      status: "Active",
      description: "",
    });
    setSelectedAccount(null);
    setParentForChild(null);
  };

  /* ---------- CRUD (calls to backend) ---------- */

  // Create account
  const handleAddAccount = async () => {
    try {
      const payload: any = {
        code: formData.code,
        name: formData.name,
        type: formData.type,
        category: formData.category,
        // legacy backend accepts `balance` as opening balance — keep this for compatibility
        balance: formData.balance ?? 0,
        currency: formData.currency ?? "USD",
        status: formData.status ?? "Active",
        description: formData.description ?? "",
      };
      if (parentForChild) payload.parent = parentForChild.id;

      await api.post("/accounts", payload);
      // success — reload tree and summary
      await loadTree();
      await loadSummary();
      // expand parent if we added a child
      if (parentForChild) {
        setExpandedAccounts((prev) => new Set(prev).add(parentForChild.id));
      }
      setIsAddDialogOpen(false);
      resetForm();
    } catch (err: any) {
      console.error("create account failed", err);
      alert(err?.response?.data?.message || "Failed to create account");
    }
  };

  // Edit account
  const handleEditAccount = async () => {
    if (!selectedAccount) return;
    try {
      const payload: any = {
        code: formData.code,
        name: formData.name,
        type: formData.type,
        category: formData.category,
        balance: formData.balance ?? 0,
        currency: formData.currency ?? "USD",
        status: formData.status ?? "Active",
        description: formData.description ?? "",
        taxType: (formData as any).taxType,
      };

      await api.put(`/accounts/${selectedAccount.id}`, payload);
      await loadTree();
      await loadSummary();
      setIsEditDialogOpen(false);
      resetForm();
    } catch (err: any) {
      console.error("update failed", err);
      alert(err?.response?.data?.message || "Failed to update account");
    }
  };

  // Delete account (soft delete)
  const handleDeleteAccount = async () => {
    if (!selectedAccount) return;
    const ok = confirm(
      `Are you sure you want to delete "${selectedAccount.name}" (${selectedAccount.code})? This may affect reports.`,
    );
    if (!ok) return;
    try {
      await api.delete(`/accounts/${selectedAccount.id}?hard=true`);
      await loadTree();
      await loadSummary();
      setIsDeleteDialogOpen(false);
      setSelectedAccount(null);
    } catch (err: any) {
      console.error("delete failed", err);
      alert(err?.response?.data?.message || "Failed to delete account");
    }
  };

  /* ---------- Filtering (client side, unchanged) ---------- */
  const filterAccounts = (accs: Account[]): Account[] => {
    return accs
      .filter((acc) => {
        const matchesSearch =
          acc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          acc.code.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === "all" || acc.type === filterType;
        const matchesStatus =
          filterStatus === "all" || acc.status === filterStatus;
        return matchesSearch && matchesType && matchesStatus;
      })
      .map((acc) => ({
        ...acc,
        children: acc.children ? filterAccounts(acc.children) : undefined,
      }));
  };

  /* ---------- Rendering ---------- */

  const renderAccountRow = (account: Account, level = 0) => {
    const hasChildren = account.children && account.children.length > 0;
    const isExpanded = expandedAccounts.has(account.id);
    const typeConfig = getAccountTypeConfig(account.type);

    // Decide displayed values: use closingBalance if present otherwise fallback to balance
    const closingDisplay =
      account.closingBalance !== undefined
        ? account.closingBalance
        : (account.balance ?? 0);
    const openingDisplay = account.openingBalance ?? 0;

    return (
      <React.Fragment key={account.id}>
        <div
          className={`border-b border-border hover:bg-accent/5 transition-colors duration-200 ${typeConfig.color}`}
        >
          <div className="grid grid-cols-12 gap-2 px-4 py-2 items-center text-sm">
            {/* Code Column */}
            <div
              style={{ paddingLeft: `${level * 20}px` }}
              className="col-span-2 flex items-center gap-1"
            >
              {hasChildren && (
                <button
                  onClick={() => toggleExpand(account.id)}
                  className="hover:bg-background/50 rounded p-0.5 transition-colors"
                  title={isExpanded ? "Collapse" : "Expand"}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              )}
              {!hasChildren && <div className="w-5" />}
              <span className="font-semibold text-xs">{account.code}</span>
            </div>

            {/* Name Column */}
            <div className="col-span-3 font-medium text-sm truncate">
              {account.name}
            </div>

            {/* Type Column */}
            <div className="col-span-1">
              <Badge variant="secondary" className="text-xs">
                {account.type}
              </Badge>
            </div>

            {/* Category Column */}
            <div className="col-span-2 text-xs text-muted-foreground truncate">
              {account.category}
            </div>

            {/* Balance Column - show opening (start) and closing stacked */}
            {/* Opening Balance ONLY */}
            <div className="col-span-2 text-right font-mono text-sm font-semibold">
              {formatOpeningBalance(account)}
            </div>

            {/* Status Column */}
            <div className="col-span-1">
              <Badge
                variant={account.status === "Active" ? "default" : "secondary"}
                className="text-xs"
              >
                {account.status}
              </Badge>
            </div>

            {/* Actions Column */}
            <div className="col-span-1 flex gap-1 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openAddChildDialog(account)}
                title="Add sub-item"
                className="h-7 w-7 p-0 hover:bg-background/70"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
              {level > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openDeleteDialog(account)}
                  title="Remove item"
                  className="h-7 w-7 p-0 hover:bg-destructive/20 hover:text-destructive"
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openEditDialog(account)}
                title="Edit"
                className="h-7 w-7 p-0 hover:bg-background/70"
              >
                <Edit className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {hasChildren &&
          isExpanded &&
          account.children?.map((child) => renderAccountRow(child, level + 1))}
      </React.Fragment>
    );
  };

  /* ---------- Totals (use server summary if available, otherwise compute) ---------- */
  const computedTotals = React.useMemo(() => {
    if (summary) {
      return {
        totalAssets: summary.totalAssets ?? 0,
        totalLiabilities: summary.totalLiabilities ?? 0,
        totalEquity: summary.totalEquity ?? 0,
        totalRevenue: summary.totalRevenue ?? 0,
        totalExpenses: summary.totalExpenses ?? 0,
      };
    }
    // fallback compute from loaded accounts — use closingBalance if present else balance
    function sumByTypeLocal(type: string) {
      return accounts
        .filter((a) => a.type === type)
        .reduce((sum, a) => {
          const childSum =
            a.children?.reduce(
              (s, c) =>
                s +
                (c.closingBalance !== undefined
                  ? c.closingBalance
                  : (c.balance ?? 0)),
              0,
            ) || 0;
          const own =
            a.closingBalance !== undefined
              ? a.closingBalance
              : (a.balance ?? 0);
          return sum + childSum + own;
        }, 0);
    }

    return {
      totalAssets: sumByTypeLocal("Asset"),
      totalLiabilities: sumByTypeLocal("Liability"),
      totalEquity: sumByTypeLocal("Equity"),
      totalRevenue: sumByTypeLocal("Revenue"),
      totalExpenses: sumByTypeLocal("Expense"),
    };
  }, [summary, accounts]);

  const filteredAccounts = filterAccounts(accounts);

  /* ---------- Render main UI (unchanged look) ---------- */
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-full mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-foreground">
              Chart of Accounts
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage your company's account structure with Excel-like interface
            </p>
          </div>
          <Button
            onClick={() => {
              setParentForChild(null);
              setIsAddDialogOpen(true);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Root Account
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[
            {
              title: "Total Assets",
              value: computedTotals.totalAssets,
              icon: <TrendingUp className="h-5 w-5" />,
              color:
                "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950",
            },
            {
              title: "Total Liabilities",
              value: computedTotals.totalLiabilities,
              icon: <TrendingDown className="h-5 w-5" />,
              color: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950",
            },
            {
              title: "Total Equity",
              value: computedTotals.totalEquity,
              icon: <Building2 className="h-5 w-5" />,
              color:
                "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950",
            },
            {
              title: "Total Revenue",
              value: computedTotals.totalRevenue,
              icon: <TrendingUp className="h-5 w-5" />,
              color:
                "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950",
            },
            {
              title: "Total Expenses",
              value: computedTotals.totalExpenses,
              icon: <TrendingDown className="h-5 w-5" />,
              color:
                "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950",
            },
          ].map((stat, idx) => (
            <Card
              key={idx}
              className="border border-border/50 backdrop-blur-sm hover:border-primary/30 hover:shadow-md transition-all duration-300"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-2 rounded-lg ${stat.color}`}>
                    {stat.icon}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">
                  {formatAmount(Math.abs(stat.value))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters and Actions */}
        <Card className="border border-border/50">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search by account name or code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Account Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Asset">Asset</SelectItem>
                  <SelectItem value="Liability">Liability</SelectItem>
                  <SelectItem value="Equity">Equity</SelectItem>
                  <SelectItem value="Revenue">Revenue</SelectItem>
                  <SelectItem value="Expense">Expense</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" className="gap-2 bg-transparent">
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Accounts Table */}
        <Card className="border border-border/50 overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <div className="bg-muted/40 border-b border-border sticky top-0 z-10">
                <div className="grid grid-cols-12 gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  <div className="col-span-2">Code</div>
                  <div className="col-span-3">Name</div>
                  <div className="col-span-1">Type</div>
                  <div className="col-span-2">Category</div>
                  <div className="col-span-2 text-right">Opening Balance</div>
                  <div className="col-span-1">Status</div>
                  <div className="col-span-1 text-right pr-2">Actions</div>
                </div>
              </div>

              <div>
                {filteredAccounts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Search className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p className="text-base">
                      No accounts found matching your criteria
                    </p>
                  </div>
                ) : (
                  filteredAccounts.map((account) => renderAccountRow(account))
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Add/Edit Account Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {parentForChild ? "Add Sub-Account" : "Add New Account"}
              </DialogTitle>
              <DialogDescription>
                {parentForChild
                  ? `Create a new sub-account under "${parentForChild.name}"`
                  : "Create a new root account in your chart of accounts"}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Account Code</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value })
                    }
                    placeholder="e.g., 1050"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Account Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g., Prepaid Expenses"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Account Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: any) =>
                      setFormData({ ...formData, type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asset">Asset</SelectItem>
                      <SelectItem value="Liability">Liability</SelectItem>
                      <SelectItem value="Equity">Equity</SelectItem>
                      <SelectItem value="Revenue">Revenue</SelectItem>
                      <SelectItem value="Expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    placeholder="e.g., Current Assets"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="balance">Opening Balance</Label>
                  <Input
                    id="balance"
                    type="number"
                    value={formData.balance}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        balance: Number.parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) =>
                      setFormData({ ...formData, currency: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                      <SelectItem value="BDT">BDT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: any) =>
                      setFormData({ ...formData, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Enter account description..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddDialogOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleAddAccount}>
                {parentForChild ? "Add Sub-Account" : "Create Account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Account Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Account</DialogTitle>
              <DialogDescription>Update account information</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-code">Account Code</Label>
                  <Input
                    id="edit-code"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Account Name</Label>
                  <Input
                    id="edit-name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-type">Account Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: any) =>
                      setFormData({ ...formData, type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asset">Asset</SelectItem>
                      <SelectItem value="Liability">Liability</SelectItem>
                      <SelectItem value="Equity">Equity</SelectItem>
                      <SelectItem value="Revenue">Revenue</SelectItem>
                      <SelectItem value="Expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-category">Category</Label>
                  <Input
                    id="edit-category"
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-balance">Balance</Label>
                  <Input
                    id="edit-balance"
                    type="number"
                    value={formData.balance}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        balance: Number.parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-currency">Currency</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) =>
                      setFormData({ ...formData, currency: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                      <SelectItem value="BDT">BDT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: any) =>
                      setFormData({ ...formData, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleEditAccount}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-destructive">
                Delete Account
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete{" "}
                <strong>{selectedAccount?.name}</strong> (
                {selectedAccount?.code})? This action cannot be undone and may
                affect your financial reports.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setIsDeleteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteAccount}>
                Delete Account
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
