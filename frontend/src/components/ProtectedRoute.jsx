import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Checking = () => <div className="center-screen">First Unit</div>;

export function RequireAuth({ children }) {
  const { user } = useAuth();
  if (user === null) return <Checking />;
  if (user === false) return <Navigate to="/login" replace />;
  return children;
}

export function RequireApproved({ children }) {
  const { user } = useAuth();
  if (user === null) return <Checking />;
  if (user === false) return <Navigate to="/login" replace />;
  if (user.verification_status !== "approved")
    return <Navigate to="/verification" replace />;
  return children;
}

export function RequireAdmin({ children }) {
  const { user } = useAuth();
  if (user === null) return <Checking />;
  if (user === false) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/verification" replace />;
  return children;
}
