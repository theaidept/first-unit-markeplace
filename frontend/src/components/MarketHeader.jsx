import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AvatarRing } from "./AvatarRing";
import api from "../lib/api";
import logo from "../assets/logo.png";
import { Search, ShoppingBag, MessageSquare, Bell, LayoutDashboard, ShieldCheck, LogOut, ChevronDown, Package, Tag, UserCircle } from "lucide-react";

const EXTRA_NAV = [
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [shopCats, setShopCats] = useState([
    { slug: "gear", name: "Gear & Equipment" },
    { slug: "vehicles", name: "Vehicles" },
    { slug: "art", name: "Art & Personal Items" },
  ]);
  const menuRef = useRef(null);

  useEffect(() => {
    api.get("/categories").then((r) => { if (r.data.categories?.length) setShopCats(r.data.categories); }).catch(() => {});
  }, []);

  useEffect(() => {
    const onDoc = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const signOut = async () => { setMenuOpen(false); await logout(); navigate("/"); };

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

  const welcomeName = me?.display_handle || user?.email?.split("@")[0] || "there";

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
              <option value="all">All Categories</option>
              {shopCats.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              <option value="jobs">Department Jobs</option>
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
            <div className="mh-chip-wrap" ref={menuRef}>
              <button className="mh-chip" data-testid="mh-profile-chip" onClick={() => setMenuOpen((o) => !o)} aria-label="Account menu">
                <AvatarRing size="sm" src={me?.photo_visibility === "photo" ? me?.avatar : null} initials={me?.initials} />
                <ChevronDown size={14} className={`mh-caret ${menuOpen ? "up" : ""}`} />
              </button>
              {menuOpen && (
                <div className="mh-menu" data-testid="mh-profile-menu" onClick={() => setMenuOpen(false)}>
                  <div className="mh-menu-welcome" data-testid="mh-menu-welcome">Welcome, {welcomeName}</div>
                  <Link to="/profile" data-testid="mh-menu-profile"><UserCircle size={15} /> Profile</Link>
                  <Link to="/dashboard" data-testid="mh-menu-listings"><Package size={15} /> My Listings</Link>
                  <Link to="/transactions" data-testid="mh-menu-orders"><Tag size={15} /> Orders &amp; Offers</Link>
                  <Link to="/verification" data-testid="mh-menu-verification"><ShieldCheck size={15} /> Verification</Link>
                  <button type="button" className="mh-menu-signout" data-testid="mh-menu-signout" onClick={signOut}><LogOut size={15} /> Sign Out</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showNav && (
        <nav className="mh-nav" data-testid="mh-nav">
          <div className="wrap mh-nav-row">
            {[{ key: "all", label: "All Categories" }, ...shopCats.map((c) => ({ key: c.slug, label: c.name })), ...EXTRA_NAV].map((n) => (
              <button key={n.key} className={activeNav === n.key ? "active" : ""} onClick={() => goNav(n.key)} data-testid={`mh-nav-${n.key}`}>{n.label}</button>
            ))}
            <Link to="/sell" className="mh-nav-list" data-testid="mh-nav-list-item">List an item</Link>
          </div>
        </nav>
      )}
    </header>
  );
};
