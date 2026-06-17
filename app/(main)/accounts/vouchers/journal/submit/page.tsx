// app/accounts/vouchers/journal/submit/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import {
  Download,
  PlusCircle,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";

/* ---------------- Types ---------------- */

type JournalVoucherType = {
  _id: string;
  name: string;
  isActive?: boolean;
};

type AccountNode = {
  _id: string;
  name?: string;
  code?: string;
  openingBalance?: number;
  periodDebit?: number;
  periodCredit?: number;
};

type VoucherAccount = {
  _id: string;
  name?: string;
  accountId?: string | { _id: string; name?: string; code?: string };
  role?: string;
  allowedVoucherTypes?: string[];
  isActive?: boolean;
};

type JournalLine = {
  id: string;
  voucherAccountId: string | null;
  debit: number;
  credit: number;
  narration?: string;
};

/* ---------------- Helpers ---------------- */

const formatTaka = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

function uid(prefix = "") {
  return prefix + Math.random().toString(36).slice(2, 9);
}

function genVoucherNo(prefix = "JV") {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const rnd = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${d.getFullYear()}${mm}-${rnd}`;
}

/* ---------------- Component ---------------- */

export default function JournalVoucherPage() {
  const [voucherNo, setVoucherNo] = useState(() => genVoucherNo("JV"));
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [voucherTypeId, setVoucherTypeId] = useState<string>("");
  const [narration, setNarration] = useState("");

  const [lines, setLines] = useState<JournalLine[]>([
    { id: uid("ln_"), voucherAccountId: null, debit: 0, credit: 0, narration: "" },
    { id: uid("ln_"), voucherAccountId: null, debit: 0, credit: 0, narration: "" },
  ]);

  /* ---------- Master data ---------- */
  const [journalTypes, setJournalTypes] = useState<JournalVoucherType[]>([]);
  const [voucherAccounts, setVoucherAccounts] = useState<VoucherAccount[]>([]);
  const [accountsTree, setAccountsTree] = useState<AccountNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const [typesRes, vasRes, treeRes] = await Promise.all([
          api.get("/journal-voucher-types").catch(() => ({ data: { data: [] } })),
          api.get("/voucher-accounts?allowedVoucherTypes=Journal").catch(() => ({ data: { data: [] } })),
          api.get("/accounts/tree").catch(() => ({ data: [] })),
        ]);
        if (!mounted) return;

        setJournalTypes(typesRes?.data?.data ?? []);

        const vasRaw = vasRes?.data?.data ?? [];
        const vas = vasRaw.map((v: any) => ({
          ...v,
          _id: v._id,
          name: v?.name || (v.accountId && typeof v.accountId === "object" ? v.accountId.name : v._id),
          accountId: v.accountId && typeof v.accountId === "object" ? v.accountId._id : v.accountId,
          allowedVoucherTypes: v.allowedVoucherTypes || v.voucherTypes || [],
          isActive: v.isActive !== false,
        }));
        setVoucherAccounts(vas);

        setAccountsTree(treeRes?.data?.data ?? []);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load required data");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  /* ---------- Derived ledger list ---------- */
  const accountMap = useMemo(() => {
    const map = new Map<string, AccountNode>();
    const flat = (nodes: any[]) => {
      nodes.forEach((n) => {
        if (n?._id) map.set(n._id, { _id: n._id, name: n.name, code: n.code });
        if (n.children) flat(n.children);
      });
    };
    flat(accountsTree);
    return map;
  }, [accountsTree]);

  /* ---------- Computed totals ---------- */
  const totalDebit = useMemo(() => lines.reduce((s, l) => s + (l.debit || 0), 0), [lines]);
  const totalCredit = useMemo(() => lines.reduce((s, l) => s + (l.credit || 0), 0), [lines]);
  const hasEmptyLedger = lines.some((l) => !l.voucherAccountId && (l.debit || l.credit));
  const hasBothSides = lines.some((l) => l.debit > 0 && l.credit > 0);
  const isBalanced =
    Math.abs(totalDebit - totalCredit) < 0.005 &&
    totalDebit > 0 &&
    !hasEmptyLedger &&
    !hasBothSides;

  /* ---------- Row helpers ---------- */
  const addLine = () => {
    setLines((s) => [
      ...s,
      { id: uid("ln_"), voucherAccountId: null, debit: 0, credit: 0, narration: "" },
    ]);
  };

  const removeLine = (id: string) => {
    setLines((s) => s.filter((l) => l.id !== id));
  };

  const updateLine = (id: string, patch: Partial<JournalLine>) => {
    setLines((s) => s.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  /* ---------- Submit ---------- */
  const handleSubmit = async () => {
    // Validation
    if (!isBalanced) {
      toast.error("Debit and Credit totals must match and be greater than zero.");
      return;
    }
    if (hasEmptyLedger) {
      toast.error("Some lines have amounts but no ledger selected.");
      return;
    }
    if (hasBothSides) {
      toast.error("Some lines have both Debit and Credit values – keep only one.");
      return;
    }

    const payloadLines = lines
      .filter((l) => l.voucherAccountId && (l.debit || l.credit))
      .map((l) => {
        const va = voucherAccounts.find((v) => v._id === l.voucherAccountId);
        const accountId = va?.accountId || l.voucherAccountId;
        return {
          accountId,
          debit: Number(l.debit || 0),
          credit: Number(l.credit || 0),
          narration: l.narration || "",
        };
      });

    const payload = {
      voucherNo,
      date,
      reference: reference || undefined,
      narration: narration || undefined,
      lines: payloadLines,
      status: "Pending",
      type: "Journal",
    };

    try {
      setSaving(true);
      await api.post("/vouchers", payload);
      toast.success("Journal voucher submitted for approval");

      // Reset form
      setVoucherNo(genVoucherNo("JV"));
      setDate(new Date().toISOString().slice(0, 10));
      setReference("");
      setVoucherTypeId("");
      setNarration("");
      setLines([
        { id: uid("ln_"), voucherAccountId: null, debit: 0, credit: 0, narration: "" },
        { id: uid("ln_"), voucherAccountId: null, debit: 0, credit: 0, narration: "" },
      ]);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to save journal voucher");
    } finally {
      setSaving(false);
    }
  };

  /* ---------------- Render ---------------- */

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500">Loading journal setup…</div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Journal Voucher</h1>
          <p className="text-sm text-gray-500 mt-1">
            Create adjustment, reclassification, or other journal entries
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleSubmit}
            disabled={!isBalanced || saving}
            className="gap-2"
          >
            {saving ? "Saving..." : <><Save className="mr-2 h-4 w-4" /> Save</>}
          </Button>
        </div>
      </div>

      {/* Voucher header card */}
      <Card className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <Label>Voucher No</Label>
          <Input
            value={voucherNo}
            onChange={(e) => setVoucherNo(e.target.value)}
          />
        </div>
        <div>
          <Label>Date</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <Label>Journal Type</Label>
          <Select value={voucherTypeId} onValueChange={setVoucherTypeId}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {journalTypes
                .filter((t) => t.isActive !== false)
                .map((t) => (
                  <SelectItem key={t._id} value={t._id}>
                    {t.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Reference</Label>
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Optional reference"
          />
        </div>
      </Card>

      {/* Lines table */}
      <Card className="p-0 overflow-hidden">
        <div className="flex items-center justify-between p-4">
          <div className="font-semibold text-gray-900">Line Items</div>
          <Button onClick={addLine} variant="ghost" className="gap-2">
            <PlusCircle className="h-4 w-4" /> Add Line
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 text-sm">
              <tr>
                <th className="px-4 py-2 text-left">Ledger</th>
                <th className="px-4 py-2 text-right w-36">Debit</th>
                <th className="px-4 py-2 text-right w-36">Credit</th>
                <th className="px-4 py-2 text-left hidden md:table-cell">Narration</th>
                <th className="px-4 py-2 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((ln, idx) => {
                const va = voucherAccounts.find((v) => v._id === ln.voucherAccountId);
                const acc = va?.accountId
                  ? accountMap.get(String(va.accountId))
                  : undefined;
                const missingLedger = !ln.voucherAccountId && (ln.debit || ln.credit);
                const bothSides = ln.debit > 0 && ln.credit > 0;
                return (
                  <tr
                    key={ln.id}
                    className={`border-t hover:bg-gray-50/50 ${
                      missingLedger ? "bg-red-50" : ""
                    }`}
                  >
                    <td className="px-4 py-2">
                      <Select
                        value={ln.voucherAccountId ?? ""}
                        onValueChange={(v) =>
                          updateLine(ln.id, { voucherAccountId: v || null })
                        }
                      >
                        <SelectTrigger
                          className={`w-full ${missingLedger ? "border-red-400" : ""}`}
                        >
                          <SelectValue placeholder="Select ledger" />
                        </SelectTrigger>
                        <SelectContent className="max-h-64">
                          {voucherAccounts
                            .filter((v) => v.isActive !== false)
                            .map((v) => {
                              const a = v.accountId
                                ? accountMap.get(String(v.accountId))
                                : undefined;
                              const display = `${v.name || ""}${a ? ` → ${a.name} (${a.code})` : ""}`;
                              return (
                                <SelectItem key={v._id} value={v._id}>
                                  {display}
                                </SelectItem>
                              );
                            })}
                        </SelectContent>
                      </Select>
                      {missingLedger && (
                        <div className="text-xs text-red-600 mt-1">
                          Select a ledger for this amount
                        </div>
                      )}
                      {bothSides && (
                        <div className="text-xs text-red-600 mt-1">
                          Debit and credit both set – keep only one
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        className="text-right"
                        value={ln.debit === 0 ? "" : String(ln.debit)}
                        onChange={(e) =>
                          updateLine(ln.id, {
                            debit: Number(e.target.value || 0),
                            credit: 0,
                          })
                        }
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        className="text-right"
                        value={ln.credit === 0 ? "" : String(ln.credit)}
                        onChange={(e) =>
                          updateLine(ln.id, {
                            credit: Number(e.target.value || 0),
                            debit: 0,
                          })
                        }
                      />
                    </td>
                    <td className="px-4 py-2 hidden md:table-cell">
                      <Input
                        value={ln.narration ?? ""}
                        onChange={(e) =>
                          updateLine(ln.id, { narration: e.target.value })
                        }
                        placeholder="Line note"
                      />
                    </td>
                    <td className="px-4 py-2 text-center">
                      {lines.length > 2 && (
                        <button
                          className="text-red-600"
                          onClick={() => removeLine(ln.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-semibold">
                <td className="px-4 py-3 text-right">Totals</td>
                <td className="px-4 py-3 text-right text-emerald-700">
                  {totalDebit.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right text-red-700">
                  {totalCredit.toFixed(2)}
                </td>
                <td colSpan={2}></td>
              </tr>
              <tr
                className={`${
                  isBalanced ? "bg-emerald-50" : "bg-red-50"
                } text-sm`}
              >
                <td className="px-4 py-2 text-left font-medium" colSpan={3}>
                  {isBalanced ? (
                    <span className="text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4" /> Balanced
                    </span>
                  ) : (
                    <span className="text-red-700 flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" /> Not balanced
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-left" colSpan={3}>
                  {hasEmptyLedger && (
                    <span className="text-red-600">Some lines missing ledger</span>
                  )}
                  {hasBothSides && (
                    <span className="text-red-600 ml-3">
                      Some lines have both debit & credit
                    </span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Narration & Actions */}
      <Card className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        <div className="md:col-span-2">
          <Label>Narration (voucher level)</Label>
          <Textarea
            rows={3}
            value={narration}
            onChange={(e) => setNarration(e.target.value)}
            placeholder="Explain the purpose of this journal entry"
          />
        </div>
        <div className="space-y-3">
          <Label>Actions</Label>
          <div className="flex gap-2">
            <Button
              onClick={handleSubmit}
              disabled={!isBalanced || saving}
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setVoucherNo(genVoucherNo("JV"));
                setLines([
                  {
                    id: uid("ln_"),
                    voucherAccountId: null,
                    debit: 0,
                    credit: 0,
                    narration: "",
                  },
                  {
                    id: uid("ln_"),
                    voucherAccountId: null,
                    debit: 0,
                    credit: 0,
                    narration: "",
                  },
                ]);
              }}
            >
              Reset
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}