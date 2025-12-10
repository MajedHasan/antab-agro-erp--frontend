"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Sales List — feature-rich Next.js client page
 *
 * - Filters: invoice, date range (start/end), warehouse, dealer, presets
 * - Sorting: click column headers to sort asc/desc
 * - Pagination: page size, previous/next, page numbers
 * - Export: Copy & CSV download, Print (selection / filtered)
 * - Actions per-row: Checkout (link), Return (placeholder), View Invoice (modal), Delete (works, undo available)
 * - Bulk select rows + bulk delete/export
 *
 * Replace the mock `initialData` with API fetch calls (GET/list), and
 * replace `handleDelete` / `handleBulkDelete` with real DELETE calls.
 */

type Sale = {
  id: string;
  user: string;
  vendor: string;
  warehouse: string;
  salesDate: string; // yyyy-mm-dd
  invoice: string;
  qty: number;
  total: number;
  updatedBy?: string;
  checkoutUrl?: string;
  invoiceUrl?: string;
};

const initialData: Sale[] = [
  // copied/extended from your HTML example (10 rows)
  {
    id: "1",
    user: "04-09-2025 10:24 am (Admin)",
    vendor: "M/S Ma Traders",
    warehouse: "Bogura Depot",
    salesDate: "2025-08-19",
    invoice: "Sal-3063",
    qty: 226,
    total: 87032,
    updatedBy: "Admin",
    checkoutUrl: "https://erpantabagro.scanitbd.com/sales/checkout/Sal-3063",
    invoiceUrl: "https://erpantabagro.scanitbd.com/sales/invoice/Sal-3063",
  },
  {
    id: "2",
    user: "03-09-2025 04:00 pm (Admin)",
    vendor: "Ma Baba Traders",
    warehouse: "Bogura Depot",
    salesDate: "2025-08-19",
    invoice: "Sal-3062",
    qty: 44,
    total: 29680,
    updatedBy: "Admin",
    checkoutUrl: "https://erpantabagro.scanitbd.com/sales/checkout/Sal-3062",
    invoiceUrl: "https://erpantabagro.scanitbd.com/sales/invoice/Sal-3062",
  },
  {
    id: "3",
    user: "03-09-2025 03:10 pm (Admin)",
    vendor: "Humayon Traders",
    warehouse: "Bogura Depot",
    salesDate: "2025-08-19",
    invoice: "Sal-3061",
    qty: 125,
    total: 48738,
    updatedBy: "Admin",
    checkoutUrl: "https://erpantabagro.scanitbd.com/sales/checkout/Sal-3061",
    invoiceUrl: "https://erpantabagro.scanitbd.com/sales/invoice/Sal-3061",
  },
  {
    id: "4",
    user: "03-09-2025 03:05 pm (Admin)",
    vendor: "M/s Samiul Traders",
    warehouse: "Bogura Depot",
    salesDate: "2025-08-19",
    invoice: "Sal-3060",
    qty: 24,
    total: 16572,
    updatedBy: "Admin",
    checkoutUrl: "https://erpantabagro.scanitbd.com/sales/checkout/Sal-3060",
    invoiceUrl: "https://erpantabagro.scanitbd.com/sales/invoice/Sal-3060",
  },
  {
    id: "5",
    user: "03-09-2025 03:03 pm (Admin)",
    vendor: "M/S Safa Banijoloy",
    warehouse: "Bogura Depot",
    salesDate: "2025-08-19",
    invoice: "Sal-3059",
    qty: 348,
    total: 19991,
    updatedBy: "Admin",
    checkoutUrl: "https://erpantabagro.scanitbd.com/sales/checkout/Sal-3059",
    invoiceUrl: "https://erpantabagro.scanitbd.com/sales/invoice/Sal-3059",
  },
  {
    id: "6",
    user: "03-09-2025 03:00 pm (Admin)",
    vendor: "M/S Safa Banijoloy",
    warehouse: "Bogura Depot",
    salesDate: "2025-08-19",
    invoice: "Sal-3058",
    qty: 144,
    total: 11468,
    updatedBy: "Admin",
    checkoutUrl: "https://erpantabagro.scanitbd.com/sales/checkout/Sal-3058",
    invoiceUrl: "https://erpantabagro.scanitbd.com/sales/invoice/Sal-3058",
  },
  {
    id: "7",
    user: "03-09-2025 02:57 pm (Admin)",
    vendor: "Kanija Traders",
    warehouse: "Bogura Depot",
    salesDate: "2025-08-19",
    invoice: "Sal-3057",
    qty: 16,
    total: 10112,
    updatedBy: "Admin",
    checkoutUrl: "https://erpantabagro.scanitbd.com/sales/checkout/Sal-3057",
    invoiceUrl: "https://erpantabagro.scanitbd.com/sales/invoice/Sal-3057",
  },
  {
    id: "8",
    user: "03-09-2025 02:55 pm (Admin)",
    vendor: "Muktarul Traders",
    warehouse: "Bogura Depot",
    salesDate: "2025-08-19",
    invoice: "Sal-3056",
    qty: 262,
    total: 81393,
    updatedBy: "Admin",
    checkoutUrl: "https://erpantabagro.scanitbd.com/sales/checkout/Sal-3056",
    invoiceUrl: "https://erpantabagro.scanitbd.com/sales/invoice/Sal-3056",
  },
  {
    id: "9",
    user: "03-09-2025 02:50 pm (Admin)",
    vendor: "M/s Juabayer Traders",
    warehouse: "Bogura Depot",
    salesDate: "2025-08-19",
    invoice: "Sal-3055",
    qty: 6,
    total: 8034,
    updatedBy: "Admin",
    checkoutUrl: "https://erpantabagro.scanitbd.com/sales/checkout/Sal-3055",
    invoiceUrl: "https://erpantabagro.scanitbd.com/sales/invoice/Sal-3055",
  },
  {
    id: "10",
    user: "03-09-2025 02:29 pm (Admin)",
    vendor: "M/s Juabayer Traders",
    warehouse: "Bogura Depot",
    salesDate: "2025-08-19",
    invoice: "Sal-3054",
    qty: 160,
    total: 40254,
    updatedBy: "Admin",
    checkoutUrl: "https://erpantabagro.scanitbd.com/sales/checkout/Sal-3054",
    invoiceUrl: "https://erpantabagro.scanitbd.com/sales/invoice/Sal-3054",
  },
];

// Expand demo dataset to 40 rows so pagination looks real
while (initialData.length < 40) {
  const idx = initialData.length + 1;
  initialData.push({
    id: String(100 + idx),
    user: `03-09-2025 01:${(idx % 60).toString().padStart(2, "0")} pm (Admin)`,
    vendor: ["Alpha Traders", "Beta Traders", "Gamma Traders"][idx % 3],
    warehouse: idx % 2 === 0 ? "Factory" : "Bogura Depot",
    salesDate: `2025-08-${String((idx % 28) + 1).padStart(2, "0")}`,
    invoice: `Sal-${3054 + idx}`,
    qty: Math.floor(Math.random() * 300),
    total: Math.floor(Math.random() * 90000) + 1000,
    updatedBy: "Admin",
    checkoutUrl: "#",
    invoiceUrl: "#",
  });
}

export default function SalesListPage() {
  // data state (in real app you'd fetch & set)
  const [data, setData] = useState<Sale[]>(initialData);

  // filters
  const [invoiceFilter, setInvoiceFilter] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [dealerFilter, setDealerFilter] = useState("");
  const [startDate, setStartDate] = useState<string>(""); // yyyy-mm-dd
  const [endDate, setEndDate] = useState<string>("");

  // date preset selector: '7d', '30d', 'thisMonth', 'custom'
  const [datePreset, setDatePreset] = useState<
    "all" | "7d" | "30d" | "thisMonth" | "custom"
  >("all");

  // sorting
  const [sortBy, setSortBy] = useState<keyof Sale | "">("salesDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // selection for bulk actions
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  // modal state for invoice preview
  const [preview, setPreview] = useState<Sale | null>(null);

  // undo delete
  const undoRef = useRef<{ timer?: number; rows?: Sale[] }>({});

  // warehouses & dealers (would come from API)
  const warehouses = useMemo(() => {
    const s = Array.from(new Set(data.map((d) => d.warehouse)));
    return s;
  }, [data]);

  const dealers = useMemo(() => {
    const s = Array.from(new Set(data.map((d) => d.vendor)));
    return s;
  }, [data]);

  // apply date preset to startDate/endDate when user selects a preset
  useEffect(() => {
    const today = new Date();
    if (datePreset === "all") {
      setStartDate("");
      setEndDate("");
      return;
    }
    if (datePreset === "7d") {
      const a = new Date();
      a.setDate(today.getDate() - 6); // last 7 days inclusive
      setStartDate(a.toISOString().slice(0, 10));
      setEndDate(today.toISOString().slice(0, 10));
      return;
    }
    if (datePreset === "30d") {
      const a = new Date();
      a.setDate(today.getDate() - 29);
      setStartDate(a.toISOString().slice(0, 10));
      setEndDate(today.toISOString().slice(0, 10));
      return;
    }
    if (datePreset === "thisMonth") {
      const a = new Date(today.getFullYear(), today.getMonth(), 1);
      const b = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setStartDate(a.toISOString().slice(0, 10));
      setEndDate(b.toISOString().slice(0, 10));
      return;
    }
    // custom -> keep current start/end
  }, [datePreset]);

  // filtered & sorted dataset
  const filtered = useMemo(() => {
    let out = data.slice();

    // invoice filter
    if (invoiceFilter.trim()) {
      const q = invoiceFilter.trim().toLowerCase();
      out = out.filter((r) => r.invoice.toLowerCase().includes(q));
    }

    // warehouse
    if (warehouseFilter)
      out = out.filter((r) => r.warehouse === warehouseFilter);

    // dealer
    if (dealerFilter) out = out.filter((r) => r.vendor === dealerFilter);

    // date range
    if (startDate) {
      out = out.filter((r) => r.salesDate >= startDate);
    }
    if (endDate) {
      out = out.filter((r) => r.salesDate <= endDate);
    }

    // sorting
    if (sortBy) {
      out.sort((a, b) => {
        const av = (a as any)[sortBy];
        const bv = (b as any)[sortBy];
        if (typeof av === "number" && typeof bv === "number") {
          return sortDir === "asc" ? av - bv : bv - av;
        }
        const as = String(av ?? "").toLowerCase();
        const bs = String(bv ?? "").toLowerCase();
        if (as > bs) return sortDir === "asc" ? 1 : -1;
        if (as < bs) return sortDir === "asc" ? -1 : 1;
        return 0;
      });
    }

    return out;
  }, [
    data,
    invoiceFilter,
    warehouseFilter,
    dealerFilter,
    startDate,
    endDate,
    sortBy,
    sortDir,
  ]);

  // pagination slice
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  const pageData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  // totals for filtered set
  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, cur) => {
        acc.qty += cur.qty;
        acc.total += cur.total;
        return acc;
      },
      { qty: 0, total: 0 }
    );
  }, [filtered]);

  // SELECT / BULK
  const toggleSelect = (id: string) => {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  };
  const selectAllOnPage = (checked: boolean) => {
    const pageIds = pageData.map((r) => r.id);
    setSelected((s) => {
      const copy = { ...s };
      pageIds.forEach((id) => (copy[id] = checked));
      return copy;
    });
  };
  const selectedRows = useMemo(
    () => Object.keys(selected).filter((k) => selected[k]),
    [selected]
  );

  // EXPORT helpers
  const toCSV = (rows: Sale[]) => {
    if (!rows.length) return "";
    const headers = [
      "id",
      "user",
      "vendor",
      "warehouse",
      "salesDate",
      "invoice",
      "qty",
      "total",
      "updatedBy",
    ];
    const csv = [
      headers.join(","),
      ...rows.map((r) =>
        headers
          .map((h) => {
            const v = (r as any)[h] ?? "";
            // escape quotes
            return `"${String(v).replace(/"/g, '""')}"`;
          })
          .join(",")
      ),
    ].join("\n");
    return csv;
  };

  const downloadCSV = (rows: Sale[], filename = "sales.csv") => {
    const csv = toCSV(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = async (rows: Sale[]) => {
    try {
      const csv = toCSV(rows);
      await navigator.clipboard.writeText(csv);
      alert("Copied CSV to clipboard.");
    } catch (e) {
      alert("Copy failed (browser may block).");
    }
  };

  const handlePrint = (rows: Sale[] = filtered) => {
    // open new window and render printable table
    const html = `
      <html>
        <head>
          <title>Sales List Print</title>
          <style>
            body{font-family: Arial, sans-serif;padding:20px;color:#111}
            table{width:100%;border-collapse:collapse}
            th,td{border:1px solid #ddd;padding:6px;text-align:left;font-size:12px}
            th{background:#f3f4f6}
            .right{text-align:right}
          </style>
        </head>
        <body>
          <h2>ANTAB AGRO LIMITED — Sales List</h2>
          <table>
            <thead>
              <tr>
                <th>Sl</th><th>User</th><th>Vendor</th><th>Warehouse</th><th>Sales Date</th><th>Invoice</th><th>Qty</th><th class="right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${rows
                .map(
                  (r, i) => `<tr>
                  <td>${i + 1}</td>
                  <td>${r.user}</td>
                  <td>${r.vendor}</td>
                  <td>${r.warehouse}</td>
                  <td>${r.salesDate}</td>
                  <td>${r.invoice}</td>
                  <td>${r.qty}</td>
                  <td class="right">${r.total.toLocaleString()}</td>
                </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </body>
      </html>
    `;
    const w = window.open("", "_blank", "width=1000,height=800");
    if (!w) {
      alert("Popup blocked. Allow popups to print.");
      return;
    }
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

  // DELETE single (client-side) — replace with your API call later
  const handleDelete = (id: string) => {
    if (
      !confirm("Delete this sale? This action can be undone for a short time.")
    )
      return;
    // store current rows for undo
    const before = data.slice();
    const newData = data.filter((d) => d.id !== id);
    setData(newData);

    // set undo
    if (undoRef.current.timer) window.clearTimeout(undoRef.current.timer);
    undoRef.current.rows = before;
    undoRef.current.timer = window.setTimeout(() => {
      undoRef.current = {};
      // In real app: call API to delete permanently here (or handle server sync)
    }, 8000); // 8s undo window
    alert("Deleted locally (you have 8s to undo).");
  };

  const handleUndo = () => {
    if (undoRef.current.rows) {
      setData(undoRef.current.rows);
      undoRef.current = {};
      alert("Undo successful.");
    } else {
      alert("Nothing to undo.");
    }
  };

  // BULK DELETE
  const handleBulkDelete = () => {
    const ids = selectedRows;
    if (!ids.length) return alert("No rows selected.");
    if (!confirm(`Delete ${ids.length} selected row(s)?`)) return;
    const before = data.slice();
    setData((s) => s.filter((r) => !ids.includes(r.id)));
    setSelected({});
    // allow undo
    if (undoRef.current.timer) window.clearTimeout(undoRef.current.timer);
    undoRef.current.rows = before;
    undoRef.current.timer = window.setTimeout(() => {
      undoRef.current = {};
    }, 8000);
    alert(`Deleted ${ids.length} rows locally. Undo available for 8s.`);
  };

  // view invoice modal (simple)
  const openPreview = (sale: Sale) => setPreview(sale);
  const closePreview = () => setPreview(null);

  // toggle sorting
  const toggleSort = (key: keyof Sale) => {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* header */}
        <div className="text-center">
          <h3 className="text-2xl font-extrabold uppercase">
            ANTAB AGRO LIMITED
          </h3>
          <p className="text-sm text-gray-600">
            Globe Nibash, Segun Bagicha, Dhaka-1000
          </p>
          <h4 className="text-lg font-semibold mt-1">Sales List</h4>
          <p className="text-xs">
            Sales list can view and edit for only Area Manager, RSM, ZSM, Sales
            Manager, NSM
            <br />
            Every Roles can only view and edit only their region not other
            region. Only NSM and admin can view all region.
            <br />
            Once all of them confirmed, The Sales List goes to DC and Hide from
            sales List
          </p>
        </div>

        {/* filters */}
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
            }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end"
          >
            <div className="lg:col-span-3">
              <label className="text-xs font-medium text-gray-600">
                Invoice
              </label>
              <input
                value={invoiceFilter}
                onChange={(e) => setInvoiceFilter(e.target.value)}
                className="mt-1 w-full border rounded-md px-3 py-2"
                placeholder="Invoice"
              />
            </div>

            <div className="lg:col-span-3">
              <label className="text-xs font-medium text-gray-600">
                Date Range
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setDatePreset("custom");
                  }}
                  className="mt-1 w-full border rounded-md px-3 py-2"
                />
                <span className="text-gray-400">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setDatePreset("custom");
                  }}
                  className="mt-1 w-full border rounded-md px-3 py-2"
                />
              </div>

              {/* presets */}
              <div className="mt-2 flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setDatePreset("7d")}
                  className={`px-2 py-1 rounded ${
                    datePreset === "7d"
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100"
                  }`}
                >
                  Last 7d
                </button>
                <button
                  type="button"
                  onClick={() => setDatePreset("30d")}
                  className={`px-2 py-1 rounded ${
                    datePreset === "30d"
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100"
                  }`}
                >
                  30d
                </button>
                <button
                  type="button"
                  onClick={() => setDatePreset("thisMonth")}
                  className={`px-2 py-1 rounded ${
                    datePreset === "thisMonth"
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100"
                  }`}
                >
                  This month
                </button>
                <button
                  type="button"
                  onClick={() => setDatePreset("all")}
                  className={`px-2 py-1 rounded ${
                    datePreset === "all"
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100"
                  }`}
                >
                  All
                </button>
              </div>
            </div>

            <div className="lg:col-span-2">
              <label className="text-xs font-medium text-gray-600">
                Warehouse
              </label>
              <select
                className="mt-1 w-full border rounded-md px-3 py-2"
                value={warehouseFilter}
                onChange={(e) => setWarehouseFilter(e.target.value)}
              >
                <option value="">Select Warehouse</option>
                {warehouses.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-2">
              <label className="text-xs font-medium text-gray-600">
                Dealer
              </label>
              <select
                className="mt-1 w-full border rounded-md px-3 py-2"
                value={dealerFilter}
                onChange={(e) => setDealerFilter(e.target.value)}
              >
                <option value="">Select Dealer</option>
                {dealers.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-2 flex gap-2">
              <button
                type="submit"
                className="mt-1 w-full bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700"
              >
                Search
              </button>
              <button
                type="button"
                onClick={() => {
                  setInvoiceFilter("");
                  setWarehouseFilter("");
                  setDealerFilter("");
                  setStartDate("");
                  setEndDate("");
                  setDatePreset("all");
                }}
                className="mt-1 w-full bg-red-100 text-red-700 px-3 py-2 rounded-md hover:bg-red-200"
              >
                Clear
              </button>
            </div>
          </form>
        </div>

        {/* action bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={
                  pageData.every((r) => !!selected[r.id]) && pageData.length > 0
                }
                onChange={(e) => selectAllOnPage(e.target.checked)}
                aria-label="Select all on page"
                className="h-4 w-4"
              />
              <span className="text-sm text-gray-600">Select page</span>
            </div>

            <button
              onClick={() => {
                const rows = data.filter((r) => selected[r.id]);
                if (!rows.length) return alert("No rows selected.");
                downloadCSV(rows, "selected-sales.csv");
              }}
              className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              Export Selected (CSV)
            </button>

            <button
              onClick={() => handleBulkDelete()}
              className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
            >
              Delete Selected
            </button>

            <button
              onClick={() => copyToClipboard(filtered)}
              className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200"
            >
              Copy (filtered)
            </button>

            <button
              onClick={() => downloadCSV(filtered, "filtered-sales.csv")}
              className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200"
            >
              CSV (filtered)
            </button>

            <button
              onClick={() => handlePrint(pageData)}
              className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200"
            >
              Print page
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-600">Rows per page</div>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="border rounded px-2 py-1"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        {/* table */}
        <div className="bg-white rounded-lg shadow overflow-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="sticky top-0 bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left w-8">Sl</th>
                <th
                  className="px-3 py-2 text-left cursor-pointer"
                  onClick={() => toggleSort("user")}
                >
                  User{" "}
                  {sortBy === "user" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                </th>
                <th
                  className="px-3 py-2 text-left cursor-pointer"
                  onClick={() => toggleSort("vendor")}
                >
                  Vendor{" "}
                  {sortBy === "vendor" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                </th>
                <th className="px-3 py-2 text-left">Warehouse</th>
                <th
                  className="px-3 py-2 text-left cursor-pointer"
                  onClick={() => toggleSort("salesDate")}
                >
                  Sales Date{" "}
                  {sortBy === "salesDate"
                    ? sortDir === "asc"
                      ? "▲"
                      : "▼"
                    : ""}
                </th>
                <th className="px-3 py-2 text-left">Invoice</th>
                <th
                  className="px-3 py-2 text-right cursor-pointer"
                  onClick={() => toggleSort("qty")}
                >
                  Total Qntty{" "}
                  {sortBy === "qty" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                </th>
                <th
                  className="px-3 py-2 text-right cursor-pointer"
                  onClick={() => toggleSort("total")}
                >
                  Grand Total{" "}
                  {sortBy === "total" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                </th>
                <th className="px-3 py-2 text-left">Updated By</th>
                <th className="px-3 py-2 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {pageData.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    No records found.
                  </td>
                </tr>
              )}

              {pageData.map((row, i) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">{(page - 1) * pageSize + i + 1}</td>

                  <td className="px-3 py-2">{row.user}</td>
                  <td className="px-3 py-2">{row.vendor}</td>
                  <td className="px-3 py-2">{row.warehouse}</td>
                  <td className="px-3 py-2">{row.salesDate}</td>
                  <td className="px-3 py-2 font-semibold text-red-600">
                    {row.invoice}
                  </td>

                  <td className="px-3 py-2 text-right">{row.qty}</td>
                  <td className="px-3 py-2 text-right font-semibold text-green-600">
                    {row.total.toLocaleString()}
                  </td>

                  <td className="px-3 py-2">{row.updatedBy || "-"}</td>

                  <td className="px-3 py-2 text-center">
                    <div className="inline-flex gap-1">
                      <a
                        href={row.checkoutUrl || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-1 rounded bg-emerald-500 text-white text-xs hover:opacity-90"
                        title="CheckOut Invoice"
                      >
                        ⟳
                      </a>

                      <button
                        onClick={() =>
                          alert("Return placeholder — replace with actual flow")
                        }
                        className="px-2 py-1 rounded bg-slate-200 text-xs"
                        title="Return"
                      >
                        ↺
                      </button>

                      <button
                        onClick={() => openPreview(row)}
                        className="px-2 py-1 rounded bg-blue-600 text-white text-xs"
                        title="View Invoice"
                      >
                        👁
                      </button>

                      <button
                        onClick={() => handleDelete(row.id)}
                        className="px-2 py-1 rounded bg-red-600 text-white text-xs"
                        title="Delete"
                      >
                        🗑
                      </button>

                      <input
                        type="checkbox"
                        checked={!!selected[row.id]}
                        onChange={() => toggleSelect(row.id)}
                        className="ml-2"
                        title="Select"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* footer: showing x-y of N */}
          <div className="flex items-center justify-between p-3 border-t text-sm bg-gray-50">
            <div>
              Showing <strong>{(page - 1) * pageSize + 1}</strong> to{" "}
              <strong>{Math.min(page * pageSize, total)}</strong> of{" "}
              <strong>{total}</strong> entries
            </div>

            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-600">Totals (filtered):</div>
              <div className="text-sm font-semibold">Qty: {totals.qty}</div>
              <div className="text-sm font-semibold">
                Amount: {totals.total.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* pagination controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 border rounded disabled:opacity-50"
              disabled={page === 1}
            >
              Prev
            </button>
            {Array.from({ length: totalPages }, (_, idx) => idx + 1)
              .slice(Math.max(0, page - 4), Math.min(totalPages, page + 3))
              .map((pIdx) => (
                <button
                  key={pIdx}
                  onClick={() => setPage(pIdx)}
                  className={`px-3 py-1 border rounded ${
                    pIdx === page ? "bg-indigo-600 text-white" : "bg-white"
                  }`}
                >
                  {pIdx}
                </button>
              ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1 border rounded"
              disabled={page === totalPages}
            >
              Next
            </button>
          </div>

          <div className="text-sm">
            Page {page} / {totalPages}
          </div>
        </div>

        {/* preview modal */}
        {preview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white max-w-3xl w-full rounded-lg shadow-lg overflow-auto">
              <div className="flex items-center justify-between p-4 border-b">
                <div>
                  <h3 className="text-lg font-bold">
                    Invoice — {preview.invoice}
                  </h3>
                  <div className="text-sm text-gray-500">{preview.user}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      // simple print of invoice (open new window)
                      const html = `
                        <html>
                          <head><title>Invoice ${preview.invoice}</title></head>
                          <body>
                            <h2>ANTAB AGRO LIMITED</h2>
                            <h3>Invoice: ${preview.invoice}</h3>
                            <p>Vendor: ${preview.vendor}</p>
                            <p>Warehouse: ${preview.warehouse}</p>
                            <p>Sales Date: ${preview.salesDate}</p>
                            <p>Qty: ${preview.qty}</p>
                            <p>Total: ${preview.total.toLocaleString()}</p>
                          </body>
                        </html>
                      `;
                      const w = window.open(
                        "",
                        "_blank",
                        "width=800,height=600"
                      );
                      if (!w) return alert("Popup blocked");
                      w.document.write(html);
                      w.document.close();
                      setTimeout(() => w.print(), 300);
                    }}
                    className="px-3 py-1 bg-indigo-600 text-white rounded"
                  >
                    Print
                  </button>
                  <button
                    onClick={() => setPreview(null)}
                    className="px-3 py-1 bg-gray-100 rounded"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-500">Vendor</div>
                    <div className="font-medium">{preview.vendor}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Warehouse</div>
                    <div className="font-medium">{preview.warehouse}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Sales Date</div>
                    <div className="font-medium">{preview.salesDate}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">User</div>
                    <div className="font-medium">{preview.user}</div>
                  </div>
                </div>

                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left">#</th>
                      <th className="text-left">Item</th>
                      <th className="text-right">Qty</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>1</td>
                      <td>{preview.invoice} (sample item)</td>
                      <td className="text-right">{preview.qty}</td>
                      <td className="text-right">
                        {preview.total.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* undo toast */}
        <div className="fixed right-4 bottom-4">
          <div className="bg-white p-3 rounded shadow flex items-center gap-3">
            <div className="text-sm text-gray-600">Quick actions</div>
            <button
              onClick={handleUndo}
              className="px-3 py-1 bg-yellow-400 rounded"
            >
              Undo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
