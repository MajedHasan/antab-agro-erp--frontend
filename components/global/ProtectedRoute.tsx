"use client";

import { ReactNode, useEffect } from "react";
import { useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import { RootState } from "../../store/store";

interface ProtectedLayoutProps {
  allowedRoles?: string[];
  children: ReactNode;
}

export default function ProtectedLayout({
  allowedRoles,
  children,
}: ProtectedLayoutProps) {
  const { isAuthenticated, currentUser, loading } = useSelector(
    (state: RootState) => state.user
  );
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        router.push("/login");
      } else if (
        allowedRoles &&
        currentUser &&
        !allowedRoles.includes(
          currentUser?.role ? currentUser.role : currentUser?.role?.name
        )
      ) {
        router.push("/unauthorized");
      }
    }
  }, [isAuthenticated, loading, allowedRoles, currentUser, router]);

  if (loading) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p>Loading...</p>
      </div>
    );
  }

  return <>{children}</>;
}
