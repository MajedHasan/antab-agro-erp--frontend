"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Eye,
  RefreshCw,
  Filter,
  FileText,
  Send,
  Clock3,
  CircleAlert,
  CheckCircle2,
  UserRound,
  Smartphone,
  Wheat,
  Bug,
  FlaskConical,
  Droplets,
} from "lucide-react";

type User = {
  _id: string;
  name?: string;
  email?: string;
  mobileNo?: string;
  role?: string;
};

type Prescription = {
  _id: string;
  title: "MR" | "MS";
  farmerName: string;
  farmerMobile: string;
  cropName: string;
  pestTypeName: string;
  solutionName: string;
  doseName: string;
  previewMessageBn: string;
  smsStatus: "pending" | "sent" | "failed";
  createdBy?: User | null;
  createdAt?: string;
  updatedAt?: string;
};

const SMS_STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  sent: "bg-emerald-100 text-emerald-800 border-emerald-200",
  failed: "bg-red-100 text-red-800 border-red-200",
};

function smsLabel(status: Prescription["smsStatus"]) {
  switch (status) {
    case "pending":
      return "Pending";
    case "sent":
      return "Sent";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

function titleLabel(title: Prescription["title"]) {
  return title === "MR" ? "MR (ভাই)" : "MS (বোন)";
}

function creatorLabel(user?: User | null) {
  if (!user) return "-";
  return user.name || user.email || user.mobileNo || user._id || "-";
}

function truncate(text?: string, max = 90) {
  if (!text) return "-";
  return text.length <= max ? text : `${text.slice(0, max)}...`;
}

export default function PrescriptionListPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);

  const [q, setQ] = useState("");
  const [smsStatus, setSmsStatus] = useState<string>("ALL");
  const [title, setTitle] = useState<string>("ALL");
  const [createdBy, setCreatedBy] = useState<string>("ALL");

  const [farmerMobile, setFarmerMobile] = useState("");
  const [cropName, setCropName] = useState("");
  const [pestTypeName, setPestTypeName] = useState("");
  const [solutionName, setSolutionName] = useState("");
  const [doseName, setDoseName] = useState("");

  useEffect(() => {
    loadPrescriptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    page,
    q,
    smsStatus,
    title,
    createdBy,
    farmerMobile,
    cropName,
    pestTypeName,
    solutionName,
    doseName,
  ]);

  useEffect(() => {
    setPage(1);
  }, [
    q,
    smsStatus,
    title,
    createdBy,
    farmerMobile,
    cropName,
    pestTypeName,
    solutionName,
    doseName,
  ]);

  async function loadPrescriptions() {
    try {
      setLoading(true);

      const params: Record<string, any> = {
        page,
        limit,
      };

      if (q.trim()) params.q = q.trim();
      if (smsStatus !== "ALL") params.smsStatus = smsStatus;
      if (title !== "ALL") params.title = title;
      if (createdBy !== "ALL") params.createdBy = createdBy;
      if (farmerMobile.trim()) params.farmerMobile = farmerMobile.trim();
      if (cropName.trim()) params.cropName = cropName.trim();
      if (pestTypeName.trim()) params.pestTypeName = pestTypeName.trim();
      if (solutionName.trim()) params.solutionName = solutionName.trim();
      if (doseName.trim()) params.doseName = doseName.trim();

      const res = await api.get("/prescriptions", { params });

      const data = res.data?.data || res.data?.docs || res.data?.rows || [];

      const totalCount =
        res.data?.total ?? res.data?.meta?.total ?? res.data?.count ?? 0;

      setPrescriptions(data);
      setTotal(totalCount);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load prescriptions");
    } finally {
      setLoading(false);
    }
  }

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / limit)),
    [total, limit],
  );

  const summary = useMemo(() => {
    const totalItems = prescriptions.length;
    const sent = prescriptions.filter((p) => p.smsStatus === "sent").length;
    const pending = prescriptions.filter(
      (p) => p.smsStatus === "pending",
    ).length;
    const failed = prescriptions.filter((p) => p.smsStatus === "failed").length;

    return { totalItems, sent, pending, failed };
  }, [prescriptions]);

  function openPrescription(id: string) {
    router.push(`/sales/prescriptions/${id}`);
  }

  function resetFilters() {
    setQ("");
    setSmsStatus("ALL");
    setTitle("ALL");
    setCreatedBy("ALL");
    setFarmerMobile("");
    setCropName("");
    setPestTypeName("");
    setSolutionName("");
    setDoseName("");
    setPage(1);
  }

  function paginatePrev() {
    setPage((p) => Math.max(1, p - 1));
  }

  function paginateNext() {
    setPage((p) => Math.min(totalPages, p + 1));
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6 space-y-6">
        {/* header */}
        <div className="rounded-3xl border bg-gradient-to-br from-emerald-900 via-emerald-900 to-emerald-700 p-6 text-white shadow-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-emerald-200">
                <FileText className="h-4 w-4" />
                <span>Prescription Center</span>
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">
                Prescription records
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-emerald-100">
                Super admin can review all prescriptions, filter by SMS status,
                farmer details, crop, pest, solution, and dose, and open any
                record for details.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={loadPrescriptions}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
              {/* <Button
                onClick={() => router.push("/sales/prescriptions/create")}
                className="bg-white text-emerald-900 hover:bg-emerald-100"
              >
                + Create Prescription
              </Button> */}
            </div>
          </div>
        </div>

        {/* stats */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-2xl bg-slate-900 p-3 text-white">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">
                  Shown on page
                </div>
                <div className="text-2xl font-bold">{summary.totalItems}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-800">
                <Send className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">SMS sent</div>
                <div className="text-2xl font-bold">{summary.sent}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-2xl bg-amber-100 p-3 text-amber-800">
                <Clock3 className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">SMS pending</div>
                <div className="text-2xl font-bold">{summary.pending}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-2xl bg-red-100 p-3 text-red-700">
                <CircleAlert className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">SMS failed</div>
                <div className="text-2xl font-bold">{summary.failed}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* filter panel */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <div className="xl:col-span-2">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Search farmer, mobile, crop..."
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  SMS status
                </label>
                <Select value={smsStatus} onValueChange={setSmsStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Title
                </label>
                <Select value={title} onValueChange={setTitle}>
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All</SelectItem>
                    <SelectItem value="MR">MR</SelectItem>
                    <SelectItem value="MS">MS</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Created by
                </label>
                <Select value={createdBy} onValueChange={setCreatedBy}>
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All</SelectItem>
                    <SelectItem value="me">Myself</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Farmer mobile
                </label>
                <div className="relative">
                  <Smartphone className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Farmer mobile"
                    value={farmerMobile}
                    onChange={(e) => setFarmerMobile(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Crop
                </label>
                <div className="relative">
                  <Wheat className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Crop name"
                    value={cropName}
                    onChange={(e) => setCropName(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Pest type
                </label>
                <div className="relative">
                  <Bug className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Pest type"
                    value={pestTypeName}
                    onChange={(e) => setPestTypeName(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Solution
                </label>
                <div className="relative">
                  <FlaskConical className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Solution name"
                    value={solutionName}
                    onChange={(e) => setSolutionName(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Dose
                </label>
                <div className="relative">
                  <Droplets className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Dose name"
                    value={doseName}
                    onChange={(e) => setDoseName(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                Use filters to narrow prescriptions by farmer, crop, pest,
                solution, dose, and SMS delivery status.
              </div>
              <Button variant="outline" onClick={resetFilters}>
                Reset filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* table */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Prescription list</CardTitle>
            <div className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </div>
          </CardHeader>

          <CardContent>
            <div className="overflow-hidden rounded-2xl border bg-white">
              <div className="max-h-[68vh] overflow-auto">
                <table className="min-w-full table-auto">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-left text-sm shadow-sm">
                    <tr>
                      <th className="px-4 py-3">Farmer</th>
                      <th className="px-4 py-3">Prescription</th>
                      <th className="px-4 py-3">Message</th>
                      <th className="px-4 py-3">SMS</th>
                      <th className="px-4 py-3">Created By</th>
                      <th className="px-4 py-3">Created At</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {loading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-4 py-4" colSpan={7}>
                            <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
                          </td>
                        </tr>
                      ))
                    ) : prescriptions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-16">
                          <div className="mx-auto max-w-md text-center">
                            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                              <FileText className="h-6 w-6 text-slate-500" />
                            </div>
                            <h3 className="text-lg font-semibold">
                              No prescriptions found
                            </h3>
                            <p className="mt-2 text-sm text-muted-foreground">
                              No records match your current filters.
                            </p>
                            <div className="mt-5 flex justify-center gap-2">
                              <Button variant="outline" onClick={resetFilters}>
                                Clear filters
                              </Button>
                              {/* <Button
                                onClick={() =>
                                  router.push("/sales/prescriptions/create")
                                }
                              >
                                Create prescription
                              </Button> */}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      prescriptions.map((p) => (
                        <tr
                          key={p._id}
                          className="border-t align-top transition hover:bg-slate-50"
                        >
                          <td className="px-4 py-4">
                            <div className="space-y-1">
                              <div className="font-semibold text-slate-900">
                                {p.farmerName}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {titleLabel(p.title)}
                              </div>
                              <div className="text-xs text-slate-600">
                                {p.farmerMobile}
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center gap-2">
                                <Wheat className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">
                                  {p.cropName}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Bug className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">
                                  {p.pestTypeName}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <FlaskConical className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">
                                  {p.solutionName}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Droplets className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">
                                  {p.doseName}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="max-w-sm space-y-2">
                              <div className="text-xs text-muted-foreground">
                                Bengali preview
                              </div>
                              <div className="rounded-xl border bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                                {truncate(p.previewMessageBn, 120)}
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <Badge
                              variant="outline"
                              className={
                                SMS_STATUS_STYLES[p.smsStatus] ||
                                SMS_STATUS_STYLES.pending
                              }
                            >
                              {smsLabel(p.smsStatus)}
                            </Badge>
                          </td>

                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2 text-sm">
                              <UserRound className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">
                                {creatorLabel(p.createdBy)}
                              </span>
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="space-y-1 text-sm">
                              <div className="font-medium">
                                {p.createdAt
                                  ? new Date(p.createdAt).toLocaleDateString()
                                  : "-"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {p.createdAt
                                  ? new Date(p.createdAt).toLocaleTimeString()
                                  : ""}
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-4 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openPrescription(p._id)}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                Total records:{" "}
                <strong className="text-slate-900">{total}</strong>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  disabled={page <= 1 || loading}
                  onClick={paginatePrev}
                >
                  Prev
                </Button>
                <div className="min-w-20 text-center text-sm">
                  {page} / {totalPages}
                </div>
                <Button
                  variant="outline"
                  disabled={page >= totalPages || loading}
                  onClick={paginateNext}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
