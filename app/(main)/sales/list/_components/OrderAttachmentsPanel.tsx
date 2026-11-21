"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Paperclip, Upload, FileText, Image as ImageIcon, File as FileIcon, Trash2,
  ExternalLink, Loader2, Inbox, Truck, Receipt,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AttachmentCategory, OrderAttachment, formatBytes, formatDateTime,
  mediaFileName, mediaUrl,
} from "./order-detail-types";

const MEDIA_UPLOAD_ENDPOINT =
  "/media/upload?module=sales-order&folder=order-attachments";

type Props = {
  orderId: string;
  attachments?: OrderAttachment[] | null;
  onRefresh?: () => void | Promise<void>;
  canUpload?: boolean;
  canDelete?: boolean;
};

function SectionHeader({
  icon: Icon, title, subtitle, right,
}: {
  icon: React.ElementType; title: string; subtitle?: string; right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3aa838]/10 text-[#3aa838] dark:bg-[#3aa838]/15 dark:text-[#9bdd91]">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-bold text-slate-900 dark:text-white">{title}</div>
          {subtitle && (
            <div className="text-[11px] text-slate-500 dark:text-slate-400">{subtitle}</div>
          )}
        </div>
      </div>
      {right}
    </div>
  );
}

function CategoryBadge({ category }: { category: AttachmentCategory }) {
  if (category === "SIGNED_INVOICE")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#3aa838]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#2f8a2f] dark:bg-[#3aa838]/15 dark:text-[#9bdd91]">
        <Receipt className="h-2.5 w-2.5" /> Signed Invoice
      </span>
    );
  if (category === "DELIVERY_CHALAN")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
        <Truck className="h-2.5 w-2.5" /> Delivery Chalan
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      <Paperclip className="h-2.5 w-2.5" /> Other
    </span>
  );
}

function iconFor(mimeType?: string) {
  if (!mimeType) return FileIcon;
  if (mimeType.startsWith("image/")) return ImageIcon;
  if (
    mimeType === "application/pdf" ||
    mimeType.startsWith("text/") ||
    mimeType.includes("word") ||
    mimeType.includes("excel") ||
    mimeType.includes("spreadsheet")
  ) return FileText;
  return FileIcon;
}

export default function OrderAttachmentsPanel({
  orderId, attachments, onRefresh, canUpload = true, canDelete = true,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingCategory, setPendingCategory] =
    useState<Exclude<AttachmentCategory, "SIGNED_INVOICE">>("OTHER");

  const list = Array.isArray(attachments) ? attachments : [];
  const grouped = useMemo(() => {
    const signed: OrderAttachment[] = [];
    const dc: OrderAttachment[] = [];
    const other: OrderAttachment[] = [];
    for (const a of list) {
      if (a.category === "SIGNED_INVOICE") signed.push(a);
      else if (a.category === "DELIVERY_CHALAN") dc.push(a);
      else other.push(a);
    }
    return { signed, dc, other };
  }, [list]);

  const handlePickFile = () => {
    if (!canUpload || uploading) return;
    fileInputRef.current?.click();
  };

  const handleFileChosen = useCallback(
    async (file: File | null) => {
      if (!file) return;
      setUploading(true);
      try {
        const form = new FormData();
        form.append("file", file);
        const mediaRes = await api.post(MEDIA_UPLOAD_ENDPOINT, form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        const mediaDoc = mediaRes.data?.data || mediaRes.data;
        const mediaId = mediaDoc?._id || mediaDoc?.id;
        if (!mediaId) throw new Error("Media upload returned no id");

        await api.post(`/sales-orders/${orderId}/attachments`, {
          mediaId,
          category: pendingCategory,
          label: file.name,
        });

        toast.success("File uploaded and attached to the order.");
        if (onRefresh) await onRefresh();
      } catch (err: any) {
        toast.error(
          err?.response?.data?.message || err?.message || "Failed to upload attachment.",
        );
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [orderId, pendingCategory, onRefresh],
  );

  const handleDelete = async (att: OrderAttachment) => {
    if (!canDelete) return;
    if (att.category === "SIGNED_INVOICE") {
      toast.error("Signed invoice attachment cannot be removed.");
      return;
    }
    if (!confirm("Remove this attachment from the order?")) return;
    setDeletingId(att._id);
    try {
      await api.delete(`/sales-orders/${orderId}/attachments/${att._id}`);
      toast.success("Attachment removed.");
      if (onRefresh) await onRefresh();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || err?.message || "Failed to remove attachment.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  const renderRow = (att: OrderAttachment) => {
    const Icon = iconFor(typeof att.mediaId === "object" ? att.mediaId?.mimeType : undefined);
    const url = mediaUrl(att.mediaId);
    const size = typeof att.mediaId === "object" ? att.mediaId?.size : undefined;
    const name = att.label || mediaFileName(att.mediaId);
    const isBusy = deletingId === att._id;
    const isSigned = att.category === "SIGNED_INVOICE";

    return (
      <div
        key={att._id}
        className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2.5 transition hover:border-[#3aa838]/50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-[#3aa838]/40"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-xs font-semibold text-slate-900 dark:text-white">
              {name}
            </span>
            <CategoryBadge category={att.category} />
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-slate-500 dark:text-slate-400">
            {size ? <span>{formatBytes(size)}</span> : null}
            <span>·</span>
            <span>{formatDateTime(att.uploadedAt)}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {url ? (
            <Button asChild variant="ghost" size="icon" className="h-7 w-7" title="Open">
              <a href={url} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          ) : null}
          {!isSigned && canDelete ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30"
              onClick={() => handleDelete(att)}
              disabled={isBusy}
              title="Remove"
            >
              {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </Button>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <SectionHeader
        icon={Paperclip}
        title="Attachments"
        subtitle={
          list.length
            ? `${list.length} file${list.length > 1 ? "s" : ""} on this order`
            : "No files attached yet"
        }
        right={
          canUpload ? (
            <div className="flex items-center gap-1.5">
              <select
                value={pendingCategory}
                onChange={(e) =>
                  setPendingCategory(
                    e.target.value as Exclude<AttachmentCategory, "SIGNED_INVOICE">,
                  )
                }
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[11px] outline-none focus:border-[#3aa838]/40 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              >
                <option value="OTHER">Other</option>
                <option value="DELIVERY_CHALAN">Delivery Chalan</option>
              </select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePickFile}
                disabled={uploading}
                className="h-8 gap-1.5 text-[11px]"
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {uploading ? "Uploading…" : "Upload file"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => void handleFileChosen(e.target.files?.[0] || null)}
              />
            </div>
          ) : null
        }
      />
      <CardContent className="p-4">
        {list.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 px-4 py-8 text-center dark:border-slate-800">
            <div className="rounded-2xl bg-slate-100 p-3 dark:bg-slate-800">
              <Inbox className="h-5 w-5 text-slate-400" />
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              No attachments
            </div>
            <div className="max-w-sm text-[11px] text-slate-500 dark:text-slate-400">
              Signed invoices and DCs uploaded through the workflow will appear
              here. You can also attach any optional file manually.
            </div>
            {canUpload ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePickFile}
                className="mt-1 h-8 gap-1.5 text-[11px]"
              >
                <Upload className="h-3.5 w-3.5" /> Upload first file
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            {grouped.signed.length > 0 ? (
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Signed Invoice
                </div>
                {grouped.signed.map(renderRow)}
              </div>
            ) : null}
            {grouped.dc.length > 0 ? (
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Delivery Chalan
                </div>
                {grouped.dc.map(renderRow)}
              </div>
            ) : null}
            {grouped.other.length > 0 ? (
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Other files
                </div>
                {grouped.other.map(renderRow)}
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}