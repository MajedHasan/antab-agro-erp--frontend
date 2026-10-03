"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Bug,
  ChevronDown,
  ChevronRight,
  Edit,
  FlaskConical,
  Leaf,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  X,
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

interface Crop {
  _id: string;
  name: string;
  status?: Status;
}

interface PestType {
  _id: string;
  name: string;
  status?: Status;
}

interface Solution {
  _id: string;
  name: string;
  status?: Status;
}

interface Dose {
  _id: string;
  solutionId: string;
  amount: number;
  unit: "ml/L" | "g/L";
  frequency?: string;
  duration?: string;
  status?: Status;
}

interface PestTypeHierarchy {
  pestType: PestType;
  solutions: SolutionHierarchy[];
}

interface SolutionHierarchy {
  solution: Solution;
  doses: Dose[];
}

interface CropHierarchyResponse {
  success: boolean;
  data: {
    crop: Crop;
    pestTypes: PestTypeHierarchy[];
  };
}

interface PestTypeListResponse {
  success: boolean;
  data: PestType[];
  total: number;
  page: number;
  limit: number;
}

interface SolutionListResponse {
  success: boolean;
  data: Solution[];
  total: number;
  page: number;
  limit: number;
}

const PAGE_LIMIT = 100;

export default function CropConfigurationPage() {
  const params = useParams();
  const cropId = params.id as string;

  const [crop, setCrop] = useState<Crop | null>(null);
  const [hierarchy, setHierarchy] = useState<PestTypeHierarchy[]>([]);

  const [availablePestTypes, setAvailablePestTypes] = useState<PestType[]>(
    [],
  );

  const [availableSolutions, setAvailableSolutions] = useState<Solution[]>(
    [],
  );

  const [loading, setLoading] = useState(true);
  const [loadingPestTypes, setLoadingPestTypes] = useState(false);
  const [loadingSolutions, setLoadingSolutions] = useState(false);

  const [pestTypeDialogOpen, setPestTypeDialogOpen] = useState(false);
  const [solutionDialogOpen, setSolutionDialogOpen] = useState(false);
  const [doseDialogOpen, setDoseDialogOpen] = useState(false);

  const [selectedPestType, setSelectedPestType] =
    useState<PestTypeHierarchy | null>(null);

  const [selectedSolution, setSelectedSolution] =
    useState<SolutionHierarchy | null>(null);

  const [selectedDose, setSelectedDose] = useState<Dose | null>(null);

  const [pestTypeSearch, setPestTypeSearch] = useState("");
  const [solutionSearch, setSolutionSearch] = useState("");

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [expandedPests, setExpandedPests] = useState<Set<string>>(
    new Set(),
  );

  const [expandedSolutions, setExpandedSolutions] = useState<Set<string>>(
    new Set(),
  );

  const [doseAmount, setDoseAmount] = useState("");
  const [doseUnit, setDoseUnit] = useState<"ml/L" | "g/L">("ml/L");
  const [doseFrequency, setDoseFrequency] = useState("");
  const [doseDuration, setDoseDuration] = useState("");

  const fetchHierarchy = useCallback(async () => {
    try {
      setLoading(true);

      const response = await api.get<CropHierarchyResponse>(
        `/marketing/crops/${cropId}/hierarchy`,
      );

      setCrop(response.data.data.crop);
      setHierarchy(response.data.data.pestTypes || []);
    } catch (error) {
      console.error("Failed to fetch crop hierarchy:", error);
    } finally {
      setLoading(false);
    }
  }, [cropId]);

  const fetchPestTypes = useCallback(async () => {
    try {
      setLoadingPestTypes(true);

      const response = await api.get<PestTypeListResponse>(
        "/marketing/pest-types",
        {
          params: {
            page: 1,
            limit: PAGE_LIMIT,
          },
        },
      );

      setAvailablePestTypes(response.data.data || []);
    } catch (error) {
      console.error("Failed to fetch pest types:", error);
    } finally {
      setLoadingPestTypes(false);
    }
  }, []);

  const fetchSolutions = useCallback(async () => {
    try {
      setLoadingSolutions(true);

      const response = await api.get<SolutionListResponse>(
        "/marketing/solutions",
        {
          params: {
            page: 1,
            limit: PAGE_LIMIT,
          },
        },
      );

      setAvailableSolutions(response.data.data || []);
    } catch (error) {
      console.error("Failed to fetch solutions:", error);
    } finally {
      setLoadingSolutions(false);
    }
  }, []);

  useEffect(() => {
    if (!cropId) return;

    fetchHierarchy();
  }, [cropId, fetchHierarchy]);

  const openPestTypeDialog = async () => {
    setPestTypeSearch("");
    setPestTypeDialogOpen(true);

    if (availablePestTypes.length === 0) {
      await fetchPestTypes();
    }
  };

  const openSolutionDialog = async (pestType: PestTypeHierarchy) => {
    setSelectedPestType(pestType);
    setSolutionSearch("");
    setSolutionDialogOpen(true);

    if (availableSolutions.length === 0) {
      await fetchSolutions();
    }
  };

  const openCreateDoseDialog = (solution: SolutionHierarchy) => {
    setSelectedSolution(solution);
    setSelectedDose(null);

    setDoseAmount("");
    setDoseUnit("ml/L");
    setDoseFrequency("");
    setDoseDuration("");

    setDoseDialogOpen(true);
  };

  const openEditDoseDialog = (
    solution: SolutionHierarchy,
    dose: Dose,
  ) => {
    setSelectedSolution(solution);
    setSelectedDose(dose);

    setDoseAmount(String(dose.amount));
    setDoseUnit(dose.unit);
    setDoseFrequency(dose.frequency || "");
    setDoseDuration(dose.duration || "");

    setDoseDialogOpen(true);
  };

  const assignPestType = async (pestTypeId: string) => {
    try {
      setSaving(true);

      await api.post(`/marketing/crops/${cropId}/pest-types`, {
        pestTypeId,
      });

      await fetchHierarchy();
      setPestTypeDialogOpen(false);
    } catch (error) {
      console.error("Failed to assign pest type:", error);
    } finally {
      setSaving(false);
    }
  };

  const removePestType = async (pestTypeId: string) => {
    try {
      setDeleting(true);

      await api.delete(
        `/marketing/crops/${cropId}/pest-types/${pestTypeId}`,
      );

      await fetchHierarchy();
    } catch (error) {
      console.error("Failed to remove pest type:", error);
    } finally {
      setDeleting(false);
    }
  };

  const assignSolution = async (solutionId: string) => {
    if (!selectedPestType) return;

    try {
      setSaving(true);

      await api.post(
        `/marketing/pest-types/${selectedPestType.pestType._id}/solutions`,
        {
          solutionId,
        },
      );

      await fetchHierarchy();
      setSolutionDialogOpen(false);
    } catch (error) {
      console.error("Failed to assign solution:", error);
    } finally {
      setSaving(false);
    }
  };

  const removeSolution = async (
    pestTypeId: string,
    solutionId: string,
  ) => {
    try {
      setDeleting(true);

      await api.delete(
        `/marketing/pest-types/${pestTypeId}/solutions/${solutionId}`,
      );

      await fetchHierarchy();
    } catch (error) {
      console.error("Failed to remove solution:", error);
    } finally {
      setDeleting(false);
    }
  };

  const handleDoseSubmit = async () => {
    if (!selectedSolution) return;

    const amount = Number(doseAmount);

    if (!doseAmount.trim() || Number.isNaN(amount) || amount <= 0) {
      return;
    }

    try {
      setSaving(true);

      const payload = {
        amount,
        unit: doseUnit,
        frequency: doseFrequency.trim(),
        duration: doseDuration.trim(),
      };

      if (selectedDose) {
        await api.patch(
          `/marketing/solutions/${selectedSolution.solution._id}/doses/${selectedDose._id}`,
          payload,
        );
      } else {
        await api.post(
          `/marketing/solutions/${selectedSolution.solution._id}/doses`,
          payload,
        );
      }

      await fetchHierarchy();

      setDoseDialogOpen(false);
      setSelectedDose(null);
    } catch (error) {
      console.error("Failed to save dose:", error);
    } finally {
      setSaving(false);
    }
  };

  const removeDose = async (dose: Dose) => {
    try {
      setDeleting(true);

      await api.delete(
        `/marketing/solutions/${dose.solutionId}/doses/${dose._id}`,
      );

      await fetchHierarchy();
    } catch (error) {
      console.error("Failed to remove dose:", error);
    } finally {
      setDeleting(false);
    }
  };

  const togglePest = (id: string) => {
    setExpandedPests((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };

  const toggleSolution = (id: string) => {
    setExpandedSolutions((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };

  const assignedPestTypeIds = useMemo(
    () => new Set(hierarchy?.map((item) => item?.pestType?._id)),
    [hierarchy],
  );

  const filteredPestTypes = useMemo(() => {
    const search = pestTypeSearch.trim().toLowerCase();

    return availablePestTypes.filter((item) => {
      if (assignedPestTypeIds.has(item._id)) return false;

      if (!search) return true;

      return item.name.toLowerCase().includes(search);
    });
  }, [availablePestTypes, assignedPestTypeIds, pestTypeSearch]);

  const assignedSolutionIds = useMemo(() => {
    if (!selectedPestType) return new Set<string>();

    return new Set(
      selectedPestType?.solutions?.map((item) => item?.solution?._id),
    );
  }, [selectedPestType]);

  const filteredSolutions = useMemo(() => {
    const search = solutionSearch.trim().toLowerCase();

    return availableSolutions.filter((item) => {
      if (assignedSolutionIds.has(item._id)) return false;

      if (!search) return true;

      return item.name.toLowerCase().includes(search);
    });
  }, [availableSolutions, assignedSolutionIds, solutionSearch]);

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading crop configuration...
        </div>
      </div>
    );
  }

  if (!crop) {
    return (
      <div className="min-h-full p-6">
        <div className="rounded-xl border bg-card p-10 text-center">
          <Leaf className="mx-auto h-8 w-8 text-muted-foreground" />

          <h2 className="mt-4 text-lg font-semibold">Crop not found</h2>

          <p className="mt-1 text-sm text-muted-foreground">
            The requested crop could not be found.
          </p>

          <Button asChild className="mt-5">
            <Link href="/marketing/setup/crops">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Crops
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full space-y-6 p-6">
      {/* Header */}
      <div>
        <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Link
            href="/marketing/setup"
            className="hover:text-foreground"
          >
            Marketing Setup
          </Link>

          <ChevronRight className="h-4 w-4" />

          <Link
            href="/marketing/setup/crops"
            className="hover:text-foreground"
          >
            Crops
          </Link>

          <ChevronRight className="h-4 w-4" />

          <span>{crop.name}</span>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
              <Leaf className="h-5 w-5" />
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {crop.name}
              </h1>

              <p className="mt-1 text-sm text-muted-foreground">
                Configure pest types, solutions and treatment doses.
              </p>
            </div>
          </div>

          <Button onClick={openPestTypeDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Pest Type
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          icon={<Bug className="h-4 w-4" />}
          label="Pest Types"
          value={hierarchy.length}
        />

        <SummaryCard
          icon={<FlaskConical className="h-4 w-4" />}
          label="Solutions"
          value={hierarchy.reduce(
            (total, pest) => total + (pest?.solutions?.length || 0),
            0,
          )}
        />

        <SummaryCard
          icon={<span className="text-xs font-bold">D</span>}
          label="Doses"
          value={hierarchy.reduce(
            (total, pest) =>
              total +
              (pest?.solutions?.reduce(
                (solutionTotal, solution) =>
                  solutionTotal + (solution?.doses?.length || 0),
                0,
              ) || 0),
            0,
          )}
        />
      </div>

      {/* Hierarchy */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="font-semibold">Treatment Configuration</h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Manage the treatment structure for {crop.name}.
            </p>
          </div>

          <Button variant="outline" onClick={openPestTypeDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Pest Type
          </Button>
        </div>

        {hierarchy.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
              <Bug className="h-5 w-5 text-muted-foreground" />
            </div>

            <h3 className="mt-4 text-sm font-semibold">
              No pest types configured
            </h3>

            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Add a pest type to start configuring solutions and doses for
              this crop.
            </p>

            <Button className="mt-5" onClick={openPestTypeDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add Pest Type
            </Button>
          </div>
        ) : (
          <div className="divide-y">
            {hierarchy.map((pestHierarchy, index) => {
              const pestId = pestHierarchy?.pestType?._id;
              const expanded = expandedPests?.has(pestId);

              return (
                <motion.div
                  key={pestId}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.2,
                    delay: index * 0.03,
                  }}
                >
                  {/* Pest */}
                  <div className="flex items-center gap-3 px-5 py-4 hover:bg-muted/20">
                    <button
                      type="button"
                      onClick={() => togglePest(pestId)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-muted"
                    >
                      {expanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>

                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Bug className="h-4 w-4" />
                    </div>

                    <button
                      type="button"
                      onClick={() => togglePest(pestId)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="font-medium">
                        {pestHierarchy?.pestType?.name}
                      </div>

                      <div className="text-xs text-muted-foreground">
                        {pestHierarchy?.solutions?.length}{" "}
                        {pestHierarchy?.solutions?.length === 1
                          ? "solution"
                          : "solutions"}
                      </div>
                    </button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openSolutionDialog(pestHierarchy)}
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Solution
                    </Button>

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
                          className="text-destructive focus:text-destructive"
                          disabled={deleting}
                          onClick={() => removePestType(pestId)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove Pest Type
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Solutions */}
                  {expanded && (
                    <div className="border-t bg-muted/10 px-5 py-4 pl-[4.5rem]">
                      {pestHierarchy?.solutions?.length === 0 ? (
                        <div className="rounded-lg border border-dashed bg-background px-5 py-8 text-center">
                          <FlaskConical className="mx-auto h-5 w-5 text-muted-foreground" />

                          <p className="mt-2 text-sm font-medium">
                            No solutions configured
                          </p>

                          <p className="mt-1 text-xs text-muted-foreground">
                            Add a solution for this pest type.
                          </p>

                          <Button
                            size="sm"
                            className="mt-4"
                            onClick={() =>
                              openSolutionDialog(pestHierarchy)
                            }
                          >
                            <Plus className="mr-2 h-3.5 w-3.5" />
                            Add Solution
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {pestHierarchy?.solutions?.map((solutionItem) => {
                            const solutionId = solutionItem.solution._id;
                            const solutionExpanded =
                              expandedSolutions.has(solutionId);

                            return (
                              <div
                                key={solutionId}
                                className="rounded-lg border bg-background"
                              >
                                <div className="flex items-center gap-3 px-4 py-3">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      toggleSolution(solutionId)
                                    }
                                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-muted"
                                  >
                                    {solutionExpanded ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                  </button>

                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                                    <FlaskConical className="h-4 w-4" />
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      toggleSolution(solutionId)
                                    }
                                    className="min-w-0 flex-1 text-left"
                                  >
                                    <div className="text-sm font-medium">
                                      {solutionItem.solution.name}
                                    </div>

                                    <div className="text-xs text-muted-foreground">
                                      {solutionItem.doses.length}{" "}
                                      {solutionItem.doses.length === 1
                                        ? "dose"
                                        : "doses"}
                                    </div>
                                  </button>

                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      openCreateDoseDialog(solutionItem)
                                    }
                                  >
                                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                                    Dose
                                  </Button>

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
                                        className="text-destructive focus:text-destructive"
                                        disabled={deleting}
                                        onClick={() =>
                                          removeSolution(
                                            pestId,
                                            solutionId,
                                          )
                                        }
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Remove Solution
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>

                                {solutionExpanded && (
                                  <div className="border-t px-4 py-3">
                                    {solutionItem.doses.length === 0 ? (
                                      <div className="rounded-md border border-dashed px-4 py-6 text-center">
                                        <p className="text-xs text-muted-foreground">
                                          No doses configured.
                                        </p>

                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="mt-2"
                                          onClick={() =>
                                            openCreateDoseDialog(
                                              solutionItem,
                                            )
                                          }
                                        >
                                          <Plus className="mr-1.5 h-3.5 w-3.5" />
                                          Add Dose
                                        </Button>
                                      </div>
                                    ) : (
                                      <div className="space-y-2">
                                        {solutionItem.doses.map((dose) => (
                                          <div
                                            key={dose._id}
                                            className="flex items-center gap-3 rounded-md border bg-muted/20 px-3 py-2.5"
                                          >
                                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-background text-xs font-semibold">
                                              D
                                            </div>

                                            <div className="min-w-0 flex-1">
                                              <div className="text-sm font-medium">
                                                {dose.amount} {dose.unit}
                                              </div>

                                              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                                {dose.frequency && (
                                                  <span>
                                                    Frequency:{" "}
                                                    {dose.frequency}
                                                  </span>
                                                )}

                                                {dose.duration && (
                                                  <span>
                                                    Duration:{" "}
                                                    {dose.duration}
                                                  </span>
                                                )}
                                              </div>
                                            </div>

                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-8 w-8"
                                              onClick={() =>
                                                openEditDoseDialog(
                                                  solutionItem,
                                                  dose,
                                                )
                                              }
                                            >
                                              <Edit className="h-3.5 w-3.5" />
                                            </Button>

                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-8 w-8 text-destructive hover:text-destructive"
                                              disabled={deleting}
                                              onClick={() =>
                                                removeDose(dose)
                                              }
                                            >
                                              <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Pest Type */}
      <Dialog
        open={pestTypeDialogOpen}
        onOpenChange={setPestTypeDialogOpen}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Pest Type</DialogTitle>

            <DialogDescription>
              Select a pest type to associate with {crop.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              value={pestTypeSearch}
              onChange={(event) =>
                setPestTypeSearch(event.target.value)
              }
              placeholder="Search pest types..."
              className="pl-9"
            />
          </div>

          <div className="max-h-[350px] overflow-y-auto rounded-lg border">
            {loadingPestTypes ? (
              <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading pest types...
              </div>
            ) : filteredPestTypes.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                No available pest types found.
              </div>
            ) : (
              <div className="divide-y">
                {filteredPestTypes.map((item) => (
                  <button
                    key={item._id}
                    type="button"
                    disabled={saving}
                    onClick={() => assignPestType(item._id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 disabled:opacity-50"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                      <Bug className="h-4 w-4" />
                    </div>

                    <div className="flex-1">
                      <div className="text-sm font-medium">
                        {item.name}
                      </div>

                      {item.status && (
                        <div className="text-xs text-muted-foreground">
                          {item.status}
                        </div>
                      )}
                    </div>

                    {saving ? (
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
              onClick={() => setPestTypeDialogOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Solution */}
      <Dialog
        open={solutionDialogOpen}
        onOpenChange={setSolutionDialogOpen}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Solution</DialogTitle>

            <DialogDescription>
              Select a solution for{" "}
              <span className="font-medium text-foreground">
                {selectedPestType?.pestType?.name}
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
            {loadingSolutions ? (
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
                {filteredSolutions.map((item) => (
                  <button
                    key={item._id}
                    type="button"
                    disabled={saving}
                    onClick={() => assignSolution(item._id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 disabled:opacity-50"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                      <FlaskConical className="h-4 w-4" />
                    </div>

                    <div className="flex-1">
                      <div className="text-sm font-medium">
                        {item.name}
                      </div>

                      {item.status && (
                        <div className="text-xs text-muted-foreground">
                          {item.status}
                        </div>
                      )}
                    </div>

                    {saving ? (
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
              onClick={() => setSolutionDialogOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dose Dialog */}
      <Dialog open={doseDialogOpen} onOpenChange={setDoseDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {selectedDose ? "Edit Dose" : "Add Dose"}
            </DialogTitle>

            <DialogDescription>
              Configure the treatment dose for{" "}
              <span className="font-medium text-foreground">
                {selectedSolution?.solution.name}
              </span>
              .
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label htmlFor="dose-amount">Amount</Label>

              <Input
                id="dose-amount"
                type="number"
                min="0"
                step="any"
                value={doseAmount}
                onChange={(event) =>
                  setDoseAmount(event.target.value)
                }
                placeholder="e.g. 5"
              />
            </div>

            <div className="space-y-2">
              <Label>Unit</Label>

              <Select
                value={doseUnit}
                onValueChange={(value: "ml/L" | "g/L") =>
                  setDoseUnit(value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="ml/L">ml/L</SelectItem>
                  <SelectItem value="g/L">g/L</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dose-frequency">Frequency</Label>

              <Input
                id="dose-frequency"
                value={doseFrequency}
                onChange={(event) =>
                  setDoseFrequency(event.target.value)
                }
                placeholder="e.g. Once every 7 days"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dose-duration">Duration</Label>

              <Input
                id="dose-duration"
                value={doseDuration}
                onChange={(event) =>
                  setDoseDuration(event.target.value)
                }
                placeholder="e.g. 3 weeks"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setDoseDialogOpen(false)}
            >
              Cancel
            </Button>

            <Button
              disabled={
                saving ||
                !doseAmount.trim() ||
                Number(doseAmount) <= 0
              }
              onClick={handleDoseSubmit}
            >
              {saving
                ? "Saving..."
                : selectedDose
                  ? "Save Changes"
                  : "Add Dose"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
          {icon}
        </div>

        <div>
          <div className="text-xs text-muted-foreground">{label}</div>

          <div className="mt-0.5 text-xl font-semibold">{value}</div>
        </div>
      </div>
    </div>
  );
}