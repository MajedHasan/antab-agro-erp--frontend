"use client";

import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
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
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Trash2, Save, X, FileText } from "lucide-react";
import { toast } from "sonner";
import type {
  ItemForm,
  WorkOrderForm,
  WorkOrderItemType,
} from "./workOrderShared";

/* =========================== Local types =========================== */
type LookupItem = {
  _id: string;
  name?: string;
  supplierName?: string;
  unit?: string;
  salePrice?: number;
  purchasePrice?: number;
};

type WorkOrderDialogProps = {
  openEdit: boolean;
  setOpenEdit: React.Dispatch<React.SetStateAction<boolean>>;
  form: WorkOrderForm | null;
  setForm: React.Dispatch<React.SetStateAction<WorkOrderForm | null>>;
  editing: WorkOrderForm | null;
  setEditing: React.Dispatch<React.SetStateAction<WorkOrderForm | null>>;
  suppliers: LookupItem[];
  warehouses: LookupItem[];
  StatusBadge: React.ComponentType<{ status?: string }>;
  loadWorkOrders?: () => void;
};

type TermsTemplate = { _id?: string; title: string; content: string };

/* =========================== Constants =========================== */
const NONE = "none";

const STATUS_OPTIONS = [
  "Pending",
  "Processing",
  "UnderReview",
  "Approved",
  "Completed",
  "Cancelled",
];

const ITEM_TYPE_OPTIONS: {
  value: WorkOrderItemType;
  label: string;
  emptyText: string;
  placeholder: string;
}[] = [
  { value: "RawMaterial", label: "Raw Material", emptyText: "No raw materials", placeholder: "Search raw material..." },
  { value: "PackagingItem", label: "Packaging", emptyText: "No packaging items", placeholder: "Search packaging..." },
  { value: "Product", label: "Product", emptyText: "No products", placeholder: "Search product..." },
  { value: "OtherProducts", label: "Other Product", emptyText: "No other products", placeholder: "Search other product..." },
];

const DEFAULT_TEMPLATES: TermsTemplate[] = [
  { _id: "tmpl-1", title: "Default Terms", content: "1. Payment due within 30 days.\n2. Goods remain property of supplier until paid.\n3. Warranty as per manufacturer's terms." },
  { _id: "tmpl-2", title: "Standard Terms", content: "1. 50% advance.\n2. Delivery subject to stock.\n3. Claims within 7 days." },
];

const moneyFormatter = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* =========================== Helpers =========================== */
function getId(v?: any) {
  if (!v) return "";
  if (typeof v === "string") return v;
  return v._id ?? "";
}

function round2(n: number) { return Math.round(Number(n || 0) * 100) / 100; }

function createEmptyItem(): ItemForm {
  return {
    itemType: "RawMaterial",
    itemId: "",
    name: "",
    description: "",
    quantity: 1,
    unit: "",
    unitPrice: 0,
    lineTotal: 0,
    remarks: "",
  };
}

function formatCurrency(n?: number | null) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "-";
  return moneyFormatter.format(round2(Number(n)));
}

function numberToWords(num: number) {
  if (Number.isNaN(num) || !Number.isFinite(num)) return "";
  const a = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const b = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  function toWords(n: number): string {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? "-" + a[n % 10] : "");
    if (n < 1000) return a[Math.floor(n / 100)] + " hundred" + (n % 100 ? " " + toWords(n % 100) : "");
    if (n < 1000000) return toWords(Math.floor(n / 1000)) + " thousand" + (n % 1000 ? " " + toWords(n % 1000) : "");
    return toWords(Math.floor(n / 1000000)) + " million" + (n % 1000000 ? " " + toWords(n % 1000000) : "");
  }
  const intPart = Math.floor(Math.abs(num));
  const cents = Math.round((Math.abs(num) - intPart) * 100);
  const sign = num < 0 ? "minus " : "";
  const words = intPart === 0 ? "zero" : toWords(intPart);
  return `${sign}${words}${cents > 0 ? ` and ${cents}/100` : ""}`;
}

function computeTotals(items: ItemForm[] = [], discountPercent = 0, taxPercent = 0) {
  let sub = 0;
  const cloned = items.map((it) => ({ ...it }));
  for (let i = 0; i < cloned.length; i++) {
    const q = Number(cloned[i].quantity || 0);
    const p = Number(cloned[i].unitPrice || 0);
    const line = round2(q * p);
    cloned[i].lineTotal = line;
    sub = round2(sub + line);
  }
  const discountAmount = round2(sub * (Number(discountPercent || 0) / 100));
  const taxedBase = round2(sub - discountAmount);
  const taxAmount = round2(taxedBase * (Number(taxPercent || 0) / 100));
  const grand = round2(taxedBase + taxAmount);
  return { items: cloned, subTotal: sub, discountAmount, taxTotal: taxAmount, grandTotal: grand };
}

function withTotals(base: WorkOrderForm, items: ItemForm[], extra: Partial<WorkOrderForm> = {}): WorkOrderForm {
  const merged = { ...base, ...extra } as WorkOrderForm;
  const totals = computeTotals(items, Number(merged.discountPercent || 0), Number(merged.taxPercent || 0));
  return {
    ...merged,
    items: totals.items,
    discountPercent: Number(merged.discountPercent || 0),
    taxPercent: Number(merged.taxPercent || 0),
    subTotal: totals.subTotal,
    discountAmount: totals.discountAmount,
    taxTotal: totals.taxTotal,
    grandTotal: totals.grandTotal,
  };
}

function supplierLabel(item: any) {
  return item?.supplierName || item?.name || "";
}

function itemLabel(item: any) {
  return item?.name || "";
}

/* ✅ FIX: relax _id to optional so TermsTemplate[] fits */
function useLookupMap<T extends { _id?: string }>(items: T[]) {
  return useMemo(() => {
    const m = new Map<string, T>();
    for (const item of items) if (item._id) m.set(item._id, item);
    return m;
  }, [items]);
}

/* =========================== LocalSearchSelect =========================== */
type LocalSearchSelectProps = {
  options: any[];
  value?: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
  getLabel: (item: any) => string;
  emptyText?: string;
};

const LocalSearchSelect = memo(function LocalSearchSelect({
  options, value, onChange, placeholder = "Search...", getLabel, emptyText = "No results",
}: LocalSearchSelectProps) {
  const [query, setQuery] = useState("");

  const selectedLabel = useMemo(() => {
    if (!value) return "";
    const found = options.find((o) => getId(o) === value);
    return found ? getLabel(found) : "";
  }, [options, value, getLabel]);

  useEffect(() => {
    if (!value) { setQuery(""); return; }
    if (selectedLabel) setQuery(selectedLabel);
  }, [value, selectedLabel]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const list = term
      ? options.filter((item) => getLabel(item).toLowerCase().includes(term))
      : options;
    return list.slice(0, 50);
  }, [options, query, getLabel]);

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        <Input
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-9"
        />
        {value && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => { setQuery(""); onChange(null); }}
            className="h-9 w-9 p-0 text-slate-400 hover:text-slate-700"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="max-h-40 overflow-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {filtered.length === 0 ? (
          <div className="p-2 text-xs text-slate-500 dark:text-slate-400">{emptyText}</div>
        ) : filtered.map((it) => {
          const id = getId(it);
          const label = getLabel(it);
          const active = id === value;
          return (
            <button
              key={id}
              type="button"
              className={`block w-full px-2.5 py-1.5 text-left text-xs transition-colors ${
                active ? "bg-[#3aa838]/10 font-semibold text-[#2f8a2f]" : "hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(id); setQuery(label); }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
});

/* =========================== Item row =========================== */
type ItemRowProps = {
  index: number;
  item: ItemForm;
  rawMaterials: LookupItem[];
  packagingItems: LookupItem[];
  products: LookupItem[];
  otherProducts: LookupItem[];
  onUpdate: (index: number, patch: Partial<ItemForm>) => void;
  onSelectItem: (index: number, itemType: WorkOrderItemType, itemId: string) => void;
  onRemove: (index: number) => void;
};

const WorkOrderItemRow = memo(function WorkOrderItemRow({
  index, item, rawMaterials, packagingItems, products, otherProducts, onUpdate, onSelectItem, onRemove,
}: ItemRowProps) {
  const currentType = (item.itemType as WorkOrderItemType) || "RawMaterial";
  const selectedId = getId(item.itemId) || "";
  const itemConfig = ITEM_TYPE_OPTIONS.find((t) => t.value === currentType) ?? ITEM_TYPE_OPTIONS[0];

  return (
    <tr className="border-t border-slate-100 dark:border-slate-800">
      <td className="p-2 align-top text-[11px] font-medium text-slate-400">{index + 1}</td>

      <td className="p-2 align-top">
        <div className="flex flex-col gap-1.5">
          <Select
            value={currentType}
            onValueChange={(v) =>
              onUpdate(index, {
                itemType: v as WorkOrderItemType,
                itemId: "",
                name: "",
                unit: "",
                unitPrice: 0,
                lineTotal: 0,
                remarks: "",
              })
            }
          >
            <SelectTrigger className="h-8 w-36 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="RawMaterial">Raw Material</SelectItem>
              <SelectItem value="PackagingItem">Packaging</SelectItem>
              <SelectItem value="Product">Product</SelectItem>
              <SelectItem value="OtherProducts">Other Product</SelectItem>
            </SelectContent>
          </Select>

          <div style={{ minWidth: 200 }}>
            {currentType === "RawMaterial" ? (
              <LocalSearchSelect options={rawMaterials} value={selectedId} onChange={(v) => onSelectItem(index, "RawMaterial", v || "")} placeholder={itemConfig.placeholder} getLabel={itemLabel} emptyText={itemConfig.emptyText} />
            ) : currentType === "PackagingItem" ? (
              <LocalSearchSelect options={packagingItems} value={selectedId} onChange={(v) => onSelectItem(index, "PackagingItem", v || "")} placeholder={itemConfig.placeholder} getLabel={itemLabel} emptyText={itemConfig.emptyText} />
            ) : currentType === "Product" ? (
              <LocalSearchSelect options={products} value={selectedId} onChange={(v) => onSelectItem(index, "Product", v || "")} placeholder={itemConfig.placeholder} getLabel={itemLabel} emptyText={itemConfig.emptyText} />
            ) : (
              <LocalSearchSelect options={otherProducts} value={selectedId} onChange={(v) => onSelectItem(index, "OtherProducts", v || "")} placeholder={itemConfig.placeholder} getLabel={itemLabel} emptyText={itemConfig.emptyText} />
            )}
          </div>
        </div>
      </td>

      <td className="p-2 align-top">
        <Input value={item.description || ""} onChange={(e) => onUpdate(index, { description: e.target.value })} className="h-8 text-xs" />
      </td>

      <td className="p-2 align-top text-right">
        <Input type="number" min={0} value={String(item.quantity ?? "")} onChange={(e) => onUpdate(index, { quantity: e.target.value === "" ? 0 : Number(e.target.value) })} className="h-8 w-16 text-right text-xs" />
      </td>

      <td className="p-2 align-top text-right">
        <Input value={item.unit || ""} onChange={(e) => onUpdate(index, { unit: e.target.value })} className="h-8 w-14 text-right text-xs" />
      </td>

      <td className="p-2 align-top text-right">
        <Input type="number" min={0} value={String(item.unitPrice ?? "")} onChange={(e) => onUpdate(index, { unitPrice: e.target.value === "" ? 0 : Number(e.target.value) })} className="h-8 w-20 text-right text-xs" />
      </td>

      <td className="p-2 align-top text-right text-xs font-semibold text-slate-900 dark:text-white">
        {formatCurrency(item.lineTotal)}
      </td>
      <td className="p-2 align-top text-right">
        <Input type="text" value={String(item.remarks ?? "")} onChange={(e) => onUpdate(index, { remarks: e.target.value })} className="h-8 w-24 text-right text-xs" />
      </td>

      <td className="p-2 align-top">
        <Button type="button" size="sm" variant="ghost" onClick={() => onRemove(index)} className="h-8 w-8 p-0 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </td>
    </tr>
  );
});

/* =========================== Small UI =========================== */
const Section = memo(function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">{title}</div>
      {children}
    </div>
  );
});

function LabelField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">{label}</label>
      {children}
    </div>
  );
}

/* =========================== Main component =========================== */
function WorkOrderAddEditDialog({
  openEdit, setOpenEdit, form, setForm, editing, setEditing,
  suppliers, warehouses, StatusBadge, loadWorkOrders,
}: WorkOrderDialogProps) {
  const [rawMaterials, setRawMaterials] = useState<LookupItem[]>([]);
  const [packagingItems, setPackagingItems] = useState<LookupItem[]>([]);
  const [products, setProducts] = useState<LookupItem[]>([]);
  const [otherProducts, setOtherProducts] = useState<LookupItem[]>([]);
  const [templates, setTemplates] = useState<TermsTemplate[]>([]);

  const rawMap = useLookupMap(rawMaterials);
  const packMap = useLookupMap(packagingItems);
  const productMap = useLookupMap(products);
  const otherProductMap = useLookupMap(otherProducts);
  const supplierMap = useLookupMap(suppliers);
  const warehouseMap = useLookupMap(warehouses);
  const templateMap = useLookupMap(templates);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [rawRes, packRes, productRes, otherRes, tmplRes] = await Promise.allSettled([
          api.get("/raw-materials", { params: { limit: 1000 } }),
          api.get("/packaging-items", { params: { limit: 1000 } }),
          api.get("/products", { params: { limit: 1000 } }),
          api.get("/other-products", { params: { limit: 1000 } }),
          api.get("/settings/workorder-terms"),
        ]);
        if (!alive) return;
        setRawMaterials(rawRes.status === "fulfilled" ? rawRes.value?.data?.data || [] : []);
        setPackagingItems(packRes.status === "fulfilled" ? packRes.value?.data?.data || [] : []);
        setProducts(productRes.status === "fulfilled" ? productRes.value?.data?.data || [] : []);
        setOtherProducts(otherRes.status === "fulfilled" ? otherRes.value?.data?.data || [] : []);
        const serverTemplates = tmplRes.status === "fulfilled" ? tmplRes.value?.data?.data : null;
        setTemplates(Array.isArray(serverTemplates) && serverTemplates.length > 0 ? serverTemplates : DEFAULT_TEMPLATES);
      } catch {
        if (!alive) return;
        setRawMaterials([]);
        setPackagingItems([]);
        setProducts([]);
        setOtherProducts([]);
        setTemplates(DEFAULT_TEMPLATES);
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!openEdit || editing?._id) return;
    if (!form || form.workOrderNo) return;
    let alive = true;
    (async () => {
      try {
        const res = await api.get("/workorders/generate-no");
        if (!alive) return;
        const nextNo = res?.data?.data;
        if (nextNo) setForm((prev) => (prev ? { ...prev, workOrderNo: nextNo } : prev));
      } catch { /* silent */ }
    })();
    return () => { alive = false; };
  }, [editing?._id, form, openEdit, setForm]);

  const closeDialog = useCallback(() => {
    setOpenEdit(false);
    setForm(null);
    setEditing(null);
  }, [setEditing, setForm, setOpenEdit]);

  const setField = useCallback((patch: Partial<WorkOrderForm>) => {
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));
  }, [setForm]);

  const addItemRow = useCallback(() => {
    setForm((prev) => {
      if (!prev) return prev;
      const nextItems = [...(prev.items || []), createEmptyItem()];
      return withTotals(prev, nextItems);
    });
  }, [setForm]);

  const removeItemRow = useCallback((index: number) => {
    setForm((prev) => {
      if (!prev) return prev;
      const nextItems = (prev.items || []).filter((_, i) => i !== index);
      return withTotals(prev, nextItems);
    });
  }, [setForm]);

  const updateItemField = useCallback((index: number, patch: Partial<ItemForm>) => {
    setForm((prev) => {
      if (!prev) return prev;
      const nextItems = (prev.items || []).map((it, i) => i === index ? { ...(it || {}), ...patch } : it);
      return withTotals(prev, nextItems);
    });
  }, [setForm]);

  const selectItemForRow = useCallback((index: number, itemType: WorkOrderItemType, itemId: string) => {
    setForm((prev) => {
      if (!prev) return prev;
      let sourceMap: Map<string, LookupItem>;
      switch (itemType) {
        case "RawMaterial": sourceMap = rawMap as Map<string, LookupItem>; break;
        case "PackagingItem": sourceMap = packMap as Map<string, LookupItem>; break;
        case "Product": sourceMap = productMap as Map<string, LookupItem>; break;
        case "OtherProducts": sourceMap = otherProductMap as Map<string, LookupItem>; break;
        default: sourceMap = new Map();
      }
      const picked = sourceMap.get(itemId);
      const nextItems = (prev.items || []).map((it, i) =>
        i === index
          ? {
              ...(it || {}),
              itemType,
              itemId,
              name: picked?.name || it.name || "",
              description: it.description || picked?.name || "",
              unit: picked?.unit || it.unit || "",
              unitPrice: Number(picked?.salePrice ?? picked?.purchasePrice ?? it.unitPrice ?? 0),
              /* ✅ FIX: LookupItem has no `remarks` — cast preserves runtime, type-safe */
              remarks: it.remarks || (picked as any)?.remarks || "",
            }
          : it,
      );
      return withTotals(prev, nextItems);
    });
  }, [otherProductMap, packMap, productMap, rawMap, setForm]);

  const updateDiscountTax = useCallback((discountPercent?: number | null, taxPercent?: number | null) => {
    setForm((prev) => {
      if (!prev) return prev;
      const nextDiscount = discountPercent !== undefined && discountPercent !== null ? Number(discountPercent) : Number(prev.discountPercent || 0);
      const nextTax = taxPercent !== undefined && taxPercent !== null ? Number(taxPercent) : Number(prev.taxPercent || 0);
      const totals = computeTotals(prev.items || [], nextDiscount, nextTax);
      return {
        ...prev,
        discountPercent: nextDiscount,
        taxPercent: nextTax,
        items: totals.items,
        subTotal: totals.subTotal,
        discountAmount: totals.discountAmount,
        taxTotal: totals.taxTotal,
        grandTotal: totals.grandTotal,
      };
    });
  }, [setForm]);

  const applyTemplate = useCallback((templateId: string | null) => {
    setForm((prev) => {
      if (!prev) return prev;
      if (!templateId || templateId === NONE || templateId === "custom") {
        return { ...prev, selectedTemplateId: null, terms: "" };
      }
      const tmpl = templateMap.get(templateId);
      if (!tmpl) return { ...prev, selectedTemplateId: null, terms: "" };
      return { ...prev, selectedTemplateId: tmpl._id ?? null, terms: tmpl.content };
    });
  }, [setForm, templateMap]);

  const saveDraft = useCallback(() => {
    try {
      if (!form) return;
      localStorage.setItem("wo_draft", JSON.stringify(form));
      toast.success("Draft saved");
    } catch {
      toast.error("Failed to save draft");
    }
  }, [form]);

  const submitForm = useCallback(async () => {
    const current = form ?? {};
    try {
      if (!current.supplier) return toast.error("Select supplier");
      if (!current.warehouseOrFactory) return toast.error("Select warehouse/factory");
      if (!current.issueDate) return toast.error("Select issue date");
      const items = current.items || [];
      if (items.length === 0) return toast.error("Add at least one item");
      for (const [idx, it] of items.entries()) {
        if (!it.itemType) return toast.error(`Row ${idx + 1}: select item type`);
        if (!it.itemId) return toast.error(`Row ${idx + 1}: select item`);
        if (!it.quantity || Number(it.quantity) <= 0) return toast.error(`Row ${idx + 1}: quantity must be > 0`);
      }

      const totals = computeTotals(items, Number(current.discountPercent || 0), Number(current.taxPercent || 0));
      const payload: any = {
        workOrderNo: current.workOrderNo,
        supplier: getId(current.supplier),
        warehouseOrFactory: getId(current.warehouseOrFactory),
        issueDate: current.issueDate,
        expectedDeliveryDate: current.expectedDeliveryDate || undefined,
        subject: current.subject || "",
        reference: current.reference || "",
        attention: current.attention || "",
        salutation: current.salutation || "",
        items: totals.items.map((it) => ({
          itemType: it.itemType,
          itemId: getId(it.itemId),
          name: it.name || "",
          description: it.description || "",
          quantity: Number(it.quantity || 0),
          unit: it.unit || "",
          unitPrice: Number(it.unitPrice || 0),
          lineTotal: Number(it.lineTotal || 0),
          remarks: it.remarks || "",
        })),
        status: current.status || "Pending",
        notes: current.notes || "",
        terms: current.terms || "",
        discountPercent: Number(current.discountPercent || 0),
        taxPercent: Number(current.taxPercent || 0),
        subTotal: totals.subTotal,
        discountAmount: totals.discountAmount,
        taxTotal: totals.taxTotal,
        grandTotal: totals.grandTotal,
        footerNote: current.footerNote || "",
      };

      if (editing?._id) {
        await api.put(`/workorders/${editing._id}`, payload);
        toast.success("Work order updated");
      } else {
        await api.post("/workorders", payload);
        toast.success("Work order created");
      }
      closeDialog();
      loadWorkOrders?.();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Save failed");
    }
  }, [closeDialog, editing?._id, form, loadWorkOrders]);

  const selectedSupplierName = useMemo(() => {
    const id = getId(form?.supplier);
    const found = supplierMap.get(id);
    return (
      found?.supplierName ||
      found?.name ||
      (typeof form?.supplier === "object"
        ? (form?.supplier as any)?.supplierName || (form?.supplier as any)?.name
        : "")
    );
  }, [form?.supplier, supplierMap]);

  const selectedWarehouseName = useMemo(() => {
    const id = getId(form?.warehouseOrFactory);
    const found = warehouseMap.get(id);
    return found?.name || "";
  }, [form?.warehouseOrFactory, warehouseMap]);

  const itemCount = form?.items?.length || 0;

  const getItemName = useCallback((it: ItemForm) => {
    const id = getId(it.itemId);
    switch (it.itemType) {
      case "RawMaterial": return rawMap.get(id)?.name || it.name || "-";
      case "PackagingItem": return packMap.get(id)?.name || it.name || "-";
      case "Product": return productMap.get(id)?.name || it.name || "-";
      case "OtherProducts": return otherProductMap.get(id)?.name || it.name || "-";
      default: return it.name || "-";
    }
  }, [otherProductMap, packMap, productMap, rawMap]);

  return (
    <Dialog open={openEdit} onOpenChange={(isOpen) => { if (!isOpen) closeDialog(); }}>
      {/* ✅ FIX: h-[95vh] (was h-full — didn't resolve on fixed-positioned parent) */}
      <DialogContent
        className="!w-full !max-w-[98vw] h-[95vh] overflow-hidden p-0 gap-0 rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950 flex flex-col"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">
          {editing ? "Edit Work Order" : "Create Work Order"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Form to create or edit a work order.
        </DialogDescription>

        {/* HEADER */}
        <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-3.5 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3aa838]/10 text-[#3aa838]">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold tracking-tight text-slate-900 dark:text-white md:text-lg">
                    {editing ? "Edit Work Order" : "Create Work Order"}
                  </h3>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    WO# <span className="font-mono font-semibold text-slate-900 dark:text-white">{form?.workOrderNo || "-"}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <Button type="button" variant="outline" size="sm" onClick={saveDraft} className="h-8 text-xs">
                Save Draft
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={submitForm}
                className="h-8 gap-1 bg-[#3aa838] text-xs text-white hover:bg-[#2f8a2f]"
              >
                <Save className="h-3 w-3" />
                {editing ? "Save" : "Create"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={closeDialog} className="h-8 w-8 p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* BODY — 2 columns */}
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden xl:grid-cols-[42%_58%]">
          {/* LEFT — form */}
          <div className="min-h-0 overflow-y-auto border-r border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950 lg:p-5">
            <div className="space-y-3">
              <Section title="Reference & Subject">
                <div className="grid gap-2.5">
                  <LabelField label="Subject">
                    <Input value={form?.subject || ""} onChange={(e) => setField({ subject: e.target.value })} placeholder="Subject / Title" className="h-9 text-sm" />
                  </LabelField>
                  <LabelField label="Reference">
                    <Input value={form?.reference || ""} onChange={(e) => setField({ reference: e.target.value })} placeholder="Reference / PO #" className="h-9 text-sm" />
                  </LabelField>
                </div>
              </Section>

              <Section title="Recipient">
                <div className="grid gap-2.5">
                  <LabelField label="Supplier">
                    <LocalSearchSelect options={suppliers} value={getId(form?.supplier) || ""} onChange={(v) => setField({ supplier: v || "" })} placeholder="Search supplier..." getLabel={supplierLabel} emptyText="No suppliers found" />
                  </LabelField>
                  <LabelField label="Attention (To)">
                    <Input value={form?.attention || ""} onChange={(e) => setField({ attention: e.target.value })} placeholder="Contact person / department" className="h-9 text-sm" />
                  </LabelField>
                  <LabelField label="Salutation">
                    <Input value={form?.salutation || ""} onChange={(e) => setField({ salutation: e.target.value })} placeholder="Dear Sir / Madam," className="h-9 text-sm" />
                  </LabelField>
                </div>
              </Section>

              <Section title="Logistics & Dates">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <LabelField label="Select Factory OR Warehouse">
                      <Select value={getId(form?.warehouseOrFactory) || NONE} onValueChange={(v) => setField({ warehouseOrFactory: v === NONE ? "" : v })}>
                        <SelectTrigger className="h-9 w-full text-sm"><SelectValue placeholder="Select Warehouse/Factory" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Select Factory OR Warehouse</SelectItem>
                          {warehouses.map((w) => <SelectItem key={w._id} value={w._id}>{w.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </LabelField>
                  </div>

                  <LabelField label="Issue Date">
                    <Input type="date" value={form?.issueDate?.slice(0, 10) || ""} onChange={(e) => setField({ issueDate: e.target.value })} className="h-9 text-sm" />
                  </LabelField>

                  <LabelField label="Expected Delivery">
                    <Input type="date" value={form?.expectedDeliveryDate?.slice(0, 10) || ""} onChange={(e) => setField({ expectedDeliveryDate: e.target.value })} className="h-9 text-sm" />
                  </LabelField>

                  <div className="sm:col-span-2">
                    <LabelField label="Status">
                      <Select value={form?.status || "Pending"} onValueChange={(v) => setField({ status: v })}>
                        <SelectTrigger className="h-9 w-full text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </LabelField>
                  </div>
                </div>
              </Section>

              <Section title="Items">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {itemCount} item{itemCount === 1 ? "" : "s"}
                  </div>
                  <Button type="button" size="sm" onClick={addItemRow} className="h-7 gap-1 bg-[#3aa838] text-[11px] text-white hover:bg-[#2f8a2f]">
                    <Plus className="h-3 w-3" />
                    Add Item
                  </Button>
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                  <table className="w-full table-auto border-collapse bg-white text-sm dark:bg-slate-900">
                    <thead className="bg-slate-50 dark:bg-slate-950/60">
                      <tr>
                        {["#", "Item", "Description", "Qty", "Unit", "Unit Price", "Total", "Remarks", ""].map((h, i) => (
                          <th key={i} className={`border-b border-slate-200 p-2 text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400 ${i >= 3 && i <= 6 ? "text-right" : "text-left"}`}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(form?.items || []).map((it, idx) => (
                        <WorkOrderItemRow key={it._id || idx} index={idx} item={it} rawMaterials={rawMaterials} packagingItems={packagingItems} products={products} otherProducts={otherProducts} onUpdate={updateItemField} onSelectItem={selectItemForRow} onRemove={removeItemRow} />
                      ))}
                      {itemCount === 0 && (
                        <tr>
                          {/* ✅ FIX: 9 columns, not 8 */}
                          <td colSpan={9} className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                            No items added yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Section>

              <Section title="Totals & Calculations">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <LabelField label="Discount (%)">
                    <Input type="number" min={0} value={String(form?.discountPercent ?? 0)} onChange={(e) => updateDiscountTax(e.target.value === "" ? 0 : Number(e.target.value), undefined)} className="h-9 text-sm" />
                  </LabelField>
                  <LabelField label="Tax (%)">
                    <Input type="number" min={0} value={String(form?.taxPercent ?? 0)} onChange={(e) => updateDiscountTax(undefined, e.target.value === "" ? 0 : Number(e.target.value))} className="h-9 text-sm" />
                  </LabelField>
                </div>

                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="flex justify-between text-xs"><span className="text-slate-500 dark:text-slate-400">Subtotal</span><span className="font-medium">{formatCurrency(form?.subTotal)}</span></div>
                  <div className="mt-1 flex justify-between text-xs"><span className="text-slate-500 dark:text-slate-400">Discount</span><span className="font-medium text-rose-600">− {formatCurrency(form?.discountAmount)}</span></div>
                  <div className="mt-1 flex justify-between text-xs"><span className="text-slate-500 dark:text-slate-400">Tax</span><span className="font-medium">{formatCurrency(form?.taxTotal)}</span></div>
                  <div className="mt-2 flex justify-between rounded-md bg-gradient-to-r from-[#16351d] to-[#3aa838] px-2.5 py-2 text-sm font-bold text-white">
                    <span>Grand Total</span>
                    <span>{formatCurrency(form?.grandTotal)}</span>
                  </div>
                  <div className="mt-1 text-[10px] italic text-slate-500 dark:text-slate-400">
                    In words: {form?.grandTotal ? numberToWords(Number(form.grandTotal)) : ""}
                  </div>
                </div>
              </Section>

              <Section title="Terms & Notes">
                <div className="grid gap-2.5">
                  <LabelField label="Template">
                    <Select value={(form?.selectedTemplateId as string) || NONE} onValueChange={(v) => applyTemplate(v === NONE ? null : v)}>
                      <SelectTrigger className="h-9 w-full text-sm"><SelectValue placeholder="Select template" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>-- Choose Template --</SelectItem>
                        {templates.map((t) => (
                          <SelectItem key={t._id ?? t.title} value={t._id ?? t.title}>{t.title}</SelectItem>
                        ))}
                        <SelectItem value="custom">Custom / Empty</SelectItem>
                      </SelectContent>
                    </Select>
                  </LabelField>
                  <LabelField label="Terms & Conditions">
                    <textarea value={form?.terms || ""} onChange={(e) => setField({ terms: e.target.value })} className="min-h-[100px] w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-[#3aa838]/40 focus:ring-2 focus:ring-[#3aa838]/10 dark:border-slate-800 dark:bg-slate-900" />
                  </LabelField>
                  <LabelField label="Notes">
                    <textarea value={form?.notes || ""} onChange={(e) => setField({ notes: e.target.value })} className="min-h-[70px] w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-[#3aa838]/40 focus:ring-2 focus:ring-[#3aa838]/10 dark:border-slate-800 dark:bg-slate-900" />
                  </LabelField>
                </div>
              </Section>

              <Section title="Footer & Signatures">
                <Input value={form?.footerNote || ""} onChange={(e) => setField({ footerNote: e.target.value })} placeholder="Footer note shown on printed document" className="h-9 text-sm" />
              </Section>
            </div>
          </div>

          {/* RIGHT — preview */}
          <div className="min-h-0 overflow-y-auto bg-slate-100 p-4 dark:bg-slate-900/40 lg:p-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 dark:border-slate-800 md:flex-row md:items-start md:justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-12 w-14 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
                    <img src="/images/logo-green.png" className="h-full w-full object-contain p-1" alt="Logo" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">Antab Agro</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">Company address, phone, email</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#3aa838]">Work Order / Quotation</div>
                  <div className="mt-0.5 text-base font-bold text-slate-900 dark:text-white">{form?.workOrderNo || "-"}</div>
                  <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">Issue: {form?.issueDate || "-"}</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Ref: {form?.reference || "-"}</div>
                  <div className="mt-1.5 flex justify-end"><StatusBadge status={form?.status} /></div>
                </div>
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">To</div>
                  <div className="mt-0.5 text-xs font-semibold text-slate-900 dark:text-white">{selectedSupplierName || "-"}</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Destination</div>
                  <div className="mt-0.5 text-xs font-semibold text-slate-900 dark:text-white">{selectedWarehouseName || "-"}</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Subject</div>
                  <div className="mt-0.5 truncate text-xs font-semibold text-slate-900 dark:text-white">{form?.subject || "-"}</div>
                </div>
              </div>

              <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full table-auto border-collapse text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950/60">
                    <tr>
                      {["#", "Item", "Description", "Qty", "Unit", "Unit Price", "Total", "Remarks"].map((h, i) => (
                        <th key={i} className={`border-b border-slate-200 p-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400 ${i >= 3 && i <= 6 ? "text-right" : "text-left"}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(form?.items || []).map((it, idx) => (
                      <tr key={it._id || idx} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="p-1.5 align-top text-slate-400">{idx + 1}</td>
                        <td className="p-1.5 align-top font-medium">{getItemName(it)}</td>
                        <td className="p-1.5 align-top text-slate-500">{it.description || "-"}</td>
                        <td className="p-1.5 align-top text-right">{it.quantity ?? 0}</td>
                        <td className="p-1.5 align-top text-right">{it.unit || "-"}</td>
                        <td className="p-1.5 align-top text-right">{formatCurrency(it.unitPrice)}</td>
                        <td className="p-1.5 align-top text-right font-semibold">{formatCurrency(it.lineTotal)}</td>
                        <td className="p-1.5 align-top text-right text-slate-500">{it.remarks || "-"}</td>
                      </tr>
                    ))}
                    {itemCount === 0 && (
                      <tr>
                        {/* ✅ FIX: 8 columns, not 7 */}
                        <td colSpan={8} className="p-4 text-center text-[10px] text-slate-500 dark:text-slate-400">
                          Preview will appear here.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <div>
                  <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Terms & Conditions</div>
                  <div className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-2 text-[10px] leading-4 text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
                    {form?.terms || "-"}
                  </div>
                  <div className="mt-2 whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-2 text-[10px] leading-4 text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
                    {form?.notes || "-"}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-950/40">
                    <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="font-medium">{formatCurrency(form?.subTotal)}</span></div>
                    <div className="mt-1 flex justify-between"><span className="text-slate-500">Discount ({form?.discountPercent ?? 0}%)</span><span className="font-medium text-rose-600">− {formatCurrency(form?.discountAmount)}</span></div>
                    <div className="mt-1 flex justify-between"><span className="text-slate-500">Tax ({form?.taxPercent ?? 0}%)</span><span className="font-medium">{formatCurrency(form?.taxTotal)}</span></div>
                    <div className="mt-1.5 flex justify-between rounded bg-gradient-to-r from-[#16351d] to-[#3aa838] px-2 py-1.5 text-white">
                      <span className="text-[9px] font-bold uppercase tracking-wider">Grand Total</span>
                      <span className="text-xs font-bold">{formatCurrency(form?.grandTotal)}</span>
                    </div>
                    <div className="mt-1 text-[10px] italic text-slate-500 dark:text-slate-400">
                      In words: {form?.grandTotal ? numberToWords(Number(form.grandTotal)) : ""}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {["Prepared By", "Approved By", "Chairman"].map((label) => (
                      <div key={label} className="text-center">
                        <div className="h-10 rounded-t-md border border-b-0 border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40" />
                        <div className="rounded-b-md border border-slate-200 bg-white px-1 py-1 text-[9px] font-medium dark:border-slate-800 dark:bg-slate-900">{label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="text-[10px] text-slate-500 dark:text-slate-400">{form?.footerNote || ""}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default memo(WorkOrderAddEditDialog);