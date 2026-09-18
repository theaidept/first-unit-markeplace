import { Link, NavLink, useNavigate } from "react-router-dom";
import { Brand } from "./Brand";
import { AvatarRing } from "./AvatarRing";
import { useAuth } from "../context/AuthContext";
import { LogOut, ShieldCheck } from "lucide-react";

const RESPONDER_LABELS = {
  law_enforcement: "Law Enforcement",
  firefighter_career: "Firefighter",
  firefighter_volunteer: "Firefighter",
  emt_paramedic: "EMT / Paramedic",
  dispatcher: "Dispatcher",
};

export const AppNav = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const roleLabel =
    user?.role === "admin"
      ? "Administrator"
      : RESPONDER_LABELS[user?.responder_type] || "Member";

  return (
    <div className="app-nav">
      <div className="wrap app-nav-inner">
        <Brand light />
        {user?.verification_status === "approved" && (
          <nav className="app-links" data-testid="app-links">
            <NavLink to="/marketplace" data-testid="nav-marketplace">Marketplace</NavLink>
            <NavLink to="/sell" data-testid="nav-sell">Sell</NavLink>
            <NavLink to="/members" data-testid="nav-members">Members</NavLink>
            <NavLink to="/transactions" data-testid="nav-deals">Deals</NavLink>
            <NavLink to="/profile" data-testid="nav-profile">Profile</NavLink>
          </nav>
        )}
        <div className="spacer" />
        {user?.role === "admin" && (
          <Link
            to="/admin"
            className="btn btn-ghost"
            style={{ color: "#fff", borderColor: "rgba(255,255,255,.3)" }}
            data-testid="nav-admin-link"
          >
            <ShieldCheck size={16} /> Admin
          </Link>
        )}
        <div className="profile-chip" data-testid="nav-profile-chip">
          <AvatarRing size="sm" src={user?.avatar} />
          <div className="who">
            <b>{user?.email?.split("@")[0]}</b>
            <span>Verified · {roleLabel}</span>
          </div>
        </div>
        <button
          className="btn btn-ghost"
          style={{ color: "#fff", borderColor: "rgba(255,255,255,.3)" }}
          onClick={handleLogout}
          data-testid="nav-logout-btn"
        >
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );
};
