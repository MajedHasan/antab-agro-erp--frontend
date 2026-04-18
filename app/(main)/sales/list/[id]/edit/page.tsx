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
import {
  Check,
  ChevronsUpDown,
  Loader2,
  Plus,
  Trash2,
  RefreshCw,
  Printer,
  Upload,
  Ban,
  Save,
  ShieldCheck,
  Truck,
  Copy,
} from "lucide-react";

type LookupOption = {
  value: string;
  label: string;
  description?: string;
  status?: string;
  dealerType?: "CASH" | "CREDIT";
  salePrice?: number;
  stock?: number;
  sku?: string;
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

const MEDIA_UPLOAD_ENDPOINT =
  "/media/upload?module=sales-order&folder=signed-documents"; // change only if your upload route differs

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

function StatusBadge({ status }: { status: OrderStatus }) {
  const styles: Record<OrderStatus, string> = {
    PENDING_AM: "bg-slate-100 text-slate-700 border-slate-200",
    PENDING_RM: "bg-indigo-100 text-indigo-700 border-indigo-200",
    PENDING_NSM: "bg-violet-100 text-violet-700 border-violet-200",
    PENDING_FULFILLMENT: "bg-amber-100 text-amber-700 border-amber-200",
    IN_SHIPPING: "bg-cyan-100 text-cyan-700 border-cyan-200",
    DELIVERED: "bg-emerald-100 text-emerald-700 border-emerald-200",
    REJECTED: "bg-red-100 text-red-700 border-red-200",
    CANCELLED: "bg-rose-100 text-rose-700 border-rose-200",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${styles[status]}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

function PaymentBadge({ method }: { method?: "CASH" | "CREDIT" }) {
  if (!method) return <span className="text-xs text-muted-foreground">-</span>;
  const styles =
    method === "CREDIT"
      ? "bg-orange-100 text-orange-700 border-orange-200"
      : "bg-slate-100 text-slate-700 border-slate-200";

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${styles}`}
    >
      {method}
    </span>
  );
}

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
          className="w-full justify-between overflow-hidden"
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
      taxPercent: 5,
      notes: "",
      items: [makeLine()],
    },
  });

  const { fields, append, remove, update, replace } = useFieldArray({
    control,
    name: "items",
  });

  const customerId = useWatch({ control, name: "customerId" });
  const warehouseId = useWatch({ control, name: "warehouseId" });
  const paymentMethod = useWatch({ control, name: "paymentMethod" });
  const taxPercent = Number(useWatch({ control, name: "taxPercent" }) || 0);
  const watchedItems = (useWatch({ control, name: "items" }) ||
    []) as LineItem[];

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAction, setSavingAction] = useState<string | null>(null);
  const [order, setOrder] = useState<SalesOrderDetail | null>(null);
  const [dealerMeta, setDealerMeta] = useState<LookupOption | null>(null);
  const [warehouseMeta, setWarehouseMeta] = useState<LookupOption | null>(null);
  const [creditSummary, setCreditSummary] = useState<CreditSummary | null>(
    null,
  );
  const [creditLoading, setCreditLoading] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofUploading, setProofUploading] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [qrImage, setQrImage] = useState<string>("");

  const printRef = useRef<HTMLDivElement | null>(null);
  const promoTimers = useRef<
    Record<string, ReturnType<typeof setTimeout> | undefined>
  >({});
  const stockCache = useRef<Record<string, StockInfo>>({});
  const promoCache = useRef<
    Record<string, { bonusQty: number; appliedPromotionId: string | null }>
  >({});

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
        return {
          quantity: 0,
          incomingTransfer: 0,
          reservedForSales: 0,
          reservedForTransfer: 0,
          availableToSell: 0,
        };
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
        const stock: StockInfo = {
          quantity: 0,
          incomingTransfer: 0,
          reservedForSales: 0,
          reservedForTransfer: 0,
          availableToSell: 0,
        };
        stockCache.current[cacheKey] = stock;
        return stock;
      }
    },
    [],
  );

  const fetchPromo = useCallback(
    async (productId: string, qty: number, dId?: string, wId?: string) => {
      if (!productId || !qty || qty <= 0) {
        return { bonusQty: 0, appliedPromotionId: null };
      }

      const key = `${productId}|${qty}|${dId || ""}|${wId || ""}`;
      if (promoCache.current[key]) return promoCache.current[key];

      try {
        const res = await api.get("/promotions/calculate-bonus", {
          params: {
            productId,
            qty,
            customerId: dId,
            warehouseId: wId,
          },
        });

        const data = res.data?.data || {};
        const result = {
          bonusQty: Number(data.bonusQty || 0),
          appliedPromotionId: (data.appliedPromotionId || null) as
            | string
            | null,
        };
        promoCache.current[key] = result;
        return result;
      } catch {
        const result = { bonusQty: 0, appliedPromotionId: null };
        promoCache.current[key] = result;
        return result;
      }
    },
    [],
  );

  const isEditable = useMemo(
    () =>
      !!order &&
      [
        "PENDING_AM",
        "PENDING_RM",
        "PENDING_NSM",
        "PENDING_FULFILLMENT",
      ].includes(order.status),
    [order],
  );

  const canShip = order?.status === "PENDING_FULFILLMENT";
  const canDeliver = order?.status === "IN_SHIPPING";
  const canCancel = order
    ? !["DELIVERED", "CANCELLED"].includes(order.status)
    : false;

  const mapOrderToForm = useCallback(
    async (data: SalesOrderDetail) => {
      const customer = data.customerId;
      const warehouse = data.warehouseId;

      const nextItems: LineItem[] = (data.items || []).map((it: any) => ({
        productId: String(
          it.productId?._id || it.productId?.id || it.productId || "",
        ),
        productName: it.productId?.name || it.name || it.productName || "",
        qty: Number(it.qty || 0),
        bonusQty: Number(it.bonusQty || 0),
        unitPrice: Number(it.unitPrice || 0),
        discountPercent: Number(it.discountPercent || 0),
        promoAppliedId:
          it.promotionId?._id || it.promotionId?.id || it.promotionId || null,
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
            ? Math.round(
                (Number(data.totalTax || 0) / Number(data.subTotal || 1)) * 100,
              )
            : 5,
        notes: data.notes || "",
        items: nextItems.length ? nextItems : [makeLine()],
      });

      setDealerMeta(
        customer
          ? {
              value: String(customer._id || customer.id || ""),
              label:
                customer.name ||
                customer.proprietor ||
                String(customer._id || customer.id || ""),
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
              label:
                warehouse.name || String(warehouse._id || warehouse.id || ""),
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
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load sales order.",
      );
    } finally {
      setLoading(false);
    }
  }, [orderId, mapOrderToForm]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

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
                currentDue: Number(
                  data.currentDue ?? data.used ?? data.due ?? 0,
                ),
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

  useEffect(() => {
    // console.log("QR Image: ", qrImage);

    if (!order?.invoiceId) {
      setQrImage("");
      return;
    }

    const qrPayload =
      typeof order.invoiceId?.qrCode === "string" ? order.invoiceId.qrCode : "";
    if (!qrPayload) {
      setQrImage("");
      return;
    }

    let mounted = true;
    QRCode.toDataURL(qrPayload, {
      width: 220,
      margin: 2,
      errorCorrectionLevel: "M",
    })
      .then((dataUrl) => {
        if (mounted) setQrImage(dataUrl);
      })
      .catch(() => {
        if (mounted) setQrImage("");
      });

    return () => {
      mounted = false;
    };
  }, [order?.invoiceId]);

  useEffect(() => {
    return () => {
      Object.keys(promoTimers.current).forEach((key) => {
        const t = promoTimers.current[key];
        if (t) clearTimeout(t);
      });
    };
  }, []);

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
        const promo = await fetchPromo(
          row.productId,
          Number(row.qty || 0),
          customerId || undefined,
          warehouseId || undefined,
        );
        next.bonusQty = promo.bonusQty || 0;
        next.promoAppliedId = promo.appliedPromotionId;
      }

      update(index, {
        ...row,
        ...next,
      });
    },
    [
      fields,
      getValues,
      update,
      warehouseId,
      customerId,
      fetchStockInfo,
      fetchPromo,
    ],
  );

  const refreshAllRows = useCallback(async () => {
    await Promise.all(
      fields.map((f) => refreshRowById(f.id, { stock: true, promo: true })),
    );
  }, [fields, refreshRowById]);

  useEffect(() => {
    const currentWarehouse = warehouseId;
    const currentCustomer = customerId;

    if (!currentWarehouse && !currentCustomer) return;

    void refreshAllRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId, customerId]);

  const totals = useMemo(() => {
    const lineData = watchedItems.map((item) => calcLine(item, taxPercent));
    const totalQty = watchedItems.reduce(
      (sum, item) => sum + Number(item.qty || 0),
      0,
    );
    const totalBonusQty = watchedItems.reduce(
      (sum, item) => sum + Number(item.bonusQty || 0),
      0,
    );
    const subtotal = lineData.reduce((sum, row) => sum + row.lineSubtotal, 0);
    const totalDiscount = lineData.reduce(
      (sum, row) => sum + row.discountAmount,
      0,
    );
    const totalTax = lineData.reduce((sum, row) => sum + row.taxAmount, 0);
    const grandTotal = subtotal + totalTax;

    return {
      lineData,
      totalQty,
      totalBonusQty,
      subtotal,
      totalDiscount,
      totalTax,
      grandTotal,
    };
  }, [watchedItems, taxPercent]);

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
        orderDate: nextValues.orderDate
          ? new Date(nextValues.orderDate).toISOString()
          : new Date().toISOString(),
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
        toast.error(
          err?.response?.data?.message ||
            err?.message ||
            "Failed to update sales order.",
        );
      } finally {
        setSaving(false);
      }
    },
    [orderId, order, totals, loadOrder],
  );

  const openPrint = () => {
    if (!printRef.current) return window.print();

    const win = window.open("", "_blank", "width=1100,height=800");
    if (!win) return window.print();

    win.document.write(`
      <html>
        <head>
          <title>Sales Order ${order?.orderNo || ""}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            .wrap { max-width: 980px; margin: 0 auto; }
            .row { display: flex; justify-content: space-between; gap: 16px; }
            .muted { color: #6b7280; }
            .card { border: 1px solid #e5e7eb; border-radius: 14px; padding: 16px; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #e5e7eb; padding: 8px; font-size: 12px; }
            th { background: #f9fafb; text-align: left; }
            .right { text-align: right; }
            .signature-box { height: 110px; border: 1px dashed #9ca3af; border-radius: 10px; display: flex; align-items: flex-end; justify-content: center; padding: 12px; }
            .qr-box { width: 150px; height: 150px; border: 1px solid #d1d5db; border-radius: 12px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
            .qr-box img { width: 150px; height: 150px; object-fit: contain; }
            .small { font-size: 11px; }
          </style>
        </head>
        <body>
          ${printRef.current.innerHTML}
        </body>
      </html>
    `);
    win.document.close();
    setTimeout(() => {
      win.focus();
      win.print();
      win.close();
    }, 400);
  };

  const uploadProofFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await api.post(MEDIA_UPLOAD_ENDPOINT, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    const data = res.data?.data || res.data;
    const mediaId = data?._id || data?.id;
    if (!mediaId) {
      throw new Error("Uploaded file id not returned by upload API.");
    }

    return String(mediaId);
  };

  const currentApprovalRole = useMemo(() => {
    switch (order?.status) {
      case "PENDING_AM":
        return "A.M";
      case "PENDING_RM":
        return "R.M";
      case "PENDING_NSM":
        return "N.S.M";
      default:
        return null;
    }
  }, [order?.status]);

  const handleApprove = async () => {
    if (!orderId || !currentApprovalRole) return;

    setSavingAction("approve");
    try {
      await api.post(`/sales-orders/${orderId}/approve`, {
        role: currentApprovalRole,
        remarks,
      });
      toast.success(`${currentApprovalRole} approved.`);
      setRemarks("");
      await loadOrder();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to approve order.",
      );
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
      toast.error(
        err?.response?.data?.message || err?.message || "Failed to ship order.",
      );
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
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to cancel order.",
      );
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

      await api.post(`/sales-orders/${orderId}/deliver`, {
        uploadedDocumentFileId,
      });

      toast.success("Delivery approved.");
      setProofFile(null);
      await loadOrder();
    } catch (err: any) {
      console.error(err);
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to deliver order.",
      );
    } finally {
      setProofUploading(false);
      setSavingAction(null);
    }
  };

  const onPickDealer = async (opt: LookupOption) => {
    setValue("customerId", opt.value, { shouldDirty: true, shouldTouch: true });
    setDealerMeta(opt);
    setCreditSummary(null);
    await refreshAllRows();
  };

  const onPickWarehouse = async (opt: LookupOption) => {
    setValue("warehouseId", opt.value, {
      shouldDirty: true,
      shouldTouch: true,
    });
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

    const promo = await fetchPromo(
      opt.value,
      Number(row.qty || 0),
      customerId || undefined,
      warehouseId || undefined,
    );

    update(index, {
      ...row,
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
    const row = getValues(`items.${index}`) as LineItem | undefined;
    if (!row) return;

    update(index, { ...row, qty: Math.max(0, qty) });

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

    append({
      ...row,
      promoAppliedId: row.promoAppliedId || null,
    });
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading sales order...
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="w-full max-w-lg">
          <CardContent className="p-6 text-center">
            <div className="text-lg font-semibold">Sales order not found</div>
            <div className="mt-2 text-sm text-muted-foreground">
              The requested record may have been removed or the URL is invalid.
            </div>
            <Button
              className="mt-4"
              onClick={() => router.push("/sales-orders")}
            >
              Back to list
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const invoice = order.invoiceId || null;
  const qrPayload = typeof invoice?.qrCode === "string" ? invoice.qrCode : "";
  const dealerSignatureId =
    dealerMeta?.value ||
    order?.customerId?.attachments?.required?.signature?._id ||
    order?.customerId?.attachments?.required?.signature?.id ||
    order?.customerId?.attachments?.required?.signature ||
    "";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl p-4 md:p-6">
        <div className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-sm text-muted-foreground">
                Sales Order Action
              </div>
              <h1 className="text-2xl font-semibold">{order.orderNo}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={order.status} />
                <PaymentBadge method={order.paymentMethod} />
                <span className="text-sm text-muted-foreground">
                  Created: {fmtDate(order.createdAt || order.orderDate)}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadOrder()}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>

              {isEditable ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={saveChanges}
                  disabled={saving || isSubmitting}
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save
                </Button>
              ) : null}

              {currentApprovalRole ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleApprove()}
                >
                  {savingAction === "approve" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="mr-2 h-4 w-4" />
                  )}
                  Approve {currentApprovalRole}
                </Button>
              ) : null}

              {canShip ? (
                <Button type="button" onClick={() => void handleShip()}>
                  {savingAction === "ship" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Truck className="mr-2 h-4 w-4" />
                  )}
                  Ship
                </Button>
              ) : null}

              {invoice ? (
                <Button type="button" variant="outline" onClick={openPrint}>
                  <Printer className="mr-2 h-4 w-4" />
                  Print invoice
                </Button>
              ) : null}

              {canCancel ? (
                <Button
                  type="button"
                  variant="outline"
                  className="text-red-600 hover:text-red-700"
                  onClick={() => void handleCancel()}
                >
                  {savingAction === "cancel" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Ban className="mr-2 h-4 w-4" />
                  )}
                  Cancel
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Order basics</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Dealer</div>
                  <LookupSelect
                    value={customerId}
                    selectedLabel={dealerMeta?.label}
                    onPick={onPickDealer}
                    fetchOptions={fetchDealers}
                    placeholder="Search dealer"
                    searchPlaceholder="Type dealer name / phone..."
                    disabled={!isEditable}
                  />
                  <div className="text-xs text-muted-foreground">
                    {dealerMeta?.description ||
                      "Open and search to load dealers."}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Warehouse</div>
                  <LookupSelect
                    value={warehouseId}
                    selectedLabel={warehouseMeta?.label}
                    onPick={onPickWarehouse}
                    fetchOptions={fetchWarehouses}
                    placeholder="Search warehouse"
                    searchPlaceholder="Type warehouse name..."
                    disabled={!isEditable}
                  />
                  <div className="text-xs text-muted-foreground">
                    {warehouseMeta?.description ||
                      "Open and search to load warehouses."}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Order date</div>
                  <Input
                    type="date"
                    {...register("orderDate")}
                    disabled={!isEditable}
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Payment method</div>
                  <select
                    {...register("paymentMethod")}
                    disabled={!isEditable}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none disabled:opacity-50"
                  >
                    <option value="CASH">Cash</option>
                    <option value="CREDIT">Credit</option>
                  </select>
                  <div className="text-xs text-muted-foreground">
                    Credit orders are validated against dealer credit summary.
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Order items</CardTitle>
                {isEditable ? (
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={addRow}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add item
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void refreshAllRows()}
                      disabled={!customerId || !warehouseId}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh
                    </Button>
                  </div>
                ) : null}
              </CardHeader>

              <CardContent className="space-y-4">
                {fields.map((field, index) => {
                  const row = watchedItems[index] || makeLine();
                  const line = calcLine(row, taxPercent);
                  const lowStock =
                    Number(row.availableToSell || 0) < Number(row.qty || 0);

                  return (
                    <div
                      key={field.id}
                      className={`rounded-xl border bg-white p-4 ${lowStock ? "border-red-200 bg-red-50/40" : ""}`}
                    >
                      <div className="mb-4 flex items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold">
                            Item #{index + 1}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {row.productName || "Select a product"}
                          </div>
                        </div>

                        {isEditable ? (
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => duplicateRow(index)}
                            >
                              <Copy className="mr-2 h-4 w-4" />
                              Duplicate
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => removeRow(index)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Remove
                            </Button>
                          </div>
                        ) : null}
                      </div>

                      <div className="grid gap-4 md:grid-cols-12">
                        <div className="space-y-2 md:col-span-4">
                          <div className="text-sm font-medium">Product</div>
                          <LookupSelect
                            value={row.productId}
                            selectedLabel={row.productName || undefined}
                            onPick={(opt) => onPickProduct(index, opt)}
                            fetchOptions={fetchProducts}
                            placeholder="Search product"
                            searchPlaceholder="Type product name / SKU..."
                            disabled={!isEditable}
                          />
                          <div className="text-xs text-muted-foreground">
                            {row.productName
                              ? `Price: ${money(row.unitPrice)} BDT`
                              : "Open and search to load products."}
                          </div>
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <div className="text-sm font-medium">Available</div>
                          <div
                            className={`flex h-10 items-center rounded-md border px-3 text-sm font-semibold ${
                              lowStock
                                ? "border-red-300 bg-red-100 text-red-700"
                                : "bg-slate-50"
                            }`}
                          >
                            {Number(row.availableToSell || 0)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Sellable = quantity + incoming - reserved sales -
                            reserved transfer
                          </div>
                        </div>

                        <div className="space-y-2 md:col-span-1">
                          <div className="text-sm font-medium">Qty</div>
                          <Input
                            type="number"
                            min={0}
                            value={row.qty}
                            onChange={(e) =>
                              onQtyChange(index, Number(e.target.value || 0))
                            }
                            disabled={!isEditable}
                          />
                        </div>

                        <div className="space-y-2 md:col-span-1">
                          <div className="text-sm font-medium">Bonus</div>
                          <div className="flex h-10 items-center rounded-md border bg-slate-50 px-3 text-sm">
                            {Number(row.bonusQty || 0)}
                          </div>
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <div className="text-sm font-medium">Unit price</div>
                          <Input
                            type="number"
                            value={row.unitPrice}
                            onChange={(e) =>
                              update(index, {
                                ...row,
                                unitPrice: Number(e.target.value || 0),
                              })
                            }
                            disabled={!isEditable}
                          />
                        </div>

                        <div className="space-y-2 md:col-span-1">
                          <div className="text-sm font-medium">Disc %</div>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={row.discountPercent}
                            onChange={(e) =>
                              update(index, {
                                ...row,
                                discountPercent: Number(e.target.value || 0),
                              })
                            }
                            disabled={!isEditable}
                          />
                        </div>

                        <div className="space-y-2 md:col-span-1">
                          <div className="text-sm font-medium">Subtotal</div>
                          <div className="flex h-10 items-center rounded-md border bg-slate-50 px-3 text-sm font-medium">
                            {money(line.lineSubtotal)} BDT
                          </div>
                        </div>

                        <div className="space-y-2 md:col-span-1">
                          <div className="text-sm font-medium">Total</div>
                          <div className="flex h-10 items-center rounded-md border bg-indigo-50 px-3 text-sm font-semibold text-indigo-700">
                            {money(line.lineTotal)} BDT
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-4">
                        <div>Qty in stock: {row.quantity}</div>
                        <div>Incoming transfer: {row.incomingTransfer}</div>
                        <div>Reserved sales: {row.reservedForSales}</div>
                        <div>Reserved transfer: {row.reservedForTransfer}</div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="text-muted-foreground">
                          {row.promoAppliedId ? (
                            <span className="text-emerald-600">
                              Promotion applied automatically
                            </span>
                          ) : (
                            <span>No promotion applied yet</span>
                          )}
                        </div>
                        {lowStock ? (
                          <div className="font-medium text-red-600">
                            Quantity exceeds available to sell
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <textarea
                  {...register("notes")}
                  rows={4}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none disabled:opacity-50"
                  placeholder="Internal remarks, delivery notes, special instructions..."
                  disabled={!isEditable}
                />
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Workflow timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {[
                    "PENDING_AM",
                    "PENDING_RM",
                    "PENDING_NSM",
                    "PENDING_FULFILLMENT",
                    "IN_SHIPPING",
                    "DELIVERED",
                  ].map((step) => {
                    const matched = order.approvalLogs?.find(
                      (l) => l.role === step,
                    );
                    const active = step === order.status;
                    const done =
                      matched?.status === "APPROVED" ||
                      ["DELIVERED"].includes(order.status) ||
                      [
                        "PENDING_AM",
                        "PENDING_RM",
                        "PENDING_NSM",
                        "PENDING_FULFILLMENT",
                        "IN_SHIPPING",
                        "DELIVERED",
                      ].indexOf(step) <
                        [
                          "PENDING_AM",
                          "PENDING_RM",
                          "PENDING_NSM",
                          "PENDING_FULFILLMENT",
                          "IN_SHIPPING",
                          "DELIVERED",
                        ].indexOf(order.status);

                    return (
                      <div
                        key={step}
                        className={`rounded-md border p-4 ${
                          active
                            ? "border-indigo-300 bg-indigo-50"
                            : done
                              ? "border-emerald-200 bg-emerald-50/70"
                              : "bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium">
                            {step.replaceAll("_", " ")}
                          </div>
                          <StatusBadge status={step as OrderStatus} />
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          {matched?.actionDate
                            ? fmtDate(matched.actionDate)
                            : "No action yet"}
                        </div>
                        {matched?.remarks ? (
                          <div className="mt-2 text-xs text-muted-foreground">
                            {matched.remarks}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Qty</span>
                  <span className="font-medium">{totals.totalQty}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Bonus qty
                  </span>
                  <span className="font-medium">{totals.totalBonusQty}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Sub total
                  </span>
                  <span className="font-medium">
                    {money(order.subTotal ?? totals.subtotal)} BDT
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Discount
                  </span>
                  <span className="font-medium">
                    {money(order.totalDiscount)} BDT
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Tax</span>
                  <span className="font-medium">
                    {money(order.totalTax)} BDT
                  </span>
                </div>
                <div className="flex items-center justify-between border-t pt-3">
                  <span className="text-base font-semibold">Grand total</span>
                  <span className="text-lg font-bold text-indigo-700">
                    {money(order.grandTotal ?? totals.grandTotal)} BDT
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Credit summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Credit limit</span>
                  <span className="font-medium">
                    {money(order.creditSnapshot?.creditLimit)} BDT
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Used</span>
                  <span className="font-medium">
                    {money(order.creditSnapshot?.used)} BDT
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Available</span>
                  <span className="font-medium">
                    {money(order.creditSnapshot?.available)} BDT
                  </span>
                </div>

                {creditLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading credit summary...
                  </div>
                ) : creditSummary ? (
                  <div className="rounded-md bg-slate-50 p-3 text-xs text-muted-foreground">
                    Dealer credit available: {money(creditSummary.available)}{" "}
                    BDT
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Invoice</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {invoice ? (
                  <>
                    <div className="rounded-md border bg-slate-50 p-4">
                      <div className="text-xs text-muted-foreground">
                        Invoice No
                      </div>
                      <div className="mt-1 font-semibold">
                        {invoice.invoiceNo || "-"}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        Date: {fmtDate(invoice.invoiceDate || order.createdAt)}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Payment: {invoice.paymentStatus || "UNPAID"}
                      </div>
                    </div>

                    <div className="rounded-md border bg-white p-4">
                      <div className="text-xs font-medium text-muted-foreground">
                        QR image
                      </div>
                      <div className="mt-3 flex items-center justify-center rounded-md border bg-slate-50 p-3">
                        {qrImage ? (
                          <img
                            src={qrImage}
                            alt="Invoice QR"
                            className="h-44 w-44"
                          />
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            QR not ready yet
                          </div>
                        )}
                      </div>
                      <div className="mt-3 text-xs text-muted-foreground break-words">
                        {qrPayload || "-"}
                      </div>
                    </div>

                    <div className="rounded-md border bg-white p-4">
                      <div className="text-xs font-medium text-muted-foreground">
                        Dealer signature template
                      </div>
                      <div className="mt-2 rounded-md border border-dashed bg-slate-50 p-4 text-sm">
                        {dealerSignatureId ? (
                          <div>
                            Signature media linked:{" "}
                            <span className="font-medium">
                              {String(dealerSignatureId)}
                            </span>
                          </div>
                        ) : (
                          <div className="text-muted-foreground">
                            No dealer signature uploaded.
                          </div>
                        )}
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={openPrint}
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      Print invoice
                    </Button>
                  </>
                ) : (
                  <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    Invoice not created yet. Use Ship to generate it.
                  </div>
                )}
              </CardContent>
            </Card>

            {currentApprovalRole ? (
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle>Approval remarks</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none"
                    placeholder="Optional remarks before approval..."
                  />

                  <Button
                    type="button"
                    className="w-full"
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
            ) : null}

            {canDeliver ? (
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle>Delivery verification</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    Upload the signed invoice scan/photo. The backend will
                    verify QR and dealer signature before delivery.
                  </div>

                  <Input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                  />

                  {proofFile ? (
                    <div className="rounded-md border bg-slate-50 p-3 text-sm">
                      Selected file:{" "}
                      <span className="font-medium">{proofFile.name}</span>
                    </div>
                  ) : null}

                  <Button
                    type="button"
                    className="w-full"
                    onClick={() => void handleDeliver()}
                    disabled={
                      proofUploading || savingAction === "deliver" || !proofFile
                    }
                  >
                    {proofUploading || savingAction === "deliver" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    Verify and deliver
                  </Button>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>

        <div ref={printRef} className="hidden">
          <div className="wrap">
            <div className="card">
              <div className="row">
                <div>
                  <div>
                    <strong>Sales Order / Invoice</strong>
                  </div>
                  <div className="muted small">Order No: {order.orderNo}</div>
                  <div className="muted small">
                    Date: {fmtDate(order.orderDate || order.createdAt)}
                  </div>
                </div>
                <div className="right">
                  <div>
                    <strong>
                      {dealerMeta?.label ||
                        order.customerId?.name ||
                        order.customerId?.proprietor ||
                        "-"}
                    </strong>
                  </div>
                  <div className="muted small">
                    {order.customerId?.phoneNumber ||
                      order.customerId?.phone ||
                      "-"}
                  </div>
                  <div className="muted small">
                    Warehouse:{" "}
                    {warehouseMeta?.label || order.warehouseId?.name || "-"}
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Product</th>
                    <th className="right">Qty</th>
                    <th className="right">Bonus</th>
                    <th className="right">Price</th>
                    <th className="right">Subtotal</th>
                    <th className="right">Tax</th>
                    <th className="right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {watchedItems.map((item, index) => {
                    const line = calcLine(item, taxPercent);
                    return (
                      <tr key={item.productId || index}>
                        <td>{index + 1}</td>
                        <td>{item.productName || item.productId || "-"}</td>
                        <td className="right">{Number(item.qty || 0)}</td>
                        <td className="right">{Number(item.bonusQty || 0)}</td>
                        <td className="right">
                          {money(Number(item.unitPrice || 0))}
                        </td>
                        <td className="right">{money(line.lineSubtotal)}</td>
                        <td className="right">{money(line.taxAmount)}</td>
                        <td className="right">{money(line.lineTotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="row">
              <div className="card" style={{ width: "48%" }}>
                <div>
                  <strong>QR Code Area</strong>
                </div>
                <div className="muted small">QR payload</div>
                <div className="qr-box">
                  {qrImage ? (
                    <img src={qrImage} alt="Invoice QR" />
                  ) : (
                    <span>QR not ready</span>
                  )}
                </div>
              </div>

              <div className="card" style={{ width: "48%" }}>
                <div>
                  <strong>Dealer Signature</strong>
                </div>
                <div className="muted small">
                  Sign in this box after receiving the goods
                </div>
                <div className="signature-box">Dealer signature</div>
                <div className="muted small" style={{ marginTop: "10px" }}>
                  Template media:{" "}
                  {dealerSignatureId ? String(dealerSignatureId) : "Not linked"}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="row">
                <div>
                  <div className="muted small">Subtotal</div>
                  <div>
                    <strong>
                      {money(order.subTotal ?? totals.subtotal)} BDT
                    </strong>
                  </div>
                </div>
                <div>
                  <div className="muted small">Discount</div>
                  <div>
                    <strong>{money(order.totalDiscount)} BDT</strong>
                  </div>
                </div>
                <div>
                  <div className="muted small">Tax</div>
                  <div>
                    <strong>{money(order.totalTax)} BDT</strong>
                  </div>
                </div>
                <div>
                  <div className="muted small">Grand Total</div>
                  <div>
                    <strong>
                      {money(order.grandTotal ?? totals.grandTotal)} BDT
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
