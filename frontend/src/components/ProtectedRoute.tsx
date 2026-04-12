import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { getAuthSession, type UserRole } from "../auth";

type ProtectedRouteProps = {
  allowedRoles: UserRole[];
  children: ReactNode;
};

export function ProtectedRoute({
  allowedRoles,
  children,
}: ProtectedRouteProps) {
  const session = getAuthSession();

  if (!session?.token) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(session.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
