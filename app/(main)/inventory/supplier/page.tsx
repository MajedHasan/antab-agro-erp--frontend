"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Edit, Eye, Plus, X } from "lucide-react";

type Media = {
  _id: string;
  originalName: string;
  url: string;
  fileType?: string;
  module?: string;
  folder?: string;
  size?: number;
  createdAt?: string;
};

type Supplier = {
  _id?: string;
  supplierName: string;
  ownerName?: string;
  contactPerson?: string;
  groupType?: string;
  contactPersonDesignation?: string;
  ownerPhone?: string;
  contactPersonPhone?: string;
  email?: string;
  address?: string;
  tinFile?: string | Media | null;
  binFile?: string | Media | null;
  nidFile?: string | Media | null;
  tradeLicenseFile?: string | Media | null;
  createdAt?: string;
};

const MEDIA_FIELDS = [
  "tinFile",
  "binFile",
  "nidFile",
  "tradeLicenseFile",
] as (keyof Supplier)[];

function resolveAbsoluteUrl(rawUrl?: string) {
  if (!rawUrl) return "";
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
  const env =
    typeof window !== "undefined" ? process.env.NEXT_PUBLIC_API_URL : undefined;
  const base = (env || "http://localhost:5001/api").replace(/\/api\/?$/, "");
  return `${base}${rawUrl.startsWith("/") ? rawUrl : "/" + rawUrl}`;
}

function formatBytes(bytes?: number) {
  if (bytes == null) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function SupplierPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);

  // table control
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // slide-over/form state
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<"create" | "edit" | "view">(
    "create"
  );
  const [activeSupplier, setActiveSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState<Supplier | null>(null);

  // preview modal for files
  const [previewMedia, setPreviewMedia] = useState<Media | null>(null);

  // track temp uploads during a panel session (so we delete them on cancel)
  const tempUploadedIdsRef = useRef<Set<string>>(new Set());
  // track originals to delete after save when replacing
  const originalsToDeleteRef = useRef<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emptyForm = useMemo(
    () =>
      ({
        supplierName: "",
        ownerName: "",
        contactPerson: "",
        groupType: "",
        contactPersonDesignation: "",
        ownerPhone: "",
        contactPersonPhone: "",
        email: "",
        address: "",
        tinFile: null,
        binFile: null,
        nidFile: null,
        tradeLicenseFile: null,
      } as Supplier),
    []
  );

  useEffect(() => {
    fetchSuppliers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, page, limit]);

  async function fetchSuppliers() {
    setLoading(true);
    try {
      const params: any = { page, limit };
      if (q) params.q = q;
      const res = await api.get("/supplier", { params });
      const data = res.data || {};
      // handle both your controller response shapes
      let list: Supplier[] = [];
      let tot = 0;
      if (Array.isArray(data.data)) {
        list = data.data;
        tot = data.total ?? list.length;
      } else if (Array.isArray(data?.data?.data)) {
        list = data.data.data;
        tot = data.data.total ?? list.length;
      } else {
        list = data.data ?? [];
        tot = data.total ?? list.length;
      }
      setSuppliers(list);
      setTotal(Number(tot || 0));
    } catch (err) {
      console.error(err);
      alert("Failed to load suppliers");
    } finally {
      setLoading(false);
    }
  }

  function toggleSelect(id: string) {
    setSelected((s) => {
      const c = new Set(s);
      if (c.has(id)) c.delete(id);
      else c.add(id);
      return c;
    });
  }
  function toggleSelectAll() {
    if (selected.size === suppliers.length && suppliers.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(suppliers.map((s) => s._id!).filter(Boolean)));
    }
  }

  async function handleBulkDelete() {
    if (!selected.size) return;
    if (!confirm(`Delete ${selected.size} suppliers and their files?`)) return;
    const ids = Array.from(selected);
    await Promise.allSettled(
      ids.map((id) => api.delete(`/supplier/${id}?hard=true`))
    );
    setSelected(new Set());
    await fetchSuppliers();
  }

  function openCreate() {
    setPanelMode("create");
    setActiveSupplier(null);
    setForm({ ...emptyForm });
    tempUploadedIdsRef.current = new Set();
    originalsToDeleteRef.current = new Set();
    setPanelOpen(true);
  }
  function openEdit(s: Supplier) {
    setPanelMode("edit");
    setActiveSupplier(s);
    // deep clone relevant fields to avoid mutating table state
    setForm({
      supplierName: s.supplierName || "",
      ownerName: s.ownerName || "",
      contactPerson: s.contactPerson || "",
      groupType: s.groupType || "",
      contactPersonDesignation: s.contactPersonDesignation || "",
      ownerPhone: s.ownerPhone || "",
      contactPersonPhone: s.contactPersonPhone || "",
      email: s.email || "",
      address: s.address || "",
      tinFile: s.tinFile ?? null,
      binFile: s.binFile ?? null,
      nidFile: s.nidFile ?? null,
      tradeLicenseFile: s.tradeLicenseFile ?? null,
    });
    tempUploadedIdsRef.current = new Set();
    originalsToDeleteRef.current = new Set();
    setPanelOpen(true);
  }
  function openView(s: Supplier) {
    setPanelMode("view");
    setActiveSupplier(s);
    setForm(null);
    setPanelOpen(true);
  }

  // upload to /media/upload?module=suppliers&folder=<field>
  async function handleFileChange(
    e: React.ChangeEvent<HTMLInputElement>,
    field: keyof Supplier
  ) {
    const file = e.target.files?.[0];
    if (!file || !form) {
      if (e.target) e.target.value = "";
      return;
    }
    const fd = new FormData();
    fd.append("file", file);

    try {
      const { data } = await api.post(
        `/media/upload?module=suppliers&folder=${field}`,
        fd,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      const media: Media = data?.data;
      if (!media || !media._id) throw new Error("Upload failed");

      // previous value
      const prev = (form as any)[field] as Media | string | null | undefined;

      // if prev was temp (in this session) => delete immediately
      if (
        prev &&
        typeof prev === "object" &&
        (prev as any)._id &&
        tempUploadedIdsRef.current.has((prev as any)._id)
      ) {
        const prevId = (prev as any)._id;
        try {
          await api.delete(`/media/${prevId}?hard=true`);
        } catch (err) {
          console.warn("failed to delete previous temp upload", prevId, err);
        }
        tempUploadedIdsRef.current.delete((prev as any)._id);
      }

      // if prev was original media (object or id) and not in temp set -> schedule deletion AFTER save
      if (
        prev &&
        ((typeof prev === "object" && (prev as any)._id) ||
          typeof prev === "string")
      ) {
        const prevId = typeof prev === "string" ? prev : (prev as any)._id;
        if (!tempUploadedIdsRef.current.has(prevId)) {
          originalsToDeleteRef.current.add(prevId);
        }
      }

      // mark new upload as temp
      tempUploadedIdsRef.current.add(media._id);

      // set form field to full media object (for preview)
      setForm((f) => ({ ...(f || {}), [field]: media }));
    } catch (err) {
      console.error("upload error", err);
      alert("Upload failed");
    } finally {
      if (e.target) e.target.value = "";
    }
  }

  // remove file from form (if temp -> delete immediately; if original -> schedule delete)
  async function removeFileFromForm(field: keyof Supplier) {
    if (!form) return;
    const prev = (form as any)[field] as Media | string | null | undefined;
    if (!prev) return;

    if (typeof prev === "object" && prev._id) {
      const id = prev._id;
      if (tempUploadedIdsRef.current.has(id)) {
        try {
          await api.delete(`/media/${id}?hard=true`);
        } catch (err) {
          console.warn("failed to delete temp", id, err);
        }
        tempUploadedIdsRef.current.delete(id);
      } else {
        originalsToDeleteRef.current.add(id);
      }
    } else if (typeof prev === "string") {
      originalsToDeleteRef.current.add(prev);
    }

    setForm((f) => ({ ...(f || {}), [field]: null }));
  }

  // cancel/close panel -> cleanup temp uploads if not submitting
  async function cleanupTempUploads() {
    const ids = Array.from(tempUploadedIdsRef.current);
    if (!ids.length) return;
    await Promise.allSettled(
      ids.map((id) => api.delete(`/media/${id}?hard=true`))
    );
    tempUploadedIdsRef.current = new Set();
  }

  async function onPanelClose() {
    if (!isSubmitting) {
      await cleanupTempUploads();
      originalsToDeleteRef.current = new Set();
    }
    setPanelOpen(false);
    setActiveSupplier(null);
    setForm(null);
  }

  // submit create/update
  async function handleSave() {
    if (!form) return;
    if (!form.supplierName || !form.supplierName.trim()) {
      alert("Supplier name required");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = { ...form };
      // convert media objects to ids
      MEDIA_FIELDS.forEach((f) => {
        const v = (form as any)[f];
        if (!v) payload[f] = undefined;
        else if (typeof v === "string") payload[f] = v;
        else if (typeof v === "object" && (v as any)._id)
          payload[f] = (v as any)._id;
      });

      if (panelMode === "edit" && activeSupplier && activeSupplier._id) {
        await api.put(`/supplier/${activeSupplier._id}`, payload);
        // delete originals scheduled
        const toDelete = Array.from(originalsToDeleteRef.current);
        if (toDelete.length) {
          await Promise.allSettled(
            toDelete.map((id) => api.delete(`/media/${id}?hard=true`))
          );
        }
      } else {
        // create
        await api.post("/supplier", payload);
        // temp uploads are now referenced by the created supplier, so we don't delete them
      }

      // success: reset temp trackers and refresh
      tempUploadedIdsRef.current = new Set();
      originalsToDeleteRef.current = new Set();
      await fetchSuppliers();
      setPanelOpen(false);
      setForm(null);
      setActiveSupplier(null);
      setSelected(new Set());
    } catch (err) {
      console.error("save failed", err);
      alert("Save failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteSupplier(id?: string) {
    if (!id) return;
    if (!confirm("Delete supplier and its files?")) return;
    try {
      await api.delete(`/supplier/${id}?hard=true`);
      await fetchSuppliers();
    } catch (err) {
      console.error(err);
      alert("Delete failed");
    }
  }

  // panel UI
  const panel = (
    <div
      className={`fixed inset-y-0 right-0 w-full max-w-xl transform bg-white shadow-xl z-50 ${
        panelOpen ? "translate-x-0" : "translate-x-full"
      } transition-transform`}
    >
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            {panelMode === "view"
              ? "View Supplier"
              : panelMode === "edit"
              ? "Edit Supplier"
              : "Create Supplier"}
          </h3>
          <p className="text-sm text-muted-foreground">
            Manage supplier & documents
          </p>
        </div>
        <div>
          <Button variant="ghost" onClick={() => onPanelClose()}>
            <X />
          </Button>
        </div>
      </div>

      <div className="p-4 overflow-y-auto h-[calc(100vh-90px)]">
        {panelMode === "view" && activeSupplier && (
          <div>
            <div className="text-2xl font-bold">
              {activeSupplier.supplierName}
            </div>
            <div className="text-sm text-muted-foreground">
              {activeSupplier.email}
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <strong>Owner</strong>
                <div>{activeSupplier.ownerName}</div>
              </div>
              <div>
                <strong>Owner Phone</strong>
                <div>{activeSupplier.ownerPhone}</div>
              </div>
              <div>
                <strong>Contact</strong>
                <div>{activeSupplier.contactPerson}</div>
              </div>
              <div>
                <strong>Contact Phone</strong>
                <div>{activeSupplier.contactPersonPhone}</div>
              </div>
              <div>
                <strong>Designation</strong>
                <div>{activeSupplier.contactPersonDesignation}</div>
              </div>
              <div>
                <strong>Group</strong>
                <div>{activeSupplier.groupType}</div>
              </div>
              <div className="col-span-2">
                <strong>Address</strong>
                <div>{activeSupplier.address}</div>
              </div>
            </div>

            <div className="mt-4">
              <strong>Files</strong>
              <div className="mt-3 flex gap-3 flex-wrap">
                {MEDIA_FIELDS.map((f) => {
                  const v = (activeSupplier as any)[f];
                  if (!v) return null;
                  const url =
                    typeof v === "object" && v?.url
                      ? resolveAbsoluteUrl((v as Media).url)
                      : "";
                  return (
                    <div key={String(f)} className="w-28 text-center">
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="block w-28 h-28 overflow-hidden rounded border"
                      >
                        {url ? (
                          <img
                            src={url}
                            alt={(v as Media).originalName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                            file
                          </div>
                        )}
                      </a>
                      <div className="text-xs mt-1">
                        {String(f).replace(/File$/, "")}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {(panelMode === "create" || panelMode === "edit") && form && (
          <div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Supplier name *</Label>
                <Input
                  value={form.supplierName}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...(f || {}),
                      supplierName: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label>Group type</Label>
                <Input
                  value={form.groupType || ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...(f || {}),
                      groupType: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label>Owner name</Label>
                <Input
                  value={form.ownerName || ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...(f || {}),
                      ownerName: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label>Owner phone</Label>
                <Input
                  value={form.ownerPhone || ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...(f || {}),
                      ownerPhone: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label>Contact person</Label>
                <Input
                  value={form.contactPerson || ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...(f || {}),
                      contactPerson: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label>Designation</Label>
                <Input
                  value={form.contactPersonDesignation || ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...(f || {}),
                      contactPersonDesignation: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label>Contact phone</Label>
                <Input
                  value={form.contactPersonPhone || ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...(f || {}),
                      contactPersonPhone: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  value={form.email || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...(f || {}), email: e.target.value }))
                  }
                />
              </div>
              <div className="col-span-2">
                <Label>Address</Label>
                <Input
                  value={form.address || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...(f || {}), address: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Documents */}
            <div className="mt-4">
              <strong>Documents</strong>
              <div className="grid grid-cols-2 gap-3 mt-2">
                {MEDIA_FIELDS.map((field) => {
                  const val = (form as any)[field] as
                    | Media
                    | string
                    | null
                    | undefined;
                  const url =
                    typeof val === "object" && val?.url
                      ? resolveAbsoluteUrl((val as Media).url)
                      : undefined;
                  return (
                    <div key={String(field)} className="border rounded p-3">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">
                          {String(field).replace(/File$/, "")}
                        </div>
                        <div className="flex items-center gap-2">
                          {val && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeFileFromForm(field)}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="mt-2">
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(e) => handleFileChange(e, field)}
                          className="block w-full text-sm"
                        />
                      </div>

                      {url && (
                        <div className="mt-3 flex items-start gap-3">
                          <div className="w-28 h-20 overflow-hidden rounded border">
                            <img
                              src={url}
                              alt="preview"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {(val as Media).originalName}
                            <div className="mt-2">
                              {formatBytes((val as Media).size)}
                            </div>
                            <div className="mt-1 text-xs">
                              <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600"
                              >
                                Open
                              </a>
                              <button
                                className="ml-3 text-xs text-muted-foreground"
                                onClick={() => setPreviewMedia(val as Media)}
                              >
                                Preview
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => onPanelClose()}>
                Cancel
              </Button>
              <Button onClick={() => handleSave()} disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Suppliers</h1>
          <p className="text-sm text-muted-foreground">
            Manage suppliers & documents
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Input
            placeholder="Search..."
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            className="w-64"
          />
          <Button variant="outline" onClick={() => fetchSuppliers()}>
            Refresh
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2" />
            Add
          </Button>
          <Button
            variant="destructive"
            onClick={handleBulkDelete}
            disabled={selected.size === 0}
          >
            <Trash2 className="mr-2" />
            Delete ({selected.size})
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-md border overflow-auto">
        <table className="w-full table-auto">
          <thead>
            <tr className="text-left">
              <th className="p-2">
                <input
                  type="checkbox"
                  checked={
                    selected.size === suppliers.length && suppliers.length > 0
                  }
                  onChange={toggleSelectAll}
                />
              </th>
              <th>Supplier</th>
              <th>Owner</th>
              <th>Contact</th>
              <th>Group</th>
              <th>Files</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-8">
                  No suppliers
                </td>
              </tr>
            )}
            {suppliers.map((s) => (
              <tr key={s._id} className="border-t">
                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={selected.has(s._id!)}
                    onChange={() => toggleSelect(s._id!)}
                  />
                </td>
                <td className="p-2">
                  <div className="font-medium">{s.supplierName}</div>
                  <div className="text-xs text-muted-foreground">{s.email}</div>
                </td>
                <td className="p-2">
                  <div>{s.ownerName}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.ownerPhone}
                  </div>
                </td>
                <td className="p-2">
                  <div>{s.contactPerson}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.contactPersonPhone}
                  </div>
                </td>
                <td className="p-2">{s.groupType}</td>
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    {MEDIA_FIELDS.map((f) => {
                      const v = (s as any)[f];
                      if (!v) return null;
                      const url =
                        typeof v === "object" && v?.url
                          ? resolveAbsoluteUrl((v as Media).url)
                          : "";
                      return (
                        <div
                          key={String(f)}
                          className="w-10 h-10 overflow-hidden rounded border"
                        >
                          {url ? (
                            <img
                              src={url}
                              alt={(v as Media).originalName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                              file
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </td>
                <td className="p-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openView(s)}
                      title="View"
                    >
                      <Eye />
                    </Button>
                    <Button size="sm" onClick={() => openEdit(s)} title="Edit">
                      <Edit />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteSupplier(s._id)}
                      title="Delete"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* pagination */}
        <div className="p-3 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {(page - 1) * limit + 1} - {Math.min(page * limit, total)}{" "}
            of {total}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="rounded border px-2 py-1"
            >
              {[10, 15, 25].map((n) => (
                <option key={n} value={n}>
                  {n}/page
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Prev
            </Button>
            <div className="px-2">{page}</div>
            <Button
              variant="outline"
              onClick={() => setPage((p) => p + 1)}
              disabled={page * limit >= total}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      {/* slide-over */}
      {panel}

      {/* preview modal */}
      {previewMedia && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
          onClick={() => setPreviewMedia(null)}
        >
          <div
            className="bg-white rounded p-6 max-w-3xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {previewMedia.originalName}
              </h3>
              <Button variant="ghost" onClick={() => setPreviewMedia(null)}>
                <X />
              </Button>
            </div>
            <div className="mt-4">
              <img
                src={resolveAbsoluteUrl(previewMedia.url)}
                alt={previewMedia.originalName}
                className="w-full object-contain max-h-[70vh]"
              />
              <div className="mt-3 text-sm text-muted-foreground">
                Module: {previewMedia.module} • Folder: {previewMedia.folder} •{" "}
                {formatBytes(previewMedia.size)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
