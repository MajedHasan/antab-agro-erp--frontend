"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Banknote,
  Calendar,
  Copy,
  CreditCard,
  Layers,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
const formatMoney = (n = 0) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);

const flattenTree = (accounts = []) => {
  const out: any[] = [];
  const walk = (n: any) => {
    out.push(n);
    if (n.children) n.children.forEach(walk);
  };
  accounts.forEach(walk);
  return out;
};

/* ------------------------------------------------------------------ */
/*  Bank Receive Voucher Page (Create‑Only, Clean & Professional)     */
/* ------------------------------------------------------------------ */
export default function BankReceiveVoucherPage() {
  /* ---------- Form state ---------- */
  const [voucherNo, setVoucherNo] = useState(() => `BR-${Date.now()}`);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [sourceId, setSourceId] = useState("");
  const [modeId, setModeId] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [selectedBankVaId, setSelectedBankVaId] = useState("");
  const [voucherNarration, setVoucherNarration] = useState("");

  const [rows, setRows] = useState(() => [
    { id: crypto.randomUUID(), voucherAccountId: "", amount: 0, narration: "" },
  ]);

  /* ---------- Lookup data ---------- */
  const [accountsTree, setAccountsTree] = useState<any[]>([]);
  const [flatAccounts, setFlatAccounts] = useState<any[]>([]);
  const [voucherParties, setVoucherParties] = useState<any[]>([]);
  const [paymentModes, setPaymentModes] = useState<any[]>([]);
  const [voucherAccounts, setVoucherAccounts] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  /* ---------- Derived maps ---------- */
  const voucherAccountsMap = useMemo(() => {
    const m = new Map<string, any>();
    voucherAccounts.forEach((v) => v && v._id && m.set(String(v._id), v));
    return m;
  }, [voucherAccounts]);

  const accountsMap = useMemo(() => {
    const m = new Map<string, any>();
    flatAccounts.forEach((a) => a && a._id && m.set(String(a._id), a));
    return m;
  }, [flatAccounts]);

  /* ---------- Bank & Ledger options ---------- */
  const banks = useMemo(
    () =>
      voucherAccounts.filter((v) => v.role === "Bank" && v.isActive !== false),
    [voucherAccounts],
  );

  const ledgerOptions = useMemo(
    () =>
      voucherAccounts.filter((va) => {
        if (va.isActive === false) return false;
        if (va.role === "Bank") return false;
        if (!va.voucherTypes || va.voucherTypes.length === 0) return true;
        return (
          va.voucherTypes.includes("BankReceive") ||
          va.voucherTypes.includes("All")
        );
      }),
    [voucherAccounts],
  );

  /* ---------- Totals & Balances ---------- */
  const totalCredits = useMemo(
    () => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    [rows],
  );

  // Opening balance of selected bank (computed from tree data)
  const bankOpeningBalance = useMemo(() => {
    const bank = banks.find((b) => b._id === selectedBankVaId);
    if (!bank || !bank.accountId) return 0;
    const acc = accountsMap.get(String(bank.accountId));
    if (!acc) return 0;
    // derived from tree balance: opening + periodDr - periodCr
    return (
      (acc.openingBalance ?? 0) +
      (acc.periodDebit ?? 0) -
      (acc.periodCredit ?? 0)
    );
  }, [selectedBankVaId, banks, accountsMap]);

  // Net bank debit = total credits (since no commission / bank charge in this simplified form)
  const netBankDebit = totalCredits;

  // Projected closing balance = opening + net debit
  const closingBankBalance = useMemo(
    () => bankOpeningBalance + (isFinite(netBankDebit) ? netBankDebit : 0),
    [bankOpeningBalance, netBankDebit],
  );

  /* ---------- Validation ---------- */
  const selectedMode = useMemo(
    () => paymentModes.find((m) => m._id === modeId) || null,
    [paymentModes, modeId],
  );
  const modeRequiresReference = Boolean(selectedMode?.requiresReference);

  const isBalanced =
    totalCredits > 0 &&
    rows.length > 0 &&
    rows.every((r) => r.voucherAccountId && Number(r.amount) > 0) &&
    !!selectedBankVaId &&
    !!modeId &&
    (!modeRequiresReference || !!referenceNo);

  /* ---------- Load data ---------- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const [accountsRes, partiesRes, modesRes, vasRes] = await Promise.all([
          api.get("/accounts/tree").catch(() => ({ data: [] })),
          api.get("/voucher-parties").catch(() => ({ data: [] })),
          api.get("/payment-modes").catch(() => ({ data: [] })),
          api.get("/voucher-accounts").catch(() => ({ data: [] })),
        ]);
        if (!mounted) return;

        const tree = accountsRes?.data?.data ?? [];
        setAccountsTree(tree);
        setFlatAccounts(flattenTree(tree));

        const vasRaw = vasRes?.data?.data ?? vasRes?.data ?? [];
        const vas = vasRaw.map((v: any) => {
          const accountObj =
            v?.accountId && typeof v.accountId === "object"
              ? v.accountId
              : null;
          return {
            ...v,
            _id: v._id,
            name:
              v?.name?.trim() || (accountObj ? accountObj.name : String(v._id)),
            accountId: accountObj ? accountObj._id : v?.accountId || null,
            role: v.role,
            voucherTypes: v.allowedVoucherTypes || v.voucherTypes || [],
            isActive: v.isActive !== false,
          };
        });
        setVoucherAccounts(vas);

        setVoucherParties(partiesRes?.data?.data ?? partiesRes?.data ?? []);
        setPaymentModes(modesRes?.data?.data ?? modesRes?.data ?? []);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load form data");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  /* ---------- Row helpers ---------- */
  const addRow = useCallback(() => {
    setRows((s) => [
      ...s,
      {
        id: crypto.randomUUID(),
        voucherAccountId: "",
        amount: 0,
        narration: "",
      },
    ]);
  }, []);

  const removeRow = useCallback((id: string) => {
    setRows((s) => s.filter((r) => r.id !== id));
  }, []);

  const updateRow = useCallback(
    (id: string, key: string, value: any) =>
      setRows((s) => s.map((r) => (r.id === id ? { ...r, [key]: value } : r))),
    [],
  );

  /* ---------- Submit ---------- */
  async function submitVoucher() {
    if (!selectedBankVaId) return toast.error("Select a Bank account.");
    if (!modeId) return toast.error("Select a payment mode.");
    if (modeRequiresReference && !referenceNo)
      return toast.error("Reference number is required for this mode.");
    if (rows.some((r) => !r.voucherAccountId || !r.amount || r.amount <= 0))
      return toast.error(
        "Each credit line needs a ledger and a positive amount.",
      );

    const bankVa = voucherAccountsMap.get(selectedBankVaId);
    if (!bankVa || !bankVa.accountId)
      return toast.error("The selected bank is not mapped to a COA account.");

    // Build lines
    const lines: any[] = [];

    // Bank debit (gross amount)
    lines.push({
      accountId: bankVa.accountId,
      debit: Number(totalCredits),
      credit: 0,
      narration: `Bank receive ${referenceNo ? `(${referenceNo})` : ""}`.trim(),
    });

    // Credit lines
    for (const r of rows) {
      const va = voucherAccountsMap.get(r.voucherAccountId);
      if (!va || !va.accountId) {
        toast.error(
          `Credit line "${r.narration || "unnamed"}" has no valid ledger mapping.`,
        );
        return;
      }
      lines.push({
        accountId: va.accountId,
        debit: 0,
        credit: Number(r.amount),
        narration: r.narration || "",
      });
    }

    // Double‑entry check
    const dr = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
    const cr = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
    if (Math.abs(dr - cr) > 0.005)
      return toast.error("Voucher is not balanced.");

    const payload = {
      voucherNo,
      date,
      reference: referenceNo || undefined,
      source: sourceId || undefined,
      sourceModel: sourceId ? "VoucherParty" : undefined,
      mode: modeId,
      narration: voucherNarration || undefined,
      lines,
      status: "Pending",
      bankVaId: selectedBankVaId,
      type: "BankReceive",
    };

    try {
      setSaving(true);
      await api.post("/vouchers", payload);
      toast.success("Voucher submitted for approval");

      // Refresh VA list (in case auto‑creation happened)
      try {
        const vasRes = await api
          .get("/voucher-accounts")
          .catch(() => ({ data: [] }));
        const vasRaw = vasRes?.data?.data ?? vasRes?.data ?? [];
        const vas = vasRaw.map((v: any) => {
          const accountObj =
            v?.accountId && typeof v.accountId === "object"
              ? v.accountId
              : null;
          return {
            ...v,
            _id: v._id,
            name:
              v?.name?.trim() || (accountObj ? accountObj.name : String(v._id)),
            accountId: accountObj ? accountObj._id : v?.accountId || null,
            role: v.role,
            voucherTypes: v.allowedVoucherTypes || v.voucherTypes || [],
            isActive: v.isActive !== false,
          };
        });
        setVoucherAccounts(vas);
      } catch {
        /* ignore */
      }

      // Reset form
      setVoucherNo(`BR-${Date.now()}`);
      setDate(new Date().toISOString().slice(0, 10));
      setSourceId("");
      setModeId("");
      setReferenceNo("");
      setSelectedBankVaId("");
      setVoucherNarration("");
      setRows([
        {
          id: crypto.randomUUID(),
          voucherAccountId: "",
          amount: 0,
          narration: "",
        },
      ]);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Could not save voucher.");
    } finally {
      setSaving(false);
    }
  }

  /* ---------- Copy voucher number ---------- */
  const copyVoucherNo = useCallback(() => {
    navigator.clipboard.writeText(voucherNo);
    toast.success("Copied");
  }, [voucherNo]);

  /* ---------- Keyboard shortcut ---------- */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") submitVoucher();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []); // dependencies are captured via closures; safe for mount

  /* ------------------------------------------------------------------ */
  /*  Render                                                            */
  /* ------------------------------------------------------------------ */
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* ---- Header ---- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
            <Banknote className="h-6 w-6 text-slate-700" />
            Bank Receive Voucher
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Record a receipt directly into a bank account.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-right">
            <div className="text-sm text-slate-600">
              Total credits:{" "}
              <span className="font-semibold">{formatMoney(totalCredits)}</span>
            </div>
            <div className="text-xs text-slate-400">
              Net to bank = {formatMoney(netBankDebit)}
            </div>
          </div>
          <Button
            onClick={submitVoucher}
            disabled={!isBalanced || saving}
            className="gap-2"
          >
            {saving ? (
              "Saving..."
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Submit for Approval
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ---- Voucher details ---- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <Label className="text-xs text-slate-500">Voucher No</Label>
          <div className="flex items-center gap-2 mt-1">
            <Input
              value={voucherNo}
              onChange={(e) => setVoucherNo(e.target.value)}
              className="font-mono text-sm h-9"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={copyVoucherNo}
              className="shrink-0"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </Card>

        <Card className="p-4">
          <Label className="text-xs text-slate-500">Date</Label>
          <div className="relative mt-1">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9"
            />
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          </div>
        </Card>

        <Card className="p-4">
          <Label className="text-xs text-slate-500">Source</Label>
          <Select value={sourceId} onValueChange={setSourceId}>
            <SelectTrigger className="mt-1 h-9">
              <SelectValue placeholder="Select source" />
            </SelectTrigger>
            <SelectContent>
              {voucherParties
                .filter(
                  (p) => p.direction === "Receive" && p.isActive !== false,
                )
                .map((p) => (
                  <SelectItem key={p._id} value={p._id ?? ""}>
                    {p.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </Card>

        <Card className="p-4">
          <Label className="text-xs text-slate-500">Mode</Label>
          <Select value={modeId} onValueChange={setModeId}>
            <SelectTrigger className="mt-1 h-9">
              <SelectValue placeholder="Select mode" />
            </SelectTrigger>
            <SelectContent>
              {paymentModes
                .filter((m) => m.isActive !== false)
                .map((m) => (
                  <SelectItem key={m._id} value={m._id ?? ""}>
                    {m.name} {m.requiresReference ? " (ref. needed)" : ""}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {modeRequiresReference && !referenceNo && (
            <p className="text-xs text-red-500 mt-1">
              Reference number is required for this mode.
            </p>
          )}
        </Card>
      </div>

      {/* ---- Bank selection & balances ---- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <Label className="text-xs text-slate-500">Bank Account (Debit)</Label>
          <Select value={selectedBankVaId} onValueChange={setSelectedBankVaId}>
            <SelectTrigger className="mt-1 h-9">
              <SelectValue placeholder="Select bank" />
            </SelectTrigger>
            <SelectContent>
              {banks.map((b) => {
                const mappedAcc = b.accountId
                  ? accountsMap.get(String(b.accountId))
                  : undefined;
                const label =
                  (b.name || "") +
                  (mappedAcc
                    ? ` → ${mappedAcc.name}${mappedAcc.code ? ` (${mappedAcc.code})` : ""}`
                    : "");
                return (
                  <SelectItem key={b._id} value={b._id ?? ""}>
                    {label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </Card>

        <Card className="p-4 flex flex-col justify-center">
          <Label className="text-xs text-slate-500">Opening Balance</Label>
          <div className="text-lg font-semibold text-slate-800 mt-1">
            {formatMoney(bankOpeningBalance)}
          </div>
          <p className="text-xs text-slate-400">As per current ledger</p>
        </Card>

        <Card className="p-4 flex flex-col justify-center">
          <Label className="text-xs text-slate-500">Projected Closing</Label>
          <div className="text-lg font-semibold text-emerald-700 mt-1">
            {formatMoney(closingBankBalance)}
          </div>
          <p className="text-xs text-slate-400">After this receipt</p>
        </Card>
      </div>

      {/* ---- Credit Lines ---- */}
      <Card className="shadow-sm">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-medium text-slate-800 flex items-center gap-2">
            <Layers className="h-5 w-5 text-slate-600" />
            Credit Entries
          </h2>
          <Button
            variant="outline"
            onClick={addRow}
            size="sm"
            className="gap-1"
          >
            <Plus className="h-4 w-4" /> Add line
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="text-xs text-slate-500 bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Ledger</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">
                  Narration
                </th>
                <th className="text-right px-4 py-3 font-medium w-40">
                  Amount
                </th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row, idx) => {
                const va = voucherAccountsMap.get(row.voucherAccountId);
                return (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-4 py-2">
                      <Select
                        value={row.voucherAccountId}
                        onValueChange={(v) =>
                          updateRow(row.id, "voucherAccountId", v)
                        }
                      >
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue placeholder="Select ledger" />
                        </SelectTrigger>
                        <SelectContent>
                          {ledgerOptions.map((l) => {
                            const mapped = l.accountId
                              ? accountsMap.get(String(l.accountId))
                              : undefined;
                            const display =
                              (l.name || (mapped ? mapped.name : l._id)) +
                              (mapped && l.name ? ` → ${mapped.name}` : "");
                            return (
                              <SelectItem key={l._id} value={l._id ?? ""}>
                                {display}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-2 hidden md:table-cell">
                      <Input
                        value={row.narration ?? ""}
                        onChange={(e) =>
                          updateRow(row.id, "narration", e.target.value)
                        }
                        placeholder="Line note"
                        className="h-9"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        type="number"
                        min="0"
                        value={row.amount || ""}
                        onChange={(e) =>
                          updateRow(
                            row.id,
                            "amount",
                            Number(e.target.value || 0),
                          )
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && idx === rows.length - 1)
                            addRow();
                        }}
                        className="text-right h-9"
                      />
                    </td>
                    <td className="px-4 py-2 text-center">
                      {rows.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeRow(row.id)}
                          className="h-8 w-8 text-slate-400 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-slate-400">
                    No credit lines. Click “Add line” to start.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t bg-slate-50/50 flex items-center justify-between">
          <span className="text-sm text-slate-500">
            {rows.length} line{rows.length !== 1 && "s"} · Total credit:{" "}
            <strong>{formatMoney(totalCredits)}</strong>
          </span>
          <Badge
            variant={isBalanced ? "default" : "destructive"}
            className="gap-1"
          >
            {isBalanced ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" /> Balanced
              </>
            ) : (
              <>
                <AlertCircle className="h-3.5 w-3.5" /> Incomplete
              </>
            )}
          </Badge>
        </div>
      </Card>

      {/* ---- Reference & Narration ---- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <Label className="text-xs text-slate-500">Reference No</Label>
          <Input
            value={referenceNo}
            onChange={(e) => setReferenceNo(e.target.value)}
            className="mt-1 h-9"
            placeholder="e.g. cheque / transaction ID"
          />
          {modeRequiresReference && !referenceNo && (
            <p className="text-xs text-red-500 mt-1">Reference is required</p>
          )}
        </Card>

        <Card className="p-4">
          <Label className="text-xs text-slate-500">Narration</Label>
          <Textarea
            rows={3}
            value={voucherNarration}
            onChange={(e) => setVoucherNarration(e.target.value)}
            className="mt-1"
            placeholder="Optional overall description"
          />
        </Card>
      </div>

      <Separator />
      <div className="flex justify-between items-center text-xs text-slate-400">
        <span>
          Press{" "}
          <kbd className="px-1 py-0.5 bg-slate-100 rounded text-xs font-mono">
            Ctrl + Enter
          </kbd>{" "}
          to submit
        </span>
        <span>All fields are required unless marked optional</span>
      </div>
    </div>
  );
}
