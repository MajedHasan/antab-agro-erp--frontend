// app/(admin)/users/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Eye, Edit, Trash2, ToggleLeft } from "lucide-react";
import { SmartTable } from "@/components/common/SmartTable";
import { useCrud } from "@/hooks/useCrud";
import api from "@/lib/api";
import UserForm from "@/components/forms/UserForm";
import { toast } from "sonner";
import Image from "next/image";
import ProtectedPage from "@/components/global/ProtectedPage";

export default function UsersPage() {
  // useCrud gives full data management
  const {
    data,
    loading,
    total,
    page,
    limit,
    q,
    setQ,
    pageHandler,
    fetchAll,
    save,
    remove,
    getOne,
    editing,
    setEditing,
    sort,
    setSort,
    selectedIds,
    toggleSelect,
    clearSelection,
    bulkDelete,
  } = useCrud("users");

  const [open, setOpen] = useState(false); // create/edit dialog
  const [viewItem, setViewItem] = useState<any | null>(null);
  const [meta, setMeta] = useState<{ roles: any[]; permissions: any[] }>({
    roles: [],
    permissions: [],
  });

  // fetch meta: roles & permissions used in forms
  useEffect(() => {
    let mounted = true;
    Promise.all([api.get("/roles"), api.get("/permissions")])
      .then(([r1, r2]) => {
        if (!mounted) return;
        setMeta({
          roles: r1.data?.data ?? r1.data ?? [],
          permissions: r2.data?.data ?? r2.data ?? [],
        });
      })
      .catch((err) => console.error("meta fetch", err));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    // initial fetch
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = () => {
    setEditing(null);
    setOpen(true);
  };

  const handleEdit = async (row: any) => {
    try {
      const res = await getOne(row._id);
      setEditing(res);
      setOpen(true);
    } catch (err) {
      toast.error("Failed to fetch user");
    }
  };

  const handleView = async (row: any) => {
    try {
      const res = await getOne(row._id);
      setViewItem(res);
    } catch {
      toast.error("Failed to fetch details");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete user?")) return;
    try {
      await remove(id, true);
      toast.success("Deleted");
    } catch {
      toast.error("Delete failed");
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm("Deactivate user?")) return;
    try {
      await api.post(`/users/${id}/deactivate`);
      toast.success("User deactivated");
      fetchAll();
    } catch {
      toast.error("Failed to deactivate");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return toast.warning("No items selected");
    if (!confirm("Delete selected users?")) return;
    try {
      await bulkDelete(Array.from(selectedIds));
      toast.success("Deleted selected");
      clearSelection();
    } catch {
      toast.error("Bulk delete failed");
    }
  };

  const columns = useMemo(
    () => [
      {
        key: "avatar",
        title: "Avatar",
        render: (u: any) =>
          u.profileImageUrl ? (
            // Next Image requires width/height; keep small inline
            <div className="h-8 w-8 rounded-full overflow-hidden">
              {/* If you don't use next/image in this environment, replace with <img> */}
              <Image
                src={u.profileImageUrl}
                alt={u.name || "avatar"}
                width={32}
                height={32}
                className="object-cover"
              />
            </div>
          ) : (
            <div className="h-8 w-8 rounded-full bg-muted-foreground/20 flex items-center justify-center text-xs text-muted-foreground">
              {u.name?.[0]?.toUpperCase() ?? "U"}
            </div>
          ),
      },
      {
        key: "name",
        title: "Name",
        render: (u: any) => u.name,
        sortable: true,
      },
      {
        key: "email",
        title: "Email",
        render: (u: any) => u.email,
        sortable: true,
      },
      {
        key: "role",
        title: "Role",
        render: (u: any) => u.role?.name ?? "-",
        sortable: true,
      },
      {
        key: "department",
        title: "Dept",
        render: (u: any) => u.department ?? "-",
        sortable: true,
      },
      {
        key: "restricted",
        title: "Restricted",
        render: (u: any) => (u.restricted ? "Yes" : "No"),
        sortable: true,
      },
      {
        key: "actions",
        title: "Actions",
        render: (u: any) => (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => handleView(u)}>
              <Eye className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleEdit(u)}>
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDeactivate(u._id)}
            >
              <ToggleLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleDelete(u._id)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <ProtectedPage
      permissions={["users.view", "users.create", "users.edit", "users.delete"]}
      match="any"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Users</h1>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search users..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-[300px]"
            />
            <Button onClick={() => setSort(sort === "name" ? "-name" : "name")}>
              Sort by name
            </Button>
            <Button onClick={() => window.open(`/api/users/export?format=csv`)}>
              Export CSV
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete}>
              Delete selected
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> Add
                </Button>
              </DialogTrigger>
              <DialogContent>
                <h2 className="text-lg font-semibold mb-2">
                  {editing ? `Edit user` : `Create user`}
                </h2>
                <UserForm
                  defaultValues={editing}
                  roles={meta.roles}
                  permissions={meta.permissions}
                  onSaved={() => {
                    setOpen(false);
                    setEditing(null);
                    fetchAll();
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <SmartTable
          columns={columns}
          data={data}
          loading={loading}
          total={total}
          page={page}
          limit={limit}
          onPageChange={(p) => pageHandler(p)}
          selectable
          selectedIds={selectedIds}
          onToggleSelect={(id: string) => toggleSelect(id)}
          onSelectAll={(checked: boolean) => {
            if (checked) {
              // select all visible rows
              const ids = new Set(data.map((r: any) => r._id));
              // replace selection
              // directly set via hidden global (since hook toggleSelect toggles)
              // better to call clear then set
              // but we can't reach setSelectedIds here (internal). We'll emulate selection:
              // calling toggleSelect for each will correctly toggle in useCrud implementation.
              ids.forEach((id) => toggleSelect(id));
              return;
            } else {
              // clear
              clearSelection();
            }
          }}
          onSortChange={(key: string, direction: "asc" | "desc") =>
            setSort(direction === "desc" ? `-${key}` : key)
          }
          sortKey={sort?.replace(/^-/, "")}
          sortDirection={sort?.startsWith("-") ? "desc" : "asc"}
        />

        {/* View modal */}
        <Dialog open={!!viewItem} onOpenChange={() => setViewItem(null)}>
          <DialogContent>
            <h2 className="text-lg font-semibold mb-2">User details</h2>
            {viewItem ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <strong>Name:</strong> {viewItem.name}
                </div>
                <div>
                  <strong>Email:</strong> {viewItem.email}
                </div>
                <div>
                  <strong>Role:</strong> {viewItem.role?.name ?? "-"}
                </div>
                <div>
                  <strong>Department:</strong> {viewItem.department ?? "-"}
                </div>
                <div>
                  <strong>Restricted:</strong>{" "}
                  {viewItem.restricted ? "Yes" : "No"}
                </div>
                <div>
                  <strong>Permissions:</strong>{" "}
                  {(viewItem.permissions || []).join(", ") ||
                    (viewItem.role?.permissions || []).join(", ")}
                </div>
                <div className="col-span-2">
                  <pre className="text-xs text-muted-foreground">
                    {JSON.stringify(viewItem, null, 2)}
                  </pre>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedPage>
  );
}
