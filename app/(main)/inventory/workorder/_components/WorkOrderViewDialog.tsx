"use client";

import React, { memo, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import PrintWorkOrderInvoice from "./PrintWorkOrderInvoice";
import {
  addr,
  fmtDate,
  fmtMoney,
  itemName,
  safeAddress,
  safeName,
  statusClassMap,
  text,
  type WorkOrderView,
} from "./workOrderShared";

type Props = {
  viewing: WorkOrderView | null;
  setViewing: React.Dispatch<React.SetStateAction<WorkOrderView | null>>;
};

const Badge = memo(function Badge({ status }: { status?: string }) {
  if (!status) return <span className="text-sm text-muted-foreground">-</span>;
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
        statusClassMap[status] ||
        "bg-slate-100 text-slate-700 ring-1 ring-slate-200"
      }`}
    >
      {status}
    </span>
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
    <div className="rounded-xl border bg-slate-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-slate-900">
        {value || "-"}
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
    [
      viewing?.subTotal,
      viewing?.discountAmount,
      viewing?.taxTotal,
      viewing?.grandTotal,
    ],
  );

  return (
    <Dialog
      open={Boolean(viewing)}
      onOpenChange={(open) => {
        if (!open) setViewing(null);
      }}
    >
      <DialogContent className="!w-full !max-w-[98vw] h-[95vh] overflow-hidden p-0 rounded-2xl border bg-slate-50 shadow-2xl">
        {viewing && (
          <div className="flex h-full flex-col">
            <div className="border-b bg-white px-6 py-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Work Order / Quotation
                  </div>
                  <h3 className="text-2xl font-bold">
                    {viewing.workOrderNo || "Work Order"}
                  </h3>
                  <div className="text-sm text-muted-foreground">
                    {viewing.subject || "No subject"}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <PrintWorkOrderInvoice viewing={viewing} />
                  <Button variant="ghost" onClick={() => setViewing(null)}>
                    Close
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 lg:p-6">
              <div className="mx-auto max-w-[1400px] space-y-6">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                  <div className="rounded-2xl border bg-white p-4 shadow-sm lg:col-span-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Document Info
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-4">
                      <Field
                        label="Work Order No."
                        value={viewing.workOrderNo}
                      />
                      <div className="rounded-xl border bg-slate-50 p-4">
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Status
                        </div>
                        <div className="mt-2">
                          <Badge status={viewing.status} />
                        </div>
                      </div>
                      <Field
                        label="Issue Date"
                        value={fmtDate(viewing.issueDate)}
                      />
                      <Field
                        label="Expected Delivery"
                        value={fmtDate(viewing.expectedDeliveryDate)}
                      />
                      <div className="col-span-2">
                        <Field label="Reference" value={viewing.reference} />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-white p-4 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Supplier
                    </div>
                    <div className="mt-3 text-sm font-semibold text-slate-900">
                      {safeName(viewing.supplier)}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {safeAddress(viewing.supplier)}
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      {typeof viewing.supplier !== "string"
                        ? viewing.supplier?.phoneNumber || "-"
                        : "-"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {typeof viewing.supplier !== "string"
                        ? viewing.supplier?.email || "-"
                        : "-"}
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-white p-4 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Factory
                    </div>
                    <div className="mt-3 text-sm font-semibold text-slate-900">
                      {safeName(viewing.warehouseOrFactory)}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {safeAddress(viewing.warehouseOrFactory)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_0.9fr]">
                  <div className="rounded-2xl border bg-white shadow-sm">
                    <div className="border-b px-5 py-4">
                      <h4 className="text-lg font-semibold">Items</h4>
                      <div className="text-sm text-muted-foreground">
                        {items.length} item{items.length === 1 ? "" : "s"}
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-sm">
                        <thead className="bg-slate-50">
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
                          </tr>
                        </thead>
                        <tbody>
                          {items.length === 0 ? (
                            <tr>
                              <td
                                colSpan={8}
                                className="px-4 py-8 text-center text-muted-foreground"
                              >
                                No items found.
                              </td>
                            </tr>
                          ) : (
                            items.map((it, idx) => (
                              <tr
                                key={it._id || idx}
                                className="border-b hover:bg-slate-50/60"
                              >
                                <td className="px-4 py-3 align-top">
                                  {idx + 1}
                                </td>
                                <td className="px-4 py-3 align-top font-medium">
                                  {itemName(it)}
                                </td>
                                <td className="px-4 py-3 align-top">
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
                                <td className="px-4 py-3 align-top text-right font-medium">
                                  {fmtMoney(it.lineTotal)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="rounded-2xl border bg-white p-5 shadow-sm">
                      <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        Summary
                      </div>

                      <div className="mt-4 space-y-3 rounded-xl bg-slate-50 p-4">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Subtotal</span>
                          <span className="font-medium">
                            {fmtMoney(totals.subTotal)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">
                            Discount ({viewing.discountPercent ?? 0}%)
                          </span>
                          <span className="font-medium text-rose-600">
                            - {fmtMoney(totals.discountAmount)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">
                            Tax ({viewing.taxPercent ?? 0}%)
                          </span>
                          <span className="font-medium">
                            {fmtMoney(totals.taxTotal)}
                          </span>
                        </div>
                        <div className="border-t pt-3">
                          <div className="flex justify-between text-lg font-bold">
                            <span>Grand Total</span>
                            <span>{fmtMoney(totals.grandTotal)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border bg-white p-5 shadow-sm">
                      <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        Notes / Terms
                      </div>

                      <div className="mt-4 space-y-4">
                        <div>
                          <div className="mb-1 text-sm font-medium">
                            Terms & Conditions
                          </div>
                          <div className="whitespace-pre-wrap rounded-xl border bg-slate-50 p-4 text-sm leading-6">
                            {viewing.terms || "-"}
                          </div>
                        </div>

                        <div>
                          <div className="mb-1 text-sm font-medium">Notes</div>
                          <div className="whitespace-pre-wrap rounded-xl border bg-slate-50 p-4 text-sm leading-6">
                            {viewing.notes || "-"}
                          </div>
                        </div>

                        {viewing.cancelReason ? (
                          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                            <div className="mb-1 font-semibold">
                              Cancel Reason
                            </div>
                            {viewing.cancelReason}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-2xl border bg-white p-5 shadow-sm">
                      <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        Signatures
                      </div>

                      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div className="text-center">
                          <div className="h-16 border-b" />
                          <div className="mt-2 text-sm font-medium">
                            Prepared By
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {text(viewing.createdBy)}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="h-16 border-b" />
                          <div className="mt-2 text-sm font-medium">
                            Approved By
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {text(viewing.approvedBy)}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="h-16 border-b" />
                          <div className="mt-2 text-sm font-medium">
                            Chairman
                          </div>
                          <div className="text-xs text-muted-foreground">-</div>
                        </div>
                      </div>

                      {viewing.footerNote ? (
                        <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                          {viewing.footerNote}
                        </div>
                      ) : null}
                    </div>
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
