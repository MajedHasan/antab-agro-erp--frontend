"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, Save } from "lucide-react";

type RateType = "global" | "employee" | "territory" | "designation";

type FormState = {
  rateType: RateType;
  takaPerKm: string;
  defaultDA: string;
  defaultNH: string;
  applicableTo: string;
  effectiveFrom: string;
  effectiveTo: string;
  isActive: boolean;
  note: string;
};

function todayInputValue() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toNumber(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export default function TadaRateCreatePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<FormState>({
    rateType: "global",
    takaPerKm: "",
    defaultDA: "0",
    defaultNH: "0",
    applicableTo: "",
    effectiveFrom: todayInputValue(),
    effectiveTo: "",
    isActive: true,
    note: "",
  });

  const title = useMemo(() => {
    switch (form.rateType) {
      case "employee":
        return "Employee";
      case "territory":
        return "Territory";
      case "designation":
        return "Designation";
      default:
        return "Global";
    }
  }, [form.rateType]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!form.takaPerKm.trim()) {
      toast.error("Taka per km is required.");
      return;
    }

    if (!form.effectiveFrom) {
      toast.error("Effective from date is required.");
      return;
    }

    if (form.rateType !== "global" && !form.applicableTo.trim()) {
      toast.error(`${title} value is required.`);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        rateType: form.rateType,
        takaPerKm: toNumber(form.takaPerKm),
        defaultDA: toNumber(form.defaultDA),
        defaultNH: toNumber(form.defaultNH),
        applicableTo:
          form.rateType === "global" ? null : form.applicableTo.trim(),
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null,
        isActive: form.isActive,
        note: form.note,
      };

      await api.post("/tada/rates", payload);

      toast.success("Rate created successfully.");
      router.push("/sales/tada/rates");
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to create rate.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl p-4 md:p-6">
        <div className="mb-4">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Create TADA Rate</CardTitle>
          </CardHeader>

          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Rate Type</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.rateType}
                onChange={(e) =>
                  setField("rateType", e.target.value as RateType)
                }
              >
                <option value="global">Global</option>
                <option value="employee">Employee</option>
                <option value="territory">Territory</option>
                <option value="designation">Designation</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Taka / Km</Label>
              <Input
                type="number"
                min={0}
                value={form.takaPerKm}
                onChange={(e) => setField("takaPerKm", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Default DA</Label>
              <Input
                type="number"
                min={0}
                value={form.defaultDA}
                onChange={(e) => setField("defaultDA", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Default NH</Label>
              <Input
                type="number"
                min={0}
                value={form.defaultNH}
                onChange={(e) => setField("defaultNH", e.target.value)}
              />
            </div>

            {form.rateType !== "global" ? (
              <div className="space-y-2 md:col-span-2">
                <Label>Applicable To ({title})</Label>
                <Input
                  value={form.applicableTo}
                  onChange={(e) => setField("applicableTo", e.target.value)}
                  placeholder={
                    form.rateType === "employee"
                      ? "Employee ID or reference"
                      : form.rateType === "territory"
                        ? "Territory name"
                        : "Designation"
                  }
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Effective From</Label>
              <Input
                type="date"
                value={form.effectiveFrom}
                onChange={(e) => setField("effectiveFrom", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Effective To</Label>
              <Input
                type="date"
                value={form.effectiveTo}
                onChange={(e) => setField("effectiveTo", e.target.value)}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Note</Label>
              <Textarea
                rows={4}
                value={form.note}
                onChange={(e) => setField("note", e.target.value)}
                placeholder="Optional note for internal reference"
              />
            </div>

            <div className="md:col-span-2 flex items-center gap-2">
              <input
                id="isActive"
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setField("isActive", e.target.checked)}
              />
              <Label htmlFor="isActive">Active</Label>
            </div>

            <div className="md:col-span-2 flex gap-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Rate
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/sales/tada/rates")}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
