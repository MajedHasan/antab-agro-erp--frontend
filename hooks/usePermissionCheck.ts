"use client";

import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { canAccess } from "@/utils/rbac";

type CheckOptions = {
  permissions?: string | string[];
  roles?: string | string[];
  match?: "any" | "all";
};

/**
 * Returns a stable function for UI-level checks (hide buttons, disable links).
 *
 * const hasAccess = usePermissionCheck();
 * hasAccess({ permissions: "sales.create" }) → boolean
 */
export default function usePermissionCheck() {
  const user = useSelector((state: RootState) => state.user.currentUser);

  return (opts: CheckOptions) => canAccess(user, opts);
}