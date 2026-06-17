// app/accounts/vouchers/contra/submit/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowRightLeft,
  Calendar,
  Copy,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
const formatTaka = (n = 0) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

const flattenTree = (accounts: any[] = []) => {
  const out: any[] = [];
  const walk = (n: any) => {
    out.push(n);
    if (n.children) n.children.forEach(walk);
  };
  accounts.forEach(walk);
  return out;
};

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
export default function ContraVoucherPage() {
  /* ---------- Voucher fields ---------- */
  const [voucherNo, setVoucherNo] = useState(() => `CNT-${Date.now()}`);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [narration, setNarration] = useState("");

  /* Transfer entries – each row has a from (credit) and to (debit) ledger */
  type TransferRow = {
    id: string;
    fromVaId: string; // voucher account id for the account we credit (money leaves)
    toVaId: string;   // voucher account id for the account we debit (money arrives)
    amount: number;
    narration: string;
  };
  const [rows, setRows] = useState<TransferRow[]>([
    { id: crypto.randomUUID(), fromVaId: "", toVaId: "", amount: 0, narration: "" },
  ]);

  /* ---------- Masters ---------- */
  const [flatAccounts, setFlatAccounts] = useState<any[]>([]);
  const [voucherAccounts, setVoucherAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  /* ---------- Derived maps ---------- */
  const accountsMap = useMemo(() => {
    const m = new Map<string, any>();
    flatAccounts.forEach((a) => a?._id && m.set(String(a._id), a));
    return m;
  }, [flatAccounts]);

  /* Voucher accounts allowed for Contra (active, and types include Contra or All) */
  const contraVas = useMemo(() => {
    return voucherAccounts.filter((va) => {
      if (va.isActive === false) return false;
      const types = va.allowedVoucherTypes || va.voucherTypes || [];
      return types.length === 0 || types.includes("Contra") || types.includes("All");
    });
  }, [voucherAccounts]);

  /* ---------- Totals & validation ---------- */
  const totalAmount = useMemo(() => rows.reduce((s, r) => s + (r.amount || 0), 0), [rows]);
  const isBalanced =
    totalAmount > 0 &&
    rows.every((r) => r.fromVaId && r.toVaId && r.amount > 0);

  /* ---------- Load data ---------- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const [treeRes, vasRes] = await Promise.all([
          api.get("/accounts/tree").catch(() => ({ data: [] })),
          api.get("/voucher-accounts?allowedVoucherTypes=Contra").catch(() => ({ data: { data: [] } })),
        ]);
        if (!mounted) return;

        setFlatAccounts(flattenTree(treeRes?.data?.data ?? []));

        const vasRaw = vasRes?.data?.data ?? [];
        const vas = vasRaw.map((v: any) => {
          const accountObj = v?.accountId && typeof v.accountId === "object" ? v.accountId : null;
          return {
            ...v,
            _id: v._id,
            name: (v?.name && String(v.name).trim()) || (accountObj ? accountObj.name : String(v._id)),
            accountId: accountObj ? accountObj._id : v?.accountId || null,
            role: v.role,
            allowedVoucherTypes: v.allowedVoucherTypes || v.voucherTypes || [],
            isActive: v.isActive !== false,
          };
        });
        setVoucherAccounts(vas);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load required data");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  /* ---------- Row helpers ---------- */
  const addRow = useCallback(
    () =>
      setRows((s) => [
        ...s,
        { id: crypto.randomUUID(), fromVaId: "", toVaId: "", amount: 0, narration: "" },
      ]),
    [],
  );
  const removeRow = useCallback((id: string) => setRows((s) => s.filter((r) => r.id !== id)), []);
  const updateRow = useCallback(
    (id: string, key: keyof TransferRow, value: any) =>
      setRows((s) => s.map((r) => (r.id === id ? { ...r, [key]: value } : r))),
    [],
  );

  /* ---------- Copy voucher no ---------- */
  const copyVoucherNo = useCallback(() => {
    navigator.clipboard.writeText(voucherNo);
    toast.success("Copied");
  }, [voucherNo]);

  /* ---------- Submit ---------- */
  async function submitVoucher() {
    if (!isBalanced) {
      toast.error("All transfers must have both ledgers and a positive amount.");
      return;
    }

    // Build lines: for each row, credit the "from" account, debit the "to" account.
    const lines: any[] = [];
    for (const r of rows) {
      const fromVa = contraVas.find((v) => v._id === r.fromVaId);
      const toVa = contraVas.find((v) => v._id === r.toVaId);
      if (!fromVa?.accountId || !toVa?.accountId) {
        toast.error("One of the selected ledgers is not linked to a COA account.");
        return;
      }
      // credit the from account
      lines.push({
        accountId: fromVa.accountId,
        debit: 0,
        credit: Number(r.amount),
        narration: r.narration || "",
      });
      // debit the to account
      lines.push({
        accountId: toVa.accountId,
        debit: Number(r.amount),
        credit: 0,
        narration: r.narration || "",
      });
    }

    // Double-entry check (should be fine)
    const dr = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
    const cr = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
    if (Math.abs(dr - cr) > 0.005) {
      toast.error("Internal balance mismatch. Aborting.");
      return;
    }

    const payload = {
      voucherNo,
      date,
      reference: reference || undefined,
      narration: narration || undefined,
      lines,
      status: "Pending",
      type: "Contra",
    };

    try {
      setSaving(true);
      await api.post("/vouchers", payload);
      toast.success("Contra voucher submitted for approval");

      // Reset form
      setVoucherNo(`CNT-${Date.now()}`);
      setDate(new Date().toISOString().slice(0, 10));
      setReference("");
      setNarration("");
      setRows([
        { id: crypto.randomUUID(), fromVaId: "", toVaId: "", amount: 0, narration: "" },
      ]);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to save voucher.");
    } finally {
      setSaving(false);
    }
  }

  /* ================================================================== */
  /*  Render                                                            */
  /* ================================================================== */
  if (loading) {
    return <div className="p-6 text-center text-gray-500">Loading…</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <ArrowRightLeft className="h-6 w-6 text-gray-700" />
            Contra Voucher
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Transfer funds between two accounts (Bank ↔ Cash, Bank ↔ Bank, etc.)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-sm text-gray-700 text-right mr-2">
            <div>
              Total transfer: <span className="font-semibold">{formatTaka(totalAmount)}</span>
            </div>
          </div>
          <Button
            onClick={submitVoucher}
            disabled={!isBalanced || saving}
            className="gap-2 bg-gray-900 hover:bg-gray-800 text-white shadow-sm"
          >
            {saving ? (
              "Saving..."
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" /> Submit for Approval
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Meta fields */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 shadow-sm border-gray-200 bg-white">
          <Label className="text-xs text-gray-500">Voucher No</Label>
          <div className="flex items-center gap-2 mt-1">
            <Input
              value={voucherNo}
              onChange={(e) => setVoucherNo(e.target.value)}
              className="font-mono text-sm h-9 border-gray-200"
            />
            <Button variant="ghost" size="icon" onClick={copyVoucherNo} className="shrink-0 text-gray-400 hover:text-gray-700">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </Card>

        <Card className="p-4 shadow-sm border-gray-200 bg-white">
          <Label className="text-xs text-gray-500">Date</Label>
          <div className="relative mt-1">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 border-gray-200"
            />
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
        </Card>

        <Card className="p-4 shadow-sm border-gray-200 bg-white">
          <Label className="text-xs text-gray-500">Reference</Label>
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className="mt-1 h-9 border-gray-200"
            placeholder="Optional reference"
          />
        </Card>
      </div>

      {/* Transfer Entries */}
      <Card className="shadow-sm border-gray-200 overflow-hidden bg-white">
        <div className="p-4 border-b flex items-center justify-between bg-gray-50/50">
          <h2 className="font-medium text-gray-900 flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-gray-600" />
            Transfer Entries
          </h2>
          <Button variant="outline" size="sm" onClick={addRow} className="gap-1 border-gray-300 text-gray-700 hover:bg-gray-50">
            <Plus className="h-4 w-4" /> Add entry
          </Button>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead className="text-gray-600 font-medium">From (Credit)</TableHead>
                <TableHead className="text-gray-600 font-medium">To (Debit)</TableHead>
                <TableHead className="text-right w-32 text-gray-600 font-medium">Amount</TableHead>
                <TableHead className="hidden md:table-cell text-gray-600 font-medium">Narration</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, idx) => (
                <TableRow key={row.id} className="hover:bg-gray-50/50 transition-colors">
                  <TableCell className="align-top py-2 max-w-[250px] overflow-hidden">
                    <Select
                      value={row.fromVaId}
                      onValueChange={(v) => updateRow(row.id, "fromVaId", v || "")}
                    >
                      <SelectTrigger className="h-9 border-gray-200">
                        <SelectValue placeholder="Select from ledger" />
                      </SelectTrigger>
                      <SelectContent>
                        {contraVas.map((va) => {
                          const acc = va.accountId ? accountsMap.get(String(va.accountId)) : undefined;
                          const display = `${va.name || ""}${acc ? ` → ${acc.name} (${acc.code})` : ""}`;
                          return (
                            <SelectItem key={va._id} value={va._id}>
                              {display}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="align-top py-2 max-w-[250px] overflow-hidden">
                    <Select
                      value={row.toVaId}
                      onValueChange={(v) => updateRow(row.id, "toVaId", v || "")}
                    >
                      <SelectTrigger className="h-9 border-gray-200">
                        <SelectValue placeholder="Select to ledger" />
                      </SelectTrigger>
                      <SelectContent>
                        {contraVas.map((va) => {
                          const acc = va.accountId ? accountsMap.get(String(va.accountId)) : undefined;
                          const display = `${va.name || ""}${acc ? ` → ${acc.name} (${acc.code})` : ""}`;
                          return (
                            <SelectItem key={va._id} value={va._id}>
                              {display}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="py-2">
                    <Input
                      type="number"
                      min="0"
                      value={row.amount || ""}
                      onChange={(e) => updateRow(row.id, "amount", Number(e.target.value || 0))}
                      className="text-right h-9 border-gray-200"
                    />
                  </TableCell>
                  <TableCell className="hidden md:table-cell py-2">
                    <Input
                      value={row.narration ?? ""}
                      onChange={(e) => updateRow(row.id, "narration", e.target.value)}
                      placeholder="Line note"
                      className="h-9 border-gray-200"
                    />
                  </TableCell>
                  <TableCell className="py-2 text-center">
                    {rows.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRow(row.id)}
                        className="h-8 w-8 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-400">
                    No transfer entries. Click “Add entry” to start.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="p-4 border-t bg-gray-50/50 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            {rows.length} entr{rows.length !== 1 ? "ies" : "y"} · Total:{" "}
            <strong className="text-gray-900">{formatTaka(totalAmount)}</strong>
          </span>
          <Badge
            variant={isBalanced ? "default" : "destructive"}
            className="gap-1"
          >
            {isBalanced ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" /> Complete
              </>
            ) : (
              <>
                <AlertCircle className="h-3.5 w-3.5" /> Incomplete
              </>
            )}
          </Badge>
        </div>
      </Card>

      {/* Narration */}
      <Card className="p-4 shadow-sm border-gray-200 bg-white">
        <Label className="text-xs text-gray-500">Narration</Label>
        <Textarea
          rows={3}
          value={narration}
          onChange={(e) => setNarration(e.target.value)}
          className="mt-1 border-gray-200"
          placeholder="Optional overall description"
        />
      </Card>

      <div className="flex justify-between items-center text-xs text-gray-400">
        <span>
          Press{" "}
          <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs font-mono">
            Ctrl + Enter
          </kbd>{" "}
          to submit
        </span>
        <span>Each row transfers the amount from the left ledger to the right ledger</span>
      </div>
    </div>
  );
}