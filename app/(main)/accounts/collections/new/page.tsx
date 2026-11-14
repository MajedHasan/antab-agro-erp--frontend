"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  RefreshCw,
} from "lucide-react";

/* ───────── Types ───────── */
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

/* ───────── Helpers ───────── */
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

/* ───────── SectionHeader ───────── */
function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  right,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-2.5">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#3aa838]/10">
          <Icon className="h-3.5 w-3.5 text-[#3aa838]" />
        </div>
        <div>
          <div className="text-sm font-semibold">{title}</div>
          {subtitle && (
            <div className="text-[11px] text-muted-foreground">{subtitle}</div>
          )}
        </div>
      </div>
      {right}
    </div>
  );
}

/* ───────── FileUpload ───────── */
function FileUpload({ label, fileName, fileUrl, onUpload }: any) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-slate-600">{label}</Label>
      <div className="flex items-center gap-2">
        <label className="flex-1 cursor-pointer rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500 hover:border-[#3aa838] hover:bg-[#3aa838]/5 transition">
          <input
            type="file"
            onChange={(e) => onUpload(e.target.files?.[0])}
            className="hidden"
          />
          <span className="flex items-center gap-1.5">
            <Upload className="h-3.5 w-3.5" />{" "}
            {fileName ? "Change file" : "Upload file"}
          </span>
        </label>
        {fileName && (
          <a
            href={`${process.env.NEXT_PUBLIC_MEDIA_URL || ""}${fileUrl}`}
            target="_blank"
            rel="noreferrer"
            className="max-w-[120px] truncate text-xs font-medium text-[#2f8a2f] underline hover:text-[#3aa838]"
          >
            {fileName}
          </a>
        )}
      </div>
    </div>
  );
}

/* ───────── Main ───────── */
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

  /* ───── Mutations ───── */
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

  /* ───── Search ───── */
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

  /* ───── Uploads ───── */
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
      mediaUrl: data?.url || data?.path || "",
      mediaName: data?.originalName || file.name || "",
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

  /* ───── Validation ───── */
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
            errors.push(`MR "${no}" duplicated in invoice ${inv.invoiceNo}`);
          }
          seen.add(no);
          if (globalSet.has(no) && globalSet.get(no) !== dealer.dealerId) {
            errors.push(`MR "${no}" used by another dealer`);
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
            `Invoice ${inv.invoiceNo}: reduction exceeds due (${moneyFmt(
              totalReduction,
            )} / ${moneyFmt(inv.balanceAmount)})`,
          );
        }
        for (const mr of inv.mrs) {
          if (
            mr.deductCommission &&
            calcCommission(mr.taka, mr.commission) > roundMoney(mr.taka) + 0.005
          ) {
            errors.push(
              `MR ${cleanText(mr.mrNo)}: commission > cash in deduct mode`,
            );
          }
        }
      }
    }
    return errors;
  }, [dealers]);

  /* ───── Totals ───── */
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

  /* ───── Submit ───── */
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

  /* ───── Render ───── */
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl p-3 md:p-4">
        {/* Hero */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#3aa838]/10">
              <Banknote className="h-4 w-4 text-[#3aa838]" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-semibold leading-tight">
                Create Collection
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Dealers</span>
                  <b className="tabular-nums text-slate-900">
                    {totals.totalDealers}
                  </b>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">MRs</span>
                  <b className="tabular-nums text-slate-900">
                    {totals.totalMRs}
                  </b>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Net</span>
                  <b className="tabular-nums text-[#2f8a2f]">
                    ৳ {moneyFmt(totals.netBankDeposit)}
                  </b>
                </div>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            <Badge
              className={`border text-[10px] font-semibold ${
                totals.ready
                  ? "border-[#3aa838]/30 bg-[#3aa838]/10 text-[#2f8a2f]"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              {totals.ready ? (
                <CheckCircle2 className="mr-1 h-2.5 w-2.5" />
              ) : (
                <AlertCircle className="mr-1 h-2.5 w-2.5" />
              )}
              {totals.ready ? "Ready" : "Incomplete"}
            </Badge>
            <Button
              onClick={submit}
              disabled={saving}
              className="h-8 bg-[#3aa838] text-white hover:bg-[#2f8a2f]"
            >
              {saving ? "Saving..." : "Submit"}
            </Button>
          </div>
        </div>

        {/* 4 quick stat cards (restored) */}
        <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          {[
            {
              label: "Dealers",
              value: String(totals.totalDealers),
              icon: Users,
              tone: "slate" as const,
            },
            {
              label: "Invoices",
              value: String(totals.totalInvoices),
              icon: Receipt,
              tone: "slate" as const,
            },
            {
              label: "Money receipts",
              value: String(totals.totalMRs),
              icon: FileText,
              tone: "slate" as const,
            },
            {
              label: "Net to bank",
              value: `৳ ${moneyFmt(totals.netBankDeposit)}`,
              icon: Wallet,
              tone: "green" as const,
            },
          ].map((s) => {
            const toneMap = {
              green: {
                chip: "bg-[#3aa838]/10 text-[#3aa838]",
                num: "text-[#2f8a2f]",
              },
              slate: {
                chip: "bg-slate-100 text-slate-600",
                num: "text-slate-900",
              },
            } as const;
            const t = toneMap[s.tone];
            const Icon = s.icon;
            return (
              <Card
                key={s.label}
                className="overflow-hidden border-slate-200 shadow-sm"
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {s.label}
                      </div>
                      <div
                        className={`mt-1 truncate text-lg font-bold tabular-nums ${t.num}`}
                      >
                        {s.value}
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

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* LEFT: Dealers */}
          <div className="space-y-3">
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <SectionHeader
                icon={Users}
                title="Dealers & invoices"
                subtitle="Search dealers, attach invoices, add money receipts"
                right={
                  <Button
                    onClick={addDealer}
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                  >
                    <Plus className="mr-1 h-3 w-3" /> Add dealer
                  </Button>
                }
              />

              <CardContent className="space-y-3 p-3">
                {dealers.map((dealer, idx) => {
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
                    <div
                      key={dealer.id}
                      className="rounded-xl border border-slate-200 bg-white"
                    >
                      {/* Dealer header */}
                      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50/60 px-3 py-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                          {idx + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          {dealer.dealerName ? (
                            <div className="truncate text-sm font-semibold text-slate-900">
                              {dealer.dealerName}
                            </div>
                          ) : (
                            <div className="text-xs text-slate-500">
                              Search a dealer
                            </div>
                          )}
                        </div>
                        {dealer.dealerId && dealer.invoices.length > 0 && (
                          <Badge
                            variant="outline"
                            className="text-[10px]"
                          >
                            {dealer.invoices.length} invoice(s)
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeDealer(dealer.id)}
                          disabled={dealers.length === 1}
                          className="h-7 w-7 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {/* Dealer summary row (restored) */}
                      {dealer.dealerId && dealer.invoices.length > 0 && (
                        <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px]">
                          <div>
                            <span className="text-muted-foreground">
                              Cash collected:
                            </span>{" "}
                            <b className="text-slate-900 tabular-nums">
                              ৳ {moneyFmt(dealerCash)}
                            </b>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Commission:
                            </span>{" "}
                            <b className="text-amber-700 tabular-nums">
                              ৳ {moneyFmt(dealerCommission)}
                            </b>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Total reduction:
                            </span>{" "}
                            <b className="text-[#2f8a2f] tabular-nums">
                              ৳ {moneyFmt(dealerReduction)}
                            </b>
                          </div>
                        </div>
                      )}

                      {/* Dealer body */}
                      <div className="p-3 space-y-3">
                        {/* Dealer search */}
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            placeholder="Type dealer name..."
                            value={dealer.query}
                            onChange={(e) =>
                              searchDealers(dealer.id, e.target.value)
                            }
                            className="h-9 pl-8 text-sm focus-visible:ring-[#3aa838]"
                          />
                          {dealer.options.length > 0 && (
                            <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                              {dealer.options.map((opt: any) => (
                                <button
                                  key={resolveId(opt)}
                                  onClick={() =>
                                    selectDealer(dealer.id, opt)
                                  }
                                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-slate-50"
                                >
                                  <span className="truncate font-medium">
                                    {resolveLabel(opt)}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className="text-[10px]"
                                  >
                                    Select
                                  </Badge>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Invoice picker + attached */}
                        {dealer.dealerId && (
                          <div className="grid gap-3 lg:grid-cols-2">
                            {/* Available invoices */}
                            <div>
                              <div className="mb-2 flex items-center justify-between">
                                <div className="text-xs font-semibold text-slate-700">
                                  Available invoices
                                </div>
                                <div className="flex gap-1">
                                  {(
                                    ["ALL", "UNPAID", "PARTIAL"] as const
                                  ).map((f) => (
                                    <Badge
                                      key={f}
                                      variant={
                                        dealer.invoiceStatusFilter === f
                                          ? "default"
                                          : "outline"
                                      }
                                      className="cursor-pointer text-[10px]"
                                      onClick={() =>
                                        patchDealer(dealer.id, (d) => ({
                                          ...d,
                                          invoiceStatusFilter: f,
                                        }))
                                      }
                                    >
                                      {f === "ALL" ? "All" : f}
                                    </Badge>
                                  ))}
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
                                className="mb-2 h-8 text-xs focus-visible:ring-[#3aa838]"
                              />
                              <div className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
                                {dealer.invoiceOptions
                                  .filter(isInvoiceSelectable)
                                  .filter((inv) =>
                                    `${inv.invoiceNo} ${inv.orderNo}`
                                      .toLowerCase()
                                      .includes(
                                        dealer.invoiceQuery.toLowerCase(),
                                      ),
                                  )
                                  .map((inv) => {
                                    const selected = dealer.invoices.some(
                                      (i) => i.invoiceId === inv._id,
                                    );
                                    return (
                                      <button
                                        key={inv._id}
                                        onClick={() =>
                                          toggleInvoice(dealer.id, inv)
                                        }
                                        className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition ${
                                          selected
                                            ? "border-[#3aa838]/40 bg-[#3aa838]/5"
                                            : "border-slate-200 bg-white hover:border-slate-300"
                                        }`}
                                      >
                                        <div className="flex items-center justify-between">
                                          <span className="font-mono font-semibold text-slate-900">
                                            {inv.invoiceNo}
                                          </span>
                                          <Badge
                                            variant={
                                              selected ? "default" : "outline"
                                            }
                                            className="text-[10px]"
                                          >
                                            {selected ? "Selected" : "Add"}
                                          </Badge>
                                        </div>
                                        <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                                          <span>
                                            Due:{" "}
                                            <b className="text-slate-900 tabular-nums">
                                              ৳ {moneyFmt(inv.balanceAmount)}
                                            </b>
                                          </span>
                                          <span>
                                            Total:{" "}
                                            <b className="text-slate-700 tabular-nums">
                                              ৳ {moneyFmt(inv.grandTotal)}
                                            </b>
                                          </span>
                                        </div>
                                      </button>
                                    );
                                  })}
                              </div>
                            </div>

                            {/* Attached invoices + MRs */}
                            <div>
                              <div className="mb-2 text-xs font-semibold text-slate-700">
                                Attached ({dealer.invoices.length})
                              </div>
                              {dealer.invoices.length === 0 ? (
                                <div className="rounded-lg border-2 border-dashed border-slate-200 p-6 text-center text-xs text-muted-foreground">
                                  <FileText className="mx-auto mb-1 h-5 w-5 opacity-50" />
                                  Pick an invoice to begin
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {dealer.invoices.map((inv) => {
                                    const totalReduction = roundMoney(
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
                                      totalReduction >
                                      roundMoney(inv.balanceAmount) + 0.005;
                                    const usagePercent = inv.balanceAmount
                                      ? Math.min(
                                          100,
                                          (totalReduction /
                                            roundMoney(inv.balanceAmount)) *
                                            100,
                                        )
                                      : 0;

                                    return (
                                      <div
                                        key={inv.id}
                                        className={`rounded-lg border ${
                                          overDue
                                            ? "border-rose-300 bg-rose-50/40"
                                            : "border-slate-200 bg-white"
                                        }`}
                                      >
                                        <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
                                          <div className="min-w-0 flex-1">
                                            <div className="font-mono text-xs font-semibold text-slate-900">
                                              {inv.invoiceNo}
                                            </div>
                                            {/* Progress bar (restored) */}
                                            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                                              <div
                                                className={`h-full rounded-full transition-all ${
                                                  overDue
                                                    ? "bg-rose-500"
                                                    : "bg-[#3aa838]"
                                                }`}
                                                style={{
                                                  width: `${usagePercent}%`,
                                                }}
                                              />
                                            </div>
                                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                                              <span>
                                                Reduction:{" "}
                                                <b className="text-slate-900 tabular-nums">
                                                  ৳ {moneyFmt(totalReduction)}
                                                </b>{" "}
                                                / Due:{" "}
                                                <b className="text-slate-700 tabular-nums">
                                                  ৳ {moneyFmt(inv.balanceAmount)}
                                                </b>
                                              </span>
                                            </div>
                                          </div>
                                          <div className="flex gap-1">
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() =>
                                                addMr(dealer.id, inv.id)
                                              }
                                              className="h-7 px-2 text-[10px]"
                                            >
                                              <Plus className="mr-0.5 h-3 w-3" />
                                              MR
                                            </Button>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              onClick={() =>
                                                removeInvoice(
                                                  dealer.id,
                                                  inv.id,
                                                )
                                              }
                                              className="h-7 w-7 text-rose-600 hover:bg-rose-50"
                                            >
                                              <Trash2 className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        </div>

                                        <div className="space-y-2 p-2">
                                          {inv.mrs.map((mr, mIdx) => {
                                            const commission = calcCommission(
                                              mr.taka,
                                              mr.commission,
                                            );
                                            const reduction =
                                              mr.deductCommission
                                                ? mr.taka
                                                : roundMoney(
                                                    mr.taka + commission,
                                                  );
                                            const exceedsDue =
                                              reduction >
                                              roundMoney(inv.balanceAmount) +
                                                0.005;
                                            const dup =
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
                                                className="rounded-md border border-slate-200 bg-slate-50/50 p-2"
                                              >
                                                <div className="mb-2 flex items-center justify-between">
                                                  <div className="flex items-center gap-1.5">
                                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#3aa838]/10 text-[9px] font-bold text-[#2f8a2f]">
                                                      {mIdx + 1}
                                                    </span>
                                                    <span className="text-[11px] font-semibold text-slate-700">
                                                      MR
                                                    </span>
                                                  </div>
                                                  <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={() =>
                                                      removeMr(
                                                        dealer.id,
                                                        inv.id,
                                                        mr.id,
                                                      )
                                                    }
                                                    disabled={
                                                      inv.mrs.length === 1
                                                    }
                                                    className="h-6 w-6 text-rose-600 hover:bg-rose-50"
                                                  >
                                                    <Trash2 className="h-3 w-3" />
                                                  </Button>
                                                </div>

                                                <div className="grid gap-2 sm:grid-cols-2">
                                                  <div>
                                                    <Label className="text-[10px] text-slate-600">
                                                      MR No
                                                    </Label>
                                                    <Input
                                                      value={mr.mrNo}
                                                      onChange={(e) =>
                                                        updateMr(
                                                          dealer.id,
                                                          inv.id,
                                                          mr.id,
                                                          {
                                                            mrNo: e.target
                                                              .value,
                                                          },
                                                        )
                                                      }
                                                      className={`h-8 text-xs focus-visible:ring-[#3aa838] ${
                                                        dup || usedElsewhere
                                                          ? "border-rose-400 bg-rose-50"
                                                          : ""
                                                      }`}
                                                    />
                                                    {(dup ||
                                                      usedElsewhere) && (
                                                      <p className="mt-0.5 text-[9px] text-rose-600">
                                                        {dup
                                                          ? "Duplicate"
                                                          : "Used elsewhere"}
                                                      </p>
                                                    )}
                                                  </div>
                                                  <div>
                                                    <Label className="text-[10px] text-slate-600">
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
                                                            mrDate:
                                                              e.target.value,
                                                          },
                                                        )
                                                      }
                                                      className="h-8 text-xs focus-visible:ring-[#3aa838]"
                                                    />
                                                  </div>
                                                  <div>
                                                    <Label className="text-[10px] text-slate-600">
                                                      Cash
                                                    </Label>
                                                    <Input
                                                      type="number"
                                                      value={mr.taka || ""}
                                                      onChange={(e) =>
                                                        updateMr(
                                                          dealer.id,
                                                          inv.id,
                                                          mr.id,
                                                          {
                                                            taka: Number(
                                                              e.target.value ||
                                                                0,
                                                            ),
                                                          },
                                                        )
                                                      }
                                                      className={`h-8 text-xs focus-visible:ring-[#3aa838] ${
                                                        exceedsDue
                                                          ? "border-rose-400 bg-rose-50"
                                                          : ""
                                                      }`}
                                                    />
                                                  </div>
                                                  <div>
                                                    <Label className="text-[10px] text-slate-600">
                                                      Reduction
                                                    </Label>
                                                    <div className="flex h-8 items-center rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold tabular-nums text-slate-900">
                                                      ৳ {moneyFmt(reduction)}
                                                    </div>
                                                  </div>

                                                  {/* Commission mode */}
                                                  <div className="sm:col-span-2">
                                                    <Label className="text-[10px] text-slate-600">
                                                      Commission mode
                                                    </Label>
                                                    <div className="mt-1 flex gap-1">
                                                      <Button
                                                        size="sm"
                                                        variant={
                                                          !mr.deductCommission
                                                            ? "default"
                                                            : "outline"
                                                        }
                                                        className={`h-7 flex-1 text-[10px] ${
                                                          !mr.deductCommission
                                                            ? "bg-[#3aa838] text-white hover:bg-[#2f8a2f]"
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
                                                        <ArrowUpCircle className="mr-1 h-3 w-3" />
                                                        Add
                                                      </Button>
                                                      <Button
                                                        size="sm"
                                                        variant={
                                                          mr.deductCommission
                                                            ? "default"
                                                            : "outline"
                                                        }
                                                        className={`h-7 flex-1 text-[10px] ${
                                                          mr.deductCommission
                                                            ? "bg-amber-600 text-white hover:bg-amber-700"
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
                                                        <ArrowDownCircle className="mr-1 h-3 w-3" />
                                                        Deduct
                                                      </Button>
                                                    </div>
                                                  </div>

                                                  {/* Commission input */}
                                                  <div className="sm:col-span-2">
                                                    <div className="flex items-end gap-2">
                                                      <div className="flex-1">
                                                        <Label className="text-[10px] text-slate-600">
                                                          Commission
                                                        </Label>
                                                        <div className="mt-1 flex gap-1">
                                                          <Button
                                                            size="sm"
                                                            variant={
                                                              mr.commission
                                                                .mode ===
                                                              "FIXED"
                                                                ? "default"
                                                                : "outline"
                                                            }
                                                            className={`h-7 text-[10px] ${
                                                              mr.commission
                                                                .mode ===
                                                              "FIXED"
                                                                ? "bg-slate-800 text-white"
                                                                : ""
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
                                                              mr.commission
                                                                .mode ===
                                                              "PERCENT"
                                                                ? "default"
                                                                : "outline"
                                                            }
                                                            className={`h-7 text-[10px] ${
                                                              mr.commission
                                                                .mode ===
                                                              "PERCENT"
                                                                ? "bg-slate-800 text-white"
                                                                : ""
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
                                                      <div className="w-24">
                                                        <Input
                                                          type="number"
                                                          placeholder={
                                                            mr.commission
                                                              .mode ===
                                                            "PERCENT"
                                                              ? "Rate %"
                                                              : "Amount"
                                                          }
                                                          value={
                                                            mr.commission
                                                              .value || ""
                                                          }
                                                          onChange={(e) => {
                                                            const val = Number(
                                                              e.target.value ||
                                                                0,
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
                                                                        value:
                                                                          val,
                                                                      },
                                                                    ),
                                                                },
                                                              },
                                                            );
                                                          }}
                                                          className="h-8 text-xs focus-visible:ring-[#3aa838]"
                                                        />
                                                      </div>
                                                    </div>
                                                    <p className="mt-1 text-[10px] text-muted-foreground">
                                                      Commission:{" "}
                                                      <b className="text-amber-700">
                                                        ৳ {moneyFmt(commission)}
                                                      </b>
                                                      {mr.deductCommission &&
                                                        " (deducted from cash)"}
                                                    </p>
                                                  </div>

                                                  <div className="sm:col-span-2">
                                                    <FileUpload
                                                      label="MR file"
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
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT: Sidebar */}
          <div className="h-fit space-y-3 lg:sticky lg:top-4">
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <SectionHeader icon={Banknote} title="Online copy" />
              <CardContent className="space-y-3 p-3">
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-600">
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
                    className="h-8 text-xs focus-visible:ring-[#3aa838]"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-600">Date</Label>
                  <Input
                    type="date"
                    value={onlineCopy.onlineCopyDate}
                    onChange={(e) =>
                      setOnlineCopy((p) => ({
                        ...p,
                        onlineCopyDate: e.target.value,
                      }))
                    }
                    className="h-8 text-xs focus-visible:ring-[#3aa838]"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-600">
                    Bank account
                  </Label>
                  <select
                    value={onlineCopy.bankAccountId}
                    onChange={(e) =>
                      setOnlineCopy((p) => ({
                        ...p,
                        bankAccountId: e.target.value,
                      }))
                    }
                    disabled={bankLoading}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-[#3aa838]"
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
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-600">
                    Bank charge
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
                    className="h-8 text-xs focus-visible:ring-[#3aa838]"
                  />
                </div>
                <FileUpload
                  label="Online copy file"
                  fileName={onlineCopy.mediaName}
                  fileUrl={onlineCopy.mediaUrl}
                  onUpload={uploadOnlineCopyFile}
                />
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <SectionHeader icon={Wallet} title="Summary" />
              <CardContent className="space-y-2 p-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cash</span>
                  <b className="tabular-nums text-slate-900">
                    ৳ {moneyFmt(totals.totalMRAmount)}
                  </b>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Commission</span>
                  <b className="tabular-nums text-amber-700">
                    ৳ {moneyFmt(totals.totalCommission)}
                  </b>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bank charge</span>
                  <b className="tabular-nums text-slate-900">
                    ৳ {moneyFmt(totals.bankCharge)}
                  </b>
                </div>
                <Separator />
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm font-semibold text-slate-800">
                    Net bank deposit
                  </span>
                  <b className="text-lg font-extrabold tabular-nums text-[#2f8a2f]">
                    ৳ {moneyFmt(totals.netBankDeposit)}
                  </b>
                </div>
                {validationErrors.length > 0 && (
                  <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-700">
                    <AlertCircle className="mr-1 inline h-3 w-3" />
                    {validationErrors[0]}
                  </div>
                )}
                <Button
                  onClick={submit}
                  disabled={saving}
                  className="mt-1 h-9 w-full bg-[#3aa838] text-white hover:bg-[#2f8a2f]"
                >
                  {saving ? "Processing..." : "Submit collection"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push("/accounts/collections")}
                  className="h-8 w-full text-xs"
                >
                  Cancel
                </Button>
              </CardContent>
            </Card>

            {/* How it works (restored) */}
            <div className="rounded-lg border border-[#3aa838]/30 bg-gradient-to-br from-[#3aa838]/5 to-white p-3">
              <div className="mb-1.5 text-xs font-semibold text-[#2f8a2f]">
                How it works
              </div>
              <div className="space-y-1 text-[11px] text-slate-600">
                <div>
                  <b className="text-slate-900">Add mode:</b> Dealer pays cash
                  + commission on top. Reduction = cash + commission.
                </div>
                <div>
                  <b className="text-slate-900">Deduct mode:</b> Commission
                  taken from cash. Reduction = cash (≤ due). Bank receives
                  cash − commission.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}