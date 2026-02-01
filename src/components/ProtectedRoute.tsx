import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import React from "react";

export default function ProtectedRoute(
  { children }: { children: React.ReactNode }
) {
  const { user, loading } = useAuth();

  if (loading)
    return (
      <div className="page">
        <div className="card">Loading...</div>
      </div>
    );

  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
