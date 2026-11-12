"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";

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
  Minus,
  Trash2,
  Copy,
  RefreshCw,
  ShoppingCart,
  Building2,
  Calendar,
  CreditCard,
  StickyNote,
  Package,
  Percent,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Boxes,
  ArrowRight,
  Receipt,
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
  warehouseId?: string;
  warehouseName?: string;
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

type StockInfo = {
  quantity: number;
  incomingTransfer: number;
  reservedForSales: number;
  reservedForTransfer: number;
  availableToSell: number;
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

const today = new Date().toISOString().slice(0, 10);

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

const defaultValues: FormValues = {
  customerId: "",
  warehouseId: "",
  orderDate: today,
  paymentMethod: "CREDIT",
  taxPercent: 0,
  notes: "",
  items: [makeLine()],
};

function money(n: number) {
  return Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

/* ------------------------------ Lookup ------------------------------ */
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
          className="h-10 w-full justify-between overflow-hidden bg-white"
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

/* ------------------------------ Small UI helpers ------------------------------ */
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
    <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
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

function StatPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "slate" | "emerald" | "black" | "amber";
}) {
  const map = {
    slate: "bg-slate-100 text-slate-700",
    emerald: "bg-[#3aa838]/10 text-[#2f8a2f]",
    black: "bg-slate-900 text-white",
    amber: "bg-amber-50 text-amber-700",
  } as const;
  return (
    <div className={`rounded-lg px-3 py-2 ${map[tone]}`}>
      <div className="text-[10px] font-medium uppercase tracking-wide opacity-70">
        {label}
      </div>
      <div className="text-base font-bold tabular-nums">{value}</div>
    </div>
  );
}

/* ------------------------------ Page ------------------------------ */
export default function SalesOrderCreatePage() {
  const router = useRouter();

  const {
    control,
    register,
    handleSubmit,
    getValues,
    setValue,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({ defaultValues });

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "items",
  });

  const customerId = useWatch({ control, name: "customerId" });
  const warehouseId = useWatch({ control, name: "warehouseId" });
  const paymentMethod = useWatch({ control, name: "paymentMethod" });
  const taxPercent = Number(useWatch({ control, name: "taxPercent" }) || 0);
  const watchedItems = (useWatch({ control, name: "items" }) || []) as LineItem[];

  const [saving, setSaving] = useState(false);
  const [creditLoading, setCreditLoading] = useState(false);
  const [creditSummary, setCreditSummary] = useState<CreditSummary | null>(
    null,
  );
  const [createdOrder, setCreatedOrder] = useState<any>(null);

  const [dealerMeta, setDealerMeta] = useState<LookupOption | null>(null);
  const [warehouseMeta, setWarehouseMeta] = useState<LookupOption | null>(null);

  const promoTimers = useRef<
    Record<string, ReturnType<typeof setTimeout> | undefined>
  >({});
  const stockCache = useRef<Record<string, StockInfo>>({});
  const promoCache = useRef<
    Record<string, { bonusQty: number; appliedPromotionId: string | null }>
  >({});

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

  const fetchDealers = useCallback(async (search: string) => {
    const res = await api.get("/dealers", {
      params: { q: search || undefined, page: 1, limit: 20 },
    });
    return (res.data?.data || []).map((d: any) => ({
      value: String(d._id || d.id),
      label: d.name || d.proprietor || String(d._id || d.id),
      description: `${d.phoneNumber || d.phone || ""}${
        d.status ? ` · ${d.status}` : ""
      }`,
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
      description: `${p.sku || ""}${
        p.salePrice || p.price
          ? ` · ${Number(p.salePrice ?? p.sale_price ?? p.price ?? 0)} BDT`
          : ""
      }`,
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
      if (stockCache.current[cacheKey]) {
        return stockCache.current[cacheKey];
      }
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
          params: { productId, qty, customerId: dId, warehouseId: wId },
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

      setRow(index, next);
    },
    [fields, getValues, setRow, warehouseId, customerId, fetchStockInfo, fetchPromo],
  );

  const refreshAllRows = useCallback(async () => {
    await Promise.all(
      fields.map((f) => refreshRowById(f.id, { stock: true, promo: true })),
    );
  }, [fields, refreshRowById]);

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

  const prevLink = useRef<{ customerId?: string; warehouseId?: string }>({});

  useEffect(() => {
    if (!customerId || !warehouseId) return;
    const changed =
      prevLink.current.customerId !== customerId ||
      prevLink.current.warehouseId !== warehouseId;
    prevLink.current = { customerId, warehouseId };
    if (changed && fields.length > 0) {
      void refreshAllRows();
    }
  }, [customerId, warehouseId, fields.length, refreshAllRows]);

  useEffect(() => {
    return () => {
      Object.keys(promoTimers.current).forEach((key) => {
        const t = promoTimers.current[key];
        if (t) clearTimeout(t);
      });
    };
  }, []);

  const totals = useMemo(() => {
    const lineData = watchedItems.map((item) => calcLine(item, taxPercent));
    const totalQty = watchedItems.reduce((s, it) => s + Number(it.qty || 0), 0);
    const totalBonusQty = watchedItems.reduce(
      (s, it) => s + Number(it.bonusQty || 0),
      0,
    );
    const subtotal = lineData.reduce((s, r) => s + r.lineSubtotal, 0);
    const totalDiscount = lineData.reduce((s, r) => s + r.discountAmount, 0);
    const totalTax = lineData.reduce((s, r) => s + r.taxAmount, 0);
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

  const canSubmitCredit =
    paymentMethod !== "CREDIT" ||
    (!!creditSummary &&
      creditSummary.dealerType === "CREDIT" &&
      creditSummary.available >= totals.grandTotal);

  const canSubmit =
    !saving && !isSubmitting && !!customerId && !!warehouseId && canSubmitCredit;

  const onPickDealer = async (opt: LookupOption) => {
    setValue("customerId", opt.value, {
      shouldDirty: true,
      shouldTouch: true,
    });
    setDealerMeta(opt);
    setCreditSummary(null);

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

    const fieldId = fields[index]?.id;

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

    if (fieldId) {
      stockCache.current[`${opt.value}|${warehouseId || ""}`] = stock;
    }
  };

  const onQtyChange = (index: number, qty: number) => {
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

  const resetPage = () => {
    reset(defaultValues);
    replace([makeLine()]);
    setDealerMeta(null);
    setWarehouseMeta(null);
    setCreditSummary(null);
    setCreatedOrder(null);
    toast.message("Form reset.");
  };

  const submitOrder = async (data: FormValues) => {
    if (!data.customerId) return void toast.error("Please select a dealer.");
    if (!data.warehouseId)
      return void toast.error("Please select a warehouse.");
    if (!data.items.length) return void toast.error("Add at least one product.");

    if ((dealerMeta?.status || "").toLowerCase() === "blocked") {
      return void toast.error("This dealer is blocked.");
    }

    for (let i = 0; i < data.items.length; i++) {
      const row = data.items[i];
      if (!row.productId)
        return void toast.error(`Row ${i + 1}: select a product.`);
      if (!row.qty || row.qty <= 0)
        return void toast.error(
          `Row ${i + 1}: quantity must be greater than zero.`,
        );
      if (!row.unitPrice || row.unitPrice <= 0)
        return void toast.error(`Row ${i + 1}: product price is missing.`);

      if (Number(row.availableToSell || 0) < Number(row.qty || 0)) {
        const ok = window.confirm(
          `Row ${i + 1} (${row.productName}) available to sell is low (${
            row.availableToSell
          }). Continue anyway?`,
        );
        if (!ok) return;
      }
    }

    if (data.paymentMethod === "CREDIT") {
      if ((creditSummary?.dealerType || dealerMeta?.dealerType) !== "CREDIT") {
        return void toast.error("This dealer is not allowed for credit orders.");
      }
      if (
        creditSummary &&
        Number(creditSummary.available || 0) < Number(totals.grandTotal || 0)
      ) {
        return void toast.error("Credit limit exceeded.");
      }
    }

    const items = data.items.map((row) => {
      const line = calcLine(row, data.taxPercent);
      return {
        productId: row.productId,
        warehouseId: data.warehouseId,
        qty: Number(row.qty || 0),
        bonusQty: Number(row.bonusQty || 0),
        unitPrice: Number(row.unitPrice || 0),
        discountPercent: Number(row.discountPercent || 0),
        discountAmount: Number(line.discountAmount || 0),
        taxPercent: Number(data.taxPercent || 0),
        taxAmount: Number(line.taxAmount || 0),
        lineSubtotal: Number(line.lineSubtotal || 0),
        lineTotal: Number(line.lineTotal || 0),
        ...(row.promoAppliedId ? { promotionId: row.promoAppliedId } : {}),
      };
    });

    const payload = {
      customerId: data.customerId,
      warehouseId: data.warehouseId,
      orderDate: data.orderDate
        ? new Date(data.orderDate).toISOString()
        : new Date().toISOString(),
      paymentMethod: data.paymentMethod,
      items,
      subTotal: totals.subtotal,
      totalDiscount: totals.totalDiscount,
      totalTax: totals.totalTax,
      grandTotal: totals.grandTotal,
      totalBonusQty: totals.totalBonusQty,
      notes: data.notes || "",
    };

    setSaving(true);
    try {
      const res = await api.post("/sales-orders", payload);
      const created = res.data?.data || res.data;
      setCreatedOrder(created);
      toast.success("Sales order created successfully.");
      reset(defaultValues);
      replace([makeLine()]);
      setDealerMeta(null);
      setWarehouseMeta(null);
      setCreditSummary(null);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to create sales order.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const selectedDealerLabel =
    dealerMeta?.label || customerId || "Select dealer";
  const selectedWarehouseLabel =
    warehouseMeta?.label || warehouseId || "Select warehouse";

  const usage =
    creditSummary && creditSummary.creditLimit > 0
      ? Math.min(
          100,
          (creditSummary.currentDue / creditSummary.creditLimit) * 100,
        )
      : 0;

  const willExceed =
    paymentMethod === "CREDIT" &&
    !!creditSummary &&
    creditSummary.available < totals.grandTotal;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl p-4 md:p-6">
        {/* ---------- Hero header ---------- */}
        <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-[#1a4d1a] p-6 text-white shadow-lg">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(58,168,56,0.25),transparent_55%)]" />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#3aa838]/25 backdrop-blur-sm ring-1 ring-[#3aa838]/40">
                <ShoppingCart className="h-6 w-6 text-[#7cd67a]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  Create Sales Order
                </h1>
                <p className="text-sm text-white/80">
                  Live stock, automatic promos, credit-safe. Fast and clean.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <div className="rounded-lg bg-white/10 px-3 py-2 backdrop-blur-sm ring-1 ring-white/15">
                <div className="text-[10px] uppercase tracking-wide text-white/60">
                  Dealer
                </div>
                <div className="font-semibold">{selectedDealerLabel}</div>
              </div>
              <div className="rounded-lg bg-white/10 px-3 py-2 backdrop-blur-sm ring-1 ring-white/15">
                <div className="text-[10px] uppercase tracking-wide text-white/60">
                  Warehouse
                </div>
                <div className="font-semibold">{selectedWarehouseLabel}</div>
              </div>
              <div className="rounded-lg bg-[#3aa838] px-3 py-2 shadow-md shadow-black/40">
                <div className="text-[10px] uppercase tracking-wide text-[#c6e8c5]">
                  Total
                </div>
                <div className="font-semibold tabular-nums">
                  ৳ {money(totals.grandTotal)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ---------- Success card ---------- */}
        {createdOrder ? (
          <Card className="mb-6 border-[#3aa838]/30 bg-gradient-to-r from-[#3aa838]/10 to-white shadow-md">
            <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#3aa838] text-white shadow-lg shadow-[#3aa838]/30">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-sm font-medium text-[#2f8a2f]">
                    Order created successfully
                  </div>
                  <div className="mt-0.5 text-xl font-bold tabular-nums">
                    {createdOrder.orderNo ||
                      createdOrder?.data?.orderNo ||
                      "Saved"}
                  </div>
                  <div className="text-xs text-[#2f8a2f]">
                    Status: {createdOrder.status || "PENDING_AM"}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={resetPage}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Create another
                </Button>
                <Button
                  type="button"
                  onClick={() => router.push("/sales/list")}
                  className="bg-[#3aa838] hover:bg-[#2f8a2f]"
                >
                  Go to list
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <form
          onSubmit={handleSubmit(submitOrder)}
          className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]"
        >
          {/* ---------- Left column ---------- */}
          <div className="space-y-6">
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <SectionHeader
                icon={Receipt}
                title="Order basics"
                subtitle="Select dealer, warehouse, date, and payment method"
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
                  />
                  <div className="text-[11px] text-muted-foreground">
                    {warehouseMeta?.description ||
                      "Auto-selected from dealer when available."}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                    <Calendar className="h-3.5 w-3.5" />
                    Order date
                  </label>
                  <Input type="date" {...register("orderDate")} className="h-10" />
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                    <CreditCard className="h-3.5 w-3.5" />
                    Payment method
                  </label>
                  <select
                    {...register("paymentMethod")}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3aa838]"
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

            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <SectionHeader
                icon={Boxes}
                title="Order items"
                subtitle="Add products — stock and promos update automatically"
                right={
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addRow}
                    >
                      <Plus className="mr-1.5 h-4 w-4" />
                      Add item
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void refreshAllRows()}
                      disabled={!customerId || !warehouseId}
                    >
                      <RefreshCw className="mr-1.5 h-4 w-4" />
                      Refresh
                    </Button>
                  </div>
                }
              />

              <CardContent className="space-y-4 p-5">
                {fields.map((field, index) => {
                  const row = watchedItems[index] || makeLine();
                  const line = calcLine(row, taxPercent);
                  const lowStock =
                    Number(row.availableToSell || 0) < Number(row.qty || 0);

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
                                <Sparkles className="h-3 w-3" />
                                Promotion applied
                              </div>
                            ) : (
                              <div className="text-[11px] text-muted-foreground">
                                Select a product to begin
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => duplicateRow(index)}
                          >
                            <Copy className="mr-1 h-3.5 w-3.5" />
                            Duplicate
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeRow(index)}
                            className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                          >
                            <Trash2 className="mr-1 h-3.5 w-3.5" />
                            Remove
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-12">
                        <div className="space-y-1.5 md:col-span-5">
                          <label className="text-xs font-medium text-slate-600">
                            Product
                          </label>
                          <LookupSelect
                            value={row.productId}
                            selectedLabel={row.productName || undefined}
                            onPick={(opt) => onPickProduct(index, opt)}
                            fetchOptions={fetchProducts}
                            placeholder="Search product"
                            searchPlaceholder="Type product name / SKU..."
                          />
                          <div className="text-[11px] text-muted-foreground">
                            {row.productName
                              ? `Unit price: ৳ ${money(row.unitPrice)}`
                              : "Open to search products."}
                          </div>
                        </div>

                        <div className="space-y-1.5 md:col-span-3">
                          <label className="text-xs font-medium text-slate-600">
                            Quantity
                          </label>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-10 w-9 shrink-0"
                              onClick={() =>
                                onQtyChange(
                                  index,
                                  Math.max(0, Number(row.qty || 0) - 1),
                                )
                              }
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                            <Input
                              type="number"
                              min={0}
                              value={row.qty}
                              onChange={(e) =>
                                onQtyChange(
                                  index,
                                  Number(e.target.value || 0),
                                )
                              }
                              className="h-10 flex-1 text-center text-sm font-semibold tabular-nums"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-10 w-9 shrink-0"
                              onClick={() =>
                                onQtyChange(index, Number(row.qty || 0) + 1)
                              }
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <div
                            className={`flex items-center gap-1 text-[11px] font-medium ${
                              lowStock
                                ? "text-rose-600"
                                : "text-[#3aa838]"
                            }`}
                          >
                            {lowStock ? (
                              <>
                                <AlertTriangle className="h-3 w-3" />
                                Only {Number(row.availableToSell || 0)} sellable
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-3 w-3" />
                                {Number(row.availableToSell || 0)} sellable
                              </>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1.5 md:col-span-1">
                          <label className="text-xs font-medium text-slate-600">
                            Bonus
                          </label>
                          <div className="flex h-10 items-center justify-center rounded-md border border-[#3aa838]/30 bg-[#3aa838]/10 px-2 text-sm font-semibold tabular-nums text-[#2f8a2f]">
                            {Number(row.bonusQty || 0)}
                          </div>
                        </div>

                        <div className="space-y-1.5 md:col-span-1">
                          <label className="text-xs font-medium text-slate-600">
                            Disc %
                          </label>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={row.discountPercent}
                            onChange={(e) =>
                              setRow(index, {
                                discountPercent: Number(e.target.value || 0),
                              })
                            }
                            className="h-10 text-center tabular-nums"
                          />
                        </div>

                        <div className="space-y-1.5 md:col-span-2">
                          <label className="text-xs font-medium text-slate-600">
                            Line total
                          </label>
                          <div className="flex h-10 items-center justify-end rounded-md border border-[#3aa838]/30 bg-[#3aa838]/10 px-3 text-sm font-bold tabular-nums text-[#2f8a2f]">
                            ৳ {money(line.lineTotal)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                        <span>
                          In stock:{" "}
                          <b className="tabular-nums">{row.quantity}</b>
                        </span>
                        <span className="text-slate-300">•</span>
                        <span>
                          Incoming:{" "}
                          <b className="tabular-nums">{row.incomingTransfer}</b>
                        </span>
                        <span className="text-slate-300">•</span>
                        <span>
                          Reserved sales:{" "}
                          <b className="tabular-nums">{row.reservedForSales}</b>
                        </span>
                        <span className="text-slate-300">•</span>
                        <span>
                          Reserved transfer:{" "}
                          <b className="tabular-nums">
                            {row.reservedForTransfer}
                          </b>
                        </span>
                        <span className="ml-auto rounded bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 ring-1 ring-slate-200">
                          Subtotal ৳ {money(line.lineSubtotal)}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {fields.length === 0 && (
                  <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center">
                    <Boxes className="mx-auto h-8 w-8 text-slate-300" />
                    <div className="mt-2 text-sm font-medium">No items yet</div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={addRow}
                    >
                      <Plus className="mr-1.5 h-4 w-4" />
                      Add first item
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <SectionHeader
                icon={StickyNote}
                title="Notes"
                subtitle="Internal remarks, delivery notes, special instructions"
              />
              <CardContent className="p-5">
                <textarea
                  {...register("notes")}
                  rows={4}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3aa838]"
                  placeholder="Anything the team should know about this order..."
                />
              </CardContent>
            </Card>
          </div>

          {/* ---------- Right column ---------- */}
          <div className="space-y-6 lg:sticky lg:top-6 h-fit">
            <Card className="overflow-hidden border-slate-200 shadow-md">
              <SectionHeader icon={Wallet} title="Summary" />
              <CardContent className="space-y-4 p-5">
                <div className="grid grid-cols-2 gap-2">
                  <StatPill
                    label="Items"
                    value={String(watchedItems.length)}
                    tone="black"
                  />
                  <StatPill
                    label="Qty"
                    value={String(totals.totalQty)}
                    tone="emerald"
                  />
                  <StatPill
                    label="Bonus"
                    value={String(totals.totalBonusQty)}
                    tone="emerald"
                  />
                  <StatPill
                    label="Discount"
                    value={`৳ ${money(totals.totalDiscount)}`}
                    tone="amber"
                  />
                </div>

                <div className="space-y-2 rounded-lg border bg-slate-50 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-semibold tabular-nums">
                      ৳ {money(totals.subtotal)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Percent className="h-3.5 w-3.5" />
                      Tax %
                    </span>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      {...register("taxPercent", { valueAsNumber: true })}
                      className="h-8 w-20 text-center tabular-nums"
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Tax</span>
                    <span className="font-semibold tabular-nums">
                      ৳ {money(totals.totalTax)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between border-t pt-3">
                    <span className="text-sm font-semibold">Grand total</span>
                    <span className="text-xl font-extrabold tabular-nums text-[#2f8a2f]">
                      ৳ {money(totals.grandTotal)}
                    </span>
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-slate-500" />
                      <div className="text-sm font-semibold">Dealer credit</div>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                      {dealerMeta?.status || "Active"}
                    </span>
                  </div>

                  {!customerId ? (
                    <div className="mt-3 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                      Pick a dealer to load credit info.
                    </div>
                  ) : creditLoading ? (
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading credit summary...
                    </div>
                  ) : creditSummary ? (
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Type</span>
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium">
                          {creditSummary.dealerType}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Credit limit
                        </span>
                        <span className="font-medium tabular-nums">
                          ৳ {money(creditSummary.creditLimit)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Due</span>
                        <span className="font-medium tabular-nums">
                          ৳ {money(creditSummary.currentDue)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Available</span>
                        <span
                          className={`font-bold tabular-nums ${
                            willExceed ? "text-rose-600" : "text-[#3aa838]"
                          }`}
                        >
                          ৳ {money(creditSummary.available)}
                        </span>
                      </div>

                      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={`h-full rounded-full transition-all ${
                            willExceed ? "bg-rose-500" : "bg-[#3aa838]"
                          }`}
                          style={{ width: `${usage}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {usage.toFixed(1)}% of limit used
                      </div>

                      {paymentMethod === "CREDIT" &&
                      creditSummary.dealerType !== "CREDIT" ? (
                        <div className="flex items-center gap-1.5 rounded-md bg-rose-50 p-2 text-xs font-medium text-rose-700">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          This dealer is cash only.
                        </div>
                      ) : null}

                      {willExceed ? (
                        <div className="flex items-center gap-1.5 rounded-md bg-rose-50 p-2 text-xs font-medium text-rose-700">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Credit limit will be exceeded by this order.
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-md bg-slate-50 p-3 text-xs text-muted-foreground">
                      Credit summary could not be loaded.
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={!canSubmit}
                    className="h-11 flex-1 bg-[#3aa838] text-base font-semibold shadow-md shadow-[#3aa838]/30 hover:bg-[#2f8a2f] disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                    )}
                    {saving ? "Creating..." : "Create order"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11"
                    onClick={() => void refreshAllRows()}
                    disabled={!customerId || !warehouseId}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={resetPage}
                  className="w-full text-slate-500"
                >
                  Reset form
                </Button>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <SectionHeader
                icon={Sparkles}
                title="Workflow"
                subtitle="4 quick steps"
              />
              <CardContent className="space-y-2 p-5 text-sm text-muted-foreground">
                {[
                  "Pick dealer and warehouse (warehouse auto-fills).",
                  "Add products — stock and promos load live.",
                  "Review totals and dealer credit.",
                  "Submit for approvals.",
                ].map((text, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#3aa838]/15 text-[10px] font-bold text-[#2f8a2f]">
                      {i + 1}
                    </span>
                    {text}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </form>
      </div>
    </div>
  );
}