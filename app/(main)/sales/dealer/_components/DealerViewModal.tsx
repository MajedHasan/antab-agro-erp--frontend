import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import React from "react";

/**
 * DealerViewModal (improved + safe)
 *
 * Preserves all props and behavior you already use:
 *  - viewing, setViewing, statusBadge, Section, InfoRow, getName, filePreview
 *
 * Fixes:
 *  - Safe handling of attachment values (string | object)
 *  - Avoids locale-sensitive `toLocaleDateString()` to prevent SSR/client hydration mismatches
 *  - Improved, cleaner UI for attachments and sections
 *
 * Note: This intentionally avoids any non-deterministic client-only calls so SSR hydration is stable.
 */
const DealerViewModal = ({
  viewing,
  setViewing,
  statusBadge,
  Section,
  InfoRow,
  getName,
  filePreview,
}) => {
  // Safely extract a preview URL string from a media-like value (string id/path or full media object)
  const getPreviewUrl = (v) => {
    if (!v) return "";
    try {
      // If caller stored a full media object, prefer its .url
      if (typeof v === "object" && v !== null) {
        const url = v.url ?? v.file ?? v.path ?? "";
        if (url) return String(filePreview(url) ?? url);
        // fallback: if object has _id, attempt to build preview with that
        if (v._id) return String(filePreview(v._id) ?? "");
        return "";
      }
      // if string — could be a path (/uploads/...) or a media id — pass to filePreview
      if (typeof v === "string") {
        return String(filePreview(v) ?? v);
      }
      return "";
    } catch {
      return "";
    }
  };

  // Deterministic date formatting (YYYY-MM-DD). avoids locale differences.
  const formatDate = (d) => {
    if (!d) return "-";
    try {
      const dt = new Date(d);
      if (Number.isNaN(dt.getTime())) return "-";
      // show YYYY-MM-DD (stable across server & client)
      return dt.toISOString().slice(0, 10);
    } catch {
      return "-";
    }
  };

  // Returns true if preview string looks like a PDF
  const isPdfPreview = (v) => {
    const url = String(v ?? "").toLowerCase();
    return url.endsWith(".pdf");
  };

  return (
    <Dialog open={!!viewing} onOpenChange={() => setViewing(null)}>
      <DialogContent className="!w-[950px] !max-w-[95vw] max-h-[90vh] overflow-y-auto p-0 rounded-xl shadow-2xl bg-background border">
        <DialogTitle className="sr-only">Dealer details</DialogTitle>

        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between border-b pb-4">
            <div>
              <h2 className="text-2xl font-bold">{viewing?.name ?? "-"}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                <span className="font-medium">ID:</span> {viewing?._id ?? "-"}
              </p>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">Code:</span>{" "}
                {viewing?.code ?? "-"}
              </p>
            </div>

            <div className="text-right space-y-2">
              <div>{statusBadge?.(viewing?.status)}</div>
              <div className="text-xs text-muted-foreground">
                Created: {formatDate(viewing?.createdAt)}
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left column */}
            <div className="space-y-4">
              <Section title="Contact Info">
                <InfoRow label="Phone" value={viewing?.phoneNumber ?? "-"} />
                <InfoRow label="Email" value={viewing?.email ?? "-"} />
                <InfoRow label="Address" value={viewing?.address ?? "-"} />
              </Section>

              <Section title="Dealer Type & Finance">
                <InfoRow label="Type" value={viewing?.type ?? "-"} />
                <InfoRow
                  label="Credit Limit"
                  value={String(viewing?.creditLimit ?? "-")}
                />
                <InfoRow
                  label="Opening Balance"
                  value={String(viewing?.openingBalance ?? "-")}
                />
              </Section>

              <Section title="Notes & Dates">
                <InfoRow label="Notes" value={viewing?.notes ?? "-"} />
                <InfoRow
                  label="Last Purchase"
                  value={
                    viewing?.lastPurchaseDate
                      ? formatDate(viewing.lastPurchaseDate)
                      : "-"
                  }
                />
                <InfoRow
                  label="Op Date / Month"
                  value={`${viewing?.opDate ?? "-"} / ${viewing?.opMonth ?? "-"}`}
                />
              </Section>
            </div>

            {/* Right column */}
            <div className="space-y-4">
              <Section title="Location Info">
                <InfoRow
                  label="Zone / Region"
                  value={`${getName?.(viewing?.zone) ?? "-"} / ${getName?.(viewing?.region) ?? "-"}`}
                />
                <InfoRow
                  label="Area / Territory"
                  value={`${getName?.(viewing?.area) ?? "-"} / ${getName?.(viewing?.territory) ?? "-"}`}
                />
                <InfoRow
                  label="Warehouse"
                  value={getName?.(viewing?.warehouse) ?? "-"}
                />
                <InfoRow
                  label="Proprietor"
                  value={viewing?.proprietor ?? "-"}
                />
              </Section>

              <Section title="Assignments">
                <InfoRow
                  label="Assigned Sales Manager"
                  value={getName?.(viewing?.assignedSalesManager) ?? "-"}
                />
                <InfoRow
                  label="Created By"
                  value={getName?.(viewing?.createdBy) ?? "-"}
                />
              </Section>
            </div>
          </div>

          {/* Attachments */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Attachments</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Required attachments */}
              <div>
                <h4 className="font-medium text-sm mb-2">Required</h4>
                <div className="space-y-2">
                  {viewing?.attachments?.required ? (
                    Object.entries(viewing.attachments.required).map(
                      ([k, v]) => {
                        const preview = getPreviewUrl(v);
                        if (!preview) {
                          return (
                            <div key={k} className="flex items-center gap-3">
                              <span className="w-28 font-medium text-sm">
                                {k}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                No file
                              </span>
                            </div>
                          );
                        }

                        const pdf = isPdfPreview(preview);
                        return (
                          <div key={k} className="flex items-center gap-3">
                            <span className="w-28 font-medium text-sm">
                              {k}
                            </span>

                            {pdf ? (
                              <a
                                href={preview}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 underline hover:text-blue-800 text-sm"
                              >
                                View PDF
                              </a>
                            ) : (
                              <img
                                src={preview}
                                alt={k}
                                className="w-28 h-20 object-cover rounded border hover:shadow-lg transition"
                              />
                            )}
                          </div>
                        );
                      },
                    )
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      No required files
                    </span>
                  )}
                </div>
              </div>

              {/* Optional attachments */}
              <div>
                <h4 className="font-medium text-sm mb-2">Optional</h4>
                {viewing?.attachments?.optional ? (
                  (["agreements", "others"] as const).map((key) => {
                    const files = viewing.attachments?.optional?.[key] ?? [];
                    return (
                      <div key={key} className="mb-3">
                        <div className="font-medium text-sm capitalize mb-2">
                          {key}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {files.length > 0 ? (
                            files.map((u: any, i: number) => {
                              const preview = getPreviewUrl(u);
                              if (!preview) {
                                return (
                                  <div
                                    key={i}
                                    className="border rounded p-2 flex items-center justify-center min-w-[110px] min-h-[64px]"
                                  >
                                    <span className="text-sm text-muted-foreground">
                                      Invalid file
                                    </span>
                                  </div>
                                );
                              }
                              const pdf = isPdfPreview(preview);
                              return (
                                <div
                                  key={i}
                                  className="border rounded p-2 hover:shadow-md transition flex items-center justify-center"
                                >
                                  {pdf ? (
                                    <a
                                      href={preview}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-blue-600 underline hover:text-blue-800"
                                    >
                                      PDF
                                    </a>
                                  ) : (
                                    <img
                                      src={preview}
                                      alt={key}
                                      className="w-28 h-20 object-cover rounded"
                                    />
                                  )}
                                </div>
                              );
                            })
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              No files
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <span className="text-sm text-muted-foreground">
                    No optional files
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end border-t pt-4">
            <Button
              variant="ghost"
              type="button"
              onClick={() => setViewing(null)}
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DealerViewModal;
