"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandGroup,
  CommandItem,
  CommandEmpty,
} from "@/components/ui/command";
import {
  ArrowRightLeft,
  Check,
  ChevronsUpDown,
  Factory,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Building2,
  Inbox,
  Package,
  AlertCircle,
} from "lucide-react";

import Protected from "@/components/auth/Protected";
import usePermissionCheck from "@/hooks/usePermissionCheck";

/* =========================== Types =========================== */
type Location = {
  _id: string;
  name?: string;
  warehouseName?: string;
  factoryName?: string;
  code?: string;
  type?: string;
  kind?: string;
  entityType?: string;
};

type Product = {
  _id: string;
  name?: string;
  sku?: string;
  unit?: string;
  salePrice?: number;
  images?: { url: string }[];
};

type StockDoc = {
  _id?: string;
  productId?: string;
  warehouseId?: string;
  quantity?: number;
  reservedForSales?: number;
  reservedForTransfer?: number;
  incomingTransfer?: number;
  unit?: string;
};

type ItemRow = {
  id: string;
  productId: string;
  product: Product | null;
  query: string;
  candidates: Product[];
  searching: boolean;

  requestedQty: number;
  finalQty: number;
  unit: string;
  costPrice: number;

  stockDoc: StockDoc | null;
  available: number | null;
  error: string | null;
};

/* =========================== Helpers =========================== */
function locationLabel(loc?: Location | null) {
  if (!loc) return "-";
  return (
    loc.name ||
    loc.warehouseName ||
    loc.factoryName ||
    loc.code ||
    loc._id ||
    "-"
  );
}

function locationKind(loc?: Location | null) {
  const t = String(
    loc?.type || loc?.kind || loc?.entityType || "",
  ).toLowerCase();
  if (t.includes("factory")) return "Factory";
  if (t.includes("warehouse")) return "Warehouse";
  return "Location";
}

function isFactory(loc?: Location | null) {
  const t = String(
    loc?.type || loc?.kind || loc?.entityType || "",
  ).toLowerCase();
  return t.includes("factory") || !t;
}

function isWarehouse(loc?: Location | null) {
  const t = String(
    loc?.type || loc?.kind || loc?.entityType || "",
  ).toLowerCase();
  return t.includes("warehouse") || !t;
}

function calcAvailable(sd?: StockDoc | null) {
  if (!sd) return null;
  const q = sd.quantity ?? 0;
  const inc = sd.incomingTransfer ?? 0;
  const rs = sd.reservedForSales ?? 0;
  const rt = sd.reservedForTransfer ?? 0;
  return q + inc - rs - rt;
}

function emptyRow(): ItemRow {
  return {
    id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    productId: "",
    product: null,
    query: "",
    candidates: [],
    searching: false,
    requestedQty: 1,
    finalQty: 1,
    unit: "pcs",
    costPrice: 0,
    stockDoc: null,
    available: null,
    error: null,
  };
}

/* =========================== StatCard =========================== */
function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "slate",
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  hint: string;
  tone?: "slate" | "sky" | "green";
}) {
  const map = {
    slate: {
      bg: "bg-slate-100 dark:bg-slate-800",
      fg: "text-slate-600 dark:text-slate-300",
    },
    sky: {
      bg: "bg-sky-100 dark:bg-sky-950/40",
      fg: "text-sky-600 dark:text-sky-300",
    },
    green: {
      bg: "bg-[#3aa838]/10 dark:bg-[#3aa838]/15",
      fg: "text-[#2f8a2f] dark:text-[#9bdd91]",
    },
  } as const;
  const t = map[tone];

  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-lg ${t.bg} ${t.fg}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <div className="mt-1.5 truncate text-base font-bold tracking-tight text-slate-900 dark:text-white">
        {value}
      </div>
      <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
        {hint}
      </p>
    </div>
  );
}

/* =========================== Page (Protected) =========================== */
export default function FactoryTransferCreatePage() {
  return (
    <Protected permissions="factorytransfer.create">
      <FactoryTransferCreatePageInner />
    </Protected>
  );
}

/* =========================== Inner =========================== */
function FactoryTransferCreatePageInner() {
  const router = useRouter();
  const hasAccess = usePermissionCheck();
  const canCreate = hasAccess({ permissions: "factorytransfer.create" });

  const [transferNo, setTransferNo] = useState("");
  const [remarks, setRemarks] = useState("");

  // Direct factory transfer only
  const [transferType] = useState<"FACTORY_TO_WAREHOUSE">(
    "FACTORY_TO_WAREHOUSE",
  );
  const [transferMode] = useState<"DIRECT">("DIRECT");

  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);

  const [senderFactoryId, setSenderFactoryId] = useState("");
  const [receiverWarehouseId, setReceiverWarehouseId] = useState("");

  const [rows, setRows] = useState<ItemRow[]>([emptyRow()]);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const productTimers = useRef<Record<string, number | null>>({});
  const stockTimers = useRef<Record<string, number | null>>({});
  const costTimers = useRef<Record<string, number | null>>({});

  useEffect(() => {
    generateTransferNo();
    loadLocations();

    return () => {
      Object.values(productTimers.current).forEach(
        (t) => t && clearTimeout(t),
      );
      Object.values(stockTimers.current).forEach((t) => t && clearTimeout(t));
      Object.values(costTimers.current).forEach((t) => t && clearTimeout(t));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // TODO: later auto-select senderFactoryId from authenticated user's factoryId
    // and lock this field for non-admin roles.
  }, [senderFactoryId]);

  useEffect(() => {
    rows.forEach((r) => {
      if (r.productId) {
        fetchStockDebounced(r.id, r.productId, senderFactoryId || undefined);
        fetchCostDebounced(r.id, r.productId, senderFactoryId || undefined);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [senderFactoryId]);

  function generateTransferNo() {
    const d = new Date();
    const datePart = d.toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.floor(Math.random() * 9000 + 1000);
    setTransferNo(`TR-${datePart}-${rand}`);
  }

  async function loadLocations() {
    try {
      setLoadingLocations(true);
      const res = await api.get("/warehouses-or-factories", {
        params: { page: 1, limit: 2000 },
      });
      setLocations(res.data?.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load factories and warehouses");
    } finally {
      setLoadingLocations(false);
    }
  }

  const factoryOptions = useMemo(() => {
    return locations.filter((l) => isFactory(l));
  }, [locations]);

  const warehouseOptions = useMemo(() => {
    return locations.filter((l) => isWarehouse(l));
  }, [locations]);

  function updateRow(rowId: string, patch: Partial<ItemRow>) {
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r)),
    );
  }

  function addRow(afterRowId?: string) {
    setRows((prev) => {
      const next = emptyRow();
      if (!afterRowId) return [...prev, next];
      const idx = prev.findIndex((r) => r.id === afterRowId);
      if (idx === -1) return [...prev, next];
      const copy = [...prev];
      copy.splice(idx + 1, 0, next);
      return copy;
    });
  }

  function removeRow(rowId: string) {
    if (productTimers.current[rowId]) {
      clearTimeout(productTimers.current[rowId]!);
      productTimers.current[rowId] = null;
    }
    if (stockTimers.current[rowId]) {
      clearTimeout(stockTimers.current[rowId]!);
      stockTimers.current[rowId] = null;
    }
    if (costTimers.current[rowId]) {
      clearTimeout(costTimers.current[rowId]!);
      costTimers.current[rowId] = null;
    }
    setRows((prev) =>
      prev.length > 1 ? prev.filter((r) => r.id !== rowId) : prev,
    );
  }

  function onProductQuery(rowId: string, q: string) {
    updateRow(rowId, { query: q, searching: !!q });

    if (productTimers.current[rowId]) {
      clearTimeout(productTimers.current[rowId]!);
      productTimers.current[rowId] = null;
    }

    if (!q || q.trim().length < 2) {
      updateRow(rowId, { candidates: [], searching: false });
      return;
    }

    productTimers.current[rowId] = window.setTimeout(async () => {
      try {
        updateRow(rowId, { searching: true });
        const res = await api.get("/products", {
          params: { page: 1, limit: 50, q: q.trim() },
        });
        const list: Product[] = res.data?.data || [];
        updateRow(rowId, { candidates: list, searching: false });
      } catch (err) {
        console.error(err);
        updateRow(rowId, { candidates: [], searching: false });
      } finally {
        if (productTimers.current[rowId]) {
          clearTimeout(productTimers.current[rowId]!);
          productTimers.current[rowId] = null;
        }
      }
    }, 250);
  }

  function isProductAlreadySelected(productId: string, exceptRowId?: string) {
    return rows.some(
      (r) => r.productId === productId && r.id !== exceptRowId,
    );
  }

  async function selectProduct(rowId: string, product: Product | null) {
    if (!product) {
      updateRow(rowId, {
        productId: "",
        product: null,
        query: "",
        candidates: [],
        searching: false,
        requestedQty: 1,
        finalQty: 1,
        unit: "pcs",
        costPrice: 0,
        stockDoc: null,
        available: null,
        error: null,
      });
      return;
    }

    // Prevent duplicate product selection
    if (isProductAlreadySelected(product._id, rowId)) {
      toast.error("This product is already added to the transfer");
      return;
    }

    updateRow(rowId, {
      productId: product._id,
      product,
      query: "",
      candidates: [],
      searching: false,
      unit: product.unit || "pcs",
      costPrice: 0, // will be fetched from inventory
      requestedQty: 1,
      finalQty: 1,
      error: null,
    });

    fetchStockDebounced(rowId, product._id, senderFactoryId || undefined);
    fetchCostDebounced(rowId, product._id, senderFactoryId || undefined);
  }

  function fetchStockDebounced(
    rowId: string,
    productId?: string,
    warehouseId?: string,
  ) {
    if (stockTimers.current[rowId]) {
      clearTimeout(stockTimers.current[rowId]!);
      stockTimers.current[rowId] = null;
    }

    stockTimers.current[rowId] = window.setTimeout(() => {
      fetchStock(rowId, productId, warehouseId);
    }, 180);
  }

  async function fetchStock(
    rowId: string,
    productId?: string,
    warehouseId?: string,
  ) {
    try {
      updateRow(rowId, { error: null });
      if (!productId || !warehouseId) {
        updateRow(rowId, { stockDoc: null, available: null });
        return;
      }

      const res = await api.get("/product-stocks", {
        params: { productId, warehouseId, page: 1, limit: 1 },
      });

      const sd = res.data?.data?.[0] ?? null;
      const available = calcAvailable(sd);
      updateRow(rowId, { stockDoc: sd, available });
    } catch (err) {
      console.error(err);
      updateRow(rowId, {
        stockDoc: null,
        available: null,
        error: "Failed to load stock",
      });
    } finally {
      if (stockTimers.current[rowId]) {
        clearTimeout(stockTimers.current[rowId]!);
        stockTimers.current[rowId] = null;
      }
    }
  }

  // ----- inventory cost fetching -----
  function fetchCostDebounced(
    rowId: string,
    productId?: string,
    locationId?: string,
  ) {
    if (costTimers.current[rowId]) {
      clearTimeout(costTimers.current[rowId]!);
      costTimers.current[rowId] = null;
    }
    costTimers.current[rowId] = window.setTimeout(() => {
      fetchCost(rowId, productId, locationId);
    }, 200);
  }

  async function fetchCost(
    rowId: string,
    productId?: string,
    locationId?: string,
  ) {
    try {
      if (!productId || !locationId) {
        // keep whatever cost is set (probably 0)
        return;
      }

      const res = await api.get("/stock-transactions/latest-unit-cost", {
        params: {
          itemType: "Product",
          itemId: productId,
          locationId,
        },
      });
      const unitCost = Number(res.data?.unitCost) || 0;
      updateRow(rowId, { costPrice: unitCost });
    } catch (err) {
      console.error("Failed to fetch inventory cost", err);
      // silently ignore – user can still manually enter a cost
    } finally {
      if (costTimers.current[rowId]) {
        clearTimeout(costTimers.current[rowId]!);
        costTimers.current[rowId] = null;
      }
    }
  }

  function onQtyChange(rowId: string, raw: string) {
    const qty = Math.max(1, Number(raw || 1));
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;

    const error =
      row.available != null && qty > (row.available ?? 0)
        ? `Qty exceeds available (${row.available})`
        : null;

    updateRow(rowId, {
      requestedQty: qty,
      finalQty: qty,
      error,
    });
  }

  function onCostChange(rowId: string, raw: string) {
    const cost = Math.max(0, Number(raw || 0));
    updateRow(rowId, { costPrice: cost });
  }

  const totals = useMemo(() => {
    const totalItems = rows.length;
    const totalQty = rows.reduce((s, r) => s + (r.requestedQty || 0), 0);
    const totalCost = rows.reduce(
      (s, r) => s + (r.requestedQty || 0) * (r.costPrice || 0),
      0,
    );
    return { totalItems, totalQty, totalCost };
  }, [rows]);

  function validateBeforeSubmit() {
    if (!transferNo.trim()) {
      toast.error("Transfer number is required");
      return false;
    }
    if (!senderFactoryId) {
      toast.error("Select sender factory");
      return false;
    }
    if (!receiverWarehouseId) {
      toast.error("Select receiver warehouse");
      return false;
    }
    if (senderFactoryId === receiverWarehouseId) {
      toast.error("Sender and receiver cannot be the same");
      return false;
    }
    if (!rows.length) {
      toast.error("Add at least one item");
      return false;
    }

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.productId) {
        toast.error(`Row ${i + 1}: select a product`);
        return false;
      }
      if (!r.requestedQty || r.requestedQty <= 0) {
        toast.error(`Row ${i + 1}: quantity must be greater than 0`);
        return false;
      }
      if (r.available != null && r.requestedQty > (r.available ?? 0)) {
        toast.error(`Row ${i + 1}: qty exceeds available stock`);
        return false;
      }
      if (r.error) {
        toast.error(`Row ${i + 1}: ${r.error}`);
        return false;
      }
    }

    return true;
  }

  function openConfirm() {
    if (!canCreate) {
      toast.error("You don't have permission to create transfers");
      return;
    }
    if (!validateBeforeSubmit()) return;
    setConfirmOpen(true);
  }

  async function submitTransfer() {
    if (!validateBeforeSubmit()) return;

    setSubmitting(true);
    try {
      await api.post("/transfers", {
        transferNo: transferNo.trim(),
        transferType,
        transferMode,
        sender: senderFactoryId,
        receiver: receiverWarehouseId,
        remarks: remarks || undefined,
        items: rows.map((r) => ({
          productId: r.productId,
          requestedQty: r.requestedQty,
          finalQty: r.finalQty,
          unit: r.unit,
          costPrice: r.costPrice,
        })),
      });

      toast.success("Factory transfer created successfully");
      router.push("/inventory/product-transfer");
    } catch (err: any) {
      console.error(err);
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to create factory transfer",
      );
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  }

  function formatStock(sd?: StockDoc | null) {
    if (!sd) return "";
    return `q:${sd.quantity ?? 0} • inc:${sd.incomingTransfer ?? 0} • rS:${sd.reservedForSales ?? 0} • rT:${sd.reservedForTransfer ?? 0}`;
  }

  /* =========================== Render =========================== */
  return (
    <div className="min-h-screen bg-slate-50/60 p-4 dark:bg-slate-950 md:p-6">
      <div className="mx-auto max-w-[1600px] space-y-5">
        {/* ============ HERO ============ */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-6">
          <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-[#3aa838]/5 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-emerald-500/5 blur-3xl" />

          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                  <ArrowRightLeft className="h-2.5 w-2.5" />
                  Operations
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-[#3aa838]/30 bg-[#3aa838]/5 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#2f8a2f] dark:border-[#3aa838]/30 dark:bg-[#3aa838]/10 dark:text-[#9bdd91]">
                  <Factory className="h-2.5 w-2.5" />
                  Direct Transfer
                </span>
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white md:text-3xl">
                Create Direct Factory Transfer
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                Create a direct shipment from factory to warehouse. The
                transfer will be in <strong>Requested</strong> state. After
                creating, you can print and send it from the action page.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={generateTransferNo}
                className="h-9 gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Regenerate No
              </Button>
              {canCreate && (
                <Button
                  size="sm"
                  onClick={openConfirm}
                  className="h-9 gap-1.5 bg-[#3aa838] text-white shadow-sm shadow-[#3aa838]/20 hover:bg-[#2f8a2f]"
                >
                  <Plus className="h-4 w-4" />
                  Create Transfer
                </Button>
              )}
            </div>
          </div>

          {/* Stat cards */}
          <div className="relative mt-5 grid gap-3 sm:grid-cols-3">
            <StatCard
              icon={Factory}
              label="Sender Factory"
              value={
                senderFactoryId
                  ? locationLabel(
                      factoryOptions.find((f) => f._id === senderFactoryId),
                    )
                  : "Not selected"
              }
              hint={
                loadingLocations
                  ? "Loading locations…"
                  : `${factoryOptions.length} factories available`
              }
              tone="slate"
            />
            <StatCard
              icon={Building2}
              label="Receiver Warehouse"
              value={
                receiverWarehouseId
                  ? locationLabel(
                      warehouseOptions.find(
                        (w) => w._id === receiverWarehouseId,
                      ),
                    )
                  : "Not selected"
              }
              hint={`${warehouseOptions.length} warehouses available`}
              tone="sky"
            />
            <StatCard
              icon={Package}
              label="Items"
              value={totals.totalItems}
              hint={`${totals.totalQty} total qty`}
              tone="green"
            />
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* ============ MAIN ============ */}
          <div className="space-y-5">
            {/* Transfer info */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Transfer Information
                </h2>
              </div>
              <div className="space-y-4 p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Transfer No
                    </label>
                    <Input
                      value={transferNo}
                      onChange={(e) => setTransferNo(e.target.value)}
                      disabled={true}
                      placeholder="TR-YYYYMMDD-XXXX"
                      className="h-9 font-mono text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Transfer Mode
                    </label>
                    <Input
                      value="DIRECT"
                      disabled
                      readOnly
                      className="h-9 font-mono text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Sender Factory <span className="text-rose-500">*</span>
                    </label>
                    <select
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-[#3aa838]/40 focus:ring-2 focus:ring-[#3aa838]/10 dark:border-slate-800 dark:bg-slate-900"
                      value={senderFactoryId}
                      onChange={(e) => setSenderFactoryId(e.target.value)}
                    >
                      <option value="">Select sender factory</option>
                      {factoryOptions.map((loc) => (
                        <option key={loc._id} value={loc._id}>
                          {locationLabel(loc)} ({locationKind(loc)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Receiver Warehouse <span className="text-rose-500">*</span>
                    </label>
                    <select
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-[#3aa838]/40 focus:ring-2 focus:ring-[#3aa838]/10 dark:border-slate-800 dark:bg-slate-900"
                      value={receiverWarehouseId}
                      onChange={(e) => setReceiverWarehouseId(e.target.value)}
                    >
                      <option value="">Select receiver warehouse</option>
                      {warehouseOptions.map((loc) => (
                        <option key={loc._id} value={loc._id}>
                          {locationLabel(loc)} ({locationKind(loc)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Remarks
                    </label>
                    <textarea
                      className="min-h-[90px] w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none transition focus:border-[#3aa838]/40 focus:ring-2 focus:ring-[#3aa838]/10 dark:border-slate-800 dark:bg-slate-900"
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Optional remarks for the transfer…"
                    />
                  </div>
                </div>

                <div className="flex items-start gap-2 rounded-lg border border-[#3aa838]/20 bg-[#3aa838]/5 p-3 text-xs text-slate-600 dark:border-[#3aa838]/30 dark:bg-[#3aa838]/10 dark:text-slate-300">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#3aa838]" />
                  <div>
                    <strong className="text-slate-900 dark:text-white">
                      Workflow:
                    </strong>{" "}
                    Factory Created → Sent → Hold → Awaiting Remaining →
                    Completed. Factory direct transfers reserve stock virtually
                    at creation and are ready to print and send immediately.
                  </div>
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Items
                </h2>
                {canCreate && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addRow()}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Item
                  </Button>
                )}
              </div>

              <div className="overflow-x-auto p-3">
                <table className="w-full min-w-full table-auto">
                  <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40">
                    <tr>
                      {[
                        "#",
                        "Product",
                        "Available",
                        "Qty",
                        "Unit",
                        "Cost",
                        "Subtotal",
                        "Action",
                      ].map((h, i) => (
                        <th
                          key={h}
                          className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${
                            i === 0
                              ? "w-12 text-center"
                              : i === 7
                                ? "w-28 text-center"
                                : i >= 2 && i <= 6
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
                    {rows.map((r, idx) => {
                      const over =
                        r.available != null &&
                        r.requestedQty > (r.available ?? 0);

                      return (
                        <tr
                          key={r.id}
                          className={`border-b border-slate-100 align-top last:border-b-0 dark:border-slate-800 ${
                            over ? "bg-rose-50/50 dark:bg-rose-950/20" : ""
                          }`}
                        >
                          <td className="px-3 py-3 text-center text-xs font-medium text-slate-400">
                            {idx + 1}
                          </td>

                          <td className="min-w-[240px] px-3 py-3">
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className={`h-11 w-full justify-between text-left ${
                                    over ? "border-rose-300" : ""
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-medium">
                                      {r.product?.name || "Select product"}
                                    </div>
                                    <div className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                                      {r.product?.sku ||
                                        "Search by name or SKU"}
                                    </div>
                                  </div>
                                  <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-60" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[560px] p-0">
                                <Command>
                                  <CommandInput
                                    placeholder="Search product…"
                                    value={r.query}
                                    onValueChange={(v: string) =>
                                      onProductQuery(r.id, v)
                                    }
                                  />
                                  <CommandEmpty>
                                    No products found
                                  </CommandEmpty>
                                  <CommandGroup className="max-h-72 overflow-auto">
                                    {r.searching ? (
                                      <div className="p-4 text-center">
                                        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                                      </div>
                                    ) : (
                                      r.candidates.map((p) => (
                                        <CommandItem
                                          key={p._id}
                                          value={`${p.name} ${p.sku}`}
                                          onSelect={() =>
                                            selectProduct(r.id, p)
                                          }
                                        >
                                          <div className="flex w-full items-center justify-between">
                                            <div className="min-w-0">
                                              <div className="truncate text-sm font-medium">
                                                {p.name}
                                              </div>
                                              <div className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                                                SKU: {p.sku || "-"}
                                              </div>
                                            </div>
                                            <div className="ml-2 shrink-0 text-[10px] text-slate-500 dark:text-slate-400">
                                              {p.unit || "pcs"}
                                            </div>
                                          </div>
                                        </CommandItem>
                                      ))
                                    )}
                                  </CommandGroup>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </td>

                          <td className="px-3 py-3 text-center">
                            {r.available == null ? (
                              <div className="text-xs text-slate-400">-</div>
                            ) : (
                              <div>
                                <div
                                  className={`text-sm font-semibold ${
                                    r.available <= 0
                                      ? "text-rose-600 dark:text-rose-400"
                                      : "text-slate-900 dark:text-white"
                                  }`}
                                >
                                  {r.available}
                                </div>
                                {r.stockDoc ? (
                                  <div className="mt-0.5 max-w-[120px] break-words text-[9px] text-slate-500 dark:text-slate-400">
                                    {formatStock(r.stockDoc)}
                                  </div>
                                ) : null}
                              </div>
                            )}
                          </td>

                          <td className="px-3 py-3 text-center">
                            <Input
                              type="number"
                              min={1}
                              value={r.requestedQty}
                              onChange={(e) =>
                                onQtyChange(r.id, e.target.value)
                              }
                              className={`h-9 text-center text-sm font-semibold ${
                                over ? "border-rose-500 text-rose-600" : ""
                              }`}
                            />
                            {over ? (
                              <div className="mt-0.5 text-[10px] text-rose-600 dark:text-rose-400">
                                exceeds available
                              </div>
                            ) : null}
                          </td>

                          <td className="px-3 py-3 text-center">
                            <Input
                              value={r.unit}
                              onChange={(e) =>
                                updateRow(r.id, { unit: e.target.value })
                              }
                              className="h-9 text-center text-sm"
                            />
                          </td>

                          <td className="px-3 py-3 text-center">
                            <Input
                              type="number"
                              min={0}
                              value={r.costPrice}
                              onChange={(e) =>
                                onCostChange(r.id, e.target.value)
                              }
                              className="h-9 text-center text-sm"
                            />
                          </td>

                          <td className="px-3 py-3 text-right text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                            {(
                              (r.requestedQty || 0) * (r.costPrice || 0)
                            ).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>

                          <td className="px-3 py-3 text-center">
                            {canCreate && (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => addRow(r.id)}
                                  title="Add row below"
                                  className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-[#3aa838]/10 hover:text-[#2f8a2f]"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeRow(r.id)}
                                  title="Remove row"
                                  className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {canCreate && (
                <div className="border-t border-slate-200 px-3 py-2.5 dark:border-slate-800">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addRow()}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Row
                  </Button>
                </div>
              )}

              {rows.length === 0 && (
                <div className="p-10 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                    <Inbox className="h-6 w-6 text-slate-400" />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
                    No items added
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Click &ldquo;Add Row&rdquo; to start adding items.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ============ SIDEBAR ============ */}
          <aside className="space-y-4">
            <div className="sticky top-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Summary
                </h2>
              </div>
              <div className="space-y-3 p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">
                    Items
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {totals.totalItems}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">
                    Total Qty
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {totals.totalQty}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-xs dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">
                    Total Cost
                  </span>
                  <span className="font-bold text-[#2f8a2f] dark:text-[#9bdd91]">
                    {totals.totalCost.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Workflow
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-900 dark:text-white">
                    Factory Created → Sent → Hold → Awaiting Remaining →
                    Completed
                  </div>
                  <div className="mt-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                    Direct transfer reserves stock immediately. After creating,
                    you can print and send the transfer from the action page.
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <Button
                    onClick={openConfirm}
                    variant="outline"
                    size="sm"
                    className="h-9 w-full text-xs"
                  >
                    Review Transfer
                  </Button>
                  {canCreate && (
                    <Button
                      size="sm"
                      onClick={openConfirm}
                      disabled={submitting}
                      className="h-9 w-full gap-1.5 bg-[#3aa838] text-xs text-white shadow-sm shadow-[#3aa838]/20 hover:bg-[#2f8a2f]"
                    >
                      <Check className="h-3.5 w-3.5" />
                      {submitting ? "Creating…" : "Create Transfer"}
                    </Button>
                  )}
                </div>

                <div className="rounded-lg bg-slate-50 p-2.5 text-[10px] text-slate-500 dark:bg-slate-950/40 dark:text-slate-400">
                  {/* TODO: later auto-fill sender factory from the logged-in user's factory access. */}
                  Currently the sender factory is selectable for admin testing.
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* ============ CONFIRM DIALOG ============ */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent
          className="!w-[96vw] !max-w-[640px] p-0 gap-0 rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950 flex flex-col max-h-[92vh]"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">Confirm factory transfer</DialogTitle>
          <DialogDescription className="sr-only">
            Review the factory shipment before creating it.
          </DialogDescription>

          <div className="shrink-0 border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3aa838]/10 text-[#3aa838]">
                <Check className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Confirm factory transfer
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Review the factory shipment before creating it.
                </p>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50/70 p-4 dark:bg-slate-950/40">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Sender Factory
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                  {locationLabel(
                    factoryOptions.find((f) => f._id === senderFactoryId),
                  )}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Receiver Warehouse
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                  {locationLabel(
                    warehouseOptions.find(
                      (w) => w._id === receiverWarehouseId,
                    ),
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Items ({rows.length})
              </div>
              <div className="mt-2 max-h-56 space-y-2 overflow-auto">
                {rows.map((r, i) => (
                  <div
                    key={r.id}
                    className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 last:border-b-0 last:pb-0 dark:border-slate-800"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium text-slate-900 dark:text-white">
                        {i + 1}. {r.product?.name || r.productId}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        SKU: {r.product?.sku || "-"}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-[11px]">
                      <div className="text-slate-900 dark:text-white">
                        Qty: {r.requestedQty}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400">
                        {r.unit}
                      </div>
                      <div className="font-semibold text-[#2f8a2f] dark:text-[#9bdd91]">
                        {(
                          (r.requestedQty || 0) * (r.costPrice || 0)
                        ).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmOpen(false)}
                className="h-9"
              >
                Back
              </Button>
              <Button
                size="sm"
                onClick={submitTransfer}
                disabled={submitting || !canCreate}
                className="h-9 gap-1.5 bg-[#3aa838] text-white shadow-sm shadow-[#3aa838]/20 hover:bg-[#2f8a2f]"
              >
                <Check className="h-3.5 w-3.5" />
                {submitting ? "Creating…" : "Confirm & Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}