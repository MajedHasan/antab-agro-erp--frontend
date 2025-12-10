"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  FiTrendingUp,
  FiDollarSign,
  FiShoppingCart,
  FiUsers,
  FiBell,
  FiClock,
  FiBox,
  FiBarChart2,
  FiActivity,
} from "react-icons/fi";
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
} from "chart.js";
import { Line, Bar, Pie } from "react-chartjs-2";

ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

const dummySalesData = {
  labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  datasets: [
    {
      label: "Sales",
      data: [1200, 1900, 800, 1400, 2000, 2300, 1700],
      borderColor: "#4f46e5",
      backgroundColor: "rgba(79,70,229,0.2)",
      tension: 0.4,
    },
  ],
};

const productSalesData = {
  labels: ["Electronics", "Clothing", "Food", "Furniture", "Toys"],
  datasets: [
    {
      label: "Revenue",
      data: [5000, 3000, 2000, 1500, 800],
      backgroundColor: ["#4f46e5", "#22c55e", "#facc15", "#f97316", "#ef4444"],
    },
  ],
};

const monthlySalesData = {
  labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"],
  datasets: [
    // ---- Sales datasets ----
    {
      label: "Electronics (Sales)",
      data: [3000, 4000, 3500, 3800, 4200, 4500, 4800],
      backgroundColor: "#4f46e5",
      stack: "Sales",
    },
    {
      label: "Clothing (Sales)",
      data: [2500, 2800, 2600, 3000, 3200, 3500, 3700],
      backgroundColor: "#22c55e",
      stack: "Sales",
    },
    {
      label: "Food (Sales)",
      data: [2000, 2200, 2100, 2300, 2500, 2700, 2800],
      backgroundColor: "#facc15",
      stack: "Sales",
    },
    {
      label: "Furniture (Sales)",
      data: [1500, 1600, 1400, 1700, 1800, 1900, 2000],
      backgroundColor: "#f97316",
      stack: "Sales",
    },
    {
      label: "Toys (Sales)",
      data: [1000, 1400, 1200, 1500, 1600, 1900, 2100],
      backgroundColor: "#ef4444",
      stack: "Sales",
    },

    // ---- Target datasets ----
    {
      label: "Electronics (Target)",
      data: [3200, 3800, 3600, 4000, 4400, 4600, 5000],
      backgroundColor: "rgba(79,70,229,0.5)",
      stack: "Target",
    },
    {
      label: "Clothing (Target)",
      data: [2600, 2900, 2700, 3100, 3300, 3600, 3800],
      backgroundColor: "rgba(34,197,94,0.5)",
      stack: "Target",
    },
    {
      label: "Food (Target)",
      data: [2100, 2300, 2200, 2400, 2600, 2800, 3000],
      backgroundColor: "rgba(250,204,21,0.5)",
      stack: "Target",
    },
    {
      label: "Furniture (Target)",
      data: [1600, 1700, 1500, 1800, 1900, 2000, 2100],
      backgroundColor: "rgba(249,115,22,0.5)",
      stack: "Target",
    },
    {
      label: "Toys (Target)",
      data: [1200, 1500, 1300, 1600, 1700, 2000, 2200],
      backgroundColor: "rgba(239,68,68,0.5)",
      stack: "Target",
    },
  ],
};

// Chart options to enable stacking
const monthlySalesOptions = {
  responsive: true,
  plugins: {
    legend: {
      position: "top",
    },
    title: {
      display: true,
      text: "Monthly Revenue vs Target by Product",
    },
  },
  scales: {
    x: {
      stacked: true,
    },
    y: {
      stacked: true,
    },
  },
};

const regionRevenueData = {
  labels: ["North", "South", "East", "West"],
  datasets: [
    {
      label: "Revenue by Region",
      data: [12000, 9000, 7000, 15000],
      backgroundColor: ["#4f46e5", "#f97316", "#facc15", "#22c55e"],
    },
  ],
};

const topCustomers = [
  { name: "John Doe", amount: "$1200" },
  { name: "Jane Smith", amount: "$950" },
  { name: "Mike Johnson", amount: "$850" },
  { name: "Emily Davis", amount: "$800" },
];

const lowStockProducts = [
  { product: "Laptop", stock: 3 },
  { product: "Chair", stock: 5 },
  { product: "Phone", stock: 2 },
];

const SalesDashboardPage = () => {
  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* Top KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {/* Total Sales */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl p-5 shadow hover:shadow-lg transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-purple-600">
            <FiTrendingUp size={28} />
            <span className="text-lg font-semibold">Total Sales</span>
          </div>
          <p className="mt-4 text-2xl font-bold">$12,450</p>
        </motion.div>

        {/* Revenue */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl p-5 shadow hover:shadow-lg transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-green-600">
            <FiDollarSign size={28} />
            <span className="text-lg font-semibold">Revenue</span>
          </div>
          <p className="mt-4 text-2xl font-bold">$45,780</p>
        </motion.div>

        {/* Orders */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl p-5 shadow hover:shadow-lg transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-blue-600">
            <FiShoppingCart size={28} />
            <span className="text-lg font-semibold">Orders</span>
          </div>
          <p className="mt-4 text-2xl font-bold">345</p>
        </motion.div>

        {/* New Customers */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-xl p-5 shadow hover:shadow-lg transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-yellow-600">
            <FiUsers size={28} />
            <span className="text-lg font-semibold">New Customers</span>
          </div>
          <p className="mt-4 text-2xl font-bold">76</p>
        </motion.div>
      </div>

      {/* Sales Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Weekly Sales */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-xl p-5 shadow"
        >
          <h3 className="text-xl font-semibold mb-4">Weekly Sales</h3>
          <Line data={dummySalesData} />
        </motion.div>

        {/* Revenue by Category */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-xl p-5 shadow"
        >
          <h3 className="text-xl font-semibold mb-4">Revenue by Category</h3>
          <Pie data={productSalesData} />
        </motion.div>
      </div>

      {/* Monthly Sales Chart */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.65 }}
        className="bg-white rounded-xl p-5 shadow mb-6"
      >
        <h3 className="text-xl font-semibold mb-4">Monthly Revenue</h3>
        <Bar data={monthlySalesData} options={monthlySalesOptions} />
      </motion.div>

      {/* Revenue by Region */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="bg-white rounded-xl p-5 shadow mb-6"
      >
        <h3 className="text-xl font-semibold mb-4">Revenue by Region</h3>
        <Bar data={regionRevenueData} />
      </motion.div>

      {/* Recent Orders Table */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.75 }}
        className="bg-white rounded-xl p-5 shadow mb-6 overflow-x-auto"
      >
        <h3 className="text-xl font-semibold mb-4">Recent Orders</h3>
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Order ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Product
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {[
              {
                id: "#001",
                customer: "John Doe",
                product: "Laptop",
                amount: "$1200",
                status: "Completed",
                date: "2025-09-08",
              },
              {
                id: "#002",
                customer: "Jane Smith",
                product: "Chair",
                amount: "$150",
                status: "Pending",
                date: "2025-09-07",
              },
              {
                id: "#003",
                customer: "Mike Johnson",
                product: "Shoes",
                amount: "$80",
                status: "Completed",
                date: "2025-09-06",
              },
              {
                id: "#004",
                customer: "Emily Davis",
                product: "Phone",
                amount: "$800",
                status: "Processing",
                date: "2025-09-05",
              },
            ].map((order) => (
              <tr key={order.id}>
                <td className="px-6 py-4 whitespace-nowrap">{order.id}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {order.customer}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">{order.product}</td>
                <td className="px-6 py-4 whitespace-nowrap">{order.amount}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      order.status === "Completed"
                        ? "bg-green-100 text-green-800"
                        : order.status === "Pending"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {order.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">{order.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>

      {/* Top Customers & Low Stock */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Top Customers */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="bg-white rounded-xl p-5 shadow"
        >
          <h3 className="text-xl font-semibold mb-4">Top Customers</h3>
          <ul>
            {topCustomers.map((customer) => (
              <li
                key={customer.name}
                className="flex justify-between py-2 border-b last:border-b-0"
              >
                <span>{customer.name}</span>
                <span className="font-semibold">{customer.amount}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Low Stock Products */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.85 }}
          className="bg-white rounded-xl p-5 shadow"
        >
          <h3 className="text-xl font-semibold mb-4">Low Stock Products</h3>
          <ul>
            {lowStockProducts.map((item) => (
              <li
                key={item.product}
                className="flex justify-between py-2 border-b last:border-b-0"
              >
                <span>{item.product}</span>
                <span className="text-red-600 font-semibold">
                  {item.stock} left
                </span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-6"
      >
        {[
          {
            title: "Add Sale",
            icon: <FiShoppingCart size={20} />,
            color: "bg-purple-500",
          },
          {
            title: "Generate Invoice",
            icon: <FiDollarSign size={20} />,
            color: "bg-green-500",
          },
          {
            title: "Export Report",
            icon: <FiTrendingUp size={20} />,
            color: "bg-blue-500",
          },
          {
            title: "Check Notifications",
            icon: <FiBell size={20} />,
            color: "bg-yellow-500",
          },
        ].map((action) => (
          <div
            key={action.title}
            className={`flex items-center p-4 rounded-xl shadow cursor-pointer hover:shadow-lg transition ${action.color} text-white`}
          >
            <div className="mr-3">{action.icon}</div>
            <span className="font-semibold">{action.title}</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
};

export default SalesDashboardPage;
