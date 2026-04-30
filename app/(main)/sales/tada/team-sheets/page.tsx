"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, RefreshCw, Eye } from "lucide-react";

type SheetStatus = "open" | "submitted" | "checked" | "approved" | "rejected";

type Sheet = {
  _id: string;
  employeeName?: string;
  designation?: string;
  mobileNo?: string;
  territory?: string;
  area?: string;
  month: number;
  year: number;
  status: SheetStatus;
  grandTotalExpense?: number;
  workingDaysCount?: number;
};

function money(n: number | undefined) {
  return Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

export default function TeamSheetsPage() {
  const router = useRouter();

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Sheet[]>([]);
  const [status, setStatus] = useState<string>("");
  const [month, setMonth] = useState<number | "">(currentMonth);
  const [year, setYear] = useState<number>(currentYear);
  const [territory, setTerritory] = useState("");
  const [area, setArea] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/tada/sheets/team", {
        params: {
          status: status || undefined,
          month: month === "" ? undefined : month,
          year,
          territory: territory || undefined,
          area: area || undefined,
          page: 1,
          limit: 50,
        },
      });

      const data = res.data?.data || res.data;
      const list = data?.data || data?.items || data || [];
      setItems(Array.isArray(list) ? list : []);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load team sheets",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const total = useMemo(() => items.length, [items]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <div className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Team Sheets</h1>
              <p className="text-sm text-muted-foreground">
                Review team monthly sheets and workflow status
              </p>
            </div>

            <Button
              variant="outline"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <div className="space-y-2">
              <div className="text-sm font-medium">Status</div>
              <Input
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                placeholder="submitted"
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Month</div>
              <Input
                type="number"
                min={1}
                max={12}
                value={month}
                onChange={(e) =>
                  setMonth(e.target.value ? Number(e.target.value) : "")
                }
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

            <div className="space-y-2">
              <div className="text-sm font-medium">Territory</div>
              <Input
                value={territory}
                onChange={(e) => setTerritory(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Area</div>
              <Input value={area} onChange={(e) => setArea(e.target.value)} />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button onClick={() => void load()}>Apply Filters</Button>
            <Button
              variant="outline"
              onClick={() => {
                setStatus("");
                setMonth(currentMonth);
                setYear(currentYear);
                setTerritory("");
                setArea("");
              }}
            >
              Clear
            </Button>
          </div>
        </div>

        <div className="mb-4 text-sm text-muted-foreground">
          Total sheets:{" "}
          <span className="font-semibold text-foreground">{total}</span>
        </div>

        <div className="grid gap-4">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : items.length ? (
            items.map((sheet) => (
              <Card key={sheet._id} className="border-slate-200 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold">
                          {monthName(sheet.month)} {sheet.year}
                        </h2>
                        <StatusBadge status={sheet.status} />
                      </div>

                      <p className="mt-1 text-sm text-muted-foreground">
                        {sheet.employeeName || "-"} · {sheet.designation || "-"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {sheet.mobileNo || "-"} · {sheet.territory || "-"} ·{" "}
                        {sheet.area || "-"}
                      </p>

                      <p className="mt-2 text-sm">
                        Total:{" "}
                        <span className="font-semibold">
                          {money(sheet.grandTotalExpense)} BDT
                        </span>{" "}
                        · Working Days:{" "}
                        <span className="font-semibold">
                          {sheet.workingDaysCount || 0}
                        </span>
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      onClick={() =>
                        router.push(`/sales/tada/monthly/${sheet._id}`)
                      }
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Open
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                No team sheets found.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
