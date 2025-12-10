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
  UserPlus,
  Users,
  Search,
  Trash2,
  Check,
  Filter,
  Zap,
} from "lucide-react";

/* -------------------------
  Tiny UI helpers (replace with your own if present)
   - Avatar (initials or image)
   - Chip (user pill)
   - Small Badge
-------------------------*/

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

function Chip({
  user,
  selected,
  onClick,
  draggable,
  onDragStart,
}: {
  user: any;
  selected?: boolean;
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
}) {
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1 rounded-full border transition transform hover:scale-[1.02] cursor-pointer select-none ${
        selected
          ? "bg-indigo-50 border-indigo-200 shadow-sm"
          : "bg-white border-slate-100"
      }`}
      style={{ whiteSpace: "nowrap" }}
      title={user.email || user.name}
    >
      <Avatar name={user.name} src={(user as any).profileImageUrl} />
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{user.name}</div>
        <div className="text-xs text-muted-foreground truncate">
          {user.email}
        </div>
      </div>
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

type Warehouse = {
  _id: string;
  name: string;
  code?: string;
  notes?: string;
  assignedCount?: number;
};

/* -------------------------
  Main Component
-------------------------*/
export default function WarehouseAssignAwesomePage() {
  // warehouses
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [whLoading, setWhLoading] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(
    null
  );

  // users
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // assigned
  const [assignedUsers, setAssignedUsers] = useState<User[]>([]);
  const [assignedLoading, setAssignedLoading] = useState(false);

  // selection & UI
  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>({});
  const [userQuery, setUserQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [removing, setRemoving] = useState<Record<string, boolean>>({});

  // drag state
  const dragUserRef = useRef<string | null>(null);

  // debounce ref
  const debounceRef = useRef<number | null>(null);

  /* -------------------------
     Fetchers
  -------------------------*/
  const fetchWarehouses = useCallback(async () => {
    try {
      setWhLoading(true);
      const res = await api.get("/warehouses", { params: { limit: 100 } });
      setWarehouses(res.data.data || []);
    } catch (err) {
      toast.error("Failed to load warehouses");
    } finally {
      setWhLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async (q = "", role?: string | null) => {
    try {
      setUsersLoading(true);
      const params: any = { q: q || "" };
      if (role) params.role = role;
      // limit to something reasonable for chips area
      params.limit = 200;
      const res = await api.get("/users", { params });
      setAllUsers(res.data.data || []);
    } catch (err) {
      toast.error("Failed to load users");
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const fetchAssignedUsers = useCallback(async (warehouseId?: string) => {
    if (!warehouseId) {
      setAssignedUsers([]);
      return;
    }
    try {
      setAssignedLoading(true);
      const res = await api.get(`/warehouses/${warehouseId}/users`);
      setAssignedUsers(res.data.data || []);
    } catch (err) {
      toast.error("Failed to load assigned users");
    } finally {
      setAssignedLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWarehouses();
    fetchUsers();
  }, [fetchWarehouses, fetchUsers]);

  useEffect(() => {
    if (!selectedWarehouse) {
      setAssignedUsers([]);
      setSelectedMap({});
      return;
    }
    fetchAssignedUsers(selectedWarehouse._id);
    setSelectedMap({}); // clear selection when switching warehouse
  }, [selectedWarehouse, fetchAssignedUsers]);

  /* -------------------------
     Search debounce
  -------------------------*/
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      fetchUsers(userQuery.trim(), roleFilter);
    }, 300);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [userQuery, roleFilter, fetchUsers]);

  /* -------------------------
     Utilities & selection
  -------------------------*/
  const assignedIds = useMemo(
    () => new Set(assignedUsers.map((u) => u._id)),
    [assignedUsers]
  );

  const visibleUsers = allUsers; // could have sorting/filtering here

  const selectedCount = useMemo(
    () => Object.values(selectedMap).filter(Boolean).length,
    [selectedMap]
  );

  const toggleSelect = (id: string) => {
    if (assignedIds.has(id)) return; // don't select already assigned
    setSelectedMap((s) => ({ ...s, [id]: !s[id] }));
  };

  const clearSelection = () => setSelectedMap({});

  const selectAllVisible = () => {
    const next: Record<string, boolean> = { ...selectedMap };
    visibleUsers.forEach((u) => {
      if (!assignedIds.has(u._id)) next[u._id] = true;
    });
    setSelectedMap(next);
  };

  // keyboard shortcut: Ctrl/Cmd + A to select visible users
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = navigator.platform.includes("Mac") ? e.metaKey : e.ctrlKey;
      if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        selectAllVisible();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visibleUsers, assignedIds]);

  /* -------------------------
     Drag & Drop handlers (native)
    - Drag from available => drop on assigned area to assign (single or multi)
    - Drag from assigned => drop on available area to remove
  -------------------------*/
  const onDragStartAvailable = (e: React.DragEvent, userId: string) => {
    dragUserRef.current = userId;
    e.dataTransfer.setData("text/plain", userId);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragStartAssigned = (e: React.DragEvent, userId: string) => {
    dragUserRef.current = userId;
    e.dataTransfer.setData("text/plain", userId);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDropToAssigned = async (e: React.DragEvent) => {
    e.preventDefault();
    if (!selectedWarehouse) return toast.error("Select a warehouse first");
    const draggedId =
      e.dataTransfer.getData("text/plain") || dragUserRef.current;
    // if multiple selected, assign them; otherwise the single draggedId
    let toAssign = Object.keys(selectedMap).filter((k) => selectedMap[k]);
    if (!toAssign.length) toAssign = draggedId ? [draggedId] : [];
    // filter out already assigned
    toAssign = toAssign.filter((id) => !assignedIds.has(id));

    if (!toAssign.length) {
      dragUserRef.current = null;
      return;
    }

    try {
      setAssigning(true);
      await api.post(`/warehouses/${selectedWarehouse._id}/assign-users`, {
        userIds: toAssign,
      });
      toast.success(`${toAssign.length} user(s) assigned`);
      // optimistic update: append users from allUsers
      const newly = allUsers.filter((u) => toAssign.includes(u._id));
      setAssignedUsers((prev) => [...newly, ...prev]);
      // clear those from selection
      const next = { ...selectedMap };
      toAssign.forEach((id) => delete next[id]);
      setSelectedMap(next);
    } catch (err) {
      toast.error("Assign failed");
      fetchAssignedUsers(selectedWarehouse._id);
    } finally {
      setAssigning(false);
      dragUserRef.current = null;
    }
  };

  const onDropToAvailable = async (e: React.DragEvent) => {
    e.preventDefault();
    if (!selectedWarehouse) return;
    const draggedId =
      e.dataTransfer.getData("text/plain") || dragUserRef.current;
    const toRemove = draggedId ? [draggedId] : [];
    if (!toRemove.length) return;
    try {
      // remove each (serially for simplicity)
      for (const id of toRemove) {
        await api.delete(
          `/warehouses/${selectedWarehouse._id}/remove-user/${id}`
        );
        setAssignedUsers((prev) => prev.filter((u) => u._id !== id));
      }
      toast.success("User removed");
    } catch {
      toast.error("Remove failed");
      fetchAssignedUsers(selectedWarehouse._id);
    } finally {
      dragUserRef.current = null;
    }
  };

  /* -------------------------
     API actions for buttons
  -------------------------*/
  const assignSelected = async () => {
    if (!selectedWarehouse) return toast.error("Select a warehouse first");
    const userIds = Object.keys(selectedMap).filter((k) => selectedMap[k]);
    if (!userIds.length) return toast.error("Select users to assign");
    try {
      setAssigning(true);
      await api.post(`/warehouses/${selectedWarehouse._id}/assign-users`, {
        userIds,
      });
      const newly = allUsers.filter((u) => userIds.includes(u._id));
      setAssignedUsers((prev) => [...newly, ...prev]);
      toast.success(`${userIds.length} user(s) assigned`);
      clearSelection();
    } catch {
      toast.error("Assign failed");
      fetchAssignedUsers(selectedWarehouse._id);
    } finally {
      setAssigning(false);
    }
  };

  const removeAssigned = async (id: string) => {
    if (!selectedWarehouse) return;
    try {
      setRemoving((r) => ({ ...r, [id]: true }));
      await api.delete(
        `/warehouses/${selectedWarehouse._id}/remove-user/${id}`
      );
      setAssignedUsers((prev) => prev.filter((u) => u._id !== id));
      toast.success("User removed");
    } catch {
      toast.error("Remove failed");
      fetchAssignedUsers(selectedWarehouse._id);
    } finally {
      setRemoving((r) => {
        const next = { ...r };
        delete next[id];
        return next;
      });
    }
  };

  /* -------------------------
     Helper render pieces
  -------------------------*/
  const EmptyState = ({ text }: { text: string }) => (
    <div className="flex flex-col items-center justify-center py-12 text-center text-sm text-muted-foreground">
      <div className="w-24 h-24 rounded-full bg-slate-50 flex items-center justify-center mb-4">
        <Zap className="w-6 h-6 text-slate-400" />
      </div>
      <div>{text}</div>
    </div>
  );

  /* -------------------------
     JSX
  -------------------------*/
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Users className="w-5 h-5" /> Assign Users — Warehouses
          </h1>
          <p className="text-sm text-muted-foreground">
            Drag & drop users between Available and Assigned. Use multi-select
            to assign many at once.
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

          <div className="flex items-center gap-2">
            <select
              value={roleFilter ?? ""}
              onChange={(e) => setRoleFilter(e.target.value || null)}
              className="border rounded px-2 py-1"
              aria-label="Filter by role"
            >
              <option value="">All roles</option>
              <option value="sales">Sales</option>
              <option value="admin">Admin</option>
              <option value="ops">Ops</option>
            </select>
            <Button
              variant="ghost"
              onClick={() => {
                setRoleFilter(null);
                setUserQuery("");
                fetchUsers();
              }}
            >
              <Filter className="w-4 h-4 mr-2" /> Reset
            </Button>
            <Button
              onClick={() => {
                fetchWarehouses();
                fetchUsers(userQuery, roleFilter);
              }}
            >
              Refresh
            </Button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-12 gap-6">
        {/* Left: Warehouse cards */}
        <div className="col-span-4">
          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium">Warehouses</h3>
              <Badge className="bg-slate-100 text-slate-800">
                {warehouses.length}
              </Badge>
            </div>

            <div className="space-y-3 max-h-[66vh] overflow-auto pr-1">
              {whLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="h-14 rounded-md bg-slate-100 animate-pulse"
                    />
                  ))}
                </div>
              ) : warehouses.length === 0 ? (
                <EmptyState text="No warehouses found" />
              ) : (
                warehouses.map((w) => {
                  const active = selectedWarehouse?._id === w._id;
                  return (
                    <div
                      key={w._id}
                      onClick={() => setSelectedWarehouse(w)}
                      className={`p-3 rounded-lg border flex items-center justify-between gap-3 cursor-pointer transition-shadow hover:shadow-md ${
                        active ? "bg-indigo-50 border-indigo-200" : "bg-white"
                      }`}
                      role="button"
                      aria-pressed={active}
                    >
                      <div>
                        <div className="font-medium">{w.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {w.code}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <Badge className="bg-indigo-100 text-indigo-800">
                          {w.assignedCount ?? "—"} users
                        </Badge>
                        <div className="text-xs text-muted-foreground">→</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right: assign UI */}
        <div className="col-span-8">
          <div className="bg-card border rounded-lg p-4 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-medium">
                  {selectedWarehouse
                    ? selectedWarehouse.name
                    : "Select a warehouse"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {selectedWarehouse
                    ? `Code: ${selectedWarehouse.code ?? "—"}`
                    : "Choose a warehouse card on the left."}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Badge className="bg-slate-100 text-slate-800">
                  {selectedWarehouse ? "Selected" : "No selection"}
                </Badge>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSelectedWarehouse(null);
                    setAssignedUsers([]);
                    setSelectedMap({});
                  }}
                >
                  Clear
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Available users (left) */}
              <div className="p-3 border rounded-md">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h4 className="font-medium">Available Users</h4>
                    <Badge className="bg-slate-100 text-slate-800">
                      {visibleUsers.length}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {" "}
                      • {selectedCount} selected
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="ghost" onClick={selectAllVisible}>
                      Select all
                    </Button>
                    <Button variant="ghost" onClick={clearSelection}>
                      Clear
                    </Button>
                  </div>
                </div>

                <div
                  className="max-h-[52vh] overflow-auto divide-y"
                  // drop target (remove as needed)
                  onDragOver={(e) => e.preventDefault()}
                >
                  {usersLoading ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Loading users…
                    </div>
                  ) : visibleUsers.length === 0 ? (
                    <EmptyState text="No users to show" />
                  ) : (
                    visibleUsers.map((u) => {
                      const isAssigned = assignedIds.has(u._id);
                      const isSelected = Boolean(selectedMap[u._id]);
                      return (
                        <div
                          key={u._id}
                          className={`flex items-center justify-between gap-3 py-3 px-2 hover:bg-slate-50 transition`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected || isAssigned}
                              disabled={isAssigned}
                              onChange={() => toggleSelect(u._id)}
                              className="w-4 h-4"
                            />

                            <div
                              draggable={!isAssigned}
                              onDragStart={(e) =>
                                onDragStartAvailable(e, u._id)
                              }
                              className="flex items-center gap-3 cursor-grab"
                            >
                              <Avatar
                                name={u.name}
                                src={u.profileImageUrl || null}
                              />
                              <div className="min-w-0">
                                <div className="text-sm font-medium truncate">
                                  {u.name}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {u.email}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {isAssigned ? (
                              <Badge className="bg-green-100 text-green-800">
                                Assigned
                              </Badge>
                            ) : (
                              <Badge className="bg-slate-100 text-slate-800">
                                Available
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <Button
                    onClick={assignSelected}
                    disabled={
                      !selectedWarehouse || selectedCount === 0 || assigning
                    }
                  >
                    <Check className="w-4 h-4 mr-2" /> Assign{" "}
                    {selectedCount > 0 ? `(${selectedCount})` : ""}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setUserQuery("");
                      fetchUsers();
                    }}
                  >
                    Reset search
                  </Button>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Tip: drag a user chip into the Assigned panel to quickly add.
                  Use{" "}
                  <kbd className="px-1 py-0.5 border rounded">Ctrl/Cmd + A</kbd>{" "}
                  to select visible users.
                </div>
              </div>

              {/* Assigned users (right) */}
              <div
                className="p-3 border rounded-md"
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDropToAssigned}
              >
                <div className="sticky top-0 bg-white py-2">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">Assigned Users</h4>
                      <Badge className="bg-slate-100 text-slate-800">
                        {assignedUsers.length}
                      </Badge>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {assignedLoading ? "Refreshing…" : ""}
                    </div>
                  </div>
                </div>

                <div className="max-h-[52vh] overflow-auto space-y-2">
                  {assignedLoading ? (
                    <div className="p-4 text-sm text-muted-foreground">
                      Loading assigned users…
                    </div>
                  ) : assignedUsers.length === 0 ? (
                    <EmptyState
                      text={
                        selectedWarehouse
                          ? "No users assigned to this warehouse"
                          : "Select a warehouse to see assigned users"
                      }
                    />
                  ) : (
                    assignedUsers.map((u) => (
                      <div
                        key={u._id}
                        draggable
                        onDragStart={(e) => onDragStartAssigned(e, u._id)}
                        onDrop={onDropToAvailable}
                        className="flex items-center justify-between gap-3 p-2 border rounded"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar
                            name={u.name}
                            src={u.profileImageUrl || null}
                          />
                          <div>
                            <div className="font-medium">{u.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {u.email}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => removeAssigned(u._id)}
                            disabled={Boolean(removing[u._id])}
                            aria-label={`Remove ${u.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-3 text-xs text-muted-foreground">
                  Removing a user will revoke their access immediately.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>{" "}
      {/* grid */}
      <div className="text-sm text-muted-foreground">
        Pro tip: use the filters or search to find users quickly, then drag or
        assign in bulk.
      </div>
    </div>
  );
}
