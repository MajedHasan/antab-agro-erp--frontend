"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Save } from "lucide-react";
import api from "@/lib/api";

/* ------------------ Types ------------------ */
type Account = {
  _id: string;
  name: string;
  type: "Asset" | "Liability" | "Equity" | "Revenue" | "Expense";
  category?: string;
  balance?: number;
  code?: string;
  children?: Account[];
};

type EntryRow = {
  id: string;
  ledgerId: string;
  amount: number;
  narration?: string;
};

/* ------------------ Component ------------------ */
export default function CashPaymentVoucherPage() {
  const [voucherNo, setVoucherNo] = useState(() => `CP-${Date.now()}`);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [paymentTo, setPaymentTo] = useState("");
  const [paymentMode, setPaymentMode] = useState("");
  const [narration, setNarration] = useState("");

  const [rows, setRows] = useState<EntryRow[]>([
    { id: crypto.randomUUID(), ledgerId: "", amount: 0, narration: "" },
  ]);

  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [cashLedger, setCashLedger] = useState<Account | null>(null);
  const [saving, setSaving] = useState(false);

  const PAYMENT_TO = ["Supplier", "Expense", "Other"];
  const PAYMENT_MODES = ["Cash", "Petty Cash", "Adjustment"];

  /* ------------------ Fetch accounts ------------------ */
  useEffect(() => {
    let mounted = true;
    api
      .get("/accounts/tree")
      .then((res) => {
        if (!mounted) return;
        const flat = flattenTree(res?.data?.data || []);
        setAllAccounts(flat);

        const cash = flat.find(
          (a) => a.type === "Asset" && /cash/i.test(a.name),
        );
        setCashLedger(cash || null);
      })
      .catch((err) => {
        console.error("Failed to load accounts", err);
        alert("Failed to load accounts. Check console.");
      });

    return () => {
      mounted = false;
    };
  }, []);

  /* ------------------ Helpers ------------------ */
  function flattenTree(accounts: Account[]): Account[] {
    const out: Account[] = [];
    const walk = (node: Account) => {
      out.push(node);
      if (node.children) node.children.forEach(walk);
    };
    accounts.forEach(walk);
    return out;
  }

  const money = (n = 0) =>
    `₹ ${Math.abs(Number(n) || 0).toFixed(2)} ${
      Number(n || 0) >= 0 ? "Dr" : "Cr"
    }`;

  /* ------------------ Derived Lists ------------------ */
  const suggestedDebits = useMemo(() => {
    if (!allAccounts.length) return [];
    const nonCash = allAccounts.filter((a) => a._id !== cashLedger?._id);
    if (paymentTo === "Supplier")
      return nonCash.filter((a) =>
        /supplier|payable/i.test(a.name.toLowerCase()),
      );
    if (paymentTo === "Expense")
      return nonCash.filter((a) => a.type === "Expense");
    return nonCash;
  }, [allAccounts, paymentTo, cashLedger]);

  const totalAmount = useMemo(
    () => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    [rows],
  );

  const closingCashBalance = useMemo(() => {
    if (!cashLedger) return 0;
    return (cashLedger.balance || 0) - totalAmount;
  }, [cashLedger, totalAmount]);

  const isBalanced =
    totalAmount > 0 &&
    !!paymentTo &&
    !!paymentMode &&
    rows.length > 0 &&
    rows.every((r) => r.ledgerId && Number(r.amount) > 0) &&
    closingCashBalance >= 0;

  /* ------------------ Row Actions ------------------ */
  function addRow() {
    setRows((s) => [
      ...s,
      { id: crypto.randomUUID(), ledgerId: "", amount: 0, narration: "" },
    ]);
  }

  function removeRow(id: string) {
    setRows((s) => s.filter((r) => r.id !== id));
  }

  function updateRow(id: string, key: keyof EntryRow, value: any) {
    setRows((s) => s.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  }

  /* ------------------ Save Voucher ------------------ */
  async function saveVoucher() {
    if (!isBalanced || !cashLedger) {
      alert("Voucher incomplete, not balanced, or insufficient cash balance.");
      return;
    }

    const lines = [
      // Cash credit
      {
        accountId: cashLedger._id,
        debit: 0,
        credit: totalAmount,
        narration: "Cash payment",
      },
      // Debit lines
      ...rows.map((r) => ({
        accountId: r.ledgerId,
        debit: Number(r.amount),
        credit: 0,
        narration: r.narration || "",
      })),
    ];

    const dr = lines.reduce((s, l) => s + (l.debit || 0), 0);
    const cr = lines.reduce((s, l) => s + (l.credit || 0), 0);
    if (Math.abs(dr - cr) > 0.005) {
      alert("Voucher not balanced!");
      return;
    }

    const payload = {
      voucherNo,
      date,
      paymentTo,
      paymentMode,
      narration,
      cashLedgerId: cashLedger._id,
      lines,
    };

    try {
      setSaving(true);
      await api.post("/vouchers/cash-payment", payload);
      alert("Cash payment voucher saved successfully.");

      // Reset form
      setVoucherNo(`CP-${Date.now()}`);
      setDate(new Date().toISOString().slice(0, 10));
      setPaymentTo("");
      setPaymentMode("");
      setNarration("");
      setRows([
        { id: crypto.randomUUID(), ledgerId: "", amount: 0, narration: "" },
      ]);
    } catch (err: any) {
      console.error(err);
      const msg = err?.response?.data?.message || err?.message || "Save failed";
      alert(`Failed to save voucher: ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  /* ------------------ UI ------------------ */
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Cash Payment Voucher</h1>
        <p className="text-sm text-muted-foreground">
          Record cash payments made
        </p>
      </div>

      {/* Voucher Meta */}
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
          <Label>Payment To</Label>
          <select
            value={paymentTo}
            onChange={(e) => setPaymentTo(e.target.value)}
            className="w-full border rounded-md px-3 py-2"
          >
            <option value="">Select</option>
            {PAYMENT_TO.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>

        <div>
          <Label>Payment Mode</Label>
          <select
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value)}
            className="w-full border rounded-md px-3 py-2"
          >
            <option value="">Select</option>
            {PAYMENT_MODES.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </div>
      </Card>

      {/* Cash Impact */}
      <Card className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label>Cash Ledger (Credit)</Label>
          <div className="mt-2 font-semibold">{cashLedger?.name || "—"}</div>
        </div>

        <div>
          <Label>Opening Balance</Label>
          <div className="mt-2 font-semibold text-slate-700">
            {money(cashLedger?.balance || 0)}
          </div>
        </div>

        <div>
          <Label>Closing Balance</Label>
          <div
            className={`mt-2 font-semibold ${closingCashBalance < 0 ? "text-rose-700" : "text-emerald-700"}`}
          >
            {money(closingCashBalance)}
          </div>
        </div>
      </Card>

      {/* Debit Entries */}
      <Card className="p-0 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-100 text-sm">
            <tr>
              <th className="px-4 py-3 text-left">Debit Ledger</th>
              <th className="px-4 py-3 text-left">Narration</th>
              <th className="px-4 py-3 text-right w-48">Amount</th>
              <th className="px-4 py-3 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-4 py-2">
                  <select
                    value={row.ledgerId}
                    onChange={(e) =>
                      updateRow(row.id, "ledgerId", e.target.value)
                    }
                    className="w-full border rounded-md px-3 py-2"
                  >
                    <option value="">Select Ledger</option>
                    {suggestedDebits.map((l) => (
                      <option key={l._id} value={l._id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <Input
                    value={row.narration || ""}
                    onChange={(e) =>
                      updateRow(row.id, "narration", e.target.value)
                    }
                    placeholder="Line narration (optional)"
                  />
                </td>
                <td className="px-4 py-2 text-right">
                  <Input
                    type="number"
                    min="0"
                    value={row.amount || ""}
                    onChange={(e) =>
                      updateRow(row.id, "amount", Number(e.target.value))
                    }
                    className="text-right"
                  />
                </td>
                <td className="px-4 py-2 text-center">
                  {rows.length > 1 && (
                    <button
                      onClick={() => removeRow(row.id)}
                      className="text-rose-600"
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
              <td colSpan={2} className="px-4 py-3 text-right">
                Total Paid
              </td>
              <td className="px-4 py-3 text-right">
                ₹ {totalAmount.toFixed(2)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </Card>

      <Button variant="ghost" onClick={addRow}>
        <Plus className="mr-2 h-4 w-4" /> Add Line
      </Button>

      {/* Narration */}
      <Card className="p-4">
        <Label>Narration (voucher)</Label>
        <Textarea
          rows={3}
          placeholder="Optional narration for this voucher"
          value={narration}
          onChange={(e) => setNarration(e.target.value)}
        />
      </Card>

      <div className="flex justify-between items-center">
        <div className="text-sm font-medium">
          Cash Credit: ₹ {totalAmount.toFixed(2)} | Debits: ₹{" "}
          {totalAmount.toFixed(2)}
        </div>

        <Button disabled={!isBalanced || saving} onClick={saveVoucher}>
          <Save className="mr-2 h-4 w-4" />{" "}
          {saving ? "Saving..." : "Save Voucher"}
        </Button>
      </div>
    </div>
  );
}
