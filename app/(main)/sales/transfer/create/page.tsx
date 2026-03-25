// src/app/transfers/create/page.tsx
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
import { Plus, Trash2, Loader2, Check, ChevronsUpDown } from "lucide-react";

/**
 * Warehouse Transfer - Create Page
 *
 * Backend expectations:
 * - GET /warehouses?page=1&limit=1000
 * - GET /products?page=1&limit=50&q=search   (search by name/sku)
 * - GET /product-stocks?productId=...&warehouseId=...&page=1&limit=1
 * - GET /auth/me  (optional; used to display Created By)
 * - POST /transfers  { transferNo, fromWarehouseId, toWarehouseId, isVirtualTransfer, notes, items: [{productId, quantity, unit, costPrice}] }
 *
 * This page:
 * - Creates transfer only (no editing)
 * - Respects from!=to
 * - Respects stock availability checks on UI (server will also validate in transaction)
 */

/* ---------------- types ---------------- */
type Warehouse = { _id: string; name?: string };
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
  productId?: string;
  product?: Product | null;
  sku?: string;
  unit?: string;
  costPrice?: number;
  qty: number;
  stockDoc?: StockDoc | null;
  available?: number | null;
  subtotal?: number;
  productQuery?: string;
  candidates?: Product[];
  searching?: boolean;
  error?: string | null;
};

/* ---------------- component ---------------- */
export default function TransferCreatePage() {
  const router = useRouter();

  // header/meta
  const [transferNo, setTransferNo] = useState<string>("");
  const [createdByName, setCreatedByName] = useState<string | null>(null);

  // lookups
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(false);

  // form state (only fields backend uses + notes)
  const [fromWarehouseId, setFromWarehouseId] = useState<string>("");
  const [toWarehouseId, setToWarehouseId] = useState<string>("");
  const [isVirtualTransfer, setIsVirtualTransfer] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>("");

  // rows
  const [rows, setRows] = useState<ItemRow[]>(() => [
    {
      id: `r-${Date.now()}`,
      productId: "",
      product: null,
      sku: "",
      unit: "pcs",
      costPrice: 0,
      qty: 1,
      stockDoc: null,
      available: null,
      subtotal: 0,
      productQuery: "",
      candidates: [],
      searching: false,
      error: null,
    },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // per-row timers to debounce product search and stock fetch
  const productTimers = useRef<Record<string, number | null>>({});
  const stockTimers = useRef<Record<string, number | null>>({});

  /* ---------------- initialization ---------------- */
  useEffect(() => {
    generateTransferNo();
    loadReferences();
    loadMe();
    // cleanup timers on unmount
    return () => {
      Object.values(productTimers.current).forEach((t) => t && clearTimeout(t));
      Object.values(stockTimers.current).forEach((t) => t && clearTimeout(t));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function generateTransferNo() {
    const d = new Date();
    const datePart = d.toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.floor(Math.random() * 9000 + 1000);
    setTransferNo(`TR-${datePart}-${rand}`);
  }

  async function loadReferences() {
    try {
      setLoadingRefs(true);
      const res = await api.get("/warehouses?type=Warehouse", {
        params: { page: 1, limit: 1000 },
      });
      setWarehouses(res.data?.data || []);
    } catch (err) {
      console.error("load refs error", err);
      toast.error("Failed to load warehouses");
    } finally {
      setLoadingRefs(false);
    }
  }

  async function loadMe() {
    try {
      const res = await api.get("/auth/me").catch(() => null);
      if (res?.data)
        setCreatedByName(res.data?.name || res.data?.email || null);
    } catch {
      // ignore
    }
  }

  /* ---------------- row helpers ---------------- */
  const addRow = useCallback((afterRowId?: string) => {
    setRows((prev) => {
      const newRow: ItemRow = {
        id: `r-${Date.now()}`,
        productId: "",
        product: null,
        sku: "",
        unit: "pcs",
        costPrice: 0,
        qty: 1,
        stockDoc: null,
        available: null,
        subtotal: 0,
        productQuery: "",
        candidates: [],
        searching: false,
        error: null,
      };
      if (!afterRowId) return [...prev, newRow];
      const idx = prev.findIndex((r) => r.id === afterRowId);
      if (idx === -1) return [...prev, newRow];
      const copy = [...prev];
      copy.splice(idx + 1, 0, newRow);
      return copy;
    });
  }, []);

  const removeRow = useCallback((rowId: string) => {
    if (productTimers.current[rowId]) {
      clearTimeout(productTimers.current[rowId]!);
      productTimers.current[rowId] = null;
    }
    if (stockTimers.current[rowId]) {
      clearTimeout(stockTimers.current[rowId]!);
      stockTimers.current[rowId] = null;
    }
    setRows((prev) => prev.filter((r) => r.id !== rowId));
  }, []);

  function updateRow(rowId: string, patch: Partial<ItemRow>) {
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r)),
    );
  }

  /* ---------------- product search (per-row, debounced) ---------------- */
  function onProductQuery(rowId: string, q: string) {
    updateRow(rowId, { productQuery: q, searching: !!q });
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
        console.error("product search error", err);
        updateRow(rowId, { candidates: [], searching: false });
      } finally {
        if (productTimers.current[rowId]) {
          clearTimeout(productTimers.current[rowId]!);
          productTimers.current[rowId] = null;
        }
      }
    }, 240);
  }

  async function selectProductForRow(rowId: string, p: Product | null) {
    if (!p) {
      updateRow(rowId, {
        product: null,
        productId: "",
        sku: "",
        unit: "pcs",
        costPrice: 0,
        available: null,
        stockDoc: null,
        productQuery: "",
        candidates: [],
        searching: false,
        error: null,
      });
      return;
    }

    updateRow(rowId, {
      product: p,
      productId: p._id,
      sku: p.sku ?? "",
      unit: p.unit ?? "pcs",
      costPrice: p.salePrice ?? 0,
      productQuery: "",
      candidates: [],
      searching: false,
      error: null,
    });

    // fetch stock for the chosen product in source warehouse
    fetchStockDebounced(rowId, p._id as string, fromWarehouseId || undefined);
  }

  /* ---------------- stock fetch per-row (debounced) ---------------- */
  function computeAvailable(sd?: StockDoc | null) {
    if (!sd) return null;
    const q = sd.quantity ?? 0;
    const inc = sd.incomingTransfer ?? 0;
    const rs = sd.reservedForSales ?? 0;
    const rt = sd.reservedForTransfer ?? 0;
    return q + inc - rs - rt;
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
      const available = computeAvailable(sd);
      updateRow(rowId, { stockDoc: sd, available });
    } catch (err) {
      console.error("stock fetch error", err);
      updateRow(rowId, {
        stockDoc: null,
        available: null,
        error: "Failed to fetch stock",
      });
    } finally {
      if (stockTimers.current[rowId]) {
        clearTimeout(stockTimers.current[rowId]!);
        stockTimers.current[rowId] = null;
      }
    }
  }

  // when fromWarehouse changes, refresh stock for all rows
  useEffect(() => {
    rows.forEach((r) => {
      if (r.productId)
        fetchStockDebounced(r.id, r.productId, fromWarehouseId || undefined);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromWarehouseId]);

  /* ---------------- qty/change handlers ---------------- */
  function onQtyChange(rowId: string, raw: number) {
    const qty = Math.max(0, Number(raw || 0));
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    let error: string | null = null;
    if (row.available != null && qty > (row.available ?? 0)) {
      error = `Qty exceeds available (${row.available})`;
    }
    const subtotal = (row.costPrice ?? 0) * qty;
    updateRow(rowId, { qty, subtotal, error });
  }

  function onCostChange(rowId: string, raw: number) {
    const cost = Number(raw || 0);
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    const subtotal = cost * (row.qty ?? 0);
    updateRow(rowId, { costPrice: cost, subtotal });
  }

  /* ---------------- totals & validation ---------------- */
  const totals = useMemo(() => {
    const totalItems = rows.length;
    const totalQty = rows.reduce((s, r) => s + (r.qty || 0), 0);
    const totalCost = rows.reduce(
      (s, r) => s + (r.qty || 0) * (r.costPrice ?? 0),
      0,
    );
    return { totalItems, totalQty, totalCost };
  }, [rows]);

  function validateBeforeConfirm() {
    if (!transferNo?.trim()) {
      toast.error("Transfer number is required");
      return false;
    }
    if (!fromWarehouseId) {
      toast.error("Select source warehouse");
      return false;
    }
    if (!toWarehouseId) {
      toast.error("Select destination warehouse");
      return false;
    }
    if (fromWarehouseId === toWarehouseId) {
      toast.error("From and To warehouses cannot be the same");
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
      if (!r.qty || r.qty <= 0) {
        toast.error(`Row ${i + 1}: quantity must be > 0`);
        return false;
      }
      if (r.available != null && r.qty > (r.available ?? 0)) {
        toast.error(`Row ${i + 1}: qty exceeds available`);
        return false;
      }
      if (r.error) {
        toast.error(`Row ${i + 1}: ${r.error}`);
        return false;
      }
    }
    return true;
  }

  /* ---------------- confirm & submit ---------------- */
  function openConfirm() {
    if (!validateBeforeConfirm()) return;
    setConfirmOpen(true);
  }

  async function submitConfirmed() {
    setConfirmOpen(false);
    setSubmitting(true);

    const payload = {
      transferNo: transferNo.trim(),
      fromWarehouseId,
      toWarehouseId,
      isVirtualTransfer,
      notes: notes || undefined,
      items: rows.map((r) => ({
        productId: r.productId,
        quantity: r.qty,
        unit: r.unit,
        costPrice: r.costPrice,
      })),
    };

    try {
      await api.post("/transfers", payload);
      toast.success("Transfer created");
      router.push("/sales/transfer/status");
    } catch (err: any) {
      console.error("create transfer error", err);
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to create transfer";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------------- small helpers ---------------- */
  function formatStock(sd?: StockDoc | null) {
    if (!sd) return "";
    return `q:${sd.quantity ?? 0} • inc:${sd.incomingTransfer ?? 0} • rS:${sd.reservedForSales ?? 0} • rT:${sd.reservedForTransfer ?? 0}`;
  }

  /* ---------------- render ---------------- */
  return (
    <div className="min-h-screen p-6 bg-slate-50">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Create Warehouse Transfer</h1>
            <div className="mt-2 text-sm text-muted-foreground">
              Transfer No:&nbsp;
              <Input
                className="inline-block w-56"
                value={transferNo}
                onChange={(e) => setTransferNo(e.target.value)}
              />
              {createdByName ? (
                <span className="ml-4">
                  Created by: <strong>{createdByName}</strong>
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => generateTransferNo()}>
              Regenerate No
            </Button>

            <Button onClick={openConfirm} disabled={submitting}>
              <Check className="h-4 w-4 mr-2" />
              {submitting ? "Creating..." : "Create Transfer"}
            </Button>
          </div>
        </div>

        {/* main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: form */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Transfer Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-sm text-muted-foreground">
                      From Warehouse
                    </label>
                    <select
                      className="w-full border rounded px-3 py-2"
                      value={fromWarehouseId}
                      onChange={(e) => setFromWarehouseId(e.target.value)}
                    >
                      <option value="">Select source</option>
                      {warehouses.map((w) => (
                        <option key={w._id} value={w._id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm text-muted-foreground">
                      To Warehouse
                    </label>
                    <select
                      className="w-full border rounded px-3 py-2"
                      value={toWarehouseId}
                      onChange={(e) => setToWarehouseId(e.target.value)}
                    >
                      <option value="">Select destination</option>
                      {warehouses.map((w) => (
                        <option key={w._id} value={w._id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-3">
                    <div>
                      <label className="text-sm text-muted-foreground">
                        Virtual Transfer
                      </label>
                      <div className="text-xs text-muted-foreground mt-1">
                        Treat as incoming on destination (destination can create
                        sales orders).
                      </div>
                    </div>
                    <div className="ml-auto">
                      <Switch
                        checked={isVirtualTransfer}
                        onCheckedChange={(v) =>
                          setIsVirtualTransfer(Boolean(v))
                        }
                      />
                    </div>
                  </div>

                  <div className="md:col-span-3 mt-2">
                    <label className="text-sm text-muted-foreground">
                      Notes (optional)
                    </label>
                    <textarea
                      className="w-full border rounded px-3 py-2"
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full table-auto bg-white">
                    <thead className="bg-slate-50">
                      <tr className="text-left text-sm">
                        <th className="p-3 w-8">#</th>
                        <th className="p-3">Product</th>
                        <th className="p-3 w-36 text-center">Available</th>
                        <th className="p-3 w-36 text-center">Qty</th>
                        <th className="p-3 w-28 text-center">Unit</th>
                        <th className="p-3 w-36 text-center">Cost</th>
                        <th className="p-3 w-36 text-right">Subtotal</th>
                        <th className="p-3 w-28 text-center">Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {rows.map((r, idx) => {
                        const over =
                          r.available != null && r.qty > (r.available ?? 0);

                        return (
                          <tr
                            key={r.id}
                            className={`align-top border-t ${over ? "bg-red-50" : ""}`}
                          >
                            <td className="p-3 text-center font-semibold">
                              {idx + 1}
                            </td>

                            {/* Product selector */}
                            <td className="p-3">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    className="w-full justify-between h-14"
                                  >
                                    <div className="text-left">
                                      <div className="font-medium">
                                        {r.product?.name ?? "Select product"}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {r.sku ?? ""}
                                      </div>
                                    </div>
                                    <ChevronsUpDown className="h-4 w-4 opacity-60" />
                                  </Button>
                                </PopoverTrigger>

                                <PopoverContent className="w-[520px]">
                                  <div className="p-2">
                                    <Command>
                                      <CommandInput
                                        placeholder="Type product name or SKU..."
                                        value={r.productQuery ?? ""}
                                        onValueChange={(v: string) =>
                                          onProductQuery(r.id, v)
                                        }
                                      />
                                      <CommandEmpty>No products</CommandEmpty>
                                      <CommandGroup>
                                        {r.searching ? (
                                          <div className="p-3 text-center">
                                            <Loader2 className="animate-spin" />
                                          </div>
                                        ) : r.candidates &&
                                          r.candidates.length > 0 ? (
                                          r.candidates.map((p) => (
                                            <CommandItem
                                              key={p._id}
                                              value={p.name}
                                              onSelect={() =>
                                                selectProductForRow(r.id, p)
                                              }
                                            >
                                              <div className="flex items-center justify-between w-full">
                                                <div>
                                                  <div className="font-medium">
                                                    {p.name}
                                                  </div>
                                                  <div className="text-xs text-muted-foreground">
                                                    {p.sku}
                                                  </div>
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                  {p.unit ?? "pcs"}
                                                </div>
                                              </div>
                                            </CommandItem>
                                          ))
                                        ) : (
                                          <div className="p-3 text-sm text-muted-foreground">
                                            No results. Try another term.
                                          </div>
                                        )}
                                      </CommandGroup>
                                    </Command>
                                  </div>
                                </PopoverContent>
                              </Popover>

                              {/* product detail */}
                              <div className="text-xs text-muted-foreground mt-1">
                                {r.product ? r.product.name : ""}
                              </div>
                            </td>

                            {/* available */}
                            <td className="p-3 text-center">
                              {r.available == null ? (
                                <div className="text-muted-foreground">-</div>
                              ) : (
                                <div>
                                  <div
                                    className={`font-semibold ${r.available <= 0 ? "text-red-600" : ""}`}
                                  >
                                    {r.available}
                                  </div>
                                  {r.stockDoc && (
                                    <div className="text-[11px] text-muted-foreground mt-1">
                                      {formatStock(r.stockDoc)}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* qty (LARGE) */}
                            <td className="p-3 text-center">
                              <Input
                                type="number"
                                value={r.qty}
                                onChange={(e) =>
                                  onQtyChange(r.id, Number(e.target.value))
                                }
                                className={`h-12 min-w-16 text-lg font-semibold ${over ? "border-red-500" : ""}`}
                              />
                              {over && (
                                <div className="text-xs text-red-600 mt-1">
                                  exceeds available
                                </div>
                              )}
                            </td>

                            {/* unit */}
                            <td className="p-3 text-center">
                              <Input
                                value={r.unit}
                                onChange={(e) =>
                                  updateRow(r.id, { unit: e.target.value })
                                }
                              />
                            </td>

                            {/* cost */}
                            <td className="p-3 text-center">
                              <Input
                                type="number"
                                value={r.costPrice ?? 0}
                                onChange={(e) =>
                                  onCostChange(r.id, Number(e.target.value))
                                }
                              />
                            </td>

                            {/* subtotal */}
                            <td className="p-3 text-right font-semibold">
                              {(
                                (r.subtotal ?? r.qty * (r.costPrice ?? 0)) ||
                                0
                              ).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>

                            {/* actions */}
                            <td className="p-3 text-center">
                              <div className="flex justify-center gap-2">
                                <Button
                                  variant="ghost"
                                  onClick={() => addRow(r.id)}
                                  title="Add row below"
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                                {rows.length > 1 && (
                                  <Button
                                    variant="ghost"
                                    onClick={() => removeRow(r.id)}
                                    title="Remove row"
                                  >
                                    <Trash2 className="h-4 w-4 text-red-600" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* quick add at bottom */}
                <div className="mt-3 flex gap-2">
                  <Button variant="outline" onClick={() => addRow()}>
                    Add Row
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: summary (sticky) */}
          <aside className="space-y-4">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <div>Items</div>
                    <div className="font-medium">{totals.totalItems}</div>
                  </div>
                  <div className="flex justify-between">
                    <div>Total Qty</div>
                    <div className="font-medium">{totals.totalQty}</div>
                  </div>
                  <div className="flex justify-between">
                    <div>Total Cost</div>
                    <div className="font-medium">
                      {totals.totalCost.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="text-sm text-muted-foreground">
                      Virtual Transfer
                    </label>
                    <div className="flex items-center gap-3 mt-1">
                      <Switch
                        checked={isVirtualTransfer}
                        onCheckedChange={(v) =>
                          setIsVirtualTransfer(Boolean(v))
                        }
                      />
                      <div className="text-xs text-muted-foreground">
                        When virtual is ON, destination receives
                        incomingTransfer immediately (can be used for sales).
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <Button
                      onClick={openConfirm}
                      disabled={submitting}
                      className="w-full"
                    >
                      <Check className="h-4 w-4 mr-2" />{" "}
                      {submitting ? "Creating..." : "Create Transfer"}
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => router.push("/sales/transfer/status")}
                      className="w-full mt-2"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  - Transfers reserve stock at creation. Destination stock
                  increases on final approval. <br />- Virtual transfers set
                  incomingTransfer in destination allowing sales before physical
                  arrival.
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>

        {/* Confirm modal */}
        {confirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white w-full max-w-2xl rounded shadow-lg overflow-auto">
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="text-lg font-bold">Confirm Transfer</h3>
                <div>
                  <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
                    Close
                  </Button>
                </div>
              </div>

              <div className="p-4 space-y-3">
                <div className="flex justify-between">
                  <div>Transfer No</div>
                  <div className="font-medium">{transferNo}</div>
                </div>
                <div className="flex justify-between">
                  <div>From</div>
                  <div className="font-medium">
                    {warehouses.find((w) => w._id === fromWarehouseId)?.name ??
                      "-"}
                  </div>
                </div>
                <div className="flex justify-between">
                  <div>To</div>
                  <div className="font-medium">
                    {warehouses.find((w) => w._id === toWarehouseId)?.name ??
                      "-"}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mt-2">Items</h4>
                  <div className="max-h-48 overflow-auto mt-2 border rounded p-2">
                    {rows.map((r, i) => (
                      <div
                        key={r.id}
                        className="flex justify-between items-start py-2 border-b last:border-b-0"
                      >
                        <div>
                          <div className="font-medium">
                            {i + 1}. {r.product?.name ?? r.productId}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {r.sku ?? ""}
                          </div>
                        </div>
                        <div className="text-right">
                          <div>
                            Qty: <strong>{r.qty}</strong>
                          </div>
                          <div>Unit: {r.unit}</div>
                          <div>
                            Subtotal:{" "}
                            {(
                              (r.subtotal ?? r.qty * (r.costPrice ?? 0)) ||
                              0
                            ).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 flex gap-2">
                  <Button
                    onClick={submitConfirmed}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Check className="h-4 w-4 mr-2" /> Confirm & Create
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setConfirmOpen(false)}
                  >
                    Back
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------- helper (outside component) ------------- */
function formatStock(sd?: StockDoc | null) {
  if (!sd) return "";
  return `q:${sd.quantity ?? 0} • inc:${sd.incomingTransfer ?? 0} • rS:${sd.reservedForSales ?? 0} • rT:${sd.reservedForTransfer ?? 0}`;
}
