"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  Download,
  Filter,
  Calendar,
  ChevronDown,
  ChevronUp,
  FileText,
  Receipt,
  CreditCard,
  Building,
  User,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  MoreVertical,
  Eye,
  FileEdit,
  Trash2,
  RefreshCw,
  Printer,
  Mail,
  TrendingUp,
  TrendingDown,
  Plus,
  Minus,
  CheckCircle,
  XCircle,
  Clock,
  BarChart3,
  Calculator,
  FileSpreadsheet,
  Users,
  Package,
  Home,
  Car,
  Wifi,
  Smartphone,
  Coffee,
  BookOpen,
  FileCheck,
  Upload,
  Link,
  Copy,
  Share2,
  Bell,
  Settings,
  HelpCircle,
  Database,
  PieChart,
  LineChart,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateRange } from "react-day-picker";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format, subMonths, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";

// ==================== TYPES ====================
interface Account {
  id: string;
  code: string;
  name: string;
  type:
    | "Asset"
    | "Liability"
    | "Equity"
    | "Revenue"
    | "Expense"
    | "Cost of Sales";
  category: string;
  subcategory?: string;
  balance: number;
  currency: string;
  description?: string;
  taxCode?: string;
  isTaxable: boolean;
  allowPosting: boolean;
  parentId?: string;
  level: number;
}

interface Contact {
  id: string;
  name: string;
  type: "Customer" | "Vendor" | "Employee" | "Bank" | "Government";
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  creditLimit?: number;
  paymentTerms?: string;
}

interface JournalEntry {
  id: string;
  entryNumber: string;
  date: Date;
  description: string;
  reference: string;
  status: "Posted" | "Draft" | "Void" | "Approved" | "Rejected";
  createdBy: string;
  createdAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
  reversalOf?: string;
  attachmentCount: number;
  notes?: string;
}

interface LedgerTransaction {
  id: string;
  entryId: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  date: Date;
  description: string;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
  journalEntry: JournalEntry;
  type:
    | "Invoice"
    | "Payment"
    | "Journal"
    | "Adjustment"
    | "Expense"
    | "Receipt"
    | "Purchase"
    | "Payroll"
    | "Depreciation"
    | "Tax"
    | "Refund"
    | "Transfer";
  contactId?: string;
  contactName?: string;
  contactType?: Contact["type"];
  projectCode?: string;
  department?: string;
  costCenter?: string;
  taxAmount?: number;
  taxRate?: number;
  currency: string;
  exchangeRate?: number;
  reconciled: boolean;
  reconciledDate?: Date;
  attachments?: string[];
}

interface LedgerSummary {
  account: Account;
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  transactionCount: number;
  avgTransaction: number;
  largestDebit: number;
  largestCredit: number;
  debitCount: number;
  creditCount: number;
  monthlyTrend: { month: string; amount: number }[];
}

interface Reconciliation {
  id: string;
  accountId: string;
  statementDate: Date;
  statementBalance: number;
  bookBalance: number;
  difference: number;
  status: "Pending" | "In Progress" | "Completed" | "Discrepancy";
  reconciledBy?: string;
  reconciledAt?: Date;
}

// ==================== SAMPLE DATA ====================

// Realistic Accounts for a Manufacturing Company
const sampleAccounts: Account[] = [
  // Assets
  {
    id: "acc-1000",
    code: "1000",
    name: "Current Assets",
    type: "Asset",
    category: "Assets",
    subcategory: "Current",
    balance: 0,
    currency: "USD",
    isTaxable: false,
    allowPosting: false,
    level: 1,
  },
  {
    id: "acc-1010",
    code: "1010",
    name: "Petty Cash",
    type: "Asset",
    category: "Assets",
    subcategory: "Current",
    balance: 500.0,
    currency: "USD",
    isTaxable: false,
    allowPosting: true,
    parentId: "acc-1000",
    level: 2,
  },
  {
    id: "acc-1020",
    code: "1020",
    name: "Bank - Chase Checking",
    type: "Asset",
    category: "Assets",
    subcategory: "Current",
    balance: 245678.45,
    currency: "USD",
    description: "Primary operating account",
    isTaxable: false,
    allowPosting: true,
    parentId: "acc-1000",
    level: 2,
  },
  {
    id: "acc-1030",
    code: "1030",
    name: "Bank - Wells Fargo Savings",
    type: "Asset",
    category: "Assets",
    subcategory: "Current",
    balance: 150000.0,
    currency: "USD",
    description: "Emergency fund account",
    isTaxable: false,
    allowPosting: true,
    parentId: "acc-1000",
    level: 2,
  },
  {
    id: "acc-1040",
    code: "1040",
    name: "Accounts Receivable",
    type: "Asset",
    category: "Assets",
    subcategory: "Current",
    balance: 189456.78,
    currency: "USD",
    description: "Trade receivables from customers",
    isTaxable: false,
    allowPosting: true,
    parentId: "acc-1000",
    level: 2,
  },
  {
    id: "acc-1050",
    code: "1050",
    name: "Allowance for Doubtful Accounts",
    type: "Asset",
    category: "Assets",
    subcategory: "Current",
    balance: -4500.0,
    currency: "USD",
    isTaxable: false,
    allowPosting: true,
    parentId: "acc-1000",
    level: 2,
  },
  {
    id: "acc-1060",
    code: "1060",
    name: "Inventory - Raw Materials",
    type: "Asset",
    category: "Assets",
    subcategory: "Current",
    balance: 156789.32,
    currency: "USD",
    description: "Steel, plastic, electronic components",
    isTaxable: true,
    allowPosting: true,
    parentId: "acc-1000",
    level: 2,
  },
  {
    id: "acc-1070",
    code: "1070",
    name: "Inventory - Finished Goods",
    type: "Asset",
    category: "Assets",
    subcategory: "Current",
    balance: 234567.89,
    currency: "USD",
    description: "Completed products ready for sale",
    isTaxable: true,
    allowPosting: true,
    parentId: "acc-1000",
    level: 2,
  },
  {
    id: "acc-1080",
    code: "1080",
    name: "Prepaid Expenses",
    type: "Asset",
    category: "Assets",
    subcategory: "Current",
    balance: 12500.0,
    currency: "USD",
    description: "Insurance, rent, subscriptions paid in advance",
    isTaxable: false,
    allowPosting: true,
    parentId: "acc-1000",
    level: 2,
  },

  // Fixed Assets
  {
    id: "acc-1500",
    code: "1500",
    name: "Fixed Assets",
    type: "Asset",
    category: "Assets",
    subcategory: "Fixed",
    balance: 0,
    currency: "USD",
    isTaxable: false,
    allowPosting: false,
    level: 1,
  },
  {
    id: "acc-1510",
    code: "1510",
    name: "Machinery & Equipment",
    type: "Asset",
    category: "Assets",
    subcategory: "Fixed",
    balance: 456789.0,
    currency: "USD",
    description: "Production machinery and tools",
    isTaxable: true,
    allowPosting: true,
    parentId: "acc-1500",
    level: 2,
  },
  {
    id: "acc-1520",
    code: "1520",
    name: "Office Equipment",
    type: "Asset",
    category: "Assets",
    subcategory: "Fixed",
    balance: 78900.0,
    currency: "USD",
    description: "Computers, printers, furniture",
    isTaxable: true,
    allowPosting: true,
    parentId: "acc-1500",
    level: 2,
  },
  {
    id: "acc-1530",
    code: "1530",
    name: "Vehicles",
    type: "Asset",
    category: "Assets",
    subcategory: "Fixed",
    balance: 125000.0,
    currency: "USD",
    description: "Company vehicles",
    isTaxable: true,
    allowPosting: true,
    parentId: "acc-1500",
    level: 2,
  },
  {
    id: "acc-1540",
    code: "1540",
    name: "Accumulated Depreciation",
    type: "Asset",
    category: "Assets",
    subcategory: "Fixed",
    balance: -156789.0,
    currency: "USD",
    isTaxable: false,
    allowPosting: true,
    parentId: "acc-1500",
    level: 2,
  },

  // Liabilities
  {
    id: "acc-2000",
    code: "2000",
    name: "Current Liabilities",
    type: "Liability",
    category: "Liabilities",
    subcategory: "Current",
    balance: 0,
    currency: "USD",
    isTaxable: false,
    allowPosting: false,
    level: 1,
  },
  {
    id: "acc-2010",
    code: "2010",
    name: "Accounts Payable",
    type: "Liability",
    category: "Liabilities",
    subcategory: "Current",
    balance: 123456.78,
    currency: "USD",
    description: "Trade payables to suppliers",
    isTaxable: false,
    allowPosting: true,
    parentId: "acc-2000",
    level: 2,
  },
  {
    id: "acc-2020",
    code: "2020",
    name: "Sales Tax Payable",
    type: "Liability",
    category: "Liabilities",
    subcategory: "Current",
    balance: 23456.9,
    currency: "USD",
    description: "Sales tax collected from customers",
    isTaxable: false,
    allowPosting: true,
    parentId: "acc-2000",
    level: 2,
  },
  {
    id: "acc-2030",
    code: "2030",
    name: "Accrued Expenses",
    type: "Liability",
    category: "Liabilities",
    subcategory: "Current",
    balance: 45678.12,
    currency: "USD",
    description: "Accrued salaries, utilities, interest",
    isTaxable: false,
    allowPosting: true,
    parentId: "acc-2000",
    level: 2,
  },
  {
    id: "acc-2040",
    code: "2040",
    name: "Short-term Loans",
    type: "Liability",
    category: "Liabilities",
    subcategory: "Current",
    balance: 75000.0,
    currency: "USD",
    description: "Bank loan due within 12 months",
    isTaxable: false,
    allowPosting: true,
    parentId: "acc-2000",
    level: 2,
  },
  {
    id: "acc-2050",
    code: "2050",
    name: "Unearned Revenue",
    type: "Liability",
    category: "Liabilities",
    subcategory: "Current",
    balance: 34567.89,
    currency: "USD",
    description: "Payments received in advance",
    isTaxable: false,
    allowPosting: true,
    parentId: "acc-2000",
    level: 2,
  },

  // Equity
  {
    id: "acc-3000",
    code: "3000",
    name: "Equity",
    type: "Equity",
    category: "Equity",
    balance: 0,
    currency: "USD",
    isTaxable: false,
    allowPosting: false,
    level: 1,
  },
  {
    id: "acc-3010",
    code: "3010",
    name: "Common Stock",
    type: "Equity",
    category: "Equity",
    balance: 500000.0,
    currency: "USD",
    description: "Issued common shares",
    isTaxable: false,
    allowPosting: true,
    parentId: "acc-3000",
    level: 2,
  },
  {
    id: "acc-3020",
    code: "3020",
    name: "Retained Earnings",
    type: "Equity",
    category: "Equity",
    balance: 456789.12,
    currency: "USD",
    description: "Accumulated profits",
    isTaxable: false,
    allowPosting: true,
    parentId: "acc-3000",
    level: 2,
  },
  {
    id: "acc-3030",
    code: "3030",
    name: "Current Year Earnings",
    type: "Equity",
    category: "Equity",
    balance: 123456.78,
    currency: "USD",
    description: "Current year profit/loss",
    isTaxable: false,
    allowPosting: true,
    parentId: "acc-3000",
    level: 2,
  },

  // Revenue
  {
    id: "acc-4000",
    code: "4000",
    name: "Revenue",
    type: "Revenue",
    category: "Revenue",
    balance: 0,
    currency: "USD",
    isTaxable: false,
    allowPosting: false,
    level: 1,
  },
  {
    id: "acc-4010",
    code: "4010",
    name: "Product Sales",
    type: "Revenue",
    category: "Revenue",
    balance: 2456789.45,
    currency: "USD",
    description: "Revenue from product sales",
    taxCode: "SALES",
    isTaxable: true,
    allowPosting: true,
    parentId: "acc-4000",
    level: 2,
  },
  {
    id: "acc-4020",
    code: "4020",
    name: "Service Revenue",
    type: "Revenue",
    category: "Revenue",
    balance: 345678.9,
    currency: "USD",
    description: "Revenue from consulting services",
    taxCode: "SALES",
    isTaxable: true,
    allowPosting: true,
    parentId: "acc-4000",
    level: 2,
  },
  {
    id: "acc-4030",
    code: "4030",
    name: "Interest Income",
    type: "Revenue",
    category: "Revenue",
    balance: 5678.9,
    currency: "USD",
    description: "Bank interest income",
    isTaxable: true,
    allowPosting: true,
    parentId: "acc-4000",
    level: 2,
  },
  {
    id: "acc-4040",
    code: "4040",
    name: "Discounts Given",
    type: "Revenue",
    category: "Revenue",
    balance: -23456.78,
    currency: "USD",
    description: "Sales discounts to customers",
    isTaxable: false,
    allowPosting: true,
    parentId: "acc-4000",
    level: 2,
  },

  // Cost of Sales
  {
    id: "acc-5000",
    code: "5000",
    name: "Cost of Goods Sold",
    type: "Cost of Sales",
    category: "Cost of Sales",
    balance: 0,
    currency: "USD",
    isTaxable: false,
    allowPosting: false,
    level: 1,
  },
  {
    id: "acc-5010",
    code: "5010",
    name: "Raw Materials Cost",
    type: "Cost of Sales",
    category: "Cost of Sales",
    balance: 1456789.0,
    currency: "USD",
    description: "Cost of raw materials used",
    isTaxable: false,
    allowPosting: true,
    parentId: "acc-5000",
    level: 2,
  },
  {
    id: "acc-5020",
    code: "5020",
    name: "Direct Labor",
    type: "Cost of Sales",
    category: "Cost of Sales",
    balance: 456789.45,
    currency: "USD",
    description: "Direct manufacturing labor",
    isTaxable: false,
    allowPosting: true,
    parentId: "acc-5000",
    level: 2,
  },
  {
    id: "acc-5030",
    code: "5030",
    name: "Manufacturing Overhead",
    type: "Cost of Sales",
    category: "Cost of Sales",
    balance: 234567.89,
    currency: "USD",
    description: "Factory utilities, maintenance, depreciation",
    isTaxable: false,
    allowPosting: true,
    parentId: "acc-5000",
    level: 2,
  },

  // Expenses
  {
    id: "acc-6000",
    code: "6000",
    name: "Operating Expenses",
    type: "Expense",
    category: "Expenses",
    balance: 0,
    currency: "USD",
    isTaxable: false,
    allowPosting: false,
    level: 1,
  },
  {
    id: "acc-6010",
    code: "6010",
    name: "Salaries & Wages",
    type: "Expense",
    category: "Expenses",
    balance: 789012.34,
    currency: "USD",
    description: "Administrative salaries",
    isTaxable: false,
    allowPosting: true,
    parentId: "acc-6000",
    level: 2,
  },
  {
    id: "acc-6020",
    code: "6020",
    name: "Rent Expense",
    type: "Expense",
    category: "Expenses",
    balance: 120000.0,
    currency: "USD",
    description: "Office and warehouse rent",
    isTaxable: false,
    allowPosting: true,
    parentId: "acc-6000",
    level: 2,
  },
  {
    id: "acc-6030",
    code: "6030",
    name: "Utilities",
    type: "Expense",
    category: "Expenses",
    balance: 45678.9,
    currency: "USD",
    description: "Electricity, water, gas, internet",
    isTaxable: false,
    allowPosting: true,
    parentId: "acc-6000",
    level: 2,
  },
  {
    id: "acc-6040",
    code: "6040",
    name: "Marketing & Advertising",
    type: "Expense",
    category: "Expenses",
    balance: 123456.78,
    currency: "USD",
    description: "Digital ads, trade shows, promotions",
    isTaxable: false,
    allowPosting: true,
    parentId: "acc-6000",
    level: 2,
  },
  {
    id: "acc-6050",
    code: "6050",
    name: "Professional Fees",
    type: "Expense",
    category: "Expenses",
    balance: 56789.01,
    currency: "USD",
    description: "Legal, accounting, consulting fees",
    isTaxable: false,
    allowPosting: true,
    parentId: "acc-6000",
    level: 2,
  },
  {
    id: "acc-6060",
    code: "6060",
    name: "Travel & Entertainment",
    type: "Expense",
    category: "Expenses",
    balance: 23456.78,
    currency: "USD",
    description: "Business travel, client meals",
    isTaxable: false,
    allowPosting: true,
    parentId: "acc-6000",
    level: 2,
  },
  {
    id: "acc-6070",
    code: "6070",
    name: "Insurance",
    type: "Expense",
    category: "Expenses",
    balance: 34567.89,
    currency: "USD",
    description: "Business insurance premiums",
    isTaxable: false,
    allowPosting: true,
    parentId: "acc-6000",
    level: 2,
  },
  {
    id: "acc-6080",
    code: "6080",
    name: "Depreciation Expense",
    type: "Expense",
    category: "Expenses",
    balance: 45678.9,
    currency: "USD",
    description: "Depreciation of fixed assets",
    isTaxable: false,
    allowPosting: true,
    parentId: "acc-6000",
    level: 2,
  },
  {
    id: "acc-6090",
    code: "6090",
    name: "Bank Charges",
    type: "Expense",
    category: "Expenses",
    balance: 1234.56,
    currency: "USD",
    description: "Bank fees and service charges",
    isTaxable: false,
    allowPosting: true,
    parentId: "acc-6000",
    level: 2,
  },
  {
    id: "acc-6100",
    code: "6100",
    name: "Office Supplies",
    type: "Expense",
    category: "Expenses",
    balance: 7890.12,
    currency: "USD",
    description: "Stationery, printer ink, etc.",
    isTaxable: false,
    allowPosting: true,
    parentId: "acc-6000",
    level: 2,
  },
  {
    id: "acc-6110",
    code: "6110",
    name: "Software & Subscriptions",
    type: "Expense",
    category: "Expenses",
    balance: 23456.78,
    currency: "USD",
    description: "SaaS subscriptions, software licenses",
    isTaxable: false,
    allowPosting: true,
    parentId: "acc-6000",
    level: 2,
  },
  {
    id: "acc-6120",
    code: "6120",
    name: "Repairs & Maintenance",
    type: "Expense",
    category: "Expenses",
    balance: 34567.89,
    currency: "USD",
    description: "Equipment and facility maintenance",
    isTaxable: false,
    allowPosting: true,
    parentId: "acc-6000",
    level: 2,
  },
  {
    id: "acc-6130",
    code: "6130",
    name: "Training & Development",
    type: "Expense",
    category: "Expenses",
    balance: 12345.67,
    currency: "USD",
    description: "Employee training programs",
    isTaxable: false,
    allowPosting: true,
    parentId: "acc-6000",
    level: 2,
  },
  {
    id: "acc-6140",
    code: "6140",
    name: "Charitable Donations",
    type: "Expense",
    category: "Expenses",
    balance: 5000.0,
    currency: "USD",
    description: "Corporate donations",
    isTaxable: false,
    allowPosting: true,
    parentId: "acc-6000",
    level: 2,
  },
  {
    id: "acc-6150",
    code: "6150",
    name: "Taxes & Licenses",
    type: "Expense",
    category: "Expenses",
    balance: 45678.9,
    currency: "USD",
    description: "Business licenses, property taxes",
    isTaxable: false,
    allowPosting: true,
    parentId: "acc-6000",
    level: 2,
  },
];

// Contacts
const sampleContacts: Contact[] = [
  {
    id: "c-001",
    name: "TechCorp Inc",
    type: "Customer",
    email: "billing@techcorp.com",
    phone: "(555) 123-4567",
    address: "123 Tech Blvd, San Jose, CA",
    taxId: "12-3456789",
    creditLimit: 100000,
    paymentTerms: "Net 30",
  },
  {
    id: "c-002",
    name: "Global Solutions Ltd",
    type: "Customer",
    email: "accounts@globalsolutions.com",
    phone: "(555) 987-6543",
    address: "456 Global Ave, New York, NY",
    taxId: "98-7654321",
    creditLimit: 250000,
    paymentTerms: "Net 45",
  },
  {
    id: "c-003",
    name: "MegaStore Retail",
    type: "Customer",
    email: "ap@megastore.com",
    phone: "(555) 456-7890",
    address: "789 Retail Park, Chicago, IL",
    taxId: "45-6789012",
    creditLimit: 500000,
    paymentTerms: "Net 60",
  },
  {
    id: "c-004",
    name: "ABC Manufacturing",
    type: "Customer",
    email: "finance@abcmfg.com",
    phone: "(555) 234-5678",
    address: "321 Industrial Way, Detroit, MI",
    taxId: "23-4567890",
    creditLimit: 150000,
    paymentTerms: "Net 30",
  },
  {
    id: "v-001",
    name: "Steel Suppliers Inc",
    type: "Vendor",
    email: "sales@steelsuppliers.com",
    phone: "(555) 876-5432",
    address: "654 Steel Rd, Pittsburgh, PA",
    taxId: "87-6543210",
    paymentTerms: "2/10 Net 30",
  },
  {
    id: "v-002",
    name: "Electronic Components Co",
    type: "Vendor",
    email: "orders@ecomponents.com",
    phone: "(555) 345-6789",
    address: "987 Circuit Ave, Austin, TX",
    taxId: "34-5678901",
    paymentTerms: "Net 30",
  },
  {
    id: "v-003",
    name: "Office Supplies Ltd",
    type: "Vendor",
    email: "billing@officesupplies.com",
    phone: "(555) 765-4321",
    address: "456 Paper St, Seattle, WA",
    taxId: "76-5432109",
    paymentTerms: "Net 15",
  },
  {
    id: "v-004",
    name: "Power & Water Corp",
    type: "Vendor",
    email: "utilities@powerwater.com",
    phone: "(555) 210-9876",
    address: "789 Energy Plaza, Houston, TX",
    taxId: "21-0987654",
    paymentTerms: "Due on receipt",
  },
  {
    id: "e-001",
    name: "John Smith (CEO)",
    type: "Employee",
    email: "john@company.com",
    phone: "(555) 111-2222",
    address: "100 Executive Dr, Anytown, USA",
    taxId: "123-45-6789",
  },
  {
    id: "e-002",
    name: "Sarah Johnson (CFO)",
    type: "Employee",
    email: "sarah@company.com",
    phone: "(555) 333-4444",
    address: "200 Finance Ave, Anytown, USA",
    taxId: "234-56-7890",
  },
  {
    id: "b-001",
    name: "Chase Bank",
    type: "Bank",
    email: "business@chase.com",
    phone: "(800) 935-9935",
    address: "270 Park Ave, New York, NY",
    taxId: "13-1234567",
  },
  {
    id: "g-001",
    name: "IRS",
    type: "Government",
    email: "irs.gov",
    phone: "(800) 829-1040",
    address: "Internal Revenue Service, Washington DC",
    taxId: "00-0000000",
  },
];

// Generate comprehensive sample transactions for ALL accounts
const generateCompleteSampleTransactions = (): LedgerTransaction[] => {
  const transactions: LedgerTransaction[] = [];
  const startDate = new Date(2024, 0, 1); // Jan 1, 2024
  let transactionId = 1;

  // Define running balances for major accounts
  const accountBalances: Record<string, number> = {
    "acc-1020": 245678.45, // Chase Checking
    "acc-1040": 189456.78, // Accounts Receivable
    "acc-2010": 123456.78, // Accounts Payable
    "acc-4010": 2456789.45, // Product Sales
    "acc-5010": 1456789.0, // Raw Materials Cost
    "acc-6010": 789012.34, // Salaries
  };

  // Generate 150+ realistic transactions for Q1 2024
  for (let day = 1; day <= 90; day++) {
    // January to March
    const currentDate = addDays(startDate, day - 1);

    // Skip weekends for most transactions (but not all)
    const dayOfWeek = currentDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Generate 2-5 transactions per weekday, 0-2 on weekends
    const transactionsToday = isWeekend
      ? Math.floor(Math.random() * 3)
      : 2 + Math.floor(Math.random() * 4);

    for (let i = 0; i < transactionsToday; i++) {
      transactionId++;

      // Determine transaction type based on day of month
      let type: LedgerTransaction["type"];
      let accountId: string;
      let contactId: string;
      let amount: number;
      let isDebit: boolean;
      let description: string;
      let reference: string;
      let projectCode: string | undefined;
      let department: string | undefined;
      let costCenter: string | undefined;

      // Transaction type probabilities
      const rand = Math.random();

      if (day % 30 === 0) {
        // Month-end transactions
        type = "Payroll";
        accountId = "acc-6010";
        contactId = "e-001";
        amount = 25000 + Math.random() * 50000;
        isDebit = true;
        description = "Monthly payroll processing";
        reference = `PAYROLL-${currentDate.getMonth() + 1}`;
        department = "HR";
      } else if (day % 7 === 0) {
        // Weekly transactions
        type = "Payment";
        accountId = Math.random() > 0.5 ? "acc-1020" : "acc-2010";
        contactId = Math.random() > 0.5 ? "v-001" : "v-002";
        amount = 5000 + Math.random() * 20000;
        isDebit = accountId === "acc-1020";
        description = "Vendor payment";
        reference = `PAY-${String(transactionId).padStart(5, "0")}`;
      } else if (rand < 0.3) {
        // Sales invoice (30% chance)
        type = "Invoice";
        accountId = "acc-1040";
        contactId = sampleContacts.filter((c) => c.type === "Customer")[
          Math.floor(Math.random() * 4)
        ].id;
        amount = 10000 + Math.random() * 50000;
        isDebit = true;
        description = "Sales invoice for products";
        reference = `INV-${String(1000 + (transactionId % 900)).padStart(
          4,
          "0"
        )}`;
        projectCode = ["PROJ-A", "PROJ-B", "PROJ-C"][
          Math.floor(Math.random() * 3)
        ];
      } else if (rand < 0.5) {
        // Customer payment (20% chance)
        type = "Receipt";
        accountId = "acc-1020";
        contactId = sampleContacts.filter((c) => c.type === "Customer")[
          Math.floor(Math.random() * 4)
        ].id;
        amount = 8000 + Math.random() * 40000;
        isDebit = true;
        description = "Customer payment received";
        reference = `RCT-${String(transactionId).padStart(5, "0")}`;
      } else if (rand < 0.65) {
        // Expense (15% chance)
        type = "Expense";
        const expenseAccounts = [
          "acc-6030",
          "acc-6040",
          "acc-6050",
          "acc-6060",
          "acc-6100",
          "acc-6110",
        ];
        accountId =
          expenseAccounts[Math.floor(Math.random() * expenseAccounts.length)];
        contactId = sampleContacts.filter((c) => c.type === "Vendor")[
          Math.floor(Math.random() * 4)
        ].id;
        amount = 500 + Math.random() * 5000;
        isDebit = true;
        description = [
          "Utility bill",
          "Marketing expense",
          "Professional fee",
          "Travel expense",
          "Office supplies",
          "Software subscription",
        ][expenseAccounts.indexOf(accountId) % 6];
        reference = `EXP-${String(transactionId).padStart(5, "0")}`;
        costCenter = ["CC-100", "CC-200", "CC-300"][
          Math.floor(Math.random() * 3)
        ];
      } else if (rand < 0.75) {
        // Purchase (10% chance)
        type = "Purchase";
        accountId = "acc-2010";
        contactId = sampleContacts.filter((c) => c.type === "Vendor")[
          Math.floor(Math.random() * 4)
        ].id;
        amount = 3000 + Math.random() * 15000;
        isDebit = false;
        description = "Inventory purchase";
        reference = `PO-${String(transactionId).padStart(5, "0")}`;
      } else if (rand < 0.85) {
        // Journal entry (10% chance)
        type = "Journal";
        accountId = Math.random() > 0.5 ? "acc-1020" : "acc-1040";
        amount = 1000 + Math.random() * 10000;
        isDebit = Math.random() > 0.5;
        description = "Adjusting journal entry";
        reference = `JE-${String(transactionId).padStart(5, "0")}`;
      } else if (rand < 0.92) {
        // Transfer (7% chance)
        type = "Transfer";
        accountId = "acc-1020";
        amount = 5000 + Math.random() * 20000;
        isDebit = Math.random() > 0.5;
        description = "Bank transfer";
        reference = `TRF-${String(transactionId).padStart(5, "0")}`;
      } else {
        // Tax or other (8% chance)
        type = "Tax";
        accountId = "acc-2020";
        amount = 1000 + Math.random() * 5000;
        isDebit = false;
        description = "Sales tax accrual";
        reference = `TAX-${String(transactionId).padStart(5, "0")}`;
      }

      // Get account info
      const account = sampleAccounts.find((a) => a.id === accountId)!;
      const contact = sampleContacts.find((c) => c.id === contactId);

      // Update running balance
      if (!accountBalances[accountId])
        accountBalances[accountId] = account.balance;
      if (isDebit) {
        accountBalances[accountId] += amount;
      } else {
        accountBalances[accountId] -= amount;
      }

      // Generate journal entry
      const journalEntry: JournalEntry = {
        id: `je-${transactionId}`,
        entryNumber: `JE-2024-${String(transactionId).padStart(5, "0")}`,
        date: currentDate,
        description,
        reference,
        status:
          Math.random() > 0.9
            ? "Draft"
            : Math.random() > 0.95
            ? "Approved"
            : "Posted",
        createdBy: ["John Smith", "Sarah Johnson", "System", "Jane Doe"][
          Math.floor(Math.random() * 4)
        ],
        createdAt: currentDate,
        approvedBy: Math.random() > 0.7 ? "Sarah Johnson" : undefined,
        approvedAt: Math.random() > 0.7 ? addDays(currentDate, 1) : undefined,
        attachmentCount: Math.floor(Math.random() * 3),
        notes: Math.random() > 0.8 ? "Requires review" : undefined,
      };

      // Create transaction
      const transaction: LedgerTransaction = {
        id: `tx-${transactionId}`,
        entryId: journalEntry.id,
        accountId,
        accountCode: account.code,
        accountName: account.name,
        date: currentDate,
        description,
        reference,
        debit: isDebit ? amount : 0,
        credit: isDebit ? 0 : amount,
        balance: accountBalances[accountId],
        journalEntry,
        type,
        contactId: contact?.id,
        contactName: contact?.name,
        contactType: contact?.type,
        projectCode,
        department,
        costCenter,
        taxAmount: type === "Invoice" ? amount * 0.08 : 0,
        taxRate: type === "Invoice" ? 8.0 : undefined,
        currency: "USD",
        exchangeRate: 1.0,
        reconciled: Math.random() > 0.7,
        reconciledDate:
          Math.random() > 0.7
            ? addDays(currentDate, Math.floor(Math.random() * 7))
            : undefined,
        attachments:
          Math.random() > 0.8 ? ["invoice.pdf", "receipt.jpg"] : undefined,
      };

      transactions.push(transaction);
    }
  }

  return transactions;
};

// Generate all transactions
const allTransactions = generateCompleteSampleTransactions();

// ==================== UTILITY FUNCTIONS ====================

function getTransactionTypeConfig(type: LedgerTransaction["type"]) {
  const configs = {
    Invoice: {
      color: "bg-green-50 dark:bg-green-950/30 border-l-4 border-l-green-500",
      badge:
        "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300",
      icon: FileText,
      label: "Invoice",
    },
    Payment: {
      color: "bg-blue-50 dark:bg-blue-950/30 border-l-4 border-l-blue-500",
      badge: "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300",
      icon: CreditCard,
      label: "Payment",
    },
    Journal: {
      color:
        "bg-purple-50 dark:bg-purple-950/30 border-l-4 border-l-purple-500",
      badge:
        "bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300",
      icon: FileEdit,
      label: "Journal",
    },
    Adjustment: {
      color: "bg-amber-50 dark:bg-amber-950/30 border-l-4 border-l-amber-500",
      badge:
        "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300",
      icon: RefreshCw,
      label: "Adjustment",
    },
    Expense: {
      color: "bg-red-50 dark:bg-red-950/30 border-l-4 border-l-red-500",
      badge: "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300",
      icon: DollarSign,
      label: "Expense",
    },
    Receipt: {
      color:
        "bg-emerald-50 dark:bg-emerald-950/30 border-l-4 border-l-emerald-500",
      badge:
        "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300",
      icon: CheckCircle,
      label: "Receipt",
    },
    Purchase: {
      color:
        "bg-indigo-50 dark:bg-indigo-950/30 border-l-4 border-l-indigo-500",
      badge:
        "bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300",
      icon: Package,
      label: "Purchase",
    },
    Payroll: {
      color: "bg-pink-50 dark:bg-pink-950/30 border-l-4 border-l-pink-500",
      badge: "bg-pink-100 dark:bg-pink-900 text-pink-700 dark:text-pink-300",
      icon: Users,
      label: "Payroll",
    },
    Depreciation: {
      color: "bg-gray-50 dark:bg-gray-950/30 border-l-4 border-l-gray-500",
      badge: "bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300",
      icon: TrendingDown,
      label: "Depreciation",
    },
    Tax: {
      color: "bg-rose-50 dark:bg-rose-950/30 border-l-4 border-l-rose-500",
      badge: "bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300",
      icon: Calculator,
      label: "Tax",
    },
    Refund: {
      color: "bg-cyan-50 dark:bg-cyan-950/30 border-l-4 border-l-cyan-500",
      badge: "bg-cyan-100 dark:bg-cyan-900 text-cyan-700 dark:text-cyan-300",
      icon: ArrowDownRight,
      label: "Refund",
    },
    Transfer: {
      color:
        "bg-violet-50 dark:bg-violet-950/30 border-l-4 border-l-violet-500",
      badge:
        "bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300",
      icon: RefreshCw,
      label: "Transfer",
    },
  };
  return configs[type] || configs.Journal;
}

function getAccountTypeColor(type: Account["type"]) {
  const colors = {
    Asset: "text-blue-600 dark:text-blue-400",
    Liability: "text-red-600 dark:text-red-400",
    Equity: "text-purple-600 dark:text-purple-400",
    Revenue: "text-green-600 dark:text-green-400",
    Expense: "text-amber-600 dark:text-amber-400",
    "Cost of Sales": "text-orange-600 dark:text-orange-400",
  };
  return colors[type];
}

function getStatusIcon(status: JournalEntry["status"]) {
  switch (status) {
    case "Posted":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "Draft":
      return <Clock className="h-4 w-4 text-amber-500" />;
    case "Void":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "Approved":
      return <FileCheck className="h-4 w-4 text-blue-500" />;
    case "Rejected":
      return <XCircle className="h-4 w-4 text-rose-500" />;
  }
}

// ==================== MAIN COMPONENT ====================

export default function LedgerPage() {
  // State
  const [selectedAccount, setSelectedAccount] = useState<Account>(
    sampleAccounts.find((a) => a.code === "1020")!
  );
  const [transactions, setTransactions] =
    useState<LedgerTransaction[]>(allTransactions);
  const [filteredTransactions, setFilteredTransactions] = useState<
    LedgerTransaction[]
  >([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subMonths(new Date(), 3),
    to: new Date(),
  });
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] =
    useState<LedgerTransaction | null>(null);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isReconcileDialogOpen, setIsReconcileDialogOpen] = useState(false);
  const [ledgerSummary, setLedgerSummary] = useState<LedgerSummary | null>(
    null
  );
  const [sortConfig, setSortConfig] = useState<{
    key: keyof LedgerTransaction;
    direction: "asc" | "desc";
  }>({
    key: "date",
    direction: "desc",
  });
  const [viewMode, setViewMode] = useState<"detailed" | "compact">("detailed");
  const [showReconciled, setShowReconciled] = useState(true);
  const [showTaxDetails, setShowTaxDetails] = useState(false);

  // Initialize
  useEffect(() => {
    if (selectedAccount) {
      calculateLedgerSummary();
    }
  }, [selectedAccount, dateRange]);

  // Filter transactions
  useEffect(() => {
    filterTransactions();
  }, [
    transactions,
    selectedAccount,
    searchTerm,
    filterType,
    filterStatus,
    dateRange,
    sortConfig,
    showReconciled,
  ]);

  // Calculate comprehensive ledger summary
  const calculateLedgerSummary = () => {
    if (!selectedAccount) return;

    const accountTransactions = transactions.filter(
      (t) => t.accountId === selectedAccount.id
    );

    const filteredByDate = dateRange
      ? accountTransactions.filter((t) => {
          const date = new Date(t.date);
          return (
            (!dateRange.from || date >= dateRange.from) &&
            (!dateRange.to || date <= dateRange.to)
          );
        })
      : accountTransactions;

    // Calculate opening balance from transactions before date range
    const openingTransactions = dateRange?.from
      ? accountTransactions.filter((t) => new Date(t.date) < dateRange.from)
      : [];

    const openingBalance =
      openingTransactions.length > 0
        ? openingTransactions.sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          )[0].balance
        : selectedAccount.balance;

    const totalDebit = filteredByDate.reduce((sum, t) => sum + t.debit, 0);
    const totalCredit = filteredByDate.reduce((sum, t) => sum + t.credit, 0);
    const closingBalance = openingBalance + totalDebit - totalCredit;
    const transactionCount = filteredByDate.length;
    const avgTransaction =
      transactionCount > 0 ? (totalDebit + totalCredit) / transactionCount : 0;
    const largestDebit = Math.max(...filteredByDate.map((t) => t.debit), 0);
    const largestCredit = Math.max(...filteredByDate.map((t) => t.credit), 0);
    const debitCount = filteredByDate.filter((t) => t.debit > 0).length;
    const creditCount = filteredByDate.filter((t) => t.credit > 0).length;

    // Calculate monthly trend
    const monthlyTrend = Array.from({ length: 6 }, (_, i) => {
      const monthDate = subMonths(new Date(), 5 - i);
      const monthKey = format(monthDate, "MMM yyyy");
      const monthTransactions = accountTransactions.filter(
        (t) => format(new Date(t.date), "MMM yyyy") === monthKey
      );
      const monthTotal = monthTransactions.reduce(
        (sum, t) => sum + t.debit - t.credit,
        0
      );
      return { month: monthKey, amount: monthTotal };
    });

    setLedgerSummary({
      account: selectedAccount,
      openingBalance,
      totalDebit,
      totalCredit,
      closingBalance,
      transactionCount,
      avgTransaction,
      largestDebit,
      largestCredit,
      debitCount,
      creditCount,
      monthlyTrend,
    });
  };

  // Filter and sort transactions
  const filterTransactions = () => {
    let filtered = transactions;

    if (selectedAccount) {
      filtered = filtered.filter((t) => t.accountId === selectedAccount.id);
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (t) =>
          t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.accountName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (t.contactName &&
            t.contactName.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (t.projectCode &&
            t.projectCode.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (filterType !== "all") {
      filtered = filtered.filter((t) => t.type === filterType);
    }

    if (filterStatus !== "all") {
      filtered = filtered.filter((t) => t.journalEntry.status === filterStatus);
    }

    if (!showReconciled) {
      filtered = filtered.filter((t) => !t.reconciled);
    }

    if (dateRange) {
      filtered = filtered.filter((t) => {
        const date = new Date(t.date);
        return (
          (!dateRange.from || date >= dateRange.from) &&
          (!dateRange.to || date <= dateRange.to)
        );
      });
    }

    // Sorting
    filtered.sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (sortConfig.key === "date") {
        return sortConfig.direction === "asc"
          ? new Date(a.date).getTime() - new Date(b.date).getTime()
          : new Date(b.date).getTime() - new Date(a.date).getTime();
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortConfig.direction === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortConfig.direction === "asc"
          ? aValue - bValue
          : bValue - aValue;
      }

      return 0;
    });

    setFilteredTransactions(filtered);
  };

  // Sort handler
  const handleSort = (key: keyof LedgerTransaction) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  // Open transaction detail
  const openDetailDialog = (transaction: LedgerTransaction) => {
    setSelectedTransaction(transaction);
    setIsDetailDialogOpen(true);
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: selectedAccount?.currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Format percentage
  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  // Get account type icon
  const getAccountTypeIcon = (type: Account["type"]) => {
    const icons = {
      Asset: <TrendingUp className="h-4 w-4" />,
      Liability: <TrendingDown className="h-4 w-4" />,
      Equity: <BarChart3 className="h-4 w-4" />,
      Revenue: <ArrowUpRight className="h-4 w-4" />,
      Expense: <ArrowDownRight className="h-4 w-4" />,
      "Cost of Sales": <Calculator className="h-4 w-4" />,
    };
    return icons[type];
  };

  // Sort icon component
  const SortIcon = ({ columnKey }: { columnKey: keyof LedgerTransaction }) => {
    if (sortConfig.key !== columnKey) {
      return <ChevronDown className="h-3 w-3 opacity-30" />;
    }
    return sortConfig.direction === "asc" ? (
      <ChevronUp className="h-3 w-3" />
    ) : (
      <ChevronDown className="h-3 w-3" />
    );
  };

  // Render transaction row
  const renderTransactionRow = (transaction: LedgerTransaction) => {
    const typeConfig = getTransactionTypeConfig(transaction.type);
    const TypeIcon = typeConfig.icon;

    return (
      <tr
        key={transaction.id}
        className={`hover:bg-accent/50 transition-colors duration-150 ${typeConfig.color}`}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-white dark:bg-gray-800 border">
              <TypeIcon className="h-3.5 w-3.5" />
            </div>
            <div>
              <div className="font-medium text-sm">{transaction.reference}</div>
              <div className="text-xs text-muted-foreground">
                {transaction.journalEntry.entryNumber}
              </div>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="text-sm font-medium">
            {format(transaction.date, "MMM dd")}
          </div>
          <div className="text-xs text-muted-foreground">
            {format(transaction.date, "yyyy")}
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="max-w-xs">
            <div className="text-sm font-medium">{transaction.description}</div>
            {transaction.contactName && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <User className="h-3 w-3" />
                <span>{transaction.contactName}</span>
              </div>
            )}
            {transaction.projectCode && (
              <div className="text-xs text-muted-foreground mt-1">
                Project: {transaction.projectCode}
              </div>
            )}
          </div>
        </td>
        {showTaxDetails &&
          transaction.taxAmount &&
          transaction.taxAmount > 0 && (
            <td className="px-4 py-3 text-right">
              <div className="text-xs text-muted-foreground">
                {formatCurrency(transaction.taxAmount)}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatPercentage(transaction.taxRate || 0)}
              </div>
            </td>
          )}
        <td className="px-4 py-3 text-right">
          {transaction.debit > 0 && (
            <div className="flex items-center justify-end gap-1">
              <ArrowUpRight className="h-3.5 w-3.5 text-green-600" />
              <div className="text-green-600 dark:text-green-400 font-mono font-medium">
                {formatCurrency(transaction.debit)}
              </div>
            </div>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          {transaction.credit > 0 && (
            <div className="flex items-center justify-end gap-1">
              <ArrowDownRight className="h-3.5 w-3.5 text-red-600" />
              <div className="text-red-600 dark:text-red-400 font-mono font-medium">
                {formatCurrency(transaction.credit)}
              </div>
            </div>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="font-mono font-medium">
            {formatCurrency(transaction.balance)}
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {getStatusIcon(transaction.journalEntry.status)}
            <Badge
              variant={
                transaction.journalEntry.status === "Posted"
                  ? "default"
                  : transaction.journalEntry.status === "Draft"
                  ? "secondary"
                  : transaction.journalEntry.status === "Approved"
                  ? "outline"
                  : "destructive"
              }
              className="text-xs"
            >
              {transaction.journalEntry.status}
            </Badge>
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            {transaction.reconciled && (
              <Badge variant="outline" className="text-xs bg-green-50">
                ✓
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openDetailDialog(transaction)}
              className="h-7 w-7 p-0"
              title="View Details"
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openDetailDialog(transaction)}>
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <FileEdit className="mr-2 h-4 w-4" />
                  Edit Entry
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Link className="mr-2 h-4 w-4" />
                  Link Document
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Void Transaction
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </td>
      </tr>
    );
  };

  // Handle export
  const handleExport = (format: "pdf" | "excel" | "csv" | "quickbooks") => {
    const msg = `Exporting ${filteredTransactions.length} transactions from ${
      selectedAccount.name
    } to ${format.toUpperCase()}`;
    alert(msg);
    setIsExportDialogOpen(false);
  };

  // Start reconciliation
  const handleStartReconciliation = () => {
    setIsReconcileDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-full mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-foreground">
                General Ledger
              </h1>
              <Badge variant="outline" className="font-normal">
                ERP Accounting Module
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">
              Real-time ledger tracking with advanced filtering and reporting
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setIsExportDialogOpen(true)}
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button variant="outline" className="gap-2">
              <Printer className="h-4 w-4" />
              Print
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleStartReconciliation}
            >
              <RefreshCw className="h-4 w-4" />
              Reconcile
            </Button>
            <Button className="gap-2 bg-green-600 hover:bg-green-700">
              <Plus className="h-4 w-4" />
              New Journal Entry
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="ledger" className="w-full">
          <TabsList className="grid grid-cols-5 w-full md:w-auto">
            <TabsTrigger value="ledger" className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Ledger
            </TabsTrigger>
            <TabsTrigger value="analysis" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Analysis
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2">
              <PieChart className="h-4 w-4" />
              Reports
            </TabsTrigger>
            <TabsTrigger value="reconciliation" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Reconciliation
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ledger" className="space-y-6">
            {/* Account Selection and Date Range */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Account Selector */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Account Selection</span>
                    <Database className="h-4 w-4 text-muted-foreground" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select
                    value={selectedAccount.id}
                    onValueChange={(value) => {
                      const account = sampleAccounts.find(
                        (a) => a.id === value
                      );
                      if (account) setSelectedAccount(account);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an account" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[400px]">
                      {sampleAccounts
                        .filter((a) => a.allowPosting)
                        .map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            <div className="flex items-center justify-between w-full">
                              <div className="flex-1">
                                <div className="font-medium">
                                  {account.code} - {account.name}
                                </div>
                                <div
                                  className={`text-xs ${getAccountTypeColor(
                                    account.type
                                  )}`}
                                >
                                  {account.type}
                                </div>
                              </div>
                              <div className="font-mono text-sm">
                                {formatCurrency(account.balance)}
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>

                  {/* Account Info */}
                  <div className="space-y-3 pt-4 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        Account Type
                      </span>
                      <div className="flex items-center gap-2">
                        {getAccountTypeIcon(selectedAccount.type)}
                        <Badge
                          variant="outline"
                          className={getAccountTypeColor(selectedAccount.type)}
                        >
                          {selectedAccount.type}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        Category
                      </span>
                      <span className="text-sm font-medium">
                        {selectedAccount.category}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        Subcategory
                      </span>
                      <span className="text-sm">
                        {selectedAccount.subcategory || "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        Tax Code
                      </span>
                      <span className="text-sm">
                        {selectedAccount.taxCode || "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        Current Balance
                      </span>
                      <span className="font-mono font-semibold text-lg">
                        {formatCurrency(selectedAccount.balance)}
                      </span>
                    </div>
                    {selectedAccount.description && (
                      <div className="pt-2 text-sm text-muted-foreground border-t">
                        {selectedAccount.description}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Date Range and Summary */}
              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Date Range & Filters</span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant={
                          viewMode === "detailed" ? "default" : "outline"
                        }
                        size="sm"
                        onClick={() => setViewMode("detailed")}
                      >
                        Detailed
                      </Button>
                      <Button
                        variant={viewMode === "compact" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setViewMode("compact")}
                      >
                        Compact
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Date Range Picker */}
                  <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="flex-1">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !dateRange && "text-muted-foreground"
                            )}
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {dateRange?.from ? (
                              dateRange.to ? (
                                <>
                                  {format(dateRange.from, "MMM dd, yyyy")} -{" "}
                                  {format(dateRange.to, "MMM dd, yyyy")}
                                </>
                              ) : (
                                format(dateRange.from, "MMM dd, yyyy")
                              )
                            ) : (
                              <span>Select date range</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            initialFocus
                            mode="range"
                            defaultMonth={dateRange?.from}
                            selected={dateRange}
                            onSelect={setDateRange}
                            numberOfMonths={2}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() =>
                          setDateRange({ from: undefined, to: undefined })
                        }
                      >
                        All Dates
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          const today = new Date();
                          const firstDay = new Date(
                            today.getFullYear(),
                            today.getMonth(),
                            1
                          );
                          setDateRange({ from: firstDay, to: today });
                        }}
                      >
                        This Month
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          const today = new Date();
                          const firstDay = subMonths(today, 1);
                          setDateRange({ from: firstDay, to: today });
                        }}
                      >
                        Last 30 Days
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          const today = new Date();
                          const firstDay = subMonths(today, 3);
                          setDateRange({ from: firstDay, to: today });
                        }}
                      >
                        Last Quarter
                      </Button>
                    </div>
                  </div>

                  {/* Ledger Summary Cards */}
                  {ledgerSummary && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <TrendingUp className="h-4 w-4" />
                            Opening Balance
                          </div>
                          <div className="text-2xl font-bold mt-2">
                            {formatCurrency(ledgerSummary.openingBalance)}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            As of{" "}
                            {dateRange?.from
                              ? format(dateRange.from, "MMM dd")
                              : "beginning"}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <ArrowUpRight className="h-4 w-4 text-green-600" />
                            Total Debit ({ledgerSummary.debitCount})
                          </div>
                          <div className="text-2xl font-bold text-green-600 dark:text-green-400 mt-2">
                            {formatCurrency(ledgerSummary.totalDebit)}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Largest:{" "}
                            {formatCurrency(ledgerSummary.largestDebit)}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <ArrowDownRight className="h-4 w-4 text-red-600" />
                            Total Credit ({ledgerSummary.creditCount})
                          </div>
                          <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-2">
                            {formatCurrency(ledgerSummary.totalCredit)}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Largest:{" "}
                            {formatCurrency(ledgerSummary.largestCredit)}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <TrendingDown className="h-4 w-4" />
                            Closing Balance
                          </div>
                          <div className="text-2xl font-bold mt-2">
                            {formatCurrency(ledgerSummary.closingBalance)}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {formatCurrency(
                              ledgerSummary.closingBalance -
                                ledgerSummary.openingBalance
                            )}{" "}
                            net change
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Advanced Filters */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="Search transactions by description, reference, contact, or project..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Transaction Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="Invoice">Invoice</SelectItem>
                      <SelectItem value="Payment">Payment</SelectItem>
                      <SelectItem value="Receipt">Receipt</SelectItem>
                      <SelectItem value="Expense">Expense</SelectItem>
                      <SelectItem value="Purchase">Purchase</SelectItem>
                      <SelectItem value="Payroll">Payroll</SelectItem>
                      <SelectItem value="Journal">Journal</SelectItem>
                      <SelectItem value="Adjustment">Adjustment</SelectItem>
                      <SelectItem value="Tax">Tax</SelectItem>
                      <SelectItem value="Transfer">Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Entry Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="Posted">Posted</SelectItem>
                      <SelectItem value="Draft">Draft</SelectItem>
                      <SelectItem value="Approved">Approved</SelectItem>
                      <SelectItem value="Void">Void</SelectItem>
                      <SelectItem value="Rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchTerm("");
                      setFilterType("all");
                      setFilterStatus("all");
                      setDateRange({ from: undefined, to: undefined });
                      setShowReconciled(true);
                    }}
                    className="gap-2"
                  >
                    <Filter className="h-4 w-4" />
                    Clear All
                  </Button>
                </div>

                {/* Advanced Filter Options */}
                <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="show-reconciled"
                      checked={showReconciled}
                      onCheckedChange={(checked) =>
                        setShowReconciled(checked as boolean)
                      }
                    />
                    <Label htmlFor="show-reconciled" className="text-sm">
                      Show Reconciled
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="show-tax"
                      checked={showTaxDetails}
                      onCheckedChange={(checked) =>
                        setShowTaxDetails(checked as boolean)
                      }
                    />
                    <Label htmlFor="show-tax" className="text-sm">
                      Show Tax Details
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Label
                      htmlFor="min-amount"
                      className="text-sm whitespace-nowrap"
                    >
                      Min Amount:
                    </Label>
                    <Input
                      id="min-amount"
                      placeholder="$0.00"
                      className="w-24"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Label
                      htmlFor="max-amount"
                      className="text-sm whitespace-nowrap"
                    >
                      Max Amount:
                    </Label>
                    <Input
                      id="max-amount"
                      placeholder="$10,000"
                      className="w-24"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Label className="text-sm whitespace-nowrap">
                      Department:
                    </Label>
                    <Select>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="sales">Sales</SelectItem>
                        <SelectItem value="marketing">Marketing</SelectItem>
                        <SelectItem value="operations">Operations</SelectItem>
                        <SelectItem value="finance">Finance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Transactions Table */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Ledger Transactions</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {filteredTransactions.length} transactions •
                    {dateRange?.from &&
                      ` From ${format(dateRange.from, "MMM dd, yyyy")}`}
                    {dateRange?.to &&
                      ` to ${format(dateRange.to, "MMM dd, yyyy")}`}
                    {ledgerSummary &&
                      ` • Net Change: ${formatCurrency(
                        ledgerSummary.totalDebit - ledgerSummary.totalCredit
                      )}`}
                    {ledgerSummary &&
                      ` • Avg Transaction: ${formatCurrency(
                        ledgerSummary.avgTransaction
                      )}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSort("date")}
                    className="gap-1"
                  >
                    Sort by Date
                    <SortIcon columnKey="date" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        Columns
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuLabel>Display Columns</DropdownMenuLabel>
                      <DropdownMenuItem>
                        <Checkbox checked className="mr-2" />
                        Reference
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Checkbox checked className="mr-2" />
                        Date
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Checkbox checked className="mr-2" />
                        Description
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Checkbox checked={showTaxDetails} className="mr-2" />
                        Tax Details
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Checkbox checked className="mr-2" />
                        Debit/Credit
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Checkbox checked className="mr-2" />
                        Balance
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr className="border-b border-border">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          <Button
                            variant="ghost"
                            className="hover:bg-transparent p-0 h-auto font-semibold"
                            onClick={() => handleSort("reference")}
                          >
                            Reference
                            <SortIcon columnKey="reference" />
                          </Button>
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          <Button
                            variant="ghost"
                            className="hover:bg-transparent p-0 h-auto font-semibold"
                            onClick={() => handleSort("date")}
                          >
                            Date
                            <SortIcon columnKey="date" />
                          </Button>
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Description
                        </th>
                        {showTaxDetails && (
                          <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Tax
                          </th>
                        )}
                        <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          <Button
                            variant="ghost"
                            className="hover:bg-transparent p-0 h-auto font-semibold"
                            onClick={() => handleSort("debit")}
                          >
                            Debit
                            <SortIcon columnKey="debit" />
                          </Button>
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          <Button
                            variant="ghost"
                            className="hover:bg-transparent p-0 h-auto font-semibold"
                            onClick={() => handleSort("credit")}
                          >
                            Credit
                            <SortIcon columnKey="credit" />
                          </Button>
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          <Button
                            variant="ghost"
                            className="hover:bg-transparent p-0 h-auto font-semibold"
                            onClick={() => handleSort("balance")}
                          >
                            Balance
                            <SortIcon columnKey="balance" />
                          </Button>
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.length === 0 ? (
                        <tr>
                          <td
                            colSpan={showTaxDetails ? 9 : 8}
                            className="px-4 py-12 text-center text-muted-foreground"
                          >
                            <Search className="h-12 w-12 mx-auto mb-4 opacity-20" />
                            <p className="text-base">No transactions found</p>
                            <p className="text-sm mt-2">
                              Try selecting a different account or adjusting
                              your filters
                            </p>
                          </td>
                        </tr>
                      ) : (
                        filteredTransactions.map((transaction) =>
                          renderTransactionRow(transaction)
                        )
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {filteredTransactions.length > 0 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <div className="text-sm text-muted-foreground">
                      Showing 1 to {Math.min(50, filteredTransactions.length)}{" "}
                      of {filteredTransactions.length} entries
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" disabled>
                        Previous
                      </Button>
                      <Button variant="outline" size="sm" className="w-8">
                        1
                      </Button>
                      <Button variant="outline" size="sm" className="w-8">
                        2
                      </Button>
                      <Button variant="outline" size="sm" className="w-8">
                        3
                      </Button>
                      <Button variant="outline" size="sm">
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analysis">
            <Card>
              <CardHeader>
                <CardTitle>Ledger Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                {ledgerSummary && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-2xl font-bold">
                            {ledgerSummary.transactionCount}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Total Transactions
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-2xl font-bold">
                            {formatCurrency(ledgerSummary.avgTransaction)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Average Transaction
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-2xl font-bold">
                            {ledgerSummary.debitCount}:
                            {ledgerSummary.creditCount}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Debit:Credit Ratio
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-2xl font-bold">
                            {ledgerSummary.totalDebit > 0
                              ? `${(
                                  (ledgerSummary.totalCredit /
                                    ledgerSummary.totalDebit) *
                                  100
                                ).toFixed(1)}%`
                              : "N/A"}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Credit to Debit %
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Monthly Trend Chart */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Monthly Trend</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {ledgerSummary.monthlyTrend.map((item, index) => (
                            <div
                              key={item.month}
                              className="flex items-center justify-between"
                            >
                              <div className="text-sm w-24">{item.month}</div>
                              <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${
                                    item.amount >= 0
                                      ? "bg-green-500"
                                      : "bg-red-500"
                                  }`}
                                  style={{
                                    width: `${Math.min(
                                      (Math.abs(item.amount) / 10000) * 100,
                                      100
                                    )}%`,
                                  }}
                                />
                              </div>
                              <div
                                className={`text-sm font-mono w-24 text-right ${
                                  item.amount >= 0
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                {formatCurrency(item.amount)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports">
            <Card>
              <CardHeader>
                <CardTitle>Ledger Reports</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Card className="cursor-pointer hover:border-primary">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <FileText className="h-8 w-8 text-blue-500" />
                        <div>
                          <div className="font-semibold">Trial Balance</div>
                          <div className="text-sm text-muted-foreground">
                            All accounts with balances
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="cursor-pointer hover:border-primary">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <LineChart className="h-8 w-8 text-green-500" />
                        <div>
                          <div className="font-semibold">Activity Summary</div>
                          <div className="text-sm text-muted-foreground">
                            Monthly activity report
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="cursor-pointer hover:border-primary">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <Receipt className="h-8 w-8 text-purple-500" />
                        <div>
                          <div className="font-semibold">
                            Transaction Detail
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Detailed transaction listing
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Transaction Detail Dialog */}
        <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>Transaction Details</span>
                {selectedTransaction && (
                  <Badge
                    className={
                      getTransactionTypeConfig(selectedTransaction.type).badge
                    }
                  >
                    {selectedTransaction.type}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription>
                Complete transaction information and journal entry details
              </DialogDescription>
            </DialogHeader>
            {selectedTransaction && (
              <div className="space-y-6">
                {/* Header Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">
                        Transaction Reference
                      </Label>
                      <div className="text-xl font-bold">
                        {selectedTransaction.reference}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">
                        Description
                      </Label>
                      <div className="text-base font-medium">
                        {selectedTransaction.description}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">
                        Account
                      </Label>
                      <div className="text-base">
                        {selectedTransaction.accountCode} -{" "}
                        {selectedTransaction.accountName}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">
                        Date & Time
                      </Label>
                      <div className="text-base font-medium">
                        {format(selectedTransaction.date, "PPPP 'at' p")}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">
                        Journal Entry
                      </Label>
                      <div className="text-xl font-bold">
                        {selectedTransaction.journalEntry.entryNumber}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">
                        Amount
                      </Label>
                      <div
                        className={`text-3xl font-bold ${
                          selectedTransaction.debit > 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {selectedTransaction.debit > 0
                          ? `+${formatCurrency(selectedTransaction.debit)}`
                          : `-${formatCurrency(selectedTransaction.credit)}`}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">
                        Running Balance
                      </Label>
                      <div className="text-xl font-mono font-bold">
                        {formatCurrency(selectedTransaction.balance)}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">
                        Status
                      </Label>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(selectedTransaction.journalEntry.status)}
                        <Badge
                          variant={
                            selectedTransaction.journalEntry.status === "Posted"
                              ? "default"
                              : selectedTransaction.journalEntry.status ===
                                "Draft"
                              ? "secondary"
                              : selectedTransaction.journalEntry.status ===
                                "Approved"
                              ? "outline"
                              : "destructive"
                          }
                        >
                          {selectedTransaction.journalEntry.status}
                        </Badge>
                        {selectedTransaction.reconciled && (
                          <Badge variant="outline" className="bg-green-50">
                            ✓ Reconciled
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Contact and Project Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {selectedTransaction.contactName && (
                    <div className="space-y-3">
                      <h4 className="font-semibold">Contact Information</h4>
                      <div className="p-3 bg-muted rounded-lg space-y-2">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">
                              {selectedTransaction.contactName}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {selectedTransaction.contactType}
                            </div>
                          </div>
                        </div>
                        {selectedTransaction.contactId && (
                          <div className="text-sm">
                            ID: {selectedTransaction.contactId}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {(selectedTransaction.projectCode ||
                    selectedTransaction.department ||
                    selectedTransaction.costCenter) && (
                    <div className="space-y-3">
                      <h4 className="font-semibold">Accounting Dimensions</h4>
                      <div className="p-3 bg-muted rounded-lg space-y-2">
                        {selectedTransaction.projectCode && (
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">
                              Project:
                            </span>
                            <span className="font-medium">
                              {selectedTransaction.projectCode}
                            </span>
                          </div>
                        )}
                        {selectedTransaction.department && (
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">
                              Department:
                            </span>
                            <span className="font-medium">
                              {selectedTransaction.department}
                            </span>
                          </div>
                        )}
                        {selectedTransaction.costCenter && (
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">
                              Cost Center:
                            </span>
                            <span className="font-medium">
                              {selectedTransaction.costCenter}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Tax Details */}
                {selectedTransaction.taxAmount &&
                  selectedTransaction.taxAmount > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-semibold">Tax Details</h4>
                      <div className="p-3 bg-muted rounded-lg grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-muted-foreground">
                            Tax Amount
                          </div>
                          <div className="font-medium">
                            {formatCurrency(selectedTransaction.taxAmount)}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">
                            Tax Rate
                          </div>
                          <div className="font-medium">
                            {formatPercentage(selectedTransaction.taxRate || 0)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                {/* Journal Entry Details */}
                <div className="space-y-3">
                  <h4 className="font-semibold">Journal Entry Details</h4>
                  <div className="p-3 bg-muted rounded-lg space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">
                          Created By
                        </div>
                        <div className="font-medium">
                          {selectedTransaction.journalEntry.createdBy}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">
                          Created At
                        </div>
                        <div className="font-medium">
                          {format(
                            selectedTransaction.journalEntry.createdAt,
                            "PPpp"
                          )}
                        </div>
                      </div>
                    </div>
                    {selectedTransaction.journalEntry.approvedBy && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-muted-foreground">
                            Approved By
                          </div>
                          <div className="font-medium">
                            {selectedTransaction.journalEntry.approvedBy}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">
                            Approved At
                          </div>
                          <div className="font-medium">
                            {selectedTransaction.journalEntry.approvedAt
                              ? format(
                                  selectedTransaction.journalEntry.approvedAt,
                                  "PPpp"
                                )
                              : "N/A"}
                          </div>
                        </div>
                      </div>
                    )}
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Entry Description
                      </div>
                      <div className="font-medium">
                        {selectedTransaction.journalEntry.description}
                      </div>
                    </div>
                    {selectedTransaction.journalEntry.notes && (
                      <div>
                        <div className="text-sm text-muted-foreground">
                          Notes
                        </div>
                        <div className="font-medium text-amber-600">
                          {selectedTransaction.journalEntry.notes}
                        </div>
                      </div>
                    )}
                    {selectedTransaction.journalEntry.attachmentCount > 0 && (
                      <div>
                        <div className="text-sm text-muted-foreground">
                          Attachments
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <FileText className="h-4 w-4" />
                          <span>
                            {selectedTransaction.journalEntry.attachmentCount}{" "}
                            file(s) attached
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Reconciliation Info */}
                {selectedTransaction.reconciled &&
                  selectedTransaction.reconciledDate && (
                    <div className="space-y-3">
                      <h4 className="font-semibold">
                        Reconciliation Information
                      </h4>
                      <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                          <CheckCircle className="h-4 w-4" />
                          <span>
                            Reconciled on{" "}
                            {format(selectedTransaction.reconciledDate, "PPP")}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setIsDetailDialogOpen(false)}
              >
                Close
              </Button>
              <Button variant="outline">
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </Button>
              <Button>
                <FileEdit className="mr-2 h-4 w-4" />
                Edit Transaction
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Export Dialog */}
        <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Export Ledger Report</DialogTitle>
              <DialogDescription>
                Export ledger transactions for {selectedAccount?.name} (
                {selectedAccount?.code})
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              <div className="space-y-4">
                <Label>Export Format</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Button
                    variant="outline"
                    className="h-20 flex-col"
                    onClick={() => handleExport("pdf")}
                  >
                    <FileText className="h-8 w-8 mb-2" />
                    <span>PDF</span>
                    <span className="text-xs text-muted-foreground">
                      For printing
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-20 flex-col"
                    onClick={() => handleExport("excel")}
                  >
                    <FileSpreadsheet className="h-8 w-8 mb-2" />
                    <span>Excel</span>
                    <span className="text-xs text-muted-foreground">
                      For analysis
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-20 flex-col"
                    onClick={() => handleExport("csv")}
                  >
                    <FileText className="h-8 w-8 mb-2" />
                    <span>CSV</span>
                    <span className="text-xs text-muted-foreground">
                      For import
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-20 flex-col"
                    onClick={() => handleExport("quickbooks")}
                  >
                    <Database className="h-8 w-8 mb-2" />
                    <span>QuickBooks</span>
                    <span className="text-xs text-muted-foreground">
                      For accounting
                    </span>
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <Label>Export Options</Label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="include-summary" className="text-sm">
                      Include Summary Section
                    </Label>
                    <Switch id="include-summary" defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="include-attachments" className="text-sm">
                      Include Attachments
                    </Label>
                    <Switch id="include-attachments" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="group-by-month" className="text-sm">
                      Group by Month
                    </Label>
                    <Switch id="group-by-month" defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="include-comments" className="text-sm">
                      Include Comments
                    </Label>
                    <Switch id="include-comments" />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsExportDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={() => handleExport("excel")} className="gap-2">
                <Download className="h-4 w-4" />
                Export Now
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reconciliation Dialog */}
        <Dialog
          open={isReconcileDialogOpen}
          onOpenChange={setIsReconcileDialogOpen}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Bank Reconciliation</DialogTitle>
              <DialogDescription>
                Reconcile {selectedAccount.name} with bank statement
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="statement-date">Statement Date</Label>
                  <Input
                    id="statement-date"
                    type="date"
                    defaultValue={format(new Date(), "yyyy-MM-dd")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="statement-balance">Statement Balance</Label>
                  <Input
                    id="statement-balance"
                    type="number"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Reconciliation Status</Label>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm">Book Balance:</span>
                    <span className="font-mono font-bold">
                      {formatCurrency(selectedAccount.balance)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm">Unreconciled Transactions:</span>
                    <span className="font-mono">23</span>
                  </div>
                  <div className="flex justify-between items-center border-t pt-2">
                    <span className="font-medium">Difference:</span>
                    <span className="font-mono font-bold text-green-600">
                      $0.00
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Reconciliation Notes</Label>
                <Textarea
                  placeholder="Enter any notes about this reconciliation..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsReconcileDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button>Start Reconciliation</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
