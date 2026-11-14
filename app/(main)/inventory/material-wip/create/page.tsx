// app/production/material-wip/create/page.tsx
"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronsUpDown,
  Factory,
  Loader2,
  Package,
  Play,
  CheckCircle2,
  Clock,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------- types ---------- */
type Factory = { _id: string; name: string; code?: string };
type RawMaterial = { _id: string; name: string; sku?: string; unit: string };

type SearchOption = {
  value: string;
  label: string;
  description?: string;
  searchText?: string;
};

const safeNum = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/* ---------- SearchableSelect ---------- */
function SearchableSelect({
  value,
  selectedLabel,
  options,
  onPick,
  placeholder,
  searchPlaceholder,
  loading,
  disabled,
  icon: Icon,
}: {
  value?: string;
  selectedLabel?: string;
  options: SearchOption[];
  onPick: (opt: SearchOption) => void;
  placeholder: string;
  searchPlaceholder: string;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ElementType;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || loading}
          className="h-10 w-full justify-between bg-white text-sm"
        >
          <span className="truncate">{selectedLabel || placeholder}</span>
          <div className="ml-2 flex shrink-0 items-center gap-1">
            {Icon && <Icon className="h-3.5 w-3.5 opacity-40" />}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[440px] p-0"
        align="start"
        sideOffset={4}
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>
              {loading ? "Loading..." : "No results found."}
            </CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={`${opt.label} ${opt.description || ""} ${opt.searchText || ""}`}
                  onSelect={() => {
                    onPick(opt);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      opt.value === value
                        ? "opacity-100 text-[#3aa838]"
                        : "opacity-0",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{opt.label}</div>
                    {opt.description && (
                      <div className="truncate text-xs text-muted-foreground">
                        {opt.description}
                      </div>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* ---------- Main page ---------- */
export default function CreateMaterialWipPage() {
  const router = useRouter();

  const [factories, setFactories] = useState<Factory[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [refLoading, setRefLoading] = useState(false);

  const [selectedFactory, setSelectedFactory] = useState<string>("");
  const [selectedMaterial, setSelectedMaterial] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(0);
  const [starting, setStarting] = useState(false);

  // stock
  const [stock, setStock] = useState<{ quantity: number; unit: string } | null>(
    null,
  );
  const [stockLoading, setStockLoading] = useState(false);

  // lock
  const [activeLock, setActiveLock] = useState<{
    _id: string;
    date: string;
    initialQuantity: number;
    unit: string;
  } | null>(null);
  const [lockLoading, setLockLoading] = useState(false);

  /* Load reference data */
  useEffect(() => {
    (async () => {
      setRefLoading(true);
      try {
        const [fRes, rmRes] = await Promise.all([
          api.get("/warehouses", { params: { type: "Factory", limit: 1000 } }),
          api.get("/raw-materials", { params: { limit: 2000 } }),
        ]);
        setFactories(fRes.data?.data || []);
        setRawMaterials(rmRes.data?.data || []);
      } catch {
        toast.error("Failed to load reference data");
      } finally {
        setRefLoading(false);
      }
    })();
  }, []);

  /* Stock fetch */
  useEffect(() => {
    if (!selectedFactory || !selectedMaterial) {
      setStock(null);
      return;
    }
    let cancelled = false;
    setStockLoading(true);
    (async () => {
      try {
        const res = await api.get("/raw-material-stocks", {
          params: {
            factoryId: selectedFactory,
            rawMaterialId: selectedMaterial,
            limit: 1,
          },
        });
        if (!cancelled && res.data?.data?.length > 0) {
          const s = res.data.data[0];
          setStock({
            quantity: safeNum(s.quantity),
            unit:
              s.unit ||
              rawMaterials.find((m) => m._id === selectedMaterial)?.unit ||
              "kg",
          });
        } else {
          setStock(null);
        }
      } catch (err) {
        console.error(err);
        setStock(null);
      } finally {
        if (!cancelled) setStockLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedFactory, selectedMaterial, rawMaterials]);

  /* Lock check */
  useEffect(() => {
    if (!selectedFactory || !selectedMaterial) {
      setActiveLock(null);
      return;
    }
    setActiveLock(null);
    setLockLoading(true);
    let cancelled = false;

    const fetchStatuses = async () => {
      try {
        const [activeRes, pendingRes] = await Promise.all([
          api.get("/material-wip", {
            params: {
              factoryId: selectedFactory,
              rawMaterialId: selectedMaterial,
              status: "ACTIVE",
            },
          }),
          api.get("/material-wip", {
            params: {
              factoryId: selectedFactory,
              rawMaterialId: selectedMaterial,
              status: "PENDING_APPROVAL",
            },
          }),
        ]);
        if (cancelled) return;

        const combined = [
          ...(activeRes.data?.data || []),
          ...(pendingRes.data?.data || []),
        ];

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const previousDayWip = combined.find((w: any) => {
          if (!w.date) return false;
          const wipStart = new Date(w.date);
          wipStart.setHours(0, 0, 0, 0);
          return wipStart < todayStart;
        });

        if (previousDayWip) {
          setActiveLock({
            _id: previousDayWip._id,
            date: previousDayWip.date,
            initialQuantity: previousDayWip.initialQuantity,
            unit: previousDayWip.unit,
          });
        } else {
          setActiveLock(null);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setActiveLock(null);
      } finally {
        if (!cancelled) setLockLoading(false);
      }
    };
    fetchStatuses();

    return () => {
      cancelled = true;
    };
  }, [selectedFactory, selectedMaterial]);

  const selectedMaterialObj = useMemo(
    () => rawMaterials.find((m) => m._id === selectedMaterial) || null,
    [rawMaterials, selectedMaterial],
  );

  const selectedFactoryObj = useMemo(
    () => factories.find((f) => f._id === selectedFactory) || null,
    [factories, selectedFactory],
  );

  const factoryOptions = useMemo<SearchOption[]>(
    () =>
      factories.map((f) => ({
        value: f._id,
        label: f.name,
        description: f.code ? `Code: ${f.code}` : undefined,
      })),
    [factories],
  );

  const materialOptions = useMemo<SearchOption[]>(
    () =>
      rawMaterials.map((m) => ({
        value: m._id,
        label: m.name,
        description: [m.unit, m.sku].filter(Boolean).join(" · "),
        searchText: m.sku,
      })),
    [rawMaterials],
  );

  const canStart =
    !starting &&
    !!selectedFactory &&
    !!selectedMaterial &&
    quantity > 0 &&
    !lockLoading &&
    !activeLock &&
    (stock ? quantity <= stock.quantity : false);

  const handleStart = async () => {
    if (!canStart) return;
    setStarting(true);
    try {
      await api.post("/material-wip/start", {
        factoryId: selectedFactory,
        rawMaterialId: selectedMaterial,
        quantity,
      });
      toast.success("WIP started successfully");
      setQuantity(0);
      setSelectedMaterial("");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to start WIP");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-6xl p-3 md:p-4">
        {/* Compact hero */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => router.back()}
              className="h-8 w-8"
              title="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3aa838]/10">
              <Package className="h-4 w-4 text-[#3aa838]" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight">
                Start New WIP
              </h1>
              <p className="text-[11px] text-muted-foreground">
                Pick a factory and raw material — same-day takes merge
                automatically.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Form */}
          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3aa838]/10">
                <Package className="h-4 w-4 text-[#3aa838]" />
              </div>
              <div className="text-sm font-semibold">Production details</div>
            </div>

            <CardContent className="space-y-4 p-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">
                  Factory
                </Label>
                <SearchableSelect
                  value={selectedFactory}
                  selectedLabel={selectedFactoryObj?.name}
                  options={factoryOptions}
                  onPick={(opt) => {
                    setSelectedFactory(opt.value);
                    setSelectedMaterial("");
                    setQuantity(0);
                  }}
                  placeholder="Choose a factory"
                  searchPlaceholder="Search factory..."
                  loading={refLoading}
                  icon={Factory}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">
                  Raw material
                </Label>
                <SearchableSelect
                  value={selectedMaterial}
                  selectedLabel={selectedMaterialObj?.name}
                  options={materialOptions}
                  onPick={(opt) => {
                    setSelectedMaterial(opt.value);
                    setQuantity(0);
                  }}
                  placeholder="Choose raw material"
                  searchPlaceholder="Search by name or SKU..."
                  loading={refLoading}
                  disabled={!selectedFactory}
                  icon={Search}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">
                  Quantity to take
                </Label>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={quantity || ""}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  placeholder={`Enter quantity in ${selectedMaterialObj?.unit || "units"}`}
                  className="h-10 focus-visible:ring-[#3aa838]"
                />
                {stock && quantity > stock.quantity && (
                  <p className="flex items-center gap-1 text-xs text-rose-600">
                    <AlertCircle className="h-3 w-3" />
                    Exceeds available stock ({stock.quantity} {stock.unit})
                  </p>
                )}
              </div>

              <Button
                onClick={handleStart}
                disabled={!canStart}
                className={cn(
                  "h-11 w-full text-base font-semibold",
                  canStart
                    ? "bg-[#3aa838] text-white shadow-md shadow-[#3aa838]/20 hover:bg-[#2f8a2f]"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed",
                )}
              >
                {starting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                {starting ? "Starting..." : "Start WIP"}
              </Button>
            </CardContent>
          </Card>

          {/* Side status cards */}
          <div className="space-y-3">
            {/* Stock card */}
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#3aa838]/10">
                    <Factory className="h-3.5 w-3.5 text-[#3aa838]" />
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Available stock
                  </div>
                </div>
              </div>
              <CardContent className="p-4">
                {!selectedFactory || !selectedMaterial ? (
                  <p className="text-sm text-muted-foreground">
                    Select a factory and material
                  </p>
                ) : stockLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading stock...
                  </div>
                ) : stock ? (
                  <div>
                    <div className="text-3xl font-bold tabular-nums text-slate-900">
                      {stock.quantity.toLocaleString()}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {stock.unit}
                    </div>
                    {quantity > 0 && (
                      <div className="mt-3 border-t border-slate-200 pt-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            After take
                          </span>
                          <span
                            className={cn(
                              "font-semibold tabular-nums",
                              stock.quantity - quantity >= 0
                                ? "text-[#2f8a2f]"
                                : "text-rose-600",
                            )}
                          >
                            {stock.quantity - quantity} {stock.unit}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-start gap-2 text-sm text-rose-600">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    No stock record found.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Lock card */}
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#3aa838]/10">
                    <Clock className="h-3.5 w-3.5 text-[#3aa838]" />
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    WIP status
                  </div>
                </div>
                {lockLoading && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                )}
              </div>
              <CardContent className="p-4">
                {!selectedFactory || !selectedMaterial ? (
                  <p className="text-sm text-muted-foreground">
                    Select a factory and material
                  </p>
                ) : lockLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking lock...
                  </div>
                ) : activeLock ? (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                      <div>
                        <p className="text-xs font-semibold text-rose-800">
                          Locked from previous day
                        </p>
                        <p className="mt-0.5 text-[11px] text-rose-700">
                          Date:{" "}
                          {new Date(activeLock.date).toLocaleDateString()}
                        </p>
                        <p className="text-[11px] text-rose-700">
                          Already taken: {activeLock.initialQuantity}{" "}
                          {activeLock.unit}
                        </p>
                        <p className="mt-1 text-[10px] text-rose-600">
                          Complete that WIP before starting a new one.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-[#3aa838]/30 bg-[#3aa838]/5 p-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#3aa838]" />
                      <div>
                        <p className="text-xs font-semibold text-[#2f8a2f]">
                          Ready to start
                        </p>
                        <p className="text-[11px] text-[#2f8a2f]">
                          No active or pending WIP from a previous day.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}