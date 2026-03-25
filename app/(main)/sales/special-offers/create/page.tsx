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
 * Create Special Offer — Advanced Rule Builder
 *
 * Backend endpoints used:
 * - GET /zones?page=1&limit=1000
 * - GET /regions?page=1&limit=1000&zone=<zoneIdsComma>
 * - GET /areas?page=1&limit=1000®ion=<regionIdsComma>
 * - GET /territories?page=1&limit=1000&area=<areaIdsComma>
 * - GET /dealers?page=1&limit=50&q=...
 * - GET /products?page=1&limit=50&q=...
 * - POST /special-offers/with-rules { offer, rules }
 *
 * Rules payload shape: matches ISpecialOfferRuleNode:
 * - GROUP: { type: "GROUP", combinationLogic: "AND"|"OR", children: [...] }
 * - RULE: { type: "RULE", productIds: [...], minQty?, minAmount? }
 */

/* ---------------- Types ---------------- */
type ID = string;

type Zone = { _id: ID; name: string };
type Region = { _id: ID; name: string; zone?: ID };
type Area = { _id: ID; name: string; region?: ID };
type Territory = { _id: ID; name: string; area?: ID };
type Dealer = { _id: ID; name: string; code?: string; phoneNumber?: string };
type Product = { _id: ID; name: string; sku?: string; unit?: string };

/* ---------------- Rule Node Interfaces (client) ---------------- */
type NodeType = "GROUP" | "RULE";

type RuleNode = {
  id: ID; // client id
  type: NodeType;
  // for GROUP:
  combinationLogic?: "AND" | "OR";
  children?: RuleNode[];
  collapsed?: boolean;
  // for RULE:
  productIds?: ID[]; // product object ids
  products?: Product[]; // client-side product objects
  allProducts?: boolean;
  minQty?: number;
  minAmount?: number;
};

/* ---------------- Helpers ---------------- */
function uid(prefix = "n") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function newGroupNode(): RuleNode {
  return {
    id: uid("g"),
    type: "GROUP",
    combinationLogic: "AND",
    children: [],
    collapsed: false,
  };
}

function newRuleNode(): RuleNode {
  return {
    id: uid("r"),
    type: "RULE",
    products: [],
    productIds: [],
    allProducts: false,
    minQty: undefined,
    minAmount: undefined,
  };
}

/* ---------------- Recursively convert tree to server shape ---------------- */
function serializeNode(node: RuleNode): any {
  if (node.type === "GROUP") {
    return {
      type: "GROUP",
      combinationLogic: node.combinationLogic || "AND",
      children: (node.children || []).map(serializeNode),
    };
  } else {
    return {
      type: "RULE",
      productIds: node.allProducts
        ? []
        : (node.productIds || []).map((id) => id.toString()),
      minQty: node.minQty,
      minAmount: node.minAmount,
    };
  }
}

/* ---------------- Human readable summary (infix) ---------------- */
function humanize(node: RuleNode): string {
  if (node.type === "RULE") {
    const prods = node.allProducts
      ? "ALL_PRODUCTS"
      : node.products?.map((p) => p.name).join(", ") ||
        node.productIds?.join(", ") ||
        "NO_PRODUCT";
    const parts: string[] = [prods];
    if (node.minQty != null) parts.push(`qty≥${node.minQty}`);
    if (node.minAmount != null) parts.push(`amt≥${node.minAmount}`);
    return parts.join(" & ");
  } else {
    const op = node.combinationLogic || "AND";
    const children = (node.children || []).map(humanize);
    if (!children.length) return "(empty)";
    // wrap children with parentheses if they contain groups
    const joined = children
      .map((c) =>
        c.includes(" & ") || c.includes(" OR ") || c.includes(" AND ")
          ? `(${c})`
          : c,
      )
      .join(` ${op} `);
    return joined;
  }
}

/* ---------------- RuleEditor component (recursive) ---------------- */
function RuleNodeEditor({
  node,
  onUpdate,
  onRemove,
  searchProducts,
}: {
  node: RuleNode;
  onUpdate: (n: RuleNode) => void;
  onRemove?: () => void;
  searchProducts: (q: string) => Promise<Product[]>;
}) {
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setCandidates([]);
      setLoading(false);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      return;
    }
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setLoading(true);
    timerRef.current = window.setTimeout(async () => {
      try {
        const res = await searchProducts(query);
        setCandidates(res || []);
      } catch {
        setCandidates([]);
      } finally {
        setLoading(false);
      }
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }, 220);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [query, searchProducts]);

  const toggleCollapsed = () => {
    onUpdate({ ...node, collapsed: !node.collapsed });
  };

  // Group actions
  const addGroupChild = () => {
    const child = newGroupNode();
    onUpdate({ ...node, children: [...(node.children || []), child] });
  };
  const addRuleChild = () => {
    const child = newRuleNode();
    onUpdate({ ...node, children: [...(node.children || []), child] });
  };

  const updateChild = (childId: ID, patch: Partial<RuleNode>) => {
    if (!node.children) return;
    const children = node.children.map((c) =>
      c.id === childId ? { ...c, ...patch } : c,
    );
    onUpdate({ ...node, children });
  };

  const removeChild = (childId: ID) => {
    onUpdate({
      ...node,
      children: (node.children || []).filter((c) => c.id !== childId),
    });
  };

  // Rule (leaf) actions
  const addProductToLeaf = (p: Product) => {
    if (node.type !== "RULE") return;
    const existing = node.products || [];
    if (existing.some((x) => x._id === p._id)) return;
    const nextProducts = [...existing, p];
    onUpdate({
      ...node,
      products: nextProducts,
      productIds: nextProducts.map((x) => x._id),
    });
    setQuery("");
    setCandidates([]);
  };

  const removeProductFromLeaf = (pid: ID) => {
    if (node.type !== "RULE") return;
    const nextProducts = (node.products || []).filter((x) => x._id !== pid);
    onUpdate({
      ...node,
      products: nextProducts,
      productIds: nextProducts.map((x) => x._id),
    });
  };

  return (
    <div className="border rounded bg-white p-3">
      <div className="flex items-start gap-3">
        <button onClick={toggleCollapsed} className="p-1">
          {node.collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>

        <div className="flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="text-sm font-medium">
                {node.type === "GROUP" ? `Group` : `Rule`}
              </div>
              {node.type === "GROUP" && (
                <div className="text-xs text-muted-foreground">
                  {node.combinationLogic}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {onRemove && (
                <Button variant="ghost" size="sm" onClick={onRemove}>
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              )}
            </div>
          </div>

          {!node.collapsed && node.type === "GROUP" && (
            <div className="mt-3">
              <div className="flex items-center gap-3">
                <label className="text-xs text-muted-foreground">Logic</label>
                <select
                  className="border rounded px-2 py-1 text-sm"
                  value={node.combinationLogic}
                  onChange={(e) =>
                    onUpdate({
                      ...node,
                      combinationLogic: e.target.value as any,
                    })
                  }
                >
                  <option value="AND">AND</option>
                  <option value="OR">OR</option>
                </select>

                <div className="ml-auto flex gap-2">
                  <Button onClick={addRuleChild} size="sm">
                    <Plus className="h-3 w-3 mr-1" /> Add Condition
                  </Button>
                  <Button variant="outline" onClick={addGroupChild} size="sm">
                    Add Group
                  </Button>
                </div>
              </div>

              <div className="mt-3 space-y-3">
                {(node.children || []).map((c) => (
                  <div key={c.id} className="pl-3 border-l">
                    <RuleNodeEditor
                      node={c}
                      onUpdate={(n) => updateChild(c.id, n)}
                      onRemove={() => removeChild(c.id)}
                      searchProducts={searchProducts}
                    />
                  </div>
                ))}
                {(node.children || []).length === 0 && (
                  <div className="text-xs text-muted-foreground mt-2">
                    No children — add conditions or groups.
                  </div>
                )}
              </div>
            </div>
          )}

          {!node.collapsed && node.type === "RULE" && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <div className="flex items-center gap-3">
                  <label className="text-xs text-muted-foreground">
                    Products
                  </label>
                  <label className="flex items-center gap-2 text-xs ml-auto">
                    <input
                      type="checkbox"
                      checked={!!node.allProducts}
                      onChange={(e) =>
                        onUpdate({
                          ...node,
                          allProducts: e.target.checked,
                          products: e.target.allProducts ? [] : node.products,
                        })
                      }
                    />
                    All products
                  </label>
                </div>

                {!node.allProducts && (
                  <>
                    <div className="mt-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Input
                            placeholder="Search product (name/sku)..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                          />
                        </PopoverTrigger>
                        <PopoverContent className="w-[420px]">
                          <div className="p-2">
                            <Command>
                              <CommandInput
                                placeholder="Type product name or SKU..."
                                value={query}
                                onValueChange={(v) => setQuery(v)}
                              />
                              <CommandEmpty>No results</CommandEmpty>
                              <CommandGroup>
                                {loading ? (
                                  <div className="p-3 text-center">
                                    <Loader2 className="animate-spin" />
                                  </div>
                                ) : candidates && candidates.length ? (
                                  candidates.map((p) => (
                                    <CommandItem
                                      key={p._id}
                                      value={p.name}
                                      onSelect={() => addProductToLeaf(p)}
                                    >
                                      <div className="flex items-center justify-between w-full">
                                        <div>
                                          <div className="font-medium">
                                            {p.name}
                                          </div>
                                          <div className="text-xs text-muted-foreground">
                                            {p.sku}
                                          </div>
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                          {p.unit ?? "pcs"}
                                        </div>
                                      </div>
                                    </CommandItem>
                                  ))
                                ) : (
                                  <div className="p-3 text-sm text-muted-foreground">
                                    No results
                                  </div>
                                )}
                              </CommandGroup>
                            </Command>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="mt-2 flex gap-2 flex-wrap">
                      {(node.products || []).map((p) => (
                        <div
                          key={p._id}
                          className="px-2 py-1 bg-slate-100 rounded flex items-center gap-2 text-sm"
                        >
                          <div>{p.name}</div>
                          <button
                            onClick={() => removeProductFromLeaf(p._id)}
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
                  </>
                )}
              </div>

              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="minQty"
                  value={node.minQty ?? ""}
                  onChange={(e) =>
                    onUpdate({
                      ...node,
                      minQty: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    })
                  }
                />
                <Input
                  type="number"
                  placeholder="minAmount"
                  value={node.minAmount ?? ""}
                  onChange={(e) =>
                    onUpdate({
                      ...node,
                      minAmount: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    })
                  }
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Main Page ---------------- */
export default function SpecialOfferCreatePage() {
  const router = useRouter();

  /* ===== Offer fields ===== */
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [endDate, setEndDate] = useState<string>(
    new Date(Date.now() + 7 * 86400 * 1000).toISOString().slice(0, 10),
  );
  const [paymentDueDate, setPaymentDueDate] = useState<string>(
    new Date(Date.now() + 14 * 86400 * 1000).toISOString().slice(0, 10),
  );
  const [isActive, setIsActive] = useState(true);

  const [rewardType, setRewardType] = useState<"PRODUCT" | "POINTS" | "OTHER">(
    "PRODUCT",
  );
  const [rewardQuantity, setRewardQuantity] = useState<number>(1);

  const [maxWinners, setMaxWinners] = useState<number | "">("");
  const [maxTimesPerDealer, setMaxTimesPerDealer] = useState<number | "">(1);

  /* ===== Targeting ===== */
  const [allDealers, setAllDealers] = useState(false);
  const [dealerQuery, setDealerQuery] = useState("");
  const dealerTimer = useRef<number | null>(null);
  const [dealerCandidates, setDealerCandidates] = useState<Dealer[]>([]);
  const [selectedDealers, setSelectedDealers] = useState<Dealer[]>([]);

  /* ===== Locations (cascading) ===== */
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

  /* ===== Rule tree (root group) ===== */
  const [root, setRoot] = useState<RuleNode>(() => {
    const g = newGroupNode();
    g.children = [newRuleNode()];
    return g;
  });

  /* ===== Product search cache - single function used by all nodes ===== */
  const productSearchCache = useRef<Record<string, Product[]>>({});
  const searchProducts = useCallback(async (q: string) => {
    if (!q || q.trim().length < 2) return [];
    if (productSearchCache.current[q]) return productSearchCache.current[q];
    try {
      const res = await api.get("/products", {
        params: { page: 1, limit: 50, q },
      });
      productSearchCache.current[q] = res.data?.data || [];
      return productSearchCache.current[q];
    } catch {
      return [];
    }
  }, []);

  /* ---------------- Load zones at start ---------------- */
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/zones?page=1&limit=1000");
        setZones(res.data?.data || []);
      } catch {
        setZones([]);
      }
    })();
  }, []);

  /* ---------------- Regions when zones change ---------------- */
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
        // cleanup selected regions not in new list
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

  /* ---------------- Areas when regions change ---------------- */
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

  /* ---------------- Territories when areas change ---------------- */
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

  /* ---------------- Dealer search (debounced) ---------------- */
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

  const addDealer = (d: Dealer) => {
    if (selectedDealers.some((s) => s._id === d._id)) return;
    setSelectedDealers((s) => [...s, d]);
  };
  const removeDealer = (id: ID) =>
    setSelectedDealers((s) => s.filter((x) => x._id !== id));
  const clearDealers = () => setSelectedDealers([]);

  /* ---------------- Rule tree helpers ---------------- */
  const updateNodeRecursively = (
    nodeId: ID,
    patch: Partial<RuleNode>,
    current: RuleNode,
  ): RuleNode => {
    if (current.id === nodeId) return { ...current, ...patch };
    if (current.children) {
      return {
        ...current,
        children: current.children.map((c) =>
          updateNodeRecursively(nodeId, patch, c),
        ),
      };
    }
    return current;
  };

  const replaceRoot = (newRoot: RuleNode) => setRoot(newRoot);

  const updateNode = (nodeId: ID, patch: Partial<RuleNode>) => {
    setRoot((r) => updateNodeRecursively(nodeId, patch, r));
  };

  const addChildToNode = (parentId: ID, child: RuleNode) => {
    const helper = (cur: RuleNode): RuleNode => {
      if (cur.id === parentId) {
        cur.children = [...(cur.children || []), child];
        return { ...cur };
      }
      if (cur.children) cur.children = cur.children.map(helper);
      return { ...cur };
    };
    setRoot((r) => helper(r));
  };

  const removeNode = (nodeId: ID) => {
    const helper = (cur: RuleNode): RuleNode | null => {
      if (cur.id === nodeId) return null;
      if (!cur.children) return cur;
      const children = cur.children.map(helper).filter(Boolean) as RuleNode[];
      return { ...cur, children };
    };
    setRoot((r) => {
      const next = helper(r);
      // if root removed (shouldn't happen) create a fresh root
      return (
        next ||
        (() => {
          const g = newGroupNode();
          g.children = [newRuleNode()];
          return g;
        })()
      );
    });
  };

  const addGroupUnder = (parentId: ID) =>
    addChildToNode(parentId, newGroupNode());
  const addRuleUnder = (parentId: ID) =>
    addChildToNode(parentId, newRuleNode());

  /* ---------------- Human readable summary ---------------- */
  const summary = useMemo(() => humanize(root), [root]);

  /* ---------------- Validation ---------------- */
  function validate(): boolean {
    if (!name.trim()) {
      toast.error("Offer name is required");
      return false;
    }
    if (!startDate || !endDate || new Date(startDate) > new Date(endDate)) {
      toast.error("Start and end date must be valid and start <= end");
      return false;
    }
    if (!paymentDueDate || new Date(paymentDueDate) < new Date(startDate)) {
      toast.error("Payment due date should be on/after start date");
      return false;
    }
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
      toast.error(
        "Select target dealers or locations (or choose 'All dealers')",
      );
      return false;
    }
    // ensure there's at least one rule leaf that has products or amount
    let ok = false;
    const traverse = (n: RuleNode) => {
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
    traverse(root);
    if (!ok) {
      toast.error("Add at least one valid rule (product selection or amount).");
      return false;
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
    if (!validate()) return;
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

    const rulesPayload = [serializeNode(root)];

    try {
      //   const res = await api.post("/special-offers/with-rules", {
      const res = await api.post("/special-offers", {
        offer: offerPayload,
        rules: rulesPayload,
      });
      toast.success("Special offer created");
      const createdId = res.data?.data?._id || res.data?.data?.id;
      router.push(`/special-offers/${createdId}`);
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

  /* ---------------- Tiny UI helpers ---------------- */
  const toggleIn = (list: ID[], setList: (l: ID[]) => void, id: ID) => {
    setList((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  return (
    <div className="min-h-screen p-6 bg-slate-50">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Create Special Offer</h1>
            <div className="mt-1 text-sm text-muted-foreground">
              Advanced rule builder: compose nested AND/OR groups and product
              conditions.
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
              <Check className="h-4 w-4 mr-2" />{" "}
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
                        if (e.target.checked) clearDealers();
                      }}
                    />{" "}
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
                            onClick={() => removeDealer(d._id)}
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
                              <Button size="sm" onClick={() => addDealer(d)}>
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

              {/* Locations */}
              <div>
                <div className="text-sm font-medium">Locations (cascading)</div>
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

        {/* Rule builder */}
        <Card>
          <CardHeader>
            <CardTitle>Rules (Advanced Builder)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground mb-3">
              Compose rules visually. Groups combine children with{" "}
              <strong>AND</strong> or <strong>OR</strong>. Example:{" "}
              <em>(A AND B) OR (C AND (B OR D))</em>
            </div>

            <div>
              <RuleNodeEditor
                node={root}
                onUpdate={(n) => replaceRoot(n)}
                searchProducts={searchProducts}
              />
            </div>

            <div className="mt-3 flex gap-2">
              <Button
                onClick={() => {
                  /* add top-level group child */ replaceRoot({
                    ...root,
                    children: [...(root.children || []), newRuleNode()],
                  });
                }}
              >
                <Plus className="h-3 w-3 mr-1" /> Add Top-level Condition
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  replaceRoot(newGroupNode());
                }}
              >
                Reset Builder
              </Button>
            </div>

            <div className="mt-3">
              <div className="text-sm font-medium">Rule Summary</div>
              <pre className="text-sm whitespace-pre-wrap bg-slate-50 p-2 rounded">
                {summary}
              </pre>
            </div>
          </CardContent>
        </Card>

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

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Advanced mode — use carefully. You can switch to a simple mode later
            if needed.
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
