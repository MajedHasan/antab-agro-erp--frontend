"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";

type SheetStatus =
  | "open"
  | "submitted"
  | "checked"
  | "approved"
  | "rejected"
  | null;

type MonthlyOverviewItem = {
  _id?: string;
  month: number;
  year: number;
  status: SheetStatus;
  grandTotalExpense: number;
  workingDaysCount: number;
  employeeName?: string;
  designation?: string;
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function money(n: number | undefined) {
  return Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function StatusBadge({ status }: { status: SheetStatus }) {
  if (!status) {
    return (
      <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
        not created
      </span>
    );
  }

  const styles: Record<Exclude<SheetStatus, null>, string> = {
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

export default function MonthlyPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<MonthlyOverviewItem[]>([]);

  const currentYear = new Date().getFullYear();

  const loadSheets = async () => {
    setLoading(true);
    try {
      const res = await api.get("/tada/sheets/overview", {
        params: { year: currentYear },
      });

      const data = res.data?.data || res.data || [];
      setItems(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load monthly overview",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSheets();
  }, []);

  const sheetMap = useMemo(() => {
    const map = new Map<number, MonthlyOverviewItem>();
    items.forEach((item) => {
      map.set(item.month, item);
    });
    return map;
  }, [items]);

  const openMonth = (month: number) => {
    const existing = sheetMap.get(month);

    if (existing?._id) {
      router.push(`/sales/tada/monthly/${existing._id}`);
      return;
    }

    // If there is no sheet yet, the correct next step is to create a daily entry.
    // The monthly sheet will auto-create on the first daily entry submission.
    router.push(
      `/sales/tada/entries/create?month=${month}&year=${currentYear}`,
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl p-4 md:p-6">
        <div className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Monthly TADA</h1>
              <p className="text-sm text-muted-foreground">
                View your month-wise TADA sheet status and totals
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => void loadSheets()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="mb-4 text-sm text-muted-foreground">
          Year:{" "}
          <span className="font-medium text-foreground">{currentYear}</span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {loading ? (
            <div className="col-span-full flex justify-center py-20">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            MONTHS.map((name, i) => {
              const month = i + 1;
              const sheet = sheetMap.get(month);

              return (
                <Card
                  key={month}
                  className="cursor-pointer transition hover:shadow-md"
                  onClick={() => openMonth(month)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-medium">{name}</h2>
                        <p className="text-xs text-muted-foreground">
                          {month}/{currentYear}
                        </p>
                      </div>

                      <StatusBadge status={sheet?.status ?? null} />
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Grand Total</div>
                        <div className="mt-1 text-base font-semibold">
                          {sheet
                            ? `${money(sheet.grandTotalExpense)} BDT`
                            : "—"}
                        </div>
                      </div>

                      <div>
                        <div className="text-muted-foreground">
                          Working Days
                        </div>
                        <div className="mt-1 text-base font-semibold">
                          {sheet ? sheet.workingDaysCount : "—"}
                        </div>
                      </div>
                    </div>

                    {sheet?._id ? (
                      <div className="mt-4 text-xs text-muted-foreground">
                        Open sheet details
                      </div>
                    ) : (
                      <div className="mt-4 text-xs text-muted-foreground">
                        No sheet yet. Start by submitting a daily entry.
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
