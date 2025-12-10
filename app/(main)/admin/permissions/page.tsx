// app/(admin)/permissions/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table } from "@/components/ui/table";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

export default function PermissionsPage() {
  const [perms, setPerms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // edit/create modal state
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await api.get("/permissions?limit=100");
      setPerms(res.data.data ?? res.data ?? []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
  }, []);

  const openNew = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setShowModal(true);
  };

  const edit = (p: any) => {
    setEditing(p);
    setName(p.name);
    setDescription(p.description || "");
    setShowModal(true);
  };

  const save = async () => {
    if (!name.trim()) return toast.error("Name required");
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
      };
      if (editing) await api.put(`/permissions/${editing._id}`, payload);
      else await api.post("/permissions", payload);
      setShowModal(false);
      fetch();
      toast.success("Saved");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to save");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete permission?")) return;
    try {
      await api.delete(`/permissions/${id}?hard=true`);
      fetch();
      toast.success("Deleted");
    } catch {
      toast.error("Delete failed");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Permissions</h1>
        <div className="flex items-center gap-2">
          <Button onClick={openNew}>+ Add Permission</Button>
        </div>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <Table>
          <thead>
            <tr>
              <th className="text-left p-3">Permission</th>
              <th className="text-left p-3">Description</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="p-3 text-center">
                  Loading...
                </td>
              </tr>
            ) : perms.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-3 text-center">
                  No permissions
                </td>
              </tr>
            ) : (
              perms.map((p) => (
                <tr key={p._id}>
                  <td className="p-3">{p.name}</td>
                  <td className="p-3">{p.description ?? "-"}</td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => edit(p)}>
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => remove(p._id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <h3 className="text-lg font-semibold mb-3">
            {editing ? "Edit Permission" : "Create Permission"}
          </h3>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">
                Name (e.g. invoice.create)
              </label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Description (optional)
              </label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button onClick={save}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
