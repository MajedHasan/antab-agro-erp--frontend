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
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

/**
 * Cash Receive Voucher Page — Rewritten, optimized, ready-to-copy.
 *
 * Key improvements:
 * - Single initial load (accounts tree, voucher-accounts, parties, modes)
 * - Masters cached in refs to avoid repeated GETs / rate limits
 * - No `await` inside non-async funcs / useMemo etc.
 * - Sales Discount supports Fixed / Percentage (UI + calculations)
 * - Auto-ensure of Sales Discount ledger and Cash In Hand (idempotent)
 * - SelectItem values never empty strings
 * - Cleaner, smaller, easier-to-read code while preserving all features
 */

/* -----------------------
   helpers
----------------------- */
const formatMoney = (n = 0) => `₹ ${Number(n || 0).toFixed(2)}`;

const flattenTree = (accounts: any[] = []) => {
  const out: any[] = [];
  const walk = (n: any) => {
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

/* -----------------------
   component
----------------------- */
export default function CashReceiveVoucherPage() {
  /* ---------- Voucher meta ---------- */
  const [voucherNo, setVoucherNo] = useState(() => `CR-${Date.now()}`);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sourceId, setSourceId] = useState("");
  const [modeId, setModeId] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [selectedCashVaId, setSelectedCashVaId] = useState("");
  const [voucherNarration, setVoucherNarration] = useState("");

  /* rows */
  const [rows, setRows] = useState(() => [
    { id: crypto.randomUUID(), voucherAccountId: "", amount: 0, narration: "" },
  ]);

  /* ---------- Masters & caches ---------- */
  const [accountsTree, setAccountsTree] = useState<any[]>([]);
  const [flatAccounts, setFlatAccounts] = useState<any[]>([]);
  const [voucherParties, setVoucherParties] = useState<any[]>([]);
  const [paymentModes, setPaymentModes] = useState<any[]>([]);
  const [voucherAccounts, setVoucherAccounts] = useState<any[]>([]);

  // refs for cached masters (prevents repeated re-fetch)
  const flatAccountsRef = useRef<any[]>([]);
  const voucherAccountsRef = useRef<any[]>([]);
  const voucherPartiesRef = useRef<any[]>([]);
  const paymentModesRef = useRef<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  /* dealer search */
  const dealerSearchTimer = useRef<number | null>(null);
  const [dealerQuery, setDealerQuery] = useState("");
  const [dealerOptions, setDealerOptions] = useState<any[]>([]);
  const [selectedDealerId, setSelectedDealerId] = useState("");
  const [dealerAccount, setDealerAccount] = useState<any>(null);
  const [dealerVoucherAccount, setDealerVoucherAccount] = useState<any>(null);

  const [invoiceOptions, setInvoiceOptions] = useState<any[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  /* Sales Discount: type + value */
  const [salesDiscountType, setSalesDiscountType] = useState<
    "fixed" | "percentage"
  >("fixed");
  const [salesDiscountAmount, setSalesDiscountAmount] = useState(0);
  const [salesDiscountVaId, setSalesDiscountVaId] = useState("");

  /* -----------------------
     Derived maps & lists
  ----------------------- */
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

  /* detect cash VAs without async work in useMemo */
  const cashVas = useMemo(() => {
    return voucherAccounts.filter((v) => {
      if (!v) return false;
      if (v.role === "Cash") return true;
      const vaName = String(v.name || "").toLowerCase();
      if (vaName.includes("cash")) return true;
      const accId =
        v.accountId && typeof v.accountId === "object"
          ? v.accountId._id
          : v.accountId;
      if (!accId) return false;
      const acc = accountsMap.get(String(accId));
      if (!acc) return false;
      const accName = String(acc.name || "").toLowerCase();
      const accCode = String(acc.code || "").toLowerCase();
      return accName.includes("cash") || accCode.includes("cash");
    });
  }, [voucherAccounts, accountsMap]);

  const ledgerOptions = useMemo(() => {
    return voucherAccounts.filter((va) => {
      if (va.isActive === false) return false;
      if (va.role === "Cash") return false; // exclude cash VAs from credit ledgers
      if (!va.voucherTypes || va.voucherTypes.length === 0) return true;
      return (
        va.voucherTypes.includes("CashReceive") ||
        va.voucherTypes.includes("All") ||
        va.voucherTypes.includes("BankReceive")
      );
    });
  }, [voucherAccounts]);

  const totalCredits = useMemo(
    () => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    [rows],
  );

  const salesDiscountCalculated = useMemo(() => {
    if (salesDiscountType === "percentage") {
      return (
        (Number(totalCredits || 0) * Number(salesDiscountAmount || 0)) / 100
      );
    }
    return Number(salesDiscountAmount || 0);
  }, [salesDiscountAmount, salesDiscountType, totalCredits]);

  const salesDiscount = salesDiscountCalculated;

  const cashOpeningBalance = useMemo(() => {
    const cash = cashVas.find((b) => b._id === selectedCashVaId);
    if (!cash || !cash.accountId) return 0;
    const acc = accountsMap.get(String(cash.accountId));
    return (
      Number(acc?.openingBalance ?? 0) +
      Number(acc?.periodDebit ?? 0) -
      Number(acc?.periodCredit ?? 0)
    );
  }, [selectedCashVaId, cashVas, accountsMap]);

  const netCashDebit = useMemo(() => {
    const val = Number(totalCredits || 0) - Number(salesDiscount || 0);
    return Number.isFinite(val) ? val : 0;
  }, [totalCredits, salesDiscount]);

  const closingCashBalance = useMemo(
    () => cashOpeningBalance + netCashDebit,
    [cashOpeningBalance, netCashDebit],
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
    !!selectedCashVaId &&
    !!modeId &&
    (!modeRequiresReference || !!referenceNo) &&
    netCashDebit > 0 &&
    (salesDiscount === 0 || !!salesDiscountVaId) &&
    (!isPartyDealer || !!selectedDealerId);

  /* small label helper */
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
     API helpers (with caching)
  ========================= */

  const ensureAccountExistsViaAPI = useCallback(
    async (name: string, type = "Expense") => {
      try {
        const qRes = await api
          .get(`/accounts?q=${encodeURIComponent(name)}&limit=5`)
          .catch(() => ({ data: [] }));
        const matches = qRes?.data?.data ?? qRes?.data ?? [];
        const exact = matches.find(
          (m: any) => (m.name || "").toLowerCase() === name.toLowerCase(),
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

  const addOrUpdateVoucherAccountInCache = useCallback((raw: any) => {
    if (!raw || !raw._id) return null;
    const accountObj =
      raw?.accountId && typeof raw.accountId === "object"
        ? raw.accountId
        : null;
    const normalized = {
      ...raw,
      _id: raw._id,
      name:
        (raw?.name && String(raw.name).trim()) ||
        (accountObj ? accountObj.name : String(raw._id)),
      accountId: accountObj ? accountObj._id : raw?.accountId || null,
      role: raw.role,
      voucherTypes: raw.allowedVoucherTypes || raw.voucherTypes || [],
      isActive: raw.isActive !== false,
      description: raw.description,
    };

    const idx = voucherAccountsRef.current.findIndex(
      (v) => String(v._id) === String(normalized._id),
    );
    if (idx >= 0) voucherAccountsRef.current[idx] = normalized;
    else voucherAccountsRef.current.push(normalized);
    setVoucherAccounts([...voucherAccountsRef.current]);
    return normalized;
  }, []);

  const ensureVoucherAccountExistsForAccount_cached = useCallback(
    async (
      account: any,
      desiredName: string,
      voucherTypes: string[] = ["CashReceive", "All"],
      role: "Bank" | "Cash" | "Ledger" = "Ledger",
    ) => {
      try {
        const list = voucherAccountsRef.current || [];
        let existing = null;
        if (account && account._id) {
          existing = list.find(
            (v: any) =>
              String(v?.accountId || v?.accountId?._id) === String(account._id),
          );
        }
        if (!existing) {
          existing =
            list.find(
              (v: any) =>
                (v.name || "") === desiredName ||
                (v.accountId &&
                  typeof v.accountId === "object" &&
                  v.accountId.name === desiredName),
            ) ?? null;
        }
        if (existing) {
          return addOrUpdateVoucherAccountInCache(existing) || existing;
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
          role,
          accountId: account._id,
          voucherTypes,
          isActive: true,
        });
        const created = createRes?.data?.data ?? createRes?.data ?? null;
        if (!created) return null;
        return addOrUpdateVoucherAccountInCache(created);
      } catch (err) {
        console.error(
          "ensureVoucherAccountExistsForAccount_cached error:",
          err,
        );
        return null;
      }
    },
    [addOrUpdateVoucherAccountInCache],
  );

  /* =========================
     Idempotent ensures: Sales Discount & default Cash In Hand
     These run once during initial load.
  ========================= */

  const ensureSalesDiscountLedger = useCallback(async () => {
    try {
      const acc = await ensureAccountExistsViaAPI("Sales Discounts", "Expense");
      if (!acc || !acc._id) return null;
      const va = await ensureVoucherAccountExistsForAccount_cached(
        acc,
        "Sales Discounts",
        ["CashReceive", "All"],
        "Ledger",
      );
      if (va && va._id) {
        setSalesDiscountVaId(String(va._id));
        return va;
      }
      return null;
    } catch (err) {
      console.error("ensureSalesDiscountLedger error:", err);
      return null;
    }
  }, [ensureAccountExistsViaAPI, ensureVoucherAccountExistsForAccount_cached]);

  const ensureDefaultCashVa = useCallback(async () => {
    try {
      const existing = voucherAccountsRef.current.find((v: any) => {
        if (!v) return false;
        if (v.role === "Cash") return true;
        const vaName = String(v.name || "").toLowerCase();
        if (vaName.includes("cash")) return true;
        if (!v.accountId) return false;
        const acc = flatAccountsRef.current.find(
          (a: any) => String(a._id) === String(v.accountId),
        );
        if (!acc) return false;
        const accName = String(acc.name || "").toLowerCase();
        const accCode = String(acc.code || "").toLowerCase();
        return accName.includes("cash") || accCode.includes("cash");
      });

      if (existing && existing._id) {
        setSelectedCashVaId(String(existing._id));
        return existing;
      }

      // create COA + VA
      const acc = await ensureAccountExistsViaAPI("Cash In Hand", "Asset");
      if (!acc || !acc._id) return null;
      const createdVa = await ensureVoucherAccountExistsForAccount_cached(
        acc,
        "Cash In Hand",
        ["CashReceive", "All"],
        "Cash",
      );
      if (createdVa && createdVa._id) {
        setSelectedCashVaId(String(createdVa._id));
        return createdVa;
      }
      return null;
    } catch (err) {
      console.error("ensureDefaultCashVa error:", err);
      return null;
    }
  }, [ensureAccountExistsViaAPI, ensureVoucherAccountExistsForAccount_cached]);

  /* =========================
     initial load — only once
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
        const flat = flattenTree(tree);
        setFlatAccounts(flat);
        flatAccountsRef.current = flat;

        const vasRaw = (vasRes?.data?.data ?? vasRes?.data ?? []) || [];
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
            voucherTypes: v.allowedVoucherTypes || v.voucherTypes || [],
            isActive: v.isActive !== false,
            description: v.description,
          };
        });
        voucherAccountsRef.current = vas;
        setVoucherAccounts(vas);

        const parties =
          (partiesRes?.data?.data ?? partiesRes?.data ?? []) || [];
        voucherPartiesRef.current = parties;
        setVoucherParties(parties);

        const modes = (modesRes?.data?.data ?? modesRes?.data ?? []) || [];
        paymentModesRef.current = modes;
        setPaymentModes(modes);

        // ensures: idempotent
        await ensureSalesDiscountLedger();
        await ensureDefaultCashVa();
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
    // run once
  }, [ensureDefaultCashVa, ensureSalesDiscountLedger]);

  /* auto-select first cash VA if none selected */
  useEffect(() => {
    if (!selectedCashVaId && cashVas && cashVas.length > 0) {
      setSelectedCashVaId(String(cashVas[0]._id));
    }
  }, [cashVas, selectedCashVaId]);

  /* =========================
     dealer search (debounced)
  ========================= */
  useEffect(() => {
    if (!dealerQuery || dealerQuery.trim().length < 2) {
      setDealerOptions([]);
      return;
    }
    if (dealerSearchTimer.current)
      window.clearTimeout(dealerSearchTimer.current);
    // @ts-ignore
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
     dealer selection (idempotent, cached)
  ========================= */
  const onSelectDealer = useCallback(
    async (d: any) => {
      if (!d?._id) return;
      setSelectedDealerId(String(d._id));
      setDealerQuery(d.name || "");

      setSourceId((prev) => {
        if (prev) return prev;
        const dealerParty = voucherParties.find(
          (p) => p.direction === "Receive" && /dealer|customer/i.test(p.name),
        );
        return dealerParty?._id || prev;
      });

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
            voucherAccountsRef.current.find(
              (v) => String(v.accountId) === String(acc._id),
            ) ?? null;
          if (!va) {
            const created = await ensureVoucherAccountExistsForAccount_cached(
              acc,
              `Dealer → ${acc.name}`,
              ["CashReceive", "All"],
              "Ledger",
            );
            if (created) va = created;
          }
          if (va) setDealerVoucherAccount(va);

          // load unpaid invoices
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
    [ensureVoucherAccountExistsForAccount_cached, voucherParties],
  );

  /* when invoice selected, prefill credit row */
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

  /* row helpers */
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
    (id: string, key: string, value: any) =>
      setRows((s) => s.map((r) => (r.id === id ? { ...r, [key]: value } : r))),
    [],
  );

  /* copy voucher no */
  const copyVoucherNo = useCallback(() => {
    try {
      navigator.clipboard.writeText(voucherNo);
      toast.success("Voucher No copied");
    } catch {
      toast.error("Failed to copy");
    }
  }, [voucherNo]);

  /* keyboard submit */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && (e.key === "Enter" || e.key === "Return"))
        submitVoucher();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    modeId,
    sourceId,
    selectedDealerId,
    selectedCashVaId,
    rows,
    referenceNo,
    salesDiscountAmount,
    salesDiscountType,
  ]);

  /* submit voucher */
  async function submitVoucher() {
    if (!selectedCashVaId) return toast.error("Select a Cash ledger (Debit).");
    if (isPartyDealer && !selectedDealerId)
      return toast.error("Please select a Dealer / Customer from the search.");
    if (!modeId) return toast.error("Select Mode.");
    if (modeRequiresReference && !referenceNo)
      return toast.error("Selected mode requires a reference number.");
    if (rows.length === 0) return toast.error("Add at least one credit line.");
    if (rows.some((r) => !r.voucherAccountId || !r.amount || r.amount <= 0))
      return toast.error("Each row must have a ledger and amount > 0.");
    if (salesDiscount > 0 && !salesDiscountVaId)
      return toast.error(
        "Select ledger for Sales Discount (system auto-select failed).",
      );
    if (netCashDebit <= 0)
      return toast.error(
        "Net amount to cash must be positive after sales discount.",
      );

    const cashVa = voucherAccountsMap.get(selectedCashVaId);
    if (!cashVa || !cashVa.accountId)
      return toast.error("Selected cash account not mapped to COA.");

    // build lines
    const lines: any[] = [];

    // cash debit (net)
    lines.push({
      accountId: cashVa.accountId,
      debit: Number(netCashDebit),
      credit: 0,
      narration: `Cash receive ${referenceNo ? `(${referenceNo})` : ""}`.trim(),
    });

    // sales discount debit (if any)
    if (salesDiscount > 0) {
      const sdVa = voucherAccountsMap.get(salesDiscountVaId);
      if (!sdVa || !sdVa.accountId)
        return toast.error(
          "Sales Discount ledger is not mapped to an account.",
        );
      lines.push({
        accountId: sdVa.accountId,
        debit: Number(salesDiscount),
        credit: 0,
        narration: `Sales discount for ${selectedInvoice?.invoiceNo ?? "payment"}`,
      });
    }

    // credit lines
    const creditLines = rows.map((r) => {
      const va = voucherAccountsMap.get(r.voucherAccountId);
      return {
        accountId: va ? va.accountId : r.voucherAccountId,
        debit: 0,
        credit: Number(r.amount),
        narration: r.narration || "",
      };
    });
    lines.push(...creditLines);

    // balanced check
    const dr = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
    const cr = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
    if (Math.abs(dr - cr) > 0.005)
      return toast.error("Voucher is not balanced.");

    // source & sourceModel
    const source = selectedDealerId || sourceId || undefined;
    const sourceModel = selectedDealerId
      ? "Dealer"
      : sourceId
        ? "VoucherParty"
        : undefined;

    const payload: any = {
      voucherNo,
      date,
      reference: referenceNo || undefined,
      source,
      sourceModel,
      mode: modeId,
      dealerId: selectedDealerId || undefined,
      invoiceId: selectedInvoiceId || undefined,
      narration: voucherNarration || undefined,
      lines,
      status: "Pending",
      bankVaId: selectedCashVaId, // reuse backend field for VA id
      type: "CashReceive",
    };

    try {
      setSaving(true);
      const res = await api.post("/vouchers", {
        ...payload,
        createdBy: undefined,
      });
      const created = res?.data?.data ?? res?.data ?? null;
      toast.success("Submitted for approval");

      // if backend returned any new VAs inline, add to cache (rare)
      try {
        const newVas = (res?.data?.voucherAccounts ?? []) as any[];
        if (newVas && newVas.length) {
          newVas.forEach((nv) => addOrUpdateVoucherAccountInCache(nv));
        }
      } catch {
        /* ignore */
      }

      // reset form
      setVoucherNo(`CR-${Date.now()}`);
      setDate(new Date().toISOString().slice(0, 10));
      setSourceId("");
      setModeId("");
      setReferenceNo("");
      setSelectedCashVaId("");
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
      setSalesDiscountAmount(0);
      setSalesDiscountType("fixed");

      return created;
    } catch (err: any) {
      console.error("submitVoucher error", err);
      toast.error(err?.response?.data?.message || "Failed to save voucher.");
      throw err;
    } finally {
      setSaving(false);
    }
  }

  /* =========================
     UI
  ========================= */
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <Toaster position="top-right" richColors />

      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Cash Receive Voucher</h1>
          <p className="text-sm text-slate-500 mt-1">
            Receive cash into cash-in-hand — accounting-driven flow.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-sm text-slate-700 text-right mr-4 hidden sm:block">
            <div>
              Gross: <strong>{formatMoney(totalCredits)}</strong>
            </div>
            <div>
              Sales Discount: <strong>{formatMoney(salesDiscount)}</strong>
            </div>
            <div>
              Net: <strong>{formatMoney(netCashDebit)}</strong>
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

      {/* top meta */}
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
            value={sourceId || undefined}
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
                  <SelectItem key={String(p._id)} value={String(p._id)}>
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
            value={modeId || undefined}
            onValueChange={(v) => setModeId(String(v || ""))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select Mode" />
            </SelectTrigger>
            <SelectContent>
              {paymentModes
                .filter((m) => m.isActive !== false)
                .map((m) => (
                  <SelectItem key={String(m._id)} value={String(m._id)}>
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

      {/* Dealer / Invoice */}
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
                        {d.code ?? ""}{" "}
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
                  value={selectedInvoiceId || undefined}
                  onValueChange={(v) => setSelectedInvoiceId(String(v || ""))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Invoice (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {invoiceOptions.map((inv) => (
                      <SelectItem key={String(inv._id)} value={String(inv._id)}>
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
                <Label>Discount Type</Label>
                <Select
                  value={salesDiscountType}
                  onValueChange={(v) =>
                    setSalesDiscountType(v as "fixed" | "percentage")
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>
                  {salesDiscountType === "percentage"
                    ? "Discount Percentage (%)"
                    : "Discount Amount"}
                </Label>
                <Input
                  type="number"
                  min="0"
                  max={salesDiscountType === "percentage" ? 100 : undefined}
                  value={salesDiscountAmount || ""}
                  onChange={(e) =>
                    setSalesDiscountAmount(Number(e.target.value || 0))
                  }
                />
                <div className="text-xs text-slate-400 mt-1">
                  {salesDiscountType === "percentage"
                    ? `Auto-calculated: ${formatMoney(salesDiscountCalculated)}`
                    : "Fixed discount amount"}
                </div>
              </div>

              <div className="col-span-2">
                <Label>Sales Discount Ledger (auto)</Label>
                <div className="mt-2 text-sm">
                  {salesDiscountVaId ? (
                    <span className="font-medium">
                      {vaLabel(voucherAccountsMap.get(salesDiscountVaId))}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">
                      Auto-creating/locating...
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 mt-2">
                  Sales Discount is auto-created as an Expense ledger named
                  "Sales Discounts".
                </div>
              </div>
            </div>
          </Card>
        </>
      )}

      {/* Cash & balances */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <Label>Cash In Hand (Debit)</Label>
          <Select
            value={selectedCashVaId || undefined}
            onValueChange={(v) => setSelectedCashVaId(String(v || ""))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select Cash Ledger" />
            </SelectTrigger>
            <SelectContent>
              {cashVas.length === 0 ? (
                <div className="p-2 text-xs text-slate-400">
                  No Cash ledger found
                </div>
              ) : (
                cashVas.map((b: any) => {
                  const mappedAcc = b.accountId
                    ? accountsMap.get(String(b.accountId))
                    : undefined;
                  const label =
                    (b.name || "") +
                    (mappedAcc
                      ? ` → ${mappedAcc.name}${mappedAcc.code ? ` (${mappedAcc.code})` : ""}`
                      : "");
                  return (
                    <SelectItem key={String(b._id)} value={String(b._id)}>
                      {label}
                    </SelectItem>
                  );
                })
              )}
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-400 mt-2">
            Only voucher accounts that look like Cash are shown. If none exist
            one will be created automatically.
          </p>
        </Card>

        <Card className="p-4">
          <Label>Opening Balance</Label>
          <div className="mt-2 font-semibold text-slate-700">
            {formatMoney(cashOpeningBalance)}
          </div>
        </Card>

        <Card className="p-4">
          <Label>Projected Closing Balance</Label>
          <div className="mt-2 font-semibold text-emerald-600">
            {formatMoney(closingCashBalance)}
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
                      value={row.voucherAccountId || undefined}
                      onValueChange={(v) =>
                        updateRow(row.id, "voucherAccountId", String(v || ""))
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
                            <SelectItem
                              key={String(l._id)}
                              value={String(l._id)}
                            >
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
                        : "Select voucher account allowed for CashReceive"}
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
        Tip: Sales Discount ledger is auto-created & selected for you. Cash In
        Hand will be created if missing. Masters are cached to avoid repeated
        API calls and rate limits.
      </div>
    </div>
  );
}
