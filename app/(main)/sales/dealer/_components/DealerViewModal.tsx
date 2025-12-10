import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import React from "react";

const DealerViewModal = ({
  viewing,
  setViewing,
  statusBadge,
  Section,
  InfoRow,
  getName,
  filePreview,
}) => {
  return (
    <>
      <Dialog open={!!viewing} onOpenChange={() => setViewing(null)}>
        <DialogContent className="!w-[950px] !max-w-[95vw] max-h-[90vh] overflow-y-auto p-0 rounded-xl shadow-2xl bg-background border">
          <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <h2 className="text-2xl font-bold">{viewing?.name}</h2>
                <p className="text-sm text-muted-foreground">
                  ID: {viewing?._id}
                </p>
                <p className="text-sm text-muted-foreground">
                  Code: {viewing?.code}
                </p>
              </div>
              <div>{statusBadge(viewing?.status)}</div>
            </div>

            {/* Sections */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-4">
                <Section title="Contact Info">
                  <InfoRow label="Phone" value={viewing?.phoneNumber} />
                  <InfoRow label="Email" value={viewing?.email} />
                  <InfoRow label="Address" value={viewing?.address} />
                </Section>

                <Section title="Dealer Type & Finance">
                  <InfoRow label="Type" value={viewing?.type} />
                  <InfoRow label="Credit Limit" value={viewing?.creditLimit} />
                  <InfoRow
                    label="Opening Balance"
                    value={viewing?.openingBalance}
                  />
                </Section>

                <Section title="Notes & Dates">
                  <InfoRow label="Notes" value={viewing?.notes} />
                  <InfoRow
                    label="Last Purchase"
                    value={
                      viewing?.lastPurchaseDate
                        ? new Date(
                            viewing.lastPurchaseDate
                          ).toLocaleDateString()
                        : "-"
                    }
                  />
                  <InfoRow
                    label="Op Date / Month"
                    value={`${viewing?.opDate ?? "-"} / ${
                      viewing?.opMonth ?? "-"
                    }`}
                  />
                </Section>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                <Section title="Location Info">
                  <InfoRow
                    label="Zone / Region"
                    value={`${getName(viewing?.zone)} / ${getName(
                      viewing?.region
                    )}`}
                  />

                  <InfoRow
                    label="Area / Territory"
                    value={`${getName(viewing?.area)} / ${getName(
                      viewing?.territory
                    )}`}
                  />

                  <InfoRow
                    label="Warehouse"
                    value={getName(viewing?.warehouse)}
                  />

                  <InfoRow label="Proprietor" value={viewing?.proprietor} />
                </Section>

                <Section title="Assignments">
                  <InfoRow
                    label="Assigned Sales Manager"
                    value={getName(viewing?.assignedSalesManager)}
                  />

                  <InfoRow
                    label="Created By"
                    value={getName(viewing?.createdBy)}
                  />
                </Section>
              </div>
            </div>

            {/* Attachments */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">
                Attachments
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Required */}
                <div>
                  <h4 className="font-medium text-sm mb-2">Required</h4>
                  <div className="space-y-2">
                    {viewing?.attachments?.required ? (
                      Object.entries(viewing.attachments.required).map(
                        ([k, v]: any) => (
                          <div key={k} className="flex items-center gap-3">
                            <span className="w-28 font-medium text-sm">
                              {k}
                            </span>
                            {v ? (
                              v.endsWith(".pdf") ? (
                                <a
                                  href={filePreview(v)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-600 underline hover:text-blue-800"
                                >
                                  View PDF
                                </a>
                              ) : (
                                <img
                                  src={filePreview(v)}
                                  alt={k}
                                  className="w-28 h-20 object-cover rounded border hover:shadow-lg transition"
                                />
                              )
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                No file
                              </span>
                            )}
                          </div>
                        )
                      )
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        No required files
                      </span>
                    )}
                  </div>
                </div>

                {/* Optional */}
                <div>
                  <h4 className="font-medium text-sm mb-2">Optional</h4>
                  {viewing?.attachments?.optional &&
                    ["agreements", "others"].map((key) => {
                      const files =
                        viewing.attachments?.optional?.[
                          key as keyof IAttachments["optional"]
                        ] || [];
                      return (
                        <div key={key} className="mb-3">
                          <div className="font-medium text-sm capitalize">
                            {key}
                          </div>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {files.length > 0 ? (
                              files.map((u: string, i: number) => (
                                <div
                                  key={i}
                                  className="border rounded p-2 hover:shadow-md transition flex items-center justify-center"
                                >
                                  {u.endsWith(".pdf") ? (
                                    <a
                                      href={filePreview(u)}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-blue-600 underline hover:text-blue-800"
                                    >
                                      PDF
                                    </a>
                                  ) : (
                                    <img
                                      src={filePreview(u)}
                                      alt={key}
                                      className="w-28 h-20 object-cover rounded"
                                    />
                                  )}
                                </div>
                              ))
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                No files
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end border-t pt-4">
              <Button variant="ghost" onClick={() => setViewing(null)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DealerViewModal;
