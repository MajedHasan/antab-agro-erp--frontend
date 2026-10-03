"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Edit,
  Leaf,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

import api from "@/lib/api";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Label } from "@/components/ui/label";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CropStatus = "active" | "inactive";

interface Crop {
  _id: string;
  name: string;
  status?: CropStatus;
  createdAt?: string;
  updatedAt?: string;
}

interface CropListResponse {
  success: boolean;
  data: Crop[];
  total: number;
  page: number;
  limit: number;
}

const PAGE_SIZE = 15;

export default function CropsPage() {
  const [crops, setCrops] = useState<Crop[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [editingCrop, setEditingCrop] = useState<Crop | null>(null);
  const [selectedCrop, setSelectedCrop] = useState<Crop | null>(null);

  const [name, setName] = useState("");
  const [status, setStatus] = useState<CropStatus>("active");

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchCrops = useCallback(async () => {
    try {
      setLoading(true);

      const params: Record<string, string | number> = {
        page,
        limit: PAGE_SIZE,
      };

      if (search.trim()) {
        params.q = search.trim();
      }

      const response = await api.get<CropListResponse>("/marketing/crops", {
        params,
      });

      setCrops(response.data.data || []);
      setTotal(response.data.total || 0);
    } catch (error) {
      console.error("Failed to fetch crops:", error);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchCrops();
  }, [fetchCrops]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
    }, 400);

    return () => clearTimeout(timer);
  }, [search]);

  const openCreateDialog = () => {
    setEditingCrop(null);
    setName("");
    setStatus("active");
    setDialogOpen(true);
  };

  const openEditDialog = (crop: Crop) => {
    setEditingCrop(crop);
    setName(crop.name);
    setStatus(crop.status || "active");
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      return;
    }

    try {
      setSubmitting(true);

      if (editingCrop) {
        await api.put(`/marketing/crops/${editingCrop._id}`, {
          name: trimmedName,
          status,
        });
      } else {
        await api.post("/marketing/crops", {
          name: trimmedName,
          status,
        });
      }

      setDialogOpen(false);
      await fetchCrops();
    } catch (error) {
      console.error("Failed to save crop:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteDialog = (crop: Crop) => {
    setSelectedCrop(crop);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedCrop) return;

    try {
      setDeleting(true);

      await api.delete(`/marketing/crops/${selectedCrop._id}`);

      setDeleteDialogOpen(false);
      setSelectedCrop(null);

      if (crops.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        await fetchCrops();
      }
    } catch (error) {
      console.error("Failed to delete crop:", error);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-full space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Link
              href="/marketing&sales/setup"
              className="transition-colors hover:text-foreground"
            >
              Marketing Setup
            </Link>

            <ChevronRight className="h-4 w-4" />

            <span>Crops</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">Crops</h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Manage crops used throughout the marketing and prescription
            system.
          </p>
        </div>

        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Crop
        </Button>
      </div>

      {/* Toolbar */}
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search crops..."
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Crop
                </th>

                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Status
                </th>

                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Created
                </th>

                <th className="w-[80px] px-5 py-3" />
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <LoadingRows />
              ) : crops.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <EmptyState
                      search={Boolean(search.trim())}
                      onAdd={openCreateDialog}
                    />
                  </td>
                </tr>
              ) : (
                crops.map((crop, index) => (
                  <motion.tr
                    key={crop._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{
                      duration: 0.2,
                      delay: index * 0.025,
                    }}
                    className="border-b last:border-0 hover:bg-muted/20"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                          <Leaf className="h-4 w-4" />
                        </div>

                        <div>
                          <div className="font-medium">{crop.name}</div>

                          <div className="text-xs text-muted-foreground">
                            ID: {crop._id}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <StatusBadge status={crop.status} />
                    </td>

                    <td className="px-5 py-4 text-sm text-muted-foreground">
                      {formatDate(crop.createdAt)}
                    </td>

                    <td className="px-5 py-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link
                              href={`/marketing&sales/setup/crops/${crop._id}`}
                            >
                              <ArrowRight className="mr-2 h-4 w-4" />
                              Configure
                            </Link>
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => openEditDialog(crop)}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => openDeleteDialog(crop)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && crops.length > 0 && (
          <div className="flex items-center justify-between border-t px-5 py-3">
            <p className="text-sm text-muted-foreground">
              Showing{" "}
              <span className="font-medium text-foreground">
                {(page - 1) * PAGE_SIZE + 1}
              </span>{" "}
              to{" "}
              <span className="font-medium text-foreground">
                {Math.min(page * PAGE_SIZE, total)}
              </span>{" "}
              of{" "}
              <span className="font-medium text-foreground">{total}</span>
            </p>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Previous
              </Button>

              <div className="flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm">
                {page}
              </div>

              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>
              {editingCrop ? "Edit Crop" : "Add Crop"}
            </DialogTitle>

            <DialogDescription>
              {editingCrop
                ? "Update the crop information."
                : "Add a new crop to the marketing setup."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label htmlFor="crop-name">Crop Name</Label>

              <Input
                id="crop-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Rice"
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !submitting) {
                    handleSubmit();
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>

              <Select
                value={status}
                onValueChange={(value: CropStatus) => setStatus(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              disabled={submitting}
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>

            <Button
              disabled={!name.trim() || submitting}
              onClick={handleSubmit}
            >
              {submitting
                ? "Saving..."
                : editingCrop
                  ? "Save Changes"
                  : "Create Crop"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Delete Crop</DialogTitle>

            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">
                {selectedCrop?.name}
              </span>
              ? This may affect its existing marketing relationships.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              disabled={deleting}
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>

            <Button
              variant="destructive"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? "Deleting..." : "Delete Crop"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status?: CropStatus }) {
  const isActive = status !== "inactive";

  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        isActive
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "bg-muted text-muted-foreground",
      ].join(" ")}
    >
      <span
        className={[
          "mr-1.5 h-1.5 w-1.5 rounded-full",
          isActive ? "bg-emerald-500" : "bg-muted-foreground",
        ].join(" ")}
      />

      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

function LoadingRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, index) => (
        <tr key={index} className="border-b last:border-0">
          <td className="px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 animate-pulse rounded-lg bg-muted" />

              <div className="space-y-2">
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                <div className="h-3 w-24 animate-pulse rounded bg-muted" />
              </div>
            </div>
          </td>

          <td className="px-5 py-4">
            <div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
          </td>

          <td className="px-5 py-4">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          </td>

          <td className="px-5 py-4">
            <div className="ml-auto h-8 w-8 animate-pulse rounded bg-muted" />
          </td>
        </tr>
      ))}
    </>
  );
}

function EmptyState({
  search,
  onAdd,
}: {
  search: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
        <Leaf className="h-5 w-5 text-muted-foreground" />
      </div>

      <h3 className="mt-4 text-sm font-semibold">
        {search ? "No crops found" : "No crops yet"}
      </h3>

      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {search
          ? "Try changing your search term."
          : "Create your first crop to start configuring the marketing setup."}
      </p>

      {!search && (
        <Button className="mt-5" onClick={onAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add Crop
        </Button>
      )}
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}