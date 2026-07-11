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
  RefreshCw,
  Search,
  Trash2,
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

/** Fetches returnable quantities from the backend for an invoice */
async function fetchReturnableQuantities(
  invoiceId: string,
): Promise<
  Map<string, { alreadyReturnedQty: number; remainingQty: number }>
> {
  try {
    const res = await api.get("/sales-returns/returnable-quantities", {
      params: { invoiceId },
    });
    const data: Array<{
      productId: string;
      soldQty: number;
      alreadyReturnedQty: number;
      remainingQty: number;
    }> = res.data?.data || [];
    const map = new Map<
      string,
      { alreadyReturnedQty: number; remainingQty: number }
    >();
    for (const item of data) {
      map.set(item.productId, {
        alreadyReturnedQty: item.alreadyReturnedQty,
        remainingQty: item.remainingQty,
      });
    }
    return map;
  } catch {
    toast.error("Failed to load returnable quantities.");
    return new Map();
  }
}

/** Normalises a raw invoice item (expects populated productId) */
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
    alreadyReturnedQty: 0, // will be overridden by real data
    maxReturnQty: invoiceQty,
    unitPrice,
    invoiceLineTotal: lineTotal,
    warehouseId: String(item.warehouseId?._id || item.warehouseId || ""),
    promotionId: item.promotionId ? String(item.promotionId) : null,
  };
}

/** Normalises a raw invoice (expects populated orderId and items.productId) */
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

/* --------------------------- SearchSelect (unchanged) --------------------------- */
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
          className="w-full justify-between"
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
                      {selected ? <Check className="h-4 w-4" /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">
                          {invoice.label}
                        </span>
                        {selected ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            Added
                          </span>
                        ) : null}
                        {fullyPaid ? (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                            Fully paid
                          </span>
                        ) : null}
                        {invoice.orderStatus !== "DELIVERED" && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                            Order not delivered
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
          className="w-full justify-between overflow-hidden"
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
                        selectedProduct ? "opacity-100" : "opacity-0"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">
                          {opt.productName}
                        </span>
                        {blocked ? (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                            Not available
                          </span>
                        ) : null}
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

/* ===================== Main Page Component ===================== */
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

  // Cached returnable quantities per invoice
  const [returnableMap, setReturnableMap] = useState<
    Map<
      string,
      Map<string, { alreadyReturnedQty: number; remainingQty: number }>
    >
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
      description: `${d.phoneNumber || d.phone || ""}${d.status ? ` · ${d.status}` : ""}`,
      status: d.status,
      dealerType: d.type,
    })) as DealerOption[];
  }, []);

  // Load invoices for a dealer, populate product names, and fetch returnable quantities
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

    // Fetch real returnable quantities for each invoice
    const map = new Map<
      string,
      Map<string, { alreadyReturnedQty: number; remainingQty: number }>
    >();
    for (const inv of list) {
      try {
        const qtyMap = await fetchReturnableQuantities(inv.value);
        map.set(inv.value, qtyMap);
      } catch {
        // ignore errors; keep empty
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

  // Toggle invoice selection – also ensure returnable quantities are loaded
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
        // If returnable quantities for this invoice not yet loaded, fetch now
        if (!returnableMap.has(invoice.value)) {
          fetchReturnableQuantities(invoice.value).then((qtyMap) => {
            setReturnableMap((prev) => {
              const next = new Map(prev);
              next.set(invoice.value, qtyMap);
              return next;
            });
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
        // Get real returnable quantities from returnableMap
        const qtyMap = returnableMap.get(invoiceId);
        const info = qtyMap?.get(option.productId);
        const realAlreadyReturned = info?.alreadyReturnedQty ?? option.alreadyReturnedQty;
        const realRemaining = info?.remainingQty ?? option.maxReturnQty;

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

  // Get remaining returnable qty for the whole invoice
  const getInvoiceRemainingQty = useCallback(
    (section: ReturnInvoiceSection) => {
      const qtyMap = returnableMap.get(section.invoiceId);
      if (!qtyMap) return 0;
      let remaining = 0;
      for (const [, info] of qtyMap) {
        remaining += info.remainingQty;
      }
      const usedBySection = section.rows.reduce(
        (sum, row) => sum + toNumber(row.returnQty, 0),
        0,
      );
      return Math.max(0, remaining - usedBySection);
    },
    [returnableMap],
  );

  // Effective max for a single row, considering other rows in the same section
  const getEffectiveMaxForRow = useCallback(
    (section: ReturnInvoiceSection, row: ReturnRow) => {
      if (!row.productId) return 0;
      const qtyMap = returnableMap.get(section.invoiceId);
      if (!qtyMap) return 0;
      const info = qtyMap.get(row.productId);
      if (!info) return 0;
      const otherRowsQty = section.rows
        .filter((r) => r.id !== row.id && r.productId === row.productId)
        .reduce((sum, r) => sum + toNumber(r.returnQty, 0), 0);
      return Math.max(0, info.remainingQty - otherRowsQty);
    },
    [returnableMap],
  );

  // 🆕 Build product options with real quantities from returnableMap
  const availableProductOptions = useCallback(
    (section: ReturnInvoiceSection, currentRowId: string) => {
      const invoice = selectedInvoiceMap.get(section.invoiceId);
      if (!invoice) return [];

      const usedProductIds = new Set(
        section.rows
          .filter((row) => row.id !== currentRowId && row.productId)
          .map((row) => row.productId),
      );

      const qtyMap = returnableMap.get(section.invoiceId);

      return invoice.items.map((item) => {
        const realInfo = qtyMap?.get(item.productId);
        const alreadyReturned = realInfo?.alreadyReturnedQty ?? item.alreadyReturnedQty;
        const remaining = realInfo?.remainingQty ?? item.maxReturnQty;

        return {
          ...item,
          alreadyReturnedQty: alreadyReturned,
          maxReturnQty: remaining,
          blocked:
            usedProductIds.has(item.productId) || remaining <= 0,
        };
      });
    },
    [selectedInvoiceMap, returnableMap],
  );

  // Compute card summaries
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
      return { section, invoice, returnAmount, returnQty };
    });
  }, [sections, selectedInvoiceMap]);

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
      if (Number(invoice.balanceAmount || 0) <= 0) {
        toast.error(
          `Invoice ${invoice.invoiceNo} is fully paid and cannot be returned.`,
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
      const invoiceBalance = Number(invoice.balanceAmount || 0);
      const invoiceReturnAmount = validRows.reduce(
        (sum, row) => sum + calcRowAmount(row),
        0,
      );
      if (invoiceReturnAmount > invoiceBalance + 0.0001) {
        toast.error(
          `Invoice ${invoice.invoiceNo}: return amount cannot exceed remaining balance.`,
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

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl p-4 md:p-6">
        <div className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Create Sales Return</h1>
              <p className="text-sm text-muted-foreground">
                Select a dealer, choose invoices once, then pick only the
                invoice products you want to return.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-sm">
              <div className="rounded-md border bg-slate-50 px-3 py-2">
                Dealer:{" "}
                <span className="font-medium">{selectedDealerLabel}</span>
              </div>
              <div className="rounded-md border bg-slate-50 px-3 py-2">
                Invoices: <span className="font-medium">{sections.length}</span>
              </div>
              <div className="rounded-md border bg-slate-50 px-3 py-2">
                Qty: <span className="font-medium">{grandReturnQty}</span>
              </div>
              <div className="rounded-md border bg-slate-50 px-3 py-2">
                Amount:{" "}
                <span className="font-medium">
                  {money(grandReturnAmount)} BDT
                </span>
              </div>
            </div>
          </div>
        </div>

        {createdReturn ? (
          <Card className="mb-6 border-emerald-200 bg-emerald-50/70">
            <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-medium text-emerald-700">
                  Sales return created successfully
                </div>
                <div className="mt-1 text-xl font-semibold">
                  {createdReturn.returnNo ||
                    createdReturn?.data?.returnNo ||
                    "Saved"}
                </div>
                <div className="text-sm text-emerald-700">
                  Status: {createdReturn.status || "PENDING"}
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={resetPage}>
                  Create another
                </Button>
                <Button
                  type="button"
                  onClick={() => router.push("/sales/return")}
                >
                  Go to list
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Return basics</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Dealer</div>
                  <SearchSelect
                    value={dealer?.value}
                    selectedLabel={dealer?.label}
                    onPick={onPickDealer}
                    fetchOptions={fetchDealers}
                    placeholder="Search dealer"
                    searchPlaceholder="Type dealer name / phone..."
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Return date</div>
                  <Input
                    type="date"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Invoices</div>
                  <InvoicePicker
                    dealerId={dealer?.value}
                    selectedIds={selectedInvoiceIds}
                    onToggle={toggleInvoice}
                  />
                  <div className="text-xs text-muted-foreground">
                    Fully paid invoices and undelivered orders are blocked.
                  </div>
                </div>
              </CardContent>
            </Card>

            {loadingInvoices ? (
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading invoices...
                </CardContent>
              </Card>
            ) : null}

            {selectedInvoiceIds.length === 0 ? (
              <Card className="border-dashed border-slate-300 bg-white/70 shadow-sm">
                <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
                  <div className="rounded-full bg-slate-100 p-3">
                    <Search className="h-5 w-5 text-slate-500" />
                  </div>
                  <div>
                    <div className="text-base font-semibold">
                      No invoices selected
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Pick one or more invoices to begin the return.
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {invoiceCards.map(
              ({ section, invoice, returnAmount, returnQty }) => {
                if (!invoice) return null;

                const fullyPaid = Number(section.balanceAmount || 0) <= 0;
                const invoiceRemainingQty = getInvoiceRemainingQty(section);

                return (
                  <Card
                    key={section.invoiceId}
                    className="border-slate-200 shadow-sm"
                  >
                    <CardHeader className="space-y-3">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <CardTitle className="flex flex-wrap items-center gap-2">
                            {section.invoiceNo}
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                              {section.paymentStatus}
                            </span>
                            {fullyPaid ? (
                              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                                Fully paid
                              </span>
                            ) : (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                Returnable
                              </span>
                            )}
                          </CardTitle>
                          <div className="mt-1 text-sm text-muted-foreground">
                            Order: {section.orderId} · Warehouse:{" "}
                            {section.warehouseName || section.warehouseId}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => addRow(section.invoiceId)}
                            disabled={fullyPaid || invoiceRemainingQty <= 0}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Add item
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => removeInvoice(section.invoiceId)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove invoice
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-4">
                        <div className="rounded-lg border bg-slate-50 p-3">
                          <div className="text-xs text-muted-foreground">
                            Invoice total
                          </div>
                          <div className="text-lg font-semibold">
                            {money(section.grandTotal)} BDT
                          </div>
                        </div>
                        <div className="rounded-lg border bg-slate-50 p-3">
                          <div className="text-xs text-muted-foreground">
                            Paid amount
                          </div>
                          <div className="text-lg font-semibold">
                            {money(section.paidAmount)} BDT
                          </div>
                        </div>
                        <div className="rounded-lg border bg-slate-50 p-3">
                          <div className="text-xs text-muted-foreground">
                            Balance
                          </div>
                          <div
                            className={`text-lg font-semibold ${
                              Number(section.balanceAmount || 0) <= 0
                                ? "text-red-600"
                                : "text-emerald-600"
                            }`}
                          >
                            {money(section.balanceAmount)} BDT
                          </div>
                        </div>
                        <div className="rounded-lg border bg-slate-50 p-3">
                          <div className="text-xs text-muted-foreground">
                            Current return amount
                          </div>
                          <div className="text-lg font-semibold">
                            {money(returnAmount)} BDT
                          </div>
                        </div>
                      </div>

                      {fullyPaid ? (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                          This invoice is fully paid, so it cannot be returned.
                        </div>
                      ) : null}

                      <div className="rounded-lg border bg-slate-50 p-3 text-sm text-muted-foreground">
                        Remaining returnable quantity for this invoice:{" "}
                        <span className="font-semibold text-slate-900">
                          {invoiceRemainingQty}
                        </span>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
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
                            className={`rounded-xl border bg-white p-4 ${
                              overMax ? "border-red-300 bg-red-50/30" : ""
                            }`}
                          >
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold">
                                  {row.productName || "Select product"}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Choose only from this invoice. Same product
                                  cannot be added twice.
                                </div>
                              </div>

                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() =>
                                  removeRow(section.invoiceId, row.id)
                                }
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Remove
                              </Button>
                            </div>

                            <div className="grid gap-4 md:grid-cols-12">
                              <div className="space-y-2 md:col-span-5">
                                <div className="text-sm font-medium">
                                  Product
                                </div>
                                <ProductPicker
                                  value={row.productId}
                                  options={options}
                                  onPick={(opt) =>
                                    pickProduct(section.invoiceId, row.id, opt)
                                  }
                                  disabled={fullyPaid}
                                />
                                <div className="text-xs text-muted-foreground">
                                  {selectedOption ? (
                                    <>
                                      Invoice qty: {selectedOption.invoiceQty} ·
                                      Returned:{" "}
                                      {selectedOption.alreadyReturnedQty} ·
                                      Remaining: {effectiveMax}
                                    </>
                                  ) : (
                                    "Choose a product from this invoice."
                                  )}
                                </div>
                              </div>

                              <div className="space-y-2 md:col-span-2">
                                <div className="text-sm font-medium">
                                  Invoice qty
                                </div>
                                <div className="flex h-10 items-center rounded-md border bg-slate-50 px-3 text-sm font-semibold">
                                  {row.invoiceQty}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Includes bonus qty.
                                </div>
                              </div>

                              <div className="space-y-2 md:col-span-2">
                                <div className="text-sm font-medium">
                                  Return qty
                                </div>
                                <Input
                                  inputMode="numeric"
                                  placeholder="0"
                                  value={row.returnQty}
                                  disabled={!row.productId || fullyPaid}
                                  onChange={(e) => {
                                    const raw = clampDigitsOnly(e.target.value);
                                    updateRow(section.invoiceId, row.id, {
                                      returnQty: raw,
                                    });
                                  }}
                                  onBlur={(e) => {
                                    const current = toNumber(e.target.value, 0);
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
                                />
                                <div
                                  className={`text-xs ${
                                    overMax
                                      ? "text-red-600"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  Max allowed: {effectiveMax}
                                </div>
                              </div>

                              <div className="space-y-2 md:col-span-2">
                                <div className="text-sm font-medium">
                                  Unit price
                                </div>
                                <div className="flex h-10 items-center rounded-md border bg-slate-50 px-3 text-sm font-semibold">
                                  {money(row.unitPrice)} BDT
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Effective unit = line total / invoice units.
                                </div>
                              </div>

                              <div className="space-y-2 md:col-span-1">
                                <div className="text-sm font-medium">Line</div>
                                <div className="flex h-10 items-center rounded-md border bg-indigo-50 px-3 text-sm font-semibold text-indigo-700">
                                  {money(rowAmount)} BDT
                                </div>
                              </div>
                            </div>

                            <div className="mt-4">
                              <div className="text-sm font-medium">Reason</div>
                              <textarea
                                value={row.reason}
                                disabled={fullyPaid}
                                onChange={(e) =>
                                  updateRow(section.invoiceId, row.id, {
                                    reason: e.target.value,
                                  })
                                }
                                placeholder="Optional reason for this returned item..."
                                className="mt-2 min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none"
                              />
                            </div>

                            <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-4">
                              <div>
                                Already returned: {row.alreadyReturnedQty}
                              </div>
                              <div>Remaining: {effectiveMax}</div>
                              <div>
                                Invoice line total:{" "}
                                {money(row.invoiceLineTotal)}
                              </div>
                              <div>Warehouse: {row.warehouseId}</div>
                            </div>
                          </div>
                        );
                      })}

                      <div className="flex items-center justify-between rounded-lg border bg-slate-50 p-3">
                        <div className="text-sm text-muted-foreground">
                          Add another item only when the invoice still has
                          unused products.
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => addRow(section.invoiceId)}
                          disabled={fullyPaid || invoiceRemainingQty <= 0}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add another product
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              },
            )}
          </div>

          <div className="space-y-6 lg:sticky lg:top-6 h-fit">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md bg-slate-100 p-3">
                    <div className="text-xs text-muted-foreground">
                      Invoices
                    </div>
                    <div className="text-xl font-semibold">
                      {sections.length}
                    </div>
                  </div>
                  <div className="rounded-md bg-slate-100 p-3">
                    <div className="text-xs text-muted-foreground">
                      Products
                    </div>
                    <div className="text-xl font-semibold">
                      {sections.reduce(
                        (sum, s) =>
                          sum +
                          s.rows.filter(
                            (r) => r.productId && toNumber(r.returnQty, 0) > 0,
                          ).length,
                        0,
                      )}
                    </div>
                  </div>
                  <div className="rounded-md bg-slate-100 p-3">
                    <div className="text-xs text-muted-foreground">Qty</div>
                    <div className="text-xl font-semibold">
                      {grandReturnQty}
                    </div>
                  </div>
                  <div className="rounded-md bg-slate-100 p-3">
                    <div className="text-xs text-muted-foreground">Amount</div>
                    <div className="text-xl font-semibold">
                      {money(grandReturnAmount)}
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-md border bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Dealer
                    </span>
                    <span className="font-semibold">
                      {dealer?.label || "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Return date
                    </span>
                    <span className="font-semibold">{returnDate || "-"}</span>
                  </div>
                  <div className="flex items-center justify-between border-t pt-3">
                    <span className="text-base font-semibold">
                      Grand return amount
                    </span>
                    <span className="text-lg font-bold text-indigo-700">
                      {money(grandReturnAmount)} BDT
                    </span>
                  </div>
                </div>

                <div className="rounded-md border p-4">
                  <div className="text-sm font-semibold">Rules</div>
                  <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <div>Only invoice products can be returned.</div>
                    <div>Fully paid invoices are blocked.</div>
                    <div>Only orders that have been delivered are shown.</div>
                    <div>
                      Same product cannot be added twice in the same invoice.
                    </div>
                    <div>Return qty cannot exceed the remaining qty.</div>
                    <div>Return amount cannot exceed invoice balance.</div>
                    <div>
                      Bonus units are included in the returnable quantity.
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Notes</div>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    placeholder="Reason, damaged items, transport notes, negotiation remarks..."
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    className="flex-1"
                    disabled={submitting || !dealer?.value || !sections.length}
                    onClick={submit}
                  >
                    {submitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    {submitting ? "Submitting..." : "Create return"}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
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
                <div>1. Pick dealer.</div>
                <div>2. Select one or more invoices (delivered only).</div>
                <div>3. Add product rows for each invoice.</div>
                <div>4. Choose products manually from the invoice only.</div>
                <div>5. Enter return quantity and reason.</div>
                <div>6. Submit for approvals.</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}