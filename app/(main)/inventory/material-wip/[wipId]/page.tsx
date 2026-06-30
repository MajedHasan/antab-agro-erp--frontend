// app/inventory/material-wip/[wipId]/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Loader2,
  Play,
  CheckCircle,
  Clock,
  AlertTriangle,
  Info,
  BadgeCheck,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------- types ---------- */
type MaterialWIP = {
  _id: string;
  factoryId: { _id: string; name: string; code?: string } | string;
  rawMaterialId: { _id: string; name: string; sku?: string; unit: string } | string;
  date?: string;
  initialQuantity: number;
  remainingQuantity: number;
  unit: string;
  unitCost?: number;
  startCost?: number;
  issuedQuantity: number;
  returnedQuantity: number;
  consumedQuantity: number;
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
  status: "ACTIVE" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
  conversions?: Conversion[];
  pendingConversion?: PendingConversion;
  createdBy?: { name: string };
  approvedBy?: { name: string };
  approvedAt?: string;
  createdAt?: string;
  completedAt?: string;
  startVoucherIds?: string[];
  conversionVoucherId?: string;
  returnVoucherId?: string;
};

type ConversionProduct = {
  productId: { _id: string; name: string; sku?: string } | string;
  quantityProduced: number;
  expectedRawUsed?: number;
  actualRawUsed?: number;
  rawMaterialCost?: number;
  packagingMaterialCost?: number;
  totalCost?: number;
  unitCost?: number;
};

type Conversion = {
  products?: ConversionProduct[];
  expectedRawUsed?: number;
  allowedWastageRawUsed?: number;
  actualRawUsed?: number;
  gainQuantity?: number;
  normalWastageQuantity?: number;
  productionLossQuantity?: number;
  rawMaterialCost?: number;
  packagingMaterialCost?: number;
  otherMaterialCost?: number;
  totalInputCost?: number;
  totalFinishedGoodsCost?: number;
  otherMaterialsUsed?: OtherMaterialUsed[];
  createdAt?: string;
};

type PendingConversion = {
  products?: ConversionProduct[];
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
  otherMaterialsUsed?: OtherMaterialUsed[];
  notes?: string;
};

type OtherMaterialUsed = {
  itemType: "RawMaterial" | "PackagingItem";
  itemId: string;
  quantity: number;
  unit: string;
  unitCost?: number;
  totalCost?: number;
};

/* ---------- helpers ---------- */
const safeNum = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const safeTaka = (v: any) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(safeNum(v));
const safeFixed3 = (v: any) => safeNum(v).toFixed(3);
const safeUnit = (u: any) =>
  u && u !== "NaN" && u !== "null" && u !== "undefined" ? String(u) : "—";
const nameOf = (maybe: any) => {
  if (!maybe) return "—";
  if (typeof maybe === "string") return maybe;
  return maybe.name || maybe._id || "—";
};

const EPSILON = 0.0001;

const statusConfig: Record<string, { bg: string; text: string; icon: any; label: string }> = {
  ACTIVE: { bg: "bg-blue-50 border-blue-200", text: "text-blue-700", icon: Play, label: "Active" },
  PENDING_APPROVAL: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", icon: Clock, label: "Pending Approval" },
  APPROVED: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", icon: CheckCircle, label: "Approved" },
  REJECTED: { bg: "bg-red-50 border-red-200", text: "text-red-700", icon: AlertTriangle, label: "Rejected" },
};

export default function WipDetailPage() {
  const params = useParams();
  const router = useRouter();
  const wipId = params.wipId as string;

  const [wip, setWip] = useState<MaterialWIP | null>(null);
  const [loading, setLoading] = useState(true);
  const [materialNames, setMaterialNames] = useState<Record<string, string>>({});
  const [packNames, setPackNames] = useState<Record<string, string>>({});

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
        setMaterialNames(rmMap);
        setPackNames(pkMap);
      })
      .catch(() => toast.error("Failed to load WIP details"))
      .finally(() => setLoading(false));
  }, [wipId]);

  const resolveMaterial = (itemType: string, itemId: string) =>
    itemType === "RawMaterial"
      ? materialNames[itemId] || itemId
      : packNames[itemId] || itemId;

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

  const raw = typeof wip.rawMaterialId === "object" ? wip.rawMaterialId : null;
  const factory = typeof wip.factoryId === "object" ? wip.factoryId : null;
  const s = statusConfig[wip.status] || statusConfig.ACTIVE;
  const StatusIcon = s.icon;
  const isPending = wip.status === "PENDING_APPROVAL";
  const pc = wip.pendingConversion;

  // Extract from pending conversion
  const productionLoss = safeNum(pc?.productionLossQuantity);
  const gain = safeNum(pc?.gainQuantity);
  const normalWastage = safeNum(pc?.normalWastageQuantity);
  const expectedRaw = safeNum(pc?.expectedRawUsed);
  const actualRaw = safeNum(pc?.actualRawUsed);
  const allowedWastage = safeNum(pc?.allowedWastageRawUsed);
  const remainingRaw = safeNum(pc?.remainingRawQuantity);

  // Corrected banner logic (matches produce page)
  const hasGain = gain > EPSILON;
  const hasProductionLoss = productionLoss > EPSILON;
  const hasNormalWastageOnly = !hasGain && !hasProductionLoss && (normalWastage > EPSILON);
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
              onClick={() => router.push("/inventory/material-wip")}
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to List
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                WIP #{wip._id.slice(-8)}
              </h1>
              <p className="text-xs text-gray-500">{raw?.name || "Unknown"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {wip.status === "ACTIVE" && (
              <Button
                onClick={() =>
                  router.push(`/inventory/material-wip/${wip._id}/produce`)
                }
              >
                <Play className="h-4 w-4 mr-1" /> Produce
              </Button>
            )}
            {isPending && (
              <Button
                onClick={() =>
                  router.push(`/inventory/material-wip/${wip._id}/produce`)
                }
              >
                <CheckCircle className="h-4 w-4 mr-1" /> Approve / Reject
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Status banner */}
        <div
          className={cn(
            "p-4 rounded-xl border flex items-center justify-between",
            s.bg
          )}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-white/80">
              <StatusIcon className={cn("h-5 w-5", s.text)} />
            </div>
            <div>
              <h2 className={cn("font-semibold", s.text)}>{s.label}</h2>
              <p className="text-xs opacity-70">
                {wip.date ? format(new Date(wip.date), "dd MMM yyyy") : ""}
              </p>
            </div>
          </div>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-xs text-gray-500">Issued</div>
              <div className="text-lg font-semibold">
                {safeNum(wip.issuedQuantity)} {wip.unit}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-xs text-gray-500">Consumed</div>
              <div className="text-lg font-semibold">
                {safeNum(wip.consumedQuantity)} {wip.unit}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-xs text-gray-500">Remaining</div>
              <div className="text-lg font-semibold">
                {safeNum(wip.remainingQuantity)} {wip.unit}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-xs text-gray-500">Unit Cost</div>
              <div className="text-lg font-semibold">
                {wip.unitCost ? `৳ ${safeTaka(wip.unitCost)}` : "—"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Variance & Warnings – only when pending conversion exists */}
        {pc && (
          <>
            {/* Warning banners (corrected logic) */}
            {hasGain && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-300 text-green-800">
                <BadgeCheck className="h-6 w-6 text-green-600" />
                <div>
                  <div className="font-semibold">GAIN Detected</div>
                  <div className="text-sm">
                    Actual raw usage ({safeFixed3(actualRaw)} {wip.unit}) is
                    less than BOM expected ({safeFixed3(expectedRaw)} {wip.unit}
                    ). You have a gain of {safeFixed3(gain)} {wip.unit}. This
                    material will be returned to stock.
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
                    Actual raw usage ({safeFixed3(actualRaw)} {wip.unit})
                    exceeds BOM expected ({safeFixed3(expectedRaw)} {wip.unit})
                    by {safeFixed3(normalWastage + productionLoss)} {wip.unit}.
                    Allowed wastage: {safeFixed3(allowedWastage)} {wip.unit}.
                    Excess loss: {safeFixed3(productionLoss)} {wip.unit}. Approver
                    review required.
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
                    Actual raw usage ({safeFixed3(actualRaw)} {wip.unit})
                    exceeds BOM expected ({safeFixed3(expectedRaw)} {wip.unit})
                    by {safeFixed3(normalWastage)} {wip.unit}, but it is within
                    the allowed wastage limit ({safeFixed3(allowedWastage)}{" "}
                    {wip.unit}).
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

            {/* Variance numbers */}
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
                    -{safeFixed3(productionLoss)} {wip.unit}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Cost summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-xs text-gray-500">Raw Material Cost</div>
                  <div className="font-semibold">
                    ৳ {safeTaka(pc.rawMaterialCost)}
                  </div>
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
                  <div className="font-semibold">
                    ৳ {safeTaka(pc.totalInputCost)}
                  </div>
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
          </>
        )}

        {/* Material & factory + people */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Raw Material & Factory
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Material</span>
                <span className="font-medium">{raw?.name}</span>
              </div>
              {raw?.sku && (
                <div className="flex justify-between">
                  <span className="text-gray-500">SKU</span>
                  <span>{raw.sku}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Unit</span>
                <span>{wip.unit}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-gray-500">Factory</span>
                <span className="font-medium">{factory?.name}</span>
              </div>
              {factory?.code && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Code</span>
                  <span>{factory.code}</span>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Dates & People
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Created</span>
                <span>
                  {wip.createdAt
                    ? format(new Date(wip.createdAt), "dd MMM yy HH:mm")
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Completed</span>
                <span>
                  {wip.completedAt
                    ? format(new Date(wip.completedAt), "dd MMM yy HH:mm")
                    : "—"}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-gray-500">Created by</span>
                <span>{wip.createdBy?.name || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Approved by</span>
                <span>{wip.approvedBy?.name || "—"}</span>
              </div>
              {wip.approvedAt && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Approved at</span>
                  <span>
                    {format(new Date(wip.approvedAt), "dd MMM yy HH:mm")}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Vouchers */}
        {(wip.startVoucherIds?.length ||
          wip.conversionVoucherId ||
          wip.returnVoucherId) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Linked Vouchers
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
              {wip.startVoucherIds?.map((id, i) => (
                <div key={i} className="bg-blue-50 p-2 rounded">
                  Start: {id}
                </div>
              ))}
              {wip.conversionVoucherId && (
                <div className="bg-green-50 p-2 rounded">
                  Conv: {wip.conversionVoucherId}
                </div>
              )}
              {wip.returnVoucherId && (
                <div className="bg-purple-50 p-2 rounded">
                  Return: {wip.returnVoucherId}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Conversion History */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">
              Conversion History
            </CardTitle>
            <Badge variant="outline">
              {wip.conversions?.length || 0} entries
            </Badge>
          </CardHeader>
          <CardContent>
            {wip.conversions?.length ? (
              <div className="space-y-6">
                {wip.conversions.map((c, idx) => (
                  <div
                    key={idx}
                    className="border rounded-xl p-5 bg-white shadow-sm"
                  >
                    <div className="flex justify-between mb-3">
                      <Badge
                        className={cn(
                          "text-xs",
                          (c.productionLossQuantity ?? 0) > 0
                            ? "bg-red-100 text-red-700"
                            : (c.gainQuantity ?? 0) > 0
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100"
                        )}
                      >
                        {(c.gainQuantity ?? 0) > 0
                          ? "GAIN"
                          : (c.productionLossQuantity ?? 0) > 0
                          ? "LOSS"
                          : "PERFECT"}
                      </Badge>
                      <span className="text-xs text-gray-400">
                        {c.createdAt
                          ? format(new Date(c.createdAt), "dd MMM yy HH:mm")
                          : ""}
                      </span>
                    </div>
                    {c.products?.map((p, i) => (
                      <div
                        key={i}
                        className="bg-gray-50 p-3 rounded border mb-2 text-sm"
                      >
                        <div className="flex justify-between">
                          <span className="font-medium">
                            {typeof p.productId === "object"
                              ? p.productId.name
                              : nameOf(p.productId)}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            x{p.quantityProduced}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600 mt-1">
                          <div>
                            Exp raw: {safeFixed3(p.expectedRawUsed)}
                          </div>
                          <div>
                            Act raw: {safeFixed3(p.actualRawUsed)}
                          </div>
                          <div>
                            Unit cost: ৳ {safeTaka(p.unitCost)}
                          </div>
                          <div>
                            Total: ৳ {safeTaka(p.totalCost)}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mt-2">
                      <div>
                        <span className="text-gray-500">Total Exp Raw:</span>{" "}
                        {safeFixed3(c.expectedRawUsed)}
                      </div>
                      <div>
                        <span className="text-gray-500">Total Act Raw:</span>{" "}
                        {safeFixed3(c.actualRawUsed)}
                      </div>
                      <div>
                        <span className="text-gray-500">Gain:</span>{" "}
                        {safeFixed3(c.gainQuantity)}
                      </div>
                      <div>
                        <span className="text-gray-500">Loss:</span>{" "}
                        {safeFixed3(c.productionLossQuantity)}
                      </div>
                      <div>
                        <span className="text-gray-500">Raw Mat. Cost:</span> ৳{" "}
                        {safeTaka(c.rawMaterialCost)}
                      </div>
                      <div>
                        <span className="text-gray-500">Pack. Cost:</span> ৳{" "}
                        {safeTaka(c.packagingMaterialCost)}
                      </div>
                      <div>
                        <span className="text-gray-500">Input Cost:</span> ৳{" "}
                        {safeTaka(c.totalInputCost)}
                      </div>
                      <div>
                        <span className="text-gray-500">Finished Cost:</span> ৳{" "}
                        {safeTaka(c.totalFinishedGoodsCost)}
                      </div>
                    </div>
                    {(c?.otherMaterialsUsed?.length ?? 0) > 0 && (
                      <div className="mt-3 pt-3 border-t text-xs">
                        <div className="text-gray-500 uppercase font-medium mb-2">
                          Other Materials
                        </div>
                        {c?.otherMaterialsUsed?.map((m, i) => (
                          <div
                            key={i}
                            className="flex justify-between items-center"
                          >
                            <span>
                              {resolveMaterial(m.itemType, m.itemId)}
                            </span>
                            <span>
                              {m.quantity} {safeUnit(m.unit)}
                              {m.totalCost
                                ? ` · ৳ ${safeTaka(m.totalCost)}`
                                : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No conversions recorded.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Conversion */}
        {isPending && pc && (
          <Card className="border-amber-300 bg-amber-50/50">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-amber-800 flex items-center gap-2">
                <Clock className="h-4 w-4" /> Pending Conversion
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-amber-700 text-xs uppercase">
                    Expected Raw
                  </span>
                  <div className="font-medium">
                    {safeFixed3(expectedRaw)} {wip.unit}
                  </div>
                </div>
                <div>
                  <span className="text-amber-700 text-xs uppercase">
                    Actual Raw
                  </span>
                  <div className="font-medium">
                    {safeFixed3(actualRaw)} {wip.unit}
                  </div>
                </div>
                <div>
                  <span className="text-amber-700 text-xs uppercase">
                    Remaining
                  </span>
                  <div className="font-medium">
                    {safeFixed3(remainingRaw)} {wip.unit}
                  </div>
                </div>
                <div>
                  <span className="text-amber-700 text-xs uppercase">
                    Gain / Loss
                  </span>
                  <div className="font-medium">
                    {hasGain
                      ? `+${safeFixed3(gain)}`
                      : hasProductionLoss
                      ? `-${safeFixed3(productionLoss)}`
                      : "0"}{" "}
                    {wip.unit}
                  </div>
                </div>
              </div>

              {pc.products?.map((p, i) => (
                <div
                  key={i}
                  className="bg-white p-3 rounded border border-amber-200 text-sm"
                >
                  <div className="flex justify-between mb-1">
                    <span className="font-medium">
                      {typeof p.productId === "object"
                        ? p.productId.name
                        : nameOf(p.productId)}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      x{p.quantityProduced}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600">
                    <div>
                      Exp raw: {safeFixed3(p.expectedRawUsed)}
                    </div>
                    <div>
                      Act raw: {safeFixed3(p.actualRawUsed)}
                    </div>
                    <div>
                      Unit cost: ৳ {safeTaka(p.unitCost)}
                    </div>
                    <div>
                      Total: ৳ {safeTaka(p.totalCost)}
                    </div>
                  </div>
                </div>
              ))}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-amber-700">Raw Mat. Cost:</span> ৳{" "}
                  {safeTaka(pc.rawMaterialCost)}
                </div>
                <div>
                  <span className="text-amber-700">Pack. Cost:</span> ৳{" "}
                  {safeTaka(pc.packagingMaterialCost)}
                </div>
                <div>
                  <span className="text-amber-700">Input Cost:</span> ৳{" "}
                  {safeTaka(pc.totalInputCost)}
                </div>
                <div>
                  <span className="text-amber-700">Finished Cost:</span> ৳{" "}
                  {safeTaka(pc.totalFinishedGoodsCost)}
                </div>
              </div>

              {(pc?.otherMaterialsUsed?.length ?? 0) > 0 && (
                <div>
                  <span className="text-amber-700 text-xs uppercase mb-2 block">
                    Other Materials (expected)
                  </span>
                  <div className="space-y-1 text-xs">
                    {pc?.otherMaterialsUsed?.map((m, i) => (
                      <div
                        key={i}
                        className="flex justify-between items-center"
                      >
                        <span>
                          {resolveMaterial(m.itemType, m.itemId)}
                        </span>
                        <span>
                          {m.quantity} {safeUnit(m.unit)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button
                className="bg-amber-600 hover:bg-amber-700 text-white"
                onClick={() =>
                  router.push(
                    `/inventory/material-wip/${wip._id}/produce`
                  )
                }
              >
                <CheckCircle className="h-4 w-4 mr-1" /> Go to Approval
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}