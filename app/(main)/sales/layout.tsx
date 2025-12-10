import ProtectedLayout from "@/components/global/ProtectedRoute";
import React from "react";

const layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <ProtectedLayout
      /* allowedRoles={["/manager"]} */
      >
        {children}
      </ProtectedLayout>
    </>
  );
};

export default layout;
