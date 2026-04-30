// src/modules/sales-return/salesReturn.helpers.ts

export type SalesReturnStatus =
  | "PENDING_AM"
  | "PENDING_RM"
  | "PENDING_NSM"
  | "READY_FOR_PRINT"
  | "PRINTED"
  | "SENT_TO_WAREHOUSE"
  | "WAREHOUSE_RECEIVED"
  | "HOLD"
  | "RESOLVED"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED";

export type ReturnRole = "M.O" | "A.M" | "R.M" | "N.S.M" | "WAREHOUSE";

export function money(n: number) {
  return Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatDate(value?: string | Date) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(value?: string | Date) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getStatusLabel(status: SalesReturnStatus) {
  switch (status) {
    case "PENDING_AM":
      return "Pending AM";
    case "PENDING_RM":
      return "Pending RM";
    case "PENDING_NSM":
      return "Pending NSM";
    case "READY_FOR_PRINT":
      return "Ready for Print";
    case "PRINTED":
      return "Printed";
    case "SENT_TO_WAREHOUSE":
      return "Sent to Warehouse";
    case "WAREHOUSE_RECEIVED":
      return "Warehouse Received";
    case "HOLD":
      return "Hold";
    case "RESOLVED":
      return "Resolved";
    case "COMPLETED":
      return "Completed";
    case "REJECTED":
      return "Rejected";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

export function getStatusBadgeClass(status: SalesReturnStatus) {
  switch (status) {
    case "COMPLETED":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "READY_FOR_PRINT":
    case "PRINTED":
      return "bg-indigo-100 text-indigo-700 border-indigo-200";
    case "SENT_TO_WAREHOUSE":
    case "WAREHOUSE_RECEIVED":
      return "bg-cyan-100 text-cyan-700 border-cyan-200";
    case "PENDING_AM":
    case "PENDING_RM":
    case "PENDING_NSM":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "HOLD":
      return "bg-orange-100 text-orange-700 border-orange-200";
    case "RESOLVED":
      return "bg-sky-100 text-sky-700 border-sky-200";
    case "REJECTED":
    case "CANCELLED":
      return "bg-red-100 text-red-700 border-red-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

export function getWorkflowStep(status: SalesReturnStatus) {
  switch (status) {
    case "PENDING_AM":
      return 1;
    case "PENDING_RM":
      return 2;
    case "PENDING_NSM":
      return 3;
    case "READY_FOR_PRINT":
    case "PRINTED":
      return 4;
    case "SENT_TO_WAREHOUSE":
      return 5;
    case "WAREHOUSE_RECEIVED":
      return 6;
    case "HOLD":
      return 7;
    case "RESOLVED":
      return 8;
    case "COMPLETED":
      return 9;
    case "REJECTED":
    case "CANCELLED":
      return 0;
    default:
      return 0;
  }
}

export function getReturnQty(doc: any) {
  return (doc.invoiceReturns || []).reduce((sum: number, block: any) => {
    return (
      sum +
      (block.items || []).reduce((s: number, item: any) => {
        return s + Number(item.requestedQty || 0);
      }, 0)
    );
  }, 0);
}

export function getApprovedQty(doc: any) {
  return (doc.invoiceReturns || []).reduce((sum: number, block: any) => {
    return (
      sum +
      (block.items || []).reduce((s: number, item: any) => {
        return (
          s +
          Number(
            item.finalApprovedQty ||
              item.nsmQty ||
              item.rmQty ||
              item.amQty ||
              item.requestedQty ||
              0,
          )
        );
      }, 0)
    );
  }, 0);
}

export function getReceivedQty(doc: any) {
  return (doc.invoiceReturns || []).reduce((sum: number, block: any) => {
    return (
      sum +
      (block.items || []).reduce((s: number, item: any) => {
        return s + Number(item.warehouseReceivedQty || 0);
      }, 0)
    );
  }, 0);
}

export function getInvoiceCount(doc: any) {
  return doc.invoiceReturns?.length || 0;
}

export function getProductCount(doc: any) {
  return (doc.invoiceReturns || []).reduce((sum: number, block: any) => {
    return sum + (block.items?.length || 0);
  }, 0);
}

export function getActionLabel(status: SalesReturnStatus) {
  switch (status) {
    case "PENDING_AM":
      return "Approve as AM";
    case "PENDING_RM":
      return "Approve as RM";
    case "PENDING_NSM":
      return "Approve as NSM";
    case "READY_FOR_PRINT":
      return "Print";
    case "PRINTED":
      return "Send to Warehouse";
    case "SENT_TO_WAREHOUSE":
      return "Warehouse Receive";
    case "HOLD":
      return "Resolve Hold";
    case "RESOLVED":
      return "Complete";
    case "WAREHOUSE_RECEIVED":
      return "Complete";
    default:
      return "Open";
  }
}

export function canEditQuantity(status: SalesReturnStatus, role?: ReturnRole) {
  if (!role) return false;
  if (role === "A.M") return status === "PENDING_AM";
  if (role === "R.M") return status === "PENDING_RM";
  if (role === "N.S.M") return status === "PENDING_NSM";
  if (role === "WAREHOUSE")
    return status === "SENT_TO_WAREHOUSE" || status === "HOLD";
  return false;
}

export function getStageField(role: Exclude<ReturnRole, "M.O" | "WAREHOUSE">) {
  if (role === "A.M") return "amQty";
  if (role === "R.M") return "rmQty";
  return "nsmQty";
}

export function getDefaultQtyForStage(
  item: any,
  role: Exclude<ReturnRole, "M.O" | "WAREHOUSE">,
) {
  if (role === "A.M") return Number(item.requestedQty || 0);
  if (role === "R.M") return Number(item.amQty || item.requestedQty || 0);
  return Number(item.rmQty || item.amQty || item.requestedQty || 0);
}
