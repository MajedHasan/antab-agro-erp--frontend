"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast, Toaster } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  FileText,
  Banknote,
  Wallet,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Eye,
  Edit,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  HelpCircle,
  Receipt,
} from "lucide-react";

/* ────────────── Types ────────────── */
type CollectionItem = {
  _id: string;
  voucherNo: string;
  date: string;
  dealers: { dealerName: string }[];
  onlineCopy: {
    onlineCopyNo: string;
    onlineCopyTaka: number;
    bankDepositCharge: number;
  };
  status: string;
  summary: {
    totalDealers: number;
    totalInvoices: number;
    totalMoneyReceipts: number;
    totalMRAmount: number;
    totalCommission: number;
    bankDepositCharge: number;
    totalNetDeposited?: number;
  };
  createdAt: string;
};

/* ────────────── Helpers ────────────── */
const moneyFmt = (v: any) =>
  Number.isFinite(Number(v ?? 0))
    ? Number(v ?? 0).toLocaleString("en-BD", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "0.00";

const formatDate = (dateStr: string) =>
  dateStr
    ? new Date(dateStr).toLocaleDateString("en-BD", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "-";

const statusConfig: Record<
  string,
  {
    label: string;
    variant: "outline" | "default" | "secondary" | "destructive";
    icon: any;
  }
> = {
  SUBMITTED: { label: "Submitted", variant: "secondary", icon: Clock },
  UNDER_REVIEW: { label: "Review", variant: "default", icon: HelpCircle },
  APPROVED: { label: "Approved", variant: "outline", icon: CheckCircle2 },
  HOLD: { label: "Hold", variant: "destructive", icon: AlertCircle },
  DISPUTED: { label: "Disputed", variant: "destructive", icon: XCircle },
  CANCELLED: { label: "Cancelled", variant: "destructive", icon: XCircle },
};

const statusEndpoint: Record<string, string> = {
  SUBMITTED: "submit",
  UNDER_REVIEW: "review",
  APPROVED: "approve",
  HOLD: "hold",
  DISPUTED: "dispute",
  CANCELLED: "cancel",
};

const allowedTransitions: Record<string, string[]> = {
  SUBMITTED: ["UNDER_REVIEW", "APPROVED", "HOLD", "DISPUTED", "CANCELLED"],
  UNDER_REVIEW: ["APPROVED", "HOLD", "DISPUTED", "CANCELLED", "SUBMITTED"],
  HOLD: ["SUBMITTED", "UNDER_REVIEW", "DISPUTED", "CANCELLED", "APPROVED"],
  DISPUTED: ["SUBMITTED", "UNDER_REVIEW", "HOLD", "CANCELLED", "APPROVED"],
  APPROVED: [],
  CANCELLED: [],
};

export default function CollectionsListPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [filters, setFilters] = useState({
    q: "",
    status: "",
    dealerId: "",
    invoiceId: "",
    mrNo: "",
    onlineCopyNo: "",
    date: "",
  });

  const fetchCollections = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit, sort: "-createdAt" };
      if (filters.q) params.q = filters.q;
      // status "all" means no filter
      if (filters.status && filters.status !== "all")
        params.status = filters.status;
      if (filters.dealerId) params.dealerId = filters.dealerId;
      if (filters.invoiceId) params.invoiceId = filters.invoiceId;
      if (filters.mrNo) params.mrNo = filters.mrNo;
      if (filters.onlineCopyNo) params.onlineCopyNo = filters.onlineCopyNo;
      if (filters.date) params.date = filters.date;

      const res = await api.get("/collection", { params });
      const data = res?.data?.data ?? [];
      setCollections(data);
      setTotal(res?.data?.total ?? 0);
      setTotalPages(res?.data?.totalPages ?? 0);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load collections");
    } finally {
      setLoading(false);
    }
  }, [page, limit, filters]);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  const summaryStats = useMemo(() => {
    const stats = {
      totalCash: 0,
      totalCommission: 0,
      totalBankCharge: 0,
      totalNetDeposit: 0,
    };
    collections.forEach((c) => {
      if (c.summary) {
        stats.totalCash += c.summary.totalMRAmount || 0;
        stats.totalCommission += c.summary.totalCommission || 0;
        stats.totalBankCharge += c.summary.bankDepositCharge || 0;
        const net =
          c.summary.totalNetDeposited ??
          c.summary.totalMRAmount -
            c.summary.totalCommission -
            c.summary.bankDepositCharge;
        stats.totalNetDeposit += net;
      }
    });
    return stats;
  }, [collections]);

  const goToPage = (p: number) => {
    if (p >= 1 && p <= totalPages) setPage(p);
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    const endpoint = statusEndpoint[newStatus];
    if (!endpoint) return;
    try {
      await api.post(`/collection/${id}/status/${endpoint}`);
      toast.success(
        `Status changed to ${statusConfig[newStatus]?.label || newStatus}`,
      );
      fetchCollections();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Status change failed");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/20 to-white">
      <Toaster position="top-right" richColors />
      <div className="max-w-[1600px] mx-auto px-4 py-8 sm:px-6 lg:px-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8"
        >
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-indigo-500/10 to-blue-500/10 border border-indigo-200 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-3">
              <Banknote size={14} /> Collections
            </div>
            <h1 className="text-5xl font-extrabold tracking-tight text-slate-900">
              All Collections
            </h1>
            <p className="mt-2 text-slate-500 max-w-2xl text-lg">
              Manage dealer collections, money receipts, and bank deposits.
            </p>
          </div>
          <Button
            onClick={() => router.push("/accounts/collections/new")}
            size="lg"
            className="rounded-full px-8 py-3 font-bold shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 transition-all bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700"
          >
            <Plus size={18} className="mr-2" /> New Collection
          </Button>
        </motion.div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Cash Collected"
            value={moneyFmt(summaryStats.totalCash)}
            icon={Wallet}
          />
          <StatCard
            label="Commission"
            value={moneyFmt(summaryStats.totalCommission)}
            icon={TrendingUp}
          />
          <StatCard
            label="Bank Charges"
            value={moneyFmt(summaryStats.totalBankCharge)}
            icon={Receipt}
          />
          <StatCard
            label="Net Deposits"
            value={moneyFmt(summaryStats.totalNetDeposit)}
            accent
            icon={Banknote}
          />
        </div>

        {/* Filters */}
        <Card className="mb-6 border-0 shadow-2xl rounded-3xl overflow-hidden bg-white/90 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div>
                <Label className="text-sm font-medium">Search</Label>
                <Input
                  placeholder="Voucher, MR, Dealer..."
                  value={filters.q}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, q: e.target.value }))
                  }
                  className="rounded-xl"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Status</Label>
                <Select
                  value={filters.status || "all"}
                  onValueChange={(val) =>
                    setFilters((f) => ({
                      ...f,
                      status: val === "all" ? "" : val,
                    }))
                  }
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {Object.keys(statusConfig).map((s) => (
                      <SelectItem key={s} value={s}>
                        {statusConfig[s].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium">Date</Label>
                <Input
                  type="date"
                  value={filters.date}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, date: e.target.value }))
                  }
                  className="rounded-xl"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Online Copy</Label>
                <Input
                  placeholder="OC No"
                  value={filters.onlineCopyNo}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, onlineCopyNo: e.target.value }))
                  }
                  className="rounded-xl"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">MR No</Label>
                <Input
                  placeholder="MR No"
                  value={filters.mrNo}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, mrNo: e.target.value }))
                  }
                  className="rounded-xl"
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={() => {
                    setPage(1);
                    fetchCollections();
                  }}
                  variant="outline"
                  className="w-full rounded-xl"
                >
                  <Search size={16} className="mr-2" /> Apply
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Table */}
        <Card className="border-0 shadow-2xl rounded-3xl overflow-hidden bg-white/90 backdrop-blur-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-slate-200">
                  <TableHead className="font-semibold text-slate-800">
                    Voucher No
                  </TableHead>
                  <TableHead className="font-semibold text-slate-800">
                    Date
                  </TableHead>
                  <TableHead className="font-semibold text-slate-800">
                    Dealers
                  </TableHead>
                  <TableHead className="font-semibold text-slate-800">
                    Online Copy
                  </TableHead>
                  <TableHead className="font-semibold text-slate-800 text-right">
                    Cash
                  </TableHead>
                  <TableHead className="font-semibold text-slate-800 text-right">
                    Commission
                  </TableHead>
                  <TableHead className="font-semibold text-slate-800 text-right">
                    Net Deposit
                  </TableHead>
                  <TableHead className="font-semibold text-slate-800">
                    Status
                  </TableHead>
                  <TableHead className="font-semibold text-slate-800 text-center">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-16">
                        <Loader2
                          className="animate-spin inline mr-2"
                          size={24}
                        />
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : collections.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="text-center py-16 text-slate-400"
                      >
                        <FileText
                          size={40}
                          className="mx-auto mb-3 opacity-50"
                        />
                        <p className="font-medium">No collections found</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    collections.map((coll) => {
                      const summary = coll.summary || {};
                      const netDeposit =
                        summary.totalNetDeposited ??
                        summary.totalMRAmount -
                          summary.totalCommission -
                          summary.bankDepositCharge;
                      const stat = statusConfig[coll.status] || {
                        label: coll.status,
                        variant: "outline",
                        icon: Clock,
                      };
                      const dealerNames =
                        coll.dealers?.map((d) => d.dealerName).join(", ") ||
                        "-";
                      const canChange =
                        allowedTransitions[coll.status]?.length > 0;

                      return (
                        <motion.tr
                          key={coll._id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="border-b border-slate-100 hover:bg-indigo-50/30 transition-colors"
                        >
                          <TableCell className="font-medium text-slate-900">
                            {coll.voucherNo}
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {formatDate(coll.date)}
                          </TableCell>
                          <TableCell className="text-slate-600 max-w-[200px] truncate">
                            {dealerNames}
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {coll.onlineCopy?.onlineCopyNo || "-"}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-slate-800">
                            {moneyFmt(summary.totalMRAmount || 0)}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-amber-600">
                            {moneyFmt(summary.totalCommission || 0)}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-emerald-600">
                            {moneyFmt(netDeposit)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={stat.variant}
                              className="flex w-fit items-center gap-1"
                            >
                              <stat.icon size={14} />
                              {stat.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  router.push(
                                    `/accounts/collections/${coll._id}`,
                                  )
                                }
                                className="text-indigo-600 hover:bg-indigo-50 rounded-xl"
                              >
                                <Eye size={16} />
                              </Button>
                              {canChange &&
                                coll.status !== "APPROVED" &&
                                coll.status !== "CANCELLED" && (
                                  <Select
                                    onValueChange={(val) =>
                                      handleStatusChange(coll._id, val)
                                    }
                                  >
                                    <SelectTrigger className="h-8 w-8 p-0 border-0 hover:bg-slate-100 rounded-xl [&>svg]:hidden">
                                      <Edit
                                        size={14}
                                        className="text-slate-500"
                                      />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {allowedTransitions[coll.status]?.map(
                                        (ns) => (
                                          <SelectItem key={ns} value={ns}>
                                            {statusConfig[ns]?.label || ns}
                                          </SelectItem>
                                        ),
                                      )}
                                    </SelectContent>
                                  </Select>
                                )}
                              {coll.status === "APPROVED" && (
                                <Badge
                                  variant="outline"
                                  className="text-emerald-600 border-emerald-300"
                                >
                                  Approved
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                        </motion.tr>
                      );
                    })
                  )}
                </AnimatePresence>
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {!loading && total > 0 && (
            <div className="p-4 flex items-center justify-between border-t border-slate-200">
              <div className="text-sm text-slate-600">
                Showing {Math.min((page - 1) * limit + 1, total)} -{" "}
                {Math.min(page * limit, total)} of {total}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => goToPage(page - 1)}
                  className="rounded-xl"
                >
                  <ChevronLeft size={16} />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => goToPage(page + 1)}
                  className="rounded-xl"
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ────────────── Reusable Stat Card ────────────── */
const StatCard = ({ label, value, accent, icon: Icon }: any) => (
  <motion.div
    whileHover={{ y: -2 }}
    className={`rounded-2xl border p-5 flex items-center justify-between backdrop-blur-sm ${
      accent
        ? "bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 text-white shadow-lg shadow-slate-900/20"
        : "bg-white/70 border-slate-200 shadow-sm"
    }`}
  >
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
    {Icon && (
      <div
        className={`p-3 rounded-xl ${accent ? "bg-white/10" : "bg-slate-100"}`}
      >
        <Icon size={22} className={accent ? "text-white" : "text-slate-600"} />
      </div>
    )}
  </motion.div>
);
