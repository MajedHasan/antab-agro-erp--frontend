"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  UserRound,
  Sprout,
  Bug,
  FlaskConical,
  MapPin,
  Phone,
  Check,
  AlertCircle,
  ChevronDown,
} from "lucide-react";

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

interface SolutionDose {
  _id: string;
  solutionId: string;
  amount: number;
  unit: "ml/L" | "g/L";
  frequency: string;
  duration: string;
  status?: Status;
}

interface Prescription {
  _id: string;

  mrMs: string;
  farmerName: string;
  farmerMobile: string;

  cropId?: string;
  cropName?: string;

  pestTypeId?: string;
  pestTypeName?: string;

  solutionId?: string;
  solutionName?: string;

  dose?: number;
  unit?: "ml/L" | "g/L";
  frequency?: string;
  duration?: string;

  territory: string;

  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

interface ListResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  limit: number;
}

interface SearchableOption {
  value: string;
  label: string;
}

const PAGE_LIMIT = 10;

const OTHER_VALUE = "__other__";

const emptyForm = {
  mrMs: "",
  farmerName: "",
  farmerMobile: "",

  cropId: "",
  cropOther: "",

  pestTypeId: "",
  pestTypeOther: "",

  solutionId: "",
  solutionOther: "",

  doseId: "",
  doseOther: "",

  unit: "ml/L" as "ml/L" | "g/L",

  frequency: "",
  duration: "",

  territory: "",
};

export default function PrescriptionsPage() {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);

  const [crops, setCrops] = useState<Crop[]>([]);
  const [pestTypes, setPestTypes] = useState<PestType[]>([]);
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [doses, setDoses] = useState<SolutionDose[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingMasterData, setLoadingMasterData] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPrescription, setEditingPrescription] =
    useState<Prescription | null>(null);

  const [form, setForm] = useState(emptyForm);

  const [deleteTarget, setDeleteTarget] = useState<Prescription | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [cropSearch, setCropSearch] = useState("");
  const [pestSearch, setPestSearch] = useState("");
  const [solutionSearch, setSolutionSearch] = useState("");
  const [doseSearch, setDoseSearch] = useState("");

  const [openDropdown, setOpenDropdown] = useState<
    "crop" | "pest" | "solution" | "dose" | null
  >(null);

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

  const updateForm = <K extends keyof typeof emptyForm>(
    key: K,
    value: (typeof emptyForm)[K],
  ) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  /* -------------------------------------------------------------------------- */
  /* Prescription List                                                          */
  /* -------------------------------------------------------------------------- */

  const loadPrescriptions = async () => {
    try {
      setLoading(true);

      const params: Record<string, any> = {
        page,
        limit: PAGE_LIMIT,
        sort: "-createdAt",
      };

      if (search.trim()) {
        params.q = search.trim();
      }

      const response = await api.get<ListResponse<Prescription>>(
        "/prescriptions",
        {
          params,
        },
      );

      setPrescriptions(response.data.data || []);
      setTotal(response.data.total || 0);
    } catch (error) {
      console.error("Failed to load prescriptions:", error);
      alert(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrescriptions();
  }, [page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (page === 1) {
        loadPrescriptions();
      } else {
        setPage(1);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [search]);

  /* -------------------------------------------------------------------------- */
  /* Master Data                                                                */
  /* -------------------------------------------------------------------------- */

  const loadMasterData = async () => {
    try {
      setLoadingMasterData(true);

      const [cropResponse, pestResponse, solutionResponse] =
        await Promise.all([
          api.get<ListResponse<Crop>>("/marketing/crops", {
            params: {
              page: 1,
              limit: 500,
              sort: "name",
            },
          }),

          api.get<ListResponse<PestType>>("/marketing/pest-types", {
            params: {
              page: 1,
              limit: 500,
              sort: "name",
            },
          }),

          api.get<ListResponse<Solution>>("/marketing/solutions", {
            params: {
              page: 1,
              limit: 500,
              sort: "name",
            },
          }),
        ]);

      setCrops(cropResponse.data.data || []);
      setPestTypes(pestResponse.data.data || []);
      setSolutions(solutionResponse.data.data || []);
    } catch (error) {
      console.error("Failed to load marketing setup data:", error);
      alert(getErrorMessage(error));
    } finally {
      setLoadingMasterData(false);
    }
  };

  useEffect(() => {
    loadMasterData();
  }, []);

  /* -------------------------------------------------------------------------- */
  /* Relationship Loading                                                       */
  /* -------------------------------------------------------------------------- */

  const loadCropPestTypes = async (cropId: string) => {
    if (!cropId || cropId === OTHER_VALUE) {
      setPestTypes([]);
      return;
    }

    try {
      const response = await api.get(
        `/marketing/crops/${cropId}/pest-types`,
      );

      setPestTypes(response.data.data || []);
    } catch (error) {
      console.error("Failed to load crop pest types:", error);
      setPestTypes([]);
    }
  };

  const loadPestSolutions = async (pestTypeId: string) => {
    if (!pestTypeId || pestTypeId === OTHER_VALUE) {
      setSolutions([]);
      return;
    }

    try {
      const response = await api.get(
        `/marketing/pest-types/${pestTypeId}/solutions`,
      );

      setSolutions(response.data.data || []);
    } catch (error) {
      console.error("Failed to load pest solutions:", error);
      setSolutions([]);
    }
  };

  const loadSolutionDoses = async (solutionId: string) => {
    if (!solutionId || solutionId === OTHER_VALUE) {
      setDoses([]);
      return;
    }

    try {
      const response = await api.get(
        `/marketing/solutions/${solutionId}/doses`,
      );

      setDoses(response.data.data || []);
    } catch (error) {
      console.error("Failed to load solution doses:", error);
      setDoses([]);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* Cascading Selection                                                        */
  /* -------------------------------------------------------------------------- */

  const handleCropChange = async (value: string) => {
    updateForm("cropId", value);

    updateForm("cropOther", "");
    updateForm("pestTypeId", "");
    updateForm("pestTypeOther", "");
    updateForm("solutionId", "");
    updateForm("solutionOther", "");
    updateForm("doseId", "");
    updateForm("doseOther", "");

    setPestSearch("");
    setSolutionSearch("");
    setDoseSearch("");

    setSolutions([]);
    setDoses([]);

    if (value !== OTHER_VALUE) {
      await loadCropPestTypes(value);
    } else {
      setPestTypes([]);
    }
  };

  const handlePestTypeChange = async (value: string) => {
    updateForm("pestTypeId", value);

    updateForm("pestTypeOther", "");
    updateForm("solutionId", "");
    updateForm("solutionOther", "");
    updateForm("doseId", "");
    updateForm("doseOther", "");

    setSolutionSearch("");
    setDoseSearch("");

    setDoses([]);

    if (value !== OTHER_VALUE) {
      await loadPestSolutions(value);
    } else {
      setSolutions([]);
    }
  };

  const handleSolutionChange = async (value: string) => {
    updateForm("solutionId", value);

    updateForm("solutionOther", "");
    updateForm("doseId", "");
    updateForm("doseOther", "");

    setDoseSearch("");

    if (value !== OTHER_VALUE) {
      await loadSolutionDoses(value);
    } else {
      setDoses([]);
    }
  };

  const handleDoseChange = (value: string) => {
    updateForm("doseId", value);
    updateForm("doseOther", "");

    if (value === OTHER_VALUE) {
      return;
    }

    const selectedDose = doses.find((dose) => dose._id === value);

    if (!selectedDose) return;

    setForm((current) => ({
      ...current,
      doseId: value,
      doseOther: "",
      unit: selectedDose.unit,
      frequency: selectedDose.frequency,
      duration: selectedDose.duration,
    }));
  };

  /* -------------------------------------------------------------------------- */
  /* Filtered Options                                                           */
  /* -------------------------------------------------------------------------- */

  const filteredCrops = useMemo(() => {
    const q = cropSearch.trim().toLowerCase();

    if (!q) return crops;

    return crops.filter((crop) =>
      crop.name.toLowerCase().includes(q),
    );
  }, [crops, cropSearch]);

  const filteredPestTypes = useMemo(() => {
    const q = pestSearch.trim().toLowerCase();

    if (!q) return pestTypes;

    return pestTypes.filter((pest) =>
      pest.name.toLowerCase().includes(q),
    );
  }, [pestTypes, pestSearch]);

  const filteredSolutions = useMemo(() => {
    const q = solutionSearch.trim().toLowerCase();

    if (!q) return solutions;

    return solutions.filter((solution) =>
      solution.name.toLowerCase().includes(q),
    );
  }, [solutions, solutionSearch]);

  const filteredDoses = useMemo(() => {
    const q = doseSearch.trim().toLowerCase();

    if (!q) return doses;

    return doses.filter((dose) =>
      `${dose.amount} ${dose.unit} ${dose.frequency} ${dose.duration}`
        .toLowerCase()
        .includes(q),
    );
  }, [doses, doseSearch]);

  /* -------------------------------------------------------------------------- */
  /* Selected Labels                                                             */
  /* -------------------------------------------------------------------------- */

  const selectedCropName =
    form.cropId === OTHER_VALUE
      ? "Other"
      : crops.find((item) => item._id === form.cropId)?.name || "";

  const selectedPestName =
    form.pestTypeId === OTHER_VALUE
      ? "Other"
      : pestTypes.find((item) => item._id === form.pestTypeId)?.name || "";

  const selectedSolutionName =
    form.solutionId === OTHER_VALUE
      ? "Other"
      : solutions.find((item) => item._id === form.solutionId)?.name || "";

  const selectedDose = doses.find((dose) => dose._id === form.doseId);

  const selectedDoseLabel =
    form.doseId === OTHER_VALUE
      ? "Other"
      : selectedDose
        ? `${selectedDose.amount} ${selectedDose.unit} — ${selectedDose.frequency}`
        : "";

  /* -------------------------------------------------------------------------- */
  /* Create / Edit                                                               */
  /* -------------------------------------------------------------------------- */

  const resetForm = () => {
    setForm(emptyForm);

    setCropSearch("");
    setPestSearch("");
    setSolutionSearch("");
    setDoseSearch("");

    setOpenDropdown(null);

    setPestTypes([]);
    setSolutions([]);
    setDoses([]);
  };

  const openCreate = () => {
    setEditingPrescription(null);
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = async (prescription: Prescription) => {
    setEditingPrescription(prescription);

    setForm({
      mrMs: prescription.mrMs || "",
      farmerName: prescription.farmerName || "",
      farmerMobile: prescription.farmerMobile || "",

      cropId: prescription.cropId || "",
      cropOther: prescription.cropId ? "" : prescription.cropName || "",

      pestTypeId: prescription.pestTypeId || "",
      pestTypeOther: prescription.pestTypeId
        ? ""
        : prescription.pestTypeName || "",

      solutionId: prescription.solutionId || "",
      solutionOther: prescription.solutionId
        ? ""
        : prescription.solutionName || "",

      doseId: "",
      doseOther: "",

      unit: prescription.unit || "ml/L",
      frequency: prescription.frequency || "",
      duration: prescription.duration || "",

      territory: prescription.territory || "",
    });

    setCropSearch("");
    setPestSearch("");
    setSolutionSearch("");
    setDoseSearch("");

    setDialogOpen(true);

    try {
      if (prescription.cropId) {
        await loadCropPestTypes(prescription.cropId);
      }

      if (prescription.pestTypeId) {
        await loadPestSolutions(prescription.pestTypeId);
      }

      if (prescription.solutionId) {
        await loadSolutionDoses(prescription.solutionId);
      }
    } catch (error) {
      console.error("Failed to load prescription relations:", error);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* Validation                                                                 */
  /* -------------------------------------------------------------------------- */

  const validateForm = () => {
    if (!form.mrMs.trim()) {
      alert("MR / MS is required.");
      return false;
    }

    if (!form.farmerName.trim()) {
      alert("Farmer's name is required.");
      return false;
    }

    if (!form.farmerMobile.trim()) {
      alert("Farmer's mobile number is required.");
      return false;
    }

    if (!form.cropId) {
      alert("Please select a crop.");
      return false;
    }

    if (form.cropId === OTHER_VALUE && !form.cropOther.trim()) {
      alert("Please enter the crop name.");
      return false;
    }

    if (!form.pestTypeId) {
      alert("Please select a pest type.");
      return false;
    }

    if (
      form.pestTypeId === OTHER_VALUE &&
      !form.pestTypeOther.trim()
    ) {
      alert("Please enter the pest type.");
      return false;
    }

    if (!form.solutionId) {
      alert("Please select a solution.");
      return false;
    }

    if (
      form.solutionId === OTHER_VALUE &&
      !form.solutionOther.trim()
    ) {
      alert("Please enter the solution.");
      return false;
    }

    if (!form.doseId) {
      alert("Please select a dose.");
      return false;
    }

    if (form.doseId === OTHER_VALUE && !form.doseOther.trim()) {
      alert("Please enter the dose.");
      return false;
    }

    if (!form.frequency.trim()) {
      alert("Frequency is required.");
      return false;
    }

    if (!form.duration.trim()) {
      alert("Duration is required.");
      return false;
    }

    if (!form.territory.trim()) {
      alert("Territory is required.");
      return false;
    }

    return true;
  };

  /* -------------------------------------------------------------------------- */
  /* Save                                                                        */
  /* -------------------------------------------------------------------------- */

  const savePrescription = async () => {
    if (!validateForm()) return;

    try {
      setSaving(true);

      const payload = {
        mrMs: form.mrMs.trim(),
        farmerName: form.farmerName.trim(),
        farmerMobile: form.farmerMobile.trim(),

        cropId:
          form.cropId === OTHER_VALUE ? undefined : form.cropId,
        cropName:
          form.cropId === OTHER_VALUE
            ? form.cropOther.trim()
            : selectedCropName,

        pestTypeId:
          form.pestTypeId === OTHER_VALUE
            ? undefined
            : form.pestTypeId,
        pestTypeName:
          form.pestTypeId === OTHER_VALUE
            ? form.pestTypeOther.trim()
            : selectedPestName,

        solutionId:
          form.solutionId === OTHER_VALUE
            ? undefined
            : form.solutionId,
        solutionName:
          form.solutionId === OTHER_VALUE
            ? form.solutionOther.trim()
            : selectedSolutionName,

        dose:
          form.doseId !== OTHER_VALUE && selectedDose
            ? selectedDose.amount
            : Number(form.doseOther),

        unit: form.unit,

        frequency: form.frequency.trim(),
        duration: form.duration.trim(),

        territory: form.territory.trim(),
      };

      if (editingPrescription) {
        await api.put(
          `/prescriptions/${editingPrescription._id}`,
          payload,
        );
      } else {
        await api.post("/prescriptions", payload);
      }

      setDialogOpen(false);
      setEditingPrescription(null);
      resetForm();

      await loadPrescriptions();
    } catch (error) {
      console.error("Failed to save prescription:", error);
      alert(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* Delete                                                                      */
  /* -------------------------------------------------------------------------- */

  const confirmDelete = (prescription: Prescription) => {
    setDeleteTarget(prescription);
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;

    try {
      setActionLoading(true);

      await api.delete(
        `/prescriptions/${deleteTarget._id}`,
      );

      setDeleteTarget(null);

      if (prescriptions.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        await loadPrescriptions();
      }
    } catch (error) {
      console.error("Failed to delete prescription:", error);
      alert(getErrorMessage(error));
    } finally {
      setActionLoading(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* Searchable Dropdown                                                        */
  /* -------------------------------------------------------------------------- */

  const SearchDropdown = ({
    type,
    label,
    icon,
    value,
    searchValue,
    setSearchValue,
    options,
    onSelect,
    disabled,
    other = true,
  }: {
    type: "crop" | "pest" | "solution";
    label: string;
    icon: React.ReactNode;
    value: string;
    searchValue: string;
    setSearchValue: (value: string) => void;
    options: { _id: string; name: string }[];
    onSelect: (value: string) => void;
    disabled?: boolean;
    other?: boolean;
  }) => {
    const selected =
      value === OTHER_VALUE
        ? "Other"
        : options.find((item) => item._id === value)?.name || "";

    return (
      <div className="relative">
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          {label} <span className="text-red-500">*</span>
        </label>

        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            setOpenDropdown(openDropdown === type ? null : type)
          }
          className={`flex h-10 w-full items-center justify-between rounded-lg border bg-white px-3 text-left text-sm outline-none transition ${
            disabled
              ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
              : "border-slate-200 text-slate-900 hover:border-slate-300 focus:border-blue-500"
          }`}
        >
          <span className="flex min-w-0 items-center gap-2">
            {icon}

            <span
              className={`truncate ${
                selected ? "text-slate-900" : "text-slate-400"
              }`}
            >
              {selected || `Select ${label.toLowerCase()}...`}
            </span>
          </span>

          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        </button>

        {openDropdown === type && !disabled && (
          <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-100 p-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />

                <input
                  autoFocus
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder={`Search ${label.toLowerCase()}...`}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>
            </div>

            <div className="max-h-52 overflow-y-auto p-1">
              {options.map((option) => (
                <button
                  key={option._id}
                  type="button"
                  onClick={() => {
                    onSelect(option._id);
                    setOpenDropdown(null);
                  }}
                  className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${
                    value === option._id
                      ? "bg-blue-50 font-medium text-blue-700"
                      : "text-slate-700"
                  }`}
                >
                  {option.name}

                  {value === option._id && (
                    <Check className="ml-auto h-4 w-4" />
                  )}
                </button>
              ))}

              {options.length === 0 && (
                <div className="px-3 py-5 text-center text-xs text-slate-400">
                  No options found.
                </div>
              )}

              {other && (
                <>
                  <div className="my-1 border-t border-slate-100" />

                  <button
                    type="button"
                    onClick={() => {
                      onSelect(OTHER_VALUE);
                      setOpenDropdown(null);
                    }}
                    className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition hover:bg-amber-50 ${
                      value === OTHER_VALUE
                        ? "bg-amber-50 font-medium text-amber-700"
                        : "text-slate-700"
                    }`}
                  >
                    Other

                    {value === OTHER_VALUE && (
                      <Check className="ml-auto h-4 w-4" />
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  /* -------------------------------------------------------------------------- */
  /* Dose Dropdown                                                              */
  /* -------------------------------------------------------------------------- */

  const DoseDropdown = () => {
    return (
      <div className="relative">
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          Dose <span className="text-red-500">*</span>
        </label>

        <button
          type="button"
          disabled={!form.solutionId}
          onClick={() =>
            setOpenDropdown(
              openDropdown === "dose" ? null : "dose",
            )
          }
          className={`flex h-10 w-full items-center justify-between rounded-lg border bg-white px-3 text-left text-sm outline-none transition ${
            !form.solutionId
              ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
              : "border-slate-200 text-slate-900 hover:border-slate-300"
          }`}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-cyan-50 text-cyan-600">
              <FlaskConical className="h-3 w-3" />
            </span>

            <span
              className={`truncate ${
                selectedDoseLabel
                  ? "text-slate-900"
                  : "text-slate-400"
              }`}
            >
              {selectedDoseLabel || "Select dose..."}
            </span>
          </span>

          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        </button>

        {openDropdown === "dose" && form.solutionId && (
          <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-100 p-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />

                <input
                  autoFocus
                  value={doseSearch}
                  onChange={(e) => setDoseSearch(e.target.value)}
                  placeholder="Search dose..."
                  className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto p-1">
              {filteredDoses.map((dose) => (
                <button
                  key={dose._id}
                  type="button"
                  onClick={() => {
                    handleDoseChange(dose._id);
                    setOpenDropdown(null);
                  }}
                  className={`w-full rounded-lg px-3 py-2.5 text-left transition hover:bg-slate-50 ${
                    form.doseId === dose._id
                      ? "bg-blue-50"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-slate-800">
                      {dose.amount} {dose.unit}
                    </span>

                    {form.doseId === dose._id && (
                      <Check className="h-4 w-4 text-blue-600" />
                    )}
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    {dose.frequency} · {dose.duration}
                  </div>
                </button>
              ))}

              {filteredDoses.length === 0 && (
                <div className="px-3 py-5 text-center text-xs text-slate-400">
                  No configured doses found.
                </div>
              )}

              <div className="my-1 border-t border-slate-100" />

              <button
                type="button"
                onClick={() => {
                  handleDoseChange(OTHER_VALUE);
                  setOpenDropdown(null);
                }}
                className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition hover:bg-amber-50 ${
                  form.doseId === OTHER_VALUE
                    ? "bg-amber-50 font-medium text-amber-700"
                    : "text-slate-700"
                }`}
              >
                Other

                {form.doseId === OTHER_VALUE && (
                  <Check className="ml-auto h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  /* -------------------------------------------------------------------------- */
  /* Render                                                                     */
  /* -------------------------------------------------------------------------- */

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-[1550px] space-y-6">
        {/* Header */}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <ClipboardList className="h-5 w-5" />
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                Prescriptions
              </h1>

              <p className="mt-0.5 text-sm text-slate-500">
                Create and manage farmer treatment prescriptions.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            New Prescription
          </button>
        </div>

        {/* Main table */}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search farmer, mobile, crop, pest..."
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    MR / MS
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Farmer
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Crop
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Pest Type
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Solution
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Dose
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Territory
                  </th>

                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-16">
                      <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading prescriptions...
                      </div>
                    </td>
                  </tr>
                ) : prescriptions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-16">
                      <div className="flex flex-col items-center text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                          <ClipboardList className="h-5 w-5 text-slate-400" />
                        </div>

                        <p className="mt-3 text-sm font-medium text-slate-900">
                          No prescriptions found
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          Create a prescription to get started.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  prescriptions.map((prescription) => (
                    <tr
                      key={prescription._id}
                      className="transition hover:bg-slate-50/70"
                    >
                      <td className="px-5 py-4">
                        <span className="text-sm font-medium text-slate-800">
                          {prescription.mrMs}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                            <UserRound className="h-4 w-4" />
                          </div>

                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {prescription.farmerName}
                            </p>

                            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                              <Phone className="h-3 w-3" />
                              {prescription.farmerMobile}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 text-sm text-slate-700">
                          <Sprout className="h-3.5 w-3.5 text-emerald-600" />
                          {prescription.cropName || "—"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 text-sm text-slate-700">
                          <Bug className="h-3.5 w-3.5 text-orange-500" />
                          {prescription.pestTypeName || "—"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 text-sm text-slate-700">
                          <FlaskConical className="h-3.5 w-3.5 text-blue-600" />
                          {prescription.solutionName || "—"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div>
                          <p className="text-sm font-medium text-slate-800">
                            {prescription.dose
                              ? `${prescription.dose} ${prescription.unit || ""}`
                              : "—"}
                          </p>

                          {(prescription.frequency ||
                            prescription.duration) && (
                            <p className="mt-0.5 text-xs text-slate-400">
                              {prescription.frequency}
                              {prescription.frequency &&
                                prescription.duration &&
                                " · "}
                              {prescription.duration}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                          <MapPin className="h-3.5 w-3.5 text-slate-400" />
                          {prescription.territory || "—"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(prescription)}
                            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => confirmDelete(prescription)}
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
                <span className="font-medium text-slate-700">
                  {total}
                </span>
              </p>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() =>
                    setPage((current) => Math.max(1, current - 1))
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
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
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* CREATE / EDIT DIALOG                                                 */}
      {/* ==================================================================== */}

      {dialogOpen && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 p-4 backdrop-blur-[2px]"
          onClick={() => setOpenDropdown(null)}
        >
          <div
            className="mx-auto my-8 w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Dialog Header */}

            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {editingPrescription
                    ? "Edit Prescription"
                    : "New Prescription"}
                </h2>

                <p className="mt-0.5 text-sm text-slate-500">
                  {editingPrescription
                    ? "Update prescription information."
                    : "Create a treatment prescription for a farmer."}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {loadingMasterData ? (
              <div className="flex min-h-[450px] items-center justify-center">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading marketing setup...
                </div>
              </div>
            ) : (
              <>
                <div className="max-h-[70vh] overflow-y-auto p-6">
                  <div className="space-y-7">
                    {/* ------------------------------------------------------ */}
                    {/* Farmer Information                                     */}
                    {/* ------------------------------------------------------ */}

                    <section>
                      <div className="mb-4 flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                          <UserRound className="h-4 w-4" />
                        </div>

                        <div>
                          <h3 className="text-sm font-semibold text-slate-900">
                            Farmer Information
                          </h3>

                          <p className="text-xs text-slate-500">
                            Basic information about the farmer.
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700">
                            MR / MS{" "}
                            <span className="text-red-500">*</span>
                          </label>

                          <input
                            value={form.mrMs}
                            onChange={(e) =>
                              updateForm("mrMs", e.target.value)
                            }
                            placeholder="e.g. MR-001"
                            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700">
                            Farmer's Name{" "}
                            <span className="text-red-500">*</span>
                          </label>

                          <input
                            value={form.farmerName}
                            onChange={(e) =>
                              updateForm(
                                "farmerName",
                                e.target.value,
                              )
                            }
                            placeholder="Farmer name"
                            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700">
                            Mobile Number{" "}
                            <span className="text-red-500">*</span>
                          </label>

                          <input
                            type="tel"
                            value={form.farmerMobile}
                            onChange={(e) =>
                              updateForm(
                                "farmerMobile",
                                e.target.value,
                              )
                            }
                            placeholder="01XXXXXXXXX"
                            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          />
                        </div>
                      </div>
                    </section>

                    <div className="border-t border-slate-100" />

                    {/* ------------------------------------------------------ */}
                    {/* Treatment Information                                  */}
                    {/* ------------------------------------------------------ */}

                    <section>
                      <div className="mb-4 flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                          <Sprout className="h-4 w-4" />
                        </div>

                        <div>
                          <h3 className="text-sm font-semibold text-slate-900">
                            Treatment Information
                          </h3>

                          <p className="text-xs text-slate-500">
                            Select the crop, pest and recommended solution.
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        {/* Crop */}

                        <SearchDropdown
                          type="crop"
                          label="Crop"
                          icon={
                            <Sprout className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                          }
                          value={form.cropId}
                          searchValue={cropSearch}
                          setSearchValue={setCropSearch}
                          options={filteredCrops}
                          onSelect={handleCropChange}
                        />

                        {/* Pest Type */}

                        <SearchDropdown
                          type="pest"
                          label="Pest Type"
                          icon={
                            <Bug className="h-3.5 w-3.5 shrink-0 text-orange-500" />
                          }
                          value={form.pestTypeId}
                          searchValue={pestSearch}
                          setSearchValue={setPestSearch}
                          options={filteredPestTypes}
                          onSelect={handlePestTypeChange}
                          disabled={!form.cropId}
                        />

                        {/* Solution */}

                        <SearchDropdown
                          type="solution"
                          label="Solution"
                          icon={
                            <FlaskConical className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                          }
                          value={form.solutionId}
                          searchValue={solutionSearch}
                          setSearchValue={setSolutionSearch}
                          options={filteredSolutions}
                          onSelect={handleSolutionChange}
                          disabled={
                            !form.pestTypeId
                          }
                        />
                      </div>

                      {/* Other values */}

                      {(form.cropId === OTHER_VALUE ||
                        form.pestTypeId === OTHER_VALUE ||
                        form.solutionId === OTHER_VALUE) && (
                        <div className="mt-4 grid gap-4 md:grid-cols-3">
                          {form.cropId === OTHER_VALUE && (
                            <div>
                              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                                Other Crop{" "}
                                <span className="text-red-500">*</span>
                              </label>

                              <input
                                value={form.cropOther}
                                onChange={(e) =>
                                  updateForm(
                                    "cropOther",
                                    e.target.value,
                                  )
                                }
                                placeholder="Enter crop name"
                                className="h-10 w-full rounded-lg border border-amber-200 bg-amber-50/40 px-3 text-sm outline-none placeholder:text-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                              />
                            </div>
                          )}

                          {form.pestTypeId === OTHER_VALUE && (
                            <div>
                              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                                Other Pest Type{" "}
                                <span className="text-red-500">*</span>
                              </label>

                              <input
                                value={form.pestTypeOther}
                                onChange={(e) =>
                                  updateForm(
                                    "pestTypeOther",
                                    e.target.value,
                                  )
                                }
                                placeholder="Enter pest type"
                                className="h-10 w-full rounded-lg border border-amber-200 bg-amber-50/40 px-3 text-sm outline-none placeholder:text-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                              />
                            </div>
                          )}

                          {form.solutionId === OTHER_VALUE && (
                            <div>
                              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                                Other Solution{" "}
                                <span className="text-red-500">*</span>
                              </label>

                              <input
                                value={form.solutionOther}
                                onChange={(e) =>
                                  updateForm(
                                    "solutionOther",
                                    e.target.value,
                                  )
                                }
                                placeholder="Enter solution"
                                className="h-10 w-full rounded-lg border border-amber-200 bg-amber-50/40 px-3 text-sm outline-none placeholder:text-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </section>

                    <div className="border-t border-slate-100" />

                    {/* ------------------------------------------------------ */}
                    {/* Dose                                                     */}
                    {/* ------------------------------------------------------ */}

                    <section>
                      <div className="mb-4 flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600">
                          <FlaskConical className="h-4 w-4" />
                        </div>

                        <div>
                          <h3 className="text-sm font-semibold text-slate-900">
                            Application Details
                          </h3>

                          <p className="text-xs text-slate-500">
                            Dose information is loaded from the selected
                            solution.
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-4">
                        <DoseDropdown />

                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700">
                            Unit
                          </label>

                          <select
                            value={form.unit}
                            onChange={(e) =>
                              updateForm(
                                "unit",
                                e.target.value as
                                  | "ml/L"
                                  | "g/L",
                              )
                            }
                            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          >
                            <option value="ml/L">ml/L</option>
                            <option value="g/L">g/L</option>
                          </select>
                        </div>

                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700">
                            Frequency{" "}
                            <span className="text-red-500">*</span>
                          </label>

                          <input
                            value={form.frequency}
                            onChange={(e) =>
                              updateForm(
                                "frequency",
                                e.target.value,
                              )
                            }
                            placeholder="e.g. Once every 7 days"
                            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700">
                            Duration{" "}
                            <span className="text-red-500">*</span>
                          </label>

                          <input
                            value={form.duration}
                            onChange={(e) =>
                              updateForm(
                                "duration",
                                e.target.value,
                              )
                            }
                            placeholder="e.g. 3 applications"
                            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          />
                        </div>
                      </div>

                      {form.doseId === OTHER_VALUE && (
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <div>
                            <label className="mb-1.5 block text-sm font-medium text-slate-700">
                              Other Dose{" "}
                              <span className="text-red-500">*</span>
                            </label>

                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={form.doseOther}
                              onChange={(e) =>
                                updateForm(
                                  "doseOther",
                                  e.target.value,
                                )
                              }
                              placeholder="Enter dose amount"
                              className="h-10 w-full rounded-lg border border-amber-200 bg-amber-50/40 px-3 text-sm outline-none placeholder:text-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                            />
                          </div>

                          <div className="flex items-end">
                            <div className="w-full rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2.5">
                              <div className="flex items-start gap-2">
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />

                                <p className="text-xs leading-5 text-blue-700">
                                  Only <strong>ml/L</strong> and{" "}
                                  <strong>g/L</strong> are available as
                                  units.
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </section>

                    <div className="border-t border-slate-100" />

                    {/* ------------------------------------------------------ */}
                    {/* Territory                                               */}
                    {/* ------------------------------------------------------ */}

                    <section>
                      <div className="mb-4 flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                          <MapPin className="h-4 w-4" />
                        </div>

                        <div>
                          <h3 className="text-sm font-semibold text-slate-900">
                            Territory
                          </h3>

                          <p className="text-xs text-slate-500">
                            Where this prescription was issued.
                          </p>
                        </div>
                      </div>

                      <input
                        value={form.territory}
                        onChange={(e) =>
                          updateForm(
                            "territory",
                            e.target.value,
                          )
                        }
                        placeholder="e.g. Lakshmipur Sadar"
                        className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </section>
                  </div>
                </div>

                {/* Footer */}

                <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50/60 px-6 py-4">
                  <button
                    type="button"
                    onClick={() => setDialogOpen(false)}
                    className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={savePrescription}
                    disabled={saving}
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}

                    {editingPrescription
                      ? "Save Changes"
                      : "Create Prescription"}
                  </button>
                </div>
              </>
            )}
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
                Delete Prescription
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Are you sure you want to delete the prescription for{" "}
                <span className="font-medium text-slate-700">
                  {deleteTarget.farmerName}
                </span>
                ?
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