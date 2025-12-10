"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Search,
  X,
  FileText,
  Eye,
  Edit,
  Trash2,
  ChevronUp,
  ChevronDown,
  CalendarIcon,
  Printer,
  Plus,
} from "lucide-react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { useRouter } from "next/navigation";
import { SearchableSelect } from "@/components/common/searchable-select";

const generateOrderData = () => {
  const baseData = [
    {
      sl: 1,
      user: "04-10-2025 06:16 pm\n(Admin)",
      vendorName: "Mithun Varieties Store",
      mobile: "01723249512",
      area: "Rangpur",
      warehouse: "Bogura Depot",
      orderDate: "30-09-2025",
      invoice: "Sal-3602",
      totalQty: 240,
      grandTotal: 62584.0,
      status: "Confirmed",
    },
    {
      sl: 2,
      user: "04-10-2025 06:12 pm\n(Admin)",
      vendorName: "M/s Mousumi Traders",
      mobile: "01784937931",
      area: "BIRGONJ",
      warehouse: "Bogura Depot",
      orderDate: "30-09-2025",
      invoice: "Sal-3601",
      totalQty: 206,
      grandTotal: 79080.0,
      status: "Confirmed",
    },
    {
      sl: 7,
      user: "04-10-2025 05:59 pm\n(Admin)",
      vendorName: "Hossain Traders",
      mobile: "01713762484",
      area: "Potnitola",
      warehouse: "Bogura Depot",
      orderDate: "30-09-2025",
      invoice: "Sal-3596",
      totalQty: 18,
      grandTotal: 6588.0,
      status: "Confirmed",
    },
    {
      sl: 8,
      user: "04-10-2025 05:56 pm\n(Admin)",
      vendorName: "M/S Siddik Traders",
      mobile: "01758497657",
      area: "Badalgachi",
      warehouse: "Bogura Depot",
      orderDate: "30-09-2025",
      invoice: "Sal-3595",
      totalQty: 48,
      grandTotal: 6576.0,
      status: "Confirmed",
    },
    {
      sl: 9,
      user: "04-10-2025 05:54 pm\n(Admin)",
      vendorName: "Bhai Bhai Krishi Sheha",
      mobile: "01761061900",
      area: "Potnitola",
      warehouse: "Bogura Depot",
      orderDate: "30-09-2025",
      invoice: "Sal-3594",
      totalQty: 108,
      grandTotal: 58716.0,
      status: "Confirmed",
    },
    {
      sl: 10,
      user: "04-10-2025 05:50 pm\n(Admin)",
      vendorName: "M/S Sajal Traders",
      mobile: "01722446612",
      area: "THAKURGAON",
      warehouse: "Bogura Depot",
      orderDate: "30-09-2025",
      invoice: "Sal-3593",
      totalQty: 282,
      grandTotal: 124434.0,
      status: "Confirmed",
    },
  ];

  // Generate more data for pagination
  const allData = [];
  for (let i = 0; i < 335; i++) {
    const baseIndex = i % baseData.length;
    allData.push({
      ...baseData[baseIndex],
      sl: i + 1,
      invoice: `Sal-${3602 - i}`,
    });
  }
  return allData;
};

const orderData = generateOrderData();

const dealers = [
  { value: "mithun-varieties", label: "Mithun Varieties Store" },
  { value: "mousumi-traders", label: "M/s Mousumi Traders" },
  { value: "hossain-traders", label: "Hossain Traders" },
  { value: "siddik-traders", label: "M/S Siddik Traders" },
  { value: "bhai-bhai", label: "Bhai Bhai Krishi Sheha" },
  { value: "sajal-traders", label: "M/S Sajal Traders" },
];

const warehouses = [
  { value: "bogura-depot", label: "Bogura Depot" },
  { value: "dhaka-depot", label: "Dhaka Depot" },
  { value: "chittagong-depot", label: "Chittagong Depot" },
  { value: "rajshahi-depot", label: "Rajshahi Depot" },
];

const orderTypes = [
  { value: "regular", label: "Regular Order" },
  { value: "urgent", label: "Urgent Order" },
  { value: "wholesale", label: "Wholesale Order" },
];

const products = [
  { id: "1", name: "Astrozin 80WDG 10gm", price: 79.0 },
  { id: "2", name: "Astrozin 80WDG 25gm", price: 189.0 },
  { id: "3", name: "Astrozin 80WDG 50gm", price: 357.0 },
  { id: "4", name: "Astrozin 80WDG 100gm", price: 693.0 },
];

type SortField = keyof (typeof orderData)[0];
type SortDirection = "asc" | "desc";

export default function OrderListPage() {
  const router = useRouter();

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(2025, 9, 5),
    to: new Date(2025, 9, 5),
  });
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<
    (typeof orderData)[0] | null
  >(null);
  const [orderCreateOpen, setOrderCreateOpen] = useState(false);
  const [invoiceViewOpen, setInvoiceViewOpen] = useState(false);

  const [orderDate, setOrderDate] = useState<Date>(new Date());
  const [orderType, setOrderType] = useState("");
  const [selectedDealer, setSelectedDealer] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [orderItems, setOrderItems] = useState<
    Array<{
      id: string;
      stock: string;
      price: string;
      quantity: string;
      total: string;
    }>
  >([{ id: "1", stock: "", price: "", quantity: "", total: "" }]);

  const filteredAndSortedData = useMemo(() => {
    let filtered = orderData;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (order) =>
          order.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.mobile.includes(searchTerm) ||
          order.area.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.invoice.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply sorting
    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = a[sortField];
        const bValue = b[sortField];

        if (typeof aValue === "number" && typeof bValue === "number") {
          return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
        }

        const aStr = String(aValue).toLowerCase();
        const bStr = String(bValue).toLowerCase();
        return sortDirection === "asc"
          ? aStr.localeCompare(bStr)
          : bStr.localeCompare(aStr);
      });
    }

    return filtered;
  }, [orderData, searchTerm, sortField, sortDirection]);

  const totalEntries = filteredAndSortedData.length;
  const totalPages = Math.ceil(totalEntries / entriesPerPage);
  const startEntry = (currentPage - 1) * entriesPerPage + 1;
  const endEntry = Math.min(currentPage * entriesPerPage, totalEntries);
  const currentPageData = filteredAndSortedData.slice(startEntry - 1, endEntry);

  const pageTotals = useMemo(() => {
    return currentPageData.reduce(
      (acc, order) => ({
        totalQty: acc.totalQty + order.totalQty,
        grandTotal: acc.grandTotal + order.grandTotal,
      }),
      { totalQty: 0, grandTotal: 0 }
    );
  }, [currentPageData]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleCopy = () => {
    const text = currentPageData
      .map(
        (order) =>
          `${order.sl}\t${order.user}\t${order.vendorName}\t${order.mobile}\t${order.area}\t${order.warehouse}\t${order.orderDate}\t${order.invoice}\t${order.totalQty}\t${order.grandTotal}\t${order.status}`
      )
      .join("\n");
    navigator.clipboard.writeText(text);
    alert("Data copied to clipboard!");
  };

  const handleCSV = () => {
    const headers =
      "Sl,User,Vendor Name,Mobile,Area,Warehouse,Order Date,Invoice,Total Qty,Grand Total,Status\n";
    const csv =
      headers +
      currentPageData
        .map(
          (order) =>
            `${order.sl},"${order.user}","${order.vendorName}",${order.mobile},${order.area},${order.warehouse},${order.orderDate},${order.invoice},${order.totalQty},${order.grandTotal},${order.status}`
        )
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "orders.csv";
    a.click();
  };

  const handleExcel = () => {
    // For simplicity, we'll export as CSV which Excel can open
    handleCSV();
  };

  const handlePDF = () => {
    window.print();
  };

  const handlePrint = () => {
    window.print();
  };

  const handleClear = () => {
    setDateRange(undefined);
    setSearchTerm("");
    setCurrentPage(1);
  };

  const addOrderItem = () => {
    setOrderItems([
      ...orderItems,
      {
        id: Date.now().toString(),
        stock: "",
        price: "",
        quantity: "",
        total: "",
      },
    ]);
  };

  const removeOrderItem = (id: string) => {
    if (orderItems.length > 1) {
      setOrderItems(orderItems.filter((item) => item.id !== id));
    }
  };

  const updateOrderItem = (id: string, field: string, value: string) => {
    setOrderItems(
      orderItems.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          // Auto-calculate total
          if (field === "price" || field === "quantity") {
            const price =
              Number.parseFloat(field === "price" ? value : item.price) || 0;
            const quantity =
              Number.parseFloat(field === "quantity" ? value : item.quantity) ||
              0;
            updated.total = (price * quantity).toFixed(2);
          }
          return updated;
        }
        return item;
      })
    );
  };

  const calculateOrderTotals = () => {
    const totalQty = orderItems.reduce(
      (sum, item) => sum + (Number.parseFloat(item.quantity) || 0),
      0
    );
    const payable = orderItems.reduce(
      (sum, item) => sum + (Number.parseFloat(item.total) || 0),
      0
    );
    return { totalQty, payable };
  };

  const handleView = (order: (typeof orderData)[0]) => {
    setSelectedOrder(order);
    setInvoiceViewOpen(true);
  };

  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 4) {
        pages.push(1, 2, 3, 4, 5, "...", totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(
          1,
          "...",
          totalPages - 4,
          totalPages - 3,
          totalPages - 2,
          totalPages - 1,
          totalPages
        );
      } else {
        pages.push(
          1,
          "...",
          currentPage - 1,
          currentPage,
          currentPage + 1,
          "...",
          totalPages
        );
      }
    }
    return pages;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-start mb-6">
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-center mb-2">
              ANTAB AGRO LIMITED
            </h1>
            <p className="text-center text-gray-600">
              Globe Nibash, Segun Bagicha, Dhaka-1000
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => router.push("/documents-reports")}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Documents Reports
            </Button>
            <Button
              onClick={() => setOrderCreateOpen(true)}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Order Create
            </Button>
            <Button
              onClick={() => router.push("/delete-log")}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete Log
            </Button>
          </div>
        </div>

        <h2 className="text-2xl font-semibold text-center mb-6">Order List</h2>

        <div className="flex items-center gap-4 mb-6">
          <label className="text-gray-700 font-medium whitespace-nowrap">
            Date
          </label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="max-w-md justify-start text-left font-normal border-2 border-red-400 focus:border-red-500 bg-transparent"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "yyyy-MM-dd")} -{" "}
                      {format(dateRange.to, "yyyy-MM-dd")}
                    </>
                  ) : (
                    format(dateRange.from, "yyyy-MM-dd")
                  )
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
          <Button
            onClick={() => setCurrentPage(1)}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Search className="w-4 h-4 mr-2" />
            Search
          </Button>
          <Button
            onClick={handleClear}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            <X className="w-4 h-4 mr-2" />
            Clear
          </Button>
        </div>
      </div>

      {/* Table Controls */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-blue-600">Show</span>
            <Select
              value={entriesPerPage.toString()}
              onValueChange={(value) => {
                setEntriesPerPage(Number(value));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-blue-600">entries</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">Search:</span>
            <Input
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-64 border-2 border-blue-400 focus:border-blue-500"
              placeholder="Search orders..."
            />
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <Button
            onClick={handleCopy}
            variant="secondary"
            className="bg-gray-600 text-white hover:bg-gray-700"
          >
            Copy
          </Button>
          <Button
            onClick={handleCSV}
            variant="secondary"
            className="bg-gray-600 text-white hover:bg-gray-700"
          >
            CSV
          </Button>
          <Button
            onClick={handleExcel}
            variant="secondary"
            className="bg-gray-600 text-white hover:bg-gray-700"
          >
            Excel
          </Button>
          <Button
            onClick={handlePDF}
            variant="secondary"
            className="bg-gray-600 text-white hover:bg-gray-700"
          >
            PDF
          </Button>
          <Button
            onClick={handlePrint}
            variant="secondary"
            className="bg-gray-600 text-white hover:bg-gray-700"
          >
            Print
          </Button>
          <Button
            variant="secondary"
            className="bg-gray-600 text-white hover:bg-gray-700"
          >
            Column visibility
          </Button>
        </div>

        <div className="overflow-x-auto border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow className="bg-orange-500 hover:bg-orange-500">
                <TableHead
                  onClick={() => handleSort("sl")}
                  className="text-white font-semibold text-center border-r border-orange-400 cursor-pointer"
                >
                  Sl{" "}
                  {sortField === "sl" &&
                    (sortDirection === "asc" ? (
                      <ChevronUp className="inline w-3 h-3" />
                    ) : (
                      <ChevronDown className="inline w-3 h-3" />
                    ))}
                </TableHead>
                <TableHead
                  onClick={() => handleSort("user")}
                  className="text-white font-semibold text-center border-r border-orange-400 cursor-pointer"
                >
                  User{" "}
                  {sortField === "user" &&
                    (sortDirection === "asc" ? (
                      <ChevronUp className="inline w-3 h-3" />
                    ) : (
                      <ChevronDown className="inline w-3 h-3" />
                    ))}
                </TableHead>
                <TableHead
                  onClick={() => handleSort("vendorName")}
                  className="text-white font-semibold text-center border-r border-orange-400 cursor-pointer"
                >
                  Vendor Name{" "}
                  {sortField === "vendorName" &&
                    (sortDirection === "asc" ? (
                      <ChevronUp className="inline w-3 h-3" />
                    ) : (
                      <ChevronDown className="inline w-3 h-3" />
                    ))}
                </TableHead>
                <TableHead
                  onClick={() => handleSort("mobile")}
                  className="text-white font-semibold text-center border-r border-orange-400 cursor-pointer"
                >
                  Mobile{" "}
                  {sortField === "mobile" &&
                    (sortDirection === "asc" ? (
                      <ChevronUp className="inline w-3 h-3" />
                    ) : (
                      <ChevronDown className="inline w-3 h-3" />
                    ))}
                </TableHead>
                <TableHead
                  onClick={() => handleSort("area")}
                  className="text-white font-semibold text-center border-r border-orange-400 cursor-pointer"
                >
                  Area{" "}
                  {sortField === "area" &&
                    (sortDirection === "asc" ? (
                      <ChevronUp className="inline w-3 h-3" />
                    ) : (
                      <ChevronDown className="inline w-3 h-3" />
                    ))}
                </TableHead>
                <TableHead
                  onClick={() => handleSort("warehouse")}
                  className="text-white font-semibold text-center border-r border-orange-400 cursor-pointer"
                >
                  Wirehouse{" "}
                  {sortField === "warehouse" &&
                    (sortDirection === "asc" ? (
                      <ChevronUp className="inline w-3 h-3" />
                    ) : (
                      <ChevronDown className="inline w-3 h-3" />
                    ))}
                </TableHead>
                <TableHead
                  onClick={() => handleSort("orderDate")}
                  className="text-white font-semibold text-center border-r border-orange-400 cursor-pointer"
                >
                  Order Date{" "}
                  {sortField === "orderDate" &&
                    (sortDirection === "asc" ? (
                      <ChevronUp className="inline w-3 h-3" />
                    ) : (
                      <ChevronDown className="inline w-3 h-3" />
                    ))}
                </TableHead>
                <TableHead
                  onClick={() => handleSort("invoice")}
                  className="text-white font-semibold text-center border-r border-orange-400 cursor-pointer"
                >
                  Invoice{" "}
                  {sortField === "invoice" &&
                    (sortDirection === "asc" ? (
                      <ChevronUp className="inline w-3 h-3" />
                    ) : (
                      <ChevronDown className="inline w-3 h-3" />
                    ))}
                </TableHead>
                <TableHead
                  onClick={() => handleSort("totalQty")}
                  className="text-white font-semibold text-center border-r border-orange-400 cursor-pointer"
                >
                  Total Qnty{" "}
                  {sortField === "totalQty" &&
                    (sortDirection === "asc" ? (
                      <ChevronUp className="inline w-3 h-3" />
                    ) : (
                      <ChevronDown className="inline w-3 h-3" />
                    ))}
                </TableHead>
                <TableHead
                  onClick={() => handleSort("grandTotal")}
                  className="text-white font-semibold text-center border-r border-orange-400 cursor-pointer"
                >
                  Grand Total{" "}
                  {sortField === "grandTotal" &&
                    (sortDirection === "asc" ? (
                      <ChevronUp className="inline w-3 h-3" />
                    ) : (
                      <ChevronDown className="inline w-3 h-3" />
                    ))}
                </TableHead>
                <TableHead
                  onClick={() => handleSort("status")}
                  className="text-white font-semibold text-center border-r border-orange-400 cursor-pointer"
                >
                  Order Status{" "}
                  {sortField === "status" &&
                    (sortDirection === "asc" ? (
                      <ChevronUp className="inline w-3 h-3" />
                    ) : (
                      <ChevronDown className="inline w-3 h-3" />
                    ))}
                </TableHead>
                <TableHead className="text-white font-semibold text-center">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentPageData.map((order, index) => (
                <TableRow key={index} className="hover:bg-gray-50">
                  <TableCell className="text-center border-r">
                    {order.sl}
                  </TableCell>
                  <TableCell className="border-r whitespace-pre-line text-sm">
                    {order.user}
                  </TableCell>
                  <TableCell className="border-r font-medium">
                    {order.vendorName}
                  </TableCell>
                  <TableCell className="text-center border-r">
                    {order.mobile}
                  </TableCell>
                  <TableCell className="text-center border-r">
                    {order.area}
                  </TableCell>
                  <TableCell className="text-center border-r">
                    {order.warehouse}
                  </TableCell>
                  <TableCell className="text-center border-r">
                    {order.orderDate}
                  </TableCell>
                  <TableCell className="text-center border-r text-red-600 font-semibold">
                    {order.invoice}
                  </TableCell>
                  <TableCell className="text-center border-r">
                    {order.totalQty}
                  </TableCell>
                  <TableCell className="text-right border-r font-semibold">
                    {order.grandTotal.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell className="text-center border-r">
                    <span className="text-blue-600 font-semibold">
                      {order.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center gap-1">
                      <Button
                        size="sm"
                        onClick={() => handleView(order)}
                        className="bg-blue-500 hover:bg-blue-600 text-white h-8 w-8 p-0"
                        title="View Details"
                      >
                        <FileText className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleView(order)}
                        className="bg-blue-500 hover:bg-blue-600 text-white h-8 w-8 p-0"
                        title="View"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => router.push(`/order/edit/${order.sl}`)}
                        className="bg-green-500 hover:bg-green-600 text-white h-8 w-8 p-0"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          if (
                            confirm(
                              `Are you sure you want to delete order ${order.invoice}?`
                            )
                          ) {
                            alert(
                              "Delete functionality would be implemented here"
                            );
                          }
                        }}
                        className="bg-red-500 hover:bg-red-600 text-white h-8 w-8 p-0"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {/* Totals Row */}
              <TableRow className="bg-teal-700 hover:bg-teal-700">
                <TableCell
                  colSpan={6}
                  className="text-white font-bold border-r"
                >
                  Total:
                </TableCell>
                <TableCell className="text-white font-bold text-center border-r"></TableCell>
                <TableCell className="text-white font-bold text-center border-r"></TableCell>
                <TableCell className="text-white font-bold text-center border-r">
                  {pageTotals.totalQty}
                </TableCell>
                <TableCell className="text-white font-bold text-right border-r">
                  {pageTotals.grandTotal.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </TableCell>
                <TableCell colSpan={2}></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-between items-center mt-4">
          <div className="text-sm text-gray-600">
            Showing {startEntry} to {endEntry} of{" "}
            {totalEntries.toLocaleString()} entries
          </div>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              Previous
            </Button>
            {getPageNumbers().map((page, index) =>
              page === "..." ? (
                <Button
                  key={`ellipsis-${index}`}
                  variant="outline"
                  size="sm"
                  disabled
                >
                  ...
                </Button>
              ) : (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  className={
                    currentPage === page
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : ""
                  }
                  onClick={() => setCurrentPage(page as number)}
                >
                  {page}
                </Button>
              )
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        {/* <DialogTitle>View Order</DialogTitle> */}
        <DialogContent className="!max-w-2xl">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
            <DialogDescription>
              Complete information for the selected order
            </DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-600">Order ID</p>
                <p className="text-base">{selectedOrder.sl}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">Invoice</p>
                <p className="text-base text-red-600 font-semibold">
                  {selectedOrder.invoice}
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">
                  Vendor Name
                </p>
                <p className="text-base">{selectedOrder.vendorName}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">Mobile</p>
                <p className="text-base">{selectedOrder.mobile}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">Area</p>
                <p className="text-base">{selectedOrder.area}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">Warehouse</p>
                <p className="text-base">{selectedOrder.warehouse}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">
                  Order Date
                </p>
                <p className="text-base">{selectedOrder.orderDate}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">Status</p>
                <p className="text-base text-blue-600 font-semibold">
                  {selectedOrder.status}
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">
                  Total Quantity
                </p>
                <p className="text-base">{selectedOrder.totalQty}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">
                  Grand Total
                </p>
                <p className="text-base font-semibold">
                  {selectedOrder.grandTotal.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-sm font-semibold text-gray-600">
                  Created By
                </p>
                <p className="text-base whitespace-pre-line">
                  {selectedOrder.user}
                </p>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <Button
              onClick={() => window.print()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            <Button onClick={() => setViewDialogOpen(false)} variant="outline">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={orderCreateOpen} onOpenChange={setOrderCreateOpen}>
        {/* <DialogTitle>Order Create</DialogTitle> */}
        <DialogContent className="!max-w-none !w-[95vw] max-h-[90vh] overflow-y-auto">
          <div className="bg-white p-8">
            <h2 className="text-3xl font-bold text-center mb-8">
              Order Create
            </h2>

            <div className="grid grid-cols-3 gap-6 mb-8">
              {/* Date Field */}
              <div>
                <label className="text-blue-600 font-semibold mb-2 block">
                  Date :
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal border-2 border-red-300 hover:border-red-400 bg-transparent"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {orderDate ? (
                        format(orderDate, "MM/dd/yyyy")
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={orderDate}
                      onSelect={(date) => date && setOrderDate(date)}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Vendor Name Field */}
              <div>
                <label className="text-blue-600 font-semibold mb-2 block">
                  Vendor Name :
                </label>
                <SearchableSelect
                  options={dealers}
                  value={selectedDealer}
                  onValueChange={setSelectedDealer}
                  placeholder="--Select Dealer--"
                  searchPlaceholder="Search dealer..."
                  emptyText="No dealer found."
                />
              </div>

              {/* Invoice Number */}
              <div className="flex items-end">
                <div className="text-right w-full">
                  <span className="text-sm">Invoice No: </span>
                  <span className="font-bold text-lg">Sal-3603</span>
                </div>
              </div>

              {/* Type Field */}
              <div>
                <label className="text-blue-600 font-semibold mb-2 block">
                  Type :
                </label>
                <Select value={orderType} onValueChange={setOrderType}>
                  <SelectTrigger className="border-2 border-red-300 hover:border-red-400">
                    <SelectValue placeholder="Select One Must *" />
                  </SelectTrigger>
                  <SelectContent>
                    {orderTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Branch/Warehouse Field */}
              <div>
                <label className="text-blue-600 font-semibold mb-2 block">
                  Branch/Warehouse :
                </label>
                <SearchableSelect
                  options={warehouses}
                  value={selectedWarehouse}
                  onValueChange={setSelectedWarehouse}
                  placeholder="Select Warehouse"
                  searchPlaceholder="Search warehouse..."
                  emptyText="No warehouse found."
                />
              </div>
            </div>

            {/* Product Entry Section */}
            <div className="mb-6">
              <div className="grid grid-cols-[2fr,1.5fr,1.5fr,1.5fr,auto] gap-4 mb-4">
                <div>
                  <label className="text-blue-600 font-semibold mb-2 block">
                    Stock :
                  </label>
                </div>
                <div>
                  <label className="text-blue-600 font-semibold mb-2 block">
                    Price :
                  </label>
                </div>
                <div>
                  <label className="text-blue-600 font-semibold mb-2 block">
                    Quantity :
                  </label>
                </div>
                <div>
                  <label className="text-blue-600 font-semibold mb-2 block">
                    Total :
                  </label>
                </div>
                <div>
                  <label className="text-blue-600 font-semibold mb-2 block">
                    Action :
                  </label>
                </div>
              </div>

              {orderItems.map((item, index) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[2fr,1.5fr,1.5fr,1.5fr,auto] gap-4 mb-3"
                >
                  <Input
                    value={item.stock}
                    onChange={(e) =>
                      updateOrderItem(item.id, "stock", e.target.value)
                    }
                    className="border-2 border-red-300 focus:border-red-400"
                    placeholder="Select product"
                  />
                  <Input
                    value={item.price}
                    onChange={(e) =>
                      updateOrderItem(item.id, "price", e.target.value)
                    }
                    className="border-2 border-red-300 focus:border-red-400"
                    placeholder="Price"
                    type="number"
                  />
                  <Input
                    value={item.quantity}
                    onChange={(e) =>
                      updateOrderItem(item.id, "quantity", e.target.value)
                    }
                    className="border-2 border-red-300 focus:border-red-400"
                    placeholder="Quantity"
                    type="number"
                  />
                  <Input
                    value={item.total}
                    readOnly
                    className="border-2 border-red-300 bg-gray-50"
                    placeholder="Total"
                  />
                  <div className="flex gap-2">
                    {index === orderItems.length - 1 && (
                      <Button
                        onClick={addOrderItem}
                        className="bg-green-600 hover:bg-green-700 text-white h-10 w-10 p-0"
                        title="Add Product"
                      >
                        <Plus className="w-5 h-5" />
                      </Button>
                    )}
                    {orderItems.length > 1 && (
                      <Button
                        onClick={() => removeOrderItem(item.id)}
                        className="bg-red-600 hover:bg-red-700 text-white h-10 w-10 p-0"
                        title="Remove Product"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Totals Section */}
            <div className="flex justify-end mb-6">
              <div className="w-80 space-y-3">
                <div className="flex items-center border-2 border-gray-300 rounded px-4 py-2">
                  <span className="font-semibold mr-auto">Total Qty :</span>
                  <span>{calculateOrderTotals().totalQty}</span>
                </div>
                <div className="flex items-center border-2 border-gray-300 rounded px-4 py-2">
                  <span className="font-semibold mr-auto">Payable :</span>
                  <span>{calculateOrderTotals().payable.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Order Confirm Button */}
            <div className="flex justify-center">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white px-16 py-6 text-lg">
                Order Confirm
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={invoiceViewOpen} onOpenChange={setInvoiceViewOpen}>
        {/* <DialogTitle></DialogTitle> */}
        <DialogContent className="!max-w-none !w-[95vw] max-h-[95vh] overflow-y-auto">
          {selectedOrder && (
            <div className="bg-white p-8">
              {/* Header */}
              <div className="text-center mb-6">
                <h1 className="text-3xl font-bold mb-1">ANTAB AGRO LIMITED</h1>
                <p className="text-sm text-gray-600">
                  Globe Nibash, Segun Bagicha, Dhaka-1000
                </p>
              </div>

              <h2 className="text-2xl font-bold text-center mb-8">
                INVOICE VIEW
              </h2>

              {/* Invoice Details */}
              <div className="grid grid-cols-2 gap-8 mb-6">
                {/* Left Column */}
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="font-semibold">Invoice Date :</span>{" "}
                    30-09-2025
                  </p>
                  <p>
                    <span className="font-semibold">Dealer :</span>{" "}
                    {selectedOrder.vendorName}
                  </p>
                  <p>
                    <span className="font-semibold">Mobile Number :</span>{" "}
                    {selectedOrder.mobile}
                  </p>
                  <p>
                    <span className="font-semibold">Address :</span> Bottola
                    Bazar, Pirgacha
                  </p>
                  <p>
                    <span className="font-semibold">Warehouse :</span>{" "}
                    {selectedOrder.warehouse}
                  </p>
                  <p>
                    <span className="font-semibold">Transport Cost :</span>
                  </p>
                  <p>
                    <span className="font-semibold">Current Time:</span> 11:36
                    pm
                  </p>
                  <p>
                    <span className="font-semibold">Current Date:</span>{" "}
                    05-10-2025
                  </p>
                </div>

                {/* Right Column */}
                <div className="space-y-2 text-sm text-right">
                  <p>
                    <span className="font-semibold">Opening Balance :</span>{" "}
                    0.00
                  </p>
                  <p>
                    <span className="font-semibold">
                      Current Invoice Value :
                    </span>{" "}
                    {selectedOrder.grandTotal.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                  <p>
                    <span className="font-semibold">Current Balance :</span>{" "}
                    {selectedOrder.grandTotal.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                  <p>
                    <span className="font-semibold">Last Payment Amount :</span>
                  </p>
                  <p>
                    <span className="font-semibold">Last Payment Date :</span>
                  </p>
                  <div className="mt-4">
                    <p className="font-bold text-lg mb-2">
                      Invoice : {selectedOrder.invoice}
                    </p>
                    {/* Barcode placeholder */}
                    <div className="flex justify-end">
                      <svg
                        width="200"
                        height="60"
                        className="border border-gray-300"
                      >
                        <rect width="3" height="60" x="10" fill="black" />
                        <rect width="2" height="60" x="15" fill="black" />
                        <rect width="4" height="60" x="19" fill="black" />
                        <rect width="2" height="60" x="25" fill="black" />
                        <rect width="3" height="60" x="29" fill="black" />
                        <rect width="2" height="60" x="34" fill="black" />
                        <rect width="4" height="60" x="38" fill="black" />
                        <rect width="2" height="60" x="44" fill="black" />
                        <rect width="3" height="60" x="48" fill="black" />
                        <rect width="2" height="60" x="53" fill="black" />
                        <rect width="4" height="60" x="57" fill="black" />
                        <rect width="2" height="60" x="63" fill="black" />
                        <rect width="3" height="60" x="67" fill="black" />
                        <rect width="2" height="60" x="72" fill="black" />
                        <rect width="4" height="60" x="76" fill="black" />
                        <rect width="2" height="60" x="82" fill="black" />
                        <rect width="3" height="60" x="86" fill="black" />
                        <rect width="2" height="60" x="91" fill="black" />
                        <rect width="4" height="60" x="95" fill="black" />
                        <rect width="2" height="60" x="101" fill="black" />
                        <rect width="3" height="60" x="105" fill="black" />
                        <rect width="2" height="60" x="110" fill="black" />
                        <rect width="4" height="60" x="114" fill="black" />
                        <rect width="2" height="60" x="120" fill="black" />
                        <rect width="3" height="60" x="124" fill="black" />
                        <rect width="2" height="60" x="129" fill="black" />
                        <rect width="4" height="60" x="133" fill="black" />
                        <rect width="2" height="60" x="139" fill="black" />
                        <rect width="3" height="60" x="143" fill="black" />
                        <rect width="2" height="60" x="148" fill="black" />
                        <rect width="4" height="60" x="152" fill="black" />
                        <rect width="2" height="60" x="158" fill="black" />
                        <rect width="3" height="60" x="162" fill="black" />
                        <rect width="2" height="60" x="167" fill="black" />
                        <rect width="4" height="60" x="171" fill="black" />
                        <rect width="2" height="60" x="177" fill="black" />
                        <rect width="3" height="60" x="181" fill="black" />
                      </svg>
                    </div>
                  </div>
                  <p className="mt-4">
                    <span className="font-semibold">Create By:</span> Admin
                  </p>
                </div>
              </div>

              {/* Products Table */}
              <div className="border rounded-lg overflow-hidden mb-6">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-orange-500 hover:bg-orange-500">
                      <TableHead className="text-white font-semibold text-center border-r border-orange-400">
                        #
                      </TableHead>
                      <TableHead className="text-white font-semibold text-center border-r border-orange-400">
                        Product Name
                      </TableHead>
                      <TableHead className="text-white font-semibold text-center border-r border-orange-400">
                        Price
                      </TableHead>
                      <TableHead className="text-white font-semibold text-center border-r border-orange-400">
                        Quantity
                      </TableHead>
                      <TableHead className="text-white font-semibold text-center border-r border-orange-400">
                        Bonus
                      </TableHead>
                      <TableHead className="text-white font-semibold text-center border-r border-orange-400">
                        Commission
                      </TableHead>
                      <TableHead className="text-white font-semibold text-center border-r border-orange-400">
                        Comm Value
                      </TableHead>
                      <TableHead className="text-white font-semibold text-center border-r border-orange-400">
                        Total Value
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="text-center border-r">1</TableCell>
                      <TableCell className="border-r">
                        Astrozin 80WDG 10gm
                      </TableCell>
                      <TableCell className="text-center border-r">
                        79.00
                      </TableCell>
                      <TableCell className="text-center border-r">
                        1000 Gm
                      </TableCell>
                      <TableCell className="text-center border-r">
                        100.00 Pcs
                      </TableCell>
                      <TableCell className="text-center border-r">20</TableCell>
                      <TableCell className="text-center border-r"></TableCell>
                      <TableCell className="text-right">7,900.00</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-center border-r">2</TableCell>
                      <TableCell className="border-r">
                        Astrozin 80WDG 25gm
                      </TableCell>
                      <TableCell className="text-center border-r">
                        189.00
                      </TableCell>
                      <TableCell className="text-center border-r">
                        1300 Gm
                      </TableCell>
                      <TableCell className="text-center border-r">
                        52.00 Pcs
                      </TableCell>
                      <TableCell className="text-center border-r">10</TableCell>
                      <TableCell className="text-center border-r"></TableCell>
                      <TableCell className="text-right">9,828.00</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-center border-r">3</TableCell>
                      <TableCell className="border-r">
                        Astrozin 80WDG 50gm
                      </TableCell>
                      <TableCell className="text-center border-r">
                        357.00
                      </TableCell>
                      <TableCell className="text-center border-r">
                        2400 Gm
                      </TableCell>
                      <TableCell className="text-center border-r">
                        48.00 Pcs
                      </TableCell>
                      <TableCell className="text-center border-r">9</TableCell>
                      <TableCell className="text-center border-r"></TableCell>
                      <TableCell className="text-right">17,136.00</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-center border-r">4</TableCell>
                      <TableCell className="border-r">
                        Astrozin 80WDG 100gm
                      </TableCell>
                      <TableCell className="text-center border-r">
                        693.00
                      </TableCell>
                      <TableCell className="text-center border-r">
                        4000 Gm
                      </TableCell>
                      <TableCell className="text-center border-r">
                        40.00 Pcs
                      </TableCell>
                      <TableCell className="text-center border-r">8</TableCell>
                      <TableCell className="text-center border-r"></TableCell>
                      <TableCell className="text-right">27,720.00</TableCell>
                    </TableRow>
                    {/* Summary Rows */}
                    <TableRow className="bg-gray-50">
                      <TableCell
                        colSpan={7}
                        className="text-right font-semibold border-r"
                      >
                        Total Value
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {selectedOrder.grandTotal.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </TableCell>
                    </TableRow>
                    <TableRow className="bg-gray-50">
                      <TableCell
                        colSpan={7}
                        className="text-right font-semibold border-r"
                      >
                        Commission
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        0.00
                      </TableCell>
                    </TableRow>
                    <TableRow className="bg-gray-50">
                      <TableCell
                        colSpan={7}
                        className="text-right font-semibold border-r"
                      >
                        Payable
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {selectedOrder.grandTotal.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Amount in Words */}
              <div className="mb-8 p-3 border rounded">
                <p className="text-sm">
                  <span className="font-semibold">Total Amount In Words:</span>{" "}
                  Sixty-Two Thousand Five Hundred Eighty-Four Taka Only
                </p>
              </div>

              {/* Signature Section */}
              <div className="grid grid-cols-4 gap-8 pt-8 border-t">
                <div className="text-center">
                  <div className="h-16 border-b-2 border-gray-300 mb-2"></div>
                  <p className="font-semibold">Delivered By</p>
                </div>
                <div className="text-center">
                  <div className="h-16 border-b-2 border-gray-300 mb-2"></div>
                  <p className="font-semibold">Checked By</p>
                </div>
                <div className="text-center">
                  <div className="h-16 border-b-2 border-gray-300 mb-2"></div>
                  <p className="font-semibold">Received By</p>
                </div>
                <div className="text-center">
                  <div className="h-16 border-b-2 border-gray-300 mb-2"></div>
                  <p className="font-semibold">Autorise By</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 mt-6">
                <Button
                  onClick={() => window.print()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Print Invoice
                </Button>
                <Button
                  onClick={() => setInvoiceViewOpen(false)}
                  variant="outline"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
