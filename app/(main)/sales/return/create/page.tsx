"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Undo2,
  Wallet,
  Package,
  Calendar,
  Building2,
  ArrowRight,
  Sparkles,
  Save,
} from "lucide-react";

/* --------------------------- Types --------------------------- */
type DealerOption = {
  value: string;
  label: string;
  description?: string;
  status?: string;
  dealerType?: "CASH" | "CREDIT";
};

type InvoiceItemOption = {
  productId: string;
  productName: string;
  sku?: string;
  invoiceQty: number;
  alreadyReturnedQty: number;
  maxReturnQty: number;
  unitPrice: number;
  invoiceLineTotal: number;
  warehouseId: string;
  promotionId?: string | null;
};

type InvoiceOption = {
  value: string;
  label: string;
  description?: string;
  invoiceNo: string;
  orderId: string;
  orderNo?: string;
  orderStatus?: string;
  warehouseId: string;
  warehouseName?: string;
  paymentStatus: "UNPAID" | "PARTIAL" | "PAID";
  status: "ACTIVE" | "CANCELLED" | "REFUNDED";
  grandTotal: number;
  paidAmount: number;
  balanceAmount: number;
  customerId: string;
  items: InvoiceItemOption[];
};

type InvoiceReturnableInfo = {
  invoiceId: string;
  grandTotal: number;
  paidAmount: number;
  balanceAmount: number;
  alreadyReturnedAmount: number;
  remainingReturnableAmount: number;
  itemMap: Map<
    string,
    { alreadyReturnedQty: number; remainingQty: number }
  >;
};

type ReturnRow = {
  id: string;
  productId: string;
  productName: string;
  sku?: string;
  invoiceQty: number;
  alreadyReturnedQty: number;
  maxReturnQty: number;
  returnQty: string;
  reason: string;
  unitPrice: number;
  invoiceLineTotal: number;
  warehouseId: string;
  promotionId?: string | null;
};

type ReturnInvoiceSection = {
  invoiceId: string;
  invoiceNo: string;
  orderId: string;
  warehouseId: string;
  warehouseName?: string;
  paymentStatus: "UNPAID" | "PARTIAL" | "PAID";
  status: "ACTIVE" | "CANCELLED" | "REFUNDED";
  grandTotal: number;
  paidAmount: number;
  balanceAmount: number;
  rows: ReturnRow[];
};

/* --------------------------- Helpers --------------------------- */
const today = new Date().toISOString().slice(0, 10);

const money = (n: number) =>
  Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

function clampDigitsOnly(raw: string) {
  return raw.replace(/[^\d]/g, "");
}

function toNumber(value: string | number | undefined | null, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function calcEffectiveUnitPrice(invoiceLineTotal: number, invoiceQty: number) {
  const qty = Math.max(1, Number(invoiceQty || 0));
  return Number(invoiceLineTotal || 0) / qty;
}

function calcRowAmount(row: Pick<ReturnRow, "returnQty" | "unitPrice">) {
  return toNumber(row.returnQty, 0) * Number(row.unitPrice || 0);
}

function makeBlankRow(): ReturnRow {
  return {
    id: uid(),
    productId: "",
    productName: "",
    sku: "",
    invoiceQty: 0,
    alreadyReturnedQty: 0,
    maxReturnQty: 0,
    returnQty: "",
    reason: "",
    unitPrice: 0,
    invoiceLineTotal: 0,
    warehouseId: "",
    promotionId: null,
  };
}

/** Fetches per-product returnable qtys AND invoice-level amount info. */
async function fetchReturnableQuantities(
  invoiceId: string,
): Promise<InvoiceReturnableInfo | null> {
  try {
    const res = await api.get("/sales-returns/returnable-quantities", {
      params: { invoiceId },
    });
    const data = res.data?.data;
    if (!data) return null;

    const itemMap = new Map<
      string,
      { alreadyReturnedQty: number; remainingQty: number }
    >();
    for (const item of data.items || []) {
      itemMap.set(item.productId, {
        alreadyReturnedQty: Number(item.alreadyReturnedQty || 0),
        remainingQty: Number(item.remainingQty || 0),
      });
    }

    return {
      invoiceId: String(data.invoiceId || invoiceId),
      grandTotal: Number(data.grandTotal || 0),
      paidAmount: Number(data.paidAmount || 0),
      balanceAmount: Number(data.balanceAmount || 0),
      alreadyReturnedAmount: Number(data.alreadyReturnedAmount || 0),
      remainingReturnableAmount: Number(data.remainingReturnableAmount || 0),
      itemMap,
    };
  } catch {
    toast.error("Failed to load returnable quantities.");
    return null;
  }
}

function normalizeInvoiceItem(item: any): InvoiceItemOption {
  const product = item.productId || {};
  const productName = product.name || item.productName || "Unknown Product";
  const invoiceQty = Number(item.qty || 0) + Number(item.bonusQty || 0);
  const lineTotal = Number(item.lineTotal ?? item.lineSubtotal ?? 0);
  const unitPrice = calcEffectiveUnitPrice(lineTotal, invoiceQty);

  return {
    productId: String(product._id || item.productId || ""),
    productName,
    sku: product.sku || item.sku || "",
    invoiceQty,
    alreadyReturnedQty: 0,
    maxReturnQty: invoiceQty,
    unitPrice,
    invoiceLineTotal: lineTotal,
    warehouseId: String(item.warehouseId?._id || item.warehouseId || ""),
    promotionId: item.promotionId ? String(item.promotionId) : null,
  };
}

function normalizeInvoice(invoice: any): InvoiceOption {
  return {
    value: String(invoice._id || invoice.id),
    label: String(invoice.invoiceNo || invoice._id || "Invoice"),
    description: [
      invoice.orderId?.orderNo ? `Order: ${invoice.orderId.orderNo}` : "",
      invoice.paymentStatus ? `Payment: ${invoice.paymentStatus}` : "",
      invoice.balanceAmount != null
        ? `Balance: ${money(Number(invoice.balanceAmount || 0))}`
        : "",
    ]
      .filter(Boolean)
      .join(" · "),
    invoiceNo: String(invoice.invoiceNo || invoice._id || "Invoice"),
    orderId: String(invoice.orderId?._id || invoice.orderId || ""),
    orderNo: String(invoice.orderId?.orderNo || ""),
    orderStatus: invoice.orderId?.status,
    warehouseId: String(invoice.warehouseId?._id || invoice.warehouseId || ""),
    warehouseName: invoice.warehouseId?.name,
    paymentStatus: invoice.paymentStatus || "UNPAID",
    status: invoice.status || "ACTIVE",
    grandTotal: Number(invoice.grandTotal || 0),
    paidAmount: Number(invoice.paidAmount || 0),
    balanceAmount: Number(invoice.balanceAmount || 0),
    customerId: String(invoice.customerId?._id || invoice.customerId || ""),
    items: Array.isArray(invoice.items)
      ? invoice.items.map(normalizeInvoiceItem)
      : [],
  };
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
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3aa838]/10">
          <Icon className="h-4 w-4 text-[#3aa838]" />
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

/* --------------------------- SearchSelect --------------------------- */
function SearchSelect({
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
  onPick: (option: DealerOption) => void;
  fetchOptions: (query: string) => Promise<DealerOption[]>;
  placeholder: string;
  searchPlaceholder: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<DealerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef<Record<string, DealerOption[]>>({});

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

/* --------------------------- InvoicePicker --------------------------- */
function InvoicePicker({
  dealerId,
  selectedIds,
  onToggle,
}: {
  dealerId?: string;
  selectedIds: string[];
  onToggle: (invoice: InvoiceOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<InvoiceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef<Record<string, InvoiceOption[]>>({});

  const fetchInvoices = useCallback(
    async (search: string) => {
      if (!dealerId) return [];
      const key = `${dealerId}|${search.trim().toLowerCase()}`;
      if (cacheRef.current[key]) return cacheRef.current[key];

      setLoading(true);
      try {
        const res = await api.get("/sales-invoices", {
          params: {
            customerId: dealerId,
            status: "ACTIVE",
            q: search || undefined,
            page: 1,
            limit: 200,
            populate: "orderId,items.productId",
          },
        });

        const list = (res.data?.data || [])
          .map((inv: any) => normalizeInvoice(inv))
          .filter((inv: InvoiceOption) => inv.orderStatus === "DELIVERED");
        cacheRef.current[key] = list;
        return list;
      } finally {
        setLoading(false);
      }
    },
    [dealerId],
  );

  useEffect(() => {
    if (!open || !dealerId) return;
    const timer = setTimeout(async () => {
      const list = await fetchInvoices(query);
      setOptions(list);
    }, 250);
    return () => clearTimeout(timer);
  }, [open, query, fetchInvoices, dealerId]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={!dealerId}
          className="h-10 w-full justify-between bg-white"
        >
          <span className="truncate">
            {selectedIds.length
              ? `${selectedIds.length} invoice(s) selected`
              : "Select invoices"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[560px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search invoice number..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? "Loading..." : "No invoice found."}
            </CommandEmpty>
            <CommandGroup>
              {options.map((invoice) => {
                const selected = selectedIds.includes(invoice.value);
                const fullyPaid = Number(invoice.balanceAmount || 0) <= 0;
                const blocked = fullyPaid || invoice.status !== "ACTIVE";

                return (
                  <CommandItem
                    key={invoice.value}
                    value={`${invoice.label} ${invoice.description || ""}`}
                    onSelect={() => {
                      if (blocked) {
                        toast.error("This invoice cannot be returned.");
                        return;
                      }
                      onToggle(invoice);
                    }}
                    className={blocked ? "opacity-50" : ""}
                  >
                    <div className="mr-2 flex h-5 w-5 items-center justify-center">
                      {selected ? (
                        <Check className="h-4 w-4 text-[#3aa838]" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">
                          {invoice.label}
                        </span>
                        {selected && (
                          <span className="rounded-full bg-[#3aa838]/10 px-2 py-0.5 text-[10px] font-semibold text-[#2f8a2f]">
                            Added
                          </span>
                        )}
                        {fullyPaid && (
                          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                            Fully paid
                          </span>
                        )}
                        {invoice.orderStatus !== "DELIVERED" && (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            Not delivered
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {invoice.description || "No extra details"}
                      </div>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* --------------------------- ProductPicker --------------------------- */
function ProductPicker({
  value,
  options,
  onPick,
  disabled,
}: {
  value?: string;
  options: Array<InvoiceItemOption & { blocked?: boolean }>;
  onPick: (option: InvoiceItemOption) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = options.find((o) => o.productId === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => {
      const hay = `${opt.productName} ${opt.sku || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [options, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="h-10 w-full justify-between overflow-hidden bg-white"
        >
          <span className="truncate">
            {selected?.productName || "Select product"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search product in this invoice..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>No product found.</CommandEmpty>
            <CommandGroup>
              {filtered.map((opt) => {
                const selectedProduct = opt.productId === value;
                const blocked = Boolean(opt.blocked) || opt.maxReturnQty <= 0;

                return (
                  <CommandItem
                    key={opt.productId}
                    value={`${opt.productName} ${opt.sku || ""}`}
                    onSelect={() => {
                      if (blocked) {
                        toast.error(
                          "This product is already selected or has no returnable qty left.",
                        );
                        return;
                      }
                      onPick(opt);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={blocked ? "opacity-50" : ""}
                  >
                    <Check
                      className={`mr-2 h-4 w-4 ${
                        selectedProduct ? "opacity-100 text-[#3aa838]" : "opacity-0"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">
                          {opt.productName}
                        </span>
                        {blocked && (
                          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                            Not available
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        Invoice qty: {opt.invoiceQty} · Returned:{" "}
                        {opt.alreadyReturnedQty} · Remaining: {opt.maxReturnQty}
                      </div>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* ===================== Main Page ===================== */
export default function SalesReturnCreatePage() {
  const router = useRouter();

  const [dealer, setDealer] = useState<DealerOption | null>(null);
  const [invoiceOptions, setInvoiceOptions] = useState<InvoiceOption[]>([]);
  const [sections, setSections] = useState<ReturnInvoiceSection[]>([]);
  const [returnDate, setReturnDate] = useState<string>(today);
  const [notes, setNotes] = useState("");
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createdReturn, setCreatedReturn] = useState<any>(null);

  // 🆕 Invoice-level + product-level returnable info
  const [returnableMap, setReturnableMap] = useState<
    Map<string, InvoiceReturnableInfo>
  >(new Map());

  const selectedInvoiceIds = useMemo(
    () => sections.map((s) => s.invoiceId),
    [sections],
  );

  const selectedInvoiceMap = useMemo(() => {
    const map = new Map<string, InvoiceOption>();
    for (const inv of invoiceOptions) map.set(inv.value, inv);
    return map;
  }, [invoiceOptions]);

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
    })) as DealerOption[];
  }, []);

  const loadInvoicesForDealer = useCallback(async (dealerId: string) => {
    if (!dealerId) return [];

    const res = await api.get("/sales-invoices", {
      params: {
        customerId: dealerId,
        status: "ACTIVE",
        page: 1,
        limit: 200,
        populate: "orderId,items.productId",
      },
    });

    const list = (res.data?.data || [])
      .map((inv: any) => normalizeInvoice(inv))
      .filter((inv: InvoiceOption) => inv.orderStatus === "DELIVERED");

    setInvoiceOptions(list);

    const map = new Map<string, InvoiceReturnableInfo>();
    for (const inv of list) {
      try {
        const info = await fetchReturnableQuantities(inv.value);
        if (info) map.set(inv.value, info);
      } catch {
        // ignore errors
      }
    }
    setReturnableMap(map);

    return list;
  }, []);

  useEffect(() => {
    if (!dealer?.value) {
      setInvoiceOptions([]);
      setSections([]);
      setReturnableMap(new Map());
      return;
    }
    setLoadingInvoices(true);
    loadInvoicesForDealer(dealer.value)
      .catch(() => {
        setInvoiceOptions([]);
        setSections([]);
        setReturnableMap(new Map());
      })
      .finally(() => setLoadingInvoices(false));
  }, [dealer?.value, loadInvoicesForDealer]);

  const toggleInvoice = useCallback(
    (invoice: InvoiceOption) => {
      setSections((current) => {
        const exists = current.some((s) => s.invoiceId === invoice.value);
        if (exists) {
          return current.filter((s) => s.invoiceId !== invoice.value);
        }
        if (Number(invoice.balanceAmount || 0) <= 0) {
          toast.error("Fully paid invoices cannot be returned.");
          return current;
        }
        if (!returnableMap.has(invoice.value)) {
          fetchReturnableQuantities(invoice.value).then((info) => {
            if (info) {
              setReturnableMap((prev) => {
                const next = new Map(prev);
                next.set(invoice.value, info);
                return next;
              });
            }
          });
        }
        return [
          ...current,
          {
            invoiceId: invoice.value,
            invoiceNo: invoice.invoiceNo,
            orderId: invoice.orderId,
            warehouseId: invoice.warehouseId,
            warehouseName: invoice.warehouseName,
            paymentStatus: invoice.paymentStatus,
            status: invoice.status,
            grandTotal: invoice.grandTotal,
            paidAmount: invoice.paidAmount,
            balanceAmount: invoice.balanceAmount,
            rows: [makeBlankRow()],
          },
        ];
      });
    },
    [returnableMap],
  );

  const updateSection = useCallback(
    (
      invoiceId: string,
      updater: (section: ReturnInvoiceSection) => ReturnInvoiceSection,
    ) => {
      setSections((current) =>
        current.map((section) =>
          section.invoiceId === invoiceId ? updater(section) : section,
        ),
      );
    },
    [],
  );

  const removeInvoice = useCallback((invoiceId: string) => {
    setSections((current) =>
      current.filter((section) => section.invoiceId !== invoiceId),
    );
  }, []);

  const addRow = useCallback(
    (invoiceId: string) => {
      const invoice = selectedInvoiceMap.get(invoiceId);
      if (!invoice) return;
      updateSection(invoiceId, (section) => {
        const productCount = invoice.items.length;
        if (section.rows.length >= productCount) {
          toast.error("You have already used all products from this invoice.");
          return section;
        }
        const remainingProducts = invoice.items.filter(
          (opt) => !section.rows.some((row) => row.productId === opt.productId),
        );
        if (!remainingProducts.length) {
          toast.error("No more products are available from this invoice.");
          return section;
        }
        return { ...section, rows: [...section.rows, makeBlankRow()] };
      });
    },
    [selectedInvoiceMap, updateSection],
  );

  const removeRow = useCallback(
    (invoiceId: string, rowId: string) => {
      updateSection(invoiceId, (section) => {
        if (section.rows.length === 1) {
          return { ...section, rows: [makeBlankRow()] };
        }
        return {
          ...section,
          rows: section.rows.filter((r) => r.id !== rowId),
        };
      });
    },
    [updateSection],
  );

  const updateRow = useCallback(
    (invoiceId: string, rowId: string, patch: Partial<ReturnRow>) => {
      updateSection(invoiceId, (section) => ({
        ...section,
        rows: section.rows.map((row) =>
          row.id === rowId ? { ...row, ...patch } : row,
        ),
      }));
    },
    [updateSection],
  );

  const pickProduct = useCallback(
    (invoiceId: string, rowId: string, option: InvoiceItemOption) => {
      updateSection(invoiceId, (section) => {
        const alreadyUsedElsewhere = section.rows.some(
          (row) => row.id !== rowId && row.productId === option.productId,
        );
        if (alreadyUsedElsewhere) {
          toast.error("This product is already used in this invoice.");
          return section;
        }

        const returnInfo = returnableMap.get(invoiceId);
        const itemInfo = returnInfo?.itemMap.get(option.productId);
        const realAlreadyReturned =
          itemInfo?.alreadyReturnedQty ?? option.alreadyReturnedQty;
        const realRemaining = itemInfo?.remainingQty ?? option.maxReturnQty;

        return {
          ...section,
          rows: section.rows.map((row) =>
            row.id === rowId
              ? {
                  ...row,
                  productId: option.productId,
                  productName: option.productName,
                  sku: option.sku,
                  invoiceQty: option.invoiceQty,
                  alreadyReturnedQty: realAlreadyReturned,
                  maxReturnQty: realRemaining,
                  returnQty: "",
                  reason: row.reason || "",
                  unitPrice: option.unitPrice,
                  invoiceLineTotal: option.invoiceLineTotal,
                  warehouseId: option.warehouseId,
                  promotionId: option.promotionId,
                }
              : row,
          ),
        };
      });
    },
    [returnableMap, updateSection],
  );

  const getInvoiceRemainingQty = useCallback(
    (section: ReturnInvoiceSection) => {
      const info = returnableMap.get(section.invoiceId);
      if (!info) return 0;
      let remaining = 0;
      for (const [, item] of info.itemMap) {
        remaining += item.remainingQty;
      }
      const usedBySection = section.rows.reduce(
        (sum, row) => sum + toNumber(row.returnQty, 0),
        0,
      );
      return Math.max(0, remaining - usedBySection);
    },
    [returnableMap],
  );

  const getEffectiveMaxForRow = useCallback(
    (section: ReturnInvoiceSection, row: ReturnRow) => {
      if (!row.productId) return 0;
      const info = returnableMap.get(section.invoiceId);
      if (!info) return 0;
      const item = info.itemMap.get(row.productId);
      if (!item) return 0;
      const otherRowsQty = section.rows
        .filter((r) => r.id !== row.id && r.productId === row.productId)
        .reduce((sum, r) => sum + toNumber(r.returnQty, 0), 0);
      return Math.max(0, item.remainingQty - otherRowsQty);
    },
    [returnableMap],
  );

  // 🆕 Invoice-level amount helpers
  const getInvoiceAlreadyReturnedAmount = useCallback(
    (invoiceId: string) =>
      returnableMap.get(invoiceId)?.alreadyReturnedAmount || 0,
    [returnableMap],
  );

  const getInvoiceRemainingReturnableAmount = useCallback(
    (invoiceId: string) =>
      returnableMap.get(invoiceId)?.remainingReturnableAmount || 0,
    [returnableMap],
  );

  const availableProductOptions = useCallback(
    (section: ReturnInvoiceSection, currentRowId: string) => {
      const invoice = selectedInvoiceMap.get(section.invoiceId);
      if (!invoice) return [];

      const usedProductIds = new Set(
        section.rows
          .filter((row) => row.id !== currentRowId && row.productId)
          .map((row) => row.productId),
      );

      const info = returnableMap.get(section.invoiceId);

      return invoice.items.map((item) => {
        const realInfo = info?.itemMap.get(item.productId);
        const alreadyReturned =
          realInfo?.alreadyReturnedQty ?? item.alreadyReturnedQty;
        const remaining = realInfo?.remainingQty ?? item.maxReturnQty;

        return {
          ...item,
          alreadyReturnedQty: alreadyReturned,
          maxReturnQty: remaining,
          blocked: usedProductIds.has(item.productId) || remaining <= 0,
        };
      });
    },
    [selectedInvoiceMap, returnableMap],
  );

  const invoiceCards = useMemo(() => {
    return sections.map((section) => {
      const invoice = selectedInvoiceMap.get(section.invoiceId);
      const validRows = section.rows.filter(
        (r) => r.productId && toNumber(r.returnQty, 0) > 0,
      );
      const returnAmount = validRows.reduce(
        (sum, row) => sum + calcRowAmount(row),
        0,
      );
      const returnQty = validRows.reduce(
        (sum, row) => sum + toNumber(row.returnQty, 0),
        0,
      );
      const alreadyReturned = getInvoiceAlreadyReturnedAmount(
        section.invoiceId,
      );
      const remainingReturnable = getInvoiceRemainingReturnableAmount(
        section.invoiceId,
      );
      const overLimit = returnAmount > remainingReturnable + 0.0001;

      return {
        section,
        invoice,
        returnAmount,
        returnQty,
        alreadyReturned,
        remainingReturnable,
        overLimit,
      };
    });
  }, [
    sections,
    selectedInvoiceMap,
    getInvoiceAlreadyReturnedAmount,
    getInvoiceRemainingReturnableAmount,
  ]);

  const grandReturnAmount = useMemo(
    () =>
      invoiceCards.reduce(
        (sum, item) => sum + Number(item.returnAmount || 0),
        0,
      ),
    [invoiceCards],
  );

  const grandReturnQty = useMemo(
    () =>
      invoiceCards.reduce((sum, item) => sum + Number(item.returnQty || 0), 0),
    [invoiceCards],
  );

  const totalSelectedProducts = useMemo(
    () =>
      sections.reduce(
        (sum, s) =>
          sum +
          s.rows.filter((r) => r.productId && toNumber(r.returnQty, 0) > 0)
            .length,
        0,
      ),
    [sections],
  );

  const validateBeforeSubmit = () => {
    if (!dealer?.value) {
      toast.error("Please select a dealer.");
      return false;
    }
    if (!returnDate) {
      toast.error("Please select return date.");
      return false;
    }
    if (!sections.length) {
      toast.error("Please select at least one invoice.");
      return false;
    }
    for (const card of invoiceCards) {
      const invoice = card.invoice;
      const section = card.section;
      if (!invoice) {
        toast.error(`Invoice ${section.invoiceNo} could not be loaded.`);
        return false;
      }
      const remainingReturnable = card.remainingReturnable;
      if (remainingReturnable <= 0) {
        toast.error(
          `Invoice ${invoice.invoiceNo} has no remaining returnable amount.`,
        );
        return false;
      }
      const validRows = section.rows.filter(
        (r) => r.productId && toNumber(r.returnQty, 0) > 0,
      );
      if (!validRows.length) {
        toast.error(
          `Add at least one product for invoice ${invoice.invoiceNo}.`,
        );
        return false;
      }
      const invoiceReturnAmount = validRows.reduce(
        (sum, row) => sum + calcRowAmount(row),
        0,
      );
      if (invoiceReturnAmount > remainingReturnable + 0.0001) {
        toast.error(
          `Invoice ${invoice.invoiceNo}: return amount ৳${money(
            invoiceReturnAmount,
          )} exceeds remaining returnable ৳${money(remainingReturnable)}.`,
        );
        return false;
      }
      for (const row of validRows) {
        const qty = toNumber(row.returnQty, 0);
        const maxQty = getEffectiveMaxForRow(section, row);
        if (qty <= 0) {
          toast.error(
            `Return qty must be greater than zero for ${row.productName}.`,
          );
          return false;
        }
        if (qty > maxQty) {
          toast.error(
            `${row.productName}: return qty cannot exceed ${maxQty}.`,
          );
          return false;
        }
      }
    }
    return true;
  };

  const submit = async () => {
    if (!validateBeforeSubmit()) return;

    const payload = {
      customerId: dealer?.value,
      returnDate: new Date(returnDate).toISOString(),
      notes,
      invoiceReturns: sections.map((section) => {
        const invoice = selectedInvoiceMap.get(section.invoiceId)!;
        const items = section.rows
          .filter((r) => r.productId && toNumber(r.returnQty, 0) > 0)
          .map((row) => ({
            productId: row.productId,
            qty: toNumber(row.returnQty, 0),
            reason: row.reason || "",
            unitPrice: row.unitPrice,
            invoiceQty: row.invoiceQty,
            alreadyReturnedQty: row.alreadyReturnedQty,
            lineReturnAmount: calcRowAmount(row),
            promotionId: row.promotionId || undefined,
          }));

        return {
          invoiceId: section.invoiceId,
          orderId: section.orderId,
          warehouseId: section.warehouseId,
          invoiceNo: section.invoiceNo,
          paymentStatus: invoice.paymentStatus,
          balanceAmount: invoice.balanceAmount,
          paidAmount: invoice.paidAmount,
          items,
        };
      }),
    };

    setSubmitting(true);
    try {
      const res = await api.post("/sales-returns", payload);
      const created = res.data?.data || res.data;
      setCreatedReturn(created);
      toast.success("Sales return created successfully.");

      setDealer(null);
      setInvoiceOptions([]);
      setSections([]);
      setReturnDate(today);
      setNotes("");
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to create sales return.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const resetPage = () => {
    setDealer(null);
    setInvoiceOptions([]);
    setSections([]);
    setReturnDate(today);
    setNotes("");
    setCreatedReturn(null);
    toast.message("Form reset.");
  };

  const onPickDealer = async (opt: DealerOption) => {
    setDealer(opt);
    setInvoiceOptions([]);
    setSections([]);
  };

  const selectedDealerLabel = dealer?.label || "Select dealer";

  const canSubmit =
    !submitting &&
    !!dealer?.value &&
    sections.length > 0 &&
    grandReturnQty > 0 &&
    !invoiceCards.some((c) => c.overLimit);

  /* ------------------- Render ------------------- */
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl p-3 md:p-4">
        {/* ============ HERO ============ */}
        <div className="relative mb-3 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-[#1a4d1a] p-5 text-white shadow-lg">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(58,168,56,0.25),transparent_55%)]" />
          <div className="relative flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#3aa838]/25 ring-1 ring-[#3aa838]/40">
                <Undo2 className="h-5 w-5 text-[#7cd67a]" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">
                  Create Sales Return
                </h1>
                <p className="text-xs text-white/70">
                  Select a dealer, pick invoices, return only remaining amounts.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <div className="rounded-lg bg-white/10 px-3 py-2 ring-1 ring-white/15">
                <div className="text-[10px] uppercase tracking-wide text-white/60">
                  Dealer
                </div>
                <div className="max-w-[180px] truncate font-semibold">
                  {selectedDealerLabel}
                </div>
              </div>
              <div className="rounded-lg bg-white/10 px-3 py-2 ring-1 ring-white/15">
                <div className="text-[10px] uppercase tracking-wide text-white/60">
                  Invoices
                </div>
                <div className="font-semibold tabular-nums">
                  {sections.length}
                </div>
              </div>
              <div className="rounded-lg bg-white/10 px-3 py-2 ring-1 ring-white/15">
                <div className="text-[10px] uppercase tracking-wide text-white/60">
                  Qty
                </div>
                <div className="font-semibold tabular-nums">
                  {grandReturnQty}
                </div>
              </div>
              <div className="rounded-lg bg-[#3aa838] px-3 py-2 shadow-md shadow-black/40">
                <div className="text-[10px] uppercase tracking-wide text-[#c6e8c5]">
                  Amount
                </div>
                <div className="font-semibold tabular-nums">
                  ৳ {money(grandReturnAmount)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ============ SUCCESS CARD ============ */}
        {createdReturn ? (
          <Card className="mb-3 border-[#3aa838]/30 bg-gradient-to-r from-[#3aa838]/10 to-white shadow-md">
            <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#3aa838] text-white shadow-lg shadow-[#3aa838]/30">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-medium text-[#2f8a2f]">
                    Sales return created successfully
                  </div>
                  <div className="text-lg font-bold tabular-nums">
                    {createdReturn.returnNo ||
                      createdReturn?.data?.returnNo ||
                      "Saved"}
                  </div>
                  <div className="text-[11px] text-[#2f8a2f]">
                    Status: {createdReturn.status || "PENDING"}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetPage}
                  className="h-9"
                >
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  Create another
                </Button>
                <Button
                  type="button"
                  onClick={() => router.push("/sales/return")}
                  className="h-9 bg-[#3aa838] text-white hover:bg-[#2f8a2f]"
                >
                  Go to list
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* ============ MAIN GRID ============ */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* -------- LEFT COLUMN -------- */}
          <div className="space-y-4">
            {/* Return basics */}
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <SectionHeader
                icon={Building2}
                title="Return basics"
                subtitle="Dealer, return date, and invoices to return"
              />
              <CardContent className="grid gap-3 p-4 md:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600">
                    Dealer
                  </label>
                  <SearchSelect
                    value={dealer?.value}
                    selectedLabel={dealer?.label}
                    onPick={onPickDealer}
                    fetchOptions={fetchDealers}
                    placeholder="Search dealer"
                    searchPlaceholder="Type dealer name / phone..."
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1 text-xs font-medium text-slate-600">
                    <Calendar className="h-3 w-3" />
                    Return date
                  </label>
                  <Input
                    type="date"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600">
                    Invoices
                  </label>
                  <InvoicePicker
                    dealerId={dealer?.value}
                    selectedIds={selectedInvoiceIds}
                    onToggle={toggleInvoice}
                  />
                  <div className="text-[11px] text-muted-foreground">
                    Fully paid and undelivered invoices are blocked.
                  </div>
                </div>
              </CardContent>
            </Card>

            {loadingInvoices ? (
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading invoices...
                </CardContent>
              </Card>
            ) : null}

            {selectedInvoiceIds.length === 0 && !loadingInvoices ? (
              <Card className="overflow-hidden border-dashed border-slate-300 bg-white shadow-sm">
                <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
                  <div className="rounded-full bg-slate-100 p-3">
                    <Search className="h-5 w-5 text-slate-500" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      No invoices selected
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      Pick one or more delivered invoices to begin the return.
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {/* Invoice cards */}
            {invoiceCards.map(
              ({
                section,
                invoice,
                returnAmount,
                alreadyReturned,
                remainingReturnable,
                overLimit,
              }) => {
                if (!invoice) return null;

                const fullyPaid = Number(section.balanceAmount || 0) <= 0;
                const invoiceRemainingQty = getInvoiceRemainingQty(section);
                const excessAmount = Math.max(
                  0,
                  returnAmount - remainingReturnable,
                );

                return (
                  <Card
                    key={section.invoiceId}
                    className="overflow-hidden border-slate-200 shadow-sm"
                  >
                    <SectionHeader
                      icon={FileText}
                      title={section.invoiceNo}
                      subtitle={`Order ${section?.orderNo || section.orderId || "—"} · ${section.warehouseName || section.warehouseId || "—"}`}
                      right={
                        <div className="flex items-center gap-2">
                          <Badge
                            className={`${
                              section.paymentStatus === "PAID"
                                ? "border-[#3aa838]/30 bg-[#3aa838]/10 text-[#2f8a2f]"
                                : section.paymentStatus === "PARTIAL"
                                  ? "border-amber-200 bg-amber-50 text-amber-700"
                                  : "border-rose-200 bg-rose-50 text-rose-700"
                            } text-[10px] font-semibold`}
                          >
                            {section.paymentStatus}
                          </Badge>
                          {fullyPaid ? (
                            <Badge className="border-rose-200 bg-rose-50 text-[10px] font-semibold text-rose-700">
                              Fully paid
                            </Badge>
                          ) : (
                            <Badge className="border-[#3aa838]/30 bg-[#3aa838]/10 text-[10px] font-semibold text-[#2f8a2f]">
                              Returnable
                            </Badge>
                          )}
                        </div>
                      }
                    />

                    <CardContent className="space-y-3 p-4">
                      {/* Metric strip row 1 */}
                      <div className="grid gap-2 sm:grid-cols-3">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Invoice total
                          </div>
                          <div className="text-sm font-semibold tabular-nums text-slate-900">
                            ৳ {money(section.grandTotal)}
                          </div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Paid
                          </div>
                          <div className="text-sm font-semibold tabular-nums text-[#2f8a2f]">
                            ৳ {money(section.paidAmount)}
                          </div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Balance
                          </div>
                          <div className="text-sm font-semibold tabular-nums text-amber-700">
                            ৳ {money(section.balanceAmount)}
                          </div>
                        </div>
                      </div>

                      {/* 🆕 Already returned / remaining / current */}
                      <div
                        className={`grid gap-2 rounded-lg border-2 px-3 py-2 sm:grid-cols-3 ${
                          overLimit
                            ? "border-rose-300 bg-rose-50"
                            : "border-[#3aa838]/30 bg-[#3aa838]/5"
                        }`}
                      >
                        <div>
                          <div
                            className={`text-[10px] uppercase tracking-wide ${
                              overLimit ? "text-rose-700" : "text-[#2f8a2f]"
                            }`}
                          >
                            Already returned
                          </div>
                          <div
                            className={`text-sm font-semibold tabular-nums ${
                              overLimit ? "text-rose-700" : "text-[#2f8a2f]"
                            }`}
                          >
                            ৳ {money(alreadyReturned)}
                          </div>
                        </div>
                        <div>
                          <div
                            className={`text-[10px] uppercase tracking-wide ${
                              overLimit ? "text-rose-700" : "text-[#2f8a2f]"
                            }`}
                          >
                            Remaining returnable
                          </div>
                          <div
                            className={`text-sm font-bold tabular-nums ${
                              overLimit ? "text-rose-700" : "text-[#2f8a2f]"
                            }`}
                          >
                            ৳ {money(remainingReturnable)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-slate-600">
                            This return
                          </div>
                          <div
                            className={`text-sm font-semibold tabular-nums ${
                              overLimit ? "text-rose-700" : "text-slate-900"
                            }`}
                          >
                            ৳ {money(returnAmount)}
                          </div>
                        </div>
                      </div>

                      {overLimit && (
                        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <div>
                            This return exceeds the remaining returnable amount
                            by <b>৳ {money(excessAmount)}</b>. Reduce the
                            quantities below.
                          </div>
                        </div>
                      )}

                      {fullyPaid && (
                        <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
                          This invoice is fully paid and cannot be returned.
                        </div>
                      )}

                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-muted-foreground">
                        Remaining returnable qty for this invoice:{" "}
                        <b className="text-slate-900 tabular-nums">
                          {invoiceRemainingQty}
                        </b>
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addRow(section.invoiceId)}
                          disabled={fullyPaid || invoiceRemainingQty <= 0}
                          className="h-8"
                        >
                          <Plus className="mr-1.5 h-3.5 w-3.5" />
                          Add item
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeInvoice(section.invoiceId)}
                          className="h-8 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        >
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                          Remove invoice
                        </Button>
                      </div>

                      {/* Row cards */}
                      <div className="space-y-3">
                        {section.rows.map((row) => {
                          const options = availableProductOptions(
                            section,
                            row.id,
                          );
                          const selectedOption = options.find(
                            (o) => o.productId === row.productId,
                          );
                          const effectiveMax = getEffectiveMaxForRow(
                            section,
                            row,
                          );
                          const rowAmount = calcRowAmount(row);
                          const overMax =
                            row.productId &&
                            toNumber(row.returnQty, 0) > effectiveMax;

                          return (
                            <div
                              key={row.id}
                              className={`rounded-xl border-2 bg-white p-3 transition-colors ${
                                overMax
                                  ? "border-rose-300 bg-rose-50/30"
                                  : "border-slate-200 hover:border-[#3aa838]/40"
                              }`}
                            >
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                                    {row.productName ? "•" : "+"}
                                  </div>
                                  <div>
                                    <div className="text-sm font-semibold text-slate-900">
                                      {row.productName || "New item"}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground">
                                      Choose from this invoice only. No
                                      duplicates.
                                    </div>
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    removeRow(section.invoiceId, row.id)
                                  }
                                  className="h-7 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                >
                                  <Trash2 className="mr-1 h-3 w-3" />
                                  Remove
                                </Button>
                              </div>

                              <div className="grid gap-3 md:grid-cols-12">
                                <div className="space-y-1.5 md:col-span-5">
                                  <label className="text-xs font-medium text-slate-600">
                                    Product
                                  </label>
                                  <ProductPicker
                                    value={row.productId}
                                    options={options}
                                    onPick={(opt) =>
                                      pickProduct(
                                        section.invoiceId,
                                        row.id,
                                        opt,
                                      )
                                    }
                                    disabled={fullyPaid}
                                  />
                                  <div className="text-[10px] text-muted-foreground">
                                    {selectedOption ? (
                                      <>
                                        Invoice: {selectedOption.invoiceQty} ·
                                        Returned:{" "}
                                        {selectedOption.alreadyReturnedQty} ·
                                        Remaining: {effectiveMax}
                                      </>
                                    ) : (
                                      "Choose a product from this invoice."
                                    )}
                                  </div>
                                </div>

                                <div className="space-y-1.5 md:col-span-2">
                                  <label className="text-xs font-medium text-slate-600">
                                    Invoice qty
                                  </label>
                                  <div className="flex h-10 items-center rounded-md border bg-slate-50 px-3 text-sm font-semibold tabular-nums">
                                    {row.invoiceQty}
                                  </div>
                                </div>

                                <div className="space-y-1.5 md:col-span-2">
                                  <label className="text-xs font-medium text-slate-600">
                                    Return qty
                                  </label>
                                  <Input
                                    inputMode="numeric"
                                    placeholder="0"
                                    value={row.returnQty}
                                    disabled={!row.productId || fullyPaid}
                                    onChange={(e) => {
                                      const raw = clampDigitsOnly(
                                        e.target.value,
                                      );
                                      updateRow(section.invoiceId, row.id, {
                                        returnQty: raw,
                                      });
                                    }}
                                    onBlur={(e) => {
                                      const current = toNumber(
                                        e.target.value,
                                        0,
                                      );
                                      const max = getEffectiveMaxForRow(
                                        section,
                                        row,
                                      );
                                      const clamped = Math.min(
                                        Math.max(current, 0),
                                        max,
                                      );
                                      updateRow(section.invoiceId, row.id, {
                                        returnQty:
                                          e.target.value === ""
                                            ? ""
                                            : String(clamped),
                                      });
                                    }}
                                    className={`h-10 text-center font-semibold tabular-nums focus-visible:ring-[#3aa838] ${
                                      overMax ? "border-rose-300" : ""
                                    }`}
                                  />
                                  <div
                                    className={`text-[10px] ${
                                      overMax
                                        ? "text-rose-600 font-medium"
                                        : "text-muted-foreground"
                                    }`}
                                  >
                                    Max {effectiveMax}
                                  </div>
                                </div>

                                <div className="space-y-1.5 md:col-span-2">
                                  <label className="text-xs font-medium text-slate-600">
                                    Unit price
                                  </label>
                                  <div className="flex h-10 items-center rounded-md border bg-slate-50 px-3 text-sm font-semibold tabular-nums">
                                    ৳ {money(row.unitPrice)}
                                  </div>
                                </div>

                                <div className="space-y-1.5 md:col-span-1">
                                  <label className="text-xs font-medium text-slate-600">
                                    Line
                                  </label>
                                  <div className="flex h-10 items-center justify-end rounded-md border border-[#3aa838]/30 bg-[#3aa838]/10 px-3 text-sm font-bold tabular-nums text-[#2f8a2f]">
                                    ৳ {money(rowAmount)}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-2">
                                <label className="text-xs font-medium text-slate-600">
                                  Reason (optional)
                                </label>
                                <textarea
                                  value={row.reason}
                                  disabled={fullyPaid}
                                  onChange={(e) =>
                                    updateRow(section.invoiceId, row.id, {
                                      reason: e.target.value,
                                    })
                                  }
                                  placeholder="Damage, expired, wrong item..."
                                  className="mt-1 min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3aa838]"
                                />
                              </div>

                              <div className="mt-2 flex flex-wrap gap-3 rounded-lg border bg-slate-50 px-2 py-1.5 text-[10px] text-muted-foreground">
                                <span>
                                  Already returned: {row.alreadyReturnedQty}
                                </span>
                                <span>Remaining: {effectiveMax}</span>
                                <span>
                                  Line total: ৳ {money(row.invoiceLineTotal)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-muted-foreground">
                        <div>
                          Add another item only if this invoice still has
                          unused products.
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addRow(section.invoiceId)}
                          disabled={fullyPaid || invoiceRemainingQty <= 0}
                          className="h-8"
                        >
                          <Plus className="mr-1.5 h-3.5 w-3.5" />
                          Add product
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              },
            )}
          </div>

          {/* -------- RIGHT COLUMN -------- */}
          <div className="h-fit space-y-4 lg:sticky lg:top-4">
            {/* Summary */}
            <Card className="overflow-hidden border-slate-200 shadow-md">
              <SectionHeader icon={Wallet} title="Summary" />
              <CardContent className="space-y-3 p-4">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-slate-100 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Invoices
                    </div>
                    <div className="text-lg font-bold tabular-nums">
                      {sections.length}
                    </div>
                  </div>
                  <div className="rounded-lg bg-[#3aa838]/10 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-[#2f8a2f]">
                      Products
                    </div>
                    <div className="text-lg font-bold tabular-nums text-[#2f8a2f]">
                      {totalSelectedProducts}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-100 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Qty
                    </div>
                    <div className="text-lg font-bold tabular-nums">
                      {grandReturnQty}
                    </div>
                  </div>
                  <div className="rounded-lg bg-[#3aa838]/10 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-[#2f8a2f]">
                      Amount
                    </div>
                    <div className="text-lg font-bold tabular-nums text-[#2f8a2f]">
                      ৳ {money(grandReturnAmount)}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 rounded-lg border bg-slate-50 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Dealer</span>
                    <span className="max-w-[180px] truncate font-semibold">
                      {dealer?.label || "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Return date</span>
                    <span className="font-semibold">{returnDate || "-"}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                    <span className="font-semibold">Grand return</span>
                    <span className="text-lg font-extrabold tabular-nums text-[#2f8a2f]">
                      ৳ {money(grandReturnAmount)}
                    </span>
                  </div>
                </div>

                {invoiceCards.some((c) => c.overLimit) && (
                  <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Some invoices exceed the remaining returnable amount. Fix
                    them before submitting.
                  </div>
                )}

                <div className="space-y-1">
                  <div className="text-xs font-medium text-slate-600">
                    Notes
                  </div>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Reason, damaged items, transport notes..."
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3aa838]"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    className="h-10 flex-1 bg-[#3aa838] text-white hover:bg-[#2f8a2f] disabled:opacity-50"
                    disabled={!canSubmit}
                    onClick={submit}
                  >
                    {submitting ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-1.5 h-4 w-4" />
                    )}
                    {submitting ? "Submitting..." : "Create return"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10"
                    onClick={() => {
                      setSections((current) =>
                        current.map((section) => ({
                          ...section,
                          rows: section.rows.map((row) => ({
                            ...row,
                            returnQty: "",
                            reason: "",
                          })),
                        })),
                      );
                    }}
                    disabled={!sections.length}
                    title="Clear quantities"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={resetPage}
                  className="w-full text-xs text-slate-500"
                >
                  Reset form
                </Button>
              </CardContent>
            </Card>

            {/* Rules */}
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <SectionHeader
                icon={Package}
                title="Rules"
                subtitle="What the backend will enforce"
              />
              <CardContent className="space-y-2 p-4 text-xs text-muted-foreground">
                <div className="flex items-start gap-1.5">
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-[#3aa838]" />
                  Only invoice products can be returned.
                </div>
                <div className="flex items-start gap-1.5">
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-[#3aa838]" />
                  Fully paid invoices are blocked.
                </div>
                <div className="flex items-start gap-1.5">
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-[#3aa838]" />
                  Only delivered orders appear in the picker.
                </div>
                <div className="flex items-start gap-1.5">
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-[#3aa838]" />
                  Same product cannot be added twice per invoice.
                </div>
                <div className="flex items-start gap-1.5">
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-[#3aa838]" />
                  Return qty ≤ remaining returnable qty.
                </div>
                <div className="flex items-start gap-1.5">
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-[#3aa838]" />
                  Return amount ≤ balance − already returned.
                </div>
                <div className="flex items-start gap-1.5">
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-[#3aa838]" />
                  Bonus units are included in the returnable qty.
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}