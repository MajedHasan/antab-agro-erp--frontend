"use client";

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter, usePathname } from "next/navigation";

import { fetchCurrentUser, bypassLogin } from "@/store/slices/userSlice";
import { RootState, AppDispatch } from "@/store/store";

const BYPASS_AUTH = process.env.NEXT_PUBLIC_BYPASS_AUTH === "true";

const PUBLIC_PATHS = new Set(["/login", "/unauthorized", "/not-found"]);

export default function AppInitializer() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const pathname = usePathname();

  const { isAuthenticated, loading, accessToken } = useSelector(
    (state: RootState) => state.user,
  );

  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    if (BYPASS_AUTH) {
      dispatch(bypassLogin());
      return;
    }

    if (accessToken) {
      dispatch(fetchCurrentUser());
    }
  }, [hydrated, accessToken, dispatch]);

  useEffect(() => {
    if (!hydrated || BYPASS_AUTH) return;
    if (loading) return;

    if (!isAuthenticated && !PUBLIC_PATHS.has(pathname)) {
      const hasToken =
        localStorage.getItem("accessToken") ||
        localStorage.getItem("refreshToken");

      if (!hasToken) {
        const qs =
          typeof window !== "undefined"
            ? window.location.search.replace(/^\?/, "")
            : "";
        const from = pathname + (qs ? `?${qs}` : "");
        router.replace(`/login?from=${encodeURIComponent(from)}`);
      }
    } else if (isAuthenticated && pathname === "/login") {
      // After login, send back to intended destination if present
      const qs =
        typeof window !== "undefined"
          ? window.location.search.replace(/^\?/, "")
          : "";
      const params = new URLSearchParams(qs);
      const from = params.get("from");
      router.replace(from ? decodeURIComponent(from) : "/");
    }
  }, [hydrated, loading, isAuthenticated, pathname, router]);

  return null;
}