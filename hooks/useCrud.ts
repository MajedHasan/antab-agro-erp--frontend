"use client";

import { useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";

/**
 * useCrud - generic client-side CRUD hook with:
 * - debounced search
 * - server-side pagination/sort/filters
 * - keep-old-data while loading (no blink)
 * - bulk selection helpers
 */
export function useCrud(model: string, opts: { defaultLimit?: number } = {}) {
  const defaultLimit = opts.defaultLimit ?? 15;

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(defaultLimit);
  const [total, setTotal] = useState(0);

  const [sort, setSort] = useState<string | undefined>(undefined);
  const [filters, setFilters] = useState<Record<string, any> | undefined>(
    undefined
  );

  const [editing, setEditing] = useState<any | null>(null);

  // selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // internal refs for debouncing/aborting
  const fetchIdRef = useRef(0);
  const debounceRef = useRef<number | null>(null);

  function toggleSelect(id: string) {
    setSelectedIds((s) => {
      const clone = new Set(s);
      if (clone.has(id)) clone.delete(id);
      else clone.add(id);
      return clone;
    });
  }
  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function fetchAll(extra: Record<string, any> = {}) {
    const fetchId = ++fetchIdRef.current;
    // keep old data until response returns (no blink)
    setLoading(true);
    try {
      const params: Record<string, any> = {
        q: q || undefined,
        page,
        limit,
        sort: sort || undefined,
        ...filters,
        ...extra,
      };

      const res = await api.get(`/${model}`, { params });
      if (fetchId !== fetchIdRef.current) return; // stale
      const payload = res.data?.data ?? res.data?.rows ?? res.data ?? [];
      setData(Array.isArray(payload) ? payload : payload.items ?? []);
      const totalVal =
        res.data?.total ??
        res.data?.meta?.total ??
        (Array.isArray(payload) ? payload.length : 0);
      setTotal(Number(totalVal ?? 0));
    } catch (err: any) {
      console.error("fetchAll error", err);
      toast.error(`Failed to load ${model}`);
    } finally {
      if (fetchId === fetchIdRef.current) setLoading(false);
    }
  }

  // debounce q & filters & sort changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // reset page on query/filter/sort change
    setPage(1);
    // @ts-ignore
    debounceRef.current = setTimeout(() => {
      fetchAll();
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, JSON.stringify(filters), sort]);

  // page change triggers immediate fetch
  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function getOne(id: string) {
    const res = await api.get(`/${model}/${id}`);
    return res.data?.data ?? res.data ?? null;
  }

  async function save(payload: any, id?: string) {
    try {
      if (id) await api.put(`/${model}/${id}`, payload);
      else await api.post(`/${model}`, payload);
      await fetchAll();
      return true;
    } catch (err: any) {
      console.error("save error", err);
      throw err;
    }
  }

  async function remove(id: string, isHard: boolean = false) {
    try {
      await api.delete(`/${model}/${id}?hard=${isHard}`);
      // if single delete was in selected, clear it
      setSelectedIds((s) => {
        const clone = new Set(s);
        clone.delete(id);
        return clone;
      });
      await fetchAll();
      return true;
    } catch (err: any) {
      console.error("remove error", err);
      throw err;
    }
  }

  async function bulkDelete(ids: string[]) {
    // backend should support bulk delete route or call delete in loop
    try {
      await api.post(`/${model}/bulk-delete`, { ids });
      clearSelection();
      await fetchAll();
      return true;
    } catch (err) {
      // fallback: send individual deletes if endpoint missing (optional)
      console.error(err);
      throw err;
    }
  }

  return {
    data,
    loading,
    total,
    page,
    limit,
    q,
    setQ,
    pageHandler: setPage,
    fetchAll,
    save,
    remove,
    getOne,
    editing,
    setEditing,
    sort,
    setSort,
    filters,
    setFilters,
    selectedIds,
    toggleSelect,
    clearSelection,
    bulkDelete,
  };
}
