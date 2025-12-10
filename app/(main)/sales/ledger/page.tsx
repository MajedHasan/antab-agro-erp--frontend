"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

// Mock Data (replace with API later)
const mockSummary = [
  { head: "Total Sales", amount: 0 },
  { head: "Total Discount", amount: 0 },
];
const mockSummary2 = [
  { head: "Total Sales Return", amount: 0 },
  { head: "Total Journal Amount", amount: 0 },
];
const mockSummary3 = [
  { head: "Total Bank Collection", amount: 0 },
  { head: "Total Cash Collection", amount: 0 },
];
const mockLedger = [
  {
    date: "2025-09-08",
    store: "Main Store",
    invNo: "INV001",
    product: "Astrozin 80WDG 25gm",
    umo1: "PCS",
    umo2: "Box",
    price: 100,
    value: 500,
    com: 0,
    goodsRtn: 0,
    debit: 0,
    credit: 0,
    closing: 500,
  },
];

export default function SalesLedgerPage() {
  const [date, setDate] = useState<DateRange | undefined>();
  const [zone, setZone] = useState("");
  const [area, setArea] = useState("");
  const [dealer, setDealer] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [product, setProduct] = useState("");
  const [reportType, setReportType] = useState("1");

  return (
    <div className="container mx-auto px-6 py-6 bg-white rounded-lg shadow">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-lg font-bold uppercase">Sales Ledger Input</h2>
        <div className="border-b border-gray-300 mt-2"></div>
      </div>

      {/* Form */}
      <form className="grid md:grid-cols-3 gap-6">
        {/* Date Range */}
        <div>
          <h5 className="font-semibold mb-2">Select Date Range</h5>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date?.from ? (
                  date.to ? (
                    <>
                      {format(date.from, "dd MMM yyyy")} -{" "}
                      {format(date.to, "dd MMM yyyy")}
                    </>
                  ) : (
                    format(date.from, "dd MMM yyyy")
                  )
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="range"
                selected={date}
                onSelect={setDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Zone */}
        <div>
          <h5 className="font-semibold mb-2">Select Zone</h5>
          <Select onValueChange={setZone}>
            <SelectTrigger>
              <SelectValue placeholder="Select Zone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="28">Rajshahi Region</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Area */}
        <div>
          <h5 className="font-semibold mb-2">Select Area</h5>
          <Select onValueChange={setArea}>
            <SelectTrigger>
              <SelectValue placeholder="Select Area" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">ATGHARIA</SelectItem>
              <SelectItem value="2">ATRAI</SelectItem>
              <SelectItem value="3">BAGATIPARA</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Dealer */}
        <div>
          <h5 className="font-semibold mb-2">Select Dealer</h5>
          <Select onValueChange={setDealer}>
            <SelectTrigger>
              <SelectValue placeholder="Select Dealer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">TanimTraders</SelectItem>
              <SelectItem value="2">Akash Traders</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Warehouse */}
        <div>
          <h5 className="font-semibold mb-2">Select Warehouse</h5>
          <Select onValueChange={setWarehouse}>
            <SelectTrigger>
              <SelectValue placeholder="Select Warehouse" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="37">Bogura Depot</SelectItem>
              <SelectItem value="40">Factory</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Product */}
        <div>
          <h5 className="font-semibold mb-2">Select Product</h5>
          <Select onValueChange={setProduct}>
            <SelectTrigger>
              <SelectValue placeholder="Select Product" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Astrozin 80WDG 25gm</SelectItem>
              <SelectItem value="2">Astrozin 80WDG 50gm</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Report Type */}
        <div>
          <h5 className="font-semibold mb-2">Report Type</h5>
          <Select onValueChange={setReportType} defaultValue="1">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">This Month Dealer</SelectItem>
              <SelectItem value="2">All Dealer</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Button */}
        <div className="flex items-end">
          <Button className="w-full">Generate Report</Button>
        </div>
      </form>

      {/* Report Section */}
      <div className="mt-10 border-2 border-black p-6 rounded-md">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6">
          <div>
            <h4 className="font-bold">Sales Ledger</h4>
            <p className="text-sm font-semibold">
              From {format(new Date(), "dd MMM yyyy")} To{" "}
              {format(new Date(), "dd MMM yyyy")}
            </p>
          </div>
          <div className="text-center">
            <h3 className="uppercase font-bold text-xl">Antab Agro Limited</h3>
            <p className="text-sm">Globe Nibash, Segun Bagicha, Dhaka-1000</p>
          </div>
        </div>

        {/* Summary */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          {[mockSummary, mockSummary2, mockSummary3].map((group, i) => (
            <Card key={i}>
              <CardHeader>
                <CardTitle>Summary {i + 1}</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left">Head</th>
                      <th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.map((row, idx) => (
                      <tr key={idx}>
                        <td>{row.head}</td>
                        <td className="text-right">{row.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          <table className="table-auto w-full border text-xs">
            <thead className="bg-gray-100 text-center">
              <tr>
                <th>Date</th>
                <th>Store/Transaction</th>
                <th>Inv No</th>
                <th>Product</th>
                <th>UMO</th>
                <th>UMO</th>
                <th>Price</th>
                <th>Value</th>
                <th>Com</th>
                <th>Goods Rtn</th>
                <th>Debit</th>
                <th>Credit</th>
                <th>Closing Balance</th>
              </tr>
            </thead>
            <tbody>
              {mockLedger.map((row, idx) => (
                <tr key={idx} className="text-center border-t">
                  <td>{row.date}</td>
                  <td>{row.store}</td>
                  <td>{row.invNo}</td>
                  <td>{row.product}</td>
                  <td>{row.umo1}</td>
                  <td>{row.umo2}</td>
                  <td>{row.price}</td>
                  <td>{row.value}</td>
                  <td>{row.com}</td>
                  <td>{row.goodsRtn}</td>
                  <td>{row.debit}</td>
                  <td>{row.credit}</td>
                  <td>{row.closing}</td>
                </tr>
              ))}
              <tr className="font-bold border-t">
                <td colSpan={7} className="text-right">
                  Grand Total
                </td>
                <td className="text-right">0.00</td>
                <td className="text-right">0.00</td>
                <td className="text-right">0.00</td>
                <td className="text-right">0.00</td>
                <td className="text-right">0.00</td>
                <td className="text-right">0.00</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
