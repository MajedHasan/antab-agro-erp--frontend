"use client";

import React, { useEffect, useState, useRef } from "react";
import api from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Edit, Trash2, Search, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";

type Category = { _id: string; name: string };
type Warehouse = { _id: string; name: string; location?: string };

type ProductImage = { url: string; alt?: string };
type ProductWarehouse = { warehouse: string; qty: number };

type ProductFormType = {
  name: string;
  sku: string;
  code?: string;
  barcode?: string;
  category?: string;
  tags?: string[]; // array of strings
  unit?: string;
  costPrice?: number | string;
  salePrice?: number | string;
  taxRate?: number | string;
  stock?: number | string;
  reorderLevel?: number | string;
  warehouses?: ProductWarehouse[];
  description?: string;
  images?: ProductImage[];
  status?: string; // Active / Inactive / Discontinued
  weight?: number | string;
  dimensions?: {
    length?: number | string;
    width?: number | string;
    height?: number | string;
  };
  attributes?: Record<string, any>;
};

type Product = ProductFormType & {
  _id?: string;
  createdAt?: string;
  updatedAt?: string;
};

const NONE = "none";

export default function ProductsSinglePage() {
  /** ------------------------
   * list state
   * -------------------------*/
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");

  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  /** ------------------------
   * modal + form state
   * -------------------------*/
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const defaultForm: ProductFormType = {
    name: "",
    sku: "",
    code: "",
    barcode: "",
    category: "",
    tags: [],
    unit: "pcs",
    costPrice: 0,
    salePrice: 0,
    taxRate: 0,
    stock: 0,
    reorderLevel: 0,
    warehouses: [],
    description: "",
    images: [],
    status: "Active",
    weight: "",
    dimensions: { length: "", width: "", height: "" },
    attributes: {},
  };

  const [form, setForm] = useState<ProductFormType>({ ...defaultForm });

  const [pageLoading, setPageLoading] = useState(false);

  const searchTimer = useRef<number | null>(null);

  /** ------------------------
   * loaders: categories / warehouses
   * -------------------------*/
  const loadCategories = async () => {
    try {
      const res = await api.get("/categories", { params: { limit: 1000 } });
      setCategories(res.data.data || []);
    } catch {
      toast.error("Failed to load categories");
    }
  };

  const loadWarehouses = async () => {
    try {
      const res = await api.get("/warehouses", { params: { limit: 1000 } });
      setWarehouses(res.data.data || []);
    } catch {
      // ignore if warehouses not available
    }
  };

  /** ------------------------
   * fetch products (list)
   * -------------------------*/
  const fetchProducts = async (opts?: { page?: number }) => {
    try {
      setPageLoading(true);
      const params: any = { page: opts?.page ?? page, limit, q };
      if (filterCategory && filterCategory !== NONE)
        params.category = filterCategory;
      if (filterStatus && filterStatus !== NONE) params.status = filterStatus;
      const res = await api.get("/products", { params });
      setProducts(res.data.data || []);
      setTotal(res.data.total ?? 0);
    } catch {
      toast.error("Failed to load products");
    } finally {
      setPageLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
    loadWarehouses();
  }, []);

  // debounce search
  useEffect(() => {
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => {
      setPage(1);
      fetchProducts({ page: 1 });
    }, 250);
    return () => {
      if (searchTimer.current) window.clearTimeout(searchTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filterCategory, filterStatus, limit]);

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  /** ------------------------
   * open modal: create / edit
   * -------------------------*/
  const onCreate = () => {
    setEditing(null);
    setForm({ ...defaultForm });
    setOpen(true);
  };

  const onEdit = async (p: Product) => {
    setEditing(p);
    // normalize warehouses/images/tags
    const prod = await (async () => {
      // ensure freshest data from backend
      try {
        const res = await api.get(`/products/${p._id}`);
        return res.data?.data ?? p;
      } catch {
        return p;
      }
    })();

    // ensure arrays present
    const images = prod.images && prod.images.length ? prod.images : [];
    const warehousesForm =
      prod.warehouses && prod.warehouses.length
        ? prod.warehouses.map((w: any) => ({
            warehouse: String(w.warehouse ?? w.warehouse?._id ?? ""),
            qty: Number(w.qty ?? 0),
          }))
        : [];
    const tags = Array.isArray(prod.tags)
      ? prod.tags
      : typeof prod.tags === "string"
      ? prod.tags
          .split(",")
          .map((t: string) => t.trim())
          .filter(Boolean)
      : [];

    setForm({
      name: prod.name || "",
      sku: prod.sku || "",
      code: prod.code || "",
      barcode: prod.barcode || "",
      category: prod.category
        ? typeof prod.category === "string"
          ? prod.category
          : (prod.category as any)._id
        : "",
      tags,
      unit: prod.unit || "pcs",
      costPrice: prod.costPrice ?? 0,
      salePrice: prod.salePrice ?? 0,
      taxRate: prod.taxRate ?? 0,
      stock: prod.stock ?? 0,
      reorderLevel: prod.reorderLevel ?? 0,
      warehouses: warehousesForm,
      description: prod.description || "",
      images,
      status: prod.status || "Active",
      weight: prod.weight ?? "",
      dimensions: {
        length: prod.dimensions?.length ?? "",
        width: prod.dimensions?.width ?? "",
        height: prod.dimensions?.height ?? "",
      },
      attributes: prod.attributes ?? {},
    });

    setOpen(true);
  };

  /** ------------------------
   * form utilities: tags / images / warehouses
   * -------------------------*/
  const addTag = (t?: string) =>
    setForm((f) => ({ ...f, tags: [...(f.tags || []), (t ?? "").trim()] }));

  const removeTag = (idx: number) =>
    setForm((f) => ({
      ...f,
      tags: (f.tags || []).filter((_, i) => i !== idx),
    }));

  const addImage = () =>
    setForm((f) => ({
      ...f,
      images: [...(f.images || []), { url: "", alt: "" }],
    }));

  const removeImage = (idx: number) =>
    setForm((f) => ({
      ...f,
      images: (f.images || []).filter((_, i) => i !== idx),
    }));

  const addWarehouse = () =>
    setForm((f) => ({
      ...f,
      warehouses: [...(f.warehouses || []), { warehouse: "", qty: 0 }],
    }));

  const removeWarehouse = (idx: number) =>
    setForm((f) => ({
      ...f,
      warehouses: (f.warehouses || []).filter((_, i) => i !== idx),
    }));

  /** ------------------------
   * submit create/update
   * -------------------------*/
  const onSubmit = async (ev?: React.FormEvent) => {
    ev?.preventDefault();
    // basic validation
    if (!form.name || !form.sku)
      return toast.error("Please provide Name and SKU");

    try {
      const payload = {
        ...form,
        // ensure numeric fields are numbers
        category: form.category || null,

        costPrice: Number(form.costPrice ?? 0),
        salePrice: Number(form.salePrice ?? 0),
        taxRate: Number(form.taxRate ?? 0),
        stock: Number(form.stock ?? 0),
        reorderLevel: Number(form.reorderLevel ?? 0),
        warehouses: (form.warehouses || []).map((w) => ({
          warehouse: w.warehouse,
          qty: Number(w.qty || 0),
        })),
      };

      if (editing?._id) {
        await api.put(`/products/${editing._id}`, payload);
        toast.success("Product updated");
      } else {
        await api.post("/products", payload);
        toast.success("Product created");
      }
      setOpen(false);
      fetchProducts({ page: 1 });
      setPage(1);
    } catch (err: any) {
      console.error(err);
      toast.error("Save failed");
    }
  };

  /** ------------------------
   * delete
   * -------------------------*/
  const onDelete = async (id?: string) => {
    if (!id) return;
    if (!confirm("Delete product?")) return;
    try {
      await api.delete(`/products/${id}`);
      toast.success("Deleted");
      fetchProducts();
    } catch {
      toast.error("Delete failed");
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  /** ------------------------
   * RENDER
   * -------------------------*/
  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Products</h2>
          <p className="text-sm text-muted-foreground">
            Manage catalog — create, edit, stock & pricing
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <div className="flex items-center border rounded px-2 py-1 gap-2 bg-white">
              <Search className="w-4 h-4 text-gray-500" />
              <Input
                placeholder="Search by name, sku or barcode..."
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                }}
                className="w-64"
              />
            </div>
          </div>

          {/* Category filter */}
          <Select
            value={filterCategory ?? NONE}
            onValueChange={(v) => setFilterCategory(v === NONE ? null : v)}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>All Categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c._id} value={c._id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status filter */}
          <Select
            value={filterStatus ?? NONE}
            onValueChange={(v) => setFilterStatus(v === NONE ? null : v)}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>All Status</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
              <SelectItem value="Discontinued">Discontinued</SelectItem>
            </SelectContent>
          </Select>

          <Button
            onClick={onCreate}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Product
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Sale Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead className="w-40">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p, i) => (
                <TableRow key={p._id || i}>
                  <TableCell>{(page - 1) * limit + i + 1}</TableCell>
                  <TableCell>{p.sku}</TableCell>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>
                    {typeof p.category === "string"
                      ? categories.find((c) => c._id === p.category)?.name || ""
                      : (p as any).category?.name || ""}
                  </TableCell>
                  <TableCell>{p.salePrice}</TableCell>
                  <TableCell>{p.stock}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEdit(p)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => onDelete(p._id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {products.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6">
                    {pageLoading ? "Loading..." : "No products found"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="p-4 flex items-center justify-between border-t">
          <div className="text-sm text-muted-foreground">
            Showing {(page - 1) * limit + 1} - {Math.min(page * limit, total)}{" "}
            of {total}
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
                  {l}/page
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

      {/* Product Modal */}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) {
            setEditing(null);
            setForm({ ...defaultForm });
          }
          setOpen(v);
        }}
      >
        <DialogContent className="!w-full !max-w-[95vw] max-h-[90vh] overflow-y-auto p-6 rounded-xl shadow-2xl bg-background border">
          <form onSubmit={onSubmit} className="space-y-6">
            {/* header */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {editing?._id ? "Edit Product" : "New Product"}
              </h3>
              <div className="text-sm text-muted-foreground">
                {editing?._id ? `ID: ${editing._id}` : ""}
              </div>
            </div>

            {/* two-column grid rows for predictable tab order */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <label className="text-sm">Code</label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </div>

              <div>
                <label className="text-sm">Barcode</label>
                <Input
                  value={form.barcode}
                  onChange={(e) =>
                    setForm({ ...form, barcode: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="text-sm">Category</label>
                <Select
                  value={form.category || NONE}
                  onValueChange={(v) =>
                    setForm({ ...form, category: v === NONE ? "" : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c._id} value={c._id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm">Unit</label>
                <Input
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                />
              </div>

              <div>
                <label className="text-sm">Cost Price</label>
                <Input
                  type="number"
                  value={String(form.costPrice ?? "")}
                  onChange={(e) =>
                    setForm({ ...form, costPrice: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="text-sm">Sale Price</label>
                <Input
                  type="number"
                  value={String(form.salePrice ?? "")}
                  onChange={(e) =>
                    setForm({ ...form, salePrice: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="text-sm">Tax Rate (%)</label>
                <Input
                  type="number"
                  value={String(form.taxRate ?? "")}
                  onChange={(e) =>
                    setForm({ ...form, taxRate: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="text-sm">Stock</label>
                <Input
                  type="number"
                  value={String(form.stock ?? "")}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                />
              </div>

              <div>
                <label className="text-sm">Reorder Level</label>
                <Input
                  type="number"
                  value={String(form.reorderLevel ?? "")}
                  onChange={(e) =>
                    setForm({ ...form, reorderLevel: e.target.value })
                  }
                />
              </div>
            </div>

            {/* warehouses (array) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold">Warehouses</label>
                <Button size="sm" onClick={addWarehouse}>
                  <Plus className="w-4 h-4" /> Add
                </Button>
              </div>
              <div className="space-y-2">
                {(form.warehouses || []).map((w, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center"
                  >
                    <Select
                      value={w.warehouse || NONE}
                      onValueChange={(v) => {
                        const arr = [...(form.warehouses || [])];
                        arr[idx] = {
                          ...arr[idx],
                          warehouse: v === NONE ? "" : v,
                        };
                        setForm({ ...form, warehouses: arr });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Warehouse" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Choose</SelectItem>
                        {warehouses.map((wh) => (
                          <SelectItem key={wh._id} value={wh._id}>
                            {wh.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Input
                      type="number"
                      value={String(w.qty ?? "")}
                      onChange={(e) => {
                        const arr = [...(form.warehouses || [])];
                        arr[idx] = {
                          ...arr[idx],
                          qty: Number(e.target.value) || 0,
                        };
                        setForm({ ...form, warehouses: arr });
                      }}
                    />

                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        onClick={() => removeWarehouse(idx)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {!(form.warehouses || []).length && (
                  <div className="text-xs text-muted-foreground">
                    No warehouse allocations
                  </div>
                )}
              </div>
            </div>

            {/* tags */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold">Tags</label>
                <div className="flex items-center gap-2">
                  <Input id="new-tag" placeholder="new tag" />
                  <Button
                    size="sm"
                    onClick={() => {
                      // read input value by id (small helper without extra state)
                      const el = document.getElementById(
                        "new-tag"
                      ) as HTMLInputElement | null;
                      if (!el) return;
                      const v = el.value.trim();
                      if (!v) return;
                      addTag(v);
                      el.value = "";
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {(form.tags || []).map((t, idx) => (
                  <div
                    key={idx}
                    className="px-2 py-1 bg-muted rounded-full flex items-center gap-2"
                  >
                    <span className="text-sm">{t}</span>
                    <button
                      type="button"
                      onClick={() => removeTag(idx)}
                      className="p-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {!(form.tags || []).length && (
                  <div className="text-xs text-muted-foreground">No tags</div>
                )}
              </div>
            </div>

            {/* images */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold">Images (url)</label>
                <Button size="sm" onClick={addImage}>
                  <Plus className="w-4 h-4" /> Add
                </Button>
              </div>
              <div className="space-y-2">
                {(form.images || []).map((img, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center"
                  >
                    <Input
                      placeholder="Image URL"
                      value={img.url}
                      onChange={(e) => {
                        const arr = [...(form.images || [])];
                        arr[idx] = { ...arr[idx], url: e.target.value };
                        setForm({ ...form, images: arr });
                      }}
                    />
                    <Input
                      placeholder="Alt text"
                      value={img.alt}
                      onChange={(e) => {
                        const arr = [...(form.images || [])];
                        arr[idx] = { ...arr[idx], alt: e.target.value };
                        setForm({ ...form, images: arr });
                      }}
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        onClick={() => removeImage(idx)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {!(form.images || []).length && (
                  <div className="text-xs text-muted-foreground">No images</div>
                )}
              </div>
            </div>

            {/* description */}
            <div>
              <label className="text-sm">Description</label>
              <Input
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>

            {/* dimensions + weight */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm">Weight</label>
                <Input
                  value={String(form.weight ?? "")}
                  onChange={(e) => setForm({ ...form, weight: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm">Length</label>
                <Input
                  value={String(form.dimensions?.length ?? "")}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      dimensions: {
                        ...form.dimensions,
                        length: e.target.value,
                      },
                    })
                  }
                />
              </div>
              <div>
                <label className="text-sm">Width</label>
                <Input
                  value={String(form.dimensions?.width ?? "")}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      dimensions: { ...form.dimensions, width: e.target.value },
                    })
                  }
                />
              </div>
              <div>
                <label className="text-sm">Height</label>
                <Input
                  value={String(form.dimensions?.height ?? "")}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      dimensions: {
                        ...form.dimensions,
                        height: e.target.value,
                      },
                    })
                  }
                />
              </div>
            </div>

            {/* attributes (simple JSON textarea) */}
            <div>
              <label className="text-sm">Attributes (JSON)</label>
              <Input
                value={JSON.stringify(form.attributes || {})}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value || "{}");
                    setForm({ ...form, attributes: parsed });
                  } catch {
                    // don't update if invalid JSON, but keep raw string visible
                    // optional: show a validation error
                    setForm({ ...form, attributes: form.attributes });
                  }
                }}
              />
              <div className="text-xs text-muted-foreground mt-1">
                Provide a JSON object for custom attributes (e.g. {"{"}
                color:"red","size":"M"{"}"})
              </div>
            </div>

            {/* status */}
            <div>
              <label className="text-sm">Status</label>
              <Select
                value={form.status || NONE}
                onValueChange={(v) =>
                  setForm({ ...form, status: v === NONE ? "" : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Select Status</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                  <SelectItem value="Discontinued">Discontinued</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* actions */}
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  setEditing(null);
                  setForm({ ...defaultForm });
                }}
                type="button"
              >
                Cancel
              </Button>
              <Button type="submit">{editing?._id ? "Save" : "Create"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
