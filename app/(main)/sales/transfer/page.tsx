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

type TransferProduct = {
  product: string;
  batchNo: string;
  quantity: string;
};

export default function TransferListPage() {
  const [transferEntryOpen, setTransferEntryOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [transferForm, setTransferForm] = useState({
    date: "2025-10-08",
    vehicle: "",
    transportFare: "",
    fromWarehouse: "",
    toWarehouse: "",
  });

  const [transferProducts, setTransferProducts] = useState<TransferProduct[]>([
    { product: "", batchNo: "", quantity: "" },
  ]);

  const addProductRow = () => {
    setTransferProducts([
      ...transferProducts,
      { product: "", batchNo: "", quantity: "" },
    ]);
  };

  const removeProductRow = (index: number) => {
    if (transferProducts.length > 1) {
      setTransferProducts(transferProducts.filter((_, i) => i !== index));
    }
  };

  const updateProductRow = (
    index: number,
    field: keyof TransferProduct,
    value: string,
  ) => {
    const updated = [...transferProducts];
    updated[index][field] = value;
    setTransferProducts(updated);
  };

  const calculateTotalAmount = () => {
    return "/-";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("[v0] Transfer form submitted:", {
      transferForm,
      transferProducts,
    });
    setTransferEntryOpen(false);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-end mb-6">
          <Button
            onClick={() => setTransferEntryOpen(true)}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            Transfer Entry
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
          TRANSFER LIST
        </h2>

        {/* Export Buttons and Search */}
        <div className="bg-card border border-border p-4 rounded-lg shadow-sm mb-4">
          <div className="flex items-center justify-between">
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
              <span className="text-sm text-blue-600 font-semibold">
                Search:
              </span>
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
      </div>

      {/* Data Table */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden mb-4">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-orange-500 text-white">
                <th className="px-4 py-3 text-left text-sm font-semibold whitespace-nowrap">
                  Sl. No
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold whitespace-nowrap">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold whitespace-nowrap">
                  From Wirehouse
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold whitespace-nowrap">
                  To Wirehouse
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold whitespace-nowrap">
                  Invoice Number
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold whitespace-nowrap">
                  Vehicle
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold whitespace-nowrap">
                  Fare
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold whitespace-nowrap">
                  Total Amount
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold whitespace-nowrap">
                  Batch N.
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold whitespace-nowrap">
                  Note
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold whitespace-nowrap">
                  Total Qantity
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold whitespace-nowrap">
                  Delivery Time
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold whitespace-nowrap">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  colSpan={13}
                  className="px-4 py-12 text-center text-foreground font-semibold"
                >
                  No data available in table
                </td>
              </tr>
              <tr className="border-t border-border">
                <td colSpan={6} className="px-4 py-3"></td>
                <td className="px-4 py-3 text-center font-semibold text-foreground">
                  Total =
                </td>
                <td className="px-4 py-3 text-center font-semibold text-foreground">
                  0
                </td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3 text-center font-semibold text-foreground">
                  0
                </td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3 text-center font-semibold text-foreground">
                  0
                </td>
                <td className="px-4 py-3"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="bg-card border border-border p-4 rounded-lg shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing 0 to 0 of 0 entries
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm text-gray-400 cursor-not-allowed"
            >
              Previous
            </button>
            <button
              disabled
              className="px-3 py-1 text-sm text-gray-400 cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Transfer Entry Modal */}
      <Dialog open={transferEntryOpen} onOpenChange={setTransferEntryOpen}>
        <DialogContent className="!max-w-[95vw] h-auto max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Row 1: Date, Vehicle, Transport Fare */}
              <div className="grid grid-cols-3 gap-8">
                <div>
                  <Label className="text-blue-600 font-semibold">Date :</Label>
                  <Input
                    type="date"
                    className="mt-2 border-red-300"
                    value={transferForm.date}
                    onChange={(e) =>
                      setTransferForm({ ...transferForm, date: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label className="text-blue-600 font-semibold">
                    Vehicle :
                  </Label>
                  <Input
                    type="text"
                    placeholder="Vehicle"
                    className="mt-2 border-red-300"
                    value={transferForm.vehicle}
                    onChange={(e) =>
                      setTransferForm({
                        ...transferForm,
                        vehicle: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label className="text-blue-600 font-semibold">
                    Transport Fare :
                  </Label>
                  <Input
                    type="text"
                    placeholder="Transport Fare"
                    className="mt-2 border-red-300"
                    value={transferForm.transportFare}
                    onChange={(e) =>
                      setTransferForm({
                        ...transferForm,
                        transportFare: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              {/* Row 2: From Warehouse, To Warehouse */}
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <Label className="text-blue-600 font-semibold">
                    From Warehouse :
                  </Label>
                  <Select
                    value={transferForm.fromWarehouse}
                    onValueChange={(value) =>
                      setTransferForm({ ...transferForm, fromWarehouse: value })
                    }
                  >
                    <SelectTrigger className="mt-2 border-red-300">
                      <SelectValue placeholder="=== Select Werehouse ===" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bogura">Bogura Depot</SelectItem>
                      <SelectItem value="dhaka">Dhaka Depot</SelectItem>
                      <SelectItem value="rajshahi">Rajshahi Depot</SelectItem>
                      <SelectItem value="rangpur">Rangpur Depot</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-blue-600 font-semibold">
                    To Warehouse :
                  </Label>
                  <Select
                    value={transferForm.toWarehouse}
                    onValueChange={(value) =>
                      setTransferForm({ ...transferForm, toWarehouse: value })
                    }
                  >
                    <SelectTrigger className="mt-2 border-red-300">
                      <SelectValue placeholder="=== Select Werehouse ===" />
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
                {transferProducts.map((item, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[1fr_1fr_1fr_auto] gap-4 items-end"
                  >
                    <div>
                      <Label className="text-blue-600 font-semibold">
                        Product :
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
                          <SelectItem value="product1">
                            Antab Falon 100ml
                          </SelectItem>
                          <SelectItem value="product2">
                            Antab Falon 500ml
                          </SelectItem>
                          <SelectItem value="product3">
                            Antab Zypsum 10kg
                          </SelectItem>
                          <SelectItem value="product4">
                            Promectin Plus 10SG 100g
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-blue-600 font-semibold">
                        Batch No. :
                      </Label>
                      <Select
                        value={item.batchNo}
                        onValueChange={(value) =>
                          updateProductRow(index, "batchNo", value)
                        }
                        disabled={!transferForm.fromWarehouse}
                      >
                        <SelectTrigger className="mt-2 border-red-300">
                          <SelectValue placeholder="=== Select Werehouse First ===" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="batch1">Batch-001</SelectItem>
                          <SelectItem value="batch2">Batch-002</SelectItem>
                          <SelectItem value="batch3">Batch-003</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-blue-600 font-semibold">
                        Quantity :
                      </Label>
                      <Input
                        type="text"
                        className="mt-2 border-red-300"
                        value={item.quantity}
                        onChange={(e) =>
                          updateProductRow(index, "quantity", e.target.value)
                        }
                      />
                    </div>
                    <div className="flex gap-2 items-end">
                      <Label className="text-blue-600 font-semibold">
                        Action :
                      </Label>
                      <div className="flex gap-2">
                        {index === transferProducts.length - 1 && (
                          <button
                            type="button"
                            onClick={addProductRow}
                            className="p-2 bg-green-600 hover:bg-green-700 text-white rounded"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        )}
                        {transferProducts.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeProductRow(index)}
                            className="p-2 bg-red-500 hover:bg-red-600 text-white rounded"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total Amount */}
              <div className="text-center py-4">
                <p className="text-xl font-semibold text-foreground">
                  Total Amount : {calculateTotalAmount()}
                </p>
              </div>

              {/* Submit Button */}
              <div className="flex justify-center pt-4">
                <Button
                  type="submit"
                  className="bg-blue-500 hover:bg-blue-600 text-white px-8"
                >
                  Submit
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
