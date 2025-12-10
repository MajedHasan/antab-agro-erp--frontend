"use client";

import React, { useMemo, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";

/**
 * Standalone Sales Entry page
 * - All original fields preserved (date, pr date, dealer, warehouse, invoice no, product rows, batch, price, qty, discount, bonus)
 * - Improved UI and interactions
 * - Live calculations (row subtotal, total qty, subtotal, VAT, grand total, paid, due)
 * - Save draft (localStorage), Export JSON
 * - Printable Invoice Preview modal (opens on Confirm Sale)
 *
 * To integrate with your backend: replace `onConfirm()` body (marked) with your API call.
 */

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
};

export default function SalesEntryPage() {
  const invoiceNo = "3064"; // keep original invoice no - you can make dynamic
  const form = useForm({
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
  });

  const { register, handleSubmit, watch, setValue, getValues, reset } = form;

  // initial row
  const [rows, setRows] = useState<Row[]>([
    {
      id: String(Date.now()),
      productId: "",
      productName: "",
      stock: "0",
      batch: "",
      price: 0,
      qty: 0,
      discount: 0,
      bonus: 0,
    },
  ]);

  // modal state
  const [showInvoice, setShowInvoice] = useState(false);
  const [lastPayload, setLastPayload] = useState<any>(null);
  const invoiceRef = useRef<HTMLDivElement | null>(null);

  // sample dropdown data (you'll replace by API)
  const dealers = [
    { id: "173", label: "A C Traders - 01740643176" },
    { id: "164", label: "A R Traders - 01773872342" },
    { id: "105", label: "Abdullah Traders - 01752182864" },
    { id: "202", label: "Abu Taleb Traders - 01761538681" },
  ];
  const warehouses = [
    { id: "40", label: "Factory" },
    { id: "37", label: "Bogura Depot" },
  ];
  const products = [
    { id: "22", name: "Abastin 1.8ME 100ml", stock: 12 },
    { id: "20", name: "Abastin 1.8ME 1Ltr", stock: 5 },
    { id: "21", name: "Abastin 1.8ME 400ml", stock: 7 },
  ];

  // helpers
  const updateRow = (idx: number, patch: Partial<Row>) => {
    setRows((s) => {
      const copy = [...s];
      copy[idx] = { ...copy[idx], ...patch };
      return copy;
    });
  };

  const addRow = () =>
    setRows((s) => [
      ...s,
      {
        id: String(Date.now() + Math.random()),
        productId: "",
        productName: "",
        stock: "0",
        batch: "",
        price: 0,
        qty: 0,
        discount: 0,
        bonus: 0,
      },
    ]);

  const removeRow = (idx: number) =>
    setRows((s) => s.filter((_, i) => i !== idx));

  // calculations
  const rowSubtotals = rows.map(
    (r) => r.qty * r.price - (r.discount / 100) * (r.price * r.qty)
  );

  const totalQty = rows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const subtotal = rowSubtotals.reduce((s, v) => s + (Number(v) || 0), 0);
  const VAT_RATE = 0.05;
  const vat = subtotal * VAT_RATE;
  const grandTotal = subtotal + vat;
  const paidAmount = Number(watch("paid_amount") || 0);
  const due = Math.max(0, grandTotal - paidAmount);

  // Save draft to localStorage
  const saveDraft = () => {
    const payload = {
      form: getValues(),
      rows,
      totals: { totalQty, subtotal, vat, grandTotal, paidAmount, due },
    };
    localStorage.setItem("sales_entry_draft", JSON.stringify(payload));
    alert("Draft saved locally.");
  };

  const loadDraft = () => {
    const raw = localStorage.getItem("sales_entry_draft");
    if (!raw) return alert("No draft found.");
    try {
      const parsed = JSON.parse(raw);
      // populate form
      const fv = parsed.form || {};
      Object.keys(fv).forEach((k) => setValue(k as any, fv[k]));
      setRows(parsed.rows || rows);
      alert("Draft loaded.");
    } catch (e) {
      alert("Failed to load draft.");
    }
  };

  const clearDraft = () => {
    localStorage.removeItem("sales_entry_draft");
    alert("Draft cleared.");
  };

  // Export payload JSON
  const exportJSON = () => {
    const payload = {
      form: getValues(),
      rows,
      totals: { totalQty, subtotal, vat, grandTotal, paidAmount, due },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-entry-${invoiceNo}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Confirm sale: validate minimal fields then show invoice modal
  const onSubmit = (data: any) => {
    // Basic validations
    if (!data.dealer_id) {
      return alert("Please select a Dealer.");
    }
    if (!data.warehouse_id) {
      return alert("Please select a Warehouse.");
    }
    if (rows.length === 0) {
      return alert("Please add at least one product row.");
    }
    // Validate each row
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.productId) return alert(`Row ${i + 1}: Select a product.`);
      if (!r.qty || r.qty <= 0) return alert(`Row ${i + 1}: Enter quantity.`);
    }

    // Build payload
    const payload = {
      invoiceNo,
      form: data,
      rows,
      totals: { totalQty, subtotal, vat, grandTotal, paidAmount, due },
    };

    // Save last payload to show in modal and allow printing
    setLastPayload(payload);

    // Show invoice modal
    setShowInvoice(true);

    // === HERE: replace with your real API call if you want ===
    // Example:
    // fetch("/api/sales", { method: "POST", headers: {...}, body: JSON.stringify(payload) })
    //   .then(...)
    // ========================================================
  };

  // Print only invoice area
  const handlePrint = () => {
    if (!invoiceRef.current) return window.print();
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) return window.print();
    const html = `
      <html>
        <head>
          <title>Invoice ${invoiceNo}</title>
          <style>
            body{font-family: Arial, Helvetica, sans-serif;padding:20px;color:#111}
            .invoice-header{display:flex;justify-content:space-between;align-items:center}
            table{width:100%;border-collapse:collapse;margin-top:12px}
            th,td{border:1px solid #ddd;padding:8px}
            th{background:#f7f7f7}
            .right{text-align:right}
          </style>
        </head>
        <body>
          ${invoiceRef.current.innerHTML}
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  // simple util to format currency
  const fmt = (v: number) =>
    v.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Sales Entry</h1>

          <div className="flex gap-2">
            <button
              onClick={saveDraft}
              className="px-3 py-2 bg-gray-100 rounded-md hover:bg-gray-200"
              title="Save Draft"
            >
              Save Draft
            </button>
            <button
              onClick={loadDraft}
              className="px-3 py-2 bg-gray-100 rounded-md hover:bg-gray-200"
              title="Load Draft"
            >
              Load Draft
            </button>
            <button
              onClick={clearDraft}
              className="px-3 py-2 bg-gray-100 rounded-md hover:bg-gray-200"
              title="Clear Draft"
            >
              Clear Draft
            </button>
            <button
              onClick={exportJSON}
              className="px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              title="Export JSON"
            >
              Export JSON
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Top grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <label className="block text-sm font-medium text-gray-700">
                Date
              </label>
              <input
                {...register("date")}
                type="date"
                className="mt-1 w-full border rounded-md px-3 py-2"
              />
            </div>

            <div className="bg-white p-4 rounded-lg shadow-sm">
              <label className="block text-sm font-medium text-gray-700">
                P.R. Date
              </label>
              <input
                {...register("payment_date")}
                type="date"
                className="mt-1 w-full border rounded-md px-3 py-2"
              />
            </div>

            <div className="bg-white p-4 rounded-lg shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Invoice No
                  </label>
                  <div className="mt-1 text-lg font-semibold">{invoiceNo}</div>
                </div>
                <div className="text-right text-sm text-gray-500">
                  <div>Credit Limit:</div>
                  <div id="creditlimit" className="font-medium">
                    —
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Dealer / Warehouse / extras */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <label className="block text-sm font-medium text-gray-700">
                Dealer Name
              </label>
              <select
                {...register("dealer_id")}
                className="mt-1 w-full border rounded-md px-3 py-2"
              >
                <option value="">Select Dealer</option>
                {dealers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
              <div className="">
                <p className="text-xs">
                  Due: <span className="text-xs text-red-400">100000</span>
                </p>
                <p className="text-xs">
                  Credit Limit:{" "}
                  <span className="text-xs text-red-400">300000</span>
                </p>
                <p className="text-xs">
                  Remaning:
                  <span className="text-xs text-red-400">200000</span>
                </p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-sm">
              <label className="block text-sm font-medium text-gray-700">
                Branch / Warehouse
              </label>
              <select
                {...register("warehouse_id")}
                className="mt-1 w-full border rounded-md px-3 py-2"
              >
                <option value="">Select Warehouse</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-sm space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Salesperson{" "}
                <span className="text-[10px]">
                  (Automatically track which user entry the sales)
                </span>
              </label>
              <input
                {...register("salesperson")}
                placeholder="Salesperson name"
                className="w-full border rounded-md px-3 py-2"
              />
              <label className="block text-sm font-medium text-gray-700">
                Payment Method
                <span className="text-[10px]">(Only admin can edit this)</span>
              </label>
              <select
                {...register("payment_method")}
                className="mt-1 w-full border rounded-md px-3 py-2"
              >
                <option value="">Select Payment Method</option>
                <option value="cash">Cash</option>
                <option value="bank">Bank Transfer</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
          </div>

          {/* Products header */}
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">
                Products{" "}
                <span className="text-xs text-yellow-400">
                  (Can't select product if overprice with the dealer credit
                  limit)
                </span>
              </h2>
              <div className="text-sm text-gray-500">
                Add product rows, change qty, price, discount
              </div>
            </div>

            {/* Products rows */}
            <div className="space-y-4">
              {rows.map((r, idx) => {
                const subtotalRow =
                  r.qty * r.price - (r.discount / 100) * (r.price * r.qty);
                return (
                  <div
                    key={r.id}
                    className="grid grid-cols-12 gap-3 items-end border rounded-md p-3"
                  >
                    <div className="col-span-12 md:col-span-4 space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Product
                      </label>
                      <select
                        value={r.productId}
                        onChange={(e) => {
                          const pid = e.target.value;
                          const prod = products.find((p) => p.id === pid);
                          updateRow(idx, {
                            productId: pid,
                            productName: prod ? prod.name : "",
                            stock: prod ? prod.stock : "0",
                          });
                        }}
                        className="w-full border rounded-md px-3 py-2"
                      >
                        <option value="">Select Product</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-6 md:col-span-1">
                      <label className="text-sm font-medium text-gray-700">
                        Stock
                      </label>
                      <div className="mt-1 text-sm font-medium">{r.stock}</div>
                    </div>

                    <div className="col-span-6 md:col-span-1">
                      <label className="text-sm font-medium text-gray-700">
                        Batch{" "}
                        <span className="text-[10px]">
                          (Optional - Limited for some roles)
                        </span>
                      </label>
                      <input
                        value={r.batch}
                        onChange={(e) =>
                          updateRow(idx, { batch: e.target.value })
                        }
                        className="w-full border rounded-md px-3 py-2"
                      />
                    </div>

                    <div className="col-span-6 md:col-span-1">
                      <label className="text-sm font-medium text-gray-700">
                        Price
                      </label>
                      <input
                        type="number"
                        value={r.price}
                        onChange={(e) =>
                          updateRow(idx, { price: Number(e.target.value) })
                        }
                        disabled={true}
                        className="w-full border rounded-md px-3 py-2"
                      />
                    </div>

                    <div className="col-span-6 md:col-span-1">
                      <label className="text-sm font-medium text-gray-700">
                        Qty
                      </label>
                      <input
                        type="number"
                        value={r.qty}
                        onChange={(e) =>
                          updateRow(idx, {
                            qty: Math.max(0, Number(e.target.value)),
                          })
                        }
                        className="w-full border rounded-md px-3 py-2"
                      />
                    </div>

                    {/* Don't need discount anymore */}
                    {/* <div className="col-span-6 md:col-span-1">
                      <label className="text-sm font-medium text-gray-700">
                        Discount %
                      </label>
                      <input
                        type="number"
                        value={r.discount}
                        onChange={(e) =>
                          updateRow(idx, { discount: Number(e.target.value) })
                        }
                        className="w-full border rounded-md px-3 py-2"
                      />
                    </div> */}

                    {/* Only admin can edit bonus */}
                    <div className="col-span-6 md:col-span-1">
                      <label className="text-sm font-medium text-gray-700">
                        Bonus
                      </label>
                      <input
                        type="number"
                        value={r.bonus}
                        onChange={(e) =>
                          updateRow(idx, { bonus: Number(e.target.value) })
                        }
                        disabled={true}
                        className="w-full border rounded-md px-3 py-2"
                      />
                    </div>

                    <div className="col-span-6 md:col-span-1">
                      <label className="text-sm font-medium text-gray-700">
                        Subtotal
                      </label>
                      <div className="mt-1 font-medium">
                        {fmt(Number(subtotalRow || 0))}
                      </div>
                    </div>

                    <div className="col-span-12 md:col-span-1 flex gap-2">
                      <button
                        type="button"
                        onClick={() => addRow()}
                        className="w-full bg-green-50 text-green-700 border border-green-200 rounded px-2 py-2 hover:bg-green-100"
                        title="Add row"
                      >
                        +
                      </button>
                      {rows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRow(idx)}
                          className="w-full bg-red-50 text-red-700 border border-red-200 rounded px-2 py-2 hover:bg-red-100"
                          title="Remove row"
                        >
                          −
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totals & payment */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg shadow-sm col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Remarks
              </label>
              <textarea
                {...register("remarks")}
                className="w-full border rounded-md px-3 py-2"
                rows={3}
              />
            </div>

            <div className="bg-white p-4 rounded-lg shadow-sm space-y-2">
              <div className="flex justify-between">
                <div className="text-sm text-gray-600">Total Qty</div>
                <div className="font-semibold">{totalQty}</div>
              </div>
              <div className="flex justify-between">
                <div className="text-sm text-gray-600">Subtotal</div>
                <div className="font-semibold">{fmt(subtotal)}</div>
              </div>
              <div className="flex justify-between">
                <div className="text-sm text-gray-600">
                  VAT ({VAT_RATE * 100}%)
                </div>
                <div className="font-semibold">{fmt(vat)}</div>
              </div>
              <div className="flex justify-between mt-2 border-t pt-2">
                <div className="text-lg font-bold">Grand Total</div>
                <div className="text-lg font-bold text-indigo-600">
                  {fmt(grandTotal)}
                </div>
              </div>

              {/* Don't need paid amount anymore */}
              {/* <label className="block text-sm font-medium text-gray-700 mt-3">
                Paid Amount
              </label>
              <input
                {...register("paid_amount")}
                type="number"
                defaultValue={0}
                className="w-full border rounded-md px-3 py-2"
              /> */}

              <div className="flex justify-between mt-2">
                <div className="text-sm text-gray-600">Due</div>
                <div className="font-semibold text-red-600">{fmt(due)}</div>
              </div>

              <div className="mt-4 space-y-2">
                <button
                  type="submit"
                  className="w-full bg-indigo-600 text-white py-2 rounded-md hover:bg-indigo-700"
                >
                  Confirm Sale
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // quick reset (not removing draft)
                    if (!confirm("Reset form?")) return;
                    reset();
                    setRows([
                      {
                        id: String(Date.now()),
                        productId: "",
                        productName: "",
                        stock: "0",
                        batch: "",
                        price: 0,
                        qty: 0,
                        discount: 0,
                        bonus: 0,
                      },
                    ]);
                  }}
                  className="w-full bg-gray-100 py-2 rounded-md hover:bg-gray-200"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Invoice Preview & Modal */}
        {showInvoice && lastPayload && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-white w-full max-w-4xl rounded-lg shadow-xl overflow-auto"
              role="dialog"
              aria-modal="true"
            >
              <div className="p-4 flex items-start justify-between border-b">
                <div>
                  <h2 className="text-xl font-bold">Invoice Preview</h2>
                  <div className="text-sm text-gray-500">
                    Invoice No: {lastPayload.invoiceNo}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowInvoice(false)}
                    className="px-3 py-2 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    Close
                  </button>
                  <button
                    onClick={handlePrint}
                    className="px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                  >
                    Print Invoice
                  </button>
                  <button
                    onClick={() => {
                      // example API simulation
                      // Replace with fetch/post to your real API
                      alert("Simulating API submit... (replace with real API)");
                      setShowInvoice(false);
                    }}
                    className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    Submit to API
                  </button>
                </div>
              </div>

              <div ref={invoiceRef} className="p-6 text-sm">
                {/* Printable invoice content */}
                <div className="invoice-header flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-bold">Antab Agro</h3>
                    <div className="text-sm text-gray-600">Sales Invoice</div>
                    <div className="text-xs text-gray-500 mt-2">
                      {new Date().toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div>
                      Invoice: <strong>{lastPayload.invoiceNo}</strong>
                    </div>
                    <div>
                      Dealer:{" "}
                      <strong>
                        {dealers.find(
                          (d) => d.id === lastPayload.form.dealer_id
                        )?.label || lastPayload.form.dealer_id}
                      </strong>
                    </div>
                    <div>
                      Warehouse:{" "}
                      <strong>
                        {warehouses.find(
                          (w) => w.id === lastPayload.form.warehouse_id
                        )?.label || lastPayload.form.warehouse_id}
                      </strong>
                    </div>
                  </div>
                </div>

                <table className="mt-6 w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="border px-2 py-2 text-left">#</th>
                      <th className="border px-2 py-2 text-left">Product</th>
                      <th className="border px-2 py-2 text-right">Qty</th>
                      <th className="border px-2 py-2 text-right">Price</th>
                      <th className="border px-2 py-2 text-right">Discount</th>
                      <th className="border px-2 py-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lastPayload.rows.map((r: Row, i: number) => {
                      const ss =
                        r.qty * r.price -
                        (r.discount / 100) * (r.price * r.qty);
                      return (
                        <tr key={r.id}>
                          <td className="border px-2 py-2">{i + 1}</td>
                          <td className="border px-2 py-2">
                            {r.productName ||
                              products.find((p) => p.id === r.productId)
                                ?.name ||
                              r.productId}
                          </td>
                          <td className="border px-2 py-2 text-right">
                            {r.qty}
                          </td>
                          <td className="border px-2 py-2 text-right">
                            {fmt(r.price)}
                          </td>
                          <td className="border px-2 py-2 text-right">
                            {r.discount}%
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
                        VAT ({VAT_RATE * 100}%)
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
                    <div className="text-sm text-gray-600">Remarks</div>
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
