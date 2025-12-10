"use client";

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter, usePathname } from "next/navigation";
import { fetchCurrentUser, bypassLogin } from "@/store/slices/userSlice";
import { RootState, AppDispatch } from "@/store/store";

const BYPASS_AUTH = process.env.NEXT_PUBLIC_BYPASS_AUTH === "true";

export default function AppInitializer() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const pathname = usePathname();

  const { isAuthenticated, loading, accessToken } = useSelector(
    (state: RootState) => state.user
  );

  const [initLoading, setInitLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  // Wait until client renders & localStorage is available
  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) {
      setInitLoading(false);
    }
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;

    if (BYPASS_AUTH) {
      dispatch(bypassLogin());
      return;
    }

    // only fetch if token exists
    if (accessToken) {
      dispatch(fetchCurrentUser());
    }
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;

    if (!BYPASS_AUTH && !loading) {
      // user not logged in and not on login page → redirect
      if (!loading && !isAuthenticated && pathname !== "/login") {
        // ALSO ensure we have no tokens left
        const hasToken =
          localStorage.getItem("accessToken") ||
          localStorage.getItem("refreshToken");

        if (!hasToken) {
          router.replace("/login");
        }
      }

      // user logged in but at login page → send to dashboard
      else if (isAuthenticated && pathname === "/login") {
        router.replace("/");
      }
    }
  }, [hydrated, loading, isAuthenticated, pathname]);

  if (initLoading) return null;

  return null;
}
