import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { canAccess } from "@/utils/rbac";

type CheckOptions = {
  permissions?: string | string[];
  roles?: string | string[];
};

export default function usePermissionCheck() {
  const user = useSelector((state: RootState) => state.user.currentUser);

  // return a function that can check dynamically
  const hasAccess = (opts: CheckOptions) => {
    return canAccess(user, opts);
  };

  return hasAccess;
}
