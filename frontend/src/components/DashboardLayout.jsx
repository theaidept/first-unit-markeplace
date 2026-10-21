import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MarketHeader } from "./MarketHeader";
import { Footer } from "./Footer";
import { AvatarRing } from "./AvatarRing";
import { VerifiedBadge } from "./VerifiedBadge";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";
import { Store, Package, Tag, MessageSquare, Bookmark, Users, Briefcase, BadgeCheck, UserCircle, Wallet, LogOut, Settings, LayoutDashboard } from "lucide-react";

const EXIT = [
  { key: "marketplace", label: "Marketplace", icon: Store, to: "/marketplace" },
];

const MINE = [
  { key: "overview", label: "Dashboard", icon: LayoutDashboard, to: "/dashboard" },
  { key: "listings", label: "My Listings", icon: Package, to: "/dashboard?view=listings" },
  { key: "orders", label: "Offers & Orders", icon: Tag, to: "/transactions" },
  { key: "messages", label: "Messages", icon: MessageSquare, to: "/messages" },
  { key: "saved", label: "Saved", icon: Bookmark, to: "/dashboard?view=saved" },
];

const COMMUNITY = [
  { key: "members", label: "Members Directory", icon: Users, to: "/members" },
  { key: "jobs", label: "Job Board", icon: Briefcase, to: "/dashboard?view=jobs" },
];

const ACCOUNT = [
  { key: "verification", label: "Verification", icon: BadgeCheck, to: "/verification" },
  { key: "profile", label: "Profile", icon: UserCircle, to: "/profile" },
  { key: "payments", label: "Get Paid", icon: Wallet, to: "/profile?view=payments" },
];

function NavLinks({ items, active }) {
  return items.map((it) => (
    <Link
      key={it.key}
      to={it.to}
      className={`ds-link ${active === it.key ? "active" : ""}`}
      data-testid={`dash-nav-${it.key}`}
    >
      <it.icon size={16} /> {it.label}
    </Link>
  ));
}

// Persistent logged-in shell: top header + left sidebar, content panel changes.
export const DashboardLayout = ({ active, children, testid }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    api.get("/profile/me").then((r) => setMe(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const onDoc = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const signOut = async () => {
    setMenu(false);
    await logout();
    navigate("/");
  };

  const name = me?.display_handle || user?.email?.split("@")[0] || "Member";

  return (
    <div className="fu-app dash member-shell" data-testid={testid || "dashboard-shell"}>
      <MarketHeader showNav={false} />
      <div className="dash-layout">
        <aside className="dash-side" data-testid="dash-sidebar">
          <div className="ds-group ds-exit">
            <NavLinks items={EXIT} active={active} />
          </div>
          <div className="ds-group">
            <NavLinks items={MINE} active={active} />
          </div>
          <div className="ds-group">
            <div className="ds-group-h">Community</div>
            <NavLinks items={COMMUNITY} active={active} />
          </div>
          <div className="ds-group">
            <div className="ds-group-h">Account</div>
            <NavLinks items={ACCOUNT} active={active} />
          </div>

          <div className="ds-mini-wrap" ref={menuRef}>
            {menu && (
              <div className="ds-mini-menu" data-testid="dash-mini-menu">
                <Link to="/profile" onClick={() => setMenu(false)} data-testid="dash-mini-view"><UserCircle size={15} /> View Profile</Link>
                <Link to="/profile" onClick={() => setMenu(false)} data-testid="dash-mini-settings"><Settings size={15} /> Account Settings</Link>
                <button type="button" onClick={signOut} data-testid="dash-mini-signout"><LogOut size={15} /> Sign Out</button>
              </div>
            )}
            <button type="button" className="ds-mini" data-testid="dash-mini-profile" onClick={() => setMenu((o) => !o)} aria-expanded={menu}>
              <AvatarRing size="sm" src={me?.photo_visibility === "photo" ? me?.avatar : null} initials={me?.initials} />
              <span className="ds-mini-copy">
                <span className="ds-mini-name">{name}</span>
                {me?.verified_badge && <VerifiedBadge />}
              </span>
            </button>
          </div>
        </aside>

        <main className="dash-main" data-testid="dash-content">{children}</main>
      </div>
      <Footer />
    </div>
  );
};
