"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Plus, PencilLine, RefreshCw } from "lucide-react";

type Rate = {
  _id: string;
  rateType: "global" | "employee" | "territory" | "designation";
  takaPerKm: number;
  defaultDA?: number;
  defaultNH?: number;
  applicableTo?: any;
  effectiveFrom: string;
  effectiveTo?: string;
  isActive: boolean;
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

export default function TadaRatesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Rate[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/tada/rates", {
        params: { page: 1, limit: 100 },
      });

      const data = res.data?.data || res.data;
      const list = data?.data || data?.items || data || [];
      setItems(Array.isArray(list) ? list : []);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || err?.message || "Failed to load rates",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl p-4 md:p-6">
        <div className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">TADA Rates</h1>
              <p className="text-sm text-muted-foreground">
                Manage global and scoped rates
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => void load()}
                disabled={loading}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>

              <Button onClick={() => router.push("/sales/tada/rates/create")}>
                <Plus className="mr-2 h-4 w-4" />
                New Rate
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : items.length ? (
            items.map((rate) => (
              <Card key={rate._id} className="border-slate-200 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold capitalize">
                        {rate.rateType} rate
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Taka per km:{" "}
                        <span className="font-medium text-foreground">
                          {money(rate.takaPerKm)}
                        </span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Default DA: {money(rate.defaultDA)} · Default NH:{" "}
                        {money(rate.defaultNH)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Applicable to:{" "}
                        <span className="font-medium text-foreground">
                          {typeof rate.applicableTo === "string"
                            ? rate.applicableTo
                            : rate.applicableTo?._id ||
                              rate.applicableTo?.name ||
                              "-"}
                        </span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Effective: {fmtDate(rate.effectiveFrom)}{" "}
                        {rate.effectiveTo
                          ? `→ ${fmtDate(rate.effectiveTo)}`
                          : "→ ongoing"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Status:{" "}
                        <span className="font-medium text-foreground">
                          {rate.isActive ? "Active" : "Inactive"}
                        </span>
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      onClick={() =>
                        router.push(`/sales/tada/rates/${rate._id}/edit`)
                      }
                    >
                      <PencilLine className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                No rates found.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
