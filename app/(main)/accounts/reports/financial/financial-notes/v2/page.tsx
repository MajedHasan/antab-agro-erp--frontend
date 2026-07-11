// app/accounts/reports/financial-reports/financial-statement-notes/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Download, Printer, Eye, Trash2, Plus } from "lucide-react";

type StatementType =
  | "Balance Sheet"
  | "Income Statement"
  | "Cash Flow"
  | "Equity Statement"
  | "Notes";

type RelatedAccount = {
  code: string;
  name: string;
  balance: number; // signed
};

type NoteVersion = {
  id: string;
  versionNo: number;
  content: string;
  author: string;
  createdAt: string;
};

type FinancialNote = {
  id: string;
  noteNo: string;
  title: string;
  statement: StatementType;
  year: number;
  summary?: string;
  relatedAccounts: RelatedAccount[];
  versions: NoteVersion[]; // latest first
  isDraft?: boolean;
};

const STORAGE_KEY = "demo_fin_statement_notes_v1";

/* ----------------- Demo data ----------------- */
function uid(prefix = "") {
  return prefix + Math.random().toString(36).slice(2, 9);
}

const DEMO_NOTES: FinancialNote[] = [
  {
    id: "n1",
    noteNo: "1",
    title: "Property, Plant & Equipment (PPE)",
    statement: "Balance Sheet",
    year: 2025,
    summary: "Summary of PPE carrying amounts, depreciation and movements.",
    relatedAccounts: [
      { code: "1001", name: "Land", balance: 5_000_000 },
      { code: "1002", name: "Buildings", balance: 12_000_000 },
      { code: "1003", name: "Plant & Machinery", balance: 3_500_000 },
    ],
    versions: [
      {
        id: uid("v_"),
        versionNo: 2,
        content:
          "**Carrying amount:** PPE is carried at cost less accumulated depreciation and impairment. \n\n**Depreciation policy:** Depreciation is charged on a straight-line basis over the estimated useful life of the asset. \n\n**Revaluations:** No revaluations were made during the year.",
        author: "Finance Manager",
        createdAt: new Date().toISOString(),
      },
      {
        id: uid("v_"),
        versionNo: 1,
        content: "Initial disclosure for PPE.",
        author: "Accountant",
        createdAt: new Date(
          Date.now() - 1000 * 60 * 60 * 24 * 60
        ).toISOString(),
      },
    ],
  },
  {
    id: "n2",
    noteNo: "2",
    title: "Borrowings and Bank Facilities",
    statement: "Balance Sheet",
    year: 2025,
    summary: "Details on bank loans, interest rates and covenants.",
    relatedAccounts: [
      { code: "2100", name: "Short Term Loan", balance: -500_000 },
      { code: "2110", name: "Long Term Loan", balance: -2_000_000 },
    ],
    versions: [
      {
        id: uid("v_"),
        versionNo: 1,
        content:
          "Borrowings are measured at amortized cost. The company has undrawn committed facilities of INR 10,000,000 at year end.",
        author: "CFO",
        createdAt: new Date().toISOString(),
      },
    ],
  },
  {
    id: "n3",
    noteNo: "1",
    title: "Revenue Recognition",
    statement: "Income Statement",
    year: 2025,
    summary:
      "Principles used to recognize revenue from sale of goods and services.",
    relatedAccounts: [
      { code: "4000", name: "Sales Revenue", balance: -6_000_000 },
    ],
    versions: [
      {
        id: uid("v_"),
        versionNo: 1,
        content:
          "Revenue is recognized when control of goods or services is transferred to the customer, at the transaction price, net of discounts and returns.",
        author: "Controller",
        createdAt: new Date().toISOString(),
      },
    ],
  },
];

/* ----------------- Utilities ----------------- */

const currency = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Math.abs(n));

function drCrLabel(n: number) {
  if (Math.abs(n) < 0.005) return "-";
  return `${currency(n)} ${n >= 0 ? "DR" : "CR"}`;
}

// tiny markdown-ish converter for bold/italic and paragraphs (safe-ish)
function simpleMarkdownToHtml(md?: string) {
  if (!md) return "";
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let html = esc(md);
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/_(.+?)_/g, "<em>$1</em>");
  // paragraphs: split by two newlines
  const paragraphs = html
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`);
  return paragraphs.join("");
}

/* ----------------- Component ----------------- */

export default function FinancialStatementNotesPage() {
  const [notes, setNotes] = useState<FinancialNote[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as FinancialNote[];
    } catch {}
    return DEMO_NOTES;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    } catch {}
  }, [notes]);

  // UI state
  const [query, setQuery] = useState("");
  const [yearFilter, setYearFilter] = useState<number | "All">("All");
  const [statementFilter, setStatementFilter] = useState<StatementType | "All">(
    "All"
  );
  const [viewing, setViewing] = useState<FinancialNote | null>(null);
  const [editing, setEditing] = useState<FinancialNote | null>(null);
  const [openCreate, setOpenCreate] = useState(false);

  // derived
  const years = useMemo(() => {
    const s = new Set<number>();
    notes.forEach((n) => s.add(n.year));
    return Array.from(s).sort((a, b) => b - a);
  }, [notes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.filter((n) => {
      if (yearFilter !== "All" && n.year !== yearFilter) return false;
      if (statementFilter !== "All" && n.statement !== statementFilter)
        return false;
      if (!q) return true;
      return (
        n.noteNo.toLowerCase().includes(q) ||
        n.title.toLowerCase().includes(q) ||
        (n.summary ?? "").toLowerCase().includes(q) ||
        n.versions.some((v) => v.content.toLowerCase().includes(q))
      );
    });
  }, [notes, query, yearFilter, statementFilter]);

  /* --------- View / Export / Print single note --------- */

  function exportNoteCsv(n: FinancialNote) {
    const header = [
      "NoteNo",
      "Title",
      "Statement",
      "Year",
      "VersionNo",
      "Author",
      "CreatedAt",
      "Content",
    ];
    const rows = [header.join(",")];
    n.versions.forEach((v) => {
      rows.push(
        [
          n.noteNo,
          `"${n.title.replace(/"/g, '""')}"`,
          n.statement,
          String(n.year),
          String(v.versionNo),
          v.author,
          v.createdAt,
          `"${v.content.replace(/"/g, '""')}"`,
        ].join(",")
      );
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${n.noteNo}_financial_note.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printNote(n: FinancialNote) {
    const latest = n.versions[0];
    const accountsHtml = n.relatedAccounts.length
      ? `<table style="width:100%;border-collapse:collapse;margin-top:12px"><thead><tr><th style="padding:6px;border:1px solid #ddd;text-align:left">Code</th><th style="padding:6px;border:1px solid #ddd;text-align:left">Account</th><th style="padding:6px;border:1px solid #ddd;text-align:right">Balance</th></tr></thead><tbody>${n.relatedAccounts
          .map(
            (a) =>
              `<tr><td style="padding:6px;border:1px solid #ddd">${
                a.code
              }</td><td style="padding:6px;border:1px solid #ddd">${
                a.name
              }</td><td style="padding:6px;border:1px solid #ddd;text-align:right">${drCrLabel(
                a.balance
              )}</td></tr>`
          )
          .join("")}</tbody></table>`
      : "";

    const html = `
      <html>
        <head><title>${n.noteNo} - ${n.title}</title></head>
        <body style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,'Helvetica Neue',Arial;padding:24px">
          <h1 style="margin:0">${n.noteNo} — ${n.title}</h1>
          <div style="margin-top:6px;color:#555">${n.statement} • ${
      n.year
    }</div>
          <hr style="margin:12px 0"/>
          <div style="margin-top:8px">${simpleMarkdownToHtml(
            latest.content
          )}</div>
          ${accountsHtml}
          <div style="margin-top:18px;font-size:12px;color:#666">Prepared by: ${
            latest.author
          } • Saved: ${latest.createdAt}</div>
        </body>
      </html>
    `;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.print();
  }

  /* --------- Export/print list --------- */

  function exportAllCsv(list: FinancialNote[]) {
    const header = [
      "NoteNo",
      "Title",
      "Statement",
      "Year",
      "LatestVersionNo",
      "LatestAuthor",
      "LatestCreatedAt",
      "Summary",
    ];
    const rows = [header.join(",")];
    list.forEach((n) => {
      const latest = n.versions[0];
      rows.push(
        [
          n.noteNo,
          `"${n.title.replace(/"/g, '""')}"`,
          n.statement,
          String(n.year),
          String(latest.versionNo),
          latest.author,
          latest.createdAt,
          `"${(n.summary ?? "").replace(/"/g, '""')}"`,
        ].join(",")
      );
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financial_notes_list.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printAll(list: FinancialNote[]) {
    const htmlNotes = list
      .map((n) => {
        const latest = n.versions[0];
        return `<div style="page-break-after:always"><h2 style="margin:0">${
          n.noteNo
        } — ${n.title}</h2><div style="color:#555">${n.statement} • ${
          n.year
        }</div><div style="margin-top:8px">${simpleMarkdownToHtml(
          latest.content
        )}</div></div>`;
      })
      .join("");
    const html = `<html><head><title>Financial Notes</title></head><body style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,'Helvetica Neue',Arial;padding:20px">${htmlNotes}</body></html>`;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.print();
  }

  /* --------- Simple create note modal (client/demo) --------- */
  const emptyNote = (): FinancialNote => ({
    id: uid("n_"),
    noteNo: String(notes.length + 1),
    title: "",
    statement: "Notes",
    year: new Date().getFullYear(),
    summary: "",
    relatedAccounts: [],
    versions: [
      {
        id: uid("v_"),
        versionNo: 1,
        content: "",
        author: "Demo User",
        createdAt: new Date().toISOString(),
      },
    ],
    isDraft: true,
  });

  const [form, setForm] = useState<FinancialNote>(emptyNote());

  useEffect(() => {
    if (!openCreate) setForm(emptyNote());
  }, [openCreate]); // eslint-disable-line

  function openNew() {
    setForm(emptyNote());
    setEditing(null);
    setOpenCreate(true);
  }

  function openEdit(n: FinancialNote) {
    setForm(JSON.parse(JSON.stringify(n)));
    setEditing(n);
    setOpenCreate(true);
  }

  function saveForm(asDraft = false) {
    if (!form.title.trim()) {
      alert("Please enter a title.");
      return;
    }
    const now = new Date().toISOString();
    const versionNo = (form.versions[0]?.versionNo ?? 0) + 1;
    const newVersion: NoteVersion = {
      id: uid("v_"),
      versionNo,
      content: form.versions[0].content,
      author: "Demo User",
      createdAt: now,
    };
    const noteToSave: FinancialNote = {
      ...form,
      isDraft: asDraft,
      versions: [newVersion, ...(form.versions.slice(1) ?? [])],
    };
    setNotes((prev) => {
      const found = prev.find((p) => p.id === noteToSave.id);
      if (found)
        return prev.map((p) => (p.id === noteToSave.id ? noteToSave : p));
      return [noteToSave, ...prev];
    });
    setOpenCreate(false);
    alert("Note saved (demo). Replace with API calls.");
  }

  function deleteNote(id: string) {
    if (!confirm("Delete this note?")) return;
    setNotes((s) => s.filter((n) => n.id !== id));
    setViewing(null);
  }

  /* ---------------- Render ---------------- */

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">Financial Statement Notes</h1>
          <p className="mt-1 text-sm text-slate-500">
            Notes that accompany your financial statements (Balance Sheet,
            Income Statement, Cash Flow, Equity).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" /> New Note
          </Button>
          <Button variant="outline" onClick={() => exportAllCsv(filtered)}>
            <Download className="mr-2 h-4 w-4" />
            Export List
          </Button>
          <Button variant="secondary" onClick={() => printAll(filtered)}>
            <Printer className="mr-2 h-4 w-4" />
            Print All
          </Button>
        </div>
      </header>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <Label>Search</Label>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search note no, title or content..."
            />
          </div>

          <div>
            <Label>Year</Label>
            <Select
              onValueChange={(v) =>
                setYearFilter(v === "All" ? "All" : Number(v))
              }
              defaultValue={"All"}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All</SelectItem>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
                <SelectItem value={String(new Date().getFullYear())}>
                  {new Date().getFullYear()}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Statement</Label>
            <Select
              onValueChange={(v) => setStatementFilter(v as any)}
              defaultValue={"All"}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All</SelectItem>
                <SelectItem value="Balance Sheet">Balance Sheet</SelectItem>
                <SelectItem value="Income Statement">
                  Income Statement
                </SelectItem>
                <SelectItem value="Cash Flow">Cash Flow</SelectItem>
                <SelectItem value="Equity Statement">
                  Equity Statement
                </SelectItem>
                <SelectItem value="Notes">Notes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setQuery("");
                setYearFilter("All");
                setStatementFilter("All");
              }}
            >
              Clear
            </Button>
            <div className="text-sm text-slate-500">
              Showing <strong>{filtered.length}</strong> notes
            </div>
          </div>
        </div>
      </Card>

      {/* Notes list + preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {filtered.length === 0 && (
            <Card className="p-6 text-center text-slate-500">
              No notes found.
            </Card>
          )}
          {filtered.map((n) => {
            const latest = n.versions[0];
            return (
              <Card key={n.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-baseline gap-3">
                      <div className="text-sm text-slate-500">{n.noteNo}</div>
                      <h2 className="text-lg font-semibold">{n.title}</h2>
                      <div className="ml-3 px-2 py-1 text-xs rounded bg-slate-100 text-slate-600">
                        {n.statement} • {n.year}
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 mt-2">{n.summary}</p>
                    <div className="mt-3 text-sm">
                      <strong>Latest:</strong> v{latest.versionNo} •{" "}
                      <span className="text-slate-500">
                        By {latest.author} on{" "}
                        {new Date(latest.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {n.relatedAccounts.length > 0 && (
                      <div className="mt-3 text-sm text-slate-600">
                        Related accounts: {n.relatedAccounts.length}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => setViewing(n)}>
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                      <Button variant="outline" onClick={() => openEdit(n)}>
                        <Download className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button variant="ghost" onClick={() => exportNoteCsv(n)}>
                        <Download className="h-4 w-4 mr-2" />
                        CSV
                      </Button>
                      <Button variant="outline" onClick={() => printNote(n)}>
                        <Printer className="h-4 w-4 mr-2" />
                        Print
                      </Button>
                    </div>
                    <div className="text-sm text-slate-500">
                      Accounts: {n.relatedAccounts.length}
                    </div>
                  </div>
                </div>

                {/* small related accounts preview */}
                {n.relatedAccounts.length > 0 && (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-slate-500 text-xs">
                        <tr>
                          <th className="text-left px-2">Code</th>
                          <th className="text-left px-2">Account</th>
                          <th className="text-right px-2">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {n.relatedAccounts.map((a) => (
                          <tr key={a.code} className="border-t">
                            <td className="px-2 py-2">{a.code}</td>
                            <td className="px-2 py-2">{a.name}</td>
                            <td className="px-2 py-2 text-right">
                              {drCrLabel(a.balance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {/* Right column */}
        <aside className="space-y-4">
          <Card className="p-4">
            <div className="text-sm text-slate-500">Quick Preview</div>
            {filtered[0] ? (
              <>
                <div className="mt-3">
                  <div className="text-xs text-slate-400">Note</div>
                  <div className="font-medium">
                    {filtered[0].noteNo} — {filtered[0].title}
                  </div>
                  <div className="text-sm text-slate-500 mt-1">
                    v{filtered[0].versions[0].versionNo} •{" "}
                    {filtered[0].versions[0].author}
                  </div>
                </div>
                <div
                  className="mt-3 text-sm prose max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: simpleMarkdownToHtml(
                      filtered[0].versions[0].content
                    ),
                  }}
                />
              </>
            ) : (
              <div className="mt-3 text-sm text-slate-500">
                Select a note to preview its latest content.
              </div>
            )}
          </Card>

          <Card className="p-4">
            <div className="text-sm text-slate-500">Guidance</div>
            <ul className="list-disc ml-5 text-sm mt-2 text-slate-600">
              <li>
                Use concise titles and include a short summary for the statement
                reader.
              </li>
              <li>
                Link note to specific account codes to show amounts in the
                statements.
              </li>
              <li>
                Use versions for audit trail — each save creates a new version
                (demo).
              </li>
            </ul>
          </Card>
        </aside>
      </div>

      {/* View Dialog */}
      <Dialog
        open={!!viewing}
        onOpenChange={(open) => !open && setViewing(null)}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {viewing?.noteNo} — {viewing?.title}
            </DialogTitle>
            <DialogDescription>{viewing?.summary}</DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div>
              <div className="text-xs text-slate-500">Statement</div>
              <div className="font-medium">
                {viewing?.statement} • {viewing?.year}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Latest version</div>
              <div
                className="mt-2 prose max-w-none"
                dangerouslySetInnerHTML={{
                  __html: simpleMarkdownToHtml(
                    viewing?.versions[0].content ?? ""
                  ),
                }}
              />
              <div className="text-xs text-slate-400 mt-2">
                Prepared by: {viewing?.versions[0].author} •{" "}
                {viewing?.versions[0].createdAt}
              </div>
            </div>

            {viewing?.relatedAccounts.length ? (
              <div>
                <div className="text-xs text-slate-500">Related accounts</div>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-slate-500">
                      <tr>
                        <th className="text-left px-2">Code</th>
                        <th className="text-left px-2">Account</th>
                        <th className="text-right px-2">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewing.relatedAccounts.map((a) => (
                        <tr key={a.code} className="border-t">
                          <td className="px-2 py-2">{a.code}</td>
                          <td className="px-2 py-2">{a.name}</td>
                          <td className="px-2 py-2 text-right">
                            {drCrLabel(a.balance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div className="flex items-center gap-2 justify-end">
              <Button variant="ghost" onClick={() => setViewing(null)}>
                Close
              </Button>
              <Button onClick={() => viewing && exportNoteCsv(viewing)}>
                Export CSV
              </Button>
              <Button
                variant="outline"
                onClick={() => viewing && printNote(viewing)}
              >
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
              <Button
                variant="destructive"
                onClick={() => viewing && deleteNote(viewing.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create / Edit Dialog */}
      <Dialog open={openCreate} onOpenChange={(open) => setOpenCreate(open)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Note" : "Create Note"}</DialogTitle>
            <DialogDescription>
              Notes support **bold** and _italic_. Save creates a new version
              (demo).
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Note No</Label>
                <Input
                  value={form.noteNo}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, noteNo: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Title</Label>
                <Input
                  value={form.title}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, title: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Statement</Label>
                <select
                  className="w-full border rounded-md px-3 py-2"
                  value={form.statement}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      statement: e.target.value as StatementType,
                    }))
                  }
                >
                  <option>Balance Sheet</option>
                  <option>Income Statement</option>
                  <option>Cash Flow</option>
                  <option>Equity Statement</option>
                  <option>Notes</option>
                </select>
              </div>
              <div>
                <Label>Year</Label>
                <Input
                  type="number"
                  value={form.year}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, year: Number(e.target.value) }))
                  }
                />
              </div>
            </div>

            <div>
              <Label>Summary</Label>
              <Input
                value={form.summary}
                onChange={(e) =>
                  setForm((s) => ({ ...s, summary: e.target.value }))
                }
              />
            </div>

            <div>
              <Label>Related accounts (simple)</Label>
              <div className="space-y-2 mt-2">
                {form.relatedAccounts.map((ra, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Input
                      placeholder="Code"
                      value={ra.code}
                      onChange={(e) => {
                        const copy = [...form.relatedAccounts];
                        copy[idx].code = e.target.value;
                        setForm((s) => ({ ...s, relatedAccounts: copy }));
                      }}
                    />
                    <Input
                      placeholder="Name"
                      value={ra.name}
                      onChange={(e) => {
                        const copy = [...form.relatedAccounts];
                        copy[idx].name = e.target.value;
                        setForm((s) => ({ ...s, relatedAccounts: copy }));
                      }}
                    />
                    <Input
                      placeholder="Balance"
                      type="number"
                      value={ra.balance}
                      onChange={(e) => {
                        const copy = [...form.relatedAccounts];
                        copy[idx].balance = Number(e.target.value);
                        setForm((s) => ({ ...s, relatedAccounts: copy }));
                      }}
                    />
                    <button
                      className="text-rose-600"
                      onClick={() => {
                        const copy = form.relatedAccounts.filter(
                          (_, i) => i !== idx
                        );
                        setForm((s) => ({ ...s, relatedAccounts: copy }));
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <div>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setForm((s) => ({
                        ...s,
                        relatedAccounts: [
                          ...s.relatedAccounts,
                          { code: "", name: "", balance: 0 },
                        ],
                      }))
                    }
                  >
                    Add account
                  </Button>
                </div>
              </div>
            </div>

            <div>
              <Label>Note content (supports **bold** and _italic_)</Label>
              <Textarea
                rows={8}
                value={form.versions[0].content}
                onChange={(e) =>
                  setForm((s) => ({
                    ...s,
                    versions: [
                      { ...s.versions[0], content: e.target.value },
                      ...s.versions.slice(1),
                    ],
                  }))
                }
              />
            </div>

            <div className="flex items-center gap-2 justify-end">
              <Button variant="outline" onClick={() => setOpenCreate(false)}>
                Cancel
              </Button>
              <Button onClick={() => saveForm(false)}>Save & Publish</Button>
              <Button variant="ghost" onClick={() => saveForm(true)}>
                Save Draft
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
