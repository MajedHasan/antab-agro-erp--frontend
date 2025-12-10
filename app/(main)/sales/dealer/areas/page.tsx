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
type RegionObj = { _id: string; name: string; zone: string };
type Region = string | RegionObj;
type Area = {
  _id?: string;
  name: string;
  region: Region; // accept id or populated object
  description?: string;
};

const NONE = "none";

function getId(v?: string | { _id: string } | null) {
  if (!v) return "";
  if (typeof v === "string") return v;
  return (v as any)._id;
}

export default function AreasPage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [tableRegions, setTableRegions] = useState<RegionObj[]>([]);
  const [modalRegions, setModalRegions] = useState<RegionObj[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [total, setTotal] = useState(0);

  const [q, setQ] = useState("");

  const [filterZone, setFilterZone] = useState<string | null>(null);
  const [filterRegion, setFilterRegion] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Area | null>(null);

  const [selectedModalZone, setSelectedModalZone] = useState<string>(NONE);

  // form.region is always stored as an id string for simplicity
  const [form, setForm] = useState<{
    name: string;
    region: string;
    description?: string;
  }>({
    name: "",
    region: "",
    description: "",
  });

  // bulk creation
  const [bulkMode, setBulkMode] = useState(false);

  const [bulkAreas, setBulkAreas] = useState<
    { name: string; description?: string }[]
  >([{ name: "", description: "" }]);

  // map helpers (use id strings)
  const regionMap = Object.fromEntries(tableRegions.map((r) => [r._id, r]));

  /** ------------------------
   * LOADERS
   -------------------------*/

  const loadZones = async () => {
    try {
      const res = await api.get("/zones", { params: { limit: 1000 } });
      setZones(res.data.data || []);
    } catch {
      toast.error("Failed to load zones");
    }
  };

  const loadTableRegions = async (zone?: string | null) => {
    try {
      const params: any = { limit: 1000 };
      if (zone) params.zone = zone;

      const res = await api.get("/regions", { params });
      setTableRegions(res.data.data || []);
    } catch {
      toast.error("Failed to load regions");
    }
  };

  const loadModalRegions = async (zone?: string | null) => {
    try {
      const params: any = { limit: 1000 };
      if (zone) params.zone = zone;

      const res = await api.get("/regions", { params });
      setModalRegions(res.data.data || []);
    } catch {
      toast.error("Failed to load modal regions");
    }
  };

  /** ------------------------
   * TABLE FETCH
   -------------------------*/

  const fetch = async () => {
    try {
      setLoading(true);

      const params: any = { page, limit, q };

      // If zone filter is applied, convert it into region filter
      if (filterZone) {
        // find all regions in that zone
        const regionsInZone = tableRegions
          .filter((r) => r.zone === filterZone)
          .map((r) => r._id);
        if (regionsInZone.length) params.region = regionsInZone;
      }

      // individual region filter (overrides zone)
      if (filterRegion) params.region = filterRegion;

      const res = await api.get("/areas?limit=100", { params });
      setAreas(res.data.data || []);
      setTotal(res.data.total ?? 0);
    } catch {
      toast.error("Failed to load areas");
    } finally {
      setLoading(false);
    }
  };

  /** ------------------------
   * EFFECTS
   -------------------------*/

  useEffect(() => {
    loadZones();
    loadTableRegions(); // load all regions initially
  }, []);

  useEffect(() => {
    loadTableRegions(filterZone);
    fetch(); // <-- ensure areas reload when zone filter changes
  }, [filterZone]);

  useEffect(() => {
    fetch();
  }, [page, limit, q, filterZone, filterRegion]);

  /** ------------------------
   * OPEN MODAL (CREATE)
   -------------------------*/

  const onCreate = () => {
    setEditing(null);
    setForm({
      name: "",
      region: "",
      description: "",
    });

    setSelectedModalZone(NONE);
    setModalRegions([]);

    setOpen(true);
  };

  /** ------------------------
   * OPEN MODAL (EDIT)
   -------------------------*/

  const onEdit = async (a: Area) => {
    setEditing(a);

    const regionRaw = a.region as any;
    const regionId = getId(regionRaw);

    // region can be:
    // 1) id string
    // 2) populated object with zone as id
    // 3) populated object with zone as object
    const regionObj =
      regionMap[regionId] || (typeof regionRaw === "object" ? regionRaw : null);

    const zoneId = regionObj?.zone?._id || regionObj?.zone || NONE;

    setSelectedModalZone(zoneId);
    await loadModalRegions(zoneId === NONE ? null : zoneId);

    setForm({
      name: a.name,
      region: regionId,
      description: a.description || "",
    });

    setOpen(true);
  };

  /** ------------------------
   * SUBMIT
   -------------------------*/

  // const onSubmit = async (ev?: React.FormEvent) => {
  //   ev?.preventDefault();

  //   if (!form.name || !form.region)
  //     return toast.error("Name & Region required");

  //   try {
  //     const payload = {
  //       name: form.name,
  //       region: form.region, // send id to server
  //       description: form.description,
  //     };

  //     if (editing?._id) await api.put(`/areas/${editing._id}`, payload);
  //     else await api.post("/areas", payload);

  //     toast.success("Saved");
  //     setOpen(false);
  //     fetch();
  //   } catch {
  //     toast.error("Save failed");
  //   }
  // };

  const onSubmit = async (ev?: React.FormEvent) => {
    ev?.preventDefault();

    if (!selectedModalZone || selectedModalZone === NONE)
      return toast.error("Zone required");

    if (!form.region) return toast.error("Region required");

    try {
      if (bulkMode) {
        // --------------------------
        // BULK CREATE USING A LOOP
        // --------------------------
        const items = bulkAreas
          .filter((a) => a.name.trim().length > 0)
          .map((a) => ({
            name: a.name,
            description: a.description,
            region: form.region,
          }));

        if (items.length === 0) return toast.error("Add at least one area");

        for (const item of items) {
          await api.post("/areas", item);
        }

        toast.success(`Created ${items.length} areas`);
      } else {
        // --------------------------
        // SINGLE CREATE / EDIT MODE
        // --------------------------
        const payload = {
          name: form.name,
          region: form.region,
          description: form.description,
        };

        if (editing?._id) {
          await api.put(`/areas/${editing._id}`, payload);
        } else {
          await api.post("/areas", payload);
        }

        toast.success("Saved");
      }

      setOpen(false);
      fetch();
    } catch (err) {
      console.error(err);
      toast.error("Save failed");
    }
  };

  /** ------------------------
   * DELETE
   -------------------------*/

  const onDelete = async (id?: string) => {
    if (!id) return;
    if (!confirm("Delete area?")) return;

    try {
      await api.delete(`/areas/${id}`);
      toast.success("Deleted");
      fetch();
    } catch {
      toast.error("Delete failed");
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  /** ------------------------
   * RENDER
   -------------------------*/

  return (
    <div className="p-4 space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Areas</h2>
          <p className="text-sm text-muted-foreground">
            Areas belong to Regions
          </p>
        </div>

        {/* SEARCH + FILTERS */}
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded px-2 py-1 gap-2">
            <Search className="w-4 h-4 text-gray-500" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search areas..."
            />
          </div>

          {/* Filter Zone */}
          <Select
            value={filterZone ?? NONE}
            onValueChange={(v) => {
              if (v === NONE) {
                setFilterZone(null);
                setFilterRegion(null);
                setPage(1);
              } else {
                setFilterZone(v);
                setFilterRegion(null);
                setPage(1);
              }
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by Zone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>All Zones</SelectItem>
              {zones.map((z) => (
                <SelectItem key={z._id} value={z._id}>
                  {z.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filter Region */}
          <Select
            value={filterRegion ?? NONE}
            onValueChange={(v) => {
              setFilterRegion(v === NONE ? null : v);
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by Region" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>All Regions</SelectItem>
              {tableRegions.map((r) => (
                <SelectItem key={r._id} value={r._id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={onCreate}>
            <Plus className="w-4 h-4 mr-2" />
            New Area
          </Button>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-40">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {areas.map((a, i) => {
                // regionId may be string or object._id
                const regionId = getId(a.region as any);
                const regionName =
                  tableRegions.find((r) => r._id === regionId)?.name || "--";
                return (
                  <TableRow key={a._id || i}>
                    <TableCell>{(page - 1) * limit + i + 1}</TableCell>
                    <TableCell>{a.name}</TableCell>
                    <TableCell>{regionName}</TableCell>
                    <TableCell>{a.description}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onEdit(a)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => onDelete(a._id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}

              {areas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6">
                    {loading ? "Loading..." : "No areas found"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* PAGINATION */}
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

      {/* MODAL */}
      <Dialog
        open={open}
        onOpenChange={(isOpen) => {
          setOpen(isOpen);

          if (!isOpen) {
            // Reset everything when modal closes
            setEditing(null);
            setForm({ name: "", region: "", description: "" });

            setBulkMode(false);
            setBulkAreas([{ name: "", description: "" }]);

            setSelectedModalZone(NONE);
            setModalRegions([]);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto space-y-4">
          {/* Title */}
          <h3 className="text-xl font-semibold">
            {editing ? "Edit Area" : "New Area"}
          </h3>

          {/* Bulk Mode Switch */}
          <div className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
            <div className="flex flex-col">
              <span className="font-medium text-sm">Bulk Creation Mode</span>
              <span className="text-xs text-muted-foreground">
                Add multiple areas under the same region
              </span>
            </div>

            <Switch checked={bulkMode} onCheckedChange={setBulkMode} />
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {/* ZONE */}
            <div>
              <label className="text-sm font-medium">Zone</label>
              <Select
                value={selectedModalZone}
                onValueChange={async (v) => {
                  setSelectedModalZone(v);

                  await loadModalRegions(v === NONE ? null : v);

                  // Clear region selection when zone changes
                  setForm({ ...form, region: "" });
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select zone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Choose zone</SelectItem>
                  {zones.map((z) => (
                    <SelectItem key={z._id} value={z._id}>
                      {z.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* REGION */}
            <div>
              <label className="text-sm font-medium">Region</label>
              <Select
                value={form.region || NONE}
                onValueChange={(v) =>
                  setForm({ ...form, region: v === NONE ? "" : v })
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Choose region</SelectItem>

                  {modalRegions.map((r) => (
                    <SelectItem key={r._id} value={r._id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ----------------------- */}
            {/* BULK CREATION MODE UI */}
            {/* ----------------------- */}
            {bulkMode && (
              <div className="space-y-4 border rounded-lg p-4 bg-gray-50 max-h-80 overflow-y-auto">
                {bulkAreas.map((row, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center"
                  >
                    <Input
                      placeholder="Area name"
                      value={row.name}
                      onChange={(e) => {
                        const copy = [...bulkAreas];
                        copy[index].name = e.target.value;
                        setBulkAreas(copy);
                      }}
                      className="md:col-span-2"
                    />

                    <Input
                      placeholder="Description"
                      value={row.description}
                      onChange={(e) => {
                        const copy = [...bulkAreas];
                        copy[index].description = e.target.value;
                        setBulkAreas(copy);
                      }}
                      className="md:col-span-2"
                    />

                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() =>
                        setBulkAreas((prev) =>
                          prev.filter((_, i) => i !== index)
                        )
                      }
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setBulkAreas((prev) => [
                      ...prev,
                      { name: "", description: "" },
                    ])
                  }
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Row
                </Button>
              </div>
            )}

            {/* ----------------------- */}
            {/* SINGLE MODE UI */}
            {/* ----------------------- */}
            {!bulkMode && (
              <>
                {/* NAME */}
                <div>
                  <label className="text-sm font-medium">Name</label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="mt-1"
                  />
                </div>

                {/* DESCRIPTION */}
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Input
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                    className="mt-1"
                  />
                </div>
              </>
            )}

            {/* FOOTER */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>

              <Button type="submit">
                {bulkMode ? "Create All" : editing ? "Save" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
