"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/context/LanguageContext";
import { AnimatePresence, motion } from "framer-motion";

import {
  Activity,
  Archive,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowRightLeft,
  BadgeDollarSign,
  Banknote,
  BarChart3,
  Bell,
  BookOpen,
  Boxes,
  Building2,
  Calculator,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  Coins,
  Contact,
  CreditCard,
  Database,
  DollarSign,
  FileBarChart,
  FileCheck2,
  FileCog,
  FileInput,
  FileOutput,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderKanban,
  Gauge,
  Gem,
  Globe2,
  HandCoins,
  HardHat,
  HeartPulse,
  History,
  Home,
  Landmark,
  Layers3,
  LayoutDashboard,
  List,
  LogOut,
  Megaphone,
  Menu,
  Moon,
  Package,
  PackageCheck,
  PackageOpen,
  PackagePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Percent,
  PieChart,
  PlusCircle,
  Receipt,
  RefreshCcw,
  RotateCcw,
  Scale,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Tags,
  Target,
  Truck,
  User as UserIcon,
  UserCheck,
  UserCog,
  UserRound,
  UserRoundCog,
  Users,
  Wallet,
  Warehouse,
  X,
} from "lucide-react";

import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { logoutUser, User } from "@/store/slices/userSlice";
import { toast } from "sonner";
import { canAccess } from "@/utils/rbac";

/* =========================================================
   TYPES
========================================================= */

type MenuItem = {
  key: string;
  href?: string;
  icon?: React.ReactNode;
  submenu?: MenuItem[];
  badge?: number;
  permissions?: string | string[];
};

type SidebarItemProps = {
  item: MenuItem;
  pathname: string;
  level?: number;
  collapsed: boolean;
  mobile?: boolean;
  onNavigate: () => void;
  t: (key: string) => string;
};

type TooltipProps = {
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
};

/* =========================================================
   HELPERS
========================================================= */

function classNames(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

function normalizePath(path?: string): string {
  if (!path) return "";
  if (path.length > 1 && path.endsWith("/")) {
    return path.slice(0, -1);
  }
  return path;
}

function isPathActive(pathname: string, href?: string): boolean {
  if (!href || href === "#") return false;

  const current = normalizePath(pathname);
  const target = normalizePath(href);

  return current === target;
}

function hasActiveDescendant(
  item: MenuItem,
  pathname: string,
): boolean {
  if (item.href && isPathActive(pathname, item.href)) {
    return true;
  }

  if (!item.submenu?.length) {
    return false;
  }

  return item.submenu.some((child) =>
    hasActiveDescendant(child, pathname),
  );
}

function getRoleInfo(user: User | null): {
  isSystem: boolean;
  name: string;
} {
  const role: unknown = user?.role;

  if (!role) {
    return {
      isSystem: false,
      name: "",
    };
  }

  if (typeof role === "string") {
    return {
      isSystem: role.toLowerCase().includes("super"),
      name: role,
    };
  }

  if (typeof role === "object") {
    const roleObject = role as {
      name?: unknown;
      isSystem?: unknown;
    };

    const name =
      typeof roleObject.name === "string"
        ? roleObject.name
        : "";

    return {
      isSystem:
        roleObject.isSystem === true ||
        name.toLowerCase().includes("super"),
      name,
    };
  }

  return {
    isSystem: false,
    name: "",
  };
}

/* =========================================================
   TOOLTIP
========================================================= */

function SidebarTooltip({
  children,
  label,
  disabled = false,
}: TooltipProps) {
  if (disabled) {
    return <>{children}</>;
  }

  return (
    <div className="group/tooltip relative">
      {children}

      <div
        className="
          pointer-events-none absolute left-full top-1/2 z-[100]
          ml-3 -translate-y-1/2 whitespace-nowrap
          rounded-lg border border-gray-200 bg-gray-950
          px-3 py-2 text-xs font-medium text-white opacity-0
          shadow-xl transition-all duration-150
          group-hover/tooltip:translate-x-0
          group-hover/tooltip:opacity-100
          dark:border-gray-700
        "
      >
        {label}

        <span
          className="
            absolute right-full top-1/2 -mr-px
            h-2 w-2 -translate-y-1/2 rotate-45
            border-b border-l border-gray-200
            bg-gray-950
            dark:border-gray-700
          "
        />
      </div>
    </div>
  );
}

/* =========================================================
   MENU DATA
   ========================================================= */

const menuItems: MenuItem[] = [
  {
    key: "dashboard",
    href: "/",
    icon: <LayoutDashboard size={19} strokeWidth={1.8} />,
    permissions: ["dashboard.view"],
  },

  /* =======================================================
     INVENTORY
  ======================================================= */

  {
    key: "inventory",
    icon: <Boxes size={19} strokeWidth={1.8} />,
    badge: 3,
    submenu: [
      {
        key: "Supplier",
        href: "/inventory/supplier",
        icon: <Truck size={17} />,
        permissions: [
          "supplier.view",
          "supplier.edit",
          "supplier.delete",
          "supplier.create",
          "supplier.approve",
          "supplier.reject",
        ],
      },

      {
        key: "Work Order",
        href: "/inventory/workorder",
        icon: <ClipboardList size={17} />,
        permissions: [
          "workorder.view",
          "workorder.edit",
          "workorder.delete",
          "workorder.create",
        ],
      },

      {
        key: "G.R.N",
        href: "/inventory/good-receipt",
        icon: <PackageCheck size={17} />,
        permissions: [
          "goodreceipt.view",
          "goodreceipt.edit",
          "goodreceipt.delete",
          "goodreceipt.create",
        ],
      },

      {
        key: "Inventories",
        icon: <PackageOpen size={17} />,
        submenu: [
          {
            key: "Raw Materials",
            href: "/inventory/raw-materials",
            icon: <PackagePlus size={16} />,
            permissions: [
              "rawmaterials.view",
              "rawmaterials.edit",
              "rawmaterials.delete",
              "rawmaterials.create",
            ],
          },

          {
            key: "Packing Materials",
            href: "/inventory/packing-materials",
            icon: <Archive size={16} />,
            permissions: [
              "packingmaterials.view",
              "packingmaterials.edit",
              "packingmaterials.delete",
              "packingmaterials.create",
            ],
          },

          {
            key: "Finished Goods",
            href: "/inventory/finished-products",
            icon: <PackageCheck size={16} />,
            permissions: [
              "finishedproducts.view",
              "finishedproducts.edit",
              "finishedproducts.delete",
              "finishedproducts.create",
            ],
          },

          {
            key: "Other Products",
            href: "/inventory/other-products",
            icon: <Package size={16} />,
            permissions: [
              "otherproducts.view",
              "otherproducts.edit",
              "otherproducts.delete",
              "otherproducts.create",
            ],
          },

          {
            key: "Inventory Report",
            href: "/inventory/report",
            icon: <FileBarChart size={16} />,
            permissions: [
              "inventoryreport.view",
              "inventoryreport.edit",
              "inventoryreport.delete",
              "inventoryreport.create",
            ],
          },
        ],
      },

      {
        key: "Product Transfer",
        href: "/inventory/product-transfer",
        icon: <ArrowRightLeft size={17} />,
        permissions: [
          "factorytransfer.view",
          "factorytransfer.edit",
          "factorytransfer.delete",
          "factorytransfer.create",
        ],
      },

      {
        key: "BOM",
        href: "/inventory/bom",
        icon: <Layers3 size={17} />,
        permissions: [
          "bom.view",
          "bom.edit",
          "bom.delete",
          "bom.create",
        ],
      },

      {
        key: "Production",
        href: "/inventory/production",
        icon: <FactoryIcon />,
        permissions: [
          "production.view",
          "production.edit",
          "production.delete",
          "production.create",
        ],
      },

      {
        key: "WIP",
        href: "/inventory/wip",
        icon: <Activity size={17} />,
        permissions: [
          "wip.view",
          "wip.edit",
          "wip.delete",
          "wip.create",
        ],
      },

      {
        key: "Material WIP",
        href: "/inventory/material-wip",
        icon: <RefreshCcw size={17} />,
        permissions: [
          "materialwip.view",
          "materialwip.edit",
          "materialwip.delete",
          "materialwip.create",
        ],
      },
    ],
  },

  /* =======================================================
     SALES
  ======================================================= */

  {
    key: "Sales Orders",
    icon: <ShoppingCart size={19} strokeWidth={1.8} />,
    badge: 5,
    submenu: [
      {
        key: "Dashboard",
        href: "/sales",
        icon: <Gauge size={17} />,
        permissions: [
          "salesdashboard.view",
          "salesdashboard.edit",
          "salesdashboard.delete",
          "salesdashboard.create",
        ],
      },

      {
        key: "Sales",
        icon: <ShoppingBag size={17} />,
        permissions: [
          "sales.create",
          "sales.view",
          "sales.edit",
          "sales.delete",
        ],
        submenu: [
          {
            key: "Sales Entry",
            href: "/sales/create",
            icon: <PlusCircle size={16} />,
            permissions: [
              "sales.create",
              "sales.view",
              "sales.edit",
              "sales.delete",
            ],
          },
          {
            key: "Sales List",
            href: "/sales/list",
            icon: <List size={16} />,
            permissions: [
              "sales.view",
              "sales.edit",
              "sales.delete",
              "sales.create",
            ],
          },
          {
            key: "Sales Invoice",
            href: "/sales/invoice",
            icon: <Receipt size={16} />,
            permissions: [
              "sales.view",
              "sales.edit",
              "sales.delete",
              "sales.create",
            ],
          },
          {
            key: "D.C",
            href: "/sales/delivery/status",
            icon: <Truck size={16} />,
            permissions: [
              "delivery.view",
              "delivery.edit",
              "delivery.delete",
              "delivery.create",
            ],
          },
        ],
      },

      {
        key: "TADA",
        icon: <Wallet size={17} />,
        permissions: [
          "tada.view",
          "tada.edit",
          "tada.delete",
          "tada.create",
        ],
        submenu: [
          {
            key: "Entries",
            icon: <FileText size={16} />,
            permissions: [
              "tada.view",
              "tada.edit",
              "tada.delete",
              "tada.create",
            ],
            submenu: [
              {
                key: "My Entries",
                href: "/sales/tada/entries",
                icon: <List size={15} />,
                permissions: [
                  "tada.view",
                  "tada.edit",
                  "tada.delete",
                ],
              },
              {
                key: "Create Entry",
                href: "/sales/tada/entries/create",
                icon: <PlusCircle size={15} />,
                permissions: [
                  "tada.edit",
                  "tada.create",
                ],
              },
            ],
          },

          {
            key: "Monthly",
            href: "/sales/tada/monthly",
            icon: <CalendarDays size={16} />,
            permissions: [
              "tada.view",
              "tada.edit",
            ],
          },

          {
            key: "Team Sheets",
            href: "/sales/tada/team-sheets",
            icon: <Users size={16} />,
            permissions: [
              "tada.view",
              "tada.edit",
              "tada.delete",
              "tada.create",
            ],
          },

          {
            key: "Rates",
            icon: <CircleDollarSign size={16} />,
            permissions: [
              "tada.view",
              "tada.edit",
              "tada.delete",
              "tada.create",
            ],
            submenu: [
              {
                key: "List",
                href: "/sales/tada/rates",
                icon: <List size={15} />,
                permissions: [
                  "tada.view",
                  "tada.edit",
                  "tada.delete",
                  "tada.create",
                ],
              },
              {
                key: "Create",
                href: "/sales/tada/rates/create",
                icon: <PlusCircle size={15} />,
                permissions: [
                  "tada.edit",
                  "tada.create",
                ],
              },
            ],
          },
        ],
      },

      {
        key: "Prescription",
        href: "/sales/prescription",
        icon: <HeartPulse size={17} />,
        permissions: [
          "prescription.view",
          "prescription.edit",
          "prescription.delete",
          "prescription.create",
        ],
      },

      {
        key: "T.C (Transfer)",
        href: "/sales/transfer/status",
        icon: <ArrowLeftRight size={17} />,
        permissions: [
          "warehousetransfer.view",
          "warehousetransfer.edit",
          "warehousetransfer.delete",
          "warehousetransfer.create",
        ],
      },

      {
        key: "Sales Ledger",
        href: "/sales/ledger",
        icon: <BookOpen size={17} />,
        permissions: [
          "salesledger.view",
          "salesledger.edit",
          "salesledger.delete",
          "salesledger.create",
        ],
      },

      {
        key: "Dealer",
        icon: <Contact size={17} />,
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
            icon: <List size={16} />,
            permissions: [
              "dealer.view",
              "dealer.create",
              "dealer.edit",
              "dealer.delete",
            ],
          },
          {
            key: "Ledger",
            href: "/sales/dealer/ledger",
            icon: <BookOpen size={16} />,
            permissions: [
              "dealerledger.view",
              "dealerledger.edit",
            ],
          },
          {
            key: "Zone",
            href: "/sales/dealer/zones",
            icon: <Globe2 size={16} />,
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
            icon: <MapIcon />,
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
            icon: <Target size={16} />,
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
            icon: <NavigationIcon />,
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
            icon: <Warehouse size={16} />,
            permissions: [
              "warehouse.view",
              "warehouse.create",
              "warehouse.edit",
              "warehouse.delete",
            ],
          },
        ],
      },

      {
        key: "Products",
        href: "/sales/products",
        icon: <Package size={17} />,
        permissions: [
          "products.view",
          "products.edit",
          "products.delete",
          "products.create",
        ],
      },

      {
        key: "Products Promotion",
        href: "/sales/product-promotion",
        icon: <Megaphone size={17} />,
        permissions: [
          "productpromotion.view",
          "productpromotion.edit",
          "productpromotion.delete",
          "productpromotion.create",
        ],
      },

      {
        key: "Special Offers",
        href: "/sales/special-offers",
        icon: <Sparkles size={17} />,
        permissions: [
          "specialoffers.view",
          "specialoffers.edit",
          "specialoffers.delete",
          "specialoffers.create",
        ],
      },

      {
        key: "Damages",
        href: "/sales/damage",
        icon: <Archive size={17} />,
        permissions: [
          "damages.view",
          "damages.edit",
          "damages.delete",
          "damages.create",
        ],
      },

      {
        key: "Return",
        href: "/sales/return",
        icon: <RotateCcw size={17} />,
        permissions: [
          "return.view",
          "return.edit",
          "return.delete",
          "return.create",
        ],
      },

      {
        key: "Incentive",
        href: "/sales/incentive",
        icon: <BadgeDollarSign size={17} />,
        permissions: [
          "incentive.view",
          "incentive.edit",
          "incentive.delete",
          "incentive.create",
        ],
      },

      {
        key: "reports",
        icon: <FileBarChart size={17} />,
        permissions: [
          "salesreports.view",
          "salesreports.edit",
          "salesreports.delete",
          "salesreports.create",
        ],
        submenu: [
          {
            key: "Sales & Collections",
            href: "/sales/reports/sales-collections",
            icon: <BarChart3 size={16} />,
            permissions: [
              "sales&collections.view",
              "sales&collections.edit",
              "sales&collections.delete",
              "sales&collections.create",
            ],
          },
        ],
      },
    ],
  },

  /* =======================================================
     ACCOUNTS
  ======================================================= */

  {
    key: "accounts",
    icon: <Landmark size={19} strokeWidth={1.8} />,
    badge: 2,
    submenu: [
      {
        key: "Chart Of Accounts",
        href: "/accounts/chart-of-accounts",
        icon: <Calculator size={17} />,
        permissions: [
          "chartofaccounts.view",
          "chartofaccounts.edit",
          "chartofaccounts.delete",
          "chartofaccounts.create",
        ],
      },

      {
        key: "Collections",
        href: "/accounts/collections",
        icon: <HandCoins size={17} />,
        permissions: [
          "collections.view",
          "collections.edit",
          "collections.delete",
          "collections.create",
        ],
      },

      {
        key: "Vouchers",
        icon: <Receipt size={17} />,
        permissions: [
          "vouchers.view",
          "vouchers.edit",
          "vouchers.delete",
          "vouchers.create",
        ],
        submenu: [
          {
            key: "Voucher Admin",
            href: "/accounts/vouchers/admin",
            icon: <FileCog size={16} />,
            permissions: [
              "voucheradmin.view",
              "voucheradmin.edit",
              "voucheradmin.delete",
              "voucheradmin.create",
            ],
          },

          {
            key: "Receive Voucher",
            icon: <ArrowDownToLine size={16} />,
            permissions: [
              "receivevoucher.view",
              "receivevoucher.edit",
              "receivevoucher.delete",
              "receivevoucher.create",
            ],
            submenu: [
              {
                key: "Bank Receive",
                href: "/accounts/vouchers/receive/bank",
                icon: <Landmark size={15} />,
                permissions: [
                  "bankreceive.view",
                  "bankreceive.edit",
                  "bankreceive.delete",
                  "bankreceive.create",
                ],
              },
              {
                key: "Cash Receive",
                href: "/accounts/vouchers/receive/cash",
                icon: <Banknote size={15} />,
                permissions: [
                  "cashreceive.view",
                  "cashreceive.edit",
                  "cashreceive.delete",
                  "cashreceive.create",
                ],
              },
            ],
          },

          {
            key: "Payment Voucher",
            icon: <FileOutput size={16} />,
            permissions: [
              "paymentvoucher.view",
              "paymentvoucher.edit",
              "paymentvoucher.delete",
              "paymentvoucher.create",
            ],
            submenu: [
              {
                key: "Bank Payment",
                href: "/accounts/vouchers/payment/bank",
                icon: <Landmark size={15} />,
                permissions: [
                  "bankpayment.view",
                  "bankpayment.edit",
                  "bankpayment.delete",
                  "bankpayment.create",
                ],
              },
              {
                key: "Cash Payment",
                href: "/accounts/vouchers/payment/cash",
                icon: <Banknote size={15} />,
                permissions: [
                  "cashpayment.view",
                  "cashpayment.edit",
                  "cashpayment.delete",
                  "cashpayment.create",
                ],
              },
            ],
          },

          {
            key: "Journal Voucher",
            href: "/accounts/vouchers/journal",
            icon: <BookOpen size={16} />,
            permissions: [
              "journalvoucher.view",
              "journalvoucher.edit",
              "journalvoucher.delete",
              "journalvoucher.create",
            ],
          },

          {
            key: "Contra Voucher",
            href: "/accounts/vouchers/contra",
            icon: <ArrowLeftRight size={16} />,
            permissions: [
              "contravoucher.view",
              "contravoucher.edit",
              "contravoucher.delete",
              "contravoucher.create",
            ],
          },
        ],
      },

      {
        key: "Reports",
        icon: <FileBarChart size={17} />,
        permissions: [
          "accountsreports.view",
          "accountsreports.edit",
          "accountsreports.delete",
          "accountsreports.create",
        ],
        submenu: [
          {
            key: "Financial Reports",
            icon: <PieChart size={16} />,
            permissions: [
              "financialreports.view",
              "financialreports.edit",
              "financialreports.delete",
              "financialreports.create",
            ],
            submenu: [
              {
                key: "Financial Notes",
                href: "/accounts/reports/financial/financial-notes",
                icon: <FileText size={15} />,
                permissions: [
                  "financialnotes.view",
                  "financialnotes.edit",
                  "financialnotes.delete",
                  "financialnotes.create",
                ],
              },

              {
                key: "Statement Of Financial Position",
                href: "/accounts/reports/financial/financial-position",
                icon: <Scale size={15} />,
                permissions: [
                  "financialposition.view",
                  "financialposition.edit",
                  "financialposition.delete",
                  "financialposition.create",
                ],
              },

              {
                key: "Statement Of Profit or Loss & Other Comprehensive Income",
                href: "/accounts/reports/financial/profit-loss",
                icon: <TrendingUpIcon />,
                permissions: [
                  "profitloss.view",
                  "profitloss.edit",
                  "profitloss.delete",
                  "profitloss.create",
                ],
              },

              {
                key: "Statement Of Changes in Equity",
                href: "/accounts/reports/financial/changes-equity",
                icon: <RefreshCcw size={15} />,
                permissions: [
                  "changesequity.view",
                  "changesequity.edit",
                  "changesequity.delete",
                  "changesequity.create",
                ],
              },
            ],
          },

          {
            key: "Individual Account / Ledger",
            href: "/accounts/reports/ledger",
            icon: <BookOpen size={16} />,
            permissions: [
              "ledger.view",
              "ledger.edit",
              "ledger.delete",
              "ledger.create",
            ],
          },

          {
            key: "Trial Balance",
            href: "/accounts/reports/trial-balance",
            icon: <Scale size={16} />,
            permissions: [
              "trialbalance.view",
              "trialbalance.edit",
              "trialbalance.delete",
              "trialbalance.create",
            ],
          },

          {
            key: "Other Reports",
            icon: <FileSpreadsheet size={16} />,
            permissions: [
              "otherreports.view",
              "otherreports.edit",
              "otherreports.delete",
              "otherreports.create",
            ],
          },
        ],
      },
    ],
  },

  /* =======================================================
     HR
  ======================================================= */

  {
    key: "hrPayroll",
    icon: <Users size={19} strokeWidth={1.8} />,
    permissions: [
      "hrpayroll.view",
      "hrpayroll.edit",
      "hrpayroll.delete",
      "hrpayroll.create",
    ],
    submenu: [
      {
        key: "employees",
        href: "/hr/employees",
        icon: <UserRound size={17} />,
        permissions: [
          "employees.view",
          "employees.edit",
          "employees.delete",
          "employees.create",
        ],
      },
      {
        key: "payroll",
        href: "/hr/payroll",
        icon: <Wallet size={17} />,
        permissions: [
          "payroll.view",
          "payroll.edit",
          "payroll.delete",
          "payroll.create",
        ],
      },
      {
        key: "attendance",
        href: "/hr/attendance",
        icon: <CalendarDays size={17} />,
        permissions: [
          "attendance.view",
          "attendance.edit",
          "attendance.delete",
          "attendance.create",
        ],
      },
    ],
  },

  /* =======================================================
     ADMINISTRATION
  ======================================================= */

  {
    key: "Administration",
    icon: <ShieldCheck size={19} strokeWidth={1.8} />,
    permissions: [
      "admin.view",
      "admin.edit",
      "admin.delete",
      "admin.create",
    ],
    submenu: [
      {
        key: "Users",
        href: "/admin/users",
        icon: <Users size={17} />,
        permissions: [
          "users.view",
          "users.edit",
          "users.delete",
          "users.create",
        ],
      },

      {
        key: "Assign Location",
        href: "/admin/users/location",
        icon: <Globe2 size={17} />,
        permissions: [
          "userslocation.view",
          "userslocation.edit",
          "userslocation.delete",
          "userslocation.create",
        ],
      },

      {
        key: "Assign Warehouse",
        href: "/admin/users/warehouse",
        icon: <Warehouse size={17} />,
        permissions: [
          "userswarehouse.view",
          "userswarehouse.edit",
          "userswarehouse.delete",
          "userswarehouse.create",
        ],
      },

      {
        key: "Roles",
        href: "/admin/roles",
        icon: <UserCog size={17} />,
        permissions: [
          "roles.view",
          "roles.edit",
          "roles.delete",
          "roles.create",
        ],
      },

      {
        key: "Departments",
        href: "/admin/departments",
        icon: <Building2 size={17} />,
        permissions: [
          "departments.view",
          "departments.edit",
          "departments.delete",
          "departments.create",
        ],
      },

      {
        key: "Permissions",
        href: "/admin/permissions",
        icon: <SlidersHorizontal size={17} />,
        permissions: [
          "permissions.view",
          "permissions.edit",
          "permissions.delete",
          "permissions.create",
        ],
      },
    ],
  },

  /* =======================================================
     MEDIA
  ======================================================= */

  {
    key: "Media",
    icon: <Folder size={19} strokeWidth={1.8} />,
    permissions: [
      "media.view",
      "media.edit",
      "media.delete",
      "media.create",
    ],
    submenu: [
      {
        key: "List",
        href: "/media",
        icon: <List size={17} />,
        permissions: [
          "media.view",
          "media.edit",
          "media.delete",
          "media.create",
        ],
      },
    ],
  },
];

/* =========================================================
   RBAC FILTER
   IMPORTANT:
   This is intentionally kept compatible with your current RBAC.
========================================================= */

function filterMenuByRBAC(
  item: MenuItem,
  user: User | null,
): MenuItem | null {
  const { isSystem } = getRoleInfo(user);

  if (item.submenu?.length) {
    const allowedChildren = item.submenu
      .map((child) => filterMenuByRBAC(child, user))
      .filter((child): child is MenuItem => Boolean(child));

    /*
     * Parent remains visible when ANY child is accessible.
     */
    if (allowedChildren.length === 0) {
      return null;
    }

    return {
      ...item,
      submenu: allowedChildren,
    };
  }

  if (!item.permissions) {
    return isSystem ? item : null;
  }

  return canAccess(user, {
    permissions: item.permissions,
    match: "any",
  })
    ? item
    : null;
}

/* =========================================================
   SIDEBAR ITEM
========================================================= */

function SidebarItem({
  item,
  pathname,
  level = 0,
  collapsed,
  mobile = false,
  onNavigate,
  t,
}: SidebarItemProps) {
  const children = item.submenu ?? [];
  const hasSub = children.length > 0;

  const active = isPathActive(pathname, item.href);
  const descendantActive = hasActiveDescendant(item, pathname);

  const [open, setOpen] = useState(
    descendantActive && !collapsed,
  );

  const label = t(item.key) || item.key;

  useEffect(() => {
    if (descendantActive && !collapsed) {
      setOpen(true);
    }
  }, [descendantActive, collapsed]);

  const toggle = () => {
    setOpen((value) => !value);
  };

  const handleNavigate = () => {
    onNavigate();
  };

  const paddingLeft = mobile
    ? Math.min(level * 14 + 12, 56)
    : Math.min(level * 12 + 12, 54);

  /*
   * COLLAPSED DESKTOP
   *
   * A submenu becomes a flyout.
   * This avoids the old broken situation where nested
   * children were simply hidden.
   */
  if (collapsed && !mobile) {
    return (
      <li className="group/collapsed relative">
        {hasSub ? (
          <button
            type="button"
            onClick={toggle}
            title={label}
            className={classNames(
              "relative flex h-11 w-full items-center justify-center rounded-xl",
              "transition-all duration-200",
              descendantActive
                ? "bg-[#3aa838]/10 text-[#2f8f2d]"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-900",
              "dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white",
            )}
          >
            {descendantActive && (
              <span
                className="
                  absolute left-0 top-1/2 h-6 w-1
                  -translate-y-1/2 rounded-r-full
                  bg-[#3aa838]
                "
              />
            )}

            {item.icon ?? (
              <Folder size={19} strokeWidth={1.8} />
            )}

            {item.badge && item.badge > 0 && (
              <span
                className="
                  absolute right-1 top-1 flex h-4 min-w-4
                  items-center justify-center rounded-full
                  bg-red-500 px-1 text-[9px] font-bold text-white
                "
              >
                {item.badge}
              </span>
            )}
          </button>
        ) : (
          <Link
            href={item.href ?? "#"}
            onClick={handleNavigate}
            title={label}
            className={classNames(
              "relative flex h-11 w-full items-center justify-center rounded-xl",
              "transition-all duration-200",
              active
                ? "bg-[#3aa838] text-white shadow-[0_8px_24px_rgba(58,168,56,0.22)]"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-900",
              "dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white",
            )}
          >
            {item.icon ?? (
              <Folder size={19} strokeWidth={1.8} />
            )}

            {item.badge && item.badge > 0 && (
              <span
                className="
                  absolute right-1 top-1 flex h-4 min-w-4
                  items-center justify-center rounded-full
                  bg-red-500 px-1 text-[9px] font-bold text-white
                "
              >
                {item.badge}
              </span>
            )}
          </Link>
        )}

        {/* Hover flyout */}
        {hasSub && (
          <div
            className="
              invisible absolute left-full top-0 z-[90]
              ml-2 w-72 origin-left scale-95 opacity-0
              rounded-2xl border border-gray-200 bg-white
              p-2 shadow-2xl
              transition-all duration-150
              group-hover/collapsed:visible
              group-hover/collapsed:scale-100
              group-hover/collapsed:opacity-100
              dark:border-gray-700 dark:bg-gray-900
            "
          >
            <div className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2">
              <span className="text-[#3aa838]">
                {item.icon}
              </span>

              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {label}
              </span>
            </div>

            <div className="max-h-[70vh] overflow-y-auto pr-1">
              <ul className="space-y-1">
                {children.map((child) => (
                  <SidebarItem
                    key={child.key}
                    item={child}
                    pathname={pathname}
                    level={0}
                    collapsed={false}
                    mobile={false}
                    onNavigate={onNavigate}
                    t={t}
                  />
                ))}
              </ul>
            </div>
          </div>
        )}
      </li>
    );
  }

  /*
   * EXPANDED / MOBILE
   */

  return (
    <li className="relative">
      {hasSub ? (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className={classNames(
            "group relative flex w-full items-center gap-3",
            "rounded-xl px-3 py-2.5 text-left",
            "transition-all duration-200",
            descendantActive
              ? "bg-[#3aa838]/10 text-[#216a20]"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-950",
            "dark:text-gray-300 dark:hover:bg-gray-800",
            descendantActive
              ? "dark:bg-[#3aa838]/10 dark:text-[#9bdd91]"
              : "",
          )}
          style={{
            paddingLeft,
          }}
        >
          {descendantActive && (
            <span
              className="
                absolute left-0 top-1/2 h-7 w-1
                -translate-y-1/2 rounded-r-full
                bg-[#3aa838]
              "
            />
          )}

          <span
            className={classNames(
              "flex h-7 w-7 shrink-0 items-center justify-center",
              "rounded-lg transition-colors",
              descendantActive
                ? "text-[#3aa838]"
                : "text-gray-400 group-hover:text-[#3aa838]",
            )}
          >
            {item.icon ?? (
              <Folder size={17} strokeWidth={1.8} />
            )}
          </span>

          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
            {label}
          </span>

          {item.badge && item.badge > 0 && (
            <span
              className="
                inline-flex min-w-5 items-center justify-center
                rounded-full bg-red-500 px-1.5 py-0.5
                text-[10px] font-bold text-white
              "
            >
              {item.badge}
            </span>
          )}

          <ChevronDown
            size={15}
            className={classNames(
              "shrink-0 text-gray-400 transition-transform duration-200",
              open ? "rotate-180" : "rotate-0",
            )}
          />
        </button>
      ) : (
        <Link
          href={item.href ?? "#"}
          onClick={handleNavigate}
          className={classNames(
            "group relative flex items-center gap-3",
            "rounded-xl px-3 py-2.5",
            "transition-all duration-200",
            active
              ? "bg-[#3aa838] text-white shadow-[0_8px_22px_rgba(58,168,56,0.18)]"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-950",
            "dark:text-gray-300 dark:hover:bg-gray-800",
            active
              ? "dark:bg-[#3aa838] dark:text-white"
              : "",
          )}
          style={{
            paddingLeft,
          }}
        >
          <span
            className={classNames(
              "flex h-7 w-7 shrink-0 items-center justify-center",
              "rounded-lg",
              active
                ? "text-white"
                : "text-gray-400 group-hover:text-[#3aa838]",
            )}
          >
            {item.icon ?? (
              <Folder size={17} strokeWidth={1.8} />
            )}
          </span>

          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
            {label}
          </span>

          {item.badge && item.badge > 0 && (
            <span
              className={classNames(
                "inline-flex min-w-5 items-center justify-center",
                "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                active
                  ? "bg-white/20 text-white"
                  : "bg-red-500 text-white",
              )}
            >
              {item.badge}
            </span>
          )}
        </Link>
      )}

      <AnimatePresence initial={false}>
        {hasSub && open && (
          <motion.div
            initial={{
              height: 0,
              opacity: 0,
            }}
            animate={{
              height: "auto",
              opacity: 1,
            }}
            exit={{
              height: 0,
              opacity: 0,
            }}
            transition={{
              duration: 0.2,
              ease: "easeOut",
            }}
            className="overflow-hidden"
          >
            <ul
              className="
                relative mt-1 space-y-0.5
                before:absolute before:bottom-2 before:left-[26px]
                before:top-2 before:w-px
                before:bg-gray-200
                dark:before:bg-gray-700
              "
            >
              {children.map((child) => (
                <SidebarItem
                  key={child.key}
                  item={child}
                  pathname={pathname}
                  level={level + 1}
                  collapsed={false}
                  mobile={mobile}
                  onNavigate={onNavigate}
                  t={t}
                />
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

/* =========================================================
   SIDEBAR
========================================================= */

function Sidebar({
  items,
  pathname,
  collapsed,
  mobile = false,
  onClose,
  onCollapse,
  t,
  currentUser,
}: {
  items: MenuItem[];
  pathname: string;
  collapsed: boolean;
  mobile?: boolean;
  onClose: () => void;
  onCollapse?: () => void;
  t: (key: string) => string;
  currentUser: User | null;
}) {
  const roleInfo = getRoleInfo(currentUser);

  return (
    <aside
      className={classNames(
        "flex h-full flex-col",
        mobile
          ? "w-[300px] bg-white dark:bg-gray-950"
          : collapsed
            ? "w-[82px]"
            : "w-[292px]",
      )}
    >
      {/* BRAND */}
      <div
        className={classNames(
          "flex h-[76px] shrink-0 items-center",
          collapsed && !mobile
            ? "justify-center px-3"
            : "justify-between px-4",
        )}
      >
        <Link
          href="/"
          onClick={mobile ? onClose : undefined}
          className={classNames(
            "group flex min-w-0 items-center",
            collapsed && !mobile
              ? "justify-center"
              : "gap-3",
          )}
        >
          <div
            className="
              relative flex h-11 w-11 shrink-0 items-center
              justify-center overflow-hidden rounded-xl
              bg-[#16351d] shadow-lg
              shadow-[#16351d]/10
            "
          >
            <img
              src="/images/logo-green.png"
              alt="Antab Agro"
              className="h-8 w-8 object-contain"
            />

            <span
              className="
                absolute inset-0 rounded-xl ring-1
                ring-inset ring-white/10
              "
            />
          </div>

          {(!collapsed || mobile) && (
            <div className="min-w-0">
              <div className="truncate text-[15px] font-bold tracking-tight text-gray-950 dark:text-white">
                Antab Agro
              </div>

              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#3aa838]" />
                <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-gray-400">
                  Enterprise ERP
                </span>
              </div>
            </div>
          )}
        </Link>

        {mobile ? (
          <button
            type="button"
            onClick={onClose}
            className="
              rounded-xl p-2 text-gray-400
              transition hover:bg-gray-100 hover:text-gray-900
              dark:hover:bg-gray-800 dark:hover:text-white
            "
            aria-label="Close sidebar"
          >
            <X size={19} />
          </button>
        ) : (
          onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              className="
                hidden rounded-xl p-2 text-gray-400
                transition-all duration-200
                hover:bg-gray-100 hover:text-gray-900
                md:flex
                dark:hover:bg-gray-800 dark:hover:text-white
              "
              aria-label={
                collapsed
                  ? "Expand sidebar"
                  : "Collapse sidebar"
              }
              title={
                collapsed
                  ? "Expand sidebar"
                  : "Collapse sidebar"
              }
            >
              {collapsed ? (
                <PanelLeftOpen size={19} />
              ) : (
                <PanelLeftClose size={19} />
              )}
            </button>
          )
        )}
      </div>

      {/* USER / ROLE CONTEXT */}
      {(!collapsed || mobile) && (
        <div className="px-3 pb-3">
          <div
            className="
              flex items-center gap-3 rounded-2xl
              border border-gray-200/80 bg-gray-50/80
              px-3 py-2.5
              dark:border-gray-800 dark:bg-gray-900/70
            "
          >
            <div
              className="
                flex h-9 w-9 shrink-0 items-center
                justify-center rounded-xl
                bg-[#3aa838]/10 text-[#3aa838]
              "
            >
              <UserRound size={17} />
            </div>

            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-gray-900 dark:text-white">
                {currentUser?.name || "User"}
              </div>

              <div className="mt-0.5 truncate text-[10px] font-medium text-gray-400">
                {roleInfo.name || "ERP User"}
              </div>
            </div>

            <div className="ml-auto h-2 w-2 shrink-0 rounded-full bg-[#3aa838]" />
          </div>
        </div>
      )}

      {/* NAV */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <nav aria-label="Main navigation">
          <ul className="space-y-1">
            {items.map((item) => (
              <SidebarItem
                key={item.key}
                item={item}
                pathname={pathname}
                collapsed={collapsed && !mobile}
                mobile={mobile}
                onNavigate={onClose}
                t={t}
              />
            ))}
          </ul>
        </nav>
      </div>

      {/* QUICK ACTIONS */}
      {!collapsed || mobile ? (
        <div className="shrink-0 px-3 pb-3">
          <div
            className="
              overflow-hidden rounded-2xl
              border border-[#3aa838]/15
              bg-gradient-to-br from-[#3aa838]/10
              via-white to-[#16351d]/5
              p-3
              dark:from-[#3aa838]/10
              dark:via-gray-900
              dark:to-[#16351d]/10
            "
          >
            <div className="mb-2 flex items-center gap-2">
              <Sparkles
                size={14}
                className="text-[#3aa838]"
              />
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500">
                Quick Actions
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {canAccess(currentUser, {
                permissions: "sales.create",
              }) && (
                <Link
                  href="/sales/create"
                  onClick={onClose}
                  className="
                    flex items-center justify-center gap-1.5
                    rounded-xl bg-[#16351d] px-2 py-2.5
                    text-[11px] font-semibold text-white
                    shadow-sm transition
                    hover:bg-[#3aa838]
                  "
                >
                  <PlusCircle size={14} />
                  Sales
                </Link>
              )}

              {canAccess(currentUser, {
                permissions: "sales.create",
              }) && (
                <Link
                  href="/sales/orders/new"
                  onClick={onClose}
                  className="
                    flex items-center justify-center gap-1.5
                    rounded-xl border border-gray-200
                    bg-white px-2 py-2.5
                    text-[11px] font-semibold text-gray-700
                    transition hover:border-[#3aa838]/30
                    hover:bg-[#3aa838]/5
                    dark:border-gray-700 dark:bg-gray-900
                    dark:text-gray-300
                  "
                >
                  <ShoppingCart size={14} />
                  Order
                </Link>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="shrink-0 px-3 pb-3">
          <div className="flex justify-center">
            <div className="h-8 w-8 rounded-xl bg-[#3aa838]/10 flex items-center justify-center">
              <Sparkles size={15} className="text-[#3aa838]" />
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <div
        className={classNames(
          "shrink-0 border-t border-gray-100 px-4 py-3",
          "dark:border-gray-800",
          collapsed && !mobile
            ? "text-center"
            : "",
        )}
      >
        {collapsed && !mobile ? (
          <span className="text-[9px] font-semibold text-gray-400">
            v1.0
          </span>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-400">
              Antab Agro ERP
            </span>

            <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[9px] font-semibold text-gray-400 dark:bg-gray-800">
              v1.0.0
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}

/* =========================================================
   MAIN LAYOUT
========================================================= */

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { t } = useTranslation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const dispatch = useDispatch<any>();

  const { error, success, currentUser } = useSelector(
    (state: RootState) => state.user,
  );

  /* =======================================================
     FILTER MENU
  ======================================================= */

  const filteredMenu = useMemo(() => {
    return menuItems
      .map((item) =>
        filterMenuByRBAC(
          item,
          currentUser ?? null,
        ),
      )
      .filter((item): item is MenuItem => Boolean(item));
  }, [currentUser]);

  /* =======================================================
     THEME
  ======================================================= */

  useEffect(() => {
    try {
      const saved = localStorage.getItem(
        "erp_theme_dark",
      );

      if (saved !== null) {
        setDark(saved === "true");
        return;
      }

      const prefersDark =
        window.matchMedia?.(
          "(prefers-color-scheme: dark)",
        ).matches ?? false;

      setDark(prefersDark);
    } catch {
      setDark(false);
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle(
      "dark",
      dark,
    );

    try {
      localStorage.setItem(
        "erp_theme_dark",
        String(dark),
      );
    } catch {
      // Ignore storage errors.
    }
  }, [dark]);

  /* =======================================================
     SIDEBAR PERSISTENCE
  ======================================================= */

  useEffect(() => {
    try {
      const saved = localStorage.getItem(
        "erp_sidebar_collapsed",
      );

      if (saved !== null) {
        setCollapsed(saved === "true");
      }
    } catch {
      // Ignore storage errors.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        "erp_sidebar_collapsed",
        String(collapsed),
      );
    } catch {
      // Ignore storage errors.
    }
  }, [collapsed]);

  /* =======================================================
     CLOSE MOBILE AFTER ROUTE CHANGE
  ======================================================= */

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  /* =======================================================
     KEYBOARD SHORTCUTS
  ======================================================= */

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        searchRef.current?.focus();
      }

      if (event.key === "Escape") {
        setMobileOpen(false);
        setUserMenuOpen(false);
        setNotifOpen(false);
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyboard,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyboard,
      );
    };
  }, []);

  /* =======================================================
     OUTSIDE CLICK
  ======================================================= */

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(target)
      ) {
        setUserMenuOpen(false);
      }

      if (
        notifRef.current &&
        !notifRef.current.contains(target)
      ) {
        setNotifOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleOutsideClick,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick,
      );
    };
  }, []);

  /* =======================================================
     NOTIFICATIONS
  ======================================================= */

  const [notifications, setNotifications] =
    useState<
      Array<{
        id: string;
        title: string;
        time: string;
        unread: boolean;
      }>
    >([
      {
        id: "1",
        title: "New order #OD-1024",
        time: "2m",
        unread: true,
      },
      {
        id: "2",
        title: "Stock low: Rice (SKU-112)",
        time: "1h",
        unread: true,
      },
      {
        id: "3",
        title: "Payroll processed",
        time: "1d",
        unread: false,
      },
    ]);

  const unreadCount = notifications.filter(
    (notification) => notification.unread,
  ).length;

  /* =======================================================
     TOASTS
  ======================================================= */

  useEffect(() => {
    if (error) {
      toast.error(String(error));
    }

    if (success) {
      toast.success(String(success));
    }
  }, [error, success]);

  /* =======================================================
     HANDLERS
  ======================================================= */

  const handleLogout = useCallback(() => {
    setUserMenuOpen(false);
    dispatch(logoutUser());
  }, [dispatch]);

  const handleToggleSidebar = useCallback(() => {
    setCollapsed((value) => !value);
  }, []);

  const handleCloseMobile = useCallback(() => {
    setMobileOpen(false);
  }, []);

  const roleInfo = getRoleInfo(currentUser ?? null);

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="flex h-screen overflow-hidden bg-[#f7f8f7] text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      {/* ===================================================
          DESKTOP SIDEBAR
      =================================================== */}

      <div
        className="
          relative z-40 hidden shrink-0
          border-r border-gray-200/80 bg-white
          md:block
          dark:border-gray-800 dark:bg-gray-950
        "
      >
        <motion.div
          initial={false}
          animate={{
            width: collapsed ? 82 : 292,
          }}
          transition={{
            type: "spring",
            stiffness: 320,
            damping: 32,
          }}
          className="h-screen overflow-hidden"
        >
          <Sidebar
            items={filteredMenu}
            pathname={pathname}
            collapsed={collapsed}
            onClose={() => undefined}
            onCollapse={handleToggleSidebar}
            t={t}
            currentUser={currentUser ?? null}
          />
        </motion.div>
      </div>

      {/* ===================================================
          MOBILE BACKDROP
      =================================================== */}

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="
              fixed inset-0 z-50
              bg-black/50 backdrop-blur-[2px]
              md:hidden
            "
            onClick={handleCloseMobile}
          />
        )}
      </AnimatePresence>

      {/* ===================================================
          MOBILE SIDEBAR
      =================================================== */}

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{
              x: "-100%",
            }}
            animate={{
              x: 0,
            }}
            exit={{
              x: "-100%",
            }}
            transition={{
              type: "spring",
              stiffness: 320,
              damping: 32,
            }}
            className="
              fixed inset-y-0 left-0 z-[60]
              overflow-hidden
              border-r border-gray-200
              bg-white shadow-2xl
              dark:border-gray-800 dark:bg-gray-950
              md:hidden
            "
          >
            <Sidebar
              items={filteredMenu}
              pathname={pathname}
              collapsed={false}
              mobile
              onClose={handleCloseMobile}
              t={t}
              currentUser={currentUser ?? null}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===================================================
          MAIN APPLICATION
      =================================================== */}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* =================================================
            HEADER
        ================================================= */}

        <header
          className="
            sticky top-0 z-30 flex h-[72px]
            shrink-0 items-center justify-between
            border-b border-gray-200/80
            bg-white/90 px-4 backdrop-blur-xl
            md:px-6
            dark:border-gray-800
            dark:bg-gray-950/90
          "
        >
          {/* LEFT */}
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="
                rounded-xl p-2.5 text-gray-500
                transition hover:bg-gray-100
                hover:text-gray-900
                md:hidden
                dark:hover:bg-gray-800
                dark:hover:text-white
              "
              aria-label="Open navigation"
            >
              <Menu size={21} />
            </button>

            <div className="relative hidden w-full max-w-[420px] sm:block">
              <Search
                size={17}
                className="
                  pointer-events-none absolute left-3.5
                  top-1/2 -translate-y-1/2
                  text-gray-400
                "
              />

              <input
                ref={searchRef}
                type="search"
                placeholder={
                  t("search") || "Search anything..."
                }
                className="
                  h-10 w-full rounded-xl
                  border border-gray-200
                  bg-gray-50 pl-10 pr-16
                  text-sm outline-none
                  transition
                  placeholder:text-gray-400
                  focus:border-[#3aa838]/40
                  focus:bg-white
                  focus:ring-4
                  focus:ring-[#3aa838]/10
                  dark:border-gray-800
                  dark:bg-gray-900
                  dark:focus:bg-gray-900
                "
                aria-label="Global search"
              />

              <div
                className="
                  pointer-events-none absolute right-2
                  top-1/2 -translate-y-1/2
                  rounded-md border border-gray-200
                  bg-white px-1.5 py-0.5
                  text-[10px] font-medium text-gray-400
                  dark:border-gray-700
                  dark:bg-gray-800
                "
              >
                {typeof navigator !== "undefined" &&
                /Mac/i.test(navigator.platform)
                  ? "⌘ K"
                  : "Ctrl K"}
              </div>
            </div>

            <div className="sm:hidden">
              <div className="text-sm font-bold text-gray-900 dark:text-white">
                Antab Agro
              </div>
              <div className="text-[10px] text-gray-400">
                Enterprise ERP
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="flex items-center gap-1.5">
            {/* NOTIFICATIONS */}
            <div
              ref={notifRef}
              className="relative"
            >
              <button
                type="button"
                onClick={() => {
                  setNotifOpen((value) => !value);
                  setUserMenuOpen(false);
                }}
                className="
                  relative rounded-xl p-2.5
                  text-gray-500 transition
                  hover:bg-gray-100 hover:text-gray-900
                  dark:hover:bg-gray-800
                  dark:hover:text-white
                "
                aria-label="Notifications"
                aria-expanded={notifOpen}
              >
                <Bell size={19} />

                {unreadCount > 0 && (
                  <span
                    className="
                      absolute right-1.5 top-1.5
                      flex h-4 min-w-4 items-center
                      justify-center rounded-full
                      bg-red-500 px-1 text-[9px]
                      font-bold text-white
                      ring-2 ring-white
                      dark:ring-gray-950
                    "
                  >
                    {unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {notifOpen && (
                  <motion.div
                    initial={{
                      opacity: 0,
                      y: -8,
                      scale: 0.98,
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: 1,
                    }}
                    exit={{
                      opacity: 0,
                      y: -8,
                      scale: 0.98,
                    }}
                    transition={{
                      duration: 0.16,
                    }}
                    className="
                      absolute right-0 mt-3
                      w-[340px] max-w-[calc(100vw-24px)]
                      overflow-hidden rounded-2xl
                      border border-gray-200
                      bg-white shadow-2xl
                      dark:border-gray-800
                      dark:bg-gray-900
                    "
                  >
                    <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
                      <div>
                        <div className="text-sm font-bold">
                          Notifications
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {unreadCount} unread
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setNotifications((items) =>
                            items.map((item) => ({
                              ...item,
                              unread: false,
                            })),
                          )
                        }
                        className="
                          text-[11px] font-semibold
                          text-[#3aa838] hover:underline
                        "
                      >
                        Mark all read
                      </button>
                    </div>

                    <div className="max-h-[320px] overflow-y-auto">
                      {notifications.map(
                        (notification) => (
                          <div
                            key={notification.id}
                            className="
                              flex gap-3 border-b
                              border-gray-100 px-4 py-3
                              last:border-0
                              dark:border-gray-800
                            "
                          >
                            <div
                              className="
                                flex h-9 w-9 shrink-0
                                items-center justify-center
                                rounded-xl
                                bg-[#3aa838]/10
                                text-[#3aa838]
                              "
                            >
                              <Bell size={15} />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="truncate text-xs font-semibold">
                                {notification.title}
                              </div>

                              <div className="mt-1 flex items-center gap-2">
                                <span className="text-[10px] text-gray-400">
                                  {notification.time}
                                </span>

                                {notification.unread && (
                                  <span className="h-1.5 w-1.5 rounded-full bg-[#3aa838]" />
                                )}
                              </div>
                            </div>
                          </div>
                        ),
                      )}
                    </div>

                    <div className="border-t border-gray-100 p-2 dark:border-gray-800">
                      <Link
                        href="/notifications"
                        onClick={() =>
                          setNotifOpen(false)
                        }
                        className="
                          block rounded-xl py-2
                          text-center text-xs
                          font-semibold
                          text-[#3aa838]
                          transition hover:bg-[#3aa838]/5
                        "
                      >
                        View all notifications
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* LANGUAGE */}
            <div className="hidden sm:block">
              <LanguageSwitcher />
            </div>

            {/* THEME */}
            <button
              type="button"
              onClick={() => setDark((value) => !value)}
              className="
                rounded-xl p-2.5 text-gray-500
                transition hover:bg-gray-100
                hover:text-gray-900
                dark:hover:bg-gray-800
                dark:hover:text-white
              "
              aria-label="Toggle theme"
            >
              {dark ? (
                <Sun size={19} />
              ) : (
                <Moon size={19} />
              )}
            </button>

            {/* SETTINGS */}
            <Link
              href="/settings"
              className="
                hidden rounded-xl p-2.5 text-gray-500
                transition hover:bg-gray-100
                hover:text-gray-900
                sm:block
                dark:hover:bg-gray-800
                dark:hover:text-white
              "
              aria-label="Settings"
            >
              <Settings size={19} />
            </Link>

            {/* USER */}
            <div
              ref={userMenuRef}
              className="relative ml-1"
            >
              <button
                type="button"
                onClick={() => {
                  setUserMenuOpen(
                    (value) => !value,
                  );
                  setNotifOpen(false);
                }}
                className="
                  flex items-center gap-2
                  rounded-xl border
                  border-gray-200 bg-gray-50
                  px-2 py-1.5
                  transition hover:bg-gray-100
                  dark:border-gray-800
                  dark:bg-gray-900
                  dark:hover:bg-gray-800
                "
                aria-expanded={userMenuOpen}
              >
                <div
                  className="
                    flex h-8 w-8 items-center
                    justify-center rounded-lg
                    bg-[#3aa838]/10
                    text-[#3aa838]
                  "
                >
                  <UserIcon size={17} />
                </div>

                <div className="hidden max-w-[110px] text-left lg:block">
                  <div className="truncate text-xs font-semibold">
                    {currentUser?.name || "User"}
                  </div>

                  <div className="truncate text-[9px] text-gray-400">
                    {roleInfo.name || "ERP User"}
                  </div>
                </div>

                <ChevronDown
                  size={14}
                  className={classNames(
                    "hidden text-gray-400 transition-transform lg:block",
                    userMenuOpen
                      ? "rotate-180"
                      : "",
                  )}
                />
              </button>

              <AnimatePresence>
                {userMenuOpen && (
                  <motion.div
                    initial={{
                      opacity: 0,
                      y: -8,
                      scale: 0.98,
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: 1,
                    }}
                    exit={{
                      opacity: 0,
                      y: -8,
                      scale: 0.98,
                    }}
                    className="
                      absolute right-0 mt-3 w-60
                      overflow-hidden rounded-2xl
                      border border-gray-200
                      bg-white shadow-2xl
                      dark:border-gray-800
                      dark:bg-gray-900
                    "
                  >
                    <div className="border-b border-gray-100 px-4 py-4 dark:border-gray-800">
                      <div className="flex items-center gap-3">
                        <div
                          className="
                            flex h-10 w-10
                            items-center justify-center
                            rounded-xl bg-[#3aa838]
                            text-white
                          "
                        >
                          <UserIcon size={18} />
                        </div>

                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold">
                            {currentUser?.name ||
                              "User"}
                          </div>

                          <div className="truncate text-[10px] text-gray-400">
                            {roleInfo.name ||
                              "ERP User"}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-2">
                      <Link
                        href="/profile"
                        onClick={() =>
                          setUserMenuOpen(false)
                        }
                        className="
                          flex items-center gap-3
                          rounded-xl px-3 py-2.5
                          text-xs font-medium
                          text-gray-600
                          transition hover:bg-gray-100
                          dark:text-gray-300
                          dark:hover:bg-gray-800
                        "
                      >
                        <UserRound size={16} />
                        Profile
                      </Link>

                      <Link
                        href="/profile/settings"
                        onClick={() =>
                          setUserMenuOpen(false)
                        }
                        className="
                          flex items-center gap-3
                          rounded-xl px-3 py-2.5
                          text-xs font-medium
                          text-gray-600
                          transition hover:bg-gray-100
                          dark:text-gray-300
                          dark:hover:bg-gray-800
                        "
                      >
                        <Settings size={16} />
                        Account Settings
                      </Link>

                      <button
                        type="button"
                        onClick={handleLogout}
                        className="
                          flex w-full items-center gap-3
                          rounded-xl px-3 py-2.5
                          text-left text-xs font-medium
                          text-red-500
                          transition hover:bg-red-50
                          dark:hover:bg-red-950/30
                        "
                      >
                        <LogOut size={16} />
                        {t("logout") || "Logout"}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* =================================================
            CONTENT
        ================================================= */}

        <main className="min-h-0 flex-1 overflow-y-auto bg-[#f7f8f7] dark:bg-gray-950">
          <div className="min-h-full p-4 md:p-6">
            {children}
          </div>
        </main>

        {/* =================================================
            FOOTER
        ================================================= */}

        <footer
          className="
            hidden shrink-0 items-center
            justify-between border-t
            border-gray-200/80
            bg-white px-6 py-3
            text-[10px] text-gray-400
            md:flex
            dark:border-gray-800
            dark:bg-gray-950
          "
        >
          <span>
            © {new Date().getFullYear()} Antab Agro
          </span>

          <div className="flex items-center gap-3">
            <Link
              href="/terms"
              className="hover:text-[#3aa838]"
            >
              Terms
            </Link>

            <span>•</span>

            <Link
              href="/privacy"
              className="hover:text-[#3aa838]"
            >
              Privacy
            </Link>

            <span>•</span>

            <span>Antab ERP v1.0.0</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* =========================================================
   SMALL ICON HELPERS
   These keep the main menu definition readable.
========================================================= */

function FactoryIcon() {
  return (
    <Building2
      size={17}
      strokeWidth={1.8}
    />
  );
}

function MapIcon() {
  return (
    <Globe2
      size={16}
      strokeWidth={1.8}
    />
  );
}

function NavigationIcon() {
  return (
    <Target
      size={16}
      strokeWidth={1.8}
    />
  );
}

function TrendingUpIcon() {
  return (
    <BarChart3
      size={15}
      strokeWidth={1.8}
    />
  );
}