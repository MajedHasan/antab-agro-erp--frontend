"use client";

import React, { useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Edit, Trash2, Search, Eye } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import DealerAddEditModal from "./_components/DealerAddEditModal";
import DealerViewModal from "./_components/DealerViewModal";

interface IUser {
  _id: string;
  name: string;
}

interface IAttachmentFiles {
  bankCheque?: string;
  tradeLicense?: string;
  nidCard?: string;
  informationDeed?: string;
  pesticideLicense?: string;
}

interface IAttachments {
  required?: IAttachmentFiles;
  optional?: {
    agreements?: string[];
    others?: string[];
  };
}

// --- Types ---
type Zone = { _id: string; name: string };
type Region = { _id: string; name: string; zone?: string | Zone };
type Area = { _id: string; name: string; region?: string | Region };
type Territory = { _id: string; name: string; area?: string | Area };
type Warehouse = { _id: string; name: string };

type Attachments = {
  required: {
    bankCheque?: string;
    tradeLicense?: string;
    nidCard?: string;
    informationDeed?: string;
    pesticideLicense?: string;
  };
  optional: {
    agreements?: string[];
    others?: string[];
  };
};

type DealerForm = {
  name: string;
  code?: string;
  proprietor?: string;
  zone?: string;
  region?: string;
  area?: string;
  territory?: string;
  type?: string;
  creditLimit?: string;
  phoneNumber?: string;
  email?: string;
  address?: string;
  opDate?: string;
  opMonth?: string;
  openingBalance?: string;
  warehouse?: string;
  status?: string;
  assignedSalesManager?: string;
  notes?: string;
  lastPurchaseDate?: string;
  attachments?: Attachments;
};

type Dealer = DealerForm & {
  _id?: string;
  zone?: any;
  region?: any;
  area?: any;
  territory?: any;
  warehouse?: any;
};

// sentinel value for Select placeholder/none
const NONE = "none";

// API origin to build image URLs for preview
const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL
  : "http://localhost:5001";

function getId(v?: any) {
  if (!v) return "";
  if (typeof v === "string") return v;
  return v._id ?? "";
}

export default function DealersPage() {
  // region data
  const [zones, setZones] = useState<Zone[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [users, setUsers] = useState<{ _id: string; name: string }[]>([]); // for assignedSalesManager

  // table data & UI
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");

  // filters
  const [filterZone, setFilterZone] = useState<string | null>(null);
  const [filterRegion, setFilterRegion] = useState<string | null>(null);
  const [filterArea, setFilterArea] = useState<string | null>(null);

  // modal state
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Dealer | null>(null);
  const [viewing, setViewing] = useState<Dealer | null>(null);

  const defaultForm: DealerForm = {
    name: "",
    code: "",
    proprietor: "",
    zone: "",
    region: "",
    area: "",
    territory: "",
    type: "",
    creditLimit: "0",
    phoneNumber: "",
    email: "",
    address: "",
    opDate: "",
    opMonth: "",
    openingBalance: "0",
    warehouse: "",
    status: "pending", // default pending
    assignedSalesManager: "",
    notes: "",
    lastPurchaseDate: "",
    attachments: {
      required: {},
      optional: { agreements: [], others: [] },
    },
  };

  const [form, setForm] = useState<DealerForm>({ ...defaultForm });

  // cascade selects in modal
  const [modalZone, setModalZone] = useState<string>(NONE);
  const [modalRegion, setModalRegion] = useState<string>(NONE);
  const [modalArea, setModalArea] = useState<string>(NONE);

  // suggestions
  const [suggestions, setSuggestions] = useState<
    { _id: string; label: string }[]
  >([]);
  const suggestTimer = useRef<number | null>(null);

  // code-generation debounce
  const codeTimer = useRef<number | null>(null);

  // track temp uploaded files during modal session so we can cleanup when modal closed without saving
  const [tempFiles, setTempFiles] = useState<string[]>([]);

  /** ------------------------
   * Loaders
   * -------------------------*/
  const loadZones = async () => {
    try {
      const res = await api.get("/zones", { params: { limit: 1000 } });
      setZones(res.data.data || []);
    } catch {
      toast.error("Failed to load zones");
    }
  };

  const loadRegions = async (zoneId?: string | null) => {
    try {
      const params: any = { limit: 1000 };
      if (zoneId && zoneId !== NONE) params.zone = zoneId;
      const res = await api.get("/regions", { params });
      setRegions(res.data.data || []);
    } catch {
      toast.error("Failed to load regions");
    }
  };

  const loadAreas = async (regionId?: string | null) => {
    try {
      const params: any = { limit: 1000 };
      if (regionId && regionId !== NONE) params.region = regionId;
      const res = await api.get("/areas", { params });
      setAreas(res.data.data || []);
    } catch {
      toast.error("Failed to load areas");
    }
  };

  const loadTerritories = async (areaId?: string | null) => {
    try {
      const params: any = { limit: 1000 };
      if (areaId && areaId !== NONE) params.area = areaId;
      const res = await api.get("/territories", { params });
      setTerritories(res.data.data || []);
    } catch {
      toast.error("Failed to load territories");
    }
  };

  const loadWarehouses = async () => {
    try {
      const res = await api.get("/warehouses", { params: { limit: 1000 } });
      setWarehouses(res.data.data || []);
    } catch {
      // ignore
    }
  };

  const loadUsers = async () => {
    try {
      const res = await api.get("/users", { params: { limit: 1000 } });
      setUsers(res.data.data || []);
    } catch {
      // ignore
    }
  };

  /** ------------------------
   * Fetch dealers table
   * -------------------------*/
  const fetchDealers = async (opts?: { page?: number }) => {
    try {
      setLoading(true);
      const params: any = { page: opts?.page ?? page, limit, q };
      if (filterZone && filterZone !== NONE) params.zone = filterZone;
      if (filterRegion && filterRegion !== NONE) params.region = filterRegion;
      if (filterArea && filterArea !== NONE) params.area = filterArea;
      const res = await api.get("/dealers", { params });
      setDealers(res.data.data || []);
      setTotal(res.data.total ?? 0);
    } catch {
      toast.error("Failed to load dealers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadZones();
    loadRegions();
    loadAreas();
    loadTerritories();
    loadWarehouses();
    loadUsers();
  }, []);

  useEffect(() => {
    loadRegions(filterZone ?? undefined);
    setFilterRegion(null);
    setFilterArea(null);
  }, [filterZone]);

  useEffect(() => {
    loadAreas(filterRegion ?? undefined);
    setFilterArea(null);
  }, [filterRegion]);

  useEffect(() => {
    fetchDealers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, q, filterZone, filterRegion, filterArea]);

  /** ------------------------
   * Suggestions (search) — debounce
   * -------------------------*/
  const fetchSuggestions = (term: string) => {
    if (suggestTimer.current) window.clearTimeout(suggestTimer.current);
    suggestTimer.current = window.setTimeout(async () => {
      if (!term || term.trim().length < 2) {
        setSuggestions([]);
        return;
      }
      try {
        const res = await api.get("/dealers", {
          params: { q: term, limit: 6 },
        });
        const items = (res.data.data || []).map((d: any) => {
          const displayPhone = d.phoneNumber ?? d.phone ?? "";
          return { _id: d._id, label: `${displayPhone} — ${d.name}` };
        });
        setSuggestions(items);
      } catch {
        setSuggestions([]);
      }
    }, 300);
  };

  useEffect(() => {
    fetchSuggestions(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  /** ------------------------
   * Modal open/create/edit/reset
   * -------------------------*/
  const resetModalForm = () => {
    setForm({ ...defaultForm });
    setEditing(null);
    setModalZone(NONE);
    setModalRegion(NONE);
    setModalArea(NONE);
    setTerritories([]);
    // cleanup tempFiles for previous session (should already be cleaned)
    setTempFiles([]);
  };

  const onCreate = () => {
    resetModalForm();
    setOpen(true);
  };

  const onView = async (d: Dealer) => {
    // ensure fully populated
    try {
      if (!d._id) return;
      const res = await api.get(`/dealers/${d._id}`, {
        params: {
          populate: "warehouse,assignedSalesManager,zone,region,area,territory",
        },
      });
      setViewing(res.data.data || d);
    } catch {
      setViewing(d);
    }
  };

  const onEdit = async (d: Dealer) => {
    setEditing(d);

    const zoneId =
      d.zone && typeof d.zone === "object"
        ? getId(d.zone)
        : (d.zone as string) || NONE;
    const regionId =
      d.region && typeof d.region === "object"
        ? getId(d.region)
        : (d.region as string) || NONE;
    const areaId =
      d.area && typeof d.area === "object"
        ? getId(d.area)
        : (d.area as string) || NONE;
    const territoryId =
      d.territory && typeof d.territory === "object"
        ? getId(d.territory)
        : (d.territory as string) || NONE;

    setModalZone(zoneId || NONE);
    await loadRegions(zoneId === NONE ? undefined : zoneId);
    setModalRegion(regionId || NONE);
    await loadAreas(regionId === NONE ? undefined : regionId);
    setModalArea(areaId || NONE);
    await loadTerritories(areaId === NONE ? undefined : areaId);

    setForm({
      name: d.name || "",
      code: d.code || "",
      proprietor: d.proprietor || "",
      zone: zoneId === NONE ? "" : zoneId,
      region: regionId === NONE ? "" : regionId,
      area: areaId === NONE ? "" : areaId,
      territory: territoryId === NONE ? "" : territoryId,
      type: d.type || "",
      creditLimit: d.creditLimit ?? "0",
      phoneNumber: (d as any).phoneNumber ?? (d as any).phone ?? "",
      email: d.email || "",
      address: d.address || "",
      opDate: d.opDate || "",
      opMonth: d.opMonth || "",
      openingBalance: d.openingBalance ?? "0",
      warehouse: getId(d.warehouse) || "",
      status: d.status || "pending",
      // assignedSalesManager: d.assignedSalesManager
      //   ? String(d.assignedSalesManager)
      //   : "",
      assignedSalesManager: d.assignedSalesManager?._id || "",
      notes: d.notes || "",
      lastPurchaseDate: d.lastPurchaseDate
        ? new Date(d.lastPurchaseDate).toISOString().slice(0, 10)
        : "",
      attachments: (d as any).attachments || {
        required: {},
        optional: { agreements: [], others: [] },
      },
    });

    // ensure any pre-existing attachments (already saved) are NOT auto-removed.
    setOpen(true);
  };

  /** ------------------------
   * Modal cascade handlers
   * -------------------------*/
  const onModalZoneChange = async (v: string) => {
    setModalZone(v);
    setModalRegion(NONE);
    setModalArea(NONE);
    setForm({
      ...form,
      zone: v === NONE ? "" : v,
      region: "",
      area: "",
      territory: "",
    });
    await loadRegions(v === NONE ? undefined : v);
    setTerritories([]);
  };

  const onModalRegionChange = async (v: string) => {
    setModalRegion(v);
    setModalArea(NONE);
    setForm({ ...form, region: v === NONE ? "" : v, area: "", territory: "" });
    await loadAreas(v === NONE ? undefined : v);
    setTerritories([]);
  };

  const onModalAreaChange = async (v: string) => {
    setModalArea(v);
    setForm({ ...form, area: v === NONE ? "" : v, territory: "" });
    await loadTerritories(v === NONE ? undefined : v);
  };

  /** ------------------------
   * Code generation preview (auto)
   * -------------------------*/
  const generateCodePreview = async (
    zoneId?: string,
    regionId?: string,
    areaId?: string,
    territoryId?: string
  ) => {
    try {
      if (!zoneId || !regionId || !areaId || !territoryId) {
        setForm((f) => ({ ...f, code: "" }));
        return;
      }
      const res = await api.get("/dealers/generate-code", {
        params: {
          zone: zoneId,
          region: regionId,
          area: areaId,
          territory: territoryId,
        },
      });
      if (res.data?.data) {
        setForm((f) => ({ ...f, code: res.data.data }));
      }
    } catch {
      // ignore
    }
  };

  // watch cascade selects and generate code (debounced)
  useEffect(() => {
    if (editing && editing._id) return; // don't overwrite code when editing existing record

    if (codeTimer.current) window.clearTimeout(codeTimer.current);
    codeTimer.current = window.setTimeout(() => {
      const z = modalZone !== NONE ? modalZone : "";
      const r = modalRegion !== NONE ? modalRegion : "";
      const a = modalArea !== NONE ? modalArea : "";
      const t = form.territory ? form.territory : "";
      if (z && r && a && t) {
        generateCodePreview(z, r, a, t);
      } else {
        setForm((f) => ({ ...f, code: "" }));
      }
    }, 300);

    return () => {
      if (codeTimer.current) window.clearTimeout(codeTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalZone, modalRegion, modalArea, form.territory, editing]);

  /** ------------------------
   * File upload helper (POST /api/uploads)
   * returns URL string (e.g. /uploads/filename.jpg)
   * - stores uploaded file urls in tempFiles state for cleanup
   * -------------------------*/
  const uploadFile = async (file: File) => {
    try {
      const fd = new FormData();
      fd.append("file", file);
      // IMPORTANT: using axios (api) so response is res.data
      const res = await api.post("/uploads", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data = res.data;
      if (!data || !data.url) throw new Error(data?.message || "Upload failed");
      // track temp file so we can delete if user cancels
      setTempFiles((prev) => [...prev, data.url]);
      return data.url as string;
    } catch (err: any) {
      throw new Error(
        err?.response?.data?.message || err?.message || "Upload failed"
      );
    }
  };

  /** ------------------------
   * Delete a single file on server (DELETE /api/uploads?url=...)
   * returns true if success
   * -------------------------*/
  const deleteFileOnServer = async (url?: string) => {
    if (!url) return false;
    try {
      await api.delete("/uploads", { params: { url } });
      // also remove from tempFiles list if present
      setTempFiles((prev) => prev.filter((u) => u !== url));
      return true;
    } catch {
      return false;
    }
  };

  /** ------------------------
   * Attachment handlers
   * -------------------------*/
  // set required attachment (single file fields)
  const setRequiredAttachment = async (
    key: keyof Attachments["required"],
    file?: File | null
  ) => {
    // if user clears, remove file from server if it was uploaded in this session or attempt delete always
    if (!file) {
      const prevUrl = form.attachments?.required?.[key];
      if (prevUrl) {
        // attempt deletion on server
        await deleteFileOnServer(prevUrl);
      }
      setForm((f) => ({
        ...f,
        attachments: {
          ...(f.attachments || defaultForm.attachments),
          required: { ...(f.attachments?.required || {}), [key]: undefined },
        },
      }));
      return;
    }

    // if replacing existing file, delete previous one first (safe to attempt)
    const prev = form.attachments?.required?.[key];
    if (prev) {
      await deleteFileOnServer(prev);
    }

    try {
      const url = await uploadFile(file);
      setForm((f) => ({
        ...f,
        attachments: {
          ...(f.attachments || defaultForm.attachments),
          required: { ...(f.attachments?.required || {}), [key]: url },
        },
      }));
      toast.success("Uploaded");
    } catch (err) {
      toast.error((err as any)?.message || "Upload failed");
    }
  };

  // add optional files (agreements / others)
  const addOptionalFiles = async (
    key: keyof Attachments["optional"],
    files: FileList | null
  ) => {
    if (!files || files.length === 0) return;
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const url = await uploadFile(file);
        urls.push(url);
      }
      setForm((f) => {
        const prev = f.attachments?.optional?.[key] ?? [];
        return {
          ...f,
          attachments: {
            ...(f.attachments || defaultForm.attachments),
            optional: {
              ...(f.attachments?.optional || { agreements: [], others: [] }),
              [key]: [...prev, ...urls],
            },
          },
        };
      });
      toast.success("Uploaded");
    } catch {
      toast.error("Upload failed");
    }
  };

  const removeOptionalAttachment = async (
    key: keyof Attachments["optional"],
    index: number
  ) => {
    const url = form.attachments?.optional?.[key]?.[index];
    if (url) {
      await deleteFileOnServer(url);
    }
    setForm((f) => {
      const prev = f.attachments?.optional?.[key] ?? [];
      const next = [...prev];
      next.splice(index, 1);
      return {
        ...f,
        attachments: {
          ...(f.attachments || defaultForm.attachments),
          optional: {
            ...(f.attachments?.optional || { agreements: [], others: [] }),
            [key]: next,
          },
        },
      };
    });
  };

  /** ------------------------
   * When user closes modal without saving -> cleanup temporary uploaded files
   * -------------------------*/
  const cleanupTempFiles = async () => {
    // clone list then clear state immediately to avoid double deletion
    const toDelete = [...tempFiles];
    setTempFiles([]);
    for (const u of toDelete) {
      await deleteFileOnServer(u);
    }
  };

  /** ------------------------
   * Submit create/update
   * -------------------------*/
  const onSubmit = async (ev?: React.FormEvent) => {
    ev?.preventDefault();

    if (!form.name) return toast.error("Name is required");
    if (!form.phoneNumber) return toast.error("Phone is required");

    try {
      const payload: any = {
        name: form.name,
        proprietor: form.proprietor,
        zone: form.zone || undefined,
        region: form.region || undefined,
        area: form.area || undefined,
        territory: form.territory || undefined,
        type: form.type || undefined,
        creditLimit: form.creditLimit,
        phoneNumber: form.phoneNumber?.trim() || undefined,
        email: form.email || undefined,
        address: form.address || undefined,
        opDate: form.opDate || undefined,
        opMonth: form.opMonth || undefined,
        openingBalance: form.openingBalance,
        warehouse: form.warehouse || undefined,
        status: form.status || undefined,
        assignedSalesManager: form.assignedSalesManager || undefined,
        notes: form.notes || undefined,
        lastPurchaseDate: form.lastPurchaseDate || undefined,
        attachments: form.attachments,
        code: form.code,
      };

      if (editing?._id) {
        await api.put(`/dealers/${editing._id}`, payload);
        toast.success("Dealer updated");
      } else {
        const res = await api.post("/dealers", payload);
        if (res.data?.data?.code) {
          toast.success(`Dealer created — code: ${res.data.data.code}`);
        } else {
          toast.success("Dealer created");
        }
      }

      // on successful save, we can clear tempFiles array (files are now persisted or old ones were deleted)
      setTempFiles([]);
      setOpen(false);
      resetModalForm();
      fetchDealers({ page: 1 });
      setPage(1);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || (err as any).message || "Save failed";
      toast.error(msg);
    }
  };

  /** ------------------------
   * Delete dealer (calls backend — which should also delete attachments server-side)
   * -------------------------*/
  const onDelete = async (id?: string) => {
    if (!id) return;
    if (!confirm("Delete dealer? This will remove associated files too."))
      return;
    try {
      await api.delete(`/dealers/${id}`);
      toast.success("Deleted");
      fetchDealers();
    } catch {
      toast.error("Failed to delete dealer");
    }
  };

  /** ------------------------
   * helpers
   * -------------------------*/
  const phoneDisplay = (d: Dealer) =>
    (d as any).phoneNumber ?? (d as any).phone ?? "";

  const totalPages = Math.max(1, Math.ceil(total / limit));

  /* -------------------------
     Small render helpers for attachments
  -------------------------*/
  const filePreview = (url?: string) => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    // url probably like "/uploads/xxx". prefix with API origin if provided
    if (url.startsWith("/")) {
      if (API_ORIGIN) return `${API_ORIGIN}${url}`;
      // fallback: use same host but remove /api if present in api.defaults.baseURL
      return url;
    }
    // else treat as relative filename
    if (API_ORIGIN) return `${API_ORIGIN}/uploads/${url}`;
    return `/uploads/${url}`;
  };

  const statusBadge = (s?: string) => {
    const st = (s || "pending").toLowerCase();
    const map: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      active: "bg-green-100 text-green-800",
      inactive: "bg-red-100 text-red-800",
      suspended: "bg-gray-100 text-gray-800",
    };
    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${
          map[st] ?? "bg-gray-100 text-gray-800"
        }`}
      >
        {st[0].toUpperCase() + st.slice(1)}
      </span>
    );
  };

  {
    /* Helper Components */
  }
  const Section = ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <div className="p-4 bg-muted rounded-lg space-y-2">
      <h5 className="text-sm font-semibold text-muted-foreground">{title}</h5>
      <div className="space-y-1">{children}</div>
    </div>
  );

  const InfoRow = ({ label, value }: { label: string; value?: string }) => (
    <div className="flex flex-col">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-sm">{value || "-"}</span>
    </div>
  );

  function getName(obj?: { name: string } | string): string {
    if (!obj) return "-";
    if (typeof obj === "string") return obj;
    return obj.name || "-";
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header + Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Dealers</h2>
          <p className="text-sm text-muted-foreground">
            Manage dealers — cascade: Zone → Region → Area → Territory
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <div className="flex items-center border rounded px-2 py-1 gap-2 bg-white">
              <Search className="w-4 h-4 text-gray-500" />
              <Input
                placeholder="Search by name or phone..."
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                className="w-64"
              />
            </div>
            {/* optional suggestions dropdown omitted for brevity */}
          </div>

          {/* Filters */}
          <Select
            value={filterZone ?? NONE}
            onValueChange={(v) => {
              setFilterZone(v === NONE ? null : v);
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by Zone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>All Zones</SelectItem>
              {zones.map((z) => (
                <SelectItem key={z._id} value={z._id}>
                  {z.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filterRegion ?? NONE}
            onValueChange={(v) => setFilterRegion(v === NONE ? null : v)}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by Region" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>All Regions</SelectItem>
              {regions.map((r) => (
                <SelectItem key={r._id} value={r._id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filterArea ?? NONE}
            onValueChange={(v) => setFilterArea(v === NONE ? null : v)}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by Area" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>All Areas</SelectItem>
              {areas.map((a) => (
                <SelectItem key={a._id} value={a._id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={() => onCreate()}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Dealer Create
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Proprietor</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Area</TableHead>
                <TableHead>Territory</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-48">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dealers.map((d, i) => {
                const zoneName =
                  (d.zone &&
                    typeof d.zone === "object" &&
                    (d.zone as any).name) ||
                  zones.find((z) => z._id === getId(d.zone))?.name ||
                  "";
                const regionName =
                  (d.region &&
                    typeof d.region === "object" &&
                    (d.region as any).name) ||
                  regions.find((r) => r._id === getId(d.region))?.name ||
                  "";
                const areaName =
                  (d.area &&
                    typeof d.area === "object" &&
                    (d.area as any).name) ||
                  areas.find((a) => a._id === getId(d.area))?.name ||
                  "";
                const territoryName =
                  (d.territory &&
                    typeof d.territory === "object" &&
                    (d.territory as any).name) ||
                  territories.find((t) => t._id === getId(d.territory))?.name ||
                  "";
                const warehouseName =
                  (d.warehouse &&
                    typeof d.warehouse === "object" &&
                    (d.warehouse as any).name) ||
                  warehouses.find((w) => w._id === getId(d.warehouse))?.name ||
                  "";

                return (
                  <TableRow key={d._id || i}>
                    <TableCell>{(page - 1) * limit + i + 1}</TableCell>
                    <TableCell>{d.name}</TableCell>
                    <TableCell>{d.code}</TableCell>
                    <TableCell>{d.proprietor}</TableCell>
                    <TableCell>{zoneName}</TableCell>
                    <TableCell>{regionName}</TableCell>
                    <TableCell>{areaName}</TableCell>
                    <TableCell>{territoryName}</TableCell>
                    <TableCell>{phoneDisplay(d)}</TableCell>
                    <TableCell>{warehouseName}</TableCell>
                    <TableCell>{statusBadge(d.status)}</TableCell>

                    <TableCell>
                      <div className="flex gap-2">
                        {/* VIEW always available */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onView(d)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>

                        {/* EDIT */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onEdit(d)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>

                        {/* DELETE */}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => onDelete(d._id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}

              {dealers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-6">
                    {loading ? "Loading..." : "No dealers found"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* pagination */}
        <div className="p-4 flex items-center justify-between border-t">
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
              className="border rounded px-2 py-1"
            >
              {[10, 15, 25, 50].map((l) => (
                <option key={l} value={l}>
                  {l}/page
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1">
              <Button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Prev
              </Button>
              <div className="px-3">
                {page} / {totalPages}
              </div>
              <Button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>

      <DealerViewModal
        viewing={viewing}
        setViewing={setViewing}
        statusBadge={statusBadge}
        Section={Section}
        InfoRow={InfoRow}
        getName={getName}
        filePreview={filePreview}
      />

      {/* Dealer Modal */}
      <DealerAddEditModal
        open={open}
        cleanupTempFiles={cleanupTempFiles}
        setOpen={setOpen}
        resetModalForm={resetModalForm}
        editing={editing}
        onSubmit={onSubmit}
        form={form}
        setForm={setForm}
        modalZone={modalZone}
        onModalZoneChange={onModalZoneChange}
        NONE={NONE}
        zones={zones}
        modalRegion={modalRegion}
        onModalRegionChange={onModalRegionChange}
        regions={regions}
        modalArea={modalArea}
        onModalAreaChange={onModalAreaChange}
        areas={areas}
        territories={territories}
        warehouses={warehouses}
        users={users}
        setRequiredAttachment={setRequiredAttachment}
        filePreview={filePreview}
        addOptionalFiles={addOptionalFiles}
        removeOptionalAttachment={removeOptionalAttachment}
      />
    </div>
  );
}
