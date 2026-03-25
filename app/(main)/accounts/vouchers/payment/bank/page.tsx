"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Toaster, toast } from "sonner";
import api from "@/lib/api";

/* shadcn UI */
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Save, Plus, Trash2 } from "lucide-react";

/* -----------------------
   Types
-------------------------*/
type VoucherAccount = {
  _id: string;
  name?: string;
  accountId?: string | { _id: string; name?: string; code?: string };
  role?: string;
  voucherTypes?: string[];
  allowedVoucherTypes?: string[];
  isActive?: boolean;
};

type AccountNode = {
  _id: string;
  name?: string;
  code?: string;
  openingBalance?: number;
  periodDebit?: number;
  periodCredit?: number;
  children?: AccountNode[];
};

type Supplier = {
  _id: string;
  supplierName?: string;
  ownerName?: string;
  [k: string]: any;
};

type VoucherParty = {
  _id: string;
  name: string;
  direction?: "Receive" | "Payment";
};

type PaymentMode = {
  _id: string;
  name: string;
  requiresReference?: boolean;
};

/* -----------------------
   Helpers
-------------------------*/
const formatMoney = (n = 0) => `₹ ${Number(n || 0).toFixed(2)}`;

function flattenTree(accs: AccountNode[] = []) {
  const out: AccountNode[] = [];
  const walk = (n: AccountNode) => {
    out.push(n);
    if (n.children) n.children.forEach(walk);
  };
  accs.forEach(walk);
  return out;
}

/* -----------------------
   Component
-------------------------*/
export default function BankPaymentVoucherPage() {
  /* meta */
  const [voucherNo, setVoucherNo] = useState(() => `BP-${Date.now()}`);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  /* masters */
  const [voucherAccounts, setVoucherAccounts] = useState<VoucherAccount[]>([]);
  const [voucherParties, setVoucherParties] = useState<VoucherParty[]>([]);
  const [paymentModes, setPaymentModes] = useState<PaymentMode[]>([]);
  const [accountsTree, setAccountsTree] = useState<AccountNode[]>([]);
  const flatAccountsRef = useRef<AccountNode[]>([]);

  /* party & supplier */
  const [selectedPartyId, setSelectedPartyId] = useState<string>("");
  const [supplierQuery, setSupplierQuery] = useState("");
  const supplierTimer = useRef<number | null>(null);
  const [supplierOptions, setSupplierOptions] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(
    null,
  );

  /* work orders */
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string>("");

  /* payment mode & reference/narration */
  const [modeId, setModeId] = useState<string>("");
  const [reference, setReference] = useState<string>("");
  const [narration, setNarration] = useState<string>("");

  /* rows: voucherAccountId chosen from ledgerOptions (VA id); amount is debit */
  type Row = {
    id: string;
    voucherAccountId: string;
    amount: number;
    narration?: string;
  };
  const [rows, setRows] = useState<Row[]>(() => [
    { id: crypto.randomUUID(), voucherAccountId: "", amount: 0, narration: "" },
  ]);

  /* selected bank voucher-account id */
  const [selectedBankVaId, setSelectedBankVaId] = useState<string>("");

  /* UI */
  const [saving, setSaving] = useState(false);
  const [loadingMasters, setLoadingMasters] = useState(true);

  /* -----------------------
     Initial load: masters
  ------------------------*/
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingMasters(true);
        const [accountsRes, vasRes, partiesRes, modesRes] = await Promise.all([
          api.get("/accounts/tree").catch(() => ({ data: { data: [] } })),
          api.get("/voucher-accounts").catch(() => ({ data: { data: [] } })),
          api.get("/voucher-parties").catch(() => ({ data: { data: [] } })),
          api.get("/payment-modes").catch(() => ({ data: { data: [] } })),
        ]);

        if (!mounted) return;

        const tree = (accountsRes?.data?.data ?? []) as AccountNode[];
        setAccountsTree(tree);
        flatAccountsRef.current = flattenTree(tree);

        const vasRaw = (vasRes?.data?.data ?? []) as any[];
        const vas = vasRaw
          .filter((v) => v && v._id)
          .map((v) => {
            const accountObj =
              v?.accountId && typeof v.accountId === "object"
                ? v.accountId
                : v?.accountId;
            return {
              ...v,
              _id: v._id,
              name:
                (v?.name && String(v.name).trim()) ||
                (accountObj && (accountObj as any).name) ||
                String(v._id),
              accountId: accountObj,
              role: v.role,
              voucherTypes: v.allowedVoucherTypes || v.voucherTypes || [],
              isActive: v.isActive !== false,
            } as VoucherAccount;
          });

        setVoucherAccounts(vas);
        setVoucherParties(partiesRes?.data?.data ?? []);
        setPaymentModes(modesRes?.data?.data ?? []);
      } catch (err) {
        console.error("Failed to load masters", err);
        toast.error("Failed to load masters (see console)");
      } finally {
        if (mounted) setLoadingMasters(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  /* -----------------------
     Derived sets
  ------------------------*/
  const banks = useMemo(
    () =>
      voucherAccounts.filter((v) => v.role === "Bank" && v.isActive !== false),
    [voucherAccounts],
  );

  const ledgerOptions = useMemo(() => {
    return voucherAccounts.filter((va) => {
      if (!va || va.isActive === false) return false;
      if (va.role === "Bank") return false; // exclude banks
      const vt = va.allowedVoucherTypes || va.voucherTypes || [];
      if (!vt || vt.length === 0) return true;
      return vt.includes("BankPayment") || vt.includes("All");
    });
  }, [voucherAccounts]);

  const accountsMap = useMemo(() => {
    const m = new Map<string, AccountNode>();
    flatAccountsRef.current.forEach((a) => {
      if (a && a._id) m.set(String(a._id), a);
    });
    return m;
  }, [accountsTree]);

  const selectedBankVa = useMemo(
    () => banks.find((b) => b._id === selectedBankVaId) ?? null,
    [banks, selectedBankVaId],
  );

  const selectedBankAccountNode = useMemo(() => {
    if (!selectedBankVa?.accountId) return null;
    const accId =
      typeof selectedBankVa.accountId === "object"
        ? (selectedBankVa.accountId as any)._id
        : selectedBankVa.accountId;
    return accountsMap.get(String(accId));
  }, [selectedBankVa, accountsMap]);

  const totalDebits = useMemo(
    () => rows.reduce((s, r) => s + Number(r.amount || 0), 0),
    [rows],
  );

  const bankOpeningBalance = useMemo(() => {
    const a = selectedBankAccountNode;
    if (!a) return 0;
    return (
      Number(a.openingBalance ?? 0) +
      Number(a.periodDebit ?? 0) -
      Number(a.periodCredit ?? 0)
    );
  }, [selectedBankAccountNode]);

  const closingBalance = useMemo(
    () => bankOpeningBalance - totalDebits,
    [bankOpeningBalance, totalDebits],
  );

  /* -----------------------
     Party -> supplier logic
  ------------------------*/
  const selectedParty = useMemo(
    () => voucherParties.find((p) => p._id === selectedPartyId) ?? null,
    [voucherParties, selectedPartyId],
  );

  const partyIsSupplier = useMemo(() => {
    if (!selectedParty) return false;
    return /supplier/i.test(selectedParty.name);
  }, [selectedParty]);

  /* supplier search (debounced) */
  useEffect(() => {
    if (!supplierQuery || supplierQuery.trim().length < 2) {
      setSupplierOptions([]);
      return;
    }
    if (supplierTimer.current) window.clearTimeout(supplierTimer.current);
    supplierTimer.current = window.setTimeout(async () => {
      try {
        const res = await api.get(
          `/supplier?q=${encodeURIComponent(supplierQuery)}&limit=12`,
        );
        const list = res?.data?.data ?? res?.data ?? [];
        setSupplierOptions(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error("supplier search failed", err);
        setSupplierOptions([]);
      }
    }, 300);
    return () => {
      if (supplierTimer.current) window.clearTimeout(supplierTimer.current);
    };
  }, [supplierQuery]);

  /* when party changes, reset supplier-workorder state */
  useEffect(() => {
    setSelectedSupplier(null);
    setSupplierQuery("");
    setWorkOrders([]);
    setSelectedWorkOrderId("");
    // also clear first-row ledger if it was auto-selected earlier? we keep it — user can change.
  }, [selectedPartyId]);

  /* when supplier selected: load workorders + ensure COA & VA + auto-select first row */
  const ensureAccountAndVaForSupplier = useCallback(
    async (supplier: Supplier | null) => {
      if (!supplier?._id) return null;
      try {
        // 1) find or create COA account via systemKey
        const sk = `supplier:${supplier._id}`;
        let acc: any = null;
        try {
          const res = await api
            .get(`/accounts?systemKey=${encodeURIComponent(sk)}&limit=1`)
            .catch(() => null);
          const found = res?.data?.data ?? res?.data ?? [];
          if (Array.isArray(found) && found.length) acc = found[0];
        } catch {
          /* ignore */
        }

        if (!acc) {
          const createRes = await api.post("/accounts/auto-entity", {
            entityType: "Supplier",
            entityId: supplier._id,
            name: supplier.supplierName || supplier.ownerName || "Supplier",
          });
          acc = createRes?.data?.data ?? createRes?.data ?? null;
        }

        if (!acc || !acc._id) return null;

        // 2) find or create voucher-account linked to that account
        let va = voucherAccounts.find((v) => {
          if (!v.accountId) return false;
          const aid =
            typeof v.accountId === "object"
              ? (v.accountId as any)._id
              : v.accountId;
          return String(aid) === String(acc._id);
        });

        if (!va) {
          const createRes = await api.post("/voucher-accounts", {
            name: `Supplier → ${acc.name || supplier.supplierName || supplier._id}`,
            role: "Ledger",
            accountId: acc._id,
            voucherTypes: ["BankPayment", "All"],
            isActive: true,
          });
          va = createRes?.data?.data ?? createRes?.data ?? null;
          if (va && va._id) {
            // normalize & add to state
            const accountObj =
              va?.accountId && typeof va.accountId === "object"
                ? va.accountId
                : va.accountId || acc._id;
            const normalized = {
              ...va,
              _id: va._id,
              name:
                (va?.name && String(va.name).trim()) ||
                (acc?.name ?? String(va._id)),
              accountId: accountObj,
              role: va.role,
              voucherTypes: va.allowedVoucherTypes || va.voucherTypes || [],
              isActive: va.isActive !== false,
            } as VoucherAccount;
            setVoucherAccounts((prev) => [
              ...prev.filter((p) => p._id !== normalized._id),
              normalized,
            ]);
          }
        }

        // 3) auto-select the supplier VA into first debit row if present
        if (va && va._id) {
          setRows((prev) =>
            prev.map((r, i) =>
              i === 0 ? { ...r, voucherAccountId: va!._id } : r,
            ),
          );
        }

        return va ?? null;
      } catch (err) {
        console.error("ensureAccountAndVaForSupplier error", err);
        return null;
      }
    },
    [voucherAccounts],
  );

  useEffect(() => {
    if (!selectedSupplier) {
      setWorkOrders([]);
      setSelectedWorkOrderId("");
      return;
    }

    (async () => {
      try {
        const wres = await api
          .get(
            `/workorders?supplierId=${encodeURIComponent(selectedSupplier._id)}&limit=50`,
          )
          .catch(() => ({ data: { data: [] } }));
        const wos = wres?.data?.data ?? wres?.data ?? [];
        setWorkOrders(Array.isArray(wos) ? wos : []);
        await ensureAccountAndVaForSupplier(selectedSupplier);
      } catch (err) {
        console.error("onSelectSupplier error", err);
      }
    })();
  }, [selectedSupplier, ensureAccountAndVaForSupplier]);

  /* -----------------------
     Row helpers
  ------------------------*/
  const addRow = useCallback(
    () =>
      setRows((s) => [
        ...s,
        {
          id: crypto.randomUUID(),
          voucherAccountId: "",
          amount: 0,
          narration: "",
        },
      ]),
    [],
  );

  const removeRow = useCallback(
    (id: string) => setRows((s) => s.filter((r) => r.id !== id)),
    [],
  );
  const updateRow = useCallback(
    (id: string, key: keyof Row, value: any) =>
      setRows((s) => s.map((r) => (r.id === id ? { ...r, [key]: value } : r))),
    [],
  );

  /* -----------------------
     Validation
  ------------------------*/
  const isBalanced = useMemo(() => {
    return (
      totalDebits > 0 &&
      rows.length > 0 &&
      !!selectedBankVaId &&
      !!modeId &&
      rows.every((r) => r.voucherAccountId && Number(r.amount) > 0)
    );
  }, [totalDebits, rows, selectedBankVaId, modeId]);

  /* -----------------------
     Submit voucher to backend (POST /vouchers)
  ------------------------*/
  async function submitVoucher() {
    if (!isBalanced) {
      toast.error("Voucher incomplete or not balanced.");
      return;
    }

    try {
      setSaving(true);

      // get bank underlying COA account id
      const bankVa = selectedBankVa!;
      const bankAccountId =
        typeof bankVa.accountId === "object"
          ? (bankVa.accountId as any)._id
          : bankVa.accountId;
      if (!bankAccountId) {
        toast.error(
          "Selected bank is not mapped to a Chart-of-Accounts account.",
        );
        setSaving(false);
        return;
      }

      const lines: any[] = [
        // Bank credit (for bank payment)
        {
          accountId: bankAccountId,
          debit: 0,
          credit: Number(totalDebits || 0),
          narration:
            `Bank payment ${reference ? `(Ref: ${reference})` : ""}`.trim(),
        },
      ];

      for (const r of rows) {
        const va = voucherAccounts.find((v) => v._id === r.voucherAccountId);
        const accId =
          va && va.accountId
            ? typeof va.accountId === "object"
              ? (va.accountId as any)._id
              : va.accountId
            : r.voucherAccountId; // fallback, but normally VA -> accountId exists

        lines.push({
          accountId: accId,
          debit: Number(r.amount || 0),
          credit: 0,
          narration: r.narration || "",
        });
      }

      // final balance check
      const dr = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
      const cr = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
      if (Math.abs(dr - cr) > 0.005) {
        toast.error("Internal balance mismatch. Aborting.");
        setSaving(false);
        return;
      }

      // determine source & sourceModel: prefer supplier if selected
      const source = selectedSupplier?._id || selectedPartyId || undefined;
      const sourceModel = selectedSupplier
        ? "Supplier"
        : selectedPartyId
          ? "VoucherParty"
          : undefined;

      const payload: any = {
        voucherNo,
        date,
        reference: undefined, // we embed ref into narration as requested
        narration: narration
          ? reference
            ? `${narration} (Ref: ${reference})`
            : narration
          : reference
            ? `Ref: ${reference}`
            : "",
        source,
        sourceModel,
        mode: modeId,
        lines,
        status: "Pending",
        bankVaId: selectedBankVaId,
        type: "BankPayment",
      };

      // optionally include workorder id if selected
      if (selectedWorkOrderId && selectedWorkOrderId !== "__none") {
        payload.workOrderId = selectedWorkOrderId;
      }

      const res = await api.post("/vouchers", {
        ...payload,
        createdBy: undefined,
      });
      const created = res?.data?.data ?? res?.data ?? null;

      toast.success("Voucher submitted for approval.");

      // reset form
      setVoucherNo(`BP-${Date.now()}`);
      setDate(new Date().toISOString().slice(0, 10));
      setSelectedPartyId("");
      setSelectedSupplier(null);
      setSupplierQuery("");
      setModeId("");
      setReference("");
      setNarration("");
      setRows([
        {
          id: crypto.randomUUID(),
          voucherAccountId: "",
          amount: 0,
          narration: "",
        },
      ]);
      setSelectedBankVaId("");
      setWorkOrders([]);
      setSelectedWorkOrderId("");

      return created;
    } catch (err: any) {
      console.error("submitVoucher error", err);
      const msg = err?.response?.data?.message || err?.message || "Save failed";
      toast.error(msg);
      throw err;
    } finally {
      setSaving(false);
    }
  }

  /* -----------------------
     UI
  ------------------------*/
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <Toaster position="top-right" richColors />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Bank Payment Voucher</h1>
          <p className="text-sm text-slate-500 mt-1">
            Record payments made from bank (submit for approval).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={submitVoucher} disabled={!isBalanced || saving}>
            <Save className="mr-2 h-4 w-4" />{" "}
            {saving ? "Saving..." : "Save / Send for Approval"}
          </Button>
        </div>
      </div>

      {/* Voucher meta */}
      <Card className="p-6 grid grid-cols-1 md:grid-cols-5 gap-4">
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
          <Label>Payment To (Party)</Label>
          <Select
            value={selectedPartyId || undefined}
            onValueChange={(v) => setSelectedPartyId(String(v || ""))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select Party" />
            </SelectTrigger>
            <SelectContent>
              {voucherParties
                .filter(
                  (p) => p.direction === "Payment" || p.direction === undefined,
                )
                .map((p) => (
                  <SelectItem key={p._id} value={String(p._id)}>
                    {p.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <div className="text-xs text-slate-400 mt-2">
            Selecting a <strong>Supplier</strong> party will show supplier
            search and work orders.
          </div>
        </div>

        <div>
          <Label>Payment Mode</Label>
          <Select
            value={modeId || undefined}
            onValueChange={(v) => setModeId(String(v || ""))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select Mode" />
            </SelectTrigger>
            <SelectContent>
              {paymentModes.map((m) => (
                <SelectItem key={m._id} value={String(m._id)}>
                  {m.name}
                  {m.requiresReference ? " (ref)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="hidden md:block" />
      </Card>

      {/* supplier block */}
      {partyIsSupplier && (
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Search Supplier</Label>
              <Input
                placeholder="Type supplier name (min 2 chars)"
                value={supplierQuery}
                onChange={(e) => setSupplierQuery(e.target.value)}
              />
              <div className="mt-2">
                {supplierOptions.slice(0, 8).map((s) => (
                  <button
                    key={s._id}
                    onClick={() => setSelectedSupplier(s)}
                    className={`block w-full text-left px-3 py-2 rounded hover:bg-slate-50 ${selectedSupplier?._id === s._id ? "bg-slate-100" : ""}`}
                  >
                    <div className="text-sm font-medium">
                      {s.supplierName || s.ownerName || s._id}
                    </div>
                    <div className="text-xs text-slate-400">
                      {s.contactPerson ?? ""}
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-2 text-xs text-slate-500">
                {selectedSupplier ? (
                  <div>
                    Selected:{" "}
                    <strong>
                      {selectedSupplier.supplierName ||
                        selectedSupplier.ownerName}
                    </strong>
                  </div>
                ) : (
                  <div>No supplier selected</div>
                )}
              </div>
            </div>

            <div>
              <Label>Work Orders</Label>
              <Select
                value={selectedWorkOrderId || undefined}
                onValueChange={(v) => setSelectedWorkOrderId(String(v || ""))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Work Order (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {workOrders.length === 0 ? (
                    <SelectItem key="__none_wo" value="__none_wo" disabled>
                      No work orders
                    </SelectItem>
                  ) : (
                    workOrders.map((wo: any) => (
                      <SelectItem key={wo._id} value={String(wo._id)}>
                        {wo.workOrderNo || wo._id}{" "}
                        {wo.status ? `— ${wo.status}` : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <div className="mt-2 text-xs text-slate-400">
                Selecting a work order will include it in the voucher.
              </div>
            </div>

            <div>
              <Label>Note</Label>
              <div className="mt-2 text-sm text-slate-700">
                Supplier ledger (if missing) is created automatically and
                auto-selected into the first debit row.
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Bank impact */}
      <Card className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label>Bank (Voucher Account)</Label>
          <Select
            value={selectedBankVaId || undefined}
            onValueChange={(v) => setSelectedBankVaId(String(v || ""))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select Bank" />
            </SelectTrigger>
            <SelectContent>
              {banks.length === 0 ? (
                <SelectItem key="__none_bank" value="__none_bank" disabled>
                  No banks found
                </SelectItem>
              ) : (
                banks.map((b) => (
                  <SelectItem key={b._id} value={String(b._id)}>
                    {b.name}{" "}
                    {b.accountId && typeof b.accountId === "object"
                      ? `→ ${(b.accountId as any).name}`
                      : ""}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Opening Balance</Label>
          <div className="mt-2 font-semibold text-slate-700">
            {selectedBankAccountNode ? formatMoney(bankOpeningBalance) : "—"}
          </div>
        </div>

        <div>
          <Label>Projected Closing Balance</Label>
          <div
            className={`mt-2 font-semibold ${closingBalance < 0 ? "text-rose-600" : "text-emerald-600"}`}
          >
            {selectedBankAccountNode ? formatMoney(closingBalance) : "—"}
          </div>
        </div>
      </Card>

      {/* Debit lines */}
      <Card className="p-0 overflow-hidden">
        <div className="p-3 border-b flex items-center justify-between">
          <div className="text-sm font-medium">Debit Lines</div>
          <div className="text-xs text-slate-500">
            Only ledgers allowed for BankPayment are shown
          </div>
        </div>

        <table className="w-full">
          <thead className="bg-slate-100 text-sm">
            <tr>
              <th className="px-4 py-3 text-left">Ledger (Debit)</th>
              <th className="px-4 py-3 text-left">Line Narration</th>
              <th className="px-4 py-3 text-right w-48">Amount</th>
              <th className="px-4 py-3 w-12"></th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, idx) => {
              const va = voucherAccounts.find(
                (v) => v._id === row.voucherAccountId,
              );
              const accName =
                va?.accountId && typeof va.accountId === "object"
                  ? (va.accountId as any).name
                  : undefined;
              return (
                <tr key={row.id} className="border-t hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Select
                      value={row.voucherAccountId || undefined}
                      onValueChange={(v) =>
                        updateRow(row.id, "voucherAccountId", String(v || ""))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select Ledger" />
                      </SelectTrigger>
                      <SelectContent>
                        {ledgerOptions.map((l) => (
                          <SelectItem key={l._id} value={String(l._id)}>
                            {l.name}{" "}
                            {l.accountId && typeof l.accountId === "object"
                              ? `→ ${(l.accountId as any).name}`
                              : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="mt-1 text-xs text-slate-400">
                      {va
                        ? va.accountId
                          ? `Mapped to: ${accName ?? "(not found)"}`
                          : "Not mapped to COA"
                        : "Select ledger"}
                    </div>
                  </td>

                  <td className="px-4 py-2">
                    <Input
                      value={row.narration ?? ""}
                      onChange={(e) =>
                        updateRow(row.id, "narration", e.target.value)
                      }
                      placeholder="Optional line narration"
                    />
                  </td>

                  <td className="px-4 py-2 text-right">
                    <Input
                      type="number"
                      min="0"
                      value={row.amount || ""}
                      onChange={(e) =>
                        updateRow(row.id, "amount", Number(e.target.value || 0))
                      }
                      className="text-right"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && idx === rows.length - 1)
                          addRow();
                      }}
                    />
                  </td>

                  <td className="px-4 py-2 text-center">
                    {rows.length > 1 && (
                      <button
                        className="text-rose-600"
                        onClick={() => removeRow(row.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>

          <tfoot className="bg-slate-50 font-semibold">
            <tr>
              <td colSpan={2} className="px-4 py-3 text-right">
                Total Amount
              </td>
              <td className="px-4 py-3 text-right">
                {formatMoney(totalDebits)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </Card>

      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={addRow}>
          <Plus className="mr-2 h-4 w-4" /> Add Line
        </Button>
        <div className="flex-1" />
        <div className="text-sm">
          Status:{" "}
          {isBalanced ? (
            <Badge variant="outline">Balanced</Badge>
          ) : (
            <Badge variant="destructive">Not balanced / missing info</Badge>
          )}
        </div>
      </div>

      {/* narration & reference */}
      <Card className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Voucher Narration</Label>
          <Textarea
            rows={3}
            value={narration}
            onChange={(e) => setNarration(e.target.value)}
            placeholder="Optional narration for this voucher"
          />
        </div>

        <div>
          <Label>Reference No</Label>
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="cheque/utr/transaction id (optional)"
          />
          <div className="text-xs text-slate-400 mt-2">
            Reference will be appended to the voucher narration on submit.
          </div>
        </div>
      </Card>

      <div className="flex justify-between items-center">
        <div className="text-sm text-slate-700">
          Bank Credit: <strong>{formatMoney(totalDebits)}</strong> • Debits
          total: <strong>{formatMoney(totalDebits)}</strong>
        </div>

        <div>
          <Button onClick={submitVoucher} disabled={!isBalanced || saving}>
            <Save className="mr-2 h-4 w-4" />{" "}
            {saving ? "Saving..." : "Save Voucher"}
          </Button>
        </div>
      </div>
    </div>
  );
}
