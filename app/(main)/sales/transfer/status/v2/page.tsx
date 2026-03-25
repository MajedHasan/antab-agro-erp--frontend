// src/app/transfers/page.tsx
"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Eye, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Transfer = any;

export default function TransferListPage() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(false);

  const [page, setPage] = useState(1);
  const limit = 15;
  const [total, setTotal] = useState(0);

  /* ================================
     FETCH LIST
  ================================= */
  async function fetchTransfers() {
    try {
      setLoading(true);

      const res = await api.get("/transfers", {
        params: { page, limit },
      });

      setTransfers(res.data?.data || []);
      setTotal(res.data?.total || 0);
    } catch (err) {
      toast.error("Failed to load transfers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTransfers();
  }, [page]);

  /* ================================
     VIEW MODAL
  ================================= */
  const [selected, setSelected] = useState<Transfer | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function openDetails(id: string) {
    try {
      setDetailLoading(true);
      const res = await api.get(`/transfers/${id}`);
      setSelected(res.data?.data || res.data);
    } catch (err) {
      toast.error("Failed to load transfer details");
    } finally {
      setDetailLoading(false);
    }
  }

  function closeModal() {
    setSelected(null);
  }

  /* ================================
     STATUS COLOR
  ================================= */
  function statusColor(status: string) {
    switch (status) {
      case "CREATED":
        return "bg-blue-100 text-blue-700";
      case "RECEIVED_BY_WAREHOUSE":
        return "bg-yellow-100 text-yellow-700";
      case "FINAL_APPROVED":
        return "bg-green-100 text-green-700";
      case "CANCELLED":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  }

  /* ================================
     RENDER
  ================================= */
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Warehouse Transfers</h1>

        <Button onClick={fetchTransfers} variant="outline" size="sm">
          <RefreshCcw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* ================= TABLE ================= */}
      <div className="border rounded-lg bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">Transfer No</th>
              <th className="p-3 text-left">From</th>
              <th className="p-3 text-left">To</th>
              <th className="p-3 text-left">Items</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-center">Action</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="p-6 text-center">
                  <Loader2 className="animate-spin mx-auto" />
                </td>
              </tr>
            )}

            {!loading &&
              transfers.map((t) => (
                <tr key={t._id} className="border-t hover:bg-gray-50">
                  <td className="p-3 font-medium">{t.transferNo}</td>

                  <td className="p-3">{t.fromWarehouseId?.name}</td>

                  <td className="p-3">{t.toWarehouseId?.name}</td>

                  <td className="p-3">{t.items?.length || 0} Products</td>

                  <td className="p-3">
                    <span
                      className={`px-3 py-1 rounded text-xs font-semibold ${statusColor(
                        t.status,
                      )}`}
                    >
                      {t.status}
                    </span>
                  </td>

                  <td className="p-3 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openDetails(t._id)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* ================= PAGINATION ================= */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-500">
          Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of{" "}
          {total}
        </div>

        <div className="flex gap-2">
          <Button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            Prev
          </Button>

          <Button
            disabled={page * limit >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      {/* ================= DETAIL MODAL ================= */}
      <Dialog open={!!selected} onOpenChange={closeModal}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Transfer Details - {selected?.transferNo}</DialogTitle>
          </DialogHeader>

          {detailLoading && (
            <div className="p-10 text-center">
              <Loader2 className="animate-spin mx-auto" />
              <div className="text-sm mt-2">Loading transfer details...</div>
            </div>
          )}

          {!detailLoading && selected && (
            <div className="space-y-6 text-sm">
              {/* HEADER INFO */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-gray-500">From Warehouse</div>
                  <div className="font-medium">
                    {selected.fromWarehouseId?.name}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500">To Warehouse</div>
                  <div className="font-medium">
                    {selected.toWarehouseId?.name}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500">Status</div>
                  <span
                    className={`px-3 py-1 rounded text-xs font-semibold ${statusColor(
                      selected.status,
                    )}`}
                  >
                    {selected.status}
                  </span>
                </div>
              </div>

              {/* ITEMS TABLE */}
              <div className="border rounded">
                <table className="w-full text-xs">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-2 text-left">Product</th>
                      <th className="p-2 text-right">Qty</th>
                      <th className="p-2 text-right">Unit</th>
                      <th className="p-2 text-right">Cost</th>
                      <th className="p-2 text-right">Subtotal</th>
                    </tr>
                  </thead>

                  <tbody>
                    {selected.items?.map((item: any, idx: number) => {
                      const product = item.productId || {};

                      const subtotal =
                        (item.quantity || 0) * (item.costPrice || 0);

                      return (
                        <tr key={idx} className="border-t">
                          <td className="p-2">
                            <div className="font-medium">{product.name}</div>
                            <div className="text-[10px] text-gray-500">
                              {product.sku}
                            </div>
                          </td>

                          <td className="p-2 text-right">{item.quantity}</td>

                          <td className="p-2 text-right">{item.unit}</td>

                          <td className="p-2 text-right">{item.costPrice}</td>

                          <td className="p-2 text-right font-semibold">
                            {subtotal}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* META */}
              <div className="text-xs text-gray-500 space-y-1">
                <div>Created By: {selected.createdBy?.name}</div>
                <div>
                  Created At: {new Date(selected.createdAt).toLocaleString()}
                </div>

                {selected.receivedBy && (
                  <div>Received By: {selected.receivedBy}</div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
