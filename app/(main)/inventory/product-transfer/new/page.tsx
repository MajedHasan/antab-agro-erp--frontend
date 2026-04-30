"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
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
  Search,
  Trash2,
  Building2,
} from "lucide-react";

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

export default function FactoryTransferCreatePage() {
  const router = useRouter();

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

  useEffect(() => {
    generateTransferNo();
    loadLocations();

    return () => {
      Object.values(productTimers.current).forEach((t) => t && clearTimeout(t));
      Object.values(stockTimers.current).forEach((t) => t && clearTimeout(t));
    };
  }, []);

  useEffect(() => {
    // TODO: later auto-select senderFactoryId from authenticated user's factoryId
    // and lock this field for non-admin roles.
  }, [senderFactoryId]);

  useEffect(() => {
    rows.forEach((r) => {
      if (r.productId) {
        fetchStockDebounced(r.id, r.productId, senderFactoryId || undefined);
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

    updateRow(rowId, {
      productId: product._id,
      product,
      query: "",
      candidates: [],
      searching: false,
      unit: product.unit || "pcs",
      costPrice: product.salePrice ?? 0,
      requestedQty: 1,
      finalQty: 1,
      error: null,
    });

    fetchStockDebounced(rowId, product._id, senderFactoryId || undefined);
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

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6 space-y-6">
        {/* Header */}
        <div className="rounded-3xl border bg-gradient-to-br from-slate-950 via-slate-900 to-slate-700 p-6 text-white shadow-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <ArrowRightLeft className="h-4 w-4" />
                <span>Factory Direct Transfer</span>
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">
                Create direct factory transfer
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                Create a direct shipment from factory to warehouse. After this,
                the factory can print and dispatch from the action page.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={generateTransferNo}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Regenerate No
              </Button>
              <Button
                onClick={openConfirm}
                className="bg-white text-slate-900 hover:bg-slate-100"
              >
                + Create Transfer
              </Button>
            </div>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-2xl bg-slate-900 p-3 text-white">
                <Factory className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Sender</div>
                <div className="font-bold">
                  {senderFactoryId
                    ? locationLabel(
                        factoryOptions.find((f) => f._id === senderFactoryId),
                      )
                    : "Select factory"}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-2xl bg-slate-900 p-3 text-white">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Receiver</div>
                <div className="font-bold">
                  {receiverWarehouseId
                    ? locationLabel(
                        warehouseOptions.find(
                          (w) => w._id === receiverWarehouseId,
                        ),
                      )
                    : "Select warehouse"}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-2xl bg-slate-900 p-3 text-white">
                <Check className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Items</div>
                <div className="font-bold">{totals.totalItems}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* Main */}
          <div className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Transfer information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Transfer No</label>
                    <Input
                      className="mt-2"
                      value={transferNo}
                      onChange={(e) => setTransferNo(e.target.value)}
                      disabled={true}
                      placeholder="TR-YYYYMMDD-XXXX"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Transfer mode</label>
                    <Input className="mt-2" value="DIRECT" disabled readOnly />
                  </div>

                  <div>
                    <label className="text-sm font-medium">
                      Sender Factory
                    </label>
                    <select
                      className="mt-2 w-full rounded-md border bg-white px-3 py-2"
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
                    <label className="text-sm font-medium">
                      Receiver Warehouse
                    </label>
                    <select
                      className="mt-2 w-full rounded-md border bg-white px-3 py-2"
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
                    <label className="text-sm font-medium">Remarks</label>
                    <textarea
                      className="mt-2 min-h-[110px] w-full rounded-md border bg-white px-3 py-2 outline-none"
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Optional remarks for the transfer..."
                    />
                  </div>
                </div>

                <div className="rounded-xl border bg-slate-50 p-4 text-sm text-muted-foreground">
                  Factory direct transfers reserve stock virtually at creation.
                  The factory will later print and dispatch the sheet from the
                  action page.
                </div>
              </CardContent>
            </Card>

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

              <CardContent>
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
                        <th className="w-32 px-3 py-3 text-right">Subtotal</th>
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
                                    className={`font-semibold ${
                                      r.available <= 0 ? "text-red-600" : ""
                                    }`}
                                  >
                                    {r.available}
                                  </div>
                                  {r.stockDoc ? (
                                    <div className="mt-1 text-[11px] text-muted-foreground">
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

                <div className="mt-3 flex gap-2">
                  <Button variant="outline" onClick={() => addRow()}>
                    Add Row
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <aside className="space-y-4">
            <Card className="sticky top-6 shadow-sm">
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
                    Workflow
                  </div>
                  <div className="mt-1 font-semibold">Factory → Warehouse</div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Direct transfer will create virtual stock movement
                    immediately, then the factory can print and dispatch.
                  </div>
                </div>

                <div className="pt-1">
                  <Button
                    className="w-full"
                    onClick={openConfirm}
                    variant="outline"
                  >
                    Review transfer
                  </Button>
                </div>

                <div className="pt-1">
                  <Button
                    className="w-full"
                    onClick={openConfirm}
                    disabled={submitting}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    {submitting ? "Creating..." : "Create Transfer"}
                  </Button>
                </div>

                <div className="text-xs text-muted-foreground">
                  {/* TODO: later auto-fill sender factory from the logged-in user's factory access. */}
                  Currently this is selectable for admin testing.
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
                <h3 className="text-lg font-bold">Confirm factory transfer</h3>
                <p className="text-sm text-muted-foreground">
                  Review the factory shipment before creating it.
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
                    Sender Factory
                  </div>
                  <div className="mt-1 font-semibold">
                    {locationLabel(
                      factoryOptions.find((f) => f._id === senderFactoryId),
                    )}
                  </div>
                </div>
                <div className="rounded-xl border bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Receiver Warehouse
                  </div>
                  <div className="mt-1 font-semibold">
                    {locationLabel(
                      warehouseOptions.find(
                        (w) => w._id === receiverWarehouseId,
                      ),
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
