// app/accounts/vouchers/contra/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  RefreshCw,
  Download,
  Eye,
  CheckCircle,
  XCircle,
  Ban,
} from "lucide-react";

import GlobalPrintButton from "@/components/common/print/GlobalPrintButton";
import {
  buildContraVoucherHtml,
  buildVoucherPrintHeader,
  ContraVoucherPreview,
} from "./_components/ContraVoucherContent";

/* ---------- types ---------- */
type VoucherLine = {
  _id?: string;
  accountId?: { _id?: string; name?: string; code?: string } | string;
  debit?: number;
  credit?: number;
  narration?: string;
};

type Voucher = {
  _id: string;
  voucherNo?: string;
  date?: string;
  type?: string;
  reference?: string;
  narration?: string;
  status?: string;
  lines?: VoucherLine[];
  submittedBy?: { name?: string };
  approvedBy?: { name?: string };
};

/* ---------- helpers ---------- */
const formatTaka = (n = 0) => `৳ ${Number(n || 0).toFixed(2)}`;
const isoDate = (d?: string | Date) => {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  return isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
};

/* ---------- component ---------- */
export default function ContraVoucherListPage() {
  const router = useRouter();

  const [q, setQ] = useState("");
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);

  const [data, setData] = useState<Voucher[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [showDetail, setShowDetail] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [voucherLines, setVoucherLines] = useState<VoucherLine[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [rowLoadingMap, setRowLoadingMap] = useState<Record<string, boolean>>({});

  const qTimer = useRef<any>(null);

  /* Fetch list */
  const fetchList = async () => {
    setLoading(true);
    try {
      const params: any = {
        type: "Contra",
        page,
        limit,
        fromDate: from || undefined,
        toDate: to || undefined,
        status: statusFilter !== "All" ? statusFilter : undefined,
        q: q || undefined,
      };
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
      });
      const res = await api.get(`/vouchers?${qs.toString()}`);
      setData(res?.data?.data ?? []);
      setTotal(res?.data?.total ?? 0);
    } catch (err) {
      toast.error("Failed to load vouchers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (qTimer.current) clearTimeout(qTimer.current);
    qTimer.current = setTimeout(fetchList, 200);
    return () => clearTimeout(qTimer.current);
  }, [page, limit, from, to, statusFilter, q]);

  /* Detail */
  const openDetails = async (v: Voucher) => {
    setSelectedVoucher(v);
    setShowDetail(true);
    setDetailLoading(true);
    try {
      const res = await api.get(`/vouchers/${v._id}`);
      const full = res?.data?.data ?? res?.data;
      if (full) {
        setSelectedVoucher(full);
        setVoucherLines(full.lines || []);
      }
    } catch (err) {
      toast.error("Failed to load voucher details");
    } finally {
      setDetailLoading(false);
    }
  };

  const doAction = async (id: string, action: "approve" | "cancel" | "reject") => {
    setRowLoadingMap((prev) => ({ ...prev, [id]: true }));
    try {
      if (action === "reject") {
        const reason = window.prompt("Rejection reason:")?.trim();
        if (!reason) { toast.error("Reason required"); return; }
        await api.post(`/vouchers/${id}/reject`, { reason });
      } else {
        if (!window.confirm(`Are you sure you want to ${action}?`)) return;
        await api.post(`/vouchers/${id}/${action}`);
      }
      toast.success(`${action.charAt(0).toUpperCase() + action.slice(1)}d`);
      fetchList();
      if (selectedVoucher?._id === id) openDetails(selectedVoucher!);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || `${action} failed`);
    } finally {
      setRowLoadingMap((prev) => ({ ...prev, [id]: false }));
    }
  };

  /* Extract from / to account names from lines */
  const getFromTo = (lines: VoucherLine[]): { from: string; to: string } => {
    const creditLine = lines.find((l) => (l.credit || 0) > 0);
    const debitLine = lines.find((l) => (l.debit || 0) > 0);
    const fromName =
      creditLine?.accountId && typeof creditLine.accountId === "object"
        ? creditLine.accountId.name || ""
        : creditLine?.accountId || "";
    const toName =
      debitLine?.accountId && typeof debitLine.accountId === "object"
        ? debitLine.accountId.name || ""
        : debitLine?.accountId || "";
    return { from: String(fromName), to: String(toName) };
  };

  const computeTotals = (lines: VoucherLine[]) => {
    const debit = lines.reduce((s, l) => s + (l.debit || 0), 0);
    const credit = lines.reduce((s, l) => s + (l.credit || 0), 0);
    return { debit, credit };
  };

  const getPrintHtml = () => {
    if (!selectedVoucher) return "";
    const lines = voucherLines;
    const { from, to } = getFromTo(lines);
    return buildContraVoucherHtml(
      {
        voucherNo: selectedVoucher.voucherNo,
        date: selectedVoucher.date,
        type: selectedVoucher.type,
        reference: selectedVoucher.reference,
        narration: selectedVoucher.narration,
        fromAccount: from,
        toAccount: to,
        submittedBy: selectedVoucher.submittedBy?.name || "",
        approvedBy: selectedVoucher.approvedBy?.name || "",
      },
      lines,
    );
  };

  const getPrintHeaderRight = () => {
    if (!selectedVoucher) return "";
    return buildVoucherPrintHeader({
      voucherNo: selectedVoucher.voucherNo,
      date: selectedVoucher.date,
      type: selectedVoucher.type,
    });
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const exportCSV = async () => {
    try {
      const params: any = {
        type: "Contra",
        fromDate: from || undefined,
        toDate: to || undefined,
        status: statusFilter !== "All" ? statusFilter : undefined,
      };
      const qs = new URLSearchParams();
      qs.append("fields", "voucherNo,date,type,status,reference,narration");
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
      });
      const res = await api.get(`/vouchers/export?${qs.toString()}`, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contra-vouchers-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export started");
    } catch (err) {
      toast.error("Export failed");
    }
  };

  return (
    <div className="max-w-[1500px] mx-auto p-4 md:p-6 space-y-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Contra Vouchers</h1>
          <p className="text-sm text-gray-500 mt-1">Manage contra vouchers — filter, view, and approve.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchList} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
          <Button onClick={() => router.push("/accounts/vouchers/contra/submit")}>
            + Add Voucher
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="shadow-sm border-gray-200">
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <Label className="text-xs text-gray-500 mb-1 block">From</Label>
            <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          </div>
          <div>
            <Label className="text-xs text-gray-500 mb-1 block">To</Label>
            <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
          </div>
          <div>
            <Label className="text-xs text-gray-500 mb-1 block">Status</Label>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-gray-500 mb-1 block">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input className="pl-9" placeholder="Voucher No, Ref, Narration" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="shadow-sm border-gray-200 overflow-hidden">
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead className="font-semibold text-gray-700">Voucher No</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>From (Credit)</TableHead>
                <TableHead>To (Debit)</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[150px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="py-10 text-center">Loading...</TableCell></TableRow>
              ) : data.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="py-10 text-center">No vouchers found.</TableCell></TableRow>
              ) : (
                data.map((v) => {
                  const lines = v.lines || [];
                  const { from, to } = getFromTo(lines);
                  const amount = lines.reduce((s, l) => s + (l.debit || 0), 0); // same as credit
                  const status = v.status || "—";
                  let statusBadge = <Badge variant="secondary">{status}</Badge>;
                  if (status === "Pending") statusBadge = <Badge className="bg-amber-50 text-amber-700 border border-amber-200">Pending</Badge>;
                  if (status === "Approved") statusBadge = <Badge className="bg-green-50 text-green-700 border border-green-200">Approved</Badge>;
                  if (status === "Rejected") statusBadge = <Badge variant="destructive">Rejected</Badge>;
                  if (status === "Cancelled") statusBadge = <Badge variant="outline">Cancelled</Badge>;

                  return (
                    <TableRow key={v._id} className="hover:bg-gray-50/50 transition-colors">
                      <TableCell className="font-medium text-sm">{v.voucherNo || v._id}</TableCell>
                      <TableCell className="text-sm">{isoDate(v.date)}</TableCell>
                      <TableCell className="text-sm">{from}</TableCell>
                      <TableCell className="text-sm">{to}</TableCell>
                      <TableCell className="text-sm">{v.reference || "—"}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{formatTaka(amount)}</TableCell>
                      <TableCell>{statusBadge}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openDetails(v)} title="View"><Eye className="h-4 w-4" /></Button>
                          {status === "Pending" && (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => doAction(v._id, "approve")} disabled={rowLoadingMap[v._id]} title="Approve"><CheckCircle className="h-4 w-4 text-green-600" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => doAction(v._id, "reject")} disabled={rowLoadingMap[v._id]} title="Reject"><XCircle className="h-4 w-4 text-red-600" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => doAction(v._id, "cancel")} disabled={rowLoadingMap[v._id]} title="Cancel"><Ban className="h-4 w-4" /></Button>
                            </>
                          )}
                          {status === "Approved" && (
                            <GlobalPrintButton
                              contentHtml={(() => {
                                const { from, to } = getFromTo(lines);
                                return buildContraVoucherHtml(
                                  {
                                    voucherNo: v.voucherNo,
                                    date: v.date,
                                    type: v.type,
                                    reference: v.reference,
                                    narration: v.narration,
                                    fromAccount: from,
                                    toAccount: to,
                                    submittedBy: v.submittedBy?.name || "",
                                    approvedBy: v.approvedBy?.name || "",
                                  },
                                  lines,
                                );
                              })()}
                              headerRightHtml={buildVoucherPrintHeader({
                                voucherNo: v.voucherNo,
                                date: v.date,
                                type: v.type,
                              })}
                              label="Print"
                              title="Contra Voucher"
                              company={{
                                name: "Antab Agro LTD",
                                address: "123 Agro Street, Dhaka",
                                phone: "+880 1711-111111",
                                email: "info@antabagro.com",
                              }}
                              className="h-8 w-30 p-0"
                              showHeader={false}
                              showFooter={false}
                              orientation="landscape"
                            />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t gap-4 bg-gray-50/50">
          <div className="text-sm text-gray-600">Page {page} of {totalPages} ({total} records)</div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={page === 1}>First</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-sm font-medium px-2">{page}</span>
            <Button variant="outline" size="sm" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}><ChevronRight className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => setPage(totalPages)} disabled={page === totalPages}>Last</Button>
            <Select value={String(limit)} onValueChange={(v) => { setLimit(Number(v)); setPage(1); }}>
              <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="15">15</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Detail Modal */}
      {showDetail && selectedVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] overflow-auto">
            <div className="flex items-center justify-between p-5 border-b bg-gray-50/70 rounded-t-2xl">
              <h2 className="text-lg font-semibold">Voucher #{selectedVoucher.voucherNo}</h2>
              <div className="flex items-center gap-2">
                {selectedVoucher.status === "Approved" && (
                  <GlobalPrintButton
                    contentHtml={getPrintHtml()}
                    headerRightHtml={getPrintHeaderRight()}
                    label="Print"
                    title="Contra Voucher"
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
                <Button variant="ghost" onClick={() => setShowDetail(false)}>Close</Button>
              </div>
            </div>
            <div className="p-6 md:p-8">
              {detailLoading ? (
                <p className="text-center py-10">Loading...</p>
              ) : (
                <ContraVoucherPreview
                  voucher={{
                    voucherNo: selectedVoucher.voucherNo,
                    date: selectedVoucher.date,
                    type: selectedVoucher.type,
                    reference: selectedVoucher.reference,
                    narration: selectedVoucher.narration,
                    fromAccount: getFromTo(voucherLines).from,
                    toAccount: getFromTo(voucherLines).to,
                    submittedBy: selectedVoucher.submittedBy?.name || "",
                    approvedBy: selectedVoucher.approvedBy?.name || "",
                  }}
                  lines={voucherLines}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}