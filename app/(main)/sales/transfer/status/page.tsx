// src/app/transfers/list/page.tsx
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
  Loader2,
  Eye,
  Check,
  XCircle,
  ArrowRight,
  Plus,
  BarChart2,
  Truck,
  Clock,
  PackageOpen,
  Search,
} from "lucide-react";

/**
 * Rewritten Transfer List Page
 * - Card list with hover micro-interactions
 * - Sticky stats header
 * - Search (debounced) + keyboard shortcuts
 * - Right-side drawer with full details + stock breakdown
 * - Per-action loaders, skeleton loading, accessible controls
 *
 * Keep style tokens consistent with your app's Tailwind / design system.
 */

/* ============================
   Types (match backend model)
   ============================ */

type Warehouse = {
  _id: string;
  name?: string;
  code?: string;
  address?: string;
};

type User = {
  _id: string;
  name?: string;
  email?: string;
};

type Product = {
  _id: string;
  name?: string;
  sku?: string;
  unit?: string;
  salePrice?: number;
};

type TransferItem = {
  productId?: Product | string;
  quantity?: number;
  unit?: string;
  costPrice?: number;
};

type Transfer = {
  _id: string;
  transferNo?: string;
  fromWarehouseId?: Warehouse | string;
  toWarehouseId?: Warehouse | string;
  items?: TransferItem[];
  isVirtualTransfer?: boolean;
  status?: string;
  notes?: string | null;
  createdBy?: User | string;
  createdAt?: string;
  receivedBy?: User | string;
  receivedAt?: string | null;
  approvedBy?: User | string;
  approvedAt?: string | null;
  approvalLogs?: any[];
};

type ProductStock = {
  productId?: string;
  warehouseId?: string;
  quantity?: number;
  incomingTransfer?: number;
  reservedForSales?: number;
  reservedForTransfer?: number;
};

/* ============================
   Small helpers / formatters
   ============================ */

const STATUS_CLASSES: Record<string, string> = {
  CREATED: "bg-yellow-100 text-yellow-800",
  RECEIVED_BY_WAREHOUSE: "bg-blue-100 text-blue-800",
  FINAL_APPROVED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
  REJECTED: "bg-rose-100 text-rose-800",
};

function statusBadgeClass(status?: string) {
  return STATUS_CLASSES[status ?? ""] ?? "bg-slate-100 text-slate-800";
}
function formatStatus(status?: string) {
  if (!status) return "-";
  return status
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (l) => l.toUpperCase());
}
function fmtWarehouse(w?: Warehouse | string) {
  if (!w) return "-";
  if (typeof w === "string") return w;
  return `${w.name ?? "-"}${w.code ? ` (${w.code})` : ""}`;
}
function fmtUser(u?: User | string) {
  if (!u) return "-";
  if (typeof u === "string") return u;
  return u.name ?? u.email ?? "-";
}
function fmtProductLabel(p?: Product | string) {
  if (!p) return "-";
  if (typeof p === "string") return p;
  return `${p.name ?? "-"}${p.sku ? ` (${p.sku})` : ""}`;
}
function fmtDateTime(dt?: string | Date | null) {
  if (!dt) return "-";
  try {
    return new Date(dt).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(dt);
  }
}
function calculateAvailable(stock?: ProductStock | null) {
  if (!stock) return null;
  return (
    (stock.quantity ?? 0) +
    (stock.incomingTransfer ?? 0) -
    (stock.reservedForSales ?? 0) -
    (stock.reservedForTransfer ?? 0)
  );
}

/* ============================
   Component
   ============================ */

export default function TransferListPage() {
  const router = useRouter();

  // list + filters
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(15);
  const [loading, setLoading] = useState<boolean>(false);

  // search + debounce
  const [q, setQ] = useState<string>("");
  const qRef = useRef<string>("");
  const searchTimer = useRef<number | null>(null);

  // filters
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [fromFilter, setFromFilter] = useState<string>("");
  const [toFilter, setToFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // lookups
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loadingRefs, setLoadingRefs] = useState<boolean>(false);

  // drawer & details
  const [selected, setSelected] = useState<Transfer | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [itemStockMap, setItemStockMap] = useState<
    Record<string, ProductStock | null>
  >({});

  // action loading per-transfer-action key
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, limit)));

  /* -----------------------
     Fetch warehouses
     ----------------------- */
  const fetchWarehouses = useCallback(async () => {
    try {
      setLoadingRefs(true);
      const res = await api.get("/warehouses", {
        params: { page: 1, limit: 1000 },
      });
      setWarehouses(res.data?.data ?? res.data ?? []);
    } catch (err) {
      console.error("fetchWarehouses:", err);
      toast.error("Failed to load warehouses");
    } finally {
      setLoadingRefs(false);
    }
  }, []);

  /* -----------------------
     Fetch transfers (list)
     ----------------------- */
  const fetchTransfers = useCallback(
    async (p = 1) => {
      try {
        setLoading(true);

        const params: any = { page: p, limit };
        if (qRef.current?.trim()) params.q = qRef.current.trim();
        if (statusFilter) params.status = statusFilter;
        if (fromFilter) params.fromWarehouseId = fromFilter;
        if (toFilter) params.toWarehouseId = toFilter;
        if (dateFrom) params.dateFrom = dateFrom;
        if (dateTo) params.dateTo = dateTo;

        const res = await api.get("/transfers", { params });
        const data = res.data?.data ?? res.data ?? [];
        setTransfers(Array.isArray(data) ? data : []);
        setTotal(Number(res.data?.total ?? res.total ?? 0));
        setPage(p);
      } catch (err) {
        console.error("fetchTransfers:", err);
        toast.error("Failed to load transfers");
      } finally {
        setLoading(false);
      }
    },
    [limit, statusFilter, fromFilter, toFilter, dateFrom, dateTo],
  );

  /* -----------------------
     Initial load
     ----------------------- */
  useEffect(() => {
    fetchWarehouses();
    fetchTransfers(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -----------------------
     Debounce search + filters
     ----------------------- */
  useEffect(() => {
    setPage(1);
    if (searchTimer.current) {
      window.clearTimeout(searchTimer.current);
      searchTimer.current = null;
    }
    searchTimer.current = window.setTimeout(() => {
      qRef.current = q;
      fetchTransfers(1);
    }, 300);

    return () => {
      if (searchTimer.current) {
        window.clearTimeout(searchTimer.current);
        searchTimer.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, statusFilter, fromFilter, toFilter, dateFrom, dateTo, limit]);

  /* -----------------------
     Actions: receive / final-approve / cancel
     ----------------------- */
  async function doAction(
    transferId: string,
    action: "receive" | "final-approve" | "cancel",
    confirmMessage?: string,
  ) {
    if (confirmMessage) {
      if (!confirm(confirmMessage)) return;
    }
    const actionKey = `${transferId}-${action}`;
    try {
      setActionLoading(actionKey);
      const url =
        action === "receive"
          ? `/transfers/${transferId}/receive`
          : action === "final-approve"
            ? `/transfers/${transferId}/final-approve`
            : `/transfers/${transferId}/cancel`;

      await api.post(url);
      toast.success(`${action.replace("-", " ")} succeeded`);

      // refresh list and currently open details
      await fetchTransfers(page);
      if (selected && selected._id === transferId) {
        await openDetails(transferId);
      }
    } catch (err: any) {
      console.error("action error:", err);
      const msg =
        err?.response?.data?.message || err?.message || "Action failed";
      toast.error(msg);
    } finally {
      setActionLoading((cur) => (cur === actionKey ? null : cur));
    }
  }

  /* -----------------------
     Open drawer details + load product stocks
     ----------------------- */
  async function openDetails(id: string) {
    try {
      setDetailLoading(true);
      setSelected(null);
      setItemStockMap({});
      setDrawerOpen(true);

      const res = await api.get(`/transfers/${id}`);
      const transfer: Transfer = res.data?.data ?? res.data;
      setSelected(transfer);

      // product-stock lookup for fromWarehouse
      const fromWarehouseId =
        transfer?.fromWarehouseId &&
        typeof transfer.fromWarehouseId === "object"
          ? transfer.fromWarehouseId._id
          : (transfer?.fromWarehouseId as string | undefined);

      if (transfer?.items && fromWarehouseId) {
        const promises = transfer.items.map(async (it, ix) => {
          const pid =
            it.productId && typeof it.productId === "object"
              ? (it.productId as Product)._id
              : (it.productId as string | undefined);
          if (!pid) return { idx: ix, stock: null as ProductStock | null };
          try {
            const r = await api.get("/product-stocks", {
              params: {
                productId: pid,
                warehouseId: fromWarehouseId,
                page: 1,
                limit: 1,
              },
            });
            const stock = r.data?.data?.[0] ?? r.data?.[0] ?? null;
            return { idx: ix, stock };
          } catch {
            return { idx: ix, stock: null as ProductStock | null };
          }
        });

        const stocks = await Promise.all(promises);
        const map: Record<string, ProductStock | null> = {};
        for (const s of stocks) {
          map[`${id}-${s.idx}`] = s.stock;
        }
        setItemStockMap(map);
      }
    } catch (err) {
      console.error("openDetails error:", err);
      toast.error("Failed to load transfer details");
    } finally {
      setDetailLoading(false);
    }
  }

  /* -----------------------
     Pagination helper
     ----------------------- */
  function gotoPage(p: number) {
    if (p < 1 || p > totalPages) return;
    fetchTransfers(p);
  }

  /* -----------------------
     Derived stats for the sticky header
     ----------------------- */
  const stats = useMemo(() => {
    const totalAll = total;
    const pending = transfers.filter((t) => t.status === "CREATED").length;
    const received = transfers.filter(
      (t) => t.status === "RECEIVED_BY_WAREHOUSE",
    ).length;
    const approved = transfers.filter(
      (t) => t.status === "FINAL_APPROVED",
    ).length;
    return { totalAll, pending, received, approved };
  }, [transfers, total]);

  /* -----------------------
     Rows memo
     ----------------------- */
  const rowsContent = useMemo(() => {
    return transfers.map((t) => {
      const itemsCount = t.items?.length ?? 0;
      const firstItems = (t.items ?? [])
        .slice(0, 3)
        .map((it) => `${fmtProductLabel(it.productId)} × ${it.quantity ?? 0}`)
        .join(", ");
      return { t, itemsCount, firstItems };
    });
  }, [transfers]);

  /* -----------------------
     Keyboard shortcuts: "/" focus search, "n" new transfer
     ----------------------- */
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key.toLowerCase() === "n" && (e.metaKey || e.ctrlKey) === false) {
        // plain 'n' for new; avoid when typing in inputs
        const active = document.activeElement;
        if (
          active &&
          (active.tagName === "INPUT" || active.tagName === "TEXTAREA")
        )
          return;
        router.push("/sales/transfer/create");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ============================
     Rendering
     ============================ */
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* STICKY STATS HEADER */}
        <div className="sticky top-4 z-20">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">
                Warehouse Transfers
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Scan, act and finalize transfers quickly — keyboard shortcuts
                supported ("/" focus search, "n" new transfer).
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Card>
                <CardContent className="flex items-center gap-3 px-4 py-3">
                  <div className="rounded-md bg-slate-100 p-2">
                    <BarChart2 className="h-5 w-5 text-slate-700" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Total</div>
                    <div className="text-xl font-bold">{stats.totalAll}</div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex items-center gap-3 px-4 py-3">
                  <div className="rounded-md bg-yellow-100 p-2">
                    <Clock className="h-5 w-5 text-yellow-700" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Pending</div>
                    <div className="text-xl font-bold text-yellow-700">
                      {stats.pending}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex items-center gap-3 px-4 py-3">
                  <div className="rounded-md bg-blue-100 p-2">
                    <Truck className="h-5 w-5 text-blue-700" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Received
                    </div>
                    <div className="text-xl font-bold text-blue-700">
                      {stats.received}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex items-center gap-3 px-4 py-3">
                  <div className="rounded-md bg-green-100 p-2">
                    <PackageOpen className="h-5 w-5 text-green-700" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Approved
                    </div>
                    <div className="text-xl font-bold text-green-700">
                      {stats.approved}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* FILTERS / SEARCH */}
        <Card>
          <CardHeader>
            <CardTitle>Filters & search</CardTitle>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-8 gap-3 items-end">
              <div className="md:col-span-3 relative">
                <label className="sr-only">Search transfers</label>
                <div className="absolute left-3 top-3 text-slate-400 pointer-events-none">
                  <Search className="h-4 w-4" />
                </div>
                <Input
                  ref={searchInputRef}
                  className="pl-10"
                  placeholder="Search transferNo / product name / sku..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                <div className="text-xs text-muted-foreground mt-1">
                  Press{" "}
                  <kbd className="px-1 py-0.5 rounded bg-slate-100">/</kbd> to
                  focus
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Status</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All</option>
                  <option value="CREATED">Created</option>
                  <option value="RECEIVED_BY_WAREHOUSE">Received</option>
                  <option value="FINAL_APPROVED">Final Approved</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">From</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={fromFilter}
                  onChange={(e) => setFromFilter(e.target.value)}
                >
                  <option value="">All</option>
                  {warehouses.map((w) => (
                    <option key={w._id} value={w._id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">To</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={toFilter}
                  onChange={(e) => setToFilter(e.target.value)}
                >
                  <option value="">All</option>
                  {warehouses.map((w) => (
                    <option key={w._id} value={w._id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-1 flex gap-2">
                <Button
                  onClick={() => {
                    qRef.current = "";
                    setQ("");
                    setStatusFilter("");
                    setFromFilter("");
                    setToFilter("");
                    setDateFrom("");
                    setDateTo("");
                    setLimit(15);
                    fetchTransfers(1);
                  }}
                >
                  Reset
                </Button>

                <Button onClick={() => fetchTransfers(1)}>Apply</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* LIST CARDS (replaces table) */}
        <Card>
          <CardHeader>
            <CardTitle>Transfers</CardTitle>
          </CardHeader>

          <CardContent>
            {loading ? (
              // skeleton loader
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="animate-pulse bg-white p-4 rounded shadow-sm flex items-center gap-4"
                  >
                    <div className="w-12 h-12 bg-slate-200 rounded" />
                    <div className="flex-1">
                      <div className="h-4 bg-slate-200 rounded w-2/5" />
                      <div className="h-3 bg-slate-200 rounded w-1/3 mt-3" />
                    </div>
                    <div className="w-24 h-8 bg-slate-200 rounded" />
                  </div>
                ))}
              </div>
            ) : transfers.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <div className="text-lg font-medium">No transfers found</div>
                <div className="mt-2">
                  Adjust filters or create a new transfer.
                </div>
                <div className="mt-4">
                  <Button
                    onClick={() => router.push("/status/transfer/create")}
                  >
                    Create Transfer
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-3">
                  {rowsContent.map(({ t, itemsCount, firstItems }) => {
                    const isReceiving = actionLoading === `${t._id}-receive`;
                    const isApproving =
                      actionLoading === `${t._id}-final-approve`;
                    const isCancelling = actionLoading === `${t._id}-cancel`;

                    const progress =
                      t.status === "CREATED"
                        ? 30
                        : t.status === "RECEIVED_BY_WAREHOUSE"
                          ? 66
                          : t.status === "FINAL_APPROVED"
                            ? 100
                            : 0;

                    // warehouse avatar initials
                    const fromInitial =
                      typeof t.fromWarehouseId === "object"
                        ? ((t.fromWarehouseId as Warehouse).name ?? "")
                            .split(" ")
                            .map((s) => s[0])
                            .slice(0, 2)
                            .join("")
                        : "FW";
                    const toInitial =
                      typeof t.toWarehouseId === "object"
                        ? ((t.toWarehouseId as Warehouse).name ?? "")
                            .split(" ")
                            .map((s) => s[0])
                            .slice(0, 2)
                            .join("")
                        : "TW";

                    return (
                      <div
                        key={t._id}
                        className="bg-white p-4 rounded shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-3 hover:scale-[1.01] hover:shadow-md transition cursor-pointer"
                        role="button"
                        onClick={() => openDetails(t._id)}
                        aria-label={`Open details for ${t.transferNo ?? t._id}`}
                      >
                        <div className="flex items-center gap-4 md:flex-1">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-md bg-slate-50 flex items-center justify-center text-sm font-semibold text-slate-700">
                              {fromInitial}
                            </div>
                            <div className="text-sm">
                              <div className="flex items-center gap-2">
                                <div className="font-semibold">
                                  {t.transferNo ?? t._id}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  · {fmtUser(t.createdBy)}
                                </div>
                              </div>

                              <div className="text-sm text-muted-foreground mt-1">
                                <span className="font-medium">
                                  {fmtWarehouse(t.fromWarehouseId)}
                                </span>
                                <ArrowRight className="inline-block mx-2 text-slate-400" />
                                <span className="font-medium">
                                  {fmtWarehouse(t.toWarehouseId)}
                                </span>
                              </div>

                              <div className="mt-2 text-sm">
                                <span className="px-2 py-1 bg-slate-100 rounded text-xs mr-2">
                                  📦 {itemsCount}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {firstItems}
                                  {itemsCount > 3 ? ` +${itemsCount - 3}` : ""}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 md:items-end">
                          <div className="w-40 hidden md:block">
                            <div className="h-2 bg-slate-100 rounded overflow-hidden">
                              <div
                                className="h-2 bg-gradient-to-r from-blue-500 to-indigo-500 transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {formatStatus(t.status)}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDetails(t._id);
                              }}
                              title="View details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>

                            <Button
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                doAction(
                                  t._id,
                                  "receive",
                                  "Mark as received by destination warehouse?",
                                );
                              }}
                              disabled={
                                t.status !== "CREATED" || Boolean(actionLoading)
                              }
                              aria-disabled={
                                t.status !== "CREATED" || Boolean(actionLoading)
                              }
                              title="Receive"
                            >
                              {isReceiving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </Button>

                            <Button
                              variant="default"
                              onClick={(e) => {
                                e.stopPropagation();
                                doAction(
                                  t._id,
                                  "final-approve",
                                  "Final approve and move stock physically?",
                                );
                              }}
                              disabled={
                                t.status !== "RECEIVED_BY_WAREHOUSE" ||
                                Boolean(actionLoading)
                              }
                              className="hidden md:inline-flex"
                              title="Final Approve"
                            >
                              {isApproving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </Button>

                            <Button
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                doAction(
                                  t._id,
                                  "cancel",
                                  "Cancel this transfer? This will release reservations.",
                                );
                              }}
                              disabled={
                                t.status === "FINAL_APPROVED" ||
                                t.status === "CANCELLED" ||
                                Boolean(actionLoading)
                              }
                              title="Cancel"
                            >
                              {isCancelling ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-600" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* pagination */}
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing {(page - 1) * limit + 1} -{" "}
                    {Math.min(page * limit, total)} of {total}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => gotoPage(page - 1)}
                      disabled={page <= 1}
                    >
                      Prev
                    </Button>
                    <div className="px-3 py-1 border rounded">
                      {page} / {totalPages}
                    </div>
                    <Button
                      onClick={() => gotoPage(page + 1)}
                      disabled={page >= totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Floating CTA */}
      <Button
        className="fixed bottom-8 right-8 h-14 w-14 rounded-full shadow-lg flex items-center justify-center text-white bg-indigo-600 hover:bg-indigo-700"
        onClick={() => router.push("/sales/transfer/create")}
        aria-label="Create new transfer"
        title="Create new transfer (press 'n')"
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* RIGHT-SIDE DRAWER (Details) */}
      <div
        className={`fixed inset-y-0 right-0 z-50 transform transition-transform duration-300 ${drawerOpen ? "translate-x-0" : "translate-x-full"} w-full md:w-[540px]`}
        aria-hidden={!drawerOpen}
      >
        <div className="h-full bg-white shadow-xl overflow-auto">
          <div className="p-4 border-b flex items-start justify-between">
            <div>
              <div className="text-xs text-muted-foreground">
                Transfer Details
              </div>
              <div className="text-lg font-bold">
                {selected ? (selected.transferNo ?? selected._id) : "—"}
              </div>
              {selected && (
                <div className="text-sm text-muted-foreground mt-1">
                  <span className="font-medium">
                    {fmtWarehouse(selected.fromWarehouseId)}
                  </span>
                  <ArrowRight className="inline-block align-middle mx-2" />
                  <span className="font-medium">
                    {fmtWarehouse(selected.toWarehouseId)}
                  </span>
                  {selected.isVirtualTransfer && (
                    <span className="ml-3 inline-block px-2 py-1 text-xs bg-indigo-100 text-indigo-800 rounded">
                      Virtual
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col items-end">
              <div className="text-xs text-muted-foreground">Status</div>
              <div
                className={`inline-block px-2 py-1 rounded text-xs font-medium ${statusBadgeClass(selected?.status)}`}
              >
                {selected ? formatStatus(selected.status) : "-"}
              </div>
              <div className="mt-3">
                <Button
                  onClick={() => {
                    setDrawerOpen(false);
                    setSelected(null);
                  }}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* meta */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Created By</div>
                <div className="font-medium">
                  {selected ? fmtUser(selected.createdBy) : "-"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {selected ? fmtDateTime(selected.createdAt) : "-"}
                </div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground">Received By</div>
                <div className="font-medium">
                  {selected ? fmtUser(selected.receivedBy) : "-"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {selected ? fmtDateTime(selected.receivedAt) : "-"}
                </div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground">Approved By</div>
                <div className="font-medium">
                  {selected ? fmtUser(selected.approvedBy) : "-"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {selected ? fmtDateTime(selected.approvedAt) : "-"}
                </div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground">Notes</div>
                <div className="text-sm text-muted-foreground">
                  {selected?.notes ?? "—"}
                </div>
              </div>
            </div>

            {/* items / stock */}
            <div>
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Items</div>
                <div className="text-xs text-muted-foreground">
                  {selected?.items?.length ?? 0} items
                </div>
              </div>

              <div className="mt-2 border rounded overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-2 text-left">#</th>
                      <th className="p-2 text-left">Product</th>
                      <th className="p-2 text-center">SKU</th>
                      <th className="p-2 text-center">Qty</th>
                      <th className="p-2 text-center">Unit</th>
                      <th className="p-2 text-right">Cost</th>
                      <th className="p-2 text-right">Subtotal</th>
                      <th className="p-2 text-left">Stock (src)</th>
                    </tr>
                  </thead>

                  <tbody>
                    {detailLoading ? (
                      <tr>
                        <td colSpan={8} className="p-4 text-center">
                          <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                        </td>
                      </tr>
                    ) : selected?.items?.length ? (
                      selected.items.map((it, ix) => {
                        const product =
                          typeof it.productId === "object"
                            ? it.productId
                            : null;
                        const mapKey = `${selected._id}-${ix}`;
                        const sd = itemStockMap[mapKey] ?? null;
                        const available = sd ? calculateAvailable(sd) : null;
                        const subtotal =
                          (it.quantity ?? 0) * (it.costPrice ?? 0);
                        return (
                          <tr key={ix} className="border-t">
                            <td className="p-2">{ix + 1}</td>
                            <td className="p-2">
                              {product
                                ? product.name
                                : fmtProductLabel(it.productId)}
                            </td>
                            <td className="p-2 text-center">
                              {product?.sku ?? "-"}
                            </td>
                            <td className="p-2 text-center">
                              {it.quantity ?? 0}
                            </td>
                            <td className="p-2 text-center">
                              {it.unit ?? "-"}
                            </td>
                            <td className="p-2 text-right">
                              {Number(it.costPrice ?? 0).toLocaleString(
                                undefined,
                                { minimumFractionDigits: 2 },
                              )}
                            </td>
                            <td className="p-2 text-right">
                              {Number(subtotal).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                              })}
                            </td>
                            <td className="p-2">
                              {sd ? (
                                <>
                                  <div className="text-sm font-medium">
                                    Avail: {available}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    q:{sd.quantity ?? 0} • inc:
                                    {sd.incomingTransfer ?? 0} • resS:
                                    {sd.reservedForSales ?? 0} • resT:
                                    {sd.reservedForTransfer ?? 0}
                                  </div>
                                </>
                              ) : (
                                <div className="text-xs text-muted-foreground">
                                  stock not found
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td
                          colSpan={8}
                          className="p-4 text-center text-sm text-muted-foreground"
                        >
                          No items
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* timeline */}
            <div>
              <div className="text-sm font-medium mb-2">Workflow / Audit</div>
              <div className="space-y-4 text-sm">
                <div className="flex items-start gap-3">
                  <div className="text-xs mt-1">●</div>
                  <div>
                    <div className="text-xs text-muted-foreground">Created</div>
                    <div className="font-medium">
                      {selected ? fmtUser(selected.createdBy) : "-"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {selected ? fmtDateTime(selected.createdAt) : "-"}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="text-xs mt-1">●</div>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Received
                    </div>
                    <div className="font-medium">
                      {selected ? fmtUser(selected.receivedBy) : "-"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {selected ? fmtDateTime(selected.receivedAt) : "-"}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="text-xs mt-1">●</div>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Approved
                    </div>
                    <div className="font-medium">
                      {selected ? fmtUser(selected.approvedBy) : "-"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {selected ? fmtDateTime(selected.approvedAt) : "-"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* actions */}
            <div className="flex gap-2 mt-4">
              <Button
                onClick={() => {
                  setDrawerOpen(false);
                  setSelected(null);
                }}
              >
                Close
              </Button>

              <Button
                onClick={() =>
                  selected &&
                  doAction(
                    selected._id!,
                    "receive",
                    "Mark as received by destination warehouse?",
                  )
                }
                disabled={
                  !selected ||
                  selected.status !== "CREATED" ||
                  Boolean(actionLoading)
                }
              >
                Receive
              </Button>

              <Button
                onClick={() =>
                  selected &&
                  doAction(
                    selected._id!,
                    "final-approve",
                    "Final approve and move stock physically?",
                  )
                }
                disabled={
                  !selected ||
                  selected.status !== "RECEIVED_BY_WAREHOUSE" ||
                  Boolean(actionLoading)
                }
              >
                Final Approve
              </Button>

              <Button
                variant="destructive"
                onClick={() =>
                  selected &&
                  doAction(
                    selected._id!,
                    "cancel",
                    "Cancel this transfer? This will release reservations.",
                  )
                }
                disabled={
                  !selected ||
                  selected.status === "FINAL_APPROVED" ||
                  selected.status === "CANCELLED" ||
                  Boolean(actionLoading)
                }
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
