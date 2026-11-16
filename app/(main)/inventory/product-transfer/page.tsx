"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";

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
  Factory,
  Building2,
  ArrowRightLeft,
  Search,
  Eye,
  RefreshCw,
  Filter,
  FileText,
  FileCheck2,
  Clock3,
  CheckCircle2,
  Inbox,
  Plus,
  ChevronLeft,
  ChevronRight,
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
  items?: any[];
  printSnapshot?: any;
  documents?: {
    signed?: any;
    damage?: any;
  };
  createdAt?: string;
  updatedAt?: string;
};

/* =========================== Config =========================== */
const STATUS_STYLES: Record<string, string> = {
  REQUESTED:
    "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
  RECEIVER_NSM_APPROVED:
    "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900/60",
  SENDER_REVIEWED:
    "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900/60",
  SENDER_NSM_APPROVED:
    "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/60",
  SENT:
    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60",
  HOLD:
    "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900/60",
  AWAITING_REMAINING:
    "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900/60",
  COMPLETED:
    "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60",
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

function transferTypeLabel(type: Transfer["transferType"]) {
  return type === "FACTORY_TO_WAREHOUSE"
    ? "Factory → Warehouse"
    : "Warehouse → Warehouse";
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
  const map: Record<string, string> = {
    REQUESTED:
      t.transferMode === "DIRECT"
        ? "Ready to print and send"
        : "Waiting for receiver NSM approval",
    RECEIVER_NSM_APPROVED:
      t.transferMode === "DIRECT"
        ? "Ready for factory processing"
        : "Waiting for factory approval / dispatch",
    SENDER_REVIEWED: "Waiting for sender NSM final approval",
    SENDER_NSM_APPROVED: "Ready to print and send",
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
    return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60";
  }
  if (hasSnapshot || hasSigned) {
    return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60";
  }
  return "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700";
}

function getPaginationRange(
  current: number,
  total: number,
): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, 4, "...", total];
  if (current >= total - 2)
    return [1, "...", total - 3, total - 2, total - 1, total];
  return [1, "...", current - 1, current, current + 1, "...", total];
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
  tone?: "slate" | "amber" | "green" | "sky";
}) {
  const map = {
    slate: {
      bg: "bg-slate-100 dark:bg-slate-800",
      fg: "text-slate-600 dark:text-slate-300",
    },
    amber: {
      bg: "bg-amber-100 dark:bg-amber-950/40",
      fg: "text-amber-600 dark:text-amber-300",
    },
    green: {
      bg: "bg-[#3aa838]/10 dark:bg-[#3aa838]/15",
      fg: "text-[#2f8a2f] dark:text-[#9bdd91]",
    },
    sky: {
      bg: "bg-sky-100 dark:bg-sky-950/40",
      fg: "text-sky-600 dark:text-sky-300",
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
      <div className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
        {value}
      </div>
      <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
        {hint}
      </p>
    </div>
  );
}

/* =========================== Page (Protected) =========================== */
export default function FactoryTransferListPage() {
  return (
    <Protected
      permissions={[
        "factorytransfer.view",
        "factorytransfer.create",
        "factorytransfer.edit",
        "factorytransfer.delete",
      ]}
    >
      <FactoryTransferListPageInner />
    </Protected>
  );
}

/* =========================== Inner =========================== */
function FactoryTransferListPageInner() {
  const router = useRouter();
  const hasAccess = usePermissionCheck();
  const canCreate = hasAccess({ permissions: "factorytransfer.create" });

  const [loading, setLoading] = useState(false);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const [transferMode, setTransferMode] = useState<string>("ALL");
  const [sender, setSender] = useState<string>("ALL");
  const [receiver, setReceiver] = useState<string>("ALL");

  const [tab, setTab] = useState<
    "ALL" | "DIRECT" | "REQUEST" | "NEED_ACTION" | "COMPLETED"
  >("ALL");

  // TODO: later derive sender factory from auth and lock factory scoping per role.
  const currentFactoryId = "";

  useEffect(() => {
    loadLocations();
  }, []);

  useEffect(() => {
    loadTransfers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, q, status, transferMode, sender, receiver, tab]);

  useEffect(() => {
    setPage(1);
  }, [q, status, transferMode, sender, receiver, tab]);

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
        transferType: "FACTORY_TO_WAREHOUSE",
      };

      if (q.trim()) params.q = q.trim();
      if (status !== "ALL") params.status = status;
      if (transferMode !== "ALL") params.transferMode = transferMode;
      if (sender !== "ALL") params.sender = sender;
      if (receiver !== "ALL") params.receiver = receiver;

      if (tab === "DIRECT") {
        params.transferMode = "DIRECT";
      }

      if (tab === "REQUEST") {
        params.transferMode = "REQUEST";
      }

      if (tab === "COMPLETED") {
        params.status = "COMPLETED";
      }

      if (currentFactoryId && !sender) {
        // TODO: later auto-filter by sender = currentFactoryId for factory users.
      }

      const res = await api.get("/transfers", { params });
      setTransfers(res.data?.data || []);
      setTotal(res.data?.total || 0);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load factory transfers");
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
    const direct = transfers.filter((t) => t.transferMode === "DIRECT").length;
    const request = transfers.filter(
      (t) => t.transferMode === "REQUEST",
    ).length;
    const completed = transfers.filter((t) => t.status === "COMPLETED").length;
    return { totalItems, direct, request, completed };
  }, [transfers]);

  function openTransfer(id: string) {
    router.push(`/inventory/product-transfer/${id}`);
  }

  function resetFilters() {
    setQ("");
    setStatus("ALL");
    setTransferMode("ALL");
    setSender("ALL");
    setReceiver("ALL");
    setTab("ALL");
    setPage(1);
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
                  Factory Transfers
                </span>
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white md:text-3xl">
                Factory Transfers
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                Track direct factory shipments and warehouse requests that need
                factory processing.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadTransfers}
                disabled={loading}
                className="h-9 gap-1.5"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
              {canCreate && (
                <Button
                  size="sm"
                  onClick={() =>
                    router.push("/inventory/product-transfer/new")
                  }
                  className="h-9 gap-1.5 bg-[#3aa838] text-white shadow-sm shadow-[#3aa838]/20 hover:bg-[#2f8a2f]"
                >
                  <Plus className="h-4 w-4" />
                  Create Transfer
                </Button>
              )}
            </div>
          </div>

          {/* Stat cards */}
          <div className="relative mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={Factory}
              label="Shown on page"
              value={summary.totalItems}
              hint={`${total} total records`}
              tone="slate"
            />
            <StatCard
              icon={FileText}
              label="Direct"
              value={summary.direct}
              hint="Factory to warehouse"
              tone="sky"
            />
            <StatCard
              icon={Clock3}
              label="Request"
              value={summary.request}
              hint="Warehouse requests"
              tone="amber"
            />
            <StatCard
              icon={CheckCircle2}
              label="Completed"
              value={summary.completed}
              hint="Successfully closed"
              tone="green"
            />
          </div>
        </div>

        {/* ============ FILTERS ============ */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white">
                <Filter className="h-3.5 w-3.5 text-[#3aa838]" />
                Filters
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={resetFilters}
                className="h-8 gap-1.5 text-xs"
              >
                Reset filters
              </Button>
            </div>
          </div>

          <div className="space-y-4 p-4">
            {/* Tab pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                ["ALL", "All"],
                ["DIRECT", "Direct"],
                ["REQUEST", "Requests"],
                ["NEED_ACTION", "Need Action"],
                ["COMPLETED", "Completed"],
              ].map(([key, label]) => {
                const active = tab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key as any)}
                    className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      active
                        ? "bg-[#3aa838] text-white shadow-sm shadow-[#3aa838]/20"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Filter form */}
            <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-5">
              <div className="xl:col-span-2">
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Search transfer no
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <Input
                    className="h-9 pl-9 text-sm"
                    placeholder="Search by transfer number…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Status
                </label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="h-9">
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
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Mode
                </label>
                <Select value={transferMode} onValueChange={setTransferMode}>
                  <SelectTrigger className="h-9">
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
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Sender
                </label>
                <Select value={sender} onValueChange={setSender}>
                  <SelectTrigger className="h-9">
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
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Receiver
                </label>
                <Select value={receiver} onValueChange={setReceiver}>
                  <SelectTrigger className="h-9">
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

            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              The action page will handle print, dispatch, and receive.
            </div>
          </div>
        </div>

        {/* ============ TABLE ============ */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Factory transfer list
              </h2>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Page {page} of {totalPages}
              </span>
            </div>
          </div>

          <div className="max-h-[68vh] overflow-auto">
            <table className="w-full min-w-full table-auto">
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
                <tr>
                  {[
                    "Transfer",
                    "Route",
                    "Workflow",
                    "Items",
                    "Docs",
                    "Status",
                    "Updated",
                    "Action",
                  ].map((h, i) => (
                    <th
                      key={h}
                      className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${
                        i === 7 ? "text-right" : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr
                      key={i}
                      className="border-b border-slate-100 dark:border-slate-800"
                    >
                      <td className="px-4 py-4" colSpan={8}>
                        <div className="h-12 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
                      </td>
                    </tr>
                  ))
                ) : transfers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-14">
                      <div className="mx-auto max-w-md text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                          <Inbox className="h-6 w-6 text-slate-400" />
                        </div>
                        <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
                          No factory transfers found
                        </h3>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          No records match your current filters.
                        </p>
                        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={resetFilters}
                            className="h-8 gap-1.5 text-xs"
                          >
                            Clear filters
                          </Button>
                          {canCreate && (
                            <Button
                              size="sm"
                              onClick={() =>
                                router.push("/factory/transfers/create")
                              }
                              className="h-8 gap-1.5 bg-[#3aa838] text-xs text-white hover:bg-[#2f8a2f]"
                            >
                              <Plus className="h-3 w-3" />
                              Create transfer
                            </Button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  transfers.map((t) => (
                    <tr
                      key={t._id}
                      className="group border-b border-slate-100 transition-colors hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/30"
                    >
                      <td className="px-4 py-3 align-top">
                        <div className="space-y-0.5">
                          <button
                            type="button"
                            onClick={() => openTransfer(t._id)}
                            className="text-left text-sm font-semibold text-slate-900 transition-colors hover:text-[#2f8a2f] dark:text-white"
                          >
                            {t.transferNo}
                          </button>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            {transferTypeLabel(t.transferType)} ·{" "}
                            {t.transferMode}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 align-top">
                        <div className="space-y-1.5 text-xs">
                          <div className="flex items-center gap-1.5">
                            <Factory className="h-3 w-3 shrink-0 text-[#3aa838]" />
                            <span className="truncate font-medium text-slate-900 dark:text-white">
                              {locationLabel(t.sender)}
                            </span>
                            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              {locationKind(t.sender)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3 w-3 shrink-0 text-slate-400" />
                            <span className="truncate font-medium text-slate-900 dark:text-white">
                              {locationLabel(t.receiver)}
                            </span>
                            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              {locationKind(t.receiver)}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 align-top">
                        <div className="space-y-1 text-xs">
                          <div className="font-medium text-slate-900 dark:text-white">
                            {stepLabel(t.status)}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            {stepHint(t)}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 align-top">
                        <div className="space-y-0.5 text-xs">
                          <div className="font-medium text-slate-900 dark:text-white">
                            {t.items?.length || 0} lines
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            {qtyTotal(t)} total qty
                          </div>
                          <div className="max-w-[220px] truncate text-[10px] text-slate-500 dark:text-slate-400">
                            {itemPreview(t)}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 align-top">
                        <div className="space-y-1.5">
                          <span
                            className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${documentTone(t)}`}
                          >
                            {documentState(t)}
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {t.printSnapshot ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[9px] font-medium text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">
                                <FileText className="h-2.5 w-2.5" />
                                Snapshot
                              </span>
                            ) : null}
                            {t.documents?.signed?.mediaId ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                                <FileCheck2 className="h-2.5 w-2.5" />
                                Signed
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 align-top">
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${
                            STATUS_STYLES[t.status] ||
                            STATUS_STYLES.REQUESTED
                          }`}
                        >
                          {stepLabel(t.status)}
                        </span>
                      </td>

                      <td className="px-4 py-3 align-top">
                        <div className="space-y-0.5 text-xs">
                          <div className="font-medium text-slate-900 dark:text-white">
                            {t.updatedAt
                              ? new Date(t.updatedAt).toLocaleDateString()
                              : "-"}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            {t.updatedAt
                              ? new Date(t.updatedAt).toLocaleTimeString()
                              : ""}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => openTransfer(t._id)}
                            title="View"
                            className="flex h-7 items-center gap-1 rounded-md bg-[#3aa838]/10 px-2 text-[10px] font-semibold text-[#2f8a2f] transition-colors hover:bg-[#3aa838]/20 dark:bg-[#3aa838]/15 dark:text-[#9bdd91]"
                          >
                            <Eye className="h-3 w-3" />
                            View
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Total records:{" "}
              <span className="font-semibold text-slate-900 dark:text-white">
                {total}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <div className="flex items-center gap-1">
                {getPaginationRange(page, totalPages).map((p, idx) =>
                  p === "..." ? (
                    <span
                      key={`e-${idx}`}
                      className="px-1 text-xs text-slate-400"
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p as number)}
                      className={`h-7 min-w-7 rounded-md px-2 text-xs font-semibold transition-colors ${
                        p === page
                          ? "bg-[#3aa838] text-white"
                          : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                      }`}
                    >
                      {p}
                    </button>
                  ),
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={page === totalPages || loading}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}