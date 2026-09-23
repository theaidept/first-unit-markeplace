import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AvatarRing } from "./AvatarRing";
import { VerifiedBadge } from "./VerifiedBadge";
import api from "../lib/api";
import logo from "../assets/logo.png";
import { Search, ShoppingBag, MessageSquare, Bell, LayoutDashboard, ShieldCheck, LogOut } from "lucide-react";

const CATS = [
  { key: "all", label: "All Categories" },
  { key: "gear", label: "Gear & Equipment" },
  { key: "vehicles", label: "Vehicles" },
  { key: "art", label: "Art & Personal" },
  { key: "jobs", label: "Department Jobs" },
];

const NAV = [
  { key: "all", label: "All Categories" },
  { key: "gear", label: "Gear & Equipment" },
  { key: "vehicles", label: "Vehicles" },
  { key: "art", label: "Art & Personal" },
  { key: "jobs", label: "Department Jobs" },
  { key: "deals", label: "Deals" },
  { key: "near", label: "Near Me" },
  { key: "video", label: "Has Video" },
];

export const MarketHeader = ({ onSearch, onNav, activeNav, showNav = true }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [unread, setUnread] = useState(0);
  const [alerts, setAlerts] = useState(0);
  const [me, setMe] = useState(null);

  useEffect(() => {
    let stop = false;
    const poll = async () => {
      try {
        const [m, n] = await Promise.all([api.get("/messages/unread-count"), api.get("/notifications")]);
        if (!stop) { setUnread(m.data.unread || 0); setAlerts(n.data.unread || 0); }
      } catch { /* ignore */ }
    };
    poll();
    const t = setInterval(poll, 12000);
    api.get("/profile/me").then((r) => setMe(r.data)).catch(() => {});
    return () => { stop = true; clearInterval(t); };
  }, []);

  const submit = (e) => {
    e.preventDefault();
    if (onSearch) onSearch(q, cat);
    else navigate(`/marketplace?q=${encodeURIComponent(q)}&cat=${cat}`);
  };

  const goNav = (key) => {
    if (key === "jobs") { navigate("/dashboard?view=jobs"); return; }
    if (onNav) onNav(key);
    else navigate(`/marketplace?cat=${key}`);
  };

  return (
    <header className="mh" data-testid="market-header">
      <div className="mh-util">
        <div className="wrap mh-util-row">
          <Link to="/transactions" data-testid="util-orders">Orders &amp; Offers</Link>
          <Link to="/verification" data-testid="util-verification">Verification: {(user?.verification_status || "—").replace("_", " ")}</Link>
          <a href="mailto:support@firstunit.us" data-testid="util-help">Help</a>
        </div>
      </div>

      <div className="mh-main">
        <div className="wrap mh-main-row">
          <Link to="/marketplace" className="mh-logo" data-testid="mh-logo"><img src={logo} alt="First Unit USA" /></Link>

          <form className="mh-search" onSubmit={submit} data-testid="mh-search">
            <select value={cat} onChange={(e) => setCat(e.target.value)} data-testid="mh-search-cat">
              {CATS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search gear, vehicles, art…" data-testid="mh-search-input" />
            <button type="submit" data-testid="mh-search-btn"><Search size={17} /></button>
          </form>

          <div className="mh-actions">
            <Link to="/transactions" className="mh-icon" title="Orders" data-testid="mh-orders"><ShoppingBag size={19} /></Link>
            <Link to="/messages" className="mh-icon" title="Messages" data-testid="mh-messages">
              <MessageSquare size={19} />{unread > 0 && <span className="mh-badge" data-testid="mh-unread-badge">{unread > 9 ? "9+" : unread}</span>}
            </Link>
            <Link to="/messages" className="mh-icon" title="Alerts" data-testid="mh-alerts">
              <Bell size={19} />{alerts > 0 && <span className="mh-badge gold" data-testid="mh-alerts-badge">{alerts > 9 ? "9+" : alerts}</span>}
            </Link>
            <Link to="/sell" className="btn btn-primary mh-sell" data-testid="mh-sell-btn"><span>Sell</span></Link>
            <Link to="/dashboard" className="btn btn-ghost mh-dash" data-testid="mh-dashboard-btn"><LayoutDashboard size={15} /> <span>Dashboard</span></Link>
            {user?.role === "admin" && <Link to="/admin" className="mh-icon" title="Admin" data-testid="mh-admin"><ShieldCheck size={19} /></Link>}
            <Link to="/profile" className="mh-chip" data-testid="mh-profile-chip">
              <AvatarRing size="sm" src={me?.photo_visibility === "photo" ? me?.avatar : null} initials={me?.initials} />
              <span className="mh-chip-name">{me?.display_handle || user?.email?.split("@")[0]}</span>
              {(me?.verified_badge ?? user?.verification_status === "approved") && <VerifiedBadge />}
            </Link>
            <button className="mh-icon" title="Log out" data-testid="mh-logout" onClick={async () => { await logout(); navigate("/"); }}><LogOut size={18} /></button>
          </div>
        </div>
      </div>

      {showNav && (
        <nav className="mh-nav" data-testid="mh-nav">
          <div className="wrap mh-nav-row">
            {NAV.map((n) => (
              <button key={n.key} className={activeNav === n.key ? "active" : ""} onClick={() => goNav(n.key)} data-testid={`mh-nav-${n.key}`}>{n.label}</button>
            ))}
            <Link to="/sell" className="mh-nav-list" data-testid="mh-nav-list-item">List an item</Link>
          </div>
        </nav>
      )}
    </header>
  );
};
