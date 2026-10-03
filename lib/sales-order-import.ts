import api from "@/lib/api";

/* =====================================================
   TYPES
===================================================== */

export type SalesOrderImportRow = {
  rowNumber: number;
  importReference: string;
  dealerCode: string;
  warehouseCode: string;
  orderDate: string;
  paymentMethod: "CASH" | "CREDIT" | string;
  productSku: string;
  qty: number;

  bonusQtyOverride: number | null;
  hasBonusQtyOverride: boolean;

  discountPercent: number | null;
  taxPercent: number | null;

  hasDiscountPercent: boolean;
  hasTaxPercent: boolean;

  notes?: string;

  errors: string[];
};

export type ResolvedSalesOrderImportRow = SalesOrderImportRow & {
  dealerId?: string;
  dealerName?: string;
  dealerType?: string;
  dealerStatus?: string;

  warehouseId?: string;
  warehouseName?: string;
  warehouseType?: string;
  warehouseStatus?: string;

  productId?: string;
  productName?: string;
  salePrice?: number;
  taxRate?: number;
  productStatus?: string;

  promotionBonusQty?: number;
  appliedPromotionId?: string | null;
  finalBonusQty?: number;

  unitPrice?: number;
  grossAmount?: number;
  discountAmount?: number;
  taxableAmount?: number;
  taxAmount?: number;
  lineTotal?: number;
};

export type SalesOrderImportItem = {
  rowNumber?: number;

  productId: string;

  productSku: string;
  productName: string;

  qty: number;
  bonusQty: number;

  rate?: number;
  salePrice?: number;
  unitPrice?: number;

  discountPercent: number;
  discountAmount: number;

  taxPercent: number;
  taxAmount: number;

  subtotal: number;
  total: number;
};

export type SalesOrderImportGroup = {
  importReference: string;

  dealerCode: string;
  dealerId?: string;
  dealerName?: string;

  warehouseCode: string;
  warehouseId?: string;
  warehouseName?: string;

  orderDate: string;
  paymentMethod: "CASH" | "CREDIT" | string;
  notes?: string;

  items: SalesOrderImportItem[];

  totalQty: number;
  totalBonusQty: number;

  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  grandTotal: number;

  errors: string[];
};

export type SalesOrderImportPreview = {
  totalRows: number;
  validRows: number;
  invalidRows: number;

  totalOrders: number;
  validOrders: number;
  invalidOrders: number;

  totalQty: number;
  totalBonusQty: number;

  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  grandTotal: number;

  rows: ResolvedSalesOrderImportRow[];
  groups: SalesOrderImportGroup[];
  errors: string[];
};

export type SalesOrderImportConfirmResult = {
  message?: string;

  total: number;
  successful: number;
  failed: number;

  results: Array<{
    importReference: string;
    success: boolean;

    orderId?: string;
    orderNo?: string;

    error?: string;
  }>;
};

/* =====================================================
   HELPERS
===================================================== */

function createExcelFormData(file: File): FormData {
  const formData = new FormData();

  formData.append("file", file);

  return formData;
}

/**
 * Backend returns validation failures with a normal JSON response.
 * This helper keeps error extraction consistent across preview/confirm.
 */
export function getSalesOrderImportError(error: any): string {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    "Sales order import request failed."
  );
}

/* =====================================================
   TEMPLATE
===================================================== */

/**
 * Download the official sales-order Excel template.
 */
export async function downloadSalesOrderImportTemplate(): Promise<Blob> {
  const response = await api.get("/sales-orders/import/template", {
    responseType: "blob",
  });

  return response.data as Blob;
}

/* =====================================================
   PREVIEW
===================================================== */

/**
 * Upload Excel file and validate/preview it.
 *
 * IMPORTANT:
 * This endpoint must have NO database side effects.
 */
export async function previewSalesOrderImport(
  file: File,
): Promise<SalesOrderImportPreview> {
  const formData = createExcelFormData(file);

  const response = await api.post(
    "/sales-orders/import/preview",
    formData,
  );

  // Backend returns { success, message, data: { ...preview } }
  return response.data.data as SalesOrderImportPreview;
}

/* =====================================================
   CONFIRM
===================================================== */

/**
 * Upload Excel file and create the sales orders.
 *
 * The backend revalidates the uploaded workbook before creating
 * anything, so the browser's previous preview is never trusted
 * as the final validation state.
 */
export async function confirmSalesOrderImport(
  file: File,
): Promise<SalesOrderImportConfirmResult> {
  const formData = createExcelFormData(file);

  const response = await api.post<SalesOrderImportConfirmResult>(
    "/sales-orders/import/confirm",
    formData,
  );

  return response.data;
}