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
import {
  Check,
  ChevronsUpDown,
  Loader2,
  RefreshCw,
  Eye,
  Pencil,
  ReceiptText,
  Truck,
  Ban,
  Printer,
} from "lucide-react";

type LookupOption = {
  value: string;
  label: string;
  description?: string;
};

type OrderStatus =
  | "PENDING_AM"
  | "PENDING_RM"
  | "PENDING_NSM"
  | "PENDING_FULFILLMENT"
  | "IN_SHIPPING"
  | "DELIVERED"
  | "REJECTED"
  | "CANCELLED";

type PaymentMethod = "CASH" | "CREDIT";

type SalesOrderRecord = {
  _id: string;
  orderNo: string;
  customerId?: any;
  warehouseId?: any;
  invoiceId?: any;
  orderDate?: string;
  subTotal?: number;
  totalDiscount?: number;
  totalTax?: number;
  grandTotal?: number;
  totalBonusQty?: number;
  paymentMethod?: PaymentMethod;
  status: OrderStatus;
  isInvoiced?: boolean;
  approvalLogs?: Array<{
    role?: string;
    status?: string;
    actionDate?: string;
    remarks?: string;
    userId?: any;
  }>;
  createdAt?: string;
  updatedAt?: string;
};

type ListResponse = {
  data: SalesOrderRecord[];
  total: number;
  page: number;
  limit: number;
};

function money(n: number | undefined) {
  return Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(value?: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function useDebouncedValue<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const styles: Record<OrderStatus, string> = {
    PENDING_AM: "bg-slate-100 text-slate-700 border-slate-200",
    PENDING_RM: "bg-indigo-100 text-indigo-700 border-indigo-200",
    PENDING_NSM: "bg-violet-100 text-violet-700 border-violet-200",
    PENDING_FULFILLMENT: "bg-amber-100 text-amber-700 border-amber-200",
    IN_SHIPPING: "bg-cyan-100 text-cyan-700 border-cyan-200",
    DELIVERED: "bg-emerald-100 text-emerald-700 border-emerald-200",
    REJECTED: "bg-red-100 text-red-700 border-red-200",
    CANCELLED: "bg-rose-100 text-rose-700 border-rose-200",
  };

  const label = status.replaceAll("_", " ");

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${styles[status]}`}
    >
      {label}
    </span>
  );
}

function PaymentBadge({ method }: { method?: PaymentMethod }) {
  if (!method) return <span className="text-xs text-muted-foreground">-</span>;

  const styles =
    method === "CREDIT"
      ? "bg-orange-100 text-orange-700 border-orange-200"
      : "bg-slate-100 text-slate-700 border-slate-200";

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${styles}`}
    >
      {method}
    </span>
  );
}

function LookupSelect({
  value,
  selectedLabel,
  onPick,
  fetchOptions,
  placeholder,
  searchPlaceholder,
  disabled,
}: {
  value?: string;
  selectedLabel?: string;
  onPick: (option: LookupOption) => void;
  fetchOptions: (query: string) => Promise<LookupOption[]>;
  placeholder: string;
  searchPlaceholder: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<LookupOption[]>([]);
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef<Record<string, LookupOption[]>>({});

  useEffect(() => {
    if (!open) return;

    const key = query.trim().toLowerCase();
    const timer = setTimeout(async () => {
      if (cacheRef.current[key]) {
        setOptions(cacheRef.current[key]);
        return;
      }

      setLoading(true);
      try {
        const list = await fetchOptions(query);
        cacheRef.current[key] = list;
        setOptions(list);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [open, query, fetchOptions]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="w-full justify-between overflow-hidden"
        >
          <span className="truncate">{selectedLabel || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[360px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? "Loading..." : "No result found."}
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
                    className={`mr-2 h-4 w-4 ${
                      opt.value === value ? "opacity-100" : "opacity-0"
                    }`}
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

export default function SalesOrderListPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [refreshingAction, setRefreshingAction] = useState<string | null>(null);
  const [orders, setOrders] = useState<SalesOrderRecord[]>([]);
  const [total, setTotal] = useState(0);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [paymentFilter, setPaymentFilter] = useState<string>("");
  const [dealerFilter, setDealerFilter] = useState<string>("");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("");

  const [dealerMeta, setDealerMeta] = useState<LookupOption | null>(null);
  const [warehouseMeta, setWarehouseMeta] = useState<LookupOption | null>(null);

  const fetchDealers = useCallback(async (query: string) => {
    const res = await api.get("/dealers", {
      params: { q: query || undefined, page: 1, limit: 20 },
    });

    return (res.data?.data || []).map((d: any) => ({
      value: String(d._id || d.id),
      label: d.name || d.proprietor || String(d._id || d.id),
      description: `${d.phoneNumber || d.phone || ""}${d.status ? ` · ${d.status}` : ""}`,
    })) as LookupOption[];
  }, []);

  const fetchWarehouses = useCallback(async (query: string) => {
    const res = await api.get("/warehouses", {
      params: { q: query || undefined, page: 1, limit: 20 },
    });

    return (res.data?.data || []).map((w: any) => ({
      value: String(w._id || w.id),
      label: w.name || String(w._id || w.id),
      description: w.code || w.type || "",
    })) as LookupOption[];
  }, []);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        page,
        limit,
      };

      if (debouncedSearch.trim()) params.q = debouncedSearch.trim();
      if (statusFilter) params.status = statusFilter;
      if (paymentFilter) params.paymentMethod = paymentFilter;
      if (dealerFilter) params.customerId = dealerFilter;
      if (warehouseFilter) params.warehouseId = warehouseFilter;

      const res = await api.get("/sales-orders", { params });
      const payload = res.data as ListResponse | any;

      setOrders(payload?.data || []);
      setTotal(Number(payload?.total || 0));
    } catch (err: any) {
      console.error(err);
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load sales orders.",
      );
    } finally {
      setLoading(false);
    }
  }, [
    page,
    limit,
    debouncedSearch,
    statusFilter,
    paymentFilter,
    dealerFilter,
    warehouseFilter,
  ]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const summary = useMemo(() => {
    const delivered = orders.filter((o) => o.status === "DELIVERED").length;
    const pending = orders.filter((o) =>
      [
        "PENDING_AM",
        "PENDING_RM",
        "PENDING_NSM",
        "PENDING_FULFILLMENT",
      ].includes(o.status),
    ).length;
    const invoiced = orders.filter((o) => o.isInvoiced).length;
    const credit = orders.filter((o) => o.paymentMethod === "CREDIT").length;
    const grand = orders.reduce((s, o) => s + Number(o.grandTotal || 0), 0);

    return { delivered, pending, invoiced, credit, grand };
  }, [orders]);

  const setDealer = async (opt: LookupOption) => {
    setDealerFilter(opt.value);
    setDealerMeta(opt);
    setPage(1);
  };

  const setWarehouse = async (opt: LookupOption) => {
    setWarehouseFilter(opt.value);
    setWarehouseMeta(opt);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setPaymentFilter("");
    setDealerFilter("");
    setWarehouseFilter("");
    setDealerMeta(null);
    setWarehouseMeta(null);
    setPage(1);
  };

  const openView = (id: string) => {
    router.push(`/sales/list/${id}`);
  };

  const openEdit = (id: string) => {
    router.push(`/sales/list/${id}/edit`);
  };

  const openInvoice = (invoiceId: string) => {
    window.open(`/sales/invoice/${invoiceId}`, "_blank");
  };

  const handleCancel = async (orderId: string) => {
    if (!confirm("Cancel this sales order?")) return;

    setRefreshingAction(orderId);
    try {
      await api.post(`/sales-orders/${orderId}/cancel`);
      toast.success("Order cancelled.");
      await loadOrders();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to cancel order.",
      );
    } finally {
      setRefreshingAction(null);
    }
  };

  const handleShip = async (orderId: string) => {
    if (!confirm("Create invoice and move this order to fulfillment?")) return;

    setRefreshingAction(orderId);
    try {
      await api.post(`/sales-orders/${orderId}/ship`);
      toast.success("Invoice created and order moved to shipping.");
      await loadOrders();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || err?.message || "Failed to ship order.",
      );
    } finally {
      setRefreshingAction(null);
    }
  };

  const handleDeliver = (orderId: string) => {
    router.push(`/sales-orders/${orderId}`);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl p-4 md:p-6">
        <div className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Sales Orders</h1>
              <p className="text-sm text-muted-foreground">
                Search, filter, review workflow, and manage order actions from
                one place.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadOrders()}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
              <Button
                type="button"
                onClick={() => router.push("/sales/create")}
              >
                New order
              </Button>
            </div>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">
                Visible Orders
              </div>
              <div className="mt-1 text-2xl font-semibold">{orders.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Delivered</div>
              <div className="mt-1 text-2xl font-semibold">
                {summary.delivered}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Pending</div>
              <div className="mt-1 text-2xl font-semibold">
                {summary.pending}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Invoiced</div>
              <div className="mt-1 text-2xl font-semibold">
                {summary.invoiced}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Page Total</div>
              <div className="mt-1 text-2xl font-semibold">
                {money(summary.grand)} BDT
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6 border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <div className="space-y-2 xl:col-span-2">
              <div className="text-sm font-medium">Search order no</div>
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by order number..."
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Status</div>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none"
              >
                <option value="">All</option>
                <option value="PENDING_AM">Pending AM</option>
                <option value="PENDING_RM">Pending RM</option>
                <option value="PENDING_NSM">Pending NSM</option>
                <option value="PENDING_FULFILLMENT">Pending Fulfillment</option>
                <option value="IN_SHIPPING">In Shipping</option>
                <option value="DELIVERED">Delivered</option>
                <option value="REJECTED">Rejected</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Payment</div>
              <select
                value={paymentFilter}
                onChange={(e) => {
                  setPaymentFilter(e.target.value);
                  setPage(1);
                }}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none"
              >
                <option value="">All</option>
                <option value="CASH">Cash</option>
                <option value="CREDIT">Credit</option>
              </select>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Dealer</div>
              <LookupSelect
                value={dealerFilter}
                selectedLabel={dealerMeta?.label}
                onPick={setDealer}
                fetchOptions={fetchDealers}
                placeholder="Search dealer"
                searchPlaceholder="Type dealer name or phone..."
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Warehouse</div>
              <LookupSelect
                value={warehouseFilter}
                selectedLabel={warehouseMeta?.label}
                onPick={setWarehouse}
                fetchOptions={fetchWarehouses}
                placeholder="Search warehouse"
                searchPlaceholder="Type warehouse name..."
              />
            </div>

            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                onClick={clearFilters}
                className="w-full"
              >
                Clear filters
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-slate-100 text-left">
                  <tr>
                    <th className="border-b px-4 py-3">Order No</th>
                    <th className="border-b px-4 py-3">Dealer</th>
                    <th className="border-b px-4 py-3">Warehouse</th>
                    <th className="border-b px-4 py-3">Date</th>
                    <th className="border-b px-4 py-3">Payment</th>
                    <th className="border-b px-4 py-3">Status</th>
                    <th className="border-b px-4 py-3 text-right">Total</th>
                    <th className="border-b px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center">
                        <div className="flex items-center justify-center gap-2 text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading sales orders...
                        </div>
                      </td>
                    </tr>
                  ) : orders.length ? (
                    orders.map((order) => {
                      const dealerName =
                        order.customerId?.name ||
                        order.customerId?.proprietor ||
                        order.customerId?.phoneNumber ||
                        order.customerId?._id ||
                        "-";

                      const warehouseName =
                        order.warehouseId?.name ||
                        order.warehouseId?._id ||
                        "-";

                      const invoiceId =
                        typeof order.invoiceId === "object"
                          ? order.invoiceId?._id || order.invoiceId?.id
                          : order.invoiceId;

                      const editableStatuses: OrderStatus[] = [
                        "PENDING_AM",
                        "PENDING_RM",
                        "PENDING_NSM",
                        "PENDING_FULFILLMENT",
                      ];

                      const canEdit = editableStatuses.includes(order.status);
                      const canShip = order.status === "PENDING_FULFILLMENT";
                      const canDeliver = order.status === "IN_SHIPPING";
                      const canCancel = !["DELIVERED", "CANCELLED"].includes(
                        order.status,
                      );

                      return (
                        <tr
                          key={order._id}
                          className="border-b last:border-0 hover:bg-slate-50"
                        >
                          <td className="px-4 py-3 font-medium">
                            {order.orderNo}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium">{dealerName}</div>
                            <div className="text-xs text-muted-foreground">
                              {order.customerId?.phoneNumber || ""}
                            </div>
                          </td>
                          <td className="px-4 py-3">{warehouseName}</td>
                          <td className="px-4 py-3">
                            {fmtDate(order.orderDate || order.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            <PaymentBadge method={order.paymentMethod} />
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={order.status} />
                            <div className="mt-1 text-xs text-muted-foreground">
                              {order.isInvoiced
                                ? "Invoice created"
                                : "No invoice yet"}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            {money(order.grandTotal)} BDT
                            <div className="text-xs text-muted-foreground">
                              Items bonus: {Number(order.totalBonusQty || 0)}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => openView(order._id)}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View
                              </Button>

                              {canEdit ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openEdit(order._id)}
                                >
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit
                                </Button>
                              ) : null}

                              {invoiceId ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openInvoice(String(invoiceId))}
                                >
                                  <Printer className="mr-2 h-4 w-4" />
                                  Invoice
                                </Button>
                              ) : null}

                              {canShip ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => void handleShip(order._id)}
                                  disabled={refreshingAction === order._id}
                                >
                                  {refreshingAction === order._id ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <ReceiptText className="mr-2 h-4 w-4" />
                                  )}
                                  Ship
                                </Button>
                              ) : null}

                              {canDeliver ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeliver(order._id)}
                                >
                                  <Truck className="mr-2 h-4 w-4" />
                                  Deliver
                                </Button>
                              ) : null}

                              {canCancel ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700"
                                  onClick={() => void handleCancel(order._id)}
                                  disabled={refreshingAction === order._id}
                                >
                                  {refreshingAction === order._id ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <Ban className="mr-2 h-4 w-4" />
                                  )}
                                  Cancel
                                </Button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-12 text-center text-muted-foreground"
                      >
                        No sales orders found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-muted-foreground">
            Total records:{" "}
            <span className="font-medium text-foreground">{total}</span>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={String(limit)}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none"
            >
              <option value="10">10 / page</option>
              <option value="15">15 / page</option>
              <option value="25">25 / page</option>
              <option value="50">50 / page</option>
            </select>

            <Button
              type="button"
              variant="outline"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Prev
            </Button>

            <div className="min-w-24 text-center text-sm">
              Page <span className="font-medium">{page}</span> / {totalPages}
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
