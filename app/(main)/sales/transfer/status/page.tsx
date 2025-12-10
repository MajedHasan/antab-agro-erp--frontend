"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ArrowUp, ArrowDown } from "lucide-react";
import Link from "next/link";

interface Transfer {
  id: number;
  date: string;
  fromWirehouse: string;
  toWirehouse: string;
  invoiceNumber: string;
  vehicle: string;
  fare: number;
  totalAmount: number;
  totalQuantity: number;
}

// Mock data
const mockTransfers: Transfer[] = Array.from({ length: 45 }, (_, i) => ({
  id: i + 1,
  date: "2025-09-08",
  fromWirehouse: `Wirehouse ${i + 1}`,
  toWirehouse: `Wirehouse ${i + 2}`,
  invoiceNumber: `INV-${1000 + i}`,
  vehicle: `Vehicle ${i + 1}`,
  fare: Math.floor(Math.random() * 500),
  totalAmount: Math.floor(Math.random() * 1000),
  totalQuantity: Math.floor(Math.random() * 50),
}));

export default function TransferListPage() {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<keyof Transfer>("id");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const itemsPerPage = 10;

  const filteredData = useMemo(() => {
    let data = mockTransfers.filter((t) =>
      Object.values(t).some((v) =>
        String(v).toLowerCase().includes(search.toLowerCase())
      )
    );

    data.sort((a, b) => {
      if (a[sortKey] < b[sortKey]) return sortOrder === "asc" ? -1 : 1;
      if (a[sortKey] > b[sortKey]) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return data;
  }, [search, sortKey, sortOrder]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const currentData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (key: keyof Transfer) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const renderSortArrow = (key: keyof Transfer) => {
    if (sortKey !== key) return null;
    return sortOrder === "asc" ? (
      <ArrowUp className="inline-block ml-1 w-3 h-3" />
    ) : (
      <ArrowDown className="inline-block ml-1 w-3 h-3" />
    );
  };

  const getPageNumbers = () => {
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      pages.push(
        <Button
          key={i}
          variant={i === currentPage ? "default" : "outline"}
          size="sm"
          onClick={() => setCurrentPage(i)}
        >
          {i}
        </Button>
      );
    }
    return pages;
  };

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-2">
        <h2 className="text-2xl font-bold uppercase">Transfer List</h2>
        <Button asChild className="bg-blue-600 hover:bg-blue-700">
          <Link href={"/sales/transfer/create"}>Transfer Entry</Link>
        </Button>
      </div>

      <div className="mb-4">
        <Input
          placeholder="Search..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCurrentPage(1);
          }}
        />
      </div>

      <div className="overflow-x-auto">
        <Table className="min-w-[900px] border border-gray-200">
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer"
                onClick={() => handleSort("id")}
              >
                SI. No {renderSortArrow("id")}
              </TableHead>
              <TableHead
                className="cursor-pointer"
                onClick={() => handleSort("date")}
              >
                Date {renderSortArrow("date")}
              </TableHead>
              <TableHead
                className="cursor-pointer"
                onClick={() => handleSort("fromWirehouse")}
              >
                From Wirehouse {renderSortArrow("fromWirehouse")}
              </TableHead>
              <TableHead
                className="cursor-pointer"
                onClick={() => handleSort("toWirehouse")}
              >
                To Wirehouse {renderSortArrow("toWirehouse")}
              </TableHead>
              <TableHead
                className="cursor-pointer"
                onClick={() => handleSort("invoiceNumber")}
              >
                Invoice Number {renderSortArrow("invoiceNumber")}
              </TableHead>
              <TableHead
                className="cursor-pointer"
                onClick={() => handleSort("vehicle")}
              >
                Vehicle {renderSortArrow("vehicle")}
              </TableHead>
              <TableHead
                className="cursor-pointer"
                onClick={() => handleSort("fare")}
              >
                Fare {renderSortArrow("fare")}
              </TableHead>
              <TableHead
                className="cursor-pointer"
                onClick={() => handleSort("totalAmount")}
              >
                Total Amount {renderSortArrow("totalAmount")}
              </TableHead>
              <TableHead
                className="cursor-pointer"
                onClick={() => handleSort("totalQuantity")}
              >
                Total Quantity {renderSortArrow("totalQuantity")}
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {currentData.length > 0 ? (
              currentData.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.id}</TableCell>
                  <TableCell>{t.date}</TableCell>
                  <TableCell>{t.fromWirehouse}</TableCell>
                  <TableCell>{t.toWirehouse}</TableCell>
                  <TableCell>{t.invoiceNumber}</TableCell>
                  <TableCell>{t.vehicle}</TableCell>
                  <TableCell>{t.fare}</TableCell>
                  <TableCell>{t.totalAmount}</TableCell>
                  <TableCell>{t.totalQuantity}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="text-center">
                  No data available
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col md:flex-row justify-between items-center mt-4 gap-2">
        <div>
          Showing {currentData.length} of {filteredData.length} entries
        </div>
        <div className="flex space-x-1">{getPageNumbers()}</div>
      </div>
    </div>
  );
}
