// app/vouchers/contra/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus, Save } from "lucide-react";
import api from "@/lib/api";

/* ---------------- Types ---------------- */

type Account = {
  _id: string;
  code?: string;
  name: string;
  type?: string;
  category?: string;
  balance?: number; // signed
  parent?: any;
};

type ContraEntry = {
  id: string;
  fromLedgerId: string;
  toLedgerId: string;
  amount: number;
  narration?: string;
};

/* ---------------- Helpers ---------------- */

function uid(prefix = "") {
  return prefix + Math.random().toString(36).slice(2, 9);
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);

/** Flatten nested account tree returned by /accounts/tree */
function flattenTree(accounts: any[]): Account[] {
  const out: Account[] = [];
  const walk = (node: any) => {
    out.push({
      _id: String(node._id),
      code: node.code,
      name: node.name,
      type: node.type,
      category: node.category,
      balance: node.balance ?? 0,
      parent: node.parent,
    });
    if (node.children && node.children.length) {
      node.children.forEach(walk);
    }
  };
  accounts.forEach(walk);
  return out;
}

/* ---------------- Component ---------------- */

export default function ContraVoucherPage() {
  const [voucherNo] = useState(
    () => `CV-${Math.floor(1000 + Math.random() * 9000)}`,
  );
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [entries, setEntries] = useState<ContraEntry[]>([
    {
      id: uid("entry_"),
      fromLedgerId: "",
      toLedgerId: "",
      amount: 0,
      narration: "",
    },
  ]);
  const [voucherNarration, setVoucherNarration] = useState("");
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [saving, setSaving] = useState(false);

  // fetch accounts tree and flatten on mount
  useEffect(() => {
    let mounted = true;
    setLoadingAccounts(true);
    api
      .get("/accounts/tree")
      .then((res) => {
        if (!mounted) return;
        const data = res?.data?.data ?? [];
        const flat = flattenTree(data);
        setAllAccounts(flat);
      })
      .catch((err) => {
        console.error("Failed to load accounts:", err);
        alert("Failed to load accounts. See console for details.");
      })
      .finally(() => {
        if (mounted) setLoadingAccounts(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // derive cash/bank ledgers (best-effort)
  const cashAndBankLedgers = useMemo(() => {
    // prefer accounts that look like bank or cash (name/category)
    const candidates = allAccounts.filter((a) => {
      const name = (a.name || "").toLowerCase();
      const cat = (a.category || "").toLowerCase();
      if (name.includes("bank") || cat.includes("bank")) return true;
      if (name.includes("cash") || cat.includes("cash")) return true;
      return false;
    });
    // fallback: any Assets if none found
    if (candidates.length > 0) return candidates;
    return allAccounts.filter((a) => a.type === "Asset");
  }, [allAccounts]);

  const totalAmount = useMemo(
    () => entries.reduce((s, e) => s + (e.amount || 0), 0),
    [entries],
  );

  const isValid =
    entries.length > 0 &&
    entries.every(
      (e) =>
        e.fromLedgerId &&
        e.toLedgerId &&
        Number(e.amount) > 0 &&
        e.fromLedgerId !== e.toLedgerId,
    );

  function addEntry() {
    setEntries((s) => [
      ...s,
      {
        id: uid("entry_"),
        fromLedgerId: "",
        toLedgerId: "",
        amount: 0,
        narration: "",
      },
    ]);
  }

  function removeEntry(id: string) {
    setEntries((s) => s.filter((e) => e.id !== id));
  }

  function updateEntry(id: string, key: keyof ContraEntry, value: any) {
    setEntries((s) => s.map((e) => (e.id === id ? { ...e, [key]: value } : e)));
  }

  async function saveVoucher() {
    if (!isValid) {
      alert(
        "Please fill all ledger fields, ensure from != to, and amount > 0 for each entry.",
      );
      return;
    }

    // Build payload entries exactly as backend expects (fromLedgerId, toLedgerId, amount, narration)
    const payloadEntries = entries.map((e) => ({
      fromLedgerId: e.fromLedgerId,
      toLedgerId: e.toLedgerId,
      amount: Number(e.amount),
      narration: e.narration || "",
    }));

    const payload = {
      voucherNo,
      date,
      entries: payloadEntries,
      totalAmount: Number(totalAmount),
      narration: voucherNarration || "",
    };

    try {
      setSaving(true);
      const res = await api.post("/vouchers/contra", payload);
      // success
      alert("Contra voucher created successfully.");
      // reset form
      setEntries([
        {
          id: uid("entry_"),
          fromLedgerId: "",
          toLedgerId: "",
          amount: 0,
          narration: "",
        },
      ]);
      setVoucherNarration("");
      setDate(new Date().toISOString().slice(0, 10));
    } catch (err: any) {
      console.error("Failed to save contra voucher:", err);
      const msg = err?.response?.data?.message || err?.message || "Save failed";
      alert(`Failed to save voucher: ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Contra Voucher</h1>
        <p className="text-sm text-muted-foreground">
          Record cash/bank transfers (Deposit, Withdrawal, Bank-to-Bank)
        </p>
      </div>

      {/* Voucher Header */}
      <Card className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <Label>Voucher No</Label>
          <Input value={voucherNo} disabled />
        </div>
        <div>
          <Label>Date</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </Card>

      {/* Entries Table */}
      <Card className="p-0 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-100 text-sm">
            <tr>
              <th className="px-4 py-2 text-left">From Ledger (Dr)</th>
              <th className="px-4 py-2 text-left">To Ledger (Cr)</th>
              <th className="px-4 py-2 text-right w-36">Amount</th>
              <th className="px-4 py-2 text-left">Narration</th>
              <th className="px-4 py-2 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.id}
                className="border-t even:bg-white odd:bg-slate-50"
              >
                <td className="px-4 py-2">
                  <select
                    className="w-full border rounded-md px-3 py-2"
                    value={entry.fromLedgerId}
                    onChange={(e) =>
                      updateEntry(entry.id, "fromLedgerId", e.target.value)
                    }
                    disabled={loadingAccounts}
                  >
                    <option value="">
                      {loadingAccounts ? "Loading..." : "Select Ledger"}
                    </option>
                    {cashAndBankLedgers.map((l) => (
                      <option key={l._id} value={l._id}>
                        {l.name} {l.code ? `(${l.code})` : ""}
                      </option>
                    ))}
                    {/* if user wants other accounts, provide small fallback group */}
                    <optgroup label="All Accounts">
                      {allAccounts.map((l) => (
                        <option key={l._id} value={l._id}>
                          {l.name} {l.code ? `(${l.code})` : ""}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </td>

                <td className="px-4 py-2">
                  <select
                    className="w-full border rounded-md px-3 py-2"
                    value={entry.toLedgerId}
                    onChange={(e) =>
                      updateEntry(entry.id, "toLedgerId", e.target.value)
                    }
                    disabled={loadingAccounts}
                  >
                    <option value="">
                      {loadingAccounts ? "Loading..." : "Select Ledger"}
                    </option>
                    {cashAndBankLedgers.map((l) => (
                      <option key={l._id} value={l._id}>
                        {l.name} {l.code ? `(${l.code})` : ""}
                      </option>
                    ))}
                    <optgroup label="All Accounts">
                      {allAccounts.map((l) => (
                        <option key={l._id} value={l._id}>
                          {l.name} {l.code ? `(${l.code})` : ""}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </td>

                <td className="px-4 py-2 text-right">
                  <Input
                    type="number"
                    min={0}
                    value={entry.amount || ""}
                    onChange={(e) =>
                      updateEntry(entry.id, "amount", Number(e.target.value))
                    }
                  />
                </td>

                <td className="px-4 py-2">
                  <Input
                    value={entry.narration || ""}
                    onChange={(e) =>
                      updateEntry(entry.id, "narration", e.target.value)
                    }
                  />
                </td>

                <td className="px-4 py-2 text-center">
                  {entries.length > 1 && (
                    <button
                      onClick={() => removeEntry(entry.id)}
                      className="text-rose-600 hover:text-rose-800"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 font-semibold">
            <tr>
              <td colSpan={2} className="px-4 py-2 text-right">
                Total Amount
              </td>
              <td className="px-4 py-2 text-right">{fmt(totalAmount)}</td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </Card>

      <Button variant="ghost" onClick={addEntry}>
        <Plus className="mr-2 h-4 w-4" /> Add Entry
      </Button>

      {/* Narration */}
      <Card className="p-4">
        <Label>Voucher Narration</Label>
        <Textarea
          rows={3}
          value={voucherNarration}
          onChange={(e) => setVoucherNarration(e.target.value)}
          placeholder="Optional narration for this contra voucher"
        />
      </Card>

      {/* Footer */}
      <div className="flex justify-end gap-2">
        <Button disabled={!isValid || saving} onClick={saveVoucher}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save Contra Voucher"}
        </Button>
      </div>
    </div>
  );
}
