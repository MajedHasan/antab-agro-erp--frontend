// src/app/not-found.tsx
"use client";

import React, { useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";

import {
  ArrowLeft,
  CheckCircle2,
  Compass,
  Home,
  LifeBuoy,
  Link2Off,
  Mail,
  SearchX,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/* --------------------------- Config --------------------------- */
const DASHBOARD_PATH =
  process.env.NEXT_PUBLIC_DASHBOARD_PATH || "/";
const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@antabagro.com";

/* --------------------------- Page --------------------------- */
export default function NotFoundPage() {
  const router = useRouter();
  const pathname = usePathname();

  // Path that produced the 404 (Next internal paths are hidden)
  const attemptedPath = useMemo(() => {
    if (!pathname) return "";
    if (pathname === "/_not-found" || pathname === "/404") return "";
    return pathname;
  }, [pathname]);

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

  const handleContactSupport = useCallback(() => {
    const subject = encodeURIComponent(
      `Broken link${attemptedPath ? `: ${attemptedPath}` : ""}`,
    );
    const body = encodeURIComponent(
      [
        "Hi team,",
        "",
        "I hit a 404 on this page:",
        attemptedPath || "(unknown)",
        "",
        "Please check if it moved or the link is broken.",
      ].join("\n"),
    );
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  }, [attemptedPath]);

  /* --------------------------- Render --------------------------- */
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">
      {/* Background decorations */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(58,168,56,0.08),_transparent_55%)]" />
      <div className="pointer-events-none absolute -right-40 -top-40 h-80 w-80 rounded-full bg-[#3aa838]/5 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-indigo-500/5 blur-3xl" />

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
                404
              </div>

              {/* Icon */}
              <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3aa838] to-[#2f8a2f] shadow-lg shadow-[#3aa838]/30 ring-8 ring-[#3aa838]/10">
                <SearchX className="h-8 w-8 text-white" />
              </div>

              <h1 className="relative mt-5 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                Page not found
              </h1>
              <p className="relative mx-auto mt-2 max-w-md text-sm text-slate-600">
                We couldn&apos;t find the page you&apos;re looking for. It may
                have been moved, renamed, or never existed.
              </p>

              {/* Context chip */}
              {attemptedPath && (
                <div className="relative mt-4 flex flex-wrap items-center justify-center gap-2">
                  <Badge
                    variant="outline"
                    className="gap-1.5 border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] font-medium text-slate-600"
                  >
                    <Link2Off className="h-3 w-3" />
                    {attemptedPath}
                  </Badge>
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
                <Button
                  variant="outline"
                  onClick={handleContactSupport}
                  className="h-10 gap-2"
                >
                  <LifeBuoy className="h-4 w-4" />
                  Report broken link
                </Button>
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
            icon={Link2Off}
            title="Check the URL"
            text="A typo in the address is the most common cause. Double-check the spelling and try again."
            tone="amber"
          />
          <HintCard
            icon={Compass}
            title="Start from the dashboard"
            text="Use the main navigation or go back to the dashboard to reach the page you need."
            tone="green"
          />
          <HintCard
            icon={Mail}
            title="Report a broken link"
            text={
              <>
                Email{" "}
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="font-medium text-[#2f8a2f] underline-offset-2 hover:underline"
                >
                  {SUPPORT_EMAIL}
                </a>{" "}
                with the URL and where you found it.
              </>
            }
            tone="slate"
          />
        </div>

        {/* -------------------- Footer -------------------- */}
        <div className="mt-8 flex items-center gap-2 text-[11px] text-slate-400">
          <CheckCircle2 className="h-3 w-3 text-[#3aa838]" />
          <span>Error 404 · The page you requested doesn&apos;t exist.</span>
        </div>
      </div>
    </div>
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