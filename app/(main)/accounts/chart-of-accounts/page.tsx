// app/accounts/chart-of-accounts/page.tsx
"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
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
  Wallet,
  X,
  RefreshCw,
  ChevronsDownUp,
  ChevronsUpDown,
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
import { Card, CardContent } from "@/components/ui/card";
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
  _raw?: any;
}

/* ---------------- Badge colors per account type ---------------- */
const TYPE_COLORS: Record<
  Account["type"],
  { badge: string }
> = {
  Asset: { badge: "bg-[#3aa838]/10 text-[#2f8a2f] border-[#3aa838]/30" },
  Liability: { badge: "bg-rose-50 text-rose-700 border-rose-200" },
  Equity: { badge: "bg-slate-100 text-slate-700 border-slate-200" },
  Revenue: { badge: "bg-teal-50 text-teal-700 border-teal-200" },
  Expense: { badge: "bg-amber-50 text-amber-700 border-amber-200" },
};

/* ---------------- Row tint per ROOT type (inherited by descendants) ---------------- */
const TYPE_TINT: Record<
  Account["type"],
  { bg: string; hover: string; accent: string; subHeader: string }
> = {
  Asset: {
    bg: "bg-emerald-50/40",
    hover: "hover:bg-emerald-50/70",
    accent: "border-l-[#3aa838]",
    subHeader: "text-[#2f8a2f]",
  },
  Liability: {
    bg: "bg-rose-50/40",
    hover: "hover:bg-rose-50/70",
    accent: "border-l-rose-500",
    subHeader: "text-rose-700",
  },
  Equity: {
    bg: "bg-slate-50/70",
    hover: "hover:bg-slate-100",
    accent: "border-l-slate-400",
    subHeader: "text-slate-700",
  },
  Revenue: {
    bg: "bg-teal-50/40",
    hover: "hover:bg-teal-50/70",
    accent: "border-l-teal-500",
    subHeader: "text-teal-700",
  },
  Expense: {
    bg: "bg-amber-50/40",
    hover: "hover:bg-amber-50/70",
    accent: "border-l-amber-500",
    subHeader: "text-amber-700",
  },
};

/* ---------------- Helpers ---------------- */
function formatAmount(amount: number | undefined | null, currency = "৳") {
  const v = Math.abs(Number(amount ?? 0));
  if (v === 0) return `${currency} 0`;
  if (v >= 100_000_000) return `${currency} ${(v / 10_000_000).toFixed(2)} Cr`;
  if (v >= 100_000) return `${currency} ${(v / 100_000).toFixed(2)} L`;
  if (v >= 1_000)
    return `${currency} ${v.toLocaleString(undefined, {
      maximumFractionDigits: 0,
    })}`;
  return `${currency} ${v.toFixed(2)}`;
}

function isCreditNature(type: Account["type"]) {
  return type === "Liability" || type === "Equity" || type === "Revenue";
}

function formatOpeningBalance(account: Account) {
  const raw = Number(account.openingBalance ?? 0);
  if (raw === 0) return "0";
  const value = Math.abs(raw);
  const suffix = isCreditNature(account.type) ? "Cr" : "Dr";
  return `${value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })} ${suffix}`;
}

function normalizeAccount(raw: any): Account {
  const id = raw._id || raw.id;
  const parent =
    raw.parent && typeof raw.parent === "object"
      ? raw.parent._id || raw.parent.id
      : raw.parent || null;

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
    balance: raw.balance ?? closing,
    openingBalance: opening,
    closingBalance: closing,
    periodDebit: periodDr,
    periodCredit: periodCr,
    currency: raw.currency || "BDT",
    status: raw.status || "Active",
    description: raw.description || "",
    taxType: raw.taxType,
    children: Array.isArray(raw.children)
      ? raw.children.map((c: any) => normalizeAccount(c))
      : undefined,
    _raw: raw,
  };
}

/* ---------------- Sorting & tree utilities ---------------- */
const TYPE_ORDER: Record<string, number> = {
  Asset: 1,
  Liability: 2,
  Equity: 3,
  Revenue: 4,
  Expense: 5,
};

function parseLeadingNumber(code: string): number | null {
  if (!code) return null;
  const match = code.match(/^(\d+)/);
  if (!match) return null;
  return Number(match[1]);
}

function compareAccountsForSort(a: Account, b: Account) {
  const ta = TYPE_ORDER[a.type] ?? 99;
  const tb = TYPE_ORDER[b.type] ?? 99;
  if (ta !== tb) return ta - tb;

  const numA = parseLeadingNumber(a.code);
  const numB = parseLeadingNumber(b.code);
  if (numA !== null && numB !== null) return numA - numB;
  if (numA !== null) return -1;
  if (numB !== null) return 1;

  const c = a.code.localeCompare(b.code);
  if (c !== 0) return c;
  return a.name.localeCompare(b.name);
}

function sortTreeRecursive(nodes?: Account[]) {
  if (!nodes) return;
  nodes.sort(compareAccountsForSort);
  nodes.forEach((n) => {
    if (n.children) sortTreeRecursive(n.children);
  });
}

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

function extractRootsByPredicate(
  roots: Account[],
  predicate: (n: Account) => boolean,
): Account[] {
  const removed: Account[] = [];
  for (let i = roots.length - 1; i >= 0; i--) {
    if (predicate(roots[i])) {
      removed.unshift(roots[i]);
      roots.splice(i, 1);
    }
  }
  return removed;
}

/** Recursively collect all node ids */
function collectAllIds(nodes: Account[]): string[] {
  const out: string[] = [];
  const walk = (arr: Account[]) => {
    for (const n of arr) {
      out.push(n.id);
      if (n.children) walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

/** Find all nodes matching predicate and return ids of their ancestors too */
function findMatchingIdsWithAncestors(
  nodes: Account[],
  match: (n: Account) => boolean,
): Set<string> {
  const result = new Set<string>();

  const walk = (arr: Account[], ancestors: string[]): boolean => {
    let anyMatch = false;
    for (const n of arr) {
      const selfMatch = match(n);
      const childMatch = n.children
        ? walk(n.children, [...ancestors, n.id])
        : false;
      if (selfMatch || childMatch) {
        result.add(n.id);
        ancestors.forEach((a) => result.add(a));
        anyMatch = true;
      }
    }
    return anyMatch;
  };

  walk(nodes, []);
  return result;
}

/* ---------------- Component ---------------- */
export default function ChartOfAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any | null>(null);

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
    currency: "BDT",
    status: "Active",
    description: "",
  });

  /* ---------- Initial load ---------- */
  useEffect(() => {
    loadTree();
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTree = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/accounts/tree");
      const data = res.data?.data ?? res.data ?? [];
      const normalized = (data as any[]).map(normalizeAccount);
      const roots = [...normalized];

      // Move DLR- dealer accounts under "Accounts Receivable" (display-only)
      const arNode = findNodeRecursively(
        roots,
        (n) => (n.name || "").toLowerCase() === "accounts receivable",
      );
      const dealerRoots = extractRootsByPredicate(
        roots,
        (r) =>
          typeof r.code === "string" &&
          r.code.trim().toUpperCase().startsWith("DLR-"),
      );
      if (arNode) {
        if (!arNode.children) arNode.children = [];
        for (const d of dealerRoots) {
          const alreadyInside = findNodeRecursively(
            [arNode],
            (x) => x.id === d.id,
          );
          if (!alreadyInside) arNode.children.push(d);
        }
      }

      sortTreeRecursive(roots);
      setAccounts(roots);
      setExpandedAccounts(new Set(roots.map((r) => r.id)));
    } catch (err: any) {
      console.error("Failed to load account tree", err);
      alert("Failed to load accounts. See console for details.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSummary = useCallback(async () => {
    try {
      const res = await api.get("/accounts/opening-balance-summary");
      setSummary(res.data?.data ?? res.data ?? null);
    } catch (err) {
      console.warn("summary load failed", err);
      setSummary(null);
    }
  }, []);

  /* ---------- Auto-expand matches on search ---------- */
  useEffect(() => {
    if (!searchTerm.trim()) return;
    const q = searchTerm.trim().toLowerCase();
    const matchIds = findMatchingIdsWithAncestors(
      accounts,
      (n) =>
        n.name.toLowerCase().includes(q) || n.code.toLowerCase().includes(q),
    );
    if (matchIds.size > 0) {
      setExpandedAccounts((prev) => new Set([...prev, ...matchIds]));
    }
  }, [searchTerm, accounts]);

  /* ---------- Expand / collapse helpers ---------- */
  const toggleExpand = (id: string) => {
    const next = new Set(expandedAccounts);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedAccounts(next);
  };

  const expandAll = () => setExpandedAccounts(new Set(collectAllIds(accounts)));
  const collapseAll = () => setExpandedAccounts(new Set());

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

  const openAddRootDialog = () => {
    setParentForChild(null);
    setFormData({
      code: "",
      name: "",
      type: "Asset",
      category: "",
      balance: 0,
      currency: "BDT",
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
      balance: account.openingBalance ?? account.balance ?? 0,
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
      currency: "BDT",
      status: "Active",
      description: "",
    });
    setSelectedAccount(null);
    setParentForChild(null);
  };

  /* ---------- CRUD ---------- */
  const handleAddAccount = async () => {
    try {
      const payload: any = {
        code: formData.code,
        name: formData.name,
        type: formData.type,
        category: formData.category,
        balance: formData.balance ?? 0,
        currency: formData.currency ?? "BDT",
        status: formData.status ?? "Active",
        description: formData.description ?? "",
      };
      if (parentForChild) payload.parent = parentForChild.id;

      await api.post("/accounts", payload);
      await loadTree();
      await loadSummary();
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

  const handleEditAccount = async () => {
    if (!selectedAccount) return;
    try {
      const payload: any = {
        code: formData.code,
        name: formData.name,
        type: formData.type,
        category: formData.category,
        balance: formData.balance ?? 0,
        currency: formData.currency ?? "BDT",
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

  const handleDeleteAccount = async () => {
    if (!selectedAccount) return;
    const ok = confirm(
      `Delete "${selectedAccount.name}" (${selectedAccount.code})? This may affect reports.`,
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

  /* ---------- Filtering ---------- */
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

  const filteredAccounts = useMemo(
    () => filterAccounts(accounts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accounts, searchTerm, filterType, filterStatus],
  );

  /* ---------- Totals ---------- */
  const computedTotals = useMemo(() => {
    if (summary) {
      return {
        totalAssets: summary.totalAssets ?? 0,
        totalLiabilities: summary.totalLiabilities ?? 0,
        totalEquity: summary.totalEquity ?? 0,
        totalRevenue: summary.totalRevenue ?? 0,
        totalExpenses: summary.totalExpenses ?? 0,
      };
    }
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
                  : c.balance ?? 0),
              0,
            ) || 0;
          const own =
            a.closingBalance !== undefined
              ? a.closingBalance
              : a.balance ?? 0;
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

  /* ---------- CSV export ---------- */
  const handleExport = () => {
    const rows: string[][] = [
      ["Code", "Name", "Type", "Category", "Opening Balance", "Status"],
    ];

    const walk = (list: Account[], level = 0) => {
      for (const a of list) {
        rows.push([
          a.code,
          "  ".repeat(level) + a.name,
          a.type,
          a.category,
          formatOpeningBalance(a),
          a.status,
        ]);
        if (a.children) walk(a.children, level + 1);
      }
    };
    walk(filteredAccounts);

    const csv = rows
      .map((r) =>
        r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chart-of-accounts-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ---------- Row renderer ---------- */
  const renderAccountRow = (
    account: Account,
    level = 0,
    rootType?: Account["type"],
  ) => {
    const hasChildren = account.children && account.children.length > 0;
    const isExpanded = expandedAccounts.has(account.id);

    // 🎨 Inherit the ROOT's tint down the whole subtree
    const tintType = rootType ?? account.type;
    const tint = TYPE_TINT[tintType];
    const typeColors = TYPE_COLORS[account.type];

    const descendantCount = hasChildren
      ? collectAllIds(account.children!).length
      : 0;

    return (
      <React.Fragment key={account.id}>
        <div
          className={`group border-b border-slate-200/50 border-l-4 transition-colors ${
            tint.accent
          } ${tint.bg} ${tint.hover} ${
            level === 0 ? "border-t first:border-t-0" : ""
          }`}
        >
          <div
            className={`grid grid-cols-12 items-center gap-2 px-3 ${
              level === 0 ? "py-2" : "py-1.5"
            } text-sm`}
          >
            {/* Code + expand */}
            <div
              style={{ paddingLeft: `${level * 16}px` }}
              className="col-span-3 flex items-center gap-1 md:col-span-2"
            >
              {hasChildren ? (
                <button
                  onClick={() => toggleExpand(account.id)}
                  className="rounded p-0.5 hover:bg-black/5"
                  title={isExpanded ? "Collapse" : "Expand"}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 text-slate-700" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-slate-700" />
                  )}
                </button>
              ) : (
                <div className="w-5" />
              )}
              <span
                className={`font-mono ${
                  level === 0
                    ? "text-xs font-bold text-slate-900"
                    : "text-xs font-semibold text-slate-800"
                }`}
              >
                {account.code}
              </span>
            </div>

            {/* Name */}
            <div className="col-span-9 md:col-span-3">
              <div className="flex items-center gap-2">
                <span
                  className={`truncate ${
                    level === 0
                      ? "text-sm font-bold text-slate-900"
                      : "text-sm font-medium text-slate-800"
                  }`}
                >
                  {account.name}
                </span>
                {level === 0 && descendantCount > 0 && (
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${tint.subHeader} bg-white/60`}
                  >
                    {descendantCount}
                  </span>
                )}
              </div>
            </div>

            {/* Type */}
            <div className="hidden md:col-span-1 md:block">
              <Badge
                className={`border text-[10px] font-semibold ${typeColors.badge}`}
              >
                {account.type}
              </Badge>
            </div>

            {/* Category */}
            <div className="hidden truncate text-[11px] text-slate-600 md:col-span-2 md:block">
              {account.category}
            </div>

            {/* Opening Balance */}
            <div
              className={`col-span-6 text-right font-mono text-xs tabular-nums md:col-span-2 ${
                level === 0
                  ? "font-bold text-slate-900"
                  : "font-semibold text-slate-800"
              }`}
            >
              {formatOpeningBalance(account)}
            </div>

            {/* Status */}
            <div className="hidden md:col-span-1 md:block">
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                  account.status === "Active"
                    ? "border-[#3aa838]/30 bg-white/70 text-[#2f8a2f]"
                    : "border-slate-200 bg-white/70 text-slate-600"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    account.status === "Active"
                      ? "bg-[#3aa838]"
                      : "bg-slate-400"
                  }`}
                />
                {account.status}
              </span>
            </div>

            {/* Actions */}
            <div className="col-span-6 flex justify-end gap-0.5 md:col-span-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => openAddChildDialog(account)}
                title="Add sub-account"
                className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/5 focus:opacity-100"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
              {level > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openDeleteDialog(account)}
                  title="Delete"
                  className="h-7 w-7 text-rose-600 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-rose-100 hover:text-rose-700 focus:opacity-100"
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => openEditDialog(account)}
                title="Edit"
                className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/5 focus:opacity-100"
              >
                <Edit className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {hasChildren &&
          isExpanded &&
          account.children?.map((child) =>
            // 👇 pass the ROOT type down — entire subtree inherits
            renderAccountRow(child, level + 1, tintType),
          )}
      </React.Fragment>
    );
  };

  /* ---------- Render ---------- */
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl p-3 md:p-4">
        {/* ============ HERO ============ */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#3aa838]/10">
              <Building2 className="h-4 w-4 text-[#3aa838]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-semibold leading-tight">
                Chart of Accounts
              </h1>
              <p className="truncate text-[11px] text-muted-foreground">
                {accounts.length > 0
                  ? `${collectAllIds(accounts).length} accounts · ${
                      accounts.length
                    } roots`
                  : "Manage your company account structure"}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                loadTree();
                loadSummary();
              }}
              disabled={loading}
              className="h-8"
              title="Refresh"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
            </Button>
            <Button
              onClick={openAddRootDialog}
              size="sm"
              className="h-8 bg-[#3aa838] text-white hover:bg-[#2f8a2f]"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add root
            </Button>
          </div>
        </div>

        {/* ============ SUMMARY CARDS ============ */}
        <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-5">
          {[
            {
              title: "Assets",
              value: computedTotals.totalAssets,
              icon: TrendingUp,
              tone: "green",
            },
            {
              title: "Liabilities",
              value: computedTotals.totalLiabilities,
              icon: TrendingDown,
              tone: "rose",
            },
            {
              title: "Equity",
              value: computedTotals.totalEquity,
              icon: Wallet,
              tone: "slate",
            },
            {
              title: "Revenue",
              value: computedTotals.totalRevenue,
              icon: TrendingUp,
              tone: "teal",
            },
            {
              title: "Expenses",
              value: computedTotals.totalExpenses,
              icon: TrendingDown,
              tone: "amber",
            },
          ].map((stat) => {
            const toneMap = {
              green: {
                chip: "bg-[#3aa838]/10 text-[#3aa838]",
                num: "text-[#2f8a2f]",
              },
              rose: {
                chip: "bg-rose-50 text-rose-600",
                num: "text-rose-700",
              },
              amber: {
                chip: "bg-amber-50 text-amber-600",
                num: "text-amber-700",
              },
              teal: {
                chip: "bg-teal-50 text-teal-600",
                num: "text-teal-700",
              },
              slate: {
                chip: "bg-slate-100 text-slate-600",
                num: "text-slate-900",
              },
            } as const;
            const t = toneMap[stat.tone as keyof typeof toneMap];
            const Icon = stat.icon;

            return (
              <Card
                key={stat.title}
                className="overflow-hidden border-slate-200 shadow-sm"
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {stat.title}
                      </div>
                      <div
                        className={`mt-1 truncate text-lg font-bold tabular-nums ${t.num}`}
                      >
                        {formatAmount(Math.abs(stat.value))}
                      </div>
                    </div>
                    <div className={`shrink-0 rounded-lg p-1.5 ${t.chip}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* ============ FILTER BAR ============ */}
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <div className="relative w-full max-w-[280px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by account name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 pl-8 text-sm focus-visible:ring-[#3aa838]"
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

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-[#3aa838]"
          >
            <option value="all">All types</option>
            <option value="Asset">Asset</option>
            <option value="Liability">Liability</option>
            <option value="Equity">Equity</option>
            <option value="Revenue">Revenue</option>
            <option value="Expense">Expense</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-[#3aa838]"
          >
            <option value="all">All status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>

          <Button
            variant="outline"
            size="sm"
            onClick={expandAll}
            className="h-9"
            title="Expand all"
          >
            <ChevronsUpDown className="mr-1.5 h-3.5 w-3.5" />
            Expand
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={collapseAll}
            className="h-9"
            title="Collapse all"
          >
            <ChevronsDownUp className="mr-1.5 h-3.5 w-3.5" />
            Collapse
          </Button>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground tabular-nums">
              {collectAllIds(filteredAccounts).length} shown
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="h-9"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* ============ TABLE ============ */}
        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <div className="sticky top-0 z-10 hidden border-b border-slate-200 bg-slate-50 md:grid md:grid-cols-12 md:gap-2 md:px-3 md:py-2.5">
                <div className="col-span-2 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                  Code
                </div>
                <div className="col-span-3 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                  Name
                </div>
                <div className="col-span-1 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                  Type
                </div>
                <div className="col-span-2 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                  Category
                </div>
                <div className="col-span-2 text-right text-[10px] font-medium uppercase tracking-wide text-slate-600">
                  Opening balance
                </div>
                <div className="col-span-1 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                  Status
                </div>
                <div className="col-span-1 pr-2 text-right text-[10px] font-medium uppercase tracking-wide text-slate-600">
                  Actions
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Loading accounts...
                </div>
              ) : filteredAccounts.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-3 text-muted-foreground">
                    <div className="rounded-full bg-slate-100 p-3">
                      <Search className="h-6 w-6" />
                    </div>
                    <div className="text-sm font-medium text-slate-700">
                      No accounts found
                    </div>
                    <div className="text-xs">
                      {searchTerm || filterType !== "all" || filterStatus !== "all"
                        ? "Try adjusting your search or filters."
                        : "Start by adding a root account."}
                    </div>
                    {(searchTerm ||
                      filterType !== "all" ||
                      filterStatus !== "all") && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSearchTerm("");
                          setFilterType("all");
                          setFilterStatus("all");
                        }}
                      >
                        <X className="mr-1.5 h-3.5 w-3.5" />
                        Clear filters
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  {filteredAccounts.map((account) => renderAccountRow(account))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ============ ADD DIALOG ============ */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="text-base">
                {parentForChild ? "Add sub-account" : "Add root account"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {parentForChild
                  ? `Create a new account under "${parentForChild.name}"`
                  : "Create a new root account in your chart of accounts"}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Account code</Label>
                  <Input
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value })
                    }
                    placeholder="e.g. 1050"
                    className="h-9 text-sm focus-visible:ring-[#3aa838]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Account name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g. Prepaid Expenses"
                    className="h-9 text-sm focus-visible:ring-[#3aa838]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(v: any) =>
                      setFormData({ ...formData, type: v })
                    }
                  >
                    <SelectTrigger className="h-9 text-sm">
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
                <div className="space-y-1.5">
                  <Label className="text-xs">Category</Label>
                  <Input
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    placeholder="e.g. Current Assets"
                    className="h-9 text-sm focus-visible:ring-[#3aa838]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Opening balance</Label>
                  <Input
                    type="number"
                    value={formData.balance}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        balance: Number.parseFloat(e.target.value) || 0,
                      })
                    }
                    className="h-9 text-sm focus-visible:ring-[#3aa838]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Currency</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(v) =>
                      setFormData({ ...formData, currency: v })
                    }
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BDT">BDT</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(v: any) =>
                      setFormData({ ...formData, status: v })
                    }
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Optional account description"
                  rows={2}
                  className="text-sm focus-visible:ring-[#3aa838]"
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
              <Button
                onClick={handleAddAccount}
                className="bg-[#3aa838] text-white hover:bg-[#2f8a2f]"
              >
                {parentForChild ? "Add sub-account" : "Create account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ============ EDIT DIALOG ============ */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="text-base">Edit account</DialogTitle>
              <DialogDescription className="text-xs">
                Update account information — this will not overwrite computed
                balances.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Account code</Label>
                  <Input
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value })
                    }
                    className="h-9 text-sm focus-visible:ring-[#3aa838]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Account name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="h-9 text-sm focus-visible:ring-[#3aa838]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(v: any) =>
                      setFormData({ ...formData, type: v })
                    }
                  >
                    <SelectTrigger className="h-9 text-sm">
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
                <div className="space-y-1.5">
                  <Label className="text-xs">Category</Label>
                  <Input
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    className="h-9 text-sm focus-visible:ring-[#3aa838]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Opening balance</Label>
                  <Input
                    type="number"
                    value={formData.balance}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        balance: Number.parseFloat(e.target.value) || 0,
                      })
                    }
                    className="h-9 text-sm focus-visible:ring-[#3aa838]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Currency</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(v) =>
                      setFormData({ ...formData, currency: v })
                    }
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BDT">BDT</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(v: any) =>
                      setFormData({ ...formData, status: v })
                    }
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={2}
                  className="text-sm focus-visible:ring-[#3aa838]"
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
              <Button
                onClick={handleEditAccount}
                className="bg-[#3aa838] text-white hover:bg-[#2f8a2f]"
              >
                Save changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ============ DELETE DIALOG ============ */}
        <Dialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base text-rose-600">
                Delete account
              </DialogTitle>
              <DialogDescription className="text-xs">
                Delete <strong>{selectedAccount?.name}</strong> (
                {selectedAccount?.code})? This cannot be undone and may affect
                financial reports.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDeleteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                className="bg-rose-600 hover:bg-rose-700"
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}