"use client";

import React, { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button"; // adjust if your shadcn setup differs
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trash2, Edit, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";

type Zone = {
  _id?: string;
  name: string;
  description?: string;
};

export default function ZonesPage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  // form
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Zone | null>(null);
  const [form, setForm] = useState<Zone>({ name: "", description: "" });

  const fetch = async () => {
    try {
      setLoading(true);
      const res = await api.get("/zones", {
        params: { page, limit, q },
      });
      setZones(res.data.data || res.data.data || []);
      setTotal(res.data.total ?? res.data.total ?? 0);
    } catch (e) {
      toast.error("Failed to load zones");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
  }, [page, limit, q]);

  const onOpenCreate = () => {
    setEditing(null);
    setForm({ name: "", description: "" });
    setOpen(true);
  };

  const onEdit = (z: Zone) => {
    setEditing(z);
    setForm({ name: z.name, description: z.description });
    setOpen(true);
  };

  const onSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    try {
      if (!form.name.trim()) return toast.error("Name required");
      if (editing?._id) {
        const res = await api.put(`/zones/${editing._id}`, form);
        toast.success("Zone updated");
      } else {
        const res = await api.post("/zones", form);
        toast.success("Zone created");
      }
      setOpen(false);
      fetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Save failed");
    }
  };

  const onDelete = async (id?: string) => {
    if (!id) return;
    if (!confirm("Delete zone?")) return;
    try {
      await api.delete(`/zones/${id}`);
      toast.success("Deleted");
      fetch();
    } catch {
      toast.error("Delete failed");
    }
  };

  const exportCSV = async () => {
    try {
      const res = await api.get("/zones/export", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "zones.csv";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Export failed");
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Zones</h2>
          <p className="text-sm text-muted-foreground">
            Manage geographic zones
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-md px-2 py-1 gap-2">
            <Search className="w-4 h-4 text-gray-500" />
            <Input
              value={q}
              placeholder="Search name..."
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              className="border-0 p-0"
            />
          </div>

          <Button onClick={onOpenCreate} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Zone
          </Button>

          <Button variant="secondary" onClick={exportCSV}>
            Export CSV
          </Button>
        </div>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-40">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {zones.map((z, i) => (
                <TableRow key={z._id || i}>
                  <TableCell>{(page - 1) * limit + i + 1}</TableCell>
                  <TableCell>{z.name}</TableCell>
                  <TableCell>{z.description}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEdit(z)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => onDelete(z._id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {zones.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-6">
                    {loading ? "Loading..." : "No zones found"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

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
              {editing?._id ? "Edit Zone" : "New Zone"}
            </h3>
            <div>
              <label className="text-sm">Name</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm">Description</label>
              <Input
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
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
    </div>
  );
}
