"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Loader2, Check } from "lucide-react";

/**
 * View + Edit special offer (with rules)
 *
 * - GET /api/special-offers/:id?progress=true (already returns offer + rules)
 * - GET /api/special-offers/:id/rewards
 * - PUT /api/special-offers/:id/with-rules  (body: { offer, rules })
 * - POST /api/special-offers/:id/reward { dealerId }
 */

type RuleNode = any;
type Offer = any;

export default function SpecialOfferPage() {
  const params = useParams();
  const router = useRouter();
  const offerId = params.id as string;

  const [offer, setOffer] = useState<Offer | null>(null);
  const [progress, setProgress] = useState<any[]>([]);
  const [rewards, setRewards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [localOffer, setLocalOffer] = useState<any>(null);
  const [localRules, setLocalRules] = useState<RuleNode[] | null>(null);
  const [saving, setSaving] = useState(false);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/special-offers/${offerId}?progress=true`);
      const data = res.data?.data || {};
      setOffer(data.offer || null);
      setProgress(data.progress?.data || []);
      setLocalOffer(data.offer || null);
      // rules: offer.rules is array of SpecialOfferRule documents (each has .rules tree)
      const rules = (data.offer?.rules || []).map((r: any) => r.rules).flat();
      setLocalRules(rules.length ? rules : []);
      // fetch rewards
      const rr = await api.get(`/special-offers/${offerId}/rewards`);
      setRewards(rr.data?.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load offer");
    } finally {
      setLoading(false);
    }
  }, [offerId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  async function issueReward(dealerId: string) {
    try {
      await api.post(`/special-offers/${offerId}/reward`, { dealerId });
      toast.success("Reward issued");
      fetch();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to issue reward");
    }
  }

  async function saveChanges() {
    if (!localOffer || !localRules) return;
    try {
      setSaving(true);
      // send trimmed payload (backend expects offer + rules)
      const offerPayload = {
        ...localOffer,
        // remove populated fields that backend doesn't expect
        rules: undefined,
      };
      // endpoint expects: { offer, rules }
      await api.put(`/special-offers/${offerId}/with-rules`, {
        offer: offerPayload,
        rules: localRules,
      });
      toast.success("Offer updated");
      setEditing(false);
      fetch();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to update offer");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !offer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin h-6 w-6" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 bg-slate-50">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{offer.name}</h1>
            <div className="text-sm text-muted-foreground">
              {offer.description}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => router.push("/special-offers")}
            >
              Back
            </Button>
            <Button onClick={() => setEditing((s) => !s)}>
              {editing ? "Cancel" : "Edit"}
            </Button>
            {editing ? (
              <Button onClick={saveChanges} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Offer Details</CardTitle>
              </CardHeader>
              <CardContent>
                {!editing ? (
                  <div className="text-sm space-y-1">
                    <div>
                      Start: {new Date(offer.startDate).toLocaleDateString()}
                    </div>
                    <div>
                      End: {new Date(offer.endDate).toLocaleDateString()}
                    </div>
                    <div>
                      Payment due:{" "}
                      {new Date(offer.paymentDueDate).toLocaleDateString()}
                    </div>
                    <div>
                      Reward: {offer.rewardType} {offer.rewardQuantity ?? ""}
                    </div>
                    <div>
                      Active:{" "}
                      <Switch
                        checked={!!offer.isActive}
                        onCheckedChange={async (v) => {
                          await api.patch(`/special-offers/${offerId}`, {
                            isActive: v,
                          });
                          fetch();
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">
                      Name
                    </label>
                    <Input
                      value={localOffer.name}
                      onChange={(e) =>
                        setLocalOffer({ ...localOffer, name: e.target.value })
                      }
                    />
                    <label className="text-sm text-muted-foreground">
                      Description
                    </label>
                    <textarea
                      className="w-full border rounded px-3 py-2"
                      rows={2}
                      value={localOffer.description || ""}
                      onChange={(e) =>
                        setLocalOffer({
                          ...localOffer,
                          description: e.target.value,
                        })
                      }
                    />
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <Input
                        type="date"
                        value={localOffer.startDate?.slice(0, 10)}
                        onChange={(e) =>
                          setLocalOffer({
                            ...localOffer,
                            startDate: e.target.value,
                          })
                        }
                      />
                      <Input
                        type="date"
                        value={localOffer.endDate?.slice(0, 10)}
                        onChange={(e) =>
                          setLocalOffer({
                            ...localOffer,
                            endDate: e.target.value,
                          })
                        }
                      />
                      <Input
                        type="date"
                        value={localOffer.paymentDueDate?.slice(0, 10)}
                        onChange={(e) =>
                          setLocalOffer({
                            ...localOffer,
                            paymentDueDate: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rules</CardTitle>
              </CardHeader>
              <CardContent>
                {!localRules || localRules.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No rules defined.
                  </div>
                ) : editing ? (
                  <div className="space-y-2">
                    {/* Simple JSON editor for rules when editing - for advanced nested editing reuse RuleEditor from create page */}
                    <textarea
                      className="w-full h-64 border rounded p-2 font-mono text-xs"
                      value={JSON.stringify(localRules, null, 2)}
                      onChange={(e) => {
                        try {
                          const parsed = JSON.parse(e.target.value);
                          setLocalRules(parsed);
                        } catch {
                          // ignore invalid JSON while typing
                        }
                      }}
                    />
                    <div className="text-xs text-muted-foreground">
                      You can paste the rules tree JSON here or use the create
                      page to build visually.
                    </div>
                  </div>
                ) : (
                  <pre className="text-sm whitespace-pre-wrap">
                    {JSON.stringify(localRules, null, 2)}
                  </pre>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm">Total dealers: {progress.length}</div>
                <table className="w-full mt-2 table-auto bg-white">
                  <thead className="bg-slate-50 text-sm">
                    <tr>
                      <th className="p-2">Dealer</th>
                      <th className="p-2">Fulfilled</th>
                      <th className="p-2">Reward</th>
                      <th className="p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {progress.map((p: any, idx: number) => (
                      <tr key={idx} className="border-t text-sm">
                        <td className="p-2">{p.dealerId}</td>
                        <td className="p-2">
                          {p.fulfilledRules ? "✅" : "❌"}
                        </td>
                        <td className="p-2">{p.rewardIssued ? "✅" : "❌"}</td>
                        <td className="p-2">
                          {!p.rewardIssued && p.fulfilledRules && (
                            <Button
                              size="sm"
                              onClick={() => issueReward(p.dealerId)}
                            >
                              Issue
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-4">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>Rewards</CardTitle>
              </CardHeader>
              <CardContent>
                <div>Total: {rewards.length}</div>
                {rewards.map((r: any) => (
                  <div
                    key={r._id}
                    className="flex justify-between text-sm py-1 border-b"
                  >
                    <div>Dealer: {r.dealerId}</div>
                    <div>
                      {r.rewardType} {r.rewardQuantity}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}
