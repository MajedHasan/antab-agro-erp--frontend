"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRightLeft,
  Building2,
  Factory,
  Search,
  Eye,
  RefreshCw,
  Filter,
  FileCheck2,
  FileText,
  PackageSearch,
  Clock3,
  CircleAlert,
  CheckCircle2,
} from "lucide-react";

/* ---------- updated types ---------- */
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

type Transfer = {
  _id: string;
  transferNo: string;
  transferType: "WAREHOUSE_TO_WAREHOUSE" | "FACTORY_TO_WAREHOUSE";
  transferMode: "REQUEST" | "DIRECT";
  status:
    | "REQUESTED"
    | "RECEIVER_NSM_APPROVED"
    | "SENDER_REVIEWED"
    | "SENDER_NSM_APPROVED"
    | "SENT"
    | "HOLD"
    | "AWAITING_REMAINING"
    | "COMPLETED";
  sender?: Location | null;
  receiver?: Location | null;
  createdBy?: { name?: string; email?: string } | null;
  items?: Array<{
    productId?: any;
    requestedQty?: number;
    finalQty?: number;
    unit?: string;
    costPrice?: number;
  }>;
  printSnapshot?: any;
  documents?: {
    signed?: any;
    damage?: any;
  };
  createdAt?: string;
  updatedAt?: string;
};

/* ---------- updated status styles ---------- */
const STATUS_STYLES: Record<string, string> = {
  REQUESTED: "bg-slate-100 text-slate-800 border-slate-200",
  RECEIVER_NSM_APPROVED: "bg-sky-100 text-sky-800 border-sky-200",
  SENDER_REVIEWED: "bg-violet-100 text-violet-800 border-violet-200",
  SENDER_NSM_APPROVED: "bg-indigo-100 text-indigo-800 border-indigo-200",
  SENT: "bg-amber-100 text-amber-800 border-amber-200",
  HOLD: "bg-orange-100 text-orange-800 border-orange-200",
  AWAITING_REMAINING: "bg-purple-100 text-purple-800 border-purple-200",
  COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

/* ---------- helpers ---------- */
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

function transferTypeLabel(type: Transfer["transferType"]) {
  return type === "WAREHOUSE_TO_WAREHOUSE"
    ? "Warehouse → Warehouse"
    : "Factory → Warehouse";
}

function stepLabel(status: Transfer["status"]) {
  const map: Record<string, string> = {
    REQUESTED: "Requested",
    RECEIVER_NSM_APPROVED: "Receiver NSM approved",
    SENDER_REVIEWED: "Sender reviewed",
    SENDER_NSM_APPROVED: "Sender NSM approved",
    SENT: "Sent",
    HOLD: "On hold",
    AWAITING_REMAINING: "Awaiting remaining",
    COMPLETED: "Completed",
  };
  return map[status] || status;
}

function stepHint(t: Transfer) {
  if (t.transferType === "WAREHOUSE_TO_WAREHOUSE") {
    const map: Record<string, string> = {
      REQUESTED: "Waiting for receiver NSM approval",
      RECEIVER_NSM_APPROVED: "Waiting for sender review",
      SENDER_REVIEWED: "Waiting for sender NSM final approval",
      SENDER_NSM_APPROVED: "Ready for print and send",
      SENT: "Waiting for receiver to receive",
      HOLD: "Received quantities don't match – on hold",
      AWAITING_REMAINING: "Received qty processed, awaiting resolution",
      COMPLETED: "Transfer completed",
    };
    return map[t.status] || "In workflow";
  }

  const map: Record<string, string> = {
    REQUESTED: "Waiting for receiver NSM approval",
    RECEIVER_NSM_APPROVED: "Waiting for factory dispatch",
    SENT: "Waiting for receiver to receive",
    HOLD: "Received quantities don't match – on hold",
    AWAITING_REMAINING: "Received qty processed, awaiting resolution",
    COMPLETED: "Transfer completed",
  };
  return map[t.status] || "In workflow";
}

function documentState(t: Transfer) {
  const hasSnapshot = Boolean(t.printSnapshot);
  const hasSigned = Boolean(t.documents?.signed?.mediaId);
  const hasDamage = Boolean(t.documents?.damage?.mediaId);

  if (hasSnapshot && hasSigned) return "Snapshot + Signed";
  if (hasSnapshot) return "Snapshot ready";
  if (hasSigned) return "Signed uploaded";
  if (hasDamage) return "Damage reported";
  return "No docs";
}

function documentTone(t: Transfer) {
  const hasSnapshot = Boolean(t.printSnapshot);
  const hasSigned = Boolean(t.documents?.signed?.mediaId);

  if (hasSnapshot && hasSigned) {
    return "bg-emerald-100 text-emerald-800 border-emerald-200";
  }
  if (hasSnapshot || hasSigned) {
    return "bg-amber-100 text-amber-800 border-amber-200";
  }
  return "bg-slate-100 text-slate-800 border-slate-200";
}

function isActiveStatus(status: Transfer["status"]) {
  return [
    "REQUESTED",
    "RECEIVER_NSM_APPROVED",
    "SENDER_REVIEWED",
    "SENDER_NSM_APPROVED",
    "SENT",
    "HOLD",
    "AWAITING_REMAINING",
  ].includes(status);
}

export default function WarehouseTransferListPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const [transferType, setTransferType] = useState<string>("ALL");
  const [transferMode, setTransferMode] = useState<string>("ALL");
  const [sender, setSender] = useState<string>("ALL");
  const [receiver, setReceiver] = useState<string>("ALL");

  const [tab, setTab] = useState<"ALL" | "INCOMING" | "OUTGOING" | "MINE">(
    "ALL",
  );

  const currentWarehouseId = "";

  useEffect(() => {
    loadLocations();
  }, []);

  useEffect(() => {
    loadTransfers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, q, status, transferType, transferMode, sender, receiver, tab]);

  useEffect(() => {
    setPage(1);
  }, [q, status, transferType, transferMode, sender, receiver, tab]);

  async function loadLocations() {
    try {
      const res = await api.get("/warehouses-or-factories", {
        params: { page: 1, limit: 2000 },
      });
      setLocations(res.data?.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load locations");
    }
  }

  async function loadTransfers() {
    try {
      setLoading(true);

      const params: Record<string, any> = {
        page,
        limit,
      };

      if (q.trim()) params.q = q.trim();
      if (status !== "ALL") params.status = status;
      if (transferType !== "ALL") params.transferType = transferType;
      if (transferMode !== "ALL") params.transferMode = transferMode;
      if (sender !== "ALL") params.sender = sender;
      if (receiver !== "ALL") params.receiver = receiver;

      if (tab === "INCOMING" && currentWarehouseId) {
        params.receiver = currentWarehouseId;
      }

      if (tab === "OUTGOING" && currentWarehouseId) {
        params.sender = currentWarehouseId;
      }

      const res = await api.get("/transfers", { params });
      setTransfers(res.data?.data || []);
      setTotal(res.data?.total || 0);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load transfers");
    } finally {
      setLoading(false);
    }
  }

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / limit)),
    [total, limit],
  );

  const summary = useMemo(() => {
    const totalItems = transfers.length;
    const pending = transfers.filter((t) => isActiveStatus(t.status)).length;
    const completed = transfers.filter((t) => t.status === "COMPLETED").length;
    const needAttention = transfers.filter((t) =>
      isActiveStatus(t.status),
    ).length;

    return { totalItems, pending, completed, needAttention };
  }, [transfers]);

  function openTransfer(id: string) {
    router.push(`/sales/transfer/${id}`);
  }

  function resetFilters() {
    setQ("");
    setStatus("ALL");
    setTransferType("ALL");
    setTransferMode("ALL");
    setSender("ALL");
    setReceiver("ALL");
    setTab("ALL");
    setPage(1);
  }

  function paginatePrev() {
    setPage((p) => Math.max(1, p - 1));
  }

  function paginateNext() {
    setPage((p) => Math.min(totalPages, p + 1));
  }

  function itemPreview(t: Transfer) {
    const items = t.items || [];
    const preview = items
      .slice(0, 2)
      .map((i) => i?.productId?.name || i?.productId?.sku || "Item")
      .filter(Boolean);

    if (!preview.length) return "No items";
    if (items.length <= 2) return preview.join(", ");
    return `${preview.join(", ")} + ${items.length - 2} more`;
  }

  function qtyTotal(t: Transfer) {
    return (t.items || []).reduce(
      (sum, item) => sum + Number(item.finalQty || item.requestedQty || 0),
      0,
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6 space-y-6">
        {/* header */}
        <div className="rounded-3xl border bg-gradient-to-br from-slate-900 via-slate-900 to-slate-700 p-6 text-white shadow-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <ArrowRightLeft className="h-4 w-4" />
                <span>Transfer Center</span>
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">
                Warehouse transfer requests
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                This page gives you a clean view of all transfer requests. Open
                any row to continue approvals, dispatch, or receiving on the
                detail page.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={loadTransfers}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
              <Button
                onClick={() => router.push("/sales/transfer/create")}
                className="bg-white text-slate-900 hover:bg-slate-100"
              >
                + Create Transfer
              </Button>
            </div>
          </div>
        </div>

        {/* stats */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-2xl bg-slate-900 p-3 text-white">
                <PackageSearch className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">
                  Shown on page
                </div>
                <div className="text-2xl font-bold">{summary.totalItems}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-2xl bg-amber-100 p-3 text-amber-800">
                <Clock3 className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">
                  Pending workflow
                </div>
                <div className="text-2xl font-bold">{summary.pending}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-800">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Completed</div>
                <div className="text-2xl font-bold">{summary.completed}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-2xl bg-red-100 p-3 text-red-700">
                <CircleAlert className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">
                  Need attention
                </div>
                <div className="text-2xl font-bold">
                  {summary.needAttention}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* filter panel */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="flex flex-wrap gap-2">
              {[
                ["ALL", "All"],
                ["INCOMING", "Incoming"],
                ["OUTGOING", "Outgoing"],
                ["MINE", "My Requests"],
              ].map(([key, label]) => (
                <Button
                  key={key}
                  variant={tab === key ? "default" : "outline"}
                  onClick={() => setTab(key as any)}
                >
                  {label}
                </Button>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <div className="xl:col-span-2">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Search transfer no
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Search by transfer number..."
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Status
                </label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All</SelectItem>
                    <SelectItem value="REQUESTED">Requested</SelectItem>
                    <SelectItem value="RECEIVER_NSM_APPROVED">
                      Receiver NSM Approved
                    </SelectItem>
                    <SelectItem value="SENDER_REVIEWED">
                      Sender Reviewed
                    </SelectItem>
                    <SelectItem value="SENDER_NSM_APPROVED">
                      Sender NSM Approved
                    </SelectItem>
                    <SelectItem value="SENT">Sent</SelectItem>
                    <SelectItem value="HOLD">Hold</SelectItem>
                    <SelectItem value="AWAITING_REMAINING">
                      Awaiting Remaining
                    </SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Transfer type
                </label>
                <Select value={transferType} onValueChange={setTransferType}>
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All</SelectItem>
                    <SelectItem value="WAREHOUSE_TO_WAREHOUSE">
                      Warehouse → Warehouse
                    </SelectItem>
                    <SelectItem value="FACTORY_TO_WAREHOUSE">
                      Factory → Warehouse
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Mode
                </label>
                <Select value={transferMode} onValueChange={setTransferMode}>
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All</SelectItem>
                    <SelectItem value="REQUEST">Request</SelectItem>
                    <SelectItem value="DIRECT">Direct</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Sender
                </label>
                <Select value={sender} onValueChange={setSender}>
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All</SelectItem>
                    {locations.map((loc) => (
                      <SelectItem key={loc._id} value={loc._id}>
                        {locationLabel(loc)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Receiver
                </label>
                <Select value={receiver} onValueChange={setReceiver}>
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All</SelectItem>
                    {locations.map((loc) => (
                      <SelectItem key={loc._id} value={loc._id}>
                        {locationLabel(loc)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                Use the filters to narrow down requests. The action page will
                handle approvals, printing, dispatch, and receiving.
              </div>
              <Button variant="outline" onClick={resetFilters}>
                Reset filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* table */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Transfer list</CardTitle>
            <div className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </div>
          </CardHeader>

          <CardContent>
            <div className="overflow-hidden rounded-2xl border bg-white">
              <div className="max-h-[68vh] overflow-auto">
                <table className="min-w-full table-auto">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-left text-sm shadow-sm">
                    <tr>
                      <th className="px-4 py-3">Transfer</th>
                      <th className="px-4 py-3">Route</th>
                      <th className="px-4 py-3">Workflow</th>
                      <th className="px-4 py-3">Items</th>
                      <th className="px-4 py-3">Docs</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Updated</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {loading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-4 py-4" colSpan={8}>
                            <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
                          </td>
                        </tr>
                      ))
                    ) : transfers.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-16">
                          <div className="mx-auto max-w-md text-center">
                            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                              <ArrowRightLeft className="h-6 w-6 text-slate-500" />
                            </div>
                            <h3 className="text-lg font-semibold">
                              No transfers found
                            </h3>
                            <p className="mt-2 text-sm text-muted-foreground">
                              No records match your current filters.
                            </p>
                            <div className="mt-5 flex justify-center gap-2">
                              <Button variant="outline" onClick={resetFilters}>
                                Clear filters
                              </Button>
                              <Button
                                onClick={() =>
                                  router.push("/sales/transfer/create")
                                }
                              >
                                Create transfer
                              </Button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      transfers.map((t) => (
                        <tr
                          key={t._id}
                          className="border-t align-top transition hover:bg-slate-50"
                        >
                          <td className="px-4 py-4">
                            <div className="space-y-1">
                              <div className="font-semibold text-slate-900">
                                {t.transferNo}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {transferTypeLabel(t.transferType)} •{" "}
                                {t.transferMode}
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">
                                  {locationLabel(t.sender)}
                                </span>
                                <span className="rounded-full border bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                                  {locationKind(t.sender)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Factory className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">
                                  {locationLabel(t.receiver)}
                                </span>
                                <span className="rounded-full border bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                                  {locationKind(t.receiver)}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="space-y-2">
                              <div className="text-sm font-medium">
                                {stepLabel(t.status)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {stepHint(t)}
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="space-y-2">
                              <div className="font-medium">
                                {t.items?.length || 0} lines
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {qtyTotal(t)} total qty
                              </div>
                              <div className="max-w-xs text-xs text-slate-600">
                                {itemPreview(t)}
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="space-y-2">
                              <Badge
                                variant="outline"
                                className={documentTone(t)}
                              >
                                {documentState(t)}
                              </Badge>
                              <div className="flex flex-wrap gap-1">
                                {t.printSnapshot ? (
                                  <Badge
                                    variant="outline"
                                    className="bg-blue-50 text-blue-700 border-blue-200"
                                  >
                                    <FileText className="mr-1 h-3 w-3" />
                                    Snapshot
                                  </Badge>
                                ) : null}
                                {t.documents?.signed?.mediaId ? (
                                  <Badge
                                    variant="outline"
                                    className="bg-emerald-50 text-emerald-700 border-emerald-200"
                                  >
                                    <FileCheck2 className="mr-1 h-3 w-3" />
                                    Signed
                                  </Badge>
                                ) : null}
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <Badge
                              variant="outline"
                              className={
                                STATUS_STYLES[t.status] || STATUS_STYLES.REQUESTED
                              }
                            >
                              {stepLabel(t.status)}
                            </Badge>
                          </td>

                          <td className="px-4 py-4">
                            <div className="space-y-1 text-sm">
                              <div className="font-medium">
                                {t.updatedAt
                                  ? new Date(t.updatedAt).toLocaleDateString()
                                  : "-"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {t.updatedAt
                                  ? new Date(t.updatedAt).toLocaleTimeString()
                                  : ""}
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-4 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openTransfer(t._id)}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                Total records:{" "}
                <strong className="text-slate-900">{total}</strong>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  disabled={page <= 1 || loading}
                  onClick={paginatePrev}
                >
                  Prev
                </Button>
                <div className="min-w-20 text-center text-sm">
                  {page} / {totalPages}
                </div>
                <Button
                  variant="outline"
                  disabled={page >= totalPages || loading}
                  onClick={paginateNext}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}