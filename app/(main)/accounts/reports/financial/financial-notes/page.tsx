"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import {
  Plus, Search, Loader2, Edit3, Trash2, CheckCircle2, Lock, Unlock,
  ArrowUp, ArrowDown, BookOpen, Eye, X, RefreshCw, AlertCircle,
  ChevronDown, ChevronRight, Sparkles, FileText, Table as TableIcon,
  TrendingUp, Clock, Link2, Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import GlobalPrintButton from "@/components/common/print/GlobalPrintButton";
import { cn } from "@/lib/utils";

/* ---------------- Types ---------------- */
type StatementType = "Balance Sheet" | "Income Statement" | "Cash Flow" | "Equity Statement" | "Notes";
type NoteType =
  | "BASIS_OF_PREPARATION" | "ACCOUNTING_POLICY" | "TABULAR"
  | "MOVEMENT" | "AGING" | "NARRATIVE" | "SUBSEQUENT_EVENT" | "RELATED_PARTY";

type RawAccount = {
  _id: string;
  code: string;
  name: string;
  type: string;
  parent?: string;
  balance?: number;
  openingBalance?: number;
  closingBalance?: number;
};

type RolledLeaf = { account: string; code: string; name: string; snapshotBalance: number; currentBalance?: number };
type RelatedAccount = {
  account: string; accountCode?: string; accountName?: string;
  isParentRollup?: boolean; rolledUpLeaves?: RolledLeaf[];
  snapshotBalance: number; currentBalance?: number;
};

type NoteSection = { _id?: string; heading?: string; body: string; kind: "NARRATIVE" | "BULLETS" | "TABLE" | "SUB_NOTE"; order: number };
type NoteVersion = { _id?: string; versionNo: number; content: string; summary?: string; author: string; createdAt: string; kind?: string };
type FinancialNote = {
  _id: string; noteNo: string; displayOrder: number; title: string;
  statement: StatementType; noteType: NoteType; year: number;
  summary?: string;
  statementRef?: { lineItem?: string; accountCode?: string };
  relatedAccounts: RelatedAccount[]; sections: NoteSection[];
  versions: NoteVersion[]; isDraft: boolean;
  finalisedAt?: string; finalisedBy?: string;
  createdAt: string; updatedAt: string;
};

type FormState = {
  title: string; statement: StatementType; noteType: NoteType; year: number;
  summary: string; statementLine: string;
  sections: NoteSection[];
  accounts: { accountId: string }[];
  isDraft: boolean;
};

/* ---------------- Constants ---------------- */
const STATEMENTS: StatementType[] = ["Balance Sheet", "Income Statement", "Cash Flow", "Equity Statement", "Notes"];

const NOTE_TYPE_META: Record<NoteType, { label: string; icon: typeof FileText; hint: string }> = {
  BASIS_OF_PREPARATION: { label: "Basis of preparation", icon: FileText, hint: "Note 1 typically. Narrative: measurement basis, going concern, compliance." },
  ACCOUNTING_POLICY:     { label: "Accounting policy",     icon: FileText, hint: "Modular sub-sections: Revenue, Leases, Tax, Impairment, etc." },
  TABULAR:               { label: "Numeric disclosure",    icon: TableIcon, hint: "Table breakdown of an account balance with sub-columns." },
  MOVEMENT:              { label: "Movement / reconciliation", icon: TrendingUp, hint: "Opening → additions → disposals → closing (e.g. PPE Note 12)." },
  AGING:                 { label: "Aging analysis",        icon: Clock, hint: "Current / 1–30 / 31–60 / 61–90 / >90 days buckets." },
  NARRATIVE:             { label: "Narrative",             icon: BookOpen, hint: "Pure text — commitments, contingencies, judgments." },
  SUBSEQUENT_EVENT:      { label: "Subsequent event",      icon: AlertCircle, hint: "Events between year-end and sign-off." },
  RELATED_PARTY:         { label: "Related party",         icon: Link2, hint: "Balances + transactions with related entities." },
};

/* ---------------- Helpers ---------------- */
const money = (n: number) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const drCr = (n: number) => Math.abs(n) < 0.005 ? "—" : `৳ ${money(n)} ${n >= 0 ? "DR" : "CR"}`;
const fmtDate = (v?: string) => v ? new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function mdToHtml(md?: string) {
  if (!md) return "";
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let h = esc(md);
  h = h.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  h = h.replace(/(^|[^_])_(.+?)_([^_]|$)/g, "$1<em>$2</em>$3");
  h = h.replace(/^- (.+)$/gm, "<li>$1</li>");
  h = h.replace(/(<li>.*?<\/li>\s*)+/gs, (m) => `<ul>${m}</ul>`);
  return h.split(/\n{2,}/).map((p) => (p.startsWith("<ul>") ? p : `<p>${p.replace(/\n/g, "<br/>")}</p>`)).join("");
}

/* ---------------- Hierarchical Account Picker ---------------- */
function AccountPicker({
  accounts,
  selected,
  onChange,
}: {
  accounts: RawAccount[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Build map
  const accountsById = useMemo(() => new Map(accounts.map((a) => [a._id, a])), [accounts]);
  const childrenMap = useMemo(() => {
    const m = new Map<string, RawAccount[]>();
    for (const a of accounts) {
      const p = a.parent ? String(a.parent) : null;
      if (!p) continue;
      if (!m.has(p)) m.set(p, []);
      m.get(p)!.push(a);
    }
    return m;
  }, [accounts]);

  // Descendants of any selected account (so we can disable them)
  const disabled = useMemo(() => {
    const s = new Set<string>();
    const walk = (id: string) => {
      for (const c of childrenMap.get(id) || []) {
        s.add(c._id);
        walk(c._id);
      }
    };
    selected.forEach(walk);
    return s;
  }, [selected, childrenMap]);

  // Ancestors of any selected account (show "included under X")
  const ancestorOf = useMemo(() => {
    const m = new Map<string, string>(); // child -> selected ancestor label
    const walk = (id: string, rootLabel: string) => {
      for (const c of childrenMap.get(id) || []) {
        m.set(c._id, rootLabel);
        walk(c._id, rootLabel);
      }
    };
    for (const id of selected) {
      const a = accountsById.get(id);
      if (!a) continue;
      walk(id, `${a.name}${a.code ? ` (${a.code})` : ""}`);
    }
    return m;
  }, [selected, childrenMap, accountsById]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = accounts;
    if (q) {
      list = list.filter((a) =>
        `${a.name} ${a.code}`.toLowerCase().includes(q),
      );
    }
    return list.slice(0, 60);
  }, [accounts, query]);

  const toggle = (id: string) => {
    if (disabled.has(id)) return;
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else onChange([...selected, id]);
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-9 w-full justify-between bg-white text-xs">
            <span className="truncate">
              {selected.length === 0
                ? "Search & link accounts (rollup applied)…"
                : `${selected.length} account${selected.length === 1 ? "" : "s"} linked`}
            </span>
            <Search className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[480px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Search by name or code…" value={query} onValueChange={setQuery} />
            <CommandList className="max-h-[380px]">
              <CommandEmpty>No account found.</CommandEmpty>
              <CommandGroup>
                {filtered.map((a) => {
                  const isSelected = selected.includes(a._id);
                  const isDisabled = disabled.has(a._id);
                  const included = ancestorOf.get(a._id);
                  const childCount = (childrenMap.get(a._id) || []).length;
                  return (
                    <CommandItem
                      key={a._id}
                      value={a._id}
                      onSelect={() => toggle(a._id)}
                      className={cn(isDisabled && "opacity-60 cursor-not-allowed")}
                      disabled={isDisabled}
                    >
                      <CheckCircle2
                        className={cn("mr-2 h-3.5 w-3.5 shrink-0", isSelected ? "text-[#3aa838]" : "opacity-0")}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-xs font-medium">{a.name}</span>
                          {a.code && <span className="font-mono text-[10px] text-slate-500">{a.code}</span>}
                          {childCount > 0 && (
                            <Badge className="border border-[#3aa838]/30 bg-[#3aa838]/10 text-[9px] font-medium text-[#2f8a2f]">
                              parent · {childCount} child{childCount === 1 ? "" : "ren"}
                            </Badge>
                          )}
                          {included && !isDisabled && (
                            <Badge className="border border-slate-200 bg-slate-50 text-[9px] font-medium text-slate-600">
                              included via {included}
                            </Badge>
                          )}
                          {isDisabled && (
                            <Badge className="border border-slate-200 bg-slate-100 text-[9px] font-medium text-slate-500">
                              auto-included
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <div className="space-y-1">
          {selected.map((id) => {
            const a = accountsById.get(id);
            if (!a) return null;
            const childCount = (childrenMap.get(id) || []).length;
            return (
              <div key={id} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px]">
                <span className="flex min-w-0 items-center gap-1.5 truncate">
                  <span className="truncate font-medium">{a.name}</span>
                  {childCount > 0 && (
                    <span className="rounded bg-[#3aa838]/10 px-1 py-0 text-[9px] font-semibold text-[#2f8a2f]">
                      +{childCount} child{childCount === 1 ? "" : "ren"} rolled up
                    </span>
                  )}
                </span>
                <button
                  onClick={() => onChange(selected.filter((x) => x !== id))}
                  className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------- Note preview renderer ---------------- */
function NotePreview({ note }: { note: FinancialNote }) {
  const latest = note.versions[0];
  const meta = NOTE_TYPE_META[note.noteType];

  const accountRows = note.relatedAccounts.map((ra) => (
    <tr key={ra.account} className="border-b border-slate-100 last:border-0">
      <td className="px-3 py-1.5">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-mono text-[10px] text-slate-500">{ra.accountCode}</span>
          <span className="font-medium text-slate-800">{ra.accountName}</span>
          {ra.isParentRollup && (
            <Badge className="border border-[#3aa838]/30 bg-[#3aa838]/10 text-[9px] font-medium text-[#2f8a2f]">
              parent rollup
            </Badge>
          )}
        </div>
      </td>
      <td className="px-3 py-1.5 text-right text-xs tabular-nums text-slate-800">{drCr(ra.snapshotBalance)}</td>
    </tr>
  ));

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {note.statement} · FY {note.year}
          </div>
          <h2 className="mt-0.5 text-lg font-bold text-slate-900">
            <span className="font-mono text-slate-500">{note.noteNo}</span> — {note.title}
          </h2>
          {note.statementRef?.lineItem && (
            <div className="mt-0.5 text-[11px] text-slate-500">
              Referenced from: <span className="font-medium text-slate-700">{note.statementRef.lineItem}</span>
            </div>
          )}
          {note.summary && (
            <div className="mt-1 text-xs italic text-slate-600">{note.summary}</div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge className={cn("border text-[10px] font-semibold", note.isDraft ? "border-amber-200 bg-amber-50 text-amber-700" : "border-[#3aa838]/30 bg-[#3aa838]/10 text-[#2f8a2f]")}>
            {note.isDraft ? "Draft" : <><Lock className="mr-0.5 h-2.5 w-2.5" />Final</>}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            {meta?.label} · v{latest?.versionNo || 1}
          </span>
        </div>
      </div>

      {/* narrative + sections */}
      {note.sections?.length ? (
        <div className="space-y-3">
          {note.sections.map((s, i) => (
            <div key={s._id || i}>
              {s.heading && <h3 className="mb-1 text-sm font-semibold text-slate-800">{s.heading}</h3>}
              <div
                className="prose prose-sm max-w-none text-xs leading-relaxed text-slate-700 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5"
                dangerouslySetInnerHTML={{ __html: mdToHtml(s.body) }}
              />
            </div>
          ))}
        </div>
      ) : latest?.content ? (
        <div
          className="prose prose-sm max-w-none text-xs leading-relaxed text-slate-700 [&_p]:mb-2"
          dangerouslySetInnerHTML={{ __html: mdToHtml(latest.content) }}
        />
      ) : null}

      {/* linked accounts table */}
      {note.relatedAccounts?.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
            {note.noteType === "AGING" ? "Accounts by aging" : "Linked accounts"}
          </div>
          <table className="w-full text-xs">
            <thead className="bg-slate-50/70">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium text-slate-600">Account</th>
                <th className="px-3 py-1.5 text-right font-medium text-slate-600">
                  {note.noteType === "MOVEMENT" ? "Closing (snapshot)" : "Balance (snapshot)"}
                </th>
              </tr>
            </thead>
            <tbody>{accountRows}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------------- Main page ---------------- */
export default function FinancialStatementNotesPage() {
  const [notes, setNotes] = useState<FinancialNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<RawAccount[]>([]);

  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState<string>("All");
  const [statementFilter, setStatementFilter] = useState<"All" | StatementType>("All");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "final">("all");

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<FinancialNote | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [viewing, setViewing] = useState<FinancialNote | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function emptyForm(): FormState {
    return {
      title: "", statement: "Balance Sheet", noteType: "TABULAR",
      year: new Date().getFullYear(), summary: "", statementLine: "",
      sections: [{ heading: "", body: "", kind: "NARRATIVE", order: 0 }],
      accounts: [], isDraft: true,
    };
  }

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page: 1, limit: 200 };
      if (search.trim()) params.q = search.trim();
      if (yearFilter !== "All") params.year = yearFilter;
      if (statementFilter !== "All") params.statement = statementFilter;
      if (statusFilter !== "all") params.status = statusFilter;
      const res = await api.get("/reports/financial-notes", { params });
      setNotes(res.data?.data || []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load notes");
    } finally { setLoading(false); }
  }, [search, yearFilter, statementFilter, statusFilter]);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await api.get("/reports/financial-notes/account-tree");
      setAccounts(res.data?.data || []);
    } catch {}
  }, []);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);
  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const years = useMemo(() => {
    const s = new Set<number>(notes.map((n) => n.year));
    s.add(new Date().getFullYear());
    return Array.from(s).sort((a, b) => b - a);
  }, [notes]);

  const grouped = useMemo(() => {
    const map = new Map<string, { year: number; statement: StatementType; notes: FinancialNote[] }>();
    for (const n of notes) {
      const key = `${n.year}|${n.statement}`;
      if (!map.has(key)) map.set(key, { year: n.year, statement: n.statement, notes: [] });
      map.get(key)!.notes.push(n);
    }
    for (const g of map.values()) g.notes.sort((a, b) => a.displayOrder - b.displayOrder);
    const order = new Map(STATEMENTS.map((s, i) => [s, i]));
    return Array.from(map.values()).sort((a, b) =>
      a.year !== b.year ? b.year - a.year : (order.get(a.statement) ?? 99) - (order.get(b.statement) ?? 99),
    );
  }, [notes]);

  const openCreate = () => { setForm(emptyForm()); setEditingNote(null); setFormOpen(true); };
  const openEdit = (note: FinancialNote) => {
    setForm({
      title: note.title, statement: note.statement, noteType: note.noteType,
      year: note.year, summary: note.summary || "",
      statementLine: note.statementRef?.lineItem || "",
      sections: (note.sections?.length ? note.sections : [{ heading: "", body: note.versions[0]?.content || "", kind: "NARRATIVE", order: 0 }]),
      accounts: note.relatedAccounts.map((ra) => ({ accountId: ra.account })),
      isDraft: note.isDraft,
    });
    setEditingNote(note);
    setFormOpen(true);
  };
  const openView = async (note: FinancialNote) => {
    setViewing(note); setViewLoading(true);
    try {
      const res = await api.get(`/reports/financial-notes/${note._id}`);
      setViewing(res.data?.data || note);
    } catch { toast.error("Failed to load live balances"); }
    finally { setViewLoading(false); }
  };

  const saveNote = async (publish: boolean) => {
    if (!form.title.trim()) return toast.error("Title is required");
    setSaving(true);
    try {
      const payload: any = {
        title: form.title.trim(),
        statement: form.statement,
        noteType: form.noteType,
        year: form.year,
        summary: form.summary.trim(),
        statementRef: form.statementLine.trim() ? { lineItem: form.statementLine.trim() } : undefined,
        sections: form.sections.filter((s) => s.heading?.trim() || s.body?.trim()),
        relatedAccounts: form.accounts.map((a) => ({ accountId: a.accountId })),
        isDraft: true,
      };
      let noteId = editingNote?._id;
      if (editingNote) {
        if (!editingNote.isDraft) payload.forceFinalised = true;
        await api.put(`/reports/financial-notes/${noteId}`, payload);
      } else {
        const res = await api.post("/reports/financial-notes", payload);
        noteId = res.data?.data?._id;
      }
      if (publish && noteId) {
        await api.post(`/reports/financial-notes/${noteId}/finalise`);
        toast.success("Note saved and finalised");
      } else toast.success(editingNote ? "New version saved" : "Saved as draft");
      setFormOpen(false); fetchNotes();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Save failed");
    } finally { setSaving(false); }
  };

  const finaliseNote = async (note: FinancialNote) => {
    if (!confirm(`Finalise "${note.noteNo}"? This will lock it and re-snapshot account balances.`)) return;
    setActionLoading(note._id);
    try {
      await api.post(`/reports/financial-notes/${note._id}/finalise`);
      toast.success("Finalised"); fetchNotes();
      if (viewing?._id === note._id) openView(note);
    } catch (err: any) { toast.error(err?.response?.data?.message || "Failed"); }
    finally { setActionLoading(null); }
  };

  const reopenNote = async (note: FinancialNote) => {
    if (!confirm(`Reopen "${note.noteNo}"?`)) return;
    setActionLoading(note._id);
    try {
      await api.post(`/reports/financial-notes/${note._id}/reopen`);
      toast.success("Reopened"); fetchNotes();
      if (viewing?._id === note._id) openView(note);
    } catch (err: any) { toast.error(err?.response?.data?.message || "Failed"); }
    finally { setActionLoading(null); }
  };

  const deleteNote = async (note: FinancialNote) => {
    if (!note.isDraft) return toast.error("Reopen before deleting");
    if (!confirm(`Delete "${note.noteNo}"?`)) return;
    setActionLoading(note._id);
    try {
      await api.delete(`/reports/financial-notes/${note._id}`);
      toast.success("Deleted"); setViewing(null); fetchNotes();
    } catch (err: any) { toast.error(err?.response?.data?.message || "Failed"); }
    finally { setActionLoading(null); }
  };

  const moveNote = async (note: FinancialNote, direction: "up" | "down") => {
    setActionLoading(note._id);
    try { await api.post(`/reports/financial-notes/${note._id}/move`, { direction }); fetchNotes(); }
    catch (err: any) { toast.error(err?.response?.data?.message || "Failed"); }
    finally { setActionLoading(null); }
  };

  const toggleExpand = (id: string) => setExpanded((s) => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const printHtml = (note: FinancialNote) => {
    const latest = note.versions[0];
    const sections = note.sections?.length
      ? note.sections.map((s) => `<h3 style="font-size:13px;font-weight:700;margin:14px 0 6px">${s.heading || ""}</h3><div>${mdToHtml(s.body)}</div>`).join("")
      : `<div>${mdToHtml(latest?.content || "")}</div>`;
    const rows = note.relatedAccounts.map((ra) => `
      <tr>
        <td style="padding:4px 8px;border-bottom:1px solid #e2e8f0">${ra.accountCode || ""} — ${ra.accountName || ra.account}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-family:monospace">${drCr(ra.snapshotBalance)}</td>
      </tr>`).join("");
    return `
<div style="font-family:Inter,sans-serif;max-width:900px;margin:0 auto;color:#0f172a;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
  <div style="background:#0f172a;padding:20px 28px;color:#fff">
    <div style="font-size:20px;font-weight:800">${note.noteNo} — ${note.title}</div>
    <div style="font-size:12px;opacity:.85;margin-top:3px">${note.statement} · FY ${note.year} · ${note.isDraft ? "DRAFT" : "FINAL"}</div>
  </div>
  <div style="padding:20px 28px">
    ${note.summary ? `<div style="font-size:12px;font-style:italic;color:#475569;margin-bottom:12px">${note.summary}</div>` : ""}
    ${sections}
    ${rows ? `<table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:12px"><thead><tr style="background:#f1f5f9"><th style="text-align:left;padding:6px 8px">Account</th><th style="text-align:right;padding:6px 8px">Snapshot Balance</th></tr></thead><tbody>${rows}</tbody></table>` : ""}
  </div>
  <div style="background:#f8fafc;padding:10px 28px;font-size:10px;color:#94a3b8;display:flex;justify-content:space-between">
    <div>Version ${latest?.versionNo || 1} · ${latest?.author || "System"} · ${fmtDate(latest?.createdAt)}</div>
    <div>© Antab Agro LTD</div>
  </div>
</div>`;
  };

  const hasAnyFilter = Boolean(search) || yearFilter !== "All" || statementFilter !== "All" || statusFilter !== "all";
  const clearFilters = () => { setSearch(""); setYearFilter("All"); setStatementFilter("All"); setStatusFilter("all"); };

  /* ---------------- Render ---------------- */
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-[1500px] p-3 md:p-4">
        {/* Hero */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#3aa838]/10">
              <BookOpen className="h-4 w-4 text-[#3aa838]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-semibold leading-tight">Financial Statement Notes</h1>
              <p className="truncate text-[11px] text-muted-foreground">
                {notes.length} note{notes.length === 1 ? "" : "s"} ·{" "}
                {notes.filter((n) => n.isDraft).length} draft ·{" "}
                {notes.filter((n) => !n.isDraft).length} final
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={openCreate} className="h-8 bg-[#3aa838] text-white hover:bg-[#2f8a2f]">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New Note
            </Button>
            <Button size="icon" variant="outline" className="h-8 w-8" onClick={fetchNotes} disabled={loading}>
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-3 border-slate-200 shadow-sm">
          <CardContent className="flex flex-wrap gap-2 p-3">
            <div className="relative w-full max-w-[240px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search note, title, content…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 pl-8 text-xs focus-visible:ring-[#3aa838]" />
            </div>
            <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-xs focus:ring-2 focus:ring-[#3aa838]">
              <option value="All">All years</option>
              {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
            </select>
            <select value={statementFilter} onChange={(e) => setStatementFilter(e.target.value as any)} className="h-9 rounded-md border border-input bg-background px-2 text-xs focus:ring-2 focus:ring-[#3aa838]">
              <option value="All">All statements</option>
              {STATEMENTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="h-9 rounded-md border border-input bg-background px-2 text-xs focus:ring-2 focus:ring-[#3aa838]">
              <option value="all">All status</option>
              <option value="draft">Draft</option>
              <option value="final">Final</option>
            </select>
            {hasAnyFilter && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-slate-500">
                <X className="mr-1 h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-3 lg:grid-cols-3">
          {/* Notes list */}
          <div className="space-y-3 lg:col-span-2">
            {loading ? (
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="flex items-center justify-center gap-2 py-16 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading notes…
                </CardContent>
              </Card>
            ) : grouped.length === 0 ? (
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <div className="rounded-full bg-slate-100 p-3"><BookOpen className="h-6 w-6 text-slate-400" /></div>
                  <div>
                    <div className="text-sm font-medium text-slate-700">No notes yet</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {hasAnyFilter ? "Try adjusting filters." : "Create your first disclosure."}
                    </div>
                  </div>
                  {hasAnyFilter ? (
                    <Button size="sm" variant="outline" onClick={clearFilters}><X className="mr-1.5 h-3.5 w-3.5" /> Clear filters</Button>
                  ) : (
                    <Button size="sm" onClick={openCreate} className="bg-[#3aa838] text-white hover:bg-[#2f8a2f]"><Plus className="mr-1.5 h-3.5 w-3.5" /> Create first note</Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              grouped.map((group) => (
                <div key={`${group.year}-${group.statement}`} className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">{group.year}</div>
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">{group.statement}</span>
                    <Badge className="border border-slate-200 bg-white text-[10px] font-medium text-slate-600">{group.notes.length}</Badge>
                  </div>
                  {group.notes.map((note, idx) => {
                    const meta = NOTE_TYPE_META[note.noteType];
                    const Icon = meta?.icon || FileText;
                    const isExpanded = expanded.has(note._id);
                    return (
                      <Card key={note._id} className="overflow-hidden border-slate-200 shadow-sm hover:shadow-md">
                        <CardContent className="p-0">
                          {/* Header */}
                          <div className="flex items-start justify-between gap-2 p-3">
                            <div className="flex min-w-0 flex-1 items-start gap-2">
                              <div className="flex flex-col pt-1">
                                <button onClick={() => moveNote(note, "up")} disabled={idx === 0 || actionLoading === note._id} className="text-slate-400 hover:text-[#2f8a2f] disabled:opacity-25"><ArrowUp className="h-2.5 w-2.5" /></button>
                                <button onClick={() => moveNote(note, "down")} disabled={idx === group.notes.length - 1 || actionLoading === note._id} className="text-slate-400 hover:text-[#2f8a2f] disabled:opacity-25"><ArrowDown className="h-2.5 w-2.5" /></button>
                              </div>
                              <button onClick={() => toggleExpand(note._id)} className="mt-1 text-slate-500">
                                {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                              </button>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-mono text-[10px] font-bold text-slate-500">{note.noteNo}</span>
                                  <button onClick={() => openView(note)} className="max-w-full truncate text-left text-sm font-semibold text-slate-900 hover:text-[#2f8a2f] hover:underline">{note.title}</button>
                                  <Badge className="border border-slate-200 bg-slate-50 text-[9px] font-medium text-slate-600">
                                    <Icon className="mr-0.5 h-2.5 w-2.5" />{meta?.label}
                                  </Badge>
                                  {note.isDraft ? (
                                    <Badge className="border border-amber-200 bg-amber-50 text-[9px] font-semibold text-amber-700">Draft</Badge>
                                  ) : (
                                    <Badge className="border border-[#3aa838]/30 bg-[#3aa838]/10 text-[9px] font-semibold text-[#2f8a2f]"><Lock className="mr-0.5 h-2.5 w-2.5" />Final</Badge>
                                  )}
                                </div>
                                {note.statementRef?.lineItem && (
                                  <div className="mt-0.5 text-[10px] text-slate-500">
                                    Cross-ref: <span className="font-medium text-slate-700">{note.statementRef.lineItem}</span>
                                  </div>
                                )}
                                {note.summary && <p className="mt-0.5 text-[11px] text-slate-600 line-clamp-2">{note.summary}</p>}
                                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                                  <span>{note.relatedAccounts?.length || 0} linked</span>
                                  <span>·</span>
                                  <span>v{note.versions[0]?.versionNo || 1}</span>
                                  <span>·</span>
                                  <span>{fmtDate(note.updatedAt)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-0.5">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openView(note)} title="View"><Eye className="h-3.5 w-3.5" /></Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(note)} title="Edit"><Edit3 className="h-3.5 w-3.5" /></Button>
                              {note.isDraft ? (
                                <Button size="sm" variant="outline" className="h-7 border-[#3aa838]/40 px-2 text-[10px] text-[#2f8a2f] hover:bg-[#3aa838]/5 hover:text-[#2f8a2f]" onClick={() => finaliseNote(note)} disabled={actionLoading === note._id}>
                                  <Lock className="mr-0.5 h-3 w-3" /> Finalise
                                </Button>
                              ) : (
                                <Button size="sm" variant="outline" className="h-7 border-slate-300 px-2 text-[10px] text-slate-700 hover:bg-slate-100" onClick={() => reopenNote(note)} disabled={actionLoading === note._id}>
                                  <Unlock className="mr-0.5 h-3 w-3" /> Reopen
                                </Button>
                              )}
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => deleteNote(note)} disabled={!note.isDraft || actionLoading === note._id}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="border-t border-slate-200 bg-slate-50/50 p-3">
                              <NotePreview note={note} />
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Right sidebar */}
          <aside className="h-fit space-y-3 lg:sticky lg:top-4">
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <div className="border-b border-slate-200 bg-[#3aa838]/5 px-3 py-2 text-xs font-semibold text-[#2f8a2f]">
                <Sparkles className="mr-1 inline h-3 w-3" /> Quick guide
              </div>
              <CardContent className="space-y-2 p-3 text-[11px] text-slate-600">
                <div><b className="text-slate-900">Pick a parent</b> → children auto-included in the balance, disabled in the picker (prevents double-counting).</div>
                <div><b className="text-slate-900">Cross-reference</b> every note to the face-of-statement line item it explains.</div>
                <div><b className="text-slate-900">Note types</b> drive the layout: MOVEMENT gets opening/additions/disposals, AGING gets buckets, TABULAR gets a simple table.</div>
                <div><b className="text-slate-900">Finalise</b> → locks the note + re-snapshots balances. Reopen to edit.</div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>

      {/* ========== CREATE / EDIT DIALOG ========== */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              {editingNote ? `Edit ${editingNote.noteNo}` : "New financial note"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {editingNote
                ? `Saving creates version ${(editingNote.versions[0]?.versionNo || 1) + 1}.`
                : "The note will be numbered automatically within its (year, statement) group."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* Note type picker as chips */}
            <div>
              <Label className="text-xs">Note type *</Label>
              <div className="mt-1 grid grid-cols-2 gap-1.5 md:grid-cols-4">
                {(Object.keys(NOTE_TYPE_META) as NoteType[]).map((t) => {
                  const m = NOTE_TYPE_META[t];
                  const Ic = m.icon;
                  const active = form.noteType === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, noteType: t }))}
                      className={cn(
                        "rounded-md border p-1.5 text-left transition-colors",
                        active ? "border-[#3aa838] bg-[#3aa838]/5" : "border-slate-200 bg-white hover:border-slate-300",
                      )}
                    >
                      <div className="flex items-center gap-1">
                        <Ic className={cn("h-3 w-3", active ? "text-[#3aa838]" : "text-slate-500")} />
                        <span className={cn("text-[10px] font-semibold", active ? "text-[#2f8a2f]" : "text-slate-700")}>{m.label}</span>
                      </div>
                      <div className="mt-0.5 line-clamp-2 text-[9px] text-slate-500">{m.hint}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Title *</Label>
                <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Property, plant & equipment" className="h-9 text-sm focus-visible:ring-[#3aa838]" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Statement *</Label>
                <select value={form.statement} onChange={(e) => setForm((f) => ({ ...f, statement: e.target.value as StatementType }))} className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs focus:ring-2 focus:ring-[#3aa838]">
                  {STATEMENTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Year *</Label>
                <Input type="number" value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: Number(e.target.value) || new Date().getFullYear() }))} className="h-9 text-sm focus-visible:ring-[#3aa838]" />
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Statement cross-reference line (optional)</Label>
                <Input value={form.statementLine} onChange={(e) => setForm((f) => ({ ...f, statementLine: e.target.value }))} placeholder="e.g. Trade Receivables (appears on BS face)" className="h-9 text-sm focus-visible:ring-[#3aa838]" />
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Summary</Label>
                <Input value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} placeholder="One-line description (optional)" className="h-9 text-sm focus-visible:ring-[#3aa838]" />
              </div>
            </div>

            {/* Linked accounts */}
            <div className="space-y-1">
              <Label className="text-xs">Linked accounts</Label>
              <AccountPicker
                accounts={accounts}
                selected={form.accounts.map((a) => a.accountId)}
                onChange={(ids) => setForm((f) => ({ ...f, accounts: ids.map((id) => ({ accountId: id })) }))}
              />
              <p className="text-[10px] text-muted-foreground">
                Selecting a parent automatically rolls up its children — children are then locked.
              </p>
            </div>

            {/* Sections */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Narrative sections</Label>
                <Button
                  type="button" size="sm" variant="outline" className="h-7 text-[10px]"
                  onClick={() => setForm((f) => ({
                    ...f,
                    sections: [...f.sections, { heading: "", body: "", kind: "NARRATIVE", order: f.sections.length }],
                  }))}
                >
                  <Plus className="mr-1 h-3 w-3" /> Section
                </Button>
              </div>
              {form.sections.map((s, i) => (
                <div key={i} className="rounded-md border border-slate-200 bg-white p-2 space-y-1">
                  <div className="flex items-center gap-1">
                    <Input
                      value={s.heading || ""}
                      onChange={(e) => setForm((f) => ({
                        ...f,
                        sections: f.sections.map((x, j) => j === i ? { ...x, heading: e.target.value } : x),
                      }))}
                      placeholder="Section heading (optional)"
                      className="h-8 text-xs font-semibold focus-visible:ring-[#3aa838]"
                    />
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-600" onClick={() => setForm((f) => ({ ...f, sections: f.sections.filter((_, j) => j !== i) }))} disabled={form.sections.length === 1}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <Textarea
                    rows={3}
                    value={s.body}
                    onChange={(e) => setForm((f) => ({
                      ...f,
                      sections: f.sections.map((x, j) => j === i ? { ...x, body: e.target.value } : x),
                    }))}
                    placeholder="Markdown supported: **bold**, _italic_, blank line = new paragraph."
                    className="text-xs focus-visible:ring-[#3aa838]"
                  />
                </div>
              ))}
            </div>

            <DialogFooter className="flex-wrap gap-2">
              <Button variant="ghost" onClick={() => setFormOpen(false)} className="text-xs">Cancel</Button>
              <Button variant="outline" onClick={() => saveNote(false)} disabled={saving} className="text-xs">
                {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}Save Draft
              </Button>
              <Button onClick={() => saveNote(true)} disabled={saving} className="bg-[#3aa838] text-white hover:bg-[#2f8a2f] text-xs">
                {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Lock className="mr-1.5 h-3.5 w-3.5" />}
                Save & Finalise
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========== VIEW DIALOG ========== */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <DialogTitle className="text-base">{viewing?.noteNo} — {viewing?.title}</DialogTitle>
                <DialogDescription className="mt-0.5 text-[11px]">
                  {viewing?.statement} · FY {viewing?.year} · {viewing?.isDraft ? "Draft" : "Final"}
                  {viewing?.finalisedAt ? ` · Finalised ${fmtDate(viewing.finalisedAt)}` : ""}
                </DialogDescription>
              </div>
              {viewing && (
                <GlobalPrintButton
                  contentHtml={printHtml(viewing)}
                  headerRightHtml={`<div style="text-align:right"><div style="font-size:18px;font-weight:800">${viewing.noteNo}</div></div>`}
                  label="Print" title="Financial Note" orientation="portrait"
                  company={{ name: "Antab Agro LTD", address: "123 Agro Street, Dhaka", phone: "+880 1711-111111", email: "info@antabagro.com" }}
                  showHeader={false} showFooter={false}
                />
              )}
            </div>
          </DialogHeader>
          {viewLoading ? (
            <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Loading…
            </div>
          ) : viewing ? (
            <div className="space-y-3">
              <NotePreview note={viewing} />
              {viewing.relatedAccounts.some((ra) => ra.rolledUpLeaves?.length) && (
                <details className="text-[11px]">
                  <summary className="cursor-pointer font-medium text-[#2f8a2f] hover:underline">See leaf breakdown</summary>
                  <div className="mt-2 space-y-2 border-l-2 border-[#3aa838]/30 pl-3">
                    {viewing.relatedAccounts.map((ra) => (
                      <div key={ra.account}>
                        <div className="text-[10px] font-semibold text-slate-700">
                          {ra.accountName} → {ra.rolledUpLeaves?.length || 0} leaf
                          {(ra.rolledUpLeaves?.length || 0) === 1 ? "" : "ves"}
                        </div>
                        {(ra.rolledUpLeaves || []).map((leaf) => (
                          <div key={leaf.account} className="flex justify-between text-[10px] text-slate-600">
                            <span>{leaf.code} — {leaf.name}</span>
                            <span className="tabular-nums">{drCr(leaf.snapshotBalance)}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </details>
              )}
              <DialogFooter className="flex-wrap gap-2">
                <Button variant="ghost" onClick={() => setViewing(null)} className="text-xs">Close</Button>
                <Button variant="outline" onClick={() => { if (viewing) { setViewing(null); openEdit(viewing); } }} className="text-xs"><Edit3 className="mr-1.5 h-3.5 w-3.5" /> Edit</Button>
                {viewing.isDraft ? (
                  <Button onClick={() => finaliseNote(viewing)} disabled={actionLoading === viewing._id} className="bg-[#3aa838] text-white hover:bg-[#2f8a2f] text-xs">
                    <Lock className="mr-1.5 h-3.5 w-3.5" />Finalise
                  </Button>
                ) : (
                  <Button onClick={() => reopenNote(viewing)} disabled={actionLoading === viewing._id} className="bg-amber-600 text-white hover:bg-amber-700 text-xs">
                    <Unlock className="mr-1.5 h-3.5 w-3.5" />Reopen
                  </Button>
                )}
                <Button variant="outline" onClick={() => deleteNote(viewing)} disabled={!viewing.isDraft || actionLoading === viewing._id} className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 text-xs">
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}