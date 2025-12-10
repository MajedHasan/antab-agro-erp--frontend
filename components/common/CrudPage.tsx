"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { SmartTable } from "./SmartTable";
import { useCrud } from "@/hooks/useCrud";

type MetaFetcher = { key: string; fn: () => Promise<any> };

export function CrudPage({
  model,
  title,
  formComponent: Form,
  columns,
  metaFetchers = [] as MetaFetcher[],
  renderActions,
}: any) {
  const {
    data,
    loading,
    total,
    page,
    limit,
    q,
    setQ,
    pageHandler,
    fetchAll,
    save,
    remove,
    getOne,
    editing,
    setEditing,
    sort,
    setSort,
    selectedIds,
    toggleSelect,
    clearSelection,
    bulkDelete,
  } = useCrud(model);

  const [open, setOpen] = useState(false);
  const [meta, setMeta] = useState<Record<string, any>>({});
  const [viewItem, setViewItem] = useState<any | null>(null);

  useEffect(() => {
    if (!metaFetchers?.length) return;
    Promise.all(
      metaFetchers.map((m) =>
        m.fn().then((r) => ({ key: m.key, val: r.data?.data ?? r.data }))
      )
    )
      .then((arr) => {
        const obj: Record<string, any> = {};
        arr.forEach((x) => (obj[x.key] = x.val));
        setMeta(obj);
      })
      .catch((err) => console.error("meta fetch", err));
  }, [metaFetchers]);

  const handleSaved = () => {
    setOpen(false);
    setEditing(null);
    fetchAll();
    toast.success("Saved");
  };

  const handleEdit = async (row: any) => {
    const fresh = await getOne(row._id);
    setEditing(fresh);
    setOpen(true);
  };

  const handleView = async (row: any) => {
    const fresh = await getOne(row._id);
    setViewItem(fresh);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete item?")) return;
    try {
      await remove(id);
      toast.success("Deleted");
    } catch (err) {
      toast.error("Delete failed");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return toast.warn("No items selected");
    if (!confirm("Delete selected items?")) return;
    try {
      await bulkDelete(Array.from(selectedIds));
      toast.success("Deleted selected");
      clearSelection();
    } catch (err) {
      toast.error("Bulk delete failed");
    }
  };

  const finalColumns = useMemo(() => {
    // if columns already include actions, keep them; otherwise append actions column handled by SmartTable render
    return columns;
  }, [columns]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{title}</h1>
        <div className="flex items-center gap-2">
          <Input
            placeholder={`Search ${title}...`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-[300px]"
          />

          {/* simple filters example: pass in renderActions to add more */}
          {renderActions &&
            renderActions({ setSort, sort, selectedIds, handleBulkDelete })}

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Add
              </Button>
            </DialogTrigger>
            <DialogContent>
              <h2 className="text-lg font-semibold mb-2">
                {editing
                  ? `Edit ${title.slice(0, -1)}`
                  : `Add ${title.slice(0, -1)}`}
              </h2>
              <Form defaultValues={editing} onSaved={handleSaved} {...meta} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <SmartTable
        columns={finalColumns}
        data={data}
        loading={loading}
        total={total}
        page={page}
        limit={limit}
        onPageChange={(p) => pageHandler(p)}
        selectable
        selectedIds={selectedIds}
        onToggleSelect={(id: string) => toggleSelect(id)}
        onSelectAll={(checked: boolean) => {
          if (checked) {
            // select all visible
            const ids = new Set(data.map((r: any) => r._id));
            // replace selection
            ids.forEach((id) => toggleSelect(id)); // toggleSelect expects add/remove so we call differently below
            // simpler: replace directly (workaround)
            // @ts-ignore
            (window as any).__selection = ids;
          } else {
            // clear directly
            clearSelection();
          }
        }}
        onSortChange={(key: string, direction: "asc" | "desc") => {
          // convert to backend sort format: '-' prefix for desc
          setSort(direction === "desc" ? `-${key}` : key);
        }}
        sortKey={sort?.replace(/^-/, "")}
        sortDirection={sort?.startsWith("-") ? "desc" : "asc"}
      />

      {/* View modal (show nicer details - replace with UI later) */}
      <Dialog open={!!viewItem} onOpenChange={() => setViewItem(null)}>
        <DialogContent>
          <h2 className="text-lg font-semibold mb-2">Details</h2>
          {viewItem ? (
            <div className="space-y-2 text-sm">
              <div>
                <strong>Name:</strong> {viewItem.name}
              </div>
              <div>
                <strong>Email:</strong> {viewItem.email}
              </div>
              <div>
                <strong>Role:</strong> {viewItem.role?.name ?? viewItem.role}
              </div>
              <div>
                <strong>Department:</strong> {viewItem.department}
              </div>
              <div>
                <strong>Permissions:</strong>{" "}
                {(viewItem.permissions || []).join(", ")}
              </div>
              <pre className="text-xs text-muted-foreground">
                {JSON.stringify(viewItem, null, 2)}
              </pre>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
