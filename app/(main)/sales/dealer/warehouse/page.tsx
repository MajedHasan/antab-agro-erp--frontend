"use client";

import React, { useEffect, useState } from "react";
import api from "@/lib/api";
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
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Trash2, Edit, Plus, Search, User, ChevronDown } from "lucide-react";
import { toast } from "sonner";

/**
 * Small UI helpers (replace with your Avatar/Badge components if you have them)
 */
function Avatar({ name, img }: { name: string; img?: string }) {
  const initials = name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return img ? (
    // image avatar
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={img}
      alt={name}
      className="w-8 h-8 rounded-full object-cover border"
    />
  ) : (
    <div className="w-8 h-8 rounded-full bg-gray-100 text-sm text-gray-700 flex items-center justify-center border">
      {initials}
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const s = status ?? "Inactive";
  const cls =
    s === "Active"
      ? "bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-xs"
      : "bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full text-xs";
  return <span className={cls}>{s}</span>;
}

type UserShort = {
  _id: string;
  name: string;
  email?: string;
  profileImageUrl?: string;
};

type Warehouse = {
  _id?: string;
  name: string;
  code: string;
  address?: string;
  status?: string;
  notes?: string;
  assignedUsers?: UserShort[]; // populated
};

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  // create/edit modal
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [form, setForm] = useState<Warehouse>({
    name: "",
    code: "",
    address: "",
    notes: "",
    status: "Active",
    assignedUsers: [],
  });

  // assigned users modal
  const [assignedOpen, setAssignedOpen] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(
    null
  );
  const [assignedLoading, setAssignedLoading] = useState(false);

  const fetch = async () => {
    try {
      setLoading(true);
      const res = await api.get("/warehouses", {
        params: { page, limit, q },
      });

      // your backend returns { data, total, page, limit } per createCrudController
      setWarehouses(res.data.data || []);
      setTotal(res.data.total ?? 0);
    } catch (e) {
      toast.error("Failed to load warehouses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
  }, [page, limit, q]);

  const onOpenCreate = () => {
    setEditing(null);
    setForm({
      name: "",
      code: "",
      address: "",
      notes: "",
      status: "Active",
      assignedUsers: [],
    });
    setOpen(true);
  };

  const onEdit = (w: Warehouse) => {
    setEditing(w);
    setForm({
      name: w.name,
      code: w.code,
      address: w.address || "",
      notes: w.notes || "",
      status: w.status || "Active",
      assignedUsers: w.assignedUsers || [],
    });
    setOpen(true);
  };

  const onSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!form.name?.trim()) return toast.error("Name required");
    if (!form.code?.trim()) return toast.error("Code required");

    try {
      if (editing?._id) {
        await api.put(`/warehouses/${editing._id}`, form);
        toast.success("Warehouse updated");
      } else {
        await api.post("/warehouses", form);
        toast.success("Warehouse created");
      }
      setOpen(false);
      fetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Save failed");
    }
  };

  const onDelete = async (id?: string) => {
    if (!id) return;
    if (!confirm("Delete warehouse?")) return;
    try {
      await api.delete(`/warehouses/${id}`);
      toast.success("Deleted");
      fetch();
    } catch {
      toast.error("Delete failed");
    }
  };

  const exportCSV = async () => {
    try {
      const res = await api.get("/warehouses/export", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "warehouses.csv";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Export failed");
    }
  };

  const toggleStatus = async (w: Warehouse) => {
    if (!w._id) return;
    const newStatus = w.status === "Active" ? "Inactive" : "Active";
    try {
      await api.put(`/warehouses/${w._id}`, { status: newStatus });
      toast.success(`Warehouse ${newStatus}`);
      // optimistic update locally
      setWarehouses((prev) =>
        prev.map((p) => (p._id === w._id ? { ...p, status: newStatus } : p))
      );
    } catch {
      toast.error("Failed to update status");
      fetch();
    }
  };

  const openAssignedModal = async (w: Warehouse) => {
    setSelectedWarehouse(w);
    setAssignedOpen(true);

    // optional: refresh assigned list from backend
    try {
      setAssignedLoading(true);
      const res = await api.get(`/warehouses/${w._id}/users`);
      const users = res.data.data || [];
      setSelectedWarehouse((prev) =>
        prev ? { ...prev, assignedUsers: users } : prev
      );
    } catch {
      // ignore - we already have assignedUsers in list
    } finally {
      setAssignedLoading(false);
    }
  };

  const removeAssignedUser = async (warehouseId: string, userId: string) => {
    if (!confirm("Remove user from warehouse?")) return;
    try {
      // route: DELETE /warehouses/:id/remove-user/:userId
      await api.delete(`/warehouses/${warehouseId}/remove-user/${userId}`);
      toast.success("User removed");

      // refresh both selected modal and table list
      if (selectedWarehouse?._id === warehouseId) {
        setSelectedWarehouse((prev) =>
          prev
            ? {
                ...prev,
                assignedUsers: prev.assignedUsers?.filter(
                  (u) => u._id !== userId
                ),
              }
            : prev
        );
      }
      fetch();
    } catch {
      toast.error("Failed to remove user");
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Warehouses</h2>
          <p className="text-sm text-muted-foreground">
            Manage warehouses and assigned users
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center border rounded-md px-2 py-1 gap-2">
            <Search className="w-4 h-4 text-gray-500" />
            <Input
              value={q}
              placeholder="Search name or code..."
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              className="border-0 p-0"
            />
          </div>

          <Button onClick={onOpenCreate} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Warehouse
          </Button>

          <Button variant="secondary" onClick={exportCSV}>
            Export CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Address</TableHead>
                <TableHead className="w-44">Assigned Users</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-40">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {warehouses.map((w, i) => (
                <TableRow key={w._id || i}>
                  <TableCell>{(page - 1) * limit + i + 1}</TableCell>

                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-medium">{w.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {w.notes}
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="text-sm">{w.code}</TableCell>
                  <TableCell className="text-sm">{w.address}</TableCell>

                  {/* Assigned users - avatars */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {w.assignedUsers && w.assignedUsers.length > 0 ? (
                        <>
                          <div className="flex -space-x-2">
                            {w.assignedUsers.slice(0, 4).map((u) => (
                              <div
                                key={u._id}
                                title={u.name}
                                className="relative z-10"
                                onClick={() => openAssignedModal(w)}
                                style={{ cursor: "pointer" }}
                              >
                                <Avatar name={u.name} img={u.profileImageUrl} />
                              </div>
                            ))}
                          </div>

                          {w.assignedUsers.length > 4 && (
                            <button
                              className="ml-2 text-xs text-muted-foreground inline-flex items-center gap-1"
                              onClick={() => openAssignedModal(w)}
                            >
                              +{w.assignedUsers.length - 4} more{" "}
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          )}

                          {/* Quick manage */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openAssignedModal(w)}
                            className="ml-2"
                          >
                            <User className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          No users
                        </div>
                      )}
                    </div>
                  </TableCell>

                  {/* Status with badge + switch-like button */}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={w.status} />
                      <button
                        onClick={() => toggleStatus(w)}
                        className="ml-1 inline-flex items-center gap-2 px-2 py-1 rounded-md border text-sm"
                        title={
                          w.status === "Active" ? "Deactivate" : "Activate"
                        }
                      >
                        {/* simple toggle UI */}
                        <span
                          className={`w-6 h-3 rounded-full inline-block relative ${
                            w.status === "Active"
                              ? "bg-green-400"
                              : "bg-gray-300"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-2 h-2 rounded-full bg-white shadow transform ${
                              w.status === "Active" ? "translate-x-3" : ""
                            }`}
                          />
                        </span>
                      </button>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex gap-2">
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
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {warehouses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6">
                    {loading ? "Loading..." : "No warehouses found"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between p-4 border-t">
          <div>
            <span className="text-sm text-muted-foreground">
              Showing {(page - 1) * limit + 1} - {Math.min(page * limit, total)}{" "}
              of {total}
            </span>
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
                  {l} / page
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

      {/* Create / Edit Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <h3 className="text-lg font-semibold">
              {editing?._id ? "Edit Warehouse" : "New Warehouse"}
            </h3>

            <div>
              <label className="text-sm">Name</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm">Code</label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm">Address</label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm">Notes</label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="border rounded px-2 py-1 w-full"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editing?._id ? "Save changes" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assigned Users Modal */}
      <Dialog open={assignedOpen} onOpenChange={setAssignedOpen}>
        <DialogContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Assigned Users</h3>
              <div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    // you can navigate to a dedicated assign page if you have one
                    // router.push(`/warehouses/${selectedWarehouse?._id}/assign`);
                  }}
                >
                  Manage
                </Button>
              </div>
            </div>

            {assignedLoading ? (
              <div>Loading…</div>
            ) : (
              <div className="space-y-2">
                {(selectedWarehouse?.assignedUsers || []).length === 0 && (
                  <div className="text-sm text-muted-foreground">
                    No users assigned
                  </div>
                )}

                {(selectedWarehouse?.assignedUsers || []).map((u) => (
                  <div
                    key={u._id}
                    className="flex items-center justify-between gap-3 border rounded p-2"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name} img={u.profileImageUrl} />
                      <div>
                        <div className="text-sm font-medium">{u.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {u.email}
                        </div>
                      </div>
                    </div>

                    <div>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          selectedWarehouse &&
                          removeAssignedUser(
                            selectedWarehouse._id!,
                            u._1 || u._id
                          )
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="ghost" onClick={() => setAssignedOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
