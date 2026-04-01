"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import api from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Eye,
  Check,
  X,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import WorkOrderViewDialog from "./_components/WorkOrderViewDialog";
import WorkOrderAddEditDialog from "./_components/WorkOrderAddEditDialog";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";

/**
 * Work Orders Page (single-file replacement)
 *
 * - Supports create/edit/view/print
 * - Supports improved status flow: Pending -> Processing -> Approved -> Completed -> Cancelled (cancel accepts reason)
 * - Adds GR (Goods Receipt) creation & management UI:
 *    - Create GR (file upload supported)
 *    - List GRs for WO
 *    - Approve / Reject GRs (reject requires reason)
 * - Does NOT enforce GR qty <= WO qty on client (per latest plan) — shows remaining & a warning
 *
 * If your backend has different GR route, replace `/grs` with the proper path.
 */

/* ----------------- Types ----------------- */
type IUser = { _id: string; name: string };
type Supplier = {
  _id: string;
  supplierName?: string;
  name?: string;
  address?: string;
  phoneNumber?: string;
  email?: string;
};
type Warehouse = { _id: string; name: string; address?: string };
type RawMaterial = {
  _id: string;
  name: string;
  unit?: string;
  salePrice?: number;
  purchasePrice?: number;
};
type PackagingItem = RawMaterial;

type ItemForm = {
  itemType?: "RawMaterial" | "PackagingItem";
  itemId?: string | RawMaterial | PackagingItem;
  name?: string;
  description?: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  lineTotal?: number;
  remarks?: string;
  _id?: string;
};

type WorkOrderForm = {
  _id?: string;
  workOrderNo?: string;
  subject?: string;
  reference?: string;
  attention?: string;
  salutation?: string;
  supplier?: string | Supplier;
  warehouseOrFactory?: string | Warehouse;
  issueDate?: string;
  expectedDeliveryDate?: string;
  items?: ItemForm[];
  status?: "Pending" | "Processing" | "Approved" | "Completed" | "Cancelled";
  notes?: string;
  terms?: string;
  selectedTemplateId?: string | null;
  discountPercent?: number;
  taxPercent?: number;
  subTotal?: number;
  discountAmount?: number;
  taxTotal?: number;
  grandTotal?: number;
  footerNote?: string;
  createdBy?: string | IUser;
  approvedBy?: string | IUser;
  cancelReason?: string;
  createdAt?: string;
  updatedAt?: string;
};

type TermsTemplate = { _id?: string; title: string; content: string };

/* ----------------- Helpers: safe arithmetic & format ----------------- */
function safeMultiply(a: number, b: number) {
  return Math.round(a * b * 100) / 100;
}
function safeAdd(a: number, b: number) {
  return Math.round((a + b) * 100) / 100;
}
function formatCurrency(n?: number | null) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "-";
  const fixed = (Math.round((n as number) * 100) / 100).toFixed(2);
  return Number(fixed).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/* Compute totals (keeps original rounding semantics) */
function computeTotals(
  items: ItemForm[] = [],
  discountPercent = 0,
  taxPercent = 0,
) {
  let sub = 0;
  const cloned = (items || []).map((it) => ({ ...it }));
  for (let i = 0; i < cloned.length; i++) {
    const q = Number(cloned[i].quantity || 0);
    const p = Number(cloned[i].unitPrice || 0);
    const line = safeMultiply(q, p);
    cloned[i].lineTotal = line;
    sub = safeAdd(sub, line);
  }
  const discountAmount =
    Math.round(sub * (Number(discountPercent || 0) / 100) * 100) / 100;
  const taxedBase = Math.round((sub - discountAmount) * 100) / 100;
  const taxAmount =
    Math.round(taxedBase * (Number(taxPercent || 0) / 100) * 100) / 100;
  const grand = Math.round((taxedBase + taxAmount) * 100) / 100;
  return {
    items: cloned,
    subTotal: sub,
    discountAmount,
    taxTotal: taxAmount,
    grandTotal: grand,
  };
}

/* ----------------- Small utilities ----------------- */
const NONE = "none";
function getId(v?: any) {
  if (!v) return "";
  if (typeof v === "string") return v;
  return v._id ?? "";
}

/* ----------------- Main component ----------------- */
export default function WorkOrdersPage() {
  /* lookups */
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [users, setUsers] = useState<IUser[]>([]);
  const [templates, setTemplates] = useState<TermsTemplate[]>([]);

  const { error, success, currentUser, ...user } = useSelector(
    (state: RootState) => state.user,
  );

  /* list + filters */
  const [workOrders, setWorkOrders] = useState<WorkOrderForm[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [filterSupplier, setFilterSupplier] = useState<string | null>(null);
  const [filterWarehouseOrFactory, setFilterWarehouseOrFactory] = useState<
    string | null
  >(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /* modal / form state */
  const [openEdit, setOpenEdit] = useState(false);
  const [editing, setEditing] = useState<WorkOrderForm | null>(null);
  const [form, setForm] = useState<WorkOrderForm | null>(null);
  const [viewing, setViewing] = useState<WorkOrderForm | null>(null);

  /* GR state */

  const [loadingWO, setLoadingWO] = useState(false);

  // const printRef = useRef<HTMLDivElement | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  /* ----------------- Loaders ----------------- */
  const loadSuppliers = useCallback(async () => {
    try {
      const res = await api.get("/supplier", { params: { limit: 1000 } });
      setSuppliers(res.data.data || []);
    } catch {
      setSuppliers([]);
    }
  }, []);

  const loadWarehouses = useCallback(async () => {
    try {
      const res = await api.get("/warehouses?type=Factory", {
        params: { limit: 1000 },
      });
      setWarehouses(res.data.data || []);
    } catch {
      setWarehouses([]);
    }
  }, []);

  const loadWorkOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit };
      if (q) params.q = q;
      const filters: any = {};
      if (filterSupplier) filters.supplier = filterSupplier;
      if (filterWarehouseOrFactory)
        filters.warehouseOrFactory = filterWarehouseOrFactory;
      if (filterStatus) filters.status = filterStatus;
      if (Object.keys(filters).length) params.filter = JSON.stringify(filters);

      const res = await api.get("/workorders", { params });
      setWorkOrders(res.data.data || []);
      setTotal(res.data.total ?? 0);
    } catch {
      toast.error("Failed to load work orders");
      setWorkOrders([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, limit, q, filterSupplier, filterWarehouseOrFactory, filterStatus]);

  useEffect(() => {
    loadSuppliers();
    loadWarehouses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
  }, [q, filterSupplier, filterWarehouseOrFactory, filterStatus, limit]);

  useEffect(() => {
    loadWorkOrders();
  }, [loadWorkOrders]);

  /* ----------------- Form helpers ----------------- */
  const createEmptyItem = useCallback(
    (): ItemForm => ({
      itemType: "RawMaterial",
      itemId: "",
      name: "",
      description: "",
      quantity: 1,
      unit: "",
      unitPrice: 0,
      lineTotal: 0,
      remarks: "",
    }),
    [],
  );

  const onCreate = useCallback(async () => {
    try {
      const res = await api.get("/workorders/generate-no");
      const no = res?.data?.data;
      let createdBy = undefined;
      // try {
      //   const me = await api.get("/users/me");
      //   if (me?.data?.data) createdBy = me.data.data._id;
      // } catch {
      //   if (users.length) createdBy = users[0]._id;
      // }

      const tpl = templates?.[0];
      const newForm: WorkOrderForm = {
        workOrderNo: no,
        subject: "Work Order / Quotation",
        reference: "",
        attention: "",
        salutation: "Dear Sir / Madam,",
        supplier: "",
        warehouseOrFactory: "",
        issueDate: new Date().toISOString().slice(0, 10),
        expectedDeliveryDate: "",
        items: [createEmptyItem()],
        status: "Pending",
        notes: "",
        terms: tpl?.content ?? "",
        selectedTemplateId: tpl?._id ?? null,
        discountPercent: 0,
        taxPercent: 0,
        subTotal: 0,
        discountAmount: 0,
        taxTotal: 0,
        grandTotal: 0,
        footerNote: "Thank you for your business.",
        createdBy: currentUser,
      };

      setEditing(null);
      setForm(newForm);
      setOpenEdit(true);
    } catch {
      toast.error("Failed to generate work order number");
    }
  }, [templates, users, createEmptyItem]);

  const onEdit = useCallback(async (wo: WorkOrderForm) => {
    try {
      const res = await api.get(`/workorders/${getId(wo._id)}`);
      const doc: WorkOrderForm = res.data.data;
      const totals = computeTotals(
        doc.items || [],
        doc.discountPercent || 0,
        doc.taxPercent || 0,
      );
      doc.items = totals.items;
      doc.subTotal = totals.subTotal;
      doc.discountAmount = totals.discountAmount;
      doc.taxTotal = totals.taxTotal;
      doc.grandTotal = totals.grandTotal;
      setEditing(doc);
      setForm(doc);
      setOpenEdit(true);
    } catch {
      toast.error("Failed to load work order");
    }
  }, []);

  const onView = useCallback(async (wo: WorkOrderForm) => {
    try {
      setLoadingWO(true);
      const res = await api.get(`/workorders/${getId(wo._id)}`);
      const doc: WorkOrderForm = res.data.data;
      const totals = computeTotals(
        doc.items || [],
        doc.discountPercent || 0,
        doc.taxPercent || 0,
      );
      doc.items = totals.items;
      doc.subTotal = totals.subTotal;
      doc.discountAmount = totals.discountAmount;
      doc.taxTotal = totals.taxTotal;
      doc.grandTotal = totals.grandTotal;
      setViewing(doc);
    } catch {
      toast.error("Failed to load work order");
    } finally {
      setLoadingWO(false);
    }
  }, []);

  const onDelete = useCallback(
    async (id?: string) => {
      if (!id) return;
      if (!confirm("Delete this work order?")) return;
      try {
        await api.delete(`/workorders/${id}?hard=true`);
        toast.success("Deleted");
        loadWorkOrders();
      } catch {
        toast.error("Failed to delete");
      }
    },
    [loadWorkOrders],
  );

  /* ----------------- Status actions (matches backend update patterns) ----------------- */
  const updateStatus = useCallback(
    async (
      wo: WorkOrderForm,
      status: WorkOrderForm["status"],
      reason?: string,
    ) => {
      try {
        let currentUserId: string | undefined;
        try {
          const me = await api.get("/users/me");
          currentUserId = me?.data?.data?._id;
        } catch {
          currentUserId = users?.[0]?._id;
        }

        /* send PUT /workorders/:id with { status, cancelReason?, approvedBy? } */
        const payload: any = { status };
        if (status === "Processing") payload.approvedBy = currentUserId;
        if (status === "Cancelled" && reason) payload.cancelReason = reason;

        await api.put(`/workorders/${getId(wo._id)}`, payload);

        toast.success(`Status updated to ${status}`);
        loadWorkOrders();
        if (viewing && viewing._id === wo._id) {
          onView(wo);
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to update status");
      }
    },
    [users, loadWorkOrders, viewing, onView],
  );

  /* ----------------- render helpers ----------------- */
  function StatusBadge({ status }: { status?: string }) {
    if (!status) return <span>-</span>;
    const base =
      "px-2 py-1 rounded text-sm font-semibold inline-block text-white";
    switch (status) {
      case "Pending":
        return <span className={`${base} bg-yellow-600`}>{status}</span>;
      case "Processing":
        return <span className={`${base} bg-blue-600`}>{status}</span>;
      case "Approved":
        return <span className={`${base} bg-indigo-600`}>{status}</span>;
      case "Completed":
        return <span className={`${base} bg-green-600`}>{status}</span>;
      case "Cancelled":
        return <span className={`${base} bg-red-600`}>{status}</span>;
      default:
        return <span className={`${base} bg-gray-600`}>{status}</span>;
    }
  }

  /* ----------------- UI: main render ----------------- */
  return (
    <div className="p-4 space-y-6">
      {/* Header controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Work Orders</h2>
          <p className="text-sm text-muted-foreground">
            Create, approve, and manage Work Orders. Create GRs from approved
            work orders.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded px-2 py-1 gap-2 bg-white">
            <Search className="w-4 h-4 text-gray-500" />
            <Input
              placeholder="Search by WO#, supplier..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-64"
            />
          </div>

          <Select
            value={filterSupplier ?? NONE}
            onValueChange={(v) => setFilterSupplier(v === NONE ? null : v)}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by Supplier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>All Suppliers</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s._1 || s._id} value={s._id}>
                  {s.supplierName || s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filterWarehouseOrFactory ?? NONE}
            onValueChange={(v) =>
              setFilterWarehouseOrFactory(v === NONE ? null : v)
            }
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by Warehouse/Factory" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>All Warehouses</SelectItem>
              {warehouses.map((w) => (
                <SelectItem key={w._id} value={w._id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filterStatus ?? NONE}
            onValueChange={(v) => setFilterStatus(v === NONE ? null : v)}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>All Status</SelectItem>
              {[
                "Pending",
                "Processing",
                "Approved",
                "Completed",
                "Cancelled",
              ].map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={onCreate}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" /> Create WO
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>WO No</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Grand Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-64">Action</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {workOrders.map((w, i) => (
                <TableRow key={w._id || i}>
                  <TableCell>{(page - 1) * limit + i + 1}</TableCell>
                  <TableCell>{w.workOrderNo}</TableCell>
                  <TableCell>{w.subject}</TableCell>
                  <TableCell>
                    {w.supplier && typeof w.supplier !== "string"
                      ? (w.supplier as any).supplierName ||
                        (w.supplier as any).name
                      : ((w.supplier as any)?.supplierName ?? "-")}
                  </TableCell>
                  <TableCell>
                    {w.issueDate
                      ? new Date(w.issueDate).toLocaleDateString()
                      : "-"}
                  </TableCell>
                  <TableCell>{formatCurrency(w.grandTotal)}</TableCell>
                  <TableCell>
                    <StatusBadge status={w.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onView(w)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEdit(w)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => onDelete(w._id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>

                      {/* Approve / Process / Complete / Cancel */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => updateStatus(w, "Processing")}
                        disabled={w.status !== "Pending"}
                        title="Start Processing"
                      >
                        <Check className="w-4 h-4" />
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatus(w, "Approved")}
                        disabled={w.status !== "Processing"}
                        title="Approve"
                      >
                        Approve
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => updateStatus(w, "Completed")}
                        disabled={w.status !== "Approved"}
                        title="Mark Completed"
                      >
                        ✅
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const reason = prompt("Cancel reason (optional):");
                          updateStatus(w, "Cancelled", reason ?? undefined);
                        }}
                        disabled={
                          w.status === "Completed" || w.status === "Cancelled"
                        }
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {workOrders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-6">
                    {loading ? "Loading..." : "No work orders found"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="p-4 flex items-center justify-between border-t">
          <div className="text-sm text-muted-foreground">
            Showing {(page - 1) * limit + 1} - {Math.min(page * limit, total)}{" "}
            of {total}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="border rounded px-2 py-1"
            >
              {[10, 15, 25, 50].map((l) => (
                <option key={l} value={l}>
                  {l}/page
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1">
              <Button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Prev
              </Button>
              <div className="px-3">
                {page} / {totalPages}
              </div>
              <Button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* VIEW DIALOG */}
      {viewing && (
        <WorkOrderViewDialog viewing={viewing} setViewing={setViewing} />
      )}

      {/* EDIT / CREATE DIALOG (kept relatively compact) */}

      {openEdit && (
        <WorkOrderAddEditDialog
          openEdit={openEdit}
          setOpenEdit={setOpenEdit}
          form={form}
          setForm={setForm}
          editing={editing}
          setEditing={setEditing}
          suppliers={suppliers}
          warehouses={warehouses}
          StatusBadge={StatusBadge}
          loadWorkOrders={loadWorkOrders}
        />
      )}
    </div>
  );
}
