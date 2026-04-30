"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Save } from "lucide-react";

export default function EntryEditPage() {
  const params = useParams();
  const router = useRouter();

  const id = String(params?.id || "");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<any>({
    visitedPlaces: "",
    meterReadingStart: "",
    meterReadingEnd: "",
    maintenance: 0,
    conveyance: 0,
    da: 0,
    nh: 0,
    remarks: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/tada/entries/${id}`);
      const data = res.data?.data || res.data;

      setForm({
        visitedPlaces: (data.visitedPlaces || []).join(", "),
        meterReadingStart: data.meterReadingStart || "",
        meterReadingEnd: data.meterReadingEnd || "",
        maintenance: data.maintenance || 0,
        conveyance: data.conveyance || 0,
        da: data.da || 0,
        nh: data.nh || 0,
        remarks: data.remarks || "",
      });
    } catch {
      toast.error("Failed to load entry");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) void load();
  }, [id]);

  const handleChange = (k: string, v: any) => {
    setForm((p: any) => ({ ...p, [k]: v }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        visitedPlaces: form.visitedPlaces
          .split(",")
          .map((p: string) => p.trim())
          .filter(Boolean),
      };

      await api.put(`/tada/entries/${id}/edit`, payload);

      toast.success("Entry updated");
      router.push(`/sales/tada/monthly`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl p-4 md:p-6">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Edit Entry</CardTitle>
          </CardHeader>

          <CardContent className="grid gap-4">
            <Input
              value={form.visitedPlaces}
              onChange={(e) => handleChange("visitedPlaces", e.target.value)}
              placeholder="Places"
            />

            <Input
              type="number"
              value={form.meterReadingStart}
              onChange={(e) =>
                handleChange("meterReadingStart", e.target.value)
              }
            />

            <Input
              type="number"
              value={form.meterReadingEnd}
              onChange={(e) => handleChange("meterReadingEnd", e.target.value)}
            />

            <Input
              type="number"
              value={form.maintenance}
              onChange={(e) => handleChange("maintenance", e.target.value)}
            />

            <Input
              type="number"
              value={form.conveyance}
              onChange={(e) => handleChange("conveyance", e.target.value)}
            />

            <Input
              type="number"
              value={form.da}
              onChange={(e) => handleChange("da", e.target.value)}
            />

            <Input
              type="number"
              value={form.nh}
              onChange={(e) => handleChange("nh", e.target.value)}
            />

            <Textarea
              value={form.remarks}
              onChange={(e) => handleChange("remarks", e.target.value)}
            />

            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
