"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Building2,
  Check,
  ChevronsUpDown,
  Factory,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";

type TransferType = "WAREHOUSE_TO_WAREHOUSE" | "FACTORY_TO_WAREHOUSE";

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

type PayloadItem = {
  productId: string;
  requestedQty: number;
  finalQty: number;
  unit?: string;
  costPrice?: number;
};

const emptyRow = (): ItemRow => ({
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
});

function getLocationName(loc?: Location | null) {
  return (
    loc?.name ||
    loc?.warehouseName ||
    loc?.factoryName ||
    loc?.code ||
    loc?._id ||
    "-"
  );
}

function getLocationType(loc?: Location | null) {
  const raw = String(
    loc?.type || loc?.kind || loc?.entityType || "",
  ).toLowerCase();
  if (raw.includes("factory")) return "Factory";
  if (raw.includes("warehouse")) return "Warehouse";
  return "Location";
}

function isWarehouse(loc?: Location | null) {
  const t = String(
    loc?.type || loc?.kind || loc?.entityType || "",
  ).toLowerCase();
  return t.includes("warehouse") || (!t && true);
}

function isFactory(loc?: Location | null) {
  const t = String(
    loc?.type || loc?.kind || loc?.entityType || "",
  ).toLowerCase();
  return t.includes("factory");
}

function calcAvailable(sd?: StockDoc | null) {
  if (!sd) return null;
  const q = sd.quantity ?? 0;
  const inc = sd.incomingTransfer ?? 0;
  const rs = sd.reservedForSales ?? 0;
  const rt = sd.reservedForTransfer ?? 0;
  return q + inc - rs - rt;
}

export default function WarehouseTransferCreatePage() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [transferNo, setTransferNo] = useState("");
  const [remarks, setRemarks] = useState("");

  const [transferType, setTransferType] = useState<TransferType>(
    "WAREHOUSE_TO_WAREHOUSE",
  );
  const [transferMode] = useState<"REQUEST">("REQUEST");

  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);

  const [receiverWarehouseId, setReceiverWarehouseId] = useState("");
  const [senderLocationId, setSenderLocationId] = useState("");

  const [createdByName, setCreatedByName] = useState<string | null>(null);

  const [rows, setRows] = useState<ItemRow[]>([emptyRow()]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const productTimers = useRef<Record<string, number | null>>({});
  const stockTimers = useRef<Record<string, number | null>>({});
  const costTimers = useRef<Record<string, number | null>>({});

  useEffect(() => {
    generateTransferNo();
    loadLocations();
    loadMe();

    return () => {
      Object.values(productTimers.current).forEach((t) => t && clearTimeout(t));
      Object.values(stockTimers.current).forEach((t) => t && clearTimeout(t));
      Object.values(costTimers.current).forEach((t) => t && clearTimeout(t));
    };
  }, []);

  useEffect(() => {
    // TODO: later auto-select receiver from authenticated user's warehouseId
    // and hide this field for non-admin users.
  }, [receiverWarehouseId]);

  useEffect(() => {
    setSenderLocationId("");
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        stockDoc: null,
        available: null,
        error: null,
        costPrice: 0, // reset cost when sender changes
      })),
    );
  }, [transferType]);

  useEffect(() => {
    rows.forEach((row) => {
      if (row.productId) {
        fetchStockDebounced(
          row.id,
          row.productId,
          senderLocationId || undefined,
        );
        fetchCostDebounced(
          row.id,
          row.productId,
          senderLocationId || undefined,
        );
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [senderLocationId]);

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
      toast.error("Failed to load warehouses/factories");
    } finally {
      setLoadingLocations(false);
    }
  }

  async function loadMe() {
    try {
      const res = await api.get("/auth/me").catch(() => null);
      if (res?.data) {
        setCreatedByName(res.data?.name || res.data?.email || null);
      }
    } catch {
      // ignore
    }
  }

  const senderOptions = useMemo(() => {
    if (transferType === "WAREHOUSE_TO_WAREHOUSE") {
      return locations.filter((l) => isWarehouse(l));
    }
    return locations.filter((l) => isFactory(l));
  }, [locations, transferType]);

  const receiverOptions = useMemo(() => {
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

    fetchStockDebounced(rowId, product._id, senderLocationId || undefined);
    fetchCostDebounced(rowId, product._id, senderLocationId || undefined);
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

  function validateStep1() {
    if (!transferType) {
      toast.error("Select transfer type");
      return false;
    }
    return true;
  }

  function validateStep2() {
    if (!receiverWarehouseId) {
      toast.error("Select receiver warehouse");
      return false;
    }
    if (!senderLocationId) {
      toast.error("Select sender location");
      return false;
    }
    if (receiverWarehouseId === senderLocationId) {
      toast.error("Sender and receiver cannot be the same");
      return false;
    }
    return true;
  }

  function validateStep3() {
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

  function goNext() {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    if (step === 3 && !validateStep3()) return;
    setStep((s) => Math.min(4, s + 1));
  }

  function goBack() {
    setStep((s) => Math.max(1, s - 1));
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

  function buildPayload() {
    return {
      transferNo: transferNo.trim(),
      transferType,
      transferMode,
      sender: senderLocationId,
      receiver: receiverWarehouseId,
      remarks: remarks || undefined,
      items: rows.map(
        (r): PayloadItem => ({
          productId: r.productId,
          requestedQty: r.requestedQty,
          finalQty: r.finalQty,
          unit: r.unit,
          costPrice: r.costPrice,
        }),
      ),
    };
  }

  async function submitTransfer() {
    if (!validateStep1() || !validateStep2() || !validateStep3()) return;

    setSubmitting(true);
    try {
      await api.post("/transfers", buildPayload());
      toast.success("Transfer created successfully");
      router.push("/sales/transfer/status");
    } catch (err: any) {
      console.error(err);
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to create transfer",
      );
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  }

  const stepItems = [
    { n: 1, label: "Transfer Type" },
    { n: 2, label: "Locations" },
    { n: 3, label: "Items" },
    { n: 4, label: "Review" },
  ];

  const flowText =
    transferType === "WAREHOUSE_TO_WAREHOUSE"
      ? "Requested → Receiver NSM → Sender Review → Sender NSM → Sent → Hold → Awaiting Remaining → Completed"
      : "Requested → Receiver NSM → Sent → Hold → Awaiting Remaining → Completed";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowRightLeft className="h-4 w-4" />
              <span>Warehouse Transfer Create</span>
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              Create a new transfer request
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Build the request in a guided wizard. This page is designed for
              admin testing now.
              <span className="block mt-1">
                {/* TODO: later restrict step visibility and auto-select receiver/sender based on authenticated role and warehouse access. */}
              </span>
            </p>
          </div>

          <div className="rounded-xl border bg-white px-4 py-3 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Transfer No
            </div>
            <div className="mt-1 flex items-center gap-2">
              <Input
                className="w-60"
                value={transferNo}
                onChange={(e) => setTransferNo(e.target.value)}
                placeholder="TR-YYYYMMDD-XXXX"
              />
              <Button variant="outline" onClick={generateTransferNo}>
                Regenerate
              </Button>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Created by: {createdByName || "Current user"}
            </div>
          </div>
        </div>

        <div className="mb-6 grid gap-3 md:grid-cols-4">
          {stepItems.map((s) => {
            const active = step === s.n;
            const done = step > s.n;
            return (
              <div
                key={s.n}
                className={`rounded-xl border bg-white p-4 shadow-sm transition ${
                  active
                    ? "border-slate-900 ring-1 ring-slate-900"
                    : done
                      ? "border-emerald-300"
                      : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{s.label}</div>
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                      active
                        ? "bg-slate-900 text-white"
                        : done
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : s.n}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            {/* Step 1 */}
            {step === 1 && (
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Choose transfer type
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setTransferType("WAREHOUSE_TO_WAREHOUSE")}
                      className={`rounded-2xl border p-5 text-left transition hover:shadow-sm ${
                        transferType === "WAREHOUSE_TO_WAREHOUSE"
                          ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900"
                          : "bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-slate-900 p-3 text-white">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-semibold">
                            Warehouse → Warehouse
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Request product from another warehouse
                          </div>
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTransferType("FACTORY_TO_WAREHOUSE")}
                      className={`rounded-2xl border p-5 text-left transition hover:shadow-sm ${
                        transferType === "FACTORY_TO_WAREHOUSE"
                          ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900"
                          : "bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-slate-900 p-3 text-white">
                          <Factory className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-semibold">
                            Factory → Warehouse
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Request from a factory
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>

                  <div className="rounded-xl border bg-slate-50 p-4">
                    <div className="text-sm font-medium">Workflow preview</div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      {flowText}
                    </div>
                    <div className="mt-3 text-xs text-muted-foreground">
                      Mode is fixed to <strong>REQUEST</strong> for this page.
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={goNext}>Continue</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 2 */}
            {step === 2 && (
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Choose sender and receiver</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium">
                        Receiver Warehouse
                      </label>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {/* TODO: later auto-select this from authenticated user's warehouseId and hide the selector for restricted roles. */}
                      </div>
                      <select
                        className="mt-2 w-full rounded-md border bg-white px-3 py-2"
                        value={receiverWarehouseId}
                        onChange={(e) => setReceiverWarehouseId(e.target.value)}
                      >
                        <option value="">Select receiver warehouse</option>
                        {receiverOptions.map((loc) => (
                          <option key={loc._id} value={loc._id}>
                            {getLocationName(loc)} ({getLocationType(loc)})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-sm font-medium">
                        {transferType === "WAREHOUSE_TO_WAREHOUSE"
                          ? "Sender Warehouse"
                          : "Sender Factory"}
                      </label>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {/* TODO: later restrict sender options by role permissions and accessible locations. */}
                      </div>
                      <select
                        className="mt-2 w-full rounded-md border bg-white px-3 py-2"
                        value={senderLocationId}
                        onChange={(e) => setSenderLocationId(e.target.value)}
                      >
                        <option value="">
                          {loadingLocations ? "Loading..." : "Select sender"}
                        </option>
                        {senderOptions.map((loc) => (
                          <option key={loc._id} value={loc._id}>
                            {getLocationName(loc)} ({getLocationType(loc)})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-slate-50 p-4 text-sm text-muted-foreground">
                    Receiver is the warehouse that creates the request. Sender
                    is the warehouse or factory that will process and dispatch
                    it.
                  </div>

                  <div className="flex justify-between gap-3">
                    <Button variant="outline" onClick={goBack}>
                      Back
                    </Button>
                    <Button onClick={goNext}>Continue</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 3 – unchanged */}
            {step === 3 && (
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-3">
                    <span>Items</span>
                    <Button variant="outline" onClick={() => addRow()}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add item
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="overflow-x-auto rounded-xl border bg-white">
                    <table className="min-w-full table-auto">
                      <thead className="bg-slate-50 text-left text-sm">
                        <tr>
                          <th className="w-12 px-3 py-3">#</th>
                          <th className="px-3 py-3">Product</th>
                          <th className="w-32 px-3 py-3 text-center">
                            Available
                          </th>
                          <th className="w-32 px-3 py-3 text-center">Qty</th>
                          <th className="w-28 px-3 py-3 text-center">Unit</th>
                          <th className="w-32 px-3 py-3 text-center">Cost</th>
                          <th className="w-32 px-3 py-3 text-right">
                            Subtotal
                          </th>
                          <th className="w-28 px-3 py-3 text-center">Action</th>
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
                              className={`border-t align-top ${over ? "bg-red-50" : ""}`}
                            >
                              <td className="px-3 py-3 text-center font-semibold">
                                {idx + 1}
                              </td>

                              <td className="px-3 py-3">
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      className="h-14 w-full justify-between"
                                    >
                                      <div className="text-left">
                                        <div className="font-medium">
                                          {r.product?.name || "Select product"}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                          {r.product?.sku ||
                                            "Search by name or SKU"}
                                        </div>
                                      </div>
                                      <ChevronsUpDown className="h-4 w-4 opacity-60" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[560px] p-0">
                                    <Command>
                                      <CommandInput
                                        placeholder="Search product..."
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
                                                <div>
                                                  <div className="font-medium">
                                                    {p.name}
                                                  </div>
                                                  <div className="text-xs text-muted-foreground">
                                                    SKU: {p.sku || "-"}
                                                  </div>
                                                </div>
                                                <div className="text-xs text-muted-foreground">
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
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {r.product?.name
                                    ? `Selected: ${r.product.name}`
                                    : ""}
                                </div>
                              </td>

                              <td className="px-3 py-3 text-center">
                                {r.available == null ? (
                                  <div className="text-muted-foreground">-</div>
                                ) : (
                                  <div>
                                    <div
                                      className={`font-semibold ${r.available <= 0 ? "text-red-600" : ""}`}
                                    >
                                      {r.available}
                                    </div>
                                    {r.stockDoc ? (
                                      <div className="mt-1 text-[11px] text-muted-foreground">
                                        q:{r.stockDoc.quantity ?? 0} • inc:
                                        {r.stockDoc.incomingTransfer ?? 0} • rT:
                                        {r.stockDoc.reservedForTransfer ?? 0}
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
                                  className={`h-12 text-lg font-semibold ${
                                    over ? "border-red-500" : ""
                                  }`}
                                />
                                {over ? (
                                  <div className="mt-1 text-xs text-red-600">
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
                                />
                              </td>

                              <td className="px-3 py-3 text-right font-semibold">
                                {(
                                  (r.requestedQty || 0) * (r.costPrice || 0)
                                ).toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>

                              <td className="px-3 py-3 text-center">
                                <div className="flex justify-center gap-2">
                                  <Button
                                    variant="ghost"
                                    onClick={() => addRow(r.id)}
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    onClick={() => removeRow(r.id)}
                                  >
                                    <Trash2 className="h-4 w-4 text-red-600" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <Button variant="outline" onClick={goBack}>
                      Back
                    </Button>
                    <Button onClick={goNext}>Review</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 4 – unchanged */}
            {step === 4 && (
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Review and submit</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border bg-white p-4">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        Transfer Type
                      </div>
                      <div className="mt-1 font-semibold">
                        {transferType === "WAREHOUSE_TO_WAREHOUSE"
                          ? "Warehouse → Warehouse"
                          : "Factory → Warehouse"}
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        Mode: <strong>REQUEST</strong>
                      </div>
                    </div>

                    <div className="rounded-xl border bg-white p-4">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        Flow
                      </div>
                      <div className="mt-1 text-sm">{flowText}</div>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-white p-4">
                    <div className="grid gap-2 text-sm md:grid-cols-2">
                      <div>
                        <div className="text-muted-foreground">
                          Receiver Warehouse
                        </div>
                        <div className="font-medium">
                          {getLocationName(
                            receiverOptions.find(
                              (l) => l._id === receiverWarehouseId,
                            ),
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">
                          {transferType === "WAREHOUSE_TO_WAREHOUSE"
                            ? "Sender Warehouse"
                            : "Sender Factory"}
                        </div>
                        <div className="font-medium">
                          {getLocationName(
                            senderOptions.find(
                              (l) => l._id === senderLocationId,
                            ),
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-white p-4">
                    <div className="text-sm font-semibold">Items</div>
                    <div className="mt-3 space-y-3">
                      {rows.map((r, i) => (
                        <div
                          key={r.id}
                          className="flex items-start justify-between gap-4 border-b pb-2 last:border-b-0 last:pb-0"
                        >
                          <div>
                            <div className="font-medium">
                              {i + 1}. {r.product?.name || r.productId}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              SKU: {r.product?.sku || "-"} • Unit: {r.unit}
                            </div>
                          </div>
                          <div className="text-right text-sm">
                            <div>
                              Qty: <strong>{r.requestedQty}</strong>
                            </div>
                            <div>
                              Cost:{" "}
                              {r.costPrice.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border bg-slate-50 p-4">
                    <label className="text-sm font-medium">Remarks</label>
                    <textarea
                      className="mt-2 min-h-[110px] w-full rounded-md border bg-white px-3 py-2 outline-none"
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Optional remarks for the transfer..."
                    />
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Button variant="outline" onClick={goBack}>
                      Back
                    </Button>

                    <Button
                      onClick={() => setConfirmOpen(true)}
                      disabled={submitting}
                      className="bg-slate-900 text-white hover:bg-slate-800"
                    >
                      <Check className="mr-2 h-4 w-4" />
                      {submitting ? "Creating..." : "Create Transfer"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <aside className="space-y-6">
            <Card className="shadow-sm sticky top-6">
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span>Items</span>
                  <strong>{totals.totalItems}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Total Qty</span>
                  <strong>{totals.totalQty}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Total Cost</span>
                  <strong>
                    {totals.totalCost.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </strong>
                </div>

                <div className="rounded-xl border bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Current Step
                  </div>
                  <div className="mt-1 font-semibold">
                    {stepItems.find((s) => s.n === step)?.label}
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">
                    This wizard is intentionally built for admin testing now.
                    <br />
                    {/* TODO: later apply role-based visibility, auto-fill receiver warehouse, and lock sender options based on permissions. */}
                  </div>
                </div>

                <div className="rounded-xl border bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Mode
                  </div>
                  <div className="mt-1 font-semibold">REQUEST</div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Sender will approve and dispatch after the request workflow.
                  </div>
                </div>

                <div className="pt-1">
                  <Button className="w-full" onClick={goNext} variant="outline">
                    Next
                  </Button>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h3 className="text-lg font-bold">Confirm transfer</h3>
                <p className="text-sm text-muted-foreground">
                  Please review the request before submission.
                </p>
              </div>
              <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
                Close
              </Button>
            </div>

            <div className="space-y-4 p-5">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Receiver Warehouse
                  </div>
                  <div className="mt-1 font-semibold">
                    {getLocationName(
                      receiverOptions.find(
                        (l) => l._id === receiverWarehouseId,
                      ),
                    )}
                  </div>
                </div>
                <div className="rounded-xl border bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Sender
                  </div>
                  <div className="mt-1 font-semibold">
                    {getLocationName(
                      senderOptions.find((l) => l._id === senderLocationId),
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border bg-white p-4">
                <div className="text-sm font-semibold">Items</div>
                <div className="mt-3 max-h-56 overflow-auto space-y-3">
                  {rows.map((r, i) => (
                    <div
                      key={r.id}
                      className="flex items-start justify-between gap-4 border-b pb-2 last:border-b-0 last:pb-0"
                    >
                      <div>
                        <div className="font-medium">
                          {i + 1}. {r.product?.name || r.productId}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          SKU: {r.product?.sku || "-"}
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <div>Qty: {r.requestedQty}</div>
                        <div>Unit: {r.unit}</div>
                        <div>
                          Subtotal:{" "}
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

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                  Back
                </Button>
                <Button onClick={submitTransfer} disabled={submitting}>
                  <Check className="mr-2 h-4 w-4" />
                  {submitting ? "Creating..." : "Confirm & Create"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}