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
type Region = { _id: string; name: string; zone: string };
type Area = { _id: string; name: string; region: string };
type Territory = {
  _id?: string;
  name: string;
  area: string;
  description?: string;
};

const NONE = "none";

export default function TerritoriesPage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");

  const [filterZone, setFilterZone] = useState<string | null>(null);
  const [filterRegion, setFilterRegion] = useState<string | null>(null);
  const [filterArea, setFilterArea] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Territory | null>(null);
  const [form, setForm] = useState<Territory>({
    name: "",
    area: "",
    description: "",
  });

  // Modal-specific state
  const [modalZone, setModalZone] = useState<string>(NONE);
  const [modalRegions, setModalRegions] = useState<Region[]>([]);
  const [modalRegion, setModalRegion] = useState<string>(NONE);
  const [modalAreas, setModalAreas] = useState<Area[]>([]);

  const [bulkMode, setBulkMode] = useState(false);

  const [bulkTerritories, setBulkTerritories] = useState([
    { name: "", description: "" },
  ]);

  /** ------------------------

* LOADERS
  -------------------------*/
  const loadZones = async () => {
    try {
      const res = await api.get("/zones?limit=200", {
        params: { limit: 1000 },
      });
      setZones(res.data.data || []);
    } catch {
      toast.error("Failed to load zones");
    }
  };

  const loadRegions = async (zoneId?: string | null) => {
    try {
      const params: any = { limit: 1000 };
      if (zoneId && zoneId !== NONE) params.zone = zoneId;
      const res = await api.get("/regions?limit=500", { params });
      setRegions(res.data.data || []);
    } catch {
      toast.error("Failed to load regions");
    }
  };

  const loadAreas = async (regionId?: string | null) => {
    try {
      const params: any = { limit: 1000 };
      if (regionId && regionId !== NONE) params.region = regionId;
      const res = await api.get("/areas?limit=500", { params });
      setAreas(res.data.data || []);
    } catch {
      toast.error("Failed to load areas");
    }
  };

  const loadModalRegions = async (zoneId?: string | null) => {
    try {
      const params: any = { limit: 1000 };
      if (zoneId && zoneId !== NONE) params.zone = zoneId;
      const res = await api.get("/regions?limit=500", { params });
      setModalRegions(res.data.data || []);
    } catch {
      toast.error("Failed to load modal regions");
    }
  };

  const loadModalAreas = async (regionId?: string | null) => {
    try {
      const params: any = { limit: 1000 };
      if (regionId && regionId !== NONE) params.region = regionId;
      const res = await api.get("/areas?limit=500", { params });
      setModalAreas(res.data.data || []);
    } catch {
      toast.error("Failed to load modal areas");
    }
  };

  /** ------------------------

* EFFECTS
  -------------------------*/
  useEffect(() => {
    loadZones();
    loadRegions();
  }, []);

  useEffect(() => {
    loadRegions(filterZone);
    setFilterRegion(null);
  }, [filterZone]);

  useEffect(() => {
    loadAreas(filterRegion);
    setFilterArea(null);
  }, [filterRegion]);

  useEffect(() => {
    fetch();
  }, [page, limit, q, filterZone, filterRegion, filterArea]);

  /** ------------------------

* FETCH TERRITORIES
  -------------------------*/
  const fetch = async () => {
    try {
      setLoading(true);
      const params: any = { page, limit, q };
      if (filterZone && filterZone !== NONE) params.zone = filterZone;
      if (filterRegion && filterRegion !== NONE) params.region = filterRegion;
      if (filterArea && filterArea !== NONE) params.area = filterArea;

      const res = await api.get("/territories?limit=1000", { params });
      setTerritories(res.data.data || []);
      setTotal(res.data.total ?? 0);
    } catch {
      toast.error("Failed to load territories");
    } finally {
      setLoading(false);
    }
  };

  /** ------------------------

* CREATE / EDIT
  -------------------------*/
  const onCreate = () => {
    setEditing(null);
    setModalZone(NONE);
    setModalRegion(NONE);
    setModalRegions([]);
    setModalAreas([]);
    setForm({ name: "", area: "", description: "" });
    setOpen(true);
  };

  const onEdit = async (t: Territory) => {
    setEditing(t);

    // Get area object from the form or areas list
    const areaObj =
      typeof t.area === "string" ? areas.find((a) => a._id === t.area) : t.area;

    // Get region object from the area
    const regionObj = areaObj && regions.find((r) => r._id === areaObj.region);

    // Zone ID from the region hierarchy
    const zoneId = regionObj?.zone?._id || NONE;
    const regionId = regionObj?._id || NONE;

    // Set modal state
    setModalZone(zoneId);
    await loadModalRegions(zoneId); // Load regions for this zone
    setModalRegion(regionId);
    await loadModalAreas(regionId); // Load areas for this region

    // Set form values
    setForm({
      name: t.name,
      area: areaObj?._id || "",
      description: t.description || "",
    });

    setOpen(true);
  };

  // const onSubmit = async (ev?: React.FormEvent) => {
  //   ev?.preventDefault();
  //   if (!form.name || !form.area) return toast.error("Name & Area required");

  //   try {
  //     if (editing?._id) await api.put(`/territories/${editing._id}`, form);
  //     else await api.post("/territories", form);

  //     toast.success("Saved");
  //     setOpen(false);
  //     fetch();
  //   } catch {
  //     toast.error("Save failed");
  //   }
  // };

  const onSubmit = async (ev?: React.FormEvent) => {
    ev?.preventDefault();

    if (!modalZone || modalZone === NONE) return toast.error("Zone required");

    if (!modalRegion || modalRegion === NONE)
      return toast.error("Region required");

    if (!form.area) return toast.error("Area required");

    try {
      if (bulkMode) {
        // --------------------------
        // BULK CREATION USING LOOP
        // --------------------------
        const items = bulkTerritories
          .filter((t) => t.name.trim().length > 0)
          .map((t) => ({
            name: t.name,
            description: t.description,
            area: form.area,
          }));

        if (items.length === 0)
          return toast.error("Add at least one territory");

        for (const item of items) {
          await api.post("/territories", item);
        }

        toast.success(`Created ${items.length} territories`);
      } else {
        // --------------------------
        // SINGLE CREATE / EDIT
        // --------------------------
        const payload = {
          name: form.name,
          description: form.description,
          area: form.area,
        };

        if (editing?._id) await api.put(`/territories/${editing._id}`, payload);
        else await api.post("/territories", payload);

        toast.success("Saved");
      }

      setOpen(false);
      fetch();
    } catch (err) {
      console.error(err);
      toast.error("Save failed");
    }
  };

  const onDelete = async (id?: string) => {
    if (!id) return;
    if (!confirm("Delete territory?")) return;
    try {
      await api.delete(`/territories/${id}`);
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
          <h2 className="text-2xl font-bold">Territories</h2>
          <p className="text-sm text-muted-foreground">
            Manage territories (belongs to area)
          </p>
        </div>

        {/* FILTERS */}

        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded px-2 py-1 gap-2">
            <Search className="w-4 h-4 text-gray-500" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search territories..."
            />
          </div>

          {/* Zone Filter */}
          <Select
            value={filterZone ?? NONE}
            onValueChange={(v) => setFilterZone(v === NONE ? null : v)}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Zone" />
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

          {/* Region Filter */}
          <Select
            value={filterRegion ?? NONE}
            onValueChange={(v) => setFilterRegion(v === NONE ? null : v)}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Region" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>All Regions</SelectItem>
              {regions.map((r) => (
                <SelectItem key={r._id} value={r._id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Area Filter */}
          <Select
            value={filterArea ?? NONE}
            onValueChange={(v) => setFilterArea(v === NONE ? null : v)}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Area" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>All Areas</SelectItem>
              {areas.map((a) => (
                <SelectItem key={a._id} value={a._id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={onCreate}>
            <Plus className="w-4 h-4 mr-2" />
            New Territory
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
                <TableHead>Area</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-40">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {territories.map((t, i) => (
                <TableRow key={t._id || i}>
                  <TableCell>{(page - 1) * limit + i + 1}</TableCell>
                  <TableCell>{t.name}</TableCell>
                  <TableCell>
                    {typeof t.area === "string"
                      ? areas.find((a) => a._id === t.area)?.name || ""
                      : t.area?.name || ""}
                  </TableCell>
                  <TableCell>{t.description}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEdit(t)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => onDelete(t._id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {territories.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6">
                    {loading ? "Loading..." : "No territories found"}
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
            setEditing(null);
            setModalZone(NONE);
            setModalRegion(NONE);
            setModalRegions([]);
            setModalAreas([]);
            setForm({ name: "", area: "", description: "" });

            setBulkMode(false);
            setBulkTerritories([{ name: "", description: "" }]);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto space-y-4">
          <h3 className="text-xl font-semibold">
            {editing ? "Edit Territory" : "New Territory"}
          </h3>

          {/* Bulk Mode Switch */}
          <div className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
            <div className="flex flex-col">
              <span className="font-medium text-sm">Bulk Creation Mode</span>
              <span className="text-xs text-muted-foreground">
                Add multiple territories under the same area
              </span>
            </div>

            <Switch checked={bulkMode} onCheckedChange={setBulkMode} />
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {/* ZONE */}
            <div>
              <label className="text-sm font-medium">Zone</label>
              <Select
                value={modalZone}
                onValueChange={async (v) => {
                  setModalZone(v);
                  setModalRegion(NONE);
                  setModalAreas([]);
                  setForm({ ...form, area: "" });
                  await loadModalRegions(v);
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select Zone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Choose Zone</SelectItem>
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
                value={modalRegion}
                onValueChange={async (v) => {
                  setModalRegion(v);
                  setForm({ ...form, area: "" });
                  await loadModalAreas(v);
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select Region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Choose Region</SelectItem>
                  {modalRegions.map((r) => (
                    <SelectItem key={r._id} value={r._id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* AREA */}
            <div>
              <label className="text-sm font-medium">Area</label>
              <Select
                value={form.area || NONE}
                onValueChange={(v) =>
                  setForm({ ...form, area: v === NONE ? "" : v })
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select Area" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Choose Area</SelectItem>
                  {modalAreas.map((a) => (
                    <SelectItem key={a._id} value={a._id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* BULK MODE */}
            {bulkMode && (
              <div className="space-y-4 border rounded-lg p-4 bg-gray-50 max-h-80 overflow-y-auto">
                {bulkTerritories.map((row, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center"
                  >
                    <Input
                      placeholder="Territory name"
                      value={row.name}
                      onChange={(e) => {
                        const copy = [...bulkTerritories];
                        copy[index].name = e.target.value;
                        setBulkTerritories(copy);
                      }}
                      className="md:col-span-2"
                    />

                    <Input
                      placeholder="Description"
                      value={row.description}
                      onChange={(e) => {
                        const copy = [...bulkTerritories];
                        copy[index].description = e.target.value;
                        setBulkTerritories(copy);
                      }}
                      className="md:col-span-2"
                    />

                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() =>
                        setBulkTerritories((prev) =>
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
                    setBulkTerritories((prev) => [
                      ...prev,
                      { name: "", description: "" },
                    ])
                  }
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Row
                </Button>
              </div>
            )}

            {/* SINGLE MODE */}
            {!bulkMode && (
              <>
                <div>
                  <label className="text-sm font-medium">Name</label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="mt-1"
                  />
                </div>

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
