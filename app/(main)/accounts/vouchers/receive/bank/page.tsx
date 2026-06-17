// app/accounts/vouchers/receive/bank/page.tsx
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
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
  buildBankReceiveVoucherHtml,
  buildVoucherPrintHeader,
  BankReceiveVoucherPreview,
} from "./_components/BankReceiveVoucherContent";

/* ---------- types (unchanged) ---------- */
type VoucherAccount = {
  _id: string;
  name?: string;
  accountId?: string | { _id: string; name?: string; code?: string };
  role?: string;
  voucherTypes?: string[];
  isActive?: boolean;
};

type VoucherParty = {
  _id: string;
  name: string;
  direction?: "Receive" | "Payment";
};

type VoucherLine = {
  _id?: string;
  accountId?: string | { _id: string; name?: string; code?: string };
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
  source?: string | { _id: string; name?: string };
  bankVaId?: string | { _id: string; name?: string; accountId?: { name?: string; code?: string } };
  lines?: VoucherLine[];
  submittedBy?: { name?: string };
  approvedBy?: { name?: string };
  createdBy?: { name?: string };
};

/* ---------- helpers ---------- */
const formatTaka = (n = 0) => `৳ ${Number(n || 0).toFixed(2)}`;
const isoDate = (d?: string | Date) => {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  return isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
};

export default function BankReceiveVoucherListPage() {
  const router = useRouter();

  const ANY = "__any";
  const [q, setQ] = useState("");
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [statusFilter, setStatusFilter] = useState("All");
  const [partyFilter, setPartyFilter] = useState(ANY);
  const [bankFilter, setBankFilter] = useState(ANY);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);

  const [data, setData] = useState<Voucher[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [voucherAccounts, setVoucherAccounts] = useState<VoucherAccount[]>([]);
  const [voucherParties, setVoucherParties] = useState<VoucherParty[]>([]);

  const [showDetail, setShowDetail] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [voucherLines, setVoucherLines] = useState<VoucherLine[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [rowLoadingMap, setRowLoadingMap] = useState<Record<string, boolean>>({});

  const qTimer = useRef<any>(null);

  useEffect(() => {
    loadMasters();
  }, []);

  async function loadMasters() {
    try {
      const [vasRes, partiesRes] = await Promise.all([
        api.get("/voucher-accounts").catch(() => ({ data: { data: [] } })),
        api.get("/voucher-parties").catch(() => ({ data: { data: [] } })),
      ]);
      setVoucherAccounts(vasRes?.data?.data ?? []);
      setVoucherParties(partiesRes?.data?.data ?? []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load filter data");
    }
  }

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {
        type: "BankReceive",
        page,
        limit,
        fromDate: from || undefined,
        toDate: to || undefined,
        status: statusFilter !== "All" ? statusFilter : undefined,
        q: q || undefined,
        source: partyFilter !== ANY ? partyFilter : undefined,
        bankVaId: bankFilter !== ANY ? bankFilter : undefined,
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
  }, [page, limit, from, to, statusFilter, partyFilter, bankFilter, q]);

  useEffect(() => {
    if (qTimer.current) clearTimeout(qTimer.current);
    qTimer.current = setTimeout(fetchList, 200);
    return () => clearTimeout(qTimer.current);
  }, [fetchList]);

  const openDetails = useCallback(async (v: Voucher) => {
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
  }, []);

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

  const bankName = (v: Voucher) => {
    const bankId = (v as any).bankVaId;
    if (!bankId) return "";
    // if populated object, dig deeper
    if (typeof bankId === "object" && bankId.accountId) {
      return bankId.accountId.name || "";
    }
    const va = voucherAccounts.find((a) => a._id === String(bankId));
    if (!va) return "";
    return va.name || (va.accountId && typeof va.accountId === "object" ? va.accountId.name : "") || "";
  };

  const computeGrossAndCharges = (lines: VoucherLine[]) => {
    let gross = 0, commission = 0, bankCharge = 0;
    lines.forEach((l) => {
      gross += l.credit || 0;
      const narr = (l.narration || "").toLowerCase();
      if (/commission/.test(narr)) commission += l.debit || 0;
      if (/bank.*charge|deposit charge/.test(narr)) bankCharge += l.debit || 0;
    });
    return { gross, commission, bankCharge, net: gross - commission - bankCharge };
  };

  // Extract preparer / authoriser names from voucher
  const getVoucherSignatures = (v: Voucher) => ({
    submittedBy: v.submittedBy?.name || v.createdBy?.name || "",
    approvedBy: v.approvedBy?.name || "",
    receivedBy: bankName(v) || "",   // use bank name as received by
  });

  const getPrintHtml = useCallback(() => {
    if (!selectedVoucher) return "";
    const sig = getVoucherSignatures(selectedVoucher);
    return buildBankReceiveVoucherHtml(
      {
        voucherNo: selectedVoucher.voucherNo,
        date: selectedVoucher.date,
        type: selectedVoucher.type,
        reference: selectedVoucher.reference,
        narration: selectedVoucher.narration,
        source: selectedVoucher.source,
        bankName: bankName(selectedVoucher),
        submittedBy: sig.submittedBy,
        approvedBy: sig.approvedBy,
        receivedBy: sig.receivedBy,
      },
      voucherLines,
    );
  }, [selectedVoucher, voucherLines]);

  const getPrintHeaderRight = useCallback(() => {
    if (!selectedVoucher) return "";
    return buildVoucherPrintHeader({
      voucherNo: selectedVoucher.voucherNo,
      date: selectedVoucher.date,
      type: selectedVoucher.type,
    });
  }, [selectedVoucher]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const exportCSV = async () => {
    // ... (keep existing export logic unchanged)
  };

  return (
    <div className="max-w-[1500px] mx-auto p-4 md:p-6 space-y-5">
      {/* header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Bank Receive Vouchers</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage bank receipt vouchers — filter, view, and approve.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchList} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
          <Button onClick={() => router.push("/accounts/vouchers/receive/bank/submit")}>
            + Add Voucher
          </Button>
        </div>
      </div>

      {/* filters */}
      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
          {/* ... (same filter fields as before) ... */}
          <div>
            <Label className="text-xs text-slate-500 mb-1 block">From</Label>
            <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          </div>
          <div>
            <Label className="text-xs text-slate-500 mb-1 block">To</Label>
            <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
          </div>
          <div>
            <Label className="text-xs text-slate-500 mb-1 block">Status</Label>
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
            <Label className="text-xs text-slate-500 mb-1 block">Party</Label>
            <Select value={partyFilter} onValueChange={(v) => { setPartyFilter(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any</SelectItem>
                {voucherParties.filter(p => p.direction === "Receive").map(p => (
                  <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-slate-500 mb-1 block">Bank</Label>
            <Select value={bankFilter} onValueChange={(v) => { setBankFilter(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any</SelectItem>
                {voucherAccounts.filter(v => v.role === "Bank").map(b => (
                  <SelectItem key={b._id} value={b._id}>{b.name || b._id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-slate-500 mb-1 block">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input className="pl-9" placeholder="Voucher No, Ref" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* table */}
      <Card className="shadow-sm border-slate-200 overflow-hidden">
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-100 hover:bg-slate-100">
                <TableHead className="font-semibold text-slate-700">Voucher No</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead>Party</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Comm.</TableHead>
                <TableHead className="text-right">Charge</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[150px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* ... rendering rows ... */}
              {data.map((v) => {
                const lines = v.lines || [];
                const { gross, commission, bankCharge, net } = computeGrossAndCharges(lines);
                const partyName = typeof v.source === "object" ? v.source?.name || "" : v.source || "";
                const status = v.status || "—";
                let statusBadge = <Badge variant="secondary">{status}</Badge>;
                if (status === "Pending") statusBadge = <Badge className="bg-amber-50 text-amber-700 border border-amber-200">Pending</Badge>;
                if (status === "Approved") statusBadge = <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200">Approved</Badge>;
                if (status === "Rejected") statusBadge = <Badge variant="destructive">Rejected</Badge>;
                if (status === "Cancelled") statusBadge = <Badge variant="outline">Cancelled</Badge>;

                const sig = getVoucherSignatures(v);

                return (
                  <TableRow key={v._id} className="hover:bg-slate-50 transition-colors">
                    <TableCell className="font-medium text-sm">{v.voucherNo || v._id}</TableCell>
                    <TableCell className="text-sm">{isoDate(v.date)}</TableCell>
                    <TableCell className="text-sm">{bankName(v)}</TableCell>
                    <TableCell className="text-sm">{partyName}</TableCell>
                    <TableCell className="text-right text-sm">{formatTaka(gross)}</TableCell>
                    <TableCell className="text-right text-sm">{formatTaka(commission)}</TableCell>
                    <TableCell className="text-right text-sm">{formatTaka(bankCharge)}</TableCell>
                    <TableCell className="text-right text-sm font-semibold">{formatTaka(net)}</TableCell>
                    <TableCell>{statusBadge}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openDetails(v)} title="View"><Eye className="h-4 w-4" /></Button>
                        {status === "Pending" && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => doAction(v._id, "approve")} disabled={rowLoadingMap[v._id]} title="Approve"><CheckCircle className="h-4 w-4 text-emerald-600" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => doAction(v._id, "reject")} disabled={rowLoadingMap[v._id]} title="Reject"><XCircle className="h-4 w-4 text-rose-600" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => doAction(v._id, "cancel")} disabled={rowLoadingMap[v._id]} title="Cancel"><Ban className="h-4 w-4" /></Button>
                          </>
                        )}
                        {status === "Approved" && (
                          <GlobalPrintButton
                            contentHtml={buildBankReceiveVoucherHtml(
                              {
                                voucherNo: v.voucherNo,
                                date: v.date,
                                type: v.type,
                                reference: v.reference,
                                narration: v.narration,
                                source: v.source,
                                bankName: bankName(v),
                                submittedBy: sig.submittedBy,
                                approvedBy: sig.approvedBy,
                                receivedBy: sig.receivedBy,
                              },
                              lines,
                            )}
                            headerRightHtml={buildVoucherPrintHeader({
                              voucherNo: v.voucherNo,
                              date: v.date,
                              type: v.type,
                            })}
                            label="Print"
                            title="Bank Receive Voucher"
                            company={{
                              name: "Antab Agro LTD",
                              address: "123 Agro Street, Dhaka",
                              phone: "+880 1711-111111",
                              email: "info@antabagro.com",
                            }}
                            className="w-30 p-0"
                            // use default header/footer, which includes the watermark

                            showHeader={false}
                            showFooter={false}
                            orientation="landscape"

                            watermarkPosition="center"
                            watermarkRotate="-45deg"
                            watermarkSize="400px"

                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {/* pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t gap-4 bg-slate-50/50">
          <div className="text-sm text-slate-600">Page {page} of {totalPages} ({total} records)</div>
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

      {/* detail modal */}
      {showDetail && selectedVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] overflow-auto">
            <div className="flex items-center justify-between p-5 border-b bg-slate-50/70 rounded-t-2xl">
              <h2 className="text-lg font-semibold text-slate-800">
                Voucher #{selectedVoucher.voucherNo}
              </h2>
              <div className="flex items-center gap-2">
                {selectedVoucher.status === "Approved" && (
                  <GlobalPrintButton
                    contentHtml={getPrintHtml()}
                    headerRightHtml={getPrintHeaderRight()}
                    label="Print"
                    title="Bank Receive Voucher"
                    company={{
                      name: "Antab Agro LTD",
                      address: "123 Agro Street, Dhaka",
                      phone: "+880 1711-111111",
                      email: "info@antabagro.com",
                    }}

                    showHeader={false}
                    showFooter={false}
                    orientation="portrait"

                    watermarkPosition="center"
                    watermarkRotate="-45deg"
                    watermarkSize="400px"
                  />
                )}
                <Button variant="ghost" onClick={() => setShowDetail(false)}>Close</Button>
              </div>
            </div>
            <div className="p-6 md:p-8">
              {detailLoading ? (
                <div className="flex justify-center py-12 text-slate-400">Loading voucher details...</div>
              ) : (
                <BankReceiveVoucherPreview
                  voucher={{
                    voucherNo: selectedVoucher.voucherNo,
                    date: selectedVoucher.date,
                    type: selectedVoucher.type,
                    reference: selectedVoucher.reference,
                    narration: selectedVoucher.narration,
                    source: selectedVoucher.source,
                    bankName: bankName(selectedVoucher),
                    submittedBy: getVoucherSignatures(selectedVoucher).submittedBy,
                    approvedBy: getVoucherSignatures(selectedVoucher).approvedBy,
                    receivedBy: getVoucherSignatures(selectedVoucher).receivedBy,
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