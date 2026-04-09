"use client";

import React, { memo, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import PrintWorkOrderInvoice from "./PrintWorkOrderInvoice";
import {
  fmtDate,
  fmtMoney,
  itemName,
  safeAddress,
  safeName,
  statusClassMap,
  text,
  type WorkOrderView,
} from "./workOrderShared";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Clock3,
  FileText,
  MapPinned,
  X,
  Truck,
  UserRound,
  ClipboardList,
  Coins,
} from "lucide-react";
import PrintWorkOrderInvoiceV2 from "./PrintWorkOrderInvoiceV2";
import Logo from "/images/logo-green.png";
import PrintWorkOrderInvoiceV3 from "./PrintWorkOrderInvoiceV3";

type Props = {
  viewing: WorkOrderView | null;
  setViewing: React.Dispatch<React.SetStateAction<WorkOrderView | null>>;
};

const FLOW = [
  { key: "Pending", label: "Pending", icon: Clock3 },
  { key: "Processing", label: "Processing", icon: CircleDashed },
  { key: "UnderReview", label: "Review", icon: AlertTriangle },
  { key: "Approved", label: "Approved", icon: CheckCircle2 },
  { key: "Completed", label: "Completed", icon: CheckCircle2 },
] as const;

function getWorkflowIndex(status?: string) {
  if (!status) return -1;
  return FLOW.findIndex((s) => s.key === status);
}

function getNextStage(status?: string) {
  switch (status) {
    case "Pending":
      return "Processing";
    case "Processing":
      return "UnderReview";
    case "UnderReview":
      return "Approved";
    case "Approved":
      return "Completed";
    default:
      return null;
  }
}

function getStatusMeta(status?: string) {
  switch (status) {
    case "Pending":
      return {
        label: "Pending",
        icon: Clock3,
        shell:
          "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200",
        dot: "bg-amber-500",
      };
    case "Processing":
      return {
        label: "Processing",
        icon: CircleDashed,
        shell:
          "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200",
        dot: "bg-sky-500",
      };
    case "UnderReview":
      return {
        label: "Under Review",
        icon: AlertTriangle,
        shell:
          "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-200",
        dot: "bg-violet-500",
      };
    case "Approved":
      return {
        label: "Approved",
        icon: CheckCircle2,
        shell:
          "border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-200",
        dot: "bg-indigo-500",
      };
    case "Completed":
      return {
        label: "Completed",
        icon: CheckCircle2,
        shell:
          "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200",
        dot: "bg-emerald-500",
      };
    case "Cancelled":
      return {
        label: "Cancelled",
        icon: X,
        shell:
          "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200",
        dot: "bg-rose-500",
      };
    default:
      return {
        label: status || "-",
        icon: Clock3,
        shell:
          "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200",
        dot: "bg-slate-400",
      };
  }
}

const Badge = memo(function Badge({ status }: { status?: string }) {
  if (!status) return <span className="text-sm text-muted-foreground">-</span>;
  const meta = getStatusMeta(status);
  const Icon = meta.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${meta.shell}`}
    >
      <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  );
});

const SectionCard = memo(function SectionCard({
  title,
  icon: Icon,
  children,
  className = "",
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-3xl border bg-white shadow-sm ${className}`}>
      <div className="border-b px-5 py-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          <Icon className="h-4 w-4" />
          {title}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
});

const Field = memo(function Field({
  label,
  value,
}: {
  label: string;
  value?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-muted/30 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1.5 text-sm font-medium leading-6 text-foreground">
        {value || "-"}
      </div>
    </div>
  );
});

const WorkflowStrip = memo(function WorkflowStrip({
  status,
}: {
  status?: string;
}) {
  const currentIndex = getWorkflowIndex(status);
  const nextStage = getNextStage(status);
  const cancelled = status === "Cancelled";
  const meta = getStatusMeta(status);
  const StepIcon = meta.icon;

  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Workflow System
          </div>
          <h4 className="mt-1 text-lg font-semibold text-foreground">
            Stage-by-stage progress
          </h4>
          <p className="mt-1 text-sm text-muted-foreground">
            Completed stages glow green, the active stage is highlighted, and
            the next step is shown clearly.
          </p>
        </div>

        <div className={`rounded-2xl border px-4 py-3 ${meta.shell}`}>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] opacity-80">
            <StepIcon className="h-4 w-4" />
            Current Stage
          </div>
          <div className="mt-1 text-sm font-semibold">{meta.label}</div>
          <div className="mt-1 text-xs opacity-80">
            Next: {nextStage || "No further step"}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-5 gap-2">
            {FLOW.map((step, idx) => {
              const active = !cancelled && idx <= currentIndex;
              const current = !cancelled && idx === currentIndex;
              const Icon = step.icon;

              return (
                <div
                  key={step.key}
                  className="flex flex-col items-center gap-2"
                >
                  <div
                    className={[
                      "flex h-11 w-11 items-center justify-center rounded-full border text-[11px] font-semibold transition-all",
                      active
                        ? current
                          ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                          : "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                        : "border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500",
                    ].join(" ")}
                  >
                    <Icon className="h-4 w-4" />
                  </div>

                  {idx < FLOW.length - 1 && (
                    <div
                      className={[
                        "h-1 w-full rounded-full",
                        !cancelled && idx < currentIndex
                          ? "bg-emerald-400"
                          : "bg-slate-200 dark:bg-slate-800",
                      ].join(" ")}
                    />
                  )}

                  <span
                    className={[
                      "text-center text-[10px] leading-tight",
                      active
                        ? "font-semibold text-slate-700 dark:text-slate-200"
                        : "text-slate-400 dark:text-slate-500",
                    ].join(" ")}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {cancelled && (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
          This work order is cancelled, so the workflow is locked.
        </div>
      )}
    </div>
  );
});

const WorkOrderViewDialog = ({ viewing, setViewing }: Props) => {
  const items = useMemo(() => viewing?.items || [], [viewing?.items]);

  const totals = useMemo(
    () => ({
      subTotal: viewing?.subTotal ?? 0,
      discountAmount: viewing?.discountAmount ?? 0,
      taxTotal: viewing?.taxTotal ?? 0,
      grandTotal: viewing?.grandTotal ?? 0,
    }),
    [
      viewing?.subTotal,
      viewing?.discountAmount,
      viewing?.taxTotal,
      viewing?.grandTotal,
    ],
  );

  const supplierPhone =
    typeof viewing?.supplier !== "string"
      ? viewing?.supplier?.phoneNumber || "-"
      : "-";

  const supplierEmail =
    typeof viewing?.supplier !== "string"
      ? viewing?.supplier?.email || "-"
      : "-";

  const docFields = [
    { label: "Work Order No.", value: viewing?.workOrderNo },
    { label: "Status", value: <Badge status={viewing?.status} /> },
    { label: "Issue Date", value: fmtDate(viewing?.issueDate) },
    {
      label: "Expected Delivery",
      value: fmtDate(viewing?.expectedDeliveryDate),
    },
    { label: "Reference", value: viewing?.reference },
  ];

  const partyCards = [
    {
      title: "Supplier",
      icon: Truck,
      body: (
        <>
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-sm font-semibold text-foreground">
              {safeName(viewing?.supplier)}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {safeAddress(viewing?.supplier)}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 mt-3">
            <Field label="Phone" value={supplierPhone} />
            <Field label="Email" value={supplierEmail} />
          </div>
        </>
      ),
    },
    {
      title: "Factory",
      icon: MapPinned,
      body: (
        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="text-sm font-semibold text-foreground">
            {safeName(viewing?.warehouseOrFactory)}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {safeAddress(viewing?.warehouseOrFactory)}
          </div>
        </div>
      ),
    },
  ];

  const signatureBoxes = [
    ["Prepared By", text(viewing?.createdBy)],
    ["Approved By", text(viewing?.approvedBy)],
    ["Chairman", "-"],
  ] as const;

  return (
    <Dialog
      open={Boolean(viewing)}
      onOpenChange={(open) => {
        if (!open) setViewing(null);
      }}
    >
      <DialogContent className="!w-full !max-w-[98vw] h-[95vh] overflow-hidden p-0 rounded-[28px] border bg-slate-50 shadow-2xl flex flex-col">
        {viewing && (
          <>
            <div className="border-b bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 px-5 py-4 text-white md:px-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.25em] text-slate-300">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      Work Order / Quotation
                    </span>
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-emerald-200">
                      Live View
                    </span>
                  </div>

                  <div>
                    <h3 className="text-2xl font-bold tracking-tight md:text-3xl">
                      {viewing.workOrderNo || "Work Order"}
                    </h3>
                    <p className="mt-1 max-w-3xl text-sm text-slate-300">
                      {viewing.subject || "No subject"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <PrintWorkOrderInvoice viewing={viewing} />
                  <PrintWorkOrderInvoiceV2 viewing={viewing} />
                  <PrintWorkOrderInvoiceV3 viewing={viewing} />
                  <Button
                    variant="secondary"
                    onClick={() => setViewing(null)}
                    className="bg-white text-slate-900 hover:bg-slate-100"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-slate-50/80 p-4 md:p-6">
              <div className="mx-auto max-w-[1600px] space-y-5">
                <div className="rounded-3xl border bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Overview
                      </div>
                      <div className="mt-1 text-lg font-semibold text-foreground">
                        {viewing.workOrderNo || "Work Order"}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {viewing.subject || "No subject"}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[520px]">
                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Current Status
                        </div>
                        <div className="mt-2">
                          <Badge status={viewing.status} />
                        </div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Next Step
                        </div>
                        <div className="mt-2 text-sm font-semibold text-foreground">
                          {getNextStage(viewing.status) || "Completed"}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Grand Total
                        </div>
                        <div className="mt-2 text-sm font-semibold text-foreground">
                          {fmtMoney(totals.grandTotal)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1.2fr_0.9fr_0.9fr]">
                  <SectionCard title="Document Overview" icon={FileText}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {docFields.map((field) => (
                        <Field
                          key={field.label}
                          label={field.label}
                          value={field.value}
                        />
                      ))}
                    </div>
                  </SectionCard>

                  {partyCards.map((card) => (
                    <SectionCard
                      key={card.title}
                      title={card.title}
                      icon={card.icon}
                    >
                      {card.body}
                    </SectionCard>
                  ))}
                </div>

                <WorkflowStrip status={viewing.status} />

                <div className="grid gap-5 xl:grid-cols-[1.4fr_0.9fr]">
                  <SectionCard title="Items" icon={ClipboardList}>
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <p className="text-sm text-muted-foreground">
                        {items.length} item{items.length === 1 ? "" : "s"} in
                        this work order
                      </p>
                      <div className="rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
                        Horizontal scroll available
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border">
                      <table className="w-full min-w-[900px] border-collapse text-sm">
                        <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600">
                          <tr className="text-left">
                            <th className="border-b px-4 py-3">#</th>
                            <th className="border-b px-4 py-3">Item</th>
                            <th className="border-b px-4 py-3">Description</th>
                            <th className="border-b px-4 py-3 text-right">
                              Qty
                            </th>
                            <th className="border-b px-4 py-3 text-right">
                              Received
                            </th>
                            <th className="border-b px-4 py-3 text-right">
                              Unit
                            </th>
                            <th className="border-b px-4 py-3 text-right">
                              Unit Price
                            </th>
                            <th className="border-b px-4 py-3 text-right">
                              Line Total
                            </th>
                            <th className="border-b px-4 py-3 text-right">
                              Remarks
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.length === 0 ? (
                            <tr>
                              <td
                                colSpan={8}
                                className="px-4 py-10 text-center text-muted-foreground"
                              >
                                No items found.
                              </td>
                            </tr>
                          ) : (
                            items.map((it, idx) => (
                              <tr
                                key={it._id || idx}
                                className="border-b transition-colors hover:bg-slate-50/70"
                              >
                                <td className="px-4 py-3 align-top font-medium">
                                  {idx + 1}
                                </td>
                                <td className="px-4 py-3 align-top font-medium text-foreground">
                                  {itemName(it)}
                                  <div className="mt-1 text-xs text-muted-foreground">
                                    {it.itemType || "-"}
                                  </div>
                                </td>
                                <td className="px-4 py-3 align-top text-muted-foreground">
                                  {it.description || "-"}
                                </td>
                                <td className="px-4 py-3 align-top text-right">
                                  {it.quantity ?? 0}
                                </td>
                                <td className="px-4 py-3 align-top text-right">
                                  {it.receivedQty ?? 0}
                                </td>
                                <td className="px-4 py-3 align-top text-right">
                                  {it.unit || "-"}
                                </td>
                                <td className="px-4 py-3 align-top text-right">
                                  {fmtMoney(it.unitPrice)}
                                </td>
                                <td className="px-4 py-3 align-top text-right font-semibold">
                                  {fmtMoney(it.lineTotal)}
                                </td>
                                <td className="px-4 py-3 align-top text-right">
                                  {it.remarks}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </SectionCard>

                  <div className="space-y-5">
                    <SectionCard title="Financial Summary" icon={Coins}>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                          <span className="text-sm text-muted-foreground">
                            Subtotal
                          </span>
                          <span className="font-semibold">
                            {fmtMoney(totals.subTotal)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                          <span className="text-sm text-muted-foreground">
                            Discount ({viewing.discountPercent ?? 0}%)
                          </span>
                          <span className="font-semibold text-rose-600">
                            - {fmtMoney(totals.discountAmount)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                          <span className="text-sm text-muted-foreground">
                            Tax ({viewing.taxPercent ?? 0}%)
                          </span>
                          <span className="font-semibold">
                            {fmtMoney(totals.taxTotal)}
                          </span>
                        </div>

                        <div className="rounded-2xl bg-gradient-to-r from-slate-950 to-slate-800 px-4 py-4 text-white">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                              Grand Total
                            </span>
                            <span className="text-2xl font-bold">
                              {fmtMoney(totals.grandTotal)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </SectionCard>

                    <SectionCard title="Notes & Terms" icon={FileText}>
                      <div className="space-y-4">
                        <div>
                          <div className="mb-2 text-sm font-medium">
                            Terms & Conditions
                          </div>
                          <div className="whitespace-pre-wrap rounded-2xl border bg-slate-50 p-4 text-sm leading-6">
                            {viewing.terms || "-"}
                          </div>
                        </div>

                        <div>
                          <div className="mb-2 text-sm font-medium">Notes</div>
                          <div className="whitespace-pre-wrap rounded-2xl border bg-slate-50 p-4 text-sm leading-6">
                            {viewing.notes || "-"}
                          </div>
                        </div>

                        {viewing.cancelReason ? (
                          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                            <div className="mb-1 font-semibold">
                              Cancel Reason
                            </div>
                            {viewing.cancelReason}
                          </div>
                        ) : null}
                      </div>
                    </SectionCard>

                    <SectionCard title="Approvals" icon={UserRound}>
                      <div className="grid gap-3 sm:grid-cols-3">
                        {signatureBoxes.map(([label, value]) => (
                          <div key={label} className="text-center">
                            <div className="h-16 rounded-t-2xl border border-b-0 bg-slate-50" />
                            <div className="rounded-b-2xl border bg-white px-3 py-3">
                              <div className="text-sm font-medium">{label}</div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {value}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {viewing.footerNote ? (
                        <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                          {viewing.footerNote}
                        </div>
                      ) : null}
                    </SectionCard>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default memo(WorkOrderViewDialog);
