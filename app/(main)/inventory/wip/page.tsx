"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select"; // optional; fallback uses native select below
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  RefreshCcw,
  CheckCircle,
  Truck,
  Eye,
  XCircle,
  Download,
} from "lucide-react";

/**
 * PRODUCTION WIP PAGE (Advanced)
 *
 * Backend endpoints expected:
 *  GET  /api/production/wip
 *    params:
 *      page, limit, sortBy, sortDir, search, status, factoryId, productId, from, to
 *    returns: { data: [wip...], total, page, limit }
 *
 *  GET  /api/production/wip/:id
 *    returns single wip with populated productId & factoryId and components
 *
 *  POST /api/production/complete   { wipId, quantity }
 *  POST /api/production/transfer   { wipId, warehouseId, quantity }
 *  POST /api/production/close      { wipId }
 *
 *  GET  /api/products
 *  GET  /api/warehouses?type=Factory
 *  GET  /api/warehouses?type=Warehouse
 *
 * Notes:
 *  - This page uses server-side pagination and sorting. If your backend does not support
 *    those params, adapt loadWips() accordingly.
 *  - The list API should return productId and factoryId populated (or use aggregation
 *    that $lookup products/factories).
 */

/* -------------------- Types -------------------- */
type WIP = {
  _id: string;
  productId: any;
  factoryId: any;
  plannedQuantity: number;
  finishedProduced: number;
  transferredToWarehouse: number;
  status: "IN_PROGRESS" | "COMPLETED";
  createdAt?: string;
  startedAt?: string;
  components?: Array<{
    itemType: "RawMaterial" | "PackagingItem";
    itemId: any;
    quantityPerUnit: number;
    totalConsumedQuantity: number;
    unit?: string;
  }>;
};

type Product = { _id: string; name: string; sku?: string };
type Warehouse = { _id: string; name: string; code?: string };
type Factory = Warehouse;

/* -------------------- Helpers -------------------- */
const safeNum = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function formatDate(d?: string | Date) {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return String(d);
  }
}

function csvEscape(s: any) {
  if (s === null || s === undefined) return "";
  return `"${String(s).replace(/"/g, '""')}"`;
}

/* -------------------- Component -------------------- */
export default function WipAdvancedPage() {
  /* refs / lists */
  const [factories, setFactories] = useState<Factory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  /* parameters & server-side paging */
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  /* filters */
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [factoryId, setFactoryId] = useState("");
  const [productId, setProductId] = useState("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  /* data */
  const [wips, setWips] = useState<WIP[]>([]);
  const [loading, setLoading] = useState(false);

  /* selection / bulk */
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const selectedCount = Object.values(selectedIds).filter(Boolean).length;

  /* UI states */
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailWip, setDetailWip] = useState<WIP | null>(null);

  const [completeModal, setCompleteModal] = useState<{
    wip: WIP;
    qty: number;
  } | null>(null);
  const [transferModal, setTransferModal] = useState<{
    wip: WIP;
    qty: number;
    warehouseId?: string;
  } | null>(null);
  const [polling, setPolling] = useState(false);

  /* init ref lists */
  useEffect(() => {
    (async () => {
      try {
        const [fRes, pRes, wRes] = await Promise.all([
          api.get("/warehouses", {
            params: { type: "Factory", page: 1, limit: 1000 },
          }),
          api.get("/products", { params: { page: 1, limit: 1000 } }),
          api.get("/warehouses", {
            params: { type: "Warehouse", page: 1, limit: 1000 },
          }),
        ]);
        setFactories(fRes.data?.data || []);
        setProducts(pRes.data?.data || []);
        setWarehouses(wRes.data?.data || []);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load reference data");
      }
    })();
  }, []);

  /* debounce search */
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 450);
    return () => clearTimeout(t);
  }, [search]);

  /* load WIPs (server-side paging + filters) */
  const loadWips = useCallback(
    async (opts: { resetPage?: boolean } = {}) => {
      if (opts.resetPage) setPage(1);
      setLoading(true);
      try {
        const params: any = {
          page: opts.resetPage ? 1 : page,
          limit,
          sortBy,
          sortDir,
          search: debouncedSearch || undefined,
          status: status || undefined,
          factoryId: factoryId || undefined,
          productId: productId || undefined,
          from: dateFrom || undefined,
          to: dateTo || undefined,
        };
        const res = await api.get("/productions/wip", { params });
        // expect { data, total, page, limit }
        const data = res.data?.data || [];
        setWips(data);
        setTotal(res.data?.total ?? data.length ?? 0);
        setPage(res.data?.page ?? page);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load WIP list");
      } finally {
        setLoading(false);
      }
    },
    [
      page,
      limit,
      sortBy,
      sortDir,
      debouncedSearch,
      status,
      factoryId,
      productId,
      dateFrom,
      dateTo,
    ],
  );

  useEffect(() => {
    loadWips({ resetPage: true });
  }, [
    debouncedSearch,
    status,
    factoryId,
    productId,
    dateFrom,
    dateTo,
    limit,
    sortBy,
    sortDir,
  ]);

  /* polling for near-realtime (optional) */
  useEffect(() => {
    if (!polling) return;
    const id = setInterval(() => loadWips(), 8000);
    return () => clearInterval(id);
  }, [polling, loadWips]);

  /* helper calculations */
  const remainingQty = (w: WIP) =>
    Math.max(0, safeNum(w.plannedQuantity) - safeNum(w.finishedProduced));
  const inFactoryQty = (w: WIP) =>
    Math.max(
      0,
      safeNum(w.finishedProduced) - safeNum(w.transferredToWarehouse),
    );
  const progressPct = (w: WIP) => {
    const p = safeNum(w.plannedQuantity);
    if (!p) return 0;
    return Math.round((safeNum(w.finishedProduced) / p) * 100);
  };

  /* select / bulk toggles */
  function toggleSelect(id: string) {
    setSelectedIds((s) => ({ ...s, [id]: !s[id] }));
  }
  function clearSelection() {
    setSelectedIds({});
  }
  function toggleSelectAllOnPage() {
    const allIds = wips.map((w) => w._id);
    const allSelected = allIds.every((id) => selectedIds[id]);
    if (allSelected) {
      // unselect all of this page
      setSelectedIds((s) => {
        const copy = { ...s };
        for (const id of allIds) delete copy[id];
        return copy;
      });
    } else {
      setSelectedIds((s) => {
        const copy = { ...s };
        for (const id of allIds) copy[id] = true;
        return copy;
      });
    }
  }

  /* expand row & load details if needed */
  async function openDetail(w: WIP) {
    setExpandedId((cur) => (cur === w._id ? null : w._id));
    try {
      // If components absent, fetch detail
      if (!w.components) {
        const res = await api.get(`/productions/wip/${w._id}`);
        const detail = res.data?.data;
        setDetailWip(detail || null);
      } else {
        setDetailWip(w);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load WIP detail");
    }
  }

  /* ---------------- ACTIONS ---------------- */

  async function startCompleteModal(w: WIP) {
    setCompleteModal({ wip: w, qty: 0 });
  }

  async function confirmComplete() {
    if (!completeModal) return;
    const { wip, qty } = completeModal;
    if (!qty || qty <= 0) return toast.error("Enter a positive quantity");
    const remaining = remainingQty(wip);
    if (qty > remaining)
      return toast.error(`Cannot complete more than remaining (${remaining})`);
    try {
      await api.post("/productions/complete", {
        wipId: wip._id,
        quantity: qty,
      });
      toast.success("Production updated");
      setCompleteModal(null);
      await loadWips();
    } catch (err: any) {
      console.error(err);
      toast.error(
        err?.response?.data?.message || "Failed to update production",
      );
    }
  }

  async function startTransferModal(w: WIP) {
    setTransferModal({ wip: w, qty: 0, warehouseId: undefined });
  }

  async function confirmTransfer() {
    if (!transferModal) return;
    const { wip, qty, warehouseId } = transferModal;
    if (!warehouseId) return toast.error("Select destination warehouse");
    if (!qty || qty <= 0) return toast.error("Enter a positive quantity");
    const available = inFactoryQty(wip);
    if (qty > available)
      return toast.error(`Not enough finished units available (${available})`);
    try {
      await api.post("/productions/transfer", {
        wipId: wip._id,
        warehouseId,
        quantity: qty,
      });
      toast.success("Transferred to warehouse");
      setTransferModal(null);
      await loadWips();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Transfer failed");
    }
  }

  async function confirmForceClose(w: WIP) {
    if (
      !confirm(
        "Force close this WIP? This will mark it completed (no further production).",
      )
    )
      return;
    try {
      await api.post("/productions/close", { wipId: w._id });
      toast.success("WIP closed");
      await loadWips();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to close WIP");
    }
  }

  /* Bulk transfer / close (basic examples) */
  async function bulkTransferSelected(
    warehouseId: string,
    quantityPerWip?: number,
  ) {
    const ids = Object.keys(selectedIds).filter((id) => selectedIds[id]);
    if (!ids.length) return toast.error("Select WIP(s) first");
    if (!warehouseId) return toast.error("Select destination warehouse");
    if (!confirm(`Transfer selected ${ids.length} WIP(s)?`)) return;

    try {
      // naive: transfer up to available for each selected WIP
      for (const id of ids) {
        const w = wips.find((x) => x._id === id);
        if (!w) continue;
        const avail = inFactoryQty(w);
        const qty = quantityPerWip ? Math.min(quantityPerWip, avail) : avail;
        if (qty <= 0) continue;
        await api.post("/productions/transfer", {
          wipId: id,
          warehouseId,
          quantity: qty,
        });
      }
      toast.success("Bulk transfer submitted");
      clearSelection();
      await loadWips();
    } catch (err: any) {
      console.error(err);
      toast.error("Bulk transfer had errors");
    }
  }

  async function bulkCloseSelected() {
    const ids = Object.keys(selectedIds).filter((id) => selectedIds[id]);
    if (!ids.length) return toast.error("Select WIP(s) first");
    if (!confirm(`Force-close ${ids.length} WIP(s)?`)) return;
    try {
      for (const id of ids) {
        await api.post("/productions/close", { wipId: id });
      }
      toast.success("Bulk close done");
      clearSelection();
      await loadWips();
    } catch (err: any) {
      console.error(err);
      toast.error("Bulk close had errors");
    }
  }

  /* CSV export of current rows */
  function exportCsvVisible() {
    if (!wips.length) return toast.error("No rows to export");
    const headers = [
      "wip_id",
      "product",
      "product_sku",
      "factory",
      "planned_qty",
      "finished",
      "remaining",
      "in_factory",
      "transferred",
      "status",
      "started_at",
      "created_at",
    ];
    const rows = wips.map((w) => [
      csvEscape(w._id),
      csvEscape(w.productId?.name ?? ""),
      csvEscape(w.productId?.sku ?? ""),
      csvEscape(w.factoryId?.name ?? ""),
      csvEscape(w.plannedQuantity),
      csvEscape(w.finishedProduced),
      csvEscape(remainingQty(w)),
      csvEscape(inFactoryQty(w)),
      csvEscape(w.transferredToWarehouse ?? 0),
      csvEscape(w.status),
      csvEscape(w.startedAt ?? ""),
      csvEscape(w.createdAt ?? ""),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wip_export_${new Date().toISOString()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /* UI: pagination helpers */
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="p-6 space-y-6">
      {/* header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">Production — Work In Progress</h1>
          <p className="text-sm text-muted-foreground">
            Manage WIP runs, partial completion, transfers and closure. Uses
            server-side pagination, sorting and filtering.
          </p>
          <div className="mt-2 text-sm">
            <span className="font-medium">{total}</span> WIP(s)
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setSearch("");
              setStatus("");
              setFactoryId("");
              setProductId("");
              setDateFrom("");
              setDateTo("");
              setPage(1);
            }}
          >
            Reset filters
          </Button>

          <Button
            onClick={() => loadWips({ resetPage: true })}
            variant="outline"
          >
            <RefreshCcw className="w-4 h-4 mr-1" />
            Refresh
          </Button>

          <Button onClick={exportCsvVisible} variant="ghost">
            <Download className="w-4 h-4 mr-1" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* filters */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
        <Input
          placeholder="Search product / sku"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="border rounded px-2 py-1"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
        >
          <option value="">All products</option>
          {products.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
              {p.sku ? ` (${p.sku})` : ""}
            </option>
          ))}
        </select>
        <select
          className="border rounded px-2 py-1"
          value={factoryId}
          onChange={(e) => setFactoryId(e.target.value)}
        >
          <option value="">All factories</option>
          {factories.map((f) => (
            <option key={f._id} value={f._id}>
              {f.name}
              {f.code ? ` (${f.code})` : ""}
            </option>
          ))}
        </select>
        <select
          className="border rounded px-2 py-1"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All status</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
        </select>

        <div className="flex gap-2">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>

        <div className="flex gap-2 items-center">
          <label className="text-sm">Polling</label>
          <input
            type="checkbox"
            checked={polling}
            onChange={(e) => setPolling(e.target.checked)}
          />
        </div>
      </div>

      {/* bulk actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={selectedCount > 0}
            onCheckedChange={toggleSelectAllOnPage as any}
          />
          <div className="text-sm">{selectedCount} selected</div>

          <select
            id="bulkWarehouse"
            className="border rounded px-2 py-1"
            defaultValue=""
          >
            <option value="">Select warehouse for bulk transfer</option>
            {warehouses.map((w) => (
              <option key={w._id} value={w._id}>
                {w.name}
                {w.code ? ` (${w.code})` : ""}
              </option>
            ))}
          </select>

          <Button
            onClick={() => {
              const ele = document.getElementById(
                "bulkWarehouse",
              ) as HTMLSelectElement;
              const wid = ele?.value;
              bulkTransferSelected(wid || "");
            }}
            disabled={selectedCount === 0}
          >
            Bulk Transfer Selected
          </Button>

          <Button
            onClick={bulkCloseSelected}
            disabled={selectedCount === 0}
            variant="destructive"
          >
            Bulk Close Selected
          </Button>
        </div>

        {/* pagination controls top */}
        <div className="flex items-center gap-2">
          <div className="text-sm">Page</div>
          <Input
            type="number"
            value={page}
            onChange={(e) => setPage(Math.max(1, Number(e.target.value || 1)))}
          />
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="border rounded px-2 py-1"
          >
            {[10, 15, 25, 50].map((n) => (
              <option key={n} value={n}>
                {n}/page
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* table */}
      <div className="bg-card border rounded overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Checkbox
                  checked={
                    wips.every((w) => selectedIds[w._id]) && wips.length > 0
                  }
                  onCheckedChange={toggleSelectAllOnPage as any}
                />
              </TableHead>
              <TableHead>WIP</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Factory</TableHead>
              <TableHead>Planned</TableHead>
              <TableHead>Produced</TableHead>
              <TableHead>Remaining</TableHead>
              <TableHead>In factory</TableHead>
              <TableHead>Transferred</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8">
                  <Loader2 className="animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            )}

            {!loading && wips.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={11}
                  className="text-center py-8 text-muted-foreground"
                >
                  No WIP found
                </TableCell>
              </TableRow>
            )}

            {!loading &&
              wips.map((w) => {
                const rem = remainingQty(w);
                const inFactory = inFactoryQty(w);
                const pct = progressPct(w);
                const isSelected = Boolean(selectedIds[w._id]);

                return (
                  <React.Fragment key={w._id}>
                    <TableRow>
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(w._id)}
                        />
                      </TableCell>

                      <TableCell>
                        <div className="text-xs text-muted-foreground">
                          {w._id}
                        </div>
                        <div className="text-sm">
                          {formatDate(w.startedAt ?? w.createdAt)}
                        </div>
                      </TableCell>

                      <TableCell className="font-medium">
                        {w.productId?.name
                          ? w.productId?.name
                          : w.product?.name
                            ? w.product?.name
                            : "-"}
                      </TableCell>
                      <TableCell>
                        {w.factoryId?.name
                          ? w.factoryId?.name
                          : w.factory?.name
                            ? w.factory?.name
                            : "-"}
                      </TableCell>
                      <TableCell>{w.plannedQuantity}</TableCell>
                      <TableCell>{w.finishedProduced}</TableCell>
                      <TableCell>{rem}</TableCell>
                      <TableCell>{inFactory}</TableCell>
                      <TableCell>{w.transferredToWarehouse ?? 0}</TableCell>

                      <TableCell>
                        <Badge
                          variant={
                            w.status === "COMPLETED" ? "default" : "secondary"
                          }
                        >
                          {w.status}
                        </Badge>
                        <div className="text-xs mt-1">{pct}%</div>
                      </TableCell>

                      <TableCell className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openDetail(w)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>

                        {w.status !== "COMPLETED" && (
                          <Button
                            size="sm"
                            onClick={() => startCompleteModal(w)}
                          >
                            <CheckCircle className="w-4 h-4" /> Complete
                          </Button>
                        )}

                        <Button size="sm" onClick={() => startTransferModal(w)}>
                          <Truck className="w-4 h-4" /> Transfer
                        </Button>

                        {w.status !== "COMPLETED" && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => confirmForceClose(w)}
                          >
                            <XCircle className="w-4 h-4" /> Close
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>

                    {/* expanded detail row */}
                    {expandedId === w._id &&
                      detailWip &&
                      detailWip._id === w._id && (
                        <TableRow>
                          <TableCell colSpan={11} className="bg-gray-50 p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <div className="text-sm text-muted-foreground">
                                  Planned
                                </div>
                                <div className="text-lg font-medium">
                                  {detailWip.plannedQuantity}
                                </div>

                                <div className="text-sm text-muted-foreground mt-2">
                                  Produced
                                </div>
                                <div className="text-lg font-medium">
                                  {detailWip.finishedProduced}
                                </div>

                                <div className="text-sm text-muted-foreground mt-2">
                                  Remaining
                                </div>
                                <div className="text-lg font-medium">
                                  {remainingQty(detailWip)}
                                </div>

                                <div className="text-sm text-muted-foreground mt-2">
                                  In factory (untransferred)
                                </div>
                                <div className="text-lg font-medium">
                                  {inFactoryQty(detailWip)}
                                </div>
                              </div>

                              <div>
                                <h4 className="font-semibold">
                                  Components snapshot
                                </h4>
                                <div className="mt-2 overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="text-left text-xs text-muted-foreground">
                                        <th>#</th>
                                        <th>Type</th>
                                        <th>Item</th>
                                        <th>Qty / unit</th>
                                        <th>Total deducted</th>
                                        <th>Still in WIP</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(detailWip.components || []).map(
                                        (c, i) => {
                                          const still =
                                            (c.quantityPerUnit || 0) *
                                            remainingQty(detailWip);
                                          return (
                                            <tr key={i} className="border-t">
                                              <td className="py-2">{i + 1}</td>
                                              <td>{c.itemType}</td>
                                              <td>
                                                {c.itemId?.name ??
                                                  c.itemId ??
                                                  "-"}
                                              </td>
                                              <td>
                                                {Number(
                                                  c.quantityPerUnit ?? 0,
                                                ).toFixed(6)}{" "}
                                                {c.unit ?? ""}
                                              </td>
                                              <td>
                                                {Number(
                                                  c.totalConsumedQuantity ?? 0,
                                                ).toFixed(6)}{" "}
                                                {c.unit ?? ""}
                                              </td>
                                              <td className="font-medium">
                                                {Number(still).toFixed(6)}{" "}
                                                {c.unit ?? ""}
                                              </td>
                                            </tr>
                                          );
                                        },
                                      )}
                                      {(detailWip.components || []).length ===
                                        0 && (
                                        <tr>
                                          <td
                                            colSpan={6}
                                            className="py-2 text-muted-foreground"
                                          >
                                            No component snapshot available
                                          </td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                  </React.Fragment>
                );
              })}
          </TableBody>
        </Table>
      </div>

      {/* pagination footer */}
      <div className="flex items-center justify-between">
        <div className="text-sm">
          Page {page} / {totalPages} — {total} results
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => setPage(1)} disabled={page === 1}>
            First
          </Button>
          <Button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Prev
          </Button>
          <Input
            type="number"
            className="w-16 text-center"
            value={page}
            onChange={(e) => setPage(Math.max(1, Number(e.target.value || 1)))}
          />
          <Button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
          <Button
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages}
          >
            Last
          </Button>
        </div>
      </div>

      {/* --------------- modals (simple overlays) --------------- */}

      {/* complete modal */}
      {completeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setCompleteModal(null)}
          />
          <div className="bg-white rounded shadow-lg max-w-md w-full z-10 p-6">
            <h3 className="text-lg font-semibold">
              Complete Production — {completeModal.wip._id}
            </h3>
            <p className="text-sm text-muted-foreground">
              Remaining: {remainingQty(completeModal.wip)} units
            </p>
            <div className="mt-4">
              <Input
                type="number"
                value={completeModal.qty || ""}
                onChange={(e) =>
                  setCompleteModal({
                    ...completeModal,
                    qty: Number(e.target.value),
                  })
                }
                placeholder="Quantity produced now"
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCompleteModal(null)}>
                Cancel
              </Button>
              <Button onClick={confirmComplete}>Save</Button>
            </div>
          </div>
        </div>
      )}

      {/* transfer modal */}
      {transferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setTransferModal(null)}
          />
          <div className="bg-white rounded shadow-lg max-w-md w-full z-10 p-6">
            <h3 className="text-lg font-semibold">
              Transfer to Warehouse — {transferModal.wip._id}
            </h3>
            <p className="text-sm text-muted-foreground">
              Available in factory: {inFactoryQty(transferModal.wip)} units
            </p>

            <div className="mt-4 grid gap-2">
              <select
                value={transferModal.warehouseId || ""}
                onChange={(e) =>
                  setTransferModal({
                    ...transferModal,
                    warehouseId: e.target.value,
                  })
                }
                className="border rounded px-2 py-1"
              >
                <option value="">Select destination warehouse</option>
                {warehouses.map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.name}
                    {w.code ? ` (${w.code})` : ""}
                  </option>
                ))}
              </select>

              <Input
                type="number"
                value={transferModal.qty || ""}
                onChange={(e) =>
                  setTransferModal({
                    ...transferModal,
                    qty: Number(e.target.value),
                  })
                }
                placeholder="Quantity to transfer"
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setTransferModal(null)}>
                Cancel
              </Button>
              <Button onClick={confirmTransfer}>Transfer</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
