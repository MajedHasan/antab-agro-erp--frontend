"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlusCircle, MinusCircle, ChevronUp, ChevronDown } from "lucide-react";

interface ProductRow {
  productId: string;
  batchNumber: string;
  quantity: string;
}

export default function TransferEntryPage() {
  const [date, setDate] = useState("2025-09-08");
  const [vehicle, setVehicle] = useState("");
  const [transferFare, setTransferFare] = useState("");
  const [fromWarehouse, setFromWarehouse] = useState("");
  const [toWarehouse, setToWarehouse] = useState("");
  const [productRows, setProductRows] = useState<ProductRow[]>([
    { productId: "", batchNumber: "", quantity: "" },
  ]);

  const [sortConfig, setSortConfig] = useState<{
    key: keyof ProductRow;
    direction: "asc" | "desc";
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 5;

  // Mock data
  const warehouses = [
    { id: "37", name: "Bogura Depot" },
    { id: "40", name: "Factory" },
  ];

  const products = [
    { id: "1", name: "Astrozin 80WDG 25gm" },
    { id: "2", name: "Astrozin 80WDG 50gm" },
    { id: "3", name: "Bazigor 40WDG 300gm" },
    { id: "4", name: "Fertimax 20kg" },
    { id: "5", name: "GrowFast Liquid 1L" },
    { id: "6", name: "MicroBoost Powder 500g" },
    // Add more mock products here...
  ];

  const batchNumbers = [
    { id: "b1", name: "Batch 001" },
    { id: "b2", name: "Batch 002" },
    { id: "b3", name: "Batch 003" },
  ];

  // Sorting function
  const sortedRows = useMemo(() => {
    let sortableRows = [...productRows];
    if (sortConfig !== null) {
      sortableRows.sort((a, b) => {
        const aVal = a[sortConfig.key] || "";
        const bVal = b[sortConfig.key] || "";
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return sortableRows;
  }, [productRows, sortConfig]);

  // Pagination
  const totalPages = Math.ceil(sortedRows.length / rowsPerPage);
  const paginatedRows = sortedRows.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const handleAddRow = () => {
    setProductRows([
      ...productRows,
      { productId: "", batchNumber: "", quantity: "" },
    ]);
  };

  const handleRemoveRow = (index: number) => {
    const rows = [...productRows];
    rows.splice(index, 1);
    setProductRows(rows);
  };

  const handleRowChange = (
    index: number,
    key: keyof ProductRow,
    value: string
  ) => {
    const rows = [...productRows];
    rows[index][key] = value;
    setProductRows(rows);
  };

  const requestSort = (key: keyof ProductRow) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig?.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const totalQuantity = productRows.reduce(
    (acc, row) => acc + Number(row.quantity || 0),
    0
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log({
      date,
      vehicle,
      transferFare,
      fromWarehouse,
      toWarehouse,
      productRows,
    });
    alert("Transfer submitted! Check console for data.");
  };

  return (
    <div className="min-h-[85vh] bg-white p-6 md:p-10">
      <form onSubmit={handleSubmit}>
        {/* Top Fields */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="flex flex-col">
            <label>Date:</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col">
            <label>Vehicle:</label>
            <Input
              type="text"
              placeholder="Vehicle"
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
            />
          </div>
          <div className="flex flex-col">
            <label>Transport Fare:</label>
            <Input
              type="text"
              placeholder="Transport Fare"
              value={transferFare}
              onChange={(e) => setTransferFare(e.target.value)}
            />
          </div>
        </div>

        {/* Warehouses */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="flex flex-col">
            <label>From Warehouse:</label>
            <Select value={fromWarehouse} onValueChange={setFromWarehouse}>
              <SelectTrigger>
                <SelectValue placeholder="Select Warehouse" />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((wh) => (
                  <SelectItem key={wh.id} value={wh.id}>
                    {wh.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col">
            <label>To Warehouse:</label>
            <Select value={toWarehouse} onValueChange={setToWarehouse}>
              <SelectTrigger>
                <SelectValue placeholder="Select Warehouse" />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((wh) => (
                  <SelectItem key={wh.id} value={wh.id}>
                    {wh.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Products Table */}
        <div className="overflow-x-auto mb-6">
          <table className="min-w-full border border-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th
                  className="px-4 py-2 cursor-pointer"
                  onClick={() => requestSort("productId")}
                >
                  Product{" "}
                  {sortConfig?.key === "productId" &&
                    (sortConfig.direction === "asc" ? (
                      <ChevronUp className="inline-block w-4 h-4" />
                    ) : (
                      <ChevronDown className="inline-block w-4 h-4" />
                    ))}
                </th>
                <th
                  className="px-4 py-2 cursor-pointer"
                  onClick={() => requestSort("batchNumber")}
                >
                  Batch No{" "}
                  {sortConfig?.key === "batchNumber" &&
                    (sortConfig.direction === "asc" ? (
                      <ChevronUp className="inline-block w-4 h-4" />
                    ) : (
                      <ChevronDown className="inline-block w-4 h-4" />
                    ))}
                </th>
                <th
                  className="px-4 py-2 cursor-pointer"
                  onClick={() => requestSort("quantity")}
                >
                  Quantity{" "}
                  {sortConfig?.key === "quantity" &&
                    (sortConfig.direction === "asc" ? (
                      <ChevronUp className="inline-block w-4 h-4" />
                    ) : (
                      <ChevronDown className="inline-block w-4 h-4" />
                    ))}
                </th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row, index) => (
                <tr key={index} className="border-t border-gray-200">
                  <td className="px-4 py-2">
                    <Select
                      value={row.productId}
                      onValueChange={(value) =>
                        handleRowChange(
                          (currentPage - 1) * rowsPerPage + index,
                          "productId",
                          value
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-2">
                    <Select
                      value={row.batchNumber}
                      onValueChange={(value) =>
                        handleRowChange(
                          (currentPage - 1) * rowsPerPage + index,
                          "batchNumber",
                          value
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Batch" />
                      </SelectTrigger>
                      <SelectContent>
                        {batchNumbers.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-2">
                    <Input
                      type="number"
                      min={0}
                      value={row.quantity}
                      onChange={(e) =>
                        handleRowChange(
                          (currentPage - 1) * rowsPerPage + index,
                          "quantity",
                          e.target.value
                        )
                      }
                    />
                  </td>
                  <td className="px-4 py-2 flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddRow}
                    >
                      <PlusCircle />
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() =>
                        handleRemoveRow((currentPage - 1) * rowsPerPage + index)
                      }
                    >
                      <MinusCircle />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              {Array.from({ length: totalPages }, (_, i) => (
                <Button
                  key={i}
                  variant={i + 1 === currentPage ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(i + 1)}
                >
                  {i + 1}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Total Quantity */}
        <div className="text-center font-bold text-lg mb-6">
          Total Quantity: {totalQuantity}
        </div>

        {/* Submit Button */}
        <div className="text-center">
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
            Submit
          </Button>
        </div>
      </form>
    </div>
  );
}
