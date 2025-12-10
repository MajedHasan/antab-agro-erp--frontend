"use client";

import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Eye, Printer } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

type ReturnProduct = {
  product: string;
  price: string;
  quantity: string;
  total: string;
};

type ReturnData = {
  id: number;
  user: string;
  vendor: string;
  warehouse: string;
  returnDate: string;
  invoice: string;
  totalQty: number;
  grandTotal: string;
  updatedBy: string;
  products: Array<{
    name: string;
    price: string;
    quantity: string;
    totalValue: string;
  }>;
};

export default function ReturnListPage() {
  const [returnEntryOpen, setReturnEntryOpen] = useState(false);
  const [viewInvoiceOpen, setViewInvoiceOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<ReturnData | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage, setEntriesPerPage] = useState(10);

  // Sample return data
  const returnData: ReturnData[] = [
    {
      id: 1,
      user: "2025-07-28 20:33:03 0",
      vendor: "Bhai Bhai Traders",
      warehouse: "Bogura Depot",
      returnDate: "2025-01-11",
      invoice: "SR-Inv-2852",
      totalQty: 216,
      grandTotal: "128,100.60",
      updatedBy: "",
      products: [
        {
          name: "Bazigor 40WDG 100gm",
          price: "225.00",
          quantity: "36.00",
          totalValue: "8,100.00",
        },
        {
          name: "Bazigor 40WDG 300gm",
          price: "666.67",
          quantity: "180.00",
          totalValue: "120,000.60",
        },
      ],
    },
    {
      id: 2,
      user: "2025-07-29 20:37:47 0",
      vendor: "Shihab Traders",
      warehouse: "Bogura Depot",
      returnDate: "2024-12-30",
      invoice: "SR-Inv-2888",
      totalQty: 903,
      grandTotal: "68,464.16",
      updatedBy: "",
      products: [],
    },
    {
      id: 3,
      user: "2025-07-29 20:31:57 0",
      vendor: "Sarker Traders",
      warehouse: "Bogura Depot",
      returnDate: "2024-12-30",
      invoice: "SR-Inv-2887",
      totalQty: 300,
      grandTotal: "77,245.67",
      updatedBy: "",
      products: [],
    },
    {
      id: 4,
      user: "2025-07-29 20:29:41 0",
      vendor: "Shihab Traders",
      warehouse: "Bogura Depot",
      returnDate: "2024-12-30",
      invoice: "SR-Inv-2886",
      totalQty: 548,
      grandTotal: "151,736.26",
      updatedBy: "",
      products: [],
    },
    {
      id: 5,
      user: "2025-07-29 20:24:03 0",
      vendor: "Omio Traders",
      warehouse: "Bogura Depot",
      returnDate: "2024-12-30",
      invoice: "SR-Inv-2885",
      totalQty: 634,
      grandTotal: "157,400.88",
      updatedBy: "",
      products: [],
    },
    {
      id: 6,
      user: "2025-07-29 20:19:36 0",
      vendor: "Bhai Bhai Traders",
      warehouse: "Bogura Depot",
      returnDate: "2024-12-30",
      invoice: "SR-Inv-2884",
      totalQty: 838,
      grandTotal: "117,320.50",
      updatedBy: "",
      products: [],
    },
    {
      id: 7,
      user: "2025-07-28 20:36:50 0",
      vendor: "Krishi Clinic",
      warehouse: "Bogura Depot",
      returnDate: "2024-12-30",
      invoice: "SR-Inv-2854",
      totalQty: 200,
      grandTotal: "103,098.80",
      updatedBy: "",
      products: [],
    },
    {
      id: 10,
      user: "2025-07-28 20:47:25 0",
      vendor: "TanimTraders",
      warehouse: "Bogura Depot",
      returnDate: "2024-12-19",
      invoice: "SR-Inv-2858",
      totalQty: 51,
      grandTotal: "8,166.67",
      updatedBy: "",
      products: [],
    },
  ];

  const [returnForm, setReturnForm] = useState({
    date: "2025-10-08",
    vendorName: "",
    warehouse: "",
    invoiceNo: "3603",
  });

  const [returnProducts, setReturnProducts] = useState<ReturnProduct[]>([
    { product: "", price: "", quantity: "", total: "" },
  ]);

  const addProductRow = () => {
    setReturnProducts([
      ...returnProducts,
      { product: "", price: "", quantity: "", total: "" },
    ]);
  };

  const removeProductRow = (index: number) => {
    if (returnProducts.length > 1) {
      setReturnProducts(returnProducts.filter((_, i) => i !== index));
    }
  };

  const updateProductRow = (
    index: number,
    field: keyof ReturnProduct,
    value: string
  ) => {
    const updated = [...returnProducts];
    updated[index][field] = value;

    // Auto-calculate total when price or quantity changes
    if (field === "price" || field === "quantity") {
      const price =
        Number.parseFloat(field === "price" ? value : updated[index].price) ||
        0;
      const quantity =
        Number.parseFloat(
          field === "quantity" ? value : updated[index].quantity
        ) || 0;
      updated[index].total = (price * quantity).toFixed(2);
    }

    setReturnProducts(updated);
  };

  const calculateTotals = () => {
    const totalQty = returnProducts.reduce(
      (sum, item) => sum + (Number.parseFloat(item.quantity) || 0),
      0
    );
    const totalPrice = returnProducts.reduce(
      (sum, item) => sum + (Number.parseFloat(item.total) || 0),
      0
    );
    return { totalQty, totalPrice, payable: totalPrice };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("[v0] Return form submitted:", { returnForm, returnProducts });
    setReturnEntryOpen(false);
  };

  const handleViewInvoice = (returnItem: ReturnData) => {
    setSelectedReturn(returnItem);
    setViewInvoiceOpen(true);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this return?")) {
      console.log("[v0] Deleting return:", id);
    }
  };

  const handleCheckout = (returnItem: ReturnData) => {
    // Pre-fill the form with return data
    setReturnForm({
      date: returnItem.returnDate,
      vendorName: returnItem.vendor,
      warehouse: returnItem.warehouse,
      invoiceNo: returnItem.invoice,
    });

    // Pre-fill products
    if (returnItem.products.length > 0) {
      setReturnProducts(
        returnItem.products.map((p) => ({
          product: p.name,
          price: p.price,
          quantity: p.quantity,
          total: p.totalValue.replace(/,/g, ""),
        }))
      );
    }

    setReturnEntryOpen(true);
  };

  const totalPages = Math.ceil(returnData.length / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = startIndex + entriesPerPage;
  const currentData = returnData.slice(startIndex, endIndex);

  const totals = calculateTotals();

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-end mb-6">
          <Button
            onClick={() => setReturnEntryOpen(true)}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            Return Entry
          </Button>
        </div>

        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            ANTAB AGRO LIMITED
          </h1>
          <p className="text-muted-foreground">
            Globe Nibash, Segun Bagicha, Dhaka-1000
          </p>
        </div>

        <h2 className="text-2xl font-bold text-center mb-6 text-foreground">
          Return List
        </h2>

        {/* Show entries and Search */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-blue-600 font-semibold">Show</span>
            <Select
              value={entriesPerPage.toString()}
              onValueChange={(value) => setEntriesPerPage(Number(value))}
            >
              <SelectTrigger className="w-20 border-red-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-blue-600 font-semibold">entries</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-blue-600 font-semibold">Search:</span>
            <Input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64 border-red-300"
              placeholder=""
            />
          </div>
        </div>

        {/* Export Buttons */}
        <div className="bg-card border border-border p-4 rounded-lg shadow-sm mb-4">
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="bg-gray-600 hover:bg-gray-700 text-white"
            >
              Copy
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="bg-gray-600 hover:bg-gray-700 text-white"
            >
              CSV
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="bg-gray-600 hover:bg-gray-700 text-white"
            >
              Excel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="bg-gray-600 hover:bg-gray-700 text-white"
            >
              PDF
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="bg-gray-600 hover:bg-gray-700 text-white"
            >
              Print
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="bg-gray-600 hover:bg-gray-700 text-white"
            >
              Column visibility
            </Button>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden mb-4">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-orange-500 text-white">
                <th className="px-4 py-3 text-left text-sm font-semibold whitespace-nowrap">
                  Sl
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold whitespace-nowrap">
                  User
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold whitespace-nowrap">
                  Vendor
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold whitespace-nowrap">
                  Wirehouse
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold whitespace-nowrap">
                  Return Date
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold whitespace-nowrap">
                  Invoice
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold whitespace-nowrap">
                  Total Qntty
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold whitespace-nowrap">
                  Grand Total
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold whitespace-nowrap">
                  Updated By
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold whitespace-nowrap">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {currentData.map((item, index) => (
                <tr
                  key={item.id}
                  className="border-b border-border hover:bg-muted/50"
                >
                  <td className="px-4 py-3 text-sm text-foreground">
                    {startIndex + index + 1}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {item.user}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground font-semibold">
                    {item.vendor}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {item.warehouse}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {item.returnDate}
                  </td>
                  <td className="px-4 py-3 text-sm text-green-600 font-semibold">
                    {item.invoice}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {item.totalQty}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {item.grandTotal}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {item.updatedBy}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCheckout(item)}
                        className="p-1.5 bg-green-500 hover:bg-green-600 text-white rounded"
                        title="Checkout"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleViewInvoice(item)}
                        className="p-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded"
                        title="View Invoice"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 bg-red-500 hover:bg-red-600 text-white rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="bg-card border border-border p-4 rounded-lg shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {startIndex + 1} to {Math.min(endIndex, returnData.length)}{" "}
            of {returnData.length} entries
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className={`px-3 py-1 text-sm ${
                currentPage === 1
                  ? "text-gray-400 cursor-not-allowed"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              Previous
            </button>
            {[1, 2, 3, 4, 5].map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-1 text-sm rounded ${
                  currentPage === page
                    ? "bg-blue-500 text-white"
                    : "text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() =>
                setCurrentPage(Math.min(totalPages, currentPage + 1))
              }
              disabled={currentPage === totalPages}
              className={`px-3 py-1 text-sm ${
                currentPage === totalPages
                  ? "text-gray-400 cursor-not-allowed"
                  : "text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              }`}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Return Entry Modal */}
      <Dialog open={returnEntryOpen} onOpenChange={setReturnEntryOpen}>
        <DialogContent className="!max-w-[95vw] h-auto max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <h2 className="text-2xl font-bold text-center mb-8 text-foreground">
              Sales Return Create
            </h2>

            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Row 1: Date, Vendor Name, Invoice No */}
              <div className="grid grid-cols-[1fr_2fr_auto] gap-8 items-end">
                <div>
                  <Label className="text-blue-600 font-semibold">Date :</Label>
                  <Input
                    type="date"
                    className="mt-2 border-red-300"
                    value={returnForm.date}
                    onChange={(e) =>
                      setReturnForm({ ...returnForm, date: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label className="text-blue-600 font-semibold">
                    Vendor Name :
                  </Label>
                  <Select
                    value={returnForm.vendorName}
                    onValueChange={(value) =>
                      setReturnForm({ ...returnForm, vendorName: value })
                    }
                  >
                    <SelectTrigger className="mt-2 border-red-300">
                      <SelectValue placeholder="Select Vandor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bhai-bhai">
                        Bhai Bhai Traders
                      </SelectItem>
                      <SelectItem value="shihab">Shihab Traders</SelectItem>
                      <SelectItem value="sarker">Sarker Traders</SelectItem>
                      <SelectItem value="omio">Omio Traders</SelectItem>
                      <SelectItem value="krishi">Krishi Clinic</SelectItem>
                      <SelectItem value="tanim">TanimTraders</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-foreground">
                    Invoice No: {returnForm.invoiceNo}
                  </p>
                </div>
              </div>

              {/* Row 2: Branch/Warehouse */}
              <div>
                <Label className="text-blue-600 font-semibold">
                  Branch/Warehouse :
                </Label>
                <Select
                  value={returnForm.warehouse}
                  onValueChange={(value) =>
                    setReturnForm({ ...returnForm, warehouse: value })
                  }
                >
                  <SelectTrigger className="mt-2 border-red-300">
                    <SelectValue placeholder="Select Warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bogura">Bogura Depot</SelectItem>
                    <SelectItem value="dhaka">Dhaka Depot</SelectItem>
                    <SelectItem value="rajshahi">Rajshahi Depot</SelectItem>
                    <SelectItem value="rangpur">Rangpur Depot</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Product Rows */}
              <div className="space-y-4">
                {returnProducts.map((item, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 items-end"
                  >
                    <div>
                      <Label className="text-blue-600 font-semibold">
                        Product Name:
                      </Label>
                      <Select
                        value={item.product}
                        onValueChange={(value) =>
                          updateProductRow(index, "product", value)
                        }
                      >
                        <SelectTrigger className="mt-2 border-red-300">
                          <SelectValue placeholder="Select Product" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bazigor-100">
                            Bazigor 40WDG 100gm
                          </SelectItem>
                          <SelectItem value="bazigor-300">
                            Bazigor 40WDG 300gm
                          </SelectItem>
                          <SelectItem value="antab-falon-100">
                            Antab Falon 100ml
                          </SelectItem>
                          <SelectItem value="antab-falon-500">
                            Antab Falon 500ml
                          </SelectItem>
                          <SelectItem value="promectin">
                            Promectin Plus 10SG 100g
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-blue-600 font-semibold">
                        Price :
                      </Label>
                      <Input
                        type="text"
                        placeholder="Price"
                        className="mt-2 border-red-300"
                        value={item.price}
                        onChange={(e) =>
                          updateProductRow(index, "price", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-blue-600 font-semibold">
                        Quantity :
                      </Label>
                      <Input
                        type="text"
                        placeholder="Quantity"
                        className="mt-2 border-red-300"
                        value={item.quantity}
                        onChange={(e) =>
                          updateProductRow(index, "quantity", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-blue-600 font-semibold">
                        Total :
                      </Label>
                      <Input
                        type="text"
                        className="mt-2 border-red-300 bg-gray-50"
                        value={item.total}
                        readOnly
                      />
                    </div>
                    <div className="flex gap-2 items-end pb-1">
                      <Label className="text-blue-600 font-semibold">
                        Action :
                      </Label>
                      <button
                        type="button"
                        onClick={addProductRow}
                        className="p-2 bg-green-600 hover:bg-green-700 text-white rounded"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals Summary */}
              <div className="flex justify-end">
                <div className="w-96 space-y-3 border border-border p-4 rounded">
                  <div className="flex justify-between items-center border-b border-border pb-2">
                    <span className="font-semibold text-foreground">
                      Total Qty :
                    </span>
                    <span className="text-foreground">{totals.totalQty}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-border pb-2">
                    <span className="font-semibold text-foreground">
                      Total Price :
                    </span>
                    <span className="text-foreground">
                      {totals.totalPrice.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-foreground">
                      Payable :
                    </span>
                    <span className="text-foreground">
                      {totals.payable.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-center pt-4">
                <Button
                  type="submit"
                  className="bg-blue-500 hover:bg-blue-600 text-white px-12 py-3 text-lg"
                >
                  Return Confirm
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Invoice Modal */}
      <Dialog open={viewInvoiceOpen} onOpenChange={setViewInvoiceOpen}>
        <DialogContent className="!max-w-[95vw] h-auto max-h-[90vh] overflow-y-auto">
          <div className="p-8 bg-white dark:bg-gray-900">
            {/* Print Button */}
            <div className="flex justify-end mb-4">
              <Button
                onClick={handlePrint}
                className="bg-yellow-500 hover:bg-yellow-600 text-white border border-yellow-600"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
            </div>

            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-foreground mb-2">
                ANTAB AGRO LIMITED
              </h1>
              <p className="text-muted-foreground">
                Globe Nibash, Segun Bagicha, Dhaka-1000
              </p>
            </div>

            <h2 className="text-2xl font-bold text-center mb-8 text-foreground">
              RETURN INVOICE VIEW
            </h2>

            {/* Invoice Details */}
            {selectedReturn && (
              <>
                <div className="space-y-2 mb-8 text-foreground">
                  <div className="flex gap-4">
                    <span className="font-bold">Date :</span>
                    <span>{selectedReturn.returnDate}</span>
                  </div>
                  <div className="flex gap-4">
                    <span className="font-bold">Invoice :</span>
                    <span>{selectedReturn.invoice}</span>
                  </div>
                  <div className="flex gap-4">
                    <span className="font-bold">Dealer :</span>
                    <span>{selectedReturn.vendor}</span>
                  </div>
                  <div className="flex gap-4">
                    <span className="font-bold">Warehouse :</span>
                    <span>{selectedReturn.warehouse}</span>
                  </div>
                </div>

                {/* Products Table */}
                <div className="border border-border rounded-lg overflow-hidden mb-8">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-orange-500 text-white">
                        <th className="px-4 py-3 text-left text-sm font-semibold">
                          #
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">
                          Product Name
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">
                          Price
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">
                          Quantity
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">
                          Total Value
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedReturn.products.map((product, index) => (
                        <tr key={index} className="border-b border-border">
                          <td className="px-4 py-3 text-sm text-foreground">
                            {index + 1}
                          </td>
                          <td className="px-4 py-3 text-sm text-foreground font-semibold">
                            {product.name}
                          </td>
                          <td className="px-4 py-3 text-sm text-foreground text-right">
                            {product.price}
                          </td>
                          <td className="px-4 py-3 text-sm text-foreground text-right">
                            {product.quantity}
                          </td>
                          <td className="px-4 py-3 text-sm text-foreground text-right">
                            {product.totalValue}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-gray-100 dark:bg-gray-800 font-semibold">
                        <td
                          colSpan={3}
                          className="px-4 py-3 text-sm text-foreground text-right"
                        >
                          Total
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground text-right">
                          {selectedReturn.totalQty}
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground text-right">
                          {selectedReturn.grandTotal}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Signature Section */}
                <div className="grid grid-cols-3 gap-8 mt-16 pt-8 border-t border-border">
                  <div className="text-center">
                    <div className="border-t-2 border-foreground pt-2 mt-12">
                      <p className="font-semibold text-foreground">
                        Delivered By
                      </p>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="border-t-2 border-foreground pt-2 mt-12">
                      <p className="font-semibold text-foreground">
                        Printed By
                      </p>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="border-t-2 border-foreground pt-2 mt-12">
                      <p className="font-semibold text-foreground">
                        Autorise Signature
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
