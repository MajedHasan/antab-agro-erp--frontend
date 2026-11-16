"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";

import Protected from "@/components/auth/Protected";
import usePermissionCheck from "@/hooks/usePermissionCheck";

/* =========================== Types =========================== */
type MaterialWIP = {
  _id: string;
  factoryId:
    | { _id: string; name: string; code?: string }
    | string;
  rawMaterialId:
    | { _id: string; name: string; sku?: string; unit: string }
    | string;
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

/* =========================== Helpers =========================== */
const safeNum = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const safeTaka = (v: any) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(
    safeNum(v),
  );
const safeFixed3 = (v: any) => safeNum(v).toFixed(3);
const safeUnit = (u: any) =>
  u && u !== "NaN" && u !== "null" && u !== "undefined"
    ? String(u)
    : "—";
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
    bg: "bg-slate-50 dark:bg-slate-800/60",
    text: "text-slate-700 dark:text-slate-300",
    border: "border-slate-200 dark:border-slate-700",
    icon: Play,
    label: "Active",
  },
  PENDING_APPROVAL: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-900/60",
    icon: Clock,
    label: "Pending Approval",
  },
  APPROVED: {
    bg: "bg-[#3aa838]/10 dark:bg-[#3aa838]/15",
    text: "text-[#2f8a2f] dark:text-[#9bdd91]",
    border: "border-[#3aa838]/30 dark:border-[#3aa838]/40",
    icon: CheckCircle,
    label: "Approved",
  },
  REJECTED: {
    bg: "bg-rose-50 dark:bg-rose-950/40",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-200 dark:border-rose-900/60",
    icon: AlertTriangle,
    label: "Rejected",
  },
};

/* =========================== SectionHeader =========================== */
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
    <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-2.5 dark:border-slate-800">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#3aa838]/10 text-[#3aa838] dark:bg-[#3aa838]/15 dark:text-[#9bdd91]">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="text-sm font-semibold text-slate-900 dark:text-white">
          {title}
        </div>
      </div>
      {right}
    </div>
  );
}

/* =========================== Page (Protected) =========================== */
export default function WipDetailPage() {
  return (
    <Protected permissions="materialwip.view">
      <WipDetailPageInner />
    </Protected>
  );
}

/* =========================== Inner =========================== */
function WipDetailPageInner() {
  const params = useParams();
  const router = useRouter();
  const wipId = params.wipId as string;

  const hasAccess = usePermissionCheck();
  const canEdit = hasAccess({ permissions: "materialwip.edit" });

  const [wip, setWip] = useState<MaterialWIP | null>(null);
  const [loading, setLoading] = useState(true);
  const [materialNames, setMaterialNames] = useState<Record<string, string>>(
    {},
  );
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

  /* Loading state */
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50/60 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-[#3aa838]" />
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Loading WIP…
          </span>
        </div>
      </div>
    );
  }

  /* Not-found state */
  if (!wip) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50/60 p-4 dark:bg-slate-950">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
            <Inbox className="h-6 w-6 text-slate-400" />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
            WIP not found
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            This record may have been removed or you may not have access.
          </p>
          <Button
            className="mt-4 h-9 gap-1.5"
            variant="outline"
            onClick={() => router.push("/inventory/material-wip")}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to list
          </Button>
        </div>
      </div>
    );
  }

  const raw = typeof wip.rawMaterialId === "object" ? wip.rawMaterialId : null;
  const factory = typeof wip.factoryId === "object" ? wip.factoryId : null;
  const s = statusConfig[wip.status] || statusConfig.ACTIVE;
  const StatusIcon = s.icon;
  const isPending = wip.status === "PENDING_APPROVAL";
  const pc = wip.pendingConversion;

  /* variance */
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

  /* =========================== Render =========================== */
  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950">
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
                  className="h-8 gap-1.5 border border-white/20 bg-white/10 text-xs text-white hover:bg-white/20"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to list
                </Button>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#3aa838]/25 ring-1 ring-[#3aa838]/40">
                    <FactoryIcon className="h-5 w-5 text-[#7cd67a]" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                      Material WIP
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight tabular-nums">
                      #{wip._id.slice(-8)}
                    </h1>
                  </div>
                  <Badge
                    className={cn(
                      "inline-flex items-center gap-1 border border-white/30 bg-white/15 text-[11px] font-semibold text-white",
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
                  className="h-8 gap-1.5 border border-white/20 bg-white/10 text-xs text-white hover:bg-white/20"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh
                </Button>

                {canEdit && wip.status === "ACTIVE" && (
                  <Button
                    size="sm"
                    onClick={() =>
                      router.push(`/inventory/material-wip/${wip._id}/produce`)
                    }
                    className="h-8 gap-1.5 bg-[#3aa838] text-xs text-white shadow-sm shadow-[#3aa838]/30 hover:bg-[#2f8a2f]"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Produce
                  </Button>
                )}

                {canEdit && isPending && (
                  <Button
                    size="sm"
                    onClick={() =>
                      router.push(`/inventory/material-wip/${wip._id}/produce`)
                    }
                    className="h-8 gap-1.5 bg-amber-600 text-xs text-white shadow-sm shadow-amber-600/30 hover:bg-amber-700"
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    Approve / Reject
                  </Button>
                )}
              </div>
            </div>

            {/* Stat pills */}
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
          {/* Variance banners */}
          {pc && (
            <div className="space-y-2">
              {hasGain && (
                <div className="flex items-start gap-3 rounded-xl border border-[#3aa838]/30 bg-[#3aa838]/5 p-3 text-sm text-[#2f8a2f] dark:border-[#3aa838]/40 dark:bg-[#3aa838]/10 dark:text-[#9bdd91]">
                  <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <div className="font-semibold">GAIN detected</div>
                    <div className="mt-0.5 text-xs">
                      Actual usage ({safeFixed3(actualRaw)} {wip.unit}) is less
                      than BOM expected ({safeFixed3(expectedRaw)} {wip.unit}).
                      Gain:{" "}
                      <b>
                        +{safeFixed3(gain)} {wip.unit}
                      </b>
                      . Returned to stock.
                    </div>
                  </div>
                </div>
              )}
              {hasProductionLoss && (
                <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <div className="font-semibold">
                      Production loss (exceeds allowed wastage)
                    </div>
                    <div className="mt-0.5 text-xs">
                      Actual {safeFixed3(actualRaw)} {wip.unit} vs expected{" "}
                      {safeFixed3(expectedRaw)} {wip.unit}. Allowed wastage:{" "}
                      {safeFixed3(allowedWastage)} {wip.unit}. Excess loss:{" "}
                      <b>
                        -{safeFixed3(productionLoss)} {wip.unit}
                      </b>
                      .
                    </div>
                  </div>
                </div>
              )}
              {hasNormalWastageOnly && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                  <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <div className="font-semibold">
                      Normal wastage (within limit)
                    </div>
                    <div className="mt-0.5 text-xs">
                      Excess of {safeFixed3(normalWastage)} {wip.unit} is
                      within the allowed {safeFixed3(allowedWastage)} {wip.unit}{" "}
                      limit.
                    </div>
                  </div>
                </div>
              )}
              {isPerfect && (
                <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
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

          {/* Variance breakdown */}
          {pc && (
            <Card className="overflow-hidden border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <SectionHeader icon={ShieldAlert} title="Variance breakdown" />
              <CardContent className="grid grid-cols-2 gap-2 p-4 md:grid-cols-6">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Expected
                  </div>
                  <div className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                    {safeFixed3(expectedRaw)} {wip.unit}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Allowed
                  </div>
                  <div className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                    {safeFixed3(allowedWastage)} {wip.unit}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Actual
                  </div>
                  <div className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                    {safeFixed3(actualRaw)} {wip.unit}
                  </div>
                </div>
                <div className="rounded-lg border border-[#3aa838]/30 bg-[#3aa838]/5 px-3 py-2 dark:border-[#3aa838]/40 dark:bg-[#3aa838]/10">
                  <div className="text-[10px] uppercase tracking-wide text-[#2f8a2f] dark:text-[#9bdd91]">
                    Gain
                  </div>
                  <div className="text-sm font-semibold tabular-nums text-[#2f8a2f] dark:text-[#9bdd91]">
                    +{safeFixed3(gain)} {wip.unit}
                  </div>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/60 dark:bg-amber-950/40">
                  <div className="text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-300">
                    Wastage
                  </div>
                  <div className="text-sm font-semibold tabular-nums text-amber-700 dark:text-amber-300">
                    {safeFixed3(normalWastage)} {wip.unit}
                  </div>
                </div>
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 dark:border-rose-900/60 dark:bg-rose-950/40">
                  <div className="text-[10px] uppercase tracking-wide text-rose-700 dark:text-rose-300">
                    Loss
                  </div>
                  <div className="text-sm font-semibold tabular-nums text-rose-700 dark:text-rose-300">
                    -{safeFixed3(productionLoss)} {wip.unit}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cost summary */}
          {pc && (
            <Card className="overflow-hidden border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <SectionHeader icon={Package} title="Cost summary" />
              <CardContent className="grid grid-cols-2 gap-2 p-4 md:grid-cols-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Raw material
                  </div>
                  <div className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                    ৳ {safeTaka(pc.rawMaterialCost)}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Packaging
                  </div>
                  <div className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                    ৳ {safeTaka(pc.packagingMaterialCost)}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Input cost
                  </div>
                  <div className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                    ৳ {safeTaka(pc.totalInputCost)}
                  </div>
                </div>
                <div className="rounded-lg border border-[#3aa838]/30 bg-[#3aa838]/5 px-3 py-2 dark:border-[#3aa838]/40 dark:bg-[#3aa838]/10">
                  <div className="text-[10px] uppercase tracking-wide text-[#2f8a2f] dark:text-[#9bdd91]">
                    Finished cost
                  </div>
                  <div className="text-sm font-bold tabular-nums text-[#2f8a2f] dark:text-[#9bdd91]">
                    ৳ {safeTaka(pc.totalFinishedGoodsCost)}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Material & factory + dates/people */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="overflow-hidden border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <SectionHeader icon={FactoryIcon} title="Material & factory" />
              <CardContent className="space-y-2 p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">
                    Material
                  </span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {raw?.name || "—"}
                  </span>
                </div>
                {raw?.sku && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">
                      SKU
                    </span>
                    <span className="font-mono text-xs text-slate-900 dark:text-white">
                      {raw.sku}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">
                    Unit
                  </span>
                  <span className="text-slate-900 dark:text-white">
                    {wip.unit}
                  </span>
                </div>
                <div className="border-t border-slate-200 pt-2 dark:border-slate-800" />
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">
                    Factory
                  </span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {factory?.name || "—"}
                  </span>
                </div>
                {factory?.code && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">
                      Code
                    </span>
                    <span className="text-slate-900 dark:text-white">
                      {factory.code}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <SectionHeader icon={UserIcon} title="Dates & people" />
              <CardContent className="space-y-2 p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">
                    Created
                  </span>
                  <span className="tabular-nums text-slate-900 dark:text-white">
                    {wip.createdAt
                      ? format(new Date(wip.createdAt), "dd MMM yy HH:mm")
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">
                    Completed
                  </span>
                  <span className="tabular-nums text-slate-900 dark:text-white">
                    {wip.completedAt
                      ? format(new Date(wip.completedAt), "dd MMM yy HH:mm")
                      : "—"}
                  </span>
                </div>
                <div className="border-t border-slate-200 pt-2 dark:border-slate-800" />
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">
                    Created by
                  </span>
                  <span className="text-slate-900 dark:text-white">
                    {wip.createdBy?.name || "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">
                    Approved by
                  </span>
                  <span className="text-slate-900 dark:text-white">
                    {wip.approvedBy?.name || "—"}
                  </span>
                </div>
                {wip.approvedAt && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">
                      Approved at
                    </span>
                    <span className="tabular-nums text-slate-900 dark:text-white">
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
            <Card className="overflow-hidden border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <SectionHeader
                icon={FileText}
                title="Linked vouchers"
                right={
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
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
                    className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10px] font-mono text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300"
                  >
                    <div className="text-[9px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Start
                    </div>
                    <div className="truncate">{id}</div>
                  </div>
                ))}
                {wip.conversionVoucherId && (
                  <div className="rounded-md border border-[#3aa838]/30 bg-[#3aa838]/5 px-2 py-1.5 text-[10px] font-mono text-[#2f8a2f] dark:border-[#3aa838]/40 dark:bg-[#3aa838]/10 dark:text-[#9bdd91]">
                    <div className="text-[9px] uppercase tracking-wide">
                      Conversion
                    </div>
                    <div className="truncate">{wip.conversionVoucherId}</div>
                  </div>
                )}
                {wip.returnVoucherId && (
                  <div className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[10px] font-mono text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                    <div className="text-[9px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Return
                    </div>
                    <div className="truncate">{wip.returnVoucherId}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Conversion history */}
          <Card className="overflow-hidden border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
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
                        ? "bg-[#3aa838]/10 text-[#2f8a2f] border-[#3aa838]/30 dark:bg-[#3aa838]/15 dark:text-[#9bdd91] dark:border-[#3aa838]/40"
                        : kind === "LOSS"
                          ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60"
                          : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";

                    return (
                      <div
                        key={idx}
                        className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/40"
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
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
                            {c.createdAt
                              ? format(
                                  new Date(c.createdAt),
                                  "dd MMM yy HH:mm",
                                )
                              : ""}
                          </span>
                        </div>

                        {/* Products */}
                        <div className="space-y-1.5">
                          {c.products?.map((p, i) => (
                            <div
                              key={i}
                              className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs dark:border-slate-800 dark:bg-slate-900"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-slate-900 dark:text-white">
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
                              <div className="mt-1 grid grid-cols-2 gap-1 text-[10px] text-slate-500 dark:text-slate-400 md:grid-cols-4">
                                <div>Exp: {safeFixed3(p.expectedRawUsed)}</div>
                                <div>Act: {safeFixed3(p.actualRawUsed)}</div>
                                <div>Unit: ৳{safeTaka(p.unitCost)}</div>
                                <div>Total: ৳{safeTaka(p.totalCost)}</div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Summary grid */}
                        <div className="mt-2 grid grid-cols-2 gap-1 border-t border-slate-200 pt-2 text-[10px] dark:border-slate-800 md:grid-cols-4">
                          <div className="text-slate-600 dark:text-slate-400">
                            <span className="text-slate-500 dark:text-slate-400">
                              Exp raw:
                            </span>{" "}
                            {safeFixed3(c.expectedRawUsed)}
                          </div>
                          <div className="text-slate-600 dark:text-slate-400">
                            <span className="text-slate-500 dark:text-slate-400">
                              Act raw:
                            </span>{" "}
                            {safeFixed3(c.actualRawUsed)}
                          </div>
                          <div className="text-slate-600 dark:text-slate-400">
                            <span className="text-slate-500 dark:text-slate-400">
                              Gain:
                            </span>{" "}
                            <span className="text-[#2f8a2f] dark:text-[#9bdd91]">
                              +{safeFixed3(c.gainQuantity)}
                            </span>
                          </div>
                          <div className="text-slate-600 dark:text-slate-400">
                            <span className="text-slate-500 dark:text-slate-400">
                              Loss:
                            </span>{" "}
                            <span className="text-rose-600 dark:text-rose-400">
                              -{safeFixed3(c.productionLossQuantity)}
                            </span>
                          </div>
                          <div className="text-slate-600 dark:text-slate-400">
                            <span className="text-slate-500 dark:text-slate-400">
                              Raw cost:
                            </span>{" "}
                            ৳{safeTaka(c.rawMaterialCost)}
                          </div>
                          <div className="text-slate-600 dark:text-slate-400">
                            <span className="text-slate-500 dark:text-slate-400">
                              Pack cost:
                            </span>{" "}
                            ৳{safeTaka(c.packagingMaterialCost)}
                          </div>
                          <div className="text-slate-600 dark:text-slate-400">
                            <span className="text-slate-500 dark:text-slate-400">
                              Input:
                            </span>{" "}
                            ৳{safeTaka(c.totalInputCost)}
                          </div>
                          <div className="text-slate-600 dark:text-slate-400">
                            <span className="text-slate-500 dark:text-slate-400">
                              Finished:
                            </span>{" "}
                            <span className="font-semibold text-[#2f8a2f] dark:text-[#9bdd91]">
                              ৳{safeTaka(c.totalFinishedGoodsCost)}
                            </span>
                          </div>
                        </div>

                        {/* Other materials */}
                        {(c.otherMaterialsUsed?.length ?? 0) > 0 && (
                          <div className="mt-2 border-t border-slate-200 pt-2 dark:border-slate-800">
                            <div className="mb-1 text-[9px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Other materials
                            </div>
                            <div className="space-y-0.5 text-[10px] text-slate-700 dark:text-slate-300">
                              {c.otherMaterialsUsed?.map((m, i) => (
                                <div key={i} className="flex justify-between">
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
                <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  <Package className="mx-auto mb-2 h-6 w-6 text-slate-300 dark:text-slate-600" />
                  No conversions recorded.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending conversion */}
          {isPending && pc && (
            <Card className="overflow-hidden border-amber-300 bg-amber-50/50 shadow-md ring-2 ring-amber-200 dark:border-amber-900/60 dark:bg-amber-950/20 dark:ring-amber-900/40">
              <SectionHeader
                icon={Clock}
                title="Pending conversion"
                right={
                  canEdit && (
                    <Button
                      size="sm"
                      onClick={() =>
                        router.push(
                          `/inventory/material-wip/${wip._id}/produce`,
                        )
                      }
                      className="h-7 gap-1 bg-amber-600 px-2 text-[11px] text-white hover:bg-amber-700"
                    >
                      <CheckCircle className="h-3 w-3" />
                      Go to approval
                    </Button>
                  )
                }
              />
              <CardContent className="space-y-3 p-4">
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  <div className="rounded-md border border-amber-200 bg-white px-3 py-2 dark:border-amber-900/60 dark:bg-slate-900">
                    <div className="text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-300">
                      Expected
                    </div>
                    <div className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                      {safeFixed3(expectedRaw)} {wip.unit}
                    </div>
                  </div>
                  <div className="rounded-md border border-amber-200 bg-white px-3 py-2 dark:border-amber-900/60 dark:bg-slate-900">
                    <div className="text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-300">
                      Actual
                    </div>
                    <div className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                      {safeFixed3(actualRaw)} {wip.unit}
                    </div>
                  </div>
                  <div className="rounded-md border border-amber-200 bg-white px-3 py-2 dark:border-amber-900/60 dark:bg-slate-900">
                    <div className="text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-300">
                      Remaining
                    </div>
                    <div className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                      {safeFixed3(remainingRaw)} {wip.unit}
                    </div>
                  </div>
                  <div className="rounded-md border border-amber-200 bg-white px-3 py-2 dark:border-amber-900/60 dark:bg-slate-900">
                    <div className="text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-300">
                      Gain / Loss
                    </div>
                    <div className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
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
                      className="rounded-md border border-amber-200 bg-white p-2 text-xs dark:border-amber-900/60 dark:bg-slate-900"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-900 dark:text-white">
                          {typeof p.productId === "object"
                            ? p.productId.name
                            : nameOf(p.productId)}
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          ×{p.quantityProduced}
                        </Badge>
                      </div>
                      <div className="mt-1 grid grid-cols-2 gap-1 text-[10px] text-slate-500 dark:text-slate-400 md:grid-cols-4">
                        <div>Exp: {safeFixed3(p.expectedRawUsed)}</div>
                        <div>Act: {safeFixed3(p.actualRawUsed)}</div>
                        <div>Unit: ৳{safeTaka(p.unitCost)}</div>
                        <div>Total: ৳{safeTaka(p.totalCost)}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 border-t border-amber-200 pt-2 dark:border-amber-900/60 md:grid-cols-4">
                  <div className="text-[10px] text-slate-600 dark:text-slate-400">
                    <span className="text-amber-700 dark:text-amber-300">
                      Raw:
                    </span>{" "}
                    ৳{safeTaka(pc.rawMaterialCost)}
                  </div>
                  <div className="text-[10px] text-slate-600 dark:text-slate-400">
                    <span className="text-amber-700 dark:text-amber-300">
                      Pack:
                    </span>{" "}
                    ৳{safeTaka(pc.packagingMaterialCost)}
                  </div>
                  <div className="text-[10px] text-slate-600 dark:text-slate-400">
                    <span className="text-amber-700 dark:text-amber-300">
                      Input:
                    </span>{" "}
                    ৳{safeTaka(pc.totalInputCost)}
                  </div>
                  <div className="text-[10px] text-slate-600 dark:text-slate-400">
                    <span className="text-amber-700 dark:text-amber-300">
                      Finished:
                    </span>{" "}
                    <span className="font-semibold text-slate-900 dark:text-white">
                      ৳{safeTaka(pc.totalFinishedGoodsCost)}
                    </span>
                  </div>
                </div>

                {(pc.otherMaterialsUsed?.length ?? 0) > 0 && (
                  <div className="border-t border-amber-200 pt-2 dark:border-amber-900/60">
                    <div className="mb-1 text-[9px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
                      Other materials
                    </div>
                    <div className="space-y-0.5 text-[10px] text-slate-700 dark:text-slate-300">
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