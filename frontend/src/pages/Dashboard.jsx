import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { MarketHeader } from "../components/MarketHeader";
import { ListingCard } from "../components/ListingCard";
import { StoryViewer } from "../components/StoryViewer";
import { AvatarRing } from "../components/AvatarRing";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { useAuth } from "../context/AuthContext";
import api, { fileUrl } from "../lib/api";
import { Play, Store, Package, Tag, MessageSquare, Bookmark, Users, Briefcase, BadgeCheck, UserCircle, Plus } from "lucide-react";

const recency = (iso) => {
  if (!iso) return "";
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (d < 1) return "today"; if (d < 7) return `${Math.floor(d)}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`; return `${Math.floor(d / 30)}mo ago`;
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const view = params.get("view") || "overview";
  const [me, setMe] = useState(null);
  const [mine, setMine] = useState(null);
  const [stories, setStories] = useState([]);
  const [viewer, setViewer] = useState(null);
  const [saved, setSaved] = useState([]);
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    api.get("/profile/me").then((r) => setMe(r.data)).catch(() => {});
    api.get("/listings/mine").then((r) => setMine(r.data.listings)).catch(() => setMine([]));
    api.get("/stories").then((r) => setStories(r.data.stories)).catch(() => {});
    api.get("/jobs").then((r) => setJobs(r.data.jobs)).catch(() => {});
  }, []);

  useEffect(() => {
    if (view !== "saved") return;
    let ids = []; try { ids = JSON.parse(localStorage.getItem("fu_saved") || "[]"); } catch { /* ignore */ }
    if (!ids.length) { setSaved([]); return; }
    api.get("/listings").then((r) => setSaved(r.data.listings.filter((l) => ids.includes(l.id)))).catch(() => setSaved([]));
  }, [view]);

  const myStories = useMemo(() => stories.filter((s) => s.seller?.user_id === user?.id), [stories, user]);
  const liveCount = (mine || []).filter((l) => l.status === "live").length;
  const soldCount = (mine || []).filter((l) => l.status === "sold").length;

  const NAV = [
    { group: null, items: [
      { key: "overview", label: "Marketplace", icon: Store, to: "/marketplace", ext: true },
      { key: "listings", label: "My Listings", icon: Package },
      { key: "orders", label: "Offers & Orders", icon: Tag, to: "/transactions", ext: true },
      { key: "messages", label: "Messages", icon: MessageSquare, to: "/messages", ext: true },
      { key: "saved", label: "Saved", icon: Bookmark },
    ] },
    { group: "Community", items: [
      { key: "members", label: "Members Directory", icon: Users, to: "/members", ext: true },
      { key: "jobs", label: "Job Board", icon: Briefcase },
    ] },
    { group: "Account", items: [
      { key: "verification", label: "Verification", icon: BadgeCheck, to: "/verification", ext: true },
      { key: "profile", label: "Profile", icon: UserCircle, to: "/profile", ext: true },
    ] },
  ];

  const active = view === "overview" ? "listings" : view;

  return (
    <div className="fu-app dash" data-testid="dashboard-page">
      <MarketHeader showNav={false} />
      <div className="dash-layout">
        <aside className="dash-side" data-testid="dash-sidebar">
          {NAV.map((sec, i) => (
            <div className="ds-group" key={i}>
              {sec.group && <div className="ds-group-h">{sec.group}</div>}
              {sec.items.map((it) => (
                it.ext ? (
                  <Link key={it.key} to={it.to} className="ds-link" data-testid={`dash-nav-${it.key}`}><it.icon size={16} /> {it.label}</Link>
                ) : (
                  <button key={it.key} className={`ds-link ${active === it.key ? "active" : ""}`} onClick={() => navigate(`/dashboard${it.key === "listings" ? "" : `?view=${it.key}`}`)} data-testid={`dash-nav-${it.key}`}><it.icon size={16} /> {it.label}</button>
                )
              ))}
            </div>
          ))}
          <Link to="/profile" className="ds-mini" data-testid="dash-mini-profile">
            <AvatarRing size="sm" src={me?.photo_visibility === "photo" ? me?.avatar : null} initials={me?.initials} />
            <div><div className="ds-mini-name">{me?.display_handle || user?.email?.split("@")[0]}</div>{me?.verified_badge && <VerifiedBadge />}</div>
          </Link>
        </aside>

        <main className="dash-main" data-testid="dash-content">
          {view === "saved" ? (
            <>
              <h1 className="oswald dash-h">Saved items</h1>
              {saved.length === 0 ? <div className="card" style={{ padding: 36, color: "var(--text-dim)" }} data-testid="saved-empty">No saved items yet. Tap the bookmark on any listing to save it.</div>
                : <div className="listings-grid" data-testid="saved-grid">{saved.map((l) => <ListingCard key={l.id} listing={l} />)}</div>}
            </>
          ) : view === "jobs" ? (
            <>
              <h1 className="oswald dash-h">Department Job Board</h1>
              <div className="dash-jobs" data-testid="dash-jobs">
                {jobs.map((j) => (
                  <div className="dj-row card" key={j.id} data-testid={`dash-job-${j.id}`}>
                    <div><div className="dj-title">{j.title}</div><div className="dj-dept">{j.department} · {j.location}</div></div>
                    <span className="jb-recency">{recency(j.posted_at)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="dash-head-row">
                <div><span className="eyebrow tick">Dashboard</span><h1 className="oswald dash-h">Welcome back{me?.display_handle ? `, ${me.display_handle}` : ""}</h1></div>
                <Link to="/sell" className="btn btn-primary" data-testid="dash-sell-btn"><Plus size={15} /> Sell an item</Link>
              </div>

              <div className="dash-stats" data-testid="dash-stats">
                <div className="dstat"><div className="dstat-n">{liveCount}</div><div className="dstat-l">Live listings</div></div>
                <div className="dstat"><div className="dstat-n">{soldCount}</div><div className="dstat-l">Sold</div></div>
                <div className="dstat"><Link to="/transactions" data-testid="dash-to-orders">Orders &amp; Offers →</Link></div>
                <div className="dstat"><Link to="/messages" data-testid="dash-to-messages">Messages →</Link></div>
              </div>

              {myStories.length > 0 && (
                <>
                  <h2 className="oswald shelf-h">Your Stories</h2>
                  <div className="reel" data-testid="dash-stories">
                    {myStories.map((s) => {
                      const gi = stories.findIndex((x) => x.id === s.id);
                      return (
                        <button className="story-card" key={s.id} onClick={() => setViewer(gi)} data-testid={`dash-story-${s.listing_id}`}>
                          <span className="sc-ring"><span className="sc-thumb" style={{ backgroundImage: s.photo ? `url(${fileUrl(s.photo)})` : undefined }}><span className="sc-play"><Play size={16} fill="currentColor" /></span></span></span>
                          <span className="sc-price">${Number(s.price).toLocaleString()}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              <h2 className="oswald shelf-h">My Listings</h2>
              {mine === null ? <div style={{ padding: 30, color: "var(--text-faint)" }}>Loading…</div>
                : mine.length === 0 ? <div className="card" style={{ padding: 36, color: "var(--text-dim)" }} data-testid="mylistings-empty">You haven't listed anything yet. <Link to="/sell" style={{ color: "var(--red)", fontWeight: 700 }}>List an item</Link>.</div>
                : <div className="listings-grid" data-testid="my-listings-grid">{mine.map((l) => <ListingCard key={l.id} listing={l} />)}</div>}
            </>
          )}
        </main>
      </div>
      {viewer !== null && <StoryViewer stories={stories} index={viewer} onClose={() => setViewer(null)} onIndex={setViewer} />}
    </div>
  );
}
