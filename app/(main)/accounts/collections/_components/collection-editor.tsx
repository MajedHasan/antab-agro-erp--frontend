"use client";

import React, { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

type Props = {
  mode: "create" | "edit";
  collectionId?: string;
  initialData?: any;
  onSaved?: (data: any) => void;
};

type DealerLine = {
  uid: string;
  dealerId: string;
  dealerName: string;
  query: string;
  options: any[];
  loading: boolean;
  invoices: InvoiceLine[];
};

type InvoiceLine = {
  uid: string;
  invoiceId: string;
  invoiceNo: string;
};

type AllocationLine = {
  uid: string;
  pairKey: string;
  dealerId: string;
  dealerName: string;
  invoiceId: string;
  invoiceNo: string;
  amount: number;
};

type MRLine = {
  uid: string;
  mrNo: string;
  mrDate: string;
  taka: number;
  commission: number;
  mediaId: string;
  allocations: AllocationLine[];
};

function uid() {
  return crypto.randomUUID();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatMoney(n = 0) {
  return Number(n || 0).toFixed(2);
}

function parseInitialDate(v: any) {
  if (!v) return today();
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return today();
  return d.toISOString().slice(0, 10);
}

export default function CollectionEditor({
  mode,
  collectionId,
  initialData,
  onSaved,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [date, setDate] = useState(today());
  const [onlineCopy, setOnlineCopy] = useState({
    onlineCopyNo: "",
    onlineCopyDate: today(),
    onlineCopyTaka: 0,
    mediaId: "",
  });

  const [dealers, setDealers] = useState<DealerLine[]>([]);
  const [moneyReceipts, setMoneyReceipts] = useState<MRLine[]>([]);

  const [statusRemarks, setStatusRemarks] = useState("");
  const [statusBusy, setStatusBusy] = useState<string | null>(null);

  const isEditMode = mode === "edit";
  const canEdit =
    !isEditMode ||
    ["SUBMITTED", "UNDER_REVIEW", "HOLD", "DISPUTED"].includes(
      initialData?.status,
    );

  useEffect(() => {
    if (!initialData) {
      setDate(today());
      setOnlineCopy({
        onlineCopyNo: "",
        onlineCopyDate: today(),
        onlineCopyTaka: 0,
        mediaId: "",
      });
      setDealers([
        {
          uid: uid(),
          dealerId: "",
          dealerName: "",
          query: "",
          options: [],
          loading: false,
          invoices: [],
        },
      ]);
      setMoneyReceipts([
        {
          uid: uid(),
          mrNo: "",
          mrDate: today(),
          taka: 0,
          commission: 0,
          mediaId: "",
          allocations: [],
        },
      ]);
      return;
    }

    setDate(parseInitialDate(initialData.date));
    setOnlineCopy({
      onlineCopyNo: initialData?.onlineCopy?.onlineCopyNo || "",
      onlineCopyDate: parseInitialDate(initialData?.onlineCopy?.onlineCopyDate),
      onlineCopyTaka: Number(initialData?.onlineCopy?.onlineCopyTaka || 0),
      mediaId: initialData?.onlineCopy?.mediaId || "",
    });

    setDealers(
      (initialData?.dealers || []).map((d: any) => ({
        uid: uid(),
        dealerId: String(d.dealerId || ""),
        dealerName: d.dealerName || "",
        query: d.dealerName || "",
        options: [],
        loading: false,
        invoices: (d.invoices || []).map((inv: any) => ({
          uid: uid(),
          invoiceId: String(inv.invoiceId || ""),
          invoiceNo: inv.invoiceNo || "",
        })),
      })),
    );

    setMoneyReceipts(
      (initialData?.moneyReceipts || []).map((mr: any) => ({
        uid: uid(),
        mrNo: mr.mrNo || "",
        mrDate: parseInitialDate(mr.mrDate),
        taka: Number(mr.taka || 0),
        commission: Number(mr.commission || 0),
        mediaId: mr.mediaId || "",
        allocations: (mr.allocations || []).map((a: any) => ({
          uid: uid(),
          pairKey: `${String(a.dealerId || "")}:${String(a.invoiceId || "")}`,
          dealerId: String(a.dealerId || ""),
          dealerName: a.dealerName || "",
          invoiceId: String(a.invoiceId || ""),
          invoiceNo: a.invoiceNo || "",
          amount: Number(a.amount || 0),
        })),
      })),
    );
  }, [initialData]);

  const allocationOptions = useMemo(() => {
    const out: {
      pairKey: string;
      dealerId: string;
      dealerName: string;
      invoiceId: string;
      invoiceNo: string;
      label: string;
    }[] = [];

    dealers.forEach((d) => {
      d.invoices.forEach((inv) => {
        if (!d.dealerId || !inv.invoiceId) return;
        out.push({
          pairKey: `${d.dealerId}:${inv.invoiceId}`,
          dealerId: d.dealerId,
          dealerName: d.dealerName,
          invoiceId: inv.invoiceId,
          invoiceNo: inv.invoiceNo,
          label: `${d.dealerName || "Dealer"} • ${inv.invoiceNo || "Invoice"}`,
        });
      });
    });

    return out;
  }, [dealers]);

  const totals = useMemo(() => {
    const totalMRAmount = moneyReceipts.reduce(
      (s, mr) => s + Number(mr.taka || 0),
      0,
    );
    const totalAllocatedAmount = moneyReceipts.reduce((sum, mr) => {
      const a = mr.allocations.reduce((s, x) => s + Number(x.amount || 0), 0);
      return sum + a;
    }, 0);
    const totalCommission = moneyReceipts.reduce(
      (s, mr) => s + Number(mr.commission || 0),
      0,
    );

    return {
      totalDealers: dealers.length,
      totalInvoices: dealers.reduce((s, d) => s + d.invoices.length, 0),
      totalMoneyReceipts: moneyReceipts.length,
      totalAllocationLines: moneyReceipts.reduce(
        (s, mr) => s + mr.allocations.length,
        0,
      ),
      totalMRAmount,
      totalAllocatedAmount,
      totalCommission,
      balanced:
        dealers.length > 0 &&
        moneyReceipts.length > 0 &&
        totalMRAmount > 0 &&
        totalMRAmount === totalAllocatedAmount &&
        totalMRAmount === Number(onlineCopy.onlineCopyTaka || 0) &&
        !!onlineCopy.onlineCopyNo &&
        !!onlineCopy.mediaId,
    };
  }, [dealers, moneyReceipts, onlineCopy]);

  function updateDealer(uidValue: string, patch: Partial<DealerLine>) {
    setDealers((prev) =>
      prev.map((d) => (d.uid === uidValue ? { ...d, ...patch } : d)),
    );
  }

  function updateInvoice(
    dealerUid: string,
    invoiceUid: string,
    patch: Partial<InvoiceLine>,
  ) {
    setDealers((prev) =>
      prev.map((d) =>
        d.uid !== dealerUid
          ? d
          : {
              ...d,
              invoices: d.invoices.map((inv) =>
                inv.uid === invoiceUid ? { ...inv, ...patch } : inv,
              ),
            },
      ),
    );
  }

  function updateMR(uidValue: string, patch: Partial<MRLine>) {
    setMoneyReceipts((prev) =>
      prev.map((mr) => (mr.uid === uidValue ? { ...mr, ...patch } : mr)),
    );
  }

  function updateAllocation(
    mrUid: string,
    allocUid: string,
    patch: Partial<AllocationLine>,
  ) {
    setMoneyReceipts((prev) =>
      prev.map((mr) =>
        mr.uid !== mrUid
          ? mr
          : {
              ...mr,
              allocations: mr.allocations.map((a) =>
                a.uid === allocUid ? { ...a, ...patch } : a,
              ),
            },
      ),
    );
  }

  async function searchDealers(q: string, dealerUid: string) {
    updateDealer(dealerUid, { query: q, loading: true });

    try {
      if (!q || q.trim().length < 2) {
        updateDealer(dealerUid, { options: [], loading: false });
        return;
      }

      const res = await api.get(`/dealers?q=${encodeURIComponent(q)}&limit=10`);
      const list = res?.data?.data ?? res?.data ?? [];

      updateDealer(dealerUid, { options: list, loading: false });
    } catch (e) {
      updateDealer(dealerUid, { options: [], loading: false });
    }
  }

  async function selectDealer(dealerUid: string, dealer: any) {
    try {
      updateDealer(dealerUid, {
        dealerId: String(dealer._id || ""),
        dealerName: dealer.name || dealer.dealerName || "",
        query: dealer.name || dealer.dealerName || "",
        options: [],
        loading: false,
      });

      const res = await api.get(
        `/sales-invoices?dealerId=${encodeURIComponent(String(dealer._id))}&limit=200`,
      );
      const invoices = res?.data?.data ?? res?.data ?? [];

      updateDealer(dealerUid, {
        invoices: invoices.map((inv: any) => ({
          uid: uid(),
          invoiceId: "",
          invoiceNo: "",
        })),
      });

      // keep invoices empty by default; user selects them below
      // because collections can have multiple invoices per dealer
      updateDealer(dealerUid, {
        invoices: [
          {
            uid: uid(),
            invoiceId: "",
            invoiceNo: "",
          },
        ],
      });

      // cache invoices list on the dealer object through options field
      setDealers((prev) =>
        prev.map((d) =>
          d.uid === dealerUid
            ? {
                ...d,
                options: invoices,
                invoices: d.invoices.length
                  ? d.invoices
                  : [{ uid: uid(), invoiceId: "", invoiceNo: "" }],
              }
            : d,
        ),
      );
    } catch (err) {
      toast.error("Failed to load invoices for dealer");
    }
  }

  function addDealer() {
    setDealers((prev) => [
      ...prev,
      {
        uid: uid(),
        dealerId: "",
        dealerName: "",
        query: "",
        options: [],
        loading: false,
        invoices: [{ uid: uid(), invoiceId: "", invoiceNo: "" }],
      },
    ]);
  }

  function removeDealer(dealerUid: string) {
    setDealers((prev) => prev.filter((d) => d.uid !== dealerUid));
  }

  function addInvoice(dealerUid: string) {
    setDealers((prev) =>
      prev.map((d) =>
        d.uid === dealerUid
          ? {
              ...d,
              invoices: [
                ...d.invoices,
                { uid: uid(), invoiceId: "", invoiceNo: "" },
              ],
            }
          : d,
      ),
    );
  }

  function removeInvoice(dealerUid: string, invoiceUid: string) {
    setDealers((prev) =>
      prev.map((d) =>
        d.uid === dealerUid
          ? {
              ...d,
              invoices: d.invoices.filter((inv) => inv.uid !== invoiceUid),
            }
          : d,
      ),
    );
  }

  function addMR() {
    setMoneyReceipts((prev) => [
      ...prev,
      {
        uid: uid(),
        mrNo: "",
        mrDate: today(),
        taka: 0,
        commission: 0,
        mediaId: "",
        allocations: [
          {
            uid: uid(),
            pairKey: "",
            dealerId: "",
            dealerName: "",
            invoiceId: "",
            invoiceNo: "",
            amount: 0,
          },
        ],
      },
    ]);
  }

  function removeMR(mrUid: string) {
    setMoneyReceipts((prev) => prev.filter((mr) => mr.uid !== mrUid));
  }

  function addAllocation(mrUid: string) {
    setMoneyReceipts((prev) =>
      prev.map((mr) =>
        mr.uid === mrUid
          ? {
              ...mr,
              allocations: [
                ...mr.allocations,
                {
                  uid: uid(),
                  pairKey: "",
                  dealerId: "",
                  dealerName: "",
                  invoiceId: "",
                  invoiceNo: "",
                  amount: 0,
                },
              ],
            }
          : mr,
      ),
    );
  }

  function removeAllocation(mrUid: string, allocUid: string) {
    setMoneyReceipts((prev) =>
      prev.map((mr) =>
        mr.uid === mrUid
          ? {
              ...mr,
              allocations: mr.allocations.filter((a) => a.uid !== allocUid),
            }
          : mr,
      ),
    );
  }

  function buildPayload() {
    return {
      date,
      dealers: dealers.map((d) => ({
        dealerId: d.dealerId,
        dealerName: d.dealerName,
        invoices: d.invoices
          .filter((inv) => inv.invoiceId)
          .map((inv) => ({
            invoiceId: inv.invoiceId,
            invoiceNo: inv.invoiceNo,
          })),
      })),
      moneyReceipts: moneyReceipts.map((mr) => ({
        mrNo: mr.mrNo,
        mrDate: mr.mrDate,
        taka: Number(mr.taka || 0),
        commission: Number(mr.commission || 0),
        mediaId: mr.mediaId,
        allocations: mr.allocations
          .filter((a) => a.invoiceId)
          .map((a) => ({
            dealerId: a.dealerId,
            dealerName: a.dealerName,
            invoiceId: a.invoiceId,
            invoiceNo: a.invoiceNo,
            amount: Number(a.amount || 0),
          })),
      })),
      onlineCopy: {
        onlineCopyNo: onlineCopy.onlineCopyNo,
        onlineCopyDate: onlineCopy.onlineCopyDate,
        onlineCopyTaka: Number(onlineCopy.onlineCopyTaka || 0),
        mediaId: onlineCopy.mediaId,
      },
    };
  }

  async function handleSave() {
    try {
      if (!dealers.length) return toast.error("Add at least one dealer.");
      if (!moneyReceipts.length)
        return toast.error("Add at least one money receipt.");
      if (!onlineCopy.onlineCopyNo)
        return toast.error("Online Copy No is required.");
      if (!onlineCopy.mediaId)
        return toast.error("Online Copy mediaId is required.");

      if (totals.totalMRAmount !== totals.totalAllocatedAmount) {
        return toast.error(
          "Total MR amount must equal total allocated amount.",
        );
      }

      if (totals.totalMRAmount !== Number(onlineCopy.onlineCopyTaka || 0)) {
        return toast.error("Online Copy Taka must equal total MR amount.");
      }

      const payload = buildPayload();
      setSaving(true);

      const res =
        isEditMode && collectionId
          ? await api.put(`/collection/${collectionId}`, payload)
          : await api.post("/collection", payload);

      toast.success(isEditMode ? "Collection updated" : "Collection created");
      onSaved?.(res?.data?.data ?? res?.data ?? null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(
    nextStatus:
      | "SUBMITTED"
      | "UNDER_REVIEW"
      | "APPROVED"
      | "HOLD"
      | "DISPUTED"
      | "CANCELLED",
  ) {
    if (!collectionId) return;

    try {
      setStatusBusy(nextStatus);
      const endpoint =
        nextStatus === "SUBMITTED"
          ? "submit"
          : nextStatus === "UNDER_REVIEW"
            ? "review"
            : nextStatus === "APPROVED"
              ? "approve"
              : nextStatus === "HOLD"
                ? "hold"
                : nextStatus === "DISPUTED"
                  ? "dispute"
                  : "cancel";

      await api.post(`/collection/${collectionId}/${endpoint}`, {
        remarks: statusRemarks || undefined,
      });

      toast.success(`Moved to ${nextStatus}`);
      setStatusRemarks("");
      onSaved?.(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Status change failed");
    } finally {
      setStatusBusy(null);
    }
  }

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              {isEditMode ? "Edit Collection" : "Create Collection"}
            </h2>
            {isEditMode && initialData?.voucherNo ? (
              <p className="text-sm text-slate-500">
                Voucher: {initialData.voucherNo}
              </p>
            ) : (
              <p className="text-sm text-slate-500">
                Voucher number is generated by backend.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={totals.balanced ? "outline" : "destructive"}>
              {totals.balanced ? "Balanced" : "Not balanced"}
            </Badge>
            <Button
              onClick={handleSave}
              disabled={saving || (isEditMode && !canEdit)}
            >
              {saving ? "Saving..." : isEditMode ? "Update" : "Submit"}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Date</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={isEditMode && !canEdit}
            />
          </div>

          <div>
            <Label>Online Copy No</Label>
            <Input
              value={onlineCopy.onlineCopyNo}
              onChange={(e) =>
                setOnlineCopy((p) => ({ ...p, onlineCopyNo: e.target.value }))
              }
              disabled={isEditMode && !canEdit}
            />
          </div>

          <div>
            <Label>Online Copy Date</Label>
            <Input
              type="date"
              value={onlineCopy.onlineCopyDate}
              onChange={(e) =>
                setOnlineCopy((p) => ({ ...p, onlineCopyDate: e.target.value }))
              }
              disabled={isEditMode && !canEdit}
            />
          </div>

          <div>
            <Label>Online Copy Taka</Label>
            <Input
              type="number"
              min="0"
              value={onlineCopy.onlineCopyTaka}
              onChange={(e) =>
                setOnlineCopy((p) => ({
                  ...p,
                  onlineCopyTaka: Number(e.target.value || 0),
                }))
              }
              disabled={isEditMode && !canEdit}
            />
          </div>

          <div className="md:col-span-2">
            <Label>Online Copy Media ID</Label>
            <Input
              value={onlineCopy.mediaId}
              onChange={(e) =>
                setOnlineCopy((p) => ({ ...p, mediaId: e.target.value }))
              }
              disabled={isEditMode && !canEdit}
            />
          </div>
        </div>
      </Card>

      <Separator />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Dealers</h3>
          {(!isEditMode || canEdit) && (
            <Button onClick={addDealer}>+ Add Dealer</Button>
          )}
        </div>

        {dealers.map((dealer) => (
          <Card key={dealer.uid} className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Label>Search Dealer</Label>
                <Input
                  value={dealer.query}
                  onChange={(e) => {
                    const q = e.target.value;
                    updateDealer(dealer.uid, { query: q });
                    searchDealers(q, dealer.uid);
                  }}
                  placeholder="Type dealer name..."
                  disabled={isEditMode && !canEdit}
                />
                {dealer.loading ? (
                  <div className="text-xs text-slate-500 mt-2">
                    Searching...
                  </div>
                ) : null}
                {dealer.options.length > 0 && dealer.query ? (
                  <div className="mt-2 border rounded-md overflow-hidden">
                    {dealer.options.map((opt) => (
                      <button
                        key={opt._id}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b last:border-b-0"
                        onClick={() => selectDealer(dealer.uid, opt)}
                        disabled={isEditMode && !canEdit}
                      >
                        <div className="font-medium">
                          {opt.name || opt.dealerName}
                        </div>
                        <div className="text-xs text-slate-500">
                          {opt.code || opt.phoneNumber || opt._id}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="flex items-end">
                <Button
                  variant="destructive"
                  onClick={() => removeDealer(dealer.uid)}
                  disabled={(isEditMode && !canEdit) || dealers.length === 1}
                >
                  Remove Dealer
                </Button>
              </div>

              <div className="md:col-span-3">
                <Label>Selected Dealer</Label>
                <div className="text-sm text-slate-600 mt-1">
                  {dealer.dealerName || "Not selected"}
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <h4 className="font-medium">Invoices</h4>
              {(!isEditMode || canEdit) && (
                <Button
                  variant="outline"
                  onClick={() => addInvoice(dealer.uid)}
                >
                  + Add Invoice
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {dealer.invoices.map((inv) => (
                <div
                  key={inv.uid}
                  className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end"
                >
                  <div className="md:col-span-2">
                    <Label>Invoice</Label>
                    <Select
                      value={inv.invoiceId}
                      onValueChange={(v) => {
                        const selected = (dealer.options || []).find(
                          (x) => String(x._id) === String(v),
                        );
                        updateInvoice(dealer.uid, inv.uid, {
                          invoiceId: String(v),
                          invoiceNo:
                            selected?.invoiceNo ||
                            selected?.invoice_number ||
                            "",
                        });
                      }}
                      disabled={isEditMode && !canEdit}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select invoice" />
                      </SelectTrigger>
                      <SelectContent>
                        {(dealer.options || []).map((opt: any) => (
                          <SelectItem key={opt._id} value={String(opt._id)}>
                            {opt.invoiceNo || opt.invoice_number || opt._id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Invoice No</Label>
                    <Input value={inv.invoiceNo} disabled />
                  </div>

                  <div>
                    {(!isEditMode || canEdit) && (
                      <Button
                        variant="ghost"
                        className="text-rose-600"
                        onClick={() => removeInvoice(dealer.uid, inv.uid)}
                        disabled={dealer.invoices.length === 1}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Money Receipts</h3>
          {(!isEditMode || canEdit) && (
            <Button onClick={addMR}>+ Add MR</Button>
          )}
        </div>

        {moneyReceipts.map((mr) => (
          <Card key={mr.uid} className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>MR No</Label>
                <Input
                  value={mr.mrNo}
                  onChange={(e) => updateMR(mr.uid, { mrNo: e.target.value })}
                  disabled={isEditMode && !canEdit}
                />
              </div>

              <div>
                <Label>MR Date</Label>
                <Input
                  type="date"
                  value={mr.mrDate}
                  onChange={(e) => updateMR(mr.uid, { mrDate: e.target.value })}
                  disabled={isEditMode && !canEdit}
                />
              </div>

              <div>
                <Label>Taka</Label>
                <Input
                  type="number"
                  min="0"
                  value={mr.taka}
                  onChange={(e) =>
                    updateMR(mr.uid, { taka: Number(e.target.value || 0) })
                  }
                  disabled={isEditMode && !canEdit}
                />
              </div>

              <div>
                <Label>Commission</Label>
                <Input
                  type="number"
                  min="0"
                  value={mr.commission}
                  onChange={(e) =>
                    updateMR(mr.uid, {
                      commission: Number(e.target.value || 0),
                    })
                  }
                  disabled={isEditMode && !canEdit}
                />
              </div>

              <div className="md:col-span-2">
                <Label>Media ID</Label>
                <Input
                  value={mr.mediaId}
                  onChange={(e) =>
                    updateMR(mr.uid, { mediaId: e.target.value })
                  }
                  disabled={isEditMode && !canEdit}
                />
              </div>

              <div className="md:col-span-2 flex items-end justify-end">
                <Button
                  variant="destructive"
                  onClick={() => removeMR(mr.uid)}
                  disabled={
                    (isEditMode && !canEdit) || moneyReceipts.length === 1
                  }
                >
                  Remove MR
                </Button>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <h4 className="font-medium">Allocations</h4>
              {(!isEditMode || canEdit) && (
                <Button variant="outline" onClick={() => addAllocation(mr.uid)}>
                  + Add Allocation
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {mr.allocations.map((a) => (
                <div
                  key={a.uid}
                  className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
                >
                  <div className="md:col-span-2">
                    <Label>Dealer • Invoice</Label>
                    <Select
                      value={a.pairKey}
                      onValueChange={(v) => {
                        const sel = allocationOptions.find(
                          (x) => x.pairKey === v,
                        );
                        updateAllocation(mr.uid, a.uid, {
                          pairKey: v,
                          dealerId: sel?.dealerId || "",
                          dealerName: sel?.dealerName || "",
                          invoiceId: sel?.invoiceId || "",
                          invoiceNo: sel?.invoiceNo || "",
                        });
                      }}
                      disabled={isEditMode && !canEdit}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select dealer invoice" />
                      </SelectTrigger>
                      <SelectContent>
                        {allocationOptions.map((opt) => (
                          <SelectItem key={opt.pairKey} value={opt.pairKey}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="text-xs text-slate-500 mt-1">
                      {a.dealerName && a.invoiceNo
                        ? `${a.dealerName} • ${a.invoiceNo}`
                        : "Choose a dealer invoice"}
                    </div>
                  </div>

                  <div>
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      min="0"
                      value={a.amount}
                      onChange={(e) =>
                        updateAllocation(mr.uid, a.uid, {
                          amount: Number(e.target.value || 0),
                        })
                      }
                      disabled={isEditMode && !canEdit}
                    />
                  </div>

                  <div>
                    {(!isEditMode || canEdit) && (
                      <Button
                        variant="ghost"
                        className="text-rose-600"
                        onClick={() => removeAllocation(mr.uid, a.uid)}
                        disabled={mr.allocations.length === 1}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="text-sm text-slate-600">
              MR Total: <strong>{formatMoney(mr.taka)}</strong> | Allocated:{" "}
              <strong>
                {formatMoney(
                  mr.allocations.reduce((s, a) => s + Number(a.amount || 0), 0),
                )}
              </strong>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-slate-500">Dealers</div>
            <div className="font-semibold">{totals.totalDealers}</div>
          </div>
          <div>
            <div className="text-slate-500">Invoices</div>
            <div className="font-semibold">{totals.totalInvoices}</div>
          </div>
          <div>
            <div className="text-slate-500">MR Amount</div>
            <div className="font-semibold">
              {formatMoney(totals.totalMRAmount)}
            </div>
          </div>
          <div>
            <div className="text-slate-500">Allocated</div>
            <div className="font-semibold">
              {formatMoney(totals.totalAllocatedAmount)}
            </div>
          </div>
        </div>

        <Separator className="my-4" />

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-slate-500">Commission</div>
            <div className="font-semibold">
              {formatMoney(totals.totalCommission)}
            </div>
          </div>
          <div>
            <div className="text-slate-500">MR Count</div>
            <div className="font-semibold">{totals.totalMoneyReceipts}</div>
          </div>
          <div>
            <div className="text-slate-500">Status</div>
            <div className="font-semibold">
              {totals.balanced ? (
                <Badge variant="outline">Ready</Badge>
              ) : (
                <Badge variant="destructive">Not Ready</Badge>
              )}
            </div>
          </div>
        </div>
      </Card>

      {isEditMode && collectionId ? (
        <Card className="p-4 space-y-3">
          <div className="font-medium">Workflow Actions</div>
          <Textarea
            placeholder="Remarks / reason"
            value={statusRemarks}
            onChange={(e) => setStatusRemarks(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => changeStatus("SUBMITTED")}
              disabled={!!statusBusy}
            >
              Submit
            </Button>
            <Button
              onClick={() => changeStatus("UNDER_REVIEW")}
              disabled={!!statusBusy}
              variant="outline"
            >
              Under Review
            </Button>
            <Button
              onClick={() => changeStatus("APPROVED")}
              disabled={!!statusBusy}
            >
              Approve
            </Button>
            <Button
              onClick={() => changeStatus("HOLD")}
              disabled={!!statusBusy}
              variant="secondary"
            >
              Hold
            </Button>
            <Button
              onClick={() => changeStatus("DISPUTED")}
              disabled={!!statusBusy}
              variant="destructive"
            >
              Dispute
            </Button>
            <Button
              onClick={() => changeStatus("CANCELLED")}
              disabled={!!statusBusy}
              variant="destructive"
            >
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
