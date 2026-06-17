"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import api from "@/lib/api";
import { toast, Toaster } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
  MessageSquare,
} from "lucide-react";

/* ────────────── Types ────────────── */
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

/* ────────────── Helpers ────────────── */
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
  {
    label: string;
    variant: "outline" | "default" | "secondary" | "destructive";
    icon: any;
  }
> = {
  SUBMITTED: { label: "Submitted", variant: "secondary", icon: Clock },
  UNDER_REVIEW: { label: "Under Review", variant: "default", icon: HelpCircle },
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
  SUBMITTED: ["UNDER_REVIEW", "HOLD", "DISPUTED", "CANCELLED"],
  UNDER_REVIEW: ["APPROVED", "HOLD", "DISPUTED", "CANCELLED", "SUBMITTED"],
  HOLD: ["UNDER_REVIEW", "DISPUTED", "CANCELLED"],
  DISPUTED: ["UNDER_REVIEW", "HOLD", "CANCELLED"],
  APPROVED: [],
  CANCELLED: [],
};

/* ────────────── Reusable components ────────────── */
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
export default function CollectionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [collection, setCollection] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Edit state
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

  // Expand states for view
  const [expandedDealers, setExpandedDealers] = useState<Set<string>>(
    new Set(),
  );
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(
    new Set(),
  );

  // Status change remarks
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [statusRemarks, setStatusRemarks] = useState("");

  // ── Fetch Collection ─────────────────────
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
  }, [id]);

  // ── Initialize edit form ─────────────────
  useEffect(() => {
    if (!collection || !editMode) return;

    const initialDealers: DealerRow[] = collection.dealers.map((d: any) => ({
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
          deductCommission: Boolean(mr.deductCommission), // FIXED: always boolean
          mediaId: mr.mediaId?._id || "",
          mediaName: mr.mediaId?.originalName || "",
          mediaUrl: mr.mediaId?.url || "",
        })),
      })),
    }));

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

  // ── Edit mutations ────────────────────────
  const patchDealer = (id: string, u: (d: DealerRow) => DealerRow) =>
    setDealers((prev) => prev.map((d) => (d.id === id ? u(d) : d)));
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
  const removeDealer = (id: string) =>
    setDealers((prev) => prev.filter((d) => d.id !== id));
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
      mediaName: data?.originalName || file.name,
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

  // Validation
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
              `MR ${cleanText(mr.mrNo)}: commission cannot exceed cash in deduct mode`,
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

  const validateBeforeSubmit = () => {
    if (!dealers.some((d) => d.dealerId)) return "Select at least one dealer.";
    if (!onlineCopy.onlineCopyNo) return "Online Copy No required.";
    if (!onlineCopy.bankAccountId) return "Select bank account.";
    if (!onlineCopy.mediaId) return "Upload online copy file.";
    if (validationErrors.length) return validationErrors[0];
    return null;
  };

  // ── Status change with mandatory remarks ─
  const handleStatusChange = (newStatus: string) => {
    if (newStatus === "HOLD" || newStatus === "DISPUTED") {
      // Show remarks input
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

  const cancelRemarks = () => {
    setPendingStatus(null);
    setStatusRemarks("");
  };

  const submitRemarks = () => {
    if (!statusRemarks.trim()) {
      toast.error("Please enter remarks");
      return;
    }
    executeStatusChange(pendingStatus!, statusRemarks.trim());
  };

  // ── View helpers ─────────────────────────
  const toggleDealer = (did: string) => {
    const next = new Set(expandedDealers);
    next.has(did) ? next.delete(did) : next.add(did);
    setExpandedDealers(next);
  };

  const toggleInvoicec = (iid: string) => {
    const next = new Set(expandedInvoices);
    next.has(iid) ? next.delete(iid) : next.add(iid);
    setExpandedInvoices(next);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={48} />
      </div>
    );
  }
  if (!collection) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500 text-lg">Collection not found.</p>
      </div>
    );
  }

  const summary = collection.summary;
  const stat = statusConfig[collection.status] || {
    label: collection.status,
    variant: "outline",
    icon: Clock,
  };
  const canEdit = ["SUBMITTED", "UNDER_REVIEW", "HOLD", "DISPUTED"].includes(
    collection.status,
  );

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
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/accounts/collections")}
              className="rounded-full hover:bg-indigo-50"
            >
              <ArrowLeft size={24} className="text-slate-600" />
            </Button>
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-indigo-500/10 to-blue-500/10 border border-indigo-200 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-3">
                <Banknote size={14} /> Collection Detail
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
                {collection.voucherNo}
                <br />
                COL-26-06-D-0001
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                Created {formatDateTime(collection.createdAt)} · Updated{" "}
                {formatDateTime(collection.updatedAt)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {canEdit && (
              <Button
                onClick={() => setEditMode(!editMode)}
                variant={editMode ? "default" : "outline"}
                className="rounded-xl gap-2 font-semibold"
              >
                {editMode ? <Eye size={16} /> : <Edit size={16} />}
                {editMode ? "View Mode" : "Edit Collection"}
              </Button>
            )}
            {editMode && (
              <>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-xl gap-2 font-semibold bg-emerald-600 hover:bg-emerald-700"
                >
                  <Save size={16} /> Save
                </Button>
                <Button
                  onClick={() => setEditMode(false)}
                  variant="ghost"
                  className="rounded-xl gap-2"
                >
                  <X size={16} /> Cancel
                </Button>
              </>
            )}
            <Badge
              variant={stat.variant}
              className="flex items-center gap-1 px-4 py-2 text-sm"
            >
              <stat.icon size={16} />
              {stat.label}
            </Badge>
            {!editMode &&
              collection.status !== "APPROVED" &&
              collection.status !== "CANCELLED" && (
                <div className="flex gap-2">
                  {allowedTransitions[collection.status]?.map((ns) => (
                    <Button
                      key={ns}
                      variant={ns === "APPROVED" ? "default" : "outline"}
                      onClick={() => handleStatusChange(ns)}
                      disabled={actionLoading}
                      className="rounded-xl font-semibold"
                    >
                      {statusConfig[ns]?.label || ns}
                    </Button>
                  ))}
                </div>
              )}
            {collection.status === "APPROVED" && (
              <Badge
                variant="outline"
                className="text-emerald-600 border-emerald-300 px-4 py-2"
              >
                ✓ Approved
              </Badge>
            )}
          </div>
          {/* Remarks input (shown only when pending) */}
          {pendingStatus && (
            <div className="flex items-center gap-2 mt-2 md:mt-0">
              <Input
                value={statusRemarks}
                onChange={(e) => setStatusRemarks(e.target.value)}
                placeholder={`Remarks for ${statusConfig[pendingStatus]?.label}`}
                className="rounded-xl min-w-[200px]"
              />
              <Button onClick={submitRemarks} size="sm" className="rounded-xl">
                Submit
              </Button>
              <Button
                onClick={cancelRemarks}
                size="sm"
                variant="ghost"
                className="rounded-xl"
              >
                Cancel
              </Button>
            </div>
          )}
        </motion.div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Cash Collected"
            value={moneyFmt(summary.totalMRAmount)}
            icon={Wallet}
          />
          <StatCard
            label="Commission"
            value={moneyFmt(summary.totalCommission)}
            icon={TrendingUp}
          />
          <StatCard
            label="Bank Charge"
            value={moneyFmt(summary.bankDepositCharge)}
            icon={Receipt}
          />
          <StatCard
            label="Net Deposit"
            value={moneyFmt(summary.totalNetDeposited)}
            accent
            icon={Banknote}
          />
        </div>

        {!editMode ? (
          /* ── VIEW MODE ── */
          <>
            <Card className="mb-8 border-0 shadow-2xl rounded-3xl overflow-hidden bg-white/90 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 px-6 py-4 flex flex-row items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Upload size={20} /> Online Copy
                </h2>
                {collection.onlineCopy.mediaId && (
                  <a
                    href={`${process.env.NEXT_PUBLIC_MEDIA_URL || ""}${collection.onlineCopy.mediaId.url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-semibold text-indigo-600 hover:underline flex items-center gap-1"
                  >
                    <ExternalLink size={14} /> View File
                  </a>
                )}
              </CardHeader>
              <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <p className="text-sm text-slate-500">Online Copy No</p>
                  <p className="font-semibold text-slate-900">
                    {collection.onlineCopy.onlineCopyNo}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Date</p>
                  <p className="font-semibold text-slate-900">
                    {formatDate(collection.onlineCopy.onlineCopyDate)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Bank Account</p>
                  <p className="font-semibold text-slate-900">
                    {collection.onlineCopy.bankAccountId?.accountId?.name
                      ? `${collection.onlineCopy.bankAccountId.accountId.name} (${collection.onlineCopy.bankAccountId.accountId.code})`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Bank Charge</p>
                  <p className="font-semibold text-slate-900">
                    {moneyFmt(collection.onlineCopy.bankDepositCharge)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              {collection.dealers.map((dealer: any, dIdx: number) => {
                const did = dealer.dealerId._id;
                const isExpanded = expandedDealers.has(did);
                return (
                  <motion.div
                    key={did}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-3xl border bg-white/80 backdrop-blur-sm shadow-xl overflow-hidden"
                  >
                    <div
                      className="p-6 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 cursor-pointer flex items-center justify-between"
                      onClick={() => toggleDealer(did)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-base font-bold">
                          {dIdx + 1}
                        </span>
                        <div>
                          <h3 className="text-xl font-bold text-slate-900">
                            {dealer.dealerName}
                          </h3>
                          {dealer.dealerId.code && (
                            <p className="text-sm text-slate-500">
                              Code: {dealer.dealerId.code}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-xs text-slate-500 uppercase tracking-wider">
                            Invoices
                          </p>
                          <p className="font-bold text-slate-800">
                            {dealer.invoices.length}
                          </p>
                        </div>
                        {isExpanded ? (
                          <ChevronUp size={20} className="text-slate-400" />
                        ) : (
                          <ChevronDown size={20} className="text-slate-400" />
                        )}
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="p-6 space-y-6 bg-slate-50/50 border-t">
                        {dealer.invoices.map((inv: any) => {
                          const iid = inv.invoiceId._id;
                          const isInvExpanded = expandedInvoices.has(iid);
                          return (
                            <div
                              key={iid}
                              className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
                            >
                              <div
                                className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50"
                                onClick={() => toggleInvoicec(iid)}
                              >
                                <div className="flex items-center gap-3">
                                  <FileText
                                    size={20}
                                    className="text-slate-400"
                                  />
                                  <div>
                                    <p className="font-bold text-slate-900">
                                      {inv.invoiceNo}
                                    </p>
                                    <p className="text-sm text-slate-500">
                                      Grand Total:{" "}
                                      {moneyFmt(inv.invoiceId.grandTotal)} ·
                                      Balance:{" "}
                                      {moneyFmt(inv.invoiceId.balanceAmount)}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <div className="text-right">
                                    <p className="text-xs text-slate-500 uppercase tracking-wider">
                                      Receipts
                                    </p>
                                    <p className="font-bold text-slate-800">
                                      {inv.moneyReceipts.length}
                                    </p>
                                  </div>
                                  {isInvExpanded ? (
                                    <ChevronUp
                                      size={20}
                                      className="text-slate-400"
                                    />
                                  ) : (
                                    <ChevronDown
                                      size={20}
                                      className="text-slate-400"
                                    />
                                  )}
                                </div>
                              </div>
                              {isInvExpanded && (
                                <div className="p-5 border-t">
                                  <table className="w-full text-sm">
                                    <thead className="bg-slate-50">
                                      <tr>
                                        <th className="text-left p-3 font-semibold text-slate-700">
                                          MR No
                                        </th>
                                        <th className="text-left p-3 font-semibold text-slate-700">
                                          Date
                                        </th>
                                        <th className="text-right p-3 font-semibold text-slate-700">
                                          Cash
                                        </th>
                                        <th className="text-center p-3 font-semibold text-slate-700">
                                          Mode
                                        </th>
                                        <th className="text-right p-3 font-semibold text-slate-700">
                                          Commission
                                        </th>
                                        <th className="text-right p-3 font-semibold text-slate-700">
                                          Reduction
                                        </th>
                                        <th className="text-center p-3 font-semibold text-slate-700">
                                          Document
                                        </th>
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
                                              className="border-b border-slate-100 hover:bg-indigo-50/20"
                                            >
                                              <td className="p-3 font-medium text-slate-900">
                                                {mr.mrNo}
                                              </td>
                                              <td className="p-3 text-slate-600">
                                                {formatDate(mr.mrDate)}
                                              </td>
                                              <td className="p-3 text-right font-semibold text-slate-800">
                                                {moneyFmt(mr.taka)}
                                              </td>
                                              <td className="p-3 text-center">
                                                {deduct ? (
                                                  <Badge variant="secondary">
                                                    Deduct
                                                  </Badge>
                                                ) : (
                                                  <Badge variant="outline">
                                                    Add
                                                  </Badge>
                                                )}
                                              </td>
                                              <td className="p-3 text-right font-semibold text-amber-600">
                                                {moneyFmt(comm)}
                                              </td>
                                              <td className="p-3 text-right font-semibold text-slate-800">
                                                {moneyFmt(reduction)}
                                              </td>
                                              <td className="p-3 text-center">
                                                {mr.mediaId ? (
                                                  <a
                                                    href={`${process.env.NEXT_PUBLIC_MEDIA_URL || ""}${mr.mediaId.url}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-indigo-600 underline text-xs"
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
                  </motion.div>
                );
              })}
            </div>

            {/* Workflow Timeline */}
            <Card className="mt-8 border-0 shadow-2xl rounded-3xl overflow-hidden bg-white/90 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 px-6 py-4">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Clock size={20} /> Workflow Timeline
                </h2>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-6">
                  {collection.workflowLogs.map((log: any, idx: number) => {
                    const ls = statusConfig[log.action] || {
                      label: log.action,
                      variant: "outline",
                      icon: Clock,
                    };
                    const isLast = idx === collection.workflowLogs.length - 1;
                    return (
                      <div key={idx} className="flex items-start gap-4">
                        <div className="flex flex-col items-center">
                          <div
                            className={`p-2 rounded-full ${isLast ? "bg-indigo-100 text-indigo-600 ring-2 ring-indigo-200" : "bg-slate-100 text-slate-500"}`}
                          >
                            <ls.icon size={16} />
                          </div>
                          {!isLast && (
                            <div className="w-0.5 flex-1 bg-slate-200 mt-1" />
                          )}
                        </div>
                        <div className="flex-1 pb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={ls.variant} className="text-xs">
                              {ls.label}
                            </Badge>
                            <span className="text-sm text-slate-700">
                              [ {log.by.name} ]
                            </span>
                            <span className="text-sm text-slate-500">
                              {formatDateTime(log.at)}
                            </span>
                          </div>
                          {log.remarks && (
                            <p className="mt-1 text-sm text-slate-600">
                              {log.remarks}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          /* ── EDIT MODE ── */
          <div className="space-y-6">
            <Card className="border-0 shadow-2xl rounded-3xl overflow-hidden bg-white/90 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-indigo-500 to-blue-600 text-white px-6 py-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Edit size={20} /> Edit Collection
                </h2>
                <p className="text-indigo-100 text-sm">
                  Modify dealers, invoices, receipts, and online copy.
                </p>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Online Copy section */}
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-4">
                    Online Copy
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-sm font-medium">
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
                        className="rounded-xl"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Date</Label>
                      <Input
                        type="date"
                        value={onlineCopy.onlineCopyDate}
                        onChange={(e) =>
                          setOnlineCopy((p) => ({
                            ...p,
                            onlineCopyDate: e.target.value,
                          }))
                        }
                        className="rounded-xl"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">
                        Bank Account
                      </Label>
                      <select
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"
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
                      <Label className="text-sm font-medium">Bank Charge</Label>
                      <Input
                        type="number"
                        value={onlineCopy.bankDepositCharge || ""}
                        onChange={(e) =>
                          setOnlineCopy((p) => ({
                            ...p,
                            bankDepositCharge: Number(e.target.value || 0),
                          }))
                        }
                        className="rounded-xl"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <FileUpload
                        label="Online Copy File"
                        fileName={onlineCopy.mediaName}
                        fileUrl={onlineCopy.mediaUrl}
                        onUpload={uploadOnlineCopyFile}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Dealers */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-slate-800">
                      Dealers & Invoices
                    </h3>
                    <Button
                      onClick={addDealer}
                      variant="outline"
                      className="rounded-full gap-2"
                    >
                      <Plus size={16} /> Add Dealer
                    </Button>
                  </div>
                  {dealers.map((dealer, dIdx) => (
                    <div
                      key={dealer.id}
                      className="rounded-3xl border bg-white shadow-lg mb-6 overflow-hidden"
                    >
                      <div className="p-5 flex flex-col sm:flex-row gap-4 bg-gradient-to-r from-indigo-50 to-blue-50">
                        <div className="flex-1 relative">
                          <div className="flex items-center gap-3 mb-3">
                            <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-base font-bold">
                              {dIdx + 1}
                            </span>
                            {dealer.dealerName ? (
                              <span className="font-bold text-xl text-slate-800">
                                {dealer.dealerName}
                              </span>
                            ) : (
                              <span className="text-slate-400">
                                Search a dealer
                              </span>
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
                              className="pl-12 py-6 rounded-2xl border-slate-200 bg-white text-base shadow-sm"
                            />
                          </div>
                          {dealer.options.length > 0 && (
                            <div className="absolute z-30 mt-2 w-full rounded-2xl border bg-white shadow-2xl max-h-56 overflow-auto">
                              {dealer.options.map((opt: any) => (
                                <button
                                  key={resolveId(opt)}
                                  onClick={() => selectDealer(dealer.id, opt)}
                                  className="w-full text-left px-5 py-3 hover:bg-indigo-50 flex justify-between items-center"
                                >
                                  <span className="font-medium">
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

                      {dealer.dealerId && (
                        <div className="p-6 grid lg:grid-cols-2 gap-8 border-t">
                          {/* Invoice Picker */}
                          <div>
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="font-bold text-slate-800">
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
                                      className="cursor-pointer"
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
                            <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1">
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
                                      className={`w-full text-left p-4 rounded-2xl border transition ${selected ? "bg-indigo-50 border-indigo-300" : "bg-white border-slate-200 hover:border-slate-300"}`}
                                    >
                                      <div className="flex justify-between">
                                        <span className="font-bold text-slate-900">
                                          {inv.invoiceNo}
                                        </span>
                                        <Badge
                                          variant={
                                            selected ? "default" : "outline"
                                          }
                                        >
                                          {selected ? "Selected" : "Add"}
                                        </Badge>
                                      </div>
                                      <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                                        <div>
                                          <span className="text-slate-500">
                                            Due
                                          </span>
                                          <br />
                                          {moneyFmt(inv.balanceAmount)}
                                        </div>
                                        <div>
                                          <span className="text-slate-500">
                                            Total
                                          </span>
                                          <br />
                                          {moneyFmt(inv.grandTotal)}
                                        </div>
                                        <div>
                                          <span className="text-slate-500">
                                            Items
                                          </span>
                                          <br />
                                          {inv.itemsCount}
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })}
                            </div>
                          </div>

                          {/* Selected Invoices & MR Editor */}
                          <div>
                            <h3 className="font-bold text-slate-800 mb-4">
                              Attached Invoices ({dealer.invoices.length})
                            </h3>
                            {dealer.invoices.length === 0 ? (
                              <div className="text-center py-12 text-slate-400">
                                Select an invoice to begin
                              </div>
                            ) : (
                              <div className="space-y-5">
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
                                    <Card
                                      key={inv.id}
                                      className={`border ${overDue ? "border-red-300" : "border-slate-200"} overflow-hidden rounded-2xl`}
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
                                            <div
                                              className={`h-full rounded-full ${overDue ? "bg-red-500" : "bg-indigo-500"}`}
                                              style={{
                                                width: `${usagePercent}%`,
                                              }}
                                            />
                                          </div>
                                          <p className="text-xs text-slate-500 mt-1">
                                            Reduction:{" "}
                                            {moneyFmt(totalReduction)} /{" "}
                                            {moneyFmt(inv.balanceAmount)}
                                          </p>
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
                                        {inv.mrs.map((mr, mIdx) => {
                                          const commission = calcCommission(
                                            mr.taka,
                                            mr.commission,
                                          );
                                          const reduction = mr.deductCommission
                                            ? mr.taka
                                            : roundMoney(mr.taka + commission);
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
                                              className="rounded-2xl border border-slate-200 bg-white p-4"
                                            >
                                              <div className="flex justify-between items-center mb-3">
                                                <div className="flex items-center gap-2">
                                                  <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                                                    {mIdx + 1}
                                                  </span>
                                                  <span className="font-semibold">
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
                                                  disabled={
                                                    inv.mrs.length === 1
                                                  }
                                                >
                                                  <Trash2
                                                    size={14}
                                                    className="text-rose-500"
                                                  />
                                                </Button>
                                              </div>

                                              <div className="grid sm:grid-cols-2 gap-3">
                                                <div>
                                                  <Label className="text-xs">
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
                                                    className={`rounded-xl ${dup ? "border-red-500" : ""}`}
                                                  />
                                                  {dup && (
                                                    <p className="text-xs text-red-500">
                                                      Duplicate
                                                    </p>
                                                  )}
                                                </div>
                                                <div>
                                                  <Label className="text-xs">
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
                                                    className="rounded-xl"
                                                  />
                                                </div>
                                                <div>
                                                  <Label className="text-xs">
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
                                                    className={`rounded-xl ${exceedsDue ? "border-red-500" : ""}`}
                                                  />
                                                </div>
                                                <div>
                                                  <Label className="text-xs">
                                                    Reduction
                                                  </Label>
                                                  <div className="h-10 rounded-xl bg-slate-100 border flex items-center px-4 font-semibold">
                                                    {moneyFmt(reduction)}
                                                  </div>
                                                  {exceedsDue && (
                                                    <p className="text-xs text-red-500">
                                                      Exceeds due
                                                    </p>
                                                  )}
                                                </div>

                                                {/* Commission Mode */}
                                                <div className="sm:col-span-2">
                                                  <Label className="text-xs">
                                                    Commission Mode
                                                  </Label>
                                                  <div className="flex gap-2 mt-1">
                                                    <Button
                                                      size="sm"
                                                      variant={
                                                        !mr.deductCommission
                                                          ? "default"
                                                          : "outline"
                                                      }
                                                      className={`flex-1 rounded-xl ${!mr.deductCommission ? "bg-indigo-600 text-white" : ""}`}
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
                                                        size={14}
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
                                                      className={`flex-1 rounded-xl ${mr.deductCommission ? "bg-amber-600 text-white" : ""}`}
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
                                                        size={14}
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
                                                      <Label className="text-xs">
                                                        Commission
                                                      </Label>
                                                      <div className="flex gap-1 mt-1">
                                                        <Button
                                                          size="sm"
                                                          variant={
                                                            mr.commission
                                                              .mode === "FIXED"
                                                              ? "default"
                                                              : "outline"
                                                          }
                                                          className={`rounded-xl ${mr.commission.mode === "FIXED" ? "bg-slate-800 text-white" : "text-slate-600"}`}
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
                                                          className={`rounded-xl ${mr.commission.mode === "PERCENT" ? "bg-slate-800 text-white" : "text-slate-600"}`}
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
                                                                      value:
                                                                        val,
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
                                                    Commission:{" "}
                                                    {moneyFmt(commission)}
                                                    {mr.deductCommission &&
                                                      " (deducted)"}
                                                  </p>
                                                </div>

                                                <div className="sm:col-span-2">
                                                  <FileUpload
                                                    label="MR Document"
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
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 justify-end">
                  <Button
                    onClick={() => setEditMode(false)}
                    variant="outline"
                    className="rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Save size={16} className="mr-1" /> Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
