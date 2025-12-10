"use client";

import React, { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  Legend,
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar,
} from "recharts";
import { motion } from "framer-motion";
import {
  Sun,
  Moon,
  Plus,
  FileText,
  ShoppingCart,
  DollarSign,
  Calendar,
  Bell,
  CheckSquare,
  Users,
  Activity,
  Award,
  Box,
  BarChart2,
  Settings,
} from "lucide-react";

/*
  Upgraded ERP Dashboard (client component)
  - Premium colors and consistent palette
  - Quick Actions, Notifications, Recent Activity, Tasks, Leaderboard, Calendar stub
  - Improved KPI cards, % deltas, consistent color usage
  - Multiple charts with cohesive color mapping
  - Accessible, responsive layout

  To use:
  npm i recharts framer-motion lucide-react
  Place this file inside app/dashboard/page.tsx or components/Dashboard.tsx
  Replace mock data with your API responses. Keep field names: label,sales,collection,purchase,expenses,ar,ap
*/

// -------------------------
// Theme helpers (simple client toggle)
// -------------------------
function ThemeToggle({
  mode,
  setMode,
}: {
  mode: "dark" | "light";
  setMode: (m: "dark" | "light") => void;
}) {
  return (
    <button
      onClick={() => setMode(mode === "dark" ? "light" : "dark")}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm"
      aria-label="Toggle theme"
    >
      {mode === "dark" ? (
        <Sun className="w-4 h-4" />
      ) : (
        <Moon className="w-4 h-4" />
      )}
      <span className="hidden sm:inline">
        {mode === "dark" ? "Light" : "Dark"}
      </span>
    </button>
  );
}

// -------------------------
// Palette (semantic color use across the dashboard)
// sales = blue, collection = cyan, purchase = green, expenses = amber, ar = indigo, ap = rose
// -------------------------
const COLORS = {
  sales: "#0ea5e9",
  collection: "#06b6d4",
  purchase: "#10b981",
  expenses: "#f59e0b",
  ar: "#6366f1",
  ap: "#ef4444",
  neutralBg: "bg-white dark:bg-gray-900",
};

// -------------------------
// Mock Data
// -------------------------
const demo = {
  monthly: [
    {
      label: "Jan 2025",
      sales: 6142195,
      collection: 5142195,
      purchase: 3600000,
      expenses: 1800000,
      ar: 54000000,
      ap: 47000000,
    },
    {
      label: "Feb 2025",
      sales: 4300000,
      collection: 4200000,
      purchase: 2600000,
      expenses: 1400000,
      ar: 54500000,
      ap: 46800000,
    },
    {
      label: "Mar 2025",
      sales: 5200000,
      collection: 5100000,
      purchase: 3000000,
      expenses: 1500000,
      ar: 55000000,
      ap: 46600000,
    },
    {
      label: "Apr 2025",
      sales: 4800000,
      collection: 4700000,
      purchase: 2900000,
      expenses: 1600000,
      ar: 55500000,
      ap: 46300000,
    },
    {
      label: "May 2025",
      sales: 6100000,
      collection: 6000000,
      purchase: 3400000,
      expenses: 1700000,
      ar: 56000000,
      ap: 46000000,
    },
    {
      label: "Jun 2025",
      sales: 7000000,
      collection: 6900000,
      purchase: 4100000,
      expenses: 1900000,
      ar: 56300000,
      ap: 45600000,
    },
  ],
};

const topCustomers = [
  { name: "Rahman Traders", value: 4200000 },
  { name: "Green Agro", value: 3600000 },
  { name: "Delta Foods", value: 3100000 },
  { name: "City Wholesale", value: 2400000 },
  { name: "Meghna Mart", value: 1900000 },
];

const recentActivity = [
  {
    id: 1,
    text: "Invoice #INV-1023 paid by Rahman Traders",
    time: "2 hrs ago",
  },
  {
    id: 2,
    text: "Purchase Order #PO-882 created (Raw Materials)",
    time: "5 hrs ago",
  },
  { id: 3, text: "Stock alert: Sugar < reorder level", time: "1 day ago" },
  { id: 4, text: "Payroll for July processed", time: "2 days ago" },
];

const tasks = [
  { id: 1, title: "Approve vendor invoices", due: "Today" },
  { id: 2, title: "Reconcile bank statements", due: "Tomorrow" },
  { id: 3, title: "Follow up: Rahman Traders", due: "This week" },
];

const leaderboard = [
  { name: "A. Rahman", metric: 120, role: "Sales" },
  { name: "S. Karim", metric: 98, role: "Sales" },
  { name: "M. Ahmed", metric: 86, role: "Sales" },
  { name: "R. Khan", metric: 81, role: "Sales" },
  { name: "L. Begum", metric: 78, role: "Sales" },
];

// -------------------------
// Helpers
// -------------------------
const formatBDT = (n: number) => `৳ ${n.toLocaleString("en-BD")}`;
const pct = (cur: number, prev: number) => ((cur - prev) / (prev || 1)) * 100;

// -------------------------
// UI Components
// -------------------------
function QuickActions() {
  return (
    <div className="flex flex-wrap gap-3">
      <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white shadow hover:brightness-95">
        <Plus className="w-4 h-4" /> Create Invoice
      </button>
      <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-600 text-white shadow hover:brightness-95">
        <ShoppingCart className="w-4 h-4" /> New Purchase
      </button>
      <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-600 text-white shadow hover:brightness-95">
        <FileText className="w-4 h-4" /> Add Report
      </button>
      <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-400 text-black shadow hover:brightness-95">
        <Calendar className="w-4 h-4" /> Schedule
      </button>
    </div>
  );
}

function NotificationBell({ items }: { items: number }) {
  return (
    <div className="relative">
      <button className="p-2 rounded-lg bg-white/5">
        <Bell className="w-5 h-5" />
      </button>
      {items > 0 && (
        <div className="absolute -top-1 -right-1 bg-rose-500 text-white rounded-full text-xs w-5 h-5 flex items-center justify-center">
          {items}
        </div>
      )}
    </div>
  );
}

function ActivityFeed() {
  return (
    <div className="space-y-2">
      {recentActivity.map((a) => (
        <div
          key={a.id}
          className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <Activity className="w-5 h-5 text-gray-400" />
          <div className="flex-1">
            <div className="text-sm">{a.text}</div>
            <div className="text-xs text-gray-400">{a.time}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TasksWidget() {
  return (
    <div className="space-y-2">
      {tasks.map((t) => (
        <div
          key={t.id}
          className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <div>
            <div className="text-sm font-medium">{t.title}</div>
            <div className="text-xs text-gray-400">Due: {t.due}</div>
          </div>
          <button className="px-2 py-1 bg-green-50 text-green-700 rounded">
            Mark
          </button>
        </div>
      ))}
    </div>
  );
}

function Leaderboard() {
  return (
    <div className="space-y-2">
      {leaderboard.map((l, idx) => (
        <div
          key={l.name}
          className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white">
              {idx + 1}
            </div>
            <div>
              <div className="text-sm font-medium">{l.name}</div>
              <div className="text-xs text-gray-400">{l.role}</div>
            </div>
          </div>
          <div className="text-sm font-semibold text-cyan-600">{l.metric}</div>
        </div>
      ))}
    </div>
  );
}

function MiniCalendar() {
  // Lightweight calendar stub (replace with full calendar lib if needed)
  const days = Array.from({ length: 30 }, (_, i) => i + 1);
  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((d) => (
        <div
          key={d}
          className="p-2 text-xs text-center rounded hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          {d}
        </div>
      ))}
    </div>
  );
}

// -------------------------
// Chart helper components
// -------------------------
function SalesLine({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        margin={{ top: 10, right: 10, left: -10, bottom: 10 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" />
        <YAxis />
        <Tooltip formatter={(v: any) => formatBDT(Number(v))} />
        <Legend />
        <Line
          type="monotone"
          dataKey="sales"
          stroke={COLORS.sales}
          strokeWidth={2}
          dot={{ r: 3 }}
          name="Sales"
        />
        <Line
          type="monotone"
          dataKey="collection"
          stroke={COLORS.collection}
          strokeWidth={2}
          dot={{ r: 3 }}
          name="Collection"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function PurchaseBar({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{ top: 10, right: 10, left: -10, bottom: 10 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" />
        <YAxis />
        <Tooltip formatter={(v: any) => formatBDT(Number(v))} />
        <Legend />
        <Bar dataKey="purchase" fill={COLORS.purchase} name="Purchases" />
        <Bar dataKey="expenses" fill={COLORS.expenses} name="Expenses" />
      </BarChart>
    </ResponsiveContainer>
  );
}

// -------------------------
// Main Dashboard Component
// -------------------------
export default function DashboardPage() {
  const [mode, setMode] = useState<"dark" | "light">("dark");
  const [period, setPeriod] = useState<"monthly">("monthly");
  const data = useMemo(() => demo[period], [period]);

  // KPIs simple compute
  const latest = data[data.length - 1];
  const prev = data[data.length - 2] || data[data.length - 1];
  const kpis = {
    revenue: { cur: latest.sales, prev: prev.sales },
    collection: { cur: latest.collection, prev: prev.collection },
    purchase: { cur: latest.purchase, prev: prev.purchase },
    expenses: { cur: latest.expenses, prev: prev.expenses },
  };

  return (
    <div className={mode === "dark" ? "dark" : ""}>
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6 transition-colors">
        <div className="mx-auto max-w-[1500px] space-y-6">
          {/* Top header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">ERP Dashboard</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Enterprise overview — Sales, Finance, Inventory & Operations
              </p>
            </div>
            <div className="flex items-center gap-3">
              <QuickActions />
              <div className="h-6" />
              <NotificationBell items={3} />
              <ThemeToggle mode={mode} setMode={setMode} />
              <button className="px-3 py-1.5 rounded-lg bg-white/5">
                {" "}
                <Settings className="w-4 h-4" />{" "}
              </button>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-white dark:bg-gray-900 p-2 rounded-xl shadow-sm">
                <button
                  onClick={() => setPeriod("monthly")}
                  className={`px-3 py-1 rounded ${
                    period === "monthly"
                      ? "bg-indigo-600 text-white"
                      : "text-gray-600 dark:text-gray-200"
                  }`}
                >
                  Monthly
                </button>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Results shown for{" "}
                <strong className="text-gray-700 dark:text-gray-200">
                  {period}
                </strong>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-500">Export:</div>
              <button className="px-3 py-1.5 rounded-lg bg-white/5">CSV</button>
              <button className="px-3 py-1.5 rounded-lg bg-white/5">PDF</button>
            </div>
          </div>

          {/* KPI grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`${COLORS.neutralBg} rounded-2xl shadow p-4 border`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs text-gray-400">Revenue</div>
                  <div className="text-xl font-bold mt-1">
                    {formatBDT(kpis.revenue.cur)}
                  </div>
                  <div className="text-xs mt-1 text-green-600">
                    {pct(kpis.revenue.cur, kpis.revenue.prev).toFixed(1)}% vs
                    prev
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-indigo-50 text-indigo-600">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`${COLORS.neutralBg} rounded-2xl shadow p-4 border`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs text-gray-400">Collections</div>
                  <div className="text-xl font-bold mt-1">
                    {formatBDT(kpis.collection.cur)}
                  </div>
                  <div className="text-xs mt-1 text-green-600">
                    {pct(kpis.collection.cur, kpis.collection.prev).toFixed(1)}%
                    vs prev
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-cyan-50 text-cyan-600">
                  <FileText className="w-5 h-5" />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`${COLORS.neutralBg} rounded-2xl shadow p-4 border`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs text-gray-400">Purchases</div>
                  <div className="text-xl font-bold mt-1">
                    {formatBDT(kpis.purchase.cur)}
                  </div>
                  <div className="text-xs mt-1 text-amber-600">
                    {pct(kpis.purchase.cur, kpis.purchase.prev).toFixed(1)}% vs
                    prev
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-green-50 text-green-600">
                  <ShoppingCart className="w-5 h-5" />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`${COLORS.neutralBg} rounded-2xl shadow p-4 border`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs text-gray-400">Expenses</div>
                  <div className="text-xl font-bold mt-1">
                    {formatBDT(kpis.expenses.cur)}
                  </div>
                  <div className="text-xs mt-1 text-red-600">
                    {pct(kpis.expenses.cur, kpis.expenses.prev).toFixed(1)}% vs
                    prev
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-amber-50 text-amber-600">
                  <Award className="w-5 h-5" />
                </div>
              </div>
            </motion.div>
          </div>

          {/* Charts grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="col-span-2">
              <div
                className={`${COLORS.neutralBg} rounded-2xl p-4 shadow border`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-semibold">
                    Sales & Collections
                  </h3>
                  <div className="text-sm text-gray-400">
                    Compare month-by-month
                  </div>
                </div>
                <div style={{ height: 360 }}>
                  <SalesLine data={data} />
                </div>
              </div>
            </div>

            <div>
              <div
                className={`${COLORS.neutralBg} rounded-2xl p-4 shadow border`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-semibold">Top Customers</h3>
                  <div className="text-sm text-gray-400">Share</div>
                </div>
                <div style={{ height: 360 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart
                      innerRadius={20}
                      outerRadius={120}
                      data={topCustomers}
                      startAngle={90}
                      endAngle={-270}
                    >
                      <RadialBar minAngle={15} background dataKey="value" />
                      <Legend
                        iconSize={10}
                        layout="vertical"
                        verticalAlign="middle"
                        align="right"
                      />
                      <Tooltip formatter={(v: any) => formatBDT(Number(v))} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* Activity / Tasks / Calendar */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div
              className={`${COLORS.neutralBg} rounded-2xl p-4 shadow border`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold">Recent Activity</h3>
                <div className="text-sm text-gray-400">Feed</div>
              </div>
              <ActivityFeed />
            </div>

            <div
              className={`${COLORS.neutralBg} rounded-2xl p-4 shadow border`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold">Tasks</h3>
                <div className="text-sm text-gray-400">Your to-dos</div>
              </div>
              <TasksWidget />
            </div>

            <div
              className={`${COLORS.neutralBg} rounded-2xl p-4 shadow border`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold">Calendar</h3>
                <div className="text-sm text-gray-400">This month</div>
              </div>
              <MiniCalendar />
            </div>
          </div>

          {/* Leaderboard & Branch performance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div
              className={`${COLORS.neutralBg} rounded-2xl p-4 shadow border`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold">Top Performers</h3>
                <div className="text-sm text-gray-400">This month</div>
              </div>
              <Leaderboard />
            </div>

            <div
              className={`${COLORS.neutralBg} rounded-2xl p-4 shadow border`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold">Branch Performance</h3>
                <div className="text-sm text-gray-400">Compare</div>
              </div>
              <div style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: "Dhaka", sales: 4200000, purchase: 2600000 },
                      { name: "CTG", sales: 3100000, purchase: 2100000 },
                      { name: "Sylhet", sales: 1800000, purchase: 1100000 },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(v: any) => formatBDT(Number(v))} />
                    <Legend />
                    <Bar dataKey="sales" fill={COLORS.sales} name="Sales" />
                    <Bar
                      dataKey="purchase"
                      fill={COLORS.purchase}
                      name="Purchase"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="h-8" />
        </div>
      </main>
    </div>
  );
}
