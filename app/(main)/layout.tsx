"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/context/LanguageContext";

import { AnimatePresence, motion } from "framer-motion";

import {
  Bars3Icon,
  XMarkIcon,
  ChevronDownIcon,
  UserCircleIcon,
  BellIcon,
  MagnifyingGlassIcon,
  SunIcon,
  MoonIcon,
  Cog6ToothIcon,
  HomeIcon,
} from "@heroicons/react/24/outline";

import {
  ShoppingCartIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";

import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { logoutUser, User } from "@/store/slices/userSlice";
// import { Toaster, toast } from "react-hot-toast";
import { toast } from "sonner";
import { canAccess } from "@/utils/rbac"; // or wherever you placed it
import usePermissionCheck from "@/hooks/usePermissionCheck";
import { FoldersIcon } from "lucide-react";

/**
 * Real-world ERP layout:
 * - recursive Framer Motion accordion sidebar (multi-level)
 * - mini (icon-only) sidebar mode with tooltips
 * - responsive slide-over for mobile
 * - header with search (⌘/Ctrl+K), notifications dropdown, theme toggle, user menu
 * - footer with version/links
 *
 * Notes:
 * - Keep your existing contexts (useAuth, useTranslation).
 * - Tailwind must support dark mode via `class` strategy (documentElement.classList).
 */

// ----------------------------
// Menu types and sample data
// ----------------------------
type MenuItem = {
  key: string;
  href?: string;
  icon?: React.ReactNode;
  submenu?: MenuItem[];
  badge?: number; // numeric badge
  permissions?: string | string[];
};

const menuItems: MenuItem[] = [
  {
    key: "dashboard",
    href: "/",
    icon: <HomeIcon className="w-5 h-5" />,
    permissions: ["dashboard.view"],
  },
  {
    key: "inventory",
    icon: <ShoppingCartIcon className="w-5 h-5" />,
    badge: 3,
    submenu: [
      { key: "Supplier", href: "/inventory/supplier" },
      { key: "Work Order", href: "/inventory/workorder" },
      { key: "G.R.N", href: "/inventory/good-receipt" },
      {
        key: "Products in Factory",
        // href: "/inventory/products-in-factory",
        submenu: [
          { key: "Raw Materials", href: "/inventory/raw-materials" },
          { key: "Packing Materials", href: "/inventory/packing-materials" },
          { key: "Finished Goods", href: "/inventory/products-in-factory" },
        ],
      },

      { key: "BOM", href: "/inventory/bom" },
      { key: "Production", href: "/inventory/production" },
      { key: "WIP", href: "/inventory/wip" },
    ],
  },
  {
    key: "Sales Orders",
    icon: <ChartBarIcon className="w-5 h-5" />,
    badge: 5,
    submenu: [
      {
        key: "Dashboard",
        href: "/sales",
        permissions: ["salesdashboard.view"],
      },
      {
        key: "Sales",
        permissions: ["sales.create"],
        submenu: [
          {
            key: "Sales Entry",
            href: "/sales/create",
            permissions: ["sales.create"],
          },
          {
            key: "Sales List",
            href: "/sales/list",
            permissions: ["sales.view", "sales.edit"],
          },
          {
            key: "Sales Invoice",
            href: "/sales/invoice",
            permissions: ["sales.view", "sales.edit"],
          },
          { key: "D.C", href: "/sales/delivery/status" },
        ],
      },

      { key: "T.C (Transfer)", href: "/sales/transfer/status" },
      { key: "Sales Ledger", href: "/sales/ledger" },
      { key: "Order & List", href: "/sales/order/list" },
      {
        key: "Dealer",
        // href: "/sales/dealer",
        permissions: [
          "dealer.view",
          "dealer.create",
          "dealer.edit",
          "dealer.delete",
        ],
        submenu: [
          {
            key: "List",
            href: "/sales/dealer",
            permissions: [
              "dealer.view",
              "dealer.create",
              "dealer.edit",
              "dealer.delete",
            ],
          },
          {
            key: "Zone",
            href: "/sales/dealer/zones",
            permissions: [
              "zone.view",
              "zone.create",
              "zone.edit",
              "zone.delete",
            ],
          },
          {
            key: "Region",
            href: "/sales/dealer/regions",
            permissions: [
              "region.view",
              "region.create",
              "region.edit",
              "region.delete",
            ],
          },
          {
            key: "Area",
            href: "/sales/dealer/areas",
            permissions: [
              "area.view",
              "area.create",
              "area.edit",
              "area.delete",
            ],
          },
          {
            key: "Territory",
            href: "/sales/dealer/territories",
            permissions: [
              "territory.view",
              "territory.create",
              "territory.edit",
              "territory.delete",
            ],
          },
          {
            key: "Warehouse Or Factory",
            href: "/sales/dealer/warehouseOrFactory",
            permissions: [
              "warehouse.view",
              "warehouse.create",
              "warehouse.edit",
              "warehouse.delete",
            ],
          },
        ],
      },
      { key: "Products", href: "/sales/products" },
      { key: "Products Promotion", href: "/sales/product-promotion" },
      { key: "Special Offers", href: "/sales/special-offers" },
      { key: "Damages", href: "/sales/damage" },
      { key: "Return", href: "/sales/return" },
      { key: "Incentive", href: "/sales/incentive" },
      { key: "F.G Stocks", href: "/sales/production/stock" },
      {
        key: "reports",
        submenu: [
          {
            key: "Sales & Collections",
            href: "/sales/reports/sales-collections",
          },
        ],
      },
    ],
  },
  {
    key: "accounts",
    icon: <CurrencyDollarIcon className="w-5 h-5" />,
    badge: 2,
    submenu: [
      {
        key: "Chart Of Accounts",
        href: "/accounts/chart-of-accounts",
        // submenu: [
        //   // {
        //   //   key: "Receive Voucher",
        //   //   href: "",
        //   //   submenu: [
        //   //     { key: "Bank Receive", href: "" },
        //   //     { key: "Cash Receive", href: "" },
        //   //   ],
        //   // },
        //   { key: "View", href: "/accounts/chart-of-accounts/view" },
        //   { key: "Create Individual Accounts", href: "" },
        //   { key: "Sub Individual Accounts", href: "" },
        // ],
      },
      {
        key: "Vouchers",
        href: "/accounts/vouchers",
        submenu: [
          { key: "Voucher Admin", href: "/accounts/vouchers/admin" },
          {
            key: "Receive Voucher",
            href: "",
            submenu: [
              { key: "Bank Receive", href: "/accounts/vouchers/receive/bank" },
              { key: "Cash Receive", href: "/accounts/vouchers/receive/cash" },
            ],
          },
          {
            key: "Payment Voucher",
            href: "",
            submenu: [
              { key: "Bank Payment", href: "/accounts/vouchers/payment/bank" },
              { key: "Cash Payment", href: "/accounts/vouchers/payment/cash" },
            ],
          },
          { key: "Journal Voucher", href: "/accounts/vouchers/journal" },
          { key: "Contra Voucher", href: "/accounts/vouchers/contra" },
        ],
      },
      {
        key: "Reports",
        href: "/accounts/reports",
        submenu: [
          // {
          //   key: "Receive Voucher",
          //   href: "",
          //   submenu: [
          //     { key: "Bank Receive", href: "" },
          //     { key: "Cash Receive", href: "" },
          //   ],
          // },
          {
            key: "Financial Reports",
            href: "",
            submenu: [
              {
                key: "Financial Notes",
                href: "/accounts/reports/financial/financial-notes",
              },
              {
                key: "Statement Of Financial Position",
                href: "/accounts/reports/financial/financial-position",
              },
              {
                key: "Statement Of Profit or Loss & Other Comprehensive Income",
                href: "/accounts/reports/financial/profit-loss",
              },
              {
                key: "Statement Of Changes in Equity",
                href: "/accounts/reports/financial/changes-equity",
              },
            ],
          },
          {
            key: "Individual Account / Ledger",
            href: "/accounts/reports/ledger",
          },
          { key: "Trial Balance", href: "/accounts/reports/trial-balance" },
          { key: "Other Reports", href: "" },
        ],
      },
    ],
  },
  {
    key: "hrPayroll",
    icon: <UserGroupIcon className="w-5 h-5" />,
    submenu: [
      { key: "employees", href: "/hr/employees" },
      { key: "payroll", href: "/hr/payroll" },
      { key: "attendance", href: "/hr/attendance" },
    ],
  },
  {
    key: "Administration",
    icon: <UserGroupIcon className="w-5 h-5" />,
    submenu: [
      {
        key: "Users",
        href: "/admin/users",
        permissions: ["users.view"],
      },
      {
        key: "Assign Location",
        href: "/admin/users/location",
        permissions: ["userslocation.view"],
      },
      {
        key: "Assign Warehouse",
        href: "/admin/users/warehouse",
        permissions: ["userswarehouse.view"],
      },
      { key: "Roles", href: "/admin/roles" },
      { key: "Departments", href: "/admin/departments" },
      { key: "Permissions", href: "/admin/permissions" },
    ],
  },
  {
    key: "Media",
    icon: <FoldersIcon className="w-5 h-5" />,
    submenu: [
      {
        key: "List",
        href: "/media",
        permissions: ["media.view"],
      },
    ],
  },
];

// -------------------------
// Utils
// -------------------------
function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

const motionVariants = {
  collapse: { height: 0, opacity: 0 },
  expand: { height: "auto", opacity: 1 },
  fadeIn: { opacity: 1, y: 0 },
  fadeOut: { opacity: 0, y: -6 },
};

// -------------------------
// Recursive RBAC menu filter
// -------------------------

function filterMenuByRBAC(item: MenuItem, user: User | null): MenuItem | null {
  const isSuperAdmin = user?.role?.isSystem;

  // If submenu exists, evaluate children first
  if (item.submenu) {
    const allowedChildren = item.submenu
      .map((child) => filterMenuByRBAC(child, user))
      .filter(Boolean) as MenuItem[];

    // If no submenus allowed → hide entire parent
    if (allowedChildren.length === 0) return null;

    // Return parent with allowed children
    return { ...item, submenu: allowedChildren };
  }

  // If NO permissions on leaf → super admin only
  if (!item.permissions) {
    return isSuperAdmin ? item : null;
  }

  // If permissions exist on leaf → check them
  return canAccess(user, { permissions: item.permissions, match: "any" })
    ? item
    : null;
}

// -------------------------
// Recursive Sidebar item with Framer Motion accordion
// -------------------------
function SidebarItem({
  item,
  pathname,
  level = 0,
  collapsed,
  onNavigate,
  t,
}: {
  item: MenuItem;
  pathname: string;
  level?: number;
  collapsed: boolean;
  onNavigate: () => void;
  t: (k: string) => string;
}) {
  const hasSub = !!item.submenu?.length;
  const active = item.href ? pathname === item.href : false;
  const [open, setOpen] = useState(false);

  // expand if any child matches path
  useEffect(() => {
    if (hasSub) {
      const anyMatch = item.submenu!.some((s) => {
        if (s.href && pathname === s.href) return true;
        if (s.submenu) {
          return s.submenu.some((c) => pathname === c.href);
        }
        return false;
      });
      if (anyMatch) setOpen(true);
    }
  }, [pathname, item, hasSub]);

  // indentation padding
  const indent = Math.min(level * 8, 24);

  return (
    <li>
      <div
        className={classNames(
          "flex items-center justify-between rounded-md px-2 py-2 select-none",
          active
            ? "bg-gradient-to-r from-indigo-50 to-white dark:from-indigo-900/30"
            : "hover:bg-gray-50 dark:hover:bg-gray-700/40",
          active ? "ring-1 ring-[#3aa838] dark:ring-[#97c560]" : "",
        )}
        style={{ paddingLeft: indent + 8 }}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Link
            href={item.href || "#"}
            onClick={(e) => {
              if (hasSub) e.preventDefault();
              else onNavigate();
            }}
            className="flex items-center gap-3 flex-1 min-w-0"
            title={collapsed ? t(item.key) : undefined}
          >
            <span className={classNames("shrink-0 text-[#3aa838]")}>
              {item.icon}
            </span>

            {/* label hidden in collapsed mini mode */}
            <span
              className={classNames(
                "text-sm truncate",
                collapsed ? "hidden" : "block",
              )}
            >
              {t(item.key)}
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {item.badge && item.badge > 0 && (
            <span
              className={classNames(
                "inline-flex items-center justify-center w-4 h-4 text-[10px] font-semibold rounded-full",
                collapsed ? "hidden" : "inline-flex",
                "bg-red-500 text-white",
              )}
            >
              {item.badge}
            </span>
          )}

          {hasSub && (
            <button
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="p-1 rounded hover:bg-indigo-50 dark:hover:bg-gray-700/40"
              title={collapsed ? (open ? "Collapse" : "Expand") : undefined}
            >
              <motion.span
                initial={false}
                animate={{ rotate: open ? 180 : 0 }}
                transition={{ type: "spring", stiffness: 320, damping: 28 }}
                className="inline-block"
              >
                <ChevronDownIcon className="w-4 h-4 text-[#16351d] dark:text-[#97c560]" />
              </motion.span>
            </button>
          )}
        </div>
      </div>

      {/* Submenu (recursive) */}
      <AnimatePresence initial={false}>
        {hasSub && open && (
          <motion.ul
            initial="collapse"
            animate="expand"
            exit="collapse"
            variants={motionVariants}
            transition={{ duration: 0.25 }}
            className="ml-2 mt-1 space-y-1"
          >
            {item.submenu!.map((sub) => (
              <SidebarItem
                key={sub.key}
                item={sub}
                pathname={pathname}
                level={level + 1}
                collapsed={collapsed}
                onNavigate={onNavigate}
                t={t}
              />
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </li>
  );
}

// -------------------------
// Layout Component
// -------------------------
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // UI states
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false); // mini mode
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const dispatch = useDispatch();

  // contexts
  const { error, success, currentUser, ...user } = useSelector(
    (state: RootState) => state.user,
  );
  const { t } = useTranslation();
  const pathname = usePathname();

  const filteredMenu = menuItems
    .map((m) => filterMenuByRBAC(m, currentUser))
    .filter(Boolean) as MenuItem[];

  // theme (system-aware + persistence)
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const saved = localStorage.getItem("erp_theme_dark");
      if (saved != null) return saved === "true";
      // detect system
      return (
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      );
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("erp_theme_dark", String(dark));
      if (dark) document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
    } catch {}
  }, [dark]);

  // persist sidebar collapsed
  useEffect(() => {
    try {
      const s = localStorage.getItem("erp_sidebar_collapsed");
      if (s != null) setCollapsed(s === "true");
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("erp_sidebar_collapsed", String(collapsed));
    } catch {}
  }, [collapsed]);

  // keyboard: Ctrl/Cmd + K to focus search
  const searchRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        setMobileOpen(false);
        setUserMenuOpen(false);
        setNotifOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // click outside handlers for dropdowns
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const notifRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      )
        setUserMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node))
        setNotifOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // sample notifications (in real app fetch from API)
  const [notifications, setNotifications] = useState([
    { id: "1", title: "New order #OD-1024", time: "2m", unread: true },
    { id: "2", title: "Stock low: Rice (SKU-112)", time: "1h", unread: true },
    { id: "3", title: "Payroll processed", time: "1d", unread: false },
  ] as { id: string; title: string; time: string; unread: boolean }[]);

  const unreadCount = notifications.filter((n) => n.unread).length;

  // small helper when navigation happens (close mobile slide)
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // sidebar width animation via framer (desktop)
  const sidebarWidth = collapsed ? 72 : 288; // px for inline style

  useEffect(() => {
    console.log(error, success);

    toast.info(success);
  }, [error, success]);

  const hasAccess = usePermissionCheck(); // call once

  return (
    <div className="h-screen flex bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Mobile backdrop */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar (desktop + mobile slide) */}
      <motion.aside
        layout
        initial={false}
        animate={{ width: sidebarWidth }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
        className={classNames(
          "z-50 fixed inset-y-0 left-0 transform bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-4 overflow-y-auto",
          "md:static md:translate-x-0",
        )}
        style={{ boxSizing: "border-box" }}
        aria-label="Primary navigation"
      >
        <div className="flex items-center justify-between mb-6 sticky top-0 bg-white">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-[#3aa838] to-[#16351d] text-white font-extrabold">
              A
            </div>
            {!collapsed && (
              <div>
                <div className="text-center">
                  <img
                    src="/images/logo-green.png"
                    alt=""
                    className="w-full max-w-[50px]"
                  />
                </div>
                <div className="text-xs text-gray-500">Antab Agro</div>
              </div>
            )}
          </Link>

          <div className="flex items-center gap-2">
            {/* collapse toggle (desktop) */}
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="hidden md:inline-flex items-center justify-center w-8 h-8 rounded hover:bg-gray-100 dark:hover:bg-gray-700/40"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <Bars3Icon className="w-5 h-5" />
              ) : (
                <XMarkIcon className="w-5 h-5" />
              )}
            </button>

            {/* close on mobile */}
            <button
              className="md:hidden inline-flex items-center justify-center w-8 h-8 rounded hover:bg-gray-100 dark:hover:bg-gray-700/40"
              onClick={() => setMobileOpen(false)}
              aria-label="Close sidebar"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Menu */}
        <nav aria-label="Main menu">
          <ul className="space-y-1">
            {filteredMenu.map((m) => (
              <SidebarItem
                key={m.key}
                item={m}
                pathname={pathname}
                collapsed={collapsed}
                onNavigate={() => {
                  // close mobile if open
                  setMobileOpen(false);
                }}
                t={(k: string) => k}
              />
            ))}
          </ul>
        </nav>

        {/* Quick actions */}
        {!collapsed && (
          <div className="mt-6">
            <div className="text-xs text-gray-500 mb-2">Quick Actions</div>
            <div className="flex gap-2">
              <Link
                href="/sales/create"
                className={`flex-1 px-3 py-2 rounded-md bg-[#16351d] dark:bg-[#3aa838] text-white text-sm text-center hover:bg-[#3aa838] ${
                  hasAccess({ permissions: "product.create" })
                    ? "bg-green-500"
                    : "bg-red-500"
                }`}
                title={
                  hasAccess({ permissions: "product.create" })
                    ? undefined
                    : "You don't have access"
                }
              >
                + Sales Entry
              </Link>
              <Link
                href="/sales/orders/new"
                className="px-3 py-2 rounded-md border border-gray-200 text-sm hover:bg-gray-50"
              >
                Order
              </Link>
            </div>
          </div>
        )}

        {/* footer */}
        <div className="mt-8 text-xs text-gray-500">
          {!collapsed ? (
            <>© {new Date().getFullYear()} Antab Agro • v1.0.0</>
          ) : (
            <div className="text-center text-xs text-gray-400">v1.0</div>
          )}
        </div>
      </motion.aside>

      {/* Main content area (with left margin to account for sidebar) */}
      <div
        className={classNames(
          "flex-1 flex flex-col min-w-0 transition-all",
          // collapsed ? "md:ml-[72px]" : "md:ml-[288px]"
        )}
      >
        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            {/* mobile open */}
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden rounded p-2 hover:bg-gray-100 dark:hover:bg-gray-700/40"
              aria-label="Open menu"
            >
              <Bars3Icon className="w-6 h-6" />
            </button>

            {/* Global search */}
            <div className="relative w-full max-w-xl">
              <input
                ref={searchRef}
                className="w-full rounded-lg border border-gray-200 bg-gray-100 py-2 pl-10 pr-4 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder={t("search") || "Search..."}
                aria-label="Search"
                type="search"
              />
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hidden sm:block">
                ⌘K
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => {
                  setNotifOpen((s) => !s);
                  setUserMenuOpen(false);
                }}
                className="relative p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700/40"
                aria-label="Notifications"
                aria-haspopup="true"
                aria-expanded={notifOpen}
              >
                <BellIcon className="w-6 h-6" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-5 h-5 text-xs rounded-full bg-red-500 text-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {notifOpen && (
                  <motion.div
                    key="notif"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.16 }}
                    className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden z-50"
                  >
                    <div className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold">
                          Notifications
                        </div>
                        <button
                          className="text-xs text-indigo-600"
                          onClick={() => {
                            setNotifications((n) =>
                              n.map((x) => ({ ...x, unread: false })),
                            );
                          }}
                        >
                          Mark all read
                        </button>
                      </div>
                    </div>

                    <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-64 overflow-auto">
                      {notifications.map((n) => (
                        <div
                          key={n.id}
                          className={classNames(
                            "px-4 py-3 flex items-start gap-3",
                            n.unread
                              ? "bg-indigo-50 dark:bg-indigo-900/10"
                              : "",
                          )}
                        >
                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700">
                            <svg
                              className="w-4 h-4"
                              viewBox="0 0 24 24"
                              fill="none"
                            >
                              <path
                                d="M12 2v6"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">
                              {n.title}
                            </div>
                            <div className="text-xs text-gray-500">
                              {n.time}
                            </div>
                          </div>
                        </div>
                      ))}
                      {notifications.length === 0 && (
                        <div className="px-4 py-6 text-center text-sm text-gray-500">
                          No notifications
                        </div>
                      )}
                    </div>

                    <div className="p-2 border-t border-gray-100 dark:border-gray-700">
                      <Link
                        href="/notifications"
                        className="block text-center text-sm py-2 text-indigo-600"
                      >
                        View all
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Language */}
            <LanguageSwitcher />

            {/* Theme toggle */}
            <button
              onClick={() => setDark((d) => !d)}
              className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700/40"
              aria-label="Toggle theme"
              title="Toggle theme"
            >
              {dark ? (
                <SunIcon className="w-5 h-5" />
              ) : (
                <MoonIcon className="w-5 h-5" />
              )}
            </button>

            {/* Settings */}
            <Link
              href="/settings"
              className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700/40"
              aria-label="Settings"
            >
              <Cog6ToothIcon className="w-5 h-5" />
            </Link>

            {/* User menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => {
                  setUserMenuOpen((s) => !s);
                  setNotifOpen(false);
                }}
                className="flex items-center gap-2 rounded-full px-3 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
                aria-haspopup="true"
                aria-expanded={userMenuOpen}
              >
                <UserCircleIcon className="w-6 h-6 text-indigo-600" />
                <span className="hidden sm:inline-block text-sm">
                  {user.currentUser?.name || "User"}
                </span>
                <ChevronDownIcon
                  className={classNames(
                    "w-4 h-4 transition-transform",
                    userMenuOpen ? "rotate-180" : "rotate-0",
                  )}
                />
              </button>

              <AnimatePresence>
                {userMenuOpen && (
                  <motion.ul
                    key="user-menu"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.12 }}
                    className="absolute right-0 mt-2 w-44 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg z-50"
                  >
                    <li>
                      <Link
                        href="/profile"
                        className="block px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        Profile
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/profile/settings"
                        className="block px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        Account
                      </Link>
                    </li>
                    <li>
                      <button
                        onClick={() => dispatch(logoutUser())}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                      >
                        {/* <Toaster position="top-center" reverseOrder={false} /> */}
                        {t("logout")}
                      </button>
                    </li>
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-auto p-6 bg-gray-50 dark:bg-gray-900">
          {children}
        </main>

        {/* Footer */}
        <footer className="flex-shrink-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 text-sm text-center text-gray-600 dark:text-gray-400">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2">
            <div>© {new Date().getFullYear()} Antab Agro</div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <Link href="/terms" className="hover:underline">
                Terms
              </Link>
              <span>•</span>
              <Link href="/privacy" className="hover:underline">
                Privacy
              </Link>
              <span>•</span>
              <span>v1.0.0</span>
            </div>
          </div>
        </footer>
      </div>

      {/* Mobile slide-over sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            className="fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-4 md:hidden"
            aria-label="Mobile menu"
          >
            <div className="flex items-center justify-between mb-6">
              <Link href="/" className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-600 text-white font-extrabold">
                  A
                </div>
                <div>
                  <div className="text-lg font-extrabold text-indigo-700">
                    Antab Agro
                  </div>
                  <div className="text-xs text-gray-500">ERP Dashboard</div>
                </div>
              </Link>
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded p-2 hover:bg-gray-100 dark:hover:bg-gray-700/40"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <nav>
              <ul className="space-y-1">
                {filteredMenu.map((m) => (
                  <SidebarItem
                    key={`mobile-${m.key}`}
                    item={m}
                    pathname={pathname}
                    collapsed={false}
                    onNavigate={() => setMobileOpen(false)}
                    t={(k: string) => k}
                  />
                ))}
              </ul>
            </nav>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
