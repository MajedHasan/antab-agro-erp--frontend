"use client";

import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import MultiSelect from "@/components/common/MultiSelect";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DataTable } from "@/components/common/data-table";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from "@/components/ui/tooltip";

interface RoleForm {
  name: string;
  department: string;
  permissions: string[];
  inherits: string[];
  isSystem: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  invoices: "bg-blue-200 text-blue-800",
  campaigns: "bg-green-200 text-green-800",
  deals: "bg-purple-200 text-purple-800",
  reports: "bg-orange-200 text-orange-800",
  "*": "bg-red-200 text-red-800", // super admin
};

const getCategory = (perm: string) => perm.split(".")[0] || perm;

export default function RolesPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [perms, setPerms] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<RoleForm>({
    name: "",
    department: "",
    permissions: [],
    inherits: [],
    isSystem: false,
  });

  const fetchData = async () => {
    try {
      const [rolesRes, permsRes] = await Promise.all([
        api.get("/roles?limit=100"),
        api.get("/permissions?limit=100"),
      ]);
      setRoles(rolesRes.data.data ?? rolesRes.data ?? []);
      setPerms(permsRes.data.data ?? permsRes.data ?? []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load roles or permissions");
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm({
      name: "",
      department: "",
      permissions: [],
      inherits: [],
      isSystem: false,
    });
    setShowModal(true);
  };

  const openEdit = (role: any) => {
    setEditing(role);
    setForm({
      name: role.name,
      department: role.department || "",
      permissions: (role.permissions || []).map((p: any) =>
        typeof p === "object" ? p._id : p
      ),
      inherits: (role.inherits || []).map((r: any) =>
        typeof r === "object" ? r._id : r
      ),
      isSystem: !!role.isSystem,
    });
    setShowModal(true);
  };

  const saveRole = async () => {
    try {
      if (!form.name.trim()) return toast.error("Role name is required");

      const payload = {
        name: form.name.trim(),
        department: form.department || undefined,
        permissions: form.isSystem ? [] : form.permissions,
        inherits: form.isSystem ? [] : form.inherits,
        isSystem: form.isSystem,
      };

      if (editing) await api.put(`/roles/${editing._id}`, payload);
      else await api.post("/roles", payload);

      setShowModal(false);
      fetchData();
      toast.success("Role saved successfully");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to save role");
    }
  };

  const deleteRole = async (id: string, isSystem?: boolean) => {
    if (isSystem) return;
    if (!confirm("Are you sure you want to delete this role?")) return;

    try {
      await api.delete(`/roles/${id}`);
      fetchData();
      toast.success("Role deleted successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete role");
    }
  };

  /** Compute effective permissions including inheritance */
  const computeEffectivePermissions = (role: any) => {
    if (role.isSystem) return new Map([["*", null]]); // system role

    const visited = new Set<string>();
    const collected = new Map<string, string | null>(); // permission -> source role name

    (role.permissions || []).forEach((p: any) =>
      collected.set(typeof p === "object" ? p.name : p, null)
    );

    const walk = (roleIds: string[] = []) => {
      roleIds.forEach((rid) => {
        if (visited.has(rid)) return;
        visited.add(rid);

        const parentRole = roles.find((r) => r._id === rid);
        if (!parentRole) return;

        (parentRole.permissions || []).forEach((p: any) => {
          const permName = typeof p === "object" ? p.name : p;
          if (!collected.has(permName))
            collected.set(permName, parentRole.name);
        });

        if (parentRole.inherits?.length) {
          walk(
            parentRole.inherits.map((i: any) =>
              typeof i === "object" ? i._id : i
            )
          );
        }
      });
    };

    walk(role.inherits?.map((i: any) => (typeof i === "object" ? i._id : i)));
    return collected;
  };

  const columns = [
    { id: "name", header: "Name", accessorKey: "name" },
    { id: "department", header: "Department", accessorKey: "department" },
    {
      id: "permissions",
      header: "Permissions",
      cell: ({ row }: any) => {
        const permsMap = computeEffectivePermissions(row.original);
        const permsArray = Array.from(permsMap.entries());

        return (
          <div className="flex flex-wrap gap-1">
            {permsArray.map(([p, source]) => {
              const cat = getCategory(p);
              const colorClass =
                CATEGORY_COLORS[cat] ?? "bg-gray-200 text-gray-800";

              return (
                <Tooltip
                  key={p}
                  content={source ? `Inherited from ${source}` : ""}
                >
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs ${colorClass}`}
                  >
                    {p}
                  </span>
                </Tooltip>
              );
            })}
          </div>
        );
      },
    },
    {
      id: "system",
      header: "System",
      cell: ({ row }: any) => (row.original.isSystem ? "Yes" : "No"),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }: any) => {
        const r = row.original;
        return (
          <div className="flex gap-2">
            {!r.isSystem && (
              <>
                <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteRole(r._id, r.isSystem)}
                >
                  Delete
                </Button>
              </>
            )}
            {r.isSystem && (
              <span className="text-muted-foreground text-sm">Locked</span>
            )}
          </div>
        );
      },
    },
  ];

  const roleOptions = roles.map((r) => ({ label: r.name, value: r._id }));
  const permOptions = perms.map((p: any) => ({
    label: p.name + (p.description ? ` — ${p.description}` : ""),
    value: p._id,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Roles</h1>
        <Button onClick={openNew}>+ Add Role</Button>
      </div>

      <DataTable columns={columns} data={roles} />

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <h3 className="text-lg font-semibold mb-3">
            {editing ? "Edit Role" : "Create Role"}
          </h3>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Role Name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Department (optional)
              </label>
              <Input
                value={form.department}
                onChange={(e) =>
                  setForm({ ...form, department: e.target.value })
                }
                placeholder="Department"
              />
            </div>

            {form.isSystem ? (
              <p className="text-sm text-muted-foreground mt-2">
                System roles automatically have all permissions and cannot be
                modified.
              </p>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Permissions
                  </label>
                  <MultiSelect
                    options={permOptions}
                    selected={form.permissions}
                    onChange={(v) => setForm({ ...form, permissions: v })}
                    placeholder="Select permissions"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Inherits Roles
                  </label>
                  <MultiSelect
                    options={roleOptions.filter(
                      (o) => o.value !== editing?._id
                    )}
                    selected={form.inherits}
                    onChange={(v) => setForm({ ...form, inherits: v })}
                    placeholder="Select roles to inherit"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Permissions from inherited roles will also apply.
                  </p>
                </div>
              </>
            )}

            <div className="flex items-center gap-3 mt-2">
              <Switch
                checked={form.isSystem}
                onCheckedChange={(val) => setForm({ ...form, isSystem: !!val })}
              />
              <label className="text-sm">System Role (Super Admin)</label>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button onClick={saveRole}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
