"use client";

import { appWithTranslation, useTranslation } from "next-i18next";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function I18nextProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  // You can do stuff here if needed (language sync, etc.)
  return <>{children}</>;
}
