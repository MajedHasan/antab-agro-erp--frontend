// app/inventory/material-wip/[wipId]/produce/page.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Search,
  Factory as FactoryIcon,
  Package,
  Wallet,
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
  new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(safeNum(v));
const safeUnit = (u: any) =>
  u && u !== "NaN" && u !== "null" && u !== "undefined" ? String(u) : "—";

function nameOf(maybe: any) {
  if (!maybe) return "—";
  if (typeof maybe === "string") return maybe;
  return maybe.name || maybe._id || "—";
}

const EPSILON = 0.0001;

/* ---------- Section header ---------- */
function SectionHeader({
  icon: Icon,
  title,
  right,
}: {
  icon: React.ElementType;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-2.5">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#3aa838]/10">
          <Icon className="h-3.5 w-3.5 text-[#3aa838]" />
        </div>
        <div className="text-sm font-semibold">{title}</div>
      </div>
      {right}
    </div>
  );
}

/* ---------- Main ---------- */
export default function ProduceMaterialWipPage() {
  const { wipId } = useParams<{ wipId: string }>();
  const router = useRouter();

  const [wip, setWip] = useState<MaterialWIP | null>(null);
  const [loading, setLoading] = useState(true);

  // Name lookups
  const [rawMaterialNames, setRawMaterialNames] = useState<
    Record<string, string>
  >({});
  const [packagingNames, setPackagingNames] = useState<
    Record<string, string>
  >({});

  // ACTIVE flow
  const [possibleBoms, setPossibleBoms] = useState<BOMWithProduct[]>([]);
  const [loadingBoms, setLoadingBoms] = useState(false);
  const [bomSearch, setBomSearch] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<
    { productId: string; quantityProduced: number }[]
  >([]);
  const [step, setStep] = useState<1 | 2>(1);
  const [remainingRawStr, setRemainingRawStr] = useState("");
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
  const [editingRemainingStr, setEditingRemainingStr] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSearch, setEditSearch] = useState("");
  const [updating, setUpdating] = useState(false);

  /* Load WIP + names */
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

  /* Fetch BOMs when ACTIVE or editing */
  useEffect(() => {
    if (!wip || (wip.status !== "ACTIVE" && !editMode)) return;
    const rawId =
      typeof wip.rawMaterialId === "object"
        ? wip.rawMaterialId._id
        : wip.rawMaterialId;
    setLoadingBoms(true);
    api
      .get(`/material-wip/products/${rawId}`)
      .then((res) => setPossibleBoms(res.data?.data || []))
      .catch(() => toast.error("Failed to load possible products"))
      .finally(() => setLoadingBoms(false));
  }, [wip, editMode]);

  /* Prefill edit form */
  useEffect(() => {
    if (wip?.status === "PENDING_APPROVAL" && wip.pendingConversion && editMode) {
      const pc = wip.pendingConversion;
      setEditingProducts(
        pc.products?.map((p: any) => ({
          productId:
            typeof p.productId === "object" ? p.productId._id : p.productId,
          quantityProduced: safeNum(p.quantityProduced),
        })) || [],
      );
      setEditingRemainingStr(
        pc.remainingRawQuantity != null
          ? String(pc.remainingRawQuantity)
          : "",
      );
      setEditNotes(pc.notes || "");
    }
  }, [editMode, wip]);

  const resolveName = (itemType: string, itemId: string) =>
    itemType === "RawMaterial"
      ? rawMaterialNames[itemId] || itemId
      : packagingNames[itemId] || itemId;

  /* Filtered BOMs */
  const filteredBoms = useMemo(() => {
    const q = bomSearch.trim().toLowerCase();
    if (!q) return possibleBoms;
    return possibleBoms.filter((bom) =>
      `${bom.productId.name} ${bom.productId.sku || ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [possibleBoms, bomSearch]);

  const filteredEditBoms = useMemo(() => {
    const q = editSearch.trim().toLowerCase();
    if (!q) return possibleBoms;
    return possibleBoms.filter((bom) =>
      `${bom.productId.name} ${bom.productId.sku || ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [possibleBoms, editSearch]);

  /* ACTIVE helpers */
  const toggleProduct = (productId: string) => {
    setSelectedProducts((prev) => {
      const exists = prev.find((p) => p.productId === productId);
      if (exists) return prev.filter((p) => p.productId !== productId);
      return [...prev, { productId, quantityProduced: 0 }];
    });
  };

  const updateQty = (productId: string, qty: number) => {
    setSelectedProducts((prev) =>
      prev.map((p) =>
        p.productId === productId ? { ...p, quantityProduced: qty } : p,
      ),
    );
  };

  const selectedCount = selectedProducts.filter(
    (p) => p.quantityProduced > 0,
  ).length;
  const canProceed = selectedCount > 0;

  const remainingRaw = parseFloat(remainingRawStr);
  const remainingValid =
    !isNaN(remainingRaw) &&
    remainingRaw >= 0 &&
    remainingRaw <= safeNum(wip?.initialQuantity);
  const canSubmit = canProceed && remainingValid;
  const taken =
    safeNum(wip?.initialQuantity) - safeNum(remainingValid ? remainingRaw : 0);

  const handleRequest = async () => {
    if (!wip || !canSubmit) return;
    const validProducts = selectedProducts.filter(
      (p) => p.quantityProduced > 0,
    );
    setRequesting(true);
    try {
      const factoryId =
        typeof wip.factoryId === "object" ? wip.factoryId._id : wip.factoryId;
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

  /* PENDING_APPROVAL helpers */
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
    if (!rejectReason.trim())
      return toast.error("Please provide a rejection reason");
    setRejecting(true);
    try {
      await api.post(`/material-wip/${wip._id}/reject`, {
        reason: rejectReason,
      });
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
    const validProducts = editingProducts.filter(
      (p) => p.quantityProduced > 0,
    );
    if (validProducts.length === 0)
      return toast.error("Select at least one product");
    const remaining = parseFloat(editingRemainingStr);
    if (
      isNaN(remaining) ||
      remaining < 0 ||
      remaining > safeNum(wip.initialQuantity)
    ) {
      toast.error("Invalid remaining quantity");
      return;
    }
    setUpdating(true);
    try {
      const factoryId =
        typeof wip.factoryId === "object" ? wip.factoryId._id : wip.factoryId;
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

  const toggleEditProduct = (productId: string) => {
    setEditingProducts((prev) => {
      const exists = prev.find((p) => p.productId === productId);
      if (exists) return prev.filter((p) => p.productId !== productId);
      return [...prev, { productId, quantityProduced: 0 }];
    });
  };

  const updateEditQty = (productId: string, qty: number) => {
    setEditingProducts((prev) =>
      prev.map((p) =>
        p.productId === productId ? { ...p, quantityProduced: qty } : p,
      ),
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading WIP...
        </div>
      </div>
    );
  }
  if (!wip) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Card className="w-full max-w-lg">
          <CardContent className="p-8 text-center">
            <div className="text-lg font-semibold">WIP not found</div>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => router.push("/inventory/material-wip")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to list
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pc = wip.pendingConversion;
  const isPending = wip.status === "PENDING_APPROVAL";

  /* Derived values */
  const loss = safeNum(pc?.productionLossQuantity);
  const gain = safeNum(pc?.gainQuantity);
  const normalWastage = safeNum(pc?.normalWastageQuantity);
  const expectedRaw = safeNum(pc?.expectedRawUsed);
  const actualRaw = safeNum(pc?.actualRawUsed);
  const allowedWastage = safeNum(pc?.allowedWastageRawUsed);
  const remainingRawFromPC = safeNum(pc?.remainingRawQuantity);

  const hasGain = gain > EPSILON;
  const hasProductionLoss = loss > EPSILON;
  const hasNormalWastageOnly =
    !hasGain && !hasProductionLoss && normalWastage > EPSILON;
  const isPerfect = !hasGain && !hasProductionLoss && !hasNormalWastageOnly;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl p-3 md:p-4">
        {/* ============ HERO ============ */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                router.push(`/inventory/material-wip/${wip._id}`)
              }
              className="h-8 w-8"
              title="Back to WIP"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3aa838]/10">
              <FactoryIcon className="h-4 w-4 text-[#3aa838]" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold leading-tight">
                {isPending ? "Review & Approval" : "Production Request"}
              </h1>
              <p className="truncate text-[11px] text-muted-foreground">
                {nameOf(wip.rawMaterialId)} · {wip.unit} · Issued{" "}
                {safeFixed3(wip.initialQuantity)}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            <Badge
              className={cn(
                "border text-[11px] font-semibold",
                isPending
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-[#3aa838]/30 bg-[#3aa838]/10 text-[#2f8a2f]",
              )}
            >
              {isPending ? "Pending approval" : "Active"}
            </Badge>
          </div>
        </div>

        {/* ============ ACTIVE WIP ============ */}
        {wip.status === "ACTIVE" && (
          <div className="space-y-3">
            {/* Step indicator */}
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div
                className={cn(
                  "flex items-center gap-2",
                  step === 1 ? "text-[#2f8a2f]" : "text-slate-400",
                )}
              >
                <div
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold",
                    step === 1
                      ? "border-[#3aa838] bg-[#3aa838]/10 text-[#2f8a2f]"
                      : "border-slate-300",
                  )}
                >
                  1
                </div>
                <span className="text-sm font-medium">Select products</span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300" />
              <div
                className={cn(
                  "flex items-center gap-2",
                  step === 2 ? "text-[#2f8a2f]" : "text-slate-400",
                )}
              >
                <div
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold",
                    step === 2
                      ? "border-[#3aa838] bg-[#3aa838]/10 text-[#2f8a2f]"
                      : "border-slate-300",
                  )}
                >
                  2
                </div>
                <span className="text-sm font-medium">Remaining & submit</span>
              </div>
            </div>

            {step === 1 && (
              <Card className="overflow-hidden border-slate-200 shadow-sm">
                <SectionHeader
                  icon={Package}
                  title="Step 1 — Select products & quantities"
                  right={
                    <span className="text-[11px] text-muted-foreground">
                      {selectedCount} selected
                    </span>
                  }
                />

                <CardContent className="space-y-3 p-4">
                  {/* Search bar */}
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={bomSearch}
                      onChange={(e) => setBomSearch(e.target.value)}
                      placeholder="Search product by name or SKU..."
                      className="h-9 pl-9 text-sm focus-visible:ring-[#3aa838]"
                    />
                  </div>

                  {loadingBoms ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : possibleBoms.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-muted-foreground">
                      No BOMs found for this raw material.
                    </div>
                  ) : filteredBoms.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-muted-foreground">
                      No products match "{bomSearch}".
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-lg border border-slate-200">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50 hover:bg-slate-50">
                            <TableHead className="text-[11px] font-medium uppercase tracking-wide text-slate-600">
                              Product
                            </TableHead>
                            <TableHead className="text-[11px] font-medium uppercase tracking-wide text-slate-600">
                              BOM components
                            </TableHead>
                            <TableHead className="w-44 text-[11px] font-medium uppercase tracking-wide text-slate-600">
                              Action
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredBoms.map((bom) => {
                            const isSelected = selectedProducts.some(
                              (p) => p.productId === bom.productId._id,
                            );
                            return (
                              <TableRow
                                key={bom.productId._id}
                                className="border-b border-slate-100 last:border-0"
                              >
                                <TableCell className="px-3 py-2 font-medium">
                                  <div className="text-sm text-slate-900">
                                    {bom.productId.name}
                                  </div>
                                  {bom.productId.sku && (
                                    <div className="text-[10px] text-muted-foreground">
                                      {bom.productId.sku}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="px-3 py-2 text-[11px] text-slate-600">
                                  {bom.components.map((c, i) => (
                                    <div key={i} className="truncate">
                                      <span className="font-medium text-slate-500">
                                        {c.itemType === "RawMaterial"
                                          ? "RM"
                                          : "PKG"}
                                        :
                                      </span>{" "}
                                      {resolveName(c.itemType, c.itemId)} —{" "}
                                      {c.quantity} {c.unit || ""}
                                      {c.wastagePercent
                                        ? ` (wastage ${c.wastagePercent}%)`
                                        : ""}
                                    </div>
                                  ))}
                                </TableCell>
                                <TableCell className="px-3 py-2">
                                  {isSelected ? (
                                    <div className="flex items-center gap-1.5">
                                      <Input
                                        type="number"
                                        min={0}
                                        value={
                                          selectedProducts.find(
                                            (p) =>
                                              p.productId === bom.productId._id,
                                          )?.quantityProduced || ""
                                        }
                                        onChange={(e) =>
                                          updateQty(
                                            bom.productId._id,
                                            Number(e.target.value),
                                          )
                                        }
                                        className="h-8 w-24 text-center tabular-nums focus-visible:ring-[#3aa838]"
                                        placeholder="Qty"
                                      />
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                        onClick={() =>
                                          toggleProduct(bom.productId._id)
                                        }
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        toggleProduct(bom.productId._id)
                                      }
                                      className="h-8 border-[#3aa838]/40 text-[#2f8a2f] hover:bg-[#3aa838]/5 hover:text-[#2f8a2f]"
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
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button
                      onClick={() => setStep(2)}
                      disabled={!canProceed}
                      className="bg-[#3aa838] text-white hover:bg-[#2f8a2f]"
                    >
                      Next
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 2 && (
              <Card className="overflow-hidden border-slate-200 shadow-sm">
                <SectionHeader
                  icon={Wallet}
                  title="Step 2 — Remaining raw material & submit"
                />
                <CardContent className="space-y-3 p-4">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Issued
                      </div>
                      <div className="text-base font-semibold tabular-nums text-slate-900">
                        {safeFixed3(wip.initialQuantity)} {wip.unit}
                      </div>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-amber-700">
                        Taken
                      </div>
                      <div className="text-base font-semibold tabular-nums text-amber-800">
                        {remainingValid ? safeFixed3(taken) : "—"} {wip.unit}
                      </div>
                    </div>
                    <div className="rounded-lg border border-[#3aa838]/30 bg-[#3aa838]/5 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-[#2f8a2f]">
                        Remaining
                      </div>
                      <div className="text-base font-semibold tabular-nums text-[#2f8a2f]">
                        {remainingRawStr || "0"} {wip.unit}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-600">
                      Enter remaining raw material after production
                    </Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={remainingRawStr}
                      onChange={(e) => setRemainingRawStr(e.target.value)}
                      className="h-10 focus-visible:ring-[#3aa838]"
                    />
                    {remainingValid && (
                      <p className="text-[11px] text-muted-foreground">
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
                        className="rounded border-slate-300 text-[#3aa838] focus:ring-[#3aa838]"
                      />
                      <Label className="text-sm">Override wastage check</Label>
                    </div>
                  )}

                  <div className="flex justify-between gap-2">
                    <Button variant="ghost" onClick={() => setStep(1)}>
                      <ChevronLeft className="mr-1 h-4 w-4" /> Back
                    </Button>
                    <Button
                      onClick={handleRequest}
                      disabled={!canSubmit || requesting}
                      className="bg-[#3aa838] text-white hover:bg-[#2f8a2f]"
                    >
                      {requesting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle className="mr-2 h-4 w-4" />
                      )}
                      {requesting ? "Submitting..." : "Request Approval"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ============ PENDING_APPROVAL ============ */}
        {isPending && pc && !editMode && (
          <div className="space-y-3">
            {/* WIP summary */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Issued
                </div>
                <div className="text-base font-semibold tabular-nums text-slate-900">
                  {safeFixed3(wip.initialQuantity)} {wip.unit}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Actual raw
                </div>
                <div className="text-base font-semibold tabular-nums text-slate-900">
                  {safeFixed3(actualRaw)} {wip.unit}
                </div>
              </div>
              <div className="rounded-lg border border-[#3aa838]/30 bg-[#3aa838]/5 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-[#2f8a2f]">
                  Remaining
                </div>
                <div className="text-base font-semibold tabular-nums text-[#2f8a2f]">
                  {safeFixed3(remainingRawFromPC)} {wip.unit}
                </div>
              </div>
            </div>

            {/* Variance banners */}
            {hasGain && (
              <div className="flex items-start gap-3 rounded-lg border border-[#3aa838]/30 bg-[#3aa838]/5 p-3 text-sm text-[#2f8a2f]">
                <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <div className="font-semibold">Gain detected</div>
                  <div className="mt-0.5 text-xs">
                    Actual usage ({safeFixed3(actualRaw)} {wip.unit}) is less
                    than expected ({safeFixed3(expectedRaw)} {wip.unit}). Gain
                    of <b>+{safeFixed3(gain)} {wip.unit}</b>.
                  </div>
                </div>
              </div>
            )}
            {hasProductionLoss && (
              <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <div className="font-semibold">
                    Production loss (exceeds allowed wastage)
                  </div>
                  <div className="mt-0.5 text-xs">
                    Actual {safeFixed3(actualRaw)} {wip.unit} vs expected{" "}
                    {safeFixed3(expectedRaw)} {wip.unit}. Allowed wastage:{" "}
                    {safeFixed3(allowedWastage)} {wip.unit}. Excess loss:{" "}
                    <b>-{safeFixed3(loss)} {wip.unit}</b>.
                  </div>
                </div>
              </div>
            )}
            {hasNormalWastageOnly && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <div className="font-semibold">
                    Normal wastage (within limit)
                  </div>
                  <div className="mt-0.5 text-xs">
                    Excess of {safeFixed3(normalWastage)} {wip.unit} is within
                    the allowed {safeFixed3(allowedWastage)} {wip.unit} limit.
                  </div>
                </div>
              </div>
            )}
            {isPerfect && (
              <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <Info className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <div className="font-semibold">Perfect usage</div>
                  <div className="mt-0.5 text-xs">
                    Actual usage matches expected ({safeFixed3(expectedRaw)}{" "}
                    {wip.unit}).
                  </div>
                </div>
              </div>
            )}

            {/* Variance cards */}
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <SectionHeader icon={ShieldAlert} title="Variance breakdown" />
              <CardContent className="grid grid-cols-2 gap-2 p-4 md:grid-cols-6">
                <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                  <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
                    Expected
                  </div>
                  <div className="text-xs font-semibold tabular-nums">
                    {safeFixed3(expectedRaw)} {wip.unit}
                  </div>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                  <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
                    Allowed
                  </div>
                  <div className="text-xs font-semibold tabular-nums">
                    {safeFixed3(allowedWastage)} {wip.unit}
                  </div>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                  <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
                    Actual
                  </div>
                  <div className="text-xs font-semibold tabular-nums">
                    {safeFixed3(actualRaw)} {wip.unit}
                  </div>
                </div>
                <div className="rounded-md border border-[#3aa838]/30 bg-[#3aa838]/5 px-2 py-1.5">
                  <div className="text-[9px] uppercase tracking-wide text-[#2f8a2f]">
                    Gain
                  </div>
                  <div className="text-xs font-semibold tabular-nums text-[#2f8a2f]">
                    +{safeFixed3(gain)}
                  </div>
                </div>
                <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5">
                  <div className="text-[9px] uppercase tracking-wide text-amber-700">
                    Wastage
                  </div>
                  <div className="text-xs font-semibold tabular-nums text-amber-800">
                    {safeFixed3(normalWastage)}
                  </div>
                </div>
                <div className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5">
                  <div className="text-[9px] uppercase tracking-wide text-rose-700">
                    Loss
                  </div>
                  <div className="text-xs font-semibold tabular-nums text-rose-700">
                    -{safeFixed3(loss)}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cost summary */}
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <SectionHeader icon={Wallet} title="Cost summary" />
              <CardContent className="grid grid-cols-2 gap-2 p-4 md:grid-cols-4">
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Raw material
                  </div>
                  <div className="text-sm font-semibold tabular-nums text-slate-900">
                    ৳ {safeTaka(pc.rawMaterialCost)}
                  </div>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Packaging
                  </div>
                  <div className="text-sm font-semibold tabular-nums text-slate-900">
                    ৳ {safeTaka(pc.packagingMaterialCost)}
                  </div>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Input cost
                  </div>
                  <div className="text-sm font-semibold tabular-nums text-slate-900">
                    ৳ {safeTaka(pc.totalInputCost)}
                  </div>
                </div>
                <div className="rounded-md border border-[#3aa838]/30 bg-[#3aa838]/5 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-[#2f8a2f]">
                    Finished cost
                  </div>
                  <div className="text-sm font-bold tabular-nums text-[#2f8a2f]">
                    ৳ {safeTaka(pc.totalFinishedGoodsCost)}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Product table */}
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <SectionHeader icon={Package} title="Products produced" />
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 hover:bg-slate-50">
                        {[
                          "Product",
                          "Qty",
                          "Exp Raw",
                          "Act Raw",
                          "Unit Cost",
                          "Total Cost",
                        ].map((h) => (
                          <TableHead
                            key={h}
                            className={cn(
                              "border-b border-slate-200 px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-slate-600",
                              h !== "Product" && "text-right",
                            )}
                          >
                            {h}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pc.products?.map((p: any, idx: number) => (
                        <TableRow
                          key={idx}
                          className="border-b border-slate-100 last:border-0"
                        >
                          <TableCell className="px-3 py-2 font-medium">
                            {typeof p.productId === "object"
                              ? p.productId.name
                              : nameOf(p.productId)}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-right tabular-nums">
                            {p.quantityProduced}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-right tabular-nums text-[11px] text-muted-foreground">
                            {safeFixed3(p.expectedRawUsed)}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-right tabular-nums text-[11px] text-muted-foreground">
                            {safeFixed3(p.actualRawUsed)}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-right tabular-nums">
                            ৳ {safeTaka(p.unitCost)}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-right tabular-nums font-semibold">
                            ৳ {safeTaka(p.totalCost)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-slate-50 font-semibold">
                        <TableCell className="px-3 py-2">Totals</TableCell>
                        <TableCell className="px-3 py-2 text-right tabular-nums">
                          {pc.products?.reduce(
                            (sum: number, p: any) =>
                              sum + safeNum(p.quantityProduced),
                            0,
                          )}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-right tabular-nums text-[11px]">
                          {safeFixed3(expectedRaw)}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-right tabular-nums text-[11px]">
                          {safeFixed3(actualRaw)}
                        </TableCell>
                        <TableCell />
                        <TableCell className="px-3 py-2 text-right tabular-nums text-[#2f8a2f]">
                          ৳ {safeTaka(pc.totalFinishedGoodsCost)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Other materials */}
            {pc.otherMaterialsUsed?.length ? (
              <Card className="overflow-hidden border-slate-200 shadow-sm">
                <SectionHeader
                  icon={Package}
                  title="Other materials (expected)"
                />
                <CardContent className="space-y-1.5 p-4 text-sm">
                  {pc.otherMaterialsUsed.map((m, i) => (
                    <div key={i} className="flex justify-between">
                      <span>{resolveName(m.itemType, m.itemId)}</span>
                      <span className="font-medium tabular-nums">
                        {m.quantity} {safeUnit(m.unit)}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            {pc.notes && (
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
                <span className="font-medium">Notes:</span> {pc.notes}
              </div>
            )}

            {/* Action bar */}
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <SectionHeader icon={CheckCircle} title="Actions" />
              <CardContent className="space-y-3 p-4">
                <div className="grid gap-2 md:grid-cols-2">
                  <Button
                    onClick={() => setEditMode(true)}
                    variant="outline"
                    className="h-10"
                  >
                    <Edit3 className="mr-2 h-4 w-4" />
                    Edit conversion
                  </Button>
                  <Button
                    onClick={handleApprove}
                    disabled={approving}
                    className="h-10 bg-[#3aa838] text-white hover:bg-[#2f8a2f]"
                  >
                    {approving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="mr-2 h-4 w-4" />
                    )}
                    {approving ? "Approving..." : "Approve conversion"}
                  </Button>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                    Reject
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Rejection reason..."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="h-9 flex-1 focus-visible:ring-[#3aa838]"
                    />
                    <Button
                      variant="outline"
                      onClick={handleReject}
                      disabled={rejecting || !rejectReason.trim()}
                      className="h-9 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                    >
                      {rejecting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Reject
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ============ EDIT MODE ============ */}
        {isPending && editMode && (
          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <SectionHeader
              icon={Edit3}
              title="Edit pending conversion"
              right={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditMode(false)}
                  className="h-7 text-slate-500"
                >
                  <X className="mr-1 h-3.5 w-3.5" />
                  Cancel
                </Button>
              }
            />

            <CardContent className="space-y-4 p-4">
              {/* Search */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={editSearch}
                  onChange={(e) => setEditSearch(e.target.value)}
                  placeholder="Search product by name or SKU..."
                  className="h-9 pl-9 text-sm focus-visible:ring-[#3aa838]"
                />
              </div>

              {loadingBoms ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredEditBoms.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-muted-foreground">
                  {possibleBoms.length === 0
                    ? "No BOMs available."
                    : `No products match "${editSearch}".`}
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 hover:bg-slate-50">
                        <TableHead className="text-[11px] font-medium uppercase tracking-wide text-slate-600">
                          Product
                        </TableHead>
                        <TableHead className="text-[11px] font-medium uppercase tracking-wide text-slate-600">
                          Components
                        </TableHead>
                        <TableHead className="w-44 text-[11px] font-medium uppercase tracking-wide text-slate-600">
                          Quantity
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEditBoms.map((bom) => {
                        const existing = editingProducts.find(
                          (p) => p.productId === bom.productId._id,
                        );
                        return (
                          <TableRow
                            key={bom.productId._id}
                            className="border-b border-slate-100 last:border-0"
                          >
                            <TableCell className="px-3 py-2 font-medium">
                              <div className="text-sm text-slate-900">
                                {bom.productId.name}
                              </div>
                              {bom.productId.sku && (
                                <div className="text-[10px] text-muted-foreground">
                                  {bom.productId.sku}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="px-3 py-2 text-[11px] text-slate-600">
                              {bom.components.map((c, i) => (
                                <div key={i} className="truncate">
                                  <span className="font-medium text-slate-500">
                                    {c.itemType === "RawMaterial" ? "RM" : "PKG"}:
                                  </span>{" "}
                                  {resolveName(c.itemType, c.itemId)} —{" "}
                                  {c.quantity} {c.unit || ""}
                                  {c.wastagePercent
                                    ? ` (wastage ${c.wastagePercent}%)`
                                    : ""}
                                </div>
                              ))}
                            </TableCell>
                            <TableCell className="px-3 py-2">
                              {existing ? (
                                <div className="flex items-center gap-1.5">
                                  <Input
                                    type="number"
                                    min={0}
                                    value={existing.quantityProduced || ""}
                                    onChange={(e) =>
                                      updateEditQty(
                                        bom.productId._id,
                                        Number(e.target.value),
                                      )
                                    }
                                    className="h-8 w-24 text-center tabular-nums focus-visible:ring-[#3aa838]"
                                    placeholder="Qty"
                                  />
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                    onClick={() =>
                                      toggleEditProduct(bom.productId._id)
                                    }
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    toggleEditProduct(bom.productId._id)
                                  }
                                  className="h-8 border-[#3aa838]/40 text-[#2f8a2f] hover:bg-[#3aa838]/5 hover:text-[#2f8a2f]"
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
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">
                  Remaining raw material
                </Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={editingRemainingStr}
                  onChange={(e) => setEditingRemainingStr(e.target.value)}
                  className="h-10 focus-visible:ring-[#3aa838]"
                />
                {editingRemainingStr &&
                  !isNaN(parseFloat(editingRemainingStr)) && (
                    <p className="text-[11px] text-muted-foreground">
                      Taken will be{" "}
                      {safeFixed3(
                        safeNum(wip.initialQuantity) -
                          parseFloat(editingRemainingStr),
                      )}{" "}
                      {wip.unit}
                    </p>
                  )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">
                  Notes (optional)
                </Label>
                <Input
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Approval notes..."
                  className="h-10 focus-visible:ring-[#3aa838]"
                />
              </div>

              <div className="flex justify-between border-t border-slate-200 pt-3">
                <Button variant="ghost" onClick={() => setEditMode(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdate}
                  disabled={updating}
                  className="bg-[#3aa838] text-white hover:bg-[#2f8a2f]"
                >
                  {updating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  )}
                  Save changes
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}