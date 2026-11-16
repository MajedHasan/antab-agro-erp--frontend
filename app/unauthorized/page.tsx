// src/app/unauthorized/page.tsx
"use client";

import React, { Suspense, useCallback, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useSelector } from "react-redux";

import {
  ShieldX,
  ShieldAlert,
  Home,
  ArrowLeft,
  LogOut,
  KeyRound,
  UserCircle2,
  Mail,
  AlertTriangle,
  Lock,
  LifeBuoy,
  CheckCircle2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { RootState } from "@/store/store";

/* --------------------------- Config --------------------------- */
const LOGIN_PATH = process.env.NEXT_PUBLIC_LOGIN_PATH || "/login";
const DASHBOARD_PATH = process.env.NEXT_PUBLIC_DASHBOARD_PATH || "/";
const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@antabagro.com";

/* --------------------------- Types --------------------------- */
export type UserRole = string | { name?: string; code?: string };

export type CurrentUser = {
  id?: string;
  name?: string;
  email?: string;
  role?: UserRole;
};

/* --------------------------- Helpers --------------------------- */
function roleLabel(role: UserRole | null | undefined): string {
  if (!role) return "—";
  if (typeof role === "string") return role;
  return role.name || role.code || "—";
}

/* --------------------------- Inner content (uses useSearchParams) --------------------------- */
function UnauthorizedContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentUser = useSelector(
    (s: RootState) => (s as any).user?.currentUser ?? null,
  ) as CurrentUser;

  // Optional context passed by your route-guard / middleware
  // e.g. /unauthorized?from=/admin/users&requiredRole=Admin&reason=role
  const fromParam = searchParams.get("from") || "";
  const requiredRole = searchParams.get("requiredRole") || "";
  const reason = searchParams.get("reason") || "";

  const isSignedIn = Boolean(currentUser?.id || currentUser?.email);
  const userRole = roleLabel(currentUser?.role);
  const displayName =
    currentUser?.name || currentUser?.email || "your account";

  const attemptedPath = useMemo(() => {
    if (fromParam) return fromParam;
    if (pathname && pathname !== "/unauthorized") return pathname;
    return "";
  }, [fromParam, pathname]);

  /* --------------------------- Actions --------------------------- */
  const handleGoBack = useCallback(() => {
    try {
      if (typeof window !== "undefined" && window.history.length > 1) {
        router.back();
        return;
      }
    } catch {
      // ignore
    }
    router.push(DASHBOARD_PATH);
  }, [router]);

  const handleGoHome = useCallback(() => {
    router.push(DASHBOARD_PATH);
  }, [router]);

  const handleSignInAsDifferent = useCallback(() => {
    // Clear local tokens so login doesn't auto-bounce back
    try {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      sessionStorage.clear();
    } catch {
      // ignore
    }
    const redirect = attemptedPath
      ? `${LOGIN_PATH}?from=${encodeURIComponent(attemptedPath)}`
      : LOGIN_PATH;
    router.push(redirect);
  }, [router, attemptedPath]);

  const handleContactSupport = useCallback(() => {
    const subject = encodeURIComponent(
      `Access Denied ${attemptedPath ? `on ${attemptedPath}` : ""}`.trim(),
    );
    const body = encodeURIComponent(
      [
        `Hi team,`,
        ``,
        `I was denied access to: ${attemptedPath || "(unknown page)"}`,
        requiredRole ? `Required role: ${requiredRole}` : "",
        reason ? `Reason: ${reason}` : "",
        ``,
        `Signed in as: ${displayName} (${userRole})`,
        ``,
        `Please review my permissions.`,
      ]
        .filter(Boolean)
        .join("\n"),
    );
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  }, [attemptedPath, requiredRole, reason, displayName, userRole]);

  /* --------------------------- Reason text --------------------------- */
  const reasonText = useMemo(() => {
    if (reason === "role")
      return "Your role doesn't include this page. Ask an administrator to grant access.";
    if (reason === "permission")
      return "A required permission is missing from your account.";
    if (reason === "auth")
      return "Your session has expired. Please sign in again.";
    if (reason === "tenant")
      return "This resource belongs to a different organization.";
    return "Your account doesn't have the permissions required to view this page.";
  }, [reason]);

  /* --------------------------- Render --------------------------- */
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">
      {/* Background decorations */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(58,168,56,0.08),_transparent_55%)]" />
      <div className="pointer-events-none absolute -right-40 -top-40 h-80 w-80 rounded-full bg-[#3aa838]/5 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-rose-500/5 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-4 py-10">
        {/* -------------------- Main card -------------------- */}
        <Card className="w-full overflow-hidden border-slate-200 shadow-xl">
          <CardContent className="p-0">
            {/* Header band */}
            <div className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-br from-slate-50 via-white to-[#3aa838]/5 px-6 pb-8 pt-10 text-center md:px-10">
              {/* Watermark */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 -top-4 select-none text-center text-[7rem] font-black leading-none tracking-tighter text-slate-900/[0.04] md:text-[9rem]"
              >
                403
              </div>

              {/* Icon */}
              <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3aa838] to-[#2f8a2f] shadow-lg shadow-[#3aa838]/30 ring-8 ring-[#3aa838]/10">
                <ShieldX className="h-8 w-8 text-white" />
              </div>

              <h1 className="relative mt-5 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                Access Denied
              </h1>
              <p className="relative mx-auto mt-2 max-w-md text-sm text-slate-600">
                {reasonText}
              </p>

              {/* Context chips */}
              {(isSignedIn || requiredRole || attemptedPath) && (
                <div className="relative mt-4 flex flex-wrap items-center justify-center gap-2">
                  {isSignedIn && (
                    <Badge
                      variant="outline"
                      className="gap-1.5 border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700"
                    >
                      <UserCircle2 className="h-3 w-3 text-slate-500" />
                      Signed in as
                      <span className="font-semibold text-slate-900">
                        {displayName}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-600">
                        {userRole}
                      </span>
                    </Badge>
                  )}
                  {requiredRole && (
                    <Badge
                      variant="outline"
                      className="gap-1.5 border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800"
                    >
                      <KeyRound className="h-3 w-3" />
                      Requires role
                      <span className="font-semibold">{requiredRole}</span>
                    </Badge>
                  )}
                  {attemptedPath && (
                    <Badge
                      variant="outline"
                      className="gap-1.5 border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] font-medium text-slate-600"
                    >
                      <Lock className="h-3 w-3" />
                      {attemptedPath}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="bg-white px-6 py-6 md:px-10">
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Button
                  variant="outline"
                  onClick={handleGoBack}
                  className="h-10 gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Go back
                </Button>
                <Button
                  onClick={handleGoHome}
                  className="h-10 gap-2 bg-[#3aa838] text-white shadow-sm shadow-[#3aa838]/30 hover:bg-[#2f8a2f]"
                >
                  <Home className="h-4 w-4" />
                  Go to dashboard
                </Button>
                {isSignedIn ? (
                  <Button
                    variant="outline"
                    onClick={handleSignInAsDifferent}
                    className="h-10 gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign in as different user
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={handleSignInAsDifferent}
                    className="h-10 gap-2"
                  >
                    <UserCircle2 className="h-4 w-4" />
                    Sign in
                  </Button>
                )}
              </div>

              <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
                <LifeBuoy className="h-3 w-3" />
                Still stuck?
                <button
                  type="button"
                  onClick={handleContactSupport}
                  className="font-medium text-[#2f8a2f] underline-offset-2 hover:underline"
                >
                  Contact support
                </button>
                or your administrator.
              </div>
            </div>
          </CardContent>
        </Card>

        {/* -------------------- Helpful hints -------------------- */}
        <div className="mt-6 grid w-full gap-3 md:grid-cols-3">
          <HintCard
            icon={ShieldAlert}
            title="Check your permissions"
            text={
              requiredRole
                ? `This page needs the "${requiredRole}" role. Ask an admin to add it to your account.`
                : "Your account may be missing a role or permission required for this page."
            }
            tone="amber"
          />
          <HintCard
            icon={UserCircle2}
            title="Use a different account"
            text="If you have another account with higher privileges, sign in with it instead."
            tone="green"
          />
          <HintCard
            icon={Mail}
            title="Contact your administrator"
            text={
              <>
                Email{" "}
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="font-medium text-[#2f8a2f] underline-offset-2 hover:underline"
                >
                  {SUPPORT_EMAIL}
                </a>{" "}
                and include the page you tried to open.
              </>
            }
            tone="slate"
          />
        </div>

        {/* -------------------- Footer -------------------- */}
        <div className="mt-8 flex items-center gap-2 text-[11px] text-slate-400">
          <CheckCircle2 className="h-3 w-3 text-[#3aa838]" />
          <span>
            If you believe this is a mistake, contact your administrator with the
            details above.
          </span>
        </div>
      </div>
    </div>
  );
}

/* --------------------------- Suspense wrapper (default export) --------------------------- */
export default function UnauthorizedPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-[#3aa838]" />
            <span className="text-sm text-slate-500">Loading…</span>
          </div>
        </div>
      }
    >
      <UnauthorizedContent />
    </Suspense>
  );
}

/* --------------------------- Hint card --------------------------- */
function HintCard({
  icon: Icon,
  title,
  text,
  tone,
}: {
  icon: React.ElementType;
  title: string;
  text: React.ReactNode;
  tone: "amber" | "green" | "slate";
}) {
  const toneMap = {
    amber: {
      iconBg: "bg-amber-50",
      iconText: "text-amber-600",
      ring: "ring-amber-100",
    },
    green: {
      iconBg: "bg-[#3aa838]/10",
      iconText: "text-[#3aa838]",
      ring: "ring-[#3aa838]/15",
    },
    slate: {
      iconBg: "bg-slate-100",
      iconText: "text-slate-600",
      ring: "ring-slate-200",
    },
  } as const;
  const t = toneMap[tone];
  return (
    <Card className="border-slate-200 shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <div
          className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg ${t.iconBg} ring-4 ${t.ring}`}
        >
          <Icon className={`h-4 w-4 ${t.iconText}`} />
        </div>
        <div className="text-xs font-semibold text-slate-900">{title}</div>
        <div className="mt-1 text-[11px] leading-relaxed text-slate-600">
          {text}
        </div>
      </CardContent>
    </Card>
  );
}