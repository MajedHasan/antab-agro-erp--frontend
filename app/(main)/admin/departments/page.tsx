"use client";
import React, { useEffect, useState } from "react";
import authApi from "@/lib/api";
import { Table } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function DepartmentsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState("");

  const fetch = async () => {
    const res = await authApi.get("/departments");
    setItems(res.data.data || res.data);
  };

  useEffect(() => {
    fetch();
  }, []);

  const add = async () => {
    if (!name.trim()) return;
    await authApi.post("/departments", { name });
    setName("");
    fetch();
    toast.success("Added");
  };

  const remove = async (id: string) => {
    if (!confirm("Delete?")) return;
    await authApi.delete(`/departments/${id}`);
    fetch();
    toast.success("Deleted");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Departments</h1>
        <div className="flex gap-2">
          <Input
            placeholder="New department"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button onClick={add}>Add</Button>
        </div>
      </div>

      <Table
        columns={[
          { key: "name", title: "Department", render: (d: any) => d.name },
          {
            key: "actions",
            title: "Actions",
            render: (d: any) => (
              <Button variant="ghost" onClick={() => remove(d._id)}>
                Delete
              </Button>
            ),
          },
        ]}
        data={items}
      />
    </div>
  );
}
