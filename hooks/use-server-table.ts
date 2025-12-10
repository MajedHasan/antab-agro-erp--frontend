// src/hooks/use-server-table.ts
import { useEffect, useState, useCallback } from "react";
import authApi from "@/lib/api";

type QueryOpts = {
  endpoint: string; // e.g. "/roles"
  initialPage?: number;
  initialPageSize?: number;
  defaultParams?: Record<string, any>;
};

export function useServerTable({
  endpoint,
  initialPage = 1,
  initialPageSize = 20,
  defaultParams = {},
}: QueryOpts) {
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [params, setParams] = useState(defaultParams);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authApi.get(endpoint, {
        params: { q, page, limit: pageSize, sort: sortBy, ...params },
      });
      // backend contract: { data: [], total: number } or adapt:
      const respData = res.data.data ?? res.data.items ?? res.data;
      const respTotal = res.data.total ?? res.data.meta?.total ?? null;
      setData(respData);
      setTotal(respTotal);
    } catch (err) {
      console.error("server table fetch", err);
    } finally {
      setLoading(false);
    }
  }, [endpoint, page, pageSize, q, sortBy, params]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return {
    data,
    loading,
    total,
    page,
    setPage,
    pageSize,
    setPageSize,
    q,
    setQ,
    sortBy,
    setSortBy,
    setParams,
    refresh: fetch,
  };
}
