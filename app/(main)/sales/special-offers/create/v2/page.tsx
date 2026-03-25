"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandGroup,
  CommandItem,
  CommandEmpty,
} from "@/components/ui/command";
import {
  Plus,
  Trash2,
  Loader2,
  Check,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

/**
 * Special Offer Create — improved UX for product selection and rule building
 *
 * - Simple mode: easy-to-understand list of conditions + overall AND/OR
 * - Advanced mode: full nested builder (kept, but clearer)
 * - Product selector is centralized and reusable
 *
 * Endpoints used:
 *  GET /zones
 *  GET /regions?zone=<...>
 *  GET /areas?region=<...>
 *  GET /territories?area=<...>
 *  GET /dealers?q=...
 *  GET /products?q=...
 *  POST /special-offers/with-rules { offer, rules }
 */

type ID = string;
type Zone = { _id: ID; name: string };
type Region = { _id: ID; name: string };
type Area = { _id: ID; name: string };
type Territory = { _id: ID; name: string };
type Dealer = { _id: ID; name: string; code?: string; phoneNumber?: string };
type Product = { _id: ID; name: string; sku?: string; unit?: string };

function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/* ---------------- Simple Builder Types ---------------- */
type SimpleCondition = {
  id: ID;
  allProducts?: boolean; // apply to all products
  productIds: ID[]; // specific products
  productObjects?: Product[]; // cached objects
  productMatchMode?: "ANY" | "ALL"; // ANY of selected vs ALL selected
  minQty?: number | null;
  minAmount?: number | null;
};

/* ---------------- Advanced Node Types (same as your model) ---------------- */
type NodeType = "GROUP" | "RULE";
type AdvancedNode = {
  id: ID;
  type: NodeType;
  // GROUP
  combinationLogic?: "AND" | "OR";
  children?: AdvancedNode[];
  collapsed?: boolean;
  // RULE
  allProducts?: boolean;
  productIds?: ID[];
  products?: Product[];
  minQty?: number | null;
  minAmount?: number | null;
};

/* ---------------- ProductSearch component (reused) ---------------- */
function useProductSearch() {
  const cache = useRef<Record<string, Product[]>>({});
  const search = useCallback(async (q: string) => {
    if (!q || q.trim().length < 1) return [];
    if (cache.current[q]) return cache.current[q];
    try {
      const res = await api.get("/products", {
        params: { page: 1, limit: 50, q },
      });
      cache.current[q] = res.data?.data || [];
      return cache.current[q];
    } catch {
      return [];
    }
  }, []);
  return search;
}

/* ---------------- Central Product MultiSelect Modal (simple API) ---------------- */
/* Renders an Input that opens a Popover with Command search and returns selected products */
function ProductMultiSelect({
  placeholder = "Search products...",
  selected = [],
  onAdd,
  onRemove,
  allowMultiple = true,
}: {
  placeholder?: string;
  selected: Product[];
  onAdd: (p: Product) => void;
  onRemove: (id: ID) => void;
  allowMultiple?: boolean;
}) {
  const search = useProductSearch();
  const [q, setQ] = useState("");
  const [candidates, setCandidates] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!q || q.trim().length < 1) {
      setCandidates([]);
      setLoading(false);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      return;
    }
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setLoading(true);
    timerRef.current = window.setTimeout(async () => {
      try {
        const res = await search(q);
        setCandidates(res || []);
      } catch {
        setCandidates([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [q, search]);

  return (
    <div>
      <Popover>
        <PopoverTrigger asChild>
          <Input
            placeholder={placeholder}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setQ("")}
            readOnly={false}
          />
        </PopoverTrigger>
        <PopoverContent className="w-[420px]">
          <div className="p-2">
            <Command>
              <CommandInput
                placeholder="Type product name or SKU..."
                value={q}
                onValueChange={(v) => setQ(v)}
              />
              <CommandEmpty>No results</CommandEmpty>
              <CommandGroup>
                {loading ? (
                  <div className="p-3 text-center">
                    <Loader2 className="animate-spin" />
                  </div>
                ) : candidates.length ? (
                  candidates.map((p) => {
                    const already = selected.some((s) => s._id === p._id);
                    return (
                      <CommandItem
                        key={p._id}
                        value={p.name}
                        onSelect={() => {
                          if (!already || allowMultiple) onAdd(p);
                        }}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div>
                            <div className="font-medium">{p.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {p.sku}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {p.unit ?? "pcs"}
                          </div>
                        </div>
                      </CommandItem>
                    );
                  })
                ) : (
                  <div className="p-3 text-sm text-muted-foreground">
                    No results
                  </div>
                )}
              </CommandGroup>
            </Command>

            {/* selected */}
            {selected.length > 0 && (
              <div className="mt-2">
                <div className="text-xs text-muted-foreground mb-1">
                  Selected
                </div>
                <div className="flex gap-2 flex-wrap">
                  {selected.map((s) => (
                    <div
                      key={s._id}
                      className="px-2 py-1 bg-slate-100 rounded flex items-center gap-2 text-sm"
                    >
                      <div>{s.name}</div>
                      <button
                        onClick={() => onRemove(s._id)}
                        className="text-red-600"
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/* ---------------- Advanced Node UI (cleaned) ---------------- */
function NewAdvancedRule(): AdvancedNode {
  return {
    id: uid("r"),
    type: "RULE",
    products: [],
    productIds: [],
    allProducts: false,
    minQty: null,
    minAmount: null,
    collapsed: false,
  };
}
function NewAdvancedGroup(): AdvancedNode {
  return {
    id: uid("g"),
    type: "GROUP",
    combinationLogic: "AND",
    children: [NewAdvancedRule()],
    collapsed: false,
  };
}

/* Recursive Advanced editor (cleaner layout) */
function AdvancedNodeEditor({
  node,
  onChange,
  onRemove,
}: {
  node: AdvancedNode;
  onChange: (n: AdvancedNode) => void;
  onRemove?: () => void;
}) {
  const search = useProductSearch();

  // product search for leaf
  const [q, setQ] = useState("");
  const [candidates, setCandidates] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (node.type !== "RULE") return;
    if (!q || q.trim().length < 2) {
      setCandidates([]);
      setLoading(false);
      return;
    }
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setLoading(true);
    timerRef.current = window.setTimeout(async () => {
      try {
        const res = await search(q);
        setCandidates(res || []);
      } catch {
        setCandidates([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [q, search, node.type]);

  const toggleCollapsed = () =>
    onChange({ ...node, collapsed: !node.collapsed });

  if (node.type === "GROUP") {
    return (
      <div className="border rounded bg-white p-3">
        <div className="flex items-center gap-3">
          <button onClick={toggleCollapsed} className="p-1">
            {node.collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          <div className="font-medium">Group</div>
          <div className="ml-auto flex items-center gap-2">
            <select
              value={node.combinationLogic}
              onChange={(e) =>
                onChange({ ...node, combinationLogic: e.target.value as any })
              }
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="AND">AND</option>
              <option value="OR">OR</option>
            </select>
            {onRemove && (
              <Button variant="ghost" size="sm" onClick={onRemove}>
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            )}
          </div>
        </div>

        {!node.collapsed && (
          <div className="mt-3 space-y-3">
            {(node.children || []).map((c) => (
              <div key={c.id} className="pl-4 border-l">
                <AdvancedNodeEditor
                  node={c}
                  onChange={(n) =>
                    onChange({
                      ...node,
                      children: (node.children || []).map((x) =>
                        x.id === n.id ? n : x,
                      ),
                    })
                  }
                  onRemove={() =>
                    onChange({
                      ...node,
                      children: (node.children || []).filter(
                        (x) => x.id !== c.id,
                      ),
                    })
                  }
                />
              </div>
            ))}

            <div className="flex gap-2">
              <Button
                onClick={() =>
                  onChange({
                    ...node,
                    children: [...(node.children || []), NewAdvancedRule()],
                  })
                }
                size="sm"
              >
                <Plus className="h-3 w-3 mr-1" /> Add Condition
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  onChange({
                    ...node,
                    children: [...(node.children || []), NewAdvancedGroup()],
                  })
                }
                size="sm"
              >
                Add Group
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // RULE node
  return (
    <div className="border rounded bg-white p-3">
      <div className="flex items-center gap-3">
        <button onClick={toggleCollapsed} className="p-1">
          {node.collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
        <div className="font-medium">Condition</div>
        <div className="ml-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onChange({
                ...node,
                products: [],
                productIds: [],
                allProducts: true,
              })
            }
          >
            Apply to All Products
          </Button>
        </div>
      </div>

      {!node.collapsed && (
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <div className="text-xs text-muted-foreground">Products</div>
            <div className="mt-2">
              <Input
                placeholder="Search product (name/sku)..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <div className="mt-2 bg-white border rounded">
                {loading ? (
                  <div className="p-3 text-center">
                    <Loader2 className="animate-spin" />
                  </div>
                ) : candidates.length ? (
                  candidates.map((p) => (
                    <div
                      key={p._id}
                      className="p-2 hover:bg-slate-50 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.sku}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          if (
                            (node.products || []).some((x) => x._id === p._id)
                          )
                            return;
                          onChange({
                            ...node,
                            products: [...(node.products || []), p],
                            productIds: [...(node.productIds || []), p._id],
                          });
                        }}
                      >
                        Add
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="p-3 text-xs text-muted-foreground">
                    No results
                  </div>
                )}
              </div>

              <div className="mt-2 flex gap-2 flex-wrap">
                {(node.products || []).map((p) => (
                  <div
                    key={p._id}
                    className="px-2 py-1 bg-slate-100 rounded flex items-center gap-2 text-sm"
                  >
                    <div>{p.name}</div>
                    <button
                      onClick={() =>
                        onChange({
                          ...node,
                          products: (node.products || []).filter(
                            (x) => x._id !== p._id,
                          ),
                          productIds: (node.productIds || []).filter(
                            (id) => id !== p._id,
                          ),
                        })
                      }
                      className="text-red-600"
                    >
                      x
                    </button>
                  </div>
                ))}
                {(node.products || []).length === 0 && (
                  <div className="text-xs text-muted-foreground">
                    No products selected
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Input
              type="number"
              placeholder="minQty"
              value={node.minQty ?? ""}
              onChange={(e) =>
                onChange({
                  ...node,
                  minQty: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
            <Input
              type="number"
              placeholder="minAmount"
              value={node.minAmount ?? ""}
              onChange={(e) =>
                onChange({
                  ...node,
                  minAmount: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
            <div className="text-xs text-muted-foreground">
              Leave blank to ignore
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Main page ---------------- */
export default function SpecialOfferCreatePage() {
  const router = useRouter();

  /* Offer basic */
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [endDate, setEndDate] = useState(() =>
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  );
  const [paymentDueDate, setPaymentDueDate] = useState(() =>
    new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
  );
  const [isActive, setIsActive] = useState(true);
  const [rewardType, setRewardType] = useState<"PRODUCT" | "POINTS" | "OTHER">(
    "PRODUCT",
  );
  const [rewardQuantity, setRewardQuantity] = useState<number>(1);
  const [maxWinners, setMaxWinners] = useState<number | "">("");
  const [maxTimesPerDealer, setMaxTimesPerDealer] = useState<number | "">("");

  /* Targeting */
  const [allDealers, setAllDealers] = useState(false);
  const [dealerQuery, setDealerQuery] = useState("");
  const dealerTimer = useRef<number | null>(null);
  const [dealerCandidates, setDealerCandidates] = useState<Dealer[]>([]);
  const [selectedDealers, setSelectedDealers] = useState<Dealer[]>([]);

  const [zones, setZones] = useState<Zone[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);

  const [selectedZoneIds, setSelectedZoneIds] = useState<ID[]>([]);
  const [selectedRegionIds, setSelectedRegionIds] = useState<ID[]>([]);
  const [selectedAreaIds, setSelectedAreaIds] = useState<ID[]>([]);
  const [selectedTerritoryIds, setSelectedTerritoryIds] = useState<ID[]>([]);

  const [allZones, setAllZones] = useState(false);
  const [allRegions, setAllRegions] = useState(false);
  const [allAreas, setAllAreas] = useState(false);
  const [allTerritories, setAllTerritories] = useState(false);

  /* Rule builders */
  const [mode, setMode] = useState<"SIMPLE" | "ADVANCED">("SIMPLE");

  // Simple builder
  const [simpleLogic, setSimpleLogic] = useState<"AND" | "OR">("AND");
  const [simpleConditions, setSimpleConditions] = useState<SimpleCondition[]>(
    () => [
      {
        id: uid("c"),
        productIds: [],
        productObjects: [],
        allProducts: false,
        productMatchMode: "ANY",
        minQty: null,
        minAmount: null,
      },
    ],
  );

  // Advanced builder initial root
  const [advancedRoot, setAdvancedRoot] = useState<AdvancedNode>(() =>
    NewAdvancedGroup(),
  );

  // product search hook
  const searchProducts = useProductSearch();

  /* Load zones on mount */
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/zones", {
          params: { page: 1, limit: 1000 },
        });
        setZones(res.data?.data || []);
      } catch {
        setZones([]);
      }
    })();
  }, []);

  /* Cascading selects */
  useEffect(() => {
    if (allZones) {
      setRegions([]);
      setSelectedRegionIds([]);
      return;
    }
    if (!selectedZoneIds.length) {
      setRegions([]);
      setSelectedRegionIds([]);
      return;
    }
    (async () => {
      try {
        const res = await api.get("/regions", {
          params: { page: 1, limit: 1000, zone: selectedZoneIds.join(",") },
        });
        setRegions(res.data?.data || []);
        // tidy selected
        setSelectedRegionIds((prev) =>
          prev.filter((id) =>
            (res.data?.data || []).some((r: any) => r._id === id),
          ),
        );
      } catch {
        setRegions([]);
        setSelectedRegionIds([]);
      }
    })();
  }, [selectedZoneIds, allZones]);

  useEffect(() => {
    if (allRegions) {
      setAreas([]);
      setSelectedAreaIds([]);
      return;
    }
    if (!selectedRegionIds.length) {
      setAreas([]);
      setSelectedAreaIds([]);
      return;
    }
    (async () => {
      try {
        const res = await api.get("/areas", {
          params: { page: 1, limit: 1000, region: selectedRegionIds.join(",") },
        });
        setAreas(res.data?.data || []);
        setSelectedAreaIds((prev) =>
          prev.filter((id) =>
            (res.data?.data || []).some((a: any) => a._id === id),
          ),
        );
      } catch {
        setAreas([]);
        setSelectedAreaIds([]);
      }
    })();
  }, [selectedRegionIds, allRegions]);

  useEffect(() => {
    if (allAreas) {
      setTerritories([]);
      setSelectedTerritoryIds([]);
      return;
    }
    if (!selectedAreaIds.length) {
      setTerritories([]);
      setSelectedTerritoryIds([]);
      return;
    }
    (async () => {
      try {
        const res = await api.get("/territories", {
          params: { page: 1, limit: 1000, area: selectedAreaIds.join(",") },
        });
        setTerritories(res.data?.data || []);
        setSelectedTerritoryIds((prev) =>
          prev.filter((id) =>
            (res.data?.data || []).some((t: any) => t._id === id),
          ),
        );
      } catch {
        setTerritories([]);
        setSelectedTerritoryIds([]);
      }
    })();
  }, [selectedAreaIds, allAreas]);

  /* Dealer search debounced */
  useEffect(() => {
    if (!dealerQuery || dealerQuery.trim().length < 2) {
      setDealerCandidates([]);
      if (dealerTimer.current) window.clearTimeout(dealerTimer.current);
      return;
    }
    if (dealerTimer.current) window.clearTimeout(dealerTimer.current);
    dealerTimer.current = window.setTimeout(async () => {
      try {
        const res = await api.get("/dealers", {
          params: { page: 1, limit: 50, q: dealerQuery },
        });
        setDealerCandidates(res.data?.data || []);
      } catch {
        setDealerCandidates([]);
      } finally {
        if (dealerTimer.current) {
          window.clearTimeout(dealerTimer.current);
          dealerTimer.current = null;
        }
      }
    }, 240);
    return () => {
      if (dealerTimer.current) window.clearTimeout(dealerTimer.current);
      dealerTimer.current = null;
    };
  }, [dealerQuery]);

  /* ---------- Simple builder helpers ---------- */
  const addSimpleCondition = () =>
    setSimpleConditions((s) => [
      ...s,
      {
        id: uid("c"),
        productIds: [],
        productObjects: [],
        allProducts: false,
        productMatchMode: "ANY",
        minQty: null,
        minAmount: null,
      },
    ]);

  const updateSimpleCondition = (id: ID, patch: Partial<SimpleCondition>) =>
    setSimpleConditions((s) =>
      s.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );

  const removeSimpleCondition = (id: ID) =>
    setSimpleConditions((s) => s.filter((c) => c.id !== id));

  const setProductsForCondition = (id: ID, products: Product[]) =>
    updateSimpleCondition(id, {
      productObjects: products,
      productIds: products.map((p) => p._id),
    });

  /* shorthand toggle function */
  const toggleIn = (list: ID[], setList: (l: ID[]) => void, id: ID) => {
    setList((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  /* serialization helpers (to server shape) */
  // Advanced: convert AdvancedNode -> server node recursively
  const serializeAdvancedNode = (n: AdvancedNode): any => {
    if (n.type === "GROUP") {
      return {
        type: "GROUP",
        combinationLogic: n.combinationLogic || "AND",
        children: (n.children || []).map(serializeAdvancedNode),
      };
    } else {
      return {
        type: "RULE",
        productIds: n.allProducts
          ? []
          : (n.productIds || []).map((id) => id.toString()),
        minQty: n.minQty ?? undefined,
        minAmount: n.minAmount ?? undefined,
      };
    }
  };

  // Simple -> convert list to a single top-level GROUP (use simpleLogic)
  const serializeSimpleToServer = (conds: SimpleCondition[]) => {
    const children = conds.map((c) => {
      return {
        type: "RULE",
        productIds: c.allProducts
          ? []
          : (c.productIds || []).map((id) => id.toString()),
        minQty: c.minQty ?? undefined,
        minAmount: c.minAmount ?? undefined,
      };
    });
    return { type: "GROUP", combinationLogic: simpleLogic, children };
  };

  /* human readable summary for user */
  const summary = useMemo(() => {
    if (mode === "SIMPLE") {
      if (!simpleConditions.length) return "(no conditions)";
      const parts = simpleConditions.map((c) => {
        const prods = c.allProducts
          ? "ALL_PRODUCTS"
          : (c.productObjects || []).map((p) => p.name).join(", ") ||
            "NO_PRODUCT";
        const qty = c.minQty != null ? `qty≥${c.minQty}` : null;
        const amt = c.minAmount != null ? `amt≥${c.minAmount}` : null;
        const cond = [prods, qty, amt].filter(Boolean).join(" & ");
        return `(${cond})`;
      });
      return parts.join(` ${simpleLogic} `);
    } else {
      // shallow humanization of advancedRoot
      const human = (n: AdvancedNode): string => {
        if (n.type === "GROUP") {
          const ch = (n.children || []).map(human);
          if (!ch.length) return "(empty)";
          return `(${ch.join(` ${n.combinationLogic || "AND"} `)})`;
        } else {
          const prods = n.allProducts
            ? "ALL_PRODUCTS"
            : (n.products || []).map((p) => p.name).join(", ") || "NO_PRODUCT";
          const qty = n.minQty != null ? `qty≥${n.minQty}` : null;
          const amt = n.minAmount != null ? `amt≥${n.minAmount}` : null;
          return [prods, qty, amt].filter(Boolean).join(" & ");
        }
      };
      return human(advancedRoot);
    }
  }, [mode, simpleConditions, simpleLogic, advancedRoot]);

  /* ---------------- Validation ---------------- */
  function validateBeforeSubmit() {
    if (!name.trim()) {
      toast.error("Offer name is required");
      return false;
    }
    if (!startDate || !endDate || new Date(startDate) > new Date(endDate)) {
      toast.error("Start and end date must be valid and start ≤ end");
      return false;
    }
    if (!paymentDueDate || new Date(paymentDueDate) < new Date(startDate)) {
      toast.error("Payment due date must be on/after start date");
      return false;
    }
    // targeting check
    const hasTarget =
      allDealers ||
      selectedDealers.length > 0 ||
      allZones ||
      selectedZoneIds.length > 0 ||
      allRegions ||
      selectedRegionIds.length > 0 ||
      allAreas ||
      selectedAreaIds.length > 0 ||
      allTerritories ||
      selectedTerritoryIds.length > 0;
    if (!hasTarget) {
      toast.error("Select target dealers or locations (or choose All dealers)");
      return false;
    }
    // rules check
    if (mode === "SIMPLE") {
      // at least one condition with product or amount
      const ok = simpleConditions.some(
        (c) =>
          c.allProducts ||
          (c.productIds && c.productIds.length > 0) ||
          c.minAmount != null,
      );
      if (!ok) {
        toast.error("Add at least one valid simple condition (product/amount)");
        return false;
      }
    } else {
      // advanced: ensure serialized has at least one rule leaf with product or amount
      let ok = false;
      const traverse = (n: AdvancedNode) => {
        if (n.type === "RULE") {
          if (
            n.allProducts ||
            (n.productIds && n.productIds.length > 0) ||
            n.minAmount != null
          )
            ok = true;
        } else {
          (n.children || []).forEach(traverse);
        }
      };
      traverse(advancedRoot);
      if (!ok) {
        toast.error(
          "Advanced builder needs at least one rule with products or amount",
        );
        return false;
      }
    }
    if (!rewardQuantity || rewardQuantity <= 0) {
      toast.error("Reward quantity must be > 0");
      return false;
    }
    return true;
  }

  /* ---------------- Submit ---------------- */
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    if (!validateBeforeSubmit()) return;
    setSubmitting(true);

    const offerPayload: any = {
      name: name.trim(),
      description: description.trim() || undefined,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      paymentDueDate: new Date(paymentDueDate),
      isActive,
      rewardType,
      rewardQuantity,
      maxWinners: maxWinners === "" ? undefined : Number(maxWinners),
      maxTimesPerDealer:
        maxTimesPerDealer === "" ? undefined : Number(maxTimesPerDealer),
      targetDealerIds: allDealers ? [] : selectedDealers.map((d) => d._id),
      targetZoneIds: allZones ? [] : selectedZoneIds,
      targetRegionIds: allRegions ? [] : selectedRegionIds,
      targetAreaIds: allAreas ? [] : selectedAreaIds,
      targetTerritoryIds: allTerritories ? [] : selectedTerritoryIds,
    };

    const rulesPayload =
      mode === "SIMPLE"
        ? [serializeSimpleToServer(simpleConditions)]
        : [serializeAdvancedNode(advancedRoot)];

    try {
      // const res = await api.post("/special-offers/with-rules", {
      const res = await api.post("/special-offers", {
        offer: offerPayload,
        rules: rulesPayload,
      });
      toast.success("Special offer created");
      const createdId = res.data?.data?._id || res.data?.data?.id;
      if (createdId) router.push(`/special-offers/${createdId}`);
      else router.push("/special-offers");
    } catch (err: any) {
      console.error("create offer:", err);
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to create offer",
      );
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------------- Small helpers for simple condition product selection ---------------- */
  const addProductToCondition = async (condId: ID, product: Product) => {
    const cond = simpleConditions.find((c) => c.id === condId);
    if (!cond) return;
    if (cond.productIds.includes(product._id)) return;
    setProductsForCondition(condId, [...(cond.productObjects || []), product]);
  };

  const removeProductFromCondition = (condId: ID, pid: ID) => {
    const cond = simpleConditions.find((c) => c.id === condId);
    if (!cond) return;
    const next = (cond.productObjects || []).filter((p) => p._id !== pid);
    updateSimpleCondition(condId, {
      productObjects: next,
      productIds: next.map((p) => p._id),
    });
  };

  /* ---------------- UI render ---------------- */
  return (
    <div className="min-h-screen p-6 bg-slate-50">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Create Special Offer</h1>
            <div className="mt-1 text-sm text-muted-foreground">
              Use <strong>Simple</strong> mode for common offers, or switch to{" "}
              <strong>Advanced</strong> for complex nested logic.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => router.push("/special-offers")}
            >
              Back
            </Button>
            <Button onClick={submit} disabled={submitting}>
              <Check className="h-4 w-4 mr-2" />
              {submitting ? "Creating..." : "Create Offer"}
            </Button>
          </div>
        </div>

        {/* Offer details */}
        <Card>
          <CardHeader>
            <CardTitle>Offer Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-sm text-muted-foreground">Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              <div>
                <label className="text-sm text-muted-foreground">
                  Start Date
                </label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm text-muted-foreground">
                  End Date
                </label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>

              <div className="md:col-span-3">
                <label className="text-sm text-muted-foreground">
                  Description
                </label>
                <textarea
                  className="w-full border rounded px-3 py-2"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm text-muted-foreground">
                  Payment Due Date
                </label>
                <Input
                  type="date"
                  value={paymentDueDate}
                  onChange={(e) => setPaymentDueDate(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm text-muted-foreground">Active</label>
                <Switch
                  checked={isActive}
                  onCheckedChange={(v) => setIsActive(Boolean(v))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Targeting */}
        <Card>
          <CardHeader>
            <CardTitle>Targeting</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Dealers */}
              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Dealers</div>
                    <div className="text-xs text-muted-foreground">
                      Search & select dealers or choose All dealers
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={allDealers}
                      onChange={(e) => {
                        setAllDealers(e.target.checked);
                        if (e.target.checked) setSelectedDealers([]);
                      }}
                    />
                    All dealers
                  </label>
                </div>

                {!allDealers && (
                  <div className="mt-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Search dealers (name/code/phone)..."
                        value={dealerQuery}
                        onChange={(e) => setDealerQuery(e.target.value)}
                      />
                      <Button
                        onClick={() => {
                          setDealerQuery("");
                          setDealerCandidates([]);
                        }}
                      >
                        Clear
                      </Button>
                    </div>

                    <div className="mt-2 flex gap-2 flex-wrap">
                      {selectedDealers.map((d) => (
                        <div
                          key={d._id}
                          className="px-2 py-1 bg-slate-100 rounded flex items-center gap-2 text-sm"
                        >
                          <div>{d.name}</div>
                          <button
                            onClick={() =>
                              setSelectedDealers((s) =>
                                s.filter((x) => x._id !== d._id),
                              )
                            }
                            className="text-red-600"
                          >
                            x
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="mt-2">
                      {dealerCandidates.length > 0 && (
                        <div className="border rounded bg-white">
                          {dealerCandidates.map((d) => (
                            <div
                              key={d._id}
                              className="p-2 hover:bg-slate-50 flex items-center justify-between"
                            >
                              <div>
                                <div className="font-medium">{d.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {d.code} • {d.phoneNumber}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                onClick={() =>
                                  setSelectedDealers((s) =>
                                    s.some((x) => x._id === d._id)
                                      ? s
                                      : [...s, d],
                                  )
                                }
                              >
                                Add
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Locations (cascading) */}
              <div>
                <div className="text-sm font-medium">Locations</div>
                <div className="text-xs text-muted-foreground">
                  Select zones to reveal regions, then areas, then territories.
                </div>

                {/* Zones */}
                <div className="mt-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs">Zones</label>
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={allZones}
                        onChange={(e) => {
                          setAllZones(e.target.checked);
                          if (e.target.checked) setSelectedZoneIds([]);
                        }}
                      />{" "}
                      All zones
                    </label>
                  </div>
                  {!allZones && (
                    <div className="mt-2 flex gap-2 flex-wrap">
                      {zones.map((z) => (
                        <button
                          key={z._id}
                          onClick={() =>
                            toggleIn(selectedZoneIds, setSelectedZoneIds, z._id)
                          }
                          className={`px-2 py-1 rounded text-sm ${selectedZoneIds.includes(z._id) ? "bg-blue-600 text-white" : "bg-slate-100"}`}
                        >
                          {z.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Regions */}
                <div className="mt-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs">Regions</label>
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={allRegions}
                        onChange={(e) => {
                          setAllRegions(e.target.checked);
                          if (e.target.checked) setSelectedRegionIds([]);
                        }}
                      />{" "}
                      All regions
                    </label>
                  </div>
                  {!allRegions &&
                  selectedZoneIds.length === 0 &&
                  regions.length === 0 ? (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Select zones to load regions
                    </div>
                  ) : (
                    <div className="mt-2 flex gap-2 flex-wrap">
                      {regions.map((r) => (
                        <button
                          key={r._id}
                          onClick={() =>
                            toggleIn(
                              selectedRegionIds,
                              setSelectedRegionIds,
                              r._id,
                            )
                          }
                          className={`px-2 py-1 rounded text-sm ${selectedRegionIds.includes(r._id) ? "bg-blue-600 text-white" : "bg-slate-100"}`}
                        >
                          {r.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Areas */}
                <div className="mt-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs">Areas</label>
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={allAreas}
                        onChange={(e) => {
                          setAllAreas(e.target.checked);
                          if (e.target.checked) setSelectedAreaIds([]);
                        }}
                      />{" "}
                      All areas
                    </label>
                  </div>
                  {!allAreas &&
                  selectedRegionIds.length === 0 &&
                  areas.length === 0 ? (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Select regions to load areas
                    </div>
                  ) : (
                    <div className="mt-2 flex gap-2 flex-wrap">
                      {areas.map((a) => (
                        <button
                          key={a._id}
                          onClick={() =>
                            toggleIn(selectedAreaIds, setSelectedAreaIds, a._id)
                          }
                          className={`px-2 py-1 rounded text-sm ${selectedAreaIds.includes(a._id) ? "bg-blue-600 text-white" : "bg-slate-100"}`}
                        >
                          {a.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Territories */}
                <div className="mt-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs">Territories</label>
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={allTerritories}
                        onChange={(e) => {
                          setAllTerritories(e.target.checked);
                          if (e.target.checked) setSelectedTerritoryIds([]);
                        }}
                      />{" "}
                      All territories
                    </label>
                  </div>
                  {!allTerritories &&
                  selectedAreaIds.length === 0 &&
                  territories.length === 0 ? (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Select areas to load territories
                    </div>
                  ) : (
                    <div className="mt-2 flex gap-2 flex-wrap">
                      {territories.map((t) => (
                        <button
                          key={t._id}
                          onClick={() =>
                            toggleIn(
                              selectedTerritoryIds,
                              setSelectedTerritoryIds,
                              t._id,
                            )
                          }
                          className={`px-2 py-1 rounded text-sm ${selectedTerritoryIds.includes(t._id) ? "bg-blue-600 text-white" : "bg-slate-100"}`}
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Limits */}
        <Card>
          <CardHeader>
            <CardTitle>Limits & Winners</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-sm text-muted-foreground">
                  Max Winners (blank = unlimited)
                </label>
                <Input
                  type="number"
                  value={maxWinners === "" ? "" : String(maxWinners)}
                  onChange={(e) =>
                    setMaxWinners(e.target.value ? Number(e.target.value) : "")
                  }
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">
                  Max Times Per Dealer (blank = unlimited)
                </label>
                <Input
                  type="number"
                  value={
                    maxTimesPerDealer === "" ? "" : String(maxTimesPerDealer)
                  }
                  onChange={(e) =>
                    setMaxTimesPerDealer(
                      e.target.value ? Number(e.target.value) : "",
                    )
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mode toggle */}
        <div className="flex items-center gap-3">
          <div className="text-sm font-medium">Rule Builder Mode</div>
          <div className="flex gap-2">
            <button
              onClick={() => setMode("SIMPLE")}
              className={`px-3 py-1 rounded ${mode === "SIMPLE" ? "bg-white shadow-sm" : "bg-slate-100"}`}
            >
              Simple
            </button>
            <button
              onClick={() => setMode("ADVANCED")}
              className={`px-3 py-1 rounded ${mode === "ADVANCED" ? "bg-white shadow-sm" : "bg-slate-100"}`}
            >
              Advanced
            </button>
          </div>
        </div>

        {/* Simple Builder */}
        {mode === "SIMPLE" && (
          <Card>
            <CardHeader>
              <CardTitle>Simple Builder (friendly)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground mb-2">
                Create common offers quickly. Each condition can be "All
                products" or a set of selected products. Combine conditions with
                the overall operator below.
              </div>

              <div className="space-y-3">
                {simpleConditions.map((cond, idx) => (
                  <div key={cond.id} className="border rounded bg-white p-3">
                    <div className="flex items-start gap-3">
                      <div className="font-medium">{`Condition ${idx + 1}`}</div>
                      <div className="ml-auto flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSimpleCondition(cond.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground">
                          Apply To
                        </label>
                        <div className="mt-2 flex items-center gap-2">
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={cond.allProducts}
                              onChange={(e) =>
                                updateSimpleCondition(cond.id, {
                                  allProducts: e.target.checked,
                                  productIds: e.target.checked
                                    ? []
                                    : cond.productIds,
                                })
                              }
                            />{" "}
                            All products
                          </label>
                        </div>

                        {!cond.allProducts && (
                          <>
                            <div className="mt-2">
                              <ProductMultiSelect
                                placeholder="Add products..."
                                selected={cond.productObjects || []}
                                onAdd={(p) => addProductToCondition(cond.id, p)}
                                onRemove={(id) =>
                                  removeProductFromCondition(cond.id, id)
                                }
                              />
                            </div>

                            <div className="mt-2 text-xs text-muted-foreground">
                              Match mode:
                              <select
                                className="ml-2 border rounded px-2 py-1 text-sm"
                                value={cond.productMatchMode}
                                onChange={(e) =>
                                  updateSimpleCondition(cond.id, {
                                    productMatchMode: e.target.value as any,
                                  })
                                }
                              >
                                <option value="ANY">Any of selected</option>
                                <option value="ALL">All selected</option>
                              </select>
                            </div>
                          </>
                        )}
                      </div>

                      <div>
                        <label className="text-xs text-muted-foreground">
                          Min Qty (optional)
                        </label>
                        <Input
                          type="number"
                          value={cond.minQty ?? ""}
                          onChange={(e) =>
                            updateSimpleCondition(cond.id, {
                              minQty: e.target.value
                                ? Number(e.target.value)
                                : null,
                            })
                          }
                        />
                      </div>

                      <div>
                        <label className="text-xs text-muted-foreground">
                          Min Amount (optional)
                        </label>
                        <Input
                          type="number"
                          value={cond.minAmount ?? ""}
                          onChange={(e) =>
                            updateSimpleCondition(cond.id, {
                              minAmount: e.target.value
                                ? Number(e.target.value)
                                : null,
                            })
                          }
                        />
                      </div>

                      {/* presets */}
                      <div className="md:col-span-3 mt-2 flex gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            updateSimpleCondition(cond.id, {
                              minQty: 10,
                              minAmount: null,
                            })
                          }
                        >
                          Preset: Buy 10
                        </Button>
                        <Button
                          size="sm"
                          onClick={() =>
                            updateSimpleCondition(cond.id, {
                              minQty: null,
                              minAmount: 25000,
                            })
                          }
                        >
                          Preset: Spend 25k
                        </Button>
                        <Button
                          size="sm"
                          onClick={() =>
                            updateSimpleCondition(cond.id, {
                              minQty: 6,
                              minAmount: 6000,
                            })
                          }
                        >
                          Preset: Combo
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="flex gap-2">
                  <Button onClick={addSimpleCondition}>
                    <Plus className="h-3 w-3 mr-1" /> Add Condition
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      setSimpleConditions([
                        {
                          id: uid("c"),
                          productIds: [],
                          productObjects: [],
                          allProducts: false,
                          productMatchMode: "ANY",
                          minQty: null,
                          minAmount: null,
                        },
                      ])
                    }
                  >
                    Reset
                  </Button>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <div className="text-sm">Combine conditions with</div>
                  <select
                    value={simpleLogic}
                    onChange={(e) => setSimpleLogic(e.target.value as any)}
                    className="border rounded px-2 py-1"
                  >
                    <option value="AND">AND</option>
                    <option value="OR">OR</option>
                  </select>
                </div>

                <div className="mt-3">
                  <div className="text-sm font-medium">Summary</div>
                  <pre className="text-sm whitespace-pre-wrap bg-slate-50 p-2 rounded">
                    {summary}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Advanced Builder */}
        {mode === "ADVANCED" && (
          <Card>
            <CardHeader>
              <CardTitle>Advanced Builder (power user)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground mb-2">
                Build nested groups and rules. Useful for complex expressions
                like <em>(A AND B) OR (C AND (B OR D))</em>.
              </div>
              <div>
                <AdvancedNodeEditor
                  node={advancedRoot}
                  onChange={(n) => setAdvancedRoot(n)}
                />
              </div>
              <div className="mt-3">
                <Button
                  variant="outline"
                  onClick={() => setAdvancedRoot(NewAdvancedGroup())}
                >
                  Reset Builder
                </Button>
              </div>

              <div className="mt-3">
                <div className="text-sm font-medium">Summary</div>
                <pre className="text-sm whitespace-pre-wrap bg-slate-50 p-2 rounded">
                  {summary}
                </pre>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Reward */}
        <Card>
          <CardHeader>
            <CardTitle>Reward</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-sm text-muted-foreground">
                  Reward Type
                </label>
                <select
                  className="w-full border rounded px-2 py-2"
                  value={rewardType}
                  onChange={(e) => setRewardType(e.target.value as any)}
                >
                  <option value="PRODUCT">PRODUCT</option>
                  <option value="POINTS">POINTS</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">
                  Reward Quantity
                </label>
                <Input
                  type="number"
                  value={String(rewardQuantity)}
                  onChange={(e) =>
                    setRewardQuantity(Number(e.target.value || 0))
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* footer */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Tip: use Simple mode for common offers, Advanced when you need
            nested logic.
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => router.push("/special-offers")}
            >
              Cancel
            </Button>
            <Button onClick={submit} disabled={submitting}>
              <Check className="h-4 w-4 mr-2" />{" "}
              {submitting ? "Creating..." : "Create Offer"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
