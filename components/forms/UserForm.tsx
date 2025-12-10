// components/forms/UserForm.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import MultiSelect from "@/components/common/MultiSelect";
import api from "@/lib/api";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import Image from "next/image";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6).optional(),
  roleId: z.string().min(1),
  department: z.string().optional(),
  permissions: z.array(z.string()).optional(),
  restricted: z.boolean().optional(),
  profileImageUrl: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function UserForm({
  defaultValues,
  roles = [],
  permissions = [],
  onSaved,
}: {
  defaultValues?: any;
  roles?: any[];
  permissions?: any[];
  onSaved?: () => void;
}) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      roleId: "",
      department: "",
      permissions: [],
      restricted: false,
      profileImageUrl: "",
      ...defaultValues,
      roleId: defaultValues?.role?._id ?? defaultValues?.role ?? "",
    },
  });

  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(
    defaultValues?.profileImageUrl ?? null
  );

  useEffect(() => {
    reset({
      ...defaultValues,
      roleId: defaultValues?.role?._id ?? defaultValues?.role ?? "",
      permissions: defaultValues?.permissions ?? [],
      restricted: defaultValues?.restricted ?? false,
      profileImageUrl: defaultValues?.profileImageUrl ?? "",
    });
    setPreview(defaultValues?.profileImageUrl ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValues]);

  async function uploadFile(file: File) {
    // Try upload endpoint first; if not available, send base64 as fallback
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api.post("/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUploading(false);
      return res.data?.url ?? res.data?.data?.url;
    } catch (err) {
      // fallback: convert to base64 and return data URI
      try {
        const reader = await new Promise<string | ArrayBuffer | null>(
          (resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result);
            r.onerror = reject;
            r.readAsDataURL(file);
          }
        );
        setUploading(false);
        return typeof reader === "string" ? reader : null;
      } catch (e) {
        setUploading(false);
        return null;
      }
    }
  }

  const onSubmit = async (data: FormValues) => {
    try {
      const payload: any = {
        ...data,
        role: data.roleId,
        profileImageUrl: data.profileImageUrl,
      };
      if (!payload.password) delete payload.password;

      if (defaultValues?._id) {
        await api.put(`/users/${defaultValues._id}`, payload);
        toast.success("User updated");
      } else {
        await api.post("/users", payload);
        toast.success("User created");
      }
      onSaved?.();
    } catch (err: any) {
      console.error("UserForm submit error", err);
      toast.error(err?.response?.data?.message || "Save failed");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Name</label>
          <Input {...register("name")} />
          {errors.name && (
            <p className="text-sm text-red-600">{errors.name.message}</p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium">Email</label>
          <Input {...register("email")} />
          {errors.email && (
            <p className="text-sm text-red-600">{errors.email.message}</p>
          )}
        </div>

        {!defaultValues?._id && (
          <div>
            <label className="text-sm font-medium">Password</label>
            <Input type="password" {...register("password")} />
            {errors.password && (
              <p className="text-sm text-red-600">{errors.password.message}</p>
            )}
          </div>
        )}

        <div>
          <label className="text-sm font-medium">Role</label>
          <Select
            onValueChange={(v) => setValue("roleId", v)}
            value={watch("roleId")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r: any) => (
                <SelectItem key={r._id} value={r._id}>
                  {r.name} {r.isSystem ? "• system" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.roleId && (
            <p className="text-sm text-red-600">{errors.roleId.message}</p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium">Department</label>
          <Input {...register("department")} placeholder="Department" />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Extra Permissions</label>
        <MultiSelect
          options={permissions.map((p: any) => ({
            label: `${p.name}${p.description ? ` — ${p.description}` : ""}`,
            value: p.name,
          }))}
          selected={watch("permissions") || []}
          onChange={(v) => setValue("permissions", v)}
        />
      </div>

      <div className="flex items-center gap-3">
        <Switch
          checked={watch("restricted")}
          onCheckedChange={(val) => setValue("restricted", !!val)}
        />
        <label className="text-sm">Restricted</label>
      </div>

      <div>
        <label className="text-sm font-medium">Profile image</label>
        <div className="flex items-center gap-3">
          <div className="h-16 w-16 rounded overflow-hidden bg-muted-foreground/10 flex items-center justify-center">
            {preview ? (
              <Image
                src={preview}
                alt="avatar"
                width={64}
                height={64}
                className="object-cover"
              />
            ) : (
              <div className="text-sm text-muted-foreground">No image</div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const url = await uploadFile(file);
                if (!url) return toast.error("Upload failed");
                setValue("profileImageUrl", url);
                setPreview(url);
              }}
            />
            <Input
              placeholder="Or paste image URL"
              value={watch("profileImageUrl") || ""}
              onChange={(e) => {
                setValue("profileImageUrl", e.target.value);
                setPreview(e.target.value || null);
              }}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isSubmitting || uploading}>
          {isSubmitting || uploading ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  );
}
