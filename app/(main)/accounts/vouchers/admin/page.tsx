"use client";

import React, { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { Toaster, toast } from "sonner";

/* shadcn UI */
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

/* -------------------------
   Types
   ------------------------- */
type Account = {
  _id: string;
  name: string;
  code?: string;
  children?: Account[];
  path?: string;
};
type VoucherParty = {
  _id?: string;
  name: string;
  direction: "Receive" | "Payment";
  voucherTypes: string[];
  isActive?: boolean;
};
type PaymentMode = {
  _id?: string;
  name: string;
  voucherTypes: string[];
  requiresReference?: boolean;
  isActive?: boolean;
};
type VoucherAccount = {
  _id?: string;
  name?: string;
  role?: "Bank" | "Cash" | "Ledger";
  kind?: "bank" | "cash" | "other";
  accountId?: string | { _id: string; name?: string; code?: string } | null;
  allowedVoucherTypes?: string[];
  voucherTypes?: string[]; // support older shape
  isActive?: boolean;
  raw?: any;
};
type JournalType = { _id?: string; name: string; isActive?: boolean };

/* -------------------------
   Constants & Helpers
   ------------------------- */
const ALL_VOUCHER_TYPES = [
  "BankReceive",
  "CashReceive",
  "CashPayment",
  "BankPayment",
  "Journal",
  "Contra",
  "All",
];

function roleToKind(role?: string) {
  if (!role) return "other";
  if (role.toLowerCase() === "bank") return "bank";
  if (role.toLowerCase() === "cash") return "cash";
  return "other";
}
function kindToRole(kind: string) {
  if (kind === "bank") return "Bank";
  if (kind === "cash") return "Cash";
  return "Ledger";
}

function safeAccountLabel(a: any) {
  if (!a) return "(none)";
  if (typeof a === "string") return a;
  const name = a.name ?? a.label ?? "(account)";
  const code = a.code ? ` (${a.code})` : "";
  return `${name}${code}`;
}
function uniqueStrings(arr?: string[]) {
  if (!arr) return [];
  return Array.from(new Set(arr.map(String)));
}

/* -------------------------
   Small UI primitives
   ------------------------- */
function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-800">
      {children}
    </span>
  );
}
function Empty({ children }: { children?: React.ReactNode }) {
  return (
    <div className="py-8 text-center text-sm text-slate-500">{children}</div>
  );
}

/* -------------------------
   Shared form hook (reduces duplication)
   ------------------------- */
function useAdminForm<T extends Record<string, any>>(opts: {
  defaultValues: T;
  onSubmit: (values: T) => Promise<void>;
}) {
  const { defaultValues, onSubmit } = opts;
  const [values, setValues] = useState<T>(defaultValues);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValues(defaultValues);
  }, [JSON.stringify(defaultValues)]);

  function setValue<K extends keyof T>(key: K, val: T[K]) {
    setValues((s) => ({ ...s, [key]: val }));
  }

  async function submit() {
    try {
      setSaving(true);
      await onSubmit(values);
    } catch (err: any) {
      throw err;
    } finally {
      setSaving(false);
    }
  }

  return { values, setValue, submit, saving, setValues };
}

/* -------------------------
   TagMultiSelect (compact tag UI)
   ------------------------- */
function TagMultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select types",
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ?? [];

  function toggle(opt: string) {
    if (selected.includes(opt)) onChange(selected.filter((x) => x !== opt));
    else onChange([...selected, opt]);
  }

  return (
    <div className="relative">
      <div
        className="min-h-[44px] w-full border rounded px-3 py-2 flex gap-2 items-center cursor-pointer"
        onClick={() => setOpen((s) => !s)}
        role="button"
        tabIndex={0}
      >
        <div className="flex gap-2 flex-wrap">
          {selected.length === 0 ? (
            <span className="text-sm text-slate-400">{placeholder}</span>
          ) : (
            selected.map((s) => <Badge key={s}>{s}</Badge>)
          )}
        </div>
        <div className="ml-auto text-xs text-slate-400">
          {selected.length}/{options.length}
        </div>
      </div>

      {open && (
        <div className="absolute z-30 mt-2 w-full max-h-60 overflow-auto bg-white border rounded shadow p-2">
          {options.map((o) => (
            <label
              key={o}
              className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer"
            >
              <Checkbox
                checked={selected.includes(o)}
                onCheckedChange={() => toggle(o)}
              />
              <div className="text-sm">{o}</div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------
   SearchableAccountSelect
   - simple client-side combobox (no external lib)
   - good for large lists (1000s) because it filters client-side
   ------------------------- */
function SearchableAccountSelect({
  accounts,
  value,
  onChange,
  placeholder = "Search and select account...",
}: {
  accounts: Account[];
  value?: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) =>
      (a.path ?? a.name ?? "").toLowerCase().includes(q),
    );
  }, [accounts, query]);

  const current = useMemo(
    () => accounts.find((a) => a._id === value) ?? null,
    [accounts, value],
  );

  return (
    <div className="relative">
      <div className="flex gap-2">
        <input
          className="w-full border rounded px-3 py-2"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        <button
          type="button"
          className="border rounded px-3 py-2 bg-white"
          onClick={() => {
            setQuery("");
            onChange("");
            setOpen(false);
          }}
          title="Clear"
        >
          Clear
        </button>
      </div>

      <div className="mt-1 text-xs text-slate-600">
        {current ? (
          `${current.path ?? current.name}${current.code ? ` (${current.code})` : ""}`
        ) : (
          <span className="text-slate-400">Not mapped</span>
        )}
      </div>

      {open && (
        <div className="absolute z-40 mt-2 w-full max-h-72 overflow-auto bg-white border rounded shadow p-1">
          {filtered.length === 0 ? (
            <div className="p-2 text-sm text-slate-500">No accounts match.</div>
          ) : (
            filtered.map((a) => (
              <div
                key={a._id}
                className="p-2 hover:bg-slate-50 rounded cursor-pointer flex justify-between items-center"
                onClick={() => {
                  onChange(a._id);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <div className="text-sm">{a.path ?? a.name}</div>
                {a.code && (
                  <div className="text-xs text-slate-400">{a.code}</div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------
   Admin Drawer (Dialog styled as right-side sheet)
   ------------------------- */
function AdminDrawer({
  open,
  onOpenChange,
  title,
  children,
  footer,
  width = 540,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="m-0 h-screen max-w-none bg-transparent">
        {/* Right-side panel */}
        <div className="fixed right-0 top-0 h-full" style={{ width }}>
          <div className="h-full bg-white border-l shadow-xl flex flex-col">
            <div className="p-4 border-b">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold">
                  {title}
                </DialogTitle>
              </DialogHeader>
            </div>

            <div className="p-4 overflow-auto flex-1">{children}</div>

            <div className="p-4 border-t">
              <div className="flex justify-end gap-2 items-center">
                {footer}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------
   Forms (use the shared hook)
   ------------------------- */

function PartyForm({
  payload,
  onCancel,
  onSave,
}: {
  payload: Partial<VoucherParty> | null;
  onCancel: () => void;
  onSave: (p: any) => Promise<void>;
}) {
  const { values, setValue, submit, saving } = useAdminForm({
    defaultValues: {
      name: payload?.name ?? "",
      direction: payload?.direction ?? "Receive",
      voucherTypes: uniqueStrings(payload?.voucherTypes ?? ["BankReceive"]),
      isActive: payload?.isActive ?? true,
    },
    onSubmit: async (vals) => {
      if (!vals.name.trim()) throw new Error("Name is required");
      await onSave({ ...payload, ...vals, voucherTypes: vals.voucherTypes });
    },
  });

  return (
    <>
      <div className="space-y-4">
        <div>
          <Label>Name</Label>
          <Input
            value={values.name}
            onChange={(e) => setValue("name", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Direction</Label>
            <select
              className="w-full border rounded px-3 py-2"
              value={values.direction}
              onChange={(e) => setValue("direction", e.target.value as any)}
            >
              <option value="Receive">Receive</option>
              <option value="Payment">Payment</option>
            </select>
          </div>

          <div>
            <Label>Active</Label>
            <select
              className="w-full border rounded px-3 py-2"
              value={values.isActive ? "1" : "0"}
              onChange={(e) => setValue("isActive", e.target.value === "1")}
            >
              <option value="1">Yes</option>
              <option value="0">No</option>
            </select>
          </div>
        </div>

        <div>
          <Label>Voucher Types</Label>
          <TagMultiSelect
            options={ALL_VOUCHER_TYPES}
            value={values.voucherTypes}
            onChange={(v) => setValue("voucherTypes", v)}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button onClick={submit} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </>
  );
}

function ModeForm({
  payload,
  onCancel,
  onSave,
}: {
  payload: Partial<PaymentMode> | null;
  onCancel: () => void;
  onSave: (p: any) => Promise<void>;
}) {
  const { values, setValue, submit, saving } = useAdminForm({
    defaultValues: {
      name: payload?.name ?? "",
      requiresReference: payload?.requiresReference ?? false,
      voucherTypes: uniqueStrings(payload?.voucherTypes ?? ["BankReceive"]),
      isActive: payload?.isActive ?? true,
    },
    onSubmit: async (vals) => {
      if (!vals.name.trim()) throw new Error("Name is required");
      await onSave({ ...payload, ...vals, voucherTypes: vals.voucherTypes });
    },
  });

  return (
    <>
      <div className="space-y-4">
        <div>
          <Label>Name</Label>
          <Input
            value={values.name}
            onChange={(e) => setValue("name", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Requires Reference</Label>
            <select
              className="w-full border rounded px-3 py-2"
              value={values.requiresReference ? "1" : "0"}
              onChange={(e) =>
                setValue("requiresReference", e.target.value === "1")
              }
            >
              <option value="1">Yes</option>
              <option value="0">No</option>
            </select>
          </div>

          <div>
            <Label>Active</Label>
            <select
              className="w-full border rounded px-3 py-2"
              value={values.isActive ? "1" : "0"}
              onChange={(e) => setValue("isActive", e.target.value === "1")}
            >
              <option value="1">Yes</option>
              <option value="0">No</option>
            </select>
          </div>

          <div>
            <Label>Voucher Types</Label>
            <TagMultiSelect
              options={ALL_VOUCHER_TYPES}
              value={values.voucherTypes}
              onChange={(v) => setValue("voucherTypes", v)}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button onClick={submit} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </>
  );
}

function VaForm({
  payload,
  flatAccounts,
  onCancel,
  onSave,
}: {
  payload: Partial<VoucherAccount> | null;
  flatAccounts: Account[];
  onCancel: () => void;
  onSave: (p: any) => Promise<void>;
}) {
  // normalize initial values
  const initialKind = payload?.role
    ? roleToKind(payload.role)
    : (payload?.kind ?? "bank");
  const initialAccountId =
    payload?.accountId && typeof payload.accountId === "object"
      ? payload.accountId._id
      : ((payload?.accountId as any) ?? "");
  const initialTypes = uniqueStrings(
    (payload?.allowedVoucherTypes as string[]) ??
      (payload?.voucherTypes as string[]) ?? ["BankReceive"],
  );

  const { values, setValue, submit, saving } = useAdminForm({
    defaultValues: {
      kind: initialKind,
      accountId: initialAccountId,
      voucherTypes: initialTypes,
      isActive: payload?.isActive ?? true,
    },
    onSubmit: async (vals) => {
      if (!vals.voucherTypes || vals.voucherTypes.length === 0)
        throw new Error("Choose at least one voucher type");
      const out: any = {
        ...payload,
        role: kindToRole(vals.kind),
        allowedVoucherTypes: vals.voucherTypes,
        isActive: vals.isActive,
      };
      if (vals.accountId) out.accountId = vals.accountId;
      else out.accountId = undefined;
      await onSave(out);
    },
  });

  return (
    <>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Kind</Label>
            <select
              className="w-full border rounded px-3 py-2"
              value={values.kind}
              onChange={(e) => setValue("kind", e.target.value as any)}
            >
              <option value="bank">Bank</option>
              <option value="cash">Cash</option>
              <option value="other">Other / Ledger</option>
            </select>
          </div>

          <div>
            <Label>Active</Label>
            <select
              className="w-full border rounded px-3 py-2"
              value={values.isActive ? "1" : "0"}
              onChange={(e) => setValue("isActive", e.target.value === "1")}
            >
              <option value="1">Yes</option>
              <option value="0">No</option>
            </select>
          </div>
        </div>

        <div>
          <Label>Map to Chart of Account (optional)</Label>
          <SearchableAccountSelect
            accounts={flatAccounts}
            value={values.accountId}
            onChange={(v) => setValue("accountId", v || "")}
          />
          <p className="text-xs text-slate-400 mt-1">
            Mapping ensures voucher accounts are linked to the ledger
            (optional).
          </p>
        </div>

        <div>
          <Label>Allowed Voucher Types</Label>
          <TagMultiSelect
            options={ALL_VOUCHER_TYPES}
            value={values.voucherTypes}
            onChange={(v) => setValue("voucherTypes", v)}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button onClick={submit} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </>
  );
}

function JtForm({
  payload,
  onCancel,
  onSave,
}: {
  payload: Partial<JournalType> | null;
  onCancel: () => void;
  onSave: (p: any) => Promise<void>;
}) {
  const { values, setValue, submit, saving } = useAdminForm({
    defaultValues: {
      name: payload?.name ?? "",
      isActive: payload?.isActive ?? true,
    },
    onSubmit: async (vals) => {
      if (!vals.name.trim()) throw new Error("Name is required");
      await onSave({ ...payload, ...vals });
    },
  });

  return (
    <>
      <div className="space-y-4">
        <div>
          <Label>Name</Label>
          <Input
            value={values.name}
            onChange={(e) => setValue("name", e.target.value)}
          />
        </div>

        <div>
          <Label>Active</Label>
          <select
            className="w-full border rounded px-3 py-2"
            value={values.isActive ? "1" : "0"}
            onChange={(e) => setValue("isActive", e.target.value === "1")}
          >
            <option value="1">Yes</option>
            <option value="0">No</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button onClick={submit} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </>
  );
}

/* -------------------------
   Main Page
   ------------------------- */

export default function VoucherAdminPage() {
  const [tab, setTab] = useState<"parties" | "modes" | "vas" | "journal">(
    "parties",
  );

  const [voucherParties, setVoucherParties] = useState<VoucherParty[]>([]);
  const [paymentModes, setPaymentModes] = useState<PaymentMode[]>([]);
  const [voucherAccounts, setVoucherAccounts] = useState<VoucherAccount[]>([]);
  const [journalTypes, setJournalTypes] = useState<JournalType[]>([]);
  const [flatAccounts, setFlatAccounts] = useState<Account[]>([]);

  const [loading, setLoading] = useState(false);

  /* dialog */
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerType, setDrawerType] = useState<
    "party" | "mode" | "va" | "jt" | null
  >(null);
  const [drawerPayload, setDrawerPayload] = useState<any>(null);

  /* search */
  const [searchParties, setSearchParties] = useState("");
  const [searchModes, setSearchModes] = useState("");
  const [searchVAs, setSearchVAs] = useState("");
  const [searchJt, setSearchJt] = useState("");

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flatAccountMap = useMemo(() => {
    const m = new Map<string, Account>();
    flatAccounts.forEach((a) => m.set(a._id, a));
    return m;
  }, [flatAccounts]);

  async function loadAll() {
    setLoading(true);
    try {
      const [accountsRes, partiesRes, modesRes, vasRes, jtsRes] =
        await Promise.all([
          api.get("/accounts/tree").catch(() => ({ data: [] })),
          api.get("/voucher-parties").catch(() => ({ data: [] })),
          api.get("/payment-modes").catch(() => ({ data: [] })),
          api.get("/voucher-accounts").catch(() => ({ data: [] })),
          api.get("/journal-voucher-types").catch(() => ({ data: [] })),
        ]);

      // build flattened accounts with nice path
      const tree = accountsRes?.data?.data ?? [];
      const flattened: Account[] = [];
      function walk(node: any, parentPath = "") {
        const path = parentPath ? `${parentPath} › ${node.name}` : node.name;
        flattened.push({
          _id: node._id,
          name: node.name,
          code: node.code,
          path,
        });
        if (node.children) node.children.forEach((c: any) => walk(c, path));
      }
      (tree as any[]).forEach((n) => walk(n));
      flattened.sort((a, b) =>
        (a.path ?? a.name).localeCompare(b.path ?? b.name),
      );
      setFlatAccounts(flattened);

      // normalize other lists
      const parties = partiesRes?.data?.data ?? partiesRes?.data ?? [];
      const modes = modesRes?.data?.data ?? modesRes?.data ?? [];
      const vas = (vasRes?.data?.data ?? vasRes?.data ?? []) as any[];
      const jts = jtsRes?.data?.data ?? jtsRes?.data ?? [];

      const normalizedVAs: VoucherAccount[] = vas.map((v) => {
        const accountId =
          v.accountId && typeof v.accountId === "object"
            ? v.accountId._id
            : v.accountId;
        const populatedAccount =
          v.accountId && typeof v.accountId === "object"
            ? v.accountId
            : undefined;
        const allowedVoucherTypes =
          v.allowedVoucherTypes ?? v.voucherTypes ?? [];
        return {
          _id: v._id,
          name: v.name,
          role: v.role,
          kind: roleToKind(v.role),
          accountId: populatedAccount ?? accountId ?? null,
          allowedVoucherTypes,
          voucherTypes: v.voucherTypes,
          isActive: v.isActive ?? true,
          raw: v,
        };
      });

      setVoucherParties(parties);
      setPaymentModes(modes);
      setVoucherAccounts(normalizedVAs);
      setJournalTypes(jts);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load admin data — see console.");
    } finally {
      setLoading(false);
    }
  }

  /* CRUD helpers */
  async function createMaster(url: string, payload: any) {
    const res = await api.post(url, payload);
    return res.data?.data ?? res.data;
  }
  async function updateMaster(url: string, id: string, payload: any) {
    const res = await api.put(`${url}/${id}`, payload);
    return res.data?.data ?? res.data;
  }
  async function deleteMaster(url: string, id: string) {
    await api.delete(`${url}/${id}`);
  }

  function openDrawer(
    type: "party" | "mode" | "va" | "jt",
    payload: any = null,
  ) {
    // normalize payload for VA accountId to string (handles populated)
    if (type === "va" && payload) {
      const normalized = {
        ...payload,
        accountId:
          payload.accountId && typeof payload.accountId === "object"
            ? payload.accountId._id
            : (payload.accountId ?? ""),
      };
      setDrawerPayload(normalized);
    } else {
      setDrawerPayload(payload);
    }
    setDrawerType(type);
    setDrawerOpen(true);
  }

  async function handleAdminSave(type: string, payload: any) {
    try {
      setLoading(true);
      if (type === "party") {
        if (payload._id)
          await updateMaster("/voucher-parties", payload._id, payload);
        else await createMaster("/voucher-parties", payload);
      } else if (type === "mode") {
        if (payload._id)
          await updateMaster("/payment-modes", payload._id, payload);
        else await createMaster("/payment-modes", payload);
      } else if (type === "va") {
        // normalize payload for backend
        const out: any = { ...(payload ?? {}) };
        if (payload.kind) out.role = kindToRole(payload.kind);
        if (payload.accountId === "" || payload.accountId === null)
          out.accountId = undefined;
        // ensure allowedVoucherTypes sent
        out.allowedVoucherTypes =
          payload.allowedVoucherTypes ?? payload.voucherTypes ?? [];
        if (out._id) await updateMaster("/voucher-accounts", out._id, out);
        else await createMaster("/voucher-accounts", out);
      } else if (type === "jt") {
        if (payload._id)
          await updateMaster("/journal-voucher-types", payload._id, payload);
        else await createMaster("/journal-voucher-types", payload);
      }

      await loadAll();
      setDrawerOpen(false);
      toast.success("Saved successfully.");
    } catch (err: any) {
      console.error(err);
      const msg =
        err?.response?.data?.message || err?.message || "Failed to save.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdminDelete(type: string, id?: string) {
    if (!id) return;
    if (!confirm("Delete this item? This cannot be undone.")) return;
    try {
      setLoading(true);
      if (type === "party") await deleteMaster("/voucher-parties", id);
      else if (type === "mode") await deleteMaster("/payment-modes", id);
      else if (type === "va") await deleteMaster("/voucher-accounts", id);
      else if (type === "jt") await deleteMaster("/journal-voucher-types", id);
      await loadAll();
      toast.success("Deleted successfully.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete (see console).");
    } finally {
      setLoading(false);
    }
  }

  /* Filters */
  const filteredParties = useMemo(
    () =>
      voucherParties
        .filter((p) =>
          p.name.toLowerCase().includes(searchParties.toLowerCase()),
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [voucherParties, searchParties],
  );
  const filteredModes = useMemo(
    () =>
      paymentModes
        .filter((m) => m.name.toLowerCase().includes(searchModes.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [paymentModes, searchModes],
  );
  const filteredVAs = useMemo(
    () =>
      voucherAccounts
        .filter((v) =>
          (v.name ?? safeAccountLabel(v.accountId))
            .toLowerCase()
            .includes(searchVAs.toLowerCase()),
        )
        .sort((a, b) =>
          (a.name ?? safeAccountLabel(a.accountId)).localeCompare(
            b.name ?? safeAccountLabel(b.accountId),
          ),
        ),
    [voucherAccounts, searchVAs],
  );
  const filteredJt = useMemo(
    () =>
      journalTypes
        .filter((j) => j.name.toLowerCase().includes(searchJt.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [journalTypes, searchJt],
  );

  const stats = {
    parties: voucherParties.length,
    modes: paymentModes.length,
    vas: voucherAccounts.length,
    jts: journalTypes.length,
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <Toaster position="top-right" richColors />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Voucher Administration
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage receive sources, payment modes, voucher accounts and journal
            types.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => (window.location.href = "/voucher/bank-receive")}
          >
            Open Bank Receive
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-xs text-slate-500">Receive Sources</div>
          <div className="text-2xl font-semibold">{stats.parties}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-slate-500">Payment Modes</div>
          <div className="text-2xl font-semibold">{stats.modes}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-slate-500">Voucher Accounts</div>
          <div className="text-2xl font-semibold">{stats.vas}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-slate-500">Journal Types</div>
          <div className="text-2xl font-semibold">{stats.jts}</div>
        </Card>
      </div>

      <Card className="p-4">
        <Tabs value={tab} onValueChange={(v: any) => setTab(v)}>
          <div className="flex items-center justify-between">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="parties">Receive Sources</TabsTrigger>
              <TabsTrigger value="modes">Payment Modes</TabsTrigger>
              <TabsTrigger value="vas">Voucher Accounts</TabsTrigger>
              <TabsTrigger value="journal">Journal Types</TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2">
              {tab === "parties" && (
                <>
                  <Input
                    placeholder="Search sources..."
                    value={searchParties}
                    onChange={(e) => setSearchParties(e.target.value)}
                    className="max-w-sm"
                  />
                  <Button onClick={() => openDrawer("party", null)}>
                    + New
                  </Button>
                </>
              )}

              {tab === "modes" && (
                <>
                  <Input
                    placeholder="Search modes..."
                    value={searchModes}
                    onChange={(e) => setSearchModes(e.target.value)}
                    className="max-w-sm"
                  />
                  <Button onClick={() => openDrawer("mode", null)}>
                    + New
                  </Button>
                </>
              )}

              {tab === "vas" && (
                <>
                  <Input
                    placeholder="Search voucher accounts..."
                    value={searchVAs}
                    onChange={(e) => setSearchVAs(e.target.value)}
                    className="max-w-sm"
                  />
                  <Button onClick={() => openDrawer("va", null)}>+ New</Button>
                </>
              )}

              {tab === "journal" && (
                <>
                  <Input
                    placeholder="Search journal types..."
                    value={searchJt}
                    onChange={(e) => setSearchJt(e.target.value)}
                    className="max-w-sm"
                  />
                  <Button onClick={() => openDrawer("jt", null)}>+ New</Button>
                </>
              )}
            </div>
          </div>

          {/* PARTIES */}
          <TabsContent value="parties" className="p-4">
            {loading ? (
              <Empty>Loading...</Empty>
            ) : filteredParties.length === 0 ? (
              <Empty>No receive sources found.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-4 py-3">Name</th>
                      <th className="text-left px-4 py-3">Direction • Types</th>
                      <th className="text-right px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredParties.map((p) => (
                      <tr key={p._id} className="border-t hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="font-medium">{p.name}</div>
                          {!p.isActive && (
                            <div className="text-xs text-rose-600 mt-1">
                              Inactive
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">
                          <div className="flex gap-2 items-center flex-wrap">
                            <Badge>{p.direction}</Badge>
                            {(p.voucherTypes ?? []).slice(0, 6).map((t) => (
                              <Badge key={t}>{t}</Badge>
                            ))}
                            {(p.voucherTypes ?? []).length > 6 && (
                              <span className="text-xs text-slate-400">
                                +{(p.voucherTypes ?? []).length - 6}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openDrawer("party", p)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleAdminDelete("party", p._id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* MODES */}
          <TabsContent value="modes" className="p-4">
            {loading ? (
              <Empty>Loading...</Empty>
            ) : filteredModes.length === 0 ? (
              <Empty>No payment modes found.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-4 py-3">Name</th>
                      <th className="text-left px-4 py-3">Details</th>
                      <th className="text-right px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredModes.map((m) => (
                      <tr key={m._id} className="border-t hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium">{m.name}</td>
                        <td className="px-4 py-3 text-slate-600 text-xs">
                          <div className="flex items-center gap-3">
                            {m.requiresReference ? (
                              <Badge>Requires reference</Badge>
                            ) : (
                              <Badge>No reference</Badge>
                            )}
                            <div className="flex gap-2 flex-wrap">
                              {(m.voucherTypes ?? []).slice(0, 5).map((t) => (
                                <Badge key={t}>{t}</Badge>
                              ))}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openDrawer("mode", m)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleAdminDelete("mode", m._id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* VOUCHER ACCOUNTS */}
          <TabsContent value="vas" className="p-4">
            {loading ? (
              <Empty>Loading...</Empty>
            ) : filteredVAs.length === 0 ? (
              <Empty>No voucher accounts found.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-4 py-3">Label</th>
                      <th className="text-left px-4 py-3">Mapping • Type</th>
                      <th className="text-right px-4 py-3">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredVAs.map((v) => {
                      const label =
                        v.name ??
                        safeAccountLabel(v.accountId) ??
                        "(voucher account)";
                      const acctLabel = (() => {
                        if (v.accountId && typeof v.accountId === "object")
                          return safeAccountLabel(v.accountId);
                        if (
                          typeof v.accountId === "string" &&
                          flatAccountMap.has(v.accountId)
                        ) {
                          const fa = flatAccountMap.get(v.accountId)!;
                          return `${fa.path ?? fa.name}${fa.code ? ` (${fa.code})` : ""}`;
                        }
                        return v.accountId ? String(v.accountId) : null;
                      })();

                      return (
                        <tr key={v._id} className="border-t hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium">
                            <div>{label}</div>
                            {!v.isActive && (
                              <div className="text-xs text-rose-600 mt-1">
                                Inactive
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3 text-slate-600 text-xs">
                            <div className="flex items-center gap-3">
                              <div>
                                {acctLabel ? (
                                  <span>
                                    Mapped → <strong>{acctLabel}</strong>
                                  </span>
                                ) : (
                                  <span>Not mapped</span>
                                )}
                              </div>
                              <Separator
                                orientation="vertical"
                                className="h-6"
                              />
                              <div className="capitalize">
                                {v.kind ?? roleToKind(v.role)}
                              </div>
                              <div className="flex gap-2 flex-wrap">
                                {(v.allowedVoucherTypes ?? v.voucherTypes ?? [])
                                  .slice(0, 5)
                                  .map((t) => (
                                    <Badge key={t}>{t}</Badge>
                                  ))}
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDrawer("va", v)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleAdminDelete("va", v._id)}
                              >
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* JOURNAL TYPES */}
          <TabsContent value="journal" className="p-4">
            {loading ? (
              <Empty>Loading...</Empty>
            ) : filteredJt.length === 0 ? (
              <Empty>No journal types found.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-4 py-3">Name</th>
                      <th className="text-right px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredJt.map((j) => (
                      <tr key={j._id} className="border-t hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium">{j.name}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openDrawer("jt", j)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleAdminDelete("jt", j._id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </Card>

      {/* Drawer */}
      <AdminDrawer
        open={drawerOpen}
        onOpenChange={(v) => {
          if (!v) {
            setDrawerOpen(false);
            setDrawerType(null);
            setDrawerPayload(null);
          } else setDrawerOpen(true);
        }}
        title={
          drawerPayload
            ? `Edit ${drawerType === "party" ? "Receive Source" : drawerType === "mode" ? "Payment Mode" : drawerType === "va" ? "Voucher Account" : "Journal Type"}`
            : `Create ${drawerType === "party" ? "Receive Source" : drawerType === "mode" ? "Payment Mode" : drawerType === "va" ? "Voucher Account" : "Journal Type"}`
        }
        width={640}
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setDrawerOpen(false)}>
              Close
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {drawerType === "party" && (
            <PartyForm
              payload={drawerPayload}
              onCancel={() => setDrawerOpen(false)}
              onSave={(p) => handleAdminSave("party", p)}
            />
          )}
          {drawerType === "mode" && (
            <ModeForm
              payload={drawerPayload}
              onCancel={() => setDrawerOpen(false)}
              onSave={(p) => handleAdminSave("mode", p)}
            />
          )}
          {drawerType === "va" && (
            <VaForm
              payload={drawerPayload}
              flatAccounts={flatAccounts}
              onCancel={() => setDrawerOpen(false)}
              onSave={(p) => handleAdminSave("va", p)}
            />
          )}
          {drawerType === "jt" && (
            <JtForm
              payload={drawerPayload}
              onCancel={() => setDrawerOpen(false)}
              onSave={(p) => handleAdminSave("jt", p)}
            />
          )}
        </div>
      </AdminDrawer>

      <div className="text-xs text-slate-500">
        Pro tip: use the search boxes to quickly filter lists. Want a searchable
        dropdown replacement? I can convert SearchableAccountSelect to a Radix
        Combobox next.
      </div>
    </div>
  );
}
