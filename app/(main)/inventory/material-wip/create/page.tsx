// app/production/material-wip/create/page.tsx
"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertCircle,
  ArrowLeft,
  Factory,
  Loader2,
  Package,
  Play,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------- types ---------- */
type Factory = { _id: string; name: string; code?: string };
type RawMaterial = { _id: string; name: string; sku?: string; unit: string };

const safeNum = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export default function CreateMaterialWipPage() {
  const router = useRouter();

  const [factories, setFactories] = useState<Factory[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);

  const [selectedFactory, setSelectedFactory] = useState<string>("");
  const [selectedMaterial, setSelectedMaterial] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(0);
  const [starting, setStarting] = useState(false);

  // stock
  const [stock, setStock] = useState<{ quantity: number; unit: string } | null>(null);
  const [stockLoading, setStockLoading] = useState(false);

  // lock
  const [activeLock, setActiveLock] = useState<{
    _id: string;
    date: string;
    initialQuantity: number;
    unit: string;
  } | null>(null);
  const [lockLoading, setLockLoading] = useState(false);

  // load factories & materials
  useEffect(() => {
    (async () => {
      try {
        const [fRes, rmRes] = await Promise.all([
          api.get("/warehouses", { params: { type: "Factory", limit: 1000 } }),
          api.get("/raw-materials", { params: { limit: 2000 } }),
        ]);
        setFactories(fRes.data?.data || []);
        setRawMaterials(rmRes.data?.data || []);
      } catch (err) {
        toast.error("Failed to load reference data");
      }
    })();
  }, []);

  // fetch stock when factory & material change
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
            unit: s.unit || rawMaterials.find(m => m._id === selectedMaterial)?.unit || "kg",
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
    return () => { cancelled = true; };
  }, [selectedFactory, selectedMaterial, rawMaterials]);

  // ---------- LOCK CHECK (active + pending approval) ----------
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
        // block both ACTIVE and PENDING_APPROVAL from previous days
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
          return wipStart < todayStart;   // only block if strictly before today
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

    return () => { cancelled = true; };
  }, [selectedFactory, selectedMaterial]);

  const selectedMaterialObj = useMemo(
    () => rawMaterials.find(m => m._id === selectedMaterial) || null,
    [rawMaterials, selectedMaterial]
  );

  const canStart =
    !starting &&
    selectedFactory &&
    selectedMaterial &&
    quantity > 0 &&
    !lockLoading &&          // wait until lock check finishes
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors group"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to WIP List
        </button>

        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Start New WIP
          </h1>
          <p className="text-gray-500 mt-2 max-w-2xl">
            Select a factory and raw material to begin production. Multiple takes
            on the same day will be combined automatically.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main form */}
          <Card className="lg:col-span-2 shadow-md border border-gray-200/80 backdrop-blur-sm bg-white/90">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2 text-gray-800">
                <Package className="h-5 w-5 text-gray-500" />
                Production Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Factory</Label>
                <Select
                  value={selectedFactory}
                  onValueChange={(v) => {
                    setSelectedFactory(v);
                    setSelectedMaterial("");
                    setQuantity(0);
                  }}
                >
                  <SelectTrigger className="h-10 border-gray-200 focus:ring-2 focus:ring-blue-100 transition-shadow">
                    <SelectValue placeholder="Choose a factory" />
                  </SelectTrigger>
                  <SelectContent>
                    {factories.map((f) => (
                      <SelectItem key={f._id} value={f._id}>
                        {f.name} {f.code ? `(${f.code})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Raw Material</Label>
                <Select
                  value={selectedMaterial}
                  onValueChange={(v) => {
                    setSelectedMaterial(v);
                    setQuantity(0);
                  }}
                >
                  <SelectTrigger className="h-10 border-gray-200 focus:ring-2 focus:ring-blue-100 transition-shadow">
                    <SelectValue placeholder="Choose raw material" />
                  </SelectTrigger>
                  <SelectContent>
                    {rawMaterials.map((m) => (
                      <SelectItem key={m._id} value={m._id}>
                        {m.name} ({m.unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Quantity to Take</Label>
                <Input
                  type="number"
                  min={0}
                  step={"any"}
                  value={quantity || ""}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  placeholder={`Enter quantity in ${selectedMaterialObj?.unit || "units"}`}
                  className="h-10 border-gray-200 focus:ring-2 focus:ring-blue-100 transition-shadow"
                />
                {stock && quantity > stock.quantity && (
                  <p className="text-red-500 text-xs flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" />
                    Exceeds available stock ({stock.quantity} {stock.unit})
                  </p>
                )}
              </div>

              <Button
                onClick={handleStart}
                disabled={!canStart}
                className={cn(
                  "w-full h-11 text-base font-medium transition-all",
                  canStart
                    ? "bg-gray-900 hover:bg-gray-800 shadow-lg hover:shadow-xl active:scale-[0.99]"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                )}
              >
                {starting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                {starting ? "Starting..." : "Start WIP"}
              </Button>
            </CardContent>
          </Card>

          {/* Side status cards */}
          <div className="space-y-4">
            {/* Stock card unchanged */}
            <Card className="shadow-sm border border-gray-200/80 bg-white/90 overflow-hidden">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                  Available Stock
                </CardTitle>
                <Factory className="h-4 w-4 text-gray-400" />
              </CardHeader>
              <CardContent>
                {!selectedFactory || !selectedMaterial ? (
                  <p className="text-sm text-gray-400">Select a factory and material</p>
                ) : stockLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading stock...
                  </div>
                ) : stock ? (
                  <div>
                    <div className="text-3xl font-bold text-gray-900 tracking-tight">
                      {stock.quantity.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-500 mt-0.5">{stock.unit}</div>
                    {quantity > 0 && stock && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">After take</span>
                          <span className={cn("font-medium", stock.quantity - quantity >= 0 ? "text-gray-700" : "text-red-600")}>
                            {stock.quantity - quantity} {stock.unit}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-start gap-2 text-sm text-red-600">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    No stock record found.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Lock card – now checks both ACTIVE and PENDING_APPROVAL */}
            <Card className="shadow-sm border border-gray-200/80 bg-white/90 overflow-hidden">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                  WIP Status
                </CardTitle>
                <Loader2 className={cn("h-4 w-4 text-gray-400", !lockLoading && "hidden")} />
                <Clock className={cn("h-4 w-4 text-gray-400", lockLoading && "hidden")} />
              </CardHeader>
              <CardContent>
                {!selectedFactory || !selectedMaterial ? (
                  <p className="text-sm text-gray-400">Select a factory and material</p>
                ) : lockLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking lock...
                  </div>
                ) : activeLock ? (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                      <div>
                        <p className="font-medium text-red-800">Locked from previous day</p>
                        <p className="text-xs text-red-600 mt-0.5">
                          Date: {new Date(activeLock.date).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-red-600">
                          Already taken: {activeLock.initialQuantity} {activeLock.unit}
                        </p>
                        <p className="text-xs text-red-500 mt-1">
                          Complete that WIP before starting a new one.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      <div>
                        <p className="font-medium text-emerald-800">Ready to start</p>
                        <p className="text-xs text-emerald-600">No active or pending WIP from a previous day.</p>
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