"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
  Edit,
  Eye,
  Save,
  X,
  ChevronDown,
  ChevronUp,
  Clock,
  HelpCircle,
  XCircle,
  Loader2,
  ExternalLink,
  ArrowLeft,
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

const formatDate = (dateStr: string) =>
  dateStr
    ? new Date(dateStr).toLocaleDateString("en-BD", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "-";
const formatDateTime = (dateStr: string) =>
  dateStr
    ? new Date(dateStr).toLocaleString("en-BD", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

const statusConfig: Record<
  string,
  { label: string; cls: string; icon: any }
> = {
  SUBMITTED: {
    label: "Submitted",
    cls: "bg-slate-100 text-slate-700 border-slate-200",
    icon: Clock,
  },
  UNDER_REVIEW: {
    label: "Under Review",
    cls: "bg-amber-50 text-amber-700 border-amber-200",
    icon: HelpCircle,
  },
  APPROVED: {
    label: "Approved",
    cls: "bg-[#3aa838]/10 text-[#2f8a2f] border-[#3aa838]/30",
    icon: CheckCircle2,
  },
  HOLD: {
    label: "Hold",
    cls: "bg-rose-50 text-rose-700 border-rose-200",
    icon: AlertCircle,
  },
  DISPUTED: {
    label: "Disputed",
    cls: "bg-rose-50 text-rose-700 border-rose-200",
    icon: XCircle,
  },
  CANCELLED: {
    label: "Cancelled",
    cls: "bg-rose-50 text-rose-700 border-rose-200",
    icon: XCircle,
  },
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
  SUBMITTED: ["UNDER_REVIEW", "HOLD", "DISPUTED", "CANCELLED"],
  UNDER_REVIEW: ["APPROVED", "HOLD", "DISPUTED", "CANCELLED", "SUBMITTED"],
  HOLD: ["UNDER_REVIEW", "DISPUTED", "CANCELLED"],
  DISPUTED: ["UNDER_REVIEW", "HOLD", "CANCELLED"],
  APPROVED: [],
  CANCELLED: [],
};

/* ───────── Sub-components ───────── */
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
export default function CollectionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [collection, setCollection] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [dealers, setDealers] = useState<DealerRow[]>([emptyDealer()]);
  const [onlineCopy, setOnlineCopy] = useState({
    onlineCopyNo: "",
    onlineCopyDate: today(),
    bankDepositCharge: 0,
    bankAccountId: "",
    mediaId: "",
    mediaName: "",
    mediaUrl: "",
  });
  const [bankLoading, setBankLoading] = useState(false);
  const [bankOptions, setBankOptions] = useState<BankOption[]>([]);
  const searchTimers = useRef<Record<string, number>>({});

  const [expandedDealers, setExpandedDealers] = useState<Set<string>>(
    new Set(),
  );
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(
    new Set(),
  );

  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [statusRemarks, setStatusRemarks] = useState("");

  const fetchCollection = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/collection/${id}`);
      setCollection(res?.data?.data ?? res?.data ?? null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load collection");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    fetchCollection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!collection || !editMode) return;

    const initialDealers: DealerRow[] = (collection.dealers || []).map(
      (d: any) => ({
        id: uid(),
        dealerId: d.dealerId._id,
        dealerName: d.dealerName,
        query: d.dealerName,
        loading: false,
        options: [],
        invoiceOptions: [],
        invoiceQuery: "",
        invoiceStatusFilter: "ALL",
        invoices: (d.invoices || []).map((inv: any) => ({
          id: uid(),
          invoiceId: inv.invoiceId._id,
          invoiceNo: inv.invoiceNo,
          orderNo: inv.invoiceId.orderId?.orderNo || "",
          grandTotal: inv.invoiceId.grandTotal,
          paidAmount: inv.invoiceId.paidAmount,
          balanceAmount: inv.invoiceId.balanceAmount,
          paymentStatus: inv.invoiceId.paymentStatus,
          mrs: (inv.moneyReceipts || []).map((mr: any) => ({
            id: uid(),
            mrNo: mr.mrNo,
            mrDate: mr.mrDate?.slice(0, 10) || today(),
            taka: mr.taka,
            commission: mr.commission
              ? {
                  mode: mr.commission.mode,
                  value: mr.commission.value,
                  amount: mr.commission.amount,
                }
              : emptyCommission(),
            deductCommission: Boolean(mr.deductCommission),
            mediaId: mr.mediaId?._id || "",
            mediaName: mr.mediaId?.originalName || "",
            mediaUrl: mr.mediaId?.url || "",
          })),
        })),
      }),
    );

    setDealers(initialDealers);
    setOnlineCopy({
      onlineCopyNo: collection.onlineCopy.onlineCopyNo || "",
      onlineCopyDate:
        collection.onlineCopy.onlineCopyDate?.slice(0, 10) || today(),
      bankDepositCharge: collection.onlineCopy.bankDepositCharge || 0,
      bankAccountId: collection.onlineCopy.bankAccountId?._id || "",
      mediaId: collection.onlineCopy.mediaId?._id || "",
      mediaName: collection.onlineCopy.mediaId?.originalName || "",
      mediaUrl: collection.onlineCopy.mediaId?.url || "",
    });

    (async () => {
      setBankLoading(true);
      try {
        const res = await api.get(
          "/voucher-accounts?role=Bank&isActive=true&limit=500",
        );
        setBankOptions((res?.data?.data ?? []).map(normalizeBankOption));
      } catch {
        setBankOptions([]);
      } finally {
        setBankLoading(false);
      }
      for (const d of initialDealers) {
        if (d.dealerId) {
          try {
            const invRes = await api.get(
              `/sales-invoices?customerId=${d.dealerId}&limit=1000`,
            );
            const invList = (invRes?.data?.data ?? []).map(
              normalizeInvoiceOption,
            );
            setDealers((prev) =>
              prev.map((pd) =>
                pd.id === d.id ? { ...pd, invoiceOptions: invList } : pd,
              ),
            );
          } catch {}
        }
      }
    })();
  }, [collection, editMode]);

  /* ───── Edit mutations ───── */
  const patchDealer = (did: string, u: (d: DealerRow) => DealerRow) =>
    setDealers((prev) => prev.map((d) => (d.id === did ? u(d) : d)));
  const patchInvoice = (
    did: string,
    iid: string,
    u: (i: InvoiceRow) => InvoiceRow,
  ) =>
    patchDealer(did, (d) => ({
      ...d,
      invoices: d.invoices.map((i) => (i.id === iid ? u(i) : i)),
    }));
  const updateMr = (
    did: string,
    iid: string,
    mid: string,
    patch: Partial<MrRow>,
  ) =>
    patchInvoice(did, iid, (inv) => ({
      ...inv,
      mrs: inv.mrs.map((mr) => (mr.id === mid ? { ...mr, ...patch } : mr)),
    }));

  const addDealer = () => setDealers((prev) => [...prev, emptyDealer()]);
  const removeDealer = (did: string) =>
    setDealers((prev) => prev.filter((d) => d.id !== did));
  const addMr = (did: string, iid: string) =>
    patchInvoice(did, iid, (inv) => ({ ...inv, mrs: [...inv.mrs, emptyMr()] }));
  const removeMr = (did: string, iid: string, mid: string) =>
    patchInvoice(did, iid, (inv) => ({
      ...inv,
      mrs: inv.mrs.filter((m) => m.id !== mid),
    }));
  const removeInvoice = (did: string, iid: string) =>
    patchDealer(did, (d) => ({
      ...d,
      invoices: d.invoices.filter((i) => i.id !== iid),
    }));
  const toggleInvoice = (did: string, opt: InvoiceOption) =>
    patchDealer(did, (d) => {
      const exists = d.invoices.some((i) => i.invoiceId === opt._id);
      if (exists)
        return {
          ...d,
          invoices: d.invoices.filter((i) => i.invoiceId !== opt._id),
        };
      return {
        ...d,
        invoices: [
          ...d.invoices,
          {
            id: uid(),
            invoiceId: opt._id,
            invoiceNo: opt.invoiceNo,
            orderNo: opt.orderNo,
            grandTotal: opt.grandTotal,
            paidAmount: opt.paidAmount,
            balanceAmount: opt.balanceAmount,
            paymentStatus: opt.paymentStatus,
            mrs: [emptyMr()],
          },
        ],
      };
    });

  const searchDealers = (did: string, q: string) => {
    patchDealer(did, (d) => ({ ...d, query: q }));
    clearTimeout(searchTimers.current[did]);
    searchTimers.current[did] = window.setTimeout(async () => {
      if (q.trim().length < 2)
        return patchDealer(did, (d) => ({ ...d, options: [] }));
      patchDealer(did, (d) => ({ ...d, loading: true }));
      try {
        const res = await api.get(
          `/dealers?q=${encodeURIComponent(q)}&limit=10`,
        );
        patchDealer(did, (d) => ({ ...d, options: res?.data?.data ?? [] }));
      } catch {
        patchDealer(did, (d) => ({ ...d, options: [] }));
      } finally {
        patchDealer(did, (d) => ({ ...d, loading: false }));
      }
    }, 220);
  };

  const selectDealer = async (did: string, dealer: any) => {
    const dealerId = resolveId(dealer);
    const dealerName = resolveLabel(dealer);
    patchDealer(did, () => ({
      ...emptyDealer(),
      id: did,
      dealerId,
      dealerName,
      query: dealerName,
    }));
    if (!dealerId) return;
    try {
      const res = await api.get(
        `/sales-invoices?customerId=${dealerId}&limit=1000`,
      );
      patchDealer(did, (d) => ({
        ...d,
        invoiceOptions: (res?.data?.data ?? []).map(normalizeInvoiceOption),
      }));
    } catch {
      patchDealer(did, (d) => ({ ...d, invoiceOptions: [] }));
    }
  };

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
    did: string,
    iid: string,
    mid: string,
    file?: File | null,
  ) => {
    if (!file) return;
    try {
      const up = await uploadFile(file, "mr");
      if (up)
        updateMr(did, iid, mid, {
          mediaId: up.mediaId,
          mediaName: up.mediaName,
          mediaUrl: up.mediaUrl,
        });
      toast.success("File uploaded");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const uploadOnlineCopyFile = async (file?: File | null) => {
    if (!file) return;
    try {
      const up = await uploadFile(file, "onlineCopy");
      if (up) setOnlineCopy((p) => ({ ...p, ...up }));
      toast.success("File uploaded");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    const globalMrNos = new Map<string, string>();
    for (const d of dealers) {
      if (!d.dealerId) continue;
      for (const inv of d.invoices) {
        if (!inv.invoiceId) continue;
        const seen = new Set<string>();
        for (const mr of inv.mrs) {
          const no = cleanText(mr.mrNo);
          if (!no) continue;
          if (seen.has(no))
            errors.push(`MR "${no}" duplicated in invoice ${inv.invoiceNo}`);
          seen.add(no);
          if (globalMrNos.has(no) && globalMrNos.get(no) !== d.dealerId)
            errors.push(`MR "${no}" used by another dealer`);
          else globalMrNos.set(no, d.dealerId);
        }
        const total = roundMoney(
          inv.mrs.reduce((s, mr) => {
            const comm = calcCommission(mr.taka, mr.commission);
            return (
              s + (mr.deductCommission ? mr.taka : roundMoney(mr.taka + comm))
            );
          }, 0),
        );
        if (total > roundMoney(inv.balanceAmount) + 0.005)
          errors.push(`Invoice ${inv.invoiceNo}: reduction exceeds due`);
        for (const mr of inv.mrs) {
          if (
            mr.deductCommission &&
            calcCommission(mr.taka, mr.commission) > roundMoney(mr.taka) + 0.005
          )
            errors.push(
              `MR ${cleanText(mr.mrNo)}: commission > cash in deduct mode`,
            );
        }
      }
    }
    return errors;
  }, [dealers]);

  const totalCash = useMemo(() => {
    let sum = 0;
    dealers.forEach((d) =>
      d.invoices.forEach((inv) => inv.mrs.forEach((mr) => (sum += mr.taka))),
    );
    return roundMoney(sum);
  }, [dealers]);

  const validateBeforeSubmit = () => {
    if (!dealers.some((d) => d.dealerId)) return "Select at least one dealer.";
    if (!onlineCopy.onlineCopyNo) return "Online Copy No required.";
    if (!onlineCopy.bankAccountId) return "Select bank account.";
    if (!onlineCopy.mediaId) return "Upload online copy file.";
    if (validationErrors.length) return validationErrors[0];
    return null;
  };

  const handleSave = async () => {
    const err = validateBeforeSubmit();
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
          onlineCopyTaka: totalCash,
          bankDepositCharge: onlineCopy.bankDepositCharge,
          bankAccountId: onlineCopy.bankAccountId,
          mediaId: onlineCopy.mediaId,
        },
      };
      await api.put(`/collection/${id}`, payload);
      toast.success("Collection updated!");
      setEditMode(false);
      fetchCollection();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === "HOLD" || newStatus === "DISPUTED") {
      setPendingStatus(newStatus);
      setStatusRemarks("");
    } else {
      executeStatusChange(newStatus, null);
    }
  };

  const executeStatusChange = async (
    newStatus: string,
    remarks: string | null,
  ) => {
    const endpoint = statusEndpoint[newStatus];
    if (!endpoint) return;
    setActionLoading(true);
    try {
      await api.post(`/collection/${id}/status/${endpoint}`, { remarks });
      toast.success(
        `Status changed to ${statusConfig[newStatus]?.label || newStatus}`,
      );
      setPendingStatus(null);
      fetchCollection();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Status change failed");
    } finally {
      setActionLoading(false);
    }
  };

  const toggleDealer = (did: string) => {
    const next = new Set(expandedDealers);
    if (next.has(did)) next.delete(did);
    else next.add(did);
    setExpandedDealers(next);
  };

  const toggleInvoicec = (iid: string) => {
    const next = new Set(expandedInvoices);
    if (next.has(iid)) next.delete(iid);
    else next.add(iid);
    setExpandedInvoices(next);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading collection...
        </div>
      </div>
    );
  }
  if (!collection) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Card className="w-full max-w-lg">
          <CardContent className="p-8 text-center">
            <div className="text-lg font-semibold">Collection not found</div>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => router.push("/accounts/collections")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to list
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const summary = collection.summary;
  const stat = statusConfig[collection.status] || {
    label: collection.status,
    cls: "bg-slate-100 text-slate-700 border-slate-200",
    icon: Clock,
  };
  const StatIcon = stat.icon;
  const canEdit = ["SUBMITTED", "UNDER_REVIEW", "HOLD", "DISPUTED"].includes(
    collection.status,
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl p-3 md:p-4">
        {/* Hero */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => router.push("/accounts/collections")}
              className="h-8 w-8"
              title="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#3aa838]/10">
              <Banknote className="h-4 w-4 text-[#3aa838]" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-mono text-base font-semibold leading-tight">
                {collection.voucherNo}
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                <span>
                  Created {formatDateTime(collection.createdAt)}
                </span>
                <span className="text-slate-300">·</span>
                <span>
                  Cash{" "}
                  <b className="text-slate-900 tabular-nums">
                    ৳ {moneyFmt(summary.totalMRAmount)}
                  </b>
                </span>
                <span>
                  Net{" "}
                  <b className="text-[#2f8a2f] tabular-nums">
                    ৳ {moneyFmt(summary.totalNetDeposited)}
                  </b>
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className={`inline-flex items-center gap-1 border text-[10px] font-semibold ${stat.cls}`}
            >
              <StatIcon className="h-2.5 w-2.5" />
              {stat.label}
            </Badge>
            {canEdit && (
              <Button
                onClick={() => setEditMode(!editMode)}
                variant={editMode ? "default" : "outline"}
                size="sm"
                className={`h-8 ${editMode ? "bg-[#3aa838] text-white hover:bg-[#2f8a2f]" : ""}`}
              >
                {editMode ? (
                  <Eye className="mr-1.5 h-3.5 w-3.5" />
                ) : (
                  <Edit className="mr-1.5 h-3.5 w-3.5" />
                )}
                {editMode ? "View" : "Edit"}
              </Button>
            )}
            {editMode && (
              <>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  size="sm"
                  className="h-8 bg-[#3aa838] text-white hover:bg-[#2f8a2f]"
                >
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                  Save
                </Button>
                <Button
                  onClick={() => setEditMode(false)}
                  variant="ghost"
                  size="sm"
                  className="h-8"
                >
                  <X className="mr-1.5 h-3.5 w-3.5" />
                  Cancel
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Summary stats */}
        <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          {[
            {
              label: "Cash collected",
              value: moneyFmt(summary.totalMRAmount),
              icon: Wallet,
              tone: "green" as const,
            },
            {
              label: "Commission",
              value: moneyFmt(summary.totalCommission),
              icon: TrendingUp,
              tone: "amber" as const,
            },
            {
              label: "Bank charge",
              value: moneyFmt(summary.bankDepositCharge),
              icon: Receipt,
              tone: "slate" as const,
            },
            {
              label: "Net deposit",
              value: moneyFmt(summary.totalNetDeposited),
              icon: Banknote,
              tone: "green" as const,
            },
          ].map((s) => {
            const toneMap = {
              green: {
                chip: "bg-[#3aa838]/10 text-[#3aa838]",
                num: "text-[#2f8a2f]",
              },
              amber: {
                chip: "bg-amber-50 text-amber-600",
                num: "text-amber-700",
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
                        ৳ {s.value}
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

        {/* Workflow actions */}
        {!editMode &&
          collection.status !== "APPROVED" &&
          collection.status !== "CANCELLED" && (
            <Card className="mb-3 overflow-hidden border-slate-200 shadow-sm">
              <SectionHeader
                icon={CheckCircle2}
                title="Workflow actions"
                right={
                  pendingStatus ? (
                    <div className="flex items-center gap-1.5">
                      <Input
                        value={statusRemarks}
                        onChange={(e) => setStatusRemarks(e.target.value)}
                        placeholder={`Remarks for ${statusConfig[pendingStatus]?.label}`}
                        className="h-7 w-[200px] text-xs"
                      />
                      <Button
                        size="sm"
                        onClick={() =>
                          statusRemarks.trim()
                            ? executeStatusChange(
                                pendingStatus,
                                statusRemarks.trim(),
                              )
                            : toast.error("Remarks required")
                        }
                        className="h-7 bg-[#3aa838] text-white hover:bg-[#2f8a2f]"
                      >
                        Submit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPendingStatus(null)}
                        className="h-7"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : null
                }
              />
              <CardContent className="flex flex-wrap gap-2 p-3">
                {allowedTransitions[collection.status]?.map((ns) => (
                  <Button
                    key={ns}
                    variant={ns === "APPROVED" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleStatusChange(ns)}
                    disabled={actionLoading}
                    className={`h-7 text-xs ${
                      ns === "APPROVED"
                        ? "bg-[#3aa838] text-white hover:bg-[#2f8a2f]"
                        : ns === "HOLD" || ns === "DISPUTED" || ns === "CANCELLED"
                          ? "text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                          : ""
                    }`}
                  >
                    {statusConfig[ns]?.label || ns}
                  </Button>
                ))}
              </CardContent>
            </Card>
          )}

        {/* Main content */}
        {!editMode ? (
          <>
            {/* Online copy */}
            <Card className="mb-3 overflow-hidden border-slate-200 shadow-sm">
              <SectionHeader
                icon={Banknote}
                title="Online copy"
                right={
                  collection.onlineCopy.mediaId && (
                    <a
                      href={`${process.env.NEXT_PUBLIC_MEDIA_URL || ""}${collection.onlineCopy.mediaId.url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#2f8a2f] hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" /> View file
                    </a>
                  )
                }
              />
              <CardContent className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Online copy no
                  </div>
                  <div className="mt-0.5 font-mono text-sm font-semibold text-slate-900">
                    {collection.onlineCopy.onlineCopyNo}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Date
                  </div>
                  <div className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">
                    {formatDate(collection.onlineCopy.onlineCopyDate)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Bank account
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-900">
                    {collection.onlineCopy.bankAccountId?.accountId?.name
                      ? `${collection.onlineCopy.bankAccountId.accountId.name}`
                      : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Bank charge
                  </div>
                  <div className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">
                    ৳ {moneyFmt(collection.onlineCopy.bankDepositCharge)}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Dealers */}
            <div className="space-y-3">
              {collection.dealers.map((dealer: any, dIdx: number) => {
                const did = dealer.dealerId._id;
                const isExpanded = expandedDealers.has(did);
                return (
                  <Card
                    key={did}
                    className="overflow-hidden border-slate-200 shadow-sm"
                  >
                    <div
                      className="flex cursor-pointer items-center justify-between border-b border-slate-200 bg-slate-50/60 px-3 py-2.5"
                      onClick={() => toggleDealer(did)}
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                          {dIdx + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900">
                            {dealer.dealerName}
                          </div>
                          {dealer.dealerId.code && (
                            <div className="text-[10px] text-muted-foreground">
                              Code: {dealer.dealerId.code}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-[10px] uppercase text-muted-foreground">
                            Invoices
                          </div>
                          <div className="text-sm font-semibold tabular-nums text-slate-900">
                            {dealer.invoices.length}
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-slate-500" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-slate-500" />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="space-y-2 bg-slate-50/50 p-3">
                        {dealer.invoices.map((inv: any) => {
                          const iid = inv.invoiceId._id;
                          const isInvExpanded = expandedInvoices.has(iid);
                          return (
                            <div
                              key={iid}
                              className="overflow-hidden rounded-lg border border-slate-200 bg-white"
                            >
                              <div
                                className="flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-slate-50"
                                onClick={() => toggleInvoicec(iid)}
                              >
                                <div className="flex items-center gap-2">
                                  <FileText className="h-3.5 w-3.5 text-slate-400" />
                                  <div>
                                    <div className="font-mono text-xs font-semibold text-slate-900">
                                      {inv.invoiceNo}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground">
                                      Grand:{" "}
                                      {moneyFmt(inv.invoiceId.grandTotal)} ·
                                      Balance:{" "}
                                      {moneyFmt(inv.invoiceId.balanceAmount)}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="text-right">
                                    <div className="text-[10px] uppercase text-muted-foreground">
                                      Receipts
                                    </div>
                                    <div className="text-xs font-semibold tabular-nums text-slate-900">
                                      {inv.moneyReceipts.length}
                                    </div>
                                  </div>
                                  {isInvExpanded ? (
                                    <ChevronUp className="h-3.5 w-3.5 text-slate-500" />
                                  ) : (
                                    <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                                  )}
                                </div>
                              </div>

                              {isInvExpanded && (
                                <div className="border-t border-slate-200">
                                  <table className="w-full text-xs">
                                    <thead className="bg-slate-50">
                                      <tr>
                                        {[
                                          "MR No",
                                          "Date",
                                          "Cash",
                                          "Mode",
                                          "Commission",
                                          "Reduction",
                                          "Doc",
                                        ].map((h) => (
                                          <th
                                            key={h}
                                            className={`px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-600 ${
                                              [
                                                "Cash",
                                                "Commission",
                                                "Reduction",
                                              ].includes(h)
                                                ? "text-right"
                                                : h === "Doc" || h === "Mode"
                                                  ? "text-center"
                                                  : "text-left"
                                            }`}
                                          >
                                            {h}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {inv.moneyReceipts.map(
                                        (mr: any, mIdx: number) => {
                                          const comm =
                                            mr.commission?.amount || 0;
                                          const deduct = mr.deductCommission;
                                          const reduction = deduct
                                            ? mr.taka
                                            : mr.taka + comm;
                                          return (
                                            <tr
                                              key={`${mr.mrNo}-${mIdx}`}
                                              className="border-b border-slate-100 last:border-0"
                                            >
                                              <td className="px-2 py-1.5 font-medium text-slate-900">
                                                {mr.mrNo}
                                              </td>
                                              <td className="px-2 py-1.5 text-slate-600 tabular-nums">
                                                {formatDate(mr.mrDate)}
                                              </td>
                                              <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-slate-900">
                                                {moneyFmt(mr.taka)}
                                              </td>
                                              <td className="px-2 py-1.5 text-center">
                                                {deduct ? (
                                                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                                                    Deduct
                                                  </span>
                                                ) : (
                                                  <span className="rounded bg-[#3aa838]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#2f8a2f]">
                                                    Add
                                                  </span>
                                                )}
                                              </td>
                                              <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-amber-700">
                                                {moneyFmt(comm)}
                                              </td>
                                              <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-slate-900">
                                                {moneyFmt(reduction)}
                                              </td>
                                              <td className="px-2 py-1.5 text-center">
                                                {mr.mediaId ? (
                                                  <a
                                                    href={`${process.env.NEXT_PUBLIC_MEDIA_URL || ""}${mr.mediaId.url}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-[10px] font-medium text-[#2f8a2f] underline"
                                                  >
                                                    View
                                                  </a>
                                                ) : (
                                                  "—"
                                                )}
                                              </td>
                                            </tr>
                                          );
                                        },
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>

            {/* Timeline */}
            <Card className="mt-3 overflow-hidden border-slate-200 shadow-sm">
              <SectionHeader icon={Clock} title="Workflow timeline" />
              <CardContent className="space-y-3 p-3">
                {collection.workflowLogs.map((log: any, idx: number) => {
                  const ls = statusConfig[log.action] || {
                    label: log.action,
                    cls: "bg-slate-100 text-slate-700 border-slate-200",
                    icon: Clock,
                  };
                  const LogIcon = ls.icon;
                  const isLast = idx === collection.workflowLogs.length - 1;
                  return (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div
                          className={`flex h-7 w-7 items-center justify-center rounded-full ${
                            isLast
                              ? "bg-[#3aa838]/10 text-[#2f8a2f] ring-2 ring-[#3aa838]/20"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          <LogIcon className="h-3.5 w-3.5" />
                        </div>
                        {!isLast && (
                          <div className="mt-1 w-0.5 flex-1 bg-slate-200" />
                        )}
                      </div>
                      <div className="flex-1 pb-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            className={`border text-[10px] font-semibold ${ls.cls}`}
                          >
                            {ls.label}
                          </Badge>
                          <span className="text-xs font-medium text-slate-700">
                            {log.by?.name}
                          </span>
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            {formatDateTime(log.at)}
                          </span>
                        </div>
                        {log.remarks && (
                          <p className="mt-1 text-xs text-slate-600">
                            {log.remarks}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </>
        ) : (
          /* Edit mode — full editor */
          <div className="space-y-3">
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <SectionHeader icon={Banknote} title="Online copy" />
              <CardContent className="grid grid-cols-1 gap-3 p-3 md:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-600">
                    Online copy no
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
                <div className="md:col-span-2">
                  <FileUpload
                    label="Online copy file"
                    fileName={onlineCopy.mediaName}
                    fileUrl={onlineCopy.mediaUrl}
                    onUpload={uploadOnlineCopyFile}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Dealers editor */}
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <SectionHeader
                icon={Users}
                title="Dealers & invoices"
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
                {dealers.map((dealer, idx) => (
                  <div
                    key={dealer.id}
                    className="rounded-xl border border-slate-200 bg-white"
                  >
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

                    <div className="space-y-3 p-3">
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
                                onClick={() => selectDealer(dealer.id, opt)}
                                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-slate-50"
                              >
                                <span className="truncate font-medium">
                                  {resolveLabel(opt)}
                                </span>
                                <Badge variant="outline" className="text-[10px]">
                                  Select
                                </Badge>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {dealer.dealerId && (
                        <div className="grid gap-3 lg:grid-cols-2">
                          <div>
                            <div className="mb-2 text-xs font-semibold text-slate-700">
                              Available invoices
                            </div>
                            <div className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
                              {dealer.invoiceOptions
                                .filter(isInvoiceSelectable)
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
                                      <div className="mt-1 flex gap-2 text-[10px] text-muted-foreground">
                                        <span>
                                          Due:{" "}
                                          <b className="text-slate-900 tabular-nums">
                                            ৳ {moneyFmt(inv.balanceAmount)}
                                          </b>
                                        </span>
                                      </div>
                                    </button>
                                  );
                                })}
                            </div>
                          </div>

                          <div>
                            <div className="mb-2 text-xs font-semibold text-slate-700">
                              Attached ({dealer.invoices.length})
                            </div>
                            {dealer.invoices.length === 0 ? (
                              <div className="rounded-lg border-2 border-dashed border-slate-200 p-6 text-center text-xs text-muted-foreground">
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
                                        <div className="min-w-0">
                                          <div className="font-mono text-xs font-semibold text-slate-900">
                                            {inv.invoiceNo}
                                          </div>
                                          <div className="text-[10px] text-muted-foreground">
                                            Due ৳{" "}
                                            {moneyFmt(inv.balanceAmount)} ·
                                            Reduction ৳{" "}
                                            {moneyFmt(totalReduction)}
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
                                              removeInvoice(dealer.id, inv.id)
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
                                          const reduction = mr.deductCommission
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
                                                  disabled={inv.mrs.length === 1}
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
                                                          mrNo: e.target.value,
                                                        },
                                                      )
                                                    }
                                                    className={`h-8 text-xs focus-visible:ring-[#3aa838] ${
                                                      dup
                                                        ? "border-rose-400 bg-rose-50"
                                                        : ""
                                                    }`}
                                                  />
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
                                                            e.target.value || 0,
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
                                                              .mode === "FIXED"
                                                              ? "default"
                                                              : "outline"
                                                          }
                                                          className={`h-7 text-[10px] ${
                                                            mr.commission
                                                              .mode === "FIXED"
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
                                                            .mode === "PERCENT"
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
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}