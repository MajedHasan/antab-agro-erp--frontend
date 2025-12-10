"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
} from "@/components/ui/table";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Trash2, Edit, Eye, Plus } from "lucide-react";

/**
 * UserLocationAccess page
 * - List existing assignments
 * - Create / Edit slide-over with:
 *   - user search & select (server-side)
 *   - select ONE zone
 *   - select multiple regions (under chosen zone)
 *   - for each region, select multiple areas
 *   - for each area, select multiple territories
 *
 * Backend endpoints assumed:
 * GET /user-location-access
 * POST /user-location-access
 * PUT /user-location-access/:id
 * DELETE /user-location-access/:id
 *
 * GET /users?q=...&page=...&limit=...
 * GET /zones
 * GET /regions?zone=ZONE_ID
 * GET /areas?region=REGION_ID
 * GET /territories?area=AREA_ID
 */

type IUser = {
  _id: string;
  name: string;
  email?: string;
};

type IZone = { _id: string; name: string };
type IRegion = { _id: string; name: string; zone?: string };
type IArea = { _id: string; name: string; region?: string };
type ITerritory = { _id: string; name: string; area?: string };

type IUserLocationAccess = {
  _id?: string;
  user: IUser | string;
  assignedBy?: IUser | string;
  createdBy?: IUser | string;
  access: {
    zone: IZone | string;
    regions: {
      region: IRegion | string;
      areas: {
        area: IArea | string;
        territories: (ITerritory | string)[];
      }[];
    }[];
  };
  createdAt?: string;
};

const debounce = (fn: Function, wait = 250) => {
  let t: any;
  return (...args: any[]) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
};

export default function UserLocationAccessPage() {
  // table/list state
  const [items, setItems] = useState<IUserLocationAccess[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listQ, setListQ] = useState("");
  const [listPage, setListPage] = useState(1);
  const [listLimit, setListLimit] = useState(15);
  const [listTotal, setListTotal] = useState(0);

  // slide-over state
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<"create" | "edit" | "view">(
    "create"
  );
  const [activeItem, setActiveItem] = useState<IUserLocationAccess | null>(
    null
  );

  // form fields
  const [selectedUser, setSelectedUser] = useState<IUser | null>(null);
  const [selectedZone, setSelectedZone] = useState<IZone | null>(null);

  // hierarchical caches
  const [zones, setZones] = useState<IZone[]>([]);
  const regionsMapRef = useRef<Record<string, IRegion[]>>({});
  const areasMapRef = useRef<Record<string, IArea[]>>({});
  const territoriesMapRef = useRef<Record<string, ITerritory[]>>({});

  // selections
  // multiple regions: for zone choose many regions; for each region choose many areas; for each area choose many territories
  const [selectedRegions, setSelectedRegions] = useState<
    Record<string, boolean>
  >({});
  const [selectedAreas, setSelectedAreas] = useState<Record<string, boolean>>(
    {}
  );
  const [selectedTerritories, setSelectedTerritories] = useState<
    Record<string, boolean>
  >({});

  // loading states for lazy loads
  const loadingRegionsRef = useRef<Record<string, boolean>>({});
  const loadingAreasRef = useRef<Record<string, boolean>>({});
  const loadingTerritoriesRef = useRef<Record<string, boolean>>({});

  // user search state (server-side)
  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState<IUser[]>([]);
  const [userPage, setUserPage] = useState(1);
  const [userHasMore, setUserHasMore] = useState(true);
  const [userLoading, setUserLoading] = useState(false);

  // form control state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // UI helpers: show chips for selected (region names etc.)
  const selectedRegionIds = useMemo(
    () => Object.keys(selectedRegions).filter((k) => selectedRegions[k]),
    [selectedRegions]
  );
  const selectedAreaIds = useMemo(
    () => Object.keys(selectedAreas).filter((k) => selectedAreas[k]),
    [selectedAreas]
  );
  const selectedTerritoryIds = useMemo(
    () =>
      Object.keys(selectedTerritories).filter((k) => selectedTerritories[k]),
    [selectedTerritories]
  );

  // ---------- fetch list ----------
  const fetchList = useCallback(async () => {
    setListLoading(true);
    try {
      const params: any = { page: listPage, limit: listLimit };
      if (listQ) params.q = listQ;
      const res = await api.get("/user-location-access", { params });
      const data = res.data || {};
      // support both formats (data.data or data.data.data)
      const payload = Array.isArray(data.data) ? data : data.data;
      const list = Array.isArray(payload.data) ? payload.data : payload;
      const total = payload.total ?? (Array.isArray(list) ? list.length : 0);
      setItems(list);
      setListTotal(Number(total));
    } catch (err) {
      console.error("fetch list", err);
    } finally {
      setListLoading(false);
    }
  }, [listPage, listLimit, listQ]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // ---------- zones (single load) ----------
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/zones", { params: { limit: 1000 } });
        const data = res.data || {};
        const payload = Array.isArray(data.data)
          ? data.data
          : data.data?.data ?? data.data ?? [];
        setZones(payload);
      } catch (err) {
        console.error("load zones", err);
      }
    })();
  }, []);

  // ---------- user search (debounced server-side) ----------
  const loadUsers = useCallback(async (q = "", page = 1, append = false) => {
    setUserLoading(true);
    try {
      const res = await api.get("/users", {
        params: { q: q || undefined, page, limit: 20 },
      });
      const data = res.data || {};
      const payload = Array.isArray(data.data)
        ? data.data
        : data.data?.data ?? data.data ?? [];
      const total = data.total ?? (Array.isArray(payload) ? payload.length : 0);
      const users = payload;
      setUserHasMore(page * 20 < Number(total || users.length));
      setUserResults((prev) => (append ? [...prev, ...users] : users));
    } catch (err) {
      console.error("user search", err);
    } finally {
      setUserLoading(false);
    }
  }, []);

  // debounce wrapper
  const debouncedUserSearch = useMemo(
    () =>
      debounce((q: string) => {
        setUserPage(1);
        loadUsers(q, 1, false);
      }, 300),
    [loadUsers]
  );

  useEffect(() => {
    // initial load
    loadUsers("", 1, false);
  }, [loadUsers]);

  useEffect(() => {
    debouncedUserSearch(userQuery);
  }, [userQuery, debouncedUserSearch]);

  const loadMoreUsers = async () => {
    if (!userHasMore) return;
    const next = userPage + 1;
    setUserPage(next);
    await loadUsers(userQuery, next, true);
  };

  // ---------- lazy load regions / areas / territories ----------
  const loadRegionsForZone = async (zoneId: string) => {
    if (!zoneId) return;
    if (regionsMapRef.current[zoneId]) return; // already loaded
    loadingRegionsRef.current[zoneId] = true;
    try {
      const res = await api.get("/regions", {
        params: { zone: zoneId, limit: 1000 },
      });
      const data = res.data || {};
      const payload = Array.isArray(data.data)
        ? data.data
        : data.data?.data ?? data.data ?? [];
      regionsMapRef.current = { ...regionsMapRef.current, [zoneId]: payload };
    } catch (err) {
      console.error("load regions", err);
    } finally {
      loadingRegionsRef.current[zoneId] = false;
      // force update
      setZones((z) => [...z]);
    }
  };

  const loadAreasForRegion = async (regionId: string) => {
    if (!regionId) return;
    if (areasMapRef.current[regionId]) return;
    loadingAreasRef.current[regionId] = true;
    try {
      const res = await api.get("/areas", {
        params: { region: regionId, limit: 1000 },
      });
      const data = res.data || {};
      const payload = Array.isArray(data.data)
        ? data.data
        : data.data?.data ?? data.data ?? [];
      areasMapRef.current = { ...areasMapRef.current, [regionId]: payload };
    } catch (err) {
      console.error("load areas", err);
    } finally {
      loadingAreasRef.current[regionId] = false;
      setZones((z) => [...z]);
    }
  };

  const loadTerritoriesForArea = async (areaId: string) => {
    if (!areaId) return;
    if (territoriesMapRef.current[areaId]) return;
    loadingTerritoriesRef.current[areaId] = true;
    try {
      const res = await api.get("/territories", {
        params: { area: areaId, limit: 1000 },
      });
      const data = res.data || {};
      const payload = Array.isArray(data.data)
        ? data.data
        : data.data?.data ?? data.data ?? [];
      territoriesMapRef.current = {
        ...territoriesMapRef.current,
        [areaId]: payload,
      };
    } catch (err) {
      console.error("load territories", err);
    } finally {
      loadingTerritoriesRef.current[areaId] = false;
      setZones((z) => [...z]);
    }
  };

  // ---------- helpers to manage multi selections ----------
  const toggleRegion = (regionId: string) => {
    setSelectedRegions((prev) => {
      const nxt = { ...prev, [regionId]: !prev[regionId] };
      return nxt;
    });
  };

  const toggleArea = (areaId: string) => {
    setSelectedAreas((prev) => {
      const nxt = { ...prev, [areaId]: !prev[areaId] };
      return nxt;
    });
  };

  const toggleTerritory = (territoryId: string) => {
    setSelectedTerritories((prev) => {
      const nxt = { ...prev, [territoryId]: !prev[territoryId] };
      return nxt;
    });
  };

  // Clear region/area/territory selections (used when zone changes or modal closes)
  const clearHierarchySelections = () => {
    setSelectedRegions({});
    setSelectedAreas({});
    setSelectedTerritories({});
  };

  // Build payload for backend
  const buildPayload = (): any => {
    if (!selectedUser || !selectedZone) return null;

    // build access.regions array from selectedRegions/areas/territories
    const zonesRegions = regionsMapRef.current[selectedZone._id] || [];
    const regionsPayload: any[] = [];

    zonesRegions.forEach((reg) => {
      if (!selectedRegions[reg._id]) return; // region not selected, skip
      const areas = areasMapRef.current[reg._id] || [];
      const areasPayload = areas
        .filter((a) => selectedAreas[a._id])
        .map((a) => {
          const terrs = territoriesMapRef.current[a._id] || [];
          const terrPayload = terrs
            .filter((t) => selectedTerritories[t._id])
            .map((t) => t._id);
          return { area: a._id, territories: terrPayload };
        });
      regionsPayload.push({ region: reg._id, areas: areasPayload });
    });

    return {
      user: selectedUser._id,
      access: {
        zone: selectedZone._id,
        regions: regionsPayload,
      },
    };
  };

  // ---------- open create / edit / view ----------
  function openCreatePanel() {
    setPanelMode("create");
    setActiveItem(null);
    setSelectedUser(null);
    setSelectedZone(null);
    clearHierarchySelections();
    setPanelOpen(true);
  }

  // populate form for edit: active item already has populated fields from backend (populate configured)
  function openEditPanel(item: IUserLocationAccess) {
    setPanelMode("edit");
    setActiveItem(item);
    // user can be object or id, we expect populated
    const user = typeof item.user === "object" ? (item.user as IUser) : null;
    setSelectedUser(user || null);
    const zone =
      typeof item.access.zone === "object" ? (item.access.zone as IZone) : null;
    setSelectedZone(zone || null);

    // reset maps then load region/areas/territories as needed
    clearHierarchySelections();

    (async () => {
      if (zone && zone._id) {
        await loadRegionsForZone(zone._id);
        // select regions/areas/territories from item.access.regions
        (item.access.regions || []).forEach((regEntry: any) => {
          const regionId =
            typeof regEntry.region === "object"
              ? regEntry.region._id
              : regEntry.region;
          if (regionId) setSelectedRegions((s) => ({ ...s, [regionId]: true }));
        });

        // ensure areas & territories are loaded for selected regions and mark them
        for (const regEntry of item.access.regions || []) {
          const regionId =
            typeof regEntry.region === "object"
              ? regEntry.region._id
              : regEntry.region;
          if (!regionId) continue;
          await loadAreasForRegion(regionId);
          for (const areaEntry of regEntry.areas || []) {
            const areaId =
              typeof areaEntry.area === "object"
                ? areaEntry.area._id
                : areaEntry.area;
            if (areaId) setSelectedAreas((s) => ({ ...s, [areaId]: true }));
            // load territories for this area and select
            await loadTerritoriesForArea(areaId);
            for (const tId of areaEntry.territories || []) {
              const tid = typeof tId === "object" ? tId._id : tId;
              if (tid) setSelectedTerritories((s) => ({ ...s, [tid]: true }));
            }
          }
        }
      }
    })();

    setPanelOpen(true);
  }

  function openViewPanel(item: IUserLocationAccess) {
    setPanelMode("view");
    setActiveItem(item);
    setPanelOpen(true);
  }

  // ---------- create/edit submit ----------
  const handleSubmit = async () => {
    const payload = buildPayload();
    if (!payload) {
      alert("Please select a user and a zone.");
      return;
    }
    setIsSubmitting(true);
    try {
      if (panelMode === "edit" && activeItem && activeItem._id) {
        await api.put(`/user-location-access/${activeItem._id}`, payload);
      } else {
        await api.post("/user-location-access", payload);
      }
      await fetchList();
      setPanelOpen(false);
      setActiveItem(null);
    } catch (err) {
      console.error("save failed", err);
      alert("Save failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------- delete ----------
  const handleDelete = async (id?: string) => {
    if (!id) return;
    if (!confirm("Delete this access entry?")) return;
    try {
      await api.delete(`/user-location-access/${id}`);
      await fetchList();
    } catch (err) {
      console.error("delete failed", err);
      alert("Delete failed");
    }
  };

  // ---------- render helpers ----------
  function zoneName(zoneId?: string) {
    return zones.find((z) => z._id === zoneId)?.name ?? "-";
  }

  function regionName(regionId?: string) {
    for (const k of Object.keys(regionsMapRef.current)) {
      const r = (regionsMapRef.current[k] || []).find(
        (x) => x._id === regionId
      );
      if (r) return r.name;
    }
    return regionId || "-";
  }

  function areaName(areaId?: string) {
    for (const k of Object.keys(areasMapRef.current)) {
      const r = (areasMapRef.current[k] || []).find((x) => x._id === areaId);
      if (r) return r.name;
    }
    return areaId || "-";
  }

  function territoryName(tId?: string) {
    for (const k of Object.keys(territoriesMapRef.current)) {
      const r = (territoriesMapRef.current[k] || []).find((x) => x._id === tId);
      if (r) return r.name;
    }
    return tId || "-";
  }

  // ---------- UI JSX ----------
  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">User Location Access</h1>
          <p className="text-sm text-muted-foreground">
            Assign users to a zone and control which regions → areas →
            territories they can access.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Input
            placeholder="Search assignments..."
            value={listQ}
            onChange={(e) => {
              setListQ(e.target.value);
              setListPage(1);
            }}
            className="w-72"
          />
          <Button
            variant="outline"
            onClick={() => fetchList()}
            disabled={listLoading}
          >
            Refresh
          </Button>
          <Button onClick={openCreatePanel}>
            <Plus className="mr-2" /> New Access
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Zone</TableHead>
              <TableHead>Regions / Areas / Territories</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center">
                  No assignments yet
                </TableCell>
              </TableRow>
            )}

            {items.map((it) => (
              <TableRow key={it._id}>
                <TableCell>
                  <div className="font-medium">
                    {typeof it.user === "object"
                      ? (it.user as IUser).name
                      : (it.user as string)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {typeof it.user === "object"
                      ? (it.user as IUser).email
                      : ""}
                  </div>
                </TableCell>
                <TableCell>
                  {typeof it.access.zone === "object"
                    ? (it.access.zone as IZone).name
                    : String(it.access.zone)}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {Array.isArray(it.access.regions) &&
                    it.access.regions.length > 0 ? (
                      it.access.regions.map((r) => {
                        const region =
                          typeof r.region === "object"
                            ? (r.region as IRegion)
                            : {
                                _id: String(r.region),
                                name: regionName(String(r.region)),
                              };
                        return (
                          <div
                            key={String(region._id)}
                            className="border rounded p-2 bg-white/50"
                          >
                            <div className="font-medium">{region.name}</div>
                            <div className="text-xs text-muted-foreground">
                              Areas:{" "}
                              {Array.isArray(r.areas) && r.areas.length > 0
                                ? r.areas
                                    .map((a) => {
                                      const area =
                                        typeof a.area === "object"
                                          ? (a.area as IArea)
                                          : {
                                              _id: String(a.area),
                                              name: areaName(String(a.area)),
                                            };
                                      const terrs = Array.isArray(a.territories)
                                        ? a.territories
                                            .map((t) =>
                                              typeof t === "object"
                                                ? (t as ITerritory).name
                                                : territoryName(String(t))
                                            )
                                            .join(", ")
                                        : "";
                                      return `${area.name}${
                                        terrs ? ` → [${terrs}]` : ""
                                      }`;
                                    })
                                    .join("; ")
                                : "—"}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        No regions selected
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openViewPanel(it)}
                    >
                      <Eye size={16} />
                    </Button>
                    <Button size="sm" onClick={() => openEditPanel(it)}>
                      <Edit size={16} />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(it._id)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* simple pagination controls */}
        <div className="p-3 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {(listPage - 1) * listLimit + 1} -{" "}
            {Math.min(listPage * listLimit, listTotal)} of {listTotal}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={listLimit}
              onChange={(e) => {
                setListLimit(Number(e.target.value));
                setListPage(1);
              }}
              className="rounded border px-2 py-1"
            >
              {[10, 15, 25, 50].map((n) => (
                <option key={n} value={n}>
                  {n}/page
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              onClick={() => setListPage((p) => Math.max(1, p - 1))}
              disabled={listPage === 1}
            >
              Prev
            </Button>
            <div className="px-2">{listPage}</div>
            <Button
              variant="outline"
              onClick={() => setListPage((p) => p + 1)}
              disabled={listPage * listLimit >= listTotal}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      {/* Slide-over panel */}
      <div
        className={`fixed inset-y-0 right-0 w-full max-w-2xl transform bg-white shadow-xl transition-transform z-50 ${
          panelOpen ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
      >
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">
              {panelMode === "view"
                ? "View Access"
                : panelMode === "edit"
                ? "Edit Access"
                : "Create Access"}
            </h3>
            <p className="text-sm text-muted-foreground">
              Assign a user to a zone and pick regions / areas / territories.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setPanelOpen(false);
                setActiveItem(null);
              }}
            >
              Close
            </Button>
          </div>
        </div>

        <div className="p-4 overflow-y-auto h-[calc(100vh-96px)]">
          {/* VIEW mode */}
          {panelMode === "view" && activeItem && (
            <div className="space-y-4">
              <div>
                <div className="text-xl font-semibold">
                  {typeof activeItem.user === "object"
                    ? (activeItem.user as IUser).name
                    : activeItem.user}
                </div>
                <div className="text-sm text-muted-foreground">
                  {typeof activeItem.user === "object"
                    ? (activeItem.user as IUser).email
                    : ""}
                </div>
              </div>

              <div>
                <strong>Zone</strong>
                <div className="mt-1">
                  {typeof activeItem.access.zone === "object"
                    ? (activeItem.access.zone as IZone).name
                    : String(activeItem.access.zone)}
                </div>
              </div>

              <div>
                <strong>Regions / Areas / Territories</strong>
                <div className="mt-2 space-y-2">
                  {activeItem.access.regions?.length ? (
                    activeItem.access.regions.map((r) => {
                      const region =
                        typeof r.region === "object"
                          ? (r.region as IRegion)
                          : {
                              _id: String(r.region),
                              name: regionName(String(r.region)),
                            };
                      return (
                        <div
                          key={String(region._id)}
                          className="border rounded p-2"
                        >
                          <div className="font-medium">{region.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {Array.isArray(r.areas) && r.areas.length > 0
                              ? r.areas
                                  .map((a) => {
                                    const area =
                                      typeof a.area === "object"
                                        ? (a.area as IArea)
                                        : {
                                            _id: String(a.area),
                                            name: areaName(String(a.area)),
                                          };
                                    const terrList = Array.isArray(
                                      a.territories
                                    )
                                      ? a.territories
                                          .map((t) =>
                                            typeof t === "object"
                                              ? (t as ITerritory).name
                                              : territoryName(String(t))
                                          )
                                          .join(", ")
                                      : "";
                                    return `${area.name}${
                                      terrList ? ` → [${terrList}]` : ""
                                    }`;
                                  })
                                  .join("; ")
                              : "No areas selected"}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      No regions selected
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* CREATE / EDIT mode */}
          {(panelMode === "create" || panelMode === "edit") && (
            <div className="space-y-4">
              {/* User selector (server-side) */}
              <div>
                <Label>User (search)</Label>
                <div className="relative">
                  <Input
                    placeholder="Search users by name or email..."
                    value={userQuery}
                    onChange={(e) => {
                      setUserQuery(e.target.value);
                    }}
                  />
                  <div className="absolute right-2 top-2">
                    {userLoading ? (
                      <div className="text-xs text-muted-foreground">
                        Searching...
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-2 border rounded max-h-48 overflow-auto bg-white">
                  {userResults.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">
                      No users
                    </div>
                  ) : (
                    userResults.map((u) => (
                      <div
                        key={u._id}
                        className={`p-2 cursor-pointer flex items-center justify-between ${
                          selectedUser?._id === u._id
                            ? "bg-sky-50"
                            : "hover:bg-gray-50"
                        }`}
                        onClick={() => setSelectedUser(u)}
                      >
                        <div>
                          <div className="font-medium">{u.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {u.email}
                          </div>
                        </div>
                        {selectedUser?._id === u._id && (
                          <div className="text-xs text-muted-foreground">
                            Selected
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  <div className="p-2 flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      Showing {userResults.length} users
                    </div>
                    {userHasMore ? (
                      <button
                        className="text-xs text-blue-600"
                        onClick={loadMoreUsers}
                        disabled={userLoading}
                      >
                        Load more
                      </button>
                    ) : null}
                  </div>
                </div>

                {selectedUser && (
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <div className="px-3 py-1 rounded bg-sky-100 text-sm">
                      {selectedUser.name}
                    </div>
                    <button
                      className="text-xs text-muted-foreground underline"
                      onClick={() => setSelectedUser(null)}
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {/* Zone selector (single) */}
              <div>
                <Label>Zone</Label>
                <div className="flex items-center gap-2">
                  <select
                    className="rounded border px-2 py-1"
                    value={selectedZone?._id || ""}
                    onChange={async (e) => {
                      const zid = e.target.value || "";
                      const zone = zones.find((z) => z._id === zid) || null;
                      setSelectedZone(zone);
                      // clear existing selections
                      clearHierarchySelections();
                      // load regions for new zone
                      if (zone) await loadRegionsForZone(zone._id);
                    }}
                  >
                    <option value="">Select zone</option>
                    {zones.map((z) => (
                      <option key={z._id} value={z._id}>
                        {z.name}
                      </option>
                    ))}
                  </select>

                  {selectedZone && (
                    <div className="text-sm text-muted-foreground">
                      Selected: {selectedZone.name}
                    </div>
                  )}
                </div>
              </div>

              {/* Regions / Areas / Territories tree */}
              <div>
                <Label>Regions → Areas → Territories (choose multiple)</Label>
                <div className="mt-2">
                  {!selectedZone ? (
                    <div className="text-sm text-muted-foreground">
                      Choose a zone first
                    </div>
                  ) : (
                    <>
                      {/* load regions for zone, show loading or empty */}
                      {loadingRegionsRef.current[selectedZone._id] && (
                        <div className="text-sm text-muted-foreground">
                          Loading regions...
                        </div>
                      )}
                      <div className="space-y-2 mt-2">
                        {(regionsMapRef.current[selectedZone._id] || [])
                          .length === 0 ? (
                          <div className="text-sm text-muted-foreground">
                            No regions found for this zone
                          </div>
                        ) : (
                          (regionsMapRef.current[selectedZone._id] || []).map(
                            (reg) => {
                              const areasForReg =
                                areasMapRef.current[reg._id] || [];
                              const isRegionSelected = Boolean(
                                selectedRegions[reg._id]
                              );
                              return (
                                <div
                                  key={reg._id}
                                  className="border rounded p-2 bg-white"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <input
                                        id={`reg-${reg._id}`}
                                        type="checkbox"
                                        checked={isRegionSelected}
                                        onChange={() => toggleRegion(reg._id)}
                                      />
                                      <label
                                        htmlFor={`reg-${reg._id}`}
                                        className="font-medium"
                                      >
                                        {reg.name}
                                      </label>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <button
                                        className="text-xs text-muted-foreground"
                                        onClick={async () => {
                                          // toggle load/hide areas
                                          if (!areasMapRef.current[reg._id]) {
                                            await loadAreasForRegion(reg._id);
                                          } else {
                                            // collapse areas by clearing cache? we'll keep cache but toggle UI by marking loaded/visible
                                            // we'll simply toggle a quick local state by toggling selection state: not needed here.
                                          }
                                        }}
                                      >
                                        {areasMapRef.current[reg._id]
                                          ? "Toggle areas"
                                          : "Load areas"}
                                      </button>
                                    </div>
                                  </div>

                                  {/* areas */}
                                  <div className="mt-2 ml-6 space-y-2">
                                    {loadingAreasRef.current[reg._id] && (
                                      <div className="text-xs text-muted-foreground">
                                        Loading areas...
                                      </div>
                                    )}
                                    {areasForReg.length === 0 &&
                                      !loadingAreasRef.current[reg._id] && (
                                        <div className="text-xs text-muted-foreground">
                                          No areas
                                        </div>
                                      )}
                                    {areasForReg.map((area) => {
                                      const isAreaSelected = Boolean(
                                        selectedAreas[area._id]
                                      );
                                      return (
                                        <div
                                          key={area._id}
                                          className="border rounded p-2 bg-gray-50"
                                        >
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <input
                                                type="checkbox"
                                                id={`area-${area._id}`}
                                                checked={isAreaSelected}
                                                onChange={() =>
                                                  toggleArea(area._id)
                                                }
                                              />
                                              <label
                                                htmlFor={`area-${area._id}`}
                                              >
                                                {area.name}
                                              </label>
                                            </div>
                                            <div>
                                              <button
                                                className="text-xs text-muted-foreground"
                                                onClick={async () => {
                                                  if (
                                                    !territoriesMapRef.current[
                                                      area._id
                                                    ]
                                                  ) {
                                                    await loadTerritoriesForArea(
                                                      area._id
                                                    );
                                                  }
                                                }}
                                              >
                                                {territoriesMapRef.current[
                                                  area._id
                                                ]
                                                  ? "Toggle territories"
                                                  : "Load territories"}
                                              </button>
                                            </div>
                                          </div>

                                          {/* territories */}
                                          <div className="mt-2 ml-6 space-y-1">
                                            {loadingTerritoriesRef.current[
                                              area._id
                                            ] && (
                                              <div className="text-xs text-muted-foreground">
                                                Loading territories...
                                              </div>
                                            )}
                                            {(
                                              territoriesMapRef.current[
                                                area._id
                                              ] || []
                                            ).length === 0 &&
                                              !loadingTerritoriesRef.current[
                                                area._id
                                              ] && (
                                                <div className="text-xs text-muted-foreground">
                                                  No territories
                                                </div>
                                              )}
                                            {(
                                              territoriesMapRef.current[
                                                area._id
                                              ] || []
                                            ).map((t) => {
                                              const isTerr = Boolean(
                                                selectedTerritories[t._id]
                                              );
                                              return (
                                                <div
                                                  key={t._id}
                                                  className="flex items-center gap-2"
                                                >
                                                  <input
                                                    type="checkbox"
                                                    id={`ter-${t._id}`}
                                                    checked={isTerr}
                                                    onChange={() =>
                                                      toggleTerritory(t._id)
                                                    }
                                                  />
                                                  <label
                                                    htmlFor={`ter-${t._id}`}
                                                    className="text-sm"
                                                  >
                                                    {t.name}
                                                  </label>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            }
                          )
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* selection summary chips */}
              <div>
                <Label>Selection summary</Label>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <div className="px-3 py-1 rounded bg-sky-100 text-sm">
                    Zone: {selectedZone ? selectedZone.name : "—"}
                  </div>
                  {selectedRegionIds.map((rid) => (
                    <div
                      key={rid}
                      className="px-3 py-1 rounded bg-gray-100 text-sm"
                    >
                      {regionName(rid)}
                    </div>
                  ))}
                  {selectedAreaIds.map((aid) => (
                    <div
                      key={aid}
                      className="px-3 py-1 rounded bg-gray-50 text-sm"
                    >
                      {areaName(aid)}
                    </div>
                  ))}
                  {selectedTerritoryIds.map((tid) => (
                    <div
                      key={tid}
                      className="px-3 py-1 rounded bg-white text-sm border"
                    >
                      {territoryName(tid)}
                    </div>
                  ))}
                </div>
              </div>

              {/* actions */}
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setPanelOpen(false);
                    setActiveItem(null);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={() => handleSubmit()} disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
