"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Droplets,
  FlaskConical,
  Loader2,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  UserRound,
  Wheat,
  Bug,
  X,
  ClipboardCheck,
} from "lucide-react";
import api from "@/lib/api";

type Gender = "MALE" | "FEMALE";
type JoinType = "AND" | "OR";

type Option = {
  id: string;
  label: string;
  raw?: any;
};

type DoseRow = {
  id: string;
  doseId: string;
  doseName: string;
  doseOther: string;
  unit: string;
  waterAmount: string;
  frequency: string;
  frequencyOther: string;
  duration: string;
  durationOther: string;
  joinWithPrevious: JoinType;
};

type SolutionRow = {
  id: string;
  solutionId: string;
  solutionName: string;
  solutionOther: string;
  doses: DoseRow[];
  joinWithPrevious: JoinType;
  doseOptions: Option[];
  loadingDoses: boolean;
};

type PestRow = {
  id: string;
  pestTypeId: string;
  pestTypeName: string;
  pestTypeOther: string;
  solutions: SolutionRow[];
  joinWithPrevious: JoinType;
  solutionOptions: Option[];
  loadingSolutions: boolean;
};

type FormData = {
  title: "MR" | "MS";
  farmerName: string;
  gender: Gender;
  farmerMobile: string;

  cropId: string;
  cropName: string;
  cropOther: string;

  territory: string;
  territoryOther: string;

  pests: PestRow[];
};

const OTHER = "__OTHER__";

const makeId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const bnNumber = (value: string | number) => {
  const map: Record<string, string> = {
    "0": "০",
    "1": "১",
    "2": "২",
    "3": "৩",
    "4": "৪",
    "5": "৫",
    "6": "৬",
    "7": "৭",
    "8": "৮",
    "9": "৯",
  };

  return String(value).replace(/[0-9]/g, (n) => map[n]);
};

const joinText = (value: JoinType) =>
  value === "AND" ? "এবং" : "অথবা";

function extractArray(response: any): any[] {
  const body = response?.data;

  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.items)) return body.items;
  if (Array.isArray(body?.results)) return body.results;
  if (Array.isArray(response?.items)) return response.items;

  return [];
}

function optionLabel(item: any, fields: string[]) {
  if (typeof item === "string") return item;

  for (const field of fields) {
    const value = field
      .split(".")
      .reduce((acc, key) => acc?.[key], item);

    if (
      value !== undefined &&
      value !== null &&
      String(value).trim()
    ) {
      return String(value);
    }
  }

  return "";
}

function normalizeOptions(
  items: any[],
  type: "crop" | "pest" | "solution" | "dose",
): Option[] {
  const seen = new Set<string>();
  const output: Option[] = [];

  for (const item of items) {
    if (typeof item === "string") {
      if (!item.trim()) continue;

      const id = item.trim();

      if (seen.has(id)) continue;

      seen.add(id);

      output.push({
        id,
        label: item.trim(),
      });

      continue;
    }

    const nestedKey =
      type === "pest"
        ? "pestType"
        : type;

    const nested =
      item?.[nestedKey] &&
      typeof item[nestedKey] === "object"
        ? item[nestedKey]
        : null;

    const source = nested || item;

    let id =
      source?._id ||
      source?.id ||
      item?.[`${type}Id`] ||
      item?.id ||
      item?._id;

    if (!id) continue;

    id = String(id);

    if (seen.has(id)) continue;

    const fields =
      type === "crop"
        ? [
            "cropName",
            "name",
            "title",
            "label",
            "crop",
          ]
        : type === "pest"
          ? [
              "pestTypeName",
              "name",
              "title",
              "label",
              "pestName",
              "pestType",
            ]
          : type === "solution"
            ? [
                "solutionName",
                "name",
                "title",
                "label",
                "solution",
              ]
            : [
                "doseName",
                "name",
                "title",
                "label",
                "dose",
                "doseValue",
                "value",
              ];

    const label =
      optionLabel(source, fields) ||
      optionLabel(item, fields);

    if (!label.trim()) continue;

    if (
      label.trim().toLowerCase() === "other" ||
      label.trim() === "অন্যান্য"
    ) {
      continue;
    }

    seen.add(id);

    output.push({
      id,
      label: label.trim(),
      raw: item,
    });
  }

  return output;
}

function withOther(options: Option[]): Option[] {
  return [
    ...options,
    {
      id: OTHER,
      label: "অন্যান্য",
    },
  ];
}

/* -------------------------------------------------------------------------- */
/* UI HELPERS                                                                  */
/* -------------------------------------------------------------------------- */

function SectionHeader({
  number,
  icon,
  title,
  description,
  complete = false,
  action,
}: {
  number: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  complete?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
        {icon}

        {complete && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-white">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          <span className="text-[10px] font-black tracking-widest text-slate-400">
            {number}
          </span>

          <h2 className="text-[15px] font-black text-slate-900">
            {title}
          </h2>
        </div>

        <p className="text-xs leading-5 text-slate-400">
          {description}
        </p>
      </div>

      {action}
    </div>
  );
}

function FieldLabel({
  children,
  required = false,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="mb-1.5 block text-[11px] font-black text-slate-600">
      {children}

      {required && (
        <span className="ml-1 text-rose-500">*</span>
      )}
    </label>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
    />
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3.5 pr-10 text-sm font-medium text-slate-800 outline-none transition hover:border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
      >
        {children}
      </select>

      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

function SearchSelect({
  value,
  options,
  placeholder,
  loading,
  disabled,
  onChange,
}: {
  value: string;
  options: Option[];
  placeholder: string;
  loading?: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = options.find(
    (item) => item.id === value,
  );

  const filtered = options.filter((item) =>
    item.label
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  useEffect(() => {
    if (disabled) {
      setOpen(false);
    }
  }, [disabled]);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setOpen((prev) => !prev);
          setSearch("");
        }}
        className={[
          "flex h-11 w-full items-center justify-between rounded-xl border px-3.5 text-left text-sm transition",
          disabled
            ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
            : open
              ? "border-emerald-500 bg-white ring-4 ring-emerald-500/10"
              : "border-slate-200 bg-white hover:border-slate-300",
        ].join(" ")}
      >
        <span
          className={
            selected
              ? "truncate font-semibold text-slate-800"
              : "truncate text-slate-400"
          }
        >
          {loading
            ? "তথ্য লোড হচ্ছে..."
            : selected?.label || placeholder}
        </span>

        {loading ? (
          <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin text-emerald-600" />
        ) : (
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
        )}
      </button>

      {open && !disabled && (
        <>
          <button
            type="button"
            aria-label="বন্ধ করুন"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />

          <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.16)]">
            <div className="border-b border-slate-100 p-2">
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="খুঁজুন..."
                className="h-10 w-full rounded-xl bg-slate-50 px-3 text-sm outline-none placeholder:text-slate-400 focus:bg-slate-100"
              />
            </div>

            <div className="max-h-64 overflow-y-auto p-1.5">
              {filtered.length === 0 ? (
                <div className="px-3 py-8 text-center text-xs text-slate-400">
                  কিছু পাওয়া যায়নি
                </div>
              ) : (
                filtered.map((item) => {
                  const active = value === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onChange(item.id);
                        setOpen(false);
                      }}
                      className={[
                        "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition",
                        active
                          ? "bg-emerald-50 font-bold text-emerald-700"
                          : "text-slate-700 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      <span className="truncate">
                        {item.label}
                      </span>

                      {active && (
                        <Check className="h-4 w-4 shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Connector({
  value,
  onChange,
}: {
  value: JoinType;
  onChange: (value: JoinType) => void;
}) {
  return (
    <div className="flex items-center justify-center py-2">
      <div className="flex items-center rounded-full border border-slate-200 bg-white p-0.5 shadow-sm">
        <button
          type="button"
          onClick={() => onChange("AND")}
          className={[
            "rounded-full px-3 py-1.5 text-[10px] font-black transition",
            value === "AND"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-slate-400 hover:bg-slate-50",
          ].join(" ")}
        >
          এবং
        </button>

        <button
          type="button"
          onClick={() => onChange("OR")}
          className={[
            "rounded-full px-3 py-1.5 text-[10px] font-black transition",
            value === "OR"
              ? "bg-amber-500 text-white shadow-sm"
              : "text-slate-400 hover:bg-slate-50",
          ].join(" ")}
        >
          অথবা
        </button>
      </div>
    </div>
  );
}

function StatusPill({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "green" | "amber" | "violet";
}) {
  const classes = {
    slate: "bg-slate-100 text-slate-500",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    violet: "bg-violet-50 text-violet-700",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-black ${classes[tone]}`}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* MAIN PAGE                                                                   */
/* -------------------------------------------------------------------------- */

export default function PrescriptionPage() {
  const [form, setForm] = useState<FormData>({
    title: "MR",
    farmerName: "",
    gender: "MALE",
    farmerMobile: "",
    cropId: "",
    cropName: "",
    cropOther: "",
    territory: "",
    territoryOther: "",
    pests: [],
  });

  const [cropOptions, setCropOptions] = useState<Option[]>(
    [],
  );

  const [pestOptions, setPestOptions] = useState<Option[]>(
    [],
  );

  const [loadingCrops, setLoadingCrops] = useState(true);
  const [loadingPests, setLoadingPests] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);

  const [error, setError] = useState("");

  const [activePestId, setActivePestId] =
    useState<string | null>(null);

  const [activeSolutionId, setActiveSolutionId] =
    useState<string | null>(null);

  const cropRequestRef = useRef(0);

  useEffect(() => {
    loadCrops();
  }, []);

  const loadCrops = async () => {
    try {
      setLoadingCrops(true);

      const response = await api.get(
        "/marketing/crops",
        {
          params: {
            limit: 1000,
          },
        },
      );

      setCropOptions(
        withOther(
          normalizeOptions(
            extractArray(response),
            "crop",
          ),
        ),
      );
    } catch (err) {
      console.error(err);

      setError(
        "ফসলের তালিকা লোড করা যায়নি।",
      );
    } finally {
      setLoadingCrops(false);
    }
  };

  const loadPests = async (cropId: string) => {
    if (!cropId || cropId === OTHER) {
      setPestOptions([
        {
          id: OTHER,
          label: "অন্যান্য",
        },
      ]);

      return;
    }

    const requestId = ++cropRequestRef.current;

    try {
      setLoadingPests(true);

      const response = await api.get(
        `/marketing/crops/${encodeURIComponent(
          cropId,
        )}/pest-types`,
      );

      if (
        requestId !== cropRequestRef.current
      ) {
        return;
      }

      const options = normalizeOptions(
        extractArray(response),
        "pest",
      );

      setPestOptions(withOther(options));
    } catch (err) {
      console.error(err);

      if (
        requestId === cropRequestRef.current
      ) {
        setPestOptions([
          {
            id: OTHER,
            label: "অন্যান্য",
          },
        ]);
      }
    } finally {
      if (
        requestId === cropRequestRef.current
      ) {
        setLoadingPests(false);
      }
    }
  };

  const loadSolutions = async (
    pestRowId: string,
    pestTypeId: string,
  ) => {
    if (!pestTypeId || pestTypeId === OTHER) {
      setForm((prev) => ({
        ...prev,
        pests: prev.pests.map((pest) =>
          pest.id === pestRowId
            ? {
                ...pest,
                solutionOptions: [
                  {
                    id: OTHER,
                    label: "অন্যান্য",
                  },
                ],
                loadingSolutions: false,
              }
            : pest,
        ),
      }));

      return;
    }

    setForm((prev) => ({
      ...prev,
      pests: prev.pests.map((pest) =>
        pest.id === pestRowId
          ? {
              ...pest,
              loadingSolutions: true,
              solutionOptions: [],
            }
          : pest,
      ),
    }));

    try {
      const response = await api.get(
        `/marketing/pest-types/${encodeURIComponent(
          pestTypeId,
        )}/solutions`,
      );

      const options = withOther(
        normalizeOptions(
          extractArray(response),
          "solution",
        ),
      );

      setForm((prev) => ({
        ...prev,
        pests: prev.pests.map((pest) =>
          pest.id === pestRowId &&
          pest.pestTypeId === pestTypeId
            ? {
                ...pest,
                solutionOptions: options,
                loadingSolutions: false,
              }
            : pest,
        ),
      }));
    } catch (err) {
      console.error(err);

      setForm((prev) => ({
        ...prev,
        pests: prev.pests.map((pest) =>
          pest.id === pestRowId &&
          pest.pestTypeId === pestTypeId
            ? {
                ...pest,
                solutionOptions: [
                  {
                    id: OTHER,
                    label: "অন্যান্য",
                  },
                ],
                loadingSolutions: false,
              }
            : pest,
        ),
      }));
    }
  };

  const loadDoses = async (
    pestRowId: string,
    solutionRowId: string,
    solutionId: string,
  ) => {
    if (!solutionId || solutionId === OTHER) {
      setForm((prev) => ({
        ...prev,
        pests: prev.pests.map((pest) =>
          pest.id === pestRowId
            ? {
                ...pest,
                solutions: pest.solutions.map(
                  (solution) =>
                    solution.id === solutionRowId
                      ? {
                          ...solution,
                          doseOptions: [
                            {
                              id: OTHER,
                              label: "অন্যান্য",
                            },
                          ],
                          loadingDoses: false,
                        }
                      : solution,
                ),
              }
            : pest,
        ),
      }));

      return;
    }

    setForm((prev) => ({
      ...prev,
      pests: prev.pests.map((pest) =>
        pest.id === pestRowId
          ? {
              ...pest,
              solutions: pest.solutions.map(
                (solution) =>
                  solution.id === solutionRowId
                    ? {
                        ...solution,
                        doseOptions: [],
                        loadingDoses: true,
                      }
                    : solution,
              ),
            }
          : pest,
      ),
    }));

    try {
      const response = await api.get(
        `/marketing/solutions/${encodeURIComponent(
          solutionId,
        )}/doses`,
      );

      const options = withOther(
        normalizeOptions(
          extractArray(response),
          "dose",
        ),
      );

      setForm((prev) => ({
        ...prev,
        pests: prev.pests.map((pest) =>
          pest.id === pestRowId
            ? {
                ...pest,
                solutions: pest.solutions.map(
                  (solution) =>
                    solution.id === solutionRowId &&
                    solution.solutionId === solutionId
                      ? {
                          ...solution,
                          doseOptions: options,
                          loadingDoses: false,
                        }
                      : solution,
                ),
              }
            : pest,
        ),
      }));
    } catch (err) {
      console.error(err);

      setForm((prev) => ({
        ...prev,
        pests: prev.pests.map((pest) =>
          pest.id === pestRowId
            ? {
                ...pest,
                solutions: pest.solutions.map(
                  (solution) =>
                    solution.id === solutionRowId &&
                    solution.solutionId === solutionId
                      ? {
                          ...solution,
                          doseOptions: [
                            {
                              id: OTHER,
                              label: "অন্যান্য",
                            },
                          ],
                          loadingDoses: false,
                        }
                      : solution,
                ),
              }
            : pest,
        ),
      }));
    }
  };

  const handleCropChange = async (
    cropId: string,
  ) => {
    const selected = cropOptions.find(
      (item) => item.id === cropId,
    );

    setError("");
    setActivePestId(null);
    setActiveSolutionId(null);

    setForm((prev) => ({
      ...prev,
      cropId,
      cropName: selected?.label || "",
      cropOther: "",
      pests: [],
    }));

    setPestOptions([]);

    await loadPests(cropId);
  };

  const addPest = () => {
    if (!form.cropId) return;

    const row: PestRow = {
      id: makeId(),
      pestTypeId: "",
      pestTypeName: "",
      pestTypeOther: "",
      solutions: [],
      joinWithPrevious: "AND",
      solutionOptions: [],
      loadingSolutions: false,
    };

    setForm((prev) => ({
      ...prev,
      pests: [...prev.pests, row],
    }));

    setActivePestId(row.id);
    setActiveSolutionId(null);
  };

  const handlePestChange = async (
    pestRowId: string,
    pestTypeId: string,
  ) => {
    const selected = pestOptions.find(
      (item) => item.id === pestTypeId,
    );

    setForm((prev) => ({
      ...prev,
      pests: prev.pests.map((pest) =>
        pest.id === pestRowId
          ? {
              ...pest,
              pestTypeId,
              pestTypeName: selected?.label || "",
              pestTypeOther: "",
              solutions: [],
              solutionOptions: [],
              loadingSolutions:
                pestTypeId !== OTHER,
            }
          : pest,
      ),
    }));

    setActivePestId(pestRowId);
    setActiveSolutionId(null);

    await loadSolutions(
      pestRowId,
      pestTypeId,
    );
  };

  const removePest = (
    pestRowId: string,
  ) => {
    setForm((prev) => ({
      ...prev,
      pests: prev.pests.filter(
        (pest) => pest.id !== pestRowId,
      ),
    }));

    if (activePestId === pestRowId) {
      setActivePestId(null);
      setActiveSolutionId(null);
    }
  };

  const addSolution = (
    pestRowId: string,
  ) => {
    const newSolution: SolutionRow = {
      id: makeId(),
      solutionId: "",
      solutionName: "",
      solutionOther: "",
      doses: [],
      joinWithPrevious: "AND",
      doseOptions: [],
      loadingDoses: false,
    };

    setForm((prev) => ({
      ...prev,
      pests: prev.pests.map((pest) =>
        pest.id === pestRowId
          ? {
              ...pest,
              solutions: [
                ...pest.solutions,
                newSolution,
              ],
            }
          : pest,
      ),
    }));

    setActivePestId(pestRowId);
    setActiveSolutionId(newSolution.id);
  };

  const handleSolutionChange = async (
    pestRowId: string,
    solutionRowId: string,
    solutionId: string,
  ) => {
    const pest = form.pests.find(
      (item) => item.id === pestRowId,
    );

    const selected =
      pest?.solutionOptions.find(
        (item) => item.id === solutionId,
      );

    setForm((prev) => ({
      ...prev,
      pests: prev.pests.map((p) =>
        p.id === pestRowId
          ? {
              ...p,
              solutions: p.solutions.map(
                (solution) =>
                  solution.id === solutionRowId
                    ? {
                        ...solution,
                        solutionId,
                        solutionName:
                          selected?.label || "",
                        solutionOther: "",
                        doses: [],
                        doseOptions: [],
                        loadingDoses:
                          solutionId !== OTHER,
                      }
                    : solution,
              ),
            }
          : p,
      ),
    }));

    setActivePestId(pestRowId);
    setActiveSolutionId(solutionRowId);

    await loadDoses(
      pestRowId,
      solutionRowId,
      solutionId,
    );
  };

  const removeSolution = (
    pestRowId: string,
    solutionRowId: string,
  ) => {
    setForm((prev) => ({
      ...prev,
      pests: prev.pests.map((pest) =>
        pest.id === pestRowId
          ? {
              ...pest,
              solutions: pest.solutions.filter(
                (solution) =>
                  solution.id !== solutionRowId,
              ),
            }
          : pest,
      ),
    }));

    if (
      activeSolutionId === solutionRowId
    ) {
      setActiveSolutionId(null);
    }
  };

  const addDose = (
    pestRowId: string,
    solutionRowId: string,
  ) => {
    const dose: DoseRow = {
      id: makeId(),
      doseId: "",
      doseName: "",
      doseOther: "",
      unit: "ml/L",
      waterAmount: "",
      frequency: "",
      frequencyOther: "",
      duration: "",
      durationOther: "",
      joinWithPrevious: "AND",
    };

    setForm((prev) => ({
      ...prev,
      pests: prev.pests.map((pest) =>
        pest.id === pestRowId
          ? {
              ...pest,
              solutions: pest.solutions.map(
                (solution) =>
                  solution.id === solutionRowId
                    ? {
                        ...solution,
                        doses: [
                          ...solution.doses,
                          dose,
                        ],
                      }
                    : solution,
              ),
            }
          : pest,
      ),
    }));
  };

  const removeDose = (
    pestRowId: string,
    solutionRowId: string,
    doseId: string,
  ) => {
    setForm((prev) => ({
      ...prev,
      pests: prev.pests.map((pest) =>
        pest.id === pestRowId
          ? {
              ...pest,
              solutions: pest.solutions.map(
                (solution) =>
                  solution.id === solutionRowId
                    ? {
                        ...solution,
                        doses: solution.doses.filter(
                          (dose) =>
                            dose.id !== doseId,
                        ),
                      }
                    : solution,
              ),
            }
          : pest,
      ),
    }));
  };

  const updatePest = (
    pestRowId: string,
    field: keyof PestRow,
    value: any,
  ) => {
    setForm((prev) => ({
      ...prev,
      pests: prev.pests.map((pest) =>
        pest.id === pestRowId
          ? {
              ...pest,
              [field]: value,
            }
          : pest,
      ),
    }));
  };

  const updateSolution = (
    pestRowId: string,
    solutionRowId: string,
    field: keyof SolutionRow,
    value: any,
  ) => {
    setForm((prev) => ({
      ...prev,
      pests: prev.pests.map((pest) =>
        pest.id === pestRowId
          ? {
              ...pest,
              solutions: pest.solutions.map(
                (solution) =>
                  solution.id === solutionRowId
                    ? {
                        ...solution,
                        [field]: value,
                      }
                    : solution,
              ),
            }
          : pest,
      ),
    }));
  };

  const updateDose = (
    pestRowId: string,
    solutionRowId: string,
    doseId: string,
    field: keyof DoseRow,
    value: any,
  ) => {
    setForm((prev) => ({
      ...prev,
      pests: prev.pests.map((pest) =>
        pest.id === pestRowId
          ? {
              ...pest,
              solutions: pest.solutions.map(
                (solution) =>
                  solution.id === solutionRowId
                    ? {
                        ...solution,
                        doses: solution.doses.map(
                          (dose) =>
                            dose.id === doseId
                              ? {
                                  ...dose,
                                  [field]:
                                    value,
                                }
                              : dose,
                        ),
                      }
                    : solution,
              ),
            }
          : pest,
      ),
    }));
  };

  const cropText =
    form.cropId === OTHER
      ? form.cropOther || "ফসল"
      : form.cropName || "ফসল";

  const getPestName = (
    pest: PestRow,
  ) =>
    pest.pestTypeId === OTHER
      ? pest.pestTypeOther || "অন্যান্য সমস্যা"
      : pest.pestTypeName || "পোকা";

  const getSolutionName = (
    solution: SolutionRow,
  ) =>
    solution.solutionId === OTHER
      ? solution.solutionOther || "অন্যান্য সমাধান"
      : solution.solutionName || "সমাধান";

  const getDoseName = (
    dose: DoseRow,
  ) =>
    dose.doseId === OTHER
      ? dose.doseOther || "প্রয়োজনমতো"
      : dose.doseName || "";

  const previewText = useMemo(() => {
    const validPests = form.pests.filter(
      (pest) => pest.pestTypeId,
    );

    if (
      !form.farmerName.trim() ||
      !form.cropId ||
      !validPests.length
    ) {
      return "";
    }

    const pestSentences = validPests.map(
      (pest) => {
        const solutionTexts =
          pest.solutions
            .filter(
              (solution) =>
                solution.solutionId,
            )
            .map((solution) => {
              const doseTexts =
                solution.doses
                  .filter(
                    (dose) => dose.doseId,
                  )
                  .map((dose) => {
                    let text =
                      getDoseName(dose);

                    if (dose.unit) {
                      text += ` ${dose.unit}`;
                    }

                    if (dose.waterAmount) {
                      text += ` ${bnNumber(
                        dose.waterAmount,
                      )} লিটার পানিতে`;
                    }

                    if (dose.frequency) {
                      const frequency =
                        dose.frequency === OTHER
                          ? dose.frequencyOther
                          : dose.frequency;

                      if (frequency) {
                        text += ` ${frequency}`;
                      }
                    }

                    if (dose.duration) {
                      const duration =
                        dose.duration === OTHER
                          ? dose.durationOther
                          : dose.duration;

                      if (duration) {
                        text += ` ${duration}`;
                      }
                    }

                    return text;
                  });

              let solutionText =
                getSolutionName(solution);

              if (doseTexts.length) {
                solutionText += ` — ${doseTexts
                  .map(
                    (
                      text,
                      index,
                    ) =>
                      index === 0
                        ? text
                        : `${joinText(
                            solution.doses[
                              index
                            ]
                              ?.joinWithPrevious ||
                              "AND",
                          )} ${text}`,
                  )
                  .join(" ")}`;
              }

              return solutionText;
            });

        let sentence = `${getPestName(
          pest,
        )} সমস্যার জন্য`;

        if (solutionTexts.length) {
          sentence += ` ${solutionTexts
            .map(
              (
                text,
                index,
              ) =>
                index === 0
                  ? text
                  : `${joinText(
                      pest.solutions[index]
                        ?.joinWithPrevious ||
                        "AND",
                    )} ${text}`,
            )
            .join(" ")}`;

          sentence += " ব্যবহার করুন";
        }

        return sentence;
      },
    );

    return pestSentences
      .map(
        (sentence, index) =>
          index === 0
            ? sentence
            : `${joinText(
                validPests[index]
                  ?.joinWithPrevious ||
                  "AND",
              )} ${sentence}`,
      )
      .join(" ");
  }, [form]);

  const validate = () => {
    if (!form.farmerName.trim()) {
      return "কৃষকের নাম দিন।";
    }

    if (!form.cropId) {
      return "একটি ফসল নির্বাচন করুন।";
    }

    if (
      form.cropId === OTHER &&
      !form.cropOther.trim()
    ) {
      return "ফসলের নাম লিখুন।";
    }

    if (!form.pests.length) {
      return "কমপক্ষে একটি পোকা যোগ করুন।";
    }

    for (const pest of form.pests) {
      if (!pest.pestTypeId) {
        return "সব পোকা নির্বাচন করুন।";
      }

      if (
        pest.pestTypeId === OTHER &&
        !pest.pestTypeOther.trim()
      ) {
        return "অন্যান্য পোকার নাম লিখুন।";
      }

      if (!pest.solutions.length) {
        return "প্রতিটি পোকার জন্য কমপক্ষে একটি সমাধান দিন।";
      }

      for (const solution of pest.solutions) {
        if (!solution.solutionId) {
          return "সব সমাধান নির্বাচন করুন।";
        }

        if (
          solution.solutionId === OTHER &&
          !solution.solutionOther.trim()
        ) {
          return "অন্যান্য সমাধানের নাম লিখুন।";
        }

        if (!solution.doses.length) {
          return "প্রতিটি সমাধানের জন্য কমপক্ষে একটি ডোজ দিন।";
        }

        for (const dose of solution.doses) {
          if (!dose.doseId) {
            return "সব ডোজ নির্বাচন করুন।";
          }

          if (
            dose.doseId === OTHER &&
            !dose.doseOther.trim()
          ) {
            return "অন্যান্য ডোজ লিখুন।";
          }

          if (!dose.frequency) {
            return "প্রতিটি ডোজের কখন ব্যবহার করতে হবে তা দিন।";
          }

          if (
            dose.frequency === OTHER &&
            !dose.frequencyOther.trim()
          ) {
            return "ব্যবহারের সময় লিখুন।";
          }

          if (!dose.duration) {
            return "প্রতিটি ডোজের কতদিন ব্যবহার করতে হবে তা দিন।";
          }

          if (
            dose.duration === OTHER &&
            !dose.durationOther.trim()
          ) {
            return "ব্যবহারের সময়কাল লিখুন।";
          }
        }
      }
    }

    return "";
  };

  const submit = async () => {
    const validationError = validate();

    if (validationError) {
      setError(validationError);

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });

      return;
    }

    try {
      setLoadingSubmit(true);
      setError("");

      const payload = {
        title:
          form.gender === "MALE"
            ? "MR"
            : "MS",

        farmerName:
          form.farmerName,

        gender:
          form.gender,

        farmerMobile:
          form.farmerMobile,

        cropId:
          form.cropId === OTHER
            ? null
            : form.cropId,

        cropName:
          form.cropId === OTHER
            ? form.cropOther
            : form.cropName,

        cropOther:
          form.cropOther,

        territory:
          form.territory,

        territoryOther:
          form.territoryOther,

        prescriptionText:
          previewText,

        pests: form.pests.map(
          (pest) => ({
            pestTypeId:
              pest.pestTypeId === OTHER
                ? null
                : pest.pestTypeId,

            pestTypeName:
              pest.pestTypeId === OTHER
                ? pest.pestTypeOther
                : pest.pestTypeName,

            pestTypeOther:
              pest.pestTypeOther,

            joinWithPrevious:
              pest.joinWithPrevious,

            solutions:
              pest.solutions.map(
                (solution) => ({
                  solutionId:
                    solution.solutionId ===
                    OTHER
                      ? null
                      : solution.solutionId,

                  solutionName:
                    solution.solutionId ===
                    OTHER
                      ? solution.solutionOther
                      : solution.solutionName,

                  solutionOther:
                    solution.solutionOther,

                  joinWithPrevious:
                    solution.joinWithPrevious,

                  doses:
                    solution.doses.map(
                      (dose) => ({
                        doseId:
                          dose.doseId ===
                          OTHER
                            ? null
                            : dose.doseId,

                        doseName:
                          dose.doseId ===
                          OTHER
                            ? dose.doseOther
                            : dose.doseName,

                        doseOther:
                          dose.doseOther,

                        unit:
                          dose.unit,

                        waterAmount:
                          dose.waterAmount,

                        frequency:
                          dose.frequency ===
                          OTHER
                            ? dose.frequencyOther
                            : dose.frequency,

                        frequencyOther:
                          dose.frequencyOther,

                        duration:
                          dose.duration ===
                          OTHER
                            ? dose.durationOther
                            : dose.duration,

                        durationOther:
                          dose.durationOther,

                        joinWithPrevious:
                          dose.joinWithPrevious,
                      }),
                    ),
                }),
              ),
          })),
      };

      await api.post(
        "/marketing/prescriptions",
        payload,
      );

      window.location.href =
        "/marketing/prescriptions";
    } catch (err: any) {
      console.error(err);

      setError(
        err?.response?.data?.message ||
          "প্রেসক্রিপশন সংরক্ষণ করা যায়নি।",
      );
    } finally {
      setLoadingSubmit(false);
    }
  };

  const resetForm = () => {
    setForm({
      title: "MR",
      farmerName: "",
      gender: "MALE",
      farmerMobile: "",
      cropId: "",
      cropName: "",
      cropOther: "",
      territory: "",
      territoryOther: "",
      pests: [],
    });

    setPestOptions([]);
    setActivePestId(null);
    setActiveSolutionId(null);
    setError("");
  };

  const selectedPest =
    form.pests.find(
      (pest) => pest.id === activePestId,
    ) || null;

  const totalSolutions =
    form.pests.reduce(
      (total, pest) =>
        total + pest.solutions.length,
      0,
    );

  const totalDoses =
    form.pests.reduce(
      (total, pest) =>
        total +
        pest.solutions.reduce(
          (solutionTotal, solution) =>
            solutionTotal +
            solution.doses.length,
          0,
        ),
      0,
    );

  const completedPests =
    form.pests.filter(
      (pest) =>
        pest.pestTypeId &&
        pest.solutions.length > 0 &&
        pest.solutions.every(
          (solution) =>
            solution.solutionId &&
            solution.doses.length > 0,
        ),
    ).length;

  const canAddPest =
    Boolean(form.cropId);

  return (
    <div className="min-h-screen bg-[#f7f9f8] text-slate-900">
      {/* ------------------------------------------------------------------ */}
      {/* TOP BAR                                                            */}
      {/* ------------------------------------------------------------------ */}

      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-[1240px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() =>
                (window.location.href =
                  "/marketing/prescriptions")
              }
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            <div className="hidden h-8 w-px bg-slate-200 sm:block" />

            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-600/20">
                <Sparkles className="h-4 w-4" />
              </div>

              <div className="min-w-0">
                <h1 className="truncate text-sm font-black text-slate-900">
                  নতুন প্রেসক্রিপশন
                </h1>

                <p className="hidden text-[10px] text-slate-400 sm:block">
                  কৃষকের জন্য সহজ নির্দেশনা তৈরি করুন
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              (window.location.href =
                "/marketing/prescriptions")
            }
            className="hidden rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 sm:block"
          >
            প্রেসক্রিপশন তালিকা
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[1240px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        {/* ---------------------------------------------------------------- */}
        {/* ERROR                                                             */}
        {/* ---------------------------------------------------------------- */}

        {error && (
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-sm text-rose-700 shadow-sm">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-100">
              <X className="h-3.5 w-3.5" />
            </div>

            <span className="flex-1 font-semibold">
              {error}
            </span>

            <button
              type="button"
              onClick={() => setError("")}
              className="rounded-lg p-1 text-rose-400 hover:bg-rose-100 hover:text-rose-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* PROGRESS / INTRO                                                  */}
        {/* ---------------------------------------------------------------- */}

        <div className="mb-5 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">
                  Prescription Builder
                </span>

                {previewText && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black text-emerald-700">
                    <CircleCheck className="h-3 w-3" />
                    প্রস্তুত
                  </span>
                )}
              </div>

              <h2 className="text-lg font-black tracking-tight text-slate-900 sm:text-xl">
                ধাপে ধাপে প্রেসক্রিপশন তৈরি করুন
              </h2>

              <p className="mt-1 text-xs leading-5 text-slate-400">
                প্রথমে কৃষক ও ফসল নির্বাচন করুন। এরপর সমস্যা,
                সমাধান এবং ডোজ যোগ করুন।
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:w-[360px]">
              <div className="rounded-2xl bg-slate-50 px-3 py-2.5 text-center">
                <div className="text-lg font-black text-slate-900">
                  {form.pests.length}
                </div>
                <div className="text-[9px] font-bold text-slate-400">
                  সমস্যা
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 px-3 py-2.5 text-center">
                <div className="text-lg font-black text-slate-900">
                  {totalSolutions}
                </div>
                <div className="text-[9px] font-bold text-slate-400">
                  সমাধান
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 px-3 py-2.5 text-center">
                <div className="text-lg font-black text-slate-900">
                  {totalDoses}
                </div>
                <div className="text-[9px] font-bold text-slate-400">
                  ডোজ
                </div>
              </div>
            </div>
          </div>

          <div className="h-1 bg-slate-100">
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{
                width:
                  form.farmerName.trim() &&
                  form.cropId &&
                  form.pests.length &&
                  completedPests ===
                    form.pests.length
                    ? "100%"
                    : form.farmerName.trim() &&
                        form.cropId
                      ? "55%"
                      : form.farmerName.trim()
                        ? "25%"
                        : "5%",
              }}
            />
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* ================================================================ */}
          {/* MAIN                                                            */}
          {/* ================================================================ */}

          <main className="min-w-0 space-y-4">
            {/* -------------------------------------------------------------- */}
            {/* FARMER                                                         */}
            {/* -------------------------------------------------------------- */}

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <SectionHeader
                number="01"
                icon={
                  <UserRound className="h-5 w-5" />
                }
                title="কৃষকের তথ্য"
                description="প্রেসক্রিপশনটি কার জন্য?"
                complete={Boolean(
                  form.farmerName.trim(),
                )}
              />

              <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_190px]">
                <div>
                  <FieldLabel required>
                    কৃষকের নাম
                  </FieldLabel>

                  <Input
                    value={form.farmerName}
                    onChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        farmerName: value,
                      }))
                    }
                    placeholder="যেমন: মাজেদ"
                  />
                </div>

                <div>
                  <FieldLabel>
                    সম্বোধন
                  </FieldLabel>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          gender: "MALE",
                          title: "MR",
                        }))
                      }
                      className={[
                        "h-11 rounded-xl border text-xs font-black transition",
                        form.gender === "MALE"
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      ভাই
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          gender: "FEMALE",
                          title: "MS",
                        }))
                      }
                      className={[
                        "h-11 rounded-xl border text-xs font-black transition",
                        form.gender === "FEMALE"
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      বোন
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <FieldLabel>
                    মোবাইল নম্বর
                  </FieldLabel>

                  <Input
                    type="tel"
                    value={form.farmerMobile}
                    onChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        farmerMobile: value,
                      }))
                    }
                    placeholder="01XXXXXXXXX"
                  />
                </div>

                <div>
                  <FieldLabel>
                    এলাকা
                  </FieldLabel>

                  <Input
                    value={form.territory}
                    onChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        territory: value,
                      }))
                    }
                    placeholder="যেমন: লক্ষ্মীপুর"
                  />
                </div>
              </div>
            </section>

            {/* -------------------------------------------------------------- */}
            {/* CROP                                                           */}
            {/* -------------------------------------------------------------- */}

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <SectionHeader
                number="02"
                icon={
                  <Wheat className="h-5 w-5" />
                }
                title="ফসল নির্বাচন"
                description="ফসল নির্বাচন করলে সংশ্লিষ্ট সমস্যাগুলো দেখানো হবে।"
                complete={Boolean(form.cropId)}
                action={
                  form.cropId ? (
                    <StatusPill tone="green">
                      {cropText}
                    </StatusPill>
                  ) : undefined
                }
              />

              <div className="mt-5">
                <FieldLabel required>
                  কোন ফসল?
                </FieldLabel>

                <SearchSelect
                  value={form.cropId}
                  options={cropOptions}
                  loading={loadingCrops}
                  placeholder="ফসল নির্বাচন করুন"
                  onChange={handleCropChange}
                />

                {form.cropId === OTHER && (
                  <div className="mt-3">
                    <FieldLabel required>
                      ফসলের নাম
                    </FieldLabel>

                    <Input
                      value={form.cropOther}
                      onChange={(value) =>
                        setForm((prev) => ({
                          ...prev,
                          cropOther: value,
                        }))
                      }
                      placeholder="ফসলের নাম লিখুন"
                    />
                  </div>
                )}
              </div>
            </section>

            {/* -------------------------------------------------------------- */}
            {/* PROBLEMS                                                        */}
            {/* -------------------------------------------------------------- */}

            {form.cropId && (
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <SectionHeader
                    number="03"
                    icon={
                      <Bug className="h-5 w-5" />
                    }
                    title="সমস্যা ও সমাধান"
                    description="কোন সমস্যা আছে এবং কী ব্যবহার করতে হবে সেটি দিন।"
                    complete={
                      form.pests.length > 0 &&
                      completedPests ===
                        form.pests.length
                    }
                  />

                  <button
                    type="button"
                    onClick={addPest}
                    disabled={!canAddPest}
                    className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3.5 text-xs font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus className="h-4 w-4" />
                    সমস্যা যোগ করুন
                  </button>
                </div>

                {!form.pests.length && (
                  <button
                    type="button"
                    onClick={addPest}
                    className="mt-5 flex w-full flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center transition hover:border-emerald-300 hover:bg-emerald-50/30"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-2xl">
                      🐛
                    </div>

                    <span className="mt-3 text-sm font-black text-slate-700">
                      প্রথম সমস্যা যোগ করুন
                    </span>

                    <span className="mt-1 text-xs text-slate-400">
                      যেমন: মাজরা পোকা
                    </span>
                  </button>
                )}

                <div className="mt-5 space-y-3">
                  {form.pests.map(
                    (pest, pestIndex) => {
                      const expanded =
                        activePestId ===
                        pest.id;

                      const pestComplete =
                        Boolean(
                          pest.pestTypeId &&
                            pest.solutions.length &&
                            pest.solutions.every(
                              (solution) =>
                                solution.solutionId &&
                                solution.doses.length,
                            ),
                        );

                      return (
                        <div
                          key={pest.id}
                        >
                          {pestIndex > 0 && (
                            <Connector
                              value={
                                pest.joinWithPrevious
                              }
                              onChange={(
                                value,
                              ) =>
                                updatePest(
                                  pest.id,
                                  "joinWithPrevious",
                                  value,
                                )
                              }
                            />
                          )}

                          <div
                            className={[
                              "overflow-hidden rounded-2xl border transition-all",
                              expanded
                                ? "border-slate-300 bg-white shadow-sm"
                                : "border-slate-200 bg-white hover:border-slate-300",
                            ].join(" ")}
                          >
                            {/* COLLAPSED */}
                            {!expanded &&
                              pest.pestTypeId && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActivePestId(
                                      pest.id,
                                    );

                                    setActiveSolutionId(
                                      pest
                                        .solutions
                                        .at(
                                          -1,
                                        )
                                        ?.id ||
                                        null,
                                    );
                                  }}
                                  className="flex w-full items-center gap-3 px-4 py-4 text-left"
                                >
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                                    <Bug className="h-4 w-4" />
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <div className="mb-0.5 text-[9px] font-black uppercase tracking-widest text-slate-400">
                                      সমস্যা{" "}
                                      {pestIndex +
                                        1}
                                    </div>

                                    <div className="truncate text-sm font-black text-slate-800">
                                      {getPestName(
                                        pest,
                                      )}
                                    </div>
                                  </div>

                                  {pestComplete ? (
                                    <StatusPill tone="green">
                                      সম্পন্ন
                                    </StatusPill>
                                  ) : (
                                    <StatusPill tone="amber">
                                      {pest.solutions.length
                                        ? `${pest.solutions.length}টি সমাধান`
                                        : "সমাধান প্রয়োজন"}
                                    </StatusPill>
                                  )}

                                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                                </button>
                              )}

                            {/* EMPTY / INCOMPLETE */}
                            {!expanded &&
                              !pest.pestTypeId && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActivePestId(
                                      pest.id,
                                    )
                                  }
                                  className="flex w-full items-center gap-3 px-4 py-4 text-left"
                                >
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                                    <Bug className="h-4 w-4" />
                                  </div>

                                  <div className="flex-1">
                                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                      সমস্যা{" "}
                                      {pestIndex +
                                        1}
                                    </div>

                                    <div className="mt-0.5 text-sm font-bold text-slate-400">
                                      সমস্যা নির্বাচন করুন
                                    </div>
                                  </div>

                                  <ChevronRight className="h-4 w-4 text-slate-300" />
                                </button>
                              )}

                            {/* EXPANDED */}
                            {expanded && (
                              <div>
                                <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-100 text-[10px] font-black text-amber-700">
                                        {pestIndex +
                                          1}
                                      </span>

                                      <span className="text-xs font-black text-slate-700">
                                        সমস্যা
                                      </span>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        removePest(
                                          pest.id,
                                        )
                                      }
                                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>

                                <div className="p-4 sm:p-5">
                                  <FieldLabel required>
                                    কোন সমস্যা?
                                  </FieldLabel>

                                  <SearchSelect
                                    value={
                                      pest.pestTypeId
                                    }
                                    options={
                                      pestOptions
                                    }
                                    loading={
                                      loadingPests ||
                                      pest.loadingSolutions
                                    }
                                    placeholder="পোকা বা সমস্যা নির্বাচন করুন"
                                    onChange={(
                                      value,
                                    ) =>
                                      handlePestChange(
                                        pest.id,
                                        value,
                                      )
                                    }
                                  />

                                  {pest.pestTypeId ===
                                    OTHER && (
                                    <div className="mt-3">
                                      <FieldLabel required>
                                        পোকার নাম
                                      </FieldLabel>

                                      <Input
                                        value={
                                          pest.pestTypeOther
                                        }
                                        onChange={(
                                          value,
                                        ) =>
                                          updatePest(
                                            pest.id,
                                            "pestTypeOther",
                                            value,
                                          )
                                        }
                                        placeholder="পোকার নাম লিখুন"
                                      />
                                    </div>
                                  )}

                                  {/* SOLUTION AREA */}
                                  {pest.pestTypeId && (
                                    <div className="mt-5">
                                      <div className="mb-3 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                                            <FlaskConical className="h-4 w-4" />
                                          </div>

                                          <div>
                                            <h3 className="text-xs font-black text-slate-700">
                                              সমাধান
                                            </h3>

                                            <p className="text-[10px] text-slate-400">
                                              কী ব্যবহার করবেন?
                                            </p>
                                          </div>
                                        </div>

                                        <button
                                          type="button"
                                          onClick={() =>
                                            addSolution(
                                              pest.id,
                                            )
                                          }
                                          className="inline-flex items-center gap-1 rounded-xl px-2.5 py-2 text-[10px] font-black text-emerald-600 transition hover:bg-emerald-50"
                                        >
                                          <Plus className="h-3.5 w-3.5" />
                                          সমাধান
                                        </button>
                                      </div>

                                      {!pest.solutions
                                        .length && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            addSolution(
                                              pest.id,
                                            )
                                          }
                                          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-6 text-xs font-bold text-slate-500 transition hover:border-emerald-300 hover:bg-emerald-50/30 hover:text-emerald-700"
                                        >
                                          <Plus className="h-4 w-4" />
                                          প্রথম সমাধান যোগ করুন
                                        </button>
                                      )}

                                      <div className="space-y-3">
                                        {pest.solutions.map(
                                          (
                                            solution,
                                            solutionIndex,
                                          ) => {
                                            const solutionExpanded =
                                              activeSolutionId ===
                                              solution.id;

                                            return (
                                              <div
                                                key={
                                                  solution.id
                                                }
                                              >
                                                {solutionIndex >
                                                  0 && (
                                                  <Connector
                                                    value={
                                                      solution.joinWithPrevious
                                                    }
                                                    onChange={(
                                                      value,
                                                    ) =>
                                                      updateSolution(
                                                        pest.id,
                                                        solution.id,
                                                        "joinWithPrevious",
                                                        value,
                                                      )
                                                    }
                                                  />
                                                )}

                                                <div className="overflow-hidden rounded-2xl border border-slate-200">
                                                  {/* SOLUTION COLLAPSED */}
                                                  {!solutionExpanded &&
                                                    solution.solutionId && (
                                                      <button
                                                        type="button"
                                                        onClick={() =>
                                                          setActiveSolutionId(
                                                            solution.id,
                                                          )
                                                        }
                                                        className="flex w-full items-center gap-3 bg-white px-4 py-3.5 text-left transition hover:bg-slate-50"
                                                      >
                                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                                                          <FlaskConical className="h-4 w-4" />
                                                        </div>

                                                        <div className="min-w-0 flex-1">
                                                          <div className="truncate text-sm font-black text-slate-800">
                                                            {getSolutionName(
                                                              solution,
                                                            )}
                                                          </div>

                                                          <div className="mt-0.5 text-[10px] text-slate-400">
                                                            {solution.doses.length
                                                              ? `${solution.doses.length}টি ডোজ`
                                                              : "ডোজ প্রয়োজন"}
                                                          </div>
                                                        </div>

                                                        {solution.doses.length >
                                                          0 && (
                                                          <StatusPill tone="green">
                                                            <span className="flex items-center gap-1">
                                                              <Check className="h-3 w-3" />
                                                              প্রস্তুত
                                                            </span>
                                                          </StatusPill>
                                                        )}

                                                        <ChevronRight className="h-4 w-4 text-slate-300" />
                                                      </button>
                                                    )}

                                                  {/* SOLUTION EDITOR */}
                                                  {(solutionExpanded ||
                                                    !solution.solutionId) && (
                                                    <div className="bg-white p-4">
                                                      <div className="flex items-start gap-2">
                                                        <div className="min-w-0 flex-1">
                                                          <FieldLabel required>
                                                            কী ব্যবহার করবেন?
                                                          </FieldLabel>

                                                          <SearchSelect
                                                            value={
                                                              solution.solutionId
                                                            }
                                                            options={
                                                              pest.solutionOptions
                                                            }
                                                            loading={
                                                              solution.loadingDoses ||
                                                              pest.loadingSolutions
                                                            }
                                                            disabled={
                                                              !pest.pestTypeId
                                                            }
                                                            placeholder="সমাধান নির্বাচন করুন"
                                                            onChange={(
                                                              value,
                                                            ) =>
                                                              handleSolutionChange(
                                                                pest.id,
                                                                solution.id,
                                                                value,
                                                              )
                                                            }
                                                          />

                                                          {solution.solutionId ===
                                                            OTHER && (
                                                            <div className="mt-3">
                                                              <FieldLabel required>
                                                                সমাধানের নাম
                                                              </FieldLabel>

                                                              <Input
                                                                value={
                                                                  solution.solutionOther
                                                                }
                                                                onChange={(
                                                                  value,
                                                                ) =>
                                                                  updateSolution(
                                                                    pest.id,
                                                                    solution.id,
                                                                    "solutionOther",
                                                                    value,
                                                                  )
                                                                }
                                                                placeholder="সমাধানের নাম লিখুন"
                                                              />
                                                            </div>
                                                          )}
                                                        </div>

                                                        <button
                                                          type="button"
                                                          onClick={() =>
                                                            removeSolution(
                                                              pest.id,
                                                              solution.id,
                                                            )
                                                          }
                                                          className="mt-5 rounded-xl p-2 text-slate-300 transition hover:bg-rose-50 hover:text-rose-500"
                                                        >
                                                          <Trash2 className="h-4 w-4" />
                                                        </button>
                                                      </div>

                                                      {/* DOSES */}
                                                      {solution.solutionId && (
                                                        <div className="mt-5 border-t border-slate-100 pt-4">
                                                          <div className="mb-3 flex items-center justify-between">
                                                            <div>
                                                              <div className="flex items-center gap-2">
                                                                <Droplets className="h-4 w-4 text-sky-500" />

                                                                <h4 className="text-xs font-black text-slate-700">
                                                                  ডোজ ও ব্যবহার
                                                                </h4>
                                                              </div>

                                                              <p className="mt-0.5 text-[10px] text-slate-400">
                                                                কতটুকু, কখন এবং কতদিন?
                                                              </p>
                                                            </div>

                                                            <button
                                                              type="button"
                                                              onClick={() =>
                                                                addDose(
                                                                  pest.id,
                                                                  solution.id,
                                                                )
                                                              }
                                                              className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-2.5 py-2 text-[10px] font-black text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-700"
                                                            >
                                                              <Plus className="h-3.5 w-3.5" />
                                                              ডোজ
                                                            </button>
                                                          </div>

                                                          {!solution.doses
                                                            .length && (
                                                            <button
                                                              type="button"
                                                              onClick={() =>
                                                                addDose(
                                                                  pest.id,
                                                                  solution.id,
                                                                )
                                                              }
                                                              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-6 text-xs font-bold text-slate-500 transition hover:border-emerald-300 hover:bg-emerald-50/30 hover:text-emerald-700"
                                                            >
                                                              <Plus className="h-4 w-4" />
                                                              প্রথম ডোজ যোগ করুন
                                                            </button>
                                                          )}

                                                          <div className="space-y-3">
                                                            {solution.doses.map(
                                                              (
                                                                dose,
                                                                doseIndex,
                                                              ) => (
                                                                <div
                                                                  key={
                                                                    dose.id
                                                                  }
                                                                >
                                                                  {doseIndex >
                                                                    0 && (
                                                                    <Connector
                                                                      value={
                                                                        dose.joinWithPrevious
                                                                      }
                                                                      onChange={(
                                                                        value,
                                                                      ) =>
                                                                        updateDose(
                                                                          pest.id,
                                                                          solution.id,
                                                                          dose.id,
                                                                          "joinWithPrevious",
                                                                          value,
                                                                        )
                                                                      }
                                                                    />
                                                                  )}

                                                                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5">
                                                                    <div className="mb-3 flex items-center justify-between">
                                                                      <div className="flex items-center gap-2">
                                                                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white text-[9px] font-black text-slate-500 shadow-sm">
                                                                          {doseIndex +
                                                                            1}
                                                                        </span>

                                                                        <span className="text-[11px] font-black text-slate-600">
                                                                          ডোজ
                                                                        </span>
                                                                      </div>

                                                                      <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                          removeDose(
                                                                            pest.id,
                                                                            solution.id,
                                                                            dose.id,
                                                                          )
                                                                        }
                                                                        className="rounded-lg p-1.5 text-slate-300 transition hover:bg-rose-50 hover:text-rose-500"
                                                                      >
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                      </button>
                                                                    </div>

                                                                    <div className="grid gap-3 sm:grid-cols-2">
                                                                      <div className="sm:col-span-2">
                                                                        <FieldLabel required>
                                                                          ডোজ
                                                                        </FieldLabel>

                                                                        <SearchSelect
                                                                          value={
                                                                            dose.doseId
                                                                          }
                                                                          options={
                                                                            solution.doseOptions
                                                                          }
                                                                          loading={
                                                                            solution.loadingDoses
                                                                          }
                                                                          placeholder="ডোজ নির্বাচন করুন"
                                                                          onChange={(
                                                                            value,
                                                                          ) => {
                                                                            const option =
                                                                              solution.doseOptions.find(
                                                                                (
                                                                                  item,
                                                                                ) =>
                                                                                  item.id ===
                                                                                  value,
                                                                              );

                                                                            updateDose(
                                                                              pest.id,
                                                                              solution.id,
                                                                              dose.id,
                                                                              "doseId",
                                                                              value,
                                                                            );

                                                                            updateDose(
                                                                              pest.id,
                                                                              solution.id,
                                                                              dose.id,
                                                                              "doseName",
                                                                              option?.label ||
                                                                                "",
                                                                            );

                                                                            updateDose(
                                                                              pest.id,
                                                                              solution.id,
                                                                              dose.id,
                                                                              "doseOther",
                                                                              "",
                                                                            );
                                                                          }}
                                                                        />

                                                                        {dose.doseId ===
                                                                          OTHER && (
                                                                          <div className="mt-3">
                                                                            <Input
                                                                              value={
                                                                                dose.doseOther
                                                                              }
                                                                              onChange={(
                                                                                value,
                                                                              ) =>
                                                                                updateDose(
                                                                                  pest.id,
                                                                                  solution.id,
                                                                                  dose.id,
                                                                                  "doseOther",
                                                                                  value,
                                                                                )
                                                                              }
                                                                              placeholder="ডোজ লিখুন"
                                                                            />
                                                                          </div>
                                                                        )}
                                                                      </div>

                                                                      <div>
                                                                        <FieldLabel>
                                                                          একক
                                                                        </FieldLabel>

                                                                        <Select
                                                                          value={
                                                                            dose.unit
                                                                          }
                                                                          onChange={(
                                                                            value,
                                                                          ) =>
                                                                            updateDose(
                                                                              pest.id,
                                                                              solution.id,
                                                                              dose.id,
                                                                              "unit",
                                                                              value,
                                                                            )
                                                                          }
                                                                        >
                                                                          <option value="ml/L">
                                                                            মিলি/লিটার
                                                                          </option>

                                                                          <option value="g/L">
                                                                            গ্রাম/লিটার
                                                                          </option>

                                                                          <option value="ml">
                                                                            মিলি
                                                                          </option>

                                                                          <option value="g">
                                                                            গ্রাম
                                                                          </option>
                                                                        </Select>
                                                                      </div>

                                                                      <div>
                                                                        <FieldLabel>
                                                                          পানি
                                                                        </FieldLabel>

                                                                        <div className="relative">
                                                                          <Input
                                                                            value={
                                                                              dose.waterAmount
                                                                            }
                                                                            onChange={(
                                                                              value,
                                                                            ) =>
                                                                              updateDose(
                                                                                pest.id,
                                                                                solution.id,
                                                                                dose.id,
                                                                                "waterAmount",
                                                                                value,
                                                                              )
                                                                            }
                                                                            placeholder="যেমন: ১০"
                                                                          />

                                                                          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                                                                            লিটার
                                                                          </span>
                                                                        </div>
                                                                      </div>

                                                                      <div>
                                                                        <FieldLabel required>
                                                                          কখন ব্যবহার করবেন?
                                                                        </FieldLabel>

                                                                        <Select
                                                                          value={
                                                                            dose.frequency
                                                                          }
                                                                          onChange={(
                                                                            value,
                                                                          ) =>
                                                                            updateDose(
                                                                              pest.id,
                                                                              solution.id,
                                                                              dose.id,
                                                                              "frequency",
                                                                              value,
                                                                            )
                                                                          }
                                                                        >
                                                                          <option value="">
                                                                            নির্বাচন করুন
                                                                          </option>

                                                                          <option value="প্রতিদিন সকালে">
                                                                            প্রতিদিন সকালে
                                                                          </option>

                                                                          <option value="প্রতিদিন">
                                                                            প্রতিদিন
                                                                          </option>

                                                                          <option value="সকালে">
                                                                            সকালে
                                                                          </option>

                                                                          <option value="বিকেলে">
                                                                            বিকেলে
                                                                          </option>

                                                                          <option value="প্রতি ৩ দিন পরপর">
                                                                            প্রতি ৩ দিন পরপর
                                                                          </option>

                                                                          <option value="প্রতি ৭ দিন পরপর">
                                                                            প্রতি ৭ দিন পরপর
                                                                          </option>

                                                                          <option value={OTHER}>
                                                                            অন্যান্য
                                                                          </option>
                                                                        </Select>

                                                                        {dose.frequency ===
                                                                          OTHER && (
                                                                          <div className="mt-2">
                                                                            <Input
                                                                              value={
                                                                                dose.frequencyOther
                                                                              }
                                                                              onChange={(
                                                                                value,
                                                                              ) =>
                                                                                updateDose(
                                                                                  pest.id,
                                                                                  solution.id,
                                                                                  dose.id,
                                                                                  "frequencyOther",
                                                                                  value,
                                                                                )
                                                                              }
                                                                              placeholder="ব্যবহারের সময় লিখুন"
                                                                            />
                                                                          </div>
                                                                        )}
                                                                      </div>

                                                                      <div>
                                                                        <FieldLabel required>
                                                                          কতদিন?
                                                                        </FieldLabel>

                                                                        <Select
                                                                          value={
                                                                            dose.duration
                                                                          }
                                                                          onChange={(
                                                                            value,
                                                                          ) =>
                                                                            updateDose(
                                                                              pest.id,
                                                                              solution.id,
                                                                              dose.id,
                                                                              "duration",
                                                                              value,
                                                                            )
                                                                          }
                                                                        >
                                                                          <option value="">
                                                                            নির্বাচন করুন
                                                                          </option>

                                                                          <option value="৩ দিন">
                                                                            ৩ দিন
                                                                          </option>

                                                                          <option value="৫ দিন">
                                                                            ৫ দিন
                                                                          </option>

                                                                          <option value="৭ দিন">
                                                                            ৭ দিন
                                                                          </option>

                                                                          <option value="১০ দিন">
                                                                            ১০ দিন
                                                                          </option>

                                                                          <option value="১৫ দিন">
                                                                            ১৫ দিন
                                                                          </option>

                                                                          <option value={OTHER}>
                                                                            অন্যান্য
                                                                          </option>
                                                                        </Select>

                                                                        {dose.duration ===
                                                                          OTHER && (
                                                                          <div className="mt-2">
                                                                            <Input
                                                                              value={
                                                                                dose.durationOther
                                                                              }
                                                                              onChange={(
                                                                                value,
                                                                              ) =>
                                                                                updateDose(
                                                                                  pest.id,
                                                                                  solution.id,
                                                                                  dose.id,
                                                                                  "durationOther",
                                                                                  value,
                                                                                )
                                                                              }
                                                                              placeholder="সময়কাল লিখুন"
                                                                            />
                                                                          </div>
                                                                        )}
                                                                      </div>
                                                                    </div>
                                                                  </div>
                                                                </div>
                                                              ),
                                                            )}
                                                          </div>
                                                        </div>
                                                      )}
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            );
                                          },
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {pest.pestTypeId && (
                                    <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActivePestId(
                                            null,
                                          );
                                          setActiveSolutionId(
                                            null,
                                          );
                                        }}
                                        className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-500 transition hover:bg-slate-50"
                                      >
                                        সম্পন্ন
                                      </button>

                                      <button
                                        type="button"
                                        onClick={
                                          addPest
                                        }
                                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3.5 py-2 text-xs font-black text-emerald-700 transition hover:bg-emerald-100"
                                      >
                                        <Plus className="h-3.5 w-3.5" />
                                        আরেকটি সমস্যা
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
              </section>
            )}

            {/* -------------------------------------------------------------- */}
            {/* SUBMIT                                                          */}
            {/* -------------------------------------------------------------- */}

            {previewText && (
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50/50 p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                      <ClipboardCheck className="h-5 w-5" />
                    </div>

                    <div>
                      <p className="text-sm font-black text-slate-800">
                        প্রেসক্রিপশন প্রস্তুত
                      </p>

                      <p className="text-[10px] text-slate-500">
                        ডান পাশে পাঠানোর আগে পুরো নির্দেশনাটি দেখে নিন।
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={loadingSubmit}
                    onClick={submit}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-xs font-black text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    {loadingSubmit ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        সংরক্ষণ হচ্ছে...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        প্রেসক্রিপশন তৈরি করুন
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </main>

          {/* ================================================================ */}
          {/* RIGHT PREVIEW                                                     */}
          {/* ================================================================ */}

          <aside className="lg:sticky lg:top-[88px] lg:self-start">
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              {/* PREVIEW HEADER */}
              <div className="relative overflow-hidden bg-slate-900 px-5 py-5 text-white">
                <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-500/20 blur-2xl" />

                <div className="relative flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
                    <Sparkles className="h-5 w-5 text-emerald-300" />
                  </div>

                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-300">
                      Live Preview
                    </p>

                    <h2 className="mt-0.5 text-sm font-black">
                      কৃষককে যা পাঠাবেন
                    </h2>
                  </div>
                </div>
              </div>

              <div className="p-4">
                {/* MESSAGE */}
                <div className="relative rounded-2xl rounded-tl-md bg-emerald-50 p-4">
                  <div className="absolute -left-1 top-0 h-3 w-3 rotate-45 bg-emerald-50" />

                  <p className="relative text-[13px] leading-7 text-slate-700">
                    <span className="font-black text-slate-900">
                      প্রিয়{" "}
                      {form.farmerName ||
                        "কৃষক"}{" "}
                      {form.gender ===
                      "FEMALE"
                        ? "বোন"
                        : "ভাই"}
                    </span>
                    ,
                    {" "}
                    {previewText ? (
                      <>
                        আপনার{" "}
                        <span className="font-black text-emerald-700">
                          {cropText}
                        </span>{" "}
                        জমিতে{" "}
                        {previewText}
                        ।
                      </>
                    ) : (
                      <span className="text-slate-400">
                        নিচের তথ্যগুলো পূরণ করলে কৃষকের জন্য সম্পূর্ণ
                        নির্দেশনাটি এখানে দেখা যাবে।
                      </span>
                    )}
                  </p>
                </div>

                {/* SUMMARY */}
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Summary
                    </span>

                    {previewText && (
                      <span className="flex items-center gap-1 text-[9px] font-black text-emerald-600">
                        <CircleCheck className="h-3 w-3" />
                        Ready
                      </span>
                    )}
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-slate-100">
                    <div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-3">
                      <span className="text-[10px] text-slate-400">
                        কৃষক
                      </span>

                      <span className="max-w-[170px] truncate text-xs font-bold text-slate-700">
                        {form.farmerName ||
                          "এখনো দেওয়া হয়নি"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-3">
                      <span className="text-[10px] text-slate-400">
                        ফসল
                      </span>

                      <span className="max-w-[170px] truncate text-xs font-bold text-slate-700">
                        {form.cropId
                          ? cropText
                          : "এখনো নির্বাচন হয়নি"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-3">
                      <span className="text-[10px] text-slate-400">
                        সমস্যা
                      </span>

                      <span className="text-xs font-bold text-slate-700">
                        {form.pests.length
                          ? `${form.pests.length}টি`
                          : "০"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-3">
                      <span className="text-[10px] text-slate-400">
                        সমাধান
                      </span>

                      <span className="text-xs font-bold text-slate-700">
                        {totalSolutions}টি
                      </span>
                    </div>

                    <div className="flex items-center justify-between px-3.5 py-3">
                      <span className="text-[10px] text-slate-400">
                        ডোজ
                      </span>

                      <span className="text-xs font-bold text-slate-700">
                        {totalDoses}টি
                      </span>
                    </div>
                  </div>
                </div>

                {/* LOGIC NOTE */}
                <div className="mt-4 rounded-2xl bg-amber-50 p-3">
                  <div className="flex gap-2">
                    <span className="text-sm">💡</span>

                    <p className="text-[10px] leading-5 text-amber-700">
                      <strong>এবং</strong> মানে দুটোই ব্যবহার করতে হবে।
                      <strong className="ml-1">
                        অথবা
                      </strong>{" "}
                      মানে যেকোনো একটি ব্যবহার করা যাবে।
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* RESET */}
            <button
              type="button"
              onClick={resetForm}
              className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-xs font-bold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              আবার শুরু করুন
            </button>

            {/* CURRENT CONTEXT */}
            {selectedPest && (
              <div className="mt-3 hidden rounded-2xl border border-slate-200 bg-white p-3.5 lg:block">
                <div className="mb-2 text-[9px] font-black uppercase tracking-widest text-slate-400">
                  Currently Editing
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <Bug className="h-4 w-4" />
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-xs font-black text-slate-700">
                      {getPestName(
                        selectedPest,
                      )}
                    </p>

                    <p className="text-[9px] text-slate-400">
                      {selectedPest.solutions.length}টি
                      সমাধান
                    </p>
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}