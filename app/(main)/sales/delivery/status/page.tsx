"use client";

import React, { useState, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { FiEdit, FiTrash2, FiPrinter } from "react-icons/fi";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

type Sale = {
  id: number;
  user: string;
  dealer: string;
  warehouse: string;
  salesDate: string;
  invoice: string;
  narration: string;
  totalQuantity: number;
  grandTotal: number;
  updatedBy: string;
};

// --- Mock Data ---
const dummySales: Sale[] = [
  {
    id: 1,
    user: "Majed",
    dealer: "A C Traders",
    warehouse: "Factory",
    salesDate: "2025-09-08",
    invoice: "INV001",
    narration: "First sale",
    totalQuantity: 10,
    grandTotal: 500,
    updatedBy: "Admin",
  },
  {
    id: 2,
    user: "Ali",
    dealer: "Abdullah Traders",
    warehouse: "Bogura Depot",
    salesDate: "2025-09-07",
    invoice: "INV002",
    narration: "Second sale",
    totalQuantity: 5,
    grandTotal: 250,
    updatedBy: "Admin",
  },
  {
    id: 3,
    user: "Hassan",
    dealer: "A R Traders",
    warehouse: "Factory",
    salesDate: "2025-09-06",
    invoice: "INV003",
    narration: "Third sale",
    totalQuantity: 12,
    grandTotal: 800,
    updatedBy: "Admin",
  },
  {
    id: 4,
    user: "Rahim",
    dealer: "A C Traders",
    warehouse: "Factory",
    salesDate: "2025-09-05",
    invoice: "INV004",
    narration: "Fourth sale",
    totalQuantity: 8,
    grandTotal: 400,
    updatedBy: "Admin",
  },
  {
    id: 5,
    user: "Salman",
    dealer: "Abdullah Traders",
    warehouse: "Bogura Depot",
    salesDate: "2025-09-04",
    invoice: "INV005",
    narration: "Fifth sale",
    totalQuantity: 15,
    grandTotal: 1000,
    updatedBy: "Admin",
  },
  // Add more mock data as needed
];

// --- API placeholders ---
const api = {
  fetchSales: async () => dummySales,
  deleteSale: async (id: number) => console.log("Delete sale", id),
  updateSale: async (id: number, data: any) =>
    console.log("Update sale", id, data),
  confirmSales: async (ids: number[]) => console.log("Confirm sales", ids),
};

export default function DCPage() {
  const { register, control, watch } = useForm();
  const [salesData, setSalesData] = useState<Sale[]>(dummySales);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const invoiceSearch = watch("invoice", "").toLowerCase();

  // --- Filtered & paginated data ---
  const filteredData = useMemo(() => {
    return salesData.filter((sale) => {
      const invoiceMatch = sale.invoice.toLowerCase().includes(invoiceSearch);
      const startMatch = startDate
        ? new Date(sale.salesDate) >= startDate
        : true;
      const endMatch = endDate ? new Date(sale.salesDate) <= endDate : true;
      return invoiceMatch && startMatch && endMatch;
    });
  }, [salesData, invoiceSearch, startDate, endDate]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // --- Page totals ---
  const totalQuantity = paginatedData.reduce(
    (sum, s) => sum + s.totalQuantity,
    0
  );
  const grandTotal = paginatedData.reduce((sum, s) => sum + s.grandTotal, 0);

  // --- Handlers ---
  const handleDelete = (id: number) => {
    if (!confirm("Are you sure you want to delete this sale?")) return;
    api.deleteSale(id);
    setSalesData(salesData.filter((s) => s.id !== id));
  };

  const handleInvoicePreview = (sale: Sale) => {
    setSelectedSale(sale);
    setModalOpen(true);
  };

  const handleSelectAll = (checked: boolean) => {
    checked
      ? setSelectedIds(filteredData.map((s) => s.id))
      : setSelectedIds([]);
  };

  const handleSelectRow = (id: number, checked: boolean) => {
    checked
      ? setSelectedIds([...selectedIds, id])
      : setSelectedIds(selectedIds.filter((sid) => sid !== id));
  };

  const handleConfirm = () => {
    api.confirmSales(selectedIds);
    alert(`Confirmed sales IDs: ${selectedIds.join(", ")}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6">
      {/* Top Navigation */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Button size="sm" variant="default">
          Delivery Summary Report
        </Button>
        <Button size="sm" variant="default">
          Delivery Summary Details Report
        </Button>
        <Button size="sm" variant="default">
          Delivery Confirmed Report
        </Button>
        <Button size="sm" variant="default">
          UnDelivery Report
        </Button>
      </div>

      {/* Header */}
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold uppercase">ANTAB AGRO LIMITED</h3>
        <p>Globe Nibash, Segun Bagicha, Dhaka-1000</p>
        <h5 className="font-semibold">Sales Delivery Pending List</h5>
      </div>

      {/* Filters */}
      <form className="mb-6 flex flex-wrap gap-4 items-end">
        <Input
          placeholder="Invoice"
          {...register("invoice")}
          className="w-40"
        />
        <Controller
          control={control}
          name="startDate"
          render={({ field }) => (
            <DatePicker
              placeholderText="Start Date"
              selected={startDate}
              onChange={(date) => {
                setStartDate(date);
                field.onChange(date);
              }}
              className="border rounded px-3 py-2 w-40"
            />
          )}
        />
        <Controller
          control={control}
          name="endDate"
          render={({ field }) => (
            <DatePicker
              placeholderText="End Date"
              selected={endDate}
              onChange={(date) => {
                setEndDate(date);
                field.onChange(date);
              }}
              className="border rounded px-3 py-2 w-40"
            />
          )}
        />
        <Select>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Select Store" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Factory">Factory</SelectItem>
            <SelectItem value="Bogura Depot">Bogura Depot</SelectItem>
          </SelectContent>
        </Select>
        <Select>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Select Dealer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="A C Traders">A C Traders</SelectItem>
            <SelectItem value="A R Traders">A R Traders</SelectItem>
            <SelectItem value="Abdullah Traders">Abdullah Traders</SelectItem>
          </SelectContent>
        </Select>
      </form>

      {/* Sales Table */}
      <div className="overflow-x-auto bg-white rounded shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100 text-center">
            <tr>
              <th>Sl</th>
              <th>User</th>
              <th>Dealer</th>
              <th>Warehouse</th>
              <th>Sales Date</th>
              <th>Invoice</th>
              <th>Narration</th>
              <th>Total Qntty</th>
              <th>Grand Total</th>
              <th>Updated By</th>
              <th>Action</th>
              <th>
                <input
                  type="checkbox"
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  checked={selectedIds.length === filteredData.length}
                />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-center">
            {paginatedData.map((sale) => (
              <tr key={sale.id}>
                <td>{sale.id}</td>
                <td>{sale.user}</td>
                <td>{sale.dealer}</td>
                <td>{sale.warehouse}</td>
                <td>{sale.salesDate}</td>
                <td>{sale.invoice}</td>
                <td>{sale.narration}</td>
                <td>{sale.totalQuantity}</td>
                <td>{sale.grandTotal}</td>
                <td>{sale.updatedBy}</td>
                <td className="flex justify-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleInvoicePreview(sale)}
                  >
                    <FiPrinter />
                  </Button>
                  <Button size="sm" variant="outline">
                    <FiEdit />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(sale.id)}
                  >
                    <FiTrash2 />
                  </Button>
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(sale.id)}
                    onChange={(e) => handleSelectRow(sale.id, e.target.checked)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-100 font-bold text-center">
            <tr>
              <td colSpan={7}>Page Totals</td>
              <td>{totalQuantity}</td>
              <td>{grandTotal}</td>
              <td colSpan={3}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-center items-center gap-2 mt-4">
        <Button
          size="sm"
          disabled={currentPage === 1}
          onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
        >
          Prev
        </Button>
        <span>
          Page {currentPage} of {totalPages}
        </span>
        <Button
          size="sm"
          disabled={currentPage === totalPages}
          onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
        >
          Next
        </Button>
      </div>

      {/* Confirm */}
      <div className="flex justify-end mt-4">
        <Button className="bg-green-600" onClick={handleConfirm}>
          Confirm
        </Button>
      </div>

      {/* Invoice Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>Invoice Preview</DialogHeader>
          {selectedSale && (
            <div className="space-y-2 mt-2">
              <p>
                <strong>User:</strong> {selectedSale.user}
              </p>
              <p>
                <strong>Dealer:</strong> {selectedSale.dealer}
              </p>
              <p>
                <strong>Warehouse:</strong> {selectedSale.warehouse}
              </p>
              <p>
                <strong>Invoice:</strong> {selectedSale.invoice}
              </p>
              <p>
                <strong>Sales Date:</strong> {selectedSale.salesDate}
              </p>
              <p>
                <strong>Total Quantity:</strong> {selectedSale.totalQuantity}
              </p>
              <p>
                <strong>Grand Total:</strong> {selectedSale.grandTotal}
              </p>
              <p>
                <strong>Narration:</strong> {selectedSale.narration}
              </p>
              <p>
                <strong>Updated By:</strong> {selectedSale.updatedBy}
              </p>
            </div>
          )}
          <DialogFooter className="flex justify-end gap-2 mt-4">
            <Button onClick={() => setModalOpen(false)}>Close</Button>
            <Button onClick={() => window.print()}>Print</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
