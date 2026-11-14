"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Factory as FactoryIcon,
  Package,
  User as UserIcon,
  FileText,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------- types (unchanged) ---------- */
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

/* ---------- helpers (unchanged) ---------- */
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

const statusConfig: Record<
  string,
  { bg: string; text: string; border: string; icon: any; label: string }
> = {
  ACTIVE: {
    bg: "bg-slate-50",
    text: "text-slate-700",
    border: "border-slate-200",
    icon: Play,
    label: "Active",
  },
  PENDING_APPROVAL: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    icon: Clock,
    label: "Pending Approval",
  },
  APPROVED: {
    bg: "bg-[#3aa838]/10",
    text: "text-[#2f8a2f]",
    border: "border-[#3aa838]/30",
    icon: CheckCircle,
    label: "Approved",
  },
  REJECTED: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    icon: AlertTriangle,
    label: "Rejected",
  },
};

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
export default function WipDetailPage() {
  const params = useParams();
  const router = useRouter();
  const wipId = params.wipId as string;

  const [wip, setWip] = useState<MaterialWIP | null>(null);
  const [loading, setLoading] = useState(true);
  const [materialNames, setMaterialNames] = useState<Record<string, string>>({});
  const [packNames, setPackNames] = useState<Record<string, string>>({});

  const load = () => {
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
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wipId]);

  const resolveMaterial = (itemType: string, itemId: string) =>
    itemType === "RawMaterial"
      ? materialNames[itemId] || itemId
      : packNames[itemId] || itemId;

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

  const raw = typeof wip.rawMaterialId === "object" ? wip.rawMaterialId : null;
  const factory = typeof wip.factoryId === "object" ? wip.factoryId : null;
  const s = statusConfig[wip.status] || statusConfig.ACTIVE;
  const StatusIcon = s.icon;
  const isPending = wip.status === "PENDING_APPROVAL";
  const pc = wip.pendingConversion;

  // variance
  const productionLoss = safeNum(pc?.productionLossQuantity);
  const gain = safeNum(pc?.gainQuantity);
  const normalWastage = safeNum(pc?.normalWastageQuantity);
  const expectedRaw = safeNum(pc?.expectedRawUsed);
  const actualRaw = safeNum(pc?.actualRawUsed);
  const allowedWastage = safeNum(pc?.allowedWastageRawUsed);
  const remainingRaw = safeNum(pc?.remainingRawQuantity);

  const hasGain = gain > EPSILON;
  const hasProductionLoss = productionLoss > EPSILON;
  const hasNormalWastageOnly =
    !hasGain && !hasProductionLoss && normalWastage > EPSILON;
  const isPerfect = !hasGain && !hasProductionLoss && !hasNormalWastageOnly;

  /* ---------------- Render ---------------- */
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl p-3 md:p-4">
        {/* ============ HERO ============ */}
        <div className="relative mb-3 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-[#1a4d1a] p-5 text-white shadow-lg">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(58,168,56,0.25),transparent_55%)]" />
          <div className="relative">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => router.push("/inventory/material-wip")}
                  className="border border-white/20 bg-white/10 text-white hover:bg-white/20"
                >
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                  Back to list
                </Button>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#3aa838]/25 ring-1 ring-[#3aa838]/40">
                    <FactoryIcon className="h-5 w-5 text-[#7cd67a]" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-wider text-white/60">
                      Material WIP
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight tabular-nums">
                      #{wip._id.slice(-8)}
                    </h1>
                  </div>
                  <Badge
                    className={cn(
                      "inline-flex items-center gap-1 border text-[11px] font-semibold",
                      "bg-white/15 text-white border-white/30",
                    )}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {s.label}
                  </Badge>
                </div>

                <div className="mt-2 text-sm text-white/70">
                  <span className="font-medium text-white">
                    {raw?.name || "Unknown material"}
                  </span>
                  {wip.date && (
                    <> · {format(new Date(wip.date), "dd MMM yyyy")}</>
                  )}
                  {factory?.name && <> · {factory.name}</>}
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={load}
                  className="border border-white/20 bg-white/10 text-white hover:bg-white/20"
                >
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Refresh
                </Button>

                {wip.status === "ACTIVE" && (
                  <Button
                    size="sm"
                    onClick={() =>
                      router.push(`/inventory/material-wip/${wip._id}/produce`)
                    }
                    className="bg-[#3aa838] text-white hover:bg-[#2f8a2f]"
                  >
                    <Play className="mr-1.5 h-3.5 w-3.5" />
                    Produce
                  </Button>
                )}

                {isPending && (
                  <Button
                    size="sm"
                    onClick={() =>
                      router.push(`/inventory/material-wip/${wip._id}/produce`)
                    }
                    className="bg-amber-600 text-white hover:bg-amber-700"
                  >
                    <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                    Approve / Reject
                  </Button>
                )}
              </div>
            </div>

            {/* Inline stat pills */}
            <div className="mt-4 flex flex-wrap gap-2">
              <div className="rounded-lg bg-white/10 px-3 py-2 ring-1 ring-white/15">
                <div className="text-[10px] uppercase tracking-wide text-white/60">
                  Issued
                </div>
                <div className="text-sm font-semibold tabular-nums">
                  {safeNum(wip.issuedQuantity).toFixed(2)} {wip.unit}
                </div>
              </div>
              <div className="rounded-lg bg-white/10 px-3 py-2 ring-1 ring-white/15">
                <div className="text-[10px] uppercase tracking-wide text-white/60">
                  Consumed
                </div>
                <div className="text-sm font-semibold tabular-nums">
                  {safeNum(wip.consumedQuantity).toFixed(2)} {wip.unit}
                </div>
              </div>
              <div className="rounded-lg bg-white/10 px-3 py-2 ring-1 ring-white/15">
                <div className="text-[10px] uppercase tracking-wide text-white/60">
                  Remaining
                </div>
                <div className="text-sm font-semibold tabular-nums">
                  {safeNum(wip.remainingQuantity).toFixed(2)} {wip.unit}
                </div>
              </div>
              <div className="rounded-lg bg-[#3aa838] px-3 py-2 shadow-md shadow-black/40">
                <div className="text-[10px] uppercase tracking-wide text-[#c6e8c5]">
                  Unit cost
                </div>
                <div className="text-sm font-bold tabular-nums">
                  {wip.unitCost ? `৳ ${safeTaka(wip.unitCost)}` : "—"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ============ BODY ============ */}
        <div className="space-y-4">
          {/* Variance banners (only when pending) */}
          {pc && (
            <div className="space-y-2">
              {hasGain && (
                <div className="flex items-start gap-3 rounded-xl border border-[#3aa838]/30 bg-[#3aa838]/5 p-3 text-sm text-[#2f8a2f]">
                  <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <div className="font-semibold">GAIN detected</div>
                    <div className="mt-0.5 text-xs">
                      Actual usage ({safeFixed3(actualRaw)} {wip.unit}) is less
                      than BOM expected ({safeFixed3(expectedRaw)} {wip.unit}).
                      Gain: <b>+{safeFixed3(gain)} {wip.unit}</b>. Returned to
                      stock.
                    </div>
                  </div>
                </div>
              )}
              {hasProductionLoss && (
                <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <div className="font-semibold">
                      Production loss (exceeds allowed wastage)
                    </div>
                    <div className="mt-0.5 text-xs">
                      Actual {safeFixed3(actualRaw)} {wip.unit} vs expected{" "}
                      {safeFixed3(expectedRaw)} {wip.unit}. Allowed wastage:{" "}
                      {safeFixed3(allowedWastage)} {wip.unit}. Excess loss:{" "}
                      <b>-{safeFixed3(productionLoss)} {wip.unit}</b>.
                    </div>
                  </div>
                </div>
              )}
              {hasNormalWastageOnly && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
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
                <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  <Info className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <div className="font-semibold">Perfect usage</div>
                    <div className="mt-0.5 text-xs">
                      Actual usage matches BOM expected ({safeFixed3(expectedRaw)}{" "}
                      {wip.unit}).
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Variance numbers (only when pending) */}
          {pc && (
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <SectionHeader icon={ShieldAlert} title="Variance breakdown" />
              <CardContent className="grid grid-cols-2 gap-2 p-4 md:grid-cols-6">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Expected
                  </div>
                  <div className="text-sm font-semibold tabular-nums">
                    {safeFixed3(expectedRaw)} {wip.unit}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Allowed
                  </div>
                  <div className="text-sm font-semibold tabular-nums">
                    {safeFixed3(allowedWastage)} {wip.unit}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Actual
                  </div>
                  <div className="text-sm font-semibold tabular-nums">
                    {safeFixed3(actualRaw)} {wip.unit}
                  </div>
                </div>
                <div className="rounded-lg border border-[#3aa838]/30 bg-[#3aa838]/5 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-[#2f8a2f]">
                    Gain
                  </div>
                  <div className="text-sm font-semibold tabular-nums text-[#2f8a2f]">
                    +{safeFixed3(gain)} {wip.unit}
                  </div>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-amber-700">
                    Wastage
                  </div>
                  <div className="text-sm font-semibold tabular-nums text-amber-700">
                    {safeFixed3(normalWastage)} {wip.unit}
                  </div>
                </div>
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-rose-700">
                    Loss
                  </div>
                  <div className="text-sm font-semibold tabular-nums text-rose-700">
                    -{safeFixed3(productionLoss)} {wip.unit}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cost summary */}
          {pc && (
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <SectionHeader icon={Package} title="Cost summary" />
              <CardContent className="grid grid-cols-2 gap-2 p-4 md:grid-cols-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Raw material
                  </div>
                  <div className="text-sm font-semibold tabular-nums text-slate-900">
                    ৳ {safeTaka(pc.rawMaterialCost)}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Packaging
                  </div>
                  <div className="text-sm font-semibold tabular-nums text-slate-900">
                    ৳ {safeTaka(pc.packagingMaterialCost)}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Input cost
                  </div>
                  <div className="text-sm font-semibold tabular-nums text-slate-900">
                    ৳ {safeTaka(pc.totalInputCost)}
                  </div>
                </div>
                <div className="rounded-lg border border-[#3aa838]/30 bg-[#3aa838]/5 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-[#2f8a2f]">
                    Finished cost
                  </div>
                  <div className="text-sm font-bold tabular-nums text-[#2f8a2f]">
                    ৳ {safeTaka(pc.totalFinishedGoodsCost)}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Material & factory + dates/people */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <SectionHeader icon={FactoryIcon} title="Material & factory" />
              <CardContent className="space-y-2 p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Material</span>
                  <span className="font-medium">{raw?.name || "—"}</span>
                </div>
                {raw?.sku && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">SKU</span>
                    <span className="font-mono text-xs">{raw.sku}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Unit</span>
                  <span>{wip.unit}</span>
                </div>
                <div className="border-t border-slate-200 pt-2" />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Factory</span>
                  <span className="font-medium">{factory?.name || "—"}</span>
                </div>
                {factory?.code && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Code</span>
                    <span>{factory.code}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <SectionHeader icon={UserIcon} title="Dates & people" />
              <CardContent className="space-y-2 p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span className="tabular-nums">
                    {wip.createdAt
                      ? format(new Date(wip.createdAt), "dd MMM yy HH:mm")
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Completed</span>
                  <span className="tabular-nums">
                    {wip.completedAt
                      ? format(new Date(wip.completedAt), "dd MMM yy HH:mm")
                      : "—"}
                  </span>
                </div>
                <div className="border-t border-slate-200 pt-2" />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created by</span>
                  <span>{wip.createdBy?.name || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Approved by</span>
                  <span>{wip.approvedBy?.name || "—"}</span>
                </div>
                {wip.approvedAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Approved at</span>
                    <span className="tabular-nums">
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
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <SectionHeader
                icon={FileText}
                title="Linked vouchers"
                right={
                  <span className="text-[10px] text-muted-foreground">
                    {[
                      ...(wip.startVoucherIds || []),
                      wip.conversionVoucherId,
                      wip.returnVoucherId,
                    ].filter(Boolean).length}{" "}
                    linked
                  </span>
                }
              />
              <CardContent className="grid grid-cols-1 gap-2 p-4 md:grid-cols-3">
                {wip.startVoucherIds?.map((id, i) => (
                  <div
                    key={`s${i}`}
                    className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10px] font-mono text-slate-700"
                  >
                    <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
                      Start
                    </div>
                    <div className="truncate">{id}</div>
                  </div>
                ))}
                {wip.conversionVoucherId && (
                  <div className="rounded-md border border-[#3aa838]/30 bg-[#3aa838]/5 px-2 py-1.5 text-[10px] font-mono text-[#2f8a2f]">
                    <div className="text-[9px] uppercase tracking-wide">
                      Conversion
                    </div>
                    <div className="truncate">{wip.conversionVoucherId}</div>
                  </div>
                )}
                {wip.returnVoucherId && (
                  <div className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[10px] font-mono text-slate-700">
                    <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
                      Return
                    </div>
                    <div className="truncate">{wip.returnVoucherId}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Conversion history */}
          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <SectionHeader
              icon={CheckCircle}
              title="Conversion history"
              right={
                <Badge variant="outline" className="text-[10px]">
                  {wip.conversions?.length || 0} entries
                </Badge>
              }
            />
            <CardContent className="p-4">
              {wip.conversions?.length ? (
                <div className="space-y-3">
                  {wip.conversions.map((c, idx) => {
                    const cGain = safeNum(c.gainQuantity);
                    const cLoss = safeNum(c.productionLossQuantity);
                    const kind =
                      cGain > EPSILON
                        ? "GAIN"
                        : cLoss > EPSILON
                          ? "LOSS"
                          : "PERFECT";
                    const kindCls =
                      kind === "GAIN"
                        ? "bg-[#3aa838]/10 text-[#2f8a2f] border-[#3aa838]/30"
                        : kind === "LOSS"
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : "bg-slate-100 text-slate-700 border-slate-200";

                    return (
                      <div
                        key={idx}
                        className="rounded-lg border border-slate-200 bg-white p-3"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <Badge
                            className={cn(
                              "border text-[10px] font-semibold",
                              kindCls,
                            )}
                          >
                            {kind}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {c.createdAt
                              ? format(
                                  new Date(c.createdAt),
                                  "dd MMM yy HH:mm",
                                )
                              : ""}
                          </span>
                        </div>

                        {/* Products grid */}
                        <div className="space-y-1.5">
                          {c.products?.map((p, i) => (
                            <div
                              key={i}
                              className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">
                                  {typeof p.productId === "object"
                                    ? p.productId.name
                                    : nameOf(p.productId)}
                                </span>
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] tabular-nums"
                                >
                                  ×{p.quantityProduced}
                                </Badge>
                              </div>
                              <div className="mt-1 grid grid-cols-2 gap-1 text-[10px] text-muted-foreground md:grid-cols-4">
                                <div>Exp: {safeFixed3(p.expectedRawUsed)}</div>
                                <div>Act: {safeFixed3(p.actualRawUsed)}</div>
                                <div>Unit: ৳{safeTaka(p.unitCost)}</div>
                                <div>Total: ৳{safeTaka(p.totalCost)}</div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Summary grid */}
                        <div className="mt-2 grid grid-cols-2 gap-1 border-t border-slate-200 pt-2 text-[10px] md:grid-cols-4">
                          <div>
                            <span className="text-muted-foreground">
                              Exp raw:
                            </span>{" "}
                            {safeFixed3(c.expectedRawUsed)}
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Act raw:
                            </span>{" "}
                            {safeFixed3(c.actualRawUsed)}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Gain:</span>{" "}
                            <span className="text-[#2f8a2f]">
                              +{safeFixed3(c.gainQuantity)}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Loss:</span>{" "}
                            <span className="text-rose-600">
                              -{safeFixed3(c.productionLossQuantity)}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Raw cost:
                            </span>{" "}
                            ৳{safeTaka(c.rawMaterialCost)}
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Pack cost:
                            </span>{" "}
                            ৳{safeTaka(c.packagingMaterialCost)}
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Input:
                            </span>{" "}
                            ৳{safeTaka(c.totalInputCost)}
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Finished:
                            </span>{" "}
                            <span className="font-semibold text-[#2f8a2f]">
                              ৳{safeTaka(c.totalFinishedGoodsCost)}
                            </span>
                          </div>
                        </div>

                        {/* Other materials */}
                        {(c.otherMaterialsUsed?.length ?? 0) > 0 && (
                          <div className="mt-2 border-t border-slate-200 pt-2">
                            <div className="mb-1 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                              Other materials
                            </div>
                            <div className="space-y-0.5 text-[10px]">
                              {c.otherMaterialsUsed?.map((m, i) => (
                                <div
                                  key={i}
                                  className="flex justify-between"
                                >
                                  <span>
                                    {resolveMaterial(m.itemType, m.itemId)}
                                  </span>
                                  <span>
                                    {m.quantity} {safeUnit(m.unit)}
                                    {m.totalCost
                                      ? ` · ৳${safeTaka(m.totalCost)}`
                                      : ""}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No conversions recorded.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending conversion */}
          {isPending && pc && (
            <Card className="overflow-hidden border-amber-300 bg-amber-50/50 shadow-md ring-2 ring-amber-200">
              <SectionHeader
                icon={Clock}
                title="Pending conversion"
                right={
                  <Button
                    size="sm"
                    onClick={() =>
                      router.push(`/inventory/material-wip/${wip._id}/produce`)
                    }
                    className="h-7 bg-amber-600 text-[11px] text-white hover:bg-amber-700"
                  >
                    <CheckCircle className="mr-1 h-3 w-3" />
                    Go to approval
                  </Button>
                }
              />
              <CardContent className="space-y-3 p-4">
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  <div className="rounded-md border border-amber-200 bg-white px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-amber-700">
                      Expected
                    </div>
                    <div className="text-sm font-semibold tabular-nums">
                      {safeFixed3(expectedRaw)} {wip.unit}
                    </div>
                  </div>
                  <div className="rounded-md border border-amber-200 bg-white px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-amber-700">
                      Actual
                    </div>
                    <div className="text-sm font-semibold tabular-nums">
                      {safeFixed3(actualRaw)} {wip.unit}
                    </div>
                  </div>
                  <div className="rounded-md border border-amber-200 bg-white px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-amber-700">
                      Remaining
                    </div>
                    <div className="text-sm font-semibold tabular-nums">
                      {safeFixed3(remainingRaw)} {wip.unit}
                    </div>
                  </div>
                  <div className="rounded-md border border-amber-200 bg-white px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-amber-700">
                      Gain / Loss
                    </div>
                    <div className="text-sm font-semibold tabular-nums">
                      {hasGain
                        ? `+${safeFixed3(gain)}`
                        : hasProductionLoss
                          ? `-${safeFixed3(productionLoss)}`
                          : "0"}{" "}
                      {wip.unit}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {pc.products?.map((p, i) => (
                    <div
                      key={i}
                      className="rounded-md border border-amber-200 bg-white p-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {typeof p.productId === "object"
                            ? p.productId.name
                            : nameOf(p.productId)}
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          ×{p.quantityProduced}
                        </Badge>
                      </div>
                      <div className="mt-1 grid grid-cols-2 gap-1 text-[10px] text-muted-foreground md:grid-cols-4">
                        <div>Exp: {safeFixed3(p.expectedRawUsed)}</div>
                        <div>Act: {safeFixed3(p.actualRawUsed)}</div>
                        <div>Unit: ৳{safeTaka(p.unitCost)}</div>
                        <div>Total: ৳{safeTaka(p.totalCost)}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 border-t border-amber-200 pt-2 md:grid-cols-4">
                  <div className="text-[10px]">
                    <span className="text-amber-700">Raw:</span> ৳
                    {safeTaka(pc.rawMaterialCost)}
                  </div>
                  <div className="text-[10px]">
                    <span className="text-amber-700">Pack:</span> ৳
                    {safeTaka(pc.packagingMaterialCost)}
                  </div>
                  <div className="text-[10px]">
                    <span className="text-amber-700">Input:</span> ৳
                    {safeTaka(pc.totalInputCost)}
                  </div>
                  <div className="text-[10px]">
                    <span className="text-amber-700">Finished:</span>{" "}
                    <span className="font-semibold">৳{safeTaka(pc.totalFinishedGoodsCost)}</span>
                  </div>
                </div>

                {(pc.otherMaterialsUsed?.length ?? 0) > 0 && (
                  <div className="border-t border-amber-200 pt-2">
                    <div className="mb-1 text-[9px] font-medium uppercase tracking-wide text-amber-700">
                      Other materials
                    </div>
                    <div className="space-y-0.5 text-[10px]">
                      {pc.otherMaterialsUsed?.map((m, i) => (
                        <div key={i} className="flex justify-between">
                          <span>{resolveMaterial(m.itemType, m.itemId)}</span>
                          <span>
                            {m.quantity} {safeUnit(m.unit)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}