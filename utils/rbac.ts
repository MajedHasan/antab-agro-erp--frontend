/**
 * Frontend RBAC — mirrors backend `authorize()` semantics.
 *
 * Permissions may arrive from the API as either:
 *   - ["users.view", "roles.view"]                              (strings)
 *   - [{ _id, name: "users.view", description }, ...]           (populated)
 *
 * Role may arrive as:
 *   - "NSM"                                                     (string)
 *   - { _id, name: "NSM", isSystem: false, permissions: [...] } (populated)
 *   - undefined                                                 (not loaded)
 *
 * A user with `role.isSystem === true` (Super Admin) is granted EVERYTHING,
 * matching the backend `getEffectivePermissions` -> ["*"] shortcut.
 */

export type RawPermission = string | { name?: string };

export type RoleShape = {
  _id?: string;
  id?: string;
  name?: string;
  code?: string;
  isSystem?: boolean;
  permissions?: RawPermission[];
};

export type RbacUser = {
  id?: string;
  _id?: string;
  email?: string;
  name?: string;
  role?: string | RoleShape;
} | null;

/* -------------------------------------------------------------
 * Internal helpers
 * ----------------------------------------------------------- */

function isSuperAdmin(role: string | RoleShape | undefined): boolean {
  if (!role) return false;

  if (typeof role === "string") {
    return role.toLowerCase().includes("super");
  }

  if (role.isSystem === true) return true;
  if (typeof role.name === "string" && role.name.toLowerCase().includes("super")) {
    return true;
  }
  return false;
}

function normalizePermissions(role: string | RoleShape | undefined): string[] {
  if (!role || typeof role === "string") return [];

  const raw = role.permissions;
  if (!Array.isArray(raw)) return [];

  const out: string[] = [];
  for (const p of raw) {
    if (typeof p === "string" && p.length > 0) out.push(p);
    else if (p && typeof p === "object" && typeof p.name === "string" && p.name) {
      out.push(p.name);
    }
  }
  return out;
}

function matches(granted: string, required: string): boolean {
  if (granted === "*") return true;
  if (granted === required) return true;

  // "sales.*" grants "sales.view", "sales.create", ...
  if (granted.endsWith(".*")) {
    const prefix = granted.slice(0, -1); // keeps trailing dot
    return required.startsWith(prefix);
  }
  return false;
}

function toArray(v?: string | string[]): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

/* -------------------------------------------------------------
 * Public API
 * ----------------------------------------------------------- */

/**
 * Effective permissions of the user.
 * Returns `["*"]` for Super Admin so `.includes("*")` behaves consistently.
 */
export function getUserPermissions(user: RbacUser): string[] {
  if (!user) return [];
  const role = user.role;
  if (isSuperAdmin(role)) return ["*"];
  return normalizePermissions(role);
}

/**
 * All requested permissions must be granted. Wildcards honored.
 */
export function hasPermission(user: RbacUser, required?: string | string[]): boolean {
  const list = toArray(required);
  if (list.length === 0) return true;

  if (!user) return false;
  if (isSuperAdmin(user.role)) return true;

  const granted = getUserPermissions(user);
  if (granted.includes("*")) return true;

  return list.every((r) => granted.some((g) => matches(g, r)));
}

/**
 * Any one requested permission is enough. Wildcards honored.
 */
export function hasAnyPermission(user: RbacUser, required?: string | string[]): boolean {
  const list = toArray(required);
  if (list.length === 0) return true;

  if (!user) return false;
  if (isSuperAdmin(user.role)) return true;

  const granted = getUserPermissions(user);
  if (granted.includes("*")) return true;

  return list.some((r) => granted.some((g) => matches(g, r)));
}

function roleNameOf(user: RbacUser): string {
  if (!user) return "";
  const role = user.role;
  if (!role) return "";
  if (typeof role === "string") return role;
  return role.name || role.code || "";
}

export function hasRole(user: RbacUser, roles?: string | string[]): boolean {
  const list = toArray(roles);
  if (list.length === 0) return true;
  const name = roleNameOf(user);
  if (!name) return false;
  return list.some((r) => r.toLowerCase() === name.toLowerCase());
}

export function hasAllRoles(user: RbacUser, roles?: string | string[]): boolean {
  const list = toArray(roles);
  if (list.length === 0) return true;
  const name = roleNameOf(user);
  if (!name) return false;
  return list.every((r) => r.toLowerCase() === name.toLowerCase());
}

/**
 * Combined role + permission gate.
 *
 * - `match: "any"` (default): role-any AND permission-any
 * - `match: "all"`:           role-all AND permission-all
 */
export function canAccess(
  user: RbacUser,
  opts: {
    roles?: string | string[];
    permissions?: string | string[];
    match?: "any" | "all";
  } = {},
): boolean {
  const mode = opts.match ?? "any";

  if (opts.roles && opts.roles.length) {
    const ok =
      mode === "all" ? hasAllRoles(user, opts.roles) : hasRole(user, opts.roles);
    if (!ok) return false;
  }

  if (opts.permissions && opts.permissions.length) {
    const ok =
      mode === "all"
        ? hasPermission(user, opts.permissions)
        : hasAnyPermission(user, opts.permissions);
    if (!ok) return false;
  }

  return true;
}