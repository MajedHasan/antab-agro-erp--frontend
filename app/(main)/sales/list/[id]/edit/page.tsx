"use client";

import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";
import QRCode from "qrcode";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import GlobalPrintButton from "@/components/common/print/GlobalPrintButton";
import {
  Check, ChevronsUpDown, Loader2, Plus, Trash2, RefreshCw, Upload, Ban,
  Save, ShieldCheck, Truck, Copy, AlertTriangle, CheckCircle2, FileText,
  Building2, Warehouse as WarehouseIcon, Calendar, CreditCard, Package,
  Wallet, TrendingUp, Receipt, Minus, Sparkles, ArrowLeft, Inbox,
} from "lucide-react";

import Protected from "@/components/auth/Protected";
import usePermissionCheck from "@/hooks/usePermissionCheck";

// 🆕 new imports
import QtyChangeHistoryCard from "../../_components/QtyChangeHistoryCard";
import OrderAttachmentsPanel from "../../_components/OrderAttachmentsPanel";
import type {
  QtyChangeLog,
  OrderAttachment,
} from "../../_components/order-detail-types";

/* =========================== Types =========================== */
type LookupOption = {
  value: string; label: string; description?: string; status?: string;
  dealerType?: "CASH" | "CREDIT"; salePrice?: number; stock?: number;
  sku?: string; warehouseId?: string; warehouseName?: string;
};

type OrderStatus =
  | "PENDING_AM" | "PENDING_RM" | "PENDING_NSM" | "PENDING_FULFILLMENT"
  | "IN_SHIPPING" | "DELIVERED" | "REJECTED" | "CANCELLED";

type StockInfo = {
  quantity: number; incomingTransfer: number; reservedForSales: number;
  reservedForTransfer: number; availableToSell: number;
};

type CreditSummary = {
  dealerId: string; dealerType: "CASH" | "CREDIT"; creditLimit: number;
  currentDue: number; used: number; due: number; available: number; canUseCredit: boolean;
};

type LineItem = {
  productId: string; productName: string; qty: number; bonusQty: number;
  unitPrice: number; discountPercent: number; promoAppliedId?: string | null;
  quantity: number; incomingTransfer: number; reservedForSales: number;
  reservedForTransfer: number; availableToSell: number;
};

type FormValues = {
  customerId: string; warehouseId: string; orderDate: string;
  paymentMethod: "CASH" | "CREDIT"; taxPercent: number; notes: string;
  items: LineItem[];
};

type SalesOrderDetail = {
  _id: string; orderNo: string; orderDate?: string; customerId?: any;
  warehouseId?: any; invoiceId?: any; items?: any[]; subTotal?: number;
  totalDiscount?: number; totalTax?: number; grandTotal?: number;
  totalBonusQty?: number; paymentMethod?: "CASH" | "CREDIT";
  creditSnapshot?: { creditLimit?: number; used?: number; available?: number };
  status: OrderStatus; isInvoiced?: boolean; notes?: string;
  approvalLogs?: Array<{
    role?: string; status?: string; remarks?: string;
    actionDate?: string; userId?: any;
  }>;
  createdAt?: string; updatedAt?: string;
  // 🆕 new fields (safe for old orders)
  qtyChangeLogs?: QtyChangeLog[] | null;
  attachments?: OrderAttachment[] | null;
};

type QrData = {
  invoiceId: string; orderId: string; invoiceNo: string; grandTotal: number;
  dealer: { code: string; name: string; phone: string; creditLimit: number; currentDue: number; available: number; };
  products: Array<{ name: string; qty: number; unitPrice: number }>;
};

/* =========================== Helpers =========================== */
const MEDIA_UPLOAD_ENDPOINT =
  "/media/upload?module=sales-order&folder=signed-documents";

const makeLine = (): LineItem => ({
  productId: "", productName: "", qty: 1, bonusQty: 0, unitPrice: 0,
  discountPercent: 0, promoAppliedId: null, quantity: 0, incomingTransfer: 0,
  reservedForSales: 0, reservedForTransfer: 0, availableToSell: 0,
});

const today = new Date().toISOString().slice(0, 10);

const printCompany = {
  name: "Antab Agro LTD", address: "123 Agro Street, Dhaka",
  phone: "+880 1711-111111", email: "info@antabagro.com",
};

function money(n: number | undefined) {
  return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(value?: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(d);
}
function computeAvailable(stock: Partial<StockInfo> | undefined) {
  const quantity = Number(stock?.quantity || 0);
  const incomingTransfer = Number(stock?.incomingTransfer || 0);
  const reservedForSales = Number(stock?.reservedForSales || 0);
  const reservedForTransfer = Number(stock?.reservedForTransfer || 0);
  return quantity + incomingTransfer - reservedForSales - reservedForTransfer;
}
function calcLine(item: LineItem, taxPercent: number) {
  const qty = Number(item.qty || 0);
  const unitPrice = Number(item.unitPrice || 0);
  const base = qty * unitPrice;
  const discountAmount = base * (Number(item.discountPercent || 0) / 100);
  const lineSubtotal = Math.max(0, base - discountAmount);
  const taxAmount = lineSubtotal * (Number(taxPercent || 0) / 100);
  const lineTotal = lineSubtotal + taxAmount;
  return { base, discountAmount, lineSubtotal, taxAmount, lineTotal };
}

/* =========================== Badges =========================== */
function StatusBadge({ status }: { status: OrderStatus }) {
  const styles: Record<OrderStatus, string> = {
    PENDING_AM: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    PENDING_RM: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    PENDING_NSM: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    PENDING_FULFILLMENT: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60",
    IN_SHIPPING: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60",
    DELIVERED: "bg-[#3aa838]/10 text-[#2f8a2f] border-[#3aa838]/30 dark:bg-[#3aa838]/15 dark:text-[#9bdd91] dark:border-[#3aa838]/40",
    REJECTED: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60",
    CANCELLED: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60",
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${styles[status]}`}>{status.replaceAll("_", " ")}</span>;
}
function PaymentBadge({ method }: { method?: "CASH" | "CREDIT" }) {
  if (!method) return <span className="text-xs text-slate-400">-</span>;
  const styles = method === "CREDIT"
    ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60"
    : "bg-[#3aa838]/10 text-[#2f8a2f] border-[#3aa838]/30 dark:bg-[#3aa838]/15 dark:text-[#9bdd91] dark:border-[#3aa838]/40";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${styles}`}>{method}</span>;
}

function SectionHeader({
  icon: Icon, title, subtitle, right,
}: {
  icon: React.ElementType; title: string; subtitle?: string; right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3aa838]/10 text-[#3aa838] dark:bg-[#3aa838]/15 dark:text-[#9bdd91]"><Icon className="h-4 w-4" /></div>
        <div>
          <div className="text-sm font-bold text-slate-900 dark:text-white">{title}</div>
          {subtitle && <div className="text-[11px] text-slate-500 dark:text-slate-400">{subtitle}</div>}
        </div>
      </div>
      {right}
    </div>
  );
}

function UploadTile({ label, hint, onFile, disabled }: {
  label: string; hint: string; onFile: (f: File | null) => void; disabled?: boolean;
}) {
  return (
    <label className={`block cursor-pointer rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center transition-colors hover:border-[#3aa838] hover:bg-[#3aa838]/5 dark:border-slate-700 dark:bg-slate-950/40 dark:hover:border-[#3aa838]/40 dark:hover:bg-[#3aa838]/10 ${disabled ? "pointer-events-none opacity-60" : ""}`}>
      <Upload className="mx-auto h-6 w-6 text-slate-400" />
      <div className="mt-2 text-xs font-medium text-slate-700 dark:text-slate-300">{label}</div>
      <div className="text-[10px] text-slate-500 dark:text-slate-400">{hint}</div>
      <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => onFile(e.target.files?.[0] || null)} />
    </label>
  );
}

/* =========================== LookupSelect =========================== */
function LookupSelect({
  value, selectedLabel, onPick, fetchOptions, placeholder, searchPlaceholder, disabled,
}: {
  value?: string; selectedLabel?: string; onPick: (option: LookupOption) => void;
  fetchOptions: (query: string) => Promise<LookupOption[]>; placeholder: string;
  searchPlaceholder: string; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<LookupOption[]>([]);
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef<Record<string, LookupOption[]>>({});

  useEffect(() => {
    if (!open) return;
    const key = query.trim().toLowerCase();
    const timer = setTimeout(async () => {
      if (cacheRef.current[key]) { setOptions(cacheRef.current[key]); return; }
      setLoading(true);
      try {
        const list = await fetchOptions(query);
        cacheRef.current[key] = list;
        setOptions(list);
      } catch { setOptions([]); } finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(timer);
  }, [open, query, fetchOptions]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled} className="h-10 w-full justify-between overflow-hidden bg-white font-normal transition-colors hover:border-slate-300 disabled:opacity-60 dark:bg-slate-900 dark:hover:border-slate-700">
          <span className={`truncate text-sm ${selectedLabel ? "text-slate-900 dark:text-white" : "text-slate-400"}`}>{selectedLabel || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>{loading ? "Loading…" : "No result found."}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem key={opt.value} value={`${opt.label} ${opt.description || ""}`} onSelect={() => { onPick(opt); setOpen(false); setQuery(""); }}>
                  <Check className={`mr-2 h-4 w-4 text-[#3aa838] ${opt.value === value ? "opacity-100" : "opacity-0"}`} />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{opt.label}</div>
                    {opt.description ? <div className="truncate text-xs text-slate-500 dark:text-slate-400">{opt.description}</div> : null}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* =========================== Print helpers =========================== */
function buildSalesOrderPrintHtml(order: SalesOrderDetail, qrImageDataUrl: string): string {
  const dealer = order.customerId || {};
  const warehouse = order.warehouseId || {};
  const items = order.items || [];
  const dateFmt = (d: any) => d ? new Date(d).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" }) : "—";
  const invoiceNo = order.invoiceId?.invoiceNo || order.orderNo.replace(/^SO/, "INV");
  const paymentStatus = order.invoiceId?.paymentStatus || "UNPAID";

  const rowsHtml = items.map((item) => `
    <tr style="border-bottom:1px solid #e2e8f0;">
      <td style="padding:8px 10px; font-weight:600;">${item.productId?.name || item.productName || "-"}</td>
      <td style="padding:8px 10px; text-align:center;">${Number(item.qty || 0)}</td>
      <td style="padding:8px 10px; text-align:center;">${Number(item.bonusQty || 0) > 0 ? Number(item.bonusQty || 0) : "-"}</td>
      <td style="padding:8px 10px; text-align:right; font-family:monospace;">${Number(item.unitPrice || 0).toFixed(2)}</td>
      <td style="padding:8px 10px; text-align:right; font-family:monospace;">${Number(item.lineSubtotal || 0).toFixed(2)}</td>
      <td style="padding:8px 10px; text-align:right; font-family:monospace;">${Number(item.taxAmount || 0).toFixed(2)}</td>
      <td style="padding:8px 10px; text-align:right; font-weight:700; font-family:monospace;">${Number(item.lineTotal || 0).toFixed(2)}</td>
    </tr>`).join("");

  return `
<div style="font-family:'Inter',sans-serif;max-width:100%;margin:0 auto;color:#1e293b;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
  <div style="background:linear-gradient(135deg,#0f172a,#1e293b);padding:18px 28px;display:flex;justify-content:space-between;align-items:center;color:white;">
    <div><div style="font-size:24px;font-weight:800;">SALES INVOICE</div><div style="font-size:13px;opacity:.9;margin-top:2px;">${order.paymentMethod === "CREDIT" ? "Credit Sale" : "Cash Sale"} · ${paymentStatus}</div></div>
    <div style="text-align:right;"><div style="font-size:22px;font-weight:800;">#${invoiceNo}</div><div style="font-size:12px;opacity:.8;">${dateFmt(order.orderDate || order.createdAt)}</div><div style="font-size:11px;opacity:.7;">Order: ${order.orderNo}</div></div>
  </div>
  <div style="padding:14px 28px;display:flex;gap:16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
    <div style="flex:1;background:white;border-radius:10px;padding:10px 14px;"><div style="font-size:10px;text-transform:uppercase;color:#64748b;font-weight:700;">Dealer</div><div style="font-weight:700;">${dealer.name || "-"}</div><div style="font-size:12px;color:#475569;">${dealer.phoneNumber || "-"}</div></div>
    <div style="flex:1;background:white;border-radius:10px;padding:10px 14px;"><div style="font-size:10px;text-transform:uppercase;color:#64748b;font-weight:700;">Warehouse</div><div style="font-weight:700;">${warehouse.name || "-"}</div></div>
    <div style="flex:1;background:white;border-radius:10px;padding:10px 14px;"><div style="font-size:10px;text-transform:uppercase;color:#64748b;font-weight:700;">Payment</div><div style="font-weight:700;color:${order.paymentMethod === "CREDIT" ? "#f59e0b" : "#16a34a"};">${order.paymentMethod}</div><div style="font-size:12px;color:#475569;">Total: ৳ ${(order.grandTotal ?? 0).toFixed(2)}</div></div>
  </div>
  <div style="padding:16px 28px;">
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead><tr style="background:#f1f5f9;font-weight:700;color:#334155;text-transform:uppercase;font-size:11px;">
        <th style="padding:10px 12px;text-align:left;">Product</th>
        <th style="padding:10px 12px;text-align:center;">Qty</th>
        <th style="padding:10px 12px;text-align:center;">Bonus</th>
        <th style="padding:10px 12px;text-align:right;">Unit</th>
        <th style="padding:10px 12px;text-align:right;">Sub</th>
        <th style="padding:10px 12px;text-align:right;">Tax</th>
        <th style="padding:10px 12px;text-align:right;">Total</th>
      </tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </div>
  <div style="display:flex;justify-content:flex-end;padding:14px 28px;background:#f8fafc;border-top:2px solid #e2e8f0;">
    <div style="width:320px;">
      <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;border-bottom:1px solid #e2e8f0;"><span>Subtotal</span><span style="font-weight:600;">৳ ${(order.subTotal ?? 0).toFixed(2)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;border-bottom:1px solid #e2e8f0;"><span>Discount</span><span style="font-weight:600;color:#dc2626;">- ৳ ${(order.totalDiscount ?? 0).toFixed(2)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;border-bottom:1px solid #e2e8f0;"><span>Tax</span><span style="font-weight:600;">৳ ${(order.totalTax ?? 0).toFixed(2)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:8px 0;font-size:16px;font-weight:800;"><span>Grand Total</span><span>৳ ${(order.grandTotal ?? 0).toFixed(2)}</span></div>
    </div>
  </div>
  <div style="display:flex;gap:16px;padding:14px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;">
    <div style="flex:1;background:white;border-radius:10px;padding:14px;text-align:center;">
      <div style="font-size:10px;text-transform:uppercase;color:#64748b;font-weight:700;margin-bottom:8px;">QR</div>
      ${qrImageDataUrl ? `<img src="${qrImageDataUrl}" style="width:140px;height:140px;border:1px solid #e2e8f0;border-radius:10px;" />` : `<div style="width:140px;height:140px;border:2px dashed #cbd5e1;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;color:#94a3b8;font-size:11px;">QR not ready</div>`}
    </div>
    <div style="flex:2;background:white;border-radius:10px;padding:14px;">
      <div style="font-size:10px;text-transform:uppercase;color:#64748b;font-weight:700;margin-bottom:8px;">Dealer Signature</div>
      <div style="height:110px;border:2px dashed #cbd5e1;border-radius:10px;display:flex;align-items:flex-end;justify-content:center;padding:10px;color:#94a3b8;font-size:12px;">Sign here after receiving goods</div>
    </div>
  </div>
</div>`;
}

function buildSalesOrderPrintHeaderRight(order: SalesOrderDetail): string {
  const paymentStatus = order.invoiceId?.paymentStatus || "UNPAID";
  return `<div style="text-align:right;"><div style="font-size:20px;font-weight:800;color:#0f172a;">#${order.orderNo}</div><div style="font-size:13px;color:#475569;margin-top:2px;">${order.paymentMethod === "CREDIT" ? "Credit Sale" : "Cash Sale"} · ${paymentStatus}</div><div style="display:inline-block;background:${order.status === "DELIVERED" ? "#065f46" : order.status === "CANCELLED" ? "#b91c1c" : "#1e40af"};color:white;padding:4px 16px;border-radius:100px;font-size:13px;margin-top:8px;font-weight:700;">${order.status.replaceAll("_", " ")}</div></div>`;
}

function buildDCPrintHtml(order: SalesOrderDetail): string {
  const dealer = order.customerId || {};
  const warehouse = order.warehouseId || {};
  const items = order.items || [];
  const dateFmt = (d: any) => d ? new Date(d).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" }) : "—";
  const rowsHtml = items.map((item, idx) => `
    <tr style="border-bottom:1px solid #e2e8f0;">
      <td style="padding:8px 10px;">${idx + 1}</td>
      <td style="padding:8px 10px;font-weight:600;">${item.productId?.name || item.productName || "-"}</td>
      <td style="padding:8px 10px;text-align:center;">${Number(item.qty || 0)}</td>
      <td style="padding:8px 10px;text-align:center;">${Number(item.bonusQty || 0) || "-"}</td>
      <td style="padding:8px 10px;text-align:center;">/</td>
      <td style="padding:8px 10px;text-align:center;">/</td>
    </tr>`).join("");
  return `
<div style="font-family:'Inter',sans-serif;max-width:100%;margin:0 auto;color:#1e293b;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
  <div style="background:#1e293b;padding:16px 28px;display:flex;justify-content:space-between;color:white;">
    <div><div style="font-size:22px;font-weight:800;">DELIVERY CHALAN</div><div style="font-size:13px;opacity:.9;">Original / Duplicate</div></div>
    <div style="text-align:right;"><div style="font-size:18px;font-weight:800;">DC #${order.orderNo}</div><div style="font-size:12px;opacity:.8;">${dateFmt(order.orderDate || order.createdAt)}</div></div>
  </div>
  <div style="padding:14px 28px;display:flex;gap:16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
    <div style="flex:1;background:white;border-radius:10px;padding:10px 14px;"><div style="font-size:10px;text-transform:uppercase;color:#64748b;font-weight:700;">Dealer</div><div style="font-weight:700;">${dealer.name || "-"}</div><div style="font-size:12px;color:#475569;">${dealer.phoneNumber || "-"}</div></div>
    <div style="flex:1;background:white;border-radius:10px;padding:10px 14px;"><div style="font-size:10px;text-transform:uppercase;color:#64748b;font-weight:700;">Warehouse</div><div style="font-weight:700;">${warehouse.name || "-"}</div></div>
  </div>
  <div style="padding:16px 28px;">
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead><tr style="background:#f1f5f9;font-weight:700;color:#334155;text-transform:uppercase;font-size:11px;">
        <th style="padding:10px 8px;text-align:left;">#</th>
        <th style="padding:10px 8px;text-align:left;">Product</th>
        <th style="padding:10px 8px;text-align:center;">Qty</th>
        <th style="padding:10px 8px;text-align:center;">Bonus</th>
        <th style="padding:10px 8px;text-align:center;">Recv'd</th>
        <th style="padding:10px 8px;text-align:center;">Remarks</th>
      </tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </div>
</div>`;
}

/* =========================== Page (Protected) =========================== */
export default function SalesOrderEditActionPage() {
  return (
    <Protected permissions="sales.view">
      <SalesOrderEditActionPageInner />
    </Protected>
  );
}

/* =========================== Inner =========================== */
function SalesOrderEditActionPageInner() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const orderId = params?.id;

  const hasAccess = usePermissionCheck();
  const canEdit = hasAccess({ permissions: "sales.edit" });

  const {
    control, register, handleSubmit, getValues, setValue, reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      customerId: "", warehouseId: "", orderDate: today,
      paymentMethod: "CASH", taxPercent: 0, notes: "", items: [makeLine()],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({ control, name: "items" });

  const customerId = useWatch({ control, name: "customerId" });
  const warehouseId = useWatch({ control, name: "warehouseId" });
  const paymentMethod = useWatch({ control, name: "paymentMethod" });
  const taxPercent = Number(useWatch({ control, name: "taxPercent" }) || 0);
  const watchedItems = (useWatch({ control, name: "items" }) || []) as LineItem[];

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAction, setSavingAction] = useState<string | null>(null);
  const [order, setOrder] = useState<SalesOrderDetail | null>(null);
  const [dealerMeta, setDealerMeta] = useState<LookupOption | null>(null);
  const [warehouseMeta, setWarehouseMeta] = useState<LookupOption | null>(null);
  const [creditSummary, setCreditSummary] = useState<CreditSummary | null>(null);
  const [creditLoading, setCreditLoading] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofUploading, setProofUploading] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [qrImage, setQrImage] = useState<string>("");
  const [qrParsed, setQrParsed] = useState<QrData | null>(null);
  const [qrImageForPrint, setQrImageForPrint] = useState<string>("");
  const [dcFile, setDcFile] = useState<File | null>(null);
  const [dcUploadLoading, setDcUploadLoading] = useState(false);
  const [dcMediaId, setDcMediaId] = useState<string | null>(null);

  const promoTimers = useRef<Record<string, ReturnType<typeof setTimeout> | undefined>>({});
  const stockCache = useRef<Record<string, StockInfo>>({});
  const promoCache = useRef<Record<string, { bonusQty: number; appliedPromotionId: string | null }>>({});

  const setRow = useCallback((index: number, patch: Partial<LineItem>) => {
    const row = getValues(`items.${index}`) as LineItem | undefined;
    if (!row) return;
    setValue(`items.${index}` as any, { ...row, ...patch }, { shouldDirty: true, shouldTouch: true });
  }, [getValues, setValue]);

  const fetchDealers = useCallback(async (search: string) => {
    const res = await api.get("/dealers", { params: { q: search || undefined, page: 1, limit: 20 } });
    return (res.data?.data || []).map((d: any) => ({
      value: String(d._id || d.id),
      label: d.name || d.proprietor || String(d._id || d.id),
      description: `${d.phoneNumber || d.phone || ""}${d.status ? ` · ${d.status}` : ""}`,
      status: d.status, dealerType: d.type,
      warehouseId: d.warehouse?._id ? String(d.warehouse._id) : undefined,
      warehouseName: d.warehouse?.name || undefined,
    })) as LookupOption[];
  }, []);

  const fetchWarehouses = useCallback(async (search: string) => {
    const res = await api.get("/warehouses", { params: { q: search || undefined, page: 1, limit: 20 } });
    return (res.data?.data || []).map((w: any) => ({
      value: String(w._id || w.id),
      label: w.name || String(w._id || w.id),
      description: w.code || w.type || "",
    })) as LookupOption[];
  }, []);

  const fetchProducts = useCallback(async (search: string) => {
    const res = await api.get("/products", { params: { q: search || undefined, page: 1, limit: 20 } });
    return (res.data?.data || []).map((p: any) => ({
      value: String(p._id || p.id),
      label: p.name || String(p._id || p.id),
      description: `${p.sku || ""}${p.salePrice ? ` · ${Number(p.salePrice)} BDT` : ""}`,
      salePrice: Number(p.salePrice ?? p.price ?? 0),
      stock: Number(p.stock ?? 0), sku: p.sku,
    })) as LookupOption[];
  }, []);

  const fetchStockInfo = useCallback(async (productId: string, wId?: string): Promise<StockInfo> => {
    if (!productId || !wId) return { quantity: 0, incomingTransfer: 0, reservedForSales: 0, reservedForTransfer: 0, availableToSell: 0 };
    const cacheKey = `${productId}|${wId}`;
    if (stockCache.current[cacheKey]) return stockCache.current[cacheKey];
    try {
      const res = await api.get("/product-stocks", { params: { productId, warehouseId: wId, page: 1, limit: 1 } });
      const row = res.data?.data?.[0] || {};
      const stock: StockInfo = {
        quantity: Number(row.quantity || 0),
        incomingTransfer: Number(row.incomingTransfer || 0),
        reservedForSales: Number(row.reservedForSales || 0),
        reservedForTransfer: Number(row.reservedForTransfer || 0),
        availableToSell: computeAvailable(row),
      };
      stockCache.current[cacheKey] = stock;
      return stock;
    } catch {
      const fallback: StockInfo = { quantity: 0, incomingTransfer: 0, reservedForSales: 0, reservedForTransfer: 0, availableToSell: 0 };
      stockCache.current[cacheKey] = fallback;
      return fallback;
    }
  }, []);

  const fetchPromo = useCallback(async (productId: string, qty: number, dId?: string, wId?: string) => {
    if (!productId || !qty || qty <= 0) return { bonusQty: 0, appliedPromotionId: null };
    const key = `${productId}|${qty}|${dId || ""}|${wId || ""}`;
    if (promoCache.current[key]) return promoCache.current[key];
    try {
      const res = await api.get("/promotions/calculate-bonus", { params: { productId, qty, customerId: dId, warehouseId: wId } });
      const data = res.data?.data || {};
      const result = { bonusQty: Number(data.bonusQty || 0), appliedPromotionId: (data.appliedPromotionId || null) as string | null };
      promoCache.current[key] = result;
      return result;
    } catch {
      const fallback = { bonusQty: 0, appliedPromotionId: null };
      promoCache.current[key] = fallback;
      return fallback;
    }
  }, []);

  const isEditable = useMemo(() => canEdit && !!order && ["PENDING_AM", "PENDING_RM", "PENDING_NSM", "PENDING_FULFILLMENT"].includes(order.status), [order, canEdit]);
  const canShip = canEdit && order?.status === "PENDING_FULFILLMENT";
  const canDeliver = canEdit && order?.status === "IN_SHIPPING";
  const canCancel = canEdit && order ? !["DELIVERED", "CANCELLED"].includes(order.status) : false;
  const canUploadDc = canEdit && !!order && ["IN_SHIPPING", "DELIVERED"].includes(order.status);

  const mapOrderToForm = useCallback(async (data: SalesOrderDetail) => {
    const customer = data.customerId;
    const warehouse = data.warehouseId;
    const nextItems: LineItem[] = (data.items || []).map((it: any) => ({
      productId: String(it.productId?._id || it.productId || ""),
      productName: it.productId?.name || it.productName || "",
      qty: Number(it.qty || 0),
      bonusQty: Number(it.bonusQty || 0),
      unitPrice: Number(it.unitPrice || 0),
      discountPercent: Number(it.discountPercent || 0),
      promoAppliedId: it.promotionId?._id || it.promotionId || null,
      quantity: 0, incomingTransfer: 0, reservedForSales: 0, reservedForTransfer: 0, availableToSell: 0,
    }));
    reset({
      customerId: String(customer?._id || customer?.id || ""),
      warehouseId: String(warehouse?._id || warehouse?.id || ""),
      orderDate: data.orderDate ? String(data.orderDate).slice(0, 10) : today,
      paymentMethod: data.paymentMethod || "CASH",
      taxPercent: Number(data.totalTax || 0) > 0 && Number(data.subTotal || 0) > 0
        ? Math.round((Number(data.totalTax || 0) / Number(data.subTotal || 1)) * 100) : 0,
      notes: data.notes || "",
      items: nextItems.length ? nextItems : [makeLine()],
    });
    setDealerMeta(customer ? {
      value: String(customer._id || customer.id || ""),
      label: customer.name || customer.proprietor || "",
      description: `${customer.phoneNumber || ""}${customer.status ? ` · ${customer.status}` : ""}`,
      dealerType: customer.type, status: customer.status,
    } : null);
    setWarehouseMeta(warehouse ? {
      value: String(warehouse._id || warehouse.id || ""),
      label: warehouse.name || "",
      description: warehouse.code || warehouse.type || "",
    } : null);
  }, [reset]);

  const loadOrder = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const res = await api.get(`/sales-orders/${orderId}`);
      const data = res.data?.data || res.data;
      setOrder(data);
      if (data.dcMediaId) setDcMediaId(String(data.dcMediaId));
      await mapOrderToForm(data);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to load sales order.");
    } finally { setLoading(false); }
  }, [orderId, mapOrderToForm]);

  useEffect(() => { void loadOrder(); }, [loadOrder]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!customerId) { setCreditSummary(null); return; }
      setCreditLoading(true);
      try {
        const res = await api.get(`/dealers/${customerId}/credit-summary`);
        if (!active) return;
        const data = res.data?.data;
        setCreditSummary(data ? {
          dealerId: String(data.dealerId || customerId),
          dealerType: data.dealerType || dealerMeta?.dealerType || "CASH",
          creditLimit: Number(data.creditLimit || 0),
          currentDue: Number(data.currentDue ?? data.used ?? 0),
          used: Number(data.used ?? 0),
          due: Number(data.due ?? 0),
          available: Number(data.available || 0),
          canUseCredit: Boolean(data.canUseCredit),
        } : null);
      } catch { if (active) setCreditSummary(null); } finally { if (active) setCreditLoading(false); }
    })();
    return () => { active = false; };
  }, [customerId, dealerMeta?.dealerType]);

  useEffect(() => {
    if (!order?.invoiceId) { setQrImage(""); setQrImageForPrint(""); setQrParsed(null); return; }
    const qrPayload = typeof order.invoiceId?.qrCode === "string" ? order.invoiceId.qrCode : "";
    if (!qrPayload) { setQrImage(""); setQrImageForPrint(""); setQrParsed(null); return; }
    try { setQrParsed(JSON.parse(qrPayload) as QrData); } catch { setQrParsed(null); }
    let mounted = true;
    QRCode.toDataURL(qrPayload, { width: 220, margin: 2, errorCorrectionLevel: "M" })
      .then((d) => { if (mounted) { setQrImage(d); setQrImageForPrint(d); } })
      .catch(() => { if (mounted) { setQrImage(""); setQrImageForPrint(""); } });
    return () => { mounted = false; };
  }, [order?.invoiceId]);

  const refreshRowById = useCallback(async (fieldId: string, opts?: { stock?: boolean; promo?: boolean }) => {
    const index = fields.findIndex((f) => f.id === fieldId);
    if (index < 0) return;
    const row = getValues(`items.${index}`) as LineItem | undefined;
    if (!row || !row.productId) return;
    const next: Partial<LineItem> = {};
    if (opts?.stock !== false && warehouseId) {
      const stock = await fetchStockInfo(row.productId, warehouseId);
      Object.assign(next, {
        quantity: stock.quantity, incomingTransfer: stock.incomingTransfer,
        reservedForSales: stock.reservedForSales, reservedForTransfer: stock.reservedForTransfer,
        availableToSell: stock.availableToSell,
      });
    }
    if (opts?.promo !== false) {
      const promo = await fetchPromo(row.productId, Number(row.qty || 0), customerId || undefined, warehouseId || undefined);
      Object.assign(next, { bonusQty: promo.bonusQty || 0, promoAppliedId: promo.appliedPromotionId });
    }
    setRow(index, next);
  }, [fields, getValues, setRow, warehouseId, customerId, fetchStockInfo, fetchPromo]);

  const refreshAllRows = useCallback(async () => {
    await Promise.all(fields.map((f) => refreshRowById(f.id, { stock: true, promo: true })));
  }, [fields, refreshRowById]);

  useEffect(() => { void refreshAllRows(); }, [warehouseId, customerId]); // eslint-disable-line

  const totals = useMemo(() => {
    const lineData = watchedItems.map((item) => calcLine(item, taxPercent));
    const totalQty = watchedItems.reduce((s, it) => s + Number(it.qty || 0), 0);
    const totalBonusQty = watchedItems.reduce((s, it) => s + Number(it.bonusQty || 0), 0);
    const subtotal = lineData.reduce((s, r) => s + r.lineSubtotal, 0);
    const totalDiscount = lineData.reduce((s, r) => s + r.discountAmount, 0);
    const totalTax = lineData.reduce((s, r) => s + r.taxAmount, 0);
    const grandTotal = subtotal + totalTax;
    return { lineData, totalQty, totalBonusQty, subtotal, totalDiscount, totalTax, grandTotal };
  }, [watchedItems, taxPercent]);

  const updateOrder = useCallback(async (nextValues: FormValues) => {
    if (!canEdit) { toast.error("You don't have permission to edit sales orders."); return; }
    if (!orderId || !order) return;
    const items = nextValues.items.map((row) => {
      const line = calcLine(row, nextValues.taxPercent);
      return {
        productId: row.productId, warehouseId: nextValues.warehouseId,
        qty: Number(row.qty || 0), bonusQty: Number(row.bonusQty || 0),
        unitPrice: Number(row.unitPrice || 0), discountPercent: Number(row.discountPercent || 0),
        discountAmount: Number(line.discountAmount || 0), taxPercent: Number(nextValues.taxPercent || 0),
        taxAmount: Number(line.taxAmount || 0), lineSubtotal: Number(line.lineSubtotal || 0),
        lineTotal: Number(line.lineTotal || 0),
        ...(row.promoAppliedId ? { promotionId: row.promoAppliedId } : {}),
      };
    });
    const payload = {
      customerId: nextValues.customerId, warehouseId: nextValues.warehouseId,
      orderDate: nextValues.orderDate ? new Date(nextValues.orderDate).toISOString() : new Date().toISOString(),
      paymentMethod: nextValues.paymentMethod, items,
      subTotal: totals.subtotal, totalDiscount: totals.totalDiscount,
      totalTax: totals.totalTax, grandTotal: totals.grandTotal,
      totalBonusQty: totals.totalBonusQty, notes: nextValues.notes || "",
    };
    setSaving(true);
    try {
      await api.put(`/sales-orders/${orderId}`, payload);
      toast.success("Sales order updated successfully.");
      await loadOrder();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to update sales order.");
    } finally { setSaving(false); }
  }, [orderId, order, totals, loadOrder, canEdit]);

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await api.post(MEDIA_UPLOAD_ENDPOINT, formData, { headers: { "Content-Type": "multipart/form-data" } });
    const data = res.data?.data || res.data;
    const mediaId = data?._id || data?.id;
    if (!mediaId) throw new Error("Uploaded file id not returned by upload API.");
    return String(mediaId);
  };

  const currentApprovalRole = useMemo(() => {
    switch (order?.status) {
      case "PENDING_AM": return "A.M";
      case "PENDING_RM": return "R.M";
      case "PENDING_NSM": return "N.S.M";
      default: return null;
    }
  }, [order?.status]);

  const handleApprove = async () => {
    if (!canEdit) { toast.error("You don't have permission to approve sales orders."); return; }
    if (!orderId || !currentApprovalRole) return;
    setSavingAction("approve");
    try {
      await api.post(`/sales-orders/${orderId}/approve`, { role: currentApprovalRole, remarks });
      toast.success(`${currentApprovalRole} approved.`);
      setRemarks("");
      await loadOrder();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to approve order.");
    } finally { setSavingAction(null); }
  };

  const handleShip = async () => {
    if (!canEdit) { toast.error("You don't have permission to ship sales orders."); return; }
    if (!orderId) return;
    if (!confirm("Create invoice and move this order to fulfillment?")) return;
    setSavingAction("ship");
    try {
      await api.post(`/sales-orders/${orderId}/ship`);
      toast.success("Invoice created.");
      await loadOrder();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to ship order.");
    } finally { setSavingAction(null); }
  };

  const handleCancel = async () => {
    if (!canEdit) { toast.error("You don't have permission to cancel sales orders."); return; }
    if (!orderId) return;
    if (!confirm("Cancel this sales order?")) return;
    setSavingAction("cancel");
    try {
      await api.post(`/sales-orders/${orderId}/cancel`);
      toast.success("Order cancelled.");
      await loadOrder();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to cancel order.");
    } finally { setSavingAction(null); }
  };

  const handleDeliver = async () => {
    if (!canEdit) { toast.error("You don't have permission to deliver sales orders."); return; }
    if (!orderId) return;
    if (!proofFile) { toast.error("Please upload the signed invoice first."); return; }
    setSavingAction("deliver");
    setProofUploading(true);
    try {
      const uploadedDocumentFileId = await uploadFile(proofFile);
      await api.post(`/sales-orders/${orderId}/deliver`, { uploadedDocumentFileId });
      toast.success("Delivery approved.");
      setProofFile(null);
      await loadOrder();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to deliver order.");
    } finally { setProofUploading(false); setSavingAction(null); }
  };

  const handleDCUpload = async () => {
    if (!canEdit) { toast.error("You don't have permission to upload DC files."); return; }
    if (!dcFile) { toast.error("Select a DC file first"); return; }
    setDcUploadLoading(true);
    try {
      const mediaId = await uploadFile(dcFile);
      await api.post(`/sales-orders/${orderId}/upload-dc`, { dcMediaId: mediaId });
      setDcMediaId(mediaId);
      toast.success("Delivery Chalan uploaded.");
      await loadOrder();
    } catch (err: any) {
      toast.error(err?.message || "DC upload failed");
    } finally { setDcUploadLoading(false); }
  };

  const onPickDealer = async (opt: LookupOption) => {
    setValue("customerId", opt.value, { shouldDirty: true });
    setDealerMeta(opt);
    setCreditSummary(null);
    if (opt.warehouseId) {
      setValue("warehouseId", opt.warehouseId, { shouldDirty: true });
      setWarehouseMeta({ value: opt.warehouseId, label: opt.warehouseName || "", description: "Auto-selected" });
    }
    await refreshAllRows();
  };

  const onPickWarehouse = async (opt: LookupOption) => {
    setValue("warehouseId", opt.value, { shouldDirty: true });
    setWarehouseMeta(opt);
    await refreshAllRows();
  };

  const onPickProduct = async (index: number, opt: LookupOption) => {
    const row = getValues(`items.${index}`) as LineItem | undefined;
    if (!row) return;
    const stock = warehouseId
      ? await fetchStockInfo(opt.value, warehouseId)
      : { quantity: Number(opt.stock || 0), incomingTransfer: 0, reservedForSales: 0, reservedForTransfer: 0, availableToSell: Number(opt.stock || 0) };
    const promo = await fetchPromo(opt.value, Number(row.qty || 0), customerId || undefined, warehouseId || undefined);
    setRow(index, {
      productId: opt.value, productName: opt.label, unitPrice: Number(opt.salePrice || 0),
      quantity: stock.quantity, incomingTransfer: stock.incomingTransfer,
      reservedForSales: stock.reservedForSales, reservedForTransfer: stock.reservedForTransfer,
      availableToSell: stock.availableToSell, bonusQty: promo.bonusQty || 0,
      promoAppliedId: promo.appliedPromotionId,
    });
  };

  const onQtyChange = (index: number, qty: number) => {
    setRow(index, { qty: Math.max(0, qty) });
    const fieldId = fields[index]?.id;
    if (!fieldId) return;
    const existing = promoTimers.current[fieldId];
    if (existing) clearTimeout(existing);
    promoTimers.current[fieldId] = setTimeout(async () => {
      await refreshRowById(fieldId, { stock: false, promo: true });
    }, 300);
  };

  const addRow = () => append(makeLine());

  const duplicateRow = (index: number) => {
    const row = getValues(`items.${index}`) as LineItem | undefined;
    if (!row) return;
    append({ ...row, promoAppliedId: row.promoAppliedId || null });
  };

  const removeRow = (index: number) => {
    const fieldId = fields[index]?.id;
    if (fieldId && promoTimers.current[fieldId]) { clearTimeout(promoTimers.current[fieldId]); delete promoTimers.current[fieldId]; }
    if (fields.length === 1) { replace([makeLine()]); return; }
    remove(index);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50/60 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-[#3aa838]" />
          <span className="text-xs text-slate-500 dark:text-slate-400">Loading sales order…</span>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50/60 p-4 dark:bg-slate-950">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
            <Inbox className="h-6 w-6 text-slate-400" />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">Sales order not found</p>
          <Button className="mt-4 h-9 gap-1.5 bg-[#3aa838] text-white hover:bg-[#2f8a2f]" onClick={() => router.push("/sales/list")}>Back to list</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950">
      <div className="mx-auto w-full max-w-[1600px] p-4 md:p-6">
        {/* HERO with actions */}
        <div className="relative mb-4 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-[#1a4d1a] p-5 text-white shadow-lg md:p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(58,168,56,0.25),transparent_55%)]" />
          <div className="relative">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/60">Edit Sales Order</div>
                <h1 className="mt-1 text-2xl font-bold tracking-tight tabular-nums md:text-3xl">{order.orderNo}</h1>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusBadge status={order.status} />
                  <PaymentBadge method={order.paymentMethod} />
                  <span className="text-[11px] text-white/60">{fmtDate(order.createdAt || order.orderDate)}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <Button variant="secondary" size="sm" className="h-9 gap-1.5 border border-white/20 bg-white/10 text-xs text-white hover:bg-white/20" onClick={() => router.push(`/sales/list/${order._id}`)}>
                  <ArrowLeft className="h-3.5 w-3.5" /> View
                </Button>
                <Button variant="secondary" size="sm" className="h-9 gap-1.5 border border-white/20 bg-white/10 text-xs text-white hover:bg-white/20" onClick={() => void loadOrder()}>
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </Button>
                {order.invoiceId && (
                  <GlobalPrintButton
                    contentHtml={buildSalesOrderPrintHtml(order, qrImageForPrint)}
                    headerRightHtml={buildSalesOrderPrintHeaderRight(order)}
                    label="Print Invoice"
                    title="Sales Invoice"
                    orientation="portrait"
                    company={printCompany}
                    showHeader={false}
                    showFooter={false}
                  />
                )}
                <GlobalPrintButton
                  contentHtml={buildDCPrintHtml(order)}
                  headerRightHtml={`<div style="text-align:right;"><div style="font-size:20px;font-weight:800;color:#0f172a;">DC #${order.orderNo}</div></div>`}
                  label="Print DC"
                  title="Delivery Chalan"
                  orientation="portrait"
                  company={printCompany}
                  showHeader={false}
                  showFooter={false}
                />
                {canShip && (
                  <Button size="sm" className="h-9 gap-1.5 bg-[#3aa838] text-xs text-white hover:bg-[#2f8a2f]" onClick={() => void handleShip()} disabled={savingAction === "ship"}>
                    {savingAction === "ship" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Package className="h-3.5 w-3.5" />} Ship
                  </Button>
                )}
                {canCancel && (
                  <Button variant="secondary" size="sm" className="h-9 gap-1.5 border border-rose-500/30 bg-rose-500/15 text-xs text-rose-200 hover:bg-rose-500/25" onClick={() => void handleCancel()} disabled={savingAction === "cancel"}>
                    {savingAction === "cancel" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />} Cancel
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(updateOrder)} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* LEFT COLUMN */}
          <div className="space-y-4">
            {/* Order basics form */}
            <Card className="overflow-hidden border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <SectionHeader icon={Receipt} title="Order basics" subtitle="Dealer, warehouse, date, payment" />
              <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"><Building2 className="h-3 w-3" /> Dealer</label>
                  <LookupSelect value={customerId} selectedLabel={dealerMeta?.label} onPick={onPickDealer} fetchOptions={fetchDealers} placeholder="Search dealer" searchPlaceholder="Type dealer name…" disabled={!isEditable} />
                </div>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"><WarehouseIcon className="h-3 w-3" /> Warehouse</label>
                  <LookupSelect value={warehouseId} selectedLabel={warehouseMeta?.label} onPick={onPickWarehouse} fetchOptions={fetchWarehouses} placeholder="Search warehouse" searchPlaceholder="Type warehouse…" disabled={!isEditable} />
                </div>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"><Calendar className="h-3 w-3" /> Date</label>
                  <Input type="date" {...register("orderDate")} className="h-10 text-sm" disabled={!isEditable} />
                </div>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"><CreditCard className="h-3 w-3" /> Payment</label>
                  <select {...register("paymentMethod")} disabled={!isEditable} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-[#3aa838]/40 dark:border-slate-800 dark:bg-slate-900 dark:text-white disabled:opacity-60">
                    <option value="CASH">Cash</option>
                    <option value="CREDIT">Credit</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* Order items form */}
            <Card className="overflow-hidden border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <SectionHeader
                icon={Package} title="Order items" subtitle="Stock and promos update automatically"
                right={isEditable ? (
                  <div className="flex gap-1.5">
                    <Button type="button" variant="outline" size="sm" onClick={addRow} className="h-8 gap-1.5 text-xs"><Plus className="h-3.5 w-3.5" /> Add</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => void refreshAllRows()} className="h-8 gap-1.5 text-xs"><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
                  </div>
                ) : null}
              />
              <CardContent className="space-y-3 p-4">
                {fields.map((field, index) => {
                  const row = watchedItems[index] || makeLine();
                  const line = calcLine(row, taxPercent);
                  const lowStock = Number(row.availableToSell || 0) < Number(row.qty || 0);
                  return (
                    <div key={field.id} className={`rounded-xl border-2 bg-white p-3 dark:bg-slate-900 ${lowStock ? "border-rose-300 bg-rose-50/40 dark:border-rose-900/60" : "border-slate-200 dark:border-slate-800"}`}>
                      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white dark:bg-slate-700">{index + 1}</span>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">{row.productName || "New item"}</div>
                            {row.promoAppliedId ? (
                              <div className="flex items-center gap-1 text-[10px] font-semibold text-[#3aa838] dark:text-[#9bdd91]"><Sparkles className="h-2.5 w-2.5" /> Promotion applied</div>
                            ) : null}
                          </div>
                        </div>
                        {isEditable ? (
                          <div className="flex gap-0.5">
                            <Button type="button" variant="ghost" size="sm" onClick={() => duplicateRow(index)} className="h-7 gap-1 px-2 text-[10px]"><Copy className="h-3 w-3" /> Duplicate</Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => removeRow(index)} className="h-7 gap-1 px-2 text-[10px] text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"><Trash2 className="h-3 w-3" /> Remove</Button>
                          </div>
                        ) : null}
                      </div>
                      <div className="grid gap-2.5 md:grid-cols-12">
                        <div className="md:col-span-5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Product</label>
                          <LookupSelect value={row.productId} selectedLabel={row.productName || undefined} onPick={(opt) => onPickProduct(index, opt)} fetchOptions={fetchProducts} placeholder="Search product" searchPlaceholder="Type product name…" disabled={!isEditable} />
                        </div>
                        <div className="md:col-span-3">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Qty</label>
                          <div className="flex items-center gap-1">
                            <Button type="button" variant="outline" size="icon" className="h-9 w-8" onClick={() => onQtyChange(index, Math.max(0, Number(row.qty || 0) - 1))} disabled={!isEditable}><Minus className="h-3 w-3" /></Button>
                            <Input type="number" min={0} value={row.qty} onChange={(e) => onQtyChange(index, Number(e.target.value || 0))} className="h-9 flex-1 text-center text-sm font-semibold tabular-nums" disabled={!isEditable} />
                            <Button type="button" variant="outline" size="icon" className="h-9 w-8" onClick={() => onQtyChange(index, Number(row.qty || 0) + 1)} disabled={!isEditable}><Plus className="h-3 w-3" /></Button>
                          </div>
                          <div className={`mt-0.5 flex items-center gap-1 text-[10px] font-semibold ${lowStock ? "text-rose-600" : "text-[#3aa838]"}`}>
                            {lowStock ? <AlertTriangle className="h-2.5 w-2.5" /> : <CheckCircle2 className="h-2.5 w-2.5" />}
                            {Number(row.availableToSell || 0)} sellable
                          </div>
                        </div>
                        <div className="md:col-span-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Bonus</label>
                          <div className="flex h-9 items-center justify-center rounded-lg border border-[#3aa838]/30 bg-[#3aa838]/10 px-2 text-sm font-semibold text-[#2f8a2f] dark:bg-[#3aa838]/15 dark:text-[#9bdd91]">{Number(row.bonusQty || 0)}</div>
                        </div>
                        <div className="md:col-span-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Disc %</label>
                          <Input type="number" min={0} step="0.01" value={row.discountPercent} onChange={(e) => setRow(index, { discountPercent: Number(e.target.value || 0) })} className="h-9 text-center text-sm" disabled={!isEditable} />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Line total</label>
                          <div className="flex h-9 items-center justify-end rounded-lg border border-[#3aa838]/30 bg-[#3aa838]/10 px-3 text-sm font-bold text-[#2f8a2f] dark:bg-[#3aa838]/15 dark:text-[#9bdd91]">৳ {money(line.lineTotal)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* 🆕 QTY CHANGE HISTORY */}
            <QtyChangeHistoryCard logs={order.qtyChangeLogs} />

            {/* Approval action card */}
            {currentApprovalRole && isEditable ? (
              <Card className="overflow-hidden border-[#3aa838]/30 shadow-md ring-2 ring-[#3aa838]/10 dark:border-[#3aa838]/40 dark:bg-slate-900">
                <SectionHeader icon={ShieldCheck} title="Approval" subtitle={`Approve as ${currentApprovalRole}`} />
                <CardContent className="space-y-3 p-4">
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#3aa838]/40 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                    placeholder={`Add remarks for ${currentApprovalRole} approval (optional)…`}
                  />
                  <Button
                    type="button"
                    onClick={() => void handleApprove()}
                    disabled={savingAction === "approve"}
                    className="h-9 w-full gap-1.5 bg-[#3aa838] text-xs text-white shadow-sm shadow-[#3aa838]/20 hover:bg-[#2f8a2f]"
                  >
                    {savingAction === "approve" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Approve as {currentApprovalRole}
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            {/* 🆕 ATTACHMENTS */}
            <OrderAttachmentsPanel
              orderId={orderId!}
              attachments={order.attachments}
              canUpload={canEdit}
              canDelete={canEdit}
              onRefresh={loadOrder}
            />

            {/* Notes */}
            <Card className="overflow-hidden border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <SectionHeader icon={FileText} title="Notes" />
              <CardContent className="p-4">
                <textarea {...register("notes")} rows={3} disabled={!isEditable} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#3aa838]/40 dark:border-slate-800 dark:bg-slate-950 dark:text-white disabled:opacity-60" placeholder="Internal remarks, delivery notes…" />
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-4 lg:sticky lg:top-4 h-fit">
            {/* Summary + Save */}
            <Card className="overflow-hidden border-slate-200 shadow-md dark:border-slate-800 dark:bg-slate-900">
              <SectionHeader icon={Wallet} title="Summary" />
              <CardContent className="space-y-2.5 p-4">
                <div className="flex justify-between text-xs"><span className="text-slate-500 dark:text-slate-400">Qty</span><span className="font-semibold tabular-nums text-slate-900 dark:text-white">{totals.totalQty}</span></div>
                <div className="flex justify-between text-xs"><span className="text-slate-500 dark:text-slate-400">Bonus qty</span><span className="font-semibold tabular-nums text-slate-900 dark:text-white">{totals.totalBonusQty}</span></div>
                <div className="flex justify-between text-xs"><span className="text-slate-500 dark:text-slate-400">Subtotal</span><span className="font-semibold tabular-nums text-slate-900 dark:text-white">৳ {money(totals.subtotal)}</span></div>
                <div className="flex justify-between text-xs"><span className="text-slate-500 dark:text-slate-400">Discount</span><span className="font-semibold tabular-nums text-rose-600 dark:text-rose-400">- ৳ {money(totals.totalDiscount)}</span></div>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Tax %</span>
                  <Input type="number" min={0} step="0.01" {...register("taxPercent", { valueAsNumber: true })} className="h-7 w-16 text-center text-xs" disabled={!isEditable} />
                </div>
                <div className="flex justify-between text-xs"><span className="text-slate-500 dark:text-slate-400">Tax</span><span className="font-semibold tabular-nums text-slate-900 dark:text-white">৳ {money(totals.totalTax)}</span></div>
                <div className="flex justify-between border-t border-slate-200 pt-2.5 dark:border-slate-800">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">Grand total</span>
                  <span className="text-lg font-extrabold tabular-nums text-[#2f8a2f] dark:text-[#9bdd91]">৳ {money(totals.grandTotal)}</span>
                </div>
                <Button type="submit" disabled={!isEditable || saving || isSubmitting} className="mt-2 h-10 w-full gap-1.5 bg-[#3aa838] text-sm font-semibold text-white shadow-md shadow-[#3aa838]/30 hover:bg-[#2f8a2f] disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-800">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </CardContent>
            </Card>

            {/* Credit */}
            <Card className="overflow-hidden border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <SectionHeader icon={TrendingUp} title="Credit summary" />
              <CardContent className="space-y-2.5 p-4">
                {creditLoading ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3 w-3 animate-spin" /> Loading…</div>
                ) : creditSummary ? (
                  <>
                    <div className="flex justify-between text-xs"><span className="text-slate-500 dark:text-slate-400">Limit</span><span className="font-semibold tabular-nums text-slate-900 dark:text-white">{money(creditSummary.creditLimit)}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-slate-500 dark:text-slate-400">Used</span><span className="font-semibold tabular-nums text-slate-900 dark:text-white">{money(creditSummary.used)}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-slate-500 dark:text-slate-400">Available</span><span className={`font-bold tabular-nums ${creditSummary.available < totals.grandTotal ? "text-rose-600 dark:text-rose-400" : "text-[#3aa838] dark:text-[#9bdd91]"}`}>{money(creditSummary.available)}</span></div>
                    {paymentMethod === "CREDIT" && creditSummary.available < totals.grandTotal && (
                      <div className="flex items-start gap-1.5 rounded-md bg-rose-50 p-2 text-[10px] font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> Credit limit will be exceeded.
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-xs text-slate-500 dark:text-slate-400">No credit info yet.</div>
                )}
              </CardContent>
            </Card>

            {/* QR */}
            {order.invoiceId && (
              <Card className="overflow-hidden border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <SectionHeader icon={Receipt} title="Invoice QR" />
                <CardContent className="space-y-2 p-4">
                  <div className="rounded-lg border border-slate-200 bg-white p-3 text-center dark:border-slate-800 dark:bg-slate-950/40">
                    {qrImage ? (
                      <img src={qrImage} alt="Invoice QR" className="mx-auto h-44 w-44 rounded border border-slate-200 dark:border-slate-700" />
                    ) : (
                      <div className="flex h-44 w-44 mx-auto items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 text-[10px] text-slate-500 dark:border-slate-700 dark:bg-slate-950/40">QR not ready</div>
                    )}
                    <div className="mt-1.5 text-[10px] text-slate-500 dark:text-slate-400">Scan to verify</div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Delivery verification */}
            {canDeliver && (
              <Card className="overflow-hidden border-[#3aa838]/30 shadow-md ring-2 ring-[#3aa838]/10 dark:border-[#3aa838]/40 dark:bg-slate-900">
                <SectionHeader icon={Truck} title="Delivery verification" subtitle="Upload signed invoice" />
                <CardContent className="space-y-3 p-4">
                  <div className="rounded-lg border border-[#3aa838]/20 bg-[#3aa838]/5 p-2.5 text-[11px] text-[#2f8a2f] dark:border-[#3aa838]/30 dark:bg-[#3aa838]/10 dark:text-[#9bdd91]">
                    The backend will verify the QR and dealer signature before approving delivery.
                  </div>
                  <UploadTile label="Upload signed invoice" hint="PDF or image" onFile={setProofFile} />
                  {proofFile && (
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-[10px] dark:border-slate-800 dark:bg-slate-950/40">
                      <span className="text-slate-500 dark:text-slate-400">Selected:</span> <span className="font-medium text-slate-900 dark:text-white">{proofFile.name}</span>
                    </div>
                  )}
                  <Button type="button" className="h-9 w-full gap-1.5 bg-[#3aa838] text-xs text-white shadow-sm shadow-[#3aa838]/20 hover:bg-[#2f8a2f]" onClick={() => void handleDeliver()} disabled={proofUploading || savingAction === "deliver" || !proofFile}>
                    {proofUploading || savingAction === "deliver" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    Verify and deliver
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* DC upload */}
            {canUploadDc && (
              <Card className="overflow-hidden border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <SectionHeader icon={FileText} title="Delivery Chalan" subtitle="Optional signed DC" />
                <CardContent className="space-y-3 p-4">
                  <UploadTile label="Upload signed DC" hint="PDF or image" onFile={setDcFile} disabled={!canEdit} />
                  {dcFile && (
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-[10px] dark:border-slate-800 dark:bg-slate-950/40">
                      <span className="text-slate-500 dark:text-slate-400">Selected:</span> <span className="font-medium text-slate-900 dark:text-white">{dcFile.name}</span>
                    </div>
                  )}
                  {canEdit && (
                    <Button type="button" className="h-9 w-full gap-1.5 bg-[#3aa838] text-xs text-white shadow-sm shadow-[#3aa838]/20 hover:bg-[#2f8a2f]" onClick={handleDCUpload} disabled={dcUploadLoading || !dcFile}>
                      {dcUploadLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      Upload DC
                    </Button>
                  )}
                  {dcMediaId && (
                    <div className="rounded-lg border border-[#3aa838]/30 bg-[#3aa838]/5 p-2.5 dark:border-[#3aa838]/40 dark:bg-[#3aa838]/10">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-[#2f8a2f] dark:text-[#9bdd91]"><CheckCircle2 className="h-3.5 w-3.5" /> DC uploaded</div>
                      <div className="mt-0.5 truncate font-mono text-[10px] text-[#2f8a2f] dark:text-[#9bdd91]">{dcMediaId}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}