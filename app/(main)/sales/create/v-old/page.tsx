// src/app/sales-entry/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import api from "@/lib/api";
import { toast } from "sonner";
import { motion } from "framer-motion";

/* shadcn UI components (assumes they exist in your project) */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandGroup,
  CommandEmpty,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

/* icons */
import { Loader2, Check, ChevronsUpDown, Plus, Trash2 } from "lucide-react";

/* ---------- types ---------- */
type Row = {
  id: string;
  productId: string;
  productName: string;
  stock: number | string;
  batch: string;
  price: number;
  qty: number;
  discount: number; // percent
  bonus: number;
  promoAppliedId?: string | null;
};

type Dealer = {
  _id?: string;
  name?: string;
  phoneNumber?: string;
  label?: string;
};
type Warehouse = { _id?: string; name?: string };
type Product = {
  _id?: string;
  name?: string;
  sku?: string;
  salePrice?: number;
  stock?: number;
  defaultBonusRule?: { buyQty?: number; getQty?: number };
};

/* ---------- component ---------- */
export default function SalesEntryPage() {
  /* ---------- order number (organized) ---------- */
  const [orderNo, setOrderNo] = useState("");
  useEffect(() => {
    const d = new Date();
    const datePart = d.toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.floor(Math.random() * 9000 + 1000);
    setOrderNo(`SO-${datePart}-${rand}`);
  }, []);

  /* ---------- form ---------- */
  const { register, handleSubmit, watch, setValue, getValues, reset } = useForm(
    {
      defaultValues: {
        date: new Date().toISOString().slice(0, 10),
        payment_date: "",
        dealer_id: "",
        warehouse_id: "",
        salesperson: "",
        payment_method: "",
        remarks: "",
        paid_amount: 0,
      },
    },
  );

  /* ---------- data refs ---------- */
  const initialRows: Row[] = [
    {
      id: "row-1",
      productId: "",
      productName: "",
      stock: "0",
      batch: "",
      price: 0,
      qty: 0,
      discount: 0,
      bonus: 0,
      promoAppliedId: null,
    },
  ];
  const [rows, setRows] = useState<Row[]>(() => initialRows);

  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [lastPayload, setLastPayload] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const invoiceRef = useRef<HTMLDivElement | null>(null);

  // product popover open state keyed by row id
  const [productPopoverOpen, setProductPopoverOpen] = useState<string | null>(
    null,
  );
  // dealer popover state
  const [dealerOpen, setDealerOpen] = useState(false);

  // per-row timers for debounce
  const promoTimers = useRef<
    Record<string, ReturnType<typeof setTimeout> | null>
  >({});
  // debounce for dealer/warehouse change
  const dealerWarehouseDebounce = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // VAT percent editable
  const [vatPercent, setVatPercent] = useState<number>(5); // default 5%

  const VAT_RATE = vatPercent / 100;

  /* ---------- fetch initial references ---------- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingRefs(true);
      try {
        const [dRes, wRes, pRes] = await Promise.all([
          api
            .get("/dealers", { params: { page: 1, limit: 1000 } })
            .catch(() => ({ data: { data: [] } })),
          api
            .get("/warehouses", {
              params: { type: "Warehouse", page: 1, limit: 1000 },
            })
            .catch(() => ({ data: { data: [] } })),
          api
            .get("/products", { params: { page: 1, limit: 1000 } })
            .catch(() => ({ data: { data: [] } })),
        ]);

        if (!mounted) return;

        const dd = (dRes.data?.data || []).map((d: any) => ({
          _id: d._id ?? d.id,
          name: d.name ?? d.proprietor ?? d.label ?? d._id,
          phoneNumber: d.phoneNumber ?? d.phone ?? undefined,
          label: d.name
            ? `${d.name} ${d.phoneNumber ? `- ${d.phoneNumber}` : ""}`
            : d._id,
        }));

        const ww = (wRes.data?.data || []).map((w: any) => ({
          _id: w._id ?? w.id,
          name: w.name ?? w._id,
        }));

        const pp = (pRes.data?.data || []).map((p: any) => ({
          _id: p._id ?? p.id,
          name: p.name,
          sku: p.sku,
          salePrice: p.salePrice ?? p.sale_price ?? p.price ?? 0,
          stock: typeof p.stock !== "undefined" ? p.stock : 0,
          defaultBonusRule:
            p.defaultBonusRule ?? p.default_bonus_rule ?? undefined,
        }));

        setDealers(dd);
        setWarehouses(ww);
        setProducts(pp);
      } catch (err) {
        console.error("Failed to fetch refs", err);
        toast.error("Failed to load dealers/warehouses/products");
      } finally {
        if (mounted) setLoadingRefs(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  /* ---------- helpers ---------- */
  function updateRowById(id: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => {
      const nextId = `row-${prev.length + 1}`;
      return [
        ...prev,
        {
          id: nextId,
          productId: "",
          productName: "",
          stock: "0",
          batch: "",
          price: 0,
          qty: 0,
          discount: 0,
          bonus: 0,
          promoAppliedId: null,
        },
      ];
    });
  }

  function removeRow(idx: number) {
    const rid = rows[idx]?.id;
    if (rid && promoTimers.current[rid]) {
      clearTimeout(promoTimers.current[rid]!);
      promoTimers.current[rid] = null;
    }
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  /* ---------- stock fetch ---------- */
  async function fetchStockFor(productId: string, warehouseId?: string) {
    try {
      if (!productId || !warehouseId) return undefined;
      const res = await api.get("/product-stocks", {
        params: { productId, warehouseId, page: 1, limit: 1 },
      });
      const rowsData = res.data?.data || [];
      if (rowsData.length > 0) {
        return Number(rowsData[0].quantity ?? 0);
      }
      return undefined;
    } catch (err) {
      console.error("stock fetch failed", err);
      return undefined;
    }
  }

  /* ---------- promotion calculation per row (debounced) ---------- */
  function schedulePromoCalculationForRow(
    rowId: string,
    productId?: string,
    qty?: number,
  ) {
    if (!rowId) return;
    if (promoTimers.current[rowId]) {
      clearTimeout(promoTimers.current[rowId]!);
      promoTimers.current[rowId] = null;
    }
    promoTimers.current[rowId] = setTimeout(async () => {
      try {
        const currentRow = rows.find((r) => r.id === rowId);
        const pid = productId ?? currentRow?.productId;
        const q = typeof qty === "number" ? qty : currentRow?.qty;

        if (!pid || !q || q <= 0) {
          updateRowById(rowId, { bonus: 0, promoAppliedId: null });
          return;
        }

        const dealerId = getValues("dealer_id") || undefined;
        const warehouseId = getValues("warehouse_id") || undefined;

        const res = await api.get("/promotions/calculate-bonus", {
          params: {
            productId: pid,
            qty: q,
            customerId: dealerId,
            warehouseId: warehouseId,
          },
        });

        const data = res.data?.data ?? { bonusQty: 0 };
        const bonusQty = Number(data.bonusQty ?? 0);
        const appliedPromotionId = data.appliedPromotionId ?? null;

        setRows((prev) =>
          prev.map((r) =>
            r.id === rowId
              ? { ...r, bonus: bonusQty, promoAppliedId: appliedPromotionId }
              : r,
          ),
        );
      } catch (err) {
        console.error("promo calc error", err);
      } finally {
        promoTimers.current[rowId] = null;
      }
    }, 400);
  }

  /* ---------- coalesced recalculation when dealer/warehouse changes ---------- */
  function scheduleRecalcAllRowsCoalesced() {
    if (dealerWarehouseDebounce.current) {
      clearTimeout(dealerWarehouseDebounce.current);
      dealerWarehouseDebounce.current = null;
    }
    dealerWarehouseDebounce.current = setTimeout(async () => {
      const warehouseId = getValues("warehouse_id") || undefined;
      await Promise.all(
        rows.map(async (r) => {
          if (r.productId) {
            const stockQty =
              (await fetchStockFor(r.productId, warehouseId)) ?? r.stock ?? 0;
            updateRowById(r.id, { stock: stockQty });
          }
          schedulePromoCalculationForRow(r.id, r.productId, r.qty);
        }),
      );
      dealerWarehouseDebounce.current = null;
    }, 300);
  }

  /* ---------- watch dealer/warehouse ---------- */
  useEffect(() => {
    const unsubOrSub = watch((value, { name }) => {
      if (name === "dealer_id" || name === "warehouse_id") {
        scheduleRecalcAllRowsCoalesced();
      }
    });

    return () => {
      try {
        if (typeof unsubOrSub === "function") {
          unsubOrSub();
        } else {
          (unsubOrSub as any)?.unsubscribe?.();
        }
      } catch (e) {
        // ignore
      }
      if (dealerWarehouseDebounce.current) {
        clearTimeout(dealerWarehouseDebounce.current);
        dealerWarehouseDebounce.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  /* ---------- row product select ---------- */
  const onSelectProduct = async (idx: number, product?: Product | null) => {
    const row = rows[idx];
    const rowId = row?.id;
    if (!rowId) return;

    if (!product) {
      updateRowById(rowId, {
        productId: "",
        productName: "",
        price: 0,
        stock: "0",
        bonus: 0,
        promoAppliedId: null,
      });
      return;
    }

    const productId = product._id!;
    const salePrice = Number(product.salePrice ?? 0);
    const warehouseId = getValues("warehouse_id") || undefined;
    const stockQty =
      (await fetchStockFor(productId, warehouseId)) ?? product.stock ?? 0;

    updateRowById(rowId, {
      productId,
      productName: product.name || "",
      price: salePrice,
      stock: stockQty,
    });

    schedulePromoCalculationForRow(rowId, productId, row.qty);
  };

  /* ---------- qty change handler ---------- */
  const handleQtyChange = (rowId: string, value: number) => {
    const newQty = Math.max(0, Number(value) || 0);
    updateRowById(rowId, { qty: newQty });
    const r = rows.find((x) => x.id === rowId);
    const pid = r?.productId;
    schedulePromoCalculationForRow(rowId, pid, newQty);
  };

  /* ---------- calculations ---------- */
  const rowSubtotals = useMemo(
    () =>
      rows.map((r) => r.qty * r.price - (r.discount / 100) * (r.price * r.qty)),
    [rows],
  );

  const totalQty = rows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const subtotal = rowSubtotals.reduce((s, v) => s + (Number(v) || 0), 0);
  const vat = subtotal * VAT_RATE;
  const grandTotal = subtotal + vat;
  const paidAmount = Number(watch("paid_amount") || 0);
  const due = Math.max(0, grandTotal - paidAmount);

  /* ---------- build payload & submit ---------- */
  async function createSalesOrderOnServer(form: any, rowsData: Row[]) {
    const items = rowsData.map((r) => {
      const lineSubtotal =
        r.qty * r.price - ((r.discount || 0) / 100) * (r.price * r.qty);
      const taxAmount = lineSubtotal * VAT_RATE;
      const discountAmount = ((r.discount || 0) / 100) * (r.price * r.qty);
      const lineTotal = lineSubtotal + taxAmount;

      const item: any = {
        productId: r.productId,
        warehouseId: form.warehouse_id,
        qty: r.qty,
        bonusQty: r.bonus || 0,
        unitPrice: r.price,
        discountPercent: r.discount || 0,
        discountAmount,
        taxPercent: VAT_RATE * 100,
        taxAmount,
        lineSubtotal,
        lineTotal,
      };

      if (r.promoAppliedId) item.promotionId = r.promoAppliedId;
      return item;
    });

    const totalDiscount = items.reduce(
      (s: number, it: any) => s + (it.discountAmount || 0),
      0,
    );
    const totalTax = items.reduce(
      (s: number, it: any) => s + (it.taxAmount || 0),
      0,
    );
    const subTotal = items.reduce(
      (s: number, it: any) => s + (it.lineSubtotal || 0),
      0,
    );
    const grandTotalServer = subTotal + totalTax;
    const totalBonusQty = items.reduce(
      (s: number, it: any) => s + (it.bonusQty || 0),
      0,
    );

    const payload: any = {
      orderNo: orderNo,
      customerId: form.dealer_id,
      warehouseId: form.warehouse_id,
      orderDate: form.date || new Date().toISOString(),
      items,
      subTotal,
      totalDiscount,
      totalTax,
      grandTotal: grandTotalServer,
      totalBonusQty,
      notes: form.remarks || "",
      isInvoiced: false,
      status: "PENDING",
    };

    const res = await api.post("/sales-orders", payload);
    return res.data;
  }

  const onSubmit = async (data: any) => {
    if (!data.dealer_id) {
      toast.error("Please select a dealer.");
      return;
    }
    if (!data.warehouse_id) {
      toast.error("Please select a warehouse.");
      return;
    }
    if (rows.length === 0) {
      toast.error("Add at least one product row.");
      return;
    }
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.productId) {
        toast.error(`Row ${i + 1}: Select a product`);
        return;
      }
      if (!r.qty || r.qty <= 0) {
        toast.error(`Row ${i + 1}: Enter quantity`);
        return;
      }
      // stock warning (but still allow) - optional
      if (typeof r.stock === "number" && r.stock < r.qty) {
        const allow = confirm(
          `Row ${i + 1} (${r.productName}) has low stock (${r.stock}). Proceed?`,
        );
        if (!allow) return;
      }
    }

    setSubmitting(true);
    try {
      const serverResp = await createSalesOrderOnServer(data, rows);
      toast.success("Sales order created");
      const previewPayload = {
        orderNo: serverResp?.orderNo ?? orderNo,
        serverId: serverResp?._id ?? serverResp?.id,
        form: data,
        rows,
        totals: {
          totalQty,
          subtotal,
          vat,
          grandTotal,
          paidAmount,
          due,
        },
      };
      setLastPayload(previewPayload);
      setShowInvoice(true);
      // optionally reset form and rows:
      // reset(); setRows(initialRows);
    } catch (err: any) {
      console.error("create order error", err);
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to create order";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------- print helper ---------- */
  const handlePrint = () => {
    if (!invoiceRef.current) return window.print();
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return window.print();
    const html = `
      <html>
      <head><title>Order ${orderNo}</title>
        <style>
          body{font-family: Arial,Helvetica,sans-serif;padding:20px}
          table{width:100%;border-collapse:collapse;margin-top:12px}
          th,td{border:1px solid #ddd;padding:8px}
          th{background:#f7f7f7}
        </style>
      </head>
      <body>${invoiceRef.current.innerHTML}</body>
      </html>
    `;
    w.document.write(html);
    w.document.close();
    setTimeout(() => {
      w.print();
      w.close();
    }, 400);
  };

  /* cleanup timers on unmount */
  useEffect(() => {
    return () => {
      Object.keys(promoTimers.current).forEach((k) => {
        if (promoTimers.current[k]) clearTimeout(promoTimers.current[k] as any);
      });
      if (dealerWarehouseDebounce.current) {
        clearTimeout(dealerWarehouseDebounce.current);
        dealerWarehouseDebounce.current = null;
      }
    };
  }, []);

  const fmt = (v: number) =>
    v.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  /* ---------- render ---------- */
  return (
    <div className="min-h-screen p-6 bg-slate-50">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Sales Entry</h1>
          <div className="flex gap-2 items-center">
            <div className="text-sm text-muted-foreground">Order</div>
            <div className="font-semibold text-lg">{orderNo}</div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Order & Dates</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3">
                  <label className="text-sm font-medium">Date</label>
                  <Input {...register("date")} type="date" />
                  <label className="text-sm font-medium mt-3">P.R. Date</label>
                  <Input {...register("payment_date")} type="date" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Location & Dealer</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Dealer searchable popover (search by name or phone) */}
                  <div>
                    <div className="text-sm font-medium mb-1">Dealer</div>
                    <Popover open={dealerOpen} onOpenChange={setDealerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-between"
                        >
                          {watch("dealer_id")
                            ? (dealers.find((d) => d._id === watch("dealer_id"))
                                ?.name ?? watch("dealer_id"))
                            : "Select dealer"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>

                      <PopoverContent className="w-full p-0">
                        <Command>
                          <CommandInput placeholder="Search by name or phone..." />
                          <CommandEmpty>No dealer found.</CommandEmpty>
                          <CommandGroup>
                            {dealers.map((dealer) => (
                              <CommandItem
                                key={dealer._id}
                                value={`${dealer.name} ${dealer.phoneNumber}`}
                                onSelect={() => {
                                  setValue("dealer_id", dealer._id);
                                  setDealerOpen(false);
                                  scheduleRecalcAllRowsCoalesced();
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    watch("dealer_id") === dealer._id
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                                <div className="flex items-center justify-between w-full">
                                  <div>
                                    <div className="font-medium">
                                      {dealer.name}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {dealer.phoneNumber}
                                    </div>
                                  </div>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Warehouse select */}
                  <div>
                    <div className="text-sm font-medium mb-1">Warehouse</div>
                    <select
                      {...register("warehouse_id")}
                      className="w-full border rounded px-3 py-2"
                      onChange={(e) => {
                        setValue("warehouse_id", e.target.value);
                        scheduleRecalcAllRowsCoalesced();
                      }}
                    >
                      <option value="">Select Warehouse</option>
                      {warehouses.map((w) => (
                        <option key={w._id} value={w._id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="text-sm font-medium mb-1">Salesperson</div>
                    <Input {...register("salesperson")} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <div className="text-sm font-medium mb-1">
                      Payment Method
                    </div>
                    <select
                      {...register("payment_method")}
                      className="w-full border rounded px-3 py-2"
                    >
                      <option value="">Select</option>
                      <option value="CASH">Cash</option>
                      <option value="BANK_TRANSFER">Bank</option>
                      <option value="CHEQUE">Cheque</option>
                      <option value="CREDIT">Credit</option>
                    </select>
                  </div>

                  <div>
                    <div className="text-sm font-medium mb-1">Paid Amount</div>
                    <Input {...register("paid_amount")} type="number" />
                  </div>

                  <div>
                    <div className="text-sm font-medium mb-1">VAT (%)</div>
                    <Input
                      value={vatPercent}
                      type="number"
                      onChange={(e) => {
                        const v = Number(e.target.value || 0);
                        setVatPercent(v);
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* products */}
          <Card>
            <CardHeader>
              <CardTitle>Products</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Add items to the order. Promotions are applied automatically.
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={addRow} size="sm">
                    <Plus className="mr-2 h-4 w-4" /> Add Row
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                {rows.map((r, idx) => {
                  const subtotalRow =
                    r.qty * r.price - (r.discount / 100) * (r.price * r.qty);
                  return (
                    <div
                      key={r.id}
                      className="grid grid-cols-12 gap-3 items-end border rounded p-3 bg-white"
                    >
                      <div className="col-span-12 md:col-span-4">
                        <div className="text-sm font-medium mb-1">Product</div>

                        <Popover
                          open={productPopoverOpen === r.id}
                          onOpenChange={(v) =>
                            setProductPopoverOpen(v ? r.id : null)
                          }
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-between"
                            >
                              {r.productName || "Select product"}
                              <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                            </Button>
                          </PopoverTrigger>

                          <PopoverContent className="w-full max-w-md p-0">
                            <Command>
                              <CommandInput placeholder="Search product..." />
                              <CommandEmpty>No product found.</CommandEmpty>
                              <CommandGroup>
                                {products.map((product) => (
                                  <CommandItem
                                    key={product._id}
                                    value={product.name}
                                    onSelect={() => {
                                      onSelectProduct(idx, product);
                                      setProductPopoverOpen(null);
                                    }}
                                  >
                                    {product.name}
                                    <div className="text-xs text-muted-foreground ml-2">
                                      {product.sku}
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="col-span-6 md:col-span-1">
                        <div className="text-sm font-medium mb-1">Stock</div>
                        <div className="font-medium">{r.stock ?? "-"}</div>
                      </div>

                      <div className="col-span-6 md:col-span-1">
                        <div className="text-sm font-medium mb-1">Batch</div>
                        <Input
                          value={r.batch}
                          onChange={(e) =>
                            updateRowById(r.id, { batch: e.target.value })
                          }
                        />
                      </div>

                      <div className="col-span-6 md:col-span-1">
                        <div className="text-sm font-medium mb-1">Price</div>
                        <Input
                          type="number"
                          value={r.price}
                          onChange={(e) =>
                            updateRowById(r.id, {
                              price: Number(e.target.value),
                            })
                          }
                          disabled
                        />
                      </div>

                      <div className="col-span-6 md:col-span-1">
                        <div className="text-sm font-medium mb-1">Qty</div>
                        <Input
                          type="number"
                          value={r.qty}
                          onChange={(e) =>
                            handleQtyChange(r.id, Number(e.target.value))
                          }
                        />
                      </div>

                      <div className="col-span-6 md:col-span-1">
                        <div className="text-sm font-medium mb-1">Bonus</div>
                        <Input type="number" value={r.bonus} disabled />
                      </div>

                      <div className="col-span-6 md:col-span-1">
                        <div className="text-sm font-medium mb-1">Subtotal</div>
                        <div className="font-medium">
                          {fmt(Number(subtotalRow || 0))}
                        </div>
                      </div>

                      <div className="col-span-12 md:col-span-1 flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => addRow()}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        {rows.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeRow(idx)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* totals & payment */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <div className="text-sm font-medium mb-1">Remarks</div>
                  <textarea
                    {...register("remarks")}
                    className="w-full border rounded px-3 py-2"
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Totals</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <div className="text-sm text-muted-foreground">
                      Total Qty
                    </div>
                    <div className="font-semibold">{totalQty}</div>
                  </div>

                  <div className="flex justify-between">
                    <div className="text-sm text-muted-foreground">
                      Subtotal
                    </div>
                    <div className="font-semibold">{fmt(subtotal)}</div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">VAT (%)</div>
                    <Input
                      type="number"
                      value={vatPercent}
                      onChange={(e) =>
                        setVatPercent(Number(e.target.value || 0))
                      }
                      className="w-20"
                    />
                  </div>

                  <div className="flex justify-between">
                    <div className="text-sm text-muted-foreground">
                      VAT Amount
                    </div>
                    <div className="font-semibold">{fmt(vat)}</div>
                  </div>

                  <div className="flex justify-between mt-2 border-t pt-2">
                    <div className="text-lg font-bold">Grand Total</div>
                    <div className="text-lg font-bold text-indigo-600">
                      {fmt(grandTotal)}
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <div className="text-sm text-muted-foreground">Due</div>
                    <div className="font-semibold text-red-600">{fmt(due)}</div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <Button
                      type="submit"
                      disabled={submitting || loadingRefs}
                      className="w-full text-lg"
                    >
                      {submitting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      {submitting ? "Processing Sale..." : "Confirm Sale"}
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => {
                        if (!confirm("Reset form?")) return;
                        reset();
                        setRows(initialRows);
                      }}
                      className="w-full"
                    >
                      Reset
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </form>

        {/* Invoice preview modal (shows server created order when available) */}
        {showInvoice && lastPayload && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-4xl rounded shadow-lg overflow-auto"
            >
              <div className="p-4 flex items-center justify-between border-b">
                <div>
                  <h2 className="text-xl font-bold">Order Preview</h2>
                  <div className="text-sm text-muted-foreground">
                    Order: {lastPayload.orderNo}
                  </div>
                  {lastPayload.serverId && (
                    <div className="text-xs text-muted-foreground">
                      Server ID: {lastPayload.serverId}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => setShowInvoice(false)} variant="ghost">
                    Close
                  </Button>
                  <Button onClick={handlePrint}>Print</Button>
                </div>
              </div>

              <div ref={invoiceRef} className="p-6 text-sm">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold">Antab Agro</h3>
                    <div className="text-sm text-muted-foreground">
                      Sales Order
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                      {new Date().toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div>
                      Order: <strong>{lastPayload.orderNo}</strong>
                    </div>
                    <div>
                      Dealer:{" "}
                      <strong>
                        {dealers.find(
                          (d) => d._id === lastPayload.form.dealer_id,
                        )?.name ?? lastPayload.form.dealer_id}
                      </strong>
                    </div>
                    <div>
                      Warehouse:{" "}
                      <strong>
                        {warehouses.find(
                          (w) => w._id === lastPayload.form.warehouse_id,
                        )?.name ?? lastPayload.form.warehouse_id}
                      </strong>
                    </div>
                  </div>
                </div>

                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="border px-2 py-2 text-left">#</th>
                      <th className="border px-2 py-2 text-left">Product</th>
                      <th className="border px-2 py-2 text-right">Qty</th>
                      <th className="border px-2 py-2 text-right">Price</th>
                      <th className="border px-2 py-2 text-right">Bonus</th>
                      <th className="border px-2 py-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lastPayload.rows.map((r: Row, ix: number) => {
                      const ss =
                        r.qty * r.price -
                        (r.discount / 100) * (r.price * r.qty);
                      return (
                        <tr key={r.id}>
                          <td className="border px-2 py-2">{ix + 1}</td>
                          <td className="border px-2 py-2">
                            {r.productName || r.productId}
                          </td>
                          <td className="border px-2 py-2 text-right">
                            {r.qty}
                          </td>
                          <td className="border px-2 py-2 text-right">
                            {fmt(r.price)}
                          </td>
                          <td className="border px-2 py-2 text-right">
                            {r.bonus ?? 0}
                          </td>
                          <td className="border px-2 py-2 text-right">
                            {fmt(ss)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td
                        colSpan={5}
                        className="border px-2 py-2 text-right font-semibold"
                      >
                        Subtotal
                      </td>
                      <td className="border px-2 py-2 text-right font-semibold">
                        {fmt(lastPayload.totals.subtotal)}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={5} className="border px-2 py-2 text-right">
                        VAT ({vatPercent}%)
                      </td>
                      <td className="border px-2 py-2 text-right">
                        {fmt(lastPayload.totals.vat)}
                      </td>
                    </tr>
                    <tr>
                      <td
                        colSpan={5}
                        className="border px-2 py-2 text-right font-bold"
                      >
                        Grand Total
                      </td>
                      <td className="border px-2 py-2 text-right font-bold">
                        {fmt(lastPayload.totals.grandTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>

                <div className="mt-6 flex justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground">Remarks</div>
                    <div className="text-sm">
                      {lastPayload.form.remarks || "—"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div>
                      Paid:{" "}
                      <strong>{fmt(lastPayload.totals.paidAmount)}</strong>
                    </div>
                    <div>
                      Due:{" "}
                      <strong className="text-red-600">
                        {fmt(lastPayload.totals.due)}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
