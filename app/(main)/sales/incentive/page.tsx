"use client";

import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Edit } from "lucide-react";

type IncentiveType = "yearly" | "monthly" | "daily";

type IncentiveData = {
  id: number;
  category: string;
  targetAmount: string;
  activeCommission: string;
  description: string;
};

export default function IncentiveListPage() {
  const [activeTab, setActiveTab] = useState<IncentiveType>("monthly");
  const [searchTerm, setSearchTerm] = useState("");
  const [entriesPerPage, setEntriesPerPage] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);

  // Form state
  const [incentiveForm, setIncentiveForm] = useState({
    category: "",
    minTarget: "",
    maxTarget: "",
    activeCommission: "",
    description: "",
  });

  // Sample data (empty for now)
  const incentiveData: IncentiveData[] = [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("[v0] Incentive form submitted:", {
      type: activeTab,
      ...incentiveForm,
    });
    // Reset form
    setIncentiveForm({
      category: "",
      minTarget: "",
      maxTarget: "",
      activeCommission: "",
      description: "",
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this incentive?")) {
      console.log("[v0] Deleting incentive:", id);
    }
  };

  const handleEdit = (id: number) => {
    console.log("[v0] Editing incentive:", id);
  };

  const getTabTitle = () => {
    switch (activeTab) {
      case "yearly":
        return "YEARLY INCENTIVE";
      case "monthly":
        return "MONTHLY INCENTIVE";
      case "daily":
        return "DAILY INCENTIVE";
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Tabs */}
      <div className="flex justify-center gap-4 mb-8">
        <Button
          onClick={() => setActiveTab("yearly")}
          className={`px-6 py-2 ${
            activeTab === "yearly"
              ? "bg-blue-500 hover:bg-blue-600 text-white"
              : "bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          }`}
        >
          Yearly Incentive
        </Button>
        <Button
          onClick={() => setActiveTab("monthly")}
          className={`px-6 py-2 ${
            activeTab === "monthly"
              ? "bg-blue-500 hover:bg-blue-600 text-white"
              : "bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          }`}
        >
          Monthly Incentive
        </Button>
        <Button
          onClick={() => setActiveTab("daily")}
          className={`px-6 py-2 ${
            activeTab === "daily"
              ? "bg-blue-500 hover:bg-blue-600 text-white"
              : "bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          }`}
        >
          Daily Incentive
        </Button>
      </div>

      {/* Split Screen Layout */}
      <div className="grid grid-cols-[1fr_auto_2fr] gap-0">
        {/* Left Side - Form */}
        <div className="bg-card p-8">
          <h2 className="text-2xl font-bold text-center mb-2 text-foreground">
            {getTabTitle()} SET
          </h2>
          <div className="w-24 h-0.5 bg-foreground mx-auto mb-8"></div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Category */}
            <div>
              <Label className="text-blue-600 font-semibold">Type :</Label>
              <Select
                value={incentiveForm.category}
                onValueChange={(value) =>
                  setIncentiveForm({ ...incentiveForm, category: value })
                }
              >
                <SelectTrigger className="mt-2 border-red-300">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="category1">Product Wise</SelectItem>
                  <SelectItem value="category2">Collection Wise</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <p>
                If Product Select multiple Products and theird comissions fixed
                tk
              </p>
            </div>

            {/* Min Target and Max Target */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-blue-600 font-semibold">
                  Min Target:
                </Label>
                <Input
                  type="text"
                  placeholder="Min Target"
                  className="mt-2 border-red-300"
                  value={incentiveForm.minTarget}
                  onChange={(e) =>
                    setIncentiveForm({
                      ...incentiveForm,
                      minTarget: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label className="text-blue-600 font-semibold">
                  Max Target:
                </Label>
                <Input
                  type="text"
                  placeholder="Max Target"
                  className="mt-2 border-red-300"
                  value={incentiveForm.maxTarget}
                  onChange={(e) =>
                    setIncentiveForm({
                      ...incentiveForm,
                      maxTarget: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            {/* Active Commission */}
            <div>
              <p>
                Select multiple Roles and their comissions percentage [Needs to
                select role, their target (product or collection) and
                percentage]
              </p>
            </div>
            <div>
              <Label className="text-blue-600 font-semibold">
                Achive Commision :
              </Label>
              <Input
                type="text"
                placeholder="Achive Commision"
                className="mt-2 border-red-300"
                value={incentiveForm.activeCommission}
                onChange={(e) =>
                  setIncentiveForm({
                    ...incentiveForm,
                    activeCommission: e.target.value,
                  })
                }
              />
            </div>

            {/* Type Description */}
            <div>
              <Label className="text-blue-600 font-semibold">
                Type Description :
              </Label>
              <Textarea
                placeholder={`${
                  getTabTitle().split(" ")[0]
                } Incentive Description`}
                className="mt-2 border-red-300 min-h-[150px]"
                value={incentiveForm.description}
                onChange={(e) =>
                  setIncentiveForm({
                    ...incentiveForm,
                    description: e.target.value,
                  })
                }
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-center pt-4">
              <Button
                type="submit"
                className="bg-blue-500 hover:bg-blue-600 text-white px-12 py-2"
              >
                Submit
              </Button>
            </div>
          </form>
        </div>

        {/* Vertical Divider */}
        <div className="w-px bg-border"></div>

        {/* Right Side - List */}
        <div className="bg-card p-8">
          <h2 className="text-2xl font-bold text-center mb-8 text-foreground">
            {getTabTitle()} LIST
          </h2>

          {/* Show entries and Search */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-blue-600 font-semibold">Show</span>
              <Select
                value={entriesPerPage.toString()}
                onValueChange={(value) => setEntriesPerPage(Number(value))}
              >
                <SelectTrigger className="w-16 h-8 border-red-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-blue-600 font-semibold">
                entries
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-blue-600 font-semibold">
                Search:
              </span>
              <Input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64 h-8 border-red-300"
                placeholder=""
              />
            </div>
          </div>

          {/* Data Table */}
          <div className="border border-border rounded-lg overflow-hidden mb-4">
            <table className="w-full">
              <thead>
                <tr className="bg-orange-500 text-white">
                  <th className="px-4 py-3 text-left text-sm font-semibold">
                    Sl. No
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">
                    Target Amount
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">
                    Achive Commision
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">
                    Description
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {incentiveData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-foreground font-semibold"
                    >
                      No data available in table
                    </td>
                  </tr>
                ) : (
                  incentiveData.map((item, index) => (
                    <tr
                      key={item.id}
                      className="border-b border-border hover:bg-muted/50"
                    >
                      <td className="px-4 py-3 text-sm text-foreground">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {item.category}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {item.targetAmount}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {item.activeCommission}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {item.description}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(item.id)}
                            className="p-1.5 bg-green-500 hover:bg-green-600 text-white rounded"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 bg-red-500 hover:bg-red-600 text-white rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing 0 to 0 of 0 entries
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className={`px-3 py-1 text-sm ${
                  currentPage === 1
                    ? "text-gray-400 cursor-not-allowed"
                    : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                }`}
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(1, currentPage + 1))}
                disabled={true}
                className={`px-3 py-1 text-sm ${
                  true
                    ? "text-gray-400 cursor-not-allowed"
                    : "text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                }`}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
