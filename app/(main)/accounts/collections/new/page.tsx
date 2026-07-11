"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast, Toaster } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Trash2,
  Search,
  FileText,
  Banknote,
  AlertCircle,
  CheckCircle2,
  Upload,
  ArrowUpCircle,
  ArrowDownCircle,
  Users,
  Receipt,
  Wallet,
  TrendingUp,
} from "lucide-react";

/* ────────────── Types (unchanged) ────────────── */
type CommissionMode = "FIXED" | "PERCENT";
type CommissionRow = { mode: CommissionMode; value: number; amount: number };

type MrRow = {
  id: string;
  mrNo: string;
  mrDate: string;
  taka: number;
  commission: CommissionRow;
  deductCommission: boolean;
  mediaId: string;
  mediaName: string;
  mediaUrl: string;
};

type InvoiceOption = {
  _id: string;
  invoiceNo: string;
  orderNo: string;
  grandTotal: number;
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: string;
  itemsCount: number;
};

type InvoiceRow = {
  id: string;
  invoiceId: string;
  invoiceNo: string;
  orderNo: string;
  grandTotal: number;
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: string;
  mrs: MrRow[];
};

type DealerRow = {
  id: string;
  dealerId: string;
  dealerName: string;
  query: string;
  loading: boolean;
  options: any[];
  invoiceOptions: InvoiceOption[];
  invoiceQuery: string;
  invoiceStatusFilter: "ALL" | "UNPAID" | "PARTIAL";
  invoices: InvoiceRow[];
};

type BankOption = { id: string; label: string; raw: any };

/* ────────────── Helpers (unchanged) ────────────── */
const uid = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
const today = () => new Date().toISOString().slice(0, 10);
const cleanText = (v: any) => String(v ?? "").trim();
const roundMoney = (v: any) =>
  Math.round((Number(v ?? 0) + Number.EPSILON) * 100) / 100;
const moneyFmt = (v: any) =>
  Number.isFinite(Number(v ?? 0))
    ? Number(v ?? 0).toLocaleString("en-BD", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "0.00";

const resolveId = (v: any) =>
  typeof v === "string" ? v : v?._id || v?.id || "";
const resolveLabel = (v: any, fallback = "-") =>
  typeof v === "string"
    ? v || fallback
    : v?.dealerName ||
      v?.name ||
      v?.invoiceNo ||
      v?.originalName ||
      v?.filename ||
      fallback;

const calcCommission = (taka: number, c: CommissionRow) =>
  c.mode === "PERCENT"
    ? roundMoney((roundMoney(taka) * roundMoney(c.value)) / 100)
    : roundMoney(c.value);

const emptyCommission = (): CommissionRow => ({
  mode: "FIXED",
  value: 0,
  amount: 0,
});
const emptyMr = (): MrRow => ({
  id: uid(),
  mrNo: "",
  mrDate: today(),
  taka: 0,
  commission: emptyCommission(),
  deductCommission: false,
  mediaId: "",
  mediaName: "",
  mediaUrl: "",
});

const emptyDealer = (): DealerRow => ({
  id: uid(),
  dealerId: "",
  dealerName: "",
  query: "",
  loading: false,
  options: [],
  invoiceOptions: [],
  invoiceQuery: "",
  invoiceStatusFilter: "ALL",
  invoices: [],
});

const isInvoiceSelectable = (inv: any) => {
  const status = cleanText(inv?.paymentStatus).toUpperCase();
  const balance = Number(
    inv?.balanceAmount ?? inv?.grandTotal - inv?.paidAmount,
  );
  return status !== "PAID" && balance > 0;
};

const normalizeInvoiceOption = (inv: any): InvoiceOption => {
  const grandTotal = Number(inv?.grandTotal ?? 0);
  const paidAmount = Number(inv?.paidAmount ?? 0);
  const balanceAmount = Number(inv?.balanceAmount ?? grandTotal - paidAmount);
  return {
    _id: resolveId(inv),
    invoiceNo: cleanText(inv?.invoiceNo),
    orderNo: cleanText(inv?.orderId?.orderNo || inv?.orderNo),
    grandTotal,
    paidAmount,
    balanceAmount,
    paymentStatus: cleanText(inv?.paymentStatus),
    itemsCount: Array.isArray(inv?.items) ? inv.items.length : 0,
  };
};

const normalizeBankOption = (item: any): BankOption => {
  const acc = item?.accountId || {};
  const label = acc?.code
    ? `${acc?.name} (${acc?.code})`
    : acc?.name || item?.name || "Bank";
  return { id: resolveId(item), label, raw: item };
};

/* ────────────── Enhanced Sub‑components ────────── */
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

const FileUpload = ({ label, fileName, fileUrl, onUpload }: any) => (
  <div className="space-y-2">
    <Label className="text-sm font-medium">{label}</Label>
    <div className="flex items-center gap-3">
      <label className="flex-1 cursor-pointer rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500 hover:border-indigo-400 hover:bg-indigo-50 transition">
        <input
          type="file"
          onChange={(e) => onUpload(e.target.files?.[0])}
          className="hidden"
        />
        <span className="flex items-center gap-2">
          <Upload size={16} /> {fileName ? "Change file" : "Upload file"}
        </span>
      </label>
      {fileName && (
        <a
          href={`${process.env.NEXT_PUBLIC_MEDIA_URL || ""}${fileUrl}`}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium text-indigo-600 underline truncate max-w-[120px] hover:text-indigo-800"
        >
          {fileName}
        </a>
      )}
    </div>
  </div>
);

/* ────────────── Main Page ─────────────── */
export default function CollectionCreatePage() {
  const router = useRouter();
  const searchTimers = useRef<Record<string, number>>({});

  const [saving, setSaving] = useState(false);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankOptions, setBankOptions] = useState<BankOption[]>([]);
  const [onlineCopy, setOnlineCopy] = useState({
    onlineCopyNo: "",
    onlineCopyDate: today(),
    bankDepositCharge: 0,
    bankAccountId: "",
    mediaId: "",
    mediaName: "",
    mediaUrl: "",
  });
  const [dealers, setDealers] = useState<DealerRow[]>([emptyDealer()]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBankLoading(true);
      try {
        const res = await api.get(
          "/voucher-accounts?role=Bank&isActive=true&limit=500",
        );
        const list = res?.data?.data ?? res?.data ?? [];
        if (!cancelled) setBankOptions(list.map(normalizeBankOption));
      } catch {
        if (!cancelled) setBankOptions([]);
      } finally {
        if (!cancelled) setBankLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      Object.values(searchTimers.current).forEach(clearTimeout);
    };
  }, []);

  // ── State mutations (unchanged) ────────────────
  const patchDealer = (id: string, updater: (d: DealerRow) => DealerRow) =>
    setDealers((prev) => prev.map((d) => (d.id === id ? updater(d) : d)));

  const patchInvoice = (
    dealerId: string,
    invId: string,
    updater: (i: InvoiceRow) => InvoiceRow,
  ) =>
    patchDealer(dealerId, (d) => ({
      ...d,
      invoices: d.invoices.map((i) => (i.id === invId ? updater(i) : i)),
    }));

  const updateMr = (
    dealerId: string,
    invId: string,
    mrId: string,
    patch: Partial<MrRow>,
  ) => {
    patchInvoice(dealerId, invId, (inv) => ({
      ...inv,
      mrs: inv.mrs.map((mr) => (mr.id === mrId ? { ...mr, ...patch } : mr)),
    }));
  };

  const addDealer = () => setDealers((prev) => [...prev, emptyDealer()]);
  const removeDealer = (id: string) =>
    setDealers((prev) => prev.filter((d) => d.id !== id));

  const addMr = (dealerId: string, invId: string) =>
    patchInvoice(dealerId, invId, (inv) => ({
      ...inv,
      mrs: [...inv.mrs, emptyMr()],
    }));
  const removeMr = (dealerId: string, invId: string, mrId: string) =>
    patchInvoice(dealerId, invId, (inv) => ({
      ...inv,
      mrs: inv.mrs.filter((m) => m.id !== mrId),
    }));
  const removeInvoice = (dealerId: string, invId: string) =>
    patchDealer(dealerId, (d) => ({
      ...d,
      invoices: d.invoices.filter((i) => i.id !== invId),
    }));

  const toggleInvoice = (dealerId: string, option: InvoiceOption) =>
    patchDealer(dealerId, (dealer) => {
      const exists = dealer.invoices.some((i) => i.invoiceId === option._id);
      if (exists)
        return {
          ...dealer,
          invoices: dealer.invoices.filter((i) => i.invoiceId !== option._id),
        };
      return {
        ...dealer,
        invoices: [
          ...dealer.invoices,
          {
            id: uid(),
            invoiceId: option._id,
            invoiceNo: option.invoiceNo,
            orderNo: option.orderNo,
            grandTotal: option.grandTotal,
            paidAmount: option.paidAmount,
            balanceAmount: option.balanceAmount,
            paymentStatus: option.paymentStatus,
            mrs: [emptyMr()],
          },
        ],
      };
    });

  // ── Dealer search & invoice loading (unchanged) ──
  const searchDealers = (id: string, q: string) => {
    patchDealer(id, (d) => ({ ...d, query: q }));
    clearTimeout(searchTimers.current[id]);
    searchTimers.current[id] = window.setTimeout(async () => {
      if (q.trim().length < 2)
        return patchDealer(id, (d) => ({ ...d, options: [] }));
      patchDealer(id, (d) => ({ ...d, loading: true }));
      try {
        const res = await api.get(
          `/dealers?q=${encodeURIComponent(q)}&limit=10`,
        );
        const list = res?.data?.data ?? res?.data ?? [];
        patchDealer(id, (d) => ({ ...d, options: list }));
      } catch {
        patchDealer(id, (d) => ({ ...d, options: [] }));
      } finally {
        patchDealer(id, (d) => ({ ...d, loading: false }));
      }
    }, 220);
  };

  const selectDealer = async (id: string, dealer: any) => {
    const dealerId = resolveId(dealer);
    const dealerName = resolveLabel(dealer);
    patchDealer(id, () => ({
      ...emptyDealer(),
      id,
      dealerId,
      dealerName,
      query: dealerName,
    }));
    if (!dealerId) return;
    try {
      const res = await api.get(
        `/sales-invoices?customerId=${dealerId}&limit=1000`,
      );
      const list = (res?.data?.data ?? res?.data ?? []).map(
        normalizeInvoiceOption,
      );
      patchDealer(id, (d) => ({ ...d, invoiceOptions: list }));
    } catch {
      patchDealer(id, (d) => ({ ...d, invoiceOptions: [] }));
    }
  };

  // ── File uploads (unchanged) ───────────────────
  const uploadFile = async (
    file: File | null,
    folder: "mr" | "onlineCopy" = "mr",
  ) => {
    if (!file) return null;
    const fd = new FormData();
    fd.append("file", file);
    const res = await api.post(
      `/media/upload?module=collections&folder=${folder}`,
      fd,
    );
    const data = res?.data?.data ?? res?.data ?? {};
    const mediaId = data?._id || data?.id || data?.mediaId || "";
    if (!mediaId) throw new Error("Upload failed");
    return {
      mediaId,
      mediaUrl:
        data?.url ||
        data?.path ||
        data?.fileUrl ||
        data?.location ||
        data?.src ||
        "",
      mediaName: data?.originalName || data?.originalname || file.name || "",
    };
  };

  const uploadMrFile = async (
    dealerId: string,
    invId: string,
    mrId: string,
    file?: File | null,
  ) => {
    if (!file) return;
    try {
      toast.loading("Uploading...");
      const up = await uploadFile(file, "mr");
      if (up)
        updateMr(dealerId, invId, mrId, {
          mediaId: up.mediaId,
          mediaName: up.mediaName,
          mediaUrl: up.mediaUrl,
        });
      toast.dismiss();
      toast.success("File uploaded");
    } catch (e: any) {
      toast.dismiss();
      toast.error(e?.message || "Upload failed");
    }
  };

  const uploadOnlineCopyFile = async (file?: File | null) => {
    if (!file) return;
    try {
      toast.loading("Uploading...");
      const up = await uploadFile(file, "onlineCopy");
      if (up) setOnlineCopy((p) => ({ ...p, ...up }));
      toast.dismiss();
      toast.success("File uploaded");
    } catch (e: any) {
      toast.dismiss();
      toast.error(e?.message || "Upload failed");
    }
  };

  // ── Validation Helpers (unchanged) ──────────────
  const globalMrNos = useMemo(() => {
    const map = new Map<string, string>();
    dealers.forEach((d) => {
      if (!d.dealerId) return;
      d.invoices.forEach((inv) =>
        inv.mrs.forEach((mr) => {
          const no = cleanText(mr.mrNo);
          if (no) map.set(no, d.dealerId);
        }),
      );
    });
    return map;
  }, [dealers]);

  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    const globalSet = new Map<string, string>();

    for (const dealer of dealers) {
      if (!dealer.dealerId) continue;
      for (const inv of dealer.invoices) {
        if (!inv.invoiceId) continue;

        const seen = new Set<string>();
        for (const mr of inv.mrs) {
          const no = cleanText(mr.mrNo);
          if (!no) continue;
          if (seen.has(no)) {
            errors.push(`MR No "${no}" duplicated in invoice ${inv.invoiceNo}`);
          }
          seen.add(no);

          if (globalSet.has(no) && globalSet.get(no) !== dealer.dealerId) {
            errors.push(`MR No "${no}" already used by another dealer`);
          } else {
            globalSet.set(no, dealer.dealerId);
          }
        }

        const totalReduction = roundMoney(
          inv.mrs.reduce((sum, mr) => {
            const comm = calcCommission(mr.taka, mr.commission);
            return (
              sum + (mr.deductCommission ? mr.taka : roundMoney(mr.taka + comm))
            );
          }, 0),
        );
        if (totalReduction > roundMoney(inv.balanceAmount) + 0.005) {
          errors.push(
            `Invoice ${inv.invoiceNo}: reduction ${moneyFmt(totalReduction)} exceeds due ${moneyFmt(inv.balanceAmount)}`,
          );
        }

        for (const mr of inv.mrs) {
          if (mr.deductCommission) {
            const comm = calcCommission(mr.taka, mr.commission);
            if (comm > roundMoney(mr.taka) + 0.005) {
              errors.push(
                `MR ${cleanText(mr.mrNo)}: commission cannot exceed cash in deduct mode`,
              );
            }
          }
        }
      }
    }
    return errors;
  }, [dealers]);

  // ── Totals (unchanged) ─────────────────────────
  const allMRs = useMemo(() => {
    const list: MrRow[] = [];
    dealers.forEach((d) =>
      d.invoices.forEach((inv) => inv.mrs.forEach((mr) => list.push(mr))),
    );
    return list;
  }, [dealers]);

  const totals = useMemo(() => {
    const totalDealers = dealers.filter((d) => d.dealerId).length;
    const totalInvoices = dealers.reduce(
      (sum, d) => sum + d.invoices.filter((i) => i.invoiceId).length,
      0,
    );
    const totalMRAmount = roundMoney(allMRs.reduce((s, mr) => s + mr.taka, 0));
    const totalCommission = roundMoney(
      allMRs.reduce((s, mr) => s + calcCommission(mr.taka, mr.commission), 0),
    );
    const totalDeductCommission = roundMoney(
      allMRs
        .filter((mr) => mr.deductCommission)
        .reduce((s, mr) => s + calcCommission(mr.taka, mr.commission), 0),
    );
    const bankCharge = roundMoney(onlineCopy.bankDepositCharge || 0);
    const netBankDeposit = roundMoney(
      totalMRAmount - totalDeductCommission - bankCharge,
    );
    const uniqueMRs = new Set(
      allMRs.map((mr) => cleanText(mr.mrNo)).filter(Boolean),
    ).size;
    const ready =
      totalDealers > 0 &&
      totalInvoices > 0 &&
      uniqueMRs > 0 &&
      !!onlineCopy.onlineCopyNo &&
      !!onlineCopy.bankAccountId &&
      !!onlineCopy.mediaId &&
      validationErrors.length === 0;
    return {
      totalDealers,
      totalInvoices,
      totalMRs: uniqueMRs,
      totalMRAmount,
      totalCommission,
      totalDeductCommission,
      bankCharge,
      netBankDeposit,
      ready,
    };
  }, [dealers, allMRs, onlineCopy, validationErrors]);

  // ── Submit (unchanged) ─────────────────────────
  const validate = () => {
    if (!totals.totalDealers) return "Select at least one dealer.";
    if (!totals.totalInvoices) return "Select at least one invoice.";
    if (!totals.totalMRs) return "Add at least one MR.";
    if (!onlineCopy.onlineCopyNo) return "Online Copy No is required.";
    if (!onlineCopy.bankAccountId) return "Select a bank account.";
    if (!onlineCopy.mediaId) return "Upload online copy file.";
    if (validationErrors.length) return validationErrors[0];
    for (const dealer of dealers) {
      if (!dealer.dealerId) continue;
      for (const inv of dealer.invoices) {
        if (!inv.invoiceId) continue;
        if (!inv.mrs.length)
          return `Invoice ${inv.invoiceNo} needs at least one MR.`;
        for (const mr of inv.mrs) {
          if (!cleanText(mr.mrNo)) return "MR No is required.";
          if (mr.taka <= 0) return "MR amount must be > 0.";
        }
      }
    }
    return null;
  };

  const submit = async () => {
    const err = validate();
    if (err) return toast.error(err);
    setSaving(true);
    try {
      const payload = {
        dealers: dealers
          .filter((d) => d.dealerId)
          .map((d) => ({
            dealerId: d.dealerId,
            dealerName: d.dealerName,
            invoices: d.invoices
              .filter((i) => i.invoiceId)
              .map((i) => ({
                invoiceId: i.invoiceId,
                invoiceNo: i.invoiceNo,
                moneyReceipts: i.mrs
                  .filter((m) => cleanText(m.mrNo))
                  .map((m) => ({
                    mrNo: cleanText(m.mrNo),
                    mrDate: m.mrDate,
                    taka: roundMoney(m.taka),
                    deductCommission: m.deductCommission,
                    commission: {
                      mode: m.commission.mode,
                      value: roundMoney(m.commission.value),
                      amount: calcCommission(m.taka, m.commission),
                    },
                    mediaId: cleanText(m.mediaId) || null,
                  })),
              })),
          })),
        onlineCopy: {
          onlineCopyNo: onlineCopy.onlineCopyNo,
          onlineCopyDate: onlineCopy.onlineCopyDate,
          onlineCopyTaka: totals.totalMRAmount,
          bankDepositCharge: onlineCopy.bankDepositCharge,
          bankAccountId: onlineCopy.bankAccountId,
          mediaId: onlineCopy.mediaId,
        },
      };
      await api.post("/collection", payload);
      toast.success("Collection created!");
      router.push("/accounts/collections");
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to create collection",
      );
    } finally {
      setSaving(false);
    }
  };

  /* ────────────── STUNNING UI ──────────────────── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/20 to-blue-50">
      <Toaster position="top-right" richColors />
      <div className="max-w-[1440px] mx-auto px-4 py-8 sm:px-6 lg:px-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8"
        >
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-indigo-500/10 to-blue-500/10 border border-indigo-200 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-3">
              <Banknote size={14} /> Collection Entry
            </div>
            <h1 className="text-5xl font-extrabold tracking-tight text-slate-900">
              Create Collection
            </h1>
            <p className="mt-2 text-slate-500 max-w-2xl text-lg">
              A powerful yet simple tool to record dealer payments, apply
              flexible commissions, and manage bank deposits.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge
              variant={totals.ready ? "outline" : "destructive"}
              className={`px-4 py-2 rounded-full text-sm font-medium ${
                totals.ready
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : ""
              }`}
            >
              {totals.ready ? (
                <CheckCircle2 size={14} className="mr-1 inline" />
              ) : (
                <AlertCircle size={14} className="mr-1 inline" />
              )}
              {totals.ready ? "Ready to Submit" : "Incomplete"}
            </Badge>
            <Button
              onClick={submit}
              disabled={saving}
              size="lg"
              className="rounded-full px-8 py-3 font-bold shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 transition-all bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700"
            >
              {saving ? "Saving..." : "Submit Collection"}
            </Button>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-[1fr_400px] gap-8">
          {/* ── Left Column ── */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="Dealers"
                value={totals.totalDealers}
                icon={Users}
              />
              <StatCard
                label="Invoices"
                value={totals.totalInvoices}
                icon={Receipt}
              />
              <StatCard label="MRs" value={totals.totalMRs} icon={FileText} />
              <StatCard
                label="Net to Bank"
                value={moneyFmt(totals.netBankDeposit)}
                accent
                icon={Wallet}
              />
            </div>

            {/* Dealers Section */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Dealers & Invoices
                </h2>
                <p className="text-sm text-slate-500">
                  Select a dealer, attach invoices, and add money receipts with
                  commission preferences.
                </p>
              </div>
              <Button
                onClick={addDealer}
                variant="outline"
                className="rounded-full gap-2 font-semibold border-slate-300 hover:bg-slate-50"
              >
                <Plus size={18} /> Add Dealer
              </Button>
            </div>

            <AnimatePresence>
              {dealers.map((dealer, idx) => {
                // ── Per‑dealer computed totals ──
                const dealerMRs = dealer.invoices.flatMap((inv) => inv.mrs);
                const dealerCash = roundMoney(
                  dealerMRs.reduce((s, m) => s + m.taka, 0),
                );
                const dealerCommission = roundMoney(
                  dealerMRs.reduce(
                    (s, m) => s + calcCommission(m.taka, m.commission),
                    0,
                  ),
                );
                const dealerReduction = roundMoney(
                  dealerMRs.reduce(
                    (s, m) =>
                      s +
                      (m.deductCommission
                        ? m.taka
                        : roundMoney(
                            m.taka + calcCommission(m.taka, m.commission),
                          )),
                    0,
                  ),
                );

                return (
                  <motion.div
                    key={dealer.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="rounded-3xl border border-slate-200 bg-white/80 backdrop-blur-sm shadow-xl shadow-slate-200/50"
                  >
                    {/* Dealer Header */}
                    <div className="p-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-t-3xl">
                      <div className="flex-1 w-full relative">
                        <div className="flex items-center gap-3 mb-3">
                          <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-base font-bold shadow-md">
                            {idx + 1}
                          </span>
                          {dealer.dealerName ? (
                            <span className="font-bold text-xl text-slate-800">
                              {dealer.dealerName}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-lg">
                              Search a dealer to begin
                            </span>
                          )}
                          {dealer.dealerId && (
                            <Badge
                              variant="secondary"
                              className="ml-auto px-3 py-1"
                            >
                              {dealer.invoices.length} invoice(s)
                            </Badge>
                          )}
                        </div>
                        <div className="relative">
                          <Search
                            className="absolute left-4 top-3.5 text-slate-400"
                            size={20}
                          />
                          <Input
                            placeholder="Type dealer name..."
                            value={dealer.query}
                            onChange={(e) =>
                              searchDealers(dealer.id, e.target.value)
                            }
                            className="pl-12 py-6 rounded-2xl border-slate-200 bg-white text-base shadow-sm focus:ring-2 focus:ring-indigo-200"
                          />
                        </div>
                        {/* Dropdown rendered outside the card's overflow (just relative to this container) */}
                        {dealer.options.length > 0 && (
                          <div className="absolute z-30 mt-2 w-full rounded-2xl border bg-white shadow-2xl max-h-56 overflow-auto">
                            {dealer.options.map((opt: any) => (
                              <button
                                key={resolveId(opt)}
                                onClick={() => selectDealer(dealer.id, opt)}
                                className="w-full text-left px-5 py-3 hover:bg-indigo-50 flex justify-between items-center transition"
                              >
                                <span className="font-medium text-slate-800">
                                  {resolveLabel(opt)}
                                </span>
                                <Badge variant="outline">Select</Badge>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeDealer(dealer.id)}
                        disabled={dealers.length === 1}
                        className="text-rose-500 hover:bg-rose-50 rounded-xl"
                      >
                        <Trash2 size={22} />
                      </Button>
                    </div>

                    {/* Dealer Summary (always visible if dealer selected) */}
                    {dealer.dealerId && dealer.invoices.length > 0 && (
                      <div className="px-6 py-3 bg-slate-50 border-b flex flex-wrap gap-4 text-sm">
                        <div>
                          <span className="text-slate-500">
                            Cash Collected:
                          </span>{" "}
                          <strong>{moneyFmt(dealerCash)}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500">Commission:</span>{" "}
                          <strong className="text-amber-600">
                            {moneyFmt(dealerCommission)}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-500">
                            Total Reduction:
                          </span>{" "}
                          <strong>{moneyFmt(dealerReduction)}</strong>
                        </div>
                      </div>
                    )}

                    {dealer.dealerId && (
                      <div className="p-6 grid lg:grid-cols-2 gap-8">
                        {/* Invoice Picker */}
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-slate-800 text-lg">
                              Available Invoices
                            </h3>
                            <div className="flex gap-1">
                              {(["ALL", "UNPAID", "PARTIAL"] as const).map(
                                (f) => (
                                  <Badge
                                    key={f}
                                    variant={
                                      dealer.invoiceStatusFilter === f
                                        ? "default"
                                        : "outline"
                                    }
                                    className="cursor-pointer font-medium"
                                    onClick={() =>
                                      patchDealer(dealer.id, (d) => ({
                                        ...d,
                                        invoiceStatusFilter: f,
                                      }))
                                    }
                                  >
                                    {f === "ALL" ? "All" : f}
                                  </Badge>
                                ),
                              )}
                            </div>
                          </div>
                          <Input
                            placeholder="Filter invoices..."
                            value={dealer.invoiceQuery}
                            onChange={(e) =>
                              patchDealer(dealer.id, (d) => ({
                                ...d,
                                invoiceQuery: e.target.value,
                              }))
                            }
                            className="mb-4 rounded-2xl"
                          />
                          <div className="max-h-[480px] overflow-y-auto space-y-2 pr-1">
                            {dealer.invoiceOptions
                              .filter(isInvoiceSelectable)
                              .filter((inv) =>
                                `${inv.invoiceNo} ${inv.orderNo}`
                                  .toLowerCase()
                                  .includes(dealer.invoiceQuery.toLowerCase()),
                              )
                              .map((inv) => {
                                const selected = dealer.invoices.some(
                                  (i) => i.invoiceId === inv._id,
                                );
                                return (
                                  <motion.button
                                    key={inv._id}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() =>
                                      toggleInvoice(dealer.id, inv)
                                    }
                                    className={`w-full text-left p-5 rounded-2xl border transition-all ${
                                      selected
                                        ? "bg-indigo-50 border-indigo-300 shadow-md"
                                        : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
                                    }`}
                                  >
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <span className="font-bold text-slate-900">
                                          {inv.invoiceNo}
                                        </span>
                                        <span className="text-xs text-slate-500 ml-2">
                                          Order: {inv.orderNo || "-"}
                                        </span>
                                      </div>
                                      <Badge
                                        variant={
                                          selected ? "default" : "outline"
                                        }
                                      >
                                        {selected ? "Selected" : "Add"}
                                      </Badge>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3 mt-3 text-sm">
                                      <div>
                                        <span className="text-slate-500">
                                          Due
                                        </span>
                                        <p className="font-semibold text-slate-800">
                                          {moneyFmt(inv.balanceAmount)}
                                        </p>
                                      </div>
                                      <div>
                                        <span className="text-slate-500">
                                          Total
                                        </span>
                                        <p className="font-semibold text-slate-800">
                                          {moneyFmt(inv.grandTotal)}
                                        </p>
                                      </div>
                                      <div>
                                        <span className="text-slate-500">
                                          Items
                                        </span>
                                        <p className="font-semibold text-slate-800">
                                          {inv.itemsCount}
                                        </p>
                                      </div>
                                    </div>
                                  </motion.button>
                                );
                              })}
                          </div>
                        </div>

                        {/* Selected Invoices & MR Editor */}
                        <div>
                          <h3 className="font-bold text-slate-800 text-lg mb-4">
                            Attached Invoices ({dealer.invoices.length})
                          </h3>
                          {dealer.invoices.length === 0 ? (
                            <div className="text-center py-16 text-slate-400 border-2 border-dashed rounded-2xl">
                              <FileText
                                size={40}
                                className="mx-auto mb-3 opacity-50"
                              />
                              <p className="font-medium">
                                Select an invoice to begin
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-5">
                              {dealer.invoices.map((inv) => {
                                const invTotalReduction = roundMoney(
                                  inv.mrs.reduce((s, mr) => {
                                    const comm = calcCommission(
                                      mr.taka,
                                      mr.commission,
                                    );
                                    return (
                                      s +
                                      (mr.deductCommission
                                        ? mr.taka
                                        : roundMoney(mr.taka + comm))
                                    );
                                  }, 0),
                                );
                                const overDue =
                                  invTotalReduction >
                                  roundMoney(inv.balanceAmount) + 0.005;
                                const usagePercent = inv.balanceAmount
                                  ? Math.min(
                                      100,
                                      (invTotalReduction /
                                        roundMoney(inv.balanceAmount)) *
                                        100,
                                    )
                                  : 0;
                                const invCash = roundMoney(
                                  inv.mrs.reduce((s, m) => s + m.taka, 0),
                                );
                                const invCommission = roundMoney(
                                  inv.mrs.reduce(
                                    (s, m) =>
                                      s + calcCommission(m.taka, m.commission),
                                    0,
                                  ),
                                );

                                return (
                                  <Card
                                    key={inv.id}
                                    className={`border overflow-hidden rounded-2xl shadow-sm ${
                                      overDue
                                        ? "border-red-300 bg-red-50/30"
                                        : "border-slate-200"
                                    }`}
                                  >
                                    <div className="px-5 py-3 bg-white/50 flex items-center justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <FileText
                                            size={18}
                                            className="text-slate-400"
                                          />
                                          <span className="font-bold text-slate-900">
                                            {inv.invoiceNo}
                                          </span>
                                          <Badge
                                            variant="outline"
                                            className="text-xs"
                                          >
                                            Due {moneyFmt(inv.balanceAmount)}
                                          </Badge>
                                        </div>
                                        <div className="mt-2 w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                          <motion.div
                                            className={`h-full rounded-full ${overDue ? "bg-red-500" : "bg-gradient-to-r from-indigo-500 to-blue-500"}`}
                                            initial={{ width: 0 }}
                                            animate={{
                                              width: `${usagePercent}%`,
                                            }}
                                          />
                                        </div>
                                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                                          <span>
                                            Reduction:{" "}
                                            <strong>
                                              {moneyFmt(invTotalReduction)}
                                            </strong>
                                          </span>
                                          <span>
                                            Cash:{" "}
                                            <strong>{moneyFmt(invCash)}</strong>
                                          </span>
                                          <span>
                                            Commission:{" "}
                                            <strong>
                                              {moneyFmt(invCommission)}
                                            </strong>
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex gap-2 ml-4">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() =>
                                            addMr(dealer.id, inv.id)
                                          }
                                        >
                                          + MR
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() =>
                                            removeInvoice(dealer.id, inv.id)
                                          }
                                        >
                                          <Trash2
                                            size={16}
                                            className="text-rose-500"
                                          />
                                        </Button>
                                      </div>
                                    </div>

                                    <div className="p-5 space-y-4">
                                      {inv.mrs.map((mr, mrIdx) => {
                                        const commission = calcCommission(
                                          mr.taka,
                                          mr.commission,
                                        );
                                        const reduction = mr.deductCommission
                                          ? mr.taka
                                          : roundMoney(mr.taka + commission);
                                        const exceedsDue =
                                          reduction >
                                          roundMoney(inv.balanceAmount) + 0.005;
                                        const duplicateInInvoice =
                                          inv.mrs.filter(
                                            (m) =>
                                              cleanText(m.mrNo) ===
                                              cleanText(mr.mrNo),
                                          ).length > 1;
                                        const usedElsewhere = [
                                          ...globalMrNos.entries(),
                                        ].some(
                                          ([dId, no]) =>
                                            dId !== dealer.dealerId &&
                                            no === cleanText(mr.mrNo),
                                        );

                                        return (
                                          <div
                                            key={mr.id}
                                            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                                          >
                                            <div className="flex items-center justify-between mb-3">
                                              <div className="flex items-center gap-2">
                                                <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                                                  {mrIdx + 1}
                                                </span>
                                                <span className="font-semibold text-slate-800">
                                                  Money Receipt
                                                </span>
                                              </div>
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() =>
                                                  removeMr(
                                                    dealer.id,
                                                    inv.id,
                                                    mr.id,
                                                  )
                                                }
                                                disabled={inv.mrs.length === 1}
                                                className="text-rose-500 hover:bg-rose-50"
                                              >
                                                <Trash2 size={16} />
                                              </Button>
                                            </div>

                                            <div className="grid sm:grid-cols-2 gap-4">
                                              <div>
                                                <Label className="text-xs font-medium text-slate-600">
                                                  MR No
                                                </Label>
                                                <Input
                                                  value={mr.mrNo}
                                                  onChange={(e) =>
                                                    updateMr(
                                                      dealer.id,
                                                      inv.id,
                                                      mr.id,
                                                      { mrNo: e.target.value },
                                                    )
                                                  }
                                                  className={`mt-1 rounded-xl ${duplicateInInvoice || usedElsewhere ? "border-red-400 bg-red-50" : ""}`}
                                                />
                                                {duplicateInInvoice && (
                                                  <p className="text-xs text-red-500 mt-1">
                                                    Duplicate in invoice
                                                  </p>
                                                )}
                                                {usedElsewhere &&
                                                  !duplicateInInvoice && (
                                                    <p className="text-xs text-red-500 mt-1">
                                                      Used by another dealer
                                                    </p>
                                                  )}
                                              </div>
                                              <div>
                                                <Label className="text-xs font-medium text-slate-600">
                                                  Date
                                                </Label>
                                                <Input
                                                  type="date"
                                                  value={mr.mrDate}
                                                  onChange={(e) =>
                                                    updateMr(
                                                      dealer.id,
                                                      inv.id,
                                                      mr.id,
                                                      {
                                                        mrDate: e.target.value,
                                                      },
                                                    )
                                                  }
                                                  className="mt-1 rounded-xl"
                                                />
                                              </div>

                                              <div>
                                                <Label className="text-xs font-medium text-slate-600">
                                                  Cash Amount
                                                </Label>
                                                <Input
                                                  type="number"
                                                  value={mr.taka || ""}
                                                  onChange={(e) => {
                                                    const val = Number(
                                                      e.target.value || 0,
                                                    );
                                                    updateMr(
                                                      dealer.id,
                                                      inv.id,
                                                      mr.id,
                                                      { taka: val },
                                                    );
                                                  }}
                                                  className={`mt-1 rounded-xl ${exceedsDue ? "border-red-400 bg-red-50" : ""}`}
                                                />
                                              </div>
                                              <div>
                                                <Label className="text-xs font-medium text-slate-600">
                                                  Reduction
                                                </Label>
                                                <div className="mt-1 h-10 rounded-xl bg-slate-100 border flex items-center px-4 font-semibold text-slate-800">
                                                  {moneyFmt(reduction)}
                                                </div>
                                                {exceedsDue && (
                                                  <p className="text-xs text-red-500 mt-1">
                                                    Exceeds invoice due
                                                  </p>
                                                )}
                                              </div>


                                              {/* ------------ Checking (Testing) ------------ */}
                                              {mr.deductCommission === true && (
                                                <div>
                                                  <Label className="text-[8px] font-medium text-slate-600">
                                                    Actual Cash Amount (after commission) {String(mr.taka)} - {String(commission)} = {String(reduction)}
                                                  </Label>
                                                  <Input
                                                    type="number"
                                                    value={commission ? mr.taka - commission : mr.taka || ""}
                                                    onChange={(e) => {
                                                      const val = Number(
                                                        e.target.value || 0,
                                                      );
                                                      updateMr(
                                                        dealer.id,
                                                        inv.id,
                                                        mr.id,
                                                        { taka: val },
                                                      );
                                                    }}
                                                    className={`mt-1 rounded-xl ${exceedsDue ? "border-red-400 bg-red-50" : ""}`}
                                                  />
                                                </div>
                                              )}
                                              {/* --------xx-- Checking (Testing) --xx-------- */}


                                              {/* Commission Mode Toggle */}
                                              <div className="sm:col-span-2">
                                                <Label className="text-xs font-medium text-slate-600 mb-2 block">
                                                  Commission Mode
                                                </Label>
                                                <div className="flex gap-2">
                                                  <Button
                                                    size="sm"
                                                    variant={
                                                      !mr.deductCommission
                                                        ? "default"
                                                        : "outline"
                                                    }
                                                    className={`flex-1 rounded-xl font-medium ${
                                                      !mr.deductCommission
                                                        ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                                                        : ""
                                                    }`}
                                                    onClick={() =>
                                                      updateMr(
                                                        dealer.id,
                                                        inv.id,
                                                        mr.id,
                                                        {
                                                          deductCommission: false,
                                                        },
                                                      )
                                                    }
                                                  >
                                                    <ArrowUpCircle
                                                      size={16}
                                                      className="mr-1"
                                                    />{" "}
                                                    Add
                                                  </Button>
                                                  <Button
                                                    size="sm"
                                                    variant={
                                                      mr.deductCommission
                                                        ? "default"
                                                        : "outline"
                                                    }
                                                    className={`flex-1 rounded-xl font-medium ${
                                                      mr.deductCommission
                                                        ? "bg-amber-600 hover:bg-amber-700 text-white"
                                                        : ""
                                                    }`}
                                                    onClick={() =>
                                                      updateMr(
                                                        dealer.id,
                                                        inv.id,
                                                        mr.id,
                                                        {
                                                          deductCommission: true,
                                                        },
                                                      )
                                                    }
                                                  >
                                                    <ArrowDownCircle
                                                      size={16}
                                                      className="mr-1"
                                                    />{" "}
                                                    Deduct
                                                  </Button>
                                                </div>
                                              </div>

                                              {/* Commission Input */}
                                              <div className="sm:col-span-2">
                                                <div className="flex items-end gap-3">
                                                  <div className="flex-1">
                                                    <Label className="text-xs font-medium text-slate-600">
                                                      Commission
                                                    </Label>
                                                    <div className="flex gap-1 mt-1">
                                                      <Button
                                                        size="sm"
                                                        variant={
                                                          mr.commission.mode ===
                                                          "FIXED"
                                                            ? "default"
                                                            : "outline"
                                                        }
                                                        className={`rounded-xl font-medium ${
                                                          mr.commission.mode ===
                                                          "FIXED"
                                                            ? "bg-slate-800 text-white"
                                                            : "text-slate-600"
                                                        }`}
                                                        onClick={() =>
                                                          updateMr(
                                                            dealer.id,
                                                            inv.id,
                                                            mr.id,
                                                            {
                                                              commission: {
                                                                ...mr.commission,
                                                                mode: "FIXED",
                                                                amount:
                                                                  calcCommission(
                                                                    mr.taka,
                                                                    {
                                                                      ...mr.commission,
                                                                      mode: "FIXED",
                                                                    },
                                                                  ),
                                                              },
                                                            },
                                                          )
                                                        }
                                                      >
                                                        Fixed
                                                      </Button>
                                                      <Button
                                                        size="sm"
                                                        variant={
                                                          mr.commission.mode ===
                                                          "PERCENT"
                                                            ? "default"
                                                            : "outline"
                                                        }
                                                        className={`rounded-xl font-medium ${
                                                          mr.commission.mode ===
                                                          "PERCENT"
                                                            ? "bg-slate-800 text-white"
                                                            : "text-slate-600"
                                                        }`}
                                                        onClick={() =>
                                                          updateMr(
                                                            dealer.id,
                                                            inv.id,
                                                            mr.id,
                                                            {
                                                              commission: {
                                                                ...mr.commission,
                                                                mode: "PERCENT",
                                                                amount:
                                                                  calcCommission(
                                                                    mr.taka,
                                                                    {
                                                                      ...mr.commission,
                                                                      mode: "PERCENT",
                                                                    },
                                                                  ),
                                                              },
                                                            },
                                                          )
                                                        }
                                                      >
                                                        %
                                                      </Button>
                                                    </div>
                                                  </div>
                                                  <div className="w-28">
                                                    <Input
                                                      type="number"
                                                      placeholder={
                                                        mr.commission.mode ===
                                                        "PERCENT"
                                                          ? "Rate %"
                                                          : "Amount"
                                                      }
                                                      value={
                                                        mr.commission.value ||
                                                        ""
                                                      }
                                                      onChange={(e) => {
                                                        const val = Number(
                                                          e.target.value || 0,
                                                        );
                                                        updateMr(
                                                          dealer.id,
                                                          inv.id,
                                                          mr.id,
                                                          {
                                                            commission: {
                                                              ...mr.commission,
                                                              value: val,
                                                              amount:
                                                                calcCommission(
                                                                  mr.taka,
                                                                  {
                                                                    ...mr.commission,
                                                                    value: val,
                                                                  },
                                                                ),
                                                            },
                                                          },
                                                        );
                                                      }}
                                                      className="rounded-xl"
                                                    />
                                                  </div>
                                                </div>
                                                <p className="text-xs text-slate-500 mt-2">
                                                  Commission amount:{" "}
                                                  <strong>
                                                    {moneyFmt(commission)}
                                                  </strong>
                                                  {mr.deductCommission &&
                                                    " (deducted from cash)"}
                                                </p>
                                              </div>

                                              <div className="sm:col-span-2">
                                                <FileUpload
                                                  label="Supporting Document (Money Receipt File)"
                                                  fileName={mr.mediaName}
                                                  fileUrl={mr.mediaUrl}
                                                  onUpload={(file: File) =>
                                                    uploadMrFile(
                                                      dealer.id,
                                                      inv.id,
                                                      mr.id,
                                                      file,
                                                    )
                                                  }
                                                />
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </Card>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* ── Right Sidebar ── */}
          <div className="space-y-6">
            <div className="sticky top-8">
              <Card className="border-0 shadow-2xl rounded-3xl overflow-hidden bg-white/90 backdrop-blur-sm">
                <div className="bg-gradient-to-r from-indigo-500 to-blue-600 px-6 py-5">
                  <h2 className="text-xl font-bold text-white">Online Copy</h2>
                  <p className="text-indigo-100 text-sm">
                    Bank deposit details
                  </p>
                </div>
                <CardContent className="p-6 space-y-5">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">
                      Online Copy No
                    </Label>
                    <Input
                      value={onlineCopy.onlineCopyNo}
                      onChange={(e) =>
                        setOnlineCopy((p) => ({
                          ...p,
                          onlineCopyNo: e.target.value,
                        }))
                      }
                      className="mt-1 rounded-xl"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">
                      Date
                    </Label>
                    <Input
                      type="date"
                      value={onlineCopy.onlineCopyDate}
                      onChange={(e) =>
                        setOnlineCopy((p) => ({
                          ...p,
                          onlineCopyDate: e.target.value,
                        }))
                      }
                      className="mt-1 rounded-xl"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">
                      Bank Account
                    </Label>
                    <select
                      className="w-full mt-1 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"
                      value={onlineCopy.bankAccountId}
                      onChange={(e) =>
                        setOnlineCopy((p) => ({
                          ...p,
                          bankAccountId: e.target.value,
                        }))
                      }
                      disabled={bankLoading}
                    >
                      <option value="">
                        {bankLoading ? "Loading..." : "Select bank"}
                      </option>
                      {bankOptions.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">
                      Bank Charge
                    </Label>
                    <Input
                      type="number"
                      value={onlineCopy.bankDepositCharge || ""}
                      onChange={(e) =>
                        setOnlineCopy((p) => ({
                          ...p,
                          bankDepositCharge: Number(e.target.value || 0),
                        }))
                      }
                      className="mt-1 rounded-xl"
                    />
                  </div>
                  <FileUpload
                    label="Online Copy File"
                    fileName={onlineCopy.mediaName}
                    fileUrl={onlineCopy.mediaUrl}
                    onUpload={uploadOnlineCopyFile}
                  />
                </CardContent>
              </Card>

              <Card className="mt-6 border-0 shadow-2xl rounded-3xl overflow-hidden">
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold text-slate-900 mb-5">
                    Summary
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Collected (Cash)</span>
                      <span className="font-bold text-slate-900 text-lg">
                        {moneyFmt(totals.totalMRAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Commission</span>
                      <span className="font-bold text-amber-600 text-lg">
                        {moneyFmt(totals.totalCommission)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Bank Charge</span>
                      <span className="font-bold text-slate-900">
                        {moneyFmt(totals.bankCharge)}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-base font-bold text-slate-800">
                        Net Bank Deposit
                      </span>
                      <span className="text-2xl font-extrabold text-emerald-600">
                        {moneyFmt(totals.netBankDeposit)}
                      </span>
                    </div>
                    {validationErrors.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm"
                      >
                        <AlertCircle size={16} className="inline mr-2" />
                        {validationErrors[0]}
                      </motion.div>
                    )}
                    <Button
                      className="w-full mt-4 rounded-xl py-6 text-base font-bold shadow-lg shadow-indigo-200"
                      onClick={submit}
                      disabled={saving}
                    >
                      {saving ? "Processing..." : "Submit Collection"}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full rounded-xl"
                      onClick={() => router.push("/accounts/collections")}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="mt-6 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-2xl p-5 border border-indigo-100">
                <h4 className="font-semibold text-slate-800 mb-2">
                  How it works
                </h4>
                <p className="text-sm text-slate-600 space-y-2">
                  <strong>Add mode:</strong> Dealer pays cash + commission on
                  top. Reduction = cash + commission.
                  <br />
                  <strong>Deduct mode:</strong> Commission taken from cash.
                  Reduction = cash (≤ due). Bank receives cash − commission.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
