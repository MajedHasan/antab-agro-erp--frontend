// src/app/(main)/reports/financial-notes/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import api from "@/lib/api";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Loader2,
  ChevronDown,
  ChevronUp,
  Edit,
  Trash2,
  CheckCircle,
  History,
  Printer,
  DollarSign,
  BookOpen,
  Calendar,
  Filter,
  X,
  FileText,
  Layers,
  Clock,
  BadgeCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import GlobalPrintButton from "@/components/common/print/GlobalPrintButton";

/* --------------------------- Types --------------------------- */
type AccountOption = {
  value: string;
  label: string;
  description?: string;
  balance?: number;
};

type RelatedAccount = {
  account: string;
  snapshotBalance: number;
  currentBalance?: number;
  name?: string;
  code?: string;
};

type Version = {
  _id?: string;
  versionNo: number;
  content: string;
  author: string;
  createdAt: string;
};

type FinancialNote = {
  _id: string;
  noteNo: string;
  title: string;
  statement: "Balance Sheet" | "Income Statement" | "Cash Flow" | "Equity Statement" | "Notes";
  year: number;
  summary?: string;
  relatedAccounts: RelatedAccount[];
  versions: Version[];
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
};

type FormValues = {
  title: string;
  statement: string;
  year: number;
  content: string;
  author: string;
  summary: string;
  isDraft: boolean;
  relatedAccounts: { accountId: string; accountName?: string }[];
};

/* --------------------------- Helpers --------------------------- */
const STATEMENT_OPTIONS = [
  "Balance Sheet",
  "Income Statement",
  "Cash Flow",
  "Equity Statement",
  "Notes",
];

const money = (n: number) =>
  Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatDate = (v?: string) =>
  v ? new Date(v).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" }) : "-";

// 🆕 Moved outside component to be accessible by child components
function buildPrintHtml(note: FinancialNote) {
  const latestVersion = note.versions[0];
  const accountsHtml = note.relatedAccounts
    .map(
      (ra) => `
      <tr>
        <td style="padding:6px 8px;">${ra.name || ra.account}</td>
        <td style="padding:6px 8px; text-align:right;">${money(ra.snapshotBalance)}</td>
        <td style="padding:6px 8px; text-align:right;">${money(ra.currentBalance || ra.snapshotBalance)}</td>
      </tr>`
    )
    .join("");

  return `
<div style="font-family: 'Inter', sans-serif; max-width: 900px; margin: 0 auto; color: #1e293b; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.04);">
  <div style="background: linear-gradient(135deg, #0f172a, #1e293b); padding: 24px 32px; color: white;">
    <div style="font-size: 28px; font-weight: 800;">${note.noteNo}: ${note.title}</div>
    <div style="font-size: 14px; opacity: 0.9; margin-top: 4px;">${note.statement} · ${note.year} · ${note.isDraft ? "Draft" : "Final"}</div>
  </div>
  <div style="padding: 24px 32px;">
    <p style="font-size: 15px; line-height: 1.6; white-space: pre-wrap; margin-bottom: 24px;">${latestVersion?.content || ""}</p>
    <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 12px;">Related Accounts</h3>
    <table style="width:100%; border-collapse: collapse; font-size: 14px;">
      <thead>
        <tr style="background: #f8fafc;">
          <th style="padding:8px 12px; text-align:left;">Account</th>
          <th style="padding:8px 12px; text-align:right;">Snapshot Balance</th>
          <th style="padding:8px 12px; text-align:right;">Current Balance</th>
        </tr>
      </thead>
      <tbody>${accountsHtml}</tbody>
    </table>
  </div>
  <div style="background: #f8fafc; padding: 16px 32px; font-size: 12px; color: #64748b; display: flex; justify-content: space-between;">
    <div>Version ${latestVersion?.versionNo || 1} · ${latestVersion?.author || "System"}</div>
    <div>Printed on ${new Date().toLocaleDateString()}</div>
  </div>
</div>`;
}

/* --------------------------- Account Picker (Multi‑select) --------------------------- */
function AccountPicker({
  selectedIds,
  onAdd,
  onRemove,
}: {
  selectedIds: { accountId: string; accountName?: string }[];
  onAdd: (acc: AccountOption) => void;
  onRemove: (accountId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<AccountOption[]>([]);
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef<Record<string, AccountOption[]>>({});

  const fetchAccounts = useCallback(async (search: string) => {
    const res = await api.get("/accounts", {
      params: { q: search || undefined, page: 1, limit: 30, status: "Active" },
    });
    return (res.data?.data || []).map((a: any) => ({
      value: String(a._id),
      label: `${a.name} (${a.code || ""})`,
      description: `Type: ${a.type} · Balance: ${money(a.balance || 0)}`,
    }));
  }, []);

  useEffect(() => {
    if (!open) return;
    const key = query.trim().toLowerCase();
    const timer = setTimeout(async () => {
      if (cacheRef.current[key]) {
        setOptions(cacheRef.current[key]);
        return;
      }
      setLoading(true);
      try {
        const list = await fetchAccounts(query);
        cacheRef.current[key] = list;
        setOptions(list);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [open, query, fetchAccounts]);

  return (
    <div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="w-full justify-between">
            <span className="truncate">
              {selectedIds.length ? `${selectedIds.length} account(s) selected` : "Add account..."}
            </span>
            <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[480px] p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search accounts..."
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty>{loading ? "Loading..." : "No account found."}</CommandEmpty>
              <CommandGroup>
                {options.map((opt) => {
                  const alreadySelected = selectedIds.some((s) => s.accountId === opt.value);
                  return (
                    <CommandItem
                      key={opt.value}
                      value={`${opt.label} ${opt.description || ""}`}
                      onSelect={() => {
                        if (alreadySelected) {
                          onRemove(opt.value);
                        } else {
                          onAdd(opt);
                        }
                      }}
                    >
                      <CheckCircle
                        className={`mr-2 h-4 w-4 ${alreadySelected ? "opacity-100 text-emerald-600" : "opacity-0"}`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{opt.label}</div>
                        {opt.description && (
                          <div className="truncate text-xs text-muted-foreground">{opt.description}</div>
                        )}
                      </div>
                      {alreadySelected && (
                        <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Selected
                        </span>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedIds.length > 0 && (
        <div className="mt-2 space-y-1">
          {selectedIds.map((acc) => (
            <div key={acc.accountId} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-1 text-xs">
              <span className="font-medium">{acc.accountName || acc.accountId}</span>
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => onRemove(acc.accountId)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* --------------------------- Main Page --------------------------- */
export default function FinancialNotesPage() {
  const [notes, setNotes] = useState<FinancialNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statementFilter, setStatementFilter] = useState<string>("");
  const [yearFilter, setYearFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 12;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<FinancialNote | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteDetails, setNoteDetails] = useState<FinancialNote | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    control,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      title: "",
      statement: "Balance Sheet",
      year: new Date().getFullYear(),
      content: "",
      author: "System",
      summary: "",
      isDraft: true,
      relatedAccounts: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "relatedAccounts",
  });

  // Fetch notes list
  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit };
      if (search) params.q = search;
      if (statementFilter) params.statement = statementFilter;
      if (yearFilter) params.year = yearFilter;
      const res = await api.get("/reports/financial-notes", { params });
      setNotes(res.data?.data || []);
      setTotal(res.data?.total || 0);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load notes");
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, statementFilter, yearFilter]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // Expand row – fetch live balances
  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setNoteDetails(null);
      return;
    }
    setExpandedId(id);
    setDetailsLoading(true);
    try {
      const res = await api.get(`/reports/financial-notes/${id}`);
      setNoteDetails(res.data?.data);
    } catch {
      toast.error("Failed to load note details");
      setExpandedId(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  // Open form for create/edit
  const openCreate = () => {
    reset({
      title: "",
      statement: "Balance Sheet",
      year: new Date().getFullYear(),
      content: "",
      author: "System",
      summary: "",
      isDraft: true,
      relatedAccounts: [],
    });
    setEditingNote(null);
    setDialogOpen(true);
  };

  const openEdit = (note: FinancialNote) => {
    reset({
      title: note.title,
      statement: note.statement,
      year: note.year,
      content: note.versions[0]?.content || "",
      author: "System",
      summary: note.summary || "",
      isDraft: note.isDraft,
      relatedAccounts: note.relatedAccounts.map((ra) => ({
        accountId: ra.account,
        accountName: ra.name || ra.account,
      })),
    });
    setEditingNote(note);
    setDialogOpen(true);
  };

  // Submit form
  const onSubmit = async (data: FormValues) => {
    try {
      const payload = {
        ...data,
        relatedAccounts: data.relatedAccounts.map((ra) => ({ accountId: ra.accountId })),
      };
      if (editingNote) {
        await api.put(`/reports/financial-notes/${editingNote._id}`, payload);
        toast.success("Note updated");
      } else {
        await api.post("/reports/financial-notes", payload);
        toast.success("Note created");
      }
      setDialogOpen(false);
      fetchNotes();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Save failed");
    }
  };

  // Delete
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this note?")) return;
    try {
      await api.delete(`/reports/financial-notes/${id}`);
      toast.success("Note deleted");
      fetchNotes();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Delete failed");
    }
  };

  // Finalise
  const handleFinalise = async (id: string) => {
    try {
      await api.post(`/reports/financial-notes/${id}/finalise`);
      toast.success("Note finalised with current balances");
      fetchNotes();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Finalise failed");
    }
  };

  // Account picker handlers
  const addAccount = (acc: AccountOption) => {
    const current = watch("relatedAccounts") || [];
    if (!current.some((a) => a.accountId === acc.value)) {
      append({ accountId: acc.value, accountName: acc.label });
    }
  };

  const removeAccount = (accountId: string) => {
    const index = fields.findIndex((f) => f.accountId === accountId);
    if (index !== -1) remove(index);
  };

  const selectedAccounts = watch("relatedAccounts") || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-slate-100">
      <div className="mx-auto w-full max-w-7xl p-4 md:p-6">
        {/* Header */}
        <div className="mb-8 rounded-3xl border bg-white/70 backdrop-blur-sm p-6 shadow-xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-800 flex items-center gap-3">
                <BookOpen className="h-8 w-8 text-indigo-600" />
                Financial Notes
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Craft and manage detailed notes for every financial statement with full version control.
              </p>
            </div>
            <Button onClick={openCreate} className="gap-2 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200">
              <Plus className="h-4 w-4" /> New Note
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6 border-0 shadow-md bg-white/80 backdrop-blur-sm">
          <CardContent className="grid gap-4 p-5 md:grid-cols-4">
            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-600">Search</div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search notes..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="pl-9 border-slate-200 focus:border-indigo-400"
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-600">Statement</div>
              <Select value={statementFilter} onValueChange={(v) => { setStatementFilter(v); setPage(1); }}>
                <SelectTrigger className="border-slate-200">
                  <SelectValue placeholder="All Statements" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=" ">All</SelectItem>
                  {STATEMENT_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-600">Year</div>
              <Input
                type="number"
                placeholder="e.g. 2025"
                value={yearFilter}
                onChange={(e) => { setYearFilter(e.target.value); setPage(1); }}
                className="border-slate-200 focus:border-indigo-400"
              />
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={() => { setSearch(""); setStatementFilter(""); setYearFilter(""); setPage(1); }}
                className="border-slate-200 text-slate-600 hover:bg-slate-50">
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Notes Grid – Card layout for a stunning visual */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          </div>
        ) : notes.length === 0 ? (
          <Card className="border-dashed border-2 border-slate-300 bg-white/60 py-20 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center gap-4">
              <BookOpen className="h-12 w-12 text-slate-300" />
              <p className="text-lg text-muted-foreground font-medium">No financial notes yet.</p>
              <Button variant="outline" onClick={openCreate}>Create your first note</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {notes.map((note) => (
              <Card
                key={note._id}
                className={`group relative overflow-hidden border-0 shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer ${
                  expandedId === note._id ? "ring-2 ring-indigo-300" : ""
                }`}
                onClick={() => toggleExpand(note._id)}
              >
                <div className={`absolute top-0 left-0 right-0 h-1.5 ${note.isDraft ? "bg-amber-400" : "bg-emerald-400"}`} />
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">
                        {note.title}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">{note.noteNo}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); openEdit(note); }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-red-500"
                        onClick={(e) => { e.stopPropagation(); handleDelete(note._id); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium">{note.statement}</span>
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700">{note.year}</span>
                    <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 font-medium">
                      v{note.versions[0]?.versionNo || 1}
                    </span>
                  </div>
                  {note.summary && (
                    <p className="text-xs text-slate-600 line-clamp-2">{note.summary}</p>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{note.relatedAccounts.length} linked account(s)</span>
                    <span className="flex items-center gap-1">
                      {note.isDraft ? (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">Draft</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">Final</span>
                      )}
                    </span>
                  </div>
                </CardContent>
                {expandedId === note._id && (
                  <div className="border-t bg-slate-50/50 p-4" onClick={(e) => e.stopPropagation()}>
                    {detailsLoading ? (
                      <div className="flex justify-center py-6">
                        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                      </div>
                    ) : noteDetails ? (
                      <ExpandedDetails note={noteDetails} onFinalise={handleFinalise} />
                    ) : null}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > limit && (
          <div className="mt-8 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Page {page} of {Math.ceil(total / limit)} (Total {total})
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                Previous
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * limit >= total}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6 text-indigo-600" />
              {editingNote ? "Edit Note" : "New Financial Note"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="text-sm font-medium text-slate-700">Title *</label>
                <Input {...register("title", { required: true })} className="mt-1" placeholder="e.g. Inventory Valuation Note" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Statement</label>
                <Select value={watch("statement")} onValueChange={(v) => setValue("statement", v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATEMENT_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Year</label>
                <Input type="number" {...register("year", { valueAsNumber: true })} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Author</label>
                <Input {...register("author")} className="mt-1" placeholder="Your name" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Content *</label>
              <Textarea rows={10} {...register("content", { required: true })} className="mt-1 font-mono text-sm" placeholder="Write your detailed note content here... (Markdown or plain text)" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Summary</label>
              <Input {...register("summary")} className="mt-1" placeholder="Brief summary (optional)" />
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="isDraft" {...register("isDraft")} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              <label htmlFor="isDraft" className="text-sm font-medium text-slate-700">Save as Draft</label>
            </div>

            {/* Related Accounts – Dynamic Account Picker */}
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Related Accounts</label>
              <AccountPicker
                selectedIds={selectedAccounts}
                onAdd={addAccount}
                onRemove={removeAccount}
              />
            </div>

            <DialogFooter className="gap-3">
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                {editingNote ? "Update Note" : "Create Note"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* --------------------------- Expanded Details Component --------------------------- */
function ExpandedDetails({ note, onFinalise }: { note: FinancialNote; onFinalise: (id: string) => void }) {
  const latestVersion = note.versions[0];
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-800">{note.title}</h3>
        <div className="flex gap-2">
          {note.isDraft && (
            <Button size="sm" variant="outline" onClick={() => onFinalise(note._id)} className="border-emerald-300 text-emerald-700 hover:bg-emerald-50">
              <BadgeCheck className="mr-1 h-4 w-4" /> Finalise
            </Button>
          )}
          <GlobalPrintButton
            contentHtml={buildPrintHtml(note)}
            headerRightHtml={`<div style="text-align:right;"><div style="font-size:20px;font-weight:800;">${note.noteNo}</div></div>`}
            label="Print"
            title="Financial Note"
            orientation="portrait"
            company={{ name: "Antab Agro LTD", address: "123 Agro Street, Dhaka", phone: "+880 1711-111111", email: "info@antabagro.com" }}
            showHeader={false}
            showFooter={false}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><span className="text-muted-foreground">Statement:</span> {note.statement}</div>
        <div><span className="text-muted-foreground">Year:</span> {note.year}</div>
        <div className="col-span-2"><span className="text-muted-foreground">Summary:</span> {note.summary || "-"}</div>
      </div>

      {/* Latest Version */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-indigo-700 mb-2">
          <Clock className="h-4 w-4" /> Version {latestVersion?.versionNo} (current)
        </div>
        <div className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">{latestVersion?.content}</div>
        <div className="mt-3 text-xs text-muted-foreground">
          By {latestVersion?.author} on {formatDate(latestVersion?.createdAt)}
        </div>
      </div>

      {/* Related Accounts */}
      <div>
        <h4 className="text-sm font-semibold text-slate-700 mb-2">Linked Accounts</h4>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead className="text-right">Snapshot Balance</TableHead>
              <TableHead className="text-right">Current Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {note.relatedAccounts.map((ra, i) => (
              <TableRow key={i}>
                <TableCell className="text-xs font-medium">{ra.name || ra.account}</TableCell>
                <TableCell className="text-right">{money(ra.snapshotBalance)}</TableCell>
                <TableCell className="text-right">{money(ra.currentBalance || ra.snapshotBalance)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Older Versions Timeline */}
      {note.versions.length > 1 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-indigo-600 hover:text-indigo-800">
            View older versions ({note.versions.length - 1})
          </summary>
          <div className="mt-3 space-y-4 pl-4 border-l-2 border-indigo-100">
            {note.versions.slice(1).map((v) => (
              <div key={v._id || v.versionNo} className="relative pl-6">
                <div className="absolute -left-[13px] top-1.5 h-3 w-3 rounded-full bg-indigo-200 border-2 border-white" />
                <div className="rounded-xl border bg-white p-4 shadow-sm">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span className="font-semibold">Version {v.versionNo}</span>
                    <span>{v.author} · {formatDate(v.createdAt)}</span>
                  </div>
                  <div className="whitespace-pre-wrap text-sm text-slate-700">{v.content}</div>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}