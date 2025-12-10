"use client";

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
import { Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

type DamageEntry = {
  id: number;
  product: string;
  warehouse: string;
  date: string;
  quantity: number;
};

type DamageProduct = {
  product: string;
  quantity: string;
};

export default function DamageListPage() {
  const [damageEntryOpen, setDamageEntryOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [damageForm, setDamageForm] = useState({
    date: "2025-10-07",
    warehouse: "",
  });

  const [damageProducts, setDamageProducts] = useState<DamageProduct[]>([
    { product: "", quantity: "" },
  ]);

  const addProductRow = () => {
    setDamageProducts([...damageProducts, { product: "", quantity: "" }]);
  };

  const removeProductRow = (index: number) => {
    if (damageProducts.length > 1) {
      setDamageProducts(damageProducts.filter((_, i) => i !== index));
    }
  };

  const updateProductRow = (
    index: number,
    field: "product" | "quantity",
    value: string
  ) => {
    const updated = [...damageProducts];
    updated[index][field] = value;
    setDamageProducts(updated);
  };

  const calculateTotalAmount = () => {
    // Placeholder calculation - would need product prices
    return "/-";
  };

  return (
    <div className="min-h-screen bg-background p-6">
      {/* <ThemeToggle /> */}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-end mb-6">
          <Button
            onClick={() => setDamageEntryOpen(true)}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            Damage Entry
          </Button>
        </div>

        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            ANTAB AGRO LIMITED
          </h1>
          <p className="text-muted-foreground">
            Globe Nibash, Segun Bagicha, Dhaka-1000
          </p>
        </div>

        <h2 className="text-2xl font-bold text-center mb-6 text-foreground">
          Damage List
        </h2>

        {/* Export Buttons and Search */}
        <div className="bg-card border border-border p-4 rounded-lg shadow-sm mb-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="bg-gray-600 hover:bg-gray-700 text-white"
              >
                Copy
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="bg-gray-600 hover:bg-gray-700 text-white"
              >
                CSV
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="bg-gray-600 hover:bg-gray-700 text-white"
              >
                Excel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="bg-gray-600 hover:bg-gray-700 text-white"
              >
                PDF
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="bg-gray-600 hover:bg-gray-700 text-white"
              >
                Print
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="bg-gray-600 hover:bg-gray-700 text-white"
              >
                Column visibility
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-blue-600 font-semibold">
                Search:
              </span>
              <Input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64 border-red-300"
                placeholder=""
              />
            </div>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden mb-4">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-orange-500 text-white">
                <th className="px-4 py-3 text-left text-sm font-semibold">
                  Sl
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold">
                  Product
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold">
                  Wirehouse
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold">
                  Qntty
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-foreground font-semibold"
                >
                  No data available in table
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="bg-card border border-border p-4 rounded-lg shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing 0 to 0 of 0 entries
          </div>
          <div className="flex items-center gap-1">
            <button className="px-3 py-1 text-sm text-gray-400 cursor-not-allowed">
              Previous
            </button>
            <button className="px-3 py-1 text-sm text-gray-400 cursor-not-allowed">
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Damage Entry Modal */}
      <Dialog open={damageEntryOpen} onOpenChange={setDamageEntryOpen}>
        <DialogContent className="!max-w-[95vw] h-auto max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <h2 className="text-2xl font-bold text-center mb-8 text-foreground">
              Sales Damage Create
            </h2>
            <form className="space-y-8">
              {/* Date and Warehouse Row */}
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <Label className="text-blue-600 font-semibold">Date :</Label>
                  <Input
                    type="date"
                    className="mt-2 border-red-300"
                    value={damageForm.date}
                    onChange={(e) =>
                      setDamageForm({ ...damageForm, date: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label className="text-blue-600 font-semibold">
                    Warehouse :
                  </Label>
                  <Select
                    value={damageForm.warehouse}
                    onValueChange={(value) =>
                      setDamageForm({ ...damageForm, warehouse: value })
                    }
                  >
                    <SelectTrigger className="mt-2 border-red-300">
                      <SelectValue placeholder="=== Select Werehouse ===" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="warehouse1">Bogura Depot</SelectItem>
                      <SelectItem value="warehouse2">Dhaka Depot</SelectItem>
                      <SelectItem value="warehouse3">Rajshahi Depot</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Product Rows */}
              <div className="space-y-4">
                {damageProducts.map((item, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[1fr_1fr_auto] gap-4 items-end"
                  >
                    <div>
                      <Label className="text-blue-600 font-semibold">
                        Product :
                      </Label>
                      <Select
                        value={item.product}
                        onValueChange={(value) =>
                          updateProductRow(index, "product", value)
                        }
                      >
                        <SelectTrigger className="mt-2 border-red-300">
                          <SelectValue placeholder="Select Product" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="product1">
                            Antab Falon 100ml
                          </SelectItem>
                          <SelectItem value="product2">
                            Antab Falon 500ml
                          </SelectItem>
                          <SelectItem value="product3">
                            Antab Zypsum 10kg
                          </SelectItem>
                          <SelectItem value="product4">
                            Promectin Plus 10SG 100g
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-blue-600 font-semibold">
                        Quantity :
                      </Label>
                      <Input
                        type="text"
                        className="mt-2 border-red-300"
                        value={item.quantity}
                        onChange={(e) =>
                          updateProductRow(index, "quantity", e.target.value)
                        }
                      />
                    </div>
                    <div className="flex gap-2">
                      <Label className="text-blue-600 font-semibold">
                        Action :
                      </Label>
                      <div className="flex gap-2 mt-2">
                        {index === damageProducts.length - 1 && (
                          <button
                            type="button"
                            onClick={addProductRow}
                            className="p-2 bg-green-600 hover:bg-green-700 text-white rounded"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        )}
                        {damageProducts.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeProductRow(index)}
                            className="p-2 bg-red-500 hover:bg-red-600 text-white rounded"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total Amount */}
              <div className="text-center py-4">
                <p className="text-xl font-semibold text-foreground">
                  Total Amount : {calculateTotalAmount()}
                </p>
              </div>

              {/* Submit Button */}
              <div className="flex justify-center pt-4">
                <Button
                  type="submit"
                  className="bg-blue-500 hover:bg-blue-600 text-white px-8"
                >
                  Submit
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
