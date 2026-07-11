"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, RefreshCw, Plus, Eye, PencilLine } from "lucide-react";

type Entry = {
  _id: string;
  entryDate: string;
  visitedPlaces?: string[];
  meterReadingStart?: number;
  meterReadingEnd?: number;
  totalTravelKm?: number;
  totalFuelCost?: number;
  totalDailyExpense?: number;
  remarks?: string;
  month?: number;
  year?: number;
  isEdited?: boolean;
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
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(d);
}

function getCurrentUserId() {
  if (typeof window === "undefined") return "";
  const keys = ["user", "authUser", "currentUser"];
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      return parsed?._id || parsed?.id || "";
    } catch {
      // ignore
    }
  }
  return "";
}

function MyEntriesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState(
    Number(searchParams.get("month") || currentMonth),
  );
  const [year, setYear] = useState(
    Number(searchParams.get("year") || currentYear),
  );
  const [entries, setEntries] = useState<Entry[]>([]);
  const [userId, setUserId] = useState("");

  useEffect(() => {
    setUserId(getCurrentUserId());
  }, []);

  const loadEntries = async () => {
    if (!userId) {
      toast.error("User session not found.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.get("/tada/entries/my", {
        params: { month, year },
      });

      const data = res.data?.data || res.data || [];
      setEntries(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load entries",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) void loadEntries();
  }, [userId, month, year]);

  const totalExpense = useMemo(() => {
    return entries.reduce(
      (sum, item) => sum + Number(item.totalDailyExpense || 0),
      0,
    );
  }, [entries]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <div className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">My Daily Entries</h1>
              <p className="text-sm text-muted-foreground">
                View and manage your submitted daily TADA entries
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => void loadEntries()}
                disabled={loading}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>

              <Button onClick={() => router.push("/sales/tada/entries/create")}>
                <Plus className="mr-2 h-4 w-4" />
                New Entry
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <div className="text-sm font-medium">Month</div>
              <Input
                type="number"
                min={1}
                max={12}
                value={month}
                onChange={(e) => setMonth(Number(e.target.value || 1))}
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Year</div>
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value || currentYear))}
              />
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => void loadEntries()}
              >
                Apply Filters
              </Button>
            </div>
          </div>
        </div>

        <div className="mb-4 text-sm text-muted-foreground">
          Total expense for selected month:{" "}
          <span className="font-semibold text-foreground">
            {money(totalExpense)} BDT
          </span>
        </div>

        <div className="grid gap-4">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : entries.length ? (
            entries.map((entry) => (
              <Card key={entry._id} className="border-slate-200 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">
                        {fmtDate(entry.entryDate)}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Places: {(entry.visitedPlaces || []).join(", ") || "-"}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        KM: {money(entry.totalTravelKm)} · Fuel:{" "}
                        {money(entry.totalFuelCost)} · Total:{" "}
                        {money(entry.totalDailyExpense)} BDT
                      </p>
                      {entry.remarks ? (
                        <p className="mt-2 text-sm">
                          Remarks:{" "}
                          <span className="text-muted-foreground">
                            {entry.remarks}
                          </span>
                        </p>
                      ) : null}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          router.push(`/sales/tada/entries/${entry._id}`)
                        }
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          router.push(`/sales/tada/entries/${entry._id}/edit`)
                        }
                      >
                        <PencilLine className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                    </div>
                  </div>

                  {entry.isEdited ? (
                    <div className="mt-3 text-xs text-muted-foreground">
                      Edited entry
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                No entries found for this month.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}


export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MyEntriesPage />
    </Suspense>
  );
}
