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
import { Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

type StockProduct = {
  product: string;
  currentStock: string;
  quantity: string;
  productionRate: string;
  batchNo: string;
};

type StockData = {
  id: number;
  date: string;
  warehouse: string;
  productName: string;
  batchNo: string;
  qty: number;
  rate: string;
};

export default function StockInListPage() {
  const [stockEntryOpen, setStockEntryOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Sample stock data
  const stockData: StockData[] = [
    {
      id: 1,
      date: "2023-08-19",
      warehouse: "Bogura Depot",
      productName: "Ajax 35SC 25ml",
      batchNo: "",
      qty: 1200,
      rate: "40",
    },
    {
      id: 2,
      date: "2023-08-19",
      warehouse: "Bogura Depot",
      productName: "Ajax 35SC 50ml",
      batchNo: "",
      qty: 1470,
      rate: "76",
    },
    {
      id: 23,
      date: "2023-09-09",
      warehouse: "Bogura Depot",
      productName: "Ajax 35SC 400ml",
      batchNo: "0",
      qty: 1375,
      rate: "680",
    },
    {
      id: 80,
      date: "2024-07-01",
      warehouse: "Bogura Depot",
      productName: "Abastin 1.8ME 100ml",
      batchNo: "0",
      qty: 31,
      rate: "54.4444",
    },
    {
      id: 81,
      date: "2024-07-01",
      warehouse: "Bogura Depot",
      productName: "Abastin 1.8ME 5Ltr",
      batchNo: "0",
      qty: 45,
      rate: "2722.22",
    },
    {
      id: 82,
      date: "2024-07-01",
      warehouse: "Bogura Depot",
      productName: "Borkot 2.5EC 400ml",
      batchNo: "0",
      qty: 301,
      rate: "120",
    },
    {
      id: 83,
      date: "2024-12-25",
      warehouse: "Bogura Depot",
      productName: "Sobuz (4-CPA) 100ml",
      batchNo: "0",
      qty: 1288,
      rate: "1.751",
    },
  ];

  const [stockForm, setStockForm] = useState({
    date: "2025-10-08",
    expireDate: "",
    productionFactory: "",
    warehouse: "",
  });

  const [stockProducts, setStockProducts] = useState<StockProduct[]>([
    {
      product: "",
      currentStock: "",
      quantity: "",
      productionRate: "",
      batchNo: "",
    },
  ]);

  const addProductRow = () => {
    setStockProducts([
      ...stockProducts,
      {
        product: "",
        currentStock: "",
        quantity: "",
        productionRate: "",
        batchNo: "",
      },
    ]);
  };

  const removeProductRow = (index: number) => {
    if (stockProducts.length > 1) {
      setStockProducts(stockProducts.filter((_, i) => i !== index));
    }
  };

  const updateProductRow = (
    index: number,
    field: keyof StockProduct,
    value: string
  ) => {
    const updated = [...stockProducts];
    updated[index][field] = value;
    setStockProducts(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("[v0] Stock form submitted:", { stockForm, stockProducts });
    setStockEntryOpen(false);
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this stock entry?")) {
      console.log("[v0] Deleting stock entry:", id);
    }
  };

  const totalPages = Math.ceil(stockData.length / 10);

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-end mb-6">
          <Button
            onClick={() => setStockEntryOpen(true)}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            Manual Stock In Entry
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
          STOCK IN LIST
        </h2>

        {/* Export Buttons and Search */}
        <div className="flex items-center justify-between mb-4">
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
      </div>

      {/* Data Table */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden mb-4">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-orange-500 text-white">
                <th className="px-4 py-3 text-left text-sm font-semibold whitespace-nowrap">
                  No
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold whitespace-nowrap">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold whitespace-nowrap">
                  Wirehouse Name
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold whitespace-nowrap">
                  Product Name
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold whitespace-nowrap">
                  Bach No.
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold whitespace-nowrap">
                  Qty
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold whitespace-nowrap">
                  Rate
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold whitespace-nowrap">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {stockData.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-border hover:bg-muted/50"
                >
                  <td className="px-4 py-3 text-sm text-foreground">
                    {item.id}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {item.date}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground font-semibold">
                    {item.warehouse}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {item.productName}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {item.batchNo}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {item.qty}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {item.rate}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 bg-red-500 hover:bg-red-600 text-white rounded"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
            Showing 1 to 272 of 272 entries
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className={`px-3 py-1 text-sm ${
                currentPage === 1
                  ? "text-gray-400 cursor-not-allowed"
                  : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              }`}
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(1)}
              className={`px-3 py-1 text-sm rounded ${
                currentPage === 1
                  ? "bg-blue-500 text-white"
                  : "text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              }`}
            >
              1
            </button>
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

      {/* Stock Entry Modal */}
      <Dialog open={stockEntryOpen} onOpenChange={setStockEntryOpen}>
        <DialogContent className="!max-w-[95vw] h-auto max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <h2 className="text-2xl font-bold text-center mb-2 text-foreground">
              MANUAL STOCK IN
            </h2>
            <div className="w-full h-0.5 bg-foreground mb-8"></div>

            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Row 1: Date and Expire Date */}
              <div className="grid grid-cols-3 gap-8">
                <div>
                  <Label className="text-blue-600 font-semibold">Date :</Label>
                  <Input
                    type="date"
                    className="mt-2 border-red-300"
                    value={stockForm.date}
                    onChange={(e) =>
                      setStockForm({ ...stockForm, date: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label className="text-blue-600 font-semibold">
                    Expire Date :
                  </Label>
                  <Input
                    type="date"
                    placeholder="dd/mm/yyyy"
                    className="mt-2 border-red-300"
                    value={stockForm.expireDate}
                    onChange={(e) =>
                      setStockForm({ ...stockForm, expireDate: e.target.value })
                    }
                  />
                </div>
                <div></div>
              </div>

              {/* Row 2: Production Factory and Store/Warehouse */}
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <Label className="text-blue-600 font-semibold">
                    Production Factory :
                  </Label>
                  <Select
                    value={stockForm.productionFactory}
                    onValueChange={(value) =>
                      setStockForm({ ...stockForm, productionFactory: value })
                    }
                  >
                    <SelectTrigger className="mt-2 border-red-300">
                      <SelectValue placeholder="=== Select Factory ===" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="factory1">Factory 1</SelectItem>
                      <SelectItem value="factory2">Factory 2</SelectItem>
                      <SelectItem value="factory3">Factory 3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-blue-600 font-semibold">
                    Store/Warehouse :
                  </Label>
                  <Select
                    value={stockForm.warehouse}
                    onValueChange={(value) =>
                      setStockForm({ ...stockForm, warehouse: value })
                    }
                  >
                    <SelectTrigger className="mt-2 border-red-300">
                      <SelectValue placeholder="=== Select Store ===" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bogura">Bogura Depot</SelectItem>
                      <SelectItem value="dhaka">Dhaka Depot</SelectItem>
                      <SelectItem value="rajshahi">Rajshahi Depot</SelectItem>
                      <SelectItem value="rangpur">Rangpur Depot</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Product Rows */}
              <div className="space-y-4">
                {stockProducts.map((item, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 items-end"
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
                          <SelectItem value="ajax-25">
                            Ajax 35SC 25ml
                          </SelectItem>
                          <SelectItem value="ajax-50">
                            Ajax 35SC 50ml
                          </SelectItem>
                          <SelectItem value="ajax-400">
                            Ajax 35SC 400ml
                          </SelectItem>
                          <SelectItem value="abastin-100">
                            Abastin 1.8ME 100ml
                          </SelectItem>
                          <SelectItem value="abastin-5">
                            Abastin 1.8ME 5Ltr
                          </SelectItem>
                          <SelectItem value="borkot">
                            Borkot 2.5EC 400ml
                          </SelectItem>
                          <SelectItem value="sobuz">
                            Sobuz (4-CPA) 100ml
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-blue-600 font-semibold">
                        Current Stock :
                      </Label>
                      <Input
                        type="text"
                        placeholder="Quantity"
                        className="mt-2 border-red-300 bg-gray-100 dark:bg-gray-800"
                        value={item.currentStock}
                        readOnly
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
                        Production Rate
                      </Label>
                      <Input
                        type="text"
                        className="mt-2 border-red-300"
                        value={item.productionRate}
                        onChange={(e) =>
                          updateProductRow(
                            index,
                            "productionRate",
                            e.target.value
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-blue-600 font-semibold">
                        Bach No :
                      </Label>
                      <Input
                        type="text"
                        className="mt-2 border-red-300"
                        value={item.batchNo}
                        onChange={(e) =>
                          updateProductRow(index, "batchNo", e.target.value)
                        }
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

              {/* Submit Button */}
              <div className="flex justify-center pt-4">
                <Button
                  type="submit"
                  className="bg-blue-500 hover:bg-blue-600 text-white px-12 py-3 text-lg"
                >
                  Confirm Stock In
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
