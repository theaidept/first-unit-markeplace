import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MarketHeader } from "./MarketHeader";
import { AvatarRing } from "./AvatarRing";
import { VerifiedBadge } from "./VerifiedBadge";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";
import { Store, Package, Tag, MessageSquare, Bookmark, Users, Briefcase, BadgeCheck, UserCircle } from "lucide-react";

const NAV = [
  { group: null, items: [
    { key: "marketplace", label: "Marketplace", icon: Store, to: "/marketplace" },
    { key: "listings", label: "My Listings", icon: Package, to: "/dashboard" },
    { key: "orders", label: "Offers & Orders", icon: Tag, to: "/transactions" },
    { key: "messages", label: "Messages", icon: MessageSquare, to: "/messages" },
    { key: "saved", label: "Saved", icon: Bookmark, to: "/dashboard?view=saved" },
  ] },
  { group: "Community", items: [
    { key: "members", label: "Members Directory", icon: Users, to: "/members" },
    { key: "jobs", label: "Job Board", icon: Briefcase, to: "/dashboard?view=jobs" },
  ] },
  { group: "Account", items: [
    { key: "verification", label: "Verification", icon: BadgeCheck, to: "/verification" },
    { key: "profile", label: "Profile", icon: UserCircle, to: "/profile" },
  ] },
];

// Persistent logged-in shell: top header + left sidebar, content panel changes.
export const DashboardLayout = ({ active, children, testid }) => {
  const { user } = useAuth();
  const [me, setMe] = useState(null);

  useEffect(() => {
    api.get("/profile/me").then((r) => setMe(r.data)).catch(() => {});
  }, []);

  return (
    <div className="fu-app dash" data-testid={testid || "dashboard-shell"}>
      <MarketHeader showNav={false} />
      <div className="dash-layout">
        <aside className="dash-side" data-testid="dash-sidebar">
          {NAV.map((sec, i) => (
            <div className="ds-group" key={i}>
              {sec.group && <div className="ds-group-h">{sec.group}</div>}
              {sec.items.map((it) => (
                <Link
                  key={it.key}
                  to={it.to}
                  className={`ds-link ${active === it.key ? "active" : ""}`}
                  data-testid={`dash-nav-${it.key}`}
                >
                  <it.icon size={16} /> {it.label}
                </Link>
              ))}
            </div>
          ))}
          <Link to="/profile" className="ds-mini" data-testid="dash-mini-profile">
            <AvatarRing size="sm" src={me?.photo_visibility === "photo" ? me?.avatar : null} initials={me?.initials} />
            <div>
              <div className="ds-mini-name">{me?.display_handle || user?.email?.split("@")[0]}</div>
              {me?.verified_badge && <VerifiedBadge />}
            </div>
          </Link>
        </aside>

        <main className="dash-main" data-testid="dash-content">{children}</main>
      </div>
    </div>
  );
};
