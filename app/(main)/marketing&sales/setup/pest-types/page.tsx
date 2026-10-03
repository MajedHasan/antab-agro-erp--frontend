"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Bug,
  ChevronLeft,
  ChevronRight,
  Edit,
  Leaf,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  FlaskConical,
  X,
  Loader2,
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
import { Label } from "@/components/ui/label";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Status = "active" | "inactive";

interface PestType {
  _id: string;
  name: string;
  status?: Status;
  createdAt?: string;
  updatedAt?: string;
}

interface Crop {
  _id: string;
  name: string;
  status?: Status;
}

interface Solution {
  _id: string;
  name: string;
  status?: Status;
}

interface ListResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  limit: number;
}

const PAGE_SIZE = 15;
const LOOKUP_LIMIT = 100;

export default function PestTypesPage() {
  const [pestTypes, setPestTypes] = useState<PestType[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [editingPestType, setEditingPestType] =
    useState<PestType | null>(null);

  const [selectedPestType, setSelectedPestType] =
    useState<PestType | null>(null);

  const [name, setName] = useState("");
  const [status, setStatus] = useState<Status>("active");

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [associatedCrops, setAssociatedCrops] = useState<Crop[]>([]);
  const [associatedSolutions, setAssociatedSolutions] = useState<Solution[]>(
    [],
  );

  const [assignCropOpen, setAssignCropOpen] = useState(false);
  const [assignSolutionOpen, setAssignSolutionOpen] = useState(false);

  const [allCrops, setAllCrops] = useState<Crop[]>([]);
  const [allSolutions, setAllSolutions] = useState<Solution[]>([]);

  const [lookupLoading, setLookupLoading] = useState(false);

  const [cropSearch, setCropSearch] = useState("");
  const [solutionSearch, setSolutionSearch] = useState("");

  const [assigning, setAssigning] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchPestTypes = useCallback(async () => {
    try {
      setLoading(true);

      const response = await api.get<ListResponse<PestType>>(
        "/marketing/pest-types",
        {
          params: {
            page,
            limit: PAGE_SIZE,
            ...(search.trim() ? { q: search.trim() } : {}),
          },
        },
      );

      setPestTypes(response.data.data || []);
      setTotal(response.data.total || 0);
    } catch (error) {
      console.error("Failed to fetch pest types:", error);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchPestTypes();
  }, [fetchPestTypes]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
    }, 400);

    return () => clearTimeout(timer);
  }, [search]);

  const openCreateDialog = () => {
    setEditingPestType(null);
    setName("");
    setStatus("active");
    setDialogOpen(true);
  };

  const openEditDialog = (item: PestType) => {
    setEditingPestType(item);
    setName(item.name);
    setStatus(item.status || "active");
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    const trimmedName = name.trim();

    if (!trimmedName) return;

    try {
      setSaving(true);

      if (editingPestType) {
        await api.put(`/marketing/pest-types/${editingPestType._id}`, {
          name: trimmedName,
          status,
        });
      } else {
        await api.post("/marketing/pest-types", {
          name: trimmedName,
          status,
        });
      }

      setDialogOpen(false);
      await fetchPestTypes();
    } catch (error) {
      console.error("Failed to save pest type:", error);
    } finally {
      setSaving(false);
    }
  };

  const openDeleteDialog = (item: PestType) => {
    setSelectedPestType(item);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedPestType) return;

    try {
      setDeleting(true);

      await api.delete(`/marketing/pest-types/${selectedPestType._id}`);

      setDeleteDialogOpen(false);
      setSelectedPestType(null);

      if (pestTypes.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        await fetchPestTypes();
      }
    } catch (error) {
      console.error("Failed to delete pest type:", error);
    } finally {
      setDeleting(false);
    }
  };

  const openDetails = async (item: PestType) => {
    try {
      setSelectedPestType(item);
      setDetailsOpen(true);
      setDetailsLoading(true);

      const [cropsResponse, solutionsResponse] = await Promise.all([
        api.get<{ success: boolean; data: Crop[] }>(
          `/marketing/pest-types/${item._id}/crops`,
        ),
        api.get<{ success: boolean; data: Solution[] }>(
          `/marketing/pest-types/${item._id}/solutions`,
        ),
      ]);

      setAssociatedCrops(cropsResponse.data.data || []);
      setAssociatedSolutions(solutionsResponse.data.data || []);
    } catch (error) {
      console.error("Failed to fetch pest type details:", error);
    } finally {
      setDetailsLoading(false);
    }
  };

  const fetchCropsForAssignment = async () => {
    try {
      setLookupLoading(true);

      const response = await api.get<ListResponse<Crop>>(
        "/marketing/crops",
        {
          params: {
            page: 1,
            limit: LOOKUP_LIMIT,
          },
        },
      );

      setAllCrops(response.data.data || []);
    } catch (error) {
      console.error("Failed to fetch crops:", error);
    } finally {
      setLookupLoading(false);
    }
  };

  const fetchSolutionsForAssignment = async () => {
    try {
      setLookupLoading(true);

      const response = await api.get<ListResponse<Solution>>(
        "/marketing/solutions",
        {
          params: {
            page: 1,
            limit: LOOKUP_LIMIT,
          },
        },
      );

      setAllSolutions(response.data.data || []);
    } catch (error) {
      console.error("Failed to fetch solutions:", error);
    } finally {
      setLookupLoading(false);
    }
  };

  const openAssignCrop = async () => {
    setCropSearch("");
    setAssignCropOpen(true);

    if (allCrops.length === 0) {
      await fetchCropsForAssignment();
    }
  };

  const openAssignSolution = async () => {
    setSolutionSearch("");
    setAssignSolutionOpen(true);

    if (allSolutions.length === 0) {
      await fetchSolutionsForAssignment();
    }
  };

  const assignCrop = async (cropId: string) => {
    if (!selectedPestType) return;

    try {
      setAssigning(true);

      await api.post(
        `/marketing/crops/${cropId}/pest-types`,
        {
          pestTypeId: selectedPestType._id,
        },
      );

      await openDetails(selectedPestType);
      setAssignCropOpen(false);
    } catch (error) {
      console.error("Failed to assign crop:", error);
    } finally {
      setAssigning(false);
    }
  };

  const removeCrop = async (cropId: string) => {
    if (!selectedPestType) return;

    try {
      setAssigning(true);

      await api.delete(
        `/marketing/crops/${cropId}/pest-types/${selectedPestType._id}`,
      );

      await openDetails(selectedPestType);
    } catch (error) {
      console.error("Failed to remove crop:", error);
    } finally {
      setAssigning(false);
    }
  };

  const assignSolution = async (solutionId: string) => {
    if (!selectedPestType) return;

    try {
      setAssigning(true);

      await api.post(
        `/marketing/pest-types/${selectedPestType._id}/solutions`,
        {
          solutionId,
        },
      );

      await openDetails(selectedPestType);
      setAssignSolutionOpen(false);
    } catch (error) {
      console.error("Failed to assign solution:", error);
    } finally {
      setAssigning(false);
    }
  };

  const removeSolution = async (solutionId: string) => {
    if (!selectedPestType) return;

    try {
      setAssigning(true);

      await api.delete(
        `/marketing/pest-types/${selectedPestType._id}/solutions/${solutionId}`,
      );

      await openDetails(selectedPestType);
    } catch (error) {
      console.error("Failed to remove solution:", error);
    } finally {
      setAssigning(false);
    }
  };

  const assignedCropIds = useMemo(
    () => new Set(associatedCrops.map((item) => item._id)),
    [associatedCrops],
  );

  const assignedSolutionIds = useMemo(
    () => new Set(associatedSolutions.map((item) => item._id)),
    [associatedSolutions],
  );

  const filteredCrops = useMemo(() => {
    const query = cropSearch.trim().toLowerCase();

    return allCrops.filter((item) => {
      if (assignedCropIds.has(item._id)) return false;

      if (!query) return true;

      return item.name.toLowerCase().includes(query);
    });
  }, [allCrops, assignedCropIds, cropSearch]);

  const filteredSolutions = useMemo(() => {
    const query = solutionSearch.trim().toLowerCase();

    return allSolutions.filter((item) => {
      if (assignedSolutionIds.has(item._id)) return false;

      if (!query) return true;

      return item.name.toLowerCase().includes(query);
    });
  }, [allSolutions, assignedSolutionIds, solutionSearch]);

  return (
    <div className="min-h-full space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Link
              href="/marketing/setup"
              className="hover:text-foreground"
            >
              Marketing Setup
            </Link>

            <span>/</span>

            <span>Pest Types</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">
            Pest Types
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Manage pest types and their crop and solution relationships.
          </p>
        </div>

        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Pest Type
        </Button>
      </div>

      {/* Search */}
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search pest types..."
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[750px]">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Pest Type
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
              ) : pestTypes.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <EmptyState
                      searching={Boolean(search.trim())}
                      onAdd={openCreateDialog}
                    />
                  </td>
                </tr>
              ) : (
                pestTypes.map((item, index) => (
                  <motion.tr
                    key={item._id}
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
                          <Bug className="h-4 w-4" />
                        </div>

                        <div>
                          <div className="font-medium">{item.name}</div>

                          <div className="text-xs text-muted-foreground">
                            ID: {item._id}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <StatusBadge status={item.status} />
                    </td>

                    <td className="px-5 py-4 text-sm text-muted-foreground">
                      {formatDate(item.createdAt)}
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
                          <DropdownMenuItem
                            onClick={() => openDetails(item)}
                          >
                            <Bug className="mr-2 h-4 w-4" />
                            Configure
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => openEditDialog(item)}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => openDeleteDialog(item)}
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

        {!loading && pestTypes.length > 0 && (
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

      {/* Create / Edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>
              {editingPestType ? "Edit Pest Type" : "Add Pest Type"}
            </DialogTitle>

            <DialogDescription>
              {editingPestType
                ? "Update the pest type information."
                : "Add a new pest type to the marketing setup."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label htmlFor="pest-type-name">Pest Type Name</Label>

              <Input
                id="pest-type-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Brown Plant Hopper"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>

              <Select
                value={status}
                onValueChange={(value: Status) => setStatus(value)}
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
              disabled={saving}
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>

            <Button
              disabled={!name.trim() || saving}
              onClick={handleSubmit}
            >
              {saving
                ? "Saving..."
                : editingPestType
                  ? "Save Changes"
                  : "Create Pest Type"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Delete Pest Type</DialogTitle>

            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">
                {selectedPestType?.name}
              </span>
              ?
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
              {deleting ? "Deleting..." : "Delete Pest Type"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Configure */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[750px]">
          <DialogHeader>
            <DialogTitle>
              {selectedPestType?.name}
            </DialogTitle>

            <DialogDescription>
              Manage the crops and solutions associated with this pest
              type.
            </DialogDescription>
          </DialogHeader>

          {detailsLoading ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading configuration...
            </div>
          ) : (
            <div className="space-y-6">
              {/* Crops */}
              <section className="rounded-xl border">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Leaf className="h-4 w-4" />

                    <div>
                      <h3 className="text-sm font-semibold">Crops</h3>

                      <p className="text-xs text-muted-foreground">
                        Crops where this pest type applies.
                      </p>
                    </div>
                  </div>

                  <Button size="sm" onClick={openAssignCrop}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Add Crop
                  </Button>
                </div>

                <div className="p-4">
                  {associatedCrops.length === 0 ? (
                    <EmptyRelationship
                      icon={<Leaf className="h-4 w-4" />}
                      text="No crops assigned."
                    />
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {associatedCrops.map((crop) => (
                        <div
                          key={crop._id}
                          className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2"
                        >
                          <Leaf className="h-3.5 w-3.5" />

                          <span className="text-sm">
                            {crop.name}
                          </span>

                          <button
                            type="button"
                            disabled={assigning}
                            onClick={() => removeCrop(crop._id)}
                            className="ml-1 rounded-md p-0.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* Solutions */}
              <section className="rounded-xl border">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-4 w-4" />

                    <div>
                      <h3 className="text-sm font-semibold">
                        Solutions
                      </h3>

                      <p className="text-xs text-muted-foreground">
                        Solutions used to treat this pest type.
                      </p>
                    </div>
                  </div>

                  <Button size="sm" onClick={openAssignSolution}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Add Solution
                  </Button>
                </div>

                <div className="p-4">
                  {associatedSolutions.length === 0 ? (
                    <EmptyRelationship
                      icon={<FlaskConical className="h-4 w-4" />}
                      text="No solutions assigned."
                    />
                  ) : (
                    <div className="space-y-2">
                      {associatedSolutions.map((solution) => (
                        <div
                          key={solution._id}
                          className="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-3"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-background">
                            <FlaskConical className="h-4 w-4" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium">
                              {solution.name}
                            </div>

                            {solution.status && (
                              <div className="text-xs text-muted-foreground">
                                {solution.status}
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            disabled={assigning}
                            onClick={() =>
                              removeSolution(solution._id)
                            }
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDetailsOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Crop */}
      <Dialog
        open={assignCropOpen}
        onOpenChange={setAssignCropOpen}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Crop</DialogTitle>

            <DialogDescription>
              Select a crop for{" "}
              <span className="font-medium text-foreground">
                {selectedPestType?.name}
              </span>
              .
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              value={cropSearch}
              onChange={(event) => setCropSearch(event.target.value)}
              placeholder="Search crops..."
              className="pl-9"
            />
          </div>

          <div className="max-h-[350px] overflow-y-auto rounded-lg border">
            {lookupLoading ? (
              <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading crops...
              </div>
            ) : filteredCrops.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                No available crops found.
              </div>
            ) : (
              <div className="divide-y">
                {filteredCrops.map((crop) => (
                  <button
                    key={crop._id}
                    type="button"
                    disabled={assigning}
                    onClick={() => assignCrop(crop._id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 disabled:opacity-50"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                      <Leaf className="h-4 w-4" />
                    </div>

                    <span className="flex-1 text-sm font-medium">
                      {crop.name}
                    </span>

                    {assigning ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignCropOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Solution */}
      <Dialog
        open={assignSolutionOpen}
        onOpenChange={setAssignSolutionOpen}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Solution</DialogTitle>

            <DialogDescription>
              Select a solution for{" "}
              <span className="font-medium text-foreground">
                {selectedPestType?.name}
              </span>
              .
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              value={solutionSearch}
              onChange={(event) =>
                setSolutionSearch(event.target.value)
              }
              placeholder="Search solutions..."
              className="pl-9"
            />
          </div>

          <div className="max-h-[350px] overflow-y-auto rounded-lg border">
            {lookupLoading ? (
              <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading solutions...
              </div>
            ) : filteredSolutions.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                No available solutions found.
              </div>
            ) : (
              <div className="divide-y">
                {filteredSolutions.map((solution) => (
                  <button
                    key={solution._id}
                    type="button"
                    disabled={assigning}
                    onClick={() => assignSolution(solution._id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 disabled:opacity-50"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                      <FlaskConical className="h-4 w-4" />
                    </div>

                    <span className="flex-1 text-sm font-medium">
                      {solution.name}
                    </span>

                    {assigning ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignSolutionOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status?: Status }) {
  const active = status !== "inactive";

  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        active
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "bg-muted text-muted-foreground",
      ].join(" ")}
    >
      <span
        className={[
          "mr-1.5 h-1.5 w-1.5 rounded-full",
          active ? "bg-emerald-500" : "bg-muted-foreground",
        ].join(" ")}
      />

      {active ? "Active" : "Inactive"}
    </span>
  );
}

function EmptyRelationship({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground">
      {icon}
      {text}
    </div>
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
                <div className="h-4 w-36 animate-pulse rounded bg-muted" />
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
  searching,
  onAdd,
}: {
  searching: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
        <Bug className="h-5 w-5 text-muted-foreground" />
      </div>

      <h3 className="mt-4 text-sm font-semibold">
        {searching ? "No pest types found" : "No pest types yet"}
      </h3>

      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {searching
          ? "Try changing your search term."
          : "Create your first pest type to start configuring the marketing setup."}
      </p>

      {!searching && (
        <Button className="mt-5" onClick={onAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add Pest Type
        </Button>
      )}
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}