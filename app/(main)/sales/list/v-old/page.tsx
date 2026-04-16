// src/app/sales-orders/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import api from "@/lib/api";
import { toast } from "sonner";

/* shadcn UI components — adjust import paths if needed in your repo */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

/* ---------------- Types ---------------- */
type ApprovalLog = {
  role: string;
  status: "APPROVED" | "REJECTED" | "PENDING" | string;
  remarks?: string;
  actionDate?: string;
  userId?: any;
  userName?: string;
};

type SalesOrder = {
  _id: string;
  orderNo?: string;
  invoiceNo?: string;
  customerId?: any;
  warehouseId?: any;
  orderDate?: string;
  status?: string;
  subTotal?: number;
  totalTax?: number;
  grandTotal?: number;
  approvalLogs?: ApprovalLog[];
  items?: any[];
  createdBy?: any;
  updatedBy?: any;
};

/* ---------------- Approval chain ----------------
   If you later want dynamic chain, fetch from backend.
*/
const APPROVAL_CHAIN = [
  "M.O",
  "A.M",
  "R.M",
  "N.S.M",
  "A.C",
  "WAREHOUSE",
  "DELIVERY",
];

/* ---------------- Helpers ---------------- */
const fmtCurrency = (n?: number) =>
  (n ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

const shortId = (s?: string) => (s ? String(s).slice(0, 8) : "—");

function hasRejected(logs?: ApprovalLog[]) {
  return (logs ?? []).some((l) => l.status === "REJECTED");
}

function lastApprovedIndex(logs?: ApprovalLog[]) {
  const logsArr = logs ?? [];
  for (let i = APPROVAL_CHAIN.length - 1; i >= 0; i--) {
    const role = APPROVAL_CHAIN[i];
    if (logsArr.find((l) => l.role === role && l.status === "APPROVED"))
      return i;
  }
  return -1;
}

function getNextRole(logs?: ApprovalLog[]) {
  if (hasRejected(logs)) return null;
  const idx = lastApprovedIndex(logs) + 1;
  return idx < APPROVAL_CHAIN.length ? APPROVAL_CHAIN[idx] : null;
}

function roleHasLog(logs?: ApprovalLog[], role?: string) {
  if (!logs || !role) return null;
  return logs.find((l) => l.role === role) ?? null;
}

function safeName(v: any) {
  if (!v) return "—";
  if (typeof v === "string") return v;
  if (v.name) return v.name;
  if (v.proprietor) return v.proprietor;
  if (v.phoneNumber) return `${v.name ?? shortId(v._id)} • ${v.phoneNumber}`;
  if (v._id) return String(v._id).slice(-6);
  return "—";
}

/* Client-only date formatter (avoids SSR mismatches) */
function useClientDateFormatter() {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(true), []);
  const format = (d?: string | Date) => {
    if (!d) return "—";
    if (!isClient) return String(d).slice(0, 19).replace("T", " ");
    try {
      return new Date(d).toLocaleString();
    } catch {
      return String(d);
    }
  };
  return { format, isClient };
}

/* ---------------- Page Component ---------------- */
export default function SalesOrdersPage() {
  const { format } = useClientDateFormatter();

  /* user from redux (AppInitializer fetches /auth/me) */
  const currentUser = useSelector((s: RootState) => s.user.currentUser);

  // normalize roleName + isSystem
  const roleName =
    currentUser && currentUser.role
      ? typeof currentUser.role === "string"
        ? (currentUser.role as string)
        : ((currentUser.role as any).name ?? (currentUser.role as any).code)
      : null;
  const isSystemUser =
    !!currentUser &&
    typeof currentUser.role === "object" &&
    !!(currentUser.role as any).isSystem;

  /* table & filters */
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const qTimer = useRef<number | null>(null);

  /* lookups */
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [dealers, setDealers] = useState<any[]>([]);
  const [dealerQuery, setDealerQuery] = useState("");
  const [selectedDealerId, setSelectedDealerId] = useState("ALL");

  /* selection + undo */
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const undoRef = useRef<{ timer?: number; backup?: SalesOrder[] }>({});

  /* preview + timeline */
  const [preview, setPreview] = useState<SalesOrder | null>(null);
  const [timeline, setTimeline] = useState<ApprovalLog[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  /* action states */
  const [actionLoadingFor, setActionLoadingFor] = useState<string | null>(null);
  const [approveConfirm, setApproveConfirm] = useState<{
    id: string;
    role: string;
  } | null>(null);
  const [rejectConfirm, setRejectConfirm] = useState<{
    id: string;
    role?: string;
    remarks?: string;
  } | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  /* ---------------- Fetch lookups once ---------------- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [wRes, dRes] = await Promise.all([
          api
            .get("/warehouses?type=Warehouse", {
              params: { page: 1, limit: 1000 },
            })
            .catch(() => ({ data: { data: [] } })),
          api
            .get("/dealers", { params: { page: 1, limit: 1000 } })
            .catch(() => ({ data: { data: [] } })),
        ]);
        if (!mounted) return;
        const wRows = Array.isArray(wRes.data?.data)
          ? wRes.data.data
          : Array.isArray(wRes.data)
            ? wRes.data
            : [];
        const dRows = Array.isArray(dRes.data?.data)
          ? dRes.data.data
          : Array.isArray(dRes.data)
            ? dRes.data
            : [];
        setWarehouses(wRows);
        setDealers(dRows);
      } catch (err) {
        // ignore
      }
    })();
    return () => (mounted = false);
  }, []);

  /* ---------------- Fetch orders ---------------- */
  async function fetchOrders(fetchPage = page, fetchLimit = limit) {
    setLoading(true);
    try {
      const params: any = { page: fetchPage, limit: fetchLimit };
      if (q?.trim()) params.q = q.trim();
      if (warehouseFilter && warehouseFilter !== "ALL")
        params.warehouseId = warehouseFilter;
      if (statusFilter && statusFilter !== "ALL") params.status = statusFilter;
      if (selectedDealerId && selectedDealerId !== "ALL")
        params.customerId = selectedDealerId;

      const res = await api.get("/sales-orders", { params });
      const payload = res.data ?? res;

      // normalize data shape
      const rowsSrc =
        Array.isArray(payload.data) && Array.isArray(payload.data)
          ? payload.data
          : Array.isArray(payload)
            ? payload
            : (payload.data?.data ??
              payload.data ??
              payload.rows ??
              payload.items ??
              []);

      const metaTotal =
        payload.data?.total ??
        payload.total ??
        payload.totalRows ??
        payload.count ??
        rowsSrc.length;

      const normalized = (rowsSrc || []).map((r: any) => ({
        _id: r._id ?? r.id,
        orderNo: r.orderNo ?? r.order_no ?? r.invoiceNo ?? r.invoice,
        invoiceNo: r.invoiceNo ?? r.invoice ?? r.orderNo,
        customerId: r.customerId ?? r.customer ?? r.dealer,
        warehouseId: r.warehouseId ?? r.warehouse,
        orderDate: r.orderDate ?? r.invoiceDate ?? r.createdAt,
        status: r.status,
        subTotal: r.subTotal ?? r.sub_total,
        totalTax: r.totalTax ?? r.total_tax,
        grandTotal: r.grandTotal ?? r.grand_total ?? r.total,
        approvalLogs:
          r.approvalLogs ?? r.approval_logs ?? r.approval_history ?? [],
        items: r.items ?? r.orderItems ?? [],
        createdBy: r.createdBy,
        updatedBy: r.updatedBy,
      })) as SalesOrder[];

      setOrders(normalized);
      setTotal(Number(metaTotal ?? normalized.length));
      setPage(Number(fetchPage));
      setLimit(Number(fetchLimit));
    } catch (err: any) {
      console.error("fetchOrders error", err);
      toast.error(err?.response?.data?.message ?? "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOrders(1, limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, selectedDealerId]);

  /* debounce search */
  useEffect(() => {
    if (qTimer.current) window.clearTimeout(qTimer.current);
    qTimer.current = window.setTimeout(() => {
      setPage(1);
      fetchOrders(1, limit);
    }, 350) as unknown as number;
    return () => {
      if (qTimer.current) window.clearTimeout(qTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  /* dealer quick search */
  useEffect(() => {
    if (!dealerQuery) {
      setSelectedDealerId("ALL");
      return;
    }
    const t = setTimeout(() => {
      const ql = dealerQuery.toLowerCase();
      const found = dealers.find(
        (d: any) =>
          (d.name ?? "").toLowerCase().includes(ql) ||
          (d.phoneNumber ?? "").toLowerCase().includes(ql) ||
          String(d.code ?? "")
            .toLowerCase()
            .includes(ql),
      );
      if (found) setSelectedDealerId(found._id ?? found.id ?? "ALL");
    }, 300);
    return () => clearTimeout(t);
  }, [dealerQuery, dealers]);

  /* ---------------- Preview & timeline ---------------- */
  async function openPreview(order: SalesOrder) {
    setPreview(order);
    setTimelineLoading(true);
    setTimeline(order.approvalLogs ?? []);
    try {
      const res = await api.get(`/sales-orders/${order._id}`);
      const payload = res.data?.data ?? res.data ?? res;
      const logs: ApprovalLog[] =
        payload.approvalLogs ??
        payload.approval_logs ??
        payload.approval_history ??
        order.approvalLogs ??
        [];
      setTimeline(logs);
    } catch (err) {
      console.error("openPreview", err);
      toast.error("Failed to load order details");
    } finally {
      setTimelineLoading(false);
    }
  }
  function closePreview() {
    setPreview(null);
    setTimeline([]);
  }

  /* ---------------- Permission check (hierarchical + system override) ---------------- */
  function canUserApprove(
    order: SalesOrder | null | undefined,
    userRole?: string | null,
    isSystem?: boolean,
  ) {
    if (!order || !userRole) return false;

    const logs = order.approvalLogs ?? [];

    // If already rejected → block unless system
    if (logs.some((l) => l.status === "REJECTED")) {
      return !!isSystem;
    }

    // System admin bypass
    if (isSystem) return true;

    // Prevent double approval from same role
    if (logs.some((l) => l.role === userRole && l.status === "APPROVED")) {
      return false;
    }

    const nextRole = getNextRole(logs);

    return nextRole === userRole;
  }

  /* ---------------- Approve / Reject ---------------- */
  async function doApprove(orderId: string, role: string) {
    if (!role) return toast.error("Role required");
    if (!confirm(`Approve this order as ${role}?`)) return;
    setActionLoadingFor(orderId);
    try {
      if (role === "WAREHOUSE") {
        await api.post(`/sales-orders/${orderId}/ship`, { role });
      } else if (role === "DELIVERY") {
        await api.post(`/sales-orders/${orderId}/deliver`, { role });
      } else {
        await api.post(`/sales-orders/${orderId}/approve`, { role });
      }

      // await api.post(`/sales-orders/${orderId}/approve`, { role });

      // optimistic update: push approval log
      setOrders((prev) =>
        prev.map((o) =>
          o._id === orderId
            ? {
                ...o,
                approvalLogs: [
                  ...(o.approvalLogs ?? []),
                  {
                    role,
                    status: "APPROVED",
                    actionDate: new Date().toISOString(),
                    userId: currentUser?.id,
                    userName: currentUser?.name,
                  },
                ],
              }
            : o,
        ),
      );

      toast.success("Approved");
      if (preview?._id === orderId) await openPreview(preview);
      await fetchOrders(page, limit);
    } catch (err: any) {
      console.error("approve error", err);
      toast.error(err?.response?.data?.message ?? "Approve failed");
    } finally {
      setActionLoadingFor(null);
      setApproveConfirm(null);
    }
  }

  async function doReject(orderId: string, role?: string, remarks?: string) {
    if (!confirm("Are you sure you want to reject this order?")) return;
    setActionLoadingFor(orderId);
    try {
      // Try dedicated endpoint first (if backend supports it)
      try {
        await api.post(`/sales-orders/${orderId}/reject`, { role, remarks });
      } catch {
        // fallback: use update with $push and set status
        await api.put(`/sales-orders/${orderId}`, {
          status: "REJECTED",
          $push: {
            approvalLogs: {
              role: role ?? "N/A",
              status: "REJECTED",
              remarks: remarks ?? "",
              actionDate: new Date().toISOString(),
            },
          },
        });
      }

      // optimistic update
      setOrders((prev) =>
        prev.map((o) =>
          o._id === orderId
            ? {
                ...o,
                status: "REJECTED",
                approvalLogs: [
                  ...(o.approvalLogs ?? []),
                  {
                    role: role ?? "N/A",
                    status: "REJECTED",
                    remarks,
                    actionDate: new Date().toISOString(),
                    userId: currentUser?.id,
                    userName: currentUser?.name,
                  },
                ],
              }
            : o,
        ),
      );

      toast.success("Rejected");
      if (preview?._id === orderId) await openPreview(preview);
      await fetchOrders(page, limit);
    } catch (err: any) {
      console.error("reject", err);
      toast.error(err?.response?.data?.message ?? "Reject failed");
    } finally {
      setActionLoadingFor(null);
      setRejectConfirm(null);
    }
  }

  /* ---------------- Delete with undo ---------------- */
  async function deleteOrder(orderId: string) {
    if (!confirm("Delete this order? You will have 8s to undo.")) return;
    const backup = orders.slice();
    setOrders((s) => s.filter((o) => o._id !== orderId));
    if (undoRef.current.timer) window.clearTimeout(undoRef.current.timer);
    undoRef.current.backup = backup;
    undoRef.current.timer = window.setTimeout(
      () => (undoRef.current = {}),
      8000,
    );
    try {
      await api.delete(`/sales-orders/${orderId}`);
      toast.success("Deleted");
      await fetchOrders(page, limit);
    } catch (err) {
      console.error("delete", err);
      toast.error("Delete failed, restoring");
      if (undoRef.current.backup) setOrders(undoRef.current.backup);
      undoRef.current = {};
    }
  }
  function undo() {
    if (undoRef.current.backup) {
      setOrders(undoRef.current.backup);
      undoRef.current = {};
      toast.success("Undo successful");
    } else {
      toast.error("Nothing to undo");
    }
  }

  /* ---------------- Bulk delete ---------------- */
  async function bulkDeleteSelected() {
    const ids = Object.keys(selected).filter((k) => selected[k]);
    if (!ids.length) return toast.error("No orders selected");
    if (!confirm(`Delete ${ids.length} selected orders?`)) return;
    const backup = orders.slice();
    setOrders((s) => s.filter((o) => !ids.includes(o._id)));
    setSelected({});
    if (undoRef.current.timer) window.clearTimeout(undoRef.current.timer);
    undoRef.current.backup = backup;
    undoRef.current.timer = window.setTimeout(
      () => (undoRef.current = {}),
      8000,
    );
    try {
      await Promise.all(
        ids.map((id) => api.delete(`/sales-orders/${id}`).catch(() => null)),
      );
      toast.success("Deleted selected");
      await fetchOrders(page, limit);
    } catch (err) {
      console.error("bulk delete", err);
      toast.error("Bulk delete error; restoring");
      setOrders(backup);
    }
  }

  const toggleSelect = (id: string) =>
    setSelected((s) => ({ ...s, [id]: !s[id] }));

  /* ---------------- Render ---------------- */
  return (
    <div className="min-h-screen p-6 bg-slate-50">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Sales Orders</h1>
            <p className="text-sm text-slate-500">
              Hierarchical approvals • Activity timeline • Audit-friendly
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={() => fetchOrders(1, limit)}>Refresh</Button>
            <Button variant="ghost" onClick={() => undo()}>
              Undo
            </Button>
          </div>
        </div>

        {/* filters */}
        <div className="bg-white p-4 rounded shadow">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-4">
              <Label>Search (invoice / order)</Label>
              <Input
                placeholder="Search..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            <div className="md:col-span-3">
              <Label>Dealer quick search</Label>
              <Input
                placeholder="Type dealer name or phone"
                value={dealerQuery}
                onChange={(e) => setDealerQuery(e.target.value)}
              />
              <div className="text-xs text-slate-400 mt-1">
                {selectedDealerId !== "ALL"
                  ? `Filter: ${shortId(selectedDealerId)}`
                  : "No dealer selected"}
              </div>
            </div>

            <div className="md:col-span-2">
              <Label>Warehouse</Label>
              <Select
                value={warehouseFilter}
                onValueChange={(v) => {
                  setWarehouseFilter(v);
                  setPage(1);
                  fetchOrders(1, limit);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All warehouses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All warehouses</SelectItem>
                  {warehouses.map((w) => (
                    <SelectItem
                      key={w._id ?? w.id ?? w.name}
                      value={w._id ?? w.id ?? String(w.name)}
                    >
                      {w.name ?? shortId(w._id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <Label>Status</Label>
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v);
                  setPage(1);
                  fetchOrders(1, limit);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Any</SelectItem>
                  <SelectItem value="PENDING">PENDING</SelectItem>
                  <SelectItem value="A.M_CONFIRMED">A.M_CONFIRMED</SelectItem>
                  <SelectItem value="R.M_CONFIRMED">R.M_CONFIRMED</SelectItem>
                  <SelectItem value="IN_SHIPPING">IN_SHIPPING</SelectItem>
                  <SelectItem value="DELIVERED">DELIVERED</SelectItem>
                  <SelectItem value="REJECTED">REJECTED</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-3 flex items-end gap-2">
              <Button
                onClick={() => {
                  setQ("");
                  setDealerQuery("");
                  setSelectedDealerId("ALL");
                  setWarehouseFilter("ALL");
                  setStatusFilter("ALL");
                  fetchOrders(1, limit);
                }}
              >
                Clear
              </Button>
              <Button
                onClick={() => {
                  setPage(1);
                  fetchOrders(1, limit);
                }}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>

        {/* actions */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4"
              onChange={(e) => {
                if (e.target.checked) {
                  const all: Record<string, boolean> = {};
                  orders.forEach((o) => (all[o._id] = true));
                  setSelected(all);
                } else setSelected({});
              }}
            />
            <div className="text-sm text-slate-600">Select page</div>
            <Button variant="destructive" onClick={bulkDeleteSelected}>
              Delete Selected
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                // quick export CSV
                const rows = orders.map((r) => ({
                  order: r.orderNo ?? r.invoiceNo ?? shortId(r._id),
                  customer: safeName(r.customerId),
                  warehouse: safeName(r.warehouseId),
                  date: r.orderDate ?? "",
                  status: r.status ?? "",
                  total: r.grandTotal ?? 0,
                }));
                if (!rows.length) return toast.error("No rows");
                const header = Object.keys(rows[0]).join(",");
                const csv = [
                  header,
                  ...rows.map((row) =>
                    Object.values(row)
                      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
                      .join(","),
                  ),
                ].join("\n");
                const blob = new Blob([csv], {
                  type: "text/csv;charset=utf-8;",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `sales-orders.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Export CSV
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-sm text-slate-600">Rows</div>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
                fetchOrders(1, Number(e.target.value));
              }}
              className="border rounded px-2 py-1"
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        {/* table */}
        <div className="bg-white rounded shadow overflow-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left w-10">
                  <input type="checkbox" />
                </th>
                <th className="px-4 py-3 text-left">Order / Invoice</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Warehouse</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-left">Approval</th>
                <th className="px-4 py-3 text-center w-56">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading &&
                Array.from({ length: limit }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="p-4">
                      <div className="h-4 w-4 bg-slate-200 rounded" />
                    </td>
                    <td className="p-4">
                      <div className="h-4 w-44 bg-slate-200 rounded" />
                    </td>
                    <td className="p-4">
                      <div className="h-4 w-36 bg-slate-200 rounded" />
                    </td>
                    <td className="p-4">
                      <div className="h-4 w-28 bg-slate-200 rounded" />
                    </td>
                    <td className="p-4">
                      <div className="h-4 w-20 bg-slate-200 rounded" />
                    </td>
                    <td className="p-4">
                      <div className="h-4 w-20 bg-slate-200 rounded" />
                    </td>
                    <td className="p-4 text-right">
                      <div className="h-4 w-24 bg-slate-200 rounded ml-auto" />
                    </td>
                    <td className="p-4">
                      <div className="h-4 w-32 bg-slate-200 rounded" />
                    </td>
                    <td className="p-4 text-center">
                      <div className="h-6 w-20 bg-slate-200 rounded mx-auto" />
                    </td>
                  </tr>
                ))}

              {!loading && orders.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-slate-500">
                    No orders found
                  </td>
                </tr>
              )}

              {!loading &&
                orders.map((o) => {
                  const logs = o?.approvalLogs ?? [];
                  const nextRole = getNextRole(logs);
                  const rejected = hasRejected(logs);
                  const canAct = canUserApprove(
                    o,
                    roleName ?? undefined,
                    isSystemUser,
                  );
                  const lastLog = logs[logs.length - 1];
                  return (
                    <tr key={o._id} className="border-t hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={!!selected[o._id]}
                          onChange={() => toggleSelect(o._id)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold">
                          {o.orderNo ?? o.invoiceNo ?? shortId(o._id)}
                        </div>
                        <div className="text-xs text-slate-500">
                          {o.invoiceNo ? `Invoice: ${o.invoiceNo}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3">{safeName(o.customerId)}</td>
                      <td className="px-4 py-3">{safeName(o.warehouseId)}</td>
                      <td className="px-4 py-3">{format(o.orderDate)}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            o.status === "REJECTED"
                              ? "destructive"
                              : o.status?.includes("CONFIRMED") ||
                                  o.status === "DELIVERED"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {o.status ?? "—"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {fmtCurrency(o.grandTotal)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2 h-2 rounded-full ${rejected ? "bg-rose-600" : lastLog?.status === "APPROVED" ? "bg-emerald-600" : "bg-yellow-400"}`}
                          />
                          <div className="text-xs text-slate-600">
                            {rejected
                              ? `Rejected • ${lastLog?.role}`
                              : nextRole
                                ? `Waiting: ${nextRole}`
                                : "Completed"}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <div className="flex gap-2 justify-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openPreview(o)}
                          >
                            View
                          </Button>

                          <Button
                            size="sm"
                            onClick={() =>
                              setApproveConfirm({
                                id: o._id,
                                role: roleName ?? nextRole ?? "",
                              })
                            }
                            disabled={!canAct || !!actionLoadingFor}
                          >
                            {actionLoadingFor === o._id ? "..." : "Approve"}
                          </Button>

                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              setRejectConfirm({
                                id: o._id,
                                role: roleName ?? nextRole ?? "",
                                remarks: "",
                              })
                            }
                            disabled={rejected || !!actionLoadingFor}
                          >
                            Reject
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteOrder(o._id)}
                          >
                            Delete
                          </Button>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          {o.approvalLogs?.length ?? 0} activities
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>

          {/* footer */}
          <div className="flex items-center justify-between p-3 bg-slate-50">
            <div className="text-sm text-slate-600">
              Showing <strong>{Math.min((page - 1) * limit + 1, total)}</strong>{" "}
              to <strong>{Math.min(page * limit, total)}</strong> of{" "}
              <strong>{total}</strong>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => {
                  if (page > 1) {
                    setPage(page - 1);
                    fetchOrders(page - 1, limit);
                  }
                }}
                disabled={page === 1}
              >
                Prev
              </Button>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={page}
                  onChange={(e) => {
                    const v = Math.max(
                      1,
                      Math.min(totalPages, Number(e.target.value) || 1),
                    );
                    setPage(v);
                    fetchOrders(v, limit);
                  }}
                  className="w-16 text-center border rounded px-2 py-1"
                />
                <div>/ {totalPages}</div>
              </div>

              <Button
                size="sm"
                onClick={() => {
                  if (page < totalPages) {
                    setPage(page + 1);
                    fetchOrders(page + 1, limit);
                  }
                }}
                disabled={page === totalPages}
              >
                Next
              </Button>

              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                  fetchOrders(1, Number(e.target.value));
                }}
                className="border rounded px-2 py-1"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </div>

        {/* Preview dialog */}
        <Dialog
          open={!!preview}
          onOpenChange={(open) => {
            if (!open) closePreview();
          }}
        >
          <DialogContent className="!max-w-[95vw] !h-[95vh] mx-auto">
            <DialogHeader>
              <DialogTitle>
                {preview
                  ? `Order ${preview.orderNo ?? preview.invoiceNo ?? shortId(preview._id)}`
                  : "Order"}
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 h-full overflow-y-scroll">
              <div className="md:col-span-2 space-y-3">
                <div>
                  <div className="text-xs text-slate-500">Customer</div>
                  <div className="font-medium">
                    {safeName(preview?.customerId)}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500">Warehouse</div>
                  <div className="font-medium">
                    {safeName(preview?.warehouseId)}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500">Order Date</div>
                  <div className="font-medium">
                    {format(preview?.orderDate)}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500">Items</div>
                  <div className="mt-2 border rounded">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="p-2 text-left">Product</th>
                          <th className="p-2 text-right">Qty</th>
                          <th className="p-2 text-right">Price</th>
                          <th className="p-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(preview?.items ?? []).map((it: any, i: number) => (
                          <tr key={i} className="border-t">
                            <td className="p-2">{it.productId?.name}</td>
                            <td className="p-2 text-right">
                              {it.qty ?? it.quantity ?? 0}
                            </td>
                            <td className="p-2 text-right">
                              {fmtCurrency(it.unitPrice ?? it.price ?? 0)}
                            </td>
                            <td className="p-2 text-right">
                              {fmtCurrency(
                                (it.qty ?? 0) * (it.unitPrice ?? it.price ?? 0),
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="border rounded p-3 bg-slate-50">
                  <div className="text-xs text-slate-500">Totals</div>
                  <div className="text-lg font-semibold mt-2">
                    {fmtCurrency(preview?.grandTotal)}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Sub: {fmtCurrency(preview?.subTotal)} • Tax:{" "}
                    {fmtCurrency(preview?.totalTax)}
                  </div>
                </div>

                <div className="border rounded p-3">
                  <div className="text-sm font-medium mb-2">Approval Chain</div>
                  <div className="space-y-2 max-h-56 overflow-auto">
                    {APPROVAL_CHAIN.map((role) => {
                      const log = roleHasLog(timeline, role);
                      const approved = !!log && log.status === "APPROVED";
                      const rejected = !!log && log.status === "REJECTED";
                      const blocked = timeline.some(
                        (l) =>
                          l.status === "REJECTED" &&
                          APPROVAL_CHAIN.indexOf(l.role) <
                            APPROVAL_CHAIN.indexOf(role),
                      );
                      const nextRole = getNextRole(timeline);
                      const userCanAct =
                        canUserApprove(
                          preview as SalesOrder,
                          roleName ?? undefined,
                          isSystemUser,
                        ) &&
                        (roleName === role || isSystemUser);
                      return (
                        <div
                          key={role}
                          className={`flex items-center justify-between p-2 rounded ${approved ? "bg-emerald-50 border border-emerald-200" : rejected ? "bg-rose-50 border border-rose-200" : blocked ? "bg-slate-50 border border-slate-100" : "bg-white border border-slate-100"}`}
                        >
                          <div>
                            <div className="font-medium">{role}</div>
                            <div className="text-xs text-slate-500">
                              {approved &&
                                `Approved • ${format(log?.actionDate)}`}
                              {rejected &&
                                `Rejected • ${format(log?.actionDate)}`}
                              {!approved &&
                                !rejected &&
                                (blocked
                                  ? "Locked"
                                  : nextRole === role
                                    ? "Waiting to act"
                                    : "Pending")}
                            </div>
                          </div>

                          <div className="flex gap-2">
                            {approved ? (
                              <div className="text-emerald-700">✓</div>
                            ) : rejected ? (
                              <div className="text-rose-700">✕</div>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    setApproveConfirm({
                                      id: preview!._id,
                                      role,
                                    })
                                  }
                                  disabled={!userCanAct || !!actionLoadingFor}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() =>
                                    setRejectConfirm({
                                      id: preview!._id,
                                      role,
                                      remarks: "",
                                    })
                                  }
                                  disabled={blocked || !!actionLoadingFor}
                                >
                                  Reject
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="border rounded p-3">
                  <div className="text-sm font-medium mb-2">
                    Activity Timeline
                  </div>
                  {timelineLoading && (
                    <div className="text-sm text-slate-500">Loading…</div>
                  )}
                  {!timelineLoading && timeline.length === 0 && (
                    <div className="text-sm text-slate-500">
                      No activity yet
                    </div>
                  )}
                  {!timelineLoading &&
                    timeline.map((t, i) => (
                      <div key={i} className="py-2 border-b last:border-b-0">
                        <div className="flex justify-between">
                          <div className="font-medium">
                            {t.role}{" "}
                            <span className="text-xs text-slate-400">
                              (
                              {t.userName ??
                                (typeof t.userId === "string"
                                  ? shortId(t.userId)
                                  : (t.userId?.name ?? shortId(t.userId?._id)))}
                              )
                            </span>
                          </div>
                          <div className="text-xs text-slate-400">
                            {format(t.actionDate)}
                          </div>
                        </div>
                        {t.remarks && (
                          <div className="text-sm text-slate-700 mt-1">
                            {t.remarks}
                          </div>
                        )}
                        <div className="text-xs text-slate-400 mt-1">
                          {t.status}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <div className="flex justify-end gap-2 pt-2">
                <Button onClick={() => closePreview()}>Close</Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Approve Confirm */}
        {approveConfirm && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 p-4 overflow-hidden pointer-events-auto">
            <div className="bg-white rounded shadow max-w-md w-full p-4">
              <h3 className="text-lg font-semibold">Confirm Approve</h3>
              <p className="text-sm text-slate-600 mt-2">
                Approve as <strong>{approveConfirm.role}</strong>?
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setApproveConfirm(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() =>
                    doApprove(approveConfirm.id, approveConfirm.role)
                  }
                >
                  {actionLoadingFor === approveConfirm.id
                    ? "Processing..."
                    : "Confirm"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Reject Confirm */}
        {rejectConfirm && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded shadow max-w-md w-full p-4">
              <h3 className="text-lg font-semibold">Confirm Reject</h3>
              <p className="text-sm text-slate-600 mt-2">
                Reject as <strong>{rejectConfirm.role}</strong>?
              </p>

              <div className="mt-3">
                <Label>Remarks (optional)</Label>
                <Textarea
                  value={rejectConfirm.remarks}
                  onChange={(e) =>
                    setRejectConfirm({
                      ...rejectConfirm,
                      remarks: e.target.value,
                    })
                  }
                />
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setRejectConfirm(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() =>
                    doReject(
                      rejectConfirm.id,
                      rejectConfirm.role,
                      rejectConfirm.remarks,
                    )
                  }
                >
                  {actionLoadingFor === rejectConfirm.id
                    ? "Processing..."
                    : "Reject"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
