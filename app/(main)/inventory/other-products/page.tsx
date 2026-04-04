"use client";

import React, { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Trash2, Edit, Plus, Search, Sliders } from "lucide-react";
import { toast } from "sonner";

type OtherProduct = {
  _id?: string;
  name: string;
  sku: string;
  unit?: string;
  purchasePrice?: number;
  minStockLevel?: number;
  isReusable?: boolean;
  isActive?: boolean;
  notes?: string;
};

type OtherProductStock = {
  _id?: string;
  otherProductId: string | { _id: string; name?: string };
  factoryId: string | { _id: string; name?: string };
  factory?: { _id: string; name?: string };
  quantity: number;
  unit?: string;
  batch?: string;
  expiryDate?: string;
  lastUpdated?: string;
};

export default function OtherProductsPage() {
  const [items, setItems] = useState<OtherProduct[]>([]);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(15);
  const [total, setTotal] = useState<number>(0);
  const [q, setQ] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<OtherProduct | null>(null);
  const [form, setForm] = useState<OtherProduct>({
    name: "",
    sku: "",
    unit: "pcs",
    purchasePrice: 0,
    minStockLevel: 0,
    isReusable: false,
    isActive: true,
    notes: "",
  });

  const [stocks, setStocks] = useState<OtherProductStock[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<OtherProduct | null>(null);

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustRecord, setAdjustRecord] = useState<
    Partial<OtherProductStock> & { amount?: number }
  >({});

  const [factories, setFactories] = useState<{ _id: string; name: string }[]>(
    [],
  );
  const [factoryFilter, setFactoryFilter] = useState("");

  function idOf(x: any) {
    if (!x) return "";
    return typeof x === "string" ? x : (x._id ?? "");
  }

  async function fetchItems() {
    try {
      setLoading(true);
      const res = await api.get("/other-products", {
        params: { page, limit, q },
      });
      setItems(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load other products");
    } finally {
      setLoading(false);
    }
  }

  async function fetchStocks() {
    try {
      setStockLoading(true);
      const res = await api.get("/other-product-stocks", {
        params: { page: 1, limit: 10000 },
      });
      setStocks(res.data.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load other product stocks");
    } finally {
      setStockLoading(false);
    }
  }

  async function fetchFactories() {
    try {
      const res = await api.get("/warehouses", {
        params: { type: "Factory", limit: 200 },
      });
      setFactories(res.data.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load factories");
    }
  }

  useEffect(() => {
    fetchFactories();
  }, []);

  useEffect(() => {
    fetchItems();
  }, [page, limit, q]);

  useEffect(() => {
    if (items.length) fetchStocks();
    else setStocks([]);
  }, [items]);

  const stockByItem = useMemo(() => {
    const map = new Map<string, { total: number; rows: OtherProductStock[] }>();
    for (const s of stocks) {
      const pid = idOf(s.otherProductId);
      const entry = map.get(pid) || { total: 0, rows: [] };
      entry.total += Number(s.quantity || 0);
      entry.rows.push(s);
      map.set(pid, entry);
    }
    return map;
  }, [stocks]);

  const stockByItemFactory = useMemo(() => {
    const map = new Map<string, OtherProductStock>();
    for (const s of stocks) {
      const pid = idOf(s.otherProductId);
      const fid = idOf(s.factoryId);
      map.set(`${pid}_${fid}`, s);
    }
    return map;
  }, [stocks]);

  function openCreate() {
    setEditing(null);
    setForm({
      name: "",
      sku: "",
      unit: "pcs",
      purchasePrice: 0,
      minStockLevel: 0,
      isReusable: false,
      isActive: true,
      notes: "",
    });
    setOpenForm(true);
  }

  function openEdit(item: OtherProduct) {
    setEditing(item);
    setForm({ ...item });
    setOpenForm(true);
  }

  async function submitForm(e?: React.FormEvent) {
    e?.preventDefault();
    if (!form.name?.trim()) return toast.error("Name required");
    if (!form.sku?.trim()) return toast.error("SKU required");

    try {
      const payload = {
        ...form,
        name: String(form.name).trim(),
        sku: String(form.sku).trim(),
      };

      if (editing?._id) {
        await api.put(`/other-products/${editing._id}`, payload);
        toast.success("Updated");
      } else {
        await api.post("/other-products", payload);
        toast.success("Created");
      }

      setOpenForm(false);
      fetchItems();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Save failed");
    }
  }

  async function deleteItem(id?: string) {
    if (!id) return;
    if (!confirm("Delete other product?")) return;

    try {
      await api.delete(`/other-products/${id}`);
      toast.success("Deleted");
      fetchItems();
    } catch {
      toast.error("Delete failed");
    }
  }

  function openStockModal(item: OtherProduct) {
    setSelectedItem(item);
    setStockModalOpen(true);
  }

  function openAdjustModal(stock?: OtherProductStock, item?: OtherProduct) {
    const itemId = stock ? idOf(stock.otherProductId) : item?._id;
    const factoryId = stock ? idOf(stock.factoryId) : undefined;

    setAdjustRecord({
      _id: stock?._id,
      otherProductId: itemId,
      factoryId,
      quantity: stock?.quantity ?? 0,
      unit: stock?.unit ?? item?.unit ?? "pcs",
      batch: stock?.batch ?? "",
      expiryDate: stock?.expiryDate ?? "",
      amount: 0,
    });

    setAdjustOpen(true);
  }

  function handleAdjustFactoryChange(factoryId: string) {
    const key = `${adjustRecord.otherProductId}_${factoryId}`;
    const existing = stockByItemFactory.get(key);

    setAdjustRecord({
      ...adjustRecord,
      factoryId,
      quantity: existing?.quantity ?? 0,
      unit: existing?.unit ?? adjustRecord.unit ?? "pcs",
      batch: existing?.batch ?? "",
      expiryDate: existing?.expiryDate ?? "",
      _id: existing?._id,
    });
  }

  async function submitAdjust(e?: React.FormEvent) {
    e?.preventDefault();
    const rec = adjustRecord as Partial<OtherProductStock> & {
      amount?: number;
    };

    if (!rec.otherProductId || !rec.factoryId) {
      return toast.error("Select factory and item");
    }

    try {
      if (rec._id) {
        let newQty = Number(rec.quantity || 0);
        if (rec.amount) newQty = newQty + Number(rec.amount);

        await api.put(`/other-product-stocks/${rec._id}`, {
          quantity: newQty,
          batch: rec.batch,
          expiryDate: rec.expiryDate,
          unit: rec.unit,
        });

        toast.success("Stock updated");
      } else {
        await api.post("/other-product-stocks", {
          otherProductId: rec.otherProductId,
          factoryId: rec.factoryId,
          quantity: Number(rec.amount || 0),
          unit: rec.unit,
          batch: rec.batch,
          expiryDate: rec.expiryDate,
        });

        toast.success("Stock created");
      }

      setAdjustOpen(false);
      setStockModalOpen(true);
      await fetchStocks();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Stock update failed");
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const filteredFactories = factories.filter((f) =>
    (f.name || "").toLowerCase().includes(factoryFilter.toLowerCase()),
  );

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Other Products</h2>
          <p className="text-sm text-muted-foreground">
            Manage other products and per-factory stocks
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center border rounded-md px-2 py-1 gap-2">
            <Search className="w-4 h-4 text-gray-500" />
            <Input
              value={q}
              placeholder="Search name or sku..."
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              className="border-0 p-0"
            />
          </div>

          <Button onClick={openCreate} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New
          </Button>

          <Button
            variant="secondary"
            onClick={async () => {
              try {
                const res = await api.get("/other-products/export", {
                  responseType: "blob",
                });
                const url = window.URL.createObjectURL(new Blob([res.data]));
                const a = document.createElement("a");
                a.href = url;
                a.download = "other_products.csv";
                a.click();
                URL.revokeObjectURL(url);
              } catch {
                toast.error("Export failed");
              }
            }}
          >
            Export CSV
          </Button>

          <Button variant="ghost" onClick={() => fetchStocks()}>
            <Sliders className="w-4 h-4" />
            Refresh Stocks
          </Button>
        </div>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="p-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Purchase</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Min</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-44">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {items.map((it, idx) => {
                const agg = stockByItem.get(it._id || "") || {
                  total: 0,
                  rows: [],
                };
                const low = agg.total < (it.minStockLevel || 0);

                return (
                  <TableRow key={it._id || idx}>
                    <TableCell>{(page - 1) * limit + idx + 1}</TableCell>

                    <TableCell>
                      <div className="flex flex-col">
                        <div className="font-medium">{it.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {it.notes}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>{it.sku}</TableCell>
                    <TableCell>{it.unit ?? "pcs"}</TableCell>
                    <TableCell>৳ {it.purchasePrice ?? 0}</TableCell>

                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div
                          className={
                            low ? "text-red-600 font-medium" : "font-medium"
                          }
                        >
                          {agg.total}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openStockModal(it)}
                        >
                          View stocks
                        </Button>
                      </div>
                    </TableCell>

                    <TableCell>{it.minStockLevel ?? 0}</TableCell>
                    <TableCell>{it.isActive ? "Active" : "Inactive"}</TableCell>

                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEdit(it)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteItem(it._id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openAdjustModal(undefined, it)}
                        >
                          Adjust Stock
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}

              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-6">
                    {loading ? "Loading..." : "No other products found"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between p-4 border-t">
          <div>
            <span className="text-sm text-muted-foreground">
              Showing {(page - 1) * limit + 1} - {Math.min(page * limit, total)}{" "}
              of {total}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="border rounded px-2 py-1"
            >
              {[10, 15, 25, 50].map((l) => (
                <option key={l} value={l}>
                  {l} / page
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1">
              <Button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Prev
              </Button>
              <div className="px-3">
                {page} / {totalPages}
              </div>
              <Button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent>
          <form onSubmit={submitForm} className="space-y-4">
            <h3 className="text-lg font-semibold">
              {editing?._id ? "Edit Other Product" : "New Other Product"}
            </h3>

            <div>
              <label className="text-sm">Name</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm">SKU</label>
              <Input
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm">Unit</label>
              <select
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="border rounded px-2 py-1 w-full"
              >
                <option value="pcs">pcs</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm">Purchase Price</label>
                <Input
                  type="number"
                  value={form.purchasePrice ?? 0}
                  onChange={(e) =>
                    setForm({ ...form, purchasePrice: Number(e.target.value) })
                  }
                />
              </div>

              <div>
                <label className="text-sm">Min Stock Level</label>
                <Input
                  type="number"
                  value={form.minStockLevel ?? 0}
                  onChange={(e) =>
                    setForm({ ...form, minStockLevel: Number(e.target.value) })
                  }
                />
              </div>
            </div>

            <div>
              <label className="text-sm">Reusable</label>
              <select
                value={String(form.isReusable ?? false)}
                onChange={(e) =>
                  setForm({ ...form, isReusable: e.target.value === "true" })
                }
                className="border rounded px-2 py-1 w-full"
              >
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </div>

            <div>
              <label className="text-sm">Notes</label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm">Status</label>
              <select
                value={form.isActive ? "Active" : "Inactive"}
                onChange={(e) =>
                  setForm({ ...form, isActive: e.target.value === "Active" })
                }
                className="border rounded px-2 py-1 w-full"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpenForm(false)}>
                Cancel
              </Button>
              <Button type="submit">{editing?._id ? "Save" : "Create"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={stockModalOpen} onOpenChange={setStockModalOpen}>
        <DialogContent className="w-full md:!min-w-3xl !max-w-3xl">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                Stocks for {selectedItem?.name}
              </h3>
              <div>
                <Button
                  size="sm"
                  onClick={() => openAdjustModal(undefined, selectedItem!)}
                >
                  Add / Adjust
                </Button>
              </div>
            </div>

            {stockLoading ? (
              <div>Loading stocks…</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Factory</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(stockByItem.get(selectedItem?._id || "")?.rows || []).map(
                      (s) => (
                        <TableRow key={s._id}>
                          <TableCell>
                            {(s.factory as any)?.name ||
                              (s.factoryId as any)?.name ||
                              (s.factoryId as any)?._id ||
                              s.factoryId}
                          </TableCell>
                          <TableCell>{s.quantity}</TableCell>
                          <TableCell>{s.unit}</TableCell>
                          <TableCell>{s.batch || "-"}</TableCell>
                          <TableCell>
                            {s.expiryDate
                              ? new Date(s.expiryDate).toLocaleDateString()
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {s.lastUpdated
                              ? new Date(s.lastUpdated).toLocaleString()
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  openAdjustModal(s, selectedItem!)
                                }
                              >
                                Adjust
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ),
                    )}

                    {(stockByItem.get(selectedItem?._id || "")?.rows || [])
                      .length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-4">
                          No stock records
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setStockModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <form onSubmit={submitAdjust} className="space-y-4">
            <h3 className="text-lg font-semibold">
              Adjust Other Product Stock
            </h3>

            <div>
              <label className="text-sm">Factory (filter)</label>
              <Input
                placeholder="search factory..."
                value={factoryFilter}
                onChange={(e) => setFactoryFilter(e.target.value)}
              />
              <select
                value={adjustRecord.factoryId || ""}
                onChange={(e) => handleAdjustFactoryChange(e.target.value)}
                className="border rounded px-2 py-1 w-full mt-2"
                required
              >
                <option value="">Select factory</option>
                {filteredFactories.map((f) => (
                  <option key={f._id} value={f._id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm">Current Quantity (if editing)</label>
              <Input
                type="number"
                value={adjustRecord.quantity ?? 0}
                onChange={(e) =>
                  setAdjustRecord({
                    ...adjustRecord,
                    quantity: Number(e.target.value),
                  })
                }
              />
            </div>

            <div>
              <label className="text-sm">
                Amount (positive to add, negative to subtract)
              </label>
              <Input
                type="number"
                value={adjustRecord.amount ?? 0}
                onChange={(e) =>
                  setAdjustRecord({
                    ...adjustRecord,
                    amount: Number(e.target.value),
                  })
                }
              />
            </div>

            <div>
              <label className="text-sm">Unit</label>
              <select
                value={adjustRecord.unit ?? "pcs"}
                onChange={(e) =>
                  setAdjustRecord({ ...adjustRecord, unit: e.target.value })
                }
                className="border rounded px-2 py-1 w-full"
              >
                <option value="pcs">pcs</option>
              </select>
            </div>

            <div>
              <label className="text-sm">Batch</label>
              <Input
                value={adjustRecord.batch ?? ""}
                onChange={(e) =>
                  setAdjustRecord({ ...adjustRecord, batch: e.target.value })
                }
              />
            </div>

            <div>
              <label className="text-sm">Expiry Date</label>
              <Input
                type="date"
                value={
                  adjustRecord.expiryDate
                    ? new Date(adjustRecord.expiryDate)
                        .toISOString()
                        .slice(0, 10)
                    : ""
                }
                onChange={(e) =>
                  setAdjustRecord({
                    ...adjustRecord,
                    expiryDate: e.target.value,
                  })
                }
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                type="button"
                onClick={() => setAdjustOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
