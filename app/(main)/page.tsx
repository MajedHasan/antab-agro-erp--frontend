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
  DollarSign,
  ShoppingCart,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Boxes,
  TrendingUp,
  PiggyBank,
  Users,
  Building2,
} from "lucide-react";

// -----------------------------
// Utils
// -----------------------------
const formatBDT = (n: number) => `৳ ${n.toLocaleString("en-BD")}`;
const deltaColor = (d: number) =>
  d >= 0 ? "text-emerald-600" : "text-rose-600";
const deltaIcon = (d: number) =>
  d >= 0 ? (
    <ArrowUpRight className="w-4 h-4" />
  ) : (
    <ArrowDownRight className="w-4 h-4" />
  );

// -----------------------------
// Mock Data (swap with API)
// Weekly = last 8 weeks, Monthly = last 12 months, Yearly = last 5 years
// -----------------------------
const demo = {
  weekly: [
    {
      label: "W-1",
      sales: 920000,
      collection: 870000,
      purchase: 540000,
      expenses: 280000,
      ar: 56500000,
      ap: 48700000,
    },
    {
      label: "W-2",
      sales: 980000,
      collection: 930000,
      purchase: 560000,
      expenses: 300000,
      ar: 56650000,
      ap: 48550000,
    },
    {
      label: "W-3",
      sales: 1100000,
      collection: 1020000,
      purchase: 610000,
      expenses: 320000,
      ar: 56800000,
      ap: 48250000,
    },
    {
      label: "W-4",
      sales: 1040000,
      collection: 1000000,
      purchase: 620000,
      expenses: 325000,
      ar: 56950000,
      ap: 48000000,
    },
    {
      label: "W-5",
      sales: 1190000,
      collection: 1120000,
      purchase: 690000,
      expenses: 340000,
      ar: 57100000,
      ap: 47900000,
    },
    {
      label: "W-6",
      sales: 1230000,
      collection: 1160000,
      purchase: 710000,
      expenses: 355000,
      ar: 57220000,
      ap: 47650000,
    },
    {
      label: "W-7",
      sales: 1310000,
      collection: 1240000,
      purchase: 760000,
      expenses: 370000,
      ar: 57330000,
      ap: 47400000,
    },
    {
      label: "W-8",
      sales: 1370000,
      collection: 1310000,
      purchase: 800000,
      expenses: 390000,
      ar: 56393061.84,
      ap: 48750484.39,
    },
  ],
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
    {
      label: "Jul 2025",
      sales: 6600000,
      collection: 6500000,
      purchase: 3950000,
      expenses: 1850000,
      ar: 56500000,
      ap: 45200000,
    },
    {
      label: "Aug 2025",
      sales: 7200000,
      collection: 7100000,
      purchase: 4300000,
      expenses: 2000000,
      ar: 56800000,
      ap: 44900000,
    },
    {
      label: "Sep 2025",
      sales: 7450000,
      collection: 7350000,
      purchase: 4500000,
      expenses: 2100000,
      ar: 57100000,
      ap: 44600000,
    },
    {
      label: "Oct 2025",
      sales: 7600000,
      collection: 7500000,
      purchase: 4550000,
      expenses: 2150000,
      ar: 57300000,
      ap: 44400000,
    },
    {
      label: "Nov 2025",
      sales: 7800000,
      collection: 7700000,
      purchase: 4650000,
      expenses: 2200000,
      ar: 57500000,
      ap: 44200000,
    },
    {
      label: "Dec 2025",
      sales: 8200000,
      collection: 8100000,
      purchase: 4900000,
      expenses: 2300000,
      ar: 57700000,
      ap: 44000000,
    },
  ],
  yearly: [
    {
      label: "2021",
      sales: 58000000,
      collection: 56000000,
      purchase: 34000000,
      expenses: 14000000,
      ar: 42000000,
      ap: 30000000,
    },
    {
      label: "2022",
      sales: 62500000,
      collection: 60800000,
      purchase: 36000000,
      expenses: 15500000,
      ar: 43000000,
      ap: 31000000,
    },
    {
      label: "2023",
      sales: 69000000,
      collection: 67000000,
      purchase: 39500000,
      expenses: 17000000,
      ar: 45000000,
      ap: 32000000,
    },
    {
      label: "2024",
      sales: 74000000,
      collection: 72000000,
      purchase: 42000000,
      expenses: 18500000,
      ar: 47000000,
      ap: 33000000,
    },
    {
      label: "2025",
      sales: 82000000,
      collection: 80000000,
      purchase: 47000000,
      expenses: 21000000,
      ar: 49000000,
      ap: 34000000,
    },
  ],
};

// Top customers and branches (mock)
const topCustomers = [
  { name: "Rahman Traders", value: 4200000 },
  { name: "Green Agro", value: 3600000 },
  { name: "Delta Foods", value: 3100000 },
  { name: "City Wholesale", value: 2400000 },
  { name: "Meghna Mart", value: 1900000 },
];

const branches = [
  { name: "Dhaka", sales: 4200000, purchase: 2600000 },
  { name: "Chittagong", sales: 3100000, purchase: 2100000 },
  { name: "Sylhet", sales: 1800000, purchase: 1100000 },
  { name: "Rajshahi", sales: 1500000, purchase: 900000 },
];

// Inventory snapshot (mock)
const inventory = [
  { name: "Raw Materials", amount: 35737175.1 },
  { name: "Finished Goods", amount: 16006153.87 },
  { name: "WIP", amount: 6800000 },
];

// -----------------------------
// Reusable UI fragments
// -----------------------------
function PeriodTabs({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const tabs = ["weekly", "monthly", "yearly"] as const;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`px-3 py-1.5 rounded-xl text-sm capitalize transition-all border ${
            value === t
              ? "bg-cyan-600 text-white border-cyan-600 shadow"
              : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-transparent hover:bg-gray-200 dark:hover:bg-gray-700"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

function KpiCard({
  title,
  value,
  delta,
  icon,
  className = "",
}: {
  title: string;
  value: string;
  delta?: number;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`bg-white dark:bg-gray-900 rounded-2xl shadow-sm p-4 border border-gray-100 dark:border-gray-800 ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800">
          {icon}
        </div>
        <div className="flex-1">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {title}
          </div>
          <div className="mt-1 text-xl font-semibold">{value}</div>
          {typeof delta === "number" && (
            <div
              className={`mt-1 text-xs flex items-center gap-1 ${deltaColor(
                delta
              )}`}
            >
              {deltaIcon(delta)} {Math.abs(delta).toFixed(1)}% vs prev period
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ChartCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold">{title}</h3>
        <div className="flex items-center gap-3">{action}</div>
      </div>
      <div className="w-full" style={{ height: 400 }}>
        {children}
      </div>
    </div>
  );
}

// -----------------------------
// Main Dashboard
// -----------------------------
export default function DashboardPage() {
  const [period, setPeriod] = useState<"weekly" | "monthly" | "yearly">(
    "monthly"
  );

  const series = useMemo(() => demo[period], [period]);

  // Compute KPIs and deltas from the active series
  const last = series[series.length - 1];
  const prev = series[series.length - 2] || last;
  const kpis = {
    revenue: {
      value: last.sales,
      delta: ((last.sales - prev.sales) / prev.sales) * 100,
    },
    collection: {
      value: last.collection,
      delta: ((last.collection - prev.collection) / prev.collection) * 100,
    },
    purchase: {
      value: last.purchase,
      delta: ((last.purchase - prev.purchase) / prev.purchase) * 100,
    },
    expenses: {
      value: last.expenses,
      delta: ((last.expenses - prev.expenses) / prev.expenses) * 100,
    },
  };

  // Derived data
  const cashflow = series.map((d) => ({
    label: d.label,
    inflow: d.collection,
    outflow: d.expenses + d.purchase,
  }));
  const arap = series.map((d) => ({ label: d.label, ar: d.ar, ap: d.ap }));

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="mx-auto max-w-[1500px] space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              ANTAB AGRO LTD ERP Dashboard
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Actionable insights for Sales, Finance, Inventory & Collections
            </p>
          </div>
          <PeriodTabs value={period} onChange={(v) => setPeriod(v as any)} />
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Revenue"
            value={formatBDT(kpis.revenue.value)}
            delta={kpis.revenue.delta}
            icon={<DollarSign className="w-5 h-5" />}
          />
          <KpiCard
            title="Collections"
            value={formatBDT(kpis.collection.value)}
            delta={kpis.collection.delta}
            icon={<CreditCard className="w-5 h-5" />}
          />
          <KpiCard
            title="Purchases"
            value={formatBDT(kpis.purchase.value)}
            delta={kpis.purchase.delta}
            icon={<ShoppingCart className="w-5 h-5" />}
          />
          <KpiCard
            title="Operating Expenses"
            value={formatBDT(kpis.expenses.value)}
            delta={kpis.expenses.delta}
            icon={<PiggyBank className="w-5 h-5" />}
          />
        </div>

        {/* Sales vs Collection & Purchases vs Expenses */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard
            title="Sales vs Collections"
            action={
              <a href="#" className="text-sm text-cyan-600">
                View report
              </a>
            }
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={series}
                margin={{ top: 10, right: 20, left: -10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(v: any) => formatBDT(Number(v))} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="sales"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  dot={false}
                  name="Sales"
                />
                <Line
                  type="monotone"
                  dataKey="collection"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  dot={false}
                  name="Collections"
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Purchases vs Expenses"
            action={
              <a href="#" className="text-sm text-cyan-600">
                View report
              </a>
            }
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={series}
                margin={{ top: 10, right: 20, left: -10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(v: any) => formatBDT(Number(v))} />
                <Legend />
                <Bar
                  dataKey="purchase"
                  stackId="a"
                  fill="#10b981"
                  name="Purchases"
                />
                <Bar
                  dataKey="expenses"
                  stackId="a"
                  fill="#f59e0b"
                  name="Expenses"
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Cashflow Area & AR/AP trend */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard
            title="Cash Flow (Inflow vs Outflow)"
            action={<span className="text-sm text-gray-400">{period}</span>}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={cashflow}
                margin={{ top: 10, right: 20, left: -10, bottom: 10 }}
              >
                <defs>
                  <linearGradient id="inflow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="outflow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(v: any) => formatBDT(Number(v))} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="inflow"
                  stroke="#06b6d4"
                  fill="url(#inflow)"
                  name="Inflow"
                />
                <Area
                  type="monotone"
                  dataKey="outflow"
                  stroke="#f59e0b"
                  fill="url(#outflow)"
                  name="Outflow"
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Receivables vs Payables (Trend)"
            action={<span className="text-sm text-gray-400">{period}</span>}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={arap}
                margin={{ top: 10, right: 20, left: -10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(v: any) => formatBDT(Number(v))} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="ar"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={false}
                  name="A/R"
                />
                <Line
                  type="monotone"
                  dataKey="ap"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={false}
                  name="A/P"
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Inventory & Top Customers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Inventory Valuation (Donut)">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip formatter={(v: any) => formatBDT(Number(v))} />
                <Legend />
                <Pie
                  data={inventory}
                  dataKey="amount"
                  nameKey="name"
                  innerRadius={90}
                  outerRadius={140}
                >
                  {inventory.map((_, i) => (
                    <Cell
                      key={i}
                      fill={["#06b6d4", "#10b981", "#a78bfa"][i % 3]}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Top Customers (Share)">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                innerRadius={20}
                outerRadius={140}
                data={topCustomers}
                startAngle={90}
                endAngle={-270}
              >
                <RadialBar minAngle={10} background clockWise dataKey="value" />
                <Legend
                  iconSize={10}
                  layout="vertical"
                  verticalAlign="middle"
                  align="right"
                />
                <Tooltip formatter={(v: any) => formatBDT(Number(v))} />
              </RadialBarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Branch performance */}
        <ChartCard title="Branch Performance (Sales vs Purchase)">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={branches}
              margin={{ top: 10, right: 20, left: -10, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(v: any) => formatBDT(Number(v))} />
              <Legend />
              <Bar dataKey="sales" fill="#0ea5e9" name="Sales" />
              <Bar dataKey="purchase" fill="#10b981" name="Purchase" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Operational Widgets */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard
            title="Raw Materials Stock"
            value={formatBDT(35737175.1)}
            icon={<Boxes className="w-5 h-5" />}
          />
          <KpiCard
            title="Finished Goods Stock"
            value={formatBDT(16006153.87)}
            icon={<TrendingUp className="w-5 h-5" />}
          />
          <KpiCard
            title="Active Customers"
            value={(1286).toLocaleString()}
            icon={<Users className="w-5 h-5" />}
          />
        </div>

        {/* Helper note */}
        <p className="text-xs text-gray-500 text-center pt-2">
          Sample data shown. Connect your APIs to replace series for real-time
          metrics.
        </p>
      </div>
    </main>
  );
}
