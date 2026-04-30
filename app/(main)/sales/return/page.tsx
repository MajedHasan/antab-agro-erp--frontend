// src/app/sales/return/page.tsx

"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";

import {
  formatDate,
  getApprovedQty,
  getInvoiceCount,
  getProductCount,
  getReturnQty,
  getStatusBadgeClass,
  getStatusLabel,
  money,
  type SalesReturnStatus,
} from "./utils/salesReturn.helpers";

type DealerOption = {
  value: string;
  label: string;
  description?: string;
};

type SalesReturnListItem = {
  _id: string;
  returnNo: string;
  customerId?: {
    _id?: string;
    name?: string;
    phoneNumber?: string;
  } | null;
  status: SalesReturnStatus;
  invoiceReturns?: any[];
  totalRequestedAmount?: number;
  totalApprovedAmount?: number;
  totalReceivedAmount?: number;
  createdAt?: string;
  updatedAt?: string;
  notes?: string;
  printCount?: number;
  warehouseReceived?: boolean;
  approvalLogs?: any[];
};

const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "PENDING_AM", label: "Pending AM" },
  { value: "PENDING_RM", label: "Pending RM" },
  { value: "PENDING_NSM", label: "Pending NSM" },
  { value: "READY_FOR_PRINT", label: "Ready for Print" },
  { value: "PRINTED", label: "Printed" },
  { value: "SENT_TO_WAREHOUSE", label: "Sent to Warehouse" },
  { value: "WAREHOUSE_RECEIVED", label: "Warehouse Received" },
  { value: "HOLD", label: "Hold" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "COMPLETED", label: "Completed" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CANCELLED", label: "Cancelled" },
];

function DealerSelect({
  value,
  selectedLabel,
  onPick,
}: {
  value?: string;
  selectedLabel?: string;
  onPick: (dealer: DealerOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<DealerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const cacheRef = React.useRef<Record<string, DealerOption[]>>({});

  useEffect(() => {
    if (!open) return;

    const timer = window.setTimeout(async () => {
      const key = query.trim().toLowerCase();
      if (cacheRef.current[key]) {
        setOptions(cacheRef.current[key]);
        return;
      }

      setLoading(true);
      try {
        const res = await api.get("/dealers", {
          params: { q: query || undefined, page: 1, limit: 20 },
        });

        const list = (res.data?.data || []).map((d: any) => ({
          value: String(d._id || d.id),
          label: d.name || d.proprietor || String(d._id || d.id),
          description: [
            d.phoneNumber || d.phone || "",
            d.status ? String(d.status) : "",
          ]
            .filter(Boolean)
            .join(" · "),
        })) as DealerOption[];

        cacheRef.current[key] = list;
        setOptions(list);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [open, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-between"
        >
          <span className="truncate">{selectedLabel || "All dealers"}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search dealer..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? "Loading..." : "No dealer found."}
            </CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={`${opt.label} ${opt.description || ""}`}
                  onSelect={() => {
                    onPick(opt);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <Check
                    className={`mr-2 h-4 w-4 ${opt.value === value ? "opacity-100" : "opacity-0"}`}
                  />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{opt.label}</div>
                    {opt.description ? (
                      <div className="truncate text-xs text-muted-foreground">
                        {opt.description}
                      </div>
                    ) : null}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function StatCard({
  title,
  value,
  sub,
}: {
  title: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          {title}
        </div>
        <div className="mt-1 text-2xl font-semibold">{value}</div>
        {sub ? (
          <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ReturnRowDetails({ doc }: { doc: SalesReturnListItem }) {
  const recentLog = (doc.approvalLogs || []).slice(-1)[0];
  const firstBlock = (doc.invoiceReturns || [])[0];
  const firstItems = firstBlock?.items || [];
  const firstItemsText = firstItems
    .slice(0, 3)
    .map(
      (i: any) =>
        i.productId?.name || i.productName || String(i.productId || "Item"),
    )
    .join(", ");

  return (
    <div className="grid gap-4 border-t bg-slate-50/60 p-4 md:grid-cols-4">
      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Workflow
        </div>
        <div className="mt-1 font-medium">{getStatusLabel(doc.status)}</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Print count: {doc.printCount || 0}
        </div>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Quantity
        </div>
        <div className="mt-1 font-medium">{getReturnQty(doc)}</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Products: {getProductCount(doc)} · Invoices: {getInvoiceCount(doc)}
        </div>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Financials
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          Requested: {money(Number(doc.totalRequestedAmount || 0))}
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          Approved: {money(Number(doc.totalApprovedAmount || 0))}
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          Received: {money(Number(doc.totalReceivedAmount || 0))}
        </div>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Recent activity
        </div>
        <div className="mt-1 font-medium">
          {recentLog?.role || "-"} · {recentLog?.status || "-"}
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          {recentLog?.remarks || doc.notes || "No notes"}
        </div>
      </div>

      {firstItemsText ? (
        <div className="md:col-span-4 rounded-lg border bg-white p-3 text-sm text-muted-foreground">
          Sample items:{" "}
          <span className="font-medium text-slate-900">{firstItemsText}</span>
        </div>
      ) : null}
    </div>
  );
}

export default function SalesReturnListPage() {
  const router = useRouter();

  const [items, setItems] = useState<SalesReturnListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [dealer, setDealer] = useState<DealerOption | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/sales-returns", {
        params: {
          page,
          limit,
          q: search || undefined,
          status: status || undefined,
          customerId: dealer?.value || undefined,
        },
      });

      setItems((res.data?.data || []) as SalesReturnListItem[]);
      setTotal(Number(res.data?.total || 0));
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to load sales returns.";
      toast.error(msg);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, status, dealer?.value]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const requested = items.reduce(
      (sum, d) => sum + Number(d.totalRequestedAmount || 0),
      0,
    );
    const approved = items.reduce(
      (sum, d) => sum + Number(d.totalApprovedAmount || 0),
      0,
    );
    const received = items.reduce(
      (sum, d) => sum + Number(d.totalReceivedAmount || 0),
      0,
    );
    const qty = items.reduce((sum, d) => sum + getReturnQty(d), 0);
    return { requested, approved, received, qty };
  }, [items]);

  const resetFilters = () => {
    setSearch("");
    setStatus("");
    setDealer(null);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl p-4 md:p-6">
        <div className="mb-6 rounded-3xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                <Sparkles className="h-3.5 w-3.5" />
                Sales Return Control Panel
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight">
                Sales Return List
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Browse returns, open any workflow item, and jump into the action
                page when you need approvals, printing, warehouse receive, or
                completion.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => router.push("/sales/return/create")}
              >
                New return
              </Button>
              <Button variant="outline" onClick={load} disabled={loading}>
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Refresh
              </Button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <StatCard
              title="Filtered returns"
              value={items.length}
              sub={`Total: ${total}`}
            />
            <StatCard title="Total qty" value={stats.qty} />
            <StatCard title="Requested amount" value={money(stats.requested)} />
            <StatCard title="Approved amount" value={money(stats.approved)} />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-4">
            <div className="space-y-2 lg:col-span-2">
              <div className="text-sm font-medium">Search return number</div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search return no..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setPage(1);
                      load();
                    }
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Status</div>
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none"
              >
                {STATUS_FILTERS.map((s) => (
                  <option key={s.value || "all"} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Dealer</div>
              <DealerSelect
                value={dealer?.value}
                selectedLabel={dealer?.label}
                onPick={(d) => {
                  setDealer(d);
                  setPage(1);
                }}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              onClick={() => {
                setPage(1);
                load();
              }}
            >
              <Filter className="mr-2 h-4 w-4" />
              Apply filters
            </Button>
            <Button variant="ghost" onClick={resetFilters}>
              Reset
            </Button>
          </div>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Returns</CardTitle>
            <div className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </div>
          </CardHeader>

          <CardContent>
            <div className="overflow-hidden rounded-2xl border bg-white">
              <div className="hidden grid-cols-12 gap-3 border-b bg-slate-50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid">
                <div className="col-span-2">Return No</div>
                <div className="col-span-3">Dealer</div>
                <div className="col-span-2">Qty / Invoices</div>
                <div className="col-span-2">Amounts</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-1 text-right">Action</div>
              </div>

              <div className="divide-y">
                {loading ? (
                  <div className="px-4 py-16 text-center text-muted-foreground">
                    <div className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading sales returns...
                    </div>
                  </div>
                ) : items.length === 0 ? (
                  <div className="px-4 py-16 text-center">
                    <div className="mx-auto max-w-sm">
                      <div className="text-lg font-semibold">
                        No returns found
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Try adjusting the filters or create a new return.
                      </div>
                    </div>
                  </div>
                ) : (
                  items.map((doc) => {
                    const expanded = expandedId === doc._id;
                    return (
                      <div
                        key={doc._id}
                        className="transition hover:bg-slate-50/60"
                      >
                        <div className="grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-12 md:items-center">
                          <div className="md:col-span-2">
                            <button
                              type="button"
                              className="text-left"
                              onClick={() =>
                                setExpandedId(expanded ? null : doc._id)
                              }
                            >
                              <div className="font-semibold text-slate-900">
                                {doc.returnNo}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {formatDate(doc.createdAt)}
                              </div>
                            </button>
                          </div>

                          <div className="md:col-span-3">
                            <div className="font-medium">
                              {doc.customerId?.name || "-"}
                            </div>
                            {doc.customerId?.phoneNumber ? (
                              <div className="mt-1 text-xs text-muted-foreground">
                                {doc.customerId.phoneNumber}
                              </div>
                            ) : null}
                          </div>

                          <div className="md:col-span-2">
                            <div className="text-sm font-medium">
                              Qty: {getReturnQty(doc)}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Invoices: {getInvoiceCount(doc)} · Products:{" "}
                              {getProductCount(doc)}
                            </div>
                          </div>

                          <div className="md:col-span-2">
                            <div className="text-sm font-medium">
                              {money(Number(doc.totalRequestedAmount || 0))}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Approved:{" "}
                              {money(Number(doc.totalApprovedAmount || 0))}
                            </div>
                          </div>

                          <div className="md:col-span-2">
                            <Badge
                              variant="secondary"
                              className={`${getStatusBadgeClass(doc.status)} border`}
                            >
                              {getStatusLabel(doc.status)}
                            </Badge>
                            <div className="mt-2 text-xs text-muted-foreground">
                              Received:{" "}
                              {money(Number(doc.totalReceivedAmount || 0))}
                            </div>
                          </div>

                          <div className="md:col-span-1 md:text-right">
                            <Button asChild size="sm" variant="outline">
                              <Link href={`/sales/return/${doc._id}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                Open
                              </Link>
                            </Button>
                          </div>
                        </div>

                        <div className="border-t px-4 py-2">
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-8 px-2 text-xs text-muted-foreground"
                            onClick={() =>
                              setExpandedId(expanded ? null : doc._id)
                            }
                          >
                            {expanded ? (
                              <>
                                <ChevronUp className="mr-1 h-4 w-4" />
                                Hide details
                              </>
                            ) : (
                              <>
                                <ChevronDown className="mr-1 h-4 w-4" />
                                Show details
                              </>
                            )}
                          </Button>
                        </div>

                        {expanded ? <ReturnRowDetails doc={doc} /> : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {items.length} returns on this page
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none"
                >
                  {[10, 15, 25, 50].map((n) => (
                    <option key={n} value={n}>
                      {n}/page
                    </option>
                  ))}
                </select>

                <Button
                  variant="outline"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>

                <Button
                  variant="outline"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
