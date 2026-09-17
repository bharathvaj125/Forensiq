import { Navigate } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";
import { ReactNode } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRoles?: string[];
}

export default function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
  const { token, user, isLoading } = useAuth();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (isLoading || !user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0b0f19] text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
          <span className="text-sm font-semibold tracking-wider uppercase text-blue-500 font-mono">
            KSP Command Center Security Telemetry...
          </span>
        </div>
      </div>
    );
  }

  if (requiredRoles && requiredRoles.length > 0) {
    const userRole = user.role?.RoleName || "";
    const hasRole = requiredRoles.includes(userRole);
    if (!hasRole) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}
