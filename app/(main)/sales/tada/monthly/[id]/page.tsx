"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Send,
  PencilLine,
} from "lucide-react";

type SheetStatus = "open" | "submitted" | "checked" | "approved" | "rejected";

type EntryRecord = {
  _id: string;
  entryDate: string;
  visitedPlaces?: string[];
  meterReadingStart?: number;
  meterReadingEnd?: number;
  totalTravelKm?: number;
  takaPerKm?: number;
  totalFuelCost?: number;
  maintenance?: number;
  conveyance?: number;
  da?: number;
  nh?: number;
  totalDailyExpense?: number;
  remarks?: string;
  isEdited?: boolean;
  editedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

type MonthlySheetRecord = {
  _id: string;
  employeeId?: any;
  employeeName?: string;
  designation?: string;
  mobileNo?: string;
  territory?: string;
  area?: string;
  month: number;
  year: number;
  status: SheetStatus;

  totalTravelKmMonth?: number;
  totalFuelCostMonth?: number;
  totalMaintenanceMonth?: number;
  totalConveyanceMonth?: number;
  totalDAMonth?: number;
  totalNHMonth?: number;
  totalDailyExpensesMonth?: number;
  workingDaysCount?: number;

  entertainmentFood?: number;
  motorcycleRent?: number;
  photocopy?: number;
  stationary?: number;
  others?: number;

  grandTotalExpense?: number;
  grandTotalInWords?: string;

  submittedAt?: string;
  checkedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
};

type SheetFullResponse = {
  sheet: MonthlySheetRecord;
  entries: EntryRecord[];
};

function money(n: number | undefined) {
  return Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(value?: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function monthName(month: number) {
  return new Intl.DateTimeFormat("en-US", { month: "long" }).format(
    new Date(2000, month - 1, 1),
  );
}

function StatusBadge({ status }: { status: SheetStatus }) {
  const styles: Record<SheetStatus, string> = {
    open: "bg-slate-100 text-slate-700 border-slate-200",
    submitted: "bg-blue-100 text-blue-700 border-blue-200",
    checked: "bg-amber-100 text-amber-700 border-amber-200",
    approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
    rejected: "bg-red-100 text-red-700 border-red-200",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${styles[status]}`}
    >
      {status}
    </span>
  );
}

function getCurrentUser(): any {
  if (typeof window === "undefined") return null;

  const keys = ["user", "authUser", "currentUser"];
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed) return parsed;
    } catch {
      // ignore malformed localStorage payloads
    }
  }

  return null;
}

function getCurrentUserRole(): string | null {
  const user = getCurrentUser();
  return user?.role || user?.userRole || null;
}

export default function TadaMonthlySheetDetailPage() {
  const router = useRouter();
  const params = useParams();
  const sheetId = String((params as any)?.id || "");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [sheet, setSheet] = useState<MonthlySheetRecord | null>(null);
  const [entries, setEntries] = useState<EntryRecord[]>([]);

  const [expenses, setExpenses] = useState({
    entertainmentFood: 0,
    motorcycleRent: 0,
    photocopy: 0,
    stationary: 0,
    others: 0,
  });

  const role = getCurrentUserRole();

  const loadSheet = useCallback(async () => {
    if (!sheetId) return;

    setLoading(true);
    try {
      const res = await api.get(`/tada/sheets/${sheetId}/full`);
      const payload = res.data?.data as SheetFullResponse | any;

      const loadedSheet = payload?.sheet || payload?.data?.sheet || null;
      const loadedEntries = payload?.entries || payload?.data?.entries || [];

      setSheet(loadedSheet);
      setEntries(loadedEntries);

      if (loadedSheet) {
        setExpenses({
          entertainmentFood: Number(loadedSheet.entertainmentFood || 0),
          motorcycleRent: Number(loadedSheet.motorcycleRent || 0),
          photocopy: Number(loadedSheet.photocopy || 0),
          stationary: Number(loadedSheet.stationary || 0),
          others: Number(loadedSheet.others || 0),
        });
      }
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load monthly sheet.",
      );
    } finally {
      setLoading(false);
    }
  }, [sheetId]);

  useEffect(() => {
    void loadSheet();
  }, [loadSheet]);

  const isSalesperson = role === "salesperson";
  const isManager = role === "manager";
  const isAdmin = role === "admin";
  const isSuperAdmin = role === "super_admin";

  const canEditSheet = sheet?.status === "open" && isSalesperson;
  const canSubmit = sheet?.status === "open" && isSalesperson;
  const canCheck = sheet?.status === "submitted" && isManager;
  const canApprove = sheet?.status === "checked" && (isAdmin || isSuperAdmin);
  const canReject =
    sheet?.status === "submitted" ||
    sheet?.status === "checked" ||
    sheet?.status === "rejected";

  const canEditEntry =
    !!sheet &&
    (sheet.status !== "approved" || isSuperAdmin) &&
    (isManager || isAdmin || isSuperAdmin);

  const summary = useMemo(() => {
    return {
      totalTravelKmMonth: Number(sheet?.totalTravelKmMonth || 0),
      totalFuelCostMonth: Number(sheet?.totalFuelCostMonth || 0),
      totalMaintenanceMonth: Number(sheet?.totalMaintenanceMonth || 0),
      totalConveyanceMonth: Number(sheet?.totalConveyanceMonth || 0),
      totalDAMonth: Number(sheet?.totalDAMonth || 0),
      totalNHMonth: Number(sheet?.totalNHMonth || 0),
      totalDailyExpensesMonth: Number(sheet?.totalDailyExpensesMonth || 0),
      workingDaysCount: Number(sheet?.workingDaysCount || 0),
      grandTotalExpense: Number(sheet?.grandTotalExpense || 0),
    };
  }, [sheet]);

  const handleExpenseChange = (field: keyof typeof expenses, value: string) => {
    setExpenses((prev) => ({
      ...prev,
      [field]: Number(value || 0),
    }));
  };

  const handleSubmitSheet = async () => {
    if (!sheet) return;

    if (!confirm("Submit this monthly sheet for review?")) return;

    setSaving(true);
    try {
      const res = await api.post(`/tada/sheets/${sheet._id}/submit`, expenses);

      toast.success("Monthly sheet submitted.");
      await loadSheet();
      return res.data;
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to submit monthly sheet.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCheckSheet = async () => {
    if (!sheet) return;

    if (!confirm("Mark this sheet as checked?")) return;

    setActionLoading("check");
    try {
      await api.post(`/tada/sheets/${sheet._id}/check`);
      toast.success("Monthly sheet checked.");
      await loadSheet();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to check monthly sheet.",
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveSheet = async () => {
    if (!sheet) return;

    if (!confirm("Approve this monthly sheet?")) return;

    setActionLoading("approve");
    try {
      await api.post(`/tada/sheets/${sheet._id}/approve`);
      toast.success("Monthly sheet approved.");
      await loadSheet();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to approve monthly sheet.",
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectSheet = async () => {
    if (!sheet) return;

    const reason = window.prompt("Enter rejection reason:");
    if (!reason || !reason.trim()) {
      toast.error("Rejection reason is required.");
      return;
    }

    setActionLoading("reject");
    try {
      await api.post(`/tada/sheets/${sheet._id}/reject`, {
        reason: reason.trim(),
      });
      toast.success("Monthly sheet rejected.");
      await loadSheet();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to reject monthly sheet.",
      );
    } finally {
      setActionLoading(null);
    }
  };

  const openEntryEdit = (entryId: string) => {
    router.push(`/sales/tada/entries/${entryId}/edit`);
  };

  const openEntryView = (entryId: string) => {
    router.push(`/sales/tada/entries/${entryId}`);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!sheet) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">
              Monthly sheet not found.
            </p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => router.back()}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        {/* HEADER */}
        <div className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <Button variant="outline" onClick={() => router.back()}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button variant="outline" onClick={loadSheet}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              </div>

              <h1 className="text-2xl font-semibold">
                {monthName(sheet.month)} {sheet.year} TADA Sheet
              </h1>
              <p className="text-sm text-muted-foreground">
                {sheet.employeeName || "-"} · {sheet.designation || "-"} ·{" "}
                {sheet.mobileNo || "-"}
              </p>
              <p className="text-sm text-muted-foreground">
                {sheet.territory || "-"} · {sheet.area || "-"}
              </p>
            </div>

            <div className="flex flex-col items-start gap-2 md:items-end">
              <StatusBadge status={sheet.status} />
              <div className="text-sm text-muted-foreground">
                Working days:{" "}
                <span className="font-medium text-foreground">
                  {summary.workingDaysCount}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                Grand total:{" "}
                <span className="font-semibold text-foreground">
                  {money(summary.grandTotalExpense)} BDT
                </span>
              </div>
            </div>
          </div>

          {sheet.status === "rejected" && sheet.rejectionReason ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <span className="font-medium">Rejection reason:</span>{" "}
              {sheet.rejectionReason}
            </div>
          ) : null}
        </div>

        {/* SUMMARY CARDS */}
        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">
                Total Travel KM
              </div>
              <div className="mt-1 text-2xl font-semibold">
                {money(summary.totalTravelKmMonth)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">
                Total Fuel Cost
              </div>
              <div className="mt-1 text-2xl font-semibold">
                {money(summary.totalFuelCostMonth)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">
                Daily Expenses
              </div>
              <div className="mt-1 text-2xl font-semibold">
                {money(summary.totalDailyExpensesMonth)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Grand Total</div>
              <div className="mt-1 text-2xl font-semibold">
                {money(summary.grandTotalExpense)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ADDITIONAL EXPENSES */}
        <Card className="mb-6 border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Additional Monthly Expenses</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-2">
              <div className="text-sm font-medium">Entertainment / Food</div>
              <Input
                type="number"
                value={expenses.entertainmentFood}
                onChange={(e) =>
                  handleExpenseChange("entertainmentFood", e.target.value)
                }
                disabled={!canEditSheet}
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Motorcycle Rent</div>
              <Input
                type="number"
                value={expenses.motorcycleRent}
                onChange={(e) =>
                  handleExpenseChange("motorcycleRent", e.target.value)
                }
                disabled={!canEditSheet}
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Photocopy</div>
              <Input
                type="number"
                value={expenses.photocopy}
                onChange={(e) =>
                  handleExpenseChange("photocopy", e.target.value)
                }
                disabled={!canEditSheet}
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Stationary</div>
              <Input
                type="number"
                value={expenses.stationary}
                onChange={(e) =>
                  handleExpenseChange("stationary", e.target.value)
                }
                disabled={!canEditSheet}
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Others</div>
              <Input
                type="number"
                value={expenses.others}
                onChange={(e) => handleExpenseChange("others", e.target.value)}
                disabled={!canEditSheet}
              />
            </div>
          </CardContent>

          {canSubmit ? (
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={handleSubmitSheet}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Submit Sheet
                </Button>
              </div>
            </CardContent>
          ) : null}
        </Card>

        {/* ACTIONS */}
        <Card className="mb-6 border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Workflow Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {canCheck ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleCheckSheet}
                disabled={actionLoading !== null}
              >
                {actionLoading === "check" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Check
              </Button>
            ) : null}

            {canApprove ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleApproveSheet}
                disabled={actionLoading !== null}
              >
                {actionLoading === "approve" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Approve
              </Button>
            ) : null}

            {canReject ? (
              <Button
                type="button"
                variant="outline"
                className="text-red-600 hover:text-red-700"
                onClick={handleRejectSheet}
                disabled={actionLoading !== null}
              >
                {actionLoading === "reject" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="mr-2 h-4 w-4" />
                )}
                Reject
              </Button>
            ) : null}
          </CardContent>
        </Card>

        {/* ENTRIES TABLE */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Daily Entries</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-slate-100 text-left">
                  <tr>
                    <th className="border-b px-4 py-3">Date</th>
                    <th className="border-b px-4 py-3">Places</th>
                    <th className="border-b px-4 py-3">Meter</th>
                    <th className="border-b px-4 py-3">KM</th>
                    <th className="border-b px-4 py-3">Fuel</th>
                    <th className="border-b px-4 py-3">DA</th>
                    <th className="border-b px-4 py-3">NH</th>
                    <th className="border-b px-4 py-3 text-right">Total</th>
                    <th className="border-b px-4 py-3">Remarks</th>
                    <th className="border-b px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {entries.length ? (
                    entries.map((entry) => (
                      <tr
                        key={entry._id}
                        className="border-b last:border-0 hover:bg-slate-50"
                      >
                        <td className="px-4 py-3">
                          {fmtDate(entry.entryDate)}
                        </td>
                        <td className="px-4 py-3">
                          {(entry.visitedPlaces || []).length
                            ? entry.visitedPlaces?.join(", ")
                            : "-"}
                        </td>
                        <td className="px-4 py-3">
                          {money(entry.meterReadingStart)} →{" "}
                          {money(entry.meterReadingEnd)}
                        </td>
                        <td className="px-4 py-3">
                          {money(entry.totalTravelKm)}
                        </td>
                        <td className="px-4 py-3">
                          {money(entry.totalFuelCost)}
                        </td>
                        <td className="px-4 py-3">{money(entry.da)}</td>
                        <td className="px-4 py-3">{money(entry.nh)}</td>
                        <td className="px-4 py-3 text-right font-medium">
                          {money(entry.totalDailyExpense)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="max-w-[280px] truncate">
                            {entry.remarks || "-"}
                          </div>
                          {entry.isEdited ? (
                            <div className="text-xs text-muted-foreground">
                              Edited {fmtDate(entry.editedAt)}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openEntryView(entry._id)}
                            >
                              View
                            </Button>

                            {canEditEntry ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => openEntryEdit(entry._id)}
                              >
                                <PencilLine className="mr-2 h-4 w-4" />
                                Edit
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-4 py-12 text-center text-muted-foreground"
                      >
                        No daily entries found for this month.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* TOTALS FOOTER */}
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">
                Grand Total in Words
              </div>
              <div className="mt-1 text-sm font-medium">
                {sheet.grandTotalInWords || "-"}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Submitted At</div>
              <div className="mt-1 text-sm font-medium">
                {fmtDate(sheet.submittedAt)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Last Updated</div>
              <div className="mt-1 text-sm font-medium">
                {fmtDate((sheet as any).updatedAt)}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
