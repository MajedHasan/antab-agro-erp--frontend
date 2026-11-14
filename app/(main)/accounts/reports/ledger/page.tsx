// app/ledger/page.tsx
"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import {
  Search,
  Download,
  Filter,
  Calendar,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Eye,
  Layers,
  Wallet,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowUp,
  ArrowDown,
  X,
  Loader2,
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

type VoucherLine = {
  accountId?: any;
  debit?: number;
  credit?: number;
  narration?: string;
};

type VoucherDetail = {
  _id: string;
  voucherNo?: string;
  date?: string;
  type?: string;
  reference?: string;
  narration?: string;
  status?: string;
  lines?: VoucherLine[];
  createdBy?: any;
};

type LedgerSummary = {
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  transactionCount: number;
  avgTransaction: number;
};

/* ---------- palette per account type ---------- */
const ACCOUNT_TYPE_META: Record<
  AccountNode["type"],
  { dot: string; badge: string }
> = {
  Asset: {
    dot: "bg-[#3aa838]",
    badge: "bg-[#3aa838]/10 text-[#2f8a2f] border-[#3aa838]/30",
  },
  Liability: {
    dot: "bg-rose-500",
    badge: "bg-rose-50 text-rose-700 border-rose-200",
  },
  Equity: {
    dot: "bg-slate-500",
    badge: "bg-slate-100 text-slate-700 border-slate-200",
  },
  Revenue: {
    dot: "bg-teal-500",
    badge: "bg-teal-50 text-teal-700 border-teal-200",
  },
  Expense: {
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
  },
};

const TYPE_PRIORITY: Record<AccountNode["type"], number> = {
  Asset: 1,
  Liability: 2,
  Equity: 3,
  Revenue: 4,
  Expense: 5,
};

/* ---------- sort tree (fixes bottom-to-top issue) ---------- */
function sortTree(nodes: AccountNode[]): AccountNode[] {
  return [...nodes]
    .sort((a, b) => {
      const pa = TYPE_PRIORITY[a.type] ?? 99;
      const pb = TYPE_PRIORITY[b.type] ?? 99;
      if (pa !== pb) return pa - pb;
      return String(a.code || "").localeCompare(String(b.code || ""));
    })
    .map((node) => ({
      ...node,
      children: node.children ? sortTree(node.children) : undefined,
    }));
}

/* ---------- helpers ---------- */
const formatTaka = (n = 0) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

function statusBadge(status: string) {
  if (status === "Approved")
    return (
      <Badge className="border border-[#3aa838]/30 bg-[#3aa838]/10 text-[10px] font-semibold text-[#2f8a2f]">
        Approved
      </Badge>
    );
  if (status === "Pending")
    return (
      <Badge className="border border-amber-200 bg-amber-50 text-[10px] font-semibold text-amber-700">
        Pending
      </Badge>
    );
  if (status === "Rejected")
    return (
      <Badge className="border border-rose-200 bg-rose-50 text-[10px] font-semibold text-rose-700">
        Rejected
      </Badge>
    );
  return (
    <Badge className="border border-slate-200 bg-slate-100 text-[10px] font-semibold text-slate-700">
      {status || "—"}
    </Badge>
  );
}

function lineAccountLabel(accountId: any): { code: string; name: string } {
  if (!accountId) return { code: "", name: "—" };
  if (typeof accountId === "string") return { code: "", name: accountId };
  return {
    code: accountId.code || "",
    name: accountId.name || accountId.label || "—",
  };
}

/* ---------- Account Tree Item ---------- */
function AccountTreeItem({
  node,
  depth,
  selectedId,
  onSelect,
  searchTerm,
  defaultExpandDepth,
}: {
  node: AccountNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  searchTerm: string;
  defaultExpandDepth: number;
}) {
  const [expanded, setExpanded] = useState(depth < defaultExpandDepth);
  const hasChildren = !!node.children && node.children.length > 0;
  const balance = node.closingBalance ?? 0;
  const meta = ACCOUNT_TYPE_META[node.type] || ACCOUNT_TYPE_META.Asset;

  const matchesSearch =
    !searchTerm ||
    node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    node.code.toLowerCase().includes(searchTerm.toLowerCase());

  if (!matchesSearch && !hasChildren) return null;

  const effectiveExpanded = searchTerm ? true : expanded;

  return (
    <div>
      <div
        className={cn(
          "flex cursor-pointer items-center justify-between rounded px-1.5 py-1 text-xs transition-colors",
          selectedId === node._id
            ? "bg-[#3aa838]/10 font-medium text-[#2f8a2f]"
            : "hover:bg-slate-50",
        )}
        style={{ paddingLeft: `${depth * 14 + 6}px` }}
        onClick={() => {
          if (hasChildren) setExpanded(!expanded);
          onSelect(node._id);
        }}
      >
        <div className="flex min-w-0 items-center gap-1">
          {hasChildren ? (
            effectiveExpanded ? (
              <ChevronDown className="h-3 w-3 shrink-0 text-slate-400" />
            ) : (
              <ChevronRight className="h-3 w-3 shrink-0 text-slate-400" />
            )
          ) : (
            <span className="w-3 shrink-0" />
          )}
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", meta.dot)} />
          <span className="mr-1 shrink-0 font-mono text-[10px] text-slate-500">
            {node.code}
          </span>
          <span className="truncate">{node.name}</span>
        </div>
        <span
          className={cn(
            "ml-2 shrink-0 font-mono text-[10px] tabular-nums",
            balance >= 0 ? "text-slate-700" : "text-rose-600",
          )}
        >
          {formatTaka(balance)}
        </span>
      </div>

      {effectiveExpanded &&
        hasChildren &&
        node.children!.map((child) => (
          <AccountTreeItem
            key={child._id}
            node={child}
            depth={depth + 1}
            selectedId={selectedId}
            onSelect={onSelect}
            searchTerm={searchTerm}
            defaultExpandDepth={defaultExpandDepth}
          />
        ))}
    </div>
  );
}

/* ---------- Stat card ---------- */
function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "slate" | "green" | "rose";
}) {
  const toneMap = {
    slate: "text-slate-900",
    green: "text-[#2f8a2f]",
    rose: "text-rose-700",
  } as const;
  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <CardContent className="p-3">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className={cn("mt-1 truncate text-lg font-bold tabular-nums", toneMap[tone])}>
          ৳ {value}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Voucher Preview (used inside the modal) ---------- */
function VoucherPreview({
  tx,
  voucher,
  loading,
}: {
  tx: Transaction;
  voucher: VoucherDetail | null;
  loading: boolean;
}) {
  // If we have full voucher lines, use them; else fall back to the single line
  const lines: Array<{
    code: string;
    name: string;
    narration: string;
    debit: number;
    credit: number;
  }> = useMemo(() => {
    if (voucher?.lines && voucher.lines.length > 0) {
      return voucher.lines.map((l) => {
        const acc = lineAccountLabel(l.accountId);
        return {
          code: acc.code,
          name: acc.name,
          narration: l.narration || "",
          debit: Number(l.debit || 0),
          credit: Number(l.credit || 0),
        };
      });
    }
    return [
      {
        code: tx.accountCode || "",
        name: tx.accountName || "—",
        narration: tx.description || "",
        debit: Number(tx.debit || 0),
        credit: Number(tx.credit || 0),
      },
    ];
  }, [voucher, tx]);

  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);

  const header = voucher || tx.journalEntry;
  const voucherNo =
    (voucher as any)?.voucherNo || tx.journalEntry.entryNumber || "—";
  const date = (voucher as any)?.date || tx.date;
  const type = (voucher as any)?.type || tx.type || "—";
  const reference = (voucher as any)?.reference || tx.reference || "—";
  const narration = (voucher as any)?.narration || tx.description || "";
  const status = (voucher as any)?.status || tx.journalEntry.status || "—";
  const createdByName =
    typeof (voucher as any)?.createdBy === "object"
      ? (voucher as any)?.createdBy?.name
      : tx.journalEntry.createdBy;

  return (
    <div className="overflow-hidden rounded-lg border-2 border-slate-900">
      {/* Voucher header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 px-4 py-3 text-white">
        <div>
          <div className="text-[9px] uppercase tracking-[0.15em] text-white/60">
            Transaction Voucher
          </div>
          <div className="font-mono text-base font-bold tabular-nums">
            {voucherNo}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-wider text-white/60">
            Date
          </div>
          <div className="text-sm font-semibold tabular-nums">
            {format(new Date(date), "dd MMM yyyy")}
          </div>
        </div>
      </div>

      {/* Meta strip */}
      <div className="grid grid-cols-3 gap-0 border-b border-slate-200 bg-slate-50">
        <div className="border-r border-slate-200 px-3 py-2">
          <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
            Reference
          </div>
          <div className="truncate font-mono text-[11px] font-semibold text-slate-900">
            {reference}
          </div>
        </div>
        <div className="border-r border-slate-200 px-3 py-2">
          <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
            Type
          </div>
          <div className="truncate text-[11px] font-semibold text-slate-900">
            {type}
          </div>
        </div>
        <div className="px-3 py-2">
          <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
            Status
          </div>
          <div>{statusBadge(String(status))}</div>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading voucher lines...
        </div>
      ) : (
        <>
          {/* Lines table */}
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b-2 border-slate-900 bg-slate-100">
                <th className="w-[70px] px-2 py-2 text-left text-[9px] font-bold uppercase tracking-wide text-slate-700">
                  Code
                </th>
                <th className="px-2 py-2 text-left text-[9px] font-bold uppercase tracking-wide text-slate-700">
                  Account
                </th>
                <th className="px-2 py-2 text-left text-[9px] font-bold uppercase tracking-wide text-slate-700">
                  Narration
                </th>
                <th className="w-[90px] px-2 py-2 text-right text-[9px] font-bold uppercase tracking-wide text-slate-700">
                  Debit
                </th>
                <th className="w-[90px] px-2 py-2 text-right text-[9px] font-bold uppercase tracking-wide text-slate-700">
                  Credit
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr
                  key={i}
                  className={cn(
                    "border-b border-slate-200",
                    i % 2 === 1 && "bg-slate-50/60",
                  )}
                >
                  <td className="px-2 py-1.5 font-mono text-[10px] text-slate-600">
                    {l.code}
                  </td>
                  <td className="px-2 py-1.5 font-medium text-slate-900">
                    {l.name}
                  </td>
                  <td className="px-2 py-1.5 text-slate-600">{l.narration}</td>
                  <td className="px-2 py-1.5 text-right font-mono font-semibold tabular-nums text-[#2f8a2f]">
                    {l.debit > 0 ? formatTaka(l.debit) : ""}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono font-semibold tabular-nums text-rose-600">
                    {l.credit > 0 ? formatTaka(l.credit) : ""}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-900 bg-slate-100">
                <td
                  colSpan={3}
                  className="px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wide text-slate-700"
                >
                  Total
                </td>
                <td className="px-2 py-2 text-right font-mono text-xs font-bold tabular-nums text-[#2f8a2f]">
                  {formatTaka(totalDebit)}
                </td>
                <td className="px-2 py-2 text-right font-mono text-xs font-bold tabular-nums text-rose-600">
                  {formatTaka(totalCredit)}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Narration */}
          {narration && (
            <div className="border-t border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
                Narration
              </div>
              <div className="mt-0.5 text-[11px] text-slate-700">
                {narration}
              </div>
            </div>
          )}

          {/* Footer meta */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-100 px-3 py-1.5 text-[10px] text-slate-600">
            <div>
              <span className="text-muted-foreground">Created by:</span>{" "}
              <b className="text-slate-900">{createdByName || "—"}</b>
            </div>
            <div className="tabular-nums">
              {format(new Date(tx.journalEntry.createdAt), "dd MMM yy · HH:mm")}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- Main Page ---------- */
export default function LedgerPage() {
  /* --- Sidebar --- */
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);

  /* --- Date range --- */
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  });

  /* --- Account tree --- */
  const [tree, setTree] = useState<AccountNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    null,
  );
  const [accountSearch, setAccountSearch] = useState("");
  const [accountTypeFilter, setAccountTypeFilter] = useState<string>("all");
  const [expandAllDepth, setExpandAllDepth] = useState<number>(2);

  /* --- Selected account --- */
  const selectedAccount = useMemo(() => {
    const flat = flattenTree(tree);
    return flat.find((a) => a._id === selectedAccountId) || null;
  }, [tree, selectedAccountId]);

  /* --- Transactions --- */
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

  /* --- Summary --- */
  const [summary, setSummary] = useState<LedgerSummary | null>(null);

  /* --- Detail modal --- */
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [voucherDetail, setVoucherDetail] = useState<VoucherDetail | null>(
    null,
  );
  const [voucherLoading, setVoucherLoading] = useState(false);

  /* ---------- Sidebar persistence + drag ---------- */
  useEffect(() => {
    const saved = localStorage.getItem("ledger-sidebar-width");
    if (saved) {
      const w = Number(saved);
      if (w >= 240 && w <= 480) setSidebarWidth(w);
    }
  }, []);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const onMove = (e: MouseEvent) => {
      const newWidth = Math.min(480, Math.max(240, e.clientX));
      setSidebarWidth(newWidth);
    };
    const onUp = () => {
      setIsResizing(false);
      localStorage.setItem("ledger-sidebar-width", String(sidebarWidth));
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, sidebarWidth]);

  /* ---------- Flatten helper ---------- */
  function flattenTree(nodes: AccountNode[]): AccountNode[] {
    let flat: AccountNode[] = [];
    for (const n of nodes) {
      flat.push(n);
      if (n.children) flat = flat.concat(flattenTree(n.children));
    }
    return flat;
  }

  /* ---------- Fetch tree (sorted) ---------- */
  const fetchTree = useCallback(async () => {
    setTreeLoading(true);
    try {
      const params: any = {};
      if (dateRange?.from) params.from = dateRange.from.toISOString();
      if (dateRange?.to) params.to = dateRange.to.toISOString();
      const res = await api.get("/accounts/tree", { params });
      const data = (res?.data?.data ?? []) as AccountNode[];

      // 🆕 sort so tree renders top → bottom by type, then code
      const sorted = sortTree(data);
      setTree(sorted);

      if (!selectedAccountId && sorted.length > 0) {
        const flat = flattenTree(sorted);
        const first = flat.find((a) => a._id);
        if (first) setSelectedAccountId(first._id);
      }
    } catch {
      toast.error("Failed to load chart of accounts");
    } finally {
      setTreeLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  /* ---------- Filter tree (keeps sort) ---------- */
  const filteredTree = useMemo(() => {
    const filter = (nodes: AccountNode[]): AccountNode[] => {
      return nodes
        .map((node) => {
          const children = node.children ? filter(node.children) : [];
          const matchesType =
            accountTypeFilter === "all" || node.type === accountTypeFilter;
          const matchesSearch =
            !accountSearch ||
            node.name.toLowerCase().includes(accountSearch.toLowerCase()) ||
            node.code.toLowerCase().includes(accountSearch.toLowerCase());
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

  /* ---------- Fetch transactions ---------- */
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
      const res = await api.get(`/ledger/${selectedAccountId}/transactions`, {
        params,
      });
      const data = res?.data?.data;
      setTransactions(data?.transactions ?? []);
      setTxTotal(data?.meta?.total ?? 0);
    } catch {
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

  /* ---------- Fetch summary ---------- */
  const fetchSummary = useCallback(async () => {
    if (!selectedAccountId) return;
    try {
      const params: any = {};
      if (dateRange?.from) params.from = dateRange.from.toISOString();
      if (dateRange?.to) params.to = dateRange.to.toISOString();
      const res = await api.get(`/ledger/${selectedAccountId}/summary`, {
        params,
      });
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
      } else {
        setSummary(null);
      }
    } catch {
      toast.error("Failed to load summary");
    }
  }, [selectedAccountId, dateRange]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  /* ---------- Fetch full voucher for modal ---------- */
  useEffect(() => {
    if (!detailOpen || !selectedTx) {
      setVoucherDetail(null);
      return;
    }
    const voucherId =
      selectedTx.journalEntry?.id || (selectedTx as any).voucherId;
    if (!voucherId) {
      setVoucherDetail(null);
      return;
    }
    let cancelled = false;
    setVoucherLoading(true);
    (async () => {
      try {
        const res = await api.get(`/vouchers/${voucherId}`);
        if (!cancelled) setVoucherDetail(res?.data?.data ?? null);
      } catch {
        if (!cancelled) setVoucherDetail(null);
      } finally {
        if (!cancelled) setVoucherLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detailOpen, selectedTx]);

  /* ---------- CSV export ---------- */
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

  /* ---------- Print content (uses voucher lines if available) ---------- */
  const printContentForTx = useMemo(() => {
    if (!selectedTx) return "";

    const lines: Array<{
      code: string;
      name: string;
      narration: string;
      debit: number;
      credit: number;
    }> =
      voucherDetail?.lines && voucherDetail.lines.length > 0
        ? voucherDetail.lines.map((l) => {
            const acc = lineAccountLabel(l.accountId);
            return {
              code: acc.code,
              name: acc.name,
              narration: l.narration || "",
              debit: Number(l.debit || 0),
              credit: Number(l.credit || 0),
            };
          })
        : [
            {
              code: selectedTx.accountCode || "",
              name: selectedTx.accountName || "—",
              narration: selectedTx.description || "",
              debit: Number(selectedTx.debit || 0),
              credit: Number(selectedTx.credit || 0),
            },
          ];

    const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
    const voucherNo =
      voucherDetail?.voucherNo || selectedTx.journalEntry.entryNumber || "";
    const dateStr = voucherDetail?.date || selectedTx.date;
    const reference = voucherDetail?.reference || selectedTx.reference || "";
    const narration = voucherDetail?.narration || selectedTx.description || "";
    const status = voucherDetail?.status || selectedTx.journalEntry.status;

    const rowsHtml = lines
      .map(
        (l) => `
        <tr>
          <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-family:monospace;">${l.code}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-weight:600;">${l.name}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${l.narration}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${l.debit > 0 ? formatTaka(l.debit) : ""}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${l.credit > 0 ? formatTaka(l.credit) : ""}</td>
        </tr>`,
      )
      .join("");

    return `
      <div style="font-family:Arial,Helvetica,sans-serif;border:2px solid #0f172a;padding:0;border-radius:6px;overflow:hidden;">
        <div style="background:#0f172a;color:#fff;padding:16px 24px;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:10px;letter-spacing:.15em;text-transform:uppercase;opacity:.7;">Transaction Voucher</div>
            <div style="font-size:20px;font-weight:700;font-family:monospace;">${voucherNo}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;opacity:.7;">Date</div>
            <div style="font-size:14px;font-weight:700;">${dateStr ? new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;border-bottom:1px solid #e2e8f0;background:#f8fafc;">
          <div style="padding:8px 12px;border-right:1px solid #e2e8f0;">
            <div style="font-size:9px;text-transform:uppercase;color:#64748b;">Reference</div>
            <div style="font-size:11px;font-family:monospace;font-weight:700;">${reference}</div>
          </div>
          <div style="padding:8px 12px;border-right:1px solid #e2e8f0;">
            <div style="font-size:9px;text-transform:uppercase;color:#64748b;">Type</div>
            <div style="font-size:11px;font-weight:700;">${selectedTx.type || ""}</div>
          </div>
          <div style="padding:8px 12px;">
            <div style="font-size:9px;text-transform:uppercase;color:#64748b;">Status</div>
            <div style="font-size:11px;font-weight:700;">${status}</div>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <thead>
            <tr style="background:#f1f5f9;border-bottom:2px solid #0f172a;">
              <th style="text-align:left;padding:8px;font-size:9px;text-transform:uppercase;letter-spacing:.05em;">Code</th>
              <th style="text-align:left;padding:8px;font-size:9px;text-transform:uppercase;letter-spacing:.05em;">Account</th>
              <th style="text-align:left;padding:8px;font-size:9px;text-transform:uppercase;letter-spacing:.05em;">Narration</th>
              <th style="text-align:right;padding:8px;font-size:9px;text-transform:uppercase;letter-spacing:.05em;">Debit</th>
              <th style="text-align:right;padding:8px;font-size:9px;text-transform:uppercase;letter-spacing:.05em;">Credit</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot>
            <tr style="background:#f1f5f9;border-top:2px solid #0f172a;font-weight:700;">
              <td colspan="3" style="padding:8px;text-align:right;font-size:10px;text-transform:uppercase;">Total</td>
              <td style="padding:8px;text-align:right;font-family:monospace;">${formatTaka(totalDebit)}</td>
              <td style="padding:8px;text-align:right;font-family:monospace;">${formatTaka(totalCredit)}</td>
            </tr>
          </tfoot>
        </table>
        ${
          narration
            ? `<div style="padding:10px 12px;background:#f8fafc;border-top:1px solid #e2e8f0;">
                <div style="font-size:9px;text-transform:uppercase;color:#64748b;">Narration</div>
                <div style="font-size:11px;">${narration}</div>
              </div>`
            : ""
        }
        <div style="padding:6px 12px;background:#f1f5f9;border-top:1px solid #e2e8f0;font-size:10px;color:#64748b;display:flex;justify-content:space-between;">
          <span>Created by: <strong>${selectedTx.journalEntry.createdBy || "—"}</strong></span>
          <span>${new Date(selectedTx.journalEntry.createdAt).toLocaleString("en-GB")}</span>
        </div>
      </div>
    `;
  }, [selectedTx, voucherDetail]);

  const typeMeta = selectedAccount
    ? ACCOUNT_TYPE_META[selectedAccount.type]
    : null;

  /* ---------- Render ---------- */
  return (
    <div
      className={cn(
        "flex h-screen overflow-hidden bg-slate-50",
        isResizing && "select-none",
      )}
    >
      {/* ============ SIDEBAR ============ */}
      <aside
        className={cn(
          "flex shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-150",
          !sidebarOpen && "overflow-hidden",
        )}
        style={{ width: sidebarOpen ? sidebarWidth : 0 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#3aa838]/10">
              <Layers className="h-3.5 w-3.5 text-[#3aa838]" />
            </div>
            <span className="text-sm font-semibold">Accounts</span>
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

        {/* Filters */}
        <div className="space-y-2 border-b border-slate-200 p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search code or name..."
              value={accountSearch}
              onChange={(e) => setAccountSearch(e.target.value)}
              className="h-8 pl-8 text-xs focus-visible:ring-[#3aa838]"
            />
            {accountSearch && (
              <button
                onClick={() => setAccountSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <Select
            value={accountTypeFilter}
            onValueChange={setAccountTypeFilter}
          >
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
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 flex-1 text-[10px]"
              onClick={() => setExpandAllDepth(999)}
            >
              Expand all
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 flex-1 text-[10px]"
              onClick={() => setExpandAllDepth(0)}
            >
              Collapse
            </Button>
          </div>
        </div>

        {/* Tree */}
        <div key={expandAllDepth} className="flex-1 overflow-auto p-1.5">
          {treeLoading ? (
            <div className="py-10 text-center text-xs text-muted-foreground">
              Loading...
            </div>
          ) : filteredTree.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
              <div className="rounded-full bg-slate-100 p-2">
                <Search className="h-4 w-4" />
              </div>
              <div className="text-xs">No accounts</div>
              {(accountSearch || accountTypeFilter !== "all") && (
                <button
                  onClick={() => {
                    setAccountSearch("");
                    setAccountTypeFilter("all");
                  }}
                  className="text-[10px] font-medium text-[#2f8a2f] underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            filteredTree.map((node) => (
              <AccountTreeItem
                key={node._id}
                node={node}
                depth={0}
                selectedId={selectedAccountId}
                onSelect={setSelectedAccountId}
                searchTerm={accountSearch}
                defaultExpandDepth={expandAllDepth}
              />
            ))
          )}
        </div>
      </aside>

      {/* 🆕 Resize handle */}
      {sidebarOpen && (
        <div
          onMouseDown={startResize}
          onDoubleClick={() => {
            setSidebarWidth(320);
            localStorage.setItem("ledger-sidebar-width", "320");
          }}
          className={cn(
            "group relative w-1 cursor-col-resize transition-colors",
            isResizing
              ? "bg-[#3aa838]"
              : "bg-transparent hover:bg-[#3aa838]/40",
          )}
          title="Drag to resize · double-click to reset"
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
        </div>
      )}

      {/* ============ MAIN ============ */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-7xl p-3 md:p-4">
          {/* Hero */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {!sidebarOpen && (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setSidebarOpen(true)}
                >
                  <PanelLeftOpen className="h-4 w-4" />
                </Button>
              )}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#3aa838]/10">
                <Wallet className="h-4 w-4 text-[#3aa838]" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-base font-semibold leading-tight">
                    {selectedAccount?.name || "Select an account"}
                  </h1>
                  {selectedAccount && typeMeta && (
                    <Badge
                      className={cn(
                        "border text-[10px] font-semibold",
                        typeMeta.badge,
                      )}
                    >
                      {selectedAccount.type}
                    </Badge>
                  )}
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {selectedAccount
                    ? `${selectedAccount.code} · ${txTotal} transaction${
                        txTotal !== 1 ? "s" : ""
                      }`
                    : "Pick an account from the sidebar"}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs">
                    <Calendar className="mr-1.5 h-3.5 w-3.5" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "MMM dd")} –{" "}
                          {format(dateRange.to, "MMM dd")}
                        </>
                      ) : (
                        format(dateRange.from, "MMM dd")
                      )
                    ) : (
                      "Pick range"
                    )}
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
                onClick={() =>
                  setDateRange({ from: undefined, to: undefined })
                }
              >
                Clear
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
                onClick={exportCSV}
                disabled={!selectedAccount}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Export
              </Button>
            </div>
          </div>

          {/* Empty state */}
          {!selectedAccount ? (
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <CardContent className="flex flex-col items-center justify-center gap-3 p-16 text-center">
                <div className="rounded-full bg-slate-100 p-4">
                  <Wallet className="h-8 w-8 text-slate-400" />
                </div>
                <div>
                  <div className="text-base font-semibold text-slate-800">
                    No account selected
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Pick an account from the sidebar to view its ledger.
                  </div>
                </div>
                {!sidebarOpen && (
                  <Button
                    size="sm"
                    onClick={() => setSidebarOpen(true)}
                    className="bg-[#3aa838] text-white hover:bg-[#2f8a2f]"
                  >
                    <PanelLeftOpen className="mr-1.5 h-3.5 w-3.5" />
                    Open sidebar
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Summary */}
              {summary && (
                <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                  <StatCard
                    label="Opening"
                    value={formatTaka(summary.openingBalance)}
                    tone="slate"
                  />
                  <StatCard
                    label="Total debit"
                    value={formatTaka(summary.totalDebit)}
                    tone="green"
                  />
                  <StatCard
                    label="Total credit"
                    value={formatTaka(summary.totalCredit)}
                    tone="rose"
                  />
                  <StatCard
                    label="Closing"
                    value={formatTaka(summary.closingBalance)}
                    tone={summary.closingBalance >= 0 ? "green" : "rose"}
                  />
                </div>
              )}

              {/* Filters */}
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                <div className="relative w-full max-w-[240px]">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search transactions..."
                    value={txSearch}
                    onChange={(e) => {
                      setTxSearch(e.target.value);
                      setTxPage(1);
                    }}
                    className="h-9 pl-8 text-sm focus-visible:ring-[#3aa838]"
                  />
                </div>

                <select
                  value={txTypeFilter}
                  onChange={(e) => {
                    setTxTypeFilter(e.target.value);
                    setTxPage(1);
                  }}
                  className="h-9 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-[#3aa838]"
                >
                  <option value="all">All types</option>
                  <option value="BankReceive">Bank Receive</option>
                  <option value="CashReceive">Cash Receive</option>
                  <option value="BankPayment">Bank Payment</option>
                  <option value="CashPayment">Cash Payment</option>
                  <option value="Journal">Journal</option>
                  <option value="Contra">Contra</option>
                </select>

                <select
                  value={txStatusFilter}
                  onChange={(e) => {
                    setTxStatusFilter(e.target.value);
                    setTxPage(1);
                  }}
                  className="h-9 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-[#3aa838]"
                >
                  <option value="all">All status</option>
                  <option value="Approved">Approved</option>
                  <option value="Pending">Pending</option>
                  <option value="Rejected">Rejected</option>
                </select>

                {(txSearch ||
                  txTypeFilter !== "all" ||
                  txStatusFilter !== "all") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setTxSearch("");
                      setTxTypeFilter("all");
                      setTxStatusFilter("all");
                      setTxPage(1);
                    }}
                    className="h-9 text-slate-500"
                  >
                    <Filter className="mr-1 h-3.5 w-3.5" />
                    Clear
                  </Button>
                )}

                <div className="ml-auto text-xs text-muted-foreground tabular-nums">
                  {txTotal} records
                </div>
              </div>

              {/* Table */}
              <Card className="overflow-hidden border-slate-200 shadow-sm">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 hover:bg-slate-50">
                          <TableHead className="w-[100px] px-3 py-2.5">
                            <button
                              className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-slate-600"
                              onClick={() => {
                                setTxSortBy("date");
                                setTxSortDir((d) =>
                                  d === "asc" ? "desc" : "asc",
                                );
                              }}
                            >
                              Date
                              {txSortBy === "date" &&
                                (txSortDir === "asc" ? (
                                  <ArrowUp className="h-2.5 w-2.5" />
                                ) : (
                                  <ArrowDown className="h-2.5 w-2.5" />
                                ))}
                            </button>
                          </TableHead>
                          <TableHead className="px-3 py-2.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                            Reference
                          </TableHead>
                          <TableHead className="px-3 py-2.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                            Description
                          </TableHead>
                          <TableHead className="px-3 py-2.5 text-right text-[10px] font-medium uppercase tracking-wide text-slate-600">
                            Debit
                          </TableHead>
                          <TableHead className="px-3 py-2.5 text-right text-[10px] font-medium uppercase tracking-wide text-slate-600">
                            Credit
                          </TableHead>
                          <TableHead className="px-3 py-2.5 text-right text-[10px] font-medium uppercase tracking-wide text-slate-600">
                            Balance
                          </TableHead>
                          <TableHead className="px-3 py-2.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                            Status
                          </TableHead>
                          <TableHead className="w-[50px] px-3 py-2.5"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {txLoading ? (
                          <TableRow>
                            <TableCell
                              colSpan={8}
                              className="py-12 text-center text-sm text-muted-foreground"
                            >
                              Loading...
                            </TableCell>
                          </TableRow>
                        ) : transactions.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="py-16 text-center">
                              <div className="mx-auto flex max-w-sm flex-col items-center gap-3 text-muted-foreground">
                                <div className="rounded-full bg-slate-100 p-3">
                                  <Wallet className="h-6 w-6" />
                                </div>
                                <div className="text-sm font-medium text-slate-700">
                                  No transactions found
                                </div>
                                <div className="text-xs">
                                  {(txSearch ||
                                    txTypeFilter !== "all" ||
                                    txStatusFilter !== "all") &&
                                    "Try adjusting your filters."}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          transactions.map((tx) => (
                            <TableRow
                              key={tx.id}
                              className="border-b border-slate-100 last:border-0 transition-colors hover:bg-slate-50/70"
                            >
                              <TableCell className="whitespace-nowrap px-3 py-2 text-xs font-medium tabular-nums text-slate-700">
                                {format(new Date(tx.date), "dd MMM yy")}
                              </TableCell>
                              <TableCell className="px-3 py-2 font-mono text-xs text-slate-600">
                                {tx.reference}
                              </TableCell>
                              <TableCell className="max-w-[250px] truncate px-3 py-2 text-xs text-slate-700">
                                {tx.description}
                              </TableCell>
                              <TableCell className="px-3 py-2 text-right text-xs font-semibold tabular-nums text-[#2f8a2f]">
                                {tx.debit > 0 ? formatTaka(tx.debit) : ""}
                              </TableCell>
                              <TableCell className="px-3 py-2 text-right text-xs font-semibold tabular-nums text-rose-600">
                                {tx.credit > 0 ? formatTaka(tx.credit) : ""}
                              </TableCell>
                              <TableCell
                                className={cn(
                                  "px-3 py-2 text-right font-mono text-xs font-semibold tabular-nums",
                                  tx.balance >= 0
                                    ? "text-slate-900"
                                    : "text-rose-600",
                                )}
                              >
                                {formatTaka(tx.balance)}
                              </TableCell>
                              <TableCell className="px-3 py-2">
                                {statusBadge(tx.journalEntry.status)}
                              </TableCell>
                              <TableCell className="px-3 py-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => {
                                    setSelectedTx(tx);
                                    setDetailOpen(true);
                                  }}
                                  title="View voucher"
                                >
                                  <Eye className="h-3.5 w-3.5" />
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
                    <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50/60 px-3 py-2 md:flex-row md:items-center md:justify-between">
                      <div className="text-xs text-muted-foreground">
                        Showing{" "}
                        <strong className="text-slate-900 tabular-nums">
                          {Math.min((txPage - 1) * txLimit + 1, txTotal)}
                        </strong>{" "}
                        –{" "}
                        <strong className="text-slate-900 tabular-nums">
                          {Math.min(txPage * txLimit, txTotal)}
                        </strong>{" "}
                        of <strong className="text-slate-900">{txTotal}</strong>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={String(txLimit)}
                          onChange={(e) => {
                            setTxLimit(Number(e.target.value));
                            setTxPage(1);
                          }}
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-[#3aa838]"
                        >
                          <option value="25">25/page</option>
                          <option value="50">50/page</option>
                          <option value="100">100/page</option>
                        </select>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => setTxPage(1)}
                          disabled={txPage === 1}
                        >
                          First
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                          disabled={txPage === 1}
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <span className="min-w-16 text-center text-xs text-muted-foreground">
                          Page{" "}
                          <strong className="text-slate-900">{txPage}</strong> /{" "}
                          {totalTxPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() =>
                            setTxPage((p) => Math.min(totalTxPages, p + 1))
                          }
                          disabled={txPage === totalTxPages}
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => setTxPage(totalTxPages)}
                          disabled={txPage === totalTxPages}
                        >
                          Last
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>

      {/* ============ VOUCHER MODAL ============ */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl p-4">
          <DialogHeader className="mb-2 flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3aa838]/10">
                <Wallet className="h-4 w-4 text-[#3aa838]" />
              </div>
              <div>
                <div className="text-sm font-semibold">Voucher details</div>
                <div className="text-[11px] text-muted-foreground">
                  {selectedTx?.journalEntry.entryNumber} ·{" "}
                  {selectedTx?.reference}
                </div>
              </div>
            </div>
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
          </DialogHeader>

          {selectedTx && (
            <VoucherPreview
              tx={selectedTx}
              voucher={voucherDetail}
              loading={voucherLoading}
            />
          )}

          <DialogFooter className="mt-2">
            <Button
              variant="ghost"
              onClick={() => setDetailOpen(false)}
              className="text-xs"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}