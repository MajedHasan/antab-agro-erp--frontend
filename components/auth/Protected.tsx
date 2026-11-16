"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSelector } from "react-redux";

import { RootState } from "@/store/store";
import { canAccess } from "@/utils/rbac";

type Props = {
  children: React.ReactNode;

  /** Permissions required. Wildcards ("sales.*", "*") are honored. */
  permissions?: string | string[];

  /** Roles required (name comparison, case-insensitive). */
  roles?: string | string[];

  /** "any" (default) or "all". Applies to both roles and permissions axes. */
  match?: "any" | "all";

  /** Shown instead of the page while redirecting or loading. */
  fallback?: React.ReactNode;

  /** Shown on the full-page loader while the session is initializing. */
  loadingComponent?: React.ReactNode;
};

function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#3aa838]" />
        <span className="text-xs text-slate-400">Loading…</span>
      </div>
    </div>
  );
}

export default function Protected({
  children,
  permissions,
  roles,
  match = "any",
  fallback = null,
  loadingComponent = <Loading />,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const { currentUser, isAuthenticated, loading } = useSelector(
    (state: RootState) => state.user,
  );

  // Session resolved = we have finished loading AND (either not auth OR user loaded)
  const sessionResolved = !loading;
  const signedIn = sessionResolved && isAuthenticated && Boolean(currentUser);

  const allowed =
    signedIn && canAccess(currentUser, { roles, permissions, match });

  useEffect(() => {
    if (!sessionResolved) return;

    // Build the intended destination, preserving query string
    const search =
      typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : "";
    const from = pathname + (search ? `?${search}` : "");

    if (!signedIn) {
      router.replace(`/login?from=${encodeURIComponent(from)}`);
      return;
    }

    if (!allowed) {
      const params = new URLSearchParams();
      params.set("from", from);
      params.set("reason", roles ? "role" : "permission");

      const requiredRole = Array.isArray(roles)
        ? roles.join(", ")
        : roles || "";
      if (requiredRole) params.set("requiredRole", requiredRole);

      const requiredPerm = Array.isArray(permissions)
        ? permissions.join(", ")
        : permissions || "";
      if (requiredPerm) params.set("requiredPermission", requiredPerm);

      router.replace(`/unauthorized?${params.toString()}`);
    }
  }, [
    sessionResolved,
    signedIn,
    allowed,
    roles,
    permissions,
    pathname,
    router,
  ]);

  if (!sessionResolved) return <>{loadingComponent}</>;
  if (!signedIn || !allowed) return <>{fallback}</>;

  return <>{children}</>;
}