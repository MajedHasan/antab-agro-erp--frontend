// pages/dashboard.js
"use client";

import React, { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { motion } from "framer-motion";

// Sample realistic data
const kpiData = [
  { title: "Total Sales", value: 125000, change: "+12%", icon: "💰" },
  { title: "Expenses", value: 45000, change: "-5%", icon: "📉" },
  { title: "Profit", value: 80000, change: "+20%", icon: "📈" },
  { title: "New Customers", value: 320, change: "+8%", icon: "🧑‍🤝‍🧑" },
];

const salesData = [
  { month: "Jan", Sales: 4000, Expenses: 2400, Profit: 1600 },
  { month: "Feb", Sales: 3000, Expenses: 1398, Profit: 1602 },
  { month: "Mar", Sales: 2000, Expenses: 9800, Profit: -7800 },
  { month: "Apr", Sales: 2780, Expenses: 3908, Profit: -1128 },
  { month: "May", Sales: 1890, Expenses: 4800, Profit: -2910 },
  { month: "Jun", Sales: 2390, Expenses: 3800, Profit: -1410 },
  { month: "Jul", Sales: 3490, Expenses: 4300, Profit: -810 },
];

const topCustomers = [
  { name: "John Doe", totalOrders: 15, totalSpent: "$1200" },
  { name: "Jane Smith", totalOrders: 12, totalSpent: "$900" },
  { name: "David Lee", totalOrders: 10, totalSpent: "$700" },
  { name: "Sarah Khan", totalOrders: 8, totalSpent: "$600" },
];

const lowStockItems = [
  { item: "Product A", stock: 3 },
  { item: "Product B", stock: 5 },
  { item: "Product C", stock: 2 },
  { item: "Product D", stock: 4 },
];

const pieData = [
  { name: "Sales", value: 400 },
  { name: "Expenses", value: 300 },
  { name: "Profit", value: 300 },
];

const pieColors = ["#4f46e5", "#ec4899", "#10b981"];

export default function Dashboard() {
  const [reportPeriod, setReportPeriod] = useState("Monthly");

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">ERP Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {kpiData.map((kpi, idx) => (
          <motion.div
            key={idx}
            whileHover={{ scale: 1.05 }}
            className="bg-white rounded-xl shadow-lg p-5 flex flex-col justify-between border-l-8 border-indigo-500"
          >
            <div className="text-gray-400 text-lg">{kpi.title}</div>
            <div className="text-2xl font-bold mt-2 flex items-center justify-between">
              {kpi.value.toLocaleString()}{" "}
              <span
                className={`ml-2 text-sm ${
                  kpi.change.includes("+") ? "text-green-500" : "text-red-500"
                }`}
              >
                {kpi.change}
              </span>
            </div>
            <div className="text-3xl mt-2">{kpi.icon}</div>
          </motion.div>
        ))}
      </div>

      {/* Report Period Selector */}
      <div className="flex items-center justify-end mb-4 space-x-2">
        {["Weekly", "Monthly", "Yearly"].map((period) => (
          <button
            key={period}
            onClick={() => setReportPeriod(period)}
            className={`px-4 py-2 rounded ${
              reportPeriod === period
                ? "bg-indigo-600 text-white"
                : "bg-white text-gray-800 border"
            }`}
          >
            {period}
          </button>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Line Chart */}
        <div className="bg-white p-5 rounded-xl shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Sales vs Expenses</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="Sales"
                stroke="#4f46e5"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="Expenses"
                stroke="#ec4899"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="Profit"
                stroke="#10b981"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div className="bg-white p-5 rounded-xl shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Overall Distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                outerRadius={100}
                fill="#8884d8"
                label
              >
                {pieData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={pieColors[index % pieColors.length]}
                  />
                ))}
              </Pie>
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tables Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Top Customers */}
        <div className="bg-white p-5 rounded-xl shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Top Customers</h2>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2">Name</th>
                <th className="p-2">Total Orders</th>
                <th className="p-2">Total Spent</th>
              </tr>
            </thead>
            <tbody>
              {topCustomers.map((customer, idx) => (
                <tr key={idx} className="border-b hover:bg-gray-50">
                  <td className="p-2">{customer.name}</td>
                  <td className="p-2">{customer.totalOrders}</td>
                  <td className="p-2">{customer.totalSpent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Low Stock Items */}
        <div className="bg-white p-5 rounded-xl shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Low Stock Items</h2>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2">Item</th>
                <th className="p-2">Stock</th>
              </tr>
            </thead>
            <tbody>
              {lowStockItems.map((item, idx) => (
                <tr key={idx} className="border-b hover:bg-gray-50">
                  <td className="p-2">{item.item}</td>
                  <td className="p-2">{item.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Extra Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="bg-white p-5 rounded-xl shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="flex flex-col space-y-2">
            {[
              "Add Order",
              "Add Customer",
              "Generate Invoice",
              "Add Product",
            ].map((action, idx) => (
              <button
                key={idx}
                className="bg-indigo-600 text-white py-2 rounded hover:bg-indigo-500"
              >
                {action}
              </button>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white p-5 rounded-xl shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
          <ul className="space-y-2">
            {[
              "Order #1023 created",
              "Customer Jane Smith added",
              "Invoice #456 generated",
              "Product B stock updated",
            ].map((act, idx) => (
              <li key={idx} className="bg-gray-50 p-2 rounded">
                {act}
              </li>
            ))}
          </ul>
        </div>

        {/* Tasks */}
        <div className="bg-white p-5 rounded-xl shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Tasks</h2>
          <ul className="space-y-2">
            {[
              "Check Inventory",
              "Follow up with clients",
              "Generate monthly report",
            ].map((task, idx) => (
              <li
                key={idx}
                className="bg-gray-50 p-2 rounded flex justify-between"
              >
                {task}
                <input type="checkbox" className="ml-2" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
