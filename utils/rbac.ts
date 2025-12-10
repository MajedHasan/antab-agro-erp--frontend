import { User } from "@/store/slices/userSlice";

export function getUserPermissions(user: User | null): string[] {
  if (!user) return [];
  // role may be a string name OR object with permissions
  const role = (user as any).role;
  if (!role) return [];
  if (typeof role === "string") {
    // We don't have per-role permissions on client; but if role string is Super Admin treat as all-permission
    if (role.toLowerCase().includes("super")) {
      return ["*"]; // wildcard
    }
    return []; // no detailed permissions known
  }
  // role is populated object
  return Array.isArray(role.permissions) ? role.permissions : [];
}

export function hasPermission(user: User | null, required?: string | string[]) {
  if (!required) return true; // nothing required
  const requiredList = Array.isArray(required) ? required : [required];

  // if user is super admin (role.name) grant all
  const role = (user as any)?.role;
  if (role) {
    if (typeof role === "string" && role.toLowerCase().includes("super"))
      return true;
    if (role.name && role.name.toLowerCase().includes("super")) return true;
    if (role.isSystem === true) return true;
  }

  const userPerms = getUserPermissions(user);
  if (userPerms.includes("*")) return true;

  return requiredList.every((r) => userPerms.includes(r));
}

export function hasAnyPermission(
  user: User | null,
  required?: string | string[]
) {
  if (!required) return true;
  const requiredList = Array.isArray(required) ? required : [required];

  const role = (user as any)?.role;
  if (!role) return false;

  // super admin override
  if (
    (typeof role === "string" && role.toLowerCase().includes("super")) ||
    (role.name && role.name.toLowerCase().includes("super")) ||
    role.isSystem === true
  ) {
    return true;
  }

  const userPerms = getUserPermissions(user);
  if (userPerms.includes("*")) return true;

  return requiredList.some((r) => userPerms.includes(r));
}

export function hasRole(user: User | null, roles?: string | string[]) {
  if (!roles) return true;
  if (!user) return false;
  const want = Array.isArray(roles) ? roles : [roles];
  const role = (user as any)?.role;
  const roleName = typeof role === "string" ? role : role?.name;
  if (!roleName) return false;
  return want.some((r) => roleName.toLowerCase() === r.toLowerCase());
}

export function canAccess(
  user: User | null,
  opts: {
    roles?: string[];
    permissions?: string | string[];
    match?: "any" | "all"; // <— NEW
  }
) {
  if (opts.roles && !hasRole(user, opts.roles)) return false;
  if (opts.permissions) {
    const mode = opts.match || "any";

    if (mode === "any" && !hasAnyPermission(user, opts.permissions))
      return false;
    if (mode === "all" && !hasPermission(user, opts.permissions)) return false;
  }
  return true;
}
