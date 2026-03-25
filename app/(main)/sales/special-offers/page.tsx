"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Loader2, Trash2, Plus } from "lucide-react";

/**
 * List Special Offers
 * - GET /api/special-offers?page=1&limit=20&q=...
 * - PATCH /api/special-offers/:id  to toggle active (or use a dedicated endpoint)
 * - DELETE /api/special-offers/:id
 * - Link to /special-offers/create and /special-offers/:id
 */

type OfferRow = {
  _id: string;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
};

export default function SpecialOffersListPage() {
  const router = useRouter();
  const [data, setData] = useState<OfferRow[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function fetchList() {
    try {
      setLoading(true);
      const res = await api.get("/special-offers", {
        params: { page, limit, q },
      });
      setData(res.data?.data || []);
      setTotal(res.data?.total || 0);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load offers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, q]);

  const pages = useMemo(
    () => Math.max(1, Math.ceil(total / limit)),
    [total, limit],
  );

  async function toggleActive(offer: OfferRow) {
    try {
      await api.patch(`/special-offers/${offer._id}`, {
        isActive: !offer.isActive,
      });
      setData((d) =>
        d.map((r) =>
          r._id === offer._id ? { ...r, isActive: !r.isActive } : r,
        ),
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to update status");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this offer? This will also remove rules.")) return;
    try {
      setDeletingId(id);
      await api.delete(`/special-offers/${id}`);
      toast.success("Offer deleted");
      fetchList();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete offer");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="min-h-screen p-6 bg-slate-50">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Special Offers</h1>
            <div className="text-sm text-muted-foreground mt-1">
              Create and manage dealer offers, rules, progress and rewards.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search offers..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <Button onClick={() => router.push("/sales/special-offers/create")}>
              <Plus className="h-4 w-4 mr-2" /> Create Offer
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Offers</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-12 text-center">
                <Loader2 className="animate-spin mx-auto" />
              </div>
            ) : data.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No offers found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full bg-white table-auto">
                  <thead className="bg-slate-50 text-sm">
                    <tr>
                      <th className="p-3 text-left">Name</th>
                      <th className="p-3 text-left">Period</th>
                      <th className="p-3 text-left">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((r) => (
                      <tr key={r._id} className="border-t">
                        <td className="p-3">
                          <div className="font-medium">{r.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {r.description}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="text-sm">
                            {r.startDate
                              ? new Date(r.startDate).toLocaleDateString()
                              : "-"}{" "}
                            -{" "}
                            {r.endDate
                              ? new Date(r.endDate).toLocaleDateString()
                              : "-"}
                          </div>
                        </td>
                        <td className="p-3">
                          <Switch
                            checked={!!r.isActive}
                            onCheckedChange={() => toggleActive(r)}
                          />
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              onClick={() =>
                                router.push(`/special-offers/${r._id}`)
                              }
                            >
                              View
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() =>
                                router.push(`/special-offers/${r._id}`)
                              }
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => remove(r._1d ?? r._id)}
                              disabled={deletingId === r._id}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-3 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Page {page} of {pages}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Prev
                </Button>
                <Button
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  disabled={page === pages}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
