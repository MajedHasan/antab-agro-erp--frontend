"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Trash2,
  Eye,
  Grid,
  List,
  UploadCloud,
  Folder,
  FileText,
  ArrowUpDown,
  RefreshCw,
  Plus,
  Loader2,
  X,
  RotateCcw,
} from "lucide-react";

/**
 * Enhanced Media Page
 *
 * Features:
 * - Left folder tree (module -> folder)
 * - Drag & drop + click uploader (multiple files) with per-file progress & retry
 * - Grid / List view toggle
 * - Search, sort, pagination
 * - Bulk select / delete
 * - Preview modal with metadata + open link
 *
 * Uses your api axios instance and the endpoints:
 * - GET /media  (supports params: page, limit, q, module, folder, sort)
 * - POST /media/upload?module=...&folder=...
 * - DELETE /media/:id?hard=true
 *
 * Important: previews use <img src={absoluteUrl}> to avoid Next.js image optimization rewriting URL.
 */

/* ---------- Types ---------- */
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

type UploadItem = {
  id: string; // local id
  file: File;
  progress: number;
  status: "queued" | "uploading" | "done" | "error";
  error?: string;
  media?: Media;
};

/* ---------- Helpers ---------- */
function resolveAbsoluteUrl(rawUrl?: string) {
  if (!rawUrl) return "";
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
  const env =
    typeof window !== "undefined" ? process.env.NEXT_PUBLIC_API_URL : undefined;
  // remove trailing /api if present
  const base = (env || "http://localhost:5001/api").replace(/\/api\/?$/, "");
  return `${base}${rawUrl.startsWith("/") ? rawUrl : "/" + rawUrl}`;
}

function formatBytes(bytes?: number) {
  if (!bytes && bytes !== 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function isImageFilename(name?: string) {
  if (!name) return false;
  const ext = name.split(".").pop()?.toLowerCase();
  return !!ext && ["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(ext);
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

/* ---------- Component ---------- */
export default function MediaPage() {
  /* Data */
  const [media, setMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(false);

  /* Filters / search / sort / paging */
  const [q, setQ] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [folderFilter, setFolderFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(24);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState<"createdAt" | "-createdAt" | "originalName">(
    "-createdAt"
  );

  /* UI states */
  const [gridMode, setGridMode] = useState<"grid" | "list">("grid");
  const [viewMedia, setViewMedia] = useState<Media | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const uploadingRef = useRef<Record<string, boolean>>({}); // prevents double uploads

  /* New folder input */
  const [newFolder, setNewFolder] = useState("");

  /* derived modules & folders (left tree) */
  const modules = useMemo(
    () => Array.from(new Set(media.map((m) => m.module || "other"))).sort(),
    [media]
  );
  const folders = useMemo(
    () =>
      Array.from(
        new Set(
          media
            .filter((m) => !moduleFilter || m.module === moduleFilter)
            .map((m) => m.folder || "root")
        )
      ).sort(),
    [media, moduleFilter]
  );

  /* fetch media */
  useEffect(() => {
    fetchMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, moduleFilter, folderFilter, page, limit, sort]);

  async function fetchMedia() {
    setLoading(true);
    try {
      const params: any = { page, limit, sort };
      if (q) params.q = q;
      if (moduleFilter) params.module = moduleFilter;
      if (folderFilter) params.folder = folderFilter;
      const res = await api.get("/media", { params });
      const data = res.data || {};
      // support different controller shapes
      let list: any[] = [];
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
      setMedia(list);
      setTotal(Number(tot || 0));
    } catch (err) {
      console.error("fetchMedia", err);
      alert("Failed to load media");
    } finally {
      setLoading(false);
    }
  }

  /* ---------- Selection / bulk ---------- */
  function toggleSelect(id: string) {
    setSelected((s) => {
      const c = new Set(s);
      if (c.has(id)) c.delete(id);
      else c.add(id);
      return c;
    });
  }
  function toggleSelectAll() {
    if (selected.size === media.length && media.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(media.map((m) => m._id)));
    }
  }

  async function handleSingleDelete(id: string) {
    if (!confirm("Delete this file? This removes it from DB and disk.")) return;
    try {
      await api.delete(`/media/${id}?hard=true`);
      setMedia((m) => m.filter((it) => it._id !== id));
      setSelected((s) => {
        const ns = new Set(s);
        ns.delete(id);
        return ns;
      });
    } catch (err) {
      console.error("delete media", err);
      alert("Delete failed");
    }
  }

  async function handleBulkDelete() {
    if (!selected.size) return;
    if (!confirm(`Delete ${selected.size} files?`)) return;
    const ids = Array.from(selected);
    await Promise.allSettled(
      ids.map((id) => api.delete(`/media/${id}?hard=true`))
    );
    setMedia((m) => m.filter((it) => !selected.has(it._id)));
    setSelected(new Set());
  }

  /* ---------- Uploader ---------- */
  // drag-n-drop handlers
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length) {
      enqueueFiles(files);
    }
  }
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  // enqueue files for upload
  function enqueueFiles(files: File[]) {
    const next = files.map((file) => ({
      id: uid(),
      file,
      progress: 0,
      status: "queued" as UploadItem["status"],
    }));
    setUploadQueue((q) => [...next, ...q]);
  }

  // start uploading queue entries (concurrent)
  useEffect(() => {
    if (!uploadQueue.length) return;
    // start uploads for queued items
    uploadQueue.forEach((it) => {
      if (it.status === "queued" && !uploadingRef.current[it.id]) {
        uploadingRef.current[it.id] = true;
        startUpload(it);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadQueue]);

  async function startUpload(item: UploadItem) {
    // optimistic update: set status uploading
    setUploadQueue((q) =>
      q.map((x) =>
        x.id === item.id ? { ...x, status: "uploading", progress: 0 } : x
      )
    );

    try {
      const fd = new FormData();
      fd.append("file", item.file);

      // determine module/folder for this batch
      const moduleName = moduleFilter || "misc";
      const folderName = newFolder || folderFilter || "root";

      const res = await api.post(
        `/media/upload?module=${encodeURIComponent(
          moduleName
        )}&folder=${encodeURIComponent(folderName)}`,
        fd,
        {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (ev: ProgressEvent) => {
            const p = ev.total ? Math.round((ev.loaded * 100) / ev.total) : 0;
            setUploadQueue((q) =>
              q.map((x) => (x.id === item.id ? { ...x, progress: p } : x))
            );
          },
        }
      );

      const created = res.data?.data as Media;
      if (!created || !created._id) throw new Error("No media returned");

      // mark as done and add to media list
      setUploadQueue((q) =>
        q.map((x) =>
          x.id === item.id
            ? { ...x, status: "done", progress: 100, media: created }
            : x
        )
      );
      setMedia((m) => [created, ...m]);
      // update modules/folders (derived from media state)
    } catch (err: any) {
      console.error("upload failed", err);
      setUploadQueue((q) =>
        q.map((x) =>
          x.id === item.id
            ? { ...x, status: "error", error: err?.message || "Upload failed" }
            : x
        )
      );
    } finally {
      delete uploadingRef.current[item.id];
    }
  }

  async function retryUpload(item: UploadItem) {
    // reset and re-start
    setUploadQueue((q) =>
      q.map((x) =>
        x.id === item.id
          ? { ...x, status: "queued", error: undefined, progress: 0 }
          : x
      )
    );
  }

  function removeUploadItem(id: string) {
    const it = uploadQueue.find((u) => u.id === id);
    // if it's done and has media, optionally allow deletion (but done items are added to media list)
    setUploadQueue((q) => q.filter((u) => u.id !== id));
  }

  /* ---------- Misc UI helpers --------- */
  function clearFilters() {
    setQ("");
    setModuleFilter("");
    setFolderFilter("");
    setPage(1);
  }

  /* ---------- Render ---------- */
  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold">Media Library</h1>
          <p className="text-sm text-muted-foreground">
            Uploaded files & folders
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Input
            placeholder="Search files..."
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            className="w-64"
          />

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            className="rounded border px-2 py-1"
            title="Sort"
          >
            <option value="-createdAt">Newest</option>
            <option value="createdAt">Oldest</option>
            <option value="originalName">Name</option>
          </select>

          <select
            value={gridMode}
            onChange={(e) => setGridMode(e.target.value as any)}
            className="rounded border px-2 py-1"
            title="View"
          >
            <option value="grid">Grid</option>
            <option value="list">List</option>
          </select>

          <Button
            variant="outline"
            onClick={() => fetchMedia()}
            disabled={loading}
          >
            <RefreshCw className="mr-2" /> Refresh
          </Button>

          <Button
            variant="destructive"
            onClick={handleBulkDelete}
            disabled={selected.size === 0}
          >
            <Trash2 className="mr-2" /> Delete ({selected.size})
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Left: folder tree & uploader */}
        <aside className="col-span-3 space-y-4">
          <div className="border rounded p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Folder /> <strong>Modules / Folders</strong>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setModuleFilter("");
                  setFolderFilter("");
                }}
              >
                <X />
              </Button>
            </div>

            <div className="space-y-2 text-sm">
              <div>
                <div className="font-medium">Modules</div>
                <div className="mt-2 space-y-1">
                  <button
                    onClick={() => {
                      setModuleFilter("");
                      setFolderFilter("");
                      setPage(1);
                    }}
                    className={`w-full text-left px-2 py-1 rounded ${
                      moduleFilter === "" ? "bg-slate-100" : "hover:bg-slate-50"
                    }`}
                  >
                    All
                  </button>
                  {modules.map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        setModuleFilter(m);
                        setFolderFilter("");
                        setPage(1);
                      }}
                      className={`w-full text-left px-2 py-1 rounded ${
                        moduleFilter === m
                          ? "bg-slate-100"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="font-medium mt-3">Folders</div>
                <div className="mt-2 space-y-1">
                  <button
                    onClick={() => {
                      setFolderFilter("");
                      setPage(1);
                    }}
                    className={`w-full text-left px-2 py-1 rounded ${
                      folderFilter === "" ? "bg-slate-100" : "hover:bg-slate-50"
                    }`}
                  >
                    All
                  </button>
                  {folders.map((f) => (
                    <button
                      key={f}
                      onClick={() => {
                        setFolderFilter(f);
                        setPage(1);
                      }}
                      className={`w-full text-left px-2 py-1 rounded ${
                        folderFilter === f
                          ? "bg-slate-100"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Uploader */}
          <div
            className="border rounded p-3 bg-gradient-to-b from-white to-slate-50"
            onDrop={onDrop}
            onDragOver={onDragOver}
            role="region"
            aria-label="Uploader"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <UploadCloud /> <strong>Upload Files</strong>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <select
                  value={moduleFilter}
                  onChange={(e) => setModuleFilter(e.target.value)}
                  className="rounded border px-2 py-1 grow"
                >
                  <option value="">module: (use existing or set below)</option>
                  <option value="suppliers">suppliers</option>
                  {modules.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <Input
                  placeholder="folder (optional)"
                  value={newFolder}
                  onChange={(e) => setNewFolder(e.target.value)}
                />
              </div>

              <div className="p-3 rounded border-dashed border flex flex-col items-center justify-center text-center">
                <div className="text-sm text-muted-foreground">
                  Drag & drop files here
                </div>
                <div className="mt-2 text-xs text-muted-foreground">or</div>

                <label className="mt-3 inline-flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="file"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      enqueueFiles(files);
                      e.currentTarget.value = "";
                    }}
                    className="hidden"
                  />
                  <Button size="sm">
                    <Plus /> Select files
                  </Button>
                </label>

                <div className="mt-2 text-xs text-muted-foreground">
                  Uploading will put files into module:{" "}
                  <span className="font-medium">{moduleFilter || "misc"}</span>,
                  folder:{" "}
                  <span className="font-medium">
                    {newFolder || folderFilter || "root"}
                  </span>
                </div>
              </div>

              {/* upload queue */}
              <div className="mt-2 space-y-2 max-h-56 overflow-auto">
                {uploadQueue.length === 0 && (
                  <div className="text-xs text-muted-foreground">
                    No uploads queued
                  </div>
                )}
                {uploadQueue.map((u) => (
                  <div
                    key={u.id}
                    className="border rounded p-2 bg-white flex items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="text-sm truncate">{u.file.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatBytes(u.file.size)}
                        </div>
                      </div>

                      <div className="mt-2 h-2 bg-slate-100 rounded overflow-hidden">
                        <div
                          style={{ width: `${u.progress}%` }}
                          className={`h-full bg-blue-500 transition-all ${
                            u.status === "error" ? "bg-red-500" : ""
                          }`}
                        />
                      </div>

                      <div className="mt-1 text-xs text-muted-foreground">
                        {u.status === "queued" && "Queued"}
                        {u.status === "uploading" && "Uploading..."}
                        {u.status === "done" && "Uploaded"}
                        {u.status === "error" &&
                          `Error: ${u.error || "failed"}`}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {u.status === "error" ? (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => retryUpload(u)}
                          >
                            Retry
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => removeUploadItem(u.id)}
                          >
                            Remove
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeUploadItem(u.id)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* quick actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setUploadQueue([]);
              }}
            >
              Clear Queue
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setNewFolder("");
                setModuleFilter("");
                setFolderFilter("");
              }}
            >
              Reset
            </Button>
          </div>
        </aside>

        {/* Right: media content */}
        <main className="col-span-9">
          {/* Grid or list */}
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="animate-spin" />
            </div>
          ) : gridMode === "grid" ? (
            <>
              <div className="grid grid-cols-3 gap-4">
                {media.map((m) => {
                  const url = resolveAbsoluteUrl(m.url);
                  const selectedFlag = selected.has(m._id);
                  const showImage = isImageFilename(m.originalName);
                  return (
                    <div
                      key={m._id}
                      className="border rounded overflow-hidden relative bg-white"
                    >
                      <input
                        type="checkbox"
                        checked={selectedFlag}
                        onChange={() => toggleSelect(m._id)}
                        className="absolute top-2 left-2 z-10"
                      />
                      <div className="w-full h-44 bg-gray-50 flex items-center justify-center overflow-hidden">
                        {showImage ? (
                          <img
                            src={url}
                            alt={m.originalName}
                            className="object-cover w-full h-full"
                          />
                        ) : (
                          <div className="p-3 text-xs text-center">
                            <FileText size={28} />
                            <div className="mt-1">{m.originalName}</div>
                          </div>
                        )}
                      </div>

                      <div className="p-2 flex items-center justify-between">
                        <div className="truncate text-sm">{m.originalName}</div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setViewMedia(m)}
                          >
                            <Eye />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleSingleDelete(m._id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                      <div className="px-2 pb-2 text-xs text-muted-foreground flex items-center justify-between">
                        <div>
                          {m.module}/{m.folder}
                        </div>
                        <div>{formatBytes(m.size)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* pagination */}
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {(page - 1) * limit + 1} -{" "}
                  {Math.min(page * limit, total)} of {total}
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
                    {[12, 24, 48].map((n) => (
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
            </>
          ) : (
            <>
              <div className="bg-white border rounded overflow-auto">
                <table className="w-full table-auto">
                  <thead>
                    <tr className="text-left">
                      <th className="p-2">
                        <input
                          type="checkbox"
                          checked={
                            selected.size === media.length && media.length > 0
                          }
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th>Preview</th>
                      <th>Name</th>
                      <th>Module</th>
                      <th>Folder</th>
                      <th>Size</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {media.map((m) => (
                      <tr key={m._id} className="border-t">
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={selected.has(m._id)}
                            onChange={() => toggleSelect(m._id)}
                          />
                        </td>
                        <td className="p-2 w-24">
                          <div className="w-20 h-12 overflow-hidden">
                            {isImageFilename(m.originalName) ? (
                              <img
                                src={resolveAbsoluteUrl(m.url)}
                                alt={m.originalName}
                                className="object-cover w-full h-full"
                              />
                            ) : (
                              <div className="text-xs text-muted-foreground">
                                {m.fileType || "file"}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-2">{m.originalName}</td>
                        <td className="p-2">{m.module}</td>
                        <td className="p-2">{m.folder}</td>
                        <td className="p-2 text-xs text-muted-foreground">
                          {formatBytes(m.size)}
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setViewMedia(m)}
                            >
                              <Eye />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleSingleDelete(m._id)}
                            >
                              Delete
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
                    Showing {(page - 1) * limit + 1} -{" "}
                    {Math.min(page * limit, total)} of {total}
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
                      {[10, 20, 50].map((n) => (
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
            </>
          )}
        </main>
      </div>

      {/* Preview modal */}
      {viewMedia && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center"
          onClick={() => setViewMedia(null)}
        >
          <div
            className="bg-white rounded p-6 max-w-3xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold">
                  {viewMedia.originalName}
                </h3>
                <div className="text-sm text-muted-foreground">
                  {viewMedia.module} / {viewMedia.folder}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => setViewMedia(null)}>
                  <X />
                </Button>
              </div>
            </div>

            <div className="mt-4">
              {isImageFilename(viewMedia.originalName) ? (
                <img
                  src={resolveAbsoluteUrl(viewMedia.url)}
                  alt={viewMedia.originalName}
                  className="w-full max-h-[70vh] object-contain"
                />
              ) : (
                <div className="p-6 border rounded text-center">
                  <FileText size={40} />
                  <div className="mt-2">{viewMedia.originalName}</div>
                  <div className="mt-4">
                    <a
                      href={resolveAbsoluteUrl(viewMedia.url)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600"
                    >
                      Open file
                    </a>
                  </div>
                </div>
              )}

              <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                <div>
                  <strong>Size:</strong> {formatBytes(viewMedia.size)}
                </div>
                <div>
                  <strong>Uploaded:</strong>{" "}
                  {viewMedia.createdAt
                    ? new Date(viewMedia.createdAt).toLocaleString()
                    : "-"}
                </div>
                <div>
                  <strong>Module:</strong> {viewMedia.module}
                </div>
                <div>
                  <strong>Folder:</strong> {viewMedia.folder}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
