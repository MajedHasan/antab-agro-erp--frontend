import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import React from "react";

/**
 * Redesigned DealerAddEditModal
 * - Keeps all original behaviors and props unchanged
 * - Improved visual hierarchy, attachment UI, and accessibility
 * - Defensive handling for preview URLs (won't call .endsWith on objects)
 *
 * Props (kept intentionally untyped to match your usage):
 *  open, cleanupTempFiles, setOpen, resetModalForm, editing, onSubmit,
 *  form, setForm, modalZone, onModalZoneChange, NONE, zones, modalRegion,
 *  onModalRegionChange, regions, modalArea, onModalAreaChange, areas,
 *  territories, warehouses, users, setRequiredAttachment, filePreview,
 *  addOptionalFiles, removeOptionalAttachment
 */
const DealerAddEditModal = ({
  open,
  cleanupTempFiles,
  setOpen,
  resetModalForm,
  editing,
  onSubmit,
  form,
  setForm,
  modalZone,
  onModalZoneChange,
  NONE,
  zones,
  modalRegion,
  onModalRegionChange,
  regions,
  modalArea,
  onModalAreaChange,
  areas,
  territories,
  warehouses,
  users,
  setRequiredAttachment,
  filePreview,
  addOptionalFiles,
  removeOptionalAttachment,
}) => {
  // Helpers
  const getPreviewUrl = (value) => {
    if (!value) return "";
    try {
      const p = filePreview(value);
      return typeof p === "string" ? p : String(p ?? "");
    } catch {
      return "";
    }
  };

  const isPdf = (value) => {
    const u = getPreviewUrl(value).toLowerCase();
    return u.endsWith(".pdf");
  };

  const inputClass =
    "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none transition";

  // Attachment config (keeps same keys as your original file)
  const REQUIRED_ATTACHMENTS = [
    { key: "bankCheque", label: "Bank Cheque" },
    { key: "tradeLicense", label: "Trade License" },
    { key: "nidCard", label: "NID Card" },
    { key: "informationDeed", label: "Information / Deed" },
    { key: "pesticideLicense", label: "Pesticide License" },
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={async (v) => {
        if (!v) {
          await cleanupTempFiles();
          resetModalForm();
        }
        setOpen(v);
      }}
    >
      <DialogContent
        className="
          !w-full
          !max-w-[95vw]
          max-h-[90vh]
          overflow-y-auto
          p-0
          rounded-xl
          shadow-2xl
          bg-background
          border
        "
      >
        {/* Header */}
        <div className="sticky top-0 z-20 bg-background border-b px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <DialogTitle className="text-lg font-semibold">
              {editing ? "Edit Dealer" : "New Dealer"}
            </DialogTitle>
            <div className="text-sm text-muted-foreground mt-[2px]">
              <span className="font-medium text-xs mr-2">Status:</span>
              <span className="capitalize">{form.status || "pending"}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {editing?._id && (
              <div className="text-xs text-muted-foreground">
                ID: {editing._id}
              </div>
            )}
            <Button
              variant="ghost"
              type="button"
              onClick={async () => {
                setOpen(false);
                await cleanupTempFiles();
                resetModalForm();
              }}
            >
              Close
            </Button>
          </div>
        </div>

        <form onSubmit={onSubmit} className="px-6 py-6 space-y-6">
          {/* Basic Info Card */}
          <div className="bg-muted/40 border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-semibold">🏢 Basic Information</h4>
              <div className="text-sm text-muted-foreground">
                Fill dealer basics
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left Column */}
              <div className="space-y-3">
                <div>
                  <label className="text-sm block mb-1">Name</label>
                  <Input
                    className={inputClass}
                    value={form.name}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, name: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <label className="text-sm block mb-1">Code (auto)</label>
                  <Input
                    className={inputClass}
                    value={form.code || ""}
                    readOnly
                    placeholder="Auto-generated by server"
                  />
                </div>

                <div>
                  <label className="text-sm block mb-1">Proprietor</label>
                  <Input
                    className={inputClass}
                    value={form.proprietor}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, proprietor: e.target.value }))
                    }
                  />
                </div>

                {/* Location Cascade */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm block mb-1">Zone</label>
                    <Select value={modalZone} onValueChange={onModalZoneChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select Zone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Choose Zone</SelectItem>
                        {zones.map((z) => (
                          <SelectItem key={z._id} value={z._id}>
                            {z.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm block mb-1">Region</label>
                    <Select
                      value={modalRegion}
                      onValueChange={onModalRegionChange}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select Region" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Choose Region</SelectItem>
                        {regions.map((r) => (
                          <SelectItem key={r._id} value={r._id}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm block mb-1">Area</label>
                    <Select value={modalArea} onValueChange={onModalAreaChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select Area" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Choose Area</SelectItem>
                        {areas.map((a) => (
                          <SelectItem key={a._id} value={a._id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm block mb-1">Territory</label>
                    <Select
                      value={form.territory || NONE}
                      onValueChange={(v) =>
                        setForm((p) => ({
                          ...p,
                          territory: v === NONE ? "" : v,
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select Territory" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Choose Territory</SelectItem>
                        {territories.map((t) => (
                          <SelectItem key={t._id} value={t._id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="text-sm block mb-1">Type</label>
                  <Select
                    value={form.type || NONE}
                    onValueChange={(v) =>
                      setForm((p) => ({ ...p, type: v === NONE ? "" : v }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Dealer Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Select Type</SelectItem>
                      <SelectItem value="Credit">Credit</SelectItem>
                      <SelectItem value="Cash">Cash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm block mb-1">Credit Limit</label>
                    <Input
                      className={inputClass}
                      value={String(form.creditLimit ?? "")}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, creditLimit: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm block mb-1">
                      Opening Balance
                    </label>
                    <Input
                      className={inputClass}
                      value={String(form.openingBalance ?? "")}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          openingBalance: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm block mb-1">Email</label>
                  <Input
                    className={inputClass}
                    value={form.email}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, email: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <label className="text-sm block mb-1">Address</label>
                  <Input
                    className={inputClass}
                    value={form.address}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, address: e.target.value }))
                    }
                  />
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm block mb-1">Op. Date</label>
                    <Input
                      className={inputClass}
                      type="date"
                      value={form.opDate}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, opDate: e.target.value }))
                      }
                    />
                  </div>

                  <div>
                    <label className="text-sm block mb-1">Op. Month</label>
                    <Input
                      className={inputClass}
                      value={form.opMonth}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, opMonth: e.target.value }))
                      }
                    />
                  </div>

                  <div>
                    <label className="text-sm block mb-1">
                      Last Purchase Date
                    </label>
                    <Input
                      className={inputClass}
                      type="date"
                      value={form.lastPurchaseDate}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          lastPurchaseDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm block mb-1">Warehouse</label>
                  <Select
                    value={form.warehouse || NONE}
                    onValueChange={(v) =>
                      setForm((p) => ({ ...p, warehouse: v === NONE ? "" : v }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Warehouse" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>No Warehouse</SelectItem>
                      {warehouses.map((w) => (
                        <SelectItem key={w._id} value={w._id}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm block mb-1">
                    Assigned Sales Manager
                  </label>
                  <Select
                    value={form.assignedSalesManager || NONE}
                    onValueChange={(v) =>
                      setForm((p) => ({
                        ...p,
                        assignedSalesManager: v === NONE ? "" : v,
                      }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Manager" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>None</SelectItem>
                      {users.map((u) => (
                        <SelectItem key={u._id} value={u._1d ?? u._id}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm block mb-1">Status</label>
                  <Select
                    value={form.status || NONE}
                    onValueChange={(v) =>
                      setForm((p) => ({ ...p, status: v === NONE ? "" : v }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Select Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm block mb-1">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, notes: e.target.value }))
                    }
                    className="w-full border rounded-md p-3 min-h-[120px] resize-vertical text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Phone Card */}
          <div className="bg-muted/20 border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h5 className="text-sm font-semibold">📞 Phone</h5>
            </div>

            <div className="flex gap-3 items-center">
              <Input
                className={inputClass}
                value={form.phoneNumber}
                onChange={(e) =>
                  setForm((p) => ({ ...p, phoneNumber: e.target.value }))
                }
              />
            </div>
          </div>

          {/* Attachments Card */}
          <div className="bg-muted/40 border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-semibold">📎 Attachments</h4>
              <div className="text-sm text-muted-foreground">
                Required & Optional
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Required */}
              <div>
                <div className="mb-3 font-medium text-sm">Required</div>
                <div className="space-y-3">
                  {REQUIRED_ATTACHMENTS.map((it) => {
                    const rawVal = form.attachments?.required?.[it.key];
                    const preview = getPreviewUrl(rawVal);
                    const pdf = isPdf(rawVal);

                    return (
                      <div
                        key={it.key}
                        className="flex items-center justify-between gap-4"
                      >
                        <div>
                          <div className="text-sm font-medium">{it.label}</div>
                          <div className="text-xs text-muted-foreground">
                            required
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <label className="inline-flex items-center gap-2 cursor-pointer">
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              onChange={async (e) => {
                                const f = e.target.files?.[0];
                                if (f) await setRequiredAttachment(it.key, f);
                              }}
                              className="hidden"
                            />
                            <div className="px-3 py-2 rounded-md bg-white border text-sm hover:opacity-90 transition">
                              + Upload
                            </div>
                          </label>

                          {preview ? (
                            <div className="flex items-center gap-2">
                              {pdf ? (
                                <a
                                  className="text-sm underline text-primary"
                                  href={preview}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  View PDF
                                </a>
                              ) : (
                                <div className="w-24 h-16 rounded-md overflow-hidden border">
                                  <img
                                    alt={it.label}
                                    src={preview}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}

                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                onClick={async () => {
                                  await setRequiredAttachment(it.key, null);
                                }}
                              >
                                Remove
                              </Button>
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground">
                              No file
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Optional */}
              <div>
                <div className="mb-3 font-medium text-sm">Optional</div>

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-sm">Pesticide Agreements</div>
                    <div className="text-xs text-muted-foreground">
                      optional
                    </div>
                  </div>

                  <div className="mb-3">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      multiple
                      onChange={(e) =>
                        addOptionalFiles("agreements", e.target.files)
                      }
                    />
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {(form.attachments?.optional?.agreements || []).map(
                      (u, idx) => {
                        const preview = getPreviewUrl(u);
                        const pdf = preview.toLowerCase().endsWith(".pdf");
                        return (
                          <div
                            key={idx}
                            className="relative group w-28 border rounded-md overflow-hidden"
                          >
                            <div className="p-2 flex items-center justify-center min-h-[72px] bg-white">
                              {pdf ? (
                                <a
                                  href={preview}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-sm underline text-primary"
                                >
                                  PDF
                                </a>
                              ) : (
                                <img
                                  src={preview}
                                  alt="agreements"
                                  className="w-full h-16 object-cover"
                                />
                              )}
                            </div>

                            <Button
                              type="button"
                              size="icon"
                              variant="destructive"
                              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition"
                              onClick={() =>
                                removeOptionalAttachment("agreements", idx)
                              }
                            >
                              ✕
                            </Button>
                          </div>
                        );
                      },
                    )}
                    {(!form.attachments?.optional?.agreements ||
                      form.attachments.optional.agreements.length === 0) && (
                      <div className="text-sm text-muted-foreground">
                        No agreements uploaded
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-sm">Other attachments</div>
                    <div className="text-xs text-muted-foreground">
                      optional
                    </div>
                  </div>

                  <div className="mb-3">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      multiple
                      onChange={(e) =>
                        addOptionalFiles("others", e.target.files)
                      }
                    />
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {(form.attachments?.optional?.others || []).map(
                      (u, idx) => {
                        const preview = getPreviewUrl(u);
                        const pdf = preview.toLowerCase().endsWith(".pdf");
                        return (
                          <div
                            key={idx}
                            className="relative group w-28 border rounded-md overflow-hidden"
                          >
                            <div className="p-2 flex items-center justify-center min-h-[72px] bg-white">
                              {pdf ? (
                                <a
                                  href={preview}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-sm underline text-primary"
                                >
                                  PDF
                                </a>
                              ) : (
                                <img
                                  src={preview}
                                  alt="other"
                                  className="w-full h-16 object-cover"
                                />
                              )}
                            </div>

                            <Button
                              type="button"
                              size="icon"
                              variant="destructive"
                              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition"
                              onClick={() =>
                                removeOptionalAttachment("others", idx)
                              }
                            >
                              ✕
                            </Button>
                          </div>
                        );
                      },
                    )}
                    {(!form.attachments?.optional?.others ||
                      form.attachments.optional.others.length === 0) && (
                      <div className="text-sm text-muted-foreground">
                        No other files uploaded
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-background border-t pt-4 flex justify-end gap-2 pb-4">
            <Button
              variant="ghost"
              onClick={async () => {
                setOpen(false);
                await cleanupTempFiles();
                resetModalForm();
              }}
              type="button"
            >
              Cancel
            </Button>
            <Button type="submit">{editing ? "Save" : "Create"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default DealerAddEditModal;
