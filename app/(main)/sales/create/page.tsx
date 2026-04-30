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
  Trash2,
  Copy,
  RefreshCw,
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
  paymentMethod: "CASH",
  taxPercent: 5,
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
  } = useForm<FormValues>({
    defaultValues,
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
      if (stockCache.current[cacheKey]) {
        return stockCache.current[cacheKey];
      }

      try {
        const res = await api.get("/product-stocks", {
          params: { productId, warehouseId: wId, page: 1, limit: 1 },
        });

        console.log("Product Stock: ", res.data);

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

  const canSubmitCredit =
    paymentMethod !== "CREDIT" ||
    (!!creditSummary &&
      creditSummary.dealerType === "CREDIT" &&
      creditSummary.available >= totals.grandTotal);

  const canSubmit =
    !saving &&
    !isSubmitting &&
    !!customerId &&
    !!warehouseId &&
    canSubmitCredit;

  const submitOrder = async (data: FormValues) => {
    if (!data.customerId) {
      toast.error("Please select a dealer.");
      return;
    }

    if (!data.warehouseId) {
      toast.error("Please select a warehouse.");
      return;
    }

    if (!data.items.length) {
      toast.error("Add at least one product.");
      return;
    }

    if ((dealerMeta?.status || "").toLowerCase() === "blocked") {
      toast.error("This dealer is blocked.");
      return;
    }

    for (let i = 0; i < data.items.length; i++) {
      const row = data.items[i];

      if (!row.productId) {
        toast.error(`Row ${i + 1}: select a product.`);
        return;
      }

      if (!row.qty || row.qty <= 0) {
        toast.error(`Row ${i + 1}: quantity must be greater than zero.`);
        return;
      }

      if (!row.unitPrice || row.unitPrice <= 0) {
        toast.error(`Row ${i + 1}: product price is missing.`);
        return;
      }

      if (Number(row.availableToSell || 0) < Number(row.qty || 0)) {
        const ok = window.confirm(
          `Row ${i + 1} (${row.productName}) available to sell is low (${row.availableToSell}). Continue anyway?`,
        );
        if (!ok) return;
      }
    }

    if (data.paymentMethod === "CREDIT") {
      if ((creditSummary?.dealerType || dealerMeta?.dealerType) !== "CREDIT") {
        toast.error("This dealer is not allowed for credit orders.");
        return;
      }

      if (
        creditSummary &&
        Number(creditSummary.available || 0) < Number(totals.grandTotal || 0)
      ) {
        toast.error("Credit limit exceeded.");
        return;
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
      console.error(err);
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

    if (fieldId) {
      stockCache.current[`${opt.value}|${warehouseId || ""}`] = stock;
    }
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

  const resetPage = () => {
    reset(defaultValues);
    replace([makeLine()]);
    setDealerMeta(null);
    setWarehouseMeta(null);
    setCreditSummary(null);
    setCreatedOrder(null);
    toast.message("Form reset.");
  };

  const selectedDealerLabel =
    dealerMeta?.label || customerId || "Select dealer";
  const selectedWarehouseLabel =
    warehouseMeta?.label || warehouseId || "Select warehouse";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl p-4 md:p-6">
        <div className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Create Sales Order</h1>
              <p className="text-sm text-muted-foreground">
                Clean order entry with live stock, promo, and credit validation.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-sm">
              <div className="rounded-md border bg-slate-50 px-3 py-2">
                Dealer:{" "}
                <span className="font-medium">{selectedDealerLabel}</span>
              </div>
              <div className="rounded-md border bg-slate-50 px-3 py-2">
                Warehouse:{" "}
                <span className="font-medium">{selectedWarehouseLabel}</span>
              </div>
              <div className="rounded-md border bg-slate-50 px-3 py-2">
                Total:{" "}
                <span className="font-medium">
                  {money(totals.grandTotal)} BDT
                </span>
              </div>
            </div>
          </div>
        </div>

        {createdOrder ? (
          <Card className="mb-6 border-emerald-200 bg-emerald-50/70">
            <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-medium text-emerald-700">
                  Order created successfully
                </div>
                <div className="mt-1 text-xl font-semibold">
                  {createdOrder.orderNo ||
                    createdOrder?.data?.orderNo ||
                    "Saved"}
                </div>
                <div className="text-sm text-emerald-700">
                  Status: {createdOrder.status || "PENDING_AM"}
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={resetPage}>
                  Create another
                </Button>
                <Button
                  type="button"
                  onClick={() => router.push("/sales/list")}
                >
                  Go to list
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <form
          onSubmit={handleSubmit(submitOrder)}
          className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]"
        >
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
                  />
                  <div className="text-xs text-muted-foreground">
                    {warehouseMeta?.description ||
                      "Open and search to load warehouses."}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Order date</div>
                  <Input type="date" {...register("orderDate")} />
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Payment method</div>
                  <select
                    {...register("paymentMethod")}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none"
                  >
                    <option value="CASH">Cash</option>
                    <option value="CREDIT">Credit</option>
                  </select>
                  <div className="text-xs text-muted-foreground">
                    Credit orders are validated against the dealer summary.
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Order items</CardTitle>
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
                          <div className="flex h-10 items-center rounded-md border bg-slate-50 px-3 text-sm">
                            {money(row.unitPrice)} BDT
                          </div>
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
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none"
                  placeholder="Internal remarks, delivery notes, special instructions..."
                />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6 lg:sticky lg:top-6 h-fit">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md bg-slate-100 p-3">
                    <div className="text-xs text-muted-foreground">Items</div>
                    <div className="text-xl font-semibold">
                      {watchedItems.length}
                    </div>
                  </div>
                  <div className="rounded-md bg-slate-100 p-3">
                    <div className="text-xs text-muted-foreground">Qty</div>
                    <div className="text-xl font-semibold">
                      {totals.totalQty}
                    </div>
                  </div>
                  <div className="rounded-md bg-slate-100 p-3">
                    <div className="text-xs text-muted-foreground">
                      Bonus qty
                    </div>
                    <div className="text-xl font-semibold">
                      {totals.totalBonusQty}
                    </div>
                  </div>
                  <div className="rounded-md bg-slate-100 p-3">
                    <div className="text-xs text-muted-foreground">
                      Discount
                    </div>
                    <div className="text-xl font-semibold">
                      {money(totals.totalDiscount)}
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-md border bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Subtotal
                    </span>
                    <span className="font-semibold">
                      {money(totals.subtotal)} BDT
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-muted-foreground">Tax %</span>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      {...register("taxPercent", { valueAsNumber: true })}
                      className="w-24"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Tax</span>
                    <span className="font-semibold">
                      {money(totals.totalTax)} BDT
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t pt-3">
                    <span className="text-base font-semibold">Grand total</span>
                    <span className="text-lg font-bold text-indigo-700">
                      {money(totals.grandTotal)} BDT
                    </span>
                  </div>
                </div>

                <div className="rounded-md border p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">Dealer credit</div>
                    <div className="text-xs text-muted-foreground">
                      {dealerMeta?.status || "Active"}
                    </div>
                  </div>

                  {!customerId ? (
                    <div className="mt-3 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                      Pick a dealer to load credit info.
                    </div>
                  ) : creditLoading ? (
                    <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading credit summary...
                    </div>
                  ) : creditSummary ? (
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Type</span>
                        <span className="font-medium">
                          {creditSummary.dealerType}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Credit limit
                        </span>
                        <span className="font-medium">
                          {money(creditSummary.creditLimit)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Due</span>
                        <span className="font-medium">
                          {money(creditSummary.currentDue)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Available</span>
                        <span
                          className={`font-semibold ${
                            paymentMethod === "CREDIT" &&
                            creditSummary.available < totals.grandTotal
                              ? "text-red-600"
                              : "text-emerald-600"
                          }`}
                        >
                          {money(creditSummary.available)}
                        </span>
                      </div>

                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{
                            width:
                              creditSummary.creditLimit > 0
                                ? `${Math.min(
                                    100,
                                    (creditSummary.currentDue /
                                      creditSummary.creditLimit) *
                                      100,
                                  )}%`
                                : "0%",
                          }}
                        />
                      </div>

                      {paymentMethod === "CREDIT" &&
                      creditSummary.dealerType !== "CREDIT" ? (
                        <div className="rounded-md bg-red-50 p-2 text-xs text-red-700">
                          This dealer is cash only.
                        </div>
                      ) : null}

                      {paymentMethod === "CREDIT" &&
                      creditSummary.available < totals.grandTotal ? (
                        <div className="rounded-md bg-red-50 p-2 text-xs text-red-700">
                          Credit limit will be exceeded by this order.
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-muted-foreground">
                      Credit summary could not be loaded.
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={!canSubmit}
                    className="flex-1"
                  >
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    {saving ? "Creating..." : "Create order"}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
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
                  className="w-full"
                >
                  Reset form
                </Button>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Workflow</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div>1. Pick dealer and warehouse.</div>
                <div>2. Add products with live stock and promo checks.</div>
                <div>3. Review totals and credit info.</div>
                <div>4. Submit for approvals.</div>
              </CardContent>
            </Card>
          </div>
        </form>
      </div>
    </div>
  );
}
