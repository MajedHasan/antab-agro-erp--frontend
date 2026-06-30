// app/inventory/material-wip/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import api from "@/lib/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
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
  Search,
  Plus,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Play,
  CheckCircle,
  Eye,
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  Package,
  ChartLine,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------- types ---------- */
type RawMaterial = { _id: string; name: string; sku?: string; unit: string };
type Factory = { _id: string; name: string; code?: string };
type MaterialWIP = {
  _id: string;
  factoryId: string | Factory;
  rawMaterialId: string | RawMaterial;
  date?: string;
  initialQuantity: number;
  remainingQuantity: number;
  unit: string;
  unitCost?: number;
  startCost?: number;
  issuedQuantity: number;
  returnedQuantity: number;
  consumedQuantity: number;
  expectedRawUsed: number;
  allowedWastageRawUsed: number;
  actualRawUsed: number;
  gainQuantity: number;
  normalWastageQuantity: number;
  productionLossQuantity: number;
  rawMaterialCost: number;
  packagingMaterialCost: number;
  otherMaterialCost: number;
  totalInputCost: number;
  totalFinishedGoodsCost: number;
  status: "ACTIVE" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
  conversions?: any[];
  pendingConversion?: any;
  createdBy?: { name: string };
  approvedBy?: { name: string };
  approvedAt?: string;
  createdAt?: string;
};

/* ---------- helpers ---------- */
const nameOf = (maybe: any) => {
  if (!maybe) return "-";
  if (typeof maybe === "string") return maybe;
  return maybe.name || maybe._id || "-";
};

const statusBadge = (status: MaterialWIP["status"]) => {
  const map: Record<string, string> = {
    ACTIVE: "bg-blue-50 text-blue-700 border-blue-200",
    PENDING_APPROVAL: "bg-amber-50 text-amber-700 border-amber-200",
    APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    REJECTED: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <Badge className={cn("font-normal text-xs", map[status])}>
      {status === "PENDING_APPROVAL" ? "PENDING" : status}
    </Badge>
  );
};

export default function MaterialWipListPage() {
  const router = useRouter();

  const [wips, setWips] = useState<MaterialWIP[]>([]);
  const [loading, setLoading] = useState(false);
  const [factories, setFactories] = useState<Factory[]>([]);

  // Filters
  const [search, setSearch] = useState("");
  const [factoryFilter, setFactoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [total, setTotal] = useState(0);

  // Summary from backend
  const [summary, setSummary] = useState<any>(null);

  // Load factories
  useEffect(() => {
    api
      .get("/warehouses", { params: { type: "Factory", limit: 1000 } })
      .then((res) => setFactories(res.data?.data || []))
      .catch(() => {});
  }, []);

  const fetchWips = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {
        page,
        limit,
        factoryId: factoryFilter !== "all" ? factoryFilter : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        q: search.trim() || undefined,
      };
      const res = await api.get("/material-wip", { params });
      // The backend returns { success: true, data: [...], total, page, limit, summary }
      setWips(res.data?.data || []);
      setTotal(res.data?.total || 0);
      setSummary(res.data?.summary || null);
    } catch (err) {
      toast.error("Failed to load WIP records");
    } finally {
      setLoading(false);
    }
  }, [page, limit, factoryFilter, statusFilter, fromDate, toDate, search]);

  useEffect(() => {
    fetchWips();
  }, [fetchWips]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="p-6 max-w-full mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Material WIP</h1>
          <p className="text-sm text-gray-500 mt-1">Track work in progress, start new batches, and manage approvals.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => router.push("/inventory/material-wip/report")} className="gap-2 bg-gray-900 hover:bg-gray-800 text-white shadow-sm">
            <ChartLine className="h-4 w-4" /> Report
          </Button>
          <Button onClick={() => router.push("/inventory/material-wip/create")} className="gap-2 bg-gray-900 hover:bg-gray-800 text-white shadow-sm">
            <Plus className="h-4 w-4" /> Start New WIP
          </Button>
        </div>
      </div>

      {/* Summary Cards (from backend aggregation) */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-xs text-gray-500 uppercase tracking-wide">Active</div>
              <div className="text-lg font-semibold">{summary.activeCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-xs text-gray-500 uppercase tracking-wide">Pending</div>
              <div className="text-lg font-semibold">{summary.pendingCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-xs text-gray-500 uppercase tracking-wide">Approved</div>
              <div className="text-lg font-semibold">{summary.approvedCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-xs text-gray-500 uppercase tracking-wide">Total Issued</div>
              <div className="text-lg font-semibold">{summary.totalIssuedQuantity ?? 0}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="shadow-sm border-gray-200">
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by name or ID..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 h-9 border-gray-200"
            />
          </div>
          <Select value={factoryFilter} onValueChange={(v) => { setFactoryFilter(v); setPage(1); }}>
            <SelectTrigger className="h-9 border-gray-200"><SelectValue placeholder="All factories" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All factories</SelectItem>
              {factories.map((f) => (
                <SelectItem key={f._id} value={f._id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="h-9 border-gray-200"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="PENDING_APPROVAL">Pending</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} className="h-9 border-gray-200" placeholder="From" />
            <Input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} className="h-9 border-gray-200" placeholder="To" />
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setFactoryFilter("all"); setStatusFilter("all"); setFromDate(""); setToDate(""); setPage(1); }}>
            Clear Filters
          </Button>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="shadow-sm border-gray-200 overflow-hidden">
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead>Date</TableHead>
                <TableHead>Raw Material</TableHead>
                <TableHead>Factory</TableHead>
                <TableHead className="text-right">Issued</TableHead>
                <TableHead className="text-right">Consumed</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Gain/Loss</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[180px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={10} className="py-10 text-center text-gray-500">Loading...</TableCell></TableRow>
              ) : wips.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="py-10 text-center text-gray-500">No WIP records found.</TableCell></TableRow>
              ) : (
                wips.map((wip) => {
                  const netGainLoss = (wip.gainQuantity || 0) - (wip.productionLossQuantity || 0);
                  return (
                    <TableRow key={wip._id} className="hover:bg-blue-50/30 transition-colors">
                      <TableCell className="text-sm whitespace-nowrap">{wip.date ? format(new Date(wip.date), "dd MMM yy") : "-"}</TableCell>
                      <TableCell className="text-sm font-medium text-gray-900">{nameOf(wip.rawMaterialId)}</TableCell>
                      <TableCell className="text-sm text-gray-600">{nameOf(wip.factoryId)}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{wip.issuedQuantity || 0}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{wip.consumedQuantity || 0}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{wip.remainingQuantity}</TableCell>
                      <TableCell className="text-sm">{wip.unit}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        <span className={cn(netGainLoss > 0 ? "text-green-600" : netGainLoss < 0 ? "text-red-600" : "text-gray-500")}>
                          {netGainLoss > 0 ? "+" : ""}{netGainLoss.toFixed(2)} {wip.unit}
                        </span>
                      </TableCell>
                      <TableCell>{statusBadge(wip.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => router.push(`/inventory/material-wip/${wip._id}`)}>
                            <Eye className="h-4 w-4 mr-1" /> View
                          </Button>
                          {wip.status === "ACTIVE" && (
                            <Button size="sm" onClick={() => router.push(`/inventory/material-wip/${wip._id}/produce`)}>
                              <Play className="h-4 w-4 mr-1" /> Produce
                            </Button>
                          )}
                          {wip.status === "PENDING_APPROVAL" && (
                            <Button size="sm" onClick={() => router.push(`/inventory/material-wip/${wip._id}/produce`)}>
                              <CheckCircle className="h-4 w-4 mr-1" /> Approve
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {total > 0 && (
          <div className="flex items-center justify-between p-4 border-t bg-gray-50/50">
            <div className="text-sm text-gray-600">Page {page} of {totalPages} ({total} records)</div>
            <div className="flex items-center gap-2">
              <Select value={String(limit)} onValueChange={(v) => { setLimit(Number(v)); setPage(1); }}>
                <SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="15">15</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium px-2">{page}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}