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
import { toast } from "sonner";
import {
  Users,
  Search,
  Trash2,
  Plus,
  Edit,
  Check,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

/* Small UI helpers copied from your earlier file */
function Avatar({ name, src }: { name: string; src?: string | null }) {
  const initials = name
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      className="w-8 h-8 rounded-full object-cover border shadow-sm"
    />
  ) : (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 text-xs text-slate-800 flex items-center justify-center border shadow-sm">
      {initials}
    </div>
  );
}

function Badge({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs inline-block ${className}`}
    >
      {children}
    </span>
  );
}

/* -------------------------
  Types
-------------------------*/
type User = {
  _id: string;
  name: string;
  email?: string;
  profileImageUrl?: string | null;
  role?: string;
};

type Zone = { _id: string; name: string };
type Region = { _id: string; name: string; zone: string | Zone };
type Area = { _id: string; name: string; region: string | Region };
type Territory = { _id: string; name: string; area: string | Area };

type AreaNode = {
  area: string; // areaId
  territories: string[]; // territoryIds
};

type RegionNode = {
  region: string; // regionId
  areas: AreaNode[];
};

type AccessDoc = {
  _id?: string;
  user: string;
  assignedBy?: string | null;
  createdBy?: string | null;
  access: {
    zone: string;
    regions: RegionNode[];
  };
};

/* -------------------------
  Helpers: normalize populated fields to IDs
-------------------------*/
function normalizeAccessDoc(raw: any): AccessDoc {
  if (!raw) return raw;
  const access = raw.access || { zone: "", regions: [] };

  const zoneId =
    access.zone && typeof access.zone === "object"
      ? access.zone._id
      : access.zone || "";

  const regions: RegionNode[] =
    (access.regions || []).map((r: any) => {
      const regionId =
        r.region && typeof r.region === "object" ? r.region._id : r.region;
      const areas: AreaNode[] =
        (r.areas || []).map((a: any) => {
          const areaId =
            a.area && typeof a.area === "object" ? a.area._id : a.area;
          const territories: string[] = (a.territories || []).map((t: any) =>
            t && typeof t === "object" ? t._id : t
          );
          return { ...a, area: areaId, territories };
        }) || [];
      return { ...r, region: regionId, areas };
    }) || [];

  const normalized: AccessDoc = {
    _id: raw._id,
    user:
      raw.user && typeof raw.user === "object" ? raw.user._id : raw.user || "",
    assignedBy:
      raw.assignedBy && typeof raw.assignedBy === "object"
        ? raw.assignedBy._id
        : raw.assignedBy || null,
    createdBy:
      raw.createdBy && typeof raw.createdBy === "object"
        ? raw.createdBy._id
        : raw.createdBy || null,
    access: {
      zone: zoneId,
      regions,
    },
  };

  return normalized;
}

/* sanitize before sending to server: ensure only IDs */
function sanitizePayloadForSave(w: AccessDoc) {
  const payload: any = {
    ...w,
    access: {
      zone:
        w.access.zone && typeof w.access.zone === "object"
          ? (w.access.zone as any)._id
          : w.access.zone,
      regions: (w.access.regions || []).map((r) => ({
        region:
          r.region && typeof r.region === "object"
            ? (r.region as any)._id
            : r.region,
        areas: (r.areas || []).map((a) => ({
          area:
            a.area && typeof a.area === "object" ? (a.area as any)._id : a.area,
          territories: (a.territories || []).map((t) =>
            t && typeof t === "object" ? (t as any)._id : t
          ),
        })),
      })),
    },
  };
  return payload;
}

/* -------------------------
  Page Component
-------------------------*/
export default function UserLocationAccessPage() {
  /* -------------------------
     Left: Users
  -------------------------*/
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const debounceRef = useRef<number | null>(null);

  const fetchUsers = useCallback(async (q = "") => {
    try {
      setUsersLoading(true);
      const params: any = { q: q || "", limit: 200 };
      const res = await api.get("/users", { params });
      setAllUsers(res.data.data || []);
    } catch (err) {
      toast.error("Failed to load users");
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      fetchUsers(userQuery.trim());
    }, 300);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [userQuery, fetchUsers]);

  /* -------------------------
     Middle: Current user's Access Docs (one per zone)
  -------------------------*/
  const [accessDocs, setAccessDocs] = useState<AccessDoc[]>([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [selectedAccess, setSelectedAccess] = useState<AccessDoc | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchAccessDocs = useCallback(async (userId?: string) => {
    if (!userId) {
      setAccessDocs([]);
      setSelectedAccess(null);
      return;
    }
    try {
      setAccessLoading(true);
      const res = await api.get("/user-location-access", {
        params: { user: userId, limit: 1000 },
      });

      const rawDocs = res.data.data || [];
      // normalize all docs (convert populated objects -> IDs)
      const normalized = rawDocs.map((d: any) => normalizeAccessDoc(d));
      setAccessDocs(normalized);

      // auto select first doc (normalized)
      setSelectedAccess((prev) =>
        prev && prev.user === userId ? prev : normalized?.[0] ?? null
      );
    } catch (err) {
      toast.error("Failed to load user access");
    } finally {
      setAccessLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedUser) fetchAccessDocs(selectedUser._id);
    else {
      setAccessDocs([]);
      setSelectedAccess(null);
    }
  }, [selectedUser, fetchAccessDocs]);

  /* -------------------------
     Right: Zones / Regions / Areas / Territories (tree)
  -------------------------*/
  const [zones, setZones] = useState<Zone[]>([]);
  const [regionsCache, setRegionsCache] = useState<Record<string, Region[]>>(
    {}
  ); // zoneId -> regions
  const [areasCache, setAreasCache] = useState<Record<string, Area[]>>({}); // regionId -> areas
  const [territoriesCache, setTerritoriesCache] = useState<
    Record<string, Territory[]>
  >({}); // areaId -> territories

  const [loadingZones, setLoadingZones] = useState(false);
  const [loadingRegions, setLoadingRegions] = useState<Record<string, boolean>>(
    {}
  );
  const [loadingAreas, setLoadingAreas] = useState<Record<string, boolean>>({});
  const [loadingTerritories, setLoadingTerritories] = useState<
    Record<string, boolean>
  >({});

  const loadZones = useCallback(async () => {
    try {
      setLoadingZones(true);
      const res = await api.get("/zones", { params: { limit: 1000 } });
      setZones(res.data.data || []);
    } catch {
      toast.error("Failed to load zones");
    } finally {
      setLoadingZones(false);
    }
  }, []);

  const loadRegionsForZone = useCallback(
    async (zoneId: string) => {
      if (!zoneId) return;
      if (regionsCache[zoneId]) return;
      try {
        setLoadingRegions((s) => ({ ...s, [zoneId]: true }));
        const res = await api.get("/regions", {
          params: { limit: 1000, zone: zoneId },
        });
        setRegionsCache((r) => ({ ...r, [zoneId]: res.data.data || [] }));
      } catch {
        toast.error("Failed to load regions");
      } finally {
        setLoadingRegions((s) => ({ ...s, [zoneId]: false }));
      }
    },
    [regionsCache]
  );

  const loadAreasForRegion = useCallback(
    async (regionId: string) => {
      if (!regionId) return;
      if (areasCache[regionId]) return;
      try {
        setLoadingAreas((s) => ({ ...s, [regionId]: true }));
        const res = await api.get("/areas", {
          params: { limit: 1000, region: regionId },
        });
        setAreasCache((a) => ({ ...a, [regionId]: res.data.data || [] }));
      } catch {
        toast.error("Failed to load areas");
      } finally {
        setLoadingAreas((s) => ({ ...s, [regionId]: false }));
      }
    },
    [areasCache]
  );

  const loadTerritoriesForArea = useCallback(
    async (areaId: string) => {
      if (!areaId) return;
      if (territoriesCache[areaId]) return;
      try {
        setLoadingTerritories((s) => ({ ...s, [areaId]: true }));
        const res = await api.get("/territories", {
          params: { limit: 1000, area: areaId },
        });
        setTerritoriesCache((t) => ({ ...t, [areaId]: res.data.data || [] }));
      } catch {
        toast.error("Failed to load territories");
      } finally {
        setLoadingTerritories((s) => ({ ...s, [areaId]: false }));
      }
    },
    [territoriesCache]
  );

  useEffect(() => {
    loadZones();
  }, [loadZones]);

  /* -------------------------
     Editor State: editing a single AccessDoc (zone + nested selection)
  -------------------------*/
  // local working copy while editing / creating
  const [workingAccess, setWorkingAccess] = useState<AccessDoc | null>(null);
  // track expanded nodes in tree for UX
  const [expandedZones, setExpandedZones] = useState<Record<string, boolean>>(
    {}
  );
  const [expandedRegions, setExpandedRegions] = useState<
    Record<string, boolean>
  >({});
  const [expandedAreas, setExpandedAreas] = useState<Record<string, boolean>>(
    {}
  );

  // when user selects a different access doc for edit, load its zone children into caches
  useEffect(() => {
    if (!selectedAccess) {
      setWorkingAccess(null);
      return;
    }
    // ensure selectedAccess is normalized
    const norm = normalizeAccessDoc(selectedAccess as any);
    setWorkingAccess(norm);
    // ensure the zone/regions/areas/territories are loaded for the selectedAccess
    const zoneId = norm.access.zone;
    if (zoneId) {
      loadRegionsForZone(zoneId);
      setExpandedZones((s) => ({ ...s, [zoneId]: true }));
      (norm.access.regions || []).forEach((r) => {
        loadAreasForRegion(r.region);
        setExpandedRegions((s) => ({ ...s, [r.region]: true }));
        (r.areas || []).forEach((a) => {
          loadTerritoriesForArea(a.area);
          setExpandedAreas((s) => ({ ...s, [a.area]: true }));
        });
      });
    }
  }, [
    selectedAccess,
    loadRegionsForZone,
    loadAreasForRegion,
    loadTerritoriesForArea,
  ]);

  /* -------------------------
     Helper: create empty access doc for selected user + zone
  -------------------------*/
  function newAccessTemplate(
    userId: string,
    zoneId: string | null = null
  ): AccessDoc {
    return {
      user: userId,
      access: {
        zone: zoneId || "",
        regions: [],
      },
    };
  }

  /* -------------------------
     Selection helpers (toggle region/area/territory)
     We treat the workingAccess as the single doc being edited.
  -------------------------*/
  const ensureWorking = () => {
    if (!workingAccess && selectedUser) {
      const tmp = newAccessTemplate(selectedUser._id);
      setWorkingAccess(tmp);
      return tmp;
    }
    return workingAccess;
  };

  function setZoneOnWorking(zoneId: string) {
    const copy: AccessDoc = workingAccess
      ? JSON.parse(JSON.stringify(workingAccess))
      : newAccessTemplate(selectedUser!._id, zoneId);
    copy.access.zone = zoneId;
    // optionally clear regions when switching zones (recommended)
    copy.access.regions = [];
    setWorkingAccess(copy);
    // load zone children
    loadRegionsForZone(zoneId);
    setExpandedZones((s) => ({ ...s, [zoneId]: true }));
  }

  function toggleRegion(regionId: string) {
    const w = ensureWorking();
    if (!w) return;
    const rIndex = w.access.regions.findIndex((r) => r.region === regionId);
    if (rIndex >= 0) {
      // remove region
      w.access.regions.splice(rIndex, 1);
    } else {
      // add region with empty areas
      w.access.regions.push({ region: regionId, areas: [] });
      loadAreasForRegion(regionId);
      setExpandedRegions((s) => ({ ...s, [regionId]: true }));
    }
    setWorkingAccess({ ...w });
  }

  function toggleArea(regionId: string, areaId: string) {
    const w = ensureWorking();
    if (!w) return;
    const region = w.access.regions.find((r) => r.region === regionId);
    if (!region) {
      // if region not present, add it and then add area
      w.access.regions.push({
        region: regionId,
        areas: [{ area: areaId, territories: [] }],
      });
      loadAreasForRegion(regionId);
      loadTerritoriesForArea(areaId);
      setExpandedRegions((s) => ({ ...s, [regionId]: true }));
      setExpandedAreas((s) => ({ ...s, [areaId]: true }));
      setWorkingAccess({ ...w });
      return;
    }
    const aIndex = region.areas.findIndex((a) => a.area === areaId);
    if (aIndex >= 0) {
      // remove area
      region.areas.splice(aIndex, 1);
    } else {
      // add area
      region.areas.push({ area: areaId, territories: [] });
      loadTerritoriesForArea(areaId);
      setExpandedAreas((s) => ({ ...s, [areaId]: true }));
    }
    setWorkingAccess({ ...w });
  }

  function toggleTerritory(
    regionId: string,
    areaId: string,
    territoryId: string
  ) {
    const w = ensureWorking();
    if (!w) return;
    let region = w.access.regions.find((r) => r.region === regionId);
    if (!region) {
      // add region + area + territory
      region = {
        region: regionId,
        areas: [{ area: areaId, territories: [territoryId] }],
      };
      w.access.regions.push(region);
      loadAreasForRegion(regionId);
      loadTerritoriesForArea(areaId);
      setExpandedRegions((s) => ({ ...s, [regionId]: true }));
      setExpandedAreas((s) => ({ ...s, [areaId]: true }));
      setWorkingAccess({ ...w });
      return;
    }
    let area = region.areas.find((a) => a.area === areaId);
    if (!area) {
      area = { area: areaId, territories: [territoryId] };
      region.areas.push(area);
      loadTerritoriesForArea(areaId);
      setExpandedAreas((s) => ({ ...s, [areaId]: true }));
      setWorkingAccess({ ...w });
      return;
    }
    const tIndex = area.territories.findIndex((t) => t === territoryId);
    if (tIndex >= 0) {
      area.territories.splice(tIndex, 1);
    } else {
      area.territories.push(territoryId);
    }
    setWorkingAccess({ ...w });
  }

  /* -------------------------
     Query helpers to check selection state (used to set checkbox state)
  -------------------------*/
  function isRegionSelected(regionId: string) {
    if (!workingAccess) return false;
    return workingAccess.access.regions.some((r) => r.region === regionId);
  }

  function isAreaSelected(regionId: string, areaId: string) {
    if (!workingAccess) return false;
    const region = workingAccess.access.regions.find(
      (r) => r.region === regionId
    );
    if (!region) return false;
    return region.areas.some((a) => a.area === areaId);
  }

  function isTerritorySelected(
    regionId: string,
    areaId: string,
    territoryId: string
  ) {
    if (!workingAccess) return false;
    const region = workingAccess.access.regions.find(
      (r) => r.region === regionId
    );
    if (!region) return false;
    const area = region.areas.find((a) => a.area === areaId);
    if (!area) return false;
    return area.territories.some((t) => t === territoryId);
  }

  /* -------------------------
     Save / Create / Delete operations
  -------------------------*/
  const saveWorkingAccess = async () => {
    if (!selectedUser) return toast.error("Choose a user first");
    if (!workingAccess) return toast.error("Nothing to save");
    if (!workingAccess.access.zone) return toast.error("Zone required");
    try {
      // sanitize payload to IDs-only
      const payload = sanitizePayloadForSave(workingAccess);
      if (workingAccess._id) {
        await api.put(`/user-location-access/${workingAccess._id}`, payload);
        toast.success("Saved");
        // refresh and re-select (fetchAccessDocs will normalize)
        await fetchAccessDocs(selectedUser._id);
      } else {
        // create
        payload.user = selectedUser._id;
        const res = await api.post("/user-location-access", payload);
        toast.success("Created");
        const createdRaw = res.data.data;
        const created = normalizeAccessDoc(createdRaw);
        // refresh user's docs list
        await fetchAccessDocs(selectedUser._id);
        setSelectedAccess(created);
        setWorkingAccess(created);
        return;
      }
      // after update ensure selectedAccess points to normalized doc if available
      if (selectedUser) {
        const found = accessDocs.find((a) => a._id === workingAccess._id);
        if (found) setSelectedAccess(found);
      }
    } catch (err: any) {
      console.error(err);
      const msg = err?.response?.data?.message || "Save failed";
      toast.error(msg);
    }
  };

  const deleteAccessDoc = async (docId?: string) => {
    if (!docId) return;
    if (!confirm("Delete this access entry?")) return;
    try {
      await api.delete(`/user-location-access/${docId}`);
      toast.success("Deleted");
      if (selectedUser) await fetchAccessDocs(selectedUser._id);
    } catch {
      toast.error("Delete failed");
    }
  };

  const startCreateNewForUser = (userId: string) => {
    const tmp = newAccessTemplate(userId);
    setWorkingAccess(tmp);
    setSelectedAccess(null);
    setCreating(true);
    setExpandedZones({});
    setExpandedRegions({});
    setExpandedAreas({});
  };

  function startEditDoc(d: any) {
    // accept either normalized or populated doc; produce normalized
    const normalized = normalizeAccessDoc(d);
    setWorkingAccess(normalized);
    setSelectedAccess(normalized);
    setCreating(false);

    // load region/areas/territories for doc
    if (normalized && normalized.access && normalized.access.zone) {
      loadRegionsForZone(normalized.access.zone);
      setExpandedZones((s) => ({ ...s, [normalized.access.zone]: true }));
      (normalized.access.regions || []).forEach((r) => {
        loadAreasForRegion(r.region);
        setExpandedRegions((s) => ({ ...s, [r.region]: true }));
        (r.areas || []).forEach((a) => {
          loadTerritoriesForArea(a.area);
          setExpandedAreas((s) => ({ ...s, [a.area]: true }));
        });
      });
    }
  }

  /* -------------------------
     Tree rendering components (recursive-ish)
  -------------------------*/
  function ZoneNode({ zone, idx }: { zone: Zone; idx: number }) {
    const isExpanded = Boolean(expandedZones[zone._id]);
    const onToggle = () => {
      setExpandedZones((s) => ({ ...s, [zone._id]: !s[zone._id] }));
      if (!regionsCache[zone._id]) loadRegionsForZone(zone._id);
    };

    // selecting a zone sets the workingAccess.zone (single zone per doc)
    const isActiveZone = workingAccess?.access?.zone === zone._id;

    return (
      <div key={zone._id} className="border rounded p-2 mb-2 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggle}
              className="p-1 rounded hover:bg-slate-100"
              aria-label={isExpanded ? "Collapse zone" : "Expand zone"}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>

            <div>
              <div className="text-sm font-medium">{zone.name}</div>
              <div className="text-xs text-muted-foreground">
                Zone ID: {zone._id}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={isActiveZone ? "outline" : "ghost"}
              onClick={() => {
                if (!selectedUser) return toast.error("Select a user first");
                setZoneOnWorking(zone._id);
                setCreating(true);
              }}
            >
              {isActiveZone ? "Editing" : "Use zone"}
            </Button>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-3 border-t pt-3 space-y-2">
            {loadingRegions[zone._id] ? (
              <div className="text-sm text-muted-foreground">
                Loading regions…
              </div>
            ) : (
              (regionsCache[zone._id] || []).map((r) => (
                <RegionNode key={r._id} region={r} zoneId={zone._id} />
              ))
            )}
            {/* if no regions */}
            {!loadingRegions[zone._id] &&
              (regionsCache[zone._id] || []).length === 0 && (
                <div className="text-xs text-muted-foreground">No regions</div>
              )}
          </div>
        )}
      </div>
    );
  }

  function RegionNode({ region, zoneId }: { region: Region; zoneId: string }) {
    const isExpanded = Boolean(expandedRegions[region._id]);
    const onToggle = () => {
      setExpandedRegions((s) => ({ ...s, [region._id]: !s[region._id] }));
      if (!areasCache[region._id]) loadAreasForRegion(region._id);
    };

    const selected = isRegionSelected(region._id);

    const indeterminateForRegion = (() => {
      // if some areas selected but not all, mark indeterminate
      const areas = areasCache[region._id] || [];
      if (!areas.length) return false;
      const selectedCount = areas.filter((a) =>
        isAreaSelected(region._id, a._id)
      ).length;
      return selectedCount > 0 && selectedCount < areas.length;
    })();

    return (
      <div className="pl-6" key={region._id}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggle}
              className="p-1 rounded hover:bg-slate-100"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>

            <label className="flex items-center gap-2 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={selected}
                ref={(el) => {
                  if (!el) return;
                  el.indeterminate = Boolean(
                    indeterminateForRegion && !selected
                  );
                }}
                onChange={() => toggleRegion(region._id)}
              />
              <div>
                <div className="text-sm">{region.name}</div>
                <div className="text-xs text-muted-foreground">
                  Region ID: {region._id}
                </div>
              </div>
            </label>
          </div>

          <div className="text-xs text-muted-foreground">
            <button
              className="text-sm underline"
              onClick={() => {
                // quick "select all areas in this region"
                const areas = areasCache[region._id] || [];
                if (areas.length === 0) return toast("No areas loaded");
                // ensure region exists
                const w = ensureWorking();
                if (!w) return;
                let reg = w.access.regions.find(
                  (rr) => rr.region === region._id
                );
                if (!reg) {
                  w.access.regions.push({
                    region: region._id,
                    areas: areas.map((a) => ({ area: a._id, territories: [] })),
                  });
                } else {
                  // replace areas with all
                  reg.areas = areas.map((a) => ({
                    area: a._id,
                    territories: [],
                  }));
                }
                setWorkingAccess({ ...w });
              }}
            >
              Select all areas
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-2 space-y-2">
            {loadingAreas[region._id] ? (
              <div className="text-xs text-muted-foreground">
                Loading areas…
              </div>
            ) : (
              (areasCache[region._id] || []).map((a) => (
                <AreaNode
                  key={a._id}
                  area={a}
                  regionId={region._id}
                  zoneId={zoneId}
                />
              ))
            )}
            {!loadingAreas[region._id] &&
              (areasCache[region._id] || []).length === 0 && (
                <div className="text-xs text-muted-foreground">No areas</div>
              )}
          </div>
        )}
      </div>
    );
  }

  function AreaNode({
    area,
    regionId,
    zoneId,
  }: {
    area: Area;
    regionId: string;
    zoneId: string;
  }) {
    const isExpanded = Boolean(expandedAreas[area._id]);
    const onToggle = () => {
      setExpandedAreas((s) => ({ ...s, [area._id]: !s[area._id] }));
      if (!territoriesCache[area._id]) loadTerritoriesForArea(area._id);
    };

    const selected = isAreaSelected(regionId, area._id);

    const indeterminateForArea = (() => {
      const terrs = territoriesCache[area._id] || [];
      if (!terrs.length) return false;
      const selCount = terrs.filter((t) =>
        isTerritorySelected(regionId, area._id, t._id)
      ).length;
      return selCount > 0 && selCount < terrs.length;
    })();

    return (
      <div className="pl-8" key={area._id}>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={selected}
              ref={(el) => {
                if (!el) return;
                el.indeterminate = Boolean(indeterminateForArea && !selected);
              }}
              onChange={() => toggleArea(regionId, area._id)}
            />
            <div>
              <div className="text-sm">{area.name}</div>
              <div className="text-xs text-muted-foreground">
                Area ID: {area._id}
              </div>
            </div>
          </label>

          <div className="text-xs text-muted-foreground">
            <button
              className="underline text-sm"
              onClick={() => {
                // select all territories under area
                const terrs = territoriesCache[area._id] || [];
                if (terrs.length === 0)
                  return toast.error("No territories loaded");
                const w = ensureWorking();
                if (!w) return;
                let region = w.access.regions.find(
                  (r) => r.region === regionId
                );
                if (!region) {
                  region = {
                    region: regionId,
                    areas: [
                      { area: area._id, territories: terrs.map((t) => t._id) },
                    ],
                  };
                  w.access.regions.push(region);
                } else {
                  let a = region.areas.find((x) => x.area === area._id);
                  if (!a)
                    region.areas.push({
                      area: area._id,
                      territories: terrs.map((t) => t._id),
                    });
                  else a.territories = terrs.map((t) => t._id);
                }
                setWorkingAccess({ ...w });
              }}
            >
              Select all territories
            </button>
          </div>
        </div>

        <div className="mt-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggle}
              className="p-1 rounded hover:bg-slate-100"
              aria-label={isExpanded ? "collapse area" : "expand area"}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
            <div className="text-xs text-muted-foreground">{/* spacing */}</div>
          </div>

          {isExpanded && (
            <div className="pl-8 mt-2 space-y-1">
              {loadingTerritories[area._id] ? (
                <div className="text-xs text-muted-foreground">
                  Loading territories…
                </div>
              ) : (
                (territoriesCache[area._id] || []).map((t) => (
                  <div key={t._id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isTerritorySelected(regionId, area._id, t._id)}
                      onChange={() =>
                        toggleTerritory(regionId, area._id, t._id)
                      }
                    />
                    <div className="text-sm">{t.name}</div>
                    <div className="text-xs text-muted-foreground">
                      — {t._id}
                    </div>
                  </div>
                ))
              )}
              {!loadingTerritories[area._id] &&
                (territoriesCache[area._id] || []).length === 0 && (
                  <div className="text-xs text-muted-foreground">
                    No territories
                  </div>
                )}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* -------------------------
     Top-level actions & rendering
  -------------------------*/
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Users className="w-5 h-5" /> User Location Access
          </h1>
          <p className="text-sm text-muted-foreground">
            Assign users to zones → regions → areas → territories.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded px-2">
            <Search className="w-4 h-4 text-slate-500 mr-1" />
            <Input
              placeholder="Search users..."
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              className="border-0 p-0"
            />
          </div>

          <Button
            onClick={() => {
              fetchUsers(userQuery);
            }}
          >
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Users column */}
        <div className="col-span-3">
          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium">Users</h3>
              <Badge className="bg-slate-100 text-slate-800">
                {allUsers.length}
              </Badge>
            </div>

            <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
              {usersLoading ? (
                <div className="text-sm text-muted-foreground">
                  Loading users…
                </div>
              ) : allUsers.length === 0 ? (
                <div className="text-sm text-muted-foreground">No users</div>
              ) : (
                allUsers.map((u) => {
                  const active = selectedUser?._id === u._id;
                  return (
                    <div
                      key={u._id}
                      onClick={() => {
                        setSelectedUser(u);
                        // clear working selections
                        console.log("Selected User:", u);
                        setWorkingAccess(null);
                        setCreating(false);
                      }}
                      className={`p-2 rounded-lg border flex items-center gap-3 cursor-pointer transition ${
                        active ? "bg-indigo-50 border-indigo-200" : "bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} src={u.profileImageUrl || null} />
                        <div>
                          <div className="font-medium">{u.name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {u.email}
                          </div>
                        </div>
                      </div>
                      <div className="ml-auto text-xs text-muted-foreground">
                        {/* placeholder */}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Access docs column */}
        <div className="col-span-3">
          <div className="bg-card border rounded-lg p-4 h-full">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium">Assigned Zones</h3>
              <Badge className="bg-slate-100 text-slate-800">
                {/* {accessDocs?.length} */}Test
              </Badge>
            </div>

            <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
              {accessLoading ? (
                <div className="text-sm text-muted-foreground">Loading…</div>
              ) : selectedUser ? (
                <>
                  <div className="flex gap-2 mb-2">
                    <Button
                      size="sm"
                      onClick={() => startCreateNewForUser(selectedUser?._id)}
                    >
                      <Plus className="w-4 h-4 mr-2" /> New
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => fetchAccessDocs(selectedUser?._id)}
                    >
                      Refresh
                    </Button>
                  </div>

                  {accessDocs?.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      No access assigned
                    </div>
                  ) : (
                    accessDocs?.map((d) => {
                      const zoneId = d?.access?.zone;
                      // resolve zone name if loaded
                      const z = zones.find((z) => z?._id === zoneId);
                      const title = z ? z.name : `Zone ${zoneId}`;
                      const active = selectedAccess?._id === d?._id;
                      // counts
                      const regionsCount = d?.access?.regions?.length || 0;
                      const areasCount = d?.access?.regions?.reduce(
                        (s, r) => s + (r?.areas?.length || 0),
                        0
                      );
                      const territoriesCount = d?.access?.regions?.reduce(
                        (s, r) =>
                          s +
                          (r?.areas?.reduce(
                            (ss, a) => ss + (a?.territories?.length || 0),
                            0
                          ) || 0),
                        0
                      );

                      console.log("Checking :", d);

                      return (
                        <div
                          key={d?._id}
                          className={`p-2 rounded border cursor-pointer transition ${
                            active
                              ? "bg-indigo-50 border-indigo-200"
                              : "bg-white"
                          }`}
                          onClick={() => startEditDoc(d)}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-medium">{title}</div>
                              <div className="text-xs text-muted-foreground">
                                R:{regionsCount} • A:{areasCount} • T:
                                {territoriesCount}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditDoc(d);
                                }}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteAccessDoc(d._id);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Select a user to view assignments
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Editor / Tree column */}
        <div className="col-span-6">
          <div className="bg-card border rounded-lg p-4 min-h-[60vh]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-lg font-medium">Editor</h3>
                <p className="text-sm text-muted-foreground">
                  Choose a zone (or "Use zone" from zone list), then pick
                  regions/areas/territories.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={async () => {
                    // preview workingAccess
                    console.log("preview", workingAccess);
                    toast.success("Preview output logged to console");
                  }}
                >
                  Preview
                </Button>

                <Button
                  onClick={async () => {
                    if (!workingAccess || !selectedUser) {
                      return toast.error("Select user and zone");
                    }
                    // basic create or update
                    await saveWorkingAccess();
                  }}
                >
                  <Check className="w-4 h-4 mr-2" /> Save
                </Button>
              </div>
            </div>

            {/* Editor body */}
            <div className="grid grid-cols-2 gap-4">
              {/* Left: Zone picker (list) */}
              <div className="p-3 border rounded-md max-h-[56vh] overflow-auto">
                <div className="text-sm font-medium mb-2">Zones</div>
                {loadingZones ? (
                  <div className="text-sm text-muted-foreground">
                    Loading zones…
                  </div>
                ) : zones.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No zones</div>
                ) : (
                  zones.map((z, i) => (
                    <div key={z._id} className="mb-2">
                      <ZoneNode zone={z} idx={i} />
                    </div>
                  ))
                )}
              </div>

              {/* Right: Working selection summary + tree (for selected zone in workingAccess) */}
              <div className="p-3 border rounded-md max-h-[56vh] overflow-auto">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-sm font-medium">Working Access</div>
                    <div className="text-xs text-muted-foreground">
                      {selectedUser
                        ? `User: ${selectedUser.name}`
                        : "No user selected"}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        // reset working
                        if (!selectedUser) return toast.error("Select user");
                        setWorkingAccess(newAccessTemplate(selectedUser._id));
                        setSelectedAccess(null);
                        setCreating(true);
                      }}
                    >
                      Reset
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        setWorkingAccess(null);
                        setSelectedAccess(null);
                        setCreating(false);
                      }}
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                {/* Zone select summary */}
                <div className="mb-3">
                  <label className="text-xs text-muted-foreground">
                    Selected Zone
                  </label>
                  <div className="mt-2">
                    <select
                      className="border rounded px-2 py-1 w-full"
                      value={
                        // defensive: workingAccess might still contain objects in odd cases; handle gracefully
                        workingAccess &&
                        workingAccess.access &&
                        typeof workingAccess.access.zone === "object"
                          ? (workingAccess.access.zone as any)._id
                          : workingAccess?.access?.zone || ""
                      }
                      onChange={(e) => {
                        const zoneId = e.target.value;
                        if (!selectedUser)
                          return toast.error("Select user first");
                        setZoneOnWorking(zoneId);
                      }}
                    >
                      <option value="">Choose zone</option>
                      {zones.map((z) => (
                        <option key={z._id} value={z._id}>
                          {z.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* If workingAccess.zone chosen, render region/area/territory tree for that zone */}
                {!workingAccess?.access?.zone ? (
                  <div className="text-sm text-muted-foreground">
                    Choose a zone to edit selections
                  </div>
                ) : (
                  <>
                    <div className="text-sm font-medium mb-2">
                      Selections (Zone:{" "}
                      {zones.find(
                        (z) =>
                          // defensive compare: workingAccess.access.zone might be object or string
                          z._id ===
                          (workingAccess &&
                          workingAccess.access &&
                          typeof workingAccess.access.zone === "object"
                            ? (workingAccess.access.zone as any)._id
                            : workingAccess.access.zone)
                      )?.name ||
                        (workingAccess &&
                        workingAccess.access &&
                        typeof workingAccess.access.zone === "object"
                          ? (workingAccess.access.zone as any).name
                          : workingAccess.access.zone)}
                      )
                    </div>

                    {/* Regions for this zone */}
                    <div className="space-y-2">
                      {loadingRegions[
                        typeof workingAccess.access.zone === "object"
                          ? (workingAccess.access.zone as any)._id
                          : workingAccess.access.zone
                      ] ? (
                        <div className="text-sm text-muted-foreground">
                          Loading regions…
                        </div>
                      ) : (
                        (
                          regionsCache[
                            typeof workingAccess.access.zone === "object"
                              ? (workingAccess.access.zone as any)._id
                              : workingAccess.access.zone
                          ] || []
                        ).map((r) => (
                          <RegionNode
                            key={r._id}
                            region={r}
                            zoneId={
                              typeof workingAccess.access.zone === "object"
                                ? (workingAccess.access.zone as any)._id
                                : workingAccess.access.zone
                            }
                          />
                        ))
                      )}
                      {(!regionsCache[
                        typeof workingAccess.access.zone === "object"
                          ? (workingAccess.access.zone as any)._id
                          : workingAccess.access.zone
                      ] ||
                        regionsCache[
                          typeof workingAccess.access.zone === "object"
                            ? (workingAccess.access.zone as any)._id
                            : workingAccess.access.zone
                        ].length === 0) &&
                        !loadingRegions[
                          typeof workingAccess.access.zone === "object"
                            ? (workingAccess.access.zone as any)._id
                            : workingAccess.access.zone
                        ] && (
                          <div className="text-xs text-muted-foreground">
                            No regions for this zone
                          </div>
                        )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* footer controls */}
            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Tip: pick a zone on the left, then choose regions and drill down
                to areas and territories.
              </div>

              <div className="flex items-center gap-2">
                {workingAccess?._id && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteAccessDoc(workingAccess._id)}
                  >
                    Delete Entry
                  </Button>
                )}
                <Button onClick={saveWorkingAccess}>
                  <Check className="w-4 h-4 mr-2" /> Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
