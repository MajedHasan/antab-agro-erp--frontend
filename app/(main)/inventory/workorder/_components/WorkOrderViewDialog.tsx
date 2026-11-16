"use client";

import React, { memo, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import PrintWorkOrderInvoice from "./PrintWorkOrderInvoice";
import PrintWorkOrderInvoiceV3 from "./PrintWorkOrderInvoiceV3";
import GlobalPrintButton from "@/components/common/print/GlobalPrintButton";
import {
  buildWorkOrderContentHtml,
  esc,
  fmtDate,
  fmtMoney,
  itemName,
  safeAddress,
  safeName,
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

function s(v: unknown, fb = "-"): string {
  if (v == null) return fb;
  if (typeof v === "string") return v || fb;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return fb;
}

/* ✅ FIX: removed `+ 1` — Pending was showing as completed */
function getWorkflowIndex(status?: string) {
  if (!status) return -1;
  return FLOW.findIndex((s2) => s2.key === status);
}

function getNextStage(status?: string) {
  switch (status) {
    case "Pending": return "Processing";
    case "Processing": return "UnderReview";
    case "UnderReview": return "Approved";
    case "Approved": return "Completed";
    default: return null;
  }
}

function getStatusMeta(status?: string) {
  switch (status) {
    case "Pending": return { label: "Pending", icon: Clock3, shell: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200", dot: "bg-amber-500" };
    case "Processing": return { label: "Processing", icon: CircleDashed, shell: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200", dot: "bg-sky-500" };
    case "UnderReview": return { label: "Under Review", icon: AlertTriangle, shell: "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-200", dot: "bg-violet-500" };
    case "Approved": return { label: "Approved", icon: CheckCircle2, shell: "border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-200", dot: "bg-indigo-500" };
    case "Completed": return { label: "Completed", icon: CheckCircle2, shell: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200", dot: "bg-emerald-500" };
    case "Cancelled": return { label: "Cancelled", icon: X, shell: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200", dot: "bg-rose-500" };
    default: return { label: status || "-", icon: Clock3, shell: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200", dot: "bg-slate-400" };
  }
}

const Badge = memo(function Badge({ status }: { status?: string }) {
  if (!status) return <span className="text-xs text-slate-400">-</span>;
  const meta = getStatusMeta(status);
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${meta.shell}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
});

const SectionCard = memo(function SectionCard({
  title, icon: Icon, children, className = "",
}: {
  title: string; icon: React.ElementType; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 ${className}`}>
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
        <Icon className="h-3.5 w-3.5 text-[#3aa838]" />
        <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">
          {title}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
});

const Field = memo(function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5 dark:border-slate-800 dark:bg-slate-950/40">
      <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-medium leading-5 text-slate-900 dark:text-slate-100">{value || "-"}</div>
    </div>
  );
});

const WorkflowStrip = memo(function WorkflowStrip({ status }: { status?: string }) {
  const currentIndex = getWorkflowIndex(status);
  const nextStage = getNextStage(status);
  const cancelled = status === "Cancelled";
  const meta = getStatusMeta(status);
  const StepIcon = meta.icon;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Workflow</div>
            <h4 className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">Stage-by-stage progress</h4>
          </div>
          <div className={`rounded-lg border px-3 py-1.5 ${meta.shell}`}>
            <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.15em] opacity-80">
              <StepIcon className="h-3 w-3" />
              Current
            </div>
            <div className="mt-0.5 text-xs font-semibold">{meta.label}</div>
            <div className="text-[9px] opacity-80">Next: {nextStage || (cancelled ? "—" : "Completed")}</div>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="overflow-x-auto pb-1">
          <div className="min-w-[600px]">
            <div className="grid grid-cols-5 gap-2">
              {FLOW.map((step, idx) => {
                const active = !cancelled && idx <= currentIndex;
                const current = !cancelled && idx === currentIndex;
                const Icon = step.icon;
                return (
                  <div key={step.key} className="flex flex-col items-center gap-1.5">
                    <div className={[
                      "flex h-9 w-9 items-center justify-center rounded-full border text-[10px] font-semibold transition-all",
                      active
                        ? current
                          ? "border-[#3aa838] bg-[#3aa838] text-white shadow-md shadow-[#3aa838]/30"
                          : "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                        : "border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500",
                    ].join(" ")}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    {/* ✅ FIX: no connector after last step */}
                    {idx < FLOW.length - 1 && (
                      <div className={[
                        "h-0.5 w-full rounded-full",
                        !cancelled && idx < currentIndex ? "bg-emerald-400" : "bg-slate-200 dark:bg-slate-800",
                      ].join(" ")} />
                    )}
                    <span className={[
                      "text-center text-[9px] leading-tight",
                      active ? "font-semibold text-slate-700 dark:text-slate-200" : "text-slate-400 dark:text-slate-500",
                    ].join(" ")}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {cancelled && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
            This work order is cancelled — the workflow is locked.
          </div>
        )}
      </div>
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
    [viewing?.subTotal, viewing?.discountAmount, viewing?.taxTotal, viewing?.grandTotal],
  );

  const supplierPhone =
    typeof viewing?.supplier !== "string"
      ? s(viewing?.supplier?.phoneNumber)
      : "-";
  const supplierEmail =
    typeof viewing?.supplier !== "string"
      ? s(viewing?.supplier?.email)
      : "-";

  const docFields = [
    { label: "Work Order No.", value: s(viewing?.workOrderNo) },
    { label: "Status", value: <Badge status={viewing?.status} /> },
    { label: "Issue Date", value: fmtDate(viewing?.issueDate) },
    { label: "Expected Delivery", value: fmtDate(viewing?.expectedDeliveryDate) },
    { label: "Reference", value: s(viewing?.reference) },
  ];

  const partyCards = [
    {
      title: "Supplier",
      icon: Truck,
      body: (
        <>
          <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950/40">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              {safeName(viewing?.supplier)}
            </div>
            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {safeAddress(viewing?.supplier)}
            </div>
          </div>
          <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
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
        <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950/40">
          <div className="text-sm font-semibold text-slate-900 dark:text-white">
            {safeName(viewing?.warehouseOrFactory)}
          </div>
          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
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

  const logoUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/images/logo-green.png`
      : "/images/logo-green.png";

  return (
    <Dialog open={Boolean(viewing)} onOpenChange={(open) => { if (!open) setViewing(null); }}>
      <DialogContent
        className="!w-full !max-w-[98vw] h-[95vh] overflow-hidden p-0 gap-0 rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950 flex flex-col"
        aria-describedby={undefined}
      >
        {/* ✅ Required a11y title */}
        <DialogTitle className="sr-only">
          {s(viewing?.workOrderNo, "Work Order")} — {s(viewing?.subject, "Details")}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Work order details, parties, items, financial summary, and workflow status.
        </DialogDescription>

        {viewing && (
          <div className="flex h-full min-h-0 flex-col">
            {/* HEADER */}
            <div className="relative shrink-0 overflow-hidden border-b border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 px-5 py-4 text-white md:px-6">
              <div className="pointer-events-none absolute inset-0 flex items-center justify-end pr-8 opacity-[0.04]">
                <span className="text-8xl font-black tracking-tighter">ANTAB</span>
              </div>

              <div className="relative flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300">
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5">Work Order</span>
                    <span className="rounded-full border border-[#3aa838]/30 bg-[#3aa838]/15 px-2.5 py-0.5 text-[#9bdd91]">Live</span>
                  </div>
                  <h3 className="mt-2 text-xl font-bold tracking-tight md:text-2xl">
                    {s(viewing.workOrderNo, "Work Order")}
                  </h3>
                  <p className="mt-0.5 max-w-3xl truncate text-sm text-slate-300">
                    {s(viewing.subject, "No subject")}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <PrintWorkOrderInvoice viewing={viewing} />
                  <PrintWorkOrderInvoiceV3 viewing={viewing} />
                  <GlobalPrintButton
                    label="Print"
                    title={`Work Order ${s(viewing?.workOrderNo, "")}`}
                    contentHtml={buildWorkOrderContentHtml(viewing)}
                    watermarkLogoUrl={logoUrl}
                    headerRightHtml={`<div class="top"><div class="doc"><h2>WORK ORDER</h2><div class="no">${esc(s(viewing.workOrderNo))}</div><div class="m">Issue: ${esc(fmtDate(viewing.issueDate))}</div><div class="m">Expected: ${esc(fmtDate(viewing.expectedDeliveryDate))}</div></div></div>`}
                    company={{
                      name: "Antab Agro LTD",
                      address: "House #63 (1st floor), Road no #6, Sector-4, Uttara, Dhaka-1230.",
                      phone: "Phone: +88-02-7111708, +88-02-58953033",
                      email: "Email: mehran_anwar@hotmail.com, sarzanavg@gmail.com",
                      logoUrl: "/images/logo-green.png",
                    }}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setViewing(null)}
                    className="h-9 gap-1.5 bg-white text-slate-900 hover:bg-slate-100"
                  >
                    <X className="h-4 w-4" />
                    Close
                  </Button>
                </div>
              </div>
            </div>

            {/* BODY */}
            <div className="min-h-0 flex-1 overflow-auto bg-slate-50/70 p-4 dark:bg-slate-950/40 md:p-5">
              <div className="mx-auto max-w-[1400px] space-y-4">
                {/* Overview */}
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                  <div className="h-1 w-full bg-gradient-to-r from-[#3aa838] via-[#3aa838]/50 to-transparent" />
                  <div className="p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#3aa838]/10 text-[#3aa838]">
                          <ClipboardList className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900 dark:text-white">
                            {s(viewing.workOrderNo, "Work Order")}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {s(viewing.subject, "No subject")}
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-2.5 sm:grid-cols-3 lg:min-w-[520px]">
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950/40">
                          <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Status</div>
                          <div className="mt-1"><Badge status={viewing.status} /></div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950/40">
                          <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Next Step</div>
                          <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-900 dark:text-white">
                            <ArrowRight className="h-3 w-3 text-slate-400" />
                            {getNextStage(viewing.status) || "Completed"}
                          </div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950/40">
                          <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Grand Total</div>
                          <div className="mt-1 text-sm font-bold text-[#2f8a2f] dark:text-[#9bdd91]">
                            {fmtMoney(totals.grandTotal)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Document + parties */}
                <div className="grid gap-4 xl:grid-cols-[1.2fr_0.9fr_0.9fr]">
                  <SectionCard title="Document Overview" icon={FileText}>
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      {docFields.map((field) => (
                        <Field key={field.label} label={field.label} value={field.value} />
                      ))}
                    </div>
                  </SectionCard>

                  {partyCards.map((card) => (
                    <SectionCard key={card.title} title={card.title} icon={card.icon}>
                      {card.body}
                    </SectionCard>
                  ))}
                </div>

                <WorkflowStrip status={viewing.status} />

                {/* Items + financials */}
                <div className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
                  <SectionCard title="Items" icon={ClipboardList}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {items.length} item{items.length === 1 ? "" : "s"} in this work order
                      </p>
                      <div className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
                        Scroll →
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                      <table className="w-full min-w-[900px] border-collapse text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-950/60">
                          <tr className="text-left">
                            {["#", "Item", "Description", "Qty", "Received", "Unit", "Unit Price", "Line Total", "Remarks"].map((h, i) => (
                              <th key={h} className={`border-b border-slate-200 px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400 ${i >= 3 && i <= 7 ? "text-right" : ""}`}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {items.length === 0 ? (
                            <tr>
                              {/* ✅ FIX: 9 columns, not 8 */}
                              <td colSpan={9} className="px-3 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                                No items found.
                              </td>
                            </tr>
                          ) : items.map((it, idx) => (
                            <tr key={it._id || idx} className="border-b border-slate-100 transition-colors hover:bg-slate-50/70 dark:border-slate-800 dark:hover:bg-slate-800/40">
                              <td className="px-3 py-2 align-top font-medium">{idx + 1}</td>
                              <td className="px-3 py-2 align-top font-medium text-slate-900 dark:text-white">
                                {itemName(it)}
                                <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">{s(it.itemType)}</div>
                              </td>
                              <td className="px-3 py-2 align-top text-slate-500 dark:text-slate-400">{s(it.description)}</td>
                              <td className="px-3 py-2 align-top text-right">{s(it.quantity ?? 0)}</td>
                              <td className="px-3 py-2 align-top text-right">{s(it.receivedQty ?? 0)}</td>
                              <td className="px-3 py-2 align-top text-right">{s(it.unit)}</td>
                              <td className="px-3 py-2 align-top text-right">{fmtMoney(it.unitPrice)}</td>
                              <td className="px-3 py-2 align-top text-right font-semibold">{fmtMoney(it.lineTotal)}</td>
                              <td className="px-3 py-2 align-top text-right text-slate-500 dark:text-slate-400">{s(it.remarks)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </SectionCard>

                  <div className="space-y-4">
                    <SectionCard title="Financial Summary" icon={Coins}>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950/40">
                          <span className="text-xs text-slate-500 dark:text-slate-400">Subtotal</span>
                          <span className="text-xs font-semibold">{fmtMoney(totals.subTotal)}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950/40">
                          <span className="text-xs text-slate-500 dark:text-slate-400">Discount ({viewing.discountPercent ?? 0}%)</span>
                          <span className="text-xs font-semibold text-rose-600">− {fmtMoney(totals.discountAmount)}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950/40">
                          <span className="text-xs text-slate-500 dark:text-slate-400">Tax ({viewing.taxPercent ?? 0}%)</span>
                          <span className="text-xs font-semibold">{fmtMoney(totals.taxTotal)}</span>
                        </div>
                        <div className="rounded-lg bg-gradient-to-r from-[#16351d] to-[#3aa838] px-3 py-2.5 text-white shadow-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-emerald-100/80">Grand Total</span>
                            <span className="text-base font-bold">{fmtMoney(totals.grandTotal)}</span>
                          </div>
                        </div>
                      </div>
                    </SectionCard>

                    <SectionCard title="Notes & Terms" icon={FileText}>
                      <div className="space-y-3">
                        <div>
                          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Terms</div>
                          <div className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 dark:border-slate-800 dark:bg-slate-950/40">
                            {s(viewing.terms)}
                          </div>
                        </div>
                        <div>
                          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Notes</div>
                          <div className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 dark:border-slate-800 dark:bg-slate-950/40">
                            {s(viewing.notes)}
                          </div>
                        </div>
                        {viewing.cancelReason ? (
                          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
                            <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wider">Cancel Reason</div>
                            {s(viewing.cancelReason)}
                          </div>
                        ) : null}
                      </div>
                    </SectionCard>

                    <SectionCard title="Approvals" icon={UserRound}>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {signatureBoxes.map(([label, value]) => (
                          <div key={label} className="text-center">
                            <div className="h-10 rounded-t-md border border-b-0 border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40" />
                            <div className="rounded-b-md border border-slate-200 bg-white px-2 py-2 dark:border-slate-800 dark:bg-slate-900">
                              <div className="text-[10px] font-semibold text-slate-900 dark:text-white">{label}</div>
                              <div className="mt-0.5 text-[9px] text-slate-500 dark:text-slate-400">{value}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {viewing.footerNote ? (
                        <div className="mt-3 rounded-lg bg-slate-50 p-2.5 text-[10px] text-slate-600 dark:bg-slate-950/40 dark:text-slate-400">
                          {s(viewing.footerNote)}
                        </div>
                      ) : null}
                    </SectionCard>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default memo(WorkOrderViewDialog);