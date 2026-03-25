"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Toaster, toast } from "sonner";

/* shadcn UI */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

/* -----------------------
   Tiny local Spinner
----------------------- */
function Spinner({ size = 20 }: { size?: number }) {
  return (
    <div
      role="status"
      aria-label="loading"
      style={{ width: size, height: size }}
      className="inline-block align-middle"
    >
      <svg
        className="animate-spin"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeOpacity="0.15"
          strokeWidth="4"
        />
        <path
          d="M22 12a10 10 0 00-10-10"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

/* -----------------------
   Types (light)
----------------------- */
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

type PaymentMode = {
  _id: string;
  name: string;
  requiresReference?: boolean;
};

type VoucherLine = {
  _id?: string;
  voucherId?: string;
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
  postedAt?: string;
  source?: string | { _id: string; name?: string };
  mode?: string | { _id: string; name?: string };
  lines?: VoucherLine[];
  bankVaId?: string; // reused field for cash VA id as in backend
  approvedBy?: any;
  approvedAt?: string;
  rejectedBy?: any;
  rejectedAt?: string;
  rejectionReason?: string;
  createdBy?: any;
  updatedBy?: any;
};

/* -----------------------
   Helpers
----------------------- */
const formatMoney = (n = 0) => `₹ ${Number(n || 0).toFixed(2)}`;

function isoDate(d?: string | Date) {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString().slice(0, 10);
}

/* -----------------------
   Component
----------------------- */
export default function CashReceiveVoucherListPage() {
  const router = useRouter();

  /* Filters */
  const ANY = "__any";
  const [q, setQ] = useState("");
  const [from, setFrom] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState<string>(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [partyFilter, setPartyFilter] = useState<string>(ANY);
  const [cashFilter, setCashFilter] = useState<string>(ANY);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(15);

  /* Data */
  const [data, setData] = useState<Voucher[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  /* Masters (loaded once) */
  const [voucherAccounts, setVoucherAccounts] = useState<VoucherAccount[]>([]);
  const [voucherParties, setVoucherParties] = useState<VoucherParty[]>([]);
  const [paymentModes, setPaymentModes] = useState<PaymentMode[]>([]);

  /* Detail modal */
  const [showDetail, setShowDetail] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [voucherLines, setVoucherLines] = useState<VoucherLine[] | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /* per-row actions */
  const [rowLoadingMap, setRowLoadingMap] = useState<Record<string, boolean>>(
    {},
  );

  const qTimer = useRef<number | null>(null);

  /* maps */
  const voucherAccountsMap = useMemo(() => {
    const m = new Map<string, VoucherAccount>();
    voucherAccounts.forEach((v) => {
      if (v && v._id) m.set(String(v._id), v);
    });
    return m;
  }, [voucherAccounts]);

  /* Load masters once */
  useEffect(() => {
    loadMasters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMasters() {
    try {
      const [vasRes, partiesRes, modesRes] = await Promise.all([
        api.get("/voucher-accounts").catch(() => ({ data: { data: [] } })),
        api.get("/voucher-parties").catch(() => ({ data: { data: [] } })),
        api.get("/payment-modes").catch(() => ({ data: { data: [] } })),
      ]);

      const vas = (vasRes?.data?.data ?? vasRes?.data ?? []) as any[];
      const normalizedVas = vas
        .filter((v) => v && v._id)
        .map((v) => {
          const acc =
            v?.accountId && typeof v.accountId === "object"
              ? v.accountId
              : undefined;
          const name = v.name || (acc ? acc.name : v._id || "va");
          return {
            ...v,
            name,
            accountId: acc ? acc._id : v.accountId,
          } as VoucherAccount;
        });

      setVoucherAccounts(normalizedVas);
      setVoucherParties(partiesRes?.data?.data ?? partiesRes?.data ?? []);
      setPaymentModes(modesRes?.data?.data ?? modesRes?.data ?? []);
    } catch (err) {
      console.error("Failed to load masters", err);
      toast.error("Failed to load masters.");
    }
  }

  /* Build filter params for cash receive */
  function buildFilterParams() {
    const params: any = {
      type: "CashReceive",
      page,
      limit,
    };

    if (from) params.fromDate = from;
    if (to) params.toDate = to;
    if (q && q.trim().length) params.q = q.trim();
    if (statusFilter && statusFilter !== "All") params.status = statusFilter;
    if (partyFilter && partyFilter !== ANY) params.source = partyFilter;
    if (cashFilter && cashFilter !== ANY) params.bankVaId = cashFilter; // backend uses bankVaId field for cash VA id too
    return params;
  }

  /* Fetch list (debounced q) */
  useEffect(() => {
    if (qTimer.current) window.clearTimeout(qTimer.current);
    // small debounce to avoid rapid queries
    // @ts-ignore
    qTimer.current = window.setTimeout(() => {
      fetchList();
    }, 150);
    return () => {
      if (qTimer.current) window.clearTimeout(qTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, from, to, statusFilter, partyFilter, cashFilter, q]);

  async function fetchList() {
    setLoading(true);
    try {
      const params = buildFilterParams();
      const qs = new URLSearchParams();
      Object.keys(params).forEach((k) => {
        if (params[k] === undefined || params[k] === null || params[k] === "")
          return;
        qs.append(k, String(params[k]));
      });
      const res = await api.get(`/vouchers?${qs.toString()}`);
      const list = res?.data?.data ?? res?.data ?? [];
      const tot = res?.data?.total ?? list?.length ?? 0;
      setData(list);
      setTotal(Number(tot || 0));
    } catch (err) {
      console.error("fetchList error", err);
      toast.error("Failed to load vouchers.");
    } finally {
      setLoading(false);
    }
  }

  /* Export CSV */
  async function exportCSV() {
    try {
      const params = buildFilterParams();
      const fields = [
        "voucherNo",
        "date",
        "type",
        "status",
        "reference",
        "narration",
        "postedAt",
      ];
      const qs = new URLSearchParams();
      qs.append("fields", fields.join(","));
      Object.keys(params).forEach((k) => {
        if (params[k] === undefined || params[k] === null || params[k] === "")
          return;
        qs.append(k, String(params[k]));
      });

      const res = await api.get(`/vouchers/export?${qs.toString()}`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cash-receives-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Export started");
    } catch (err) {
      console.error("exportCSV error", err);
      toast.error("Export failed");
    }
  }

  /* Detail modal */
  async function openDetails(v: Voucher) {
    setSelectedVoucher(v);
    setShowDetail(true);
    setVoucherLines(null);
    setDetailLoading(true);

    try {
      const res = await api.get(`/vouchers/${v._id}`).catch(() => null);
      const voucherData = res?.data?.data ?? res?.data ?? null;
      if (voucherData) {
        if (Array.isArray(voucherData.lines) && voucherData.lines.length) {
          setVoucherLines(voucherData.lines);
          setSelectedVoucher(voucherData);
          setDetailLoading(false);
          return;
        }
        setSelectedVoucher(voucherData);
      }

      const linesRes = await api
        .get(`/voucher-lines?voucherId=${v._id}`)
        .catch(() => null);
      const lines = linesRes?.data?.data ?? linesRes?.data ?? null;
      if (Array.isArray(lines)) {
        setVoucherLines(lines);
        setDetailLoading(false);
        return;
      }

      setVoucherLines([]);
    } catch (err) {
      console.error("openDetails error", err);
      toast.error("Failed to load voucher details.");
      setVoucherLines([]);
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetails() {
    setShowDetail(false);
    setSelectedVoucher(null);
    setVoucherLines(null);
  }

  /* Workflow actions */
  async function setRowLoading(id: string, v: boolean) {
    setRowLoadingMap((m) => ({ ...m, [id]: v }));
  }

  async function doVoucherAction(
    id: string,
    action: "approve" | "cancel" | "reject",
  ) {
    try {
      await setRowLoading(id, true);

      if (action === "reject") {
        const reason = (
          window.prompt("Enter rejection reason (required):") || ""
        ).trim();
        if (!reason) {
          toast.error("Rejection reason required.");
          await setRowLoading(id, false);
          return;
        }

        try {
          const res = await api.post(`/vouchers/${id}/reject`, { reason });
          if (res?.data?.success) {
            toast.success("Rejected");
            await fetchList();
            return;
          }
        } catch (err) {
          console.warn("reject endpoint failed, falling back to PUT", err);
          await api.put(`/vouchers/${id}`, {
            status: "Rejected",
            rejectionReason: reason,
          });
          toast.success("Rejected");
          await fetchList();
          return;
        } finally {
          await setRowLoading(id, false);
        }
      }

      const confirmed = window.confirm(
        `Are you sure you want to ${action.toUpperCase()} this voucher?`,
      );
      if (!confirmed) {
        await setRowLoading(id, false);
        return;
      }

      const res = await api.post(`/vouchers/${id}/${action}`).catch(() => null);
      if (res?.data?.success) {
        toast.success(
          `${action[0].toUpperCase()}${action.slice(1)} successful`,
        );
      } else {
        if (action === "cancel") {
          await api.put(`/vouchers/${id}`, { status: "Cancelled" });
          toast.success("Cancelled");
        } else if (action === "approve") {
          await api.put(`/vouchers/${id}`, { status: "Approved" });
          toast.success("Approved");
        }
      }

      await fetchList();
      if (selectedVoucher && selectedVoucher._id === id) {
        await openDetails(selectedVoucher as Voucher);
      }
    } catch (err: any) {
      console.error(`${action} error`, err);
      toast.error(err?.response?.data?.message || `${action} failed`);
    } finally {
      await setRowLoading(id, false);
    }
  }

  /* Navigate to Add Voucher */
  function goToAddVoucher() {
    router.push("/accounts/vouchers/receive/cash/submit");
  }

  /* Pagination */
  const totalPages = Math.max(1, Math.ceil((total || 0) / limit));
  function gotoPage(p: number) {
    if (p < 1 || p > totalPages) return;
    setPage(p);
  }

  /* Totals for a voucher: gross (credits), salesDiscount (debits matching discount), net */
  function computeTotalsForVoucher(v: Voucher) {
    let gross = 0;
    let salesDiscount = 0;
    let net = 0;

    const lines = v.lines ?? [];
    if (Array.isArray(lines) && lines.length) {
      gross = lines.reduce((s: number, l: any) => s + Number(l.credit || 0), 0);
      for (const l of lines) {
        const narration = (l.narration || "").toLowerCase();
        const accName =
          l.accountId &&
          typeof l.accountId === "object" &&
          (l.accountId as any).name
            ? String((l.accountId as any).name).toLowerCase()
            : "";
        // match "discount" words in narration or account name
        if (
          /discount/.test(narration) ||
          /discount/.test(accName) ||
          /sales discount/.test(accName)
        ) {
          salesDiscount += Number(l.debit || 0);
        }
      }
      net = gross - salesDiscount;
    }

    return { gross, salesDiscount, net };
  }

  function vaLabel(vaId?: string | null) {
    if (!vaId) return "";
    const va = voucherAccountsMap.get(String(vaId));
    if (!va) return vaId || "";
    const accName =
      va.accountId && typeof va.accountId === "object"
        ? (va.accountId as any).name
        : (va.accountId as string | undefined);
    return va.name
      ? `${va.name}${accName ? ` → ${accName}` : ""}`
      : `${accName ?? va._id}`;
  }

  /* UI Render */
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <Toaster position="top-right" richColors />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Cash Receive Vouchers</h1>
          <p className="text-sm text-slate-500">
            List of Cash Receive vouchers — search, filter, export and inspect.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => {
              setPage(1);
              fetchList();
            }}
            variant="ghost"
          >
            Refresh
          </Button>
          <Button onClick={exportCSV} disabled={loading} variant={"outline"}>
            Export CSV
          </Button>
          <Button onClick={goToAddVoucher} disabled={loading}>
            Add Voucher
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div>
            <Label>From</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div>
            <Label>To</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div>
            <Label>Status</Label>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Source (Party)</Label>
            <Select
              value={partyFilter}
              onValueChange={(v) => {
                setPartyFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any</SelectItem>
                {voucherParties.map((p) =>
                  p && p._id ? (
                    <SelectItem key={String(p._id)} value={String(p._id)}>
                      {p.name}
                    </SelectItem>
                  ) : null,
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Cash (Voucher Account)</Label>
            <Select
              value={cashFilter}
              onValueChange={(v) => {
                setCashFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any</SelectItem>
                {voucherAccounts
                  .filter((v) => {
                    if (!v || !v._id) return false;
                    if (v.role === "Cash") return true;
                    const n = String(v.name || "").toLowerCase();
                    if (n.includes("cash")) return true;
                    // try account name if available
                    const accName =
                      v.accountId && typeof v.accountId === "object"
                        ? String((v.accountId as any).name || "").toLowerCase()
                        : "";
                    return accName.includes("cash");
                  })
                  .map((b) => (
                    <SelectItem key={String(b._id)} value={String(b._id)}>
                      {b.name || b._id}{" "}
                      {b.accountId
                        ? `→ ${typeof b.accountId === "object" ? (b.accountId as any).name : b.accountId}`
                        : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Search</Label>
            <Input
              placeholder="voucherNo, reference, narration..."
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        <div className="p-3 border-b flex items-center justify-between">
          <div className="font-medium">Results</div>
          <div className="text-sm text-slate-500">
            {loading ? "Loading..." : `${total} vouchers`}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-100 text-sm text-left">
              <tr>
                <th className="px-4 py-3">Voucher No</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Cash</th>
                <th className="px-4 py-3">Party</th>
                <th className="px-4 py-3 text-right">Gross</th>
                <th className="px-4 py-3 text-right">Sales Discount</th>
                <th className="px-4 py-3 text-right">Net</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center">
                    <Spinner size={28} />
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-slate-500">
                    No vouchers found
                  </td>
                </tr>
              ) : (
                data.map((v) => {
                  const t = computeTotalsForVoucher(v);

                  const cashVaRaw =
                    (v as any).bankVaId || (v as any).bankAccountId;

                  let cashLabel = "";
                  if (cashVaRaw) {
                    if (typeof cashVaRaw === "object") {
                      cashLabel =
                        cashVaRaw.name ||
                        (cashVaRaw.accountId &&
                          typeof cashVaRaw.accountId === "object" &&
                          cashVaRaw.accountId.name) ||
                        "";
                    } else {
                      cashLabel = vaLabel(String(cashVaRaw));
                    }
                  }

                  const partyLabel =
                    v.source && typeof v.source === "object"
                      ? (v.source as any).name
                      : String(v.source || "");
                  const rowLoading = !!rowLoadingMap[v._id];

                  const status = v.status || "—";
                  let statusElement = (
                    <Badge variant="secondary">{status}</Badge>
                  );
                  if (status === "Pending")
                    statusElement = <Badge variant="warning">Pending</Badge>;
                  if (status === "Approved")
                    statusElement = <Badge variant="success">Approved</Badge>;
                  if (status === "Rejected")
                    statusElement = (
                      <Badge variant="destructive">Rejected</Badge>
                    );
                  if (status === "Cancelled")
                    statusElement = <Badge variant="outline">Cancelled</Badge>;

                  return (
                    <tr key={v._id} className="border-t hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm font-medium">
                        {v.voucherNo || v._id}
                      </td>
                      <td className="px-4 py-3 text-sm">{isoDate(v.date)}</td>
                      <td className="px-4 py-3 text-sm">{cashLabel}</td>
                      <td className="px-4 py-3 text-sm">{partyLabel}</td>
                      <td className="px-4 py-3 text-right text-sm">
                        {formatMoney(t.gross)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm">
                        {formatMoney(t.salesDiscount)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm">
                        {formatMoney(t.net)}
                      </td>
                      <td className="px-4 py-3 text-sm">{statusElement}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <Button size="sm" onClick={() => openDetails(v)}>
                            View
                          </Button>

                          {v.status === "Pending" && (
                            <>
                              <Button
                                size="sm"
                                onClick={() =>
                                  doVoucherAction(v._id, "approve")
                                }
                                disabled={rowLoading}
                              >
                                {rowLoading ? "..." : "Approve"}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => doVoucherAction(v._id, "reject")}
                                disabled={rowLoading}
                              >
                                {rowLoading ? "..." : "Reject"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => doVoucherAction(v._id, "cancel")}
                                disabled={rowLoading}
                              >
                                {rowLoading ? "..." : "Cancel"}
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-3 flex items-center justify-between">
          <div className="text-sm text-slate-600">
            Showing page {page} of {totalPages}
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => gotoPage(1)} disabled={page === 1}>
              First
            </Button>
            <Button
              size="sm"
              onClick={() => gotoPage(page - 1)}
              disabled={page === 1}
            >
              Prev
            </Button>
            <Input
              className="w-20"
              value={String(page)}
              onChange={(e) => {
                const n = Number(e.target.value || 1);
                if (!isNaN(n)) setPage(n);
              }}
            />
            <Button
              size="sm"
              onClick={() => gotoPage(page + 1)}
              disabled={page === totalPages}
            >
              Next
            </Button>
            <Button
              size="sm"
              onClick={() => gotoPage(totalPages)}
              disabled={page === totalPages}
            >
              Last
            </Button>

            <Select
              value={String(limit)}
              onValueChange={(v) => {
                setLimit(Number(v));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 / page</SelectItem>
                <SelectItem value="15">15 / page</SelectItem>
                <SelectItem value="25">25 / page</SelectItem>
                <SelectItem value="50">50 / page</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Detail dialog */}
      {showDetail && selectedVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={closeDetails}
          />
          <div className="relative max-w-3xl w-full bg-white rounded shadow-lg overflow-auto">
            <div className="p-4 border-b flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  Voucher: {selectedVoucher.voucherNo || selectedVoucher._id}
                </h2>
                <div className="text-sm text-slate-500">
                  {isoDate(selectedVoucher.date)} • {selectedVoucher.type}
                </div>
              </div>
              <div className="flex flex-col items-end text-right">
                <div className="text-sm">Status: {selectedVoucher.status}</div>
                <div className="text-xs text-slate-400">
                  {selectedVoucher.postedAt
                    ? `Posted: ${isoDate(selectedVoucher.postedAt)}`
                    : ""}
                </div>
                {selectedVoucher.approvedAt && (
                  <div className="text-xs text-slate-400">
                    Approved: {isoDate(selectedVoucher.approvedAt)}
                  </div>
                )}
                {selectedVoucher.rejectedAt && (
                  <div className="text-xs text-rose-600">
                    Rejected: {isoDate(selectedVoucher.rejectedAt)}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <div className="text-sm text-slate-600">Reference</div>
                <div className="font-medium">
                  {selectedVoucher.reference || "-"}
                </div>
              </div>

              <div>
                <div className="text-sm text-slate-600">Source</div>
                <div className="font-medium">
                  {typeof selectedVoucher.source === "object"
                    ? (selectedVoucher.source as any).name
                    : String(selectedVoucher.source ?? "-")}
                </div>
              </div>

              <div>
                <div className="text-sm text-slate-600">Narration</div>
                <div className="font-medium">
                  {selectedVoucher.narration || "-"}
                </div>
              </div>

              {selectedVoucher.rejectionReason && (
                <div>
                  <div className="text-sm text-slate-600">Rejection Reason</div>
                  <div className="font-medium text-rose-600">
                    {selectedVoucher.rejectionReason}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Rejected by:{" "}
                    {(selectedVoucher.rejectedBy &&
                      (selectedVoucher.rejectedBy.name ||
                        selectedVoucher.rejectedBy._id)) ||
                      "Unknown"}
                    {selectedVoucher.rejectedAt
                      ? ` • ${isoDate(selectedVoucher.rejectedAt)}`
                      : ""}
                  </div>
                </div>
              )}

              {selectedVoucher.approvedAt && (
                <div>
                  <div className="text-sm text-slate-600">Approved By</div>
                  <div className="font-medium">
                    {(selectedVoucher.approvedBy &&
                      (selectedVoucher.approvedBy.name ||
                        selectedVoucher.approvedBy._id)) ||
                      "Unknown"}{" "}
                    • {isoDate(selectedVoucher.approvedAt)}
                  </div>
                </div>
              )}

              <div>
                <div className="text-sm text-slate-600 mb-2">Lines</div>
                {detailLoading ? (
                  <div className="p-6 text-center">
                    <Spinner size={32} />
                  </div>
                ) : voucherLines && voucherLines.length ? (
                  <table className="w-full">
                    <thead className="bg-slate-100 text-sm">
                      <tr>
                        <th className="px-3 py-2 text-left">Account</th>
                        <th className="px-3 py-2 text-left">Narration</th>
                        <th className="px-3 py-2 text-right">Debit</th>
                        <th className="px-3 py-2 text-right">Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {voucherLines.map((ln) => {
                        const accName =
                          ln.accountId && typeof ln.accountId === "object"
                            ? (ln.accountId as any).name
                            : ((ln.accountId as string | undefined) ?? "");
                        return (
                          <tr
                            key={
                              ln._id ||
                              `${ln.accountId}-${ln.credit}-${ln.debit}`
                            }
                            className="border-t"
                          >
                            <td className="px-3 py-2 text-sm">{accName}</td>
                            <td className="px-3 py-2 text-sm">
                              {ln.narration || "-"}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {formatMoney(ln.debit ?? 0)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {formatMoney(ln.credit ?? 0)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-sm text-slate-500">
                    No lines available (implement `/voucher-lines?voucherId=...`
                    if you want lines returned).
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {selectedVoucher.status === "Pending" && (
                  <>
                    <Button
                      size="sm"
                      onClick={() =>
                        selectedVoucher?._id &&
                        doVoucherAction(selectedVoucher._id, "approve")
                      }
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() =>
                        selectedVoucher?._id &&
                        doVoucherAction(selectedVoucher._id, "reject")
                      }
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        selectedVoucher?._id &&
                        doVoucherAction(selectedVoucher._id, "cancel")
                      }
                    >
                      Cancel
                    </Button>
                  </>
                )}
              </div>

              <div>
                <Button variant="ghost" onClick={closeDetails}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
