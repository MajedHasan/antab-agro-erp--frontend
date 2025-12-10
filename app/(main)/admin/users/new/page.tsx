"use client";
import { useEffect, useState } from "react";
import authApi from "@/lib/api";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function NewUserPage() {
  const router = useRouter();
  const [roles, setRoles] = useState([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    roleId: "",
    department: "",
  });

  const loadRoles = async () => {
    const res = await authApi.get("/roles");
    setRoles(res.data.data);
  };

  useEffect(() => {
    loadRoles();
  }, []);

  const submit = async (e: any) => {
    e.preventDefault();
    try {
      await authApi.post("/auth/register", form);
      toast.success("User created");
      router.push("/admin/users");
    } catch {
      toast.error("Failed to create user");
    }
  };

  return (
    <form onSubmit={submit} className="max-w-lg space-y-4">
      <h1 className="text-xl font-bold">Add User</h1>

      <input
        className="input"
        placeholder="Name"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />

      <input
        className="input"
        placeholder="Email"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
      />

      <input
        className="input"
        placeholder="Password"
        type="password"
        onChange={(e) => setForm({ ...form, password: e.target.value })}
      />

      <select
        className="input"
        onChange={(e) => setForm({ ...form, roleId: e.target.value })}
      >
        <option>Select Role</option>
        {roles.map((r: any) => (
          <option key={r._id} value={r._id}>
            {r.name}
          </option>
        ))}
      </select>

      <input
        className="input"
        placeholder="Department"
        onChange={(e) => setForm({ ...form, department: e.target.value })}
      />

      <button className="btn-primary">Save</button>
    </form>
  );
}
