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
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type LookupItem = {
  _id: string;
  name?: string;
  supplierName?: string;
  unit?: string;
  salePrice?: number;
  purchasePrice?: number;
};

type RawMaterial = LookupItem;
type PackagingItem = LookupItem;
type FinishedItem = LookupItem;
type OtherItem = LookupItem;

type ItemForm = {
  itemType?: "RawMaterial" | "PackagingItem" | "FinishedItem" | "OtherItem";
  itemId?: string | LookupItem;
  name?: string;
  description?: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  lineTotal?: number;
  remarks?: string;
  _id?: string;
};

type TermsTemplate = { _id?: string; title: string; content: string };

type WorkOrderForm = {
  _id?: string;
  workOrderNo?: string;
  subject?: string;
  reference?: string;
  attention?: string;
  salutation?: string;
  supplier?: string | LookupItem;
  warehouseOrFactory?: string | LookupItem;
  issueDate?: string;
  expectedDeliveryDate?: string;
  status?:
    | "Pending"
    | "Processing"
    | "Approved"
    | "Completed"
    | "Cancelled"
    | string;
  items?: ItemForm[];
  discountPercent?: number;
  taxPercent?: number;
  subTotal?: number;
  discountAmount?: number;
  taxTotal?: number;
  grandTotal?: number;
  selectedTemplateId?: string | null;
  terms?: string;
  notes?: string;
  footerNote?: string;
  createdBy?: string | LookupItem;
  approvedBy?: string | LookupItem;
};

type WorkOrderDialogProps = {
  openEdit: boolean;
  setOpenEdit: React.Dispatch<React.SetStateAction<boolean>>;
  form: WorkOrderForm | null;
  setForm: React.Dispatch<React.SetStateAction<WorkOrderForm | null>>;
  editing: { _id?: string } | null;
  setEditing: React.Dispatch<React.SetStateAction<any>>;
  suppliers: LookupItem[];
  warehouses: LookupItem[];
  StatusBadge: React.ComponentType<{ status?: string }>;
  loadWorkOrders?: () => void;
};

const NONE = "none";
const STATUS_OPTIONS = [
  "Pending",
  "Processing",
  "Approved",
  "Completed",
  "Cancelled",
] as const;

const DEFAULT_TEMPLATES: TermsTemplate[] = [
  {
    _id: "tmpl-1",
    title: "Default Terms",
    content:
      "1. Payment due within 30 days.\n2. Goods remain property of supplier until paid.\n3. Warranty as per manufacturer's terms.",
  },
  {
    _id: "tmpl-2",
    title: "Standard Terms",
    content:
      "1. 50% advance.\n2. Delivery subject to stock.\n3. Claims within 7 days.",
  },
];

const moneyFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function getId(v?: any) {
  if (!v) return "";
  if (typeof v === "string") return v;
  return v._id ?? "";
}

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

function safeMultiply(a: number, b: number) {
  return Math.round(a * b * 100) / 100;
}

function safeAdd(a: number, b: number) {
  return Math.round((a + b) * 100) / 100;
}

function formatCurrency(n?: number | null) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "-";
  return moneyFormatter.format(Math.round(Number(n) * 100) / 100);
}

function numberToWords(num: number) {
  if (Number.isNaN(num) || !Number.isFinite(num)) return "";

  const a = [
    "",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
  ];
  const b = [
    "",
    "",
    "twenty",
    "thirty",
    "forty",
    "fifty",
    "sixty",
    "seventy",
    "eighty",
    "ninety",
  ];

  function toWords(n: number): string {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? "-" + a[n % 10] : "");
    if (n < 1000)
      return (
        a[Math.floor(n / 100)] +
        " hundred" +
        (n % 100 ? " " + toWords(n % 100) : "")
      );
    if (n < 1000000)
      return (
        toWords(Math.floor(n / 1000)) +
        " thousand" +
        (n % 1000 ? " " + toWords(n % 1000) : "")
      );
    return (
      toWords(Math.floor(n / 1000000)) +
      " million" +
      (n % 1000000 ? " " + toWords(n % 1000000) : "")
    );
  }

  const intPart = Math.floor(Math.abs(num));
  const cents = Math.round((Math.abs(num) - intPart) * 100);
  const sign = num < 0 ? "minus " : "";
  const words = intPart === 0 ? "zero" : toWords(intPart);
  return `${sign}${words}${cents > 0 ? ` and ${cents}/100` : ""}`;
}

function computeTotals(
  items: ItemForm[] = [],
  discountPercent = 0,
  taxPercent = 0,
) {
  let sub = 0;
  const cloned = items.map((it) => ({ ...it }));

  for (let i = 0; i < cloned.length; i++) {
    const q = Number(cloned[i].quantity || 0);
    const p = Number(cloned[i].unitPrice || 0);
    const line = safeMultiply(q, p);
    cloned[i].lineTotal = line;
    sub = safeAdd(sub, line);
  }

  const discountAmount =
    Math.round(sub * (Number(discountPercent || 0) / 100) * 100) / 100;
  const taxedBase = Math.round((sub - discountAmount) * 100) / 100;
  const taxAmount =
    Math.round(taxedBase * (Number(taxPercent || 0) / 100) * 100) / 100;
  const grand = Math.round((taxedBase + taxAmount) * 100) / 100;

  return {
    items: cloned,
    subTotal: sub,
    discountAmount,
    taxTotal: taxAmount,
    grandTotal: grand,
  };
}

function withTotals(
  base: WorkOrderForm,
  items: ItemForm[],
  extra: Partial<WorkOrderForm> = {},
): WorkOrderForm {
  const merged = { ...base, ...extra } as WorkOrderForm;
  const totals = computeTotals(
    items,
    Number(merged.discountPercent || 0),
    Number(merged.taxPercent || 0),
  );

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

function useLookupMap<T extends LookupItem>(items: T[]) {
  return useMemo(() => new Map(items.map((item) => [item._id, item])), [items]);
}

type LocalSearchSelectProps = {
  options: any[];
  value?: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
  getLabel: (item: any) => string;
  emptyText?: string;
};

const LocalSearchSelect = memo(function LocalSearchSelect({
  options,
  value,
  onChange,
  placeholder = "Search...",
  getLabel,
  emptyText = "No results",
}: LocalSearchSelectProps) {
  const [query, setQuery] = useState("");

  const selectedLabel = useMemo(() => {
    if (!value) return "";
    const found = options.find((o) => getId(o) === value);
    return found ? getLabel(found) : "";
  }, [options, value, getLabel]);

  useEffect(() => {
    if (!value) {
      setQuery("");
      return;
    }
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
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setQuery("");
            onChange(null);
          }}
        >
          Clear
        </Button>
      </div>

      <div className="max-h-44 overflow-auto rounded-md border bg-white">
        {filtered.length === 0 ? (
          <div className="p-2 text-sm text-muted-foreground">{emptyText}</div>
        ) : (
          filtered.map((it) => {
            const id = getId(it);
            const label = getLabel(it);
            return (
              <button
                key={id}
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(id);
                  setQuery(label);
                }}
              >
                {label}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
});

type ItemRowProps = {
  index: number;
  item: ItemForm;
  rawMaterials: RawMaterial[];
  packagingItems: PackagingItem[];
  finishedItems: FinishedItem[];
  otherItems: OtherItem[];
  onUpdate: (index: number, patch: Partial<ItemForm>) => void;
  onSelectItem: (
    index: number,
    itemType: "RawMaterial" | "PackagingItem" | "FinishedItem" | "OtherItem",
    itemId: string,
  ) => void;
  onRemove: (index: number) => void;
};

const WorkOrderItemRow = memo(function WorkOrderItemRow({
  index,
  item,
  rawMaterials,
  packagingItems,
  finishedItems,
  otherItems,
  onUpdate,
  onSelectItem,
  onRemove,
}: ItemRowProps) {
  const currentType = item.itemType || "RawMaterial";
  const selectedId = getId(item.itemId) || "";

  return (
    <tr className="border-t">
      <td className="p-2 align-top">{index + 1}</td>

      <td className="p-2 align-top">
        <div className="flex flex-col gap-2">
          <Select
            value={currentType}
            onValueChange={(v) =>
              onUpdate(index, {
                itemType: v as "RawMaterial" | "PackagingItem",
                itemId: "",
                unit: "",
                unitPrice: 0,
                lineTotal: 0,
              })
            }
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="RawMaterial">Raw Material</SelectItem>
              <SelectItem value="PackagingItem">Packaging</SelectItem>
              <SelectItem value="FinishedItem">Finished Product</SelectItem>
              <SelectItem value="OtherItem">Other Product</SelectItem>
            </SelectContent>
          </Select>

          <div style={{ minWidth: 220 }}>
            {currentType === "RawMaterial" ? (
              <LocalSearchSelect
                options={rawMaterials}
                value={selectedId}
                onChange={(v) => onSelectItem(index, "RawMaterial", v || "")}
                placeholder="Search raw material..."
                getLabel={itemLabel}
                emptyText="No raw materials"
              />
            ) : currentType === "PackagingItem" ? (
              <LocalSearchSelect
                options={packagingItems}
                value={selectedId}
                onChange={(v) => onSelectItem(index, "PackagingItem", v || "")}
                placeholder="Search packaging..."
                getLabel={itemLabel}
                emptyText="No packaging items"
              />
            ) : currentType === "FinishedItem" ? (
              <LocalSearchSelect
                options={finishedItems}
                value={selectedId}
                onChange={(v) => onSelectItem(index, "FinishedItem", v || "")}
                placeholder="Search finished product..."
                getLabel={itemLabel}
                emptyText="No Finished Product"
              />
            ) : (
              <LocalSearchSelect
                options={otherItems}
                value={selectedId}
                onChange={(v) => onSelectItem(index, "OtherItem", v || "")}
                placeholder="Search other product..."
                getLabel={itemLabel}
                emptyText="No Other Products"
              />
            )}
          </div>
        </div>
      </td>

      <td className="p-2 align-top">
        <Input
          value={item.description || ""}
          onChange={(e) => onUpdate(index, { description: e.target.value })}
        />
      </td>

      <td className="p-2 align-top text-right">
        <Input
          type="number"
          min={0}
          value={String(item.quantity ?? "")}
          onChange={(e) =>
            onUpdate(index, {
              quantity: e.target.value === "" ? 0 : Number(e.target.value),
            })
          }
          className="w-20"
        />
      </td>

      <td className="p-2 align-top text-right">
        <Input
          value={item.unit || ""}
          onChange={(e) => onUpdate(index, { unit: e.target.value })}
          className="w-20"
        />
      </td>

      <td className="p-2 align-top text-right">
        <Input
          type="number"
          min={0}
          value={String(item.unitPrice ?? "")}
          onChange={(e) =>
            onUpdate(index, {
              unitPrice: e.target.value === "" ? 0 : Number(e.target.value),
            })
          }
          className="w-28"
        />
      </td>

      <td className="p-2 align-top text-right font-medium">
        {formatCurrency(item.lineTotal)}
      </td>

      <td className="p-2 align-top">
        <Button size="sm" variant="destructive" onClick={() => onRemove(index)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
});

const Section = memo(function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded border bg-white p-3">
      <div className="mb-3 text-sm font-semibold">{title}</div>
      {children}
    </div>
  );
});

function WorkOrderAddEditDialog({
  openEdit,
  setOpenEdit,
  form,
  setForm,
  editing,
  setEditing,
  suppliers,
  warehouses,
  StatusBadge,
  loadWorkOrders,
}: WorkOrderDialogProps) {
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [packagingItems, setPackagingItems] = useState<PackagingItem[]>([]);
  const [finishedItems, setFinishedItems] = useState<PackagingItem[]>([]);
  const [otherItems, setOtherItems] = useState<PackagingItem[]>([]);
  const [templates, setTemplates] = useState<TermsTemplate[]>([]);

  const rawMap = useLookupMap(rawMaterials);
  const packMap = useLookupMap(packagingItems);
  const supplierMap = useLookupMap(suppliers);
  const warehouseMap = useLookupMap(warehouses);
  const templateMap = useLookupMap(templates);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const [rawRes, packRes, finishedRes, otherRes, tmplRes] =
          await Promise.allSettled([
            api.get("/raw-materials", { params: { limit: 1000 } }),
            api.get("/packaging-items", { params: { limit: 1000 } }),
            api.get("/products", { params: { limit: 1000 } }),
            api.get("/other-products", { params: { limit: 1000 } }),
            api.get("/settings/workorder-terms"),
          ]);

        if (!alive) return;

        setRawMaterials(
          rawRes.status === "fulfilled" ? rawRes.value?.data?.data || [] : [],
        );
        setPackagingItems(
          packRes.status === "fulfilled" ? packRes.value?.data?.data || [] : [],
        );
        setFinishedItems(
          finishedRes.status === "fulfilled"
            ? finishedRes.value?.data?.data || []
            : [],
        );
        setOtherItems(
          otherRes.status === "fulfilled"
            ? otherRes.value?.data?.data || []
            : [],
        );

        const serverTemplates =
          tmplRes.status === "fulfilled" ? tmplRes.value?.data?.data : null;

        setTemplates(
          Array.isArray(serverTemplates) && serverTemplates.length > 0
            ? serverTemplates
            : DEFAULT_TEMPLATES,
        );
      } catch {
        if (!alive) return;
        setRawMaterials([]);
        setPackagingItems([]);
        setFinishedItems([]);
        setOtherItems([]);
        setTemplates(DEFAULT_TEMPLATES);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const closeDialog = useCallback(() => {
    setOpenEdit(false);
    setForm(null);
    setEditing(null);
  }, [setEditing, setForm, setOpenEdit]);

  const setField = useCallback(
    (patch: Partial<WorkOrderForm>) => {
      setForm((prev) => (prev ? { ...prev, ...patch } : prev));
    },
    [setForm],
  );

  const addItemRow = useCallback(() => {
    setForm((prev) => {
      if (!prev) return prev;
      const nextItems = [...(prev.items || []), createEmptyItem()];
      return withTotals(prev, nextItems);
    });
  }, [setForm]);

  const removeItemRow = useCallback(
    (index: number) => {
      setForm((prev) => {
        if (!prev) return prev;
        const nextItems = (prev.items || []).filter((_, i) => i !== index);
        return withTotals(prev, nextItems);
      });
    },
    [setForm],
  );

  const updateItemField = useCallback(
    (index: number, patch: Partial<ItemForm>) => {
      setForm((prev) => {
        if (!prev) return prev;
        const nextItems = (prev.items || []).map((it, i) =>
          i === index ? { ...(it || {}), ...patch } : it,
        );
        return withTotals(prev, nextItems);
      });
    },
    [setForm],
  );

  const selectItemForRow = useCallback(
    (
      index: number,
      itemType: "RawMaterial" | "PackagingItem" | "FinishedItem" | "OtherItem",
      itemId: string,
    ) => {
      setForm((prev) => {
        if (!prev) return prev;

        const source = itemType === "RawMaterial" ? rawMap : packMap;
        const picked = source.get(itemId);

        const nextItems = (prev.items || []).map((it, i) =>
          i === index
            ? {
                ...(it || {}),
                itemType,
                itemId,
                name: picked?.name || it.name || "",
                description: it.description || picked?.name || "",
                unit: picked?.unit || it.unit || "",
                unitPrice: Number(
                  picked?.salePrice ??
                    picked?.purchasePrice ??
                    it.unitPrice ??
                    0,
                ),
              }
            : it,
        );

        return withTotals(prev, nextItems);
      });
    },
    [packMap, rawMap, setForm],
  );

  const updateDiscountTax = useCallback(
    (discountPercent?: number | null, taxPercent?: number | null) => {
      setForm((prev) => {
        if (!prev) return prev;

        const nextDiscount =
          discountPercent !== undefined && discountPercent !== null
            ? Number(discountPercent)
            : Number(prev.discountPercent || 0);

        const nextTax =
          taxPercent !== undefined && taxPercent !== null
            ? Number(taxPercent)
            : Number(prev.taxPercent || 0);

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
    },
    [setForm],
  );

  const applyTemplate = useCallback(
    (templateId: string | null) => {
      setForm((prev) => {
        if (!prev) return prev;

        if (!templateId || templateId === NONE || templateId === "custom") {
          return { ...prev, selectedTemplateId: null, terms: "" };
        }

        const tmpl = templateMap.get(templateId);
        if (!tmpl) return { ...prev, selectedTemplateId: null, terms: "" };

        return {
          ...prev,
          selectedTemplateId: tmpl._id ?? null,
          terms: tmpl.content,
        };
      });
    },
    [setForm, templateMap],
  );

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
      if (!current.warehouseOrFactory)
        return toast.error("Select warehouse/factory");

      const items = current.items || [];
      if (items.length === 0) return toast.error("Add at least one item");

      for (const it of items) {
        if (!it.itemType) return toast.error("Select item type for each row");
        if (!it.itemId) return toast.error("Select item for each row");
        if (!it.quantity || Number(it.quantity) <= 0)
          return toast.error("Item quantity must be > 0");
      }

      const totals = computeTotals(
        items,
        Number(current.discountPercent || 0),
        Number(current.taxPercent || 0),
      );

      const payload: any = {
        workOrderNo: current.workOrderNo,
        supplier: getId(current.supplier),
        warehouseOrFactory: getId(current.warehouseOrFactory),
        issueDate: current.issueDate,
        expectedDeliveryDate: current.expectedDeliveryDate,
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
        status: current.status,
        notes: current.notes,
        terms: current.terms,
        discountPercent: Number(current.discountPercent || 0),
        taxPercent: Number(current.taxPercent || 0),
        subTotal: totals.subTotal,
        discountAmount: totals.discountAmount,
        taxTotal: totals.taxTotal,
        grandTotal: totals.grandTotal,
        footerNote: current.footerNote,
        createdBy: getId(current.createdBy),
        approvedBy: current.approvedBy ? getId(current.approvedBy) : undefined,
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
  }, [closeDialog, editing, form, loadWorkOrders]);

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
    return warehouseMap.get(id)?.name || "";
  }, [form?.warehouseOrFactory, warehouseMap]);

  const itemCount = form?.items?.length || 0;

  return (
    <Dialog
      open={openEdit}
      onOpenChange={(isOpen) => {
        if (!isOpen) closeDialog();
      }}
    >
      <DialogContent className="!w-full !max-w-[98vw] max-h-[95vh] h-full overflow-y-auto p-0 rounded-xl shadow-2xl bg-background border">
        <div className="flex h-full flex-col">
          <div className="border-b bg-white px-6 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="text-2xl font-bold">
                  {editing ? "Edit Work Order" : "Create Work Order"}
                </h3>
                <div className="text-sm text-muted-foreground">
                  WO#: {form?.workOrderNo || "-"}
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="ghost" onClick={saveDraft}>
                  Save Draft
                </Button>
                <Button onClick={submitForm}>
                  {editing ? "Save" : "Create"}
                </Button>
              </div>
            </div>
          </div>

          <div className="grid flex-1 grid-cols-1 overflow-hidden xl:grid-cols-[42%_58%]">
            {/* LEFT: FORM */}
            <div className="overflow-y-auto border-r bg-slate-50 p-4 lg:p-6">
              <div className="space-y-4">
                <Section title="Reference & Subject">
                  <div className="grid grid-cols-1 gap-3">
                    <Input
                      label="Subject"
                      value={form?.subject || ""}
                      onChange={(e) => setField({ subject: e.target.value })}
                      placeholder="Subject / Title"
                    />
                    <Input
                      label="Reference"
                      value={form?.reference || ""}
                      onChange={(e) => setField({ reference: e.target.value })}
                      placeholder="Reference / PO #"
                    />
                  </div>
                </Section>

                <Section title="Recipient">
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="mb-1 block text-sm">Supplier</label>
                      <LocalSearchSelect
                        options={suppliers}
                        value={getId(form?.supplier) || ""}
                        onChange={(v) => setField({ supplier: v || "" })}
                        placeholder="Search supplier..."
                        getLabel={supplierLabel}
                        emptyText="No suppliers found"
                      />
                    </div>

                    <Input
                      label="Attention (To)"
                      value={form?.attention || ""}
                      onChange={(e) => setField({ attention: e.target.value })}
                      placeholder="Contact person / department"
                    />

                    <Input
                      label="Salutation"
                      value={form?.salutation || ""}
                      onChange={(e) => setField({ salutation: e.target.value })}
                      placeholder="Dear Sir / Madam,"
                    />
                  </div>
                </Section>

                <Section title="Logistics & Dates">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-sm">
                        Select Factory
                      </label>
                      <Select
                        value={getId(form?.warehouseOrFactory) || NONE}
                        onValueChange={(v) =>
                          setField({ warehouseOrFactory: v === NONE ? "" : v })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select Warehouse/Factory" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Select Factory</SelectItem>
                          {warehouses.map((w) => (
                            <SelectItem key={w._id} value={w._id}>
                              {w.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm">Issue Date</label>
                      <Input
                        type="date"
                        value={form?.issueDate?.slice(0, 10) || ""}
                        onChange={(e) =>
                          setField({ issueDate: e.target.value })
                        }
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm">
                        Expected Delivery
                      </label>
                      <Input
                        type="date"
                        value={form?.expectedDeliveryDate?.slice(0, 10) || ""}
                        onChange={(e) =>
                          setField({ expectedDeliveryDate: e.target.value })
                        }
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-1 block text-sm">Status</label>
                      <Select
                        value={form?.status || "Pending"}
                        onValueChange={(v) => setField({ status: v as any })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </Section>

                <Section title="Items">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      {itemCount} item{itemCount === 1 ? "" : "s"}
                    </div>
                    <Button size="sm" onClick={addItemRow}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Item
                    </Button>
                  </div>

                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full table-auto border-collapse bg-white text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="border-b p-2 text-left">#</th>
                          <th className="border-b p-2 text-left">Item</th>
                          <th className="border-b p-2 text-left">
                            Description
                          </th>
                          <th className="border-b p-2 text-right">Qty</th>
                          <th className="border-b p-2 text-right">Unit</th>
                          <th className="border-b p-2 text-right">
                            Unit Price
                          </th>
                          <th className="border-b p-2 text-right">Total</th>
                          <th className="border-b p-2 text-left">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(form?.items || []).map((it, idx) => (
                          <WorkOrderItemRow
                            key={it._id || idx}
                            index={idx}
                            item={it}
                            rawMaterials={rawMaterials}
                            packagingItems={packagingItems}
                            finishedItems={finishedItems}
                            otherItems={otherItems}
                            onUpdate={updateItemField}
                            onSelectItem={selectItemForRow}
                            onRemove={removeItemRow}
                          />
                        ))}

                        {itemCount === 0 && (
                          <tr>
                            <td
                              colSpan={8}
                              className="p-4 text-center text-muted-foreground"
                            >
                              No items added yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Section>

                <Section title="Totals & Calculations">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        Discount (%)
                      </label>
                      <Input
                        type="number"
                        min={0}
                        value={String(form?.discountPercent ?? 0)}
                        onChange={(e) =>
                          updateDiscountTax(
                            e.target.value === "" ? 0 : Number(e.target.value),
                            undefined,
                          )
                        }
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        Tax (%)
                      </label>
                      <Input
                        type="number"
                        min={0}
                        value={String(form?.taxPercent ?? 0)}
                        onChange={(e) =>
                          updateDiscountTax(
                            undefined,
                            e.target.value === "" ? 0 : Number(e.target.value),
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border bg-slate-50 p-4">
                    <div className="flex justify-between">
                      <div>Subtotal</div>
                      <div>{formatCurrency(form?.subTotal)}</div>
                    </div>
                    <div className="flex justify-between">
                      <div>Discount</div>
                      <div>- {formatCurrency(form?.discountAmount)}</div>
                    </div>
                    <div className="flex justify-between">
                      <div>Tax</div>
                      <div>{formatCurrency(form?.taxTotal)}</div>
                    </div>
                    <div className="mt-2 flex justify-between text-lg font-semibold">
                      <div>Grand Total</div>
                      <div>{formatCurrency(form?.grandTotal)}</div>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      In words:{" "}
                      {form?.grandTotal
                        ? numberToWords(Number(form.grandTotal))
                        : ""}
                    </div>
                  </div>
                </Section>

                <Section title="Terms & Notes">
                  <div className="grid grid-cols-1 gap-3">
                    <Select
                      value={(form?.selectedTemplateId as string) || NONE}
                      onValueChange={(v) =>
                        applyTemplate(v === NONE ? null : v)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select template" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>
                          -- Choose Template --
                        </SelectItem>
                        {templates.map((t) => (
                          <SelectItem key={t._id} value={t._id}>
                            {t.title}
                          </SelectItem>
                        ))}
                        <SelectItem value="custom">Custom / Empty</SelectItem>
                      </SelectContent>
                    </Select>

                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        Terms & Conditions
                      </label>
                      <textarea
                        value={form?.terms || ""}
                        onChange={(e) => setField({ terms: e.target.value })}
                        className="min-h-[120px] w-full rounded-md border bg-white p-3 outline-none focus:ring-2 focus:ring-slate-300"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        Notes
                      </label>
                      <textarea
                        value={form?.notes || ""}
                        onChange={(e) => setField({ notes: e.target.value })}
                        className="min-h-[80px] w-full rounded-md border bg-white p-3 outline-none focus:ring-2 focus:ring-slate-300"
                      />
                    </div>
                  </div>
                </Section>

                <Section title="Footer & Signatures">
                  <Input
                    value={form?.footerNote || ""}
                    onChange={(e) => setField({ footerNote: e.target.value })}
                    placeholder="Footer note shown on printed document"
                  />
                </Section>
              </div>
            </div>

            {/* RIGHT: PREVIEW */}
            <div className="overflow-y-auto bg-slate-50 p-4 lg:p-6">
              <div className="rounded-2xl border bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-16 w-20 items-center justify-center rounded-xl bg-slate-200 text-sm font-medium text-slate-600 p-1">
                        <img
                          src={"/images/logo-green.png"}
                          className="w-full h-full object-fit rounded-lg"
                        />
                      </div>
                      <div>
                        <div className="text-lg font-bold">Antab Agro</div>
                        <div className="text-sm text-muted-foreground">
                          Company address, phone, email
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                      Work Order / Quotation
                    </div>
                    <div className="text-xl font-bold">
                      {form?.workOrderNo || "-"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Issue: {form?.issueDate || "-"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Ref: {form?.reference || "-"}
                    </div>
                    <div className="mt-2 flex justify-end">
                      <StatusBadge status={form?.status} />
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-lg border bg-slate-50 p-4">
                    <div className="text-sm text-muted-foreground">To</div>
                    <div className="mt-1 font-medium">
                      {selectedSupplierName || "-"}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-slate-50 p-4">
                    <div className="text-sm text-muted-foreground">Factory</div>
                    <div className="mt-1 font-medium">
                      {selectedWarehouseName || "-"}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-slate-50 p-4">
                    <div className="text-sm text-muted-foreground">Subject</div>
                    <div className="mt-1 font-medium">
                      {form?.subject || "-"}
                    </div>
                  </div>
                </div>

                <div className="mt-6 overflow-x-auto rounded-lg border">
                  <table className="w-full table-auto border-collapse text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="border-b p-2 text-left">#</th>
                        <th className="border-b p-2 text-left">Item</th>
                        <th className="border-b p-2 text-left">Description</th>
                        <th className="border-b p-2 text-right">Qty</th>
                        <th className="border-b p-2 text-right">Unit</th>
                        <th className="border-b p-2 text-right">Unit Price</th>
                        <th className="border-b p-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(form?.items || []).map((it, idx) => {
                        const id = getId(it.itemId);
                        const itemName =
                          it.itemType === "RawMaterial"
                            ? rawMap.get(id)?.name || "-"
                            : packMap.get(id)?.name || "-";

                        return (
                          <tr key={it._id || idx} className="border-t">
                            <td className="p-2 align-top">{idx + 1}</td>
                            <td className="p-2 align-top">{itemName}</td>
                            <td className="p-2 align-top">
                              {it.description || "-"}
                            </td>
                            <td className="p-2 align-top text-right">
                              {it.quantity ?? 0}
                            </td>
                            <td className="p-2 align-top text-right">
                              {it.unit || "-"}
                            </td>
                            <td className="p-2 align-top text-right">
                              {formatCurrency(it.unitPrice)}
                            </td>
                            <td className="p-2 align-top text-right">
                              {formatCurrency(it.lineTotal)}
                            </td>
                          </tr>
                        );
                      })}

                      {itemCount === 0 && (
                        <tr>
                          <td
                            colSpan={7}
                            className="p-4 text-center text-muted-foreground"
                          >
                            Preview will appear here.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                  <div>
                    <div className="mb-2 text-sm text-muted-foreground">
                      Terms & Conditions
                    </div>
                    <div className="whitespace-pre-wrap rounded-lg border bg-slate-50 p-4 text-sm text-slate-600">
                      {form?.terms || "-"}
                    </div>
                    <div className="mt-4 rounded-lg border bg-slate-50 p-4 text-sm text-slate-600">
                      {form?.notes || "-"}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-lg border bg-slate-50 p-4">
                      <div className="flex justify-between">
                        <div>Subtotal</div>
                        <div>{formatCurrency(form?.subTotal)}</div>
                      </div>
                      <div className="flex justify-between">
                        <div>Discount ({form?.discountPercent ?? 0}%)</div>
                        <div>- {formatCurrency(form?.discountAmount)}</div>
                      </div>
                      <div className="flex justify-between">
                        <div>Tax ({form?.taxPercent ?? 0}%)</div>
                        <div>{formatCurrency(form?.taxTotal)}</div>
                      </div>
                      <div className="mt-2 flex justify-between text-lg font-semibold">
                        <div>Grand Total</div>
                        <div>{formatCurrency(form?.grandTotal)}</div>
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        In words:{" "}
                        {form?.grandTotal
                          ? numberToWords(Number(form.grandTotal))
                          : ""}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="h-16 border-b" />
                        <div className="mt-2 text-sm">Prepared By</div>
                      </div>
                      <div className="text-center">
                        <div className="h-16 border-b" />
                        <div className="mt-2 text-sm">Approved By</div>
                      </div>
                      <div className="text-center">
                        <div className="h-16 border-b" />
                        <div className="mt-2 text-sm">Chairman</div>
                      </div>
                    </div>

                    <div className="text-sm text-muted-foreground">
                      {form?.footerNote || ""}
                    </div>
                  </div>
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
