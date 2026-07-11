"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  ArrowLeft,
  Send,
  CalendarDays,
  MapPin,
  Gauge,
} from "lucide-react";

type TadaCreateForm = {
  entryDate: string;
  visitedPlaces: string;
  meterReadingStart: string;
  meterReadingEnd: string;
  maintenance: string;
  conveyance: string;
  da: string;
  nh: string;
  remarks: string;
};

type CurrentUser = {
  _id?: string;
  id?: string;
  name?: string;
  designation?: string;
  mobileNo?: string;
  phone?: string;
  territory?: string;
  area?: string;
  role?: string;
};

function getTodayLocalInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toNumber(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function parseUserFromStorage(): CurrentUser | null {
  if (typeof window === "undefined") return null;

  const keys = ["user", "authUser", "currentUser"];
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw);
      if (parsed) return parsed as CurrentUser;
    } catch {
      // ignore malformed auth payloads
    }
  }

  return null;
}

function getDateOnly(dateString: string) {
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function validateBackdateRule(entryDateValue: string) {
  const entryDate = getDateOnly(entryDateValue);
  if (!entryDate) {
    throw new Error("Please select a valid entry date.");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (entryDate > today) {
    throw new Error("Entry date cannot be in the future.");
  }

  const diffDays = Math.floor(
    (today.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays > 3) {
    throw new Error("You can only submit entries up to 3 days backdated.");
  }
}

function TadaEntryCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const monthFromQuery = searchParams.get("month");
  const yearFromQuery = searchParams.get("year");

  const [user, setUser] = useState<CurrentUser | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<TadaCreateForm>({
    entryDate: getTodayLocalInputValue(),
    visitedPlaces: "",
    meterReadingStart: "",
    meterReadingEnd: "",
    maintenance: "0",
    conveyance: "0",
    da: "0",
    nh: "0",
    remarks: "",
  });

  useEffect(() => {
    setUser(parseUserFromStorage());
  }, []);

  const userId = useMemo(() => user?._id || user?.id || "", [user]);

  const employeeSnapshot = useMemo(
    () => ({
      employeeId: userId,
      employeeName: user?.name || "",
      designation: user?.designation || "",
      mobileNo: user?.mobileNo || user?.phone || "",
      territory: user?.territory || "",
      area: user?.area || "",
    }),
    [user, userId],
  );

  const monthLabel = useMemo(() => {
    if (!monthFromQuery || !yearFromQuery) return null;

    const month = Number(monthFromQuery);
    const year = Number(yearFromQuery);

    if (!Number.isFinite(month) || !Number.isFinite(year)) return null;

    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
    }).format(new Date(year, month - 1, 1));
  }, [monthFromQuery, yearFromQuery]);

  const handleChange = (field: keyof TadaCreateForm, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async () => {
    try {
      if (!userId) {
        toast.error("User session not found. Please sign in again.");
        return;
      }

      validateBackdateRule(form.entryDate);

      const start = toNumber(form.meterReadingStart);
      const end = toNumber(form.meterReadingEnd);

      if (!form.meterReadingStart.trim()) {
        toast.error("Meter reading start is required.");
        return;
      }

      if (!form.meterReadingEnd.trim()) {
        toast.error("Meter reading end is required.");
        return;
      }

      if (start < 0 || end < 0) {
        toast.error("Meter readings cannot be negative.");
        return;
      }

      if (end < start) {
        toast.error(
          "Meter reading end must be greater than or equal to start.",
        );
        return;
      }

      const places = form.visitedPlaces
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);

      setSaving(true);

      const payload = {
        entryDate: form.entryDate,
        visitedPlaces: places,
        meterReadingStart: start,
        meterReadingEnd: end,
        maintenance: toNumber(form.maintenance),
        conveyance: toNumber(form.conveyance),
        da: toNumber(form.da),
        nh: toNumber(form.nh),
        remarks: form.remarks,

        // Compatibility snapshot fields.
        employeeId: employeeSnapshot.employeeId,
        employeeName: employeeSnapshot.employeeName,
        designation: employeeSnapshot.designation,
        mobileNo: employeeSnapshot.mobileNo,
        territory: employeeSnapshot.territory,
        area: employeeSnapshot.area,
      };

      const res = await api.post("/tada/entries/submit", payload);
      const created = res.data?.data || res.data;

      toast.success("Daily entry submitted successfully.");

      const sheetId =
        created?.tadaMonthlySheetId?._id ||
        created?.tadaMonthlySheetId ||
        created?.sheetId ||
        created?.monthlySheetId;

      if (sheetId) {
        router.push(`/sales/tada/monthly/${sheetId}`);
        return;
      }

      router.push("/sales/tada/monthly");
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to submit daily entry.",
      );
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = Boolean(userId) && !saving;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl p-4 md:p-6">
        <div className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Daily TADA Entry</h1>
              <p className="text-sm text-muted-foreground">
                Submit one daily travel entry
                {monthLabel ? ` · ${monthLabel}` : ""}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>

              <Button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Submit Entry
              </Button>
            </div>
          </div>
        </div>

        {!userId ? (
          <Card className="mb-6 border-amber-200 bg-amber-50">
            <CardContent className="p-4 text-sm text-amber-800">
              No user session found in the browser. The form can still be
              filled, but submission will be blocked until the login state is
              available.
            </CardContent>
          </Card>
        ) : null}

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Travel Details</CardTitle>
          </CardHeader>

          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CalendarDays className="h-4 w-4" />
                Entry Date
              </div>
              <Input
                type="date"
                value={form.entryDate}
                onChange={(e) => handleChange("entryDate", e.target.value)}
                max={getTodayLocalInputValue()}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <MapPin className="h-4 w-4" />
                Visited Places
              </div>
              <Input
                value={form.visitedPlaces}
                onChange={(e) => handleChange("visitedPlaces", e.target.value)}
                placeholder="Comma separated places"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Gauge className="h-4 w-4" />
                Meter Reading Start
              </div>
              <Input
                type="number"
                min={0}
                value={form.meterReadingStart}
                onChange={(e) =>
                  handleChange("meterReadingStart", e.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Gauge className="h-4 w-4" />
                Meter Reading End
              </div>
              <Input
                type="number"
                min={0}
                value={form.meterReadingEnd}
                onChange={(e) =>
                  handleChange("meterReadingEnd", e.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Maintenance</div>
              <Input
                type="number"
                min={0}
                value={form.maintenance}
                onChange={(e) => handleChange("maintenance", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Conveyance</div>
              <Input
                type="number"
                min={0}
                value={form.conveyance}
                onChange={(e) => handleChange("conveyance", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">DA</div>
              <Input
                type="number"
                min={0}
                value={form.da}
                onChange={(e) => handleChange("da", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">NH</div>
              <Input
                type="number"
                min={0}
                value={form.nh}
                onChange={(e) => handleChange("nh", e.target.value)}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <div className="text-sm font-medium">Remarks</div>
              <Textarea
                value={form.remarks}
                onChange={(e) => handleChange("remarks", e.target.value)}
                placeholder="Optional remarks"
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6 border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Employee Snapshot</CardTitle>
          </CardHeader>

          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm font-medium">Employee Name</div>
              <Input value={employeeSnapshot.employeeName} disabled />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Designation</div>
              <Input value={employeeSnapshot.designation} disabled />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Mobile No</div>
              <Input value={employeeSnapshot.mobileNo} disabled />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Territory</div>
              <Input value={employeeSnapshot.territory} disabled />
            </div>

            <div className="space-y-2 md:col-span-2">
              <div className="text-sm font-medium">Area</div>
              <Input value={employeeSnapshot.area} disabled />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}



export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TadaEntryCreatePage />
    </Suspense>
  );
}