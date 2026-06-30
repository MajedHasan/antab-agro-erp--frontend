// app/inventory/material-wip/[wipId]/produce/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  Clock,
  AlertTriangle,
  Info,
  BadgeCheck,
  ShieldAlert,
  ChevronRight,
  ChevronLeft,
  X,
  Edit3,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------- types ---------- */
type MaterialWIP = {
  _id: string;
  factoryId: { _id: string; name: string } | string;
  rawMaterialId: { _id: string; name: string; unit: string } | string;
  initialQuantity: number;
  remainingQuantity: number;
  unit: string;
  unitCost?: number;
  startCost?: number;
  issuedQuantity: number;
  consumedQuantity: number;
  status: "ACTIVE" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
  pendingConversion?: PendingConversion;
  createdBy?: { name: string };
};

type PendingConversion = {
  products?: {
    productId: { _id: string; name: string } | string;
    quantityProduced: number;
    expectedRawUsed?: number;
    actualRawUsed?: number;
    rawMaterialCost?: number;
    packagingMaterialCost?: number;
    otherMaterialCost?: number;
    totalCost?: number;
    unitCost?: number;
  }[];
  remainingRawQuantity: number;
  expectedRawUsed: number;
  allowedWastageRawUsed: number;
  actualRawUsed: number;
  gainQuantity: number;
  normalWastageQuantity: number;
  productionLossQuantity: number;
  rawMaterialCost: number;
  packagingMaterialCost: number;
  otherMaterialCost: number;
  totalInputCost: number;
  totalFinishedGoodsCost: number;
  otherMaterialsUsed?: {
    itemType: "RawMaterial" | "PackagingItem";
    itemId: string;
    quantity: number;
    unit: string;
    unitCost?: number;
    totalCost?: number;
  }[];
  notes?: string;
};

type BOMWithProduct = {
  productId: { _id: string; name: string; sku?: string; unit?: string };
  components: {
    itemType: "RawMaterial" | "PackagingItem";
    itemId: string;
    quantity: number;
    unit?: string;
    wastagePercent?: number;
  }[];
};

/* ---------- helpers ---------- */
const safeNum = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const safeFixed3 = (v: any) => safeNum(v).toFixed(3);
const safeTaka = (v: any) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(safeNum(v));
const safeUnit = (u: any) =>
  u && u !== "NaN" && u !== "null" && u !== "undefined" ? String(u) : "—";

function nameOf(maybe: any) {
  if (!maybe) return "—";
  if (typeof maybe === "string") return maybe;
  return maybe.name || maybe._id || "—";
}

const EPSILON = 0.0001;

export default function ProduceMaterialWipPage() {
  const { wipId } = useParams<{ wipId: string }>();
  const router = useRouter();

  const [wip, setWip] = useState<MaterialWIP | null>(null);
  const [loading, setLoading] = useState(true);

  // Name lookups
  const [rawMaterialNames, setRawMaterialNames] = useState<Record<string, string>>({});
  const [packagingNames, setPackagingNames] = useState<Record<string, string>>({});

  // ACTIVE flow
  const [possibleBoms, setPossibleBoms] = useState<BOMWithProduct[]>([]);
  const [loadingBoms, setLoadingBoms] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<
    { productId: string; quantityProduced: number }[]
  >([]);
  const [step, setStep] = useState<1 | 2>(1);
  const [remainingRawStr, setRemainingRawStr] = useState("");   // text input
  const [bypassWastage, setBypassWastage] = useState(false);
  const [requesting, setRequesting] = useState(false);

  // PENDING_APPROVAL flow
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editingProducts, setEditingProducts] = useState<
    { productId: string; quantityProduced: number }[]
  >([]);
  const [editingRemainingStr, setEditingRemainingStr] = useState("");  // text input
  const [editNotes, setEditNotes] = useState("");
  const [updating, setUpdating] = useState(false);

  // Load WIP + names
  useEffect(() => {
    if (!wipId) return;
    setLoading(true);
    Promise.all([
      api.get(`/material-wip/${wipId}`),
      api.get("/raw-materials?limit=5000"),
      api.get("/packaging-items?limit=5000"),
    ])
      .then(([wipRes, rmRes, pkRes]) => {
        setWip(wipRes.data?.data);
        const rmMap: Record<string, string> = {};
        (rmRes.data?.data || []).forEach((m: any) => (rmMap[m._id] = m.name));
        const pkMap: Record<string, string> = {};
        (pkRes.data?.data || []).forEach((p: any) => (pkMap[p._id] = p.name));
        setRawMaterialNames(rmMap);
        setPackagingNames(pkMap);
      })
      .catch(() => toast.error("Failed to load WIP"))
      .finally(() => setLoading(false));
  }, [wipId]);

  // Fetch BOMs when ACTIVE or editing
  useEffect(() => {
    if (!wip || (wip.status !== "ACTIVE" && !editMode)) return;
    const rawId =
      typeof wip.rawMaterialId === "object" ? wip.rawMaterialId._id : wip.rawMaterialId;
    setLoadingBoms(true);
    api
      .get(`/material-wip/products/${rawId}`)
      .then((res) => setPossibleBoms(res.data?.data || []))
      .catch(() => toast.error("Failed to load possible products"))
      .finally(() => setLoadingBoms(false));
  }, [wip, editMode]);

  // Prefill edit form
  useEffect(() => {
    if (wip?.status === "PENDING_APPROVAL" && wip.pendingConversion && editMode) {
      const pc = wip.pendingConversion;
      setEditingProducts(
        pc.products?.map((p: any) => ({
          productId: typeof p.productId === "object" ? p.productId._id : p.productId,
          quantityProduced: safeNum(p.quantityProduced),
        })) || []
      );
      setEditingRemainingStr(
        pc.remainingRawQuantity != null ? String(pc.remainingRawQuantity) : ""
      );
      setEditNotes(pc.notes || "");
    }
  }, [editMode, wip]);

  const resolveName = (itemType: string, itemId: string) =>
    itemType === "RawMaterial"
      ? rawMaterialNames[itemId] || itemId
      : packagingNames[itemId] || itemId;

  // ACTIVE helpers
  const toggleProduct = (productId: string) => {
    setSelectedProducts((prev) => {
      const exists = prev.find((p) => p.productId === productId);
      if (exists) return prev.filter((p) => p.productId !== productId);
      return [...prev, { productId, quantityProduced: 0 }];
    });
  };

  const updateQty = (productId: string, qty: number) => {
    setSelectedProducts((prev) =>
      prev.map((p) => (p.productId === productId ? { ...p, quantityProduced: qty } : p))
    );
  };

  const selectedCount = selectedProducts.filter((p) => p.quantityProduced > 0).length;
  const canProceed = selectedCount > 0;

  // Parse remaining raw from string, allowing intermediate partial entries
  const remainingRaw = parseFloat(remainingRawStr);
  const remainingValid =
    !isNaN(remainingRaw) &&
    remainingRaw >= 0 &&
    remainingRaw <= safeNum(wip?.initialQuantity);
  const canSubmit = canProceed && remainingValid;
  const taken = safeNum(wip?.initialQuantity) - safeNum(remainingValid ? remainingRaw : 0);

  const handleRequest = async () => {
    if (!wip || !canSubmit) return;
    const validProducts = selectedProducts.filter((p) => p.quantityProduced > 0);
    setRequesting(true);
    try {
      const factoryId = typeof wip.factoryId === "object" ? wip.factoryId._id : wip.factoryId;
      await api.post("/material-wip/request-conversion", {
        wipId: wip._id,
        factoryId,
        products: validProducts,
        remainingRawQuantity: remainingRaw,
        bypassWastageCheck: bypassWastage,
      });
      toast.success("Conversion requested for approval");
      router.push("/inventory/material-wip");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Request failed");
    } finally {
      setRequesting(false);
    }
  };

  // PENDING_APPROVAL helpers
  const handleApprove = async () => {
    if (!wip) return;
    setApproving(true);
    try {
      await api.post(`/material-wip/${wip._id}/approve`);
      toast.success("Conversion approved and processed");
      router.push("/inventory/material-wip");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Approval failed");
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!wip) return;
    if (!rejectReason.trim()) return toast.error("Please provide a rejection reason");
    setRejecting(true);
    try {
      await api.post(`/material-wip/${wip._id}/reject`, { reason: rejectReason });
      toast.success("Conversion rejected, WIP returned to ACTIVE");
      router.push("/inventory/material-wip");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Rejection failed");
    } finally {
      setRejecting(false);
    }
  };

  const handleUpdate = async () => {
    if (!wip) return;
    const validProducts = editingProducts.filter((p) => p.quantityProduced > 0);
    if (validProducts.length === 0) return toast.error("Select at least one product");
    const remaining = parseFloat(editingRemainingStr);
    if (isNaN(remaining) || remaining < 0 || remaining > safeNum(wip.initialQuantity)) {
      toast.error("Invalid remaining quantity");
      return;
    }
    setUpdating(true);
    try {
      const factoryId = typeof wip.factoryId === "object" ? wip.factoryId._id : wip.factoryId;
      await api.patch(`/material-wip/${wip._id}/pending-conversion`, {
        factoryId,
        products: validProducts,
        remainingRawQuantity: remaining,
        notes: editNotes,
      });
      toast.success("Conversion updated");
      const { data } = await api.get(`/material-wip/${wipId}`);
      setWip(data?.data);
      setEditMode(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Update failed");
    } finally {
      setUpdating(false);
    }
  };

  // Edit form toggles
  const toggleEditProduct = (productId: string) => {
    setEditingProducts((prev) => {
      const exists = prev.find((p) => p.productId === productId);
      if (exists) return prev.filter((p) => p.productId !== productId);
      return [...prev, { productId, quantityProduced: 0 }];
    });
  };

  const updateEditQty = (productId: string, qty: number) => {
    setEditingProducts((prev) =>
      prev.map((p) => (p.productId === productId ? { ...p, quantityProduced: qty } : p))
    );
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }
  if (!wip) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-gray-500">
        WIP not found.
      </div>
    );
  }

  const pc = wip.pendingConversion;
  const isPending = wip.status === "PENDING_APPROVAL";

  // Derived values
  const loss = safeNum(pc?.productionLossQuantity);      // production loss (exceeds allowed)
  const gain = safeNum(pc?.gainQuantity);
  const normalWastage = safeNum(pc?.normalWastageQuantity); // within allowed wastage
  const expectedRaw = safeNum(pc?.expectedRawUsed);
  const actualRaw = safeNum(pc?.actualRawUsed);
  const allowedWastage = safeNum(pc?.allowedWastageRawUsed);
  const remainingRawFromPC = safeNum(pc?.remainingRawQuantity);

  // Banner logic – uses productionLossQuantity to detect actual excess loss
  const hasGain = gain > EPSILON;
  const hasProductionLoss = loss > EPSILON;               // backend says some loss exceeds allowed
  const hasNormalWastageOnly = !hasGain && !hasProductionLoss && (normalWastage > EPSILON || (actualRaw > expectedRaw + EPSILON));
  const isPerfect = !hasGain && !hasProductionLoss && !hasNormalWastageOnly;

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/inventory/material-wip/${wip._id}`)}
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to WIP
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                {isPending ? "Review & Approval" : "Production Request"}
              </h1>
              <p className="text-xs text-gray-500">
                {nameOf(wip.rawMaterialId)} — {wip.unit}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* ========== ACTIVE WIP ========== */}
        {wip.status === "ACTIVE" && (
          <>
            {/* Step indicator */}
            <div className="flex items-center gap-4 mb-6">
              <div
                className={cn(
                  "flex items-center gap-2",
                  step === 1 ? "text-blue-600" : "text-gray-400"
                )}
              >
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium border-2",
                    step === 1 ? "border-blue-600 bg-blue-50" : "border-gray-300"
                  )}
                >
                  1
                </div>
                <span className="text-sm font-medium">Select Products</span>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-300" />
              <div
                className={cn(
                  "flex items-center gap-2",
                  step === 2 ? "text-blue-600" : "text-gray-400"
                )}
              >
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium border-2",
                    step === 2 ? "border-blue-600 bg-blue-50" : "border-gray-300"
                  )}
                >
                  2
                </div>
                <span className="text-sm font-medium">Remaining & Submit</span>
              </div>
            </div>

            {step === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Step 1: Select Products & Quantities</CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingBoms ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : possibleBoms.length === 0 ? (
                    <p className="text-center py-8 text-gray-500">
                      No BOMs found for this raw material.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>BOM Components</TableHead>
                          <TableHead className="w-40">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {possibleBoms.map((bom) => {
                          const isSelected = selectedProducts.some(
                            (p) => p.productId === bom.productId._id
                          );
                          return (
                            <TableRow key={bom.productId._id}>
                              <TableCell className="font-medium">
                                {bom.productId.name} ({bom.productId.sku})
                              </TableCell>
                              <TableCell className="text-xs text-gray-600">
                                {bom.components.map((c, i) => (
                                  <div key={i}>
                                    {c.itemType === "RawMaterial" ? "RM" : "PKG"}:{" "}
                                    {resolveName(c.itemType, c.itemId)} — {c.quantity}{" "}
                                    {c.unit || ""}
                                    {c.wastagePercent
                                      ? ` (wastage ${c.wastagePercent}%)`
                                      : ""}
                                  </div>
                                ))}
                              </TableCell>
                              <TableCell>
                                {isSelected ? (
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="number"
                                      min={0}
                                      value={
                                        selectedProducts.find(
                                          (p) => p.productId === bom.productId._id
                                        )?.quantityProduced || ""
                                      }
                                      onChange={(e) =>
                                        updateQty(bom.productId._id, Number(e.target.value))
                                      }
                                      className="w-20 h-8"
                                    />
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => toggleProduct(bom.productId._id)}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => toggleProduct(bom.productId._id)}
                                  >
                                    Select
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                  <div className="flex justify-end mt-4">
                    <Button onClick={() => setStep(2)} disabled={!canProceed}>
                      Next <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle>Step 2: Remaining Raw Material & Submit</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 mb-2">
                    <div className="bg-blue-50 p-3 rounded text-center">
                      <div className="text-xs text-gray-500">Issued</div>
                      <div className="text-lg font-semibold">
                        {safeFixed3(wip.initialQuantity)} {wip.unit}
                      </div>
                    </div>
                    <div className="bg-amber-50 p-3 rounded text-center">
                      <div className="text-xs text-gray-500">Taken (consumed)</div>
                      <div className="text-lg font-semibold">
                        {remainingValid ? safeFixed3(taken) : "—"} {wip.unit}
                      </div>
                    </div>
                    <div className="bg-green-50 p-3 rounded text-center">
                      <div className="text-xs text-gray-500">
                        Remaining (will return)
                      </div>
                      <div className="text-lg font-semibold">
                        {remainingRawStr || "0"} {wip.unit}
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label>Enter remaining raw material after production</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={remainingRawStr}
                      onChange={(e) => setRemainingRawStr(e.target.value)}
                      className="mt-1"
                    />
                    {remainingValid && (
                      <p className="text-xs text-gray-500 mt-1">
                        Taken = {safeFixed3(taken)} {wip.unit}
                      </p>
                    )}
                  </div>

                  {process.env.NEXT_PUBLIC_STRICT_WASTAGE === "true" && (
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={bypassWastage}
                        onChange={(e) => setBypassWastage(e.target.checked)}
                        className="rounded"
                      />
                      <Label>Override wastage check</Label>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <Button variant="ghost" onClick={() => setStep(1)}>
                      <ChevronLeft className="h-4 w-4 mr-1" /> Back
                    </Button>
                    <Button
                      onClick={handleRequest}
                      disabled={!canSubmit || requesting}
                    >
                      {requesting ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      {requesting ? "Submitting..." : "Request Approval"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* ========== PENDING_APPROVAL ========== */}
        {isPending && pc && !editMode && (
          <>
            {/* WIP summary */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-xs text-gray-500">Issued</div>
                  <div className="text-lg font-semibold">
                    {safeFixed3(wip.initialQuantity)} {wip.unit}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-xs text-gray-500">Taken (actual raw)</div>
                  <div className="text-lg font-semibold">
                    {safeFixed3(actualRaw)} {wip.unit}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-xs text-gray-500">Remaining (will return)</div>
                  <div className="text-lg font-semibold">
                    {safeFixed3(remainingRawFromPC)} {wip.unit}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Variance banners */}
            {hasGain && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-300 text-green-800">
                <BadgeCheck className="h-6 w-6 text-green-600" />
                <div>
                  <div className="font-semibold">GAIN Detected</div>
                  <div className="text-sm">
                    Actual raw usage ({safeFixed3(actualRaw)} {wip.unit}) is less than
                    BOM expected ({safeFixed3(expectedRaw)} {wip.unit}). Gain of{" "}
                    {safeFixed3(gain)} {wip.unit}.
                  </div>
                </div>
              </div>
            )}
            {hasProductionLoss && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-300 text-red-800">
                <AlertTriangle className="h-6 w-6 text-red-600" />
                <div>
                  <div className="font-semibold">
                    Production Loss (exceeds allowed wastage)
                  </div>
                  <div className="text-sm">
                    Actual raw usage ({safeFixed3(actualRaw)} {wip.unit}) exceeds BOM
                    expected ({safeFixed3(expectedRaw)} {wip.unit}) by{" "}
                    {safeFixed3(loss + normalWastage)} {wip.unit}. Allowed wastage:{" "}
                    {safeFixed3(allowedWastage)} {wip.unit}. Excess loss:{" "}
                    {safeFixed3(loss)} {wip.unit}. Approver review required.
                  </div>
                </div>
              </div>
            )}
            {hasNormalWastageOnly && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-800">
                <ShieldAlert className="h-6 w-6 text-amber-600" />
                <div>
                  <div className="font-semibold">Normal Wastage (within limit)</div>
                  <div className="text-sm">
                    Actual raw usage ({safeFixed3(actualRaw)} {wip.unit}) exceeds BOM
                    expected by {safeFixed3(normalWastage)} {wip.unit}, within allowed
                    wastage ({safeFixed3(allowedWastage)} {wip.unit}).
                  </div>
                </div>
              </div>
            )}
            {isPerfect && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-800">
                <Info className="h-6 w-6 text-blue-600" />
                <div>
                  <div className="font-semibold">Perfect Usage</div>
                  <div className="text-sm">
                    Actual raw usage matches BOM expected (
                    {safeFixed3(expectedRaw)} {wip.unit}). No gain or loss.
                  </div>
                </div>
              </div>
            )}

            {/* Variance cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-xs text-gray-500">Expected Raw</div>
                  <div className="font-semibold">
                    {safeFixed3(expectedRaw)} {wip.unit}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-xs text-gray-500">Allowed Wastage</div>
                  <div className="font-semibold">
                    {safeFixed3(allowedWastage)} {wip.unit}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-xs text-gray-500">Actual Raw</div>
                  <div className="font-semibold">
                    {safeFixed3(actualRaw)} {wip.unit}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-xs text-gray-500">Gain</div>
                  <div className="font-semibold text-green-600">
                    +{safeFixed3(gain)} {wip.unit}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-xs text-gray-500">Normal Wastage</div>
                  <div className="font-semibold">
                    {safeFixed3(normalWastage)} {wip.unit}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-xs text-gray-500">Loss</div>
                  <div className="font-semibold text-red-600">
                    -{safeFixed3(loss)} {wip.unit}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Cost summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-xs text-gray-500">Raw Mat. Cost</div>
                  <div className="font-semibold">৳ {safeTaka(pc.rawMaterialCost)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-xs text-gray-500">Packaging Cost</div>
                  <div className="font-semibold">
                    ৳ {safeTaka(pc.packagingMaterialCost)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-xs text-gray-500">Total Input Cost</div>
                  <div className="font-semibold">৳ {safeTaka(pc.totalInputCost)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-xs text-gray-500">Finished Goods Cost</div>
                  <div className="font-semibold">
                    ৳ {safeTaka(pc.totalFinishedGoodsCost)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Per‑product table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Products Produced</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Exp Raw</TableHead>
                      <TableHead className="text-right">Act Raw</TableHead>
                      <TableHead className="text-right">Unit Cost</TableHead>
                      <TableHead className="text-right">Total Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pc.products?.map((p: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">
                          {typeof p.productId === "object"
                            ? p.productId.name
                            : nameOf(p.productId)}
                        </TableCell>
                        <TableCell className="text-right">
                          {p.quantityProduced}
                        </TableCell>
                        <TableCell className="text-right">
                          {safeFixed3(p.expectedRawUsed)} {wip.unit}
                        </TableCell>
                        <TableCell className="text-right">
                          {safeFixed3(p.actualRawUsed)} {wip.unit}
                        </TableCell>
                        <TableCell className="text-right">
                          ৳ {safeTaka(p.unitCost)}
                        </TableCell>
                        <TableCell className="text-right">
                          ৳ {safeTaka(p.totalCost)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-semibold bg-gray-50">
                      <TableCell>Totals</TableCell>
                      <TableCell className="text-right">
                        {pc.products?.reduce(
                          (sum: number, p: any) => sum + safeNum(p.quantityProduced),
                          0
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {safeFixed3(expectedRaw)} {wip.unit}
                      </TableCell>
                      <TableCell className="text-right">
                        {safeFixed3(actualRaw)} {wip.unit}
                      </TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-right">
                        ৳ {safeTaka(pc.totalFinishedGoodsCost)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Other materials */}
            {pc.otherMaterialsUsed?.length ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Other Materials (expected)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {pc.otherMaterialsUsed.map((m, i) => (
                      <div key={i} className="flex justify-between items-center">
                        <span>{resolveName(m.itemType, m.itemId)}</span>
                        <span>
                          {m.quantity} {safeUnit(m.unit)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {pc.notes && (
              <Card>
                <CardContent className="py-3 text-sm text-gray-700">
                  <span className="font-medium">Notes:</span> {pc.notes}
                </CardContent>
              </Card>
            )}

            {/* Action buttons */}
            <div className="flex flex-col md:flex-row gap-4">
              <Button
                onClick={() => setEditMode(true)}
                variant="outline"
                className="flex-1"
              >
                <Edit3 className="h-4 w-4 mr-2" /> Edit Conversion
              </Button>
              <Button
                onClick={handleApprove}
                disabled={approving}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
              >
                {approving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                {approving ? "Approving..." : "Approve Conversion"}
              </Button>
              <div className="flex-1 space-y-2">
                <Input
                  placeholder="Rejection reason"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
                <Button
                  variant="outline"
                  onClick={handleReject}
                  disabled={rejecting}
                  className="w-full"
                >
                  {rejecting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Reject
                </Button>
              </div>
            </div>
          </>
        )}

        {/* ========== EDIT MODE ========== */}
        {isPending && editMode && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Edit3 className="h-5 w-5" /> Edit Pending Conversion
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {loadingBoms ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : possibleBoms.length === 0 ? (
                <p className="text-center py-8 text-gray-500">No BOMs available.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Components</TableHead>
                      <TableHead className="w-40">Quantity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {possibleBoms.map((bom) => {
                      const existing = editingProducts.find(
                        (p) => p.productId === bom.productId._id
                      );
                      return (
                        <TableRow key={bom.productId._id}>
                          <TableCell className="font-medium">
                            {bom.productId.name}
                          </TableCell>
                          <TableCell className="text-xs text-gray-600">
                            {bom.components.map((c, i) => (
                              <div key={i}>
                                {c.itemType === "RawMaterial" ? "RM" : "PKG"}:{" "}
                                {resolveName(c.itemType, c.itemId)} — {c.quantity}{" "}
                                {c.unit || ""}
                                {c.wastagePercent
                                  ? ` (wastage ${c.wastagePercent}%)`
                                  : ""}
                              </div>
                            ))}
                          </TableCell>
                          <TableCell>
                            {existing ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  min={0}
                                  value={existing.quantityProduced || ""}
                                  onChange={(e) =>
                                    updateEditQty(
                                      bom.productId._id,
                                      Number(e.target.value)
                                    )
                                  }
                                  className="w-20 h-8"
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => toggleEditProduct(bom.productId._id)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => toggleEditProduct(bom.productId._id)}
                              >
                                Add
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}

              <div className="space-y-2">
                <Label>Remaining raw material</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={editingRemainingStr}
                  onChange={(e) => setEditingRemainingStr(e.target.value)}
                />
                {editingRemainingStr && !isNaN(parseFloat(editingRemainingStr)) && (
                  <p className="text-xs text-gray-500">
                    Taken will be{" "}
                    {safeFixed3(
                      safeNum(wip.initialQuantity) - parseFloat(editingRemainingStr)
                    )}{" "}
                    {wip.unit}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Input
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Approval notes..."
                />
              </div>

              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setEditMode(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdate} disabled={updating}>
                  {updating ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}