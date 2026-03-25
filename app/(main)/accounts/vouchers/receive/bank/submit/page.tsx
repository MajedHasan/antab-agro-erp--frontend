"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import api from "@/lib/api";
import { Toaster, toast } from "sonner";

/* shadcn UI */
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

/* -----------------------
   Helpers
----------------------- */
const formatMoney = (n = 0) => `₹ ${Number(n || 0).toFixed(2)}`;

const flattenTree = (accounts = []) => {
  const out = [];
  const walk = (n) => {
    out.push(n);
    if (n.children) n.children.forEach(walk);
  };
  accounts.forEach(walk);
  return out;
};

const slugifyCode = (name = "") =>
  `${(name || "SYS")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/-+/g, "-")
    .toUpperCase()
    .slice(0, 12)}-${Date.now().toString().slice(-6)}`.slice(0, 64);

const accountIdFromLine = (ln) => {
  if (!ln) return null;
  if (ln.accountId && typeof ln.accountId === "object")
    return ln.accountId._id ?? ln.accountId.id ?? null;
  return ln.accountId ?? null;
};

/* =========================
   Bank Receive Voucher Page (create-only)
========================= */
export default function BankReceiveVoucherPage() {
  /* ---------- Voucher fields (create-only) ---------- */
  const [voucherNo, setVoucherNo] = useState(() => `BR-${Date.now()}`);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  // "source" and "mode" replace receiveParty/receiveMode
  const [sourceId, setSourceId] = useState("");
  const [modeId, setModeId] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [selectedBankVaId, setSelectedBankVaId] = useState("");
  const [voucherNarration, setVoucherNarration] = useState("");

  const [rows, setRows] = useState(() => [
    { id: crypto.randomUUID(), voucherAccountId: "", amount: 0, narration: "" },
  ]);

  /* ---------- Masters & lookups ---------- */
  const [accountsTree, setAccountsTree] = useState([]);
  const [flatAccounts, setFlatAccounts] = useState([]);
  const [voucherParties, setVoucherParties] = useState([]);
  const [paymentModes, setPaymentModes] = useState([]);
  const [voucherAccounts, setVoucherAccounts] = useState([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const dealerSearchTimer = useRef(null);

  /* Dealer search & selection */
  const [dealerQuery, setDealerQuery] = useState("");
  const [dealerOptions, setDealerOptions] = useState([]);
  const [selectedDealerId, setSelectedDealerId] = useState("");
  const [dealerAccount, setDealerAccount] = useState(null);
  const [dealerVoucherAccount, setDealerVoucherAccount] = useState(null);

  const [invoiceOptions, setInvoiceOptions] = useState([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  /* Commission & bank charge auto-ledgers */
  const [commissionType, setCommissionType] = useState("percent");
  const [commissionValue, setCommissionValue] = useState(0);
  const [commissionVaId, setCommissionVaId] = useState("");
  const [bankChargeAmount, setBankChargeAmount] = useState(0);
  const [bankChargeVaId, setBankChargeVaId] = useState("");

  /* ---------- Derived maps & lists ---------- */
  const voucherAccountsMap = useMemo(() => {
    const m = new Map();
    voucherAccounts.forEach((v) => v && v._id && m.set(String(v._id), v));
    return m;
  }, [voucherAccounts]);

  const accountsMap = useMemo(() => {
    const m = new Map();
    flatAccounts.forEach((a) => a && a._id && m.set(String(a._id), a));
    return m;
  }, [flatAccounts]);

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

  const totalCredits = useMemo(
    () => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    [rows],
  );

  const commissionAmount = useMemo(() => {
    const gross = totalCredits;
    if (!gross) return 0;
    if (commissionType === "percent")
      return (Number(commissionValue || 0) / 100) * gross;
    return Number(commissionValue || 0);
  }, [commissionType, commissionValue, totalCredits]);

  const bankCharge = useMemo(
    () => Number(bankChargeAmount || 0),
    [bankChargeAmount],
  );

  const bankOpeningBalance = useMemo(() => {
    const bank = banks.find((b) => b._id === selectedBankVaId);
    if (!bank || !bank.accountId) return 0;
    const acc = accountsMap.get(String(bank.accountId));
    return (
      Number(acc?.openingBalance ?? 0) +
      Number(acc?.periodDebit ?? 0) -
      Number(acc?.periodCredit ?? 0)
    );
  }, [selectedBankVaId, banks, accountsMap]);

  const netBankDebit = useMemo(
    () =>
      Number(totalCredits || 0) -
      Number(commissionAmount || 0) -
      Number(bankCharge || 0),
    [totalCredits, commissionAmount, bankCharge],
  );

  const closingBankBalance = useMemo(
    () => bankOpeningBalance + (isFinite(netBankDebit) ? netBankDebit : 0),
    [bankOpeningBalance, netBankDebit],
  );

  const selectedMode = useMemo(
    () => paymentModes.find((m) => m._id === modeId) || null,
    [paymentModes, modeId],
  );
  const modeRequiresReference = Boolean(selectedMode?.requiresReference);

  const selectedParty = useMemo(
    () => voucherParties.find((p) => p._id === sourceId) || null,
    [voucherParties, sourceId],
  );
  const isPartyDealer = useMemo(
    () => (selectedParty ? /dealer|customer/i.test(selectedParty.name) : false),
    [selectedParty],
  );
  const isDealerMode = useMemo(
    () => isPartyDealer || !!selectedDealerId,
    [isPartyDealer, selectedDealerId],
  );

  const isBalanced =
    totalCredits > 0 &&
    rows.length > 0 &&
    rows.every((r) => r.voucherAccountId && Number(r.amount) > 0) &&
    !!selectedBankVaId &&
    !!modeId &&
    (!modeRequiresReference || !!referenceNo) &&
    netBankDebit > 0 &&
    (commissionAmount === 0 || !!commissionVaId) &&
    (bankCharge === 0 || !!bankChargeVaId) &&
    (!isPartyDealer || !!selectedDealerId);

  /* Lightweight VA label helper */
  const vaLabel = useCallback(
    (va) => {
      if (!va) return "";
      const labelFromVa = va.name && String(va.name).trim();
      if (labelFromVa) return labelFromVa;
      if (va.accountId) {
        const acc = accountsMap.get(String(va.accountId));
        if (acc) return acc.name + (acc.code ? ` (${acc.code})` : "");
      }
      return String(va._id);
    },
    [accountsMap],
  );

  /* =========================
     API helpers (local)
  ========================= */
  const ensureAccountExistsViaAPI = useCallback(
    async (name, type = "Expense") => {
      try {
        const qRes = await api
          .get(`/accounts?q=${encodeURIComponent(name)}&limit=5`)
          .catch(() => ({ data: [] }));
        const matches = qRes?.data?.data ?? qRes?.data ?? [];
        const exact = matches.find(
          (m) => (m.name || "").toLowerCase() === name.toLowerCase(),
        );
        if (exact) return exact;
        const generatedCode = slugifyCode(name);
        const createRes = await api.post("/accounts", {
          code: generatedCode,
          name,
          type,
          status: "Active",
        });
        return createRes?.data?.data ?? createRes?.data ?? null;
      } catch (err) {
        console.error("ensureAccountExistsViaAPI error:", err);
        return null;
      }
    },
    [],
  );

  const ensureVoucherAccountExistsForAccount = useCallback(
    async (account, desiredName, voucherTypes = ["BankReceive", "All"]) => {
      try {
        const res = await api
          .get("/voucher-accounts")
          .catch(() => ({ data: [] }));
        const list = (res?.data?.data ?? res?.data ?? []) || [];
        let existing = null;
        if (account && account._id) {
          existing = list.find(
            (v) =>
              String(v?.accountId?._id || v?.accountId) === String(account._id),
          );
        }
        if (!existing) {
          existing = list.find(
            (v) =>
              (v.name || "") === desiredName ||
              (v.accountId && v.accountId.name) === desiredName,
          );
        }
        if (existing) {
          const accountObj =
            existing?.accountId && typeof existing.accountId === "object"
              ? existing.accountId
              : null;
          const normalized = {
            ...existing,
            _id: existing._id,
            name:
              (existing.name && String(existing.name).trim()) ||
              (accountObj ? accountObj.name : String(existing._id)),
            accountId: accountObj ? accountObj._id : existing.accountId || null,
            role: existing.role,
            voucherTypes:
              existing.allowedVoucherTypes || existing.voucherTypes || [],
            isActive: existing.isActive !== false,
          };
          setVoucherAccounts((prev) =>
            prev.find((p) => String(p._id) === String(normalized._id))
              ? prev
              : [...prev, normalized],
          );
          return normalized;
        }
        if (!account || !account._id) {
          console.warn(
            "Cannot create voucher-account: account missing for",
            desiredName,
          );
          return null;
        }
        const createRes = await api.post("/voucher-accounts", {
          name: desiredName,
          role: "Ledger",
          accountId: account._id,
          voucherTypes,
          isActive: true,
        });
        const created = createRes?.data?.data ?? createRes?.data ?? null;
        if (!created) return null;
        const accountObj =
          created?.accountId && typeof created.accountId === "object"
            ? created.accountId
            : null;
        const normalizedCreated = {
          ...created,
          _id: created._id,
          name:
            (created.name && String(created.name).trim()) ||
            (accountObj ? accountObj.name : String(created._id)),
          accountId: accountObj ? accountObj._id : created.accountId || null,
          role: created.role,
          voucherTypes:
            created.allowedVoucherTypes || created.voucherTypes || [],
          isActive: created.isActive !== false,
        };
        setVoucherAccounts((prev) =>
          prev.find((p) => String(p._id) === String(normalizedCreated._id))
            ? prev
            : [...prev, normalizedCreated],
        );
        return normalizedCreated;
      } catch (err) {
        console.error("ensureVoucherAccountExistsForAccount error:", err);
        return null;
      }
    },
    [],
  );

  const ensureSystemLedgerAndSelect = useCallback(
    async (desiredName, accountType, voucherTypes, setVaId) => {
      try {
        const account = await ensureAccountExistsViaAPI(
          desiredName,
          accountType,
        );
        const va = await ensureVoucherAccountExistsForAccount(
          account,
          desiredName,
          voucherTypes,
        );
        if (va && va._id) setVaId(String(va._id));
      } catch (err) {
        console.error("ensureSystemLedgerAndSelect error:", err);
      }
    },
    [ensureAccountExistsViaAPI, ensureVoucherAccountExistsForAccount],
  );

  /* =========================
     Initial load (masters)
  ========================= */
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

        const tree = (accountsRes?.data?.data ?? []) || [];
        setAccountsTree(tree);
        setFlatAccounts(flattenTree(tree));

        const vasRaw = (vasRes?.data?.data ?? vasRes?.data ?? []) || [];
        const vas = vasRaw.map((v) => {
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
            voucherTypes: v.allowedVoucherTypes || v.voucherTypes || [],
            isActive: v.isActive !== false,
            description: v.description,
          };
        });
        setVoucherAccounts(vas);

        setVoucherParties(partiesRes?.data?.data ?? partiesRes?.data ?? []);
        setPaymentModes(modesRes?.data?.data ?? modesRes?.data ?? []);

        // ensure system ledgers (idempotent)
        await ensureSystemLedgerAndSelect(
          "Sales Discounts",
          "Expense",
          ["BankReceive", "All"],
          setCommissionVaId,
        );
        await ensureSystemLedgerAndSelect(
          "Bank Deposit Charge",
          "Expense",
          ["BankReceive", "All"],
          setBankChargeVaId,
        );
      } catch (err) {
        console.error(err);
        toast.error("Failed to load initial data — see console.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [ensureSystemLedgerAndSelect]);

  /* =========================
     Dealer search (debounced)
  ========================= */
  useEffect(() => {
    if (!dealerQuery || dealerQuery.trim().length < 2) {
      setDealerOptions([]);
      return;
    }
    if (dealerSearchTimer.current)
      window.clearTimeout(dealerSearchTimer.current);
    dealerSearchTimer.current = window.setTimeout(async () => {
      try {
        const res = await api.get(
          `/dealers?q=${encodeURIComponent(dealerQuery)}&limit=10`,
        );
        setDealerOptions(res?.data?.data ?? res?.data ?? []);
      } catch (e) {
        console.error(e);
        setDealerOptions([]);
      }
    }, 300);
    return () => {
      if (dealerSearchTimer.current)
        window.clearTimeout(dealerSearchTimer.current);
    };
  }, [dealerQuery]);

  /* =========================
     Dealer selection
     - only set sourceId if user hasn't already chosen a Source
  ========================= */
  const onSelectDealer = useCallback(
    async (d) => {
      if (!d?._id) return;
      setSelectedDealerId(String(d._id));
      setDealerQuery(d.name || "");

      // only set Source if not explicitly chosen
      setSourceId((prev) => {
        if (prev) return prev;
        const dealerParty = voucherParties.find(
          (p) => p.direction === "Receive" && /dealer|customer/i.test(p.name),
        );
        return dealerParty?._id || prev;
      });

      // ensure account & VA mapping
      try {
        let acc = null;
        try {
          const sk = `dealer:${d._id}`;
          const aRes = await api.get(
            `/accounts?systemKey=${encodeURIComponent(sk)}&limit=1`,
          );
          const found = aRes?.data?.data ?? aRes?.data ?? [];
          if (found && found.length) acc = found[0];
        } catch {
          /* ignore */
        }

        if (!acc) {
          const res = await api.post("/accounts/auto-entity", {
            entityType: "Dealer",
            entityId: d._id,
            name: d.name,
          });
          acc = res?.data?.data ?? res?.data ?? null;
        }
        setDealerAccount(acc);

        if (acc && acc._id) {
          let va =
            voucherAccounts.find(
              (v) => String(v.accountId) === String(acc._id),
            ) ?? null;
          if (!va) {
            const created = await ensureVoucherAccountExistsForAccount(
              acc,
              `Dealer → ${acc.name}`,
              ["BankReceive", "All"],
            );
            if (created) va = created;
          }
          if (va) setDealerVoucherAccount(va);

          // load unpaid & partial invoices
          const invRes = await api.get(
            `/sales-invoices?customerId=${d._id}&paymentStatus=UNPAID,PARTIAL&limit=50`,
          );
          const invs = invRes?.data?.data ?? invRes?.data ?? [];
          setInvoiceOptions(invs);
        }
      } catch (err) {
        console.error("onSelectDealer error", err);
      }
    },
    [ensureVoucherAccountExistsForAccount, voucherAccounts, voucherParties],
  );

  /* When invoice selected, prefill credit row */
  useEffect(() => {
    if (!selectedInvoiceId) {
      setSelectedInvoice(null);
      return;
    }
    (async () => {
      try {
        const res = await api.get(`/sales-invoices/${selectedInvoiceId}`);
        const inv = res?.data?.data ?? res?.data ?? null;
        setSelectedInvoice(inv);
        const defaultAmount = Number(
          inv?.balanceAmount ?? inv?.grandTotal ?? 0,
        );
        if (dealerVoucherAccount && dealerVoucherAccount._id) {
          setRows([
            {
              id: crypto.randomUUID(),
              voucherAccountId: String(dealerVoucherAccount._id),
              amount: defaultAmount,
              narration: `Payment for ${inv?.invoiceNo || "Invoice"}`,
            },
          ]);
        } else {
          setRows([
            {
              id: crypto.randomUUID(),
              voucherAccountId: "",
              amount: defaultAmount,
              narration: `Payment for ${inv?.invoiceNo || "Invoice"}`,
            },
          ]);
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to load invoice details.");
      }
    })();
  }, [selectedInvoiceId, dealerVoucherAccount]);

  /* Row helpers */
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
    (id) => setRows((s) => s.filter((r) => r.id !== id)),
    [],
  );
  const updateRow = useCallback(
    (id, key, value) =>
      setRows((s) => s.map((r) => (r.id === id ? { ...r, [key]: value } : r))),
    [],
  );

  /* Copy voucher no */
  const copyVoucherNo = useCallback(() => {
    try {
      navigator.clipboard.writeText(voucherNo);
      toast.success("Voucher No copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  }, [voucherNo]);

  /* Keyboard shortcut (Ctrl/Cmd+Enter) to Submit */
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") submitVoucher();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    modeId,
    sourceId,
    selectedDealerId,
    selectedBankVaId,
    rows,
    referenceNo,
    commissionValue,
    commissionType,
    bankChargeAmount,
  ]);

  /* =========================
     Submit voucher (create only, status = Pending)
  ========================= */
  async function submitVoucher() {
    if (!selectedBankVaId) return toast.error("Select a Bank account (Debit).");
    if (isPartyDealer && !selectedDealerId)
      return toast.error("Please select a Dealer / Customer from the search.");
    if (!modeId) return toast.error("Select Mode.");
    if (modeRequiresReference && !referenceNo)
      return toast.error("Selected mode requires a reference number.");
    if (rows.length === 0) return toast.error("Add at least one credit line.");
    if (rows.some((r) => !r.voucherAccountId || !r.amount || r.amount <= 0))
      return toast.error("Each row must have a ledger and amount > 0.");
    if (commissionAmount > 0 && !commissionVaId)
      return toast.error(
        "Select ledger for Commission (system auto-select failed).",
      );
    if (bankCharge > 0 && !bankChargeVaId)
      return toast.error(
        "Select ledger for Bank Charge (system auto-select failed).",
      );
    if (netBankDebit <= 0)
      return toast.error(
        "Net amount to bank must be positive after commission and bank charge.",
      );

    const bankVa = voucherAccountsMap.get(selectedBankVaId);
    if (!bankVa || !bankVa.accountId)
      return toast.error("Selected bank not mapped to an account.");

    // Build lines
    const lines = [];

    // Bank debit (net)
    lines.push({
      accountId: bankVa.accountId,
      debit: Number(netBankDebit),
      credit: 0,
      narration: `Bank receive ${referenceNo ? `(${referenceNo})` : ""}`.trim(),
    });

    // Commission
    if (commissionAmount > 0) {
      const commVa = voucherAccountsMap.get(commissionVaId);
      if (!commVa || !commVa.accountId)
        return toast.error("Commission ledger is not mapped to an account.");
      lines.push({
        accountId: commVa.accountId,
        debit: Number(commissionAmount),
        credit: 0,
        narration: `Commission for ${selectedInvoice?.invoiceNo ?? "payment"}`,
      });
    }

    // Bank charge
    if (bankCharge > 0) {
      const bcVa = voucherAccountsMap.get(bankChargeVaId);
      if (!bcVa || !bcVa.accountId)
        return toast.error("Bank Charge ledger is not mapped to an account.");
      lines.push({
        accountId: bcVa.accountId,
        debit: Number(bankCharge),
        credit: 0,
        narration: `Bank charge for ${selectedInvoice?.invoiceNo ?? "payment"}`,
      });
    }

    // Credit lines
    const creditLines = rows.map((r) => {
      const va = voucherAccountsMap.get(r.voucherAccountId);
      return {
        accountId: va.accountId,
        debit: 0,
        credit: Number(r.amount),
        narration: r.narration || "",
      };
    });
    lines.push(...creditLines);

    // Balanced validation
    const dr = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
    const cr = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
    if (Math.abs(dr - cr) > 0.005)
      return toast.error("Voucher is not balanced.");

    // 🔥 IMPORTANT FIX HERE
    const source = selectedDealerId || sourceId;

    const sourceModel = selectedDealerId ? "Dealer" : "VoucherParty"; // <-- REQUIRED for backend refPath

    const payload = {
      voucherNo,
      date,
      reference: referenceNo || undefined,
      source, // <-- changed field name: source
      sourceModel, // ✅ ADDED
      mode: modeId, // <-- changed field name: mode
      dealerId: selectedDealerId || undefined,
      invoiceId: selectedInvoiceId || undefined,
      narration: voucherNarration || undefined,
      lines,
      status: "Pending",
      bankVaId: selectedBankVaId,
      type: "BankReceive",
    };

    try {
      setSaving(true);
      const res = await api.post("/vouchers", {
        ...payload,
        createdBy: undefined,
      });
      const created = res?.data?.data ?? res?.data ?? null;
      toast.success("Submitted for approval");

      // Refresh voucher-accounts quickly (so auto-created VAs show up)
      try {
        const vasRes = await api
          .get("/voucher-accounts")
          .catch(() => ({ data: [] }));
        const vasRaw = (vasRes?.data?.data ?? vasRes?.data ?? []) || [];
        const vas = vasRaw.map((v) => {
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
            voucherTypes: v.allowedVoucherTypes || v.voucherTypes || [],
            isActive: v.isActive !== false,
            description: v.description,
          };
        });
        setVoucherAccounts(vas);
      } catch {
        /* ignore refresh error */
      }

      // Reset form for next voucher
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
      setSelectedDealerId("");
      setDealerQuery("");
      setDealerAccount(null);
      setDealerVoucherAccount(null);
      setInvoiceOptions([]);
      setSelectedInvoiceId("");
      setSelectedInvoice(null);
      setCommissionValue(0);
      setCommissionType("percent");
      setBankChargeAmount(0);

      return created;
    } catch (err) {
      console.error("submitVoucher error", err);
      toast.error(err?.response?.data?.message || "Failed to save voucher.");
      throw err;
    } finally {
      setSaving(false);
    }
  }

  /* =========================
     Render UI
  ========================= */
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <Toaster position="top-right" richColors />

      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Bank Receive Voucher</h1>
          <p className="text-sm text-slate-500 mt-1">
            Receive money into bank — accounting-driven flow.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-sm text-slate-700 text-right mr-4 hidden sm:block">
            <div>
              Gross: <strong>{formatMoney(totalCredits)}</strong>
            </div>
            <div>
              Commission: <strong>{formatMoney(commissionAmount)}</strong>
            </div>
            <div>
              Bank Charge: <strong>{formatMoney(bankCharge)}</strong>
            </div>
            <div>
              Net: <strong>{formatMoney(netBankDebit)}</strong>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={submitVoucher}
              disabled={!isBalanced || saving}
              aria-disabled={!isBalanced || saving}
            >
              {saving ? "Saving..." : "Submit (Send for Approval)"}
            </Button>
          </div>
        </div>
      </div>

      {/* Top meta */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <Label>Voucher No</Label>
          <div className="flex gap-2 items-center">
            <Input
              value={voucherNo}
              onChange={(e) => setVoucherNo(e.target.value)}
            />
            <Button variant="ghost" size="sm" onClick={copyVoucherNo}>
              Copy
            </Button>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Auto-generated if blank.
          </p>
        </Card>

        <Card className="p-4">
          <Label>Date</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Card>

        <Card className="p-4">
          <Label>Source</Label>
          <Select
            value={sourceId}
            onValueChange={(v) => setSourceId(String(v || ""))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select Source" />
            </SelectTrigger>
            <SelectContent>
              {voucherParties
                .filter(
                  (p) => p.direction === "Receive" && p.isActive !== false,
                )
                .map((p) => (
                  <SelectItem key={p._id} value={p._id || ""}>
                    {p.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <div className="mt-2 text-xs text-slate-500">
            {isDealerMode ? (
              "Dealer/Customer selected — you can search & attach invoice below."
            ) : (
              <>
                OR select a <strong>Dealer / Customer</strong> below to tie to
                an invoice.
              </>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <Label>Mode</Label>
          <Select
            value={modeId}
            onValueChange={(v) => setModeId(String(v || ""))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select Mode" />
            </SelectTrigger>
            <SelectContent>
              {paymentModes
                .filter((m) => m.isActive !== false)
                .map((m) => (
                  <SelectItem key={m._id} value={m._id || ""}>
                    {m.name}
                    {m.requiresReference ? " (ref)" : ""}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {modeRequiresReference && !referenceNo && (
            <div className="text-xs text-rose-600 mt-2">
              Selected mode requires a reference number.
            </div>
          )}
        </Card>
      </div>

      {/* Dealer / Invoice (if dealer mode) */}
      {isDealerMode && (
        <>
          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Search Dealer / Customer</Label>
                <Input
                  placeholder="Type name or code (min 2 chars)"
                  value={dealerQuery}
                  onChange={(e) => setDealerQuery(e.target.value)}
                />
                <div className="mt-2">
                  {dealerOptions.slice(0, 8).map((d) => (
                    <button
                      key={d._id}
                      className={`block text-left w-full p-2 rounded hover:bg-slate-50 ${selectedDealerId === d._id ? "bg-slate-100" : ""}`}
                      onClick={() => onSelectDealer(d)}
                    >
                      <div className="text-sm font-medium">{d.name}</div>
                      <div className="text-xs text-slate-400">
                        {d.code ? `${d.code}` : ""}{" "}
                        {d.phoneNumber ? `• ${d.phoneNumber}` : ""}
                      </div>
                    </button>
                  ))}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  {dealerAccount ? (
                    <div>
                      Dealer ledger:{" "}
                      <strong>
                        {dealerAccount.name}
                        {dealerAccount.code ? ` (${dealerAccount.code})` : ""}
                      </strong>
                    </div>
                  ) : (
                    <div>
                      No ledger linked yet — system will auto-create if needed
                      when you proceed.
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label>Invoices for selected Dealer</Label>
                <Select
                  value={selectedInvoiceId}
                  onValueChange={(v) => setSelectedInvoiceId(String(v || ""))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Invoice (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {invoiceOptions.map((inv) => (
                      <SelectItem key={inv._id} value={inv._id || ""}>
                        {inv.invoiceNo} —{" "}
                        {formatMoney(inv.balanceAmount ?? inv.grandTotal)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="mt-2 text-xs text-slate-400">
                  Selecting an invoice will prefill a credit line (editable). If
                  dealer ledger exists it'll be selected automatically.
                </div>
              </div>

              <div>
                <Label>Selected Invoice</Label>
                <div className="mt-2">
                  {selectedInvoice ? (
                    <div>
                      <div className="font-medium">
                        {selectedInvoice.invoiceNo}
                      </div>
                      <div className="text-xs text-slate-500">
                        Grand: {formatMoney(selectedInvoice.grandTotal)} •
                        Balance: {formatMoney(selectedInvoice.balanceAmount)}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400">
                      No invoice selected
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>Commission Type</Label>
                <Select
                  value={commissionType}
                  onValueChange={(v) =>
                    setCommissionType(v === "percent" ? "percent" : "fixed")
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Commission Value</Label>
                <Input
                  type="number"
                  min="0"
                  value={commissionValue || ""}
                  onChange={(e) =>
                    setCommissionValue(Number(e.target.value || 0))
                  }
                />
                <div className="text-xs text-slate-400 mt-1">
                  If percent is selected, this is percentage of gross credits.
                </div>
              </div>

              <div>
                <Label>Commission Ledger (auto)</Label>
                <div className="mt-2 text-sm">
                  {commissionVaId ? (
                    <span className="font-medium">
                      Auto-selected:{" "}
                      {vaLabel(voucherAccountsMap.get(commissionVaId))}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">
                      Auto-creating/locating...
                    </span>
                  )}
                </div>
              </div>

              <div>
                <Label>Bank Charge Amount</Label>
                <Input
                  type="number"
                  min="0"
                  value={bankChargeAmount || ""}
                  onChange={(e) =>
                    setBankChargeAmount(Number(e.target.value || 0))
                  }
                />
                <div className="mt-2">
                  <Label className="text-xs">Bank Charge Ledger (auto)</Label>
                  <div className="mt-2 text-sm">
                    {bankChargeVaId ? (
                      <span className="font-medium">
                        Auto-selected:{" "}
                        {vaLabel(voucherAccountsMap.get(bankChargeVaId))}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">
                        Auto-creating/locating...
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-3 text-xs text-slate-500">
              Tip: Commission and Bank Charge ledgers are auto-created &
              selected so you don't need to pick them manually.
            </div>
          </Card>
        </>
      )}

      {/* Bank & balances */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <Label>Bank Account (Debit)</Label>
          <Select
            value={selectedBankVaId}
            onValueChange={(v) => setSelectedBankVaId(String(v || ""))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select Bank" />
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
                    : b.name
                      ? ""
                      : ` (${b._id})`);
                return (
                  <SelectItem key={b._id} value={b._id || ""}>
                    {label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-400 mt-2">
            Only voucher accounts with role = <code>Bank</code> are shown.
          </p>
        </Card>

        <Card className="p-4">
          <Label>Opening Balance</Label>
          <div className="mt-2 font-semibold text-slate-700">
            {formatMoney(bankOpeningBalance)}
          </div>
        </Card>

        <Card className="p-4">
          <Label>Projected Closing Balance</Label>
          <div className="mt-2 font-semibold text-emerald-600">
            {formatMoney(closingBankBalance)}
          </div>
        </Card>
      </div>

      {/* Credit lines */}
      <Card className="p-0 overflow-hidden">
        <div className="sticky top-0 bg-white z-10 p-3 border-b flex justify-between">
          <div className="text-sm font-medium">Credit Lines</div>
          <div className="text-xs text-slate-500">
            Tip: press Enter in the last amount to add a new row
          </div>
        </div>

        <table className="w-full">
          <thead className="bg-slate-100 text-sm">
            <tr>
              <th className="px-4 py-3 text-left">Ledger (Credit)</th>
              <th className="px-4 py-3 text-left">Line Narration</th>
              <th className="px-4 py-3 text-right w-48">Amount</th>
              <th className="px-4 py-3 w-12"></th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, idx) => {
              const va = voucherAccountsMap.get(row.voucherAccountId);
              const mapped = va?.accountId
                ? accountsMap.get(String(va.accountId))
                : undefined;
              return (
                <tr key={row.id} className="border-t hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Select
                      value={row.voucherAccountId}
                      onValueChange={(v) =>
                        updateRow(row.id, "voucherAccountId", v)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select Ledger" />
                      </SelectTrigger>
                      <SelectContent>
                        {ledgerOptions.map((l) => {
                          const m = l.accountId
                            ? accountsMap.get(String(l.accountId))
                            : undefined;
                          const label =
                            (l.name || (m ? m.name : l._id)) +
                            (m && l.name ? ` → ${m.name}` : "");
                          return (
                            <SelectItem key={l._id} value={l._id || ""}>
                              {label}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <div className="mt-1 text-xs text-slate-400">
                      {va
                        ? va.accountId
                          ? `Mapped to: ${mapped?.name ?? "(not found)"}`
                          : "Not mapped to COA"
                        : "Select voucher account allowed for BankReceive"}
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
                        Delete
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
                {formatMoney(totalCredits)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </Card>

      <div className="flex gap-2 items-center">
        <Button onClick={addRow}>+ Add Line</Button>
        <div className="flex-1" />
        <div className="text-sm text-slate-600">
          Status:{" "}
          {isBalanced ? (
            <Badge variant="outline">Balanced</Badge>
          ) : (
            <Badge variant="destructive">Not balanced / missing info</Badge>
          )}
        </div>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Reference No</Label>
            <Input
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
            />
            {modeRequiresReference && !referenceNo && (
              <div className="text-xs text-rose-600 mt-1">
                This mode requires a reference.
              </div>
            )}
          </div>

          <div>
            <Label>Voucher Narration</Label>
            <Textarea
              rows={3}
              value={voucherNarration}
              onChange={(e) => setVoucherNarration(e.target.value)}
            />
          </div>
        </div>
      </Card>

      <Separator />
      <div className="text-xs text-slate-500">
        Tip: Commission & Bank Charge are auto-created & selected for you.
      </div>
    </div>
  );
}
