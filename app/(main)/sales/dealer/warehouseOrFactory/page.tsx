"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  Trash2,
  Edit,
  Plus,
  Search,
  User,
  ChevronDown,
  RefreshCw,
  MapPin,
  Building2,
  Factory,
  Check,
} from "lucide-react";
import { toast } from "sonner";

function Avatar({ name, img }: { name: string; img?: string }) {
  const safeName = name || "User";
  const initials = safeName
    .split(" ")
    .filter(Boolean)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return img ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={img}
      alt={safeName}
      className="w-8 h-8 rounded-full object-cover border"
    />
  ) : (
    <div className="w-8 h-8 rounded-full bg-gray-100 text-sm text-gray-700 flex items-center justify-center border">
      {initials || "U"}
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

function TypeBadge({ type }: { type?: string }) {
  const t = (type || "Warehouse").toLowerCase();
  const cls =
    t === "factory"
      ? "bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs"
      : "bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full text-xs";
  return <span className={cls}>{type || "Warehouse"}</span>;
}

type RefLike = {
  _id?: string;
  id?: string;
  name?: string;
  code?: string;
  title?: string;
  label?: string;
};

type UserShort = {
  _id: string;
  name: string;
  email?: string;
  profileImageUrl?: string;
};

type WarehouseAddress = {
  zone?: RefLike | string | null;
  region?: RefLike | string | null;
  areas?: Array<RefLike | string>;
  territories?: Array<RefLike | string>;
};

type Warehouse = {
  _id?: string;
  name: string;
  code: string;
  type?: "Factory" | "Warehouse";
  address?: WarehouseAddress;
  status?: string;
  notes?: string;
  assignedUsers?: UserShort[];
};

type ZoneItem = {
  _id: string;
  name: string;
  description?: string;
};

type RegionItem = {
  _id: string;
  name: string;
  zone?: string | ZoneItem;
  description?: string;
};

type AreaItem = {
  _id: string;
  name: string;
  region?: string | RegionItem;
  description?: string;
};

type TerritoryItem = {
  _id: string;
  name: string;
  area?: string | AreaItem;
  description?: string;
};

type WarehouseForm = {
  name: string;
  code: string;
  type: "Factory" | "Warehouse";
  status: string;
  notes: string;
  address: {
    zone: string;
    region: string;
    areas: string[];
    territories: string[];
  };
};

const EMPTY_FORM: WarehouseForm = {
  name: "",
  code: "",
  type: "Warehouse",
  status: "Active",
  notes: "",
  address: {
    zone: "",
    region: "",
    areas: [],
    territories: [],
  },
};

function getId(value: any): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return String(value._id || value.id || "");
}

function getLabel(value: any): string {
  if (!value) return "-";
  if (typeof value === "string") return value;
  return (
    value.name || value.code || value.title || value.label || value._id || "-"
  );
}

function extractList(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.docs)) return payload.docs;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
}

function extractTotal(payload: any): number {
  return Number(payload?.total ?? payload?.count ?? 0);
}

function addressSummary(address?: WarehouseAddress) {
  const zone = getLabel(address?.zone);
  const region = getLabel(address?.region);
  const areas = Array.isArray(address?.areas)
    ? address!.areas!.map(getLabel).filter(Boolean).join(", ")
    : "";
  const territories = Array.isArray(address?.territories)
    ? address!.territories!.map(getLabel).filter(Boolean).join(", ")
    : "";

  return { zone, region, areas: areas || "-", territories: territories || "-" };
}

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [zoneFilter, setZoneFilter] = useState("ALL");
  const [regionFilter, setRegionFilter] = useState("ALL");

  const [zones, setZones] = useState<ZoneItem[]>([]);
  const [regions, setRegions] = useState<RegionItem[]>([]);
  const [areas, setAreas] = useState<AreaItem[]>([]);
  const [territories, setTerritories] = useState<TerritoryItem[]>([]);
  const [allUsers, setAllUsers] = useState<UserShort[]>([]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [form, setForm] = useState<WarehouseForm>(EMPTY_FORM);

  const [assignedOpen, setAssignedOpen] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(
    null,
  );
  const [assignedLoading, setAssignedLoading] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [assignSaving, setAssignSaving] = useState(false);

  const filteredRegions = useMemo(() => {
    if (form.address.zone) {
      return regions.filter((r) => getId(r.zone) === form.address.zone);
    }
    return regions;
  }, [regions, form.address.zone]);

  const filteredAreas = useMemo(() => {
    if (form.address.region) {
      return areas.filter((a) => getId(a.region) === form.address.region);
    }
    return areas;
  }, [areas, form.address.region]);

  const filteredTerritories = useMemo(() => {
    if (form.address.areas.length > 0) {
      return territories.filter((t) => {
        const areaId = getId(t.area);
        return form.address.areas.includes(areaId);
      });
    }
    return territories;
  }, [territories, form.address.areas]);

  const loadMasters = useCallback(async () => {
    try {
      const [zonesRes, regionsRes, areasRes, territoriesRes, usersRes] =
        await Promise.all([
          api.get("/zones", { params: { page: 1, limit: 2000 } }),
          api.get("/regions", { params: { page: 1, limit: 2000 } }),
          api.get("/areas", { params: { page: 1, limit: 2000 } }),
          api.get("/territories", { params: { page: 1, limit: 2000 } }),
          api.get("/users", { params: { page: 1, limit: 2000 } }),
        ]);

      setZones(extractList(zonesRes.data));
      setRegions(extractList(regionsRes.data));
      setAreas(extractList(areasRes.data));
      setTerritories(extractList(territoriesRes.data));
      setAllUsers(extractList(usersRes.data));
    } catch (e) {
      toast.error("Failed to load master data");
    }
  }, []);

  const fetchWarehouses = useCallback(async () => {
    try {
      setLoading(true);

      const params: Record<string, any> = { page, limit };

      if (q.trim()) params.q = q.trim();
      if (statusFilter !== "ALL") params.status = statusFilter;
      if (typeFilter !== "ALL") params.type = typeFilter;
      if (zoneFilter !== "ALL") params["address.zone"] = zoneFilter;
      if (regionFilter !== "ALL") params["address.region"] = regionFilter;

      const res = await api.get("/warehouses", { params });
      const payload = res.data;

      setWarehouses(extractList(payload));
      setTotal(extractTotal(payload));
    } catch (e) {
      toast.error("Failed to load warehouses");
    } finally {
      setLoading(false);
    }
  }, [page, limit, q, statusFilter, typeFilter, zoneFilter, regionFilter]);

  useEffect(() => {
    loadMasters();
  }, [loadMasters]);

  useEffect(() => {
    fetchWarehouses();
  }, [fetchWarehouses]);

  const resetForm = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const onOpenCreate = () => {
    resetForm();
    setOpen(true);
  };

  const onEdit = (w: Warehouse) => {
    setEditing(w);

    setForm({
      name: w.name || "",
      code: w.code || "",
      type: w.type || "Warehouse",
      status: w.status || "Active",
      notes: w.notes || "",
      address: {
        zone: getId(w.address?.zone),
        region: getId(w.address?.region),
        areas: Array.isArray(w.address?.areas)
          ? w.address!.areas!.map(getId).filter(Boolean)
          : [],
        territories: Array.isArray(w.address?.territories)
          ? w.address!.territories!.map(getId).filter(Boolean)
          : [],
      },
    });

    setOpen(true);
  };

  const setAddressField = <K extends keyof WarehouseForm["address"]>(
    key: K,
    value: WarehouseForm["address"][K],
  ) => {
    setForm((prev) => ({
      ...prev,
      address: {
        ...prev.address,
        [key]: value,
      },
    }));
  };

  const onZoneChange = (zoneId: string) => {
    setAddressField("zone", zoneId);
    setAddressField("region", "");
    setAddressField("areas", []);
    setAddressField("territories", []);
  };

  const onRegionChange = (regionId: string) => {
    setAddressField("region", regionId);
    setAddressField("areas", []);
    setAddressField("territories", []);
  };

  const onAreasChange = (selected: string[]) => {
    setAddressField("areas", selected);
    setAddressField("territories", []);
  };

  const onTerritoriesChange = (selected: string[]) => {
    setAddressField("territories", selected);
  };

  const onSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!form.name.trim()) return toast.error("Name required");
    if (!form.code.trim()) return toast.error("Code required");

    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim(),
        type: form.type,
        status: form.status,
        notes: form.notes,
        address: {
          zone: form.address.zone || undefined,
          region: form.address.region || undefined,
          areas: form.address.areas,
          territories: form.address.territories,
        },
      };

      if (editing?._id) {
        await api.put(`/warehouses/${editing._id}`, payload);
        toast.success("Warehouse updated");
      } else {
        await api.post("/warehouses", payload);
        toast.success("Warehouse created");
      }

      setOpen(false);
      fetchWarehouses();
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
      fetchWarehouses();
    } catch {
      toast.error("Delete failed");
    }
  };

  const exportCSV = async () => {
    try {
      const res = await api.get("/warehouses/export", {
        responseType: "blob",
      });

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
      setWarehouses((prev) =>
        prev.map((p) => (p._id === w._id ? { ...p, status: newStatus } : p)),
      );
    } catch {
      toast.error("Failed to update status");
      fetchWarehouses();
    }
  };

  const openAssignedModal = async (w: Warehouse) => {
    setSelectedWarehouse(w);
    setAssignedOpen(true);
    setSelectedUserIds([]);

    try {
      setAssignedLoading(true);
      const res = await api.get(`/warehouses/${w._id}/users`);
      const users = extractList(res.data) as UserShort[];
      setSelectedWarehouse((prev) =>
        prev ? { ...prev, assignedUsers: users } : prev,
      );
    } catch {
      // use already populated users if fetch fails
    } finally {
      setAssignedLoading(false);
    }
  };

  const assignSelectedUsers = async () => {
    if (!selectedWarehouse?._id) return;
    if (selectedUserIds.length === 0) {
      toast.error("Select at least one user");
      return;
    }

    try {
      setAssignSaving(true);
      await api.post(`/warehouses/${selectedWarehouse._id}/assign-users`, {
        userIds: selectedUserIds,
      });
      toast.success("Users assigned");

      const refreshed = await api.get(
        `/warehouses/${selectedWarehouse._id}/users`,
      );
      const users = extractList(refreshed.data) as UserShort[];
      setSelectedWarehouse((prev) =>
        prev ? { ...prev, assignedUsers: users } : prev,
      );
      setSelectedUserIds([]);
      fetchWarehouses();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to assign users");
    } finally {
      setAssignSaving(false);
    }
  };

  const removeAssignedUser = async (warehouseId: string, userId: string) => {
    if (!confirm("Remove user from warehouse?")) return;

    try {
      await api.delete(`/warehouses/${warehouseId}/remove-user/${userId}`);
      toast.success("User removed");

      if (selectedWarehouse?._id === warehouseId) {
        setSelectedWarehouse((prev) =>
          prev
            ? {
                ...prev,
                assignedUsers: prev.assignedUsers?.filter(
                  (u) => u._id !== userId,
                ),
              }
            : prev,
        );
      }

      fetchWarehouses();
    } catch {
      toast.error("Failed to remove user");
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const activeAssignedIds = useMemo(() => {
    return new Set((selectedWarehouse?.assignedUsers || []).map((u) => u._id));
  }, [selectedWarehouse]);

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">Warehouses & Factories</h2>
          <p className="text-sm text-muted-foreground">
            Manage warehouses/factories, structured location, and assigned users
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center border rounded-md px-2 py-1 gap-2 min-w-72">
            <Search className="w-4 h-4 text-gray-500" />
            <Input
              value={q}
              placeholder="Search name or code..."
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              className="border-0 p-0 shadow-none focus-visible:ring-0"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="border rounded-md px-3 py-2 text-sm bg-background"
          >
            <option value="ALL">All Types</option>
            <option value="Warehouse">Warehouse</option>
            <option value="Factory">Factory</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="border rounded-md px-3 py-2 text-sm bg-background"
          >
            <option value="ALL">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>

          <select
            value={zoneFilter}
            onChange={(e) => {
              setZoneFilter(e.target.value);
              setPage(1);
            }}
            className="border rounded-md px-3 py-2 text-sm bg-background max-w-48"
          >
            <option value="ALL">All Zones</option>
            {zones.map((z) => (
              <option key={z._id} value={z._id}>
                {z.name}
              </option>
            ))}
          </select>

          <select
            value={regionFilter}
            onChange={(e) => {
              setRegionFilter(e.target.value);
              setPage(1);
            }}
            className="border rounded-md px-3 py-2 text-sm bg-background max-w-48"
          >
            <option value="ALL">All Regions</option>
            {regions
              .filter((r) =>
                zoneFilter === "ALL" ? true : getId(r.zone) === zoneFilter,
              )
              .map((r) => (
                <option key={r._id} value={r._id}>
                  {r.name}
                </option>
              ))}
          </select>

          <Button onClick={fetchWarehouses} variant="secondary">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>

          <Button onClick={onOpenCreate} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Warehouse
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
                <TableHead>Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="w-44">Assigned Users</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-40">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {warehouses.map((w, i) => {
                const addr = addressSummary(w.address);

                return (
                  <TableRow key={w._id || i}>
                    <TableCell>{(page - 1) * limit + i + 1}</TableCell>

                    <TableCell>
                      <div className="flex items-start gap-3">
                        <div className="rounded-full bg-slate-100 p-2 mt-0.5">
                          {w.type === "Factory" ? (
                            <Factory className="w-4 h-4 text-slate-700" />
                          ) : (
                            <Building2 className="w-4 h-4 text-slate-700" />
                          )}
                        </div>
                        <div className="space-y-1">
                          <div className="text-sm font-medium">{w.name}</div>
                          {w.notes ? (
                            <div className="text-xs text-muted-foreground">
                              {w.notes}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="text-sm">{w.code}</TableCell>

                    <TableCell>
                      <TypeBadge type={w.type} />
                    </TableCell>

                    <TableCell>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="font-medium">Zone:</span>{" "}
                          <span>{addr.zone}</span>
                        </div>
                        <div>
                          <span className="font-medium">Region:</span>{" "}
                          <span>{addr.region}</span>
                        </div>
                        <div>
                          <span className="font-medium">Areas:</span>{" "}
                          <span>{addr.areas}</span>
                        </div>
                        <div>
                          <span className="font-medium">Territories:</span>{" "}
                          <span>{addr.territories}</span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        {w.assignedUsers && w.assignedUsers.length > 0 ? (
                          <>
                            <div className="flex -space-x-2">
                              {w.assignedUsers.slice(0, 4).map((u) => (
                                <div
                                  key={u._id}
                                  title={u.name}
                                  className="relative z-10 cursor-pointer"
                                  onClick={() => openAssignedModal(w)}
                                >
                                  <Avatar
                                    name={u.name}
                                    img={u.profileImageUrl}
                                  />
                                </div>
                              ))}
                            </div>

                            {w.assignedUsers.length > 4 && (
                              <button
                                className="ml-2 text-xs text-muted-foreground inline-flex items-center gap-1"
                                onClick={() => openAssignedModal(w)}
                              >
                                +{w.assignedUsers.length - 4} more
                                <ChevronDown className="w-3 h-3" />
                              </button>
                            )}

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
                );
              })}

              {warehouses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-6">
                    {loading ? "Loading..." : "No warehouses found"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between p-4 border-t gap-3 flex-wrap">
          <div>
            <span className="text-sm text-muted-foreground">
              Showing {(page - 1) * limit + 1} - {Math.min(page * limit, total)}{" "}
              of {total}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="border rounded px-2 py-2 bg-background"
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
                variant="outline"
              >
                Prev
              </Button>
              <div className="px-3 text-sm">
                {page} / {totalPages}
              </div>
              <Button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                variant="outline"
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <form onSubmit={onSubmit} className="space-y-4">
            <h3 className="text-lg font-semibold">
              {editing?._id
                ? "Edit Warehouse / Factory"
                : "New Warehouse / Factory"}
            </h3>

            <div className="grid gap-4 md:grid-cols-2">
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
                <label className="text-sm">Type</label>
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      type:
                        e.target.value === "Factory" ? "Factory" : "Warehouse",
                    })
                  }
                  className="border rounded px-3 py-2 w-full bg-background"
                >
                  <option value="Warehouse">Warehouse</option>
                  <option value="Factory">Factory</option>
                </select>
              </div>

              <div>
                <label className="text-sm">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="border rounded px-3 py-2 w-full bg-background"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="border rounded px-3 py-2 w-full min-h-24 bg-background"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className="text-sm">Zone</label>
                <select
                  value={form.address.zone}
                  onChange={(e) => onZoneChange(e.target.value)}
                  className="border rounded px-3 py-2 w-full bg-background"
                >
                  <option value="">Select zone</option>
                  {zones.map((z) => (
                    <option key={z._id} value={z._id}>
                      {z.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm">Region</label>
                <select
                  value={form.address.region}
                  onChange={(e) => onRegionChange(e.target.value)}
                  className="border rounded px-3 py-2 w-full bg-background"
                >
                  <option value="">Select region</option>
                  {filteredRegions.map((r) => (
                    <option key={r._id} value={r._id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm">Areas (multiple)</label>
                <select
                  multiple
                  value={form.address.areas}
                  onChange={(e) =>
                    onAreasChange(
                      Array.from(e.target.selectedOptions).map(
                        (opt) => opt.value,
                      ),
                    )
                  }
                  className="border rounded px-3 py-2 w-full min-h-28 bg-background"
                >
                  {filteredAreas.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm">Territories (multiple)</label>
                <select
                  multiple
                  value={form.address.territories}
                  onChange={(e) =>
                    onTerritoriesChange(
                      Array.from(e.target.selectedOptions).map(
                        (opt) => opt.value,
                      ),
                    )
                  }
                  className="border rounded px-3 py-2 w-full min-h-28 bg-background"
                >
                  {filteredTerritories.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
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

      <Dialog open={assignedOpen} onOpenChange={setAssignedOpen}>
        <DialogContent className="max-w-5xl">
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">Assigned Users</h3>

              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (selectedWarehouse?._id)
                    openAssignedModal(selectedWarehouse);
                }}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>

            {assignedLoading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-3">
                  <div className="text-sm font-semibold">
                    Current assigned users
                  </div>

                  {(selectedWarehouse?.assignedUsers || []).length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      No users assigned
                    </div>
                  ) : (
                    (selectedWarehouse?.assignedUsers || []).map((u) => (
                      <div
                        key={u._id}
                        className="flex items-center justify-between gap-3 border rounded p-3"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar name={u.name} img={u.profileImageUrl} />
                          <div>
                            <div className="text-sm font-medium">{u.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {u.email || "-"}
                            </div>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            selectedWarehouse?._id &&
                            removeAssignedUser(selectedWarehouse._id, u._id)
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-semibold">Assign more users</div>

                  <div className="max-h-[320px] overflow-auto border rounded p-3 space-y-2">
                    {allUsers
                      .filter((u) => !activeAssignedIds.has(u._id))
                      .map((u) => (
                        <label
                          key={u._id}
                          className="flex items-center justify-between gap-3 border rounded p-2 cursor-pointer"
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={selectedUserIds.includes(u._id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedUserIds((prev) => [
                                    ...prev,
                                    u._id,
                                  ]);
                                } else {
                                  setSelectedUserIds((prev) =>
                                    prev.filter((id) => id !== u._id),
                                  );
                                }
                              }}
                            />
                            <Avatar name={u.name} img={u.profileImageUrl} />
                            <div>
                              <div className="text-sm font-medium">
                                {u.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {u.email || "-"}
                              </div>
                            </div>
                          </div>
                        </label>
                      ))}

                    {allUsers.filter((u) => !activeAssignedIds.has(u._id))
                      .length === 0 && (
                      <div className="text-sm text-muted-foreground">
                        No more users available to assign
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <Button
                      onClick={assignSelectedUsers}
                      disabled={assignSaving || selectedUserIds.length === 0}
                    >
                      {assignSaving ? "Assigning..." : "Assign selected users"}
                    </Button>
                  </div>
                </div>
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
