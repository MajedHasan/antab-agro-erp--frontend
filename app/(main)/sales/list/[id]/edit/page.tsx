"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";
import QRCode from "qrcode";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import GlobalPrintButton from "@/components/common/print/GlobalPrintButton";
import {
  Check,
  ChevronsUpDown,
  Loader2,
  Plus,
  Trash2,
  RefreshCw,
  Upload,
  Ban,
  Save,
  ShieldCheck,
  Truck,
  Copy,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Building2,
  Warehouse as WarehouseIcon,
  Calendar,
  CreditCard,
  Package,
  Wallet,
  TrendingUp,
  Receipt,
  Minus,
  Sparkles,
} from "lucide-react";

/* --------------------------- Types --------------------------- */
type LookupOption = {
  value: string;
  label: string;
  description?: string;
  status?: string;
  dealerType?: "CASH" | "CREDIT";
  salePrice?: number;
  stock?: number;
  sku?: string;
  warehouseId?: string;
  warehouseName?: string;
};

type OrderStatus =
  | "PENDING_AM"
  | "PENDING_RM"
  | "PENDING_NSM"
  | "PENDING_FULFILLMENT"
  | "IN_SHIPPING"
  | "DELIVERED"
  | "REJECTED"
  | "CANCELLED";

type StockInfo = {
  quantity: number;
  incomingTransfer: number;
  reservedForSales: number;
  reservedForTransfer: number;
  availableToSell: number;
};

type CreditSummary = {
  dealerId: string;
  dealerType: "CASH" | "CREDIT";
  creditLimit: number;
  currentDue: number;
  used: number;
  due: number;
  available: number;
  canUseCredit: boolean;
};

type LineItem = {
  productId: string;
  productName: string;
  qty: number;
  bonusQty: number;
  unitPrice: number;
  discountPercent: number;
  promoAppliedId?: string | null;

  quantity: number;
  incomingTransfer: number;
  reservedForSales: number;
  reservedForTransfer: number;
  availableToSell: number;
};

type FormValues = {
  customerId: string;
  warehouseId: string;
  orderDate: string;
  paymentMethod: "CASH" | "CREDIT";
  taxPercent: number;
  notes: string;
  items: LineItem[];
};

type SalesOrderDetail = {
  _id: string;
  orderNo: string;
  orderDate?: string;
  customerId?: any;
  warehouseId?: any;
  invoiceId?: any;
  items?: any[];
  subTotal?: number;
  totalDiscount?: number;
  totalTax?: number;
  grandTotal?: number;
  totalBonusQty?: number;
  paymentMethod?: "CASH" | "CREDIT";
  creditSnapshot?: {
    creditLimit?: number;
    used?: number;
    available?: number;
  };
  status: OrderStatus;
  isInvoiced?: boolean;
  notes?: string;
  approvalLogs?: Array<{
    role?: string;
    status?: string;
    remarks?: string;
    actionDate?: string;
    userId?: any;
  }>;
  createdAt?: string;
  updatedAt?: string;
};

type QrData = {
  invoiceId: string;
  orderId: string;
  invoiceNo: string;
  grandTotal: number;
  dealer: {
    code: string;
    name: string;
    phone: string;
    creditLimit: number;
    currentDue: number;
    available: number;
  };
  products: Array<{
    name: string;
    qty: number;
    unitPrice: number;
  }>;
};

/* --------------------------- Helpers --------------------------- */
const MEDIA_UPLOAD_ENDPOINT =
  "/media/upload?module=sales-order&folder=signed-documents";

const makeLine = (): LineItem => ({
  productId: "",
  productName: "",
  qty: 1,
  bonusQty: 0,
  unitPrice: 0,
  discountPercent: 0,
  promoAppliedId: null,
  quantity: 0,
  incomingTransfer: 0,
  reservedForSales: 0,
  reservedForTransfer: 0,
  availableToSell: 0,
});

const today = new Date().toISOString().slice(0, 10);

function money(n: number | undefined) {
  return Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(value?: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
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

/* --------------------------- Badges --------------------------- */
function StatusBadge({ status }: { status: OrderStatus }) {
  const styles: Record<OrderStatus, string> = {
    PENDING_AM: "bg-slate-100 text-slate-700 border-slate-200",
    PENDING_RM: "bg-slate-100 text-slate-700 border-slate-200",
    PENDING_NSM: "bg-slate-100 text-slate-700 border-slate-200",
    PENDING_FULFILLMENT: "bg-amber-50 text-amber-700 border-amber-200",
    IN_SHIPPING: "bg-amber-50 text-amber-700 border-amber-200",
    DELIVERED: "bg-[#3aa838]/10 text-[#2f8a2f] border-[#3aa838]/30",
    REJECTED: "bg-rose-50 text-rose-700 border-rose-200",
    CANCELLED: "bg-rose-50 text-rose-700 border-rose-200",
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${styles[status]}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

function PaymentBadge({ method }: { method?: "CASH" | "CREDIT" }) {
  if (!method) return <span className="text-xs text-muted-foreground">-</span>;
  const styles =
    method === "CREDIT"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-[#3aa838]/10 text-[#2f8a2f] border-[#3aa838]/30";
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${styles}`}
    >
      {method}
    </span>
  );
}

/* --------------------------- LookupSelect --------------------------- */
function LookupSelect({
  value,
  selectedLabel,
  onPick,
  fetchOptions,
  placeholder,
  searchPlaceholder,
  disabled,
}: {
  value?: string;
  selectedLabel?: string;
  onPick: (option: LookupOption) => void;
  fetchOptions: (query: string) => Promise<LookupOption[]>;
  placeholder: string;
  searchPlaceholder: string;
  disabled?: boolean;
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
      if (cacheRef.current[key]) {
        setOptions(cacheRef.current[key]);
        return;
      }
      setLoading(true);
      try {
        const list = await fetchOptions(query);
        cacheRef.current[key] = list;
        setOptions(list);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [open, query, fetchOptions]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="h-10 w-full justify-between overflow-hidden bg-white disabled:opacity-60"
        >
          <span className="truncate">{selectedLabel || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? "Loading..." : "No result found."}
            </CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={`${opt.label} ${opt.description || ""}`}
                  onSelect={() => {
                    onPick(opt);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <Check
                    className={`mr-2 h-4 w-4 ${
                      opt.value === value ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{opt.label}</div>
                    {opt.description ? (
                      <div className="truncate text-xs text-muted-foreground">
                        {opt.description}
                      </div>
                    ) : null}
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

/* --------------------------- SectionHeader --------------------------- */
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
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#3aa838]/10 text-[#3aa838]">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold">{title}</div>
          {subtitle && (
            <div className="text-xs text-muted-foreground">{subtitle}</div>
          )}
        </div>
      </div>
      {right}
    </div>
  );
}

/* --------------------------- UploadTile --------------------------- */
function UploadTile({
  label,
  hint,
  onFile,
  disabled,
}: {
  label: string;
  hint: string;
  onFile: (f: File | null) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`block cursor-pointer rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center transition-colors hover:border-[#3aa838] hover:bg-[#3aa838]/5 ${
        disabled ? "pointer-events-none opacity-60" : ""
      }`}
    >
      <Upload className="mx-auto h-6 w-6 text-slate-400" />
      <div className="mt-2 text-xs font-medium text-slate-700">{label}</div>
      <div className="text-[10px] text-muted-foreground">{hint}</div>
      <input
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] || null)}
      />
    </label>
  );
}

/* =============================================================
   PRINT HELPERS  (unchanged)
   ============================================================= */
function buildSalesOrderPrintHtml(
  order: SalesOrderDetail,
  qrImageDataUrl: string,
  dealerName: string,
  dealerPhone: string,
  warehouseName: string,
  items: LineItem[],
  taxPercent: number,
  totals: any,
): string {
  const dateFmt = (d: any) =>
    d
      ? new Date(d).toLocaleDateString("en-IN", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "—";

  const invoiceNo =
    order.invoiceId?.invoiceNo || order.orderNo.replace(/^SO/, "INV");
  const paymentStatus = order.invoiceId?.paymentStatus || "UNPAID";

  const rowsHtml = items
    .map((item) => {
      const line = calcLine(item, taxPercent);
      return `
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:8px 10px; font-weight:600;">${item.productName || "-"}</td>
        <td style="padding:8px 10px; text-align:center;">${Number(item.qty || 0)}</td>
        <td style="padding:8px 10px; text-align:center;">${
          Number(item.bonusQty || 0) > 0 ? Number(item.bonusQty || 0) : "-"
        }</td>
        <td style="padding:8px 10px; text-align:right; font-family:monospace;">${Number(item.unitPrice || 0).toFixed(2)}</td>
        <td style="padding:8px 10px; text-align:right; font-family:monospace;">${line.lineSubtotal.toFixed(2)}</td>
        <td style="padding:8px 10px; text-align:right; font-family:monospace;">${line.taxAmount.toFixed(2)}</td>
        <td style="padding:8px 10px; text-align:right; font-weight:700; font-family:monospace;">${line.lineTotal.toFixed(2)}</td>
      </tr>`;
    })
    .join("");

  return `
<div style="font-family: 'Inter', sans-serif; max-width: 100%; margin: 0 auto; color: #1e293b; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.04);">
  <div style="background: linear-gradient(135deg, #0f172a, #1e293b); padding: 18px 28px; display: flex; justify-content: space-between; align-items: center; color: white;">
    <div>
      <div style="font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">SALES INVOICE</div>
      <div style="font-size: 13px; opacity: 0.9; margin-top: 2px;">
        ${order.paymentMethod === "CREDIT" ? "Credit Sale" : "Cash Sale"} · ${paymentStatus}
      </div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 22px; font-weight: 800;">#${invoiceNo}</div>
      <div style="font-size: 12px; opacity: 0.8;">${dateFmt(order.orderDate || order.createdAt)}</div>
      <div style="font-size: 11px; opacity: 0.7; margin-top: 2px;">Order: ${order.orderNo}</div>
    </div>
  </div>

  <div style="padding: 14px 28px; display: flex; gap: 16px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
    <div style="flex: 1; background: white; border-radius: 10px; padding: 10px 14px;">
      <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700;">Dealer</div>
      <div style="font-weight: 700; margin-top: 2px;">${dealerName}</div>
      <div style="font-size: 12px; color: #475569;">${dealerPhone}</div>
    </div>
    <div style="flex: 1; background: white; border-radius: 10px; padding: 10px 14px;">
      <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700;">Warehouse</div>
      <div style="font-weight: 700; margin-top: 2px;">${warehouseName}</div>
      <div style="font-size: 12px; color: #475569;">Dispatch location</div>
    </div>
    <div style="flex: 1; background: white; border-radius: 10px; padding: 10px 14px;">
      <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700;">Payment</div>
      <div style="font-weight: 700; margin-top: 2px; color: ${order.paymentMethod === "CREDIT" ? "#f59e0b" : "#16a34a"};">${order.paymentMethod}</div>
      <div style="font-size: 12px; color: #475569;">Grand Total: ৳ ${(order.grandTotal ?? 0).toFixed(2)}</div>
    </div>
  </div>

  <div style="padding: 16px 28px;">
    <h3 style="font-size: 16px; font-weight: 700; margin: 0 0 10px;">Items (${items.length})</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
      <thead>
        <tr style="background: #f1f5f9; font-weight: 700; color: #334155; text-transform: uppercase; font-size: 11px;">
          <th style="padding: 10px 12px; text-align: left;">Product</th>
          <th style="padding: 10px 12px; text-align: center;">Qty</th>
          <th style="padding: 10px 12px; text-align: center;">Bonus</th>
          <th style="padding: 10px 12px; text-align: right;">Unit Price</th>
          <th style="padding: 10px 12px; text-align: right;">Subtotal</th>
          <th style="padding: 10px 12px; text-align: right;">Tax</th>
          <th style="padding: 10px 12px; text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </div>

  <div style="display: flex; justify-content: flex-end; padding: 14px 28px; background: #f8fafc; border-top: 2px solid #e2e8f0;">
    <div style="width: 320px;">
      <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; border-bottom:1px solid #e2e8f0;">
        <span style="color:#475569;">Subtotal</span>
        <span style="font-weight:600;">৳ ${(order.subTotal ?? totals.subtotal).toFixed(2)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; border-bottom:1px solid #e2e8f0;">
        <span style="color:#475569;">Discount</span>
        <span style="font-weight:600; color:#dc2626;">- ৳ ${(order.totalDiscount ?? 0).toFixed(2)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; border-bottom:1px solid #e2e8f0;">
        <span style="color:#475569;">Tax (${taxPercent}%)</span>
        <span style="font-weight:600;">৳ ${(order.totalTax ?? 0).toFixed(2)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 8px 0; font-size: 16px; font-weight: 800;">
        <span>Grand Total</span>
        <span style="color:#0f172a;">৳ ${(order.grandTotal ?? 0).toFixed(2)}</span>
      </div>
      <div style="margin-top: 8px; padding: 6px 10px; background: ${order.paymentMethod === "CREDIT" ? "#fef3c7" : "#d1fae5"}; border-radius: 8px; font-size: 11px; text-align: center; color: ${order.paymentMethod === "CREDIT" ? "#92400e" : "#065f46"};">
        ${order.paymentMethod === "CREDIT" ? "This is a credit sale." : "This is a cash sale."} · Total bonus items: ${order.totalBonusQty || 0}
      </div>
    </div>
  </div>

  <div style="display: flex; gap: 16px; padding: 14px 28px; background: #f8fafc; border-top: 1px solid #e2e8f0;">
    <div style="flex: 1; background: white; border-radius: 10px; padding: 14px; text-align: center;">
      <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 8px;">QR Code</div>
      ${qrImageDataUrl ? `<img src="${qrImageDataUrl}" alt="QR" style="width:140px; height:140px; border:1px solid #e2e8f0; border-radius:10px;" />` : `<div style="width:140px; height:140px; border:2px dashed #cbd5e1; border-radius:10px; display:inline-flex; align-items:center; justify-content:center; color:#94a3b8; font-size:11px;">QR not ready</div>`}
      <div style="font-size: 10px; color: #94a3b8; margin-top: 6px;">Scan to verify</div>
    </div>
    <div style="flex: 2; background: white; border-radius: 10px; padding: 14px;">
      <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 8px;">Dealer Signature</div>
      <div style="height: 110px; border: 2px dashed #cbd5e1; border-radius: 10px; display: flex; align-items: flex-end; justify-content: center; padding: 10px; color: #94a3b8; font-size: 12px;">
        Sign here after receiving goods
      </div>
      <div style="font-size: 10px; color: #94a3b8; margin-top: 6px;">I confirm receipt of the above items in good condition.</div>
    </div>
  </div>

  <div style="background: #0f172a; color: #94a3b8; text-align: center; padding: 8px 28px; font-size: 10px; display: flex; justify-content: space-between;">
    <div>Computer‑generated invoice</div>
    <div>© Antab Agro LTD</div>
  </div>
</div>`;
}

function buildSalesOrderPrintHeaderRight(order: SalesOrderDetail): string {
  const paymentStatus = order.invoiceId?.paymentStatus || "UNPAID";
  return `
    <div style="text-align:right;">
      <div style="font-size: 20px; font-weight: 800; color: #0f172a;">#${order.orderNo}</div>
      <div style="font-size: 13px; color: #475569; margin-top: 2px;">
        ${order.paymentMethod === "CREDIT" ? "Credit Sale" : "Cash Sale"} · ${paymentStatus}
      </div>
      <div style="
        display: inline-block; background: ${order.status === "DELIVERED" ? "#065f46" : order.status === "CANCELLED" ? "#b91c1c" : "#1e40af"};
        color: white; padding: 4px 16px; border-radius: 100px; font-size: 13px; margin-top: 8px; font-weight: 700;
      ">${order.status.replaceAll("_", " ")}</div>
    </div>`;
}

function buildDCPrintHtml(
  order: SalesOrderDetail,
  dealerName: string,
  dealerPhone: string,
  warehouseName: string,
  items: LineItem[],
): string {
  const dateFmt = (d: any) =>
    d
      ? new Date(d).toLocaleDateString("en-IN", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "—";

  const rowsHtml = items
    .map((item, idx) => {
      return `
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:8px 10px;">${idx + 1}</td>
        <td style="padding:8px 10px; font-weight:600;">${item.productName || "-"}</td>
        <td style="padding:8px 10px; text-align:center;">${Number(item.qty || 0)}</td>
        <td style="padding:8px 10px; text-align:center;">${Number(item.bonusQty || 0) > 0 ? Number(item.bonusQty || 0) : "-"}</td>
        <td style="padding:8px 10px; text-align:center;">
          <div style="width:40px; height:24px; border:2px dashed #cbd5e1; border-radius:6px; display:inline-flex; align-items:center; justify-content:center; font-size:11px; color:#94a3b8;">/</div>
        </td>
        <td style="padding:8px 10px; text-align:center;">
          <div style="width:40px; height:24px; border:2px dashed #cbd5e1; border-radius:6px; display:inline-flex; align-items:center; justify-content:center; font-size:11px; color:#94a3b8;">/</div>
        </td>
      </tr>`;
    })
    .join("");

  return `
<div style="font-family: 'Inter', sans-serif; max-width: 100%; margin: 0 auto; color: #1e293b; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.04);">
  <div style="background: #1e293b; padding: 16px 28px; display: flex; justify-content: space-between; align-items: center; color: white;">
    <div>
      <div style="font-size: 22px; font-weight: 800;">DELIVERY CHALAN</div>
      <div style="font-size: 13px; opacity: 0.9;">Original / Duplicate</div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 18px; font-weight: 800;">DC #${order.orderNo}</div>
      <div style="font-size: 12px; opacity: 0.8;">Date: ${dateFmt(order.orderDate || order.createdAt)}</div>
    </div>
  </div>

  <div style="padding: 14px 28px; display: flex; gap: 16px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
    <div style="flex: 1; background: white; border-radius: 10px; padding: 10px 14px;">
      <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700;">Dealer</div>
      <div style="font-weight: 700;">${dealerName}</div>
      <div style="font-size: 12px; color: #475569;">${dealerPhone}</div>
    </div>
    <div style="flex: 1; background: white; border-radius: 10px; padding: 10px 14px;">
      <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700;">Warehouse</div>
      <div style="font-weight: 700;">${warehouseName}</div>
      <div style="font-size: 12px; color: #475569;">Dispatch Location</div>
    </div>
    <div style="flex: 1; background: white; border-radius: 10px; padding: 10px 14px;">
      <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700;">Vehicle / Driver</div>
      <div style="font-weight: 700; color: #94a3b8;">.............................</div>
      <div style="font-size: 12px; color: #475569;">Phone: .............................</div>
    </div>
  </div>

  <div style="padding: 16px 28px;">
    <h3 style="font-size: 16px; font-weight: 700; margin: 0 0 10px;">Items (${items.length})</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
      <thead>
        <tr style="background: #f1f5f9; font-weight: 700; color: #334155; text-transform: uppercase; font-size: 11px;">
          <th style="padding: 10px 8px; text-align: left;">#</th>
          <th style="padding: 10px 8px; text-align: left;">Product</th>
          <th style="padding: 10px 8px; text-align: center;">Qty</th>
          <th style="padding: 10px 8px; text-align: center;">Bonus</th>
          <th style="padding: 10px 8px; text-align: center;">Recv'd</th>
          <th style="padding: 10px 8px; text-align: center;">Remarks</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <div style="margin-top: 16px; font-size: 12px; color: #475569; border-top: 2px solid #e2e8f0; padding-top: 10px;">
      <strong>Total Qty:</strong> ${items.reduce((s, i) => s + Number(i.qty || 0), 0)} &nbsp;&nbsp;|&nbsp;&nbsp;
      <strong>Total Bonus:</strong> ${order.totalBonusQty || 0}
    </div>
  </div>

  <div style="display: flex; gap: 16px; padding: 14px 28px; background: #f8fafc; border-top: 1px solid #e2e8f0;">
    <div style="flex: 1; background: white; border-radius: 10px; padding: 12px; text-align: center;">
      <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 8px;">Prepared By</div>
      <div style="border-top: 2px solid #cbd5e1; margin-top: 28px; padding-top: 8px; font-size: 11px; color: #94a3b8;">(Signature / Name)</div>
    </div>
    <div style="flex: 1; background: white; border-radius: 10px; padding: 12px; text-align: center;">
      <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 8px;">Security Check</div>
      <div style="border-top: 2px solid #cbd5e1; margin-top: 28px; padding-top: 8px; font-size: 11px; color: #94a3b8;">(Signature / Name)</div>
    </div>
    <div style="flex: 1; background: white; border-radius: 10px; padding: 12px; text-align: center;">
      <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 8px;">Received By</div>
      <div style="border-top: 2px solid #cbd5e1; margin-top: 28px; padding-top: 8px; font-size: 11px; color: #94a3b8;">(Signature / Name)</div>
    </div>
  </div>

  <div style="background: #0f172a; color: #94a3b8; text-align: center; padding: 8px 28px; font-size: 10px;">
    Computer‑generated document · © Antab Agro LTD
  </div>
</div>`;
}

/* =============================================================
   MAIN PAGE COMPONENT
   ============================================================= */
export default function SalesOrderEditActionPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const orderId = params?.id;

  const {
    control,
    register,
    handleSubmit,
    getValues,
    setValue,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      customerId: "",
      warehouseId: "",
      orderDate: today,
      paymentMethod: "CASH",
      taxPercent: 0,
      notes: "",
      items: [makeLine()],
    },
  });

  // ⚠️ NOTE: `update` removed from destructuring — we now use setRow() which
  //    wraps setValue() to avoid remounting inputs on every keystroke.
  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "items",
  });

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
  const [deliveryVerification, setDeliveryVerification] = useState<any>(null);
  const [qrImageForPrint, setQrImageForPrint] = useState<string>("");

  const [dcFile, setDcFile] = useState<File | null>(null);
  const [dcUploadLoading, setDcUploadLoading] = useState(false);
  const [dcMediaId, setDcMediaId] = useState<string | null>(null);

  const promoTimers = useRef<Record<string, ReturnType<typeof setTimeout> | undefined>>({});
  const stockCache = useRef<Record<string, StockInfo>>({});
  const promoCache = useRef<Record<string, { bonusQty: number; appliedPromotionId: string | null }>>({});

  /* ---------- setRow — fixes qty focus loss ---------- */
  const setRow = useCallback(
    (index: number, patch: Partial<LineItem>) => {
      const row = getValues(`items.${index}`) as LineItem | undefined;
      if (!row) return;
      const next: LineItem = { ...row, ...patch };
      setValue(`items.${index}` as any, next, {
        shouldDirty: true,
        shouldTouch: true,
      });
    },
    [getValues, setValue],
  );

  /* ---------- Lookups ---------- */
  const fetchDealers = useCallback(async (search: string) => {
    const res = await api.get("/dealers", {
      params: { q: search || undefined, page: 1, limit: 20 },
    });
    return (res.data?.data || []).map((d: any) => ({
      value: String(d._id || d.id),
      label: d.name || d.proprietor || String(d._id || d.id),
      description: `${d.phoneNumber || d.phone || ""}${d.status ? ` · ${d.status}` : ""}`,
      status: d.status,
      dealerType: d.type,
      warehouseId: d.warehouse?._id ? String(d.warehouse._id) : undefined,
      warehouseName: d.warehouse?.name || undefined,
    })) as LookupOption[];
  }, []);

  const fetchWarehouses = useCallback(async (search: string) => {
    const res = await api.get("/warehouses", {
      params: { q: search || undefined, page: 1, limit: 20 },
    });
    return (res.data?.data || []).map((w: any) => ({
      value: String(w._id || w.id),
      label: w.name || String(w._id || w.id),
      description: w.code || w.type || "",
    })) as LookupOption[];
  }, []);

  const fetchProducts = useCallback(async (search: string) => {
    const res = await api.get("/products", {
      params: { q: search || undefined, page: 1, limit: 20 },
    });
    return (res.data?.data || []).map((p: any) => ({
      value: String(p._id || p.id),
      label: p.name || String(p._id || p.id),
      description: `${p.sku || ""}${p.salePrice || p.price ? ` · ${Number(p.salePrice ?? p.sale_price ?? p.price ?? 0)} BDT` : ""}`,
      salePrice: Number(p.salePrice ?? p.sale_price ?? p.price ?? 0),
      stock: Number(p.stock ?? 0),
      sku: p.sku,
    })) as LookupOption[];
  }, []);

  const fetchStockInfo = useCallback(
    async (productId: string, wId?: string): Promise<StockInfo> => {
      if (!productId || !wId) {
        return { quantity: 0, incomingTransfer: 0, reservedForSales: 0, reservedForTransfer: 0, availableToSell: 0 };
      }
      const cacheKey = `${productId}|${wId}`;
      if (stockCache.current[cacheKey]) return stockCache.current[cacheKey];
      try {
        const res = await api.get("/product-stocks", {
          params: { productId, warehouseId: wId, page: 1, limit: 1 },
        });
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
    },
    [],
  );

  const fetchPromo = useCallback(
    async (productId: string, qty: number, dId?: string, wId?: string) => {
      if (!productId || !qty || qty <= 0) return { bonusQty: 0, appliedPromotionId: null };
      const key = `${productId}|${qty}|${dId || ""}|${wId || ""}`;
      if (promoCache.current[key]) return promoCache.current[key];
      try {
        const res = await api.get("/promotions/calculate-bonus", {
          params: { productId, qty, customerId: dId, warehouseId: wId },
        });
        const data = res.data?.data || {};
        const result = {
          bonusQty: Number(data.bonusQty || 0),
          appliedPromotionId: (data.appliedPromotionId || null) as string | null,
        };
        promoCache.current[key] = result;
        return result;
      } catch {
        const fallback = { bonusQty: 0, appliedPromotionId: null };
        promoCache.current[key] = fallback;
        return fallback;
      }
    },
    [],
  );

  /* ---------- Permissions ---------- */
  const isEditable = useMemo(
    () =>
      !!order &&
      ["PENDING_AM", "PENDING_RM", "PENDING_NSM", "PENDING_FULFILLMENT"].includes(order.status),
    [order],
  );

  const canShip = order?.status === "PENDING_FULFILLMENT";
  const canDeliver = order?.status === "IN_SHIPPING";
  const canCancel = order ? !["DELIVERED", "CANCELLED"].includes(order.status) : false;

  /* ---------- Load order & map to form ---------- */
  const mapOrderToForm = useCallback(
    async (data: SalesOrderDetail) => {
      const customer = data.customerId;
      const warehouse = data.warehouseId;

      const nextItems: LineItem[] = (data.items || []).map((it: any) => ({
        productId: String(it.productId?._id || it.productId?.id || it.productId || ""),
        productName: it.productId?.name || it.name || it.productName || "",
        qty: Number(it.qty || 0),
        bonusQty: Number(it.bonusQty || 0),
        unitPrice: Number(it.unitPrice || 0),
        discountPercent: Number(it.discountPercent || 0),
        promoAppliedId: it.promotionId?._id || it.promotionId?.id || it.promotionId || null,
        quantity: 0,
        incomingTransfer: 0,
        reservedForSales: 0,
        reservedForTransfer: 0,
        availableToSell: 0,
      }));

      reset({
        customerId: String(customer?._id || customer?.id || ""),
        warehouseId: String(warehouse?._id || warehouse?.id || ""),
        orderDate: data.orderDate ? String(data.orderDate).slice(0, 10) : today,
        paymentMethod: data.paymentMethod || "CASH",
        taxPercent:
          Number(data.totalTax || 0) > 0 && Number(data.subTotal || 0) > 0
            ? Math.round((Number(data.totalTax || 0) / Number(data.subTotal || 1)) * 100)
            : 0,
        notes: data.notes || "",
        items: nextItems.length ? nextItems : [makeLine()],
      });

      setDealerMeta(
        customer
          ? {
              value: String(customer._id || customer.id || ""),
              label: customer.name || customer.proprietor || String(customer._id || customer.id || ""),
              description: `${customer.phoneNumber || customer.phone || ""}${customer.status ? ` · ${customer.status}` : ""}`,
              dealerType: customer.type,
              status: customer.status,
            }
          : null,
      );

      setWarehouseMeta(
        warehouse
          ? {
              value: String(warehouse._id || warehouse.id || ""),
              label: warehouse.name || String(warehouse._id || warehouse.id || ""),
              description: warehouse.code || warehouse.type || "",
            }
          : null,
      );
    },
    [reset],
  );

  const loadOrder = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const res = await api.get(`/sales-orders/${orderId}`);
      const data = res.data?.data || res.data;
      setOrder(data);
      await mapOrderToForm(data);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to load sales order.");
    } finally {
      setLoading(false);
    }
  }, [orderId, mapOrderToForm]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  /* ---------- Live credit summary ---------- */
  useEffect(() => {
    let active = true;
    (async () => {
      if (!customerId) {
        setCreditSummary(null);
        return;
      }
      setCreditLoading(true);
      try {
        const res = await api.get(`/dealers/${customerId}/credit-summary`);
        if (!active) return;
        const data = res.data?.data;
        setCreditSummary(
          data
            ? {
                dealerId: String(data.dealerId || customerId),
                dealerType: data.dealerType || dealerMeta?.dealerType || "CASH",
                creditLimit: Number(data.creditLimit || 0),
                currentDue: Number(data.currentDue ?? data.used ?? data.due ?? 0),
                used: Number(data.used ?? data.due ?? 0),
                due: Number(data.due ?? data.used ?? 0),
                available: Number(data.available || 0),
                canUseCredit: Boolean(data.canUseCredit),
              }
            : null,
        );
      } catch {
        if (active) setCreditSummary(null);
      } finally {
        if (active) setCreditLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [customerId, dealerMeta?.dealerType]);

  /* ---------- QR code generation ---------- */
  useEffect(() => {
    if (!order?.invoiceId) {
      setQrImage("");
      setQrImageForPrint("");
      setQrParsed(null);
      return;
    }
    const qrPayload = typeof order.invoiceId?.qrCode === "string" ? order.invoiceId.qrCode : "";
    if (!qrPayload) {
      setQrImage("");
      setQrImageForPrint("");
      setQrParsed(null);
      return;
    }

    try {
      const parsed = JSON.parse(qrPayload) as QrData;
      setQrParsed(parsed);
    } catch {
      setQrParsed(null);
    }

    let mounted = true;
    QRCode.toDataURL(qrPayload, { width: 220, margin: 2, errorCorrectionLevel: "M" })
      .then((dataUrl) => {
        if (mounted) {
          setQrImage(dataUrl);
          setQrImageForPrint(dataUrl);
        }
      })
      .catch(() => {
        if (mounted) {
          setQrImage("");
          setQrImageForPrint("");
        }
      });

    return () => {
      mounted = false;
    };
  }, [order?.invoiceId]);

  /* ---------- Refresh row ---------- */
  const refreshRowById = useCallback(
    async (fieldId: string, opts?: { stock?: boolean; promo?: boolean }) => {
      const index = fields.findIndex((f) => f.id === fieldId);
      if (index < 0) return;
      const row = getValues(`items.${index}`) as LineItem | undefined;
      if (!row || !row.productId) return;

      const next: Partial<LineItem> = {};
      if (opts?.stock !== false && warehouseId) {
        const stock = await fetchStockInfo(row.productId, warehouseId);
        next.quantity = stock.quantity;
        next.incomingTransfer = stock.incomingTransfer;
        next.reservedForSales = stock.reservedForSales;
        next.reservedForTransfer = stock.reservedForTransfer;
        next.availableToSell = stock.availableToSell;
      }
      if (opts?.promo !== false) {
        const promo = await fetchPromo(row.productId, Number(row.qty || 0), customerId || undefined, warehouseId || undefined);
        next.bonusQty = promo.bonusQty || 0;
        next.promoAppliedId = promo.appliedPromotionId;
      }
      setRow(index, next);
    },
    [fields, getValues, setRow, warehouseId, customerId, fetchStockInfo, fetchPromo],
  );

  const refreshAllRows = useCallback(async () => {
    await Promise.all(fields.map((f) => refreshRowById(f.id, { stock: true, promo: true })));
  }, [fields, refreshRowById]);

  useEffect(() => {
    void refreshAllRows();
  }, [warehouseId, customerId]); // eslint-disable-line

  /* ---------- Totals ---------- */
  const totals = useMemo(() => {
    const lineData = watchedItems.map((item) => calcLine(item, taxPercent));
    const totalQty = watchedItems.reduce((sum, item) => sum + Number(item.qty || 0), 0);
    const totalBonusQty = watchedItems.reduce((sum, item) => sum + Number(item.bonusQty || 0), 0);
    const subtotal = lineData.reduce((sum, row) => sum + row.lineSubtotal, 0);
    const totalDiscount = lineData.reduce((sum, row) => sum + row.discountAmount, 0);
    const totalTax = lineData.reduce((sum, row) => sum + row.taxAmount, 0);
    const grandTotal = subtotal + totalTax;
    return { lineData, totalQty, totalBonusQty, subtotal, totalDiscount, totalTax, grandTotal };
  }, [watchedItems, taxPercent]);

  /* ---------- Save ---------- */
  const updateOrder = useCallback(
    async (nextValues: FormValues) => {
      if (!orderId || !order) return;
      const items = nextValues.items.map((row) => {
        const line = calcLine(row, nextValues.taxPercent);
        return {
          productId: row.productId,
          warehouseId: nextValues.warehouseId,
          qty: Number(row.qty || 0),
          bonusQty: Number(row.bonusQty || 0),
          unitPrice: Number(row.unitPrice || 0),
          discountPercent: Number(row.discountPercent || 0),
          discountAmount: Number(line.discountAmount || 0),
          taxPercent: Number(nextValues.taxPercent || 0),
          taxAmount: Number(line.taxAmount || 0),
          lineSubtotal: Number(line.lineSubtotal || 0),
          lineTotal: Number(line.lineTotal || 0),
          ...(row.promoAppliedId ? { promotionId: row.promoAppliedId } : {}),
        };
      });
      const payload = {
        customerId: nextValues.customerId,
        warehouseId: nextValues.warehouseId,
        orderDate: nextValues.orderDate ? new Date(nextValues.orderDate).toISOString() : new Date().toISOString(),
        paymentMethod: nextValues.paymentMethod,
        items,
        subTotal: totals.subtotal,
        totalDiscount: totals.totalDiscount,
        totalTax: totals.totalTax,
        grandTotal: totals.grandTotal,
        totalBonusQty: totals.totalBonusQty,
        notes: nextValues.notes || "",
      };
      setSaving(true);
      try {
        const res = await api.put(`/sales-orders/${orderId}`, payload);
        const updated = res.data?.data || res.data;
        setOrder(updated);
        toast.success("Sales order updated successfully.");
        await loadOrder();
      } catch (err: any) {
        console.error(err);
        toast.error(err?.response?.data?.message || "Failed to update sales order.");
      } finally {
        setSaving(false);
      }
    },
    [orderId, order, totals, loadOrder],
  );

  /* ---------- Uploads ---------- */
  const uploadProofFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await api.post(MEDIA_UPLOAD_ENDPOINT, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
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
    if (!orderId || !currentApprovalRole) return;
    setSavingAction("approve");
    try {
      await api.post(`/sales-orders/${orderId}/approve`, { role: currentApprovalRole, remarks });
      toast.success(`${currentApprovalRole} approved.`);
      setRemarks("");
      await loadOrder();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to approve order.");
    } finally {
      setSavingAction(null);
    }
  };

  const handleShip = async () => {
    if (!orderId) return;
    if (!confirm("Create invoice and move this order to fulfillment?")) return;
    setSavingAction("ship");
    try {
      await api.post(`/sales-orders/${orderId}/ship`);
      toast.success("Invoice created.");
      await loadOrder();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to ship order.");
    } finally {
      setSavingAction(null);
    }
  };

  const handleCancel = async () => {
    if (!orderId) return;
    if (!confirm("Cancel this sales order?")) return;
    setSavingAction("cancel");
    try {
      await api.post(`/sales-orders/${orderId}/cancel`);
      toast.success("Order cancelled.");
      await loadOrder();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to cancel order.");
    } finally {
      setSavingAction(null);
    }
  };

  const handleDeliver = async () => {
    if (!orderId) return;
    if (!proofFile) {
      toast.error("Please upload the signed invoice first.");
      return;
    }
    setSavingAction("deliver");
    setProofUploading(true);
    try {
      const uploadedDocumentFileId = await uploadProofFile(proofFile);
      const res = await api.post(`/sales-orders/${orderId}/deliver`, { uploadedDocumentFileId });
      const data = res.data?.data || res.data;
      if (data?.verification) setDeliveryVerification(data.verification);
      toast.success("Delivery approved.");
      setProofFile(null);
      await loadOrder();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to deliver order.");
    } finally {
      setProofUploading(false);
      setSavingAction(null);
    }
  };

  const handleDCUpload = async () => {
    if (!dcFile) {
      toast.error("Select a DC file first");
      return;
    }
    setDcUploadLoading(true);
    try {
      const mediaId = await uploadProofFile(dcFile);
      setDcMediaId(mediaId);
      toast.success("Delivery Chalan uploaded.");
    } catch (err: any) {
      toast.error(err?.message || "DC upload failed");
    } finally {
      setDcUploadLoading(false);
    }
  };

  /* ---------- Event handlers ---------- */
  const onPickDealer = async (opt: LookupOption) => {
    setValue("customerId", opt.value, { shouldDirty: true, shouldTouch: true });
    setDealerMeta(opt);
    setCreditSummary(null);

    // ⭐ Auto-select warehouse from dealer (user can still change it)
    if (opt.warehouseId) {
      setValue("warehouseId", opt.warehouseId, {
        shouldDirty: true,
        shouldTouch: true,
      });
      setWarehouseMeta({
        value: opt.warehouseId,
        label: opt.warehouseName || "",
        description: "Auto-selected from dealer",
      });
    }

    await refreshAllRows();
  };

  const onPickWarehouse = async (opt: LookupOption) => {
    setValue("warehouseId", opt.value, { shouldDirty: true, shouldTouch: true });
    setWarehouseMeta(opt);
    await refreshAllRows();
  };

  const onPickProduct = async (index: number, opt: LookupOption) => {
    const row = getValues(`items.${index}`) as LineItem | undefined;
    if (!row) return;
    const stock = warehouseId
      ? await fetchStockInfo(opt.value, warehouseId)
      : {
          quantity: Number(opt.stock || 0),
          incomingTransfer: 0,
          reservedForSales: 0,
          reservedForTransfer: 0,
          availableToSell: Number(opt.stock || 0),
        };
    const promo = await fetchPromo(opt.value, Number(row.qty || 0), customerId || undefined, warehouseId || undefined);
    setRow(index, {
      productId: opt.value,
      productName: opt.label,
      unitPrice: Number(opt.salePrice || 0),
      quantity: stock.quantity,
      incomingTransfer: stock.incomingTransfer,
      reservedForSales: stock.reservedForSales,
      reservedForTransfer: stock.reservedForTransfer,
      availableToSell: stock.availableToSell,
      bonusQty: promo.bonusQty || 0,
      promoAppliedId: promo.appliedPromotionId,
    });
  };

  const onQtyChange = (index: number, qty: number) => {
    // ⭐ setRow (setValue) instead of update() → no remount, no focus loss
    setRow(index, { qty: Math.max(0, qty) });
    const fieldId = fields[index]?.id;
    if (!fieldId) return;
    const existingTimer = promoTimers.current[fieldId];
    if (existingTimer) clearTimeout(existingTimer);
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
    if (fieldId && promoTimers.current[fieldId]) {
      clearTimeout(promoTimers.current[fieldId]);
      delete promoTimers.current[fieldId];
    }
    if (fields.length === 1) {
      replace([makeLine()]);
      return;
    }
    remove(index);
  };

  const saveChanges = async () => {
    await handleSubmit(updateOrder)();
  };

  /* ---------- Loading / not-found ---------- */
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading sales order...
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Card className="w-full max-w-lg">
          <CardContent className="p-6 text-center">
            <div className="text-lg font-semibold">Sales order not found</div>
            <div className="mt-2 text-sm text-muted-foreground">
              The requested record may have been removed or the URL is invalid.
            </div>
            <Button className="mt-4" onClick={() => router.push("/sales-orders")}>
              Back to list
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const invoice = order.invoiceId || null;
  const dealerSignatureId =
    dealerMeta?.value ||
    order?.customerId?.attachments?.required?.signature?._id ||
    order?.customerId?.attachments?.required?.signature?.id ||
    order?.customerId?.attachments?.required?.signature ||
    "";

  const dealerName = dealerMeta?.label || order.customerId?.name || order.customerId?.proprietor || "-";
  const dealerPhone = order.customerId?.phoneNumber || order.customerId?.phone || "-";
  const warehouseName = warehouseMeta?.label || order.warehouseId?.name || "-";

  const printCompany = {
    name: "Antab Agro LTD",
    address: "123 Agro Street, Dhaka",
    phone: "+880 1711-111111",
    email: "info@antabagro.com",
  };

  /* ---------- Workflow stepper helpers ---------- */
  const approvalFlow: OrderStatus[] = [
    "PENDING_AM",
    "PENDING_RM",
    "PENDING_NSM",
    "PENDING_FULFILLMENT",
    "IN_SHIPPING",
    "DELIVERED",
  ];
  const statusIndex = approvalFlow.indexOf(order.status);
  const isFinalFailed = ["REJECTED", "CANCELLED"].includes(order.status);
  const lastFailedStep = isFinalFailed
    ? (order.approvalLogs
        ?.map((l) => approvalFlow.indexOf(l.role as OrderStatus))
        .filter((i) => i >= 0)
        .sort((a, b) => b - a)[0] ?? -1)
    : -1;

  const stepState = (i: number): "done" | "active" | "pending" => {
    if (order.status === "DELIVERED") return "done";
    if (isFinalFailed) return i <= lastFailedStep ? "done" : "pending";
    if (statusIndex < 0) return "pending";
    if (i < statusIndex) return "done";
    if (i === statusIndex) return "active";
    return "pending";
  };

  const creditLimit = Number(order.creditSnapshot?.creditLimit || 0);
  const creditUsed = Number(order.creditSnapshot?.used || 0);
  const creditPct = creditLimit > 0 ? Math.min(100, (creditUsed / creditLimit) * 100) : 0;
  const creditDanger = creditPct > 80;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl p-4 md:p-6">
        {/* ---------- HERO ---------- */}
        <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-[#1a4d1a] p-6 text-white shadow-lg">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(58,168,56,0.25),transparent_55%)]" />
          <div className="relative">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-white/60">
                  Sales Order · Edit / Act
                </div>
                <h1 className="mt-1 text-3xl font-bold tracking-tight tabular-nums">
                  {order.orderNo}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusBadge status={order.status} />
                  <PaymentBadge method={order.paymentMethod} />
                  {invoice && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium ring-1 ring-white/15">
                      <FileText className="h-3 w-3" />
                      {invoice.invoiceNo}
                    </span>
                  )}
                  <span className="text-xs text-white/60">
                    {fmtDate(order.createdAt || order.orderDate)}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void loadOrder()}
                  className="border border-white/20 bg-white/10 text-white hover:bg-white/20"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>

                {isEditable && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={saveChanges}
                    disabled={saving || isSubmitting}
                    className="border border-white/20 bg-white/10 text-white hover:bg-white/20"
                  >
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save
                  </Button>
                )}

                {currentApprovalRole && (
                  <Button
                    size="sm"
                    className="bg-[#3aa838] text-white hover:bg-[#2f8a2f]"
                    onClick={() => void handleApprove()}
                    disabled={savingAction === "approve"}
                  >
                    {savingAction === "approve" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="mr-2 h-4 w-4" />
                    )}
                    Approve {currentApprovalRole}
                  </Button>
                )}

                {canShip && (
                  <Button
                    size="sm"
                    className="bg-[#3aa838] text-white hover:bg-[#2f8a2f]"
                    onClick={() => void handleShip()}
                  >
                    {savingAction === "ship" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Truck className="mr-2 h-4 w-4" />
                    )}
                    Ship
                  </Button>
                )}

                {invoice && (
                  <GlobalPrintButton
                    contentHtml={buildSalesOrderPrintHtml(
                      order, qrImageForPrint, dealerName, dealerPhone,
                      warehouseName, watchedItems, taxPercent, totals,
                    )}
                    headerRightHtml={buildSalesOrderPrintHeaderRight(order)}
                    label="Print Invoice"
                    title="Sales Invoice"
                    orientation="portrait"
                    company={printCompany}
                    showHeader={false}
                    showFooter={false}
                  />
                )}

                {canCancel && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="border border-rose-500/30 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25"
                    onClick={() => void handleCancel()}
                  >
                    {savingAction === "cancel" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Ban className="mr-2 h-4 w-4" />
                    )}
                    Cancel
                  </Button>
                )}
              </div>
            </div>

            {/* Quick info pills */}
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg bg-white/10 px-3 py-2 ring-1 ring-white/15 backdrop-blur-sm">
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-white/60">
                  <Building2 className="h-3 w-3" />
                  Dealer
                </div>
                <div className="mt-0.5 truncate text-sm font-semibold">{dealerName}</div>
                <div className="truncate text-[11px] text-white/60">{dealerPhone}</div>
              </div>
              <div className="rounded-lg bg-white/10 px-3 py-2 ring-1 ring-white/15 backdrop-blur-sm">
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-white/60">
                  <WarehouseIcon className="h-3 w-3" />
                  Warehouse
                </div>
                <div className="mt-0.5 truncate text-sm font-semibold">{warehouseName}</div>
                <div className="truncate text-[11px] text-white/60">
                  {warehouseMeta?.description || ""}
                </div>
              </div>
              <div className="rounded-lg bg-white/10 px-3 py-2 ring-1 ring-white/15 backdrop-blur-sm">
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-white/60">
                  <Calendar className="h-3 w-3" />
                  Order date
                </div>
                <div className="mt-0.5 text-sm font-semibold">
                  {fmtDate(order.orderDate || order.createdAt)}
                </div>
              </div>
              <div className="rounded-lg bg-[#3aa838] px-3 py-2 shadow-md shadow-black/40">
                <div className="text-[10px] uppercase tracking-wide text-[#c6e8c5]">
                  Grand total
                </div>
                <div className="mt-0.5 text-base font-bold tabular-nums">
                  ৳ {money(order.grandTotal ?? totals.grandTotal)}
                </div>
                <div className="text-[11px] text-[#c6e8c5]">{order.paymentMethod}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ---------- BODY ---------- */}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          {/* ============ LEFT ============ */}
          <div className="space-y-6">
            {/* Order basics */}
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <SectionHeader
                icon={Receipt}
                title="Order basics"
                subtitle="Dealer, warehouse, date, payment"
              />
              <CardContent className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                    <Building2 className="h-3.5 w-3.5" />
                    Dealer
                  </label>
                  <LookupSelect
                    value={customerId}
                    selectedLabel={dealerMeta?.label}
                    onPick={onPickDealer}
                    fetchOptions={fetchDealers}
                    placeholder="Search dealer"
                    searchPlaceholder="Type dealer name / phone..."
                    disabled={!isEditable}
                  />
                  <div className="text-[11px] text-muted-foreground">
                    {dealerMeta?.description || "Open to load dealers."}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                    <Package className="h-3.5 w-3.5" />
                    Warehouse
                  </label>
                  <LookupSelect
                    value={warehouseId}
                    selectedLabel={warehouseMeta?.label}
                    onPick={onPickWarehouse}
                    fetchOptions={fetchWarehouses}
                    placeholder="Search warehouse"
                    searchPlaceholder="Type warehouse name..."
                    disabled={!isEditable}
                  />
                  <div className="text-[11px] text-muted-foreground">
                    {warehouseMeta?.description || "Auto-selected from dealer when available."}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                    <Calendar className="h-3.5 w-3.5" />
                    Order date
                  </label>
                  <Input type="date" {...register("orderDate")} disabled={!isEditable} className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                    <CreditCard className="h-3.5 w-3.5" />
                    Payment method
                  </label>
                  <select
                    {...register("paymentMethod")}
                    disabled={!isEditable}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3aa838] disabled:opacity-50"
                  >
                    <option value="CASH">Cash</option>
                    <option value="CREDIT">Credit</option>
                  </select>
                  <div className="text-[11px] text-muted-foreground">
                    Credit orders validated against dealer summary.
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Items */}
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <SectionHeader
                icon={Package}
                title="Order items"
                subtitle={`${fields.length} line item${fields.length === 1 ? "" : "s"}`}
                right={
                  isEditable ? (
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={addRow}>
                        <Plus className="mr-1.5 h-4 w-4" /> Add item
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void refreshAllRows()}
                        disabled={!customerId || !warehouseId}
                      >
                        <RefreshCw className="mr-1.5 h-4 w-4" /> Refresh
                      </Button>
                    </div>
                  ) : null
                }
              />
              <CardContent className="space-y-4 p-5">
                {fields.map((field, index) => {
                  const row = watchedItems[index] || makeLine();
                  const line = calcLine(row, taxPercent);
                  const lowStock = Number(row.availableToSell || 0) < Number(row.qty || 0);
                  return (
                    <div
                      key={field.id}
                      className={`rounded-xl border-2 bg-white p-4 transition-colors ${
                        lowStock
                          ? "border-rose-300 bg-rose-50/40"
                          : "border-slate-200 hover:border-[#3aa838]/50"
                      }`}
                    >
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                            {index + 1}
                          </span>
                          <div>
                            <div className="text-sm font-semibold">
                              {row.productName || "New item"}
                            </div>
                            {row.promoAppliedId ? (
                              <div className="flex items-center gap-1 text-[11px] font-medium text-[#3aa838]">
                                <Sparkles className="h-3 w-3" /> Promotion applied
                              </div>
                            ) : (
                              <div className="text-[11px] text-muted-foreground">
                                Select a product to begin
                              </div>
                            )}
                          </div>
                        </div>
                        {isEditable && (
                          <div className="flex gap-1">
                            <Button type="button" variant="ghost" size="sm" onClick={() => duplicateRow(index)}>
                              <Copy className="mr-1 h-3.5 w-3.5" /> Duplicate
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeRow(index)}
                              className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                            >
                              <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="grid gap-3 md:grid-cols-12">
                        <div className="space-y-1.5 md:col-span-5">
                          <label className="text-xs font-medium text-slate-600">Product</label>
                          <LookupSelect
                            value={row.productId}
                            selectedLabel={row.productName || undefined}
                            onPick={(opt) => onPickProduct(index, opt)}
                            fetchOptions={fetchProducts}
                            placeholder="Search product"
                            searchPlaceholder="Type product name / SKU..."
                            disabled={!isEditable}
                          />
                          <div className="text-[11px] text-muted-foreground">
                            {row.productName ? `Unit price: ৳ ${money(row.unitPrice)}` : "Open to search products."}
                          </div>
                        </div>

                        <div className="space-y-1.5 md:col-span-3">
                          <label className="text-xs font-medium text-slate-600">Quantity</label>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-10 w-9 shrink-0"
                              disabled={!isEditable}
                              onClick={() => onQtyChange(index, Math.max(0, Number(row.qty || 0) - 1))}
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                            <Input
                              type="number"
                              min={0}
                              value={row.qty}
                              onChange={(e) => onQtyChange(index, Number(e.target.value || 0))}
                              disabled={!isEditable}
                              className="h-10 flex-1 text-center text-sm font-semibold tabular-nums"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-10 w-9 shrink-0"
                              disabled={!isEditable}
                              onClick={() => onQtyChange(index, Number(row.qty || 0) + 1)}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <div
                            className={`flex items-center gap-1 text-[11px] font-medium ${
                              lowStock ? "text-rose-600" : "text-[#3aa838]"
                            }`}
                          >
                            {lowStock ? (
                              <>
                                <AlertTriangle className="h-3 w-3" /> Only {Number(row.availableToSell || 0)} sellable
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-3 w-3" /> {Number(row.availableToSell || 0)} sellable
                              </>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1.5 md:col-span-1">
                          <label className="text-xs font-medium text-slate-600">Bonus</label>
                          <div className="flex h-10 items-center justify-center rounded-md border border-[#3aa838]/30 bg-[#3aa838]/10 px-2 text-sm font-semibold tabular-nums text-[#2f8a2f]">
                            {Number(row.bonusQty || 0)}
                          </div>
                        </div>

                        <div className="space-y-1.5 md:col-span-1">
                          <label className="text-xs font-medium text-slate-600">Disc %</label>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={row.discountPercent}
                            onChange={(e) => setRow(index, { discountPercent: Number(e.target.value || 0) })}
                            disabled={!isEditable}
                            className="h-10 text-center tabular-nums"
                          />
                        </div>

                        <div className="space-y-1.5 md:col-span-2">
                          <label className="text-xs font-medium text-slate-600">Line total</label>
                          <div className="flex h-10 items-center justify-end rounded-md border border-[#3aa838]/30 bg-[#3aa838]/10 px-3 text-sm font-bold tabular-nums text-[#2f8a2f]">
                            ৳ {money(line.lineTotal)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                        <span>In stock: <b className="tabular-nums">{row.quantity}</b></span>
                        <span className="text-slate-300">•</span>
                        <span>Incoming: <b className="tabular-nums">{row.incomingTransfer}</b></span>
                        <span className="text-slate-300">•</span>
                        <span>Reserved sales: <b className="tabular-nums">{row.reservedForSales}</b></span>
                        <span className="text-slate-300">•</span>
                        <span>Reserved transfer: <b className="tabular-nums">{row.reservedForTransfer}</b></span>
                        <span className="ml-auto rounded bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 ring-1 ring-slate-200">
                          Subtotal ৳ {money(line.lineSubtotal)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Notes */}
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <SectionHeader
                icon={FileText}
                title="Notes"
                subtitle="Internal remarks, delivery notes, special instructions"
              />
              <CardContent className="p-5">
                <textarea
                  {...register("notes")}
                  rows={4}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3aa838] disabled:opacity-50"
                  placeholder="Anything the team should know about this order..."
                  disabled={!isEditable}
                />
              </CardContent>
            </Card>

            {/* Approval stepper + activity log */}
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <SectionHeader
                icon={CheckCircle2}
                title="Approval progress"
                subtitle="Track the order through the workflow"
              />
              <CardContent className="p-5">
                <div className="overflow-x-auto pb-2">
                  <div className="flex min-w-max items-start justify-between">
                    {approvalFlow.map((step, i) => {
                      const state = stepState(i);
                      const circleClass =
                        state === "done"
                          ? "bg-[#3aa838] text-white"
                          : state === "active"
                            ? "bg-[#3aa838] text-white ring-4 ring-[#3aa838]/20"
                            : "bg-slate-200 text-slate-500";
                      const labelClass =
                        state === "done" || state === "active"
                          ? "font-semibold text-slate-900"
                          : "text-slate-500";
                      const connectorDone = state === "done" || order.status === "DELIVERED";
                      return (
                        <React.Fragment key={step}>
                          <div className="flex min-w-[70px] flex-col items-center gap-1.5">
                            <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all ${circleClass}`}>
                              {state === "done" ? <Check className="h-4 w-4" /> : i + 1}
                            </div>
                            <div className={`max-w-[70px] truncate text-center text-[10px] uppercase tracking-wide ${labelClass}`}>
                              {step.replaceAll("_", " ")}
                            </div>
                          </div>
                          {i < approvalFlow.length - 1 && (
                            <div className={`mx-1 mt-4 h-0.5 flex-1 rounded ${connectorDone ? "bg-[#3aa838]" : "bg-slate-200"}`} />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>

                {isFinalFailed && (
                  <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
                    Order was {order.status.toLowerCase()}.
                  </div>
                )}

                {order.approvalLogs && order.approvalLogs.length > 0 ? (
                  <div className="mt-5 space-y-2 border-t border-slate-200 pt-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Activity</div>
                    {order.approvalLogs.map((log, i) => {
                      const approved = (log.status || "").toUpperCase() === "APPROVED";
                      return (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <div className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${approved ? "bg-[#3aa838]/10" : "bg-rose-50"}`}>
                            <Check className={`h-3 w-3 ${approved ? "text-[#3aa838]" : "text-rose-500"}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-1.5">
                              <span className="font-medium">{log.role?.replaceAll("_", " ") || "Step"}</span>
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                  approved ? "bg-[#3aa838]/10 text-[#2f8a2f]" : "bg-rose-50 text-rose-700"
                                }`}
                              >
                                {log.status}
                              </span>
                              <span className="text-xs text-muted-foreground">{fmtDate(log.actionDate)}</span>
                            </div>
                            {log.remarks && (
                              <div className="mt-0.5 text-xs text-muted-foreground">{log.remarks}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-5 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-muted-foreground">
                    No approval actions recorded yet.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ============ RIGHT ============ */}
          <div className="h-fit space-y-6 lg:sticky lg:top-6">
            {/* Summary */}
            <Card className="overflow-hidden border-slate-200 shadow-md">
              <SectionHeader icon={Wallet} title="Summary" />
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Qty</span>
                  <span className="font-medium tabular-nums">{totals.totalQty}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Bonus qty</span>
                  <span className="font-medium tabular-nums">{totals.totalBonusQty}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Sub total</span>
                  <span className="font-medium tabular-nums">{money(order.subTotal ?? totals.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="font-medium tabular-nums text-rose-600">- {money(order.totalDiscount)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="font-medium tabular-nums">{money(order.totalTax)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                  <span className="text-sm font-semibold">Grand total</span>
                  <span className="text-xl font-extrabold tabular-nums text-[#2f8a2f]">
                    ৳ {money(order.grandTotal ?? totals.grandTotal)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Credit summary */}
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <SectionHeader icon={TrendingUp} title="Credit summary" />
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Credit limit</span>
                  <span className="font-medium tabular-nums">{money(order.creditSnapshot?.creditLimit)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Used</span>
                  <span className="font-medium tabular-nums">{money(order.creditSnapshot?.used)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Available</span>
                  <span className="font-bold tabular-nums text-[#3aa838]">
                    {money(order.creditSnapshot?.available)}
                  </span>
                </div>

                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full transition-all ${creditDanger ? "bg-rose-500" : "bg-[#3aa838]"}`}
                    style={{ width: `${creditPct}%` }}
                  />
                </div>
                <div className="text-[10px] text-muted-foreground">{creditPct.toFixed(1)}% of limit used</div>

                {creditLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading live credit...
                  </div>
                ) : creditSummary ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                    <div className="mb-1 font-semibold text-slate-700">Live dealer credit</div>
                    <div className="space-y-0.5 text-slate-600">
                      <div>Current due: {money(creditSummary.currentDue)}</div>
                      <div>Available: {money(creditSummary.available)}</div>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {/* Invoice & QR */}
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <SectionHeader icon={Receipt} title="Invoice" />
              <CardContent className="space-y-4 p-5">
                {invoice ? (
                  <>
                    <div className="rounded-lg border border-[#3aa838]/20 bg-[#3aa838]/5 p-4">
                      <div className="text-[10px] uppercase tracking-wide text-[#2f8a2f]">Invoice No</div>
                      <div className="mt-0.5 font-semibold text-slate-900">{invoice.invoiceNo || "-"}</div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <div className="text-muted-foreground">Date</div>
                          <div className="font-medium">{fmtDate(invoice.invoiceDate || order.createdAt)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Payment</div>
                          <div className="font-medium">{invoice.paymentStatus || "UNPAID"}</div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white p-4 text-center">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">QR Code</div>
                      <div className="mt-3 flex justify-center">
                        {qrImage ? (
                          <img src={qrImage} alt="Invoice QR" className="h-48 w-48 rounded border border-slate-200" />
                        ) : (
                          <div className="flex h-48 w-48 items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 text-xs text-muted-foreground">
                            QR not ready
                          </div>
                        )}
                      </div>
                      <div className="mt-2 text-[10px] text-muted-foreground">Scan to verify</div>
                    </div>

                    {qrParsed && (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                        <div className="font-semibold text-slate-900">Decoded data</div>
                        <div className="mt-2 space-y-1 text-slate-600">
                          <div>
                            <span className="text-muted-foreground">Dealer:</span>{" "}
                            <span className="font-medium">{qrParsed?.dealer?.name}</span> ({qrParsed?.dealer?.code})
                          </div>
                          <div>
                            <span className="text-muted-foreground">Phone:</span> {qrParsed?.dealer?.phone}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Credit:</span>{" "}
                            {money(qrParsed?.dealer?.creditLimit)} limit / {money(qrParsed?.dealer?.available)} avail
                          </div>
                        </div>
                        {qrParsed?.products && qrParsed.products.length > 0 && (
                          <div className="mt-2 border-t border-slate-200 pt-2">
                            <div className="font-semibold text-slate-900">Products</div>
                            <div className="mt-1 space-y-0.5 text-slate-600">
                              {qrParsed.products.map((p, i) => (
                                <div key={i} className="truncate">
                                  {p.name} · {p.qty} × {money(p.unitPrice)}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Dealer signature template
                      </div>
                      <div className="mt-2 text-sm">
                        {dealerSignatureId ? (
                          <div className="rounded border border-[#3aa838]/30 bg-[#3aa838]/5 p-2 font-mono text-xs text-[#2f8a2f]">
                            {String(dealerSignatureId)}
                          </div>
                        ) : (
                          <div className="text-muted-foreground">No dealer signature uploaded.</div>
                        )}
                      </div>
                    </div>

                    <GlobalPrintButton
                      contentHtml={buildSalesOrderPrintHtml(
                        order, qrImageForPrint, dealerName, dealerPhone,
                        warehouseName, watchedItems, taxPercent, totals,
                      )}
                      headerRightHtml={buildSalesOrderPrintHeaderRight(order)}
                      label="Print Invoice"
                      title="Sales Invoice"
                      orientation="portrait"
                      company={printCompany}
                      showHeader={false}
                      showFooter={false}
                    />
                  </>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
                    <FileText className="mx-auto h-8 w-8 text-slate-300" />
                    <div className="mt-2 text-sm font-medium text-slate-700">No invoice yet</div>
                    <div className="mt-1 text-xs text-muted-foreground">Use Ship to generate the invoice.</div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Delivery Chalan */}
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <SectionHeader icon={FileText} title="Delivery Chalan (DC)" />
              <CardContent className="space-y-4 p-5">
                <GlobalPrintButton
                  contentHtml={buildDCPrintHtml(order, dealerName, dealerPhone, warehouseName, watchedItems)}
                  headerRightHtml={`<div style="text-align:right;"><div style="font-size:20px;font-weight:800;color:#0f172a;">DC #${order.orderNo}</div></div>`}
                  label="Print D.C."
                  title="Delivery Chalan"
                  orientation="portrait"
                  company={printCompany}
                  showHeader={false}
                  showFooter={false}
                />

                <div className="text-xs text-muted-foreground">
                  Upload the signed DC (optional).
                </div>

                <UploadTile
                  label="Click to upload DC"
                  hint="PDF or image"
                  onFile={setDcFile}
                />

                {dcFile && (
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs">
                    <span className="text-muted-foreground">Selected:</span>{" "}
                    <span className="font-medium">{dcFile.name}</span>
                  </div>
                )}

                <Button
                  type="button"
                  className="w-full bg-[#3aa838] text-white hover:bg-[#2f8a2f]"
                  onClick={handleDCUpload}
                  disabled={dcUploadLoading || !dcFile}
                >
                  {dcUploadLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Upload DC
                </Button>

                {dcMediaId && (
                  <div className="rounded-lg border border-[#3aa838]/30 bg-[#3aa838]/10 p-3">
                    <div className="flex items-center gap-1 text-sm font-medium text-[#2f8a2f]">
                      <CheckCircle2 className="h-4 w-4" /> DC uploaded
                    </div>
                    <div className="mt-1 truncate font-mono text-[10px] text-[#2f8a2f]">
                      {dcMediaId}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Approval remarks */}
            {currentApprovalRole && (
              <Card className="overflow-hidden border-[#3aa838]/30 shadow-md ring-2 ring-[#3aa838]/10">
                <SectionHeader
                  icon={ShieldCheck}
                  title="Approval remarks"
                  subtitle={`Approve as ${currentApprovalRole}`}
                />
                <CardContent className="space-y-3 p-5">
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3aa838]"
                    placeholder="Optional remarks before approval..."
                  />
                  <Button
                    type="button"
                    className="w-full bg-[#3aa838] text-white hover:bg-[#2f8a2f]"
                    onClick={() => void handleApprove()}
                    disabled={savingAction === "approve"}
                  >
                    {savingAction === "approve" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="mr-2 h-4 w-4" />
                    )}
                    Approve {currentApprovalRole}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Delivery verification */}
            {canDeliver && (
              <Card className="overflow-hidden border-[#3aa838]/30 shadow-md ring-2 ring-[#3aa838]/10">
                <SectionHeader
                  icon={Truck}
                  title="Delivery verification"
                  subtitle="Upload signed invoice to complete delivery"
                />
                <CardContent className="space-y-4 p-5">
                  <div className="rounded-lg border border-[#3aa838]/20 bg-[#3aa838]/5 p-3 text-xs text-[#2f8a2f]">
                    Upload the signed invoice. The backend will verify the QR and dealer signature before approving delivery.
                  </div>

                  <UploadTile
                    label="Click to upload signed invoice"
                    hint="PDF or image"
                    onFile={setProofFile}
                  />

                  {proofFile && (
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs">
                      <span className="text-muted-foreground">Selected:</span>{" "}
                      <span className="font-medium">{proofFile.name}</span>
                    </div>
                  )}

                  <Button
                    type="button"
                    className="w-full bg-[#3aa838] text-white hover:bg-[#2f8a2f]"
                    onClick={() => void handleDeliver()}
                    disabled={proofUploading || savingAction === "deliver" || !proofFile}
                  >
                    {proofUploading || savingAction === "deliver" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                    )}
                    Verify and deliver
                  </Button>

                  {deliveryVerification && (
                    <div className="rounded-lg border border-[#3aa838]/30 bg-[#3aa838]/10 p-3">
                      <div className="flex items-center gap-1 text-sm font-medium text-[#2f8a2f]">
                        <CheckCircle2 className="h-4 w-4" /> Delivery verified
                      </div>
                      <div className="mt-1 text-xs text-[#2f8a2f]">
                        Signature similarity:{" "}
                        {((deliveryVerification.signatureSimilarity || 0) * 100).toFixed(1)}%
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}