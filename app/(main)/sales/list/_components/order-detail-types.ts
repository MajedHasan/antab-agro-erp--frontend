// src/components/sales-order/order-detail-types.ts
export type Populated<T> = T | string;

export type UserRef = Populated<{ _id: string; name?: string; email?: string }>;
export type ProductRef = Populated<{ _id: string; name?: string; sku?: string }>;
export type MediaRef = Populated<{
  _id: string;
  originalName?: string;
  fileName?: string;
  url?: string;
  mimeType?: string;
  size?: number;
}>;

export type QtyChangeLog = {
  _id?: string;
  productId?: ProductRef;
  warehouseId?: string;
  previousQty: number;
  newQty: number;
  previousBonusQty: number;
  newBonusQty: number;
  deltaTotal: number;
  role: "A.M" | "R.M" | "N.S.M" | "FULFILLMENT" | "OTHER";
  stage: string;
  userId?: UserRef;
  remarks?: string;
  actionDate?: string;
};

export type AttachmentCategory = "SIGNED_INVOICE" | "DELIVERY_CHALAN" | "OTHER";

export type OrderAttachment = {
  _id: string;
  mediaId?: MediaRef;
  category: AttachmentCategory;
  label?: string;
  notes?: string;
  uploadedBy?: string;
  uploadedAt?: string;
};

export const roleLabel: Record<QtyChangeLog["role"], string> = {
  "A.M": "A.M",
  "R.M": "R.M",
  "N.S.M": "N.S.M",
  FULFILLMENT: "Fulfillment",
  OTHER: "Other",
};

export function refName(ref?: Populated<{ name?: string; _id?: string }>) {
  if (!ref) return "—";
  if (typeof ref === "string") return ref;
  return ref.name || ref._id || "—";
}

export function mediaFileName(ref?: MediaRef) {
  if (!ref) return "File";
  if (typeof ref === "string") return ref;
  return ref.originalName || ref.fileName || ref._id || "File";
}

/* ============================================================
   MEDIA URL BUILDER
   - Uses process.env.NEXT_PUBLIC_MEDIA_URL as the base.
   - Handles both env variants:
       NEXT_PUBLIC_MEDIA_URL=http://localhost:5001
       NEXT_PUBLIC_MEDIA_URL=http://localhost:5001/uploads/
   - Encodes special characters (`#`, spaces, etc.) in the path
     so filenames like `#INV-...pdf` still open correctly.
   - If NEXT_PUBLIC_MEDIA_URL is empty, falls back to the raw URL
     (works when frontend + backend sit behind the same origin).
============================================================ */

const MEDIA_BASE_RAW = process.env.NEXT_PUBLIC_MEDIA_URL || "";
const MEDIA_BASE = MEDIA_BASE_RAW.replace(/\/+$/, ""); // trim trailing slashes

/**
 * Encode characters that would break navigation — specifically `#`
 * (fragment) and `?` (query), plus spaces — but keep slashes and
 * already-encoded sequences untouched.
 */
function encodeMediaPath(url: string): string {
  // Split protocol + host from the rest so we never encode the scheme/host.
  const match = url.match(/^(https?:\/\/[^/]+)(\/.*)?$/i);
  const origin = match ? match[1] : "";
  const pathAndQuery = match ? match[2] || "" : url;

  // encodeURI keeps `/`, `:`, `&`, `=`, `?` etc., but we want `#` and
  // `?` (when part of the filename) encoded, and spaces too.
  const safe = encodeURI(pathAndQuery)
    // Encode `#` (encodeURI does NOT touch `#` because it's reserved).
    .replace(/#/g, "%23");

  return origin + safe;
}

export function buildMediaUrl(rawUrl?: string | null): string | null {
  if (!rawUrl) return null;

  // Already absolute? Just encode and return.
  if (/^https?:\/\//i.test(rawUrl)) {
    return encodeMediaPath(rawUrl);
  }

  // No base configured — keep it relative (same-origin deployments).
  if (!MEDIA_BASE) {
    return encodeMediaPath(rawUrl);
  }

  // Strip leading `/uploads` (or `uploads`) from rawUrl because the
  // backend always prefixes stored files with `/uploads`.
  const pathWithoutUploads = rawUrl.replace(/^\/?uploads\/?/i, "");

  // Does the base already end with `/uploads`?
  const baseHasUploads = /\/uploads$/i.test(MEDIA_BASE);

  const fullUrl = baseHasUploads
    ? `${MEDIA_BASE}/${pathWithoutUploads}`
    : `${MEDIA_BASE}/uploads/${pathWithoutUploads}`;

  return encodeMediaPath(fullUrl);
}

export function mediaUrl(ref?: MediaRef) {
  if (!ref || typeof ref === "string") return null;
  return buildMediaUrl(ref.url);
}

export function formatBytes(bytes?: number) {
  if (!bytes || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDateTime(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}