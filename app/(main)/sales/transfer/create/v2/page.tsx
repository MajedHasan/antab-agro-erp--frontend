// src/app/transfers/create/page.tsx
"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
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
import { Loader2, Plus, Trash2, Check, Search, Copy } from "lucide-react";

/**
 * Clean, modular Transfer Create page
 *
 * - Item state handled via reducer
 * - Product search modal (full width) with debounce and abort
 * - Per-row stock fetch with abort
 * - Clear validations, inline errors, sticky summary
 *
 * Backend endpoints used:
 * - GET /warehouses?page=1&limit=1000
 * - GET /products?q=...&page=1&limit=50
 * - GET /product-stocks?productId=...&warehouseId=...&page=1&limit=1
 * - GET /auth/me
 * - POST /transfers
 *
 * Notes:
 * - This file keeps subcomponents local for easy copy-paste; consider extracting small components.
 */

/* -----------------------
   Types
   ----------------------- */
type Warehouse = { _id: string; name?: string; code?: string };
type User = { _id: string; name?: string; email?: string };
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
  incomingTransfer?: number;
  reservedForSales?: number;
  reservedForTransfer?: number;
  unit?: string;
};

type ItemRow = {
  id: string;
  product?: Product | null;
  productId?: string;
  sku?: string;
  unit?: string;
  qty: number;
  costPrice: number;
  subtotal: number;
  stock?: StockDoc | null;
  available?: number | null;
  error?: string | null;
  productQuery?: string;
};

/* -----------------------
   Utilities
   ----------------------- */
const uid = (p = "r") =>
  `${p}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

const computeAvailable = (s?: StockDoc | null) =>
  s
    ? (s.quantity ?? 0) +
      (s.incomingTransfer ?? 0) -
      (s.reservedForSales ?? 0) -
      (s.reservedForTransfer ?? 0)
    : null;

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleString() : "-");

/* -----------------------
   Reducer for item rows
   ----------------------- */
type Action =
  | { type: "add_after"; afterId?: string }
  | { type: "add_end" }
  | { type: "remove"; id: string }
  | { type: "duplicate"; id: string }
  | { type: "update"; id: string; patch: Partial<ItemRow> }
  | { type: "set"; rows: ItemRow[] }
  | { type: "clear" };

function rowsReducer(state: ItemRow[], action: Action): ItemRow[] {
  switch (action.type) {
    case "add_end": {
      return [
        ...state,
        {
          id: uid(),
          product: null,
          productId: "",
          sku: "",
          unit: "pcs",
          qty: 1,
          costPrice: 0,
          subtotal: 0,
          stock: null,
          available: null,
          error: null,
          productQuery: "",
        },
      ];
    }
    case "add_after": {
      const newRow = {
        id: uid(),
        product: null,
        productId: "",
        sku: "",
        unit: "pcs",
        qty: 1,
        costPrice: 0,
        subtotal: 0,
        stock: null,
        available: null,
        error: null,
        productQuery: "",
      };
      if (!action.afterId) return [...state, newRow];
      const idx = state.findIndex((r) => r.id === action.afterId);
      if (idx === -1) return [...state, newRow];
      const copy = [...state];
      copy.splice(idx + 1, 0, newRow);
      return copy;
    }
    case "remove":
      return state.length <= 1
        ? state
        : state.filter((r) => r.id !== action.id);
    case "duplicate": {
      const idx = state.findIndex((r) => r.id === action.id);
      if (idx === -1) return state;
      const src = state[idx];
      const dup: ItemRow = {
        ...src,
        id: uid(),
        // clear stock since it may change with warehouse
        stock: null,
        available: null,
        error: null,
      };
      const copy = [...state];
      copy.splice(idx + 1, 0, dup);
      return copy;
    }
    case "update":
      return state.map((r) =>
        r.id === action.id ? { ...r, ...action.patch } : r,
      );
    case "set":
      return action.rows;
    case "clear":
      return [
        {
          id: uid(),
          product: null,
          productId: "",
          sku: "",
          unit: "pcs",
          qty: 1,
          costPrice: 0,
          subtotal: 0,
          stock: null,
          available: null,
          error: null,
          productQuery: "",
        },
      ];
    default:
      return state;
  }
}

/* -----------------------
   ProductSearchModal component
   - full-screen (or centered) modal search
   - debounced search + abort
   ----------------------- */
function ProductSearchModal({
  open,
  onClose,
  onSelect,
  initialQuery,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (p: Product | null) => void;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setQuery(initialQuery ?? "");
    setResults([]);
  }, [initialQuery, open]);

  useEffect(() => {
    if (!open) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!query || query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timerRef.current = window.setTimeout(async () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
      abortRef.current = new AbortController();
      try {
        const res = await api.get("/products", {
          params: { q: query.trim(), page: 1, limit: 50 },
          signal: abortRef.current.signal as any,
        });
        const list: Product[] = res.data?.data ?? res.data ?? [];
        setResults(list);
      } catch (err) {
        if ((err as any)?.name === "AbortError") {
          // ignored
        } else {
          console.error("product search", err);
          toast.error("Product search failed");
        }
      } finally {
        setLoading(false);
        abortRef.current = null;
      }
    }, 240);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
  }, [query, open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:items-center"
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-white rounded shadow-lg overflow-auto max-h-[80vh]">
        <div className="p-4 border-b flex items-center gap-3">
          <Search className="h-5 w-5 text-slate-500" />
          <Input
            autoFocus
            placeholder="Search products by name or SKU..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full"
          />
          <Button
            variant="ghost"
            onClick={() => {
              setQuery("");
              setResults([]);
            }}
          >
            Clear
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="py-12 text-center">
              <Loader2 className="animate-spin mx-auto" />
            </div>
          ) : results.length === 0 ? (
            <div className="text-center text-sm text-slate-500 py-8">
              No results. Try another term.
            </div>
          ) : (
            <ul className="space-y-2">
              {results.map((p) => (
                <li key={p._id}>
                  <button
                    onClick={() => {
                      onSelect(p);
                      onClose();
                    }}
                    className="w-full text-left p-3 rounded hover:bg-slate-50 flex items-center gap-3"
                  >
                    <div className="h-10 w-10 bg-slate-100 rounded flex items-center justify-center">
                      {p.images?.[0]?.url ? (
                        <img
                          src={p.images[0].url}
                          alt=""
                          className="h-10 w-10 object-cover rounded"
                        />
                      ) : (
                        <div className="text-xs">
                          {(p.name || "").slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-slate-500">{p.sku}</div>
                    </div>
                    <div className="text-sm text-slate-600">
                      {p.unit ?? "pcs"}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/* -----------------------
   ItemRow component
   - Renders a single row
   - Opens ProductSearchModal via state up
   ----------------------- */
function ItemRowView({
  row,
  onOpenProduct,
  onQty,
  onCost,
  onUnit,
  onAddAfter,
  onDuplicate,
  onRemove,
}: {
  row: ItemRow;
  onOpenProduct: () => void;
  onQty: (qty: number) => void;
  onCost: (cost: number) => void;
  onUnit: (u: string) => void;
  onAddAfter: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const over = row.available != null && row.qty > (row.available ?? 0);

  return (
    <tr className={`align-top border-t ${over ? "bg-red-50" : ""}`}>
      <td className="p-3 text-center font-semibold">
        {/* idx set by parent in rendering */}
      </td>

      <td className="p-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded bg-slate-100 flex items-center justify-center text-sm font-semibold">
            {(row.product?.name ?? "").slice(0, 2).toUpperCase() || "PR"}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="font-medium">
                {row.product?.name ?? "Select product"}
              </div>
              <div className="text-xs text-slate-500">· {row.sku ?? ""}</div>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <Button
                variant="outline"
                onClick={onOpenProduct}
                className="px-2 py-1 text-xs"
              >
                Select
              </Button>
              <div className="text-xs text-slate-500">
                {row.product
                  ? `${row.product.unit ?? "pcs"} · ${row.product.salePrice ? `৳${row.product.salePrice}` : ""}`
                  : ""}
              </div>
            </div>

            {row.error && (
              <div className="text-xs text-red-600 mt-2">{row.error}</div>
            )}
          </div>
        </div>
      </td>

      <td className="p-3 text-center">
        {row.available == null ? (
          <div className="text-slate-500">-</div>
        ) : (
          <div
            className={`font-semibold ${row.available <= 0 ? "text-red-600" : ""}`}
          >
            {row.available}
          </div>
        )}
        {row.stock && (
          <div className="text-[11px] text-slate-500 mt-1">
            q:{row.stock.quantity ?? 0} • inc:{row.stock.incomingTransfer ?? 0}
          </div>
        )}
      </td>

      <td className="p-3 text-center">
        <div className="flex items-center justify-center gap-2">
          <button
            aria-label="decrease"
            className="px-2 py-1 rounded border"
            onClick={() => onQty(Math.max(0, row.qty - 1))}
          >
            -
          </button>
          <Input
            type="number"
            value={row.qty}
            onChange={(e) => onQty(Number(e.target.value || 0))}
            className={`h-10 w-20 text-lg font-semibold ${over ? "border-red-500" : ""}`}
          />
          <button
            aria-label="increase"
            className="px-2 py-1 rounded border"
            onClick={() => onQty(row.qty + 1)}
          >
            +
          </button>
        </div>
        {over && (
          <div className="text-xs text-red-600 mt-1">exceeds available</div>
        )}
      </td>

      <td className="p-3 text-center">
        <Input
          value={row.unit ?? "pcs"}
          onChange={(e) => onUnit(e.target.value)}
        />
      </td>

      <td className="p-3 text-center">
        <Input
          type="number"
          value={row.costPrice}
          onChange={(e) => onCost(Number(e.target.value || 0))}
        />
      </td>

      <td className="p-3 text-right font-semibold">
        {(row.subtotal || row.qty * row.costPrice || 0).toLocaleString(
          undefined,
          { minimumFractionDigits: 2 },
        )}
      </td>

      <td className="p-3 text-center">
        <div className="flex justify-center gap-2">
          <Button variant="ghost" onClick={onAddAfter} title="Add row">
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" onClick={onDuplicate} title="Duplicate">
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="ghost" onClick={onRemove} title="Remove">
            <Trash2 className="h-4 w-4 text-red-600" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

/* -----------------------
   Confirm modal
   ----------------------- */
function ConfirmModal({
  open,
  onClose,
  payload,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  payload: {
    transferNo: string;
    from?: string;
    to?: string;
    items: ItemRow[];
    notes?: string;
  };
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded shadow-lg w-full max-w-2xl overflow-auto">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-bold">Confirm Transfer</h3>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex justify-between">
            <div>Transfer No</div>
            <div className="font-medium">{payload.transferNo}</div>
          </div>
          <div className="flex justify-between">
            <div>From</div>
            <div className="font-medium">{payload.from ?? "-"}</div>
          </div>
          <div className="flex justify-between">
            <div>To</div>
            <div className="font-medium">{payload.to ?? "-"}</div>
          </div>

          <div>
            <h4 className="font-medium mt-2">Items</h4>
            <div className="max-h-56 overflow-auto mt-2 border rounded p-2">
              {payload.items.map((r, i) => (
                <div
                  key={r.id}
                  className="flex justify-between items-start py-2 border-b last:border-b-0"
                >
                  <div>
                    <div className="font-medium">
                      {i + 1}. {r.product?.name ?? r.productId}
                    </div>
                    <div className="text-xs text-slate-500">{r.sku ?? ""}</div>
                  </div>
                  <div className="text-right">
                    <div>
                      Qty: <strong>{r.qty}</strong>
                    </div>
                    <div>Unit: {r.unit}</div>
                    <div>
                      Subtotal:{" "}
                      {(r.subtotal || r.qty * r.costPrice || 0).toLocaleString(
                        undefined,
                        { minimumFractionDigits: 2 },
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 flex gap-2">
            <Button
              onClick={onConfirm}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Check className="h-4 w-4 mr-2" /> Confirm & Create
            </Button>
            <Button variant="outline" onClick={onClose}>
              Back
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -----------------------
   Main page component
   ----------------------- */
export default function TransferCreatePage() {
  const router = useRouter();

  // header fields
  const [transferNo, setTransferNo] = useState(() => {
    const d = new Date();
    return `TR-${d.toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 9000 + 1000)}`;
  });
  const [createdByName, setCreatedByName] = useState<string | null>(null);

  // lookups
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(false);

  // main form
  const [fromWarehouseId, setFromWarehouseId] = useState<string>("");
  const [toWarehouseId, setToWarehouseId] = useState<string>("");
  const [isVirtual, setIsVirtual] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>("");

  // rows reducer
  const [rows, dispatch] = useReducer(rowsReducer, [
    {
      id: uid(),
      product: null,
      productId: "",
      sku: "",
      unit: "pcs",
      qty: 1,
      costPrice: 0,
      subtotal: 0,
      stock: null,
      available: null,
      error: null,
      productQuery: "",
    } as ItemRow,
  ]);

  // product modal state
  const [productModalOpenFor, setProductModalOpenFor] = useState<string | null>(
    null,
  );
  const [productModalInitialQuery, setProductModalInitialQuery] =
    useState<string>("");

  // confirm modal
  const [confirmOpen, setConfirmOpen] = useState(false);

  // submission state
  const [submitting, setSubmitting] = useState(false);

  // per-row abort controllers for stock fetch
  const stockAbortRef = useRef<Record<string, AbortController | null>>({});

  // fetch lookups on mount
  useEffect(() => {
    (async function load() {
      try {
        setLoadingRefs(true);
        const r = await api.get("/warehouses?type=Warehouse", {
          params: { page: 1, limit: 1000 },
        });
        setWarehouses(r.data?.data ?? r.data ?? []);
      } catch (err) {
        console.error("load warehouses", err);
        toast.error("Failed to load warehouses");
      } finally {
        setLoadingRefs(false);
      }
    })();

    (async function loadMe() {
      try {
        const r = await api.get("/auth/me").catch(() => null);
        if (r?.data) setCreatedByName(r.data?.name ?? r.data?.email ?? null);
      } catch {}
    })();
  }, []);

  /* -----------------------
     When a product is selected from modal
     - set product fields and fetch stock for that row
  ----------------------- */
  const onProductSelect = useCallback(
    async (rowId: string, product: Product | null) => {
      if (!product) {
        dispatch({
          type: "update",
          id: rowId,
          patch: {
            product: null,
            productId: "",
            sku: "",
            unit: "pcs",
            costPrice: 0,
            available: null,
            stock: null,
            productQuery: "",
          },
        });
        return;
      }
      dispatch({
        type: "update",
        id: rowId,
        patch: {
          product,
          productId: product._id,
          sku: product.sku ?? "",
          unit: product.unit ?? "pcs",
          costPrice: product.salePrice ?? 0,
          productQuery: "",
          error: null,
        },
      });

      // fetch stock for this row's product for the current fromWarehouse
      // start fetchStock
      const fetchStock = async () => {
        const pid = product._id;
        const wid = fromWarehouseId;
        if (!pid || !wid) {
          dispatch({
            type: "update",
            id: rowId,
            patch: { stock: null, available: null },
          });
          return;
        }

        // abort previous
        const prev = stockAbortRef.current[rowId];
        if (prev) prev.abort();
        const ac = new AbortController();
        stockAbortRef.current[rowId] = ac;

        try {
          const res = await api.get("/product-stocks", {
            params: { productId: pid, warehouseId: wid, page: 1, limit: 1 },
            signal: ac.signal as any,
          });
          const sd: StockDoc | null = res.data?.data?.[0] ?? null;
          const available = computeAvailable(sd);
          dispatch({
            type: "update",
            id: rowId,
            patch: { stock: sd, available, error: null },
          });
        } catch (err: any) {
          if (err?.name === "AbortError") {
            // ignore
          } else {
            console.error("stock fetch", err);
            dispatch({
              type: "update",
              id: rowId,
              patch: {
                stock: null,
                available: null,
                error: "Failed to fetch stock",
              },
            });
          }
        } finally {
          stockAbortRef.current[rowId] = null;
        }
      };

      fetchStock();
    },
    [fromWarehouseId],
  );

  /* -----------------------
     When fromWarehouseId changes -> refresh stock for all rows with productId
     Abort / restart each
  ----------------------- */
  useEffect(() => {
    rows.forEach((r) => {
      if (!r.productId) return;
      const rowId = r.id;
      const pid = r.productId;
      // abort existing
      const prev = stockAbortRef.current[rowId];
      if (prev) {
        prev.abort();
        stockAbortRef.current[rowId] = null;
      }
      if (!fromWarehouseId) {
        dispatch({
          type: "update",
          id: rowId,
          patch: { stock: null, available: null },
        });
        return;
      }
      const ac = new AbortController();
      stockAbortRef.current[rowId] = ac;
      (async () => {
        try {
          const res = await api.get("/product-stocks", {
            params: {
              productId: pid,
              warehouseId: fromWarehouseId,
              page: 1,
              limit: 1,
            },
            signal: ac.signal as any,
          });
          const sd: StockDoc | null = res.data?.data?.[0] ?? null;
          const available = computeAvailable(sd);
          dispatch({
            type: "update",
            id: rowId,
            patch: { stock: sd, available, error: null },
          });
        } catch (err: any) {
          if (err?.name === "AbortError") return;
          console.error("stock fetch on warehouse change", err);
          dispatch({
            type: "update",
            id: rowId,
            patch: {
              stock: null,
              available: null,
              error: "Failed to fetch stock",
            },
          });
        } finally {
          stockAbortRef.current[rowId] = null;
        }
      })();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromWarehouseId]);

  /* -----------------------
     Row handlers
  ----------------------- */
  const handleAddAfter = (rowId?: string) =>
    dispatch({ type: rowId ? "add_after" : "add_end", afterId: rowId });
  const handleRemove = (id: string) => dispatch({ type: "remove", id });
  const handleDuplicate = (id: string) => dispatch({ type: "duplicate", id });
  const handleUpdate = (id: string, patch: Partial<ItemRow>) =>
    dispatch({ type: "update", id, patch });

  const handleQty = (id: string, qty: number) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const error =
      row.available != null && qty > (row.available ?? 0)
        ? `Qty exceeds available (${row.available})`
        : null;
    handleUpdate(id, { qty, subtotal: qty * row.costPrice, error });
  };
  const handleCost = (id: string, cost: number) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    handleUpdate(id, { costPrice: cost, subtotal: row.qty * cost });
  };
  const handleUnit = (id: string, unit: string) => handleUpdate(id, { unit });

  /* -----------------------
     Totals & validation
  ----------------------- */
  const totals = useMemo(() => {
    const totalItems = rows.length;
    const totalQty = rows.reduce((s, r) => s + (r.qty || 0), 0);
    const totalCost = rows.reduce(
      (s, r) => s + (r.qty || 0) * (r.costPrice || 0),
      0,
    );
    return { totalItems, totalQty, totalCost };
  }, [rows]);

  function validateAll(): { valid: boolean; messages: string[] } {
    const msgs: string[] = [];
    if (!transferNo || !transferNo.trim())
      msgs.push("Transfer number is required");
    if (!fromWarehouseId) msgs.push("Source warehouse is required");
    if (!toWarehouseId) msgs.push("Destination warehouse is required");
    if (fromWarehouseId && toWarehouseId && fromWarehouseId === toWarehouseId)
      msgs.push("From and To warehouses cannot be the same");
    if (rows.length === 0) msgs.push("Add at least one item");
    rows.forEach((r, i) => {
      if (!r.productId) msgs.push(`Row ${i + 1}: product is required`);
      if (!r.qty || r.qty <= 0) msgs.push(`Row ${i + 1}: quantity must be > 0`);
      if (r.available != null && r.qty > (r.available ?? 0))
        msgs.push(`Row ${i + 1}: quantity exceeds available`);
      if (r.error) msgs.push(`Row ${i + 1}: ${r.error}`);
    });
    return { valid: msgs.length === 0, messages: msgs };
  }

  /* -----------------------
     Create transfer
  ----------------------- */
  const submit = async () => {
    const v = validateAll();
    if (!v.valid) {
      v.messages.forEach((m) => toast.error(m));
      return;
    }
    setConfirmOpen(true);
  };

  const submitConfirmed = async () => {
    setConfirmOpen(false);
    setSubmitting(true);
    const payload = {
      transferNo: transferNo.trim(),
      fromWarehouseId,
      toWarehouseId,
      isVirtualTransfer: isVirtual,
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
      console.error("create transfer", err);
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to create transfer",
      );
    } finally {
      setSubmitting(false);
    }
  };

  /* -----------------------
     Product modal select plumbing
  ----------------------- */
  const openProductModalFor = (rowId: string, initialQuery?: string) => {
    setProductModalOpenFor(rowId);
    setProductModalInitialQuery(initialQuery ?? "");
  };
  const closeProductModal = () => setProductModalOpenFor(null);

  const onProductChosen = (p: Product | null) => {
    if (!productModalOpenFor) return;
    onProductSelect(productModalOpenFor, p);
    closeProductModal();
  };

  /* -----------------------
     Render
  ----------------------- */
  return (
    <div className="min-h-screen p-6 bg-slate-50">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Create Warehouse Transfer</h1>
            <div className="mt-2 text-sm text-slate-600">
              <span className="mr-4">Transfer No:</span>
              <Input
                className="inline-block w-64"
                value={transferNo}
                onChange={(e) => setTransferNo(e.target.value)}
              />
              {createdByName && (
                <span className="ml-4">
                  Created by: <strong>{createdByName}</strong>
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() =>
                setTransferNo(
                  `TR-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 9000 + 1000)}`,
                )
              }
            >
              Regenerate No
            </Button>
            <Button onClick={submit} disabled={submitting}>
              <Check className="h-4 w-4 mr-2" />{" "}
              {submitting ? "Creating..." : "Create Transfer"}
            </Button>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* left form */}
          <div className="lg:col-span-2 space-y-4">
            {/* Transfer info */}
            <Card>
              <CardHeader>
                <CardTitle>Transfer Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-sm text-slate-600">
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
                    <label className="text-sm text-slate-600">
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
                      <label className="text-sm text-slate-600">
                        Virtual Transfer
                      </label>
                      <div className="text-xs text-slate-500">
                        Destination will receive incomingTransfer when created.
                      </div>
                    </div>
                    <div className="ml-auto">
                      <Switch
                        checked={isVirtual}
                        onCheckedChange={(v) => setIsVirtual(Boolean(v))}
                      />
                    </div>
                  </div>

                  <div className="md:col-span-3 mt-2">
                    <label className="text-sm text-slate-600">
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

            {/* Items */}
            <Card>
              <CardHeader>
                <CardTitle>Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full table-auto bg-white">
                    <thead className="bg-slate-50 text-sm">
                      <tr>
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
                      {rows.map((r, i) => (
                        <React.Fragment key={r.id}>
                          <ItemRowView
                            row={r}
                            onOpenProduct={() =>
                              openProductModalFor(r.id, r.productQuery)
                            }
                            onQty={(q) => handleQty(r.id, q)}
                            onCost={(c) => handleCost(r.id, c)}
                            onUnit={(u) => handleUnit(r.id, u)}
                            onAddAfter={() => handleAddAfter(r.id)}
                            onDuplicate={() => handleDuplicate(r.id)}
                            onRemove={() => handleRemove(r.id)}
                          />
                          {/* index cell injected as separate row to keep ItemRowView generic */}
                          <tr className="hidden" aria-hidden>
                            <td>{i + 1}</td>
                          </tr>
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => dispatch({ type: "add_end" })}
                  >
                    <Plus className="h-4 w-4 mr-2" /> Add Row
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* summary */}
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
                      })}
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    {rows.some(
                      (r) => r.available != null && r.qty > (r.available ?? 0),
                    ) && (
                      <div className="text-xs text-red-700 bg-red-50 p-2 rounded">
                        One or more items exceed available stock.
                      </div>
                    )}

                    {fromWarehouseId &&
                      toWarehouseId &&
                      fromWarehouseId === toWarehouseId && (
                        <div className="text-xs text-red-700 bg-red-50 p-2 rounded">
                          From and To warehouses are the same.
                        </div>
                      )}
                  </div>

                  <div className="mt-4">
                    <Button
                      onClick={submit}
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
                <div className="text-sm text-slate-600">
                  - Transfers reserve stock at creation. Destination stock
                  increases on final approval.
                  <br />- Virtual transfers set incomingTransfer at destination
                  so sales may be created before arrival.
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>

        {/* product modal */}
        <ProductSearchModal
          open={!!productModalOpenFor}
          onClose={closeProductModal}
          initialQuery={productModalInitialQuery ?? ""}
          onSelect={(p) => onProductChosen(p)}
        />

        {/* confirm modal */}
        <ConfirmModal
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          payload={{
            transferNo,
            from: warehouses.find((w) => w._id === fromWarehouseId)?.name,
            to: warehouses.find((w) => w._id === toWarehouseId)?.name,
            items: rows,
            notes,
          }}
          onConfirm={submitConfirmed}
        />
      </div>
    </div>
  );
}
