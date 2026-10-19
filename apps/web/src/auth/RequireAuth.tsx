import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "./AuthContext";

export function RequireAuth() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <main className="page">
        <p className="page-muted">Loading...</p>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
