"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Trash2,
  Edit,
  Eye,
  Plus,
  X,
  Search,
  RefreshCw,
  Upload,
  FileText,
  FileCheck2,
  Image as ImageIcon,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  ShieldAlert,
  ExternalLink,
  FileWarning,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import Protected from "@/components/auth/Protected";
import usePermissionCheck from "@/hooks/usePermissionCheck";

/* =========================== Types =========================== */
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

type MediaField = "tinFile" | "binFile" | "nidFile" | "tradeLicenseFile";

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

const MEDIA_FIELDS: MediaField[] = [
  "tinFile",
  "binFile",
  "nidFile",
  "tradeLicenseFile",
];

const MEDIA_LABELS: Record<MediaField, string> = {
  tinFile: "TIN Certificate",
  binFile: "BIN Certificate",
  nidFile: "NID",
  tradeLicenseFile: "Trade License",
};

const GROUP_BADGE: Record<string, string> = {
  "Raw Materials":
    "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20",
  "Packing Materials":
    "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/20",
  Stationary:
    "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/20",
  Equipment:
    "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20",
  Furniture:
    "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20",
};

/* =========================== Helpers =========================== */
function resolveAbsoluteUrl(rawUrl?: string) {
  if (!rawUrl) return "";
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
  const env =
    typeof window !== "undefined" ? process.env.NEXT_PUBLIC_API_URL : undefined;
  const base = (env || "http://localhost:5001/api").replace(/\/api\/?$/, "");
  return `${base}${rawUrl.startsWith("/") ? rawUrl : "/" + rawUrl}`;
}

function formatBytes(bytes?: number) {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function mediaUrl(v: string | Media | null | undefined): string {
  if (!v) return "";
  if (typeof v === "string") return resolveAbsoluteUrl(v);
  return resolveAbsoluteUrl(v.url);
}

function mediaName(v: string | Media | null | undefined): string {
  if (!v) return "";
  if (typeof v === "string") return v.split("/").pop() || v;
  return v.originalName;
}

function isPdf(v: string | Media | null | undefined): boolean {
  if (!v) return false;
  if (typeof v === "object" && v.fileType) {
    return v.fileType.toLowerCase().includes("pdf");
  }
  return mediaUrl(v).toLowerCase().endsWith(".pdf");
}

/* =========================== Page =========================== */
export default function SupplierPage() {
  return (
    <Protected
      permissions={[
        "supplier.view",
        "supplier.create",
        "supplier.edit",
        "supplier.delete",
        "supplier.approve",
        "supplier.reject",
      ]}
    >
      <SupplierPageInner />
    </Protected>
  );
}

/* =========================== Inner =========================== */
function SupplierPageInner() {
  const hasAccess = usePermissionCheck();
  const canCreate = hasAccess({ permissions: "supplier.create" });
  const canEdit = hasAccess({ permissions: "supplier.edit" });
  const canDelete = hasAccess({ permissions: "supplier.delete" });

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<"create" | "edit" | "view">(
    "create"
  );
  const [activeSupplier, setActiveSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState<Supplier | null>(null);

  const [previewMedia, setPreviewMedia] = useState<Media | null>(null);

  const tempUploadedIdsRef = useRef<Set<string>>(new Set());
  const originalsToDeleteRef = useRef<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emptyForm = useMemo<Supplier>(
    () => ({
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
    }),
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

  async function handleFileChange(
    e: React.ChangeEvent<HTMLInputElement>,
    field: MediaField
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
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      const media: Media = data?.data;
      if (!media || !media._id) throw new Error("Upload failed");

      const prev = form[field];

      if (
        prev &&
        typeof prev === "object" &&
        prev._id &&
        tempUploadedIdsRef.current.has(prev._id)
      ) {
        try {
          await api.delete(`/media/${prev._id}?hard=true`);
        } catch (err) {
          console.warn("failed to delete previous temp upload", prev._id, err);
        }
        tempUploadedIdsRef.current.delete(prev._id);
      }

      if (prev) {
        const prevId = typeof prev === "string" ? prev : prev._id;
        if (!tempUploadedIdsRef.current.has(prevId)) {
          originalsToDeleteRef.current.add(prevId);
        }
      }

      tempUploadedIdsRef.current.add(media._id);

      // ✅ FIX: cast — computed key `[field]` widens the type
      setForm((f) => ({ ...(f ?? emptyForm), [field]: media }) as Supplier);
    } catch (err) {
      console.error("upload error", err);
      alert("Upload failed");
    } finally {
      if (e.target) e.target.value = "";
    }
  }

  async function removeFileFromForm(field: MediaField) {
    if (!form) return;
    const prev = form[field];
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

    // ✅ FIX: cast — same computed-key issue
    setForm((f) => ({ ...(f ?? emptyForm), [field]: null }) as Supplier);
  }

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

  async function handleSave() {
    if (!form) return;
    if (!form.supplierName || !form.supplierName.trim()) {
      alert("Supplier name required");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = { ...form };
      MEDIA_FIELDS.forEach((f) => {
        const v = form[f];
        if (!v) payload[f] = undefined;
        else if (typeof v === "string") payload[f] = v;
        else if (typeof v === "object" && v._id) payload[f] = v._id;
      });

      if (panelMode === "edit" && activeSupplier?._id) {
        await api.put(`/supplier/${activeSupplier._id}`, payload);
        const toDelete = Array.from(originalsToDeleteRef.current);
        if (toDelete.length) {
          await Promise.allSettled(
            toDelete.map((id) => api.delete(`/media/${id}?hard=true`))
          );
        }
      } else {
        await api.post("/supplier", payload);
      }

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

  const showCheckboxCol = canDelete;
  const colCount = showCheckboxCol ? 7 : 6;

  /* =========================== Slide-over panel =========================== */
  const panel = (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px] transition-opacity ${
          panelOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onPanelClose}
        aria-hidden
      />

      {/* Panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col bg-white shadow-2xl transition-transform duration-300 dark:bg-slate-950 ${
          panelOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              {panelMode === "view"
                ? "Supplier Details"
                : panelMode === "edit"
                  ? "Edit Supplier"
                  : "New Supplier"}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {panelMode === "view"
                ? "Review supplier information and documents"
                : "Manage supplier information and documents"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onPanelClose}
            className="h-9 w-9 shrink-0 text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* ---- VIEW ---- */}
          {panelMode === "view" && activeSupplier && (
            <div className="space-y-6">
              {/* Header card */}
              <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-white p-5 ring-1 ring-slate-200 dark:from-slate-900 dark:to-slate-950 dark:ring-slate-800">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#3aa838]/10 text-[#3aa838]">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-base font-bold text-slate-900 dark:text-white">
                      {activeSupplier.supplierName}
                    </div>
                    {activeSupplier.email && (
                      <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                        {activeSupplier.email}
                      </div>
                    )}
                    {activeSupplier.groupType && (
                      <span
                        className={`mt-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${
                          GROUP_BADGE[activeSupplier.groupType] ??
                          "bg-slate-100 text-slate-700 ring-slate-200"
                        }`}
                      >
                        {activeSupplier.groupType}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DetailItem
                  icon={User}
                  label="Owner"
                  value={activeSupplier.ownerName}
                />
                <DetailItem
                  icon={Phone}
                  label="Owner Phone"
                  value={activeSupplier.ownerPhone}
                />
                <DetailItem
                  icon={User}
                  label="Contact Person"
                  value={activeSupplier.contactPerson}
                />
                <DetailItem
                  icon={Phone}
                  label="Contact Phone"
                  value={activeSupplier.contactPersonPhone}
                />
                <DetailItem
                  icon={ShieldAlert}
                  label="Designation"
                  value={activeSupplier.contactPersonDesignation}
                />
                <DetailItem
                  icon={Mail}
                  label="Email"
                  value={activeSupplier.email}
                />
                <div className="sm:col-span-2">
                  <DetailItem
                    icon={MapPin}
                    label="Address"
                    value={activeSupplier.address}
                  />
                </div>
              </div>

              {/* Documents */}
              <div>
                <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Documents
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {MEDIA_FIELDS.map((f) => {
                    const v = activeSupplier[f];
                    if (!v) return null;
                    const url = mediaUrl(v);
                    return (
                      <a
                        key={f}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition-all hover:border-[#3aa838]/40 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-[#3aa838]/40"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                          {isPdf(v) ? (
                            <FileText className="h-5 w-5 text-rose-500" />
                          ) : (
                            <img
                              src={url}
                              alt={mediaName(v)}
                              className="h-full w-full object-cover"
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                            {MEDIA_LABELS[f]}
                          </div>
                          <div className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                            {mediaName(v)}
                          </div>
                        </div>
                        <ExternalLink className="h-3.5 w-3.5 text-slate-400 group-hover:text-[#3aa838]" />
                      </a>
                    );
                  })}
                  {MEDIA_FIELDS.every((f) => !activeSupplier[f]) && (
                    <div className="col-span-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 py-6 text-center dark:border-slate-800 dark:bg-slate-900/50">
                      <FileWarning className="mx-auto h-5 w-5 text-slate-400" />
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        No documents uploaded
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ---- CREATE / EDIT ---- */}
          {(panelMode === "create" || panelMode === "edit") && form && (
            <div className="space-y-6">
              {/* Details */}
              <div>
                <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Supplier Details
                </h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Supplier name <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      value={form.supplierName}
                      onChange={(e) =>
                        setForm((f) =>
                          f ? { ...f, supplierName: e.target.value } : f
                        )
                      }
                      className="mt-1.5"
                      placeholder="e.g. Green Valley Traders"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Group type
                    </Label>
                    <Select
                      value={form.groupType || ""}
                      onValueChange={(value) =>
                        setForm((f) => (f ? { ...f, groupType: value } : f))
                      }
                    >
                      <SelectTrigger className="mt-1.5 w-full">
                        <SelectValue placeholder="Select group type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Packing Materials">
                          Packing Materials
                        </SelectItem>
                        <SelectItem value="Raw Materials">
                          Raw Materials
                        </SelectItem>
                        <SelectItem value="Stationary">Stationary</SelectItem>
                        <SelectItem value="Equipment">Equipment</SelectItem>
                        <SelectItem value="Furniture">Furniture</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Owner name
                    </Label>
                    <Input
                      value={form.ownerName || ""}
                      onChange={(e) =>
                        setForm((f) =>
                          f ? { ...f, ownerName: e.target.value } : f
                        )
                      }
                      className="mt-1.5"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Owner phone
                    </Label>
                    <Input
                      value={form.ownerPhone || ""}
                      onChange={(e) =>
                        setForm((f) =>
                          f ? { ...f, ownerPhone: e.target.value } : f
                        )
                      }
                      className="mt-1.5"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Contact person
                    </Label>
                    <Input
                      value={form.contactPerson || ""}
                      onChange={(e) =>
                        setForm((f) =>
                          f ? { ...f, contactPerson: e.target.value } : f
                        )
                      }
                      className="mt-1.5"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Designation
                    </Label>
                    <Input
                      value={form.contactPersonDesignation || ""}
                      onChange={(e) =>
                        setForm((f) =>
                          f
                            ? { ...f, contactPersonDesignation: e.target.value }
                            : f
                        )
                      }
                      className="mt-1.5"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Contact phone
                    </Label>
                    <Input
                      value={form.contactPersonPhone || ""}
                      onChange={(e) =>
                        setForm((f) =>
                          f ? { ...f, contactPersonPhone: e.target.value } : f
                        )
                      }
                      className="mt-1.5"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Email
                    </Label>
                    <Input
                      type="email"
                      value={form.email || ""}
                      onChange={(e) =>
                        setForm((f) =>
                          f ? { ...f, email: e.target.value } : f
                        )
                      }
                      className="mt-1.5"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Address
                    </Label>
                    <Input
                      value={form.address || ""}
                      onChange={(e) =>
                        setForm((f) =>
                          f ? { ...f, address: e.target.value } : f
                        )
                      }
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </div>

              {/* Documents */}
              <div>
                <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Documents
                </h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {MEDIA_FIELDS.map((field) => {
                    const val = form[field];
                    const url = mediaUrl(val);
                    return (
                      <div
                        key={field}
                        className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {MEDIA_LABELS[field]}
                          </div>
                          {val && (
                            <button
                              type="button"
                              onClick={() => removeFileFromForm(field)}
                              className="text-[10px] font-medium text-rose-600 hover:underline"
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        {!val ? (
                          <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 bg-slate-50 py-5 text-slate-500 transition-colors hover:border-[#3aa838]/40 hover:bg-[#3aa838]/5 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-400">
                            <Upload className="h-4 w-4" />
                            <span className="text-[11px] font-medium">
                              Click to upload
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Image or PDF
                            </span>
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              onChange={(e) => handleFileChange(e, field)}
                              className="hidden"
                            />
                          </label>
                        ) : (
                          <div className="flex items-start gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                typeof val === "object" &&
                                setPreviewMedia(val as Media)
                              }
                              className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800"
                            >
                              {isPdf(val) ? (
                                <FileText className="h-5 w-5 text-rose-500" />
                              ) : (
                                <img
                                  src={url}
                                  alt={mediaName(val)}
                                  className="h-full w-full object-cover"
                                />
                              )}
                            </button>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[11px] font-medium text-slate-900 dark:text-white">
                                {mediaName(val)}
                              </div>
                              {typeof val === "object" && val.size != null && (
                                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                  {formatBytes(val.size)}
                                </div>
                              )}
                              <div className="mt-1 flex items-center gap-2">
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[10px] font-semibold text-[#2f8a2f] hover:underline"
                                >
                                  Open
                                </a>
                                <label className="cursor-pointer text-[10px] font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                                  Replace
                                  <input
                                    type="file"
                                    accept="image/*,application/pdf"
                                    onChange={(e) =>
                                      handleFileChange(e, field)
                                    }
                                    className="hidden"
                                  />
                                </label>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {panelMode !== "view" && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-950/50">
            <Button variant="outline" onClick={onPanelClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSubmitting}
              className="bg-[#3aa838] text-white shadow-sm shadow-[#3aa838]/20 hover:bg-[#2f8a2f]"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : panelMode === "edit" ? (
                "Save Changes"
              ) : (
                "Create Supplier"
              )}
            </Button>
          </div>
        )}
      </div>
    </>
  );

  /* =========================== Main render =========================== */
  return (
    <div className="min-h-screen bg-slate-50 p-4 dark:bg-slate-950 md:p-6">
      <div className="mx-auto max-w-[1400px] space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white md:text-2xl">
              Suppliers
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Manage supplier records, contacts and compliance documents
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search suppliers…"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                className="h-9 w-full pl-9 sm:w-64"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchSuppliers}
              disabled={loading}
              className="h-9 gap-1.5"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>

            {canCreate && (
              <Button
                size="sm"
                onClick={openCreate}
                className="h-9 gap-1.5 bg-[#3aa838] text-white shadow-sm shadow-[#3aa838]/20 hover:bg-[#2f8a2f]"
              >
                <Plus className="h-4 w-4" />
                New Supplier
              </Button>
            )}

            {canDelete && selected.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                className="h-9 gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete ({selected.size})
              </Button>
            )}
          </div>
        </div>

        {/* Table card */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/50">
                <tr className="text-left">
                  {showCheckboxCol && (
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={
                          selected.size === suppliers.length &&
                          suppliers.length > 0
                        }
                        onChange={toggleSelectAll}
                        className="h-4 w-4 cursor-pointer rounded border-slate-300 text-[#3aa838] focus:ring-[#3aa838]/30"
                      />
                    </th>
                  )}
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Supplier
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Owner
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Contact
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Group
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Docs
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {/* Loading skeleton */}
                {loading && suppliers.length === 0 && (
                  <tr>
                    <td colSpan={colCount} className="p-10 text-center">
                      <RefreshCw className="mx-auto h-5 w-5 animate-spin text-slate-400" />
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        Loading suppliers…
                      </p>
                    </td>
                  </tr>
                )}

                {/* Empty */}
                {!loading && suppliers.length === 0 && (
                  <tr>
                    <td colSpan={colCount} className="p-14 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                        <Building2 className="h-6 w-6 text-slate-400" />
                      </div>
                      <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
                        No suppliers yet
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {q
                          ? "No results for your search."
                          : "Get started by creating your first supplier."}
                      </p>
                      {canCreate && !q && (
                        <Button
                          size="sm"
                          onClick={openCreate}
                          className="mt-4 gap-1.5 bg-[#3aa838] text-white hover:bg-[#2f8a2f]"
                        >
                          <Plus className="h-4 w-4" />
                          New Supplier
                        </Button>
                      )}
                    </td>
                  </tr>
                )}

                {/* Rows */}
                {suppliers.map((s) => {
                  const docCount = MEDIA_FIELDS.filter((f) => s[f]).length;
                  return (
                    <tr
                      key={s._id}
                      className="group transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                    >
                      {showCheckboxCol && (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selected.has(s._id!)}
                            onChange={() => toggleSelect(s._id!)}
                            className="h-4 w-4 cursor-pointer rounded border-slate-300 text-[#3aa838] focus:ring-[#3aa838]/30"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-sm text-slate-900 dark:text-white">
                          {s.supplierName}
                        </div>
                        {s.email && (
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {s.email}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-slate-800 dark:text-slate-200">
                          {s.ownerName || "—"}
                        </div>
                        {s.ownerPhone && (
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {s.ownerPhone}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-slate-800 dark:text-slate-200">
                          {s.contactPerson || "—"}
                        </div>
                        {s.contactPersonPhone && (
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {s.contactPersonPhone}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {s.groupType ? (
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${
                              GROUP_BADGE[s.groupType] ??
                              "bg-slate-100 text-slate-700 ring-slate-200"
                            }`}
                          >
                            {s.groupType}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {docCount > 0 ? (
                          <div className="flex items-center gap-1">
                            {MEDIA_FIELDS.map((f) => {
                              const v = s[f];
                              if (!v) return null;
                              const url = mediaUrl(v);
                              return (
                                <a
                                  key={f}
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  title={MEDIA_LABELS[f]}
                                  className="flex h-7 w-7 items-center justify-center overflow-hidden rounded border border-slate-200 bg-slate-50 transition-colors hover:border-[#3aa838]/40 dark:border-slate-700 dark:bg-slate-800"
                                >
                                  {isPdf(v) ? (
                                    <FileText className="h-3 w-3 text-rose-500" />
                                  ) : (
                                    <img
                                      src={url}
                                      alt={mediaName(v)}
                                      className="h-full w-full object-cover"
                                    />
                                  )}
                                </a>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400">
                            <FileWarning className="h-3 w-3" />
                            None
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openView(s)}
                            title="View"
                            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => openEdit(s)}
                              title="Edit"
                              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-[#3aa838]/10 hover:text-[#2f8a2f]"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleDeleteSupplier(s._id)}
                              title="Delete"
                              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Showing{" "}
              <span className="font-semibold text-slate-900 dark:text-white">
                {total === 0 ? 0 : (page - 1) * limit + 1}
              </span>{" "}
              –{" "}
              <span className="font-semibold text-slate-900 dark:text-white">
                {Math.min(page * limit, total)}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-slate-900 dark:text-white">
                {total}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-[#3aa838]/40 focus:ring-2 focus:ring-[#3aa838]/10 dark:border-slate-800 dark:bg-slate-900"
              >
                {[10, 15, 25, 50].map((n) => (
                  <option key={n} value={n}>
                    {n} / page
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-8"
              >
                Prev
              </Button>
              <div className="min-w-8 text-center text-xs font-semibold text-slate-900 dark:text-white">
                {page}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page * limit >= total}
                className="h-8"
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>

      {panel}

      {/* Preview modal */}
      {previewMedia && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm"
          onClick={() => setPreviewMedia(null)}
        >
          <div
            className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-bold text-slate-900 dark:text-white">
                  {previewMedia.originalName}
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  {previewMedia.module} • {previewMedia.folder} •{" "}
                  {formatBytes(previewMedia.size)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPreviewMedia(null)}
                className="h-8 w-8 shrink-0 text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="max-h-[75vh] overflow-auto bg-slate-50 p-4 dark:bg-slate-950">
              <img
                src={resolveAbsoluteUrl(previewMedia.url)}
                alt={previewMedia.originalName}
                className="mx-auto max-h-[65vh] w-auto rounded object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================== Sub-components =========================== */
function DetailItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {label}
        </div>
        <div className="mt-0.5 truncate text-sm text-slate-900 dark:text-white">
          {value || "—"}
        </div>
      </div>
    </div>
  );
}