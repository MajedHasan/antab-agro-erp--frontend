// app/vouchers/journal/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Download,
  Printer,
  PlusCircle,
  Trash2,
  Eye,
  CheckCircle,
  Save,
} from "lucide-react";
import api from "@/lib/api";

/* ---------------- Types ---------------- */

type Ledger = {
  id: string;
  code: string;
  name: string;
  openingBalance: number; // signed: positive = Dr, negative = Cr
};

type JournalLine = {
  id: string;
  ledgerId: string | null;
  debit: number;
  credit: number;
  narration?: string;
};

type JournalVoucher = {
  id: string;
  voucherNo: string;
  date: string;
  reference?: string;
  voucherType?: string;
  narration?: string;
  status: "Draft" | "Approved";
  lines: JournalLine[];
  createdAt: string;
};

/* ---------------- Demo Data (keep as fallback; replace with API) ---------------- */

const LEDGERS: Ledger[] = [
  { id: "l1", code: "1000", name: "Cash In Hand", openingBalance: 45000 },
  { id: "l2", code: "1010", name: "Bank - Main", openingBalance: 120000 },
  { id: "l3", code: "2000", name: "Accounts Payable", openingBalance: -22000 },
  { id: "l4", code: "4000", name: "Sales Revenue", openingBalance: -60000 },
  { id: "l5", code: "5000", name: "Salary Expense", openingBalance: 8000 },
  { id: "l6", code: "6000", name: "Misc Expense", openingBalance: 0 },
];

const VOUCHER_TYPES = [
  "Adjustment",
  "Reclassification",
  "Year-end Closing",
  "Provision",
  "Other",
];

const STORAGE_KEY = "demo_journal_vouchers_v2";

/* ---------------- Helpers ---------------- */

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
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
  const [voucherType, setVoucherType] = useState<string | undefined>(
    VOUCHER_TYPES[0],
  );
  const [narration, setNarration] = useState("");
  const [status, setStatus] = useState<JournalVoucher["status"]>("Draft");

  const [lines, setLines] = useState<JournalLine[]>([
    { id: uid("ln_"), ledgerId: null, debit: 0, credit: 0, narration: "" },
    { id: uid("ln_"), ledgerId: null, debit: 0, credit: 0, narration: "" },
  ]);

  const [saved, setSaved] = useState<JournalVoucher[]>([]);
  const [viewVoucher, setViewVoucher] = useState<JournalVoucher | null>(null);

  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSaved(JSON.parse(raw) as JournalVoucher[]);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch {}
  }, [saved]);

  function addLine(afterId?: string) {
    const newLine: JournalLine = {
      id: uid("ln_"),
      ledgerId: null,
      debit: 0,
      credit: 0,
      narration: "",
    };
    if (!afterId) setLines((s) => [...s, newLine]);
    else {
      setLines((s) => {
        const idx = s.findIndex((l) => l.id === afterId);
        if (idx === -1) return [...s, newLine];
        const copy = [...s];
        copy.splice(idx + 1, 0, newLine);
        return copy;
      });
    }
  }

  function removeLine(id: string) {
    setLines((s) => s.filter((l) => l.id !== id));
  }

  function updateLine(id: string, patch: Partial<JournalLine>) {
    setLines((s) => s.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  const totalDebit = useMemo(
    () => lines.reduce((s, l) => s + (Number(l.debit) || 0), 0),
    [lines],
  );
  const totalCredit = useMemo(
    () => lines.reduce((s, l) => s + (Number(l.credit) || 0), 0),
    [lines],
  );

  const hasEmptyLedger = lines.some((l) => !l.ledgerId);
  const hasBothSidesFilled = lines.some((l) => l.debit > 0 && l.credit > 0);
  const isBalanced =
    Math.abs(totalDebit - totalCredit) < 0.005 &&
    totalDebit > 0 &&
    !hasEmptyLedger &&
    !hasBothSidesFilled;

  const firstAmountRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    firstAmountRef.current?.focus();
  }, []);

  function ledgerOpening(ledgerId?: string | null) {
    if (!ledgerId) return null;
    const led = LEDGERS.find((l) => l.id === ledgerId);
    return led?.openingBalance ?? null;
  }

  /* ----------------- API Save (fixed) ----------------- */

  async function saveVoucher() {
    setServerError(null);

    // Quick client validation: ensure at least one valid line
    const validLines = lines.filter((l) => l.ledgerId && (l.debit || l.credit));
    if (validLines.length === 0) {
      alert("Please add at least one line with a ledger and amount.");
      return;
    }

    // If any line has missing ledger but some amount, show error
    const incompleteLine = lines.find(
      (l) => (l.debit || l.credit) && !l.ledgerId,
    );
    if (incompleteLine) {
      alert(
        "Some lines have amounts but no ledger selected. Please select ledger for each line.",
      );
      return;
    }

    if (hasBothSidesFilled) {
      alert("One or more lines have both debit and credit values. Fix them.");
      return;
    }

    // Build payload lines with accountId mapping
    const payloadLines = lines
      .filter((l) => l.ledgerId && (l.debit || l.credit)) // only send meaningful lines
      .map((l) => ({
        accountId: l.ledgerId!, // ledgerId maps to account _id in your backend
        debit: Number(l.debit || 0),
        credit: Number(l.credit || 0),
        narration: l.narration || "",
      }));

    const dr = payloadLines.reduce((s, p) => s + (p.debit || 0), 0);
    const cr = payloadLines.reduce((s, p) => s + (p.credit || 0), 0);

    if (Math.abs(dr - cr) > 0.005) {
      alert(
        "Debit and Credit totals do not match. Please balance before saving.",
      );
      return;
    }

    const payload = {
      voucherNo,
      date,
      reference,
      narration,
      status,
      lines: payloadLines,
    };

    try {
      setSaving(true);
      // POST to backend
      const res = await api.post("/vouchers/journal", payload);
      // if success, backend returns { success: true, data: voucher }
      // update local demo storage & UI
      const returned = res?.data?.data;
      const savedVoucher: JournalVoucher = {
        id: returned?._id ?? uid("v_"),
        voucherNo,
        date,
        reference,
        voucherType,
        narration,
        status,
        lines: JSON.parse(JSON.stringify(lines)),
        createdAt: new Date().toISOString(),
      };
      setSaved((s) => [savedVoucher, ...s]);

      // Reset form
      setVoucherNo(genVoucherNo("JV"));
      setDate(new Date().toISOString().slice(0, 10));
      setReference("");
      setVoucherType(VOUCHER_TYPES[0]);
      setNarration("");
      setStatus("Draft");
      setLines([
        { id: uid("ln_"), ledgerId: null, debit: 0, credit: 0, narration: "" },
      ]);
      alert("Voucher saved successfully.");
    } catch (err: any) {
      console.error("Failed to save journal voucher", err);
      const msg = err?.response?.data?.message || err?.message || "Save failed";
      setServerError(String(msg));
      alert(`Failed to save voucher: ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  /* ---------------- Render ---------------- */

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Journal Voucher</h1>
          <p className="text-sm text-muted-foreground">
            Create adjustment / reclassification / other journal entries
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setStatus("Approved");
              alert("Marked Approved (demo)");
            }}
          >
            <CheckCircle className="mr-2 h-4 w-4" /> Mark Approved
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setLines([
                {
                  id: uid("ln_"),
                  ledgerId: null,
                  debit: 0,
                  credit: 0,
                  narration: "",
                },
              ]);
              setVoucherNo(genVoucherNo("JV"));
            }}
          >
            New
          </Button>

          <Dialog
            open={!!viewVoucher}
            onOpenChange={(open) => {
              if (!open) setViewVoucher(null);
            }}
          >
            <DialogTrigger asChild>
              <Button variant="ghost">
                <Eye className="mr-2 h-4 w-4" />
                Saved
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Saved Journal Vouchers (demo)</DialogTitle>
                <DialogDescription>
                  List of saved demo vouchers. Replace with your API list.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4 space-y-2 max-h-[420px] overflow-auto">
                {saved.length === 0 && (
                  <div className="text-sm text-slate-500">
                    No saved vouchers yet.
                  </div>
                )}
                {saved.map((v) => (
                  <div
                    key={v.id}
                    className="p-3 border rounded flex items-start justify-between gap-4"
                  >
                    <div>
                      <div className="font-medium">
                        {v.voucherNo}{" "}
                        <span className="text-sm text-slate-500">
                          • {v.date}
                        </span>
                      </div>
                      <div className="text-sm text-slate-500">
                        Type: {v.voucherType ?? "-"} • Status: {v.status}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {(v.narration || "").slice(0, 120)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => setViewVoucher(v)}>
                        Open
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          /* CSV export logic */
                        }}
                      >
                        Export
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          /* Print logic */
                        }}
                      >
                        <Printer />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <Button onClick={() => setViewVoucher(null)}>Close</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Server error */}
      {serverError && (
        <div className="p-3 bg-rose-50 text-rose-700 border border-rose-100 rounded">
          <strong>Error:</strong> {serverError}
        </div>
      )}

      {/* Voucher header */}
      <Card className="p-4 grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
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
        <div className="md:col-span-2">
          <Label>Voucher Type</Label>
          <select
            className="w-full border rounded-md px-3 py-2"
            value={voucherType}
            onChange={(e) => setVoucherType(e.target.value)}
          >
            {VOUCHER_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
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
          <div className="font-semibold">Line Items</div>
          <div className="flex items-center gap-2">
            <Button onClick={() => addLine()}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Line
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full table-auto">
            <thead className="bg-slate-100 text-sm">
              <tr>
                <th className="px-4 py-2 text-left">Ledger (code — name)</th>
                <th className="px-4 py-2 text-left hidden md:table-cell">
                  Opening
                </th>
                <th className="px-4 py-2 text-right w-36">Debit</th>
                <th className="px-4 py-2 text-right w-36">Credit</th>
                <th className="px-4 py-2 text-left">Narration</th>
                <th className="px-4 py-2 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((ln, idx) => {
                const opening = ledgerOpening(ln.ledgerId) ?? 0;
                const missingLedger = !ln.ledgerId && (ln.debit || ln.credit);
                const bothSides = ln.debit > 0 && ln.credit > 0;
                return (
                  <tr
                    key={ln.id}
                    className={`border-t even:bg-white odd:bg-slate-50 ${
                      missingLedger ? "bg-rose-50" : ""
                    }`}
                  >
                    <td className="px-4 py-2">
                      <select
                        className={`w-full border rounded-md px-3 py-2 ${
                          missingLedger ? "border-rose-400" : ""
                        }`}
                        value={ln.ledgerId ?? ""}
                        onChange={(e) =>
                          updateLine(ln.id, {
                            ledgerId: e.target.value || null,
                          })
                        }
                      >
                        <option value="">-- Select ledger --</option>
                        {LEDGERS.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.code} — {l.name}
                          </option>
                        ))}
                      </select>
                      {missingLedger && (
                        <div className="text-xs text-rose-600 mt-1">
                          Select ledger for this amount
                        </div>
                      )}
                      {bothSides && (
                        <div className="text-xs text-rose-600 mt-1">
                          Debit and credit both set — keep only one
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 hidden md:table-cell text-sm text-slate-500">
                      {ln.ledgerId ? fmt(opening) : "-"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Input
                        ref={idx === 0 ? firstAmountRef : undefined}
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
                    <td className="px-4 py-2">
                      <Input
                        value={ln.narration ?? ""}
                        onChange={(e) =>
                          updateLine(ln.id, { narration: e.target.value })
                        }
                        placeholder="Line narration (optional)"
                      />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button
                        className="text-rose-600"
                        onClick={() => removeLine(ln.id)}
                      >
                        <Trash2 />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td className="px-4 py-3 text-right" colSpan={2}>
                  Totals
                </td>
                <td className="px-4 py-3 text-right text-emerald-700">
                  {totalDebit.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right text-rose-700">
                  {totalCredit.toFixed(2)}
                </td>
                <td colSpan={2}></td>
              </tr>
              <tr
                className={`${isBalanced ? "bg-emerald-50" : "bg-rose-50"} text-sm`}
              >
                <td className="px-4 py-2 text-left font-medium" colSpan={3}>
                  {isBalanced ? (
                    <span className="text-emerald-700">Balanced ✓</span>
                  ) : (
                    <span className="text-rose-700">Not balanced</span>
                  )}
                </td>
                <td className="px-4 py-2 text-left font-medium" colSpan={3}>
                  {hasEmptyLedger && (
                    <span className="text-rose-600">
                      Some lines missing ledger
                    </span>
                  )}
                  {hasBothSidesFilled && (
                    <span className="text-rose-600 ml-3">
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
            placeholder="Explain the purpose of this journal entry (mandatory for audit)"
          />
        </div>
        <div>
          <Label>Status & Actions</Label>
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-2">
              <Button
                onClick={() => saveVoucher()}
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
                      ledgerId: null,
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
            <div className="flex items-center gap-2">
              <Checkbox
                id="approved"
                checked={status === "Approved"}
                onCheckedChange={(v) => setStatus(v ? "Approved" : "Draft")}
              />
              <Label htmlFor="approved">Approved (demo)</Label>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
