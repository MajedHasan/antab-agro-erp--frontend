"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft } from "lucide-react";

type Entry = {
  _id: string;
  entryDate: string;
  visitedPlaces?: string[];
  meterReadingStart?: number;
  meterReadingEnd?: number;
  totalTravelKm?: number;
  totalFuelCost?: number;
  maintenance?: number;
  conveyance?: number;
  da?: number;
  nh?: number;
  totalDailyExpense?: number;
  remarks?: string;
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

export default function EntryViewPage() {
  const params = useParams();
  const router = useRouter();

  const id = String(params?.id || "");

  const [loading, setLoading] = useState(false);
  const [entry, setEntry] = useState<Entry | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/tada/entries/${id}`);
      setEntry(res.data?.data || res.data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load entry");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) void load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Entry not found</p>
            <Button className="mt-4" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl p-4 md:p-6">
        <div className="mb-6 flex items-center gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Daily Entry</CardTitle>
          </CardHeader>

          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-sm text-muted-foreground">Date</div>
              <div className="font-medium">{fmtDate(entry.entryDate)}</div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground">Places</div>
              <div className="font-medium">
                {(entry.visitedPlaces || []).join(", ") || "-"}
              </div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground">Meter Start</div>
              <div className="font-medium">
                {money(entry.meterReadingStart)}
              </div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground">Meter End</div>
              <div className="font-medium">{money(entry.meterReadingEnd)}</div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground">Travel KM</div>
              <div className="font-medium">{money(entry.totalTravelKm)}</div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground">Fuel Cost</div>
              <div className="font-medium">{money(entry.totalFuelCost)}</div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground">DA</div>
              <div className="font-medium">{money(entry.da)}</div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground">NH</div>
              <div className="font-medium">{money(entry.nh)}</div>
            </div>

            <div className="md:col-span-2">
              <div className="text-sm text-muted-foreground">Total Expense</div>
              <div className="text-lg font-semibold">
                {money(entry.totalDailyExpense)}
              </div>
            </div>

            <div className="md:col-span-2">
              <div className="text-sm text-muted-foreground">Remarks</div>
              <div className="font-medium">{entry.remarks || "-"}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
