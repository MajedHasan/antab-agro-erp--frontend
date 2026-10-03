"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import {
  Search,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Settings2,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  Bug,
  Droplets,
  Check,
  AlertCircle,
} from "lucide-react";

type Status = "active" | "inactive";

interface Solution {
  _id: string;
  name: string;
  status?: Status;
  createdAt?: string;
  updatedAt?: string;
}

interface PestType {
  _id: string;
  name: string;
  status?: Status;
}

interface Dose {
  _id: string;
  solutionId: string;
  amount: number;
  unit: "ml/L" | "g/L";
  frequency: string;
  duration: string;
  status?: Status;
  createdAt?: string;
  updatedAt?: string;
}

interface ListResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  limit: number;
}

const PAGE_LIMIT = 10;

const emptySolutionForm = {
  name: "",
  status: "active" as Status,
};

const emptyDoseForm = {
  amount: "",
  unit: "ml/L" as "ml/L" | "g/L",
  frequency: "",
  duration: "",
};

export default function SolutionsPage() {
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [pestTypes, setPestTypes] = useState<PestType[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [solutionDialog, setSolutionDialog] = useState(false);
  const [editingSolution, setEditingSolution] = useState<Solution | null>(
    null,
  );
  const [solutionForm, setSolutionForm] = useState(emptySolutionForm);

  const [configureDialog, setConfigureDialog] = useState(false);
  const [selectedSolution, setSelectedSolution] =
    useState<Solution | null>(null);

  const [associatedPestTypes, setAssociatedPestTypes] = useState<PestType[]>(
    [],
  );

  const [doses, setDoses] = useState<Dose[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [selectedPestTypeId, setSelectedPestTypeId] = useState("");

  const [doseDialog, setDoseDialog] = useState(false);
  const [editingDose, setEditingDose] = useState<Dose | null>(null);
  const [doseForm, setDoseForm] = useState(emptyDoseForm);

  const [deleteTarget, setDeleteTarget] = useState<{
    type: "solution" | "dose";
    id: string;
    name?: string;
  } | null>(null);

  const [actionLoading, setActionLoading] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  /* -------------------------------------------------------------------------- */
  /* Helpers                                                                    */
  /* -------------------------------------------------------------------------- */

  const getErrorMessage = (error: any) => {
    return (
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      "Something went wrong. Please try again."
    );
  };

  const formatDate = (date?: string) => {
    if (!date) return "—";

    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  /* -------------------------------------------------------------------------- */
  /* Load Solutions                                                             */
  /* -------------------------------------------------------------------------- */

  const loadSolutions = async () => {
    try {
      setLoading(true);

      const params: Record<string, any> = {
        page,
        limit: PAGE_LIMIT,
        sort: "name",
      };

      if (search.trim()) {
        params.q = search.trim();
      }

      const response = await api.get<ListResponse<Solution>>(
        "/marketing/solutions",
        {
          params,
        },
      );

      setSolutions(response.data.data || []);
      setTotal(response.data.total || 0);
    } catch (error) {
      console.error("Failed to load solutions:", error);
      alert(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* Load Pest Types                                                             */
  /* -------------------------------------------------------------------------- */

  const loadPestTypes = async () => {
    try {
      const response = await api.get<ListResponse<PestType>>(
        "/marketing/pest-types",
        {
          params: {
            page: 1,
            limit: 500,
            sort: "name",
          },
        },
      );

      setPestTypes(response.data.data || []);
    } catch (error) {
      console.error("Failed to load pest types:", error);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* Initial / Search Loading                                                   */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    loadSolutions();
  }, [page]);

  useEffect(() => {
    loadPestTypes();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (page === 1) {
        loadSolutions();
      } else {
        setPage(1);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [search]);

  /* -------------------------------------------------------------------------- */
  /* Solution CRUD                                                              */
  /* -------------------------------------------------------------------------- */

  const openCreateSolution = () => {
    setEditingSolution(null);
    setSolutionForm(emptySolutionForm);
    setSolutionDialog(true);
  };

  const openEditSolution = (solution: Solution) => {
    setEditingSolution(solution);

    setSolutionForm({
      name: solution.name || "",
      status: solution.status || "active",
    });

    setSolutionDialog(true);
  };

  const saveSolution = async () => {
    if (!solutionForm.name.trim()) {
      alert("Solution name is required.");
      return;
    }

    try {
      setSaving(true);

      if (editingSolution) {
        await api.put(`/marketing/solutions/${editingSolution._id}`, {
          name: solutionForm.name.trim(),
          status: solutionForm.status,
        });
      } else {
        await api.post("/marketing/solutions", {
          name: solutionForm.name.trim(),
          status: solutionForm.status,
        });
      }

      setSolutionDialog(false);
      setEditingSolution(null);
      setSolutionForm(emptySolutionForm);

      await loadSolutions();
    } catch (error) {
      console.error("Failed to save solution:", error);
      alert(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteSolution = (solution: Solution) => {
    setDeleteTarget({
      type: "solution",
      id: solution._id,
      name: solution.name,
    });
  };

  /* -------------------------------------------------------------------------- */
  /* Configure Solution                                                         */
  /* -------------------------------------------------------------------------- */

  const openConfigure = async (solution: Solution) => {
    setSelectedSolution(solution);
    setConfigureDialog(true);
    setSelectedPestTypeId("");

    await loadSolutionDetails(solution._id);
  };

  const loadSolutionDetails = async (solutionId: string) => {
    try {
      setLoadingDetails(true);

      const [pestResponse, doseResponse] = await Promise.all([
        api.get(`/marketing/solutions/${solutionId}/pest-types`),
        api.get(`/marketing/solutions/${solutionId}/doses`),
      ]);

      setAssociatedPestTypes(pestResponse.data.data || []);
      setDoses(doseResponse.data.data || []);
    } catch (error) {
      console.error("Failed to load solution details:", error);
      alert(getErrorMessage(error));
    } finally {
      setLoadingDetails(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* Pest Type Assignment                                                       */
  /* -------------------------------------------------------------------------- */

  const assignPestType = async () => {
    if (!selectedSolution || !selectedPestTypeId) return;

    const alreadyAssigned = associatedPestTypes.some(
      (item) => item._id === selectedPestTypeId,
    );

    if (alreadyAssigned) {
      alert("This pest type is already assigned.");
      return;
    }

    try {
      setActionLoading(true);

      await api.post(
        `/marketing/solutions/${selectedSolution._id}/pest-types`,
        {
          pestTypeId: selectedPestTypeId,
        },
      );

      setSelectedPestTypeId("");

      await loadSolutionDetails(selectedSolution._id);
    } catch (error) {
      console.error("Failed to assign pest type:", error);
      alert(getErrorMessage(error));
    } finally {
      setActionLoading(false);
    }
  };

  const removePestType = async (pestTypeId: string) => {
    if (!selectedSolution) return;

    try {
      setActionLoading(true);

      await api.delete(
        `/marketing/solutions/${selectedSolution._id}/pest-types/${pestTypeId}`,
      );

      await loadSolutionDetails(selectedSolution._id);
    } catch (error) {
      console.error("Failed to remove pest type:", error);
      alert(getErrorMessage(error));
    } finally {
      setActionLoading(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* Dose Management                                                            */
  /* -------------------------------------------------------------------------- */

  const openCreateDose = () => {
    setEditingDose(null);
    setDoseForm(emptyDoseForm);
    setDoseDialog(true);
  };

  const openEditDose = (dose: Dose) => {
    setEditingDose(dose);

    setDoseForm({
      amount:
        dose.amount !== undefined && dose.amount !== null
          ? String(dose.amount)
          : "",
      unit: dose.unit || "ml/L",
      frequency: dose.frequency || "",
      duration: dose.duration || "",
    });

    setDoseDialog(true);
  };

  const saveDose = async () => {
    if (!selectedSolution) return;

    if (!doseForm.amount.trim()) {
      alert("Dose amount is required.");
      return;
    }

    const amount = Number(doseForm.amount);

    if (Number.isNaN(amount) || amount <= 0) {
      alert("Dose amount must be a valid number greater than 0.");
      return;
    }

    if (!doseForm.frequency.trim()) {
      alert("Frequency is required.");
      return;
    }

    if (!doseForm.duration.trim()) {
      alert("Duration is required.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        amount,
        unit: doseForm.unit,
        frequency: doseForm.frequency.trim(),
        duration: doseForm.duration.trim(),
      };

      if (editingDose) {
        /*
         * Nested dose update endpoint.
         *
         * If your backend router uses PUT instead of PATCH for this
         * nested endpoint, change only the next api.patch(...) to api.put(...).
         */
        await api.patch(
          `/marketing/solutions/${selectedSolution._id}/doses/${editingDose._id}`,
          payload,
        );
      } else {
        await api.post(
          `/marketing/solutions/${selectedSolution._id}/doses`,
          payload,
        );
      }

      setDoseDialog(false);
      setEditingDose(null);
      setDoseForm(emptyDoseForm);

      await loadSolutionDetails(selectedSolution._id);
    } catch (error) {
      console.error("Failed to save dose:", error);
      alert(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteDose = (dose: Dose) => {
    setDeleteTarget({
      type: "dose",
      id: dose._id,
    });
  };

  /* -------------------------------------------------------------------------- */
  /* Delete Confirmation                                                        */
  /* -------------------------------------------------------------------------- */

  const executeDelete = async () => {
    if (!deleteTarget) return;

    try {
      setActionLoading(true);

      if (deleteTarget.type === "solution") {
        await api.delete(`/marketing/solutions/${deleteTarget.id}`);

        setDeleteTarget(null);

        if (solutions.length === 1 && page > 1) {
          setPage((current) => current - 1);
        } else {
          await loadSolutions();
        }
      }

      if (deleteTarget.type === "dose") {
        if (!selectedSolution) return;

        await api.delete(
          `/marketing/solutions/${selectedSolution._id}/doses/${deleteTarget.id}`,
        );

        setDeleteTarget(null);

        await loadSolutionDetails(selectedSolution._id);
      }
    } catch (error) {
      console.error("Failed to delete:", error);
      alert(getErrorMessage(error));
    } finally {
      setActionLoading(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* Available Pest Types                                                       */
  /* -------------------------------------------------------------------------- */

  const availablePestTypes = useMemo(() => {
    const assignedIds = new Set(
      associatedPestTypes.map((pestType) => pestType._id),
    );

    return pestTypes.filter((pestType) => !assignedIds.has(pestType._id));
  }, [pestTypes, associatedPestTypes]);

  /* -------------------------------------------------------------------------- */
  /* Render                                                                     */
  /* -------------------------------------------------------------------------- */

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-[1500px] space-y-6">
        {/* ------------------------------------------------------------------ */}
        {/* Header                                                             */}
        {/* ------------------------------------------------------------------ */}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                <FlaskConical className="h-5 w-5" />
              </div>

              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                  Solutions
                </h1>

                <p className="mt-0.5 text-sm text-slate-500">
                  Manage agricultural solutions, pest relationships and doses.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={openCreateSolution}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Add Solution
          </button>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Main Card                                                          */}
        {/* ------------------------------------------------------------------ */}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {/* Search */}

          <div className="border-b border-slate-200 p-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search solutions..."
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {/* Table */}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Solution
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Status
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Created
                  </th>

                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-16">
                      <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading solutions...
                      </div>
                    </td>
                  </tr>
                ) : solutions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-16">
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                          <FlaskConical className="h-5 w-5 text-slate-400" />
                        </div>

                        <p className="mt-3 text-sm font-medium text-slate-900">
                          No solutions found
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          Add your first solution to get started.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  solutions.map((solution) => (
                    <tr
                      key={solution._id}
                      className="transition hover:bg-slate-50/70"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                            <FlaskConical className="h-4 w-4" />
                          </div>

                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {solution.name}
                            </p>

                            <p className="mt-0.5 text-xs text-slate-400">
                              ID: {solution._id}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                            solution.status === "inactive"
                              ? "bg-slate-100 text-slate-600"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          <span
                            className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
                              solution.status === "inactive"
                                ? "bg-slate-400"
                                : "bg-emerald-500"
                            }`}
                          />

                          {solution.status === "inactive"
                            ? "Inactive"
                            : "Active"}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-500">
                        {formatDate(solution.createdAt)}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openConfigure(solution)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-blue-600 transition hover:bg-blue-50"
                          >
                            <Settings2 className="h-3.5 w-3.5" />
                            Configure
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditSolution(solution)}
                            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => confirmDeleteSolution(solution)}
                            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}

          {!loading && total > 0 && (
            <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
              <p className="text-sm text-slate-500">
                Showing{" "}
                <span className="font-medium text-slate-700">
                  {(page - 1) * PAGE_LIMIT + 1}
                </span>{" "}
                to{" "}
                <span className="font-medium text-slate-700">
                  {Math.min(page * PAGE_LIMIT, total)}
                </span>{" "}
                of{" "}
                <span className="font-medium text-slate-700">{total}</span>
              </p>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <div className="flex h-8 min-w-8 items-center justify-center rounded-md bg-slate-900 px-2 text-xs font-medium text-white">
                  {page}
                </div>

                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() =>
                    setPage((current) =>
                      Math.min(totalPages, current + 1),
                    )
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* CREATE / EDIT SOLUTION DIALOG                                       */}
      {/* ==================================================================== */}

      {solutionDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {editingSolution ? "Edit Solution" : "Add Solution"}
                </h2>

                <p className="mt-0.5 text-sm text-slate-500">
                  {editingSolution
                    ? "Update solution information."
                    : "Create a new agricultural solution."}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSolutionDialog(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Solution Name <span className="text-red-500">*</span>
                </label>

                <input
                  autoFocus
                  value={solutionForm.name}
                  onChange={(e) =>
                    setSolutionForm((current) => ({
                      ...current,
                      name: e.target.value,
                    }))
                  }
                  placeholder="e.g. Borkot 2.5EC 500ml"
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Status
                </label>

                <select
                  value={solutionForm.status}
                  onChange={(e) =>
                    setSolutionForm((current) => ({
                      ...current,
                      status: e.target.value as Status,
                    }))
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50/60 px-6 py-4">
              <button
                type="button"
                onClick={() => setSolutionDialog(false)}
                className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={saveSolution}
                disabled={saving}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingSolution ? "Save Changes" : "Create Solution"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* CONFIGURE SOLUTION DIALOG                                           */}
      {/* ==================================================================== */}

      {configureDialog && selectedSolution && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 p-4 backdrop-blur-[2px]">
          <div className="mx-auto my-8 w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* Header */}

            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <FlaskConical className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {selectedSolution.name}
                  </h2>

                  <p className="mt-0.5 text-sm text-slate-500">
                    Configure pest types and treatment doses.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setConfigureDialog(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {loadingDetails ? (
              <div className="flex min-h-[400px] items-center justify-center">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading configuration...
                </div>
              </div>
            ) : (
              <div className="grid gap-0 lg:grid-cols-2">
                {/* ---------------------------------------------------------- */}
                {/* Pest Types                                                  */}
                {/* ---------------------------------------------------------- */}

                <div className="border-b border-slate-200 p-6 lg:border-b-0 lg:border-r">
                  <div className="mb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                          <Bug className="h-4 w-4 text-blue-600" />
                          Pest Types
                        </h3>

                        <p className="mt-1 text-xs text-slate-500">
                          Pest types where this solution can be used.
                        </p>
                      </div>

                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                        {associatedPestTypes.length}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <select
                      value={selectedPestTypeId}
                      onChange={(e) => setSelectedPestTypeId(e.target.value)}
                      className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="">Select pest type...</option>

                      {availablePestTypes.map((pestType) => (
                        <option key={pestType._id} value={pestType._id}>
                          {pestType.name}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={assignPestType}
                      disabled={!selectedPestTypeId || actionLoading}
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {actionLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                      Assign
                    </button>
                  </div>

                  <div className="mt-4 space-y-2">
                    {associatedPestTypes.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center">
                        <Bug className="mx-auto h-5 w-5 text-slate-300" />

                        <p className="mt-2 text-sm text-slate-500">
                          No pest types assigned.
                        </p>
                      </div>
                    ) : (
                      associatedPestTypes.map((pestType) => (
                        <div
                          key={pestType._id}
                          className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                              <Bug className="h-3.5 w-3.5" />
                            </div>

                            <span className="truncate text-sm font-medium text-slate-700">
                              {pestType.name}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => removePestType(pestType._id)}
                            disabled={actionLoading}
                            className="ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                            title="Remove"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* ---------------------------------------------------------- */}
                {/* Doses                                                       */}
                {/* ---------------------------------------------------------- */}

                <div className="p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <Droplets className="h-4 w-4 text-blue-600" />
                        Doses
                      </h3>

                      <p className="mt-1 text-xs text-slate-500">
                        Define how this solution should be applied.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={openCreateDose}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-medium text-white transition hover:bg-slate-800"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Dose
                    </button>
                  </div>

                  <div className="space-y-2">
                    {doses.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center">
                        <Droplets className="mx-auto h-5 w-5 text-slate-300" />

                        <p className="mt-2 text-sm text-slate-500">
                          No doses configured.
                        </p>

                        <button
                          type="button"
                          onClick={openCreateDose}
                          className="mt-3 text-xs font-medium text-blue-600 hover:text-blue-700"
                        >
                          Add the first dose
                        </button>
                      </div>
                    ) : (
                      doses.map((dose) => (
                        <div
                          key={dose._id}
                          className="rounded-xl border border-slate-200 bg-white p-3.5"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600">
                                <Droplets className="h-4 w-4" />
                              </div>

                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900">
                                  {dose.amount} {dose.unit}
                                </p>

                                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                                  <span>
                                    Frequency:{" "}
                                    <span className="font-medium text-slate-700">
                                      {dose.frequency}
                                    </span>
                                  </span>

                                  <span>
                                    Duration:{" "}
                                    <span className="font-medium text-slate-700">
                                      {dose.duration}
                                    </span>
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEditDose(dose)}
                                className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                                title="Edit dose"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => confirmDeleteDose(dose)}
                                className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                                title="Delete dose"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}

            <div className="flex justify-end border-t border-slate-200 bg-slate-50/60 px-6 py-4">
              <button
                type="button"
                onClick={() => setConfigureDialog(false)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* DOSE DIALOG                                                          */}
      {/* ==================================================================== */}

      {doseDialog && selectedSolution && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {editingDose ? "Edit Dose" : "Add Dose"}
                </h2>

                <p className="mt-0.5 text-sm text-slate-500">
                  {selectedSolution.name}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDoseDialog(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Amount <span className="text-red-500">*</span>
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={doseForm.amount}
                    onChange={(e) =>
                      setDoseForm((current) => ({
                        ...current,
                        amount: e.target.value,
                      }))
                    }
                    placeholder="e.g. 5"
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Unit <span className="text-red-500">*</span>
                  </label>

                  <select
                    value={doseForm.unit}
                    onChange={(e) =>
                      setDoseForm((current) => ({
                        ...current,
                        unit: e.target.value as "ml/L" | "g/L",
                      }))
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="ml/L">ml/L</option>
                    <option value="g/L">g/L</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Frequency <span className="text-red-500">*</span>
                </label>

                <input
                  value={doseForm.frequency}
                  onChange={(e) =>
                    setDoseForm((current) => ({
                      ...current,
                      frequency: e.target.value,
                    }))
                  }
                  placeholder="e.g. Once every 7 days"
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Duration <span className="text-red-500">*</span>
                </label>

                <input
                  value={doseForm.duration}
                  onChange={(e) =>
                    setDoseForm((current) => ({
                      ...current,
                      duration: e.target.value,
                    }))
                  }
                  placeholder="e.g. 3 applications"
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />

                  <p className="text-xs leading-5 text-blue-700">
                    The unit is restricted to <strong>ml/L</strong> or{" "}
                    <strong>g/L</strong> to keep prescription data consistent.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50/60 px-6 py-4">
              <button
                type="button"
                onClick={() => setDoseDialog(false)}
                className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={saveDose}
                disabled={saving}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}

                {editingDose ? "Save Changes" : "Add Dose"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* DELETE CONFIRMATION                                                  */}
      {/* ==================================================================== */}

      {deleteTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600">
                <Trash2 className="h-5 w-5" />
              </div>

              <h2 className="mt-4 text-lg font-semibold text-slate-900">
                Confirm deletion
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                {deleteTarget.type === "solution"
                  ? `Are you sure you want to delete "${deleteTarget.name}"?`
                  : "Are you sure you want to delete this dose?"}
              </p>

              <p className="mt-2 text-xs text-slate-400">
                This action cannot be undone from this screen.
              </p>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50/60 px-6 py-4">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={executeDelete}
                disabled={actionLoading}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actionLoading && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}