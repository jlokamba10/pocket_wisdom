import { PropsWithChildren } from "react";
import { Navigate } from "react-router-dom";
import { Role, useAuth } from "./auth";

type RequireRoleProps = PropsWithChildren<{
  allowed: Role[];
}>;

export default function RequireRole({ allowed, children }: RequireRoleProps) {
  const { user, authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="page center">
        <div className="loader" />
        <p>Loading permissions...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowed.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
