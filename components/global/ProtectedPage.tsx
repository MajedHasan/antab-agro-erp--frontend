import { canAccess } from "@/utils/rbac";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { useRouter } from "next/navigation";

type Props = {
  children: React.ReactNode;
  roles?: string[];
  permissions?: string | string[];
  match?: "any" | "all"; // <— NEW
};

export default function ProtectedPage({
  children,
  roles,
  permissions,
  match = "any",
}: Props) {
  const router = useRouter();
  const user = useSelector((state: RootState) => state.user);

  const allowed = canAccess(user.currentUser, { roles, permissions, match });

  if (!allowed) {
    if (typeof window !== "undefined") router.push("/unauthorized");
    return null;
  }

  return <>{children}</>;
}
