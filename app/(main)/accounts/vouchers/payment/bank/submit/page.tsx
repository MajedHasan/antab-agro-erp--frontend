// app/accounts/vouchers/payment/bank/submit/page.tsx
"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Wallet,
  Calendar,
  Copy,
  Layers,
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
export default function BankPaymentVoucherPage() {
  /* ---------- Voucher fields ---------- */
  const [voucherNo, setVoucherNo] = useState(() => `BP-${Date.now()}`);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sourceId, setSourceId] = useState(""); // party id
  const [modeId, setModeId] = useState("");
  const [reference, setReference] = useState("");
  const [narration, setNarration] = useState("");
  const [selectedBankVaId, setSelectedBankVaId] = useState("");

  /* Debit rows */
  const [rows, setRows] = useState(() => [
    { id: crypto.randomUUID(), voucherAccountId: "", amount: 0, narration: "" },
  ]);

  /* ---------- Masters ---------- */
  const [accountsTree, setAccountsTree] = useState<any[]>([]);
  const [flatAccounts, setFlatAccounts] = useState<any[]>([]);
  const [voucherParties, setVoucherParties] = useState<any[]>([]);
  const [paymentModes, setPaymentModes] = useState<any[]>([]);
  const [voucherAccounts, setVoucherAccounts] = useState<any[]>([]);

  const flatAccountsRef = useRef<any[]>([]);
  const voucherAccountsRef = useRef<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  /* Supplier search state */
  const supplierTimer = useRef<number | null>(null);
  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplierOptions, setSupplierOptions] = useState<any[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState("");

  /* ---------- Derived maps ---------- */
  const voucherAccountsMap = useMemo(() => {
    const m = new Map<string, any>();
    voucherAccounts.forEach((v) => v?._id && m.set(String(v._id), v));
    return m;
  }, [voucherAccounts]);

  const accountsMap = useMemo(() => {
    const m = new Map<string, any>();
    flatAccounts.forEach((a) => a?._id && m.set(String(a._id), a));
    return m;
  }, [flatAccounts]);

  /* Banks – only role Bank, active, and allowed BankPayment */
  const banks = useMemo(
    () =>
      voucherAccounts.filter((v) => {
        if (!v || v.isActive === false) return false;
        if (v.role !== "Bank") return false;
        const types = v.allowedVoucherTypes || v.voucherTypes || [];
        return types.length === 0 || types.includes("BankPayment") || types.includes("All");
      }),
    [voucherAccounts],
  );

  /* Ledger options for debit lines – only BankPayment/All, not Bank itself */
  const ledgerOptions = useMemo(() => {
    return voucherAccounts.filter((va) => {
      if (va.isActive === false) return false;
      if (va.role === "Bank") return false;
      if (!va.allowedVoucherTypes || va.allowedVoucherTypes.length === 0) return true;
      return (
        va.allowedVoucherTypes.includes("BankPayment") ||
        va.allowedVoucherTypes.includes("All")
      );
    });
  }, [voucherAccounts]);

  /* Parties – Payment direction, active, BankPayment */
  const allowedParties = useMemo(() => {
    return voucherParties.filter((p) => {
      if (p.direction !== "Payment" && p.direction !== undefined) return false;
      if (p.isActive === false) return false;
      const types = p.voucherTypes || [];
      return types.length === 0 || types.includes("BankPayment") || types.includes("All");
    });
  }, [voucherParties]);

  /* Payment modes – only BankPayment */
  const allowedModes = useMemo(() => {
    return paymentModes.filter((m) => {
      if (m.isActive === false) return false;
      const types = m.voucherTypes || [];
      return types.length === 0 || types.includes("BankPayment") || types.includes("All");
    });
  }, [paymentModes]);

  /* ---------- Totals & Balances ---------- */
  const totalDebits = useMemo(
    () => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    [rows],
  );

  const selectedBankVa = useMemo(
    () => banks.find((b) => b._id === selectedBankVaId) || null,
    [banks, selectedBankVaId],
  );

  const bankAccountNode = useMemo(() => {
    if (!selectedBankVa?.accountId) return null;
    const accId =
      typeof selectedBankVa.accountId === "object"
        ? (selectedBankVa.accountId as any)._id
        : selectedBankVa.accountId;
    return accountsMap.get(String(accId));
  }, [selectedBankVa, accountsMap]);

  const bankOpeningBalance = useMemo(() => {
    if (!bankAccountNode) return 0;
    return (
      Number(bankAccountNode.openingBalance ?? 0) +
      Number(bankAccountNode.periodDebit ?? 0) -
      Number(bankAccountNode.periodCredit ?? 0)
    );
  }, [bankAccountNode]);

  const closingBalance = useMemo(
    () => bankOpeningBalance - totalDebits,
    [bankOpeningBalance, totalDebits],
  );

  const selectedParty = useMemo(
    () => voucherParties.find((p) => p._id === sourceId) || null,
    [voucherParties, sourceId],
  );

  const partyIsSupplier = useMemo(
    () => selectedParty && /supplier/i.test(selectedParty.name),
    [selectedParty],
  );

  const isBalanced =
    totalDebits > 0 &&
    rows.length > 0 &&
    rows.every((r) => r.voucherAccountId && Number(r.amount) > 0) &&
    !!selectedBankVaId &&
    !!modeId;

  /* ---------- Initial load ---------- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const [accountsRes, partiesRes, modesRes, vasRes] = await Promise.all([
          api.get("/accounts/tree").catch(() => ({ data: [] })),
          api.get("/voucher-parties?voucherTypes=BankPayment").catch(() => ({ data: [] })),
          api.get("/payment-modes?voucherTypes=BankPayment").catch(() => ({ data: [] })),
          api.get("/voucher-accounts?allowedVoucherTypes=BankPayment").catch(() => ({ data: [] })),
        ]);
        if (!mounted) return;

        const tree = accountsRes?.data?.data ?? [];
        setAccountsTree(tree);
        const flat = flattenTree(tree);
        setFlatAccounts(flat);
        flatAccountsRef.current = flat;

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
              (v?.name && String(v.name).trim()) ||
              (accountObj ? accountObj.name : String(v._id)),
            accountId: accountObj ? accountObj._id : v?.accountId || null,
            role: v.role,
            allowedVoucherTypes: v.allowedVoucherTypes || v.voucherTypes || [],
            isActive: v.isActive !== false,
          };
        });
        voucherAccountsRef.current = vas;
        setVoucherAccounts(vas);

        setVoucherParties(partiesRes?.data?.data ?? partiesRes?.data ?? []);
        setPaymentModes(modesRes?.data?.data ?? modesRes?.data ?? []);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load initial data");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  /* Auto‑select first bank if none selected */
  useEffect(() => {
    if (!selectedBankVaId && banks.length > 0) {
      setSelectedBankVaId(String(banks[0]._id));
    }
  }, [banks, selectedBankVaId]);

  /* Supplier search (debounced) */
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
        setSupplierOptions(res?.data?.data ?? res?.data ?? []);
      } catch (err) {
        console.error(err);
        setSupplierOptions([]);
      }
    }, 300);
    return () => {
      if (supplierTimer.current) window.clearTimeout(supplierTimer.current);
    };
  }, [supplierQuery]);

  /* Reset supplier/workorder state when party changes */
  useEffect(() => {
    setSelectedSupplier(null);
    setSupplierQuery("");
    setWorkOrders([]);
    setSelectedWorkOrderId("");
  }, [sourceId]);

  /* When supplier selected, load work orders and ensure ledger */
  const ensureAccountAndVaForSupplier = useCallback(
    async (supplier: any) => {
      if (!supplier?._id) return null;
      try {
        const sk = `supplier:${supplier._id}`;
        let acc: any = null;
        try {
          const res = await api
            .get(`/accounts?systemKey=${encodeURIComponent(sk)}&limit=1`)
            .catch(() => null);
          const found = res?.data?.data ?? res?.data ?? [];
          if (found.length) acc = found[0];
        } catch { /* ignore */ }

        if (!acc) {
          const createRes = await api.post("/accounts/auto-entity", {
            entityType: "Supplier",
            entityId: supplier._id,
            name: supplier.supplierName || supplier.ownerName || "Supplier",
          });
          acc = createRes?.data?.data ?? createRes?.data ?? null;
        }
        if (!acc?._id) return null;

        let va = voucherAccountsRef.current.find(
          (v) => String(v.accountId) === String(acc._id),
        );
        if (!va) {
          const createRes = await api.post("/voucher-accounts", {
            name: `Supplier → ${acc.name || supplier.supplierName || supplier._id}`,
            role: "Ledger",
            accountId: acc._id,
            voucherTypes: ["BankPayment", "All"],
            isActive: true,
          });
          va = createRes?.data?.data ?? createRes?.data ?? null;
          if (va) {
            const normalized = {
              ...va,
              _id: va._id,
              name:
                (va?.name && String(va.name).trim()) ||
                (acc?.name ?? String(va._id)),
              accountId: acc._id,
              role: va.role,
              allowedVoucherTypes: va.allowedVoucherTypes || va.voucherTypes || [],
              isActive: va.isActive !== false,
            };
            voucherAccountsRef.current = [
              ...voucherAccountsRef.current.filter(
                (v) => v._id !== normalized._id,
              ),
              normalized,
            ];
            setVoucherAccounts([...voucherAccountsRef.current]);
          }
        }

        if (va?._id) {
          setRows((prev) =>
            prev.map((r, i) =>
              i === 0 ? { ...r, voucherAccountId: va!._id } : r,
            ),
          );
        }
        return va;
      } catch (err) {
        console.error("ensureAccountAndVaForSupplier error", err);
        return null;
      }
    },
    [],
  );

  useEffect(() => {
    if (!selectedSupplier) {
      setWorkOrders([]);
      setSelectedWorkOrderId("");
      return;
    }
    (async () => {
      try {
        const wres = await api.get(
          `/workorders?supplierId=${encodeURIComponent(selectedSupplier._id)}&limit=50`,
        );
        setWorkOrders(wres?.data?.data ?? wres?.data ?? []);
        await ensureAccountAndVaForSupplier(selectedSupplier);
      } catch (err) {
        console.error(err);
      }
    })();
  }, [selectedSupplier, ensureAccountAndVaForSupplier]);

  /* ---------- Row helpers ---------- */
  const addRow = useCallback(
    () =>
      setRows((s) => [
        ...s,
        { id: crypto.randomUUID(), voucherAccountId: "", amount: 0, narration: "" },
      ]),
    [],
  );
  const removeRow = useCallback(
    (id: string) => setRows((s) => s.filter((r) => r.id !== id)),
    [],
  );
  const updateRow = useCallback(
    (id: string, key: string, value: any) =>
      setRows((s) => s.map((r) => (r.id === id ? { ...r, [key]: value } : r))),
    [],
  );

  /* ---------- Copy voucher no ---------- */
  const copyVoucherNo = useCallback(() => {
    navigator.clipboard.writeText(voucherNo);
    toast.success("Copied");
  }, [voucherNo]);

  /* ---------- Submit voucher ---------- */
  async function submitVoucher() {
    if (!selectedBankVaId) return toast.error("Select a Bank account.");
    if (!modeId) return toast.error("Select a payment mode.");
    if (rows.length === 0) return toast.error("Add at least one debit line.");
    if (rows.some((r) => !r.voucherAccountId || !r.amount || r.amount <= 0))
      return toast.error("Each row must have a ledger and amount > 0.");

    const bankVa = voucherAccountsMap.get(selectedBankVaId);
    if (!bankVa?.accountId) return toast.error("Bank not mapped to COA.");

    const lines: any[] = [
      {
        accountId: bankVa.accountId,
        debit: 0,
        credit: Number(totalDebits),
        narration: `Bank payment ${reference ? `(Ref: ${reference})` : ""}`.trim(),
      },
    ];

    rows.forEach((r) => {
      const va = voucherAccountsMap.get(r.voucherAccountId);
      lines.push({
        accountId: va ? va.accountId : r.voucherAccountId,
        debit: Number(r.amount),
        credit: 0,
        narration: r.narration || "",
      });
    });

    const dr = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
    const cr = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
    if (Math.abs(dr - cr) > 0.005) return toast.error("Voucher not balanced.");

    const source = selectedSupplier?._id || sourceId || undefined;
    const sourceModel = selectedSupplier
      ? "Supplier"
      : sourceId
        ? "VoucherParty"
        : undefined;

    const payload = {
      voucherNo,
      date,
      reference: undefined,
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
      ...(selectedWorkOrderId ? { workOrderId: selectedWorkOrderId } : {}),
    };

    try {
      setSaving(true);
      await api.post("/vouchers", payload);
      toast.success("Submitted for approval");

      // Reset form
      setVoucherNo(`BP-${Date.now()}`);
      setDate(new Date().toISOString().slice(0, 10));
      setSourceId("");
      setModeId("");
      setReference("");
      setNarration("");
      setSelectedBankVaId("");
      setRows([
        { id: crypto.randomUUID(), voucherAccountId: "", amount: 0, narration: "" },
      ]);
      setSelectedSupplier(null);
      setSupplierQuery("");
      setWorkOrders([]);
      setSelectedWorkOrderId("");
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
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <Wallet className="h-6 w-6 text-gray-700" />
            Bank Payment Voucher
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Record a payment from your bank — select payee, mode, bank and debit accounts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-sm text-gray-700 text-right mr-2">
            <div>
              Total payment: <span className="font-semibold">{formatTaka(totalDebits)}</span>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
          <Label className="text-xs text-gray-500">Payee (Source)</Label>
          <Select value={sourceId} onValueChange={(v) => setSourceId(v || "")}>
            <SelectTrigger className="mt-1 h-9 border-gray-200">
              <SelectValue placeholder="Select payee" />
            </SelectTrigger>
            <SelectContent>
              {allowedParties.map((p) => (
                <SelectItem key={String(p._id)} value={String(p._id)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="mt-2 text-xs text-gray-500">
            {partyIsSupplier ? (
              "Supplier selected — you can search & link work orders below."
            ) : (
              <>OR select a <strong>Supplier</strong> below to link work orders.</>
            )}
          </div>
        </Card>

        <Card className="p-4 shadow-sm border-gray-200 bg-white">
          <Label className="text-xs text-gray-500">Mode</Label>
          <Select value={modeId} onValueChange={(v) => setModeId(v || "")}>
            <SelectTrigger className="mt-1 h-9 border-gray-200">
              <SelectValue placeholder="Select mode" />
            </SelectTrigger>
            <SelectContent>
              {allowedModes.map((m) => (
                <SelectItem key={String(m._id)} value={String(m._id)}>
                  {m.name} {m.requiresReference ? " (ref. needed)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Card>
      </div>

      {/* Supplier block (if party is supplier) */}
      {partyIsSupplier && (
        <Card className="p-4 shadow-sm border-gray-200 bg-white">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs text-gray-500">Search Supplier</Label>
              <Input
                placeholder="Type supplier name (min 2 chars)"
                value={supplierQuery}
                onChange={(e) => setSupplierQuery(e.target.value)}
                className="mt-1"
              />
              <div className="mt-2 max-h-32 overflow-y-auto">
                {supplierOptions.slice(0, 8).map((s) => (
                  <button
                    key={s._id}
                    onClick={() => setSelectedSupplier(s)}
                    className={`block w-full text-left p-2 rounded hover:bg-gray-50 ${selectedSupplier?._id === s._id ? "bg-gray-100" : ""}`}
                  >
                    <div className="text-sm font-medium">{s.supplierName || s.ownerName || s._id}</div>
                    <div className="text-xs text-gray-400">{s.contactPerson ?? ""}</div>
                  </button>
                ))}
              </div>
              <div className="mt-2 text-xs text-gray-500">
                {selectedSupplier ? (
                  <div>
                    Selected:{" "}
                    <strong>
                      {selectedSupplier.supplierName || selectedSupplier.ownerName}
                    </strong>
                  </div>
                ) : (
                  <div>No supplier selected</div>
                )}
              </div>
            </div>

            <div>
              <Label className="text-xs text-gray-500">Work Orders</Label>
              <Select
                value={selectedWorkOrderId}
                onValueChange={(v) => setSelectedWorkOrderId(v || "")}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select Work Order (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {workOrders.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      No work orders
                    </SelectItem>
                  ) : (
                    workOrders.map((wo: any) => (
                      <SelectItem key={wo._id} value={String(wo._id)}>
                        {wo.workOrderNo || wo._id} {wo.status ? `— ${wo.status}` : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <div className="mt-2 text-xs text-gray-400">
                Selecting a work order will include it in the voucher.
              </div>
            </div>

            <div>
              <Label className="text-xs text-gray-500">Note</Label>
              <div className="mt-2 text-sm text-gray-700">
                Supplier ledger (if missing) is created automatically and
                auto‑selected into the first debit row.
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Bank & Balances */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 shadow-sm border-gray-200 bg-white">
          <Label className="text-xs text-gray-500">Bank (Voucher Account)</Label>
          <Select
            value={selectedBankVaId}
            onValueChange={(v) => setSelectedBankVaId(v || "")}
          >
            <SelectTrigger className="mt-1 h-9 border-gray-200">
              <SelectValue placeholder="Select Bank" />
            </SelectTrigger>
            <SelectContent>
              {banks.map((b) => {
                const mappedAcc = b.accountId
                  ? accountsMap.get(String(b.accountId))
                  : undefined;
                const label =
                  (b.name || "") +
                  (mappedAcc ? ` → ${mappedAcc.name}${mappedAcc.code ? ` (${mappedAcc.code})` : ""}` : "");
                return (
                  <SelectItem key={String(b._id)} value={String(b._id)}>
                    {label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-400 mt-2">
            Only bank‑type voucher accounts are shown.
          </p>
        </Card>

        <Card className="p-4 shadow-sm border-gray-200 bg-white flex flex-col justify-center">
          <Label className="text-xs text-gray-500">Opening Balance</Label>
          <div className="text-lg font-semibold text-gray-900 mt-1">
            {formatTaka(bankOpeningBalance)}
          </div>
          <p className="text-xs text-gray-400 mt-1">As per current ledger</p>
        </Card>

        <Card className="p-4 shadow-sm border-gray-200 bg-white flex flex-col justify-center">
          <Label className="text-xs text-gray-500">Projected Closing</Label>
          <div className={`text-lg font-semibold mt-1 ${closingBalance < 0 ? "text-red-600" : "text-gray-900"}`}>
            {formatTaka(closingBalance)}
          </div>
          <p className="text-xs text-gray-400 mt-1">After this payment</p>
        </Card>
      </div>

      {/* Debit Lines Table */}
      <Card className="shadow-sm border-gray-200 overflow-hidden bg-white">
        <div className="p-4 border-b flex items-center justify-between bg-gray-50/50">
          <h2 className="font-medium text-gray-900 flex items-center gap-2">
            <Layers className="h-5 w-5 text-gray-600" />
            Debit Entries
          </h2>
          <Button variant="outline" size="sm" onClick={addRow} className="gap-1 border-gray-300 text-gray-700 hover:bg-gray-50">
            <Plus className="h-4 w-4" /> Add line
          </Button>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead className="w-2/5 text-gray-600 font-medium">Ledger (Debit)</TableHead>
                <TableHead className="hidden md:table-cell text-gray-600 font-medium">Narration</TableHead>
                <TableHead className="text-right w-40 text-gray-600 font-medium">Amount (৳)</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, idx) => (
                <TableRow key={row.id} className="hover:bg-gray-50/50 transition-colors">
                  <TableCell className="align-top py-2">
                    <Select
                      value={row.voucherAccountId}
                      onValueChange={(v) => updateRow(row.id, "voucherAccountId", v || "")}
                    >
                      <SelectTrigger className="h-9 border-gray-200">
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
                            <SelectItem key={String(l._id)} value={String(l._id)}>
                              {display}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="hidden md:table-cell py-2">
                    <Input
                      value={row.narration ?? ""}
                      onChange={(e) => updateRow(row.id, "narration", e.target.value)}
                      placeholder="Line note"
                      className="h-9 border-gray-200"
                    />
                  </TableCell>
                  <TableCell className="py-2">
                    <Input
                      type="number"
                      min="0"
                      value={row.amount || ""}
                      onChange={(e) =>
                        updateRow(row.id, "amount", Number(e.target.value || 0))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && idx === rows.length - 1) addRow();
                      }}
                      className="text-right h-9 border-gray-200"
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
                  <TableCell colSpan={4} className="text-center py-8 text-gray-400">
                    No debit lines. Click “Add line” to start.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="p-4 border-t bg-gray-50/50 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            {rows.length} line{rows.length !== 1 && "s"} · Total debit:{" "}
            <strong className="text-gray-900">{formatTaka(totalDebits)}</strong>
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

      {/* Reference & Narration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4 shadow-sm border-gray-200 bg-white">
          <Label className="text-xs text-gray-500">Reference No</Label>
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className="mt-1 h-9 border-gray-200"
            placeholder="e.g. cheque number"
          />
        </Card>

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
      </div>

      <div className="flex justify-between items-center text-xs text-gray-400">
        <span>
          Press{" "}
          <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs font-mono">
            Ctrl + Enter
          </kbd>{" "}
          to submit
        </span>
        <span>All fields are required unless marked optional</span>
      </div>
    </div>
  );
}