"use client";

import React, { useEffect, useState } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Edit, Trash2, Search } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

type Zone = { _id: string; name: string };
type Region = {
  _id?: string;
  name: string;
  zone: string | { _id: string; name: string };
  description?: string;
};

export default function RegionsPage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [filterZone, setFilterZone] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Region | null>(null);
  const [form, setForm] = useState<Region>({
    name: "",
    zone: "",
    description: "",
  });

  const [bulkMode, setBulkMode] = useState(false);
  const [bulkRegions, setBulkRegions] = useState([
    { name: "", description: "" },
  ]);

  const loadZones = async () => {
    try {
      const res = await api.get("/zones", { params: { limit: 1000 } });
      setZones(res.data.data || []);
    } catch {
      toast.error("Failed to load zones");
    }
  };

  const fetch = async () => {
    try {
      setLoading(true);
      const params: any = { page, limit, q };
      if (filterZone) params.zone = filterZone;
      const res = await api.get("/regions", { params });
      setRegions(res.data.data || []);
      setTotal(res.data.total ?? 0);
    } catch {
      toast.error("Failed to load regions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadZones();
  }, []);

  useEffect(() => {
    fetch();
  }, [page, limit, q, filterZone]);

  const onCreate = () => {
    setEditing(null);
    setForm({ name: "", zone: zones[0]?._id || "", description: "" });
    setOpen(true);
  };

  const onEdit = (r: Region) => {
    const zoneId = typeof r.zone === "string" ? r.zone : r.zone?._id;

    setEditing(r);
    setForm({
      name: r.name,
      zone: zoneId,
      description: r.description || "",
    });
    setOpen(true);
  };

  const onSubmit = async (ev?: React.FormEvent) => {
    ev?.preventDefault();
    try {
      if (!form.name || !form.zone) return toast.error("Name & Zone required");
      if (editing?._id) {
        await api.put(`/regions/${editing._id}`, form);
        toast.success("Updated");
      } else {
        await api.post("/regions", form);
        toast.success("Created");
      }
      setOpen(false);
      fetch();
    } catch {
      toast.error("Failed to save");
    }
  };

  const onBulSubmit = async (e?: React.FormEvent) => {
    e.preventDefault();

    if (!form.zone) return toast.error("Select a zone first");

    if (bulkRegions.some((r) => !r.name.trim())) {
      return toast.error("Every region row must have a name");
    }

    try {
      for (const region of bulkRegions) {
        await api.post("/regions", {
          name: region.name,
          description: region.description,
          zone: form.zone,
        });
      }

      toast.success("Regions created successfully");
      setOpen(false);
      fetch();
    } catch {
      toast.error("Failed to create some regions");
    }
  };

  const onDelete = async (id?: string) => {
    if (!id) return;
    if (!confirm("Delete region?")) return;
    try {
      await api.delete(`/regions/${id}`);
      toast.success("Deleted");
      fetch();
    } catch {
      toast.error("Delete failed");
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Regions</h2>
          <p className="text-sm text-muted-foreground">
            Each region belongs to a zone
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded px-2 py-1 gap-2">
            <Search className="w-4 h-4 text-gray-500" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search regions..."
            />
          </div>

          <Select
            value={filterZone ?? "all"}
            onValueChange={(v) => {
              // setFilterZone(v || null);
              setFilterZone(v === "all" ? null : v);
              setPage(1);
            }}
            // value={filterZone || ""}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Filter by Zone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Zones</SelectItem>
              {zones.map((z) => (
                <SelectItem key={z._id} value={z._id}>
                  {z.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={onCreate}>
            <Plus className="w-4 h-4 mr-2" />
            New Region
          </Button>
        </div>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-40">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {regions.map((r, i) => (
                <TableRow key={r._id || i}>
                  <TableCell>{(page - 1) * limit + i + 1}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>
                    {/* populated zone name may be in r.zone if defaultPopulate used */}{" "}
                    {zones.find(
                      (z) =>
                        z._id ===
                        (typeof r.zone === "string" ? r.zone : r.zone._id)
                    )?.name || ""}
                  </TableCell>
                  <TableCell>{r.description}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEdit(r)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => onDelete(r._id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {regions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6">
                    {loading ? "Loading..." : "No regions found"}
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

      {/* <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <h3 className="text-lg font-semibold">
              {editing?._id ? "Edit Region" : "New Region"}
            </h3>
            <div>
              <label className="text-sm">Name</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm">Zone</label>
              <Select
                value={
                  typeof form.zone === "string" ? form.zone : form.zone?._id
                }
                onValueChange={(v) => setForm({ ...form, zone: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select zone" />
                </SelectTrigger>
                <SelectContent>
                  {zones.map((z) => (
                    <SelectItem key={z._id} value={z._id}>
                      {z.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editing?._id ? "Save" : "Create"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog> */}

      <Dialog
        open={open}
        // onOpenChange={setOpen}
        onOpenChange={(isOpen) => {
          setOpen(isOpen);

          if (!isOpen) {
            // Reset all state when modal closes
            setEditing(null);
            setBulkMode(false);
            setBulkRegions([{ name: "", description: "" }]);
            setForm({ name: "", zone: zones[0]?._id || "", description: "" });
          }
        }}
      >
        <DialogContent
          className="
      max-h-[90vh]
      overflow-y-auto
      p-0 
      rounded-xl 
      border 
      shadow-2xl 
      bg-gradient-to-b from-white to-gray-50
      animate-in fade-in zoom-in duration-200
    "
        >
          {/* HEADER */}
          <div className="px-6 py-4 border-b bg-white sticky top-0 z-10">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              {editing?._id ? "Edit Region" : "Create Regions"}
            </h2>
            {!editing && (
              <div className="flex items-center justify-between mt-3 p-3 border rounded-lg bg-gray-50">
                <div className="flex flex-col">
                  <span className="font-medium text-sm">
                    Bulk Creation Mode
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Add multiple regions under the same zone
                  </span>
                </div>

                <Switch checked={bulkMode} onCheckedChange={setBulkMode} />
              </div>
            )}
          </div>

          {/* CONTENT */}
          <div className="px-6 py-5 space-y-6">
            {/* =======================
          SINGLE REGION MODE
      ======================== */}
            {!bulkMode && (
              <form onSubmit={onSubmit} className="space-y-5">
                {/* Region Name */}
                <div className="space-y-1.5">
                  <label className="font-medium text-sm">Region Name</label>
                  <Input
                    className="h-11"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>

                {/* Zone */}
                <div className="space-y-1.5">
                  <label className="font-medium text-sm">Zone</label>
                  <Select
                    value={
                      typeof form.zone === "string" ? form.zone : form.zone?._id
                    }
                    onValueChange={(v) => setForm({ ...form, zone: v })}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select zone" />
                    </SelectTrigger>
                    <SelectContent>
                      {zones.map((z) => (
                        <SelectItem key={z._id} value={z._id}>
                          {z.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="font-medium text-sm">Description</label>
                  <Input
                    className="h-11"
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button variant="ghost" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="px-6">
                    {editing?._id ? "Save Changes" : "Create"}
                  </Button>
                </div>
              </form>
            )}

            {/* =======================
          BULK CREATION MODE
      ======================== */}
            {!editing && bulkMode && (
              <form onSubmit={onBulSubmit} className="space-y-6">
                {/* Zone */}
                <div className="space-y-1.5">
                  <label className="font-medium text-sm">Zone</label>
                  <Select
                    value={form.zone}
                    onValueChange={(v) => setForm({ ...form, zone: v })}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select zone" />
                    </SelectTrigger>
                    <SelectContent>
                      {zones.map((z) => (
                        <SelectItem key={z._id} value={z._id}>
                          {z.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Bulk list */}
                <div
                  className="
              space-y-4 
              max-h-[55vh] 
              overflow-y-auto 
              pr-1
            "
                >
                  {bulkRegions.map((row, index) => (
                    <div
                      key={index}
                      className="
                  p-4 
                  bg-white 
                  rounded-lg 
                  border 
                  shadow-sm 
                  hover:shadow-md 
                  transition 
                  grid grid-cols-12 gap-3
                "
                    >
                      <div className="col-span-5 space-y-1.5">
                        <label className="text-xs font-medium">
                          Region Name
                        </label>
                        <Input
                          className="h-10"
                          placeholder="Name"
                          value={row.name}
                          onChange={(e) => {
                            const copy = [...bulkRegions];
                            copy[index].name = e.target.value;
                            setBulkRegions(copy);
                          }}
                        />
                      </div>

                      <div className="col-span-5 space-y-1.5">
                        <label className="text-xs font-medium">
                          Description
                        </label>
                        <Input
                          className="h-10"
                          placeholder="Description"
                          value={row.description}
                          onChange={(e) => {
                            const copy = [...bulkRegions];
                            copy[index].description = e.target.value;
                            setBulkRegions(copy);
                          }}
                        />
                      </div>

                      <div className="col-span-2 flex justify-end items-end">
                        <Button
                          variant="destructive"
                          type="button"
                          className="w-full h-10"
                          onClick={() =>
                            setBulkRegions((prev) =>
                              prev.filter((_, i) => i !== index)
                            )
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add more */}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11"
                  onClick={() =>
                    setBulkRegions((prev) => [
                      ...prev,
                      { name: "", description: "" },
                    ])
                  }
                >
                  + Add another region
                </Button>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="px-6">
                    Create All
                  </Button>
                </div>
              </form>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
